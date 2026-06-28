// ─── Net P&L engine (Wave 3 §3.3 — the NP3 resolution: NEVER a fabricated net) ──
// Full waterfall: revenue → −COGS → −platform fee → −marketing → −tax → −opex → net.
// Each layer is EITHER real, OR a factual-default config the tenant overrides, OR (opex)
// EMPTY until the tenant enters it. While opex is empty the net is honestly "BEFORE opex"
// — never a guess (this is exactly why the old sales×0.78 formula was rejected / NP3 deferred).
//
// REUSE, don't re-derive: revenue + COGS from Gross-Margin (getMarginOverview /
// getDailyHppTotalsByDate), marketing from Ads-Allocation (getAllocationOverview). Config
// (TenantPnlConfig) supplies fee%/tax%/opex; factual defaults below when no row exists.
// Tenant-scoped; Decimal/BigInt → Number; EXCLUDED_STATUSES + raw-UTC bucketing (shared
// with HPP/Gross-Margin). See docs/PNL_DATA_SOURCES.md.
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { EXCLUDED_STATUSES, getDailyHppTotalsByDate } from '../hpp/compute-hpp'
import { getMarginOverview, getMarginTrend } from './gross-margin-summary'
import { getAllocationOverview } from './ads-allocation-summary'

const round2 = n => Math.round((Number(n) || 0) * 100) / 100
const num    = v => Number(v ?? 0)

// FACTUAL defaults (researched mid-2026 Indonesian marketplace admin fees + UMKM final tax).
// Used when a tenant has NO config row; flagged "default rate" until the tenant confirms/edits.
export const DEFAULT_CONFIG = {
  platformFeePct: { shopee: 8.0, tiktok: 8.0, tokopedia: 7.0, lazada: 6.0, default: 8.0 },
  taxPct: 0.5,
  opexCategories: [],
  marketingDeducted: true,
}

// ── FIELD_MANIFEST (Part B1) ──────────────────────────────────────────────────
export const FIELD_MANIFEST = [
  { key: 'revenue',       label: 'Revenue',       unit: 'IDR', dummy: false, source: 'REAL' },
  { key: 'cogs',          label: 'COGS (HPP)',    unit: 'IDR', dummy: false, source: 'REAL' },
  { key: 'marketing',     label: 'Marketing spend', unit: 'IDR', dummy: false, source: 'REAL' },
  { key: 'platformFee',   label: 'Platform fee',  unit: 'IDR', dummy: false, source: 'CONFIG-DERIVED' },
  { key: 'tax',           label: 'Tax',           unit: 'IDR', dummy: false, source: 'CONFIG-DERIVED' },
  { key: 'opex',          label: 'Opex',          unit: 'IDR', dummy: false, source: 'USER-ENTERED' },
  { key: 'netBeforeOpex', label: 'Net before opex', unit: 'IDR', dummy: false, source: 'REAL+CONFIG' },
]

// Load the tenant's config row, or the factual defaults. hasConfigRow=false → fee/tax are
// "default rate" (configDefault), opex empty.
export async function loadConfig(tenantId) {
  const row = await prisma.tenantPnlConfig.findUnique({ where: { tenantId } })
  if (!row) return { config: { ...DEFAULT_CONFIG }, hasConfigRow: false }
  return {
    hasConfigRow: true,
    config: {
      platformFeePct: row.platformFeePct ?? DEFAULT_CONFIG.platformFeePct,
      taxPct: row.taxPct ?? DEFAULT_CONFIG.taxPct,
      opexCategories: Array.isArray(row.opexCategories) ? row.opexCategories : [],
      marketingDeducted: row.marketingDeducted ?? true,
    },
  }
}

