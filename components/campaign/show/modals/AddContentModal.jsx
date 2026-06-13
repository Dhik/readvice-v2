'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

const PIC_OPTIONS     = ['Alni', 'Amel', 'Putri', 'Naufal', 'Aisyah', 'Silmi', 'Cantika', 'Acha', 'Afra', 'Zinny']
const CHANNEL_OPTIONS = [
  'TikTok video', 'TikTok live', 'Instagram feed', 'Instagram story',
  'youtube video', 'twitter post', 'shopee video',
]

const INITIAL = {
  username: '', creator_name: '', pic: '', task_name: '',
  rate_card: '', channel: '', link: '', product: '', boost_code: '', kode_ads: '',
}

export default function AddContentModal({ isOpen, onClose, campaignId, onSuccess }) {
  const [form, setForm]     = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function validate() {
    const e = {}
    if (!form.username.trim())    e.username    = 'Required'
    if (!form.creator_name.trim()) e.creator_name = 'Required'
    if (!form.pic)                e.pic         = 'Required'
    if (!form.task_name.trim())   e.task_name   = 'Required'
    if (!form.rate_card)          e.rate_card   = 'Required'
    if (!form.channel)            e.channel     = 'Required'
    if (!form.product.trim())     e.product     = 'Required'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/contents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rate_card: parseFloat(form.rate_card) || 0 }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Content saved')
      setForm(INITIAL)
      onSuccess?.()
      onClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream flex-shrink-0">
          <h3 className="font-semibold text-dark1 text-sm">Add Content</h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { k: 'username',     label: 'Influencer *',    type: 'text' },
              { k: 'creator_name', label: 'Creator Name *',  type: 'text' },
              { k: 'task_name',    label: 'Task *',          type: 'text' },
              { k: 'product',      label: 'Product *',       type: 'text' },
              { k: 'link',         label: 'Link',            type: 'text' },
              { k: 'boost_code',   label: 'Boost Code',      type: 'text' },
              { k: 'kode_ads',     label: 'Ads Code',        type: 'text' },
              { k: 'rate_card',    label: 'Rate Card *',     type: 'number' },
            ].map(({ k, label, type }) => (
              <div key={k}>
                <label className="text-xs font-medium text-dark2 mb-1 block">{label}</label>
                <input type={type} value={form[k]} onChange={e => set(k, e.target.value)}
                  className={'w-full border rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none ' +
                    (errors[k] ? 'border-red-400' : 'border-cream focus:border-dark2')} />
                {errors[k] && <p className="text-[10px] text-red-500 mt-0.5">{errors[k]}</p>}
              </div>
            ))}

            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">PIC *</label>
              <select value={form.pic} onChange={e => set('pic', e.target.value)}
                className={'w-full border rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none bg-white ' +
                  (errors.pic ? 'border-red-400' : 'border-cream focus:border-dark2')}>
                <option value="">Select PIC</option>
                {PIC_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.pic && <p className="text-[10px] text-red-500 mt-0.5">{errors.pic}</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">Platform *</label>
              <select value={form.channel} onChange={e => set('channel', e.target.value)}
                className={'w-full border rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none bg-white ' +
                  (errors.channel ? 'border-red-400' : 'border-cream focus:border-dark2')}>
                <option value="">Select Platform</option>
                {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.channel && <p className="text-[10px] text-red-500 mt-0.5">{errors.channel}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-cream flex-shrink-0">
            <button type="button" onClick={onClose} className="sv-act-btn sv-act-outline text-xs">Cancel</button>
            <button type="submit" disabled={saving} className="sv-act-btn sv-act-primary text-xs">
              {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
