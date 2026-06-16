// ─── Campaign Content Efficiency engine (Wave 1 — REAL fields, honest caveat) ─
// CROSS-campaign efficiency: compares creators/content ACROSS campaigns on CPM,
// cost-per-reported-GMV, engagement, channel/tiering mix. (Distinct from the
// existing per-campaign PerformanceChart / expense-vs-GMV panel — do not rebuild those.)
//
// CRITICAL HONESTY (see docs/CAMPAIGN_EFFICIENCY_DATA_SOURCES.md): every metric is a
// REAL computation on REAL CampaignContent fields — BUT `gmv` is **self-reported /
// imported**, NOT joined to real Order sales. There is no campaign→order attribution
// (Wave 3 / data-plumbing). So this measures cost vs **REPORTED** GMV, not attributed
// sales / true incrementality. Responses carry `dummy: false` + `selfReportedGmv: true`.
//
// Data reality (tenant 2): 95 content pieces but only ~20 carry real cost/gmv/tiering
// (the rest are zero placeholders) → `measuredCount` is surfaced. Channel strings have
// case/format dupes ("Instagram feed" vs "instagram_feed") → normalized. ContentStatistic
// is thin (2 dates) → trend is shallow, surfaced honestly.
//
// Tenant scoping: EVERY read filters tenantId. Decimal/BigInt → Number at the boundary.
import { prisma } from '../prisma'

const round2 = n => Math.round((Number(n) || 0) * 100) / 100
const num    = v => Number(v ?? 0)
const iso    = d => (d ? new Date(d).toISOString().slice(0, 10) : null)
const median = arr => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

// ── FIELD_MANIFEST (Part B1) — numeric params for calculated fields ───────────
// Every metric is a REAL computation on real CampaignContent fields → `dummy: false`
// throughout (the engine sets dummy:false on every response). The standing caveat is
// `selfReportedGmv: true`: GMV is imported/self-reported, NOT attributed to real
// Orders — captured in `source` for reportedGmv and anything derived from it, so the
// honesty signal survives even though nothing is fabricated.
export const FIELD_MANIFEST = [
  { key: 'cost',           label: 'Cost (rate card)',         unit: 'IDR',   dummy: false, source: 'REAL' },
  { key: 'reportedGmv',    label: 'Reported GMV',             unit: 'IDR',   dummy: false, source: 'REAL (self-reported, not attributed)' },
  { key: 'views',          label: 'Views',                    unit: 'count', dummy: false, source: 'REAL' },
  { key: 'likes',          label: 'Likes',                    unit: 'count', dummy: false, source: 'REAL' },
  { key: 'comments',       label: 'Comments',                 unit: 'count', dummy: false, source: 'REAL' },
  { key: 'cpm',            label: 'CPM (cost / 1k views)',    unit: 'IDR',   dummy: false, source: 'REAL-DERIVED' },
  { key: 'engagementRate', label: 'Engagement rate',          unit: '%',     dummy: false, source: 'REAL-DERIVED' },
  { key: 'costPerGmv',     label: 'Cost per reported GMV',    unit: 'ratio', dummy: false, source: 'REAL-DERIVED (self-reported GMV)' },
  { key: 'gmvPerCost',     label: 'Reported GMV per cost',    unit: 'ratio', dummy: false, source: 'REAL-DERIVED (self-reported GMV)' },
]

// Normalize channel strings: "Instagram feed" / "instagram_feed" → same key.
function normChannel(c) {
  const key = String(c ?? '').toLowerCase().replace(/[_\s]+/g, ' ').trim()
  if (!key) return { key: 'unknown', label: 'Unknown' }
  return { key, label: key.replace(/\b\w/g, m => m.toUpperCase()) }
}

// Content quadrant (cost vs reported GMV). Labels/colors for the page.
export const CONTENT_QUADRANTS = {
  'Efficient':  { color: '#22c55e', desc: 'Low cost, high reported GMV — best value.' },
  'Premium':    { color: '#6B8E9E', desc: 'High cost, high reported GMV — works but pricey.' },
  'Overpriced': { color: '#dc3545', desc: 'High cost, low reported GMV — poor value.' },
  'Low Impact': { color: '#C9A66B', desc: 'Low cost, low reported GMV — little effect.' },
}
export const quadColor = q => CONTENT_QUADRANTS[q]?.color ?? '#8B8B8B'

