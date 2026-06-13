export default function RelatedKeywords({ trendsData }) {
  const related = trendsData?.related ?? []
  const rising  = trendsData?.rising  ?? []

  const maxRelated = related[0]?.value ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Related */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-dark1)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
          <i className="fas fa-link" style={{ marginRight: 5, color: 'var(--color-orange)' }} />
          Related Queries
        </div>
        {related.length === 0 ? (
          <p style={{ fontSize: 12, color: '#bbb' }}>No data</p>
        ) : related.map(k => (
          <div key={k.query} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-dark1)', marginBottom: 2 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{k.query}</span>
              <span style={{ color: '#999', flexShrink: 0 }}>{k.value}</span>
            </div>
            <div style={{ height: 4, background: '#eee', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round((k.value / maxRelated) * 100)}%`, background: 'var(--color-orange)', borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Rising */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-dark1)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
          <i className="fas fa-arrow-trend-up" style={{ marginRight: 5, color: '#10B981' }} />
          Rising Queries
        </div>
        {rising.length === 0 ? (
          <p style={{ fontSize: 12, color: '#bbb' }}>No data</p>
        ) : rising.map(k => (
          <div key={k.query} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, fontSize: 12 }}>
            <span style={{ color: 'var(--color-dark1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{k.query}</span>
            <span style={{ background: '#ECFDF5', color: '#10B981', borderRadius: 4, padding: '1px 6px', fontWeight: 700, fontSize: 11, flexShrink: 0, marginLeft: 6 }}>
              {k.formattedValue}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}
