const VARIANTS = {
  success:  'badge-success',
  warning:  'badge-warning',
  danger:   'badge-danger',
  info:     'badge-info',
  orange:   'badge-orange',
}

export default function Badge({ children, variant = 'info' }) {
  return (
    <span className={`badge ${VARIANTS[variant] ?? 'badge-info'}`}>
      {children}
    </span>
  )
}
