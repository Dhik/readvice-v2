'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartLine, faShoppingCart, faBullhorn,
  faFilm, faMoneyBillWave, faFileAlt, faUserFriends,
  faTachometerAlt, faTimes, faIdCard, faCamera,
  faCreditCard, faChartBar, faCheckCircle,
  faStore, faChevronDown, faChartPie,
  faCog, faBuilding, faUsers, faRobot, faPlug, faCubes, faChartColumn, faCoins, faWarehouse, faTableCells, faDiagramProject, faArrowTrendUp, faBullseye,
} from '@fortawesome/free-solid-svg-icons'

// Nav structure (Part A — IA regroup by theme): four render modes —
//  • { section }           non-clickable top-level divider/label for a theme group
//  • { label, href, icon } direct link
//  • { group, items }      collapsible group; items may contain { subheader } labels
//  • { subheader }         non-clickable sub-header inside a group's items
// Routes / icons / permission gates are preserved from the original flat nav —
// this is a reorder/regroup only.
const NAV = [
  // 1 ── Home / Operational ─────────────────────────────────────────────
  { section: 'Home / Operational' },
  { label: 'Dashboard', href: '/dashboard', icon: faTachometerAlt },
  { label: 'Sales',     href: '/sales',     icon: faChartLine },
  { label: 'Orders',    href: '/orders',    icon: faShoppingCart },
  { label: 'Customers', href: '/customer',  icon: faUserFriends },
  { label: 'Report',    href: '/report',    icon: faFileAlt },

  // 2 ── Analytics (themed sub-groups, not flat) ────────────────────────
  {
    group: 'Analytics', icon: faChartBar,
    items: [
      { subheader: 'Customer' },
      { label: 'RFM Segments',     href: '/analytics/rfm',      icon: faUserFriends }, // customer segmentation (real + dummy padding)
      { label: 'Cohort Retention', href: '/analytics/cohort',   icon: faTableCells }, // triangular heatmap, 1/36 real, becomes real w/ time
      { label: 'Market Basket',    href: '/analytics/basket',   icon: faDiagramProject }, // co-purchase affinity, real small-sample
      { label: 'CLV',              href: '/analytics/clv',      icon: faCoins }, // Wave 3.1 — historic value real, projection dummy-flagged

      { subheader: 'Marketing' },
      { label: 'Ads Allocation',      href: '/analytics/ads-allocation',      icon: faMoneyBillWave }, // spend allocation (100% real, expense-only)
      { label: 'Campaign Efficiency', href: '/analytics/campaign-efficiency', icon: faBullhorn }, // cross-campaign content efficiency (reported-GMV)
      { label: 'Talent ROI',          href: '/analytics/talent-roi',          icon: faIdCard }, // real cost ÷ dummy return (Wave 2)
      { label: 'True ROAS',           href: '/analytics/roas',                icon: faBullseye }, // Wave 3.2 — real spend ÷ dummy attribution

      { subheader: 'Product & Finance' },
      { label: 'BCG Matrix',       href: '/analytics/bcg',      icon: faChartPie }, // product matrix (dummy axes in dev)
      { label: 'Gross Margin',     href: '/analytics/gross-margin', icon: faCoins }, // revenue − HPP (gross only, real)
      { label: 'Product Analysis', href: '/analytics/products', icon: faCubes }, // SP1
      { label: 'Order Analysis',   href: '/analytics/orders',   icon: faChartColumn }, // SP2
      { label: 'AI Forecast',      href: '/analytics/forecast', icon: faArrowTrendUp }, // Wave 3.4 — readiness gate (no forecast until ≥12mo)

      { subheader: 'Operations' },
      { label: 'Operational',      href: '/analytics/operational', icon: faWarehouse }, // funnel/stock real, fulfilment dummy (Wave 2)
    ],
  },

  // 3 ── Marketing Modules (legacy data-entry / CRUD surfaces) ──────────
  { section: 'Marketing Modules' },
  { label: 'Campaigns', href: '/campaigns', icon: faBullhorn },
  {
    group: 'Talent', icon: faIdCard,
    items: [
      { label: 'Talent',      href: '/talent',                  icon: faIdCard },
      { label: 'Content',     href: '/talent/content',          icon: faCamera },
      { label: 'Payments',    href: '/talent/payments',         icon: faCreditCard },
      { label: 'Fin. Report', href: '/talent/payments/report',  icon: faChartBar },
      { label: 'Approval',    href: '/talent/approval',         icon: faCheckCircle },
    ],
  },
  {
    group: 'Affiliate', icon: faStore,
    items: [
      { label: 'Shopee', href: '/affiliate/shopee', icon: faStore },
      { label: 'TikTok', href: '/affiliate/tiktok', icon: faFilm },
    ],
  },
  {
    group: 'Ads', icon: faMoneyBillWave,
    items: [
      { label: 'Ad Spend',    href: '/ads/marketplace',  icon: faMoneyBillWave },
      { label: 'AI Insights', href: '/ads/ai-insights',  icon: faRobot },
    ],
  },

  // 4 ── Market Research (standalone) ───────────────────────────────────
  { label: 'Market Research', href: '/market-research', icon: faChartPie },

  // 5 ── Settings / Account ─────────────────────────────────────────────
  { section: 'Settings / Account' },
  {
    group: 'Settings', icon: faCog,
    items: [
      { label: 'Tenants',    href: '/settings/tenants',    icon: faBuilding },
      { label: 'Users',      href: '/settings/users',      icon: faUsers },
      { label: 'Connectors', href: '/settings/connectors', icon: faPlug, superadminOnly: true },
    ],
  },
  {
    group: 'Account', icon: faCreditCard,
    items: [
      { label: 'Billing', href: '/billing', icon: faCreditCard },
    ],
  },
]

