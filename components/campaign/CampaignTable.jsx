'use client'
import { useState } from 'react'
import DataTable from '@/components/table/DataTable'
import Badge from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencilAlt, faTrash } from '@fortawesome/free-solid-svg-icons'

const STATUS_BADGE = {
  active:    'success',
  completed: 'info',
  cancelled: 'danger',
}

export default function CampaignTable({ data, total, page, limit, onPageChange, loading, onEdit, onDelete }) {
  const columns = [
    { accessorKey: 'title',     header: 'Title',    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
    { accessorKey: 'platform',  header: 'Platform', cell: ({ getValue }) => getValue() ?? '—' },
    { accessorKey: 'purpose',   header: 'Purpose',  cell: ({ getValue }) => getValue() ?? '—' },
    {
      accessorKey: 'budget',
      header: 'Budget',
      cell: ({ getValue }) => formatCurrency(Number(getValue() ?? 0)),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <Badge variant={STATUS_BADGE[getValue()] ?? 'info'}>{getValue()}</Badge>,
    },
    {
      accessorKey: 'startDate',
      header: 'Start',
      cell: ({ getValue }) => getValue() ? formatDate(getValue()) : '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => onEdit?.(row.original)} className="btn btn-outline btn-sm">
            <FontAwesomeIcon icon={faPencilAlt} />
          </button>
          <button onClick={() => onDelete?.(row.original.id)} className="btn btn-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      page={page}
      limit={limit}
      onPageChange={onPageChange}
      loading={loading}
    />
  )
}
