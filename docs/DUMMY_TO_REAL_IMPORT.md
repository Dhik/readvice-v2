# Replacing dummy data with real data (via Google Sheets)

This is the map of **every dummy data point in the app**, whether it can be fixed by importing,
and — for the ones that can — **the exact Google Sheet format to follow**.

## How it works (the design already supports this)

Each dummy feature reads from a table that has a `source` column defaulting to `"DUMMY"`.
The analytics engines flag a value as dummy when `source === 'DUMMY'`. So making data real is just:

> **Import rows into the same table with `source = "REAL"`.** No schema change. The dummy
> badges/banners turn off automatically for the rows you provide.

This mirrors how **ads / affiliate / campaign** already import (those stay exactly as they are —
this only adds importers for the dummy tables). Each new importer is a route under
`/api/import/gs/…` that reads a configured sheet and upserts with `source="REAL"`, plus a Sync
button on the relevant page.

---

## ✅ Import-fixable (a real Google Sheet replaces the dummy)

> **General rules for every sheet:** Row 1 = headers (use the exact column names below, lowercase).
> Dates as `YYYY-MM-DD`. "Month" columns as the 1st of the month (`2026-02-01`). Numbers plain
> (no `Rp`, no thousands separators). One sheet per feature; one tab named `Sheet1`.

### 1. Visits → fixes Dashboard & Sales: **Visit, ROAS, Closing Rate, CPA**
Daily storefront visits per platform. (Ad spend is already real from your ads import; visits are
the missing half of ROAS/closing/CPA.) Table: `visits`.

| date | platform | visits |
|------|----------|--------|
| 2026-02-01 | shopee | 1240 |
| 2026-02-01 | tiktok | 880 |

Key: one row per (date, platform). Platforms: `shopee`, `tiktok`, `tokopedia`, `lazada`, …

### 2. BCG product metrics → fixes **BCG Matrix axes** (visitor, ATC, buyers, ad spend, omset, CTR)
Per-product, per-month marketplace funnel (export from your Shopee/TikTok **product analytics**).
Sales/qty/stock/price are already real from orders; these are the dummy axes. Table: `bcg_product`.

| month | sku | nama_produk | visitor | jumlah_atc | jumlah_pembeli | biaya_ads | omset_penjualan | ctr |
|-------|-----|-------------|---------|------------|----------------|-----------|-----------------|-----|
| 2026-02-01 | SKU-001 | 3 Minute Exfoliating Gel | 5400 | 720 | 240 | 1500000 | 9800000 | 3.2 |

Key: matched to products by `sku`. `ctr` is a percentage (e.g. `3.2` = 3.2%).

### 3. Talent returns → fixes **Talent ROI** (attributed revenue/GMV, views, conversions)
The talent→revenue link the app cannot derive on its own. Best sourced from your affiliate/
creator-code report (revenue attributable to each creator per month). Table: `talent_return`.

| talent_handle | period | attributed_revenue | attributed_gmv | content_views | conversions | engagement_actions |
|---------------|--------|--------------------|----------------|---------------|-------------|--------------------|
| @beautybyagis | 2026-02-01 | 12500000 | 14000000 | 185000 | 320 | 9400 |

Key: `talent_handle` (or talent name) is resolved to the internal talent. `engagement_actions` =
likes + comments + shares. One row per (talent, month).

### 4. (Optional) Order fulfilment timing → fixes **Operational** fulfilment dummy
Per-order processing/shipping days. Table: `order_fulfillment`.

| order_ref | processing_days | shipping_days | total_days |
|-----------|-----------------|---------------|------------|
| 2606143TSTKW64 | 1.0 | 2.5 | 3.5 |

Key: `order_ref` = the platform order ID (matched to the order). Lower priority than 1–3.

---

## ⛔ NOT fixable by import (these become real another way)

| Feature | Why importing won't help | How it becomes real |
|---|---|---|
| **Cohort retention** (period 1+) | It's computed from real repeat orders over time | Accrues automatically as months of order history build up |
| **CLV projection** | A forward model, not a record you can "have" | Becomes real once enough repeat history exists; the multipliers are config, not data |
| **AI Forecast** | Honest gate, not a dummy line | Appears automatically once ≥12 months of history exist (tenant 2 has 3) |
| **True ROAS attributed revenue** | No backing table — it's `spend × assumed ROAS` | Needs order-level / affiliate attribution (a new table), **not** a simple sheet. Closest real source = the same creator/UTM data as Talent returns (#3) |
| **RFM padding rows** | Dev scaffolding only | Already real for your real customers; padding disappears as coverage grows |

---

## Built importers (where to click + which env var to set)

| Sheet | Endpoint | Env var (Sheet ID) | "Sync" button lives on |
|---|---|---|---|
| Visits | `/api/import/gs/visits` | `VISITS_SHEET_ID` | **Sales** page topbar — "Sync visits" |
| Talent returns | `/api/import/gs/talent-returns` | `TALENT_RETURNS_SHEET_ID` | **Talent ROI** (Analytics) topbar — "Sync returns" |
| BCG metrics | `/api/import/gs/bcg/metrics` | `BCG_METRICS_SHEET_ID` | **BCG Matrix** (Analytics) topbar — "Sync metrics" |
| Order fulfilment | `/api/import/gs/order-fulfillment` | `ORDER_FULFILLMENT_SHEET_ID` | **Operational** (Analytics) topbar — "Sync fulfilment" |

**To use one:** (1) make a Google Sheet with the columns above, tab named `Sheet1`; (2) share it with
the service-account email (viewer) — same account as your other imports; (3) put the sheet's ID in the
env var; (4) click the Sync button. It reports `imported / skipped / unmatched`. Re-syncing is
idempotent (it replaces, not duplicates). Tenant-scoped — each tenant syncs its own sheets.

### Identifier matching (how rows map to your data)
- **Talent returns:** matched by `talent_handle` → `Talent.username` (case-insensitive, leading `@` ignored).
  Handles not found are reported back as `unmatchedHandles`.
- **Order fulfilment:** matched by `order_ref` → the platform order ID. Unmatched count is reported.
- **BCG:** matched by `sku` + month → upserts onto the existing BCG row (real sales/qty/stock keep their values).
- **Visits:** keyed by (date, platform) — no matching needed.
