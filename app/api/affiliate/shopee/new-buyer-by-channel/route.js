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
    by: ['channel'],
    where,
    _sum: { totalPembeli: true, pembeliBaru: true },
    orderBy: { channel: 'asc' },
  })

  const data = grouped
    .map(g => ({
      channel:        g.channel ?? 'Unknown',
      total_pembeli:  g._sum.totalPembeli ?? 0,
      pembeli_baru:   g._sum.pembeliBaru  ?? 0,
      new_buyer_rate: (g._sum.totalPembeli ?? 0) > 0
        ? ((g._sum.pembeliBaru ?? 0) / g._sum.totalPembeli * 100)
        : 0,
    }))
    .sort((a, b) => b.new_buyer_rate - a.new_buyer_rate)

  return NextResponse.json({ data })
}
