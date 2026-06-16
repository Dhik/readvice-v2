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

// Objective category colors (Part C — points are color-coded by objective; the
// real/dummy honesty stays in the axis labels/tooltips/tiles, not the point hue).
export const OBJECTIVE_COLORS = { Awareness: '#6B8E9E', Consideration: '#C9A66B', Conversion: '#E07B39' }
export const objectiveColor = o => OBJECTIVE_COLORS[o] ?? '#8B8B8B'
const OBJ_ORDER = ['Awareness', 'Consideration', 'Conversion']
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

// MAIN (objective-aware, Part C): cost (x, REAL) × efficiency (y), bubble = views,
// points COLOR-CODED BY OBJECTIVE. 'All' → normalizedEfficiency (0–100, each talent on
// its OWN objective — cross-objective comparable); a specific objective → that objective's
// raw metric. The y-axis title + tooltip metric are DRIVEN BY objectiveView (engine-
// provided — never hardcoded here, so page & engine can't drift). Honesty: x=cost REAL,
// y=efficiency DUMMY-derived (orange axis). Lone-in-group talents (unrankableIds) flagged.
export function TalentRoiQuadrant({ points = [], filter = 'All', objectiveView, height = 440, onSelect, unrankableIds }) {
  const isAll = filter === 'All'
  const unrank = unrankableIds ?? new Set()
  const yOf = p => (isAll ? p.normalizedEfficiency : p.objectiveMetric)
  const present = isAll ? OBJ_ORDER : [filter]
  const mkData = obj => points.filter(p => p.objective === obj && yOf(p) != null).map(p => ({
    x: p.x, y: yOf(p), r: radiusFor(p.views),
    _id: p.talentId, _name: p.name, _type: p.type, _obj: p.objective, _inferred: p.objectiveInferred,
    _metric: p.objectiveMetric, _metricLabel: p.objectiveMetricLabel, _metricUnit: p.objectiveMetricUnit,
    _outcome: p.objectiveOutcome, _outcomeLabel: p.objectiveOutcomeLabel, _norm: p.normalizedEfficiency,
    _views: p.views, _unrank: unrank.has(p.talentId),
  }))
  const datasets = present.map(obj => ({
    label: obj,
    data: mkData(obj),
    backgroundColor: withAlpha(objectiveColor(obj), 0.5), borderColor: objectiveColor(obj), borderWidth: 1,
    hoverBackgroundColor: withAlpha(objectiveColor(obj), 0.85),
  }))
  // Median guides: cost (x) + efficiency midpoint (50 for the 0–100 'All' axis, else median metric).
  const xs = points.map(p => p.x).filter(v => v > 0).sort((a, b) => a - b)
  const medCost = xs.length ? xs[Math.floor(xs.length / 2)] : NaN
  const ys = present.flatMap(o => mkData(o).map(d => d.y)).sort((a, b) => a - b)
  const yMed = isAll ? 50 : (ys.length ? ys[Math.floor(ys.length / 2)] : NaN)
  const yTitle = objectiveView?.yLabel || (isAll ? 'Objective efficiency (0–100, per-objective normalized)' : 'Objective efficiency')
  const options = mergeOptions(baseOptions, {
    onClick: (_e, els) => { if (onSelect && els?.length) { const ds = datasets[els[0].datasetIndex]; const pt = ds?.data[els[0].index]; if (pt?._id) onSelect(pt._id) } },
    scales: {
      x: { title: { display: true, text: 'Talent cost (REAL — rate card)', font: { size: 10 } }, ticks: { callback: v => shortRp(v), font: { size: 9 } }, beginAtZero: true },
      y: { title: { display: true, text: '⚠ ' + yTitle + ' (DUMMY-derived)', font: { size: 10 }, color: DUMMY_COLOR }, ticks: { font: { size: 9 } }, beginAtZero: true, ...(isAll ? { suggestedMax: 100 } : {}) },
    },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 }, usePointStyle: true } },
      tooltip: { callbacks: {
        title: items => items[0]?.raw?._name || '',
        label: c => { const r = c.raw; const lines = [
          `${r._type} · ${r._obj}${r._inferred ? ' (inferred)' : ''}`,
          `Cost (real): ${formatCurrency(r.x)}`,
          `${r._outcomeLabel || 'Outcome'}: ${formatNumber(r._outcome)} (dummy)`,
          `${r._metricLabel || 'Efficiency'}: ${r._metric ?? '—'}${r._metricUnit ? ' ' + r._metricUnit : ''} (dummy)`,
          `Normalized: ${r._norm ?? '—'}/100 (dummy)`,
        ]; if (r._unrank) lines.push('⚠ only talent in its objective — neutral 50, not truly ranked'); return lines },
      } },
    },
  })
  return <div style={{ height }}><Bubble data={{ datasets }} options={options} plugins={[dividerPlugin(medCost, yMed, null)]} /></div>
}

