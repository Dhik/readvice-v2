'use client'
import { useEffect, useState } from 'react'
import DataTable from '@/components/table/DataTable'
import { formatCurrency, formatDate, currentMonth } from '@/lib/utils'

const LIMIT = 25

const COLUMNS = [
  { accessorKey: 'customerName',     header: 'Customer',  cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'customerUsername', header: 'Username',  cell: ({ getValue }) => getValue() ?? '—' },
  { accessorKey: 'platform',         header: 'Platform' },
  { accessorKey: 'orderDate',        header: 'Last Order', cell: ({ getValue }) => formatDate(getValue()) },
  { accessorKey: 'gmv',              header: 'GMV',       cell: ({ getValue }) => formatCurrency(Number(getValue() ?? 0)) },
  { accessorKey: 'nett',             header: 'Nett',      cell: ({ getValue }) => formatCurrency(Number(getValue() ?? 0)) },
]

export default function CustomerPage() {
  const [month, setMonth]   = useState(currentMonth())
  const [page, setPage]     = useState(1)
  const [data, setData]     = useState([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (month) params.set('month', month)
    fetch(`/api/orders?${params}`)
      .then(r => r.json())
      .then(d => {
        const customers = (d.data ?? []).filter(o => o.customerName || o.customerUsername)
        setData(customers)
        setTotal(d.total ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [month, page])

  return (
    <div className="sv-page">
      <div className="sv-filter-bar">
        <span className="text-sm font-semibold text-dark1">Customer Cohort</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-dark1/60">Month:</span>
          <input type="month" value={month} onChange={e => { setMonth(e.target.value); setPage(1) }}
            className="form-input !w-auto text-xs py-1" />
        </div>
      </div>
      <div className="sv-main">
        <div className="flex flex-col bg-white rounded-lg shadow-sm overflow-hidden flex-1">
          <div className="sv-panel-header">Customers — {total} records</div>
          <div className="sv-panel-body">
            <DataTable columns={COLUMNS} data={data} total={total} page={page} limit={LIMIT}
              onPageChange={setPage} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  )
}
