'use client'
import { useState, useEffect, useCallback } from 'react'
import DataTable from '@/components/table/DataTable'
import Badge from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync } from '@fortawesome/free-solid-svg-icons'

const CHANNELS = ['meta_ads', 'shopee_ads', 'tiktok_ads', 'lazada_ads']
const CH_LABEL = { meta_ads: 'Meta', shopee_ads: 'Shopee', tiktok_ads: 'TikTok', lazada_ads: 'Lazada' }
const LIMIT = 25

function VarCell({ value, invertSign, isRatio }) {
  if (value == null) return <span className="num text-dark2/40">—</span>
  const isGood = invertSign ? value <= 0 : value >= 0
  const color  = isGood ? 'text-green-600' : 'text-red-500'   // intentional good/bad status color
  const sign   = value >= 0 ? '+' : ''
  const formatted = isRatio
    ? `${sign}${Number(value).toFixed(2)}x`
    : `${sign}${formatCurrency(value)}`
  return <span className={`num font-medium ${color}`}>{formatted}</span>
}

// Map performance status → shared .badge-* variant (no one-off inline colors).
const STATUS_VARIANT = { ahead: 'success', on_track: 'info', behind: 'danger' }
function StatusChip({ value }) {
  if (!value) return <span className="text-dark2/40 text-xs">—</span>
  return <Badge variant={STATUS_VARIANT[value] ?? 'info'}>{value.replace('_', ' ')}</Badge>
}

// Right-aligned numeric value wrapped in the .num helper.
const num = v => <span className="num">{v}</span>
const COLUMNS = [
  { accessorKey: 'date',            header: 'Date',                                  cell: ({ getValue }) => formatDate(getValue()) },
  { accessorKey: 'channel',         header: 'Channel',                               cell: ({ getValue }) => CH_LABEL[getValue()] ?? getValue() },
  { accessorKey: 'spentTarget',     header: () => <span className="num">Spent Target</span>, cell: ({ getValue }) => num(getValue() != null ? formatCurrency(getValue()) : '—') },
  { accessorKey: 'spentActual',     header: () => <span className="num">Spent Actual</span>, cell: ({ getValue }) => num(getValue() != null ? formatCurrency(getValue()) : '—') },
  { accessorKey: 'spentVariance',   header: () => <span className="num">Spent Var</span>,    cell: ({ getValue }) => <VarCell value={getValue()} invertSign /> },
  { accessorKey: 'gmvTarget',       header: () => <span className="num">GMV Target</span>,   cell: ({ getValue }) => num(getValue() != null ? formatCurrency(getValue()) : '—') },
  { accessorKey: 'gmvActual',       header: () => <span className="num">GMV Actual</span>,   cell: ({ getValue }) => num(getValue() != null ? formatCurrency(getValue()) : '—') },
  { accessorKey: 'gmvVariance',     header: () => <span className="num">GMV Var</span>,      cell: ({ getValue }) => <VarCell value={getValue()} /> },
  { accessorKey: 'roasTarget',      header: () => <span className="num">ROAS Target</span>,  cell: ({ getValue }) => num(getValue() != null ? `${Number(getValue()).toFixed(2)}x` : '—') },
  { accessorKey: 'roasActual',      header: () => <span className="num">ROAS Actual</span>,  cell: ({ getValue }) => num(getValue() != null ? `${Number(getValue()).toFixed(2)}x` : '—') },
  { accessorKey: 'roasVariance',    header: () => <span className="num">ROAS Var</span>,     cell: ({ getValue }) => <VarCell value={getValue()} isRatio /> },
  { accessorKey: 'cpaActual',       header: () => <span className="num">CPA</span>,          cell: ({ getValue }) => num(getValue() != null ? formatCurrency(getValue()) : '—') },
  { accessorKey: 'performanceStatus', header: 'Status',                              cell: ({ getValue }) => <StatusChip value={getValue()} /> },
]

export default function AdsMonitoringPanel({ startDate, endDate }) {
  const [rows, setRows]           = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(false)
  const [syncing, setSyncing]     = useState(null)
  const [syncStatus, setSyncStatus] = useState({})

  const fetchStatus = useCallback(() => {
    fetch('/api/ad-spent/monitoring/refresh/status')
      .then(r => r.json())
      .then(d => { if (d.status) setSyncStatus(d.status) })
      .catch(() => {})
  }, [])

  const fetchRows = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: LIMIT })
    if (startDate) params.set('startDate', startDate)
    if (endDate)   params.set('endDate', endDate)
    fetch(`/api/ad-spent/monitoring?${params}`)
      .then(r => r.json())
      .then(d => { setRows(d.data ?? []); setTotal(d.total ?? 0); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page, startDate, endDate])

  useEffect(() => { fetchRows() }, [fetchRows])
  useEffect(() => { fetchStatus() }, [fetchStatus])

  async function refreshOne(channel) {
    setSyncing(channel)
    const tid = toast.loading(`Refreshing ${CH_LABEL[channel]}...`)
    try {
      const r = await fetch(`/api/ad-spent/monitoring/refresh/${channel}`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Failed')
      toast.success(`${CH_LABEL[channel]} synced — ${d.datesSync} dates`, { id: tid })
      fetchRows()
      fetchStatus()
    } catch (e) {
      toast.error(e.message, { id: tid })
    } finally {
      setSyncing(null)
    }
  }

  async function refreshAll() {
    setSyncing('all')
    const tid = toast.loading('Refreshing all channels...')
    try {
      const r = await fetch('/api/ad-spent/monitoring/refresh/all', { method: 'POST' })
      const d = await r.json()
      const ok = Object.values(d.results ?? {}).filter(v => v.status === 'ok').length
      toast.success(`All channels refreshed — ${ok}/4 succeeded`, { id: tid })
      fetchRows()
      fetchStatus()
    } catch (e) {
      toast.error(e.message, { id: tid })
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="sv-panel mt-0">
      <div className="sv-panel-header flex items-center justify-between flex-wrap gap-2">
        <span>Ads Monitoring — {total} records</span>
        <div className="flex gap-2 items-center flex-wrap">
          {CHANNELS.map(ch => (
            <button key={ch} onClick={() => refreshOne(ch)} disabled={!!syncing}
              className="btn btn-outline btn-sm flex items-center gap-1">
              <FontAwesomeIcon icon={faSync} className={syncing === ch ? 'animate-spin' : ''} />
              {CH_LABEL[ch]}
            </button>
          ))}
          <button onClick={refreshAll} disabled={!!syncing}
            className="btn btn-primary btn-sm flex items-center gap-1">
            <FontAwesomeIcon icon={faSync} className={syncing === 'all' ? 'animate-spin' : ''} />
            Refresh All
          </button>
        </div>
      </div>

      <div className="flex gap-4 px-4 py-1 text-xs text-dark2/50 border-b border-cream">
        {CHANNELS.map(ch => (
          <span key={ch}>
            {CH_LABEL[ch]}: {syncStatus[ch]
              ? new Date(syncStatus[ch]).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
              : 'never'}
          </span>
        ))}
      </div>

      <div className="sv-panel-body overflow-x-auto">
        <DataTable columns={COLUMNS} data={rows} total={total} page={page} limit={LIMIT}
          onPageChange={setPage} loading={loading} variant="clean" />
      </div>
    </div>
  )
}
