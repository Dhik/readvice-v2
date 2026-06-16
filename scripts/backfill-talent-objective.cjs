// Backfill Talent.objective / objectiveInferred for existing talents (Part C — C1).
// Tenant-scoped: computes the follower tercile + engRate threshold PER TENANT and
// applies the shared inference (scripts/_infer-objective.cjs). Idempotent and
// override-safe — re-running never clobbers a brand-owner override (objectiveInferred
// =false, set in C3). Run after `prisma db push` adds the objective columns.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const { applyObjectiveInference } = require('./_infer-objective.cjs')
const prisma = new PrismaClient()

;(async () => {
  try {
    const tenants = await prisma.talent.findMany({ distinct: ['tenantId'], select: { tenantId: true }, orderBy: { tenantId: 'asc' } })
    if (!tenants.length) { console.log('No talents in any tenant — nothing to backfill.'); return }

    let total = 0
    for (const { tenantId } of tenants) {   // sequential per tenant (connection_limit=1)
      const r = await applyObjectiveInference(prisma, tenantId)
      total += r.updated
      const top = r.tercileTop === Infinity ? '∞ (follower rule off)' : r.tercileTop
      console.log(`tenant ${tenantId}: inferred ${r.updated}, kept ${r.skipped} override(s)  | followers top-tercile ≥ ${top}  | dist ${JSON.stringify(r.distribution)}`)
    }
    console.log(`\nBackfilled ${total} talent(s) across ${tenants.length} tenant(s). objectiveInferred=true on all (overrides preserved).`)
  } catch (e) {
    console.error('BACKFILL FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
