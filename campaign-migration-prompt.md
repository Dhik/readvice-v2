# Campaign Feature — Full Migration Prompt
## Next.js + Supabase + Prisma + Tailwind

> Hand this file to an AI or developer to implement the complete Campaign feature
> from scratch in the new stack. It covers both pages, all API routes, every modal,
> all chart logic, and every user interaction.

---

## 1. Feature Overview

The Campaign module tracks influencer marketing campaigns across 4 types:
- **Creative** — general creative content campaigns
- **KOL** (Key Opinion Leader) — dedicated influencer campaigns
- **Clipper** — short-clip content campaigns
- **Affiliate Talent** — affiliate commission-based campaigns

Each type shares the **exact same UI and logic**. Type is passed as a URL segment.
The index page lists campaigns. The show page is a full analytics dashboard for a
single campaign, showing content entries, KPI cards, charts, and top performers.

---

## 2. Design System Tokens

```css
:root {
  --dark1:  #2C3639;
  --dark2:  #3F4E4F;
  --cream:  #DCD7C9;
  --orange: #E07B39;
  --bg:     #F5F0E8;
}
```

Font: Inter. All pages use `background: var(--bg)`.

### Type chip colors
```js
const TYPE_CHIP_COLORS = {
  creative:  '#3F4E4F',
  kol:       '#E07B39',
  clipper:   '#2C3639',
  affiliate: '#8B5E3C',
}
const TYPE_ICONS = {
  creative:  'fa-paint-brush',
  kol:       'fa-star',
  clipper:   'fa-film',
  affiliate: 'fa-user-tie',
}
const TYPE_LABELS = {
  creative:  'Creative',
  kol:       'KOL',
  clipper:   'Clipper',
  affiliate: 'Affiliate Talent',
}
```

### Platform channel colors (for content table cells)
```js
const CHANNEL_COLORS = {
  'Instagram feed':  '#E4405F',
  'Instagram story': '#8A3AB9',
  'TikTok video':    '#000000',
  'TikTok live':     '#FF0050',
  'youtube video':   '#FF0000',
  'twitter post':    '#1DA1F2',
  'shopee video':    '#EE4D2D',
}
// fallback: '#6c757d'
```

---

## 3. Prisma Schema (additions needed)

Add these models to `prisma/schema.prisma`:

```prisma
model Campaign {
  id          Int      @id @default(autoincrement())
  tenantId    Int      @map("tenant_id")
  title       String
  type        String   @default("creative") // creative | kol | clipper | affiliate
  purpose     String?
  platform    String?
  startDate   String?  @map("start_date")   // stored as formatted string e.g. "01 Jan 2025"
  endDate     String?  @map("end_date")
  budget      Decimal? @db.Decimal(15,2)
  totalExpense Decimal? @default(0) @db.Decimal(15,2) @map("total_expense")
  view        BigInt?  @default(0)
  like        BigInt?  @default(0)
  comment     BigInt?  @default(0)
  gmv         Decimal? @default(0) @db.Decimal(15,2)
  cpm         Decimal? @default(0) @db.Decimal(10,2)
  status      String?  @default("active")
  createdById Int?     @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  tenant      Tenant           @relation(fields: [tenantId], references: [id])
  createdBy   User?            @relation(fields: [createdById], references: [id])
  contents    CampaignContent[]
  statistics  CampaignStatistic[]

  @@index([tenantId, type])
  @@map("campaigns")
}

model CampaignContent {
  id           Int      @id @default(autoincrement())
  campaignId   Int      @map("campaign_id")
  tenantId     Int      @map("tenant_id")
  username     String
  creatorName  String?  @map("creator_name")
  pic          String?
  taskName     String?  @map("task_name")
  rateCard     Decimal? @db.Decimal(15,2) @map("rate_card")
  channel      String?  // platform: TikTok video, Instagram feed, etc.
  link         String?
  product      String?
  boostCode    String?  @map("boost_code")
  kodeAds      String?  @map("kode_ads")
  view         BigInt?  @default(0)
  like         BigInt?  @default(0)
  comment      BigInt?  @default(0)
  gmv          Decimal? @default(0) @db.Decimal(15,2)
  cpm          Decimal? @default(0) @db.Decimal(10,2)
  kolFollowers BigInt?  @default(0) @map("kol_followers")
  tiering      String?
  isFyp        Boolean? @default(false) @map("is_fyp")
  isDelivered  Boolean? @default(false) @map("is_delivered")
  isPaid       Boolean? @default(false) @map("is_paid")
  uploadDate   DateTime? @map("upload_date")
  additionalInfo String? @map("additional_info") @db.Text
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  statistics ContentStatistic[]

  @@index([campaignId, tenantId])
  @@map("campaign_contents")
}

// Daily statistics snapshot per content item (auto-refreshed from social media API)
model ContentStatistic {
  id          Int      @id @default(autoincrement())
  contentId   Int      @map("content_id")
  date        DateTime
  view        BigInt?  @default(0)
  like        BigInt?  @default(0)
  comment     BigInt?  @default(0)
  gmv         Decimal? @default(0) @db.Decimal(15,2)
  spend       Decimal? @default(0) @db.Decimal(15,2)
  createdAt   DateTime @default(now()) @map("created_at")

  content CampaignContent @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([contentId, date])
  @@index([contentId, date])
  @@map("content_statistics")
}

// Daily statistics snapshot aggregated per campaign (for index-page charts)
model CampaignStatistic {
  id         Int      @id @default(autoincrement())
  campaignId Int      @map("campaign_id")
  date       DateTime
  view       BigInt?  @default(0)
  like       BigInt?  @default(0)
  comment    BigInt?  @default(0)
  gmv        Decimal? @default(0) @db.Decimal(15,2)
  spend      Decimal? @default(0) @db.Decimal(15,2)
  createdAt  DateTime @default(now()) @map("created_at")

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([campaignId, date])
  @@index([campaignId, date])
  @@map("campaign_statistics")
}
```

---

## 4. App Directory Structure

