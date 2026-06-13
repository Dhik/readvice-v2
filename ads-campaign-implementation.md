# Ads & Campaign Modules — Current Implementation Reference

> **Purpose of this document.** This is a complete, faithful description of how the **Ads**
> and **Campaign** modules are *currently* built in `readvice-v2` (the new app). Hand this
> file to an AI/developer as the source of truth for the project's tech stack, design system,
> layout conventions, data models, API patterns, and component structure — so new work
> (porting features from the old application) matches the existing house style exactly.
>
> Everything below is taken directly from the live code, not from an idealized spec.

---

## 1. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js 16.1.6** (App Router) | `app/` directory, React Server Components + `'use client'` islands |
| React | **19.2.3** | |
| Language | **JavaScript (JSX)** | No TypeScript. Files are `.js` / `.jsx` |
| Styling | **Tailwind CSS v4** | Configured via `@import "tailwindcss"` + `@theme` block in `app/globals.css` (no `tailwind.config.js`). PostCSS plugin `@tailwindcss/postcss` |
| Utility merge | `clsx`, `tailwind-merge` | |
| ORM / DB | **Prisma 5.22** + `@prisma/client` | MySQL-style (`@db.Decimal`, `BigInt`). Multi-tenant via `tenantId` |
| Auth | **NextAuth 4.24** | Credentials provider, JWT sessions, bcrypt password hashing |
| Tables | **@tanstack/react-table v8** | Server-side pagination on index pages, client-side on detail pages |
| Charts | **Chart.js 4.5** + **react-chartjs-2 5.3** | `Chart.register(...registerables)` |
| Icons | **Font Awesome 6.5** | Two ways — see §4 |
| Toasts | **react-hot-toast** | `<Toaster position="top-right" />` mounted in root layout |
| Confirm dialogs | **sweetalert2** | Used for delete confirmations |
| State | **zustand 5** | `store/useAppStore.js` (global UI state) |
| Forms | **react-hook-form 7** | |
| Date picker | **react-datepicker 9** | (a custom lightweight `DateRangePicker` using native `<input type="date">` is also used) |
| Excel | **xlsx 0.18** | Import/export |
| HTTP | **axios** + native `fetch` | API routes mostly fetched with `fetch` |
| Scraping | **playwright** | For social-media stat refresh / Kalodata |
| Google APIs | `googleapis`, `google-trends-api` | Sheet imports + market research |

**Dev server runs on port 3006** (`next dev -p 3006`).

Path alias: **`@/`** maps to the project root (e.g. `@/components/...`, `@/lib/...`).

---

## 2. Color Theme & Design Tokens

Defined once in `app/globals.css` inside the Tailwind v4 `@theme` block, which makes each
token available **both** as a CSS variable (`var(--color-orange)`) **and** as a Tailwind
utility (`bg-orange`, `text-dark1`, `border-cream`, …).

```css
@theme {
  --color-dark1:       #2C3639;   /* primary dark — headers, sidebar, dark buttons */
  --color-dark2:       #3F4E4F;   /* secondary dark — hover states, muted text */
  --color-cream:       #DCD7C9;   /* borders, subtle dividers */
  --color-orange:      #E07B39;   /* brand accent — primary buttons, active states */
  --color-bg:          #F5F0E8;   /* app background (warm off-white) */
  --color-cream-light: #e8e2d5;
  --font-sans: Inter, sans-serif;
}
```

`body` background is `#F5F0E8`. The campaign show page also reads `var(--bg)` directly.

### Semantic / accent colors used in modules

| Use | Color |
|-----|-------|
| Success | `#28a745` / Tailwind `green-600` |
| Danger | `#dc3545` / `red-500` |
| Info | `blue-500` |
| ROI good (≥2×) | `#2C6E3F` / `#28a745` green |
| ROI mid (1–2×) | `#E07B39` orange |
| ROI bad (<1×) | `#dc3545` red |

### Campaign type accent colors

```js
const TYPE_CHIP_COLORS = { creative: '#3F4E4F', kol: '#E07B39', clipper: '#2C3639', affiliate: '#8B5E3C' }
const TYPE_ICONS       = { creative: 'fa-paint-brush', kol: 'fa-star', clipper: 'fa-film', affiliate: 'fa-user-tie' }
const TYPE_LABELS      = { creative: 'Creative', kol: 'KOL', clipper: 'Clipper', affiliate: 'Affiliate Talent' }
```

