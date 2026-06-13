import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const contents = await prisma.campaignContent.findMany({
    where: { campaignId: parseInt(id), tenantId: session.user.tenantId },
    select: { id: true, username: true, taskName: true, channel: true, product: true },
  })
  return NextResponse.json(contents.map(c => ({
    id: c.id, username: c.username, task_name: c.taskName, channel: c.channel, product: c.product,
  })))
}
