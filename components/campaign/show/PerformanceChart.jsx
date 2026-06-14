'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart } from 'chart.js'
import { seriesColor, withAlpha } from '@/lib/charts/theme'

function shortNum(val) {
  if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B'
  if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M'
  if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K'
  return String(val)
}

const AXIS_OPTIONS = [
  { label: 'Daily Spend',    key: 'total_spend' },
  { label: 'Daily GMV',      key: 'total_gmv' },
  { label: 'Daily Views',    key: 'total_view' },
  { label: 'Daily Likes',    key: 'total_like' },
  { label: 'Daily Comments', key: 'total_comment' },
]

function linearRegression(points) {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: 0, r: 0, rSquared: 0, pValue: 1 }
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0
  for (const p of points) {
    sumX  += p.x; sumY  += p.y
    sumXY += p.x * p.y
    sumXX += p.x * p.x
    sumYY += p.y * p.y
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1)
  const intercept = (sumY - slope * sumX) / n
  const meanY = sumY / n
  const ssRes = points.reduce((acc, p) => acc + Math.pow(p.y - (slope * p.x + intercept), 2), 0)
  const ssTot = points.reduce((acc, p) => acc + Math.pow(p.y - meanY, 2), 0)
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0
  const r = Math.sign(slope) * Math.sqrt(Math.max(0, rSquared))
  // simplified p-value approximation
  const t = r * Math.sqrt((n - 2) / (1 - rSquared + 1e-10))
  const pValue = Math.exp(-0.717 * Math.abs(t) - 0.416 * t * t)
  return { slope, intercept, r: +r.toFixed(4), rSquared: +rSquared.toFixed(4), pValue: +pValue.toFixed(4) }
}

function corrStrength(r) {
  const a = Math.abs(r)
  if (a >= 0.8) return 'Very Strong'
  if (a >= 0.6) return 'Strong'
  if (a >= 0.4) return 'Moderate'
  if (a >= 0.2) return 'Weak'
  return 'Very Weak'
}

