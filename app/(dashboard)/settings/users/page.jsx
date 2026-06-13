'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import DataTable from '@/components/table/DataTable'
import UserModal from '@/components/user/UserModal'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'

const LIMIT = 25

export default function UsersPage() {
  const { data: session } = useSession()
  const perms     = session?.user?.permissions ?? []
  const canView   = perms.includes('view_user')
  const canCreate = perms.includes('create_user')
  const canUpdate = perms.includes('update_user')
  const canDelete = perms.includes('delete_user')

  const [data,      setData]      = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [loading,   setLoading]   = useState(false)
  const [editRow,   setEditRow]   = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [features,  setFeatures]  = useState(null)

  // Plan flags + live user count for the maxUsers gate.
  const loadFeatures = async () => {
    try {
      const res = await fetch('/api/billing/plan-features')
      if (res.ok) setFeatures(await res.json())
    } catch {}
  }
  useEffect(() => { loadFeatures() }, [])
  const maxUsers  = features?.maxUsers ?? null
  const userCount = features?.currentUserCount ?? 0
  const atLimit   = maxUsers != null && userCount >= maxUsers

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: LIMIT })
      const res = await fetch(`/api/users?${params}`)
      const d   = await res.json()
      setData(d.data  ?? [])
      setTotal(d.total ?? 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (canView) load() }, [page, canView])

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title:              `Delete ${name}?`,
      text:               'This action cannot be undone.',
      icon:               'warning',
      showCancelButton:   true,
      confirmButtonColor: '#dc3545',
      confirmButtonText:  'Delete',
    })
    if (!result.isConfirmed) return

    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('User deleted')
      load()
      loadFeatures()   // user count changed → refresh the limit
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Delete failed')
    }
  }

  const columns = [
    {
      accessorKey: 'id', header: '#',
      cell: ({ getValue }) => <span className="text-dark2/50">{getValue()}</span>,
    },
    {
      accessorKey: 'name', header: 'Name',
      cell: ({ getValue }) => <span className="font-semibold text-dark1">{getValue()}</span>,
    },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'roles', header: 'Roles',
      cell: ({ getValue }) => {
        const roles = getValue() ?? []
        if (!roles.length) return <span className="text-dark2/30 text-xs">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map(r => (
              <span key={r.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-dark2/10 text-dark2">
                {r.name}
              </span>
            ))}
          </div>
        )
      },
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
              onClick={() => handleDelete(row.original.id, row.original.name)}
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
          You don&apos;t have permission to view users.
        </div>
      </div>
    )
  }

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          <i className="fas fa-users text-orange mr-1" /> User Management
        </span>
        {canCreate && (
          atLimit ? (
            <button
              disabled
              title={`User limit reached (${userCount}/${maxUsers}). Upgrade to add more users.`}
              className="sv-tbtn sv-tbtn-success opacity-50 cursor-not-allowed"
            >
              <i className="fas fa-lock" /> Limit reached ({userCount}/{maxUsers})
            </button>
          ) : (
            <button
              onClick={() => { setEditRow(null); setShowModal(true) }}
              className="sv-tbtn sv-tbtn-success"
            >
              <i className="fas fa-plus" /> New User
            </button>
          )
        )}
        {canCreate && atLimit && (
          <span className="text-xs text-red-600 ml-1">
            User limit reached ({userCount}/{maxUsers}). <a href="/billing" className="underline font-semibold">Upgrade</a> to add more.
          </span>
        )}
      </div>

      <div className="sv-main">
        <div className="sv-panel" style={{ flex: 1 }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              <i className="fas fa-users text-dark2" /> Users
            </span>
            <span className="text-xs text-dark2/60">{total} user{total !== 1 ? 's' : ''}</span>
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
        <UserModal
          user={editRow}
          onClose={() => { setShowModal(false); setEditRow(null) }}
          onSuccess={() => { setShowModal(false); setEditRow(null); load(); loadFeatures() }}
        />
      )}
    </div>
  )
}
