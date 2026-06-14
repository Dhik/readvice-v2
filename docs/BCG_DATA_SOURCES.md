# BCG Product Matrix — Data Sources & Honesty Map

> **⚠️ READ THIS BEFORE TRUSTING ANY QUADRANT POSITION.**
>
> The BCG Product Matrix (`/admin/bcg_metrics` replica) plots SKUs on two axes:
> **Traffic × Conversion** and **CTR × Conversion**. In the new app (dev),
> **both axes' raw inputs — `visitor` and `ctr` — are DUMMY (fabricated)**. So is
> `jumlahAtc`, `biayaAds`, and `omsetPenjualan`. That means:
>
> **The quadrant a SKU lands in (Star / Cash Cow / Question Mark / Dog) is
> FICTIONAL.** `conversion = buyers / visitor` and `ctr` are both built on
> invented numbers. Only **revenue, units sold, price, and stock are real.**
>
> Every dev row carries `source = 'DUMMY'`. The engine surfaces a `dummy: true`
> flag on every response so the UI can badge positions as not-real. Do not make
> merchandising decisions from dev quadrant positions.

---

## 1. Field-by-field real vs dummy

Table: `bcg_product` (model `BcgProduct`). Per-tenant, per-month (1st-of-month),
per-sku. Seeded by `scripts/seed-dev-bcg.cjs` (tenant 2 only).

> **Data-availability note (dev):** the seeder targets the **3 most-recent months
> that actually have SKU-level (`OrderItem`) data**. Tenant 2's `OrderItem` rows
> exist **only for 2026-06** today — its Jan/Feb orders carry **no line items** —
> so the seed currently produces **1 month (2026-06), 42 SKUs**, not 3. The matrix
> is per-SKU and `sales`/`qty` must be real, so months with orders-but-no-line-items
> are skipped rather than fabricated. As more `OrderItem` data lands, the seeder
> auto-extends to 3 months with no code change.

| Field | Status | Real source (new app) | Notes |
|---|---|---|---|
| `sku` | ✅ **REAL** | `OrderItem.sku` (raw, SP1/HPP basis) | grouping key |
| `namaProduk` | ✅ **REAL** | `Product.name` (fallback `OrderItem.productName`) | catalog name |
| `kodeProduk` | ⚠️ derived | = `sku` | no parent product-code column exists yet |
| `qtySold` | ✅ **REAL** | `SUM(OrderItem.qty)` for sku/month (excl. cancelled/unpaid) | same exclusion list as HPP |
| `sales` | ✅ **REAL** | `SUM(OrderItem.subtotal)` for sku/month | BigInt → Number at boundary |
| `harga` | ✅ **REAL** | `Product.price` | rounded to Int |
| `stock` | ✅ **REAL** | `Product.stock` | point-in-time catalog stock |
| `jumlahPembeli` | 🟡 **SEMI-real** | `COUNT(DISTINCT OrderItem.order_id)` | "buyers" ≈ distinct orders containing the SKU. Real count, but used as numerator over a **dummy** `visitor` denominator → conversion is still fictional. |
| `visitor` | ❌ **DUMMY** | *none* | sized so `buyers/visitor` ∈ 0.5–5%. **Matrix X-axis (Traffic).** |
| `jumlahAtc` | ❌ **DUMMY** | *none* | between buyers and visitor |
| `biayaAds` | ❌ **DUMMY** | *none* | sized so ROAS = omset/ads ∈ 1–4× |
| `omsetPenjualan` | ❌ **DUMMY** | *none* | anchored ±15% to real `sales` |
| `ctr` | ❌ **DUMMY** | *none* | 0.5–3%. **Matrix X-axis (CTR matrix).** |
| `strategyNotes` | — | user/AI input | null in seed |
| `actionItems` | — | user/AI input | null in seed |
| `source` | system | `'DUMMY'` (seed) / connector name (real) | the swap flag |

### What this means for each derived metric (`lib/analytics/bcg-summary.js`)

| Metric | Trustworthy? | Because |
|---|---|---|
| `sales`, `qtySold`, `harga`, `stock`, `stockTurnover` | ✅ real | built only from real fields |
| `revenuePerVisitor` | ❌ | divides real sales by **dummy** visitor |
| `conversion`, `atcRate`, `purchaseRate` | ❌ | depend on dummy visitor/atc |
| `roas` | ❌ | omset & ads both dummy |
| `quadrant` (Traffic×Conv) | ❌ **FICTIONAL** | both axes dummy |
| `ctrQuadrant` (CTR×Conv) | ❌ **FICTIONAL** | both axes dummy |
| `score` (0–100) | ❌ | blends conversion/roas/ctr (all dummy) with turnover (real) |

**Bottom line:** the matrix renders and behaves exactly like the old app, but in
dev it is a *shape demo*. The only panels you can trust are the ones reading
`sales / qtySold / harga / stock`.

---

## 2. Quadrant formulas (for reference)

Implemented verbatim in `bcg-summary.js`.

- `conversion_rate = buyers / visitor × 100`
- `atc_rate = atc / visitor × 100`, `purchase_rate = buyers / atc × 100`
- `roas = omset / ads`, `revenue_per_visitor = sales / visitor`,
  `stock_turnover = qty / stock`
- **Benchmark conversion by price** (`benchmarkConversion(harga)`):
  `<75k → 2.0%`, `<100k → 1.5%`, `<125k → 1.0%`, `<150k → 0.8%`, `≥150k → 0.6%`
