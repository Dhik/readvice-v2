'use client'
// Finance-fit charts: gross-margin WATERFALL (Revenue → −COGS → Gross Profit, with
// marketing as a SEPARATE not-deducted bar), margin PARETO (by gross profit), and a
// revenue/HPP/profit/margin TREND. All via the shared theme (registered, SSR-safe).
import { Bar, Line } from 'react-chartjs-2'
import { baseOptions, mergeOptions, withAlpha, seriesColor, SEMANTIC } from '@/lib/charts/theme'
import { formatCurrency } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; const s = n < 0 ? '-' : ''; const a = Math.abs(n); if (a >= 1e9) return s + (a / 1e9).toFixed(1) + 'B'; if (a >= 1e6) return s + (a / 1e6).toFixed(0) + 'M'; if (a >= 1e3) return s + (a / 1e3).toFixed(0) + 'K'; return s + Math.round(a) }

// ── Waterfall: floating bars. Marketing is a SEPARATE bar (NOT in the gross-profit sum).
export function MarginWaterfall({ revenue = 0, hpp = 0, grossProfit = 0, marketing = 0, marketingOverlaps = false, height = 300 }) {
  const labels = ['Revenue', '− COGS (HPP)', 'Gross Profit', 'Marketing (not deducted)']
  const mags = [revenue, -hpp, grossProfit, marketing]               // signed magnitudes for tooltip
  const data = {
    labels,
    datasets: [{
      data: [[0, revenue], [grossProfit, revenue], [0, grossProfit], [0, marketing]], // floating [base, top]
      backgroundColor: [withAlpha(seriesColor(7), 0.75), withAlpha(SEMANTIC.danger, 0.7), withAlpha(SEMANTIC.success, 0.8), withAlpha(seriesColor(6), 0.35)],
      borderColor: [seriesColor(7), SEMANTIC.danger, SEMANTIC.success, seriesColor(6)],
      borderWidth: 1, borderSkipped: false,
    }],
  }
  const options = mergeOptions(baseOptions, {
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: {
        label: c => {
          if (c.dataIndex === 3) return marketingOverlaps ? `Marketing: ${formatCurrency(marketing)} (context — NOT deducted)` : 'Marketing: Rp0 in this window (Jan–Feb data, no overlap) — not deducted'
          return `${labels[c.dataIndex]}: ${formatCurrency(mags[c.dataIndex])}`
        },
      } },
    },
    scales: {
      x: { ticks: { font: { size: 9 }, maxRotation: 20, minRotation: 0 } },
      y: { beginAtZero: true, ticks: { callback: v => shortRp(v), font: { size: 9 } } },
    },
  })
  return <div style={{ height }}><Bar data={data} options={options} /></div>
}

// ── Margin Pareto: bars (gross profit, top-80 highlighted) + cumulative-% line + 80% ref.
function ref80Plugin() {
  return { id: 'gmRef80', afterDraw(chart) {
    const y1 = chart.scales?.y1, a = chart.chartArea, ctx = chart.ctx
    if (!y1 || !a) return
    const py = y1.getPixelForValue(80); if (py < a.top || py > a.bottom) return
    ctx.save(); ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeStyle = withAlpha(SEMANTIC.danger, 0.6)
    ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke()
    ctx.font = '600 9px Inter, sans-serif'; ctx.fillStyle = withAlpha(SEMANTIC.danger, 0.8); ctx.textAlign = 'left'
    ctx.fillText('80%', a.left + 3, py - 3); ctx.restore()
  } }
}
export function MarginParetoChart({ items = [], height = 300, onSelect }) {
  const labels = items.map(i => i.name)
  const data = {
    labels,
    datasets: [
      { type: 'bar', label: 'Gross profit', yAxisID: 'y', order: 2,
        data: items.map(i => i.grossProfit),
        backgroundColor: items.map(i => withAlpha(SEMANTIC.success, i.inTop80 ? 0.8 : 0.3)),
        borderColor: items.map(() => SEMANTIC.success), borderWidth: 1 },
      { type: 'line', label: 'Cumulative %', yAxisID: 'y1', order: 1,
        data: items.map(i => i.cumulativePct),
        borderColor: SEMANTIC.warning, backgroundColor: withAlpha(SEMANTIC.warning, 0.1),
        pointRadius: 2, tension: 0.2, fill: false },
    ],
  }
  const options = mergeOptions(baseOptions, {
    onClick: (_e, els) => { if (onSelect && els?.length) { const it = items[els[0].index]; if (it) onSelect(it.sku) } },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 } } },
      tooltip: { callbacks: { label: c => c.dataset.type === 'line' ? `Cumulative ${c.parsed.y}%` : `${formatCurrency(c.parsed.y)} (${items[c.dataIndex]?.sharePct}% · margin ${items[c.dataIndex]?.marginPct}%)` } },
    },
    scales: {
      x: { ticks: { font: { size: 7 }, maxRotation: 60, minRotation: 45 } },
      y:  { position: 'left', beginAtZero: true, ticks: { callback: v => shortRp(v), font: { size: 9 } }, title: { display: true, text: 'Gross profit', font: { size: 9 } } },
      y1: { position: 'right', beginAtZero: true, max: 100, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%', font: { size: 9 } } },
    },
  })
  return <div style={{ height }}><Bar data={data} options={options} plugins={[ref80Plugin()]} /></div>
}

// ── Trend: revenue / HPP / gross profit (Rp, y) + margin% (y1).
export function MarginTrendChart({ points = [], height = 280 }) {
  const labels = points.map(p => p.date)
  const data = {
    labels,
    datasets: [
      { label: 'Revenue', data: points.map(p => p.revenue), borderColor: seriesColor(7), backgroundColor: withAlpha(seriesColor(7), 0.08), pointRadius: 2, tension: 0.25, fill: true, yAxisID: 'y', borderWidth: 1.5 },
      { label: 'COGS (HPP)', data: points.map(p => p.hpp), borderColor: SEMANTIC.danger, pointRadius: 2, tension: 0.25, fill: false, yAxisID: 'y', borderWidth: 1.5 },
      { label: 'Gross profit', data: points.map(p => p.grossProfit), borderColor: SEMANTIC.success, pointRadius: 2, tension: 0.25, fill: false, yAxisID: 'y', borderWidth: 1.5 },
      { label: 'Margin %', data: points.map(p => p.marginPct), borderColor: SEMANTIC.warning, borderDash: [4, 3], pointRadius: 2, tension: 0.25, fill: false, yAxisID: 'y1', borderWidth: 1.5 },
    ],
  }
  const options = mergeOptions(baseOptions, {
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 8, font: { size: 8 } } },
      tooltip: { callbacks: { label: c => c.dataset.yAxisID === 'y1' ? `${c.dataset.label}: ${c.parsed.y}%` : `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } },
    },
    scales: {
      x: { ticks: { font: { size: 9 } } },
      y:  { position: 'left', beginAtZero: true, ticks: { callback: v => shortRp(v), font: { size: 9 } } },
      y1: { position: 'right', beginAtZero: true, max: 100, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%', font: { size: 9 } } },
    },
  })
  return <div style={{ height }}><Line data={data} options={options} /></div>
}