// Real revenue per platform (same basis as Gross-Margin revenue) — for per-platform fees.
async function revenueByPlatform(tenantId, start, end) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT COALESCE(o.platform, 'unknown') AS platform, COALESCE(SUM(oi.subtotal), 0) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.tenant_id = ${tenantId} AND o.order_date >= ${start} AND o.order_date <= ${end}
      AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)}) AND oi.sku IS NOT NULL
    GROUP BY 1`)
  return rows.map(r => ({ platform: r.platform, revenue: round2(r.revenue) }))
}

const feePctFor = (platform, map) => num(map[String(platform).toLowerCase()] ?? map.default ?? 0)

// Build the running-total waterfall stages (floating [base, top] bars for the chart).
function buildStages(L, opexEntered) {
  const stages = []
  let run = 0
  stages.push({ label: 'Revenue', value: L.revenue, base: 0, top: L.revenue, kind: 'total', flag: 'real' }); run = L.revenue
  const dec = (label, amount, flag) => { const base = round2(run - amount); stages.push({ label, value: -amount, base: Math.min(base, run), top: Math.max(base, run), kind: 'decrease', flag }); run = base }
  dec('− COGS', L.cogs, 'real')
  dec('− Platform fee', L.platformFee, L.configFlag)
  if (L.marketingDeducted) dec('− Marketing', L.marketing, 'real')
  dec('− Tax', L.tax, L.configFlag)
  dec('− Opex', L.opex, opexEntered ? 'entered' : 'notEntered')
  const net = round2(run)
  stages.push({ label: opexEntered ? 'Net Profit' : 'Net before Opex', value: net, base: Math.min(0, net), top: Math.max(0, net), kind: 'total', flag: opexEntered ? 'net' : 'netBeforeOpex' })
  return { stages, net }
}

/**
 * The Net-P&L waterfall. Real layers plain; config layers flagged default-vs-configured;
 * opex empty → net is "before opex" (NEVER a fabricated final net).
 */
export async function getPnlWaterfall(tenantId, period) {
  const { config, hasConfigRow } = await loadConfig(tenantId)
  const ov = await getMarginOverview(tenantId, period)            // REAL revenue + window
  if (!ov.hasData) {
    return { hasData: false, configDefault: !hasConfigRow, config,
      note: ov.note || 'No SKU-level revenue for this tenant — Net P&L needs OrderItem + HPP (Cleora / tenant 2 in dev).' }
  }
  const start = new Date(ov.period.start), end = new Date(ov.period.end)

  // REAL layers
  const revenue = round2(ov.totalRevenue)
  const hppByDate = await getDailyHppTotalsByDate(tenantId, { startDate: start, endDate: end })
  const cogs = round2(hppByDate.reduce((a, h) => a + num(h.totalHpp), 0))
  const alloc = await getAllocationOverview(tenantId, period)     // REAL marketing total (== Ads-Allocation)
  const marketing = round2(alloc.totalSpend)

  // CONFIG-derived layers (factual defaults until edited)
  const byPlatform = await revenueByPlatform(tenantId, start, end)
  const feeBreakdown = byPlatform.map(p => ({ platform: p.platform, revenue: p.revenue, pct: feePctFor(p.platform, config.platformFeePct), fee: round2(p.revenue * feePctFor(p.platform, config.platformFeePct) / 100) }))
  const platformFee = round2(feeBreakdown.reduce((a, p) => a + p.fee, 0))
  const tax = round2(revenue * num(config.taxPct) / 100)          // UMKM final tax on GROSS revenue

  // USER-ENTERED opex (EMPTY → 0, gated)
  const opexEntered = (config.opexCategories?.length ?? 0) > 0
  const opexBreakdown = (config.opexCategories ?? []).map(c => ({
    label: c.label, amount: c.amount != null ? round2(c.amount) : round2(revenue * num(c.pct) / 100), pct: c.pct ?? null,
  }))
  const opex = round2(opexBreakdown.reduce((a, c) => a + c.amount, 0))

  const configFlag = hasConfigRow ? 'configured' : 'configDefault'
  const { stages, net } = buildStages(
    { revenue, cogs, platformFee, marketing, tax, opex, marketingDeducted: config.marketingDeducted, configFlag },
    opexEntered,
  )
  const netBeforeOpex = opexEntered ? round2(net + opex) : net

  return {
    hasData: true,
    period: ov.period,
    configDefault: !hasConfigRow,
    configComplete: opexEntered,
    opexEntered,
    marketingDeducted: config.marketingDeducted,
    // Layers (each flagged real / config / user-entered):
    layers: {
      revenue:     { value: revenue, real: true },
      cogs:        { value: cogs, real: true },
      platformFee: { value: platformFee, configDefault: !hasConfigRow, configured: hasConfigRow, breakdown: feeBreakdown },
      marketing:   { value: marketing, real: true, deducted: config.marketingDeducted, caveat: alloc.dateRange?.note ? 'Real marketing total deducted; spend window may not overlap the sales window (dev data).' : null },
      tax:         { value: tax, pct: config.taxPct, base: 'gross revenue', configDefault: !hasConfigRow, configured: hasConfigRow },
      opex:        { value: opex, entered: opexEntered, breakdown: opexBreakdown },
    },
    stages,
    netBeforeOpex,
    net: opexEntered ? net : null,                  // ← NO final net until opex is entered
    config,
    note: opexEntered
      ? 'Net is final: real revenue/COGS/marketing − config fee/tax − your opex.'
      : 'Net is shown BEFORE opex — opex has not been entered. We do NOT fabricate a net; enter opex in Settings → P&L Rules to see true net.',
    aiNote: 'Real layers: revenue, COGS, marketing. Config layers (factual defaults until edited): platform fee, tax. Opex is user-entered and currently ' + (opexEntered ? 'set' : 'EMPTY — net is gated "before opex", not final/fabricated.'),
  }
}

/** Net-margin trend over time (per-date revenue − COGS − config fee − tax → net before opex).
 * Marketing + opex are period-level (not date-mapped here) — excluded from the per-date line, noted. */
export async function getPnlTrend(tenantId, period) {
  const { config } = await loadConfig(tenantId)
  const t = await getMarginTrend(tenantId, period)
  const blendedFeePct = num(config.platformFeePct.default)
  const points = (t.points ?? []).map(p => {
    const revenue = round2(p.revenue), cogs = round2(p.hpp)
    const fee = round2(revenue * blendedFeePct / 100)
    const tax = round2(revenue * num(config.taxPct) / 100)
    return { date: p.date, revenue, cogs, fee, tax, netBeforeOpex: round2(revenue - cogs - fee - tax) }
  })
  return {
    hasData: points.length > 0, points, range: t.range,
    note: 'Per-date net BEFORE opex (revenue − COGS − config fee − tax). Marketing & opex are period-level and excluded from this per-date line.',
  }
}
