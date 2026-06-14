'use client'
// Channel / category detail modal — spend, share, daily trend, subcategory split.
// All real (expense-only) — no ROAS. Mirrors BCG/RFM modal quality.
import Modal from '@/components/ui/Modal'
import { Line } from 'react-chartjs-2'
import { seriesColor, withAlpha, baseOptions, mergeOptions } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return String(Math.round(n)) }

export default function DetailModal({ detail, dim, color = seriesColor(0), onClose }) {
  if (!detail) return null
  const name = detail.channel ?? detail.category
  const trend = detail.trend ?? []
  const trendData = trend.length ? {
    labels: trend.map(t => t.period),
    datasets: [{ label: 'Spend', data: trend.map(t => t.spend), borderColor: color, backgroundColor: withAlpha(color, 0.12), pointRadius: 2, tension: 0.25, fill: true, borderWidth: 1.5 }],
  } : null
  const trendOpts = mergeOptions(baseOptions, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => formatCurrency(c.parsed.y) } } },
    scales: { x: { ticks: { font: { size: 8 }, maxTicksLimit: 10 } }, y: { beginAtZero: true, ticks: { callback: v => shortRp(v), font: { size: 9 } } } },
  })

  return (
    <Modal isOpen onClose={onClose} size="max-w-2xl"
      title={<span className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
        {name} <span className="text-[10px] font-normal text-dark1/45">{dim === 'category' ? 'marketing category' : 'social channel'}</span>
      </span>}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-bg rounded p-2"><div className="text-dark1/45 text-[10px]">Spend</div><div className="font-bold text-dark1">{formatCurrency(detail.spend)}</div></div>
          <div className="bg-bg rounded p-2"><div className="text-dark1/45 text-[10px]">Share of {dim === 'category' ? 'marketing' : 'social'}</div><div className="font-bold text-dark1">{detail.sharePct}%</div></div>
          <div className="bg-bg rounded p-2"><div className="text-dark1/45 text-[10px]">Rows / days</div><div className="font-bold text-dark1">{formatNumber(detail.rows)} / {formatNumber(detail.days)}</div></div>
        </div>

        <div>
          <div className="text-xs font-semibold text-dark1 mb-1.5">Daily Spend {detail.range ? <span className="text-[10px] font-normal text-dark1/45">({detail.range.min} → {detail.range.max})</span> : ''}</div>
          {trendData ? <div style={{ height: 180 }}><Line data={trendData} options={trendOpts} /></div>
            : <div className="text-[11px] text-dark1/45 italic h-20 flex items-center justify-center">No daily data in range.</div>}
        </div>

        {dim === 'category' && (
          <div>
            <div className="text-xs font-semibold text-dark1 mb-1.5">Subcategory split</div>
            {detail.subCategories?.length ? (
              <div className="space-y-1">
                {detail.subCategories.map((s, i) => {
                  const pct = detail.spend > 0 ? Math.round((s.spend / detail.spend) * 1000) / 10 : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[11px] text-dark1/70"><span>{s.key}</span><span className="font-semibold">{formatCurrency(s.spend)} · {pct}%</span></div>
                      <div className="h-1.5 bg-dark1/10 rounded overflow-hidden"><div className="h-full rounded" style={{ width: `${pct}%`, background: color }} /></div>
                    </div>
                  )
                })}
              </div>
            ) : <div className="text-[11px] text-dark1/45 italic">No subcategory breakdown.</div>}
          </div>
        )}

        <p className="text-[10px] text-dark1/40 border-t border-cream pt-2">
          Expense only — all figures real. No ROAS/return (ad spend isn’t yet linked to sales revenue).
        </p>
      </div>
    </Modal>
  )
}
