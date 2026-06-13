# Sales / Orders / NetProfit — Google Sheets Configuration (Old-App Reference)

> **Purpose.** Reference for migrating the old app's Google-Sheets-driven Sales,
> Orders, and NetProfit pipeline into the new app. Spreadsheet IDs are mapped to
> `SHEET_*` env vars (see `.env.example` / `.env.local`).

> **Status: complete.** All sections (A spreadsheet IDs, B order-import column
> maps, C NetProfit recompute methods, D scheduler, E tenant/channel maps,
> F warnings, G ad-spent/visit maps) are populated from the old-app extraction.
> Column indices in B and G are **0-based**. The three warnings in Section F must
> be resolved before the pipeline is reimplemented — see the migration checklist
> at the end.

---

## A. Spreadsheet IDs  ✅ complete

| Env var | Spreadsheet ID | Purpose (from var name) |
|---|---|---|
| `SHEET_CLEORA_IMPORT` | `1exzzjCjYIlfwRjFF6ljNXsGAERB9_UFzE8f3hP0lhIw` | Cleora master import sheet |
| `SHEET_AZRINA_ADS` | `1LGAez9IydEKgLZwRnFX7_20T_hjgZ6tz3t-YXo4QBUw` | Azrina ad-spend sheet |
| `SHEET_AZRINA_NETPROFIT` | `1sDhPAvqXkBE3m2n1yt2ghFROygTxKx1gLiBnUkb26Q0` | Azrina NetProfit sheet — see **Warning #2** |
| `SHEET_ORDERS_DEFAULT` | `1ksZm0fLUTdZbf8ITNQXxOizbhpOfjHj32nWAthDFyWI` | Default marketplace orders sheet |
| `SHEET_ORDER_B2B` | `1bqiRz8rHFYjLyu9wN1CTDEt9nzeez0dzthPkoJSBUDI` | B2B orders sheet |
| `SHEET_ORDER_CRM` | `1hMubpvYFyDnPJB3NtiOwH-nH0Qwb9wz7Sq4laVESvPM` | CRM orders sheet |
| `SHEET_ORDER_BALANCE` | `1RDC3Afs4wzaO3S36rvX35xB_D_zuqVs5vfMe7TI8vRY` | Order balance sheet |
| `SHEET_NP_EXPORT_TARGET` | `1Ukssd8FRbGA6Pa_Rsn3FJ2SP_W2CS4rkIhh3o5yw1gQ` | NetProfit export target sheet |

> Note: purposes above are **inferred from the env-var names**, not from the
> extraction. Correct against the source extraction if any differ.

---

## B. Order import column maps (0-based)

### B1 — Shopee family — range A2:R (cols 0-17)
Methods: importOrdersShopee (ch1,t1) · importOrdersShopee2 (ch8,t1) ·
importOrdersShopee3 (ch9,t1) · importAzrinaShopee (ch1,t2) ·
importOrdersDelmouraShopee (ch1,t3). Skip row if row[3] (date) empty.

| Col | Field |
|---|---|
| 0 | id_order |
| 1 | receipt_number |
| 2 | shipment |
| 3 | date (Carbon::parse → Y-m-d) |
| 4 | sku |
| 5 | product |
| 6 | username |
| 7 | customer_name |
| 8 | customer_phone_number |
| 9 | shipping_address |
| 10 | city |
| 11 | province |
| 12 | qty |
| 13 | payment_method |
| 14 | price (preg_replace /[.,]/ → int) |
| 15 | shipping_cost (used only to compute amount) |
| 16 | amount — Shopee3 ONLY: amount = row[16] |
| 17 | status |

- amount = price(14) + shipping(15), EXCEPT Shopee3 uses row[16] directly
- variant: null (not mapped)
- upsert_key: id_order + product + sku + amount (Delmoura also + tenant_id)
- Per-method: sales_channel_id = 1/8/9/1/1; tenant_id = 1/1/1/2/3
- importOrdersShopee2 stores price = row[14] raw (uncleaned); others store cleaned int

### B2 — TikTok family — range A2:S (cols 0-18)
Methods: importOrdersTiktok (ch4,t1) · importAzrinaTiktok (ch4,t2) ·
importOrdersDelmouraTiktok (ch4,t3). Skip if row[6] (date) empty.

| Col | Field |
|---|---|
| 0 | id_order |
| 1 | sku |
| 2 | product |
| 3 | variant |
| 4 | qty |
| 5 | price |
| 6 | date (createFromFormat 'd/m/Y H:i:s' → Y-m-d) |
| 7 | username |
| 8 | customer_name |
| 9 | customer_phone_number |
| 10 | province |
| 11 | city |
| 12 | shipping_address |
| 13 | status |
| 14 | shipment |
| 15 | receipt_number |
| 16 | payment_method |
| 18 | amount |

- upsert_key: id_order + product + sku (Tiktok/Azrina) | id_order+sku+date+tenant+channel via updateOrCreate (Delmoura)
- Delmoura: price = preg_replace('/[^\d]/') on row[5]; amount = digits of row[18];
  multi-format date fallback: d/m/Y H:i:s | d/m/Y H:i | d/m/Y

