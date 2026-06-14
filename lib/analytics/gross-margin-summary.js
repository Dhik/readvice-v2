// ─── Finance: Gross Margin engine (Wave 1 — 100% REAL) ───────────────────────
// Gross margin = REAL revenue (Order/OrderItem) − REAL COGS (DailyHpp frozen HPP).
// Reuses the HPP engine (compute-hpp.js) — does NOT reimplement HPP.
//
// CRITICAL HONESTY (see docs/GROSS_MARGIN_DATA_SOURCES.md): this is **GROSS margin
// ONLY**. It is **NOT net profit** — operating costs, platform fees, taxes, returns,
// and marketing spend are **NOT** deducted (that needs configurable business rules →
// Wave 3 Net P&L, deliberately deferred). Marketing spend may be shown ALONGSIDE as a
// SEPARATE contextual line, but is **never silently subtracted** into a fake "net".
//
// Data reality: OrderItem + DailyHpp are Cleora (tenant 2) only → margin returns
// `hasData:false` for tenants without OrderItem (never fabricated). HPP coverage is
// surfaced (SKUs without hargaCogs contribute 0 HPP → inflate blended margin; the
// COVERED margin is the trustworthy figure). SKU-level history is thin (≈June).
//
// Tenant scoping: EVERY read filters tenantId. Decimal/BigInt → Number at the boundary.
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { EXCLUDED_STATUSES, getDailyHpp, getDailyHppTotalsByDate, normalizeSku } from '../hpp/compute-hpp'

const round2 = n => Math.round((Number(n) || 0) * 100) / 100
const round1 = n => Math.round((Number(n) || 0) * 10) / 10
const num    = v => Number(v ?? 0)
const iso    = d => (d ? new Date(d).toISOString().slice(0, 10) : null)
const DAY_MS = 86400000

// Resolve the analysis window. Default = the tenant's FULL OrderItem date range
// (honest "all data"), since SKU-level history is thin and clustered.
async function resolvePeriod(tenantId, period) {
  if (period?.month) {
    const [y, m] = String(period.month).split('-').map(Number)
    return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1) - 1), full: false }
  }
  if (period?.start && period?.end) return { start: new Date(period.start), end: new Date(period.end), full: false }
  const r = await prisma.$queryRaw(Prisma.sql`
    SELECT MIN(o.order_date) AS mn, MAX(o.order_date) AS mx
    FROM orders o WHERE o.tenant_id = ${tenantId}
      AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})
      AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.sku IS NOT NULL)`)
  if (!r[0]?.mn) return null
  return { start: new Date(r[0].mn), end: new Date(r[0].mx), full: true }
}

