'use client'
import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)

export default function ListingApprovalPage() {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('Pending')

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams({ approval: filter, limit: 100 })
    const r = await fetch(`/api/affiliate/listing?${p}`).then(r => r.json())
    setRows(r.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const setApproval = async (id, approval) => {
    const r = await fetch(`/api/affiliate/listing/${id}/approval`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval }),
    })
    if (r.ok) { toast.success(`Listing ${approval}`); load() }
    else { const d = await r.json(); toast.error(d.error ?? 'Failed') }
  }

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <h1 className="sv-title">Listing Approval</h1>
        <div className="flex gap-2">
          {['Pending', 'Approve', 'Reject'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
                    className={`sv-btn-outline text-xs ${filter === s ? 'bg-dark1 text-cream border-dark1' : ''}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="sv-panel flex-1">
        <div className="sv-panel-header">
          <span>Listings — {filter}</span>
          <span className="text-xs text-dark2/60">{rows.length} records</span>
        </div>
        <div className="sv-panel-body p-0">
          <div className="overflow-auto">
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Date</th><th>PIC</th><th>Username</th><th>Platform</th>
                  <th className="text-right">Followers</th><th className="text-right">GMV</th>
                  <th className="text-right">Rate Card</th><th>SOW</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-8 text-dark2/50">Loading...</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id}>
                    <td>{new Date(r.date).toLocaleDateString('id-ID')}</td>
                    <td>{r.pic ?? '—'}</td>
                    <td className="font-medium">{r.username}</td>
                    <td>{r.salesChannelId === 1 ? 'Shopee' : r.salesChannelId === 4 ? 'TikTok' : '—'}</td>
                    <td className="text-right">{fmtNum(r.followers)}</td>
                    <td className="text-right text-orange">{fmtRp(r.gmv)}</td>
                    <td className="text-right">{fmtRp(r.rateCard)}</td>
                    <td>{r.sowCategory ?? '—'}</td>
                    <td>
                      <span className={`sv-badge ${r.approval === 'Approve' ? 'badge-success' : r.approval === 'Reject' ? 'badge-danger' : 'badge-warning'}`}>
                        {r.approval}
                      </span>
                    </td>
                    <td>
                      {r.approval === 'Pending' && (
                        <div className="flex gap-1">
                          <button className="sv-btn text-xs py-0.5 px-2" onClick={() => setApproval(r.id, 'Approve')}>
                            Approve
                          </button>
                          <button className="sv-btn-outline text-xs py-0.5 px-2 text-red-600 border-red-300" onClick={() => setApproval(r.id, 'Reject')}>
                            Reject
                          </button>
                        </div>
                      )}
                      {r.approval !== 'Pending' && (
                        <button className="sv-btn-outline text-xs py-0.5 px-2" onClick={() => setApproval(r.id, 'Pending')}>
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-dark2/50">No listings found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
