'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  flexRender, createColumnHelper,
} from '@tanstack/react-table'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

const CHANNEL_COLORS = {
  'Instagram feed':  '#E4405F',
  'Instagram story': '#8A3AB9',
  'TikTok video':    '#000000',
  'TikTok live':     '#FF0050',
  'youtube video':   '#FF0000',
  'twitter post':    '#1DA1F2',
  'shopee video':    '#EE4D2D',
}

function getColorFromText(text) {
  if (!text || text === 'N/A') return '#6c757d'
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash % 360)}, 65%, 45%)`
}

const columnHelper = createColumnHelper()

export default function ContentTable({
  campaignId,
  filterPlatform,
  filterFyp,
  filterPayment,
  filterDelivery,
  filterPic,
  onEdit,
  onDetail,
}) {
  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [toggleState, setToggleState] = useState({})

  // Read optimistic override first, fall back to row value from the server.
  function flagVal(rowId, key, rowDefault) {
    return toggleState[rowId]?.[key] ?? rowDefault
  }

  async function handleToggle(id, flag, endpoint, currentVal) {
    setToggleState(s => ({ ...s, [id]: { ...s[id], [flag]: !currentVal } }))
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error()
    } catch {
      setToggleState(s => ({ ...s, [id]: { ...s[id], [flag]: currentVal } }))
      toast.error('Toggle failed')
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setToggleState({})
    try {
      const params = new URLSearchParams()
      if (filterPlatform) params.set('filterPlatform', filterPlatform)
      if (filterFyp)      params.set('filterFyp', 'true')
      if (filterPayment)  params.set('filterPayment', 'true')
      if (filterDelivery) params.set('filterDelivery', 'true')
      if (filterPic)      params.set('filterPic', filterPic)
      const res = await fetch(`/api/campaigns/${campaignId}/contents?` + params.toString())
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } finally {
      setLoading(false)
    }
  }, [campaignId, filterPlatform, filterFyp, filterPayment, filterDelivery, filterPic])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    const result = await Swal.fire({
      title: 'Delete content entry?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Delete',
    })
    if (!result.isConfirmed) return
    await fetch(`/api/campaign-contents/${id}`, { method: 'DELETE' })
    toast.success('Deleted')
    load()
  }

  async function handleRowRefresh(id) {
    await fetch(`/api/campaign-contents/${id}/refresh`)
    toast.success('Stats refreshed')
    load()
  }

  const columns = [
    columnHelper.accessor('username', {
      header: 'Influencer / Platform',
      cell: info => {
        const row = info.row.original
        const ch = row.channel ?? ''
        const color = CHANNEL_COLORS[ch] ?? '#6c757d'
        return (
          <div>
            <div className="font-semibold text-dark1 text-xs">{info.getValue()}</div>
            {ch && (
              <div className="text-[10px] italic mt-0.5" style={{ color }}>
                {ch}
              </div>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor('creator_name', {
      header: 'Talent / PIC',
      cell: info => {
        const row = info.row.original
        const pic = row.pic ?? ''
        return (
          <div>
            <div className="text-xs text-dark1">{info.getValue() ?? '—'}</div>
            {pic && (
              <div className="text-[10px] italic font-semibold mt-0.5"
                style={{ color: getColorFromText(pic) }}>
                {pic}
              </div>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor('product', {
      header: 'Product / Task',
      cell: info => {
        const row = info.row.original
        const task = row.task ?? ''
        return (
          <div>
            <div className="font-semibold text-xs text-dark1">{info.getValue() ?? '—'}</div>
            {task && (
              <div className="text-[10px] italic mt-0.5"
                style={{ color: getColorFromText(task) }}>
                {task}
              </div>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor('rate_card_formatted', {
      header: () => <span className="block text-right">Rate Card</span>,
      cell: info => <span className="block text-right text-xs text-dark2">{info.getValue()}</span>,
    }),
    columnHelper.accessor('like', {
      header: () => <span className="block text-right">Likes</span>,
      cell: info => <span className="block text-right text-xs">{(info.getValue() ?? 0).toLocaleString()}</span>,
    }),
    columnHelper.accessor('comment', {
      header: () => <span className="block text-right">Comments</span>,
      cell: info => <span className="block text-right text-xs">{(info.getValue() ?? 0).toLocaleString()}</span>,
    }),
    columnHelper.accessor('view', {
      header: () => <span className="block text-right">Views</span>,
      cell: info => <span className="block text-right text-xs">{(info.getValue() ?? 0).toLocaleString()}</span>,
    }),
    columnHelper.accessor('cpm', {
      header: () => <span className="block text-right">CPM</span>,
      cell: info => <span className="block text-right text-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor('engagement_rate', {
      header: () => <span className="block text-right">ER</span>,
      cell: info => <span className="block text-right text-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor('gmv', {
      header: () => <span className="block text-right">GMV</span>,
      cell: info => <span className="block text-right text-xs font-semibold text-dark1">{info.getValue()}</span>,
    }),
    columnHelper.accessor('kol_followers', {
      header: () => <span className="block text-right">Followers / Tier</span>,
      cell: info => {
        const row = info.row.original
        return (
          <div className="text-right">
            <div className="text-xs">{(info.getValue() ?? 0).toLocaleString()}</div>
            {row.tiering && <div className="text-[10px] text-dark2">{row.tiering}</div>}
          </div>
        )
      },
    }),
    columnHelper.display({
      id: 'status',
      header: 'Status',
      cell: info => {
        const row = info.row.original
        const isFyp       = flagVal(row.id, 'is_fyp',       row.is_fyp)
        const isPaid      = flagVal(row.id, 'is_paid',      row.is_paid)
        const isDelivered = flagVal(row.id, 'is_delivered', row.is_delivered)
        return (
          <div className="flex gap-1">
            <button
              className={`sv-toggle-btn${isFyp ? ' active' : ''}`}
              title="FYP"
              onClick={() => handleToggle(row.id, 'is_fyp', `/api/campaign-contents/${row.id}/fyp`, isFyp)}>
              <i className="fas fa-fire"></i>
            </button>
            <button
              className={`sv-toggle-btn${isPaid ? ' active green' : ''}`}
              title="Payment"
              onClick={() => handleToggle(row.id, 'is_paid', `/api/campaign-contents/${row.id}/payment`, isPaid)}>
              <i className="fas fa-check-circle"></i>
            </button>
            <button
              className={`sv-toggle-btn${isDelivered ? ' active blue' : ''}`}
              title="Delivered"
              onClick={() => handleToggle(row.id, 'is_delivered', `/api/campaign-contents/${row.id}/deliver`, isDelivered)}>
              <i className="fas fa-box"></i>
            </button>
          </div>
        )
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: info => {
        const row = info.row.original
        return (
          <div className="flex gap-1 justify-end">
            <button onClick={() => onEdit(row)}
              className="w-[24px] h-[24px] rounded flex items-center justify-center text-white bg-orange hover:bg-[#c9662a] text-[9px]">
              <i className="fas fa-pencil-alt"></i>
            </button>
            <button onClick={() => handleDelete(row.id)}
              className="w-[24px] h-[24px] rounded flex items-center justify-center border border-cream text-red-500 hover:bg-red-50 text-[9px]">
              <i className="fas fa-trash-alt"></i>
            </button>
            <button onClick={() => handleRowRefresh(row.id)}
              className="w-[24px] h-[24px] rounded flex items-center justify-center border border-cream text-dark2 hover:bg-bg text-[9px]">
              <i className="fas fa-sync-alt"></i>
            </button>
            <button onClick={() => onDetail(row.id)}
              className="w-[24px] h-[24px] rounded flex items-center justify-center text-white bg-dark1 hover:bg-dark2 text-[9px]">
              <i className="fas fa-chart-line"></i>
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
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="overflow-x-auto">
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
                No content entries
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map(row => (
              <tr key={row.id}
                className="border-b border-cream/50 hover:bg-bg/30 transition-colors">
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
      <div className="px-3 py-1.5 border-t border-cream bg-[#fafaf8] text-[10px] text-dark2">
        {data.length} entries
      </div>
    </div>
  )
}
