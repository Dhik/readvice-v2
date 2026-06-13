import Link from 'next/link'

// Friendly gate shown wherever a feature is locked behind a higher plan.
// Server-safe (no hooks) — works in both server and client trees.
export default function UpgradePrompt({ feature, requiredPlan }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="sv-panel max-w-md w-full text-center" style={{ padding: '40px 32px' }}>
        <div
          className="mx-auto mb-5 flex items-center justify-center rounded-2xl"
          style={{ width: 64, height: 64, background: 'rgba(224,123,57,.12)', color: '#E07B39', fontSize: 26 }}
        >
          <i className="fas fa-lock" />
        </div>
        <h2 className="text-lg font-bold text-dark1 mb-2">{feature} is a premium feature</h2>
        <p className="text-sm text-dark2/70 leading-relaxed mb-6">
          {feature} requires the <strong className="text-dark1">{requiredPlan}</strong> plan or higher.
          Upgrade your subscription to unlock it.
        </p>
        <Link href="/billing" className="btn btn-primary justify-center">
          <i className="fas fa-arrow-up" /> Upgrade Now
        </Link>
      </div>
    </div>
  )
}
