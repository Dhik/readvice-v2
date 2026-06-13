import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page           = parseInt(searchParams.get('page')    ?? '1')
  const limit          = parseInt(searchParams.get('limit')   ?? '25')
  const pic            = searchParams.get('pic')            ?? ''
  const username       = searchParams.get('username')       ?? ''
  const approval       = searchParams.get('approval')       ?? ''
  const salesChannelId = searchParams.get('salesChannelId') ?? ''
  const listingStatus  = searchParams.get('listingStatus')  ?? ''
  const dateFrom       = searchParams.get('dateFrom')       ?? ''
  const dateTo         = searchParams.get('dateTo')         ?? ''
  const tenantId       = session.user.tenantId

  const where = {
    tenantId,
    ...(pic           ? { pic }                                                         : {}),
    ...(username      ? { username: { contains: username, mode: 'insensitive' } }       : {}),
    ...(approval      ? { approval }                                                     : {}),
    ...(salesChannelId? { salesChannelId: parseInt(salesChannelId) }                    : {}),
    ...(listingStatus ? { listingStatus }                                                : {}),
    ...(dateFrom && dateTo ? { date: { gte: new Date(dateFrom), lte: new Date(dateTo) } } : {}),
  }

  const [total, rows] = await prisma.$transaction([
    prisma.listingAffiliate.count({ where }),
    prisma.listingAffiliate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        dealingAffiliate: {
          select: { id: true, approvalFromLeaderStatus: true, approvalFromManagementStatus: true },
        },
      },
    }),
  ])

  const data = rows.map(r => ({
    ...r,
    gmv:      Number(r.gmv      ?? 0),
    roas:     Number(r.roas     ?? 0),
    gpm:      Number(r.gpm      ?? 0),
    rateCard: Number(r.rateCard ?? 0),
  }))

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const body     = await request.json()

  const listing = await prisma.listingAffiliate.create({
    data: {
      tenantId,
      date:          new Date(body.date),
      pic:           body.pic         ?? null,
      username:      body.username,
      followers:     body.followers   ?? 0,
      gmv:           body.gmv         ?? null,
      kontak:        body.kontak      ?? null,
      sowCategory:   body.sowCategory ?? null,
      salesChannelId: body.salesChannelId ? parseInt(body.salesChannelId) : null,
      roas:          body.roas        ?? 0,
      gpm:           body.gpm         ?? 0,
      rateCard:      body.rateCard    ?? 0,
      slot:          body.slot        ?? 0,
      remark:        body.remark      ?? '-',
      keterangan:    body.keterangan  ?? '-',
      approval:      'Pending',
      listingStatus: 'Pending',
    },
  })

  return NextResponse.json(listing, { status: 201 })
}
