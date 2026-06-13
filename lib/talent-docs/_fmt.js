// Shared formatting helpers for talent document templates.

// HTML-escape interpolated (user-controlled) values.
export function esc(v) {
  if (v === null || v === undefined) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Indonesian number_format: thousands '.', decimal ','. Mirrors Laravel
// number_format($n, $dec, ',', '.').
export function rupiah(n, dec = 0) {
  const num = Number(n || 0)
  const fixed = num.toFixed(dec)
  let [intPart, decPart] = fixed.split('.')
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec > 0 ? `${intPart},${decPart}` : intPart
}

// DD/MM/YYYY for "tanggal hari ini".
export function todayDMY(d = new Date()) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
