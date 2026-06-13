'use client'
import { useState, useRef } from 'react'
import { toast } from 'react-hot-toast'

export default function ImportListingModal({ onClose }) {
  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const fileRef = useRef(null)

  const handleImport = async () => {
    if (!file) { toast.error('Select an Excel file first'); return }
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/affiliate/listing/import', { method: 'POST', body: fd })
    const d = await r.json()
    if (r.ok) { setResult(d); toast.success(`Imported ${d.created} listings`) }
    else toast.error(d.error ?? 'Import failed')
    setLoading(false)
  }

  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <span>Import Listing (Excel)</span>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sv-modal-body space-y-3">
          <p className="text-xs text-dark2/60">
            Upload an Excel file (.xlsx) with columns: date, pic, username, followers, gmv, kontak, sowCategory, platform, roas, rateCard, slot, remark, keterangan
          </p>
          <div
            className="border-2 border-dashed border-dark2/20 rounded-lg p-6 text-center cursor-pointer hover:border-orange/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {file ? (
              <p className="text-sm font-medium text-dark1">{file.name}</p>
            ) : (
              <p className="text-sm text-dark2/50">Click to select Excel file</p>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                 onChange={e => { setFile(e.target.files[0]); setResult(null) }} />
          {result && (
            <div className="rounded bg-green-50 border border-green-200 p-3 text-sm">
              <div className="font-medium text-green-700">Import complete</div>
              <div className="text-green-600 mt-1">Created: {result.created} listings</div>
              {result.errors?.length > 0 && (
                <div className="text-red-600 mt-1">Errors: {result.errors.length} rows skipped</div>
              )}
            </div>
          )}
        </div>
        <div className="sv-modal-footer">
          <button className="sv-btn-outline" onClick={onClose}>Close</button>
          <button className="sv-btn" onClick={handleImport} disabled={loading || !file}>
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
