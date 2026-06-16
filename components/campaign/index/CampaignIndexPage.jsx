'use client'
import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import CampaignTypeNav from './CampaignTypeNav'
import CampaignKpiStrip from './CampaignKpiStrip'
import CampaignTable from './CampaignTable'
import CampaignAnalyticsPanel from './CampaignAnalyticsPanel'
import KolExportModal from './KolExportModal'
import AddCampaignModal from './AddCampaignModal'
import CrossLink from '@/components/dashboard/CrossLink'
import toast from 'react-hot-toast'

const TYPE_CHIP_COLORS = { creative: '#3F4E4F', kol: '#E07B39', clipper: '#2C3639', affiliate: '#8B5E3C' }
const TYPE_ICONS  = { creative: 'fa-paint-brush', kol: 'fa-star', clipper: 'fa-film', affiliate: 'fa-user-tie' }
const TYPE_LABELS = { creative: 'Creative', kol: 'KOL', clipper: 'Clipper', affiliate: 'Affiliate Talent' }

// When type prop is omitted the page operates in "unified" mode:
// all campaign types are shown together, filtered only by search / filterType.
export default function CampaignIndexPage({ type }) {
  const isUnified = !type

  const { data: session } = useSession()
  const [filterMonth, setFilterMonth]     = useState('')
  const [filterDates, setFilterDates]     = useState('')
  const [search, setSearch]               = useState('')
  const [filterType, setFilterType]       = useState('')   // unified-mode type dropdown
  const [summaryData, setSummaryData]     = useState(null)
  const [bulkLoading, setBulkLoading]     = useState(false)
  const [showKolExport, setShowKolExport] = useState(false)
  const [showAddCampaign, setShowAddCampaign] = useState(false)
  const [tableKey, setTableKey]           = useState(0)

  const canCreate = session?.user?.permissions?.includes('create_campaign')
  const canUpdate = session?.user?.permissions?.includes('update_campaign')

  // In unified mode the API `type` param comes from the dropdown; in typed mode
  // it's fixed to the prop value.
  const effectiveType = isUnified ? filterType : type

  const loadSummary = useCallback(async () => {
    const params = new URLSearchParams()
    if (effectiveType) params.set('type', effectiveType)
    if (filterMonth)   params.set('filterMonth', filterMonth)
    if (filterDates)   params.set('filterDates', filterDates)
    if (search)        params.set('search', search)
    try {
      const res  = await fetch('/api/campaigns/summary?' + params.toString())
      const text = await res.text()
      setSummaryData(res.ok && text ? JSON.parse(text) : null)
    } catch {
      setSummaryData(null)
    }
  }, [effectiveType, filterMonth, filterDates, search])

  async function handleBulkRefresh() {
    setBulkLoading(true)
    try {
      const res  = await fetch('/api/campaigns/bulk-refresh')
      const data = await res.json()
      toast.success(`Refreshed ${data.processed} campaigns`)
      loadSummary()
    } catch {
      toast.error('Refresh failed')
    } finally {
      setBulkLoading(false)
    }
  }

  function handleReset() {
    setFilterMonth('')
    setFilterDates('')
    setSearch('')
    if (isUnified) setFilterType('')
  }

  return (
    <div className="sv-page">
      {/* Topbar */}
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          {isUnified
            ? <><i className="fas fa-bullhorn text-dark2"></i>{' '}Campaigns</>
            : <><i className={'fas ' + TYPE_ICONS[type]} style={{ color: TYPE_CHIP_COLORS[type] }}></i>{' '}Campaigns</>
          }
        </span>

        {/* Typed-mode chip */}
        {!isUnified && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white"
            style={{ background: TYPE_CHIP_COLORS[type] }}>
            {TYPE_LABELS[type]}
          </span>
        )}

        {canCreate && (
          <button onClick={() => setShowAddCampaign(true)} className="sv-tbtn sv-tbtn-dark">
            <i className="fas fa-plus"></i> Add
          </button>
        )}

        {(type === 'kol' || (isUnified && filterType === 'kol')) && canCreate && (
          <button onClick={() => setShowKolExport(true)} className="sv-tbtn sv-tbtn-success">
            <i className="fas fa-file-excel"></i> Export KOL
          </button>
        )}

        {canUpdate && (
          <button onClick={handleBulkRefresh} disabled={bulkLoading} className="sv-tbtn sv-tbtn-ghost">
            <i className={'fas fa-sync-alt' + (bulkLoading ? ' fa-spin' : '')}></i>
            {bulkLoading ? 'Refreshing...' : 'Bulk Refresh'}
          </button>
        )}

        <CrossLink href="/analytics/campaign-efficiency" label="Analyze" icon="fa-chart-line" />

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {/* Unified-mode: type dropdown filter */}
          {isUnified && (
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="border border-cream rounded text-xs px-2 py-1 h-7 text-dark1 focus:outline-none focus:border-dark2 bg-white">
              <option value="">All Types</option>
              <option value="creative">Creative</option>
              <option value="kol">KOL</option>
              <option value="clipper">Clipper</option>
              <option value="affiliate">Affiliate Talent</option>
            </select>
          )}

          {/* Search by campaign name */}
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="border border-cream rounded text-xs px-2 py-1 text-dark1 focus:outline-none focus:border-dark2 h-7 bg-white w-40" />

          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="border border-cream rounded text-xs px-2 py-1 text-dark1 focus:outline-none focus:border-dark2 h-7 bg-white" />
          <input type="text" value={filterDates} onChange={e => setFilterDates(e.target.value)}
            placeholder="DD/MM/YYYY - DD/MM/YYYY"
            className="border border-cream rounded text-xs px-2 py-1 text-dark1 focus:outline-none focus:border-dark2 h-7 bg-white w-44" />
          <button onClick={handleReset} className="sv-tbtn sv-tbtn-ghost">
            <i className="fas fa-times"></i> Reset
          </button>
        </div>
      </div>

      {/* Sub-type nav — only in typed mode */}
      {!isUnified && <CampaignTypeNav type={type} />}

      {/* KPI Strip */}
      <CampaignKpiStrip
        type={effectiveType}
        filterMonth={filterMonth}
        filterDates={filterDates}
        search={search}
      />

      {/* Main split */}
      <div className="sv-main">
        {/* Table panel */}
        <div className="sv-panel" style={{ flex: '0 0 60%' }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              <i className="fas fa-table text-dark2"></i>
              {isUnified
                ? (filterType ? TYPE_LABELS[filterType] + ' Campaigns' : 'All Campaigns')
                : TYPE_LABELS[type] + ' Campaign Data'}
            </span>
          </div>
          <div className="sv-panel-body p-0">
            <CampaignTable
              key={tableKey}
              type={effectiveType}
              filterMonth={filterMonth}
              filterDates={filterDates}
              search={search}
              showTypeCol={isUnified}
              onDataLoaded={loadSummary}
            />
          </div>
        </div>

        {/* Analytics panel */}
        <div className="sv-panel" style={{ flex: 1 }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              <i className="fas fa-chart-line text-dark2"></i> Campaign Analytics
            </span>
          </div>
          <div className="sv-panel-body p-0">
            <CampaignAnalyticsPanel summaryData={summaryData} />
          </div>
        </div>
      </div>

      <KolExportModal isOpen={showKolExport} onClose={() => setShowKolExport(false)} />
      <AddCampaignModal
        isOpen={showAddCampaign}
        onClose={() => setShowAddCampaign(false)}
        defaultType={isUnified ? (filterType || 'creative') : type}
        onSuccess={() => { setTableKey(k => k + 1); loadSummary() }}
      />
    </div>
  )
}
