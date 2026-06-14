import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import {
  getAllocationOverview, getChannelPareto, getCategoryPareto, getSpendShare,
  getSpendTrend, getMoMComparison, getChannelDetail, getCategoryDetail, getDateRange,
} from '@/lib/analytics/ads-allocation-summary'

export const runtime = 'nodejs'

// GET /api/analytics/ads-allocation?view=overview|detail
//   &dim=channel|category &key=<name> &gran=day|week|month
// Tenant-scoped via session (engine re-scopes every read). Engine owns ALL logic;
// 100% real (no ROAS — expense-only). Calls SEQUENTIAL (connection_limit=1).
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'overview'
  const dim  = searchParams.get('dim') === 'category' ? 'category' : 'channel'
  const gran = searchParams.get('gran') || 'day'
  const month = searchParams.get('month') || undefined          // optional period filter
  const period = month ? { month } : undefined

  try {
    if (view === 'overview') {
      // Sequential — each runs its own queries against the pooler. `period` scopes the
      // spend aggregates; MoM + date-range stay FULL-range by design (cross-month / honest).
      const overview    = await getAllocationOverview(tenantId, period)
      const channelPar  = await getChannelPareto(tenantId, period)
      const categoryPar = await getCategoryPareto(tenantId, period)
      const share       = await getSpendShare(tenantId, period)
      const trendCh     = await getSpendTrend(tenantId, { dimension: 'channel', granularity: gran, period })
      const trendCat    = await getSpendTrend(tenantId, { dimension: 'category', granularity: gran, period })
      const momCh       = await getMoMComparison(tenantId, { dimension: 'channel' })
      const momCat      = await getMoMComparison(tenantId, { dimension: 'category' })
      const range       = await getDateRange(tenantId)
      return NextResponse.json({
        overview, range,
        channel:  { pareto: channelPar,  trend: trendCh,  mom: momCh,  share: share.channels,   total: share.socialTotal },
        category: { pareto: categoryPar, trend: trendCat, mom: momCat, share: share.categories, total: share.marketingTotal },
      })
    }

    if (view === 'detail') {
      const key = searchParams.get('key')
      if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })
      const detail = dim === 'category'
        ? await getCategoryDetail(tenantId, key)
        : await getChannelDetail(tenantId, key)
      if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ dim, detail })
    }

    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('ADS-ALLOCATION API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load ads allocation data' }, { status: 500 })
  }
}