- **Traffic × Conversion:** `highTraffic = visitor ≥ median(visitor of grouped SKUs)`,
  `highConv = conversion ≥ benchmark(harga)` →
  Star (hi/hi) · Cash Cow (lo/hi) · Question Mark (hi/lo) · Dog (lo/lo)
- **CTR × Conversion:** `ctr > 1%` × `conversion > 1%` →
  Star (hi/hi) · Potensi (hi-ctr/lo-conv) · Cash Cow (lo-ctr/hi-conv) · Dog (lo/lo)
- **Performance score (0–100):** `40·conv-vs-benchmark + 30·roas + 20·turnover + 10·ctr`
  (each term capped; see §2.3 of the engine).

---

## 3. Connector blueprint — how real data fills the dummy fields

The old app imported BCG data from **one Google Sheet**
(`1MnY6beeJjZIJ_lMWytdPb6shLlX7gkselbynkRfELbE`) across **three tabs**. A future
**`bcg_sync`** connector (following the existing `lib/connectors/sync-engine.js`
pattern + `DataConnector` model) drops in to replace the dummy rows: it writes to
the **same `bcg_product` table** with `source = 'bcg_sync'` (i.e. `!= 'DUMMY'`),
so `scripts/clear-dev-bcg.cjs` wipes only dummy and the real rows take over via
the source flag — zero schema change.

### 3.1 Sheet → field mapping (per tab)

**Tab `DATA PRODUCT`** → traffic & sales funnel
| Sheet column | → `BcgProduct` field | Transform |
|---|---|---|
| Kode Produk | `kodeProduk` | trim |
| Nama Produk | `namaProduk` | trim |
| SKU | `sku` | trim |
| Visitor (Kunjungan) | `visitor` | int |
| Jumlah ATC / Dimasukkan ke Keranjang | `jumlahAtc` | int |
| Jumlah Pembeli / Pesanan Siap Dikirim | `jumlahPembeli` | int |
| Produk Terjual (Qty) | `qtySold` | int |
| Penjualan (Sales) | `sales` | decimal→bigint |

**Tab `DATA STOCK`** → catalog
| Sheet column | → `BcgProduct` field | Transform |
|---|---|---|
| SKU | `sku` (join key) | trim |
| Harga | `harga` | decimal→int |
| Stock | `stock` | int |

**Tab `IKLAN SHOPEE`** → ad performance
| Sheet column | → `BcgProduct` field | Transform |
|---|---|---|
| SKU / Nama Produk | `sku` (join key) | trim |
| Biaya (Ads) | `biayaAds` | decimal→int |
| Omzet Penjualan (Iklan) | `omsetPenjualan` | decimal→int |
| CTR | `ctr` | percent→float |

### 3.2 Connector shape (DataConnector)

A `bcg_sync` connector is **multi-tab**: it merges three tabs into one
`bcg_product` row per `(tenantId, date, sku)`. Two implementation options:

1. **Three connectors, one target** — one `DataConnector` per tab (each its own
   `sheetTab` + `columnMapping`), all `targetTable = 'bcg_product'`,
   `upsertKey = ['tenantId','date','sku']`. The engine **upserts** so later tabs
   fill more columns of the same row. Simplest; reuses the engine as-is plus a
   `bcg_sync` dispatch branch.
2. **One connector, multi-tab config** — extend `DataConnector` semantics so
   `sheetTab`/`columnMapping` accept a per-tab array; the engine fetches all three,
   joins on `sku`, and writes once. Cleaner config, more engine work.

Either way:
```
connectorType : 'bcg_sync'
spreadsheetId : '1MnY6beeJjZIJ_lMWytdPb6shLlX7gkselbynkRfELbE'
sheetTab      : 'DATA PRODUCT' | 'DATA STOCK' | 'IKLAN SHOPEE'
targetTable   : 'bcg_product'
upsertKey     : ['tenantId','date','sku']
staticValues  : { source: 'bcg_sync', date: <1st-of-month for the import period> }
columnMapping : <per §3.1 above>
```
- **Transforms** reuse `lib/connectors/transforms.js` (`int`, `decimal`,
  `percent`, `trim`, `static`). Add `bigint` for `sales` if not present.
- **Tenant-scoped:** `tenantId` comes from connector context (never the sheet),
  exactly like `order_sync` / `product_sync`. Every write is `WHERE tenantId = …`.
- **`date`** is the import period's 1st-of-month, supplied via `staticValues`
  (the sheet is a monthly snapshot).
- **Source swap:** real rows write `source != 'DUMMY'`. `clear-dev-bcg.cjs`
  (`deleteMany WHERE source='DUMMY'`) removes only the seed; the engine then
  owns the table. No migration, no code change in `bcg-summary.js`.

### 3.3 Field-list registration

When the connector ships, add `BcgProduct` to `lib/connectors/field-lists.js`:
```
BcgProduct: ['kodeProduk','namaProduk','sku','visitor','jumlahAtc',
             'jumlahPembeli','qtySold','sales','harga','stock',
             'biayaAds','omsetPenjualan','ctr']
```
(`id`, `tenantId`, `date`, `source`, `createdAt` excluded — context/auto/static.)

---

## 4. Dev workflow

```bash
node scripts/seed-dev-bcg.cjs    # populate tenant 2, recent months with OrderItem data (idempotent)
node scripts/clear-dev-bcg.cjs   # remove all source='DUMMY' rows (every tenant)
```

`db push` (not migrate) was used to create the table, matching the Visit/AdSpend
foundation. New tenants start empty — the engine returns empty results, no error.
