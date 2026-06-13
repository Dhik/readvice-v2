import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getActivePlan } from '@/lib/subscription-gate'
import UpgradePrompt from '@/components/billing/UpgradePrompt'
import AiInsightsClient from './AiInsightsClient'

// Server wrapper — gates the AI chat behind the plan's hasAi flag before the
// client UI ever loads.
export default async function AiInsightsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const plan = await getActivePlan(session.user?.tenantId)
  if (!plan?.hasAi) {
    return (
      <div className="sv-page">
        <UpgradePrompt feature="AI Insights" requiredPlan="Pro" />
      </div>
    )
  }

  return <AiInsightsClient />
}
