'use client'
// Net P&L (Analytics, Wave 3 §3.3) — the NP3 resolution. Full waterfall (revenue → −COGS
// → −platform fee → −marketing → −tax → −opex → net). Per-layer honesty (posture #3):
// REAL layers plain; CONFIG layers (fee/tax) badged "default rate — edit in Settings"
// until configured; OPEX empty → "Net before opex" + a link to the settings editor,
// NEVER a fabricated final net. All logic in the engine via /api/analytics/pnl.
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import Link from 'next/link'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import { baseOptions, mergeOptions, withAlpha, seriesColor, SEMANTIC } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; const s = n < 0 ? '-' : ''; const a = Math.abs(n); if (a >= 1e9) return s + 'Rp' + (a / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return s + 'Rp' + (a / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return s + 'Rp' + (a / 1e3).toFixed(0) + 'K'; return s + 'Rp' + Math.round(a) }
const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)
const DEFAULT_COLOR = '#E07B39'  // config-default (orange — edit me)
const REAL_COLOR = '#3F4E4F'

const DefaultBadge = () => <span className="text-[8px] uppercase tracking-wide px-1 rounded bg-orange/15 text-orange font-semibold align-middle" title="Factual default rate — confirm/edit in Settings → P&L Rules">default</span>

// Floating-bar waterfall from engine `stages` ([base,top] + flag). Color by flag.
function PnlWaterfall({ stages = [], height = 320, onLayer }) {
  const colorFor = s => {
    if (s.flag === 'real' && s.kind === 'total') return seriesColor(7)               // Revenue
    if (s.flag === 'net') return s.value >= 0 ? SEMANTIC.success : SEMANTIC.danger    // final Net
    if (s.flag === 'netBeforeOpex') return SEMANTIC.warning                           // gated net
    if (s.flag === 'configDefault') return DEFAULT_COLOR                              // flagged config
    if (s.flag === 'notEntered') return 'rgba(120,120,120,0.4)'                       // opex empty
    return SEMANTIC.danger                                                            // real decreases / configured
  }
  const data = {
    labels: stages.map(s => s.label),
    datasets: [{
      data: stages.map(s => [s.base, s.top]),
      backgroundColor: stages.map(s => withAlpha(colorFor(s), 0.75)),
      borderColor: stages.map(colorFor), borderWidth: 1, borderSkipped: false,
    }],
  }
  const options = mergeOptions(baseOptions, {
    onClick: (_e, els) => { if (onLayer && els?.length) onLayer(stages[els[0].index]) },
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      label: c => { const s = stages[c.dataIndex]; return [`${s.label}: ${formatCurrency(s.value)}`, s.flag === 'configDefault' ? '(default rate — edit in Settings)' : s.flag === 'notEntered' ? '(opex not entered)' : s.flag === 'netBeforeOpex' ? '(before opex — not final)' : ''].filter(Boolean) },
    } } },
    scales: { x: { ticks: { font: { size: 8 }, maxRotation: 30, minRotation: 15 } }, y: { ticks: { callback: v => shortRp(v), font: { size: 9 } } } },
  })
  return <div style={{ height }}><Bar data={data} options={options} /></div>
}

