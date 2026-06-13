import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { refreshChannel, CHANNELS } from '@/lib/ads-monitoring-refresh'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const results  = {}

  for (const ch of CHANNELS) {
    try {
      const r = await refreshChannel(tenantId, ch)
      results[ch] = { status: 'ok', datesSync: r.datesSync }
    } catch (e) {
      results[ch] = { status: 'error', error: e.message }
    }
  }

  return NextResponse.json({ results })
}
