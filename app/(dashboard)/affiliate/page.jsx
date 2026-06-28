'use client'
// Unified Affiliate page (one page, two tabs) — hosts the existing Shopee and TikTok
// affiliate views inline. The standalone /affiliate/shopee and /affiliate/tiktok routes
// still work; this is the single combined entry the sidebar links to. Tab is reflected
// in ?tab= so it's linkable/back-button friendly.
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AffiliateShopeeePage from '@/components/affiliate/shopee/AffiliateShopeeePage'
import AffiliateTiktokPage from '@/components/affiliate/tiktok/AffiliateTiktokPage'

const TABS = [
  { key: 'shopee', label: 'Shopee' },
  { key: 'tiktok', label: 'TikTok' },
]

function AffiliateTabs() {
  const router = useRouter()
  const params = useSearchParams()
  const initial = TABS.some(t => t.key === params.get('tab')) ? params.get('tab') : 'shopee'
  const [tab, setTab] = useState(initial)

  function select(key) {
    setTab(key)
    const sp = new URLSearchParams(Array.from(params.entries()))
    sp.set('tab', key)
    router.replace(`/affiliate?${sp.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 54px)' }}>
      {/* Tab bar — uses the app-wide .tab-pill style (same as /ads/marketplace) */}
      <div className="flex items-center px-4 pt-3 pb-2 bg-bg flex-shrink-0">
        <div className="tab-pills">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => select(t.key)}
              className={`tab-pill ${tab === t.key ? 'active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Render only the active tab's view (each provides its own sv-page) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'shopee' ? <AffiliateShopeeePage /> : <AffiliateTiktokPage />}
      </div>
    </div>
  )
}

export default function AffiliatePage() {
  return (
    <Suspense fallback={<div className="p-4 text-dark1/40 text-xs">Loading…</div>}>
      <AffiliateTabs />
    </Suspense>
  )
}
