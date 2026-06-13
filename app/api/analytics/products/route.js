import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { getProductAnalysis } from '@/lib/analytics/product-summary'

export const runtime = 'nodejs'

// GET /api/analytics/products — per-product sales aggregate (SP1).
// Tenant-scoped to the caller's active tenant (session only — no tenantId param,
// incl. for superadmins, who operate on their currently-selected tenant).
// Query: startDate?, endDate?, platform?  (defaults: last 40 days, all platforms)
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)

  try {
    const data = await getProductAnalysis(tenantId, {
      startDate: searchParams.get('startDate') || undefined,
      endDate:   searchParams.get('endDate')   || undefined,
      platform:  searchParams.get('platform')  || undefined,
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('PRODUCT ANALYSIS FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to load product analysis' }, { status: 500 })
  }
}
