'use client'
// Fit-for-allocation charts (NOT a bubble-matrix clone): Pareto (bars + cumulative
// line + 80% ref), share donut, multi-series trend, grouped MoM. All via the shared
// theme (centrally registered, SSR-safe). Pure presentation — data from the engine.
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { seriesColor, withAlpha, SEMANTIC, baseOptions, mergeOptions } from '@/lib/charts/theme'
import { formatCurrency } from '@/lib/utils'

export const keyColor = (i) => seriesColor(i)
const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }

// 80%-line overlay on the cumulative (y1) axis.
function ref80Plugin() {
  return {
    id: 'ref80',
    afterDraw(chart) {
      const y1 = chart.scales?.y1, area = chart.chartArea, ctx = chart.ctx
      if (!y1 || !area) return
      const py = y1.getPixelForValue(80)
      if (py < area.top || py > area.bottom) return
      ctx.save()
      ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeStyle = withAlpha(SEMANTIC.danger, 0.6)
      ctx.beginPath(); ctx.moveTo(area.left, py); ctx.lineTo(area.right, py); ctx.stroke()
      ctx.font = '600 9px Inter, sans-serif'; ctx.fillStyle = withAlpha(SEMANTIC.danger, 0.8)
      ctx.textAlign = 'left'; ctx.fillText('80%', area.left + 3, py - 3)
      ctx.restore()
    },
  }
}

// ── Pareto: bars (spend, top-80 highlighted) + cumulative-% line ──────────────
// extraSeries (Part B5 — calc fields as a CHART SERIES): [{ label, data:number[], dummy }]
// rendered as extra line datasets on the spend (y) axis. Additive — default [].
export function ParetoChart({ items = [], height = 300, onSelect, extraSeries = [] }) {
  const labels = items.map(i => i.key)
  const data = {
    labels,
    datasets: [
      { type: 'bar', label: 'Spend', yAxisID: 'y', order: 2,
        data: items.map(i => i.spend),
        backgroundColor: items.map((i, idx) => withAlpha(keyColor(idx), i.inTop80 ? 0.85 : 0.3)),
        borderColor: items.map((_, idx) => keyColor(idx)), borderWidth: 1 },
      { type: 'line', label: 'Cumulative %', yAxisID: 'y1', order: 1,
        data: items.map(i => i.cumulativePct),
        borderColor: SEMANTIC.warning, backgroundColor: withAlpha(SEMANTIC.warning, 0.1),
        pointRadius: 3, pointBackgroundColor: SEMANTIC.warning, tension: 0.2, fill: false },
      ...extraSeries.map((s, i) => ({
        type: 'line', label: s.label + ' (ƒx)', yAxisID: 'y', order: 0,
        data: s.data, borderColor: keyColor(i + 5), backgroundColor: withAlpha(keyColor(i + 5), 0.1),
        borderDash: [5, 3], pointRadius: 2, tension: 0.2, fill: false,
      })),
    ],
  }
  const options = mergeOptions(baseOptions, {
    onClick: (_e, els) => { if (onSelect && els?.length) { const k = labels[els[0].index]; if (k) onSelect(k) } },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 } } },
      tooltip: { callbacks: {
        label: c => c.dataset.type === 'line' ? `Cumulative ${c.parsed.y}%` : `${formatCurrency(c.parsed.y)} (${items[c.dataIndex]?.sharePct}%)`,
      } },
    },
    scales: {
      x: { ticks: { font: { size: 8 }, maxRotation: 50, minRotation: 30 } },
      y:  { position: 'left',  beginAtZero: true, ticks: { callback: v => shortRp(v), font: { size: 9 } }, title: { display: true, text: 'Spend', font: { size: 9 } } },
      y1: { position: 'right', beginAtZero: true, max: 100, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%', font: { size: 9 } }, title: { display: true, text: 'Cumulative %', font: { size: 9 } } },
    },
  })
  return <div style={{ height }}><Bar data={data} options={options} plugins={[ref80Plugin()]} /></div>
}

// ── Share donut ───────────────────────────────────────────────────────────────
export function ShareDonut({ items = [], height = 300, onSelect }) {
  const labels = items.map(i => i.key)
  const total = items.reduce((a, i) => a + i.spend, 0) || 1
  const data = { labels, datasets: [{ data: items.map(i => i.spend), backgroundColor: items.map((_, i) => keyColor(i)), borderWidth: 1, borderColor: '#fff' }] }
  const options = mergeOptions(baseOptions, {
    cutout: '55%',
    onClick: (_e, els) => { if (onSelect && els?.length) { const k = labels[els[0].index]; if (k) onSelect(k) } },
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 8, font: { size: 8 } } },
      tooltip: { callbacks: { label: c => ` ${formatCurrency(c.parsed)} (${Math.round((c.parsed / total) * 1000) / 10}%)` } },
    },
  })
  return <div style={{ height }}><Doughnut data={data} options={options} /></div>
}

// ── Multi-series trend (range-bounded; empty-state handled by the page) ───────
export function TrendChart({ points = [], keys = [], height = 280 }) {
  const periods = [...new Set(points.map(p => p.period))].sort()
  const byKey = {}
  for (const p of points) (byKey[p.key] ??= {})[p.period] = p.spend
  const datasets = keys.map((k, i) => ({
    label: k, data: periods.map(d => byKey[k]?.[d] ?? 0),
    borderColor: keyColor(i), backgroundColor: withAlpha(keyColor(i), 0.1),
    pointRadius: 1, tension: 0.25, fill: false, borderWidth: 1.5,
  }))
  const options = mergeOptions(baseOptions, {
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 8, font: { size: 8 } } },
      tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } },
    },
    scales: {
      x: { ticks: { font: { size: 8 }, maxTicksLimit: 12 } },
      y: { beginAtZero: true, ticks: { callback: v => shortRp(v), font: { size: 9 } } },
    },
  })
  return <div style={{ height }}><Line data={{ labels: periods, datasets }} options={options} /></div>
}

// ── Grouped MoM (previous vs current per key) ─────────────────────────────────
export function MoMChart({ comparison = [], previousMonth, currentMonth, height = 280 }) {
  const labels = comparison.map(c => c.key)
  const data = {
    labels,
    datasets: [
      { label: previousMonth || 'Previous', data: comparison.map(c => c.previous ?? 0), backgroundColor: withAlpha(seriesColor(2), 0.6), borderColor: seriesColor(2), borderWidth: 1 },
      { label: currentMonth || 'Current', data: comparison.map(c => c.current ?? 0), backgroundColor: withAlpha(seriesColor(0), 0.8), borderColor: seriesColor(0), borderWidth: 1 },
    ],
  }
  const options = mergeOptions(baseOptions, {
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 } } },
      tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } },
    },
    scales: {
      x: { ticks: { font: { size: 8 }, maxRotation: 50, minRotation: 30 } },
      y: { beginAtZero: true, ticks: { callback: v => shortRp(v), font: { size: 9 } } },
    },
  })
  return <div style={{ height }}><Bar data={data} options={options} /></div>
}
