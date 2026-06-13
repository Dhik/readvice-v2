import { requireAuth, hasPermission } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { companyData } from '../company-fields'

export async function GET(request, { params }) {
  const { error, session } = await requireAuth()
  if (error) return error
  if (!hasPermission(session, 'view_tenant')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const tenant = await prisma.tenant.findUnique({ where: { id: parseInt(id) } })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(tenant)
}

export async function PUT(request, { params }) {
  const { error, session } = await requireAuth()
  if (error) return error
  if (!hasPermission(session, 'update_tenant')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  if (!body.name?.trim() || !body.slug?.trim()) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
  }

  try {
    const tenant = await prisma.tenant.update({
      where: { id: parseInt(id) },
      data: {
        name:     body.name.trim(),
        slug:     body.slug.trim().toLowerCase(),
        logoUrl:  body.logoUrl?.trim()  || null,
        isActive: body.isActive ?? true,
        ...companyData(body),
      },
    })
    return NextResponse.json(tenant)
  } catch (err) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
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
  if (!hasPermission(session, 'delete_tenant')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const tenantId = parseInt(id)

  // Refuse deletion if any key tables reference this tenant
  const [userCount, campaignCount, orderCount, adMetaCount, adShopeeCount, adTiktokCount] =
    await prisma.$transaction([
      prisma.user.count({         where: { currentTenantId: tenantId } }),
      prisma.campaign.count({     where: { tenantId } }),
      prisma.order.count({        where: { tenantId } }),
      prisma.adSpentMeta.count({  where: { tenantId } }),
      prisma.adSpentShopee.count({ where: { tenantId } }),
      prisma.adSpentTiktok.count({ where: { tenantId } }),
    ])

  const details = {
    users:     userCount,
    campaigns: campaignCount,
    orders:    orderCount,
    adSpend:   adMetaCount + adShopeeCount + adTiktokCount,
  }
  const hasData = Object.values(details).some(n => n > 0)

  if (hasData) {
    return NextResponse.json(
      { error: 'Tenant has associated data and cannot be deleted', details },
      { status: 409 }
    )
  }

  try {
    await prisma.tenant.delete({ where: { id: tenantId } })
    return NextResponse.json({ message: 'Deleted successfully' })
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw err
  }
}
