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
    ...(startDate && endDate ? {
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    } : {}),
  }

  const [metaAgg, shopeeAgg, tiktokAgg, lazadaAgg] = await prisma.$transaction([
    prisma.adSpentMeta.aggregate({   where, _sum: { spent: true, revenue: true } }),
    prisma.adSpentShopee.aggregate({ where, _sum: { spent: true, revenue: true } }),
    prisma.adSpentTiktok.aggregate({ where, _sum: { spent: true, revenue: true } }),
    prisma.adSpentLazada.aggregate({ where, _sum: { spent: true, revenue: true } }),
  ])

  const byPlatform = [
    { platform: 'meta',   spent: Number(metaAgg._sum.spent   ?? 0), revenue: Number(metaAgg._sum.revenue   ?? 0) },
    { platform: 'shopee', spent: Number(shopeeAgg._sum.spent ?? 0), revenue: Number(shopeeAgg._sum.revenue ?? 0) },
    { platform: 'tiktok', spent: Number(tiktokAgg._sum.spent ?? 0), revenue: Number(tiktokAgg._sum.revenue ?? 0) },
    { platform: 'lazada', spent: Number(lazadaAgg._sum.spent ?? 0), revenue: Number(lazadaAgg._sum.revenue ?? 0) },
  ]

  return NextResponse.json({
    byPlatform,
    totalSpent:   byPlatform.reduce((s, p) => s + p.spent,   0),
    totalRevenue: byPlatform.reduce((s, p) => s + p.revenue, 0),
  })
}
