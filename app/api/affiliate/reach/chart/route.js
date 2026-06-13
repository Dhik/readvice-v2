import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId

  const grouped = await prisma.reachAffiliate.groupBy({
    by: ['pic'],
    where: { tenantId },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })

  const data = grouped.map(g => ({ pic: g.pic ?? 'Unknown', count: g._count.id }))
  return NextResponse.json({ data })
}
