'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const PIC_OPTIONS     = ['Alni', 'Amel', 'Putri', 'Naufal', 'Aisyah', 'Silmi', 'Cantika', 'Acha', 'Afra', 'Zinny']
const CHANNEL_OPTIONS = [
  'TikTok video', 'TikTok live', 'Instagram feed', 'Instagram story',
  'youtube video', 'twitter post', 'shopee video',
]

export default function UpdateContentModal({ isOpen, onClose, content, onSuccess }) {
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (content) {
      setForm({
        username:     content.username     ?? '',
        creator_name: content.creator_name ?? '',
        pic:          content.pic          ?? '',
        task_name:    content.task         ?? content.task_name ?? '',
        rate_card:    content.rate_card    ?? '',
        channel:      content.channel     ?? '',
        link:         content.link        ?? '',
        product:      content.product     ?? '',
        boost_code:   content.boost_code  ?? '',
        kode_ads:     content.kode_ads    ?? '',
        view:         content.view        ?? '',
        like:         content.like        ?? '',
        comment:      content.comment     ?? '',
      })
    }
  }, [content])

  if (!isOpen) return null

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/campaign-contents/${content.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          rate_card: parseFloat(form.rate_card) || 0,
          view: parseInt(form.view) || 0,
          like: parseInt(form.like) || 0,
          comment: parseInt(form.comment) || 0,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Content updated')
      onSuccess?.()
      onClose()
    } catch {
      toast.error('Update failed')
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
          <h3 className="font-semibold text-dark1 text-sm">Update Content</h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">Influencer</label>
              <input type="text" value={form.username ?? ''} readOnly
                className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 bg-bg cursor-not-allowed" />
            </div>

            {[
              { k: 'creator_name', label: 'Creator Name', type: 'text' },
              { k: 'task_name',    label: 'Task',          type: 'text' },
              { k: 'product',      label: 'Product',       type: 'text' },
              { k: 'link',         label: 'Link',          type: 'text' },
              { k: 'boost_code',   label: 'Boost Code',    type: 'text' },
              { k: 'kode_ads',     label: 'Ads Code',      type: 'text' },
              { k: 'rate_card',    label: 'Rate Card',     type: 'number' },
              { k: 'view',         label: 'Views (manual)', type: 'number' },
              { k: 'like',         label: 'Likes (manual)', type: 'number' },
              { k: 'comment',      label: 'Comments (manual)', type: 'number' },
            ].map(({ k, label, type }) => (
              <div key={k}>
                <label className="text-xs font-medium text-dark2 mb-1 block">{label}</label>
                <input type={type} value={form[k] ?? ''} onChange={e => set(k, e.target.value)}
                  className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none focus:border-dark2" />
              </div>
            ))}

            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">PIC</label>
              <select value={form.pic ?? ''} onChange={e => set('pic', e.target.value)}
                className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none bg-white">
                <option value="">Select PIC</option>
                {PIC_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">Platform</label>
              <select value={form.channel ?? ''} onChange={e => set('channel', e.target.value)}
                className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none bg-white">
                <option value="">Select Platform</option>
                {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-cream flex-shrink-0">
            <button type="button" onClick={onClose} className="sv-act-btn sv-act-outline text-xs">Cancel</button>
            <button type="submit" disabled={saving} className="sv-act-btn sv-act-primary text-xs">
              {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>} Update
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
