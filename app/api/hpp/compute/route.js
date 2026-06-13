import { requireAuth } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { computeDailyHpp } from '@/lib/hpp/compute-hpp'

export const runtime = 'nodejs'

// POST /api/hpp/compute — recompute the DailyHpp snapshot for the tenant.
// Tenant-scoped via session; a superadmin may target another tenant via body.tenantId.
// Body: { startDate?, endDate? } (default: last 40 days).
export async function POST(request) {
  const { error, session } = await requireAuth()
  if (error) return error

  let body = {}
  try { body = await request.json() } catch { /* empty body is fine */ }

  // Superadmins may compute for any tenant; everyone else is locked to their own.
  const tenantId = (session.user?.isSuperAdmin && Number.isInteger(body.tenantId))
    ? body.tenantId
    : session.user?.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  try {
    const result = await computeDailyHpp(tenantId, {
      startDate: body.startDate,
      endDate:   body.endDate,
    })
    return NextResponse.json({ ok: true, tenantId, ...result })
  } catch (e) {
    console.error('HPP COMPUTE FAILED:', e?.message)
    return NextResponse.json({ error: `HPP compute failed: ${e?.message ?? 'unknown'}` }, { status: 500 })
  }
}
