// DEV seeder for the Operational module's DUMMY slice — fulfillment time only.
// Tenant 2. The Operational module's other signals (status funnel, cancellation trend,
// stock velocity) are REAL and computed live from Orders/OrderItem/Product — NOT seeded.
//
// Why dummy: Order has no per-status-transition timestamps, so processing/shipping/total
// days can't be derived → fabricated here (source='DUMMY'). Seeded only for orders that
// actually fulfil (NOT cancelled/unpaid — those never ship), so the histogram reflects
// real fulfilment-relevant orders. Right-skewed distribution (most 1–4 days, a tail to 14).
// Idempotent.
require('./_load-env')
const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient()

const TENANT = 2
// Cancelled + unpaid/pending statuses — these orders don't fulfil, so no fulfilment time.
const NON_FULFILLING = ['Batal', 'Belum Bayar', 'pending', 'cancelled', 'Canceled',
  'request_cancel', 'request_return', 'Pembatalan diajukan', 'Dibatalkan Sistem', 'Dibatalkan']

const round1 = n => Math.round(n * 10) / 10
// Right-skewed total fulfilment days: ~70% fast (1–4), ~22% mid (4–8), ~8% slow (8–14).
function skewTotalDays() {
  const r = Math.random()
  if (r < 0.70) return 1 + Math.random() * 3      // 1–4
  if (r < 0.92) return 4 + Math.random() * 4      // 4–8
  return 8 + Math.random() * 6                     // 8–14
}

;(async () => {
  try {
    const orders = await prisma.$queryRaw(Prisma.sql`
      SELECT id FROM orders
      WHERE tenant_id = ${TENANT} AND status NOT IN (${Prisma.join(NON_FULFILLING)})`)
    if (!orders.length) { console.log(`No fulfilling orders for tenant ${TENANT} — nothing to seed.`); return }

    const del = await prisma.orderFulfillment.deleteMany({ where: { tenantId: TENANT, source: 'DUMMY' } })
    console.log(`Cleared existing DUMMY OrderFulfillment → ${del.count}`)

    const rows = []
    const bins = {}  // for a quick sanity histogram
    for (const o of orders) {
      const total = skewTotalDays()
      const processing = round1(total * (0.3 + Math.random() * 0.2)) // 30–50% of total
      const shipping = round1(Math.max(0.1, total - processing))
      const totalDays = round1(processing + shipping)
      rows.push({ tenantId: TENANT, orderId: o.id, processingDays: processing, shippingDays: shipping, totalDays, source: 'DUMMY' })
      const b = totalDays < 2 ? '0–2' : totalDays < 4 ? '2–4' : totalDays < 7 ? '4–7' : totalDays < 10 ? '7–10' : '10–14+'
      bins[b] = (bins[b] ?? 0) + 1
    }

    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) await prisma.orderFulfillment.createMany({ data: rows.slice(i, i + CHUNK) })

    const avg = rows.reduce((a, r) => a + r.totalDays, 0) / rows.length
    console.log(`\nSeeded tenant ${TENANT}: ${rows.length} OrderFulfillment rows (fulfilling orders only)`)
    console.log(`  avg total fulfilment: ${avg.toFixed(2)} days`)
    console.log(`  distribution (right-skewed):`)
    for (const b of ['0–2', '2–4', '4–7', '7–10', '10–14+']) console.log(`    ${b} days: ${bins[b] ?? 0}`)
    console.log(`  source='DUMMY' (Order has no status-transition timestamps — fabricated).`)
  } catch (e) {
    console.error('SEED FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
