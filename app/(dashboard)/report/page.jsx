'use client'
import { useEffect, useState } from 'react'
import { Doughnut, Bar } from 'react-chartjs-2'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import { seriesColor, platformColor, withAlpha, SEMANTIC, baseOptions, mergeOptions } from '@/lib/charts/theme'
import { formatCurrency, formatNumber, currentMonth } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }
const fmtX = v => v == null ? '—' : `${Number(v).toFixed(2)}×`
const fmtPct = v => v == null ? '—' : `${Number(v).toFixed(2)}%`
const Empty = ({ text = 'No data', h = 140 }) => <div style={{ height: h }} className="flex items-center justify-center text-dark1/30 text-xs">{text}</div>

const DAILY_COLUMNS = [
  { key: 'date',           label: 'Date',      sortable: true, searchable: true, sortType: 'date' },
  { key: 'turnover',       label: 'Sales',     sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
  { key: 'order',          label: 'Orders',    sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
  { key: 'qty',            label: 'Qty',       sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
  { key: 'ad_spent_total', label: 'Ad Spent',  sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
  { key: 'roas',           label: 'ROAS',      sortable: true, sortType: 'number', align: 'right', format: v => fmtX(v) },
  { key: 'closing_rate',   label: 'Closing %', sortable: true, sortType: 'number', align: 'right', format: v => `${v}%` },
]

export default function ReportPage() {
  const [month, setMonth]     = useState(currentMonth())
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/report/summary?month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d?.error ? null : d); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [month])

  const k = data?.kpis?.current ?? {}
  const dlt = data?.kpis?.deltas ?? {}
  const daily = data?.daily ?? []
  const statuses = data?.statuses ?? []
  const platforms = data?.platforms ?? []

  const tiles = [
    { icon: 'fa-dollar-sign', bg: '#E07B39', label: 'Total Sales', value: formatCurrency(k.sales ?? 0), delta: dlt.sales?.pct },
    { icon: 'fa-receipt',     bg: '#2C3639', label: 'Orders',      value: formatNumber(k.orders ?? 0),  delta: dlt.orders?.pct },
    { icon: 'fa-boxes-stacked', bg: '#C9A66B', iconColor: '#2C3639', label: 'Qty', value: formatNumber(k.qty ?? 0), delta: dlt.qty?.pct },
    { icon: 'fa-eye',         bg: '#3F4E4F', label: 'Visit',       value: formatNumber(k.visits ?? 0),  delta: dlt.visits?.pct, dev: true },
    { icon: 'fa-credit-card', bg: '#8B5E3C', label: 'Total Spent', value: formatCurrency(k.totalSpent ?? 0), delta: dlt.totalSpent?.pct, dev: true },
    { icon: 'fa-bullseye',    bg: '#6B8E9E', label: 'ROAS',        value: fmtX(k.roas),                 delta: dlt.roas?.pct, dev: true },
    { icon: 'fa-percent',     bg: '#A9C5A0', iconColor: '#2C3639', label: 'Closing Rate', value: fmtPct(k.closingRate), delta: dlt.closingRate?.pct, dev: true },
    { icon: 'fa-coins',       bg: '#B5645B', label: 'CPA',         value: formatCurrency(k.cpa ?? 0),   delta: dlt.cpa?.pct, dev: true },
  ]

  // Static report charts (no zoom/drill)
  const totalPlat = platforms.reduce((a, p) => a + p.gmv, 0) || 1
  const platDonut = platforms.length ? { labels: platforms.map(p => p.platform), datasets: [{ data: platforms.map(p => p.gmv), backgroundColor: platforms.map(p => platformColor(p._key)) }] } : null
  const platOpts = mergeOptions(baseOptions, { cutout: '58%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, font: { size: 9 } } }, tooltip: { callbacks: { label: c => ` ${formatCurrency(c.parsed)} (${Math.round((c.parsed / totalPlat) * 1000) / 10}%)` } } } })

  const statusBar = statuses.length ? {
    labels: statuses.map(s => s.status),
    datasets: [{ label: 'Orders', data: statuses.map(s => s.orders), backgroundColor: statuses.map(s => s.excluded ? withAlpha(SEMANTIC.danger, 0.65) : seriesColor(0)) }],
  } : null
  const statusOpts = mergeOptions(baseOptions, { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const s = statuses[c.dataIndex]; return s ? [`${formatNumber(s.orders)} orders (${s.ordersPct}%)`, `GMV: ${formatCurrency(s.gmv)}`] : '' } } } }, scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 8 } } } } })

  const revBar = daily.length ? {
    labels: daily.map(d => d.date.slice(8)),
    datasets: [{ label: 'Sales', data: daily.map(d => d.turnover), backgroundColor: seriesColor(0) }],
  } : null
  const revOpts = mergeOptions(baseOptions, { plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => `Day ${i[0]?.label}`, label: c => formatCurrency(c.parsed.y) } } }, scales: { x: { ticks: { font: { size: 9 }, maxTicksLimit: 12 } }, y: { ticks: { callback: v => shortRp(v), font: { size: 9 } } } } })

  return (
    <CompactPage>
      <CompactTopbar title="Report" icon="fa-file-lines"
        actions={
          <a href={`/api/report/export?month=${month}`} className="sv-tbtn sv-tbtn-success" title="Download .xlsx">
            <i className="fas fa-file-excel" /> Export Excel
          </a>
        }>
        <span className="text-xs text-dark1/60">Month</span>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2" />
      </CompactTopbar>

      <IconKpiStrip tiles={tiles} />

      {/* Static summary charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-2">
        <CompactPanel title="Platform Split" icon="fa-store">
          {platDonut ? <div style={{ height: 150 }}><Doughnut data={platDonut} options={platOpts} /></div> : <Empty text="No platform data" h={150} />}
        </CompactPanel>
        <CompactPanel title="Status Breakdown" icon="fa-list-check">
          {statusBar ? <div style={{ height: 150 }}><Bar data={statusBar} options={statusOpts} /></div> : <Empty text="No orders" h={150} />}
        </CompactPanel>
        <CompactPanel title="Monthly Revenue" icon="fa-chart-column">
          {revBar ? <div style={{ height: 150 }}><Bar data={revBar} options={revOpts} /></div> : <Empty text="No revenue" h={150} />}
        </CompactPanel>
      </div>

      {/* Exportable flat table — sales by date */}
      <div className="mt-2">
        <CompactPanel title="Sales by Date" icon="fa-table"
          headerRight={<span className="text-[9px] text-dark1/40">Ad Spent / ROAS / Closing = dummy dev data</span>}>
          <DataGrid data={daily} columns={DAILY_COLUMNS} searchable
            defaultSort={{ key: 'date', dir: 'asc' }} pageSize={31} loading={loading}
            emptyText="No sales in this period." />
        </CompactPanel>
      </div>
    </CompactPage>
  )
}
