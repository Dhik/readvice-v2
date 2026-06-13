import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page      = parseInt(searchParams.get('page')  ?? '1')
  const limit     = parseInt(searchParams.get('limit') ?? '25')
  const startDate = searchParams.get('startDate') ?? ''
  const endDate   = searchParams.get('endDate') ?? ''
  const tenantId  = session.user.tenantId

  const where = {
    tenantId,
    ...(startDate && endDate ? {
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    } : {}),
  }

  const [total, rows, agg] = await prisma.$transaction([
    prisma.adSpentMeta.count({ where }),
    prisma.adSpentMeta.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.adSpentMeta.aggregate({
      where,
      _sum: { spent: true, clicks: true, conversions: true, revenue: true, impressions: true },
    }),
  ])

  // BigInt (impressions) and Decimal fields must be converted to Number before JSON serialisation
  const data = rows.map(r => ({
    ...r,
    impressions: r.impressions != null ? Number(r.impressions) : null,
    spent:       r.spent       != null ? Number(r.spent)       : null,
    revenue:     r.revenue     != null ? Number(r.revenue)     : null,
    roas:        r.roas        != null ? Number(r.roas)        : null,
    cpc:         r.cpc         != null ? Number(r.cpc)         : null,
    ctr:         r.ctr         != null ? Number(r.ctr)         : null,
  }))

  return NextResponse.json({
    data, total, page, limit,
    summary: {
      spent:       Number(agg._sum.spent       ?? 0),
      clicks:      Number(agg._sum.clicks      ?? 0),
      conversions: Number(agg._sum.conversions ?? 0),
      revenue:     Number(agg._sum.revenue     ?? 0),
      impressions: Number(agg._sum.impressions ?? 0),
    },
  })
}
