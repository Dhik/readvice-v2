import { prisma } from '@/lib/prisma'

// Same baseline as app/api/talent/kpi/route.js — keep in sync.
const BASELINE = new Date('2025-07-24')
const TYPES = ['Affiliate', 'KOL', 'Content Creator', 'Clipper']

const num = v => Number(v ?? 0)   // safe for null / Decimal / BigInt

// Tenant-scoped, PII-stripped talent summary. The talent findMany selects ONLY
// non-PII fields — bank account, NIK, NPWP, phone, address, namaRekening are
// never fetched, not just removed after. TalentContent/TalentPayment have no
// tenantId column, so they scope through the `talent` relation (like talent/kpi).
// Returns null on any failure so the chat route never crashes.
export async function getTalentSummary(tenantId) {
  try {
    const talentWhere = { tenantId, createdAt: { gte: BASELINE } }

    // Single row fetch — non-PII columns only — drives overview + financial.
    const talents = await prisma.talent.findMany({
      where:  talentWhere,
      select: { id: true, username: true, type: true, rateFinal: true, dpAmount: true, slotFinal: true },
    })

    const byType = Object.fromEntries(TYPES.map(t => [t, 0]))
    let totalRateFinal = 0, totalDpAmount = 0, hutangEstimate = 0
    for (const t of talents) {
      if (byType[t.type] !== undefined) byType[t.type] += 1
      const rate = num(t.rateFinal), dp = num(t.dpAmount)
      totalRateFinal += rate
      totalDpAmount  += dp
      if (dp < rate) hutangEstimate += rate - dp   // per-row: only where dp under-pays
    }

    const topByRate = [...talents]
      .sort((a, b) => num(b.rateFinal) - num(a.rateFinal))
      .slice(0, 5)
      .map(t => ({
        id:        t.id,
        username:  t.username,
        type:      t.type,
        rateFinal: num(t.rateFinal),
        dpAmount:  num(t.dpAmount),
        slotFinal: t.slotFinal ?? 0,
      }))

    // Content + payments scope via the talent relation (no tenantId column there).
    const rel = { talent: talentWhere }
    const [contentTotal, contentDone, contentPending, byStatusRows, paidAgg] = await prisma.$transaction([
      prisma.talentContent.count({ where: rel }),
      prisma.talentContent.count({ where: { ...rel, done: true, isRefund: false } }),
      prisma.talentContent.count({ where: { ...rel, done: false } }),
      prisma.talentPayment.groupBy({ by: ['statusPayment'], where: rel, _count: true }),
      prisma.talentPayment.aggregate({ where: { ...rel, donePayment: { not: null } }, _sum: { amountTf: true } }),
    ])

    const byStatus = {}
    for (const r of byStatusRows) byStatus[r.statusPayment] = r._count

    return {
      period:   { baseline: '2025-07-24' },
      overview: { total: talents.length, byType },
      financial: {
        totalRateFinal,
        totalDpAmount,
        hutangEstimate,
        topByRate,
      },
      content:  { total: contentTotal, done: contentDone, pending: contentPending },
      payments: { byStatus, totalPaid: num(paidAgg._sum.amountTf) },
    }
  } catch (err) {
    console.error('getTalentSummary failed:', err?.message)
    return null
  }
}
