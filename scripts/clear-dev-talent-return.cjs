// One-step cleanup of all DUMMY TalentReturn rows, every tenant. Run when a real
// talent→revenue link arrives (a recompute writes source!='DUMMY' to the same table,
// which this leaves untouched). The talent COST tables are never touched. Reports count.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const r = await prisma.talentReturn.deleteMany({ where: { source: 'DUMMY' } })
    console.log(`Deleted DUMMY rows → TalentReturn: ${r.count}`)
  } catch (e) {
    console.error('CLEAR FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
