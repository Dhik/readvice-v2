# Readvice V2 — Affiliate Module Migration Prompt

## Context

Migrate the full **Affiliate** module from Laravel + AdminLTE to **Next.js 14 App Router + Supabase (PostgreSQL) + Prisma + Tailwind CSS**. No TypeScript. All `.js` / `.jsx`.

This module manages the full affiliate marketing pipeline:
> **Listing → Reach → Dealing (two-tier approval) → Talent creation**

And separately tracks performance data from:
- **Shopee Affiliate** (CSV + AMS Excel import)
- **TikTok Affiliate Creator** (Creator_List Excel + Video_List GMV Excel import)

---

## Module Map

| Sub-module | URL | Purpose |
|---|---|---|
| Affiliate Shopee | `/affiliate/shopee` | Shopee affiliate performance tracking |
| Affiliate TikTok | `/affiliate/tiktok` | TikTok creator affiliate tracking |
| Affiliate Analytics RC | `/affiliate/analytics/rc` | RC (registered creator) analytics |
| Affiliate Analytics Non-RC | `/affiliate/analytics/non-rc` | Non-RC (listing only) analytics |
| Listing Affiliate | `/affiliate/listing` | Pipeline management — all affiliates |
| Listing Approval | `/affiliate/listing/approval` | Approval queue |
| Reach Affiliate | `/affiliate/reach` | Outreach tracking per PIC |
| Dealing Affiliate | `/affiliate/dealing` | Two-tier approval: leader + management |
| Creator GMV | `/affiliate/creator-gmv` | Video-level GMV tracking per creator |
| Creator GMV 404 | `/affiliate/creator-gmv/not-found` | Broken / not-found video links |
| Zero GMV | `/affiliate/zero-gmv` | Creators with zero revenue content |

---

## 1. Database Structure (Prisma Schema)

```prisma
// ─── Affiliate Shopee ────────────────────────────────────────────────────────

model AffiliateShopee {
  id                  Int      @id @default(autoincrement())
  tenantId            Int      @map("tenant_id")
  date                DateTime @db.Date
  affiliateId         String?  @map("affiliate_id")
  username            String
  channel             String?
  orderType           String?  @map("order_type")
  produkTerjual       Int?     @default(0) @map("produk_terjual")
  pesanan             Int?     @default(0)
  clicks              Int?     @default(0)
  omzetPenjualan      Decimal? @db.Decimal(15,2) @map("omzet_penjualan")
  biayaIklan          Decimal? @db.Decimal(15,2) @map("biaya_iklan")
  komisiAffiliate     Decimal? @db.Decimal(15,2) @map("komisi_affiliate")
  roi                 Decimal? @db.Decimal(8,4)
  totalPembeli        Int?     @default(0) @map("total_pembeli")
  pembeliBaru         Int?     @default(0) @map("pembeli_baru")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, date])
  @@index([tenantId, username, date])
  @@map("affiliate_shopee")
}

// ─── Affiliate TikTok Creator ────────────────────────────────────────────────

model AffiliateTiktok {
  id                    Int      @id @default(autoincrement())
  tenantId              Int      @map("tenant_id")
  date                  DateTime @db.Date
  creatorUsername       String   @map("creator_username")
  affiliateGmv          Decimal? @db.Decimal(15,2) @map("affiliate_gmv")
  affiliateOrders       Decimal? @db.Decimal(15,2) @map("affiliate_orders")
  affiliateRefundedGmv  Decimal? @db.Decimal(15,2) @map("affiliate_refunded_gmv")
  affiliateRefundedOrders Decimal? @db.Decimal(15,2) @map("affiliate_refunded_orders")
  productImpression     BigInt?  @default(0) @map("product_impression")
  estCommission         Decimal? @db.Decimal(15,2) @map("est_commission")
  avgOrderValue         Decimal? @db.Decimal(15,2) @map("avg_order_value")
  productsSold          Int?     @default(0) @map("products_sold")
  estimatedOrders       Decimal? @db.Decimal(15,2) @map("estimated_orders")
  impressions           BigInt?  @default(0)
  videoClicks           Int?     @default(0) @map("video_clicks")
  videoComments         Int?     @default(0) @map("video_comments")
  videoLikes            Int?     @default(0) @map("video_likes")
  videoShares           Int?     @default(0) @map("video_shares")
  videoViews            BigInt?  @default(0) @map("video_views")
  affiliateFollowers    Int?     @default(0) @map("affiliate_followers")
  affiliateVideos       Int?     @default(0) @map("affiliate_videos")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, date])
  @@index([tenantId, creatorUsername, date])
  @@map("affiliate_tiktok")
}

// ─── Affiliate GMV TikTok (not-found / video-level) ─────────────────────────

model AffiliateGmvTiktok {
  id              Int      @id @default(autoincrement())
  tenantId        Int      @map("tenant_id")
  username        String?
  link            String?
  postingDate     DateTime? @db.Date @map("posting_date")
  gmv             Decimal?  @db.Decimal(15,2)
  linkNotFound    Boolean   @default(false) @map("link_not_found")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, linkNotFound])
  @@map("affiliate_gmv_tiktok")
}

// ─── Listing Affiliate ───────────────────────────────────────────────────────

model ListingAffiliate {
  id                  Int      @id @default(autoincrement())
  tenantId            Int      @map("tenant_id")
  date                DateTime @db.Date
  pic                 String?
  username            String
  followers           Int?     @default(0)
  gmv                 Decimal? @db.Decimal(15,2)
  kontak              String?                     // whatsapp/IG handle
  sowCategory         String?  @map("sow_category")
  salesChannelId      Int?     @map("sales_channel_id")  // 1=shopee, 4=tiktok
  roas                Decimal? @db.Decimal(8,4)  @default(0)
  gpm                 Decimal? @db.Decimal(8,4)  @default(0)
  rateCard            Decimal? @db.Decimal(15,2) @default(0) @map("rate_card")
  slot                Int?     @default(0)
  remark              String?  @default("-")
  keterangan          String?  @default("-")
  approval            String?  @default("Pending")   // Pending | Approve | Reject
  listingStatus       String?  @default("Pending") @map("listing_status") // Pending | Aktif | Tidak Aktif
  talentCreatedStatus Boolean  @default(false) @map("talent_created_status")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  tenant           Tenant            @relation(fields: [tenantId], references: [id])
  reachAffiliates  ReachAffiliate[]
  dealingAffiliate DealingAffiliate?

  @@index([tenantId, approval, listingStatus])
  @@map("listing_affiliate")
}

// ─── Reach Affiliate ─────────────────────────────────────────────────────────

model ReachAffiliate {
  id                 Int      @id @default(autoincrement())
  tenantId           Int      @map("tenant_id")
  listingAffiliateId Int      @map("listing_affiliate_id")
  pic                String?
  reachDate          DateTime? @db.Date @map("reach_date")
  status             String?  // Pending | Success | Failed
  notes              String?  @db.Text
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  tenant           Tenant           @relation(fields: [tenantId], references: [id])
  listingAffiliate ListingAffiliate @relation(fields: [listingAffiliateId], references: [id], onDelete: Cascade)

  @@index([tenantId, listingAffiliateId])
  @@map("reach_affiliate")
}

// ─── Dealing Affiliate ────────────────────────────────────────────────────────

model DealingAffiliate {
  id                          Int      @id @default(autoincrement())
  tenantId                    Int      @map("tenant_id")
  listingAffiliateId          Int      @unique @map("listing_affiliate_id")
  pic                         String?
  dealingDate                 DateTime? @db.Date @map("dealing_date")
  rateCard                    Decimal?  @db.Decimal(15,2) @map("rate_card")
  slot                        Int?      @default(0)
  platform                    String?
  approvalFromLeaderStatus    String    @default("Pending") @map("approval_from_leader_status")  // Pending | Approve | Reject
  approvalFromLeaderBy        String?   @map("approval_from_leader_by")
  approvalFromLeaderDate      DateTime? @map("approval_from_leader_date")
  approvalFromManagementStatus String   @default("Pending") @map("approval_from_management_status")  // Pending | Approve | Reject
  approvalFromManagementBy    String?   @map("approval_from_management_by")
  approvalFromManagementDate  DateTime? @map("approval_from_management_date")
  notes                       String?   @db.Text
  staffNotes                  String?   @db.Text @map("staff_notes")
  createdAt                   DateTime  @default(now()) @map("created_at")
  updatedAt                   DateTime  @updatedAt @map("updated_at")

  tenant           Tenant           @relation(fields: [tenantId], references: [id])
  listingAffiliate ListingAffiliate @relation(fields: [listingAffiliateId], references: [id], onDelete: Cascade)

  @@index([tenantId, approvalFromLeaderStatus, approvalFromManagementStatus])
  @@map("dealing_affiliate")
}
```

**Add to existing Tenant model:**
```prisma
affiliateShopee    AffiliateShopee[]
affiliateTiktok    AffiliateTiktok[]
affiliateGmvTiktok AffiliateGmvTiktok[]
listingAffiliates  ListingAffiliate[]
reachAffiliates    ReachAffiliate[]
dealingAffiliates  DealingAffiliate[]
```