```
app/(dashboard)/
├── campaign/
│   └── [type]/
│       └── page.jsx              ← INDEX page (/campaign/creative, /campaign/kol, etc.)
├── campaign/
│   └── [id]/
│       └── show/
│           └── page.jsx          ← SHOW page (/campaign/123/show)

app/api/
├── campaigns/
│   ├── route.js                  ← GET (paginated list), POST (create)
│   ├── summary/route.js          ← GET summary KPIs
│   ├── [id]/
│   │   ├── route.js              ← GET (single), PUT (update), DELETE
│   │   ├── statistic-card/route.js  ← GET KPI cards for show page
│   │   ├── statistic-chart/route.js ← GET chart timeseries data
│   │   ├── refresh/route.js         ← GET trigger recap
│   │   ├── refresh-list/route.js    ← GET content list for refresh modal
│   │   ├── refresh-followers-list/route.js  ← GET unique usernames
│   │   ├── export-content/route.js  ← GET Excel export
│   │   └── contents/
│   │       └── route.js          ← GET content list, POST create content
│   └── bulk-refresh/route.js     ← GET
├── campaign-contents/
│   └── [contentId]/
│       ├── route.js              ← PUT (update), DELETE
│       ├── refresh/route.js      ← GET refresh stats from social API
│       ├── chart-detail/route.js ← GET per-content timeseries
│       ├── fyp/route.js          ← GET toggle FYP
│       ├── deliver/route.js      ← GET toggle delivery
│       └── payment/route.js      ← GET toggle payment
├── campaign-import/
│   ├── content/[campaignId]/route.js      ← POST import standard Excel
│   └── kol-content/[campaignId]/route.js  ← POST import KOL Excel
└── kol/
    └── refresh-followers/[username]/route.js ← GET refresh follower count

components/campaign/
├── index/
│   ├── CampaignIndexPage.jsx
│   ├── CampaignTypeNav.jsx       ← Sub-type pill navigation
│   ├── CampaignKpiStrip.jsx      ← 4 KPI tiles (async loaded)
│   ├── CampaignTable.jsx         ← TanStack Table (server-side)
│   ├── CampaignAnalyticsPanel.jsx ← Bar chart + Doughnut + metrics
│   └── KolExportModal.jsx        ← KOL-type only
└── show/
    ├── CampaignShowHeader.jsx    ← Dark header bar with back/edit/delete
    ├── StatisticFilters.jsx      ← Date range + PIC filter
    ├── CampaignKpiRows.jsx       ← 4+5 KPI tile rows
    ├── PerformanceChart.jsx      ← Trends/Correlation switcher
    ├── TopPerformersPanel.jsx    ← 2×2 grid of top performer tables
    ├── TopProductsTable.jsx
    ├── ContentActionBar.jsx      ← Filters + action buttons
    ├── ContentTable.jsx          ← TanStack Table (client-side, all data at once)
    └── modals/
        ├── AddContentModal.jsx
        ├── UpdateContentModal.jsx
        ├── DetailAnalyticsModal.jsx
        ├── RefreshStatsModal.jsx
        ├── RefreshFollowersModal.jsx
        ├── ImportContentModal.jsx
        ├── ImportKolContentModal.jsx
        └── ManualStatisticModal.jsx
```

---

## 5. API Routes (Next.js)

### 5.1 `GET /api/campaigns` — Paginated list
```
Query params:
  type        string   required  creative|kol|clipper|affiliate
  page        number   default 1
  limit       number   default 25
  filterMonth string   "2025-01" (YYYY-MM)
  filterDates string   "01/01/2025 - 31/01/2025" (DD/MM/YYYY - DD/MM/YYYY)
  search      string   searches campaign title

Returns:
{
  data: [{
    id, title, type,
    total_expense: number,
    cpm: number,
    view: number,         ← delta between daterange start/end, or latest snapshot
    like: number,
    comment: number,
    roi: number,          ← gmv / total_expense, 2 decimals
    gmv: number,
    created_at: "DD MMM YYYY",
    created_by_name: string,
  }],
  total: number,
  page: number,
  limit: number
}
```

**ROI calculation:** `roi = gmv / total_expense` (rounded to 2 decimals, 0 if expense=0)
**View/Like/Comment with date filter:** fetch difference between the snapshot on startDate and endDate from `CampaignStatistic`. Without filter: use the latest snapshot date.

### 5.2 `GET /api/campaigns/summary` — KPI summary
```
Query params: type, filterMonth, filterDates, search

Returns:
{
  total_expense:  "formatted string e.g. 1,234,567",
  total_gmv:      "formatted string",
  cpm:            "formatted string",
  views:          "formatted string",
  likes:          "formatted string",
  comments:       "formatted string",
  total_content:  "formatted string",
  engagement_rate: "x.xx%"
}
```

**CPM formula:** `total_expense / (total_views / 1000)` — cost per thousand views
**Engagement Rate:** `(likes + comments) / views * 100`, rounded to 2 decimals

### 5.3 `GET /api/campaigns/[id]` — Single campaign
```
Returns: { id, title, type, startDate, endDate, createdBy: {name}, ...all fields }
```

### 5.4 `DELETE /api/campaigns/[id]` — Delete campaign + all its contents
```
Returns: { message: "Deleted successfully" } or 500 error
```

### 5.5 `GET /api/campaigns/bulk-refresh` — Bulk refresh (current + last month)
```
Returns: { message: "success", processed: number }
```

### 5.6 `GET /api/campaigns/[id]/statistic-card` — KPI cards for show page
```
Query params: filterDates, filterPic

Returns:
{
  total_expense:    "Rp 1.234.567",
  cpm:              "Rp 12.345",
  total_influencer: "42",
  total_gmv:        "Rp 5.678.900",
  achievement:      "4.6×",      ← gmv / total_expense
  view:             "1.234.567",
  like:             "12.345",
  comment:          "1.234",
  engagement_rate:  "3.45%",
  top_likes:    [{ id, key_opinion_leader_name, like }],      ← top 5
  top_comment:  [{ id, key_opinion_leader_name, comment }],
  top_view:     [{ id, key_opinion_leader_name, view }],
  top_engagement: [{ id, key_opinion_leader_name, engagement }],
  top_product:  [{
    product, total_views, total_spend, total_content, cpm, target
  }]
}
```

**Filtering:** When filterDates is set, restrict ContentStatistic records to that range.
When filterPic is set, restrict to CampaignContent rows where pic = filterPic.
**Top performers:** Group content by username, sum metrics, take top 5 DESC.
**Top products:** Group content by product, aggregate, take top 5 by views DESC.

