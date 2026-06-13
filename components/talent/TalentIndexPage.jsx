'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const TYPES     = ['Affiliate', 'KOL', 'Content Creator', 'Clipper']
const PLATFORMS = ['Instagram', 'Tiktok', 'Twitter', 'Youtube', 'Shopee']
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December']
const LIMIT     = 25

const TYPE_COLORS = {
  Affiliate:         '#E07B39',
  KOL:               '#2C3639',
  'Content Creator': '#3F4E4F',
  Clipper:           '#8B5E3C',
}

const KPI_TILES = [
  { key: 'total_talents',    label: 'Talents',  icon: 'fa-id-card',     bg: '#2C3639' },
  { key: 'total_dp_amount',  label: 'DP Total', icon: 'fa-money-bill',  bg: '#E07B39', fmt: true },
  { key: 'total_rate_final', label: 'Rate Sum', icon: 'fa-dollar-sign', bg: '#3F4E4F', fmt: true },
  { key: 'total_slot_final', label: 'Slots',    icon: 'fa-layer-group', bg: '#2C3639' },
  { key: 'actual_uploaded',  label: 'Uploaded', icon: 'fa-upload',      bg: '#E07B39' },
]

function fmtRp(n) {
  if (!n && n !== 0) return '-'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n))
}

/* ── Right panel: Quick Stats (idle) ─────────────────────── */
function QuickStatsPanel({ talents, kpi, kpiLoading }) {
  const byType = {}
  for (const t of talents) byType[t.type] = (byType[t.type] ?? 0) + 1
  const pageTotal = talents.length

  const topByRate = [...talents]
    .filter(t => t.rate_final)
    .sort((a, b) => Number(b.rate_final) - Number(a.rate_final))
    .slice(0, 5)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Global KPIs dark card */}
      <div className="m-2.5 rounded-lg bg-dark1 text-white p-3 flex-shrink-0">
        <div className="text-[9px] uppercase tracking-widest text-cream/40 mb-2.5 font-semibold">Since Jul 2025</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { label: 'Total Talents',  value: kpi?.total_talents    ?? '—' },
            { label: 'Actual Uploads', value: kpi?.actual_uploaded  ?? '—' },
            { label: 'Total Rate',     value: fmtRp(kpi?.total_rate_final) },
            { label: 'Total Slots',    value: kpi?.total_slot_final ?? '—' },
          ].map(item => (
            <div key={item.label}>
              <div className="text-[9px] text-cream/40">{item.label}</div>
              <div className="text-sm font-bold leading-tight">
                {kpiLoading ? <i className="fas fa-spinner fa-spin text-[10px] text-cream/30"></i> : item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Type breakdown */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="text-[9px] font-bold text-dark1/35 uppercase tracking-widest mb-2">
          Type Breakdown <span className="text-dark1/25 normal-case font-normal">(this page)</span>
        </div>
        {TYPES.map(type => {
          const count = byType[type] ?? 0
          const pct   = pageTotal > 0 ? (count / pageTotal) * 100 : 0
          return (
            <div key={type} className="mb-2">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[10px] text-dark1/60 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[type] }}></span>
                  {type}
                </span>
                <span className="text-[10px] font-bold text-dark1">{count}</span>
              </div>
              <div className="h-1.5 bg-cream rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: pct + '%', background: TYPE_COLORS[type] }}></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Top by rate */}
      {topByRate.length > 0 && (
        <div className="px-3 pb-3 border-t border-cream/40 pt-2">
          <div className="text-[9px] font-bold text-dark1/35 uppercase tracking-widest mb-2">
            Top Rate <span className="text-dark1/25 normal-case font-normal">(this page)</span>
          </div>
          {topByRate.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-cream/30 last:border-0">
              <span className="text-[9px] font-bold text-dark1/25 w-3">{i + 1}</span>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[t.type] }}></span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-dark1 truncate">@{t.username}</div>
                <div className="text-[9px] text-dark1/40">{t.platform ?? t.type}</div>
              </div>
              <div className="text-[10px] font-bold text-orange whitespace-nowrap">{fmtRp(t.rate_final)}</div>
            </div>
          ))}
        </div>
      )}

      {pageTotal === 0 && !kpiLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-dark1/20 gap-2">
          <i className="fas fa-id-card text-3xl"></i>
          <span className="text-xs">No talents yet</span>
        </div>
      )}
    </div>
  )
}

