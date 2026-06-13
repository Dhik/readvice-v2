export default function Button({ children, variant = 'primary', size = '', onClick, type = 'button', disabled = false, className = '' }) {
  const variants = {
    primary: 'btn-primary',
    dark:    'btn-dark',
    outline: 'btn-outline',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${variants[variant] ?? ''} ${size === 'sm' ? 'btn-sm' : ''} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}
