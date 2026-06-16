import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { getClvOverview, getClvDistribution, getClvTiers, getClvCustomers, getCustomerClvDetail } from '@/lib/analytics/clv-summary'

export const runtime = 'nodejs'

// GET /api/analytics/clv?view=overview|detail &username=<u>  — thin dispatch, tenant-scoped
// via session, sequential awaits (connection_limit=1). Wave 3 §3.1: historic value is REAL;
// the forward projection is DUMMY and flagged on every response that carries it.
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'overview'
  try {
    if (view === 'overview') {
      const overview     = await getClvOverview(tenantId)
      const distribution = await getClvDistribution(tenantId)
      const tiers        = await getClvTiers(tenantId)
      const customers    = await getClvCustomers(tenantId)
      return NextResponse.json({ overview, distribution, tiers, customers })
    }
    if (view === 'detail') {
      const username = searchParams.get('username')
      if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 })
      const detail = await getCustomerClvDetail(tenantId, username)
      if (!detail) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      return NextResponse.json(detail)
    }
    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('CLV API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load CLV data' }, { status: 500 })
  }
}
