import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getMonthRange } from '@/lib/utils'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page      = parseInt(searchParams.get('page')  ?? '1')
  const limit     = parseInt(searchParams.get('limit') ?? '25')
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

  const [total, rows] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ data: rows, total, page, limit })
}
