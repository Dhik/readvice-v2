'use client'
import { useState, useEffect } from 'react'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)
const BADGE_CLS = { 'Very Active': 'badge-success', 'Active': 'badge-info', 'Moderate': 'badge-warning', 'Low': 'badge-danger' }

export default function NonRcAnalyticsPage() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams({ dateFrom, dateTo })
    const r = await fetch(`/api/affiliate/analytics/non-rc?${p}`).then(r => r.json())
    setData(r.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [dateFrom, dateTo])

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <h1 className="sv-title">Analytics Non-RC</h1>
        <div className="flex gap-2 items-center">
          <input type="date" className="sv-input text-xs py-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-xs text-dark2/60">–</span>
          <input type="date" className="sv-input text-xs py-1" value={dateTo}   onChange={e => setDateTo(e.target.value)} />
          <button className="sv-btn text-xs" onClick={load}>Apply</button>
        </div>
      </div>

      <div className="sv-panel flex-1">
        <div className="sv-panel-header">
          <span>Non-RC Analytics</span>
          <span className="text-xs text-dark2/60">{data.length} listings</span>
        </div>
        <div className="sv-panel-body p-0">
          <div className="overflow-auto">
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Activity Level</th>
                  <th className="text-right">Active Days</th>
                  <th className="text-right">Total GMV</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Avg ROI</th>
                  <th className="text-right">Followers</th>
                  <th className="text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-dark2/50">Loading...</td></tr>
                ) : data.map(r => (
                  <tr key={r.listing_id}>
                    <td className="font-medium">{r.username}</td>
                    <td>
                      <span className={`sv-badge ${BADGE_CLS[r.activity_level?.label] ?? 'badge-warning'}`}>
                        {r.activity_level?.label ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="text-right">{r.active_days}</td>
                    <td className="text-right text-orange font-semibold">{fmtRp(r.total_gmv)}</td>
                    <td className="text-right">{fmtNum(r.total_orders)}</td>
                    <td className="text-right">{r.avg_roi.toFixed(1)}%</td>
                    <td className="text-right">{fmtNum(r.followers)}</td>
                    <td className="text-right"><span className="font-bold text-orange">{r.performance_score}</span></td>
                  </tr>
                ))}
                {!loading && data.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-dark2/50">No non-RC listings found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
