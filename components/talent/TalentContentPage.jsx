'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

const TYPES = ['Affiliate', 'KOL', 'Content Creator', 'Clipper']
const LIMIT  = 50

const TYPE_COLORS = {
  Affiliate:         '#E07B39',
  KOL:               '#2C3639',
  'Content Creator': '#3F4E4F',
  Clipper:           '#8B5E3C',
}

const KPI_TILES = [
  { key: 'today_count',      label: 'Today',   icon: 'fa-calendar-day',  bg: '#E07B39' },
  { key: 'done_false_count', label: 'Pending', icon: 'fa-clock',         bg: '#3F4E4F' },
  { key: 'done_true_count',  label: 'Done',    icon: 'fa-check-circle',  bg: '#28a745' },
  { key: 'total_count',      label: 'Total',   icon: 'fa-layer-group',   bg: '#2C3639' },
]

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']
const DOW = ['Mo','Tu','We','Th','Fr','Sa','Su']

function fmtRp(n) {
  if (!n && n !== 0) return '-'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(n))
}

/** Parse DD/MM/YYYY → Date (local midnight) */
function parseDMY(str) {
  if (!str) return null
  const [dd, mm, yyyy] = str.split('/')
  if (!dd || !mm || !yyyy) return null
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
}

/** YYYY-MM-DD string for a Date */
function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

