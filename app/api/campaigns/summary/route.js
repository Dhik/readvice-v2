import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

function fmt(n) { return new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0)) }

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type        = searchParams.get('type')        ?? ''
  const search      = searchParams.get('search')      ?? ''
  const filterMonth = searchParams.get('filterMonth') ?? ''
  const tenantId    = session.user.tenantId

  const where = {
    tenantId,
    ...(type   ? { type }                                                  : {}),
    ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
  }
  if (filterMonth) {
    const [year, month] = filterMonth.split('-')
    const monthStr = new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleString('en-US', { month: 'short', year: 'numeric' })
    where.startDate = { contains: monthStr }
  }

  const campaigns = await prisma.campaign.findMany({
    where,
    select: { totalExpense: true, gmv: true, cpm: true, view: true, like: true, comment: true, contents: { select: { id: true } } },
  })

  let total_expense = 0, total_gmv = 0, total_views = 0, total_likes = 0, total_comments = 0, total_content = 0

  for (const c of campaigns) {
    total_expense  += Number(c.totalExpense ?? 0)
    total_gmv      += Number(c.gmv ?? 0)
    total_views    += Number(c.view ?? 0)
    total_likes    += Number(c.like ?? 0)
    total_comments += Number(c.comment ?? 0)
    total_content  += c.contents.length
  }

  const cpm             = total_views > 0 ? total_expense / (total_views / 1000) : 0
  const engagement_rate = total_views > 0 ? ((total_likes + total_comments) / total_views * 100).toFixed(2) + '%' : '0.00%'

  return NextResponse.json({
    total_expense:   fmt(total_expense),
    total_gmv:       fmt(total_gmv),
    cpm:             fmt(cpm),
    views:           fmt(total_views),
    likes:           fmt(total_likes),
    comments:        fmt(total_comments),
    total_content:   fmt(total_content),
    engagement_rate,
  })
}
