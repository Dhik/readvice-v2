import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import {
  getBcgChartData, getCtrChartData, getQuadrantSummary, getProductDetail,
  getRecommendations, getCtrRecommendations, getOverviewKpis, advancedFilter,
  getAvailableMonths,
} from '@/lib/analytics/bcg-summary'

export const runtime = 'nodejs'

// GET /api/analytics/bcg?view=overview|products|detail|recommendations
//   &month=YYYY-MM-01 &lens=traffic|ctr  (+ products filters)
// Tenant-scoped via session (engine also re-scopes every read). The engine owns
// ALL BCG logic — this route only marshals params and serializes the calls
// (sequential awaits, NOT Promise.all: the Supabase pooler is connection_limit=1).
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const view  = searchParams.get('view') || 'overview'
  const lens  = searchParams.get('lens') === 'ctr' ? 'ctr' : 'traffic'
  const month = searchParams.get('month') || undefined   // YYYY-MM-01; undefined → latest

  try {
    if (view === 'overview') {
      // Sequential — each call runs its own loadMonth query.
      const months = await getAvailableMonths(tenantId)
      const kpis   = await getOverviewKpis(tenantId, month)
      const quad   = await getQuadrantSummary(tenantId, month)
      const chart  = lens === 'ctr'
        ? await getCtrChartData(tenantId, month)
        : await getBcgChartData(tenantId, month)
      return NextResponse.json({ lens, months, kpis, quad, chart })
    }

    if (view === 'products') {
      // Map UI filters → engine opts. quadrant filters the lens-appropriate field.
      const num = (k) => { const v = searchParams.get(k); return v == null || v === '' ? undefined : Number(v) }
      const quadrant = searchParams.get('quadrant') || undefined
      const opts = {
        [lens === 'ctr' ? 'ctrQuadrant' : 'quadrant']: quadrant,
        minSales:      num('minSales'),
        minConversion: num('minConversion'),
        search:        searchParams.get('search') || undefined,
        sortBy:        searchParams.get('sortBy') || 'sales',
        sortDir:       searchParams.get('sortDir') || 'desc',
      }
      const res = await advancedFilter(tenantId, month, opts)
      // maxRoas isn't a BCG formula (not in the engine) — apply as a post-filter on
      // the engine's already-computed roas. Keeps engine authoritative for everything else.
      const maxRoas = num('maxRoas')
      let items = res.items
      if (maxRoas != null) items = items.filter(p => p.roas <= maxRoas)
      return NextResponse.json({ ...res, lens, items, count: items.length })
    }

    if (view === 'detail') {
      const sku = searchParams.get('sku')
      if (!sku) return NextResponse.json({ error: 'sku required' }, { status: 400 })
      const detail = await getProductDetail(tenantId, sku, month)
      if (!detail) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      return NextResponse.json(detail)
    }

    if (view === 'recommendations') {
      const rec = lens === 'ctr'
        ? await getCtrRecommendations(tenantId, month)
        : await getRecommendations(tenantId, month)
      return NextResponse.json(rec)
    }

    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('BCG API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load BCG data' }, { status: 500 })
  }
}
