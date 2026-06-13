import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getRcAffiliateStatus, getTimelineStatus, calcRcScore } from '@/lib/affiliate-utils'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''
  const tenantId = session.user.tenantId

  const talents = await prisma.talent.findMany({
    where: { tenantId, type: 'affiliate' },
    select: { id: true, username: true, dealingDate: true, followers: true },
  })

  const dateFilter = dateFrom && dateTo
    ? { date: { gte: new Date(dateFrom), lte: new Date(dateTo) } } : {}

  const results = []
  let maxRevenue = 0

  for (const t of talents) {
    const agg = await prisma.affiliateShopee.aggregate({
      where: { tenantId, username: t.username, ...dateFilter },
      _sum:   { omzetPenjualan: true, pesanan: true },
      _avg:   { roi: true },
      _min:   { date: true },
      _max:   { date: true },
      _count: { date: true },
    })
    const gmv = Number(agg._sum.omzetPenjualan ?? 0)
    if (gmv > maxRevenue) maxRevenue = gmv
    results.push({
      talent_id:    t.id,
      username:     t.username,
      dealing_date: t.dealingDate,
      followers:    t.followers ?? 0,
      total_gmv:    gmv,
      total_orders: agg._sum.pesanan ?? 0,
      avg_roi:      Number(agg._avg.roi ?? 0),
      active_days:  agg._count.date,
      first_date:   agg._min.date,
      last_date:    agg._max.date,
    })
  }

  const data = results.map(r => ({
    ...r,
    affiliate_status:  getRcAffiliateStatus(r.first_date, r.dealing_date),
    timeline_status:   getTimelineStatus(r.last_date, r.dealing_date),
    performance_score: calcRcScore(r.avg_roi, r.active_days, r.total_gmv, maxRevenue),
  })).sort((a, b) => b.total_gmv - a.total_gmv)

  return NextResponse.json({ data, total: data.length })
}
