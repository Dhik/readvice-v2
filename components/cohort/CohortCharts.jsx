'use client'
// Cohort charts — MAIN triangular retention HEATMAP (chartjs-chart-matrix, statically
// registered + SSR-safe via theme.js) + acquisition-volume bar + detail retention curve.
// The 1 REAL cell (latest cohort p0) is drawn distinct (green, thick border) from the 35
// DUMMY decay cells (orange intensity ∝ retention%). Triangular = only real cells plotted.
import { Chart, Bar, Line } from 'react-chartjs-2'
import { baseOptions, mergeOptions, withAlpha, seriesColor, SEMANTIC } from '@/lib/charts/theme'
import { formatNumber } from '@/lib/utils'

export const REAL_COLOR = '#22c55e'    // green — the one real cell / real markers
export const DUMMY_COLOR = '#E07B39'   // orange — dummy projected retention

// Dummy cell color: orange intensity ramps with retention%. Real cell: solid green.
function cellColor(v, real) {
  if (real) return withAlpha(REAL_COLOR, 0.85)
  return withAlpha(DUMMY_COLOR, 0.12 + Math.min(1, (Number(v) || 0) / 100) * 0.72)
}

// ── MAIN: triangular retention heatmap ──
export function RetentionHeatmap({ cohorts = [], maxPeriod = 0, height = 440, onSelect }) {
  // y categories: oldest at top → render newest-first as the category list is bottom-up.
  const rowLabels = cohorts.map(c => c.cohortMonth)            // oldest→newest (engine order)
  const yLabels = [...rowLabels].reverse()                     // category axis: index 0 bottom → put newest at bottom
  const cells = []
  for (const c of cohorts) for (const cell of c.cells) {
    cells.push({ x: cell.periodIndex, y: c.cohortMonth, v: cell.retentionPct,
      _real: !cell.dummy, _dummy: cell.dummy, _size: c.cohortSize, _ret: cell.customersRetained, _cohort: c.cohortMonth, _period: cell.periodIndex })
  }
  const data = {
    datasets: [{
      label: 'Retention', data: cells,
      backgroundColor: ctx => cellColor(ctx.raw?.v, ctx.raw?._real),
      borderColor: ctx => ctx.raw?._real ? REAL_COLOR : 'rgba(44,54,57,0.08)',
      borderWidth: ctx => ctx.raw?._real ? 2.5 : 0.5,
      width: ({ chart }) => { const a = chart.chartArea; return a ? Math.max(8, a.width / (maxPeriod + 1) - 3) : 20 },
      height: ({ chart }) => { const a = chart.chartArea; return a ? Math.max(8, a.height / (yLabels.length || 1) - 3) : 20 },
    }],
  }
  const options = mergeOptions(baseOptions, {
    onClick: (_e, els) => { if (onSelect && els?.length) { const r = cells[els[0].index]; if (r?._cohort) onSelect(r._cohort) } },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: {
        title: items => { const r = items[0]?.raw; return r ? `${r._cohort} · month ${r._period}` : '' },
        label: r => {
          const c = r.raw
          return [`Retention: ${c.v}%  ${c._real ? '(REAL)' : '(dummy)'}`, `${formatNumber(c._ret)} of ${formatNumber(c._size)} customers`]
        },
      } },
    },
    scales: {
      x: { type: 'linear', position: 'top', min: -0.5, max: maxPeriod + 0.5, offset: false,
        ticks: { stepSize: 1, callback: v => Number.isInteger(v) ? `M${v}` : '', font: { size: 9 } },
        grid: { display: false }, title: { display: true, text: 'Months since acquisition', font: { size: 9 } } },
      y: { type: 'category', labels: yLabels, offset: true, ticks: { font: { size: 9 } }, grid: { display: false } },
    },
  })
  return <div style={{ height }}><Chart type="matrix" data={data} options={options} /></div>
}

// ── Acquisition-volume bar (period-0 cohort sizes). Real cohort green, dummy orange. ──
export function AcquisitionTrend({ points = [], height = 240 }) {
  const data = {
    labels: points.map(p => p.cohortMonth),
    datasets: [{ label: 'Cohort size', data: points.map(p => p.size),
      backgroundColor: points.map(p => withAlpha(p.dummy ? DUMMY_COLOR : REAL_COLOR, p.dummy ? 0.55 : 0.8)),
      borderColor: points.map(p => p.dummy ? DUMMY_COLOR : REAL_COLOR), borderWidth: 1 }],
  }
  const options = mergeOptions(baseOptions, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const p = points[c.dataIndex]; return `${formatNumber(c.parsed.y)} customers ${p.dummy ? '(dummy cohort)' : '(REAL)'}` } } } },
    scales: { x: { ticks: { font: { size: 8 }, maxRotation: 45, minRotation: 30 } }, y: { beginAtZero: true, ticks: { font: { size: 9 } } } },
  })
  return <div style={{ height }}><Bar data={data} options={options} /></div>
}

// ── Detail: one cohort's retention curve. Real points green-filled, dummy hollow/orange. ──
export function RetentionCurve({ curve = [], height = 220 }) {
  const data = {
    labels: curve.map(c => `M${c.periodIndex}`),
    datasets: [{ label: 'Retention %', data: curve.map(c => c.retentionPct),
      borderColor: DUMMY_COLOR, backgroundColor: withAlpha(DUMMY_COLOR, 0.12), fill: true, tension: 0.3, borderWidth: 1.5,
      pointRadius: 5, pointBackgroundColor: curve.map(c => c.dummy ? '#fff' : REAL_COLOR),
      pointBorderColor: curve.map(c => c.dummy ? DUMMY_COLOR : REAL_COLOR), pointBorderWidth: 2 }],
  }
  const options = mergeOptions(baseOptions, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const x = curve[c.dataIndex]; return [`${c.parsed.y}% retained ${x.dummy ? '(dummy)' : '(REAL)'}`, `${formatNumber(x.customersRetained)} customers`] } } } },
    scales: { x: { ticks: { font: { size: 9 } } }, y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%', font: { size: 9 } } } },
  })
  return <div style={{ height }}><Line data={data} options={options} /></div>
}
