'use client'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Topbar  from './Topbar'
import { SessionProvider } from 'next-auth/react'

export default function DashboardLayout({ children, title, banner }) {
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  function toggleCollapse() {
    setCollapsed(c => {
      localStorage.setItem('sidebar-collapsed', String(!c))
      return !c
    })
  }

  return (
    <SessionProvider>
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <div className="flex h-screen bg-bg overflow-hidden">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <div className={`main-content flex-1 flex flex-col overflow-hidden${collapsed ? ' main-collapsed' : ''}`}>
          <Topbar
            title={title}
            onToggle={toggleCollapse}
            onMobileMenu={() => setMobileOpen(true)}
            collapsed={collapsed}
          />
          {banner}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}