// ── Core loader: per-SKU revenue (OrderItem) ⋈ HPP (DailyHpp) ⋈ coverage ──────
// Returns merged per-SKU margin rows + totals. Tenant-scoped. Single source of truth.
async function loadMargin(tenantId, period) {
  const win = await resolvePeriod(tenantId, period)
  if (!win) return { hasData: false, period: null, items: [], totals: null }

  // Revenue per RAW sku + catalog name + has-cost flag (real-sales, excl. cancelled).
  const revRows = await prisma.$queryRaw(Prisma.sql`
    SELECT oi.sku AS sku,
           COALESCE(MAX(pr.name), MAX(oi.product_name)) AS name,
           SUM(oi.subtotal) AS revenue, SUM(oi.qty)::int AS qty,
           bool_or(pr.harga_cogs IS NOT NULL AND pr.harga_cogs > 0) AS has_cost
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products pr ON pr.sku = oi.sku AND pr.tenant_id = o.tenant_id
    WHERE o.tenant_id = ${tenantId} AND o.order_date >= ${win.start} AND o.order_date <= ${win.end}
      AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)}) AND oi.sku IS NOT NULL
    GROUP BY oi.sku`)

  if (!revRows.length) return { hasData: false, period: win, items: [], totals: null }

  // HPP per (date, sku) from the frozen snapshot (reuse compute-hpp). Aggregate per nsku.
  const hppRows = await getDailyHpp(tenantId, { startDate: win.start, endDate: win.end })
  const hppMap = new Map()  // nsku → { hpp, qty }
  for (const h of hppRows) {
    const g = hppMap.get(h.sku) ?? { hpp: 0, qty: 0 }
    g.hpp += num(h.hpp); g.qty += num(h.qty); hppMap.set(h.sku, g)
  }

  // Merge by NORMALIZED sku (aligns OrderItem raw sku with DailyHpp normalized sku).
  const merged = new Map()
  for (const r of revRows) {
    const nsku = normalizeSku(r.sku)
    const g = merged.get(nsku) ?? { sku: nsku, name: r.name ?? nsku, revenue: 0, qty: 0, hasCost: false }
    g.revenue += num(r.revenue); g.qty += num(r.qty); g.hasCost = g.hasCost || !!r.has_cost
    if (!g.name || g.name === nsku) g.name = r.name ?? g.name
    merged.set(nsku, g)
  }
  const items = [...merged.values()].map(g => {
    const hpp = round2(hppMap.get(g.sku)?.hpp ?? 0)
    const revenue = round2(g.revenue)
    const grossProfit = round2(revenue - hpp)
    return {
      sku: g.sku, name: g.name, qty: g.qty, hasCost: g.hasCost,
      revenue, hpp, grossProfit,
      marginPct: revenue > 0 ? round1((grossProfit / revenue) * 100) : 0,
    }
  }).sort((a, b) => b.grossProfit - a.grossProfit)

  // Totals (blended = all; covered = SKUs with real cost → the trustworthy margin).
  const sum = (arr, f) => round2(arr.reduce((a, x) => a + x[f], 0))
  const covered = items.filter(i => i.hasCost)
  const totalRevenue = sum(items, 'revenue'), totalHpp = sum(items, 'hpp')
  const coveredRevenue = sum(covered, 'revenue'), coveredHpp = sum(covered, 'hpp')
  const totals = {
    totalRevenue, totalHpp, grossProfit: round2(totalRevenue - totalHpp),
    grossMarginPct: totalRevenue > 0 ? round1(((totalRevenue - totalHpp) / totalRevenue) * 100) : 0,
    coveredRevenue, coveredHpp, coveredGrossProfit: round2(coveredRevenue - coveredHpp),
    coveredMarginPct: coveredRevenue > 0 ? round1(((coveredRevenue - coveredHpp) / coveredRevenue) * 100) : 0,
    coveragePct: totalRevenue > 0 ? round1((coveredRevenue / totalRevenue) * 100) : 0,
    skuCount: items.length, coveredSkuCount: covered.length, uncoveredSkuCount: items.length - covered.length,
    qty: items.reduce((a, i) => a + i.qty, 0),
  }
  return { hasData: true, period: win, items, totals }
}

// Real marketing spend in a window (CONTEXT ONLY — never deducted). Social + marketing.
async function marketingSpendInWindow(tenantId, start, end) {
  const r = await prisma.$queryRaw(Prisma.sql`
    SELECT COALESCE(SUM(amount), 0) AS amt, COUNT(*)::int AS rows FROM (
      SELECT date, amount FROM ad_spent_social_media WHERE tenant_id = ${tenantId}
      UNION ALL SELECT date, amount FROM marketing WHERE tenant_id = ${tenantId}
    ) x WHERE date >= ${start} AND date <= ${end}`)
  return { amount: round2(r[0]?.amt), rows: num(r[0]?.rows) }
}

const emptyOverview = (period) => ({
  dummy: false, hasData: false, period: period ? { start: iso(period.start), end: iso(period.end) } : null,
  totalRevenue: 0, totalHpp: 0, grossProfit: 0, grossMarginPct: 0,
  coveredMarginPct: 0, coveragePct: 0, skuCount: 0,
  note: 'No SKU-level (OrderItem) data for this tenant — gross margin needs OrderItem + HPP (Cleora only in dev).',
})

