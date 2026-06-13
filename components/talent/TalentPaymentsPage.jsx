'use client'
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

const TYPE_COLORS = {
  Affiliate:         '#E07B39',
  KOL:               '#2C3639',
  'Content Creator': '#3F4E4F',
  Clipper:           '#8B5E3C',
}

const STATUS_OPTS = ['Full Payment','DP 50%','Pelunasan 50%','Termin 1','Termin 2','Termin 3']
const TYPES       = ['Affiliate','KOL','Content Creator','Clipper']
const LIMIT       = 50

function fmtRp(n) {
  if (!n && n !== 0) return '—'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n))
}

function fmtRpShort(n) {
  if (!n && n !== 0) return 'Rp 0'
  const num = Number(n)
  if (num >= 1_000_000_000) return 'Rp ' + (num / 1_000_000_000).toFixed(1) + 'B'
  if (num >= 1_000_000)     return 'Rp ' + (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000)         return 'Rp ' + (num / 1_000).toFixed(0) + 'K'
  return 'Rp ' + num
}

function statusBadge(status) {
  if (!status) return <span className="badge">—</span>
  if (status.includes('50%') && !status.includes('Pelunasan'))
    return <span className="badge badge-warning">{status}</span>
  if (status === 'Full Payment' || status.includes('Pelunasan'))
    return <span className="badge badge-success">{status}</span>
  return <span className="badge">{status}</span>
}

