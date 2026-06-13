'use client'
import { useEffect, useState } from 'react'
import TwoPanelLayout from '@/components/layout/TwoPanelLayout'
import ChartPanel from '@/components/charts/ChartPanel'
import DateRangePicker from '@/components/ui/DateRangePicker'
import { formatCurrency, formatNumber } from '@/lib/utils'

const CHART_COLORS = ['#E07B39', '#2C3639', '#3F4E4F', '#8B5E3C', '#A9C5A0',
  '#C9A66B', '#6B8E9E', '#B5645B', '#7A8450', '#9E7BB5', '#999']

export default function ProductAnalysisPage() {
  const [platform, setPlatform]   = useState('')   // '' = All
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [sortBy, setSortBy]       = useState('revenue') // 'revenue' | 'qty'
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

  // Table rows sorted by the active metric (default revenue; data is revenue-sorted).
  const tableRows = sortBy === 'qty'
    ? [...products].sort((a, b) => b.qty - a.qty)
    : products

  // Chart: top 10 by revenue (products already revenue-sorted) → bar.
  const top10 = products.slice(0, 10)
  const lineData = hasData ? {
    labels: top10.map(p => p.name),
    datasets: [{
      label: 'Revenue',
      data: top10.map(p => p.revenue),
      borderColor: '#E07B39',
      backgroundColor: 'rgba(224,123,57,0.1)',
      fill: true, tension: 0.4,
    }],
  } : null

  // Donut: revenue contribution % — top 8 + "Others".
  const donutData = hasData ? (() => {
    const top = products.slice(0, 8)
    const restPct = products.slice(8).reduce((a, p) => a + p.revenuePct, 0)
    const labels = top.map(p => p.name)
    const vals   = top.map(p => p.revenuePct)
    if (restPct > 0) { labels.push('Others'); vals.push(Math.round(restPct * 10) / 10) }
    return { labels, datasets: [{ data: vals, backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]) }] }
  })() : null

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
      <div className="flex items-center gap-2 mb-2 text-xs">
        <span className="text-dark1/50">Sort by:</span>
        <button onClick={() => setSortBy('revenue')}
          className={`tab-pill ${sortBy === 'revenue' ? 'active' : ''}`}>Revenue</button>
        <button onClick={() => setSortBy('qty')}
          className={`tab-pill ${sortBy === 'qty' ? 'active' : ''}`}>Quantity</button>
        {data?.unmatchedCount > 0 && (
          <span className="ml-auto text-[11px] text-dark1/40">
            {data.unmatchedCount} sold but not in catalog
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-dark1/40 text-sm">Loading…</div>
      ) : !hasData ? (
        <div className="py-10 text-center text-dark1/40 text-sm">No products sold in this period.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="sv-table-clean w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-dark1/50 border-b border-dark1/10">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">SKU</th>
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2 text-right">Qty</th>
                <th className="py-2 pr-2 text-right">Revenue</th>
                <th className="py-2 pr-2 text-right">Orders</th>
                <th className="py-2 pr-2 text-right">Avg Price</th>
                <th className="py-2 pr-2 text-right">Rev %</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((p, i) => (
                <tr key={p.sku} className="border-b border-dark1/5">
                  <td className="py-1.5 pr-2 text-dark1/40">{i + 1}</td>
                  <td className="py-1.5 pr-2 font-mono text-[11px]">{p.sku}</td>
                  <td className="py-1.5 pr-2">
                    {p.name}
                    {!p.inCatalog && (
                      <span className="ml-1.5 text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-orange/10 text-orange align-middle"
                        title="Sold but not found in the product catalog">not in catalog</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right">{formatNumber(p.qty)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatCurrency(p.revenue)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatNumber(p.orderCount)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatCurrency(p.avgPrice)}</td>
                  <td className="py-1.5 pr-2 text-right">{p.revenuePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const chartPanel = (
    <ChartPanel lineData={lineData} donutData={donutData} defaultView="bar" />
  )

  const windowLabel = data?.filters ? `${data.filters.startDate} → ${data.filters.endDate}` : ''

  return (
    <TwoPanelLayout
      topbar={topbar}
      kpis={kpiTiles}
      tableTitle={`Products${products.length ? ` — ${products.length}` : ''}${windowLabel ? `  ·  ${windowLabel}` : ''}`}
      tablePanel={tablePanel}
      chartTitle="Top 10 by Revenue"
      chartPanel={chartPanel}
    />
  )
}