/** Overview KPIs: revenue, HPP, gross profit, margin %, coverage, Δ vs previous period. */
export async function getMarginOverview(tenantId, period) {
  const cur = await loadMargin(tenantId, period)
  if (!cur.hasData) return emptyOverview(cur.period)

  // Previous equal-length window (for Δ) — only when a bounded period is meaningful.
  const span = cur.period.end - cur.period.start
  const prevEnd = new Date(cur.period.start.getTime() - DAY_MS)
  const prevStart = new Date(prevEnd.getTime() - span)
  const prev = await loadMargin(tenantId, { start: prevStart, end: prevEnd })
  const delta = (c, p) => (p > 0 ? round1(((c - p) / p) * 100) : null)
  const t = cur.totals
  const deltas = prev.hasData ? {
    revenue: delta(t.totalRevenue, prev.totals.totalRevenue),
    grossProfit: delta(t.grossProfit, prev.totals.grossProfit),
    grossMarginPct: round1(t.grossMarginPct - prev.totals.grossMarginPct),
  } : null

  // Marketing spend in the SAME window — CONTEXT ONLY (never deducted). Honest note when
  // it doesn't overlap (real spend data is Jan–Feb; sales/HPP are June).
  const mkt = await marketingSpendInWindow(tenantId, cur.period.start, cur.period.end)

  return {
    dummy: false, hasData: true,
    period: { start: iso(cur.period.start), end: iso(cur.period.end), full: cur.period.full },
    ...t, deltas,
    marketingSpendContext: {
      amount: mkt.amount, overlaps: mkt.rows > 0,
      note: mkt.rows > 0
        ? 'Marketing spend shown for context — NOT deducted (gross margin only).'
        : 'No real marketing-spend rows in this sales window (spend data is Jan–Feb; SKU sales are June — they do not overlap). NOT deducted regardless.',
    },
    scope: 'GROSS margin only (revenue − COGS). NOT net profit — opex/fees/tax/returns excluded (Wave 3).',
  }
}

/** Per-SKU revenue / HPP / gross profit / margin %, ranked by gross profit. */
export async function getMarginByProduct(tenantId, period) {
  const { hasData, items, period: win } = await loadMargin(tenantId, period)
  return { dummy: false, hasData, period: win ? { start: iso(win.start), end: iso(win.end) } : null, items }
}

/** Margin Pareto — products by gross-PROFIT contribution + cumulative % + 80% ref. */
export async function getMarginPareto(tenantId, period) {
  const { hasData, items } = await loadMargin(tenantId, period)
  const positive = items.filter(i => i.grossProfit > 0)
  const total = positive.reduce((a, i) => a + i.grossProfit, 0)
  const safe = total || 1
  let cum = 0, crossed = false
  const ranked = positive.map((it, i) => {
    cum += it.grossProfit
    const cumulativePct = round1((cum / safe) * 100)
    const inTop80 = !crossed
    if (cumulativePct >= 80) crossed = true
    return { rank: i + 1, sku: it.sku, name: it.name, grossProfit: it.grossProfit,
             sharePct: round1((it.grossProfit / safe) * 100), cumulativePct, inTop80, marginPct: it.marginPct }
  })
  return {
    dummy: false, hasData, totalGrossProfit: round2(total), ref80: round2(total * 0.8),
    count: ranked.length, top80Count: ranked.filter(r => r.inTop80).length,
    items: ranked, negativeCount: items.filter(i => i.grossProfit <= 0).length,
  }
}

/** Revenue / HPP / gross-profit / margin% over time (real dates; thin SKU history). */
export async function getMarginTrend(tenantId, period) {
  const win = await resolvePeriod(tenantId, period)
  if (!win) return { dummy: false, hasData: false, points: [] }

  const revByDate = await prisma.$queryRaw(Prisma.sql`
    SELECT o.order_date::date AS d, SUM(oi.subtotal) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.tenant_id = ${tenantId} AND o.order_date >= ${win.start} AND o.order_date <= ${win.end}
      AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)}) AND oi.sku IS NOT NULL
    GROUP BY 1 ORDER BY 1`)
  const hppByDate = await getDailyHppTotalsByDate(tenantId, { startDate: win.start, endDate: win.end })
  const hppMap = new Map(hppByDate.map(h => [iso(h.date), num(h.totalHpp)]))

  const points = revByDate.map(r => {
    const date = iso(r.d), revenue = round2(r.revenue), hpp = round2(hppMap.get(date) ?? 0)
    const grossProfit = round2(revenue - hpp)
    return { date, revenue, hpp, grossProfit, marginPct: revenue > 0 ? round1((grossProfit / revenue) * 100) : 0 }
  })
  return {
    dummy: false, hasData: points.length > 0, points,
    range: points.length ? { min: points[0].date, max: points[points.length - 1].date } : null,
    note: points.length < 3 ? `Only ${points.length} day(s) of SKU-level history — trend is shallow.` : null,
  }
}

