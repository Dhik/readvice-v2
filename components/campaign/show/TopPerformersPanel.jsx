'use client'

function formatNum(v) { return new Intl.NumberFormat('id-ID').format(v ?? 0) }

const CARDS = [
  { key: 'top_engagement', title: 'Top Engagements', icon: 'fa-fire',         valueKey: 'engagement' },
  { key: 'top_likes',      title: 'Top Likes',       icon: 'fa-thumbs-up',    valueKey: 'like' },
  { key: 'top_comment',    title: 'Top Comments',    icon: 'fa-comment-dots', valueKey: 'comment' },
  { key: 'top_view',       title: 'Top Views',       icon: 'fa-eye',          valueKey: 'view' },
]

function PerformerTable({ title, icon, rows, valueKey }) {
  return (
    <div className="sv-performer-card">
      <div className="sv-performer-label border-l-2 border-orange pl-2">
        <i className={'fas ' + icon + ' text-orange text-[10px]'}></i>
        <span>{title}</span>
      </div>
      <table className="w-full text-[11px]">
        <tbody>
          {rows?.length ? rows.slice(0, 5).map((r, i) => (
            <tr key={i} className="border-b border-cream/50 hover:bg-white/60">
              <td className="px-2 py-1 text-dark1 overflow-hidden text-ellipsis whitespace-nowrap max-w-[110px]">
                <span className="text-[9px] text-dark2/50 mr-1 font-mono">{i + 1}.</span>
                {r.id ? (
                  <a href={`/kol/${r.id}/show`} className="text-dark1 hover:text-orange no-underline">
                    {r.key_opinion_leader_name}
                  </a>
                ) : r.key_opinion_leader_name}
              </td>
              <td className="px-2 py-1 text-right font-semibold text-dark1 whitespace-nowrap tabular-nums">
                {typeof r[valueKey] === 'number' ? formatNum(r[valueKey]) : (r[valueKey] ?? '—')}
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={2} className="px-2 py-4 text-center text-gray-400 text-[10px]">No data</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function TopPerformersPanel({ data }) {
  return (
    <div className="sv-performers-panel">
      <div className="sv-panel-header-dark">
        <span className="flex items-center gap-1.5">
          <i className="fas fa-medal text-orange text-xs"></i> Top Performers
        </span>
      </div>
      <div className="sv-performers-grid flex-1 overflow-auto">
        {CARDS.map(c => (
          <PerformerTable key={c.key}
            title={c.title} icon={c.icon}
            rows={data?.[c.key]} valueKey={c.valueKey}
          />
        ))}
      </div>
    </div>
  )
}
