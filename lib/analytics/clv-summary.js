// ─── CLV (Customer Lifetime Value) engine (Wave 3 §3.1 — MIXED real/dummy) ────
// Two halves, kept strictly separate so the page never blends them:
//   • HISTORIC value (REAL): Σ non-cancelled order revenue per customer_username —
//     reuses RFM's customer identity + EXCLUDED_STATUSES. dummy:false. Inherits RFM's
//     ~56% customer_username coverage caveat (surfaced, RFM-style).
//   • PROJECTION (DUMMY): a forward CLV projection. There is NOT enough repeat history
//     for a real projection (same limit as Cohort/Forecasting) → FABRICATED from STATED
//     assumptions, flagged dummy:true (honesty posture #1 — prominent banner). Never
//     presented as a real prediction; becomes real as repeat history accrues (ties to RFM).
//
// CLV's fit-for-purpose forms = distribution + percentile bands (NOT a quadrant).
// TZ-1: dates are raw UTC, consistent with RFM/the other modules. On-the-fly compute
// (no snapshot, no new Prisma model). Tenant-scoped; Decimal/BigInt → Number at the boundary.
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { EXCLUDED_STATUSES } from '../hpp/compute-hpp'

const num    = v => Number(v ?? 0)
const round2 = n => Math.round((Number(n) || 0) * 100) / 100
const iso    = d => (d ? new Date(d).toISOString().slice(0, 10) : null)
const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }

// STATED projection assumptions — fabricated, NOT derived from real repeat history.
const ASSUMED_FUTURE_ORDERS = 3
const ASSUMED_RETENTION     = 0.5
const PROJECTION_BASIS =
  `Projected future value = avg order value × ${ASSUMED_FUTURE_ORDERS} assumed future orders × ${ASSUMED_RETENTION} assumed retention. ` +
  'This is a FABRICATED assumption — there is not enough repeat history for a real projection. Becomes real as repeat history accrues.'

// ── FIELD_MANIFEST (Part B1) — numeric params for calculated fields ───────────
// Historic value / frequency / AOV are REAL-DERIVED (real Orders). The PROJECTION fields
// (projectedFutureValue, projectedClv) are DUMMY — fabricated from stated assumptions.
export const FIELD_MANIFEST = [
  { key: 'historicValue',        label: 'Historic value',      unit: 'IDR',   dummy: false, source: 'REAL-DERIVED' },
  { key: 'frequency',            label: 'Orders',              unit: 'count', dummy: false, source: 'REAL-DERIVED' },
  { key: 'avgOrderValue',        label: 'Avg order value',     unit: 'IDR',   dummy: false, source: 'REAL-DERIVED' },
  { key: 'projectedFutureValue', label: 'Projected future value', unit: 'IDR', dummy: true,  source: 'DUMMY' },
  { key: 'projectedClv',         label: 'Projected CLV',       unit: 'IDR',   dummy: true,  source: 'DUMMY-DERIVED' },
]

// ── Core loader: per-customer REAL historic value + DUMMY projection ──────────
async function loadCustomers(tenantId) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT customer_username AS username, MAX(customer_name) AS name,
           COUNT(*)::int AS frequency, COALESCE(SUM(gmv), 0) AS historic_value,
           MIN(order_date)::date AS first_order, MAX(order_date)::date AS last_order
    FROM orders
    WHERE tenant_id = ${tenantId} AND customer_username IS NOT NULL
      AND status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})
    GROUP BY customer_username`)
  return rows.map(r => {
    const historicValue = round2(r.historic_value)          // REAL
    const frequency = num(r.frequency)                       // REAL
    const avgOrderValue = frequency > 0 ? round2(historicValue / frequency) : 0   // REAL-DERIVED
    // DUMMY projection — stated assumptions, never presented as real.
    const projectedFutureValue = round2(avgOrderValue * ASSUMED_FUTURE_ORDERS * ASSUMED_RETENTION)
    const projectedClv = round2(historicValue + projectedFutureValue)
    return {
      username: r.username, name: r.name ?? r.username,
      frequency, historicValue, avgOrderValue,
      firstOrder: iso(r.first_order), lastOrder: iso(r.last_order),
      projectedFutureValue, projectedClv,   // DUMMY (flagged at response level + manifest)
    }
  }).sort((a, b) => b.historicValue - a.historicValue)
}

// Real customer coverage — what % of real-sales orders carry a customer id (RFM-style).
async function getCoverage(tenantId) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE customer_username IS NOT NULL)::int AS with_customer
    FROM orders
    WHERE tenant_id = ${tenantId} AND status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})`)
  const total = num(rows[0]?.total), withCust = num(rows[0]?.with_customer)
  return { totalOrders: total, ordersWithCustomer: withCust, coveragePct: total > 0 ? round2((withCust / total) * 100) : 0 }
}

const median = arr => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
// Quartile thresholds of historic value (percentile bands).
function thresholds(customers) {
  const s = [...customers].map(c => c.historicValue).sort((a, b) => a - b)
  const n = s.length
  const q = p => (n ? s[Math.min(n - 1, Math.floor(n * p))] : 0)
  return { t25: q(0.25), t50: q(0.5), t75: q(0.75) }
}
const TIER_ORDER = ['High', 'Mid-High', 'Mid-Low', 'Low']
const tierOf = (v, th) => v >= th.t75 ? 'High' : v >= th.t50 ? 'Mid-High' : v >= th.t25 ? 'Mid-Low' : 'Low'

