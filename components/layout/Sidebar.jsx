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
  faCog, faBuilding, faUsers, faRobot, faPlug, faCubes, faChartColumn,
} from '@fortawesome/free-solid-svg-icons'

// Nav structure: top-level items or collapsible groups
const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: faTachometerAlt },
  { label: 'Sales',     href: '/sales',     icon: faChartLine },
  { label: 'Orders',    href: '/orders',    icon: faShoppingCart },
  { label: 'Campaigns', href: '/campaigns', icon: faBullhorn },
  {
    group: 'Ads', icon: faMoneyBillWave,
    items: [
      { label: 'Ad Spend',    href: '/ads/marketplace',  icon: faMoneyBillWave },
      { label: 'AI Insights', href: '/ads/ai-insights',  icon: faRobot },
    ],
  },
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
    group: 'Analytics', icon: faChartBar,
    items: [
      { label: 'Product Analysis', href: '/analytics/products', icon: faCubes }, // SP1 — more SP modules append here
      { label: 'Order Analysis',   href: '/analytics/orders',   icon: faChartColumn }, // SP2
      { label: 'Report',    href: '/report',   icon: faFileAlt },
      { label: 'Customers', href: '/customer', icon: faUserFriends },
    ],
  },
  { label: 'Market Research', href: '/market-research', icon: faChartPie },
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
                {subItems.map(sub => {
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
