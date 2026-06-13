// ─── Billing business logic ──────────────────────────────────────────────────
// The single source of truth for turning a payment outcome into subscription
// state. Called by BOTH the Midtrans webhook AND the mock-confirm route — never
// duplicate the subscription-update logic.
import { prisma } from './prisma'
import { invalidatePlanCache } from './subscription-gate'

const DAYS_PER_MONTH = 30

/**
 * Apply a payment outcome to its PaymentRecord + Subscription.
 *
 * @param {object}  args
 * @param {string}  args.orderId            midtransOrderId of the PaymentRecord
 * @param {string}  args.transactionStatus  Midtrans transaction_status
 * @param {string} [args.fraudStatus]       Midtrans fraud_status (for 'capture')
 * @param {string} [args.transactionId]     Midtrans transaction_id
 * @returns {Promise<{ found: boolean, outcome: 'paid'|'failed'|'ignored' }>}
 */
export async function processPayment({ orderId, transactionStatus, fraudStatus, transactionId }) {
  const record = await prisma.paymentRecord.findUnique({ where: { midtransOrderId: orderId } })
  if (!record) return { found: false, outcome: 'ignored' }

  const isPaid =
    transactionStatus === 'settlement' ||
    (transactionStatus === 'capture' && fraudStatus === 'accept')
  const isFailed = ['deny', 'cancel', 'expire'].includes(transactionStatus)

  // PAID — idempotent: a duplicate webhook must not extend the period twice.
  if (isPaid) {
    if (record.status === 'paid') return { found: true, outcome: 'paid' }

    await prisma.$transaction(async (tx) => {
      await tx.paymentRecord.update({
        where: { id: record.id },
        data: {
          status:                'paid',
          paidAt:                new Date(),
          midtransTransactionId: transactionId ?? record.midtransTransactionId,
        },
      })

      const now = new Date()
      const end = new Date(now.getTime() + record.periodMonths * DAYS_PER_MONTH * 86400000)
      await tx.subscription.update({
        where: { id: record.subscriptionId },
        data: {
          status:             'active',
          currentPeriodStart: now,
          currentPeriodEnd:   end,
          gracePeriodEnd:     null,
          planId:             record.planId, // handles upgrades
        },
      })
    })
    // Plan may have changed (upgrade) and status is now active — drop the
    // cached plan so gates pick up the new entitlements immediately.
    invalidatePlanCache(record.tenantId)
    return { found: true, outcome: 'paid' }
  }

  // FAILED
  if (isFailed) {
    if (record.status !== 'paid') {
      await prisma.paymentRecord.update({ where: { id: record.id }, data: { status: 'failed' } })
    }
    return { found: true, outcome: 'failed' }
  }

  // Anything else (pending, authorize, …) — leave untouched.
  return { found: true, outcome: 'ignored' }
}

const GRACE_DAYS = 7

/**
 * Subscription expiry sweeps. Shared by the Vercel Cron route and the dev
 * test-trigger route — never duplicated.
 *
 * Each sweep captures the affected rows FIRST (findMany), then transitions
 * them, then invalidates the plan cache per tenant — because updateMany
 * returns only a count, and after the update the rows no longer match the
 * old status.
 *
 * @returns {Promise<{ trial_to_grace:number, active_to_grace:number, grace_to_suspended:number }>}
 */
export async function runExpiryChecks() {
  const now = new Date()

  // Sweep 1 — trial → grace (gracePeriodEnd = now + 7d; uniform → updateMany)
  const trial = await prisma.subscription.findMany({
    where:  { status: 'trial', currentPeriodEnd: { lt: now } },
    select: { id: true, tenantId: true },
  })
  if (trial.length) {
    await prisma.subscription.updateMany({
      where: { id: { in: trial.map(s => s.id) } },
      data:  { status: 'grace', gracePeriodEnd: new Date(now.getTime() + GRACE_DAYS * 86400000) },
    })
    trial.forEach(s => invalidatePlanCache(s.tenantId))
  }

  // Sweep 2 — active → grace (gracePeriodEnd = THIS ROW'S currentPeriodEnd + 7d).
  // Per-row computed value → can't be a single updateMany; use a tx of updates.
  const active = await prisma.subscription.findMany({
    where:  { status: 'active', currentPeriodEnd: { lt: now } },
    select: { id: true, tenantId: true, currentPeriodEnd: true },
  })
  if (active.length) {
    await prisma.$transaction(active.map(s =>
      prisma.subscription.update({
        where: { id: s.id },
        data:  { status: 'grace', gracePeriodEnd: new Date(s.currentPeriodEnd.getTime() + GRACE_DAYS * 86400000) },
      })
    ))
    active.forEach(s => invalidatePlanCache(s.tenantId))
  }

  // Sweep 3 — grace → suspended (uniform → updateMany)
  const grace = await prisma.subscription.findMany({
    where:  { status: 'grace', gracePeriodEnd: { lt: now } },
    select: { id: true, tenantId: true },
  })
  if (grace.length) {
    await prisma.subscription.updateMany({
      where: { id: { in: grace.map(s => s.id) } },
      data:  { status: 'suspended', gracePeriodEnd: null },
    })
    grace.forEach(s => invalidatePlanCache(s.tenantId))
  }

  console.log('[expiry] transitions', { trial_to_grace: trial.length, active_to_grace: active.length, grace_to_suspended: grace.length })
  return { trial_to_grace: trial.length, active_to_grace: active.length, grace_to_suspended: grace.length }
}
