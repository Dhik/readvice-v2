import Link from 'next/link'

export const metadata = {
  title: 'Account suspended — Readvice',
}

// Public page. Full suspension/enforcement logic arrives in S6 — this page
// just needs to exist as the redirect target for suspended subscriptions.
export default function SuspendedPage() {
  return (
    <main className="susp-wrap">
      <div className="susp-card">
        <div className="susp-icon"><i className="fas fa-circle-pause" /></div>
        <h1 className="susp-title">Your account is suspended</h1>
        <p className="susp-text">
          Your subscription has expired and access has been paused. Renew your
          subscription to regain access to your dashboard and data.
        </p>
        <div className="susp-actions">
          <Link href="/pricing" className="susp-btn susp-btn-primary">
            <i className="fas fa-rotate-right" /> Renew subscription
          </Link>
          <a href="mailto:support@readvice.io" className="susp-btn">
            <i className="fas fa-envelope" /> Contact us
          </a>
        </div>
        <p className="susp-foot"><Link href="/login">Back to login</Link></p>
      </div>

      <style>{`
        .susp-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 24px; background: #F5F0E8; font-family: 'Inter', sans-serif; position: relative; overflow: hidden; }
        .susp-wrap::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(44,54,57,.08) 1px, transparent 1px); background-size: 28px 28px; pointer-events: none; }
        .susp-card { position: relative; z-index: 1; width: 100%; max-width: 480px; background: #fff; border: 1px solid rgba(44,54,57,.1); border-radius: 20px; padding: 48px 44px; text-align: center; box-shadow: 0 16px 48px rgba(44,54,57,.08); }
        .susp-icon { width: 64px; height: 64px; margin: 0 auto 22px; border-radius: 16px; background: rgba(220,53,69,.1); color: #dc3545; display: flex; align-items: center; justify-content: center; font-size: 26px; }
        .susp-title { font-size: 24px; font-weight: 800; color: #2C3639; letter-spacing: -.6px; margin-bottom: 12px; }
        .susp-text { font-size: 14px; color: #3F4E4F; opacity: .7; line-height: 1.7; margin-bottom: 28px; }
        .susp-actions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }
        .susp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px; font-size: 14px; font-weight: 600; border-radius: 11px; text-decoration: none; transition: background .2s, color .2s; background: transparent; color: #2C3639; border: 1.5px solid rgba(44,54,57,.2); }
        .susp-btn:hover { background: #2C3639; color: #fff; }
        .susp-btn-primary { background: #E07B39; color: #fff; border-color: #E07B39; }
        .susp-btn-primary:hover { background: #c96a2b; color: #fff; }
        .susp-foot { font-size: 13px; }
        .susp-foot a { color: #E07B39; font-weight: 600; text-decoration: none; }
      `}</style>
    </main>
  )
}
