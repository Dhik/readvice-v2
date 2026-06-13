'use client'
import { useState } from 'react'

export default function KolExportModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)

  const last30 = () => {
    const end   = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    return {
      start: start.toISOString().split('T')[0],
      end:   end.toISOString().split('T')[0],
    }
  }

  const [startDate, setStartDate] = useState(last30().start)
  const [endDate,   setEndDate]   = useState(last30().end)

  if (!isOpen) return null

  function handleExport() {
    setLoading(true)
    window.location.href = `/api/campaigns/kol/export-content?start_date=${startDate}&end_date=${endDate}`
    setTimeout(() => { setLoading(false); onClose() }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream">
          <h3 className="font-semibold text-dark1 text-sm flex items-center gap-2">
            <i className="fas fa-file-excel text-green-600"></i> Export KOL Content
          </h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl">&times;</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-dark2 mb-1 block">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none focus:border-dark2" />
          </div>
          <div>
            <label className="text-xs font-medium text-dark2 mb-1 block">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none focus:border-dark2" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-cream">
          <button onClick={onClose} className="sv-act-btn sv-act-outline text-xs">Cancel</button>
          <button onClick={handleExport} disabled={loading}
            className="sv-act-btn sv-act-success text-xs flex items-center gap-1">
            {loading
              ? <i className="fas fa-spinner fa-spin"></i>
              : <i className="fas fa-file-download"></i>}
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
