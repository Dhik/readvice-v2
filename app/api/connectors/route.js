import { requireSuperAdmin } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CONNECTOR_TYPES, TARGET_TABLES, validateColumnMapping } from '@/lib/connectors/transforms'
import { validateSourceConfig, persistedSourceFields } from '@/lib/connectors/source-config'

// GET /api/connectors — superadmin. Lists connectors across ALL tenants.
// Optional filters: ?tenantId= , ?connectorType=
export async function GET(request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const tenantId      = searchParams.get('tenantId')
  const connectorType = searchParams.get('connectorType')

  const where = {
    ...(tenantId ? { tenantId: parseInt(tenantId, 10) } : {}),
    ...(connectorType ? { connectorType } : {}),
  }

  const rows = await prisma.dataConnector.findMany({
    where,
    include: { tenant: { select: { id: true, name: true, slug: true } } },
    orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({ data: rows })
}

// Shared body validation for POST/PUT. Returns an error string or null.
function validateBody(body) {
  if (!body.name?.trim())            return 'Name is required'
  if (!Number.isInteger(body.tenantId)) return 'A tenant is required'
  if (!CONNECTOR_TYPES.includes(body.connectorType)) return `Invalid connectorType (allowed: ${CONNECTOR_TYPES.join(', ')})`
  if (!TARGET_TABLES.includes(body.targetTable))     return `Invalid targetTable (allowed: ${TARGET_TABLES.join(', ')})`
  const srcErr = validateSourceConfig(body)   // Part E — source fields validated by sourceType
  if (srcErr) return srcErr
  if (!Array.isArray(body.upsertKey) || body.upsertKey.length === 0) return 'upsertKey must be a non-empty array'
  try {
    validateColumnMapping(body.columnMapping)
  } catch (e) {
    return e.message
  }
  return null
}

// POST /api/connectors — superadmin. Create.
export async function POST(request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const invalid = validateBody(body)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  try {
    const created = await prisma.dataConnector.create({
      data: {
        tenantId:      body.tenantId,
        name:          body.name.trim(),
        connectorType: body.connectorType,
        ...persistedSourceFields(body),   // sourceType + sourceConfig + legacy Sheets columns
        targetTable:   body.targetTable,
        upsertKey:     body.upsertKey,
        columnMapping: body.columnMapping,
        staticValues:  body.staticValues ?? null,
        isActive:      body.isActive ?? true,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'A connector with this name already exists for this tenant' }, { status: 409 })
    if (e.code === 'P2003') return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    throw e
  }
}
