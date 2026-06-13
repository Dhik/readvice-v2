import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date     = searchParams.get('date')   ?? ''
  const search   = searchParams.get('search') ?? ''
  const page     = parseInt(searchParams.get('page')  ?? '1')
  const limit    = parseInt(searchParams.get('limit') ?? '25')
  const tenantId = session.user.tenantId

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const where = {
    tenantId, date: new Date(date),
    ...(search ? { creatorUsername: { contains: search, mode: 'insensitive' } } : {}),
  }

  const [total, rows] = await prisma.$transaction([
    prisma.affiliateTiktok.count({ where }),
    prisma.affiliateTiktok.findMany({
      where,
      orderBy: { affiliateGmv: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const data = rows.map(r => {
    const gmv    = Number(r.affiliateGmv ?? 0)
    const comm   = Number(r.estCommission ?? 0)
    const refund = Number(r.affiliateRefundedGmv ?? 0)
    const impr   = Number(r.impressions ?? 0)
    const estOrd = Number(r.estimatedOrders ?? 0)
    return {
      id:                     r.id,
      creator_username:       r.creatorUsername,
      affiliate_gmv:          gmv,
      affiliate_orders:       Number(r.affiliateOrders ?? 0),
      affiliate_refunded_gmv: refund,
      est_commission:         comm,
      avg_order_value:        Number(r.avgOrderValue ?? 0),
      products_sold:          r.productsSold ?? 0,
      estimated_orders:       estOrd,
      impressions:            impr,
      video_views:            Number(r.videoViews ?? 0),
      affiliate_followers:    r.affiliateFollowers ?? 0,
      conversion_rate:        impr > 0 ? estOrd / impr * 100 : 0,
      commission_rate:        gmv  > 0 ? comm   / gmv  * 100 : 0,
      refund_rate:            gmv  > 0 ? refund / gmv  * 100 : 0,
    }
  })

  return NextResponse.json({ data, total, page, limit })
}