### 5.7 `GET /api/campaigns/[id]/statistic-chart` — Chart timeseries
```
Query params: filterDates, filterPic

Returns array (one object per date in range):
[{
  date:          "2025-01-15",
  total_view:    number,
  total_like:    number,
  total_comment: number,
  total_spend:   number,
  total_gmv:     number
}]
```

Group ContentStatistic by date, filter by campaignId → join to contents → sum all metrics per day.

### 5.8 `GET /api/campaigns/[id]/contents` — Content list (non-paginated)
```
Query params:
  filterInfluencer  string  search by username
  filterProduct     string  search by product
  filterPlatform    string  exact match on channel
  filterFyp         bool    filter is_fyp=true
  filterPic         string  exact match on pic
  filterPayment     bool    filter is_paid=true
  filterDelivery    bool    filter is_delivered=true

Returns array:
[{
  id, username, channel, creator_name, pic, task: task_name,
  product, kode_ads, upload_date: "DD MMM YYYY" or null,
  rate_card: number,
  rate_card_formatted: "1.234.567",
  like: number, comment: number, view: number,
  cpm: "1.234", engagement_rate: "3.45%",
  gmv: "1.234.567",
  kol_followers: number, tiering: string,
  boost_code, link,
  additional_info: "<html buttons for FYP/Payment/Delivery toggles>",
  actions: "<html action buttons>"
}]
```

### 5.9 `POST /api/campaigns/[id]/contents` — Create content entry
```
Body (JSON):
{
  username, creator_name, pic, task_name, rate_card, channel,
  link, product, boost_code, kode_ads
}
Returns: { message: "Created", content: {...} }
```

### 5.10 `PUT /api/campaign-contents/[contentId]` — Update content
```
Body: same fields as create, plus: views, likes, comments (manual override)
Returns: { message: "Updated" }
```

### 5.11 `DELETE /api/campaign-contents/[contentId]` — Delete content
```
Returns: { message: "Deleted" }
```

### 5.12 `GET /api/campaigns/[id]/refresh-list` — Get content for refresh modal
```
Returns:
[{
  id, username, task_name: task, channel, product
}]
```

### 5.13 `GET /api/campaign-contents/[contentId]/refresh` — Refresh single content stats
```
Triggers external social media API scrape (TikTok/Instagram/etc.).
Updates ContentStatistic with fresh view/like/comment counts.
Returns: { success: true } or error
```

### 5.14 `GET /api/campaigns/[id]/refresh-followers-list` — Get unique usernames
```
Returns: [{ id, username, channel }]  ← deduplicated by username
```

### 5.15 `GET /api/kol/refresh-followers/[username]` — Refresh follower count
```
Returns: { success: true, followers: number }
```

### 5.16 `GET /api/campaign-contents/[contentId]/chart-detail` — Per-content timeseries
```
Returns:
{
  engagement: [{ date, view, like, comment }],
  gmv: [{ date, gmv }],
  meta: { views, likes, comments, engagement_rate, gmv, roi, rate_card, kode_ads, upload_date, link }
}
```

### 5.17 `POST /api/campaign-import/content/[campaignId]` — Import standard Excel
```
multipart/form-data: { file: File }
Excel columns: username, creator_name, pic, task_name, channel, link, product, boost_code, kode_ads, rate_card
Returns: { imported: number, errors: [] }
```

### 5.18 `POST /api/campaign-import/kol-content/[campaignId]` — Import KOL Excel
```
multipart/form-data: { file: File }
Excel columns: username, creator_name, pic, task_name, channel, link, product,
               kode_ads, rate_card, upload_date, dealing_upload_date, kol_followers
Returns: { imported: number, errors: [] }
```

### 5.19 `GET /api/campaigns/[id]/export-content` — Download Excel
```
Returns: Excel file download (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
Columns: ID, Username, Creator Name, PIC, Task, Channel, Product, Ads Code,
         Upload Date, Rate Card, Views, Likes, Comments, CPM, ER, GMV, Followers, Tier
```

### 5.20 `GET /api/campaigns/kol/export-content` — KOL content export (index page)
```
Query: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
Returns: Excel with all KOL contents in date range
```

---

## 6. Page 1: Campaign Index (`/campaign/[type]`)

### Layout structure
```
<div class="sv-page">                      ← full viewport height flex column, gap: 8px
  <div class="sv-topbar">                  ← flex row, white card
  <div class="sv-cam-nav">                 ← sub-type pill navigation
  <div class="sv-kpi-strip">              ← 4 KPI tiles, flex row
  <div class="sv-main">                   ← flex row, flex: 1
    <div class="sv-panel" style="flex:0 0 60%">  ← Table panel
    <div class="sv-panel" style="flex:1">         ← Analytics panel
```

### Topbar content (left → right)
1. Title: `<icon> Campaigns` + type chip badge
2. **Add** button → navigate to `/campaign/create` (permission: `createCampaign`)
3. **Export KOL Content** button (only when type=kol, permission: `createCampaign`)
   → opens KOL Export Modal
4. **Bulk Refresh** button (permission: `updateCampaign`)
   → calls `GET /api/campaigns/bulk-refresh`, shows spinner, then reloads table + KPIs
5. Right side (ml-auto): Month picker input + Date range picker input + Reset button

### Sub-type Nav (`.sv-cam-nav`)
Three pill buttons: Affiliate Talent → `/campaign/affiliate`, KOL → `/campaign/kol`, Clipper → `/campaign/clipper`
Active pill: `bg-dark1 text-white font-semibold`, icon color orange.
Inactive pill: hover with bg-cream.
Note: "Creative" is the default and has no nav pill — it's the base URL `/campaign/creative`.

### KPI Strip (4 tiles, async loaded on mount)
Data from: `GET /api/campaigns/summary?type={type}&filterMonth=X&filterDates=Y`

| # | Icon | Icon bg | Label | Key |
|---|------|---------|-------|-----|
| 1 | fa-credit-card | #2C3639 | Total Expense | total_expense |
| 2 | fa-dollar-sign | #E07B39 | Total GMV | total_gmv |
| 3 | fa-eye | #3F4E4F | Total Views | views |
| 4 | fa-video | #DCD7C9 (icon dark) | Total Content | total_content |

Show spinner (`w-3 h-3 animate-spin`) while loading. Fade-out/fade-in on update.

