import { requireAuth, hasPermission } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

async function getActorInfo(userId) {
  const actor = await prisma.user.findUnique({
    where:   { id: userId },
    include: { userRoles: { include: { role: { select: { name: true } } } } },
  })
  const isSuperAdmin = actor?.userRoles.some(ur => ur.role.name === 'superadmin') ?? false
  return { isSuperAdmin }
}

async function validateTenantAccess(actorId, isSuperAdmin, tenantIds) {
  if (isSuperAdmin || tenantIds.length === 0) return null
  const actorTenants = await prisma.tenantUser.findMany({
    where:  { userId: actorId },
    select: { tenantId: true },
  })
  const allowed = new Set(actorTenants.map(t => t.tenantId))
  if (tenantIds.some(id => !allowed.has(id))) {
    return NextResponse.json({ error: 'Forbidden: cannot assign tenants outside your access' }, { status: 403 })
  }
  return null
}

export async function PUT(request, { params }) {
  const { error, session } = await requireAuth()
  if (error) return error
  if (!hasPermission(session, 'update_user')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const userId = parseInt(id)

  const body = await request.json()
  if (!body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const roleIds   = (body.roleIds   ?? []).map(Number)
  const tenantIds = (body.tenantIds ?? []).map(Number)

  const { isSuperAdmin } = await getActorInfo(session.user.id)
  const tenantError = await validateTenantAccess(session.user.id, isSuperAdmin, tenantIds)
  if (tenantError) return tenantError

  const updateData = {
    name:     body.name.trim(),
    email:    body.email.trim().toLowerCase(),
    isActive: body.isActive ?? true,
  }
  if (body.password?.trim()) {
    updateData.password = await bcrypt.hash(body.password.trim(), 10)
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: userId }, data: updateData })
      await tx.userRole.deleteMany({ where: { userId } })
      if (roleIds.length) {
        await tx.userRole.createMany({ data: roleIds.map(roleId => ({ userId, roleId })) })
      }
      await tx.tenantUser.deleteMany({ where: { userId } })
      if (tenantIds.length) {
        await tx.tenantUser.createMany({ data: tenantIds.map(tenantId => ({ tenantId, userId })) })
      }
      return user
    })

    return NextResponse.json({ id: updated.id, name: updated.name, email: updated.email, isActive: updated.isActive })
  } catch (err) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(request, { params }) {
  const { error, session } = await requireAuth()
  if (error) return error
  if (!hasPermission(session, 'delete_user')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const userId = parseInt(id)

  if (session.user.id === userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  try {
    await prisma.user.delete({ where: { id: userId } })
    return NextResponse.json({ message: 'Deleted successfully' })
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw err
  }
}