/* ── Right panel: Talent Detail (row selected) ───────────── */
function TalentDetailPanel({ talent, canUpdate, canDelete, onEdit, onDelete, onAddPayment, onAddContent, onInvoice, onSpk, onClose }) {
  const INFO_ROWS = [
    ['Doc No',    talent.no_document],
    ['PIC',       talent.pic],
    ['Produk',    talent.produk],
    ['Niche',     talent.niche],
    ['Bank',      talent.bank],
    ['Rekening',  talent.no_rekening],
    ['Nama Rek.', talent.nama_rekening],
    ['Followers', talent.followers?.toLocaleString()],
    ['Phone',     talent.phone_number],
    ['Scope',     talent.scope_of_work],
  ].filter(([, v]) => v)

  const typeColor = TYPE_COLORS[talent.type] ?? '#888'

  return (
    <div className="flex flex-col h-full">
      {/* Profile header */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-cream/40"
        style={{ borderLeft: `4px solid ${typeColor}`, background: 'linear-gradient(135deg,#fafaf8,#fff)' }}>
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="font-bold text-dark1 text-sm truncate">@{talent.username}</div>
            <div className="text-xs text-dark1/60 truncate">{talent.talent_name}</div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
                style={{ background: typeColor }}>{talent.type}</span>
              {talent.platform && (
                <span className="text-[9px] text-dark1/40 border border-cream rounded px-1.5 py-0.5">{talent.platform}</span>
              )}
              {talent.affiliate_status && (
                <span className="text-[9px] text-dark1/40 border border-cream rounded px-1.5 py-0.5">{talent.affiliate_status}</span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="text-dark1/30 hover:text-dark1 w-6 h-6 flex items-center justify-center rounded hover:bg-cream/60 ml-1 text-lg leading-none flex-shrink-0">
            &times;
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 p-2 flex-shrink-0 border-b border-cream/40">
        <div className="rounded-lg p-2 border border-orange/25 bg-orange/5">
          <div className="text-[9px] text-dark1/40 uppercase">Rate Final</div>
          <div className="text-xs font-bold text-orange">{fmtRp(talent.rate_final)}</div>
        </div>
        <div className="rounded-lg p-2 border border-cream bg-bg/50">
          <div className="text-[9px] text-dark1/40 uppercase">DP Amount</div>
          <div className="text-xs font-bold text-dark1">{fmtRp(talent.dp_amount)}</div>
        </div>
        <div className="rounded-lg p-2 border border-cream bg-bg/50">
          <div className="text-[9px] text-dark1/40 uppercase">Uploaded</div>
          <div className={`text-xs font-bold ${talent.remaining_color}`}>{talent.remaining}</div>
        </div>
        <div className="rounded-lg p-2 border border-cream bg-bg/50">
          <div className="text-[9px] text-dark1/40 uppercase">Dealing</div>
          <div className="text-xs font-bold text-dark1">{talent.dealing_date_formatted ?? '-'}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1 p-2 flex-shrink-0 border-b border-cream/40">
        {canUpdate && (
          <>
            <button onClick={onEdit} className="sv-tbtn sv-tbtn-dark flex-1 justify-center text-[10px]">
              <i className="fas fa-edit"></i> Edit
            </button>
            <button onClick={onAddPayment} className="sv-tbtn sv-tbtn-ghost flex-1 justify-center text-[10px]">
              <i className="fas fa-money-bill"></i> Pay
            </button>
            <button onClick={onAddContent} className="sv-tbtn sv-tbtn-ghost flex-1 justify-center text-[10px]">
              <i className="fas fa-film"></i> Content
            </button>
          </>
        )}
        {canDelete && (
          <button onClick={onDelete}
            className="sv-tbtn sv-tbtn-ghost text-[10px]" style={{ color: '#dc3545' }}>
            <i className="fas fa-trash"></i>
          </button>
        )}
      </div>

      {/* Document exports */}
      {canUpdate && (
        <div className="flex gap-1 px-2 pb-2 flex-shrink-0 border-b border-cream/40">
          <button onClick={onInvoice} className="sv-tbtn sv-tbtn-ghost flex-1 justify-center text-[10px]">
            <i className="fas fa-file-invoice-dollar"></i> Invoice
          </button>
          {talent.type === 'KOL' && (
            <button onClick={onSpk} className="sv-tbtn sv-tbtn-ghost flex-1 justify-center text-[10px]">
              <i className="fas fa-file-contract"></i> SPK
            </button>
          )}
        </div>
      )}

      {/* Detail list */}
      <div className="flex-1 overflow-y-auto p-2">
        {INFO_ROWS.map(([label, val]) => (
          <div key={label} className="flex items-start gap-2 py-1 border-b border-cream/30 last:border-0">
            <span className="text-[9px] text-dark1/35 uppercase font-semibold w-20 flex-shrink-0 pt-0.5">{label}</span>
            <span className="text-xs text-dark1 font-medium break-all">{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Talent Modal (Add / Edit) ───────────────────────────── */
function TalentModal({ mode, talent, onClose, onSaved }) {
  const [form, setForm] = useState({
    type:                   talent?.type                   ?? 'KOL',
    username:               talent?.username               ?? '',
    talent_name:            talent?.talent_name            ?? '',
    content_type:           talent?.content_type           ?? '',
    produk:                 talent?.produk                 ?? '',
    pic:                    talent?.pic                    ?? '',
    bulan_running:          talent?.bulan_running          ?? '',
    niche:                  talent?.niche                  ?? '',
    followers:              talent?.followers              ?? '',
    address:                talent?.address                ?? '',
    phone_number:           talent?.phone_number           ?? '',
    bank:                   talent?.bank                   ?? '',
    no_rekening:            talent?.no_rekening            ?? '',
    nama_rekening:          talent?.nama_rekening          ?? '',
    no_npwp:                talent?.no_npwp                ?? '',
    pengajuan_transfer_date:talent?.pengajuan_transfer_date ?? '',
    dealing_date:           talent?.dealing_date           ?? '',
    dealing_number:         talent?.dealing_number         ?? '',
    nik:                    talent?.nik                    ?? '',
    price_rate:             talent?.price_rate             ?? '',
    first_rate_card:        talent?.first_rate_card        ?? '',
    slot_final:             talent?.slot_final             ?? '',
    rate_final:             talent?.rate_final             ?? '',
    tax_percentage:         talent?.tax_percentage         ?? '',
    scope_of_work:          talent?.scope_of_work          ?? '',
    masa_kerjasama:         talent?.masa_kerjasama         ?? '',
    platform:               talent?.platform               ?? '',
    gdrive_kol_accepting:   talent?.gdrive_kol_accepting   ?? '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode !== 'add' || !form.username) return
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/talent/next-dealing-number?username=${encodeURIComponent(form.username)}`)
        const d   = await res.json()
        setForm(f => ({ ...f, dealing_number: d.next_dealing_number }))
      } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [form.username, mode])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const url    = mode === 'add' ? '/api/talent' : `/api/talent/${talent.id}`
      const method = mode === 'add' ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error()
      toast.success(mode === 'add' ? 'Talent created' : 'Updated')
      onSaved(); onClose()
    } catch { toast.error('Save failed') } finally { setSaving(false) }
  }

  const F = ({ label, name, type = 'text', readOnly = false, required = false }) => (
    <div className="form-group">
      <label className="form-label">{label}{required && ' *'}</label>
      <input type={type} className="form-input" value={form[name] ?? ''} readOnly={readOnly}
        onChange={e => set(name, e.target.value)} required={required} />
    </div>
  )
  const S = ({ label, name, options, required = false }) => (
    <div className="form-group">
      <label className="form-label">{label}{required && ' *'}</label>
      <select className="form-input" value={form[name] ?? ''} onChange={e => set(name, e.target.value)} required={required}>
        <option value="">-- Select --</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-3xl">
        <div className="modal-header">
          <h3 className="font-semibold text-dark1">{mode === 'add' ? 'Add Talent' : 'Edit Talent'}</h3>
          <button onClick={onClose} className="text-dark1/40 hover:text-dark1 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div>
                <S label="Type"         name="type"         options={TYPES}      required />
                <F label="Username"     name="username"     required />
                <F label="Talent Name"  name="talent_name"  required />
                <F label="Content Type" name="content_type" />
                <F label="Produk"       name="produk" />
                <F label="PIC"          name="pic" />
                <S label="Bulan Running" name="bulan_running" options={MONTHS} />
                <F label="Niche"        name="niche" />
                <F label="Followers"    name="followers"   type="number" />
                <F label="Address"      name="address" />
                <F label="Phone Number" name="phone_number" />
              </div>
              <div>
                <F label="Bank"                       name="bank" />
                <F label="No. Rekening"               name="no_rekening" />
                <F label="Nama Rekening"              name="nama_rekening" />
                <F label="No. NPWP"                   name="no_npwp" />
                <F label="Pengajuan Transfer Date"    name="pengajuan_transfer_date" type="date" />
                <F label="Dealing Date"               name="dealing_date"   type="date" />
                <F label="Dealing Number"             name="dealing_number" type="number" readOnly={mode === 'add'} />
                <F label="NIK"                        name="nik" />
                <F label="Price Rate (Rp)"            name="price_rate"      type="number" />
                <F label="First Rate Card (Rp)"       name="first_rate_card" type="number" />
                <F label="Slot Final"                 name="slot_final"      type="number" />
                <F label="Rate Final (Rp)"            name="rate_final"      type="number" required />
                <F label="Tax %"                      name="tax_percentage"  type="number" />
                <F label="Scope of Work"              name="scope_of_work" />
                <F label="Masa Kerjasama"             name="masa_kerjasama" />
                <S label="Platform"                   name="platform"     options={PLATFORMS} required />
                <F label="GDrive KOL Accepting"       name="gdrive_kol_accepting" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddPaymentModal({ talentId, onClose, onSaved }) {
  const [form, setForm] = useState({ status_payment: '', tanggal_pengajuan: '' })
  const [saving, setSaving] = useState(false)
  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/talent-payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, talent_id: talentId }),
      })
      if (!res.ok) throw new Error()
      toast.success('Payment added')
      onSaved(); onClose()
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-sm">
        <div className="modal-header">
          <h3 className="font-semibold text-dark1">Add Payment</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Status Payment *</label>
              <select className="form-input" value={form.status_payment}
                onChange={e => setForm(f => ({ ...f, status_payment: e.target.value }))} required>
                <option value="">-- Select --</option>
                {['Full Payment','DP 50%','Pelunasan 50%','Termin 1','Termin 2','Termin 3'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal Pengajuan</label>
              <input type="date" className="form-input" value={form.tanggal_pengajuan}
                onChange={e => setForm(f => ({ ...f, tanggal_pengajuan: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddContentModal({ talentId, onClose, onSaved }) {
  const [campaigns, setCampaigns] = useState([])
  const [form, setForm] = useState({ campaign_id: '', dealing_upload_date: '', final_rate_card: '' })
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    fetch('/api/talent-content/campaigns').then(r => r.json()).then(setCampaigns).catch(() => {})
  }, [])
  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/talent-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, talent_id: talentId }),
      })
      if (!res.ok) throw new Error()
      toast.success('Content added')
      onSaved(); onClose()
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-sm">
        <div className="modal-header">
          <h3 className="font-semibold text-dark1">Add Content</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Campaign</label>
              <select className="form-input" value={form.campaign_id}
                onChange={e => setForm(f => ({ ...f, campaign_id: e.target.value }))}>
                <option value="">-- None --</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Dealing Upload Date</label>
              <input type="date" className="form-input" value={form.dealing_upload_date}
                onChange={e => setForm(f => ({ ...f, dealing_upload_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Rate Card (Rp)</label>
              <input type="number" className="form-input" value={form.final_rate_card}
                onChange={e => setForm(f => ({ ...f, final_rate_card: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Choose Approval (signer) before invoice export ──────── */
function ChooseApprovalModal({ talentId, onClose }) {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch('/api/approval')
      .then(r => r.json())
      .then(d => setApprovals(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function exportWith(approvalId) {
    const q = approvalId ? `?approval=${approvalId}` : ''
    window.open(`/api/talent/${talentId}/export-invoice${q}`, '_blank')
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-sm">
        <div className="modal-header">
          <h3 className="font-semibold text-dark1">Choose Signature</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="text-center py-4 text-dark1/40 text-sm">Loading…</div>
          ) : approvals.length === 0 ? (
            <div className="text-center py-4 text-dark1/40 text-sm">No approval signers yet.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {approvals.map(a => (
                <button key={a.id} onClick={() => exportWith(a.id)}
                  className="flex items-center gap-2 p-2 rounded border border-cream hover:bg-bg/60 text-left">
                  {a.photo
                    ? <img src={a.photo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    : <span className="w-8 h-8 rounded-full bg-cream flex items-center justify-center text-[10px] text-dark2 flex-shrink-0">{a.name?.[0] ?? '?'}</span>}
                  <span className="text-sm text-dark1">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button type="button" onClick={() => exportWith(null)} className="btn btn-primary">
            Without signature
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────── */
export default function TalentIndexPage() {
  const { data: session } = useSession()
  const [talents,    setTalents]    = useState([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setType]       = useState('')
  const [loading,    setLoading]    = useState(true)
  const [kpi,        setKpi]        = useState(null)
  const [kpiLoading, setKpiLoading] = useState(true)

  const [modal,     setModal]     = useState(null)
  const [editData,  setEditData]  = useState(null)
  const [panelItem, setPanelItem] = useState(null)   // selected row → right panel
  const [paymentId, setPaymentId] = useState(null)
  const [contentId, setContentId] = useState(null)
  const [invoiceId, setInvoiceId] = useState(null)

  const canCreate = session?.user?.permissions?.includes('create_talent')
  const canUpdate = session?.user?.permissions?.includes('update_talent')
  const canDelete = session?.user?.permissions?.includes('delete_talent')

  const loadTalents = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page, limit: LIMIT })
      if (search)     p.set('search', search)
      if (typeFilter) p.set('type',   typeFilter)
      const res  = await fetch('/api/talent?' + p)
      const data = await res.json()
      setTalents(data.data ?? [])
      setTotal(data.total ?? 0)
    } catch {} finally { setLoading(false) }
  }, [page, search, typeFilter])

  const loadKpi = useCallback(async () => {
    setKpiLoading(true)
    try { setKpi(await (await fetch('/api/talent/kpi')).json()) }
    catch {} finally { setKpiLoading(false) }
  }, [])

  useEffect(() => { loadTalents() }, [loadTalents])
  useEffect(() => { loadKpi()    }, [loadKpi])

  async function handleDelete(id) {
    if (!confirm('Delete this talent?')) return
    try {
      await fetch(`/api/talent/${id}`, { method: 'DELETE' })
      toast.success('Deleted')
      setPanelItem(null)
      loadTalents(); loadKpi()
    } catch { toast.error('Delete failed') }
  }

  async function openEdit(row) {
    try {
      const res  = await fetch(`/api/talent/${row.id}`)
      const data = await res.json()
      setEditData({ ...data.talent, id: row.id })
      setModal('edit')
    } catch { toast.error('Load failed') }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="sv-page">
      {/* Topbar */}
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          <i className="fas fa-id-card text-orange"></i> Talent
        </span>

        {/* Type tabs */}
        <div className="flex gap-1">
          <button onClick={() => { setType(''); setPage(1) }}
            className={`sv-tbtn ${typeFilter === '' ? 'sv-tbtn-dark' : 'sv-tbtn-ghost'}`}>
            All
          </button>
          {TYPES.map(t => (
            <button key={t} onClick={() => { setType(t); setPage(1) }}
              className={`sv-tbtn ${typeFilter === t ? 'sv-tbtn-dark' : 'sv-tbtn-ghost'}`}
              style={typeFilter === t ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] } : {}}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: typeFilter === t ? 'rgba(255,255,255,0.6)' : TYPE_COLORS[t] }}></span>
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <input type="text" placeholder="Search username / name…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="border border-cream rounded text-xs px-2 py-1 text-dark1 focus:outline-none focus:border-dark2 h-7 bg-white w-44"
          />
          <button onClick={() => { setSearch(''); setType(''); setPage(1) }} className="sv-tbtn sv-tbtn-ghost">
            <i className="fas fa-times"></i>
          </button>
          {canCreate && (
            <button onClick={() => setModal('add')} className="sv-tbtn sv-tbtn-primary">
              <i className="fas fa-plus"></i> Add Talent
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="sv-kpi-strip px-3 py-1.5">
        {KPI_TILES.map(tile => (
          <div key={tile.key} className="kpi-tile">
            <div className="kpi-tile-icon" style={{ background: tile.bg }}>
              <i className={'fas ' + tile.icon}></i>
            </div>
            <div className="min-w-0">
              <div className="kpi-tile-label">{tile.label}</div>
              <div className="kpi-tile-value">
                {kpiLoading
                  ? <i className="fas fa-spinner fa-spin text-xs text-dark1/30"></i>
                  : tile.fmt ? fmtRp(kpi?.[tile.key]) : (kpi?.[tile.key] ?? 0)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main split */}
      <div className="sv-main">
        {/* Table */}
        <div className="sv-panel" style={{ flex: '0 0 68%' }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              <i className="fas fa-table text-dark2"></i> Talent Directory
            </span>
            <span className="text-[10px] text-dark1/40">{total} records</span>
          </div>
          <div className="sv-panel-body p-0">
            <table className="sv-table w-full">
              <thead>
                <tr>
                  <th>Doc No</th>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Platform</th>
                  <th>Rate Final</th>
                  <th>DP</th>
                  <th>Uploaded</th>
                  <th>Dealing Date</th>
                  <th>PIC</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-8 text-dark1/40">Loading…</td></tr>
                ) : talents.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-dark1/40">No talent records</td></tr>
                ) : talents.map(t => {
                  const isSelected = panelItem?.id === t.id
                  const typeColor  = TYPE_COLORS[t.type] ?? '#888'
                  return (
                    <tr key={t.id}
                      onClick={() => setPanelItem(isSelected ? null : t)}
                      className="cursor-pointer"
                      style={{
                        background:  isSelected ? 'rgba(44,54,57,0.06)' : undefined,
                        borderLeft:  `3px solid ${typeColor}`,
                      }}>
                      <td className="text-[10px] font-mono text-dark1/50">{t.no_document}</td>
                      <td className="font-semibold text-dark1">@{t.username}</td>
                      <td className="text-dark1/70">{t.talent_name}</td>
                      <td>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded text-white"
                          style={{ background: typeColor }}>
                          {t.type?.slice(0, 3).toUpperCase()}
                        </span>
                      </td>
                      <td>{t.platform ?? '-'}</td>
                      <td className="font-semibold text-orange">{fmtRp(t.rate_final)}</td>
                      <td>{fmtRp(t.dp_amount)}</td>
                      <td>
                        <span className={`${t.remaining_color} font-bold text-xs`}>{t.remaining}</span>
                      </td>
                      <td>{t.dealing_date_formatted ?? '-'}</td>
                      <td>{t.pic ?? '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {pages > 1 && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-cream/60 text-xs">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="sv-tbtn sv-tbtn-ghost">‹</button>
                <span>Page {page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page===pages} className="sv-tbtn sv-tbtn-ghost">›</button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: detail or stats */}
        <div className="sv-panel" style={{ flex: 1 }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              {panelItem
                ? <><i className="fas fa-user text-dark2"></i> Profile</>
                : <><i className="fas fa-chart-pie text-dark2"></i> Overview</>}
            </span>
            {!panelItem && (
              <button onClick={loadKpi} className="sv-tbtn sv-tbtn-ghost text-[10px]" title="Refresh">
                <i className="fas fa-sync-alt"></i>
              </button>
            )}
          </div>

          {panelItem ? (
            <TalentDetailPanel
              talent={panelItem}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onEdit={() => openEdit(panelItem)}
              onDelete={() => handleDelete(panelItem.id)}
              onAddPayment={() => { setPaymentId(panelItem.id); setModal('payment') }}
              onAddContent={() => { setContentId(panelItem.id); setModal('content') }}
              onInvoice={() => { setInvoiceId(panelItem.id); setModal('invoice') }}
              onSpk={() => window.open(`/api/talent/${panelItem.id}/export-spk`, '_blank')}
              onClose={() => setPanelItem(null)}
            />
          ) : (
            <QuickStatsPanel talents={talents} kpi={kpi} kpiLoading={kpiLoading} />
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'add' && (
        <TalentModal mode="add" onClose={() => setModal(null)} onSaved={() => { loadTalents(); loadKpi() }} />
      )}
      {modal === 'edit' && editData && (
        <TalentModal mode="edit" talent={editData} onClose={() => setModal(null)}
          onSaved={() => { loadTalents(); loadKpi(); setPanelItem(null) }} />
      )}
      {modal === 'payment' && paymentId && (
        <AddPaymentModal talentId={paymentId} onClose={() => setModal(null)} onSaved={loadTalents} />
      )}
      {modal === 'content' && contentId && (
        <AddContentModal talentId={contentId} onClose={() => setModal(null)} onSaved={loadTalents} />
      )}
      {modal === 'invoice' && invoiceId && (
        <ChooseApprovalModal talentId={invoiceId} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
