'use client'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

const fmtRp = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))

export default function CreateTalentModal({ row, onClose }) {
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    const r = await fetch(`/api/affiliate/listing/${row.id}/create-talent`, { method: 'POST' })
    const d = await r.json()
    if (r.ok) {
      toast.success(`Talent created: ${d.talent?.username ?? ''}`)
      onClose()
    } else {
      toast.error(d.error ?? 'Failed to create talent')
    }
    setLoading(false)
  }

  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <span>Create Talent from Listing</span>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sv-modal-body space-y-4">
          <p className="text-sm text-dark2/70">
            This will create a new <strong>Talent</strong> record linked to this listing.
          </p>
          <div className="rounded bg-dark1/5 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-dark2/60">Username</span>
              <span className="font-medium">{row.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark2/60">Platform</span>
              <span className="font-medium">{row.salesChannelId === 1 ? 'Shopee' : row.salesChannelId === 4 ? 'TikTok' : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark2/60">Rate Card</span>
              <span className="font-medium">{fmtRp(row.rateCard)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark2/60">SOW Category</span>
              <span className="font-medium">{row.sowCategory ?? '—'}</span>
            </div>
          </div>
          <p className="text-xs text-dark2/50">
            A document number will be auto-generated. The listing will be marked as talent created.
          </p>
        </div>
        <div className="sv-modal-footer">
          <button className="sv-btn-outline" onClick={onClose}>Cancel</button>
          <button className="sv-btn" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Talent'}
          </button>
        </div>
      </div>
    </div>
  )
}
