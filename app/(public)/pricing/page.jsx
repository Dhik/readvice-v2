import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const metadata = {
  title: 'Pricing — Readvice',
  description: 'Simple, transparent pricing for growing e-commerce brands.',
}

// Queries the DB (plan.findMany) at render — render at REQUEST time, not build.
// Without this, Next tries to statically prerender this public page and runs the
// Prisma query during `next build`, which fails on Vercel.
export const dynamic = 'force-dynamic'

// Server component — public, no auth required.
export default async function PricingPage() {
  const plans = await prisma.plan.findMany({
    where:   { isActive: true },
    orderBy: { priceMonthly: 'asc' },
  })

  return (
    <main className="pricing-wrap">
      {/* Nav */}
      <nav className="landing-nav" style={{ position: 'relative' }}>
        <Link href="/" className="nav-brand">
          <div className="nav-brand-icon"><i className="fas fa-book" /></div>
          <div className="nav-brand-name"><span>Read</span>vice</div>
        </Link>
        <div className="nav-actions">
          <Link href="/login" className="btn-ghost" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px' }}>
            <i className="fas fa-sign-in-alt" /> Login
          </Link>
        </div>
      </nav>

      <section className="pricing-section">
        <div className="pricing-header">
          <div className="section-tag"><i className="fas fa-tags" /> Pricing</div>
          <h1 className="pricing-title">Choose the plan that<br />grows with you.</h1>
          <p className="pricing-sub">
            Start with a 7-day free trial. No credit card required. Upgrade, downgrade, or cancel anytime.
          </p>
        </div>

        <div className="pricing-grid">
          {plans.map(plan => {
            const popular = plan.slug === 'pro'
            return (
              <div key={plan.id} className={`price-card${popular ? ' price-card-popular' : ''}`}>
                {popular && <div className="price-badge">Most Popular</div>}

                <div className="price-name">{plan.name}</div>
                <div className="price-amount">
                  <span className="price-currency">Rp</span>
                  <span className="price-value">{formatRupiah(plan.priceMonthly)}</span>
                  <span className="price-period">/month</span>
                </div>

                <ul className="price-features">
                  {planFeatures(plan).map((f, i) => (
                    <li key={i} className={f.on ? 'feat-on' : 'feat-off'}>
                      <i className={`fas ${f.on ? 'fa-check' : 'fa-minus'}`} />
                      {f.label}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/register?plan=${plan.slug}`}
                  className={`price-cta${popular ? ' price-cta-primary' : ''}`}
                >
                  Get Started <i className="fas fa-arrow-right" />
                </Link>
              </div>
            )
          })}
        </div>

        <p className="pricing-foot">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>

      <PricingStyles />
    </main>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(value) {
  // Prisma Decimal → number → grouped thousands (id-ID style)
  return new Intl.NumberFormat('id-ID').format(Number(value))
}

// Derive a feature list from the plan's flags.
function planFeatures(plan) {
  return [
    { on: true, label: plan.maxUsers ? `Up to ${plan.maxUsers} team members` : 'Unlimited team members' },
    { on: true, label: 'Sales, ads & campaign analytics' },
    { on: plan.hasAi, label: plan.hasAi
        ? (plan.aiQuotaMonthly ? `AI insights (${plan.aiQuotaMonthly}/mo)` : 'AI insights (unlimited)')
        : 'AI insights' },
    { on: plan.hasPdfExports, label: 'PDF report exports' },
    { on: plan.hasMultiTenant, label: plan.hasMultiTenant && plan.maxTenants
        ? `Multi-brand (up to ${plan.maxTenants})`
        : 'Multi-brand workspaces' },
  ]
}

function PricingStyles() {
  return (
    <style>{`
      .pricing-wrap { min-height: 100vh; background: #F5F0E8; }
      .pricing-section { max-width: 1140px; margin: 0 auto; padding: 60px 40px 90px; }
      .pricing-header { text-align: center; margin-bottom: 56px; }
      .pricing-header .section-tag { margin: 0 auto 16px; }
      .pricing-title { font-size: clamp(30px, 4vw, 46px); font-weight: 800; color: #2C3639; letter-spacing: -1.2px; line-height: 1.12; margin-bottom: 16px; }
      .pricing-sub { font-size: 16px; color: #3F4E4F; opacity: .7; max-width: 520px; margin: 0 auto; line-height: 1.7; }

      .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; align-items: stretch; }
      .price-card { position: relative; display: flex; flex-direction: column; background: #fff; border: 1px solid rgba(44,54,57,.1); border-radius: 18px; padding: 34px 30px; transition: box-shadow .25s, transform .25s; }
      .price-card:hover { box-shadow: 0 16px 48px rgba(44,54,57,.1); transform: translateY(-4px); }
      .price-card-popular { border: 2px solid #E07B39; box-shadow: 0 16px 48px rgba(224,123,57,.16); }

      .price-badge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); background: #E07B39; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; padding: 5px 14px; border-radius: 100px; white-space: nowrap; }

      .price-name { font-size: 15px; font-weight: 700; color: #E07B39; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 14px; }
      .price-amount { display: flex; align-items: baseline; gap: 4px; margin-bottom: 26px; flex-wrap: wrap; }
      .price-currency { font-size: 18px; font-weight: 700; color: #2C3639; }
      .price-value { font-size: 38px; font-weight: 900; color: #2C3639; letter-spacing: -1.5px; line-height: 1; }
      .price-period { font-size: 14px; color: #3F4E4F; opacity: .55; font-weight: 500; }

      .price-features { list-style: none; padding: 0; margin: 0 0 30px; display: flex; flex-direction: column; gap: 13px; flex: 1; }
      .price-features li { display: flex; align-items: center; gap: 11px; font-size: 14px; color: #2C3639; }
      .price-features li i { width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; flex-shrink: 0; }
      .price-features li.feat-on i { background: rgba(40,167,69,.14); color: #28a745; }
      .price-features li.feat-off { color: #3F4E4F; opacity: .4; }
      .price-features li.feat-off i { background: rgba(44,54,57,.08); color: #3F4E4F; }

      .price-cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 13px; font-size: 15px; font-weight: 600; border-radius: 11px; text-decoration: none; transition: background .2s, color .2s, box-shadow .2s, transform .15s; background: transparent; color: #2C3639; border: 1.5px solid rgba(44,54,57,.2); }
      .price-cta:hover { background: #2C3639; color: #fff; }
      .price-cta-primary { background: #E07B39; color: #fff; border-color: #E07B39; }
      .price-cta-primary:hover { background: #c96a2b; color: #fff; box-shadow: 0 8px 24px rgba(224,123,57,.32); transform: translateY(-1px); }

      .pricing-foot { text-align: center; margin-top: 44px; font-size: 14px; color: #3F4E4F; opacity: .7; }
      .pricing-foot a { color: #E07B39; font-weight: 600; text-decoration: none; }
      .pricing-foot a:hover { text-decoration: underline; }

      @media (max-width: 900px) {
        .pricing-grid { grid-template-columns: 1fr; max-width: 420px; margin: 0 auto; }
        .pricing-section { padding: 48px 24px 70px; }
      }
    `}</style>
  )
}
