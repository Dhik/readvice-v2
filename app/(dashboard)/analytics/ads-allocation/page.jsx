'use client'
// Ads Spend-Allocation — deep analysis (Analytics). BCG-standard quality with
// fit-for-ALLOCATION visuals: Pareto + share donut + trend + MoM — NOT a bubble
// clone. 100% REAL (expense-only) — NO ROAS anywhere. All logic in the engine via
// /api/analytics/ads-allocation; this page fetches, presents, and stays honest about
// the thin date range + the absent revenue link.
import { useEffect, useMemo, useState, useCallback } from 'react'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import { ParetoChart, ShareDonut, TrendChart, MoMChart, keyColor } from '@/components/ads-allocation/AllocationCharts'
import DetailModal from '@/components/ads-allocation/DetailModal'
import { formatCurrency, formatNumber } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return 'Rp' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return 'Rp' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return 'Rp' + (n / 1e3).toFixed(0) + 'K'; return 'Rp' + Math.round(n) }
const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

const LENS = {
  channel:  { label: 'Channels',   icon: 'fa-share-nodes', noun: 'channel',  paretoTitle: 'Channel Spend Pareto (social)', source: 'social' },
  category: { label: 'Categories', icon: 'fa-tags',        noun: 'category', paretoTitle: 'Category Spend Pareto (marketing)', source: 'marketing' },
}

