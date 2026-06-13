import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id   = parseInt(params.id)
  const body = await request.json()

  const updated = await prisma.reachAffiliate.updateMany({
    where: { id, tenantId: session.user.tenantId },
    data: {
      ...(body.pic       !== undefined ? { pic: body.pic }       : {}),
      ...(body.reachDate !== undefined ? { reachDate: body.reachDate ? new Date(body.reachDate) : null } : {}),
      ...(body.status    !== undefined ? { status: body.status } : {}),
      ...(body.notes     !== undefined ? { notes: body.notes }   : {}),
    },
  })

  return NextResponse.json({ updated: updated.count })
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.reachAffiliate.deleteMany({
    where: { id: parseInt(params.id), tenantId: session.user.tenantId },
  })
  return NextResponse.json({ ok: true })
}
