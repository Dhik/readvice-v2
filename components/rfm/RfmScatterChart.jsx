'use client'
// RFM segment scatter (Recency × Frequency, bubble size = Monetary, colored by
// segment). The RFM-appropriate equivalent of BCG's matrix — NOT a clone. Pure
// presentation: segment assignment comes from the engine via `points`.
//
// Client-safe segment palette mirrors the engine's SEGMENT_META colors (importing
// rfm-summary client-side would pull Prisma into the bundle — same reason BCG keeps
// quadColor in its chart component).
import { Bubble } from 'react-chartjs-2'
import { baseOptions, mergeOptions, withAlpha } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

export const SEGMENT_ORDER = [
  'Champions', 'Loyal Customers', 'Potential Loyalist', 'New Customers', 'Promising',
  'Need Attention', 'About to Sleep', 'At Risk', "Can't Lose Them", 'Hibernating', 'Lost',
]
export const SEGMENT_COLORS = {
  'Champions': '#22c55e', 'Loyal Customers': '#4ade80', 'Potential Loyalist': '#A9C5A0',
  'New Customers': '#6B8E9E', 'Promising': '#C9A66B', 'Need Attention': '#E07B39',
  'About to Sleep': '#f59e0b', 'At Risk': '#B5645B', "Can't Lose Them": '#dc3545',
  'Hibernating': '#8B5E3C', 'Lost': '#2C3639',
}
export const segColor = s => SEGMENT_COLORS[s] ?? '#8B8B8B'

// r = clamp(monetary / 4e5, 4, 30) — bigger spenders = bigger bubbles.
const radiusFor = m => Math.max(4, Math.min(30, (Number(m) || 0) / 4e5))

// Reference lines: recent (recency ≤ 30d) vertical + repeat (frequency ≥ 2) horizontal.
function refLinePlugin(xRef, yRef) {
  return {
    id: 'rfmRefLines',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart
      if (!chartArea || !scales?.x || !scales?.y) return
      ctx.save()
      ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(44,54,57,0.3)'
      ctx.font = '600 9px Inter, sans-serif'; ctx.fillStyle = 'rgba(44,54,57,0.5)'
      if (Number.isFinite(xRef)) {
        const px = scales.x.getPixelForValue(xRef)
        if (px >= chartArea.left && px <= chartArea.right) {
          ctx.beginPath(); ctx.moveTo(px, chartArea.top); ctx.lineTo(px, chartArea.bottom); ctx.stroke()
          ctx.textAlign = 'left'; ctx.fillText(`≤${xRef}d = recent`, px + 3, chartArea.top + 10)
        }
      }
      if (Number.isFinite(yRef)) {
        const py = scales.y.getPixelForValue(yRef)
        if (py >= chartArea.top && py <= chartArea.bottom) {
          ctx.beginPath(); ctx.moveTo(chartArea.left, py); ctx.lineTo(chartArea.right, py); ctx.stroke()
          ctx.textAlign = 'right'; ctx.fillText(`≥${yRef} orders = repeat`, chartArea.right - 3, py - 3)
        }
      }
      ctx.restore()
    },
  }
}

export default function RfmScatterChart({ points = [], order = SEGMENT_ORDER, height = 440, xRef = 30, yRef = 2 }) {
  // One dataset per segment (legend toggles a whole segment).
  const present = order.filter(s => points.some(p => p.segment === s))
  const datasets = present.map(seg => ({
    label: seg,
    data: points.filter(p => p.segment === seg).map(p => ({
      x: p.recencyDays, y: p.frequency, r: radiusFor(p.monetary),
      _key: p.customerKey, _name: p.name, _m: p.monetary, _r: p.r, _f: p.f, _ms: p.m, _dummy: p.dummy,
    })),
    backgroundColor: withAlpha(segColor(seg), 0.55),
    borderColor: segColor(seg),
    borderWidth: 1,
    hoverBackgroundColor: withAlpha(segColor(seg), 0.85),
  }))

  const options = mergeOptions(baseOptions, {
    scales: {
      x: { title: { display: true, text: 'Recency (days since last order — lower = better)', font: { size: 10 } },
        ticks: { font: { size: 9 } }, beginAtZero: true },
      y: { title: { display: true, text: 'Frequency (orders)', font: { size: 10 } },
        ticks: { font: { size: 9 }, precision: 0 }, beginAtZero: true },
    },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 }, usePointStyle: true } },
      tooltip: {
        callbacks: {
          title: items => items[0]?.raw?._name || items[0]?.raw?._key || '',
          label: ctx => {
            const r = ctx.raw
            return [
              `${r._key}${r._dummy ? '  (dummy)' : ''}`,
              `Recency ${formatNumber(r.x)}d · Frequency ${formatNumber(r.y)} · Monetary ${formatCurrency(r._m)}`,
              `R${r._r} F${r._f} M${r._ms}  ·  ${ctx.dataset.label}`,
            ]
          },
        },
      },
    },
  })

  return (
    <div style={{ height }}>
      <Bubble data={{ datasets }} options={options} plugins={[refLinePlugin(xRef, yRef)]} />
    </div>
  )
}
