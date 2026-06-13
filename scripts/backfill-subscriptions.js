// Backfills an active Enterprise subscription for every existing tenant that
// has no Subscription row. These are internal/legacy accounts that must never
// be feature-gated — currentPeriodEnd is set far in the future (2099-12-31).
//
// Idempotent: tenants that already have a subscription are skipped.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const FAR_FUTURE = new Date('2099-12-31T00:00:00.000Z')

async function main() {
  const enterprise = await prisma.plan.findUnique({ where: { slug: 'enterprise' } })
  if (!enterprise) {
    console.error('FAILED: no "enterprise" plan found — run scripts/seed-plans.js first.')
    process.exit(1)
  }

  // Tenants with no subscription (Subscription.tenantId is @unique → at most one).
  const tenants = await prisma.tenant.findMany({
    where:   { subscription: null },
    select:  { id: true, name: true, slug: true },
    orderBy: { id: 'asc' },
  })

  if (tenants.length === 0) {
    console.log('Nothing to backfill — every tenant already has a subscription.')
    return
  }

  const now = new Date()
  let created = 0
  for (const t of tenants) {
    const sub = await prisma.subscription.create({
      data: {
        tenantId:           t.id,
        planId:             enterprise.id,
        status:             'active',
        currentPeriodStart: now,
        currentPeriodEnd:   FAR_FUTURE,
        gracePeriodEnd:     null,
      },
    })
    created++
    console.log(`  ✓ ${t.name} (tenant ${t.id}) → subscription ${sub.id} [enterprise/active]`)
  }
  console.log(`\nBackfilled ${created} tenant(s) with an Enterprise subscription.`)
}

main()
  .catch(e => { console.error('BACKFILL FAILED:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
