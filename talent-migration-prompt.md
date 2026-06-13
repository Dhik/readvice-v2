# Talent Module — Full Migration Prompt
**Stack:** Next.js 14 App Router · Supabase (Postgres) · Prisma ORM · Tailwind CSS
**Design tokens:** CSS vars `--dark1:#2C3639` `--dark2:#3F4E4F` `--cream:#DCD7C9` `--orange:#E07B39` `--bg:#F5F0E8`
**UI language:** same compact SV system used in Campaign module (sv-page / sv-topbar / sv-panel / kpi-tile)

---

## 1. Feature Overview

The Talent module is a **CRM + payroll + content-tracking** system for influencer partnerships. It has **4 sub-pages**:

| Route | Name | Description |
|---|---|---|
| `/talent` | Talent Index | Master list of deals/talents with KPI strip + table |
| `/talent/content` | Talent Content | All content items with calendar view + table |
| `/talent/payments` | Talent Payments | Payment records with filter + export |
| `/talent/payments/report` | Financial Dashboard | Hutang/piutang summary + 3 sub-tables |
| `/talent/approval` | Approvals | List of approval signers (used for PDF generation) |

### Talent Types
Four types share the same table but differ in workflows:

| Type | Badge | Key difference |
|---|---|---|
| `KOL` | green `KOL` | Upload link, SPK doc export, invoice with approval sig |
| `Affiliate` | blue `AFF` | Screenshot upload (no link), affiliate_status field |
| `Content Creator` | cyan `CC` | Extra `content_creators` table (brief/production data) |
| `Clipper` | cyan `CLIP` | Same as KOL but no SPK |

---

## 2. Prisma Schema

```prisma
model Talent {
  id                     Int              @id @default(autoincrement())
  tenantId               Int              @map("tenant_id")
  noDocument             String?          @map("no_document")      // e.g. "0125/INV/CLR/00001"
  username               String
  talentName             String           @map("talent_name")
  type                   String           // Affiliate | KOL | Content Creator | Clipper
  contentType            String?          @map("content_type")
  produk                 String?
  pic                    String?
  bulanRunning           String?          @map("bulan_running")     // Month name
  niche                  String?
  followers              Int?
  address                String?
  phoneNumber            String?          @map("phone_number")
  bank                   String?
  noRekening             String?          @map("no_rekening")
  namaRekening           String?          @map("nama_rekening")
  noNpwp                 String?          @map("no_npwp")
  pengajuanTransferDate  DateTime?        @map("pengajuan_transfer_date")
  dealingDate            DateTime?        @map("dealing_date")
  dealingNumber          Int?             @map("dealing_number")   // auto per username
  nik                    String?
  priceRate              Decimal?         @map("price_rate")
  firstRateCard          Decimal?         @map("first_rate_card")
  slotFinal              Int?             @map("slot_final")
  rateFinal              Decimal?         @map("rate_final")
  dpAmount               Decimal?         @map("dp_amount")        // set on first DP payment
  taxPercentage          Decimal?         @map("tax_percentage")   // custom tax % override
  scopeOfWork            String?          @map("scope_of_work")
  masaKerjasama          String?          @map("masa_kerjasama")
  platform               String?          // Instagram | Tiktok | Twitter | Youtube | Shopee
  affiliateStatus        String?          @map("affiliate_status") // Existing | New | null
  gdriveKolAccepting     String?          @map("gdrive_ttd_kol_accepting")
  createdAt              DateTime         @default(now()) @map("created_at")
  updatedAt              DateTime         @updatedAt @map("updated_at")

  contents               TalentContent[]
  payments               TalentPayment[]
  contentCreator         ContentCreator?

  @@map("talents")
}

model ContentCreator {
  id                     Int      @id @default(autoincrement())
  talentId               Int      @unique @map("talent_id")
  tenantId               Int      @map("tenant_id")
  objektif               String?
  pillar                 String?
  subPillar              String?  @map("sub_pillar")
  hook                   String?
  referensi              String?
  briefKonten            String?  @map("brief_konten")
  caption                String?
  assigneeContentEditor  String?  @map("assignee_content_editor")
  bookingTalentDate      DateTime? @map("booking_talent_date")
  bookingVenueDate       DateTime? @map("booking_venue_date")
  productionDate         DateTime? @map("production_date")
  talent                 Talent   @relation(fields: [talentId], references: [id], onDelete: Cascade)

  @@map("content_creators")
}

model TalentContent {
  id                 Int       @id @default(autoincrement())
  talentId           Int       @map("talent_id")
  campaignId         Int?      @map("campaign_id")
  dealingUploadDate  DateTime? @map("dealing_upload_date")
  postingDate        DateTime? @map("posting_date")
  done               Boolean   @default(false)
  uploadLink         String?   @map("upload_link")   // URL for KOL, storage path for Affiliate
  finalRateCard      Decimal?  @map("final_rate_card")
  isRefund           Boolean   @default(false) @map("is_refund")
  picCode            String?   @map("pic_code")
  boostCode          String?   @map("boost_code")
  createdBy          Int?      @map("created_by")
  talent             Talent    @relation(fields: [talentId], references: [id], onDelete: Cascade)
  campaign           Campaign? @relation(fields: [campaignId], references: [id])

  @@map("talent_content")
}

model TalentPayment {
  id                Int       @id @default(autoincrement())
  talentId          Int       @map("talent_id")
  statusPayment     String    @map("status_payment") // Full Payment | DP 50% | Pelunasan 50% | Termin 1/2/3
  tanggalPengajuan  DateTime? @map("tanggal_pengajuan")
  donePayment       DateTime? @map("done_payment")
  amountTf          Decimal?  @map("amount_tf")
  talent            Talent    @relation(fields: [talentId], references: [id], onDelete: Cascade)

  @@map("talent_payments")
}

model Approval {
  id        Int     @id @default(autoincrement())
  tenantId  Int     @map("tenant_id")
  name      String
  photo     String? // storage path

  @@map("approvals")
}
```

