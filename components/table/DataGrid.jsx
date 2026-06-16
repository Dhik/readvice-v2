'use client'
import { useState, useMemo } from 'react'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel, getFacetedRowModel,
  getFacetedUniqueValues, flexRender,
} from '@tanstack/react-table'

// ─── DataGrid (generic client-side table) ────────────────────────────────────
// Sort + global search + per-column filter + client pagination, all operating on
// already-fetched rows (NO re-fetch). Built on @tanstack/react-table (the house
// table lib) and styled with .sv-table-clean so it matches existing tables.
//
// NOTE: distinct from components/table/DataTable.jsx, which is SERVER-paginated
// (used by /sales). This one is for analytics aggregates fetched whole.
//
// Column shape:
//   { key, label, sortable?, searchable?, sortType?('string'|'number'|'date'),
//     align?('left'|'right'), render?(row), format?(value),
//     filter?('select'|'range'|false), filterFormat?(value) }
//
// Props: data, columns, searchable, defaultSort {key,dir}, pageSize (0 = show all),
//        emptyText, loading, className.

const SHOW_ALL = 100000

// Type-correct sort comparators (numbers numerically, dates chronologically).
const numericSort  = (a, b, id) => (Number(a.getValue(id)) || 0) - (Number(b.getValue(id)) || 0)
const datetimeSort = (a, b, id) => (new Date(a.getValue(id)).getTime() || 0) - (new Date(b.getValue(id)).getTime() || 0)

