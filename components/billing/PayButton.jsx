'use client'
import { useState } from 'react'

// Triggers the payment flow. The server (create-payment) decides mock vs live
// and tells us via `mode` in the response — we never read the env client-side.
export default function PayButton({ planSlug, planName, label = 'Subscribe', className = 'btn btn-primary' }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function loadSnapScript(snapJsUrl, clientKey) {
    if (window.snap) return
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = snapJsUrl
      s.setAttribute('data-client-key', clientKey)
      s.onload = resolve
      s.onerror = () => reject(new Error('Failed to load Snap.js'))
      document.body.appendChild(s)
    })
  }

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/create-payment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planSlug }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not start payment.')
        setLoading(false)
        return
      }

      if (data.mode === 'live') {
        // LIVE — open the Snap popup.
        await loadSnapScript(data.snapJsUrl, data.clientKey)
        window.snap.pay(data.snapToken, {
          onSuccess: () => { window.location.href = '/dashboard' },
          onPending: () => { window.location.href = '/billing' },
          onError:   () => { setError('Payment failed.'); setLoading(false) },
          onClose:   () => { setLoading(false) },
        })
        return
      }

      // MOCK — go to the local mock payment page.
      window.location.href = data.snapUrl
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="pay-btn-wrap">
      <button className={className} onClick={handleClick} disabled={loading}>
        {loading ? 'Processing…' : (planName ? `${label} ${planName}` : label)}
      </button>
      {error && <div className="pay-btn-error">{error}</div>}
    </div>
  )
}