---

## 3. App Directory Structure

```
app/
  (protected)/
    talent/
      page.tsx                          ← Talent Index
      content/
        page.tsx                        ← Talent Content
      payments/
        page.tsx                        ← Talent Payments index
        report/
          page.tsx                      ← Financial Dashboard
      approval/
        page.tsx                        ← Approvals

api/
  talent/
    route.ts                            ← GET list (datatables) + POST create
  talent/[id]/
    route.ts                            ← GET show + PUT update + DELETE
  talent/[id]/export-invoice/
    route.ts                            ← GET → PDF invoice
  talent/[id]/export-spk/
    route.ts                            ← GET → PDF/DOCX SPK
  talent/[id]/export-inv-data/
    route.ts                            ← GET → Excel inv data
  talent/kpi/
    route.ts                            ← GET KPI summary
  talent/next-dealing-number/
    route.ts                            ← GET next dealing number for username
  talent-content/
    route.ts                            ← GET list + POST create
  talent-content/[id]/
    route.ts                            ← GET + PUT + DELETE
  talent-content/[id]/add-link/
    route.ts                            ← POST
  talent-content/[id]/add-screenshot/
    route.ts                            ← POST (file upload)
  talent-content/[id]/show-affiliate/
    route.ts                            ← GET screenshot URL
  talent-content/[id]/refund/
    route.ts                            ← POST
  talent-content/[id]/unrefund/
    route.ts                            ← POST
  talent-content/by-date/
    route.ts                            ← GET for calendar
  talent-content/today/
    route.ts                            ← GET today's names
  talent-content/count/
    route.ts                            ← GET content counts
  talent-content/campaigns/
    route.ts                            ← GET campaign list for select
  talent-content/line-chart/
    route.ts                            ← GET chart data
  talent-payments/
    route.ts                            ← GET list + POST create
  talent-payments/[id]/
    route.ts                            ← PUT update + DELETE
  talent-payments/kpi/
    route.ts                            ← GET hutang/piutang totals
  talent-payments/hutang-data/
    route.ts                            ← GET per-talent financial summary (DT)
  talent-payments/payment-report/
    route.ts                            ← GET payment history (DT)
  talent-payments/export/
    route.ts                            ← GET PDF pengajuan
  talent-payments/export-excel/
    route.ts                            ← GET Excel export
  approval/
    route.ts                            ← GET list + POST create
  approval/[id]/
    route.ts                            ← GET + PUT + DELETE
```

---

## 4. API Route Specifications

### `GET /api/talent` — DataTable list
**Query params:**
`draw`, `start`, `length`, `search[value]`, `order[0][column]`, `order[0][dir]`
`dealing_date_from`, `dealing_date_to`, `created_date_from`, `created_date_to`, `type`

**Return shape per row:**
```json
{
  "id": 42,
  "no_document": "0125/INV/CLR/00001",
  "username": "@talentname",
  "talent_name": "Budi Santoso",
  "type": "KOL",
  "affiliate_status": "Existing",        // null for non-Affiliate
  "dp_amount": 2500000,
  "remaining": "3 / 5",                  // content_count / slot_final
  "rate_final": 5000000,
  "dealing_date_formatted": "01/02/2026",
  "payment_actions": "<HTML buttons>",   // addPayment + exportPengajuan
  "document_actions": "<HTML buttons>",  // exportSPK + exportData(invoice)
  "action": "<HTML buttons>"             // view + edit + delete
}
```

**`remaining` calc:** count of `TalentContent` rows for this talent (non-refund + done) divided by `slot_final`

**Badge colors for `type`:**
- Affiliate → `badge-primary` (blue)
- KOL → `badge-success` (green)
- Content Creator → `badge-info` (cyan) label `CC`
- Clipper → `badge-info` (cyan) label `CLIP`

### `POST /api/talent` — Create talent
**Body:** All Talent fields + optional ContentCreator fields if type === 'Content Creator'
**Logic:**
1. Auto-generate `dealing_number`: count existing talents with same username + 1
2. Auto-generate `no_document`: `{MMYY}/INV/{tenantPrefix}/{dealingNumber:05d}`
   tenant prefixes: `CLR` (cleora), `AZR` (azrina), `DLM` (delmoura)
3. If type === 'Content Creator': create linked `ContentCreator` row
4. `affiliate_status`: check if `KeyOpinionLeader` table has a row with same username → `"Existing"` else `"New"`

### `GET /api/talent/kpi` — KPI cards
**Returns:**
```json
{
  "total_talents": 120,
  "total_dp_amount": 48000000,
  "total_rate_final": 240000000,
  "total_slot_final": 600,
  "actual_uploaded": 430
}
```
**Note:** All counts filtered to talents created after 2025-07-24 (baseline date).

### `GET /api/talent/next-dealing-number` — Auto dealing number
**Query:** `username`
**Returns:** `{ "next_dealing_number": 3 }`
Count existing talents with same username, +1.

### `GET /api/talent/[id]` — Show talent
**Returns:**
```json
{
  "talent": { /* all talent fields */ },
  "content_creator": { /* ContentCreator fields if exists */ },
  "discount": 250000,          // first_rate_card - rate_final
  "tax_deduction": 125000      // rate_final * tax_percentage/100 (or PPh formula)
}
```
**Tax formula:**
If `tax_percentage` set → `rate_final * tax_percentage / 100`
Else if `nama_rekening` starts with "PT" or "CV" → `rate_final * 0.02`
Else → `rate_final * 0.025`

### `GET /api/talent/[id]/export-invoice` — PDF invoice
**Query:** `approval` (approval id)
Renders PDF with: talent info, approval signature image, deal summary, tax calc, bank details.
Content-Disposition: attachment; filename="invoice_{noDocument}.pdf"

### `GET /api/talent/[id]/export-spk` — PDF/DOCX SPK agreement
Returns SPK document (PKS format) as downloadable file.

