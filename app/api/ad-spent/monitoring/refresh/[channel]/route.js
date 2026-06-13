import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { refreshChannel } from '@/lib/ads-monitoring-refresh'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel } = params
  const tenantId    = session.user.tenantId

  try {
    const result = await refreshChannel(tenantId, channel)
    return NextResponse.json({ ...result, status: 'ok' })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
