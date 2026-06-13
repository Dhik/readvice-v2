'use client'

export default function MonthPicker({ value, onChange, label = 'Month' }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-dark1/60 font-medium">{label}:</span>}
      <input
        type="month"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="form-input !w-auto text-xs py-1"
      />
    </div>
  )
}
