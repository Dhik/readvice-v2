// ─── Operational engine (Wave 2 §2.2 — MIXED real/dummy) ────────────────────
// The operational-EFFICIENCY lens (funnel flow, inventory action-classification,
// cancellation trend, fulfilment timing) — distinct from the dashboard/SP2 status
// breakdowns (not rebuilt here).
//
// PER-SECTION honesty (this module is mixed):
//   • REAL (dummy:false): status funnel, cancellation trend, stock velocity. Computed
//     live from Order / OrderItem / Product. Stock turnover reuses BCG's qty÷stock formula.
//   • DUMMY (dummy:true): fulfilment time (processing/shipping/total days). Order has NO
//     per-status-transition timestamps, so `OrderFulfillment` is fabricated (source='DUMMY').
//
// Tenant-scoped every read; Decimal/BigInt → Number. See docs/OPERATIONAL_DATA_SOURCES.md.
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { EXCLUDED_STATUSES, normalizeSku } from '../hpp/compute-hpp'

const round1 = n => Math.round((Number(n) || 0) * 10) / 10
const round2 = n => Math.round((Number(n) || 0) * 100) / 100
const num    = v => Number(v ?? 0)
const iso    = d => (d ? new Date(d).toISOString().slice(0, 10) : null)
const median = arr => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

// ── FIELD_MANIFEST (Part B1) — numeric params for calculated fields ───────────
// MIXED, mirroring the engine's per-SECTION flags: the funnel / cancellation /
// stock-velocity sections set `dummy: false` (computed live from Order/OrderItem/
// Product), so those params are dummy:false. The fulfilment section sets
// `dummy: true` (OrderFulfillment is fabricated — Order has no per-status
// timestamps), so processing/shipping/total days are dummy:true.
export const FIELD_MANIFEST = [
  { key: 'cancellationRate',  label: 'Cancellation rate', unit: '%',     dummy: false, source: 'REAL-DERIVED' },
  { key: 'stockTurnover',     label: 'Stock turnover',    unit: 'x',     dummy: false, source: 'REAL-DERIVED' },
  { key: 'qtySold',           label: 'Units sold',        unit: 'count', dummy: false, source: 'REAL' },
  { key: 'stock',             label: 'Stock level',       unit: 'count', dummy: false, source: 'REAL' },
  { key: 'revenue',           label: 'Revenue',           unit: 'IDR',   dummy: false, source: 'REAL' },
  { key: 'stockCoveragePct',  label: 'Stock coverage',    unit: '%',     dummy: false, source: 'REAL-DERIVED' },
  { key: 'processingDays',    label: 'Processing time',   unit: 'days',  dummy: true,  source: 'DUMMY' },
  { key: 'shippingDays',      label: 'Shipping time',     unit: 'days',  dummy: true,  source: 'DUMMY' },
  { key: 'totalDays',         label: 'Total fulfil. time',unit: 'days',  dummy: true,  source: 'DUMMY' },
]

// ── Status → pipeline stage (REAL). Order matters: cancel first, processing before shipped.
export const FUNNEL_STAGES = ['Pending', 'Processing', 'Shipped', 'Delivered']
export function classifyStage(status) {
  const s = String(status ?? '').toLowerCase()
  if (/cancel|batal|dibatalkan|pembatalan|request_return|request_cancel/.test(s)) return 'Cancelled'
  if (/belum bayar|unpaid|pending|belum dibayar/.test(s)) return 'Pending'
  if (/perlu dikirim|to.?ship|processing|diproses|siap dikirim|packing/.test(s)) return 'Processing'
  if (/sedang dikirim|telah dikirim|dikirim|shipped|in.?transit|pengiriman/.test(s)) return 'Shipped'
  if (/completed|selesai|delivered|diterima/.test(s)) return 'Delivered'
  return 'Other'
}

