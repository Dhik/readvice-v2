'use client'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import KeywordSearch           from '@/components/market-research/KeywordSearch'
import SummaryCards            from '@/components/market-research/SummaryCards'
import RelatedKeywords         from '@/components/market-research/RelatedKeywords'
import ProductsTable           from '@/components/market-research/ProductsTable'
import SourceSelector          from '@/components/market-research/SourceSelector'
import KalodataCredentialModal from '@/components/market-research/KalodataCredentialModal'
import LogModal                from '@/components/market-research/LogModal'
import ResearchHistory         from '@/components/market-research/ResearchHistory'

const TrendChart       = dynamic(() => import('@/components/market-research/TrendChart'),       { ssr: false })
const IngredientsChart = dynamic(() => import('@/components/market-research/IngredientsChart'), { ssr: false })

const POLL_INTERVAL = 2500
const POLL_TIMEOUT  = 120000 // 2 min — Kalodata scraping takes longer

export default function MarketResearchPage() {
  const [source,        setSource]        = useState('tokopedia')
  const [credStatus,    setCredStatus]    = useState({ exists: false, maskedPhone: null })
  const [showCredModal, setShowCredModal] = useState(false)

  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [research,      setResearch]      = useState(null)
  const [activeKw,      setActiveKw]      = useState(null)
  const [logs,          setLogs]          = useState([])
  const [showLogModal,  setShowLogModal]  = useState(false)
  const [history,       setHistory]       = useState([])
  const [histRefreshing,setHistRefreshing]= useState(false)

  const pollRef  = useRef(null)
  const startRef = useRef(null)

  // Load credential status on mount
  useEffect(() => {
    fetch('/api/market-research/kalodata-credential')
      .then(r => r.json())
      .then(data => setCredStatus({ exists: data.exists, maskedPhone: data.maskedPhone ?? null }))
      .catch(() => {})
  }, [])

  // Load research history on mount
  useEffect(() => { fetchHistory() }, [])

  async function fetchHistory() {
    setHistRefreshing(true)
    try {
      const r    = await fetch('/api/market-research')
      const data = await r.json()
      if (Array.isArray(data)) setHistory(data)
    } catch {}
    finally { setHistRefreshing(false) }
  }

  // Load a past research from history
  async function handleLoadHistory(item) {
    stopPolling()
    setLoading(true)
    setError(null)
    setResearch(null)
    setLogs([])
    setShowLogModal(false)
    try {
      const r    = await fetch(`/api/market-research/${item.id}`)
      const data = await r.json()
      setResearch(data)
      setSource(data.source)
      setActiveKw(data.keyword)
    } catch (e) {
      setError('Failed to load research: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => () => stopPolling(), [])

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  function handleSourceChange(newSource) {
    setSource(newSource)
    setResearch(null)
    setError(null)
  }

  async function handleSearch(keyword) {
    if (source === 'kalodata' && !credStatus.exists) {
      setShowCredModal(true)
      return
    }

    stopPolling()
    setLoading(true)
    setError(null)
    setResearch(null)
    setActiveKw(keyword)
    setLogs([])
    if (source === 'kalodata') setShowLogModal(true)

    try {
      const res = await fetch('/api/market-research', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ keyword, source }),
      })
      const { id, cached, error: err } = await res.json()
      if (err || !id) throw new Error(err || 'Failed to start research')

      // Cached result — fetch immediately
      if (cached) {
        const r    = await fetch(`/api/market-research/${id}`)
        const data = await r.json()
        setResearch(data)
        setLoading(false)
        return
      }

      startRef.current = Date.now()
      pollRef.current  = setInterval(async () => {
        if (Date.now() - startRef.current > POLL_TIMEOUT) {
          stopPolling(); setLoading(false)
          setError('Research timed out. Please try again.')
          return
        }
        try {
          const r    = await fetch(`/api/market-research/${id}`)
          const data = await r.json()
          // Update logs from DB on every poll (Kalodata only)
          if (Array.isArray(data.logs)) setLogs(data.logs)
          if (data.status === 'done') {
            stopPolling(); setResearch(data); setLoading(false)
            fetchHistory() // refresh history panel
            // Keep log modal open briefly so user can see completion, then auto-close
            setTimeout(() => setShowLogModal(false), 2500)
          } else if (data.status === 'failed') {
            stopPolling(); setLoading(false)
            setError(source === 'kalodata'
              ? 'Kalodata scraping failed. Check your credentials or try again later.'
              : 'Research failed. Data source may be temporarily unavailable.')
            // Keep log modal open so user can see the error logs
          }
        } catch {}
      }, POLL_INTERVAL)

    } catch (e) {
      setLoading(false)
      setError(e.message)
    }
  }

  const trendsData     = research?.trendsData     ?? null
  const products       = research?.products       ?? []
  const summary        = research?.summary        ?? null
  const topIngredients = summary?.top_ingredients ?? []
  const resSource      = research?.source ?? 'tokopedia'
  const resIsKalodata  = resSource === 'kalodata'
  const resIsShopee    = resSource === 'shopee'

  const loadingMsg = source === 'kalodata'
    ? 'Logging into Kalodata and scraping product data… (this may take 30–90 seconds)'
    : source === 'shopee'
      ? 'Fetching Shopee Indonesia product data…'
      : 'Fetching Google Trends & Tokopedia data for Indonesia…'

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(224,123,57,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fas fa-chart-pie" style={{ color: 'var(--color-orange)', fontSize: 16 }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-dark1)' }}>Market Research</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#999' }}>Analisa pasar Indonesia berdasarkan keyword produk</p>
        </div>
      </div>

      {/* Source selector */}
      <SourceSelector
        source={source}
        onSourceChange={handleSourceChange}
        credentialStatus={credStatus}
        onSetupCredential={() => setShowCredModal(true)}
      />

      {/* Keyword search */}
      <KeywordSearch onSearch={handleSearch} loading={loading} />

      {/* Research history */}
      <ResearchHistory
        history={history}
        currentId={research?.id ?? null}
        onLoad={handleLoadHistory}
        onRefresh={fetchHistory}
        refreshing={histRefreshing}
      />

      {/* Error */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-circle-exclamation" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ background: 'white', border: '1px solid var(--color-cream)', borderRadius: 10, padding: '32px 24px', textAlign: 'center' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, color: source === 'kalodata' ? '#3B82F6' : source === 'shopee' ? '#EE4D2D' : 'var(--color-orange)', marginBottom: 12 }} />
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-dark1)', fontSize: 14 }}>
            Researching &ldquo;{activeKw}&rdquo;…
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#999' }}>{loadingMsg}</p>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────── */}
      {research && !loading && (
        <>
          {/* Source + meta badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: resIsKalodata ? 'rgba(59,130,246,.08)' : resIsShopee ? 'rgba(238,77,45,.08)' : 'rgba(224,123,57,.08)',
              border: `1px solid ${resIsKalodata ? 'rgba(59,130,246,.2)' : resIsShopee ? 'rgba(238,77,45,.2)' : 'rgba(224,123,57,.2)'}`,
              borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
              color: resIsKalodata ? '#3B82F6' : resIsShopee ? '#EE4D2D' : 'var(--color-orange)',
            }}>
              <i className={`fas ${resIsKalodata ? 'fa-chart-bar' : resIsShopee ? 'fa-bag-shopping' : 'fa-store'}`} />
              {resIsKalodata ? 'Kalodata · TikTok Shop Indonesia' : resIsShopee ? 'Shopee Indonesia' : 'Tokopedia + Google Trends'}
            </span>
            <span style={{ fontSize: 11, color: '#bbb' }}>
              &ldquo;{research.keyword}&rdquo; · {products.length} produk
            </span>
          </div>

          {/* Tokopedia / Shopee KPI cards (both have numeric price data) */}
          {!resIsKalodata && <SummaryCards summary={summary} />}

          {/* Kalodata mini KPIs */}
          {resIsKalodata && products.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'Total Produk',  value: products.length,                                                            icon: 'fa-box',   color: '#3B82F6',             bg: '#EFF6FF' },
                { label: 'Top Produk',    value: (products[0]?.name ?? '—').slice(0, 32) + ((products[0]?.name?.length > 32) ? '…' : ''), icon: 'fa-crown', color: 'var(--color-orange)', bg: 'rgba(224,123,57,.08)' },
                { label: 'Revenue #1',    value: products[0]?.revenue ?? '—',                                                icon: 'fa-sack-dollar', color: '#10B981',        bg: '#ECFDF5' },
              ].map(c => (
                <div key={c.label} className="sv-kpi-tile">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fas ${c.icon}`} style={{ color: c.color, fontSize: 14 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="sv-kpi-label">{c.label}</div>
                    <div className="sv-kpi-value" title={String(c.value)}>{c.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Google Trends chart + related keywords (shown for both sources) */}
          {trendsData?.timeline?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }}>
              <div style={{ background: 'white', border: '1px solid var(--color-cream)', borderRadius: 10, overflow: 'hidden' }}>
                <div className="sv-panel-header">
                  <span className="sv-panel-title">
                    <i className="fas fa-chart-line" style={{ color: 'var(--color-orange)' }} />
                    Google Trends – Indonesia (12 bulan)
                  </span>
                  <span style={{ fontSize: 11, color: '#bbb' }}>Source: Google Trends</span>
                </div>
                <div style={{ padding: '12px 16px', height: 220 }}>
                  <TrendChart trendsData={trendsData} />
                </div>
              </div>
              <div style={{ background: 'white', border: '1px solid var(--color-cream)', borderRadius: 10, overflow: 'hidden' }}>
                <div className="sv-panel-header">
                  <span className="sv-panel-title">
                    <i className="fas fa-magnifying-glass" style={{ color: 'var(--color-orange)' }} />
                    Kata Kunci Terkait
                  </span>
                </div>
                <div style={{ padding: '12px 14px', overflowY: 'auto', maxHeight: 232 }}>
                  <RelatedKeywords trendsData={trendsData} />
                </div>
              </div>
            </div>
          )}

          {/* Products table */}
          {products.length > 0 && (
            <div className="sv-section-card">
              <div className="sv-panel-header" style={{ padding: '8px 14px' }}>
                <span className="sv-panel-title">
                  <i className="fas fa-store" style={{ color: resIsKalodata ? '#3B82F6' : resIsShopee ? '#EE4D2D' : 'var(--color-orange)' }} />
                  {resIsKalodata ? 'Top Produk – Kalodata (TikTok Shop)' : resIsShopee ? 'Top Produk – Shopee Indonesia' : 'Top Produk – Tokopedia'}
                  <span style={{ background: 'var(--color-bg)', border: '1px solid var(--color-cream)', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600, color: '#888' }}>
                    {products.length}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: '#bbb' }}>{resIsKalodata ? 'kalodata.com' : resIsShopee ? 'shopee.co.id · by: terlaris' : 'Sorted by: terlaris'}</span>
              </div>
              <ProductsTable products={products} source={resSource} />
            </div>
          )}

          {/* Ingredients chart */}
          {topIngredients.length > 0 && (
            <div style={{ background: 'white', border: '1px solid var(--color-cream)', borderRadius: 10, overflow: 'hidden' }}>
              <div className="sv-panel-header">
                <span className="sv-panel-title">
                  <i className="fas fa-flask" style={{ color: 'var(--color-orange)' }} />
                  Top Ingredients (dari nama produk)
                </span>
                <span style={{ fontSize: 11, color: '#bbb' }}>Ditemukan di {products.length} produk</span>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <IngredientsChart ingredients={topIngredients} />
              </div>
            </div>
          )}

          {/* Top Brands / Toko (Tokopedia) or Top Lokasi (Shopee) */}
          {!resIsKalodata && summary?.top_brands?.length > 0 && (
            <div style={{ background: 'white', border: '1px solid var(--color-cream)', borderRadius: 10, overflow: 'hidden' }}>
              <div className="sv-panel-header">
                <span className="sv-panel-title">
                  <i className="fas fa-crown" style={{ color: resIsShopee ? '#EE4D2D' : 'var(--color-orange)' }} />
                  {resIsShopee ? 'Top Lokasi Penjual' : 'Top Brands / Toko'}
                </span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {summary.top_brands.map((b, i) => (
                  <div key={b.name} style={{
                    background: i === 0 ? (resIsShopee ? 'rgba(238,77,45,.08)' : 'rgba(224,123,57,.08)') : 'var(--color-bg)',
                    border: `1px solid ${i === 0 ? (resIsShopee ? 'rgba(238,77,45,.25)' : 'rgba(224,123,57,.25)') : 'var(--color-cream)'}`,
                    borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? (resIsShopee ? '#EE4D2D' : 'var(--color-orange)') : '#aaa' }}>#{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-dark1)' }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{b.count} produk ditemukan</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!research && !loading && !error && (
        <div style={{ background: 'white', border: '1px solid var(--color-cream)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
          <i className="fas fa-chart-pie" style={{ fontSize: 36, color: 'rgba(224,123,57,.3)', marginBottom: 14 }} />
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-dark1)', fontSize: 15 }}>Mulai Riset Pasar</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#999', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
            {source === 'kalodata' && !credStatus.exists
              ? 'Setup Kalodata credentials terlebih dahulu, lalu masukkan keyword untuk riset data TikTok Shop Indonesia.'
              : 'Masukkan keyword produk di atas untuk melihat tren, produk terlaris, harga rata-rata, dan top ingredients.'}
          </p>
        </div>
      )}

      {/* Kalodata terminal log modal */}
      <LogModal
        isOpen={showLogModal}
        keyword={activeKw ?? ''}
        logs={logs}
        status={loading ? 'processing' : (research ? research.status : (error ? 'failed' : 'processing'))}
      />

      {/* Credential modal */}
      <KalodataCredentialModal
        isOpen={showCredModal}
        onClose={() => setShowCredModal(false)}
        onSaved={status => setCredStatus(status)}
        existingPhone={credStatus.maskedPhone}
      />

    </div>
  )
}
