import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getMonthRange } from '@/lib/utils'

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

  const agg = await prisma.order.aggregate({
    where,
    _sum:   { gmv: true, nett: true, qty: true },
    _count: { id: true },
  })

  return NextResponse.json({
    total_gmv:    Number(agg._sum.gmv  ?? 0),
    total_nett:   Number(agg._sum.nett ?? 0),
    total_qty:    Number(agg._sum.qty  ?? 0),
    total_orders: agg._count.id,
  })
}
