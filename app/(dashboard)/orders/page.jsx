'use client'
import { useEffect, useState } from 'react'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataTable from '@/components/table/DataTable'
import ImportModal from '@/components/ui/ImportModal'
import CrossLink from '@/components/dashboard/CrossLink'
import PlatformBadge from '@/components/ui/PlatformBadge'
import { seriesColor, withAlpha, SEMANTIC, baseOptions, mergeOptions } from '@/lib/charts/theme'
import { formatCurrency, formatNumber, formatDate, currentMonth } from '@/lib/utils'

const PLATFORMS = ['All', 'Shopee', 'TikTok', 'Lazada', 'Tokopedia']
const LIMIT = 25
const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }
const Empty = ({ text = 'No data', h = 140 }) => <div style={{ height: h }} className="flex items-center justify-center text-dark1/30 text-xs">{text}</div>

const COLUMNS = [
  { accessorKey: 'orderDate',        header: 'Date',     cell: ({ getValue }) => formatDate(getValue()) },
  { accessorKey: 'platform',         header: 'Platform', cell: ({ getValue }) => <PlatformBadge platform={getValue()} /> },
  { accessorKey: 'orderId',          header: 'Order ID', cell: ({ getValue }) => <span className="font-mono text-[10px]">{getValue() ?? '—'}</span> },
  { accessorKey: 'customerName',     header: 'Customer', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'gmv',              header: 'GMV',      cell: ({ getValue }) => formatCurrency(Number(getValue() ?? 0)) },
  { accessorKey: 'nett',             header: 'Nett',     cell: ({ getValue }) => formatCurrency(Number(getValue() ?? 0)) },
  { accessorKey: 'qty',              header: 'Qty',      cell: ({ getValue }) => formatNumber(getValue() ?? 0) },
  { accessorKey: 'status',           header: 'Status',   cell: ({ getValue }) => getValue() ?? '—' },
]

