import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''
  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    ...(dateFrom && dateTo ? { date: { gte: new Date(dateFrom), lte: new Date(dateTo) } } : {}),
  }

  const [agg, distinctUsernames] = await prisma.$transaction([
    prisma.affiliateShopee.aggregate({
      where,
      _sum: {
        pesanan: true, produkTerjual: true, omzetPenjualan: true,
        komisiAffiliate: true, totalPembeli: true, pembeliBaru: true,
      },
      _avg: { roi: true },
    }),
    prisma.affiliateShopee.groupBy({ by: ['username'], where }),
  ])

  return NextResponse.json({
    total_affiliates:   distinctUsernames.length,
    total_orders:       agg._sum.pesanan       ?? 0,
    total_products:     agg._sum.produkTerjual  ?? 0,
    total_gmv:          Number(agg._sum.omzetPenjualan  ?? 0),
    total_commission:   Number(agg._sum.komisiAffiliate ?? 0),
    avg_roi:            Number(agg._avg.roi ?? 0),
    total_pembeli:      agg._sum.totalPembeli ?? 0,
    total_pembeli_baru: agg._sum.pembeliBaru  ?? 0,
    new_buyer_rate:     (agg._sum.totalPembeli ?? 0) > 0
      ? (agg._sum.pembeliBaru ?? 0) / agg._sum.totalPembeli * 100 : 0,
  })
}