/** Waterfall: Revenue → −HPP → Gross Profit. Marketing spend is a SEPARATE context line. */
export async function getMarginWaterfall(tenantId, period) {
  const ov = await getMarginOverview(tenantId, period)
  if (!ov.hasData) return { dummy: false, hasData: false, stages: [] }
  return {
    dummy: false, hasData: true, period: ov.period,
    stages: [
      { label: 'Revenue', value: ov.totalRevenue, type: 'total' },
      { label: 'COGS (HPP)', value: -ov.totalHpp, type: 'decrease' },
      { label: 'Gross Profit', value: ov.grossProfit, type: 'total' },
    ],
    grossMarginPct: ov.grossMarginPct, coveragePct: ov.coveragePct,
    marketingSpendContext: ov.marketingSpendContext,   // separate, NOT in the waterfall sum
    scope: ov.scope,
  }
}

/** One SKU: revenue/HPP/profit/margin + per-date history. */
export async function getProductMarginDetail(tenantId, sku, period) {
  const { hasData, items } = await loadMargin(tenantId, period)
  if (!hasData) return null
  const nsku = normalizeSku(sku)
  const it = items.find(i => i.sku === nsku)
  if (!it) return null
  const win = await resolvePeriod(tenantId, period)

  const revByDate = await prisma.$queryRaw(Prisma.sql`
    SELECT o.order_date::date AS d, SUM(oi.subtotal) AS revenue, SUM(oi.qty)::int AS qty
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.tenant_id = ${tenantId} AND o.order_date >= ${win.start} AND o.order_date <= ${win.end}
      AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)}) AND oi.sku = ${sku}
    GROUP BY 1 ORDER BY 1`)
  const hppRows = await getDailyHpp(tenantId, { startDate: win.start, endDate: win.end })
  const hppByDate = new Map()
  for (const h of hppRows) if (h.sku === nsku) hppByDate.set(iso(h.date), (hppByDate.get(iso(h.date)) ?? 0) + num(h.hpp))

  const history = revByDate.map(r => {
    const date = iso(r.d), revenue = round2(r.revenue), hpp = round2(hppByDate.get(date) ?? 0)
    return { date, revenue, hpp, grossProfit: round2(revenue - hpp), qty: num(r.qty) }
  })
  return {
    dummy: false, ...it,
    hasCostNote: it.hasCost ? null : 'No hargaCogs for this SKU — HPP counted as 0, so margin is overstated (100%).',
    history, historyAvailable: history.length > 0,
  }
}

/**
 * Profitability quadrant — units (x) × margin% (y), bubble = revenue.
 * NB: OVERLAPS the /sales profitability quadrant, but FINANCE-framed (margin% axis,
 * gross-profit basis). See docs/GROSS_MARGIN_DATA_SOURCES.md.
 */
export async function getMarginQuadrant(tenantId, period) {
  const { hasData, items } = await loadMargin(tenantId, period)
  const measured = items.filter(i => i.revenue > 0)
  const med = arr => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
  const medQty = med(measured.map(i => i.qty)), medMargin = med(measured.map(i => i.marginPct))
  const points = measured.map(i => ({
    sku: i.sku, name: i.name, x: i.qty, y: i.marginPct, revenue: i.revenue, grossProfit: i.grossProfit, hasCost: i.hasCost,
  }))
  return { dummy: false, hasData, points, medianQty: round2(medQty), medianMarginPct: round1(medMargin),
    axes: { xLabel: 'Units sold', yLabel: 'Gross margin %', sizeLabel: 'Revenue' } }
}