export default function OrdersPage() {
  const [platform, setPlatform] = useState('')
  const [month, setMonth]       = useState(currentMonth())
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [rows, setRows]         = useState([])
  const [total, setTotal]       = useState(0)
  const [rowsLoading, setRowsLoading] = useState(true)
  const [sum, setSum]           = useState(null)
  const [showImport, setShowImport] = useState(false)

  // Records (server-paginated, filtered incl. search).
  useEffect(() => {
    setRowsLoading(true)
    const p = new URLSearchParams({ page, limit: LIMIT })
    if (platform) p.set('platform', platform.toLowerCase())
    if (month) p.set('month', month)
    if (search) p.set('search', search)
    fetch(`/api/orders?${p}`).then(r => r.json())
      .then(d => { setRows(d.data ?? []); setTotal(d.total ?? 0); setRowsLoading(false) })
      .catch(() => setRowsLoading(false))
  }, [platform, month, search, page])

  // Summary (KPIs + charts, on platform/month).
  useEffect(() => {
    const p = new URLSearchParams({ month })
    if (platform) p.set('platform', platform.toLowerCase())
    fetch(`/api/orders/summary?${p}`).then(r => r.json()).then(d => setSum(d?.error ? null : d)).catch(() => setSum(null))
  }, [platform, month])

  const k = sum?.kpis ?? {}
  const sizeUnits = sum?.sizeUnits ?? []
  const statuses = sum?.statuses ?? []
  const trend = sum?.trend ?? []

  const tiles = [
    { icon: 'fa-receipt',      bg: '#2C3639', label: 'Orders',    value: formatNumber(k.orders ?? 0) },
    { icon: 'fa-dollar-sign',  bg: '#E07B39', label: 'GMV',       value: formatCurrency(k.gmv ?? 0) },
    { icon: 'fa-scale-balanced', bg: '#6B8E9E', label: 'Avg Order', value: formatCurrency(k.aov ?? 0) },
  ]

  const sizeBar = sizeUnits.length ? {
    labels: sizeUnits.map(b => b.label),
    datasets: [{ label: 'Orders', data: sizeUnits.map(b => b.orders), backgroundColor: seriesColor(0) }],
  } : null
  const sizeOpts = mergeOptions(baseOptions, { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${formatNumber(c.parsed.y)} orders` } } }, scales: { x: { title: { display: true, text: 'Units / order', font: { size: 9 } }, ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } } })

  const statusDonut = statuses.length ? {
    labels: statuses.map(s => s.status),
    datasets: [{ data: statuses.map(s => s.orders), backgroundColor: statuses.map((s, i) => s.excluded ? withAlpha(SEMANTIC.danger, 0.7) : seriesColor(i)) }],
  } : null
  const totalSt = statuses.reduce((a, s) => a + s.orders, 0) || 1
  const statusOpts = mergeOptions(baseOptions, { cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 8, font: { size: 8 } } }, tooltip: { callbacks: { label: c => ` ${formatNumber(c.parsed)} (${Math.round((c.parsed / totalSt) * 1000) / 10}%)` } } } })

  const trendData = trend.length ? {
    labels: trend.map(t => t.period.slice(8) || t.period),
    datasets: [{ label: 'Orders', data: trend.map(t => t.orders), borderColor: seriesColor(0), backgroundColor: withAlpha(seriesColor(0), 0.15), fill: true, tension: 0.3, pointRadius: 1 }],
  } : null
  const trendOpts = mergeOptions(baseOptions, { plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => i[0]?.label, label: c => `${formatNumber(c.parsed.y)} orders` } } }, scales: { x: { ticks: { font: { size: 9 }, maxTicksLimit: 10 } }, y: { ticks: { font: { size: 9 } } } } })

  return (
    <CompactPage>
      <CompactTopbar title="Orders" icon="fa-cart-shopping"
        actions={<>
          <CrossLink href="/analytics/operational" label="View full analysis" />
          <button onClick={() => setShowImport(true)} className="sv-tbtn sv-tbtn-ghost"><i className="fas fa-upload" /> Import</button>
        </>}>
        <select value={platform} onChange={e => { setPlatform(e.target.value); setPage(1) }}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2">
          {PLATFORMS.map(p => <option key={p} value={p === 'All' ? '' : p.toLowerCase()}>{p}</option>)}
        </select>
        <input type="text" placeholder="Search order / customer…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white w-44 focus:outline-none focus:border-dark2" />
        <input type="month" value={month} onChange={e => { setMonth(e.target.value); setPage(1) }}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2" />
      </CompactTopbar>

      <IconKpiStrip tiles={tiles} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-2">
        <CompactPanel title="Order-Size Distribution" icon="fa-chart-column">
          {sizeBar ? <div style={{ height: 140 }}><Bar data={sizeBar} options={sizeOpts} /></div> : <Empty />}
        </CompactPanel>
        <CompactPanel title="Order Status" icon="fa-chart-pie">
          {statusDonut ? <div style={{ height: 140 }}><Doughnut data={statusDonut} options={statusOpts} /></div> : <Empty />}
        </CompactPanel>
        <CompactPanel title="Orders Over Time" icon="fa-chart-line">
          {trendData ? <div style={{ height: 140 }}><Line data={trendData} options={trendOpts} /></div> : <Empty />}
        </CompactPanel>
      </div>

      {/* Records detail layer */}
      <div className="mt-2">
        <CompactPanel title={`Order Records — ${total}`} icon="fa-table" bodyClass="p-0">
          <DataTable columns={COLUMNS} data={rows} total={total} page={page} limit={LIMIT}
            onPageChange={setPage} loading={rowsLoading} variant="clean" />
        </CompactPanel>
      </div>

      {showImport && (
        <ImportModal title="Import Orders" endpoint="/api/import/orders"
          extraFields={{ platform: platform || 'shopee' }}
          onSuccess={() => setPage(1)} onClose={() => setShowImport(false)} />
      )}
    </CompactPage>
  )
}
