'use client'
// Talent ROI — deep analysis (Analytics). Wave 2 + Part C OBJECTIVE-AWARE retrofit:
// each talent is judged against ITS OWN funnel objective (Awareness/Consideration/
// Conversion). An objective filter switches the efficiency metric + axis meaning +
// tooltip; the MAIN quadrant is a single chart color-coded BY OBJECTIVE (not 3 small
// multiples), y-axis relabeled per the active filter via the engine's objectiveView.
// Honesty survives: cost = slate/REAL, objective metrics + efficiency = orange/DUMMY.
// All logic in the engine via /api/analytics/talent-roi; objective override → PATCH.
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import CrossLink from '@/components/dashboard/CrossLink'
import { TalentRoiQuadrant, RoiLeaderboard, CostReturnDumbbell, TypeRadar, REAL_COLOR, DUMMY_COLOR, objectiveColor } from '@/components/talent-roi/TalentRoiCharts'
import { TalentDetailModal, RecommendationsModal, QuadBadge } from '@/components/talent-roi/TalentRoiModals'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import { formatCurrency, formatNumber } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return 'Rp' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return 'Rp' + (n / 1e6).toFixed(0) + 'M'; if (n >= 1e3) return 'Rp' + (n / 1e3).toFixed(0) + 'K'; return 'Rp' + Math.round(n) }
const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)
const FILTERS = ['All', 'Awareness', 'Consideration', 'Conversion']

