'use client'
import { useState } from 'react'

export default function KalodataCredentialModal({ isOpen, onClose, onSaved, existingPhone }) {
  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState(null)

  if (!isOpen) return null

  async function handleSave() {
    if (!phone.trim() || !password.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res  = await fetch('/api/market-research/kalodata-credential', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: phone.trim(), password: password.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to save')
      onSaved({ exists: true, maskedPhone: data.maskedPhone })
      setPhone(''); setPassword('')
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Remove Kalodata credentials?')) return
    setDeleting(true)
    try {
      await fetch('/api/market-research/kalodata-credential', { method: 'DELETE' })
      onSaved({ exists: false, maskedPhone: null })
      onClose()
    } catch {}
    finally { setDeleting(false) }
  }

  const canSave = phone.trim().length > 0 && password.trim().length > 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 420 }}>

        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-key" style={{ color: '#3B82F6', fontSize: 14 }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-dark1)' }}>Kalodata Credentials</h3>
              <p style={{ margin: 0, fontSize: 11, color: '#999' }}>Used to log in and scrape product data</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 16 }}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#92400E', display: 'flex', gap: 8 }}>
            <i className="fas fa-triangle-exclamation" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>These are your own Kalodata account credentials. They are stored in your private database and only used to fetch market data.</span>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              className="form-input"
              placeholder={existingPhone ? `Current: ${existingPhone}` : '08xxxxxxxxxx'}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSave && handleSave()}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                className="form-input"
                placeholder="Kalodata password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canSave && handleSave()}
                style={{ paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}
              >
                <i className={`fas fa-eye${showPw ? '-slash' : ''}`} />
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: '#DC2626' }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {existingPhone && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#DC2626', cursor: 'pointer' }}
            >
              {deleting ? 'Removing…' : <><i className="fas fa-trash" /> Remove</>}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button onClick={onClose} className="btn btn-outline btn-sm">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              style={{
                background: saving || !canSave ? '#ccc' : '#3B82F6',
                color: 'white', border: 'none', borderRadius: 6,
                padding: '6px 16px', fontSize: 12, fontWeight: 600,
                cursor: saving || !canSave ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {saving ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : <><i className="fas fa-check" /> Save Credentials</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
