# AI Forecasting — Data Sources & Honesty Map (Wave 3 §3.4)

> The **sixth honesty posture: the honest GATE.** This module produces **NO forecast**
> until ≥12 months of real order history exist. There is no dummy series, no flat
> placeholder, no dashed extrapolation — absence is the honest answer. The real history
> is plotted as-is; the projection appears automatically once the gate opens.
>
> Engine: `lib/analytics/forecast-summary.js` · Route: `app/api/analytics/forecast/route.js`
> · Page: `app/(dashboard)/analytics/forecast/page.jsx`. On-the-fly compute — **no snapshot
> table, no new Prisma model** (readiness is derived from `Order` rows).

## Real data source

| Field | Source | Real? | Notes |
|---|---|---|---|
| `history[].month` | `to_char(orders.order_date, 'YYYY-MM')` | **REAL** | Distinct order-month bucket (UTC). |
| `history[].gmv` | `SUM(orders.gmv)` per month | **REAL** | Decimal → Number, 2dp. |
| `history[].nett` | `SUM(orders.nett)` per month | **REAL** | Decimal → Number, 2dp. |
| `history[].orders` | `COUNT(*)` per month | **REAL** | Excludes cancelled (see below). |
| `monthsAvailable` | `COUNT(DISTINCT month)` | **REAL** | The readiness measure. |
| `firstMonth` / `lastMonth` | min/max month | **REAL** | History span endpoints. |
| `forecast` | — | **ABSENT** | `null` while gated. **No predicted numbers are ever returned** until ready=true (and even then only from a real statistical model — never fabricated). |

**EXCLUDED_STATUSES:** the same exclusion list as HPP / SP2 / RFM / Operational
(`lib/hpp/compute-hpp` → `EXCLUDED_STATUSES`) — cancelled / returned orders never count
toward history or readiness. Consistent across modules.

## Readiness rule (the gate)

```
monthsAvailable = COUNT(DISTINCT to_char(order_date,'YYYY-MM'))  over non-cancelled Orders
monthsRequired  = 12
ready           = monthsAvailable >= 12
```

- `ready = false` → `getForecast()` returns `{ ready:false, forecast:null, gateMessage, history }`.
  The page renders the **gate message** ("Forecasting needs ≥12 months of history; currently
  N months — forecast not yet available") where a projection would extend — **never a line**.
- `ready = true` → the **statistical-model path** (Holt-Winters / ARIMA / Prophet) would run
  on `history` and return real predicted points + a confidence band. It is a **documented
  STUB** today (`forecast:null`, clearly marked `UNREACHABLE until ready=true`) — it must
  **not fabricate output**. As of now tenant 2 has < 12 months, so this path is never reached.

## TZ-1 month-bucketing choice

Months are bucketed with **raw UTC** `to_char(order_date,'YYYY-MM')`, **matching the existing
convention** (operational `getCancellationTrend`, cohort, dashboard all bucket by UTC).
`Order.orderDate` is stored at **17:00 UTC (= WIB midnight)**; we deliberately do **not** shift
per-view, so forecast readiness aligns with every other module's month math. The TZ-1 debt is
carried **consistently**, not patched here (a global fix belongs in BI F1a, not this module).

## LLM vs statistics (the critical distinction)

- **Statistical models predict.** The forecast numbers — once the gate opens — come **only**
  from Holt-Winters / ARIMA / Prophet, never from the LLM.
- **The LLM narrates.** The AI panel's page-context contains **history + readiness only**
  (`forecast:null`). A module-specific system guard (`viewModule==='forecast'`) instructs the
  agent to **decline any future-number request**, explain the gate, and at most describe the
  real historical trend — it must produce **no projected figure**.

## How it becomes real

No connector, no backfill — **just elapsed time**. Each additional month of synced orders
increments `monthsAvailable`; when it reaches 12 the gate opens and the model path is wired
in (the future "L" statistical work). Until then the honest answer is "not yet available".
