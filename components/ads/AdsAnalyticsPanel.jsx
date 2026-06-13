'use client'
import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import { formatCurrency } from '@/lib/utils'
Chart.register(...registerables)

function shortNum(val) {
  if (!val) return '0'
  if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B'
  if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M'
  if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K'
  return String(val)
}

const PLATFORM_COLORS = ['#1877F2', '#EE4D2D', '#010101', '#0F146D']
const PLATFORM_LABELS = ['Meta', 'Shopee', 'TikTok', 'Lazada']

export default function AdsAnalyticsPanel({ kpiData, donutSpends }) {
  const barRef     = useRef(null)
  const donutRef   = useRef(null)
  const barChart   = useRef(null)
  const donutChart = useRef(null)

  // Initialise charts once on mount
  useEffect(() => {
    if (!barRef.current || !donutRef.current) return

    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: ['Spent', 'Revenue'],
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
        labels: PLATFORM_LABELS,
        datasets: [{ data: [1, 1, 1, 1], backgroundColor: PLATFORM_COLORS }],
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

  // Update bar chart when kpiData changes
  useEffect(() => {
    if (!barChart.current) return
    barChart.current.data.datasets[0].data = [
      kpiData?.totalSpent   ?? 0,
      kpiData?.totalRevenue ?? 0,
    ]
    barChart.current.update()
  }, [kpiData])

  // Update donut chart when platform mix changes
  useEffect(() => {
    if (!donutChart.current) return
    const total = donutSpends.reduce((a, b) => a + b, 0)
    donutChart.current.data.datasets[0].data = total > 0 ? donutSpends : [1, 1, 1, 1]
    donutChart.current.update()
  }, [donutSpends])

  const spent   = kpiData?.totalSpent   ?? 0
  const revenue = kpiData?.totalRevenue ?? 0
  const roas    = kpiData?.avgRoas  != null ? `${Number(kpiData.avgRoas).toFixed(2)}×`             : '—'
  const cpc     = kpiData?.avgCpc   != null ? formatCurrency(Number(kpiData.avgCpc))               : '—'
  const ctr     = kpiData?.avgCtr   != null ? `${(Number(kpiData.avgCtr) * 100).toFixed(2)}%`      : '—'
  const clicks  = kpiData?.totalClicks ?? 0

  const ratio    = spent > 0 ? revenue / spent : 0
  const barWidth = Math.min(100, (ratio / 4) * 100)
  const barColor = ratio >= 2 ? '#28a745' : ratio >= 1 ? '#E07B39' : '#dc3545'

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      <div className="p-2 border-b border-cream" style={{ flex: '0 0 160px', minHeight: 0 }}>
        <div className="text-[9px] font-semibold text-dark2 uppercase mb-1">Spent vs Revenue</div>
        <div style={{ height: '120px' }}>
          <canvas ref={barRef} />
        </div>
      </div>

      <div className="p-2 border-b border-cream" style={{ flex: '0 0 140px', minHeight: 0 }}>
        <div className="text-[9px] font-semibold text-dark2 uppercase mb-1">Platform Mix</div>
        <div style={{ height: '100px' }}>
          <canvas ref={donutRef} />
        </div>
      </div>

      <div className="p-1.5 border-b border-cream flex-shrink-0">
        <div className="metric-row">
          <div className="metric-card">
            <div className="metric-card-label">Avg ROAS</div>
            <div className="metric-card-value">{roas}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Avg CPC</div>
            <div className="metric-card-value">{cpc}</div>
          </div>
        </div>
        <div className="metric-row">
          <div className="metric-card">
            <div className="metric-card-label">Avg CTR</div>
            <div className="metric-card-value">{ctr}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Clicks</div>
            <div className="metric-card-value">{shortNum(clicks)}</div>
          </div>
        </div>
      </div>

      <div className="p-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-semibold text-dark2 uppercase">Revenue / Spent</span>
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
  )
}
