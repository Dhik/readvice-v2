import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id   = parseInt(params.id)
  const body = await request.json()

  const updated = await prisma.dealingAffiliate.updateMany({
    where: { id, tenantId: session.user.tenantId },
    data: {
      approvalFromManagementStatus: body.status,
      approvalFromManagementBy:     session.user.name ?? session.user.email,
      approvalFromManagementDate:   new Date(),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  })

  return NextResponse.json({ updated: updated.count })
}
