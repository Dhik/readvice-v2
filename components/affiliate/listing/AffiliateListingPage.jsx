'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import ListingModal from './ListingModal'
import ListingViewModal from './ListingViewModal'
import CreateTalentModal from './CreateTalentModal'
import ImportListingModal from './ImportListingModal'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const PIC_LIST = ['Anisa', 'Iis', 'Kiki', 'Zalsa', 'Rina', 'Others']
const APPROVAL_COLORS = { Approve: 'badge-success', Reject: 'badge-danger', Pending: 'badge-warning' }
const STATUS_COLORS = { Aktif: 'badge-success', 'Tidak Aktif': 'badge-danger', Pending: 'badge-warning' }
const TABLE_LIMIT = 15

export default function AffiliateListingPage() {
  const [rows, setRows]   = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage]   = useState(1)
  const [loading, setLoading] = useState(false)

  const [pic,          setPic]          = useState('')
  const [username,     setUsername]     = useState('')
  const [approval,     setApproval]     = useState('')
  const [salesChannel, setSalesChannel] = useState('')
  const [listingStatus,setListingStatus]= useState('')

  const [editRow,   setEditRow]   = useState(null) // null=closed, 'new'=create, obj=edit
  const [viewRow,   setViewRow]   = useState(null)
  const [talentRow, setTalentRow] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ page, limit: TABLE_LIMIT, pic, username, approval, salesChannelId: salesChannel, listingStatus })
    const r = await fetch(`/api/affiliate/listing?${p}`).then(r => r.json())
    setRows(r.data ?? [])
    setTotal(r.total ?? 0)
    setLoading(false)
  }, [page, pic, username, approval, salesChannel, listingStatus])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!confirm('Delete this listing?')) return
    await fetch(`/api/affiliate/listing/${id}`, { method: 'DELETE' })
    toast.success('Deleted')
    load()
  }

  const totalPages = Math.ceil(total / TABLE_LIMIT)

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <h1 className="sv-title">Listing Affiliate</h1>
        <div className="flex gap-2">
          <button className="sv-btn-outline text-xs" onClick={() => setShowImport(true)}>Import Excel</button>
          <button className="sv-btn text-xs" onClick={() => setEditRow('new')}>+ Add Listing</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 px-4 py-2 bg-white border-b border-dark1/10">
        <select className="sv-input text-xs py-1 w-32" value={pic} onChange={e => { setPic(e.target.value); setPage(1) }}>
          <option value="">All PIC</option>
          {PIC_LIST.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="sv-input text-xs py-1 w-32" value={salesChannel} onChange={e => { setSalesChannel(e.target.value); setPage(1) }}>
          <option value="">All Platform</option>
          <option value="1">Shopee</option>
          <option value="4">TikTok</option>
        </select>
        <select className="sv-input text-xs py-1 w-32" value={approval} onChange={e => { setApproval(e.target.value); setPage(1) }}>
          <option value="">All Approval</option>
          <option>Pending</option><option>Approve</option><option>Reject</option>
        </select>
        <select className="sv-input text-xs py-1 w-36" value={listingStatus} onChange={e => { setListingStatus(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option>Pending</option><option>Aktif</option><option>Tidak Aktif</option>
        </select>
        <input className="sv-input text-xs py-1 flex-1 min-w-32" placeholder="Search username..."
               value={username} onChange={e => { setUsername(e.target.value); setPage(1) }} />
      </div>

      <div className="sv-panel flex-1">
        <div className="sv-panel-body p-0">
          <div className="overflow-auto">
            <table className="sv-table">
              <thead>
                <tr>
                  <th>#</th><th>Date</th><th>PIC</th><th>Username</th>
                  <th>Platform</th><th className="text-right">Followers</th>
                  <th className="text-right">Rate Card</th>
                  <th>Approval</th><th>Status</th><th>Talent</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="text-center py-8 text-dark2/50">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-8 text-dark2/50">No listings</td></tr>
                ) : rows.map((r, i) => {
                  const bothApprove = r.dealingAffiliate?.approvalFromLeaderStatus === 'Approve' &&
                                      r.dealingAffiliate?.approvalFromManagementStatus === 'Approve'
                  return (
                    <tr key={r.id}>
                      <td className="text-dark2/50">{(page - 1) * TABLE_LIMIT + i + 1}</td>
                      <td>{new Date(r.date).toLocaleDateString('id-ID')}</td>
                      <td>{r.pic ?? '—'}</td>
                      <td className="font-medium">{r.username}</td>
                      <td>{r.salesChannelId === 1 ? 'Shopee' : r.salesChannelId === 4 ? 'TikTok' : '—'}</td>
                      <td className="text-right">{(r.followers ?? 0).toLocaleString()}</td>
                      <td className="text-right">{fmtRp(r.rateCard)}</td>
                      <td><span className={`sv-badge ${APPROVAL_COLORS[r.approval] ?? 'badge-warning'}`}>{r.approval}</span></td>
                      <td><span className={`sv-badge ${STATUS_COLORS[r.listingStatus] ?? 'badge-warning'}`}>{r.listingStatus}</span></td>
                      <td>{r.talentCreatedStatus ? <span className="text-green-600 text-xs">✓</span> : '—'}</td>
                      <td>
                        <div className="flex gap-1">
                          <button className="sv-btn-xs" onClick={() => setViewRow(r)}>View</button>
                          <button className="sv-btn-xs" onClick={() => setEditRow(r)}>Edit</button>
                          {r.approval === 'Approve' && !r.talentCreatedStatus && (
                            <button className="sv-btn-xs bg-dark1 text-cream hover:bg-dark2"
                                    onClick={() => setTalentRow(r)}>Create</button>
                          )}
                          <button className="sv-btn-xs bg-red-100 text-red-600 hover:bg-red-200"
                                  onClick={() => handleDelete(r.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-2 border-t border-dark1/10">
              <button className="sv-btn-outline text-xs" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Prev</button>
              <span className="text-xs text-dark2/60">{page}/{totalPages} ({total} total)</span>
              <button className="sv-btn-outline text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Next</button>
            </div>
          )}
        </div>
      </div>

      {editRow   && <ListingModal      row={editRow === 'new' ? null : editRow} onClose={() => { setEditRow(null); load() }} />}
      {viewRow   && <ListingViewModal  row={viewRow}   onClose={() => setViewRow(null)} />}
      {talentRow && <CreateTalentModal row={talentRow} onClose={() => { setTalentRow(null); load() }} />}
      {showImport && <ImportListingModal onClose={() => { setShowImport(false); load() }} />}
    </div>
  )
}
