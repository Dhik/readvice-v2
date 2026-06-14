# Analytics Roadmap — Deep-Analysis Modules

> **Governing plan for building out every deep-analysis module.** Sits beside
> [`BI_DESIGN.md`](BI_DESIGN.md) (the interaction/architecture constitution) and
> [`PROJECT_STATUS.md`](PROJECT_STATUS.md) (current state). This doc decides **what
> to build, in what order, and how real the data is.**
>
> _Created 2026-06-14. Living document — update statuses as modules ship._

## How to resume (read every session before analytics work)

1. **[`PROJECT_STATUS.md`](PROJECT_STATUS.md)** — what's done / in-flight.
2. **[`BI_DESIGN.md`](BI_DESIGN.md)** — interaction pattern (overview→drill→detail),
   operational↔analytics boundary, reusable components.
3. **This doc** — the wave order + per-module spec + real/dummy verdict.
4. Per-module honesty docs as you touch them:
   [`BCG_DATA_SOURCES.md`](BCG_DATA_SOURCES.md), [`RFM_DATA_SOURCES.md`](RFM_DATA_SOURCES.md),
   and the future `*_DATA_SOURCES.md` each new module ships.

---

## Principles (non-negotiable)

### P1 — Build order is MOST REAL → MOST DUMMY
Ship analyses on **fully-real data first**; analyses that need **fabricated data
last**. Real wins trust; dummy is scaffolding. Every module **marks real-vs-dummy
explicitly**, exactly like BCG/RFM:
- a `source` flag on every stored row (`REAL-DERIVED` / `DUMMY` / `RECOMPUTE` / connector name),
- `dummy:true` (or per-field flags) on **every engine response**,
- a visible **honesty banner + badges** in the UI (never present fabricated numbers as real),
- a **`*_DATA_SOURCES.md`** field-by-field map,
- a **connector or recompute blueprint** describing how the dummy becomes real.

### P2 — Every module meets the "BCG standard" — SIMILAR, not IDENTICAL
Same **quality + interaction**, *different* visualization fit-for-purpose. The BCG
standard = interactive, highlights what matters, **detail modals**, clean consistent
colors (the shared **chart theme**), **compact components**, graceful empty states,
0 console errors, Playwright-verified. But **do not force a bubble matrix everywhere** —
pick the chart that fits the question:

| Question shape | Right chart |
|---|---|
| Where does spend concentrate? | **Pareto** (80/20) + treemap/share |
| Two-axis positioning (cost vs return, freq vs value) | **Scatter / quadrant** |
| Retention over time by cohort | **Triangular heatmap** |
| What's bought together | **Network graph + affinity matrix heatmap** |
| Value spread across customers | **Distribution plot + percentile bands** |
| Margin build-up / P&L | **Waterfall** |
| Stage conversion / fulfillment | **Funnel** |
| Trend / seasonality / forecast | **Line + confidence band** |

### P3 — Engine-owns-logic, reuse the foundation
Page **renders**, engine **computes**. Every read **tenant-scoped**;
**Decimal/BigInt→Number** at the boundary; new/empty tenant → graceful empty, never
error. **Reuse** (do not reinvent): chart theme (`lib/charts/theme.js`), **DataGrid**
(`+ onRowClick`), compact components (`CompactPage / CompactTopbar / IconKpiStrip /
CompactPanel / StatCard·MetricRow`), the dispatch-route + serialized-await pattern
(connection_limit=1 — never `Promise.all` a fan-out of queries; see BCG/RFM routes).

---

## Wave overview

| Wave | Theme | Modules | Dummy level | Status |
|---|---|---|---|---|
| **1** | Real-data-ready | Ads Spend-Allocation · Campaign Content Efficiency · RFM · Finance Gross-Margin (+ BCG pilot) | none / minimal | ✅ **COMPLETE** (all page-complete + browser-verified) |
| **2** | Real base + fabricated link | Talent ROI · Operational · Cohort Retention · Market Basket | partial | ✅ **COMPLETE** (all 4 page-complete + browser-verified) |
| **3** | Needs accumulation | CLV · True ROAS/Attribution · Net P&L · AI Forecasting | mostly / structure-only | 🔴 next — **MOST SPECULATIVE wave** (AI Forecasting = honest "needs ≥12mo" gate, NOT a fabricated line) |
| **Plumbing** | Unlock real versions | attribution column · `TalentContent.campaignId` · cross-module keys | — | 🔴 |

Reference data reality (from the audits, tenant 2 unless noted): real Orders/OrderItem
(Cleora), `AdSpentSocialMedia` (420 rows, 5 channels, ~Rp372M), `Marketing` (1176 rows,
14 categories, ~Rp3.9B), `CampaignContent` (95, GMV Rp575M), `DailyHpp` (real COGS),
`TalentPayment` (45, Rp122M). Empty/thin: marketplace ad ROAS tables, `AdsMonitoring`,
`CampaignStatistic`, `TalentContent.campaignId`, cross-module username joins.

