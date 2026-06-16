# Platform Design — Next-Phase Plan

> **Governing plan-doc for the next development phase** (same role/format as
> [`ANALYTICS_ROADMAP.md`](ANALYTICS_ROADMAP.md): every item has a phase number, concrete
> deliverables, files, dependencies, size — executable one prompt at a time). Covers:
> **A** user-flow/IA · **B** calculated fields · **C** Talent-ROI objective-aware redesign ·
> **D** AI agent on analytics pages · **E** connector expansion · **F** open questions.
>
> _Created 2026-06-14. Read-only design — no code/schema changes were made producing this._

## How to resume (read at the start of the next session)
1. **This doc** — the next-phase plan; each phase (A1, B1, C1…) is an independently
   executable prompt (goal · read-first · build · constraints · self-verify · size).
2. [`ANALYTICS_ROADMAP.md`](ANALYTICS_ROADMAP.md) — Waves 1–2 ✅ (9 modules); Wave 3 next;
   the 5 honesty-framing patterns + chart-form catalog + "the pattern that worked".
3. [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — current module status.
4. [`BI_DESIGN.md`](BI_DESIGN.md) — interaction constitution (overview→drill→detail; F1a
   drill-down still pending).

**How this relates to Wave 3 / BI F1a** — see [Sequencing](#sequencing) at the end.

---

# PART 0 — AUDIT (current state)

### Operational pages (5) + compact components
`/dashboard · /sales · /orders · /customer · /report`, all on `@/components/dashboard/*`
(`CompactPage`, `CompactTopbar`, `IconKpiStrip`, `CompactPanel`, `StatCard`/`MetricRow`) +
`@/components/table/DataGrid` (client sort/filter/search, `onRowClick`) + `DataTable`
(server-paginated). Chart theme `lib/charts/theme.js` (registered controllers incl. matrix;
`baseOptions`/`mergeOptions`/`seriesColor`/`withAlpha`/`SEMANTIC`).

### 9 Analytics modules — route · engine · key exposed fields (the Part-B "available fields" inventory)
| Module | Route | Engine | Key params (⚑ = carries dummy/real flags) |
|---|---|---|---|
| BCG | `/analytics/bcg` (+`/ctr`) | `bcg-summary` | sales·qtySold·harga·stock (real); visitor·ctr·jumlahAtc·biayaAds·omsetPenjualan (**dummy**); conversion·roas·score·quadrant (dummy-derived) ⚑ |
| RFM | `/analytics/rfm` | `rfm-summary` | recencyDays·frequency·monetary·r/f/m·segment; per-row `dummy`; overview real/dummy customer counts, coveragePct ⚑ |
| Ads-Allocation | `/analytics/ads-allocation` | `ads-allocation-summary` | spend·sharePct·cumulativePct·MoM (all real, expense-only — **no ROAS**) |
| Campaign-Efficiency | `/analytics/campaign-efficiency` | `campaign-efficiency-summary` | cost·reportedGmv(**self-reported**)·views·likes·comments·cpm·engagementRate·costPerGmv·gmvPerCost·quadrant ⚑ |
| Gross-Margin | `/analytics/gross-margin` | `gross-margin-summary` | revenue·hpp·grossProfit·marginPct·hasCost; coveragePct·coveredMarginPct (real) |
| Talent-ROI | `/analytics/talent-roi` | `talent-roi-summary` | cost·paid (**real**); attributedRevenue·attributedGmv·contentViews·conversions·roi (**dummy**); `costReal`/`returnDummy` ⚑ |
| Operational | `/analytics/operational` | `operational-summary` | funnel stages·cancellationRate·stockTurnover (real); processing/shipping/totalDays (**dummy**); `stockCoveragePct` ⚑ |
| Cohort | `/analytics/cohort` | `cohort-summary` | cohortMonth·periodIndex·retentionPct·customersRetained·cohortSize; per-cell `dummy` (1/36 real) ⚑ |
| Basket | `/analytics/basket` | `basket-summary` | pairs: cooccur·support·confidence(×2)·lift; nodes: orders·revenue; `smallSample` ⚑ |

(SP1 `/analytics/products`, SP2 `/analytics/orders` also live under Analytics.)

### Legacy modules
- **Campaign** `/campaigns` (+ `/campaign/[id]/show` w/ PerformanceChart) — top-level nav.
- **Talent** group `/talent · /talent/content · /talent/payments · /talent/payments/report · /talent/approval`.
- **Ads** group `/ads/marketplace · /ads/ai-insights`.
- **Affiliate** group `/affiliate/shopee · /affiliate/tiktok`.

### AI Agent (AI-1–AI-6)
- Context: `lib/data-context.js` → `detectSources(question)` (keyword match) → fetches **legacy**
  `getAdsSummary`/`getCampaignSummary`/`getTalentSummary`/`getAffiliateSummary` (tenant-scoped,
  talent permission-gated). **The 9 analytics engines are NOT wired into AI context.**
- Chat route `app/api/ai/conversations/[id]/message/route.js`: Claude **Sonnet 4.6**; injects
  data into the `system` prompt; per-conversation history + compaction; feature/quota gated;
  optional chart-spec JSON mode. Surfaced today only in the AI chat UI (not on analytics pages).

### Connector system (CS1–CS5a)
- `DataConnector` model: `connectorType` · `spreadsheetId` · `sheetTab` · `dataRange` ·
  `targetTable` · `upsertKey` · `columnMapping` · `staticValues`. Admin UI `/settings/connectors`
  (superadmin), routes `app/api/connectors/*`.
- **Genericity:** `transforms.js` is **fully source-agnostic** (operates on `row[]` arrays by
  integer column). `sync-engine.js` fetch is **already injectable** (`syncConnector(id, {fetchRows})`,
  default `getSheetRows`). **Only Sheets-specific bits:** the `spreadsheetId`/`sheetTab`/`dataRange`
  fields + the default `getSheetRows` fetch. Dispatch currently handles `order_sync`/`product_sync` only.

### Nav (current — the problem)
`Dashboard · Sales · Orders · Campaigns · [Ads] · [Talent] · [Affiliate] · [Analytics ×13] ·
Market Research · [Settings] · [Account]`. **Analytics is a flat 13-item group** (SP1, SP2, 8
deep-analysis, BCG, **+ Report + Customers which are actually operational**). Legacy
Campaign/Talent/Ads sit top-level with no relationship shown to their new analytics counterparts.

### Key gaps this plan addresses
- **mathjs is NOT installed** (Part B B2 must add it).
- Analytics nav overwhelming + mis-filed operational pages.
- Legacy vs new module overlap unexplained to users.
- AI agent blind to the 9 analytics engines.
- Connector locked to Sheets despite a generic core.

---

# PART A — OVERALL USER FLOW / IA

**Current state:** flat 13-item Analytics group; Customer+Report mis-filed under Analytics;
legacy Campaign/Talent/Ads top-level with no link to their analytics counterparts; no single
"entry → drill" story beyond a few ad-hoc links.

**Proposal — top-level structure (5 sections):**
1. **Home / Operational** — Dashboard · Sales · Orders · Customers · Report (the 5 operational pages).
2. **Analytics** — the 9 deep modules **grouped by theme** (sub-headers, not a flat list):
   - **Customer:** RFM · Cohort Retention · Market Basket
   - **Marketing:** Ads Allocation · Campaign Efficiency · Talent ROI
   - **Product & Finance:** BCG Matrix · Gross Margin · (SP1 Product, SP2 Order Analysis)
   - **Operations:** Operational
3. **Marketing Modules (operational/data-entry):** Campaigns · Talent · Affiliate · Ads (the legacy
   CRUD/import surfaces).
4. **Market Research** (standalone).
5. **Settings / Account** — Tenants · Users · Connectors · Billing.

**Entry-point flow:** land on **Dashboard** (home glance) → each operational page carries a
**"View full analysis →"** link to its analytics counterpart (sales→Gross-Margin/BCG,
customer→RFM/Cohort, orders→Operational, report→Ads-Allocation). Analytics modules already
cross-link where relevant (Gross-Margin→/sales). This realizes BI_DESIGN's overview→drill→detail.

**Legacy vs new overlap (resolve by RELABELING + cross-linking, not deleting):** legacy pages
are the **data-entry/operational CRUD** surfaces; analytics modules are the **read-only analysis**
lens. Make this explicit: relabel legacy group **"Marketing Modules"**; add reciprocal links
("Analyze →" from legacy Campaign/Talent/Ads to their analytics module; "Manage data →" back).
No redirects/deletions — both coexist with a clear role split.

**AI agent + calculated-fields placement:** AI = **global floating "Ask AI" button** on every
analytics page (Part D), context = that page's engine output. Calculated-fields = **per-module**,
triggered from KPI strips / DataGrid headers / chart pickers (Part B) — not a global page.

### PHASE PLAN — A
**A1 — Sidebar regroup by theme** · Goal: replace the flat Analytics group with themed
sub-groups (Customer/Marketing/Product&Finance/Operations) and move Customer+Report into a
"Home/Operational" group. · Files: `components/layout/Sidebar.jsx` (NAV array; may add a
sub-header render mode). · Size: **S**. · Verify: Playwright — every route still reachable, active
states correct, nothing 404s.

**A2 — "View full analysis →" links from operational pages** · Goal: each of the 5 operational
pages gets a topbar/footer link to its analytics counterpart (sales→gross-margin, customer→rfm,
orders→operational, report→ads-allocation, dashboard→analytics index). · Files: the 5
`app/(dashboard)/{dashboard,sales,orders,customer,report}/page.jsx`. · Size: **S**. · Verify:
links render + navigate.

**A3 — Legacy↔new role split (relabel + reciprocal links)** · Goal: relabel legacy nav group to
"Marketing Modules"; add "Analyze →" links on legacy Campaign/Talent/Ads pages to their analytics
module and "Manage data →" back. · Files: `Sidebar.jsx` + legacy page headers (`components/campaign/*`,
`components/talent/*`, ads marketplace page). · Size: **M**. · Verify: links both directions; no
duplicate-purpose confusion in a click-through.

**A4 (optional) — Analytics index/landing** · Goal: `/analytics` hub page with themed cards
(title + one-line "what + how real") linking to each module — the discovery surface. · Files: new
`app/(dashboard)/analytics/page.jsx`. · Size: **M**. · Verify: renders cards, links resolve.

---

# PART B — CALCULATED FIELDS FOUNDATION

**Current state:** each engine returns fixed fields; no user-defined metrics. mathjs **not
installed**. Honesty flags (`dummy`, `costReal`/`returnDummy`, `smallSample`, per-cell `dummy`)
already exist per engine — the foundation can harvest them automatically.

**Proposal:**
1. **Params manifest per module** — each engine additionally exports
   `FIELD_MANIFEST = [{ key, label, unit, dummy, source }]` describing its numeric params
   (the inventory table in Part 0 is the seed). `dummy` is sourced from the SAME flags the
   engine already computes → a calculated field referencing any dummy param is itself dummy,
   **zero extra per-module honesty bookkeeping**.
2. **Model `CalculatedField`** (tenant-scoped): `id · tenantId · module · key · label ·
   formula(string) · createdAt` — `db push`. `@@unique([tenantId, module, key])`.
3. **Evaluator** `lib/analytics/calc-field.js`: `evaluate(formula, paramValues, manifest)` →
   `{ value, dummy }` using **mathjs** `parse`/`evaluate` restricted to arithmetic
   (`+ - * / ( ) %` + param keys as scope vars); reject any unknown symbol/function; `dummy =
   true` if ANY referenced manifest param is dummy. No `eval`, no conditionals.
4. **`<CalculatedFieldModal>`** (reuses `@/components/ui/Modal`): formula text input + clickable
   **param-chip list** (click inserts `{paramKey}` at cursor) + **live preview** (evaluate on the
   current row/overview values) + **dummy-flag preview** (shows the "dummy" badge if the formula
   references a dummy param) + validation errors inline.
5. **Integration mechanism (minimal/generic):** `IconKpiStrip`, `DataGrid`, and chart panels
   accept an optional `extraFields` prop = calculated fields resolved via the evaluator against
   the same data they already render. A calculated field becomes: an extra KPI tile (overview
   scope), an extra DataGrid column (row scope), or an extra chart series (series scope). The
   `dummy` flag drives the existing `dev`/dummy badge automatically.
6. **Pilot modules (reasoning):** **Gross-Margin** (richest real numeric params: revenue/hpp/
   margin → e.g. "margin per unit", "markup%"), **Ads-Allocation** (spend/share → "cost index"),
   **Campaign-Efficiency** (cost/gmv/views/engagement → custom efficiency ratios). These have the
   most-used, mostly-real params and clear user demand for custom ratios.

### PHASE PLAN — B
**B1 — Params manifests for all 9 engines** · Goal: add `FIELD_MANIFEST` export to each
`lib/analytics/*-summary.js` ({key,label,unit,dummy,source}), dummy flags wired from existing
engine flags. · Files: the 9 engines (additive export only — no behavior change). · Size: **M**.
· Verify: a node script prints each manifest; dummy flags match engine reality (e.g. BCG visitor
dummy:true, gross-margin revenue dummy:false).

**B2 — `CalculatedField` model + mathjs evaluator** · Goal: `npm install mathjs`; add the model
(`db push`); write `lib/analytics/calc-field.js` `evaluate()` (arithmetic-only, sandboxed,
returns `{value,dummy}`). · Files: `package.json`, `prisma/schema.prisma`, `lib/analytics/calc-field.js`.
· Size: **S**. · Verify: node unit checks — valid formula computes; unknown symbol/function rejected;
dummy propagates if any referenced param dummy; division-by-zero → null/guarded.

**B3 — `<CalculatedFieldModal>` + dispatch route** · Goal: reusable modal (formula input +
param chips + live preview + dummy preview) + `app/api/analytics/calc-fields/route.js`
(list/create/delete, tenant-scoped). · Files: `components/analytics/CalculatedFieldModal.jsx`,
the route. · Size: **M**. · Verify: Playwright — open modal, click chips to build a formula, preview
computes, save persists, dummy badge shows when a dummy param is used.

**B4 — Pilot integration (Gross-Margin first)** · Goal: `IconKpiStrip` + `DataGrid` accept
`extraFields`; wire a "+ Add field" affordance on Gross-Margin's KPI strip + table that opens the
modal and renders saved calc fields as tile + column (dummy-badged). · Files:
`components/dashboard/IconKpiStrip.jsx`, `components/table/DataGrid.jsx`, gross-margin page. · Size:
**M**. · Verify: add a calc field ("markup% = (revenue-hpp)/hpp*100"), see it as a tile + column;
verify dummy badge when referencing a dummy param.

**B5 — Roll out to Ads-Allocation + Campaign-Efficiency** · Goal: same `extraFields` wiring on 2
more pilots (incl. a chart-series example on one). · Files: those 2 pages (+ minor chart-component
`extraSeries` support). · Size: **M**. · Verify: per-module add/preview/persist + dummy flags.

---

# PART C — TALENT ROI: OBJECTIVE-AWARE REDESIGN

**Current state:** `talent-roi-summary` judges ALL talent by cost × attributed-return (revenue),
which is wrong for awareness/consideration talent. Real cost (rateFinal/paid) is solid;
`TalentReturn` already has `attributedRevenue`/`attributedGmv`/`contentViews`/`conversions` (dummy).
`KolProfile` has `followers`/`engRate`/`niche`; `Talent.type` ∈ {KOL, Affiliate, Content Creator,
Clipper}.

**Proposal — apply TOFU/MOFU/BOFU:**
1. **`objective` enum** `Awareness | Consideration | Conversion` on **`Talent`** (the durable
   entity; `TalentReturn` is the dummy layer). **Default via inference** (best heuristic, with
   confidence):
   - `type='Affiliate'` → **Conversion** (affiliates drive sales) — *high confidence*.
   - `type='KOL'` or `KolProfile.followers` high (≥ a tenant percentile, e.g. top tercile) →
     **Awareness** (reach plays) — *medium*.
   - `type='Content Creator'/'Clipper'` or high `engRate` with mid followers → **Consideration**
     — *medium-low*.
   - Fallback → **Consideration** (safest middle). Store an `objectiveInferred:true` flag so the
     UI shows "(inferred)" until a brand owner confirms.
   - **Brand-owner override**: editable per talent (same default-then-adjust pattern as calc fields).
2. **Objective-aware metrics** — the "return" axis is chosen per talent's objective:
   - Awareness → **views/reach** (CPM-style: cost ÷ views).
   - Consideration → **engagement** (cost ÷ (likes+comments+shares)).
   - Conversion → **conversions / GMV** (cost ÷ conversions, or gmv/cost — the current ROI, valid
     ONLY here).
3. **Display — pick: COLOR-CODED SINGLE QUADRANT with per-objective axis meaning + an objective
   filter** (justification: small N=24 makes small-multiples sparse and 3 separate quadrants
   fragment the view; one quadrant colored by objective, with the y-axis relabeled per the active
   filter and the tooltip stating the objective-specific metric, keeps it scannable and reuses the
   existing quadrant component). Add an **objective filter** (All/Awareness/Consideration/Conversion)
   that switches the efficiency metric + axis label; "All" plots each talent against its OWN
   objective's normalized efficiency (0–100) so they're comparable on one axis. The dumbbell/radar/
   leaderboard adapt the same way.
4. **Migration (additive, no breaking change):** add `objective`/`objectiveInferred` columns
   (`db push`) + an inference backfill in the seeder; `TalentReturn` already has views/conversions
   (covers Awareness/Consideration) — **no new metric columns needed** (engagement = likes+comments
   from… ⚠ gap: `TalentReturn` lacks likes/comments/shares — see C-gap). Existing page keeps working
   (objective defaults applied); the redesign layers on top.

   **C-gap:** Consideration needs **engagement counts**. `TalentReturn` has `contentViews` +
   `conversions` but **no likes/comments/shares**. Options: (a) add `engagementActions` (dummy) to
   `TalentReturn`, or (b) derive a dummy engagement proxy from views. Recommend **(a)** — one
   additive dummy column, consistent with the module's flagged-dummy approach.

### PHASE PLAN — C
**C1 — Schema + inference** · Goal: add `Talent.objective` (enum) + `Talent.objectiveInferred`
(bool) + `TalentReturn.engagementActions` (dummy Int); `db push`; write inference into a backfill
+ the existing talent-return seeder (apply the heuristic above). · Files: `prisma/schema.prisma`,
`scripts/seed-dev-talent-return.cjs` (+ a one-off backfill or fold into seeder). · Size: **S**.
· Verify: node — objective distribution sane (affiliates=Conversion etc.); `objectiveInferred`
set; engagementActions present + dummy-flagged.

**C2 — Objective-aware engine** · Goal: redesign `getTalentRoiQuadrant`/`getTalentRanking`/
`getTypePerformance` to compute the efficiency metric per talent's objective (views/engagement/
conversions); add a normalized "efficiency 0–100" so mixed-objective talent compare on one axis;
keep `costReal`/`returnDummy` flags; add `objective` to each point. · Files:
`lib/analytics/talent-roi-summary.js`. · Size: **M** (mirrors existing engine pattern). · Verify:
throwaway route — each objective uses the right metric; spot-check one talent per objective;
cost still real.

**C3 — Objective-aware page** · Goal: retrofit the 4 chart forms (quadrant/dumbbell/radar/
leaderboard) to the objective dimension; add an **objective filter** (All + 3) that switches axis
meaning + tooltip; add a small **override UI** (edit a talent's objective, showing "(inferred)"
when default). · Files: `app/(dashboard)/analytics/talent-roi/page.jsx`, `components/talent-roi/*`,
+ a tiny `PATCH /api/analytics/talent-roi` (or talent route) for the override. · Size: **M**.
· Verify: Playwright+NextAuth t2 — filter switches metric/axis; tooltip states per-objective metric;
override persists + clears "(inferred)"; 0 console errors.

---

# PART D — AI AGENT ON ANALYTICS PAGES

**Current state:** `data-context.js` feeds Claude only the 4 legacy summaries via keyword
detection; the 9 analytics engines aren't available to the agent; AI is surfaced only in the chat
UI, not on analytics pages. The message route already injects a `DATA` block into `system` and is
gated/compaction-aware.

**Proposal:**
- **Per-page "Ask AI" entry point** = a floating button (bottom-right) opening a slide-over panel,
  on every analytics page. The panel sends the **current module's engine output** (the same JSON
  the page rendered, **including dummy/real flags + honesty notes**) as page-context so answers are
  grounded in what's on screen — e.g. correctly explaining "this 89× lift is from n=1".
