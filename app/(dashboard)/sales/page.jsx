'use client'
import { useEffect, useState } from 'react'
import KpiStrip from '@/components/ui/KpiStrip'
import DataTable from '@/components/table/DataTable'
import ChartPanel from '@/components/charts/ChartPanel'
import ImportModal from '@/components/ui/ImportModal'
import SyncButton from '@/components/ui/SyncButton'
import DateRangePicker from '@/components/ui/DateRangePicker'
import { formatCurrency, formatNumber, formatDate, currentMonth } from '@/lib/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload } from '@fortawesome/free-solid-svg-icons'

const PLATFORMS = ['All', 'Shopee', 'TikTok', 'Lazada', 'Tokopedia']
const PLATFORM_COLORS = ['#E07B39', '#2C3639', '#3F4E4F', '#DCD7C9', '#8B5E3C']
const LIMIT = 25

const COLUMNS = [
  { accessorKey: 'orderDate', header: 'Date',     cell: ({ getValue }) => formatDate(getValue()) },
  { accessorKey: 'platform',  header: 'Platform' },
  { accessorKey: 'orderId',   header: 'Order ID', cell: ({ getValue }) => <span className="font-mono text-[10px]">{getValue() ?? '—'}</span> },
  { accessorKey: 'gmv',       header: 'GMV',      cell: ({ getValue }) => formatCurrency(Number(getValue() ?? 0)) },
  { accessorKey: 'nett',      header: 'Nett',     cell: ({ getValue }) => formatCurrency(Number(getValue() ?? 0)) },
  { accessorKey: 'qty',       header: 'Qty',      cell: ({ getValue }) => formatNumber(getValue() ?? 0) },
  { accessorKey: 'status',    header: 'Status',   cell: ({ getValue }) => getValue() ?? '—' },
]

export default function SalesPage() {
  const [platform, setPlatform]     = useState('')
  const [month, setMonth]           = useState(currentMonth())
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [page, setPage]             = useState(1)
  const [data, setData]             = useState([])
  const [total, setTotal]           = useState(0)
  const [summary, setSummary]       = useState(null)
  const [split, setSplit]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [showImport, setShowImport] = useState(false)

  // A custom date range (both ends set) overrides the month filter.
  const rangeActive = Boolean(startDate && endDate)

  function buildQS(extra = {}) {
    const p = new URLSearchParams({ limit: LIMIT, ...extra })
    if (platform) p.set('platform', platform.toLowerCase())
    if (rangeActive) {
      p.set('startDate', startDate)
      p.set('endDate', endDate)
    } else if (month) {
      p.set('month', month)
    }
    return p.toString()
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/sales?${buildQS({ page })}`).then(r => r.json()),
      fetch(`/api/sales/summary?${buildQS()}`).then(r => r.json()),
      fetch(`/api/sales/platform-split?${buildQS()}`).then(r => r.json()),
    ]).then(([rows, sum, plat]) => {
      setData(rows.data ?? [])
      setTotal(rows.total ?? 0)
      setSummary(sum)
      setSplit(Array.isArray(plat) ? plat : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [platform, month, startDate, endDate, page])

  const kpiTiles = [
    { label: 'GMV',       value: formatCurrency(summary?.total_gmv   ?? 0) },
    { label: 'Nett',      value: formatCurrency(summary?.total_nett  ?? 0) },
    { label: 'Orders',    value: formatNumber(summary?.total_orders  ?? 0) },
    { label: 'Total Qty', value: formatNumber(summary?.total_qty     ?? 0) },
    { label: 'Avg Order', value: summary?.total_orders ? formatCurrency((summary.total_gmv / summary.total_orders) || 0) : '—' },
  ]

  // Real platform GMV split for the donut. Null when there's no data → the
  // chart hides the "Mix" tab instead of showing fabricated numbers.
  const donutData = split.length ? {
    labels:   split.map(s => s.platform),
    datasets: [{
      data:            split.map(s => s.gmv),
      backgroundColor: split.map((_, i) => PLATFORM_COLORS[i % PLATFORM_COLORS.length]),
    }],
  } : null

  return (
    <div className="sv-page">
      <div className="sv-filter-bar">
        <div className="flex gap-1 tab-pills">
          {PLATFORMS.map(p => (
            <button key={p} onClick={() => { setPlatform(p === 'All' ? '' : p); setPage(1) }}
              className={`tab-pill ${(p === 'All' ? '' : p) === platform ? 'active' : ''}`}>{p}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <input type="month" value={month} disabled={rangeActive}
            onChange={e => { setMonth(e.target.value); setPage(1) }}
            className="form-input !w-auto text-xs py-1 disabled:opacity-40" />
          <DateRangePicker label="Range" startDate={startDate} endDate={endDate}
            onStartChange={v => { setStartDate(v); setPage(1) }}
            onEndChange={v => { setEndDate(v); setPage(1) }} />
          {rangeActive && (
            <button onClick={() => { setStartDate(''); setEndDate(''); setPage(1) }}
              className="text-xs text-orange hover:underline">Clear range</button>
          )}
          <button onClick={() => setShowImport(true)} className="btn btn-outline btn-sm">
            <FontAwesomeIcon icon={faUpload} /> Import
          </button>
          <SyncButton endpoint="/api/import/gs/orders/cleora-shopee" label="Sync GSheet" />
        </div>
      </div>

      <KpiStrip tiles={kpiTiles} cols={5} />

      <div className="sv-main">
        <div className="sv-table-panel">
          <div className="sv-panel-header">Sales — {total} records</div>
          <div className="sv-panel-body">
            <DataTable columns={COLUMNS} data={data} total={total} page={page} limit={LIMIT}
              onPageChange={setPage} loading={loading} />
          </div>
        </div>
        <div className="sv-chart-panel">
          <div className="sv-panel-header">Chart</div>
          <ChartPanel
            lineData={data.length ? {
              labels: data.slice(0, 10).map(d => formatDate(d.orderDate)),
              datasets: [{ label: 'GMV', data: data.slice(0, 10).map(d => Number(d.gmv ?? 0)),
                borderColor: '#E07B39', backgroundColor: 'rgba(224,123,57,0.1)', fill: true, tension: 0.4 }],
            } : null}
            donutData={donutData}
          />
        </div>
      </div>

      {showImport && (
        <ImportModal title="Import Orders"
          endpoint={`/api/import/orders?platform=${platform.toLowerCase() || 'shopee'}`}
          onSuccess={() => setPage(1)} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}