function toCsv(rows) {
  const cols = [['name', 'Talent'], ['type', 'Type'], ['objective', 'Objective'], ['objectiveInferred', 'Inferred'], ['cost', 'Cost(REAL)'], ['normalizedEfficiency', 'Efficiency0-100(DUMMY)'], ['objectiveMetric', 'ObjMetric(DUMMY)'], ['roi', 'ROI(DUMMY)']]
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.map(c => c[1]).join(','), ...rows.map(r => cols.map(c => esc(r[c[0]])).join(','))].join('\n')
}
function download(name, content, type) {
  const blob = new Blob([content], { type }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function TalentRoiPage() {
  const [month, setMonth] = useState('')
  const [filter, setFilter] = useState('All')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [showRecs, setShowRecs] = useState(false)
  const [recs, setRecs] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const loadedOnce = useRef(false)

  useEffect(() => {
    let alive = true
    if (!loadedOnce.current) setLoading(true)
    const m = month ? `&month=${month}` : ''
    fetchJson(`/api/analytics/talent-roi?view=overview&objective=${filter}${m}`).then(d => {
      if (alive) { setData(d); setLoading(false); loadedOnce.current = true }
    })
    return () => { alive = false }
  }, [month, filter, refresh])

  const openDetail = useCallback((id) => {
    fetchJson(`/api/analytics/talent-roi?view=detail&id=${id}`).then(d => d && setDetail(d))
  }, [])
  const openRecs = useCallback(() => {
    setShowRecs(true)
    fetchJson('/api/analytics/talent-roi?view=recommendations').then(setRecs)
  }, [])

  // Override saved → reflect immediately in the open modal + re-fetch so charts/grid update.
  const onObjectiveSaved = useCallback((t) => {
    if (t) setDetail(prev => prev && prev.talentId === t.id ? { ...prev, objective: t.objective, objectiveInferred: t.objectiveInferred } : prev)
    setRefresh(r => r + 1)
  }, [])

  const ov = data?.overview
  const hasData = ov?.hasData
  const quad = data?.quadrant
  const objectiveView = quad?.objectiveView
  const allPoints = useMemo(() => quad?.points ?? [], [quad])
  const filteredPoints = useMemo(() => filter === 'All' ? allPoints : allPoints.filter(p => p.objective === filter), [allPoints, filter])

  // Lone-in-group / no-spread talents: C2 scores them a neutral 50 — flag so it doesn't
  // read as a real mid-pack score (Basket-style n=1 honesty).
  const unrankableIds = useMemo(() => {
    const groups = {}
    for (const p of allPoints) if (p.objectiveMetric != null) (groups[p.objective] ??= []).push(p.objectiveMetric)
    const s = new Set()
    for (const [, metrics] of Object.entries(groups)) {
      if (metrics.length < 2 || Math.max(...metrics) === Math.min(...metrics)) {
        for (const p of allPoints) if (p.objectiveMetric != null && groups[p.objective] === metrics) s.add(p.talentId)
      }
    }
    // rebuild cleanly (the identity check above is fragile) — collect ids per degenerate objective
    const out = new Set()
    const byObj = {}
    for (const p of allPoints) if (p.objectiveMetric != null) (byObj[p.objective] ??= []).push(p)
    for (const arr of Object.values(byObj)) {
      const ms = arr.map(p => p.objectiveMetric)
      if (arr.length < 2 || Math.max(...ms) === Math.min(...ms)) arr.forEach(p => out.add(p.talentId))
    }
    return out
  }, [allPoints])

  const dumbbellItems = useMemo(() => filteredPoints.map(p => ({
    talentId: p.talentId, name: p.name, type: p.type, cost: p.x, attributedRevenue: p.y, roi: p.roi,
    objective: p.objective, objectiveInferred: p.objectiveInferred, normalizedEfficiency: p.normalizedEfficiency,
  })), [filteredPoints])

  // Type-radar groups, recomputed from the FILTERED points so the radar respects the lens.
  const radarGroups = useMemo(() => {
    const m = new Map()
    for (const p of filteredPoints) {
      const g = m.get(p.type) ?? { type: p.type, count: 0, cost: 0, attributedRevenue: 0, views: 0 }
      g.count++; g.cost += p.x; g.attributedRevenue += p.y; g.views += (p.views || 0); m.set(p.type, g)
    }
    return [...m.values()].map(g => ({ ...g, cost: Math.round(g.cost), attributedRevenue: Math.round(g.attributedRevenue),
      roi: g.cost > 0 ? Math.round((g.attributedRevenue / g.cost) * 100) / 100 : null })).sort((a, b) => (b.roi ?? -1) - (a.roi ?? -1))
  }, [filteredPoints])

  const gridRows = useMemo(() => filteredPoints.map(p => ({
    talentId: p.talentId, name: p.name, type: p.type, objective: p.objective, objectiveInferred: p.objectiveInferred,
    cost: p.x, normalizedEfficiency: p.normalizedEfficiency, objectiveMetric: p.objectiveMetric, objectiveMetricUnit: p.objectiveMetricUnit,
    attributedRevenue: p.y, roi: p.roi, quadrant: p.quadrant, unrankable: unrankableIds.has(p.talentId),
  })), [filteredPoints, unrankableIds])

  const objCounts = ov?.objectives ?? {}
  const tiles = [
    { icon: 'fa-coins', bg: REAL_COLOR, label: 'Total Cost', value: shortRp(ov?.totalCost) },                          // REAL
    { icon: 'fa-hand-holding-dollar', bg: DUMMY_COLOR, label: 'Attributed Return', value: shortRp(ov?.totalReturn), dev: true }, // DUMMY
    { icon: 'fa-scale-balanced', bg: DUMMY_COLOR, label: 'Blended ROI', value: ov?.blendedRoi != null ? `${ov.blendedRoi}×` : '—', dev: true }, // DUMMY
    { icon: 'fa-users', bg: '#2C3639', label: 'Talents', value: formatNumber(ov?.talentCount ?? 0) },                   // REAL
    { icon: 'fa-bullseye', bg: '#6B8E9E', label: 'Inferred objectives', value: `${ov?.objectiveInferredCount ?? 0}/${ov?.talentCount ?? 0}` }, // meta
  ]

  const columns = useMemo(() => [
    { key: 'name', label: 'Talent', searchable: true, sortable: true, sortType: 'string' },
    { key: 'type', label: 'Type', filter: 'select', sortable: true },
    { key: 'objective', label: 'Objective', filter: 'select', sortable: true,
      render: r => <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center rounded font-semibold text-[9px] px-1.5 py-0.5" style={{ background: `${objectiveColor(r.objective)}22`, color: objectiveColor(r.objective) }}>{r.objective}</span>
        {r.objectiveInferred && <span className="text-[9px] text-dark1/40">(inf)</span>}
        {r.unrankable && <span className="text-[9px]" style={{ color: DUMMY_COLOR }} title="Only talent in its objective — neutral score, not ranked">⚠ n=1</span>}
      </span> },
    { key: 'cost', label: 'Cost · REAL', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'normalizedEfficiency', label: 'Efficiency · DUMMY', sortable: true, sortType: 'number', align: 'right',
      render: r => <span style={{ color: DUMMY_COLOR }}>{r.normalizedEfficiency != null ? `${r.normalizedEfficiency}/100` : '—'}</span> },
    { key: 'roi', label: 'ROI · DUMMY', sortable: true, sortType: 'number', align: 'right',
      render: r => <span className="font-semibold" style={{ color: r.roi == null ? '#999' : r.roi >= 1 ? '#16a34a' : '#dc3545' }}>{r.roi != null ? `${r.roi}×` : '—'}</span> },
    { key: 'quadrant', label: 'ROI quad', filter: 'select', sortable: true, render: r => <QuadBadge quadrant={r.quadrant} small /> },
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

  const isAll = filter === 'All'
  const yLabel = objectiveView?.yLabel || (isAll ? 'Objective efficiency (0–100)' : 'Objective efficiency')

  return (
    <CompactPage>
      <CompactTopbar title="Talent ROI" icon="fa-user-tag"
        actions={
          <>
            <button onClick={openRecs} className="sv-tbtn sv-tbtn-dark"><i className="fas fa-lightbulb" /> Recommendations</button>
            <button onClick={() => download(`talent-roi-${filter}-${month || 'all'}.csv`, toCsv(gridRows), 'text/csv')} className="sv-tbtn sv-tbtn-ghost"><i className="fas fa-file-csv" /> CSV</button>
            <CrossLink href="/talent" label="Manage data" icon="fa-pen-to-square" />
          </>
        }>
        {/* Objective filter — switches the efficiency metric + axis meaning */}
        <span className="text-[10px] text-dark1/45">Objective</span>
        <div className="flex gap-0.5 bg-bg rounded p-0.5">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`sv-tbtn ${filter === f ? 'sv-tbtn-dark' : 'sv-tbtn-ghost'} !h-6`}
              title={f === 'All' ? 'Each talent on its own objective (normalized 0–100)' : `Only ${f} talents`}>
              {f}{f !== 'All' && objCounts[f] != null ? <span className="opacity-60 ml-1">{objCounts[f]}</span> : null}
            </button>
          ))}
        </div>
      </CompactTopbar>

      {/* DUMMY BANNER (BCG-style — return IS fabricated) + objective-efficiency note */}
      <div className="flex items-start gap-2 rounded-lg border border-orange/40 bg-orange/10 px-3 py-2 text-[11px] text-dark1">
        <i className="fas fa-triangle-exclamation text-orange mt-0.5" />
        <span>
          <b style={{ color: REAL_COLOR }}>Talent COST is real</b> (payments / rate cards). <b style={{ color: DUMMY_COLOR }}>RETURN, engagement &amp; conversions are DUMMY</b> — no talent→sales link exists yet
          (TalentContent.campaignId null, no Order attribution). Each talent is judged against <b>its own objective</b> (Awareness→reach · Consideration→engagement · Conversion→conversions); since the outcomes are dummy, <b>efficiency is dummy-derived</b> — only <span style={{ color: REAL_COLOR }}>cost</span> is real.
          Objectives are <b>inferred</b> until a brand owner overrides them (open a talent). <span className="text-dark1/50">Colors: <span style={{ color: REAL_COLOR }}>■ real</span> / <span style={{ color: DUMMY_COLOR }}>■ dummy</span>; points colored by objective.</span>
        </span>
      </div>

      <IconKpiStrip tiles={tiles} />

      {/* MAIN: objective-aware quadrant — cost (real) × efficiency (dummy), colored by objective */}
      <CompactPanel title={`Objective efficiency matrix — cost (real) × ${isAll ? 'normalized efficiency' : filter + ' efficiency'} (dummy)`} icon="fa-braille"
        headerRight={quad ? <span className="text-[9px] text-dark1/45">{filteredPoints.length} talents · {objectiveView?.metricLabel} <span style={{ color: DUMMY_COLOR }}>(dummy)</span></span> : null}
        bodyClass="p-2">
        {loading ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : !filteredPoints.length ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">No talents for this objective.</div>
          : <TalentRoiQuadrant points={filteredPoints} filter={filter} objectiveView={objectiveView} unrankableIds={unrankableIds} height={440} onSelect={openDetail} />}
        <p className="text-[10px] text-dark1/40 mt-1 px-1">{objectiveView?.note}</p>
      </CompactPanel>

      {/* COMPANION: DUMBBELL (cost vs return split — slate/orange) */}
      <CompactPanel title="Cost vs Return — dumbbell (real/dummy split, by talent)" icon="fa-grip-lines"
        headerRight={<span className="text-[9px]"><span style={{ color: REAL_COLOR }}>● cost (real)</span> — <span style={{ color: DUMMY_COLOR }}>● return (dummy)</span> · sorted by ROI</span>}
        bodyClass="p-2">
        {loading ? <div style={{ height: 520 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : !dumbbellItems.length ? <div style={{ height: 120 }} className="flex items-center justify-center text-dark1/30 text-xs">No talents for this objective.</div>
          : <CostReturnDumbbell items={dumbbellItems} unrankableIds={unrankableIds} height={Math.max(220, dumbbellItems.length * 22 + 60)} onSelect={openDetail} />}
      </CompactPanel>

      {/* COMPANION: objective-efficiency leaderboard + type RADAR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title="Efficiency leaderboard (dummy)" icon="fa-ranking-star"
          headerRight={<span className="text-[9px] text-dark1/45">{isAll ? 'normalized 0–100' : objectiveView?.metricLabel}</span>} bodyClass="p-2">
          {loading ? <div style={{ height: 360 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : <RoiLeaderboard points={filteredPoints} filter={filter} objectiveView={objectiveView} unrankableIds={unrankableIds} height={360} onSelect={openDetail} />}
        </CompactPanel>

        <CompactPanel title="Type profile — radar (normalized axes)" icon="fa-chart-area"
          headerRight={radarGroups[0] ? <span className="text-[9px] text-green-600 font-semibold">best ROI: {radarGroups[0].type} {radarGroups[0].roi}× <span className="text-dark1/40">(dummy)</span></span> : null}
          bodyClass="p-2">
          {loading ? <div style={{ height: 360 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : !radarGroups.length ? <div style={{ height: 120 }} className="flex items-center justify-center text-dark1/30 text-xs">No talents for this objective.</div>
            : <TypeRadar groups={radarGroups} height={300} />}
          <p className="text-[10px] text-dark1/40 mt-1 px-1">Axes normalized 0–100 per axis (scales differ) for shape comparison — tooltips show real values. <span style={{ color: REAL_COLOR }}>Cost = real</span>; <span style={{ color: DUMMY_COLOR }}>return / ROI / views = dummy</span>. {!isAll && `(${filter} talents only.)`}</p>
        </CompactPanel>
      </div>

      {/* Talent table */}
      <CompactPanel title={`Talents — ${gridRows.length}${isAll ? '' : ` (${filter})`}`} icon="fa-table"
        headerRight={<span className="text-[9px]"><span style={{ color: REAL_COLOR }}>cost = real</span> · <span style={{ color: DUMMY_COLOR }}>efficiency/ROI = dummy</span></span>}
        bodyClass="p-2">
        <DataGrid data={gridRows} columns={columns} searchable onRowClick={r => openDetail(r.talentId)}
          defaultSort={{ key: 'normalizedEfficiency', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No talents." />
        <p className="text-[10px] text-dark1/40 mt-1"><span style={{ color: REAL_COLOR }}>Cost</span> is real; <span style={{ color: DUMMY_COLOR }}>efficiency &amp; ROI</span> are dummy-derived (no talent→sales link). <b>(inf)</b> = inferred objective; <b>⚠ n=1</b> = only talent in its objective (neutral score). Click a row to override the objective + see the breakdown.</p>
      </CompactPanel>

      {detail && <TalentDetailModal detail={detail} onClose={() => setDetail(null)} onObjectiveSaved={onObjectiveSaved} />}
      {showRecs && <RecommendationsModal rec={recs} onClose={() => setShowRecs(false)} />}
      <AnalyticsAIPanel module="talent-roi" context={data}
        suggestions={['Is the ROI real?', 'Which talents are most efficient for their objective?']} />
    </CompactPage>
  )
}
