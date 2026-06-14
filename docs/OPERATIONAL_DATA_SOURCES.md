# Operational — Data Sources & Honesty Map

> **A MIXED module — REAL by section, with one fabricated slice. Honesty is PER-SECTION.**
>
> - ✅ **REAL** (`dummy:false`): **status funnel**, **cancellation trend**, **stock
>   velocity** — all computed live from `Order` / `OrderItem` / `Product`.
> - ❌ **DUMMY** (`dummy:true`): **fulfilment time** (processing / shipping / total days) —
>   `Order` has **no per-status-transition timestamps**, so this is fabricated
>   (`OrderFulfillment`, `source='DUMMY'`).
>
> The page bands/badges the fulfilment section (orange, Talent-ROI style) and leaves the
> real sections plain. This is the **operational-EFFICIENCY** lens (funnel flow, inventory
> action-classification, cancellation trend, fulfilment timing) — it does **NOT** rebuild
> the dashboard/SP2 order-status breakdowns.

---

## 1. Section-by-section source map

| Section | Source | Status |
|---|---|---|
| **Status funnel** | `Order.status` bucketed into stages (`classifyStage`) | ✅ **REAL** |
| **Cancellation trend** | cancelled ÷ total per month (`Order.status` + `order_date`) | ✅ **REAL** |
| **Stock velocity** | `SUM(OrderItem.qty)` (excl. cancelled) × `Product.stock` × `SUM(subtotal)` | ✅ **REAL** (stock turnover = qty÷stock — **reuses BCG's formula**, real inputs) |
| **Fulfilment time** | `OrderFulfillment.{processing,shipping,total}Days` | ❌ **DUMMY** (no timestamps) |

### Status → stage buckets (`classifyStage`, REAL)
Real `Order.status` values (mixed ID/EN) map to a pipeline; order of checks matters
(cancel first, processing before shipped):
| Stage | Matches (case-insensitive) | t2 count |
|---|---|---|
| Pending | `pending`, `belum bayar`/unpaid | 161 |
| Processing | `perlu dikirim`, processing, diproses, siap dikirim | 36 |
| Shipped | `sedang dikirim`, `telah dikirim`, dikirim, shipped, pengiriman | 501 |
| Delivered | `completed`, selesai, delivered, diterima | 414 |
| **Cancelled** (drop-off) | `cancelled`, `batal`, dibatalkan, pembatalan, request_return | 194 |
| **Total** | (sums to all orders) | **1306** |

---

## 2. Data reality (tenant 2)

| Fact | Value |
|---|---|
| Orders | **1306** (funnel sums to this incl. Cancelled) |
| Cancellation rate | **194 / 1306 ≈ 14.9%** (real) |
| Order months | Jan / Feb / Jun 2026 (thin → trend note) |
| **`Product.stock`** | **0 for ALL SKUs** (real value, but stock not tracked yet) |
| Fulfilment rows | **951** (fulfilling orders only — DUMMY) |

### ⚠ Stock is real but unpopulated (all 0)
`Product.stock = 0` for every SKU — this is the **real value**, just not yet tracked. The
engine handles it honestly (like gross-margin's HPP coverage):
- `stockTurnover = qty ÷ stock` is **guarded → `null`** when stock = 0 (never ∞/NaN).
- the velocity quadrant's x-axis is **units sold** (always meaningful); y is stock level.
- with stock all-0, every sold SKU classifies **Reorder** (high demand) or **Discontinue?**
  (low demand); `Healthy`/`Overstock` need stock > 0.
- `stockCoveragePct` (SKUs with stock > 0) is surfaced — **0% today**, with a note. Populate
  `Product.stock` → the full 4-way classification works, no engine change.

---

## 3. Data-plumbing path — fulfilment DUMMY → real

The only fabricated slice. `Order` records a single `status` + `orderDate`/`updatedAt`,
**not the timestamp of each transition**, so processing/shipping durations can't be derived.

**Fix:** an **`OrderStatusHistory`** table (one row per status transition, populated by
future order syncs: `orderId`, `status`, `changedAt`). A recompute job then derives
processing = (shipped − paid), shipping = (delivered − shipped), total = (delivered − placed),
and writes them to `order_fulfillment` with **`source!='DUMMY'`** — the engine reads the
same shape, **zero change** (the BCG/RFM/Talent source-flag swap). Until then, fulfilment
stays dummy and is flagged everywhere. **Not an external connector** — internal plumbing +
recompute, like RFM/Talent ROI.

(Stock velocity needs no plumbing — it's already real; it just needs `Product.stock`
populated by product sync to become fully informative.)

---

## 4. Dev workflow

```bash
node scripts/seed-dev-fulfillment.cjs    # tenant 2: DUMMY fulfilment time, fulfilling orders only (idempotent)
node scripts/clear-dev-fulfillment.cjs   # remove source='DUMMY' (Orders untouched)
```

`db push` (not migrate) created `order_fulfillment`, matching the BCG/RFM/Talent foundations.

---

## 5. Engine API (`lib/analytics/operational-summary.js`)

Tenant-scoped; REAL sections `dummy:false`, fulfilment `dummy:true`:

| Function | Section | Returns |
|---|---|---|
| `getOperationalOverview` | mixed | `real{}` (orders, cancellation rate, stock-velocity counts, stock coverage) + `fulfillment{}` (dummy avg days) |
| `getStatusFunnel` | REAL | stage counts (Pending→Processing→Shipped→Delivered) + Cancelled drop-off, sums to total |
| `getCancellationTrend` | REAL | cancellation rate per month (+ thin-history note) |
| `getStockVelocityQuadrant` | REAL | per-SKU units-sold × stock, bubble = revenue, 4 action buckets, `stockCoveragePct` + note |
| `getFulfillmentDistribution` | **DUMMY** | histogram bins of total days + processing/shipping averages |
| `getProductStockDetail(sku)` | REAL | one SKU's stock/turnover/classification + sales history |
| `getFulfillmentDetail(orderId)` | mixed | order's `real{}` status/stage/date + `fulfillment{}` dummy durations |

**Not rebuilt:** dashboard / SP2 order-status breakdowns (this is the efficiency lens).
