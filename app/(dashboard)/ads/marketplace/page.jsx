'use client'
import { useEffect, useMemo, useState } from 'react'
import KpiStrip from '@/components/ui/KpiStrip'
import DataTable from '@/components/table/DataTable'
import AdsAnalyticsPanel from '@/components/ads/AdsAnalyticsPanel'
import ImportModal from '@/components/ui/ImportModal'
import DateRangePicker from '@/components/ui/DateRangePicker'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload } from '@fortawesome/free-solid-svg-icons'
import AdsMonitoringPanel from '@/components/ads/AdsMonitoringPanel'
import RoasAnalysisPanel from '@/components/ads/RoasAnalysisPanel'
import AdSpentEditModal from '@/components/ads/AdSpentEditModal'
import MetaFunnelPanel from '@/components/ads/MetaFunnelPanel'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'

const PLATFORMS = ['Meta', 'Shopee', 'TikTok', 'Lazada']
const LIMIT = 25


export default function AdMarketplacePage() {
  const [platform, setPlatform]     = useState('Meta')
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [page, setPage]             = useState(1)
  const [data, setData]             = useState([])
  const [total, setTotal]           = useState(0)
  const [summary, setSummary]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [showImport, setShowImport]         = useState(false)
  const [showMonitoring, setShowMonitoring] = useState(false)
  const [showRoas, setShowRoas]             = useState(false)
  const [editRow, setEditRow]               = useState(null)
  const [showEdit, setShowEdit]             = useState(false)
  const [refreshKey, setRefreshKey]         = useState(0)
  const [donutSpends, setDonutSpends] = useState([0, 0, 0, 0])
  const [kpiData, setKpiData]         = useState(null)

  const endpoint = `/api/ad-spent/${platform.toLowerCase()}`

  // KPI strip: fetch platform-specific aggregates on platform/date change
  useEffect(() => {
    setKpiData(null)
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate)   params.set('endDate', endDate)
    fetch(`/api/ad-spent/${platform.toLowerCase()}/kpi?${params}`)
      .then(r => r.json())
      .then(d => setKpiData(d))
      .catch(() => {})
  }, [platform, startDate, endDate, refreshKey])

  // Fetch cross-platform spend totals for the donut whenever the date range changes
  useEffect(() => {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate)   params.set('endDate', endDate)
    fetch(`/api/ad-spent/summary?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.byPlatform) {
          const order = ['meta', 'shopee', 'tiktok', 'lazada']
          setDonutSpends(order.map(p => d.byPlatform.find(x => x.platform === p)?.spent ?? 0))
        }
      })
      .catch(() => {})
  }, [startDate, endDate])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (startDate) params.set('startDate', startDate)
    if (endDate)   params.set('endDate', endDate)
    fetch(`${endpoint}?${params}`)
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setTotal(d.total ?? 0); setSummary(d.summary); setLoading(false) })
      .catch(() => setLoading(false))
  }, [platform, startDate, endDate, page, refreshKey])

  const isLazada         = platform === 'Lazada'
  const isOrdersPlatform = platform === 'Shopee' || platform === 'Lazada'

  const adColumns = useMemo(() => {
    const lazada = platform === 'Lazada'
    // Right-aligned numeric columns (header + cell wrapped in the .num helper).
    return [
      { accessorKey: 'date',    header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
      { accessorKey: 'spent',   header: () => <span className="num">Spent</span>,   cell: ({ getValue }) => <span className="num">{formatCurrency(Number(getValue() ?? 0))}</span> },
      ...(!lazada ? [
        { accessorKey: 'impressions', header: () => <span className="num">Impressions</span>, cell: ({ getValue }) => <span className="num">{formatNumber(Number(getValue() ?? 0))}</span> },
      ] : []),
      { accessorKey: 'clicks',  header: () => <span className="num">Clicks</span>,  cell: ({ getValue }) => <span className="num">{formatNumber(getValue() ?? 0)}</span> },
      ...(!lazada ? [
        { accessorKey: 'ctr',   header: () => <span className="num">CTR</span>,     cell: ({ getValue }) => <span className="num">{getValue() ? `${(Number(getValue())*100).toFixed(2)}%` : '—'}</span> },
      ] : []),
      { accessorKey: 'roas',    header: () => <span className="num">ROAS</span>,    cell: ({ getValue }) => <span className="num">{getValue() ? `${Number(getValue()).toFixed(2)}x` : '—'}</span> },
      { accessorKey: 'revenue', header: () => <span className="num">Revenue</span>, cell: ({ getValue }) => <span className="num">{getValue() ? formatCurrency(Number(getValue())) : '—'}</span> },
    ]
  }, [platform])

  const kpiTiles = [
    { label: 'Total Spent',   value: formatCurrency(kpiData?.totalSpent   ?? 0), icon: 'fa-wallet',           accent: '#2C3639' },
    { label: 'Total Revenue', value: formatCurrency(kpiData?.totalRevenue ?? 0), icon: 'fa-hand-holding-usd', accent: '#E07B39' },
    { label: 'Avg ROAS',      value: kpiData?.avgRoas != null ? `${Number(kpiData.avgRoas).toFixed(2)}x` : '—', icon: 'fa-chart-line', accent: '#3F4E4F' },
    { label: 'Avg CPC',       value: kpiData?.avgCpc  != null ? formatCurrency(Number(kpiData.avgCpc)) : '—',  icon: 'fa-coins',     accent: '#2C3639' },
    // Lazada has no impressions or ctr column — omit those tiles entirely
    ...(!isLazada ? [
      { label: 'Avg CTR',     value: kpiData?.avgCtr != null ? `${(Number(kpiData.avgCtr) * 100).toFixed(2)}%` : '—', icon: 'fa-bullseye',    accent: '#3F4E4F' },
      { label: 'Impressions', value: formatNumber(kpiData?.totalImpressions ?? 0),                                     icon: 'fa-eye',         accent: '#3F4E4F' },
    ] : []),
    { label: 'Clicks',        value: formatNumber(kpiData?.totalClicks ?? 0), icon: 'fa-hand-pointer', accent: '#2C3639' },
    { label: isOrdersPlatform ? 'Orders' : 'Conversions',
      value: formatNumber(isOrdersPlatform ? (kpiData?.totalOrders ?? 0) : (kpiData?.totalConversions ?? 0)),
      icon: isOrdersPlatform ? 'fa-shopping-cart' : 'fa-check-circle', accent: '#E07B39' },
  ]

  async function handleDeleteRow(id) {
    const result = await Swal.fire({
      title: 'Delete record?',
      text:  'This will permanently remove the ad spend entry.',
      icon:  'warning',
      showCancelButton:   true,
      confirmButtonColor: '#dc3545',
      confirmButtonText:  'Delete',
    })
    if (!result.isConfirmed) return
    const res = await fetch(`/api/ad-spent/${platform.toLowerCase()}/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Record deleted')
      setRefreshKey(k => k + 1)
    } else {
      toast.error('Delete failed')
    }
  }

  const actionsColumn = {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="flex gap-1 justify-end">
        <button
          onClick={() => { setEditRow(row.original); setShowEdit(true) }}
          title="Edit"
          className="w-[26px] h-[26px] rounded flex items-center justify-center text-white bg-orange hover:bg-[#c9662a] text-[10px]">
          <i className="fas fa-pencil-alt" />
        </button>
        <button
          onClick={() => handleDeleteRow(row.original.id)}
          title="Delete"
          className="w-[26px] h-[26px] rounded flex items-center justify-center border border-cream text-red-500 hover:bg-red-50 text-[10px]">
          <i className="fas fa-trash-alt" />
        </button>
      </div>
    ),
  }

  return (
    <div className="bg-bg flex flex-col" style={{ minHeight: 'calc(100vh - 54px)' }}>
      <div className="flex flex-col gap-2.5 px-4 pt-3 pb-4">

        <div className="sv-topbar">
          <div className="flex gap-1 tab-pills">
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => { setPlatform(p); setPage(1); setShowMonitoring(false); setShowRoas(false) }}
                className={`tab-pill ${p === platform && !showMonitoring && !showRoas ? 'active' : ''}`}>{p}</button>
            ))}
            <button onClick={() => { setShowMonitoring(true); setShowRoas(false) }}
              className={`tab-pill ${showMonitoring ? 'active' : ''}`}>Monitoring</button>
            <button onClick={() => { setShowRoas(true); setShowMonitoring(false) }}
              className={`tab-pill ${showRoas ? 'active' : ''}`}>ROAS</button>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <DateRangePicker label="Date" startDate={startDate} endDate={endDate}
              onStartChange={v => { setStartDate(v); setPage(1) }}
              onEndChange={v => { setEndDate(v); setPage(1) }} />
            <button onClick={() => setShowImport(true)} className="btn btn-outline btn-sm">
              <FontAwesomeIcon icon={faUpload} /> Import
            </button>
          </div>
        </div>

        {showRoas ? (
          <RoasAnalysisPanel startDate={startDate} endDate={endDate} />
        ) : showMonitoring ? (
          <AdsMonitoringPanel startDate={startDate} endDate={endDate} />
        ) : (
          <>
            <KpiStrip tiles={kpiTiles} cols={kpiTiles.length} />

            <div className="flex gap-2 min-h-[360px]">
              <div className="sv-table-panel">
                <div className="sv-panel-header">{platform} Ad Spend — {total} records</div>
                <div className="sv-panel-body">
                  <DataTable columns={[...adColumns, actionsColumn]} data={data} total={total} page={page} limit={LIMIT}
                    onPageChange={setPage} loading={loading} variant="clean" />
                </div>
              </div>
              <div className="sv-panel" style={{ flex: 1 }}>
                <div className="sv-panel-header">
                  <span className="sv-panel-title">
                    <i className="fas fa-chart-line text-dark2" />
                    Analytics
                  </span>
                </div>
                <div className="sv-panel-body p-0">
                  <AdsAnalyticsPanel kpiData={kpiData} donutSpends={donutSpends} />
                </div>
              </div>
            </div>

            {platform === 'Meta' && (
              <MetaFunnelPanel startDate={startDate} endDate={endDate} refreshKey={refreshKey} />
            )}

            {showImport && (
              <ImportModal title={`Import ${platform} Ad Spend`}
                endpoint={`/api/import/ad-spent?platform=${platform.toLowerCase()}`}
                onSuccess={() => setPage(1)} onClose={() => setShowImport(false)} />
            )}
          </>
        )}

      </div>

      <AdSpentEditModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={() => setRefreshKey(k => k + 1)}
        row={editRow}
        platform={platform}
      />
    </div>
  )
}
