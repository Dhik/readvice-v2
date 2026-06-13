import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { count } = await prisma.talentContent.updateMany({
    where: { id: parseInt(id), talent: { tenantId: session.user.tenantId } },
    data:  { isRefund: false },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ updated: true })
}
