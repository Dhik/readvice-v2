export function formatCurrency(value, locale = 'id-ID', currency = 'IDR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(value ?? 0)
}

export function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(value ?? 0)
}

export function formatDate(date, locale = 'id-ID') {
  return new Date(date).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function getMonthRange(monthStr) {
  const start = new Date(`${monthStr}-01`)
  const end   = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return { gte: start, lt: end }
}

export function formatPercent(value, decimals = 1) {
  return `${(Number(value ?? 0) * 100).toFixed(decimals)}%`
}

export function formatMultiplier(value, decimals = 2) {
  return `${Number(value ?? 0).toFixed(decimals)}x`
}

export function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
