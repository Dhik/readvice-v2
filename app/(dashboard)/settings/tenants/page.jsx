'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import DataTable from '@/components/table/DataTable'
import TenantModal from '@/components/tenant/TenantModal'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'

const LIMIT = 25

export default function TenantsPage() {
  const { data: session } = useSession()
  const perms     = session?.user?.permissions ?? []
  const canView   = perms.includes('view_tenant')
  const canCreate = perms.includes('create_tenant')
  const canUpdate = perms.includes('update_tenant')
  const canDelete = perms.includes('delete_tenant')

  const [data,      setData]      = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [loading,   setLoading]   = useState(false)
  const [editRow,   setEditRow]   = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [features,  setFeatures]  = useState(null)

  // Plan flags for UI gating (no plan logic client-side — just flags).
  const loadFeatures = async () => {
    try {
      const res = await fetch('/api/billing/plan-features')
      if (res.ok) setFeatures(await res.json())
    } catch {}
  }
  useEffect(() => { loadFeatures() }, [])
  const canMultiTenant = features?.hasMultiTenant ?? false

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: LIMIT })
      const res = await fetch(`/api/tenants?${params}`)
      const d   = await res.json()
      setData(d.data  ?? [])
      setTotal(d.total ?? 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (canView) load() }, [page, canView])

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title:              'Delete tenant?',
      text:               'Only tenants with no associated data (users, campaigns, orders, ad spend) can be deleted. This cannot be undone.',
      icon:               'warning',
      showCancelButton:   true,
      confirmButtonColor: '#dc3545',
      confirmButtonText:  'Delete',
    })
    if (!result.isConfirmed) return

    const res = await fetch(`/api/tenants/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Tenant deleted')
      load()
    } else {
      const err = await res.json().catch(() => ({}))
      if (res.status === 409 && err.details) {
        const lines = Object.entries(err.details)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${v} ${k}`)
          .join(', ')
        toast.error(`Cannot delete — has ${lines}`)
      } else {
        toast.error(err.error ?? 'Delete failed')
      }
    }
  }

  const columns = [
    { accessorKey: 'id',   header: '#', cell: ({ getValue }) => <span className="text-dark2/50">{getValue()}</span> },
    {
      accessorKey: 'name', header: 'Name',
      cell: ({ getValue }) => <span className="font-semibold text-dark1">{getValue()}</span>,
    },
    {
      accessorKey: 'slug', header: 'Slug',
      cell: ({ getValue }) => (
        <code className="text-[11px] bg-cream px-1.5 py-0.5 rounded text-dark2">{getValue()}</code>
      ),
    },
    {
      accessorKey: 'isActive', header: 'Status',
      cell: ({ getValue }) => getValue()
        ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Active</span>
        : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">Inactive</span>,
    },
    { accessorKey: 'createdAt', header: 'Created' },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
          {canUpdate && (
            <button
              onClick={() => { setEditRow(row.original); setShowModal(true) }}
              title="Edit"
              className="w-[26px] h-[26px] rounded flex items-center justify-center text-white bg-orange hover:bg-[#c9662a] text-[10px]"
            >
              <i className="fas fa-pencil-alt" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => handleDelete(row.original.id)}
              title="Delete"
              className="w-[26px] h-[26px] rounded flex items-center justify-center border border-cream text-red-500 hover:bg-red-50 text-[10px]"
            >
              <i className="fas fa-trash-alt" />
            </button>
          )}
        </div>
      ),
    },
  ]

  if (!canView) {
    return (
      <div className="sv-page">
        <div className="flex flex-1 items-center justify-center text-dark2/50 text-sm">
          You don&apos;t have permission to view tenants.
        </div>
      </div>
    )
  }

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          <i className="fas fa-building text-orange mr-1" /> Tenant Management
        </span>
        {canCreate && (
          canMultiTenant ? (
            <button
              onClick={() => { setEditRow(null); setShowModal(true) }}
              className="sv-tbtn sv-tbtn-success"
            >
              <i className="fas fa-plus" /> New Tenant
            </button>
          ) : (
            <button
              disabled
              title="Available on Enterprise plan"
              className="sv-tbtn sv-tbtn-success opacity-50 cursor-not-allowed"
            >
              <i className="fas fa-lock" /> New Tenant
            </button>
          )
        )}
      </div>

      <div className="sv-main">
        <div className="sv-panel" style={{ flex: 1 }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              <i className="fas fa-building text-dark2" /> Brands
            </span>
            <span className="text-xs text-dark2/60">{total} tenant{total !== 1 ? 's' : ''}</span>
          </div>
          <div className="sv-panel-body p-0">
            <DataTable
              columns={columns}
              data={data}
              total={total}
              page={page}
              limit={LIMIT}
              onPageChange={setPage}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {showModal && (
        <TenantModal
          tenant={editRow}
          onClose={() => { setShowModal(false); setEditRow(null) }}
          onSuccess={() => { setShowModal(false); setEditRow(null); load() }}
        />
      )}
    </div>
  )
}
