'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSignOutAlt, faUser, faBars, faRobot,
  faBuilding, faChevronDown, faCheck, faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import toast from 'react-hot-toast'

export default function Topbar({ title, onToggle, onMobileMenu, collapsed }) {
  const { data: session, update } = useSession()
  const router = useRouter()

  const [tenants,    setTenants]    = useState([])
  const [open,       setOpen]       = useState(false)
  const [switching,  setSwitching]  = useState(false)
  const dropdownRef = useRef(null)

  // Fetch accessible tenants once session is ready
  useEffect(() => {
    if (!session?.user) return
    fetch('/api/tenant/list')
      .then(r => r.json())
      .then(d => setTenants(d.tenants ?? []))
      .catch(() => {})
  }, [session?.user?.id])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function switchTenant(id) {
    if (id === session?.user?.tenantId || switching) return
    setSwitching(true)
    setOpen(false)
    try {
      const res = await fetch('/api/tenant/switch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tenantId: id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Switch failed')
        return
      }
      await update()      // trigger === 'update' in jwt callback → re-reads currentTenantId from DB
      router.refresh()    // reload all RSCs with the new session tenantId
    } catch {
      toast.error('Switch failed')
    } finally {
      setSwitching(false)
    }
  }

  const currentTenant = tenants.find(t => t.id === session?.user?.tenantId)

  return (
    <header className="topbar">
      <div className="flex items-center gap-2">
        {/* Desktop: collapse/expand toggle */}
        <button
          onClick={onToggle}
          className="topbar-toggle hidden md:flex"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <FontAwesomeIcon icon={faBars} className="w-3.5 h-3.5" />
        </button>

        {/* Mobile: hamburger */}
        <button
          onClick={onMobileMenu}
          className="topbar-toggle md:hidden"
          aria-label="Open menu"
        >
          <FontAwesomeIcon icon={faBars} className="w-3.5 h-3.5" />
        </button>

        <span className="topbar-title">{title}</span>
      </div>

      <div className="flex items-center gap-3">
        {/* AI Insights — quick access (the page is no longer in the sidebar) */}
        <Link
          href="/ads/ai-insights"
          title="AI Insights"
          aria-label="AI Insights"
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange/10 text-orange hover:bg-orange hover:text-white transition-colors"
        >
          <FontAwesomeIcon icon={faRobot} className="w-3.5 h-3.5" />
        </Link>

        {/* Brand switcher — only shown when user has access to more than one tenant */}
        {tenants.length > 1 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen(o => !o)}
              disabled={switching}
              className="btn btn-outline btn-sm flex items-center gap-1.5"
              title="Switch brand"
            >
              {switching
                ? <FontAwesomeIcon icon={faSpinner} className="w-3 h-3 animate-spin" />
                : <FontAwesomeIcon icon={faBuilding} className="w-3 h-3" />
              }
              <span className="hidden sm:inline max-w-[120px] truncate">
                {currentTenant?.name ?? '—'}
              </span>
              <FontAwesomeIcon icon={faChevronDown} className="w-2.5 h-2.5 opacity-60" />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-white border border-cream rounded-lg shadow-sm py-1 overflow-hidden">
                {tenants.map(t => (
                  <button
                    key={t.id}
                    onClick={() => switchTenant(t.id)}
                    className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 transition-colors
                      ${t.id === session?.user?.tenantId
                        ? 'text-orange font-semibold bg-orange/5'
                        : 'text-dark1 hover:bg-dark1/5'
                      }`}
                  >
                    <FontAwesomeIcon
                      icon={faCheck}
                      className={`w-3 h-3 flex-shrink-0 ${t.id === session?.user?.tenantId ? 'opacity-100' : 'opacity-0'}`}
                    />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {session?.user?.name && (
          <span className="text-sm text-dark1/60 items-center gap-2 hidden sm:flex">
            <FontAwesomeIcon icon={faUser} className="w-3 h-3" />
            {session.user.name}
          </span>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="btn btn-outline btn-sm flex items-center gap-1"
        >
          <FontAwesomeIcon icon={faSignOutAlt} className="w-3 h-3" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
