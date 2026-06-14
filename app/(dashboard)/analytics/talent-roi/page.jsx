'use client'
// Talent ROI — deep analysis (Analytics). Wave 2: ROI = REAL cost ÷ DUMMY return →
// BCG-style DUMMY BANNER (not Wave 1's neutral note). MAIN cost×return quadrant + 3
// companions (leaderboard, cost-vs-return diverging bar, type bar). The real/dummy
// split is encoded in COLOR everywhere (slate=real cost, orange=dummy return). All
// logic in the engine via /api/analytics/talent-roi.
import { useEffect, useMemo, useState, useCallback } from 'react'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import { TalentRoiQuadrant, RoiLeaderboard, CostReturnDumbbell, TypeRadar, REAL_COLOR, DUMMY_COLOR } from '@/components/talent-roi/TalentRoiCharts'
import { TalentDetailModal, RecommendationsModal, QuadBadge } from '@/components/talent-roi/TalentRoiModals'
import { formatCurrency, formatNumber } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return 'Rp' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return 'Rp' + (n / 1e6).toFixed(0) + 'M'; if (n >= 1e3) return 'Rp' + (n / 1e3).toFixed(0) + 'K'; return 'Rp' + Math.round(n) }
const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

function toCsv(rows) {
  const cols = [['name', 'Talent'], ['type', 'Type'], ['cost', 'Cost(REAL)'], ['attributedRevenue', 'Return(DUMMY)'], ['roi', 'ROI(DUMMY)'], ['quadrant', 'Quadrant']]
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.map(c => c[1]).join(','), ...rows.map(r => cols.map(c => esc(r[c[0]])).join(','))].join('\n')
}
function download(name, content, type) {
  const blob = new Blob([content], { type }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function TalentRoiPage() {
  const [month, setMonth] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [showRecs, setShowRecs] = useState(false)
  const [recs, setRecs] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const m = month ? `&month=${month}` : ''
    fetchJson(`/api/analytics/talent-roi?view=overview${m}`).then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [month])

  const openDetail = useCallback((id) => {
    fetchJson(`/api/analytics/talent-roi?view=detail&id=${id}`).then(d => d && setDetail(d))
  }, [])
  const openRecs = useCallback(() => {
    setShowRecs(true)
    fetchJson('/api/analytics/talent-roi?view=recommendations').then(setRecs)
  }, [])

  const ov = data?.overview
  const hasData = ov?.hasData
  const quad = data?.quadrant
  const ranking = data?.ranking?.items ?? []
  const costVsReturn = data?.costVsReturn?.items ?? []
  const typeGroups = data?.typePerf?.groups ?? []

  // Grid rows from quadrant points (per-talent, has quadrant + cost + return + roi).
  const gridRows = useMemo(() => (quad?.points ?? []).map(p => ({
    talentId: p.talentId, name: p.name, type: p.type, cost: p.x, attributedRevenue: p.y, roi: p.roi, quadrant: p.quadrant,
  })), [quad])

  const tiles = [
    { icon: 'fa-coins', bg: REAL_COLOR, label: 'Total Cost', value: shortRp(ov?.totalCost) },                          // REAL
    { icon: 'fa-hand-holding-dollar', bg: DUMMY_COLOR, label: 'Attributed Return', value: shortRp(ov?.totalReturn), dev: true }, // DUMMY
    { icon: 'fa-scale-balanced', bg: DUMMY_COLOR, label: 'Blended ROI', value: ov?.blendedRoi != null ? `${ov.blendedRoi}×` : '—', dev: true }, // DUMMY
    { icon: 'fa-users', bg: '#2C3639', label: 'Talents', value: formatNumber(ov?.talentCount ?? 0) },                   // REAL
    { icon: 'fa-arrow-trend-up', bg: DUMMY_COLOR, label: 'Avg ROI', value: ov?.avgRoi != null ? `${ov.avgRoi}×` : '—', dev: true }, // DUMMY
  ]

  const columns = useMemo(() => [
    { key: 'name', label: 'Talent', searchable: true, sortable: true, sortType: 'string' },
    { key: 'type', label: 'Type', filter: 'select', sortable: true },
    { key: 'cost', label: 'Cost · REAL', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'attributedRevenue', label: 'Return · DUMMY', sortable: true, sortType: 'number', align: 'right',
      render: r => <span style={{ color: DUMMY_COLOR }}>{formatCurrency(r.attributedRevenue)}</span> },
    { key: 'roi', label: 'ROI · DUMMY', sortable: true, sortType: 'number', align: 'right',
      render: r => <span className="font-semibold" style={{ color: r.roi == null ? '#999' : r.roi >= 1 ? '#16a34a' : '#dc3545' }}>{r.roi != null ? `${r.roi}×` : '—'}</span> },
    { key: 'quadrant', label: 'Quadrant', filter: 'select', sortable: true, render: r => <QuadBadge quadrant={r.quadrant} small /> },
  ], [])

  // ── Empty / no-data state ──
  if (!loading && !hasData) {
    return (
      <CompactPage>
        <CompactTopbar title="Talent ROI" icon="fa-user-tag" />
        <div className="flex flex-col items-center justify-center text-center gap-2 py-20 text-dark1/50">
          <i className="fas fa-user-slash text-3xl text-dark1/20" />
          <div className="text-sm font-semibold text-dark1/70">No talents for this tenant</div>
          <div className="text-xs max-w-md">{ov?.note || 'Talent ROI needs talent records (tenant 2 / Cleora in dev). Other tenants have no talent data.'}</div>
        </div>
      </CompactPage>
    )
  }

  return (
    <CompactPage>
      <CompactTopbar title="Talent ROI" icon="fa-user-tag"
        actions={
          <>
            <button onClick={openRecs} className="sv-tbtn sv-tbtn-dark"><i className="fas fa-lightbulb" /> Recommendations</button>
            <button onClick={() => download(`talent-roi-${month || 'all'}.csv`, toCsv(gridRows), 'text/csv')} className="sv-tbtn sv-tbtn-ghost"><i className="fas fa-file-csv" /> CSV</button>
          </>
        }>
        <span className="text-[10px] text-dark1/45">All talents</span>
      </CompactTopbar>

      {/* DUMMY BANNER (BCG-style — return IS fabricated) */}
      <div className="flex items-start gap-2 rounded-lg border border-orange/40 bg-orange/10 px-3 py-2 text-[11px] text-dark1">
        <i className="fas fa-triangle-exclamation text-orange mt-0.5" />
        <span>
          <b style={{ color: REAL_COLOR }}>Talent COST is real</b> (payments / rate cards). <b style={{ color: DUMMY_COLOR }}>RETURN / revenue is DUMMY</b> — no talent→sales link exists in the data yet
          (TalentContent.campaignId null, no Order attribution). So <b>ROI = real cost ÷ FICTIONAL return</b>; rankings &amp; quadrant positions are <b>not real</b>.
          Becomes real once attribution is backfilled. <span className="text-dark1/50">Colors: <span style={{ color: REAL_COLOR }}>■ real</span> / <span style={{ color: DUMMY_COLOR }}>■ dummy</span>. (Payment report stays on the Talent pages — this is the ROI lens.)</span>
        </span>
      </div>

      <IconKpiStrip tiles={tiles} />

      {/* MAIN: ROI quadrant */}
      <CompactPanel title="Talent ROI matrix — cost (real) × return (dummy)" icon="fa-braille"
        headerRight={quad ? <span className="text-[9px] text-dark1/45">{quad.measuredCount} talents · medians cost {shortRp(quad.medianCost)} / return {shortRp(quad.medianReturn)} <span style={{ color: DUMMY_COLOR }}>(dummy)</span></span> : null}
        bodyClass="p-2">
        {loading ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : !quad?.points?.length ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">No talent cost data.</div>
          : <TalentRoiQuadrant points={quad.points} medianCost={quad.medianCost} medianReturn={quad.medianReturn} height={440} onSelect={openDetail} />}
      </CompactPanel>

      {/* COMPANION 2 — DUMBBELL (full width, all 24 talents, sorted by ROI): the split chart */}
      <CompactPanel title="Cost vs Return — dumbbell (real/dummy split, by talent)" icon="fa-grip-lines"
        headerRight={<span className="text-[9px]"><span style={{ color: REAL_COLOR }}>● cost (real)</span> — <span style={{ color: DUMMY_COLOR }}>● return (dummy)</span> · sorted by ROI</span>}
        bodyClass="p-2">
        {loading ? <div style={{ height: 520 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : <CostReturnDumbbell items={costVsReturn} height={520} onSelect={openDetail} />}
      </CompactPanel>

      {/* COMPANION 1 (leaderboard) + COMPANION 3 (type RADAR) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title="ROI leaderboard (dummy)" icon="fa-ranking-star"
          headerRight={<span className="text-[9px] text-dark1/45">{ov?.winners ?? 0} win · {ov?.losers ?? 0} lose</span>} bodyClass="p-2">
          {loading ? <div style={{ height: 360 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : <RoiLeaderboard items={ranking} height={360} onSelect={openDetail} />}
        </CompactPanel>

        <CompactPanel title="Type profile — radar (normalized axes)" icon="fa-chart-area"
          headerRight={typeGroups[0] ? <span className="text-[9px] text-green-600 font-semibold">best ROI: {typeGroups[0].type} {typeGroups[0].roi}× <span className="text-dark1/40">(dummy)</span></span> : null}
          bodyClass="p-2">
          {loading ? <div style={{ height: 360 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : <TypeRadar groups={typeGroups} height={300} />}
          <p className="text-[10px] text-dark1/40 mt-1 px-1">Axes normalized 0–100 per axis (scales differ) for shape comparison — tooltips show real values. <span style={{ color: REAL_COLOR }}>Cost = real</span>; <span style={{ color: DUMMY_COLOR }}>return / ROI / views = dummy</span>.</p>
        </CompactPanel>
      </div>

      {/* Talent table */}
      <CompactPanel title={`Talents — ${gridRows.length}`} icon="fa-table"
        headerRight={<span className="text-[9px]"><span style={{ color: REAL_COLOR }}>cost = real</span> · <span style={{ color: DUMMY_COLOR }}>return/ROI = dummy</span></span>}
        bodyClass="p-2">
        <DataGrid data={gridRows} columns={columns} searchable onRowClick={r => openDetail(r.talentId)}
          defaultSort={{ key: 'roi', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No talents." />
        <p className="text-[10px] text-dark1/40 mt-1"><span style={{ color: REAL_COLOR }}>Cost</span> is real (rate card / payments); <span style={{ color: DUMMY_COLOR }}>return &amp; ROI</span> are fabricated (no talent→sales link). Click a row for the real-vs-dummy breakdown.</p>
      </CompactPanel>

      {detail && <TalentDetailModal detail={detail} onClose={() => setDetail(null)} />}
      {showRecs && <RecommendationsModal rec={recs} onClose={() => setShowRecs(false)} />}
    </CompactPage>
  )
}
