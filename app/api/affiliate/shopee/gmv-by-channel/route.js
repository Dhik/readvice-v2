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
    _sum: { omzetPenjualan: true },
    orderBy: { _sum: { omzetPenjualan: 'desc' } },
  })

  const data = grouped.map(g => ({
    channel: g.channel ?? 'Unknown',
    gmv:     Number(g._sum.omzetPenjualan ?? 0),
  }))

  return NextResponse.json({ data })
}
