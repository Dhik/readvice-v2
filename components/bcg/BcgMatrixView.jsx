'use client'
// Shared BCG matrix view, parameterized by `lens` ('traffic' | 'ctr'). Both
// /analytics/bcg and /analytics/bcg/ctr render this. ALL BCG logic lives in the
// engine (via /api/analytics/bcg) — this component only fetches, presents, and
// surfaces the dummy flags as banner + badges.
import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import CompactPage from '@/components/dashboard/CompactPage'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import GsSyncButton from '@/components/ui/GsSyncButton'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import BcgBubbleChart, { quadColor } from './BcgBubbleChart'
import { ProductDetailModal, RecommendationsModal, AdvancedFilterModal, QuadrantBadge } from './BcgModals'
import { formatCurrency, formatNumber } from '@/lib/utils'

const pct  = v => `${Number(v ?? 0).toFixed(2)}%`
const mult = v => `${Number(v ?? 0).toFixed(2)}×`

const LENS = {
  traffic: {
    title: 'BCG Matrix', icon: 'fa-chart-scatter', quadField: 'quadrant',
    order: ['Star', 'Cash Cow', 'Question Mark', 'Dog'],
    xLabel: 'Visitor (traffic)', yLabel: 'Conversion %',
    corners: { tl: 'Cash Cow', tr: 'Star', bl: 'Dog', br: 'Question Mark' }, // y↑ conv, x→ traffic
    other: { href: '/analytics/bcg/ctr', label: 'CTR Matrix →' },
    outlier: p => p.y > 80,
  },
  ctr: {
    title: 'CTR Matrix', icon: 'fa-bullseye', quadField: 'ctrQuadrant',
    order: ['Star', 'Potensi', 'Cash Cow', 'Dog'],
    xLabel: 'CTR %', yLabel: 'Conversion %',
    corners: { tl: 'Cash Cow', tr: 'Star', bl: 'Dog', br: 'Potensi' },
    other: { href: '/analytics/bcg', label: '← Traffic Matrix' },
    outlier: p => p.y > 80 || p.x > 20,
  },
}

const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

