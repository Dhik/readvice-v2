'use client'
import { useEffect, useRef, useState } from 'react'
import { Line, Doughnut, Bubble, Chart } from 'react-chartjs-2'
import * as XLSX from 'xlsx'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import ImportModal from '@/components/ui/ImportModal'
import SyncButton from '@/components/ui/SyncButton'
import CrossLink from '@/components/dashboard/CrossLink'
import { seriesColor, platformColor, withAlpha, SEMANTIC, baseOptions, mergeOptions, zoomReady } from '@/lib/charts/theme'
import { formatCurrency, formatNumber, currentMonth } from '@/lib/utils'

const shortRp = (v) => { const n = Number(v) || 0; const s = n < 0 ? '-' : ''; const a = Math.abs(n); if (a >= 1e9) return s + (a / 1e9).toFixed(1) + 'B'; if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return s + (a / 1e3).toFixed(0) + 'K'; return s + Math.round(a) }
const fmtX  = v => v == null ? '—' : `${Number(v).toFixed(2)}×`
const fmtPct = v => v == null ? '—' : `${Number(v).toFixed(2)}%`
const Empty = ({ text = 'No data', h = 140 }) => <div style={{ height: h }} className="flex items-center justify-center text-dark1/30 text-xs px-3 text-center">{text}</div>

// Recap line metrics.
const METRICS = [
  { k: 'turnover',       l: 'Sales',     fmt: formatCurrency, ci: 0 },
  { k: 'order',          l: 'Orders',    fmt: formatNumber,   ci: 5 },
  { k: 'qty',            l: 'Qty',       fmt: formatNumber,   ci: 3 },
  { k: 'ad_spent_total', l: 'Ad Spent',  fmt: formatCurrency, ci: 7, dev: true },
  { k: 'roas',           l: 'ROAS',      fmt: fmtX,           ci: 6, dev: true },
  { k: 'closing_rate',   l: 'Closing %', fmt: fmtPct,         ci: 2, dev: true },
]