// ── REAL: per-SKU sold qty + stock + revenue (stock velocity basis) ───────────
async function loadStock(tenantId) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT oi.sku AS sku, COALESCE(MAX(pr.name), MAX(oi.product_name)) AS name,
           SUM(oi.qty)::int AS qty_sold, MAX(pr.stock)::int AS stock, COALESCE(SUM(oi.subtotal), 0) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products pr ON pr.sku = oi.sku AND pr.tenant_id = o.tenant_id
    WHERE o.tenant_id = ${tenantId} AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)}) AND oi.sku IS NOT NULL
    GROUP BY oi.sku`)
  // Merge by normalized sku (align with HPP/BCG); reuse qty÷stock turnover formula.
  const map = new Map()
  for (const r of rows) {
    const nsku = normalizeSku(r.sku)
    const g = map.get(nsku) ?? { sku: nsku, name: r.name ?? nsku, qtySold: 0, stock: 0, revenue: 0 }
    g.qtySold += num(r.qty_sold); g.revenue += num(r.revenue)
    g.stock = Math.max(g.stock, num(r.stock))   // stock is a level, not additive
    if (!g.name || g.name === nsku) g.name = r.name ?? g.name
    map.set(nsku, g)
  }
  return [...map.values()].map(g => ({
    ...g, revenue: round2(g.revenue),
    stockTurnover: g.stock > 0 ? round2(g.qtySold / g.stock) : null,   // BCG formula, guarded
  }))
}

// Classify a SKU into an inventory-action quadrant (velocity = units sold, stock = level).
function classifyStock(s, medQty, medStock) {
  const hiDemand = s.qtySold >= medQty, hiStock = s.stock > medStock
  if (hiDemand && !hiStock) return 'Reorder'        // selling, low/no stock → restock
  if (hiDemand && hiStock)  return 'Healthy'        // selling, well stocked
  if (!hiDemand && hiStock) return 'Overstock'      // slow, high stock → tie-up
  return 'Discontinue?'                              // slow + low stock → review/retire
}

/** Status funnel (REAL): orders bucketed into pipeline stages + Cancelled drop-off. Sums to total. */
export async function getStatusFunnel(tenantId) {
  const rows = await prisma.order.groupBy({ by: ['status'], where: { tenantId }, _count: true })
  const counts = { Pending: 0, Processing: 0, Shipped: 0, Delivered: 0, Cancelled: 0, Other: 0 }
  for (const r of rows) counts[classifyStage(r.status)] += r._count
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  const stages = FUNNEL_STAGES.map(st => ({ stage: st, count: counts[st], pct: round1((counts[st] / total) * 100) }))
  return {
    dummy: false, total: Object.values(counts).reduce((a, b) => a + b, 0),
    stages,
    cancelled: { count: counts.Cancelled, pct: round1((counts.Cancelled / total) * 100) },
    other: { count: counts.Other, pct: round1((counts.Other / total) * 100) },
  }
}

/** Cancellation rate over time (REAL). Thin history surfaced honestly. */
export async function getCancellationTrend(tenantId) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT to_char(order_date, 'YYYY-MM') AS month, status, COUNT(*)::int AS n
    FROM orders WHERE tenant_id = ${tenantId} GROUP BY 1, 2 ORDER BY 1`)
  const byMonth = new Map()
  for (const r of rows) {
    const m = byMonth.get(r.month) ?? { month: r.month, total: 0, cancelled: 0 }
    m.total += r.n; if (classifyStage(r.status) === 'Cancelled') m.cancelled += r.n
    byMonth.set(r.month, m)
  }
  const points = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({ month: m.month, total: m.total, cancelled: m.cancelled, rate: round1((m.cancelled / (m.total || 1)) * 100) }))
  return {
    dummy: false, points,
    note: points.length < 3 ? `Only ${points.length} month(s) of order history — trend is shallow.` : null,
  }
}

/** Stock-velocity quadrant (REAL): units-sold × stock level, bubble = revenue, 4 action buckets. */
export async function getStockVelocityQuadrant(tenantId) {
  const items = await loadStock(tenantId)
  const medQty = round2(median(items.map(i => i.qtySold)))
  const medStock = round2(median(items.map(i => i.stock)))
  const points = items.map(i => ({
    sku: i.sku, name: i.name, x: i.qtySold, y: i.stock, revenue: i.revenue,
    stockTurnover: i.stockTurnover, quadrant: classifyStock(i, medQty, medStock),
  }))
  const counts = { Reorder: 0, Healthy: 0, Overstock: 0, 'Discontinue?': 0 }
  for (const p of points) counts[p.quadrant]++
  const withStock = items.filter(i => i.stock > 0).length
  return {
    dummy: false, points, counts, medianQty: medQty, medianStock: medStock,
    skuCount: items.length, stockCoveragePct: items.length ? round1((withStock / items.length) * 100) : 0,
    axes: { xLabel: 'Units sold (velocity)', yLabel: 'Stock level', sizeLabel: 'Revenue' },
    note: withStock === 0
      ? 'Product.stock is 0 for ALL SKUs (real, but stock not tracked yet) → everything classifies Reorder/Discontinue. Populate stock for full Healthy/Overstock split. Turnover (qty÷stock) shown where stock>0.'
      : null,
  }
}

