'use client'
// CLV — Customer Lifetime Value (Analytics, Wave 3 §3.1). MIXED real/dummy: HISTORIC value
// is REAL (Σ non-cancelled order revenue per customer, reusing RFM identity), the forward
// PROJECTION is DUMMY (stated assumptions — no repeat history for a real one). Honesty
// posture #1: prominent orange projection banner; historic value plain. Forms = distribution
// + percentile bands (NOT a quadrant). All logic in the engine via /api/analytics/clv.
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Bar } from 'react-chartjs-2'
import Link from 'next/link'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import Modal from '@/components/ui/Modal'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import { seriesColor, withAlpha, baseOptions, mergeOptions } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

const REAL_COLOR = '#3F4E4F'    // slate — REAL historic value
const DUMMY_COLOR = '#E07B39'   // orange — DUMMY projection
const TIER_COLORS = { High: '#22c55e', 'Mid-High': '#6B8E9E', 'Mid-Low': '#C9A66B', Low: '#8B5E3C' }
const TIERS = ['All', 'High', 'Mid-High', 'Mid-Low', 'Low']
const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return 'Rp' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return 'Rp' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return 'Rp' + (n / 1e3).toFixed(0) + 'K'; return 'Rp' + Math.round(n) }
const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

function DummyBadge() {
  return <span className="text-[8px] uppercase tracking-wide px-1 rounded bg-orange/15 text-orange font-semibold align-middle" title="Fabricated projection — assumption-based, not a real prediction">dummy</span>
}

