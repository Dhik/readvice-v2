'use client'
// Campaign Content Efficiency — deep analysis (Analytics). CROSS-campaign lens
// (compares creators/content across campaigns). BCG-standard quality with
// fit-for-efficiency visuals: cost × REPORTED-GMV quadrant + channel/tier bars +
// leaderboard. NOT the per-campaign PerformanceChart (untouched). All logic in the
// engine via /api/analytics/campaign-efficiency. GMV is labeled "reported" everywhere.
import { useEffect, useMemo, useState, useCallback } from 'react'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import { MetricRow, StatCard } from '@/components/dashboard/StatCard'
import DataGrid from '@/components/table/DataGrid'
import CrossLink from '@/components/dashboard/CrossLink'
import { EfficiencyQuadrantChart, GroupBars, quadColor } from '@/components/campaign-efficiency/EfficiencyCharts'
import DetailModal, { QuadBadge } from '@/components/campaign-efficiency/DetailModal'
import CalculatedFieldModal from '@/components/analytics/CalculatedFieldModal'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import { useCalcFields, safeEvaluate, fmtCalc } from '@/components/analytics/calcFieldHelpers'
import { formatCurrency, formatNumber } from '@/lib/utils'

const MODULE = 'campaign-efficiency'
// Map a content point → manifest keys (quadrant points use x=cost, y=reportedGmv).
const rowToParams = r => ({ cost: r.x, reportedGmv: r.y, views: r.views, cpm: r.cpm,
  engagementRate: r.engagementRate, costPerGmv: r.costPerGmv, gmvPerCost: r.gmvPerCost, likes: 0, comments: 0 })

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return 'Rp' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return 'Rp' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return 'Rp' + (n / 1e3).toFixed(0) + 'K'; return 'Rp' + Math.round(n) }
const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

