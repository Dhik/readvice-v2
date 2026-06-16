import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { getRoasOverview, getRoasScatter, getRoasTrend, getRoasDetail } from '@/lib/analytics/roas-summary'

export const runtime = 'nodejs'

// GET /api/analytics/roas?view=overview|detail &key=<source> &source=channel|category &month=YYYY-MM
// Thin dispatch, tenant-scoped via session, sequential awaits (connection_limit=1).
// Wave 3 §3.2: SPEND is real (reused from Ads-Allocation); attribution + ROAS are DUMMY.
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
      const overview = await getRoasOverview(tenantId, period)
      const scatter  = await getRoasScatter(tenantId, period)
      const trend    = await getRoasTrend(tenantId, period)
      return NextResponse.json({ overview, scatter, trend })
    }
    if (view === 'detail') {
      const key = searchParams.get('key')
      const source = searchParams.get('source') || 'channel'
      if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })
      const detail = await getRoasDetail(tenantId, key, source, period)
      if (!detail) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
      return NextResponse.json(detail)
    }
    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('ROAS API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load ROAS data' }, { status: 500 })
  }
}
