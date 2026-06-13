'use client'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

export default function ImportAmsModal({ onClose }) {
  const [file, setFile]       = useState(null)
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  const handleImport = async () => {
    if (!file) { toast.error('Please select an Excel file'); return }
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    const r    = await fetch('/api/affiliate/shopee/import-excel', { method: 'POST', body: fd })
    const data = await r.json()
    if (!r.ok) { toast.error(data.error ?? 'Import failed'); setLoading(false); return }
    setResult(data)
    toast.success(`Created ${data.created}, updated ${data.updated}`)
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-dark1 flex items-center gap-2">
            <i className="fas fa-file-excel text-green-600"></i> Import AMS Excel
          </h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>
        <div className="modal-body space-y-4">
          <div className="text-xs text-dark2/80 bg-amber-50 border border-amber-200 rounded p-3">
            <p><i className="fas fa-info-circle text-amber-500 mr-1"></i>Filename must be: <strong>YYYY.MM.DD.xlsx</strong></p>
            <p className="mt-1">Only the <strong>"By Channel"</strong> sheet will be processed.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-dark2 mb-1 block">Excel File (.xlsx, .xls)</label>
            <input type="file" accept=".xlsx,.xls"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
              className="w-full text-xs text-dark1 border border-cream rounded px-2 py-1.5 file:mr-2 file:text-xs file:border-0 file:bg-bg file:text-dark1 file:rounded file:px-2 file:py-0.5" />
          </div>
          {result && (
            <div className="rounded bg-green-50 border border-green-200 p-3 text-xs space-y-0.5">
              <div className="text-green-700 font-medium">✓ {result.created} created</div>
              <div className="text-blue-700">↺ {result.updated} updated</div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="sv-tbtn sv-tbtn-ghost" onClick={onClose}>Cancel</button>
          <button className="sv-tbtn sv-tbtn-dark" onClick={handleImport} disabled={loading}>
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
