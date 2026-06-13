# Sales & Orders Modules — Implementation Documentation

## Overview

The **Sales** and **Orders** modules are two views over a single underlying data store — the `Order` table. There is **no separate "sales" table**:

- **Orders** (`/orders`) is the transactional list view — every order row with customer details and a free-text search.
- **Sales** (`/sales`) is the analytics view — the same order rows plus an aggregated KPI strip (GMV, Nett, Orders, Qty, Avg Order) and a chart panel.

Both are scoped per tenant (`tenantId` from the NextAuth session) and read e-commerce order data ingested from marketplace exports (Shopee, TikTok, Lazada, Tokopedia) via file upload or Google Sheets sync.

---

## Route Structure

| Route | Page Component | Description |
|---|---|---|
| `/sales` | `SalesPage` | Analytics view — KPI strip + chart + table, platform/month filters, import & GSheet sync |
| `/orders` | `OrdersPage` | Transactional list — table with customer columns, platform/month filters + text search |

Both page files are **client components** (`'use client'`) that fetch from the API on mount and on filter change.

---

## File Map

```
app/(dashboard)/
  sales/page.jsx        ← SalesPage  (KPI + chart + table)
  orders/page.jsx       ← OrdersPage (searchable table)

app/api/
  sales/route.js              ← GET  list orders (paginated, date-range capable)
  sales/summary/route.js      ← GET  aggregate totals (gmv/nett/qty/count)
  orders/route.js             ← GET  list orders (paginated, text search)
  import/orders/route.js      ← POST XLSX upload → upsert orders
  import/gs/orders/<tenant>-<platform>/route.js
                              ← GET  Google Sheets sync per tenant+platform (15 routes)

lib/
  utils.js                    ← formatCurrency / formatNumber / formatDate /
                                getMonthRange / currentMonth
  google-sheets.js            ← getSheetRows / rowsToObjects (used by GS sync)
```

Shared UI components: `components/ui/KpiStrip`, `components/table/DataTable`, `components/charts/ChartPanel`, `components/ui/ImportModal`, `components/ui/SyncButton`.

---

## Data Model

Both modules read the **`Order`** model ([prisma/schema.prisma](../prisma/schema.prisma)):

| Field | Type | Notes |
|---|---|---|
| `id` | `Int` PK | autoincrement |
| `tenantId` | `Int` | `@map("tenant_id")` — tenancy scope |
| `platform` | `String` | `Shopee` / `TikTok` / `Lazada` / `Tokopedia` / `Manual` |
| `orderId` | `String?` | marketplace order number (`@map("order_id")`) |
| `orderDate` | `DateTime` | drives month/date-range filters |
| `status` | `String?` | marketplace order status |
| `gmv` | `Decimal(15,2)?` | gross merchandise value |
| `nett` | `Decimal(15,2)?` | net / paid amount |
| `qty` | `Int?` | default `0` |
| `skuCount` | `Int?` | default `0` (`@map("sku_count")`) |
| `customerId` / `customerName` / `customerUsername` | `Int?` / `String?` / `String?` | buyer info |
| `createdAt` / `updatedAt` | `DateTime` | timestamps |

**Constraints & indexes:**
- `@@unique([orderId, tenantId])` — composite key `orderId_tenantId`, the upsert target for all ingestion.
- `@@index([tenantId, platform, orderDate])` — backs the filtered/sorted list queries.

> **`OrderItem`** exists in the schema (line-item detail with `productId`, `qty`, `price`, `subtotal`) and relates to `Order`, but **neither module currently reads or writes it** — ingestion only populates `Order` header rows. It's available for a future line-item view.

---

## API Reference

All three GET routes require a session (`401 Unauthorized` otherwise) and scope every query by `session.user.tenantId`.

### `GET /api/sales`
List orders for the analytics table.

| Query param | Default | Effect |
|---|---|---|
| `page` | `1` | pagination |
| `limit` | `25` | page size |
| `platform` | — | exact-match filter |
| `month` | — | `YYYY-MM`; converted via `getMonthRange` → `{ gte, lt }` |
| `startDate` + `endDate` | — | explicit range (`gte`/`lte`) — **supported by the API but not surfaced in the Sales UI**, which only sends `month` |

Returns `{ data, total, page, limit }`, ordered `orderDate desc`. Uses a `$transaction([count, findMany])`.

### `GET /api/sales/summary`
Aggregates over the same filter set (`platform`, `month`):

```json
{ "total_gmv": 0, "total_nett": 0, "total_qty": 0, "total_orders": 0 }
```
Backed by `prisma.order.aggregate({ _sum: { gmv, nett, qty }, _count: { id } })`. `Decimal` sums are coerced to `Number`.

### `GET /api/orders`
List orders for the transactional table. Same params as `/api/sales` **minus** `startDate/endDate`, **plus**:

| Query param | Effect |
|---|---|
| `search` | case-insensitive `OR` across `orderId`, `customerName`, `customerUsername` |

Returns `{ data, total, page, limit }`, ordered `orderDate desc`.

---

## Data Ingestion

