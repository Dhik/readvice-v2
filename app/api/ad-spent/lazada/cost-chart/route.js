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

  const rows = await prisma.adSpentLazada.findMany({
    where,
    select: { date: true, spent: true, revenue: true, clicks: true },
    orderBy: { date: 'asc' },
  })

  const byDate = {}
  for (const r of rows) {
    const key = r.date.toISOString().substring(0, 10)
    if (!byDate[key]) byDate[key] = { spent: 0, revenue: 0, clicks: 0 }
    byDate[key].spent   += Number(r.spent   ?? 0)
    byDate[key].revenue += Number(r.revenue ?? 0)
    byDate[key].clicks  += Number(r.clicks  ?? 0)
  }

  const series = Object.entries(byDate).map(([date, d]) => ({
    date,
    spent: d.spent,
    roas:  d.spent  > 0 ? d.revenue / d.spent  : null,
    cpc:   d.clicks > 0 ? d.spent   / d.clicks : null,
  }))

  return NextResponse.json(series)
}