### Campaign Table (left panel, 60%)
Header: `<fa-table> {type} Campaign Data`

**Columns:**

| Column | Key | Notes |
|--------|-----|-------|
| Created At | created_at | **hidden** (used for sorting) |
| Title | title | Link to `/campaign/{id}/show`, bold |
| Total Spend | total_expense | formatted number, right-aligned, dark2 color |
| CPM | cpm | formatted number, right-aligned |
| Views | view | formatted number, right-aligned |
| ROI | roi | color-coded: >2→green #2C6E3F, 1-2→orange, <1→red |
| GMV | gmv | formatted number, right-aligned, dark1 |
| Created By | created_by_name | **hidden** |
| Actions | — | icon buttons (see below) |

**Action buttons (26×26px icon buttons):**
- View: bg-dark1, `<fa-eye>`, link to `/campaign/{id}/show`
- Edit: bg-orange, `<fa-pencil-alt>`, link to `/campaign/{id}/edit` (permission: updateCampaign)
- Refresh: ghost border, `<fa-sync-alt>`, calls `GET /api/campaigns/{id}/refresh` then reloads (permission: updateCampaign)
- Delete: ghost border, text-red, `<fa-trash-alt>`, SweetAlert2 confirm → `DELETE /api/campaigns/{id}` (permission: deleteCampaign)

**DataTable behavior:**
- Server-side pagination (TanStack Table v8, `manualPagination: true`)
- Default sort: created_at DESC
- On filter change (month/dates): reload table + reload KPI summary
- On search change: reload KPI summary
- On delete success: reload table + reload KPI summary

### Analytics Panel (right panel, flex:1)
Header: `<fa-chart-line> Campaign Analytics` + metric selector dropdown (Expense vs GMV | Engagement)

**Chart 1 — Expense vs GMV (horizontal bar, height: 148px)**
```js
type: 'bar', indexAxis: 'y',
labels: ['Expense', 'GMV'],
colors: ['rgba(44,54,57,0.85)', 'rgba(224,123,57,0.85)'],
borderRadius: 5,
x-axis ticks: shortNum() formatter (K/M/B)
tooltip: Intl.NumberFormat('id-ID')
```

**Chart 2 — Engagement Doughnut (height: 115px)**
```js
type: 'doughnut', cutout: '65%',
labels: ['Views', 'Likes', 'Comments'],
colors: ['#2C3639', '#E07B39', '#DCD7C9'],
legend: position 'right', font size 9px
```

**Key Metrics section (below charts):**
```
Row 1: [ CPM tile ] [ Avg ER tile ]
Row 2: [ Total Likes tile ] [ Comments tile ]
```

**ROI Progress Bar:**
```
Label: "GMV / Expense Ratio"      value text: "{ratio}×" right-aligned
Bar: 0–100%, capped at 4× = 100%
Color: ratio >= 2 → #28a745 green
       ratio >= 1 → #E07B39 orange
       ratio < 1  → #dc3545 red
Scale labels: 0×  2×  4×+
```

Data update: whenever summary loads, call `updateCharts(response)` and `updateRoiBar(ratio)`.

### KOL Export Modal (KOL type only)
```
Title: <fa-file-excel> Export KOL Content
Body:  Date range picker (default: last 30 days)
Footer: Cancel | Export (with loading spinner)
Export action: window.location.href = /api/campaigns/kol/export-content?start_date=X&end_date=Y
               then close modal after 1.5s timeout
```

---

## 7. Page 2: Campaign Show (`/campaign/[id]/show`)

### Show Header (dark sticky bar)
```
Background: #2C3639
Border-bottom: 3px solid #E07B39
Padding: 12px 20px

Left side:
  - Back arrow button (28×28, rounded, rgba white bg) → router.back()
  - Campaign title (h5, bold, white, overflow ellipsis)
  - Subtitle: <fa-calendar-alt orange> {startDate} — {endDate}
              | Created by: {createdBy.name}

Right side:
  - Edit button (orange, fa-pencil-alt) → /campaign/{id}/edit
  - Delete button (ghost danger) → SweetAlert2 confirm → DELETE /api/campaigns/{id} → router.push('/campaign/creative')
```

### Body (padding 14px 16px)

#### A. Filter Topbar
White card with flex row:
- Left: Date range picker (`filterDates`), PIC select dropdown (hardcoded options: Alni, Amel, Putri, Nova, Naufal, Aisyah, Silmi, Cantika, Acha, Afra), Reset button
- On any filter change: reload KPI cards, reload chart, reload content table

#### B. KPI Row 1 (4-column grid)
Data from: `GET /api/campaigns/[id]/statistic-card`

| Icon | Bg | Label | Key |
|------|----|-------|-----|
| fa-wallet | red | Total Pengeluaran (Expense) | total_expense |
| fa-hand-holding-usd | green | Total GMV | total_gmv |
| fa-chart-bar | blue | Cost Per Mile (CPM) | cpm |
| fa-trophy | orange | Pencapaian (Achievement) | achievement |

#### C. KPI Row 2 (5-column grid)
| Icon | Bg | Label | Key |
|------|----|-------|-----|
| far fa-eye | purple | Video Views | view |
| fa-thumbs-up | pink | Total Likes | like |
| fa-comment-dots | orange | Comments | comment |
| fa-chart-line | teal | Engagement Rate | engagement_rate |
| fa-users | dark2 | Total Influencer | total_influencer |

Show spinner on all cells while loading. Update with fade animation.

#### D. Analytics Row (flex, two panels)

**Chart Panel (flex: 0 0 60%)**
- Dark header: `<fa-chart-line> Campaign Performance Analytics` + Trends | Correlation toggle buttons
- Body:
  - Scatter Controls (hidden by default, shown when Correlation active):
    - X-Axis select: Daily Spend | Daily GMV | Daily Views | Daily Likes | Daily Comments
    - Y-Axis select: same options (default: Daily GMV)
  - Chart area (340px height): `<canvas id="statisticChart">`
  - Stats Panel (220px width, hidden by default, shown in Correlation mode)