### Platform / channel colors (for ad-spend donut + content cells)

```js
// Ad platforms (donut on Ads page)
{ Meta: '#1877F2', Shopee: '#EE4D2D', TikTok: '#000000', Lazada: '#0F146D' }

// Content channels (campaign content table)
const CHANNEL_COLORS = {
  'Instagram feed':  '#E4405F', 'Instagram story': '#8A3AB9',
  'TikTok video':    '#000000', 'TikTok live':     '#FF0050',
  'youtube video':   '#FF0000', 'twitter post':    '#1DA1F2',
  'shopee video':    '#EE4D2D',
}   // fallback: '#6c757d'
```

A deterministic color helper is used for free-text labels (PIC, task):

```js
function getColorFromText(text) {
  if (!text || text === 'N/A') return '#6c757d'
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash % 360)}, 65%, 45%)`
}
```

---

## 3. Typography

- Font family: **Inter** (weights 300–700), loaded **twice** for safety:
  1. `next/font/google` `Inter({ subsets: ['latin'] })` applied to `<body>`.
  2. A Google Fonts `@import` at the top of `globals.css`.
- Default body text dark color: `text-dark1` (`#2C3639`), often at reduced opacity (`text-dark1/60`, `/80`).
- The UI is **dense** — lots of `text-xs` (12px), `text-[11px]`, `text-[10px]`, `text-[9px]` for labels.

---

## 4. Icons

Font Awesome 6.5, used in **two** interchangeable ways:

1. **React component** (preferred in layout/shared components) — `@fortawesome/react-fontawesome`:
   ```jsx
   import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
   import { faUpload, faChartLine } from '@fortawesome/free-solid-svg-icons'
   <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
   ```
2. **CSS class** (common inside the campaign module) — the full FA stylesheet is loaded from
   CDN in `app/layout.js`, so you can write raw `<i>` tags:
   ```jsx
   <i className="fas fa-plus"></i>
   <i className="fas fa-sync-alt fa-spin"></i>
   ```

Packages installed: `free-solid-svg-icons`, `free-brands-svg-icons`, `fontawesome-svg-core`.

---

## 5. Application Layout

### Route groups
```
app/
├── (auth)/login/page.jsx          ← unauthenticated
├── (dashboard)/                    ← protected; layout redirects to /login if no session
│   ├── layout.js                   ← server component: getServerSession → DashboardLayout
│   ├── ads/marketplace/page.jsx
│   ├── campaign/page.jsx           (creative default)
│   ├── campaign/kol|clipper|affiliate/page.jsx
│   ├── campaign/[id]/show/page.jsx
│   └── ...other modules
├── api/                            ← route handlers
├── layout.js                       ← root: <html>, Inter font, FA CDN, <Toaster>
└── globals.css
```

### `DashboardLayout` (`components/layout/DashboardLayout.jsx`)
- Wraps everything in `<SessionProvider>` (NextAuth).
- Holds `collapsed` (persisted to `localStorage` key `sidebar-collapsed`) and `mobileOpen` state.
- Structure: `Sidebar` + a `main-content` column containing `Topbar` + scrollable `<main>`.
- `main-content` margin shifts with sidebar width (`ml-64` → `ml-16` when collapsed).

### `Sidebar` (`components/layout/Sidebar.jsx`)
- Fixed left, `w-64` (collapses to `w-16` icon-only), dark (`bg-dark1 text-cream`).
- Logo: shows `Readvice` (or `R` when collapsed) in `text-orange`.
- **Nav is a config array `NAV`** of either direct links or collapsible groups:
  ```
  Dashboard, Sales, Orders
  Campaigns ▸ Creative / KOL / Clipper / Affiliate
  Ads       ▸ Ad Spend
  Talent    ▸ Talent / Content / Payments / Fin. Report / Approval
  Affiliate ▸ Shopee / TikTok
  Analytics ▸ Report / Customers
  Market Research
  ```
- Active item: `bg-orange/20 text-orange border-r-2 border-orange`.
- Groups auto-open when the current path is inside them; animated `max-height` slide.

### `Topbar` (`components/layout/Topbar.jsx`)
- White bar, `h-[54px]`, sticky. Collapse toggle (desktop) / hamburger (mobile), page title,
  logged-in user name, Logout button (`signOut({ callbackUrl: '/login' })`).

---

## 6. Shared Design-System CSS Classes

