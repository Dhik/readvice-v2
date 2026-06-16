import { requireAuth, getTenantId } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { evaluate } from '@/lib/analytics/calc-field'
import { getManifest } from '@/lib/analytics/field-manifests'

export const runtime = 'nodejs'

// Calculated fields CRUD (Part B3). Tenant-scoped per @@unique([tenantId, module, key]).
// The B2 evaluator is the SINGLE source of formula validation — POST runs evaluate()
// against the module's FIELD_MANIFEST and rejects on its structural errors (unknown
// symbol / function call / non-whitelisted construct) BEFORE persisting. Single awaited
// writes (connection_limit=1).

const slug = s => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'field'

// GET /api/analytics/calc-fields?module=gross-margin → { module, manifest, fields }
export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const module = new URL(request.url).searchParams.get('module')
  const manifest = getManifest(module)
  if (!manifest) return NextResponse.json({ error: `Unknown module '${module}'` }, { status: 400 })

  const fields = await prisma.calculatedField.findMany({
    where: { tenantId, module },
    select: { id: true, module: true, key: true, label: true, formula: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ module, manifest, fields })
}

// POST body: { module, label, formula, key? } → validates module + formula, persists.
export async function POST(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const module = String(body?.module || '')
  const label = String(body?.label || '').trim()
  const formula = String(body?.formula || '').trim()
  const manifest = getManifest(module)
  if (!manifest) return NextResponse.json({ error: `Unknown module '${module}'` }, { status: 400 })
  if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 })
  if (!formula) return NextResponse.json({ error: 'Formula is required' }, { status: 400 })

  // SINGLE source of truth — server-side validation via the B2 evaluator (no second parser).
  // A structurally-invalid / non-whitelisted formula throws → 400 before persisting.
  try { evaluate(formula, {}, manifest) }
  catch (e) { return NextResponse.json({ error: `Invalid formula: ${e.message}` }, { status: 400 }) }

  const key = slug(body?.key || label)
  try {
    const created = await prisma.calculatedField.create({
      data: { tenantId, module, key, label, formula },
      select: { id: true, module: true, key: true, label: true, formula: true, createdAt: true },
    })
    return NextResponse.json({ ok: true, field: created }, { status: 201 })
  } catch (e) {
    if (e?.code === 'P2002') return NextResponse.json({ error: `A field with key '${key}' already exists for this module — pick a different label.` }, { status: 409 })
    console.error('CALC-FIELD POST FAILED:', e?.message)
    return NextResponse.json({ error: 'Failed to save calculated field' }, { status: 500 })
  }
}

// DELETE /api/analytics/calc-fields?id=123 — tenant-scoped delete.
export async function DELETE(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const tenantId = getTenantId(session)
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const res = await prisma.calculatedField.deleteMany({ where: { id, tenantId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
