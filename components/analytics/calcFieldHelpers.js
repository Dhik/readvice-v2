'use client'
// Calculated-field client helpers (Part B). The evaluator is the SINGLE source of
// truth — these wrap lib/analytics/calc-field.js (never reimplement formula logic).
import { useState, useEffect, useCallback } from 'react'
import { evaluate } from '@/lib/analytics/calc-field'

// Safe wrapper — saved formulas are server-validated, but never throw to render.
export function safeEvaluate(formula, values, manifest) {
  try { return evaluate(formula, values, manifest) } catch { return { value: null, dummy: false } }
}

// Compact, unit-agnostic formatter for a calc-field result.
export function fmtCalc(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return String(Math.round(v * 100) / 100)
}

// Fetch + manage a module's calc fields (and its manifest, served by the route).
// Tenant scoping is enforced server-side; this just lists/creates/deletes.
export function useCalcFields(module) {
  const [fields, setFields] = useState([])
  const [manifest, setManifest] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    return fetch(`/api/analytics/calc-fields?module=${encodeURIComponent(module)}`)
      .then(r => r.json())
      .then(d => { if (!d?.error) { setFields(d.fields ?? []); setManifest(d.manifest ?? []) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [module])

  useEffect(() => { reload() }, [reload])

  const removeField = useCallback(async (id) => {
    await fetch(`/api/analytics/calc-fields?id=${id}`, { method: 'DELETE' }).catch(() => {})
    return reload()
  }, [reload])

  return { fields, manifest, loading, reload, removeField }
}
