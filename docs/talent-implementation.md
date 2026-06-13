# Talent Module — Implementation Documentation

## Overview

The Talent module manages KOL/influencer relationships across the full deal lifecycle: onboarding, content scheduling, payment tracking, and financial reporting. It is scoped per tenant (`tenantId` from session) and lives under the `/talent` route group.

---

## Route Structure

| Route | Page Component | Description |
|---|---|---|
| `/talent` | `TalentIndexPage` | Talent directory — list, add, edit, quick stats |
| `/talent/content` | `TalentContentPage` | Content schedule & upload tracking |
| `/talent/payments` | `TalentPaymentsPage` | Payment records & status management |
| `/talent/payments/report` | `TalentReportPage` | Financial analytics & report export |
| `/talent/approval` | `TalentApprovalPage` | Approval record management |

Each route file (`app/(dashboard)/talent/.../page.jsx`) is a thin Server Component wrapper that sets the page `<title>` and renders the matching client component from `components/talent/`.

---

## File Map

```
app/(dashboard)/talent/
  page.jsx
  content/page.jsx
  payments/page.jsx
  payments/report/page.jsx
  approval/page.jsx

components/talent/
  TalentIndexPage.jsx      ← main talent directory UI
  TalentContentPage.jsx    ← content calendar & table
  TalentPaymentsPage.jsx   ← payment records
  TalentReportPage.jsx     ← financial analytics
  TalentApprovalPage.jsx   ← approval management

app/api/
  talent/route.js                         ← GET list + POST create
  talent/[id]/route.js                    ← GET single + PUT + DELETE
  talent/kpi/route.js                     ← GET KPI metrics
  talent/next-dealing-number/route.js     ← GET next dealing number for a username
  talent-payments/route.js                ← GET + POST payments
  talent-payments/[id]/route.js           ← PUT + DELETE payment
  talent-content/route.js                 ← GET + POST content records
  talent-content/campaigns/route.js       ← GET campaigns list for content modal
  kol/refresh-followers/[username]/route.js ← GET (stub) refresh follower counts
```

---

## Permissions

| Permission | Controls |
|---|---|
| `create_talent` | Show "Add Talent" button; POST `/api/talent` |
| `update_talent` | Show Edit / Add Payment / Add Content actions |
| `delete_talent` | Show Delete button on detail panel |

Checked inline from `session?.user?.permissions` (no server-side gating added to these routes yet — enforced at UI level).

---

## Data Model

### Talent (core fields)

| Field | Type | Notes |
|---|---|---|
| `id` | Int | PK |
| `tenantId` | Int | Multi-tenant scope |
| `noDocument` | String | Auto-generated: `MMYY/INV/{PREFIX}/{DEALING_NUMBER}` |
| `username` | String | Social handle |
| `talentName` | String | Legal name |
| `type` | String | `Affiliate`, `KOL`, `Content Creator`, `Clipper` |
| `platform` | String | `Instagram`, `Tiktok`, `Twitter`, `Youtube`, `Shopee` |
| `dealingNumber` | Int | Auto-incremented per username |
| `dealingDate` | DateTime | |
| `rateFinal` | Decimal | Agreed rate (Rp) |
| `dpAmount` | Decimal | Down-payment amount |
| `slotFinal` | Int | Number of content slots agreed |
| `taxPercentage` | Decimal | Auto-calculated if null (PT/CV → 2%, individual → 2.5%) |
| `affiliateStatus` | String | `New` or `Existing` — auto-set for Affiliate type |
| `pic` | String | Person-in-charge name |

### Related Models

- **ContentCreator** — extra fields for Content Creator type (`objektif`, `pillar`, `hook`, `referensi`, `briefKonten`, etc.), linked 1:1 via `talentId`
- **TalentContent** — per-slot content records (`done`, `isRefund`, upload/posting/deadline dates, link)
- **TalentPayment** — payment transactions (`statusPayment`, `amountTf`, `donePayment`, etc.)
- **CampaignContent** — cross-reference to Campaigns (content assigned to a campaign)

---

## API Reference

### `GET /api/talent`

Returns paginated talent list scoped to current tenant.

**Query params:**
- `page`, `limit` (default 25)
- `search` — matches `username` or `talentName` (case-insensitive)
- `type` — filter by type string
- `dealing_date_from`, `dealing_date_to` — ISO date range
- `created_date_from`, `created_date_to` — ISO date range

**Response:** `{ data, total, page, limit }`

Each `data[i]` shape (no DB field names, no Decimals):
```json
{
  "id": 1,
  "no_document": "0625/INV/CLR/00001",
  "username": "janedoe",
  "talent_name": "Jane Doe",
  "type": "KOL",
  "affiliate_status": null,
  "dp_amount": 5000000,
  "rate_final": 10000000,
  "slot_final": 3,
  "dealing_number": 1,
  "dealing_date_formatted": "01/06/2025",
  "pic": "Ari",
  "platform": "Instagram",
  "produk": "Skincare X",
  "remaining": "2 / 3",
  "remaining_color": "text-blue-600",
  "created_at": "01/06/2025"
}
```

