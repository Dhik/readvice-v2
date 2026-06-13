'use client'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync } from '@fortawesome/free-solid-svg-icons'

export default function SyncButton({ endpoint, label = 'Sync from Google Sheets' }) {
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)

  async function handleSync() {
    setLoading(true)
    const res  = await fetch(endpoint)
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleSync} disabled={loading} className="btn btn-outline btn-sm">
        <FontAwesomeIcon icon={faSync} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Syncing...' : label}
      </button>
      {result && <span className="text-xs text-green-600">✓ {result.imported} rows synced</span>}
    </div>
  )
}