**View 1 — Trends (Line Chart)**
```js
type: 'line',
datasets: [
  { label: 'Views',    borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', fill: true,
    data: chartData.map(d => d.total_view) },
  { label: 'Likes',   borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', fill: true,
    data: chartData.map(d => d.total_like) },
  { label: 'Comments', borderColor: '#f39c12', backgroundColor: 'rgba(243,156,18,0.1)', fill: true,
    data: chartData.map(d => d.total_comment) },
],
labels: chartData.map(d => d.date),
options: { responsive: true, maintainAspectRatio: false,
  tooltips: { mode: 'index', intersect: false,
    callbacks: { label: (item) => label + ': ' + Intl.NumberFormat().format(item.yLabel) }
  }
}
```

**View 2 — Correlation (Scatter + Trend Line)**
```js
type: 'scatter',
// X/Y axes driven by dropdown selectors
scatterData = chartData.map(d => ({
  x: d[xAxisKey], y: d[yAxisKey],
  date: d.date, spend: d.total_spend, gmv: d.total_gmv,
  views: d.total_view, likes: d.total_like, comments: d.total_comment
}))

// Calculate linear regression
slope = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX)
intercept = (sumY - slope*sumX) / n
r = correlation coefficient
rSquared = r²
pValue = simplified t-test

// Second dataset: trend line (2 points: minX → maxX)
trendLine = [{ x: minX, y: slope*minX+intercept }, { x: maxX, y: slope*maxX+intercept }]
```

**Correlation Stats Panel** (shown right of chart in correlation mode, 220px):
```
Correlation Statistics
R-squared (R²): 0.7823
Correlation (r): 0.8845**
Strength: Strong
Valid Points: 28/30
P-value: 0.010
--- footnote: *** p<0.001, ** p<0.01, * p<0.05, † p<0.1 ---
```

**Top Performers Panel (flex: 1)**
Dark header: `<fa-medal> Top Performers`
2×2 grid of performer tables (4 total):
- Top Engagements (orange left border, `<fa-fire>`)
- Top Likes (pink `#e83e8c` left border, `<fa-thumbs-up>`)
- Top Comments (orange `#fd7e14` left border, `<fa-comment-dots>`)
- Top Views (blue `#007bff` left border, `<far fa-eye>`)

Each table: 2 columns — influencer name (link to `/kol/{id}/show` if id exists) | metric value.
Top 5 rows each.

#### E. Top Products Performance Table
Full-width card. Columns: Product | Views | Spend | Total Content | CPM | Target
Loaded from `statistic-card` response → `top_product` array.

#### F. Content Table Section
**Action bar (top of content section):**

Left filters:
- Platform select: (blank → all, then list all channels)
- FYP checkbox
- Payment checkbox
- Delivery checkbox

Right action buttons:
- Add (dark bg, `<fa-plus>`) → open AddContentModal (permission: updateCampaign)
- Refresh Stats (green, `<fa-sync-alt>`) → open RefreshStatsModal
- Refresh Followers (blue-info, `<fa-sync-alt>`) → open RefreshFollowersModal
- Export (outline, `<fa-file-download>`) → `/api/campaigns/{id}/export-content` (download)
- Import (green outline, `<fa-file-upload>`) → open ImportContentModal
  - If campaign title contains "ibooming" OR default: green → ImportContentModal
  - If campaign title contains "kol": red → ImportKolContentModal

**Content DataTable columns:**

| # | Header | Key | Notes |
|---|--------|-----|-------|
| 1 | ID | id | hidden |
| 2 | Influencer / Platform | username + channel | combined cell: username bold, channel italic with channel color |
| 3 | Talent / PIC | creator_name + pic | combined: creator_name, pic italic with `getColorFromText(pic)` |
| 4 | Product / Task | product + task_name | combined: product bold, task_name italic with `getColorFromText(task)` |
| 5 | Ads Code | kode_ads | hidden |
| 6 | Upload Date | upload_date | hidden |
| 7 | Rate Card | rate_card_formatted | right-aligned |
| 8 | Likes | like | right-aligned, toLocaleString() |
| 9 | Comments | comment | right-aligned |
| 10 | Views | view | right-aligned |
| 11 | CPM | cpm | right-aligned |
| 12 | ER | engagement_rate | right-aligned |
| 13 | GMV | gmv | right-aligned |
| 14 | Followers / Tier | kol_followers + tiering | combined right-aligned |
| 15 | Additional Info | additional_info | raw HTML (FYP/payment/delivery toggle buttons) |
| 16 | Actions | — | edit/delete/refresh/detail buttons |

**`getColorFromText(text)` function:**
```js
function getColorFromText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
}
```

**Content row action buttons (in `actions` column):**
- Edit: `<fa-pencil-alt>` → populate UpdateContentModal + open it
- Delete: `<fa-trash-alt>` → SweetAlert2 confirm → DELETE /api/campaign-contents/{id}
- Refresh: `<fa-sync-alt>` → GET /api/campaign-contents/{id}/refresh (row-level)
- Detail: `<fa-chart-line>` → load chart data → open DetailAnalyticsModal

**Content table uses client-side rendering (not server-side paginated).** All rows loaded
at once via `GET /api/campaigns/{id}/contents?...` and filtered client-side with TanStack.
On filter change: refetch from API (filters applied server-side).

---

## 8. Modals

### 8.1 Add Content Modal
```
Size: max-w-2xl
Title: Add Content

Fields (all required unless noted):
  username*         text input      "Influencer"
  creator_name*     text input      "Creator Name"
  pic*              select          Options: Alni, Amel, Putri, Naufal, Aisyah, Silmi, Cantika, Acha, Afra, Zinny
  task_name*        text input      "Task"
  rate_card*        number input    formatted as IDR money
  channel*          select          Platform options (see below)
  link              text input      optional
  product*          text input
  boost_code        text input      optional
  kode_ads          text input      optional (Ads Code)

Platform options:
  TikTok video | TikTok live | Instagram feed | Instagram story |
  youtube video | twitter post | shopee video

Submit: POST /api/campaigns/{id}/contents
On success: close modal, reset form, reload content table, show toast "Content saved"
On error: show field-level validation errors below each field
```

### 8.2 Update Content Modal
```
Size: max-w-2xl
Title: Update Content

Same fields as Add, plus:
  username          text input    READONLY (populated from row)
  views             number input  (manual override)
  likes             number input  (manual override)
  comments          number input  (manual override)
  hidden: contentId

Trigger: click Edit button on content row → pre-populate all fields from row data:
  username, creator_name, pic, task (→ task_name), rate_card,
  channel, link, product, boost_code, kode_ads, view, like, comment

Submit: PUT /api/campaign-contents/{contentId}
On success: close modal, reload content table, show toast "Content updated"
```

