'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function ImportContentModal({ isOpen, onClose, campaignId, onSuccess }) {
  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)

  if (!isOpen) return null

  async function handleImport() {
    if (!file) { toast.error('Please select a file'); return }
    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/campaign-import/content/${campaignId}`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      setResult(data)
      if (data.imported > 0) {
        toast.success(`${data.imported} rows imported`)
        onSuccess?.()
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream">
          <h3 className="font-semibold text-dark1 text-sm">Import Content</h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-dark2">
            <i className="fas fa-info-circle text-blue-500 mr-1"></i>
            Excel columns: username, creator_name, pic, task_name, channel, link, product, boost_code, kode_ads, rate_card
          </div>
          <div>
            <label className="text-xs font-medium text-dark2 mb-1 block">File (.xlsx, .xls, .csv)</label>
            <input type="file" accept=".xlsx,.xls,.csv"
              onChange={e => { setFile(e.target.files[0]); setResult(null) }}
              className="w-full text-xs text-dark1 border border-cream rounded px-2 py-1.5 file:mr-2 file:text-xs file:border-0 file:bg-bg file:text-dark1 file:rounded file:px-2 file:py-0.5" />
          </div>

          {result && (
            <div className="text-xs">
              <div className="text-green-600 font-medium">
                <i className="fas fa-check-circle mr-1"></i>
                {result.imported} rows imported successfully
              </div>
              {result.errors?.length > 0 && (
                <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-red-500">
                      {typeof e === 'string' ? e : `Row ${e.row}: ${e.reason}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-cream">
          <button onClick={onClose} className="sv-act-btn sv-act-outline text-xs">Cancel</button>
          <button onClick={handleImport} disabled={loading || !file}
            className="sv-act-btn sv-act-success text-xs flex items-center gap-1">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-upload"></i>}
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
