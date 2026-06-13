'use client'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

export default function StaffNotesModal({ row, onClose }) {
  const [notes, setNotes] = useState(row.staffNotes ?? '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    const r = await fetch('/api/affiliate/dealing/staff-actions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, staffNotes: notes }),
    })
    if (r.ok) { toast.success('Notes saved'); onClose() }
    else { const d = await r.json(); toast.error(d.error ?? 'Save failed') }
    setLoading(false)
  }

  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <span>Staff Notes — {row.dealingNumber ?? row.id}</span>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sv-modal-body">
          <label className="sv-label">Notes</label>
          <textarea className="sv-input" rows={5} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Enter staff notes..." />
        </div>
        <div className="sv-modal-footer">
          <button className="sv-btn-outline" onClick={onClose}>Cancel</button>
          <button className="sv-btn" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  )
}
