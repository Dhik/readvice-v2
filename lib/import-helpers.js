// Small parsing helpers shared by the dummy→real Google-Sheets importers
// (visits, talent returns, bcg metrics, order fulfilment). Sheet cells arrive as
// strings (or null) from rowsToObjects; these coerce them tolerantly.

// First non-empty value among the given header aliases (case/space tolerant).
export function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (v != null && String(v).trim() !== '') return v
  }
  return null
}

// Tolerant number: strips "Rp", thousands separators, %, spaces. Blank/NaN → 0.
export function num(v) {
  if (v == null) return 0
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

// "YYYY-MM" or "YYYY-MM-DD" (any separator) → UTC Date at the 1st of that month.
export function monthStart(v) {
  if (!v) return null
  const m = String(v).match(/(\d{4})\D(\d{1,2})/)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
  return Number.isNaN(d.getTime()) ? null : d
}

// "YYYY-MM-DD" (any separator) → UTC Date at midnight of that day.
export function dateOnly(v) {
  if (!v) return null
  const m = String(v).match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/)
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    return Number.isNaN(d.getTime()) ? null : d
  }
  // fall back to a YYYY-MM (1st of month) if only a month was given
  return monthStart(v)
}

// Normalize a social handle for matching: drop a leading @, lowercase, trim.
export function normHandle(v) {
  return String(v ?? '').trim().replace(/^@/, '').toLowerCase()
}
