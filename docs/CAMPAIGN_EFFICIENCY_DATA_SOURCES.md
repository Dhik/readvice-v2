# Campaign Content Efficiency — Data Sources & Honesty Map

> **How real is this? The efficiency metrics are real — but they measure cost vs
> SELF-REPORTED GMV, not attributed sales.**
>
> Every metric (CPM, cost-per-GMV, engagement rates, channel/tiering mix) is a **real
> computation on real `CampaignContent` fields**. Each engine response carries
> `dummy: false`. **The one critical caveat:** `CampaignContent.gmv` is
> **self-reported / imported** on the content record — it is **NOT joined to real
> `Order` sales**. There is **no campaign→order attribution**, so this module measures
> efficiency against **REPORTED** GMV, *not* attributed sales or true incrementality.
> Responses flag this with `selfReportedGmv: true`.
>
> This is the **cross-campaign** efficiency lens (comparing creators/content across
> campaigns). It does **not** rebuild the existing per-campaign `PerformanceChart` or
> the expense-vs-GMV/engagement panel (those stay as-is).

---

## 1. Field-by-field source map

Source: `CampaignContent` (one query, computed in JS — 95 rows is tiny). Tenant-scoped,
Decimal/BigInt → Number.

| Field | Status | Notes |
|---|---|---|
| `rateCard` → **cost** | ✅ **REAL** | the content's cost |
| `gmv` → **reportedGmv** | 🟡 **REAL field, SELF-REPORTED** | imported on the record; **NOT attributed to Orders** — the key caveat |
| `view` / `like` / `comment` | ✅ **REAL** | BigInt → Number; drive CPM + engagement |
| `channel` | ✅ real (normalized) | case/format dupes merged — see §3 |
| `tiering` | ✅ real | Nano/Micro/Macro/Mega/Celebrity; null → `Untiered` |
| `isFyp` / `isDelivered` / `isPaid` | ✅ real | status counts |
| `creatorName` / `username` | ✅ real | creator identity |
| `campaign.title` | ✅ real | for context (cross-campaign) |

### Derived metrics — all REAL arithmetic (guarded denominators → `null`, never NaN)
| Metric | Formula | Honesty |
|---|---|---|
| **CPM** | `cost / (views/1000)` | ✅ real |
| **Engagement rate** | `(likes + comments) / views × 100` | ✅ real |
| **Cost-per-reported-GMV** | `cost / reportedGmv` | ⚠️ real math, but vs **reported** GMV |
| **GMV-per-cost** (ROAS-like) | `reportedGmv / cost` | ⚠️ **NOT a real ROAS** — reported, not attributed |
| **Cost × reported-GMV quadrant** | medians of measured content | ⚠️ positions real vs reported GMV |
| Channel / tiering mix | group sums + ratios | ✅ real |

**What is NOT available (and why):** true campaign **ROI / incrementality /
attributed ROAS** — needs a campaign→order link that doesn't exist. **Not fabricated.**

---

## 2. Data reality — measured vs placeholder, thin statistics

Tenant 2 (t1/t3 empty for this module):

| Fact | Value |
|---|---|
| Content pieces (total) | **95** |
| …with real cost/gmv signal (**measured**) | **~20** (the rest are zero placeholders) |
| Campaigns | 5 |
| Total cost (`rateCard`) | **Rp 264,431,759** |
| Total **reported** GMV | **Rp 575,472,178** |
| Views / likes / comments | 6.57M / 579,734 / 47,961 |
| Tiering (measured) | Macro 5 · Celebrity 5 · Micro 4 · Mega 3 · Nano 3 · (75 Untiered) |
| `ContentStatistic` | **43 rows, only 2 distinct dates (2026-06-03, -05)** — thin |

**Honesty rules the engine enforces:**
- `measuredCount` is surfaced alongside `contentCount` — most rows are zero placeholders,
  so efficiency averages/leaderboards use only content with real signal (guarded denominators).
- Quadrant thresholds (median cost / median reported GMV) are computed over **measured**
  content only.
- `getContentDetail` returns the **thin** `ContentStatistic` series with a
  `statisticsNote` ("only N day(s) — trend is shallow" / "no daily statistics") — **no
  fabricated trend**.
- Fresh/empty tenant → graceful zeros/empties, never an error.

---

## 3. Channel normalization

Raw `channel` strings carry case/format duplicates from different import batches, e.g.
`"Instagram feed"` (44 rows, has data) vs `"instagram_feed"` (35 rows, all-zero
placeholders). The engine normalizes (`lowercase`, collapse `_`/spaces) so they merge
into one channel — the same lesson as platform-case normalization elsewhere. Display
label is title-cased; grouping is on the normalized key.

---

## 4. "Connector" / how this becomes fully real — a data-plumbing item, not a connector

No new connector or recompute job — the engine reads `CampaignContent` directly, which
is already populated via the existing campaign import/scrape paths. As more content +
`ContentStatistic` rows sync, the thin-statistics caveat resolves on its own.

**To make the *missing* part real (true ROI / attributed ROAS) — data-plumbing (Wave 3):**
1. add a **campaign→order attribution** key (Order has none today), and/or
2. backfill **`TalentContent.campaignId`** (currently **100% null**) and link campaign
   content to attributed Order revenue.

Until then this module stays **efficiency-vs-reported-GMV and fully honest** — it never
claims to know attributed sales or true campaign ROI.

---

## 5. Engine API (`lib/analytics/campaign-efficiency-summary.js`)

All tenant-scoped; `dummy: false` + `selfReportedGmv: true`:

| Function | Returns |
|---|---|
| `getEfficiencyOverview(tenantId)` | content & measured counts, total cost, total reported GMV, blended cost-per-reported-GMV, avg CPM, avg engagement, FYP/delivered/paid counts |
| `getEfficiencyQuadrant(tenantId)` | cost × reported-GMV points (bubble = views), median thresholds, per-quadrant counts |
| `getChannelMix(tenantId)` | per-channel cost / reported GMV / CPM / cost-per-GMV / engagement |
| `getTieringPerformance(tenantId)` | same, by tiering |
| `getEngagementAnalysis(tenantId)` | view→like→comment rates + per-content engagement→reported-GMV points |
| `getTopContent / getBottomContent(tenantId, limit)` | efficiency leaderboard (GMV-per-cost) |
| `getContentDetail(tenantId, contentId)` | one piece's metrics + creator/channel/tiering + thin `ContentStatistic` series (honest note) |

Quadrant labels/colors: `CONTENT_QUADRANTS` (Efficient / Premium / Overpriced / Low Impact).
