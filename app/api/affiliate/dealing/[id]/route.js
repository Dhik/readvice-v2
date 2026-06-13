import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getDealingOverallStatus } from '@/lib/affiliate-utils'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id     = parseInt(params.id)
  const record = await prisma.dealingAffiliate.findFirst({
    where:   { id, tenantId: session.user.tenantId },
    include: { listingAffiliate: { select: { username: true, salesChannelId: true, gmv: true } } },
  })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...record,
    rateCard:       Number(record.rateCard ?? 0),
    overall_status: getDealingOverallStatus(record),
  })
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id   = parseInt(params.id)
  const body = await request.json()

  const updated = await prisma.dealingAffiliate.updateMany({
    where: { id, tenantId: session.user.tenantId },
    data: {
      ...(body.pic        !== undefined ? { pic: body.pic }        : {}),
      ...(body.dealingDate!== undefined ? { dealingDate: body.dealingDate ? new Date(body.dealingDate) : null } : {}),
      ...(body.rateCard   !== undefined ? { rateCard: body.rateCard }   : {}),
      ...(body.slot       !== undefined ? { slot: body.slot }           : {}),
      ...(body.platform   !== undefined ? { platform: body.platform }   : {}),
      ...(body.notes      !== undefined ? { notes: body.notes }         : {}),
      ...(body.staffNotes !== undefined ? { staffNotes: body.staffNotes }: {}),
    },
  })

  return NextResponse.json({ updated: updated.count })
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.dealingAffiliate.deleteMany({
    where: { id: parseInt(params.id), tenantId: session.user.tenantId },
  })
  return NextResponse.json({ ok: true })
}
