import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PayButton from '@/components/billing/PayButton'

export const metadata = { title: 'Billing — Readvice' }

const STATUS_BADGE = {
  trial:     { cls: 'badge-info',    label: 'Trial' },
  active:    { cls: 'badge-success', label: 'Active' },
  grace:     { cls: 'badge-warning', label: 'Grace period' },
  suspended: { cls: 'badge-danger',  label: 'Suspended' },
}
const PAYMENT_BADGE = {
  pending:  'badge-warning',
  paid:     'badge-success',
  failed:   'badge-danger',
  expired:  'badge-danger',
  refunded: 'badge-info',
}

const rp   = (v) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(v))
const date = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const tenantId = session.user?.tenantId
  if (!tenantId) redirect('/dashboard')

  const [subscription, payments, plans] = await Promise.all([
    prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } }),
    prisma.paymentRecord.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, include: { plan: true } }),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } }),
  ])

  const status = subscription?.status ?? 'trial'
  const badge  = STATUS_BADGE[status] ?? STATUS_BADGE.trial
  const periodEnd = subscription?.currentPeriodEnd
  const daysRemaining = periodEnd
    ? Math.max(0, Math.ceil((new Date(periodEnd) - new Date()) / 86400000))
    : 0

  // Upgrade/renew options: active → other plans; trial/grace/suspended → all plans.
  const upgradePlans = status === 'active'
    ? plans.filter(p => p.slug !== subscription?.plan?.slug)
    : plans

  return (
    <div className="p-4 max-w-[1100px] mx-auto flex flex-col gap-4">

      {/* ── a. Current plan ── */}
      <section className="sv-card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] font-semibold text-dark1/50 uppercase tracking-wide mb-1">Current plan</div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-bold text-dark1">{subscription?.plan?.name ?? 'No plan'}</span>
              <span className={`badge ${badge.cls}`}>{badge.label}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-dark1 leading-none">{daysRemaining}</div>
            <div className="text-[11px] text-dark1/50 uppercase tracking-wide mt-1">
              {status === 'grace' ? 'days until suspended' : 'days remaining'}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-cream/60 text-xs text-dark1/60">
          {status === 'trial' && <>Your free trial ends on <strong className="text-dark1">{date(periodEnd)}</strong>. Subscribe to keep access.</>}
          {status === 'active' && <>Renews / valid until <strong className="text-dark1">{date(periodEnd)}</strong>.</>}
          {status === 'grace' && <>Payment overdue — access ends on <strong className="text-dark1">{date(subscription?.gracePeriodEnd ?? periodEnd)}</strong>. Renew now to avoid suspension.</>}
          {status === 'suspended' && <>Your subscription is suspended. Renew below to regain access.</>}
        </div>
      </section>

      {/* ── c. Upgrade / renew ── */}
      <section>
        <h2 className="text-sm font-bold text-dark1 mb-2">
          {status === 'active' ? 'Upgrade your plan' : 'Choose a plan'}
        </h2>
        {upgradePlans.length === 0 ? (
          <div className="sv-card text-xs text-dark1/60">You’re on the highest plan available. 🎉</div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {upgradePlans.map(plan => (
              <div key={plan.id} className="sv-card flex flex-col gap-3">
                <div>
                  <div className="text-orange text-xs font-bold uppercase tracking-wide">{plan.name}</div>
                  <div className="mt-1 text-2xl font-bold text-dark1">{rp(plan.priceMonthly)}<span className="text-xs font-medium text-dark1/50">/mo</span></div>
                </div>
                <ul className="text-xs text-dark1/70 flex flex-col gap-1.5 flex-1">
                  <li>{plan.maxUsers ? `Up to ${plan.maxUsers} team members` : 'Unlimited team members'}</li>
                  {plan.hasAi && <li>AI insights {plan.aiQuotaMonthly ? `(${plan.aiQuotaMonthly}/mo)` : '(unlimited)'}</li>}
                  {plan.hasPdfExports && <li>PDF report exports</li>}
                  {plan.hasMultiTenant && <li>Multi-brand{plan.maxTenants ? ` (up to ${plan.maxTenants})` : ''}</li>}
                </ul>
                <PayButton planSlug={plan.slug} label={status === 'active' ? 'Upgrade to' : 'Subscribe to'} planName={plan.name} className="btn btn-primary w-full justify-center" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── b. Payment history ── */}
      <section className="sv-card">
        <h2 className="text-sm font-bold text-dark1 mb-3">Payment history</h2>
        {payments.length === 0 ? (
          <div className="text-xs text-dark1/50 py-4 text-center">No payments yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="sv-table-clean">
              <thead>
                <tr>
                  <th>Date</th><th>Plan</th><th>Amount</th><th>Period</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{date(p.createdAt)}</td>
                    <td>{p.plan?.name ?? '—'}</td>
                    <td><span className="num">{rp(p.amount)}</span></td>
                    <td>{p.periodMonths} mo</td>
                    <td><span className={`badge ${PAYMENT_BADGE[p.status] ?? 'badge-info'}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