### `GET /api/talent-content` — DataTable
**Query params (filters):**
`username`, `dateRange` (YYYY-MM-DD - YYYY-MM-DD), `filterTalentType`

**Return shape per row:**
```json
{
  "id": 10,
  "talent_id": 42,
  "username": "@talentname",
  "campaign_title": "Campaign Q1",
  "product": "Product A",
  "dealing_upload_date": "2026-02-01",
  "posting_date": "2026-02-03",
  "deadline": "On Time",              // "Overdue" if posting_date > dealing_upload_date + 3 days
  "status": "<done icon HTML>",       // green check or grey X
  "rate_display": "Rp 2.500.000",     // final_rate_card or talent.rate_final/slot_final
  "refund_status": "<refund badge>",  // red REFUND badge or nothing
  "upload_link_display": "<HTML>",    // link button (KOL) or screenshot button (Affiliate)
  "pic_code": "PIC001",
  "boost_code": "BOOST123",
  "kerkun": "<add/view link HTML>",   // Add Link or View Link button
  "action": "<edit|delete|refund HTML>"
}
```

### `GET /api/talent-content/by-date` — Calendar events
**Returns array:**
```json
[
  {
    "id": 10,
    "title": "@talentname",
    "start": "2026-02-03",
    "type": "KOL",
    "color": "#2C3639"    // dark for KOL, "#E07B39" orange for Affiliate
  }
]
```

### `GET /api/talent-content/count` — Content count strip
**Returns:**
```json
{
  "today_count": 5,
  "done_false_count": 23,
  "done_true_count": 87,
  "total_count": 110
}
```

### `GET /api/talent-content/today` — Today's talent names
Returns array of username strings with posting_date = today.

### `POST /api/talent-content/[id]/add-link` — Add upload link
**Body:** `{ task_name, channel, upload_link, posting_date, kode_ads }`
Updates TalentContent + if linked CampaignContent exists, updates that too.

### `POST /api/talent-content/[id]/add-screenshot` — Upload screenshot (Affiliate)
**Body:** multipart with `screenshot` file
Stores file to storage, sets `upload_link` to storage path.

### `POST /api/talent-content/[id]/refund` — Mark as refund
Sets `is_refund = true` on TalentContent.

### `POST /api/talent-content/[id]/unrefund` — Un-refund
Sets `is_refund = false` on TalentContent.

### `GET /api/talent-payments` — DataTable
**Filters:** `pic`, `username[]`, `type`, `status_payment`, `done_payment_start/end`, `tanggal_pengajuan_start/end`

**Return per row:**
```json
{
  "id": 5,
  "username": "@talentname",
  "talent_name": "Budi",
  "nama_rekening": "BCA 12345",
  "type": "KOL",
  "status_payment": "Full Payment",
  "pic": "Admin1",
  "done_payment": "2026-01-15",
  "tanggal_pengajuan": "2026-01-10",
  "amount_tf": 5000000,
  "followers": 120000,
  "action": "<view + edit + delete HTML>"
}
```

### `POST /api/talent-payments` — Create payment
**Body:** `{ talent_id, status_payment, tanggal_pengajuan }`
**Logic:**
- If `status_payment === "DP 50%"`: set `talent.dp_amount = rate_final * 0.5`
- If `status_payment === "Full Payment"`: set `talent.dp_amount = rate_final`

### `PUT /api/talent-payments/[id]` — Update payment
**Body:** `{ status_payment, done_payment }`
Stores `done_payment` date when payment is confirmed done.

### `GET /api/talent-payments/kpi` — Financial totals
**Query:** `username`, `dateRange`, `talentType`
**Returns:**
```json
{
  "totals": {
    "total_spent": 48000000,
    "total_hutang": 12000000,
    "total_piutang": 5000000
  }
}
```
**Logic:**
- `total_spent` = sum of `amount_tf` from payments
- Per talent: `talent_should_get` = `rate_final - tax_deduction`
- `hutang` = `talent_should_get - total_paid` (if positive: we owe them)
- `piutang` = `total_paid - talent_should_get` (if positive: they owe us)
- `total_hutang/piutang` = sums across all talents

### `GET /api/talent-payments/hutang-data` — Financial summary DataTable
**Per row:**
```json
{
  "username": "@talentname",
  "total_spent": 5000000,
  "talent_should_get": 4750000,
  "hutang": 0,
  "piutang": 250000
}
```

### `GET /api/talent-payments/export` — PDF pengajuan
Downloads PDF of payment submission form filtered by current filters.

### `GET /api/talent-payments/export-excel` — Excel export
Downloads Excel file of payment records.

### `GET /api/approval` — DataTable
**Returns:** `id, name, photo (storage URL), action HTML`

### `POST /api/approval` — Create approval
**Body:** multipart `{ name, photo (file) }`

### `GET /api/approval/[id]` — Get approval
**Returns:** `{ id, name, photo, created_at, updated_at }`

---

## 5. Page 1 — Talent Index (`/talent`)