`remaining_color` is `text-green-600` when all slots are uploaded, `text-blue-600` otherwise.

### `POST /api/talent`

Creates a new talent record.

**Auto-computed on create:**
- `dealingNumber` — count of existing records for same `username` + 1
- `noDocument` — `genDocNumber(dealingDate, tenant.slug, dealingNumber)`
- `affiliateStatus` — `"New"` if first record for username, `"Existing"` if repeat (Affiliate type only)

**Document number format:** `MMYY/INV/{PREFIX}/{DEALNUM:05}`

Tenant slug → prefix map:
| Slug | Prefix |
|---|---|
| `cleora` | `CLR` |
| `azrina` | `AZR` |
| `delmoura` | `DLM` |
| *(other)* | `ORG` |

If `type === "Content Creator"` and `body.cc` is provided, creates a linked `ContentCreator` record in the same request.

**Returns:** `{ id, no_document }` with status 201.

### `GET /api/talent/:id`

Fetches a single talent with related `ContentCreator`. Calculates:
- `tax` (from `taxPercentage` or auto-calculated via `calcTax()`)
- `discount` (derived field)

### `PUT /api/talent/:id`

Updates talent fields. Handles nested `ContentCreator` upsert for Content Creator type via `mapCcFields()`.

### `DELETE /api/talent/:id`

Deletes talent by id (cascades to related records via DB).

### `GET /api/talent/kpi`

Returns aggregate metrics. Counts only records created since **2025-07-24** (internal baseline).

| Field | Description |
|---|---|
| `total_talents` | Count of talents |
| `total_dp_amount` | Sum of DP amounts |
| `total_rate_final` | Sum of rate finals |
| `total_slot_final` | Sum of slot finals |
| `actual_uploaded` | Count of done, non-refunded content records |

### `GET /api/talent/next-dealing-number?username=X`

Returns `{ next_dealing_number: N }` — used to auto-fill the Dealing Number field in the Add modal while typing the username.

### `GET /api/kol/refresh-followers/:username`

Stub endpoint — currently returns randomized follower data (10k–510k). Intended to call TikTok/Instagram API in production. Updates `CampaignContent.kolFollowers` for matching records.

---

## `TalentIndexPage` Component

**Layout:** Two-panel split (`sv-main`).

- **Left (68%)** — Talent Directory table
- **Right (32%)** — Context panel: Overview (idle) or Profile (row selected)

### Topbar

- Type filter tabs: All | Affiliate | KOL | Content Creator | Clipper
- Search input (username or name, debounced on change)
- Clear button
- "Add Talent" button (shown if `create_talent` permission)

### KPI Strip

Five tiles fetched from `/api/talent/kpi`:

| Tile | Field | Format |
|---|---|---|
| Talents | `total_talents` | count |
| DP Total | `total_dp_amount` | Rp |
| Rate Sum | `total_rate_final` | Rp |
| Slots | `total_slot_final` | count |
| Uploaded | `actual_uploaded` | count |

### Talent Table

Columns: **Doc No** | **Username** | **Name** | **Type** | **Platform** | **Rate Final** | **DP** | **Uploaded** | **Dealing Date** | **PIC**

- 25 rows per page, paginated
- Each row has a left color border keyed to talent type
- Clicking a row opens the **Profile** right panel; clicking again deselects

### Right Panel — Overview (idle)

Shows when no row is selected:
- Dark card: Total Talents, Actual Uploads, Total Rate, Total Slots (from `/api/talent/kpi`)
- Type breakdown: count + progress bar per type (based on current page data)
- Top 5 by Rate Final (current page)

### Right Panel — Profile (row selected)

Shows when a row is clicked:
- Header: username, talent name, type badge, platform badge, affiliate status badge
- Metric cards: Rate Final, DP Amount, Uploaded (slots), Dealing Date
- Action buttons: **Edit**, **Pay**, **Content** (update permission), **Delete** (delete permission)
- Detail list: Doc No, PIC, Produk, Niche, Bank, Rekening, Nama Rek., Followers, Phone, Scope

### Modals

#### TalentModal (Add / Edit)

Two-column grid with 27 fields:

| Column 1 | Column 2 |
|---|---|
| Type (select) | Bank |
| Username | No. Rekening |
| Talent Name | Nama Rekening |
| Content Type | No. NPWP |
| Produk | Pengajuan Transfer Date |
| PIC | Dealing Date |
| Bulan Running (month select) | Dealing Number (auto-filled on Add) |
| Niche | NIK |
| Followers | Price Rate |
| Address | First Rate Card |
| Phone Number | Slot Final |
| | Rate Final * |
| | Tax % |
| | Scope of Work |
| | Masa Kerjasama |
| | Platform * |
| | GDrive KOL Accepting |

On Add mode, `Dealing Number` is auto-fetched via debounced GET to `/api/talent/next-dealing-number` as username is typed (400ms debounce). Field is `readOnly` on Add; editable on Edit.