export default function SalesPage() {
  const [month, setMonth]     = useState(currentMonth())
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [metric, setMetric]   = useState('turnover')
  const [zoomOn, setZoomOn]   = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const recapRef = useRef(null)

  useEffect(() => { zoomReady.then(setZoomOn) }, [])
  useEffect(() => {
    setLoading(true)
    fetch(`/api/sales/dashboard?month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d?.error ? null : d); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [month, refresh])

  const k = data?.kpis?.current ?? {}
  const dlt = data?.kpis?.deltas ?? {}
  const daily = data?.daily ?? []
  const platforms = data?.platforms ?? []
  const statuses = data?.statuses ?? []
  const profit = data?.profitability ?? []

  // ── Export current month's daily series + KPI summary to Excel ──
  function exportExcel() {
    const rows = daily.map(d => ({ Date: d.date, Sales: d.turnover, Orders: d.order, Qty: d.qty, 'Ad Spent': d.ad_spent_total, ROAS: d.roas, 'Closing %': d.closing_rate }))
    const kpiRows = Object.entries(k).map(([metric, value]) => ({ Metric: metric, Value: value }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Daily')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), 'KPIs')
    XLSX.writeFile(wb, `sales-${month}.xlsx`)
  }

  // ── 8 KPI tiles (visit/spent-derived = dummy → dev) ──
  const tiles = [
    { icon: 'fa-dollar-sign', bg: '#E07B39', label: 'Total Sales',  value: formatCurrency(k.sales ?? 0), delta: dlt.sales?.pct },
    { icon: 'fa-receipt',     bg: '#2C3639', label: 'Order',        value: formatNumber(k.orders ?? 0),  delta: dlt.orders?.pct },
    { icon: 'fa-boxes-stacked', bg: '#C9A66B', iconColor: '#2C3639', label: 'Qty',  value: formatNumber(k.qty ?? 0), delta: dlt.qty?.pct },
    { icon: 'fa-eye',         bg: '#3F4E4F', label: 'Visit',        value: formatNumber(k.visits ?? 0),  delta: dlt.visits?.pct, dev: true },
    { icon: 'fa-credit-card', bg: '#8B5E3C', label: 'Total Spent',  value: formatCurrency(k.totalSpent ?? 0), delta: dlt.totalSpent?.pct, dev: true },
    { icon: 'fa-bullseye',    bg: '#6B8E9E', label: 'ROAS',         value: fmtX(k.roas),                 delta: dlt.roas?.pct, dev: true },
    { icon: 'fa-percent',     bg: '#A9C5A0', iconColor: '#2C3639', label: 'Closing Rate', value: fmtPct(k.closingRate), delta: dlt.closingRate?.pct, dev: true },
    { icon: 'fa-coins',       bg: '#B5645B', label: 'CPA',          value: formatCurrency(k.cpa ?? 0),   delta: dlt.cpa?.pct, dev: true },
  ]

  // ── Recap line (selected metric) + x-axis zoom ──
  const mDef = METRICS.find(m => m.k === metric) ?? METRICS[0]
  const recapData = daily.length ? {
    labels: daily.map(d => d.date.slice(8)),
    datasets: [{ label: mDef.l, data: daily.map(d => d[mDef.k]), borderColor: seriesColor(mDef.ci), backgroundColor: withAlpha(seriesColor(mDef.ci), 0.15), fill: true, tension: 0.3, pointRadius: 1 }],
  } : null
  const isMoney = mDef.fmt === formatCurrency
  const recapOpts = mergeOptions(baseOptions, {
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { title: i => `Day ${i[0]?.label}`, label: c => `${mDef.l}: ${mDef.fmt(c.parsed.y)}` } },
      ...(zoomOn ? { zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }, pan: { enabled: true, mode: 'x' }, limits: { x: { min: 'original', max: 'original' } } } } : {}),
    },
    scales: { y: { ticks: { callback: v => isMoney ? shortRp(v) : v, font: { size: 9 } } }, x: { ticks: { font: { size: 9 }, maxTicksLimit: 12 } } },
  })

  // ── Platform donut (case-normalized) ──
  const totalPlat = platforms.reduce((a, p) => a + p.gmv, 0) || 1
  const platDonut = platforms.length ? { labels: platforms.map(p => p.platform), datasets: [{ data: platforms.map(p => p.gmv), backgroundColor: platforms.map(p => platformColor(p._key)) }] } : null
  const platOpts = mergeOptions(baseOptions, { cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, font: { size: 9 } } }, tooltip: { callbacks: { label: c => ` ${formatCurrency(c.parsed)} (${Math.round((c.parsed / totalPlat) * 1000) / 10}%)` } } } })

  // ── Profitability quadrant (bubble) — x=units, y=margin/unit, r=revenue, color=quadrant ──
  const medU = profit.length ? [...profit].map(p => p.units).sort((a, b) => a - b)[Math.floor(profit.length / 2)] : 0
  const medM = profit.length ? [...profit].map(p => p.marginPerUnit).sort((a, b) => a - b)[Math.floor(profit.length / 2)] : 0
  const maxRev = profit.reduce((m, p) => Math.max(m, p.revenue), 1)
  const quadColor = p => (p.units >= medU && p.marginPerUnit >= medM) ? SEMANTIC.success
    : (p.marginPerUnit >= medM) ? seriesColor(0)
    : (p.units >= medU) ? seriesColor(8) : 'rgba(120,120,120,0.5)'
  const bubbleData = profit.length ? {
    datasets: [{
      data: profit.map(p => ({ x: p.units, y: p.marginPerUnit, r: 4 + 16 * (p.revenue / maxRev), _p: p })),
      backgroundColor: profit.map(p => withAlpha(quadColor(p), 0.6)),
      borderColor: profit.map(p => quadColor(p)), borderWidth: 1,
    }],
  } : null
  const bubbleOpts = mergeOptions(baseOptions, {
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: c => { const p = c.raw._p; return [p.name, `Units: ${formatNumber(p.units)}`, `Margin/unit: ${formatCurrency(p.marginPerUnit)}`, `Revenue: ${formatCurrency(p.revenue)}`] } } },
    },
    scales: {
      x: { title: { display: true, text: 'Units sold', font: { size: 9 } }, ticks: { font: { size: 9 } }, beginAtZero: true },
      y: { title: { display: true, text: 'Margin / unit (IDR)', font: { size: 9 } }, ticks: { callback: v => shortRp(v), font: { size: 9 } } },
    },
  })

  // ── Margin Pareto — by margin contribution + cumulative % + 80% ref ──
  const totalMargin = profit.reduce((a, p) => a + p.marginTotal, 0) || 1
  // cumulative % per SKU (no render-time reassignment — small list, O(n²) is fine)
  const cum = profit.map((_, i) =>
    Math.round((profit.slice(0, i + 1).reduce((a, p) => a + p.marginTotal, 0) / totalMargin) * 1000) / 10)
  const paretoData = profit.length ? {
    labels: profit.map(p => p.name),
    datasets: [
      { type: 'bar',  label: 'Margin', data: profit.map(p => p.marginTotal), yAxisID: 'y', order: 3, backgroundColor: withAlpha(seriesColor(0), 0.85) },
      { type: 'line', label: 'Cumulative %', data: cum, yAxisID: 'y1', order: 1, borderColor: seriesColor(1), backgroundColor: seriesColor(1), tension: 0.2, pointRadius: 1, fill: false },
      { type: 'line', label: '80%', data: profit.map(() => 80), yAxisID: 'y1', order: 2, borderColor: SEMANTIC.warning, borderDash: [4, 3], borderWidth: 1, pointRadius: 0, fill: false },
    ],
  } : null
  const paretoOpts = mergeOptions(baseOptions, {
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { filter: i => i.datasetIndex === 0, callbacks: { title: i => profit[i[0]?.dataIndex]?.name ?? '', label: c => { const p = profit[c.dataIndex]; return p ? [`Margin: ${formatCurrency(p.marginTotal)}`, `Cumulative: ${cum[c.dataIndex]}%`] : '' } } },
    },
    scales: {
      x: { ticks: { display: false }, grid: { display: false } },
      y:  { type: 'linear', position: 'left', title: { display: true, text: 'Margin (IDR)', font: { size: 9 } }, grid: { drawOnChartArea: true }, ticks: { callback: v => shortRp(v), font: { size: 9 } } },
      y1: { type: 'linear', position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%', font: { size: 9 } } },
    },
  })

  return (
    <CompactPage>
      <CompactTopbar title="Sales" icon="fa-chart-line"
        actions={<>
          <CrossLink href="/analytics/gross-margin" label="View full analysis" />
          <button onClick={() => setShowImport(true)} className="sv-tbtn sv-tbtn-ghost"><i className="fas fa-upload" /> Import</button>
          <SyncButton endpoint="/api/import/gs/orders/cleora-shopee" label="Sync" />
          <button onClick={exportExcel} disabled={!daily.length} className="sv-tbtn sv-tbtn-success disabled:opacity-40"><i className="fas fa-file-excel" /> Export</button>
        </>}>
        <span className="text-xs text-dark1/60">Month</span>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2" />
      </CompactTopbar>

      <IconKpiStrip tiles={tiles} />

      {/* Row 1: recap line (2/3) + platform donut (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-2">
        <CompactPanel title="Daily Recap" icon="fa-chart-line" className="lg:col-span-2"
          headerRight={
            <div className="flex items-center gap-1">
              {zoomOn && recapData && <button onClick={() => recapRef.current?.resetZoom?.()} className="text-[10px] text-orange hover:underline mr-1">reset</button>}
              <div className="flex gap-0.5">
                {METRICS.map(m => (
                  <button key={m.k} onClick={() => setMetric(m.k)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${metric === m.k ? 'bg-dark1 text-white' : 'text-dark1/50 hover:text-dark1'}`}>{m.l}</button>
                ))}
              </div>
            </div>
          }>
          {recapData ? <div style={{ height: 150 }}><Line key={zoomOn ? 'z' : 'nz'} ref={recapRef} data={recapData} options={recapOpts} /></div> : <Empty text="No data this month" h={150} />}
        </CompactPanel>
        <CompactPanel title="Platform Split" icon="fa-store">
          {platDonut ? <div style={{ height: 150 }}><Doughnut data={platDonut} options={platOpts} /></div> : <Empty text="No platform data" h={150} />}
        </CompactPanel>
      </div>

      {/* Row 2: status progress bars (1/3) + profitability quadrant (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-2">
        <CompactPanel title="Order Status" icon="fa-list-check">
          {statuses.length ? (
            <div className="flex flex-col gap-1.5 py-1">
              {statuses.slice(0, 8).map(s => (
                <div key={s.status}>
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="truncate pr-2" style={{ color: s.excluded ? '#dc3545' : '#2C3639' }}>{s.status}</span>
                    <span className="text-dark1/50 flex-shrink-0">{formatNumber(s.orders)} · {s.ordersPct}%</span>
                  </div>
                  <div className="h-1.5 bg-dark1/8 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.ordersPct}%`, background: s.excluded ? withAlpha('#dc3545', 0.6) : seriesColor(0) }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty text="No orders this month" />}
        </CompactPanel>
        <CompactPanel title="Profitability Quadrant" icon="fa-star" className="lg:col-span-2"
          headerRight={<span className="text-[9px] text-dark1/40">size=revenue · color=quadrant · real OrderItem</span>}>
          {bubbleData ? <div style={{ height: 160 }}><Bubble data={bubbleData} options={bubbleOpts} /></div>
            : <Empty text="No product-cost data (needs synced products with hargaCogs)" h={160} />}
        </CompactPanel>
      </div>

      {/* Row 3: margin Pareto */}
      <div className="mt-2">
        <CompactPanel title="Margin Pareto — which products drive profit" icon="fa-trophy"
          headerRight={<span className="text-[9px] text-dark1/40">bars=margin · line=cumulative % · dashed=80% · real OrderItem</span>}>
          {paretoData ? <div style={{ height: 160 }}><Chart type="bar" data={paretoData} options={paretoOpts} /></div>
            : <Empty text="No product-cost data (needs synced products with hargaCogs)" h={160} />}
        </CompactPanel>
      </div>

      {loading && !data && <div className="text-center text-dark1/30 text-xs py-4">Loading…</div>}

      {showImport && (
        <ImportModal title="Import Orders" endpoint="/api/import/orders?platform=shopee"
          onSuccess={() => setRefresh(r => r + 1)} onClose={() => setShowImport(false)} />
      )}
    </CompactPage>
  )
}