All defined in `app/globals.css` under `@layer components`. **Reuse these — don't invent new ones.**

### Generic page scaffold
| Class | Role |
|-------|------|
| `.sv-page` | Full-height flex column, `height: calc(100vh - 54px)`, `overflow-hidden` |
| `.sv-main` | Flex row, the table+chart split area (`gap`, padding) |
| `.sv-table-panel` | White rounded panel, `flex: 0 0 62%` (the table side) |
| `.sv-chart-panel` | White rounded panel, `flex: 1` (the chart side) |
| `.sv-panel` / `.sv-panel-header` / `.sv-panel-body` | Generic white card panel |
| `.sv-filter-bar` | Top filter row (`bg-bg`, border-bottom) |

### KPI tiles
- `.sv-kpi-strip` (grid), `.kpi-tile`, `.kpi-tile-label`, `.kpi-tile-value`, `.kpi-tile-icon`.

### Tables
- `.sv-table` — `thead th` is `bg-dark1 text-white` with a `border-b-2 border-orange`;
  `tbody td` small text, cream row dividers, hover `bg-bg/60`.

### Buttons
| Class | Look |
|-------|------|
| `.btn` | base (inline-flex, gap, rounded) |
| `.btn-primary` | `bg-orange text-white` |
| `.btn-dark` | `bg-dark1 text-white` |
| `.btn-outline` | cream border, hover `bg-bg` |
| `.btn-sm` | smaller padding |

### Badges & pills
- `.badge` + `.badge-success / -warning / -danger / -info / -orange`.
- `.tab-pills` + `.tab-pill` (active = `bg-dark1 text-white`) — used for the **Ads platform switcher** and `ChartPanel`.

### Modals
- `.modal-overlay` (fixed, `bg-black/50`, centered), `.modal-box` (white, `max-w-2xl`, scroll),
  `.modal-header`, `.modal-body`, `.modal-footer`.

### Forms
- `.form-input`, `.form-label`, `.form-group`. Focus ring is orange (`focus:border-orange focus:ring-orange/30`).

### Campaign-specific classes (also in globals.css)
The campaign module adds a dedicated set, all prefixed `sv-`:
`.sv-topbar`, `.sv-topbar-title`, `.sv-tbtn` (+ `-primary/-dark/-ghost/-success/-info/-outline-g/-outline-r`),
`.sv-cam-nav` / `.sv-cam-tab` / `.sv-cam-tab-active` (sub-type pills),
`.sv-sh-header` (dark show-page header with `3px solid #E07B39` bottom border),
`.sv-kpi-row` / `.sv-kpi-row-5` / `.sv-kpi-tile` / `.sv-kpi-icon` (show-page KPI grids),
`.sv-chart-panel-show`, `.sv-performers-panel`, `.sv-panel-header-dark`, `.sv-chart-btn(-active)`,
`.sv-performers-grid` / `.sv-performer-card` / `.sv-performer-label`,
`.sv-section-card`, `.sv-content-actionbar`, `.sv-act-btn` (+ variants), `.sv-check-label`,
`.metric-row` / `.metric-card` / `.metric-card-label` / `.metric-card-value`.

---

## 7. Reusable UI Components (`components/ui/`, `components/table/`, `components/charts/`)

| Component | Props / behavior |
|-----------|------------------|
| `ui/KpiStrip` | `{ tiles:[{label,value,sub?}], cols=6 }` → CSS grid of `.kpi-tile`s |
| `ui/Button`, `ui/Input`, `ui/Select`, `ui/Badge` | thin styled wrappers |
| `ui/Modal` | generic modal shell |
| `ui/ImportModal` | `{ title, endpoint, accept='.xlsx,.xls,.csv', extraFields, onSuccess, onClose }` → posts `FormData` with `file`; shows `created`/`imported` count + error count |
| `ui/DateRangePicker` | `{ startDate, endDate, onStartChange, onEndChange, label }` → two native `<input type="date">` + "to" |
| `ui/MonthPicker` | `<input type="month">` wrapper |
| `ui/LoadingSpinner`, `ui/SyncButton` | |
| `table/DataTable` | `{ columns, data, total, page, limit, onPageChange, loading }` — TanStack v8, `manualPagination`, renders `.sv-table`, footer with Prev/Next + "Page X / Y" + record count |
| `table/TableSkeleton` | loading placeholder |
| `charts/ChartPanel` | `{ lineData, donutData, height=220 }` — internal Line/Bar/Mix(doughnut) switcher via `.tab-pill`s. Registers all Chart.js components. Derives bar data from line data |