function itemIsActive(href, pathname) {
  if (href === '/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

function groupHasActive(items, pathname) {
  return items.some(item => itemIsActive(item.href, pathname))
}

function getInitialOpen(pathname) {
  const open = {}
  NAV.forEach(item => {
    if (item.group && groupHasActive(item.items, pathname)) {
      open[item.group] = true
    }
  })
  return open
}

export default function Sidebar({ collapsed, mobileOpen, onClose }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false
  const [openGroups, setOpenGroups] = useState(() => getInitialOpen(pathname))

  // Auto-open the group when navigating to a page inside it
  useEffect(() => {
    NAV.forEach(item => {
      if (item.group && groupHasActive(item.items, pathname)) {
        setOpenGroups(prev => ({ ...prev, [item.group]: true }))
      }
    })
  }, [pathname])

  const toggle = (group) => setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }))

  const classes = ['sidebar']
  if (collapsed)  classes.push('sidebar-collapsed')
  if (mobileOpen) classes.push('sidebar-mobile-open')

  return (
    <aside className={classes.join(' ')}>
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="text-orange font-bold text-lg tracking-wide">
          {collapsed ? 'R' : 'Readvice'}
        </span>
        {!collapsed && (
          <button onClick={onClose} className="ml-auto text-cream/50 hover:text-cream md:hidden p-1" aria-label="Close">
            <FontAwesomeIcon icon={faTimes} className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {NAV.map((item, i) => {

          /* ── Top-level section header (non-clickable theme divider) ── */
          if (item.section) {
            if (collapsed) return <div key={`sec-${i}`} className="my-2 mx-3 border-t border-white/5" />
            return (
              <div key={`sec-${i}`} className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider select-none"
                   style={{ color: 'rgba(220,215,201,0.32)' }}>
                {item.section}
              </div>
            )
          }

          /* ── Direct link (no group) ── */
          if (!item.group) {
            const active = itemIsActive(item.href, pathname)
            return (
              <Link key={item.href} href={item.href} onClick={onClose}
                    className={`sidebar-nav-item ${active ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}>
                <FontAwesomeIcon icon={item.icon} className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          }

          /* ── Collapsible group ── */
          // Hide superadmin-only sub-items from non-superadmins.
          const subItems = item.items.filter(s => !s.superadminOnly || isSuperAdmin)
          if (subItems.length === 0) return null
          const hasActive = groupHasActive(subItems, pathname)
          // In collapsed sidebar, always show items (no toggle UI)
          const isOpen = collapsed ? true : (openGroups[item.group] ?? false)

          return (
            <div key={item.group}>
              {/* Group header — hidden when sidebar is collapsed */}
              {!collapsed && (
                <button
                  onClick={() => toggle(item.group)}
                  className="sidebar-group-btn"
                  style={{ color: hasActive ? 'rgba(224,123,57,0.85)' : 'rgba(220,215,201,0.45)' }}
                  onMouseEnter={e => { if (!hasActive) e.currentTarget.style.color = 'rgba(220,215,201,0.75)' }}
                  onMouseLeave={e => { if (!hasActive) e.currentTarget.style.color = 'rgba(220,215,201,0.45)' }}
                >
                  <FontAwesomeIcon icon={item.icon} className="w-3 h-3 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.group}</span>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className="w-2.5 h-2.5 flex-shrink-0"
                    style={{
                      transition: 'transform 0.22s ease',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
              )}

              {/* Group items — animated slide */}
              <div
                style={{
                  maxHeight: isOpen ? `${subItems.length * 44}px` : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.22s ease',
                  borderLeft: !collapsed ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  marginLeft: !collapsed ? '1.25rem' : '0',
                }}
              >
                {subItems.map((sub, si) => {
                  /* ── Themed sub-header (non-clickable) ── */
                  if (sub.subheader) {
                    if (collapsed) return null
                    return (
                      <div key={`sub-${si}`} className="px-2 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wider select-none"
                           style={{ color: 'rgba(220,215,201,0.3)' }}>
                        {sub.subheader}
                      </div>
                    )
                  }
                  const active = itemIsActive(sub.href, pathname)
                  return (
                    <Link key={sub.href} href={sub.href} onClick={onClose}
                          className={`sidebar-sub-item ${active ? 'active' : ''}`}
                          title={collapsed ? sub.label : undefined}>
                      <FontAwesomeIcon icon={sub.icon} className="w-3.5 h-3.5 flex-shrink-0" />
                      {!collapsed && <span>{sub.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
