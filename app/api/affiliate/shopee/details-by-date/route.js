import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date     = searchParams.get('date')   ?? ''
  const search   = searchParams.get('search') ?? ''
  const page     = parseInt(searchParams.get('page')  ?? '1')
  const limit    = parseInt(searchParams.get('limit') ?? '25')
  const tenantId = session.user.tenantId

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const where = {
    tenantId,
    date: new Date(date),
    ...(search ? { username: { contains: search, mode: 'insensitive' } } : {}),
  }

  const [total, rows] = await prisma.$transaction([
    prisma.affiliateShopee.count({ where }),
    prisma.affiliateShopee.findMany({
      where,
      orderBy: { omzetPenjualan: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const data = rows.map(r => ({
    id:               r.id,
    username:         r.username,
    channel:          r.channel   ?? '',
    order_type:       r.orderType ?? '',
    produk_terjual:   r.produkTerjual  ?? 0,
    pesanan:          r.pesanan        ?? 0,
    clicks:           r.clicks         ?? 0,
    omzet_penjualan:  Number(r.omzetPenjualan  ?? 0),
    biaya_iklan:      Number(r.biayaIklan      ?? 0),
    komisi_affiliate: Number(r.komisiAffiliate ?? 0),
    roi:              Number(r.roi ?? 0),
    total_pembeli:    r.totalPembeli ?? 0,
    pembeli_baru:     r.pembeliBaru  ?? 0,
    ctr: (r.clicks ?? 0) > 0 ? (r.pesanan ?? 0) / r.clicks * 100 : 0,
    commission_rate: Number(r.omzetPenjualan ?? 0) > 0
      ? Number(r.komisiAffiliate ?? 0) / Number(r.omzetPenjualan) * 100 : 0,
  }))

  return NextResponse.json({ data, total, page, limit })
}