### Layout
```
┌─ sv-page (flex col, gap-8px, full vh minus topnav) ──────────────────┐
│ ┌─ sv-topbar ──────────────────────────────────────────────────────┐  │
│ │ [Talent] | [Dealing Date ▼] [Created Date ▼] [Type ▼] [Clear]   │  │
│ │                              [↺ Refresh KPI] [+ Add] [↑ Import]  │  │
│ │                              [Excel Export ▼] [XML Export ▼]     │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│ ┌─ sv-kpi-strip (5 tiles) ─────────────────────────────────────────┐  │
│ │ [Total Talents] [DP Amount] [Rate Final] [Slot Final] [Uploaded] │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│ ┌─ sv-panel (flex:1) ──────────────────────────────────────────────┐  │
│ │ Talent List                                                        │  │
│ │ [scrollable DataTable]                                             │  │
│ └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

### KPI Strip (5 tiles)
| Tile | Icon | ID | Value format |
|---|---|---|---|
| Total Talents | `fa-users` | `totalTalentsKpi` | integer |
| DP Amount | `fa-money-bill` | `totalDpAmountKpi` | `Rp X.XXX.XXX` |
| Rate Final | `fa-dollar-sign` | `totalRateFinalKpi` | `Rp X.XXX.XXX` |
| Slot Final | `fa-layer-group` | `totalSlotFinalKpi` | integer |
| Actual Uploaded | `fa-upload` | `actualUploadedKpi` | integer |

Refresh KPI: AJAX `GET /api/talent/kpi` → update all 5 values with spin animation.

### Table Columns (12 total)

| # | Column | Notes |
|---|---|---|
| 0 | `id` | hidden |
| 1 | `no_document` | Document number |
| 2 | `username` | @handle |
| 3 | `type` | Badge: AFF/KOL/CC/CLIP |
| 4 | `affiliate_status` | Exist/New badge (null for non-Affiliate = `-`) |
| 5 | `dp_amount` | `Rp X.XXX.XXX` or `-` |
| 6 | `remaining` | `"3 / 5"` content done / slot final — green if equal, blue otherwise |
| 7 | `rate_final` | `Rp X.XXX.XXX` |
| 8 | `dealing_date_formatted` | `DD/MM/YYYY` |
| 9 | `payment_actions` | Add Payment button + Pengajuan PDF button |
| 10 | `document_actions` | SPK export button + Invoice export button (triggers chooseApproval modal) |
| 11 | `action` | View (eye) + Edit (pencil) + Delete (trash) |

### Topbar Filters
- **Dealing Date** (`dealing_date_range`): daterangepicker, format `DD/MM/YYYY - DD/MM/YYYY`
- **Created Date** (`created_date_range`): same
- **Type** (`type_filter`): select — All / Affiliate / KOL / Content Creator / Clipper
- **Clear Filters** button: resets all + reloads
- **↺ Refresh KPI** button: calls `/api/talent/kpi`
- **+ Add** button: opens `addTalentModal` (KOL/Affiliate/Clipper) or `addContentCreatorModal` (Content Creator) — user picks type first via a type select in the main Add modal
- **↑ Import** button: opens `importModal`
- **Excel Export** button: opens `exportModal` (select NIK filter → `/api/talent/export-excel?niks=...`)
- **XML Export** button: opens `exportModalXML` (select NIK(s) required → `/api/talent/export-xml?niks=...`)

---

## 6. Modals on Talent Index

### Modal 1: Add Talent (`addTalentModal`) — modal-lg, 2-col grid
**Left column fields:**
- `type` — select: Affiliate / KOL / Content Creator / Clipper (**required**)
- `username` — text (required; triggers dealing number fetch on input)
- `talent_name` — text (required)
- `content_type` — text
- `produk` — text (required)
- `pic` — text
- `bulan_running` — select: January–December
- `niche` — text
- `followers` — number (money-format class)
- `address` — text
- `phone_number` — text

**Right column fields:**
- `bank` — text
- `no_rekening` — text
- `nama_rekening` — text
- `no_npwp` — text
- `pengajuan_transfer_date` — date picker
- `dealing_date` — date picker
- `dealing_number` — number, **readonly**, auto-filled via `GET /api/talent/next-dealing-number?username=...`
- `nik` — text
- `price_rate` — money input (required)
- `slot_final` — number
- `rate_final` — money input (required)
- `scope_of_work` — text
- `masa_kerjasama` — text
- `platform` — select: Instagram / Tiktok / Twitter / Youtube / Shopee (required)

**Behavior:** On `username` field input → debounced call to fetch dealing number → set readonly field.
On submit → POST `/api/talent` → reload table + refresh KPI.
If `type === 'Content Creator'` → show extended Content Creator section or use separate modal.

### Modal 2: Add Content Creator (`addContentCreatorModal`) — modal-xl, 3-col grid
Same base fields as Add Talent, plus **Content Creator extra fields** (visible only for CC type):
- `objektif` — text
- `pillar` — text
- `sub_pillar` — text
- `hook` — text
- `referensi` — URL
- `brief_konten` — textarea
- `caption` — textarea
- `assignee_content_editor` — text
- `booking_talent_date` — datetime-local
- `booking_venue_date` — datetime-local
- `production_date` — datetime-local

### Modal 3: Edit Talent (`editTalentModal`) — same fields as Add, pre-populated via AJAX GET show
**Behavior:**
Click edit button → GET `/api/talent/[id]` → populate form → show modal.
If `type === 'Content Creator'` → show `editContentCreatorModal` instead (includes CC extra fields).
Submit → PUT `/api/talent/[id]` → reload table.

### Modal 4: View Talent (`viewTalentModal`) — readonly view of all fields
Shows all fields as readonly text inputs + computed fields:
- `first_rate_card` — original rate card
- `discount` = `first_rate_card - rate_final` (formatted IDR)
- `tax_deduction` = computed PPh (formatted IDR)
- `gdrive_ttd_kol_accepting` — Google Drive link (editable field)

For Content Creator type → show `viewContentCreatorModal` with extra CC fields.

### Modal 5: Add Payment (`addPaymentModal`) — modal-sm
- Hidden: `talent_id`
- `status_payment` — select: Full Payment / DP 50% / Pelunasan 50% / Termin 1 / Termin 2 / Termin 3
- `tanggal_pengajuan` — date

POST `/api/talent-payments` → reload table.

### Modal 6: Add Content (`addContentModal`) — modal-md
Opens from `addContentButton` (column 9 in payment_actions cell, or separate button).
- Hidden: `talent_id`
- `campaign_id` — searchable select (loaded async via `GET /api/talent-content/campaigns`)
- `dealing_upload_date` — date
- `final_rate_card` — money input

POST `/api/talent-content` → reload table.

### Modal 7: View Content List (`viewTalentContentListModal`) — modal-xl
Opened via `.viewContentButton` in table. Shows a DataTable of this talent's content.
Header shows talent username.
**Content table columns:** Campaign, Product, Upload Date, Posting Date, Status (done icon), Rate, Refund Status, Link/Screenshot, PIC Code, Boost Code, Kerkun (add/view link), Action (edit/delete/refund).
Has a campaign filter select inside the modal.

### Modal 8: Choose Approval (`chooseApprovalModal`) — modal-sm
Loaded when clicking export invoice. Fetches approval list → shows select.
Confirm → navigates to `/api/talent/[id]/export-invoice?approval=[approvalId]`.

### Modal 9: Import (`importModal`) — modal-sm
Template download link + file input.
POST to `/api/talent/import` (multipart Excel).

### Modal 10: Tax Export Excel (`exportModal`) — modal-sm
Multi-select NIK (preloaded from unique NIKs).
Confirm → `/api/talent/export-tax-excel?niks=...`

### Modal 11: Tax Export XML (`exportModalXML`) — modal-sm
Same as Excel but XML. NIK selection required (validation before submit).
Confirm → `/api/talent/export-tax-xml?niks=...`

---

## 7. Page 2 — Talent Content (`/talent/content`)

### Layout
```
┌─ sv-page ────────────────────────────────────────────────────────────┐
│ ┌─ sv-topbar ───────────────────────────────────────────────────────┐ │
│ │ [Talent Content] | [Date Range ▼] [Talent ▼] [Type ▼] [Clear]   │ │
│ │                    [📅 Calendar] [↑ Export]                       │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ ┌─ count-strip (4 chips) ───────────────────────────────────────────┐ │
│ │ [Today: 5] [Pending: 23] [Done: 87] [Total: 110]                 │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ ┌─ sv-panel (flex:1) ───────────────────────────────────────────────┐ │
│ │ Talent Content List                                                │ │
│ │ [scrollable DataTable]                                             │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### Count Strip (4 chips, horizontal row)
Each chip: small rounded pill with icon + label + count:
| Chip | Icon | Color | API field |
|---|---|---|---|
| Today | `fa-calendar-day` | orange | `today_count` |
| Pending | `fa-clock` | grey | `done_false_count` |
| Done | `fa-check-circle` | green | `done_true_count` |
| Total | `fa-list` | dark | `total_count` |

