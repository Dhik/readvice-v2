// ─── Order/Sales Analysis (SP2) — order-level temporal analysis ──────────────
// SaaS feature for ALL tenants. Computed live from Order (no snapshot table).
// Tenant-scoped on EVERY query — tenantId is bound into the SQL WHERE via ${},
// never trusted/concatenated. Goes DEEPER than /sales (which shows only current
// totals + a current platform donut) and does NOT overlap SP1 (product-level).
//
// TWO-BASIS DESIGN (important):
//   • "Real-sales" metrics (time-series, AOV, distribution, day-of-week,
//     platform-over-time, customer split, KPIs) EXCLUDE cancelled/unpaid orders
//     via EXCLUDED_STATUSES — same basis as HPP/NP2b, so the numbers reconcile.
//   • The STATUS BREAKDOWN deliberately includes ALL statuses (it IS the funnel);
//     each row carries an `excluded` flag so the UI can show which statuses are
//     filtered out of the real-sales metrics.
//
// TZ-1 caveat: Order.orderDate stores date-only as 17:00 UTC (= WIB midnight).
// date_trunc()/EXTRACT(DOW) operate on the UTC value, so buckets group by UTC day
// EXACTLY like HPP — consistent app-wide, but a WIB order can land in the prior
// UTC day (and the prior weekday). We keep UTC-consistent grouping on purpose and
// surface a prominent UI note rather than shifting only here. App-wide TZ fix is
// tracked in PROJECT_STATUS backlog.
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { EXCLUDED_STATUSES } from '../hpp/compute-hpp'

const DAY_MS = 86400000
const VALID_GRAN = new Set(['day', 'week', 'month'])
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const UNIT_LABELS  = { 0: '1', 1: '2-3', 2: '4-5', 3: '6+' }
// Fixed IDR ladder (v1). NB: IDR-specific — revisit for adaptive/quantile buckets
// if/when a multi-currency tenant appears.
const VALUE_LABELS = { 0: '< 100k', 1: '100–250k', 2: '250–500k', 3: '500k–1M', 4: '1M+' }

const round2 = n => Math.round(n * 100) / 100
const iso = d => new Date(d).toISOString().slice(0, 10)

function resolveWindow(startDate, endDate) {
  const end   = endDate ? new Date(endDate) : new Date()
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 40 * DAY_MS)
  return { start, end }
}

/**
 * Order-level temporal analysis for a tenant + window + optional platform.
 * @param {object} opts - { startDate?, endDate?, platform?, granularity? }
 * @returns forward-compatible summary (SP-future adds optional keys only).
 */
