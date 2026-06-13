import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page        = parseInt(searchParams.get('page')        ?? '1')
  const limit       = parseInt(searchParams.get('limit')       ?? '25')
  const type        = searchParams.get('type')        ?? ''
  const search      = searchParams.get('search')      ?? ''
  const filterMonth = searchParams.get('filterMonth') ?? ''
  const tenantId    = session.user.tenantId

  const where = {
    tenantId,
    ...(type   ? { type }                                                  : {}),
    ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
  }

  if (filterMonth) {
    const [year, month] = filterMonth.split('-')
    const monthStr = new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleString('en-US', { month: 'short', year: 'numeric' })
    where.startDate = { contains: monthStr }
  }

  const [total, campaigns] = await prisma.$transaction([
    prisma.campaign.count({ where }),
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { createdBy: { select: { name: true } } },
    }),
  ])

  const data = campaigns.map(c => {
    const expense = Number(c.totalExpense ?? 0)
    const gmv     = Number(c.gmv ?? 0)
    const roi     = expense > 0 ? Math.round((gmv / expense) * 100) / 100 : 0
    return {
      id:              c.id,
      title:           c.title,
      type:            c.type,
      total_expense:   expense,
      cpm:             Number(c.cpm ?? 0),
      view:            Number(c.view ?? 0),
      like:            Number(c.like ?? 0),
      comment:         Number(c.comment ?? 0),
      roi,
      gmv,
      created_at:      c.createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      created_by_name: c.createdBy?.name ?? '-',
    }
  })

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body        = await request.json()
  const tenantId    = session.user.tenantId
  const createdById = session.user.id

  const campaign = await prisma.campaign.create({
    data: {
      tenantId, createdById,
      title:     body.title,
      type:      body.type      ?? 'creative',
      platform:  body.platform  ?? null,
      purpose:   body.purpose   ?? null,
      budget:    body.budget    ? parseFloat(body.budget) : null,
      status:    body.status    ?? 'active',
      startDate: body.startDate ?? null,
      endDate:   body.endDate   ?? null,
    },
  })

  return NextResponse.json({
    ...campaign,
    view:         Number(campaign.view    ?? 0),
    like:         Number(campaign.like    ?? 0),
    comment:      Number(campaign.comment ?? 0),
    totalExpense: Number(campaign.totalExpense ?? 0),
    gmv:          Number(campaign.gmv    ?? 0),
    cpm:          Number(campaign.cpm    ?? 0),
    budget:       campaign.budget ? Number(campaign.budget) : null,
  }, { status: 201 })
}
