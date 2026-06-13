import { requireSuperAdmin } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CONNECTOR_TYPES, TARGET_TABLES, validateColumnMapping } from '@/lib/connectors/transforms'

// GET /api/connectors/[id] — superadmin. Single connector detail.
export async function GET(request, { params }) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const { id } = await params
  const connector = await prisma.dataConnector.findUnique({
    where:   { id: parseInt(id, 10) },
    include: { tenant: { select: { id: true, name: true, slug: true } } },
  })
  if (!connector) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(connector)
}

function validateBody(body) {
  if (!body.name?.trim())               return 'Name is required'
  if (!Number.isInteger(body.tenantId)) return 'A tenant is required'
  if (!CONNECTOR_TYPES.includes(body.connectorType)) return `Invalid connectorType (allowed: ${CONNECTOR_TYPES.join(', ')})`
  if (!TARGET_TABLES.includes(body.targetTable))     return `Invalid targetTable (allowed: ${TARGET_TABLES.join(', ')})`
  if (!body.spreadsheetId?.trim())      return 'spreadsheetId is required'
  if (!body.sheetTab?.trim())           return 'sheetTab is required'
  if (!body.dataRange?.trim())          return 'dataRange is required'
  if (!Array.isArray(body.upsertKey) || body.upsertKey.length === 0) return 'upsertKey must be a non-empty array'
  try { validateColumnMapping(body.columnMapping) } catch (e) { return e.message }
  return null
}

// PUT /api/connectors/[id] — superadmin. Update.
export async function PUT(request, { params }) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const { id } = await params
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const invalid = validateBody(body)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  try {
    const updated = await prisma.dataConnector.update({
      where: { id: parseInt(id, 10) },
      data: {
        tenantId:      body.tenantId,
        name:          body.name.trim(),
        connectorType: body.connectorType,
        spreadsheetId: body.spreadsheetId.trim(),
        sheetTab:      body.sheetTab.trim(),
        dataRange:     body.dataRange.trim(),
        targetTable:   body.targetTable,
        upsertKey:     body.upsertKey,
        columnMapping: body.columnMapping,
        staticValues:  body.staticValues ?? null,
        isActive:      body.isActive ?? true,
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'A connector with this name already exists for this tenant' }, { status: 409 })
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (e.code === 'P2003') return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    throw e
  }
}

// DELETE /api/connectors/[id] — superadmin. Remove.
export async function DELETE(request, { params }) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const { id } = await params
  try {
    await prisma.dataConnector.delete({ where: { id: parseInt(id, 10) } })
    return NextResponse.json({ message: 'Deleted successfully' })
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    throw e
  }
}
