import Link from 'next/link'
import LandingClient from '@/components/landing/LandingClient'

export const metadata = {
  title: 'Readvice — Smarter Business Decisions',
  description: 'Marketing analytics dashboard for multi-channel e-commerce brands.',
}

const BARS = [35, 55, 42, 70, 58, 80, 65, 90, 72, 85, 60, 95]

const FEATURES = [
  { icon: 'fa-chart-line',  iconClass: 'icon-orange', title: 'Sales Analytics',       desc: 'Track GMV, orders, and conversion rates across Shopee, TikTok, Lazada and more — updated in real time.',                           tag: 'Multi-platform' },
  { icon: 'fa-bullhorn',    iconClass: 'icon-teal',   title: 'Campaign Management',   desc: 'Manage Creative, KOL, Clipper, and Affiliate campaigns from a single dashboard with performance tracking built in.',                   tag: '4 campaign types' },
  { icon: 'fa-bolt',        iconClass: 'icon-dark',   title: 'Ad Spend Intelligence', desc: 'Monitor ROAS, CPM, CPC, and total spend across Meta, TikTok Ads, Shopee Ads, and Lazada Ads side-by-side.', featured: true,          tag: 'Cross-channel ROAS' },
  { icon: 'fa-users',       iconClass: 'icon-orange', title: 'KOL & Influencer Hub',  desc: 'Track KOL deliverables, view content performance, and measure the ROI of every influencer partnership in one place.',                  tag: 'Content tracking' },
  { icon: 'fa-file-export', iconClass: 'icon-teal',   title: 'Automated Reports',     desc: 'Generate sales, ads, and KPI reports with one click. Export to Excel or share directly with your team or clients.',                    tag: 'Excel & PDF export' },
  { icon: 'fa-bullseye',    iconClass: 'icon-orange', title: 'Target vs Actual',      desc: 'Set monthly sales targets per channel or team and track progress against actuals with live variance indicators.',                       tag: 'Live tracking' },
]

const STEPS = [
  { num: '01', title: 'Create your workspace',   desc: 'Sign up and set up your brand workspace. Invite your team members and assign roles in seconds.' },
  { num: '02', title: 'Connect your channels',   desc: 'Link your marketplace stores and ad accounts. Readvice pulls data from Shopee, TikTok, Lazada, and Meta.' },
  { num: '03', title: 'Set targets & campaigns', desc: 'Define monthly sales targets, launch campaigns, and assign KOLs — all from the same dashboard.' },
  { num: '04', title: 'Watch your growth',       desc: 'Track real-time performance, export reports, and make smarter decisions with clear, actionable data.' },
]

