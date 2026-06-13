import { prisma } from '@/lib/prisma'

// Per-platform config: Prisma model, the column holding the "name" used for
// top-performer grouping (Lazada has none), and whether the table has an
// `impressions` column (Lazada does not).
const PLATFORMS = [
  { key: 'meta',   model: 'adSpentMeta',   nameField: 'adsetName', hasImpressions: true },
  { key: 'shopee', model: 'adSpentShopee', nameField: 'adType',    hasImpressions: true },
  { key: 'tiktok', model: 'adSpentTiktok', nameField: 'adName',    hasImpressions: true },
  { key: 'lazada', model: 'adSpentLazada', nameField: null,        hasImpressions: false },
]

const roas = (revenue, spent) => (spent > 0 ? Number((revenue / spent).toFixed(2)) : null)

// Tenant-scoped, current-month per-platform ad summary. Returns a small object
// (sums + top-3 performers per platform) — never raw rows — so it stays cheap to
// hand to the model. Shared by the AI-1 single-shot route and the AI-2 chat route.
export async function getAdsSummary(tenantId) {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const where = { tenantId, date: { gte: start, lte: now } }

  // Per-platform totals (one transaction). `impressions` only where it exists.
  const sums = await prisma.$transaction(
    PLATFORMS.map(p => prisma[p.model].aggregate({
      where,
      _sum: { spent: true, revenue: true, clicks: true, ...(p.hasImpressions ? { impressions: true } : {}) },
    }))
  )

  const platforms = await Promise.all(PLATFORMS.map(async (p, i) => {
    const s       = sums[i]._sum
    const spent   = Number(s.spent   ?? 0)
    const revenue = Number(s.revenue ?? 0)

    let topPerformers = null
    if (p.nameField && spent > 0) {
      const grouped = await prisma[p.model].groupBy({
        by:      [p.nameField],
        where:   { ...where, [p.nameField]: { not: null } },
        _sum:    { spent: true, revenue: true },
        orderBy: { _sum: { spent: 'desc' } },
        take:    3,
      })
      topPerformers = grouped.map(g => ({
        name:    g[p.nameField],
        spent:   Number(g._sum.spent   ?? 0),
        revenue: Number(g._sum.revenue ?? 0),
      }))
    }

    return {
      platform:    p.key,
      spent,
      revenue,
      roas:        roas(revenue, spent),
      clicks:      s.clicks      != null ? Number(s.clicks)      : null,
      impressions: s.impressions != null ? Number(s.impressions) : null,
      topPerformers,
    }
  }))

  const totalSpent   = platforms.reduce((acc, p) => acc + p.spent,   0)
  const totalRevenue = platforms.reduce((acc, p) => acc + p.revenue, 0)

  return {
    period:  { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) },
    platforms,
    totals:  { spent: totalSpent, revenue: totalRevenue, roas: roas(totalRevenue, totalSpent) },
  }
}