export async function getOrderAnalysis(tenantId, { startDate, endDate, platform, granularity } = {}) {
  const { start, end } = resolveWindow(startDate, endDate)
  const plat = (platform && String(platform).trim() !== '') ? String(platform) : null
  // Whitelist FIRST (defense-in-depth), THEN bind as a parameter below.
  const gran = VALID_GRAN.has(String(granularity)) ? String(granularity) : 'day'

  // Reusable, fully-parameterized scope fragments (nested Prisma.sql — still bound).
  const scope = Prisma.sql`
    o.tenant_id = ${tenantId}
    AND o.order_date >= ${start} AND o.order_date <= ${end}
    AND (${plat}::text IS NULL OR o.platform = ${plat})`
  const realSales = Prisma.sql`${scope} AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})`

  // ── A. Time-series + AOV trend (real-sales) — one query ──────────────────────
  const tsRows = await prisma.$queryRaw(Prisma.sql`
    SELECT date_trunc(${gran}, o.order_date) AS period,
           COUNT(*) AS orders, SUM(o.gmv) AS gmv, SUM(o.nett) AS nett, SUM(o.qty) AS qty
    FROM orders o WHERE ${realSales}
    GROUP BY 1 ORDER BY 1`)
  const timeSeries = tsRows.map(r => ({
    period: iso(r.period),
    orders: Number(r.orders ?? 0),
    gmv:    round2(Number(r.gmv  ?? 0)),
    nett:   round2(Number(r.nett ?? 0)),
    qty:    Number(r.qty ?? 0),
  }))
  const aovTrend = timeSeries.map(t => ({
    period: t.period,
    aov: t.orders > 0 ? round2(t.gmv / t.orders) : 0,
  }))

  // ── B. Status breakdown (ALL statuses — the funnel) ──────────────────────────
  const stRows = await prisma.$queryRaw(Prisma.sql`
    SELECT COALESCE(o.status, '(none)') AS status, COUNT(*) AS orders, SUM(o.gmv) AS gmv
    FROM orders o WHERE ${scope}
    GROUP BY o.status ORDER BY orders DESC`)
  const totalOrdersAll = stRows.reduce((a, r) => a + Number(r.orders ?? 0), 0)
  const statusBreakdown = stRows.map(r => {
    const orders = Number(r.orders ?? 0)
    return {
      status:    r.status,
      orders,
      ordersPct: totalOrdersAll > 0 ? round2((orders / totalOrdersAll) * 100) : 0,
      gmv:       round2(Number(r.gmv ?? 0)),
      excluded:  EXCLUDED_STATUSES.includes(r.status), // filtered out of real-sales metrics
    }
  })

  // ── C. Order-size distribution (real-sales) — width_bucket ───────────────────
  const unitRows = await prisma.$queryRaw(Prisma.sql`
    SELECT width_bucket(o.qty, ARRAY[2,4,6]::int[]) AS b, COUNT(*) AS orders
    FROM orders o WHERE ${realSales} AND o.qty IS NOT NULL
    GROUP BY 1 ORDER BY 1`)
  const valueRows = await prisma.$queryRaw(Prisma.sql`
    SELECT width_bucket(o.gmv, ARRAY[100000,250000,500000,1000000]::numeric[]) AS b, COUNT(*) AS orders
    FROM orders o WHERE ${realSales} AND o.gmv IS NOT NULL
    GROUP BY 1 ORDER BY 1`)
  const sizeDistribution = {
    units: unitRows.map(r => ({ bucket: Number(r.b), label: UNIT_LABELS[Number(r.b)] ?? String(r.b), orders: Number(r.orders ?? 0) })),
    value: valueRows.map(r => ({ bucket: Number(r.b), label: VALUE_LABELS[Number(r.b)] ?? String(r.b), orders: Number(r.orders ?? 0) })),
  }

  // ── D. Day-of-week (real-sales) — UTC DOW, see TZ-1 ──────────────────────────
  const dowRows = await prisma.$queryRaw(Prisma.sql`
    SELECT EXTRACT(DOW FROM o.order_date)::int AS dow, COUNT(*) AS orders, SUM(o.gmv) AS gmv, SUM(o.qty) AS qty
    FROM orders o WHERE ${realSales}
    GROUP BY 1 ORDER BY 1`)
  const dowMap = new Map(dowRows.map(r => [Number(r.dow), r]))
  const dayOfWeek = DOW_NAMES.map((day, dow) => {
    const r = dowMap.get(dow)
    return {
      dow, day,
      orders: r ? Number(r.orders ?? 0) : 0,
      gmv:    r ? round2(Number(r.gmv ?? 0)) : 0,
      qty:    r ? Number(r.qty ?? 0) : 0,
    }
  })

  // ── E. Platform over time (real-sales) — page pivots into stacked bars ───────
  const potRows = await prisma.$queryRaw(Prisma.sql`
    SELECT date_trunc(${gran}, o.order_date) AS period, o.platform AS platform,
           SUM(o.gmv) AS gmv, COUNT(*) AS orders
    FROM orders o WHERE ${realSales}
    GROUP BY 1, o.platform ORDER BY 1`)
  const platformOverTime = potRows.map(r => ({
    period:   iso(r.period),
    platform: r.platform,
    gmv:      round2(Number(r.gmv ?? 0)),
    orders:   Number(r.orders ?? 0),
  }))

  // ── F. Customer split (real-sales) — partial coverage, honest labeling ───────
  const csRows = await prisma.$queryRaw(Prisma.sql`
    WITH c AS (
      SELECT o.customer_username AS u, COUNT(*) AS n
      FROM orders o WHERE ${realSales} AND o.customer_username IS NOT NULL
      GROUP BY o.customer_username
    )
    SELECT COUNT(*)::int                                       AS distinct_customers,
           COUNT(*) FILTER (WHERE n > 1)::int                  AS returning_customers,
           COALESCE(SUM(n), 0)::int                            AS orders_with_customer,
           COALESCE(SUM(n) FILTER (WHERE n = 1), 0)::int       AS orders_from_new,
           COALESCE(SUM(CASE WHEN n > 1 THEN n ELSE 0 END), 0)::int AS orders_from_returning
    FROM c`)
  const cs = csRows[0] ?? {}
  const realSalesOrders = timeSeries.reduce((a, t) => a + t.orders, 0)
  const ordersWithCustomer = Number(cs.orders_with_customer ?? 0)
  const customerSplit = {
    distinctCustomers:   Number(cs.distinct_customers ?? 0),
    returningCustomers:  Number(cs.returning_customers ?? 0),
    newCustomers:        Number(cs.distinct_customers ?? 0) - Number(cs.returning_customers ?? 0),
    ordersFromNew:       Number(cs.orders_from_new ?? 0),
    ordersFromReturning: Number(cs.orders_from_returning ?? 0),
    // Coverage vs real-sales orders (same basis as the counts above).
    coverage: {
      ordersWithCustomer,
      totalOrders: realSalesOrders,
      pct: realSalesOrders > 0 ? round2((ordersWithCustomer / realSalesOrders) * 100) : 0,
    },
    basis: 'real-sales',
    // "Returning" = customer (by username) with >1 order WITHIN this window;
    // customerId is null so identity is the username string, and orders before
    // the window aren't counted. Partial: only orders that carry a username.
    definition: 'within-window single vs repeat purchaser (by username)',
  }

  // ── Distinct platforms for the filter pills (unfiltered by platform) ─────────
  // NB: Order.platform is a required (non-null) column, so `{ not: null }` is both
  // invalid (Prisma rejects it) and unnecessary — filter nulls out in JS below.
  const platList = await prisma.order.groupBy({
    by:    ['platform'],
    where: { tenantId, orderDate: { gte: start, lte: end } },
  })
  const availablePlatforms = platList.map(p => p.platform).filter(Boolean).sort((a, b) => a.localeCompare(b))

  // ── KPIs (real-sales, SP2-specific — no overlap with /sales) ─────────────────
  const totalRevenue = round2(timeSeries.reduce((a, t) => a + t.gmv, 0))
  const bestWeekday  = dayOfWeek.reduce((b, d) => (d.gmv > (b?.gmv ?? -1) ? d : b), null)
  const peakPeriod   = timeSeries.reduce((b, t) => (t.gmv > (b?.gmv ?? -1) ? t : b), null)

  return {
    filters: { startDate: iso(start), endDate: iso(end), platform: plat, granularity: gran },
    timeSeries,
    aovTrend,
    statusBreakdown,
    sizeDistribution,
    dayOfWeek,
    platformOverTime,
    customerSplit,
    conversionRate: null, // PLACEHOLDER — no visits data source connected yet (Visit model exists, nothing syncs it)
    availablePlatforms,
    kpis: {
      totalRevenue,
      totalOrders: realSalesOrders,
      bestWeekday: bestWeekday && bestWeekday.gmv > 0 ? { day: bestWeekday.day, gmv: bestWeekday.gmv } : null,
      peakPeriod:  peakPeriod  && peakPeriod.gmv  > 0 ? { period: peakPeriod.period, gmv: peakPeriod.gmv } : null,
      repeatCustomers: customerSplit.returningCustomers,
    },
    generatedAt: new Date().toISOString(),
    // SP-future adds optional keys here (e.g. conversionRate populated once a
    // visits source exists) without breaking existing consumers.
  }
}
