'use client'
// Fit-for-efficiency charts: cost × REPORTED-GMV quadrant (bubble) + group bars.
// All via the shared theme (registered, SSR-safe). Pure presentation — engine owns
// the numbers. GMV axis is always labeled "Reported" (self-reported, not attributed).
import { Bubble, Bar } from 'react-chartjs-2'
import { baseOptions, mergeOptions, withAlpha, seriesColor, SEMANTIC } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

// Quadrant → color (mirrors engine CONTENT_QUADRANTS — client-safe copy).
export const QUAD_COLORS = { 'Efficient': '#22c55e', 'Premium': '#6B8E9E', 'Overpriced': '#dc3545', 'Low Impact': '#C9A66B' }
export const quadColor = q => QUAD_COLORS[q] ?? '#8B8B8B'
const QUAD_ORDER = ['Efficient', 'Premium', 'Overpriced', 'Low Impact']
const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }
const radiusFor = views => Math.max(4, Math.min(30, (Number(views) || 0) / 120000 + 4))

// Median divider lines + corner labels (afterDraw — chartArea/scales only, SSR-safe).
function dividerPlugin(xMed, yMed, corners) {
  return {
    id: 'effDividers',
    afterDraw(chart) {
      const { ctx, chartArea: a, scales } = chart
      if (!a || !scales?.x || !scales?.y) return
      ctx.save()
      ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(44,54,57,0.3)'
      if (Number.isFinite(xMed)) { const px = scales.x.getPixelForValue(xMed); if (px >= a.left && px <= a.right) { ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke() } }
      if (Number.isFinite(yMed)) { const py = scales.y.getPixelForValue(yMed); if (py >= a.top && py <= a.bottom) { ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke() } }
      ctx.setLineDash([])
      if (corners) {
        ctx.font = '600 10px Inter, sans-serif'; const pad = 6
        const put = (t, x, y, ax, ay) => { ctx.textAlign = ax; ctx.textBaseline = ay; ctx.fillStyle = withAlpha(quadColor(t), 0.85); ctx.fillText(t.toUpperCase(), x, y) }
        put(corners.tl, a.left + pad, a.top + pad, 'left', 'top')
        put(corners.tr, a.right - pad, a.top + pad, 'right', 'top')
        put(corners.bl, a.left + pad, a.bottom - pad, 'left', 'bottom')
        put(corners.br, a.right - pad, a.bottom - pad, 'right', 'bottom')
      }
      ctx.restore()
    },
  }
}

export function EfficiencyQuadrantChart({ points = [], medianCost, medianReportedGmv, height = 440, onSelect }) {
  const datasets = QUAD_ORDER.map(q => ({
    label: q,
    data: points.filter(p => p.quadrant === q).map(p => ({
      x: p.x, y: p.y, r: radiusFor(p.views),
      _id: p.id, _name: p.name, _gpc: p.gmvPerCost, _ch: p.channel, _tier: p.tiering, _views: p.views,
    })),
    backgroundColor: withAlpha(quadColor(q), 0.55), borderColor: quadColor(q), borderWidth: 1,
    hoverBackgroundColor: withAlpha(quadColor(q), 0.85),
  }))
  const options = mergeOptions(baseOptions, {
    onClick: (_e, els) => { if (onSelect && els?.length) { const ds = datasets[els[0].datasetIndex]; const pt = ds?.data[els[0].index]; if (pt?._id) onSelect(pt._id) } },
    scales: {
      x: { title: { display: true, text: 'Cost (rate card)', font: { size: 10 } }, ticks: { callback: v => shortRp(v), font: { size: 9 } }, beginAtZero: true },
      y: { title: { display: true, text: 'Reported GMV (self-reported, not attributed)', font: { size: 10 } }, ticks: { callback: v => shortRp(v), font: { size: 9 } }, beginAtZero: true },
    },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 }, usePointStyle: true } },
      tooltip: { callbacks: {
        title: items => items[0]?.raw?._name || '',
        label: c => { const r = c.raw; return [
          `${r._ch} · ${r._tier}`,
          `Cost: ${formatCurrency(r.x)}`,
          `Reported GMV: ${formatCurrency(r.y)}`,
          `GMV/cost: ${r._gpc ?? '—'}×  ·  views ${formatNumber(r._views)}`,
          `Quadrant: ${c.dataset.label}`,
        ] },
      } },
    },
  })
  const corners = { tl: 'Efficient', tr: 'Premium', bl: 'Low Impact', br: 'Overpriced' }
  return <div style={{ height }}><Bubble data={{ datasets }} options={options}
    plugins={[dividerPlugin(medianCost, medianReportedGmv, corners)]} /></div>
}

// Horizontal bars of a metric per group (channel/tier). Highlights the best (max).
// Groups with a null metric are NOT plotted (shown as no-data by the page).
export function GroupBars({ groups = [], metric = 'gmvPerCost', label = 'GMV / cost', suffix = '×', height = 240, onSelect }) {
  const valid = groups.filter(g => g[metric] != null)
  const best = valid.reduce((m, g) => (g[metric] > (m?.[metric] ?? -Infinity) ? g : m), null)
  const data = {
    labels: valid.map(g => g.label),
    datasets: [{
      label, data: valid.map(g => g[metric]),
      backgroundColor: valid.map(g => g === best ? withAlpha(SEMANTIC.success, 0.8) : withAlpha(seriesColor(0), 0.55)),
      borderColor: valid.map(g => g === best ? SEMANTIC.success : seriesColor(0)), borderWidth: 1,
    }],
  }
  const options = mergeOptions(baseOptions, {
    indexAxis: 'y',
    onClick: (_e, els) => { if (onSelect && els?.length) { const g = valid[els[0].index]; if (g) onSelect(g.key) } },
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      label: c => { const g = valid[c.dataIndex]; return [
        `${label}: ${c.parsed.x}${suffix}`,
        `Cost ${formatCurrency(g.cost)} · Reported GMV ${formatCurrency(g.reportedGmv)}`,
        `CPM ${g.avgCpm ?? '—'} · Eng ${g.engagementRate ?? '—'}% · ${g.count} pieces`,
      ] },
    } } },
    scales: {
      x: { beginAtZero: true, ticks: { font: { size: 9 }, callback: v => v + suffix } },
      y: { ticks: { font: { size: 9 } } },
    },
  })
  return <div style={{ height }}><Bar data={data} options={options} /></div>
}
