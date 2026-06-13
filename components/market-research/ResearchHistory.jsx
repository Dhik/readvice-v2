'use client'
import { useState } from 'react'

const SOURCE_META = {
  tokopedia: { label: 'Tokopedia',  color: 'var(--color-orange)', bg: 'rgba(224,123,57,.1)',  icon: 'fa-store'     },
  shopee:    { label: 'Shopee',     color: '#EE4D2D',             bg: 'rgba(238,77,45,.08)',  icon: 'fa-bag-shopping' },
  kalodata:  { label: 'Kalodata',   color: '#3B82F6',             bg: 'rgba(59,130,246,.08)', icon: 'fa-chart-bar' },
}

function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(isoStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export default function ResearchHistory({ history = [], currentId, onLoad, onRefresh, refreshing }) {
  const [expanded, setExpanded] = useState(true)

  if (!history.length && !refreshing) return null

  const doneItems = history.filter(h => h.status === 'done')

  return (
    <div style={{ background: 'white', border: '1px solid var(--color-cream)', borderRadius: 10, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--color-dark1)' }}>
          <i className="fas fa-clock-rotate-left" style={{ color: '#aaa', fontSize: 11 }} />
          Riwayat Research
          <span style={{ background: 'var(--color-bg)', border: '1px solid var(--color-cream)', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600, color: '#888' }}>
            {doneItems.length}
          </span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); onRefresh() }}
            title="Refresh history"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}
          >
            <i className={`fas fa-rotate-right ${refreshing ? 'fa-spin' : ''}`} />
          </button>
          <i className={`fas fa-chevron-${expanded ? 'up' : 'down'}`} style={{ fontSize: 10, color: '#bbb' }} />
        </div>
      </div>

      {/* ── Items ── */}
      {expanded && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {doneItems.length === 0 && (
            <div style={{ padding: '8px 4px', color: '#bbb', fontSize: 12 }}>Belum ada riwayat research.</div>
          )}
          {doneItems.map(item => {
            const meta    = SOURCE_META[item.source] ?? SOURCE_META.tokopedia
            const isActive = item.id === currentId

            return (
              <button
                key={item.id}
                onClick={() => onLoad(item)}
                title={`${item.keyword} (${meta.label}) — ${relativeTime(item.createdAt)}`}
                style={{
                  display:    'inline-flex',
                  alignItems: 'center',
                  gap:        6,
                  padding:    '5px 10px',
                  borderRadius: 6,
                  border:     `1.5px solid ${isActive ? meta.color : 'var(--color-cream)'}`,
                  background: isActive ? meta.bg : 'var(--color-bg)',
                  cursor:     'pointer',
                  transition: 'all .12s',
                }}
              >
                {/* Source dot */}
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />

                {/* Keyword */}
                <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? meta.color : 'var(--color-dark1)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.keyword}
                </span>

                {/* Source label */}
                <span style={{ fontSize: 10, color: '#999', flexShrink: 0 }}>{meta.label}</span>

                {/* Time */}
                <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0 }}>{relativeTime(item.createdAt)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