**Add to existing Talent model:**
```prisma
// A Talent may be sourced from a ListingAffiliate
listingAffiliateId Int? @map("listing_affiliate_id")
dealingDate        DateTime? @db.Date @map("dealing_date")
dealingNumber      String?   @map("dealing_number")
```

---

## 2. Relations

```
Tenant ──< AffiliateShopee         (tenantId)
Tenant ──< AffiliateTiktok         (tenantId)
Tenant ──< AffiliateGmvTiktok      (tenantId)
Tenant ──< ListingAffiliate        (tenantId)
Tenant ──< ReachAffiliate          (tenantId)
Tenant ──< DealingAffiliate        (tenantId)

ListingAffiliate ──< ReachAffiliate   (one listing → many reach attempts)
ListingAffiliate ──1 DealingAffiliate (one listing → at most one deal)
ListingAffiliate ──0..1 Talent        (can generate a Talent record)

DealingAffiliate approval flow:
  approvalFromLeaderStatus: Pending → Approve | Reject
  approvalFromManagementStatus: Pending → Approve | Reject
  overallStatus (computed) = Approve only when BOTH = 'Approve'

AffiliateTiktok ─── CampaignContent  (GMV import: matches link_changed LIKE '%videoCode%')
AffiliateTiktok ─── Statistic         (GMV import: upserts Statistic.gmv per content)
AffiliateGmvTiktok (link_not_found=true) = orphaned GMV rows with no matching CampaignContent
```

---

## 3. Computed Fields & Business Logic

### 3.1 AffiliateShopee — Computed per grouped row

```js
// Per date-group (aggregated across all affiliates for that date)
const ctr = pesanan / clicks * 100               // Click-Through Rate %
const commissionRate = komisiAffiliate / omzetPenjualan * 100  // Commission %
const newBuyerRate = pembeliBaru / totalPembeli * 100           // New Buyer %
const avgCommissionPerAffiliate = komisiAffiliate / affiliateCount

// Per individual affiliate row (detail modal)
const ctr = pesanan / clicks * 100
const commissionRate = komisiAffiliate / omzetPenjualan * 100

// Performance badge
function getPerformanceBadge(roi) {
  if (roi >= 15) return { label: 'Excellent', class: 'badge-success' }
  if (roi >= 10) return { label: 'Good',      class: 'badge-info'    }
  if (roi >= 5)  return { label: 'Average',   class: 'badge-warning' }
  return               { label: 'Poor',       class: 'badge-danger'  }
}
```

### 3.2 AffiliateTiktok — Computed per grouped row

```js
// Per date-group
const orderCount = affiliateOrders / avgOrderValue  // derived order count
const conversionRate = orderCount / impressions * 100
const commissionRate = estCommission / affiliateGmv * 100
const refundRate = affiliateRefundedGmv / affiliateGmv * 100

// Performance badge
function getPerformanceBadge(convRate) {
  if (convRate >= 2)   return { label: 'Excellent', class: 'badge-success' }
  if (convRate >= 1)   return { label: 'Good',      class: 'badge-info'    }
  if (convRate >= 0.5) return { label: 'Average',   class: 'badge-warning' }
  return                      { label: 'Poor',       class: 'badge-danger'  }
}
```

### 3.3 TikTok GMV Import — Video Code Matching

```js
// Extract video code from TikTok URL
// URL examples:
//   https://www.tiktok.com/@user/video/7123456789012345678
//   https://vt.tiktok.com/ZSxxxxxx/
function extractVideoCode(url) {
  const match = url.match(/video\/(\d+)/)
  if (match) return match[1]
  // short URL: extract path segment
  const shortMatch = url.match(/tiktok\.com\/([A-Za-z0-9]+)\/?$/)
  return shortMatch ? shortMatch[1] : null
}

// Then find CampaignContent where link_changed LIKE '%videoCode%'
// If found: upsert Statistic { campaign_content_id, gmv }
// If not found: create AffiliateGmvTiktok { link_not_found: true, ... }
```

### 3.4 AMS Excel Import (Shopee) — Date from Filename

```js
// Filename pattern: YYYY.MM.DD.xlsx or YYYY.MM.DD - anything.xlsx
function extractDateFromFilename(filename) {
  const match = filename.match(/(\d{4})\.(\d{2})\.(\d{2})/)
  if (!match) throw new Error('Invalid filename format. Expected YYYY.MM.DD.xlsx')
  return new Date(`${match[1]}-${match[2]}-${match[3]}`)
}
// Only parse sheet named "By Channel" (skip other sheets)
// Duplicate key: tenantId + username + date + omzet_penjualan + channel
// On duplicate: update order_type only (other fields unchanged)
```

### 3.5 TikTok Creator_List Import — Date from Filename

```js
// Filename pattern: YYYYMMDD-YYYYMMDD anything.xlsx
// Use the first date (start of period)
function extractDateFromCreatorList(filename) {
  const match = filename.match(/(\d{8})-(\d{8})/)
  if (!match) throw new Error('Invalid filename. Expected YYYYMMDD-YYYYMMDD pattern')
  const d = match[1] // e.g. "20250101"
  return new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`)
}
// Column mapping (0-indexed):
// A=creator_username, B=affiliate_gmv, C=affiliate_orders, D=affiliate_refunded_gmv,
// E=affiliate_refunded_orders, F=product_impression, G=est_commission, H=avg_order_value,
// I=products_sold, J=estimated_orders, K=impressions, L=video_clicks, M=video_comments,
// N=video_likes, O=video_shares, P=video_views, Q=affiliate_followers, R=affiliate_videos
// Upsert on: tenantId + creatorUsername + date
```

### 3.6 Listing Affiliate — create_talent_from_affiliate Logic

```js
// When listing is approved and user clicks "Create Talent":
async function createTalentFromAffiliate(listingAffiliateId, session) {
  const listing = await prisma.listingAffiliate.findUnique({
    where: { id: listingAffiliateId },
    include: { dealingAffiliate: true }
  })

  // Tax calculation
  const platformName = listing.username  // check username prefix for PT/CV
  const taxPercentage = isPtOrCv(listing.username) ? 2.0 : 2.5

  // Generate document number: MMYY/INV/{tenantPrefix}/{sequence:05d}
  const noDocument = await generateDocumentNumber(session.user.tenantId)

  // Generate dealing number: MMYY/DEAL/{tenantPrefix}/{sequence:05d}
  const dealingNumber = await generateDealingNumber(session.user.tenantId)

  // Create talent
  await prisma.talent.create({
    data: {
      tenantId:          session.user.tenantId,
      username:          listing.username,
      salesChannelId:    listing.salesChannelId,
      followers:         listing.followers,
      gmv:               listing.gmv,
      pic:               listing.pic,
      sowCategory:       listing.sowCategory,
      roas:              listing.roas,
      rateCard:          listing.rateCard,
      slot:              listing.slot,
      noDocument:        noDocument,
      dealingNumber:     dealingNumber,
      dealingDate:       listing.dealingAffiliate?.dealingDate ?? new Date(),
      listingAffiliateId: listing.id,
      taxPercentage,
      type:              'affiliate',   // distinguish from KOL/clipper
    }
  })

  // Mark listing as talent_created
  await prisma.listingAffiliate.update({
    where: { id: listingAffiliateId },
    data: { talentCreatedStatus: true }
  })
}

function isPtOrCv(name) {
  const upper = (name ?? '').toUpperCase()
  return upper.startsWith('PT') || upper.startsWith('CV')
}
```

### 3.7 Dealing Affiliate — Two-Tier Approval

```js
// Overall status (computed — do NOT store)
function getOverallStatus(dealing) {
  if (dealing.approvalFromLeaderStatus === 'Approve' &&
      dealing.approvalFromManagementStatus === 'Approve') return 'Approve'
  if (dealing.approvalFromLeaderStatus === 'Reject' ||
      dealing.approvalFromManagementStatus === 'Reject') return 'Reject'
  return 'Pending'
}

// Staff Actions table: only show rows where BOTH are 'Approve'
// Leader can only update approvalFromLeaderStatus
// Management can only update approvalFromManagementStatus
// Mass update: wrapped in DB transaction
```

### 3.8 Analytics RC — Performance Scoring

```js
// RC = Registered Creator (talent.type = 'affiliate')
// JOIN: talent.username = affiliate_shopee.username
// Status logic
function getAffiliateStatus(affiliateShopeeMinDate, talentDealingDate) {
  if (!talentDealingDate) return 'Unknown'
  const affiliateFirst = new Date(affiliateShopeeMinDate)
  const dealing = new Date(talentDealingDate)
  const diffDays = (affiliateFirst - dealing) / (1000 * 60 * 60 * 24)
  if (diffDays > 7) return 'New Affiliate'  // affiliate data started AFTER dealing
  return 'Existed'
}

// Timeline status
function getTimelineStatus(affiliateDate, dealingDate) {
  if (!dealingDate) return 'Unknown'
  const diff = new Date(affiliateDate) - new Date(dealingDate)
  const days = diff / (1000 * 60 * 60 * 24)
  if (days < -7)  return 'Before Dealing'
  if (days <= 7)  return 'Same Period'
  return 'After Dealing'
}

