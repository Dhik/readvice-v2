// ─── Market Basket engine (Wave 2 §2.4 — REAL, small-sample) ────────────────
// Product co-purchase analysis from REAL OrderItem data (which SKUs appear together in
// the same order). Support / confidence / lift are computed from real counts — NOTHING
// is fabricated. The honesty here is about SAMPLE SIZE, not dummy data.
//
// Reality (tenant 2 — OrderItem is Cleora-only): ~606 orders with items but only the
// MULTI-ITEM orders (≥2 distinct SKUs) produce pairs, and that count is small. The engine
// surfaces `multiItemOrderCount` + a `smallSample` flag so results aren't over-trusted.
// Other tenants → hasData:false. This is the CROSS-PRODUCT relationship lens — it does NOT
// rebuild SP1's per-SKU revenue/Pareto. See docs/BASKET_DATA_SOURCES.md.
//
// Tenant-scoped every read; Decimal/BigInt → Number.
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { EXCLUDED_STATUSES } from '../hpp/compute-hpp'

const round2 = n => Math.round((Number(n) || 0) * 100) / 100
const round4 = n => Math.round((Number(n) || 0) * 10000) / 10000
const num    = v => Number(v ?? 0)
const iso    = d => (d ? new Date(d).toISOString().slice(0, 10) : null)

const SMALL_SAMPLE_MAX = 50   // multi-item orders below this → not statistically reliable

