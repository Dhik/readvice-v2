// ─── Ads Spend-Allocation engine (Wave 1 — 100% REAL, zero dummy) ────────────
// Analyzes HOW marketing/ad spend is ALLOCATED — Pareto, trend, share, MoM —
// across two REAL expense sources:
//   • AdSpentSocialMedia  → "channels" (platform: Snack Video / Google / Instagram / TikTok / Facebook)
//   • Marketing           → "categories" (marketing_category: KOL Beauty / Media Online / …)
//
// CRITICAL HONESTY (see docs/ADS_ALLOCATION_DATA_SOURCES.md): both sources are
// EXPENSE-ONLY. There is **no revenue link**, so this engine emits **NO ROAS / no
// efficiency-vs-sales** — that needs attribution (Wave 3 / data-plumbing). Every
// response carries `dummy: false` (all figures are real). The real date range is
// thin (Jan 31 – Feb 27, with Jan being a single day) — surfaced honestly; trend
// beyond it is empty, never fabricated.
//
// Tenant scoping: EVERY read filters tenantId. Decimal → Number at the boundary.
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'

const round2 = n => Math.round((Number(n) || 0) * 100) / 100
const num    = v => Number(v ?? 0)
const iso    = d => (d ? new Date(d).toISOString().slice(0, 10) : null)
const GRANS  = new Set(['day', 'week', 'month'])

// Optional period → Prisma date filter. period = { start, end } | { month: 'YYYY-MM' }.
function dateWhere(period) {
  if (!period) return {}
  const f = {}
  if (period.month) {
    const [y, m] = String(period.month).split('-').map(Number)
    f.gte = new Date(Date.UTC(y, m - 1, 1)); f.lt = new Date(Date.UTC(y, m, 1))
  } else {
    if (period.start) f.gte = new Date(period.start)
    if (period.end)   f.lte = new Date(period.end)
  }
  return Object.keys(f).length ? { date: f } : {}
}
// Raw-SQL bounds (nullable) for date_trunc queries.
function bounds(period) {
  if (!period) return { start: null, end: null }
  if (period.month) {
    const [y, m] = String(period.month).split('-').map(Number)
    return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1) - 1) }
  }
  return { start: period.start ? new Date(period.start) : null, end: period.end ? new Date(period.end) : null }
}

// ── Shared aggregates (tenant-scoped) ─────────────────────────────────────────
async function channelSpend(tenantId, period) {
  const g = await prisma.adSpentSocialMedia.groupBy({
    by: ['platform'], where: { tenantId, ...dateWhere(period) }, _sum: { amount: true }, _count: true,
  })
  return g.map(r => ({ key: r.platform, spend: round2(r._sum.amount), rows: r._count }))
        .sort((a, b) => b.spend - a.spend)
}
async function categorySpend(tenantId, period) {
  const g = await prisma.marketing.groupBy({
    by: ['marketingCategory'], where: { tenantId, ...dateWhere(period) }, _sum: { amount: true }, _count: true,
  })
  return g.map(r => ({ key: r.marketingCategory, spend: round2(r._sum.amount), rows: r._count }))
        .sort((a, b) => b.spend - a.spend)
}

// Pareto builder: rank desc, running cumulative %, mark the "vital few" reaching 80%.
function buildPareto(items, label) {
  const total = items.reduce((a, i) => a + i.spend, 0)
  const safeTotal = total || 1
  let cum = 0, crossed = false
  const ranked = items.map((it, i) => {
    cum += it.spend
    const cumulativePct = round2((cum / safeTotal) * 100)
    const inTop80 = !crossed
    if (cumulativePct >= 80) crossed = true
    return { rank: i + 1, key: it.key, spend: it.spend, rows: it.rows,
             sharePct: round2((it.spend / safeTotal) * 100), cumulative: round2(cum), cumulativePct, inTop80 }
  })
  return {
    dummy: false, dimension: label, total: round2(total), ref80: round2(total * 0.8),
    count: ranked.length, top80Count: ranked.filter(r => r.inTop80).length, items: ranked,
  }
}

