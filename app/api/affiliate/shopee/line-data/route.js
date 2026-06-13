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

  const grouped = await prisma.affiliateShopee.groupBy({
    by: ['date'],
    where,
    _sum: { omzetPenjualan: true, komisiAffiliate: true, pesanan: true },
    _avg: { roi: true },
    _count: { username: true },
    orderBy: { date: 'asc' },
  })

  const data = grouped.map(g => ({
    date:       g.date,
    gmv:        Number(g._sum.omzetPenjualan  ?? 0),
    commission: Number(g._sum.komisiAffiliate ?? 0),
    affiliates: g._count.username,
    avg_roi:    Number(g._avg.roi ?? 0),
    orders:     g._sum.pesanan ?? 0,
  }))

  return NextResponse.json({ data })
}