### 8.3 Detail Analytics Modal
```
Size: modal-xl (max-width: 1400px)
Title: <fa-chart-line> Content Analytics

Layout: 2 columns
  Left (25%): Content Preview
    - iframe embed of the content link
    - Shows thumbnail/embed for TikTok/Instagram/YouTube URLs

  Right (75%): Performance Metrics
    Row 1 (3 KPI boxes): Views | Likes | Comments
    Row 2 (3 KPI boxes): Engagement % | Total GMV | ROI
    Row 3 (3 KPI boxes): Rate Card | Ads Code | Post Date

    Below KPI boxes — 2 charts side by side:
      Left: "Engagement Analytics" (line chart, 320px)
            Datasets: Views, Likes, Comments over time
      Right: "GMV Trend" (line chart, 320px)
             Dataset: GMV over time

Data: GET /api/campaign-contents/{contentId}/chart-detail
Trigger: click Detail button on content row
```

### 8.4 Refresh Stats Modal
```
Size: max-w-2xl
Title: Content to be Refreshed

Trigger: "Refresh Stats" button → fetch content list first via GET /api/campaigns/{id}/refresh-list
         → show in modal table, then user clicks "Refresh All"

Body:
  Table with columns: Influencer Name | Task | Social Media | Product | Status
  Each row has status cell: initially <fa-clock text-warning> (pending)

  Progress bar (0% → 100%)

Footer: Close | Refresh All button

"Refresh All" click logic:
  1. Iterate each table row sequentially
  2. For each row: change status to <fa-spinner text-primary spin>
  3. Call GET /api/campaign-contents/{id}/refresh
  4. On success: status → <fa-check text-success>
  5. On error: status → <fa-times text-danger>
  6. Increment progress bar after each row
  7. When all done (100%): wait 1 second, close modal, reload page
```

### 8.5 Refresh Followers Modal
```
Size: max-w-2xl
Title: Followers to be Refreshed

Trigger: "Refresh Followers" button → fetch unique usernames via GET /api/campaigns/{id}/refresh-followers-list

Body:
  Table: Influencer Name | Social Media | Status
  Progress bar

Footer: Close | Refresh Followers button

"Refresh Followers" click logic:
  Same as Refresh Stats but calls GET /api/kol/refresh-followers/{username}
  Uses username (not contentId)
  Deduplicates by username (only one row per unique username)
```

### 8.6 Import Content Modal
```
Size: max-w-xl
Title: Import Content

Body:
  Link: "Download Template" → GET /api/campaigns/template/standard (Excel download)
  File input: accepts .xlsx, .xls, .csv

Footer: Cancel | Import button

Submit: POST /api/campaign-import/content/{campaignId}
  multipart/form-data { file }
On success: show "X rows imported" + reload content table
On error: show error list
```

### 8.7 Import KOL Content Modal
```
Size: max-w-xl
Title: Import KOL Content

Body:
  Link: "Download Template KOL" → GET /api/campaigns/template/kol
  File input

Footer: Cancel | Import button

Submit: POST /api/campaign-import/kol-content/{campaignId}
  Extra columns in KOL template: upload_date, dealing_upload_date, kol_followers
```

### 8.8 Manual Statistic Modal
```
Size: max-w-lg
Title: Add Data (manual statistic entry)

Fields:
  date      text (readonly, shows today's date "DD MMM YYYY")
  view      number
  like      number
  comment   number
  hidden:   statisticContentId

Submit: POST /api/campaign-contents/{contentId}/statistic
Trigger: "Add Stats" action in content row actions
```

---

## 9. Filter Logic

### Date Range Filter (both pages)
Input format: `"DD/MM/YYYY - DD/MM/YYYY"` (daterangepicker format)

When parsing on the server:
```js
const [start, end] = filterDates.split(' - ')
const startDate = parse(start, 'dd/MM/yyyy', new Date())
const endDate = parse(end, 'dd/MM/yyyy', new Date())
// use startOfDay and endOfDay
```

Preset ranges: Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month.

### Month Filter (index page only)
Input type="month" → value like `"2025-01"`.
Filter campaigns by `start_date` month + year.

### PIC Filter (show page)
Filter content entries where `pic = filterPic`.

---

## 10. Utility Functions

```js
// Format number with thousand separators (Indonesian style)
function formatIDR(value) {
  return new Intl.NumberFormat('id-ID').format(value ?? 0)
}

// Short number for chart axes
function shortNum(val) {
  if (val >= 1e9) return (val/1e9).toFixed(1) + 'B'
  if (val >= 1e6) return (val/1e6).toFixed(1) + 'M'
  if (val >= 1e3) return (val/1e3).toFixed(0) + 'K'
  return String(val)
}

// Color a string deterministically (for PIC/task labels)
function getColorFromText(text) {
  if (!text || text === 'N/A') return '#6c757d'
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash % 360)}, 65%, 45%)`
}

// Parse formatted number string back to int (for chart data extraction)
function parseNumeric(str) {
  const n = parseInt(String(str ?? '').replace(/[^\d]/g, ''), 10)
  return isNaN(n) ? 0 : n
}
```

---

## 11. Permissions

Check `session.user.permissions` before rendering action buttons/forms.
Permission strings used in this feature:

| Permission | Controls |
|------------|----------|
| `viewCampaign` | Can see the campaign index page |
| `createCampaign` | Show "Add" button + "Export KOL Content" |
| `updateCampaign` | Show "Bulk Refresh", Edit button, content Add/Import buttons |
| `deleteCampaign` | Show Delete button |

In Next.js, check permissions client-side for UI rendering,
and server-side in API routes for enforcement.

---

## 12. Tailwind CSS Classes Needed

Add these to `app/globals.css` `@layer components` (supplement to main plan):

```css
/* Campaign page layout */
.sv-page {
  @apply flex flex-col gap-2 overflow-hidden;
  height: calc(100vh - 54px); /* subtract topbar height */
  font-family: 'Inter', sans-serif;
}