- **Shared `<AnalyticsAIPanel module={…} context={engineResponse} />`** — minimal per-module wiring:
  pass the already-fetched engine response. It posts to a small **page-context variant of the chat
  route** (or extends the existing route with an optional `pageContext` + `module` so the agent's
  `system` gets a "CURRENT VIEW" block alongside the legacy data). Reuses the existing conversation/
  gating/compaction machinery.
- **Honesty grounding:** include each response's `dummy`/`smallSample`/`coveragePct`/`note` fields
  verbatim in the context, plus a system instruction: "If a figure is flagged dummy/small-sample,
  explain the caveat; never present it as reliable."
- **Large-response modules (flag):** Basket (34 pairs + 20 nodes), Cohort (36 cells), BCG/Operational
  (per-SKU arrays) can be big → **summarize before sending** (top-N + the overview/aggregate + flags),
  not the full arrays. Small modules (overview-only) pass as-is.

### PHASE PLAN — D
**D1 — `<AnalyticsAIPanel>` + page-context chat path** · Goal: shared slide-over panel + extend the
message route (or a sibling) to accept `{ module, pageContext }` and inject a "CURRENT VIEW" block +
honesty instruction into `system`. · Files: `components/analytics/AnalyticsAIPanel.jsx`,
`app/api/ai/conversations/[id]/message/route.js` (additive optional params) or a new
`app/api/ai/page-insight/route.js`. · Size: **M**. · Verify: Playwright — open panel on a page, ask
a question, answer references on-screen numbers; gating/quota still enforced.

