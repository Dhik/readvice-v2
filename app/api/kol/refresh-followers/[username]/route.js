import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username } = await params

  // In production this would call TikTok/Instagram API
  // For now, return a stub response and update this tenant's matching contents
  const followers = Math.floor(Math.random() * 500000) + 10000

  await prisma.campaignContent.updateMany({
    where: { username, tenantId: session.user.tenantId },
    data: { kolFollowers: BigInt(followers) },
  })

  return NextResponse.json({ success: true, followers, username })
}
