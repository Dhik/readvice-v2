'use client'
import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { seriesColor, withAlpha } from '@/lib/charts/theme'

function shortNum(val) {
  if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B'
  if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M'
  if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K'
  return String(val)
}
function parseNum(str) {
  const n = parseInt(String(str ?? '').replace(/[^\d]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

export default function CampaignAnalyticsPanel({ summaryData }) {
  const barRef     = useRef(null)
  const donutRef   = useRef(null)
  const barChart   = useRef(null)
  const donutChart = useRef(null)

  useEffect(() => {
    if (!barRef.current || !donutRef.current) return

    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: ['Expense', 'GMV'],
        datasets: [{
          data: [0, 0],
          backgroundColor: [withAlpha(seriesColor(1), 0.85), withAlpha(seriesColor(0), 0.85)],
          borderRadius: 5,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { callback: v => shortNum(v), font: { size: 9 } } },
          y: { ticks: { font: { size: 9 } } },
        },
      },
    })

    donutChart.current = new Chart(donutRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Views', 'Likes', 'Comments'],
        datasets: [{ data: [1, 0, 0], backgroundColor: [seriesColor(1), seriesColor(0), seriesColor(4)] }],
      },
      options: {
        cutout: '65%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 9 }, boxWidth: 10 } },
        },
      },
    })

    return () => {
      barChart.current?.destroy()
      donutChart.current?.destroy()
    }
  }, [])

  useEffect(() => {
    if (!summaryData) return
    const expense  = parseNum(summaryData.total_expense)
    const gmv      = parseNum(summaryData.total_gmv)
    const views    = parseNum(summaryData.views)
    const likes    = parseNum(summaryData.likes)
    const comments = parseNum(summaryData.comments)

    if (barChart.current) {
      barChart.current.data.datasets[0].data = [expense, gmv]
      barChart.current.update()
    }
    if (donutChart.current) {
      donutChart.current.data.datasets[0].data = [views || 1, likes, comments]
      donutChart.current.update()
    }
  }, [summaryData])

  const expense  = summaryData ? parseNum(summaryData.total_expense) : 0
  const gmv      = summaryData ? parseNum(summaryData.total_gmv) : 0
  const views    = summaryData ? parseNum(summaryData.views) : 0
  const likes    = summaryData ? parseNum(summaryData.likes) : 0
  const comments = summaryData ? parseNum(summaryData.comments) : 0
  const cpm      = summaryData?.cpm ?? '—'
  const er       = summaryData?.engagement_rate ?? '—'

  const ratio    = expense > 0 ? gmv / expense : 0
  const barWidth = Math.min(100, (ratio / 4) * 100)
  const barColor = ratio >= 2 ? '#28a745' : ratio >= 1 ? '#E07B39' : '#dc3545'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-2 border-b border-cream" style={{ flex: '0 0 160px', minHeight: 0 }}>
        <div className="text-[9px] font-semibold text-dark2 uppercase mb-1">Expense vs GMV</div>
        <div style={{ height: '120px' }}>
          <canvas ref={barRef}></canvas>
        </div>
      </div>

      <div className="p-2 border-b border-cream" style={{ flex: '0 0 140px', minHeight: 0 }}>
        <div className="text-[9px] font-semibold text-dark2 uppercase mb-1">Engagement</div>
        <div style={{ height: '100px' }}>
          <canvas ref={donutRef}></canvas>
        </div>
      </div>

      <div className="p-1.5 border-b border-cream flex-shrink-0">
        <div className="metric-row">
          <div className="metric-card">
            <div className="metric-card-label">CPM</div>
            <div className="metric-card-value">{cpm}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Avg ER</div>
            <div className="metric-card-value">{er}</div>
          </div>
        </div>
        <div className="metric-row">
          <div className="metric-card">
            <div className="metric-card-label">Total Likes</div>
            <div className="metric-card-value">{shortNum(likes)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Comments</div>
            <div className="metric-card-value">{shortNum(comments)}</div>
          </div>
        </div>
      </div>

      <div className="p-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-semibold text-dark2 uppercase">GMV / Expense Ratio</span>
          <span className="text-[11px] font-bold" style={{ color: barColor }}>{ratio.toFixed(2)}×</span>
        </div>
        <div className="h-2 bg-cream rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: barWidth + '%', background: barColor }}></div>
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[8px] text-gray-400">0×</span>
          <span className="text-[8px] text-gray-400">2×</span>
          <span className="text-[8px] text-gray-400">4×+</span>
        </div>
      </div>
    </div>
  )
}
