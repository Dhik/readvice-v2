# Project Status — readvice-v2

> **Living document.** The entry point for understanding this project's current
> state — for humans returning after a break, and for Claude in future sessions.
> Update it (see [How to use this document](#how-to-use-this-document)) whenever a
> module's status changes significantly.
>
> _Last updated: 2026-06-13._

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
| Analytics (Product + Order Analysis) | ✅ SP1, SP2 COMPLETE (SP3–SP5 planned) |
| Connector System (Google Sheets) | ✅ COMPLETE for `order_sync` + `product_sync` (CS5b ⏳ pending user) |
| Mobile responsiveness | ✅ COMPLETE |
| Layout components | ✅ COMPLETE |

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

## Analytics — ✅ SP1, SP2 COMPLETE & VERIFIED

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

### Analytics roadmap (planned, not built)

- **SP3** — Customer Analysis
- **SP4** — Advanced (RFM / Pareto / basket analysis)
- **SP5** — BCG / Cohort / Growth

Advanced & historical analyses need **accumulated history**: the structure gets
built, the numbers fill in as data syncs over time.

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
| **CS5b** | ⏳ | **PENDING USER ACTION** — configure the remaining 11 connectors' `sheetTab`/`columnMapping` using CS5a preview, **once real Google credentials are set up** (see `docs/CONNECTOR_SETUP.md`) |

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
  exist identically in `sales/page.jsx`, SP1, and SP2 — a **consistent pre-existing
  data-fetch pattern**, not SP2-specific. App-wide cleanup candidate.
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
  the TZ-1 issue, the column-T conflict).
- **Keep it living:** update this document (when asked) whenever a module's status
  changes significantly — mark phases ✅/🟡/🔴/⏳, move items out of the backlog as
  they're resolved, and refresh the _Last updated_ date. It is a **living
  document, not a one-time snapshot.**