### B3 — Tokopedia family — same column indices as B2
Methods: importOrdersTokopedia (ch3,t1, range A2:S) ·
importAzrinaTokopedia (ch3,t2, range A2:P)
Identical map to B2 (0→id_order ... 18→amount); date row[6] format
'd/m/Y H:i:s'; skip if empty; upsert_key: id_order+product+sku

### B4 — Lazada family — range A2:Q (cols 0-16)
Methods: importOrdersLazada (ch2,t1) · importAzrinaLazada (ch2,t2)

| Col | Field |
|---|---|
| 0 | id_order |
| 1 | receipt_number |
| 3 | date (Carbon::parse → Y-m-d) |
| 4 | payment_method |
| 5 | product |
| 6 | sku |
| 7 | variant |
| 8 | price = amount (floatval after strip commas) |
| 9 | customer_name AND username (same column) |
| 11 | shipping_address |
| 12 | city |
| 13 | province |
| 14 | status |
| 15 | shipment |
| 16 | customer_phone_number |

- qty: hardcoded = 1
- upsert_key: id_order + sku + date

---

## C. NetProfit update-* recompute methods

parseCurrencyToInt = (int) preg_replace('/[^0-9]/', '', value)
Default window = last 40 days unless noted. Every Cleora method has an
Azrina twin (tenant 2) unless noted otherwise.

| Method (Azrina twin) | Tenant | Source | Target column(s) | Window | Detail |
|---|---|---|---|---|---|
| updateSpentKol (…Azrina) | 1/2 | GS Import Sales!A2:T / Azrina!A2:M | spent_kol | 40d | Cleora: row[19] (col T); Azrina: row[12] (col M). ⚠️ See Warning #1 |
| updateB2bAndCrmSales (…Azrina) | 1/2 | GS Import Sales!A2:T / Azrina!A2:D | b2b_sales, crm_sales | current month | Cleora: b2b=row[18] (S), crm=row[19] (T); Azrina: b2b=row[1], crm=row[2]. Update-only (skip if no row). ⚠️ See Warning #1 |
| updateHpp (…Azrina) | 1/2 | orders ⋈ products on TRIM(sku) | hpp | Cleora 40d (by orders.date); Azrina current month | Σ(orders.qty × products.harga_satuan), excludes cancelled statuses; resets to 0 first. SKU regex strips leading "<n> " prefix |
| updateMarketing (…Azrina) | 1/2 | sales table (JOIN on date+tenant) | marketing | 40d | net_profits.marketing = sales.ad_spent_total (raw SQL UPDATE…INNER JOIN) |
| updateVisit (…Azrina) | 1/2 | sales (JOIN) | visit | 40d | net_profits.visit = sales.visit |
| updateSales (…Azrina) | 1/2 | orders SUM(amount) | sales | 40d | per date, whereNotIn(status, excluded); Cleora excluded list is larger (includes 'Dibatalkan…' strings) |
| updateQty (…Azrina) | 1/2 | orders SUM(qty) | qty | 40d | reset 0 → joinSub on date; excludes cancelled |
| updateOrderCount (…Azrina) | 1/2 | orders COUNT(DISTINCT id_order) | order, fee_packing | 40d | order = count; fee_packing = count × 2000; reset 0 first |
| updateRoas (…Azrina) | 1/2 | computed | roas | 40d | roas = sales / marketing where marketing≠0; null where marketing=0 |
| updateClosingRate | all | computed | closing_rate | current month | ROUND((order/visit)×100, 2) where visit>0, else 0. Called automatically at end of importNetProfits* |
| importNetProfits | 1 | GS Import Sales!A2:D (id 1LGA…) | affiliate | all rows | affiliate = row[2]. ⚠️ See Warning #2 |
| importNetProfitsAzrina | 2 | GS Azrina!A2:D | b2b_sales | all rows | b2b_sales = row[2] |

---

## D. Scheduler (app/Console/Kernel.php, app-default timezone)

| Time | Command | Notes |
|---|---|---|
| 00:01 | sales:create | withoutOverlapping — builds sales + sales_by_channels from orders, all tenants, month-to-date |
| 00:02 | marketing:create | withoutOverlapping |
| 14:00 | import:visit | importVisitCleora + importVisitAzrina + updateMonthlyVisitData |
| 14:30 | google-sheet:import | importFromGoogleSheet + updateMonthlyAdSpentData |
| 10:00 | report:send-telegram | Daily Telegram sales report |
| DISABLED | orders:fetch-external | commented out — was cron '0 9,12,17,19,21,3,6 * * *' Asia/Jakarta |

NOT scheduled (UI-triggered GET endpoints): all marketplace order syncs,
all net-profit update-* recompute, importAdsAzrina, importNetProfits*.

(Campaign-related, not sales — for context only: data:scrap 04:00,
data:scrap-contest 05:00, statistic:campaign-recap 05:30,
campaign:refresh-contents 03:00, update:report-count 09:58)

