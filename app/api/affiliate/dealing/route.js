import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getDealingOverallStatus } from '@/lib/affiliate-utils'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page     = parseInt(searchParams.get('page')   ?? '1')
  const limit    = parseInt(searchParams.get('limit')  ?? '25')
  const pic      = searchParams.get('pic')      ?? ''
  const platform = searchParams.get('platform') ?? ''
  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    ...(pic      ? { pic }      : {}),
    ...(platform ? { platform } : {}),
  }

  const [total, rows] = await prisma.$transaction([
    prisma.dealingAffiliate.count({ where }),
    prisma.dealingAffiliate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { listingAffiliate: { select: { username: true, salesChannelId: true } } },
    }),
  ])

  const data = rows.map(r => ({
    ...r,
    rateCard:       Number(r.rateCard ?? 0),
    overall_status: getDealingOverallStatus(r),
  }))

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const body     = await request.json()

  const dealing = await prisma.dealingAffiliate.create({
    data: {
      tenantId,
      listingAffiliateId: parseInt(body.listingAffiliateId),
      pic:        body.pic        ?? null,
      dealingDate: body.dealingDate ? new Date(body.dealingDate) : null,
      rateCard:   body.rateCard   ?? null,
      slot:       body.slot       ?? 0,
      platform:   body.platform   ?? null,
      notes:      body.notes      ?? null,
    },
  })

  return NextResponse.json(dealing, { status: 201 })
}