Fetched via `GET /api/talent-content/count`.

### Table Columns
| # | Column | Notes |
|---|---|---|
| 0 | `id` | hidden |
| 1 | `username` | @handle |
| 2 | `campaign_title` | Campaign name |
| 3 | `product` | Product field |
| 4 | `dealing_upload_date` | DD/MM/YYYY |
| 5 | `posting_date` | DD/MM/YYYY |
| 6 | `deadline` | Green "On Time" or red "Overdue" badge |
| 7 | `status` | ✓ (green) or ✗ (grey) icon |
| 8 | `rate_display` | IDR formatted |
| 9 | `refund_status` | red REFUND badge or empty |
| 10 | `upload_link_display` | Link icon (KOL) or image icon (Affiliate) |
| 11 | `pic_code` | code string |
| 12 | `boost_code` | code string |
| 13 | `kerkun` | "Add Link" button (opens addLinkModal) or "View" if link exists |
| 14 | `action` | view + edit + delete + refund/unrefund |

### Calendar View
Toggle button in topbar → shows FullCalendar (month view) as overlay panel.
Events fetched from `GET /api/talent-content/by-date`.
Event colors: KOL = `#2C3639` (dark), Affiliate = `#E07B39` (orange), others = `#3F4E4F`.
Click event → navigate to that talent content record.

### Topbar Filters
- **Date Range** (`dateRange`): filters `posting_date`
- **Talent** (`username`): searchable select
- **Type** (`filterTalentType`): Affiliate / KOL / Content Creator / Clipper
- **Export**: downloads Excel of filtered content

### Add Link Modal (`addLinkContentModal`) — modal-sm
- `task_name` — select: Soft Selling / Hard Selling / Awareness
- `channel` — select: Instagram Feed / Tiktok Video / Twitter Post / Shopee Video / Instagram Story
- `upload_link` — URL input (required for KOL)
- `posting_date` — date (required)
- `kode_ads` — text

POST `/api/talent-content/[id]/add-link`

### Add Screenshot Modal (`addScreenshotModal`) — modal-sm (Affiliate only)
- File input (image)
- POST `/api/talent-content/[id]/add-screenshot` (multipart)

### View Affiliate Screenshot (`viewAffiliateModal`) — modal-md
Shows the uploaded screenshot image fullscreen in modal.
GET `/api/talent-content/[id]/show-affiliate` → returns image URL.

---

## 8. Page 3 — Talent Payments (`/talent/payments`)

