import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page     = parseInt(searchParams.get('page')  ?? '1')
  const limit    = parseInt(searchParams.get('limit') ?? '25')
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''
  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    ...(dateFrom && dateTo ? { date: { gte: new Date(dateFrom), lte: new Date(dateTo) } } : {}),
  }

  const [allDates, totalDatesResult] = await prisma.$transaction([
    prisma.affiliateShopee.groupBy({
      by: ['date'], where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.affiliateShopee.groupBy({ by: ['date'], where }),
  ])

  const total = totalDatesResult.length

  const rows = await Promise.all(allDates.map(async ({ date }) => {
    const agg = await prisma.affiliateShopee.aggregate({
      where: { tenantId, date },
      _count: { username: true },
      _sum: {
        produkTerjual: true, pesanan: true, clicks: true,
        omzetPenjualan: true, biayaIklan: true, komisiAffiliate: true,
        totalPembeli: true, pembeliBaru: true,
      },
      _avg: { roi: true },
    })
    const omzet   = Number(agg._sum.omzetPenjualan ?? 0)
    const komisi  = Number(agg._sum.komisiAffiliate ?? 0)
    const clicks  = agg._sum.clicks  ?? 0
    const pesanan = agg._sum.pesanan ?? 0
    const totalP  = agg._sum.totalPembeli ?? 0
    const baruP   = agg._sum.pembeliBaru  ?? 0
    return {
      date,
      affiliate_count:  agg._count.username,
      produk_terjual:   agg._sum.produkTerjual ?? 0,
      pesanan,
      clicks,
      omzet_penjualan:  omzet,
      biaya_iklan:      Number(agg._sum.biayaIklan ?? 0),
      komisi_affiliate: komisi,
      roi:              Number(agg._avg.roi ?? 0),
      total_pembeli:    totalP,
      pembeli_baru:     baruP,
      ctr:              clicks > 0 ? pesanan / clicks * 100 : 0,
      commission_rate:  omzet  > 0 ? komisi  / omzet  * 100 : 0,
      new_buyer_rate:   totalP > 0 ? baruP   / totalP * 100 : 0,
    }
  }))

  return NextResponse.json({ data: rows, total, page, limit })
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''
  const tenantId = session.user.tenantId

  if (!dateFrom || !dateTo) return NextResponse.json({ error: 'dateFrom and dateTo required' }, { status: 400 })

  const result = await prisma.affiliateShopee.deleteMany({
    where: { tenantId, date: { gte: new Date(dateFrom), lte: new Date(dateTo) } },
  })

  return NextResponse.json({ deleted: result.count })
}
