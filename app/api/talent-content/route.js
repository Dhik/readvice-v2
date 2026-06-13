import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function fmtDate(d) {
  if (!d) return null
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}

function deadlineStatus(dealingUploadDate, postingDate) {
  if (!dealingUploadDate || !postingDate) return 'On Time'
  const deadline = new Date(dealingUploadDate)
  deadline.setDate(deadline.getDate() + 3)
  return new Date(postingDate) > deadline ? 'Overdue' : 'On Time'
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page       = parseInt(searchParams.get('page')             ?? '1')
  const limit      = parseInt(searchParams.get('limit')            ?? '50')
  const username   = searchParams.get('username')   ?? ''
  const dateRange  = searchParams.get('dateRange')  ?? ''
  const typeFilter = searchParams.get('filterTalentType') ?? ''
  const tenantId   = session.user.tenantId

  let startDate, endDate
  if (dateRange) {
    const [s, e] = dateRange.split(' - ')
    if (s) startDate = new Date(s)
    if (e) endDate   = new Date(e)
  }

  const where = {
    talent: {
      tenantId,
      ...(username   ? { username: { contains: username, mode: 'insensitive' } } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    ...(startDate || endDate ? {
      postingDate: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate   ? { lte: endDate   } : {}),
      },
    } : {}),
  }

  const [total, contents] = await prisma.$transaction([
    prisma.talentContent.count({ where }),
    prisma.talentContent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: {
        talent:   { select: { username: true, type: true, rateFinal: true, slotFinal: true, produk: true } },
        campaign: { select: { title: true } },
      },
    }),
  ])

  const data = contents.map(c => {
    const rateDisplay = c.finalRateCard
      ? Number(c.finalRateCard)
      : (c.talent.rateFinal && c.talent.slotFinal
          ? Number(c.talent.rateFinal) / c.talent.slotFinal
          : null)
    return {
      id:                  c.id,
      talent_id:           c.talentId,
      username:            c.talent.username,
      type:                c.talent.type,
      campaign_title:      c.campaign?.title ?? '-',
      product:             c.talent.produk   ?? '-',
      dealing_upload_date: fmtDate(c.dealingUploadDate),
      posting_date:        fmtDate(c.postingDate),
      deadline:            deadlineStatus(c.dealingUploadDate, c.postingDate),
      done:                c.done,
      rate_display:        rateDisplay,
      is_refund:           c.isRefund,
      upload_link:         c.uploadLink ?? null,
      pic_code:            c.picCode    ?? null,
      boost_code:          c.boostCode  ?? null,
    }
  })

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const talentId = parseInt(body.talent_id)

  // Verify the talent belongs to the caller's tenant
  const talent = await prisma.talent.findFirst({
    where: { id: talentId, tenantId: session.user.tenantId },
  })
  if (!talent) return NextResponse.json({ error: 'Talent not found' }, { status: 404 })

  const content = await prisma.talentContent.create({
    data: {
      talentId,
      campaignId:       body.campaign_id ? parseInt(body.campaign_id) : null,
      dealingUploadDate: body.dealing_upload_date ? new Date(body.dealing_upload_date) : null,
      finalRateCard:    body.final_rate_card ? parseFloat(body.final_rate_card) : null,
      createdBy:        session.user.id,
    },
  })

  return NextResponse.json({ id: content.id }, { status: 201 })
}