### Layout
```
┌─ sv-page ────────────────────────────────────────────────────────────┐
│ ┌─ sv-topbar ───────────────────────────────────────────────────────┐ │
│ │ [Talent Payments] | [PIC ▼] [Usernames(multi)] [Type ▼]          │ │
│ │ [Status ▼] [Done Payment ▼] [Tgl Pengajuan ▼] [Filter] [Reset]  │ │
│ │                                          [PDF] [Excel]            │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ ┌─ sv-panel (flex:1) ───────────────────────────────────────────────┐ │
│ │ Payment Records [table]                                            │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### Topbar Filters
- **PIC** (`filterPic`): single select from unique PICs
- **Usernames** (`filterUsername`): multi-select (Select2)
- **Type** (`filterType`): All / KOL / Affiliate / Content Creator / Clipper
- **Status Payment** (`status_payment`): All / Full Payment / DP 50% / Pelunasan 50% / Termin 1 / Termin 2 / Termin 3
- **Done Payment** (`filterDonePayment`): daterangepicker
- **Tgl Pengajuan** (`filterTanggalPengajuan`): daterangepicker
- **Filter** button: reload table
- **Reset** button: clear all + reload
- **PDF** button: navigate to `/api/talent-payments/export?{queryString}` (pengajuan PDF)
- **Excel** button: navigate to `/api/talent-payments/export-excel?{queryString}`

### Table Columns
| Column | Notes |
|---|---|
| Username | from talent |
| Talent Name | from talent |
| Nama Rekening | bank account name |
| Type | KOL / Affiliate / etc |
| Status Payment | colored: "50%" orange, "Pelunasan" green |
| PIC | from talent |
| Done Payment | DD/MM/YYYY |
| Tanggal Pengajuan | DD/MM/YYYY |
| Action | View + Edit |

### Edit Payment Modal (`editPaymentModal`)
Pre-populated on row click:
- `username` — text readonly
- `status_payment` — select
- `done_payment` — date (when actual transfer was done)

PUT `/api/talent-payments/[id]`

### View Payment Modal (`viewPaymentModal`)
Readonly display of: id, username, talent_name, nama_rekening, followers, pic, status_payment, amount_tf (formatted IDR), tanggal_pengajuan, done_payment.

---

## 9. Page 4 — Financial Dashboard (`/talent/payments/report`)

### Layout
```
┌─ sv-page ────────────────────────────────────────────────────────────┐
│ ┌─ sv-topbar ───────────────────────────────────────────────────────┐ │
│ │ [Financial Dashboard] | [Username ▼] [Talent Type ▼] [Date ▼]   │ │
│ │                         [Reset]                                   │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ ┌─ sv-kpi-strip (3 tiles) ──────────────────────────────────────────┐ │
│ │ [Total Spent] [Total Hutang (red)] [Total Piutang (green)]        │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ ┌─ sv-tables-area (scrollable, flex col, gap 8px) ──────────────────┐ │
│ │ ┌─ sv-panel: Talent Financial Summary ──────────────────────────┐ │ │
│ │ │ [hutangPiutangTable: Username | Total Spent | Should Receive  │ │ │
│ │ │  | Hutang (red) | Piutang (green)]                            │ │ │
│ │ └───────────────────────────────────────────────────────────────┘ │ │
│ │ ┌─ sv-panel: Payment History ───────────────────────────────────┐ │ │
│ │ │ [talentPaymentsTable: Username | Status | PIC | Date |        │ │ │
│ │ │  Submission | Amount]                                          │ │ │
│ │ └───────────────────────────────────────────────────────────────┘ │ │
│ │ ┌─ sv-panel: Content Overview ──────────────────────────────────┐ │ │
│ │ │ [talentContentTable: ID (hidden) | Username | Upload Date |   │ │ │
│ │ │  Posting Date | Status | Expected Amount]                      │ │ │
│ │ └───────────────────────────────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### KPI Tiles (3)
| Tile | Icon bg | ID |
|---|---|---|
| Total Spent | `#2C3639` (dark) + `fa-dollar-sign` | `totalSpent` |
| Total Hutang | `#dc3545` (red) + `fa-money-bill-wave` | `totalHutang` |
| Total Piutang | `#28a745` (green) + `fa-hand-holding-usd` | `totalPiutang` |

Loaded via `GET /api/talent-payments/kpi`. Reloads on filter change.

### Table 1 — Talent Financial Summary
DataTable (server-side) from `GET /api/talent-payments/hutang-data`.
Columns: Username, Total Spent, Should Receive, Hutang (red if >0, else `-`), Piutang (green if >0, else `-`).

### Table 2 — Payment History
DataTable from `GET /api/talent-payments/payment-report`.
Status badges: DP 50% → orange, Full Payment/Pelunasan → green, others → grey.
Dates rendered as DD/MM/YYYY.

### Table 3 — Content Overview
DataTable from `GET /api/talent-content` with financial-report params.
Columns: id(hidden), Username, Upload Date, Posting Date, deadline (Overdue/On Time badge), Expected Amount.

**Filters affect all 3 tables simultaneously + KPI tiles.**

---

## 10. Page 5 — Approvals (`/talent/approval`)

### Layout
```
┌─ sv-page ────────────────────────────────────────────┐
│ ┌─ sv-topbar ─────────────────────────────────────┐  │
│ │ [Approvals]                      [+ Add Approval] │  │
│ └─────────────────────────────────────────────────┘  │
│ ┌─ sv-panel (flex:1) ─────────────────────────────┐  │
│ │ [approvalTable: ID(hidden) | Name | Photo | Action│  │
│ └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

Photo column: renders `<img src="/storage/...">` 40px height.
Action: View (eye) + Edit (pencil) + Delete (trash).

### Add Approval Modal (`addApprovalModal`)
- `name` — text (required)
- `photo` — file input (image)

POST `/api/approval` (multipart).

### Edit Approval Modal (`editApprovalModal`)
GET approval → prefill name + show current photo preview → PUT `/api/approval/[id]`.

### View Approval Modal (`viewApprovalModal`)
Readonly: name, photo full preview, created_at, updated_at.

---

## 11. Business Logic Details

### Document Number Format
`{MMYY}/INV/{prefix}/{dealingNumber:05d}`
- `MMYY` = month+year of `dealing_date` (e.g. `0226` for Feb 2026)
- `prefix` = tenant-specific: `CLR` (Cleora), `AZR` (Azrina), `DLM` (Delmoura)
- `dealing_number` = zero-padded 5 digits

Example: `0226/INV/CLR/00003`

### Dealing Number Auto-increment
`SELECT COUNT(*) FROM talents WHERE username = ? AND tenant_id = ?` + 1

### Tax / PPh Calculation
```typescript
function calcTax(rateFinal: number, namaRekening: string, taxPercentage?: number) {
  if (taxPercentage) return rateFinal * taxPercentage / 100;
  const isPTCV = namaRekening.startsWith('PT') || namaRekening.startsWith('CV');
  return rateFinal * (isPTCV ? 0.02 : 0.025);
}
function talentShouldGet(rateFinal: number, namaRekening: string, taxPercentage?: number) {
  return rateFinal - calcTax(rateFinal, namaRekening, taxPercentage);
}
```

### Hutang / Piutang
Per talent:
```typescript
const taxDeduction = calcTax(talent.rateFinal, talent.namaRekening, talent.taxPercentage)
const shouldGet = talent.rateFinal - taxDeduction
const totalPaid = SUM(payments.amount_tf WHERE talent_id = talent.id)
const hutang = Math.max(0, shouldGet - totalPaid)   // we owe the talent
const piutang = Math.max(0, totalPaid - shouldGet)  // talent owes us
```

### DP Amount Update on Payment
When creating a payment:
```typescript
if (statusPayment === 'DP 50%') {
  await prisma.talent.update({ where: { id: talentId }, data: { dpAmount: talent.rateFinal * 0.5 } })
} else if (statusPayment === 'Full Payment') {
  await prisma.talent.update({ where: { id: talentId }, data: { dpAmount: talent.rateFinal } })
}
```

### Affiliate Status Detection
When creating a new talent:
```typescript
const kol = await prisma.keyOpinionLeader.findFirst({ where: { username: talent.username } })
const affiliateStatus = kol ? 'Existing' : 'New'
```

### Remaining Slots Display
```typescript
const contentCount = await prisma.talentContent.count({
  where: { talentId: talent.id, done: true, isRefund: false }
})
const remaining = `${contentCount} / ${talent.slotFinal ?? 0}`
// green text if contentCount === slotFinal, blue otherwise
```

### Deadline Status
```typescript
function deadlineStatus(dealingUploadDate: Date | null, postingDate: Date | null) {
  if (!dealingUploadDate || !postingDate) return 'On Time'
  const deadline = new Date(dealingUploadDate)
  deadline.setDate(deadline.getDate() + 3)
  return postingDate > deadline ? 'Overdue' : 'On Time'
}
```

### Content Rate Display
```typescript
const rateDisplay = content.finalRateCard
  ?? (talent.rateFinal && talent.slotFinal ? talent.rateFinal / talent.slotFinal : null)
