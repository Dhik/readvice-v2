'use client'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

const fmtRp = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))

// type = 'leader' | 'management'
export default function ApprovalModal({ row, type, onClose }) {
  const [decision, setDecision] = useState('')
  const [note, setNote]         = useState('')
  const [loading, setLoading]   = useState(false)

  const endpoint = type === 'leader'
    ? `/api/affiliate/dealing/${row.id}/leader-approval`
    : `/api/affiliate/dealing/${row.id}/management-approval`

  const label = type === 'leader' ? 'Leader' : 'Management'

  const handleSubmit = async () => {
    if (!decision) { toast.error('Select Approve or Reject'); return }
    setLoading(true)
    const r = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: decision, note }),
    })
    if (r.ok) { toast.success(`${label} approval: ${decision}`); onClose() }
    else { const d = await r.json(); toast.error(d.error ?? 'Failed') }
    setLoading(false)
  }

  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <span>{label} Approval — {row.dealingNumber ?? row.id}</span>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sv-modal-body space-y-3">
          <div className="rounded bg-dark1/5 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-dark2/60">Username</span>
              <span className="font-medium">{row.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark2/60">Rate Card</span>
              <span className="font-medium">{fmtRp(row.rateCard)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark2/60">Slot</span>
              <span className="font-medium">{row.slot ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark2/60">SOW</span>
              <span className="font-medium">{row.sowCategory ?? '—'}</span>
            </div>
          </div>

          <div>
            <label className="sv-label">Decision</label>
            <div className="flex gap-3 mt-1">
              {['Approve', 'Reject'].map(d => (
                <label key={d} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="decision" value={d}
                         checked={decision === d} onChange={() => setDecision(d)} />
                  <span className={`font-medium ${d === 'Approve' ? 'text-green-600' : 'text-red-600'}`}>{d}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="sv-label">Note (optional)</label>
            <textarea className="sv-input" rows={2} value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Reason or notes..." />
          </div>
        </div>
        <div className="sv-modal-footer">
          <button className="sv-btn-outline" onClick={onClose}>Cancel</button>
          <button className="sv-btn" onClick={handleSubmit} disabled={loading || !decision}>
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
