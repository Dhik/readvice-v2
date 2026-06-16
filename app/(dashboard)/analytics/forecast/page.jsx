'use client'
// AI Forecasting — deep analysis (Analytics, Wave 3 §3.4). The SIXTH honesty posture:
// the honest GATE. With < 12 months of real history there is NO forecast — the page shows
// the REAL history line and, where a projection would extend, a neutral GATE message
// (never a dashed/flat/placeholder line). The forecast appears automatically once ≥12
// months exist. All logic in the engine via /api/analytics/forecast. The AI panel narrates
// only — it NEVER predicts numbers (a statistical model does that, once the gate opens).
import { useEffect, useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'
import IconKpiStrip from '@/components/dashboard/IconKpiStrip'
import CompactPanel from '@/components/dashboard/CompactPanel'
import AnalyticsAIPanel from '@/components/analytics/AnalyticsAIPanel'
import { seriesColor, withAlpha, baseOptions, mergeOptions } from '@/lib/charts/theme'
import { formatCurrency, formatNumber } from '@/lib/utils'

const shortRp = v => { const n = Number(v) || 0; if (n >= 1e9) return 'Rp' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return 'Rp' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return 'Rp' + (n / 1e3).toFixed(0) + 'K'; return 'Rp' + Math.round(n) }
const fetchJson = (url) => fetch(url).then(r => r.json()).then(d => (d?.error ? null : d)).catch(() => null)

export default function ForecastPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchJson('/api/analytics/forecast?view=readiness').then(d => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const ready = data?.ready
  const history = data?.history ?? []
  const monthsAvailable = data?.monthsAvailable ?? 0
  const monthsRequired = data?.monthsRequired ?? 12
  const remaining = Math.max(0, monthsRequired - monthsAvailable)
  const gateMessage = data?.gateMessage || `Forecasting needs ≥${monthsRequired} months of history; currently ${monthsAvailable} months — forecast not yet available`

  // CHART: ONLY the real history series. There is NO forecast dataset while gated — this is
  // the structural invariant the gate enforces (forecastSeriesCount is always 0 here).
  const historyDatasets = history.length ? [{
    label: 'Revenue — real history (GMV)', data: history.map(h => h.gmv),
    borderColor: seriesColor(0), backgroundColor: withAlpha(seriesColor(0), 0.12),
    fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: seriesColor(0),
  }] : []
  const forecastSeriesCount = 0   // ← never a predicted series while ready=false
  const chartData = { labels: history.map(h => h.month), datasets: historyDatasets }
  const opts = useMemo(() => mergeOptions(baseOptions, {
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { title: i => i[0]?.label, label: c => { const h = history[c.dataIndex]; return h ? [`Revenue: ${formatCurrency(h.gmv)}`, `Orders: ${formatNumber(h.orders)}`] : '' } } },
    },
    scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { callback: v => shortRp(v), font: { size: 9 } }, beginAtZero: true } },
  }), [history])

  const tiles = [
    { icon: 'fa-calendar-check', bg: '#3F4E4F', label: 'Months of history', value: formatNumber(monthsAvailable) },
    { icon: 'fa-bullseye', bg: '#2C3639', label: 'Months required', value: formatNumber(monthsRequired) },
    { icon: 'fa-hourglass-half', bg: ready ? '#A9C5A0' : '#E07B39', iconColor: ready ? '#2C3639' : 'white', label: ready ? 'Ready' : 'Months remaining', value: ready ? 'Yes' : formatNumber(remaining) },
    { icon: 'fa-receipt', bg: '#6B8E9E', label: 'Orders in history', value: formatNumber(data?.totalOrders ?? 0) },
  ]

  return (
    <CompactPage>
      <CompactTopbar title="AI Forecast" icon="fa-chart-line">
        <span className="text-[10px] text-dark1/45">{data?.firstMonth ? `${data.firstMonth} → ${data.lastMonth}` : 'sales forecasting'}</span>
      </CompactTopbar>

      {/* Honest GATE note — neutral (not an orange dummy banner): nothing is fabricated,
          the forecast is honestly ABSENT until enough history exists. */}
      <div className="flex items-start gap-2 rounded-lg border border-cream bg-bg/60 px-3 py-2 text-[11px] text-dark1/80">
        <i className="fas fa-circle-info text-dark2 mt-0.5" />
        <span>
          <b>{gateMessage}.</b> We <b>never show a fabricated forecast line</b> — when there isn&apos;t enough history, the honest answer is &ldquo;not yet available&rdquo;. The real revenue history below is plotted as-is; the projection appears automatically once ≥{monthsRequired} months of orders accrue (no backfill — just elapsed time).
        </span>
      </div>

      <IconKpiStrip tiles={tiles} />

      {/* Real history line — NO forecast dataset (forecastSeriesCount = 0 while gated) */}
      <CompactPanel title="Revenue history (real) — the series a model would forecast from" icon="fa-chart-line"
        headerRight={data?.firstMonth ? <span className="text-[9px] text-dark1/45">{monthsAvailable} month{monthsAvailable === 1 ? '' : 's'} · real Orders</span> : null}
        bodyClass="p-2">
        {loading ? <div style={{ height: 300 }} className="flex items-center justify-center text-dark1/30 text-xs">Loading…</div>
          : !history.length ? <div style={{ height: 300 }} className="flex flex-col items-center justify-center text-dark1/40 text-xs gap-2">
              <i className="fas fa-calendar-xmark text-2xl text-dark1/20" />
              <span>No order history yet for this tenant — forecasting needs accumulated orders.</span>
            </div>
          : <div data-forecast-chart data-history-points={history.length} data-forecast-series={forecastSeriesCount} data-ready={String(!!ready)}>
              <div style={{ height: 300 }}><Line data={chartData} options={opts} /></div>
            </div>}
      </CompactPanel>

      {/* The GATE where the projection would extend — message, NOT a line */}
      <CompactPanel title="Forecast" icon="fa-wand-magic-sparkles" bodyClass="p-0">
        <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-4">
          <i className="fas fa-lock text-2xl" style={{ color: '#E07B39' }} />
          <div className="text-sm font-semibold text-dark1">{gateMessage}</div>
          <div className="text-[11px] text-dark1/55 max-w-lg">
            No projected line is drawn — a flat or dashed placeholder would read as a prediction, and there isn&apos;t the history to make one. {ready ? 'History is sufficient; the statistical-model path is not yet wired up (stub) — still no fabricated output.' : `The forecast unlocks automatically after ${remaining} more month${remaining === 1 ? '' : 's'}.`}
          </div>
        </div>
      </CompactPanel>

      {/* How it will work when ready — names the methods; LLM is NOT a predictor */}
      <CompactPanel title="How forecasting will work when ready" icon="fa-circle-question" bodyClass="p-3">
        <div className="text-[11px] text-dark1/70 space-y-1.5">
          <p>Once <b>≥{monthsRequired} months</b> of real order history exist, a <b>statistical time-series model</b> produces the forecast — candidates: <b>{(data?.methods ?? ['Holt-Winters', 'ARIMA', 'Prophet']).join(' · ')}</b> — with a confidence band. The projected line + band appear here automatically; nothing is shown before then.</p>
          <p className="text-dark1/55"><i className="fas fa-robot text-orange/70 mr-1" /> The AI assistant <b>narrates and contextualizes</b> the history and readiness — it <b>never predicts the numbers</b>. Statistical models predict; the LLM explains. (Doc: critical distinction, §3.4.)</p>
        </div>
      </CompactPanel>

      {/* AI panel — narrative only; context = history + readiness (no forecast figures) */}
      <AnalyticsAIPanel module="forecast" context={data}
        suggestions={['How many months of history do we have?', 'When will the forecast be available?']} />
    </CompactPage>
  )
}
