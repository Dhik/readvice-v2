'use client'
import { useEffect, useMemo, useState } from 'react'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import { seriesColor, withAlpha, SEMANTIC, baseOptions, mergeOptions } from '@/lib/charts/theme'
import { formatCurrency, formatNumber, currentMonth } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }
const Empty = ({ text = 'No data', h = 150 }) => <div style={{ height: h }} className="flex items-center justify-center text-dark1/30 text-xs px-3 text-center">{text}</div>

const CUSTOMER_COLUMNS = [
  { key: 'name',      label: 'Customer',   sortable: true, searchable: true, sortType: 'string' },
  { key: 'username',  label: 'Username',   sortable: true, searchable: true, sortType: 'string', render: c => <span className="font-mono text-[10px]">{c.username}</span> },
  { key: 'orders',    label: 'Orders',     sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
  { key: 'gmv',       label: 'Total GMV',  sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
  { key: 'lastOrder', label: 'Last Order', sortable: true, sortType: 'date' },
  { key: 'platforms', label: 'Platform' },
]

export default function CustomerPage() {
  const [month, setMonth]     = useState(currentMonth())
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/customers/summary?month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d?.error ? null : d); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [month])

  const k = data?.kpis ?? {}
  const split = data?.split ?? {}
  const customers = data?.customers ?? []

  // Lorenz (inequality) curve + top-10, derived from the per-customer list.
  const { lorenz, top10 } = useMemo(() => {
    if (!customers.length) return { lorenz: null, top10: null }
    const asc = [...customers].sort((a, b) => a.gmv - b.gmv)
    const totalGmv = asc.reduce((a, c) => a + c.gmv, 0) || 1
    const n = asc.length
    let cg = 0
    const pts = [{ x: 0, y: 0 }, ...asc.map((c, i) => { cg += c.gmv; return { x: round1((i + 1) / n * 100), y: round1(cg / totalGmv * 100) } })]
    const top = [...customers].sort((a, b) => b.gmv - a.gmv).slice(0, 10)
    return { lorenz: pts, top10: top }
  }, [customers])

  const tiles = [
    { icon: 'fa-users',         bg: '#2C3639', label: 'Customers',        value: formatNumber(k.totalCustomers ?? 0) },
    { icon: 'fa-rotate-right',  bg: '#E07B39', label: 'Repeat Customers', value: formatNumber(k.repeatCount ?? 0) },
    { icon: 'fa-percent',       bg: '#A9C5A0', iconColor: '#2C3639', label: 'Repeat Rate', value: `${k.repeatPct ?? 0}%` },
    { icon: 'fa-receipt',       bg: '#6B8E9E', label: 'Avg Orders / Cust', value: k.avgOrders ?? 0 },
  ]

  // ── New vs returning (orders) ──
  const nvrData = (split.ordersFromNew || split.ordersFromReturning) ? {
    labels: ['New (single-order)', 'Returning (repeat)'],
    datasets: [{ data: [split.ordersFromNew, split.ordersFromReturning], backgroundColor: [seriesColor(5), seriesColor(0)] }],
  } : null
  const nvrTotal = (split.ordersFromNew ?? 0) + (split.ordersFromReturning ?? 0) || 1
  const nvrOpts = mergeOptions(baseOptions, { cutout: '58%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, font: { size: 9 } } }, tooltip: { callbacks: { label: c => ` ${formatNumber(c.parsed)} orders (${Math.round((c.parsed / nvrTotal) * 1000) / 10}%)` } } } })

  // ── Lorenz curve (few customers = most revenue?) ──
  const lorenzData = lorenz ? {
    datasets: [
      { label: 'Equality', data: [{ x: 0, y: 0 }, { x: 100, y: 100 }], borderColor: 'rgba(120,120,120,0.5)', borderDash: [4, 3], pointRadius: 0, borderWidth: 1, fill: false },
      { label: 'Customers', data: lorenz, borderColor: seriesColor(0), backgroundColor: withAlpha(seriesColor(0), 0.15), pointRadius: 0, fill: true, tension: 0.1 },
    ],
  } : null
  const lorenzOpts = mergeOptions(baseOptions, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { title: () => '', label: c => `${c.parsed.x}% of customers → ${c.parsed.y}% of revenue` } } },
    scales: {
      x: { type: 'linear', min: 0, max: 100, title: { display: true, text: '% of customers', font: { size: 9 } }, ticks: { callback: v => v + '%', font: { size: 9 } } },
      y: { type: 'linear', min: 0, max: 100, title: { display: true, text: '% of revenue', font: { size: 9 } }, ticks: { callback: v => v + '%', font: { size: 9 } } },
    },
  })

  // ── Top customers (by GMV) ──
  const topBar = top10 ? {
    labels: top10.map(c => c.name || c.username),
    datasets: [{ label: 'GMV', data: top10.map(c => c.gmv), backgroundColor: seriesColor(0) }],
  } : null
  const topOpts = mergeOptions(baseOptions, { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const t = top10[c.dataIndex]; return t ? [`${formatCurrency(t.gmv)}`, `${formatNumber(t.orders)} orders`] : '' } } } }, scales: { x: { ticks: { callback: v => shortRp(v), font: { size: 9 } } }, y: { ticks: { font: { size: 8 } } } } })

  return (
    <CompactPage>
      <CompactTopbar title="Customers" icon="fa-users">
        <span className="text-xs text-dark1/60">Month</span>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2" />
      </CompactTopbar>

      <IconKpiStrip tiles={tiles} />

      {/* Coverage label — partial nature must be visible */}
      <div className="text-[10px] text-dark1/45 mt-1 px-1">
        Based on <b>{formatNumber(k.ordersWithCustomer ?? 0)}</b> orders with customer data
        (<b>{k.coveragePct ?? 0}%</b> of {formatNumber(k.totalOrders ?? 0)} real-sales orders this month).
        Identity = username (customerId is null); earlier orders aren’t counted.
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-2">
        <CompactPanel title="New vs Returning" icon="fa-user-plus">
          {nvrData ? <div style={{ height: 150 }}><Doughnut data={nvrData} options={nvrOpts} /></div> : <Empty text="No customer orders" />}
        </CompactPanel>
        <CompactPanel title="Customer Value (Lorenz)" icon="fa-chart-area"
          headerRight={<span className="text-[9px] text-dark1/40">bowed = few customers drive revenue</span>}>
          {lorenzData ? <div style={{ height: 150 }}><Line data={lorenzData} options={lorenzOpts} /></div> : <Empty text="No customer data" />}
        </CompactPanel>
        <CompactPanel title="Top Customers" icon="fa-crown">
          {topBar ? <div style={{ height: 150 }}><Bar data={topBar} options={topOpts} /></div> : <Empty text="No customer data" />}
        </CompactPanel>
      </div>

      {/* Aggregated-by-customer detail layer */}
      <div className="mt-2">
        <CompactPanel title={`Customers — ${customers.length} (by customer)`} icon="fa-table" bodyClass="p-2">
          <DataGrid data={customers} columns={CUSTOMER_COLUMNS} searchable
            defaultSort={{ key: 'gmv', dir: 'desc' }} pageSize={25} loading={loading}
            emptyText="No customers with order data this month." />
        </CompactPanel>
      </div>
    </CompactPage>
  )
}

function round1(v) { return Math.round(v * 10) / 10 }
