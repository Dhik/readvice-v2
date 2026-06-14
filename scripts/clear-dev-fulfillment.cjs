// One-step cleanup of all DUMMY OrderFulfillment rows, every tenant. Run when real
// status-transition timestamps arrive (a recompute writes source!='DUMMY' to the same
// table, which this leaves untouched). Orders themselves are never touched. Reports count.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const r = await prisma.orderFulfillment.deleteMany({ where: { source: 'DUMMY' } })
    console.log(`Deleted DUMMY rows → OrderFulfillment: ${r.count}`)
  } catch (e) {
    console.error('CLEAR FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
