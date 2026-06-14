// DEV seeder for RFM Customer Segmentation (RfmScore). Tenant 2 ONLY.
//
// TWO row kinds, distinctly flagged:
//   • source='REAL-DERIVED' — recency/frequency/monetary computed from REAL Orders
//     (the ~46% of orders that carry a customer_username). These are REAL behavior.
//   • source='DUMMY'        — synthetic customers that only PAD the segment grid so
//     the page shows every segment (real data clusters in low-frequency cells —
//     max real frequency is 2). Fabricated; flagged.
//
// Scores (1-5) use FIXED THRESHOLDS (not quintiles): real frequency is almost all
// 1-2, so quintiles would collapse. Thresholds are absolute & documented in
// docs/RFM_DATA_SOURCES.md. segment = standard R×F grid. Idempotent (clears DUMMY +
// REAL-DERIVED first — both are regenerable). asOfDate = the tenant's last order date.
require('./_load-env')
const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient()

const TENANT = 2
const EXCLUDED = ['Batal', 'Belum Bayar', 'pending', 'cancelled', 'Canceled',
  'request_cancel', 'request_return', 'Pembatalan diajukan', 'Dibatalkan Sistem', 'Dibatalkan']

// ── Fixed-threshold scoring (documented constants) ────────────────────────────
const rFromDays = d => d <= 7 ? 5 : d <= 30 ? 4 : d <= 90 ? 3 : d <= 180 ? 2 : 1
const fFromFreq = f => f >= 10 ? 5 : f >= 5 ? 4 : f >= 3 ? 3 : f >= 2 ? 2 : 1
const mFromMon  = m => m >= 5e6 ? 5 : m >= 2e6 ? 4 : m >= 1e6 ? 3 : m >= 5e5 ? 2 : 1

// Standard 11-segment R×F grid (rows = R 1..5, cols = F 1..5).
const SEGMENT_GRID = {
  5: ['New Customers', 'Potential Loyalist', 'Potential Loyalist', 'Loyal Customers', 'Champions'],
  4: ['Promising', 'Potential Loyalist', 'Potential Loyalist', 'Loyal Customers', 'Champions'],
  3: ['About to Sleep', 'Need Attention', 'Need Attention', 'Loyal Customers', 'Loyal Customers'],
  2: ['Hibernating', 'At Risk', 'At Risk', "Can't Lose Them", "Can't Lose Them"],
  1: ['Lost', 'Hibernating', 'At Risk', "Can't Lose Them", "Can't Lose Them"],
}
const segmentFor = (r, f) => SEGMENT_GRID[r][f - 1]

const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1))
const dayMs = 86400000

;(async () => {
  try {
    const asOfRow = await prisma.$queryRaw(Prisma.sql`SELECT MAX(order_date)::date AS d FROM orders WHERE tenant_id = ${TENANT}`)
    if (!asOfRow[0]?.d) { console.log(`No orders for tenant ${TENANT} — nothing to seed.`); return }
    const asOf = new Date(`${asOfRow[0].d.toISOString().slice(0, 10)}T00:00:00Z`)

    // Idempotent: wipe regenerable rows first (both kinds).
    const del = await prisma.rfmScore.deleteMany({ where: { tenantId: TENANT, source: { in: ['DUMMY', 'REAL-DERIVED'] } } })
    console.log(`Cleared existing RfmScore (DUMMY + REAL-DERIVED) → ${del.count}`)

    // ── REAL-DERIVED: per-customer RFM from real orders (excl. cancelled) ────────
    const real = await prisma.$queryRaw(Prisma.sql`
      SELECT o.customer_username        AS key,
             MAX(o.customer_name)        AS name,
             COUNT(DISTINCT o.id)::int   AS frequency,
             COALESCE(SUM(o.gmv), 0)     AS monetary,
             MAX(o.order_date)::date     AS last_order
      FROM orders o
      WHERE o.tenant_id = ${TENANT}
        AND o.customer_username IS NOT NULL
        AND o.status NOT IN (${Prisma.join(EXCLUDED)})
      GROUP BY o.customer_username`)

    const rows = []
    const segCount = {}
    for (const c of real) {
      const last = new Date(`${c.last_order.toISOString().slice(0, 10)}T00:00:00Z`)
      const recencyDays = Math.max(0, Math.round((asOf - last) / dayMs))
      const frequency = Number(c.frequency)
      const monetary = Math.round(Number(c.monetary) * 100) / 100
      const r = rFromDays(recencyDays), f = fFromFreq(frequency), m = mFromMon(monetary)
      const segment = segmentFor(r, f)
      segCount[segment] = (segCount[segment] ?? 0) + 1
      rows.push({
        tenantId: TENANT, customerKey: String(c.key), customerName: c.name ?? String(c.key),
        recencyDays, frequency, monetary, rScore: r, fScore: f, mScore: m, segment,
        asOfDate: asOf, source: 'REAL-DERIVED',
      })
    }
    const realCount = rows.length

    // ── DUMMY padding: 2 synthetic customers per (R,F) cell → every segment shown ─
    // Values are chosen to land in the target R/F band (so the page's segment grid
    // is fully populated even though real data clusters in low-frequency cells).
    const rBand = { 5: [0, 7], 4: [8, 30], 3: [31, 90], 2: [91, 180], 1: [181, 365] }
    const fBand = { 5: [10, 20], 4: [5, 9], 3: [3, 4], 2: [2, 2], 1: [1, 1] }
    let dummyCount = 0
    for (let r = 1; r <= 5; r++) {
      for (let f = 1; f <= 5; f++) {
        for (let i = 0; i < 2; i++) {
          const recencyDays = randInt(rBand[r][0], rBand[r][1])
          const frequency = randInt(fBand[f][0], fBand[f][1])
          const monetary = Math.round(frequency * randInt(80000, 400000) * 100) / 100
          const m = mFromMon(monetary)
          const segment = segmentFor(r, f)
          segCount[segment] = (segCount[segment] ?? 0) + 1
          rows.push({
            tenantId: TENANT, customerKey: `dummy-r${r}f${f}-${i}`, customerName: `Sample Customer ${r}${f}${i}`,
            recencyDays, frequency, monetary, rScore: r, fScore: f, mScore: m, segment,
            asOfDate: asOf, source: 'DUMMY',
          })
          dummyCount++
        }
      }
    }

    // Bulk insert (createMany = one statement; safe with connection_limit=1).
    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) await prisma.rfmScore.createMany({ data: rows.slice(i, i + CHUNK) })

    console.log(`\nSeeded tenant ${TENANT} @ asOf ${asOf.toISOString().slice(0, 10)}: ${rows.length} RfmScore rows`)
    console.log(`  REAL-DERIVED (real orders): ${realCount} customers`)
    console.log(`  DUMMY (segment padding):    ${dummyCount} customers`)
    console.log(`  segment counts:`)
    for (const s of Object.keys(segCount).sort()) console.log(`    ${s}: ${segCount[s]}`)
  } catch (e) {
    console.error('SEED FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
