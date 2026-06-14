'use client'
// Product gross-margin detail — revenue/HPP/profit/margin + per-date history.
// GROSS only; flags uncovered SKUs (0 HPP → inflated 100% margin).
import Modal from '@/components/ui/Modal'
import { Line } from 'react-chartjs-2'
import { baseOptions, mergeOptions, withAlpha, seriesColor, SEMANTIC } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }

export default function DetailModal({ detail, onClose }) {
  if (!detail) return null
  const hist = detail.history ?? []
  const trendData = hist.length ? {
    labels: hist.map(h => h.date),
    datasets: [
      { label: 'Revenue', data: hist.map(h => h.revenue), borderColor: seriesColor(7), backgroundColor: withAlpha(seriesColor(7), 0.1), pointRadius: 3, tension: 0.2, fill: true },
      { label: 'COGS', data: hist.map(h => h.hpp), borderColor: SEMANTIC.danger, pointRadius: 3, tension: 0.2, fill: false },
      { label: 'Gross profit', data: hist.map(h => h.grossProfit), borderColor: SEMANTIC.success, pointRadius: 3, tension: 0.2, fill: false },
    ],
  } : null
  const trendOpts = mergeOptions(baseOptions, {
    plugins: { legend: { labels: { boxWidth: 8, font: { size: 9 } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } } },
    scales: { x: { ticks: { font: { size: 9 } } }, y: { beginAtZero: true, ticks: { callback: v => shortRp(v), font: { size: 8 } } } },
  })
  const marginColor = detail.marginPct >= 50 ? '#16a34a' : detail.marginPct >= 20 ? '#f59e0b' : '#dc3545'

  return (
    <Modal isOpen onClose={onClose} size="max-w-2xl"
      title={<span className="flex items-center gap-2">{detail.name}
        {!detail.hasCost && <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange/15 text-orange">no cost</span>}</span>}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[['SKU', detail.sku], ['Units', formatNumber(detail.qty)], ['Revenue', formatCurrency(detail.revenue)], ['COGS (HPP)', formatCurrency(detail.hpp)]].map(([k, v]) => (
            <div key={k} className="bg-bg rounded p-2"><div className="text-dark1/45 text-[10px]">{k}</div><div className="font-semibold text-dark1 truncate" title={String(v)}>{v}</div></div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="border border-cream rounded p-2"><div className="text-[10px] text-dark1/50">Gross profit</div><div className="text-base font-bold text-dark1">{formatCurrency(detail.grossProfit)}</div></div>
          <div className="border border-cream rounded p-2"><div className="text-[10px] text-dark1/50">Gross margin %</div><div className="text-base font-bold" style={{ color: marginColor }}>{detail.marginPct}%</div></div>
        </div>

        {detail.hasCostNote && (
          <div className="text-[11px] text-orange/90 bg-orange/10 border border-orange/30 rounded px-2 py-1.5">
            <i className="fas fa-triangle-exclamation" /> {detail.hasCostNote}
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-dark1 mb-1.5">Revenue · COGS · Gross profit by date</div>
          {trendData ? <div style={{ height: 180 }}><Line data={trendData} options={trendOpts} /></div>
            : <div className="text-[11px] text-dark1/45 italic h-16 flex items-center justify-center">No daily history.</div>}
          {trendData && hist.length < 3 && <div className="text-[10px] text-orange/90 mt-1"><i className="fas fa-triangle-exclamation" /> Only {hist.length} day(s) of history — shallow.</div>}
        </div>

        <p className="text-[10px] text-dark1/40 border-t border-cream pt-2">
          <b>Gross</b> margin only (revenue − COGS). Operating costs, fees, taxes and marketing are <b>not</b> deducted — this is not net profit.
        </p>
      </div>
    </Modal>
  )
}
