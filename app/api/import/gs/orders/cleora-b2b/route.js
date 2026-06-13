import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSheetRows, rowsToObjects } from '@/lib/google-sheets'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const SPREADSHEET_ID = process.env.CLEORA_B2B_SHEET_ID
const RANGE = 'Sheet1!A:Z'
const TENANT_ID = 1
const PLATFORM = 'b2b'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!SPREADSHEET_ID) return NextResponse.json({ error: 'Sheet ID not configured' }, { status: 500 })

  const rows = await getSheetRows(SPREADSHEET_ID, RANGE)
  const data = rowsToObjects(rows)
  let count = 0

  for (const obj of data) {
    try {
      const orderId = obj['order_id'] ?? obj['No. Pesanan'] ?? obj['Order ID']
      if (!orderId) continue
      await prisma.order.upsert({
        where: { orderId_tenantId: { orderId: orderId.toString(), tenantId: TENANT_ID } },
        update: { platform: PLATFORM },
        create: { orderId: orderId.toString(), tenantId: TENANT_ID, platform: PLATFORM, orderDate: new Date() },
      })
      count++
    } catch {}
  }

  return NextResponse.json({ imported: count })
}
