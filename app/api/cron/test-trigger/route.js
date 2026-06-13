import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { runExpiryChecks } from '@/lib/billing'

export const runtime = 'nodejs'

// GET /api/cron/test-trigger — DEV ONLY. Runs the same expiry sweeps as the
// Vercel Cron route so you can test transitions without waiting an hour or
// hand-editing dates. Disabled in production; superadmin-only otherwise.
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error, session } = await requireAuth()
  if (error) return error

  const user = await prisma.user.findUnique({
    where:   { id: session.user.id },
    include: { userRoles: { include: { role: true } } },
  })
  const isSuperAdmin = user?.userRoles.some(ur => ur.role.name === 'superadmin') ?? false
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const transitions = await runExpiryChecks()
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), transitions })
}
