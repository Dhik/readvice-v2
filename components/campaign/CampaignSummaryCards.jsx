import { formatCurrency, formatNumber } from '@/lib/utils'

export default function CampaignSummaryCards({ summary }) {
  const tiles = [
    { label: 'Total Campaigns', value: formatNumber(summary?.total ?? 0) },
    { label: 'Active',          value: formatNumber(summary?.active ?? 0) },
    { label: 'Budget Total',    value: formatCurrency(summary?.budget ?? 0) },
    { label: 'Avg Views',       value: formatNumber(summary?.avgViews ?? 0) },
    { label: 'Total GMV',       value: formatCurrency(summary?.gmv ?? 0) },
  ]
  return (
    <div className="sv-kpi-strip">
      {tiles.map((tile, i) => (
        <div key={i} className="kpi-tile kpi-tile-simple">
          <span className="kpi-tile-label">{tile.label}</span>
          <span className="kpi-tile-value">{tile.value}</span>
        </div>
      ))}
    </div>
  )
}