#### AddPaymentModal

Fields: Status Payment (select), Tanggal Pengajuan (date).
POSTs to `/api/talent-payments` with `talent_id`.

#### AddContentModal

Fields: Campaign (select — fetched from `/api/talent-content/campaigns`), Dealing Upload Date, Rate Card.
POSTs to `/api/talent-content` with `talent_id`.

---

## Type Color Map

| Type | Color |
|---|---|
| Affiliate | `#E07B39` (orange) |
| KOL | `#2C3639` (dark) |
| Content Creator | `#3F4E4F` (dark teal) |
| Clipper | `#8B5E3C` (brown) |

Used consistently across all talent sub-pages for badges, row borders, chart segments, and calendar dots.

---

## `TalentContentPage` Component

**Layout:** `62%` content table + `38%` calendar/schedule panel.

### Content Table

Columns: Username | Type | Campaign | Upload Date | Posting Date | Deadline | Done | Rate | Link | Actions

- 50 rows per page
- KPI strip: Today | Pending | Done | Total
- Type filter tabs + username search

### Calendar Panel (`MiniCalendar`)

- Month navigation (prev/next)
- Each day cell shows colored dots for scheduled items (upload date or posting date)
- Red dot indicator for overdue items

### Reminder Feed

Items classified into: **overdue** (red) | **today** (orange) | **upcoming** (blue) | **done** (green) | **no-date** (gray)

### Actions per content row

- Add link (if no upload link yet)
- Edit (opens `EditContentModal`)
- Refund button

### Date utilities

- `parseDMY(str)` — parses `DD/MM/YYYY` strings returned from API
- `isoDate(d)` — converts Date to `YYYY-MM-DD` for input fields

---

## `TalentPaymentsPage` Component

**Layout:** `63%` payments table + `37%` summary/edit panel.

### Payments Table

Columns: Username | Nama Rekening | Type | Status | PIC | Done | Amount TF

- 50 rows per page
- Type filter buttons + status dropdown + username search
- KPI strip: **Total Spent**, **Total Hutang** (receivable/owed by us), **Total Piutang** (owed to us)

### Status Options

`Full Payment` | `DP 50%` | `Pelunasan 50%` | `Termin 1` | `Termin 2` | `Termin 3`

Status badge colors:
- Green: Full Payment, Pelunasan 50%
- Yellow: DP 50%
- Gray: Termin 1/2/3

### Right Panel — Summary (idle)

- Financial overview totals
- Status breakdown with percentage bars
- Recent paid transfers list

### Right Panel — Edit (row selected)

Editable fields: Status Payment, Done Payment (date), Amount TF (number)  
Read-only: Nama Rekening, PIC, Tanggal Pengajuan  
Delete button at bottom.

---

## `TalentReportPage` Component

**Layout:** `60%` tabbed table + `40%` analytics panel.

### Filters

- Talent Type (select)
- Username (text)
- Date Range: Start + End (two date inputs combined into a single `dateRange` object)

### Table Tabs

**Financial Summary** — `hutang-data` endpoint  
Columns: Username | Talent Name | Should Get | Paid | Hutang | Piutang

**Payment History** — `payment-report` endpoint  
Columns: Username | Type | Status | PIC | Done | Amount TF

Both tables: 15 rows per page, client-side pagination.

### KPI Strip

Total Spent | Total Hutang | Total Piutang  
Formatted with short suffix (B/M/K) in tile + full Rp amount below.

### Analytics Panel (`AnalyticsPanel`)

- **Doughnut chart** — spending by talent type (Chart.js)
- **Top Outstanding bar chart** — top 5 talents by hutang amount
- **Balance Sheet counts** — Outstanding | Settled | Overpaid | Total

---

## `TalentApprovalPage` Component

Lightweight approval record list (no relation to content approvals above).

- Table: Photo (avatar or initials fallback) | Name | Actions
- Search: client-side filter by name
- Add/Edit modal: Name + Photo URL fields
- View modal: shows avatar, name, ID
- API: GET/POST/PUT/DELETE `/api/approval`
- Confirm dialog before delete

---

## Shared Constants

```js
const TYPES     = ['Affiliate', 'KOL', 'Content Creator', 'Clipper']
const PLATFORMS = ['Instagram', 'Tiktok', 'Twitter', 'Youtube', 'Shopee']
const MONTHS    = ['January', ..., 'December']
const STATUS_OPTIONS = ['Full Payment', 'DP 50%', 'Pelunasan 50%', 'Termin 1', 'Termin 2', 'Termin 3']
```

---

## Formatting Utilities

```js
// Currency — "Rp 10.000.000" or "-" for null/0
fmtRp(n)

// Short currency — "10M", "500K", "2B"
fmtShort(n)

// Date DD/MM/YYYY from Date object
fmtDate(d)

// Parse DD/MM/YYYY string → Date
parseDMY(str)

// ISO date string YYYY-MM-DD from Date
isoDate(d)
```
