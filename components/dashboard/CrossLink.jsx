'use client'
import Link from 'next/link'

// Cross-link affordance for the Part-A entry→drill flow: operational pages link to
// their analytics counterpart ("View full analysis →"), legacy CRUD pages link to
// their analysis lens ("Analyze →"), and analytics modules link back to the legacy
// data-entry surface ("Manage data →"). Compact, reuses the .sv-tbtn styling so it
// drops cleanly into any sv-topbar / CompactTopbar actions slot.
export default function CrossLink({ href, label = 'View full analysis', icon = 'fa-arrow-trend-up', variant = 'sv-tbtn-ghost' }) {
  return (
    <Link href={href} className={`sv-tbtn ${variant}`} title={`${label} →`}>
      {icon && <i className={`fas ${icon}`} />} {label} <span aria-hidden="true">→</span>
    </Link>
  )
}
