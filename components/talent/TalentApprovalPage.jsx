'use client'
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

function AddEditModal({ item, onClose, onSaved }) {
  const isEdit = !!item
  const [name,    setName]    = useState(item?.name    ?? '')
  const [photo,   setPhoto]   = useState(item?.photo   ?? '')
  const [saving,  setSaving]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const url    = isEdit ? `/api/approval/${item.id}` : '/api/approval'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), photo: photo.trim() || null }),
      })
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Updated' : 'Created')
      onSaved(); onClose()
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-sm">
        <div className="modal-header">
          <h3 className="font-semibold text-dark1">{isEdit ? 'Edit' : 'Add'} Approval</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Name <span className="text-red-500">*</span></label>
              <input
                type="text" className="form-input" placeholder="Approval name"
                value={name} onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Photo URL</label>
              <input
                type="text" className="form-input" placeholder="https://..."
                value={photo} onChange={e => setPhoto(e.target.value)}
              />
              {photo && (
                <div className="mt-2 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="preview" className="w-16 h-16 rounded-full object-cover border border-cream/60" />
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ViewModal({ item, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-xs">
        <div className="modal-header">
          <h3 className="font-semibold text-dark1">Approval Detail</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body flex flex-col items-center gap-4">
          {item.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photo} alt={item.name} className="w-20 h-20 rounded-full object-cover border-2 border-orange/40" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-cream/60 flex items-center justify-center text-2xl font-bold text-dark2">
              {item.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="text-center">
            <div className="font-semibold text-dark1 text-base">{item.name}</div>
            <div className="text-xs text-dark1/50 mt-1">ID #{item.id}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-outline w-full">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function TalentApprovalPage() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [modal,   setModal]   = useState(null) // 'add' | 'edit' | 'view'
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/approval')
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id, name) {
    if (!confirm(`Delete approval "${name}"?`)) return
    try {
      const res = await fetch(`/api/approval/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Deleted')
      load()
    } catch { toast.error('Failed') }
  }

  const filtered = search.trim()
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <div className="sv-page p-3">
      {/* Topbar */}
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          <i className="fas fa-check-circle text-orange"></i> Approvals
        </span>
        <input
          type="text" placeholder="Search name..." className="form-input text-xs h-7 w-48"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <button
          onClick={() => { setSelected(null); setModal('add') }}
          className="sv-tbtn sv-tbtn-primary ml-auto"
        >
          <i className="fas fa-plus"></i> Add Approval
        </button>
      </div>

      {/* Table */}
      <div className="sv-panel flex-1">
        <div className="sv-panel-header">
          <span className="font-semibold text-xs text-dark1">
            Approval List — {filtered.length} records
          </span>
        </div>
        <div className="sv-panel-body p-0 overflow-auto">
          <table className="sv-table w-full">
            <thead>
              <tr>
                <th style={{ width: 48 }}>Photo</th>
                <th>Name</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="text-center py-8 text-dark1/40">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-dark1/40">No approvals</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id}>
                  <td>
                    {item.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photo} alt={item.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-cream/60 flex items-center justify-center text-xs font-bold text-dark2">
                        {item.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                  </td>
                  <td className="font-medium">{item.name}</td>
                  <td className="whitespace-nowrap">
                    <button
                      onClick={() => { setSelected(item); setModal('view') }}
                      className="sv-tbtn sv-tbtn-outline mr-1" title="View"
                    >
                      <i className="fas fa-eye"></i>
                    </button>
                    <button
                      onClick={() => { setSelected(item); setModal('edit') }}
                      className="sv-tbtn sv-tbtn-outline mr-1" title="Edit"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="sv-tbtn" style={{ color: '#dc3545' }} title="Delete"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <AddEditModal
          item={modal === 'edit' ? selected : null}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      {modal === 'view' && selected && (
        <ViewModal item={selected} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
