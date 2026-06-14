# RFM Customer Segmentation — Data Sources & Honesty Map

> **How real is this? Mostly real — and fully real once coverage improves.**
>
> Unlike the BCG matrix (whose axes `visitor`/`ctr` are fabricated, making positions
> fictional), **RFM derives entirely from data we already have: real Orders.** There
> is **no external data source** and **no fabricated axis.** Recency, Frequency, and
> Monetary are computed straight from each customer's real order history.
>
> The only two honesty caveats in dev:
> 1. **Coverage:** only **~46% of real-sales orders carry a customer id**
>    (`customer_username`). RFM can only see those customers. The other ~54% of
>    orders are anonymous and excluded. This is labeled everywhere.
> 2. **Dummy padding:** real customers cluster in a few low-frequency segments
>    (max real frequency is **2** — almost everyone ordered once), so the seeder adds
>    **50 synthetic customers (`source='DUMMY'`)** purely to make every segment visible
>    on the page. These are flagged `dummy:true` and excluded from "real" counts.

---

## 1. Field-by-field real vs dummy

Table: `rfm_score` (model `RfmScore`). Per-tenant, per-customer, per-as-of-date.
Two row kinds, distinguished by `source`:

| `source` | Meaning | R / F / M |
|---|---|---|
| `REAL-DERIVED` | computed from this customer's real Orders | ✅ **REAL** |
| `DUMMY` | synthetic customer, segment-grid padding only | ❌ fabricated |

| Field | REAL-DERIVED rows | DUMMY rows | Source / formula |
|---|---|---|---|
| `customerKey` | ✅ real | synthetic id | `Order.customer_username` (no phone column exists) |
| `customerName` | ✅ real | "Sample Customer …" | `MAX(Order.customer_name)` |
| `recencyDays` | ✅ **REAL** | fabricated | `asOfDate − MAX(order_date)` in days |
| `frequency` | ✅ **REAL** | fabricated | `COUNT(DISTINCT order_id)` excl. cancelled |
| `monetary` | ✅ **REAL** | fabricated | `SUM(gmv)` excl. cancelled |
| `rScore` `fScore` `mScore` | computed | computed | fixed thresholds (below) |
| `segment` | computed | computed | standard R×F grid (below) |
| `asOfDate` | ✅ real | same date | tenant's latest `order_date` (the analysis date) |
| `source` | `REAL-DERIVED` | `DUMMY` | the swap/clear flag |

**Bottom line:** for `REAL-DERIVED` rows (530 of 580 in dev — the real customers),
**every RFM input is real.** The scores/segments are honest classifications of real
behavior. `DUMMY` rows (50) exist only so the page's segment grid isn't empty in the
cells real data doesn't reach yet. The engine surfaces `dummy` per row/point so the
page badges them; `realCustomers` / `dummyCustomers` are reported separately.

### Scoring (fixed thresholds — documented & deterministic)

Quintiles were rejected: real `frequency` is almost all 1–2, so quintiles collapse.
Fixed absolute thresholds keep real customers' scores honest (based on their own
behavior, not relative to dummy rows):

| Score | R — `recencyDays` (≤) | F — `frequency` (≥) | M — `monetary` (≥) |
|---|---|---|---|
| 5 | 7 | 10 | 5,000,000 |
| 4 | 30 | 5 | 2,000,000 |
| 3 | 90 | 3 | 1,000,000 |
| 2 | 180 | 2 | 500,000 |
| 1 | else | 1 | else |

### Segment grid (standard 11-segment R×F map)

`segment = GRID[rScore][fScore]` — the well-known RFM grid:

| | F=1 | F=2 | F=3 | F=4 | F=5 |
|---|---|---|---|---|---|
| **R=5** | New Customers | Potential Loyalist | Potential Loyalist | Loyal Customers | Champions |
| **R=4** | Promising | Potential Loyalist | Potential Loyalist | Loyal Customers | Champions |
| **R=3** | About to Sleep | Need Attention | Need Attention | Loyal Customers | Loyal Customers |
| **R=2** | Hibernating | At Risk | At Risk | Can't Lose Them | Can't Lose Them |
| **R=1** | Lost | Hibernating | At Risk | Can't Lose Them | Can't Lose Them |

All 11 segments: Champions, Loyal Customers, Potential Loyalist, New Customers,
Promising, Need Attention, About to Sleep, At Risk, Can't Lose Them, Hibernating, Lost.
Marketing actions per segment live in `lib/analytics/rfm-summary.js` (`SEGMENT_META`).

---

## 2. Coverage — the honest ceiling

```
coveragePct = orders_with_customer_username / total_real_sales_orders
```
Computed live in the engine (`getRfmOverview`) per tenant. In dev (tenant 2):
**606 / 1306 ≈ 46.4%**. RFM only sees those ~46% of orders. Improving customer-id
capture at order sync directly raises this — **no other change needed.**

---

## 3. Connector blueprint — a RECOMPUTE JOB, not an importer

This is the key difference from BCG. BCG needed an external Google Sheet for
`visitor`/`ctr`. **RFM needs nothing external** — it's a pure function of Orders we
already sync. So the "connector" is really a **scheduled recompute job**:

```
job: rfm_recompute(tenantId, asOfDate = today)
  1. asOf = today (or tenant's latest order_date)
  2. SELECT per customer_username (excl. cancelled):
        frequency = COUNT(DISTINCT order_id)
        monetary  = SUM(gmv)
        recency   = asOf − MAX(order_date)
  3. score R/F/M via the fixed thresholds (§1)
  4. segment via the R×F grid (§1)
  5. upsert RfmScore (tenantId, customerKey, asOfDate) with source='RECOMPUTE'
     (i.e. != 'DUMMY')
```

- **Where it lives:** `scripts/seed-dev-rfm.cjs` already implements steps 1–4 for the
  REAL-DERIVED rows. A production job is the same logic on a cron (daily/weekly),
  writing `source='RECOMPUTE'`. `scripts/clear-dev-rfm.cjs` clears `DUMMY` +
  `REAL-DERIVED`; the recompute job's rows (`RECOMPUTE`) are the real snapshots.
- **No `DataConnector` row, no sheet mapping, no transforms** — RFM is internal.
  (Contrast: BCG registers a `bcg_sync` connector against a spreadsheet.)
- **Snapshot semantics:** RFM changes daily (recency drifts), so it's recomputed and
  stored per `asOfDate`, not read live. Keeping history of snapshots enables trend
  (segment migration over time) later.
- **Source flag swap:** as coverage improves, REAL-DERIVED/RECOMPUTE rows grow and
  the 50 DUMMY padding rows are dropped (`clear-dev-rfm`). **RFM becomes FULLY REAL
  with zero code change** — only the data gets more complete. This is fundamentally
  unlike BCG, which stays fictional until an external `visitor`/`ctr` feed exists.

---

## 4. Dev workflow

```bash
node scripts/seed-dev-rfm.cjs    # tenant 2: REAL-DERIVED from orders + DUMMY padding (idempotent)
node scripts/clear-dev-rfm.cjs   # remove DUMMY + REAL-DERIVED (regenerable), all tenants
```

`db push` (not migrate) created the table, matching the Visit/AdSpend/BcgProduct
foundations. New tenants start empty — the engine returns graceful empties, no error.
