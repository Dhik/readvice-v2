'use client'
// Product stock detail — REAL (stock/turnover/classification + sales history).
import Modal from '@/components/ui/Modal'
import { Line } from 'react-chartjs-2'
import { baseOptions, mergeOptions, withAlpha, seriesColor } from '@/lib/charts/theme'
import { stockQuadColor } from './OperationalCharts'
import { formatCurrency, formatNumber } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }

export function StockBadge({ quadrant, small = false }) {
  const c = stockQuadColor(quadrant)
  return <span className={`inline-flex items-center rounded font-semibold ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}
    style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}>{quadrant}</span>
}

export default function StockDetailModal({ detail, onClose }) {
  if (!detail) return null
  const hist = detail.history ?? []
  const trendData = hist.length ? {
    labels: hist.map(h => h.date),
    datasets: [{ label: 'Units sold', data: hist.map(h => h.qty), borderColor: seriesColor(0), backgroundColor: withAlpha(seriesColor(0), 0.12), pointRadius: 3, tension: 0.2, fill: true }],
  } : null
  const trendOpts = mergeOptions(baseOptions, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const h = hist[c.dataIndex]; return [`${formatNumber(c.parsed.y)} units`, `rev ${formatCurrency(h.revenue)}`] } } } },
    scales: { x: { ticks: { font: { size: 9 } } }, y: { beginAtZero: true, ticks: { font: { size: 9 } } } },
  })

  return (
    <Modal isOpen onClose={onClose} size="max-w-2xl"
      title={<span className="flex items-center gap-2"><span className="truncate max-w-md">{detail.name}</span> <StockBadge quadrant={detail.quadrant} /></span>}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[['SKU', detail.sku], ['Units sold', formatNumber(detail.qtySold)], ['Stock', formatNumber(detail.stock)], ['Turnover', detail.stockTurnover != null ? `${detail.stockTurnover}×` : '—']].map(([k, v]) => (
            <div key={k} className="bg-bg rounded p-2"><div className="text-dark1/45 text-[10px]">{k}</div><div className="font-semibold text-dark1 truncate" title={String(v)}>{v}</div></div>
          ))}
        </div>

        {detail.stockNote && (
          <div className="text-[11px] text-orange/90 bg-orange/10 border border-orange/30 rounded px-2 py-1.5">
            <i className="fas fa-circle-info" /> {detail.stockNote}
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-dark1 mb-1.5">Units sold by date {hist.length < 3 && hist.length > 0 ? <span className="text-[10px] font-normal text-orange/80">(only {hist.length} day(s) — shallow)</span> : null}</div>
          {trendData ? <div style={{ height: 170 }}><Line data={trendData} options={trendOpts} /></div>
            : <div className="text-[11px] text-dark1/45 italic h-16 flex items-center justify-center">No sales history.</div>}
        </div>

        <p className="text-[10px] text-dark1/40 border-t border-cream pt-2">
          Stock, units sold &amp; turnover are <b>real</b> (turnover = units ÷ stock, shown where stock&gt;0). Action classification is real.
        </p>
      </div>
    </Modal>
  )
}
