# BI Design — Curated Marketing Intelligence

> **This document is the constitution for all analytics / BI work.** Read it (and
> `PROJECT_STATUS.md`) at the **start of every session** before building anything in
> the Analytics section or adding charts/drill-down anywhere. It is the source of
> truth for the interaction pattern, the operational↔analytics boundary, the reusable
> components, and the phased roadmap. Update it when a foundation decision changes.
>
> _Status: APPROVED design, build not yet started (as of 2026-06-13)._

---

## Product vision

A marketing SaaS delivering **curated BI intelligence**: quality charts + deep
analyses (cohort, BCG, Pareto, RFM, segmentation, growth) with a consistent
**overview → drill-down → detail** interaction that helps brands manage marketing &
sales performance.

**It is NOT a build-your-own-query BI tool.** We ship *opinionated, curated insights*
with BI-grade interaction — every brand sees the right analysis without assembling it
themselves. Drill paths are **predefined per chart** (each chart declares its drill
dimension), not user-composed.

---

## PART 1 — Current state (audit, 2026-06-13)

### Operational pages
| Page | Shows now | Data accessed |
|---|---|---|
| **/dashboard** | KPIs (GMV, Nett, Orders, Qty, Avg Order, Channel); "Overview" panel; "Revenue Trend" `ChartPanel` with **fabricated** line + donut | `/api/sales/summary` |
| **/sales** | KPIs; `ChartPanel` (line = last-10 orders' GMV — trivial; donut = **real** platform split); paginated orders table; Import/Sync | `/api/sales`, `/sales/summary`, `/sales/platform-split` |
| **/orders** | Filters + search; paginated orders table; Import. No KPIs/charts | `/api/orders` |
| **/customer** | Month filter; raw order rows filtered to those with a customer name (**not** aggregated); mislabeled "Customer Cohort" | `/api/orders` |
| **/report** | KPIs; flat sales table (50 rows); **Excel export** | `/api/sales/summary`, `/api/sales` |

Models: `Order`, `OrderItem`, `Product`, `DailyHpp`; summary builders
`lib/analytics/{product,order}-summary.js`, `lib/hpp/compute-hpp.js`.

### Analytics pages
- **SP1 `/analytics/products`** — top-10 revenue bar, contribution donut, per-SKU
  **DataGrid**, **Pareto (80/20)**, product KPIs. Owns product/SKU-level.
- **SP2 `/analytics/orders`** — multi-period trend (zoom, day/week/month, 5-metric
  tooltip), AOV trend, status funnel, size distribution, day-of-week, platform-over-
  time (stacked), new-vs-returning split, orders-vs-AOV combo. Owns order-level
  temporal/distribution/funnel.
- **Chart system 2a/2b/2c** — `lib/charts/theme.js` (palette, `mergeOptions`,
  `baseOptions`, `zoomReady`, branded `Chart.defaults`, matrix+datalabels registered,
  datalabels OFF), `ChartPanel` (line/bar/doughnut toggle + `lineOptions`/
  `donutOptions`/`chartRef`), tooltips, x-axis zoom, selective datalabels, Pareto +
  combo (dual-axis).

### Reusable pieces already built
| Piece | What it does | Reuse for BI? |
|---|---|---|
| **DataGrid** (`components/table/DataGrid.jsx`) | tanstack: type-correct sort, global search, select/range filters, client pagination, empty/loading | **Detail-layer base**; extend for tree/expand |
| **theme.js** | palette/semantic/platform colors, `mergeOptions`, `baseOptions`, `zoomReady`, central registration | **Every BI chart inherits it** |
| **ChartPanel** | line/bar/doughnut + per-view options + `chartRef` | **Base for the drill-enabled chart card** |
| **Layouts** | `TwoPanelLayout` (A), `DetailLayout` (B), `TablePageLayout` (D) | Partial — need a **scrolling multi-card** shell |
| **KpiStrip, DateRangePicker, Modal** | KPI tiles, range filter, modal | Reuse (Modal → consider slide-over) |

**Known debts** (folded into phases below): fabricated /dashboard charts; same order
rows re-surfaced across /sales,/orders,/customer,/report; /customer mislabeled
"Cohort"; TZ-1 (UTC-day grouping); `.sv-page` fixed-height clipping; tooltip-popup
pixels not headless-capturable.

---

## PART 2 — The three foundations

### A. Interaction pattern: overview → drill → detail (one mechanism, everywhere)

Every analytics surface is a **drill stack** of `{ dimension, value, label }` levels in
page state. Charts are *overview*; clicking an element **pushes a level**; a **detail
panel** below re-renders for the current filter; a **breadcrumb** shows the path.

```
[ Breadcrumb:  All › Shopee › "3-Min Exfoliating Gel" ]            [Clear]
┌──────────────── overview chart(s) — BIChartCard ─────────────────────┐
│  click a bar/segment  ──►  pushDrill({ dimension, value, label })     │
└───────────────────────────────────────────────────────────────────────┘
┌──────────────── detail layer — DataGrid or TreeTable ────────────────┐
│  shows the slice for the current path; row expand → next level;       │
│  leaf row click → underlying records (DetailSlideOver)                │
└───────────────────────────────────────────────────────────────────────┘
```

**Mechanism (concrete):**
1. **Click a chart element** → chart.js `onClick` resolves `{datasetIndex, index}` →
   maps to the datum → `pushDrill({ dimension:'platform', value:'shopee', label:'Shopee' })`.
2. **State, not routes.** A `useDrilldown` hook holds the stack; pushing derives the
   filter applied to the detail layer (and optionally cross-filters sibling charts).
   Routes are too heavy and break the curated single-screen flow. *(Optional later:
   URL-sync the stack for shareable links.)*
3. **Detail updates in place** below the chart — **not** a modal — so context stays
   visible. Breadcrumb at top; **Clear** resets; clicking a crumb pops to that level.
4. **Leaf inspection** (raw records behind an aggregate) opens a **right slide-over**
   (`DetailSlideOver`), keeping the chart visible.

**Tree-table vs flat DataGrid (detail layer):**
- **Tree-table** when detail is **hierarchical with per-level aggregation** and the
  user expands within one view: `platform → product → SKU`, `month → week → day`,
  `category → product`.
- **Flat DataGrid** when detail is a **single-level list**: records behind one
  aggregate, or a ranked list with no parent/child.
- **Rule:** hierarchy + per-level aggregates → tree-table; flat records / single-
  dimension ranking → DataGrid. Drill and tree-expand compose (drill to Shopee →
  tree of products → expand to SKUs → click SKU → slide-over of its order lines).

### B. Operational vs Analytics boundary

> **RULE.** **Operational = the current period**: snapshot KPIs (+ Δ vs previous),
> current share/status, and a record table as the drill target. One period, minimal
> interaction. **Analytics (SP\*) = patterns across periods/dimensions**: trends,
> distributions, Pareto, cohort/RFM/BCG, segmentation, full overview→drill→detail.
>
> **No page is table-only** — every page gets ≥1 glance chart + KPIs; **the table is
> the drill-down detail layer**, never a standalone page. Overlaps resolve as a
> **snapshot chart/tile that links into the SP module** owning the deep version.

**Three-question test:** (1) multi-period trend or segment/rank/distribute? →
**Analytics**. (2) current-period headline / share / status / record table? →
**Operational**. (3) snapshot duplicates an SP deep view? → keep snapshot +
"View full analysis →".

| Page | Operational (glance + drill-to-detail) | Reserved for Analytics |
|---|---|---|
| **/dashboard** | Current-month KPIs **+ Δ vs last month**; **real** platform donut (drill); 14-day sparkline (links SP2). Replace fabricated charts. | Full trends → SP2; product mix → SP1 |
| **/sales** | KPIs+Δ; current platform donut (drill→table); this-month daily GMV bar (snapshot); orders detail table; Import/Sync | Multi-period trend/AOV/day-of-week/platform-over-time/funnel → **SP2** |
| **/orders** | Filter-summary KPIs; **status mini-donut** (snapshot, drill→table); orders table = detail | Distribution/funnel/size analysis → **SP2** |
| **/customer** | Customer **directory** aggregated by customer; KPIs (total, repeat); **new-vs-returning snapshot donut**; table → a customer's orders. Rename off "Cohort." | Cohort retention, RFM, LTV, segments → **SP3** |
| **/report** | KPI summary + **static** platform/status block + exportable table + Excel/PDF | Interactive/exploratory analysis → **SP\*** |
| **SP1/SP2 (+3-5)** | — | Own all deep analyses |

### C. Reusable components for the BI pattern

| Component | Extend or new? | Why |
|---|---|---|
| **`useDrilldown` + `<DrilldownProvider>` + `<Breadcrumb>`** | **New (core infra)** | Drill-stack state machine: push/pop/clear, filter derivation, breadcrumb. The contract everything plugs into. |
| **chart `onClick`→datum mapper** | **New (fiddly)** | Consistent element→`{dimension,value}` mapping across bar/line/doughnut/stacked/combo. The riskiest, most cross-cutting part. |
| **`<BIChartCard>`** | **New, thin — wraps `ChartPanel`/`<Chart>`** | Standard card: title + basis badge + "view full" link + chart with `onElementClick`→`pushDrill`. Composes ChartPanel, doesn't replace it. |
| **`<TreeTable>`** | **Extend DataGrid** | tanstack `getExpandedRowModel`+`getSubRows` + expander column. Reuse keeps sort/filter/search consistent. |
| **`<DetailSlideOver>`** | **New (or adapt Modal)** | Right slide-over for leaf record inspection; keeps chart visible. |
| **Scrolling multi-card shell** | **New / fix** | BI pages stack many cards; `.sv-page` is fixed-height `overflow:hidden` (clips). Needed before multi-card drill pages. |

---

## PART 3 — Phased roadmap

> **Dependency chain:** **F1a → F1b → F2 → (F3, F4 in parallel) → F5.**
> Sizes: S = ≤1 focused session, M = a few, L = multi-session / new analytical math.
> Every phase is **browser-verified** with the proven **Playwright + NextAuth harness**
> (headless Chromium, real login as `rocky@clerinagroup.com`, capture console errors +
> screenshots; canvas tooltips' popup pixels aren't headless-capturable — confirm
> render + zero errors + behavior, manual hover for the popup pixel).

### F1a — Core infra + app-wide fixes (riskiest first) · **L**
**Goal:** lay the drill contract and remove the structural blockers *before* anything is
built on top.
**Deliverables:**
- `useDrilldown` hook + `<DrilldownProvider>` + `<Breadcrumb>` (push/pop/clear, current-
  filter derivation).
- The **chart.js `onClick` → `{dimension,value,label}` mapper** that works across
  bar / line / doughnut / stacked / combo (the fiddly cross-type part).
- **TZ-1 app-wide fix** — promoted from caveat to foundation: month→week→day time-drill
  (F2+) and all date grouping must use a *correct, single* day-bucketing convention
  before drill is built on it. Fix importer + connectors + HPP + analytics +
  `getMonthRange` together; document the chosen convention. **Do not** patch per-view.
- **Scrolling multi-card layout shell** — fix `.sv-page` fixed-height `overflow:hidden`
  clipping so multi-card drill pages scroll (or a dedicated analytics shell).
**Depends on:** nothing (foundation).
**Verify:** unit-level drill state via a throwaway harness page (push/pop/clear +
breadcrumb); TZ-1 — recompute a known date near a boundary and confirm the bucket
matches local intent across importer/HPP/analytics; layout — load a tall multi-card
page at a normal desktop viewport and confirm **all cards reachable by scroll** (the
clipping bug that the F-series depends on).
**Clears debts:** TZ-1; `.sv-page` clipping.

### F1b — BI components (built on F1a) · **M**
**Goal:** the reusable building blocks every BI surface uses.
**Deliverables:**
- `<BIChartCard>` (ChartPanel/`<Chart>` wrapper: title + basis badge + "view full →"
  link + `onElementClick` wired to `pushDrill`; inherits 2a/2b/2c styling).
- `<TreeTable>` (DataGrid + `getExpandedRowModel`/`getSubRows` + indent/▸ expander).
- `<DetailSlideOver>` (right slide-over for leaf records).
**Depends on:** F1a (drill state + onClick mapper + scrolling shell).
**Verify:** a throwaway demo page wiring a `BIChartCard` → drill → `TreeTable` expand →
`DetailSlideOver`; confirm 0 console errors, breadcrumb path correct, expand/collapse +
slide-over open/close clean (no canvas-reuse / state leaks).

### F2 — Validate the pattern on SP2 · **M**
**Goal:** prove overview→drill→detail end-to-end on the richest existing module, then
**adjust F1a/F1b if the contract feels wrong** before spreading.
**Deliverables:** retrofit SP2 — platform-over-time → drill `platform → product → SKU`
(tree-table); status funnel → drill to that status's orders; trend period → (with TZ-1
fixed) drill `month → week → day`. Keep 2b zoom/tooltips/datalabels.
**Depends on:** F1a + F1b.
**Verify:** browser smoke — click a platform segment → breadcrumb + tree-table update;
expand to SKU; leaf → slide-over of order lines; Clear resets; zoom still works on the
trend; 0 errors. **This is the go/no-go gate** for the pattern.
**Clears debts:** none (SP2 already correct post-2c).

