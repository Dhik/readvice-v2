// ─── True ROAS / Attribution engine (Wave 3 §3.2 — MIXED real spend ÷ dummy return) ──
// Ad/marketing SPEND is REAL (the exact Ads-Allocation tables — AdSpentSocialMedia +
// Marketing). Attributed REVENUE is DUMMY: there is NO order-level attribution link
// (Order has no campaign/ads/utm/source column, P-1 — unbackfillable today), so the
// spend→revenue link is FABRICATED from a stated assumption and flagged. ROAS = dummy
// attributed-revenue ÷ real spend → therefore DUMMY (dummy-derived). This is the
// Talent-ROI shape (real÷dummy): consistent slate=REAL / orange=DUMMY split, explicit
// spendReal/attributionDummy flags on every response, real and dummy never blended.
//
// REUSE, don't re-derive: the real spend comes straight from ads-allocation-summary
// (getSpendShare / getAllocationOverview / getSpendTrend / *Detail) — single source of
// truth for the real number. Tenant-scoped; Decimal/BigInt → Number; on-the-fly (no
// snapshot, no new model). See docs/ROAS_DATA_SOURCES.md.
import {
  getAllocationOverview, getSpendShare, getSpendTrend, getChannelDetail, getCategoryDetail,
} from './ads-allocation-summary'

const round2 = n => Math.round((Number(n) || 0) * 100) / 100

// ── DUMMY attribution basis (stated assumption — NOT a real spend→order link) ──
// Per-source assumed ROAS in 1.5×–4.5×, deterministic from the source key (stable across
// requests, looks data-like, but is fabricated). attributedRevenue = spend × assumedRoas.
const ASSUMED_ROAS_MIN = 1.5
const ASSUMED_ROAS_SPAN = 3.0   // → 1.5–4.5×
const ASSUMED_BLENDED_ROAS = 2.5   // used for the dummy revenue TREND line
const ATTRIBUTION_BASIS =
  'Attributed revenue is FABRICATED as spend × an assumed per-channel ROAS (1.5–4.5×, a deterministic placeholder). ' +
  'There is NO real spend→order attribution link (Order has no campaign/ads/utm/source column — Plumbing P-1). ' +
  'ROAS here is dummy-derived; SPEND is real. Becomes real only when an attribution column is added to Order and captured at sync.'

function hashKey(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h }
function assumedRoas(key) { return round2(ASSUMED_ROAS_MIN + (hashKey(key) % 31) / 30 * ASSUMED_ROAS_SPAN) }

const median = arr => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

// Explicit flags spread into every response (Talent-ROI pattern).
const FLAGS = { spendReal: true, attributionDummy: true }

// ── FIELD_MANIFEST (Part B1) ──────────────────────────────────────────────────
// spend / share are REAL (from the real Ads-Allocation tables). attributedRevenue + roas
// are DUMMY — fabricated attribution over real spend.
export const FIELD_MANIFEST = [
  { key: 'spend',             label: 'Ad spend',          unit: 'IDR',   dummy: false, source: 'REAL' },
  { key: 'sharePct',          label: 'Share of spend',    unit: '%',     dummy: false, source: 'REAL-DERIVED' },
  { key: 'attributedRevenue', label: 'Attributed revenue', unit: 'IDR',  dummy: true,  source: 'DUMMY' },
  { key: 'roas',              label: 'ROAS',              unit: 'x',     dummy: true,  source: 'DUMMY-DERIVED' },
]

// ── Core loader: REAL per-source spend ⋈ DUMMY attributed revenue ─────────────
// Reuses Ads-Allocation's getSpendShare for the real per-channel/category spend; layers
// the fabricated attribution on top. `source` tags social channels vs marketing categories.
async function loadSources(tenantId, period) {
  const share = await getSpendShare(tenantId, period)   // REAL spend, single source of truth
  const mk = (s, source) => {
    const spend = round2(s.spend)
    const roas = assumedRoas(s.key)                      // DUMMY
    const attributedRevenue = round2(spend * roas)       // DUMMY
    return { key: s.key, source, spend, rows: s.rows, sharePct: round2(s.sharePct), attributedRevenue, roas }
  }
  const sources = [
    ...(share.channels ?? []).map(s => mk(s, 'channel')),
    ...(share.categories ?? []).map(s => mk(s, 'category')),
  ]
  return { sources, socialTotal: round2(share.socialTotal), marketingTotal: round2(share.marketingTotal) }
}

