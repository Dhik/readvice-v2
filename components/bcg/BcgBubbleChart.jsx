'use client'
// BCG bubble matrix (Traffic×Conversion or CTR×Conversion). Pure presentation —
// all quadrant assignment / benchmarks come from the engine via `points`.
//
// Chart.js bubble through the shared theme (registered centrally, SSR-safe). The
// reference-line + quadrant-label overlay is a PER-CHART inline plugin (afterDraw):
// it only touches chart.ctx / chartArea / scales at draw time (no window/document),
// and the whole component is client-only, so it's SSR-safe.
import { Bubble } from 'react-chartjs-2'
import { SEMANTIC, baseOptions, mergeOptions, withAlpha } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

// Quadrant → color (shared by chart datasets, cards, badges).
export const QUADRANT_COLORS = {
  Star:             SEMANTIC.success, // green
  'Cash Cow':       '#6B8E9E',        // slate-blue
  'Question Mark':  SEMANTIC.warning, // amber
  Potensi:          SEMANTIC.warning, // amber (CTR lens)
  Dog:              SEMANTIC.danger,  // red
}
export const quadColor = q => QUADRANT_COLORS[q] ?? '#8B8B8B'

// r = clamp(sales / 1e7, 5, 50) — big sellers are bigger bubbles.
const radiusFor = sales => Math.max(5, Math.min(50, (Number(sales) || 0) / 1e7))

// Inline plugin: vertical divider (x), horizontal divider (y), + corner labels.
function dividerPlugin(xDivider, yDivider, quadrantLabels) {
  return {
    id: 'bcgDividers',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart
      if (!chartArea || !scales?.x || !scales?.y) return
      const { left, right, top, bottom } = chartArea
      ctx.save()
      ctx.setLineDash([5, 4])
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(44,54,57,0.35)'
      // vertical (x divider)
      if (Number.isFinite(xDivider)) {
        const px = scales.x.getPixelForValue(xDivider)
        if (px >= left && px <= right) { ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke() }
      }
      // horizontal (y divider)
      if (Number.isFinite(yDivider)) {
        const py = scales.y.getPixelForValue(yDivider)
        if (py >= top && py <= bottom) { ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke() }
      }
      ctx.setLineDash([])
      // corner quadrant labels (TL, TR, BL, BR)
      if (quadrantLabels) {
        ctx.font = '600 10px Inter, sans-serif'
        const pad = 6
        const put = (text, x, y, align, baseline) => {
          ctx.textAlign = align; ctx.textBaseline = baseline
          ctx.fillStyle = withAlpha(quadColor(text), 0.85)
          ctx.fillText(text.toUpperCase(), x, y)
        }
        put(quadrantLabels.tl, left + pad,  top + pad,    'left',  'top')
        put(quadrantLabels.tr, right - pad, top + pad,    'right', 'top')
        put(quadrantLabels.bl, left + pad,  bottom - pad, 'left',  'bottom')
        put(quadrantLabels.br, right - pad, bottom - pad, 'right', 'bottom')
      }
      ctx.restore()
    },
  }
}

export default function BcgBubbleChart({
  points = [], xLabel, yLabel, xDivider, yDivider, xLog = false,
  quadrantOrder = ['Star', 'Cash Cow', 'Question Mark', 'Dog'], quadrantLabels, height = 440,
}) {
  // One dataset per quadrant (legend toggles a whole quadrant).
  const datasets = quadrantOrder.map(q => ({
    label: q,
    data: points.filter(p => p.quadrant === q).map(p => ({
      x: p.x, y: p.y, r: radiusFor(p.sales),
      _sku: p.sku, _name: p.name, _sales: p.sales, _benchmark: p.benchmark, _score: p.score,
    })),
    backgroundColor: withAlpha(quadColor(q), 0.55),
    borderColor: quadColor(q),
    borderWidth: 1,
    hoverBackgroundColor: withAlpha(quadColor(q), 0.8),
  }))

  const options = mergeOptions(baseOptions, {
    scales: {
      x: {
        type: xLog ? 'logarithmic' : 'linear',
        title: { display: true, text: xLabel, font: { size: 10 } },
        ticks: { font: { size: 9 } },
      },
      y: {
        title: { display: true, text: yLabel, font: { size: 10 } },
        ticks: { font: { size: 9 }, callback: v => `${v}%` },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 10 }, usePointStyle: true } },
      tooltip: {
        callbacks: {
          title: items => items[0]?.raw?._name || items[0]?.raw?._sku || '',
          label: ctx => {
            const r = ctx.raw
            return [
              `SKU: ${r._sku}`,
              `${xLabel}: ${formatNumber(r.x)}`,
              `Conversion: ${r.y}%  (benchmark ${r._benchmark ?? '—'}%)`,
              `Revenue: ${formatCurrency(r._sales)}`,
              `Quadrant: ${ctx.dataset.label}  ·  score ${r._score ?? '—'}`,
            ]
          },
        },
      },
    },
  })

  const plugins = [dividerPlugin(xDivider, yDivider, quadrantLabels)]

  return (
    <div style={{ height }}>
      <Bubble data={{ datasets }} options={options} plugins={plugins} />
    </div>
  )
}
