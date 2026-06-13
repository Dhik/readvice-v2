const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Clearing ad spend + monitoring data for all tenants...')

  const [meta, shopee, tiktok, lazada, monitoring] = await Promise.all([
    prisma.adSpentMeta.deleteMany({}),
    prisma.adSpentShopee.deleteMany({}),
    prisma.adSpentTiktok.deleteMany({}),
    prisma.adSpentLazada.deleteMany({}),
    prisma.adsMonitoring.deleteMany({}),
  ])

  console.log(`  adSpentMeta:      ${meta.count} rows deleted`)
  console.log(`  adSpentShopee:    ${shopee.count} rows deleted`)
  console.log(`  adSpentTiktok:    ${tiktok.count} rows deleted`)
  console.log(`  adSpentLazada:    ${lazada.count} rows deleted`)
  console.log(`  adsMonitoring:    ${monitoring.count} rows deleted`)
  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