---

## 8. Auth, Session & Multi-Tenancy

`lib/auth.js` — NextAuth Credentials provider:
- Looks up `user` by email, joins `userRoles → role → rolePermissions → permission`.
- bcrypt-compares password.
- Flattens all permission names into a `permissions: string[]`.
- JWT strategy. The **session object** exposed to the app is:
  ```js
  session.user = { id, name, email, tenantId, permissions }
  ```
- Sign-in page: `/login`.

**Every API route** follows this guard + tenant-scoping pattern:
```js
const session = await getServerSession(authOptions)
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const tenantId = session.user.tenantId
// ...all Prisma queries filtered by { tenantId }
```

**Permission strings** are **snake_case** in the real code (note: the older
`campaign-migration-prompt.md` used camelCase — the live code uses snake_case):
`create_campaign`, `update_campaign` (and by extension `view_campaign`, `delete_campaign`).
Checked client-side for UI gating:
```js
const canCreate = session?.user?.permissions?.includes('create_campaign')
const canUpdate = session?.user?.permissions?.includes('update_campaign')
```

---

## 9. Utility Functions (`lib/utils.js`)

```js
formatCurrency(value, locale='id-ID', currency='IDR')  // Intl.NumberFormat currency, 0 decimals
formatNumber(value)                                     // Intl.NumberFormat('id-ID')
formatDate(date, locale='id-ID')                        // "dd Mmm yyyy"
getMonthRange(monthStr)                                 // → { gte, lt } for "YYYY-MM"
formatPercent(value, decimals=1)                        // value*100 + '%'
formatMultiplier(value, decimals=2)                     // value + 'x'
currentMonth()                                          // "YYYY-MM" of today
```

`lib/prisma.js` exports a singleton `prisma` client. **Serialization caveat:** Prisma
`BigInt` and `Decimal` fields must be `Number()`-converted before `NextResponse.json()`
(see the Ads route below) — JSON can't serialize `BigInt`.

---

## 10. Data Models (Prisma — `prisma/schema.prisma`)

All models carry `tenantId @map("tenant_id")` and snake_case `@map` column names; tables
use `@@map`. Money is `Decimal(15,2)`; large counts are `BigInt`.

### Ads
Five separate per-platform tables (intentionally **not** unified):

```prisma
model AdSpentMeta {   // also: AdSpentShopee, AdSpentTiktok, AdSpentLazada
  id Int @id @default(autoincrement())
  tenantId Int @map("tenant_id")
  date DateTime
  spent Decimal @db.Decimal(15,2)
  impressions BigInt? @default(0)   // (Lazada has no impressions)
  clicks Int? @default(0)
  conversions Int? @default(0)      // Shopee/Lazada use `orders` instead
  revenue Decimal? @db.Decimal(15,2)
  roas Decimal? @db.Decimal(8,4)
  cpc  Decimal? @db.Decimal(10,4)
  ctr  Decimal? @db.Decimal(8,4)    // (not on Lazada)
  adsetName String? @map("adset_name")   // Meta; Tiktok→ad_name, Shopee→ad_type
  createdAt DateTime @default(now()) @map("created_at")
  tenant Tenant @relation(fields:[tenantId], references:[id])
  @@index([tenantId, date])
  @@map("ad_spent_meta")
}

model AdSpentSocialMedia {   // generic platform+date+amount log
  id Int @id @default(autoincrement())
  tenantId Int @map("tenant_id")
  platform String
  date DateTime
  amount Decimal @db.Decimal(15,2)
  @@index([tenantId, platform, date])
  @@map("ad_spent_social_media")
}
```

Per-platform differences:
- **Meta / TikTok** → `conversions`, `ctr`, plus `adset_name` / `ad_name`.
- **Shopee** → `orders` (not conversions), `ad_type`, has `ctr`.
- **Lazada** → leanest: no `impressions`, no `ctr`, has `orders`.

