'use client'
// True ROAS / Attribution (Analytics, Wave 3 §3.2). MIXED real÷dummy (the Talent-ROI shape):
// ad SPEND is REAL (the same Ads-Allocation tables); attributed REVENUE + ROAS are DUMMY —
// no order-level attribution link exists (P-1). Consistent slate=REAL / orange=DUMMY split:
// real spend plain/slate, dummy attribution/ROAS orange + dev badges + a prominent banner.
// Forms = spend×return quadrant + trend (mirrors Ads-Allocation, ADDS the revenue axis it
// honestly omits). All logic in the engine via /api/analytics/roas.
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Scatter, Line } from 'react-chartjs-2'
import Link from 'next/link'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import Modal from '@/components/ui/Modal'
import CrossLink from '@/components/dashboard/CrossLink'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import { withAlpha, baseOptions, mergeOptions, seriesColor } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

const REAL_COLOR = '#3F4E4F'    // slate — REAL spend
const DUMMY_COLOR = '#E07B39'   // orange — DUMMY attribution / ROAS
const QUAD_COLORS = { Scale: '#22c55e', Efficient: '#6B8E9E', Review: '#dc3545', Low: '#C9A66B' }
const QUAD_ORDER = ['Scale', 'Efficient', 'Review', 'Low']
const FILTERS = ['All', 'channel', 'category']
const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return 'Rp' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return 'Rp' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return 'Rp' + (n / 1e3).toFixed(0) + 'K'; return 'Rp' + Math.round(n) }
const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)
const DummyBadge = () => <span className="text-[8px] uppercase tracking-wide px-1 rounded bg-orange/15 text-orange font-semibold align-middle" title="Fabricated attribution — no order-level link (P-1)">dummy</span>

// Median dividers (afterDraw — chartArea/scales only, SSR-safe).
function dividerPlugin(xMed, yMed) {
  return { id: 'roasDiv', afterDraw(chart) {
    const { ctx, chartArea: a, scales } = chart
    if (!a || !scales?.x || !scales?.y) return
    ctx.save(); ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(44,54,57,0.3)'
    if (Number.isFinite(xMed)) { const px = scales.x.getPixelForValue(xMed); if (px >= a.left && px <= a.right) { ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke() } }
    if (Number.isFinite(yMed)) { const py = scales.y.getPixelForValue(yMed); if (py >= a.top && py <= a.bottom) { ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke() } }
    ctx.restore()
  } }
}

// Detail modal — slate REAL-spend block vs orange DUMMY-attribution block.
function RoasDetailModal({ detail, onClose }) {
  if (!detail) return null
  const r = detail.real, da = detail.dummyAttribution
  return (
    <Modal isOpen onClose={onClose} size="max-w-2xl" title={<span>{detail.key} <span className="text-[10px] font-normal text-dark1/45">{detail.source}</span></span>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border-2 p-3" style={{ borderColor: `${REAL_COLOR}55`, background: `${REAL_COLOR}08` }}>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold" style={{ color: REAL_COLOR }}><i className="fas fa-circle-check" /> REAL — ad spend</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[['Spend', formatCurrency(r.spend)], ['Rows', formatNumber(r.rows)], ['Share of source', `${r.sharePct}%`]].map(([k, v]) => (
              <div key={k} className="bg-white rounded p-2 border border-cream"><div className="text-dark1/45 text-[10px]">{k}</div><div className="font-semibold text-dark1">{v}</div></div>
            ))}
          </div>
          {r.trend?.length > 0 && <div className="text-[10px] text-dark1/50 mt-2">{r.days} day(s) of real spend{r.range ? ` · ${r.range.min} → ${r.range.max}` : ''}.</div>}
        </div>
        <div className="rounded-lg border-2 p-3" style={{ borderColor: `${DUMMY_COLOR}66`, background: `${DUMMY_COLOR}0d` }}>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold" style={{ color: DUMMY_COLOR }}><i className="fas fa-triangle-exclamation" /> DUMMY — attributed revenue &amp; ROAS <DummyBadge /></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white rounded p-2 border border-orange/20"><div className="text-dark1/45 text-[10px]">Attributed revenue</div><div className="font-semibold text-dark1">{formatCurrency(da.attributedRevenue)}</div></div>
            <div className="bg-white rounded p-2 border border-orange/20"><div className="text-dark1/45 text-[10px]">ROAS</div><div className="font-semibold text-dark1">{da.roas}×</div></div>
          </div>
          <div className="text-[10px] text-orange/90 mt-2"><i className="fas fa-triangle-exclamation" /> {da.assumption}</div>
        </div>
      </div>
    </Modal>
  )
}

