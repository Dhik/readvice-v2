'use client'
import { useState, useEffect } from 'react'
import { getTiktokPerformanceBadge } from '@/lib/affiliate-utils'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const fmtPct = n => (n ?? 0).toFixed(2) + '%'
const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)

export default function TiktokDetailModal({ date, onClose }) {
  const [rows, setRows]     = useState([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const LIMIT = 15

  const load = async () => {
    const p = new URLSearchParams({ date: new Date(date).toISOString().slice(0, 10), search, page, limit: LIMIT })
    const r = await fetch(`/api/affiliate/tiktok/details-by-date?${p}`).then(r => r.json())
    setRows(r.data ?? [])
    setTotal(r.total ?? 0)
  }

  useEffect(() => { load() }, [date, search, page])

  const dateLabel  = new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 960 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-dark1 flex items-center gap-2">
            <i className="fas fa-users text-orange"></i> Creators — {dateLabel}
          </h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>
        <div className="modal-body">
          <input
            className="border border-cream rounded text-xs px-2 py-1.5 text-dark1 focus:outline-none focus:border-dark2 bg-white w-64 mb-3"
            placeholder="Search creator..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
          <div className="overflow-auto">
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th className="text-right">GMV</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Commission</th>
                  <th className="text-right">Conv%</th>
                  <th className="text-right">Refund%</th>
                  <th className="text-right">Views</th>
                  <th className="text-right">Followers</th>
                  <th>Badge</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const badge = getTiktokPerformanceBadge(r.conversion_rate)
                  return (
                    <tr key={r.id}>
                      <td className="font-medium">{r.creator_username}</td>
                      <td className="text-right font-semibold" style={{ color: '#E07B39' }}>{fmtRp(r.affiliate_gmv)}</td>
                      <td className="text-right">{fmtNum(r.affiliate_orders)}</td>
                      <td className="text-right">{fmtRp(r.est_commission)}</td>
                      <td className="text-right">{fmtPct(r.conversion_rate)}</td>
                      <td className="text-right">{fmtPct(r.refund_rate)}</td>
                      <td className="text-right">{fmtNum(r.video_views)}</td>
                      <td className="text-right">{fmtNum(r.affiliate_followers)}</td>
                      <td>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-dark2/50">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-3">
              <button className="sv-tbtn sv-tbtn-ghost text-[11px] h-6 px-2"
                      disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
              <span className="text-xs text-dark2/60">{page} / {totalPages}</span>
              <button className="sv-tbtn sv-tbtn-ghost text-[11px] h-6 px-2"
                      disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="sv-tbtn sv-tbtn-dark" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