function toCsv(rows) {
  const cols = [['name', 'Creator'], ['channel', 'Channel'], ['tiering', 'Tier'], ['x', 'Cost'], ['y', 'ReportedGMV'], ['gmvPerCost', 'GMVperCost'], ['cpm', 'CPM'], ['engagementRate', 'Engagement%'], ['quadrant', 'Quadrant']]
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [cols.map(c => c[1]).join(','), ...rows.map(r => cols.map(c => esc(r[c[0]])).join(','))].join('\n')
}
function download(name, content, type) {
  const blob = new Blob([content], { type }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function CampaignEfficiencyPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [showCalc, setShowCalc] = useState(false)
  const { fields: calcFields, manifest, reload: reloadCalc, removeField } = useCalcFields(MODULE)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchJson('/api/analytics/campaign-efficiency?view=overview').then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const ov = data?.overview
  const quad = data?.quadrant
  const points = quad?.points ?? []                 // 20 measured content
  // quadrant lives only in the quadrant points — merge it into the fetched detail.
  const quadById = useMemo(() => Object.fromEntries((quad?.points ?? []).map(p => [p.id, p.quadrant])), [quad])

  const openDetail = useCallback((id) => {
    fetchJson(`/api/analytics/campaign-efficiency?view=detail&id=${id}`)
      .then(d => d && setDetail({ ...d, quadrant: d.quadrant ?? quadById[id] }))
  }, [quadById])
  const channelGroups = data?.channelMix?.groups ?? []
  const tierGroups = data?.tiering?.groups ?? []
  const eng = data?.engagement
  const top = data?.top?.items ?? []
  const bottom = data?.bottom?.items ?? []

  // Channel/tier groups: split measurable (gmvPerCost != null) from no-data (e.g. Untiered placeholders).
  const tierMeasurable = tierGroups.filter(g => g.gmvPerCost != null)
  const tierNoData = tierGroups.filter(g => g.gmvPerCost == null)
  const bestChannel = channelGroups.filter(g => g.gmvPerCost != null).reduce((m, g) => (g.gmvPerCost > (m?.gmvPerCost ?? -1) ? g : m), null)
  const bestTier = tierMeasurable.reduce((m, g) => (g.gmvPerCost > (m?.gmvPerCost ?? -1) ? g : m), null)

  // ── Calc fields (Part B5) — overview tile + per-content table column ──
  const overviewValues = useMemo(() => ({
    cost: ov?.totalCost ?? 0, reportedGmv: ov?.totalReportedGmv ?? 0, views: ov?.totalViews ?? 0,
    cpm: ov?.avgCpm ?? 0, engagementRate: ov?.avgEngagementRate ?? 0,
    gmvPerCost: ov?.blendedGmvPerCost ?? 0, costPerGmv: ov?.blendedCostPerReportedGmv ?? 0, likes: 0, comments: 0,
  }), [ov])
  const extraTiles = useMemo(() => calcFields.map(f => {
    const { value, dummy } = safeEvaluate(f.formula, overviewValues, manifest)
    return { label: f.label, value: fmtCalc(value), dummy, onRemove: () => removeField(f.id) }
  }), [calcFields, overviewValues, manifest, removeField])
  const extraColumns = useMemo(() => calcFields.map(f => ({
    key: String(f.id), label: f.label, format: fmtCalc,
    dummy: safeEvaluate(f.formula, {}, manifest).dummy,
    resolve: row => safeEvaluate(f.formula, rowToParams(row), manifest).value,
    onRemove: () => removeField(f.id),
  })), [calcFields, manifest, removeField])

  const tiles = [
    { icon: 'fa-photo-film', bg: '#2C3639', label: 'Content (measured/total)', value: `${formatNumber(ov?.measuredCount ?? 0)}/${formatNumber(ov?.contentCount ?? 0)}` },
    { icon: 'fa-coins', bg: '#E07B39', label: 'Total Cost', value: shortRp(ov?.totalCost) },
    { icon: 'fa-tag', bg: '#8B5E3C', label: 'Reported GMV', value: shortRp(ov?.totalReportedGmv) },
    { icon: 'fa-scale-balanced', bg: '#A9C5A0', iconColor: '#2C3639', label: 'GMV / Cost (reported)', value: ov?.blendedGmvPerCost != null ? `${ov.blendedGmvPerCost}×` : '—' },
    { icon: 'fa-eye', bg: '#6B8E9E', label: 'Avg CPM', value: ov?.avgCpm != null ? shortRp(ov.avgCpm) : '—' },
    { icon: 'fa-heart', bg: '#B5645B', label: 'Avg Engagement', value: ov?.avgEngagementRate != null ? `${ov.avgEngagementRate}%` : '—' },
  ]

  const columns = useMemo(() => [
    { key: 'name', label: 'Creator', searchable: true, sortable: true, sortType: 'string' },
    { key: 'channel', label: 'Channel', filter: 'select', sortable: true },
    { key: 'tiering', label: 'Tier', filter: 'select', sortable: true },
    { key: 'x', label: 'Cost', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'y', label: 'Reported GMV', sortable: true, sortType: 'number', align: 'right', format: v => formatCurrency(v) },
    { key: 'gmvPerCost', label: 'GMV/Cost', sortable: true, sortType: 'number', align: 'right',
      render: r => <span style={{ color: r.gmvPerCost >= 2 ? '#16a34a' : r.gmvPerCost >= 1 ? '#f59e0b' : '#dc3545' }} className="font-semibold">{r.gmvPerCost != null ? `${r.gmvPerCost}×` : '—'}</span> },
    { key: 'engagementRate', label: 'Eng%', sortable: true, sortType: 'number', align: 'right', format: v => v != null ? `${v}%` : '—' },
    { key: 'quadrant', label: 'Quadrant', filter: 'select', sortable: true, render: r => <QuadBadge quadrant={r.quadrant} small /> },
  ], [])

  return (
    <CompactPage>
      <CompactTopbar title="Campaign Efficiency" icon="fa-photo-film"
        actions={<>
          <button onClick={() => setShowCalc(true)} className="sv-tbtn sv-tbtn-dark"><i className="fas fa-calculator" /> + Field</button>
          <button onClick={() => download('campaign-efficiency.csv', toCsv(points), 'text/csv')} className="sv-tbtn sv-tbtn-ghost"><i className="fas fa-file-csv" /> CSV</button>
          <CrossLink href="/campaigns" label="Manage data" icon="fa-pen-to-square" />
        </>}>
        <span className="text-[10px] text-dark1/45">Cross-campaign · all content</span>
      </CompactTopbar>

      {/* Honest note — NOT a dummy banner (data is real); flags self-reported GMV + measured subset */}
      <div className="flex items-start gap-2 rounded-lg border border-cream bg-bg/60 px-3 py-2 text-[11px] text-dark1/80">
        <i className="fas fa-circle-info text-dark2 mt-0.5" />
        <span>
          <b>Efficiency metrics are real.</b> But <b>GMV is self-reported</b> by campaigns, <b>not attributed to actual Orders</b> — so this is <b>reported-GMV</b> efficiency, not true sales ROI (attribution = future / Wave 3).
          {' '}<b>{formatNumber(ov?.measuredCount ?? 0)} of {formatNumber(ov?.contentCount ?? 0)}</b> content pieces carry cost/GMV data; the analysis focuses on those (the rest are zero placeholders).
          <span className="text-dark1/50"> Per-campaign performance lives on the campaign page — this is the cross-campaign lens.</span>
        </span>
      </div>

      <IconKpiStrip tiles={tiles} extraFields={extraTiles} />

      {/* Quadrant — the fit-for-efficiency matrix */}
      <CompactPanel title="Cost × Reported-GMV — content efficiency" icon="fa-braille"
        headerRight={quad ? <span className="text-[9px] text-dark1/45">{quad.measuredCount} measured · medians: cost {shortRp(quad.medianCost)} / GMV {shortRp(quad.medianReportedGmv)}</span> : null}
        bodyClass="p-2">
        {loading ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : points.length === 0 ? <div style={{ height: 440 }} className="flex items-center justify-center text-dark1/30 text-xs">No content with cost/GMV data.</div>
          : <EfficiencyQuadrantChart points={points} medianCost={quad.medianCost} medianReportedGmv={quad.medianReportedGmv} height={440} onSelect={openDetail} />}
      </CompactPanel>

      {/* Channel mix + Tiering performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title="Channel efficiency (GMV / cost)" icon="fa-share-nodes"
          headerRight={bestChannel ? <span className="text-[9px] text-green-600 font-semibold">best: {bestChannel.label} {bestChannel.gmvPerCost}×</span> : null}
          bodyClass="p-2">
          {loading ? <div style={{ height: 240 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : <GroupBars groups={channelGroups} metric="gmvPerCost" label="GMV / cost" suffix="×" height={240} />}
        </CompactPanel>

        <CompactPanel title="Tier efficiency (GMV / cost)" icon="fa-layer-group"
          headerRight={bestTier ? <span className="text-[9px] text-green-600 font-semibold">best: {bestTier.label} {bestTier.gmvPerCost}×</span> : null}
          bodyClass="p-2">
          {loading ? <div style={{ height: 240 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
            : <>
                <GroupBars groups={tierMeasurable} metric="gmvPerCost" label="GMV / cost" suffix="×" height={200} />
                {tierNoData.length > 0 && (
                  <div className="text-[10px] text-dark1/45 mt-1 px-1">
                    No cost/GMV data: {tierNoData.map(g => `${g.label} (${g.count})`).join(', ')} — shown as no-data, not 0.
                  </div>
                )}
              </>}
        </CompactPanel>
      </div>

      {/* Engagement + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <CompactPanel title="Engagement funnel" icon="fa-heart" bodyClass="p-2">
          {eng ? (
            <div className="space-y-2">
              <MetricRow>
                <StatCard label="Views" value={formatNumber(eng.totals.views)} />
                <StatCard label="Likes" value={formatNumber(eng.totals.likes)} />
                <StatCard label="Comments" value={formatNumber(eng.totals.comments)} />
              </MetricRow>
              <MetricRow>
                <StatCard label="Like rate" value={`${eng.likeRate}%`} />
                <StatCard label="Comment rate" value={`${eng.commentRate}%`} />
                <StatCard label="Engagement" value={`${eng.engagementRate}%`} />
              </MetricRow>
              {/* funnel bars (Views → Likes → Comments) */}
              <div className="space-y-1 pt-1">
                {[['Views', eng.totals.views], ['Likes', eng.totals.likes], ['Comments', eng.totals.comments]].map(([k, v]) => {
                  const w = eng.totals.views > 0 ? (v / eng.totals.views) * 100 : 0
                  return <div key={k}>
                    <div className="flex justify-between text-[10px] text-dark1/60"><span>{k}</span><span>{formatNumber(v)}</span></div>
                    <div className="h-1.5 bg-dark1/10 rounded overflow-hidden"><div className="h-full rounded" style={{ width: `${Math.max(w, 1)}%`, background: '#E07B39' }} /></div>
                  </div>
                })}
              </div>
            </div>
          ) : <div className="text-dark1/30 text-xs text-center py-6">No engagement data.</div>}
        </CompactPanel>

        <CompactPanel title="Efficiency leaderboard (GMV / cost)" icon="fa-ranking-star" bodyClass="p-2">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-[10px] font-semibold text-green-600 mb-1">▲ Top — most efficient</div>
              {top.map((c, i) => (
                <button key={c.id} onClick={() => openDetail(c.id)} className="w-full flex justify-between items-center py-0.5 hover:bg-bg rounded px-1 text-left">
                  <span className="truncate">{i + 1}. {c.name}</span><span className="font-semibold text-green-600 ml-1">{c.gmvPerCost}×</span>
                </button>
              ))}
              {top.length === 0 && <div className="text-dark1/30">—</div>}
            </div>
            <div>
              <div className="text-[10px] font-semibold text-red-500 mb-1">▼ Bottom — least efficient</div>
              {bottom.map((c, i) => (
                <button key={c.id} onClick={() => openDetail(c.id)} className="w-full flex justify-between items-center py-0.5 hover:bg-bg rounded px-1 text-left">
                  <span className="truncate">{i + 1}. {c.name}</span><span className="font-semibold text-red-500 ml-1">{c.gmvPerCost}×</span>
                </button>
              ))}
              {bottom.length === 0 && <div className="text-dark1/30">—</div>}
            </div>
          </div>
          <p className="text-[9px] text-dark1/40 mt-2">Ranked by reported-GMV per cost (cost&gt;0 &amp; GMV&gt;0 only). Click to inspect.</p>
        </CompactPanel>
      </div>

      {/* Content table (measured) */}
      <CompactPanel title={`Content — ${points.length} measured`} icon="fa-table" bodyClass="p-2">
        <DataGrid data={points} columns={columns} searchable onRowClick={r => openDetail(r.id)}
          defaultSort={{ key: 'gmvPerCost', dir: 'desc' }} pageSize={25} loading={loading}
          emptyText="No content with cost/GMV data." extraFields={extraColumns} />
        <p className="text-[10px] text-dark1/40 mt-1">{formatNumber(ov?.measuredCount ?? 0)} of {formatNumber(ov?.contentCount ?? 0)} pieces have cost/GMV data (rest are placeholders). GMV = self-reported, not attributed. Click a row for detail.</p>
      </CompactPanel>

      {detail && <DetailModal detail={detail} color={quadColor(detail.quadrant)} onClose={() => setDetail(null)} />}
      <CalculatedFieldModal isOpen={showCalc} onClose={() => setShowCalc(false)} module={MODULE}
        manifest={manifest} sampleValues={overviewValues} sampleLabel="overview averages" onSaved={reloadCalc} />
      <AnalyticsAIPanel module="campaign-efficiency" context={data}
        suggestions={['Which creators are most efficient?', 'Is this GMV real sales?']} />
    </CompactPage>
  )
}