### F3 — Retrofit SP1 · **M**
**Goal:** product analysis on the pattern.
**Deliverables:** Pareto / contribution → drill to SKU detail (tree `category → product
→ SKU` if category data supports it, else flat SKU DataGrid → slide-over of that SKU's
order lines). Reuse F1b components.
**Depends on:** F1a + F1b; F2 lessons applied.
**Verify:** browser smoke — drill from a Pareto/contribution element to SKU detail;
slide-over of underlying lines; 0 errors; Pareto/contribution unchanged otherwise.

### F4 — Operational pages (glance + drill-to-detail) · **M**
**Goal:** bring all operational pages to the boundary in §B — every page gets glance
charts + a drill-to-detail table; **no page table-only**.
**Deliverables:**
- /dashboard: **replace fabricated** trend/donut with real current-month KPIs+Δ + real
  platform donut + 14-day sparkline (links SP2).
- /sales: KPIs+Δ + current platform donut (drill→orders) + this-month daily GMV bar.
- /orders: filter-summary KPIs + status mini-donut (drill→table).
- /customer: **rename off "Cohort"**; customer **directory** aggregated by customer +
  new-vs-returning snapshot donut + drill→a customer's orders.
- /report: KPI summary + static platform/status block + export.
- De-duplicate the order-rows table so /orders is canonical; others differentiate.
**Depends on:** F1a + F1b (uses BIChartCard + detail table); F2 pattern proven.
**Verify:** browser smoke per page — glance charts render with **real** data (no
fabricated values), drill→table works, 0 errors; confirm no operational chart
duplicates an SP deep view (each links out instead).
**Clears debts:** fabricated /dashboard data; /customer "Cohort" mislabel; order-rows
table duplication.