function toCsv(items) {
  const cols = [['rank', 'Rank'], ['key', 'Name'], ['spend', 'Spend'], ['sharePct', 'Share%'], ['cumulativePct', 'Cumulative%']]
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.map(c => c[1]).join(','), ...items.map(r => cols.map(c => esc(r[c[0]])).join(','))].join('\n')
}
function download(name, content, type) {
  const blob = new Blob([content], { type }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function AdsAllocationPage() {
  const [lens, setLens]   = useState('channel')
  const [month, setMonth] = useState('')          // '' = all data
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const m = month ? `&month=${month}` : ''
    fetchJson(`/api/analytics/ads-allocation?view=overview${m}`).then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [month])

  const cfg = LENS[lens]
  const ov = data?.overview
  const range = data?.range
  const block = data?.[lens]                          // { pareto, trend, mom, share, total }
  const months = ov?.months ?? []

  const openDetail = useCallback((key) => {
    fetchJson(`/api/analytics/ads-allocation?view=detail&dim=${lens}&key=${encodeURIComponent(key)}`)
      .then(d => d?.detail && setDetail({ ...d.detail, _dim: lens, _color: keyColor((block?.pareto?.items ?? []).findIndex(i => i.key === key)) }))
  }, [lens, block])

  const tiles = [
    { icon: 'fa-coins', bg: '#E07B39', label: 'Total Spend', value: shortRp(ov?.totalSpend) },
    { icon: 'fa-share-nodes', bg: '#6B8E9E', label: 'Social Total', value: shortRp(ov?.socialTotal) },
    { icon: 'fa-tags', bg: '#8B5E3C', label: 'Marketing Total', value: shortRp(ov?.marketingTotal) },
    { icon: 'fa-layer-group', bg: '#2C3639', label: 'Channels', value: formatNumber(ov?.channelCount ?? 0) },
    { icon: 'fa-list', bg: '#A9C5A0', iconColor: '#2C3639', label: 'Categories', value: formatNumber(ov?.categoryCount ?? 0) },
    { icon: 'fa-arrow-trend-up', bg: '#B5645B', label: 'MoM Δ', value: ov?.mom?.changePct != null ? `${ov.mom.changePct > 0 ? '+' : ''}${ov.mom.changePct}%` : '—' },
  ]

  // DataGrid rows: enrich pareto items with MoM Δ (joined by key).
  const rows = useMemo(() => {
    const par = block?.pareto?.items ?? []
    const momMap = Object.fromEntries((block?.mom?.comparison ?? []).map(c => [c.key, c.changePct]))
    return par.map(i => ({ ...i, momPct: momMap[i.key] ?? null }))
  }, [block])

  const columns = useMemo(() => [
    { key: 'rank', label: '#', sortable: true, sortType: 'number', align: 'right' },
    { key: 'key', label: cfg.label.replace(/s$/, ''), searchable: true, sortable: true, sortType: 'string',
      render: r => <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: keyColor(r.rank - 1) }} />{r.key}</span> },
    { key: 'spend', label: 'Spend', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'sharePct', label: 'Share%', sortable: true, sortType: 'number', align: 'right', format: v => `${v}%` },
    { key: 'cumulativePct', label: 'Cum%', sortable: true, sortType: 'number', align: 'right',
      render: r => <span style={{ color: r.inTop80 ? '#16a34a' : '#999', fontWeight: r.inTop80 ? 600 : 400 }}>{r.cumulativePct}%</span> },
    { key: 'momPct', label: 'MoM Δ', sortable: true, sortType: 'number', align: 'right',
      render: r => r.momPct == null ? <span className="text-dark1/30">—</span>
        : <span style={{ color: r.momPct >= 0 ? '#16a34a' : '#dc3545' }}>{r.momPct > 0 ? '+' : ''}{r.momPct}%</span> },
  ], [cfg.label])

  const trendEmpty = !block?.trend?.points?.length
  const trendRange = block?.trend?.range

  return (
    <CompactPage>
      <CompactTopbar title="Ads Allocation" icon="fa-chart-simple"
        actions={
          <div className="flex gap-0.5 bg-bg rounded p-0.5">
            {Object.entries(LENS).map(([k, v]) => (
              <button key={k} onClick={() => setLens(k)}
                className={`sv-tbtn ${lens === k ? 'sv-tbtn-dark' : 'sv-tbtn-ghost'} !h-6`}><i className={`fas ${v.icon}`} /> {v.label}</button>
            ))}
          </div>
        }>
        <button onClick={() => download(`ads-allocation-${lens}-${month || 'all'}.csv`, toCsv(rows), 'text/csv')} className="sv-tbtn sv-tbtn-ghost" title="Export CSV"><i className="fas fa-file-csv" /> CSV</button>
        <span className="text-xs text-dark1/60 ml-1">Period</span>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2">
          <option value="">All data</option>
          {months.map(m => <option key={m.month} value={m.month}>{m.month}{m.partial ? ' (partial)' : ''}</option>)}
        </select>
      </CompactTopbar>

      {/* Honest note — NOT a dummy banner (all real); flags no-ROAS + thin range */}
      <div className="flex items-start gap-2 rounded-lg border border-cream bg-bg/60 px-3 py-2 text-[11px] text-dark1/80">
        <i className="fas fa-circle-info text-dark2 mt-0.5" />
        <span>
          <b>Allocation analysis (expense only).</b> All figures are <b>real</b>. <b>No ROAS</b> — ad/marketing spend isn’t yet linked to sales revenue (planned: attribution / Wave 3).
          {range?.social?.min && <> Social-channel data covers <b>{range.social.min} → {range.social.max}</b> ({range.social.days} days){range.marketing?.min && <>; marketing <b>{range.marketing.min} → {range.marketing.max}</b></>}.</>}
          {' '}Trend beyond the real range is empty, not extrapolated.
        </span>
      </div>

      <IconKpiStrip tiles={tiles} />

      {/* Pareto + Share row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title={cfg.paretoTitle} icon="fa-ranking-star"
          headerRight={block?.pareto ? <span className="text-[9px] text-dark1/45">{block.pareto.top80Count}/{block.pareto.count} make 80% · evenly spread = shallow curve</span> : null}
          bodyClass="p-2">
          {loading ? <div style={{ height: 300 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : !block?.pareto?.items?.length ? <div style={{ height: 300 }} className="flex items-center justify-center text-dark1/30 text-xs">No spend in range.</div>
            : <ParetoChart items={block.pareto.items} height={300} onSelect={openDetail} />}
        </CompactPanel>

        <CompactPanel title={`Share of ${cfg.source} spend`} icon="fa-chart-pie" bodyClass="p-2">
          {loading ? <div style={{ height: 300 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : !block?.share?.length ? <div style={{ height: 300 }} className="flex items-center justify-center text-dark1/30 text-xs">No spend in range.</div>
            : <ShareDonut items={block.share} height={300} onSelect={openDetail} />}
        </CompactPanel>
      </div>

      {/* Trend + MoM row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title={`Spend Trend — ${cfg.label.toLowerCase()}`} icon="fa-chart-line"
          headerRight={trendRange?.min ? <span className="text-[9px] text-dark1/45">{trendRange.min} → {trendRange.max}</span> : null}
          bodyClass="p-2">
          {loading ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : trendEmpty ? <div style={{ height: 280 }} className="flex flex-col items-center justify-center text-dark1/30 text-xs gap-1"><i className="fas fa-calendar-xmark text-lg" /><span>No spend data in this range.</span></div>
            : <TrendChart points={block.trend.points} keys={block.trend.keys} height={280} />}
        </CompactPanel>

        <CompactPanel title={`Month-over-Month — ${cfg.label.toLowerCase()}`} icon="fa-calendar-week"
          headerRight={block?.mom?.caveat ? <span className="text-[9px] text-orange" title={block.mom.caveat}><i className="fas fa-triangle-exclamation" /> partial month</span> : null}
          bodyClass="p-2">
          {loading ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : block?.mom?.singlePeriod ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs px-4 text-center">{block.mom.note || 'Only one month of data — MoM not yet possible.'}</div>
            : <>
                {block?.mom?.caveat && <div className="text-[10px] text-orange/90 mb-1 px-1"><i className="fas fa-triangle-exclamation" /> {block.mom.caveat}</div>}
                <MoMChart comparison={block.mom.comparison} previousMonth={block.mom.previousMonth} currentMonth={block.mom.currentMonth} height={block?.mom?.caveat ? 256 : 280} />
              </>}
        </CompactPanel>
      </div>

      {/* Table */}
      <CompactPanel title={`${cfg.label} — ${rows.length}`} icon="fa-table" bodyClass="p-2">
        <DataGrid data={rows} columns={columns} searchable onRowClick={r => openDetail(r.key)}
          defaultSort={{ key: 'spend', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No spend in this range." />
        <p className="text-[10px] text-dark1/40 mt-1">Click a row for {cfg.noun} breakdown + daily trend{lens === 'category' ? ' + subcategory split' : ''}. Expense only — no ROAS.</p>
      </CompactPanel>

      {detail && <DetailModal detail={detail} dim={detail._dim} color={detail._color} onClose={() => setDetail(null)} />}
    </CompactPage>
  )
}