// COMPANION 1 (objective-aware leaderboard): talents ranked by EFFICIENCY — normalized
// 0–100 ('All', cross-objective comparable) or the objective's raw metric (specific).
// Bars color-coded by objective; metric label from objectiveView; honesty in the axis
// (DUMMY) + tooltip. Lone-in-group talents marked ⚠.
export function RoiLeaderboard({ points = [], filter = 'All', objectiveView, height = 360, onSelect, unrankableIds }) {
  const isAll = filter === 'All'
  const unrank = unrankableIds ?? new Set()
  const valOf = p => (isAll ? p.normalizedEfficiency : p.objectiveMetric)
  const top = points.filter(p => valOf(p) != null).sort((a, b) => valOf(b) - valOf(a)).slice(0, 15)
  const metricLabel = objectiveView?.metricLabel || (isAll ? 'Normalized efficiency' : 'Objective metric')
  const data = {
    labels: top.map(i => i.name + (unrank.has(i.talentId) ? ' ⚠' : '')),
    datasets: [{ label: metricLabel + ' (dummy)', data: top.map(valOf),
      backgroundColor: top.map(i => withAlpha(objectiveColor(i.objective), 0.75)),
      borderColor: top.map(i => objectiveColor(i.objective)), borderWidth: 1 }],
  }
  const options = mergeOptions(baseOptions, {
    indexAxis: 'y',
    onClick: (_e, els) => { if (onSelect && els?.length) { const it = top[els[0].index]; if (it) onSelect(it.talentId) } },
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      title: items => top[items[0].dataIndex]?.name || '',
      label: c => { const i = top[c.dataIndex]; const lines = [
        `${i.type} · ${i.objective}${i.objectiveInferred ? ' (inferred)' : ''}`,
        `${metricLabel}: ${valOf(i)}${isAll ? '/100' : (i.objectiveMetricUnit ? ' ' + i.objectiveMetricUnit : '')} (dummy)`,
        `cost ${formatCurrency(i.x)} (real)`,
      ]; if (unrank.has(i.talentId)) lines.push('⚠ only talent in its objective — neutral 50'); return lines } } } },
    scales: { x: { beginAtZero: true, ...(isAll ? { suggestedMax: 100 } : {}), ticks: { font: { size: 9 } },
      title: { display: true, text: metricLabel + ' (DUMMY)', font: { size: 9 }, color: DUMMY_COLOR } },
      y: { ticks: { font: { size: 8 } } } },
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
export function CostReturnDumbbell({ items = [], height = 520, onSelect, unrankableIds }) {
  // Sort by ROI desc (winners on top); nulls last. Keep ALL talents.
  const unrank = unrankableIds ?? new Set()
  const rows = [...items].sort((a, b) => (b.roi ?? -1) - (a.roi ?? -1))
  const names = rows.map(i => i.name + (unrank.has(i.talentId) ? ' ⚠' : ''))
  const mk = (key) => rows.map(i => ({ x: i[key], y: i.name + (unrank.has(i.talentId) ? ' ⚠' : ''), _id: i.talentId, _name: i.name, _cost: i.cost, _ret: i.attributedRevenue, _roi: i.roi, _obj: i.objective, _inferred: i.objectiveInferred, _norm: i.normalizedEfficiency, _unrank: unrank.has(i.talentId) }))
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
        label: c => { const r = c.raw; const lines = [
          `${r._obj ?? '—'}${r._inferred ? ' (inferred)' : ''}`,
          `cost ${formatCurrency(r._cost)} (real) · return ${formatCurrency(r._ret)} (dummy)`,
          `ROI ${r._roi ?? '—'}× · efficiency ${r._norm ?? '—'}/100 (dummy)`,
        ]; if (r._unrank) lines.push('⚠ only talent in its objective — neutral 50'); return lines },
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
