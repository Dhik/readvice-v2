'use client'
import { useState } from 'react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const CHART_TYPES = [
  { key: 'line',     label: 'Trend' },
  { key: 'bar',      label: 'Bar' },
  { key: 'doughnut', label: 'Mix' },
]

export default function ChartPanel({ lineData, donutData, defaultView = 'line', height = 220 }) {
  const [active, setActive] = useState(defaultView)

  const barData = lineData
    ? { ...lineData, datasets: lineData.datasets.map(ds => ({ ...ds, fill: false, backgroundColor: ds.borderColor })) }
    : null

  const opts = { maintainAspectRatio: false, responsive: true, plugins: { legend: { position: 'top' } } }
  const visibleTypes = donutData ? CHART_TYPES : CHART_TYPES.filter(t => t.key !== 'doughnut')

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 px-3 pt-2 pb-1">
        {visibleTypes.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`tab-pill ${active === t.key ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 px-3 pb-3" style={{ minHeight: height }}>
        {active === 'line'     && lineData  && <Line     data={lineData}  options={opts} />}
        {active === 'bar'      && barData   && <Bar      data={barData}   options={opts} />}
        {active === 'doughnut' && donutData && (
          <Doughnut
            data={donutData}
            options={{ ...opts, plugins: { legend: { position: 'bottom' } }, cutout: '62%' }}
          />
        )}
        {!lineData && (
          <div className="flex items-center justify-center h-full text-dark1/30 text-sm">No data</div>
        )}
      </div>
    </div>
  )
}
