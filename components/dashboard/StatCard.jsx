'use client'
// Micro-stat cards (the /campaign metric-card pattern): p-1.5, text-[9px] label /
// text-xs value. Wrap StatCards in a MetricRow (flex gap-1).
//
//   <MetricRow><StatCard label="Avg ROAS" value="2.4×" /><StatCard … /></MetricRow>
export function MetricRow({ children, className = '' }) {
  return <div className={`metric-row ${className}`.trim()}>{children}</div>
}

export function StatCard({ label, value }) {
  return (
    <div className="metric-card">
      <div className="metric-card-label">{label}</div>
      <div className="metric-card-value">{value}</div>
    </div>
  )
}

export default StatCard
