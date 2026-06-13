'use client'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'

// Canonical display order: top-of-funnel first, unclassified last
const CANONICAL_STAGES = ['TOFU', 'TOFU EXC', 'MOFU', 'MOFU EXC', 'BOFU', 'BOFU APP', 'BOFU LIVE', 'BOFU IE', 'OTHERS']

const EMPTY_STAGES = CANONICAL_STAGES.map(stage => ({ stage, spent: 0, revenue: null, conversions: 0, roas: null, pct: 0 }))

function FunnelRow({ row }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-[90px] text-[11px] font-semibold text-dark1 shrink-0 truncate">{row.stage}</span>
      <div className="flex-1 h-1.5 bg-cream rounded-full overflow-hidden">
        <div
          className="h-full bg-orange rounded-full transition-all duration-500"
          style={{ width: `${row.pct}%` }}
        />
      </div>
      <span className="w-[36px] text-[11px] text-dark2 text-right shrink-0 tabular-nums">{row.pct}%</span>
      <span className="w-[108px] text-[11px] text-dark1 text-right shrink-0 font-medium tabular-nums">
        {row.spent > 0 ? formatCurrency(row.spent) : '—'}
      </span>
      <span className="w-[44px] text-[11px] text-dark2 text-right shrink-0 tabular-nums">
        {row.roas != null ? `${row.roas}x` : '—'}
      </span>
    </div>
  )
}

export default function MetaFunnelPanel({ startDate, endDate, refreshKey }) {
  const [result, setResult]     = useState({ stages: [], campaigns: [], totals: {} })
  const [loading, setLoading]   = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate)   params.set('endDate',   endDate)
    fetch(`/api/ad-spent/meta/funnel?${params}`)
      .then(r => r.json())
      .then(d  => { setResult(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [startDate, endDate, refreshKey])

  const displayStages = result.stages.length ? result.stages : EMPTY_STAGES
  const isEmpty       = (result.totals.spent ?? 0) === 0

  return (
    <div className="sv-panel">
      <div className="sv-panel-header cursor-pointer select-none" onClick={() => setCollapsed(c => !c)}>
        <span className="sv-panel-title">
          <i className="fas fa-filter text-[11px] mr-1" />
          Meta Funnel Breakdown
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {loading && <span className="text-[10px] text-dark1/40">Loading…</span>}
          <i className={`fas fa-chevron-down text-[10px] text-dark1/40 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
        </div>
      </div>

      {/* Stage progress bars */}
      {!collapsed && <div className="px-4 py-3 border-b border-cream">
        {/* Column micro-headers */}
        <div className="flex items-center gap-2 mb-1">
          <span className="w-[90px] text-[9px] font-semibold uppercase tracking-wide text-dark1/40 shrink-0">Stage</span>
          <span className="flex-1" />
          <span className="w-[36px] text-[9px] font-semibold uppercase tracking-wide text-dark1/40 text-right shrink-0">%</span>
          <span className="w-[108px] text-[9px] font-semibold uppercase tracking-wide text-dark1/40 text-right shrink-0">Spent</span>
          <span className="w-[44px] text-[9px] font-semibold uppercase tracking-wide text-dark1/40 text-right shrink-0">ROAS</span>
        </div>

        {displayStages.map(row => (
          <FunnelRow key={row.stage} row={row} />
        ))}

        {isEmpty && !loading && (
          <p className="text-[11px] italic text-gray-400 text-center mt-2 pb-0.5">
            No Meta data yet — import to populate
          </p>
        )}
      </div>}

      {/* Campaign drilldown */}
      {!collapsed && <div>
        <div className="sv-panel-header">
          <span className="sv-panel-title">
            <i className="fas fa-table text-[11px] mr-1" />
            Campaigns{result.campaigns.length > 0 ? ` — ${result.campaigns.length}` : ''}
          </span>
        </div>
        <div className="overflow-x-auto max-h-[192px] overflow-y-auto">
          <table className="sv-table-clean">
            <thead>
              <tr>
                <th>Adset / Campaign</th>
                <th><span className="num">Spent</span></th>
                <th><span className="num">Revenue</span></th>
                <th><span className="num">Conversions</span></th>
                <th><span className="num">ROAS</span></th>
              </tr>
            </thead>
            <tbody>
              {result.campaigns.length ? result.campaigns.map((c, i) => (
                <tr key={i}>
                  <td className="text-dark1 max-w-[260px] truncate">{c.adsetName}</td>
                  <td><span className="num">{formatCurrency(c.spent)}</span></td>
                  <td><span className="num">{c.revenue != null ? formatCurrency(c.revenue) : '—'}</span></td>
                  <td><span className="num">{c.conversions}</span></td>
                  <td><span className="num">{c.roas != null ? `${c.roas}x` : '—'}</span></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-gray-400">
                    No campaigns
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  )
}
