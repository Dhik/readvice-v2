'use client'
import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)
const fmtPct = n => (n ?? 0).toFixed(2) + '%'

function shortNum(v) {
  if (!v) return '0'
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'
  return String(Math.round(v))
}

export default function TiktokChartPanel({ dateFrom, dateTo, metrics }) {
  const barRef     = useRef(null)
  const donutRef   = useRef(null)
  const barChart   = useRef(null)
  const donutChart = useRef(null)

  useEffect(() => {
    if (!barRef.current || !donutRef.current) return

    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: ['Commission', 'GMV'],
        datasets: [{
          data: [0, 0],
          backgroundColor: ['rgba(44,54,57,0.85)', 'rgba(224,123,57,0.85)'],
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
        labels: ['Net GMV', 'Commission'],
        datasets: [{ data: [1, 0], backgroundColor: ['#E07B39', '#2C3639'] }],
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
    const gmv  = metrics?.gmv  ?? 0
    const comm = metrics?.comm ?? 0

    if (barChart.current) {
      barChart.current.data.datasets[0].data = [comm, gmv]
      barChart.current.update()
    }
    if (donutChart.current) {
      donutChart.current.data.datasets[0].data = gmv > 0 ? [gmv - comm, comm] : [1, 0]
      donutChart.current.update()
    }
  }, [metrics])

  const gmv      = metrics?.gmv  ?? 0
  const comm     = metrics?.comm ?? 0
  const ratio    = comm > 0 ? gmv / comm : 0
  const barWidth = Math.min(100, (ratio / 4) * 100)
  const barColor = ratio >= 2 ? '#28a745' : ratio >= 1 ? '#E07B39' : '#dc3545'
  const avgConv  = metrics && metrics.n > 0 ? metrics.conv / metrics.n : 0

  return (
    <div className="sv-panel" style={{ flex: 1 }}>
      <div className="sv-panel-header">
        <span className="sv-panel-title">
          <i className="fas fa-chart-line text-dark2" /> Analytics
        </span>
      </div>
      <div className="sv-panel-body p-0">
        <div className="flex flex-col h-full overflow-y-auto">

          <div className="p-2 border-b border-cream" style={{ flex: '0 0 160px', minHeight: 0 }}>
            <div className="text-[9px] font-semibold text-dark2 uppercase mb-1">Commission vs GMV</div>
            <div style={{ height: '120px' }}><canvas ref={barRef} /></div>
          </div>

          <div className="p-2 border-b border-cream" style={{ flex: '0 0 140px', minHeight: 0 }}>
            <div className="text-[9px] font-semibold text-dark2 uppercase mb-1">GMV Breakdown</div>
            <div style={{ height: '100px' }}><canvas ref={donutRef} /></div>
          </div>

          <div className="p-1.5 border-b border-cream flex-shrink-0">
            <div className="metric-row">
              <div className="metric-card">
                <div className="metric-card-label">Creators</div>
                <div className="metric-card-value">{fmtNum(metrics?.creators)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-card-label">Products Sold</div>
                <div className="metric-card-value">{shortNum(metrics?.products)}</div>
              </div>
            </div>
            <div className="metric-row">
              <div className="metric-card">
                <div className="metric-card-label">Avg Conv%</div>
                <div className="metric-card-value">{fmtPct(avgConv)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-card-label">Commission</div>
                <div className="metric-card-value">{shortNum(comm)}</div>
              </div>
            </div>
          </div>

          <div className="p-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-semibold text-dark2 uppercase">GMV / Commission</span>
              <span className="text-[11px] font-bold" style={{ color: barColor }}>{ratio.toFixed(2)}×</span>
            </div>
            <div className="h-2 bg-cream rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: barWidth + '%', background: barColor }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[8px] text-gray-400">0×</span>
              <span className="text-[8px] text-gray-400">2×</span>
              <span className="text-[8px] text-gray-400">4×+</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
