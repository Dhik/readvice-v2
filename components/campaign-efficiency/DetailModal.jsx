'use client'
// Content-detail modal — metrics + creator/channel/tier + thin ContentStatistic
// series WITH the honest statisticsNote (no fake trend). GMV labeled "reported".
import Modal from '@/components/ui/Modal'
import { Line } from 'react-chartjs-2'
import { baseOptions, mergeOptions, withAlpha } from '@/lib/charts/theme'
import { quadColor } from './EfficiencyCharts'
import { formatCurrency, formatNumber } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }

export function QuadBadge({ quadrant, small = false }) {
  const c = quadColor(quadrant)
  return <span className={`inline-flex items-center rounded font-semibold ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}
    style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}>{quadrant}</span>
}

export default function DetailModal({ detail, color = '#6B8E9E', onClose }) {
  if (!detail) return null
  const series = detail.statistics ?? []
  const trendData = series.length ? {
    labels: series.map(s => s.date),
    datasets: [
      { label: 'Views', data: series.map(s => s.views), borderColor: color, backgroundColor: withAlpha(color, 0.12), pointRadius: 3, tension: 0.2, fill: true, yAxisID: 'y' },
      { label: 'Reported GMV', data: series.map(s => s.reportedGmv), borderColor: '#E07B39', pointRadius: 3, tension: 0.2, fill: false, yAxisID: 'y1' },
    ],
  } : null
  const trendOpts = mergeOptions(baseOptions, {
    plugins: { legend: { labels: { boxWidth: 8, font: { size: 9 } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.dataset.yAxisID === 'y1' ? formatCurrency(c.parsed.y) : formatNumber(c.parsed.y)}` } } },
    scales: { x: { ticks: { font: { size: 9 } } }, y: { position: 'left', ticks: { callback: v => shortRp(v), font: { size: 8 } } }, y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => shortRp(v), font: { size: 8 } } } },
  })

  const metrics = [
    ['Cost (rate card)', formatCurrency(detail.cost)],
    ['Reported GMV', formatCurrency(detail.reportedGmv)],
    ['GMV / cost', detail.gmvPerCost != null ? `${detail.gmvPerCost}×` : '—'],
    ['CPM', detail.cpm != null ? formatCurrency(detail.cpm) : '—'],
    ['Engagement', detail.engagementRate != null ? `${detail.engagementRate}%` : '—'],
    ['Views', formatNumber(detail.views)],
  ]

  return (
    <Modal isOpen onClose={onClose} size="max-w-2xl"
      title={<span className="flex items-center gap-2">{detail.creatorName} <QuadBadge quadrant={detail.quadrant ?? '—'} /></span>}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[['Channel', detail.channel], ['Tier', detail.tiering], ['Campaign', detail.campaignTitle], ['Username', detail.username]].map(([k, v]) => (
            <div key={k} className="bg-bg rounded p-2"><div className="text-dark1/45 text-[10px]">{k}</div><div className="font-semibold text-dark1 truncate" title={v}>{v}</div></div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {metrics.map(([k, v]) => (
            <div key={k} className="border border-cream rounded p-2"><div className="text-[10px] text-dark1/50">{k}</div><div className="text-sm font-bold text-dark1">{v}</div></div>
          ))}
        </div>

        <div className="flex gap-1.5 text-[10px]">
          {detail.isFyp && <span className="px-1.5 py-0.5 rounded bg-green-600/15 text-green-700 font-semibold">FYP</span>}
          {detail.isDelivered && <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 font-semibold">Delivered</span>}
          {detail.isPaid && <span className="px-1.5 py-0.5 rounded bg-dark1/10 text-dark1 font-semibold">Paid</span>}
        </div>

        <div>
          <div className="text-xs font-semibold text-dark1 mb-1.5">Daily Statistics</div>
          {trendData ? <div style={{ height: 170 }}><Line data={trendData} options={trendOpts} /></div>
            : <div className="text-[11px] text-dark1/45 italic h-16 flex items-center justify-center">{detail.statisticsNote || 'No daily statistics.'}</div>}
          {trendData && detail.statisticsNote && <div className="text-[10px] text-orange/90 mt-1"><i className="fas fa-triangle-exclamation" /> {detail.statisticsNote}</div>}
        </div>

        <p className="text-[10px] text-dark1/40 border-t border-cream pt-2">
          GMV is <b>self-reported</b> on the content record — <b>not</b> attributed to real Orders. This is reported-GMV efficiency, not true sales ROI.
        </p>
      </div>
    </Modal>
  )
}
