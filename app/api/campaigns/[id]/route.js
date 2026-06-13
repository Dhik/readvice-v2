import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const campaign = await prisma.campaign.findFirst({
    where: { id: parseInt(id), tenantId: session.user.tenantId },
    include: { createdBy: { select: { id: true, name: true } } },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...campaign,
    view:         Number(campaign.view ?? 0),
    like:         Number(campaign.like ?? 0),
    comment:      Number(campaign.comment ?? 0),
    budget:       Number(campaign.budget ?? 0),
    totalExpense: Number(campaign.totalExpense ?? 0),
    gmv:          Number(campaign.gmv ?? 0),
    cpm:          Number(campaign.cpm ?? 0),
  })
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json()
  await prisma.campaign.updateMany({
    where: { id: parseInt(id), tenantId: session.user.tenantId },
    data: {
      title:     body.title,
      platform:  body.platform  ?? null,
      purpose:   body.purpose   ?? null,
      budget:    body.budget    ? parseFloat(body.budget) : null,
      status:    body.status    ?? 'active',
      startDate: body.startDate ?? null,
      endDate:   body.endDate   ?? null,
    },
  })
  return NextResponse.json({ message: 'Updated' })
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.campaign.deleteMany({ where: { id: parseInt(id), tenantId: session.user.tenantId } })
  return NextResponse.json({ message: 'Deleted successfully' })
}