// Performance score (0–100)
function calcRcScore(roi, activeDays, revenue, maxRevenue) {
  const roiScore    = Math.min(roi / 15 * 40, 40)       // max 40 pts
  const dayScore    = Math.min(activeDays / 30 * 30, 30) // max 30 pts
  const revScore    = Math.min(revenue / maxRevenue * 30, 30) // max 30 pts
  return Math.round(roiScore + dayScore + revScore)
}
```

### 3.9 Analytics Non-RC — Activity Levels

```js
// Non-RC = listing_affiliate records NOT yet converted to talent
// JOIN: listing_affiliate.username = affiliate_shopee.username
function getActivityLevel(activeDays) {
  if (activeDays >= 20) return { label: 'Very Active', class: 'badge-success' }
  if (activeDays >= 10) return { label: 'Active',      class: 'badge-info'    }
  if (activeDays >= 5)  return { label: 'Moderate',    class: 'badge-warning' }
  return                       { label: 'Low',          class: 'badge-danger'  }
}

// Performance score (0–100)
function calcNonRcScore(activeDays, revenue, followers, maxRevenue, maxFollowers) {
  const dayScore      = Math.min(activeDays / 30 * 40, 40)           // max 40 pts
  const revScore      = Math.min(revenue / maxRevenue * 40, 40)       // max 40 pts
  const followerScore = Math.min(followers / maxFollowers * 20, 20)   // max 20 pts
  return Math.round(dayScore + revScore + followerScore)
}
```

---

## 4. API Routes

### 4.1 Affiliate Shopee

| Method | Route | Description |
|---|---|---|
| GET | `/api/affiliate/shopee` | Grouped by-date table (paginated) |
| GET | `/api/affiliate/shopee/details-by-date` | Individual records for a specific date |
| GET | `/api/affiliate/shopee/line-data` | Line chart data (date, commission, omzet, affiliates, avg_roi) |
| GET | `/api/affiliate/shopee/gmv-by-channel` | Pie chart: SUM omzet GROUP BY channel |
| GET | `/api/affiliate/shopee/new-buyer-by-channel` | Info-boxes: new buyer % per channel |
| GET | `/api/affiliate/shopee/key-metrics` | total_orders + total_products_sold |
| GET | `/api/affiliate/shopee/export` | Download Excel |
| POST | `/api/affiliate/shopee/import` | CSV import (with `?date=YYYY-MM-DD` param) |
| POST | `/api/affiliate/shopee/import-excel` | AMS Excel import (date from filename) |
| DELETE | `/api/affiliate/shopee` | Bulk delete by date range |

**GET /api/affiliate/shopee** query params:
- `dateFrom`, `dateTo` — date range filter
- `page`, `limit` — pagination

**Response per row:**
```json
{
  "date": "2025-01-15",
  "affiliate_count": 45,
  "produk_terjual": 320,
  "pesanan": 280,
  "clicks": 14000,
  "omzet_penjualan": 42000000,
  "biaya_iklan": 1500000,
  "komisi_affiliate": 2100000,
  "roi": 14.0,
  "total_pembeli": 280,
  "pembeli_baru": 112,
  "ctr": 2.0,
  "commission_rate": 5.0,
  "new_buyer_rate": 40.0
}
```

**POST /api/affiliate/shopee/import** (multipart/form-data):
```js
// CSV columns (explicit date from query param):
// A=affiliate_id, B=username, C=channel, D=order_type, E=produk_terjual,
// F=pesanan, G=clicks, H=omzet_penjualan, I=biaya_iklan, J=komisi_affiliate,
// K=pembeli_baru (roi + total_pembeli derived or passed)
// Upsert on: tenantId + username + date + channel
```

**POST /api/affiliate/shopee/import-excel** (multipart/form-data):
```js
// AMS Excel format:
// - Filename MUST match /(\d{4})\.(\d{2})\.(\d{2})/
// - Only process sheet named "By Channel"
// - Column mapping (row starts at index with header skip):
//   D=nama, E=username, F=channel, G=order_type, H=produk_terjual,
//   I=pesanan, K=omzet_penjualan, M=komisi_affiliate, N=roi,
//   O=total_pembeli, P=pembeli_baru
// - Upsert on: tenantId + username + date + omzet_penjualan + channel
// - On duplicate: update order_type only
```

---

### 4.2 Affiliate TikTok

| Method | Route | Description |
|---|---|---|
| GET | `/api/affiliate/tiktok` | Grouped by-date table (paginated) |
| GET | `/api/affiliate/tiktok/details-by-date` | Individual creator records for a date |
| GET | `/api/affiliate/tiktok/line-data` | Line chart: 5 metrics per date |
| GET | `/api/affiliate/tiktok/funnel-data` | Funnel: impressions → est_orders → products_sold |
| GET | `/api/affiliate/tiktok/export` | Push to Google Sheets (returns sheet URL) |
| POST | `/api/affiliate/tiktok/import` | Creator_List Excel import |
| POST | `/api/affiliate/tiktok/import-gmv` | Video_List GMV Excel import |
| DELETE | `/api/affiliate/tiktok` | Bulk delete by date range |

**GET /api/affiliate/tiktok** response per row:
```json
{
  "date": "2025-01-15",
  "creator_count": 120,
  "affiliate_gmv": 85000000,
  "affiliate_orders": 4200,
  "affiliate_refunded_gmv": 1200000,
  "affiliate_refunded_orders": 60,
  "product_impression": 2500000,
  "est_commission": 4250000,
  "avg_order_value": 20238,
  "products_sold": 4800,
  "estimated_orders": 4150,
  "impressions": 3100000,
  "video_views": 9800000,
  "affiliate_followers": 8400000,
  "affiliate_videos": 580,
  "conversion_rate": 0.134,
  "commission_rate": 5.0,
  "refund_rate": 1.41
}
```

**GET /api/affiliate/tiktok/funnel-data**:
```json
{
  "product_impressions": 2500000,
  "estimated_orders": 4150,
  "products_sold": 4800
}
```

**GET /api/affiliate/tiktok/export** — Calls Google Sheets API to write current filtered data to a configured spreadsheet. Returns `{ sheetUrl: "https://docs.google.com/..." }`.

**POST /api/affiliate/tiktok/import-gmv** (multipart/form-data):
```js
// Video_List Excel format:
// - B=video_link, C=posting_date, D=username, E=gmv
// - Extract video code from video_link
// - Find CampaignContent where link_changed LIKE '%{videoCode}%'
// - If found: upsert Statistic { campaignContentId, gmv, updatedAt }
// - If NOT found: create AffiliateGmvTiktok { link_not_found: true, link, username, postingDate, gmv }
// Returns: { matched: N, notFound: M, errors: [] }
```

---

### 4.3 Affiliate Analytics

| Method | Route | Description |
|---|---|---|
| GET | `/api/affiliate/analytics/rc` | RC analytics (talents + affiliate_shopee) |
| GET | `/api/affiliate/analytics/non-rc` | Non-RC (listing + affiliate_shopee) |
| GET | `/api/affiliate/analytics/rc/trends` | RC performance trend over time |
| GET | `/api/affiliate/analytics/non-rc/trends` | Non-RC performance trend |

**GET /api/affiliate/analytics/rc** — joins Talent (type='affiliate') with AffiliateShopee by username:
```json
{
  "data": [
    {
      "username": "creator123",
      "talent_id": 45,
      "dealing_date": "2024-11-15",
      "followers": 120000,
      "total_gmv": 42000000,
      "total_orders": 210,
      "avg_roi": 12.4,
      "active_days": 28,
      "affiliate_status": "Existed",
      "timeline_status": "After Dealing",
      "performance_score": 78
    }
  ],
  "total": 45
}
```

---

### 4.4 Listing Affiliate

| Method | Route | Description |
|---|---|---|
| GET | `/api/affiliate/listing` | DataTable with filters |
| POST | `/api/affiliate/listing` | Create listing (approval auto = 'Pending') |
| GET | `/api/affiliate/listing/:id` | Show single listing |
| PUT | `/api/affiliate/listing/:id` | Update listing |
| DELETE | `/api/affiliate/listing/:id` | Delete listing |
| GET | `/api/affiliate/listing/check` | Check affiliate activity in affiliate_shopee |
| POST | `/api/affiliate/listing/import` | Excel import |
| GET | `/api/affiliate/listing/approval` | Approval queue DataTable |
| PUT | `/api/affiliate/listing/:id/approval` | Update approval status |
| POST | `/api/affiliate/listing/:id/create-talent` | Create Talent from approved listing |

**GET /api/affiliate/listing** query params:
- `pic`, `username`, `approval`, `salesChannelId`, `listingStatus`
- `dateFrom`, `dateTo`, `page`, `limit`

**GET /api/affiliate/listing/check** — returns performance summary from affiliate_shopee:
```json
{
  "username": "creator123",
  "found": true,
  "avg_roi": 12.4,
  "total_orders": 210,
  "total_gmv": 42000000,
  "active_days": 28,
  "first_date": "2024-09-01",
  "last_date": "2025-01-15"
}
```

---

### 4.5 Reach Affiliate

| Method | Route | Description |
|---|---|---|
| GET | `/api/affiliate/reach` | Paginated reach list with listing relation |
| POST | `/api/affiliate/reach` | Create reach attempt |
| PUT | `/api/affiliate/reach/:id` | Update reach status/notes |
| DELETE | `/api/affiliate/reach/:id` | Delete reach record |
| POST | `/api/affiliate/reach/:id/create-dealing` | Promote reach to dealing |
| GET | `/api/affiliate/reach/chart` | Reach count per PIC chart data |

**POST /api/affiliate/reach/:id/create-dealing**:
```js
// Creates DealingAffiliate for the listing, pre-fills pic from reach
// Sets approvalFromLeaderStatus and approvalFromManagementStatus = 'Pending'
```

---

### 4.6 Dealing Affiliate

| Method | Route | Description |
|---|---|---|
| GET | `/api/affiliate/dealing` | DataTable with filters |
| POST | `/api/affiliate/dealing` | Create dealing (from reach) |
| GET | `/api/affiliate/dealing/:id` | Show dealing details |
| PUT | `/api/affiliate/dealing/:id` | Update dealing |
| DELETE | `/api/affiliate/dealing/:id` | Delete dealing |
| PUT | `/api/affiliate/dealing/:id/leader-approval` | Leader approves/rejects |
| PUT | `/api/affiliate/dealing/:id/management-approval` | Management approves/rejects |
| PUT | `/api/affiliate/dealing/bulk-leader-approve` | Mass leader approve |
| PUT | `/api/affiliate/dealing/bulk-management-approve` | Mass management approve |
| GET | `/api/affiliate/dealing/staff-actions` | Staff action table (both = Approve) |

---

### 4.7 Creator GMV

| Method | Route | Description |
|---|---|---|
| GET | `/api/affiliate/creator-gmv` | Paginated creator GMV table |
| GET | `/api/affiliate/creator-gmv/not-found` | AffiliateGmvTiktok where link_not_found=true |
| GET | `/api/affiliate/creator-gmv/zero` | CampaignContent with statistic.gmv = 0 |

---

## 5. Page Implementations

### 5.1 Affiliate Shopee Page (`/affiliate/shopee`)

**Layout:** `sv-page` with compact header

```
┌─ HEADER ────────────────────────────────────────────────────────────────┐
│ Title: "Affiliate Shopee"  │  [Import CSV] [Import AMS Excel] [Export]  │
│ [Delete Range]             │  Date Range: [from] → [to]                 │
└─────────────────────────────────────────────────────────────────────────┘

