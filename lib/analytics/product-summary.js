// ─── Product Analysis (SP1) — on-the-fly per-product sales aggregate ──────────
// SaaS feature for ALL tenants. Computed live from Order ⋈ OrderItem ⋈ Product
// (no snapshot table). Tenant-scoped on EVERY query — cross-tenant leakage is the
// worst-case bug, so tenantId is bound into the SQL WHERE, never trusted from input.
//
// "Sold" metrics exclude cancelled/unpaid orders by reusing EXCLUDED_STATUSES
// from the HPP engine (same basis as NP2b), so revenue/units here line up with HPP.
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { EXCLUDED_STATUSES } from '../hpp/compute-hpp'

const DAY_MS = 86400000

function resolveWindow(startDate, endDate) {
  const end   = endDate ? new Date(endDate) : new Date()
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 40 * DAY_MS)
  return { start, end }
}

const iso = d => d.toISOString().slice(0, 10)
const round2 = n => Math.round(n * 100) / 100

/**
 * Per-product sales aggregate for a tenant + window + optional platform.
 *
 * Grouping note (SP1, confirmed D4): groups by RAW OrderItem.sku — NO
 * normalization. HPP/NP2b normalizes (strips a leading "<digits> " prefix via
 * normalizeSku). For the current zero-prefix data the two are identical, but a
 * future tenant whose SKUs carry "<n> SKU" prefixes would group differently here
 * vs in HPP. Align normalization across BOTH modules when such a tenant appears.
 *
 * Catalog match (confirmed): LEFT JOIN products on raw sku. A SKU sold but not in
 * the catalog (e.g. bundle SKUs) still appears — name falls back to the
 * OrderItem.productName captured at sync time, flagged inCatalog:false, and is
 * fully counted in all totals (it is a real sale).
 *
 * @returns structured, forward-compatible summary (SP2+ adds optional keys only).
 */
export async function getProductAnalysis(tenantId, { startDate, endDate, platform } = {}) {
  const { start, end } = resolveWindow(startDate, endDate)
  const plat = (platform && String(platform).trim() !== '') ? String(platform) : null

  // ── Per-SKU aggregate. ONE query, every value parameterized via Prisma.sql
  // (${}) — incl. Prisma.join(EXCLUDED_STATUSES). ZERO string concatenation.
  // COUNT(DISTINCT order_id) gives "# orders containing the SKU" in-query.
  const rows = await prisma.$queryRaw`
    SELECT oi.sku                                  AS sku,
           COALESCE(p.name, MAX(oi.product_name))  AS name,
           bool_or(p.sku IS NOT NULL)              AS in_catalog,
           SUM(oi.qty)                             AS total_qty,
           SUM(oi.subtotal)                        AS total_revenue,
           COUNT(DISTINCT oi.order_id)             AS order_count
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.sku = oi.sku AND p.tenant_id = o.tenant_id
    WHERE o.tenant_id = ${tenantId}
      AND o.order_date >= ${start} AND o.order_date <= ${end}
      AND (${plat}::text IS NULL OR o.platform = ${plat})
      AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})
      AND oi.sku IS NOT NULL
    GROUP BY oi.sku, p.name
    ORDER BY total_revenue DESC NULLS LAST
  `

  // Decimal/BigInt → Number before anything else (the recurring serialization 500).
  const products = rows.map(r => {
    const qty        = Number(r.total_qty ?? 0)
    const revenue    = Number(r.total_revenue ?? 0)
    const orderCount = Number(r.order_count ?? 0)
    return {
      sku:        r.sku,
      name:       r.name ?? r.sku,          // fallback chain ends at the sku itself
      inCatalog:  Boolean(r.in_catalog),
      qty,
      revenue:    round2(revenue),
      orderCount,
      avgPrice:   qty > 0 ? round2(revenue / qty) : 0,   // guarded — no NaN
      revenuePct: 0,                                       // filled below
    }
  })

  const totalRevenue = round2(products.reduce((a, p) => a + p.revenue, 0))
  const totalUnits   = products.reduce((a, p) => a + p.qty, 0)
  for (const p of products) {
    p.revenuePct = totalRevenue > 0 ? round2((p.revenue / totalRevenue) * 100) : 0
  }
  const unmatchedCount = products.filter(p => !p.inCatalog).length

  // Distinct platforms the tenant actually has in this window — drives the filter
  // pills WITHOUT hardcoding platform names (generic across tenants). Not filtered
  // by `plat`, so picking one platform doesn't hide the others.
  // NB: Order.platform is a required (non-null) column, so `{ not: null }` is both
  // invalid (Prisma rejects it) and unnecessary — filter nulls out in JS below.
  const platRows = await prisma.order.groupBy({
    by:    ['platform'],
    where: { tenantId, orderDate: { gte: start, lte: end } },
  })
  const availablePlatforms = platRows
    .map(r => r.platform)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  return {
    filters: { startDate: iso(start), endDate: iso(end), platform: plat },
    kpis: {
      distinctProducts: products.length,
      totalUnits,
      totalRevenue,
      bestSeller: products[0]
        ? { sku: products[0].sku, name: products[0].name, revenue: products[0].revenue }
        : null,
    },
    products,
    availablePlatforms,
    unmatchedCount,
    generatedAt: new Date().toISOString(),
    // SP2+ will add optional keys here (e.g. visits, opSpend) with "not yet
    // available" UI states — existing consumers stay unaffected.
  }
}