// ── Core loader: real co-purchase structure (orders → SKU sets) ──────────────
async function loadBasket(tenantId) {
  // One distinct (order, sku) row per real-sales line. Tiny (~600 rows) → compute in JS.
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT oi.order_id AS order_id, oi.sku AS sku, o.order_date::date AS d
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.tenant_id = ${tenantId} AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)}) AND oi.sku IS NOT NULL`)
  if (!rows.length) return { hasData: false }

  // Per-SKU name + revenue + order count (for node sizing). Names reuse SP1's fallback.
  const skuAgg = await prisma.$queryRaw(Prisma.sql`
    SELECT oi.sku AS sku, COALESCE(MAX(p.name), MAX(oi.product_name)) AS name,
           COUNT(DISTINCT oi.order_id)::int AS orders, COALESCE(SUM(oi.subtotal), 0) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.sku = oi.sku AND p.tenant_id = o.tenant_id
    WHERE o.tenant_id = ${tenantId} AND o.status NOT IN (${Prisma.join(EXCLUDED_STATUSES)}) AND oi.sku IS NOT NULL
    GROUP BY oi.sku`)
  const meta = new Map(skuAgg.map(s => [s.sku, { name: s.name ?? s.sku, orders: num(s.orders), revenue: round2(s.revenue) }]))

  // order → { skus:Set, date }
  const orders = new Map()
  for (const r of rows) {
    const o = orders.get(r.order_id) ?? { skus: new Set(), date: iso(r.d) }
    o.skus.add(r.sku); orders.set(r.order_id, o)
  }
  const totalOrders = orders.size
  const skuCount = new Map()       // sku → # orders containing it (support count)
  for (const [, o] of orders) for (const s of o.skus) skuCount.set(s, (skuCount.get(s) ?? 0) + 1)

  // Pair co-occurrence (a<b) over MULTI-ITEM orders only.
  const pairCount = new Map()      // 'a|b' → co-occurrence orders
  const multiOrders = []
  for (const [id, o] of orders) {
    if (o.skus.size < 2) continue
    multiOrders.push({ orderId: id, date: o.date, skus: [...o.skus] })
    const arr = [...o.skus].sort()
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const k = `${arr[i]}|${arr[j]}`; pairCount.set(k, (pairCount.get(k) ?? 0) + 1)
    }
  }
  return { hasData: true, totalOrders, skuCount, pairCount, meta, multiOrders }
}

const nmeta = (meta, sku) => meta.get(sku) ?? { name: sku, orders: 0, revenue: 0 }

// Build a pair record with support / confidence (both directions) / lift from real counts.
function buildPair(a, b, cooccur, totalOrders, skuCount, meta) {
  const cA = skuCount.get(a) || 0, cB = skuCount.get(b) || 0
  const support = totalOrders > 0 ? cooccur / totalOrders : 0
  const lift = (cA > 0 && cB > 0) ? round2((cooccur * totalOrders) / (cA * cB)) : 0
  return {
    a, b, aName: nmeta(meta, a).name, bName: nmeta(meta, b).name,
    cooccur, ordersA: cA, ordersB: cB,
    support: round4(support), supportPct: round2(support * 100),
    confidenceAtoB: cA > 0 ? round2((cooccur / cA) * 100) : 0,   // P(B|A) %
    confidenceBtoA: cB > 0 ? round2((cooccur / cB) * 100) : 0,   // P(A|B) %
    lift,
  }
}

/** Overview: orders, the multi-item denominator, # pairs, top pair by lift, small-sample flag. */
export async function getBasketOverview(tenantId) {
  const b = await loadBasket(tenantId)
  if (!b.hasData) return { dummy: false, hasData: false, note: 'No OrderItem (SKU-level) data for this tenant — basket analysis is Cleora/tenant-2 only in dev.' }
  const pairs = [...b.pairCount.entries()].map(([k, c]) => { const [a, bb] = k.split('|'); return buildPair(a, bb, c, b.totalOrders, b.skuCount, b.meta) })
    .sort((x, y) => y.lift - x.lift)
  const top = pairs[0] ?? null
  return {
    dummy: false, hasData: true,
    totalOrders: b.totalOrders, multiItemOrderCount: b.multiOrders.length, distinctPairs: pairs.length,
    smallSample: b.multiOrders.length < SMALL_SAMPLE_MAX,
    distinctSkus: b.skuCount.size,
    topPair: top ? { a: top.a, b: top.b, aName: top.aName, bName: top.bName, lift: top.lift, cooccur: top.cooccur, confidenceAtoB: top.confidenceAtoB } : null,
    note: b.multiOrders.length < SMALL_SAMPLE_MAX
      ? `Only ${b.multiOrders.length} multi-item orders produce pairs (of ${b.totalOrders}) — REAL but SMALL-SAMPLE; treat lifts as directional, not reliable. Grows as OrderItem coverage expands.`
      : null,
  }
}

/** All co-purchase pairs (ranked by lift) + nodes — for the NETWORK GRAPH + MATRIX HEATMAP. */
export async function getAffinityPairs(tenantId, { minCooccur = 1 } = {}) {
  const b = await loadBasket(tenantId)
  if (!b.hasData) return { dummy: false, hasData: false, pairs: [], nodes: [] }
  const pairs = [...b.pairCount.entries()]
    .filter(([, c]) => c >= minCooccur)
    .map(([k, c]) => { const [a, bb] = k.split('|'); return buildPair(a, bb, c, b.totalOrders, b.skuCount, b.meta) })
    .sort((x, y) => y.lift - x.lift)
  // Nodes = SKUs that appear in at least one pair (the graph's vertices).
  const inPair = new Set()
  for (const p of pairs) { inPair.add(p.a); inPair.add(p.b) }
  const nodes = [...inPair].map(sku => ({ sku, name: nmeta(b.meta, sku).name, orders: b.skuCount.get(sku) || 0, revenue: nmeta(b.meta, sku).revenue }))
    .sort((x, y) => y.orders - x.orders)
  return {
    dummy: false, hasData: true,
    totalOrders: b.totalOrders, multiItemOrderCount: b.multiOrders.length,
    smallSample: b.multiOrders.length < SMALL_SAMPLE_MAX,
    pairs, nodes,
  }
}

/** One SKU's top co-purchased partners ("bought X also bought Y"), by confidence. */
export async function getProductAffinity(tenantId, sku) {
  const b = await loadBasket(tenantId)
  if (!b.hasData) return null
  if (!b.skuCount.has(sku)) return { dummy: false, hasData: true, sku, name: sku, orders: 0, partners: [], note: 'SKU has no real-sales orders.' }
  const partners = []
  for (const [k, c] of b.pairCount) {
    const [a, bb] = k.split('|')
    if (a !== sku && bb !== sku) continue
    const partner = a === sku ? bb : a
    const p = buildPair(sku, partner, c, b.totalOrders, b.skuCount, b.meta)
    partners.push({ sku: partner, name: nmeta(b.meta, partner).name, cooccur: c,
      confidence: p.confidenceAtoB, lift: p.lift, partnerOrders: b.skuCount.get(partner) || 0 })
  }
  partners.sort((x, y) => y.confidence - x.confidence || y.lift - x.lift)
  return { dummy: false, hasData: true, sku, name: nmeta(b.meta, sku).name, orders: b.skuCount.get(sku) || 0, partners }
}

/** The actual multi-item orders behind the pairs — transparency (these ARE the real data). */
export async function getBasketDetail(tenantId, { limit = 100 } = {}) {
  const b = await loadBasket(tenantId)
  if (!b.hasData) return { dummy: false, hasData: false, orders: [] }
  const orders = b.multiOrders
    .map(o => ({ orderId: o.orderId, date: o.date, skuCount: o.skus.length,
      skus: o.skus.map(s => ({ sku: s, name: nmeta(b.meta, s).name })) }))
    .sort((x, y) => (y.date || '').localeCompare(x.date || '') || y.skuCount - x.skuCount)
    .slice(0, limit)
  return {
    dummy: false, hasData: true,
    multiItemOrderCount: b.multiOrders.length, totalOrders: b.totalOrders,
    smallSample: b.multiOrders.length < SMALL_SAMPLE_MAX, orders,
  }
}
