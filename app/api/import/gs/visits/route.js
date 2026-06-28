// Visits importer (dummy→real) — Dashboard/Sales "Visit" + derived ROAS/Closing/CPA.
// Sheet columns: date | platform | visits. Upserts into `visits` with source="REAL"
// (tenant-scoped via session). See docs/DUMMY_TO_REAL_IMPORT.md.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSheetRows, rowsToObjects } from '@/lib/google-sheets'
import { prisma } from '@/lib/prisma'
import { pick, num, dateOnly } from '@/lib/import-helpers'
import { NextResponse } from 'next/server'

const SPREADSHEET_ID = process.env.VISITS_SHEET_ID
const RANGE = 'Sheet1!A:Z'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenantId = session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant in session' }, { status: 400 })
  if (!SPREADSHEET_ID) return NextResponse.json({ error: 'VISITS_SHEET_ID not configured' }, { status: 500 })

  let rows
  try { rows = rowsToObjects(await getSheetRows(SPREADSHEET_ID, RANGE)) }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 502 }) }

  let imported = 0, skipped = 0
  for (const r of rows) {
    const date = dateOnly(pick(r, 'date', 'Date', 'tanggal'))
    const platform = String(pick(r, 'platform', 'Platform') ?? '').trim().toLowerCase()
    if (!date || !platform) { skipped++; continue }
    const visits = Math.round(num(pick(r, 'visits', 'Visits', 'visit', 'kunjungan')))
    try {
      await prisma.visit.upsert({
        where: { tenantId_date_platform: { tenantId, date, platform } },
        update: { visits, source: 'REAL' },
        create: { tenantId, date, platform, visits, source: 'REAL' },
      })
      imported++
    } catch { skipped++ }
  }
  return NextResponse.json({ imported, skipped, total: rows.length })
}