---

## E. Tenant ID → brand + sales-channel IDs

| Tenant ID | Brand |
|---|---|
| 1 | Cleora |
| 2 | Azrina |
| 3 | Delmoura |

| sales_channel_id | Channel |
|---|---|
| 1 | Shopee |
| 2 | Lazada |
| 3 | Tokopedia |
| 4 | TikTok Shop |
| 8 | Shopee 2 (Cleora 2nd account) |
| 9 | Shopee 3 (Cleora 3rd account) |
| 11 | (unnamed marketplace, ad-spent col V) |

| social_media_id | Platform |
|---|---|
| 1 | Facebook/Meta |
| 5 | Google Ads |
| 9 | (unnamed) |
| 10 | (unnamed; excluded in Azrina ad-spent rollup) |

---

## F. Warnings  ✅ complete (verbatim)

> These three must be resolved **before** the pipeline is reimplemented in the
> new app.

1. **Column-T conflict (Cleora).** `updateSpentKol` **AND** `updateB2bAndCrmSales`
   both read `row[19]` (column T). **Needs manual verification of the source
   sheet** to determine which consumer is correct (or whether the column is
   genuinely shared).

2. **`importNetProfits` Cleora reads from the Azrina spreadsheet ID.** The Cleora
   NetProfit import path points at the **Azrina** sheet
   (`SHEET_AZRINA_NETPROFIT` = `1sDhPAvqXkBE3m2n1yt2ghFROygTxKx1gLiBnUkb26Q0`).
   **Verify intent** — this is either a deliberate shared source or a
   copy-paste bug carried over from the old app.

3. **`updateB2bAndCrmSales` relies on implicit spreadsheet state.** It depends on
   the active/last-opened spreadsheet rather than an explicit ID. **This must be
   made explicit in the new app** (pass the target spreadsheet ID directly — no
   implicit `getActiveSpreadsheet()`-style state).

---

## G. Ad-spent / Visit import column maps (0-based)

parseCurrencyToInt = (int) str_replace(['Rp','.',','], '', v)

### importFromGoogleSheet — Cleora t1, SHEET_CLEORA_IMPORT, range 'Import Sales!A2:V', last 40 days

- date: row[0] (d/m/Y)
- ad_spent_market_places: ch4=row[8], ch1=row[10], ch3=row[11],
  ch2=row[12], ch8=row[13], ch9=row[14], ch11=row[21]
- ad_spent_social_media: sm1=row[9], sm9=row[15], sm10=row[16], sm5=row[20]
- upsert_key: date + (sales_channel_id|social_media_id) + tenant_id

### importAdsAzrina — t2, SHEET_AZRINA_ADS, range 'Import Azrina!A2:L'

- date: row[0]
- ad_spent_market_places: ch1=row[9], ch3=row[10], ch2=row[11], ch4=row[7]
- ad_spent_social_media: sm1=row[8]

### importVisitCleora — t1, SHEET_CLEORA_IMPORT, range 'Import Sales!A2:H' → visits.visit_amount

- date: row[0]
- channels: ch1=row[2], ch2=row[4], ch3=row[5], ch4=row[3]

### importVisitAzrina — t2, SHEET_AZRINA_ADS, range 'Import Azrina!A2:G'

- date: row[0]
- channels: ch1=row[3], ch2=row[5], ch3=row[6], ch4=row[4]

### updateMonthlyAdSpentData (Sales table, not NetProfit)

Per day (last 40):
- sales.ad_spent_social_media = Σ ad_spent_social_media.amount
- sales.ad_spent_market_place = Σ ad_spent_market_places.amount
- sales.ad_spent_total = sum of both
- sales.roas = turnover / ad_spent_total
- Azrina twin excludes social_media_id != 10 and sales_channel_id != 9
- updateMonthlyVisitData: sales.visit = Σ visits.visit_amount (both tenants)

---

### Migration checklist (derived from this config)
- [x] Fill every extraction block (B/C/D/E/G) from the old-app extraction.
- [ ] Resolve Warning #1 (column-T conflict): Cleora `updateSpentKol` reads row[19] as `spent_kol` while `updateB2bAndCrmSales` reads row[19] as `crm_sales` — verify the source sheet to confirm which consumer column T actually feeds.
- [ ] Resolve Warning #2 (Cleora→Azrina NetProfit source): `importNetProfits` (tenant 1) reads sheet `1LGA…` (Azrina ads) — confirm intent or repoint.
- [ ] Resolve Warning #3 — replace implicit spreadsheet state in `updateB2bAndCrmSales` with an explicit ID.
- [ ] Verify inferred purposes in Section A against the extraction (e.g. `SHEET_AZRINA_ADS` feeds both ads + visit imports; `SHEET_CLEORA_IMPORT` feeds ads, visit, and NetProfit recompute).
- [ ] Reconcile channel/SM IDs (E) with the new-app schema (`SalesChannel`, `AdSpent*`) — old app uses numeric IDs 1/2/3/4/8/9/11 and SM 1/5/9/10.
