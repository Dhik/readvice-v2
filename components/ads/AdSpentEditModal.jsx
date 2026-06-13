'use client'
import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const PLATFORM_CONFIG = {
  meta:   { countField: 'conversions', countLabel: 'Conversions', hasImpressions: true,  extraField: 'adsetName', extraLabel: 'Adset Name' },
  shopee: { countField: 'orders',      countLabel: 'Orders',      hasImpressions: true,  extraField: 'adType',    extraLabel: 'Ad Type'    },
  tiktok: { countField: 'conversions', countLabel: 'Conversions', hasImpressions: true,  extraField: 'adName',    extraLabel: 'Ad Name'    },
  lazada: { countField: 'orders',      countLabel: 'Orders',      hasImpressions: false, extraField: null,         extraLabel: null         },
}

const inp = 'w-full border border-dark1/20 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange'
const lbl = 'text-xs font-medium text-dark2 block mb-0.5'

export default function AdSpentEditModal({ isOpen, onClose, onSuccess, row, platform }) {
  const config = PLATFORM_CONFIG[platform?.toLowerCase()] ?? PLATFORM_CONFIG.meta
  const [form,   setForm]   = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!row) return
    const initial = {
      date:              row.date ? new Date(row.date).toISOString().substring(0, 10) : '',
      spent:             row.spent    ?? '',
      revenue:           row.revenue  ?? '',
      clicks:            row.clicks   ?? '',
      [config.countField]: row[config.countField] ?? '',
    }
    if (config.hasImpressions) initial.impressions = row.impressions ?? ''
    if (config.extraField)     initial[config.extraField] = row[config.extraField] ?? ''
    setForm(initial)
  }, [row, config])

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/ad-spent/${platform.toLowerCase()}/${row.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (res.ok) {
        toast.success('Record updated')
        onSuccess?.()
        onClose()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Update failed')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Ad Spend — ${platform}`}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline btn-sm">Cancel</button>
          <button type="submit" form="ad-spent-edit-form" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      }>
      <form id="ad-spent-edit-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Date</label>
            <input type="date" className={inp} required value={form.date ?? ''} onChange={set('date')} />
          </div>
          <div>
            <label className={lbl}>Spent (IDR)</label>
            <input type="number" step="0.01" min="0" className={inp} required value={form.spent ?? ''} onChange={set('spent')} />
          </div>
          <div>
            <label className={lbl}>Revenue / GMV (IDR)</label>
            <input type="number" step="0.01" min="0" className={inp} value={form.revenue ?? ''} onChange={set('revenue')} />
          </div>
          <div>
            <label className={lbl}>Clicks</label>
            <input type="number" min="0" className={inp} value={form.clicks ?? ''} onChange={set('clicks')} />
          </div>
          {config.hasImpressions && (
            <div>
              <label className={lbl}>Impressions</label>
              <input type="number" min="0" className={inp} value={form.impressions ?? ''} onChange={set('impressions')} />
            </div>
          )}
          <div>
            <label className={lbl}>{config.countLabel}</label>
            <input type="number" min="0" className={inp} value={form[config.countField] ?? ''} onChange={set(config.countField)} />
          </div>
          {config.extraField && (
            <div className="col-span-2">
              <label className={lbl}>{config.extraLabel}</label>
              <input type="text" className={inp} value={form[config.extraField] ?? ''} onChange={set(config.extraField)} />
            </div>
          )}
        </div>
        <p className="text-xs text-dark2/50 mt-3">ROAS, CPC, and CTR are re-derived automatically from the values above.</p>
      </form>
    </Modal>
  )
}
