'use client'
// Operational charts — 4 distinct forms: FUNNEL (pipeline) · QUADRANT (stock velocity)
// · TREND (cancellation) · HISTOGRAM (fulfilment, DUMMY). All via the shared theme
// (registered, SSR-safe). REAL sections plain; the histogram is the dummy slice (orange).
import { Bar, Bubble, Line } from 'react-chartjs-2'
import { baseOptions, mergeOptions, withAlpha, seriesColor, SEMANTIC } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

export const DUMMY_COLOR = '#E07B39'  // orange — the fabricated fulfilment slice
const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }

// Stock-velocity quadrant colors (inventory action).
export const STOCK_QUAD_COLORS = { 'Reorder': '#dc3545', 'Healthy': '#22c55e', 'Overstock': '#6B8E9E', 'Discontinue?': '#C9A66B' }
export const stockQuadColor = q => STOCK_QUAD_COLORS[q] ?? '#8B8B8B'
const QUAD_ORDER = ['Reorder', 'Healthy', 'Overstock', 'Discontinue?']

// ── FUNNEL (REAL): pipeline stages as horizontal bars + Cancelled drop-off (red). ──
export function StatusFunnel({ stages = [], cancelled = { count: 0, pct: 0 }, height = 280 }) {
  const labels = [...stages.map(s => s.stage), 'Cancelled (drop-off)']
  const counts = [...stages.map(s => s.count), cancelled.count]
  const pcts = [...stages.map(s => s.pct), cancelled.pct]
  // Pipeline stages in a slate→teal ramp; cancelled red.
  const stageColors = ['#6B8E9E', '#3F4E4F', '#2C3639', '#22c55e']
  const colors = [...stages.map((_, i) => withAlpha(stageColors[i % stageColors.length], 0.8)), withAlpha(SEMANTIC.danger, 0.75)]
  const data = { labels, datasets: [{ label: 'Orders', data: counts, backgroundColor: colors, borderColor: colors.map(c => c), borderWidth: 1 }] }
  const options = mergeOptions(baseOptions, {
    indexAxis: 'y',
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${formatNumber(c.parsed.x)} orders (${pcts[c.dataIndex]}%)` } } },
    scales: { x: { beginAtZero: true, ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } },
  })
  return <div style={{ height }}><Bar data={data} options={options} /></div>
}

// ── QUADRANT (REAL): units-sold × stock, bubble = revenue. Honest about 0% coverage:
// when stock is untracked, only the 2 bottom (low-stock) buckets exist → draw only the
// vertical demand divider + bottom labels, never a misleading full 4-quadrant.
function quadDivider(xMed, yMed, degenerate) {
  return {
    id: 'stockDividers',
    afterDraw(chart) {
      const { ctx, chartArea: a, scales } = chart
      if (!a || !scales?.x || !scales?.y) return
      ctx.save(); ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(44,54,57,0.3)'
      if (Number.isFinite(xMed)) { const px = scales.x.getPixelForValue(xMed); if (px >= a.left && px <= a.right) { ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke() } }
      if (!degenerate && Number.isFinite(yMed)) { const py = scales.y.getPixelForValue(yMed); if (py >= a.top && py <= a.bottom) { ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke() } }
      ctx.setLineDash([]); ctx.font = '600 10px Inter, sans-serif'; const pad = 6
      const put = (t, x, y, ax, ay) => { ctx.textAlign = ax; ctx.textBaseline = ay; ctx.fillStyle = withAlpha(stockQuadColor(t), 0.85); ctx.fillText(t.toUpperCase(), x, y) }
      // Low-stock (bottom) buckets always shown; high-stock (top) only when stock is tracked.
      put('Discontinue?', a.left + pad, a.bottom - pad, 'left', 'bottom')
      put('Reorder', a.right - pad, a.bottom - pad, 'right', 'bottom')
      if (!degenerate) { put('Overstock', a.left + pad, a.top + pad, 'left', 'top'); put('Healthy', a.right - pad, a.top + pad, 'right', 'top') }
      ctx.restore()
    },
  }
}
export function StockVelocityQuadrant({ points = [], medianQty, medianStock, coveragePct = 0, height = 440, onSelect }) {
  const degenerate = coveragePct === 0
  const datasets = QUAD_ORDER.map(q => ({
    label: q,
    data: points.filter(p => p.quadrant === q).map(p => ({
      x: p.x, y: p.y, r: Math.max(5, Math.min(28, (Number(p.revenue) || 0) / 5e5 + 5)),
      _sku: p.sku, _name: p.name, _rev: p.revenue, _turn: p.stockTurnover,
    })),
    backgroundColor: withAlpha(stockQuadColor(q), 0.55), borderColor: stockQuadColor(q), borderWidth: 1,
    hoverBackgroundColor: withAlpha(stockQuadColor(q), 0.85),
  })).filter(ds => ds.data.length)
  const options = mergeOptions(baseOptions, {
    onClick: (_e, els) => { if (onSelect && els?.length) { const pt = datasets[els[0].datasetIndex]?.data[els[0].index]; if (pt?._sku) onSelect(pt._sku) } },
    scales: {
      x: { title: { display: true, text: 'Units sold (velocity)', font: { size: 10 } }, ticks: { font: { size: 9 } }, beginAtZero: true },
      y: { title: { display: true, text: degenerate ? 'Stock level (untracked — all 0)' : 'Stock level', font: { size: 10 }, color: degenerate ? DUMMY_COLOR : undefined },
        ticks: { font: { size: 9 } }, beginAtZero: true, suggestedMax: degenerate ? 5 : undefined },
    },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 }, usePointStyle: true } },
      tooltip: { callbacks: {
        title: items => items[0]?.raw?._name?.slice(0, 40) || items[0]?.raw?._sku || '',
        label: c => { const r = c.raw; return [`${r._sku}`, `units sold ${formatNumber(r.x)} · stock ${formatNumber(r.y)}`, `turnover ${r._turn ?? '— (no stock)'} · rev ${formatCurrency(r._rev)}`, `→ ${c.dataset.label}`] },
      } },
    },
  })
  return <div style={{ height }}><Bubble data={{ datasets }} options={options} plugins={[quadDivider(medianQty, medianStock, degenerate)]} /></div>
}

// ── TREND (REAL): cancellation rate over time. ──
export function CancellationTrend({ points = [], height = 280 }) {
  const data = {
    labels: points.map(p => p.month),
    datasets: [{ label: 'Cancellation rate', data: points.map(p => p.rate),
      borderColor: SEMANTIC.danger, backgroundColor: withAlpha(SEMANTIC.danger, 0.12), pointRadius: 4, tension: 0.25, fill: true, borderWidth: 1.5 }],
  }
  const options = mergeOptions(baseOptions, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const p = points[c.dataIndex]; return [`${c.parsed.y}% cancelled`, `${formatNumber(p.cancelled)} of ${formatNumber(p.total)} orders`] } } } },
    scales: { x: { ticks: { font: { size: 9 } } }, y: { beginAtZero: true, ticks: { callback: v => v + '%', font: { size: 9 } } } },
  })
  return <div style={{ height }}><Line data={data} options={options} /></div>
}

// ── HISTOGRAM (DUMMY): fulfilment-time distribution. Orange (the fabricated slice). ──
export function FulfillmentHistogram({ bins = [], height = 280 }) {
  const data = {
    labels: bins.map(b => b.label),
    datasets: [{ label: 'Orders (dummy)', data: bins.map(b => b.count),
      backgroundColor: withAlpha(DUMMY_COLOR, 0.7), borderColor: DUMMY_COLOR, borderWidth: 1 }],
  }
  const options = mergeOptions(baseOptions, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { title: c => `${c[0].label} days`, label: c => `${formatNumber(c.parsed.y)} orders (dummy)` } } },
    scales: { x: { title: { display: true, text: 'Total fulfilment days (DUMMY)', font: { size: 9 }, color: DUMMY_COLOR }, ticks: { font: { size: 9 } } },
      y: { beginAtZero: true, ticks: { font: { size: 9 } } } },
  })
  return <div style={{ height }}><Bar data={data} options={options} /></div>
}
