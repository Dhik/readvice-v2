'use client'
// Finance — Gross Margin (Analytics). BCG-standard quality with finance-fit visuals:
// waterfall + margin-Pareto + trend + per-SKU table. 100% REAL (revenue − HPP).
// GROSS only — NEVER a net number. All logic in the engine via /api/analytics/gross-margin.
import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import { MarginWaterfall, MarginParetoChart, MarginTrendChart } from '@/components/gross-margin/MarginCharts'
import DetailModal from '@/components/gross-margin/DetailModal'
import CalculatedFieldModal from '@/components/analytics/CalculatedFieldModal'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import { useCalcFields, safeEvaluate, fmtCalc } from '@/components/analytics/calcFieldHelpers'
import { formatCurrency, formatNumber } from '@/lib/utils'

const MODULE = 'gross-margin'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return 'Rp' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return 'Rp' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return 'Rp' + (n / 1e3).toFixed(0) + 'K'; return 'Rp' + Math.round(n) }
const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

function toCsv(items) {
  const cols = [['sku', 'SKU'], ['name', 'Name'], ['qty', 'Units'], ['revenue', 'Revenue'], ['hpp', 'COGS'], ['grossProfit', 'GrossProfit'], ['marginPct', 'Margin%'], ['hasCost', 'HasCost']]
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.map(c => c[1]).join(','), ...items.map(r => cols.map(c => esc(r[c[0]])).join(','))].join('\n')
}
function download(name, content, type) {
  const blob = new Blob([content], { type }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function GrossMarginPage() {
  const [month, setMonth] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [showCalc, setShowCalc] = useState(false)
  const { fields: calcFields, manifest, reload: reloadCalc, removeField } = useCalcFields(MODULE)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const m = month ? `&month=${month}` : ''
    fetchJson(`/api/analytics/gross-margin?view=overview${m}`).then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [month])

  const openDetail = useCallback((sku) => {
    const m = month ? `&month=${month}` : ''
    fetchJson(`/api/analytics/gross-margin?view=detail&sku=${encodeURIComponent(sku)}${m}`).then(d => d && setDetail(d))
  }, [month])

  const ov = data?.overview
  const hasData = ov?.hasData
  const wf = data?.waterfall
  const pareto = data?.pareto
  const products = data?.byProduct?.items ?? []
  const trend = data?.trend

  // ── Calc fields (Part B4) — map page data to manifest keys, resolve via the evaluator ──
  // Overview scope: aggregate values keyed by the gross-margin manifest params.
  const overviewValues = useMemo(() => ({
    revenue: ov?.totalRevenue ?? 0, hpp: ov?.totalHpp ?? 0, grossProfit: ov?.grossProfit ?? 0,
    marginPct: ov?.grossMarginPct ?? 0, qty: ov?.qty ?? 0,
    coveragePct: ov?.coveragePct ?? 0, coveredMarginPct: ov?.coveredMarginPct ?? 0,
  }), [ov])
  // Per-row items already carry manifest keys (revenue/hpp/grossProfit/marginPct/qty).
  const extraTiles = useMemo(() => calcFields.map(f => {
    const { value, dummy } = safeEvaluate(f.formula, overviewValues, manifest)
    return { label: f.label, value: fmtCalc(value), dummy, onRemove: () => removeField(f.id) }
  }), [calcFields, overviewValues, manifest, removeField])
  const extraColumns = useMemo(() => calcFields.map(f => ({
    key: String(f.id), label: f.label, format: fmtCalc,
    dummy: safeEvaluate(f.formula, {}, manifest).dummy,
    resolve: row => safeEvaluate(f.formula, row, manifest).value,
    onRemove: () => removeField(f.id),
  })), [calcFields, manifest, removeField])

  // month options derived from trend dates (data is thin — usually one month)
  const monthOpts = useMemo(() => [...new Set((trend?.points ?? []).map(p => p.date.slice(0, 7)))], [trend])

  const tiles = [
    { icon: 'fa-dollar-sign', bg: '#3F4E4F', label: 'Revenue', value: shortRp(ov?.totalRevenue), delta: ov?.deltas?.revenue },
    { icon: 'fa-industry', bg: '#B5645B', label: 'COGS (HPP)', value: shortRp(ov?.totalHpp) },
    { icon: 'fa-coins', bg: '#22c55e', label: 'Gross Profit', value: shortRp(ov?.grossProfit), delta: ov?.deltas?.grossProfit },
    { icon: 'fa-percent', bg: '#E07B39', label: 'Margin % (blended)', value: ov?.grossMarginPct != null ? `${ov.grossMarginPct}%` : '—' },
    { icon: 'fa-circle-check', bg: '#A9C5A0', iconColor: '#2C3639', label: 'Margin % (covered)', value: ov?.coveredMarginPct != null ? `${ov.coveredMarginPct}%` : '—' },
    { icon: 'fa-shield-halved', bg: '#6B8E9E', label: 'HPP Coverage', value: ov?.coveragePct != null ? `${ov.coveragePct}%` : '—' },
  ]

  const columns = useMemo(() => [
    { key: 'sku', label: 'SKU', searchable: true, sortable: true, render: r => <span className="font-mono text-[10px]">{r.sku}</span> },
    { key: 'name', label: 'Product', searchable: true, sortable: true, sortType: 'string' },
    { key: 'qty', label: 'Units', sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
    { key: 'revenue', label: 'Revenue', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'hpp', label: 'COGS', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'grossProfit', label: 'Gross Profit', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'marginPct', label: 'Margin %', sortable: true, sortType: 'number', align: 'right',
      render: r => <span style={{ color: !r.hasCost ? '#E07B39' : r.marginPct >= 50 ? '#16a34a' : r.marginPct >= 20 ? '#f59e0b' : '#dc3545' }} className="font-semibold">{r.marginPct}%</span> },
    { key: 'hasCost', label: 'COGS data', filter: 'select', sortable: true, filterFormat: v => (v ? 'Covered' : 'Uncovered'),
      render: r => r.hasCost ? <span className="text-[9px] text-green-600 font-semibold uppercase">covered</span>
        : <span className="text-[9px] uppercase px-1 rounded bg-orange/15 text-orange font-semibold" title="No hargaCogs → HPP counted as 0 → margin inflated to 100%">uncovered</span> },
  ], [])

  // ── Empty / no-OrderItem state ──
  if (!loading && !hasData) {
    return (
      <CompactPage>
        <CompactTopbar title="Gross Margin" icon="fa-coins" />
        <div className="flex flex-col items-center justify-center text-center gap-2 py-20 text-dark1/50">
          <i className="fas fa-receipt text-3xl text-dark1/20" />
          <div className="text-sm font-semibold text-dark1/70">No SKU-level margin data for this tenant</div>
          <div className="text-xs max-w-md">{ov?.note || 'Gross margin needs OrderItem + HPP (Cleora / tenant 2 in dev). Other tenants have no line-item data yet.'}</div>
        </div>
      </CompactPage>
    )
  }

  return (
    <CompactPage>
      <CompactTopbar title="Gross Margin" icon="fa-coins"
        actions={<>
          <button onClick={() => setShowCalc(true)} className="sv-tbtn sv-tbtn-dark"><i className="fas fa-calculator" /> + Field</button>
          <button onClick={() => download(`gross-margin-${month || 'all'}.csv`, toCsv(products), 'text/csv')} className="sv-tbtn sv-tbtn-ghost"><i className="fas fa-file-csv" /> CSV</button>
        </>}>
        <span className="text-xs text-dark1/60 ml-1">Period</span>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2">
          <option value="">All data</option>
          {monthOpts.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </CompactTopbar>

      {/* Honest note — GROSS not NET; coverage caveat */}
      <div className="flex items-start gap-2 rounded-lg border border-cream bg-bg/60 px-3 py-2 text-[11px] text-dark1/80">
        <i className="fas fa-circle-info text-dark2 mt-0.5" />
        <span>
          <b>Gross margin</b> (revenue − COGS/HPP). This is <b>NOT net profit</b> — operating costs, fees, taxes &amp; marketing spend are <b>not deducted</b> (net P&amp;L planned, Wave 3).
          {' '}HPP coverage <b>{ov?.coveragePct ?? '—'}%</b> — uncovered SKUs show inflated 100% margin, so trust the <b>covered margin ({ov?.coveredMarginPct ?? '—'}%)</b>.
          {' '}Margin is SKU-level (Cleora / tenant 2). <span className="text-dark1/50">Profitability quadrant lives on <Link href="/sales" className="underline">/sales</Link> — not duplicated here.</span>
        </span>
      </div>

      <IconKpiStrip tiles={tiles} extraFields={extraTiles} />

      {/* Waterfall + Pareto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title="Gross margin waterfall" icon="fa-chart-column"
          headerRight={ov ? <span className="text-[9px] text-dark1/45">margin {ov.grossMarginPct}% · coverage {ov.coveragePct}%</span> : null} bodyClass="p-2">
          {loading ? <div style={{ height: 300 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : <>
                <MarginWaterfall revenue={ov.totalRevenue} hpp={ov.totalHpp} grossProfit={ov.grossProfit}
                  marketing={wf?.marketingSpendContext?.amount ?? 0} marketingOverlaps={wf?.marketingSpendContext?.overlaps} height={300} />
                <div className="text-[10px] text-dark1/45 mt-1"><i className="fas fa-circle-info" /> {wf?.marketingSpendContext?.note}</div>
              </>}
        </CompactPanel>

        <CompactPanel title="Margin Pareto — by gross profit" icon="fa-ranking-star"
          headerRight={pareto ? <span className="text-[9px] text-green-600 font-semibold">{pareto.top80Count}/{pareto.count} SKUs drive 80% of profit</span> : null} bodyClass="p-2">
          {loading ? <div style={{ height: 300 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : !pareto?.items?.length ? <div style={{ height: 300 }} className="flex items-center justify-center text-dark1/30 text-xs">No gross-profit data.</div>
            : <MarginParetoChart items={pareto.items} height={300} onSelect={openDetail} />}
        </CompactPanel>
      </div>

      {/* Trend */}
      <CompactPanel title="Margin trend — revenue · COGS · gross profit · margin %" icon="fa-chart-line"
        headerRight={trend?.range ? <span className="text-[9px] text-dark1/45">{trend.range.min} → {trend.range.max}</span> : null} bodyClass="p-2">
        {loading ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : !trend?.points?.length ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">No trend data.</div>
          : <>
              <MarginTrendChart points={trend.points} height={280} />
              {trend.note && <div className="text-[10px] text-orange/90 mt-1"><i className="fas fa-triangle-exclamation" /> {trend.note}</div>}
            </>}
      </CompactPanel>

      {/* Product table */}
      <CompactPanel title={`Margin by product — ${products.length} SKUs`} icon="fa-table"
        headerRight={ov ? <span className="text-[9px] text-dark1/45">{ov.uncoveredSkuCount} uncovered (0 HPP → inflated)</span> : null} bodyClass="p-2">
        <DataGrid data={products} columns={columns} searchable onRowClick={r => openDetail(r.sku)}
          defaultSort={{ key: 'grossProfit', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No products with sales." extraFields={extraColumns} />
        <p className="text-[10px] text-dark1/40 mt-1"><span className="text-orange">Uncovered</span> SKUs have no hargaCogs → HPP=0 → 100% margin (overstated). GROSS only — not net. Click a row for detail.</p>
      </CompactPanel>

      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} />}
      <CalculatedFieldModal isOpen={showCalc} onClose={() => setShowCalc(false)} module={MODULE}
        manifest={manifest} sampleValues={overviewValues} sampleLabel="overview totals" onSaved={reloadCalc} />
      <AnalyticsAIPanel module="gross-margin" context={data}
        suggestions={['Which SKUs drive most of the gross profit?', 'Is the blended margin trustworthy given HPP coverage?']} />
    </CompactPage>
  )
}
