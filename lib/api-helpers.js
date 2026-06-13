import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { NextResponse } from 'next/server'

export async function getSession() {
  return getServerSession(authOptions)
}

// Gate a route to superadmins only. Mirrors requireAuth's { error, session }
// shape. Verifies the role server-side (DB lookup) — never trusts the client.
export async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null }
  }
  const user = await prisma.user.findUnique({
    where:   { id: session.user.id },
    include: { userRoles: { include: { role: true } } },
  })
  const isSuperAdmin = user?.userRoles.some(ur => ur.role.name === 'superadmin') ?? false
  if (!isSuperAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session }
  }
  return { error: null, session }
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null }
  }
  return { error: null, session }
}

export function getTenantId(session) {
  return session?.user?.tenantId
}

export function hasPermission(session, permission) {
  return session?.user?.permissions?.includes(permission) ?? false
}
