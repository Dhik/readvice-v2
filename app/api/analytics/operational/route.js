import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import {
  getOperationalOverview, getStatusFunnel, getCancellationTrend, getStockVelocityQuadrant,
  getFulfillmentDistribution, getProductStockDetail,
} from '@/lib/analytics/operational-summary'

export const runtime = 'nodejs'

// GET /api/analytics/operational?view=overview|detail &sku=<sku>
// Tenant-scoped via session. MIXED: funnel/cancellation/stock-velocity REAL (dummy:false);
// fulfilment histogram DUMMY (dummy:true). Calls SEQUENTIAL (connection_limit=1).
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'overview'

  try {
    if (view === 'overview') {
      const overview = await getOperationalOverview(tenantId)
      const funnel   = await getStatusFunnel(tenantId)
      const cancel   = await getCancellationTrend(tenantId)
      const velocity = await getStockVelocityQuadrant(tenantId)
      const fulfil   = await getFulfillmentDistribution(tenantId)
      return NextResponse.json({ overview, funnel, cancel, velocity, fulfil })
    }

    if (view === 'detail') {
      const sku = searchParams.get('sku')
      if (!sku) return NextResponse.json({ error: 'sku required' }, { status: 400 })
      const detail = await getProductStockDetail(tenantId, sku)
      if (!detail) return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
      return NextResponse.json(detail)
    }

    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('OPERATIONAL API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load operational data' }, { status: 500 })
  }
}
