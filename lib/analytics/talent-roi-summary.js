// ─── Talent ROI engine (Wave 2 — SHARPEST dummy case) ───────────────────────
// ROI = REAL cost ÷ DUMMY return. The cost side is 100% real (Talent.rateFinal,
// TalentPayment.amountTf, TalentContent.finalRateCard); the return side is FABRICATED
// (TalentReturn, source='DUMMY') because NO talent→revenue link exists
// (Talent.username ∩ Affiliate = 0; TalentContent.campaignId 100% null; Order has no
// talent attribution). EVERY response carries `costReal: true` + `returnDummy: true`
// so the split is unmistakable. See docs/TALENT_ROI_DATA_SOURCES.md.
//
// Distinct from the existing Talent PAYMENT report (Spent/Hutang/Piutang) — this is the
// ROI / performance lens. Tenant-scoped; Decimal/BigInt → Number at the boundary.
import { prisma } from '../prisma'

const round2 = n => Math.round((Number(n) || 0) * 100) / 100
const num    = v => Number(v ?? 0)
const median = arr => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

// Quadrant: real cost (x) × DUMMY return (y). Labels/colors for the page.
export const ROI_QUADRANTS = {
  'Star':       { color: '#22c55e', desc: 'Low cost, high return — best ROI (return is dummy).' },
  'Premium':    { color: '#6B8E9E', desc: 'High cost, high return — works but pricey (return dummy).' },
  'Overpriced': { color: '#dc3545', desc: 'High cost, low return — poor ROI (return dummy).' },
  'Low Impact': { color: '#C9A66B', desc: 'Low cost, low return — little effect (return dummy).' },
}
export const roiQuadColor = q => ROI_QUADRANTS[q]?.color ?? '#8B8B8B'

const REC = {
  'Star':       { headline: 'Scale & retain', action: 'Best ROI — renew, give more slots, replicate the brief.' },
  'Premium':    { headline: 'Negotiate rate', action: 'High return but expensive — push for better rates or more deliverables.' },
  'Overpriced': { headline: 'Cut or rework', action: 'Cost outruns return — renegotiate, change format, or drop.' },
  'Low Impact': { headline: 'Test small', action: 'Low cost, low return — keep as cheap experiments or retire.' },
}

// ── Core loader: per-talent REAL cost ⋈ DUMMY return (24 talents — compute in JS) ──
async function loadTalentRoi(tenantId, period) {
  const talents = await prisma.talent.findMany({
    where: { tenantId },
    select: { id: true, talentName: true, username: true, type: true, rateFinal: true },
  })
  if (!talents.length) return { hasData: false, items: [], period: null }

  // REAL payments (TalentPayment has no tenantId — scope via relation).
  const payments = await prisma.talentPayment.findMany({
    where: { talent: { tenantId } },
    select: { talentId: true, amountTf: true, donePayment: true, statusPayment: true },
  })
  // REAL content cost.
  const contents = await prisma.talentContent.findMany({
    where: { talent: { tenantId } },
    select: { talentId: true, finalRateCard: true },
  })
  // DUMMY return (optionally a single period; default = all rows for the tenant).
  const where = { tenantId }
  if (period?.month) {
    const [y, m] = String(period.month).split('-').map(Number)
    where.period = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) }
  }
  const returns = await prisma.talentReturn.findMany({
    where, select: { talentId: true, attributedRevenue: true, attributedGmv: true, contentViews: true, conversions: true, period: true },
  })

  const payMap = new Map(), contentMap = new Map(), retMap = new Map()
  for (const p of payments) {
    const g = payMap.get(p.talentId) ?? { paid: 0, count: 0, done: 0 }
    g.paid += num(p.amountTf); g.count++; if (p.donePayment) g.done++; payMap.set(p.talentId, g)
  }
  for (const c of contents) {
    const g = contentMap.get(c.talentId) ?? { contentCost: 0, count: 0 }
    g.contentCost += num(c.finalRateCard); g.count++; contentMap.set(c.talentId, g)
  }
  for (const r of returns) {
    const g = retMap.get(r.talentId) ?? { attributedRevenue: 0, attributedGmv: 0, contentViews: 0, conversions: 0 }
    g.attributedRevenue += num(r.attributedRevenue); g.attributedGmv += num(r.attributedGmv)
    g.contentViews += num(r.contentViews); g.conversions += num(r.conversions); retMap.set(r.talentId, g)
  }

  const items = talents.map(t => {
    const cost = round2(t.rateFinal)                          // REAL — ROI denominator (committed rate)
    const pay = payMap.get(t.id) ?? { paid: 0, count: 0, done: 0 }
    const con = contentMap.get(t.id) ?? { contentCost: 0, count: 0 }
    const ret = retMap.get(t.id) ?? { attributedRevenue: 0, attributedGmv: 0, contentViews: 0, conversions: 0 }
    return {
      talentId: t.id, name: t.talentName, username: t.username, type: t.type || 'Unknown',
      // REAL cost block:
      cost, paid: round2(pay.paid), paymentsCount: pay.count, doneCount: pay.done,
      contentCost: round2(con.contentCost), contentCount: con.count,
      // DUMMY return block:
      attributedRevenue: round2(ret.attributedRevenue), attributedGmv: round2(ret.attributedGmv),
      contentViews: ret.contentViews, conversions: ret.conversions,
      roi: cost > 0 ? round2(ret.attributedRevenue / cost) : null,   // REAL cost ÷ DUMMY return
    }
  })
  return { hasData: true, items, period: period?.month ?? 'all' }
}

