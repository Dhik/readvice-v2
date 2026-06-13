'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

function todayLabel() {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleString('en-US', { month: 'short' })
  return `${day} ${month} ${d.getFullYear()}`
}

export default function ManualStatisticModal({ isOpen, onClose, contentId }) {
  const [form, setForm]   = useState({ view: '', like: '', comment: '' })
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/campaign-contents/${contentId}/statistic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          view: parseInt(form.view) || 0,
          like: parseInt(form.like) || 0,
          comment: parseInt(form.comment) || 0,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Statistic added')
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream">
          <h3 className="font-semibold text-dark1 text-sm">Add Data</h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-dark2 mb-1 block">Date</label>
              <input type="text" value={todayLabel()} readOnly
                className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 bg-bg cursor-not-allowed" />
            </div>
            {[
              { k: 'view',    label: 'Views' },
              { k: 'like',    label: 'Likes' },
              { k: 'comment', label: 'Comments' },
            ].map(({ k, label }) => (
              <div key={k}>
                <label className="text-xs font-medium text-dark2 mb-1 block">{label}</label>
                <input type="number" value={form[k]} onChange={e => set(k, e.target.value)}
                  className="w-full border border-cream rounded px-2 py-1.5 text-xs text-dark1 focus:outline-none focus:border-dark2" />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-cream">
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
