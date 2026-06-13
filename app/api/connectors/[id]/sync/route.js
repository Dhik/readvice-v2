import { requireSuperAdmin } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'
import { syncConnector } from '@/lib/connectors/sync-engine'

export const runtime = 'nodejs'

// POST /api/connectors/[id]/sync — superadmin. Runs the sync engine.
// Sheet-read failures (bad id / no access / bad range) → 502, never a crash;
// connector lastSync* state is only touched on a completed run.
export async function POST(request, { params }) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const { id } = await params
  const connectorId = parseInt(id, 10)
  if (Number.isNaN(connectorId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const result = await syncConnector(connectorId)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e?.message ?? 'Sync failed'
    if (msg === 'Connector not found') return NextResponse.json({ error: msg }, { status: 404 })
    if (msg.startsWith('CS3 supports') || msg.includes('upsertKey')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    // Anything else (Google Sheets fetch / parse failure) — surface as 502.
    console.error('CONNECTOR SYNC FAILED:', msg)
    return NextResponse.json({ error: `Sheet sync failed: ${msg}` }, { status: 502 })
  }
}
