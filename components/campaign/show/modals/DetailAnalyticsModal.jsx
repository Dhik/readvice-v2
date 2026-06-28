'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart } from 'chart.js'
import { seriesColor, withAlpha } from '@/lib/charts/theme'

// A raw social watch-page URL can't be iframed (TikTok/IG/YouTube send X-Frame-Options).
// Convert it to the platform's embeddable URL. Returns { src, platform } or null if the
// link isn't embeddable (caller then shows an "Open ↗" fallback instead of a blank frame).
function resolveEmbed(raw) {
  if (!raw || typeof raw !== 'string') return null
  let url
  try { url = new URL(raw.trim().startsWith('http') ? raw.trim() : 'https://' + raw.trim()) }
  catch { return null }
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const p = url.pathname

  if (host.includes('youtube.com') || host === 'youtu.be') {
    let id = ''
    if (host === 'youtu.be') id = p.split('/')[1]
    else if (p.startsWith('/shorts/')) id = p.split('/')[2]
    else if (p.startsWith('/embed/')) id = p.split('/')[2]
    else id = url.searchParams.get('v') || ''
    if (id) return { src: `https://www.youtube.com/embed/${id}`, platform: 'YouTube' }
  }
  if (host.includes('tiktok.com')) {
    const m = p.match(/\/video\/(\d+)/)
    if (m) return { src: `https://www.tiktok.com/embed/v2/${m[1]}`, platform: 'TikTok' }
  }
  if (host.includes('instagram.com')) {
    const m = p.match(/\/(p|reel|tv)\/([^/?#]+)/)
    if (m) return { src: `https://www.instagram.com/${m[1]}/${m[2]}/embed/`, platform: 'Instagram' }
  }
  return null // shopee / unknown / non-embeddable → fallback link
}

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
          { label: 'Views',    data: data.engagement.map(d => d.view),    borderColor: seriesColor(0), tension: 0.3, pointRadius: 2 },
          { label: 'Likes',    data: data.engagement.map(d => d.like),    borderColor: seriesColor(7), tension: 0.3, pointRadius: 2 },
          { label: 'Comments', data: data.engagement.map(d => d.comment), borderColor: seriesColor(5), tension: 0.3, pointRadius: 2 },
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
          { label: 'GMV', data: data.gmv.map(d => d.gmv), borderColor: seriesColor(0), backgroundColor: withAlpha(seriesColor(0), 0.1), fill: true, tension: 0.3, pointRadius: 2 },
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
              <div className="flex-shrink-0" style={{ width: '280px' }}>
                <div className="text-[10px] font-semibold text-dark2 uppercase mb-2">Content Preview</div>
                {(() => {
                  const embed = resolveEmbed(meta.link)
                  if (embed) {
                    return (
                      <iframe
                        src={embed.src}
                        title={`${embed.platform} content preview`}
                        className="w-full rounded border border-cream bg-black/5"
                        style={{ height: '480px' }}
                        loading="lazy"
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                      />
                    )
                  }
                  if (meta.link) {
                    // Not embeddable (Shopee / unknown host, or a watch page that blocks framing) —
                    // give a real "Open ↗" affordance instead of a guaranteed-blank iframe.
                    return (
                      <a href={meta.link} target="_blank" rel="noopener noreferrer"
                        className="w-full h-60 border border-dashed border-cream rounded flex flex-col items-center justify-center gap-2 text-center px-3 text-dark2 hover:bg-bg/60 transition">
                        <i className="fas fa-up-right-from-square text-xl text-orange" />
                        <span className="text-xs font-semibold">Open content in a new tab</span>
                        <span className="text-[10px] text-dark1/45 break-all line-clamp-2">{meta.link}</span>
                        <span className="text-[9px] text-dark1/35">This platform can't be embedded inline.</span>
                      </a>
                    )
                  }
                  return (
                    <div className="w-full h-60 border border-cream rounded flex items-center justify-center text-xs text-dark1/40">
                      No link available
                    </div>
                  )
                })()}
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
