import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { loadConfig, DEFAULT_CONFIG } from '@/lib/analytics/pnl-summary'

export const runtime = 'nodejs'

// Tenant P&L business-rules config (Wave 3.3). Tenant-scoped via session (a tenant edits
// its OWN rules — not superadmin). GET returns the effective config + whether a row exists;
// PATCH upserts (single awaited write, connection_limit=1) and validates the shape.

const isNum = v => typeof v === 'number' && Number.isFinite(v)

// Returns an error string or null.
function validate(body) {
  if (body.platformFeePct != null) {
    if (typeof body.platformFeePct !== 'object' || Array.isArray(body.platformFeePct)) return 'platformFeePct must be an object of { platform: percent }'
    for (const [k, v] of Object.entries(body.platformFeePct)) { if (!isNum(v) || v < 0 || v > 100) return `platformFeePct.${k} must be 0–100` }
    if (!isNum(body.platformFeePct.default)) return 'platformFeePct.default is required (fallback rate)'
  }
  if (body.taxPct != null && (!isNum(body.taxPct) || body.taxPct < 0 || body.taxPct > 100)) return 'taxPct must be 0–100'
  if (body.marketingDeducted != null && typeof body.marketingDeducted !== 'boolean') return 'marketingDeducted must be a boolean'
  if (body.opexCategories != null) {
    if (!Array.isArray(body.opexCategories)) return 'opexCategories must be an array'
    for (const c of body.opexCategories) {
      if (!c || typeof c.label !== 'string' || !c.label.trim()) return 'each opex category needs a label'
      const hasAmount = isNum(c.amount), hasPct = isNum(c.pct)
      if (hasAmount === hasPct) return `opex "${c.label}" must have EITHER a fixed amount OR a percent (not both, not neither)`
      if (hasPct && (c.pct < 0 || c.pct > 100)) return `opex "${c.label}" percent must be 0–100`
      if (hasAmount && c.amount < 0) return `opex "${c.label}" amount must be ≥ 0`
    }
  }
  return null
}

export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })
  const { config, hasConfigRow } = await loadConfig(tenantId)
  return NextResponse.json({ config, hasConfigRow, defaults: DEFAULT_CONFIG })
}

export async function PATCH(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const invalid = validate(body)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  // Merge onto the current effective config so a partial PATCH is safe.
  const { config: current } = await loadConfig(tenantId)
  const next = {
    platformFeePct:    body.platformFeePct    ?? current.platformFeePct,
    taxPct:            body.taxPct            ?? current.taxPct,
    opexCategories:    body.opexCategories    ?? current.opexCategories,
    marketingDeducted: body.marketingDeducted ?? current.marketingDeducted,
  }
  try {
    const saved = await prisma.tenantPnlConfig.upsert({
      where:  { tenantId },
      create: { tenantId, ...next },
      update: next,
    })
    return NextResponse.json({ ok: true, config: { platformFeePct: saved.platformFeePct, taxPct: saved.taxPct, opexCategories: saved.opexCategories, marketingDeducted: saved.marketingDeducted } })
  } catch (e) {
    console.error('PNL CONFIG PATCH FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to save P&L config' }, { status: 500 })
  }
}
