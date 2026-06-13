'use client'
import { useState, useEffect } from 'react'

export default function RefreshStatsModal({ isOpen, onClose, campaignId, onComplete }) {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [running, setRunning]   = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isOpen || !campaignId) return
    setLoading(true)
    setItems([])
    setProgress(0)
    fetch(`/api/campaigns/${campaignId}/refresh-list`)
      .then(r => r.json())
      .then(data => {
        setItems((Array.isArray(data) ? data : []).map(item => ({ ...item, status: 'pending' })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [isOpen, campaignId])

  async function handleRefreshAll() {
    if (running || items.length === 0) return
    setRunning(true)
    const updated = [...items]
    // Refresh ONE row at a time (await each) so we don't hammer the scraper
    // endpoints in parallel; a small delay between rows eases rate limits.
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'loading' }
      setItems([...updated])
      try {
        const res = await fetch(`/api/campaign-contents/${updated[i].id}/refresh`)
        const body = await res.json().catch(() => ({}))
        // fetch only rejects on network errors — a 502 from a failed scrape is
        // still a resolved promise, so check the status/body explicitly.
        updated[i] = { ...updated[i], status: res.ok && !body.error ? 'done' : 'error' }
      } catch {
        updated[i] = { ...updated[i], status: 'error' }
      }
      setItems([...updated])
      setProgress(Math.round(((i + 1) / updated.length) * 100))
      if (i < updated.length - 1) await new Promise(r => setTimeout(r, 300))
    }
    setRunning(false)
    setTimeout(() => { onComplete?.(); onClose() }, 1000)
  }

  if (!isOpen) return null

  function StatusIcon({ status }) {
    if (status === 'pending') return <i className="fas fa-clock text-yellow-500 text-xs"></i>
    if (status === 'loading') return <i className="fas fa-spinner fa-spin text-blue-500 text-xs"></i>
    if (status === 'done')    return <i className="fas fa-check text-green-500 text-xs"></i>
    return <i className="fas fa-times text-red-500 text-xs"></i>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream flex-shrink-0">
          <h3 className="font-semibold text-dark1 text-sm">Content to be Refreshed</h3>
          <button onClick={onClose} disabled={running} className="text-dark1/40 hover:text-dark1 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <i className="fas fa-spinner fa-spin text-dark2"></i>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#fafaf8] border-b border-cream">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-dark2 uppercase">Influencer</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-dark2 uppercase">Task</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-dark2 uppercase">Platform</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-dark2 uppercase">Product</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-dark2 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-cream/50">
                    <td className="px-3 py-1.5 font-medium text-dark1">{item.username}</td>
                    <td className="px-3 py-1.5 text-dark2">{item.task_name ?? item.task ?? '—'}</td>
                    <td className="px-3 py-1.5 text-dark2">{item.channel ?? '—'}</td>
                    <td className="px-3 py-1.5 text-dark2">{item.product ?? '—'}</td>
                    <td className="px-3 py-1.5 text-center"><StatusIcon status={item.status} /></td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr><td colSpan={5} className="text-center py-6 text-gray-400 text-xs">No content found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Progress bar */}
        {(running || progress > 0) && (
          <div className="px-4 py-2 border-t border-cream">
            <div className="flex justify-between text-[10px] text-dark2 mb-1">
              <span>Progress</span><span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-cream rounded-full overflow-hidden">
              <div className="h-full bg-dark1 rounded-full transition-all duration-300"
                style={{ width: progress + '%' }}></div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-cream flex-shrink-0">
          <button onClick={onClose} disabled={running} className="sv-act-btn sv-act-outline text-xs">Close</button>
          <button onClick={handleRefreshAll} disabled={running || loading || items.length === 0}
            className="sv-act-btn sv-act-success text-xs flex items-center gap-1">
            {running ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt"></i>}
            Refresh All
          </button>
        </div>
      </div>
    </div>
  )
}