```

---

## 12. Shared Utility Functions

```typescript
// Format Indonesian Rupiah
function formatIDR(n: number | null): string {
  if (!n) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

// Format IDR compact (Rp X.XXX.XXX)
function formatRp(n: number | null): string {
  if (!n) return '-'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

// Format date DD/MM/YYYY
function formatDate(d: Date | string | null): string {
  if (!d) return '-'
  const date = new Date(d)
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`
}

// Format datetime for input[type=datetime-local]
function formatDateTimeLocal(d: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  return date.toISOString().slice(0, 16)
}

// Status payment badge
function statusPaymentBadge(status: string): string {
  if (['50%','DP 50%'].includes(status)) return 'badge-warning orange'
  if (['Pelunasan','Full Payment'].includes(status)) return 'badge-success green'
  return 'badge-secondary grey'
}

// Type badge label
function typeBadge(type: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    'Affiliate': { label: 'AFF', color: 'blue' },
    'KOL': { label: 'KOL', color: 'green' },
    'Content Creator': { label: 'CC', color: 'cyan' },
    'Clipper': { label: 'CLIP', color: 'cyan' },
  }
  return map[type] ?? { label: type, color: 'grey' }
}
```

---

## 13. Permissions

| Permission key | Controls |
|---|---|
| `viewTalent` | View talent list + content + payments |
| `createTalent` | Add talent / content creator |
| `updateTalent` | Edit talent, add payment, add content |
| `deleteTalent` | Delete talent, content, payment |
| `exportTalent` | SPK export, invoice export, tax export |
| `viewApproval` | View approvals list |
| `manageApproval` | Add/edit/delete approvals |

---

## 14. Tailwind Custom Classes Needed

```css
/* Inherit all sv-* classes from Campaign module */
.sv-page { display: flex; flex-direction: column; gap: 8px; height: calc(100vh - 78px); }
.sv-topbar { background: #fff; border: 1px solid #DCD7C9; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
.sv-topbar-title { font-size: 13px; font-weight: 700; color: #2C3639; padding-right: 8px; border-right: 2px solid #DCD7C9; }
.sv-kpi-strip { display: flex; gap: 8px; flex-shrink: 0; }
.kpi-tile { background: #fff; border: 1px solid #DCD7C9; border-radius: 8px; padding: 10px 16px; display: flex; align-items: center; gap: 12px; flex: 1; }
.kpi-tile-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; }
.kpi-tile-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .4px; }
.kpi-tile-value { font-size: 16px; font-weight: 700; color: #2C3639; }
.sv-panel { background: #fff; border: 1px solid #DCD7C9; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.sv-panel-header { padding: 8px 12px; border-bottom: 1px solid #DCD7C9; display: flex; align-items: center; justify-content: space-between; background: #fafaf8; }
.sv-panel-title { font-size: 12px; font-weight: 600; color: #2C3639; display: flex; align-items: center; gap: 6px; }
.sv-panel-body { flex: 1; overflow: auto; padding: 10px 12px; min-height: 0; }
.sv-tables-area { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }

/* Money amounts */
.money-value { font-weight: 600; }
.hutang-amount { color: #dc3545; }
.piutang-amount { color: #28a745; }

/* Count strip chips */
.count-chip { display: flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #DCD7C9; border-radius: 20px; padding: 4px 12px; font-size: 12px; }
```

---

## 15. Implementation Checklist

### Prisma / Database
- [ ] Create `talents` migration
- [ ] Create `content_creators` migration
- [ ] Create `talent_content` migration
- [ ] Create `talent_payments` migration
- [ ] Create `approvals` migration
- [ ] Add relations to Campaign / KeyOpinionLeader models

### API Routes (26 total)
- [ ] GET /api/talent (DataTable)
- [ ] POST /api/talent (create)
- [ ] GET /api/talent/[id] (show)
- [ ] PUT /api/talent/[id] (update)
- [ ] DELETE /api/talent/[id] (delete)
- [ ] GET /api/talent/kpi
- [ ] GET /api/talent/next-dealing-number
- [ ] GET /api/talent/[id]/export-invoice (PDF)
- [ ] GET /api/talent/[id]/export-spk (PDF)
- [ ] GET /api/talent/[id]/export-inv-data (Excel)
- [ ] POST /api/talent/import (Excel import)
- [ ] GET /api/talent/export-tax-excel
- [ ] GET /api/talent/export-tax-xml
- [ ] GET /api/talent-content (DataTable)
- [ ] POST /api/talent-content (create)
- [ ] PUT /api/talent-content/[id] (update)
- [ ] DELETE /api/talent-content/[id] (delete)
- [ ] POST /api/talent-content/[id]/add-link
- [ ] POST /api/talent-content/[id]/add-screenshot
- [ ] GET /api/talent-content/[id]/show-affiliate
- [ ] POST /api/talent-content/[id]/refund
- [ ] POST /api/talent-content/[id]/unrefund
- [ ] GET /api/talent-content/by-date (calendar)
- [ ] GET /api/talent-content/count
- [ ] GET /api/talent-content/today
- [ ] GET /api/talent-content/campaigns
- [ ] GET /api/talent-payments (DataTable)
- [ ] POST /api/talent-payments
- [ ] PUT /api/talent-payments/[id]
- [ ] DELETE /api/talent-payments/[id]
- [ ] GET /api/talent-payments/kpi
- [ ] GET /api/talent-payments/hutang-data (DataTable)
- [ ] GET /api/talent-payments/payment-report (DataTable)
- [ ] GET /api/talent-payments/export (PDF)
- [ ] GET /api/talent-payments/export-excel
- [ ] GET /api/approval (DataTable)
- [ ] POST /api/approval
- [ ] GET /api/approval/[id]
- [ ] PUT /api/approval/[id]
- [ ] DELETE /api/approval/[id]

### Pages (5)
- [ ] `/talent` — index with KPI strip + table
- [ ] `/talent/content` — count strip + calendar toggle + table
- [ ] `/talent/payments` — payment table with multi-filter
- [ ] `/talent/payments/report` — 3-KPI + 3-table financial dashboard
- [ ] `/talent/approval` — approvals CRUD table

### Modals (16)
- [ ] Add Talent (2-col lg)
- [ ] Add Content Creator (3-col xl with CC fields)
- [ ] Edit Talent (pre-populated)
- [ ] Edit Content Creator (pre-populated)
- [ ] View Talent (readonly)
- [ ] View Content Creator (readonly)
- [ ] Add Payment (sm)
- [ ] Add Content (md)
- [ ] View Content List (xl nested DataTable)
- [ ] Add Link (sm)
- [ ] Add Screenshot (sm, Affiliate only)
- [ ] View Affiliate Screenshot (md)
- [ ] Choose Approval (sm, for invoice export)
- [ ] Import Talents (sm)
- [ ] Tax Export Excel (sm, NIK multi-select)
- [ ] Tax Export XML (sm, NIK required)
- [ ] Edit Payment (sm)
- [ ] View Payment (sm, readonly)
- [ ] Add Approval (sm)
- [ ] Edit Approval (sm)
- [ ] View Approval (sm)

### Logic
- [ ] Auto dealing number generation
- [ ] Document number format `{MMYY}/INV/{prefix}/{05d}`
- [ ] Tax/PPh calculation (PT/CV 2%, others 2.5%, or custom)
- [ ] Hutang/Piutang computation
- [ ] DP amount update on payment store
- [ ] Affiliate status detection (KOL table lookup)
- [ ] Remaining slots display (done content / slot_final)
- [ ] Deadline status (3-day window)
- [ ] Calendar event coloring by type
- [ ] Count strip aggregation
- [ ] KPI refresh animation
- [ ] PDF invoice generation with approval signature
- [ ] SPK document generation
- [ ] Tax Excel/XML export
- [ ] Screenshot upload + storage
- [ ] Link → CampaignContent sync (add-link also updates campaign content)

---

## 16. Key Behavioral Notes

1. **Two modal variants by type** — Edit/View dispatches to either `editTalentModal` or `editContentCreatorModal` based on `talent.type === 'Content Creator'`. All other types use the standard modal.

2. **Dealing number is per-username** — NOT global. So the same username can have multiple deals numbered 1, 2, 3... regardless of other usernames.

3. **Content Creator has a separate linked table** — `content_creators` is 1-to-1 with `talents`. Create it in the same transaction when `type === 'Content Creator'`.

4. **Affiliate uses screenshot, KOL uses link** — The `upload_link` column stores both: URL string for KOL, storage file path for Affiliate. The `type` determines how it's rendered in the table cell (link icon vs image icon).

5. **View Content List modal has its own DataTable** — When the modal opens, destroy any existing DataTable on `#talentContentListTable` and re-initialize with the talent's ID. This prevents data leakage between different talent rows.

6. **Export buttons pass current filter state** — PDF and Excel exports build a full query string from current filter values and navigate directly (no AJAX, browser download).

7. **Financial Dashboard all-or-nothing filter sync** — Changing any filter (username, type, dateRange) reloads all 3 tables AND the KPI tiles simultaneously.

8. **Calendar is an overlay toggle** — Not a separate route. A button in the topbar shows/hides a FullCalendar panel above the table. Events come from `GET /api/talent-content/by-date` (no pagination).

9. **Import creates talents + potentially ContentCreator rows** — The Excel template has standard talent columns; if a row has CC-specific columns filled, create the linked content_creators row.

10. **Tax XML requires at least one NIK selected** — Validate this client-side before triggering download; show SweetAlert2 warning if no NIK selected.

11. **Document number is generated at creation** — Once set, it does not change on updates. Include it in the POST create logic, not in PUT update.

12. **SPK export is only available for KOL type** — The SPK button in `document_actions` column should only appear when `talent.type === 'KOL'`.
