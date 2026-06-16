'use client'
// AnalyticsAIPanel (Part D1) — a floating "Ask AI" button (bottom-right) that opens a
// slide-over chat grounded in THIS page's engine output. The current view is trimmed
// by contextFor (D3 — top-N + honesty digest) and posted through the EXISTING gated
// conversation route ({ module, pageContext }), so gating/quota/compaction still apply
// and the legacy keyword-routed context keeps working. Answers explain dummy / small-
// sample / low-coverage caveats rather than laundering them into confident claims.
import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { contextFor } from '@/lib/analytics/ai-context'

const MD = {
  p:  ({ node, ...p }) => <p className="mb-1.5 last:mb-0 leading-relaxed" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold text-dark1" {...p} />,
  ul: ({ node, ...p }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5" {...p} />,
  ol: ({ node, ...p }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5" {...p} />,
  li: ({ node, ...p }) => <li className="leading-snug" {...p} />,
  code: ({ node, ...p }) => <code className="bg-cream/50 px-1 py-0.5 rounded text-[11px] font-mono" {...p} />,
  table: ({ node, ...p }) => <div className="overflow-x-auto my-1.5"><table className="w-full text-[11px] border-collapse" {...p} /></div>,
  th: ({ node, ...p }) => <th className="bg-cream/40 text-dark2 text-[9px] uppercase px-1.5 py-1 border border-cream text-left" {...p} />,
  td: ({ node, ...p }) => <td className="px-1.5 py-1 border border-cream/60 align-top" {...p} />,
  a: ({ node, ...p }) => <a className="text-orange underline" target="_blank" rel="noopener noreferrer" {...p} />,
}

export default function AnalyticsAIPanel({ module, context, suggestions = [] }) {
  const [open, setOpen] = useState(false)
  const [convoId, setConvoId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const threadRef = useRef(null)

  useEffect(() => { const el = threadRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages, sending, open])

  const ensureConvo = useCallback(async () => {
    if (convoId) return convoId
    const res = await fetch('/api/ai/conversations', { method: 'POST' })
    const d = await res.json()
    if (!res.ok) throw new Error(d?.error || 'Could not start chat')
    setConvoId(d.id)
    return d.id
  }, [convoId])

  const ask = useCallback(async (q) => {
    const question = (q ?? input).trim()
    if (!question || sending) return
    setInput(''); setError('')
    setSending(true)
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: question }])
    try {
      const id = await ensureConvo()
      // Trim the view (top-N + honesty digest) before sending — never drop flags.
      const pageContext = contextFor(module, context)
      const res = await fetch(`/api/ai/conversations/${id}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, module, pageContext }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d?.error || 'Request failed'); return }   // 403/429/502 surface here
      setMessages(prev => [...prev, { ...d.message, viewModule: d.viewModule }])
    } catch (e) {
      setError(e.message || 'Network error')
    } finally { setSending(false) }
  }, [input, sending, ensureConvo, module, context])

  function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)} aria-label="Ask AI about this view"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 text-white shadow-lg hover:shadow-xl transition"
        style={{ background: '#E07B39' }}>
        <i className={`fas ${open ? 'fa-xmark' : 'fa-robot'}`} />
        <span className="text-sm font-semibold">{open ? 'Close' : 'Ask AI'}</span>
      </button>

      {/* Slide-over */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-dark1/10" onClick={() => setOpen(false)} />
          <aside className="fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-white shadow-2xl flex flex-col border-l border-cream">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-cream flex-shrink-0">
              <i className="fas fa-robot text-orange" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-dark1 leading-tight">Ask AI</div>
                <div className="text-[10px] text-dark1/45 truncate">Grounded in this <b>{module}</b> view · explains dummy / small-sample caveats</div>
              </div>
              <button onClick={() => setOpen(false)} className="ml-auto text-dark1/40 hover:text-dark1 text-lg leading-none">&times;</button>
            </div>

            <div ref={threadRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
              {messages.length === 0 && !sending && (
                <div className="text-dark1/45 text-xs space-y-2">
                  <p>Ask anything about what&apos;s on this page. Answers cite the on-screen figures and flag dummy / small-sample / low-coverage data honestly.</p>
                  {suggestions.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {suggestions.map((s, i) => (
                        <button key={i} onClick={() => ask(s)} className="text-left text-[11px] border border-cream rounded px-2 py-1 hover:border-dark2 hover:bg-bg/60 text-dark1/75">
                          <i className="fas fa-wand-magic-sparkles text-orange/70 mr-1" /> {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[88%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-dark1 text-white whitespace-pre-wrap' : 'bg-bg/70 border border-cream text-dark1'}`}>
                    {m.role === 'user' ? m.content : <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MD}>{m.content}</ReactMarkdown>}
                  </div>
                  {m.role === 'assistant' && (m.inputTokens != null) && (
                    <div className="text-[9px] text-dark1/35 mt-0.5">{m.viewModule ? `grounded: ${m.viewModule} · ` : ''}{m.inputTokens} in / {m.outputTokens} out</div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex items-start"><div className="bg-bg/70 border border-cream rounded-lg px-3 py-2 flex gap-1">
                  {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-dark2/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div></div>
              )}
            </div>

            {error && <div className="mx-3 mb-1 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 flex-shrink-0">{error}</div>}

            <div className="border-t border-cream p-2 flex gap-2 flex-shrink-0">
              <textarea rows={2} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} disabled={sending}
                placeholder="Ask about this view…  (Enter to send)"
                className="form-input flex-1 resize-none text-sm" />
              <button onClick={() => ask()} disabled={sending || !input.trim()} className="btn btn-primary self-end disabled:opacity-40">
                <i className="fas fa-paper-plane" />
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
