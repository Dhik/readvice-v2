import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { getMonthRange, currentMonth } from '@/lib/utils'
import { getKpis, getDailySeries, getStatusBreakdown, getPlatformSplit } from '@/lib/analytics/dashboard-summary'

export const runtime = 'nodejs'
const round2 = n => Math.round((Number(n) || 0) * 100) / 100

// Merge 'Shopee' + 'shopee' case-insensitively.
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

// GET /api/report/summary?month=YYYY-MM — period KPIs + static summary data.
// Tenant-scoped via session. Reuses dashboard-summary; all Decimal/BigInt→Number.
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
    // getKpis already fans out ~8 queries; run it FIRST, then the rest — firing all
    // ~13 at once overwhelms the connection_limit=1 pooler (intermittent invocation
    // errors). Sequencing keeps concurrency ≤8.
    const kpis = await getKpis(tenantId, period)
    const [daily, statuses, platformsRaw] = await Promise.all([
      getDailySeries(tenantId, period),
      getStatusBreakdown(tenantId, period),
      getPlatformSplit(tenantId, period),
    ])
    return NextResponse.json({ month, kpis, daily, statuses, platforms: normalizePlatforms(platformsRaw) })
  } catch (e) {
    console.error('REPORT SUMMARY FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to load report summary' }, { status: 500 })
  }
}
