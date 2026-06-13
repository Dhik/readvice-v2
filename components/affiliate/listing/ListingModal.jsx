'use client'
import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

const PIC_LIST = ['Anisa', 'Iis', 'Kiki', 'Zalsa', 'Rina', 'Others']
const fmtNum = n => new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))

export default function ListingModal({ row, onClose }) {
  const isEdit = !!row
  const [form, setForm] = useState({
    date: '', pic: '', username: '', followers: '', gmv: '', kontak: '', sowCategory: '',
    salesChannelId: '', roas: '', gpm: '', rateCard: '', slot: '', remark: '', keterangan: '',
  })
  const [checkResult, setCheckResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (row) {
      setForm({
        date:          row.date ? new Date(row.date).toISOString().slice(0,10) : '',
        pic:           row.pic         ?? '',
        username:      row.username    ?? '',
        followers:     row.followers   ?? '',
        gmv:           row.gmv         ?? '',
        kontak:        row.kontak      ?? '',
        sowCategory:   row.sowCategory ?? '',
        salesChannelId: row.salesChannelId ?? '',
        roas:          row.roas        ?? '',
        gpm:           row.gpm         ?? '',
        rateCard:      row.rateCard    ?? '',
        slot:          row.slot        ?? '',
        remark:        row.remark      ?? '',
        keterangan:    row.keterangan  ?? '',
      })
    }
  }, [row])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const checkAffiliate = async () => {
    if (!form.username) return
    const r = await fetch(`/api/affiliate/listing/check?username=${encodeURIComponent(form.username)}`).then(r => r.json())
    setCheckResult(r)
  }

  const handleSave = async () => {
    if (!form.username) { toast.error('Username required'); return }
    setLoading(true)
    const body = { ...form, followers: parseInt(form.followers) || 0, slot: parseInt(form.slot) || 0 }
    const url  = isEdit ? `/api/affiliate/listing/${row.id}` : '/api/affiliate/listing'
    const method = isEdit ? 'PUT' : 'POST'
    const r    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { toast.success(isEdit ? 'Updated' : 'Created'); onClose() }
    else { const d = await r.json(); toast.error(d.error ?? 'Save failed') }
    setLoading(false)
  }

  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <span>{isEdit ? 'Edit Listing' : 'Add Listing'}</span>
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
              <div className="flex gap-2">
                <input className="sv-input flex-1" value={form.username} onChange={e => set('username', e.target.value)} />
                <button className="sv-btn-outline text-xs whitespace-nowrap" onClick={checkAffiliate}>Check Affiliate →</button>
              </div>
              {checkResult && (
                <div className="mt-2 rounded bg-dark1/5 p-3 text-xs">
                  {checkResult.found ? (
                    <div className="grid grid-cols-4 gap-2">
                      <div><div className="text-dark2/60">Avg ROI</div><div className="font-semibold">{checkResult.avg_roi.toFixed(1)}%</div></div>
                      <div><div className="text-dark2/60">Orders</div><div className="font-semibold">{fmtNum(checkResult.total_orders)}</div></div>
                      <div><div className="text-dark2/60">GMV</div><div className="font-semibold text-orange">Rp {fmtNum(checkResult.total_gmv)}</div></div>
                      <div><div className="text-dark2/60">Active Days</div><div className="font-semibold">{checkResult.active_days}</div></div>
                    </div>
                  ) : (
                    <div className="text-dark2/60">No affiliate data found for this username.</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="sv-label">Platform</label>
              <select className="sv-input" value={form.salesChannelId} onChange={e => set('salesChannelId', e.target.value)}>
                <option value="">Select</option>
                <option value="1">Shopee</option>
                <option value="4">TikTok</option>
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
              <input className="sv-input" value={form.sowCategory} onChange={e => set('sowCategory', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">Kontak</label>
              <input className="sv-input" value={form.kontak} onChange={e => set('kontak', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">Remark</label>
              <input className="sv-input" value={form.remark} onChange={e => set('remark', e.target.value)} />
            </div>
            <div>
              <label className="sv-label">Keterangan</label>
              <input className="sv-input" value={form.keterangan} onChange={e => set('keterangan', e.target.value)} />
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
