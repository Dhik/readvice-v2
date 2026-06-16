# Project Status — readvice-v2

> **Living document.** The entry point for understanding this project's current
> state — for humans returning after a break, and for Claude in future sessions.
> Update it (see [How to use this document](#how-to-use-this-document)) whenever a
> module's status changes significantly.
>
> _Last updated: 2026-06-14._

**What it is:** Multi-tenant marketing SaaS, migrated **Laravel → Next.js 16**
(Prisma / Postgres-Supabase, NextAuth JWT). Dev port **3006**.

**Status legend:** ✅ COMPLETE · 🟡 PARTIAL · 🔴 NOT STARTED · ⏳ PENDING USER ACTION · ⏸️ DEFERRED (by decision)

---

## House conventions

- **Tenant-scope every query** via `session.user.tenantId`.
- **`Decimal` / `BigInt` → `Number()`** before JSON responses.
- **sweetalert2 + react-hot-toast** for UI feedback.
- **FontAwesome** icons; **`.sv-*` CSS classes** + **`@theme` tokens**.
- **`prisma db push`** (not `migrate`).
- **Campaign module = the visual/structural reference** for page polish.

---

## Module status at a glance

| Module | Status |
|---|---|
| Campaign | ✅ COMPLETE |
| Ads | ✅ COMPLETE |
| Talent | ✅ COMPLETE |
| Affiliate (Shopee + TikTok) | ✅ COMPLETE |
| Tenant management | ✅ COMPLETE |
| AI Agent (AI-1…AI-6) | ✅ COMPLETE |
| Subscription System (S1–S4, S6) | ✅ COMPLETE (S5 skipped) |
| Sales / Orders / HPP | 🟡 PARTIAL (O1, NP1, NP2a, NP2b ✅; NP3 NetProfit ⏸️ deferred) |
| Analytics (Product + Order Analysis) | ✅ SP1, SP2 COMPLETE (BI pattern per **`docs/BI_DESIGN.md`**) |
| Deep-Analysis modules (governing plan: **`docs/ANALYTICS_ROADMAP.md`**) | 🟡 IN PROGRESS — **Wave 1 ✅ + Wave 2 ✅ COMPLETE (9 modules)**: BCG · RFM · Ads-Allocation · Campaign-Efficiency · Gross-Margin · Talent ROI · Operational · Cohort · Market Basket — all page-complete + browser-verified. **Wave 3 🔴 next** (CLV / True ROAS / Net P&L / AI Forecasting — most speculative) |
| Compact dashboard pages (dashboard, sales, orders, customer, report) | ✅ COMPLETE (rebuilt on `@/components/dashboard/*` compact foundation) |
| Visit / AdSpend dummy infra (dashboard KPIs) | ✅ COMPLETE (models + seeder + clear script; `source='DUMMY'`, dev-badged) |
| Connector System (Google Sheets) | ✅ COMPLETE for `order_sync` + `product_sync` (CS5b ⏸️ on hold) |
| Mobile responsiveness | ✅ COMPLETE |
| Layout components | ✅ COMPLETE |
| DataGrid (interactive table) | ✅ COMPLETE (SP1/SP2 retrofitted) |
| Chart system (shared theme) | ✅ 2a (18 charts) + 2b (interactivity) + 2c (new types) COMPLETE |

---

## Core modules — ✅ COMPLETE & VERIFIED

- **Campaign** — scraping, import, wiring, full visual polish (the reference).
- **Ads** — 4-platform import, KPI, charts, monitoring, ROAS, layout polish.
- **Talent** — CRUD, content, payments, report, approval, Campaign bridge
  (E2E 16/16), exports (Invoice PDF, SPK PDF per-tenant, Excel).
- **Affiliate** — Shopee + TikTok.
- **Tenant management** — pivot table, brand switcher, session sync.

---

## AI Agent — ✅ COMPLETE & VERIFIED (AI-1 → AI-6)

| Phase | What |
|---|---|
| AI-1 | Prototype ads analysis |
| AI-2 | Persistent chat (`AiConversation`/`AiMessage`), compaction at ≥20 messages, tenant + user scoped |
| AI-3 | Usage tracking (personal + tenant aggregate); cost formula Sonnet **$3 / $15 per 1M** |
| AI-4 | On-demand charts via keyword triggers; server-side `validChart()` gatekeeper |
| AI-5 | Multi-source context (Ads + Campaign), keyword routing via `lib/data-context.js` |
| AI-6 | Extended to **Talent** (PII-stripped, permission-gated on `view_talent`) + **Affiliate** (Shopee + TikTok) |

---

## Subscription System — ✅ COMPLETE (S1–S4, S6; S5 skipped)

External SaaS billing via **Midtrans**, **MANUAL renewal** (not auto-recurring),
self-service onboarding, **7-day trial**, **7-day grace period**.

**Plans** (seeded — IDs: `starter=1, pro=2, enterprise=3`):

| Plan | Price (IDR) | Users | AI | PDF exports | Multi-tenant |
|---|---|---|---|---|---|
| Starter | 750k | 5 | — | — | — |
| Pro | 1.5M | 15 | 500/mo | ✅ | — |
| Enterprise | 4M | unlimited | unlimited | ✅ | up to 5 |

| Phase | Status | What |
|---|---|---|
| **S1** | ✅ | `Plan`/`Subscription`/`PaymentRecord` schema, seeded |
| **S2** | ✅ | `/pricing`, `/register` (atomic transaction), `TrialBanner`, `/suspended` |
| **S3** | ✅ | `lib/payment-provider.js` (`MIDTRANS_MODE=mock\|live`), `lib/billing.js` `processPayment()` (idempotent), `/billing` page, `PayButton` |
| **S4** | ✅ | `lib/subscription-gate.js` (`getActivePlan` 60s cache, `assertFeature`, `assertAiQuota`); gates: AI message route (403/429), Talent PDF exports (`export-invoice`/`export-spk`), UI gates via `/api/billing/plan-features` |
| **S5** | 🔴 | Admin panel — explicitly **skipped/deferred** |
| **S6** | ✅ | `runExpiryChecks()` — 3 sweeps (trial→grace, active→grace **from `currentPeriodEnd+7d`, not `now+7d`**, grace→suspended); `CRON_SECRET` bearer auth, `/api/cron/test-trigger` (dev-only, superadmin). **⚠ Scheduled Vercel cron is currently DISABLED** for the Hobby test deploy (see backlog) — route + logic intact, manual runs via `/api/cron/test-trigger` |

**Backfill done:** 3 legacy tenants (`azrina-beauty=1`, `cleora-beauty=2`,
`delmoura=3`) given active **Enterprise** subs, `currentPeriodEnd=2099`.

---

## Sales / Orders / HPP migration — 🟡 PARTIAL (NP3 deferred by decision)

| Item | Status | Notes |
|---|---|---|
| **O1** | ✅ | Donut chart real data (platform-split endpoint), import created/updated counter fixed, `startDate`/`endDate` UI filter added |
| **NP1 — OrderItem dual-write (Option C)** | ✅ | `order_sync` now writes BOTH: `Order` = aggregate per `orderId`, `OrderItem` = one row per sheet line. **Replace-per-order** (no OrderItem unique key — `deleteMany` by `orderId` + `createMany`). **Write layer uses single awaited statements — NO `$transaction`** (Supabase pooler `connection_limit=1` can't run concurrent interactive tx; this was the fix for **564/655 transaction-timeout failures**). `WRITE_CONCURRENCY=5`. Live `cleora-shopee`: **606 orders, 643 OrderItems, 0 errors** |
| **NP2a — Product catalog (`product_sync`)** | ✅ | Sync engine extended to a **dispatcher**: `order_sync→Order` (untouched) **or** `product_sync→Product`. NEW **`decimal` transform** (`parseFloat`) for `harga_satuan` like `"18428.50"` (dot = **decimal**, not thousands — `currency` would make cost 100× too large). `cleora-products` (id 30) loaded **193 products** (tenant 2 Product count = 201, all `hargaCogs>0`). HPP SKU coverage **0/43 → 38/43 (88%)**. 5 unmatched bundle SKUs (`CL-WGS, CL-WGJB, CL-XJSS, CL-SSXFO, CL-HBCL`) yield 0 HPP — known gap |
| **NP2b — `DailyHpp` snapshot engine** | ✅ | `model DailyHpp` (grain **date+sku**, `@@unique[tenantId,date,sku]`, `hpp Decimal` **frozen at compute time = Option A snapshot**). `lib/hpp/compute-hpp.js`: `computeDailyHpp`, `getDailyHpp`, `getDailyHppTotalsByDate`, `normalizeSku`, `EXCLUDED_STATUSES`. **Replace-per-window**, no `$transaction`. SKU normalization strips leading `"<digits> "` prefix (OrderItem side only). `EXCLUDED_STATUSES` calibrated from real data + old-app strings (flagged **future per-tenant-configurable**). API `POST /api/hpp/compute` |
| **NP3 — NetProfit** | ⏸️ | **DEFERRED by decision** (see below) — not incomplete |

### NP3 (NetProfit) — ⏸️ DEFERRED BY DECISION

The old app's formula (`sales×0.78 − marketing − spent_kol − … − hpp`) is
**Cleora-specific** and not a credible general SaaS metric. Net profit needs
**standardized / configurable business rules** before it's trustworthy. **Decision:
focus on objective sales-performance analytics instead** (→ the Analytics section).
NP3 may return once business rules are designed. The foundation it would consume —
`getDailyHppTotalsByDate(tenantId, window)` — is already built and verified (NP2b).

---

## Analytics — ✅ SP1, SP2 + BCG Matrix + RFM Segmentation COMPLETE & VERIFIED

> **📐 GOVERNING PLAN: [`docs/BI_DESIGN.md`](BI_DESIGN.md) is the constitution for ALL
> analytics / BI work** (interaction pattern, operational↔analytics boundary, reusable
> components, phased roadmap F1a→F5). **Read it first, every session, before building
> any analytics/BI feature or adding charts/drill-down anywhere.** SP3–SP5, operational-
> page charts, and the overview→drill→detail pattern are all sequenced there.

**NEW SaaS product feature** (all tenants, **not** Cleora-specific). Sidebar
**Analytics** group → Product Analysis, Order Analysis (SP3–SP5 append here).
**On-the-fly compute** (no snapshot tables); **tenant-scoped, parameterized raw SQL**.

| Phase | Route | What |
|---|---|---|
| **SP1 — Product Analysis** | `/analytics/products` | Top products by revenue/qty, revenue-contribution %, per-SKU table (qty, revenue, #orders, avg price), unmatched-to-catalog handling (name falls back to `OrderItem.productName`, flagged, still counted). **`TwoPanelLayout`**. `lib/analytics/product-summary.js` (parameterized raw SQL, tenant-scoped, reuses `EXCLUDED_STATUSES`) |
| **SP2 — Order/Sales Analysis** | `/analytics/orders` | Time-series trend (day/week/month via `date_trunc`), AOV trend, **order-status funnel** (ALL statuses — **two-basis design** with `excluded` flags + on-card `all orders` / `excl. cancelled` badges), order-size distribution (`width_bucket`), day-of-week, platform-over-time (stacked), customer split (within-window new/returning, **~56% coverage, clearly labeled**), **conversion-rate placeholder** (`null` — no visit data yet, **NOT dummy**). **Custom responsive card grid** (6 visualizations exceed `TwoPanelLayout`'s Category A). `lib/analytics/order-summary.js` |

**Verified** (live data, this session): both modules passed tenant-isolation (#1
gate), metric-correctness, exclusion-basis, empty-tenant, and Decimal/BigInt→Number
gates. Both share SP1's summary-builder pattern (lib function + thin GET route).

> **⚠ CORRECTION (2026-06-13) — SP1 & SP2 were BROKEN via their live API endpoints.**
> The browser smoke (Fase 2a) found **`/api/analytics/products` and
> `/api/analytics/orders` returning 500**. Cause: the `availablePlatforms` query used
> `prisma.order.groupBy({ where: { platform: { not: null } } })`, but `Order.platform`
> is a **non-nullable** column, so Prisma throws `Argument 'not' must not be null`.
> **Fixed** in both `lib/analytics/product-summary.js` and `order-summary.js` (removed
> the invalid `{ not: null }` filter — nulls can't occur and are filtered in JS anyway).
> **Honest note:** these pages **likely never worked via the real endpoint** — the
> original SP1/SP2 "verification" exercised the summary functions via **raw SQL**, not
> the live `groupBy` path through the HTTP route, so the bug went undetected until the
> page was actually loaded in a browser. After the fix: SP1 renders its chart + grid,
> SP2 renders all 7 charts, both 200.

### Deep-analysis roadmap → **[`docs/ANALYTICS_ROADMAP.md`](ANALYTICS_ROADMAP.md)**

> **📐 GOVERNING PLAN for ALL deep-analysis modules.** Read it (with BI_DESIGN.md)
> before building any analytics module. It sequences every module **MOST REAL → MOST
> DUMMY** across 3 waves, with per-module specs (goal, real-vs-dummy data, fit-for-purpose
> chart, interaction, engine functions, dependencies, size), the **data-plumbing** track
> that unlocks real versions, and the **do-NOT-rebuild** list.

- **Pilot — BCG Product Matrix** `/analytics/bcg` (+ `/ctr`) **✅ COMPLETE & browser-verified.**
  Traffic×Conversion **and** CTR×Conversion lenses, bubble matrix + quadrant cards + products
  grid + detail/recommendations/advanced-filter modals. **Dummy axes (visitor/CTR), fully
  honest** — positions flagged fictional (banner + `dummy` badges); needs an external
  visitor/CTR feed to become real (see `BCG_DATA_SOURCES.md`).
- **WAVE 1 — ✅ COMPLETE & browser-verified** (all 5 page-complete; Playwright + NextAuth
  tenant 2, 0 console errors). The pattern that worked — **foundation-then-page** (engine +
  `*_DATA_SOURCES.md` honesty doc, then UI), **engine-owns-logic** (page never recomputes;
  thin dispatch route; sequential awaits for `connection_limit=1`), **real/dummy honesty
  in two flavors** (orange banner for dummy-axis modules · neutral grey note for real-data
  modules), **fit-for-purpose charts** (not a forced bubble) reusing theme/DataGrid/compact
  components, and **browser-verify + raw-SQL cross-check + cleanup**. (Full recipe in
  ANALYTICS_ROADMAP.md → "The pattern that worked".)
  - **RFM Segmentation** `/analytics/rfm` — real-derived (530) + dummy padding (50),
    **56.57% coverage** labeled; becomes fully real as coverage grows (recompute, no
    external source). `RFM_DATA_SOURCES.md`.
  - **Ads Spend-Allocation** `/analytics/ads-allocation` — **100% real (Rp4.29B)**,
    allocation-only (Pareto/share/trend/MoM), **NO ROAS** (no revenue link). Neutral note.
    `ADS_ALLOCATION_DATA_SOURCES.md`.
  - **Campaign Content Efficiency** `/analytics/campaign-efficiency` — real metrics, **GMV
    self-reported (not attributed)**, **measured 20/95**. Cost×reported-GMV quadrant +
    channel/tier bars + leaderboard. `CAMPAIGN_EFFICIENCY_DATA_SOURCES.md`.
  - **Finance Gross-Margin** `/analytics/gross-margin` — real **rev−HPP**, **gross-not-net**
    (marketing shown separately, not deducted), **blended 79.3% + covered 77.7%** margin,
    **coverage 93%**, uncovered SKUs flagged; Cleora-only empty-state. `GROSS_MARGIN_DATA_SOURCES.md`.
- **Wave 2 (partial dummy — RE-INTRODUCES dummy → BCG-style banners):**
  - **Talent ROI** `/analytics/talent-roi` — ✅ **COMPLETE & browser-verified (24/24)**.
    **ROI = REAL cost ÷ DUMMY return** (cost rateFinal Rp193M / paid Rp122M cross-checked
    real; return `TalentReturn` ~Rp353M dummy). **FOUR distinct chart forms** (deliberate
    variety, same engine data): **quadrant** (cost×return bubble) · **leaderboard bar**
    (ROI ranking) · **dumbbell** (per-talent cost point + return point connected, **slate=real
    / orange=dummy** — the clearest split; built as Scatter + afterDatasetsDraw connector) ·
    **radar** (talent type on **4 normalized axes**; tooltip shows **real values + REAL/DUMMY
    labels**, not the %). _(The original Cost-vs-Return grouped bar + Type bar were swapped
    for the dumbbell + radar — presentation only.)_ + detail modal + recs.
    **Visual pattern — REAL÷DUMMY split made visual** via consistent color-coding
    (**slate = real, orange = dummy**) across KPIs / quadrant axis / table headers / the
    dumbbell's two point colors / the radar's per-axis REAL/DUMMY tooltips, with
    slate-vs-orange bordered blocks in the detail modal — the sharper-than-BCG case where
    half the ratio is real. `TALENT_ROI_DATA_SOURCES.md`. (Payment report not rebuilt;
    empty-state confirmed on a no-talent tenant.)
  - **Operational** `/analytics/operational` — ✅ **COMPLETE & browser-verified (20/20)**.
    **MIXED per-section honesty** (not one banner): status funnel · cancellation trend ·
    stock velocity = **REAL** (plain); **fulfilment time = DUMMY** (`OrderFulfillment`,
    orange-banded). **4 forms:** funnel (+ Cancelled drop-off) · stock-velocity quadrant ·
    cancellation trend (24%→8.4% improving) · fulfilment histogram (dummy). **0% stock
    coverage handled honestly** — `Product.stock`=0 for all SKUs → only 2 bottom quadrant
    buckets + a note, no misleading 4-quadrant. `OPERATIONAL_DATA_SOURCES.md`.
  - **Cohort Retention** `/analytics/cohort` — ✅ **COMPLETE & browser-verified (18/18)**.
    **MOST dummy-heavy (1 real cell / 36)** but **"becomes real with time" — NO backfill**.
    **Triangular retention heatmap** (chartjs-chart-matrix, static/SSR-safe): 8 **dynamic**
    cohorts × periods 0–7, latest cohort p0 (530) REAL/green vs 35 orange dummy decay +
    acquisition bar + retention curve + real customer grid. `COHORT_DATA_SOURCES.md`.
  - **Market Basket** `/analytics/basket` — ✅ **COMPLETE & browser-verified (22/22)**.
    **REAL but SMALL-SAMPLE** (25 of 538 orders are multi-item → 34 pairs / 20 SKUs;
    `smallSample:true`). **TWO visual forms:** **force-directed network** (d3-force 3.0.0 +
    SVG, sim in useEffect, settles, **SSR-safe**) + **affinity matrix heatmap**. **n=1 single
    co-occurrences distinguished** (dashed edges · faded cells · `n=1` badges). Neutral
    small-sample note. `BASKET_DATA_SOURCES.md`.
- **🏁 Wave 1 + Wave 2 COMPLETE — 9 deep-analysis modules** (BCG · RFM · Ads-Allocation ·
  Campaign-Efficiency · Gross-Margin · Talent ROI · Operational · Cohort · Basket), all
  page-complete + browser-verified, all BCG-standard. **Five honesty-framing patterns now
  established** (pick what fits the data): (1) **dummy banner** [BCG/Cohort] · (2) **neutral
  real-data note** [Ads/Margin/Campaign/RFM] · (3) **per-section mixed** [Talent-ROI/
  Operational] · (4) **"becomes real with time"** [Cohort] · (5) **small-sample real**
  [Basket]. Full detail + chart-form catalog in `docs/ANALYTICS_ROADMAP.md`.
- **Wave 3 (NEXT — most speculative wave; mostly dummy / needs history):** CLV · True ROAS/
  Attribution · Net P&L · AI Forecasting. **AI Forecasting needs careful honest treatment —
  build the structure + an honest "needs ≥12 months history (currently N) — forecast not yet
  available" gate, NOT a fabricated forecast line; the LLM narrates, it does not predict
  numbers.** **Recommend starting Wave 3 in a fresh session** (shift in character).

Advanced & historical analyses need **accumulated history**: the structure gets
built, the numbers fill in as data syncs over time. _(Legacy SP3–SP5 labels are now
superseded by the wave plan above.)_

---

## Connector System (Google Sheets) — ✅ COMPLETE for `order_sync` + `product_sync`

Generic per-tenant connector config, **superadmin-only** admin UI.

| Phase | Status | What |
|---|---|---|
| **CS1** | ✅ | `DataConnector` model; `lib/connectors/transforms.js` (**7 whitelisted transforms**: `string`, `int`, `currency`, **`decimal`** (NP2a), `date_auto`, `date_dmy`, `static` — **NO eval / arbitrary code**); 12 `order_sync` connectors seeded (Cleora ×6, Azrina ×4, Delmoura ×2) |
| **CS2** | ✅ | Admin UI at `/settings/connectors` (superadmin-gated via `session.isSuperAdmin`, added to `lib/auth.js`); `FieldMappingBuilder`; server-side `validateColumnMapping` on all 5 routes |
| **CS3** | ✅ | `lib/connectors/sync-engine.js` — `syncConnector(connectorId)`, `applyTransform`/`parseDmy` (pure functions); `staticValues` merged **after** `columnMapping` (staticValues wins); `ORDER_COLUMNS` allowlist drops `salesChannelId` from the DB write (preserved in connector config). **NP2a extended this to a dispatcher** — `order_sync→Order` (incl. NP1 `OrderItem` dual-write) **or** `product_sync→Product` |
| **CS4** | ✅ | `validateGoogleCredentials()` in `lib/google-sheets.js` — clear error instead of cryptic OpenSSL `DECODER` error when `GOOGLE_SERVICE_ACCOUNT_JSON` is a placeholder |
| **CS5a** | ✅ | Sheet preview (`/api/connectors/[id]/preview`) — shows column indices + sample rows before configuring `columnMapping` |
| **CS5b** | ⏸️ | **ON HOLD** (user prioritizing analytics quality). Live audit done 2026-06-13 — only `sheetTab` is missing on the 11 connectors; full connector→tab map, the 3 layout families, and 2 open mapping decisions are recorded in **[backlog → CS5b checkpoint](#cs5b--remaining-connector-configuration--on-hold)** so it resumes without re-auditing |

**`cleora-shopee` (id=1) is the pre-configured template** for CS5b:
`sheetTab='Shopee Processed'`, `dataRange='A2:R'`, verified mapping for the
18-column "Processed" format → `orderId←0, orderDate←3, gmv←14, nett←16,
qty←12, status←17, customerUsername←6, customerName←7`. For the other 11: find
each platform's `*Processed` tab and use **Preview** to confirm column indices
(layouts may differ per platform).

---

## Mobile Responsiveness — ✅ COMPLETE

A single `@media (max-width: 768px)` block in `app/globals.css` fixes ~20 pages
via the shared `.sv-*` classes: `.sv-page`, `.sv-main`,
`.sv-table-panel`/`.sv-chart-panel`/`.sv-chart-panel-show`/`.sv-performers-panel`,
`.sv-kpi-strip` + `.kpi-tile`, `.sv-kpi-row*`. Plus 4 inner `grid-cols-2 →
grid-cols-1 md:grid-cols-2` (dashboard + 3× `TalentIndexPage`).

---

## Layout Components — ✅ COMPLETE (for future pages)

In `components/layout/`:

| Component | Category | Notes |
|---|---|---|
| `TwoPanelLayout` | A | KPI + table + chart |
| `DetailLayout` | B | 60/40 main + side — **more responsive** than `campaign/[id]/show` (its model), which doesn't stack today |
| `TablePageLayout` | D | single panel + scrolling table |

All reuse existing `.sv-*` classes and inherit responsive behavior automatically.
Demo at **`/layout-demo`** (unlinked — delete when no longer needed).

**When to use (validated this session):** SP1 uses `TwoPanelLayout` in production
(confirmed the component works — KPI + table + chart). **SP2 deliberately did NOT** —
its 6 visualizations are a **Category B dashboard**, so it uses a custom Tailwind
responsive grid of `.sv-*` cards (+ `KpiStrip`/`ChartPanel`). **Rule of thumb:**
one table + one chart → `TwoPanelLayout`; a multi-chart dashboard → custom grid
reusing the same `.sv-*` building blocks. Knowing when *not* to use the layout is
part of the design judgment.

---

## DataGrid — ✅ COMPLETE (interactive client-side table)

`components/table/DataGrid.jsx` — generic table on **@tanstack/react-table** with
built-in **sort (type-correct), global search, per-column filter (select/range),
client pagination** — all on already-fetched rows (no re-fetch). Styled with
`.sv-table-clean`. Column shape: `{ key, label, sortable, searchable, sortType,
align, render, format, filter, filterFormat }`; props `data, columns, searchable,
defaultSort, pageSize (0 = show all), emptyText, loading`.

**Distinct from** `components/table/DataTable.jsx` (server-paginated, used by
`/sales`) — DataGrid is for analytics aggregates fetched whole. Retrofitted into
**SP1** (per-SKU table) and **SP2** (status breakdown). SP3–SP5 reuse it.

---

## Chart system — ✅ Fase 2a COMPLETE (shared theme + 18-chart retrofit)

`lib/charts/theme.js` is the **single source of truth** for chart styling, replacing
~7 duplicated local palettes and ~10 scattered `Chart.register(...registerables)`
calls.

- **Exports:** `CHART_PALETTE` (9, brand-derived), `SEMANTIC` (success/warning/
  danger), `PLATFORM_COLORS` (Shopee `#EE4D2D` / TikTok `#010101` / Lazada `#0F146D`
  / Tokopedia `#03AC0E` / Meta `#1877F2`), `seriesColor()`, `platformColor()`,
  `withAlpha()`, `baseOptions`.
- **`applyChartTheme()`** sets `Chart.defaults` ONCE (Inter font, **branded dark
  tooltip**, legend, grid, animation) and **registers** controllers/elements +
  matrix (heatmap) + datalabels (**OFF by default**, opt-in per chart).
- **Central registration is bulletproof:** runs as a top-level side-effect on first
  import; **every** chart file imports a *named, used* export (never a bare import),
  so ESM eval order guarantees registration before any chart renders. Idempotent.
- **Plugins added:** `chartjs-plugin-zoom` (2b), `chartjs-chart-matrix` (heatmap,
  2c), `chartjs-plugin-datalabels`.
- **⚠ SSR gotcha (resolved):** `chartjs-plugin-zoom` pulls in `hammerjs`, which
  touches `window` at import → would crash SSR. It is **NOT** imported statically;
  it's loaded via a **client-only dynamic import** inside `applyChartTheme()`
  (`typeof window` guard). matrix + datalabels are SSR-safe and stay static.
- **18 charts retrofitted** (analytics, sales, dashboard, ads, ai-insights,
  affiliate ×4, campaign ×3, talent, market-research ×2). Notable visible changes:
  the **2 off-brand campaign charts repainted** to brand; **platform colors unified**
  app-wide; **TrendChart/IngredientsChart CSS-var-in-canvas bug fixed** (those colors
  rendered black before, now proper brand orange); branded tooltip everywhere.
- **Verified — `next build` + BROWSER smoke (2026-06-13):** `next build` compiles
  all routes (SSR-safe) and lint parity holds. Then **driven in a real headless
  Chromium (Playwright) through the actual NextAuth login**, across **11 chart
  pages** — **zero chart-registration / "Canvas is already in use" errors**
  everywhere. Campaign `PerformanceChart` (imperative `new Chart()`) confirmed to
  mount/destroy cleanly across **Trends↔Correlation ×4** toggles. Visually
  confirmed: **branded dark tooltip**, **platform-color unification** (Platform-
  Over-Time shows Shopee `#EE4D2D`), **off-brand campaign repaint** (Views now brand
  orange, was `#3498db`), and **datalabels OFF** by default. Pages that render charts
  only after data/interaction (`/market-research` needs a search; `/ads/ai-insights`
  needs usage data) loaded theme.js with zero errors but showed no canvas — expected,
  not a fault.

---

## Chart interactivity — ✅ Fase 2b COMPLETE (SP1/SP2 only, browser-verified)

Built on the 2a foundation; **scope is SP1 (Product Analysis) + SP2 (Order Analysis)
only** — prove the patterns here before spreading later. **Data & chart types
unchanged** (interactivity only). **Drill-down (click→detail) is deferred to a
separate future phase** (needs UX design).

- **Richer tooltips** (pull from already-fetched summary data — no new queries):
  - SP1 top-10 bar → revenue + contribution % + qty + # orders.
  - SP1 contribution donut → product name + revenue + % of total.
  - SP2 **trend hero → all 5 metrics for the period at once** (GMV, Nett, Orders,
    Qty, AOV) regardless of the active line — the standout (full context, no toggle).
  - SP2 status (count/%/GMV + excluded tag), size-distribution (count + % of orders),
    day-of-week (orders/GMV/qty), platform-over-time (platform + value + period).
- **Zoom/pan — SP2 trend hero ONLY** (the only true time-series): x-axis wheel/pinch
  zoom + drag-pan, constrained to the data range, with a **"Reset zoom"** control.
  Bar/donut/categorical charts get none.
- **Selective datalabels** (opt-in, 3 charts only): SP1 top-10 bar (revenue, compact
  IDR, **bar-view only** — hidden in line view), SP2 status bar (count), SP2
  size-distribution (count). **OFF everywhere else** (2a default).

- **Zoom-attach mechanism (the one real technical risk, solved):** `chartjs-plugin-
  zoom` loads via a **client-only dynamic import** (hammerjs touches `window` → SSR-
  unsafe), so it registers *asynchronously*. chart.js attaches plugins at chart
  **construction**, so theme.js exports a **`zoomReady` promise** → SP2 flips state on
  resolve → the trend `ChartPanel` is **keyed on that state** so it **remounts once,
  with zoom already registered**. **Verified at runtime:** `chart.resetZoom()`
  executes without error — that method only exists if the plugin actually attached to
  the instance.

- **API additions (no palette / no 2a-default changes):** `theme.js` gained
  `zoomReady` (promise) + `mergeOptions(base, override)` (deep-merge so a chart passes
  only deltas — tooltip callbacks / zoom / datalabels — without clobbering legend/
  scales). `ChartPanel` gained `lineOptions` / `donutOptions` / `chartRef` (generic;
  no chart-specific logic in the wrapper). Branded tooltip style still lives in
  `Chart.defaults` — callers add only *content*.

- **Verified — Playwright + NextAuth browser smoke (2026-06-13):** SP1 & SP2 render
  all charts with **zero console / chart-registration errors**; datalabels visually
  confirmed present on the 3 opt-in charts and **absent** elsewhere (incl. SP1 line
  view); zoom plugin attach proven via `resetZoom()`.
  > **⚠ Honest caveat:** the tooltip **popup pixels were NOT screenshot-captured** —
  > headless canvas-hover timing wouldn't reliably trigger/freeze the chart.js tooltip
  > (worst on the trend's ~2–3 data points). Confidence rests on: tooltip callbacks
  > travel the **same `mergeOptions → plugins` channel as datalabels** (which ARE
  > visually confirmed rendering with correct formatters), the callbacks are
  > code-correct, and **hovering produced zero console errors** (a throwing callback
  > would log). **Final pixel confirmation = a manual browser hover (pending user).**

---

## Chart new-types — ✅ Fase 2c COMPLETE (SP1/SP2 only, browser-verified)

Built on 2a (theme) + 2b (interactivity). **Guiding principle: only introduce a new
chart type where it's genuinely more insightful — insight > novelty.** Scope SP1/SP2;
data & chart types of existing charts unchanged except the two additions + one fix.

**Built (2 new types — both dual-axis mixed bar+line):**
- **SP1 — Revenue Pareto** (new full-width card below the two-panel layout): bars =
  revenue per SKU (desc) + **cumulative-% line** + **dashed 80% reference**. Answers
  *"how few SKUs make 80% of revenue"* — which neither the top-10 bar nor the
  contribution donut shows. Cumulative % computed in JS from existing `products[]`
  (no new query). 80% line via a constant dataset (no annotation plugin needed).
- **SP2 — Orders vs Avg Order Value combo** (new card): orders **bars** (left axis) +
  AOV **line** (right axis). Shows the volume-vs-basket-value relationship ("more but
  smaller baskets?") the trend's metric-toggle can't show together. Uses
  `timeSeries.orders` + `aovTrend.aov` (already fetched).
- **SP2 trend — AOV → line** (`fill:false`): area under an average/ratio implies
  accumulated volume and misleads; volume metrics (GMV/orders/qty) keep area, ratios
  (AOV) get a line. Nett stays a line over GMV's area.

**Dual-axis safety (both new charts):** second axis explicitly labelled + scaled
(Pareto right = `Cumulative %` fixed 0–100; combo right = `AOV (IDR)` compact), grid
drawn on the **left axis only** — neither can mislead.

**Deliberately NOT built (novelty, not insight):**
- **Day-of-week heatmap** — 7 values × 1 dimension → a bar is clearer. The only real
  2D would be weekday×hour (impossible — date-only data, TZ-1) or **weekday×week-
  number** (needs many weeks; data currently spans ~days). **Kept the bar; flagged
  weekday×week as FUTURE** once history accrues. The **matrix plugin stays
  registered-but-unused** rather than forced.
- **Platform 100%-share toggle** — deferred (optional); platform-over-time stays a
  proper stacked bar.

**Integration / no regressions:** both new charts are direct `<Chart type='bar'>`
(react-chartjs-2 mixed) inheriting 2a `Chart.defaults` + palette via `mergeOptions`;
**no changes to `theme.js` or `ChartPanel.jsx`**; 2b zoom (trend only) + tooltips
intact; datalabels OFF on the new charts.

**Verified — Playwright + NextAuth (2026-06-13):** SP1 = 2 canvases (ChartPanel +
Pareto), SP2 = 8 (combo added); **0 console / chart-registration errors**. Pareto
close-up confirms bars-desc + cumulative curve to 100% + 80% dashed + labelled dual
axes; combo confirms orders-bars + AOV-line on a labelled second axis; trend AOV is a
line; Reset-zoom still present. (Same tooltip-popup-pixel caveat as 2b — render + zero
errors + axis labels confirmed; popup pixels not headless-capturable.)

> **⚠ Pre-existing layout note (surfaced, not introduced by 2c):** `.sv-page` is
> fixed-height + `overflow:hidden` on desktop; SP1/SP2 stack more than one screen of
> cards and rely on `main`'s `overflow-y-auto` scroll. The Pareto sits as a sibling
> below `TwoPanelLayout` (its wrapper overrides `height:auto`) so it lands in `main`'s
> scroll and isn't clipped — verified reachable. The general "many cards in a
> fixed-height `sv-page` can clip on short viewports" is a **pre-existing** trait of
> these multi-card analytics pages — candidate for a future layout pass (see backlog).

---

## Key architecture decisions (this session — 2026-06-13)

- **Connector engine is now generic across 2 target tables** — `Order`
  (`order_sync`) and `Product` (`product_sync`) via a dispatcher. Proven
  extensible for future `*_sync` types.
- **Analytics = on-the-fly compute** (no snapshot tables) for now; pre-computation
  is deferred until performance demands it. (HPP's `DailyHpp` is the deliberate
  exception — a frozen snapshot for cost integrity.)
- **"Placeholder, never dummy"** — fields with no data source (visits, conversion
  rate, operational spend) render **"not yet available"**, never fabricated numbers.
  Summary objects are shaped so these slot in as optional keys later **without
  breaking existing consumers**.
- **`connection_limit=1` is load-bearing** — all write paths use single awaited
  statements, **never `$transaction`**, and the connection string must not change.
- **NetProfit deferred on principle** — an un-standardized, tenant-specific metric
  isn't shipped as if it were a general one; objective sales analytics first.

---

## Known issues / backlog (not yet scheduled)

- **`.sv-page` fixed-height clips multi-card pages on short viewports.** `.sv-page` is
  `height: calc(100vh-54px); overflow:hidden` on desktop — fine for single-screen
  table+chart pages, but the **multi-card analytics pages (SP2; SP1 + its Pareto)**
  stack more than one screen and rely on `main`'s `overflow-y-auto` to scroll. Cards
  beyond the first screen can be **clipped on short desktop viewports**. Pre-existing
  (since SP2 shipped); 2c's Pareto works around it (sibling below `TwoPanelLayout` with
  `height:auto`). Proper fix = a layout pass so `.sv-page` scrolls when content
  exceeds one screen (or a dedicated scrolling multi-card layout). Relates to the
  known `.sv-page` defined-twice in `globals.css`.

- **🔧 PROCESS — verify data-backed pages through the LIVE endpoint, not just the
  query.** SP1/SP2 shipped with a 500-on-load bug (see the Analytics CORRECTION)
  because their gate tested the summary **functions via raw SQL**, never the actual
  **HTTP route + render**. Internal-function checks and raw-SQL repros prove the
  query, not the route: serialization, Prisma argument validation (`groupBy`,
  filters on non-null columns), auth/session, and Decimal/BigInt→JSON all live in
  the route/render path and are invisible to a raw-SQL test. **Gate criterion for
  any data-backed page going forward:** hit the real endpoint (authenticated HTTP)
  **and** load the page in a browser (charts/tables actually render), not only the
  underlying function. (Playwright + NextAuth login is set up and proven — see the
  Fase 2a browser smoke.)

### CS5b — remaining connector configuration (⏸️ ON HOLD)

**ON HOLD** — user is prioritizing analytics quality (SP-series) over wiring the
remaining marketplace syncs. This checkpoint captures the full 2026-06-13 live
audit so CS5b can resume **without re-auditing the sheet**.

**State of the 11 unconfigured connectors (ids 2–12):** everything is already set
— `spreadsheetId`, `columnMapping` (seed), `dataRange`, `upsertKey`
(`["orderId","tenantId"]`), `staticValues` (platform + salesChannelId), and the
**correct new-DB `tenantId`** (cleora=2, azrina=1, delmoura=3; note the old-app
docs swap Cleora/Azrina). **The only thing missing is `sheetTab`** — all 11 still
hold the `"Sheet1"` placeholder and have never synced (`lastSyncAt=null`). ids
**1** (`cleora-shopee`) and **30** (`cleora-products`) are fully configured & live.

**All data is in ONE spreadsheet** — `1ksZm0fLUTdZbf8ITNQXxOizbhpOfjHj32nWAthDFyWI`
(titled "Clerina Services Cleora", **46 tabs**). **Azrina and Delmoura orders live
here too** — no separate spreadsheets needed. Each connector has a name-matched
**"Processed"** tab (clean 18/19/17-col layouts; the messy 49–52-col raw exports
are NOT for connectors).

**Connector → tab mapping (audited; high confidence):**

| id | connector (channel) | → tab | live data now? |
|---|---|---|---|
| 2 | cleora-shopee-2 (ch8) | `Shopee Processed 2` | ✅ yes |
| 3 | cleora-shopee-3 (ch9) | `Shopee Processed 3` | ✅ yes |
| 4 | cleora-tiktok | `Tiktok Processed` | ✅ yes |
| 5 | cleora-tokopedia | `Tokopedia Processed` | ✅ yes |
| 6 | cleora-lazada | `Lazada Processed` | ⚠️ empty (0 cols now) |
| 7 | azrina-shopee | `Azrina Shopee Processed` | ✅ yes |
| 8 | azrina-tiktok | `Azrina Tiktok Processed` | ⚠️ header only, `#N/A` |
| 9 | azrina-tokopedia | `Azrina Tokopedia Processed` | ⚠️ header only, `#N/A` |
| 10 | azrina-lazada | `Azrina Lazada Processed` | ⚠️ header only, empty |
| 11 | delmoura-shopee | `Delmoura Shopee Processed` | ⚠️ sparse/empty |
| 12 | delmoura-tiktok | `Delmoura Tiktok Processed` | ⚠️ `#N/A` |

→ **5 have live data NOW (ids 2, 3, 4, 5, 7)** — configure these first; they sync
real rows today. **6 are empty/`#N/A` (ids 6, 8, 9, 10, 11, 12)** — the "Processed"
tabs appear **formula-driven** (pull from raw tabs); they'll configure fine but
sync 0 rows until the sheet owner's formulas populate. That's a **data gap on the
sheet side, not a config blocker.**

**3 column-layout families (from row-1 headers):**
- **Shopee (18 cols, `A2:R`):** identical to the **verified id-1 mapping** — reuse
  verbatim: orderId 0, orderDate 3, sku 4, productName 5, username 6, customerName
  7, qty 12, gmv 14, nett 16, status 17. (ids 2, 3, 7, 11)
- **TikTok/Tokopedia (19 cols, `A2:S`):** orderId 0, sku 1, productName 2, qty 4,
  orderDate 6, username 7, customerName 8, status 13 — **gmv/nett undecided** (see
  below). (ids 4, 5, 8, 9, 12)
- **Lazada (17 cols, `A2:Q`):** orderId 0, orderDate 3, productName 5, sku 6, qty
  10, username 9, status 14 — single price col 8, **no customer-name column**.
  Differs from the seed's B4 mapping → needs remap. (ids 6, 10)

**2 unresolved mapping decisions (need user confirmation before applying):**
1. **TikTok/Tokopedia gmv vs nett:** col **5** (`SKU Subtotal After Discount`) vs
   col **18** (`Revenue`) — which is gmv and which is nett?
2. **Lazada:** only one price column (**8 `paidPrice`**) → use for both gmv & nett?
   And there is **no customer-name column** (username only) — leave `customerName`
   unmapped (null) or mirror the username?

**Also (optional, for SP1/product parity):** ids 2–12 lack `sku`/`productName` in
their seed mapping, so they'd populate `Order` but no `OrderItem`. Indices are
known per family above — add them when configuring to enable product-level
analytics for those tenants. Resume path: pick a connector → set its `sheetTab`
from the table → apply the family mapping (+ the 2 decisions) → sync.

- **⏰ Subscription-expiry cron is DISABLED** (`vercel.json` is `{}`) for the
  Hobby-plan test deploy — Hobby permits only a daily cron, so the trigger was
  removed to avoid the hourly-cron deploy error. `runExpiryChecks()` and
  `/api/cron/expire-subscriptions` are **intact**; manual runs work via
  `/api/cron/test-trigger`. **RE-ENABLE as a DAILY cron before real paying tenants
  exist** — add back to `vercel.json`:
  `{ "crons": [ { "path": "/api/cron/expire-subscriptions", "schedule": "0 0 * * *" } ] }`.
  Daily is sufficient (expiry is computed in DAYS). Safe to leave off now: the 3
  backfilled tenants have `currentPeriodEnd=2099`, so none expire imminently.

- **TZ-1 (now USER-VISIBLE — priority raised):** `Order.orderDate` stores date-only
  as `17:00 UTC` (= WIB midnight). Anything grouping by UTC day shows the prior
  local day. Originally an edge-case (month-boundary order dates vs `getMonthRange`,
  also in the XLSX importer), but as of **SP2 (2026-06-13)** it is **directly
  visible to end users**: the Order Analysis "Revenue by Day of Week" card groups
  by `EXTRACT(DOW)` on the UTC value, so a WIB-Saturday peak renders under Friday
  (and daily/weekly time-series buckets shift similarly). SP2 groups by UTC day
  *intentionally* (consistent with HPP/NP2b) and carries a prominent on-card note,
  but that is mitigation, not a fix. **Needs an app-wide fix** (importer +
  connectors + HPP + analytics + `getMonthRange` filters, together) — a one-off
  per-view shift would desync the modules. Pre-existing, **not** SP2-specific.
- **Column-T conflict** (Cleora 'Import Sales' sheet, `row[19]`): old app's
  `updateSpentKol` **and** `updateB2bAndCrmSales` both read this column for
  different fields (`spent_kol` vs `crm_sales`) — one is stale. Documented in
  `docs/SALES_GSHEET_CONFIG.md` Section F. Resolve via per-connector mapping when
  `netprofit_sync` is built.
- **`importNetProfits` (Cleora)** reads from **Azrina's** spreadsheet ID in the
  old app — verify intent before porting to `netprofit_sync`.
- **Multi-tenant analytics gap:** only **tenant 2 (Cleora) has `OrderItem` data** —
  the NP1 dual-write only ran for `cleora-shopee`. **SP1 and any OrderItem-based
  analytics show data only for Cleora** until the other 11 connectors (CS5b) are
  configured + synced. Other tenants have `Order` rows but **no `OrderItem`s**
  (SP2's Order-level views work for them; SP1/product views don't yet).
- **5 unmatched bundle SKUs** (`CL-WGS, CL-WGJB, CL-XJSS, CL-SSXFO, CL-HBCL`) get
  **0 HPP** (not in the product catalog) — may need product rows or combination-SKU
  support. Surfaced as `unmatchedSkus` (HPP) / unmatched-to-catalog (SP1).
- **Mixed-tenant Product POC:** tenant 2 also holds **Azrina `AZ-` products** —
  NP2a loaded all 193 rows to Cleora **ignoring the sheet's `tenant_id`**. Harmless
  for Cleora HPP (only `CLE-`/`CL-` SKUs join) but **not correct multi-tenant**;
  fix the loader to honor per-row tenant before onboarding more product sheets.
- **Connector system supports `order_sync`→`Order` and `product_sync`→`Product`.**
  `ad_spend_sync`/`visit_sync`/`netprofit_sync` exist in `CONNECTOR_TYPES` but
  have no sync engine yet. `netprofit_sync` is also blocked on the missing
  `NetProfit` model (NP3 deferred). **No `visit_sync` engine** is why SP2's
  conversion-rate is a placeholder.
- **SP2 value-bucket ladder is IDR-specific** (fixed `<100k / 100–250k / 250–500k /
  500k–1M / 1M+`) — revisit for adaptive/quantile buckets if a multi-currency
  tenant appears.
- **Lint:** `react-hooks/set-state-in-effect` (error) + `exhaustive-deps` (warning)
  exist identically in `sales/page.jsx`, SP1, SP2, and most chart pages — a
  **consistent pre-existing data-fetch pattern**. App-wide cleanup candidate. (Also
  benign: `react-hooks/incompatible-library` warning on `useReactTable` —
  React-Compiler can't memoize it; present on both `DataTable` and `DataGrid`.)
- **Local `npm run build` hits Prisma `generate` EPERM on Windows** when a node
  process (e.g. `next dev`) holds `node_modules/.prisma/client/query_engine-
  windows.dll.node`. Workaround: stop the dev server first, or run `npx next build`
  (skips the `prisma generate &&` prefix; client is already generated). **Not an
  issue on Vercel/Linux.**
- **🔐 Rotate the Google service-account key:** a service-account JSON was pasted
  into chat earlier this project. Even though it now lives only in `.env.local`,
  **recommend rotating the key in Google Cloud Console** (treat the pasted one as
  exposed).
- **`cleora-b2b` / `azrina-b2b` connectors excluded** from the CS1 seed (belong to
  the future `netprofit_sync` pipeline, no column map in current docs).
- **`.sv-page` defined twice** in `globals.css` (identical values, harmless
  redundancy) — dedup is cosmetic, not urgent.

---

## Verification results (claims checked against the codebase, 2026-06-12)

Quick checks (not a deep audit) of load-bearing claims:

- **`DataConnector`, `Subscription`, `Plan`, `PaymentRecord` models** in
  `prisma/schema.prisma` — **✅ verified** (lines 1019, 1068, 1046, 1088).
- **`lib/connectors/transforms.js` with the 7 transforms** — **✅ verified**
  (`string, int, currency, decimal, date_auto, date_dmy, static`).
- **`components/layout/` has the 3 layout components** — **✅ verified**
  (`TwoPanelLayout.jsx`, `DetailLayout.jsx`, `TablePageLayout.jsx`).
- **`DailyHpp` model now EXISTS and is populated** (NP2b) — _supersedes the
  2026-06-12 "no `DailyHpp`" note._ `OrderItem` is now **populated** for
  `cleora-shopee` (NP1). `NetProfit` model still absent — but that is now a
  **deliberate deferral (NP3)**, not pending work.
- Spot-checked existence: `lib/connectors/sync-engine.js`, `lib/subscription-gate.js`,
  `lib/billing.js`, `lib/payment-provider.js`, `lib/google-sheets.js`, `vercel.json`,
  `app/api/connectors/[id]/preview/route.js`, `docs/SALES_GSHEET_CONFIG.md`,
  `docs/CONNECTOR_SETUP.md` — **✅ all present**.

**No discrepancies found.**

### This session (2026-06-13) — live gate results

Each ran against the live DB (tenant 2 = Cleora) via the modules' exact SQL:

- **NP1 dual-write:** `cleora-shopee` → 606 orders, 643 OrderItems, **0 errors**
  (after the `$transaction`-removal fix; previously 564/655 timeouts).
- **NP2b HPP:** compute → 61 sku-rows, total HPP `11,110,404.2`, idempotent
  re-run (no doubling), snapshot spot-check matched, exclusion (Batal/Belum Bayar)
  honored — **all 6 gates ✅**.
- **SP1 Product Analysis:** tenant-isolation (totals == direct tenant-scoped recount;
  other tenant disjoint), metric spot-check, exclusion basis, unmatched-catalog
  fallback, empty-tenant, serialization — **all ✅**.
- **SP2 Order Analysis:** tenant-isolation (951 orders / 659,231,398 GMV ==
  direct recount), time-series & AOV correctness, status funnel sums to 1306 (all
  statuses) and real-sales = 1306 − 355 excluded = 951, granularity day≥week≥month,
  distribution sums to 951, customer returning-count == independent repeat-username
  count, `conversionRate: null`, empty-tenant, serialization — **all 7 gates ✅**.

---

## Key reference docs

- **`docs/BI_DESIGN.md` — 📐 the constitution for ALL analytics / BI work.** Interaction
  pattern (overview→drill→detail), operational↔analytics boundary, reusable components,
  and the phased roadmap (F1a→F5). **Read it before any analytics/BI build.**
- **`docs/ANALYTICS_ROADMAP.md` — 📐 the governing build plan for deep-analysis modules.**
  Sequences every module MOST REAL → MOST DUMMY (3 waves) with per-module specs, the
  data-plumbing track, and the do-NOT-rebuild list. **Read with BI_DESIGN.md before
  building any deep-analysis module.**
- **`docs/PLATFORM_DESIGN.md` — 📐 the next-phase plan beyond deep-analysis.** Covers nav/IA
  cleanup (A), calculated-fields foundation (B), Talent-ROI objective-aware/TOFU-MOFU-BOFU
  redesign (C), AI-agent on analytics pages (D), connector expansion to Drive/OneDrive (E),
  + open product questions (F). Each part has a numbered, copy-pasteable phase plan;
  **sequenced against Wave 3** (recommends A1–A3 + B1–B2 + C before Wave 3).
- `docs/BCG_DATA_SOURCES.md`, `docs/RFM_DATA_SOURCES.md` — per-module real-vs-dummy
  honesty maps + connector/recompute blueprints (the template every new module follows).
- `docs/SALES_GSHEET_CONFIG.md` — old-app Google Sheets config (spreadsheet IDs,
  column maps B1–B4, NetProfit update methods, scheduler, tenant/channel ID maps,
  3 warnings).
- `docs/CONNECTOR_SETUP.md` — how to set up the Google service account, configure
  connectors, `cleora-shopee` reference config.
- `docs/talent-implementation.md`, `docs/sales-orders-implementation.md` — other
  module references.

---

## How to use this document

- **For humans:** read this **first** when returning to the project after a break —
  it's the fastest way to recover the full picture without re-reading code.
- **For Claude in future sessions:** if asked to continue work on this project,
  **read this file first** for context **before** exploring the codebase. It
  records decisions, status, and gotchas that are not derivable from code alone
  (e.g. why `S5` was skipped, why `salesChannelId` is dropped from the Order write,
  the TZ-1 issue, the column-T conflict). **For any analytics / BI / charts / drill-down
  work, ALSO read [`docs/BI_DESIGN.md`](BI_DESIGN.md) (interaction/architecture) AND
  [`docs/ANALYTICS_ROADMAP.md`](ANALYTICS_ROADMAP.md) (what to build, in what order, how
  real the data is) — together they are the governing plan for that entire area.**
- **Keep it living:** update this document (when asked) whenever a module's status
  changes significantly — mark phases ✅/🟡/🔴/⏳, move items out of the backlog as
  they're resolved, and refresh the _Last updated_ date. It is a **living
  document, not a one-time snapshot.**
