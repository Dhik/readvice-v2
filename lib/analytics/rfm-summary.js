// ─── RFM Customer Segmentation engine ────────────────────────────────────────
// Reads the stored RfmScore snapshot (computed by the recompute job / seed-dev-rfm)
// and serves overview / scatter / per-segment / detail / recommendations.
//
// HONESTY (see docs/RFM_DATA_SOURCES.md): recency/frequency/monetary are REAL for
// source='REAL-DERIVED' rows (derived from real Orders) and DUMMY for padding rows
// (source='DUMMY', which only fill the segment grid in dev). Each row/point carries
// `dummy`. Unlike BCG, RFM has NO fabricated axis — it becomes FULLY real as customer
// coverage improves; dummy rows are just dev scaffolding.
//
// Scores (1-5) and `segment` are STORED (computed at recompute time over the full
// population + as-of date — not a per-request calc). The engine reads them.
//
// Tenant scoping: EVERY read filters tenantId. Decimal/BigInt → Number at the boundary.
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { EXCLUDED_STATUSES } from '../hpp/compute-hpp'

const round2 = n => Math.round((Number(n) || 0) * 100) / 100
const num    = v => Number(v ?? 0)
const iso    = d => (d ? new Date(d).toISOString().slice(0, 10) : null)

// ── FIELD_MANIFEST (Part B1) — numeric params for calculated fields ───────────
// `dummy` reflects the engine's honesty model: r/f/m + recency/frequency/monetary
// are REAL-DERIVED *field types* (computed from real Orders). RFM has NO fabricated
// field — the only dummy flag is the PER-ROW `dummy` (padding customers, source=
// 'DUMMY'), which the page already badges. So every param is dummy:false at the
// field level; row-level padding is handled separately (becomes fully real as
// customer coverage grows).
export const FIELD_MANIFEST = [
  { key: 'recencyDays', label: 'Recency (days)',     unit: 'days',  dummy: false, source: 'REAL-DERIVED' },
  { key: 'frequency',   label: 'Frequency (orders)', unit: 'count', dummy: false, source: 'REAL-DERIVED' },
  { key: 'monetary',    label: 'Monetary',           unit: 'IDR',   dummy: false, source: 'REAL-DERIVED' },
  { key: 'r',           label: 'R score',            unit: '1–5',   dummy: false, source: 'REAL-DERIVED' },
  { key: 'f',           label: 'F score',            unit: '1–5',   dummy: false, source: 'REAL-DERIVED' },
  { key: 'm',           label: 'M score',            unit: '1–5',   dummy: false, source: 'REAL-DERIVED' },
]

// Canonical segment order + marketing meta (action / priority / color). Keyed by the
// exact segment strings the recompute job writes.
export const SEGMENT_ORDER = [
  'Champions', 'Loyal Customers', 'Potential Loyalist', 'New Customers', 'Promising',
  'Need Attention', 'About to Sleep', 'At Risk', "Can't Lose Them", 'Hibernating', 'Lost',
]

export const SEGMENT_META = {
  'Champions':          { color: '#22c55e', priority: 'Retain & amplify',   action: 'Reward them — early access, referrals, VIP perks. They advocate for the brand.' },
  'Loyal Customers':    { color: '#4ade80', priority: 'Grow value',         action: 'Upsell higher-value items and ask for reviews. They respond to engagement.' },
  'Potential Loyalist': { color: '#A9C5A0', priority: 'Deepen relationship', action: 'Offer a loyalty/membership program; recommend related products.' },
  'New Customers':      { color: '#6B8E9E', priority: 'Activate',           action: 'Onboard with support and build early trust to drive a 2nd order.' },
  'Promising':          { color: '#C9A66B', priority: 'Nurture',            action: 'Nurture with light offers; keep the brand top-of-mind.' },
  'Need Attention':     { color: '#E07B39', priority: 'Re-engage',          action: 'Reactivate with limited-time offers based on past purchases.' },
  'About to Sleep':     { color: '#f59e0b', priority: 'Win back',           action: 'Win back with reminders and a small incentive before they churn.' },
  'At Risk':            { color: '#B5645B', priority: 'Recover',            action: 'Send personalized reactivation — they were valuable but are lapsing.' },
  "Can't Lose Them":    { color: '#dc3545', priority: 'Critical recover',   action: 'High-value and lapsing — aggressive, personal win-back. Talk to them directly.' },
  'Hibernating':        { color: '#8B5E3C', priority: 'Low-touch',          action: 'Low-cost reactivation campaign; expect a modest return.' },
  'Lost':               { color: '#2C3639', priority: 'Deprioritize',       action: 'Minimal spend — include only in occasional broad campaigns.' },
}
export const segmentColor = s => SEGMENT_META[s]?.color ?? '#8B8B8B'

