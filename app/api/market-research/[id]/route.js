import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { NextResponse }     from 'next/server'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id }     = await params
  const tenantId   = session.user.tenantId

  const research = await prisma.marketResearch.findFirst({
    where: { id, tenantId },
  })

  if (!research) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(research)
}