/** Real date range + month coverage for both sources (honest "how thin is this"). */
export async function getDateRange(tenantId) {
  const one = async (table) => {
    const r = await prisma.$queryRaw(Prisma.sql`
      SELECT MIN(date)::date AS dmin, MAX(date)::date AS dmax,
             COUNT(*)::int AS rows, COUNT(DISTINCT date::date)::int AS days,
             COUNT(DISTINCT to_char(date, 'YYYY-MM'))::int AS months
      FROM ${Prisma.raw(table)} WHERE tenant_id = ${tenantId}`)
    const x = r[0] || {}
    return { min: iso(x.dmin), max: iso(x.dmax), rows: num(x.rows), days: num(x.days), months: num(x.months) }
  }
  const social = await one('ad_spent_social_media')
  const marketing = await one('marketing')
  const mins = [social.min, marketing.min].filter(Boolean).sort()
  const maxs = [social.max, marketing.max].filter(Boolean).sort()
  return {
    dummy: false, social, marketing,
    combined: { min: mins[0] ?? null, max: maxs[maxs.length - 1] ?? null },
    hasData: social.rows > 0 || marketing.rows > 0,
    note: 'Real expense data is thin (≈Jan 31 – Feb 27; Jan is a single day). Trend beyond this range is empty, not fabricated.',
  }
}

