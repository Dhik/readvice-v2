'use client'
import { useEffect, useState } from 'react'
import KpiStrip from '@/components/ui/KpiStrip'
import { formatCurrency, formatNumber, currentMonth } from '@/lib/utils'
import * as XLSX from 'xlsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileExcel, faDownload } from '@fortawesome/free-solid-svg-icons'

const PLATFORMS = ['All', 'Shopee', 'TikTok', 'Lazada']

export default function ReportPage() {
  const [month, setMonth]       = useState(currentMonth())
  const [platform, setPlatform] = useState('')
  const [summary, setSummary]   = useState(null)
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (month)    params.set('month', month)
    if (platform) params.set('platform', platform.toLowerCase())
    Promise.all([
      fetch(`/api/sales/summary?${params}`).then(r => r.json()),
      fetch(`/api/sales?${params}&limit=100`).then(r => r.json()),
    ]).then(([sum, data]) => {
      setSummary(sum)
      setRows(data.data ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [month, platform])

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
      Date:     r.orderDate,
      Platform: r.platform,
      'Order ID': r.orderId,
      GMV:      r.gmv,
      Nett:     r.nett,
      Qty:      r.qty,
      Status:   r.status,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report')
    XLSX.writeFile(wb, `sales-report-${month}.xlsx`)
  }

  const kpiTiles = [
    { label: 'Total GMV',    value: loading ? '—' : formatCurrency(summary?.total_gmv   ?? 0) },
    { label: 'Total Nett',   value: loading ? '—' : formatCurrency(summary?.total_nett  ?? 0) },
    { label: 'Total Orders', value: loading ? '—' : formatNumber(summary?.total_orders  ?? 0) },
    { label: 'Total Qty',    value: loading ? '—' : formatNumber(summary?.total_qty     ?? 0) },
  ]

  return (
    <div className="sv-page">
      <div className="sv-filter-bar">
        <div className="flex gap-1 tab-pills">
          {PLATFORMS.map(p => (
            <button key={p} onClick={() => setPlatform(p === 'All' ? '' : p)}
              className={`tab-pill ${(p === 'All' ? '' : p) === platform ? 'active' : ''}`}>{p}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-dark1/60">Month:</span>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="form-input !w-auto text-xs py-1" />
          <button onClick={exportExcel} className="btn btn-primary btn-sm">
            <FontAwesomeIcon icon={faFileExcel} /> Export Excel
          </button>
        </div>
      </div>

      <KpiStrip tiles={kpiTiles} cols={4} />

      <div className="sv-main">
        <div className="flex flex-col bg-white rounded-lg shadow-sm overflow-hidden flex-1">
          <div className="sv-panel-header">
            Marketing Report — {month}
            <button onClick={exportExcel} className="btn btn-outline btn-sm">
              <FontAwesomeIcon icon={faDownload} /> Download
            </button>
          </div>
          <div className="sv-panel-body">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-dark1/40">Loading...</div>
            ) : (
              <table className="sv-table w-full">
                <thead>
                  <tr>
                    {['Date','Platform','Order ID','GMV','Nett','Qty','Status'].map(h => (
                      <th key={h} className="bg-dark1 text-white text-xs font-semibold px-3 py-2 text-left whitespace-nowrap border-b-2 border-orange">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-bg/60">
                      <td className="px-3 py-1.5 border-b border-cream/40 text-xs">{new Date(row.orderDate).toLocaleDateString('id-ID')}</td>
                      <td className="px-3 py-1.5 border-b border-cream/40 text-xs">{row.platform}</td>
                      <td className="px-3 py-1.5 border-b border-cream/40 text-xs font-mono text-[10px]">{row.orderId ?? '—'}</td>
                      <td className="px-3 py-1.5 border-b border-cream/40 text-xs">{formatCurrency(Number(row.gmv??0))}</td>
                      <td className="px-3 py-1.5 border-b border-cream/40 text-xs">{formatCurrency(Number(row.nett??0))}</td>
                      <td className="px-3 py-1.5 border-b border-cream/40 text-xs">{formatNumber(row.qty??0)}</td>
                      <td className="px-3 py-1.5 border-b border-cream/40 text-xs">{row.status ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