### Campaign (full feature)
```prisma
model Campaign {           // @@map("campaigns")
  id, tenantId, title, type @default("creative"),   // creative|kol|clipper|affiliate
  purpose?, platform?,
  startDate? @map("start_date") String,             // stored as formatted STRING
  endDate?   @map("end_date")   String,
  budget? Decimal(15,2), totalExpense? Decimal(15,2) @map("total_expense"),
  view/like/comment BigInt? @default(0),
  gmv Decimal(15,2)?, cpm Decimal(10,2)?,
  status? @default("active"), description? Text,
  createdById? @map("created_by"), createdAt, updatedAt
  // relations: tenant, createdBy(User), kols(KeyOpinionLeader[]),
  //            contents(CampaignContent[]), statistics(CampaignStatistic[]), talentContents
  @@index([tenantId, type])
}

model CampaignContent {    // @@map("campaign_contents"); onDelete: Cascade from Campaign
  id, campaignId, tenantId, username,
  creatorName? @map("creator_name"), pic?, taskName? @map("task_name"),
  rateCard? Decimal(15,2) @map("rate_card"),
  channel?, link?, product?, boostCode? @map("boost_code"), kodeAds? @map("kode_ads"),
  view/like/comment BigInt? @default(0), gmv Decimal(15,2)?, cpm Decimal(10,2)?,
  kolFollowers? BigInt @map("kol_followers"), tiering?,
  isFyp/isDelivered/isPaid Boolean? @default(false)  @map(is_fyp/is_delivered/is_paid),
  uploadDate? @map("upload_date") DateTime,
  additionalInfo? @map("additional_info") Text,
  statistics ContentStatistic[]
  @@index([campaignId, tenantId])
}

model ContentStatistic {   // daily snapshot per content; @@unique([contentId, date])
  id, contentId, date, view/like/comment BigInt?, gmv Decimal?, spend Decimal?, createdAt
}
model CampaignStatistic {  // daily snapshot per campaign; @@unique([campaignId, date])
  id, campaignId, date, view/like/comment BigInt?, gmv Decimal?, spend Decimal?, createdAt
}
model KeyOpinionLeader { … }  // per-campaign KOL rows (@@map "key_opinion_leaders")
model KolProfile { … }        // standalone KOL contact DB (@@map "kol_profiles")
```

---

## 11. ADS MODULE

### Files
```
app/(dashboard)/ads/marketplace/page.jsx     ← the only Ads page
app/api/ad-spent/meta/route.js                ← GET list+summary (per platform)
app/api/ad-spent/shopee/route.js
app/api/ad-spent/tiktok/route.js
app/api/ad-spent/lazada/route.js
app/api/import/ad-spent/route.js              ← POST Excel/CSV import (platform via ?platform=)
```
Sidebar entry: **Ads ▸ Ad Spend** → `/ads/marketplace` (icon `faMoneyBillWave`).

### Page: `AdMarketplacePage` (`'use client'`)
Single page that switches between **4 platforms** (`Meta`, `Shopee`, `TikTok`, `Lazada`) via
tab-pills. The active platform drives the endpoint: `/api/ad-spent/{platform.toLowerCase()}`.

**Layout** (uses the generic scaffold, not the campaign `sv-` set):
```
<div class="sv-page">
  <div class="sv-filter-bar">
    [ tab-pills: Meta | Shopee | TikTok | Lazada ]      (left)
    [ DateRangePicker ] [ Import button ]               (right, ml-auto)
  <KpiStrip cols={5} />                                  ← 5 tiles
  <div class="sv-main">
    <div class="sv-table-panel"> header + <DataTable/>   ← "{platform} Ad Spend — {total} records"
    <div class="sv-chart-panel"> header "Trend" + <ChartPanel/>
  {showImport && <ImportModal/>}
```

**State / data flow:**
- `useEffect` on `[platform, startDate, endDate, page]` → `fetch(endpoint?page&limit&startDate&endDate)`.
- Response shape: `{ data, total, page, limit, summary }`.
- `LIMIT = 25`. Pagination via `DataTable` (server-side).

**KPI tiles (5):** Total Spent (`formatCurrency`), Impressions (`formatNumber`),
Clicks (`formatNumber`), Revenue (`formatCurrency`), ROAS (`revenue/spent`, `.toFixed(2)+'x'`).

**Table columns** (`AD_COLUMNS`):
| Column | Format |
|--------|--------|
| Date | `formatDate` |
| Spent | `formatCurrency` |
| Impressions | `formatNumber` |
| Clicks | `formatNumber` |
| CTR | `(ctr*100).toFixed(2)%` or `—` |
| ROAS | `roas.toFixed(2)x` or `—` |
| Revenue | `formatCurrency` or `—` |

