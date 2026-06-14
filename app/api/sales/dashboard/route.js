import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getMonthRange, currentMonth } from '@/lib/utils'
import { getKpis, getDailySeries, getStatusBreakdown, getPlatformSplit, EXCLUDED_STATUSES } from '@/lib/analytics/dashboard-summary'

export const runtime = 'nodejs'
const round2 = n => Math.round((Number(n) || 0) * 100) / 100

// Merge 'Shopee' + 'shopee' case-insensitively (real Order.platform has both).
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

// GET /api/sales/dashboard?month=YYYY-MM — compact sales monitoring + analysis.
// Tenant-scoped via session. KPIs/series/platform/status reuse dashboard-summary;
// profitability is REAL OrderItem ⋈ Product (hargaCogs) — empty for tenants without it.
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
    const [kpis, daily, statuses, platformsRaw, profitRows] = await Promise.all([
      getKpis(tenantId, period),
      getDailySeries(tenantId, period),
      getStatusBreakdown(tenantId, period),
      getPlatformSplit(tenantId, period),
      // Per-SKU units / revenue / unit-cost (real-sales). Margin = revenue − cogs×units.
      prisma.$queryRaw(Prisma.sql`
        SELECT oi.sku AS sku, COALESCE(p.name, MAX(oi.product_name)) AS name,
               SUM(oi.qty)::int AS units, SUM(oi.subtotal) AS revenue, MAX(p.harga_cogs) AS cogs
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.sku = oi.sku AND p.tenant_id = o.tenant_id
        WHERE o.tenant_id = ${tenantId} AND o.order_date >= ${start} AND o.order_date < ${end}
          AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)}) AND oi.sku IS NOT NULL
        GROUP BY oi.sku, p.name`),
    ])

    const platforms = normalizePlatforms(platformsRaw)

    // Only SKUs with a real unit cost (hargaCogs) get a margin — unmatched bundles
    // (no cogs) are excluded from the profitability/Pareto charts.
    const profitability = profitRows
      .map(r => {
        const units = Number(r.units ?? 0)
        const revenue = round2(r.revenue)
        const cogs = r.cogs != null ? Number(r.cogs) : null
        if (cogs == null || cogs <= 0 || units <= 0) return null
        return {
          sku: r.sku, name: r.name ?? r.sku, units, revenue, cogs: round2(cogs),
          marginPerUnit: round2(revenue / units - cogs),
          marginTotal:   round2(revenue - cogs * units),
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.marginTotal - a.marginTotal)

    return NextResponse.json({ month, kpis, daily, statuses, platforms, profitability, generatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('SALES DASHBOARD FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to load sales dashboard' }, { status: 500 })
  }
}
