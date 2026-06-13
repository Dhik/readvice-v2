'use client'

/**
 * Category B layout — "detail / show page: KPI row + (main 60% | side 40%)".
 * Modeled after app/(dashboard)/campaign/[id]/show/page.jsx.
 *
 * Reuses the existing 60/40 panel classes: mainPanel → .sv-chart-panel-show,
 * sidePanel → .sv-performers-panel. (Names are campaign-flavored but the
 * structure is generic "main + side".) No new CSS — these are the only existing
 * responsive 60/40 panel classes.
 *
 * MORE responsive than the reference: campaign/[id]/show wraps its two panels in
 * a plain inline `<div style="display:flex">`, which the mobile @media does NOT
 * target — so that page does not stack on mobile today. This component wraps them
 * in .sv-main, which the @media(≤768px) collapses to a column. That improvement
 * is intentional.
 *
 * @example
 *   <DetailLayout
 *     topbar={<CampaignShowHeader … />}
 *     kpiRow={<div className="sv-kpi-row"> … .sv-kpi-tile × 4 … </div>}
 *     mainTitle="Performance"
 *     mainPanel={<PerformanceChart … />}
 *     sideTitle="Top Performers"
 *     sidePanel={<TopPerformersPanel … />}
 *   />
 */
export default function DetailLayout({
  topbar, kpiRow, mainPanel, sidePanel, mainTitle, sideTitle, className = '',
}) {
  return (
    <div className={`sv-page ${className}`.trim()}>
      {topbar}
      {kpiRow}

      <div className="sv-main">
        <div className="sv-chart-panel-show">
          {mainTitle && <div className="sv-panel-header">{mainTitle}</div>}
          <div className="sv-panel-body">{mainPanel}</div>
        </div>
        <div className="sv-performers-panel">
          {sideTitle && <div className="sv-panel-header">{sideTitle}</div>}
          <div className="sv-panel-body">{sidePanel}</div>
        </div>
      </div>
    </div>
  )
}
