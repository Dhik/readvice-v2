import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import {
  getTalentRoiOverview, getTalentRoiQuadrant, getTalentRanking, getTalentCostVsReturn,
  getTypePerformance, getTalentDetail, getRecommendations,
} from '@/lib/analytics/talent-roi-summary'

export const runtime = 'nodejs'

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

  try {
    if (view === 'overview') {
      const overview   = await getTalentRoiOverview(tenantId, period)
      const quadrant   = await getTalentRoiQuadrant(tenantId, period)
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
