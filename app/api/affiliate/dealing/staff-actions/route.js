import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page     = parseInt(searchParams.get('page')  ?? '1')
  const limit    = parseInt(searchParams.get('limit') ?? '25')
  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    approvalFromLeaderStatus:     'Approve',
    approvalFromManagementStatus: 'Approve',
  }

  const [total, rows] = await prisma.$transaction([
    prisma.dealingAffiliate.count({ where }),
    prisma.dealingAffiliate.findMany({
      where,
      orderBy: { dealingDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { listingAffiliate: { select: { username: true, salesChannelId: true } } },
    }),
  ])

  const data = rows.map(r => ({ ...r, rateCard: Number(r.rateCard ?? 0) }))
  return NextResponse.json({ data, total, page, limit })
}
