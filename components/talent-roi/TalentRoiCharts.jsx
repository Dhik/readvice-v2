'use client'
// Talent ROI charts — MAIN cost×return quadrant + 3 companions (leaderboard,
// cost-vs-return DUMBBELL, type RADAR). The real/dummy split is encoded in COLOR:
// cost = REAL (slate), return = DUMMY (orange). All via the shared theme (SSR-safe;
// radar = native registerables; dumbbell = Scatter + a plain afterDatasetsDraw plugin).
import { Bubble, Bar, Scatter, Radar } from 'react-chartjs-2'
import { baseOptions, mergeOptions, withAlpha, seriesColor, SEMANTIC } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

// Real vs dummy colors (the split, made visual).
export const REAL_COLOR = '#3F4E4F'   // dark slate — REAL cost
export const DUMMY_COLOR = '#E07B39'  // brand orange — DUMMY return

export const ROI_QUAD_COLORS = { 'Star': '#22c55e', 'Premium': '#6B8E9E', 'Overpriced': '#dc3545', 'Low Impact': '#C9A66B' }
export const roiQuadColor = q => ROI_QUAD_COLORS[q] ?? '#8B8B8B'
const QUAD_ORDER = ['Star', 'Premium', 'Overpriced', 'Low Impact']
const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }
const radiusFor = v => Math.max(5, Math.min(30, (Number(v) || 0) / 60000 + 5))

// Median dividers + corner labels (afterDraw — chartArea/scales only, SSR-safe).
function dividerPlugin(xMed, yMed, corners) {
  return {
    id: 'roiDividers',
    afterDraw(chart) {
      const { ctx, chartArea: a, scales } = chart
      if (!a || !scales?.x || !scales?.y) return
      ctx.save(); ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(44,54,57,0.3)'
      if (Number.isFinite(xMed)) { const px = scales.x.getPixelForValue(xMed); if (px >= a.left && px <= a.right) { ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke() } }
      if (Number.isFinite(yMed)) { const py = scales.y.getPixelForValue(yMed); if (py >= a.top && py <= a.bottom) { ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke() } }
      ctx.setLineDash([])
      if (corners) {
        ctx.font = '600 10px Inter, sans-serif'; const pad = 6
        const put = (t, x, y, ax, ay) => { ctx.textAlign = ax; ctx.textBaseline = ay; ctx.fillStyle = withAlpha(roiQuadColor(t), 0.85); ctx.fillText(t.toUpperCase(), x, y) }
        put(corners.tl, a.left + pad, a.top + pad, 'left', 'top')
        put(corners.tr, a.right - pad, a.top + pad, 'right', 'top')
        put(corners.bl, a.left + pad, a.bottom - pad, 'left', 'bottom')
        put(corners.br, a.right - pad, a.bottom - pad, 'right', 'bottom')
      }
      ctx.restore()
    },
  }
}

// MAIN: cost (x, REAL) × return (y, DUMMY), bubble = views, colored by quadrant.
export function TalentRoiQuadrant({ points = [], medianCost, medianReturn, height = 440, onSelect }) {
  const datasets = QUAD_ORDER.map(q => ({
    label: q,
    data: points.filter(p => p.quadrant === q).map(p => ({
      x: p.x, y: p.y, r: radiusFor(p.views), _id: p.talentId, _name: p.name, _type: p.type, _roi: p.roi, _views: p.views,
    })),
    backgroundColor: withAlpha(roiQuadColor(q), 0.55), borderColor: roiQuadColor(q), borderWidth: 1,
    hoverBackgroundColor: withAlpha(roiQuadColor(q), 0.85),
  }))
  const options = mergeOptions(baseOptions, {
    onClick: (_e, els) => { if (onSelect && els?.length) { const ds = datasets[els[0].datasetIndex]; const pt = ds?.data[els[0].index]; if (pt?._id) onSelect(pt._id) } },
    scales: {
      x: { title: { display: true, text: 'Talent cost (REAL — rate card)', font: { size: 10 } }, ticks: { callback: v => shortRp(v), font: { size: 9 } }, beginAtZero: true },
      y: { title: { display: true, text: '⚠ Attributed return (DUMMY — fabricated)', font: { size: 10 }, color: DUMMY_COLOR }, ticks: { callback: v => shortRp(v), font: { size: 9 } }, beginAtZero: true },
    },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 }, usePointStyle: true } },
      tooltip: { callbacks: {
        title: items => items[0]?.raw?._name || '',
        label: c => { const r = c.raw; return [
          `${r._type}`, `Cost (real): ${formatCurrency(r.x)}`, `Return (DUMMY): ${formatCurrency(r.y)}`,
          `ROI: ${r._roi ?? '—'}× (dummy) · views ${formatNumber(r._views)} (dummy)`, `Quadrant: ${c.dataset.label}`,
        ] },
      } },
    },
  })
  const corners = { tl: 'Star', tr: 'Premium', bl: 'Low Impact', br: 'Overpriced' }
  return <div style={{ height }}><Bubble data={{ datasets }} options={options} plugins={[dividerPlugin(medianCost, medianReturn, corners)]} /></div>
}

