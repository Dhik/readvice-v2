'use client'
// SKU×SKU affinity matrix heatmap (chartjs-chart-matrix, statically registered/SSR-safe).
// Cell color intensity = LIFT (complementary to the network, which uses co-occurrence for
// edge thickness). n=1 cells are rendered FAINTER (weak signal) — mirrors the network's
// dashed n=1 edges. Symmetric (both a→b and b→a plotted). Only co-occurring pairs colored.
import { Chart } from 'react-chartjs-2'
import { baseOptions, mergeOptions, withAlpha } from '@/lib/charts/theme'

const LIFT_CAP = 20   // cap the orange ramp so a single huge (n=1) lift doesn't blow out the scale

export default function AffinityMatrix({ nodes = [], pairs = [], height = 400 }) {
  const labels = nodes.map(n => n.sku)
  const idx = new Map(labels.map((s, i) => [s, i]))
  // Symmetric cells from pairs (both directions); diagonal left empty.
  const cells = []
  for (const p of pairs) {
    if (!idx.has(p.a) || !idx.has(p.b)) continue
    const intensity = Math.min(1, p.lift / LIFT_CAP) * (p.cooccur === 1 ? 0.45 : 1)  // n=1 fainter
    const base = { v: p.lift, _co: p.cooccur, _sup: p.supportPct, _cAB: p.confidenceAtoB, _cBA: p.confidenceBtoA, _a: p.a, _b: p.b, _i: intensity }
    cells.push({ x: p.a, y: p.b, ...base })
    cells.push({ x: p.b, y: p.a, ...base })
  }
  const data = {
    datasets: [{
      label: 'Affinity (lift)', data: cells,
      backgroundColor: ctx => withAlpha('#E07B39', 0.12 + (ctx.raw?._i ?? 0) * 0.8),
      borderColor: 'rgba(44,54,57,0.06)', borderWidth: 0.5,
      width: ({ chart }) => { const a = chart.chartArea; return a ? Math.max(6, a.width / (labels.length || 1) - 2) : 14 },
      height: ({ chart }) => { const a = chart.chartArea; return a ? Math.max(6, a.height / (labels.length || 1) - 2) : 14 },
    }],
  }
  const options = mergeOptions(baseOptions, {
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: {
        title: items => { const r = items[0]?.raw; return r ? `${r._a} + ${r._b}` : '' },
        label: r => { const c = r.raw; return [`lift ${c.v}×  ·  co-occur ${c._co}${c._co === 1 ? ' (n=1 — weak)' : ''}`, `support ${c._sup}% · conf ${c._cAB}% / ${c._cBA}%`] },
      } },
    },
    scales: {
      x: { type: 'category', labels, position: 'top', ticks: { font: { size: 7 }, maxRotation: 90, minRotation: 90, autoSkip: false }, grid: { display: false } },
      y: { type: 'category', labels, offset: true, ticks: { font: { size: 7 }, autoSkip: false }, grid: { display: false } },
    },
  })
  if (!cells.length) return <div style={{ height }} className="flex items-center justify-center text-dark1/30 text-xs">No co-purchase pairs.</div>
  return <div style={{ height }}><Chart type="matrix" data={data} options={options} /></div>
}