┌─ KPI STRIP (6 tiles, auto-refresh on date change) ─────────────────────┐
│ Total Affiliates │ Total Orders │ Total GMV │ Total Commission │ Avg ROI│ New Buyers% │
└─────────────────────────────────────────────────────────────────────────┘

┌─ sv-main ──────────────────────────────────────────────────────────────┐
│ ┌─ TABLE PANEL (62%) ────────────────────┐  ┌─ CHART PANEL (38%) ────┐ │
│ │ Date | Affiliates | Products Sold      │  │ [Trend] [Bar] [Donut]  │ │
│ │ Orders | GMV | Commission | ROI        │  │                        │ │
│ │ CTR | New Buyer% | Badge               │  │  Line Chart:           │ │
│ │                                        │  │  - GMV (primary)       │ │
│ │ Click date row → detail modal          │  │  - Commission (overlay)│ │
│ │                                        │  │                        │ │
│ └────────────────────────────────────────┘  │ + Pie: GMV by Channel  │ │
│                                             │ + Info: New Buyer/Chan │ │
│                                             └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**KPI Tiles:**
- Total Unique Affiliates (COUNT DISTINCT username)
- Total Orders (SUM pesanan)
- Total GMV (SUM omzet_penjualan)
- Total Commission (SUM komisi_affiliate)
- Average ROI (AVG roi)
- New Buyer Rate % (SUM pembeli_baru / SUM total_pembeli * 100)

**Chart Panel tabs:**
1. **Trend (Line):** date on X, dual-axis — GMV (left) + Commission (right)
2. **Bar:** date on X, grouped bars for GMV + Commission
3. **Donut (Pie):** GMV by Channel — Shopee, TikTok, etc.

**Below the chart panel — New Buyer Info-boxes:**
```
┌────────────────────────────────┐
│ Channel: Shopee Live           │
│ New Buyer %: 45.2%             │
│ [Progress bar]                 │
└────────────────────────────────┘
... (one box per channel, sorted by % desc)
```

---

### 5.2 Detail Modal (Shopee)

Triggered by clicking a date row.

**Modal title:** "Detail Affiliates — {date}"

**Content:**
- Sub-filter: search by username
- DataTable columns: Username | Channel | Order Type | Products Sold | Orders | GMV | Commission | ROI | Badge | CTR | New Buyers

---

### 5.3 Affiliate TikTok Page (`/affiliate/tiktok`)

**Layout:** identical sv-page pattern

```
┌─ HEADER ────────────────────────────────────────────────────────────────┐
│ Title: "Affiliate TikTok"  │  [Import Creator List] [Import GMV]        │
│                             │  [Export to Google Sheets]                 │
│                             │  Date Range: [from] → [to]                 │
└─────────────────────────────────────────────────────────────────────────┘

┌─ KPI STRIP (5 tiles) ──────────────────────────────────────────────────┐
│ Total Creators │ Total GMV │ Products Sold │ Est Commission │ Avg Conv% │
└─────────────────────────────────────────────────────────────────────────┘

┌─ sv-main ──────────────────────────────────────────────────────────────┐
│ ┌─ TABLE (62%) ───────────────────────────┐  ┌─ CHART PANEL (38%) ───┐ │
│ │ Date | Creators | GMV | Orders          │  │ [Trend] [Bar] [Donut] │ │
│ │ Commission | Conv% | Refund% | Badge    │  │                       │ │
│ │ Video Views | Followers                  │  │  + Funnel chart below │ │
│ │                                         │  │                       │ │
│ │ Click date → creator detail modal       │  │ ┌─ FUNNEL ──────────┐ │ │
│ └─────────────────────────────────────────┘  │ │ Product Impressions│ │ │
│                                              │ │       ↓            │ │ │
│                                              │ │ Estimated Orders   │ │ │
│                                              │ │       ↓            │ │ │
│                                              │ │ Products Sold      │ │ │
│                                              │ └────────────────────┘ │ │
│                                              └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Funnel Chart (HTML custom):**
```jsx
// 3-level CSS trapezoid funnel
// Level 1: Product Impressions (widest) — #2C3639
// Level 2: Estimated Orders (medium)    — #E07B39
// Level 3: Products Sold (narrowest)    — #DCD7C9

function FunnelChart({ impressions, estimatedOrders, productsSold }) {
  const levels = [
    { label: 'Product Impressions', value: impressions,     width: 100, color: '#2C3639' },
    { label: 'Estimated Orders',    value: estimatedOrders, width: 70,  color: '#E07B39' },
    { label: 'Products Sold',       value: productsSold,    width: 45,  color: '#DCD7C9' },
  ]
  return (
    <div className="funnel-container">
      {levels.map((l, i) => (
        <div key={i} className="funnel-level" style={{ width: `${l.width}%`, background: l.color }}>
          <span>{l.label}</span>
          <span>{formatNumber(l.value)}</span>
        </div>
      ))}
    </div>
  )
}
```

---

### 5.4 Creator Detail Modal (TikTok)

**Modal title:** "Creators — {date}"

**DataTable columns:** Username | GMV | Orders | Commission | Conv% | Refund% | Video Views | Followers | Badge

---

### 5.5 Analytics RC Page (`/affiliate/analytics/rc`)

```
┌─ FILTER BAR ───────────────────────────────────────────────────────────┐
│ Date Range: [from] → [to]  │  [Apply]  [Reset]                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─ CHART ROW ─────────────────────────────────────────────────────────────┐
│ ┌─ Plotly Donut: Status ──┐  ┌─ ApexCharts Bar: Top GMV ─┐             │
│ │ Existed / New Affiliate │  │ Top 10 creators by GMV    │             │
│ └─────────────────────────┘  └───────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────┘

┌─ TABLE ─────────────────────────────────────────────────────────────────┐
│ Username | Status | Timeline | Dealing Date | Active Days | GMV         │
│ Total Orders | Avg ROI | Followers | Performance Score                   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data fetch:** Query Talent (type='affiliate') + JOIN AffiliateShopee on username. Compute status, timeline, score per row.

---

### 5.6 Analytics Non-RC Page (`/affiliate/analytics/non-rc`)

Same layout as RC but:
- Source: ListingAffiliate + AffiliateShopee JOIN
- Columns: Username | Activity Level | Active Days | GMV | Orders | Avg ROI | Followers | Performance Score
- Activity level badge replaces timeline status

---

### 5.7 Listing Affiliate Page (`/affiliate/listing`)