// ── Core loader: tenant + as-of date → enriched customer rows ─────────────────
// Single source other functions build on. Tenant-scoped; defaults to the latest
// snapshot date when none given.
async function loadSnapshot(tenantId, asOfDate) {
  let when = asOfDate ? new Date(asOfDate) : null
  if (!when) {
    const latest = await prisma.rfmScore.findFirst({
      where: { tenantId }, orderBy: { asOfDate: 'desc' }, select: { asOfDate: true },
    })
    when = latest ? new Date(latest.asOfDate) : null
  }
  if (!when) return { asOf: null, items: [] }

  const rows = await prisma.rfmScore.findMany({
    where: { tenantId, asOfDate: when }, orderBy: { monetary: 'desc' },
  })
  const items = rows.map(r => ({
    customerKey: r.customerKey,
    name:        r.customerName ?? r.customerKey,
    recencyDays: r.recencyDays,
    frequency:   r.frequency,
    monetary:    round2(r.monetary),
    r: r.rScore, f: r.fScore, m: r.mScore,
    rfm:         `${r.rScore}${r.fScore}${r.mScore}`,
    segment:     r.segment,
    dummy:       r.source === 'DUMMY',   // true → fabricated padding customer
    source:      r.source,
  }))
  return { asOf: when, items }
}

// Real customer coverage (order-level): what % of real-sales orders carry a
// customer id. Tenant-scoped. This is the honest ceiling on how "complete" RFM is.
async function getCoverage(tenantId) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE customer_username IS NOT NULL)::int AS with_customer
    FROM orders
    WHERE tenant_id = ${tenantId} AND status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})`)
  const total = num(rows[0]?.total), withCust = num(rows[0]?.with_customer)
  return { totalOrders: total, ordersWithCustomer: withCust, coveragePct: total > 0 ? round2((withCust / total) * 100) : 0 }
}

/** Distinct snapshot dates for the tenant (newest first). */
export async function getAvailableDates(tenantId) {
  const rows = await prisma.rfmScore.findMany({
    where: { tenantId }, distinct: ['asOfDate'], orderBy: { asOfDate: 'desc' },
    select: { asOfDate: true, source: true },
  })
  return rows.map(r => ({ date: iso(r.asOfDate) }))
}

/** Overview KPIs: totals, real/dummy split, coverage, segment counts, avg scores. */
export async function getRfmOverview(tenantId, asOfDate) {
  const { asOf, items } = await loadSnapshot(tenantId, asOfDate)
  const coverage = await getCoverage(tenantId)
  if (!items.length) {
    return { asOf: iso(asOf), hasDummy: false, totalCustomers: 0, realCustomers: 0, dummyCustomers: 0,
      coveragePct: coverage.coveragePct, ...coverage, totalMonetary: 0, avgRecency: 0, avgFrequency: 0,
      avgMonetary: 0, avgR: 0, avgF: 0, avgM: 0, segments: {} }
  }
  const real  = items.filter(i => !i.dummy)
  const dummy = items.filter(i => i.dummy)
  const avg = (arr, f) => arr.length ? round2(arr.reduce((a, x) => a + x[f], 0) / arr.length) : 0
  const segments = {}
  for (const i of items) segments[i.segment] = (segments[i.segment] ?? 0) + 1
  return {
    asOf: iso(asOf),
    hasDummy: dummy.length > 0,
    totalCustomers: items.length,
    realCustomers: real.length,
    dummyCustomers: dummy.length,
    ...coverage,
    totalMonetary: round2(items.reduce((a, i) => a + i.monetary, 0)),     // incl. dummy padding
    realMonetary:  round2(real.reduce((a, i) => a + i.monetary, 0)),       // REAL customers only (honest)
    avgRecency:   avg(items, 'recencyDays'),
    avgFrequency: avg(items, 'frequency'),
    avgMonetary:  avg(items, 'monetary'),
    avgR: avg(items, 'r'), avgF: avg(items, 'f'), avgM: avg(items, 'm'),
    segments,
  }
}

/**
 * Scatter/bubble points. Default axes Recency(x) × Frequency(y), bubble size ∝
 * monetary, colored by segment. All scores + raw values included so the page can
 * re-axis (e.g. R×F or Frequency×Monetary).
 */
export async function getRfmScatter(tenantId, asOfDate) {
  const { asOf, items } = await loadSnapshot(tenantId, asOfDate)
  const points = items.map(i => ({
    customerKey: i.customerKey, name: i.name,
    recencyDays: i.recencyDays, frequency: i.frequency, monetary: i.monetary,
    r: i.r, f: i.f, m: i.m, segment: i.segment, dummy: i.dummy,
  }))
  return {
    asOf: iso(asOf),
    hasDummy: items.some(i => i.dummy),
    points,
    axes: { xLabel: 'Recency (days, lower = better)', yLabel: 'Frequency (orders)', sizeLabel: 'Monetary' },
  }
}

/** Per-segment summary: count, share, revenue, averages, action. Ordered canonically. */
export async function getSegmentSummary(tenantId, asOfDate) {
  const { asOf, items } = await loadSnapshot(tenantId, asOfDate)
  const totalRev = items.reduce((a, i) => a + i.monetary, 0) || 1
  const total = items.length || 1
  const present = SEGMENT_ORDER.filter(s => items.some(i => i.segment === s))
  const summary = present.map(seg => {
    const rows = items.filter(i => i.segment === seg)
    const n = rows.length
    const rev = rows.reduce((a, i) => a + i.monetary, 0)
    const avg = f => round2(rows.reduce((a, i) => a + i[f], 0) / n)
    return {
      segment: seg,
      count: n,
      pct: round2((n / total) * 100),
      revenue: round2(rev),
      revenuePct: round2((rev / totalRev) * 100),
      avgRecency: avg('recencyDays'),
      avgFrequency: avg('frequency'),
      avgMonetary: avg('monetary'),
      realCount: rows.filter(r => !r.dummy).length,
      dummyCount: rows.filter(r => r.dummy).length,
      color: segmentColor(seg),
      ...SEGMENT_META[seg],
    }
  })
  return { asOf: iso(asOf), hasDummy: items.some(i => i.dummy), total: items.length, segments: summary }
}

/** Full per-customer detail + (for real customers) their order history. */
export async function getCustomerDetail(tenantId, customerKey, asOfDate) {
  const { asOf, items } = await loadSnapshot(tenantId, asOfDate)
  const c = items.find(i => i.customerKey === customerKey)
  if (!c) return null

  let orders = []
  if (!c.dummy) {
    // REAL customer → real order history (tenant-scoped, excl. cancelled).
    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT o.order_id AS order_id, o.order_date::date AS date, o.platform AS platform,
             o.gmv AS gmv, o.status AS status
      FROM orders o
      WHERE o.tenant_id = ${tenantId} AND o.customer_username = ${customerKey}
        AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})
      ORDER BY o.order_date DESC`)
    orders = rows.map(o => ({
      orderId: o.order_id, date: iso(o.date), platform: o.platform, gmv: round2(o.gmv), status: o.status,
    }))
  }
  return {
    asOf: iso(asOf), ...c, ...SEGMENT_META[c.segment], color: segmentColor(c.segment),
    orders, orderHistoryAvailable: !c.dummy,
  }
}

