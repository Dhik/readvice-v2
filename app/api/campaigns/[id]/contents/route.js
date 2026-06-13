import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

function fmtNum(n) { return new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0)) }

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const filterInfluencer = searchParams.get('filterInfluencer') ?? ''
  const filterProduct    = searchParams.get('filterProduct')    ?? ''
  const filterPlatform   = searchParams.get('filterPlatform')   ?? ''
  const filterFyp        = searchParams.get('filterFyp')        === 'true'
  const filterPic        = searchParams.get('filterPic')        ?? ''
  const filterPayment    = searchParams.get('filterPayment')    === 'true'
  const filterDelivery   = searchParams.get('filterDelivery')   === 'true'

  // Verify the campaign belongs to this tenant before listing its contents.
  const campaign = await prisma.campaign.findFirst({ where: { id: parseInt(id), tenantId: session.user.tenantId } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const where = {
    campaignId: parseInt(id),
    tenantId: session.user.tenantId,
    ...(filterInfluencer ? { username: { contains: filterInfluencer, mode: 'insensitive' } } : {}),
    ...(filterProduct    ? { product:  { contains: filterProduct,    mode: 'insensitive' } } : {}),
    ...(filterPlatform   ? { channel:  filterPlatform } : {}),
    ...(filterFyp        ? { isFyp:    true } : {}),
    ...(filterPic        ? { pic:      filterPic } : {}),
    ...(filterPayment    ? { isPaid:   true } : {}),
    ...(filterDelivery   ? { isDelivered: true } : {}),
  }

  const contents = await prisma.campaignContent.findMany({ where, orderBy: { createdAt: 'desc' } })

  const data = contents.map(c => {
    const view = Number(c.view ?? 0), like = Number(c.like ?? 0), comment = Number(c.comment ?? 0)
    const er   = view > 0 ? ((like + comment) / view * 100).toFixed(2) + '%' : '0.00%'
    return {
      id: c.id, username: c.username, channel: c.channel ?? '',
      creator_name: c.creatorName ?? '', pic: c.pic ?? '', task: c.taskName ?? '',
      product: c.product ?? '', kode_ads: c.kodeAds ?? '',
      upload_date: c.uploadDate ? new Date(c.uploadDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : null,
      rate_card: Number(c.rateCard ?? 0), rate_card_formatted: fmtNum(Number(c.rateCard ?? 0)),
      like, comment, view, cpm: fmtNum(Number(c.cpm ?? 0)), engagement_rate: er,
      gmv: fmtNum(Number(c.gmv ?? 0)), kol_followers: Number(c.kolFollowers ?? 0),
      tiering: c.tiering ?? '', boost_code: c.boostCode ?? '', link: c.link ?? '',
      is_fyp: c.isFyp, is_paid: c.isPaid, is_delivered: c.isDelivered,
    }
  })

  return NextResponse.json(data)
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json()

  const campaign = await prisma.campaign.findFirst({ where: { id: parseInt(id), tenantId: session.user.tenantId } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const content = await prisma.campaignContent.create({
    data: {
      campaignId: parseInt(id), tenantId: session.user.tenantId,
      username:    body.username,
      creatorName: body.creator_name ?? null,
      pic:         body.pic         ?? null,
      taskName:    body.task_name   ?? null,
      rateCard:    body.rate_card   ? parseFloat(body.rate_card) : null,
      channel:     body.channel     ?? null,
      link:        body.link        ?? null,
      product:     body.product     ?? null,
      boostCode:   body.boost_code  ?? null,
      kodeAds:     body.kode_ads    ?? null,
    },
  })
  // BigInt fields (view/like/comment/kolFollowers) can't be JSON-serialized —
  // convert to Number before returning the created row.
  const serialized = {
    ...content,
    view:         Number(content.view ?? 0),
    like:         Number(content.like ?? 0),
    comment:      Number(content.comment ?? 0),
    kolFollowers: Number(content.kolFollowers ?? 0),
  }
  return NextResponse.json({ message: 'Created', content: serialized }, { status: 201 })
}
