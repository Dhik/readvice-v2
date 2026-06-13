'use client'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

export default function DeleteRangeModal({ onClose, onDelete }) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [loading, setLoading]   = useState(false)

  const handleDelete = async () => {
    if (!dateFrom || !dateTo) { toast.error('Both dates required'); return }
    setLoading(true)
    await onDelete({ dateFrom, dateTo })
    setLoading(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2">
            <i className="fas fa-trash-alt"></i> Delete Date Range
          </h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>
        <div className="modal-body space-y-4">
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">
            <i className="fas fa-exclamation-triangle mr-1"></i>
            This will permanently delete <strong>ALL records</strong> in the selected date range. This cannot be undone.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border border-cream rounded text-xs px-2 py-1.5 text-dark1 focus:outline-none focus:border-dark2 bg-white w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border border-cream rounded text-xs px-2 py-1.5 text-dark1 focus:outline-none focus:border-dark2 bg-white w-full" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="sv-tbtn sv-tbtn-ghost" onClick={onClose}>Cancel</button>
          <button className="sv-tbtn sv-tbtn-outline-r" onClick={handleDelete} disabled={loading}>
            {loading ? 'Deleting...' : <><i className="fas fa-trash-alt mr-1"></i>Delete</>}
          </button>
        </div>
      </div>
    </div>
  )
}
