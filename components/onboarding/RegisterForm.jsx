'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RegisterForm({ plans, initialPlan }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirm: '', brandName: '',
  })
  const [plan,    setPlan]    = useState(initialPlan)
  const [errors,  setErrors]  = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
    setApiError('')
  }

  function validate() {
    const e = {}
    if (!form.name.trim())                        e.name = 'Full name is required'
    if (!form.email.trim())                       e.email = 'Email is required'
    else if (!EMAIL_RE.test(form.email.trim()))   e.email = 'Enter a valid email address'
    if (!form.password)                           e.password = 'Password is required'
    else if (form.password.length < 8)            e.password = 'Password must be at least 8 characters'
    if (!form.confirm)                            e.confirm = 'Please confirm your password'
    else if (form.confirm !== form.password)      e.confirm = 'Passwords do not match'
    if (!form.brandName.trim())                   e.brandName = 'Brand name is required'
    if (!plan)                                    e.plan = 'Please choose a plan'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    setApiError('')
    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      form.name.trim(),
          email:     form.email.trim(),
          password:  form.password,
          brandName: form.brandName.trim(),
          plan,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setApiError(data.error || 'Registration failed. Please try again.')
        setLoading(false)
        return
      }

      // Auto sign-in with the just-created credentials, then go to the dashboard.
      const login = await signIn('credentials', {
        email: form.email.trim(), password: form.password, redirect: false,
      })
      if (login?.error) {
        // Account exists but auto-login failed — send them to login.
        router.push('/login')
        return
      }
      router.push('/dashboard')
    } catch {
      setApiError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="rw">
      <style>{STYLES}</style>

      {/* ── LEFT BRAND PANEL ── */}
      <div className="rl">
        <Link href="/" className="r-brand">
          <div className="r-brand-icon"><i className="fas fa-book" /></div>
          <div className="r-brand-name"><span>Read</span>vice</div>
        </Link>

        <div className="r-hero">
          <div className="r-hero-tag">7-day free trial</div>
          <h1>Start growing<br /><span className="accent">today.</span></h1>
          <p>Create your brand workspace in under a minute. No credit card required — explore every feature free for 7 days.</p>
          <div className="r-features">
            <div className="r-feature"><div className="r-feature-icon"><i className="fas fa-rocket" /></div>Instant access to your dashboard</div>
            <div className="r-feature"><div className="r-feature-icon"><i className="fas fa-credit-card" /></div>No card required to start</div>
            <div className="r-feature"><div className="r-feature-icon"><i className="fas fa-xmark" /></div>Cancel anytime</div>
          </div>
        </div>

        <div className="r-foot-note">Already have an account? <Link href="/login">Sign in</Link></div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="rr">
        <div className="r-form-wrap">
          <div className="r-form-header">
            <div className="r-eyebrow">Get started</div>
            <h2>Create your account</h2>
            <p>Set up your workspace and start your free trial.</p>
          </div>

          {apiError && (
            <div className="r-alert">
              <i className="fas fa-exclamation-circle" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <Field label="Full name" error={errors.name}>
              <input type="text" placeholder="Your name" autoComplete="name"
                value={form.name} onChange={e => update('name', e.target.value)}
                className={errors.name ? 'err' : ''} />
            </Field>

            <Field label="Email address" error={errors.email}>
              <input type="email" placeholder="you@company.com" autoComplete="email"
                value={form.email} onChange={e => update('email', e.target.value)}
                className={errors.email ? 'err' : ''} />
            </Field>

            <Field label="Brand name" error={errors.brandName}>
              <input type="text" placeholder="e.g. Cleora Beauty" autoComplete="organization"
                value={form.brandName} onChange={e => update('brandName', e.target.value)}
                className={errors.brandName ? 'err' : ''} />
            </Field>

            <div className="r-row">
              <Field label="Password" error={errors.password}>
                <div className="r-pw-wrap">
                  <input type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters" autoComplete="new-password"
                    value={form.password} onChange={e => update('password', e.target.value)}
                    className={errors.password ? 'err' : ''} />
                  <button type="button" className="r-toggle-pw" aria-label="Toggle password" onClick={() => setShowPw(v => !v)}>
                    <i className={showPw ? 'fas fa-eye-slash' : 'fas fa-eye'} />
                  </button>
                </div>
              </Field>

              <Field label="Confirm password" error={errors.confirm}>
                <input type={showPw ? 'text' : 'password'} placeholder="Re-enter password" autoComplete="new-password"
                  value={form.confirm} onChange={e => update('confirm', e.target.value)}
                  className={errors.confirm ? 'err' : ''} />
              </Field>
            </div>

            {/* Plan selector */}
            <div className="r-field">
              <label>Plan</label>
              <div className="r-plans">
                {plans.map(p => (
                  <button type="button" key={p.slug}
                    className={`r-plan${plan === p.slug ? ' active' : ''}`}
                    onClick={() => { setPlan(p.slug); setErrors(e => ({ ...e, plan: undefined })) }}>
                    <div className="r-plan-name">{p.name}</div>
                    <div className="r-plan-price">Rp {new Intl.NumberFormat('id-ID').format(p.priceMonthly)}<span>/mo</span></div>
                    {plan === p.slug && <i className="fas fa-circle-check r-plan-check" />}
                  </button>
                ))}
              </div>
              {errors.plan && <span className="r-field-err">{errors.plan}</span>}
            </div>

            <button type="submit" className="r-btn" disabled={loading}>
              {loading ? (<><div className="r-spinner" /> Creating account...</>)
                       : (<><i className="fas fa-arrow-right" /> Start free trial</>)}
            </button>
          </form>

          <p className="r-terms">By creating an account you agree to our Terms &amp; Privacy Policy.</p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div className="r-field">
      <label>{label}</label>
      {children}
      {error && <span className="r-field-err">{error}</span>}
    </div>
  )
}

const STYLES = `
  .rw { display: flex; width: 100%; min-height: 100vh; font-family: 'Inter', sans-serif; background: #F5F0E8; }

  /* Left panel */
  .rl { flex: 0 0 40%; background: #2C3639; display: flex; flex-direction: column; justify-content: space-between; padding: 44px 48px; position: relative; overflow: hidden; }
  .rl::before { content: ''; position: absolute; width: 420px; height: 420px; border-radius: 50%; border: 60px solid rgba(224,123,57,.12); bottom: -120px; right: -120px; pointer-events: none; }
  .rl::after { content: ''; position: absolute; width: 240px; height: 240px; border-radius: 50%; border: 40px solid rgba(224,123,57,.08); top: -60px; left: -60px; pointer-events: none; }
  .r-brand { display: flex; align-items: center; gap: 13px; position: relative; z-index: 1; text-decoration: none; }
  .r-brand-icon { width: 44px; height: 44px; background: #E07B39; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 19px; color: #fff; flex-shrink: 0; }
  .r-brand-name { font-size: 24px; font-weight: 700; color: #fff; letter-spacing: -.5px; }
  .r-brand-name span { color: #E07B39; }
  .r-hero { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 48px 0; }
  .r-hero-tag { display: inline-flex; align-items: center; gap: 8px; background: rgba(224,123,57,.15); border: 1px solid rgba(224,123,57,.3); border-radius: 100px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: #E07B39; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 22px; width: fit-content; }
  .r-hero h1 { font-size: 36px; font-weight: 800; color: #fff; line-height: 1.15; letter-spacing: -1px; margin-bottom: 16px; }
  .r-hero h1 .accent { color: #E07B39; }
  .r-hero p { font-size: 15px; color: rgba(220,215,201,.65); line-height: 1.7; max-width: 340px; }
  .r-features { display: flex; flex-direction: column; gap: 12px; margin-top: 32px; }
  .r-feature { display: flex; align-items: center; gap: 12px; font-size: 13px; color: rgba(220,215,201,.72); }
  .r-feature-icon { width: 30px; height: 30px; border-radius: 8px; background: rgba(224,123,57,.12); color: #E07B39; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
  .r-foot-note { position: relative; z-index: 1; font-size: 13px; color: rgba(220,215,201,.5); }
  .r-foot-note a { color: #E07B39; font-weight: 600; text-decoration: none; }

  /* Right panel */
  .rr { flex: 1; display: flex; align-items: center; justify-content: center; padding: 44px 56px; position: relative; }
  .rr::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(44,54,57,.1) 1px, transparent 1px); background-size: 28px 28px; pointer-events: none; }
  .r-form-wrap { width: 100%; max-width: 440px; position: relative; z-index: 1; }
  .r-form-header { margin-bottom: 26px; }
  .r-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #E07B39; margin-bottom: 9px; }
  .r-form-header h2 { font-size: 28px; font-weight: 800; color: #2C3639; letter-spacing: -.8px; margin-bottom: 7px; line-height: 1.2; }
  .r-form-header p { font-size: 14px; color: #3F4E4F; opacity: .65; }

  .r-alert { display: flex; align-items: flex-start; gap: 10px; background: rgba(220,53,69,.08); border: 1px solid rgba(220,53,69,.2); border-radius: 10px; padding: 12px 14px; margin-bottom: 20px; font-size: 13px; color: #dc3545; font-weight: 500; }
  .r-alert i { margin-top: 1px; flex-shrink: 0; }

  .r-field { margin-bottom: 16px; }
  .r-field > label { display: block; font-size: 13px; font-weight: 600; color: #2C3639; margin-bottom: 7px; }
  .r-field input { width: 100%; padding: 12px 14px; font-family: 'Inter', sans-serif; font-size: 14px; color: #2C3639; background: #fff; border: 1.5px solid rgba(44,54,57,.15); border-radius: 10px; outline: none; transition: border-color .2s, box-shadow .2s; -webkit-appearance: none; }
  .r-field input::placeholder { color: #3F4E4F; opacity: .35; }
  .r-field input:focus { border-color: #E07B39; box-shadow: 0 0 0 3px rgba(224,123,57,.12); }
  .r-field input.err { border-color: #dc3545; box-shadow: 0 0 0 3px rgba(220,53,69,.1); }
  .r-field-err { font-size: 12px; color: #dc3545; margin-top: 6px; font-weight: 500; display: block; }

  .r-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .r-pw-wrap { position: relative; }
  .r-toggle-pw { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #3F4E4F; opacity: .4; cursor: pointer; font-size: 14px; padding: 4px; }
  .r-toggle-pw:hover { opacity: .7; }

  .r-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .r-plan { position: relative; text-align: left; background: #fff; border: 1.5px solid rgba(44,54,57,.15); border-radius: 11px; padding: 12px 13px; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
  .r-plan:hover { border-color: rgba(224,123,57,.5); }
  .r-plan.active { border-color: #E07B39; box-shadow: 0 0 0 3px rgba(224,123,57,.12); }
  .r-plan-name { font-size: 13px; font-weight: 700; color: #2C3639; margin-bottom: 3px; }
  .r-plan-price { font-size: 12px; font-weight: 600; color: #3F4E4F; }
  .r-plan-price span { opacity: .55; font-weight: 500; }
  .r-plan-check { position: absolute; top: 9px; right: 9px; color: #E07B39; font-size: 13px; }

  .r-btn { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; margin-top: 8px; padding: 14px; background: #E07B39; color: #fff; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600; border: none; border-radius: 10px; cursor: pointer; transition: background .2s, transform .15s, box-shadow .2s; }
  .r-btn:hover { background: #c96a2b; box-shadow: 0 6px 20px rgba(224,123,57,.35); transform: translateY(-1px); }
  .r-btn:active { transform: translateY(0); box-shadow: none; }
  .r-btn:disabled { pointer-events: none; opacity: .8; }
  .r-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: rspin .7s linear infinite; }
  @keyframes rspin { to { transform: rotate(360deg); } }

  .r-terms { text-align: center; margin-top: 18px; font-size: 12px; color: #3F4E4F; opacity: .5; }

  @media (max-width: 900px) {
    .rl { display: none; }
    .rr { padding: 40px 28px; }
  }
  @media (max-width: 520px) {
    .r-row { grid-template-columns: 1fr; }
    .r-plans { grid-template-columns: 1fr; }
  }
`
