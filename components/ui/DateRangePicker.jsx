'use client'

export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, label = 'Date Range' }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-dark1/60 font-medium">{label}:</span>}
      <input
        type="date"
        value={startDate}
        onChange={e => onStartChange(e.target.value)}
        className="form-input !w-auto text-xs py-1"
      />
      <span className="text-xs text-dark1/40">to</span>
      <input
        type="date"
        value={endDate}
        onChange={e => onEndChange(e.target.value)}
        className="form-input !w-auto text-xs py-1"
      />
    </div>
  )
}
