import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // Verify the campaign belongs to this tenant before listing its influencers.
  const campaign = await prisma.campaign.findFirst({ where: { id: parseInt(id), tenantId: session.user.tenantId } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const contents = await prisma.campaignContent.findMany({
    where: { campaignId: parseInt(id), tenantId: session.user.tenantId },
    select: { id: true, username: true, channel: true },
  })
  const seen = new Set()
  const unique = []
  for (const c of contents) {
    if (!seen.has(c.username)) { seen.add(c.username); unique.push({ id: c.id, username: c.username, channel: c.channel }) }
  }
  return NextResponse.json(unique)
}
