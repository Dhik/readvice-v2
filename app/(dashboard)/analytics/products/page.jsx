'use client'
import { useEffect, useState } from 'react'
import TwoPanelLayout from '@/components/layout/TwoPanelLayout'
import ChartPanel from '@/components/charts/ChartPanel'
import { Chart } from 'react-chartjs-2'
import DateRangePicker from '@/components/ui/DateRangePicker'
import DataGrid from '@/components/table/DataGrid'
import { seriesColor, withAlpha, SEMANTIC, baseOptions, mergeOptions } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

// Compact IDR for bar datalabels (full value lives in the tooltip).
const shortRp = (v) => {
  const n = Number(v) || 0
  if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return 'Rp ' + (n / 1e3).toFixed(0) + 'K'
  return 'Rp ' + n
}

// Per-SKU table columns (sort/search/filter handled by DataGrid).
const PRODUCT_COLUMNS = [
  { key: 'sku', label: 'SKU', sortable: true, searchable: true, sortType: 'string',
    render: p => <span className="font-mono text-[11px]">{p.sku}</span> },
  { key: 'name', label: 'Product', sortable: true, searchable: true, sortType: 'string',
    render: p => (
      <>
        {p.name}
        {!p.inCatalog && (
          <span className="ml-1.5 text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-orange/10 text-orange align-middle"
            title="Sold but not found in the product catalog">not in catalog</span>
        )}
      </>
    ) },
  { key: 'qty',        label: 'Qty',       sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
  { key: 'revenue',    label: 'Revenue',   sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
  { key: 'orderCount', label: 'Orders',    sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
  { key: 'avgPrice',   label: 'Avg Price', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
  { key: 'revenuePct', label: 'Rev %',     sortable: true, sortType: 'number', align: 'right', format: v => `${v}%` },
  { key: 'inCatalog',  label: 'Catalog',   filter: 'select',
    filterFormat: v => (v === true || v === 'true') ? 'In catalog' : 'Not in catalog',
    render: p => p.inCatalog
      ? <span className="text-dark1/50 text-xs">In catalog</span>
      : <span className="text-orange text-xs">Not in catalog</span> },
]

export default function ProductAnalysisPage() {
  const [platform, setPlatform]   = useState('')   // '' = All
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)

  const rangeActive = Boolean(startDate && endDate)

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (platform) p.set('platform', platform)
    if (rangeActive) { p.set('startDate', startDate); p.set('endDate', endDate) }
    fetch(`/api/analytics/products?${p.toString()}`)
      .then(r => r.json())
      .then(d => { setData(d?.error ? null : d); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [platform, startDate, endDate])

  const products = data?.products ?? []
  const k = data?.kpis
  const hasData = products.length > 0

  const platforms = ['All', ...(data?.availablePlatforms ?? [])]

  const kpiTiles = [
    { label: 'Products Sold', value: formatNumber(k?.distinctProducts ?? 0) },
    { label: 'Units Sold',    value: formatNumber(k?.totalUnits ?? 0) },
    { label: 'Product Revenue', value: formatCurrency(k?.totalRevenue ?? 0) },
    { label: 'Best Seller',   value: k?.bestSeller ? k.bestSeller.name : '—',
      sub: k?.bestSeller ? formatCurrency(k.bestSeller.revenue) : undefined },
  ]

  // Chart: top 10 by revenue (products already revenue-sorted) → bar.
  const top10 = products.slice(0, 10)
  const lineData = hasData ? {
    labels: top10.map(p => p.name),
    datasets: [{
      label: 'Revenue',
      data: top10.map(p => p.revenue),
      borderColor: seriesColor(0),
      backgroundColor: withAlpha(seriesColor(0), 0.1),
      fill: true, tension: 0.4,
    }],
  } : null

  // Donut: revenue contribution % — top 8 + "Others". `donutMeta` is a parallel
  // array (name/revenue/pct per slice) the tooltip indexes by dataIndex.
  const donutBuild = hasData ? (() => {
    const top  = products.slice(0, 8)
    const rest = products.slice(8)
    const restPct = rest.reduce((a, p) => a + p.revenuePct, 0)
    const restRev = rest.reduce((a, p) => a + p.revenue, 0)
    const labels = top.map(p => p.name)
    const vals   = top.map(p => p.revenuePct)
    const meta   = top.map(p => ({ name: p.name, revenue: p.revenue, pct: p.revenuePct }))
    if (restPct > 0) {
      labels.push('Others'); vals.push(Math.round(restPct * 10) / 10)
      meta.push({ name: 'Others', revenue: Math.round(restRev * 100) / 100, pct: Math.round(restPct * 10) / 10 })
    }
    return { data: { labels, datasets: [{ data: vals, backgroundColor: labels.map((_, i) => seriesColor(i)) }] }, meta }
  })() : null
  const donutData = donutBuild?.data ?? null
  const donutMeta = donutBuild?.meta ?? []

  // ── Richer tooltips + selective datalabels (Fase 2b) ──
  // Top-10 bar: revenue + contribution% + qty + #orders (from top10, by dataIndex).
  // Datalabels (revenue, compact) only in BAR view — hidden on the line view.
  const barOptions = hasData ? {
    plugins: {
      tooltip: {
        callbacks: {
          title: items => top10[items[0]?.dataIndex]?.name ?? '',
          label: ctx => {
            const p = top10[ctx.dataIndex]
            if (!p) return ''
            return [
              `Revenue: ${formatCurrency(p.revenue)}`,
              `Contribution: ${p.revenuePct}%`,
              `Qty: ${formatNumber(p.qty)}`,
              `Orders: ${formatNumber(p.orderCount)}`,
            ]
          },
        },
      },
      datalabels: {
        display: ctx => ctx.chart?.config?.type === 'bar',
        anchor: 'end', align: 'end', offset: 2,
        color: '#2C3639', font: { size: 9, weight: '600' },
        formatter: v => shortRp(v),
      },
    },
  } : undefined

  // Donut: product name (title, default) + revenue + % of total.
  const donutOptions = hasData ? {
    plugins: {
      tooltip: {
        callbacks: {
          label: ctx => {
            const m = donutMeta[ctx.dataIndex]
            return m ? ` ${formatCurrency(m.revenue)} (${m.pct}%)` : ''
          },
        },
      },
    },
  } : undefined

  const topbar = (
    <div className="sv-filter-bar">
      <div className="flex gap-1 tab-pills">
        {platforms.map(p => (
          <button key={p} onClick={() => setPlatform(p === 'All' ? '' : p)}
            className={`tab-pill ${(p === 'All' ? '' : p) === platform ? 'active' : ''}`}>{p}</button>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-auto flex-wrap">
        <DateRangePicker label="Range" startDate={startDate} endDate={endDate}
          onStartChange={setStartDate} onEndChange={setEndDate} />
        {rangeActive && (
          <button onClick={() => { setStartDate(''); setEndDate('') }}
            className="text-xs text-orange hover:underline">Clear range</button>
        )}
      </div>
    </div>
  )

  const tablePanel = (
    <div>
      {data?.unmatchedCount > 0 && (
        <div className="mb-2 text-[11px] text-dark1/40">
          {data.unmatchedCount} sold but not in catalog
        </div>
      )}
      <DataGrid
        data={products}
        columns={PRODUCT_COLUMNS}
        searchable
        defaultSort={{ key: 'revenue', dir: 'desc' }}
        pageSize={25}
        loading={loading}
        emptyText="No products sold in this period."
      />
    </div>
  )

  const chartPanel = (
    <ChartPanel lineData={lineData} donutData={donutData} defaultView="bar"
      lineOptions={barOptions} donutOptions={donutOptions} />
  )

  const windowLabel = data?.filters ? `${data.filters.startDate} → ${data.filters.endDate}` : ''

  // ── Revenue Pareto (Fase 2c): bars = revenue (desc) + cumulative-% line + 80%
  // ref. Answers "how few SKUs make 80% of revenue" — which neither the top-10 bar
  // nor the donut shows. Dual-axis: left = Revenue (IDR), right = Cumulative % (0–100),
  // grid on the LEFT axis only so the right axis can't mislead. Uses existing data.
  const pareto = hasData ? (() => {
    const sorted = [...products].sort((a, b) => b.revenue - a.revenue)
    const total  = sorted.reduce((s, p) => s + p.revenue, 0) || 1
    let run = 0
    const cumPct = sorted.map(p => { run += p.revenue; return Math.round((run / total) * 1000) / 10 })
    return {
      sorted, cumPct,
      data: {
        labels: sorted.map(p => p.name),
        datasets: [
          { type: 'bar',  label: 'Revenue', data: sorted.map(p => p.revenue), yAxisID: 'y', order: 3,
            backgroundColor: withAlpha(seriesColor(0), 0.85), borderColor: seriesColor(0) },
          { type: 'line', label: 'Cumulative %', data: cumPct, yAxisID: 'y1', order: 1,
            borderColor: seriesColor(1), backgroundColor: seriesColor(1), tension: 0.2, pointRadius: 2, fill: false },
          { type: 'line', label: '80% line', data: sorted.map(() => 80), yAxisID: 'y1', order: 2,
            borderColor: SEMANTIC.warning, borderDash: [5, 4], borderWidth: 1, pointRadius: 0, fill: false },
        ],
      },
    }
  })() : null

  const paretoOptions = pareto ? mergeOptions(baseOptions, {
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
      datalabels: { display: false },
      tooltip: {
        filter: item => item.datasetIndex === 0, // single block per SKU
        callbacks: {
          title: items => pareto.sorted[items[0]?.dataIndex]?.name ?? '',
          label: ctx => {
            const p = pareto.sorted[ctx.dataIndex]
            return p ? [`Revenue: ${formatCurrency(p.revenue)}`, `Cumulative: ${pareto.cumPct[ctx.dataIndex]}%`] : ''
          },
        },
      },
    },
    scales: {
      x:  { ticks: { autoSkip: true, maxRotation: 60, font: { size: 9 } } },
      y:  { type: 'linear', position: 'left', title: { display: true, text: 'Revenue (IDR)' },
            grid: { drawOnChartArea: true }, ticks: { callback: v => shortRp(v) } },
      y1: { type: 'linear', position: 'right', min: 0, max: 100, title: { display: true, text: 'Cumulative %' },
            grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } },
    },
  }) : undefined

  return (
    <>
      <TwoPanelLayout
        topbar={topbar}
        kpis={kpiTiles}
        tableTitle={`Products${products.length ? ` — ${products.length}` : ''}${windowLabel ? `  ·  ${windowLabel}` : ''}`}
        tablePanel={tablePanel}
        chartTitle="Top 10 by Revenue"
        chartPanel={chartPanel}
      />
      {/* Pareto card — flows below the one-screen layout (main scrolls; sv-page
          override height:auto so it isn't clipped by sv-page's fixed-height). */}
      <div className="sv-page" style={{ height: 'auto', overflow: 'visible' }}>
        <div className="sv-chart-panel">
          <div className="sv-panel-header flex items-center gap-2">
            <span>Revenue Pareto — the 80/20 of products</span>
            <span className="ml-auto text-[10px] text-dark1/40">bars = revenue (left) · line = cumulative % (right) · dashed = 80%</span>
          </div>
          <div className="sv-panel-body">
            {pareto
              ? <div style={{ height: 320 }}><Chart type="bar" data={pareto.data} options={paretoOptions} /></div>
              : <div className="py-10 text-center text-dark1/40 text-sm">No products sold in this period.</div>}
          </div>
        </div>
      </div>
    </>
  )
}