// ── Core loader: ONE query → enriched content rows (95 rows, compute in JS) ────
async function loadContent(tenantId) {
  const rows = await prisma.campaignContent.findMany({
    where: { tenantId },
    select: {
      id: true, campaignId: true, username: true, creatorName: true, channel: true,
      tiering: true, rateCard: true, gmv: true, view: true, like: true, comment: true,
      isFyp: true, isDelivered: true, isPaid: true, uploadDate: true,
      campaign: { select: { title: true } },
    },
    orderBy: { gmv: 'desc' },
  })
  return rows.map(r => {
    const cost = round2(r.rateCard), gmv = round2(r.gmv)
    const views = num(r.view), likes = num(r.like), comments = num(r.comment)
    const ch = normChannel(r.channel)
    return {
      id: r.id, campaignId: r.campaignId, campaignTitle: r.campaign?.title ?? `Campaign ${r.campaignId}`,
      username: r.username, creatorName: r.creatorName ?? r.username,
      channel: ch.label, channelKey: ch.key,
      tiering: r.tiering || 'Untiered',
      cost, reportedGmv: gmv, views, likes, comments,
      isFyp: !!r.isFyp, isDelivered: !!r.isDelivered, isPaid: !!r.isPaid,
      uploadDate: iso(r.uploadDate),
      // REAL computations (guarded denominators → null, never NaN/Infinity):
      cpm:            views > 0 ? round2(cost / (views / 1000)) : null,   // cost per 1000 views
      engagementRate: views > 0 ? round2(((likes + comments) / views) * 100) : null, // %
      costPerGmv:     gmv > 0 ? round2(cost / gmv) : null,                // lower = better
      gmvPerCost:     cost > 0 ? round2(gmv / cost) : null,               // higher = better (on REPORTED gmv)
      measured:       cost > 0 || gmv > 0,                                // has real signal (vs zero placeholder)
    }
  })
}

const mean = (arr, f) => { const v = arr.map(f).filter(x => x != null); return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : 0 }

/** Overview KPIs across all content. `gmv` is REPORTED (self-reported), flagged. */
export async function getEfficiencyOverview(tenantId) {
  const all = await loadContent(tenantId)
  const measured = all.filter(c => c.measured)
  const totalCost = round2(all.reduce((a, c) => a + c.cost, 0))
  const totalGmv  = round2(all.reduce((a, c) => a + c.reportedGmv, 0))
  const campaigns = new Set(all.map(c => c.campaignId))
  const channels  = new Set(all.map(c => c.channelKey))
  const tierings  = new Set(measured.map(c => c.tiering))
  return {
    dummy: false, selfReportedGmv: true,
    contentCount: all.length, measuredCount: measured.length,
    campaignCount: campaigns.size, channelCount: channels.size, tieringCount: tierings.size,
    totalCost, totalReportedGmv: totalGmv,
    blendedCostPerReportedGmv: totalGmv > 0 ? round2(totalCost / totalGmv) : null,
    blendedGmvPerCost: totalCost > 0 ? round2(totalGmv / totalCost) : null,
    avgCpm: mean(all, c => c.cpm), avgEngagementRate: mean(all, c => c.engagementRate),
    totalViews: all.reduce((a, c) => a + c.views, 0),
    fypCount: all.filter(c => c.isFyp).length,
    deliveredCount: all.filter(c => c.isDelivered).length,
    paidCount: all.filter(c => c.isPaid).length,
    note: 'GMV is self-reported (imported on the content record), NOT attributed to real Orders. Efficiency = cost vs reported GMV, not true sales ROI.',
  }
}

/**
 * Cost × reported-GMV quadrant (the fit-for-this-analysis chart). x = cost, y =
 * reported GMV, bubble = views. Thresholds = medians over MEASURED content.
 */
export async function getEfficiencyQuadrant(tenantId) {
  const all = await loadContent(tenantId)
  const measured = all.filter(c => c.measured)
  const medCost = round2(median(measured.map(c => c.cost)))
  const medGmv  = round2(median(measured.map(c => c.reportedGmv)))
  const classify = c => {
    const hiCost = c.cost >= medCost, hiGmv = c.reportedGmv >= medGmv
    return hiGmv ? (hiCost ? 'Premium' : 'Efficient') : (hiCost ? 'Overpriced' : 'Low Impact')
  }
  const points = measured.map(c => ({
    id: c.id, name: c.creatorName, channel: c.channel, tiering: c.tiering,
    x: c.cost, y: c.reportedGmv, views: c.views, gmvPerCost: c.gmvPerCost,
    cpm: c.cpm, engagementRate: c.engagementRate, costPerGmv: c.costPerGmv, isFyp: c.isFyp,
    quadrant: classify(c),
  }))
  const counts = { Efficient: 0, Premium: 0, Overpriced: 0, 'Low Impact': 0 }
  for (const p of points) counts[p.quadrant]++
  return {
    dummy: false, selfReportedGmv: true,
    medianCost: medCost, medianReportedGmv: medGmv,
    points, counts, measuredCount: measured.length, totalCount: all.length,
    axes: { xLabel: 'Cost (rate card)', yLabel: 'Reported GMV', sizeLabel: 'Views' },
  }
}

