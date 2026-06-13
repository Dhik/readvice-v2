import { requireSuperAdmin } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getSheetRows } from '@/lib/google-sheets'

export const runtime = 'nodejs'

// Keep the columns from dataRange but force rows 1–6 (row 1 = header, 2–6 =
// up to 5 sample rows) so we never fetch the whole sheet for a preview.
//   'A2:R' → 'A1:R6'   'A2:R100' → 'A1:R6'   'A:R' → 'A1:R6'   bad → 'A1:Z6'
function previewRangeFromDataRange(dataRange) {
  // Sheet columns are 1–3 letters (A … XFD); anything else → safe default.
  const m = String(dataRange ?? '').match(/^([A-Za-z]{1,3})\d*(?::([A-Za-z]{1,3})\d*)?$/)
  if (!m) return 'A1:Z6'
  return `${m[1].toUpperCase()}1:${(m[2] || m[1]).toUpperCase()}6`
}

// GET /api/connectors/[id]/preview — superadmin. Reads a small sample so the
// user can discover column indices before configuring columnMapping.
// Optional overrides (?spreadsheetId, ?sheetTab, ?dataRange) let the user try
// values they're currently typing, before saving the connector.
export async function GET(request, { params }) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const { id } = await params
  const connectorId = parseInt(id, 10)
  if (Number.isNaN(connectorId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const connector = await prisma.dataConnector.findUnique({ where: { id: connectorId } })
  if (!connector) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const spreadsheetId = searchParams.get('spreadsheetId') || connector.spreadsheetId
  const sheetTab      = searchParams.get('sheetTab')      || connector.sheetTab
  const dataRange     = searchParams.get('dataRange')     || connector.dataRange

  const previewRange = `${sheetTab}!${previewRangeFromDataRange(dataRange)}`

  try {
    const rows = await getSheetRows(spreadsheetId, previewRange) // creds validated inside
    const headers     = rows[0] ?? []
    const sampleRows   = rows.slice(1, 6)
    const columnCount = Math.max(headers.length, ...sampleRows.map(r => r.length), 0)
    return NextResponse.json({ headers, sampleRows, columnCount })
  } catch (e) {
    const msg = e?.message ?? 'Preview failed'
    console.error('CONNECTOR PREVIEW FAILED:', msg)
    return NextResponse.json({ error: `Sheet preview failed: ${msg}` }, { status: 502 })
  }
}
