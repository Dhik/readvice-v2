'use client'
// Analytics hub (Part A4) — the discovery surface for the 9 deep-analysis modules,
// grouped by the SAME 4 themes as the sidebar (Customer / Marketing / Product &
// Finance / Operations). Each card states what the module shows + an honesty posture
// (how real the data is), pulled from each engine's flags. Fully STATIC — no
// per-module data fetches, so nothing to tenant-scope here.
import Link from 'next/link'
import CompactPage from '@/components/dashboard/CompactPage'
import CompactTopbar from '@/components/dashboard/CompactTopbar'

// Honesty tones → badge styling (mirrors the app's dev/dummy badge language).
const TONE = {
  real:  { label: 'Real',                 bg: 'rgba(169,197,160,0.22)', fg: '#3F5E3A' },
  mixed: { label: 'Real + dummy',         bg: 'rgba(224,123,57,0.16)',  fg: '#B5601F' },
  dummy: { label: 'Cost real · return dummy', bg: 'rgba(224,123,57,0.16)', fg: '#B5601F' },
  small: { label: 'Real · small sample',  bg: 'rgba(107,142,158,0.18)', fg: '#3F6273' },
  grows: { label: 'Becomes real w/ time', bg: 'rgba(107,142,158,0.18)', fg: '#3F6273' },
}

const THEMES = [
  {
    name: 'Customer', icon: 'fa-user-group', accent: '#E07B39',
    modules: [
      { title: 'RFM Segments', href: '/analytics/rfm', icon: 'fa-user-friends', tone: 'mixed',
        note: 'Recency / Frequency / Monetary segments — real for customers with order history; dummy padding fills sparse segments.' },
      { title: 'Cohort Retention', href: '/analytics/cohort', icon: 'fa-table-cells', tone: 'grows',
        note: 'Monthly retention triangle — only 1 of 36 cells is real today; fills in as months of history accrue.' },
      { title: 'Market Basket', href: '/analytics/basket', icon: 'fa-diagram-project', tone: 'small',
        note: 'Co-purchase affinity (lift / confidence) — real data, but small-sample, so high lifts are noisy.' },
    ],
  },
  {
    name: 'Marketing', icon: 'fa-bullhorn', accent: '#3F4E4F',
    modules: [
      { title: 'Ads Allocation', href: '/analytics/ads-allocation', icon: 'fa-money-bill-wave', tone: 'real',
        note: 'Spend Pareto & share across channels — 100% real, expense-only (no ROAS / revenue link yet).' },
      { title: 'Campaign Efficiency', href: '/analytics/campaign-efficiency', icon: 'fa-photo-film', tone: 'mixed',
        note: 'Cost × engagement efficiency across content — metrics are real, but GMV is self-reported, not attributed to Orders.' },
      { title: 'Talent ROI', href: '/analytics/talent-roi', icon: 'fa-user-tag', tone: 'dummy',
        note: 'Cost vs return per talent — cost is real (payments); return / ROI is dummy until talent→sales attribution exists.' },
    ],
  },
  {
    name: 'Product & Finance', icon: 'fa-coins', accent: '#8B5E3C',
    modules: [
      { title: 'BCG Matrix', href: '/analytics/bcg', icon: 'fa-chart-pie', tone: 'mixed',
        note: 'Growth-share product matrix — sales / qty / stock are real; visitor / CTR / ads axes are dummy in dev.' },
      { title: 'Gross Margin', href: '/analytics/gross-margin', icon: 'fa-coins', tone: 'real',
        note: 'Revenue − HPP margin — real where product cost (HPP) is known; coverage % is shown for the rest.' },
      { title: 'Product Analysis', href: '/analytics/products', icon: 'fa-cubes', tone: 'real',
        note: 'Per-SKU revenue, contribution & Pareto (80/20) — real order-item data.' },
      { title: 'Order Analysis', href: '/analytics/orders', icon: 'fa-chart-column', tone: 'real',
        note: 'Order trends, funnel, size & day distributions across time — real order data.' },
    ],
  },
  {
    name: 'Operations', icon: 'fa-warehouse', accent: '#6B8E9E',
    modules: [
      { title: 'Operational', href: '/analytics/operational', icon: 'fa-warehouse', tone: 'mixed',
        note: 'Funnel, cancellation & stock turnover — funnel / stock are real; fulfilment timing is dummy.' },
    ],
  },
]

function ToneBadge({ tone }) {
  const t = TONE[tone] ?? TONE.real
  return (
    <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}>
      {t.label}
    </span>
  )
}

export default function AnalyticsHubPage() {
  return (
    <CompactPage>
      <CompactTopbar title="Analytics" icon="fa-chart-line">
        <span className="text-[10px] text-dark1/45">9 deep-analysis modules · read-only analysis lens</span>
      </CompactTopbar>

      {/* Intro — frames the operational ↔ analytics split */}
      <div className="flex items-start gap-2 rounded-lg border border-cream bg-bg/60 px-3 py-2 text-[11px] text-dark1/80 mt-2">
        <i className="fas fa-compass text-dark2 mt-0.5" />
        <span>
          Deep analyses grouped by theme. Operational pages (Dashboard, Sales, Orders, Customers, Report) link here via
          <b> “View full analysis →”</b>; each module is a <b>read-only lens</b> — manage the underlying records on its
          Marketing Module via <b>“Manage data →”</b>. Each card notes <b>how real the data is</b>.
        </span>
      </div>

      <div className="flex flex-col gap-3 mt-3">
        {THEMES.map(theme => (
          <section key={theme.name}>
            <div className="flex items-center gap-2 mb-1.5 px-0.5">
              <span className="w-6 h-6 rounded flex items-center justify-center text-white text-[11px] flex-shrink-0"
                style={{ background: theme.accent }}>
                <i className={`fas ${theme.icon}`} />
              </span>
              <h2 className="text-xs font-bold text-dark1 uppercase tracking-wide">{theme.name}</h2>
              <span className="text-[10px] text-dark1/35">{theme.modules.length} {theme.modules.length === 1 ? 'module' : 'modules'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {theme.modules.map(m => (
                <Link key={m.href} href={m.href}
                  className="group block rounded-lg border border-cream bg-white p-3 transition hover:border-dark2 hover:shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-7 h-7 rounded flex items-center justify-center text-[12px] flex-shrink-0"
                      style={{ background: 'rgba(44,54,57,0.06)', color: theme.accent }}>
                      <i className={`fas ${m.icon}`} />
                    </span>
                    <span className="text-[13px] font-semibold text-dark1 flex-1 min-w-0 truncate">{m.title}</span>
                    <i className="fas fa-arrow-right text-[10px] text-dark1/25 group-hover:text-orange transition flex-shrink-0" />
                  </div>
                  <p className="text-[11px] leading-snug text-dark1/60 mb-2">{m.note}</p>
                  <ToneBadge tone={m.tone} />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </CompactPage>
  )
}
