import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { getPnlWaterfall, getPnlTrend } from '@/lib/analytics/pnl-summary'

export const runtime = 'nodejs'

// GET /api/analytics/pnl?view=overview &month=YYYY-MM — thin dispatch, tenant-scoped,
// sequential awaits (connection_limit=1). Wave 3 §3.3: real revenue/COGS/marketing,
// config fee/tax, user-entered opex — NET is gated "before opex" until opex is entered.
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
      const waterfall = await getPnlWaterfall(tenantId, period)
      const trend     = await getPnlTrend(tenantId, period)
      return NextResponse.json({ waterfall, trend })
    }
    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('PNL API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load P&L data' }, { status: 500 })
  }
}
