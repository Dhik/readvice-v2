'use client'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'mr-recent-keywords'
const MAX_RECENT  = 6

export default function KeywordSearch({ onSearch, loading }) {
  const [input,   setInput]   = useState('')
  const [recent,  setRecent]  = useState([])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      setRecent(Array.isArray(saved) ? saved : [])
    } catch {}
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const kw = input.trim()
    if (!kw || loading) return
    saveRecent(kw)
    onSearch(kw)
  }

  function handleChip(kw) {
    if (loading) return
    setInput(kw)
    saveRecent(kw)
    onSearch(kw)
  }

  function saveRecent(kw) {
    setRecent(prev => {
      const next = [kw, ...prev.filter(r => r.toLowerCase() !== kw.toLowerCase())].slice(0, MAX_RECENT)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <div style={{ background: 'white', border: '1px solid var(--color-cream)', borderRadius: 10, padding: '16px 20px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 13 }} />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder='Cari keyword produk... e.g. "Moisturizer", "Serum Vitamin C"'
            disabled={loading}
            style={{
              width: '100%', border: '1.5px solid var(--color-cream)', borderRadius: 7,
              padding: '9px 12px 9px 34px', fontSize: 13, outline: 'none',
              background: loading ? '#fafaf8' : 'white', color: 'var(--color-dark1)',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || loading}
          style={{
            background: loading || !input.trim() ? '#ccc' : 'var(--color-orange)',
            color: 'white', border: 'none', borderRadius: 7, padding: '0 20px',
            fontSize: 13, fontWeight: 600, cursor: loading || !input.trim() ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}
        >
          {loading ? (
            <><i className="fas fa-spinner fa-spin" /> Researching...</>
          ) : (
            <><i className="fas fa-magnifying-glass" /> Research</>
          )}
        </button>
      </form>

      {recent.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Recent:</span>
          {recent.map(kw => (
            <button
              key={kw}
              onClick={() => handleChip(kw)}
              disabled={loading}
              style={{
                background: 'var(--color-bg)', border: '1px solid var(--color-cream)',
                borderRadius: 20, padding: '2px 10px', fontSize: 12, color: 'var(--color-dark2)',
                cursor: loading ? 'default' : 'pointer', fontWeight: 500,
              }}
            >
              {kw}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
