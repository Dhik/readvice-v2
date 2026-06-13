import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') ?? ''
  const year     = searchParams.get('year') ?? new Date().getFullYear().toString()
  const month    = searchParams.get('month') ?? ''
  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    year: parseInt(year),
    ...(platform ? { platform } : {}),
    ...(month    ? { month }    : {}),
  }

  const targets = await prisma.target.findMany({ where, orderBy: { month: 'asc' } })
  return NextResponse.json(targets)
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body     = await request.json()
  const tenantId = session.user.tenantId

  const target = await prisma.target.create({
    data: {
      tenantId,
      platform:   body.platform,
      month:      body.month,
      year:       parseInt(body.year),
      targetGmv:  body.targetGmv  ? parseFloat(body.targetGmv)  : null,
      targetNett: body.targetNett ? parseFloat(body.targetNett) : null,
      targetQty:  body.targetQty  ? parseInt(body.targetQty)    : null,
      kpiType:    body.kpiType ?? null,
    },
  })

  return NextResponse.json(target, { status: 201 })
}
