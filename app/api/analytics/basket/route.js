import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { getBasketOverview, getAffinityPairs, getProductAffinity } from '@/lib/analytics/basket-summary'

export const runtime = 'nodejs'

// GET /api/analytics/basket?view=overview|affinity &sku=<sku>
// Tenant-scoped via session. REAL co-purchase (Cleora/t2 only); small-sample flagged.
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
      const overview = await getBasketOverview(tenantId)
      const pairs    = await getAffinityPairs(tenantId)
      return NextResponse.json({ overview, pairs })
    }

    if (view === 'affinity') {
      const sku = searchParams.get('sku')
      if (!sku) return NextResponse.json({ error: 'sku required' }, { status: 400 })
      const affinity = await getProductAffinity(tenantId, sku)
      if (!affinity) return NextResponse.json({ error: 'No data' }, { status: 404 })
      return NextResponse.json(affinity)
    }

    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('BASKET API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load basket data' }, { status: 500 })
  }
}
