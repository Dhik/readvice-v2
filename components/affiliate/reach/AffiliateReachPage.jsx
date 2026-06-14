'use client'
import { useState, useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { seriesColor } from '@/lib/charts/theme'
import { toast } from 'react-hot-toast'
import ReachModal from './ReachModal'
import CreateDealingModal from './CreateDealingModal'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)

export default function AffiliateReachPage() {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [picFilter, setPicFilter]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal]     = useState(null)   // null | { type, row }
  const [chartData, setChartData] = useState([])
  const barRef   = useRef(null)
  const barChart = useRef(null)
  const LIMIT = 20

  const PIC_LIST = ['Anisa', 'Iis', 'Kiki', 'Zalsa', 'Rina', 'Others']

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams({ page, limit: LIMIT, search, pic: picFilter, status: statusFilter })
    const r = await fetch(`/api/affiliate/reach?${p}`).then(r => r.json())
    setRows(r.data ?? [])
    setTotal(r.total ?? 0)
    setLoading(false)
  }

  const loadChart = async () => {
    const r = await fetch('/api/affiliate/reach/chart').then(r => r.json())
    setChartData(r.data ?? [])
  }

  useEffect(() => { load() }, [page, search, picFilter, statusFilter])
  useEffect(() => { loadChart() }, [])

  useEffect(() => {
    if (!barRef.current || chartData.length === 0) return
    if (barChart.current) barChart.current.destroy()
    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: chartData.map(d => d.pic),
        datasets: [{ label: 'Reach Count', data: chartData.map(d => d.count), backgroundColor: seriesColor(0) }],
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    })
    return () => barChart.current?.destroy()
  }, [chartData])

  const handleDelete = async (id) => {
    if (!confirm('Delete this reach record?')) return
    const r = await fetch(`/api/affiliate/reach/${id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Deleted'); load() }
    else toast.error('Delete failed')
  }

  const closeModal = () => { setModal(null); load() }
  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <h1 className="sv-title">Affiliate Reach</h1>
        <button className="sv-btn text-xs" onClick={() => setModal({ type: 'add' })}>+ Add Reach</button>
      </div>

      {/* Chart */}
      <div className="sv-panel mb-4" style={{ maxHeight: 240 }}>
        <div className="sv-panel-header"><span>Reach by PIC</span></div>
        <div className="sv-panel-body"><canvas ref={barRef} style={{ maxHeight: 180 }} /></div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <input className="sv-input text-xs py-1 w-48" placeholder="Search username..."
               value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <select className="sv-input text-xs py-1 w-32" value={picFilter} onChange={e => { setPicFilter(e.target.value); setPage(1) }}>
          <option value="">All PIC</option>
          {PIC_LIST.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="sv-input text-xs py-1 w-32" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Dealing">Dealing</option>
        </select>
      </div>

      {/* Table */}
      <div className="sv-panel flex-1">
        <div className="sv-panel-header">
          <span>Reach Records</span>
          <span className="text-xs text-dark2/60">{total} total</span>
        </div>
        <div className="sv-panel-body p-0">
          <div className="overflow-auto">
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Date</th><th>PIC</th><th>Username</th><th>Platform</th>
                  <th className="text-right">Followers</th><th className="text-right">GMV</th>
                  <th className="text-right">Rate Card</th><th>SOW</th><th>Status</th>
                  <th>Actions</th>
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
                    <td>{r.platform ?? '—'}</td>
                    <td className="text-right">{fmtNum(r.followers)}</td>
                    <td className="text-right text-orange">{fmtRp(r.gmv)}</td>
                    <td className="text-right">{fmtRp(r.rateCard)}</td>
                    <td>{r.sowCategory ?? '—'}</td>
                    <td>
                      <span className={`sv-badge ${r.status === 'Active' ? 'badge-success' : r.status === 'Dealing' ? 'badge-info' : 'badge-warning'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="sv-btn-outline text-xs py-0.5 px-2" onClick={() => setModal({ type: 'edit', row: r })}>Edit</button>
                        <button className="sv-btn text-xs py-0.5 px-2" onClick={() => setModal({ type: 'dealing', row: r })}>→ Dealing</button>
                        <button className="sv-btn-outline text-xs py-0.5 px-2 text-red-600 border-red-300" onClick={() => handleDelete(r.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-dark2/50">No reach records found</td></tr>
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

      {modal?.type === 'add'     && <ReachModal row={null}      onClose={closeModal} />}
      {modal?.type === 'edit'    && <ReachModal row={modal.row}  onClose={closeModal} />}
      {modal?.type === 'dealing' && <CreateDealingModal row={modal.row} onClose={closeModal} />}
    </div>
  )
}
