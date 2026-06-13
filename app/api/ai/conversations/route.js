import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// List the caller's conversations — scoped by BOTH tenantId AND userId.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conversations = await prisma.aiConversation.findMany({
    where:   { tenantId: session.user.tenantId, userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select:  { id: true, title: true, updatedAt: true },
  })
  return NextResponse.json({ conversations })
}

// Create an empty conversation for the caller.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const convo = await prisma.aiConversation.create({
    data: { tenantId: session.user.tenantId, userId: session.user.id, title: 'New Chat' },
    select: { id: true },
  })
  return NextResponse.json({ id: convo.id }, { status: 201 })
}
