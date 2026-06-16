import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  getTalentRoiOverview, getTalentRoiQuadrant, getTalentRanking, getTalentCostVsReturn,
  getTypePerformance, getTalentDetail, getRecommendations,
} from '@/lib/analytics/talent-roi-summary'

export const runtime = 'nodejs'

const OBJECTIVES = ['Awareness', 'Consideration', 'Conversion']

// GET /api/analytics/talent-roi?view=overview|detail|recommendations &id=<talentId> &month=YYYY-MM
// Tenant-scoped via session. ROI = REAL cost ÷ DUMMY return (every response flags
// costReal/returnDummy). Calls SEQUENTIAL (connection_limit=1).
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'overview'
  const month = searchParams.get('month') || undefined
  const period = month ? { month } : undefined
  const objective = searchParams.get('objective') || 'All'   // C3 — drives quadrant.objectiveView axis/metric labels

  try {
    if (view === 'overview') {
      const overview   = await getTalentRoiOverview(tenantId, period)
      const quadrant   = await getTalentRoiQuadrant(tenantId, period, objective)
      const ranking    = await getTalentRanking(tenantId, period)
      const costVsRet  = await getTalentCostVsReturn(tenantId, period)
      const typePerf   = await getTypePerformance(tenantId, period)
      return NextResponse.json({ overview, quadrant, ranking, costVsReturn: costVsRet, typePerf })
    }

    if (view === 'detail') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const detail = await getTalentDetail(tenantId, id, period)
      if (!detail) return NextResponse.json({ error: 'Talent not found' }, { status: 404 })
      return NextResponse.json(detail)
    }

    if (view === 'recommendations') {
      const rec = await getRecommendations(tenantId, period)
      return NextResponse.json(rec)
    }

    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('TALENT-ROI API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load talent ROI data' }, { status: 500 })
  }
}

// PATCH /api/analytics/talent-roi  body: { talentId, objective }
// Brand-owner objective override (C3). Tenant-scoped, enum-validated server-side;
// flips objectiveInferred → false so a future re-backfill (override-safe helper) won't
// stomp it. Sequential awaits (connection_limit=1). Returns the updated talent.
export async function PATCH(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const talentId = Number(body?.talentId)
  const objective = body?.objective
  if (!Number.isInteger(talentId)) return NextResponse.json({ error: 'talentId required' }, { status: 400 })
  if (!OBJECTIVES.includes(objective)) return NextResponse.json({ error: `objective must be one of ${OBJECTIVES.join(', ')}` }, { status: 400 })

  try {
    // Tenant-scoped write: updateMany on {id, tenantId} can't touch another tenant's talent.
    const res = await prisma.talent.updateMany({
      where: { id: talentId, tenantId },
      data: { objective, objectiveInferred: false },
    })
    if (res.count === 0) return NextResponse.json({ error: 'Talent not found' }, { status: 404 })
    const talent = await prisma.talent.findUnique({
      where: { id: talentId },
      select: { id: true, talentName: true, objective: true, objectiveInferred: true },
    })
    return NextResponse.json({ ok: true, talent })
  } catch (e) {
    console.error('TALENT-ROI PATCH FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to update objective' }, { status: 500 })
  }
}