/** Overview: REAL ops KPIs + a clearly-flagged DUMMY fulfilment KPI. */
export async function getOperationalOverview(tenantId) {
  const funnel = await getStatusFunnel(tenantId)
  const velo = await getStockVelocityQuadrant(tenantId)
  const ful = await prisma.orderFulfillment.aggregate({
    where: { tenantId }, _avg: { totalDays: true, processingDays: true, shippingDays: true }, _count: true,
  })
  return {
    hasData: funnel.total > 0,
    real: {
      dummy: false,
      totalOrders: funnel.total,
      cancellationRate: round1((funnel.cancelled.count / (funnel.total || 1)) * 100),
      cancelledCount: funnel.cancelled.count,
      deliveredCount: funnel.stages.find(s => s.stage === 'Delivered')?.count ?? 0,
      skuCount: velo.skuCount, stockCoveragePct: velo.stockCoveragePct,
      reorderCount: velo.counts.Reorder, overstockCount: velo.counts.Overstock,
    },
    fulfillment: {
      dummy: true,
      avgTotalDays: round2(ful._avg.totalDays), avgProcessingDays: round2(ful._avg.processingDays),
      avgShippingDays: round2(ful._avg.shippingDays), ordersWithFulfillment: ful._count,
      note: 'Fulfilment time is FABRICATED (no per-status timestamps on Order). Not a real metric.',
    },
  }
}

/** Fulfilment-time histogram (DUMMY). Bins of totalDays + processing/shipping averages. */
export async function getFulfillmentDistribution(tenantId) {
  const rows = await prisma.orderFulfillment.findMany({
    where: { tenantId }, select: { totalDays: true, processingDays: true, shippingDays: true },
  })
  const BINS = [[0, 1], [1, 2], [2, 3], [3, 5], [5, 7], [7, 10], [10, 14], [14, Infinity]]
  const LABELS = ['0–1', '1–2', '2–3', '3–5', '5–7', '7–10', '10–14', '14+']
  const bins = LABELS.map((label, i) => ({ label, count: 0, lo: BINS[i][0], hi: BINS[i][1] }))
  for (const r of rows) {
    const d = num(r.totalDays)
    const idx = BINS.findIndex(([lo, hi]) => d >= lo && d < hi)
    if (idx >= 0) bins[idx].count++
  }
  const avg = (f) => rows.length ? round2(rows.reduce((a, r) => a + num(r[f]), 0) / rows.length) : 0
  return {
    dummy: true, ordersWithFulfillment: rows.length, bins,
    avgTotalDays: avg('totalDays'), avgProcessingDays: avg('processingDays'), avgShippingDays: avg('shippingDays'),
    note: 'DUMMY — fabricated fulfilment durations (Order has no status-transition timestamps).',
  }
}

/** One SKU: stock / turnover / classification + per-date sales history (REAL). */
export async function getProductStockDetail(tenantId, sku) {
  const items = await loadStock(tenantId)
  const nsku = normalizeSku(sku)
  const it = items.find(i => i.sku === nsku)
  if (!it) return null
  const medQty = median(items.map(i => i.qtySold)), medStock = median(items.map(i => i.stock))
  const history = await prisma.$queryRaw(Prisma.sql`
    SELECT o.order_date::date AS d, SUM(oi.qty)::int AS qty, COALESCE(SUM(oi.subtotal), 0) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.tenant_id = ${tenantId} AND oi.sku = ${sku} AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})
    GROUP BY 1 ORDER BY 1`)
  return {
    dummy: false, ...it, quadrant: classifyStock(it, medQty, medStock),
    stockNote: it.stock === 0 ? 'Stock is 0 (real, but not tracked) — turnover undefined; classified by demand.' : null,
    history: history.map(h => ({ date: iso(h.d), qty: num(h.qty), revenue: round2(h.revenue) })),
  }
}

/** One order: REAL status/date + DUMMY fulfilment durations — clearly separated. */
export async function getFulfillmentDetail(tenantId, orderId) {
  const order = await prisma.order.findFirst({
    where: { id: Number(orderId), tenantId },
    select: { id: true, orderId: true, status: true, orderDate: true, platform: true, gmv: true },
  })
  if (!order) return null
  const ful = await prisma.orderFulfillment.findFirst({
    where: { tenantId, orderId: order.id }, select: { processingDays: true, shippingDays: true, totalDays: true },
  })
  return {
    real: { dummy: false, orderId: order.orderId, status: order.status, stage: classifyStage(order.status),
      date: iso(order.orderDate), platform: order.platform, gmv: round2(order.gmv) },
    fulfillment: ful
      ? { dummy: true, processingDays: ful.processingDays, shippingDays: ful.shippingDays, totalDays: ful.totalDays,
          note: 'Fabricated fulfilment time (no real status-transition timestamps).' }
      : { dummy: true, note: 'No fulfilment row (order not in a fulfilling status).' },
  }
}
