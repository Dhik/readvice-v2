// Seeds the three subscription plans (starter / pro / enterprise).
// Idempotent: upserts by slug, so re-running updates prices/feature flags in place.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const PLANS = [
  {
    name: 'Starter', slug: 'starter', priceMonthly: 750000,
    maxUsers: 5, maxTenants: null,
    hasAi: false, aiQuotaMonthly: null,
    hasPdfExports: false, hasMultiTenant: false,
  },
  {
    name: 'Pro', slug: 'pro', priceMonthly: 1500000,
    maxUsers: 15, maxTenants: null,
    hasAi: true, aiQuotaMonthly: 500,
    hasPdfExports: true, hasMultiTenant: false,
  },
  {
    name: 'Enterprise', slug: 'enterprise', priceMonthly: 4000000,
    maxUsers: null, maxTenants: 5,
    hasAi: true, aiQuotaMonthly: null,
    hasPdfExports: true, hasMultiTenant: true,
  },
]

async function main() {
  for (const plan of PLANS) {
    const row = await prisma.plan.upsert({
      where:  { slug: plan.slug },
      update: plan,
      create: plan,
    })
    console.log(`Upserted plan "${row.slug}" (id=${row.id})`)
  }
  console.log(`Seeded ${PLANS.length} plans.`)
}

main()
  .catch(e => { console.error('SEED FAILED:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
