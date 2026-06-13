'use client'
import { useEffect, useState } from 'react'

const TILES = [
  { icon: 'fa-credit-card', bg: '#2C3639', iconColor: 'white',   label: 'Total Expense',  key: 'total_expense' },
  { icon: 'fa-dollar-sign', bg: '#E07B39', iconColor: 'white',   label: 'Total GMV',      key: 'total_gmv' },
  { icon: 'fa-eye',         bg: '#3F4E4F', iconColor: 'white',   label: 'Total Views',    key: 'views' },
  { icon: 'fa-video',       bg: '#DCD7C9', iconColor: '#2C3639', label: 'Total Content',  key: 'total_content' },
]

export default function CampaignKpiStrip({ type, filterMonth, filterDates, search }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (type)        params.set('type', type)
    if (filterMonth) params.set('filterMonth', filterMonth)
    if (filterDates) params.set('filterDates', filterDates)
    if (search)      params.set('search', search)

    fetch('/api/campaigns/summary?' + params.toString())
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [type, filterMonth, filterDates, search])

  return (
    <div className="sv-kpi-strip">
      {TILES.map(tile => (
        <div key={tile.key} className="kpi-tile">
          <div className="kpi-tile-icon" style={{ background: tile.bg }}>
            <i className={'fas ' + tile.icon} style={{ color: tile.iconColor }}></i>
          </div>
          <div className="min-w-0">
            <div className="kpi-tile-label">{tile.label}</div>
            <div className="kpi-tile-value" style={{ opacity: loading ? 0.4 : 1, transition: 'opacity 0.3s' }}>
              {loading
                ? <i className="fas fa-spinner fa-spin text-xs text-gray-400"></i>
                : (data?.[tile.key] ?? '—')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
