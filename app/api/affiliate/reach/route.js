import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page     = parseInt(searchParams.get('page')    ?? '1')
  const limit    = parseInt(searchParams.get('limit')   ?? '25')
  const pic      = searchParams.get('pic')     ?? ''
  const status   = searchParams.get('status')  ?? ''
  const username = searchParams.get('username') ?? ''
  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    ...(pic    ? { pic }    : {}),
    ...(status ? { status } : {}),
    ...(username ? {
      listingAffiliate: { username: { contains: username, mode: 'insensitive' } },
    } : {}),
  }

  const [total, rows] = await prisma.$transaction([
    prisma.reachAffiliate.count({ where }),
    prisma.reachAffiliate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        listingAffiliate: { select: { username: true, salesChannelId: true } },
      },
    }),
  ])

  return NextResponse.json({ data: rows, total, page, limit })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const body     = await request.json()

  const reach = await prisma.reachAffiliate.create({
    data: {
      tenantId,
      listingAffiliateId: parseInt(body.listingAffiliateId),
      pic:       body.pic       ?? null,
      reachDate: body.reachDate ? new Date(body.reachDate) : null,
      status:    body.status    ?? 'Pending',
      notes:     body.notes     ?? null,
    },
  })

  return NextResponse.json(reach, { status: 201 })
}
