'use client'
// Welcome jumbotron — the face of the app, first thing after login. Personalized,
// time-aware greeting + a one-line "what Readvice does" + quick-action links + live
// overview chips, with an on-brand animated robot mascot (CSS keyframes in globals.css;
// respects prefers-reduced-motion). Purely presentational — stats are passed in.
import { useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

function greeting(h) {
  if (h < 5)  return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Working late'
}

// Compact on-brand robot mascot (no external asset — inline SVG, floats + blinks).
function Mascot() {
  return (
    <svg className="jumbo-float" width="150" height="150" viewBox="0 0 150 150" fill="none" aria-hidden="true">
      {/* soft glow */}
      <ellipse cx="75" cy="132" rx="42" ry="7" fill="#000" opacity="0.18" />
      {/* antenna */}
      <line x1="75" y1="26" x2="75" y2="14" stroke="#FDFBF7" strokeWidth="3" strokeLinecap="round" />
      <circle className="jumbo-pulse" cx="75" cy="11" r="5" fill="#E07B39" />
      {/* head */}
      <rect x="40" y="26" width="70" height="54" rx="16" fill="#FDFBF7" stroke="#E07B39" strokeWidth="2.5" />
      {/* face screen */}
      <rect x="48" y="36" width="54" height="34" rx="10" fill="#2C3639" />
      {/* eyes (blink) */}
      <g className="jumbo-blink">
        <circle cx="64" cy="53" r="5.5" fill="#E07B39" />
        <circle cx="86" cy="53" r="5.5" fill="#E07B39" />
      </g>
      {/* smile */}
      <path d="M64 62 Q75 69 86 62" stroke="#A9C5A0" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* body */}
      <rect x="46" y="84" width="58" height="40" rx="12" fill="#3F4E4F" stroke="#FDFBF7" strokeWidth="2" />
      {/* mini bar-chart on chest (it IS an analytics app) */}
      <rect x="58" y="104" width="6" height="12" rx="2" fill="#6B8E9E" />
      <rect x="68" y="98"  width="6" height="18" rx="2" fill="#C9A66B" />
      <rect x="78" y="100" width="6" height="16" rx="2" fill="#E07B39" />
      <rect x="88" y="94"  width="6" height="22" rx="2" fill="#A9C5A0" />
      {/* arms */}
      <rect x="34" y="90" width="10" height="26" rx="5" fill="#FDFBF7" />
      <rect x="106" y="90" width="10" height="26" rx="5" fill="#FDFBF7" />
    </svg>
  )
}

const Chip = ({ icon, label, value, accent }) => (
  <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur px-2.5 py-1.5 min-w-0">
    <span className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: accent }}>
      <i className={`fas ${icon} text-white text-[11px]`} />
    </span>
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wide text-cream/55 leading-none">{label}</div>
      <div className="text-[13px] font-bold text-cream truncate leading-tight mt-0.5">{value}</div>
    </div>
  </div>
)

export default function WelcomeJumbotron({ chips = [], loading = false }) {
  const { data: session } = useSession()
  const name = session?.user?.name?.split(' ')[0] || 'there'
  const hi = useMemo(() => greeting(new Date().getHours()), [])

  return (
    <section className="jumbo-rise relative overflow-hidden rounded-xl text-cream"
      style={{ background: 'linear-gradient(135deg, #2C3639 0%, #3F4E4F 55%, #2C3639 100%)' }}>
      {/* decorative floating orbs */}
      <span className="jumbo-orb" style={{ top: '-30px', right: '120px', width: 120, height: 120, background: 'radial-gradient(circle, rgba(224,123,57,0.35), transparent 70%)' }} />
      <span className="jumbo-orb jumbo-orb-slow" style={{ bottom: '-40px', left: '40px', width: 140, height: 140, background: 'radial-gradient(circle, rgba(169,197,160,0.25), transparent 70%)' }} />

      <div className="relative flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-orange/90 font-semibold mb-0.5">Readvice · Marketing &amp; Sales Intelligence</div>
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">{hi}, {name} <span className="inline-block jumbo-wave">👋</span></h1>
          <p className="text-[12px] sm:text-[13px] text-cream/70 mt-1 max-w-2xl leading-relaxed">
            Your Shopee, TikTok &amp; marketplace data, turned into <b className="text-cream">curated insights</b> — overview → drill-down → detail.
            Real numbers stay real; anything modeled is <b className="text-cream">clearly flagged</b>, never faked.
          </p>

          {/* quick actions */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Link href="/analytics" className="inline-flex items-center gap-1.5 rounded-lg bg-orange hover:bg-[#c9662a] text-white text-xs font-semibold px-3 py-1.5 transition">
              <i className="fas fa-compass" /> Explore analytics
            </Link>
            <Link href="/ads/ai-insights" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-cream text-xs font-semibold px-3 py-1.5 transition">
              <i className="fas fa-robot" /> Ask AI
            </Link>
            <Link href="/sales" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-cream text-xs font-semibold px-3 py-1.5 transition">
              <i className="fas fa-chart-line" /> View sales
            </Link>
            <Link href="/orders" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-cream text-xs font-semibold px-3 py-1.5 transition">
              <i className="fas fa-receipt" /> Orders
            </Link>
          </div>
        </div>

        {/* mascot — hidden on the smallest screens to keep text room */}
        <div className="hidden sm:block flex-shrink-0">
          <Mascot />
        </div>
      </div>

      {/* live overview chips */}
      {(chips.length > 0 || loading) && (
        <div className="relative border-t border-white/10 px-5 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[42px] rounded-lg bg-white/5 animate-pulse" />)
            : chips.map((c, i) => <Chip key={i} {...c} />)}
        </div>
      )}
    </section>
  )
}
