'use client'
import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

const PIC_LIST = ['Anisa', 'Iis', 'Kiki', 'Zalsa', 'Rina', 'Others']
const SOW_LIST = ['Live', 'Video', 'Live + Video']

export default function ReachModal({ row, onClose }) {
  const isEdit = !!row
  const [form, setForm] = useState({
    date: '', pic: '', username: '', platform: '', followers: '',
    gmv: '', roas: '', rateCard: '', slot: '', sowCategory: '',
    kontak: '', remark: '', status: 'Active',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (row) {
      setForm({
        date:        row.date ? new Date(row.date).toISOString().slice(0,10) : '',
        pic:         row.pic         ?? '',
        username:    row.username    ?? '',
        platform:    row.platform    ?? '',
        followers:   row.followers   ?? '',
        gmv:         row.gmv         ?? '',
        roas:        row.roas        ?? '',
        rateCard:    row.rateCard    ?? '',
        slot:        row.slot        ?? '',
        sowCategory: row.sowCategory ?? '',
        kontak:      row.kontak      ?? '',
        remark:      row.remark      ?? '',
        status:      row.status      ?? 'Active',
      })
    }
  }, [row])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.username) { toast.error('Username required'); return }
    setLoading(true)
    const body = { ...form, followers: parseInt(form.followers) || 0, slot: parseInt(form.slot) || 0 }
    const url    = isEdit ? `/api/affiliate/reach/${row.id}` : '/api/affiliate/reach'
    const method = isEdit ? 'PUT' : 'POST'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { toast.success(isEdit ? 'Updated' : 'Created'); onClose() }
    else { const d = await r.json(); toast.error(d.error ?? 'Save failed') }
    setLoading(false)
  }

  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" style={{ maxWidth: 660 }} onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <span>{isEdit ? 'Edit Reach' : 'Add Reach'}</span>
          <button className="sv-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sv-modal-body">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="sv-label">Date</label>
              <input type="date" className="sv-input" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">PIC</label>
              <select className="sv-input" value={form.pic} onChange={e => set('pic', e.target.value)}>
                <option value="">Select PIC</option>
                {PIC_LIST.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="sv-label">Username</label>
              <input className="sv-input" value={form.username} onChange={e => set('username', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">Platform</label>
              <select className="sv-input" value={form.platform} onChange={e => set('platform', e.target.value)}>
                <option value="">Select</option>
                <option value="Shopee">Shopee</option>
                <option value="TikTok">TikTok</option>
              </select>
            </div>
            <div>
              <label className="sv-label">Followers</label>
              <input type="number" className="sv-input" value={form.followers} onChange={e => set('followers', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">GMV (Rp)</label>
              <input type="number" className="sv-input" value={form.gmv} onChange={e => set('gmv', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">ROAS</label>
              <input type="number" step="0.01" className="sv-input" value={form.roas} onChange={e => set('roas', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">Rate Card (Rp)</label>
              <input type="number" className="sv-input" value={form.rateCard} onChange={e => set('rateCard', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">Slot</label>
              <input type="number" className="sv-input" value={form.slot} onChange={e => set('slot', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">SOW Category</label>
              <select className="sv-input" value={form.sowCategory} onChange={e => set('sowCategory', e.target.value)}>
                <option value="">Select</option>
                {SOW_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="sv-label">Kontak</label>
              <input className="sv-input" value={form.kontak} onChange={e => set('kontak', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">Status</label>
              <select className="sv-input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Dealing">Dealing</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="sv-label">Remark</label>
              <input className="sv-input" value={form.remark} onChange={e => set('remark', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="sv-modal-footer">
          <button className="sv-btn-outline" onClick={onClose}>Cancel</button>
          <button className="sv-btn" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
