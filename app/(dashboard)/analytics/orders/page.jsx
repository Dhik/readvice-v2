'use client'
import { useEffect, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import KpiStrip from '@/components/ui/KpiStrip'
import ChartPanel from '@/components/charts/ChartPanel'
import DateRangePicker from '@/components/ui/DateRangePicker'
import { formatCurrency, formatNumber } from '@/lib/utils'
Chart.register(...registerables)

const GRANS = [{ k: 'day', l: 'Day' }, { k: 'week', l: 'Week' }, { k: 'month', l: 'Month' }]
const METRICS = [{ k: 'revenue', l: 'Revenue' }, { k: 'orders', l: 'Orders' }, { k: 'qty', l: 'Units' }, { k: 'aov', l: 'AOV' }]
const PALETTE = ['#E07B39', '#2C3639', '#3F4E4F', '#8B5E3C', '#A9C5A0', '#C9A66B', '#6B8E9E', '#B5645B']
const OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } } }

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
        { label: 'GMV',  data: ts.map(t => t.gmv),  borderColor: '#E07B39', backgroundColor: 'rgba(224,123,57,0.1)', fill: true, tension: 0.3 },
        { label: 'Nett', data: ts.map(t => t.nett), borderColor: '#3F4E4F', backgroundColor: 'rgba(63,78,79,0.08)', fill: false, tension: 0.3 } ] }
    : metric === 'orders' ? { labels: periods, datasets: [
        { label: 'Orders', data: ts.map(t => t.orders), borderColor: '#E07B39', backgroundColor: 'rgba(224,123,57,0.1)', fill: true, tension: 0.3 } ] }
    : metric === 'qty' ? { labels: periods, datasets: [
        { label: 'Units', data: ts.map(t => t.qty), borderColor: '#8B5E3C', backgroundColor: 'rgba(139,94,60,0.1)', fill: true, tension: 0.3 } ] }
    : { labels: aov.map(a => a.period), datasets: [
        { label: 'AOV', data: aov.map(a => a.aov), borderColor: '#2C3639', backgroundColor: 'rgba(44,54,57,0.1)', fill: true, tension: 0.3 } ] }

  // ── Status breakdown bar (all orders; excluded statuses muted) ──
  const status = data?.statusBreakdown ?? []
  const statusBar = status.length ? {
    labels: status.map(s => s.status),
    datasets: [{ label: 'Orders', data: status.map(s => s.orders),
      backgroundColor: status.map(s => s.excluded ? 'rgba(181,100,91,0.55)' : '#E07B39') }],
  } : null

  // ── Order-size distribution ──
  const ud = data?.sizeDistribution?.units ?? []
  const vd = data?.sizeDistribution?.value ?? []
  const unitsBar = ud.length ? { labels: ud.map(b => b.label), datasets: [{ label: 'Orders', data: ud.map(b => b.orders), backgroundColor: '#E07B39' }] } : null
  const valueBar = vd.length ? { labels: vd.map(b => b.label), datasets: [{ label: 'Orders', data: vd.map(b => b.orders), backgroundColor: '#3F4E4F' }] } : null

  // ── Day of week ──
  const dow = data?.dayOfWeek ?? []
  const dowHasData = dow.some(d => d.orders > 0)
  const dowBar = dowHasData ? { labels: dow.map(d => d.day), datasets: [{ label: 'Revenue', data: dow.map(d => d.gmv), backgroundColor: '#E07B39' }] } : null

  // ── Platform over time (stacked) ──
  const pot = data?.platformOverTime ?? []
  const potPeriods = [...new Set(pot.map(r => r.period))].sort()
  const potPlatforms = [...new Set(pot.map(r => r.platform))]
  const potData = pot.length ? {
    labels: potPeriods,
    datasets: potPlatforms.map((pf, i) => ({
      label: pf,
      data: potPeriods.map(p => { const row = pot.find(r => r.period === p && r.platform === pf); return row ? row.gmv : 0 }),
      backgroundColor: PALETTE[i % PALETTE.length],
    })),
  } : null
  const stackedOpts = { ...OPTS, scales: { x: { stacked: true }, y: { stacked: true } } }

  // ── Customer split ──
  const cs = data?.customerSplit
  const csTotal = (cs?.ordersFromNew ?? 0) + (cs?.ordersFromReturning ?? 0)
  const csData = csTotal > 0 ? {
    labels: ['New (single-order)', 'Returning (repeat)'],
    datasets: [{ data: [cs.ordersFromNew, cs.ordersFromReturning], backgroundColor: ['#A9C5A0', '#E07B39'] }],
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
          <div className="flex gap-1 tab-pills ml-auto">
            {METRICS.map(m => (
              <button key={m.k} onClick={() => setMetric(m.k)}
                className={`tab-pill ${metric === m.k ? 'active' : ''}`}>{m.l}</button>
            ))}
          </div>
        </div>
        <div className="sv-panel-body">
          {trendData ? <ChartPanel lineData={trendData} defaultView="line" height={260} /> : <Empty />}
        </div>
      </div>

      {/* ── Row: status | size distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card title="Order Status Breakdown" basis="all">
          {statusBar ? (
            <>
              <div style={{ height: 200 }}><Bar data={statusBar} options={{ ...OPTS, indexAxis: 'y', plugins: { legend: { display: false } } }} /></div>
              <div className="overflow-x-auto mt-2">
                <table className="sv-table-clean w-full text-xs">
                  <thead><tr className="text-left text-dark1/50 border-b border-dark1/10">
                    <th className="py-1 pr-2">Status</th><th className="py-1 pr-2 text-right">Orders</th>
                    <th className="py-1 pr-2 text-right">%</th><th className="py-1 pr-2 text-right">GMV</th>
                  </tr></thead>
                  <tbody>
                    {status.map(s => (
                      <tr key={s.status} className="border-b border-dark1/5">
                        <td className="py-1 pr-2">{s.status}
                          {s.excluded && <span className="ml-1.5 text-[9px] uppercase px-1 py-0.5 rounded bg-red-500/10 text-red-600" title="Excluded from real-sales metrics">excl.</span>}
                        </td>
                        <td className="py-1 pr-2 text-right">{formatNumber(s.orders)}</td>
                        <td className="py-1 pr-2 text-right">{s.ordersPct}%</td>
                        <td className="py-1 pr-2 text-right">{formatCurrency(s.gmv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <Empty />}
        </Card>

        <Card title="Order-Size Distribution" basis="real">
          {(unitsBar || valueBar) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-dark1/50 mb-1">Units per order</div>
                <div style={{ height: 180 }}>{unitsBar ? <Bar data={unitsBar} options={{ ...OPTS, plugins: { legend: { display: false } } }} /> : <Empty />}</div>
              </div>
              <div>
                <div className="text-[11px] text-dark1/50 mb-1">Value per order <span className="text-dark1/30">(IDR)</span></div>
                <div style={{ height: 180 }}>{valueBar ? <Bar data={valueBar} options={{ ...OPTS, plugins: { legend: { display: false } } }} /> : <Empty />}</div>
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
          {dowBar ? <div style={{ height: 200 }}><Bar data={dowBar} options={{ ...OPTS, plugins: { legend: { display: false } } }} /></div> : <Empty />}
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
              <div style={{ height: 180 }}><Doughnut data={csData} options={{ ...OPTS, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }, cutout: '60%' }} /></div>
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
