import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getMonthRange, currentMonth } from '@/lib/utils'
import { getOrderAnalysis } from '@/lib/analytics/order-summary'
import { EXCLUDED_STATUSES } from '@/lib/hpp/compute-hpp'

export const runtime = 'nodejs'
const round2 = n => Math.round((Number(n) || 0) * 100) / 100

// GET /api/customers/summary?month=YYYY-MM — customers AGGREGATED BY customer
// (not raw order rows). Real-sales basis, tenant-scoped. customerId is null →
// identity = customer_username; only ~half of orders carry one (coverage labeled).
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || currentMonth()
  const { gte: start, lt: end } = getMonthRange(month)
  const endIncl = new Date(end.getTime() - 1)

  try {
    const [rows, analysis] = await Promise.all([
      // One row per customer (username), real-sales.
      prisma.$queryRaw(Prisma.sql`
        SELECT o.customer_username AS username,
               MAX(o.customer_name) AS name,
               COUNT(*)::int        AS orders,
               SUM(o.gmv)           AS gmv,
               MAX(o.order_date)     AS last_order,
               string_agg(DISTINCT lower(o.platform), ', ') AS platforms
        FROM orders o
        WHERE o.tenant_id = ${tenantId} AND o.order_date >= ${start} AND o.order_date <= ${endIncl}
          AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)}) AND o.customer_username IS NOT NULL
        GROUP BY o.customer_username
        ORDER BY gmv DESC`),
      // Reused for new-vs-returning order counts + the coverage denominator.
      getOrderAnalysis(tenantId, { startDate: start, endDate: endIncl }),
    ])

    const customers = rows.map(r => ({
      username:  r.username,
      name:      r.name ?? r.username,
      orders:    Number(r.orders ?? 0),
      gmv:       round2(r.gmv),
      lastOrder: r.last_order ? new Date(r.last_order).toISOString().slice(0, 10) : null,
      platforms: r.platforms ?? '',
    }))

    const totalCustomers   = customers.length
    const repeatCount      = customers.filter(c => c.orders > 1).length
    const ordersWithCustomer = customers.reduce((a, c) => a + c.orders, 0)
    const totalOrders      = analysis.kpis.totalOrders // real-sales total (coverage denom)
    const cs = analysis.customerSplit

    return NextResponse.json({
      month,
      kpis: {
        totalCustomers,
        repeatCount,
        repeatPct:  totalCustomers > 0 ? round2((repeatCount / totalCustomers) * 100) : 0,
        avgOrders:  totalCustomers > 0 ? round2(ordersWithCustomer / totalCustomers) : 0,
        coveragePct: totalOrders > 0 ? round2((ordersWithCustomer / totalOrders) * 100) : 0,
        ordersWithCustomer,
        totalOrders,
      },
      split: { ordersFromNew: cs.ordersFromNew, ordersFromReturning: cs.ordersFromReturning },
      customers, // sorted by gmv desc — page derives Lorenz + top-N + table
    })
  } catch (e) {
    console.error('CUSTOMERS SUMMARY FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to load customers summary' }, { status: 500 })
  }
}