/* Topbar */
.sv-topbar {
  @apply bg-white border border-cream rounded-lg px-3 py-1.5 flex items-center gap-1.5 flex-wrap flex-shrink-0;
}
.sv-topbar-title {
  @apply text-sm font-bold text-dark1 pr-2 border-r-2 border-cream mr-0.5 whitespace-nowrap;
}
.sv-tbtn {
  @apply inline-flex items-center gap-1 text-xs h-7 px-2.5 rounded font-medium cursor-pointer transition-all whitespace-nowrap no-underline border border-transparent;
  line-height: 1;
}
.sv-tbtn-primary { @apply bg-orange border-orange text-white hover:bg-[#c9662a]; }
.sv-tbtn-dark    { @apply bg-dark1 border-dark1 text-white hover:bg-dark2; }
.sv-tbtn-ghost   { @apply bg-transparent border-cream text-dark2 hover:bg-bg hover:border-dark2 hover:text-dark1; }

/* Sub-type nav */
.sv-cam-nav {
  @apply bg-white border border-cream rounded-lg px-2.5 py-1 flex items-center gap-1 flex-shrink-0 overflow-x-auto;
  scrollbar-width: none;
}
.sv-cam-tab {
  @apply inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium text-dark2 no-underline whitespace-nowrap border border-transparent transition-all cursor-pointer;
}
.sv-cam-tab:hover { @apply bg-bg text-dark1 border-cream; }
.sv-cam-tab-active { @apply bg-dark1 text-white font-semibold border-dark1 cursor-default; }
.sv-cam-tab-active i { @apply text-orange; }

/* KPI strip */
.sv-kpi-strip { @apply flex gap-1.5 flex-shrink-0; }
.kpi-tile {
  @apply bg-white border border-cream rounded-lg p-1.5 flex items-center gap-2 flex-1 min-w-0;
}
.kpi-tile-icon {
  @apply w-[30px] h-[30px] rounded-[7px] flex items-center justify-center text-[13px] flex-shrink-0 text-white;
}
.kpi-tile-label {
  @apply text-[9px] text-[#888] uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis;
}
.kpi-tile-value {
  @apply text-[13px] font-bold text-dark1 whitespace-nowrap leading-tight min-h-[18px];
}

/* Main split */
.sv-main { @apply flex gap-2 flex-1 min-h-0; }

/* Panel */
.sv-panel {
  @apply bg-white border border-cream rounded-lg flex flex-col overflow-hidden;
}
.sv-panel-header {
  @apply px-3 py-1.5 border-b border-cream flex items-center justify-between flex-shrink-0;
  background: #fafaf8;
}
.sv-panel-title {
  @apply text-xs font-semibold text-dark1 flex items-center gap-1.5;
}
.sv-panel-body { @apply flex-1 overflow-auto p-2; }

/* Right-panel analytics sections */
.sv-chart-section  { @apply p-2 border-b border-cream; flex: 0 0 185px; min-height: 0; }
.sv-funnel-section { @apply px-2 py-1 border-b border-cream; flex: 0 0 150px; min-height: 0; }
.sv-insights-section { @apply flex-1 overflow-y-auto p-1.5; }

/* Metric cards in insights panel */
.metric-row  { @apply flex gap-1 mb-1; }
.metric-card { @apply flex-1 bg-bg rounded-md p-1.5 min-w-0; }
.metric-card-label { @apply text-[9px] text-[#999] uppercase tracking-[.3px] whitespace-nowrap overflow-hidden text-ellipsis; }
.metric-card-value { @apply text-xs font-bold text-dark1 whitespace-nowrap min-h-[16px]; }

/* Show page header */
.sv-sh-header {
  @apply bg-dark1 text-white px-5 py-3 flex items-center justify-between gap-3 flex-wrap;
  border-bottom: 3px solid #E07B39;
}

/* Show page KPI grids */
.sv-kpi-row {
  @apply grid gap-2 mb-2;
  grid-template-columns: repeat(4, 1fr);
}
.sv-kpi-row-5 { grid-template-columns: repeat(5, 1fr); }
.sv-kpi-tile {
  @apply bg-white border border-cream rounded-lg px-3 py-2.5 flex items-center gap-2.5 transition-all hover:border-orange hover:shadow-sm;
}
.sv-kpi-icon {
  @apply w-9 h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0;
}
.sv-kpi-label {
  @apply text-[10px] font-semibold text-[#999] uppercase tracking-[.3px] whitespace-nowrap;
}
.sv-kpi-value {
  @apply text-sm font-bold text-dark1 whitespace-nowrap overflow-hidden text-ellipsis;
}

/* Analytics row */
.sv-chart-panel {
  @apply bg-white border border-cream rounded-lg overflow-hidden flex flex-col min-w-0;
  flex: 0 0 60%;
}
.sv-performers-panel {
  @apply flex-1 bg-white border border-cream rounded-lg overflow-hidden flex flex-col min-w-0;
}
.sv-panel-header-dark {
  @apply bg-dark1 text-white px-3 py-2 flex items-center justify-between text-xs font-semibold flex-shrink-0;
}
.sv-chart-btn {
  @apply text-[11px] px-2 py-0.5 rounded border cursor-pointer transition-all;
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.2);
  color: rgba(255,255,255,.7);
}
.sv-chart-btn.active, .sv-chart-btn:hover {
  @apply bg-orange border-orange text-white;
}

/* Performers grid */
.sv-performers-grid {
  @apply grid gap-2 p-2.5;
  grid-template-columns: 1fr 1fr;
}
.sv-performer-card { @apply bg-bg border border-cream rounded overflow-hidden; }
.sv-performer-label {
  @apply text-[11px] font-semibold text-dark1 px-2 py-1 bg-white border-b border-cream flex items-center gap-1;
}

/* Content section */
.sv-section-card { @apply bg-white border border-cream rounded-lg overflow-hidden; }
.sv-content-actionbar {
  @apply bg-bg border-b border-cream px-3 py-2 flex items-center justify-between gap-2 flex-wrap;
}
.sv-act-btn {
  @apply text-[11px] px-2.5 py-1 rounded font-medium cursor-pointer transition-all inline-flex items-center gap-1 whitespace-nowrap border border-transparent no-underline;
}
.sv-act-primary  { @apply bg-dark1 text-white border-dark1 hover:bg-dark2; }
.sv-act-success  { @apply bg-green-600 text-white border-green-600 hover:bg-green-700; }
.sv-act-info     { @apply bg-blue-500 text-white border-blue-500 hover:bg-blue-600; }
.sv-act-outline  { @apply bg-transparent text-dark2 border-cream hover:bg-bg hover:text-dark1; }
.sv-act-outline-g { @apply bg-transparent text-green-600 border-green-600 hover:bg-green-600 hover:text-white; }
.sv-act-outline-r { @apply bg-transparent text-red-500 border-red-500 hover:bg-red-500 hover:text-white; }
.sv-check-label { @apply text-xs font-medium text-dark2 m-0 flex items-center gap-1 cursor-pointer whitespace-nowrap; }
```

---

## 13. Implementation Checklist

### API Routes
- [ ] `GET /api/campaigns` — paginated list with type, month, dates, search filters
- [ ] `GET /api/campaigns/summary` — aggregated KPIs
- [ ] `GET /api/campaigns/bulk-refresh` — refresh current + last month
- [ ] `GET /api/campaigns/[id]` — single campaign details
- [ ] `DELETE /api/campaigns/[id]` — delete + cascade contents
- [ ] `GET /api/campaigns/[id]/statistic-card` — 9 KPI values + top performers + top products
- [ ] `GET /api/campaigns/[id]/statistic-chart` — daily timeseries
- [ ] `GET /api/campaigns/[id]/refresh` — re-aggregate campaign stats
- [ ] `GET /api/campaigns/[id]/refresh-list` — content list for refresh modal
- [ ] `GET /api/campaigns/[id]/refresh-followers-list` — unique usernames
- [ ] `GET /api/campaigns/[id]/export-content` — Excel download
- [ ] `GET /api/campaigns/[id]/contents` — full content list with filters
- [ ] `POST /api/campaigns/[id]/contents` — create content entry
- [ ] `PUT /api/campaign-contents/[id]` — update content
- [ ] `DELETE /api/campaign-contents/[id]` — delete content
- [ ] `GET /api/campaign-contents/[id]/refresh` — refresh content stats from social API
- [ ] `GET /api/campaign-contents/[id]/chart-detail` — per-content timeseries
- [ ] `GET /api/campaign-contents/[id]/fyp` — toggle FYP
- [ ] `GET /api/campaign-contents/[id]/deliver` — toggle delivery
- [ ] `GET /api/campaign-contents/[id]/payment` — toggle payment
- [ ] `POST /api/campaign-import/content/[campaignId]` — import standard Excel
- [ ] `POST /api/campaign-import/kol-content/[campaignId]` — import KOL Excel
- [ ] `GET /api/kol/refresh-followers/[username]` — refresh follower count
- [ ] `GET /api/campaigns/kol/export-content?start_date&end_date` — KOL export

### Components — Index Page
- [ ] `CampaignIndexPage` — full layout container + data fetching
- [ ] `CampaignTypeNav` — sub-type pill navigation
- [ ] `CampaignKpiStrip` — 4 async KPI tiles
- [ ] `CampaignTable` — TanStack server-side table with filters
- [ ] `CampaignAnalyticsPanel` — bar chart + doughnut + metrics + ROI bar
- [ ] `KolExportModal` — date range → download

### Components — Show Page
- [ ] `CampaignShowPage` — data fetching orchestrator
- [ ] `CampaignShowHeader` — dark header
- [ ] `StatisticFilters` — date range + PIC filter
- [ ] `CampaignKpiRows` — 4-tile row + 5-tile row
- [ ] `PerformanceChart` — trends/correlation switcher + linear regression
- [ ] `TopPerformersPanel` — 2×2 performer tables
- [ ] `TopProductsTable`
- [ ] `ContentActionBar` — filters + buttons
- [ ] `ContentTable` — client-side TanStack with combined cells + color coding
- [ ] `AddContentModal`
- [ ] `UpdateContentModal` — pre-populate on click
- [ ] `DetailAnalyticsModal` — iframe embed + 9 KPIs + 2 charts
- [ ] `RefreshStatsModal` — sequential refresh with progress bar
- [ ] `RefreshFollowersModal` — sequential refresh by username
- [ ] `ImportContentModal`
- [ ] `ImportKolContentModal`
- [ ] `ManualStatisticModal`

### Logic
- [ ] `getColorFromText(text)` — deterministic HSL color from string
- [ ] `calculateTrendLine(data)` — linear regression (slope, intercept, r, R², p-value)
- [ ] `shortNum(val)` — K/M/B formatter for chart axes
- [ ] Date range parsing from `"DD/MM/YYYY - DD/MM/YYYY"` format
- [ ] Permission gate checks on all action buttons
- [ ] Chart.js 4 integration (import registerables, register all)
- [ ] Correlation stats panel update function
- [ ] Sequential row iteration for refresh modals (not parallel)
- [ ] Excel export using xlsx library
- [ ] Excel import parsing with column mapping

---

## 14. Key Behavioral Notes

1. **Index table + KPI strip are linked.** Whenever the table filter changes, reload both
   the table data AND the summary KPI endpoint.

2. **Show page filters are shared.** The date range + PIC filter on the show page affect
   KPI cards, chart data, AND content table all at once.

3. **Content table is client-side rendered** (all rows loaded at once, no server pagination).
   Apply filters via API params (server-side filter, client-side display).

4. **Refresh modals run sequentially**, not in parallel. Each row waits for the previous
   API call to complete before moving to the next. This prevents rate-limiting.

5. **Type chip color drives the accent** on the index page — each campaign type has a
   different chip background color in the topbar.

6. **Correlation chart axes are user-configurable.** When user changes dropdown, update
   the scatter data, recalculate regression, update stats panel — all without re-fetching.

7. **Import button variant changes** based on campaign title. If title contains "kol" (case-
   insensitive), show the KOL Import button (red outline). Otherwise show standard (green).

8. **FYP / Payment / Delivery toggles** in the content table's `additional_info` column are
   small GET-based toggle endpoints that immediately update the record and visually toggle
   the button state without reloading the table.

9. **Top performers** show a link to `/kol/{id}/show` only if the content has a KOL id
   (i.e., the username is linked to a KolProfile record). Otherwise, display as plain text.

10. **Achievement KPI** = `gmv / total_expense` displayed as `"X.XX×"` (multiplier format).
