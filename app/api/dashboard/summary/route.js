import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getMonthRange, currentMonth } from '@/lib/utils'
import { getKpis, getDailySeries, getStatusBreakdown, getPlatformSplit, EXCLUDED_STATUSES } from '@/lib/analytics/dashboard-summary'

export const runtime = 'nodejs'
const round2 = n => Math.round((Number(n) || 0) * 100) / 100

// Real Order.platform has both 'Shopee' (seed) and 'shopee' (connector) — merge
// case-insensitively so the donut doesn't double-count. `_key` is the lowercase
// key for case-insensitive platformColor() lookup on the page.
function normalizePlatforms(rows) {
  const map = new Map()
  for (const r of rows) {
    const key = String(r.platform ?? '').toLowerCase()
    if (!key) continue
    const cur = map.get(key) ?? { _key: key, platform: key.charAt(0).toUpperCase() + key.slice(1), gmv: 0, orders: 0 }
    cur.gmv += r.gmv; cur.orders += r.orders
    map.set(key, cur)
  }
  return [...map.values()].map(p => ({ ...p, gmv: round2(p.gmv) })).sort((a, b) => b.gmv - a.gmv)
}

// GET /api/dashboard/summary?month=YYYY-MM — compact home glance (all real except
// Visit/AdSpend, which are DUMMY-sourced dev data). Tenant-scoped via session.
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || currentMonth()
  const { gte: start, lt: end } = getMonthRange(month)
  const period = { start, end }

  try {
    const [kpis, daily, statuses, platformsRaw, topProducts] = await Promise.all([
      getKpis(tenantId, period),
      getDailySeries(tenantId, period),
      getStatusBreakdown(tenantId, period),
      getPlatformSplit(tenantId, period),
      // Top-5 products (real OrderItem ⋈ Product, real-sales). Empty for tenants
      // without OrderItem data → graceful empty-state on the page.
      prisma.$queryRaw(Prisma.sql`
        SELECT oi.sku AS sku, COALESCE(p.name, MAX(oi.product_name)) AS name,
               SUM(oi.subtotal) AS revenue, SUM(oi.qty)::int AS qty
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.sku = oi.sku AND p.tenant_id = o.tenant_id
        WHERE o.tenant_id = ${tenantId} AND o.order_date >= ${start} AND o.order_date < ${end}
          AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)}) AND oi.sku IS NOT NULL
        GROUP BY oi.sku, p.name
        ORDER BY revenue DESC NULLS LAST
        LIMIT 5`),
    ])

    const platforms = normalizePlatforms(platformsRaw)
    const products = topProducts.map(r => ({
      sku: r.sku, name: r.name ?? r.sku, revenue: round2(r.revenue), qty: Number(r.qty ?? 0),
    }))

    return NextResponse.json({ month, kpis, daily, statuses, platforms, products, generatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('DASHBOARD SUMMARY FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to load dashboard summary' }, { status: 500 })
  }
}