// COMPANION 1: ranked leaderboard — talents by ROI (DUMMY).
export function RoiLeaderboard({ items = [], height = 360, onSelect }) {
  const top = items.filter(i => i.roi != null).slice(0, 15)
  const data = {
    labels: top.map(i => i.name),
    datasets: [{ label: 'ROI (dummy)', data: top.map(i => i.roi),
      backgroundColor: top.map(i => withAlpha(i.roi >= 1 ? SEMANTIC.success : SEMANTIC.danger, 0.7)),
      borderColor: top.map(i => i.roi >= 1 ? SEMANTIC.success : SEMANTIC.danger), borderWidth: 1 }],
  }
  const options = mergeOptions(baseOptions, {
    indexAxis: 'y',
    onClick: (_e, els) => { if (onSelect && els?.length) { const it = top[els[0].index]; if (it) onSelect(it.talentId) } },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const i = top[c.dataIndex]; return [`ROI ${c.parsed.x}× (DUMMY)`, `cost ${formatCurrency(i.cost)} (real) · return ${formatCurrency(i.attributedRevenue)} (dummy)`] } } } },
    scales: { x: { beginAtZero: true, ticks: { callback: v => v + '×', font: { size: 9 } }, title: { display: true, text: 'ROI × (DUMMY)', font: { size: 9 }, color: DUMMY_COLOR } }, y: { ticks: { font: { size: 8 } } } },
  })
  return <div style={{ height }}><Bar data={data} options={options} /></div>
}

// COMPANION 2: cost-vs-return DUMBBELL — per talent, a COST point (slate = REAL) and a
// RETURN point (orange = DUMMY) on one rupiah axis, connected by a line. Sorted by ROI
// desc (winners on top) so the ordering itself tells the story. The two colors ARE the
// real/dummy split. Connecting line drawn via a plain afterDatasetsDraw plugin (ctx only,
// SSR-safe). ALL 24 talents kept (taller panel); category y-axis with small labels.
function dumbbellLinePlugin() {
  return {
    id: 'dumbbellLines',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx
      const costMeta = chart.getDatasetMeta(0), retMeta = chart.getDatasetMeta(1)
      if (!costMeta?.data || !retMeta?.data) return
      ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(44,54,57,0.30)'
      for (let i = 0; i < costMeta.data.length; i++) {
        const a = costMeta.data[i], b = retMeta.data[i]
        if (!a || !b || a.skip || b.skip) continue
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
      ctx.restore()
    },
  }
}
export function CostReturnDumbbell({ items = [], height = 520, onSelect }) {
  // Sort by ROI desc (winners on top); nulls last. Keep ALL talents.
  const rows = [...items].sort((a, b) => (b.roi ?? -1) - (a.roi ?? -1))
  const names = rows.map(i => i.name)
  const mk = (key) => rows.map(i => ({ x: i[key], y: i.name, _id: i.talentId, _name: i.name, _cost: i.cost, _ret: i.attributedRevenue, _roi: i.roi }))
  const data = {
    datasets: [
      { label: 'Cost (REAL)', data: mk('cost'), backgroundColor: REAL_COLOR, borderColor: REAL_COLOR, pointRadius: 5, pointHoverRadius: 7 },
      { label: 'Return (DUMMY)', data: mk('attributedRevenue'), backgroundColor: DUMMY_COLOR, borderColor: DUMMY_COLOR, pointRadius: 5, pointHoverRadius: 7 },
    ],
  }
  const options = mergeOptions(baseOptions, {
    onClick: (_e, els) => { if (onSelect && els?.length) { const pt = data.datasets[els[0].datasetIndex]?.data[els[0].index]; if (pt?._id) onSelect(pt._id) } },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 }, usePointStyle: true } },
      tooltip: { callbacks: {
        title: items => items[0]?.raw?._name || '',
        label: c => { const r = c.raw; return [
          `${c.dataset.label}: ${formatCurrency(c.dataset.label[0] === 'C' ? r._cost : r._ret)}`,
          `cost ${formatCurrency(r._cost)} (real) · return ${formatCurrency(r._ret)} (dummy)`,
          `ROI ${r._roi ?? '—'}× (dummy)`,
        ] },
      } },
    },
    scales: {
      x: { beginAtZero: true, ticks: { callback: v => shortRp(v), font: { size: 9 } }, title: { display: true, text: 'Rupiah — ● cost (REAL)  ● return (DUMMY)', font: { size: 9 } } },
      y: { type: 'category', labels: names, ticks: { font: { size: 7 }, autoSkip: false } },
    },
  })
  return <div style={{ height }}><Scatter data={data} options={options} plugins={[dumbbellLinePlugin()]} /></div>
}

