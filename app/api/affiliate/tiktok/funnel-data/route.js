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

  const agg = await prisma.affiliateTiktok.aggregate({
    where,
    _sum: { productImpression: true, estimatedOrders: true, productsSold: true },
  })

  return NextResponse.json({
    product_impressions: Number(agg._sum.productImpression ?? 0),
    estimated_orders:    Number(agg._sum.estimatedOrders   ?? 0),
    products_sold:       agg._sum.productsSold ?? 0,
  })
}
