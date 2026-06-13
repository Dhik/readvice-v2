'use client'
import { useEffect, useState, useCallback } from 'react'
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

const TYPE_CHIP_COLORS = { creative: '#3F4E4F', kol: '#E07B39', clipper: '#2C3639', affiliate: '#8B5E3C' }
const TYPE_LABELS = { creative: 'Creative', kol: 'KOL', clipper: 'Clipper', affiliate: 'Affiliate Talent' }

function formatIDR(v) { return new Intl.NumberFormat('id-ID').format(Math.round(v ?? 0)) }
function roiColor(roi) {
  if (roi >= 2) return '#2C6E3F'
  if (roi >= 1) return '#E07B39'
  return '#dc3545'
}

const LIMIT = 25
const columnHelper = createColumnHelper()

export default function CampaignTable({ type, filterMonth, filterDates, search, showTypeCol, onDataLoaded }) {
  const [data, setData]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT })
      if (type)        params.set('type', type)
      if (filterMonth) params.set('filterMonth', filterMonth)
      if (filterDates) params.set('filterDates', filterDates)
      if (search)      params.set('search', search)
      const res = await fetch('/api/campaigns?' + params.toString())
      const json = await res.json()
      setData(json.data ?? [])
      setTotal(json.total ?? 0)
      if (onDataLoaded) onDataLoaded()
    } finally {
      setLoading(false)
    }
  }, [type, filterMonth, filterDates, search, page, onDataLoaded])

  useEffect(() => { setPage(1) }, [type, filterMonth, filterDates, search])
  useEffect(() => { load(page) }, [page, type, filterMonth, filterDates, search])

  async function handleRefresh(id) {
    await fetch(`/api/campaigns/${id}/refresh`)
    toast.success('Refreshed')
    load(page)
  }

  async function handleDelete(id) {
    const result = await Swal.fire({
      title: 'Delete campaign?',
      text: 'This will also delete all content entries.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Delete',
    })
    if (!result.isConfirmed) return
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    toast.success('Deleted')
    load(page)
    if (onDataLoaded) onDataLoaded()
  }

  const typeColumn = columnHelper.accessor('type', {
    header: 'Type',
    cell: info => {
      const t = info.getValue()
      return (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white whitespace-nowrap"
          style={{ background: TYPE_CHIP_COLORS[t] ?? '#6c757d' }}>
          {TYPE_LABELS[t] ?? t}
        </span>
      )
    },
  })

  const columns = [
    columnHelper.accessor('title', {
      header: 'Campaign',
      cell: info => (
        <Link href={`/campaign/${info.row.original.id}/show`}
          className="font-semibold text-dark1 hover:text-orange no-underline text-xs">
          {info.getValue()}
        </Link>
      ),
    }),
    ...(showTypeCol ? [typeColumn] : []),
    columnHelper.accessor('total_expense', {
      header: () => <span className="block text-right">Spend</span>,
      cell: info => <span className="block text-right text-xs text-dark2">{formatIDR(info.getValue())}</span>,
    }),
    columnHelper.accessor('cpm', {
      header: () => <span className="block text-right">CPM</span>,
      cell: info => <span className="block text-right text-xs">{formatIDR(info.getValue())}</span>,
    }),
    columnHelper.accessor('view', {
      header: () => <span className="block text-right">Views</span>,
      cell: info => <span className="block text-right text-xs">{formatIDR(info.getValue())}</span>,
    }),
    columnHelper.accessor('roi', {
      header: () => <span className="block text-right">ROI</span>,
      cell: info => {
        const v = info.getValue()
        return (
          <span className="block text-right">
            <span className="text-xs font-bold px-1 rounded"
              style={{ color: roiColor(v), background: roiColor(v) + '22' }}>
              {v}×
            </span>
          </span>
        )
      },
    }),
    columnHelper.accessor('gmv', {
      header: () => <span className="block text-right">GMV</span>,
      cell: info => (
        <span className="block text-right text-xs font-semibold text-dark1">
          {formatIDR(info.getValue())}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: info => {
        const row = info.row.original
        return (
          <div className="flex gap-1 justify-end">
            <Link href={`/campaign/${row.id}/show`}
              className="w-[26px] h-[26px] rounded flex items-center justify-center text-white bg-dark1 hover:bg-dark2 no-underline text-[10px]">
              <i className="fas fa-eye"></i>
            </Link>
            <Link href={`/campaign/${row.id}/edit`}
              className="w-[26px] h-[26px] rounded flex items-center justify-center text-white bg-orange hover:bg-[#c9662a] no-underline text-[10px]">
              <i className="fas fa-pencil-alt"></i>
            </Link>
            <button onClick={() => handleRefresh(row.id)}
              className="w-[26px] h-[26px] rounded flex items-center justify-center border border-cream text-dark2 hover:bg-bg text-[10px]">
              <i className="fas fa-sync-alt"></i>
            </button>
            <button onClick={() => handleDelete(row.id)}
              className="w-[26px] h-[26px] rounded flex items-center justify-center border border-cream text-red-500 hover:bg-red-50 text-[10px]">
              <i className="fas fa-trash-alt"></i>
            </button>
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="bg-[#fafaf8] border-b border-cream">
                {hg.headers.map(h => (
                  <th key={h.id}
                    className="px-2 py-1.5 text-left text-[10px] font-semibold text-dark2 uppercase tracking-wide whitespace-nowrap">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-sm text-gray-400">
                  <i className="fas fa-spinner fa-spin mr-2"></i>Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-sm text-gray-400">
                  No campaigns found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id}
                  className="border-b border-cream/50 hover:bg-bg/50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-2 py-1.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-2 py-1.5 border-t border-cream bg-[#fafaf8] flex-shrink-0">
        <span className="text-[10px] text-dark2">{total} records</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-[10px] px-2 py-0.5 rounded border border-cream text-dark2 disabled:opacity-40 hover:bg-bg">
            &#8249; Prev
          </button>
          <span className="text-[10px] text-dark2">Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="text-[10px] px-2 py-0.5 rounded border border-cream text-dark2 disabled:opacity-40 hover:bg-bg">
            Next &#8250;
          </button>
        </div>
      </div>
    </div>
  )
}
