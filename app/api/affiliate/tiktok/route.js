import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page     = parseInt(searchParams.get('page')  ?? '1')
  const limit    = parseInt(searchParams.get('limit') ?? '25')
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''
  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    ...(dateFrom && dateTo ? { date: { gte: new Date(dateFrom), lte: new Date(dateTo) } } : {}),
  }

  const [allDates, totalDatesResult] = await prisma.$transaction([
    prisma.affiliateTiktok.groupBy({
      by: ['date'], where, orderBy: { date: 'desc' },
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.affiliateTiktok.groupBy({ by: ['date'], where }),
  ])

  const total = totalDatesResult.length

  const rows = await Promise.all(allDates.map(async ({ date }) => {
    const agg = await prisma.affiliateTiktok.aggregate({
      where: { tenantId, date },
      _count: { creatorUsername: true },
      _sum: {
        affiliateGmv: true, affiliateOrders: true, affiliateRefundedGmv: true,
        affiliateRefundedOrders: true, productImpression: true, estCommission: true,
        productsSold: true, estimatedOrders: true, impressions: true,
        videoViews: true, affiliateFollowers: true, affiliateVideos: true,
      },
      _avg: { avgOrderValue: true },
    })
    const gmv       = Number(agg._sum.affiliateGmv      ?? 0)
    const comm      = Number(agg._sum.estCommission     ?? 0)
    const refundGmv = Number(agg._sum.affiliateRefundedGmv ?? 0)
    const impr      = Number(agg._sum.impressions       ?? 0)
    const estOrders = Number(agg._sum.estimatedOrders   ?? 0)
    return {
      date,
      creator_count:             agg._count.creatorUsername,
      affiliate_gmv:             gmv,
      affiliate_orders:          Number(agg._sum.affiliateOrders ?? 0),
      affiliate_refunded_gmv:    refundGmv,
      affiliate_refunded_orders: Number(agg._sum.affiliateRefundedOrders ?? 0),
      product_impression:        Number(agg._sum.productImpression ?? 0),
      est_commission:            comm,
      avg_order_value:           Number(agg._avg.avgOrderValue ?? 0),
      products_sold:             agg._sum.productsSold ?? 0,
      estimated_orders:          estOrders,
      impressions:               impr,
      video_views:               Number(agg._sum.videoViews ?? 0),
      affiliate_followers:       agg._sum.affiliateFollowers ?? 0,
      affiliate_videos:          agg._sum.affiliateVideos    ?? 0,
      conversion_rate:           impr > 0 ? estOrders / impr * 100 : 0,
      commission_rate:           gmv  > 0 ? comm      / gmv  * 100 : 0,
      refund_rate:               gmv  > 0 ? refundGmv / gmv  * 100 : 0,
    }
  }))

  return NextResponse.json({ data: rows, total, page, limit })
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''
  const tenantId = session.user.tenantId

  if (!dateFrom || !dateTo) return NextResponse.json({ error: 'dateFrom and dateTo required' }, { status: 400 })

  const result = await prisma.affiliateTiktok.deleteMany({
    where: { tenantId, date: { gte: new Date(dateFrom), lte: new Date(dateTo) } },
  })
  return NextResponse.json({ deleted: result.count })
}
