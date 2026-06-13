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
  const username = searchParams.get('username') ?? ''
  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    ...(username ? { username: { contains: username, mode: 'insensitive' } } : {}),
  }

  const [total, rows] = await prisma.$transaction([
    prisma.affiliateGmvTiktok.count({ where }),
    prisma.affiliateGmvTiktok.findMany({
      where, orderBy: { postingDate: 'desc' },
      skip: (page - 1) * limit, take: limit,
    }),
  ])

  const data = rows.map(r => ({ ...r, gmv: Number(r.gmv ?? 0) }))
  return NextResponse.json({ data, total, page, limit })
}
