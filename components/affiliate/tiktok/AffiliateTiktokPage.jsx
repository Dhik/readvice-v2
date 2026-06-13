'use client'
import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { getTiktokPerformanceBadge } from '@/lib/affiliate-utils'
import TiktokChartPanel from './TiktokChartPanel'
import TiktokDetailModal from './TiktokDetailModal'
import ImportCreatorModal from './ImportCreatorModal'
import ImportGmvModal from './ImportGmvModal'
import DeleteRangeModal from '../shopee/DeleteRangeModal'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)
const fmtPct = n => (n ?? 0).toFixed(2) + '%'
const LIMIT  = 15

export default function AffiliateTiktokPage() {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const [detailDate,        setDetailDate]        = useState(null)
  const [showImportCreator, setShowImportCreator] = useState(false)
  const [showImportGmv,     setShowImportGmv]     = useState(false)
  const [showDeleteRange,   setShowDeleteRange]   = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page, limit: LIMIT })
      if (dateFrom) p.set('dateFrom', dateFrom)
      if (dateTo)   p.set('dateTo',   dateTo)
      const r = await fetch(`/api/affiliate/tiktok?${p}`).then(r => r.json())
      setRows(r.data ?? [])
      setTotal(r.total ?? 0)
      const data = r.data ?? []
      const agg = data.reduce((acc, d) => ({
        creators: Math.max(acc.creators, d.creator_count ?? 0),
        gmv:      acc.gmv      + (d.affiliate_gmv   ?? 0),
        products: acc.products + (d.products_sold   ?? 0),
        comm:     acc.comm     + (d.est_commission  ?? 0),
        conv:     acc.conv     + (d.conversion_rate ?? 0),
        n:        acc.n + 1,
      }), { creators: 0, gmv: 0, products: 0, comm: 0, conv: 0, n: 0 })
      setMetrics(agg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, dateFrom, dateTo])

  const handleDelete = async ({ dateFrom: df, dateTo: dt }) => {
    const p = new URLSearchParams({ dateFrom: df, dateTo: dt })
    const r = await fetch(`/api/affiliate/tiktok?${p}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Records deleted'); load() }
    else toast.error('Delete failed')
  }

  const handleExport = async () => {
    const p = new URLSearchParams({ dateFrom, dateTo })
    const r = await fetch(`/api/affiliate/tiktok/export?${p}`).then(r => r.json())
    if (r.sheetUrl) { toast.success('Exported to Google Sheets!'); window.open(r.sheetUrl, '_blank') }
    else toast.error(r.error ?? 'Export failed')
  }

  const totalPages = Math.ceil(total / LIMIT)

  const KPI = [
    { label: 'Creators',   val: fmtNum(metrics?.creators) },
    { label: 'Total GMV',  val: fmtRp(metrics?.gmv) },
    { label: 'Products',   val: fmtNum(metrics?.products) },
    { label: 'Commission', val: fmtRp(metrics?.comm) },
    { label: 'Avg Conv%',  val: metrics ? fmtPct((metrics.conv ?? 0) / Math.max(metrics.n, 1)) : '—' },
  ]

  return (
    <div className="sv-page">
      {/* Topbar */}
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          <i className="fas fa-film text-orange mr-1"></i> Affiliate TikTok
        </span>

        <button className="sv-tbtn sv-tbtn-ghost" onClick={() => setShowDeleteRange(true)}>
          <i className="fas fa-trash-alt"></i> Delete Range
        </button>
        <button className="sv-tbtn sv-tbtn-ghost" onClick={() => setShowImportCreator(true)}>
          <i className="fas fa-users"></i> Import Creator
        </button>
        <button className="sv-tbtn sv-tbtn-ghost" onClick={() => setShowImportGmv(true)}>
          <i className="fas fa-file-excel"></i> Import GMV
        </button>
        <button className="sv-tbtn sv-tbtn-success" onClick={handleExport}>
          <i className="fas fa-table"></i> Export Sheets
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="border border-cream rounded text-xs px-2 py-1 text-dark1 focus:outline-none focus:border-dark2 h-7 bg-white" />
          <span className="text-dark2/60 text-xs">–</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="border border-cream rounded text-xs px-2 py-1 text-dark1 focus:outline-none focus:border-dark2 h-7 bg-white" />
          {(dateFrom || dateTo) && (
            <button className="sv-tbtn sv-tbtn-ghost" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="sv-kpi-strip">
        {KPI.map(k => (
          <div key={k.label} className="sv-kpi-tile flex-1">
            <div className="min-w-0">
              <div className="sv-kpi-label">{k.label}</div>
              <div className="sv-kpi-value">{k.val ?? '—'}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main split */}
      <div className="sv-main">
        {/* Table panel */}
        <div className="sv-panel" style={{ flex: '0 0 60%' }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              <i className="fas fa-table text-dark2"></i> Daily Summary
            </span>
            <span className="text-xs text-dark2/60">{total} dates</span>
          </div>
          <div className="sv-panel-body p-0">
            <div className="overflow-auto h-full">
              <table className="sv-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Creators</th>
                    <th className="text-right">GMV</th>
                    <th className="text-right">Commission</th>
                    <th className="text-right">Conv%</th>
                    <th className="text-right">Refund%</th>
                    <th>Badge</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-10 text-dark2/50">
                      <i className="fas fa-spinner fa-spin mr-2"></i>Loading...
                    </td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-dark2/50">No data</td></tr>
                  ) : rows.map(r => {
                    const badge = getTiktokPerformanceBadge(r.conversion_rate)
                    return (
                      <tr key={r.date} className="cursor-pointer"
                          onClick={() => setDetailDate(r.date)}>
                        <td className="font-medium">
                          {new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="text-right">{fmtNum(r.creator_count)}</td>
                        <td className="text-right font-semibold" style={{ color: '#E07B39' }}>{fmtRp(r.affiliate_gmv)}</td>
                        <td className="text-right">{fmtRp(r.est_commission)}</td>
                        <td className="text-right">{fmtPct(r.conversion_rate)}</td>
                        <td className="text-right">{fmtPct(r.refund_rate)}</td>
                        <td>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-between items-center px-3 py-2 border-t border-cream/60 flex-shrink-0">
                <button className="sv-tbtn sv-tbtn-ghost text-[11px] h-6 px-2"
                        disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                <span className="text-xs text-dark2/60">{page} / {totalPages}</span>
                <button className="sv-tbtn sv-tbtn-ghost text-[11px] h-6 px-2"
                        disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>

        {/* Chart panel */}
        <TiktokChartPanel dateFrom={dateFrom} dateTo={dateTo} metrics={metrics} />
      </div>

      {/* Modals */}
      {detailDate        && <TiktokDetailModal  date={detailDate} onClose={() => setDetailDate(null)} />}
      {showImportCreator && <ImportCreatorModal onClose={() => { setShowImportCreator(false); load() }} />}
      {showImportGmv     && <ImportGmvModal     onClose={() => { setShowImportGmv(false);     load() }} />}
      {showDeleteRange   && <DeleteRangeModal   onClose={() => setShowDeleteRange(false)} onDelete={handleDelete} />}
    </div>
  )
}
