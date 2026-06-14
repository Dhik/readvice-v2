'use client'
// Compact card (sv-panel) with the dense header (sv-panel-header: px-3 py-1.5,
// #fafaf8, text-xs font-semibold). `bodyClass` controls body padding — use 'p-0'
// for flush charts/tables, 'p-2' (default) otherwise.
//
// CONVENTION: charts inside CompactPanel use FIXED heights ~120–160px (compact),
// vs the analytics pages (SP1/SP2) which use 180–260px. Wrap a chart in
// <div style={{ height: 140 }}><Chart…/></div>.
export default function CompactPanel({ title, icon, headerRight, bodyClass = 'p-2', className = '', style, children }) {
  return (
    <div className={`sv-panel ${className}`.trim()} style={style}>
      {title != null && (
        <div className="sv-panel-header">
          <span className="sv-panel-title">
            {icon && <i className={`fas ${icon} text-dark2`} />} {title}
          </span>
          {headerRight}
        </div>
      )}
      <div className={`sv-panel-body ${bodyClass}`.trim()}>{children}</div>
    </div>
  )
}
