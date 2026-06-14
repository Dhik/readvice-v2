'use client'
import { useEffect, useState, useRef } from 'react'
import { Bar, Doughnut, Chart } from 'react-chartjs-2'
import KpiStrip from '@/components/ui/KpiStrip'
import ChartPanel from '@/components/charts/ChartPanel'
import DateRangePicker from '@/components/ui/DateRangePicker'
import DataGrid from '@/components/table/DataGrid'
import { seriesColor, platformColor, SEMANTIC, withAlpha, zoomReady, mergeOptions } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

// Status-breakdown table columns (ALL statuses — the funnel). `excluded` rows are
// flagged; sort/search/filter handled by DataGrid.
const STATUS_COLUMNS = [
  { key: 'status', label: 'Status', sortable: true, searchable: true, sortType: 'string', filter: 'select',
    render: s => (
      <>
        {s.status}
        {s.excluded && <span className="ml-1.5 text-[9px] uppercase px-1 py-0.5 rounded bg-red-500/10 text-red-600"
          title="Excluded from real-sales metrics">excl.</span>}
      </>
    ) },
  { key: 'orders',    label: 'Orders', sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
  { key: 'ordersPct', label: '%',      sortable: true, sortType: 'number', align: 'right', format: v => `${v}%` },
  { key: 'gmv',       label: 'GMV',    sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
]

const GRANS = [{ k: 'day', l: 'Day' }, { k: 'week', l: 'Week' }, { k: 'month', l: 'Month' }]
const METRICS = [{ k: 'revenue', l: 'Revenue' }, { k: 'orders', l: 'Orders' }, { k: 'qty', l: 'Units' }, { k: 'aov', l: 'AOV' }]
const OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } } }

// Compact IDR for the combo's right (AOV) axis ticks.
const shortRp = (v) => {
  const n = Number(v) || 0
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return String(n)
}

// "Real sales" (excludes cancelled/unpaid) vs "all orders" (the status funnel).
const Basis = ({ kind }) => (
  <span className={`text-[10px] px-1.5 py-0.5 rounded ${kind === 'all'
    ? 'bg-dark1/10 text-dark1/55' : 'bg-green-600/10 text-green-700'}`}>
    {kind === 'all' ? 'all orders' : 'excl. cancelled'}
  </span>
)

const Card = ({ title, basis, children, className = '' }) => (
  <div className={`sv-chart-panel ${className}`}>
    <div className="sv-panel-header flex items-center gap-2">
      <span>{title}</span>{basis && <Basis kind={basis} />}
    </div>
    <div className="sv-panel-body">{children}</div>
  </div>
)

const Empty = () => <div className="flex items-center justify-center h-[200px] text-dark1/30 text-sm">No data</div>

