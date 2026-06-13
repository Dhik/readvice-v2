'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Swal from 'sweetalert2'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

// Compact Tailwind-styled Markdown for assistant answers (tables, headers, lists,
// rules). `node` is destructured out so it isn't spread onto DOM elements.
const MD_COMPONENTS = {
  p:          ({ node, ...p }) => <p className="mb-2 last:mb-0 leading-relaxed" {...p} />,
  h1:         ({ node, ...p }) => <h1 className="text-base font-bold text-dark1 mt-3 mb-1.5 first:mt-0" {...p} />,
  h2:         ({ node, ...p }) => <h2 className="text-sm font-bold text-dark1 mt-3 mb-1.5 first:mt-0" {...p} />,
  h3:         ({ node, ...p }) => <h3 className="text-sm font-semibold text-dark1 mt-2 mb-1 first:mt-0" {...p} />,
  strong:     ({ node, ...p }) => <strong className="font-semibold text-dark1" {...p} />,
  em:         ({ node, ...p }) => <em className="italic" {...p} />,
  ul:         ({ node, ...p }) => <ul className="list-disc pl-4 mb-2 space-y-0.5" {...p} />,
  ol:         ({ node, ...p }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5" {...p} />,
  li:         ({ node, ...p }) => <li className="leading-snug" {...p} />,
  hr:         ({ node, ...p }) => <hr className="my-2.5 border-cream" {...p} />,
  a:          ({ node, ...p }) => <a className="text-orange underline" target="_blank" rel="noopener noreferrer" {...p} />,
  blockquote: ({ node, ...p }) => <blockquote className="border-l-2 border-cream pl-2 text-dark2 italic mb-2" {...p} />,
  code:       ({ node, ...p }) => <code className="bg-cream/50 px-1 py-0.5 rounded text-[12px] font-mono" {...p} />,
  pre:        ({ node, ...p }) => <pre className="bg-dark1 text-white p-2 rounded text-[11px] overflow-x-auto mb-2" {...p} />,
  table:      ({ node, ...p }) => <div className="overflow-x-auto my-2"><table className="w-full text-xs border-collapse" {...p} /></div>,
  th:         ({ node, ...p }) => <th className="bg-cream/40 text-dark2 text-[10px] uppercase font-semibold px-2 py-1 border border-cream text-left" {...p} />,
  td:         ({ node, ...p }) => <td className="px-2 py-1 border border-cream/60 text-dark1 align-top" {...p} />,
}

function ChatMarkdown({ content }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MD_COMPONENTS}>
      {content}
    </ReactMarkdown>
  )
}

// Brand palette (same as TYPE_COLORS used elsewhere).
const CHART_PALETTE = ['#E07B39', '#2C3639', '#3F4E4F', '#8B5E3C']

// Renders a Claude-returned chart spec via Chart.js. Session-only: only messages
// from the live send response carry `chart`; rehydrated history never does.
function ChatChart({ spec }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || !spec) return
    chartRef.current?.destroy()
    const doughnut = spec.type === 'doughnut'
    const datasets = spec.datasets.map((ds, i) => ({
      label: ds.label,
      data:  ds.data,
      backgroundColor: doughnut ? CHART_PALETTE : CHART_PALETTE[i % CHART_PALETTE.length],
      borderColor:     CHART_PALETTE[i % CHART_PALETTE.length],
      ...(spec.type === 'line' ? { fill: false, tension: 0.3, borderWidth: 2 } : {}),
    }))
    chartRef.current = new Chart(canvasRef.current, {
      type: spec.type,
      data: { labels: spec.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: doughnut || datasets.length > 1, position: 'bottom', labels: { font: { size: 10 } } },
          title:  { display: !!spec.title, text: spec.title, font: { size: 11 } },
        },
      },
    })
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [spec])

  return (
    <div className="mt-2 bg-white border border-cream rounded-lg p-2" style={{ maxWidth: 480, width: '100%' }}>
      <div style={{ height: 260 }}><canvas ref={canvasRef} /></div>
    </div>
  )
}

