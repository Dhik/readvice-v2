import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body   = await request.json()
  const contentId = parseInt(id)

  const owned = await prisma.talentContent.findFirst({
    where: { id: contentId, talent: { tenantId: session.user.tenantId } },
  })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.talentContent.update({
    where: { id: contentId },
    data: {
      campaignId:        body.campaign_id         !== undefined ? (body.campaign_id ? parseInt(body.campaign_id) : null) : undefined,
      dealingUploadDate: body.dealing_upload_date !== undefined ? (body.dealing_upload_date ? new Date(body.dealing_upload_date) : null) : undefined,
      postingDate:       body.posting_date        !== undefined ? (body.posting_date ? new Date(body.posting_date) : null) : undefined,
      done:              body.done                !== undefined ? Boolean(body.done) : undefined,
      uploadLink:        body.upload_link         !== undefined ? (body.upload_link ?? null) : undefined,
      finalRateCard:     body.final_rate_card     !== undefined ? (body.final_rate_card ? parseFloat(body.final_rate_card) : null) : undefined,
      picCode:           body.pic_code            !== undefined ? (body.pic_code ?? null) : undefined,
      boostCode:         body.boost_code          !== undefined ? (body.boost_code ?? null) : undefined,
    },
  })

  return NextResponse.json({ updated: true })
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { count } = await prisma.talentContent.deleteMany({
    where: { id: parseInt(id), talent: { tenantId: session.user.tenantId } },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