```
┌─ HEADER ────────────────────────────────────────────────────────────────┐
│ Title: "Listing Affiliate"  │  [+ Add Listing] [Import Excel]           │
└─────────────────────────────────────────────────────────────────────────┘

┌─ FILTER BAR ───────────────────────────────────────────────────────────┐
│ PIC: [dropdown] │ Platform: [All/Shopee/TikTok] │ Approval: [dropdown] │
│ Status: [All/Pending/Aktif/Tidak Aktif]          │ Search username...   │
└─────────────────────────────────────────────────────────────────────────┘

┌─ TABLE ─────────────────────────────────────────────────────────────────┐
│ # │ Date │ PIC │ Username │ Platform │ Followers │ GMV │ ROAS │ Rate    │
│   │ Slot │ SOW │ Approval │ Status │ Talent Created │ Actions           │
│                                                                          │
│ Actions: [View] [Edit] [Delete] [Create Talent (if approved)]           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Check Affiliate Button (in create/edit modal):**
- On username blur → calls `/api/affiliate/listing/check?username=X`
- Shows performance summary inline: avg_roi, total_orders, total_gmv, active_days

---

### 5.8 Listing Approval Sub-Page (`/affiliate/listing/approval`)

```
┌─ FILTER BAR ───────────────────────────────────────────────────────────┐
│ Approval Status: [All / Pending / Approve / Reject]  Date: [range]     │
└─────────────────────────────────────────────────────────────────────────┘

┌─ TABLE ─────────────────────────────────────────────────────────────────┐
│ # │ Date │ PIC │ Username │ Followers │ GMV │ ROAS │ Rate Card │ Slot   │
│   │ Remark │ Approval Status │ Actions                                  │
│                                                                          │
│ Actions: [View] [Approve] [Reject]                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 5.9 Reach Affiliate Page (`/affiliate/reach`)

```
┌─ HEADER ────────────────────────────────────────────────────────────────┐
│ Title: "Reach Affiliate"  │  [+ Add Reach]                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─ CHART: Reach Count per PIC ────────────────────────────────────────────┐
│ Bar chart: PIC on X, count on Y (ApexCharts or Chart.js bar)            │
└─────────────────────────────────────────────────────────────────────────┘

┌─ TABLE ─────────────────────────────────────────────────────────────────┐
│ # │ Username │ PIC │ Reach Date │ Status │ Notes │ Actions               │
│                                                                          │
│ Actions: [View] [Edit] [Delete] [Create Dealing (if status=Success)]    │
└─────────────────────────────────────────────────────────────────────────┘
```

**PIC List (hardcoded dropdown options):**
```js
const PIC_LIST = ['Anisa', 'Iis', 'Kiki', 'Zalsa', 'Rina', 'Others']
```

---

### 5.10 Dealing Affiliate Page (`/affiliate/dealing`)

```
┌─ TABS ─────────────────────────────────────────────────────────────────┐
│ [All Dealings] [Approval Queue] [Staff Actions]                         │
└─────────────────────────────────────────────────────────────────────────┘

─── ALL DEALINGS TAB ──────────────────────────────────────────────────────

┌─ TABLE ─────────────────────────────────────────────────────────────────┐
│ # │ Username │ PIC │ Dealing Date │ Rate Card │ Slot │ Platform         │
│   │ Leader Status │ Management Status │ Overall │ Actions               │
│                                                                          │
│ Actions: [View] [Edit] [Delete]                                          │
└─────────────────────────────────────────────────────────────────────────┘

─── APPROVAL QUEUE TAB ────────────────────────────────────────────────────

┌─ TABLE (sorted: Pending first) ─────────────────────────────────────────┐
│ # │ Username │ PIC │ Rate Card │ Slot │ Leader │ Management │ Overall   │
│                                                                          │
│ [Mass Approve Leader] [Mass Approve Management]                          │
│                                                                          │
│ Row actions: [Approve Leader] [Reject Leader]                            │
│              [Approve Management] [Reject Management]                    │
└─────────────────────────────────────────────────────────────────────────┘

─── STAFF ACTIONS TAB ─────────────────────────────────────────────────────

┌─ TABLE (only rows where BOTH = 'Approve') ─────────────────────────────┐
│ # │ Username │ PIC │ Dealing Date │ Rate Card │ Staff Notes │ Actions   │
│                                                                          │
│ Actions: [View] [Update Staff Notes]                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 5.11 Creator GMV Page (`/affiliate/creator-gmv`)

```
┌─ TABS ─────────────────────────────────────────────────────────────────┐
│ [All Videos] [Not Found (404)] [Zero GMV]                               │
└─────────────────────────────────────────────────────────────────────────┘

─── ALL VIDEOS TAB ────────────────────────────────────────────────────────

┌─ TABLE ─────────────────────────────────────────────────────────────────┐
│ # │ Username │ Platform │ Link │ Posting Date │ GMV │ Status │ Actions  │
│                                                                          │
│ Link cell: shows TikTok embed preview on hover / click video icon        │
│ Auto-refresh toggle: every 60s re-fetches GMV data                       │
└─────────────────────────────────────────────────────────────────────────┘

─── NOT FOUND (404) TAB ───────────────────────────────────────────────────

┌─ TABLE (affiliate_gmv_tiktok where link_not_found=true) ───────────────┐
│ # │ Username │ Link │ Posting Date │ GMV │ Actions                      │
└─────────────────────────────────────────────────────────────────────────┘

─── ZERO GMV TAB ──────────────────────────────────────────────────────────

┌─ TABLE (CampaignContent where statistic.gmv = 0 or null) ─────────────┐
│ # │ Username │ Platform │ Link │ Posting Date │ GMV = 0                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Modals

### 6.1 Import CSV Modal (Affiliate Shopee)

```
┌─ Import Affiliate Shopee (CSV) ──────────────────────────────────────┐
│                                                                        │
│  Import Date: [Date Picker - required]                                 │
│  File: [Choose File] (.csv only)                                       │
│                                                                        │
│  Result (after import):                                                │
│  ✓ 245 rows imported  │  ⚠ 3 skipped (duplicates)                     │
│                                                                        │
│                                    [Cancel] [Import]                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Import AMS Excel Modal (Affiliate Shopee)

```
┌─ Import AMS Excel ───────────────────────────────────────────────────┐
│                                                                        │
│  File: [Choose File] (.xlsx, .xls)                                     │
│  Note: Filename must be in format YYYY.MM.DD.xlsx                      │
│  Note: Only "By Channel" sheet will be processed                       │
│                                                                        │
│  Result: ✓ 180 created │ ↺ 12 updated (order_type only)               │
│                                                                        │
│                                    [Cancel] [Import]                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Detail Modal (Affiliate Shopee — by date)

```
┌─ Affiliate Details — 15 Jan 2025 ────────────────────────────────────┐
│                                                                        │
│  [Search username...]                                                  │
│                                                                        │
│  Table:                                                                │
│  Username | Channel | Order Type | Products | Orders | GMV            │
│  Commission | ROI | Badge | CTR | New Buyers                          │
│                                                                        │
│  Pagination                                          [Close]           │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Import Creator List Modal (TikTok)

```
┌─ Import Creator List ────────────────────────────────────────────────┐
│                                                                        │
│  File: [Choose File] (.xlsx only)                                      │
│  Note: Filename must match YYYYMMDD-YYYYMMDD pattern                   │
│                                                                        │
│  Result: ✓ 320 rows imported (23 columns per row)                     │
│                                                                        │
│                                    [Cancel] [Import]                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Import GMV Modal (TikTok)

```
┌─ Import GMV (Video List) ────────────────────────────────────────────┐
│                                                                        │
│  File: [Choose File] (.xlsx only, Video_List filename)                 │
│                                                                        │
│  Result: ✓ 145 matched & updated │ ✕ 28 not found (see 404 tab)      │
│                                                                        │
│                                    [Cancel] [Import]                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.6 Creator Detail Modal (TikTok — by date)

```
┌─ Creator Details — 15 Jan 2025 ──────────────────────────────────────┐
│                                                                        │
│  [Search username...]                                                  │
│                                                                        │
│  Table:                                                                │
│  Username | GMV | Orders | Commission | Conv% | Refund% | Views | Followers | Badge │
│                                                                        │
│  Pagination                                          [Close]           │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.7 Create / Edit Listing Affiliate Modal

```
┌─ Add / Edit Listing ─────────────────────────────────────────────────┐
│                                                                        │
│  Date: [Date Picker]          PIC: [dropdown — PIC_LIST]               │
│                                                                        │
│  Username: [text input]       [Check Affiliate →]                      │
│  ┌─ Affiliate Check Result ────────────────────────────────┐           │
│  │ Avg ROI: 12.4  │  Total Orders: 210  │  Total GMV: 42M  │          │
│  │ Active Days: 28 │  Period: Sep 2024 – Jan 2025          │          │
│  └────────────────────────────────────────────────────────┘           │
│                                                                        │
│  Platform: [Shopee / TikTok]  Followers: [number]                     │
│  GMV: [currency]              ROAS: [decimal]                         │
│  GPM: [decimal]               Rate Card: [currency]                   │
│  Slot: [number]               SOW Category: [text]                    │
│  Kontak: [text]                                                        │
│  Remark: [text]               Keterangan: [text]                      │
│                                                                        │
│                                    [Cancel] [Save]                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.8 View Listing Affiliate Modal

```
┌─ Listing Detail ─────────────────────────────────────────────────────┐
│  Username: creator123           Platform: Shopee                       │
│  Date: 15 Jan 2025             PIC: Anisa                             │
│  Followers: 120,000            GMV: Rp 42,000,000                     │
│  ROAS: 12.4x                   Rate Card: Rp 1,500,000                │
│  Slot: 3                       SOW: Product Review                    │
│  Kontak: @creator123           Remark: Potential                      │
│  Approval: [Approved badge]    Status: [Aktif badge]                  │
│  Talent Created: Yes ✓                                                 │
│                                                        [Close]         │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.9 Approval Modal (Listing)