const FLAGS = { dummy: true, costReal: true, returnDummy: true }   // spread into every response

/** Overview: total REAL cost, total DUMMY return, blended ROI (flagged), counts. */
export async function getTalentRoiOverview(tenantId, period) {
  const { hasData, items } = await loadTalentRoi(tenantId, period)
  if (!hasData) return { ...FLAGS, hasData: false, talentCount: 0, note: 'No talents for this tenant.' }
  const sum = f => round2(items.reduce((a, i) => a + i[f], 0))
  const withRoi = items.filter(i => i.roi != null)
  const totalCost = sum('cost'), totalReturn = sum('attributedRevenue')
  return {
    ...FLAGS, hasData: true, talentCount: items.length,
    totalCost, totalPaid: sum('paid'), totalContentCost: sum('contentCost'),     // REAL
    totalReturn, totalGmv: sum('attributedGmv'),                                  // DUMMY
    blendedRoi: totalCost > 0 ? round2(totalReturn / totalCost) : null,           // real cost ÷ dummy return
    avgRoi: withRoi.length ? round2(withRoi.reduce((a, i) => a + i.roi, 0) / withRoi.length) : null,
    winners: withRoi.filter(i => i.roi >= 1).length, losers: withRoi.filter(i => i.roi < 1).length,
    note: 'ROI = REAL talent cost (rateFinal) ÷ DUMMY attributed return. Cost is real; return is fabricated (no talent→revenue link).',
  }
}

/** MAIN chart: cost (x, REAL) × attributed return (y, DUMMY), bubble = views. */
export async function getTalentRoiQuadrant(tenantId, period) {
  const { hasData, items } = await loadTalentRoi(tenantId, period)
  const measured = items.filter(i => i.cost > 0)
  const medCost = round2(median(measured.map(i => i.cost)))
  const medRet  = round2(median(measured.map(i => i.attributedRevenue)))
  const classify = i => {
    const hiCost = i.cost >= medCost, hiRet = i.attributedRevenue >= medRet
    return hiRet ? (hiCost ? 'Premium' : 'Star') : (hiCost ? 'Overpriced' : 'Low Impact')
  }
  const points = measured.map(i => ({
    talentId: i.talentId, name: i.name, type: i.type,
    x: i.cost, y: i.attributedRevenue, views: i.contentViews, roi: i.roi, quadrant: classify(i),
  }))
  const counts = { Star: 0, Premium: 0, Overpriced: 0, 'Low Impact': 0 }
  for (const p of points) counts[p.quadrant]++
  return {
    ...FLAGS, hasData, points, counts, medianCost: medCost, medianReturn: medRet,
    measuredCount: measured.length, totalCount: items.length,
    axes: { xLabel: 'Talent cost (REAL — rate card)', yLabel: 'Attributed return (DUMMY)', sizeLabel: 'Views (dummy)' },
  }
}

/** Talents ranked by ROI (desc, nulls last) — for the leaderboard bar. */
export async function getTalentRanking(tenantId, period) {
  const { hasData, items } = await loadTalentRoi(tenantId, period)
  const ranked = [...items].sort((a, b) => (b.roi ?? -1) - (a.roi ?? -1))
    .map(i => ({ talentId: i.talentId, name: i.name, type: i.type, cost: i.cost, attributedRevenue: i.attributedRevenue, roi: i.roi }))
  return { ...FLAGS, hasData, items: ranked }
}

/** Per-talent REAL cost + DUMMY return paired — for the diverging/grouped bar. */
export async function getTalentCostVsReturn(tenantId, period) {
  const { hasData, items } = await loadTalentRoi(tenantId, period)
  const rows = [...items].sort((a, b) => b.cost - a.cost)
    .map(i => ({ talentId: i.talentId, name: i.name, type: i.type, cost: i.cost, attributedRevenue: i.attributedRevenue, roi: i.roi }))
  return { ...FLAGS, hasData, items: rows, costLabel: 'Cost (REAL)', returnLabel: 'Return (DUMMY)' }
}

