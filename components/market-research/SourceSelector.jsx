export default function SourceSelector({ source, onSourceChange, credentialStatus, onSetupCredential }) {
  const { exists, maskedPhone } = credentialStatus

  return (
    <div style={{ background: 'white', border: '1px solid var(--color-cream)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.4px', flexShrink: 0 }}>
        Data Source:
      </span>

      {/* Tokopedia + Trends option */}
      <button
        onClick={() => onSourceChange('tokopedia')}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
          border: source === 'tokopedia' ? '2px solid var(--color-orange)' : '2px solid var(--color-cream)',
          background: source === 'tokopedia' ? 'rgba(224,123,57,.07)' : 'white',
          transition: 'all .15s',
        }}
      >
        <span style={{ fontSize: 15 }}>🛒</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: source === 'tokopedia' ? 'var(--color-orange)' : 'var(--color-dark1)' }}>
            Tokopedia + Google Trends
          </div>
          <div style={{ fontSize: 10, color: '#aaa' }}>Product data · Search trends · Free</div>
        </div>
        {source === 'tokopedia' && (
          <i className="fas fa-check-circle" style={{ color: 'var(--color-orange)', fontSize: 13, marginLeft: 2 }} />
        )}
      </button>

      {/* Shopee option */}
      <button
        onClick={() => onSourceChange('shopee')}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
          border: source === 'shopee' ? '2px solid #EE4D2D' : '2px solid var(--color-cream)',
          background: source === 'shopee' ? 'rgba(238,77,45,.06)' : 'white',
          transition: 'all .15s',
        }}
      >
        <span style={{ fontSize: 15 }}>🛍️</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: source === 'shopee' ? '#EE4D2D' : 'var(--color-dark1)' }}>
            Shopee Indonesia
          </div>
          <div style={{ fontSize: 10, color: '#aaa' }}>Sales rank · Price · Rating · Free</div>
        </div>
        {source === 'shopee' && (
          <i className="fas fa-check-circle" style={{ color: '#EE4D2D', fontSize: 13, marginLeft: 2 }} />
        )}
      </button>

      {/* Kalodata option */}
      <button
        onClick={() => onSourceChange('kalodata')}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
          border: source === 'kalodata' ? '2px solid #3B82F6' : '2px solid var(--color-cream)',
          background: source === 'kalodata' ? 'rgba(59,130,246,.06)' : 'white',
          transition: 'all .15s',
        }}
      >
        <span style={{ fontSize: 15 }}>📊</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: source === 'kalodata' ? '#3B82F6' : 'var(--color-dark1)' }}>
            Kalodata (TikTok Shop)
          </div>
          <div style={{ fontSize: 10, color: '#aaa' }}>Revenue · Sales · Growth data</div>
        </div>
        {source === 'kalodata' && (
          <i className="fas fa-check-circle" style={{ color: '#3B82F6', fontSize: 13, marginLeft: 2 }} />
        )}
      </button>

      {/* Kalodata credential status — only visible when Kalodata is selected */}
      {source === 'kalodata' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
          {exists ? (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#10B981', fontWeight: 600 }}>
                <i className="fas fa-circle-check" />
                Connected ({maskedPhone})
              </span>
              <button
                onClick={onSetupCredential}
                style={{ fontSize: 11, color: '#888', background: 'none', border: '1px solid var(--color-cream)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}
              >
                Change
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="fas fa-triangle-exclamation" />
                Not Connected
              </span>
              <button
                onClick={onSetupCredential}
                style={{
                  fontSize: 11, fontWeight: 600, color: 'white',
                  background: '#3B82F6', border: 'none', borderRadius: 5,
                  padding: '4px 10px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <i className="fas fa-key" /> Setup Credentials
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
