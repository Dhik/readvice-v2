import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const tenantId = Number(body?.tenantId)
  if (!tenantId || isNaN(tenantId)) {
    return NextResponse.json({ error: 'Invalid tenantId' }, { status: 400 })
  }

  const userId = session.user.id

  // Load roles to check superadmin
  const user = await prisma.user.findUnique({
    where:   { id: userId },
    include: { userRoles: { include: { role: true } } },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const isSuperAdmin = user.userRoles.some(ur => ur.role.name === 'superadmin')

  if (!isSuperAdmin) {
    // Regular user must be in the TenantUser pivot for the target tenant
    const pivot = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    })
    if (!pivot) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Target tenant must be active
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant || !tenant.isActive) {
    return NextResponse.json({ error: 'Tenant not available' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: userId },
    data:  { currentTenantId: tenantId },
  })

  return NextResponse.json({ ok: true, tenantId })
}
