'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { quadColor } from './BcgBubbleChart'
import { formatCurrency, formatNumber } from '@/lib/utils'

const pct = v => `${Number(v ?? 0).toFixed(2)}%`
const mult = v => `${Number(v ?? 0).toFixed(2)}×`

// UI action copy keyed by quadrant (presentation only — quadrant assignment itself
// comes from the engine). Covers both lenses' quadrant names.
const ACTION_PLANS = {
  Star:            ['Increase ad budget — momentum is real', 'Guard stock levels', 'Defend search ranking & reviews'],
  'Cash Cow':      ['Drive more traffic (ads/SEO) — conversion is proven', 'Protect margin', 'Test small price increases'],
  'Question Mark': ['Fix the listing: photos, title, price, reviews', 'A/B test the offer', 'Reduce friction in checkout'],
  Potensi:         ['Align listing to the ad promise', 'Tighten targeting', 'Improve PDP to convert the clicks'],
  Dog:             ['Reposition, bundle, or discontinue', 'Cut ad spend', 'Liquidate slow stock'],
}

// ── Quadrant badge ────────────────────────────────────────────────────────────
export function QuadrantBadge({ quadrant, small = false }) {
  const c = quadColor(quadrant)
  return (
    <span className={`inline-flex items-center gap-1 rounded font-semibold ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}
      style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}>
      {quadrant}
    </span>
  )
}

// Small "dummy" tag for fabricated/derived metrics.
const Dummy = () => (
  <span className="ml-1 text-[8px] uppercase tracking-wide px-1 rounded bg-orange/15 text-orange align-middle"
    title="Derived from DUMMY data (visitor/ctr) — not real">dummy</span>
)

function Bar({ value, max = 100, color = '#E07B39' }) {
  const w = Math.max(0, Math.min(100, (Number(value) / max) * 100))
  return (
    <div className="h-1.5 bg-dark1/10 rounded overflow-hidden">
      <div className="h-full rounded" style={{ width: `${w}%`, background: color }} />
    </div>
  )
}

// ── Product detail modal ──────────────────────────────────────────────────────
export function ProductDetailModal({ detail, lens = 'traffic', onClose }) {
  if (!detail) return null
  const q = lens === 'ctr' ? detail.ctrQuadrant : detail.quadrant
  const color = quadColor(q)
  const funnel = [
    { label: 'Visitors',  value: detail.visitor, dummy: true },
    { label: 'Add-to-Cart', value: detail.atc, dummy: true },
    { label: 'Purchases', value: detail.buyers, dummy: false },
  ]
  const funnelMax = Math.max(1, detail.visitor)
  const metrics = [
    { label: 'Conversion', value: pct(detail.conversion), sub: `benchmark ${pct(detail.benchmark)}`, dummy: true },
    { label: 'ATC Rate', value: pct(detail.atcRate), dummy: true },
    { label: 'Purchase Rate', value: pct(detail.purchaseRate), dummy: true },
    { label: 'ROAS', value: mult(detail.roas), dummy: true },
    { label: 'Rev / Visitor', value: formatCurrency(detail.revenuePerVisitor), dummy: true },
    { label: 'Stock Turnover', value: mult(detail.stockTurnover), dummy: false },
  ]

  return (
    <Modal isOpen onClose={onClose} size="max-w-3xl"
      title={<span className="flex items-center gap-2">{detail.namaProduk} <QuadrantBadge quadrant={q} /></span>}>
      <div className="space-y-4 text-sm">
        {/* Basic info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[['SKU', detail.sku], ['Code', detail.kodeProduk], ['Price', formatCurrency(detail.harga)], ['Stock', formatNumber(detail.stock)]].map(([k, v]) => (
            <div key={k} className="bg-bg rounded p-2"><div className="text-dark1/45 text-[10px]">{k}</div><div className="font-semibold text-dark1 truncate">{v}</div></div>
          ))}
        </div>

        {/* Performance score */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-dark1/60">Performance Score <Dummy /></span>
            <span className="font-bold" style={{ color }}>{detail.score} / 100</span>
          </div>
          <Bar value={detail.score} color={color} />
        </div>

        {/* 6 metric mini-cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {metrics.map(m => (
            <div key={m.label} className="border border-cream rounded p-2">
              <div className="text-[10px] text-dark1/50">{m.label}{m.dummy && <Dummy />}</div>
              <div className="text-sm font-bold text-dark1">{m.value}</div>
              {m.sub && <div className="text-[9px] text-dark1/40">{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* Sales funnel */}
        <div>
          <div className="text-xs font-semibold text-dark1 mb-1.5">Sales Funnel <Dummy /></div>
          <div className="space-y-1.5">
            {funnel.map(f => (
              <div key={f.label}>
                <div className="flex justify-between text-[11px] text-dark1/70"><span>{f.label}</span><span className="font-semibold">{formatNumber(f.value)}</span></div>
                <Bar value={f.value} max={funnelMax} color={color} />
              </div>
            ))}
          </div>
        </div>

        {/* Action plan */}
        <div>
          <div className="text-xs font-semibold text-dark1 mb-1">Action Plan — {q}</div>
          <ul className="list-disc list-inside text-xs text-dark1/75 space-y-0.5">
            {(ACTION_PLANS[q] ?? ACTION_PLANS.Dog).map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>

        <p className="text-[10px] text-dark1/40 border-t border-cream pt-2">
          Revenue, qty, price & stock are real. Conversion/ROAS/funnel derive from DUMMY visitor & CTR — the quadrant is illustrative, not a real position.
        </p>
      </div>
    </Modal>
  )
}

// ── Recommendations modal ─────────────────────────────────────────────────────
export function RecommendationsModal({ rec, lens = 'traffic', onClose }) {
  const items = rec?.items ?? []
  // Group by quadrant; each group shares headline/action (from the engine).
  const groups = {}
  for (const it of items) (groups[it.quadrant] ??= { headline: it.headline, action: it.action, skus: [] }).skus.push(it)
  const order = lens === 'ctr' ? ['Star', 'Potensi', 'Cash Cow', 'Dog'] : ['Star', 'Cash Cow', 'Question Mark', 'Dog']
  const present = order.filter(q => groups[q])

  return (
    <Modal isOpen onClose={onClose} size="max-w-3xl" title="Strategy & Recommendations">
      <div className="space-y-3 text-sm">
        <p className="text-[10px] text-dark1/45">
          Positions derive from DUMMY visitor/CTR — treat these as a template of the analysis, not real guidance yet.
        </p>
        {present.length === 0 && <div className="text-dark1/40 text-center py-8">No products to analyze.</div>}
        {present.map(q => {
          const g = groups[q]
          const priority = [...g.skus].sort((a, b) => b.sales - a.sales).slice(0, 5)
          return (
            <div key={q} className="border border-cream rounded-lg overflow-hidden">
              <div className="px-3 py-2 flex items-center justify-between" style={{ background: `${quadColor(q)}14` }}>
                <span className="flex items-center gap-2"><QuadrantBadge quadrant={q} /><span className="font-semibold text-dark1 text-xs">{g.headline}</span></span>
                <span className="text-[10px] text-dark1/50">{g.skus.length} product{g.skus.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="px-3 py-2">
                <div className="text-xs text-dark1/75 mb-2">{g.action}</div>
                <div className="text-[10px] text-dark1/45 mb-1">Priority SKUs (by revenue):</div>
                <div className="flex flex-wrap gap-1">
                  {priority.map(p => (
                    <span key={p.sku} className="text-[10px] bg-bg rounded px-1.5 py-0.5 text-dark1/80" title={`${formatCurrency(p.sales)} · score ${p.score}`}>
                      {p.name?.slice(0, 24) || p.sku}
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
const SORT_FIELDS = [
  ['sales', 'Revenue'], ['conversion', 'Conversion'], ['roas', 'ROAS'],
  ['visitor', 'Traffic'], ['score', 'Performance'], ['qty', 'Qty Sold'],
]
export function AdvancedFilterModal({ initial = {}, quadrantOptions = [], onApply, onClose }) {
  const [f, setF] = useState({
    quadrant: initial.quadrant ?? '', minSales: initial.minSales ?? '', minConversion: initial.minConversion ?? '',
    maxRoas: initial.maxRoas ?? '', sortBy: initial.sortBy ?? 'sales', sortDir: initial.sortDir ?? 'desc',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const input = 'border border-cream rounded text-xs px-2 py-1 h-8 bg-white text-dark1 focus:outline-none focus:border-dark2 w-full'

  const apply = () => onApply({
    quadrant: f.quadrant || undefined,
    minSales: f.minSales === '' ? undefined : Number(f.minSales),
    minConversion: f.minConversion === '' ? undefined : Number(f.minConversion),
    maxRoas: f.maxRoas === '' ? undefined : Number(f.maxRoas),
    sortBy: f.sortBy, sortDir: f.sortDir,
  })
  const reset = () => { setF({ quadrant: '', minSales: '', minConversion: '', maxRoas: '', sortBy: 'sales', sortDir: 'desc' }); onApply({}) }

  return (
    <Modal isOpen onClose={onClose} title="Advanced Filter"
      footer={<div className="flex gap-2 justify-end w-full">
        <button onClick={reset} className="sv-tbtn sv-tbtn-ghost">Reset</button>
        <button onClick={apply} className="sv-tbtn sv-tbtn-dark">Apply</button>
      </div>}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="col-span-2">Quadrant
          <select className={input} value={f.quadrant} onChange={e => set('quadrant', e.target.value)}>
            <option value="">All quadrants</option>
            {quadrantOptions.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </label>
        <label>Min Revenue (Rp)
          <input type="number" className={input} value={f.minSales} onChange={e => set('minSales', e.target.value)} placeholder="0" />
        </label>
        <label>Min Conversion (%)
          <input type="number" step="0.1" className={input} value={f.minConversion} onChange={e => set('minConversion', e.target.value)} placeholder="0" />
        </label>
        <label>Max ROAS (×)
          <input type="number" step="0.1" className={input} value={f.maxRoas} onChange={e => set('maxRoas', e.target.value)} placeholder="∞" />
        </label>
        <label>Sort by
          <select className={input} value={f.sortBy} onChange={e => set('sortBy', e.target.value)}>
            {SORT_FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="col-span-2">Direction
          <select className={input} value={f.sortDir} onChange={e => set('sortDir', e.target.value)}>
            <option value="desc">High → Low</option>
            <option value="asc">Low → High</option>
          </select>
        </label>
      </div>
    </Modal>
  )
}
