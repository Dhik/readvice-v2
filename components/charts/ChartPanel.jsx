'use client'
import { useState } from 'react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { baseOptions, mergeOptions } from '@/lib/charts/theme' // named+used import → triggers central chart registration + defaults

const CHART_TYPES = [
  { key: 'line',     label: 'Trend' },
  { key: 'bar',      label: 'Bar' },
  { key: 'doughnut', label: 'Mix' },
]

// `lineOptions` is merged into BOTH the line and bar views (same dataset);
// `donutOptions` into the doughnut view. `chartRef` is forwarded to the active
// chart so callers can drive it (e.g. resetZoom()). Branded style/legend/font come
// from Chart.defaults (Fase 2a) — callers pass only deltas (tooltips/zoom/labels).
export default function ChartPanel({
  lineData, donutData, defaultView = 'line', height = 220,
  lineOptions, donutOptions, chartRef,
}) {
  const [active, setActive] = useState(defaultView)

  const barData = lineData
    ? { ...lineData, datasets: lineData.datasets.map(ds => ({ ...ds, fill: false, backgroundColor: ds.borderColor })) }
    : null

  const baseLine  = { ...baseOptions, plugins: { legend: { position: 'top' } } }
  const lineOpts  = mergeOptions(baseLine, lineOptions)
  const donutOpts = mergeOptions(
    { ...baseOptions, plugins: { legend: { position: 'bottom' } }, cutout: '62%' },
    donutOptions,
  )

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
        {active === 'line'     && lineData  && <Line     ref={chartRef} data={lineData}  options={lineOpts} />}
        {active === 'bar'      && barData   && <Bar      ref={chartRef} data={barData}   options={lineOpts} />}
        {active === 'doughnut' && donutData && <Doughnut ref={chartRef} data={donutData} options={donutOpts} />}
        {!lineData && (
          <div className="flex items-center justify-center h-full text-dark1/30 text-sm">No data</div>
        )}
      </div>
    </div>
  )
}
