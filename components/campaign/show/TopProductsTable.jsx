'use client'

function fmt(v) { return new Intl.NumberFormat('id-ID').format(v ?? 0) }

export default function TopProductsTable({ data }) {
  if (!data?.length) return null

  return (
    <div className="sv-section-card mb-3">
      <div className="sv-panel-header">
        <span className="sv-panel-title">
          <i className="fas fa-box-open text-dark2"></i> Top Products Performance
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#fafaf8] border-b border-cream">
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-dark2 uppercase tracking-wide">Product</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-dark2 uppercase tracking-wide">Views</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-dark2 uppercase tracking-wide">Spend</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-dark2 uppercase tracking-wide">Content</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-dark2 uppercase tracking-wide">CPM</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-dark2 uppercase tracking-wide">Target</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-cream/50 hover:bg-bg/40">
                <td className="px-3 py-1.5 font-medium text-dark1">{row.product ?? '—'}</td>
                <td className="px-3 py-1.5 text-right text-dark2">{fmt(row.total_views)}</td>
                <td className="px-3 py-1.5 text-right text-dark2">{fmt(row.total_spend)}</td>
                <td className="px-3 py-1.5 text-right text-dark2">{fmt(row.total_content)}</td>
                <td className="px-3 py-1.5 text-right text-dark2">{fmt(row.cpm)}</td>
                <td className="px-3 py-1.5 text-dark2">{row.target ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
