import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username') ?? ''
  const tenantId = session.user.tenantId

  const count = await prisma.talent.count({ where: { tenantId, username } })
  return NextResponse.json({ next_dealing_number: count + 1 })
}
