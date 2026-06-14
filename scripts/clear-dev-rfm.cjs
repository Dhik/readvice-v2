// One-step cleanup of all regenerable RFM data (RfmScore), every tenant. Both
// 'DUMMY' (padding) and 'REAL-DERIVED' (computed from orders) are regenerable — a
// recompute job rebuilds REAL-DERIVED from current orders, so clearing both is safe.
// Reports counts deleted per kind.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const dummy = await prisma.rfmScore.deleteMany({ where: { source: 'DUMMY' } })
    const real  = await prisma.rfmScore.deleteMany({ where: { source: 'REAL-DERIVED' } })
    console.log(`Deleted RfmScore → DUMMY: ${dummy.count}, REAL-DERIVED: ${real.count}, total: ${dummy.count + real.count}`)
  } catch (e) {
    console.error('CLEAR FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
