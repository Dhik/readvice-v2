import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id     = parseInt(params.id)
  const record = await prisma.listingAffiliate.findFirst({
    where:   { id, tenantId: session.user.tenantId },
    include: { reachAffiliates: true, dealingAffiliate: true },
  })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...record,
    gmv:      Number(record.gmv      ?? 0),
    rateCard: Number(record.rateCard ?? 0),
    roas:     Number(record.roas     ?? 0),
    gpm:      Number(record.gpm      ?? 0),
  })
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id   = parseInt(params.id)
  const body = await request.json()

  const updated = await prisma.listingAffiliate.updateMany({
    where: { id, tenantId: session.user.tenantId },
    data: {
      ...(body.date          ? { date: new Date(body.date) }              : {}),
      ...(body.pic           !== undefined ? { pic: body.pic }             : {}),
      ...(body.username      ? { username: body.username }                 : {}),
      ...(body.followers     !== undefined ? { followers: body.followers }  : {}),
      ...(body.gmv           !== undefined ? { gmv: body.gmv }             : {}),
      ...(body.kontak        !== undefined ? { kontak: body.kontak }        : {}),
      ...(body.sowCategory   !== undefined ? { sowCategory: body.sowCategory } : {}),
      ...(body.salesChannelId!== undefined ? { salesChannelId: body.salesChannelId ? parseInt(body.salesChannelId) : null } : {}),
      ...(body.roas          !== undefined ? { roas: body.roas }            : {}),
      ...(body.gpm           !== undefined ? { gpm: body.gpm }              : {}),
      ...(body.rateCard      !== undefined ? { rateCard: body.rateCard }    : {}),
      ...(body.slot          !== undefined ? { slot: body.slot }            : {}),
      ...(body.remark        !== undefined ? { remark: body.remark }        : {}),
      ...(body.keterangan    !== undefined ? { keterangan: body.keterangan }: {}),
      ...(body.listingStatus !== undefined ? { listingStatus: body.listingStatus } : {}),
    },
  })

  return NextResponse.json({ updated: updated.count })
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.listingAffiliate.deleteMany({
    where: { id: parseInt(params.id), tenantId: session.user.tenantId },
  })
  return NextResponse.json({ ok: true })
}
