'use client'
import { useEffect, useState } from 'react'
import DataTable from '@/components/table/DataTable'
import ImportModal from '@/components/ui/ImportModal'
import { formatCurrency, formatNumber, formatDate, currentMonth } from '@/lib/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload, faSearch } from '@fortawesome/free-solid-svg-icons'

const PLATFORMS = ['All', 'Shopee', 'TikTok', 'Lazada', 'Tokopedia']
const LIMIT = 25

const COLUMNS = [
  { accessorKey: 'orderDate',        header: 'Date',     cell: ({ getValue }) => formatDate(getValue()) },
  { accessorKey: 'platform',         header: 'Platform' },
  { accessorKey: 'orderId',          header: 'Order ID', cell: ({ getValue }) => <span className="font-mono text-[10px]">{getValue() ?? '—'}</span> },
  { accessorKey: 'customerName',     header: 'Customer', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'customerUsername', header: 'Username', cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'gmv',              header: 'GMV',      cell: ({ getValue }) => formatCurrency(Number(getValue() ?? 0)) },
  { accessorKey: 'nett',             header: 'Nett',     cell: ({ getValue }) => formatCurrency(Number(getValue() ?? 0)) },
  { accessorKey: 'qty',              header: 'Qty',      cell: ({ getValue }) => formatNumber(getValue() ?? 0) },
  { accessorKey: 'status',           header: 'Status',   cell: ({ getValue }) => getValue() ?? '—' },
]

export default function OrdersPage() {
  const [platform, setPlatform]     = useState('')
  const [month, setMonth]           = useState(currentMonth())
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)
  const [data, setData]             = useState([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (platform) params.set('platform', platform.toLowerCase())
    if (month)    params.set('month', month)
    if (search)   params.set('search', search)
    fetch(`/api/orders?${params}`)
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setTotal(d.total ?? 0); setLoading(false) })
      .catch(() => setLoading(false))
  }, [platform, month, search, page])

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
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="absolute left-2 top-1/2 -translate-y-1/2 text-dark1/30 w-3 h-3" />
            <input type="text" placeholder="Search order or customer..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="form-input !w-56 text-xs py-1 pl-7" />
          </div>
          <input type="month" value={month} onChange={e => { setMonth(e.target.value); setPage(1) }}
            className="form-input !w-auto text-xs py-1" />
          <button onClick={() => setShowImport(true)} className="btn btn-outline btn-sm">
            <FontAwesomeIcon icon={faUpload} /> Import
          </button>
        </div>
      </div>
      <div className="sv-main">
        <div className="flex flex-col bg-white rounded-lg shadow-sm overflow-hidden flex-1">
          <div className="sv-panel-header">Orders — {total} records</div>
          <div className="sv-panel-body">
            <DataTable columns={COLUMNS} data={data} total={total} page={page} limit={LIMIT}
              onPageChange={setPage} loading={loading} />
          </div>
        </div>
      </div>
      {showImport && (
        <ImportModal title="Import Orders"
          endpoint="/api/import/orders"
          extraFields={{ platform: platform.toLowerCase() || 'shopee' }}
          onSuccess={() => setPage(1)} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}
