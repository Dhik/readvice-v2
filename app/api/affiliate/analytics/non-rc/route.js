import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getActivityLevelBadge, calcNonRcScore } from '@/lib/affiliate-utils'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''
  const tenantId = session.user.tenantId

  const listings = await prisma.listingAffiliate.findMany({
    where: { tenantId, talentCreatedStatus: false },
    select: { id: true, username: true, followers: true },
  })

  const dateFilter = dateFrom && dateTo
    ? { date: { gte: new Date(dateFrom), lte: new Date(dateTo) } } : {}

  const results = []
  let maxRevenue = 0, maxFollowers = 0

  for (const l of listings) {
    const agg = await prisma.affiliateShopee.aggregate({
      where: { tenantId, username: l.username, ...dateFilter },
      _sum:   { omzetPenjualan: true, pesanan: true },
      _avg:   { roi: true },
      _count: { date: true },
    })
    const gmv = Number(agg._sum.omzetPenjualan ?? 0)
    const fol = l.followers ?? 0
    if (gmv > maxRevenue)   maxRevenue   = gmv
    if (fol > maxFollowers) maxFollowers = fol
    results.push({
      listing_id:   l.id,
      username:     l.username,
      followers:    fol,
      total_gmv:    gmv,
      total_orders: agg._sum.pesanan ?? 0,
      avg_roi:      Number(agg._avg.roi ?? 0),
      active_days:  agg._count.date,
    })
  }

  const data = results.map(r => ({
    ...r,
    activity_level:    getActivityLevelBadge(r.active_days),
    performance_score: calcNonRcScore(r.active_days, r.total_gmv, r.followers, maxRevenue, maxFollowers),
  })).sort((a, b) => b.total_gmv - a.total_gmv)

  return NextResponse.json({ data, total: data.length })
}
