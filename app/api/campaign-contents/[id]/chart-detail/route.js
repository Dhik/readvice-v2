import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { format } from 'date-fns'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const content = await prisma.campaignContent.findFirst({
    where: { id: parseInt(id), tenantId: session.user.tenantId },
    include: { statistics: { orderBy: { date: 'asc' } } },
  })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const view = Number(content.view ?? 0), like = Number(content.like ?? 0), comment = Number(content.comment ?? 0)
  const gmv  = Number(content.gmv ?? 0),  rc   = Number(content.rateCard ?? 0)
  const er   = view > 0 ? ((like + comment) / view * 100).toFixed(2) + '%' : '0.00%'
  const roi  = rc > 0 ? (gmv / rc).toFixed(2) : '0.00'

  return NextResponse.json({
    engagement: content.statistics.map(s => ({ date: format(s.date, 'yyyy-MM-dd'), view: Number(s.view ?? 0), like: Number(s.like ?? 0), comment: Number(s.comment ?? 0) })),
    gmv: content.statistics.map(s => ({ date: format(s.date, 'yyyy-MM-dd'), gmv: Number(s.gmv ?? 0) })),
    meta: {
      views: view, likes: like, comments: comment, engagement_rate: er, gmv, roi, rate_card: rc,
      kode_ads: content.kodeAds ?? '-',
      upload_date: content.uploadDate ? new Date(content.uploadDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '-',
      link: content.link ?? '',
    },
  })
}
