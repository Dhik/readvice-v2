// One-step cleanup of all DUMMY BCG data (BcgProduct), every tenant. Run this
// when a real 'bcg_sync' connector arrives (it writes source!='DUMMY', which this
// leaves untouched). Reports the count deleted.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const r = await prisma.bcgProduct.deleteMany({ where: { source: 'DUMMY' } })
    console.log(`Deleted DUMMY rows → BcgProduct: ${r.count}`)
  } catch (e) {
    console.error('CLEAR FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
