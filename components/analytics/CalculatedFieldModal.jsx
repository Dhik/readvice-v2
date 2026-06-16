'use client'
// CalculatedFieldModal (Part B3) — reusable across analytics modules. Build a formula
// over the module's FIELD_MANIFEST params: click a chip to insert its key at the cursor,
// see a LIVE preview computed by the B2 evaluator (lib/analytics/calc-field.js — the
// single source of truth; no second parser), a DUMMY badge when the formula references a
// dummy param, and inline validation errors. Save → POST to the tenant-scoped route.
import { useState, useRef, useMemo } from 'react'
import Modal from '@/components/ui/Modal'
import { evaluate } from '@/lib/analytics/calc-field'
import { fmtCalc } from './calcFieldHelpers'

export default function CalculatedFieldModal({ isOpen, onClose, module, manifest = [], sampleValues = {}, sampleLabel = 'current values', onSaved }) {
  const [label, setLabel] = useState('')
  const [formula, setFormula] = useState('')
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const inputRef = useRef(null)

  // Live preview via the evaluator. Structural errors are caught for inline display.
  const preview = useMemo(() => {
    if (!formula.trim()) return { state: 'empty' }
    try {
      const { value, dummy } = evaluate(formula, sampleValues, manifest)
      return { state: 'ok', value, dummy }
    } catch (e) {
      return { state: 'error', message: e.message }
    }
  }, [formula, sampleValues, manifest])

  // Insert a bare param key at the cursor (the evaluator uses bare symbols, not {braces}).
  function insertParam(key) {
    const el = inputRef.current
    const start = el?.selectionStart ?? formula.length
    const end = el?.selectionEnd ?? formula.length
    const needSpace = start > 0 && !/[\s(*/+\-%]$/.test(formula.slice(0, start))
    const ins = (needSpace ? ' ' : '') + key
    const next = formula.slice(0, start) + ins + formula.slice(end)
    setFormula(next)
    requestAnimationFrame(() => { if (el) { el.focus(); const pos = start + ins.length; el.setSelectionRange(pos, pos) } })
  }

  async function save() {
    setServerError('')
    setSaving(true)
    try {
      const res = await fetch('/api/analytics/calc-fields', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, label: label.trim(), formula: formula.trim() }),
      })
      const d = await res.json()
      if (!res.ok) { setServerError(d?.error || 'Save failed'); return }
      onSaved?.(d.field)
      setLabel(''); setFormula(''); onClose?.()
    } catch (e) { setServerError(e.message || 'Save failed') } finally { setSaving(false) }
  }

  const canSave = label.trim() && formula.trim() && preview.state === 'ok' && !saving

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="max-w-xl" title="Add calculated field">
      <div className="space-y-3 text-sm">
        <div>
          <label className="text-[11px] font-semibold text-dark1/70">Field name</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Markup %"
            className="w-full border border-cream rounded text-sm px-2 py-1.5 mt-1 bg-white text-dark1 focus:outline-none focus:border-dark2" />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-dark1/70">Formula <span className="font-normal text-dark1/40">— arithmetic over params (+ − × ÷ % parentheses)</span></label>
          <input ref={inputRef} value={formula} onChange={e => setFormula(e.target.value)} placeholder="(revenue - hpp) / hpp * 100"
            className="w-full border border-cream rounded text-sm px-2 py-1.5 mt-1 font-mono bg-white text-dark1 focus:outline-none focus:border-dark2" />
        </div>

        {/* Param chips — click to insert the bare key at the cursor */}
        <div>
          <div className="text-[10px] text-dark1/45 mb-1">Click a param to insert it:</div>
          <div className="flex flex-wrap gap-1">
            {manifest.map(p => (
              <button key={p.key} type="button" onClick={() => insertParam(p.key)}
                title={`${p.label}${p.unit ? ` (${p.unit})` : ''}${p.dummy ? ' — DUMMY' : ''}`}
                className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-cream hover:border-dark2 hover:bg-bg/60 flex items-center gap-1">
                {p.key}
                {p.dummy && <span className="text-[8px] uppercase tracking-wide px-1 rounded bg-orange/15 text-orange">dummy</span>}
              </button>
            ))}
            {manifest.length === 0 && <span className="text-[11px] text-dark1/40">No params for this module.</span>}
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-lg border border-cream bg-bg/40 p-2.5">
          <div className="text-[10px] text-dark1/45 mb-1">Preview <span className="text-dark1/35">({sampleLabel})</span></div>
          {preview.state === 'empty' && <div className="text-dark1/40 text-xs">Enter a formula to preview.</div>}
          {preview.state === 'error' && <div className="text-[12px] text-red-600 flex items-center gap-1.5"><i className="fas fa-circle-exclamation" /> {preview.message}</div>}
          {preview.state === 'ok' && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-dark1">{fmtCalc(preview.value)}</span>
              {preview.value == null && <span className="text-[10px] text-dark1/45">(null — division by zero / undefined)</span>}
              {preview.dummy && (
                <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange/15 text-orange font-semibold"
                  title="References a DUMMY param → this field is dummy-derived">dummy</span>
              )}
            </div>
          )}
        </div>

        {serverError && <div className="text-[12px] text-red-600 flex items-center gap-1.5"><i className="fas fa-triangle-exclamation" /> {serverError}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="sv-tbtn sv-tbtn-ghost">Cancel</button>
          <button onClick={save} disabled={!canSave} className="sv-tbtn sv-tbtn-dark disabled:opacity-40">
            <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-plus'}`} /> Add field
          </button>
        </div>
      </div>
    </Modal>
  )
}
