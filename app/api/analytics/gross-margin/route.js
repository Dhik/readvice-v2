import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import {
  getMarginOverview, getMarginByProduct, getMarginPareto, getMarginTrend,
  getMarginWaterfall, getProductMarginDetail,
} from '@/lib/analytics/gross-margin-summary'

export const runtime = 'nodejs'

// GET /api/analytics/gross-margin?view=overview|detail &sku=<sku> &month=YYYY-MM
// Tenant-scoped via session (engine re-scopes). GROSS margin only (revenue − HPP) —
// 100% real, NO net profit. Calls SEQUENTIAL (connection_limit=1).
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
      const overview  = await getMarginOverview(tenantId, period)
      const waterfall = await getMarginWaterfall(tenantId, period)
      const pareto    = await getMarginPareto(tenantId, period)
      const byProduct = await getMarginByProduct(tenantId, period)
      const trend     = await getMarginTrend(tenantId, period)
      return NextResponse.json({ overview, waterfall, pareto, byProduct, trend })
    }

    if (view === 'detail') {
      const sku = searchParams.get('sku')
      if (!sku) return NextResponse.json({ error: 'sku required' }, { status: 400 })
      const detail = await getProductMarginDetail(tenantId, sku, period)
      if (!detail) return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
      return NextResponse.json(detail)
    }

    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('GROSS-MARGIN API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load gross margin data' }, { status: 500 })
  }
}