### File upload — `POST /api/import/orders`
Accepts a multipart `file` (XLSX, parsed with `xlsx`) and a `platform` field. `mapOrderRow(row, platform)` translates each platform's column headers into the `Order` shape:

| Platform | Order ID column | Date column | GMV / Nett columns |
|---|---|---|---|
| `shopee` | `No. Pesanan` | `Waktu Pembayaran Escrow` | `Total Harga Produk` / `Total Pembayaran` |
| `tiktok` | `Order ID` | `Order Creation Time` | `Total Product Price` / `Order Amount` |
| `lazada` | `Order ID` | `Created at` | `Unit Price` / `Paid Price` |
| `tokopedia` | `No Invoice` | `Tanggal Pembayaran` | `Harga Produk` / `Jumlah` |
| _default_ | `order_id` | now() | `gmv` / `nett` |

Each mapped row is **upserted** on `orderId_tenantId` (rows with no `orderId` are skipped). Returns `{ created, updated, errors }`.

> Note: the handler increments `created` on every successful upsert, so **`updated` is always `0`** even when an existing row is overwritten — the counter doesn't distinguish insert from update.

### Google Sheets sync — `GET /api/import/gs/orders/<tenant>-<platform>`
15 hardcoded routes (e.g. `cleora-shopee`, `azrina-tiktok`, `delmoura-shopee`). Each pins a `SPREADSHEET_ID` (from env), `TENANT_ID`, and `PLATFORM`, reads rows via `getSheetRows` + `rowsToObjects`, and upserts on `orderId_tenantId`. Returns `{ imported: count }`.

> Note: the current `cleora-shopee` route is a **thin stub** — it upserts only `orderId` + `platform` (+ `orderDate = now()` on create) and does **not** map `gmv`/`nett`/customer fields. The GS sync path is partial compared to the XLSX importer.

The Sales page's "Sync GSheet" button is wired specifically to `/api/import/gs/orders/cleora-shopee`.

---

## UI Behaviour

### Sales page (`SalesPage`)
- **Filters:** platform tab-pills (`All / Shopee / TikTok / Lazada / Tokopedia`) + `<input type="month">` (defaults to `currentMonth()`). Changing either resets to page 1.
- **Data load:** on `[platform, month, page]` change, fetches `/api/sales` and `/api/sales/summary` in parallel.
- **KPI strip (5 tiles):** GMV, Nett, Orders, Total Qty, and **Avg Order** (computed client-side as `total_gmv / total_orders`).
- **Table columns:** Date, Platform, Order ID, GMV, Nett, Qty, Status.
- **Chart panel:** a line chart of GMV for the **first 10 rows** of the current page.

  > The accompanying donut chart uses **hardcoded placeholder data** (`[45, 35, 20]` for Shopee/TikTok/Lazada) — it is not derived from real platform splits.
- **Import:** `ImportModal` → `/api/import/orders?platform=…` (defaults to `shopee`).

### Orders page (`OrdersPage`)
- **Filters:** same platform tab-pills + month picker, **plus a search box** (order ID / customer / username). All filter changes reset to page 1.
- **Data load:** single fetch to `/api/orders` on `[platform, month, search, page]`.
- **Table columns:** Date, Platform, Order ID, **Customer, Username**, GMV, Nett, Qty, Status. (No KPI strip or chart — purely transactional.)
- **Import:** `ImportModal` → `/api/import/orders` with `platform` as an extra field.

---

## Shared Helpers (`lib/utils.js`)

| Helper | Behaviour |
|---|---|
| `formatCurrency(v)` | `Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 })` |
| `formatNumber(v)` | `Intl.NumberFormat('id-ID')` |
| `formatDate(d)` | `dd Mon yyyy` (id-ID locale) |
| `getMonthRange('YYYY-MM')` | `{ gte: firstOfMonth, lt: firstOfNextMonth }` — half-open range used by all month filters |
| `currentMonth()` | current `YYYY-MM` string (default filter value) |

---

## Security & Tenancy

- Every API route calls `getServerSession(authOptions)` and returns `401` when unauthenticated.
- All queries (list, summary, import upsert, GS sync) are filtered/keyed by `tenantId`, so a tenant only ever sees or writes its own orders.
- The composite unique `orderId_tenantId` means the same marketplace order number can exist across tenants without collision, and re-imports are idempotent per tenant.

---

## Current Limitations / Notes

1. **Sales = aggregated Orders.** No dedicated sales table; the two pages differ only in presentation and the search-vs-summary split.
2. **Read-only API.** No `POST/PUT/DELETE` for individual orders and no order-detail route; the only write path is the import/upsert flow.
3. **`OrderItem` unused.** Line-item schema exists but is never populated or displayed.
4. **Sales donut chart is placeholder** (hardcoded 45/35/20).
5. **`/api/sales` date-range params** (`startDate`/`endDate`) are implemented server-side but not exposed in the UI.
6. **GS sync is partial** — only writes `orderId`/`platform`; financial fields come only through the XLSX importer.
7. **Import `updated` counter** always reports `0`.
