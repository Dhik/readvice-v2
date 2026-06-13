import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getMonthRange } from '@/lib/utils'

// GET /api/sales/platform-split — GMV/nett/orders grouped by platform.
// Same filter semantics as /api/sales (platform, month, startDate+endDate).
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const platform  = searchParams.get('platform') ?? ''
  const month     = searchParams.get('month') ?? ''
  const startDate = searchParams.get('startDate') ?? ''
  const endDate   = searchParams.get('endDate') ?? ''
  const tenantId  = session.user.tenantId

  const where = {
    tenantId,
    ...(platform ? { platform } : {}),
    ...(month ? { orderDate: getMonthRange(month) } : {}),
    ...(startDate && endDate ? {
      orderDate: { gte: new Date(startDate), lte: new Date(endDate) },
    } : {}),
  }

  const grouped = await prisma.order.groupBy({
    by:     ['platform'],
    where,
    _sum:   { gmv: true, nett: true },
    _count: { id: true },
  })

  const data = grouped
    .map(g => ({
      platform: g.platform,
      gmv:      Number(g._sum.gmv  ?? 0),
      nett:     Number(g._sum.nett ?? 0),
      orders:   g._count.id,
    }))
    .sort((a, b) => b.gmv - a.gmv)

  return NextResponse.json(data)
}
