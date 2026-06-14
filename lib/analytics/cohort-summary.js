// ─── Cohort Retention engine (Wave 2 §2.3 — MOST dummy-heavy) ───────────────
// Time-based retention: rows = acquisition month, cols = months-since-acquisition.
// Reads the stored CohortRetention grid (computed by seed-dev-cohort / a future recompute).
//
// HONESTY (see docs/COHORT_DATA_SOURCES.md): with ~1 month of real data, only the latest
// cohort's period-0 size is REAL (source='REAL-DERIVED'); all retention curves (period 1+)
// and earlier "shape" cohorts are DUMMY decay. Every cell carries `dummy`. This is the
// TIME-BASED retention view — distinct from RFM (segment view); don't conflate.
// It becomes real automatically as time elapses — no connector, just continued sync.
//
// Tenant-scoped every read; Decimal/BigInt → Number.
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { EXCLUDED_STATUSES } from '../hpp/compute-hpp'

const round1 = n => Math.round((Number(n) || 0) * 10) / 10
const num    = v => Number(v ?? 0)
const ym     = d => { const x = new Date(d); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}` }

// ── Core loader: stored grid → cohorts (rows) with their cells (cols) ─────────
async function loadGrid(tenantId) {
  const rows = await prisma.cohortRetention.findMany({
    where: { tenantId }, orderBy: [{ cohortMonth: 'asc' }, { periodIndex: 'asc' }],
  })
  if (!rows.length) return { cohorts: [], maxPeriod: -1 }
  const byCohort = new Map()
  for (const r of rows) {
    const key = ym(r.cohortMonth)
    const c = byCohort.get(key) ?? { cohortMonth: key, cohortSize: r.cohortSize, cells: [], anyDummy: false, p0Source: null }
    c.cells.push({ periodIndex: r.periodIndex, retentionPct: round1(r.retentionPct), customersRetained: num(r.customersRetained), dummy: r.source === 'DUMMY' })
    if (r.source === 'DUMMY') c.anyDummy = true
    if (r.periodIndex === 0) { c.cohortSize = num(r.cohortSize); c.p0Source = r.source }
    byCohort.set(key, c)
  }
  const cohorts = [...byCohort.values()].sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
  const maxPeriod = Math.max(...rows.map(r => r.periodIndex))
  return { cohorts, maxPeriod }
}

/** Full triangular grid for the HEATMAP. rows=cohort, cols=periodIndex, cells carry `dummy`. */
export async function getCohortGrid(tenantId) {
  const { cohorts, maxPeriod } = await loadGrid(tenantId)
  let realCells = 0, dummyCells = 0
  for (const c of cohorts) for (const cell of c.cells) (cell.dummy ? dummyCells++ : realCells++)
  return {
    hasData: cohorts.length > 0,
    cohorts: cohorts.map(c => ({
      cohortMonth: c.cohortMonth, cohortSize: c.cohortSize,
      real: c.p0Source === 'REAL-DERIVED',                 // is this cohort's size real?
      cells: c.cells,
    })),
    periods: maxPeriod >= 0 ? Array.from({ length: maxPeriod + 1 }, (_, i) => i) : [],
    realCellCount: realCells, dummyCellCount: dummyCells,
    note: 'Only the latest cohort’s period-0 size is real; retention curves are DUMMY (insufficient elapsed history). Becomes real with time.',
  }
}

/** Overview KPIs: cohort count, avg month-1 retention (dummy-flagged), customers covered, cell split. */
export async function getCohortOverview(tenantId) {
  const { cohorts } = await loadGrid(tenantId)
  if (!cohorts.length) return { hasData: false, cohortCount: 0, note: 'No cohort data for this tenant.' }
  let realCells = 0, dummyCells = 0
  const m1 = []
  for (const c of cohorts) for (const cell of c.cells) {
    cell.dummy ? dummyCells++ : realCells++
    if (cell.periodIndex === 1) m1.push(cell.retentionPct)
  }
  const realCohorts = cohorts.filter(c => c.p0Source === 'REAL-DERIVED')
  return {
    hasData: true,
    cohortCount: cohorts.length,
    realCohortCount: realCohorts.length,
    customersCovered: realCohorts.reduce((a, c) => a + c.cohortSize, 0),   // REAL acquisition customers
    avgMonth1Retention: m1.length ? round1(m1.reduce((a, b) => a + b, 0) / m1.length) : null,
    month1Dummy: true,   // all period-1 cells are dummy in dev
    realCellCount: realCells, dummyCellCount: dummyCells, totalCells: realCells + dummyCells,
    note: 'Month-1+ retention is DUMMY (no elapsed follow-up). Only latest-cohort period-0 is real.',
  }
}

/** Acquisition-volume trend — period-0 cohort sizes over time. REAL where the cohort is real. */
export async function getCohortTrend(tenantId) {
  const { cohorts } = await loadGrid(tenantId)
  return {
    hasData: cohorts.length > 0,
    points: cohorts.map(c => ({ cohortMonth: c.cohortMonth, size: c.cohortSize, dummy: c.p0Source !== 'REAL-DERIVED' })),
    note: 'Acquisition volume by cohort. Real where the cohort is real (latest month); earlier cohorts are dummy shape data.',
  }
}

/** One cohort: full retention curve + (for real cohorts) the acquired customers. */
export async function getCohortDetail(tenantId, cohortMonth) {
  const { cohorts } = await loadGrid(tenantId)
  const c = cohorts.find(x => x.cohortMonth === cohortMonth)
  if (!c) return null

  let customers = []
  if (c.p0Source === 'REAL-DERIVED') {
    // Real acquisition customers for this month (same identity rule as RFM).
    const [y, m] = cohortMonth.split('-').map(Number)
    const start = new Date(Date.UTC(y, m - 1, 1)), end = new Date(Date.UTC(y, m, 1))
    const rows = await prisma.$queryRaw(Prisma.sql`
      WITH firsts AS (
        SELECT customer_username, MIN(order_date) AS first_date, MAX(customer_name) AS name, COUNT(*)::int AS orders
        FROM orders WHERE tenant_id = ${tenantId} AND customer_username IS NOT NULL AND status NOT IN (${Prisma.join(EXCLUDED_STATUSES)})
        GROUP BY customer_username)
      SELECT customer_username AS username, name, orders FROM firsts
      WHERE first_date >= ${start} AND first_date < ${end}
      ORDER BY orders DESC LIMIT 100`)
    customers = rows.map(r => ({ username: r.username, name: r.name ?? r.username, orders: num(r.orders) }))
  }
  return {
    cohortMonth: c.cohortMonth, cohortSize: c.cohortSize, real: c.p0Source === 'REAL-DERIVED',
    curve: c.cells.map(cell => ({ periodIndex: cell.periodIndex, retentionPct: cell.retentionPct, customersRetained: cell.customersRetained, dummy: cell.dummy })),
    customers, customerListAvailable: customers.length > 0,
    note: c.p0Source === 'REAL-DERIVED'
      ? 'Period-0 size + customer list are real; the retention curve (period 1+) is DUMMY (no elapsed follow-up yet).'
      : 'This cohort is fabricated shape data (no real acquisition this month).',
  }
}
