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

export default function IconKpiStrip({ tiles = [] }) {
  return (
    <div className="sv-kpi-strip">
      {tiles.map((t, i) => (
        <div key={i} className="kpi-tile">
          <div className="kpi-tile-icon" style={{ background: t.bg ?? '#2C3639', color: t.iconColor ?? 'white' }}>
            <i className={`fas ${t.icon ?? 'fa-chart-simple'}`} />
          </div>
          <div className="min-w-0 flex flex-col">
            <div className="kpi-tile-label">
              {t.label}
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
