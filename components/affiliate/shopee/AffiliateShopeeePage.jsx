'use client'
import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { getShopeePerformanceBadge } from '@/lib/affiliate-utils'
import ShopeeChartPanel from './ShopeeChartPanel'
import ShopeeDetailModal from './ShopeeDetailModal'
import ImportCsvModal from './ImportCsvModal'
import ImportAmsModal from './ImportAmsModal'
import DeleteRangeModal from './DeleteRangeModal'

const fmtRp  = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
const fmtNum = n => new Intl.NumberFormat('id-ID').format(n ?? 0)
const fmtPct = n => (n ?? 0).toFixed(1) + '%'
const LIMIT  = 15

export default function AffiliateShopeeePage() {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const [detailDate,     setDetailDate]     = useState(null)
  const [showImportCsv,  setShowImportCsv]  = useState(false)
  const [showImportAms,  setShowImportAms]  = useState(false)
  const [showDeleteRange, setShowDeleteRange] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const p1 = new URLSearchParams({ page, limit: LIMIT })
      if (dateFrom) p1.set('dateFrom', dateFrom)
      if (dateTo)   p1.set('dateTo',   dateTo)
      const p2 = new URLSearchParams()
      if (dateFrom) p2.set('dateFrom', dateFrom)
      if (dateTo)   p2.set('dateTo',   dateTo)
      const [r1, r2] = await Promise.all([
        fetch(`/api/affiliate/shopee?${p1}`).then(r => r.json()),
        fetch(`/api/affiliate/shopee/key-metrics?${p2}`).then(r => r.json()),
      ])
      setRows(r1.data ?? [])
      setTotal(r1.total ?? 0)
      setMetrics(r2)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, dateFrom, dateTo])

  const handleDelete = async ({ dateFrom: df, dateTo: dt }) => {
    const p = new URLSearchParams({ dateFrom: df, dateTo: dt })
    const r = await fetch(`/api/affiliate/shopee?${p}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Records deleted'); load() }
    else toast.error('Delete failed')
  }

  const totalPages = Math.ceil(total / LIMIT)

  const KPI = [
    { label: 'Affiliates',   val: fmtNum(metrics?.total_affiliates) },
    { label: 'Orders',       val: fmtNum(metrics?.total_orders) },
    { label: 'Total GMV',    val: fmtRp(metrics?.total_gmv) },
    { label: 'Commission',   val: fmtRp(metrics?.total_commission) },
    { label: 'Avg ROI',      val: fmtPct(metrics?.avg_roi) },
    { label: 'New Buyer %',  val: fmtPct(metrics?.new_buyer_rate) },
  ]

  return (
    <div className="sv-page">
      {/* Topbar */}
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          <i className="fas fa-store text-orange mr-1"></i> Affiliate Shopee
        </span>

        <button className="sv-tbtn sv-tbtn-ghost" onClick={() => setShowDeleteRange(true)}>
          <i className="fas fa-trash-alt"></i> Delete Range
        </button>
        <button className="sv-tbtn sv-tbtn-ghost" onClick={() => setShowImportCsv(true)}>
          <i className="fas fa-file-csv"></i> Import CSV
        </button>
        <button className="sv-tbtn sv-tbtn-ghost" onClick={() => setShowImportAms(true)}>
          <i className="fas fa-file-excel"></i> Import AMS
        </button>
        <a href={`/api/affiliate/shopee/export?${new URLSearchParams({ dateFrom, dateTo })}`}
           className="sv-tbtn sv-tbtn-success">
          <i className="fas fa-file-download"></i> Export
        </a>

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
                    <th className="text-right">Affiliates</th>
                    <th className="text-right">GMV</th>
                    <th className="text-right">Commission</th>
                    <th className="text-right">ROI</th>
                    <th className="text-right">CTR</th>
                    <th className="text-right">New Buy%</th>
                    <th>Badge</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-10 text-dark2/50">
                      <i className="fas fa-spinner fa-spin mr-2"></i>Loading...
                    </td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-dark2/50">No data</td></tr>
                  ) : rows.map(r => {
                    const badge = getShopeePerformanceBadge(r.roi)
                    return (
                      <tr key={r.date} className="cursor-pointer"
                          onClick={() => setDetailDate(r.date)}>
                        <td className="font-medium">
                          {new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="text-right">{fmtNum(r.affiliate_count)}</td>
                        <td className="text-right font-semibold" style={{ color: '#E07B39' }}>{fmtRp(r.omzet_penjualan)}</td>
                        <td className="text-right">{fmtRp(r.komisi_affiliate)}</td>
                        <td className="text-right">{fmtPct(r.roi)}</td>
                        <td className="text-right">{fmtPct(r.ctr)}</td>
                        <td className="text-right">{fmtPct(r.new_buyer_rate)}</td>
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
        <ShopeeChartPanel dateFrom={dateFrom} dateTo={dateTo} metrics={metrics} />
      </div>

      {/* Modals */}
      {detailDate     && <ShopeeDetailModal date={detailDate} onClose={() => setDetailDate(null)} />}
      {showImportCsv  && <ImportCsvModal  onClose={() => { setShowImportCsv(false);  load() }} />}
      {showImportAms  && <ImportAmsModal  onClose={() => { setShowImportAms(false);  load() }} />}
      {showDeleteRange && <DeleteRangeModal onClose={() => setShowDeleteRange(false)} onDelete={handleDelete} />}
    </div>
  )
}
