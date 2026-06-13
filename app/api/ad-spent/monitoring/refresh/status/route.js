import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CHANNELS } from '@/lib/ads-monitoring-refresh'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId

  const statuses = await Promise.all(
    CHANNELS.map(ch =>
      prisma.adsMonitoring.findFirst({
        where:   { tenantId, channel: ch },
        orderBy: { updatedAt: 'desc' },
        select:  { channel: true, updatedAt: true },
      })
    )
  )

  const status = Object.fromEntries(CHANNELS.map((ch, i) => [ch, statuses[i]?.updatedAt ?? null]))
  return NextResponse.json({ status })
}
