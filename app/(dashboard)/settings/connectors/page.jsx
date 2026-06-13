'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import ConnectorFormModal from '@/components/connectors/ConnectorFormModal'
import { CONNECTOR_TYPES } from '@/lib/connectors/transforms'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'

function fmtDate(d) {
  return d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

export default function ConnectorsPage() {
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false

  const [rows, setRows]         = useState([])
  const [tenants, setTenants]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [tenantFilter, setTenantFilter] = useState('')
  const [typeFilter, setTypeFilter]     = useState('')
  const [showModal, setShowModal]       = useState(false)
  const [editRow, setEditRow]           = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tenantFilter) params.set('tenantId', tenantFilter)
      if (typeFilter)   params.set('connectorType', typeFilter)
      const res = await fetch(`/api/connectors?${params}`)
      const d   = await res.json()
      setRows(d.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [tenantFilter, typeFilter])

  useEffect(() => { if (isSuperAdmin) load() }, [isSuperAdmin, load])

  // Tenant dropdown (all active tenants — superadmin endpoint).
  useEffect(() => {
    if (!isSuperAdmin) return
    fetch('/api/tenant/list').then(r => r.json()).then(d => setTenants(d.tenants ?? d.data ?? [])).catch(() => {})
  }, [isSuperAdmin])

  async function handleSync(id, name) {
    const t = toast.loading(`Syncing "${name}"…`)
    try {
      const res = await fetch(`/api/connectors/${id}/sync`, { method: 'POST' })
      const d   = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Imported ${d.imported}, Updated ${d.updated}, Skipped ${d.skipped}`, { id: t })
        load() // refresh lastSyncAt
      } else {
        toast.error(d.error ?? 'Sync failed', { id: t })
      }
    } catch {
      toast.error('Sync request failed', { id: t })
    }
  }

  async function handleDelete(id, name) {
    const r = await Swal.fire({
      title: `Delete "${name}"?`, text: 'This connector configuration will be removed.',
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Delete',
    })
    if (!r.isConfirmed) return
    const res = await fetch(`/api/connectors/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Connector deleted'); load() }
    else { const e = await res.json().catch(() => ({})); toast.error(e.error ?? 'Delete failed') }
  }

  if (session && !isSuperAdmin) {
    return (
      <div className="sv-page">
        <div className="flex flex-1 items-center justify-center text-dark2/50 text-sm">
          Connectors are restricted to superadmins.
        </div>
      </div>
    )
  }

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <span className="sv-topbar-title"><i className="fas fa-plug text-orange mr-1" /> Data Connectors</span>

        <select className="form-input !w-auto text-xs py-1 ml-2" value={tenantFilter} onChange={e => setTenantFilter(e.target.value)}>
          <option value="">All tenants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="form-input !w-auto text-xs py-1" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {CONNECTOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <button onClick={() => { setEditRow(null); setShowModal(true) }} className="sv-tbtn sv-tbtn-success ml-auto">
          <i className="fas fa-plus" /> New Connector
        </button>
      </div>

      <div className="sv-main">
        <div className="sv-panel" style={{ flex: 1 }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title"><i className="fas fa-plug text-dark2" /> Connectors</span>
            <span className="text-xs text-dark2/60">{rows.length} connector{rows.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="sv-panel-body p-0 overflow-auto">
            {loading ? (
              <div className="text-center text-dark2/40 text-xs py-8">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="text-center text-dark2/40 text-xs py-8">No connectors. Click “New Connector” to add one.</div>
            ) : (
              <table className="sv-table-clean">
                <thead>
                  <tr>
                    <th>Name</th><th>Tenant</th><th>Type</th><th>Target</th><th>Last Sync</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(c => (
                    <tr key={c.id}>
                      <td className="font-medium text-dark1">{c.name}</td>
                      <td>{c.tenant?.name ?? c.tenantId}</td>
                      <td><code className="text-[11px] bg-cream px-1.5 py-0.5 rounded text-dark2">{c.connectorType}</code></td>
                      <td>{c.targetTable}</td>
                      <td className="text-[11px]">{fmtDate(c.lastSyncAt)}</td>
                      <td>
                        {c.isActive
                          ? <span className="badge badge-success">Active</span>
                          : <span className="badge badge-warning">Inactive</span>}
                      </td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleSync(c.id, c.name)}
                            title="Run sync" className="w-[26px] h-[26px] rounded flex items-center justify-center border border-cream text-dark2 hover:bg-bg text-[10px]">
                            <i className="fas fa-vial" />
                          </button>
                          <button onClick={() => { setEditRow(c); setShowModal(true) }}
                            title="Edit" className="w-[26px] h-[26px] rounded flex items-center justify-center text-white bg-orange hover:bg-[#c9662a] text-[10px]">
                            <i className="fas fa-pencil-alt" />
                          </button>
                          <button onClick={() => handleDelete(c.id, c.name)}
                            title="Delete" className="w-[26px] h-[26px] rounded flex items-center justify-center border border-cream text-red-500 hover:bg-red-50 text-[10px]">
                            <i className="fas fa-trash-alt" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <ConnectorFormModal
          connector={editRow}
          tenants={tenants}
          onClose={() => { setShowModal(false); setEditRow(null) }}
          onSuccess={() => { setShowModal(false); setEditRow(null); load() }}
        />
      )}
    </div>
  )
}
