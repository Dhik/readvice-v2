import { requireAuth, hasPermission } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { companyData } from './company-fields'

export async function GET(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  if (!hasPermission(session, 'view_tenant')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page   = parseInt(searchParams.get('page')   ?? '1')
  const limit  = parseInt(searchParams.get('limit')  ?? '25')
  const search = searchParams.get('search') ?? ''

  const where = search ? { name: { contains: search, mode: 'insensitive' } } : {}

  const [total, tenants] = await prisma.$transaction([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({
      where,
      orderBy: { name: 'asc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ])

  const data = tenants.map(t => ({
    id:        t.id,
    name:      t.name,
    slug:      t.slug,
    logoUrl:   t.logoUrl ?? null,
    isActive:  t.isActive,
    createdAt: t.createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  }))

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request) {
  const { error, session } = await requireAuth()
  if (error) return error
  if (!hasPermission(session, 'create_tenant')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.name?.trim() || !body.slug?.trim()) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
  }

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name:     body.name.trim(),
        slug:     body.slug.trim().toLowerCase(),
        logoUrl:  body.logoUrl?.trim()  || null,
        isActive: body.isActive ?? true,
        ...companyData(body),
      },
    })
    return NextResponse.json(tenant, { status: 201 })
  } catch (err) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
    }
    throw err
  }
}
