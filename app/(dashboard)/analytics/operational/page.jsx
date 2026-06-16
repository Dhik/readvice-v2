'use client'
// Operational — deep analysis (Analytics). Wave 2 §2.2, MIXED honesty: status funnel +
// stock-velocity quadrant + cancellation trend are REAL (plain); fulfilment histogram is
// DUMMY (orange-banded, Talent-ROI style). Small per-section note, NOT one big banner.
// 4 distinct chart forms. All logic in the engine via /api/analytics/operational.
import { useEffect, useMemo, useState, useCallback } from 'react'
import CompactPage from '@/components/dashboard/CompactPage'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import { StatusFunnel, StockVelocityQuadrant, CancellationTrend, FulfillmentHistogram, stockQuadColor, DUMMY_COLOR } from '@/components/operational/OperationalCharts'
import StockDetailModal, { StockBadge } from '@/components/operational/StockDetailModal'
import { formatNumber, formatCurrency } from '@/lib/utils'

const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

function toCsv(rows) {
  const cols = [['sku', 'SKU'], ['name', 'Name'], ['qtySold', 'UnitsSold'], ['stock', 'Stock'], ['stockTurnover', 'Turnover'], ['quadrant', 'Action']]
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.map(c => c[1]).join(','), ...rows.map(r => cols.map(c => esc(r[c[0]])).join(','))].join('\n')
}
function download(name, content, type) {
  const blob = new Blob([content], { type }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function OperationalPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchJson('/api/analytics/operational?view=overview').then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const openDetail = useCallback((sku) => {
    fetchJson(`/api/analytics/operational?view=detail&sku=${encodeURIComponent(sku)}`).then(d => d && setDetail(d))
  }, [])

  const ov = data?.overview
  const real = ov?.real
  const ful = ov?.fulfillment
  const funnel = data?.funnel
  const cancel = data?.cancel
  const velocity = data?.velocity
  const fulfilDist = data?.fulfil
  const hasData = ov?.hasData

  // Stock grid rows from quadrant points.
  const gridRows = useMemo(() => (velocity?.points ?? []).map(p => ({
    sku: p.sku, name: p.name, qtySold: p.x, stock: p.y, stockTurnover: p.stockTurnover, quadrant: p.quadrant, revenue: p.revenue,
  })), [velocity])

  // Headline cancellation insight (improving trend).
  const cancelInsight = useMemo(() => {
    const pts = cancel?.points ?? []
    if (pts.length < 2) return null
    return { first: pts[0], last: pts[pts.length - 1], improving: pts[pts.length - 1].rate < pts[0].rate }
  }, [cancel])

  const tiles = [
    { icon: 'fa-cart-shopping', bg: '#2C3639', label: 'Total Orders', value: formatNumber(real?.totalOrders ?? 0) },
    { icon: 'fa-ban', bg: '#dc3545', label: 'Cancellation Rate', value: real?.cancellationRate != null ? `${real.cancellationRate}%` : '—' },
    { icon: 'fa-truck-fast', bg: '#22c55e', iconColor: '#0b3d1b', label: 'Delivered', value: formatNumber(real?.deliveredCount ?? 0) },
    { icon: 'fa-rotate', bg: '#E07B39', label: 'Reorder Candidates', value: formatNumber(real?.reorderCount ?? 0) },
    { icon: 'fa-warehouse', bg: '#6B8E9E', label: 'Stock Coverage', value: real?.stockCoveragePct != null ? `${real.stockCoveragePct}%` : '—' },
    { icon: 'fa-clock', bg: DUMMY_COLOR, label: 'Avg Fulfilment', value: ful?.avgTotalDays != null ? `${ful.avgTotalDays}d` : '—', dev: true },
  ]

  const columns = useMemo(() => [
    { key: 'sku', label: 'SKU', searchable: true, sortable: true, render: r => <span className="font-mono text-[10px]">{r.sku}</span> },
    { key: 'name', label: 'Product', searchable: true, sortable: true, sortType: 'string', render: r => <span className="truncate block max-w-[280px]" title={r.name}>{r.name}</span> },
    { key: 'qtySold', label: 'Units Sold', sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
    { key: 'stock', label: 'Stock', sortable: true, sortType: 'number', align: 'right', render: r => r.stock === 0 ? <span className="text-orange/80" title="Stock not tracked">0</span> : formatNumber(r.stock) },
    { key: 'stockTurnover', label: 'Turnover', sortable: true, sortType: 'number', align: 'right', render: r => r.stockTurnover != null ? `${r.stockTurnover}×` : <span className="text-dark1/30">—</span> },
    { key: 'quadrant', label: 'Action', filter: 'select', sortable: true, render: r => <StockBadge quadrant={r.quadrant} small /> },
  ], [])

  if (!loading && !hasData) {
    return (
      <CompactPage>
        <CompactTopbar title="Operational" icon="fa-gears" />
        <div className="flex flex-col items-center justify-center text-center gap-2 py-20 text-dark1/50">
          <i className="fas fa-box-open text-3xl text-dark1/20" />
          <div className="text-sm font-semibold text-dark1/70">No orders for this tenant</div>
          <div className="text-xs max-w-md">Operational analysis needs order data (tenant 2 / Cleora in dev).</div>
        </div>
      </CompactPage>
    )
  }

  return (
    <CompactPage>
      <CompactTopbar title="Operational" icon="fa-gears"
        actions={<button onClick={() => download('operational-stock.csv', toCsv(gridRows), 'text/csv')} className="sv-tbtn sv-tbtn-ghost"><i className="fas fa-file-csv" /> CSV</button>}>
        <span className="text-[10px] text-dark1/45">Efficiency lens · all orders</span>
      </CompactTopbar>

      {/* Small per-section note — NOT a full banner (most sections are real) */}
      <div className="flex items-start gap-2 rounded-lg border border-cream bg-bg/60 px-3 py-1.5 text-[11px] text-dark1/80">
        <i className="fas fa-circle-info text-dark2 mt-0.5" />
        <span>Status funnel, stock velocity &amp; cancellation = <b>real</b>. <b style={{ color: DUMMY_COLOR }}>Fulfilment timing = DUMMY</b> (no per-status timestamps exist) — the orange-banded section below. Efficiency lens (not the dashboard status breakdown).</span>
      </div>

      <IconKpiStrip tiles={tiles} />

      {/* FUNNEL + TREND (both REAL, plain) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title="Order pipeline — status funnel" icon="fa-filter"
          headerRight={funnel ? <span className="text-[9px] text-red-500 font-semibold">{funnel.cancelled.count} cancelled ({funnel.cancelled.pct}%)</span> : null} bodyClass="p-2">
          {loading ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : <StatusFunnel stages={funnel.stages} cancelled={funnel.cancelled} height={280} />}
        </CompactPanel>

        <CompactPanel title="Cancellation rate over time" icon="fa-chart-line"
          headerRight={cancelInsight ? <span className={`text-[9px] font-semibold ${cancelInsight.improving ? 'text-green-600' : 'text-red-500'}`}>{cancelInsight.first.rate}% → {cancelInsight.last.rate}% {cancelInsight.improving ? '↓ improving' : '↑'}</span> : null}
          bodyClass="p-2">
          {loading ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : !cancel?.points?.length ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">No data.</div>
            : <>
                <CancellationTrend points={cancel.points} height={cancel.note ? 256 : 280} />
                {cancel.note && <div className="text-[10px] text-orange/90 mt-1"><i className="fas fa-triangle-exclamation" /> {cancel.note}</div>}
              </>}
        </CompactPanel>
      </div>

      {/* QUADRANT (REAL) — honest about 0% stock coverage */}
      <CompactPanel title="Stock velocity — inventory action quadrant" icon="fa-warehouse"
        headerRight={velocity ? <span className="text-[9px] text-dark1/45">{velocity.skuCount} SKUs · stock coverage {velocity.stockCoveragePct}%</span> : null}
        bodyClass="p-2">
        {velocity?.note && (
          <div className="text-[11px] text-orange/90 bg-orange/10 border border-orange/30 rounded px-2 py-1.5 mb-2">
            <i className="fas fa-circle-info" /> {velocity.note}
          </div>
        )}
        {loading ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : !velocity?.points?.length ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">No SKU data.</div>
          : <StockVelocityQuadrant points={velocity.points} medianQty={velocity.medianQty} medianStock={velocity.medianStock} coveragePct={velocity.stockCoveragePct} height={440} onSelect={openDetail} />}
        {velocity && <div className="flex gap-3 mt-1 text-[10px] text-dark1/55">{Object.entries(velocity.counts).map(([q, n]) => <span key={q}><span className="inline-block w-2 h-2 rounded-sm mr-1 align-middle" style={{ background: stockQuadColor(q) }} />{q}: {n}</span>)}</div>}
      </CompactPanel>

      {/* HISTOGRAM (DUMMY) — orange-banded section (Talent-ROI style) */}
      <CompactPanel title="Fulfilment-time distribution" icon="fa-clock"
        className="border-2" style={{ borderColor: `${DUMMY_COLOR}66`, background: `${DUMMY_COLOR}08` }}
        headerRight={<span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold" style={{ background: `${DUMMY_COLOR}22`, color: DUMMY_COLOR }}>dummy</span>}
        bodyClass="p-2">
        <div className="text-[11px] mb-2" style={{ color: '#9a4f1f' }}>
          <i className="fas fa-triangle-exclamation" /> <b>Fabricated for layout</b> — Order has no per-status timestamps, so processing/shipping/total days don&apos;t exist. {fulfilDist ? `avg ${fulfilDist.avgTotalDays}d (proc ${fulfilDist.avgProcessingDays}d + ship ${fulfilDist.avgShippingDays}d), ${formatNumber(fulfilDist.ordersWithFulfillment)} orders.` : ''}
        </div>
        {loading ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : !fulfilDist?.bins?.length ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">No fulfilment data.</div>
          : <FulfillmentHistogram bins={fulfilDist.bins} height={280} />}
      </CompactPanel>

      {/* Stock DataGrid (REAL) */}
      <CompactPanel title={`Products — ${gridRows.length} SKUs`} icon="fa-table"
        headerRight={<span className="text-[9px] text-dark1/45">turnover real where stock&gt;0 · <span className="text-orange/80">stock 0 = untracked</span></span>}
        bodyClass="p-2">
        <DataGrid data={gridRows} columns={columns} searchable onRowClick={r => openDetail(r.sku)}
          defaultSort={{ key: 'qtySold', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No SKU sales." />
        <p className="text-[10px] text-dark1/40 mt-1">Stock / units / turnover are real (turnover where stock&gt;0). Click a row for the breakdown.</p>
      </CompactPanel>

      {detail && <StockDetailModal detail={detail} onClose={() => setDetail(null)} />}
      <AnalyticsAIPanel module="operational" context={data}
        suggestions={['What is the cancellation trend?', 'Is the fulfilment time real?']} />
    </CompactPage>
  )
}