// CSV from product rows (real + dummy columns, dummy ones flagged in the header).
function toCsv(rows) {
  const cols = [
    ['quad', 'Quadrant'], ['kodeProduk', 'Code'], ['namaProduk', 'Name'], ['sku', 'SKU'],
    ['visitor', 'Traffic (dummy)'], ['buyers', 'Buyers'], ['conversion', 'Conversion% (dummy)'],
    ['benchmark', 'Benchmark%'], ['harga', 'Price'], ['sales', 'Revenue'], ['roas', 'ROAS (dummy)'],
    ['ctr', 'CTR% (dummy)'], ['stock', 'Stock'], ['score', 'Score (dummy)'],
  ]
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.map(c => c[1]).join(','), ...rows.map(r => cols.map(c => esc(r[c[0]])).join(','))].join('\n')
}
function download(name, content, type) {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function BcgMatrixView({ lens = 'traffic' }) {
  const cfg = LENS[lens]
  const [month, setMonth]   = useState(undefined)   // undefined → engine latest
  const [overview, setOverview] = useState(null)
  const [allProducts, setAllProducts] = useState([])
  const [gridProducts, setGridProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [xLog, setXLog] = useState(lens === 'traffic')  // traffic spans orders of magnitude

  const [detail, setDetail]   = useState(null)
  const [showRecs, setShowRecs] = useState(false)
  const [recs, setRecs]       = useState(null)
  const [showAdv, setShowAdv] = useState(false)
  const [advFilters, setAdvFilters] = useState({})

  const qf = cfg.quadField
  const withQuad = useCallback(items => (items ?? []).map(p => ({ ...p, quad: p[qf] })), [qf])

  // Overview + full (unfiltered) product list — the cards & default grid bind to these.
  useEffect(() => {
    let alive = true
    setLoading(true)
    const m = month ? `&month=${month}` : ''
    Promise.all([
      fetchJson(`/api/analytics/bcg?view=overview&lens=${lens}${m}`),
      fetchJson(`/api/analytics/bcg?view=products&lens=${lens}${m}`),
    ]).then(([ov, pr]) => {
      if (!alive) return
      setOverview(ov)
      const rows = withQuad(pr?.items)
      setAllProducts(rows)
      setGridProducts(rows)
      setAdvFilters({})
      setLoading(false)
    })
    return () => { alive = false }
  }, [lens, month, withQuad])

  // Apply advanced filters → engine rebuilds the grid (cards stay on the full month).
  const applyAdv = useCallback((f) => {
    setAdvFilters(f); setShowAdv(false)
    const p = new URLSearchParams({ view: 'products', lens })
    if (month) p.set('month', month)
    for (const [k, v] of Object.entries(f)) if (v != null && v !== '') p.set(k, v)
    fetchJson(`/api/analytics/bcg?${p}`).then(d => setGridProducts(withQuad(d?.items)))
  }, [lens, month, withQuad])

  const openRecs = useCallback(() => {
    setShowRecs(true)
    const m = month ? `&month=${month}` : ''
    fetchJson(`/api/analytics/bcg?view=recommendations&lens=${lens}${m}`).then(setRecs)
  }, [lens, month])

  const openDetail = useCallback((row) => {
    const m = month ? `&month=${month}` : ''
    fetchJson(`/api/analytics/bcg?view=detail&sku=${encodeURIComponent(row.sku)}&lens=${lens}${m}`).then(d => d && setDetail(d))
  }, [lens, month])

  const kpis = overview?.kpis
  const quad = overview?.quad
  const months = overview?.months ?? []
  const chartPoints = (overview?.chart?.points ?? []).filter(p => !cfg.outlier(p))
  const isDummy = overview?.chart?.dummy ?? overview?.kpis?.dummy ?? true
  const filtered = Object.values(advFilters).some(v => v != null && v !== '')

  // Per-quadrant aggregates for the 4 cards — grouped from the FULL month list.
  const cards = useMemo(() => {
    const total = allProducts.reduce((a, p) => a + p.sales, 0) || 1
    return cfg.order.map(q => {
      const rows = allProducts.filter(p => p.quad === q)
      const rev = rows.reduce((a, p) => a + p.sales, 0)
      const n = rows.length
      return {
        quad: q,
        count: quad?.[lens === 'ctr' ? 'ctr' : 'traffic']?.[q] ?? n,
        revenue: rev,
        share: Math.round((rev / total) * 1000) / 10,
        avgConv: n ? rows.reduce((a, p) => a + p.conversion, 0) / n : 0,
        avgRoas: n ? rows.reduce((a, p) => a + p.roas, 0) / n : 0,
      }
    })
  }, [allProducts, cfg.order, quad, lens])

  const tiles = [
    { icon: 'fa-box', bg: '#2C3639', label: 'Products', value: formatNumber(kpis?.productCount ?? 0) },
    { icon: 'fa-dollar-sign', bg: '#E07B39', label: 'Total Revenue', value: formatCurrency(kpis?.totalSales ?? 0) },
    { icon: 'fa-arrow-trend-up', bg: '#6B8E9E', label: lens === 'ctr' ? 'Avg CTR' : 'Avg Conversion', value: lens === 'ctr' ? pct(kpis?.avgCtr) : pct(kpis?.avgConversion), dev: true },
    { icon: 'fa-bullseye', bg: '#A9C5A0', iconColor: '#2C3639', label: 'Avg ROAS', value: mult(kpis?.avgRoas), dev: true },
  ]

  const columns = useMemo(() => [
    { key: 'quad', label: 'Quadrant', filter: 'select', sortable: true, render: r => <QuadrantBadge quadrant={r.quad} small /> },
    { key: 'kodeProduk', label: 'Code', searchable: true, sortable: true, render: r => <span className="font-mono text-[10px]">{r.kodeProduk}</span> },
    { key: 'namaProduk', label: 'Name', searchable: true, sortable: true, sortType: 'string' },
    { key: 'sku', label: 'SKU', searchable: true, render: r => <span className="font-mono text-[10px]">{r.sku}</span> },
    { key: 'visitor', label: 'Traffic', sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
    { key: 'buyers', label: 'Buyers', sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
    { key: 'conversion', label: 'Conv%', sortable: true, sortType: 'number', align: 'right',
      render: r => <span style={{ color: r.conversion >= r.benchmark ? '#16a34a' : '#dc3545' }} className="font-semibold">{pct(r.conversion)}</span> },
    { key: 'benchmark', label: 'Bench%', sortable: true, sortType: 'number', align: 'right', format: v => pct(v) },
    { key: 'harga', label: 'Price', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'sales', label: 'Revenue', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'roas', label: 'ROAS', sortable: true, sortType: 'number', align: 'right',
      render: r => <span style={{ color: r.roas >= 3 ? '#16a34a' : r.roas >= 1 ? '#f59e0b' : '#dc3545' }} className="font-semibold">{mult(r.roas)}</span> },
    { key: 'stock', label: 'Stock', sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
    { key: 'score', label: 'Perf', sortable: true, sortType: 'number', align: 'right',
      render: r => (
        <div className="flex items-center gap-1 justify-end">
          <div className="h-1.5 w-10 bg-dark1/10 rounded overflow-hidden"><div className="h-full" style={{ width: `${r.score}%`, background: quadColor(r.quad) }} /></div>
          <span className="text-[10px] text-dark1/60 w-5">{r.score}</span>
        </div>
      ) },
  ], [])

  return (
    <CompactPage>
      <CompactTopbar title={cfg.title} icon="fa-chart-pie"
        actions={
          <>
            <button onClick={openRecs} className="sv-tbtn sv-tbtn-dark"><i className="fas fa-lightbulb" /> Recommendations</button>
            <GsSyncButton endpoint="/api/import/gs/bcg/metrics" label="Sync metrics" icon="fa-rotate" />
            <button onClick={() => setShowAdv(true)} className={`sv-tbtn ${filtered ? 'sv-tbtn-primary' : 'sv-tbtn-ghost'}`}><i className="fas fa-filter" /> Filter{filtered ? ' •' : ''}</button>
            <Link href={cfg.other.href} className="sv-tbtn sv-tbtn-ghost">{cfg.other.label}</Link>
          </>
        }>
        <button onClick={() => download(`bcg-${lens}-${kpis?.month ?? 'data'}.csv`, toCsv(gridProducts), 'text/csv')} className="sv-tbtn sv-tbtn-ghost" title="Export CSV"><i className="fas fa-file-csv" /> CSV</button>
        <button onClick={() => download(`bcg-${lens}-${kpis?.month ?? 'data'}.json`, JSON.stringify(gridProducts, null, 2), 'application/json')} className="sv-tbtn sv-tbtn-ghost" title="Export JSON"><i className="fas fa-file-code" /> JSON</button>
        <span className="text-xs text-dark1/60 ml-1">Month</span>
        <select value={month ?? (months[0]?.month ?? '')} onChange={e => setMonth(e.target.value || undefined)}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2">
          {months.length === 0 && <option value="">—</option>}
          {months.map(m => <option key={m.month} value={m.month}>{m.month}{m.dummy ? ' (dummy)' : ''}</option>)}
        </select>
      </CompactTopbar>

      {/* DEV honesty banner */}
      {isDummy && (
        <div className="flex items-start gap-2 rounded-lg border border-orange/40 bg-orange/10 px-3 py-2 text-[11px] text-dark1">
          <i className="fas fa-triangle-exclamation text-orange mt-0.5" />
          <span>
            <b>DEV — quadrant positions are not real.</b> Visitor &amp; CTR (both matrix axes) are <b>dummy</b> data, so where a product lands (Star / Cash Cow / {lens === 'ctr' ? 'Potensi' : 'Question Mark'} / Dog) is <b>fictional</b>.
            Only <b>revenue, qty, price &amp; stock</b> are real. <Link href="/analytics/bcg" className="underline">See docs/BCG_DATA_SOURCES.md</Link>.
          </span>
        </div>
      )}

      <IconKpiStrip tiles={tiles} />

      {/* 4 quadrant summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {cards.map(c => (
          <div key={c.quad} className="sv-panel p-2.5" style={{ borderTop: `3px solid ${quadColor(c.quad)}` }}>
            <div className="flex items-center justify-between">
              <QuadrantBadge quadrant={c.quad} small />
              <span className="text-lg font-bold text-dark1">{c.count}</span>
            </div>
            <div className="mt-1.5 text-[11px] text-dark1/70">{formatCurrency(c.revenue)}</div>
            <div className="h-1.5 bg-dark1/10 rounded overflow-hidden mt-1">
              <div className="h-full rounded" style={{ width: `${c.share}%`, background: quadColor(c.quad) }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-dark1/50">
              <span>{c.share}% rev</span>
              <span>conv {pct(c.avgConv)} · roas {mult(c.avgRoas)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bubble matrix */}
      <CompactPanel title={`${cfg.title} — ${chartPoints.length} products`} icon={cfg.icon}
        headerRight={
          <label className="flex items-center gap-1 text-[10px] text-dark1/55 cursor-pointer">
            <input type="checkbox" checked={xLog} onChange={e => setXLog(e.target.checked)} /> log X
          </label>
        }
        bodyClass="p-2">
        {loading ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : chartPoints.length === 0 ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">No products for this month.</div>
          : <BcgBubbleChart points={chartPoints} xLabel={cfg.xLabel} yLabel={cfg.yLabel}
              xDivider={overview?.chart?.axes?.xDivider} yDivider={overview?.chart?.axes?.yDivider ?? 1}
              xLog={xLog} quadrantOrder={cfg.order} quadrantLabels={cfg.corners} height={440} />}
      </CompactPanel>

      {/* Products grid */}
      <CompactPanel title={`Products — ${gridProducts.length}${filtered ? ' (filtered)' : ''}`} icon="fa-table" bodyClass="p-2">
        <DataGrid data={gridProducts} columns={columns} searchable onRowClick={openDetail}
          defaultSort={{ key: 'sales', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No products with sales this month." />
        <p className="text-[10px] text-dark1/40 mt-1">Traffic / Conv% / ROAS / Perf derive from dummy visitor &amp; CTR. Click a row for the full breakdown.</p>
      </CompactPanel>

      {detail && <ProductDetailModal detail={detail} lens={lens} onClose={() => setDetail(null)} />}
      {showRecs && <RecommendationsModal rec={recs} lens={lens} onClose={() => setShowRecs(false)} />}
      {showAdv && <AdvancedFilterModal initial={advFilters} quadrantOptions={cfg.order} onApply={applyAdv} onClose={() => setShowAdv(false)} />}
      <AnalyticsAIPanel module="bcg" context={{ overview, products: allProducts }}
        suggestions={['Which products are Stars?', 'Are the quadrant positions real?']} />
    </CompactPage>
  )
}
