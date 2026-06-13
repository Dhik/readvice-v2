'use client'
import { useEffect, useRef } from 'react'

/**
 * Terminal-style log modal for Kalodata scraping progress.
 *
 * @param {{ isOpen: boolean, keyword: string, logs: {t: string, msg: string}[], status: string }} props
 */
export default function LogModal({ isOpen, keyword, logs = [], status }) {
  const bottomRef = useRef(null)

  // Auto-scroll to bottom whenever new logs arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length])

  if (!isOpen) return null

  const isDone   = status === 'done'
  const isFailed = status === 'failed'

  function formatTime(isoStr) {
    try {
      const d = new Date(isoStr)
      return d.toTimeString().slice(0, 8) // HH:MM:SS
    } catch {
      return '??:??:??'
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 640,
        background: '#0D1117',
        borderRadius: 12,
        border: '1px solid #30363D',
        boxShadow: '0 24px 64px rgba(0,0,0,.6)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        maxHeight: '80vh',
      }}>

        {/* ── Title bar ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px',
          background: '#161B22',
          borderBottom: '1px solid #30363D',
          flexShrink: 0,
        }}>
          {/* Traffic lights */}
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FFBD2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
          </div>

          <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#8B949E', fontFamily: 'monospace' }}>
            kalodata-scraper — &quot;{keyword}&quot;
          </span>

          {/* Status badge */}
          {isDone && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#3FB950', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="fas fa-circle-check" /> Done
            </span>
          )}
          {isFailed && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F85149', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="fas fa-circle-xmark" /> Failed
            </span>
          )}
          {!isDone && !isFailed && (
            <span style={{ fontSize: 11, color: '#58A6FF', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="fas fa-spinner fa-spin" /> Running…
            </span>
          )}
        </div>

        {/* ── Log body ──────────────────────────────────────── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
          fontSize: 12,
          lineHeight: 1.7,
          color: '#C9D1D9',
        }}>
          {/* Prompt header */}
          <div style={{ color: '#3FB950', marginBottom: 6 }}>
            $ kalodata-scraper --keyword &quot;{keyword}&quot; --max-pages 5
          </div>

          {logs.length === 0 && (
            <div style={{ color: '#484F58', fontStyle: 'italic' }}>
              Initializing…
            </div>
          )}

          {logs.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 2 }}>
              <span style={{ color: '#484F58', flexShrink: 0, userSelect: 'none' }}>
                [{formatTime(entry.t)}]
              </span>
              <span style={{ color: getLogColor(entry.msg) }}>
                {entry.msg}
              </span>
            </div>
          ))}

          {/* Blinking cursor while running */}
          {!isDone && !isFailed && (
            <span style={{ display: 'inline-block', width: 8, height: 14, background: '#C9D1D9', marginLeft: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom' }} />
          )}

          {isDone && (
            <div style={{ color: '#3FB950', marginTop: 8, fontWeight: 700 }}>
              ✓ Process exited with code 0
            </div>
          )}
          {isFailed && (
            <div style={{ color: '#F85149', marginTop: 8, fontWeight: 700 }}>
              ✗ Process exited with code 1
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Footer note ───────────────────────────────────── */}
        <div style={{
          padding: '8px 16px',
          background: '#161B22',
          borderTop: '1px solid #30363D',
          fontSize: 11,
          color: '#484F58',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{logs.length} log entries</span>
          <span>This window closes automatically when done</span>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

/** Color-code log lines based on content */
function getLogColor(msg) {
  if (!msg) return '#C9D1D9'
  const m = msg.toLowerCase()
  if (m.includes('error') || m.includes('failed') || m.startsWith('✗'))
    return '#F85149'
  if (m.includes('done') || m.includes('successful') || m.includes('login successful') || m.startsWith('✓'))
    return '#3FB950'
  if (m.includes('waiting') || m.includes('navigating') || m.includes('launching') || m.includes('filling'))
    return '#58A6FF'
  if (m.includes('page') && m.includes('extracting'))
    return '#E3B341'
  if (m.includes('collected'))
    return '#79C0FF'
  return '#C9D1D9'
}
