import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import {
  getEfficiencyOverview, getEfficiencyQuadrant, getChannelMix, getTieringPerformance,
  getEngagementAnalysis, getTopContent, getBottomContent, getContentDetail,
} from '@/lib/analytics/campaign-efficiency-summary'

export const runtime = 'nodejs'

// GET /api/analytics/campaign-efficiency?view=overview|detail &id=<contentId>
// Tenant-scoped via session (engine re-scopes every read). Engine owns ALL logic;
// real metrics on real fields — GMV is self-reported (flagged), NO attribution.
// Calls SEQUENTIAL (connection_limit=1).
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'overview'

  try {
    if (view === 'overview') {
      const overview   = await getEfficiencyOverview(tenantId)
      const quadrant   = await getEfficiencyQuadrant(tenantId)
      const channelMix = await getChannelMix(tenantId)
      const tiering    = await getTieringPerformance(tenantId)
      const engagement = await getEngagementAnalysis(tenantId)
      const top        = await getTopContent(tenantId, 5)
      const bottom     = await getBottomContent(tenantId, 5)
      return NextResponse.json({ overview, quadrant, channelMix, tiering, engagement, top, bottom })
    }

    if (view === 'detail') {
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const detail = await getContentDetail(tenantId, id)
      if (!detail) return NextResponse.json({ error: 'Content not found' }, { status: 404 })
      return NextResponse.json(detail)
    }

    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('CAMPAIGN-EFFICIENCY API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load campaign efficiency data' }, { status: 500 })
  }
}
