export default function Input({ label, error, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input className="form-input" {...props} />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
