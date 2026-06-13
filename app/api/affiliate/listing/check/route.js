import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username') ?? ''
  const tenantId = session.user.tenantId

  if (!username) return NextResponse.json({ found: false })

  const agg = await prisma.affiliateShopee.aggregate({
    where: { tenantId, username },
    _sum:   { omzetPenjualan: true, pesanan: true },
    _avg:   { roi: true },
    _min:   { date: true },
    _max:   { date: true },
    _count: { date: true },
  })

  if (agg._count.date === 0) return NextResponse.json({ username, found: false })

  return NextResponse.json({
    username,
    found:        true,
    avg_roi:      Number(agg._avg.roi ?? 0),
    total_orders: agg._sum.pesanan ?? 0,
    total_gmv:    Number(agg._sum.omzetPenjualan ?? 0),
    active_days:  agg._count.date,
    first_date:   agg._min.date,
    last_date:    agg._max.date,
  })
}