**Charts (`ChartPanel`):**
- Line/Bar from first 10 rows: dataset **Spent** (orange `#E07B39`, filled) + **Revenue**
  (dark `#2C3639`, line).
- Donut: platform mix with brand colors `#1877F2 / #EE4D2D / #000000 / #0F146D`.

**Import:** `ImportModal` posting to `/api/import/ad-spent?platform={platform}`; on success resets to page 1.

### API: `GET /api/ad-spent/{platform}` (pattern, from `meta/route.js`)
```js
// 1. auth guard → 401 if no session; tenantId = session.user.tenantId
// 2. params: page=1, limit=25, startDate, endDate
// 3. where = { tenantId, ...(startDate&&endDate ? { date: { gte, lte } } : {}) }
// 4. prisma.$transaction([ count, findMany(orderBy date desc, skip, take), aggregate(_sum) ])
// 5. CONVERT BigInt/Decimal → Number (impressions, spent, revenue, roas, cpc, ctr)
// 6. return { data, total, page, limit, summary: { spent, clicks, conversions, revenue, impressions } }
```
Each platform route is the same shape against its own `AdSpent*` model (field names vary
per §10 — e.g. Shopee/Lazada aggregate `orders` instead of `conversions`).

> **Note on current completeness:** the Ads module today is a single read/import page with a
> trend chart and 5 KPIs. The donut platform-mix data is currently **hard-coded sample data**
> (`[35,25,30,10]`) — a real per-platform aggregation would need a new summary endpoint.
> This is a likely target for the "develop from old app" work.

---

## 12. CAMPAIGN MODULE

Far more complete than Ads. Two pages: an **index** (per type) and a **show** dashboard.

### File map
```
app/(dashboard)/campaign/page.jsx                 ← creative (default)
app/(dashboard)/campaign/{kol,clipper,affiliate}/page.jsx
app/(dashboard)/campaign/[id]/show/page.jsx       ← analytics dashboard

components/campaign/
├── CampaignModal.jsx, CampaignSummaryCards.jsx, CampaignTable.jsx   (older/top-level helpers)
├── index/
│   ├── CampaignIndexPage.jsx       ← orchestrator (layout + filter state)
│   ├── CampaignTypeNav.jsx         ← sub-type pills
│   ├── CampaignKpiStrip.jsx        ← 4 async KPI tiles
│   ├── CampaignTable.jsx           ← TanStack server-side table
│   ├── CampaignAnalyticsPanel.jsx  ← bar + doughnut + metrics + ROI bar
│   ├── KolExportModal.jsx          ← KOL-type only
│   └── AddCampaignModal.jsx        ← create campaign
└── show/
    ├── CampaignShowHeader.jsx      ← dark sticky header
    ├── StatisticFilters.jsx        ← date range + PIC
    ├── CampaignKpiRows.jsx         ← 4-tile + 5-tile rows
    ├── PerformanceChart.jsx        ← Trends/Correlation switcher
    ├── TopPerformersPanel.jsx      ← 2×2 performer tables
    ├── TopProductsTable.jsx
    ├── ContentActionBar.jsx        ← filters + action buttons
    ├── ContentTable.jsx            ← client-side TanStack
    └── modals/
        ├── AddContentModal.jsx, UpdateContentModal.jsx
        ├── DetailAnalyticsModal.jsx, ManualStatisticModal.jsx
        ├── RefreshStatsModal.jsx, RefreshFollowersModal.jsx
        └── ImportContentModal.jsx, ImportKolContentModal.jsx

app/api/campaigns/
├── route.js                        ← GET list (paginated) / POST create
├── summary/route.js                ← GET KPI summary (drives index KPI strip + analytics)
├── bulk-refresh/route.js
├── kol/export-content/route.js
└── [id]/
    ├── route.js                    ← GET / PUT / DELETE single
    ├── statistic-card/route.js     ← show-page KPI cards + top performers + top products
    ├── statistic-chart/route.js    ← show-page timeseries
    ├── contents/route.js           ← GET content list / POST content
    ├── refresh/route.js, refresh-list/route.js, refresh-followers-list/route.js
    └── export-content/route.js
app/api/campaign-contents/[id]/
    ├── route.js (PUT/DELETE), refresh/route.js, chart-detail/route.js
    └── fyp/route.js, deliver/route.js, payment/route.js   ← GET toggles
app/api/campaign-import/{content,kol-content}/[campaignId]/route.js
app/api/kol/refresh-followers/[username]/route.js
```

