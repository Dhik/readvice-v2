# Market Basket — Data Sources & Honesty Map

> **100% REAL — nothing fabricated. The honesty here is about SAMPLE SIZE, not dummy data.**
>
> Product co-purchase pairs (which SKUs appear together in the same order) are derived
> straight from real `OrderItem` data; support / confidence / lift are computed from real
> counts. Every engine response carries `dummy: false`.
>
> **The caveat: the sample is thin.** Only **multi-item orders** (≥2 distinct SKUs) produce
> pairs, and that count is small. The engine surfaces **`multiItemOrderCount`** and a
> **`smallSample`** flag so the lifts aren't over-trusted. This is the **cross-product
> relationship** lens — it does **NOT** rebuild SP1's per-SKU revenue/Pareto.

---

## 1. Source map (all REAL)

The engine (`lib/analytics/basket-summary.js`) reads `OrderItem ⋈ Order` (excl. cancelled
via `EXCLUDED_STATUSES`), tenant-scoped, Decimal/BigInt → Number. **No model, no seeder.**

| Quantity | Source / formula | Status |
|---|---|---|
| Order → SKU sets | `DISTINCT order_id, sku` (real-sales) | ✅ REAL |
| Per-SKU order count (support of A) | `COUNT(DISTINCT order_id)` containing the SKU | ✅ REAL |
| SKU name / revenue (node sizing) | `Product.name` → `OrderItem.productName` fallback; `SUM(subtotal)` | ✅ REAL (SP1 naming reuse) |
| **Pair co-occurrence** | count of orders containing both A and B (a<b, multi-item orders) | ✅ REAL |
| **Support(A,B)** | `cooccur / totalOrders` | ✅ REAL |
| **Confidence(A→B)** | `cooccur / orders(A)` = P(B\|A) | ✅ REAL |
| **Lift(A,B)** | `cooccur × totalOrders / (orders(A) × orders(B))` | ✅ REAL (>1 = positive association) |

---

## 2. Data reality — REAL but SMALL-SAMPLE (tenant 2)

`OrderItem` exists only for tenant 2 (Cleora). Other tenants → **`hasData:false`** (no error).

| Fact | Value |
|---|---|
| Orders with items (basket universe) | **606** |
| **Multi-item orders (≥2 SKUs — the pair source)** | **25** ⚠ |
| …of which 2-SKU / 3-SKU / 4-SKU | 21 / 2 / 2 |
| Single-SKU orders (produce NO pairs) | 513 |
| **Distinct co-purchase pairs** | **34** |
| Top pairs' co-occurrence | mostly **2 orders**, then 1 |

**Honesty rules the engine enforces:**
- **`multiItemOrderCount` is surfaced prominently** — it's the denominator that matters
  (25, not 606). With 513 single-SKU orders, most of the catalog produces no pairs.
- **`smallSample: true`** when `multiItemOrderCount < 50` (currently 25 → flagged), with a
  note: "REAL but SMALL-SAMPLE; treat lifts as directional, not reliable."
- **No padding** — if pairs are few, they're shown as-is; nothing is fabricated to fill the
  network/matrix. A sparse graph is the honest result.
- Top pair by lift can have a high lift off tiny counts (e.g. 2 co-occurrences of two
  rarely-sold SKUs) — the small-sample flag is the guard against over-reading it.
- Fresh/empty/other tenant → `hasData:false`, graceful.

---

## 3. How it gets richer — more data, no fabrication

Like cohort retention (and unlike the dummy modules), this is **real today and improves
with data** — **no connector, no seeder, no backfill of fake pairs:**
- as **OrderItem coverage expands** (more tenants/periods carry line items — see the
  connector backlog **CS5b**), `multiItemOrderCount` grows and `smallSample` clears,
- support/confidence/lift sharpen automatically — the engine shape never changes,
- the network graph and affinity matrix densify on their own.

It's the "real but needs volume" case: trustworthy method, thin sample, self-healing as
the catalog accumulates baskets.

---

## 4. Engine API (`lib/analytics/basket-summary.js`)

Tenant-scoped (effectively tenant 2); `dummy: false`; `hasData:false` elsewhere:

| Function | Feeds | Returns |
|---|---|---|
| `getBasketOverview` | KPIs | total orders, **`multiItemOrderCount`**, distinct pairs, top pair by lift, **`smallSample`** |
| `getAffinityPairs({minCooccur})` | **network graph + matrix heatmap** | pairs (support/confidence×2/lift, ranked by lift) + nodes (SKU, orders, revenue) |
| `getProductAffinity(sku)` | "bought X also bought Y" | one SKU's partners ranked by confidence |
| `getBasketDetail({limit})` | transparency | the actual multi-item orders behind the pairs |

**Not duplicated:** SP1's per-SKU revenue/Pareto — this is purely the co-purchase
relationship view.
