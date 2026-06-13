export default function Select({ label, options = [], error, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <select className="form-input" {...props}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
