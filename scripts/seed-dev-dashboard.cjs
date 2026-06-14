// DEV-ONLY dummy seeder for the dashboard data sources (Visit + AdSpend).
// Tenant 2 ONLY, date-aligned to that tenant's real Order dates. Every row is
// source='DUMMY' so scripts/clear-dev-dashboard.cjs removes it in one step and a
// real connector (source!='DUMMY') can coexist. Idempotent: clears DUMMY first.
//
//   visits          = orders × (15..40)         → closing rate a few %
//   ad spend total  = real-sales GMV / ROAS,  ROAS ∈ [1.5, 4]  (split social/mktp)
require('./_load-env')
const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient()

const TENANT = 2
const EXCLUDED = ['cancelled', 'Batal', 'canceled', 'Canceled', 'Pembatalan diajukan',
  'Dibatalkan Sistem', 'Dibatalkan', 'Belum Bayar', 'pending']

const randInt   = (a, b) => Math.floor(a + Math.random() * (b - a + 1))
const randFloat = (a, b) => a + Math.random() * (b - a)
const round2    = n => Math.round(n * 100) / 100

;(async () => {
  try {
    // Per (date, platform) for tenant 2: all-orders count (→ visits) + real-sales GMV (→ spend).
    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT date_trunc('day', o.order_date)::date AS d,
             o.platform AS platform,
             COUNT(*)::int AS orders_all,
             COALESCE(SUM(o.gmv) FILTER (WHERE o.status NOT IN (${Prisma.join(EXCLUDED)})), 0) AS gmv_real
      FROM orders o
      WHERE o.tenant_id = ${TENANT}
      GROUP BY 1, 2
      ORDER BY 1, 2`)

    if (!rows.length) { console.log(`No orders for tenant ${TENANT} — nothing to seed.`); return }

    // Idempotent: wipe this tenant's DUMMY rows first.
    const delV = await prisma.visit.deleteMany({ where: { tenantId: TENANT, source: 'DUMMY' } })
    const delA = await prisma.adSpend.deleteMany({ where: { tenantId: TENANT, source: 'DUMMY' } })
    console.log(`Cleared existing DUMMY → visits:${delV.count} adSpend:${delA.count}`)

    const visitRows = []
    const adRows    = []
    let roasMin = Infinity, roasMax = -Infinity, crMin = Infinity, crMax = -Infinity

    for (const r of rows) {
      const date     = new Date(`${r.d.toISOString().slice(0, 10)}T00:00:00Z`)
      const platform = r.platform
      const orders   = Number(r.orders_all)
      const gmvReal  = Number(r.gmv_real)

      const visits = orders * randInt(15, 40)
      visitRows.push({ tenantId: TENANT, date, platform, visits, source: 'DUMMY' })

      // Size spend so ROAS lands ~1.5–4x vs that day's real-sales GMV.
      if (gmvReal > 0) {
        const roas  = randFloat(1.5, 4)
        const total = gmvReal / roas
        const social = round2(total * 0.4)
        const mktp   = round2(total * 0.6)
        adRows.push({ tenantId: TENANT, date, platform, kind: 'social',      amount: social, source: 'DUMMY' })
        adRows.push({ tenantId: TENANT, date, platform, kind: 'marketplace', amount: mktp,   source: 'DUMMY' })
        roasMin = Math.min(roasMin, roas); roasMax = Math.max(roasMax, roas)
      }
      const cr = visits > 0 ? (orders / visits) * 100 : 0
      crMin = Math.min(crMin, cr); crMax = Math.max(crMax, cr)
    }

    await prisma.visit.createMany({ data: visitRows })
    await prisma.adSpend.createMany({ data: adRows })

    console.log(`\nSeeded tenant ${TENANT}: ${visitRows.length} Visit rows, ${adRows.length} AdSpend rows`)
    console.log(`  distinct date×platform: ${rows.length}`)
    console.log(`  ROAS range: ${roasMin.toFixed(2)}x – ${roasMax.toFixed(2)}x (target 1.5–4x)`)
    console.log(`  closing-rate range: ${crMin.toFixed(2)}% – ${crMax.toFixed(2)}%`)
  } catch (e) {
    console.error('SEED FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
