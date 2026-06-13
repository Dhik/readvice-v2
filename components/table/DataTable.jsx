'use client'
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'

// `variant`: 'default' (dark header — app standard) or 'clean' (Campaign-style
// light header). Purely visual; columns/data/pagination/handlers are unchanged.
export default function DataTable({ columns, data, total, page, limit, onPageChange, loading, variant = 'default' }) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / limit),
  })

  const totalPages = Math.ceil(total / limit)
  const clean = variant === 'clean'

  const thClass    = clean ? '' : 'bg-dark1 text-white text-xs font-semibold px-3 py-2 text-left whitespace-nowrap border-b-2 border-orange'
  const tdClass    = clean ? '' : 'px-3 py-1.5 border-b border-cream/40 text-dark1/80 text-xs'
  const trClass    = clean ? '' : 'hover:bg-bg/60'
  const emptyClass = clean ? 'text-center py-8 text-sm text-gray-400' : 'text-center py-8 text-dark1/40'

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className={clean ? 'sv-table-clean' : 'sv-table w-full'}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id} className={thClass}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className={emptyClass}>Loading...</td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={emptyClass}>No data found</td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className={trClass}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={tdClass}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t border-cream/40 text-xs text-dark1/60">
        <span>{total} records</span>
        <div className="flex gap-1 items-center">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="btn btn-outline btn-sm disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 py-1">Page {page} / {totalPages || 1}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="btn btn-outline btn-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