```
┌─ Update Approval ────────────────────────────────────────────────────┐
│  Username: creator123                                                  │
│  Current Approval: Pending                                             │
│                                                                        │
│  New Status: ● Approve  ○ Reject  ○ Pending                           │
│  Notes: [textarea]                                                     │
│                                                                        │
│                                    [Cancel] [Update]                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.10 Create Talent from Affiliate Modal

```
┌─ Create Talent ──────────────────────────────────────────────────────┐
│  ⚠ This will create a Talent record from this affiliate listing.       │
│                                                                        │
│  Username: creator123                                                  │
│  Platform: Shopee                                                      │
│  Rate Card: Rp 1,500,000                                               │
│  Tax: 2.5% (PPh)                                                       │
│  Document No: (auto-generated)                                         │
│  Dealing No: (auto-generated)                                          │
│                                                                        │
│  Confirm? This action cannot be undone.                                │
│                                    [Cancel] [Create Talent]            │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.11 Import Listing Excel Modal

```
┌─ Import Listing Affiliate ───────────────────────────────────────────┐
│  File: [Choose File] (.xlsx only)                                      │
│  Columns: A=date, B=pic, C=username, D=followers, E=gmv,              │
│           F=kontak, G=sow_category, H=platform                         │
│  Note: Platform code — 1=Shopee, 4=TikTok                             │
│  Duplicate key: tenant + date + username + pic                         │
│                                                                        │
│  Result: ✓ 48 imported │ ↺ 5 already exist (skipped)                  │
│                                    [Cancel] [Import]                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.12 Create / Edit Reach Modal

```
┌─ Add Reach ──────────────────────────────────────────────────────────┐
│  Listing: [select or auto-filled from context]                         │
│  PIC: [dropdown — PIC_LIST]                                            │
│  Reach Date: [Date Picker]                                             │
│  Status: [Pending / Success / Failed]                                  │
│  Notes: [textarea]                                                     │
│                                    [Cancel] [Save]                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.13 Create Dealing from Reach Modal

```
┌─ Promote to Dealing ─────────────────────────────────────────────────┐
│  Listing: creator123 (Shopee)                                          │
│  PIC: Anisa (pre-filled)                                               │
│  Dealing Date: [Date Picker]                                           │
│  Rate Card: [currency input]                                           │
│  Slot: [number]                                                        │
│  Platform: [dropdown]                                                  │
│  Notes: [textarea]                                                     │
│                                    [Cancel] [Create Dealing]           │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.14 View Dealing Modal

```
┌─ Dealing Detail ─────────────────────────────────────────────────────┐
│  Username: creator123             PIC: Anisa                           │
│  Dealing Date: 15 Jan 2025        Platform: Shopee                     │
│  Rate Card: Rp 1,500,000          Slot: 3                              │
│                                                                        │
│  ┌─ Approval Status ──────────────────────────────────────────────┐   │
│  │  Leader: [Approved ✓] by Budi on 16 Jan 2025                  │   │
│  │  Management: [Pending ⏳] —                                    │   │
│  │  Overall: [Pending]                                            │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                        [Close]         │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.15 Leader Approval Modal

```
┌─ Leader Approval ────────────────────────────────────────────────────┐
│  Creator: creator123                                                   │
│  Rate Card: Rp 1,500,000 × 3 slots                                    │
│  Decision: ● Approve  ○ Reject                                         │
│  Notes: [textarea]                                                     │
│                                    [Cancel] [Submit]                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.16 Management Approval Modal

Identical structure to Leader Approval Modal but updates `approvalFromManagementStatus`.

### 6.17 Delete Confirmation Modal (shared pattern)

```
┌─ Confirm Delete ─────────────────────────────────────────────────────┐
│  ⚠ Are you sure you want to delete this record?                        │
│  Username: creator123                                                  │
│  This action cannot be undone.                                         │
│                                    [Cancel] [Delete]                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.18 Delete Range Modal (Shopee / TikTok)

```
┌─ Delete Range ───────────────────────────────────────────────────────┐
│  ⚠ This will delete ALL records in the selected date range.            │
│                                                                        │
│  From Date: [Date Picker]                                              │
│  To Date:   [Date Picker]                                              │
│                                                                        │
│  Warning: This cannot be undone.                                       │
│                                    [Cancel] [Delete]                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Full Flow

### 7.1 Affiliate Pipeline Flow

```
1. LISTING
   └─ User creates a ListingAffiliate entry (manually or via Excel import)
      └─ approval = 'Pending', listingStatus = 'Pending'

2. APPROVAL (Listing)
   └─ Manager views /affiliate/listing/approval
   └─ Updates approval = 'Approve' | 'Reject'
   └─ If Approve → listing can move to Reach

3. REACH
   └─ PIC creates ReachAffiliate for an approved listing
   └─ Tracks reach date, status (Pending/Success/Failed), notes
   └─ If status = 'Success' → can create Dealing

4. DEALING
   └─ ReachAffiliate creates DealingAffiliate (rate card, slot, platform)
   └─ Both leader AND management must approve
   └─ If leader approves → approvalFromLeaderStatus = 'Approve'
   └─ If management approves → approvalFromManagementStatus = 'Approve'
   └─ Overall = 'Approve' only when BOTH = 'Approve'

5. TALENT CREATION
   └─ When overall status = 'Approve' → "Create Talent" button appears
   └─ User confirms → Talent record created with:
      - Document number (MMYY/INV/PREFIX/00001)
      - Dealing number (MMYY/DEAL/PREFIX/00001)
      - Tax percentage (2% PT/CV, 2.5% others)
      - listingAffiliateId reference
   └─ listing.talentCreatedStatus = true (button disabled)
```

### 7.2 Data Import Flow (Shopee)

```
Option A — CSV (manual date):
  User selects date → uploads CSV →
  Parse rows → validate → upsert on (tenantId + username + date + channel)

Option B — AMS Excel (date from filename):
  User uploads YYYY.MM.DD.xlsx →
  Extract date from filename →
  Find "By Channel" sheet →
  Parse rows → upsert on (tenantId + username + date + omzet + channel) →
  On duplicate: update order_type only
```

### 7.3 Data Import Flow (TikTok)

```
Creator List Import:
  User uploads YYYYMMDD-YYYYMMDD.xlsx →
  Extract date from filename →
  Parse 23 columns per row →
  Upsert on (tenantId + creatorUsername + date)

GMV Import (Video List):
  User uploads Video_List.xlsx →
  For each row (B=video_link, C=posting_date, D=username, E=gmv):
    1. Extract video code from URL
    2. Find CampaignContent where link_changed LIKE '%{code}%'
    3. If found → upsert Statistic { campaignContentId, gmv }
    4. If NOT found → create AffiliateGmvTiktok { linkNotFound: true }
  Return summary: { matched, notFound, errors }
```

### 7.4 Analytics Flow

```
RC Analytics:
  1. Query Talent WHERE type = 'affiliate'
  2. For each talent: SUM affiliate_shopee WHERE username = talent.username AND tenantId = tenant
  3. Compute: affiliate_status, timeline_status, performance_score
  4. Render chart (Plotly donut by status) + table

Non-RC Analytics:
  1. Query ListingAffiliate WHERE talentCreatedStatus = false
  2. For each listing: SUM affiliate_shopee WHERE username = listing.username
  3. Compute: activity_level, performance_score
  4. Render table with activity level badges
```

### 7.5 Google Sheets Export Flow (TikTok)

```
User clicks "Export to Google Sheets" →
GET /api/affiliate/tiktok/export?dateFrom=&dateTo= →
Server queries AffiliateTiktok filtered by dates →
Maps rows to sheet columns →
Uses googleapis to write to configured SPREADSHEET_ID →
Returns { sheetUrl: "https://docs.google.com/..." } →
UI shows success toast with link to sheet
```

---

## 8. File & Component Structure

```
app/(dashboard)/affiliate/
├── shopee/
│   └── page.jsx                     # Affiliate Shopee main page
├── tiktok/
│   └── page.jsx                     # Affiliate TikTok main page
├── analytics/
│   ├── rc/page.jsx                  # RC Analytics
│   └── non-rc/page.jsx              # Non-RC Analytics
├── listing/
│   ├── page.jsx                     # Listing table
│   └── approval/page.jsx            # Approval sub-page
├── reach/
│   └── page.jsx                     # Reach tracking
├── dealing/
│   └── page.jsx                     # Dealing (with tabs)
└── creator-gmv/
    └── page.jsx                     # Creator GMV (tabbed: All / 404 / Zero)

