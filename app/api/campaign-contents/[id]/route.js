import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const cid = parseInt(id)

  // Verify the content belongs to this tenant before writing.
  const existing = await prisma.campaignContent.findFirst({ where: { id: cid, tenantId: session.user.tenantId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  // UpdateContentModal sends counts as view/like/comment (singular); accept the
  // plural spellings too as a fallback so manual count edits always persist.
  const viewVal    = body.view    ?? body.views
  const likeVal    = body.like    ?? body.likes
  const commentVal = body.comment ?? body.comments
  await prisma.campaignContent.update({
    where: { id: cid },
    data: {
      ...(body.username     !== undefined ? { username:    body.username }                        : {}),
      ...(body.creator_name !== undefined ? { creatorName: body.creator_name }                    : {}),
      ...(body.pic          !== undefined ? { pic:         body.pic }                             : {}),
      ...(body.task_name    !== undefined ? { taskName:    body.task_name }                       : {}),
      ...(body.rate_card    != null       ? { rateCard:    parseFloat(body.rate_card) }           : {}),
      ...(body.channel      !== undefined ? { channel:     body.channel }                         : {}),
      ...(body.link         !== undefined ? { link:        body.link }                            : {}),
      ...(body.product      !== undefined ? { product:     body.product }                         : {}),
      ...(body.boost_code   !== undefined ? { boostCode:   body.boost_code }                      : {}),
      ...(body.kode_ads     !== undefined ? { kodeAds:     body.kode_ads }                        : {}),
      ...(viewVal           != null       ? { view:        BigInt(parseInt(viewVal)    || 0) }    : {}),
      ...(likeVal           != null       ? { like:        BigInt(parseInt(likeVal)    || 0) }    : {}),
      ...(commentVal        != null       ? { comment:     BigInt(parseInt(commentVal) || 0) }    : {}),
    },
  })
  return NextResponse.json({ message: 'Updated' })
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  // Scope the delete by tenant; 404 if it isn't this tenant's row.
  const { count } = await prisma.campaignContent.deleteMany({
    where: { id: parseInt(id), tenantId: session.user.tenantId },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted' })
}