export default function LandingPage() {
  return (
    <>
      {/* NAVBAR */}
      <nav className="landing-nav" id="navbar">
        <Link href="/" className="nav-brand">
          <div className="nav-brand-icon"><i className="fas fa-book" /></div>
          <div className="nav-brand-name"><span>Read</span>vice</div>
        </Link>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How it works</a></li>
          <li><Link href="/pricing">Pricing</Link></li>
        </ul>
        <div className="nav-actions">
          <Link href="/login" className="btn-ghost" style={{ padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <i className="fas fa-sign-in-alt" /> Login
          </Link>
          <Link href="/login" className="btn-outline-landing">Sign Up</Link>
          <a href="#subscribe" className="btn btn-primary">
            <i className="fas fa-bolt" /> Subscribe
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-blob1" />
        <div className="hero-blob2" />
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-tag">
              <span className="hero-tag-dot" />
              Business Intelligence Platform
            </div>
            <h1>Data that drives<br /><span className="accent">real results.</span></h1>
            <p className="hero-sub">
              Track campaigns, monitor ad spend, analyze sales trends, and manage your team —
              all from one unified dashboard built for modern e-commerce brands.
            </p>
            <div className="hero-ctas">
              <Link href="/login" className="btn btn-primary btn-lg">
                Get Started Free <i className="fas fa-arrow-right" />
              </Link>
              <a href="#features" className="btn-ghost btn-lg" style={{ padding: '14px 30px', borderRadius: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                See Features
              </a>
            </div>
            <p className="hero-note">
              <i className="fas fa-shield-alt" style={{ color: '#E07B39' }} />
              No credit card required &nbsp;&middot;&nbsp; Free 14-day trial
            </p>
          </div>
          <div className="hero-visual" style={{ position: 'relative' }}>
            <div className="mockup-float float-1">
              <div className="mockup-float-icon" style={{ background: 'rgba(40,167,69,.12)', color: '#28a745' }}>
                <i className="fas fa-arrow-trend-up" />
              </div>
              <div>
                <div className="float-sub">Revenue this month</div>
                <div className="float-val">+34.2%</div>
              </div>
            </div>
            <div className="mockup-float float-2">
              <div className="mockup-float-icon" style={{ background: 'rgba(224,123,57,.12)', color: '#E07B39' }}>
                <i className="fas fa-bullseye" />
              </div>
              <div>
                <div className="float-sub">Campaign ROAS</div>
                <div className="float-val">4.8x</div>
              </div>
            </div>
            <div className="mockup-window">
              <div className="mockup-bar">
                <div className="mockup-dot" /><div className="mockup-dot" /><div className="mockup-dot" />
                <div className="mockup-url" />
              </div>
              <div className="mockup-body">
                <div className="mockup-period">
                  Overview — {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <div className="mockup-stats">
                  {[['Total Sales','2.4B','+12.3%',true],['Ad Spend','148M','-3.1%',false],['ROAS','4.8x','+0.6x',true]].map(([l,v,b,up]) => (
                    <div key={l} className="mockup-stat-card">
                      <div className="mockup-stat-label">{l}</div>
                      <div className="mockup-stat-value">{v}</div>
                      <div className={`mockup-stat-badge ${up ? 'badge-up' : 'badge-dn'}`}>
                        <i className={`fas fa-caret-${up ? 'up' : 'down'}`} /> {b}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mockup-chart">
                  <div className="mockup-chart-header">
                    <div className="mockup-chart-title">Sales vs Ad Spend</div>
                    <div className="mockup-chart-pill">Last 30 days</div>
                  </div>
                  <div className="mockup-bars">
                    {BARS.map((h, i) => (
                      <div key={i} className="mockup-bar-item"
                        style={{ height: `${h}%`, background: i % 3 === 0 ? '#E07B39' : i % 3 === 1 ? '#2C3639' : '#DCD7C9', opacity: i === BARS.length - 1 ? 1 : 0.7 }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="trust-bar">
        <div className="trust-bar-inner">
          <div className="trust-label">Trusted by growing brands</div>
          <div className="trust-divider" />
          <div className="trust-stats">
            {[['50+','Active brands'],['6','Platforms integrated'],['99.9%','Uptime SLA'],['Real-time','Data sync']].map(([n,l]) => (
              <div key={l} className="trust-stat">
                <div className="trust-stat-num">{n}</div>
                <div className="trust-stat-label">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="lp-section" id="features">
        <div className="section-inner">
          <div className="section-header reveal">
            <div className="section-tag"><i className="fas fa-sparkles" /> Features</div>
            <h2 className="section-title">Everything you need<br />to grow faster.</h2>
            <p className="section-sub">
              From campaign management to real-time analytics — Readvice brings all your data into one intelligent workspace.
            </p>
          </div>
          <div className="features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className={`feature-card reveal ${f.featured ? 'featured' : ''}`}>
                <div className={`feature-icon ${f.iconClass}`}><i className={`fas ${f.icon}`} /></div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
                <div className="feature-tag"><i className="fas fa-arrow-right" /> {f.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section" id="how-it-works">
        <div className="section-inner">
          <div className="section-header reveal">
            <div className="section-tag"><i className="fas fa-route" /> How it works</div>
            <h2 className="section-title" style={{ color: 'white' }}>Up and running<br />in minutes.</h2>
            <p className="section-sub" style={{ color: 'rgba(220,215,201,.6)', opacity: 1 }}>
              No complex setup, no engineers needed. Just connect your channels and start seeing insights immediately.
            </p>
          </div>
          <div className="steps-grid">
            {STEPS.map(s => (
              <div key={s.num} className="step reveal">
                <div className="step-num">Step {s.num}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SUBSCRIBE */}
      <section className="subscribe-section" id="subscribe">
        <div className="section-inner">
          <div className="subscribe-card reveal">
            <div className="subscribe-eyebrow">Stay in the loop</div>
            <h2 className="subscribe-title">Ready to grow <span>smarter</span>?</h2>
            <p className="subscribe-sub">
              Join teams already using Readvice to make faster, data-driven decisions. Get early access to new features and exclusive insights.
            </p>
            <LandingClient />
            <div className="subscribe-note">No spam, ever. Unsubscribe any time.</div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="footer-inner">
          <Link href="/" className="footer-brand">
            <div className="footer-brand-icon"><i className="fas fa-book" /></div>
            <div className="footer-brand-name"><span>Read</span>vice</div>
          </Link>
          <div className="footer-copy">&copy; {new Date().getFullYear()} Readvice. All rights reserved.</div>
          <ul className="footer-links">
            <li><a href="#">Privacy</a></li>
            <li><a href="#">Terms</a></li>
            <li><Link href="/login">Login</Link></li>
          </ul>
        </div>
      </footer>
    </>
  )
}
