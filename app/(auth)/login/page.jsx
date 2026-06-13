'use client'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)
  const [emailErr, setEmailErr] = useState(false)
  const [pwErr,    setPwErr]    = useState(false)

  function validateEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setEmailErr(false)
    setPwErr(false)

    let valid = true
    if (!email || !validateEmail(email)) { setEmailErr(true); valid = false }
    if (!password)                        { setPwErr(true);    valid = false }
    if (!valid) return

    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; font-family: 'Inter', sans-serif; background: #F5F0E8; overflow: hidden; }

        .lw { display: flex; width: 100%; height: 100vh; }

        /* ── LEFT PANEL ── */
        .ll {
          flex: 0 0 42%; background: #2C3639;
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 48px 52px; position: relative; overflow: hidden;
        }
        .ll::before {
          content: ''; position: absolute;
          width: 420px; height: 420px; border-radius: 50%;
          border: 60px solid rgba(224,123,57,.12);
          bottom: -120px; right: -120px; pointer-events: none;
        }
        .ll::after {
          content: ''; position: absolute;
          width: 240px; height: 240px; border-radius: 50%;
          border: 40px solid rgba(224,123,57,.08);
          top: -60px; left: -60px; pointer-events: none;
        }

        .l-brand { display: flex; align-items: center; gap: 14px; position: relative; z-index: 1; }
        .l-brand-icon {
          width: 46px; height: 46px; background: #E07B39; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; color: #fff; flex-shrink: 0;
        }
        .l-brand-name { font-size: 26px; font-weight: 700; color: #fff; letter-spacing: -.5px; }
        .l-brand-name span { color: #E07B39; }

        .l-hero {
          position: relative; z-index: 1; flex: 1;
          display: flex; flex-direction: column; justify-content: center;
          padding: 60px 0 40px;
        }
        .l-hero-tag {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(224,123,57,.15); border: 1px solid rgba(224,123,57,.3);
          border-radius: 100px; padding: 6px 14px;
          font-size: 12px; font-weight: 600; color: #E07B39;
          letter-spacing: .5px; text-transform: uppercase;
          margin-bottom: 24px; width: fit-content;
        }
        .l-hero-tag::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: #E07B39; animation: lpulse 2s infinite;
        }
        @keyframes lpulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.5; transform:scale(.7); }
        }
        .l-hero h1 {
          font-size: 38px; font-weight: 800; color: #fff;
          line-height: 1.18; letter-spacing: -1px; margin-bottom: 18px;
        }
        .l-hero h1 .accent { color: #E07B39; }
        .l-hero p { font-size: 15px; color: rgba(220,215,201,.65); line-height: 1.7; max-width: 340px; }

        .l-features { display: flex; flex-direction: column; gap: 12px; margin-top: 36px; }
        .l-feature { display: flex; align-items: center; gap: 12px; font-size: 13px; color: rgba(220,215,201,.7); }
        .l-feature-icon {
          width: 30px; height: 30px; border-radius: 8px;
          background: rgba(224,123,57,.12); color: #E07B39;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; flex-shrink: 0;
        }

        .l-stats { display: flex; gap: 28px; position: relative; z-index: 1; }
        .l-stat { display: flex; flex-direction: column; gap: 3px; }
        .l-stat-num { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: -.4px; }
        .l-stat-label { font-size: 11px; font-weight: 500; color: rgba(220,215,201,.45); text-transform: uppercase; letter-spacing: .6px; }
        .l-stat-div { width: 1px; background: rgba(255,255,255,.1); align-self: stretch; }

        /* ── RIGHT PANEL ── */
        .lr {
          flex: 1; background: #F5F0E8;
          display: flex; align-items: center; justify-content: center;
          padding: 48px 64px; position: relative;
        }
        .lr::before {
          content: ''; position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(44,54,57,.12) 1px, transparent 1px);
          background-size: 28px 28px; pointer-events: none;
        }

        .l-form-wrap { width: 100%; max-width: 400px; position: relative; z-index: 1; }

        .l-form-header { margin-bottom: 36px; }
        .l-eyebrow {
          font-size: 12px; font-weight: 600; letter-spacing: 1px;
          text-transform: uppercase; color: #E07B39; margin-bottom: 10px;
        }
        .l-form-header h2 {
          font-size: 30px; font-weight: 800; color: #2C3639;
          letter-spacing: -.8px; margin-bottom: 8px; line-height: 1.2;
        }
        .l-form-header p { font-size: 14px; color: #3F4E4F; opacity: .65; }

        .l-alert {
          display: flex; align-items: flex-start; gap: 10px;
          background: rgba(220,53,69,.08); border: 1px solid rgba(220,53,69,.2);
          border-radius: 10px; padding: 12px 14px; margin-bottom: 24px;
          font-size: 13px; color: #dc3545; font-weight: 500;
        }
        .l-alert i { margin-top: 1px; flex-shrink: 0; }

        .l-field { margin-bottom: 20px; }
        .l-field label {
          display: block; font-size: 13px; font-weight: 600;
          color: #2C3639; margin-bottom: 8px; letter-spacing: .1px;
        }
        .l-field-wrap { position: relative; }
        .l-field-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: #3F4E4F; opacity: .4; font-size: 14px; pointer-events: none;
        }
        .l-field-wrap input {
          width: 100%; padding: 13px 14px 13px 40px;
          font-family: 'Inter', sans-serif; font-size: 14px; color: #2C3639;
          background: #fff; border: 1.5px solid rgba(44,54,57,.15);
          border-radius: 10px; outline: none;
          transition: border-color .2s, box-shadow .2s; -webkit-appearance: none;
        }
        .l-field-wrap input::placeholder { color: #3F4E4F; opacity: .35; }
        .l-field-wrap input:focus {
          border-color: #E07B39; box-shadow: 0 0 0 3px rgba(224,123,57,.12);
        }
        .l-field-wrap input.err {
          border-color: #dc3545; box-shadow: 0 0 0 3px rgba(220,53,69,.1);
        }
        .l-toggle-pw {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: #3F4E4F; opacity: .4;
          cursor: pointer; font-size: 14px; padding: 4px; transition: opacity .2s;
        }
        .l-toggle-pw:hover { opacity: .7; }
        .l-field-err { font-size: 12px; color: #dc3545; margin-top: 6px; font-weight: 500; display: block; }

        .l-bottom {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 8px; margin-bottom: 28px;
        }
        .l-check { display: flex; align-items: center; gap: 9px; cursor: pointer; }
        .l-check input[type="checkbox"] {
          appearance: none; -webkit-appearance: none;
          width: 17px; height: 17px; border: 1.5px solid rgba(44,54,57,.25);
          border-radius: 5px; background: #fff; cursor: pointer;
          position: relative; flex-shrink: 0;
          transition: background .15s, border-color .15s;
        }
        .l-check input[type="checkbox"]:checked { background: #E07B39; border-color: #E07B39; }
        .l-check input[type="checkbox"]:checked::after {
          content: '\\f00c'; font-family: 'Font Awesome 6 Free'; font-weight: 900;
          font-size: 9px; color: #fff; position: absolute;
          top: 50%; left: 50%; transform: translate(-50%,-50%);
        }
        .l-check span { font-size: 13px; font-weight: 500; color: #3F4E4F; user-select: none; }
        .l-forgot {
          font-size: 13px; font-weight: 500; color: #E07B39;
          text-decoration: none; transition: opacity .2s;
        }
        .l-forgot:hover { opacity: .75; }

        .l-btn {
          display: flex; align-items: center; justify-content: center; gap: 9px;
          width: 100%; padding: 14px; background: #E07B39; color: #fff;
          font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600;
          border: none; border-radius: 10px; cursor: pointer;
          transition: background .2s, transform .15s, box-shadow .2s; letter-spacing: .2px;
        }
        .l-btn:hover { background: #c96a2b; box-shadow: 0 6px 20px rgba(224,123,57,.35); transform: translateY(-1px); }
        .l-btn:active { transform: translateY(0); box-shadow: none; }
        .l-btn:disabled { pointer-events: none; opacity: .8; }
        .l-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
          border-radius: 50%; animation: lspin .7s linear infinite;
        }
        @keyframes lspin { to { transform: rotate(360deg); } }

        .l-footer { text-align: center; margin-top: 32px; font-size: 12px; color: #3F4E4F; opacity: .45; }

        @media (max-width: 900px) {
          .ll { display: none; }
          .lr { padding: 40px 32px; }
        }
        @media (max-width: 480px) {
          .lr { padding: 32px 20px; }
          .l-form-header h2 { font-size: 26px; }
        }
      `}</style>

      <div className="lw">

        {/* ── LEFT PANEL ── */}
        <div className="ll">
          <div className="l-brand">
            <div className="l-brand-icon"><i className="fas fa-book" /></div>
            <div className="l-brand-name"><span>Read</span>vice</div>
          </div>

          <div className="l-hero">
            <div className="l-hero-tag">Business Intelligence</div>
            <h1>
              Smarter<br />
              decisions,<br />
              <span className="accent">every day.</span>
            </h1>
            <p>One platform to track campaigns, sales, ads performance, and your team — all in one place.</p>

            <div className="l-features">
              <div className="l-feature">
                <div className="l-feature-icon"><i className="fas fa-chart-line" /></div>
                Real-time sales &amp; ad spend tracking
              </div>
              <div className="l-feature">
                <div className="l-feature-icon"><i className="fas fa-bullhorn" /></div>
                KOL, Affiliate &amp; Campaign management
              </div>
              <div className="l-feature">
                <div className="l-feature-icon"><i className="fas fa-file-export" /></div>
                One-click reports &amp; Excel exports
              </div>
            </div>
          </div>

          <div className="l-stats">
            <div className="l-stat">
              <div className="l-stat-num">100%</div>
              <div className="l-stat-label">Data accuracy</div>
            </div>
            <div className="l-stat-div" />
            <div className="l-stat">
              <div className="l-stat-num">Real-time</div>
              <div className="l-stat-label">Reporting</div>
            </div>
            <div className="l-stat-div" />
            <div className="l-stat">
              <div className="l-stat-num">All-in-one</div>
              <div className="l-stat-label">Dashboard</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="lr">
          <div className="l-form-wrap">

            <div className="l-form-header">
              <div className="l-eyebrow">Welcome back</div>
              <h2>Sign in to<br />your account</h2>
              <p>Enter your credentials to access the dashboard.</p>
            </div>

            {error && (
              <div className="l-alert">
                <i className="fas fa-exclamation-circle" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>

              {/* Email */}
              <div className="l-field">
                <label htmlFor="email">Email address</label>
                <div className="l-field-wrap">
                  <i className="fas fa-envelope l-field-icon" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailErr(false) }}
                    className={emailErr ? 'err' : ''}
                  />
                </div>
                {emailErr && (
                  <span className="l-field-err">
                    {email ? 'Please enter a valid email address.' : 'Email address is required.'}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className="l-field">
                <label htmlFor="password">Password</label>
                <div className="l-field-wrap">
                  <i className="fas fa-lock l-field-icon" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setPwErr(false) }}
                    className={pwErr ? 'err' : ''}
                  />
                  <button
                    type="button"
                    className="l-toggle-pw"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPw(v => !v)}
                  >
                    <i className={showPw ? 'fas fa-eye-slash' : 'fas fa-eye'} />
                  </button>
                </div>
                {pwErr && <span className="l-field-err">Password is required.</span>}
              </div>

              {/* Remember + Forgot */}
              <div className="l-bottom">
                <label className="l-check">
                  <input type="checkbox" name="remember" id="remember" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="l-forgot">Forgot password?</a>
              </div>

              {/* Submit */}
              <button type="submit" className="l-btn" disabled={loading}>
                {loading ? (
                  <>
                    <div className="l-spinner" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt" />
                    Sign In
                  </>
                )}
              </button>

            </form>

            <div className="l-footer">&copy; 2026 Readvice. All rights reserved.</div>

          </div>
        </div>

      </div>
    </>
  )
}