// Group helper for channel/tiering breakdowns.
function groupBy(content, keyFn, labelFn) {
  const map = new Map()
  for (const c of content) {
    const k = keyFn(c)
    const g = map.get(k) ?? { key: k, label: labelFn(c), count: 0, cost: 0, reportedGmv: 0, views: 0, likes: 0, comments: 0, _cpm: [], _eng: [] }
    g.count++; g.cost += c.cost; g.reportedGmv += c.reportedGmv; g.views += c.views; g.likes += c.likes; g.comments += c.comments
    if (c.cpm != null) g._cpm.push(c.cpm)
    if (c.engagementRate != null) g._eng.push(c.engagementRate)
    map.set(k, g)
  }
  return [...map.values()].map(g => ({
    key: g.key, label: g.label, count: g.count,
    cost: round2(g.cost), reportedGmv: round2(g.reportedGmv), views: g.views,
    avgCpm: g._cpm.length ? round2(g._cpm.reduce((a, b) => a + b, 0) / g._cpm.length) : null,
    costPerGmv: g.reportedGmv > 0 ? round2(g.cost / g.reportedGmv) : null,
    gmvPerCost: g.cost > 0 ? round2(g.reportedGmv / g.cost) : null,
    engagementRate: g.views > 0 ? round2(((g.likes + g.comments) / g.views) * 100) : null,
  })).sort((a, b) => b.cost - a.cost)
}

/** Efficiency by channel (normalized). */
export async function getChannelMix(tenantId) {
  const all = await loadContent(tenantId)
  return { dummy: false, selfReportedGmv: true, groups: groupBy(all, c => c.channelKey, c => c.channel) }
}

/** Efficiency by tiering (nulls → 'Untiered'). */
export async function getTieringPerformance(tenantId) {
  const all = await loadContent(tenantId)
  return { dummy: false, selfReportedGmv: true, groups: groupBy(all, c => c.tiering, c => c.tiering) }
}

/** Engagement funnel rates + per-content engagement→reported-GMV points. */
export async function getEngagementAnalysis(tenantId) {
  const all = await loadContent(tenantId)
  const withViews = all.filter(c => c.views > 0)
  const totV = withViews.reduce((a, c) => a + c.views, 0)
  const totL = withViews.reduce((a, c) => a + c.likes, 0)
  const totC = withViews.reduce((a, c) => a + c.comments, 0)
  return {
    dummy: false, selfReportedGmv: true,
    totals: { views: totV, likes: totL, comments: totC },
    likeRate:    totV > 0 ? round2((totL / totV) * 100) : 0,
    commentRate: totV > 0 ? round2((totC / totV) * 100) : 0,
    engagementRate: totV > 0 ? round2(((totL + totC) / totV) * 100) : 0,
    points: withViews.map(c => ({ id: c.id, name: c.creatorName, channel: c.channel,
      engagementRate: c.engagementRate, reportedGmv: c.reportedGmv, views: c.views })),
  }
}

// Leaderboard rows (only measured content with both cost>0 and gmv>0 → ratio valid).
function leaderboard(content) {
  return content.filter(c => c.cost > 0 && c.reportedGmv > 0)
    .map(c => ({ id: c.id, name: c.creatorName, channel: c.channel, tiering: c.tiering,
      cost: c.cost, reportedGmv: c.reportedGmv, gmvPerCost: c.gmvPerCost, costPerGmv: c.costPerGmv, views: c.views }))
}
/** Most efficient content (highest reported-GMV per cost). */
export async function getTopContent(tenantId, limit = 10) {
  const rows = leaderboard(await loadContent(tenantId)).sort((a, b) => b.gmvPerCost - a.gmvPerCost)
  return { dummy: false, selfReportedGmv: true, items: rows.slice(0, limit) }
}
/** Least efficient content (lowest reported-GMV per cost). */
export async function getBottomContent(tenantId, limit = 10) {
  const rows = leaderboard(await loadContent(tenantId)).sort((a, b) => a.gmvPerCost - b.gmvPerCost)
  return { dummy: false, selfReportedGmv: true, items: rows.slice(0, limit) }
}

/** One content piece: full metrics + creator/channel/tiering + thin ContentStatistic series. */
export async function getContentDetail(tenantId, contentId) {
  const all = await loadContent(tenantId)
  const c = all.find(x => x.id === Number(contentId))
  if (!c) return null
  // ContentStatistic has no tenantId — already scoped because `c` is tenant's content.
  const stats = await prisma.contentStatistic.findMany({
    where: { contentId: c.id }, orderBy: { date: 'asc' },
    select: { date: true, view: true, like: true, comment: true, gmv: true, spend: true },
  })
  const series = stats.map(s => ({ date: iso(s.date), views: num(s.view), likes: num(s.like),
    comments: num(s.comment), reportedGmv: round2(s.gmv), spend: round2(s.spend) }))
  return {
    dummy: false, selfReportedGmv: true, ...c,
    statistics: series, statisticsAvailable: series.length > 0,
    statisticsNote: series.length === 0
      ? 'No daily statistics captured for this content.'
      : (series.length < 3 ? `Only ${series.length} day(s) of statistics — trend is shallow.` : null),
  }
}