/** ROI / cost / return by talent type — for the type bar. */
export async function getTypePerformance(tenantId, period) {
  const { hasData, items } = await loadTalentRoi(tenantId, period)
  const map = new Map()
  for (const i of items) {
    const g = map.get(i.type) ?? { type: i.type, count: 0, cost: 0, attributedRevenue: 0, views: 0 }
    g.count++; g.cost += i.cost; g.attributedRevenue += i.attributedRevenue; g.views += i.contentViews; map.set(i.type, g)
  }
  const groups = [...map.values()].map(g => ({
    type: g.type, count: g.count, cost: round2(g.cost), attributedRevenue: round2(g.attributedRevenue),
    views: g.views,   // DUMMY (for the radar's 4th axis) — already aggregated above, no new query
    roi: g.cost > 0 ? round2(g.attributedRevenue / g.cost) : null,
  })).sort((a, b) => (b.roi ?? -1) - (a.roi ?? -1))
  return { ...FLAGS, hasData, groups }
}

/** Per-segment recommendations — note return-based recs rest on DUMMY data. */
export async function getRecommendations(tenantId, period) {
  const { hasData, items } = await loadTalentRoi(tenantId, period)
  const order = ['Star', 'Premium', 'Overpriced', 'Low Impact']
  const measured = items.filter(i => i.cost > 0)
  const medCost = median(measured.map(i => i.cost)), medRet = median(measured.map(i => i.attributedRevenue))
  const classify = i => { const hiCost = i.cost >= medCost, hiRet = i.attributedRevenue >= medRet; return hiRet ? (hiCost ? 'Premium' : 'Star') : (hiCost ? 'Overpriced' : 'Low Impact') }
  const byQ = {}
  for (const i of measured) (byQ[classify(i)] ??= []).push(i)
  const segments = order.filter(q => byQ[q]).map(q => ({
    quadrant: q, color: roiQuadColor(q), ...REC[q], count: byQ[q].length,
    talents: [...byQ[q]].sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0)).slice(0, 5).map(i => ({ talentId: i.talentId, name: i.name, roi: i.roi, cost: i.cost })),
  }))
  return { ...FLAGS, hasData, segments, caveat: 'Recommendations rank on DUMMY attributed return — treat as a template until a real talent→revenue link exists.' }
}

/** Full detail: REAL cost/payments/content + KolProfile, DUMMY return — separated. */
export async function getTalentDetail(tenantId, talentId, period) {
  const { hasData, items } = await loadTalentRoi(tenantId, period)
  if (!hasData) return null
  const it = items.find(i => i.talentId === Number(talentId))
  if (!it) return null

  // REAL: payment rows for this talent.
  const payments = await prisma.talentPayment.findMany({
    where: { talentId: it.talentId, talent: { tenantId } },
    select: { statusPayment: true, amountTf: true, tanggalPengajuan: true, donePayment: true },
    orderBy: { tanggalPengajuan: 'asc' },
  })
  // REAL: KolProfile match by username (shared real contact DB), tenant-scoped.
  let kolProfile = null
  if (it.username) {
    const k = await prisma.kolProfile.findFirst({
      where: { tenantId, username: it.username },
      select: { followers: true, engRate: true, rate: true, channel: true, niche: true },
    })
    if (k) kolProfile = { followers: num(k.followers), engRate: k.engRate != null ? Number(k.engRate) : null, rate: round2(k.rate), channel: k.channel, niche: k.niche }
  }

  return {
    ...FLAGS, talentId: it.talentId, name: it.name, type: it.type, username: it.username,
    real: {
      cost: it.cost, paid: it.paid, paymentsCount: it.paymentsCount, doneCount: it.doneCount,
      contentCost: it.contentCost, contentCount: it.contentCount,
      payments: payments.map(p => ({ status: p.statusPayment, amount: round2(p.amountTf),
        requested: p.tanggalPengajuan ? p.tanggalPengajuan.toISOString().slice(0, 10) : null,
        done: p.donePayment ? p.donePayment.toISOString().slice(0, 10) : null })),
      kolProfile,
    },
    dummyReturn: {
      attributedRevenue: it.attributedRevenue, attributedGmv: it.attributedGmv,
      contentViews: it.contentViews, conversions: it.conversions, roi: it.roi,
      note: 'Fabricated — no real talent→revenue link. Do not treat as actual sales.',
    },
  }
}