function timeAgo(date) {
  const d = new Date(date)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60)      return 'just now'
  const m = Math.floor(s / 60);   if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60);   if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7)  return `${days}d ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const fmtInt = v => (v ?? 0).toLocaleString()
const fmtUsd = v => '$' + (v ?? 0).toFixed(4)

function Tile({ icon, label, value, accent }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-tile-icon" style={{ background: accent }}><i className={`fas ${icon}`} /></div>
      <div className="min-w-0">
        <div className="kpi-tile-label">{label}</div>
        <div className="kpi-tile-value">{value}</div>
      </div>
    </div>
  )
}

// Build the 4 standard tiles from a {totalConversations,totalMessages,inputTokens,outputTokens,estimatedCostUsd} block.
function usageTiles(b) {
  return [
    { icon: 'fa-comments',     label: 'Conversations', value: fmtInt(b.totalConversations),                accent: '#2C3639' },
    { icon: 'fa-message',      label: 'Messages',      value: fmtInt(b.totalMessages),                     accent: '#3F4E4F' },
    { icon: 'fa-coins',        label: 'Total Tokens',  value: fmtInt(b.inputTokens + b.outputTokens),      accent: '#E07B39' },
    { icon: 'fa-dollar-sign',  label: 'Est. Cost',     value: fmtUsd(b.estimatedCostUsd),                  accent: '#2C3639' },
  ]
}

const toYMD = d => d.toISOString().slice(0, 10)

// Shared Chart.js options for the usage tab.
const CHART_BASE  = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } } } }
const AXIS        = { x: { ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true } }, y: { ticks: { font: { size: 9 } }, beginAtZero: true } }
const LINE_OPTS   = { ...CHART_BASE, scales: AXIS }
const BAR_OPTS    = { ...CHART_BASE, plugins: { legend: { display: false } }, scales: AXIS }
const DONUT_OPTS  = { ...CHART_BASE, cutout: '60%' }
const HBAR_OPTS   = { ...CHART_BASE, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 } }, beginAtZero: true }, y: { ticks: { font: { size: 10 } } } } }

// Renders a full Chart.js config; recreates only when the config object changes.
function UsageChart({ config, height = 200 }) {
  const ref = useRef(null), inst = useRef(null)
  useEffect(() => {
    if (!ref.current || !config) return
    inst.current?.destroy()
    inst.current = new Chart(ref.current, config)
    return () => { inst.current?.destroy(); inst.current = null }
  }, [config])
  return <div style={{ height }}><canvas ref={ref} /></div>
}

export default function AiInsightsPage() {
  const [view, setView]                   = useState('chat')   // 'chat' | 'usage'
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId]           = useState(null)
  const [messages, setMessages]           = useState([])
  const [input, setInput]                 = useState('')
  const [sending, setSending]             = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [error, setError]                 = useState('')

  const [usage, setUsage]               = useState(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError]     = useState('')
  const [usageStart, setUsageStart]     = useState(() => toYMD(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
  const [usageEnd, setUsageEnd]         = useState(() => toYMD(new Date()))

  const threadRef = useRef(null)

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations')
      const d   = await res.json()
      setConversations(d.conversations ?? [])
    } catch {}
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Load thread when the active conversation changes.
  useEffect(() => {
    if (activeId == null) { setMessages([]); return }
    let cancelled = false
    setLoadingThread(true)
    setError('')
    fetch(`/api/ai/conversations/${activeId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!cancelled) setMessages(d.messages ?? []) })
      .catch(() => { if (!cancelled) setMessages([]) })
      .finally(() => { if (!cancelled) setLoadingThread(false) })
    return () => { cancelled = true }
  }, [activeId])

  // Auto-scroll to the latest message / typing indicator.
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  // Lazy-load usage analytics when the Usage tab is opened / the range changes.
  const loadUsage = useCallback(async () => {
    setUsageLoading(true)
    setUsageError('')
    try {
      const params = new URLSearchParams()
      if (usageStart) params.set('startDate', usageStart)
      if (usageEnd)   params.set('endDate', usageEnd)
      const res = await fetch('/api/ai/usage?' + params)
      const d   = await res.json()
      if (!res.ok) { setUsageError(d.error ?? 'Failed to load usage'); return }
      setUsage(d)
    } catch {
      setUsageError('Network error')
    } finally {
      setUsageLoading(false)
    }
  }, [usageStart, usageEnd])

  useEffect(() => { if (view === 'usage') loadUsage() }, [view, loadUsage])

  // Chart configs derived from the loaded usage data (brand palette).
  const usageCharts = useMemo(() => {
    if (!usage) return null
    const p = usage.personal
    const labels = p.daily.map(d => d.date)
    const r4 = v => Number((v ?? 0).toFixed(4))
    return {
      tokensLine: {
        type: 'line',
        data: { labels, datasets: [
          { label: 'Input tokens',  data: p.daily.map(d => d.inputTokens),  borderColor: '#2C3639', backgroundColor: '#2C3639', tension: 0.3, fill: false, pointRadius: 2 },
          { label: 'Output tokens', data: p.daily.map(d => d.outputTokens), borderColor: '#E07B39', backgroundColor: '#E07B39', tension: 0.3, fill: false, pointRadius: 2 },
        ] },
        options: LINE_OPTS,
      },
      splitDonut: {
        type: 'doughnut',
        data: { labels: ['Input', 'Output'], datasets: [{ data: [p.inputTokens, p.outputTokens], backgroundColor: ['#2C3639', '#E07B39'], borderColor: '#fff', borderWidth: 2 }] },
        options: DONUT_OPTS,
      },
      costBar: {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Est. cost (USD)', data: p.daily.map(d => r4(d.costUsd)), backgroundColor: '#8B5E3C', borderRadius: 3 }] },
        options: BAR_OPTS,
      },
      tenantCostBar: usage.tenant ? {
        type: 'bar',
        data: { labels: usage.tenant.byUser.map(u => u.userName), datasets: [{ label: 'Est. cost (USD)', data: usage.tenant.byUser.map(u => r4(u.estimatedCostUsd)), backgroundColor: '#E07B39', borderRadius: 3 }] },
        options: HBAR_OPTS,
      } : null,
    }
  }, [usage])

  async function newChat() {
    setError('')
    try {
      const res = await fetch('/api/ai/conversations', { method: 'POST' })
      const d   = await res.json()
      if (!res.ok) return
      setConversations(prev => [{ id: d.id, title: 'New Chat', updatedAt: new Date().toISOString() }, ...prev])
      setActiveId(d.id)
      setMessages([])
    } catch {}
  }

  async function send() {
    const q = input.trim()
    if (!q || sending || activeId == null) return
    setInput('')
    setError('')
    setSending(true)
    // Optimistic user bubble.
    setMessages(prev => [...prev, { id: `tmp-${Date.now()}`, role: 'user', content: q }])
    try {
      const res = await fetch(`/api/ai/conversations/${activeId}/message`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: q }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Request failed'); return }
      setMessages(prev => [...prev, d.message])
      loadConversations()   // title/order may have changed
    } catch {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  async function removeConvo(id, e) {
    e.stopPropagation()
    const r = await Swal.fire({
      title: 'Delete chat?', text: 'This conversation and its messages will be removed.',
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Delete',
    })
    if (!r.isConfirmed) return
    const res = await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeId === id) { setActiveId(null); setMessages([]) }
    }
  }

  return (
    <div className="sv-page">
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          <i className="fas fa-robot text-orange mr-1" /> AI Ads Insights
        </span>
        <div className="tab-pills">
          <button onClick={() => setView('chat')}  className={`tab-pill ${view === 'chat'  ? 'active' : ''}`}>Chat</button>
          <button onClick={() => setView('usage')} className={`tab-pill ${view === 'usage' ? 'active' : ''}`}>Usage</button>
        </div>
        <span className="text-xs text-dark2/60 ml-auto">
          {view === 'chat' ? 'Current month · your chats only' : 'Token & cost analytics'}
        </span>
      </div>

      {view === 'chat' && (
      <div className="sv-main">
        {/* Left: conversation list */}
        <div className="sv-panel" style={{ flex: '0 0 280px' }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title"><i className="fas fa-comments text-dark2" /> Chats</span>
          </div>
          <div className="p-2 flex-shrink-0">
            <button onClick={newChat} className="btn btn-primary w-full text-sm">
              <i className="fas fa-plus mr-1" /> New Chat
            </button>
          </div>
          <div className="sv-panel-body p-0 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="text-center text-dark2/40 text-xs py-8">No chats yet</div>
            ) : conversations.map(c => (
              <div
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-cream/40 ${
                  activeId === c.id ? 'bg-cream/60' : 'hover:bg-bg/60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-dark1 truncate">{c.title}</div>
                  <div className="text-[10px] text-dark2/40">{timeAgo(c.updatedAt)}</div>
                </div>
                <button
                  onClick={e => removeConvo(c.id, e)}
                  title="Delete"
                  className="opacity-0 group-hover:opacity-100 text-dark2/40 hover:text-red-500 text-xs flex-shrink-0"
                >
                  <i className="fas fa-trash-alt" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: chat thread */}
        <div className="sv-panel" style={{ flex: 1 }}>
          {activeId == null ? (
            <div className="flex flex-1 flex-col items-center justify-center text-dark2/40 gap-2">
              <i className="fas fa-comment-dots text-3xl" />
              <span className="text-sm">Select or start a new chat</span>
            </div>
          ) : (
            <>
              <div ref={threadRef} className="sv-panel-body overflow-y-auto flex flex-col gap-3">
                {loadingThread ? (
                  <div className="text-center text-dark2/40 text-xs py-4">Loading…</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-dark2/40 text-xs py-8">Ask your first question about this month&apos;s ads.</div>
                ) : messages.map(m => (
                  <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-dark1 text-white whitespace-pre-wrap'
                          : 'bg-bg/70 border border-cream text-dark1'
                      }`}
                    >
                      {m.role === 'user'
                        ? m.content
                        : <ChatMarkdown content={m.content} />}
                    </div>
                    {m.role === 'assistant' && (m.inputTokens != null || m.outputTokens != null) && (
                      <div className="text-[10px] text-dark2/40 mt-0.5">
                        {m.inputTokens ?? '?'} in / {m.outputTokens ?? '?'} out
                      </div>
                    )}
                    {m.role === 'assistant' && m.sources?.length > 0 && (
                      <div className="text-[10px] text-dark2/40">context: {m.sources.join(' + ')}</div>
                    )}
                    {m.role === 'assistant' && m.talentGated && (
                      <div className="text-[10px] text-amber-600/70"><i className="fas fa-lock mr-1" />talent data restricted</div>
                    )}
                    {m.role === 'assistant' && m.chart && <ChatChart spec={m.chart} />}
                  </div>
                ))}

                {sending && (
                  <div className="flex items-start">
                    <div className="bg-bg/70 border border-cream rounded-lg px-3 py-2 flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-dark2/50 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mx-3 mb-1 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 flex-shrink-0">
                  {error}
                </div>
              )}

              <div className="border-t border-cream/60 p-2 flex gap-2 flex-shrink-0">
                <textarea
                  className="form-input flex-1 resize-none text-sm"
                  rows={2}
                  placeholder="Ask about your ads…  (Enter to send, Shift+Enter for newline)"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={sending}
                />
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  className="btn btn-primary self-end"
                >
                  <i className="fas fa-paper-plane" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {view === 'usage' && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {/* Date-range filter */}
          <div className="sv-panel">
            <div className="sv-panel-body flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-dark2"><i className="fas fa-calendar-alt mr-1" />Date range</span>
              <label className="flex items-center gap-1 text-xs text-dark2/70">From
                <input type="date" className="form-input text-xs h-7" value={usageStart} max={usageEnd}
                  onChange={e => setUsageStart(e.target.value)} />
              </label>
              <label className="flex items-center gap-1 text-xs text-dark2/70">To
                <input type="date" className="form-input text-xs h-7" value={usageEnd} min={usageStart}
                  onChange={e => setUsageEnd(e.target.value)} />
              </label>
              {usage?.range && (
                <span className="text-[10px] text-dark2/40 ml-auto">{usage.range.start} → {usage.range.end}</span>
              )}
            </div>
          </div>

          {usageLoading ? (
            <div className="text-center text-dark2/40 text-sm py-8">Loading usage…</div>
          ) : usageError ? (
            <div className="text-center text-sm text-red-600 py-8">{usageError}</div>
          ) : usage ? (
            <>
              {/* Personal */}
              <div className="sv-panel">
                <div className="sv-panel-header">
                  <span className="sv-panel-title"><i className="fas fa-user text-dark2" /> Your Usage</span>
                </div>
                <div className="sv-panel-body flex flex-col gap-3">
                  <div className="sv-kpi-strip">
                    {usageTiles(usage.personal).map(t => <Tile key={t.label} {...t} />)}
                  </div>
                  {usage.personal.totalMessages === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-6">No usage in this range</div>
                  ) : (
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex-1 min-w-[280px]">
                        <div className="text-[10px] font-semibold text-dark2 uppercase tracking-wide mb-1">Tokens per day</div>
                        <UsageChart config={usageCharts.tokensLine} />
                      </div>
                      <div className="w-[220px]">
                        <div className="text-[10px] font-semibold text-dark2 uppercase tracking-wide mb-1">Input vs Output</div>
                        <UsageChart config={usageCharts.splitDonut} />
                      </div>
                      <div className="flex-1 min-w-[280px]">
                        <div className="text-[10px] font-semibold text-dark2 uppercase tracking-wide mb-1">Est. cost per day (USD)</div>
                        <UsageChart config={usageCharts.costBar} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tenant (only when returned — view_tenant permission) */}
              {usage.tenant && (
                <div className="sv-panel">
                  <div className="sv-panel-header">
                    <span className="sv-panel-title"><i className="fas fa-building text-dark2" /> Tenant Usage</span>
                    <span className="text-[10px] text-dark2/50">Visible to users with tenant management access only.</span>
                  </div>
                  <div className="sv-panel-body flex flex-col gap-3">
                    <div className="sv-kpi-strip">
                      {usageTiles(usage.tenant).map(t => <Tile key={t.label} {...t} />)}
                    </div>
                    {usage.tenant.byUser.length === 0 ? (
                      <div className="text-center text-sm text-gray-400 py-6">No tenant usage in this range</div>
                    ) : (
                      <div className="flex gap-3 flex-wrap">
                        <div className="flex-1 min-w-[280px]">
                          <div className="text-[10px] font-semibold text-dark2 uppercase tracking-wide mb-1">Est. cost by user (USD)</div>
                          <UsageChart config={usageCharts.tenantCostBar} height={Math.max(160, usage.tenant.byUser.length * 30)} />
                        </div>
                        <div className="flex-1 min-w-[320px]">
                          <table className="sv-table-clean">
                            <thead>
                              <tr>
                                <th>User</th>
                                <th><span className="num">Conversations</span></th>
                                <th><span className="num">Tokens</span></th>
                                <th><span className="num">Est. Cost</span></th>
                              </tr>
                            </thead>
                            <tbody>
                              {usage.tenant.byUser.map(u => (
                                <tr key={u.userId}>
                                  <td className="text-dark1 font-medium">{u.userName}</td>
                                  <td><span className="num">{fmtInt(u.conversationCount)}</span></td>
                                  <td><span className="num">{fmtInt(u.inputTokens + u.outputTokens)}</span></td>
                                  <td><span className="num">{fmtUsd(u.estimatedCostUsd)}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