export default function DataGrid({
  data = [], columns = [], searchable = false,
  defaultSort, pageSize = 25, emptyText = 'No data', loading = false,
  className = '', onRowClick, extraFields = [],
}) {
  const [sorting, setSorting]             = useState(
    defaultSort ? [{ id: defaultSort.key, desc: defaultSort.dir === 'desc' }] : [])
  const [globalFilter, setGlobalFilter]   = useState('')
  const [columnFilters, setColumnFilters] = useState([])

  const paginate = pageSize > 0

  const columnDefs = useMemo(() => [
    ...columns.map(col => ({
      accessorKey: col.key,
      header: col.label,
      enableSorting: !!col.sortable,
      enableGlobalFilter: !!col.searchable,
      sortingFn: col.sortType === 'date' ? datetimeSort
               : col.sortType === 'number' ? numericSort
               : 'alphanumeric',
      // 'equalsString' coerces both sides to string → works for boolean/number
      // categorical values, not just strings.
      filterFn: col.filter === 'range' ? 'inNumberRange'
              : col.filter === 'select' ? 'equalsString'
              : 'auto',
      cell: info => col.render
        ? col.render(info.row.original)
        : (col.format ? col.format(info.getValue()) : (info.getValue() ?? '—')),
      meta: { align: col.align ?? 'left', filter: col.filter ?? false, filterFormat: col.filterFormat },
    })),
    // Calc-field columns (Part B4) — value resolved per-row via the evaluator (resolve()).
    // `dummy` drives a header dev badge; `onRemove` adds a × (user-defined fields).
    ...extraFields.map(f => ({
      id: `calc_${f.key}`,
      accessorFn: row => f.resolve(row),
      enableSorting: true,
      sortingFn: numericSort,
      header: () => (
        <span className="inline-flex items-center gap-1">
          {f.label}
          <span className="text-[8px] uppercase tracking-wide px-1 rounded bg-dark2/10 text-dark2" title="User-defined calculated field">ƒx</span>
          {f.dummy && <span className="text-[8px] uppercase tracking-wide px-1 rounded bg-orange/15 text-orange" title="Dummy-derived calc field">dev</span>}
          {f.onRemove && <span role="button" onClick={e => { e.stopPropagation(); f.onRemove() }} title="Remove" className="text-dark1/30 hover:text-red-500 cursor-pointer">&times;</span>}
        </span>
      ),
      cell: info => { const v = info.getValue(); return v == null ? '—' : (f.format ? f.format(v) : v) },
      meta: { align: 'right', filter: false },
    })),
  ], [columns, extraFields])

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: { pagination: { pageSize: paginate ? pageSize : SHOW_ALL } },
  })

  const filterCols    = columns.filter(c => c.filter)
  const hasToolbar    = searchable || filterCols.length > 0
  const totalCount    = data.length
  const filteredCount = table.getFilteredRowModel().rows.length
  const pageRows      = table.getRowModel().rows
  const totalPages    = table.getPageCount()
  const colCount      = columns.length + extraFields.length

  const clearAll = () => { setGlobalFilter(''); setColumnFilters([]) }

  return (
    <div className={`flex flex-col ${className}`.trim()}>
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {searchable && (
            <input
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              placeholder="Search…"
              className="form-input !w-auto text-xs py-1"
            />
          )}
          {filterCols.map(col => {
            const column = table.getColumn(col.key)
            if (!column) return null

            if (col.filter === 'select') {
              const opts = [...column.getFacetedUniqueValues().keys()]
                .filter(v => v !== null && v !== undefined && v !== '')
                .sort((a, b) => String(a).localeCompare(String(b)))
              const fmt = col.filterFormat ?? (v => String(v))
              return (
                <select key={col.key}
                  value={column.getFilterValue() ?? ''}
                  onChange={e => column.setFilterValue(e.target.value === '' ? undefined : e.target.value)}
                  className="form-input !w-auto text-xs py-1">
                  <option value="">{col.label}: All</option>
                  {opts.map(v => <option key={String(v)} value={v}>{fmt(v)}</option>)}
                </select>
              )
            }

            if (col.filter === 'range') {
              const [min, max] = column.getFilterValue() ?? [undefined, undefined]
              return (
                <span key={col.key} className="flex items-center gap-1 text-xs text-dark1/40">
                  {col.label}
                  <input type="number" placeholder="min" value={min ?? ''}
                    onChange={e => column.setFilterValue(old => [e.target.value === '' ? undefined : Number(e.target.value), old?.[1]])}
                    className="form-input !w-16 text-xs py-1" />
                  <input type="number" placeholder="max" value={max ?? ''}
                    onChange={e => column.setFilterValue(old => [old?.[0], e.target.value === '' ? undefined : Number(e.target.value)])}
                    className="form-input !w-16 text-xs py-1" />
                </span>
              )
            }
            return null
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="sv-table-clean w-full text-sm">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="text-left text-xs text-dark1/50 border-b border-dark1/10">
                {hg.headers.map(h => {
                  const align   = h.column.columnDef.meta?.align ?? 'left'
                  const canSort = h.column.getCanSort()
                  const sorted  = h.column.getIsSorted()
                  return (
                    <th key={h.id}
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      className={`py-2 px-2 ${align === 'right' ? 'text-right' : 'text-left'} ${canSort ? 'cursor-pointer select-none hover:text-dark1' : ''}`}>
                      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort && <span className="text-[9px] text-dark1/40">{sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}</span>}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} className="py-10 text-center text-dark1/40 text-sm">Loading…</td></tr>
            ) : totalCount === 0 ? (
              <tr><td colSpan={colCount} className="py-10 text-center text-dark1/40 text-sm">{emptyText}</td></tr>
            ) : filteredCount === 0 ? (
              <tr><td colSpan={colCount} className="py-10 text-center text-dark1/40 text-sm">
                No results match your filters.
                <button onClick={clearAll} className="text-orange hover:underline ml-1">Clear</button>
              </td></tr>
            ) : (
              pageRows.map(row => (
                <tr key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={`border-b border-dark1/5 ${onRowClick ? 'cursor-pointer hover:bg-bg/60' : ''}`.trim()}>
                  {row.getVisibleCells().map(cell => {
                    const align = cell.column.columnDef.meta?.align ?? 'left'
                    return (
                      <td key={cell.id} className={`py-1.5 px-2 ${align === 'right' ? 'text-right' : ''}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginate && filteredCount > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-dark1/60">
          <span>{filteredCount}{filteredCount !== totalCount ? ` of ${totalCount}` : ''} rows</span>
          <div className="flex gap-1 items-center">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
              className="btn btn-outline btn-sm disabled:opacity-40">Prev</button>
            <span className="px-2 py-1">Page {table.getState().pagination.pageIndex + 1} / {totalPages}</span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
              className="btn btn-outline btn-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
