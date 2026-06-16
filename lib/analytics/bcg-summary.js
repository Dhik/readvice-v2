// ─── BCG Product Matrix engine — replica of the old app's bcg_metrics ────────
// Reads BcgProduct snapshots and classifies SKUs into the two BCG quadrant maps:
//   • Traffic × Conversion  (Stars / Cash Cows / Question Marks / Dogs)
//   • CTR × Conversion      (Star / Potensi / Cash Cows / Dog)
// plus per-SKU metrics, a 0–100 performance score, and recommendations.
//
// CRITICAL HONESTY: both axes' raw inputs (visitor, ctr) are DUMMY in dev (see
// docs/BCG_DATA_SOURCES.md), so the quadrant a SKU lands in is FICTIONAL until a
// real bcg_sync connector replaces the dummy rows. Only sales/qty/harga/stock are real.
//
// Tenant scoping: EVERY read filters tenantId (fixes the old app's inconsistent
// scoping). Decimal/BigInt → Number at the boundary. New tenant = empty, no error.
import { prisma } from '../prisma'

const round1 = n => Math.round(n * 10) / 10
const round2 = n => Math.round(n * 100) / 100
const num    = v => Number(v ?? 0)

// ── FIELD_MANIFEST (Part B1) — numeric params for calculated fields ───────────
// `dummy` reflects this module's honesty determination. FINDING: the BCG engine
// carries only a COARSE row-level flag (`dummy = source === 'DUMMY'`, whole row) —
// it has NO per-field flags. The per-field real/dummy split below is sourced from
// docs/BCG_DATA_SOURCES.md (sales/qty/harga/stock real; visitor/ctr/atc/ads/omset
// dummy axes; ratios that consume a dummy input are dummy-derived). Not invented —
// taken from the documented split, since the engine itself can't distinguish them.
export const FIELD_MANIFEST = [
  { key: 'sales',         label: 'Sales (omzet)',       unit: 'IDR',   dummy: false, source: 'REAL' },
  { key: 'qty',           label: 'Qty sold',            unit: 'count', dummy: false, source: 'REAL' },
  { key: 'stock',         label: 'Stock on hand',       unit: 'count', dummy: false, source: 'REAL' },
  { key: 'harga',         label: 'Price',               unit: 'IDR',   dummy: false, source: 'REAL' },
  { key: 'visitor',       label: 'Visitors',            unit: 'count', dummy: true,  source: 'DUMMY' },
  { key: 'buyers',        label: 'Buyers',              unit: 'count', dummy: true,  source: 'DUMMY' },
  { key: 'atc',           label: 'Add-to-cart',         unit: 'count', dummy: true,  source: 'DUMMY' },
  { key: 'ads',           label: 'Ad spend',            unit: 'IDR',   dummy: true,  source: 'DUMMY' },
  { key: 'omset',         label: 'Ads revenue (omset)', unit: 'IDR',   dummy: true,  source: 'DUMMY' },
  { key: 'ctr',           label: 'CTR',                 unit: '%',     dummy: true,  source: 'DUMMY' },
  { key: 'conversion',    label: 'Conversion rate',     unit: '%',     dummy: true,  source: 'DUMMY-DERIVED' },
  { key: 'roas',          label: 'ROAS',                unit: 'x',     dummy: true,  source: 'DUMMY-DERIVED' },
  { key: 'stockTurnover', label: 'Stock turnover',      unit: 'x',     dummy: false, source: 'REAL-DERIVED' }, // qty÷stock, both real
  { key: 'score',         label: 'Performance score',   unit: '0–100', dummy: true,  source: 'DUMMY-DERIVED' },
]

