import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { parse, startOfDay, endOfDay } from 'date-fns'

function fmtRp(n)  { return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0)) }
function fmtNum(n) { return new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0)) }

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const filterDates = searchParams.get('filterDates') ?? ''
  const filterPic   = searchParams.get('filterPic')   ?? ''

  const campaign = await prisma.campaign.findFirst({ where: { id: parseInt(id), tenantId: session.user.tenantId } })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

  const contentWhere = {
    campaignId: parseInt(id),
    ...(filterPic ? { pic: filterPic } : {}),
  }

  const contents = await prisma.campaignContent.findMany({ where: contentWhere })

  let totalViews = 0, totalLikes = 0, totalComments = 0, totalGmv = 0
  for (const c of contents) {
    totalViews    += Number(c.view ?? 0)
    totalLikes    += Number(c.like ?? 0)
    totalComments += Number(c.comment ?? 0)
    totalGmv      += Number(c.gmv ?? 0)
  }

  const totalExpense = Number(campaign.totalExpense ?? 0)
  const cpm          = totalViews > 0 ? totalExpense / (totalViews / 1000) : 0
  const achievement  = totalExpense > 0 ? (totalGmv / totalExpense).toFixed(2) : '0.00'
  const engRate      = totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100).toFixed(2) : '0.00'
  const totalInfluencer = new Set(contents.map(c => c.username)).size

  const byUser = {}
  for (const c of contents) {
    if (!byUser[c.username]) byUser[c.username] = { id: c.id, username: c.username, view: 0, like: 0, comment: 0, engagement: 0 }
    byUser[c.username].view       += Number(c.view ?? 0)
    byUser[c.username].like       += Number(c.like ?? 0)
    byUser[c.username].comment    += Number(c.comment ?? 0)
    byUser[c.username].engagement += Number(c.like ?? 0) + Number(c.comment ?? 0)
  }
  const users = Object.values(byUser)
  const top5 = (arr, key) => [...arr].sort((a, b) => b[key] - a[key]).slice(0, 5).map(u => ({
    id: u.id, key_opinion_leader_name: u.username, [key]: fmtNum(u[key]),
  }))

  const byProduct = {}
  for (const c of contents) {
    const p = c.product ?? 'Unknown'
    if (!byProduct[p]) byProduct[p] = { product: p, total_views: 0, total_spend: 0, total_content: 0 }
    byProduct[p].total_views   += Number(c.view ?? 0)
    byProduct[p].total_spend   += Number(c.rateCard ?? 0)
    byProduct[p].total_content += 1
  }
  const top_product = Object.values(byProduct)
    .sort((a, b) => b.total_views - a.total_views).slice(0, 5)
    .map(p => ({
      product: p.product, total_views: fmtNum(p.total_views), total_spend: fmtNum(p.total_spend),
      total_content: p.total_content, target: '-',
      cpm: p.total_views > 0 ? fmtNum(p.total_spend / (p.total_views / 1000)) : '0',
    }))

  return NextResponse.json({
    total_expense: fmtRp(totalExpense), cpm: fmtRp(cpm),
    total_influencer: String(totalInfluencer), total_gmv: fmtRp(totalGmv),
    achievement: achievement + '×', view: fmtNum(totalViews), like: fmtNum(totalLikes),
    comment: fmtNum(totalComments), engagement_rate: engRate + '%',
    top_likes: top5([...users], 'like'), top_comment: top5([...users], 'comment'),
    top_view: top5([...users], 'view'), top_engagement: top5([...users], 'engagement'),
    top_product,
  })
}
