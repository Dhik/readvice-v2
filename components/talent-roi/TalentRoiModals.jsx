'use client'
import Modal from '@/components/ui/Modal'
import { roiQuadColor, REAL_COLOR, DUMMY_COLOR } from './TalentRoiCharts'
import { formatCurrency, formatNumber } from '@/lib/utils'

export function QuadBadge({ quadrant, small = false }) {
  const c = roiQuadColor(quadrant)
  return <span className={`inline-flex items-center rounded font-semibold ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}
    style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}>{quadrant}</span>
}
export function RealTag() { return <span className="text-[8px] uppercase tracking-wide px-1 rounded font-semibold" style={{ background: `${REAL_COLOR}1a`, color: REAL_COLOR }}>real</span> }
export function DummyTag() { return <span className="text-[8px] uppercase tracking-wide px-1 rounded font-semibold" style={{ background: `${DUMMY_COLOR}22`, color: DUMMY_COLOR }} title="Fabricated — no talent→revenue link">dummy</span> }

// ── Detail modal: REAL block (slate) clearly separated from DUMMY block (orange) ──
export function TalentDetailModal({ detail, onClose }) {
  if (!detail) return null
  const r = detail.real, dr = detail.dummyReturn
  const k = r.kolProfile
  return (
    <Modal isOpen onClose={onClose} size="max-w-3xl"
      title={<span className="flex items-center gap-2">{detail.name} <span className="text-[10px] font-normal text-dark1/45">{detail.type}</span></span>}>
      <div className="space-y-4 text-sm">
        {/* REAL block */}
        <div className="rounded-lg border-2 p-3" style={{ borderColor: `${REAL_COLOR}55`, background: `${REAL_COLOR}08` }}>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold" style={{ color: REAL_COLOR }}><i className="fas fa-circle-check" /> REAL — cost &amp; activity <RealTag /></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[['Cost (rate card)', formatCurrency(r.cost)], ['Paid', formatCurrency(r.paid)], ['Payments', `${r.doneCount}/${r.paymentsCount} done`], ['Content', `${r.contentCount} (${formatCurrency(r.contentCost)})`]].map(([kk, vv]) => (
              <div key={kk} className="bg-white rounded p-2 border border-cream"><div className="text-dark1/45 text-[10px]">{kk}</div><div className="font-semibold text-dark1 truncate" title={String(vv)}>{vv}</div></div>
            ))}
          </div>
          {r.payments?.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead><tr className="text-dark1/45 text-left border-b border-cream"><th className="py-1">Status</th><th className="text-right">Amount</th><th>Requested</th><th>Done</th></tr></thead>
                <tbody>{r.payments.map((p, i) => (
                  <tr key={i} className="border-b border-cream/40"><td className="py-1">{p.status}</td><td className="text-right">{formatCurrency(p.amount)}</td><td className="text-dark1/60">{p.requested ?? '—'}</td><td className="text-dark1/60">{p.done ?? '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {k && <div className="mt-2 text-[10px] text-dark1/60">KolProfile (real): {formatNumber(k.followers)} followers · eng {k.engRate ?? '—'}% · rate {formatCurrency(k.rate)} · {k.channel ?? '—'}{k.niche ? ` · ${k.niche}` : ''}</div>}
        </div>

        {/* DUMMY block */}
        <div className="rounded-lg border-2 p-3" style={{ borderColor: `${DUMMY_COLOR}66`, background: `${DUMMY_COLOR}0d` }}>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold" style={{ color: DUMMY_COLOR }}><i className="fas fa-triangle-exclamation" /> DUMMY — attributed return <DummyTag /></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[['Attributed revenue', formatCurrency(dr.attributedRevenue)], ['Attributed GMV', formatCurrency(dr.attributedGmv)], ['Views', formatNumber(dr.contentViews)], ['Conversions', formatNumber(dr.conversions)]].map(([kk, vv]) => (
              <div key={kk} className="bg-white rounded p-2 border border-orange/20"><div className="text-dark1/45 text-[10px]">{kk}</div><div className="font-semibold text-dark1 truncate">{vv}</div></div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-dark1/60">ROI (real cost ÷ dummy return):</span>
            <span className="text-base font-bold" style={{ color: dr.roi != null && dr.roi >= 1 ? '#16a34a' : '#dc3545' }}>{dr.roi != null ? `${dr.roi}×` : '—'}</span>
            <DummyTag />
          </div>
          <div className="text-[10px] text-orange/90 mt-1.5"><i className="fas fa-triangle-exclamation" /> {dr.note}</div>
        </div>

        <p className="text-[10px] text-dark1/40 border-t border-cream pt-2">
          Cost &amp; payments are real; attributed return/ROI are fabricated (no talent→sales link yet). Don&apos;t treat ROI as actual performance.
        </p>
      </div>
    </Modal>
  )
}

// ── Recommendations modal: per-quadrant strategy + dummy caveat ──
export function RecommendationsModal({ rec, onClose }) {
  const segs = rec?.segments ?? []
  return (
    <Modal isOpen onClose={onClose} size="max-w-2xl" title="Talent strategy & recommendations">
      <div className="space-y-3 text-sm">
        <div className="text-[11px] rounded px-2 py-1.5" style={{ background: `${DUMMY_COLOR}12`, color: '#9a4f1f' }}>
          <i className="fas fa-triangle-exclamation" /> {rec?.caveat || 'Rankings rest on DUMMY attributed return — treat as a template until a real talent→revenue link exists.'}
        </div>
        {segs.length === 0 && <div className="text-dark1/40 text-center py-8">No talents to analyze.</div>}
        {segs.map(s => (
          <div key={s.quadrant} className="border border-cream rounded-lg overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between" style={{ background: `${roiQuadColor(s.quadrant)}14` }}>
              <span className="flex items-center gap-2"><QuadBadge quadrant={s.quadrant} /><span className="font-semibold text-dark1 text-xs">{s.headline}</span></span>
              <span className="text-[10px] text-dark1/50">{s.count} talent{s.count !== 1 ? 's' : ''}</span>
            </div>
            <div className="px-3 py-2">
              <div className="text-xs text-dark1/75 mb-2">{s.action}</div>
              <div className="flex flex-wrap gap-1">
                {s.talents.map(t => <span key={t.talentId} className="text-[10px] bg-bg rounded px-1.5 py-0.5 text-dark1/80" title={`ROI ${t.roi}× (dummy) · cost ${formatCurrency(t.cost)}`}>{t.name?.slice(0, 22)} · {t.roi}×</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
