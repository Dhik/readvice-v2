'use client'
import KpiStrip from '@/components/ui/KpiStrip'

/**
 * Category A layout — "filters + KPI strip + (table panel | chart panel)".
 * Modeled after app/(dashboard)/sales/page.jsx.
 *
 * Responsive automatically: uses .sv-page / .sv-main / .sv-table-panel /
 * .sv-chart-panel, which the globals.css @media(≤768px) block collapses to a
 * stacked, full-width column. No responsive logic is implemented here.
 *
 * @example
 *   <TwoPanelLayout
 *     topbar={<div className="sv-filter-bar">…tab pills + filters…</div>}
 *     kpis={[{ label: 'GMV', value: 'Rp 1.2B' }, …]}   // array → <KpiStrip/>, or pass a node
 *     tableTitle="Sales — 240 records"
 *     tablePanel={<DataTable … />}
 *     chartTitle="Chart"
 *     chartPanel={<ChartPanel … />}
 *   />
 */
export default function TwoPanelLayout({
  topbar, kpis, tablePanel, chartPanel, tableTitle, chartTitle, className = '',
}) {
  return (
    <div className={`sv-page ${className}`.trim()}>
      {topbar}
      {Array.isArray(kpis) ? <KpiStrip tiles={kpis} /> : kpis}

      <div className="sv-main">
        <div className="sv-table-panel">
          {tableTitle && <div className="sv-panel-header">{tableTitle}</div>}
          <div className="sv-panel-body">{tablePanel}</div>
        </div>
        <div className="sv-chart-panel">
          {chartTitle && <div className="sv-panel-header">{chartTitle}</div>}
          <div className="sv-panel-body">{chartPanel}</div>
        </div>
      </div>
    </div>
  )
}
