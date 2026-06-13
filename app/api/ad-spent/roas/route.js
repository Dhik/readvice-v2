import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

function getBracket(spent, gmv, hasRevenue) {
  if (spent === 0)  return null           // no spend in period
  if (!hasRevenue)  return null           // revenue not imported for this platform
  if (gmv === 0)    return 'Cash-Eater'  // spend > 0, revenue explicitly 0
  const roas = gmv / spent
  if (roas >= 3.01) return 'Winning'
  if (roas >= 2.80) return 'Bagus'
  if (roas >= 2.01) return 'Potensi'
  return 'Buruk'
}

function toRow(platform, agg) {
  const spent      = Number(agg._sum.spent ?? 0)
  const hasRevenue = agg._sum.revenue != null   // null = column entirely absent for this filter
  const gmv        = hasRevenue ? Number(agg._sum.revenue) : null
  const roas       = hasRevenue && spent > 0 ? gmv / spent : null
  return { platform, spent, gmv, roas, bracket: getBracket(spent, gmv ?? 0, hasRevenue) }
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') ?? ''
  const endDate   = searchParams.get('endDate')   ?? ''
  const tenantId  = session.user.tenantId

  const dateFilter = startDate && endDate
    ? { date: { gte: new Date(startDate), lte: new Date(endDate) } }
    : {}
  const where = { tenantId, ...dateFilter }

  const [meta, shopee, tiktok, lazada] = await Promise.all([
    prisma.adSpentMeta.aggregate({   where, _sum: { spent: true, revenue: true } }),
    prisma.adSpentShopee.aggregate({ where, _sum: { spent: true, revenue: true } }),
    prisma.adSpentTiktok.aggregate({ where, _sum: { spent: true, revenue: true } }),
    prisma.adSpentLazada.aggregate({ where, _sum: { spent: true, revenue: true } }),
  ])

  const rows = [
    toRow('meta',   meta),
    toRow('shopee', shopee),
    toRow('tiktok', tiktok),
    toRow('lazada', lazada),
  ]

  const totalSpent    = rows.reduce((s, r) => s + r.spent, 0)
  const hasAnyRevenue = rows.some(r => r.gmv != null)
  const totalGmv      = hasAnyRevenue ? rows.reduce((s, r) => s + (r.gmv ?? 0), 0) : null
  const totalRoas     = hasAnyRevenue && totalSpent > 0 ? totalGmv / totalSpent : null
  const totals        = { spent: totalSpent, gmv: totalGmv, roas: totalRoas }

  return NextResponse.json({ rows, totals })
}
