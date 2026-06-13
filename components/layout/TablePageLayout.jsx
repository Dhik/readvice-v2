'use client'

/**
 * Category D layout — "filters/topbar + one big table" (single full-width panel).
 * Modeled after app/(dashboard)/settings/connectors/page.jsx.
 *
 * Responsive automatically: .sv-page / .sv-main collapse on mobile, and the wide
 * table scrolls horizontally inside .sv-panel-body (overflow: auto) on every
 * size. No responsive logic implemented here.
 *
 * @example
 *   <TablePageLayout
 *     topbar={
 *       <div className="sv-topbar">
 *         <span className="sv-topbar-title">…</span>
 *         <button className="sv-tbtn sv-tbtn-success ml-auto">New</button>
 *       </div>
 *     }
 *     title="Connectors"
 *   >
 *     <table className="sv-table-clean"> … </table>
 *   </TablePageLayout>
 */
export default function TablePageLayout({ topbar, title, children, className = '' }) {
  return (
    <div className={`sv-page ${className}`.trim()}>
      {topbar}
      <div className="sv-main">
        <div className="sv-panel" style={{ flex: 1 }}>
          {title && <div className="sv-panel-header">{title}</div>}
          <div className="sv-panel-body p-0">{children}</div>
        </div>
      </div>
    </div>
  )
}
