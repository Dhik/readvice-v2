// DEV seeder for Talent ROI — the DUMMY RETURN side only. Tenant 2.
//
// The talent COST side is 100% REAL and stays in its own tables (Talent.rateFinal,
// TalentPayment.amountTf, TalentContent.finalRateCard). This seeder only fabricates the
// RETURN (attributed revenue/GMV/views/conversions) because NO real talent→revenue link
// exists (Talent.username ∩ Affiliate = 0; TalentContent.campaignId 100% null; Order has
// no talent attribution). ROI = REAL cost ÷ DUMMY return.
//
// Return is sized so ROI (attributedRevenue / real rateFinal) spreads 0.5–5× with a
// realistic mix of winners (>1×) and losers (<1×). All source='DUMMY'. Idempotent.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const { applyObjectiveInference } = require('./_infer-objective.cjs')
const prisma = new PrismaClient()

const TENANT = 2
const randInt   = (a, b) => Math.floor(a + Math.random() * (b - a + 1))
const randFloat = (a, b) => a + Math.random() * (b - a)
const round2    = n => Math.round(n * 100) / 100

;(async () => {
  try {
    const talents = await prisma.talent.findMany({
      where: { tenantId: TENANT },
      select: { id: true, talentName: true, type: true, rateFinal: true, createdAt: true },
    })
    if (!talents.length) { console.log(`No talents for tenant ${TENANT} — nothing to seed.`); return }

    // Attribution period = first-of-month of the latest talent record (data-aligned, UTC).
    const latest = talents.reduce((m, t) => (t.createdAt > m ? t.createdAt : m), talents[0].createdAt)
    const period = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1))

    // Idempotent: wipe this tenant's DUMMY returns first.
    const del = await prisma.talentReturn.deleteMany({ where: { tenantId: TENANT, source: 'DUMMY' } })
    console.log(`Cleared existing DUMMY TalentReturn → ${del.count}`)

    const rows = []
    let roiMin = Infinity, roiMax = -Infinity, winners = 0, losers = 0
    for (const t of talents) {
      const cost = Number(t.rateFinal ?? 0)
      // Realistic mix: ~35% losers (ROI 0.5–1.0×), ~65% winners (ROI 1.0–5×).
      const roiTarget = Math.random() < 0.35 ? randFloat(0.5, 1.0) : randFloat(1.0, 5.0)
      const attributedRevenue = cost > 0
        ? round2(cost * roiTarget)
        : round2(randInt(5_000_000, 50_000_000))           // cost-0 talents still get a return (ROI null)
      const attributedGmv = round2(attributedRevenue * randFloat(2, 4)) // gross sales ≫ attributed net
      const conversions   = Math.max(1, Math.round(attributedGmv / randInt(80_000, 300_000)))
      const contentViews  = conversions * randInt(40, 400)             // implied funnel
      // C-gap fix: engagement actions (likes+comments+shares) — DUMMY, derived from
      // views at a plausible 2–8% engagement rate. Flagged dummy by the row's source.
      const engagementActions = Math.round(contentViews * randFloat(0.02, 0.08))

      if (cost > 0) { roiMin = Math.min(roiMin, roiTarget); roiMax = Math.max(roiMax, roiTarget); roiTarget >= 1 ? winners++ : losers++ }
      rows.push({
        tenantId: TENANT, talentId: t.id, period,
        attributedRevenue, attributedGmv, contentViews, conversions, engagementActions, source: 'DUMMY',
      })
    }

    await prisma.talentReturn.createMany({ data: rows })

    console.log(`\nSeeded tenant ${TENANT}: ${rows.length} TalentReturn rows @ period ${period.toISOString().slice(0, 10)}`)
    console.log(`  ROI spread (dummy return ÷ real rateFinal): ${roiMin.toFixed(2)}× – ${roiMax.toFixed(2)}×  (winners >1× : ${winners}, losers <1× : ${losers})`)
    console.log(`  total dummy attributed revenue: ${Math.round(rows.reduce((a, r) => a + r.attributedRevenue, 0)).toLocaleString('id-ID')}`)
    console.log(`  engagementActions (DUMMY, likes+comments+shares): ${rows.reduce((a, r) => a + r.engagementActions, 0).toLocaleString('id-ID')} total`)
    console.log(`  RETURN is fabricated (source='DUMMY'); COST stays REAL in Talent/TalentPayment/TalentContent.`)

    // Part C: infer the marketing objective for this tenant's talents (Awareness/
    // Consideration/Conversion) — same shared logic the backfill uses. objectiveInferred=true.
    const inf = await applyObjectiveInference(prisma, TENANT)
    console.log(`\n  Objective inference (tenant ${TENANT}): updated ${inf.updated}, kept ${inf.skipped} override(s) → ${JSON.stringify(inf.distribution)}`)
  } catch (e) {
    console.error('SEED FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