/** Overview: REAL historic totals + coverage caveat + a clearly-flagged DUMMY projection total. */
export async function getClvOverview(tenantId) {
  const customers = await loadCustomers(tenantId)
  const coverage = await getCoverage(tenantId)
  if (!customers.length) {
    return { hasData: false, customerCount: 0, ...coverage,
      note: 'No customer-identified orders for this tenant — CLV needs customer_username on orders (Cleora / tenant 2 in dev).' }
  }
  const totalHistoric = round2(customers.reduce((a, c) => a + c.historicValue, 0))
  const totalProjectedFuture = round2(customers.reduce((a, c) => a + c.projectedFutureValue, 0))
  const totalProjectedClv = round2(customers.reduce((a, c) => a + c.projectedClv, 0))
  return {
    hasData: true,
    customerCount: customers.length,
    // REAL (dummy:false):
    totalHistoricValue: totalHistoric,
    avgHistoricValue: round2(totalHistoric / customers.length),
    medianHistoricValue: round2(median(customers.map(c => c.historicValue))),
    repeatCustomers: customers.filter(c => c.frequency >= 2).length,
    ...coverage,
    // DUMMY (flagged) — kept in its own sub-object so it never blends with a real number:
    projection: {
      dummy: true,
      totalProjectedFutureValue: totalProjectedFuture,
      totalProjectedClv,
      assumedFutureOrders: ASSUMED_FUTURE_ORDERS,
      assumedRetention: ASSUMED_RETENTION,
      assumption: PROJECTION_BASIS,
    },
    coverageNote: `Historic value covers the ${coverage.coveragePct}% of orders carrying a customer id (customer_username); earlier/anonymous orders aren't attributed. Becomes more complete as id capture improves (shared with RFM).`,
  }
}

/** Distribution histogram of REAL historic value (the CLV spread). dummy:false. */
export async function getClvDistribution(tenantId) {
  const customers = await loadCustomers(tenantId)
  const values = customers.map(c => c.historicValue)
  if (!values.length) return { dummy: false, buckets: [], customerCount: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const cap = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1] || 1
  const N = 8, step = (cap || 1) / N
  const buckets = Array.from({ length: N }, (_, i) => ({ lo: round2(i * step), hi: round2((i + 1) * step), count: 0, label: `${shortRp(i * step)}–${shortRp((i + 1) * step)}` }))
  const overflow = { lo: round2(cap), hi: null, count: 0, label: `>${shortRp(cap)}` }
  for (const v of values) {
    if (v > cap) { overflow.count++; continue }
    buckets[Math.min(N - 1, Math.floor(v / step))].count++
  }
  return { dummy: false, buckets: [...buckets, overflow], cap: round2(cap), customerCount: values.length, basis: 'Real historic value (Σ non-cancelled order revenue per customer).' }
}

/** Percentile value tiers (quartiles) over REAL historic value + per-tier DUMMY projected total. */
export async function getClvTiers(tenantId) {
  const customers = await loadCustomers(tenantId)
  if (!customers.length) return { dummy: false, tiers: [] }
  const th = thresholds(customers)
  const totalHistoric = customers.reduce((a, c) => a + c.historicValue, 0) || 1
  const groups = new Map(TIER_ORDER.map(t => [t, { tier: t, count: 0, historic: 0, projected: 0 }]))
  for (const c of customers) {
    const g = groups.get(tierOf(c.historicValue, th))
    g.count++; g.historic += c.historicValue; g.projected += c.projectedClv
  }
  const tiers = TIER_ORDER.map(t => {
    const g = groups.get(t)
    return {
      tier: t, count: g.count,
      totalHistoricValue: round2(g.historic),                    // REAL
      avgHistoricValue: g.count ? round2(g.historic / g.count) : 0, // REAL
      historicSharePct: round2((g.historic / totalHistoric) * 100), // REAL
      totalProjectedClv: round2(g.projected),                    // DUMMY
      dummyProjection: true,
    }
  })
  return { dummy: false, thresholds: { t25: round2(th.t25), t50: round2(th.t50), t75: round2(th.t75) }, tiers }
}

/** Per-customer rows for the DataGrid (REAL value + DUMMY projection + tier). */
export async function getClvCustomers(tenantId) {
  const customers = await loadCustomers(tenantId)
  if (!customers.length) return { projectionDummy: true, items: [] }
  const th = thresholds(customers)
  return {
    projectionDummy: true,
    items: customers.map(c => ({ ...c, tier: tierOf(c.historicValue, th) })),
  }
}

/** One customer: REAL order history + historic value, plus the DUMMY projection (separated). */
export async function getCustomerClvDetail(tenantId, username) {
  const customers = await loadCustomers(tenantId)
  const c = customers.find(x => x.username === username)
  if (!c) return null
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT order_id AS order_id, order_date::date AS date, platform, gmv, status
    FROM orders
    WHERE tenant_id = ${tenantId} AND customer_username = ${username}
      AND status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})
    ORDER BY order_date DESC`)
  return {
    username: c.username, name: c.name,
    real: {
      historicValue: c.historicValue, frequency: c.frequency, avgOrderValue: c.avgOrderValue,
      firstOrder: c.firstOrder, lastOrder: c.lastOrder,
      orders: rows.map(o => ({ orderId: o.order_id, date: iso(o.date), platform: o.platform, gmv: round2(o.gmv), status: o.status })),
    },
    projection: {
      dummy: true,
      projectedFutureValue: c.projectedFutureValue, projectedClv: c.projectedClv,
      assumedFutureOrders: ASSUMED_FUTURE_ORDERS, assumedRetention: ASSUMED_RETENTION,
      assumption: PROJECTION_BASIS,
    },
  }
}
