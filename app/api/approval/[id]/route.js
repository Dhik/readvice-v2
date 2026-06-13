import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const a = await prisma.approval.findFirst({
    where: { id: parseInt(id), tenantId: session.user.tenantId },
  })
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(a)
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body   = await request.json()
  const approvalId = parseInt(id)

  const owned = await prisma.approval.findFirst({
    where: { id: approvalId, tenantId: session.user.tenantId },
  })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.approval.update({
    where: { id: approvalId },
    data: {
      name:  body.name  ?? undefined,
      photo: body.photo !== undefined ? (body.photo ?? null) : undefined,
    },
  })

  return NextResponse.json({ updated: true })
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { count } = await prisma.approval.deleteMany({
    where: { id: parseInt(id), tenantId: session.user.tenantId },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