**D2 — Wire into 2–3 pilots (Basket, Talent-ROI, Gross-Margin)** · Goal: mount `<AnalyticsAIPanel>`
passing each page's engine response (Basket/Talent-ROI test honesty-explanation; Gross-Margin tests
clean real). · Files: those 3 pages. · Size: **S** each. · Verify: ask "why is this lift 89×?" on
Basket → agent explains n=1; ask "is ROI real?" on Talent-ROI → explains cost-real/return-dummy.

**D3 — Context summarization layer** · Goal: a `contextFor(module, response)` helper that trims
large responses (top-N + aggregates + flags) before sending; apply to Basket/Cohort/BCG/Operational.
· Files: `lib/analytics/ai-context.js` (new). · Size: **M**. · Verify: payload size bounded; flags
preserved; answers still accurate.

**D4 — Roll out to remaining modules** · Goal: mount the panel on the other 6 analytics modules
(repetitive wiring). · Files: those 6 pages. · Size: **S** each. · Verify: panel present + grounded
on each; 0 console errors.

---

# PART E — CONNECTOR EXPANSION (beyond Google Sheets)

**Current state:** transform/mapping/write layer **source-agnostic** (`row[]` by integer column);
fetch is **injectable** (`syncConnector(id,{fetchRows})`, default `getSheetRows`). Sheets-specific =
`spreadsheetId`/`sheetTab`/`dataRange` fields + the default fetch + admin UI assuming Sheets. No
`sourceType` discriminator yet.

