// One-step cleanup of all DUMMY dashboard data (Visit + AdSpend), every tenant.
// Run this when real visit/ad-spend connectors arrive (they write source!='DUMMY',
// which this leaves untouched). Reports counts deleted.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const v = await prisma.visit.deleteMany({ where: { source: 'DUMMY' } })
    const a = await prisma.adSpend.deleteMany({ where: { source: 'DUMMY' } })
    console.log(`Deleted DUMMY rows → Visit: ${v.count}, AdSpend: ${a.count}`)
  } catch (e) {
    console.error('CLEAR FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
