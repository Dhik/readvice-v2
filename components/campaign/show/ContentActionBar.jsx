'use client'
import { useSession } from 'next-auth/react'

const PLATFORMS = [
  'TikTok video', 'TikTok live', 'Instagram feed', 'Instagram story',
  'youtube video', 'twitter post', 'shopee video',
]

export default function ContentActionBar({
  campaignId,
  campaignTitle,
  filterPlatform, setFilterPlatform,
  filterFyp, setFilterFyp,
  filterPayment, setFilterPayment,
  filterDelivery, setFilterDelivery,
  onAdd,
  onRefreshStats,
  onRefreshFollowers,
  onImport,
  onImportKol,
}) {
  const { data: session } = useSession()
  const canUpdate = session?.user?.permissions?.includes('update_campaign')

  const isKol = (campaignTitle ?? '').toLowerCase().includes('kol')

  function handleExport() {
    window.location.href = `/api/campaigns/${campaignId}/export-content`
  }

  return (
    <div className="sv-content-actionbar">
      {/* Left: filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterPlatform}
          onChange={e => setFilterPlatform(e.target.value)}
          className="border border-cream rounded text-xs px-2 py-1 h-7 text-dark1 focus:outline-none focus:border-dark2 bg-white">
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <label className="sv-check-label">
          <input type="checkbox" checked={filterFyp} onChange={e => setFilterFyp(e.target.checked)}
            className="rounded border-cream" />
          FYP
        </label>
        <label className="sv-check-label">
          <input type="checkbox" checked={filterPayment} onChange={e => setFilterPayment(e.target.checked)}
            className="rounded border-cream" />
          Paid
        </label>
        <label className="sv-check-label">
          <input type="checkbox" checked={filterDelivery} onChange={e => setFilterDelivery(e.target.checked)}
            className="rounded border-cream" />
          Delivered
        </label>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {canUpdate && (
          <button onClick={onAdd} className="sv-act-btn sv-act-primary text-xs">
            <i className="fas fa-plus"></i> Add
          </button>
        )}
        <button onClick={onRefreshStats} className="sv-act-btn sv-act-success text-xs">
          <i className="fas fa-sync-alt"></i> Refresh Stats
        </button>
        <button onClick={onRefreshFollowers} className="sv-act-btn sv-act-info text-xs">
          <i className="fas fa-sync-alt"></i> Refresh Followers
        </button>
        <button onClick={handleExport} className="sv-act-btn sv-act-outline text-xs">
          <i className="fas fa-file-download"></i> Export
        </button>
        {canUpdate && (
          <button
            onClick={isKol ? onImportKol : onImport}
            className={'sv-act-btn text-xs ' + (isKol ? 'sv-act-outline-r' : 'sv-act-outline-g')}>
            <i className="fas fa-file-upload"></i> Import
          </button>
        )}
      </div>
    </div>
  )
}