// Combined social+marketing monthly totals (for MoM), with day-coverage per month.
async function monthlyCombined(tenantId) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT to_char(date, 'YYYY-MM') AS month, SUM(amount) AS spend, COUNT(DISTINCT date::date)::int AS days
    FROM (
      SELECT date, amount FROM ad_spent_social_media WHERE tenant_id = ${tenantId}
      UNION ALL
      SELECT date, amount FROM marketing WHERE tenant_id = ${tenantId}
    ) x
    GROUP BY 1 ORDER BY 1`)
  return rows.map(r => ({ month: r.month, spend: round2(r.spend), days: num(r.days), partial: num(r.days) <= 3 }))
}

/** Overview KPIs: total spend (social + marketing), counts, leaders, MoM change. REAL. */
export async function getAllocationOverview(tenantId, period) {
  const channels   = await channelSpend(tenantId, period)
  const categories = await categorySpend(tenantId, period)
  const months     = await monthlyCombined(tenantId)
  const range      = await getDateRange(tenantId)

  const socialTotal    = round2(channels.reduce((a, c) => a + c.spend, 0))
  const marketingTotal = round2(categories.reduce((a, c) => a + c.spend, 0))
  const totalSpend     = round2(socialTotal + marketingTotal)

  // MoM = latest two combined months (Jan here is a single day → flagged partial).
  let mom = null
  if (months.length >= 2) {
    const cur = months[months.length - 1], prev = months[months.length - 2]
    mom = {
      current: cur, previous: prev,
      changePct: prev.spend > 0 ? round2(((cur.spend - prev.spend) / prev.spend) * 100) : null,
      caveat: (cur.partial || prev.partial) ? 'One month is partial (≤3 days of data) — MoM is not like-for-like.' : null,
    }
  }
  return {
    dummy: false,
    totalSpend, socialTotal, marketingTotal,
    channelCount: channels.length, categoryCount: categories.length,
    topChannel:  channels[0]   ? { ...channels[0],   sharePct: round2((channels[0].spend / (socialTotal || 1)) * 100) }   : null,
    topCategory: categories[0] ? { ...categories[0], sharePct: round2((categories[0].spend / (marketingTotal || 1)) * 100) } : null,
    mom, months, dateRange: range,
  }
}

/** Channel Pareto — 5 social platforms ranked by spend + cumulative % + 80% ref. */
export async function getChannelPareto(tenantId, period) {
  return buildPareto(await channelSpend(tenantId, period), 'channel')
}
/** Category Pareto — Marketing categories ranked + cumulative % + 80% ref. */
export async function getCategoryPareto(tenantId, period) {
  return buildPareto(await categorySpend(tenantId, period), 'category')
}

/** Share-of-spend for treemap/donut — channels and categories with share %. */
export async function getSpendShare(tenantId, period) {
  const channels = await channelSpend(tenantId, period)
  const categories = await categorySpend(tenantId, period)
  const sTot = channels.reduce((a, c) => a + c.spend, 0) || 1
  const cTot = categories.reduce((a, c) => a + c.spend, 0) || 1
  return {
    dummy: false,
    socialTotal: round2(sTot === 1 && !channels.length ? 0 : sTot),
    marketingTotal: round2(cTot === 1 && !categories.length ? 0 : cTot),
    channels:   channels.map(c => ({ ...c, sharePct: round2((c.spend / sTot) * 100) })),
    categories: categories.map(c => ({ ...c, sharePct: round2((c.spend / cTot) * 100) })),
  }
}

/**
 * Spend over time. dimension 'channel' (social) | 'category' (marketing) | 'total'
 * (both). granularity day|week|month. Long-format points + distinct keys (page pivots).
 * Honestly bounded to the real date range.
 */
export async function getSpendTrend(tenantId, { dimension = 'channel', granularity = 'day', period } = {}) {
  const gran = GRANS.has(granularity) ? granularity : 'day'
  const { start, end } = bounds(period)
  const range = await getDateRange(tenantId)

  let rows
  if (dimension === 'category') {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT date_trunc(${gran}, date)::date AS period, marketing_category AS key, SUM(amount) AS spend
      FROM marketing WHERE tenant_id = ${tenantId}
        AND (${start}::timestamp IS NULL OR date >= ${start}) AND (${end}::timestamp IS NULL OR date <= ${end})
      GROUP BY 1, 2 ORDER BY 1, 2`)
  } else if (dimension === 'total') {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT date_trunc(${gran}, date)::date AS period, 'Total' AS key, SUM(amount) AS spend
      FROM (
        SELECT date, amount FROM ad_spent_social_media WHERE tenant_id = ${tenantId}
        UNION ALL SELECT date, amount FROM marketing WHERE tenant_id = ${tenantId}
      ) x WHERE (${start}::timestamp IS NULL OR date >= ${start}) AND (${end}::timestamp IS NULL OR date <= ${end})
      GROUP BY 1, 2 ORDER BY 1`)
  } else {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT date_trunc(${gran}, date)::date AS period, platform AS key, SUM(amount) AS spend
      FROM ad_spent_social_media WHERE tenant_id = ${tenantId}
        AND (${start}::timestamp IS NULL OR date >= ${start}) AND (${end}::timestamp IS NULL OR date <= ${end})
      GROUP BY 1, 2 ORDER BY 1, 2`)
  }
  const points = rows.map(r => ({ period: iso(r.period), key: r.key, spend: round2(r.spend) }))
  const keys = [...new Set(points.map(p => p.key))]
  return { dummy: false, dimension, granularity: gran, keys, points,
    range: dimension === 'category' ? range.marketing : dimension === 'total' ? range.combined : range.social,
    empty: points.length === 0 }
}

/**
 * Month-over-month spend by channel/category. Honest single-period when only one
 * month exists; flags partial months (Jan = 1 day here).
 */
