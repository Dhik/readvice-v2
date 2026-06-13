'use client'
import { useState } from 'react'

// Reads a small sample of the sheet and shows the column-index → header → data
// mapping so the user knows which sheetColumn value to use in the builder.
// Works against the currently-typed sheetTab/dataRange/spreadsheetId (passed as
// overrides) — preview before saving. Disabled until the connector exists.
export default function SheetPreview({ connectorId, spreadsheetId, sheetTab, dataRange }) {
  const [data, setData]       = useState(null)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const canPreview = Boolean(connectorId)

  async function runPreview() {
    if (!canPreview) return
    setLoading(true); setError(''); setData(null)
    try {
      const qs = new URLSearchParams()
      if (spreadsheetId) qs.set('spreadsheetId', spreadsheetId)
      if (sheetTab)      qs.set('sheetTab', sheetTab)
      if (dataRange)     qs.set('dataRange', dataRange)
      const res = await fetch(`/api/connectors/${connectorId}/preview?${qs}`)
      const d   = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'Preview failed'); return }
      setData(d)
    } catch {
      setError('Preview request failed')
    } finally {
      setLoading(false)
    }
  }

  const indices = data ? Array.from({ length: data.columnCount }, (_, i) => i) : []

  return (
    <div className="border-t border-cream/60 pt-2 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="form-label mb-0">Sheet Preview</div>
        <button
          type="button"
          onClick={runPreview}
          disabled={!canPreview || loading}
          title={canPreview ? `Preview ${sheetTab}!${dataRange}` : 'Save the connector first, then preview'}
          className="btn btn-outline btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <i className="fas fa-table-list" /> {loading ? 'Loading…' : 'Preview Sheet'}
        </button>
        {!canPreview && (
          <span className="text-xs text-dark2/50">Save the connector first, then preview</span>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5 mb-1">
          {error}
        </div>
      )}

      {data && (
        data.columnCount === 0 ? (
          <div className="text-xs text-dark2/50 py-2">No rows returned for that tab/range.</div>
        ) : (
          <div className="overflow-x-auto border border-cream rounded">
            <table className="text-xs border-collapse whitespace-nowrap">
              <tbody>
                {/* Column-index row — THE reference for sheetColumn values */}
                <tr>
                  <td className="sticky left-0 bg-bg px-2 py-1 font-semibold text-dark2/60 border-r border-b border-cream z-10">Col #</td>
                  {indices.map(i => (
                    <td key={i} className="px-2 py-1 font-mono font-bold text-center text-orange bg-orange/10 border-r border-b border-cream">{i}</td>
                  ))}
                </tr>
                {/* Sheet header (row 1) */}
                <tr>
                  <td className="sticky left-0 bg-bg px-2 py-1 font-semibold text-dark2/60 border-r border-b border-cream z-10">Header</td>
                  {indices.map(i => (
                    <td key={i} className="px-2 py-1 font-medium text-dark1 border-r border-b border-cream max-w-[160px] truncate" title={data.headers[i] ?? ''}>
                      {data.headers[i] ?? <span className="text-dark2/30">—</span>}
                    </td>
                  ))}
                </tr>
                {/* Sample data rows */}
                {data.sampleRows.map((row, r) => (
                  <tr key={r}>
                    <td className="sticky left-0 bg-bg px-2 py-1 text-dark2/50 border-r border-b border-cream z-10">row {r + 2}</td>
                    {indices.map(i => (
                      <td key={i} className="px-2 py-1 text-dark1/80 border-r border-b border-cream/60 max-w-[160px] truncate" title={row[i] ?? ''}>
                        {row[i] ?? <span className="text-dark2/20">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
