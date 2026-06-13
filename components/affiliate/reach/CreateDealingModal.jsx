'use client'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

const fmtRp = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))

export default function CreateDealingModal({ row, onClose }) {
  const [form, setForm] = useState({
    dealingDate: new Date().toISOString().slice(0, 10),
    rateCard:    row?.rateCard ?? '',
    slot:        row?.slot     ?? '',
    sowCategory: row?.sowCategory ?? '',
    remark:      '',
  })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    setLoading(true)
    const r = await fetch(`/api/affiliate/reach/${row.id}/create-dealing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    if (r.ok) {
      toast.success('Dealing created: ' + (d.dealing?.dealingNumber ?? ''))
      onClose()
    } else {
      toast.error(d.error ?? 'Failed to create dealing')
    }
    setLoading(false)
  }

  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <span>Create Dealing from Reach</span>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sv-modal-body space-y-3">
          <div className="rounded bg-dark1/5 p-3 text-sm space-y-1 mb-2">
            <div className="flex justify-between">
              <span className="text-dark2/60">Username</span>
              <span className="font-medium">{row.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark2/60">Platform</span>
              <span className="font-medium">{row.platform ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark2/60">PIC</span>
              <span className="font-medium">{row.pic ?? '—'}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="sv-label">Dealing Date</label>
              <input type="date" className="sv-input" value={form.dealingDate} onChange={e => set('dealingDate', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">Rate Card (Rp)</label>
              <input type="number" className="sv-input" value={form.rateCard} onChange={e => set('rateCard', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">Slot</label>
              <input type="number" className="sv-input" value={form.slot} onChange={e => set('slot', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="sv-label">SOW Category</label>
              <input className="sv-input" value={form.sowCategory} onChange={e => set('sowCategory', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="sv-label">Remark</label>
              <input className="sv-input" value={form.remark} onChange={e => set('remark', e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-dark2/50">A dealing number will be auto-generated upon creation.</p>
        </div>
        <div className="sv-modal-footer">
          <button className="sv-btn-outline" onClick={onClose}>Cancel</button>
          <button className="sv-btn" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Dealing'}
          </button>
        </div>
      </div>
    </div>
  )
}
