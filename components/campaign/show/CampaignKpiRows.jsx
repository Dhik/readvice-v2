'use client'

// Each icon string MUST include a style-family class (fas/far/fab) — FontAwesome 6 needs it
// to set the icon font, otherwise the glyph never renders ("not compiled" empty boxes).
const ROW1 = [
  { icon: 'fas fa-wallet',                accent: '#2C3639', label: 'Total Expense',   key: 'total_expense' },
  { icon: 'fas fa-hand-holding-dollar',   accent: '#E07B39', label: 'Total GMV',       key: 'total_gmv' },
  { icon: 'fas fa-chart-bar',             accent: '#2C3639', label: 'Cost Per Mile',   key: 'cpm' },
  { icon: 'fas fa-trophy',                accent: '#E07B39', label: 'Achievement',     key: 'achievement' },
]

const ROW2 = [
  { icon: 'fas fa-eye',          accent: '#2C3639', label: 'Video Views',      key: 'view' },
  { icon: 'fas fa-thumbs-up',    accent: '#3F4E4F', label: 'Total Likes',      key: 'like' },
  { icon: 'fas fa-comment-dots', accent: '#3F4E4F', label: 'Comments',         key: 'comment' },
  { icon: 'fas fa-chart-line',   accent: '#E07B39', label: 'Engagement Rate',  key: 'engagement_rate' },
  { icon: 'fas fa-users',        accent: '#2C3639', label: 'Total Influencer', key: 'total_influencer' },
]

function KpiTile({ icon, accent, label, value, loading }) {
  return (
    <div className="sv-kpi-tile">
      <div className="sv-kpi-icon flex-shrink-0"
        style={{ background: accent + '14', color: accent }}>
        <i className={icon + ' text-sm'}></i>
      </div>
      <div className="min-w-0">
        <div className="sv-kpi-label">{label}</div>
        <div className="sv-kpi-value" style={{ opacity: loading ? 0.3 : 1, transition: 'opacity 0.3s' }}>
          {loading
            ? <span className="inline-block w-12 h-3 rounded bg-cream animate-pulse"></span>
            : (value ?? '—')}
        </div>
      </div>
    </div>
  )
}

export default function CampaignKpiRows({ data, loading }) {
  return (
    <>
      <div className="sv-kpi-row mb-2">
        {ROW1.map(t => (
          <KpiTile key={t.key} icon={t.icon} accent={t.accent} label={t.label}
            value={data?.[t.key]} loading={loading} />
        ))}
      </div>
      <div className="sv-kpi-row sv-kpi-row-5 mb-3">
        {ROW2.map(t => (
          <KpiTile key={t.key} icon={t.icon} accent={t.accent} label={t.label}
            value={data?.[t.key]} loading={loading} />
        ))}
      </div>
    </>
  )
}
