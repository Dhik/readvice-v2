import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { getForecastReadiness, getForecast } from '@/lib/analytics/forecast-summary'

export const runtime = 'nodejs'

// GET /api/analytics/forecast?view=readiness|forecast — thin dispatch, tenant-scoped via
// session, sequential awaits (connection_limit=1). Wave 3 §3.4 — honest readiness gate;
// NO forecast values are returned while history < 12 months.
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const view = new URL(request.url).searchParams.get('view') || 'readiness'
  try {
    if (view === 'readiness' || view === 'overview') return NextResponse.json(await getForecastReadiness(tenantId))
    if (view === 'forecast') return NextResponse.json(await getForecast(tenantId))
    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('FORECAST API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load forecast data' }, { status: 500 })
  }
}
