// Reference implementation — delete or ignore, not a real route.
// Visual reference for the 3 reusable layout components in components/layout/.
// Visit /layout-demo (unlinked) to see desktop + mobile behavior. Uses only
// placeholder content — no data fetching, not a feature page.
import TwoPanelLayout from '@/components/layout/TwoPanelLayout'
import DetailLayout from '@/components/layout/DetailLayout'
import TablePageLayout from '@/components/layout/TablePageLayout'

const KPIS = [
  { label: 'Total GMV', value: 'Rp 1.24B' },
  { label: 'Nett',      value: 'Rp 980M' },
  { label: 'Orders',    value: '3,402' },
  { label: 'Qty',       value: '8,991' },
  { label: 'Avg Order', value: 'Rp 365K' },
]

const Placeholder = ({ label, h = 200 }) => (
  <div className="flex items-center justify-center text-dark2/40 text-sm border border-dashed border-cream rounded bg-bg/40"
    style={{ minHeight: h }}>
    {label}
  </div>
)

const SectionLabel = ({ children }) => (
  <div className="px-4 py-2 bg-dark1 text-cream text-xs font-semibold uppercase tracking-widest">{children}</div>
)

// A wide demo table to show horizontal scroll on narrow viewports.
const WideTable = () => (
  <table className="sv-table-clean">
    <thead>
      <tr>{['#', 'Name', 'Email', 'Platform', 'Status', 'GMV', 'Nett', 'Qty', 'Created', 'Updated', 'Notes'].map(h => <th key={h}>{h}</th>)}</tr>
    </thead>
    <tbody>
      {Array.from({ length: 8 }, (_, i) => (
        <tr key={i}>
          <td>{i + 1}</td><td>Sample Row {i + 1}</td><td>user{i + 1}@example.com</td>
          <td>Shopee</td><td><span className="badge badge-success">Active</span></td>
          <td>Rp 1.200.000</td><td>Rp 1.050.000</td><td>3</td>
          <td>11 Jun 2026</td><td>12 Jun 2026</td><td>Lorem ipsum placeholder note</td>
        </tr>
      ))}
    </tbody>
  </table>
)

export default function LayoutDemoPage() {
  return (
    <>
      {/* ── Category A ── */}
      <SectionLabel>Category A — TwoPanelLayout (table + chart)</SectionLabel>
      <TwoPanelLayout
        topbar={
          <div className="sv-filter-bar">
            <div className="flex gap-1 tab-pills">
              {['All', 'Shopee', 'TikTok', 'Lazada'].map((p, i) => (
                <button key={p} className={`tab-pill ${i === 0 ? 'active' : ''}`}>{p}</button>
              ))}
            </div>
            <input type="month" defaultValue="2026-06" className="form-input !w-auto text-xs py-1 ml-auto" />
          </div>
        }
        kpis={KPIS}
        tableTitle="Sales — 240 records"
        tablePanel={<WideTable />}
        chartTitle="Chart"
        chartPanel={<Placeholder label="Chart goes here (ChartPanel)" h={240} />}
      />

      {/* ── Category B ── */}
      <SectionLabel>Category B — DetailLayout (main 60% + side 40%)</SectionLabel>
      <DetailLayout
        topbar={<div className="sv-sh-header"><span>Detail Header</span><span className="text-xs">placeholder</span></div>}
        kpiRow={
          <div className="sv-kpi-row" style={{ margin: '8px' }}>
            {['Views', 'Likes', 'Comments', 'GMV'].map(k => (
              <div key={k} className="sv-kpi-tile">
                <div className="min-w-0">
                  <div className="sv-kpi-label">{k}</div>
                  <div className="sv-kpi-value">123,456</div>
                </div>
              </div>
            ))}
          </div>
        }
        mainTitle="Performance"
        mainPanel={<Placeholder label="Main detail / chart area (60%)" h={300} />}
        sideTitle="Top Performers"
        sidePanel={
          <ul className="text-xs text-dark1/80 p-2 space-y-1">
            {['@creator_one', '@creator_two', '@creator_three', '@creator_four'].map(c => (
              <li key={c} className="flex justify-between border-b border-cream/50 py-1">
                <span>{c}</span><span className="font-semibold">Rp 12.3M</span>
              </li>
            ))}
          </ul>
        }
      />

      {/* ── Category D ── */}
      <SectionLabel>Category D — TablePageLayout (single wide table)</SectionLabel>
      <TablePageLayout
        topbar={
          <div className="sv-topbar">
            <span className="sv-topbar-title"><i className="fas fa-table mr-1" /> Records</span>
            <button className="sv-tbtn sv-tbtn-success ml-auto"><i className="fas fa-plus" /> New</button>
          </div>
        }
        title="Records — 8 rows"
      >
        <WideTable />
      </TablePageLayout>
    </>
  )
}
