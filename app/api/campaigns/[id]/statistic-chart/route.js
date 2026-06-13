import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { parse, startOfDay, endOfDay, format } from 'date-fns'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const filterDates = searchParams.get('filterDates') ?? ''
  const filterPic   = searchParams.get('filterPic')   ?? ''

  let startDate, endDate
  if (filterDates) {
    const parts = filterDates.split(' - ')
    if (parts.length === 2) {
      try {
        startDate = startOfDay(parse(parts[0].trim(), 'dd/MM/yyyy', new Date()))
        endDate   = endOfDay(parse(parts[1].trim(), 'dd/MM/yyyy', new Date()))
      } catch {}
    }
  }

  const contents = await prisma.campaignContent.findMany({
    where: { campaignId: parseInt(id), ...(filterPic ? { pic: filterPic } : {}) },
    select: { id: true },
  })
  const contentIds = contents.map(c => c.id)
  if (!contentIds.length) return NextResponse.json([])

  const stats = await prisma.contentStatistic.findMany({
    where: {
      contentId: { in: contentIds },
      ...(startDate ? { date: { gte: startDate, lte: endDate } } : {}),
    },
    orderBy: { date: 'asc' },
  })

  const byDate = {}
  for (const s of stats) {
    const key = format(s.date, 'yyyy-MM-dd')
    if (!byDate[key]) byDate[key] = { date: key, total_view: 0, total_like: 0, total_comment: 0, total_spend: 0, total_gmv: 0 }
    byDate[key].total_view    += Number(s.view ?? 0)
    byDate[key].total_like    += Number(s.like ?? 0)
    byDate[key].total_comment += Number(s.comment ?? 0)
    byDate[key].total_spend   += Number(s.spend ?? 0)
    byDate[key].total_gmv     += Number(s.gmv ?? 0)
  }

  return NextResponse.json(Object.values(byDate))
}
