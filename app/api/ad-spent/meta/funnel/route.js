import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// ─── Stage classification ─────────────────────────────────────────────────────
// Rules are tested IN ORDER; first match wins.
// Multi-word variants MUST come before their plain base (BOFU LIVE before BOFU).
// EXC = exclusion audience variant. IE = abbreviation TBD — update comment once confirmed.
// Separator [\s_\-]+ covers spaces, underscores, hyphens.
// If your team uses dots or pipes between words, add them: [\s_\-.|]+
const STAGE_RULES = [
  { stage: 'BOFU APP',  match: /(?<![a-zA-Z])BOFU[\s_\-]+APP(?![a-zA-Z])/i  },
  { stage: 'BOFU LIVE', match: /(?<![a-zA-Z])BOFU[\s_\-]+LIVE(?![a-zA-Z])/i },
  { stage: 'BOFU IE',   match: /(?<![a-zA-Z])BOFU[\s_\-]+IE(?![a-zA-Z])/i   },
  { stage: 'TOFU EXC',  match: /(?<![a-zA-Z])TOFU[\s_\-]+EXC(?![a-zA-Z])/i  },
  { stage: 'MOFU EXC',  match: /(?<![a-zA-Z])MOFU[\s_\-]+EXC(?![a-zA-Z])/i  },
  { stage: 'BOFU',      match: /(?<![a-zA-Z])BOFU(?![a-zA-Z])/i              },
  { stage: 'TOFU',      match: /(?<![a-zA-Z])TOFU(?![a-zA-Z])/i              },
  { stage: 'MOFU',      match: /(?<![a-zA-Z])MOFU(?![a-zA-Z])/i              },
]

// UI display order: top-of-funnel first, unclassified last
const CANONICAL_STAGES = ['TOFU', 'TOFU EXC', 'MOFU', 'MOFU EXC', 'BOFU', 'BOFU APP', 'BOFU LIVE', 'BOFU IE', 'OTHERS']

function inferStage(adsetName) {
  if (!adsetName) return 'OTHERS'
  for (const { stage, match } of STAGE_RULES) {
    if (match.test(adsetName)) return stage
  }
  return 'OTHERS'
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') ?? ''
  const endDate   = searchParams.get('endDate')   ?? ''
  const tenantId  = session.user.tenantId

  const where = {
    tenantId,
    ...(startDate && endDate ? {
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    } : {}),
  }

  const rows = await prisma.adSpentMeta.findMany({
    where,
    select: { adsetName: true, spent: true, revenue: true, conversions: true },
  })

  // ─── Accumulate per-stage totals ───────────────────────────────────────────
  const stageAcc = Object.fromEntries(
    CANONICAL_STAGES.map(s => [s, { spent: 0, revenue: 0, conversions: 0, hasRevenue: false }])
  )

  for (const row of rows) {
    const stage = inferStage(row.adsetName)
    const acc   = stageAcc[stage]
    acc.spent       += Number(row.spent)
    acc.conversions += row.conversions ?? 0
    if (row.revenue != null) {
      acc.revenue   += Number(row.revenue)
      acc.hasRevenue = true
    }
  }

  const totalSpent = CANONICAL_STAGES.reduce((s, k) => s + stageAcc[k].spent, 0)

  const stages = CANONICAL_STAGES.map(stage => {
    const acc  = stageAcc[stage]
    const pct  = totalSpent > 0 ? parseFloat(((acc.spent / totalSpent) * 100).toFixed(1)) : 0
    const roas = acc.hasRevenue && acc.spent > 0 ? parseFloat((acc.revenue / acc.spent).toFixed(2)) : null
    return {
      stage,
      spent:       acc.spent,
      revenue:     acc.hasRevenue ? acc.revenue : null,
      conversions: acc.conversions,
      roas,
      pct,
    }
  })

  // ─── Campaign drilldown: group by adsetName, sort by spent desc ────────────
  const campaignAcc = {}
  for (const row of rows) {
    const name = row.adsetName ?? '(no name)'
    if (!campaignAcc[name]) {
      campaignAcc[name] = { adsetName: name, spent: 0, revenue: 0, conversions: 0, hasRevenue: false }
    }
    const c = campaignAcc[name]
    c.spent       += Number(row.spent)
    c.conversions += row.conversions ?? 0
    if (row.revenue != null) {
      c.revenue   += Number(row.revenue)
      c.hasRevenue = true
    }
  }

  const campaigns = Object.values(campaignAcc)
    .sort((a, b) => b.spent - a.spent)
    .map(c => ({
      adsetName:   c.adsetName,
      spent:       c.spent,
      revenue:     c.hasRevenue ? c.revenue : null,
      conversions: c.conversions,
      roas:        c.hasRevenue && c.spent > 0 ? parseFloat((c.revenue / c.spent).toFixed(2)) : null,
    }))

  // ─── Totals ────────────────────────────────────────────────────────────────
  const hasAnyRevenue  = stages.some(s => s.revenue != null)
  const totalRevenue   = hasAnyRevenue ? stages.reduce((s, r) => s + (r.revenue ?? 0), 0) : null
  const totalRoas      = hasAnyRevenue && totalSpent > 0 ? parseFloat((totalRevenue / totalSpent).toFixed(2)) : null
  const totalConversions = stages.reduce((s, r) => s + r.conversions, 0)

  return NextResponse.json({
    stages,
    campaigns,
    totals: { spent: totalSpent, revenue: totalRevenue, conversions: totalConversions, roas: totalRoas },
  })
}