/* ── Payment Summary Panel (default right panel) ── */
function PaymentSummaryPanel({ kpi, payments }) {
  const statusCounts = {}
  for (const p of payments) {
    const s = p.status_payment || 'Unknown'
    statusCounts[s] = (statusCounts[s] || 0) + 1
  }
  const total      = payments.length
  const recentPaid = payments.filter(p => p.done_payment && p.amount_tf).slice(0, 5)

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Financial overview */}
      <div className="p-2.5 border-b border-cream/60 flex-shrink-0">
        <div className="text-[9px] font-bold text-dark1/40 uppercase tracking-widest mb-2">Financial Overview</div>
        <div
          className="rounded-lg p-2.5 text-white mb-1.5"
          style={{ background: '#2C3639' }}
        >
          <div className="text-[9px] text-white/50 uppercase tracking-wide mb-0.5">Total Spent</div>
          <div className="text-base font-bold leading-tight">{kpi ? fmtRpShort(kpi.total_spent) : '…'}</div>
          <div className="text-[10px] text-white/40 mt-0.5">{kpi ? fmtRp(kpi.total_spent) : ''}</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-red-50 border border-red-100 rounded-lg p-2">
            <div className="text-[9px] text-red-400 uppercase tracking-wide mb-0.5">Hutang</div>
            <div className="text-sm font-bold text-red-600 leading-tight">{kpi ? fmtRpShort(kpi.total_hutang) : '…'}</div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-lg p-2">
            <div className="text-[9px] text-green-500 uppercase tracking-wide mb-0.5">Piutang</div>
            <div className="text-sm font-bold text-green-700 leading-tight">{kpi ? fmtRpShort(kpi.total_piutang) : '…'}</div>
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      {total > 0 && (
        <div className="p-2.5 border-b border-cream/60 flex-shrink-0">
          <div className="text-[9px] font-bold text-dark1/40 uppercase tracking-widest mb-2">
            Status Breakdown — {total} on page
          </div>
          <div className="flex flex-col gap-2">
            {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
              const pct     = Math.round(count / total * 100)
              const isGood  = status === 'Full Payment' || status.includes('Pelunasan')
              const isWarn  = status.includes('50%') && !status.includes('Pelunasan')
              const barColor = isGood ? '#22c55e' : isWarn ? '#f59e0b' : '#2C3639'
              return (
                <div key={status}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-dark2 font-medium truncate max-w-[130px]">{status}</span>
                    <span className="text-[10px] text-dark1/40 ml-1">{count} · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-cream/70 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent payments */}
      <div className="p-2.5 flex-1">
        <div className="text-[9px] font-bold text-dark1/40 uppercase tracking-widest mb-2">Recent Payments</div>
        {recentPaid.length === 0 ? (
          <div className="text-[10px] text-dark1/30 text-center py-4">No payment data</div>
        ) : recentPaid.map(p => (
          <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-cream/40 last:border-0">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: TYPE_COLORS[p.type] ?? '#888' }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-dark1 truncate">@{p.username}</div>
              <div className="text-[9px] text-dark1/40">{p.done_payment}</div>
            </div>
            <div className="text-[10px] font-bold text-orange whitespace-nowrap">{fmtRpShort(p.amount_tf)}</div>
          </div>
        ))}

        {total === 0 && !kpi && (
          <div className="mt-4 text-center text-dark1/20 text-xs">Select a filter or click a row to edit</div>
        )}
      </div>
    </div>
  )
}

/* ── Payment Edit Panel (when row selected) ── */
function PaymentEditPanel({ payment, onClose, onSaved, onDelete }) {
  const [form, setForm] = useState({
    status_payment: payment.status_payment ?? '',
    done_payment:   payment.done_payment
      ? payment.done_payment.split('/').reverse().join('-')
      : '',
    amount_tf: payment.amount_tf ?? '',
  })
  const [saving, setSaving] = useState(false)
  const typeColor = TYPE_COLORS[payment.type] ?? '#888'

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/talent-payments/${payment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Saved')
      onSaved()
      onClose()
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="px-3 py-2.5 flex-shrink-0 border-b border-cream/60"
        style={{ borderLeft: `4px solid ${typeColor}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold text-dark1 truncate">@{payment.username}</div>
            <div className="text-[10px] text-dark1/50 truncate">{payment.talent_name}</div>
            <span
              className="mt-1 inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded text-white"
              style={{ background: typeColor }}
            >
              {payment.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-dark1/30 hover:text-dark1 text-base leading-none mt-0.5 flex-shrink-0"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Form + info */}
      <div className="flex-1 overflow-auto p-3 flex flex-col gap-2.5">
        <div className="text-[9px] font-bold text-dark1/40 uppercase tracking-widest">Edit Payment</div>

        {/* Nama Rekening (read-only) */}
        <div>
          <div className="text-[9px] font-semibold text-dark1/40 uppercase tracking-wide mb-0.5">Nama Rekening</div>
          <div className="bg-bg rounded px-2 py-1.5 text-[11px] text-dark1">{payment.nama_rekening || '—'}</div>
        </div>

        {/* Status Payment */}
        <div>
          <div className="text-[9px] font-semibold text-dark1/40 uppercase tracking-wide mb-0.5">Status Payment</div>
          <select
            className="form-input text-xs h-7 w-full"
            value={form.status_payment}
            onChange={e => setForm(p => ({ ...p, status_payment: e.target.value }))}
          >
            <option value="">— Select —</option>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Done Payment */}
        <div>
          <div className="text-[9px] font-semibold text-dark1/40 uppercase tracking-wide mb-0.5">Done Payment</div>
          <input
            type="date"
            className="form-input text-xs h-7 w-full"
            value={form.done_payment}
            onChange={e => setForm(p => ({ ...p, done_payment: e.target.value }))}
          />
        </div>

        {/* Amount TF */}
        <div>
          <div className="text-[9px] font-semibold text-dark1/40 uppercase tracking-wide mb-0.5">Amount TF (Rp)</div>
          <input
            type="number"
            className="form-input text-xs h-7 w-full"
            value={form.amount_tf}
            onChange={e => setForm(p => ({ ...p, amount_tf: e.target.value }))}
          />
        </div>

        {/* Read-only details */}
        <div className="mt-1 pt-2 border-t border-cream/60">
          <div className="text-[9px] font-bold text-dark1/40 uppercase tracking-widest mb-1.5">Details</div>
          {[
            ['PIC',           payment.pic],
            ['Tgl Pengajuan', payment.tanggal_pengajuan],
          ].filter(([, v]) => v).map(([label, val]) => (
            <div key={label} className="flex justify-between py-0.5">
              <span className="text-[10px] text-dark1/40">{label}</span>
              <span className="text-[10px] font-medium text-dark1">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex gap-1.5 px-3 py-2 border-t border-cream/60 flex-shrink-0">
        <button
          onClick={() => onDelete(payment.id)}
          className="sv-tbtn"
          style={{ color: '#dc3545', borderColor: '#fca5a5', background: 'transparent' }}
          title="Delete"
        >
          <i className="fas fa-trash-alt text-[10px]"></i>
        </button>
        <button onClick={onClose} className="sv-tbtn sv-tbtn-ghost flex-1">Cancel</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="sv-tbtn sv-tbtn-primary flex-1"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function TalentPaymentsPage() {
  const [payments, setPayments]       = useState([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(true)
  const [typeFilter, setType]         = useState('')
  const [statusFilter, setStatus]     = useState('')
  const [usernameFilter, setUsername] = useState('')
  const [panelItem, setPanelItem]     = useState(null)
  const [kpi, setKpi]                 = useState(null)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page, limit: LIMIT })
      if (typeFilter)     p.set('type',           typeFilter)
      if (statusFilter)   p.set('status_payment', statusFilter)
      if (usernameFilter) p.set('username',        usernameFilter)
      const res  = await fetch('/api/talent-payments?' + p)
      const data = await res.json()
      setPayments(data.data ?? [])
      setTotal(data.total  ?? 0)
    } catch {} finally { setLoading(false) }
  }, [page, typeFilter, statusFilter, usernameFilter])

  const loadKpi = useCallback(async () => {
    try {
      const p = new URLSearchParams()
      if (usernameFilter) p.set('username',   usernameFilter)
      if (typeFilter)     p.set('talentType', typeFilter)
      const res  = await fetch('/api/talent-payments/kpi?' + p)
      const data = await res.json()
      setKpi(data.totals ?? null)
    } catch {}
  }, [usernameFilter, typeFilter])

  useEffect(() => { loadPayments() }, [loadPayments])
  useEffect(() => { loadKpi() },      [loadKpi])

  async function handleDelete(id) {
    if (!confirm('Delete this payment?')) return
    try {
      await fetch(`/api/talent-payments/${id}`, { method: 'DELETE' })
      toast.success('Deleted')
      if (panelItem?.id === id) setPanelItem(null)
      loadPayments()
      loadKpi()
    } catch { toast.error('Failed') }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="sv-page p-3 gap-2">

      {/* Topbar */}
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          <i className="fas fa-money-bill-wave text-orange mr-1"></i> Payments
        </span>

        {/* Type tabs */}
        {['', ...TYPES].map(t => {
          const color  = t ? (TYPE_COLORS[t] ?? '#888') : null
          const active = typeFilter === t
          return (
            <button
              key={t || 'all-type'}
              onClick={() => { setType(t); setPage(1); setPanelItem(null) }}
              className="sv-tbtn"
              style={active
                ? { background: color ?? '#2C3639', borderColor: color ?? '#2C3639', color: '#fff' }
                : { background: 'transparent', borderColor: '#ddd', color: '#666' }
              }
            >
              {t
                ? <><span className="inline-block w-2 h-2 rounded-full mr-1 flex-shrink-0" style={{ background: color }} />{t}</>
                : 'All'
              }
            </button>
          )
        })}

        <div className="w-px h-5 bg-cream/80 mx-0.5" />

        {/* Status dropdown */}
        <select
          className="form-input text-xs h-7 w-36"
          value={statusFilter}
          onChange={e => { setStatus(e.target.value); setPage(1); setPanelItem(null) }}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Username search */}
        <input
          type="text"
          placeholder="@username..."
          className="form-input text-xs h-7 w-28"
          value={usernameFilter}
          onChange={e => { setUsername(e.target.value); setPage(1); setPanelItem(null) }}
        />

        {/* Clear */}
        <button
          onClick={() => { setType(''); setStatus(''); setUsername(''); setPage(1); setPanelItem(null) }}
          className="sv-tbtn sv-tbtn-ghost"
          title="Clear filters"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      {/* KPI strip */}
      <div
        className="sv-kpi-strip"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}
      >
        {[
          { label: 'Total Spent',   value: kpi ? fmtRpShort(kpi.total_spent)   : '…', icon: 'fa-coins',             bg: '#E07B39' },
          { label: 'Total Hutang',  value: kpi ? fmtRpShort(kpi.total_hutang)  : '…', icon: 'fa-arrow-circle-down', bg: '#dc3545' },
          { label: 'Total Piutang', value: kpi ? fmtRpShort(kpi.total_piutang) : '…', icon: 'fa-arrow-circle-up',   bg: '#22c55e' },
        ].map(t => (
          <div key={t.label} className="kpi-tile">
            <div className="kpi-tile-icon" style={{ background: t.bg }}>
              <i className={`fas ${t.icon}`}></i>
            </div>
            <div className="min-w-0">
              <div className="kpi-tile-label">{t.label}</div>
              <div className="kpi-tile-value">{t.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main split */}
      <div className="sv-main">

        {/* Table panel */}
        <div className="sv-panel" style={{ flex: '0 0 63%' }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              <i className="fas fa-list text-orange/70"></i> Payment Records
            </span>
            <span className="text-[10px] text-dark1/40">{total} records · p.{page}</span>
          </div>
          <div className="sv-panel-body p-0">
            <table className="sv-table w-full">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Nama Rekening</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>PIC</th>
                  <th>Done</th>
                  <th>Amount TF</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-dark1/40">Loading…</td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-dark1/40">No payment records</td></tr>
                ) : payments.map(p => {
                  const tc         = TYPE_COLORS[p.type] ?? '#888'
                  const isSelected = panelItem?.id === p.id
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setPanelItem(isSelected ? null : p)}
                      className="cursor-pointer"
                      style={{
                        borderLeft: `3px solid ${tc}`,
                        background: isSelected ? 'rgba(44,54,57,.06)' : undefined,
                      }}
                    >
                      <td className="font-semibold text-dark1">@{p.username}</td>
                      <td
                        className="text-dark1/70"
                        style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {p.nama_rekening || '—'}
                      </td>
                      <td>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white whitespace-nowrap"
                          style={{ background: tc }}
                        >
                          {p.type}
                        </span>
                      </td>
                      <td>{statusBadge(p.status_payment)}</td>
                      <td className="text-dark1/60">{p.pic || '—'}</td>
                      <td className="text-dark1/60 whitespace-nowrap">{p.done_payment ?? '—'}</td>
                      <td className="font-bold text-orange whitespace-nowrap">{fmtRpShort(p.amount_tf)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="sv-tbtn"
                          style={{ color: '#dc3545', borderColor: 'transparent', background: 'transparent' }}
                          title="Delete"
                        >
                          <i className="fas fa-trash-alt text-[10px]"></i>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-cream/60 text-xs flex-shrink-0">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="sv-tbtn sv-tbtn-ghost"
              >‹</button>
              <span className="text-dark1/50">Page {page} / {pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="sv-tbtn sv-tbtn-ghost"
              >›</button>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="sv-panel" style={{ flex: 1 }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              <i className={`fas ${panelItem ? 'fa-edit' : 'fa-chart-bar'} text-orange/70`}></i>
              &nbsp;{panelItem ? 'Edit Payment' : 'Overview'}
            </span>
            {panelItem && (
              <button
                onClick={() => setPanelItem(null)}
                className="text-[10px] text-dark1/40 hover:text-dark1"
              >
                ← Back
              </button>
            )}
          </div>
          {panelItem ? (
            <PaymentEditPanel
              payment={panelItem}
              onClose={() => setPanelItem(null)}
              onSaved={() => { loadPayments(); loadKpi() }}
              onDelete={handleDelete}
            />
          ) : (
            <PaymentSummaryPanel kpi={kpi} payments={payments} />
          )}
        </div>

      </div>
    </div>
  )
}
