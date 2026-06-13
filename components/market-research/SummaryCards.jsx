export default function SummaryCards({ summary }) {
  const fmt = (n) => n?.toLocaleString('id-ID') ?? '—'
  const fmtPrice = (n) => n > 0 ? `Rp ${n.toLocaleString('id-ID')}` : '—'

  const cards = [
    {
      label: 'Total Produk',
      value: fmt(summary?.total_results),
      icon:  'fa-box',
      color: '#3B82F6',
      bg:    '#EFF6FF',
    },
    {
      label: 'Rata-rata Harga',
      value: fmtPrice(summary?.avg_price),
      icon:  'fa-tag',
      color: '#10B981',
      bg:    '#ECFDF5',
    },
    {
      label: 'Harga Terendah',
      value: fmtPrice(summary?.min_price),
      icon:  'fa-arrow-trend-down',
      color: '#F59E0B',
      bg:    '#FFFBEB',
    },
    {
      label: 'Top Brand',
      value: summary?.top_brands?.[0]?.name ?? '—',
      icon:  'fa-crown',
      color: 'var(--color-orange)',
      bg:    'rgba(224,123,57,.08)',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {cards.map(c => (
        <div key={c.label} className="sv-kpi-tile">
          <div style={{ width: 36, height: 36, borderRadius: 8, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className={`fas ${c.icon}`} style={{ color: c.color, fontSize: 14 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="sv-kpi-label">{c.label}</div>
            <div className="sv-kpi-value" title={c.value}>{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
