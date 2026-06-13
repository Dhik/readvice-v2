import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { getOrderAnalysis } from '@/lib/analytics/order-summary'

export const runtime = 'nodejs'

// GET /api/analytics/orders — order-level temporal analysis (SP2).
// Tenant-scoped to the caller's active tenant (session only — no tenantId param,
// incl. for superadmins, who operate on their currently-selected tenant).
// Query: startDate?, endDate?, platform?, granularity? (day|week|month; default day)
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)

  try {
    const data = await getOrderAnalysis(tenantId, {
      startDate:   searchParams.get('startDate')   || undefined,
      endDate:     searchParams.get('endDate')     || undefined,
      platform:    searchParams.get('platform')    || undefined,
      granularity: searchParams.get('granularity') || undefined,
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('ORDER ANALYSIS FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to load order analysis' }, { status: 500 })
  }
}
