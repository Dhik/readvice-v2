import { requireAuth, hasPermission } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

const USER_SELECT = {
  id:       true,
  name:     true,
  email:    true,
  isActive: true,
  createdAt: true,
  userRoles: { include: { role: { select: { id: true, name: true } } } },
  tenants:   { include: { tenant: { select: { id: true, name: true } } } },
}

export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  if (!hasPermission(session, 'view_user')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page   = parseInt(searchParams.get('page')   ?? '1')
  const limit  = parseInt(searchParams.get('limit')  ?? '25')
  const search = searchParams.get('search') ?? ''

  const where = search
    ? { OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ] }
    : {}

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select:  USER_SELECT,
      orderBy: { name: 'asc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ])

  const data = users.map(u => ({
    id:        u.id,
    name:      u.name,
    email:     u.email,
    isActive:  u.isActive,
    createdAt: u.createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    roles:     u.userRoles.map(ur => ({ id: ur.role.id, name: ur.role.name })),
    tenants:   u.tenants.map(tu => ({ id: tu.tenant.id, name: tu.tenant.name })),
  }))

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  if (!hasPermission(session, 'create_user')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.name?.trim() || !body.email?.trim() || !body.password?.trim()) {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
  }

  const roleIds   = (body.roleIds   ?? []).map(Number)
  const tenantIds = (body.tenantIds ?? []).map(Number)

  // Tenant constraint: non-superadmin actors may only assign their own tenants
  const actorRow = await prisma.user.findUnique({
    where:   { id: session.user.id },
    include: { userRoles: { include: { role: { select: { name: true } } } } },
  })
  const isSuperAdmin = actorRow.userRoles.some(ur => ur.role.name === 'superadmin')

  if (!isSuperAdmin && tenantIds.length > 0) {
    const actorTenants = await prisma.tenantUser.findMany({
      where:  { userId: session.user.id },
      select: { tenantId: true },
    })
    const allowed = new Set(actorTenants.map(t => t.tenantId))
    if (tenantIds.some(id => !allowed.has(id))) {
      return NextResponse.json({ error: 'Forbidden: cannot assign tenants outside your access' }, { status: 403 })
    }
  }

  const hashedPw = await bcrypt.hash(body.password.trim(), 10)

  try {
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name:     body.name.trim(),
          email:    body.email.trim().toLowerCase(),
          password: hashedPw,
          isActive: body.isActive ?? true,
        },
      })
      if (roleIds.length) {
        await tx.userRole.createMany({
          data: roleIds.map(roleId => ({ userId: user.id, roleId })),
        })
      }
      if (tenantIds.length) {
        await tx.tenantUser.createMany({
          data: tenantIds.map(tenantId => ({ tenantId, userId: user.id })),
        })
      }
      return user
    })

    return NextResponse.json(
      { id: newUser.id, name: newUser.name, email: newUser.email, isActive: newUser.isActive },
      { status: 201 }
    )
  } catch (err) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    throw err
  }
}
