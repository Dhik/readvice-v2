# Net P&L — Data Sources & Honesty Map (Wave 3 §3.3 — the NP3 resolution)

> **The principle (why NP3 was deferred):** an un-standardized tenant-specific net metric must
> NOT ship as if it were a general one. The old `sales × 0.78 − …` formula was rejected for
> exactly that. Net P&L resolves it: every waterfall layer is **either REAL, or a factual
> overridable CONFIG default, or (opex) EMPTY until entered** — and while opex is empty the net
> is honestly **"before opex"**, never a fabricated number.
>
> Engine `lib/analytics/pnl-summary.js` · Routes `app/api/analytics/pnl` + `app/api/settings/pnl-config`
> · Page `app/(dashboard)/analytics/pnl` · Editor `app/(dashboard)/settings/pnl`. Only new
> persisted state: `TenantPnlConfig` (one row per tenant). Otherwise on-the-fly.

## Layer-by-layer

| Layer | Source | Honesty | Notes |
|---|---|---|---|
| **Revenue** | Gross-Margin `getMarginOverview().totalRevenue` (OrderItem subtotal, non-cancelled) | **REAL** | Reused, not re-derived — equals Gross-Margin revenue. |
| **− COGS** | `getDailyHppTotalsByDate` summed over the window | **REAL** | The frozen DailyHpp snapshot (NP2b). Equals Gross-Margin's HPP. |
| **− Platform fee** | `revenue_by_platform × platformFeePct[platform]` | **CONFIG-derived** | Factual default rates (below), `configDefault:true` until the tenant edits → `configured:true`. |
| **− Marketing** | Ads-Allocation `getAllocationOverview().totalSpend` | **REAL** | Reused, not re-derived — equals Ads-Allocation total (Rp4.29B). Only if `marketingDeducted`. Spend window may not overlap the sales window in dev (noted). |
| **− Tax** | `revenue × taxPct` | **CONFIG-derived** | Default 0.5% UMKM final income tax (PP 55/2022) on **gross revenue**; overridable. |
| **− Opex** | `Σ opexCategories` ({label, amount} or {label, pct}) | **USER-ENTERED** | **EMPTY by default** — never fabricated. When empty the layer is 0 and `entered:false`. |
| **= Net** | revenue − all layers | **REAL+CONFIG (gated)** | `net` is `null` while opex is empty; the engine emits `netBeforeOpex` + a gate note instead. |

**EXCLUDED_STATUSES / TZ-1:** inherited from the reused Gross-Margin / HPP computation (shared
raw-UTC day bucketing, shared cancelled-status exclusion). No re-derivation here.

## Factual config defaults (overridable in Settings → P&L Rules)

```
platformFeePct = { shopee: 8.0, tiktok: 8.0, tokopedia: 7.0, lazada: 6.0, default: 8.0 }  // researched mid-2026 marketplace admin fees
taxPct         = 0.5     // Indonesian UMKM final income tax (PP 55/2022), on gross revenue
opexCategories = []      // EMPTY — opex is business-specific, NEVER defaulted to a number
marketingDeducted = true
```

When **no `TenantPnlConfig` row** exists, these defaults are used and the fee/tax layers are
flagged `configDefault:true` ("default rate — edit in Settings"). Saving the editor creates the
row and flips them to `configured:true`. Defaults are **reasonable, not authoritative**.

## The opex gate (the NP3 honesty contract)

- `configComplete = opexCategories.length > 0`.
- While **false**: `net` is `null`; the engine returns `netBeforeOpex` + `opexEntered:false` + a
  note; the page shows **"Net before Opex"** (amber, gated) with a link to the editor — **NOT a
  final net**. The AI panel (with a `viewModule==='pnl'` guard) must say the net is gated on opex,
  name the real vs default-rate layers, and give **no fabricated final net**.
- After the tenant enters ≥1 opex category: `net` is the real figure (real layers − config layers −
  entered opex) and shows plainly.

**We never display a made-up net.** This is the entire resolution of the NP3 deferral.

## Becoming "fully real"

Revenue/COGS/marketing are already real. The fee/tax layers become *authoritative* (not just
reasonable defaults) the moment the tenant confirms/edits them. Opex becomes real the moment the
tenant enters it. No external source, no fabrication — just the tenant's own business rules.
