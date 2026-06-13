// ─── Subscription feature gating (server-side only) ──────────────────────────
// Shared helpers for gating features by the tenant's plan. trial / active /
// grace all keep feature access; only 'suspended' (or no subscription) loses it.
import { prisma } from './prisma'

export class GateError extends Error {
  constructor({ status, message }) {
    super(message)
    this.status = status
    this.name = 'GateError'
  }
}

// 60-second in-memory cache, keyed by tenantId. Per-process; payment success
// calls invalidatePlanCache() to force a fresh read on the local instance.
const planCache = new Map() // tenantId → { plan, cachedAt }
const TTL_MS = 60_000

/**
 * @returns {Promise<object|null>} the tenant's Plan if its subscription is
 *   trial/active/grace; null if suspended or no subscription.
 */
export async function getActivePlan(tenantId) {
  if (!tenantId) return null
  const hit = planCache.get(tenantId)
  if (hit && Date.now() - hit.cachedAt < TTL_MS) return hit.plan

  const sub = await prisma.subscription.findUnique({
    where:   { tenantId },
    include: { plan: true },
  })
  const plan = sub && ['trial', 'active', 'grace'].includes(sub.status) ? sub.plan : null
  planCache.set(tenantId, { plan, cachedAt: Date.now() })
  return plan
}

export function invalidatePlanCache(tenantId) {
  planCache.delete(tenantId)
}

/**
 * Live subscription state for the dashboard banner / billing UI — single source
 * of the days-remaining math. Reads directly (not the 60s cache) so it always
 * reflects the current status and period dates.
 * @returns {Promise<{ status: string|null, daysRemaining: number, plan: object|null }>}
 */
export async function getSubscriptionStatus(tenantId) {
  if (!tenantId) return { status: null, daysRemaining: 0, plan: null }

  const sub = await prisma.subscription.findUnique({
    where:   { tenantId },
    include: { plan: true },
  })
  if (!sub) return { status: null, daysRemaining: 0, plan: null }

  const now = new Date()
  const ceilDays = (end) => Math.max(0, Math.ceil((new Date(end) - now) / 86400000))

  let daysRemaining = 0
  if (sub.status === 'trial' || sub.status === 'active') {
    daysRemaining = ceilDays(sub.currentPeriodEnd)
  } else if (sub.status === 'grace') {
    daysRemaining = ceilDays(sub.gracePeriodEnd ?? sub.currentPeriodEnd)
  } // suspended / other → 0

  return { status: sub.status, daysRemaining, plan: sub.plan }
}

/**
 * Assert the tenant's plan has `flag` enabled.
 * @param {number} tenantId
 * @param {'hasAi'|'hasPdfExports'|'hasMultiTenant'} flag
 * @returns {Promise<object>} the active plan (thread it into assertAiQuota to
 *   avoid a second fetch).
 * @throws {GateError} 403 if no active plan or the flag is off.
 */
export async function assertFeature(tenantId, flag) {
  const plan = await getActivePlan(tenantId)
  if (!plan || plan[flag] === false) {
    // Error path only — find the cheapest plan that offers this feature.
    const required = await prisma.plan.findFirst({
      where:   { [flag]: true, isActive: true },
      orderBy: { priceMonthly: 'asc' },
    })
    throw new GateError({
      status:  403,
      message: `Upgrade required: ${required?.name ?? 'a higher'} plan`,
    })
  }
  return plan
}

/**
 * Assert the tenant hasn't exceeded its monthly AI message quota.
 * Reuses the plan object from assertFeature (no second plan fetch).
 * @param {number} tenantId
 * @param {object} plan  the plan returned by assertFeature
 * @throws {GateError} 429 if the quota is reached.
 */
export async function assertAiQuota(tenantId, plan) {
  if (plan.aiQuotaMonthly == null) return // null = unlimited

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const count = await prisma.aiMessage.count({
    where: { conversation: { tenantId }, createdAt: { gte: monthStart } },
  })

  if (count >= plan.aiQuotaMonthly) {
    const next = new Date(monthStart)
    next.setMonth(next.getMonth() + 1)
    const resets = next.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    throw new GateError({
      status:  429,
      message: `Monthly AI quota reached (${plan.aiQuotaMonthly} messages). Resets on ${resets}.`,
    })
  }
}