export default function PnlPage() {
  const [month, setMonth] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [layer, setLayer] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const m = month ? `&month=${month}` : ''
    fetchJson(`/api/analytics/pnl?view=overview${m}`).then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [month])

  const wf = data?.waterfall
  const hasData = wf?.hasData
  const trend = data?.trend
  const L = wf?.layers
  const opexEntered = wf?.opexEntered
  const configDefault = wf?.configDefault

  const trendData = trend?.points?.length ? {
    labels: trend.points.map(p => p.date),
    datasets: [
      { label: 'Revenue', data: trend.points.map(p => p.revenue), borderColor: seriesColor(7), backgroundColor: withAlpha(seriesColor(7), 0.12), tension: 0.3, pointRadius: 1, fill: false },
      { label: 'Net before opex', data: trend.points.map(p => p.netBeforeOpex), borderColor: SEMANTIC.warning, backgroundColor: withAlpha(SEMANTIC.warning, 0.12), tension: 0.3, pointRadius: 1, fill: false },
    ],
  } : null
  const trendOpts = mergeOptions(baseOptions, {
    plugins: { legend: { position: 'top', labels: { boxWidth: 9, font: { size: 9 } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } } },
    scales: { x: { ticks: { font: { size: 8 }, maxTicksLimit: 12 } }, y: { ticks: { callback: v => shortRp(v), font: { size: 9 } } } },
  })

  const tiles = L ? [
    { icon: 'fa-dollar-sign', bg: seriesColor(7), label: 'Revenue', value: shortRp(L.revenue.value) },
    { icon: 'fa-industry', bg: '#B5645B', label: 'COGS', value: shortRp(L.cogs.value) },
    { icon: 'fa-store', bg: configDefault ? DEFAULT_COLOR : '#6B8E9E', label: 'Platform fee', value: shortRp(L.platformFee.value), dev: configDefault },
    { icon: 'fa-bullhorn', bg: '#8B5E3C', label: L.marketing.deducted ? 'Marketing' : 'Marketing (off)', value: shortRp(L.marketing.value) },
    { icon: 'fa-file-invoice-dollar', bg: configDefault ? DEFAULT_COLOR : '#6B8E9E', label: `Tax (${L.tax.pct}%)`, value: shortRp(L.tax.value), dev: configDefault },
    opexEntered
      ? { icon: 'fa-receipt', bg: '#2C3639', label: 'Opex', value: shortRp(L.opex.value) }
      : { icon: 'fa-circle-question', bg: '#9CA3AF', label: 'Opex (not entered)', value: '—' },
    opexEntered
      ? { icon: 'fa-coins', bg: '#22c55e', iconColor: '#fff', label: 'Net Profit', value: shortRp(wf.net) }
      : { icon: 'fa-lock', bg: SEMANTIC.warning, label: 'Net before opex', value: shortRp(wf.netBeforeOpex), dev: true },
  ] : []

  if (!loading && !hasData) {
    return (
      <CompactPage>
        <CompactTopbar title="Net P&L" icon="fa-scale-balanced" />
        <div className="flex flex-col items-center justify-center text-center gap-2 py-20 text-dark1/50">
          <i className="fas fa-receipt text-3xl text-dark1/20" />
          <div className="text-sm font-semibold text-dark1/70">No SKU-level revenue for this tenant</div>
          <div className="text-xs max-w-md">{wf?.note || 'Net P&L needs OrderItem + HPP (Cleora / tenant 2 in dev).'}</div>
        </div>
      </CompactPage>
    )
  }

  return (
    <CompactPage>
      <CompactTopbar title="Net P&L" icon="fa-scale-balanced"
        actions={<Link href="/settings/pnl" className="sv-tbtn sv-tbtn-dark"><i className="fas fa-sliders" /> P&L Rules</Link>}>
        <span className="text-xs text-dark1/60 ml-1">Period</span>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-cream rounded text-xs px-2 py-1 h-7 bg-white text-dark1 focus:outline-none focus:border-dark2" />
      </CompactTopbar>

      {/* Honest framing — distinguishes this from the rejected old sales×0.78 formula */}
      <div className="flex items-start gap-2 rounded-lg border border-cream bg-bg/60 px-3 py-2 text-[11px] text-dark1/80">
        <i className="fas fa-circle-info text-dark2 mt-0.5" />
        <span>
          <b>Net P&L uses your business rules.</b> Revenue, COGS &amp; marketing are <b>real</b>. Platform fees &amp; tax start from <b>researched defaults</b> — <Link href="/settings/pnl" className="underline">edit them in Settings</Link>. <b>Opex must be entered</b> to see true net — we never fabricate a net number.
          {!opexEntered && <> <b style={{ color: SEMANTIC.warning }}>Opex isn&apos;t entered yet, so the net below is &ldquo;before opex&rdquo;, not final.</b></>}
        </span>
      </div>

      <IconKpiStrip tiles={tiles} />

      {/* Opex gate callout */}
      {!opexEntered && (
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: `${SEMANTIC.warning}66`, background: `${SEMANTIC.warning}12`, color: '#92600c' }}>
          <i className="fas fa-triangle-exclamation" />
          <span><b>Opex not entered</b> — net is shown <b>before opex</b> (not a final net). </span>
          <Link href="/settings/pnl" className="underline font-semibold ml-auto">Enter opex in Settings → P&L Rules</Link>
        </div>
      )}

      {/* Waterfall */}
      <CompactPanel title="P&L waterfall — revenue → −COGS → −fee → −marketing → −tax → −opex → net" icon="fa-chart-column"
        headerRight={configDefault ? <span className="text-[9px]" style={{ color: DEFAULT_COLOR }}>fee &amp; tax = default rates · <Link href="/settings/pnl" className="underline">edit</Link></span> : <span className="text-[9px] text-green-600">rules configured</span>}
        bodyClass="p-2">
        {loading ? <div style={{ height: 320 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : <PnlWaterfall stages={wf.stages} onLayer={setLayer} />}
        <p className="text-[10px] text-dark1/45 mt-1">{wf?.note}</p>
        {layer && (
          <div className="mt-2 border-t border-cream pt-2 text-[11px]">
            <div className="flex items-center justify-between mb-1"><span className="font-semibold text-dark1">{layer.label} — {formatCurrency(layer.value)}</span><button onClick={() => setLayer(null)} className="text-dark1/40 hover:text-dark1">×</button></div>
            {/^− Platform fee/.test(layer.label) && (L.platformFee.breakdown?.length
              ? <table className="w-full"><thead><tr className="text-dark1/45 text-left"><th>Platform</th><th className="text-right">Revenue</th><th className="text-right">Fee %</th><th className="text-right">Fee</th></tr></thead>
                  <tbody>{L.platformFee.breakdown.map(b => <tr key={b.platform} className="border-t border-cream/40"><td>{b.platform}</td><td className="text-right">{formatCurrency(b.revenue)}</td><td className="text-right">{b.pct}%</td><td className="text-right">{formatCurrency(b.fee)}</td></tr>)}</tbody></table>
              : <span className="text-dark1/50">No platform revenue.</span>)}
            {/^− Opex/.test(layer.label) && (opexEntered
              ? <table className="w-full"><thead><tr className="text-dark1/45 text-left"><th>Category</th><th className="text-right">Amount</th></tr></thead><tbody>{L.opex.breakdown.map((c, i) => <tr key={i} className="border-t border-cream/40"><td>{c.label}{c.pct != null ? ` (${c.pct}%)` : ''}</td><td className="text-right">{formatCurrency(c.amount)}</td></tr>)}</tbody></table>
              : <span style={{ color: '#92600c' }}>Opex not entered — <Link href="/settings/pnl" className="underline">add categories</Link> to see true net.</span>)}
            {/Tax/.test(layer.label) && <span className="text-dark1/60">{L.tax.pct}% on {L.tax.base} {configDefault && '(default rate)'}.</span>}
            {/Marketing/.test(layer.label) && <span className="text-dark1/60">Real marketing total (reused from Ads-Allocation). {L.marketing.caveat || ''}</span>}
          </div>
        )}
      </CompactPanel>

      {/* Trend */}
      <CompactPanel title="Net-before-opex trend (per period)" icon="fa-chart-line"
        headerRight={trend?.range ? <span className="text-[9px] text-dark1/45">{trend.range.min} → {trend.range.max}</span> : null} bodyClass="p-2">
        {loading ? <div style={{ height: 260 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : !trendData ? <div style={{ height: 260 }} className="flex items-center justify-center text-dark1/30 text-xs">No trend data.</div>
          : <><div style={{ height: 260 }}><Line data={trendData} options={trendOpts} /></div>
              <p className="text-[10px] text-dark1/40 mt-1">{trend?.note}</p></>}
      </CompactPanel>

      <AnalyticsAIPanel module="pnl" context={data}
        suggestions={["What's my net profit?", 'Which P&L layers are real vs default rates?']} />
    </CompactPage>
  )
}
