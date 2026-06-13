import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where:   { id: userId },
    include: { userRoles: { include: { role: true } } },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const isSuperAdmin = user.userRoles.some(ur => ur.role.name === 'superadmin')

  let tenants
  if (isSuperAdmin) {
    tenants = await prisma.tenant.findMany({
      where:   { isActive: true },
      orderBy: { name: 'asc' },
      select:  { id: true, name: true, slug: true, logoUrl: true },
    })
  } else {
    const pivots = await prisma.tenantUser.findMany({
      where:   { userId, tenant: { isActive: true } },
      include: { tenant: { select: { id: true, name: true, slug: true, logoUrl: true } } },
      orderBy: { tenant: { name: 'asc' } },
    })
    tenants = pivots.map(p => p.tenant)
  }

  return NextResponse.json({ tenants, currentTenantId: session.user.tenantId })
}