// Detail modal: REAL block (slate) clearly separated from the DUMMY projection block (orange).
function ClvDetailModal({ detail, onClose }) {
  if (!detail) return null
  const r = detail.real, pr = detail.projection
  return (
    <Modal isOpen onClose={onClose} size="max-w-2xl" title={<span>{detail.name} <span className="text-[10px] font-normal text-dark1/45">@{detail.username}</span></span>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border-2 p-3" style={{ borderColor: `${REAL_COLOR}55`, background: `${REAL_COLOR}08` }}>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold" style={{ color: REAL_COLOR }}><i className="fas fa-circle-check" /> REAL — historic value &amp; orders</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[['Historic value', formatCurrency(r.historicValue)], ['Orders', formatNumber(r.frequency)], ['Avg order', formatCurrency(r.avgOrderValue)], ['First → Last', `${r.firstOrder ?? '—'} → ${r.lastOrder ?? '—'}`]].map(([k, v]) => (
              <div key={k} className="bg-white rounded p-2 border border-cream"><div className="text-dark1/45 text-[10px]">{k}</div><div className="font-semibold text-dark1 truncate" title={String(v)}>{v}</div></div>
            ))}
          </div>
          {r.orders?.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead><tr className="text-dark1/45 text-left border-b border-cream"><th className="py-1">Date</th><th>Platform</th><th>Order</th><th className="text-right">GMV</th><th>Status</th></tr></thead>
                <tbody>{r.orders.map((o, i) => (
                  <tr key={i} className="border-b border-cream/40"><td className="py-1">{o.date}</td><td>{o.platform ?? '—'}</td><td className="font-mono text-[10px]">{o.orderId ?? '—'}</td><td className="text-right">{formatCurrency(o.gmv)}</td><td>{o.status}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
        <div className="rounded-lg border-2 p-3" style={{ borderColor: `${DUMMY_COLOR}66`, background: `${DUMMY_COLOR}0d` }}>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold" style={{ color: DUMMY_COLOR }}><i className="fas fa-triangle-exclamation" /> DUMMY — forward projection <DummyBadge /></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white rounded p-2 border border-orange/20"><div className="text-dark1/45 text-[10px]">Projected future value</div><div className="font-semibold text-dark1">{formatCurrency(pr.projectedFutureValue)}</div></div>
            <div className="bg-white rounded p-2 border border-orange/20"><div className="text-dark1/45 text-[10px]">Projected CLV (historic + projection)</div><div className="font-semibold text-dark1">{formatCurrency(pr.projectedClv)}</div></div>
          </div>
          <div className="text-[10px] text-orange/90 mt-2"><i className="fas fa-triangle-exclamation" /> {pr.assumption}</div>
        </div>
      </div>
    </Modal>
  )
}

export default function ClvPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState('All')
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchJson('/api/analytics/clv?view=overview').then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const openDetail = useCallback((username) => {
    fetchJson(`/api/analytics/clv?view=detail&username=${encodeURIComponent(username)}`).then(d => d && setDetail(d))
  }, [])

  const ov = data?.overview
  const hasData = ov?.hasData
  const dist = data?.distribution
  const tiers = data?.tiers?.tiers ?? []
  const allCustomers = data?.customers?.items ?? []
  const customers = useMemo(() => tier === 'All' ? allCustomers : allCustomers.filter(c => c.tier === tier), [allCustomers, tier])

  const distData = dist?.buckets?.length ? {
    labels: dist.buckets.map(b => b.label),
    datasets: [{ label: 'Customers', data: dist.buckets.map(b => b.count), backgroundColor: withAlpha(REAL_COLOR, 0.75), borderColor: REAL_COLOR, borderWidth: 1 }],
  } : null
  const distOpts = mergeOptions(baseOptions, {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${formatNumber(c.parsed.y)} customers`, title: i => `Historic value ${i[0]?.label}` } } },
    scales: { x: { ticks: { font: { size: 8 }, maxRotation: 40, minRotation: 20 } }, y: { beginAtZero: true, ticks: { font: { size: 9 } }, title: { display: true, text: 'Customers', font: { size: 9 } } } },
  })

  const tiles = [
    { icon: 'fa-coins', bg: REAL_COLOR, label: 'Total Historic Value', value: shortRp(ov?.totalHistoricValue) },
    { icon: 'fa-crystal-ball', bg: DUMMY_COLOR, label: 'Projected CLV (total)', value: shortRp(ov?.projection?.totalProjectedClv), dev: true },
    { icon: 'fa-users', bg: '#2C3639', label: 'Customers', value: formatNumber(ov?.customerCount ?? 0) },
    { icon: 'fa-scale-balanced', bg: '#6B8E9E', label: 'Avg Historic', value: shortRp(ov?.avgHistoricValue) },
    { icon: 'fa-rotate-right', bg: '#A9C5A0', iconColor: '#2C3639', label: 'Repeat Customers', value: formatNumber(ov?.repeatCustomers ?? 0) },
    { icon: 'fa-shield-halved', bg: '#8B5E3C', label: 'Coverage', value: ov?.coveragePct != null ? `${ov.coveragePct}%` : '—' },
  ]

  const columns = useMemo(() => [
    { key: 'name', label: 'Customer', searchable: true, sortable: true, sortType: 'string' },
    { key: 'username', label: 'Username', searchable: true, sortable: true, render: c => <span className="font-mono text-[10px]">@{c.username}</span> },
    { key: 'frequency', label: 'Orders', sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
    { key: 'historicValue', label: 'Historic · REAL', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'avgOrderValue', label: 'Avg Order', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'tier', label: 'Tier', filter: 'select', sortable: true, render: c => <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${TIER_COLORS[c.tier]}22`, color: TIER_COLORS[c.tier] }}>{c.tier}</span> },
    { key: 'projectedClv', label: 'Projected CLV · DUMMY', sortable: true, sortType: 'number', align: 'right',
      render: c => <span style={{ color: DUMMY_COLOR }}>{formatCurrency(c.projectedClv)} <DummyBadge /></span> },
  ], [])

  // ── Empty / new-tenant ──
  if (!loading && !hasData) {
    return (
      <CompactPage>
        <CompactTopbar title="CLV" icon="fa-coins" />
        <div className="flex flex-col items-center justify-center text-center gap-2 py-20 text-dark1/50">
          <i className="fas fa-user-slash text-3xl text-dark1/20" />
          <div className="text-sm font-semibold text-dark1/70">No customer-identified orders for this tenant</div>
          <div className="text-xs max-w-md">{ov?.note || 'CLV needs orders carrying customer_username (Cleora / tenant 2 in dev).'}</div>
        </div>
      </CompactPage>
    )
  }

  return (
    <CompactPage>
      <CompactTopbar title="CLV" icon="fa-coins">
        <span className="text-[10px] text-dark1/45">historic value real · projection dummy</span>
      </CompactTopbar>

      {/* PROMINENT DUMMY BANNER (posture #1) — the projection is fabricated */}
      <div className="flex items-start gap-2 rounded-lg border border-orange/40 bg-orange/10 px-3 py-2 text-[11px] text-dark1">
        <i className="fas fa-triangle-exclamation text-orange mt-0.5" />
        <span>
          <b style={{ color: REAL_COLOR }}>Historic value is REAL</b> (Σ non-cancelled order revenue per customer). The <b style={{ color: DUMMY_COLOR }}>forward PROJECTION is DUMMY</b> — fabricated from stated assumptions
          ({ov?.projection?.assumedFutureOrders ?? 3} assumed future orders × {ov?.projection?.assumedRetention ?? 0.5} assumed retention), because there isn&apos;t enough repeat history for a real projection. <b>Projected CLV is not a real prediction</b>; it becomes real as repeat history accrues (shared with RFM).
          <span className="text-dark1/55"> {ov?.coverageNote}</span>
        </span>
      </div>

      <IconKpiStrip tiles={tiles} />

      {/* Distribution + percentile tiers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title="Historic value distribution (real)" icon="fa-chart-column"
          headerRight={dist?.cap ? <span className="text-[9px] text-dark1/45">spread across {ov?.customerCount} customers · &gt;{shortRp(dist.cap)} overflow</span> : null} bodyClass="p-2">
          {loading ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : !distData ? <div style={{ height: 280 }} className="flex items-center justify-center text-dark1/30 text-xs">No customer value data.</div>
            : <div style={{ height: 280 }}><Bar data={distData} options={distOpts} /></div>}
        </CompactPanel>

        <CompactPanel title="Value tiers — percentile bands (real)" icon="fa-layer-group" bodyClass="p-2"
          headerRight={<span className="text-[9px] text-dark1/45">quartiles by historic value</span>}>
          <div className="grid grid-cols-2 gap-2">
            {tiers.map(t => (
              <button key={t.tier} onClick={() => setTier(tier === t.tier ? 'All' : t.tier)}
                className={`text-left rounded-lg border p-2 transition ${tier === t.tier ? 'border-dark2' : 'border-cream hover:border-dark2/50'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: TIER_COLORS[t.tier] }}>{t.tier}</span>
                  <span className="text-[10px] text-dark1/50">{t.count} cust.</span>
                </div>
                <div className="text-[11px] text-dark1 mt-0.5">{formatCurrency(t.totalHistoricValue)} <span className="text-dark1/40">({t.historicSharePct}%)</span></div>
                <div className="h-1.5 bg-dark1/8 rounded-full overflow-hidden mt-1"><div className="h-full rounded-full" style={{ width: `${Math.min(100, t.historicSharePct)}%`, background: TIER_COLORS[t.tier] }} /></div>
                <div className="text-[10px] mt-1" style={{ color: DUMMY_COLOR }}>proj. {shortRp(t.totalProjectedClv)} <DummyBadge /></div>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-dark1/40 mt-1">Tiers + per-tier historic value are <b>real</b>; the per-tier <span style={{ color: DUMMY_COLOR }}>projected CLV</span> is dummy. Click a tier to filter the table.</p>
        </CompactPanel>
      </div>

      {/* Customer table */}
      <CompactPanel title={`Customers — ${customers.length}${tier !== 'All' ? ` (${tier} tier)` : ''}`} icon="fa-table"
        headerRight={<div className="flex gap-0.5 bg-bg rounded p-0.5">{TIERS.map(t => (
          <button key={t} onClick={() => setTier(t)} className={`text-[10px] px-1.5 py-0.5 rounded ${tier === t ? 'bg-dark1 text-white' : 'text-dark1/50 hover:text-dark1'}`}>{t}</button>
        ))}</div>} bodyClass="p-2">
        <DataGrid data={customers} columns={columns} searchable onRowClick={c => openDetail(c.username)}
          defaultSort={{ key: 'historicValue', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No customers in this tier." />
        <p className="text-[10px] text-dark1/40 mt-1"><span style={{ color: REAL_COLOR }}>Historic value</span> is real; <span style={{ color: DUMMY_COLOR }}>Projected CLV</span> is a fabricated assumption-based projection. Click a row for the real/dummy breakdown. Profitability/segments live on <Link href="/analytics/rfm" className="underline">RFM</Link>.</p>
      </CompactPanel>

      {detail && <ClvDetailModal detail={detail} onClose={() => setDetail(null)} />}
      <AnalyticsAIPanel module="clv" context={data}
        suggestions={['Is this CLV projection real?', 'Which customers are highest value (historic)?']} />
    </CompactPage>
  )
}