**Proposal:**
- Add **`sourceType`** to `DataConnector` (`google_sheets | google_drive_file | onedrive_file`,
  default `google_sheets`) + a generic **`sourceConfig` Json** (holds per-source locators:
  Sheets→{spreadsheetId,sheetTab,dataRange}; Drive→{fileId,sheetTab?,range?}; OneDrive→{driveId,
  itemId,…}) so the model stops being Sheets-shaped. Keep existing columns working (back-compat:
  map old fields → `sourceConfig` on read).
- **Per-source fetch fn** returning `string[][]`: Sheets (exists) · Drive-file (download csv/xlsx
  via Drive API, parse with the repo's xlsx lib → rows) · OneDrive (MS Graph download → parse).
  The dispatcher picks the fetch fn by `sourceType`; **the entire transform/mapping/write layer is
  reused unchanged.**
- **Auth:** Sheets/Drive = **same Google service-account** pattern (Drive scope) — small lift.
  OneDrive/Graph = **OAuth 2.0** (per-tenant consent, token storage + refresh) — **fundamentally
  different and bigger**; flag for its own design pass.

### PHASE PLAN — E
**E1 — Generalize the model with `sourceType` + `sourceConfig`** · Goal: add `sourceType` (default
`google_sheets`) + `sourceConfig` Json; back-compat read mapping; dispatcher selects fetch by
sourceType (Sheets path unchanged). · Files: `prisma/schema.prisma`, `lib/connectors/sync-engine.js`,
connector validation/admin route. · Size: **S** (additive). · Verify: existing Sheets connectors
still sync (regression); a connector reads `sourceConfig`.

**E2 — Google Drive file (csv/xlsx) connector** · Goal: a `fetchDriveFile(sourceConfig)` →
`string[][]` (Drive API download + xlsx/csv parse, reuse repo `xlsx`), wired via sourceType
`google_drive_file`; same service-account auth (add Drive scope); admin UI gains a Drive source
option. · Files: `lib/connectors/sources/drive.js` (new), sync-engine dispatch, admin UI. · Size:
**M** (reuses Sheets-like auth + the whole transform engine). · Verify: point at a Drive csv/xlsx,
sync writes rows identically to a Sheets sync.

**E3 — OneDrive / MS Graph connector** · Goal: OAuth flow (app registration, per-tenant consent,
token store + refresh), `fetchOneDriveFile` → `string[][]`, sourceType `onedrive_file`. · Files:
new auth module + `lib/connectors/sources/onedrive.js` + token model + admin UI. · Size: **L**.
· **⚠ Needs its own deeper design pass BEFORE implementation** (OAuth setup, secure token storage,
refresh, error/expiry handling) — do not start without it. · Verify: end-to-end OAuth + sync in a
controlled test tenant.

---

# PART F — OPEN QUESTIONS (need product-owner answers before a phase plan)

**F1 — "Internal brand content" — what concretely?** Plausible interpretations:
1. **Owned-social performance** (the brand's own IG/TikTok/etc. posts + their metrics) → needs a
   social-insights data source per platform; fits a **new analytics module** + likely a **connector**
   (or platform API). Closest existing analog: Campaign-Efficiency but for owned (not creator) posts.
2. **Creative asset library / DAM** (storing/organizing creative files) → a **content-management**
   feature, **not** analytics; needs file storage + metadata, outside the current analytics/connector
   pattern.
3. **Brand guidelines / reference** (static brand book) → a docs/reference surface; minimal data,
   not analytics. → *Which of these (or which mix)?*

**F2 — "Marketing beyond ads" — which channels?** Per channel: data needed + connector fit:
- **Organic social** — post/profile metrics per platform (likely platform API or export) → connector
  if exportable to Sheets/Drive; else API integration.
- **Email / CRM** (e.g. Mailchimp/Klaviyo) — campaign sends/opens/clicks/revenue → API or CSV export
  → fits connector if CSV/Drive.
- **SEO** — rankings/traffic (GSC/GA) → API export → connector-via-CSV or API.
- **Events / PR** — mostly manual/spend-only → likely manual entry or a `Marketing`-style category
  table (already exists for spend). → *Which channels are in scope, and is exportable-file ingestion
  (connector) acceptable vs native API integrations?*

→ Once answered, write **Part G (pending)** as a phase plan (new module(s) and/or connector source
types), reusing the patterns above.

---

# SEQUENCING

Relative order across A–E **and** vs Wave 3 ([`ANALYTICS_ROADMAP.md`](ANALYTICS_ROADMAP.md)) / BI
drill-down F1a ([`BI_DESIGN.md`](BI_DESIGN.md)):

- **A1–A3 (nav cleanup, low-risk)** — do **first / interleave with anything**; small, high-UX-value,
  unblocks discoverability for everything else. A4 optional later.
- **B1–B2 (calc-fields foundation: manifests + model + evaluator)** — do **early**, and **before C**:
  the params-manifest work (B1) directly feeds C's "expose objective-specific metrics" and the
  default-then-override pattern. B3–B5 (modal + integration) follow.
- **C (Talent-ROI objective-aware)** — **high product value, do early** (fixes a correctness flaw).
  Pairs naturally **after B1** (shares the manifest/override pattern); C1–C3 can otherwise run
  independently.
- **D (AI on analytics)** — **depends on nothing**, can run **anytime** (parallelizable); higher
  value once A2/A4 improve discovery.
- **E1–E2 (connector sourceType + Drive-CSV)** — **medium, independent**; do when data-source breadth
  is needed. **E3 (OneDrive/OAuth) = largest/riskiest → defer** until after a dedicated OAuth design pass.
- **vs Wave 3** (CLV · True ROAS · Net P&L · AI Forecasting — the most speculative wave): **this
  platform plan (A/B/C/D) is higher-confidence and higher near-term value than Wave 3.**
  **Recommendation:** do **A1–A3 + B1–B2 + C** (and D opportunistically) **before** starting Wave 3;
  Wave 3's AI Forecasting also benefits from D (AI panel) and B (calc fields) existing first.
- **vs BI F1a drill-down:** A2/A4 (entry→drill links) partially deliver the F1a overview→drill→detail
  intent at the nav level; full F1a interaction can layer on after A.

**Suggested first slice for next session:** **A1 → A2 → B1 → B2 → C1** (nav cleanup + calc-fields
foundation + Talent-ROI schema/inference), each a standalone prompt.

---

# Executable-prompt note
Each phase above is written to be **copy-pasted as a prompt** next session: it states the goal,
read-first files, build steps, constraints, and a self-verify approach — mirroring the Wave 1/2
foundation+page prompt style (engine-owns-logic · compact components · chart theme · DataGrid ·
honesty flags · Playwright+NextAuth verification · clean up temp artifacts). Keep the established
conventions: tenant-scope every read, Decimal/BigInt→Number, `db push` (not migrate), serialized
awaits (connection_limit=1), restart the dev server after a new Prisma model.
