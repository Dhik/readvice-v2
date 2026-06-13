import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body   = await request.json()
  const paymentId = parseInt(id)

  const owned = await prisma.talentPayment.findFirst({
    where: { id: paymentId, talent: { tenantId: session.user.tenantId } },
  })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.talentPayment.update({
    where: { id: paymentId },
    data: {
      statusPayment: body.status_payment ?? undefined,
      donePayment:   body.done_payment ? new Date(body.done_payment) : undefined,
      amountTf:      body.amount_tf !== undefined ? (body.amount_tf ? parseFloat(body.amount_tf) : null) : undefined,
    },
  })

  return NextResponse.json({ updated: true })
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { count } = await prisma.talentPayment.deleteMany({
    where: { id: parseInt(id), talent: { tenantId: session.user.tenantId } },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
