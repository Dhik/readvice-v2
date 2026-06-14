'use client'
import { useState, useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { seriesColor } from '@/lib/charts/theme'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)

const STATUS_COLORS = { 'Existed': seriesColor(0), 'New Affiliate': seriesColor(1), 'Unknown': seriesColor(4) }
const BADGE_MAP = { 'Existed': 'badge-success', 'New Affiliate': 'badge-info', 'Unknown': 'badge-warning',
                    'Before Dealing': 'badge-danger', 'Same Period': 'badge-warning', 'After Dealing': 'badge-success' }

export default function RcAnalyticsPage() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const donutRef  = useRef(null)
  const barRef    = useRef(null)
  const donutChart = useRef(null)
  const barChart   = useRef(null)

  const load = async () => {
    setLoading(true)
    const p = new URLSearchParams({ dateFrom, dateTo })
    const r = await fetch(`/api/affiliate/analytics/rc?${p}`).then(r => r.json())
    setData(r.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [dateFrom, dateTo])

  // Donut chart — status distribution
  useEffect(() => {
    if (!donutRef.current || data.length === 0) return
    const counts = data.reduce((acc, d) => {
      acc[d.affiliate_status] = (acc[d.affiliate_status] ?? 0) + 1; return acc
    }, {})
    if (donutChart.current) donutChart.current.destroy()
    donutChart.current = new Chart(donutRef.current, {
      type: 'doughnut',
      data: {
        labels: Object.keys(counts),
        datasets: [{ data: Object.values(counts), backgroundColor: Object.keys(counts).map(k => STATUS_COLORS[k] ?? '#DCD7C9') }],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    })
    return () => donutChart.current?.destroy()
  }, [data])

  // Bar chart — top 10 by GMV
  useEffect(() => {
    if (!barRef.current || data.length === 0) return
    const top10 = [...data].sort((a,b) => b.total_gmv - a.total_gmv).slice(0,10)
    if (barChart.current) barChart.current.destroy()
    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: top10.map(d => d.username),
        datasets: [{ label: 'Total GMV', data: top10.map(d => d.total_gmv), backgroundColor: seriesColor(0) }],
      },
      options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } },
    })
    return () => barChart.current?.destroy()
  }, [data])

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <h1 className="sv-title">Analytics RC</h1>
        <div className="flex gap-2 items-center">
          <input type="date" className="sv-input text-xs py-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-xs text-dark2/60">–</span>
          <input type="date" className="sv-input text-xs py-1" value={dateTo}   onChange={e => setDateTo(e.target.value)} />
          <button className="sv-btn text-xs" onClick={load}>Apply</button>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="sv-panel">
          <div className="sv-panel-header"><span>Status Distribution</span></div>
          <div className="sv-panel-body"><canvas ref={donutRef} style={{ maxHeight: 220 }} /></div>
        </div>
        <div className="sv-panel">
          <div className="sv-panel-header"><span>Top 10 by GMV</span></div>
          <div className="sv-panel-body"><canvas ref={barRef} style={{ maxHeight: 220 }} /></div>
        </div>
      </div>

      {/* Table */}
      <div className="sv-panel flex-1">
        <div className="sv-panel-header">
          <span>RC Analytics Table</span>
          <span className="text-xs text-dark2/60">{data.length} affiliates</span>
        </div>
        <div className="sv-panel-body p-0">
          <div className="overflow-auto">
            <table className="sv-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Timeline</th>
                  <th>Dealing Date</th>
                  <th className="text-right">Active Days</th>
                  <th className="text-right">Total GMV</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Avg ROI</th>
                  <th className="text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8 text-dark2/50">Loading...</td></tr>
                ) : data.map(r => (
                  <tr key={r.talent_id}>
                    <td className="font-medium">{r.username}</td>
                    <td><span className={`sv-badge ${BADGE_MAP[r.affiliate_status] ?? 'badge-warning'}`}>{r.affiliate_status}</span></td>
                    <td><span className={`sv-badge ${BADGE_MAP[r.timeline_status] ?? 'badge-warning'}`}>{r.timeline_status}</span></td>
                    <td>{r.dealing_date ? new Date(r.dealing_date).toLocaleDateString('id-ID') : '—'}</td>
                    <td className="text-right">{r.active_days}</td>
                    <td className="text-right text-orange font-semibold">{fmtRp(r.total_gmv)}</td>
                    <td className="text-right">{fmtNum(r.total_orders)}</td>
                    <td className="text-right">{r.avg_roi.toFixed(1)}%</td>
                    <td className="text-right">
                      <span className="font-bold text-orange">{r.performance_score}</span>
                    </td>
                  </tr>
                ))}
                {!loading && data.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-dark2/50">No RC affiliates found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
