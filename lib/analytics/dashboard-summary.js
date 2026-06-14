// ─── Dashboard summary (shared, tenant-scoped) ───────────────────────────────
// Reusable aggregations the compact dashboard pages share. Tenant-scoped on EVERY
// query. ALL Decimal/BigInt → Number before returning. Combines real Order data
// with Visit / AdSpend (real OR dummy — summed regardless of `source`, so once real
// connectors arrive the numbers just become real) + Campaign.totalExpense.
//
// Formulas (old-app parity):
//   Total Sales  = Σ Order.gmv (excl. cancelled)        Qty   = Σ Order.qty (excl.)
//   Visit        = Σ Visit.visits                        Order = count (excl. cancelled)
//   Total Spent  = Σ AdSpend(social+marketplace) + Σ Campaign.totalExpense
//   ROAS         = sales / totalSpent                    Closing Rate = order/visit×100
//   CPA          = raw ad spend (AdSpend only) / order
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'

// Cancelled/unpaid statuses excluded from "real sales" (per the dashboard spec).
export const EXCLUDED_STATUSES = [
  'cancelled', 'Batal', 'canceled', 'Canceled',
  'Pembatalan diajukan', 'Dibatalkan Sistem', 'Dibatalkan', 'Belum Bayar', 'pending',
]

const DAY_MS = 86400000
const num    = v => Number(v ?? 0)
const round2 = v => Math.round(num(v) * 100) / 100
const iso    = d => new Date(d).toISOString().slice(0, 10)

// period: { start, end } (Date|ISO) OR { month: 'YYYY-MM' }; default = last 30 days.
function resolvePeriod(period = {}) {
  if (period.month) {
    const [y, m] = period.month.split('-').map(Number)
    return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) }
  }
  const end   = period.end ? new Date(period.end) : new Date()
  const start = period.start ? new Date(period.start) : new Date(end.getTime() - 30 * DAY_MS)
  return { start, end }
}
// Equal-length window immediately before [start, end).
function previousOf({ start, end }) {
  const len = end.getTime() - start.getTime()
  return { start: new Date(start.getTime() - len), end: new Date(start.getTime()) }
}

