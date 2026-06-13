import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/billing/plan-features — the single endpoint UI components call to
// gate features. No plan logic in the client; just flags from the server.
export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const tenantId = session.user?.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [sub, currentUserCount, aiUsageThisMonth] = await Promise.all([
    prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } }),
    prisma.user.count({ where: { currentTenantId: tenantId } }),
    prisma.aiMessage.count({ where: { conversation: { tenantId }, createdAt: { gte: monthStart } } }),
  ])

  // Feature flags are ANDed with active status so the UI can't surface a
  // feature a suspended tenant can't actually use.
  const active = !!sub && ['trial', 'active', 'grace'].includes(sub.status)
  const plan   = sub?.plan ?? null

  return NextResponse.json({
    planName:         plan?.name ?? null,
    planSlug:         plan?.slug ?? null,
    status:           sub?.status ?? null,
    hasAi:            active ? plan.hasAi : false,
    hasPdfExports:    active ? plan.hasPdfExports : false,
    hasMultiTenant:   active ? plan.hasMultiTenant : false,
    maxUsers:         plan?.maxUsers ?? null,
    aiQuotaMonthly:   plan?.aiQuotaMonthly ?? null,
    currentUserCount,
    aiUsageThisMonth,
  })
}
