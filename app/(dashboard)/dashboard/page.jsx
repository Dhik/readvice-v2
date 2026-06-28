'use client'
import { useEffect, useState } from 'react'
import { Line, Doughnut, Chart } from 'react-chartjs-2'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import CrossLink from '@/components/dashboard/CrossLink'
import WelcomeJumbotron from '@/components/dashboard/WelcomeJumbotron'
import { seriesColor, platformColor, withAlpha, baseOptions, mergeOptions } from '@/lib/charts/theme'
import { formatCurrency, formatNumber, currentMonth } from '@/lib/utils'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const shortRp = (v) => { const n = Number(v) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }
const fmtX  = (v) => v == null ? '—' : `${Number(v).toFixed(2)}×`
const fmtPct = (v) => v == null ? '—' : `${Number(v).toFixed(2)}%`
const Empty = ({ text = 'No data', h = 130 }) => <div style={{ height: h }} className="flex items-center justify-center text-dark1/30 text-xs">{text}</div>

// Calendar cells for the month (x=week, y=weekday, v=revenue). Every day filled.
function buildCalendar(month, dailyMap) {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return { cells: [], numWeeks: 0, maxV: 0 }
  const daysInMonth = new Date(y, m, 0).getDate()
  const firstDowMon = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const cells = []; let maxV = 0
  for (let dom = 1; dom <= daysInMonth; dom++) {
    const date = `${month}-${String(dom).padStart(2, '0')}`
    const dowMon = (new Date(Date.UTC(y, m - 1, dom)).getUTCDay() + 6) % 7
    const v = dailyMap.get(date) ?? 0
    if (v > maxV) maxV = v
    cells.push({ x: Math.floor((dom - 1 + firstDowMon) / 7) + 1, y: WEEKDAYS[dowMon], v, date })
  }
  return { cells, numWeeks: cells.reduce((mx, c) => Math.max(mx, c.x), 1), maxV }
}
const heatColor = (v, max) => v <= 0 ? 'rgba(44,54,57,0.05)' : withAlpha('#E07B39', 0.18 + 0.82 * (v / (max || 1)))

