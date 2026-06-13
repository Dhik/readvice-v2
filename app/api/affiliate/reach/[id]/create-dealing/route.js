import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id       = parseInt(params.id)
  const tenantId = session.user.tenantId
  const body     = await request.json()

  const reach = await prisma.reachAffiliate.findFirst({
    where:   { id, tenantId },
    include: { listingAffiliate: true },
  })
  if (!reach) return NextResponse.json({ error: 'Reach not found' }, { status: 404 })

  const existing = await prisma.dealingAffiliate.findUnique({
    where: { listingAffiliateId: reach.listingAffiliateId },
  })
  if (existing) return NextResponse.json({ error: 'Dealing already exists for this listing' }, { status: 400 })

  const dealing = await prisma.dealingAffiliate.create({
    data: {
      tenantId,
      listingAffiliateId: reach.listingAffiliateId,
      pic:        body.pic        ?? reach.pic ?? null,
      dealingDate: body.dealingDate ? new Date(body.dealingDate) : null,
      rateCard:   body.rateCard   ?? null,
      slot:       body.slot       ?? 0,
      platform:   body.platform   ?? null,
      notes:      body.notes      ?? null,
    },
  })

  return NextResponse.json(dealing, { status: 201 })
}
