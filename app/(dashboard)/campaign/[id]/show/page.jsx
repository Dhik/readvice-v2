'use client'
import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'

// Lazy-import all sub-components
import CampaignShowHeader from '@/components/campaign/show/CampaignShowHeader'
import StatisticFilters from '@/components/campaign/show/StatisticFilters'
import CampaignKpiRows from '@/components/campaign/show/CampaignKpiRows'
import PerformanceChart from '@/components/campaign/show/PerformanceChart'
import TopPerformersPanel from '@/components/campaign/show/TopPerformersPanel'
import TopProductsTable from '@/components/campaign/show/TopProductsTable'
import ContentActionBar from '@/components/campaign/show/ContentActionBar'
import ContentTable from '@/components/campaign/show/ContentTable'
import AddContentModal from '@/components/campaign/show/modals/AddContentModal'
import UpdateContentModal from '@/components/campaign/show/modals/UpdateContentModal'
import DetailAnalyticsModal from '@/components/campaign/show/modals/DetailAnalyticsModal'
import RefreshStatsModal from '@/components/campaign/show/modals/RefreshStatsModal'
import RefreshFollowersModal from '@/components/campaign/show/modals/RefreshFollowersModal'
import ImportContentModal from '@/components/campaign/show/modals/ImportContentModal'
import ImportKolContentModal from '@/components/campaign/show/modals/ImportKolContentModal'

export default function CampaignShowPage({ params }) {
  const { id: campaignId } = use(params)

  // Campaign data
  const [campaign, setCampaign] = useState(null)
  const [kpiData, setKpiData]   = useState(null)
  const [kpiLoading, setKpiLoading] = useState(true)
  const [chartData, setChartData]   = useState([])

  // Shared stat filters
  const [filterDates, setFilterDates] = useState('')
  const [filterPic,   setFilterPic]   = useState('')

  // Content-table filters
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterFyp,      setFilterFyp]      = useState(false)
  const [filterPayment,  setFilterPayment]  = useState(false)
  const [filterDelivery, setFilterDelivery] = useState(false)

  // Modal state
  const [showAdd,              setShowAdd]              = useState(false)
  const [showUpdate,           setShowUpdate]           = useState(false)
  const [editContent,          setEditContent]          = useState(null)
  const [showDetail,           setShowDetail]           = useState(false)
  const [detailId,             setDetailId]             = useState(null)
  const [showRefreshStats,     setShowRefreshStats]     = useState(false)
  const [showRefreshFollowers, setShowRefreshFollowers] = useState(false)
  const [showImport,           setShowImport]           = useState(false)
  const [showImportKol,        setShowImportKol]        = useState(false)
  const [contentKey,           setContentKey]           = useState(0)

  // Fetch campaign details
  useEffect(() => {
    if (!campaignId) return
    fetch(`/api/campaigns/${campaignId}`)
      .then(r => r.json())
      .then(setCampaign)
  }, [campaignId])

  // Fetch KPI + chart data whenever stat filters change
  const loadStats = useCallback(async () => {
    if (!campaignId) return
    setKpiLoading(true)
    const params = new URLSearchParams()
    if (filterDates) params.set('filterDates', filterDates)
    if (filterPic)   params.set('filterPic', filterPic)
    const qs = params.toString() ? '?' + params.toString() : ''
    try {
      const [kpi, chart] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}/statistic-card${qs}`).then(r => r.json()),
        fetch(`/api/campaigns/${campaignId}/statistic-chart${qs}`).then(r => r.json()),
      ])
      setKpiData(kpi)
      setChartData(Array.isArray(chart) ? chart : [])
    } catch (e) {
      console.error('Stats load error', e)
    } finally {
      setKpiLoading(false)
    }
  }, [campaignId, filterDates, filterPic])

  useEffect(() => { loadStats() }, [loadStats])

  function handleStatReset() { setFilterDates(''); setFilterPic('') }
  function refreshContent()  { setContentKey(k => k + 1) }

  function handleEdit(row)   { setEditContent(row); setShowUpdate(true) }
  function handleDetail(id)  { setDetailId(id); setShowDetail(true) }

  return (
    <div style={{ background: 'var(--bg)', minHeight: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column' }}>

      <CampaignShowHeader campaign={campaign} />

      <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>

        <StatisticFilters
          filterDates={filterDates} setFilterDates={setFilterDates}
          filterPic={filterPic}     setFilterPic={setFilterPic}
          onReset={handleStatReset}
        />

        <CampaignKpiRows data={kpiData} loading={kpiLoading} />

        <div style={{ display: 'flex', gap: '10px', minHeight: '360px' }}>
          <PerformanceChart chartData={chartData} />
          <TopPerformersPanel data={kpiData} />
        </div>

        <TopProductsTable data={kpiData?.top_product ?? []} />

        <div className="sv-section-card">
            <ContentActionBar
              campaignId={campaignId}
              campaignTitle={campaign?.title ?? ''}
              filterPlatform={filterPlatform} setFilterPlatform={setFilterPlatform}
              filterFyp={filterFyp}           setFilterFyp={setFilterFyp}
              filterPayment={filterPayment}   setFilterPayment={setFilterPayment}
              filterDelivery={filterDelivery} setFilterDelivery={setFilterDelivery}
              onAdd={() => setShowAdd(true)}
              onRefreshStats={() => setShowRefreshStats(true)}
              onRefreshFollowers={() => setShowRefreshFollowers(true)}
              onImport={() => setShowImport(true)}
              onImportKol={() => setShowImportKol(true)}
            />
            <ContentTable
              key={contentKey}
              campaignId={campaignId}
              filterPlatform={filterPlatform}
              filterFyp={filterFyp}
              filterPayment={filterPayment}
              filterDelivery={filterDelivery}
              filterPic={filterPic}
              onEdit={handleEdit}
              onDetail={handleDetail}
            />
        </div>
      </div>

      {/* Modals */}
      <AddContentModal
        isOpen={showAdd} onClose={() => setShowAdd(false)}
        campaignId={campaignId} onSuccess={refreshContent}
      />
      <UpdateContentModal
        isOpen={showUpdate} onClose={() => setShowUpdate(false)}
        content={editContent} onSuccess={refreshContent}
      />
      <DetailAnalyticsModal
        isOpen={showDetail} onClose={() => setShowDetail(false)}
        contentId={detailId}
      />
      <RefreshStatsModal
        isOpen={showRefreshStats} onClose={() => setShowRefreshStats(false)}
        campaignId={campaignId} onComplete={refreshContent}
      />
      <RefreshFollowersModal
        isOpen={showRefreshFollowers} onClose={() => setShowRefreshFollowers(false)}
        campaignId={campaignId}
      />
      <ImportContentModal
        isOpen={showImport} onClose={() => setShowImport(false)}
        campaignId={campaignId} onSuccess={refreshContent}
      />
      <ImportKolContentModal
        isOpen={showImportKol} onClose={() => setShowImportKol(false)}
        campaignId={campaignId} onSuccess={refreshContent}
      />
    </div>
  )
}