### 12.1 Index page — `CampaignIndexPage({ type })`
`type` comes from the route (`creative` is the default `/campaign`). All four types share the
exact same UI; only the accent color/icon/label change.

**Layout (uses campaign `sv-` classes):**
```
<div class="sv-page">
  <div class="sv-topbar">
     [icon] Campaigns  [type chip]   [+ Add] [Export KOL*] [Bulk Refresh]
     ────────────────────────────────  (ml-auto) [month input][date range input][Reset]
  <CampaignTypeNav type/>                          ← sub-type pills
  <CampaignKpiStrip ... />                          ← 4 tiles (async)
  <div class="sv-main">
     <div class="sv-panel" style="flex:0 0 60%">    ← "{type} Campaign Data" + CampaignTable
     <div class="sv-panel" style="flex:1">          ← "Campaign Analytics" + CampaignAnalyticsPanel
  <KolExportModal/> <AddCampaignModal/>
```

- **Topbar buttons** gated by permissions: `+ Add` & `Export KOL` need `create_campaign`;
  `Bulk Refresh` needs `update_campaign`. `Export KOL` only renders when `type === 'kol'`.
- **Filters** = `filterMonth` (`<input type=month>`), `filterDates` (text `DD/MM/YYYY - DD/MM/YYYY`),
  `search`, `Reset`. Changing filters reloads **both** the table and the summary KPIs.
- `Bulk Refresh` → `GET /api/campaigns/bulk-refresh`, toast `Refreshed N campaigns`, spinner on the icon.
- Adding a campaign bumps `tableKey` to remount the table and reloads summary.

**`CampaignTypeNav`** — pills linking the four type routes; active pill `bg-dark1 text-white`,
its icon orange (`.sv-cam-tab-active`).

**`CampaignKpiStrip`** — 4 tiles fetched from `/api/campaigns/summary`: Total Expense
(`fa-credit-card`, dark1), Total GMV (`fa-dollar-sign`, orange), Total Views (`fa-eye`, dark2),
Total Content (`fa-video`, cream). Spinner while loading.

**`CampaignTable`** — TanStack server-side (`manualPagination`), default sort `created_at desc`.
Columns: Title (link → `/campaign/{id}/show`), Total Spend, CPM, Views, **ROI** (color-coded
green/orange/red by ≥2 / ≥1 / <1), GMV, Created By, Actions (View / Edit / Refresh / Delete
26×26 icon buttons; Delete uses SweetAlert2 → `DELETE /api/campaigns/{id}`).

**`CampaignAnalyticsPanel`** — horizontal **bar** (Expense vs GMV: `rgba(44,54,57,.85)` /
`rgba(224,123,57,.85)`), engagement **doughnut** (Views/Likes/Comments: `#2C3639 / #E07B39 /
#DCD7C9`, `cutout 65%`), key-metric tiles, and an **ROI progress bar** (capped at 4× = 100%,
colored green/orange/red).

### 12.2 Show page — `CampaignShowPage({ params })`
Client component; reads `id` via `use(params)`. Background `var(--bg)`.

**Shared filters drive everything.** `filterDates` + `filterPic` are passed to the KPI cards,
the chart, **and** the content table simultaneously. `loadStats()` fetches `statistic-card`
and `statistic-chart` in parallel (`Promise.all`) whenever those filters change.

**Vertical structure:**
```
<CampaignShowHeader campaign/>                 ← dark bar, 3px orange bottom border,
                                                  back arrow, title, date range + creator,
                                                  Edit (orange) / Delete (SweetAlert2) buttons
<StatisticFilters/>                            ← date range + PIC select + Reset
<CampaignKpiRows data loading/>                ← Row1 (4 tiles) + Row2 (5 tiles), spinners
<div flex gap minHeight:360>
   <PerformanceChart chartData/>               ← flex 0 0 60%: Trends(line) ↔ Correlation(scatter+regression)
   <TopPerformersPanel data/>                  ← flex 1: 2×2 grid (Engagements/Likes/Comments/Views, top 5)
<TopProductsTable data=kpiData.top_product/>
<div class="sv-section-card">
   <ContentActionBar/>                         ← platform/FYP/payment/delivery filters + Add/Refresh/Import/Export
   <ContentTable/>                             ← client-side TanStack, combined cells, color-coded
```