/** Per-segment marketing recommendations + priority customers (top by monetary). */
export async function getRecommendations(tenantId, asOfDate) {
  const { asOf, items } = await loadSnapshot(tenantId, asOfDate)
  const present = SEGMENT_ORDER.filter(s => items.some(i => i.segment === s))
  const recs = present.map(seg => {
    const rows = items.filter(i => i.segment === seg)
    const priority = [...rows].sort((a, b) => b.monetary - a.monetary).slice(0, 5)
      .map(c => ({ customerKey: c.customerKey, name: c.name, monetary: c.monetary, frequency: c.frequency, dummy: c.dummy }))
    return {
      segment: seg, count: rows.length, color: segmentColor(seg), ...SEGMENT_META[seg],
      revenue: round2(rows.reduce((a, i) => a + i.monetary, 0)),
      priority,
    }
  })
  return { asOf: iso(asOf), hasDummy: items.some(i => i.dummy), segments: recs }
}

/**
 * Advanced filter/sort over the snapshot. Tenant-scoped via loadSnapshot.
 * @param {object} opts { segment, minMonetary, minFrequency, maxRecency, realOnly, search, sortBy, sortDir, limit }
 */
export async function advancedFilter(tenantId, asOfDate, opts = {}) {
  const { asOf, items } = await loadSnapshot(tenantId, asOfDate)
  const {
    segment, minMonetary = 0, minFrequency = 0, maxRecency, realOnly,
    search, sortBy = 'monetary', sortDir = 'desc', limit,
  } = opts

  let out = items.filter(i =>
    (!segment || i.segment === segment) &&
    i.monetary >= num(minMonetary) &&
    i.frequency >= num(minFrequency) &&
    (maxRecency == null || maxRecency === '' || i.recencyDays <= num(maxRecency)) &&
    (!realOnly || !i.dummy) &&
    (!search || `${i.customerKey} ${i.name}`.toLowerCase().includes(String(search).toLowerCase()))
  )
  const dir = sortDir === 'asc' ? 1 : -1
  out.sort((a, b) => ((a[sortBy] ?? 0) > (b[sortBy] ?? 0) ? 1 : (a[sortBy] ?? 0) < (b[sortBy] ?? 0) ? -1 : 0) * dir)
  if (limit) out = out.slice(0, Number(limit))

  return { asOf: iso(asOf), hasDummy: items.some(i => i.dummy), count: out.length, items: out }
}
