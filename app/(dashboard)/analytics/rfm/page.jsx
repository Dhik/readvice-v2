'use client'
// RFM Customer Segmentation — deep analysis (Analytics). BCG-standard quality
// (interactive, detail modal, clean theme, clear real-vs-dummy highlighting) but
// with RFM-appropriate visuals: a Recency×Frequency segment SCATTER + a segment
// GRID — NOT a bubble-matrix clone. ALL RFM logic lives in the engine via
// /api/analytics/rfm; this page only fetches, presents, and surfaces dummy flags.
import { useEffect, useMemo, useState, useCallback } from 'react'
import CompactPage from '@/components/dashboard/CompactPage'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import RfmScatterChart, { SEGMENT_ORDER, segColor } from '@/components/rfm/RfmScatterChart'
import { SegmentBadge, DummyTag, CustomerDetailModal, RecommendationsModal, AdvancedFilterModal } from '@/components/rfm/RfmModals'
import { formatCurrency, formatNumber } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return 'Rp' + (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return 'Rp' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return 'Rp' + (n / 1e3).toFixed(0) + 'K'; return 'Rp' + Math.round(n) }
const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

function toCsv(rows) {
  const cols = [['segment', 'Segment'], ['customerKey', 'CustomerKey'], ['name', 'Name'],
    ['recencyDays', 'RecencyDays'], ['frequency', 'Frequency'], ['monetary', 'Monetary'],
    ['r', 'R'], ['f', 'F'], ['m', 'M'], ['source', 'Source(real/dummy)']]
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.map(c => c[1]).join(','), ...rows.map(r => cols.map(c => esc(r[c[0]])).join(','))].join('\n')
}
function download(name, content, type) {
  const blob = new Blob([content], { type }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function RfmPage() {
  const [asOf, setAsOf] = useState(undefined)   // undefined → engine latest
  const [overview, setOverview] = useState(null)
  const [segments, setSegments] = useState([])
  const [scatter, setScatter]   = useState([])
  const [dates, setDates]       = useState([])
  const [allCustomers, setAllCustomers] = useState([])
  const [gridCustomers, setGridCustomers] = useState([])
  const [loading, setLoading]   = useState(true)

  const [detail, setDetail]     = useState(null)
  const [showRecs, setShowRecs] = useState(false)
  const [recs, setRecs]         = useState(null)
  const [showAdv, setShowAdv]   = useState(false)
  const [advFilters, setAdvFilters] = useState({})

  // Overview + full (unfiltered) customer list — cards/scatter/default grid bind here.
  useEffect(() => {
    let alive = true
    setLoading(true)
    const a = asOf ? `&asOf=${asOf}` : ''
    Promise.all([
      fetchJson(`/api/analytics/rfm?view=overview${a}`),
      fetchJson(`/api/analytics/rfm?view=customers${a}`),
    ]).then(([ov, cu]) => {
      if (!alive) return
      setOverview(ov?.overview ?? null)
      setSegments(ov?.segments?.segments ?? [])
      setScatter(ov?.scatter?.points ?? [])
      setDates(ov?.dates ?? [])
      const rows = cu?.items ?? []
      setAllCustomers(rows); setGridCustomers(rows); setAdvFilters({})
      setLoading(false)
    })
    return () => { alive = false }
  }, [asOf])

  const applyAdv = useCallback((f) => {
    setAdvFilters(f); setShowAdv(false)
    const p = new URLSearchParams({ view: 'customers' })
    if (asOf) p.set('asOf', asOf)
    for (const [k, v] of Object.entries(f)) if (v != null && v !== '') p.set(k, v === true ? '1' : v)
    fetchJson(`/api/analytics/rfm?${p}`).then(d => setGridCustomers(d?.items ?? []))
  }, [asOf])

  const openRecs = useCallback(() => {
    setShowRecs(true)
    const a = asOf ? `&asOf=${asOf}` : ''
    fetchJson(`/api/analytics/rfm?view=recommendations${a}`).then(setRecs)
  }, [asOf])

  const openDetail = useCallback((row) => {
    const a = asOf ? `&asOf=${asOf}` : ''
    fetchJson(`/api/analytics/rfm?view=detail&key=${encodeURIComponent(row.customerKey)}${a}`).then(d => d && setDetail(d))
  }, [asOf])

  const filtered = Object.values(advFilters).some(v => v != null && v !== '' && v !== false)
  const segCount = overview?.segments ? Object.keys(overview.segments).length : 0

  const tiles = [
    { icon: 'fa-users', bg: '#2C3639', label: 'Real Customers', value: formatNumber(overview?.realCustomers ?? 0) },
    { icon: 'fa-clock-rotate-left', bg: '#6B8E9E', label: 'Avg Recency', value: `${formatNumber(Math.round(overview?.avgRecency ?? 0))}d` },
    { icon: 'fa-repeat', bg: '#E07B39', label: 'Avg Frequency', value: (overview?.avgFrequency ?? 0).toFixed(2) },
    { icon: 'fa-money-bill-wave', bg: '#A9C5A0', iconColor: '#2C3639', label: 'Avg Monetary', value: shortRp(overview?.avgMonetary) },
    { icon: 'fa-layer-group', bg: '#8B5E3C', label: 'Segments', value: formatNumber(segCount) },
  ]

  const columns = useMemo(() => [
    { key: 'segment', label: 'Segment', filter: 'select', sortable: true, render: r => <SegmentBadge segment={r.segment} small /> },
    { key: 'customerKey', label: 'Customer Key', searchable: true, render: r => <span className="font-mono text-[10px]">{r.customerKey}</span> },
    { key: 'name', label: 'Name', searchable: true, sortable: true, sortType: 'string' },
    { key: 'recencyDays', label: 'Recency', sortable: true, sortType: 'number', align: 'right', format: v => `${formatNumber(v)}d` },
    { key: 'frequency', label: 'Freq', sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
    { key: 'monetary', label: 'Monetary', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'rfm', label: 'R/F/M', render: r => <span className="font-mono text-[10px]" style={{ color: segColor(r.segment) }}>R{r.r} F{r.f} M{r.m}</span> },
    { key: 'dummy', label: 'Source', filter: 'select', filterFormat: v => (v ? 'Dummy' : 'Real'),
      render: r => (r.dummy ? <DummyTag /> : <span className="text-[9px] text-green-600 font-semibold uppercase tracking-wide">real</span>) },
  ], [])

  return (
    <CompactPage>
      <CompactTopbar title="RFM Segments" icon="fa-user-tag"
        actions={
          <>
            <button onClick={openRecs} className="sv-tbtn sv-tbtn-dark"><i className="fas fa-lightbulb" /> Recommendations</button>
            <button onClick={() => setShowAdv(true)} className={`sv-tbtn ${filtered ? 'sv-tbtn-primary' : 'sv-tbtn-ghost'}`}><i className="fas fa-filter" /> Filter{filtered ? ' •' : ''}</button>
          </>
        }>
        <button onClick={() => download(`rfm-${overview?.asOf ?? 'data'}.csv`, toCsv(gridCustomers), 'text/csv')} className="sv-tbtn sv-tbtn-ghost" title="Export CSV"><i className="fas fa-file-csv" /> CSV</button>
        <button onClick={() => download(`rfm-${overview?.asOf ?? 'data'}.json`, JSON.stringify(gridCustomers, null, 2), 'application/json')} className="sv-tbtn sv-tbtn-ghost" title="Export JSON"><i className="fas fa-file-code" /> JSON</button>
        <span className="text-xs text-dark1/60 ml-1">As of</span>
        <select value={asOf ?? (dates[0]?.date ?? '')} onChange={e => setAsOf(e.target.value || undefined)}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2">
          {dates.length === 0 && <option value="">—</option>}
          {dates.map(d => <option key={d.date} value={d.date}>{d.date}</option>)}
        </select>
      </CompactTopbar>

      {/* HONESTY banner */}
      {overview && (
        <div className="flex items-start gap-2 rounded-lg border border-orange/40 bg-orange/10 px-3 py-2 text-[11px] text-dark1">
          <i className="fas fa-circle-info text-orange mt-0.5" />
          <span>
            Customer coverage <b>{overview.coveragePct}%</b> ({formatNumber(overview.ordersWithCustomer)}/{formatNumber(overview.totalOrders)} real-sales orders carry a customer id).
            R/F/M are <b>REAL</b> for the <b>{formatNumber(overview.realCustomers)}</b> real customers; <b>{formatNumber(overview.dummyCustomers)}</b> <b>dummy-padded</b> customers fill
            high-value segments (Champions / Loyal / At Risk…) that real data can’t reach yet (max real frequency = 2 → only New / Potential Loyalist).
            Becomes fully real as coverage + repeat history grow. <span className="text-dark1/50">See docs/RFM_DATA_SOURCES.md.</span>
          </span>
        </div>
      )}

      <IconKpiStrip tiles={tiles} />

      {/* Segment scatter (RFM matrix equivalent) */}
      <CompactPanel title={`Segment Map — ${scatter.length} customers`} icon="fa-braille"
        headerRight={<span className="text-[9px] text-dark1/40">Recency × Frequency · bubble = Monetary · color = segment</span>}
        bodyClass="p-2">
        {loading ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : scatter.length === 0 ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">No customers for this date.</div>
          : <RfmScatterChart points={scatter} order={SEGMENT_ORDER} height={440} />}
      </CompactPanel>

      {/* Segment summary grid */}
      <CompactPanel title="Segments" icon="fa-table-cells-large" bodyClass="p-2">
        {segments.length === 0 ? <div className="text-dark1/30 text-xs text-center py-6">No segments.</div> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {segments.map(s => {
              const dummyOnly = s.realCount === 0 && s.dummyCount > 0
              return (
                <div key={s.segment} className="sv-panel p-2.5" style={{ borderTop: `3px solid ${segColor(s.segment)}` }}>
                  <div className="flex items-center justify-between">
                    <SegmentBadge segment={s.segment} small />
                    <span className="text-base font-bold text-dark1">{s.count}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px]">
                    <span className="text-green-600 font-semibold">{s.realCount} real</span>
                    <span className="text-dark1/30">·</span>
                    <span className="text-orange font-semibold">{s.dummyCount} dummy</span>
                    {dummyOnly && <span className="ml-auto text-[8px] uppercase tracking-wide px-1 rounded bg-orange/15 text-orange" title="No real customers reach this segment yet">dummy-only</span>}
                  </div>
                  <div className="h-1.5 bg-dark1/10 rounded overflow-hidden mt-1.5" title={`${s.revenuePct}% of revenue`}>
                    <div className="h-full rounded" style={{ width: `${s.revenuePct}%`, background: segColor(s.segment) }} />
                  </div>
                  <div className="flex justify-between mt-1 text-[9px] text-dark1/50">
                    <span>{s.pct}% cust</span><span>{s.revenuePct}% rev</span>
                  </div>
                  <div className="mt-1 text-[9px] text-dark1/55">R{(s.avgRecency).toFixed(0)}d · F{(s.avgFrequency).toFixed(1)} · {shortRp(s.avgMonetary)}</div>
                  <div className="mt-1 text-[9px] text-dark1/45 leading-snug line-clamp-2" title={s.action}>{s.priority ? <b>{s.priority}. </b> : null}{s.action}</div>
                </div>
              )
            })}
          </div>
        )}
      </CompactPanel>

      {/* Customers grid */}
      <CompactPanel title={`Customers — ${gridCustomers.length}${filtered ? ' (filtered)' : ''}`} icon="fa-table" bodyClass="p-2">
        <DataGrid data={gridCustomers} columns={columns} searchable onRowClick={openDetail}
          defaultSort={{ key: 'monetary', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No customers for this date." />
        <p className="text-[10px] text-dark1/40 mt-1">Click a row for R/F/M breakdown + order history. <span className="text-orange">dummy</span> = fabricated padding customer.</p>
      </CompactPanel>

      {detail && <CustomerDetailModal detail={detail} onClose={() => setDetail(null)} />}
      {showRecs && <RecommendationsModal rec={recs} onClose={() => setShowRecs(false)} />}
      {showAdv && <AdvancedFilterModal initial={advFilters} segmentOptions={SEGMENT_ORDER} onApply={applyAdv} onClose={() => setShowAdv(false)} />}
      <AnalyticsAIPanel module="rfm" context={{ overview, segments, scatter }}
        suggestions={['Which segments need attention?', 'How complete is this RFM (coverage)?']} />
    </CompactPage>
  )
}