export default function PerformanceChart({ chartData }) {
  const canvasRef   = useRef(null)
  const chartRef    = useRef(null)
  const [mode, setMode] = useState('trends') // trends | correlation
  const [xAxis, setXAxis] = useState('total_spend')
  const [yAxis, setYAxis] = useState('total_gmv')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    if (mode === 'trends') {
      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: chartData.map(d => d.date),
          datasets: [
            {
              label: 'Views',
              data: chartData.map(d => d.total_view ?? 0),
              borderColor: seriesColor(0), backgroundColor: withAlpha(seriesColor(0), 0.1), fill: true,
              tension: 0.3, pointRadius: 2,
            },
            {
              label: 'Likes',
              data: chartData.map(d => d.total_like ?? 0),
              borderColor: seriesColor(7), backgroundColor: withAlpha(seriesColor(7), 0.1), fill: true,
              tension: 0.3, pointRadius: 2,
            },
            {
              label: 'Comments',
              data: chartData.map(d => d.total_comment ?? 0),
              borderColor: seriesColor(5), backgroundColor: withAlpha(seriesColor(5), 0.1), fill: true,
              tension: 0.3, pointRadius: 2,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: ctx => ctx.dataset.label + ': ' + new Intl.NumberFormat().format(ctx.parsed.y),
              },
            },
          },
          scales: {
            x: { ticks: { font: { size: 9 } } },
            y: { ticks: { callback: v => shortNum(v), font: { size: 9 } } },
          },
        },
      })
    } else {
      // Correlation scatter
      const points = chartData
        .map(d => ({ x: d[xAxis] ?? 0, y: d[yAxis] ?? 0, date: d.date }))
        .filter(p => p.x > 0 || p.y > 0)

      const reg = linearRegression(points)
      setStats({ ...reg, n: points.length, total: chartData.length })

      const xs = points.map(p => p.x)
      const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 1)
      const trendLine = [
        { x: minX, y: reg.slope * minX + reg.intercept },
        { x: maxX, y: reg.slope * maxX + reg.intercept },
      ]

      chartRef.current = new Chart(canvasRef.current, {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Data Points',
              data: points,
              backgroundColor: withAlpha(seriesColor(0), 0.6),
              pointRadius: 4,
            },
            {
              label: 'Trend',
              data: trendLine,
              type: 'line',
              borderColor: seriesColor(1),
              borderDash: [4, 4],
              pointRadius: 0,
              fill: false,
              tension: 0,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  if (ctx.datasetIndex === 1) return null
                  const p = ctx.raw
                  return [`Date: ${p.date}`, `X: ${shortNum(p.x)}`, `Y: ${shortNum(p.y)}`]
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: AXIS_OPTIONS.find(o => o.key === xAxis)?.label ?? xAxis, font: { size: 9 } },
              ticks: { callback: v => shortNum(v), font: { size: 9 } },
            },
            y: {
              title: { display: true, text: AXIS_OPTIONS.find(o => o.key === yAxis)?.label ?? yAxis, font: { size: 9 } },
              ticks: { callback: v => shortNum(v), font: { size: 9 } },
            },
          },
        },
      })
    }

    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [chartData, mode, xAxis, yAxis])

  const pSig = stats
    ? stats.pValue < 0.001 ? '***' : stats.pValue < 0.01 ? '**' : stats.pValue < 0.05 ? '*' : stats.pValue < 0.1 ? '†' : ''
    : ''

  return (
    <div className="sv-chart-panel-show">
      <div className="sv-panel-header-dark">
        <span className="flex items-center gap-1.5">
          <i className="fas fa-chart-line text-orange"></i> Campaign Performance Analytics
        </span>
        <div className="flex gap-1">
          <button className={'sv-chart-btn' + (mode === 'trends' ? ' sv-chart-btn-active' : '')}
            onClick={() => setMode('trends')}>Trends</button>
          <button className={'sv-chart-btn' + (mode === 'correlation' ? ' sv-chart-btn-active' : '')}
            onClick={() => setMode('correlation')}>Correlation</button>
        </div>
      </div>

      {/* Axis selectors (correlation only) */}
      {mode === 'correlation' && (
        <div className="flex gap-2 px-3 py-1.5 border-b border-cream bg-bg/50 text-xs items-center">
          <span className="text-[10px] text-dark2 font-medium">X:</span>
          <select value={xAxis} onChange={e => setXAxis(e.target.value)}
            className="border border-cream rounded px-1.5 py-0.5 text-[11px] text-dark1 focus:outline-none bg-white">
            {AXIS_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <span className="text-[10px] text-dark2 font-medium ml-2">Y:</span>
          <select value={yAxis} onChange={e => setYAxis(e.target.value)}
            className="border border-cream rounded px-1.5 py-0.5 text-[11px] text-dark1 focus:outline-none bg-white">
            {AXIS_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 p-3 min-h-0" style={{ height: '340px' }}>
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              No chart data available
            </div>
          ) : (
            <canvas ref={canvasRef}></canvas>
          )}
        </div>

        {/* Correlation stats panel */}
        {mode === 'correlation' && stats && (
          <div className="border-l border-cream p-3 flex-shrink-0 text-xs" style={{ width: '220px' }}>
            <div className="text-[10px] font-bold text-dark1 mb-2 uppercase tracking-wide">
              Correlation Statistics
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-dark2">R² (R-squared)</span>
                <span className="font-bold text-dark1">{stats.rSquared}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark2">Correlation (r)</span>
                <span className="font-bold text-dark1">{stats.r}{pSig}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark2">Strength</span>
                <span className="font-bold text-dark1">{corrStrength(stats.r)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark2">Valid Points</span>
                <span className="font-bold text-dark1">{stats.n}/{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark2">P-value</span>
                <span className="font-bold text-dark1">{stats.pValue}{pSig}</span>
              </div>
            </div>
            <div className="mt-3 text-[9px] text-gray-400 border-t border-cream pt-2">
              *** p&lt;0.001, ** p&lt;0.01, * p&lt;0.05, † p&lt;0.1
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
