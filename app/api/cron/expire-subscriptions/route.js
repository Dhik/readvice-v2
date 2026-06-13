import { NextResponse } from 'next/server'
import { runExpiryChecks } from '@/lib/billing'

export const runtime = 'nodejs'

// GET /api/cron/expire-subscriptions — subscription expiry sweep.
//
// ⚠ The scheduled Vercel Cron trigger is currently DISABLED (vercel.json has no
// "crons" block) for the Hobby-plan test deploy — Hobby only permits a daily cron
// and we removed it to avoid the hourly-cron deploy error. This route and
// runExpiryChecks() are intact; manual runs still work via /api/cron/test-trigger.
//
// BEFORE real paying tenants exist (whose subscriptions can expire), RE-ENABLE
// this as a DAILY cron — add back to vercel.json:
//     { "crons": [ { "path": "/api/cron/expire-subscriptions", "schedule": "0 0 * * *" } ] }
// Daily is sufficient: expiry (trial → grace → suspended) is computed in DAYS, not
// hours. (Hourly "0 * * * *" needs Vercel Pro and is only for finer-grained timing.)
// Safe to leave disabled now: the 3 backfilled tenants have currentPeriodEnd=2099,
// so none expire imminently.
//
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