app/api/affiliate/
├── shopee/
│   ├── route.js                     # GET (table), DELETE (range)
│   ├── import/route.js              # POST (CSV)
│   ├── import-excel/route.js        # POST (AMS Excel)
│   ├── export/route.js              # GET (Excel download)
│   ├── details-by-date/route.js     # GET (detail modal data)
│   ├── line-data/route.js           # GET (chart)
│   ├── gmv-by-channel/route.js      # GET (pie chart)
│   ├── new-buyer-by-channel/route.js # GET (info boxes)
│   └── key-metrics/route.js         # GET (total orders + products)
├── tiktok/
│   ├── route.js                     # GET, DELETE
│   ├── import/route.js              # POST (Creator List)
│   ├── import-gmv/route.js          # POST (Video List)
│   ├── export/route.js              # GET (Google Sheets push)
│   ├── details-by-date/route.js     # GET
│   ├── line-data/route.js           # GET
│   └── funnel-data/route.js         # GET
├── analytics/
│   ├── rc/route.js                  # GET
│   └── non-rc/route.js              # GET
├── listing/
│   ├── route.js                     # GET (table), POST (create)
│   ├── [id]/
│   │   ├── route.js                 # GET, PUT, DELETE
│   │   ├── approval/route.js        # PUT
│   │   └── create-talent/route.js   # POST
│   ├── check/route.js               # GET (check username)
│   └── import/route.js             # POST
├── reach/
│   ├── route.js                     # GET, POST
│   ├── [id]/
│   │   ├── route.js                 # PUT, DELETE
│   │   └── create-dealing/route.js  # POST
│   └── chart/route.js              # GET
└── dealing/
    ├── route.js                     # GET, POST
    ├── [id]/
    │   ├── route.js                 # GET, PUT, DELETE
    │   ├── leader-approval/route.js # PUT
    │   └── management-approval/route.js # PUT
    ├── bulk-leader-approve/route.js  # PUT
    ├── bulk-management-approve/route.js # PUT
    └── staff-actions/route.js       # GET

components/affiliate/
├── shopee/
│   ├── ShopeeTable.jsx
│   ├── ShopeeChartPanel.jsx         # Line + Pie + New Buyer info boxes
│   ├── ShopeeDetailModal.jsx
│   ├── ImportCsvModal.jsx
│   ├── ImportAmsModal.jsx
│   └── DeleteRangeModal.jsx
├── tiktok/
│   ├── TiktokTable.jsx
│   ├── TiktokChartPanel.jsx         # Line + Funnel
│   ├── TiktokDetailModal.jsx
│   ├── ImportCreatorModal.jsx
│   ├── ImportGmvModal.jsx
│   └── FunnelChart.jsx              # Custom CSS funnel (3-level)
├── analytics/
│   ├── RcAnalyticsTable.jsx
│   └── NonRcAnalyticsTable.jsx
├── listing/
│   ├── ListingTable.jsx
│   ├── ListingModal.jsx             # Create/Edit
│   ├── ListingViewModal.jsx
│   ├── ApprovalModal.jsx
│   ├── CreateTalentModal.jsx
│   └── ImportListingModal.jsx
├── reach/
│   ├── ReachTable.jsx
│   ├── ReachModal.jsx
│   └── CreateDealingModal.jsx
├── dealing/
│   ├── DealingTable.jsx
│   ├── DealingViewModal.jsx
│   ├── ApprovalModal.jsx            # Leader + Management (same component, different mode)
│   └── StaffNotesModal.jsx
└── creator-gmv/
    ├── CreatorGmvTable.jsx
    ├── NotFoundTable.jsx
    └── ZeroGmvTable.jsx
```

---

## 9. Environment Variables (additions for Affiliate)

```env
# Google Sheets export (TikTok affiliate)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
TIKTOK_AFFILIATE_SHEET_ID="1abc..."

# Tenant prefixes for document number generation
TENANT_1_PREFIX="CLR"
TENANT_2_PREFIX="AZR"
TENANT_3_PREFIX="DLM"
```

---

## 10. Utility Functions (Affiliate-specific)

```js
// lib/affiliate-utils.js

/**
 * Extract date from AMS Excel filename: YYYY.MM.DD.xlsx
 */
export function extractDateFromAmsFilename(filename) {
  const match = filename.match(/(\d{4})\.(\d{2})\.(\d{2})/)
  if (!match) throw new Error(`Invalid AMS filename: ${filename}. Expected YYYY.MM.DD.xlsx`)
  return new Date(`${match[1]}-${match[2]}-${match[3]}`)
}

/**
 * Extract date from TikTok Creator_List filename: YYYYMMDD-YYYYMMDD
 */
export function extractDateFromCreatorListFilename(filename) {
  const match = filename.match(/(\d{8})-(\d{8})/)
  if (!match) throw new Error(`Invalid Creator List filename. Expected YYYYMMDD-YYYYMMDD pattern`)
  const d = match[1]
  return new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`)
}

/**
 * Extract TikTok video code from URL
 */
export function extractVideoCode(url) {
  if (!url) return null
  // Long URL: /video/7123456789012345678
  const longMatch = url.match(/video\/(\d+)/)
  if (longMatch) return longMatch[1]
  // Short URL: vt.tiktok.com/ZSxxxxxx or tiktok.com/ZSxxxxxx
  const shortMatch = url.match(/tiktok\.com\/([A-Za-z0-9]+)\/?$/)
  return shortMatch ? shortMatch[1] : null
}

/**
 * Compute Shopee affiliate performance badge
 */
export function getShopeePerformanceBadge(roi) {
  const r = parseFloat(roi ?? 0)
  if (r >= 15) return { label: 'Excellent', cls: 'badge-success' }
  if (r >= 10) return { label: 'Good',      cls: 'badge-info'    }
  if (r >= 5)  return { label: 'Average',   cls: 'badge-warning' }
  return              { label: 'Poor',      cls: 'badge-danger'  }
}

/**
 * Compute TikTok affiliate performance badge
 */
export function getTiktokPerformanceBadge(conversionRate) {
  const cr = parseFloat(conversionRate ?? 0)
  if (cr >= 2)   return { label: 'Excellent', cls: 'badge-success' }
  if (cr >= 1)   return { label: 'Good',      cls: 'badge-info'    }
  if (cr >= 0.5) return { label: 'Average',   cls: 'badge-warning' }
  return                { label: 'Poor',      cls: 'badge-danger'  }
}

/**
 * Compute Non-RC activity level badge
 */
export function getActivityLevelBadge(activeDays) {
  const d = parseInt(activeDays ?? 0)
  if (d >= 20) return { label: 'Very Active', cls: 'badge-success' }
  if (d >= 10) return { label: 'Active',      cls: 'badge-info'    }
  if (d >= 5)  return { label: 'Moderate',    cls: 'badge-warning' }
  return              { label: 'Low',         cls: 'badge-danger'  }
}

/**
 * Compute RC analytics status
 */
export function getRcAffiliateStatus(firstAffiliateDate, dealingDate) {
  if (!dealingDate || !firstAffiliateDate) return 'Unknown'
  const diff = (new Date(firstAffiliateDate) - new Date(dealingDate)) / (1000 * 60 * 60 * 24)
  return diff > 7 ? 'New Affiliate' : 'Existed'
}

/**
 * Compute timeline status (Before / Same / After Dealing)
 */
export function getTimelineStatus(affiliateDate, dealingDate) {
  if (!dealingDate) return 'Unknown'
  const diff = (new Date(affiliateDate) - new Date(dealingDate)) / (1000 * 60 * 60 * 24)
  if (diff < -7)  return 'Before Dealing'
  if (diff <= 7)  return 'Same Period'
  return 'After Dealing'
}

/**
 * Compute dealing overall status
 */
export function getDealingOverallStatus(dealing) {
  if (dealing.approvalFromLeaderStatus === 'Approve' &&
      dealing.approvalFromManagementStatus === 'Approve') return 'Approve'
  if (dealing.approvalFromLeaderStatus === 'Reject' ||
      dealing.approvalFromManagementStatus === 'Reject') return 'Reject'
  return 'Pending'
}

/**
 * Check if name is PT or CV (for tax rate)
 */
export function isPtOrCv(name) {
  const upper = (name ?? '').toUpperCase().trim()
  return upper.startsWith('PT') || upper.startsWith('CV')
}

/**
 * Generate document number: MMYY/INV/{prefix}/{sequence:05d}
 */
export async function generateDocumentNumber(prisma, tenantId) {
  const now     = new Date()
  const mmyy    = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`
  const prefix  = process.env[`TENANT_${tenantId}_PREFIX`] ?? 'RDV'
  const lastDoc = await prisma.talent.findFirst({
    where:   { tenantId, noDocument: { startsWith: `${mmyy}/INV/${prefix}/` } },
    orderBy: { noDocument: 'desc' },
    select:  { noDocument: true }
  })
  const seq = lastDoc
    ? parseInt(lastDoc.noDocument.split('/').pop()) + 1
    : 1
  return `${mmyy}/INV/${prefix}/${String(seq).padStart(5, '0')}`
}

/**
 * Generate dealing number: MMYY/DEAL/{prefix}/{sequence:05d}
 */