// Raw metrics for one tenant + window (all real, tenant-scoped).
async function metricsFor(tenantId, { start, end }) {
  const [ord, vis, ad, camp] = await Promise.all([
    prisma.order.aggregate({
      where: { tenantId, orderDate: { gte: start, lt: end }, status: { notIn: EXCLUDED_STATUSES } },
      _sum: { gmv: true, qty: true }, _count: { id: true },
    }),
    prisma.visit.aggregate({ where: { tenantId, date: { gte: start, lt: end } }, _sum: { visits: true } }),
    prisma.adSpend.aggregate({ where: { tenantId, date: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.campaign.aggregate({ where: { tenantId, createdAt: { gte: start, lt: end } }, _sum: { totalExpense: true } }),
  ])

  const sales        = round2(ord._sum.gmv)
  const orders       = num(ord._count.id)
  const qty          = num(ord._sum.qty)
  const visits       = num(vis._sum.visits)
  const adSpendTotal = round2(ad._sum.amount)
  const campaignSpend = round2(camp._sum.totalExpense)
  const totalSpent   = round2(adSpendTotal + campaignSpend)

  return {
    sales, orders, qty, visits, adSpendTotal, campaignSpend, totalSpent,
    roas:        totalSpent > 0 ? round2(sales / totalSpent) : null,
    closingRate: visits > 0 ? round2((orders / visits) * 100) : null,
    cpa:         orders > 0 ? round2(adSpendTotal / orders) : null,
  }
}

const NUMERIC_KPIS = ['sales', 'visits', 'orders', 'totalSpent', 'roas', 'closingRate', 'qty', 'cpa']

/**
 * KPIs for a period + Δ vs the previous equal-length period.
 * @returns { current, previous, deltas } — deltas[key] = { abs, pct } (pct null if prev 0/null).
 */
export async function getKpis(tenantId, period) {
  const cur  = resolvePeriod(period)
  const prev = previousOf(cur)
  const [current, previous] = await Promise.all([metricsFor(tenantId, cur), metricsFor(tenantId, prev)])

  const deltas = {}
  for (const k of NUMERIC_KPIS) {
    const c = current[k], p = previous[k]
    if (c == null || p == null) { deltas[k] = { abs: null, pct: null }; continue }
    deltas[k] = { abs: round2(c - p), pct: p === 0 ? null : round2(((c - p) / p) * 100) }
  }
  return { filters: { start: iso(cur.start), end: iso(cur.end) }, current, previous, deltas }
}

/**
 * Daily series merging Order (turnover/order/qty), Visit, AdSpend per day.
 * @returns [{ date, visit, order, turnover, qty, ad_spent_total, closing_rate, roas }]
 */
export async function getDailySeries(tenantId, period) {
  const { start, end } = resolvePeriod(period)

  const [ordRows, visRows, adRows] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT date_trunc('day', o.order_date)::date AS d,
             SUM(o.gmv) AS turnover, COUNT(*)::int AS orders, SUM(o.qty)::int AS qty
      FROM orders o
      WHERE o.tenant_id = ${tenantId} AND o.order_date >= ${start} AND o.order_date < ${end}
        AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})
      GROUP BY 1`),
    prisma.visit.groupBy({ by: ['date'], where: { tenantId, date: { gte: start, lt: end } }, _sum: { visits: true } }),
    prisma.adSpend.groupBy({ by: ['date'], where: { tenantId, date: { gte: start, lt: end } }, _sum: { amount: true } }),
  ])

  const map = new Map() // dateISO → row
  const get = d => { const k = iso(d); if (!map.has(k)) map.set(k, { date: k, visit: 0, order: 0, turnover: 0, qty: 0, ad_spent_total: 0 }); return map.get(k) }
  for (const r of ordRows) { const x = get(r.d); x.turnover = round2(r.turnover); x.order = num(r.orders); x.qty = num(r.qty) }
  for (const r of visRows) { get(r.date).visit = num(r._sum.visits) }
  for (const r of adRows)  { get(r.date).ad_spent_total = round2(r._sum.amount) }

  return [...map.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({
      ...r,
      closing_rate: r.visit > 0 ? round2((r.order / r.visit) * 100) : 0,
      roas:         r.ad_spent_total > 0 ? round2(r.turnover / r.ad_spent_total) : 0,
    }))
}

/** All-status order breakdown (the funnel); `excluded` flags cancelled/unpaid. */
export async function getStatusBreakdown(tenantId, period) {
  const { start, end } = resolvePeriod(period)
  const rows = await prisma.order.groupBy({
    by: ['status'], where: { tenantId, orderDate: { gte: start, lt: end } },
    _count: { id: true }, _sum: { gmv: true },
  })
  const total = rows.reduce((a, r) => a + num(r._count.id), 0)
  return rows
    .map(r => ({
      status:    r.status ?? '(none)',
      orders:    num(r._count.id),
      gmv:       round2(r._sum.gmv),
      ordersPct: total > 0 ? round2((num(r._count.id) / total) * 100) : 0,
      excluded:  EXCLUDED_STATUSES.includes(r.status),
    }))
    .sort((a, b) => b.orders - a.orders)
}

/** Platform GMV split (real sales). */
export async function getPlatformSplit(tenantId, period) {
  const { start, end } = resolvePeriod(period)
  const rows = await prisma.order.groupBy({
    by: ['platform'],
    where: { tenantId, orderDate: { gte: start, lt: end }, status: { notIn: EXCLUDED_STATUSES } },
    _sum: { gmv: true }, _count: { id: true },
  })
  return rows
    .map(r => ({ platform: r.platform, gmv: round2(r._sum.gmv), orders: num(r._count.id) }))
    .filter(r => r.platform && r.gmv > 0)
    .sort((a, b) => b.gmv - a.gmv)
}