### F5 — New analytical modules SP3 / SP4 / SP5 · **L**
**Goal:** the genuinely new deep analyses, built natively on the pattern.
**Deliverables:** **SP3 Customer** (cohort retention, RFM, LTV, segments); **SP4
Advanced** (basket/affinity, advanced RFM); **SP5 BCG / Cohort / Growth** (BCG matrix,
growth curves, cohort grids).
**Depends on:** F1a + F1b + the pattern validated (F2); **data-availability dependency
— SP5 (and cohort/retention in SP3) need ACCUMULATED HISTORY** (multiple months/weeks).
Current data spans ~days (see TZ-1/data notes). **Flag:** build the structure when the
math is ready, but cohort/growth/BCG **numbers fill in as history accrues** — show
"needs more history" states rather than faking, consistent with the "never dummy"
principle.
**Verify:** browser smoke per module + correctness spot-checks of the new math (RFM
scoring, cohort buckets, BCG quadrant thresholds) against direct queries, **through the
live HTTP endpoint + render** (per the SP1/SP2 lesson: don't verify summary functions
via raw SQL only — exercise the real route + page).

### Carried (not phase-specific)
- **Tooltip-popup pixel verification** — canvas tooltips aren't reliably headless-
  screenshot-capturable; every phase confirms render + 0 errors + behavior, and the
  popup pixel is a **manual browser hover** (carry this caveat in each verification).

---

## How to resume (read this first, every session)
1. **Read `docs/BI_DESIGN.md` (this file) + `docs/PROJECT_STATUS.md`** before touching
   any analytics/BI code. This doc governs the interaction pattern, the operational↔
   analytics boundary, the reusable components, and the phase order.
2. **Build strictly in phase order** (F1a → F1b → F2 → F3/F4 → F5). Don't build a
   component before its dependency phase; don't add a chart that violates §B.
3. **Honor the boundary (§B)** and the "curated, not DIY" principle (§ vision) for
   every new chart — predefined drill paths, snapshot-links-to-SP for overlaps.
4. **Verify in the browser** (Playwright + NextAuth) at the end of each phase, through
   the live endpoint + render, and update `PROJECT_STATUS.md` with results.
5. When a foundation decision changes, **update this doc** — it is the source of truth.
