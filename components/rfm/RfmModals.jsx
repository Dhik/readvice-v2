'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { segColor, SEGMENT_ORDER } from './RfmScatterChart'
import { formatCurrency, formatNumber } from '@/lib/utils'

// ── Segment badge + dummy tag ─────────────────────────────────────────────────
export function SegmentBadge({ segment, small = false }) {
  const c = segColor(segment)
  return (
    <span className={`inline-flex items-center gap-1 rounded font-semibold ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}
      style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}>
      {segment}
    </span>
  )
}
export function DummyTag() {
  return (
    <span className="text-[8px] uppercase tracking-wide px-1 rounded bg-orange/15 text-orange align-middle"
      title="Fabricated padding customer — not a real customer">dummy</span>
  )
}

function ScoreBar({ label, score, color }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-dark1/55"><span>{label}</span><span className="font-semibold">{score}/5</span></div>
      <div className="h-1.5 bg-dark1/10 rounded overflow-hidden">
        <div className="h-full rounded" style={{ width: `${(score / 5) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

// ── Customer detail modal ─────────────────────────────────────────────────────
export function CustomerDetailModal({ detail, onClose }) {
  if (!detail) return null
  const c = segColor(detail.segment)
  return (
    <Modal isOpen onClose={onClose} size="max-w-3xl"
      title={<span className="flex items-center gap-2">{detail.name} <SegmentBadge segment={detail.segment} />{detail.dummy && <DummyTag />}</span>}>
      <div className="space-y-4 text-sm">
        {/* R/F/M raw values */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[['Recency', `${formatNumber(detail.recencyDays)} days`], ['Frequency', `${formatNumber(detail.frequency)} orders`], ['Monetary', formatCurrency(detail.monetary)]].map(([k, v]) => (
            <div key={k} className="bg-bg rounded p-2"><div className="text-dark1/45 text-[10px]">{k}</div><div className="font-semibold text-dark1 truncate">{v}</div></div>
          ))}
        </div>

        {/* R/F/M score bars */}
        <div className="grid grid-cols-3 gap-3">
          <ScoreBar label="R score" score={detail.r} color={c} />
          <ScoreBar label="F score" score={detail.f} color={c} />
          <ScoreBar label="M score" score={detail.m} color={c} />
        </div>

        {/* Action */}
        <div className="rounded-lg px-3 py-2" style={{ background: `${c}14` }}>
          <div className="text-[10px] text-dark1/50 mb-0.5">Recommended action — {detail.segment}</div>
          <div className="text-xs text-dark1/80">{detail.action}</div>
        </div>

        {/* Order history (real customers only) */}
        <div>
          <div className="text-xs font-semibold text-dark1 mb-1.5">Order History {detail.orderHistoryAvailable ? `(${detail.orders.length})` : ''}</div>
          {!detail.orderHistoryAvailable ? (
            <div className="text-[11px] text-dark1/45 italic">Dummy customer — no real order history.</div>
          ) : detail.orders.length === 0 ? (
            <div className="text-[11px] text-dark1/45">No orders in window.</div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead><tr className="text-dark1/45 text-left border-b border-cream"><th className="py-1">Date</th><th>Order</th><th>Platform</th><th className="text-right">GMV</th><th>Status</th></tr></thead>
                <tbody>
                  {detail.orders.map((o, i) => (
                    <tr key={i} className="border-b border-cream/40">
                      <td className="py-1">{o.date}</td>
                      <td className="font-mono text-[10px]">{o.orderId ?? '—'}</td>
                      <td>{o.platform}</td>
                      <td className="text-right">{formatCurrency(o.gmv)}</td>
                      <td className="text-dark1/60">{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[10px] text-dark1/40 border-t border-cream pt-2">
          {detail.dummy
            ? 'This is a fabricated padding customer (no real orders) — present only so its segment is visible in dev.'
            : 'Recency / Frequency / Monetary are REAL — derived from this customer’s real orders.'}
        </p>
      </div>
    </Modal>
  )
}

// ── Recommendations modal ─────────────────────────────────────────────────────
// NB: from getRecommendations, each segment's `priority` is the CUSTOMERS array
// (it overwrites SEGMENT_META.priority); `action` is the strategy text.
export function RecommendationsModal({ rec, onClose }) {
  const segs = rec?.segments ?? []
  const order = SEGMENT_ORDER
  const present = order.filter(o => segs.some(s => s.segment === o))
  const byName = Object.fromEntries(segs.map(s => [s.segment, s]))

  return (
    <Modal isOpen onClose={onClose} size="max-w-3xl" title="Segment Strategy & Recommendations">
      <div className="space-y-3 text-sm">
        <p className="text-[10px] text-dark1/45">
          High-value segments are dummy-padded in dev (priority customers tagged ✻). Real customers currently reach only New / Potential Loyalist.
        </p>
        {present.length === 0 && <div className="text-dark1/40 text-center py-8">No customers to analyze.</div>}
        {present.map(name => {
          const s = byName[name]
          const customers = s.priority ?? []
          return (
            <div key={name} className="border border-cream rounded-lg overflow-hidden">
              <div className="px-3 py-2 flex items-center justify-between" style={{ background: `${segColor(name)}14` }}>
                <SegmentBadge segment={name} />
                <span className="text-[10px] text-dark1/50">{s.count} customer{s.count !== 1 ? 's' : ''} · {formatCurrency(s.revenue)}</span>
              </div>
              <div className="px-3 py-2">
                <div className="text-xs text-dark1/75 mb-2">{s.action}</div>
                <div className="text-[10px] text-dark1/45 mb-1">Priority customers (by monetary):</div>
                <div className="flex flex-wrap gap-1">
                  {customers.map(p => (
                    <span key={p.customerKey} className="text-[10px] bg-bg rounded px-1.5 py-0.5 text-dark1/80" title={`${formatCurrency(p.monetary)} · ${p.frequency} orders`}>
                      {(p.name || p.customerKey)?.slice(0, 22)}{p.dummy ? ' ✻' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ── Advanced filter modal ─────────────────────────────────────────────────────
export function AdvancedFilterModal({ initial = {}, segmentOptions = SEGMENT_ORDER, onApply, onClose }) {
  const [f, setF] = useState({
    segment: initial.segment ?? '', minMonetary: initial.minMonetary ?? '', minFrequency: initial.minFrequency ?? '',
    minRecency: initial.minRecency ?? '', maxRecency: initial.maxRecency ?? '', realOnly: initial.realOnly ?? false,
    sortBy: initial.sortBy ?? 'monetary', sortDir: initial.sortDir ?? 'desc',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const input = 'border border-cream rounded text-xs px-2 py-1 h-8 bg-white text-dark1 focus:outline-none focus:border-dark2 w-full'
  const numOrU = v => (v === '' ? undefined : Number(v))

  const apply = () => onApply({
    segment: f.segment || undefined,
    minMonetary: numOrU(f.minMonetary), minFrequency: numOrU(f.minFrequency),
    minRecency: numOrU(f.minRecency), maxRecency: numOrU(f.maxRecency),
    realOnly: f.realOnly || undefined, sortBy: f.sortBy, sortDir: f.sortDir,
  })
  const reset = () => { setF({ segment: '', minMonetary: '', minFrequency: '', minRecency: '', maxRecency: '', realOnly: false, sortBy: 'monetary', sortDir: 'desc' }); onApply({}) }

  return (
    <Modal isOpen onClose={onClose} title="Advanced Filter"
      footer={<div className="flex gap-2 justify-end w-full">
        <button onClick={reset} className="sv-tbtn sv-tbtn-ghost">Reset</button>
        <button onClick={apply} className="sv-tbtn sv-tbtn-dark">Apply</button>
      </div>}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="col-span-2">Segment
          <select className={input} value={f.segment} onChange={e => set('segment', e.target.value)}>
            <option value="">All segments</option>
            {segmentOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Min Monetary (Rp)
          <input type="number" className={input} value={f.minMonetary} onChange={e => set('minMonetary', e.target.value)} placeholder="0" />
        </label>
        <label>Min Frequency
          <input type="number" className={input} value={f.minFrequency} onChange={e => set('minFrequency', e.target.value)} placeholder="0" />
        </label>
        <label>Recency from (days)
          <input type="number" className={input} value={f.minRecency} onChange={e => set('minRecency', e.target.value)} placeholder="0" />
        </label>
        <label>Recency to (days)
          <input type="number" className={input} value={f.maxRecency} onChange={e => set('maxRecency', e.target.value)} placeholder="∞" />
        </label>
        <label>Sort by
          <select className={input} value={f.sortBy} onChange={e => set('sortBy', e.target.value)}>
            {[['monetary', 'Monetary'], ['frequency', 'Frequency'], ['recencyDays', 'Recency'], ['r', 'R score'], ['f', 'F score'], ['m', 'M score']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Direction
          <select className={input} value={f.sortDir} onChange={e => set('sortDir', e.target.value)}>
            <option value="desc">High → Low</option>
            <option value="asc">Low → High</option>
          </select>
        </label>
        <label className="col-span-2 flex items-center gap-2 mt-1">
          <input type="checkbox" checked={f.realOnly} onChange={e => set('realOnly', e.target.checked)} />
          <span>Real customers only (hide dummy padding)</span>
        </label>
      </div>
    </Modal>
  )
}
