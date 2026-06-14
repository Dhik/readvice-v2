// One-step cleanup of DUMMY CohortRetention rows, every tenant. Keeps REAL-DERIVED (those
// are regenerated from real orders by the seeder/a future recompute, but harmless to keep).
// Run when real retention accrues over time. Reports counts.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const dummy = await prisma.cohortRetention.deleteMany({ where: { source: 'DUMMY' } })
    const real = await prisma.cohortRetention.count({ where: { source: 'REAL-DERIVED' } })
    console.log(`Deleted DUMMY rows → CohortRetention: ${dummy.count}  (kept REAL-DERIVED: ${real})`)
  } catch (e) {
    console.error('CLEAR FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
