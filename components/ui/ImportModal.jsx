'use client'
import { useState } from 'react'

export default function ImportModal({ title, endpoint, accept = '.xlsx,.xls,.csv', extraFields = {}, onSuccess, onClose }) {
  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    Object.entries(extraFields).forEach(([k, v]) => fd.append(k, v))
    const res  = await fetch(endpoint, { method: 'POST', body: fd })
    const data = await res.json()
    setResult(data)
    setLoading(false)
    if (data.created >= 0) onSuccess?.(data)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-md">
        <div className="modal-header">
          <h3 className="font-semibold text-dark1">{title}</h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <input
              type="file"
              accept={accept}
              onChange={e => setFile(e.target.files[0])}
              className="form-input"
              required
            />
            {result && (
              <div className="mt-3 text-sm">
                <span className="text-green-600">✓ {result.created ?? result.imported ?? 0} imported</span>
                {result.errors?.length > 0 && (
                  <span className="text-red-500 ml-3">{result.errors.length} errors</span>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
