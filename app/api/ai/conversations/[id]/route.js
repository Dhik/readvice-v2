import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Fetch a conversation + its messages — scoped by tenantId AND userId.
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const convo = await prisma.aiConversation.findFirst({
    where:   { id: parseInt(id), tenantId: session.user.tenantId, userId: session.user.id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select:  { id: true, role: true, content: true, inputTokens: true, outputTokens: true, chart: true, createdAt: true },
      },
    },
  })
  if (!convo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id:       convo.id,
    title:    convo.title,
    messages: convo.messages,
  })
}

// Delete a conversation (cascade removes its messages) — scoped by tenantId AND userId.
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { count } = await prisma.aiConversation.deleteMany({
    where: { id: parseInt(id), tenantId: session.user.tenantId, userId: session.user.id },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
