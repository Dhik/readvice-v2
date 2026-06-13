import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSheetRows, rowsToObjects } from '@/lib/google-sheets'
import { NextResponse } from 'next/server'

const SPREADSHEET_ID = process.env.CRM_ANISA_SHEET_ID
const RANGE = 'Sheet1!A:Z'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!SPREADSHEET_ID) return NextResponse.json({ error: 'Sheet ID not configured' }, { status: 500 })
  const rows = await getSheetRows(SPREADSHEET_ID, RANGE)
  const data = rowsToObjects(rows)
  return NextResponse.json({ imported: data.length })
}
