'use client'
// Cohort Retention — deep analysis (Analytics). Wave 2 §2.3, MOST dummy-heavy (1/36 real)
// but the most OPTIMISTIC: becomes real with time, no backfill. MAIN = triangular retention
// heatmap (chartjs-chart-matrix, statically registered) + acquisition trend + cohort detail.
// All logic in the engine via /api/analytics/cohort.
import { useEffect, useMemo, useState, useCallback } from 'react'
import CompactPage from '@/components/dashboard/CompactPage'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import DataGrid from '@/components/table/DataGrid'
import { RetentionHeatmap, AcquisitionTrend, RetentionCurve, REAL_COLOR, DUMMY_COLOR } from '@/components/cohort/CohortCharts'
import { formatNumber } from '@/lib/utils'

const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

function toCsv(cohorts) {
  const rows = [['Cohort', 'Period', 'Retention%', 'Retained', 'CohortSize', 'Source']]
  for (const c of cohorts) for (const cell of c.cells) rows.push([c.cohortMonth, cell.periodIndex, cell.retentionPct, cell.customersRetained, c.cohortSize, cell.dummy ? 'DUMMY' : 'REAL'])
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return rows.map(r => r.map(esc).join(',')).join('\n')
}
function download(name, content, type) {
  const blob = new Blob([content], { type }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const COL = [
  { key: 'name', label: 'Customer', searchable: true, sortable: true, sortType: 'string' },
  { key: 'username', label: 'Username', searchable: true, render: r => <span className="font-mono text-[10px]">{r.username}</span> },
  { key: 'orders', label: 'Orders', sortable: true, sortType: 'number', align: 'right', format: v => formatNumber(v) },
]

export default function CohortPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchJson('/api/analytics/cohort?view=overview').then(d => {
      if (!alive) return
      setData(d); setLoading(false)
      // default-select the real cohort (or the newest)
      const cs = d?.grid?.cohorts ?? []
      const def = cs.find(c => c.real)?.cohortMonth || cs[cs.length - 1]?.cohortMonth
      if (def) setSelected(def)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!selected) return
    let alive = true
    fetchJson(`/api/analytics/cohort?view=detail&cohort=${selected}`).then(d => { if (alive) setDetail(d) })
    return () => { alive = false }
  }, [selected])

  const ov = data?.overview
  const grid = data?.grid
  const trend = data?.trend
  const hasData = ov?.hasData
  const maxPeriod = grid?.periods?.length ? grid.periods[grid.periods.length - 1] : 0

  const tiles = [
    { icon: 'fa-layer-group', bg: '#2C3639', label: 'Cohorts', value: formatNumber(ov?.cohortCount ?? 0) },
    { icon: 'fa-users', bg: REAL_COLOR, iconColor: '#0b3d1b', label: 'Customers Covered', value: formatNumber(ov?.customersCovered ?? 0) },
    { icon: 'fa-rotate-left', bg: DUMMY_COLOR, label: 'Avg Month-1 Retention', value: ov?.avgMonth1Retention != null ? `${ov.avgMonth1Retention}%` : '—', dev: true },
    { icon: 'fa-table-cells', bg: '#6B8E9E', label: 'Real Cells', value: `${ov?.realCellCount ?? 0}/${ov?.totalCells ?? 0}` },
  ]

  if (!loading && !hasData) {
    return (
      <CompactPage>
        <CompactTopbar title="Cohort Retention" icon="fa-table-cells-large" />
        <div className="flex flex-col items-center justify-center text-center gap-2 py-20 text-dark1/50">
          <i className="fas fa-table-cells text-3xl text-dark1/20" />
          <div className="text-sm font-semibold text-dark1/70">No cohort data for this tenant</div>
          <div className="text-xs max-w-md">Cohort retention needs customer order history (tenant 2 / Cleora in dev).</div>
        </div>
      </CompactPage>
    )
  }

  return (
    <CompactPage>
      <CompactTopbar title="Cohort Retention" icon="fa-table-cells-large"
        actions={<button onClick={() => download('cohort-retention.csv', toCsv(grid?.cohorts ?? []), 'text/csv')} className="sv-tbtn sv-tbtn-ghost"><i className="fas fa-file-csv" /> CSV</button>}>
        <span className="text-[10px] text-dark1/45">The grid IS the time dimension</span>
      </CompactTopbar>

      {/* BANNER — most dummy-heavy, but "becomes real with time" framing */}
      <div className="flex items-start gap-2 rounded-lg border border-orange/40 bg-orange/10 px-3 py-2 text-[11px] text-dark1">
        <i className="fas fa-hourglass-half text-orange mt-0.5" />
        <span>
          Cohort retention tracks how many customers from each acquisition month return later. Only ~1–2 months of order history exist, so
          <b> {ov?.dummyCellCount ?? 35} of {ov?.totalCells ?? 36} cells are DUMMY-projected decay</b> (shown to demonstrate the shape).
          <b style={{ color: REAL_COLOR }}> Unlike other dummy modules, this needs NO backfill</b> — as time passes and orders keep syncing, each diagonal becomes real automatically.
          Currently real: <b>{formatNumber(ov?.customersCovered ?? 0)} customers</b> (the latest cohort&apos;s size).
        </span>
      </div>

      <IconKpiStrip tiles={tiles} />

      {/* MAIN heatmap */}
      <CompactPanel title="Retention heatmap — acquisition month × months-since" icon="fa-table-cells"
        headerRight={<span className="text-[9px]"><span style={{ color: REAL_COLOR }}>■ real</span> · <span style={{ color: DUMMY_COLOR }}>■ dummy (intensity = retention%)</span></span>}
        bodyClass="p-2">
        {loading ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : !grid?.cohorts?.length ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">No cohorts.</div>
          : <RetentionHeatmap cohorts={grid.cohorts} maxPeriod={maxPeriod} height={440} onSelect={setSelected} />}
        <p className="text-[10px] text-dark1/40 mt-1">Triangular: each cohort only shows periods that have elapsed. The one <b style={{ color: REAL_COLOR }}>green</b> cell (latest cohort, month 0) is real; the rest are projected decay. Click a row to inspect.</p>
      </CompactPanel>

      {/* Acquisition trend + cohort detail curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title="Acquisition volume by cohort" icon="fa-chart-column"
          headerRight={<span className="text-[9px]"><span style={{ color: REAL_COLOR }}>■ real</span> <span style={{ color: DUMMY_COLOR }}>■ dummy</span></span>} bodyClass="p-2">
          {loading ? <div style={{ height: 240 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : <AcquisitionTrend points={trend?.points ?? []} height={240} />}
        </CompactPanel>

        <CompactPanel title="Cohort retention curve" icon="fa-chart-line"
          headerRight={
            <select value={selected} onChange={e => setSelected(e.target.value)}
              className="border border-cream rounded text-[10px] px-1.5 py-0.5 h-6 bg-white text-dark1 focus:outline-none focus:border-dark2">
              {(grid?.cohorts ?? []).map(c => <option key={c.cohortMonth} value={c.cohortMonth}>{c.cohortMonth}{c.real ? ' (real)' : ''}</option>)}
            </select>}
          bodyClass="p-2">
          {!detail ? <div style={{ height: 220 }} className="flex items-center justify-center text-dark1/30 text-xs">Select a cohort…</div>
            : <>
                <RetentionCurve curve={detail.curve} height={220} />
                <div className="text-[10px] text-dark1/45 mt-1">{detail.cohortMonth} · size {formatNumber(detail.cohortSize)} · {detail.real ? <span style={{ color: REAL_COLOR }}>real cohort</span> : <span style={{ color: DUMMY_COLOR }}>dummy cohort</span>}. {detail.note}</div>
              </>}
        </CompactPanel>
      </div>

      {/* Cohort customers (real only) */}
      <CompactPanel title={`Cohort customers — ${selected}${detail?.real ? '' : ' (dummy cohort)'}`} icon="fa-table" bodyClass="p-2">
        {detail?.customerListAvailable ? (
          <>
            <DataGrid data={detail.customers} columns={COL} searchable defaultSort={{ key: 'orders', dir: 'desc' }} pageSize={25} loading={!detail}
              emptyText="No customers." />
            <p className="text-[10px] text-dark1/40 mt-1">Real customers acquired in {selected} (RFM-derived identity). Acquisition is real; the retention curve above is projected.</p>
          </>
        ) : (
          <div className="text-xs text-dark1/45 text-center py-8">
            <i className="fas fa-ghost text-lg text-dark1/20" /><div className="mt-1">This is a fabricated shape cohort — no real customers acquired this month.</div>
            <div className="text-[10px] mt-0.5">Pick the <b style={{ color: REAL_COLOR }}>real</b> cohort to see its customer list.</div>
          </div>
        )}
      </CompactPanel>
      <AnalyticsAIPanel module="cohort" context={data}
        suggestions={['What is the retention so far?', 'How much of this is real vs projected?']} />
    </CompactPage>
  )
}