/** Overview: REAL total spend + a clearly-flagged DUMMY attributed-revenue / blended ROAS. */
export async function getRoasOverview(tenantId, period) {
  const alloc = await getAllocationOverview(tenantId, period)   // REAL totals (the Ads-Allocation number)
  const { sources, socialTotal, marketingTotal } = await loadSources(tenantId, period)
  if (!sources.length) {
    return { ...FLAGS, hasData: false, totalSpend: 0, note: 'No ad/marketing spend for this tenant — ROAS needs AdSpentSocialMedia / Marketing rows (Cleora / tenant 2 in dev).' }
  }
  const totalSpend = round2(alloc.totalSpend)                   // REAL — equals Ads-Allocation's total
  const totalAttributedRevenue = round2(sources.reduce((a, s) => a + s.attributedRevenue, 0))   // DUMMY
  return {
    ...FLAGS, hasData: true,
    // REAL block:
    totalSpend, socialTotal, marketingTotal,
    sourceCount: sources.length, channelCount: alloc.channelCount, categoryCount: alloc.categoryCount,
    dateRange: alloc.dateRange,
    // DUMMY block (separate — never blended with the real total):
    attribution: {
      dummy: true,
      totalAttributedRevenue,
      blendedRoas: totalSpend > 0 ? round2(totalAttributedRevenue / totalSpend) : null,
      assumption: ATTRIBUTION_BASIS,
    },
    note: 'SPEND is real (same tables as Ads-Allocation). Attributed revenue + ROAS are DUMMY — no order-level attribution link exists yet (P-1).',
  }
}

// Quadrant classify: real spend (x) × DUMMY ROAS (efficiency). Names mirror the ad lens.
const QUAD = { Scale: 'Scale (high spend · high ROAS*)', Efficient: 'Efficient (low spend · high ROAS*)', Review: 'Review (high spend · low ROAS*)', Low: 'Low (low spend · low ROAS*)' }
function classify(s, medSpend, medRoas) {
  const hiSpend = s.spend >= medSpend, hiRoas = (s.roas ?? 0) >= medRoas
  return hiRoas ? (hiSpend ? 'Scale' : 'Efficient') : (hiSpend ? 'Review' : 'Low')
}

/** Scatter/quadrant: x = spend (REAL), y = attributed revenue (DUMMY), bubble ∝ spend, colored by quadrant. */
export async function getRoasScatter(tenantId, period) {
  const { sources } = await loadSources(tenantId, period)
  const medSpend = round2(median(sources.map(s => s.spend)))
  const medRoas = round2(median(sources.map(s => s.roas).filter(r => r != null)))
  const points = sources.map(s => ({
    key: s.key, source: s.source, sharePct: s.sharePct,
    x: s.spend, y: s.attributedRevenue, roas: s.roas, spend: s.spend, attributedRevenue: s.attributedRevenue, quadrant: classify(s, medSpend, medRoas),
  }))
  const counts = { Scale: 0, Efficient: 0, Review: 0, Low: 0 }
  for (const p of points) counts[p.quadrant]++
  return {
    ...FLAGS, hasData: points.length > 0, points, counts,
    medianSpend: medSpend, medianRoas: medRoas, labels: QUAD,
    axes: { xLabel: 'Ad spend (REAL)', yLabel: '⚠ Attributed revenue (DUMMY — fabricated)', sizeLabel: 'Spend' },
  }
}

/** Trend: REAL spend over time + a DUMMY attributed-revenue line (spend × assumed blended ROAS). */
export async function getRoasTrend(tenantId, period) {
  const trend = await getSpendTrend(tenantId, { dimension: 'total', granularity: 'day', period })   // REAL spend
  const points = (trend.points ?? []).map(p => ({
    period: p.period,
    spend: round2(p.spend),                                        // REAL
    attributedRevenue: round2(p.spend * ASSUMED_BLENDED_ROAS),     // DUMMY
  }))
  return {
    ...FLAGS, hasData: points.length > 0, points, range: trend.range, empty: trend.empty,
    assumedBlendedRoas: ASSUMED_BLENDED_ROAS,
    note: 'Spend line is real; the attributed-revenue line is dummy (spend × assumed blended ROAS).',
  }
}

/** Per-source detail: REAL spend (+ daily trend, share) vs DUMMY attribution — separated. */
export async function getRoasDetail(tenantId, key, source, period) {
  const real = source === 'category'
    ? await getCategoryDetail(tenantId, key, period)
    : await getChannelDetail(tenantId, key, period)
  if (!real) return null
  const roas = assumedRoas(key)
  const attributedRevenue = round2(round2(real.spend) * roas)
  return {
    ...FLAGS, key, source,
    real: {                                            // slate — REAL spend
      spend: round2(real.spend), rows: real.rows, sharePct: round2(real.sharePct),
      trend: real.trend, days: real.days, range: real.range,
      ...(real.subCategories ? { subCategories: real.subCategories } : {}),
    },
    dummyAttribution: {                                // orange — DUMMY
      dummy: true, attributedRevenue, roas, assumption: ATTRIBUTION_BASIS,
    },
  }
}
