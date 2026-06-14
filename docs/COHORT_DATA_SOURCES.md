# Cohort Retention — Data Sources & Honesty Map

> **The MOST dummy-heavy module so far — and the one that fixes itself with time.**
>
> True cohort retention needs **months of follow-up** per cohort. Real data spans **~1
> month**, so almost nothing is real yet:
> - ✅ **REAL** (`source='REAL-DERIVED'`): the **latest cohort's period-0 size** (and any
>   period-1+ cells that have *actually elapsed* with real repeat orders — currently **none**).
> - ❌ **DUMMY** (`source='DUMMY'`): **all retention curves (period 1+)** and the **earlier
>   "shape" cohorts** that don't exist in real data — fabricated decay so the triangular
>   heatmap is demonstrable. **Every cell carries `dummy`.**
>
> In dev (tenant 2): **1 real cell out of 36** (June 2026 period-0, size 530). This is the
> honest state — surfaced via cell-level flags + `realCellCount`/`dummyCellCount`.
>
> This is the **TIME-BASED retention** view — **distinct from RFM** (segment view). It
> does **not** rebuild RFM's customer/segment analysis.

---

## 1. Source map

Table: `cohort_retention` (model `CohortRetention`). Rows = `cohortMonth` (acquisition),
cols = `periodIndex` (months since acquisition). Tenant-scoped; Float/Int → Number.

| Field / cell | Source | Status |
|---|---|---|
| **Acquisition month** (cohort) | first real-sales order month per customer | ✅ REAL for real months |
| **Period-0 size** (latest real cohort) | `COUNT(customer_username)` first-ordering that month | ✅ **REAL** (`REAL-DERIVED`) |
| Period-1+ retention (real, *if elapsed*) | distinct repeat customers per elapsed month | ✅ REAL when it exists (**none yet**) |
| Period-1+ retention (not elapsed) | fabricated decay curve | ❌ **DUMMY** |
| Earlier "shape" cohorts (size + curve) | fabricated | ❌ **DUMMY** |

**Customer identity reuses RFM's rule** (`customer_username` + `EXCLUDED_STATUSES`) — not
reimplemented. Acquisition = `MIN(order_date)` per customer (RFM uses MAX for recency; same
identity, different aggregate).

---

## 2. Data reality (tenant 2)

| Fact | Value |
|---|---|
| Real acquisition months | **2026-06 only** (all 530 real customers first-ordered in June) |
| Real period-1+ cells | **0** (no elapsed follow-up months) |
| Cohorts seeded (for a demonstrable triangle) | **8** (2025-11 → 2026-06, **DYNAMIC** from real max order month) |
| Grid cells | **36** (triangle: cohort *j* months old → periods 0..*j*) |
| **REAL cells** | **1** (June period-0, size 530) |
| **DUMMY cells** | **35** |
| Dummy decay template | 100% → ~38% → ~24% → ~18% → ~14% → ~12% → ~10% → ~9% (±15% jitter) |

**Honesty rules the engine enforces:**
- Every cell carries `dummy`; `getCohortGrid` returns `realCellCount` / `dummyCellCount`;
  `getCohortOverview.month1Dummy = true`.
- Only `REAL-DERIVED` period-0 sizes count toward `customersCovered`.
- **Dynamic dates** — cohorts are anchored to the real max order month (no hardcoded
  2025/2026 stale dates).
- `getCohortDetail` returns the real customer list **only for real cohorts**; dummy cohorts
  return none + an honest note.
- Fresh/empty tenant → `hasData:false`, no error.

---

## 3. Data-plumbing path — the simplest one: just TIME

Unlike every other module, **this needs no connector, no backfill, no new table feed.** It
becomes real **automatically as time passes and orders keep syncing**:
- each elapsed month turns one more diagonal of the triangle from DUMMY → real,
- a recompute job (or re-running `seed-dev-cohort` logic with `source='RECOMPUTE'`) recomputes
  `customersRetained` from real repeat orders for periods that have elapsed,
- `clear-dev-cohort` removes `DUMMY` and keeps `REAL-DERIVED`; real cells accumulate.

The engine reads the same grid shape throughout — **zero engine change** as real retention
fills in. It's the cleanest "real with time" case in the roadmap.

---

## 4. Dev workflow

```bash
node scripts/seed-dev-cohort.cjs    # tenant 2: real period-0 + dummy decay triangle (idempotent, dynamic dates)
node scripts/clear-dev-cohort.cjs   # remove source='DUMMY' (keeps REAL-DERIVED)
```

`db push` (not migrate) created `cohort_retention`, matching the other foundations.

---

## 5. Engine API (`lib/analytics/cohort-summary.js`)

Tenant-scoped; cells flagged `dummy`:

| Function | Returns |
|---|---|
| `getCohortGrid` | full triangle for the **heatmap** — cohorts × periods, per-cell `{retentionPct, customersRetained, dummy}`, real/dummy cell counts |
| `getCohortOverview` | cohort count, avg month-1 retention (`month1Dummy:true`), real customers covered, cell split |
| `getCohortTrend` | acquisition-volume (period-0 sizes) over time, `dummy` per point |
| `getCohortDetail(cohortMonth)` | one cohort's curve + (real cohorts only) the acquired customers |

**Not duplicated:** RFM's segment/customer analysis — this is purely the time-based
retention triangle.
