import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { isPtOrCv, generateDocumentNumber, generateDealingNumber } from '@/lib/affiliate-utils'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id       = parseInt(params.id)
  const tenantId = session.user.tenantId

  const listing = await prisma.listingAffiliate.findFirst({
    where:   { id, tenantId },
    include: { dealingAffiliate: true },
  })
  if (!listing)                 return NextResponse.json({ error: 'Not found' },             { status: 404 })
  if (listing.talentCreatedStatus) return NextResponse.json({ error: 'Talent already created' }, { status: 400 })
  if (listing.approval !== 'Approve') return NextResponse.json({ error: 'Listing not approved' }, { status: 400 })

  const taxPercentage = isPtOrCv(listing.username) ? 2.0 : 2.5
  const noDocument    = await generateDocumentNumber(prisma, tenantId)
  const dealingNumber = await generateDealingNumber(prisma, tenantId)

  const talent = await prisma.talent.create({
    data: {
      tenantId,
      username:          listing.username,
      talentName:        listing.username,
      type:              'affiliate',
      followers:         listing.followers,
      pic:               listing.pic,
      scopeOfWork:       listing.sowCategory,
      firstRateCard:     listing.rateCard,
      slotFinal:         listing.slot,
      noDocument,
      dealingNumber,
      dealingDate:       listing.dealingAffiliate?.dealingDate ?? new Date(),
      listingAffiliateId: listing.id,
      taxPercentage,
    },
  })

  await prisma.listingAffiliate.update({
    where: { id },
    data:  { talentCreatedStatus: true },
  })

  return NextResponse.json({ talent_id: talent.id, noDocument, dealingNumber })
}
