import { NextResponse } from 'next/server'
import { runExpiryChecks } from '@/lib/billing'

export const runtime = 'nodejs'

// GET /api/cron/expire-subscriptions — invoked hourly by Vercel Cron.
// Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to scheduled requests
// (CRON_SECRET must be set in the Vercel dashboard + .env.local for dev).
export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const transitions = await runExpiryChecks()
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), transitions })
}
