'use client'
import { useState, useEffect } from 'react'
import ChartPanel from '@/components/charts/ChartPanel'
import Badge from '@/components/ui/Badge'
import { seriesColor, withAlpha } from '@/lib/charts/theme'
import { formatCurrency } from '@/lib/utils'

const BRACKET_VARIANT = {
  Winning:      'success',
  Bagus:        'info',
  Potensi:      'orange',
  Buruk:        'danger',
  'Cash-Eater': 'danger',
}

const PLATFORM_LABEL = {
  meta:   'Meta',
  shopee: 'Shopee',
  tiktok: 'TikTok',
  lazada: 'Lazada',
}

export default function RoasAnalysisPanel({ startDate, endDate }) {
  const [rows,    setRows]    = useState([])
  const [totals,  setTotals]  = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate)   params.set('endDate', endDate)
    fetch(`/api/ad-spent/roas?${params}`)
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setTotals(d.totals ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [startDate, endDate])

  const lineData = rows.length ? {
    labels: rows.map(r => PLATFORM_LABEL[r.platform] ?? r.platform),
    datasets: [
      { label: 'Spent', data: rows.map(r => r.spent),     borderColor: seriesColor(0), backgroundColor: withAlpha(seriesColor(0), 0.6), fill: false, tension: 0.3 },
      { label: 'GMV',   data: rows.map(r => r.gmv ?? 0),  borderColor: seriesColor(1), backgroundColor: withAlpha(seriesColor(1), 0.5), fill: false, tension: 0.3 },
    ],
  } : null

  return (
    <div>
      <div className="flex gap-6 px-4 py-3 border-b border-cream text-sm flex-wrap">
        <div>
          <span className="text-dark2/60 mr-1">Total Spent</span>
          <span className="font-semibold">{formatCurrency(totals.spent ?? 0)}</span>
        </div>
        <div>
          <span className="text-dark2/60 mr-1">Total GMV</span>
          <span className="font-semibold">{totals.gmv != null ? formatCurrency(totals.gmv) : '—'}</span>
        </div>
        <div>
          <span className="text-dark2/60 mr-1">Overall ROAS</span>
          <span className="font-semibold">{totals.roas != null ? `${totals.roas.toFixed(2)}x` : '—'}</span>
        </div>
      </div>

      <div className="sv-main">
        <div className="sv-table-panel">
          <div className="sv-panel-header">Platform ROAS Breakdown</div>
          <div className="sv-panel-body">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
            ) : (
              <table className="sv-table-clean">
                <thead>
                  <tr>
                    {[
                      { label: 'Platform', num: false },
                      { label: 'Spent',    num: true  },
                      { label: 'GMV',      num: true  },
                      { label: 'ROAS',     num: true  },
                      { label: 'Bracket',  num: false },
                    ].map(h => (
                      <th key={h.label}>{h.num ? <span className="num">{h.label}</span> : h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.platform}>
                      <td className="font-medium">{PLATFORM_LABEL[r.platform] ?? r.platform}</td>
                      <td><span className="num">{formatCurrency(r.spent)}</span></td>
                      <td><span className="num">{r.gmv != null ? formatCurrency(r.gmv) : '—'}</span></td>
                      <td><span className="num">{r.roas != null ? `${r.roas.toFixed(2)}x` : '—'}</span></td>
                      <td>
                        {r.bracket
                          ? <Badge variant={BRACKET_VARIANT[r.bracket] ?? 'info'}>{r.bracket}</Badge>
                          : <span className="text-dark2/40">—</span>}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm text-gray-400">No data found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="sv-chart-panel">
          <div className="sv-panel-header">Spent vs GMV</div>
          <ChartPanel lineData={lineData} defaultView="bar" />
        </div>
      </div>
    </div>
  )
}
