'use client'
// Dense toolbar (sv-topbar): title + optional `actions` (buttons, right after the
// title) + `children` (filters, pushed right via ml-auto). Use the `sv-tbtn` /
// `sv-tbtn-{dark,primary,ghost,success}` classes for h-7 compact buttons.
export default function CompactTopbar({ title, icon, actions, children }) {
  return (
    <div className="sv-topbar">
      {title != null && (
        <span className="sv-topbar-title">
          {icon && <i className={`fas ${icon} text-dark2`} />} {title}
        </span>
      )}
      {actions}
      {children != null && (
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">{children}</div>
      )}
    </div>
  )
}
