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

  const grouped = await prisma.affiliateTiktok.groupBy({
    by: ['date'],
    where,
    _sum: { affiliateGmv: true, estCommission: true, productsSold: true, estimatedOrders: true, impressions: true },
    _count: { creatorUsername: true },
    orderBy: { date: 'asc' },
  })

  const data = grouped.map(g => ({
    date:        g.date,
    gmv:         Number(g._sum.affiliateGmv    ?? 0),
    commission:  Number(g._sum.estCommission   ?? 0),
    products:    g._sum.productsSold            ?? 0,
    est_orders:  Number(g._sum.estimatedOrders  ?? 0),
    impressions: Number(g._sum.impressions      ?? 0),
    creators:    g._count.creatorUsername,
  }))

  return NextResponse.json({ data })
}
