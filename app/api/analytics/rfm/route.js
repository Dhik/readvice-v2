import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import {
  getRfmOverview, getRfmScatter, getSegmentSummary, getCustomerDetail,
  getRecommendations, advancedFilter, getAvailableDates,
} from '@/lib/analytics/rfm-summary'

export const runtime = 'nodejs'

// GET /api/analytics/rfm?view=overview|customers|detail|recommendations
//   &asOf=YYYY-MM-DD (+ customers filters)
// Tenant-scoped via session (engine re-scopes every read). Engine owns ALL RFM
// logic. Calls are SEQUENTIAL (Supabase pooler is connection_limit=1 — never
// Promise.all a fan-out; see BCG/RFM routes).
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'overview'
  const asOf = searchParams.get('asOf') || undefined   // YYYY-MM-DD; undefined → latest
  const num = (k) => { const v = searchParams.get(k); return v == null || v === '' ? undefined : Number(v) }

  try {
    if (view === 'overview') {
      const dates    = await getAvailableDates(tenantId)
      const overview = await getRfmOverview(tenantId, asOf)
      const segments = await getSegmentSummary(tenantId, asOf)
      const scatter  = await getRfmScatter(tenantId, asOf)
      return NextResponse.json({ dates, overview, segments, scatter })
    }

    if (view === 'customers') {
      const opts = {
        segment:       searchParams.get('segment') || undefined,
        minMonetary:   num('minMonetary'),
        minFrequency:  num('minFrequency'),
        maxRecency:    num('maxRecency'),
        realOnly:      searchParams.get('realOnly') === '1' || undefined,
        search:        searchParams.get('search') || undefined,
        sortBy:        searchParams.get('sortBy') || 'monetary',
        sortDir:       searchParams.get('sortDir') || 'desc',
      }
      const res = await advancedFilter(tenantId, asOf, opts)
      // minRecency isn't an engine opt — post-filter on the engine's output to support
      // a full recency RANGE (keeps the engine authoritative for everything else).
      const minRecency = num('minRecency')
      let items = res.items
      if (minRecency != null) items = items.filter(c => c.recencyDays >= minRecency)
      return NextResponse.json({ ...res, items, count: items.length })
    }

    if (view === 'detail') {
      const key = searchParams.get('key')
      if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })
      const detail = await getCustomerDetail(tenantId, key, asOf)
      if (!detail) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      return NextResponse.json(detail)
    }

    if (view === 'recommendations') {
      const rec = await getRecommendations(tenantId, asOf)
      return NextResponse.json(rec)
    }

    return NextResponse.json({ error: `Unknown view '${view}'` }, { status: 400 })
  } catch (e) {
    console.error('RFM API FAILED:', view, e?.message)
    return NextResponse.json({ error: 'Failed to load RFM data' }, { status: 500 })
  }
}
