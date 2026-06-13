import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TYPE_COLORS = {
  KOL:              '#2C3639',
  Affiliate:        '#E07B39',
  'Content Creator':'#3F4E4F',
  Clipper:          '#3F4E4F',
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start')
  const endDate   = searchParams.get('end')
  const tenantId  = session.user.tenantId

  const contents = await prisma.talentContent.findMany({
    where: {
      talent: { tenantId },
      postingDate: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate   ? { lte: new Date(endDate)   } : {}),
        not: null,
      },
    },
    include: { talent: { select: { username: true, type: true } } },
  })

  const events = contents
    .filter(c => c.postingDate)
    .map(c => ({
      id:    c.id,
      title: c.talent.username,
      start: c.postingDate.toISOString().slice(0, 10),
      type:  c.talent.type,
      color: TYPE_COLORS[c.talent.type] ?? '#888',
    }))

  return NextResponse.json(events)
}
