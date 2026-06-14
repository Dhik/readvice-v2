'use client'
// Market Basket — deep analysis (Analytics). Wave 2 §2.4 (last Wave-2 module). REAL
// co-purchase data, SMALL-SAMPLE (honest note, not a dummy banner). TWO visual forms:
// force-directed NETWORK GRAPH (d3-force) + SKU×SKU affinity MATRIX HEATMAP. n=1
// co-occurrences visually distinguished everywhere. All logic in the engine via /api/analytics/basket.
import { useEffect, useMemo, useState, useCallback } from 'react'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import BasketNetwork from '@/components/basket/BasketNetwork'
import AffinityMatrix from '@/components/basket/AffinityMatrix'
import { formatNumber, formatCurrency } from '@/lib/utils'

const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

function toCsv(pairs) {
  const cols = [['a', 'SKU_A'], ['b', 'SKU_B'], ['cooccur', 'CoOccur'], ['supportPct', 'Support%'], ['confidenceAtoB', 'ConfAtoB%'], ['confidenceBtoA', 'ConfBtoA%'], ['lift', 'Lift']]
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.map(c => c[1]).join(','), ...pairs.map(r => cols.map(c => esc(r[c[0]])).join(','))].join('\n')
}
function download(name, content, type) {
  const blob = new Blob([content], { type }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const N1Badge = () => <span className="ml-1 text-[8px] uppercase tracking-wide px-1 rounded bg-orange/15 text-orange font-semibold" title="Single co-occurrence — weak signal">n=1</span>

export default function BasketPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedSku, setSelectedSku] = useState('')
  const [affinity, setAffinity] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchJson('/api/analytics/basket?view=overview').then(d => {
      if (!alive) return
      setData(d); setLoading(false)
      const def = d?.overview?.topPair?.a || d?.pairs?.nodes?.[0]?.sku
      if (def) setSelectedSku(def)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!selectedSku) return
    let alive = true
    fetchJson(`/api/analytics/basket?view=affinity&sku=${encodeURIComponent(selectedSku)}`).then(d => { if (alive) setAffinity(d) })
    return () => { alive = false }
  }, [selectedSku])

  const ov = data?.overview
  const hasData = ov?.hasData
  const pairs = data?.pairs?.pairs ?? []
  const nodes = data?.pairs?.nodes ?? []

  const tiles = useMemo(() => [
    { icon: 'fa-cart-shopping', bg: '#2C3639', label: 'Total Orders', value: formatNumber(ov?.totalOrders ?? 0) },
    { icon: 'fa-basket-shopping', bg: '#E07B39', label: 'Multi-item Orders', value: formatNumber(ov?.multiItemOrderCount ?? 0) },
    { icon: 'fa-link', bg: '#6B8E9E', label: 'Co-purchase Pairs', value: formatNumber(ov?.distinctPairs ?? 0) },
    { icon: 'fa-diagram-project', bg: '#8B5E3C', label: 'SKUs in Pairs', value: formatNumber(nodes.length) },
    { icon: 'fa-arrow-up-right-dots', bg: '#A9C5A0', iconColor: '#2C3639', label: 'Top Pair Lift', value: ov?.topPair ? `${ov.topPair.lift}× (n=${ov.topPair.cooccur})` : '—' },
  ], [ov, nodes.length])

  const columns = useMemo(() => [
    { key: 'a', label: 'SKU A', searchable: true, sortable: true, render: r => <span className="font-mono text-[10px]">{r.a}</span> },
    { key: 'b', label: 'SKU B', searchable: true, sortable: true, render: r => <span className="font-mono text-[10px]">{r.b}</span> },
    { key: 'cooccur', label: 'Co-occur', sortable: true, sortType: 'number', align: 'right',
      render: r => <span>{r.cooccur}{r.cooccur === 1 ? <N1Badge /> : null}</span> },
    { key: 'supportPct', label: 'Support%', sortable: true, sortType: 'number', align: 'right', format: v => `${v}%` },
    { key: 'confidenceAtoB', label: 'Conf A→B', sortable: true, sortType: 'number', align: 'right', format: v => `${v}%` },
    { key: 'confidenceBtoA', label: 'Conf B→A', sortable: true, sortType: 'number', align: 'right', format: v => `${v}%` },
    { key: 'lift', label: 'Lift', sortable: true, sortType: 'number', align: 'right',
      render: r => <span className="font-semibold" style={{ color: r.cooccur === 1 ? '#E07B39' : '#16a34a' }}>{r.lift}×</span> },
  ], [])

  if (!loading && !hasData) {
    return (
      <CompactPage>
        <CompactTopbar title="Market Basket" icon="fa-diagram-project" />
        <div className="flex flex-col items-center justify-center text-center gap-2 py-20 text-dark1/50">
          <i className="fas fa-diagram-project text-3xl text-dark1/20" />
          <div className="text-sm font-semibold text-dark1/70">Requires order-item data — Cleora only for now</div>
          <div className="text-xs max-w-md">Market basket analysis needs SKU-level OrderItem data, which exists only for tenant 2 in dev.</div>
        </div>
      </CompactPage>
    )
  }

  return (
    <CompactPage>
      <CompactTopbar title="Market Basket" icon="fa-diagram-project"
        actions={<button onClick={() => download('basket-pairs.csv', toCsv(pairs), 'text/csv')} className="sv-tbtn sv-tbtn-ghost"><i className="fas fa-file-csv" /> CSV</button>}>
        <span className="text-[10px] text-dark1/45">Cumulative · cross-product lens</span>
      </CompactTopbar>

      {/* Honest note — REAL data, SMALL-SAMPLE (not a dummy banner) */}
      <div className="flex items-start gap-2 rounded-lg border border-cream bg-bg/60 px-3 py-2 text-[11px] text-dark1/80">
        <i className="fas fa-circle-info text-dark2 mt-0.5" />
        <span>
          Market basket from <b>real co-purchase data</b> (Cleora / tenant 2 only). Of <b>{formatNumber(ov?.totalOrders ?? 0)} orders</b>, only
          <b style={{ color: '#E07B39' }}> {formatNumber(ov?.multiItemOrderCount ?? 0)} contain multiple products</b> — the basis for these pairs.
          {ov?.smallSample && <> With such a small sample, high lift values (e.g. {ov?.topPair?.lift}×) often come from a <b>single co-occurrence (n=1)</b> and should be read as <b>directional signals, not reliable statistics</b>.</>}
          {' '}Grows as order-item coverage expands. <span className="text-dark1/50">Dashed edges / faded cells / n=1 badges mark single co-occurrences.</span>
        </span>
      </div>

      <IconKpiStrip tiles={tiles} />

      {/* MAIN: force-directed network graph */}
      <CompactPanel title="Co-purchase network — force-directed" icon="fa-diagram-project"
        headerRight={<span className="text-[9px] text-dark1/45">node = SKU (size ∝ orders) · edge = co-occurrence (<span className="text-dark1/70">solid ≥2</span> / <span className="text-orange">dashed n=1</span>)</span>}
        bodyClass="p-2">
        {loading ? <div style={{ height: 480 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : !nodes.length ? <div style={{ height: 480 }} className="flex items-center justify-center text-dark1/30 text-xs">No co-purchase pairs.</div>
          : <BasketNetwork nodes={nodes} pairs={pairs} selectedSku={selectedSku} onSelectNode={setSelectedSku} height={480} />}
      </CompactPanel>

      {/* Affinity matrix + product affinity lookup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title="Affinity matrix — SKU × SKU" icon="fa-table-cells"
          headerRight={<span className="text-[9px] text-dark1/45">cell = lift (faded = n=1)</span>} bodyClass="p-2">
          {loading ? <div style={{ height: 400 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : <AffinityMatrix nodes={nodes} pairs={pairs} height={400} />}
        </CompactPanel>

        <CompactPanel title="Product affinity — bought X also bought…" icon="fa-arrows-left-right-to-line"
          headerRight={
            <select value={selectedSku} onChange={e => setSelectedSku(e.target.value)}
              className="border border-cream rounded text-[10px] px-1.5 py-0.5 h-6 bg-white text-dark1 max-w-[150px] focus:outline-none focus:border-dark2">
              <option value="">Select SKU…</option>
              {nodes.map(n => <option key={n.sku} value={n.sku}>{n.sku}</option>)}
            </select>}
          bodyClass="p-2">
          {!affinity ? <div className="text-dark1/30 text-xs text-center py-10">Select a SKU (or click a node).</div>
            : (
              <div>
                <div className="text-xs font-semibold text-dark1 mb-1 truncate" title={affinity.name}>{affinity.name} <span className="text-dark1/45 font-normal">({formatNumber(affinity.orders)} orders)</span></div>
                {affinity.partners.length === 0 ? <div className="text-[11px] text-dark1/45 italic py-6 text-center">No co-purchased partners for this SKU.</div> : (
                  <div className="space-y-1 max-h-[330px] overflow-y-auto">
                    {affinity.partners.map(pt => (
                      <button key={pt.sku} onClick={() => setSelectedSku(pt.sku)} className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-bg text-left">
                        <span className="min-w-0"><div className="text-[11px] font-medium text-dark1 truncate" title={pt.name}>{pt.name}</div><div className="text-[9px] text-dark1/45 font-mono">{pt.sku}</div></span>
                        <span className="text-right whitespace-nowrap text-[10px]">
                          <div className="font-semibold text-dark1">{pt.confidence}% conf</div>
                          <div className="text-dark1/55">lift {pt.lift}× · n={pt.cooccur}{pt.cooccur === 1 ? <N1Badge /> : null}</div>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
        </CompactPanel>
      </div>

      {/* Pairs DataGrid */}
      <CompactPanel title={`Co-purchase pairs — ${pairs.length}`} icon="fa-table"
        headerRight={<span className="text-[9px] text-dark1/45">click a row → highlight in network</span>} bodyClass="p-2">
        <DataGrid data={pairs} columns={columns} searchable onRowClick={r => setSelectedSku(r.a)}
          defaultSort={{ key: 'lift', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No co-purchase pairs." />
        <p className="text-[10px] text-dark1/40 mt-1">Ranked by lift. <span className="text-orange">n=1</span> pairs (single co-occurrence) are directional only. Lift = real, support/confidence = real — small sample. Click a row to highlight that SKU in the network above.</p>
      </CompactPanel>
    </CompactPage>
  )
}