/* ── Mini Calendar ───────────────────────────────────────── */
function MiniCalendar({ viewMonth, onNavigate, scheduleItems, selectedDay, onSelectDay }) {
  const year  = viewMonth.getFullYear()
  const month = viewMonth.getMonth()

  // Build grid
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7  // Mon-start
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  // Group schedule items by day number (current month only)
  const dotsByDay = {}
  for (const item of scheduleItems) {
    const d = parseDMY(item.posting_date)
    if (!d || d.getMonth() !== month || d.getFullYear() !== year) continue
    const key = d.getDate()
    if (!dotsByDay[key]) dotsByDay[key] = []
    dotsByDay[key].push(item)
  }

  const todayObj = new Date(); todayObj.setHours(0,0,0,0)
  const isToday = (day) => day &&
    todayObj.getDate() === day &&
    todayObj.getMonth() === month &&
    todayObj.getFullYear() === year

  return (
    <div className="flex-shrink-0 border-b border-cream">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-3 py-2 bg-dark1 text-white">
        <button onClick={() => onNavigate(-1)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-cream/70 hover:text-white transition-colors text-sm">‹</button>
        <span className="text-xs font-semibold tracking-wide">{MONTH_NAMES[month]} {year}</span>
        <button onClick={() => onNavigate(1)}  className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-cream/70 hover:text-white transition-colors text-sm">›</button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 bg-bg/60 border-b border-cream/40">
        {DOW.map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-dark1/30 py-1 uppercase">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const items  = day ? (dotsByDay[day] ?? []) : []
          const today  = isToday(day)
          const sel    = day && selectedDay === day
          const hasOverdue = items.some(it => !it.done && parseDMY(it.posting_date) < todayObj)

          return (
            <div
              key={i}
              onClick={() => day && onSelectDay(sel ? null : day)}
              className={`relative flex flex-col items-center py-1 cursor-pointer transition-colors select-none ${
                !day ? '' :
                sel   ? 'bg-dark1' :
                today ? 'bg-orange/8' : 'hover:bg-bg'
              }`}
            >
              {day && (
                <>
                  <span className={`text-[10px] font-semibold w-[18px] h-[18px] flex items-center justify-center rounded-full leading-none ${
                    today ? 'bg-orange text-white' :
                    sel   ? 'bg-white text-dark1'  : 'text-dark1'
                  }`}>{day}</span>

                  {/* Dots row */}
                  {items.length > 0 && (
                    <div className="flex gap-[2px] mt-[2px] flex-wrap justify-center">
                      {items.slice(0, 4).map((it, j) => (
                        <span key={j}
                          className="w-[5px] h-[5px] rounded-full"
                          style={{ background: TYPE_COLORS[it.type] ?? '#888' }}
                        />
                      ))}
                      {items.length > 4 && <span className="text-[7px] text-dark1/30 leading-none">+</span>}
                    </div>
                  )}

                  {/* Overdue indicator */}
                  {hasOverdue && (
                    <span className="absolute top-0.5 right-0.5 w-[5px] h-[5px] rounded-full bg-red-500" />
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-2.5 px-2.5 py-1.5 border-t border-cream/40 bg-bg/40 flex-wrap">
        {TYPES.map(t => (
          <span key={t} className="flex items-center gap-1 text-[9px] text-dark1/50">
            <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
            {t.slice(0, 3)}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[9px] text-dark1/50">
          <span className="w-2 h-2 rounded-full bg-red-500" />Overdue
        </span>
      </div>
    </div>
  )
}

/* ── Reminder Feed ───────────────────────────────────────── */
function ReminderFeed({ scheduleItems, selectedDay, viewMonth }) {
  const todayObj = new Date(); todayObj.setHours(0,0,0,0)
  const month = viewMonth.getMonth()
  const year  = viewMonth.getFullYear()

  function classify(item) {
    const d = parseDMY(item.posting_date)
    if (!d) return 'nodate'
    if (item.done)         return 'done'
    if (d < todayObj)      return 'overdue'
    if (d.getTime() === todayObj.getTime()) return 'today'
    return 'upcoming'
  }

  const CLS = {
    overdue:  { border: '#dc3545', bg: '#fff5f5', tag: 'OVERDUE',  tagColor: '#dc3545', icon: 'fa-exclamation-circle text-red-500' },
    today:    { border: '#E07B39', bg: '#fff9f5', tag: 'TODAY',    tagColor: '#E07B39', icon: 'fa-bell text-orange' },
    upcoming: { border: '#DCD7C9', bg: 'white',   tag: '',         tagColor: '#888',    icon: '' },
    done:     { border: '#28a745', bg: '#f4fdf6', tag: 'DONE',    tagColor: '#28a745', icon: 'fa-check-circle text-green-500' },
    nodate:   { border: '#e0e0e0', bg: 'white',   tag: '',         tagColor: '#aaa',    icon: '' },
  }

  let items = selectedDay
    ? scheduleItems.filter(it => {
        const d = parseDMY(it.posting_date)
        return d && d.getDate() === selectedDay && d.getMonth() === month && d.getFullYear() === year
      })
    : scheduleItems

  // Sort: overdue first, then today, then upcoming by date asc, then done
  const ORDER = { overdue: 0, today: 1, upcoming: 2, done: 3, nodate: 4 }
  items = [...items].sort((a, b) => {
    const ca = ORDER[classify(a)], cb = ORDER[classify(b)]
    if (ca !== cb) return ca - cb
    const da = parseDMY(a.posting_date), db = parseDMY(b.posting_date)
    if (da && db) return da - db
    return 0
  })

  const selectedLabel = selectedDay
    ? `${selectedDay} ${MONTH_NAMES[month]}`
    : 'Schedule & Reminders'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-cream/40 bg-bg/40 flex-shrink-0">
        <span className="text-[10px] font-bold text-dark1 uppercase tracking-wide flex items-center gap-1.5">
          <i className="fas fa-bell text-orange text-[9px]"></i> {selectedLabel}
        </span>
        <div className="flex items-center gap-1.5">
          {selectedDay && (
            <button onClick={() => {}} className="text-[9px] text-dark1/40 hover:text-orange">
              <i className="fas fa-times"></i>
            </button>
          )}
          <span className="text-[9px] text-dark1/30">{items.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-dark1/25">
            <i className="fas fa-calendar-check text-2xl"></i>
            <span className="text-xs">All clear</span>
          </div>
        ) : (
          <div>
            {items.map(item => {
              const cls = CLS[classify(item)]
              const d   = parseDMY(item.posting_date)
              const diffDays = d ? Math.round((d - todayObj) / 86400000) : null

              return (
                <div key={item.id}
                  className="flex items-start gap-2 px-2.5 py-2 border-b border-cream/30 text-xs transition-colors hover:brightness-95"
                  style={{ background: cls.bg, borderLeft: `3px solid ${cls.border}` }}
                >
                  {/* Type dot */}
                  <span className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
                    style={{ background: TYPE_COLORS[item.type] ?? '#888' }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-dark1 truncate">{item.username}</span>
                      {cls.tag && (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded"
                          style={{ color: cls.tagColor, background: cls.tagColor + '18' }}>
                          {cls.tag}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-dark1/45 flex-wrap">
                      <span>{item.posting_date ?? '—'}</span>
                      {diffDays !== null && classify(item) !== 'done' && (
                        <>
                          <span>·</span>
                          <span style={{ color: classify(item) === 'overdue' ? '#dc3545' : classify(item) === 'today' ? '#E07B39' : undefined }}>
                            {diffDays === 0 ? 'Today' :
                             diffDays > 0  ? `in ${diffDays}d` :
                                             `${Math.abs(diffDays)}d ago`}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>{item.type}</span>
                      {item.campaign_title && item.campaign_title !== '-' && (
                        <><span>·</span><span className="truncate max-w-[80px]">{item.campaign_title}</span></>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {cls.icon && <i className={`fas ${cls.icon} text-[11px]`}></i>}
                    {item.upload_link && (
                      <a href={item.upload_link} target="_blank" rel="noopener"
                        className="text-[9px] text-orange hover:underline">
                        <i className="fas fa-external-link-alt"></i>
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Modals ──────────────────────────────────────────────── */
function AddLinkModal({ contentId, onClose, onSaved }) {
  const [form, setForm] = useState({ upload_link: '', posting_date: '', kode_ads: '', task_name: '', channel: '' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/talent-content/${contentId}/add-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Link added')
      onSaved(); onClose()
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-sm">
        <div className="modal-header">
          <h3 className="font-semibold text-dark1">Add Upload Link</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {[
              { label: 'Task Name',    name: 'task_name',   type: 'select', options: ['Soft Selling','Hard Selling','Awareness'] },
              { label: 'Channel',      name: 'channel',     type: 'select', options: ['Instagram Feed','Tiktok Video','Twitter Post','Shopee Video','Instagram Story'] },
              { label: 'Upload Link',  name: 'upload_link', type: 'url' },
              { label: 'Posting Date', name: 'posting_date',type: 'date' },
              { label: 'Kode Ads',     name: 'kode_ads',    type: 'text' },
            ].map(f => (
              <div className="form-group" key={f.name}>
                <label className="form-label">{f.label}</label>
                {f.type === 'select' ? (
                  <select className="form-input" value={form[f.name]} onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}>
                    <option value="">-- Select --</option>
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={f.type} className="form-input" value={form[f.name]} onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))} />
                )}
              </div>
            ))}
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

function EditContentModal({ content, onClose, onSaved }) {
  const [form, setForm] = useState({
    dealing_upload_date: content?.dealing_upload_date?.split('/').reverse().join('-') ?? '',
    posting_date:        content?.posting_date?.split('/').reverse().join('-')        ?? '',
    final_rate_card:     content?.rate_display ?? '',
    done:                content?.done ?? false,
    pic_code:            content?.pic_code   ?? '',
    boost_code:          content?.boost_code ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/talent-content/${content.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Updated')
      onSaved(); onClose()
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-sm">
        <div className="modal-header">
          <h3 className="font-semibold text-dark1">Edit Content — {content.username}</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Dealing Upload Date</label>
              <input type="date" className="form-input" value={form.dealing_upload_date} onChange={e => setForm(p => ({ ...p, dealing_upload_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Posting Date</label>
              <input type="date" className="form-input" value={form.posting_date} onChange={e => setForm(p => ({ ...p, posting_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Rate Card (Rp)</label>
              <input type="number" className="form-input" value={form.final_rate_card} onChange={e => setForm(p => ({ ...p, final_rate_card: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">PIC Code</label>
              <input type="text" className="form-input" value={form.pic_code} onChange={e => setForm(p => ({ ...p, pic_code: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Boost Code</label>
              <input type="text" className="form-input" value={form.boost_code} onChange={e => setForm(p => ({ ...p, boost_code: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
              <input type="checkbox" checked={form.done} onChange={e => setForm(p => ({ ...p, done: e.target.checked }))} />
              Marked as Done
            </label>
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

/* ── Main Page ───────────────────────────────────────────── */
export default function TalentContentPage() {
  const { data: session } = useSession()

  /* table state */
  const [contents,   setContents]   = useState([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setType]       = useState('')
  const [modal,      setModal]      = useState(null)
  const [selected,   setSelected]   = useState(null)

  /* KPI strip */
  const [counts, setCounts] = useState(null)

  /* calendar / schedule panel */
  const [viewMonth,     setViewMonth]     = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d })
  const [selectedDay,   setSelectedDay]   = useState(null)
  const [scheduleItems, setScheduleItems] = useState([])

  const canUpdate = session?.user?.permissions?.includes('update_talent')
  const canDelete = session?.user?.permissions?.includes('delete_talent')

  /* load paginated table */
  const loadContents = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page, limit: LIMIT })
      if (search)     p.set('username', search)
      if (typeFilter) p.set('filterTalentType', typeFilter)
      const res  = await fetch('/api/talent-content?' + p)
      const data = await res.json()
      setContents(data.data ?? [])
      setTotal(data.total  ?? 0)
    } catch {} finally { setLoading(false) }
  }, [page, search, typeFilter])

  /* load KPI counts */
  const loadCounts = useCallback(async () => {
    try { setCounts(await (await fetch('/api/talent-content/count')).json()) } catch {}
  }, [])

  /* load schedule items for current+next month (calendar + reminder feed) */
  const loadSchedule = useCallback(async () => {
    const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const end   = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 2, 0) // end of next month
    const range = `${isoDate(start)} - ${isoDate(end)}`
    try {
      const res  = await fetch(`/api/talent-content?limit=200&dateRange=${encodeURIComponent(range)}`)
      const data = await res.json()
      setScheduleItems(data.data ?? [])
    } catch {}
  }, [viewMonth])

  useEffect(() => { loadContents() }, [loadContents])
  useEffect(() => { loadCounts()   }, [loadCounts])
  useEffect(() => { loadSchedule() }, [loadSchedule])

  function navigateMonth(dir) {
    setViewMonth(prev => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + dir)
      return d
    })
    setSelectedDay(null)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this content?')) return
    try {
      await fetch(`/api/talent-content/${id}`, { method: 'DELETE' })
      toast.success('Deleted')
      loadContents(); loadCounts(); loadSchedule()
    } catch { toast.error('Failed') }
  }

  async function handleRefund(id, isRefund) {
    try {
      await fetch(`/api/talent-content/${id}/${isRefund ? 'unrefund' : 'refund'}`, { method: 'POST' })
      toast.success(isRefund ? 'Unrefunded' : 'Refunded')
      loadContents()
    } catch { toast.error('Failed') }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="sv-page">
      {/* Topbar */}
      <div className="sv-topbar">
        <span className="sv-topbar-title">
          <i className="fas fa-camera text-orange"></i> Talent Content
        </span>

        {/* Type filter tabs */}
        <div className="flex gap-1">
          <button onClick={() => { setType(''); setPage(1) }}
            className={`sv-tbtn ${typeFilter === '' ? 'sv-tbtn-dark' : 'sv-tbtn-ghost'}`}>
            All
          </button>
          {TYPES.map(t => (
            <button key={t} onClick={() => { setType(t); setPage(1) }}
              className={`sv-tbtn ${typeFilter === t ? 'sv-tbtn-dark' : 'sv-tbtn-ghost'}`}
              style={typeFilter === t ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] } : {}}>
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <input type="text" placeholder="Search username…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="border border-cream rounded text-xs px-2 py-1 text-dark1 focus:outline-none focus:border-dark2 h-7 bg-white w-40"
          />
          <button onClick={() => { setSearch(''); setType(''); setPage(1) }} className="sv-tbtn sv-tbtn-ghost">
            <i className="fas fa-times"></i> Reset
          </button>
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
                {counts
                  ? (counts[tile.key] ?? 0)
                  : <i className="fas fa-spinner fa-spin text-xs text-dark1/30"></i>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main split */}
      <div className="sv-main">
        {/* Table panel */}
        <div className="sv-panel" style={{ flex: '0 0 62%' }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              <i className="fas fa-table text-dark2"></i> Content Records
            </span>
            <span className="text-[10px] text-dark1/40">{total} records</span>
          </div>
          <div className="sv-panel-body p-0">
            <table className="sv-table w-full">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Type</th>
                  <th>Campaign</th>
                  <th>Upload Date</th>
                  <th>Posting Date</th>
                  <th>Deadline</th>
                  <th>Done</th>
                  <th>Rate</th>
                  <th>Link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-8 text-dark1/40">Loading…</td></tr>
                ) : contents.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-dark1/40">No content records</td></tr>
                ) : contents.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.username}</td>
                    <td>
                      <span className="badge text-white" style={{ background: TYPE_COLORS[c.type] ?? '#888' }}>
                        {c.type?.slice(0, 3).toUpperCase()}
                      </span>
                    </td>
                    <td className="max-w-[90px] truncate">{c.campaign_title}</td>
                    <td>{c.dealing_upload_date ?? '-'}</td>
                    <td>{c.posting_date ?? '-'}</td>
                    <td>
                      <span className={`badge ${c.deadline === 'Overdue' ? 'badge-danger' : 'badge-success'}`}>
                        {c.deadline}
                      </span>
                    </td>
                    <td className="text-center">
                      {c.done
                        ? <i className="fas fa-check-circle text-green-500"></i>
                        : <i className="fas fa-clock text-dark1/25"></i>}
                    </td>
                    <td>{fmtRp(c.rate_display)}</td>
                    <td>
                      {c.is_refund && <span className="badge badge-danger mr-1">R</span>}
                      {c.upload_link
                        ? <a href={c.upload_link} target="_blank" rel="noopener" className="text-orange text-xs">
                            <i className="fas fa-external-link-alt"></i>
                          </a>
                        : canUpdate && (
                          <button onClick={() => { setSelected(c); setModal('addLink') }}
                            className="text-[10px] text-dark1/40 hover:text-orange">+link</button>
                        )}
                    </td>
                    <td className="whitespace-nowrap">
                      {canUpdate && (
                        <>
                          <button onClick={() => { setSelected(c); setModal('edit') }}
                            className="sv-tbtn sv-tbtn-ghost mr-0.5" title="Edit">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button onClick={() => handleRefund(c.id, c.is_refund)}
                            className="sv-tbtn sv-tbtn-ghost mr-0.5"
                            title={c.is_refund ? 'Unrefund' : 'Mark Refund'}>
                            <i className={`fas fa-${c.is_refund ? 'undo' : 'ban'}`}></i>
                          </button>
                        </>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(c.id)}
                          className="sv-tbtn sv-tbtn-ghost" style={{ color: '#dc3545' }} title="Delete">
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
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

        {/* Calendar + Reminder panel */}
        <div className="sv-panel" style={{ flex: 1 }}>
          <div className="sv-panel-header">
            <span className="sv-panel-title">
              <i className="fas fa-calendar-alt text-dark2"></i> Schedule
            </span>
            {selectedDay && (
              <button onClick={() => setSelectedDay(null)}
                className="text-[10px] text-dark1/40 hover:text-orange flex items-center gap-1">
                <i className="fas fa-times"></i> Clear
              </button>
            )}
          </div>

          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <MiniCalendar
              viewMonth={viewMonth}
              onNavigate={navigateMonth}
              scheduleItems={scheduleItems}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            <ReminderFeed
              scheduleItems={scheduleItems}
              selectedDay={selectedDay}
              viewMonth={viewMonth}
            />
          </div>
        </div>
      </div>

      {modal === 'addLink' && selected && (
        <AddLinkModal contentId={selected.id} onClose={() => setModal(null)} onSaved={() => { loadContents(); loadSchedule() }} />
      )}
      {modal === 'edit' && selected && (
        <EditContentModal
          content={selected}
          onClose={() => setModal(null)}
          onSaved={() => { loadContents(); loadCounts(); loadSchedule() }}
        />
      )}
    </div>
  )
}