- **KPI Row 1 (4):** Total Pengeluaran (`fa-wallet`), Total GMV (`fa-hand-holding-usd`),
  CPM (`fa-chart-bar`), Pencapaian/Achievement = gmv/expense as `"X.XX×"` (`fa-trophy`).
- **KPI Row 2 (5):** Video Views (`far fa-eye`), Total Likes (`fa-thumbs-up`), Comments
  (`fa-comment-dots`), Engagement Rate (`fa-chart-line`), Total Influencer (`fa-users`).
- **PerformanceChart** has two modes: **Trends** = multi-line (Views `#3498db`, Likes
  `#e74c3c`, Comments `#f39c12`); **Correlation** = scatter with user-selectable X/Y axes,
  a computed linear-regression trend line, and a stats panel (R², r, strength, valid points, p-value).
- **ContentTable** loads all rows at once via `GET /api/campaigns/{id}/contents?...filters`
  (filters applied server-side, display client-side). Cells combine two values
  (Influencer/Platform, Talent/PIC, Product/Task) with channel colors + `getColorFromText`.
  The `additional_info` column renders raw HTML toggle buttons hitting the GET toggle endpoints
  (`fyp`/`deliver`/`payment`). Row actions: Edit, Delete (SweetAlert2), Refresh, Detail.

### 12.3 Campaign API conventions
- Same auth + `tenantId` scoping as Ads.
- **List** `GET /api/campaigns?type&page&limit&filterMonth&filterDates&search` → paginated
  `{ data, total, page, limit }`; each row computes `roi = gmv/total_expense`, and view/like/
  comment as a **delta between snapshots** on the date-range bounds (or latest snapshot if no filter).
- **Summary** `GET /api/campaigns/summary` → formatted strings; CPM = `expense / (views/1000)`,
  engagement rate = `(likes+comments)/views*100`.
- **Toggles** (`fyp`/`deliver`/`payment`) are GET endpoints that flip a boolean and return immediately.
- **Refresh modals run sequentially** (one row at a time, awaiting each) to avoid rate-limiting,
  with a progress bar; on 100% they wait ~1s then reload.
- **Import** button variant flips by campaign title: contains "kol" → KOL importer (red),
  else standard importer (green).
- BigInt/Decimal → Number conversion before JSON, always.

---

## 13. Conventions & House Style (follow these when porting)

1. **Pages are `'use client'`** orchestrators that own filter/modal state; data fetched with
   `fetch` in `useEffect`/`useCallback`; child components are mostly presentational.
2. **API routes**: `getServerSession` guard → 401, scope every query by `session.user.tenantId`,
   convert `BigInt`/`Decimal` to `Number` before `NextResponse.json`.
3. **Multi-tenant**: never query without `tenantId`.
4. **Styling**: reuse the existing `@layer components` classes; use the `@theme` color tokens
   (`bg-orange`, `text-dark1`, `border-cream`, …). New module-wide classes go in `globals.css`.
5. **Money** = `formatCurrency` (IDR, 0 decimals); **counts** = `formatNumber` (`id-ID`);
   **dates** = `formatDate` ("dd Mmm yyyy"); ratios as `"X.XXx"`/`"X.XX×"`.
6. **Icons**: FA via `<FontAwesomeIcon>` in shared/layout code, or raw `<i className="fas fa-…">`
   inside the campaign module (CDN stylesheet is loaded globally).
7. **Tables**: server-side TanStack (`DataTable`) for big lists; client-side for detail pages.
8. **Toasts** `react-hot-toast`; **confirm dialogs** `sweetalert2`; **imports** via `ImportModal`.
9. **Permissions** are snake_case (`create_campaign`, `update_campaign`, …); gate UI on
   `session.user.permissions.includes(...)` and enforce again server-side.
10. **Charts**: Chart.js 4 + react-chartjs-2; register `...registerables` once; brand-colored datasets.

---

## 14. Quick gap list for "develop from the old app"

These are areas that exist but look thin/stubbed today and are natural targets:
- **Ads donut** uses hard-coded platform-mix numbers — needs a real cross-platform summary endpoint.
- **Ads** has no per-platform analytics beyond the trend line / 5 KPIs (no breakdown by adset/ad/ad_type).
- **Ads** has no edit/delete UI (read + import only).
- `AdSpentSocialMedia` model exists but isn't surfaced in the UI.
- Campaign **ManualStatisticModal** and **chart-detail** modal exist; verify they're wired to live endpoints when porting.
```
