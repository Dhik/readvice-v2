import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

function mapOrderRow(row, platform) {
  switch (platform) {
    case 'shopee': return {
      orderId:         row['No. Pesanan']?.toString()?.trim(),
      orderDate:       row['Waktu Pembayaran Escrow'] ? new Date(row['Waktu Pembayaran Escrow']) : new Date(),
      customerUsername: row['Username (Pembeli)']?.toString()?.trim(),
      gmv:             parseFloat(row['Total Harga Produk'] ?? 0) || 0,
      nett:            parseFloat(row['Total Pembayaran']   ?? 0) || 0,
      status:          row['Status Pesanan']?.toString()?.trim() ?? null,
    }
    case 'tiktok': return {
      orderId:         row['Order ID']?.toString()?.trim(),
      orderDate:       row['Order Creation Time'] ? new Date(row['Order Creation Time']) : new Date(),
      customerUsername: row['Username']?.toString()?.trim(),
      gmv:             parseFloat(row['Total Product Price'] ?? 0) || 0,
      nett:            parseFloat(row['Order Amount']        ?? 0) || 0,
      status:          row['Order Status']?.toString()?.trim() ?? null,
    }
    case 'lazada': return {
      orderId:         row['Order ID']?.toString()?.trim(),
      orderDate:       row['Created at'] ? new Date(row['Created at']) : new Date(),
      customerName:    row['Customer Name']?.toString()?.trim(),
      gmv:             parseFloat(row['Unit Price'] ?? 0) || 0,
      nett:            parseFloat(row['Paid Price']  ?? 0) || 0,
      status:          row['Status']?.toString()?.trim() ?? null,
    }
    case 'tokopedia': return {
      orderId:         row['No Invoice']?.toString()?.trim(),
      orderDate:       row['Tanggal Pembayaran'] ? new Date(row['Tanggal Pembayaran']) : new Date(),
      customerName:    row['Nama Pembeli']?.toString()?.trim(),
      gmv:             parseFloat(row['Harga Produk'] ?? 0) || 0,
      nett:            parseFloat(row['Jumlah']       ?? 0) || 0,
      status:          row['Status']?.toString()?.trim() ?? null,
    }
    default: return {
      orderId:   row['order_id']?.toString()?.trim(),
      orderDate: new Date(),
      gmv:       parseFloat(row['gmv']  ?? 0) || 0,
      nett:      parseFloat(row['nett'] ?? 0) || 0,
    }
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file     = formData.get('file')
  const platform = formData.get('platform') ?? 'shopee'
  const buffer   = Buffer.from(await file.arrayBuffer())
  const wb       = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const rows     = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

  const tenantId = session.user.tenantId
  let created = 0, updated = 0
  const errors = []

  for (const row of rows) {
    try {
      const mapped = mapOrderRow(row, platform)
      if (!mapped.orderId) continue
      // Check existence before upsert so we can report create vs update accurately
      // (Prisma upsert doesn't tell you which path it took).
      const existing = await prisma.order.findUnique({
        where:  { orderId_tenantId: { orderId: mapped.orderId, tenantId } },
        select: { id: true },
      })
      await prisma.order.upsert({
        where:  { orderId_tenantId: { orderId: mapped.orderId, tenantId } },
        update: mapped,
        create: { ...mapped, tenantId, platform },
      })
      if (existing) updated++
      else          created++
    } catch (e) {
      errors.push({ error: e.message })
    }
  }

  return NextResponse.json({ created, updated, errors })
}