---

# WAVE 1 — REAL data (zero/minimal dummy) — ✅ COMPLETE & browser-verified

> **All 5 modules page-complete + verified (Playwright + NextAuth, tenant 2, 0 console
> errors).** BCG pilot (dummy axes, honest) + RFM + Ads-Allocation + Campaign-Efficiency
> + Finance Gross-Margin. See the [pattern that worked](#the-pattern-that-worked-wave-1)
> and the [status tracker](#status-tracker).

## 1.1 Ads Spend-Allocation `/analytics/ads-allocation` — ✅ COMPLETE
- Total spend **Rp 4.29B** (real, expense-only); Pareto + share + trend + MoM; **NO ROAS**
  (no revenue link); thin-range + partial-Jan caveats surfaced. Neutral note (all real).
- **Goal:** where the ad/marketing money goes and how efficiently — concentration,
  trend, channel/category mix. The honest, real-data ads analysis (the existing ROAS
  panels point at empty tables — see Do-Not-Rebuild).
- **Data — REAL (expense-only):** `AdSpentSocialMedia` (5 channels: Snack Video,
  Google, Instagram, TikTok, Facebook) + `Marketing` (14 categories: KOL Beauty, Media
  Online, Creative Campaign…). **No DUMMY.** **Explicitly NO ROAS** — there is no
  revenue link (state this in the banner; ROAS lives in Wave 3).
- **Charts + why:** **Pareto** (channels & categories — surfaces the 80/20 of spend) ·
  **stacked area / line trend** (MoM spend by channel) · **treemap or share-donut**
  (mix) · cost-efficiency = spend ÷ (real Order GMV by date, *loosely*, clearly labeled
  "not attribution").
- **Interaction:** filter by date-range + channel/category; toggle channel↔category lens;
  row-click a channel → detail modal (its trend + share + top days). Export CSV/JSON.
- **Engine `lib/analytics/ads-allocation-summary.js`:** `getAllocationOverview`,
  `getParetoData(lens)`, `getSpendTrend(lens, granularity)`, `getShareBreakdown(lens)`,
  `getChannelDetail(key)`, `advancedFilter`.
- **Dependencies:** none (real data present). **Size:** M (engine + 1 page + modals).

## 1.2 Campaign Content Efficiency `/analytics/campaign-efficiency` — ✅ COMPLETE
> Real metrics on real `CampaignContent` fields, but **GMV is self-reported (not
> attributed to Orders)** — flagged everywhere as "reported-GMV", not sales ROI.
> **Measured 20/95** content (rest are zero placeholders). Cost×reported-GMV quadrant +
> channel/tier bars + leaderboard. Route at `/analytics/campaign-efficiency` (the
> "finance/margin"-style path note below is illustrative).

- **Goal:** **cross-campaign** creator/content efficiency — which content, creators,
  channels, tiers convert spend → GMV → engagement best. (NOT the per-campaign view.)
- **Data — REAL:** `CampaignContent` (t2: rateCard, gmv, view/like/comment, cpm, channel,
  tiering, isFyp/isDelivered/isPaid). `ContentStatistic` for time depth (shallow — 2
  dates — so lean on the aggregates). **No DUMMY** (efficiency = ratios of real fields).
- **Charts + why:** **scatter/quadrant** (x = cost/rateCard, y = GMV or engagement→GMV;
  bubble = views — positions *efficiency*, and the data is real so positions are real) ·
  **bars** (cost-per-GMV by channel/tier; CPM distribution) · FYP-rate / delivery-rate KPIs.
- **Interaction:** quadrant + DataGrid (channel/tier quick-filter, onRowClick → content
  detail modal: the content's metrics + funnel of view→engagement→GMV). Filter by channel/tier.
- **Engine `lib/analytics/campaign-efficiency-summary.js`:** `getEfficiencyOverview`,
  `getEfficiencyScatter`, `getChannelTierBreakdown`, `getContentDetail(id)`,
  `getRecommendations`, `advancedFilter`.
- **Dependencies:** none. **Do NOT rebuild** the per-campaign `PerformanceChart` or the
  expense-vs-GMV/engagement panel — this is the portfolio-level view. **Size:** M.

## 1.3 RFM Customer Segmentation `/analytics/rfm` ✅ **COMPLETE** (browser-verified)
- **Goal:** segment customers by Recency/Frequency/Monetary into the standard 11 segments
  with per-segment actions.
- **Data — REAL-DERIVED** from Orders (recency/frequency/monetary), **~56% customer
  coverage** (`customer_username`; label it — becomes fully real as coverage grows).
  **DUMMY:** 50 padding customers only so every segment is visible (max real frequency = 2);
  flagged `dummy:true`, excluded from real counts. See [`RFM_DATA_SOURCES.md`](RFM_DATA_SOURCES.md).
- **Charts + why:** **segment scatter** (Recency × Frequency, size = Monetary, colored by
  segment) · **segment grid/cards** (count, revenue share, avg R/F/M, action) · **detail
  modal** (a customer's R/F/M + real order history + recommended action).
- **Interaction:** segment quick-filter, onRowClick → customer detail, recommendations
  modal, advanced filter (segment / minMonetary / minFrequency / maxRecency).
- **Engine `lib/analytics/rfm-summary.js` — BUILT** (`getRfmOverview`, `getRfmScatter`,
  `getSegmentSummary`, `getCustomerDetail`, `getRecommendations`, `advancedFilter`,
  `getAvailableDates`). **Page BUILT** (`app/(dashboard)/analytics/rfm/`,
  `components/rfm/*`, dispatch route `app/api/analytics/rfm/route.js`): RFM-appropriate
  **Recency×Frequency segment scatter** (not a BCG bubble clone) + 11-card segment grid
  (real/dummy split + dummy-only badges) + customers DataGrid + detail/recommendations/
  advanced-filter modals + honesty banner. Verified Playwright/NextAuth t2 (580 points,
  real order-history path, 0 console errors). **Becomes fully real** as coverage + repeat
  history grow — via a recompute job, **no external source** (unlike BCG). 🟡→✅.
- **Dependencies:** model + seeder + engine done. **Size:** M (page only).

## 1.4 Finance — Gross Margin `/analytics/gross-margin` — ✅ COMPLETE
> Real **revenue − HPP** (reuses `compute-hpp`). **GROSS only — never a net number**;
> marketing shown separately ("not deducted"). Both **blended (79.3%) & covered (77.7%)**
> margin shown; **HPP coverage 93%**; uncovered SKUs flagged (0 HPP → inflated 100%).
> Cleora-only → `hasData:false` empty-state for other tenants. Waterfall + margin-Pareto
> (14/42 SKUs drive 80%) + trend. Profitability quadrant links to `/sales` (not duplicated).

- **Goal:** real gross profitability — revenue − COGS — per product / period. (Gross
  level only; net P&L needs business rules → Wave 3.)
- **Data — REAL:** `OrderItem` revenue (excl. cancelled, the shared exclusion list) −
  `DailyHpp` frozen COGS snapshot. Margin only for SKUs with `hargaCogs` (others →
  honest "no cost" state). **No DUMMY.**
- **Charts + why:** **waterfall** (revenue → −COGS → gross margin, per period) · **margin
  Pareto** (which SKUs drive / drag margin) · **margin trend** (gross-margin % over time)
  · gross-level **P&L summary** card.
- **Interaction:** period filter; Pareto row-click → SKU margin detail (price, cogs,
  units, margin/unit, margin total, trend). Coverage badge (% SKUs with cost).
- **Engine `lib/analytics/margin-summary.js`:** `getMarginOverview`, `getMarginWaterfall(period)`,
  `getMarginPareto`, `getMarginTrend`, `getSkuMarginDetail(sku)`. Reuse `compute-hpp` /
  `getDailyHpp`, `EXCLUDED_STATUSES`.
- **Dependencies:** `DailyHpp` populated (NP2b ✅). **Size:** M–L (overlaps existing /sales
  profitability — keep finance the period-P&L view, not a duplicate quadrant). **Size:** M.

---

# WAVE 2 — PARTIAL dummy (real base + fabricated link/field)

## 2.1 Talent ROI `/analytics/talent-roi` — ✅ COMPLETE (24/24 browser-verified)
> **First Wave-2 module shipped.** Cost is **100% REAL** (rateFinal Rp193M, paid Rp122M —
> cross-checked vs raw sums); return is **DUMMY** (`TalentReturn`, ~Rp353M).
> **FOUR distinct chart forms** (deliberate visual variety, all on the same engine data):
> 1. **Quadrant/bubble** — cost (x, REAL) × return (y, DUMMY), bubble = views.
> 2. **Leaderboard bar** — talents ranked by ROI (green win / red lose).
> 3. **Dumbbell** — per talent, a cost point (slate=REAL) + return point (orange=DUMMY)
>    connected by a line, sorted by ROI; the two point colors *are* the split. (Built as
>    `Scatter` + an `afterDatasetsDraw` connector plugin, category y-axis, all 24 talents.)
> 4. **Radar** — one line per talent type on **4 normalized axes** (cost/return/ROI/views,
>    0–100 per-axis since scales differ wildly); **tooltip shows the REAL underlying value
>    + a REAL/DUMMY label per axis** (cost=REAL, return/ROI/views=DUMMY), not the % .
>
> Plus a detail modal (separated REAL/DUMMY blocks) + recommendations.
> **Visual pattern — REAL÷DUMMY split made visual** (the sharper-than-BCG case, since
> half the ratio is real): consistent **color-coding — slate `#3F4E4F` = REAL, orange
> `#E07B39` = DUMMY** — across KPI tiles (slate vs orange + `dev` badge), the quadrant
> y-axis ("⚠ Attributed return (DUMMY)"), table headers ("Cost · REAL" / "Return · DUMMY"
> / "ROI · DUMMY"), the **dumbbell's two point colors**, and the **radar's per-axis
> REAL/DUMMY tooltip labels**. Detail modal uses slate- vs orange-bordered blocks so cost
> and return never read as one. Engine flags `costReal:true` + `returnDummy:true` on every
> response. (Empty-state confirmed on a no-talent tenant.)
>
> _History: the original Cost-vs-Return grouped bar and Type-Performance bar were later
> **swapped** for the dumbbell and radar — same engine data, sharper visual variety._

- **Goal:** talent cost-vs-return — who's worth the rate card.
- **Data — REAL:** cost from `TalentPayment.amountTf` + `Talent.rateFinal` (per talent,
  per type). **DUMMY (BCG-style):** the **return** side — there is **no revenue link**
  (Talent.username ∩ Affiliate = 0; `TalentContent.campaignId` = null), so attributed
  revenue/GMV is fabricated and flagged. Positions are illustrative until the link is
  backfilled (see Plumbing).
- **Charts + why (shipped — 4 forms):** **quadrant** (cost↔return trade-off) · **leaderboard
  bar** (ROI ranking) · **dumbbell** (per-talent cost vs return, the clearest split) ·
  **radar** (type profile on 4 normalized axes). Dummy axis/return → honesty banner +
  slate/orange split everywhere. (Multiple forms, not one repeated bar — see variety note below.)
- **Interaction:** type filter, onRowClick → talent detail (real payments + dummy return +
  action). Recommendations by quadrant.
- **Engine `lib/analytics/talent-roi-summary.js`:** `getTalentRoiOverview`, `getRoiQuadrant`,
  `getTalentDetail(id)`, `getRecommendations`, `advancedFilter` + seeder for dummy return.
- **Dependencies:** real cost ready; dummy return seeder (BCG pattern). **Unlocks real**
  when `TalentContent.campaignId` backfilled → campaign GMV attributable. **Size:** M.

## 2.2 Operational `/analytics/operational` — ✅ COMPLETE (20/20 browser-verified)
> **MIXED per-section honesty** (not one banner): status funnel · cancellation trend ·
> stock velocity = **REAL** (plain); fulfilment time = **DUMMY** (`OrderFulfillment`,
> orange-banded section). **4 chart forms:** funnel (pipeline + Cancelled drop-off) ·
> stock-velocity quadrant · cancellation trend (24%→8.4% improving) · fulfilment histogram
> (dummy, orange). **0% stock-coverage handled honestly** — `Product.stock` is 0 for ALL
> SKUs, so the quadrant draws only the 2 populated bottom buckets + a prominent note (no
> misleading empty 4-quadrant). Funnel sums to 1306. Page-level small note, not a full banner.

- **Goal:** operations health — status flow, inventory velocity, cancellation trends.
- **Data — REAL:** order `status`, `Product.stock`, order volume/qty. **DUMMY:**
  fulfillment/processing **time** (no per-stage timestamps in `Order`) → fabricated.
- **Charts + why:** **funnel** (order status flow — reuse the two-basis exclusion design)
  · **stock/velocity quadrant** (turnover × stock-on-hand) · **trend** (cancellations,
  volume over time). Funnel fits stage flow; quadrant fits stock health.
- **Interaction:** date/platform filter; funnel stage → orders behind it; stock row-click →
  SKU velocity detail. Per BI_DESIGN, keep operational-vs-analytics boundary clear.
- **Engine `lib/analytics/operational-summary.js`:** `getStatusFunnel`, `getInventoryVelocity`,
  `getCancellationTrend`, `getSkuVelocityDetail`. **DUMMY** only on time-to-fulfill.
- **Dependencies:** real status/stock present. **Unlocks real** with order status-history
  timestamps. **Size:** M.

## 2.3 Cohort Retention `/analytics/cohort` — ✅ COMPLETE (18/18 browser-verified)
> **MOST dummy-heavy (1 real cell / 36)** but the most OPTIMISTIC framing: **"becomes real
> with time" — NO backfill needed**, just elapsed months + continued sync. **Triangular
> retention heatmap** (chartjs-chart-matrix, statically registered/SSR-safe): rows = 8
> dynamic cohorts (anchored to real max order month — no hardcoded dates), cols = periods
> 0–7, only the latest cohort's period-0 (530 customers) is REAL/green, the 35 dummy cells
> are orange decay. + acquisition-volume bar + per-cohort retention curve + real customer
> DataGrid. Reuses RFM customer identity. Clear keeps `REAL-DERIVED`.

- **Goal:** do customers come back — retention by acquisition cohort.
- **Data:** cohort logic is **real** (group by first-order month, track repeat); but
  **history is thin** (orders cluster in Jan/Feb/Jun) → most cells **empty/DUMMY**.
  Honest empty-state for sparse cohorts; dynamic dates (never hardcode months).
- **Charts + why:** **triangular retention heatmap** (cohort × periods-since-acquisition,
  cell = % retained) — the canonical cohort visual. Matrix plugin (registered, SSR-safe).
- **Interaction:** hover cell → cohort size + retained count; cell-click → that cohort's
  customers. Toggle count↔%.
- **Engine `lib/analytics/cohort-summary.js`:** `getCohortMatrix`, `getCohortDetail(cohort)`.
  Tenant-scoped; **graceful** when a cohort has no later periods.
- **Dependencies:** accumulates with time (structure now, fills later). **Size:** M.

## 2.4 Market Basket / Cross-sell `/analytics/basket` — ✅ COMPLETE (22/22 browser-verified)
> **REAL but SMALL-SAMPLE** (honesty = sample size, not dummy): of 538 orders only **25 are
> multi-item** (the pair denominator) → 34 pairs / 20 SKUs, `smallSample:true`. **TWO visual
> forms:** **force-directed network** (d3-force 3.0.0 + SVG — sim runs in `useEffect` after
> mount, ticked to settle once, **no jitter, SSR-safe**) + **SKU×SKU affinity matrix heatmap**
> (chartjs-chart-matrix). **n=1 single-co-occurrences distinguished everywhere** (the core
> honesty signal): **dashed** network edges · **faded** matrix cells · `n=1` badges in the
> DataGrid + affinity panel. Edge thickness = co-occurrence (not lift, so n=1's huge lifts
> don't dominate); heatmap cell = lift intensity (complementary). Neutral small-sample note,
> not a dummy banner. Other tenants → `hasData:false`.

- **Goal:** what's bought together — affinity for bundling/cross-sell.
- **Data — REAL:** `OrderItem` co-occurrence (real Cleora line items). Support/confidence/
  lift are **computable from real data**. (Sparsity may thin results — honest.)
- **Charts + why:** **network graph** (products = nodes, edges = lift) + **affinity matrix
  heatmap** (SKU × SKU lift). Network shows the relationship structure; heatmap gives the
  scannable grid. Both fit "association," not a quadrant.
- **Interaction:** min-support/min-lift sliders; node/cell click → the pair's stats +
  co-occurring orders. Top-rules table (DataGrid).
- **Engine `lib/analytics/basket-summary.js`:** `getAssociationRules({minSupport,minLift})`,
  `getAffinityMatrix`, `getPairDetail(a,b)`. Compute support/confidence/lift over OrderItem.
- **Dependencies:** none (real OrderItem). Watch combinatorial cost — cap to top-N SKUs.
  **Size:** L (rule mining + network rendering).

---

# WAVE 3 — MOSTLY dummy / needs accumulation

## 3.1 CLV (Customer Lifetime Value) `/analytics/clv`
- **Goal:** projected customer value + value-tier distribution.
- **Data:** needs **repeat history** that doesn't exist yet → **DUMMY projection** now
  (historic-value real where present; projection fabricated, flagged).
- **Charts + why:** **distribution plot / histogram** (CLV spread) + **percentile bands**
  (value tiers). Distribution fits "spread of value," not positioning.
- **Interaction:** tier filter; bar-click → customers in that value band. Honesty banner
  (projection assumptions).
- **Engine `lib/analytics/clv-summary.js`:** `getClvDistribution`, `getClvTiers`,
  `getCustomerClvDetail`. **Unlocks real** as repeat history accumulates (ties to RFM).
  **Size:** M.

## 3.2 True ROAS / Campaign–Order Attribution `/analytics/roas`
- **Goal:** real return on ad/campaign spend.
- **Data:** **no attribution link in data** (Order has no campaign/ads column) → **DUMMY**
  until the link exists. Either fabricate (flagged) **or** build the attribution key first
  (see Plumbing) and make it real.
- **Charts + why:** ROAS **scatter/quadrant** (spend × return) + **trend**. Mirrors Ads
  Allocation but adds the (currently missing) revenue axis.
- **Engine:** extend `ads-allocation-summary` with attributed-revenue once linkable.
- **Dependencies:** **blocked on Plumbing P-1.** Prefer backfill over fabrication. **Size:** M.

## 3.3 Finance — Net P&L `/analytics/finance/pnl`
- **Goal:** full P&L below gross margin (opex, platform fees, tax → net profit).
- **Data:** gross is real (Wave 1.4); **net needs configurable business rules** (fee %,
  tax, opex categories) → **config/DUMMY** until rules are entered. Ties to deferred NP3.
- **Charts + why:** **full waterfall** (revenue → COGS → fees → opex → tax → net) + trend.
- **Engine `lib/analytics/pnl-summary.js`:** `getPnlWaterfall`, `getPnlTrend` — reads a
  **tenant P&L config** (rates). **Dependencies:** business-rules config model. **Size:** L.

## 3.4 AI Forecasting `/analytics/forecast`
- **Goal:** forward projection of sales/revenue.
- **Data:** needs **≥12 months** history; **almost none now**. **Build the STRUCTURE +
  honest gate**, NOT a fabricated forecast line: show *"Forecasting needs ≥12 months of
  history; currently N months — forecast not yet available."*
- **Charts + why:** **line + confidence band** (only once data qualifies). Until then, the
  empty-state gate.
- **Methods (document, implement when data exists):** statistical — **Prophet / ARIMA /
  Holt-Winters** for the numeric forecast. **Critical distinction:** the existing **AI
  Agent (LLM) is for NARRATIVE insight, NOT numeric prediction** — never ask the LLM to
  produce forecast numbers. LLM explains/contextualizes; the statistical model predicts.
- **Engine `lib/analytics/forecast-summary.js`:** `getForecastReadiness` (months available
  vs required), `getForecast` (gated). **Dependencies:** time. **Size:** M (structure) + L (later).

---

# Data-plumbing track (unlocks real versions)

These are **link debts**: fixing them converts several Wave 2/3 dummy analyses into real
ones. Prioritize over fabricating the corresponding dummy.

| ID | Debt | Unlocks | Effort |
|---|---|---|---|
| **P-1** | `Order` has **no campaign/ads attribution** column (no `campaignId`/utm/source) | True ROAS (3.2), Campaign→sales ROI | M — schema + capture at sync |
| **P-2** | **`TalentContent.campaignId` is 100% null** (link exists, unused) | Talent ROI (2.1) real return via campaign GMV | S — backfill + enforce on import |
| **P-3** | **Cross-module username joins = 0** (Talent ∩ Affiliate; CampaignContent ∩ Talent/KolProfile) | Talent↔affiliate revenue, creator unification | M — identity reconciliation / mapping table |
| **P-4** | No per-stage **order timestamps** (status history) | Operational fulfillment-time (2.2) real | M — capture status transitions |
| **P-5** | Customer coverage **~56%** (`customer_username` on ~half of orders) | RFM/CLV/Cohort completeness | ongoing — improve id capture at sync |

---

# Do NOT rebuild (per audit) — fix data, not UI

These already exist and are good; several are merely **starved of data**:

- **Ads ROAS panel, Meta funnel, Ads monitoring** — built, but they read
  `AdSpentMeta/Shopee/TikTok/Lazada` + `AdsMonitoring`, which are **EMPTY**. The **real**
  ad spend is in **`AdSpentSocialMedia` + `Marketing`**. **⚠ This is a data-source
  mismatch to FIX (point the panels at real tables, or import marketplace ad data), NOT a
  rebuild.** New work = the *Allocation* view (1.1), a different question.
- **Per-campaign `PerformanceChart`** (daily spend/GMV/views, selectable axes) + the
  **expense-vs-GMV / engagement panel** — keep. New work = *cross-campaign Efficiency* (1.2).
- **Talent payment report** (Total Spent / Hutang / Piutang, donut by type) — keep. New
  work = *Talent ROI* (2.1), the return side.
- **/sales profitability quadrant + margin Pareto** — keep. Finance Margin (1.4) is the
  *period P&L* angle, not another SKU quadrant.

---

# Status tracker

| # | Module | Wave | Data | Status |
|---|---|---|---|---|
| — | BCG Product Matrix (traffic + CTR) | (pilot) | dummy axes (honest) | ✅ COMPLETE |
| 1.3 | RFM Segmentation | 1 | real + dummy padding | ✅ COMPLETE (page, browser-verified) |
| 1.1 | Ads Spend-Allocation | 1 | real | ✅ COMPLETE (page, browser-verified) |
| 1.2 | Campaign Content Efficiency | 1 | real (GMV self-reported) | ✅ COMPLETE (page, browser-verified) |
| 1.4 | Finance — Gross Margin | 1 | real | ✅ COMPLETE (page, browser-verified) |
| 2.1 | Talent ROI | 2 | real cost + dummy return | ✅ COMPLETE (page, 24/24 browser-verified) |
| 2.2 | Operational | 2 | mixed (status/stock real, fulfilment dummy) | ✅ COMPLETE (page, 20/20 browser-verified) |
| 2.3 | Cohort Retention | 2 | 1/36 real, "becomes real w/ time" | ✅ COMPLETE (page, 18/18 browser-verified) |
| 2.4 | Market Basket | 2 | real, small-sample | ✅ COMPLETE (page, 22/22 browser-verified) |
| 3.1 | CLV | 3 | dummy projection | 🔴 not started |
| 3.2 | True ROAS / Attribution | 3 | dummy (blocked on P-1) | 🔴 not started |
| 3.3 | Finance — Net P&L | 3 | config/dummy | 🔴 not started |
| 3.4 | AI Forecasting | 3 | structure + honest gate | 🔴 not started |

**Next build:** **WAVE 1 ✅ + WAVE 2 ✅ COMPLETE — 9 deep-analysis modules** (BCG pilot +
RFM + Ads-Allocation + Campaign-Efficiency + Finance Gross-Margin + Talent ROI + Operational
+ Cohort Retention + Market Basket), all page-complete + browser-verified (Playwright +
NextAuth), all BCG-standard (engine-owns-logic · compact components · chart theme · DataGrid).
→ **Start Wave 3** (CLV · True ROAS/Attribution · Net P&L · AI Forecasting) — the **MOST
SPECULATIVE wave** (mostly-dummy / needs accumulation). **AI Forecasting (3.4) needs careful
honest treatment: build the STRUCTURE + an honest "needs ≥12 months history (currently N)"
gate — NOT a fabricated forecast line; the LLM is for narrative, never numeric prediction.**
**Recommend starting Wave 3 in a fresh session** given the shift in character (speculative,
config-driven, structure-only).

---

# The FIVE honesty-framing patterns (established across Wave 1 + 2)

Pick the framing that fits the module's **data situation** — don't default to one. All five
are proven and in production:

1. **Dummy banner** (prominent orange "positions/values are fabricated / not real") —
   when a core axis or output is fabricated. **Used by: BCG** (visitor/ctr axes), **Cohort
   Retention** (1/36 real, retention curves projected).
2. **Neutral real-data note** (grey, states the one caveat that matters, not a warning) —
   when everything is real but with a single honest limitation. **Used by: Ads-Allocation**
   ("no ROAS"), **Finance Gross-Margin** ("gross, not net"), **Campaign Efficiency** ("GMV
   self-reported, not attributed"), **RFM** ("56.57% coverage").
3. **Per-section mixed** (real sections plain · dummy section banded orange + badged) —
   when real and fabricated coexist in one page. **Used by: Talent ROI** (REAL cost ÷ DUMMY
   return, slate/orange split everywhere), **Operational** (status/stock/cancellation real ·
   fulfilment time dummy/orange-banded).
4. **"Becomes real with time"** (dummy now, but self-healing — no backfill, just elapsed
   time + continued sync) — the most optimistic framing. **Used by: Cohort Retention**
   (each diagonal turns real as months pass).
5. **Small-sample real** (100% real, but thin — honesty is about *sample size*, not dummy;
   surface the real denominator + a `smallSample` flag + per-item weak-signal markers).
   **Used by: Market Basket** (25 multi-item orders, n=1 dashed edges / faded cells / badges).

**Wave 3 guidance:** CLV → (1) dummy banner (projection). True ROAS → (1) until Plumbing
P-1 backfills attribution. Net P&L → (3) per-section (gross real, net config/dummy). **AI
Forecasting → a SIXTH posture: the honest GATE** — show the structure but render *"needs ≥12
months history; currently N — forecast not yet available"* instead of any line. **Never a
fabricated forecast; the LLM narrates, it does not predict numbers.**

---

# The pattern that worked (Waves 1–2)

The proven recipe — every Wave-1 and Wave-2 module shipped this way:

1. **Foundation-then-page (two prompts).** First a *foundation* prompt (engine +
   `*_DATA_SOURCES.md` honesty doc, self-verified via a throwaway Next route), then a
   separate *page* prompt (UI + modals + sidebar link, browser-verified). Keeps each step
   small and independently verifiable.
2. **Engine-owns-logic.** All computation lives in `lib/analytics/<module>-summary.js`
   (tenant-scoped, Decimal/BigInt→Number, `dummy` flag on every response). The page
   **never recomputes** — it fetches a thin dispatch route (`/api/analytics/<module>?view=…`)
   and renders. Routes use **sequential awaits** (Supabase `connection_limit=1` — never
   `Promise.all` a fan-out).
3. **Real/dummy honesty, two flavors:**
   - **Dummy-axis modules → prominent orange banner** ("positions are fictional"), per-row
     `dummy` badges, `dummy:true` (BCG: visitor/ctr fabricated).
   - **Real-data modules → neutral grey note** stating the one caveat that matters
     (Ads: "no ROAS"; Campaign: "GMV self-reported, not attributed"; Margin: "gross, not
     net"; RFM: "56.57% coverage + dummy padding"). Never overclaim; surface coverage /
     measured-subset / thin-range honestly; `hasData:false` empty-states, never fabricated.
3a. **REAL÷DUMMY split made VISUAL (Wave 2, Talent ROI — the sharper case).** When a
    single metric mixes real and fabricated halves (ROI = REAL cost ÷ DUMMY return), a
    banner isn't enough — encode the split in **consistent color** so it's unmistakable at
    every glance: **slate `#3F4E4F` = REAL, orange `#E07B39` = DUMMY**, applied uniformly
    across KPI tiles (slate vs orange + `dev` badge), chart **axis labels** (the dummy axis
    is named "… (DUMMY)"), **table headers** ("Cost · REAL" / "ROI · DUMMY"), and a
    dedicated **grouped bar where the two colors ARE the split** (cost slate vs return
    orange, side by side). Detail modals use slate- vs orange-**bordered blocks** so the
    real and dummy halves never read as one number. Engine carries explicit
    `costReal:true` + `returnDummy:true` on every response. Reuse this for any future
    mixed-real/dummy metric.
4. **Fit-for-purpose charts, BCG-quality interaction — VARIETY IS A GOAL.** Same quality
   bar (detail modals, theme colors, compact components, DataGrid + `onRowClick`, clear
   highlighting) but **pick the chart that fits each analysis's *shape*, and prefer variety
   over a repeated default** — even *within* one module (Talent ROI deliberately uses 4
   distinct forms: quadrant + leaderboard + **dumbbell** + **radar**). When two companion
   charts would both be bars, swap one for a different form that reads the data better.
   **Chart-form catalog in/available for use:**
   - **quadrant / bubble** — two-axis positioning (BCG · Campaign · Talent ROI)
   - **scatter + grid** — segment maps (RFM)
   - **Pareto** — 80/20 concentration (Ads · Margin)
   - **treemap / share donut** — composition (Ads)
   - **waterfall** — additive build-up (Margin: revenue→−COGS→profit)
   - **ranked / leaderboard bar** — ordering (Talent ROI)
   - **diverging / grouped bar** — two series compared per row
   - **dumbbell** — two points per row connected (Talent cost-vs-return; great for A-vs-B)
   - **radar** — multi-axis profile per group (Talent type; normalize per-axis, real values in tooltip)
   - **Lorenz curve** — inequality/concentration (e.g. customer-value, talent-value)
   - **funnel** — stage conversion (Operational 2.2)
   - **triangular heatmap** — cohort retention (Cohort 2.3 — matrix plugin, SSR-safe)
   - **network graph + affinity-matrix heatmap** — co-occurrence (Market Basket 2.4)

   Reach for whichever fits; **don't default to a bar four times.** Honesty encodings
   (REAL/DUMMY color, normalized-axis tooltips) must survive whatever form is chosen.
5. **Reuse the foundation:** chart theme, `DataGrid`, `CompactPage/Topbar/IconKpiStrip/
   CompactPanel/StatCard`, and existing engines (e.g. Margin reuses `compute-hpp`).
6. **Browser-verify, then clean up.** Playwright + real NextAuth login (tenant 2),
   capture API payload + canvases + KPI tiles + console errors + screenshot; cross-check
   totals against raw SQL; delete the throwaway route + temp shots before reporting.

## ⚠️ Wave 2 changes the honesty posture — dummy returns

Wave 1 was real-data-first (mostly neutral notes). **Wave 2 RE-INTRODUCES fabricated
data**, so each module goes **back to BCG-style dummy banners + `dummy:true` flags**:

| Module | Real part | Dummy/missing part → needs banner |
|---|---|---|
| **Talent ROI** | cost (`TalentPayment`, real) | **return is dummy** — `TalentContent.campaignId` is 100% null, Talent∩Affiliate = 0 (no revenue link) |
| **Operational** | status / stock / volume (real) | **fulfillment-time dummy** — no per-stage order timestamps |
| **Cohort Retention** | cohort logic (real) | **mostly dummy** — history too thin for real retention triangles |
| **Market Basket** | OrderItem co-occurrence (real) | **Cleora-only** — affinity exists only for tenant 2; empty-state elsewhere |

Apply the same dummy-axis discipline as BCG: prominent banner, per-row/section `dummy`
badges, never present fabricated returns/positions as real.
