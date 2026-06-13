'use client'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

export default function ImportCsvModal({ onClose }) {
  const [date, setDate]       = useState('')
  const [file, setFile]       = useState(null)
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  const handleImport = async () => {
    if (!date) { toast.error('Please select import date'); return }
    if (!file) { toast.error('Please select a CSV file'); return }
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    const r    = await fetch(`/api/affiliate/shopee/import?date=${date}`, { method: 'POST', body: fd })
    const data = await r.json()
    if (!r.ok) { toast.error(data.error ?? 'Import failed'); setLoading(false); return }
    setResult(data)
    toast.success(`Imported ${data.imported} rows`)
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-dark1 flex items-center gap-2">
            <i className="fas fa-file-csv text-orange"></i> Import Affiliate Shopee (CSV)
          </h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="text-xs font-medium text-dark2 mb-1 block">Import Date <span className="text-red-500">*</span></label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-cream rounded text-xs px-2 py-1.5 text-dark1 focus:outline-none focus:border-dark2 bg-white w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-dark2 mb-1 block">CSV File</label>
            <input type="file" accept=".csv"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
              className="w-full text-xs text-dark1 border border-cream rounded px-2 py-1.5 file:mr-2 file:text-xs file:border-0 file:bg-bg file:text-dark1 file:rounded file:px-2 file:py-0.5" />
          </div>
          {result && (
            <div className="rounded bg-green-50 border border-green-200 p-3 text-xs">
              <span className="text-green-700 font-medium">✓ {result.imported} rows imported</span>
              {result.skipped > 0 && <span className="ml-3 text-amber-600">⚠ {result.skipped} skipped</span>}
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
