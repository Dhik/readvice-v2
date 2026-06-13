import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') ?? ''
  const endDate   = searchParams.get('endDate')   ?? ''
  const tenantId  = session.user.tenantId

  const where = {
    tenantId,
    ...(startDate && endDate ? { date: { gte: new Date(startDate), lte: new Date(endDate) } } : {}),
  }

  // TikTok has: impressions (BigInt), clicks, conversions, ctr, revenue, roas, cpc
  const agg = await prisma.adSpentTiktok.aggregate({
    where,
    _sum: { spent: true, revenue: true, impressions: true, clicks: true, conversions: true },
  })

  const totalSpent       = Number(agg._sum.spent       ?? 0)
  const totalRevenue     = Number(agg._sum.revenue     ?? 0)
  const totalImpressions = Number(agg._sum.impressions ?? 0)  // BigInt → Number
  const totalClicks      = Number(agg._sum.clicks      ?? 0)
  const totalConversions = Number(agg._sum.conversions ?? 0)

  return NextResponse.json({
    totalSpent,
    totalRevenue,
    totalImpressions,
    totalClicks,
    totalConversions,
    avgRoas: totalSpent       > 0 ? totalRevenue / totalSpent       : null,
    avgCpc:  totalClicks      > 0 ? totalSpent   / totalClicks      : null,
    avgCtr:  totalImpressions > 0 ? totalClicks  / totalImpressions : null,
  })
}