export async function getMoMComparison(tenantId, { dimension = 'channel' } = {}) {
  const table = dimension === 'category' ? 'marketing' : 'ad_spent_social_media'
  const keyCol = dimension === 'category' ? 'marketing_category' : 'platform'
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT to_char(date, 'YYYY-MM') AS month, ${Prisma.raw(keyCol)} AS key,
           SUM(amount) AS spend, COUNT(DISTINCT date::date)::int AS days
    FROM ${Prisma.raw(table)} WHERE tenant_id = ${tenantId}
    GROUP BY 1, 2 ORDER BY 1`)

  const monthsMeta = {}
  for (const r of rows) {
    const mm = (monthsMeta[r.month] ??= { month: r.month, days: 0, total: 0 })
    mm.days = Math.max(mm.days, num(r.days)); mm.total = round2(mm.total + num(r.spend))
  }
  const months = Object.values(monthsMeta).sort((a, b) => a.month.localeCompare(b.month))
                  .map(m => ({ ...m, partial: m.days <= 3 }))
  const keys = [...new Set(rows.map(r => r.key))]

  if (months.length < 2) {
    return { dummy: false, dimension, singlePeriod: true, months, keys,
      note: 'Only one month of data — MoM comparison not yet possible.',
      comparison: keys.map(k => ({ key: k, current: round2(rows.filter(r => r.key === k).reduce((a, r) => a + num(r.spend), 0)), previous: null, changePct: null })) }
  }
  const cur = months[months.length - 1].month, prev = months[months.length - 2].month
  const at = (k, mo) => round2(rows.filter(r => r.key === k && r.month === mo).reduce((a, r) => a + num(r.spend), 0))
  const comparison = keys.map(k => {
    const c = at(k, cur), p = at(k, prev)
    return { key: k, current: c, previous: p, changePct: p > 0 ? round2(((c - p) / p) * 100) : null }
  }).sort((a, b) => b.current - a.current)
  return { dummy: false, dimension, singlePeriod: false, currentMonth: cur, previousMonth: prev, months, keys, comparison,
    caveat: months.some(m => m.partial) ? 'A month is partial (≤3 days) — comparison is not like-for-like.' : null }
}

/** Drill into one social channel: total, share of social, daily trend, date range. */
export async function getChannelDetail(tenantId, channel, period) {
  const all = await channelSpend(tenantId, period)
  const me = all.find(c => c.key === channel)
  if (!me) return null
  const socialTotal = all.reduce((a, c) => a + c.spend, 0) || 1
  const { start, end } = bounds(period)
  const trend = await prisma.$queryRaw(Prisma.sql`
    SELECT date::date AS period, SUM(amount) AS spend
    FROM ad_spent_social_media WHERE tenant_id = ${tenantId} AND platform = ${channel}
      AND (${start}::timestamp IS NULL OR date >= ${start}) AND (${end}::timestamp IS NULL OR date <= ${end})
    GROUP BY 1 ORDER BY 1`)
  return {
    dummy: false, channel, spend: me.spend, rows: me.rows,
    sharePct: round2((me.spend / socialTotal) * 100),
    trend: trend.map(t => ({ period: iso(t.period), spend: round2(t.spend) })),
    days: trend.length,
    range: trend.length ? { min: iso(trend[0].period), max: iso(trend[trend.length - 1].period) } : null,
  }
}

/** Drill into one Marketing category: total, share, subcategory split, daily trend. */
export async function getCategoryDetail(tenantId, category, period) {
  const all = await categorySpend(tenantId, period)
  const me = all.find(c => c.key === category)
  if (!me) return null
  const mktTotal = all.reduce((a, c) => a + c.spend, 0) || 1
  const subs = await prisma.marketing.groupBy({
    by: ['subCategory'], where: { tenantId, marketingCategory: category, ...dateWhere(period) }, _sum: { amount: true },
  })
  const { start, end } = bounds(period)
  const trend = await prisma.$queryRaw(Prisma.sql`
    SELECT date::date AS period, SUM(amount) AS spend
    FROM marketing WHERE tenant_id = ${tenantId} AND marketing_category = ${category}
      AND (${start}::timestamp IS NULL OR date >= ${start}) AND (${end}::timestamp IS NULL OR date <= ${end})
    GROUP BY 1 ORDER BY 1`)
  return {
    dummy: false, category, spend: me.spend, rows: me.rows,
    sharePct: round2((me.spend / mktTotal) * 100),
    subCategories: subs.map(s => ({ key: s.subCategory ?? '(none)', spend: round2(s._sum.amount) })).sort((a, b) => b.spend - a.spend),
    trend: trend.map(t => ({ period: iso(t.period), spend: round2(t.spend) })),
    days: trend.length,
  }
}
