// ─── HPP engine (NP2b) — daily cost-of-goods snapshot ────────────────────────
// Computes per-tenant, per-date, per-sku HPP from OrderItem ⋈ Product, mirroring
// the old app's updateHpp. Snapshot semantics (Option A): hpp = qty × hargaCogs
// is computed AT COMPUTE TIME and STORED frozen in DailyHpp.hpp — reads never
// re-join Product, so later hargaCogs edits don't alter stored snapshots.
import { prisma } from '../prisma'

// Statuses excluded from HPP (cancelled / unpaid). Calibrated to our actual
// Shopee data ('Batal', 'Belum Bayar') plus old-app strings for other
// periods/platforms. NB: candidate for future per-tenant configurable business
// rules — for now this hardcoded list is intentional.
export const EXCLUDED_STATUSES = [
  'Batal', 'Belum Bayar',
  'pending', 'cancelled', 'Canceled', 'request_cancel', 'request_return',
  'Pembatalan diajukan', 'Dibatalkan Sistem', 'Dibatalkan',
]

const DAY_MS = 86400000

// Strip a leading "<digits> " prefix and trim — applied to OrderItem.sku (the
// join's left side). Product.sku is canonical (trim only).
export function normalizeSku(s) {
  return String(s ?? '').replace(/^\d+\s+/, '').trim()
}

// UTC day-midnight for a date (matches getMonthRange's UTC convention; see TZ-1).
function utcDay(d) {
  const x = new Date(d)
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()))
}

function resolveWindow(startDate, endDate) {
  const end   = endDate ? new Date(endDate) : new Date()
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 40 * DAY_MS)
  return { start, end }
}

/**
 * Recompute the DailyHpp snapshot for a tenant + date window (default last 40d).
 * Replace-per-window: deletes the window's rows, then writes fresh ones.
 * @returns {Promise<{ datesProcessed, skusProcessed, totalHpp, unmatchedSkus }>}
 */
export async function computeDailyHpp(tenantId, { startDate, endDate } = {}) {
  const { start, end } = resolveWindow(startDate, endDate)

  // Order lines in window, excluding cancelled/unpaid statuses.
  const items = await prisma.orderItem.findMany({
    where: {
      sku:   { not: null },
      order: { tenantId, orderDate: { gte: start, lte: end }, status: { notIn: EXCLUDED_STATUSES } },
    },
    select: { sku: true, qty: true, order: { select: { orderDate: true } } },
  })

  // Cost lookup: trim(Product.sku) → hargaCogs (tenant's products with a cost).
  const products = await prisma.product.findMany({
    where:  { tenantId, hargaCogs: { not: null } },
    select: { sku: true, hargaCogs: true },
  })
  const costMap = new Map(products.map(p => [String(p.sku ?? '').trim(), Number(p.hargaCogs)]))

  // Group by (utc day, normalized sku): sum qty, sum hpp (computed now).
  const groups = new Map() // `${dayISO}|${nsku}` → { date, sku, qty, hpp }
  const unmatched = new Set()

  for (const it of items) {
    const day  = utcDay(it.order.orderDate)
    const nsku = normalizeSku(it.sku)
    const qty  = it.qty ?? 0
    if (!costMap.has(nsku)) unmatched.add(nsku) // LEFT-JOIN miss → cost 0, NOT an error
    const cost = costMap.get(nsku) ?? 0

    const key = `${day.toISOString().slice(0, 10)}|${nsku}`
    const g = groups.get(key) ?? { date: day, sku: nsku, qty: 0, hpp: 0 }
    g.qty += qty
    g.hpp += qty * cost
    groups.set(key, g)
  }

  // Round hpp to 2 decimals (Decimal(15,2)) to avoid float drift.
  const rows = [...groups.values()].map(g => ({
    tenantId, date: g.date, sku: g.sku, qty: g.qty, hpp: Math.round(g.hpp * 100) / 100,
  }))

  // ── Replace-per-window: SCOPED to this tenant + day-window only ──────────────
  // No $transaction (connection_limit=1). deleteMany + createMany are single
  // statements; a partial failure self-heals on the next recompute (snapshot).
  await prisma.dailyHpp.deleteMany({
    where: { tenantId, date: { gte: utcDay(start), lte: utcDay(end) } },
  })
  if (rows.length) {
    // createMany is one bulk INSERT; chunk only if a window is very large.
    const CHUNK = 5000
    for (let i = 0; i < rows.length; i += CHUNK) {
      await prisma.dailyHpp.createMany({ data: rows.slice(i, i + CHUNK) })
    }
  }

  const dates = new Set(rows.map(r => r.date.toISOString().slice(0, 10)))
  const totalHpp = rows.reduce((a, r) => a + r.hpp, 0)
  return {
    datesProcessed: dates.size,
    skusProcessed:  rows.length,
    totalHpp:       Math.round(totalHpp * 100) / 100,
    unmatchedSkus:  [...unmatched].slice(0, 20),
  }
}

/**
 * Read stored DailyHpp rows for a tenant + window. Reads the FROZEN hpp — never
 * re-joins Product.
 */
export async function getDailyHpp(tenantId, { startDate, endDate } = {}) {
  const { start, end } = resolveWindow(startDate, endDate)
  const rows = await prisma.dailyHpp.findMany({
    where:   { tenantId, date: { gte: utcDay(start), lte: utcDay(end) } },
    orderBy: [{ date: 'asc' }, { sku: 'asc' }],
  })
  return rows.map(r => ({ ...r, qty: r.qty, hpp: Number(r.hpp) }))
}

/**
 * Per-date HPP totals (Σ hpp grouped by date) — what NetProfit (NP3) consumes.
 */
export async function getDailyHppTotalsByDate(tenantId, { startDate, endDate } = {}) {
  const { start, end } = resolveWindow(startDate, endDate)
  const grouped = await prisma.dailyHpp.groupBy({
    by:   ['date'],
    where: { tenantId, date: { gte: utcDay(start), lte: utcDay(end) } },
    _sum: { hpp: true, qty: true },
    orderBy: { date: 'asc' },
  })
  return grouped.map(g => ({
    date:     g.date,
    totalHpp: Number(g._sum.hpp ?? 0),
    totalQty: g._sum.qty ?? 0,
  }))
}
