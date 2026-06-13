'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// MOCK MODE ONLY — stands in for the hosted Midtrans Snap page. Lets you
// simulate a successful or cancelled payment locally.
function MockPaymentInner() {
  const params  = useSearchParams()
  const router  = useRouter()
  const orderId = params.get('order') || ''
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function payNow() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/mock-confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Payment failed. Please try again.')
        setLoading(false)
        return
      }
      router.push(data.redirect || '/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="mp-wrap">
      <div className="mp-card">
        <div className="mp-badge">SANDBOX · MOCK</div>
        <div className="mp-logo"><i className="fas fa-credit-card" /></div>
        <h1 className="mp-title">Mock Payment Page</h1>
        <p className="mp-sub">This is a simulated checkout. No real charge is made.</p>

        <div className="mp-order">
          <span className="mp-order-label">Order ID</span>
          <span className="mp-order-id">{orderId || '—'}</span>
        </div>

        {error && <div className="mp-error"><i className="fas fa-exclamation-circle" /> {error}</div>}

        <button className="mp-btn mp-btn-pay" onClick={payNow} disabled={loading || !orderId}>
          {loading ? (<><span className="mp-spinner" /> Processing…</>) : (<><i className="fas fa-check" /> Pay Now</>)}
        </button>
        <button className="mp-btn mp-btn-cancel" onClick={() => router.push('/billing')} disabled={loading}>
          Cancel
        </button>
      </div>

      <style>{`
        .mp-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 24px; background: #F5F0E8; font-family: 'Inter', sans-serif; }
        .mp-card { width: 100%; max-width: 420px; background: #fff; border: 1px solid rgba(44,54,57,.1); border-radius: 18px; padding: 38px 34px; text-align: center; box-shadow: 0 16px 48px rgba(44,54,57,.08); position: relative; }
        .mp-badge { position: absolute; top: 16px; right: 16px; font-size: 10px; font-weight: 700; letter-spacing: .6px; color: #E07B39; background: rgba(224,123,57,.12); padding: 4px 9px; border-radius: 6px; }
        .mp-logo { width: 56px; height: 56px; margin: 6px auto 18px; border-radius: 14px; background: rgba(224,123,57,.12); color: #E07B39; display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .mp-title { font-size: 22px; font-weight: 800; color: #2C3639; letter-spacing: -.5px; margin-bottom: 8px; }
        .mp-sub { font-size: 13px; color: #3F4E4F; opacity: .65; margin-bottom: 24px; line-height: 1.6; }
        .mp-order { display: flex; align-items: center; justify-content: space-between; background: #F5F0E8; border: 1px solid rgba(44,54,57,.08); border-radius: 10px; padding: 12px 14px; margin-bottom: 22px; }
        .mp-order-label { font-size: 12px; font-weight: 600; color: #3F4E4F; opacity: .6; text-transform: uppercase; letter-spacing: .4px; }
        .mp-order-id { font-size: 13px; font-weight: 600; color: #2C3639; font-family: ui-monospace, monospace; }
        .mp-error { display: flex; align-items: center; gap: 8px; justify-content: center; background: rgba(220,53,69,.08); border: 1px solid rgba(220,53,69,.2); border-radius: 10px; padding: 10px 12px; margin-bottom: 16px; font-size: 13px; color: #dc3545; font-weight: 500; }
        .mp-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 13px; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600; border-radius: 10px; cursor: pointer; border: none; transition: background .2s, transform .15s, box-shadow .2s; }
        .mp-btn-pay { background: #E07B39; color: #fff; margin-bottom: 10px; }
        .mp-btn-pay:hover:not(:disabled) { background: #c96a2b; box-shadow: 0 6px 20px rgba(224,123,57,.35); transform: translateY(-1px); }
        .mp-btn-cancel { background: transparent; color: #3F4E4F; border: 1.5px solid rgba(44,54,57,.18); }
        .mp-btn-cancel:hover:not(:disabled) { background: #2C3639; color: #fff; }
        .mp-btn:disabled { opacity: .7; pointer-events: none; }
        .mp-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: mpspin .7s linear infinite; }
        @keyframes mpspin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default function MockPaymentPage() {
  return (
    <Suspense fallback={null}>
      <MockPaymentInner />
    </Suspense>
  )
}
