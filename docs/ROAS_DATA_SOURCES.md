# True ROAS / Attribution — Data Sources & Honesty Map (Wave 3 §3.2)

> **MIXED honesty (posture #1 banner + posture #3 per-section), the Talent-ROI shape:**
> ad **SPEND is REAL**; attributed **REVENUE + ROAS are DUMMY** (fabricated attribution over
> real spend). Kept in separate response sub-objects so the page never blends a real spend
> number with a fabricated revenue/ROAS one. Slate = REAL, orange = DUMMY everywhere.
>
> Engine `lib/analytics/roas-summary.js` · Route `app/api/analytics/roas/route.js` · Page
> `app/(dashboard)/analytics/roas/page.jsx`. On-the-fly — **no snapshot, no new Prisma model**.

## Real spend — REUSED from Ads-Allocation (single source of truth)

The spend half is **not re-derived**. `roas-summary.js` imports Ads-Allocation's real-spend
functions (`getAllocationOverview`, `getSpendShare`, `getSpendTrend`, `getChannelDetail`,
`getCategoryDetail`), so the ROAS total spend **equals** Ads-Allocation's total by construction.

| Field | Source | Real? | Notes |
|---|---|---|---|
| `spend` (per source) | `AdSpentSocialMedia` (5 channels) + `Marketing` (14 categories) | **REAL** | Identical to `ADS_ALLOCATION_DATA_SOURCES.md`. |
| `totalSpend` | `getAllocationOverview().totalSpend` | **REAL** | The Rp4.29B figure — cross-checked == Ads-Allocation. |
| `socialTotal` / `marketingTotal` | sums per source kind | **REAL** | — |
| `sharePct` | spend / source total | **REAL-DERIVED** | — |
| trend `spend` | `getSpendTrend(total)` | **REAL** | Honestly bounded to the real date range. |
| **`attributedRevenue`** | `spend × assumed ROAS` | **DUMMY** | Fabricated — `dummy:true`. |
| **`roas`** | `attributedRevenue / spend` | **DUMMY-DERIVED** | Real spend ÷ dummy revenue → dummy. **Never a real return.** |

**EXCLUDED_STATUSES / TZ-1:** inherited from the reused Ads-Allocation computation (spend rows
have no order-status; date bucketing is the shared raw-UTC convention). No re-derivation here.

## Dummy attribution basis (the fabricated half)

```
assumedRoas(sourceKey) = 1.5 … 4.5×   (deterministic from the key — stable, data-like, fabricated)
attributedRevenue      = spend × assumedRoas
roas                   = attributedRevenue / spend   (= assumedRoas)
trend revenue          = spend × ASSUMED_BLENDED_ROAS (2.5×)
```

These multipliers are **stated assumptions, not a real spend→order link**. Every response
carries `spendReal:true` + `attributionDummy:true`; the `attribution` sub-object is `dummy:true`;
the page shows a prominent orange banner + dummy badges on revenue/ROAS, spend plain/slate.

## Why it's dummy today — and the P-1 blueprint to make it real

There is **no order-level attribution column** on `Order` (no `campaignId` / ads id / utm /
source) — Plumbing **P-1** in the roadmap. So spend **cannot** be joined to revenue, and a real
ROAS is impossible to compute or backfill today. This is the doc's allowed "fabricate, flagged"
path. It **becomes real** when:

1. An attribution column is **added to `Order`** (schema) and **captured at sync** (importer /
   connector writes the campaign/ads/source per order), then
2. `roas-summary` replaces the assumed-ROAS fabrication with a real `SUM(order.revenue)` grouped
   by that attribution key ÷ the real spend — **same response shape, same page**, flags flip to real.

No external source needed beyond capturing the link at ingestion.

## LLM discipline

The AI panel's context carries `spendReal`/`attributionDummy` + the assumption note. The agent
must explain that **spend is real but the attribution/ROAS is fabricated** (no order-level link)
— never presenting the ROAS figure as a real return.
