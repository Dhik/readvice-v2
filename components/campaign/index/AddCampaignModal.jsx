'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

const TYPE_OPTIONS = [
  { value: 'creative',  label: 'Creative' },
  { value: 'kol',       label: 'KOL' },
  { value: 'clipper',   label: 'Clipper' },
  { value: 'affiliate', label: 'Affiliate Talent' },
]

const PLATFORM_OPTIONS = [
  'TikTok', 'Instagram', 'YouTube', 'Twitter', 'Shopee', 'Multi-platform',
]

const INITIAL = {
  title: '', type: 'creative', platform: '', purpose: '',
  startDate: '', endDate: '', budget: '',
}

export default function AddCampaignModal({ isOpen, onClose, defaultType, onSuccess }) {
  const [form, setForm]     = useState({ ...INITIAL, type: defaultType ?? 'creative' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function validate() {
    const e = {}
    if (!form.title.trim()) e.title = 'Campaign title is required'
    if (!form.type)         e.type  = 'Type is required'
    return e
  }

  // Convert date input (YYYY-MM-DD) to "DD MMM YYYY" string
  function formatDate(val) {
    if (!val) return null
    const d = new Date(val + 'T00:00:00')
    if (isNaN(d)) return null
    const day   = String(d.getDate()).padStart(2, '0')
    const month = d.toLocaleString('en-US', { month: 'short' })
    return `${day} ${month} ${d.getFullYear()}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:     form.title.trim(),
          type:      form.type,
          platform:  form.platform  || null,
          purpose:   form.purpose   || null,
          budget:    form.budget    ? parseFloat(form.budget) : null,
          startDate: formatDate(form.startDate),
          endDate:   formatDate(form.endDate),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Campaign created')
      setForm({ ...INITIAL, type: defaultType ?? 'creative' })
      onSuccess?.()
      onClose()
    } catch {
      toast.error('Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3 border-b border-cream">
          <h3 className="font-semibold text-dark1 text-sm flex items-center gap-2">
            <i className="fas fa-plus-circle text-orange"></i> New Campaign
          </h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-3">

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">Campaign Title *</label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. KOL Campaign Jan 2025"
                className={'w-full border rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none ' +
                  (errors.title ? 'border-red-400' : 'border-cream focus:border-dark2')} />
              {errors.title && <p className="text-[10px] text-red-500 mt-0.5">{errors.title}</p>}
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">Type *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className={'w-full border rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none bg-white ' +
                  (errors.type ? 'border-red-400' : 'border-cream focus:border-dark2')}>
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {errors.type && <p className="text-[10px] text-red-500 mt-0.5">{errors.type}</p>}
            </div>

            {/* Platform + Purpose */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-dark2 mb-1 block">Platform</label>
                <select value={form.platform} onChange={e => set('platform', e.target.value)}
                  className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none bg-white focus:border-dark2">
                  <option value="">Select platform</option>
                  {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-dark2 mb-1 block">Purpose</label>
                <input type="text" value={form.purpose} onChange={e => set('purpose', e.target.value)}
                  placeholder="e.g. Brand Awareness"
                  className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none focus:border-dark2" />
              </div>
            </div>

            {/* Start + End Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-dark2 mb-1 block">Start Date</label>
                <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
                  className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none focus:border-dark2" />
              </div>
              <div>
                <label className="text-xs font-medium text-dark2 mb-1 block">End Date</label>
                <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
                  className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none focus:border-dark2" />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">Budget (IDR)</label>
              <input type="number" value={form.budget} onChange={e => set('budget', e.target.value)}
                placeholder="0"
                className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none focus:border-dark2" />
            </div>

          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-cream">
            <button type="button" onClick={onClose} className="sv-act-btn sv-act-outline text-xs">Cancel</button>
            <button type="submit" disabled={saving} className="sv-act-btn sv-act-primary text-xs flex items-center gap-1">
              {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
              Create Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
