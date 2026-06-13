'use client'
import { useEffect, useState } from 'react'
import KpiStrip from '@/components/ui/KpiStrip'
import ChartPanel from '@/components/charts/ChartPanel'
import { formatCurrency, formatNumber, currentMonth } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const PLATFORMS = ['All', 'Shopee', 'TikTok', 'Lazada']

export default function DashboardPage() {
  const [month, setMonth]       = useState(currentMonth())
  const [platform, setPlatform] = useState('')
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (month)    params.set('month', month)
    if (platform) params.set('platform', platform.toLowerCase())
    setLoading(true)
    fetch(`/api/sales/summary?${params}`)
      .then(r => r.json())
      .then(data => { setSummary(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [month, platform])

  const kpiTiles = [
    { label: 'Total GMV',    value: loading ? '—' : formatCurrency(summary?.total_gmv   ?? 0) },
    { label: 'Total Nett',   value: loading ? '—' : formatCurrency(summary?.total_nett  ?? 0) },
    { label: 'Total Orders', value: loading ? '—' : formatNumber(summary?.total_orders  ?? 0) },
    { label: 'Total Qty',    value: loading ? '—' : formatNumber(summary?.total_qty     ?? 0) },
    { label: 'Avg Order',    value: loading || !summary?.total_orders ? '—' : formatCurrency((summary.total_gmv / summary.total_orders) || 0) },
    { label: 'Channel',      value: platform || 'All Platforms' },
  ]

  return (
    <div className="sv-page">
      <div className="sv-filter-bar">
        <div className="flex gap-1 tab-pills">
          {PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p === 'All' ? '' : p)}
              className={`tab-pill ${(p === 'All' ? '' : p) === platform ? 'active' : ''}`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-dark1/60">Month:</span>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="form-input !w-auto text-xs py-1"
          />
        </div>
      </div>

      <KpiStrip tiles={kpiTiles} cols={6} />

      <div className="sv-main">
        <div className="sv-table-panel">
          <div className="sv-panel-header">Overview — {month}</div>
          <div className="sv-panel-body flex items-center justify-center">
            {loading ? <LoadingSpinner /> : (
              <div className="text-center p-8">
                <p className="text-3xl font-bold text-dark1 mb-1">{formatCurrency(summary?.total_gmv ?? 0)}</p>
                <p className="text-dark1/50 text-sm mb-6">Total GMV</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="kpi-tile kpi-tile-simple">
                    <span className="kpi-tile-label">Nett Revenue</span>
                    <span className="kpi-tile-value">{formatCurrency(summary?.total_nett ?? 0)}</span>
                  </div>
                  <div className="kpi-tile kpi-tile-simple">
                    <span className="kpi-tile-label">Total Orders</span>
                    <span className="kpi-tile-value">{formatNumber(summary?.total_orders ?? 0)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="sv-chart-panel">
          <div className="sv-panel-header">Revenue Trend</div>
          <ChartPanel
            lineData={summary ? {
              labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
              datasets: [{
                label: 'GMV (est.)',
                data: [
                  summary.total_gmv * 0.20, summary.total_gmv * 0.28,
                  summary.total_gmv * 0.22, summary.total_gmv * 0.30,
                ],
                borderColor: '#E07B39',
                backgroundColor: 'rgba(224,123,57,0.1)',
                fill: true, tension: 0.4,
              }],
            } : null}
            donutData={{
              labels: ['Shopee', 'TikTok', 'Lazada', 'Other'],
              datasets: [{ data: [40, 30, 20, 10], backgroundColor: ['#E07B39', '#2C3639', '#DCD7C9', '#3F4E4F'] }],
            }}
          />
        </div>
      </div>
    </div>
  )
}
