import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''
  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    ...(dateFrom && dateTo ? { date: { gte: new Date(dateFrom), lte: new Date(dateTo) } } : {}),
  }

  const rows = await prisma.affiliateShopee.findMany({
    where,
    orderBy: [{ date: 'asc' }, { username: 'asc' }],
  })

  const data = rows.map(r => ({
    Date:             r.date.toISOString().slice(0, 10),
    Username:         r.username,
    Channel:          r.channel   ?? '',
    'Order Type':     r.orderType ?? '',
    'Produk Terjual': r.produkTerjual ?? 0,
    Pesanan:          r.pesanan   ?? 0,
    Clicks:           r.clicks    ?? 0,
    'Omzet (IDR)':    Number(r.omzetPenjualan  ?? 0),
    'Biaya Iklan':    Number(r.biayaIklan      ?? 0),
    'Komisi':         Number(r.komisiAffiliate ?? 0),
    ROI:              Number(r.roi ?? 0),
    'Total Pembeli':  r.totalPembeli ?? 0,
    'Pembeli Baru':   r.pembeliBaru  ?? 0,
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Affiliate Shopee')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="affiliate-shopee.xlsx"',
    },
  })
}
