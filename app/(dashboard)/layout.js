import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getSubscriptionStatus } from '@/lib/subscription-gate'
import DashboardLayout from '@/components/layout/DashboardLayout'
import TrialBanner from '@/components/billing/TrialBanner'

export default async function Layout({ children }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  // Subscription state drives the trial/grace banner and suspension gate.
  const { status, daysRemaining } = await getSubscriptionStatus(session.user?.tenantId)
  if (status === 'suspended') redirect('/suspended')

  return (
    <DashboardLayout banner={<TrialBanner status={status} daysRemaining={daysRemaining} />}>
      {children}
    </DashboardLayout>
  )
}
