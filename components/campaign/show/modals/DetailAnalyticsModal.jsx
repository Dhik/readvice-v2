'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

export default function DetailAnalyticsModal({ isOpen, onClose, contentId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const engRef  = useRef(null)
  const gmvRef  = useRef(null)
  const engChart  = useRef(null)
  const gmvChart  = useRef(null)

  useEffect(() => {
    if (!isOpen || !contentId) return
    setLoading(true)
    fetch(`/api/campaign-contents/${contentId}/chart-detail`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isOpen, contentId])

  useEffect(() => {
    if (!data || !engRef.current || !gmvRef.current) return

    engChart.current?.destroy()
    gmvChart.current?.destroy()

    const labels = data.engagement.map(d => d.date)

    engChart.current = new Chart(engRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Views',    data: data.engagement.map(d => d.view),    borderColor: '#3498db', tension: 0.3, pointRadius: 2 },
          { label: 'Likes',    data: data.engagement.map(d => d.like),    borderColor: '#e74c3c', tension: 0.3, pointRadius: 2 },
          { label: 'Comments', data: data.engagement.map(d => d.comment), borderColor: '#f39c12', tension: 0.3, pointRadius: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { size: 9 } } } },
        scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } },
      },
    })

    gmvChart.current = new Chart(gmvRef.current, {
      type: 'line',
      data: {
        labels: data.gmv.map(d => d.date),
        datasets: [
          { label: 'GMV', data: data.gmv.map(d => d.gmv), borderColor: '#E07B39', backgroundColor: 'rgba(224,123,57,0.1)', fill: true, tension: 0.3, pointRadius: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { size: 9 } } } },
        scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } },
      },
    })

    return () => { engChart.current?.destroy(); gmvChart.current?.destroy() }
  }, [data])

  if (!isOpen) return null

  const meta = data?.meta ?? {}

  const KPI_ROWS = [
    [
      { label: 'Views',    value: meta.views?.toLocaleString() },
      { label: 'Likes',    value: meta.likes?.toLocaleString() },
      { label: 'Comments', value: meta.comments?.toLocaleString() },
    ],
    [
      { label: 'Engagement %', value: meta.engagement_rate },
      { label: 'Total GMV',    value: meta.gmv?.toLocaleString?.() ?? meta.gmv },
      { label: 'ROI',          value: meta.roi },
    ],
    [
      { label: 'Rate Card',  value: meta.rate_card?.toLocaleString?.() ?? meta.rate_card },
      { label: 'Ads Code',   value: meta.kode_ads },
      { label: 'Post Date',  value: meta.upload_date },
    ],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full mx-4 flex flex-col max-h-[90vh]"
        style={{ maxWidth: '1100px' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream flex-shrink-0">
          <h3 className="font-semibold text-dark1 text-sm flex items-center gap-2">
            <i className="fas fa-chart-line text-orange"></i> Content Analytics
          </h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <i className="fas fa-spinner fa-spin text-2xl text-dark2"></i>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex gap-4">
              {/* Left: embed */}
              <div className="flex-shrink-0" style={{ width: '240px' }}>
                <div className="text-[10px] font-semibold text-dark2 uppercase mb-2">Content Preview</div>
                {meta.link ? (
                  <iframe
                    src={meta.link}
                    className="w-full rounded border border-cream"
                    style={{ height: '320px' }}
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-popups"
                  />
                ) : (
                  <div className="w-full h-60 border border-cream rounded flex items-center justify-center text-xs text-gray-400">
                    No link available
                  </div>
                )}
              </div>

              {/* Right: metrics + charts */}
              <div className="flex-1 min-w-0">
                {KPI_ROWS.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-3 gap-2 mb-2">
                    {row.map(kpi => (
                      <div key={kpi.label} className="bg-bg border border-cream rounded p-2">
                        <div className="text-[9px] font-semibold text-dark2 uppercase">{kpi.label}</div>
                        <div className="text-sm font-bold text-dark1 mt-0.5">{kpi.value ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="text-[10px] font-semibold text-dark2 uppercase mb-1">Engagement Analytics</div>
                    <div style={{ height: '200px' }}><canvas ref={engRef}></canvas></div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-dark2 uppercase mb-1">GMV Trend</div>
                    <div style={{ height: '200px' }}><canvas ref={gmvRef}></canvas></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
