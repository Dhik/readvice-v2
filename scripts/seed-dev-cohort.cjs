// DEV seeder for Cohort Retention (CohortRetention). Tenant 2. MOST dummy-heavy module.
//
// Acquisition = first real-sales order month per customer (same identity rule as RFM:
// customer_username, EXCLUDED_STATUSES). REAL: each real acquisition month's period-0 size
// (+ any real period-1+ repeats that have actually elapsed). DUMMY: retention decay for
// non-elapsed periods, and earlier "shape" cohorts that don't exist in real data — so the
// triangular heatmap is demonstrable. Cell-level source flag. DYNAMIC dates (anchored to
// real max order month — no hardcoded 2025/2026). Idempotent.
require('./_load-env')
const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient()

const TENANT = 2
const N_COHORTS = 8   // anchor + 7 prior months → triangle up to period 7
const EXCLUDED = ['Batal', 'Belum Bayar', 'pending', 'cancelled', 'Canceled',
  'request_cancel', 'request_return', 'Pembatalan diajukan', 'Dibatalkan Sistem', 'Dibatalkan']

const round1 = n => Math.round(n * 10) / 10
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1))
const jitter = (v, p = 0.15) => v * (1 + (Math.random() * 2 - 1) * p)
// Realistic decay template by period (period 0 = 100). Levels off ~8-10%.
const DECAY = { 1: 38, 2: 24, 3: 18, 4: 14, 5: 12, 6: 10, 7: 9, 8: 8, 9: 8, 10: 7, 11: 7 }
const ym = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
const monthsBetween = (a, b) => (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())

;(async () => {
  try {
    // Anchor = latest real order month (DYNAMIC).
    const mx = await prisma.$queryRaw(Prisma.sql`SELECT MAX(order_date)::date AS d FROM orders WHERE tenant_id = ${TENANT}`)
    if (!mx[0]?.d) { console.log(`No orders for tenant ${TENANT} — nothing to seed.`); return }
    const maxDate = new Date(mx[0].d)
    const anchor = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), 1)) // 1st of latest month

    // REAL acquisition cohorts: first-order month per customer (same identity as RFM).
    const realRows = await prisma.$queryRaw(Prisma.sql`
      WITH firsts AS (
        SELECT customer_username, MIN(order_date)::date AS first_date
        FROM orders WHERE tenant_id = ${TENANT} AND customer_username IS NOT NULL AND status NOT IN (${Prisma.join(EXCLUDED)})
        GROUP BY customer_username)
      SELECT to_char(first_date, 'YYYY-MM') AS cohort, COUNT(*)::int AS size FROM firsts GROUP BY 1`)
    const realSize = new Map(realRows.map(r => [r.cohort, r.size]))   // 'YYYY-MM' → real cohort size

    // REAL period-1+ retention (where elapsed real time exists): distinct repeat customers per (cohort, period).
    const realRetRows = await prisma.$queryRaw(Prisma.sql`
      WITH firsts AS (
        SELECT customer_username, MIN(order_date)::date AS first_date
        FROM orders WHERE tenant_id = ${TENANT} AND customer_username IS NOT NULL AND status NOT IN (${Prisma.join(EXCLUDED)})
        GROUP BY customer_username)
      SELECT to_char(f.first_date, 'YYYY-MM') AS cohort,
             ((date_part('year', o.order_date) - date_part('year', f.first_date)) * 12
              + (date_part('month', o.order_date) - date_part('month', f.first_date)))::int AS period,
             COUNT(DISTINCT o.customer_username)::int AS retained
      FROM orders o JOIN firsts f ON f.customer_username = o.customer_username
      WHERE o.tenant_id = ${TENANT} AND o.status NOT IN (${Prisma.join(EXCLUDED)})
      GROUP BY 1, 2`)
    const realRet = new Map(realRetRows.map(r => [`${r.cohort}|${r.period}`, r.retained]))

    // Idempotent: clear regenerable rows (both kinds).
    const del = await prisma.cohortRetention.deleteMany({ where: { tenantId: TENANT, source: { in: ['DUMMY', 'REAL-DERIVED'] } } })
    console.log(`Cleared existing CohortRetention (DUMMY + REAL-DERIVED) → ${del.count}`)

    const rows = []
    let realCells = 0, dummyCells = 0
    // Build a TRIANGLE: cohort j months before anchor has periods 0..j (elapsed).
    for (let j = N_COHORTS - 1; j >= 0; j--) {
      const cohortDate = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - j, 1))
      const cohortYm = ym(cohortDate)
      const realThisCohort = realSize.get(cohortYm)
      const cohortSize = realThisCohort ?? randInt(180, 600)   // real size where it exists, else dummy

      for (let period = 0; period <= j; period++) {
        let retained, retentionPct, source
        const realRetained = realRet.get(`${cohortYm}|${period}`)
        if (realThisCohort != null && realRetained != null) {
          // REAL cell: this acquisition month is real AND this period actually elapsed with real repeats.
          retained = period === 0 ? cohortSize : realRetained
          retentionPct = round1((retained / cohortSize) * 100)
          source = 'REAL-DERIVED'; realCells++
        } else if (period === 0) {
          // Period 0 of a dummy cohort = its (dummy) full size at 100%.
          retained = cohortSize; retentionPct = 100; source = 'DUMMY'; dummyCells++
        } else {
          // DUMMY decay curve.
          retentionPct = round1(Math.max(4, Math.min(100, jitter(DECAY[period] ?? 7))))
          retained = Math.round(cohortSize * retentionPct / 100)
          source = 'DUMMY'; dummyCells++
        }
        rows.push({ tenantId: TENANT, cohortMonth: cohortDate, periodIndex: period, customersRetained: retained, cohortSize, retentionPct, source })
      }
    }

    await prisma.cohortRetention.createMany({ data: rows })

    const cohorts = new Set(rows.map(r => ym(r.cohortMonth)))
    console.log(`\nSeeded tenant ${TENANT}: ${rows.length} cells across ${cohorts.size} cohorts (anchor ${ym(anchor)}, DYNAMIC)`)
    console.log(`  cohorts: ${[...cohorts].sort().join(', ')}`)
    console.log(`  REAL-DERIVED cells: ${realCells} | DUMMY cells: ${dummyCells}`)
    const real0 = rows.filter(r => r.source === 'REAL-DERIVED' && r.periodIndex === 0)
    real0.forEach(r => console.log(`  REAL period-0: ${ym(r.cohortMonth)} size ${r.cohortSize}`))
    console.log(`  (real order months: ${[...realSize.keys()].sort().join(', ')} — retention period-1+ is DUMMY: insufficient elapsed history)`)
  } catch (e) {
    console.error('SEED FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
