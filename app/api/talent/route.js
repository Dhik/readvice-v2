import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TENANT_PREFIXES = { cleora: 'CLR', azrina: 'AZR', delmoura: 'DLM' }

function genDocNumber(dealingDate, tenantSlug, dealingNumber) {
  const d   = dealingDate ? new Date(dealingDate) : new Date()
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const yy  = String(d.getFullYear()).slice(-2)
  const pfx = TENANT_PREFIXES[tenantSlug?.toLowerCase()] ?? 'ORG'
  return `${mm}${yy}/INV/${pfx}/${String(dealingNumber).padStart(5, '0')}`
}

function fmtDate(d) {
  if (!d) return null
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}

function serializeTalent(t, contentCount) {
  const done    = contentCount ?? 0
  const slots   = t.slotFinal ?? 0
  const colorCls = done === slots && slots > 0 ? 'text-green-600' : 'text-blue-600'
  return {
    id:                    t.id,
    no_document:           t.noDocument ?? '-',
    username:              t.username,
    talent_name:           t.talentName,
    type:                  t.type,
    affiliate_status:      t.affiliateStatus ?? null,
    dp_amount:             t.dpAmount ? Number(t.dpAmount) : null,
    rate_final:            t.rateFinal ? Number(t.rateFinal) : null,
    slot_final:            slots,
    dealing_number:        t.dealingNumber,
    dealing_date_formatted: fmtDate(t.dealingDate),
    pic:                   t.pic ?? '-',
    platform:              t.platform ?? '-',
    produk:                t.produk ?? '-',
    remaining:             `${done} / ${slots}`,
    remaining_color:       colorCls,
    created_at:            fmtDate(t.createdAt),
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page   = parseInt(searchParams.get('page')  ?? '1')
  const limit  = parseInt(searchParams.get('limit') ?? '25')
  const search = searchParams.get('search') ?? ''
  const type   = searchParams.get('type')   ?? ''
  const dealingFrom = searchParams.get('dealing_date_from')
  const dealingTo   = searchParams.get('dealing_date_to')
  const createdFrom = searchParams.get('created_date_from')
  const createdTo   = searchParams.get('created_date_to')

  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    ...(type   ? { type }                                                                : {}),
    ...(search ? { OR: [
      { username:   { contains: search, mode: 'insensitive' } },
      { talentName: { contains: search, mode: 'insensitive' } },
    ]} : {}),
    ...(dealingFrom || dealingTo ? {
      dealingDate: {
        ...(dealingFrom ? { gte: new Date(dealingFrom) } : {}),
        ...(dealingTo   ? { lte: new Date(dealingTo)   } : {}),
      }
    } : {}),
    ...(createdFrom || createdTo ? {
      createdAt: {
        ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
        ...(createdTo   ? { lte: new Date(createdTo)   } : {}),
      }
    } : {}),
  }

  const [total, talents] = await prisma.$transaction([
    prisma.talent.count({ where }),
    prisma.talent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: {
        _count: { select: { contents: { where: { done: true, isRefund: false } } } },
      },
    }),
  ])

  const data = talents.map(t => serializeTalent(t, t._count.contents))
  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body     = await request.json()
  const tenantId = session.user.tenantId

  // Auto dealing number: count existing deals for this username + 1
  const existing = await prisma.talent.count({ where: { tenantId, username: body.username } })
  const dealingNumber = existing + 1

  // Get tenant slug for doc number
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })

  // Affiliate status: check if username already exists
  const affiliateStatus = body.type === 'Affiliate'
    ? (existing > 0 ? 'Existing' : 'New')
    : null

  const dealingDate = body.dealing_date ? new Date(body.dealing_date) : null
  const noDocument  = genDocNumber(dealingDate, tenant?.slug, dealingNumber)

  const talent = await prisma.talent.create({
    data: {
      tenantId,
      noDocument,
      username:             body.username,
      talentName:           body.talent_name,
      type:                 body.type,
      contentType:          body.content_type          ?? null,
      produk:               body.produk                ?? null,
      pic:                  body.pic                   ?? null,
      bulanRunning:         body.bulan_running         ?? null,
      niche:                body.niche                 ?? null,
      followers:            body.followers             ? parseInt(body.followers) : null,
      address:              body.address               ?? null,
      phoneNumber:          body.phone_number          ?? null,
      bank:                 body.bank                  ?? null,
      noRekening:           body.no_rekening           ?? null,
      namaRekening:         body.nama_rekening         ?? null,
      noNpwp:               body.no_npwp               ?? null,
      pengajuanTransferDate: body.pengajuan_transfer_date ? new Date(body.pengajuan_transfer_date) : null,
      dealingDate,
      dealingNumber,
      nik:                  body.nik                   ?? null,
      priceRate:            body.price_rate            ? parseFloat(body.price_rate)     : null,
      firstRateCard:        body.first_rate_card       ? parseFloat(body.first_rate_card): null,
      slotFinal:            body.slot_final            ? parseInt(body.slot_final)       : null,
      rateFinal:            body.rate_final            ? parseFloat(body.rate_final)     : null,
      taxPercentage:        body.tax_percentage        ? parseFloat(body.tax_percentage) : null,
      scopeOfWork:          body.scope_of_work         ?? null,
      masaKerjasama:        body.masa_kerjasama        ?? null,
      platform:             body.platform              ?? null,
      affiliateStatus,
      gdriveKolAccepting:   body.gdrive_kol_accepting  ?? null,
    },
  })

  // If Content Creator, create linked record
  if (body.type === 'Content Creator' && body.cc) {
    await prisma.contentCreator.create({
      data: {
        talentId: talent.id,
        tenantId,
        objektif:              body.cc.objektif               ?? null,
        pillar:                body.cc.pillar                 ?? null,
        subPillar:             body.cc.sub_pillar             ?? null,
        hook:                  body.cc.hook                   ?? null,
        referensi:             body.cc.referensi              ?? null,
        briefKonten:           body.cc.brief_konten           ?? null,
        caption:               body.cc.caption                ?? null,
        assigneeContentEditor: body.cc.assignee_content_editor ?? null,
        bookingTalentDate:     body.cc.booking_talent_date    ? new Date(body.cc.booking_talent_date)  : null,
        bookingVenueDate:      body.cc.booking_venue_date     ? new Date(body.cc.booking_venue_date)   : null,
        productionDate:        body.cc.production_date        ? new Date(body.cc.production_date)      : null,
      },
    })
  }

  return NextResponse.json({ id: talent.id, no_document: noDocument }, { status: 201 })
}
