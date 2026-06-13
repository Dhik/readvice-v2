'use client'
import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import DealingViewModal  from './DealingViewModal'
import ApprovalModal     from './ApprovalModal'
import StaffNotesModal   from './StaffNotesModal'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const STATUS_CLS = { Approve: 'badge-success', Reject: 'badge-danger', Pending: 'badge-warning' }

function getOverall(row) {
  if (row.approvalFromLeaderStatus === 'Approve' && row.approvalFromManagementStatus === 'Approve') return 'Approve'
  if (row.approvalFromLeaderStatus === 'Reject'  || row.approvalFromManagementStatus === 'Reject')  return 'Reject'
  return 'Pending'
}

export default function AffiliateDealingPage() {
  const [tab, setTab]         = useState('all')   // all | queue | staff
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState(null)   // { type, row?, approvalType? }
  const LIMIT = 20

  const load = async () => {
    setLoading(true)
    let url = ''
    const p = new URLSearchParams({ page, limit: LIMIT, search })
    if (tab === 'all')   url = `/api/affiliate/dealing?${p}`
    if (tab === 'queue') url = `/api/affiliate/dealing?${p}&approvalStatus=Pending`
    if (tab === 'staff') url = `/api/affiliate/dealing/staff-actions?${p}`
    const r = await fetch(url).then(r => r.json())
    setRows(r.data ?? [])
    setTotal(r.total ?? 0)
    setLoading(false)
  }

  useEffect(() => { setPage(1) }, [tab])
  useEffect(() => { load() }, [tab, page, search])

  const handleDelete = async (id) => {
    if (!confirm('Delete this dealing?')) return
    const r = await fetch(`/api/affiliate/dealing/${id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Deleted'); load() }
    else toast.error('Delete failed')
  }

  const bulkApprove = async (level) => {
    const url = level === 'leader'
      ? '/api/affiliate/dealing/bulk-leader-approve'
      : '/api/affiliate/dealing/bulk-management-approve'
    const r = await fetch(url, { method: 'PUT' })
    const d = await r.json()
    if (r.ok) { toast.success(`Bulk approved ${d.count} dealings`); load() }
    else toast.error(d.error ?? 'Bulk approve failed')
  }

  const closeModal = () => { setModal(null); load() }
  const totalPages = Math.ceil(total / LIMIT)

  const TABS = [
    { key: 'all',   label: 'All Dealings' },
    { key: 'queue', label: 'Approval Queue' },
    { key: 'staff', label: 'Staff Actions' },
  ]

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <h1 className="sv-title">Affiliate Dealing</h1>
        <div className="flex gap-2">
          {tab === 'queue' && (
            <>
              <button className="sv-btn-outline text-xs" onClick={() => bulkApprove('leader')}>
                Bulk Leader Approve
              </button>
              <button className="sv-btn text-xs" onClick={() => bulkApprove('management')}>
                Bulk Mgmt Approve
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 border-b border-dark2/10 pb-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
                  className={`text-sm px-3 py-1.5 rounded-t transition-colors ${
                    tab === t.key ? 'bg-orange text-white' : 'text-dark2 hover:bg-dark1/10'
                  }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="mb-3">
        <input className="sv-input text-xs py-1 w-56" placeholder="Search username or dealing#..."
               value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>

      {/* Table */}
      <div className="sv-panel flex-1">
        <div className="sv-panel-header">
          <span>{TABS.find(t => t.key === tab)?.label}</span>
          <span className="text-xs text-dark2/60">{total} records</span>
        </div>
        <div className="sv-panel-body p-0">
          <div className="overflow-auto">
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Deal #</th><th>Username</th><th>Platform</th><th>PIC</th>
                  <th className="text-right">Rate Card</th><th className="text-right">Slot</th>
                  <th>SOW</th><th>Leader</th><th>Mgmt</th><th>Overall</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="text-center py-8 text-dark2/50">Loading...</td></tr>
                ) : rows.map(r => {
                  const overall = getOverall(r)
                  return (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.dealingNumber ?? '—'}</td>
                      <td className="font-medium">{r.username}</td>
                      <td>{r.platform ?? '—'}</td>
                      <td>{r.pic ?? '—'}</td>
                      <td className="text-right text-orange">{fmtRp(r.rateCard)}</td>
                      <td className="text-right">{r.slot ?? 0}</td>
                      <td>{r.sowCategory ?? '—'}</td>
                      <td><span className={`sv-badge ${STATUS_CLS[r.approvalFromLeaderStatus] ?? 'badge-warning'}`}>
                        {r.approvalFromLeaderStatus ?? 'Pending'}
                      </span></td>
                      <td><span className={`sv-badge ${STATUS_CLS[r.approvalFromManagementStatus] ?? 'badge-warning'}`}>
                        {r.approvalFromManagementStatus ?? 'Pending'}
                      </span></td>
                      <td><span className={`sv-badge ${STATUS_CLS[overall]}`}>{overall}</span></td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          <button className="sv-btn-outline text-xs py-0.5 px-2"
                                  onClick={() => setModal({ type: 'view', row: r })}>View</button>
                          {tab !== 'staff' && (
                            <>
                              <button className="sv-btn-outline text-xs py-0.5 px-2"
                                      onClick={() => setModal({ type: 'approval', row: r, approvalType: 'leader' })}>
                                Leader
                              </button>
                              <button className="sv-btn-outline text-xs py-0.5 px-2"
                                      onClick={() => setModal({ type: 'approval', row: r, approvalType: 'management' })}>
                                Mgmt
                              </button>
                            </>
                          )}
                          {tab === 'staff' && (
                            <button className="sv-btn text-xs py-0.5 px-2"
                                    onClick={() => setModal({ type: 'staff', row: r })}>Notes</button>
                          )}
                          <button className="sv-btn-outline text-xs py-0.5 px-2 text-red-600 border-red-300"
                                  onClick={() => handleDelete(r.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-8 text-dark2/50">No dealings found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-3">
              <button className="sv-btn-outline text-xs" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Prev</button>
              <span className="text-xs text-dark2/60">{page} / {totalPages}</span>
              <button className="sv-btn-outline text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Next</button>
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'view'     && <DealingViewModal row={modal.row} onClose={closeModal} />}
      {modal?.type === 'approval' && <ApprovalModal row={modal.row} type={modal.approvalType} onClose={closeModal} />}
      {modal?.type === 'staff'    && <StaffNotesModal row={modal.row} onClose={closeModal} />}
    </div>
  )
}
