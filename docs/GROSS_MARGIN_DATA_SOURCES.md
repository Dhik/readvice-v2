# Finance — Gross Margin — Data Sources & Honesty Map

> **How real is this? 100% real — and it is GROSS margin ONLY.**
>
> Gross margin = **real revenue** (`Order`/`OrderItem`) − **real COGS** (`DailyHpp`
> frozen HPP). Both sides are already real and verified (NP2b). Each engine response
> carries `dummy: false`.
>
> **The critical caveat is the word GROSS.** This is **NOT net profit.** Operating
> costs, platform/payment fees, taxes, returns, and **marketing spend are NOT
> deducted.** Those require configurable business rules → **Wave 3 Net P&L**, which the
> project **deliberately deferred** (the old app's net-profit formula was
> Cleora-specific and not credible as a general SaaS metric). Marketing spend may be
> shown **alongside** as a separate context line, but is **never silently subtracted**
> into a fake "net" number.

---

## 1. Field-by-field source map (all REAL)

The engine (`lib/analytics/gross-margin-summary.js`) **reuses the HPP engine**
(`lib/hpp/compute-hpp.js`) — it does **not** reimplement HPP. Tenant-scoped,
Decimal/BigInt → Number.

| Quantity | Source | Status |
|---|---|---|
| **Revenue** | `SUM(OrderItem.subtotal)` ⋈ `Order` (excl. cancelled via `EXCLUDED_STATUSES`) | ✅ **REAL** |
| **COGS / HPP** | `SUM(DailyHpp.hpp)` — frozen snapshot (`getDailyHpp` / `getDailyHppTotalsByDate`) | ✅ **REAL** |
| **Gross profit** | `revenue − HPP` | ✅ real arithmetic |
| **Gross margin %** | `grossProfit / revenue × 100` | ✅ real (can be negative if cost > price — kept, not clamped) |
| SKU name | `Product.name` → `OrderItem.productName` fallback | ✅ real |
| Units (qty) | `SUM(OrderItem.qty)` / `DailyHpp.qty` | ✅ real |
| `hasCost` | `Product.hargaCogs IS NOT NULL` | ✅ real (drives coverage) |

SKU join: `OrderItem.sku` (raw) is aligned to `DailyHpp.sku` (normalized) via
`normalizeSku` from the HPP engine — correct even if future SKUs carry a numeric prefix.

### What is NOT included (and why) — never computed as "net"
| Excluded | Why |
|---|---|
| Operating costs (opex) | needs a per-tenant config — Wave 3 |
| Platform / payment fees | needs fee rules per channel — Wave 3 |
| Taxes | needs tax config — Wave 3 |
| Returns / refunds beyond status exclusion | needs returns data modeling — Wave 3 |
| **Marketing / ad spend** | shown as **separate context** only — **NOT deducted** (see §3) |

---

## 2. Data reality — coverage, Cleora-only, thin history

Tenant 2 (the only tenant with `OrderItem`):

| Fact | Value |
|---|---|
| Revenue (real-sales) | **Rp 53,646,659** |
| HPP (frozen COGS) | **Rp 11,110,404** |
| **Gross profit** | **Rp 42,536,255** |
| **Gross margin %** (blended) | **79.3%** |
| **HPP coverage** | **93.0%** of revenue (37 of 42 SKUs have `hargaCogs`) |
| SKU-level date range | **2026-06-11 → 2026-06-12** (2 days — thin) |

**Honesty rules the engine enforces:**
- **Coverage surfaced.** SKUs without `hargaCogs` contribute **0 HPP** → their margin
  shows as 100%, which **inflates the blended margin**. The engine therefore reports
  both the **blended** margin (all SKUs) AND the **covered** margin (`coveredMarginPct`,
  SKUs with real cost only — the trustworthy figure), plus `coveragePct`.
- **Cleora-only.** `OrderItem` + `DailyHpp` exist only for tenant 2. Tenants without
  `OrderItem` get **`hasData: false`** with an honest note — **never fabricated**.
- **Thin history.** SKU-level data is ≈June only; `getMarginTrend` returns the real
  dates with a `note` ("only N day(s) — trend is shallow") — **no fabricated trend**.
- Fresh/empty tenant → graceful `hasData:false`, no error.

---

## 3. Marketing spend — shown SEPARATELY, never deducted

Marketing/ad spend (`AdSpentSocialMedia` + `Marketing`) is **real** and may be shown
**alongside** gross margin as context (`marketingSpendContext`). It is **never**
subtracted into a "net" number. There's also an honest data note: **real spend data is
Jan–Feb while SKU sales/HPP are June — they do not overlap**, so in the June margin
window marketing spend is `Rp 0`. This reinforces *why* a credible net figure isn't
possible here yet, not just policy.

---

## 4. Overlap note — `getMarginQuadrant` vs the `/sales` profitability quadrant

`getMarginQuadrant` (units × margin%, bubble = revenue) **overlaps** the profitability
quadrant already built on the `/sales` page. It is kept here as the **finance-framed**
version (gross-margin-% axis, gross-profit basis, same HPP source) so the Finance module
is self-contained. The page may reuse or omit it — it is **not** a new metric, just a
finance lens on the same real data. Flagged here to avoid the impression of a second
source of truth.

---

## 5. "Connector" / how this stays/【becomes more】 real — a recompute, not an import

Like RFM (and unlike BCG), gross margin needs **no external source**: it recomputes
from `Order` + `OrderItem` + `DailyHpp` we already have. It is **fully real today** and
simply **grows as OrderItem + HPP coverage grow** (more tenants onboard SKU-level
order data; more products get `hargaCogs`). The dependency is the **HPP snapshot** —
keep `DailyHpp` current via `computeDailyHpp` (NP2b); the margin engine reads the frozen
snapshot, so margins are stable until HPP is recomputed.

**Net P&L (Wave 3)** is the only part that needs new plumbing: a per-tenant
business-rules config (opex / fee % / tax) feeding a `pnl-summary` engine. Until then,
Finance stays **gross-only and fully honest**.

---

## 6. Engine API (`lib/analytics/gross-margin-summary.js`)

All tenant-scoped; `dummy: false`; `hasData:false` when no OrderItem:

| Function | Returns |
|---|---|
| `getMarginOverview(tenantId, period?)` | revenue, HPP, gross profit, blended + **covered** margin %, coverage %, Δ vs previous period, marketing-spend context (separate), scope note |
| `getMarginByProduct(tenantId, period?)` | per-SKU revenue / HPP / gross profit / margin % / `hasCost`, ranked by gross profit |
| `getMarginPareto(tenantId, period?)` | products by gross-**profit** contribution + cumulative % + 80% ref |
| `getMarginTrend(tenantId, period?)` | revenue / HPP / gross profit / margin % by date (thin, honest note) |
| `getMarginWaterfall(tenantId, period?)` | Revenue → −HPP → Gross Profit stages (marketing spend separate, not summed) |
| `getProductMarginDetail(tenantId, sku, period?)` | one SKU + per-date history + `hasCostNote` |
| `getMarginQuadrant(tenantId, period?)` | units × margin% (bubble = revenue) — finance-framed, overlaps /sales (§4) |

`period` = `{ start, end }` or `{ month: 'YYYY-MM' }`; omit for the tenant's full
OrderItem range (recommended while history is thin).