export default function DashboardPage() {
  const [month, setMonth]     = useState(currentMonth())
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/summary?month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d?.error ? null : d); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [month])

  const k = data?.kpis?.current ?? {}
  const dlt = data?.kpis?.deltas ?? {}
  const daily = data?.daily ?? []
  const platforms = data?.platforms ?? []
  const statuses = data?.statuses ?? []
  const products = data?.products ?? []

  // ── Live overview chips for the welcome jumbotron (from the same dashboard data) ──
  const chips = data ? [
    { icon: 'fa-dollar-sign', label: 'Sales · this month', value: formatCurrency(k.sales ?? 0), accent: '#E07B39' },
    { icon: 'fa-receipt',     label: 'Orders',             value: formatNumber(k.orders ?? 0),  accent: '#6B8E9E' },
    { icon: 'fa-store',       label: 'Top platform',       value: platforms[0]?.platform ?? '—', accent: '#A9C5A0' },
    { icon: 'fa-trophy',      label: 'Top product',        value: products[0]?.name ?? '—',      accent: '#C9A66B' },
  ] : []

  // ── 8 KPI tiles (visit/spent-derived = dummy → dev badge) ──
  const tiles = [
    { icon: 'fa-dollar-sign', bg: '#E07B39', label: 'Total Sales',  value: formatCurrency(k.sales ?? 0),  delta: dlt.sales?.pct },
    { icon: 'fa-eye',         bg: '#3F4E4F', label: 'Visit',        value: formatNumber(k.visits ?? 0),   delta: dlt.visits?.pct, dev: true },
    { icon: 'fa-receipt',     bg: '#2C3639', label: 'Order',        value: formatNumber(k.orders ?? 0),   delta: dlt.orders?.pct },
    { icon: 'fa-credit-card', bg: '#8B5E3C', label: 'Total Spent',  value: formatCurrency(k.totalSpent ?? 0), delta: dlt.totalSpent?.pct, dev: true },
    { icon: 'fa-bullseye',    bg: '#6B8E9E', label: 'ROAS',         value: fmtX(k.roas),                  delta: dlt.roas?.pct, dev: true },
    { icon: 'fa-percent',     bg: '#A9C5A0', iconColor: '#2C3639', label: 'Closing Rate', value: fmtPct(k.closingRate), delta: dlt.closingRate?.pct, dev: true },
    { icon: 'fa-boxes-stacked', bg: '#C9A66B', iconColor: '#2C3639', label: 'Qty',        value: formatNumber(k.qty ?? 0), delta: dlt.qty?.pct },
    { icon: 'fa-coins',       bg: '#B5645B', label: 'CPA',          value: formatCurrency(k.cpa ?? 0),    delta: dlt.cpa?.pct, dev: true },
  ]

  // ── Revenue trend area (turnover/day) ──
  const trendData = daily.length ? {
    labels: daily.map(d => d.date.slice(8)),
    datasets: [{ label: 'Sales', data: daily.map(d => d.turnover), borderColor: seriesColor(0), backgroundColor: withAlpha(seriesColor(0), 0.15), fill: true, tension: 0.3, pointRadius: 1 }],
  } : null
  const trendOpts = mergeOptions(baseOptions, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => `Day ${i[0]?.label}`, label: c => `Sales: ${formatCurrency(c.parsed.y)}` } } },
    scales: { y: { ticks: { callback: v => shortRp(v), font: { size: 9 } } }, x: { ticks: { font: { size: 9 }, maxTicksLimit: 10 } } },
  })

  // ── Multi-metric recap: Sales + Ad Spent (left IDR) + Orders bars (right count) ──
  const recapData = daily.length ? {
    labels: daily.map(d => d.date.slice(8)),
    datasets: [
      { type: 'bar',  label: 'Orders', data: daily.map(d => d.order), yAxisID: 'y1', order: 3, backgroundColor: withAlpha(seriesColor(5), 0.55) },
      { type: 'line', label: 'Sales',  data: daily.map(d => d.turnover), yAxisID: 'y', order: 1, borderColor: seriesColor(0), backgroundColor: seriesColor(0), tension: 0.3, pointRadius: 1, fill: false },
      { type: 'line', label: 'Ad Spent', data: daily.map(d => d.ad_spent_total), yAxisID: 'y', order: 2, borderColor: seriesColor(3), backgroundColor: seriesColor(3), borderDash: [4, 3], tension: 0.3, pointRadius: 1, fill: false },
    ],
  } : null
  const recapOpts = mergeOptions(baseOptions, {
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 9 } } },
      tooltip: { callbacks: { label: c => c.dataset.label === 'Orders' ? `Orders: ${formatNumber(c.parsed.y)}` : `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } } },
    scales: {
      y:  { type: 'linear', position: 'left', title: { display: true, text: 'Sales / Spend (IDR)', font: { size: 9 } }, grid: { drawOnChartArea: true }, ticks: { callback: v => shortRp(v), font: { size: 9 } } },
      y1: { type: 'linear', position: 'right', title: { display: true, text: 'Orders', font: { size: 9 } }, grid: { drawOnChartArea: false }, ticks: { font: { size: 9 } } },
      x:  { ticks: { font: { size: 9 }, maxTicksLimit: 10 } },
    },
  })

  // ── Platform donut (case-normalized) ──
  const totalPlat = platforms.reduce((a, p) => a + p.gmv, 0) || 1
  const platDonut = platforms.length ? {
    labels: platforms.map(p => p.platform),
    datasets: [{ data: platforms.map(p => p.gmv), backgroundColor: platforms.map(p => platformColor(p._key)) }],
  } : null
  const platOpts = mergeOptions(baseOptions, {
    cutout: '60%',
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, font: { size: 9 } } },
      tooltip: { callbacks: { label: c => ` ${formatCurrency(c.parsed)} (${Math.round((c.parsed / totalPlat) * 1000) / 10}%)` } } },
  })

  // ── Calendar heatmap (revenue/day) ──
  const dailyMapRev = new Map(daily.map(d => [d.date, d.turnover]))
  const { cells, numWeeks, maxV } = buildCalendar(month, dailyMapRev)
  const heatData = { datasets: [{
    label: 'Revenue', data: cells,
    backgroundColor: c => heatColor(c.raw.v, maxV),
    borderColor: 'rgba(255,255,255,0.65)', borderWidth: 1,
    width:  c => { const a = c.chart.chartArea; return a ? Math.max(6, a.width / numWeeks - 4) : 14 },
    height: c => { const a = c.chart.chartArea; return a ? Math.max(6, a.height / 7 - 4) : 14 },
  }] }
  const heatOpts = mergeOptions(baseOptions, {
    plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { title: () => '', label: c => `${c.raw.date} — ${formatCurrency(c.raw.v)}` } } },
    scales: {
      x: { type: 'linear', position: 'top', min: 0.5, max: numWeeks + 0.5, ticks: { display: false }, grid: { display: false }, border: { display: false } },
      y: { type: 'category', labels: WEEKDAYS, reverse: true, offset: true, ticks: { font: { size: 8 } }, grid: { display: false }, border: { display: false } },
    },
  })

  return (
    <CompactPage>
      <CompactTopbar title="Overview" icon="fa-gauge-high"
        actions={<CrossLink href="/analytics" label="View full analysis" />}>
        <span className="text-xs text-dark1/60">Month</span>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2" />
      </CompactTopbar>

      {/* Welcome hero — the face of the app (personalized greeting + mascot + live chips) */}
      <WelcomeJumbotron chips={chips} loading={loading && !data} />

      <IconKpiStrip tiles={tiles} />

      {/* Row 1: revenue trend (2/3) + platform donut (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-2">
        <CompactPanel title="Revenue Trend" icon="fa-chart-area" className="lg:col-span-2">
          {trendData ? <div style={{ height: 150 }}><Line data={trendData} options={trendOpts} /></div> : <Empty text="No revenue this month" h={150} />}
        </CompactPanel>
        <CompactPanel title="Platform Split" icon="fa-store">
          {platDonut ? <div style={{ height: 150 }}><Doughnut data={platDonut} options={platOpts} /></div> : <Empty text="No platform data" h={150} />}
        </CompactPanel>
      </div>

      {/* Row 2: multi-metric recap (2/3) + order status (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-2">
        <CompactPanel title="Sales · Ad Spend · Orders" icon="fa-chart-line" className="lg:col-span-2">
          {recapData ? <div style={{ height: 160 }}><Chart type="bar" data={recapData} options={recapOpts} /></div> : <Empty text="No data this month" h={160} />}
        </CompactPanel>
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
      </div>

      {/* Row 3: calendar heatmap (2/3) + top-5 products (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-2">
        <CompactPanel title="Daily Revenue Calendar" icon="fa-calendar"
          headerRight={<span className="text-[9px] text-dark1/40">darker = higher · UTC day</span>} className="lg:col-span-2">
          {maxV > 0 ? <div style={{ height: 150 }}><Chart type="matrix" data={heatData} options={heatOpts} /></div> : <Empty text="No revenue this month" h={150} />}
        </CompactPanel>
        <CompactPanel title="Top 5 Products" icon="fa-trophy" bodyClass="p-0">
          {products.length ? (
            <div className="flex flex-col">
              {products.map((p, i) => (
                <div key={p.sku} className="flex items-center gap-2 px-2 py-1.5 border-b border-cream/40 text-[11px]">
                  <span className="text-dark1/40 w-4 flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate" title={p.name}>{p.name}</span>
                  <span className="font-medium whitespace-nowrap flex-shrink-0">{formatCurrency(p.revenue)}</span>
                  <span className="text-dark1/50 whitespace-nowrap flex-shrink-0 w-12 text-right">{formatNumber(p.qty)} pcs</span>
                </div>
              ))}
            </div>
          ) : <Empty text="No product-level data" />}
        </CompactPanel>
      </div>

      {loading && !data && <div className="text-center text-dark1/30 text-xs py-4">Loading…</div>}
    </CompactPage>
  )
}
