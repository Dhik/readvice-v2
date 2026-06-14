'use client'
// Compact page shell (matches /campaign density: sv-page flex-col gap-2).
// scroll=true (DEFAULT) overrides sv-page's fixed height/overflow-hidden so
// multi-card dashboards SCROLL instead of clipping (the known .sv-page issue).
// Pass scroll={false} for a single-screen page that should stay fixed-height.
// pad=true (DEFAULT) gives the content a gutter on all sides so cards don't sit
// flush against the sidebar / window edge (px-3 py-3, matching sv-main's p-3).
export default function CompactPage({ children, scroll = true, pad = true, className = '' }) {
  return (
    <div className={`sv-page ${pad ? 'p-3' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
      style={scroll ? { height: 'auto', overflow: 'visible' } : undefined}>
      {children}
    </div>
  )
}