export default function OrderAnalysisPage() {
  const [platform, setPlatform]       = useState('')
  const [startDate, setStartDate]     = useState('')
  const [endDate, setEndDate]         = useState('')
  const [granularity, setGranularity] = useState('day')
  const [metric, setMetric]           = useState('revenue')
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [zoomOn, setZoomOn]           = useState(false) // true once the dynamic zoom plugin is registered
  const trendRef = useRef(null)                          // chart instance, for resetZoom()

  // zoom plugin loads client-only & async (see theme.js). Flip zoomOn when ready;
  // the trend ChartPanel is keyed on zoomOn so it REMOUNTS with zoom registered
  // (chart.js attaches plugins at construction).
  useEffect(() => { zoomReady.then(setZoomOn) }, [])

  const rangeActive = Boolean(startDate && endDate)

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams({ granularity })
    if (platform) p.set('platform', platform)
    if (rangeActive) { p.set('startDate', startDate); p.set('endDate', endDate) }
    fetch(`/api/analytics/orders?${p.toString()}`)
      .then(r => r.json())
      .then(d => { setData(d?.error ? null : d); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [platform, startDate, endDate, granularity])

  const ts  = data?.timeSeries ?? []
  const aov = data?.aovTrend ?? []
  const k   = data?.kpis
  const platforms = ['All', ...(data?.availablePlatforms ?? [])]

  const kpiTiles = [
    { label: 'Revenue (real sales)', value: formatCurrency(k?.totalRevenue ?? 0) },
    { label: 'Orders (real sales)',  value: formatNumber(k?.totalOrders ?? 0) },
    { label: 'Best Weekday', value: k?.bestWeekday ? k.bestWeekday.day : '—',
      sub: k?.bestWeekday ? formatCurrency(k.bestWeekday.gmv) : undefined },
    { label: 'Peak Period', value: k?.peakPeriod ? k.peakPeriod.period : '—',
      sub: k?.peakPeriod ? formatCurrency(k.peakPeriod.gmv) : undefined },
    { label: 'Repeat Customers', value: formatNumber(k?.repeatCustomers ?? 0) },
  ]

  // ── Trend hero (metric toggle) ──
  const periods = ts.map(t => t.period)
  const trendData = !ts.length ? null
    : metric === 'revenue' ? { labels: periods, datasets: [
        { label: 'GMV',  data: ts.map(t => t.gmv),  borderColor: seriesColor(0), backgroundColor: withAlpha(seriesColor(0), 0.1), fill: true, tension: 0.3 },
        { label: 'Nett', data: ts.map(t => t.nett), borderColor: seriesColor(2), backgroundColor: withAlpha(seriesColor(2), 0.08), fill: false, tension: 0.3 } ] }
    : metric === 'orders' ? { labels: periods, datasets: [
        { label: 'Orders', data: ts.map(t => t.orders), borderColor: seriesColor(0), backgroundColor: withAlpha(seriesColor(0), 0.1), fill: true, tension: 0.3 } ] }
    : metric === 'qty' ? { labels: periods, datasets: [
        { label: 'Units', data: ts.map(t => t.qty), borderColor: seriesColor(3), backgroundColor: withAlpha(seriesColor(3), 0.1), fill: true, tension: 0.3 } ] }
    : { labels: aov.map(a => a.period), datasets: [
        // AOV is a ratio/average — render as a LINE (no fill): area under an average
        // implies accumulated volume, which misleads. Volume metrics above use area.
        { label: 'AOV', data: aov.map(a => a.aov), borderColor: seriesColor(1), backgroundColor: withAlpha(seriesColor(1), 0.1), fill: false, tension: 0.3 } ] }

  // Trend tooltip shows ALL 5 metrics for the hovered period at once (gmv, nett,
  // orders, qty, aov) regardless of the active line — pulled from ts + aov by index.
  // filter to dataset 0 so the 5-line block prints once (even in the 2-line revenue
  // view). Zoom (x-axis only) is added once the dynamic plugin is ready.
  const trendOptions = {
    interaction: { mode: 'index', intersect: false },
    plugins: {
      tooltip: {
        displayColors: false,
        filter: item => item.datasetIndex === 0,
        callbacks: {
          title: items => items[0]?.label ?? '',
          label: ctx => {
            const t = ts[ctx.dataIndex], a = aov[ctx.dataIndex]
            if (!t) return ''
            return [
              `GMV: ${formatCurrency(t.gmv)}`,
              `Nett: ${formatCurrency(t.nett)}`,
              `Orders: ${formatNumber(t.orders)}`,
              `Qty: ${formatNumber(t.qty)}`,
              `AOV: ${formatCurrency(a?.aov ?? 0)}`,
            ]
          },
        },
      },
      ...(zoomOn ? {
        zoom: {
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
          pan:  { enabled: true, mode: 'x' },
          limits: { x: { min: 'original', max: 'original' } }, // constrain to data range
        },
      } : {}),
    },
  }

  // ── Combo: Orders (bars) vs AOV (line), dual-axis (Fase 2c) ──
  // Volume vs basket-value over time on one chart — "more but smaller baskets?".
  // Left axis = Orders (count); right axis = AOV (IDR). Grid drawn on the LEFT axis
  // only so the second axis can't visually mislead. Uses ts + aov (already fetched).
  const comboData = ts.length ? {
    labels: periods,
    datasets: [
      { type: 'bar',  label: 'Orders', data: ts.map(t => t.orders), yAxisID: 'y',  order: 2,
        backgroundColor: withAlpha(seriesColor(0), 0.55), borderColor: seriesColor(0) },
      { type: 'line', label: 'AOV',    data: aov.map(a => a.aov),   yAxisID: 'y1', order: 1,
        borderColor: seriesColor(1), backgroundColor: seriesColor(1), tension: 0.3, pointRadius: 2, fill: false },
    ],
  } : null
  const comboOptions = mergeOptions(OPTS, {
    interaction: { mode: 'index', intersect: false },
    scales: {
      y:  { type: 'linear', position: 'left',  title: { display: true, text: 'Orders' },
            grid: { drawOnChartArea: true } },
      y1: { type: 'linear', position: 'right', title: { display: true, text: 'AOV (IDR)' },
            grid: { drawOnChartArea: false }, ticks: { callback: v => shortRp(v) } },
    },
    plugins: {
      tooltip: { callbacks: { label: ctx => ctx.dataset.label === 'AOV'
        ? `AOV: ${formatCurrency(ctx.parsed.y)}`
        : `Orders: ${formatNumber(ctx.parsed.y)}` } },
    },
  })

  // ── Status breakdown bar (all orders; excluded statuses muted) ──
  const status = data?.statusBreakdown ?? []
  const statusBar = status.length ? {
    labels: status.map(s => s.status),
    datasets: [{ label: 'Orders', data: status.map(s => s.orders),
      backgroundColor: status.map(s => s.excluded ? withAlpha(SEMANTIC.danger, 0.55) : seriesColor(0)) }],
  } : null

  // ── Order-size distribution ──
  const ud = data?.sizeDistribution?.units ?? []
  const vd = data?.sizeDistribution?.value ?? []
  const unitsBar = ud.length ? { labels: ud.map(b => b.label), datasets: [{ label: 'Orders', data: ud.map(b => b.orders), backgroundColor: seriesColor(0) }] } : null
  const valueBar = vd.length ? { labels: vd.map(b => b.label), datasets: [{ label: 'Orders', data: vd.map(b => b.orders), backgroundColor: seriesColor(2) }] } : null
  // Size-dist bar options: tooltip (count + % of orders) + datalabels (count on bar).
  const sizeOpts = (arr) => mergeOptions(OPTS, {
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => {
        const b = arr[ctx.dataIndex]; if (!b) return ''
        const total = arr.reduce((a, x) => a + x.orders, 0)
        const pct = total > 0 ? Math.round((b.orders / total) * 1000) / 10 : 0
        return [`${formatNumber(b.orders)} orders`, `${pct}% of orders`]
      } } },
      datalabels: { display: true, anchor: 'end', align: 'end', offset: 2,
        color: '#2C3639', font: { size: 9 }, formatter: v => formatNumber(v) },
    },
  })

  // ── Day of week ──
  const dow = data?.dayOfWeek ?? []
  const dowHasData = dow.some(d => d.orders > 0)
  const dowBar = dowHasData ? { labels: dow.map(d => d.day), datasets: [{ label: 'Revenue', data: dow.map(d => d.gmv), backgroundColor: seriesColor(0) }] } : null

  // ── Platform over time (stacked) ──
  const pot = data?.platformOverTime ?? []
  const potPeriods = [...new Set(pot.map(r => r.period))].sort()
  const potPlatforms = [...new Set(pot.map(r => r.platform))]
  const potData = pot.length ? {
    labels: potPeriods,
    datasets: potPlatforms.map((pf) => ({
      label: pf,
      data: potPeriods.map(p => { const row = pot.find(r => r.period === p && r.platform === pf); return row ? row.gmv : 0 }),
      backgroundColor: platformColor(pf), // unified marketplace colors
    })),
  } : null
  const stackedOpts = mergeOptions(OPTS, {
    scales: { x: { stacked: true }, y: { stacked: true } },
    plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } } },
  })

  // ── Customer split ──
  const cs = data?.customerSplit
  const csTotal = (cs?.ordersFromNew ?? 0) + (cs?.ordersFromReturning ?? 0)
  const csData = csTotal > 0 ? {
    labels: ['New (single-order)', 'Returning (repeat)'],
    datasets: [{ data: [cs.ordersFromNew, cs.ordersFromReturning], backgroundColor: [seriesColor(5), seriesColor(0)] }],
  } : null

  if (loading && !data) {
    return <div className="sv-page"><div className="py-20 text-center text-dark1/40 text-sm">Loading…</div></div>
  }

  return (
    <div className="sv-page">
      {/* Filters */}
      <div className="sv-filter-bar">
        <div className="flex gap-1 tab-pills">
          {platforms.map(p => (
            <button key={p} onClick={() => setPlatform(p === 'All' ? '' : p)}
              className={`tab-pill ${(p === 'All' ? '' : p) === platform ? 'active' : ''}`}>{p}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex gap-1 tab-pills">
            {GRANS.map(g => (
              <button key={g.k} onClick={() => setGranularity(g.k)}
                className={`tab-pill ${granularity === g.k ? 'active' : ''}`}>{g.l}</button>
            ))}
          </div>
          <DateRangePicker label="Range" startDate={startDate} endDate={endDate}
            onStartChange={setStartDate} onEndChange={setEndDate} />
          {rangeActive && (
            <button onClick={() => { setStartDate(''); setEndDate('') }}
              className="text-xs text-orange hover:underline">Clear range</button>
          )}
        </div>
      </div>

      <KpiStrip tiles={kpiTiles} />

      {/* ── Trend hero (full width) ── */}
      <div className="sv-chart-panel mt-4">
        <div className="sv-panel-header flex items-center gap-2 flex-wrap">
          <span>Trend</span><Basis kind="real" />
          {zoomOn && trendData && (
            <button onClick={() => trendRef.current?.resetZoom?.()}
              className="text-[11px] text-orange hover:underline" title="Reset zoom/pan">Reset zoom</button>
          )}
          <div className="flex gap-1 tab-pills ml-auto">
            {METRICS.map(m => (
              <button key={m.k} onClick={() => setMetric(m.k)}
                className={`tab-pill ${metric === m.k ? 'active' : ''}`}>{m.l}</button>
            ))}
          </div>
        </div>
        <div className="sv-panel-body">
          {trendData
            ? <ChartPanel key={zoomOn ? 'zoom' : 'nozoom'} lineData={trendData} defaultView="line"
                height={260} lineOptions={trendOptions} chartRef={trendRef} />
            : <Empty />}
        </div>
        {zoomOn && trendData && (
          <div className="px-3 pb-2 text-[10px] text-dark1/40">Scroll/pinch to zoom · drag to pan (x-axis)</div>
        )}
      </div>

      {/* ── Orders vs Avg Order Value (combo, dual-axis) ── */}
      <div className="sv-chart-panel mt-4">
        <div className="sv-panel-header flex items-center gap-2">
          <span>Orders vs Avg Order Value</span><Basis kind="real" />
          <span className="ml-auto text-[10px] text-dark1/40">bars = orders (left) · line = AOV (right)</span>
        </div>
        <div className="sv-panel-body">
          {comboData ? <div style={{ height: 240 }}><Chart type="bar" data={comboData} options={comboOptions} /></div> : <Empty />}
        </div>
      </div>

      {/* ── Row: status | size distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card title="Order Status Breakdown" basis="all">
          {statusBar ? (
            <>
              <div style={{ height: 200 }}><Bar data={statusBar} options={mergeOptions(OPTS, {
                indexAxis: 'y',
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: ctx => {
                    const s = status[ctx.dataIndex]
                    return s ? [`Orders: ${formatNumber(s.orders)}`, `${s.ordersPct}% of orders`,
                      `GMV: ${formatCurrency(s.gmv)}`, ...(s.excluded ? ['⊘ excluded from real sales'] : [])] : ''
                  } } },
                  datalabels: { display: true, anchor: 'end', align: 'end', offset: 2,
                    color: '#2C3639', font: { size: 9 }, formatter: v => formatNumber(v) },
                },
              })} /></div>
              <div className="mt-2">
                <DataGrid
                  data={status}
                  columns={STATUS_COLUMNS}
                  searchable
                  defaultSort={{ key: 'orders', dir: 'desc' }}
                  pageSize={0}
                  emptyText="No orders in this period."
                />
              </div>
            </>
          ) : <Empty />}
        </Card>

        <Card title="Order-Size Distribution" basis="real">
          {(unitsBar || valueBar) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-dark1/50 mb-1">Units per order</div>
                <div style={{ height: 180 }}>{unitsBar ? <Bar data={unitsBar} options={sizeOpts(ud)} /> : <Empty />}</div>
              </div>
              <div>
                <div className="text-[11px] text-dark1/50 mb-1">Value per order <span className="text-dark1/30">(IDR)</span></div>
                <div style={{ height: 180 }}>{valueBar ? <Bar data={valueBar} options={sizeOpts(vd)} /> : <Empty />}</div>
              </div>
            </div>
          ) : <Empty />}
        </Card>
      </div>

      {/* ── Row: day-of-week | platform over time ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card title="Revenue by Day of Week" basis="real">
          {/* PROMINENT TZ-1 caption — the weekday shift is directly visible */}
          <div className="mb-2 text-[11px] text-orange/90 bg-orange/5 border border-orange/15 rounded px-2 py-1">
            ⚠ Grouped by UTC day; weekdays may shift ~1 day vs local time (WIB).
          </div>
          {dowBar ? <div style={{ height: 200 }}><Bar data={dowBar} options={mergeOptions(OPTS, {
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: ctx => {
                const d = dow[ctx.dataIndex]
                return d ? [`Revenue: ${formatCurrency(d.gmv)}`, `Orders: ${formatNumber(d.orders)}`, `Qty: ${formatNumber(d.qty)}`] : ''
              } } },
            },
          })} /></div> : <Empty />}
        </Card>

        <Card title="Platform Revenue Over Time" basis="real">
          {potData ? <div style={{ height: 220 }}><Bar data={potData} options={stackedOpts} /></div> : <Empty />}
        </Card>
      </div>

      {/* ── Row: customer split | conversion placeholder ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card title="New vs Returning Customers" basis="real">
          {csData ? (
            <>
              <div style={{ height: 180 }}><Doughnut data={csData} options={mergeOptions(OPTS, {
                cutout: '60%',
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                  tooltip: { callbacks: { label: ctx => {
                    const total = (cs.ordersFromNew + cs.ordersFromReturning) || 1
                    const pct = Math.round((ctx.parsed / total) * 1000) / 10
                    return ` ${formatNumber(ctx.parsed)} orders (${pct}%)`
                  } } },
                },
              })} /></div>
              {/* Visible coverage caption — the partial nature must be obvious */}
              <div className="mt-2 text-[11px] text-dark1/55 bg-dark1/5 rounded px-2 py-1.5 leading-relaxed">
                Based on <b>{formatNumber(cs.coverage.ordersWithCustomer)}</b> orders with customer data
                (<b>{cs.coverage.pct}%</b> of real-sales orders). {cs.distinctCustomers} customers,
                {' '}{cs.returningCustomers} returning. Identified by username within this window;
                earlier orders aren’t counted.
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-dark1/40 text-sm">
              No orders carry customer data in this period.
            </div>
          )}
        </Card>

        {/* Conversion rate — placeholder, NOT a dummy number */}
        <Card title="Conversion Rate">
          <div className="flex flex-col items-center justify-center h-[200px] text-center px-4">
            <div className="text-3xl text-dark1/20 mb-2">—</div>
            <div className="text-sm text-dark1/50 font-medium">Not yet available</div>
            <div className="text-xs text-dark1/40 mt-1">
              Connect a visits data source to compute conversion (orders ÷ visits).
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