export default function RoasPage() {
  const [month, setMonth] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const m = month ? `&month=${month}` : ''
    fetchJson(`/api/analytics/roas?view=overview${m}`).then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [month])

  const openDetail = useCallback((key, source) => {
    const m = month ? `&month=${month}` : ''
    fetchJson(`/api/analytics/roas?view=detail&key=${encodeURIComponent(key)}&source=${source}${m}`).then(d => d && setDetail(d))
  }, [month])

  const ov = data?.overview
  const hasData = ov?.hasData
  const scatter = data?.scatter
  const trend = data?.trend
  const allPoints = useMemo(() => scatter?.points ?? [], [scatter])
  const points = useMemo(() => filter === 'All' ? allPoints : allPoints.filter(p => p.source === filter), [allPoints, filter])

  const scatterData = {
    datasets: QUAD_ORDER.map(q => ({
      label: q,
      data: points.filter(p => p.quadrant === q).map(p => ({ x: p.x, y: p.y, _k: p.key, _src: p.source, _roas: p.roas })),
      backgroundColor: withAlpha(QUAD_COLORS[q], 0.6), borderColor: QUAD_COLORS[q], borderWidth: 1, pointRadius: 6, pointHoverRadius: 8,
    })),
  }
  const scatterOpts = mergeOptions(baseOptions, {
    onClick: (_e, els) => { if (els?.length) { const ds = scatterData.datasets[els[0].datasetIndex]; const pt = ds?.data[els[0].index]; if (pt?._k) openDetail(pt._k, pt._src) } },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 }, usePointStyle: true } },
      tooltip: { callbacks: { title: i => i[0]?.raw?._k || '', label: c => { const r = c.raw; return [`${r._src}`, `Spend (real): ${formatCurrency(r.x)}`, `Attributed (DUMMY): ${formatCurrency(r.y)}`, `ROAS: ${r._roas}× (dummy)`] } } },
    },
    scales: {
      x: { title: { display: true, text: 'Ad spend (REAL)', font: { size: 10 } }, ticks: { callback: v => shortRp(v), font: { size: 9 } }, beginAtZero: true },
      y: { title: { display: true, text: '⚠ Attributed revenue (DUMMY)', font: { size: 10 }, color: DUMMY_COLOR }, ticks: { callback: v => shortRp(v), font: { size: 9 } }, beginAtZero: true },
    },
  })

  const trendData = trend?.points?.length ? {
    labels: trend.points.map(p => p.period),
    datasets: [
      { label: 'Spend (REAL)', data: trend.points.map(p => p.spend), borderColor: REAL_COLOR, backgroundColor: withAlpha(REAL_COLOR, 0.12), tension: 0.3, pointRadius: 2, fill: false },
      { label: 'Attributed revenue (DUMMY)', data: trend.points.map(p => p.attributedRevenue), borderColor: DUMMY_COLOR, backgroundColor: withAlpha(DUMMY_COLOR, 0.1), borderDash: [5, 3], tension: 0.3, pointRadius: 2, fill: false },
    ],
  } : null
  const trendOpts = mergeOptions(baseOptions, {
    plugins: { legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } } },
    scales: { x: { ticks: { font: { size: 8 }, maxTicksLimit: 12 } }, y: { ticks: { callback: v => shortRp(v), font: { size: 9 } }, beginAtZero: true } },
  })

  const tiles = [
    { icon: 'fa-coins', bg: REAL_COLOR, label: 'Total Spend', value: shortRp(ov?.totalSpend) },                                  // REAL
    { icon: 'fa-hand-holding-dollar', bg: DUMMY_COLOR, label: 'Attributed Revenue', value: shortRp(ov?.attribution?.totalAttributedRevenue), dev: true }, // DUMMY
    { icon: 'fa-bullseye', bg: DUMMY_COLOR, label: 'Blended ROAS', value: ov?.attribution?.blendedRoas != null ? `${ov.attribution.blendedRoas}×` : '—', dev: true }, // DUMMY
    { icon: 'fa-layer-group', bg: '#2C3639', label: 'Sources', value: formatNumber(ov?.sourceCount ?? 0) },                       // REAL
    { icon: 'fa-share-nodes', bg: '#6B8E9E', label: 'Social Spend', value: shortRp(ov?.socialTotal) },                            // REAL
    { icon: 'fa-tags', bg: '#8B5E3C', label: 'Marketing Spend', value: shortRp(ov?.marketingTotal) },                            // REAL
  ]

  const columns = useMemo(() => [
    { key: 'key', label: 'Source', searchable: true, sortable: true, sortType: 'string' },
    { key: 'source', label: 'Kind', filter: 'select', sortable: true },
    { key: 'spend', label: 'Spend · REAL', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'sharePct', label: 'Share%', sortable: true, sortType: 'number', align: 'right', format: v => `${v}%` },
    { key: 'attributedRevenue', label: 'Attributed · DUMMY', sortable: true, sortType: 'number', align: 'right',
      render: r => <span style={{ color: DUMMY_COLOR }}>{formatCurrency(r.attributedRevenue)}</span> },
    { key: 'roas', label: 'ROAS · DUMMY', sortable: true, sortType: 'number', align: 'right',
      render: r => <span className="font-semibold" style={{ color: DUMMY_COLOR }}>{r.roas}× <DummyBadge /></span> },
  ], [])

  if (!loading && !hasData) {
    return (
      <CompactPage>
        <CompactTopbar title="True ROAS" icon="fa-bullseye" />
        <div className="flex flex-col items-center justify-center text-center gap-2 py-20 text-dark1/50">
          <i className="fas fa-money-bill-wave text-3xl text-dark1/20" />
          <div className="text-sm font-semibold text-dark1/70">No ad/marketing spend for this tenant</div>
          <div className="text-xs max-w-md">{ov?.note || 'ROAS needs AdSpentSocialMedia / Marketing rows (Cleora / tenant 2 in dev).'}</div>
        </div>
      </CompactPage>
    )
  }

  return (
    <CompactPage>
      <CompactTopbar title="True ROAS" icon="fa-bullseye"
        actions={<CrossLink href="/analytics/ads-allocation" label="Spend allocation" icon="fa-chart-simple" />}>
        <span className="text-[10px] text-dark1/45">real spend · dummy attribution</span>
      </CompactTopbar>

      {/* MIXED banner (posture #3 + slate/orange) — spend real, attribution dummy */}
      <div className="flex items-start gap-2 rounded-lg border border-orange/40 bg-orange/10 px-3 py-2 text-[11px] text-dark1">
        <i className="fas fa-triangle-exclamation text-orange mt-0.5" />
        <span>
          <b style={{ color: REAL_COLOR }}>Ad SPEND is REAL</b> (same tables as <Link href="/analytics/ads-allocation" className="underline">Ads-Allocation</Link>). <b style={{ color: DUMMY_COLOR }}>Attributed revenue &amp; ROAS are DUMMY</b> — there is <b>no order-level attribution link</b> (Order has no campaign / ads / utm / source column, P-1). ROAS = dummy attributed-revenue ÷ real spend, so <b>it is not a real return</b>. Becomes real once an attribution column is added to Order and captured at sync.
          <span className="text-dark1/50"> Colors: <span style={{ color: REAL_COLOR }}>■ real</span> / <span style={{ color: DUMMY_COLOR }}>■ dummy</span>.</span>
        </span>
      </div>

      <IconKpiStrip tiles={tiles} />

      {/* Quadrant + trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title="Spend × attributed-return — ROAS quadrant" icon="fa-braille"
          headerRight={scatter ? <span className="text-[9px] text-dark1/45">{points.length} sources · y &amp; ROAS <span style={{ color: DUMMY_COLOR }}>dummy</span></span> : null} bodyClass="p-2">
          {loading ? <div style={{ height: 320 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : !points.length ? <div style={{ height: 320 }} className="flex items-center justify-center text-dark1/30 text-xs">No spend sources.</div>
            : <div style={{ height: 320 }}><Scatter data={scatterData} options={scatterOpts} plugins={[dividerPlugin(scatter.medianSpend, scatter.medianSpend * scatter.medianRoas)]} /></div>}
        </CompactPanel>

        <CompactPanel title="Spend vs attributed revenue — trend" icon="fa-chart-line"
          headerRight={<span className="text-[9px]"><span style={{ color: REAL_COLOR }}>● spend (real)</span> — <span style={{ color: DUMMY_COLOR }}>● revenue (dummy)</span></span>} bodyClass="p-2">
          {loading ? <div style={{ height: 320 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : !trendData ? <div style={{ height: 320 }} className="flex items-center justify-center text-dark1/30 text-xs">No spend in range.</div>
            : <><div style={{ height: 290 }}><Line data={trendData} options={trendOpts} /></div>
                <p className="text-[10px] text-dark1/40 mt-1">{trend?.note}</p></>}
        </CompactPanel>
      </div>

      {/* Sources table */}
      <CompactPanel title={`Sources — ${points.length}${filter !== 'All' ? ` (${filter})` : ''}`} icon="fa-table"
        headerRight={<div className="flex gap-0.5 bg-bg rounded p-0.5">{FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-[10px] px-1.5 py-0.5 rounded ${filter === f ? 'bg-dark1 text-white' : 'text-dark1/50 hover:text-dark1'}`}>{f === 'All' ? 'All' : f === 'channel' ? 'Channels' : 'Categories'}</button>
        ))}</div>} bodyClass="p-2">
        <DataGrid data={points} columns={columns} searchable onRowClick={r => openDetail(r.key, r.source)}
          defaultSort={{ key: 'spend', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No spend sources." />
        <p className="text-[10px] text-dark1/40 mt-1"><span style={{ color: REAL_COLOR }}>Spend</span> is real; <span style={{ color: DUMMY_COLOR }}>attributed revenue &amp; ROAS</span> are fabricated (no order attribution). Click a row for the real/dummy breakdown.</p>
      </CompactPanel>

      {detail && <RoasDetailModal detail={detail} onClose={() => setDetail(null)} />}
      <AnalyticsAIPanel module="roas" context={data}
        suggestions={['Is this ROAS real?', 'Which channels have the highest spend?']} />
    </CompactPage>
  )
}
