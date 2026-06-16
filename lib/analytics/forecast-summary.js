// ─── AI Forecasting engine (Wave 3 §3.4 — STRUCTURE + honest readiness GATE) ──
// The SIXTH honesty posture: the honest GATE. With < 12 months of real history there
// is NO forecast — not a dummy line, not a flat placeholder, not an extrapolation.
// Absence is the honest answer. The engine computes how much real history exists and
// gates the forecast on it; the statistical-model path (Holt-Winters / ARIMA / Prophet)
// is a documented STUB that stays UNREACHABLE until ready=true. The LLM NEVER predicts
// numbers — a statistical model does that, only once the gate opens. See
// docs/FORECAST_DATA_SOURCES.md.
//
// TZ-1 month-bucketing: months are bucketed with RAW UTC `to_char(order_date,'YYYY-MM')`,
// matching the existing convention (operational/cohort/dashboard all bucket by UTC).
// Order.orderDate is stored at 17:00 UTC (= WIB midnight); we deliberately do NOT shift
// per-view so readiness aligns with every other module's month math (the TZ-1 debt is
// carried consistently, not patched here).
//
// Tenant-scoped every read; Decimal/BigInt → Number at the boundary. On-the-fly compute
// (no snapshot table, no new Prisma model).
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { EXCLUDED_STATUSES } from '../hpp/compute-hpp'

const num    = v => Number(v ?? 0)
const round2 = n => Math.round((Number(n) || 0) * 100) / 100

const MONTHS_REQUIRED = 12
// Statistical methods that WOULD produce the forecast once the gate opens (documented,
// not run now). The LLM is explicitly NOT in this list — it narrates, it does not predict.
const METHODS = ['Holt-Winters', 'ARIMA', 'Prophet']

// Real monthly history from Orders (tenant-scoped, excl. cancelled — same exclusion list
// as HPP / SP2 / RFM). This is REAL data and fine to plot; it is the series a model WOULD
// forecast from. `monthsAvailable` = distinct order-months (the readiness measure).
async function loadHistory(tenantId) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT to_char(order_date, 'YYYY-MM') AS month,
           COUNT(*)::int AS orders,
           COALESCE(SUM(gmv), 0)  AS gmv,
           COALESCE(SUM(nett), 0) AS nett
    FROM orders
    WHERE tenant_id = ${tenantId} AND status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})
    GROUP BY 1 ORDER BY 1`)
  const history = rows.map(r => ({ month: r.month, orders: num(r.orders), gmv: round2(r.gmv), nett: round2(r.nett) }))
  return {
    history,
    monthsAvailable: history.length,                       // distinct months with real orders
    firstMonth: history[0]?.month ?? null,
    lastMonth:  history[history.length - 1]?.month ?? null,
    totalOrders: history.reduce((a, h) => a + h.orders, 0),
  }
}

/**
 * Forecast readiness + the REAL history a model would forecast from. The page shows the
 * history (real) even while the forecast is gated. `ready` is true iff ≥12 months exist.
 */
export async function getForecastReadiness(tenantId) {
  const h = await loadHistory(tenantId)
  const ready = h.monthsAvailable >= MONTHS_REQUIRED
  const remaining = Math.max(0, MONTHS_REQUIRED - h.monthsAvailable)
  return {
    ...h,
    monthsRequired: MONTHS_REQUIRED,
    ready,
    methods: METHODS,
    gateMessage: `Forecasting needs ≥${MONTHS_REQUIRED} months of history; currently ${h.monthsAvailable} month${h.monthsAvailable === 1 ? '' : 's'} — forecast not yet available`,
    note: ready
      ? `Sufficient history (${h.monthsAvailable} months) — a statistical model can produce a forecast.`
      : `Forecast appears automatically once ${remaining} more month${remaining === 1 ? '' : 's'} of orders accrue (no backfill needed — just elapsed time).`,
  }
}

/**
 * GATED forecast. ready=false → NO predicted values (no line, no numbers); absence is the
 * honest answer. ready=true → the statistical-model path (a documented STUB that must NOT
 * fabricate output; unreachable until ≥12 months exist).
 */
export async function getForecast(tenantId) {
  const h = await loadHistory(tenantId)
  const ready = h.monthsAvailable >= MONTHS_REQUIRED

  if (!ready) {
    return {
      ...h, monthsRequired: MONTHS_REQUIRED, ready: false, methods: METHODS,
      forecast: null,   // ← NO predicted values while gated — the gate, not a fabricated line
      gateMessage: `Forecasting needs ≥${MONTHS_REQUIRED} months of history; currently ${h.monthsAvailable} month${h.monthsAvailable === 1 ? '' : 's'} — forecast not yet available`,
      note: 'No projection is produced (honest gate, not a fabricated line). The forecast appears once ≥12 months exist.',
    }
  }

  // ── MODEL PATH — UNREACHABLE until ready=true ───────────────────────────────
  // When ≥12 months of history exist, fit a STATISTICAL model (Holt-Winters / ARIMA /
  // Prophet) on `h.history` here and return real predicted points (+ a confidence band).
  // This is a documented STUB: it must NOT fabricate output. The LLM never predicts
  // numbers; the statistical model does. Implementing this is the future "L" work — until
  // then the gate above is the only reachable path, so nothing fake is ever returned.
  return {
    ...h, monthsRequired: MONTHS_REQUIRED, ready: true, methods: METHODS,
    forecast: null,   // stub — wire the statistical model here; no fabricated series
    note: 'Sufficient history — statistical-model path not yet implemented (stub). No fabricated forecast is returned.',
  }
}