export async function generateDealingNumber(prisma, tenantId) {
  const now    = new Date()
  const mmyy   = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`
  const prefix = process.env[`TENANT_${tenantId}_PREFIX`] ?? 'RDV'
  const last   = await prisma.talent.findFirst({
    where:   { tenantId, dealingNumber: { startsWith: `${mmyy}/DEAL/${prefix}/` } },
    orderBy: { dealingNumber: 'desc' },
    select:  { dealingNumber: true }
  })
  const seq = last
    ? parseInt(last.dealingNumber.split('/').pop()) + 1
    : 1
  return `${mmyy}/DEAL/${prefix}/${String(seq).padStart(5, '0')}`
}
```

---

## 11. Chart Library Usage Per Page

| Page | Chart Type | Library |
|---|---|---|
| Affiliate Shopee | Line (GMV + Commission dual) | Chart.js |
| Affiliate Shopee | Donut / Pie (GMV by Channel) | Chart.js |
| Affiliate TikTok | Line (5 metrics) | Chart.js |
| Affiliate TikTok | Funnel (3-level) | Custom CSS/HTML |
| Analytics RC | Donut (Status distribution) | Recharts or Chart.js |
| Analytics RC | Bar (Top 10 creators) | Chart.js |
| Analytics Non-RC | Bar (Top by GMV) | Chart.js |
| Reach Affiliate | Bar (count per PIC) | Chart.js |

> **Note:** The original uses ApexCharts and Plotly. For the Next.js migration, standardize on **Chart.js + react-chartjs-2** for all charts to reduce bundle size. Use custom CSS for the funnel.

---

## 12. Navigation (Sidebar additions)

Add under a new **"Affiliate"** sidebar section:

```js
{ section: 'Affiliate' },
{ label: 'Shopee',       href: '/affiliate/shopee',          icon: faShoppingBag },
{ label: 'TikTok',       href: '/affiliate/tiktok',          icon: faBolt         },
{ label: 'Analytics RC', href: '/affiliate/analytics/rc',    icon: faChartPie     },
{ label: 'Non-RC',       href: '/affiliate/analytics/non-rc',icon: faChartBar     },
{ label: 'Listing',      href: '/affiliate/listing',         icon: faList         },
{ label: 'Reach',        href: '/affiliate/reach',           icon: faHandshake    },
{ label: 'Dealing',      href: '/affiliate/dealing',         icon: faFileContract },
{ label: 'Creator GMV',  href: '/affiliate/creator-gmv',     icon: faVideo        },
```

---

## 13. Implementation Checklist

### Database
- [ ] Add Prisma models: `AffiliateShopee`, `AffiliateTiktok`, `AffiliateGmvTiktok`, `ListingAffiliate`, `ReachAffiliate`, `DealingAffiliate`
- [ ] Add `listingAffiliateId`, `dealingDate`, `dealingNumber` columns to `Talent` model
- [ ] Run `prisma migrate dev --name affiliate`

### API Routes — Affiliate Shopee
- [ ] `GET /api/affiliate/shopee` — grouped by date, paginated
- [ ] `GET /api/affiliate/shopee/details-by-date` — detail modal data
- [ ] `GET /api/affiliate/shopee/line-data` — chart
- [ ] `GET /api/affiliate/shopee/gmv-by-channel` — pie
- [ ] `GET /api/affiliate/shopee/new-buyer-by-channel` — info boxes
- [ ] `GET /api/affiliate/shopee/key-metrics`
- [ ] `GET /api/affiliate/shopee/export` — Excel download
- [ ] `POST /api/affiliate/shopee/import` — CSV import
- [ ] `POST /api/affiliate/shopee/import-excel` — AMS Excel import (date from filename, "By Channel" only)
- [ ] `DELETE /api/affiliate/shopee` — range delete

### API Routes — Affiliate TikTok
- [ ] `GET /api/affiliate/tiktok` — grouped by date, paginated
- [ ] `GET /api/affiliate/tiktok/details-by-date`
- [ ] `GET /api/affiliate/tiktok/line-data`
- [ ] `GET /api/affiliate/tiktok/funnel-data`
- [ ] `GET /api/affiliate/tiktok/export` — Google Sheets push
- [ ] `POST /api/affiliate/tiktok/import` — Creator_List Excel
- [ ] `POST /api/affiliate/tiktok/import-gmv` — Video_List GMV (video code matching)
- [ ] `DELETE /api/affiliate/tiktok`

### API Routes — Analytics
- [ ] `GET /api/affiliate/analytics/rc`
- [ ] `GET /api/affiliate/analytics/non-rc`

### API Routes — Listing
- [ ] Full CRUD (`GET`, `POST`, `GET/:id`, `PUT/:id`, `DELETE/:id`)
- [ ] `GET /api/affiliate/listing/check` — affiliate activity lookup
- [ ] `PUT /api/affiliate/listing/:id/approval`
- [ ] `POST /api/affiliate/listing/:id/create-talent`
- [ ] `POST /api/affiliate/listing/import`

### API Routes — Reach
- [ ] Full CRUD + `POST /:id/create-dealing`
- [ ] `GET /api/affiliate/reach/chart`

### API Routes — Dealing
- [ ] Full CRUD
- [ ] `PUT /:id/leader-approval`, `PUT /:id/management-approval`
- [ ] `PUT /bulk-leader-approve`, `PUT /bulk-management-approve`
- [ ] `GET /staff-actions`

### API Routes — Creator GMV
- [ ] `GET /api/affiliate/creator-gmv`
- [ ] `GET /api/affiliate/creator-gmv/not-found`
- [ ] `GET /api/affiliate/creator-gmv/zero`

### Pages & Components
- [ ] Affiliate Shopee page + `ShopeeChartPanel` (line + pie + new buyer info-boxes)
- [ ] Affiliate TikTok page + `TiktokChartPanel` (line + custom funnel)
- [ ] Analytics RC + Non-RC pages with scoring
- [ ] Listing page with approval sub-page
- [ ] Reach page with PIC bar chart
- [ ] Dealing page with 3 tabs (All / Queue / Staff Actions)
- [ ] Creator GMV page with 3 tabs (All / 404 / Zero)

### Import Modals
- [ ] `ImportCsvModal` (Shopee — date param)
- [ ] `ImportAmsModal` (Shopee — date from filename)
- [ ] `ImportCreatorModal` (TikTok — date from filename)
- [ ] `ImportGmvModal` (TikTok — video code matching, shows matched/notFound counts)
- [ ] `ImportListingModal` (Listing — Excel, platform code mapping)
- [ ] `DeleteRangeModal` (both Shopee and TikTok)

### Utilities
- [ ] `lib/affiliate-utils.js` — all helpers (date extraction, badges, scoring, document numbers)
- [ ] `lib/google-sheets.js` — service account auth (shared with existing import system)

### Business Logic Tests
- [ ] AMS filename date extraction: `2025.01.15.xlsx` → `2025-01-15`
- [ ] Creator_List filename date: `20250101-20250131.xlsx` → `2025-01-01`
- [ ] Video code extraction: full TikTok URL → correct code
- [ ] Dealing overall status: both Approve → 'Approve'; either Reject → 'Reject'
- [ ] Create talent from affiliate: generates correct doc/dealing numbers, correct tax rate
- [ ] Import deduplication: re-importing same file → no new rows

---

## 14. Behavioral Notes

1. **AMS Excel import processes ONLY the "By Channel" sheet.** Any other sheets in the workbook are ignored. The filename MUST match `YYYY.MM.DD` pattern or the import is rejected with a validation error before processing begins.

2. **GMV Import not-found rows** are stored in `affiliate_gmv_tiktok` with `link_not_found=true`. These appear in the "Not Found (404)" tab of the Creator GMV page. Users can review them manually and decide whether to update the video link in CampaignContent.

3. **Two-tier approval is independent.** Leader and Management can approve/reject in any order. If Leader rejects, overall = 'Reject' regardless of Management. The "Staff Actions" tab ONLY shows records where BOTH are 'Approve' — this is the action queue for staff to execute the deal.

4. **`create_talent_from_affiliate` is one-way.** Once `talentCreatedStatus = true`, the button is disabled and the action cannot be repeated. The created Talent is linked back via `listingAffiliateId`.

5. **Tax rate is determined by username prefix.** If the talent's username (or `nama_rekening`) starts with "PT" or "CV", the PPh rate is 2%. Otherwise 2.5%. This mirrors the Talent module's tax logic exactly.

6. **Google Sheets export (TikTok)** is a write operation — it does NOT replace the sheet; it appends rows or rewrites a configured range. The SPREADSHEET_ID is stored in environment variables, one per tenant if needed.

7. **Analytics RC joins on `username`** — the Talent record must have `type = 'affiliate'` and its `username` must appear in `affiliate_shopee`. The analytics compute performance scores at query time (not stored).

8. **Performance scores are display-only** — they are computed on-the-fly from aggregated data. They are NOT stored in the database.

9. **Listing approval and Dealing approval are separate workflows.** `ListingAffiliate.approval` is a simple single-decision approval by a manager. `DealingAffiliate` has two independent approval fields (leader + management). Don't confuse them.

10. **The "Check Affiliate" button in the Listing modal** makes a real-time call to `/api/affiliate/listing/check?username=X` and shows the result inline within the modal — no page reload. If the username has no data in `affiliate_shopee`, show "No affiliate data found."

11. **Mass approve actions** (bulk-leader-approve, bulk-management-approve) operate on ALL pending records for the tenant, wrapped in a DB transaction. They do NOT take a selection — they approve everything pending for that tier.

12. **Date filters on Shopee and TikTok pages** apply to both the table AND all chart panels simultaneously. When the user changes the date range, all data re-fetches automatically.
