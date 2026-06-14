# Talent ROI — Data Sources & Honesty Map

> **The sharpest dummy case so far: ROI = REAL cost ÷ DUMMY return.**
>
> Half the ratio is real, half is fabricated — so the split must be unmistakable. Every
> engine response carries **`costReal: true`** and **`returnDummy: true`** (plus
> `dummy: true` overall, since the ROI itself depends on the dummy half).
>
> - **COST = 100% REAL** — from existing talent tables (`Talent.rateFinal`,
>   `TalentPayment.amountTf`, `TalentContent.finalRateCard`). Verified against raw sums.
> - **RETURN = DUMMY** — `TalentReturn` (`source='DUMMY'`), because **no talent→revenue
>   link exists**: `Talent.username ∩ Affiliate = 0`, `TalentContent.campaignId` is
>   **100% null**, and `Order` has no talent attribution. Attributed revenue / GMV /
>   views / conversions are **fabricated**.
>
> This is the **ROI / performance** lens. It does **NOT** rebuild the existing Talent
> **payment report** (Spent / Hutang / Piutang by type) — that stays as-is.

---

## 1. Field-by-field source map

| Quantity | Source | Status |
|---|---|---|
| **Talent cost** (ROI denominator) | `Talent.rateFinal` | ✅ **REAL** |
| Amount paid | `SUM(TalentPayment.amountTf)` | ✅ **REAL** |
| Payment count / done | `TalentPayment` (status, donePayment) | ✅ **REAL** |
| Content cost / count | `SUM(TalentContent.finalRateCard)` | ✅ **REAL** |
| Talent name / type / username | `Talent` | ✅ **REAL** |
| Creator profile (followers, engRate, rate) | `KolProfile` (matched by username) | ✅ **REAL** (shared contact DB) |
| **Attributed revenue** (ROI numerator) | `TalentReturn.attributedRevenue` | ❌ **DUMMY** |
| Attributed GMV | `TalentReturn.attributedGmv` | ❌ **DUMMY** |
| Content views | `TalentReturn.contentViews` | ❌ **DUMMY** |
| Conversions | `TalentReturn.conversions` | ❌ **DUMMY** |
| **ROI** | `attributedRevenue / rateFinal` | ⚠️ **REAL ÷ DUMMY** → treat as illustrative |

`TalentReturn` is a **fabricated attribution layer** (own table). The real cost tables
are never modified — clearing dummy never touches real cost.

---

## 2. Data reality (tenant 2 — t1/t3 thin)

| Fact | Value |
|---|---|
| Talents | **24** (KOL 8 · Affiliate 7 · Content Creator 5 · Clipper 4) |
| **Total cost** (`rateFinal`) | **Rp 193,000,000** ✅ real |
| Amount paid (`amountTf`) | **Rp 121,999,000** ✅ real (45 payments, 31 done) |
| Content cost (`finalRateCard`) | **Rp 188,618,000** ✅ real (64 content rows) |
| **Attributed return** | **≈ Rp 419M** ❌ dummy |
| ROI spread (dummy ÷ real) | **0.5–5×**, realistic mix (~⅓ losers <1×, ~⅔ winners >1×) |

**Honesty rules the engine enforces:**
- `costReal: true` + `returnDummy: true` on **every** response.
- Cost figures cross-check against raw `Talent`/`TalentPayment`/`TalentContent` sums
  (the foundation self-verify confirms cost is **real**, not dummy).
- The MAIN quadrant's **y-axis is flagged DUMMY** (`Attributed return (DUMMY)`); the
  x-axis (cost) is real.
- Recommendations carry a `caveat` that return-based ranking rests on dummy data.
- New/empty tenant → `hasData:false`, no error. `source='DUMMY'` on every seeded row.

---

## 3. Data-plumbing path — DUMMY → real (no engine change)

`TalentReturn` is the swap point. Fixing **any** of the missing link keys lets a
recompute write **`source!='DUMMY'`** to the same table — the engine reads it unchanged
(exactly the BCG/RFM source-flag swap):

| Link debt (today) | Fix → unlocks |
|---|---|
| **`TalentContent.campaignId` is 100% null** | backfill it → join talent content → Campaign GMV (the per-campaign reported GMV) → attribute to talent |
| **`Order` has no talent attribution** | add a talent/creator attribution key on `Order` (or order line) → real attributed sales |
| **`Talent.username ∩ Affiliate = 0`** | reconcile talent identity ↔ `AffiliateShopee`/`AffiliateTiktok` creator usernames → real affiliate revenue per talent |

Any one of these turns the return side real. Recommended order: backfill
`TalentContent.campaignId` (smallest, unlocks campaign-GMV attribution) → then Order/affiliate
attribution for true sales. Until then, **return stays dummy and is flagged everywhere.**

This is **not an external connector** (unlike BCG's sheet) — it's internal link plumbing
+ a recompute job, like RFM.

---

## 4. Dev workflow

```bash
node scripts/seed-dev-talent-return.cjs    # tenant 2: DUMMY return for real talents (idempotent)
node scripts/clear-dev-talent-return.cjs   # remove source='DUMMY' (real cost tables untouched)
```

`db push` (not migrate) created `talent_return`, matching the BCG/RFM/Visit foundations.

---

## 5. Engine API (`lib/analytics/talent-roi-summary.js`)

All tenant-scoped; every response has `costReal: true` + `returnDummy: true`:

| Function | Feeds | Returns |
|---|---|---|
| `getTalentRoiOverview` | KPIs | total REAL cost/paid/content-cost, total DUMMY return/GMV, blended ROI, winners/losers |
| `getTalentRoiQuadrant` | **main chart** | cost (x, real) × return (y, **dummy**), bubble = views, quadrants |
| `getTalentRanking` | leaderboard bar | talents by ROI |
| `getTalentCostVsReturn` | diverging/grouped bar | per-talent real cost + dummy return paired (split visual) |
| `getTypePerformance` | type bar | ROI/cost/return by talent type |
| `getTalentDetail(talentId)` | detail modal | REAL block (cost/payments/content/KolProfile) + DUMMY block (return) — separated |
| `getRecommendations` | strategy | per-quadrant actions + caveat (rests on dummy) |

Quadrant labels/colors: `ROI_QUADRANTS` (Star / Premium / Overpriced / Low Impact).
