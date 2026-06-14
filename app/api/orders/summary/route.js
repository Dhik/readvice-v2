import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { getMonthRange, currentMonth } from '@/lib/utils'
import { getOrderAnalysis } from '@/lib/analytics/order-summary'

export const runtime = 'nodejs'

// GET /api/orders/summary?month=YYYY-MM&platform= — KPIs + size dist + status +
// trend for the current filter. Tenant-scoped; reuses getOrderAnalysis (real-sales
// basis; status breakdown is all-statuses). Decimal/BigInt→Number already handled.
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || currentMonth()
  const platform = searchParams.get('platform') || undefined
  const { gte: start, lt: end } = getMonthRange(month)
  const endIncl = new Date(end.getTime() - 1)

  try {
    const a = await getOrderAnalysis(tenantId, { startDate: start, endDate: endIncl, platform })
    const orders = a.kpis.totalOrders
    const gmv = a.kpis.totalRevenue
    return NextResponse.json({
      month, platform: platform ?? null,
      kpis: { orders, gmv, aov: orders > 0 ? Math.round((gmv / orders) * 100) / 100 : 0 },
      sizeUnits: a.sizeDistribution.units,   // [{ bucket, label, orders }]
      statuses:  a.statusBreakdown,          // [{ status, orders, gmv, ordersPct, excluded }]
      trend:     a.timeSeries,               // [{ period, orders, gmv, nett, qty }]
    })
  } catch (e) {
    console.error('ORDERS SUMMARY FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to load orders summary' }, { status: 500 })
  }
}
