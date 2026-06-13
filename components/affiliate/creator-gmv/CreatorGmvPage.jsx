'use client'
import { useState, useEffect } from 'react'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)

function GmvTable({ rows, loading, colSpan = 8 }) {
  if (loading) return <tr><td colSpan={colSpan} className="text-center py-8 text-dark2/50">Loading...</td></tr>
  if (!rows.length) return <tr><td colSpan={colSpan} className="text-center py-8 text-dark2/50">No data</td></tr>
  return rows.map(r => (
    <tr key={r.id}>
      <td className="font-medium">{r.username ?? '—'}</td>
      <td className="font-mono text-xs text-dark2/60 max-w-xs truncate" title={r.videoLink}>{r.videoCode ?? '—'}</td>
      <td>{r.date ? new Date(r.date).toLocaleDateString('id-ID') : '—'}</td>
      <td className="text-right text-orange">{fmtRp(r.gmv)}</td>
      <td className="text-right">{fmtNum(r.orders)}</td>
      <td className="text-right">{fmtRp(r.commission)}</td>
      <td>{r.campaignName ?? '—'}</td>
      <td>
        {r.linkNotFound
          ? <span className="sv-badge badge-danger">Not Found</span>
          : <span className="sv-badge badge-success">Matched</span>}
      </td>
    </tr>
  ))
}

function ZeroTable({ rows, loading }) {
  if (loading) return <tr><td colSpan={5} className="text-center py-8 text-dark2/50">Loading...</td></tr>
  if (!rows.length) return <tr><td colSpan={5} className="text-center py-8 text-dark2/50">No zero-GMV content found</td></tr>
  return rows.map(r => (
    <tr key={r.id}>
      <td className="font-medium">{r.talentName ?? '—'}</td>
      <td className="font-mono text-xs truncate max-w-xs" title={r.link}>{r.link ?? '—'}</td>
      <td>{r.campaignName ?? '—'}</td>
      <td>{r.postDate ? new Date(r.postDate).toLocaleDateString('id-ID') : '—'}</td>
      <td className="text-right text-orange">{fmtRp(r.gmv)}</td>
    </tr>
  ))
}

export default function CreatorGmvPage() {
  const [tab, setTab]         = useState('all')
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')

  const TABS = [
    { key: 'all',       label: 'All Videos' },
    { key: 'notfound',  label: 'Not Found' },
    { key: 'zero',      label: 'Zero GMV' },
  ]

  const load = async () => {
    setLoading(true)
    let url = ''
    const p = new URLSearchParams({ search, limit: 100 })
    if (tab === 'all')      url = `/api/affiliate/creator-gmv?${p}`
    if (tab === 'notfound') url = `/api/affiliate/creator-gmv/not-found?${p}`
    if (tab === 'zero')     url = `/api/affiliate/creator-gmv/zero?${p}`
    const r = await fetch(url).then(r => r.json())
    setRows(r.data ?? [])
    setTotal(r.total ?? 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [tab, search])

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <h1 className="sv-title">Creator GMV</h1>
        <div className="text-xs text-dark2/60">{total} records</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 border-b border-dark2/10 pb-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setRows([]) }}
                  className={`text-sm px-3 py-1.5 rounded-t transition-colors ${
                    tab === t.key ? 'bg-orange text-white' : 'text-dark2 hover:bg-dark1/10'
                  }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-3">
        <input className="sv-input text-xs py-1 w-56" placeholder="Search username or video code..."
               value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="sv-panel flex-1">
        <div className="sv-panel-body p-0">
          <div className="overflow-auto">
            {tab === 'zero' ? (
              <table className="sv-table">
                <thead>
                  <tr>
                    <th>Talent</th><th>Link</th><th>Campaign</th><th>Post Date</th>
                    <th className="text-right">GMV</th>
                  </tr>
                </thead>
                <tbody><ZeroTable rows={rows} loading={loading} /></tbody>
              </table>
            ) : (
              <table className="sv-table">
                <thead>
                  <tr>
                    <th>Username</th><th>Video Code</th><th>Date</th>
                    <th className="text-right">GMV</th><th className="text-right">Orders</th>
                    <th className="text-right">Commission</th><th>Campaign</th><th>Status</th>
                  </tr>
                </thead>
                <tbody><GmvTable rows={rows} loading={loading} /></tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
