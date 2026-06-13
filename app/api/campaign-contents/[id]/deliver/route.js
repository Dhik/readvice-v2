import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const content = await prisma.campaignContent.findFirst({ where: { id: parseInt(id), tenantId: session.user.tenantId } })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated = await prisma.campaignContent.update({ where: { id: parseInt(id) }, data: { isDelivered: !content.isDelivered } })
  return NextResponse.json({ success: true, is_delivered: updated.isDelivered })
}
