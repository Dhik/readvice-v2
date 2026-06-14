import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { getCohortGrid, getCohortOverview, getCohortTrend, getCohortDetail } from '@/lib/analytics/cohort-summary'

export const runtime = 'nodejs'

// GET /api/analytics/cohort?view=overview|detail &cohort=YYYY-MM
// Tenant-scoped via session. Time-based retention; only the latest cohort's period-0 is
// REAL — everything else DUMMY (cell-level flags). Calls SEQUENTIAL (connection_limit=1).
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'overview'

  try {
    if (view === 'overview') {
      const overview = await getCohortOverview(tenantId)
      const grid     = await getCohortGrid(tenantId)
      const trend    = await getCohortTrend(tenantId)
      return NextResponse.json({ overview, grid, trend })
    }

    if (view === 'detail') {
      const cohort = searchParams.get('cohort')
      if (!cohort) return NextResponse.json({ error: 'cohort required' }, { status: 400 })
      const detail = await getCohortDetail(tenantId, cohort)
      if (!detail) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 })
      return NextResponse.json(detail)
    }

    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('COHORT API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load cohort data' }, { status: 500 })
  }
}
