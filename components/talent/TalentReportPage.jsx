'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const TYPE_COLORS = {
  Affiliate:         '#E07B39',
  KOL:               '#2C3639',
  'Content Creator': '#3F4E4F',
  Clipper:           '#8B5E3C',
}
const TYPES      = ['Affiliate', 'KOL', 'Content Creator', 'Clipper']
const TABLE_LIMIT = 15   // client-side page size (compact display)

function fmtRp(n) {
  if (!n && n !== 0) return '—'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n))
}

function fmtRpShort(n) {
  if (!n && n !== 0) return 'Rp 0'
  const num = Number(n)
  if (num >= 1_000_000_000) return 'Rp ' + (num / 1_000_000_000).toFixed(1) + 'B'
  if (num >= 1_000_000)     return 'Rp ' + (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000)         return 'Rp ' + (num / 1_000).toFixed(0) + 'K'
  return 'Rp ' + num
}

function statusBadge(status) {
  if (!status) return <span className="badge">—</span>
  if (status.includes('50%') && !status.includes('Pelunasan'))
    return <span className="badge badge-warning">{status}</span>
  if (status === 'Full Payment' || status.includes('Pelunasan'))
    return <span className="badge badge-success">{status}</span>
  return <span className="badge">{status}</span>
}

/* ─────────────────────────────────────────────
   Analytics Panel  (right column)
───────────────────────────────────────────── */
function AnalyticsPanel({ hutang, report }) {
  const donutRef  = useRef(null)
  const donutInst = useRef(null)

  /* Donut: spending by talent type */
  useEffect(() => {
    if (!donutRef.current) return
    if (donutInst.current) { donutInst.current.destroy(); donutInst.current = null }

    const spendByType = TYPES
      .map(t => ({
        type:  t,
        total: report.filter(r => r.type === t).reduce((s, r) => s + Number(r.amount_tf ?? 0), 0),
        color: TYPE_COLORS[t],
      }))
      .filter(t => t.total > 0)

    if (spendByType.length === 0) return

    donutInst.current = new Chart(donutRef.current, {
      type: 'doughnut',
      data: {
        labels:   spendByType.map(t => t.type),
        datasets: [{
          data:            spendByType.map(t => t.total),
          backgroundColor: spendByType.map(t => t.color),
          borderWidth:     2,
          borderColor:     '#fff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 9 }, padding: 8, boxWidth: 10, color: '#666' },
          },
          tooltip: {
            callbacks: { label: ctx => ` ${fmtRpShort(ctx.raw)}` },
          },
        },
      },
    })

    return () => { if (donutInst.current) { donutInst.current.destroy(); donutInst.current = null } }
  }, [report])

  /* Derived stats */
  const top5Hutang  = [...hutang].sort((a, b) => b.hutang - a.hutang).filter(r => r.hutang > 0).slice(0, 5)
  const maxHutang   = top5Hutang.length > 0 ? top5Hutang[0].hutang : 1
  const outstanding = hutang.filter(r => r.hutang   > 0).length
  const settled     = hutang.filter(r => r.hutang === 0 && r.piutang === 0).length
  const overpaid    = hutang.filter(r => r.piutang  > 0).length
  const noData      = report.length === 0 && hutang.length === 0

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Dark panel header */}
      <div
        className="px-3 py-1.5 flex items-center justify-between flex-shrink-0"
        style={{ background: '#2C3639', borderBottom: '2px solid #E07B39' }}
      >
        <span className="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">
          <i className="fas fa-chart-pie text-orange"></i> Analytics
        </span>
        <span className="text-[9px] text-white/30">{report.length} txn · {hutang.length} talents</span>
      </div>

      {noData ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-2 text-dark1/20">
          <i className="fas fa-chart-bar text-3xl"></i>
          <span className="text-xs">No data to visualise</span>
        </div>
      ) : (
        <>
          {/* ── Donut: Spending by Type ─────────────────── */}
          <div
            className="px-3 pt-2.5 pb-2 border-b border-cream/60 flex-shrink-0"
            style={{ height: 200 }}
          >
            <div className="text-[9px] font-bold text-dark1/40 uppercase tracking-widest mb-1.5">
              Spending by Type
            </div>
            {report.length === 0 ? (
              <div className="flex items-center justify-center h-full text-dark1/20 text-[10px]">No data</div>
            ) : (
              <div style={{ height: 156 }}>
                <canvas ref={donutRef} />
              </div>
            )}
          </div>

          {/* ── Top Outstanding Hutang (CSS bars) ──────── */}
          <div className="p-2.5 border-b border-cream/60 flex-shrink-0">
            <div className="text-[9px] font-bold text-dark1/40 uppercase tracking-widest mb-2">
              Top Outstanding
            </div>
            {top5Hutang.length === 0 ? (
              <div className="text-[10px] text-green-500 flex items-center gap-1.5 py-1">
                <i className="fas fa-check-circle"></i> All talents settled
              </div>
            ) : top5Hutang.map(r => (
              <div key={r.username} className="mb-2">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[10px] font-semibold text-dark1 truncate max-w-[110px]">
                    @{r.username}
                  </span>
                  <span className="text-[10px] font-bold text-red-500 ml-1 whitespace-nowrap">
                    {fmtRpShort(r.hutang)}
                  </span>
                </div>
                <div className="h-1.5 bg-red-50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:      `${Math.round((r.hutang / maxHutang) * 100)}%`,
                      background: '#ef4444',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── Balance Sheet Counts ────────────────────── */}
          <div className="p-2.5 flex-1">
            <div className="text-[9px] font-bold text-dark1/40 uppercase tracking-widest mb-2">
              Balance Sheet
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Outstanding', val: outstanding,   color: '#ef4444' },
                { label: 'Settled',     val: settled,       color: '#22c55e' },
                { label: 'Overpaid',    val: overpaid,      color: '#f59e0b' },
                { label: 'Total',       val: hutang.length, color: '#2C3639' },
              ].map(item => (
                <div key={item.label} className="bg-bg rounded-lg px-2 py-1.5">
                  <div className="text-[8px] text-dark1/40 uppercase tracking-wide">{item.label}</div>
                  <div className="text-sm font-bold leading-tight" style={{ color: item.color }}>
                    {item.val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function TalentReportPage() {
  /* ── filters ── */
  const [username,   setUsername]   = useState('')
  const [talentType, setTalentType] = useState('')
  const [startDate,  setStartDate]  = useState('')
  const [endDate,    setEndDate]    = useState('')

  /* ── tab ── */
  const [tab, setTab] = useState('summary')

  /* ── KPI ── */
  const [kpi, setKpi] = useState(null)

  /* ── hutang data (load up to 200 — used for table + chart) ── */
  const [hutang,     setHutang]     = useState([])
  const [hutangLoad, setHutangLoad] = useState(false)
  const [hutangPage, setHutangPage] = useState(1)

  /* ── payment-report data (load up to 200) ── */
  const [report,     setReport]     = useState([])
  const [reportLoad, setReportLoad] = useState(false)
  const [reportPage, setReportPage] = useState(1)

  /* Build dateRange string only when both dates are set */
  const dateRange = startDate && endDate ? `${startDate} - ${endDate}` : ''

  /* ── Loaders ── */
  const loadKpi = useCallback(async () => {
    try {
      const p = new URLSearchParams()
      if (username)   p.set('username',   username)
      if (talentType) p.set('talentType', talentType)
      if (dateRange)  p.set('dateRange',  dateRange)
      const res  = await fetch('/api/talent-payments/kpi?' + p)
      const data = await res.json()
      setKpi(data.totals ?? null)
    } catch {}
  }, [username, talentType, dateRange])

  const loadHutang = useCallback(async () => {
    setHutangLoad(true)
    try {
      const p = new URLSearchParams({ page: 1, limit: 200 })
      if (username)   p.set('username',   username)
      if (talentType) p.set('talentType', talentType)
      if (dateRange)  p.set('dateRange',  dateRange)
      const res  = await fetch('/api/talent-payments/hutang-data?' + p)
      const data = await res.json()
      setHutang(data.data ?? [])
    } catch {} finally { setHutangLoad(false) }
  }, [username, talentType, dateRange])

  const loadReport = useCallback(async () => {
    setReportLoad(true)
    try {
      const p = new URLSearchParams({ page: 1, limit: 200 })
      if (username)   p.set('username',   username)
      if (talentType) p.set('talentType', talentType)
      if (dateRange)  p.set('dateRange',  dateRange)
      const res  = await fetch('/api/talent-payments/payment-report?' + p)
      const data = await res.json()
      setReport(data.data ?? [])
    } catch {} finally { setReportLoad(false) }
  }, [username, talentType, dateRange])

  /* Reset client-side pages when filters change */
  useEffect(() => { setHutangPage(1); setReportPage(1) }, [username, talentType, dateRange])

  useEffect(() => { loadKpi()    }, [loadKpi])
  useEffect(() => { loadHutang() }, [loadHutang])
  useEffect(() => { loadReport() }, [loadReport])

  function clearFilters() {
    setUsername(''); setTalentType(''); setStartDate(''); setEndDate('')
  }

  /* Client-side pagination slices */
  const hutangSlice  = hutang.slice((hutangPage - 1) * TABLE_LIMIT, hutangPage * TABLE_LIMIT)
  const reportSlice  = report.slice((reportPage - 1) * TABLE_LIMIT, reportPage * TABLE_LIMIT)
  const hutangPages  = Math.ceil(hutang.length / TABLE_LIMIT)
  const reportPages  = Math.ceil(report.length / TABLE_LIMIT)

  const isLoading    = hutangLoad || reportLoad
  const activePages  = tab === 'summary' ? hutangPages : reportPages
  const activePage   = tab === 'summary' ? hutangPage  : reportPage
  const setActivePage = tab === 'summary' ? setHutangPage : setReportPage
  const activeCount  = tab === 'summary' ? hutang.length : report.length

  return (
    <div className="sv-page p-3 gap-2">

      {/* ── Topbar ── */}
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          <i className="fas fa-chart-bar text-orange mr-1"></i> Financial Report
        </span>

        {/* Type filter */}
        <select
          className="form-input text-xs h-7 w-36"
          value={talentType}
          onChange={e => setTalentType(e.target.value)}
        >
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Username search */}
        <input
          type="text"
          placeholder="@username..."
          className="form-input text-xs h-7 w-28"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />

        <div className="w-px h-5 bg-cream/80 mx-0.5" />

        {/* Date range — two date pickers */}
        <input
          type="date"
          className="form-input text-xs h-7 w-36"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          title="Start date"
        />
        <span className="text-dark1/40 text-xs select-none">–</span>
        <input
          type="date"
          className="form-input text-xs h-7 w-36"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          title="End date"
        />

        {/* Clear */}
        <button
          onClick={clearFilters}
          className="sv-tbtn sv-tbtn-ghost"
          title="Clear all filters"
        >
          <i className="fas fa-times"></i>
        </button>

        {isLoading && (
          <i className="fas fa-circle-notch fa-spin text-orange/60 text-xs ml-1"></i>
        )}
      </div>

      {/* ── KPI Strip ── */}
      <div
        className="sv-kpi-strip"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}
      >
        {[
          {
            label: 'Total Spent',
            value: kpi ? fmtRpShort(kpi.total_spent)   : '…',
            sub:   kpi ? fmtRp(kpi.total_spent)        : '',
            icon:  'fa-coins',
            bg:    '#E07B39',
          },
          {
            label: 'Total Hutang',
            value: kpi ? fmtRpShort(kpi.total_hutang)  : '…',
            sub:   kpi ? fmtRp(kpi.total_hutang)       : '',
            icon:  'fa-arrow-circle-down',
            bg:    '#dc3545',
          },
          {
            label: 'Total Piutang',
            value: kpi ? fmtRpShort(kpi.total_piutang) : '…',
            sub:   kpi ? fmtRp(kpi.total_piutang)      : '',
            icon:  'fa-arrow-circle-up',
            bg:    '#22c55e',
          },
        ].map(t => (
          <div key={t.label} className="kpi-tile">
            <div className="kpi-tile-icon" style={{ background: t.bg }}>
              <i className={`fas ${t.icon}`}></i>
            </div>
            <div className="min-w-0">
              <div className="kpi-tile-label">{t.label}</div>
              <div className="kpi-tile-value">{t.value}</div>
              {t.sub && <div className="text-[9px] text-dark1/30 truncate leading-tight">{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Split ── */}
      <div className="sv-main">

        {/* ── Left: Tabbed table panel ─────────────────── */}
        <div className="sv-panel" style={{ flex: '0 0 60%' }}>

          {/* Tab switcher lives in the panel header */}
          <div className="sv-panel-header">
            <div className="flex gap-1">
              {[
                { key: 'summary', label: 'Financial Summary', icon: 'fa-balance-scale', count: hutang.length },
                { key: 'history', label: 'Payment History',   icon: 'fa-history',       count: report.length },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="sv-tbtn flex items-center gap-1"
                  style={tab === t.key
                    ? { background: '#2C3639', borderColor: '#2C3639', color: '#fff' }
                    : { background: 'transparent', borderColor: '#ddd', color: '#666' }
                  }
                >
                  <i className={`fas ${t.icon} text-[9px]`}></i>
                  {t.label}
                  <span
                    className="text-[9px] px-1 rounded ml-0.5"
                    style={tab === t.key
                      ? { background: 'rgba(255,255,255,.15)', color: '#fff' }
                      : { background: '#eee', color: '#999' }
                    }
                  >
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="sv-panel-body p-0">
            {tab === 'summary' ? (
              <table className="sv-table w-full">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Talent Name</th>
                    <th>Should Get</th>
                    <th>Paid</th>
                    <th>Hutang</th>
                    <th>Piutang</th>
                  </tr>
                </thead>
                <tbody>
                  {hutangLoad ? (
                    <tr><td colSpan={6} className="text-center py-8 text-dark1/40">Loading…</td></tr>
                  ) : hutangSlice.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-dark1/40">No data</td></tr>
                  ) : hutangSlice.map((r, i) => (
                    <tr key={i}>
                      <td className="font-semibold text-dark1">@{r.username}</td>
                      <td className="text-dark1/70">{r.talent_name}</td>
                      <td className="text-dark1/80">{fmtRpShort(r.talent_should_get)}</td>
                      <td className="text-dark1/80">{fmtRpShort(r.total_spent)}</td>
                      <td className={r.hutang > 0 ? 'font-bold text-red-600' : 'text-dark1/30'}>
                        {r.hutang > 0 ? fmtRpShort(r.hutang) : '—'}
                      </td>
                      <td className={r.piutang > 0 ? 'font-bold text-green-600' : 'text-dark1/30'}>
                        {r.piutang > 0 ? fmtRpShort(r.piutang) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="sv-table w-full">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>PIC</th>
                    <th>Done</th>
                    <th>Amount TF</th>
                  </tr>
                </thead>
                <tbody>
                  {reportLoad ? (
                    <tr><td colSpan={6} className="text-center py-8 text-dark1/40">Loading…</td></tr>
                  ) : reportSlice.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-dark1/40">No records</td></tr>
                  ) : reportSlice.map(p => {
                    const tc = TYPE_COLORS[p.type] ?? '#888'
                    return (
                      <tr key={p.id} style={{ borderLeft: `3px solid ${tc}` }}>
                        <td className="font-semibold text-dark1">@{p.username}</td>
                        <td>
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white whitespace-nowrap"
                            style={{ background: tc }}
                          >
                            {p.type}
                          </span>
                        </td>
                        <td>{statusBadge(p.status_payment)}</td>
                        <td className="text-dark1/60">{p.pic || '—'}</td>
                        <td className="text-dark1/60 whitespace-nowrap">{p.done_payment ?? '—'}</td>
                        <td className="font-bold text-orange whitespace-nowrap">{fmtRpShort(p.amount_tf)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {activePages > 1 && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-cream/60 text-xs flex-shrink-0">
              <button
                onClick={() => setActivePage(p => Math.max(1, p - 1))}
                disabled={activePage === 1}
                className="sv-tbtn sv-tbtn-ghost"
              >‹</button>
              <span className="text-dark1/50">
                Page {activePage} / {activePages} · {activeCount} {tab === 'summary' ? 'talents' : 'records'}
              </span>
              <button
                onClick={() => setActivePage(p => Math.min(activePages, p + 1))}
                disabled={activePage === activePages}
                className="sv-tbtn sv-tbtn-ghost"
              >›</button>
            </div>
          )}
        </div>

        {/* ── Right: Analytics Panel ───────────────────── */}
        <div className="sv-panel" style={{ flex: 1 }}>
          <AnalyticsPanel hutang={hutang} report={report} />
        </div>

      </div>
    </div>
  )
}
