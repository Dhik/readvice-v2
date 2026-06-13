import { prisma } from '@/lib/prisma'
import RegisterForm from '@/components/onboarding/RegisterForm'

export const metadata = {
  title: 'Create your account — Readvice',
  description: 'Start your 7-day free trial. No credit card required.',
}

// Queries the DB (plan.findMany) at render — render at REQUEST time, not build.
// Public page, so Next would otherwise try to statically prerender it and run the
// Prisma query during `next build` (fails on Vercel).
export const dynamic = 'force-dynamic'

// Server component — fetches active plans, reads the pre-selected plan slug,
// then hands off to the client form.
export default async function RegisterPage({ searchParams }) {
  const plans = await prisma.plan.findMany({
    where:   { isActive: true },
    orderBy: { priceMonthly: 'asc' },
  })

  // Decimal isn't serializable across the server→client boundary — map to plain.
  const planData = plans.map(p => ({
    id:             p.id,
    name:           p.name,
    slug:           p.slug,
    priceMonthly:   Number(p.priceMonthly),
    maxUsers:       p.maxUsers,
    hasAi:          p.hasAi,
    hasPdfExports:  p.hasPdfExports,
    hasMultiTenant: p.hasMultiTenant,
  }))

  const requested = searchParams?.plan
  const initialPlan = planData.some(p => p.slug === requested)
    ? requested
    : (planData.some(p => p.slug === 'pro') ? 'pro' : planData[0]?.slug ?? '')

  return <RegisterForm plans={planData} initialPlan={initialPlan} />
}
