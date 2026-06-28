// Order-fulfilment importer (dummy→real) — Operational fulfilment timing.
// Sheet columns: order_ref | processing_days | shipping_days | total_days
// `order_ref` = the platform order ID → resolved to the internal Order (tenant-scoped).
// For each matched order we REPLACE any existing fulfilment row with one source="REAL"
// (idempotent re-sync, dummy swapped out). See docs/DUMMY_TO_REAL_IMPORT.md.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSheetRows, rowsToObjects } from '@/lib/google-sheets'
import { prisma } from '@/lib/prisma'
import { pick, num } from '@/lib/import-helpers'
import { NextResponse } from 'next/server'

const SPREADSHEET_ID = process.env.ORDER_FULFILLMENT_SHEET_ID
const RANGE = 'Sheet1!A:Z'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenantId = session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant in session' }, { status: 400 })
  if (!SPREADSHEET_ID) return NextResponse.json({ error: 'ORDER_FULFILLMENT_SHEET_ID not configured' }, { status: 500 })

  let rows
  try { rows = rowsToObjects(await getSheetRows(SPREADSHEET_ID, RANGE)) }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 502 }) }

  let imported = 0, skipped = 0, unmatched = 0
  for (const r of rows) {
    const ref = String(pick(r, 'order_ref', 'order_id', 'No. Pesanan', 'orderId') ?? '').trim()
    if (!ref) { skipped++; continue }
    const order = await prisma.order.findUnique({
      where: { orderId_tenantId: { orderId: ref, tenantId } },
      select: { id: true },
    })
    if (!order) { skipped++; unmatched++; continue }
    const processingDays = num(pick(r, 'processing_days', 'processing'))
    const shippingDays   = num(pick(r, 'shipping_days', 'shipping'))
    const totalDays      = num(pick(r, 'total_days', 'total')) || (processingDays + shippingDays)
    try {
      await prisma.$transaction([
        prisma.orderFulfillment.deleteMany({ where: { tenantId, orderId: order.id } }),
        prisma.orderFulfillment.create({
          data: { tenantId, orderId: order.id, processingDays, shippingDays, totalDays, source: 'REAL' },
        }),
      ])
      imported++
    } catch { skipped++ }
  }
  return NextResponse.json({ imported, skipped, unmatchedOrders: unmatched, total: rows.length })
}
