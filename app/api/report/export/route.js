import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getMonthRange, currentMonth } from '@/lib/utils'
import { getKpis, getDailySeries, getStatusBreakdown, getPlatformSplit } from '@/lib/analytics/dashboard-summary'

export const runtime = 'nodejs'
const num = v => Number(v ?? 0)

// GET /api/report/export?month=YYYY-MM — builds a multi-sheet .xlsx (Summary KPIs,
// Daily series, Platforms, Status) server-side and streams it as a download.
// Tenant-scoped via session. NB: Visit/spend-derived figures are DUMMY dev data.
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
    // Sequence getKpis (fans out ~8 queries) before the rest — avoids overwhelming
    // the connection_limit=1 pooler (intermittent invocation errors otherwise).
    const kpis = await getKpis(tenantId, period)
    const [daily, statuses, platformsRaw] = await Promise.all([
      getDailySeries(tenantId, period),
      getStatusBreakdown(tenantId, period),
      getPlatformSplit(tenantId, period),
    ])

    // normalize platform case
    const pmap = new Map()
    for (const r of platformsRaw) {
      const key = String(r.platform ?? '').toLowerCase(); if (!key) continue
      const cur = pmap.get(key) ?? { platform: key.charAt(0).toUpperCase() + key.slice(1), gmv: 0, orders: 0 }
      cur.gmv += num(r.gmv); cur.orders += num(r.orders); pmap.set(key, cur)
    }

    const c = kpis.current
    const summarySheet = [
      { Metric: 'Period',        Value: `${kpis.filters.start} → ${kpis.filters.end}` },
      { Metric: 'Total Sales',   Value: c.sales },
      { Metric: 'Orders',        Value: c.orders },
      { Metric: 'Qty',           Value: c.qty },
      { Metric: 'Visit (dummy)', Value: c.visits },
      { Metric: 'Total Spent (dummy)', Value: c.totalSpent },
      { Metric: 'ROAS (dummy)',  Value: c.roas },
      { Metric: 'Closing Rate % (dummy)', Value: c.closingRate },
      { Metric: 'CPA (dummy)',   Value: c.cpa },
    ]
    const dailySheet = daily.map(d => ({
      Date: d.date, Sales: d.turnover, Orders: d.order, Qty: d.qty,
      'Ad Spent (dummy)': d.ad_spent_total, 'ROAS (dummy)': d.roas, 'Closing % (dummy)': d.closing_rate,
    }))
    const platformSheet = [...pmap.values()].sort((a, b) => b.gmv - a.gmv).map(p => ({ Platform: p.platform, GMV: p.gmv, Orders: p.orders }))
    const statusSheet = statuses.map(s => ({ Status: s.status, Orders: s.orders, GMV: s.gmv, '% of orders': s.ordersPct, Excluded: s.excluded ? 'yes' : '' }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summarySheet), 'Summary')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailySheet.length ? dailySheet : [{ Date: '', Sales: 0 }]), 'Daily')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(platformSheet.length ? platformSheet : [{ Platform: '', GMV: 0 }]), 'Platforms')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statusSheet.length ? statusSheet : [{ Status: '', Orders: 0 }]), 'Status')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sales-report-${month}.xlsx"`,
        'Content-Length': String(buf.length),
      },
    })
  } catch (e) {
    console.error('REPORT EXPORT FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 })
  }
}
