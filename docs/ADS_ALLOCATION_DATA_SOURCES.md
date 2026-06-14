# Ads Spend-Allocation — Data Sources & Honesty Map

> **How real is this? 100% real.** Every figure comes from data already synced.
> **There is no dummy seeder and no fabricated number in this module.** Each engine
> response carries `dummy: false`.
>
> **The one honesty caveat is what this module DOESN'T do:** the data is
> **expense-only** — there is **no revenue link** — so this module emits **NO ROAS,
> no CAC, no efficiency-vs-sales.** It analyzes **how spend is ALLOCATED** (Pareto,
> trend, share, MoM), nothing about what the spend returned. True ROAS / attribution
> is a **Wave 3** item that needs a data-plumbing fix first (see §3).

---

## 1. Field-by-field source map (all REAL)

Two existing, already-synced expense tables. **No new model.** The engine
(`lib/analytics/ads-allocation-summary.js`) reads both directly, tenant-scoped,
Decimal → Number at the boundary.

### `AdSpentSocialMedia` → **channels**
| Field | Status | Meaning |
|---|---|---|
| `tenantId` | ✅ real | scope (every read filters it) |
| `platform` | ✅ real | the **channel** (Snack Video / Google / Instagram / TikTok / Facebook) |
| `date` | ✅ real | spend date |
| `amount` | ✅ **real** | spend (Decimal → Number) |

### `Marketing` → **categories**
| Field | Status | Meaning |
|---|---|---|
| `tenantId` | ✅ real | scope |
| `marketingCategory` | ✅ real | the **category** (KOL Beauty / Media Online / Creative Campaign / …) |
| `type` | ✅ real | Marketing vs Branding (secondary breakdown) |
| `subCategory` | ✅ real | optional sub-split (drill) |
| `date` | ✅ real | spend date |
| `amount` | ✅ **real** | spend (Decimal → Number) |

**Derived metrics — all real arithmetic on real spend:** total spend (social +
marketing), per-channel / per-category totals, **Pareto** (rank, cumulative %, 80%
"vital few"), **share %**, **trend** (date_trunc day/week/month), **MoM** (month-over-
month). No metric requires a non-existent field.

### What is deliberately ABSENT (and why)
| Not provided | Why |
|---|---|
| ROAS / ROI / CAC | **No revenue link.** `AdSpentSocialMedia` / `Marketing` are expense-only; neither joins to `Order`. Fabricating ROAS would be dishonest → omitted. |
| Efficiency-vs-sales | same — needs attribution (Wave 3). |
| Impressions / clicks / conversions | not in these tables (the marketplace ad tables that have them — `AdSpentMeta/Shopee/TikTok` — are EMPTY; see PROJECT_STATUS / audit). |

---

## 2. Data reality — thin date range (surfaced, never faked)

Tenant 2 (the tenant with data; tenants 1 & 3 are thin):

| Source | Rows | Span | Total (t2) |
|---|---|---|---|
| `AdSpentSocialMedia` | 140 | **2026-01-31 → 2026-02-27** (Jan = a single day) | **Rp 372,484,133** |
| `Marketing` | 392 | **2026-01-31 → 2026-02-27** (Jan = a single day) | **Rp 3,915,606,492** |
| **Combined** | 532 | ≈ one month (Feb) + a sliver of Jan 31 | **≈ Rp 4,288,090,625** |

**Honesty rules the engine enforces:**
- `getDateRange()` returns the real `min`/`max`/`days`/`months` per source + a `note`
  about the thin range. The page should show it.
- `getSpendTrend()` is bounded to the real range and returns `empty: true` beyond it
  — **no fabricated trend line.**
- **MoM is real but flagged:** Jan is a **single day** (`days ≤ 3 → partial: true`), so
  `getAllocationOverview().mom.caveat` and `getMoMComparison().caveat` warn that the
  comparison is **not like-for-like**. The numbers are real; the caveat is honest.
- Fresh/empty tenant → graceful zeros/empties, never an error.

---

## 3. "Connector" / how more data arrives — NO new connector needed

Unlike BCG (external Google Sheet) and like RFM (internal), this module needs **no new
connector and no recompute job** — it reads the live expense tables directly. More data
simply **accumulates through the existing ad/marketing import paths** that already
populate `AdSpentSocialMedia` and `Marketing`. As more dates sync:
- the thin-range caveat resolves on its own,
- trend extends automatically,
- MoM becomes like-for-like once ≥2 full months exist.

**To make this module's *missing* analyses (ROAS/attribution) real — a data-plumbing
item, not a connector:** add a revenue↔spend link. Options (Wave 3):
1. an **attribution key** on `Order` (campaign/ad/utm/source) so spend can be tied to
   sales by channel/date, **or**
2. populate the marketplace ad tables (`AdSpentMeta/Shopee/TikTok/Lazada`) that carry a
   `revenue`/`roas` column (currently EMPTY).

Until then this module stays **allocation-only and 100% honest** — it never claims to
know the return on the spend.

---

## 4. Engine API (`lib/analytics/ads-allocation-summary.js`)

All tenant-scoped, all `dummy: false`:

| Function | Returns |
|---|---|
| `getAllocationOverview(tenantId, period?)` | total/social/marketing spend, channel & category counts, top channel/category, MoM (with partial-month caveat), monthly totals, date range |
| `getChannelPareto(tenantId, period?)` | 5 channels ranked + cumulative % + 80% ref + `top80Count` |
| `getCategoryPareto(tenantId, period?)` | 14 categories ranked + cumulative % + 80% ref |
| `getSpendShare(tenantId, period?)` | channels & categories with share % (treemap/donut) |
| `getSpendTrend(tenantId, {dimension, granularity, period})` | long-format points + keys, real-range-bounded, `empty` flag |
| `getMoMComparison(tenantId, {dimension})` | per-key month-over-month, `singlePeriod`/`partial` honesty flags |
| `getChannelDetail(tenantId, channel, period?)` | one channel: total, share of social, daily trend |
| `getCategoryDetail(tenantId, category, period?)` | one category: total, share, subcategory split, daily trend |
| `getDateRange(tenantId)` | real min/max/days/months per source + thin-range note |

`period` = `{ start, end }` or `{ month: 'YYYY-MM' }`; omit for all-data (recommended
while the range is thin).
