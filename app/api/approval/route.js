import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const approvals = await prisma.approval.findMany({
    where:   { tenantId: session.user.tenantId },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(approvals.map(a => ({
    id:    a.id,
    name:  a.name,
    photo: a.photo ?? null,
  })))
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body     = await request.json()
  const approval = await prisma.approval.create({
    data: {
      tenantId: session.user.tenantId,
      name:     body.name,
      photo:    body.photo ?? null,
    },
  })

  return NextResponse.json({ id: approval.id, name: approval.name }, { status: 201 })
}
