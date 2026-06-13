import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const updated  = await prisma.dealingAffiliate.updateMany({
    where: { tenantId, approvalFromLeaderStatus: 'Pending' },
    data: {
      approvalFromLeaderStatus: 'Approve',
      approvalFromLeaderBy:     session.user.name ?? session.user.email,
      approvalFromLeaderDate:   new Date(),
    },
  })
  return NextResponse.json({ updated: updated.count })
}