// COMPANION 3: type performance RADAR — one line per talent type, 4 axes
// (cost/return/ROI/views). Axes are NORMALIZED 0–100 independently (per-axis max across
// types) so wildly different scales (rupiah vs ratio vs count) don't distort the shape;
// the TOOLTIP shows the REAL underlying value + REAL/DUMMY label per axis. Only `cost`
// is real; return/ROI/views are dummy.
const RADAR_AXES = [
  { key: 'cost',              label: 'Cost (REAL)',   fmt: v => formatCurrency(v) },
  { key: 'attributedRevenue', label: 'Return (DUMMY)', fmt: v => formatCurrency(v) },
  { key: 'roi',              label: 'ROI (DUMMY)',   fmt: v => (v != null ? `${v}×` : '—') },
  { key: 'views',            label: 'Views (DUMMY)', fmt: v => formatNumber(v) },
]
export function TypeRadar({ groups = [], height = 300 }) {
  const types = groups
  // Per-axis max across types (for independent normalization). Guard /0.
  const maxes = RADAR_AXES.map(ax => Math.max(1, ...types.map(t => Number(t[ax.key]) || 0)))
  const norm = (t, ai) => Math.round(((Number(t[RADAR_AXES[ai].key]) || 0) / maxes[ai]) * 100)
  const datasets = types.map((t, idx) => ({
    label: t.type,
    data: RADAR_AXES.map((_, ai) => norm(t, ai)),
    borderColor: seriesColor(idx), backgroundColor: withAlpha(seriesColor(idx), 0.12),
    pointBackgroundColor: seriesColor(idx), pointRadius: 3, borderWidth: 1.5,
  }))
  const options = mergeOptions(baseOptions, {
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 }, usePointStyle: true } },
      tooltip: { callbacks: {
        // Show the REAL underlying value (+ REAL/DUMMY label), not the normalized %.
        label: c => { const t = types[c.datasetIndex], ax = RADAR_AXES[c.dataIndex]; return `${t.type} · ${ax.label}: ${ax.fmt(t[ax.key])}` },
        afterLabel: c => `(normalized ${c.parsed.r}/100 for shape)`,
      } },
    },
    scales: {
      r: { min: 0, max: 100, ticks: { display: false, stepSize: 25 },
        pointLabels: { font: { size: 9 }, callback: (lbl, i) => RADAR_AXES[i].label },
        grid: { color: 'rgba(44,54,57,0.08)' }, angleLines: { color: 'rgba(44,54,57,0.08)' } },
    },
  })
  return <div style={{ height }}><Radar data={{ labels: RADAR_AXES.map(a => a.label), datasets }} options={options} /></div>
}
