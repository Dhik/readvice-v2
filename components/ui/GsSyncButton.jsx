'use client'
// Compact Google-Sheets sync trigger styled to match the analytics topbars (sv-tbtn).
// GETs an /api/import/gs/* route and reports imported/skipped/unmatched via toast.
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function GsSyncButton({ endpoint, label = 'Sync', icon = 'fa-rotate', onDone }) {
  const [loading, setLoading] = useState(false)
  async function run() {
    setLoading(true)
    try {
      const res = await fetch(endpoint)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error || `Sync failed (${res.status})`); return }
      const unmatched = d.unmatchedHandles?.length ?? d.unmatchedOrders ?? 0
      const parts = [`Synced ${d.imported ?? 0} rows`]
      if (d.skipped) parts.push(`${d.skipped} skipped`)
      if (unmatched) parts.push(`${unmatched} unmatched`)
      toast.success(parts.join(' · '))
      onDone?.(d)
    } catch (e) { toast.error(e.message || 'Sync failed') }
    finally { setLoading(false) }
  }
  return (
    <button onClick={run} disabled={loading} title="Import real data from Google Sheets"
      className="sv-tbtn sv-tbtn-ghost disabled:opacity-50">
      <i className={`fas ${loading ? 'fa-spinner fa-spin' : icon}`} /> {loading ? 'Syncing…' : label}
    </button>
  )
}
