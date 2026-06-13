import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { NextResponse }     from 'next/server'

// ── GET — check if credentials exist ─────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId

  const cred = await prisma.kalodataCredential.findUnique({
    where:  { tenantId },
    select: { phone: true },
  })

  if (!cred) return NextResponse.json({ exists: false })

  // Mask phone: show first 4 and last 3 digits
  const masked = cred.phone.length > 7
    ? cred.phone.slice(0, 4) + '****' + cred.phone.slice(-3)
    : cred.phone

  return NextResponse.json({ exists: true, maskedPhone: masked })
}

// ── POST — save / update credentials ─────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const { phone, password } = await request.json()

  if (!phone?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'phone and password are required' }, { status: 400 })
  }

  await prisma.kalodataCredential.upsert({
    where:  { tenantId },
    update: { phone: phone.trim(), password: password.trim() },
    create: { tenantId, phone: phone.trim(), password: password.trim() },
  })

  const masked = phone.trim().length > 7
    ? phone.trim().slice(0, 4) + '****' + phone.trim().slice(-3)
    : phone.trim()

  return NextResponse.json({ ok: true, maskedPhone: masked })
}

// ── DELETE — remove credentials ───────────────────────────────────────
export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId

  await prisma.kalodataCredential.deleteMany({ where: { tenantId } })

  return NextResponse.json({ ok: true })
}
