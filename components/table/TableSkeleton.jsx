export default function TableSkeleton({ rows = 8, cols = 6 }) {
  return (
    <table className="sv-table w-full">
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i} className="bg-dark1 text-white text-xs font-semibold px-3 py-2 text-left whitespace-nowrap border-b-2 border-orange">
              <div className="h-3 bg-white/20 rounded animate-pulse w-16" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c} className="px-3 py-1.5 border-b border-cream/40">
                <div className="h-3 bg-dark1/10 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
