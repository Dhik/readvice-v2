// Talent-returns importer (dummy→real) — Talent ROI attributed return.
// Sheet columns: talent_handle | period | attributed_revenue | attributed_gmv |
//                content_views | conversions | engagement_actions
// Talent matched by Talent.username (handle, case-insensitive, tenant-scoped). For each
// (talent, month) we REPLACE any existing rows (dummy or prior real) with one source="REAL"
// row, so re-syncs are idempotent and dummy is cleanly swapped out for the talents you provide.
// See docs/DUMMY_TO_REAL_IMPORT.md.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSheetRows, rowsToObjects } from '@/lib/google-sheets'
import { prisma } from '@/lib/prisma'
import { pick, num, monthStart, normHandle } from '@/lib/import-helpers'
import { NextResponse } from 'next/server'

const SPREADSHEET_ID = process.env.TALENT_RETURNS_SHEET_ID
const RANGE = 'Sheet1!A:Z'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenantId = session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant in session' }, { status: 400 })
  if (!SPREADSHEET_ID) return NextResponse.json({ error: 'TALENT_RETURNS_SHEET_ID not configured' }, { status: 500 })

  let rows
  try { rows = rowsToObjects(await getSheetRows(SPREADSHEET_ID, RANGE)) }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 502 }) }

  // Resolve handle → talentId once (tenant-scoped).
  const talents = await prisma.talent.findMany({ where: { tenantId }, select: { id: true, username: true } })
  const byHandle = new Map(talents.map(t => [normHandle(t.username), t.id]))

  let imported = 0, skipped = 0
  const unmatched = new Set()
  for (const r of rows) {
    const handle = normHandle(pick(r, 'talent_handle', 'talent', 'handle', 'username'))
    const period = monthStart(pick(r, 'period', 'month', 'bulan', 'date'))
    const talentId = byHandle.get(handle)
    if (!talentId || !period) { skipped++; if (handle && !talentId) unmatched.add(handle); continue }
    try {
      await prisma.$transaction([
        prisma.talentReturn.deleteMany({ where: { tenantId, talentId, period } }),
        prisma.talentReturn.create({
          data: {
            tenantId, talentId, period, source: 'REAL',
            attributedRevenue: num(pick(r, 'attributed_revenue', 'revenue')),
            attributedGmv:     num(pick(r, 'attributed_gmv', 'gmv')),
            contentViews: Math.round(num(pick(r, 'content_views', 'views'))),
            conversions:  Math.round(num(pick(r, 'conversions'))),
            engagementActions: Math.round(num(pick(r, 'engagement_actions', 'engagement'))),
          },
        }),
      ])
      imported++
    } catch { skipped++ }
  }
  return NextResponse.json({ imported, skipped, total: rows.length, unmatchedHandles: [...unmatched].slice(0, 20) })
}
