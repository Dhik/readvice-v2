'use client'
// Compact icon KPI strip (generic version of CampaignKpiStrip): sv-kpi-strip +
// kpi-tile with a 30px icon, text-[9px] label / text-[13px] value.
//
// tiles: [{ icon, label, value, bg?, iconColor?, delta?, dev? }]
//   delta : number (percent) — renders ▲/▼ + colored %, omitted if null/undefined
//   dev   : true → small "dev" badge by the label (KPI sourced from DUMMY data)
function Delta({ pct }) {
  if (pct == null) return null
  const up = pct >= 0
  return (
    <span className="text-[9px] font-semibold mt-0.5" style={{ color: up ? '#16a34a' : '#dc3545' }}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

// extraFields (Part B4 — calc fields): rendered as extra tiles AFTER the fixed ones.
// Shape: [{ label, value, dummy, icon?, bg?, onRemove? }]. `dummy` drives the existing
// `dev` badge automatically; `onRemove` adds a small × (calc fields are user-defined).
export default function IconKpiStrip({ tiles = [], extraFields = [] }) {
  const allTiles = [
    ...tiles,
    ...extraFields.map(f => ({ icon: f.icon ?? 'fa-calculator', bg: f.bg ?? '#3F4E4F', ...f, dev: f.dummy, calc: true })),
  ]
  return (
    <div className="sv-kpi-strip">
      {allTiles.map((t, i) => (
        <div key={i} className="kpi-tile relative">
          {t.calc && t.onRemove && (
            <button onClick={t.onRemove} title="Remove calculated field"
              className="absolute top-0.5 right-0.5 text-dark1/30 hover:text-red-500 text-[11px] leading-none w-4 h-4 flex items-center justify-center">&times;</button>
          )}
          <div className="kpi-tile-icon" style={{ background: t.bg ?? '#2C3639', color: t.iconColor ?? 'white' }}>
            <i className={`fas ${t.icon ?? 'fa-chart-simple'}`} />
          </div>
          <div className="min-w-0 flex flex-col">
            <div className="kpi-tile-label">
              {t.label}
              {t.calc && <span className="ml-1 text-[8px] uppercase tracking-wide px-1 rounded bg-dark2/10 text-dark2 align-middle" title="User-defined calculated field">ƒx</span>}
              {t.dev && (
                <span className="ml-1 text-[8px] uppercase tracking-wide px-1 rounded bg-orange/15 text-orange align-middle"
                  title="Sourced from DUMMY dev data — replace with a real connector">dev</span>
              )}
            </div>
            <div className="kpi-tile-value">{t.value}</div>
            <Delta pct={t.delta} />
          </div>
        </div>
      ))}
    </div>
  )
}
