import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'PDF export not yet implemented' }, { status: 501 })
}
