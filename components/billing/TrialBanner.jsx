import Link from 'next/link'

// Presentational only. Takes the decoupled { status, daysRemaining } from
// getSubscriptionStatus — no subscription internals here. Returns null for
// active / no-subscription.
export default function TrialBanner({ status, daysRemaining = 0 }) {
  const dayWord = daysRemaining === 1 ? 'day' : 'days'

  if (status === 'trial') {
    return (
      <div className="sub-banner sub-banner-trial">
        <span className="sub-banner-msg">
          🎉 Trial period — <strong>{daysRemaining} {dayWord} remaining</strong>. Upgrade to keep access.
        </span>
        <Link href="/pricing" className="sub-banner-btn">Upgrade Now</Link>
      </div>
    )
  }

  if (status === 'grace') {
    return (
      <div className="sub-banner sub-banner-grace">
        <span className="sub-banner-msg">
          ⚠️ Your subscription has expired. <strong>{daysRemaining} {dayWord} to renew</strong> before suspension.
        </span>
        <Link href="/pricing" className="sub-banner-btn sub-banner-btn-light">Renew Now</Link>
      </div>
    )
  }

  // Defensive: suspended users are hard-redirected to /suspended by the dashboard
  // layout, so this branch normally won't render. Kept in case the redirect is
  // ever relaxed to a soft block.
  if (status === 'suspended') {
    return (
      <div className="sub-banner sub-banner-grace">
        <span className="sub-banner-msg">🔒 Your account is suspended.</span>
        <Link href="/billing" className="sub-banner-btn sub-banner-btn-light">Renew to restore</Link>
      </div>
    )
  }

  // active (or anything else) → no banner
  return null
}
