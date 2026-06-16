# CLV — Data Sources & Honesty Map (Wave 3 §3.1)

> **Honesty posture #1 — prominent dummy banner.** Historic customer value is **REAL**;
> the forward **projection is DUMMY** (fabricated from stated assumptions) and flagged on
> every response that carries it. The two halves are kept in separate response sub-objects
> so the page never blends a real historic number with a fabricated projected one.
>
> Engine `lib/analytics/clv-summary.js` · Route `app/api/analytics/clv/route.js` · Page
> `app/(dashboard)/analytics/clv/page.jsx`. On-the-fly compute — **no snapshot table, no new
> Prisma model**. Reuses **RFM's customer identity** (`customer_username`) + `EXCLUDED_STATUSES`.

## Field-by-field

| Field | Source | Real? | Notes |
|---|---|---|---|
| `historicValue` | `SUM(orders.gmv)` per `customer_username`, non-cancelled | **REAL-DERIVED** | The customer's real lifetime spend so far. |
| `frequency` | `COUNT(*)` per customer | **REAL-DERIVED** | Distinct non-cancelled orders. |
| `avgOrderValue` | `historicValue / frequency` | **REAL-DERIVED** | — |
| `firstOrder` / `lastOrder` | min/max `order_date` | **REAL** | Raw UTC (TZ-1 convention, consistent with RFM). |
| distribution `buckets[].count` | histogram of `historicValue` | **REAL** | 8 buckets to the p95 cap + an overflow bucket. |
| tiers `totalHistoricValue` / `avgHistoricValue` / `historicSharePct` | quartile bands of `historicValue` | **REAL** | Percentile value tiers (High / Mid-High / Mid-Low / Low). |
| `coveragePct` | `% orders with customer_username` | **REAL** | The honest ceiling on completeness (~56%, shared with RFM). |
| **`projectedFutureValue`** | `avgOrderValue × 3 × 0.5` (assumptions) | **DUMMY** | Fabricated forward value — `dummy:true`. |
| **`projectedClv`** | `historicValue + projectedFutureValue` | **DUMMY-DERIVED** | Real historic + dummy projection → flagged dummy; **never shown as a real prediction.** |
| `projection.assumption` | constant | — | States the fabricated basis verbatim. |

**EXCLUDED_STATUSES:** the shared exclusion list (`lib/hpp/compute-hpp`) — cancelled /
returned orders never count toward historic value, frequency, or coverage. Consistent with
RFM / Gross-Margin / Operational / Basket / Forecast.

## Projection assumption basis (the DUMMY part)

```
projectedFutureValue = avgOrderValue × ASSUMED_FUTURE_ORDERS(3) × ASSUMED_RETENTION(0.5)
projectedClv         = historicValue (REAL) + projectedFutureValue (DUMMY)
```

These multipliers are **stated assumptions, not derived from real repeat behaviour** — there
isn't enough repeat history to fit a real retention/LTV model (the same limitation as Cohort
§2.3 and Forecasting §3.4). Every projection field carries `dummy:true`; the page shows a
**prominent orange banner** and badges every projected tile/column/detail field.

## Coverage caveat (inherited from RFM)

Historic value is computed only over orders carrying `customer_username` (~56% of orders in
dev); anonymous/earlier orders aren't attributed. This is the same ceiling RFM surfaces — CLV
**inherits and states it**, and it lifts as id-capture improves at sync.

## Becoming real (the blueprint)

No external source, no connector. As **repeat purchase history accrues** (and id-capture
coverage rises), the dummy projection is replaced by a real retention/LTV model fit on the
accumulated history — ties directly to the RFM recompute. Until then the projection stays
DUMMY-and-flagged; the historic half is already real today.

## LLM discipline

The AI panel's context includes the dummy flags + assumption text. The agent must explain the
**projection is fabricated/assumption-based** and that the **historic value is real** — it
must not present the projected CLV as a real prediction (consistent with §3.4's LLM discipline,
though here the dummy number is shown — flagged — rather than gated away).