// First-of-month (UTC) for a YYYY-MM(-DD) string or Date. BcgProduct.date is
// always a 1st-of-month @db.Date.
function monthDate(date) {
  if (!date) return null
  const d = new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

// Benchmark conversion (%) by price band — doc §2.1. Cheaper items must convert
// harder to be "high conversion".
export function benchmarkConversion(harga) {
  const h = num(harga)
  if (h < 75000)  return 2.0
  if (h < 100000) return 1.5
  if (h < 125000) return 1.0
  if (h < 150000) return 0.8
  return 0.6
}

function median(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ── Per-SKU derived metrics from one grouped BcgProduct row ───────────────────
function deriveMetrics(g) {
  const visitor   = num(g.visitor)
  const buyers    = num(g.jumlahPembeli)
  const atc       = num(g.jumlahAtc)
  const qty       = num(g.qtySold)
  const sales     = num(g.sales)
  const stock     = num(g.stock)
  const ads       = num(g.biayaAds)
  const omset     = num(g.omsetPenjualan)
  const harga     = num(g.harga)
  const ctr       = num(g.ctr)

  const conversion        = visitor > 0 ? round2((buyers / visitor) * 100) : 0  // %
  const atcRate           = visitor > 0 ? round2((atc / visitor) * 100) : 0      // %
  const purchaseRate      = atc > 0 ? round2((buyers / atc) * 100) : 0           // %
  const roas              = ads > 0 ? round2(omset / ads) : 0
  const revenuePerVisitor = visitor > 0 ? round2(sales / visitor) : 0
  const stockTurnover     = stock > 0 ? round2(qty / stock) : 0
  const benchmark         = benchmarkConversion(harga)

  return {
    sku: g.sku, namaProduk: g.namaProduk, kodeProduk: g.kodeProduk,
    visitor, buyers, atc, qty, sales, stock, ads, omset, harga, ctr,
    conversion, atcRate, purchaseRate, roas, revenuePerVisitor, stockTurnover, benchmark,
  }
}

// ── Performance score 0–100 — doc §2.3 ────────────────────────────────────────
// Weighted blend of conversion-vs-benchmark, ROAS, stock turnover, CTR. Capped 0–100.
function performanceScore(m) {
  const convScore  = m.benchmark > 0 ? Math.min(m.conversion / m.benchmark, 2) / 2 : 0 // 0..1 (cap 2× bench)
  const roasScore  = Math.min(m.roas / 4, 1)                                            // 0..1 (cap 4×)
  const turnScore  = Math.min(m.stockTurnover, 1)                                       // 0..1 (cap 1×)
  const ctrScore   = Math.min(m.ctr / 3, 1)                                             // 0..1 (cap 3%)
  const score = convScore * 40 + roasScore * 30 + turnScore * 20 + ctrScore * 10
  return Math.max(0, Math.min(100, Math.round(score)))
}

// ── Quadrant classifiers ──────────────────────────────────────────────────────
// Traffic × Conversion: highTraffic = visitor ≥ median(visitor); highConv = conversion ≥ benchmark.
function trafficConversionQuadrant(m, visitorMedian) {
  const highTraffic = m.visitor >= visitorMedian
  const highConv    = m.conversion >= m.benchmark
  if (highTraffic && highConv)   return 'Star'          // high traffic + high conv
  if (!highTraffic && highConv)  return 'Cash Cow'      // low traffic + high conv
  if (highTraffic && !highConv)  return 'Question Mark'  // high traffic + low conv
  return 'Dog'                                           // low traffic + low conv
}

// CTR × Conversion: ctr > 1% × conversion > 1% — doc fixed thresholds.
function ctrConversionQuadrant(m) {
  const highCtr  = m.ctr > 1
  const highConv = m.conversion > 1
  if (highCtr && highConv)   return 'Star'       // ad pulls + converts
  if (highCtr && !highConv)  return 'Potensi'    // pulls clicks, weak convert
  if (!highCtr && highConv)  return 'Cash Cow'   // converts despite low CTR
  return 'Dog'
}

// ── Core loader: tenant + month → enriched, classified SKU list ───────────────
// Single source of truth other functions build on. Tenant-scoped read; the month
// defaults to the tenant's latest BcgProduct month when not given.
async function loadMonth(tenantId, date) {
  let when = monthDate(date)
  if (!when) {
    const latest = await prisma.bcgProduct.findFirst({
      where: { tenantId }, orderBy: { date: 'desc' }, select: { date: true },
    })
    when = latest ? monthDate(latest.date) : null
  }
  if (!when) return { month: null, items: [], visitorMedian: 0, source: null }

  const rows = await prisma.bcgProduct.findMany({
    where: { tenantId, date: when },
    orderBy: { sales: 'desc' },
  })
  if (!rows.length) return { month: when, items: [], visitorMedian: 0, source: null }

  const visitorMedian = median(rows.map(r => num(r.visitor)))
  const items = rows.map(r => {
    const m = deriveMetrics(r)
    m.score          = performanceScore(m)
    m.quadrant       = trafficConversionQuadrant(m, visitorMedian)
    m.ctrQuadrant    = ctrConversionQuadrant(m)
    m.dummy          = r.source === 'DUMMY'   // positions fictional when true
    return m
  })
  // Row source is uniform per seed/connector; surface it for the "fictional" badge.
  const source = rows[0].source
  return { month: when, items, visitorMedian, source }
}

const iso = d => (d ? d.toISOString().slice(0, 10) : null)

/**
 * Bubble-chart points for the Traffic × Conversion matrix.
 * x = visitor, y = conversion(%), r ∝ sales. Includes axis dividers (medians/benchmark).
 */
export async function getBcgChartData(tenantId, date) {
  const { month, items, visitorMedian, source } = await loadMonth(tenantId, date)
  const points = items.map(m => ({
    sku: m.sku, name: m.namaProduk, x: m.visitor, y: m.conversion, sales: m.sales,
    quadrant: m.quadrant, benchmark: m.benchmark, score: m.score,
  }))
  return {
    month: iso(month),
    dummy: source === 'DUMMY',
    visitorMedian,
    points,
    axes: { xLabel: 'Visitor', yLabel: 'Conversion %', xDivider: visitorMedian, yDividerNote: 'per-SKU benchmark' },
  }
}

/**
 * Bubble points for the CTR × Conversion matrix. x = ctr(%), y = conversion(%),
 * fixed 1%×1% dividers. r ∝ sales.
 */
export async function getCtrChartData(tenantId, date) {
  const { month, items, source } = await loadMonth(tenantId, date)
  const points = items.map(m => ({
    sku: m.sku, name: m.namaProduk, x: m.ctr, y: m.conversion, sales: m.sales,
    quadrant: m.ctrQuadrant, score: m.score,
  }))
  return {
    month: iso(month),
    dummy: source === 'DUMMY',
    points,
    axes: { xLabel: 'CTR %', yLabel: 'Conversion %', xDivider: 1, yDivider: 1 },
  }
}

/** Quadrant counts + share for both matrices. */
export async function getQuadrantSummary(tenantId, date) {
  const { month, items, source } = await loadMonth(tenantId, date)
  const tally = (key, buckets) => {
    const c = Object.fromEntries(buckets.map(b => [b, 0]))
    for (const m of items) c[m[key]] = (c[m[key]] ?? 0) + 1
    return c
  }
  return {
    month: iso(month),
    dummy: source === 'DUMMY',
    total: items.length,
    traffic: tally('quadrant',    ['Star', 'Cash Cow', 'Question Mark', 'Dog']),
    ctr:     tally('ctrQuadrant', ['Star', 'Potensi', 'Cash Cow', 'Dog']),
  }
}

/** Full per-SKU detail (all derived metrics + both quadrant labels). */
export async function getProductDetail(tenantId, sku, date) {
  const { month, items, source } = await loadMonth(tenantId, date)
  const m = items.find(x => x.sku === sku)
  if (!m) return null
  return { month: iso(month), dummy: source === 'DUMMY', ...m }
}

// Recommendation text per Traffic×Conversion quadrant — doc §3.
const REC_TRAFFIC = {
  'Star':          { headline: 'Scale & protect', action: 'High traffic + strong conversion. Increase ad budget, guard stock, defend ranking.' },
  'Cash Cow':      { headline: 'Drive more traffic', action: 'Converts well but under-trafficked. Push ads/SEO — conversion is proven.' },
  'Question Mark': { headline: 'Fix conversion', action: 'Traffic is there, conversion lags benchmark. Improve listing, price, reviews, photos.' },
  'Dog':           { headline: 'Review or retire', action: 'Low traffic + low conversion. Reposition, bundle, or discontinue.' },
}
const REC_CTR = {
  'Star':     { headline: 'Best ad efficiency', action: 'Ad attracts AND converts. Scale spend; replicate creative.' },
  'Potensi':  { headline: 'Convert the clicks', action: 'High CTR, weak conversion — the ad oversells the page. Align listing to ad promise.' },
  'Cash Cow': { headline: 'Lift the CTR', action: 'Converts despite low CTR. Better creative/targeting would unlock volume.' },
  'Dog':      { headline: 'Rework the ad', action: 'Low CTR + low conversion. Re-evaluate creative, targeting, and the offer.' },
}

/** Per-SKU recommendations for the Traffic×Conversion matrix. */
export async function getRecommendations(tenantId, date) {
  const { month, items, source } = await loadMonth(tenantId, date)
  return {
    month: iso(month),
    dummy: source === 'DUMMY',
    items: items.map(m => ({
      sku: m.sku, name: m.namaProduk, quadrant: m.quadrant, score: m.score,
      conversion: m.conversion, benchmark: m.benchmark, visitor: m.visitor, sales: m.sales,
      ...REC_TRAFFIC[m.quadrant],
    })),
  }
}

/** Per-SKU recommendations for the CTR×Conversion matrix. */
export async function getCtrRecommendations(tenantId, date) {
  const { month, items, source } = await loadMonth(tenantId, date)
  return {
    month: iso(month),
    dummy: source === 'DUMMY',
    items: items.map(m => ({
      sku: m.sku, name: m.namaProduk, quadrant: m.ctrQuadrant, score: m.score,
      ctr: m.ctr, conversion: m.conversion, sales: m.sales,
      ...(REC_CTR[m.ctrQuadrant] ?? REC_CTR.Dog),
    })),
  }
}

/** Overview KPIs for the month — totals + averages across grouped SKUs. */
export async function getOverviewKpis(tenantId, date) {
  const { month, items, source } = await loadMonth(tenantId, date)
  if (!items.length) {
    return { month: iso(month), dummy: source === 'DUMMY', productCount: 0,
      totalSales: 0, totalQty: 0, totalVisitor: 0, totalAds: 0, totalOmset: 0,
      avgConversion: 0, avgCtr: 0, avgRoas: 0, avgScore: 0, stars: 0 }
  }
  const sum = (f) => items.reduce((a, m) => a + m[f], 0)
  const avg = (f) => round2(sum(f) / items.length)
  return {
    month: iso(month),
    dummy: source === 'DUMMY',
    productCount:  items.length,
    totalSales:    sum('sales'),
    totalQty:      sum('qty'),
    totalVisitor:  sum('visitor'),
    totalAds:      sum('ads'),
    totalOmset:    sum('omset'),
    avgConversion: avg('conversion'),
    avgCtr:        avg('ctr'),
    avgRoas:       avg('roas'),
    avgScore:      Math.round(avg('score')),
    stars:         items.filter(m => m.quadrant === 'Star').length,
  }
}

/**
 * Advanced filter/sort over the month's SKUs. Tenant-scoped via loadMonth.
 * @param {object} opts { quadrant, ctrQuadrant, minSales, minConversion, minScore, search, sortBy, sortDir, limit }
 */
export async function advancedFilter(tenantId, date, opts = {}) {
  const { month, items, source } = await loadMonth(tenantId, date)
  const {
    quadrant, ctrQuadrant, minSales = 0, minConversion = 0, minScore = 0,
    search, sortBy = 'sales', sortDir = 'desc', limit,
  } = opts

  let out = items.filter(m =>
    (!quadrant    || m.quadrant === quadrant) &&
    (!ctrQuadrant || m.ctrQuadrant === ctrQuadrant) &&
    m.sales >= num(minSales) &&
    m.conversion >= num(minConversion) &&
    m.score >= num(minScore) &&
    (!search || `${m.sku} ${m.namaProduk}`.toLowerCase().includes(String(search).toLowerCase()))
  )

  const dir = sortDir === 'asc' ? 1 : -1
  out.sort((a, b) => ((a[sortBy] ?? 0) > (b[sortBy] ?? 0) ? 1 : (a[sortBy] ?? 0) < (b[sortBy] ?? 0) ? -1 : 0) * dir)
  if (limit) out = out.slice(0, Number(limit))

  return { month: iso(month), dummy: source === 'DUMMY', count: out.length, items: out }
}

/** Distinct BcgProduct months available for the tenant (newest first). */
export async function getAvailableMonths(tenantId) {
  const rows = await prisma.bcgProduct.findMany({
    where: { tenantId }, distinct: ['date'], orderBy: { date: 'desc' }, select: { date: true, source: true },
  })
  return rows.map(r => ({ month: iso(r.date), dummy: r.source === 'DUMMY' }))
}
