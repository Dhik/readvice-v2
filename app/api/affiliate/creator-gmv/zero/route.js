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
    OR: [{ gmv: { equals: 0 } }, { gmv: null }],
  }

  const [total, rows] = await prisma.$transaction([
    prisma.campaignContent.count({ where }),
    prisma.campaignContent.findMany({
      where,
      orderBy: { uploadDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, username: true, channel: true, link: true, uploadDate: true, gmv: true, isDelivered: true },
    }),
  ])

  const data = rows.map(r => ({ ...r, gmv: Number(r.gmv ?? 0) }))
  return NextResponse.json({ data, total, page, limit })
}
