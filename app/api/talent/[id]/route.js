import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcTax } from '@/lib/talent-finance'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const talent = await prisma.talent.findFirst({
    where: { id: parseInt(id), tenantId: session.user.tenantId },
    include: { contentCreator: true },
  })
  if (!talent) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const taxDeduction = calcTax(talent.rateFinal, talent.namaRekening, talent.taxPercentage)
  const discount     = Number(talent.firstRateCard ?? 0) - Number(talent.rateFinal ?? 0)

  return NextResponse.json({
    talent: {
      ...talent,
      rateFinal:     talent.rateFinal     ? Number(talent.rateFinal)     : null,
      firstRateCard: talent.firstRateCard ? Number(talent.firstRateCard) : null,
      priceRate:     talent.priceRate     ? Number(talent.priceRate)     : null,
      dpAmount:      talent.dpAmount      ? Number(talent.dpAmount)      : null,
      taxPercentage: talent.taxPercentage ? Number(talent.taxPercentage) : null,
    },
    content_creator: talent.contentCreator ?? null,
    discount:        Math.max(0, discount),
    tax_deduction:   taxDeduction,
  })
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id }   = await params
  const body     = await request.json()
  const tenantId = session.user.tenantId
  const talentId = parseInt(id)

  const existing = await prisma.talent.findFirst({ where: { id: talentId, tenantId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const talent = await prisma.talent.update({
    where: { id: talentId },
    data: {
      username:             body.username              ?? undefined,
      talentName:           body.talent_name           ?? undefined,
      type:                 body.type                  ?? undefined,
      contentType:          body.content_type          !== undefined ? (body.content_type ?? null)  : undefined,
      produk:               body.produk                !== undefined ? (body.produk ?? null)         : undefined,
      pic:                  body.pic                   !== undefined ? (body.pic ?? null)            : undefined,
      bulanRunning:         body.bulan_running         !== undefined ? (body.bulan_running ?? null)  : undefined,
      niche:                body.niche                 !== undefined ? (body.niche ?? null)          : undefined,
      followers:            body.followers             !== undefined ? (body.followers ? parseInt(body.followers) : null) : undefined,
      address:              body.address               !== undefined ? (body.address ?? null)        : undefined,
      phoneNumber:          body.phone_number          !== undefined ? (body.phone_number ?? null)   : undefined,
      bank:                 body.bank                  !== undefined ? (body.bank ?? null)           : undefined,
      noRekening:           body.no_rekening           !== undefined ? (body.no_rekening ?? null)    : undefined,
      namaRekening:         body.nama_rekening         !== undefined ? (body.nama_rekening ?? null)  : undefined,
      noNpwp:               body.no_npwp               !== undefined ? (body.no_npwp ?? null)        : undefined,
      pengajuanTransferDate: body.pengajuan_transfer_date !== undefined ? (body.pengajuan_transfer_date ? new Date(body.pengajuan_transfer_date) : null) : undefined,
      dealingDate:          body.dealing_date          !== undefined ? (body.dealing_date ? new Date(body.dealing_date) : null) : undefined,
      nik:                  body.nik                   !== undefined ? (body.nik ?? null)            : undefined,
      priceRate:            body.price_rate            !== undefined ? (body.price_rate ? parseFloat(body.price_rate) : null)           : undefined,
      firstRateCard:        body.first_rate_card       !== undefined ? (body.first_rate_card ? parseFloat(body.first_rate_card) : null) : undefined,
      slotFinal:            body.slot_final            !== undefined ? (body.slot_final ? parseInt(body.slot_final) : null)             : undefined,
      rateFinal:            body.rate_final            !== undefined ? (body.rate_final ? parseFloat(body.rate_final) : null)           : undefined,
      taxPercentage:        body.tax_percentage        !== undefined ? (body.tax_percentage ? parseFloat(body.tax_percentage) : null)   : undefined,
      scopeOfWork:          body.scope_of_work         !== undefined ? (body.scope_of_work ?? null)  : undefined,
      masaKerjasama:        body.masa_kerjasama        !== undefined ? (body.masa_kerjasama ?? null) : undefined,
      platform:             body.platform              !== undefined ? (body.platform ?? null)       : undefined,
      gdriveKolAccepting:   body.gdrive_kol_accepting  !== undefined ? (body.gdrive_kol_accepting ?? null) : undefined,
    },
  })

  // Update or create ContentCreator if type is CC
  if (body.type === 'Content Creator' && body.cc) {
    await prisma.contentCreator.upsert({
      where: { talentId: parseInt(id) },
      create: {
        talentId: parseInt(id),
        tenantId,
        ...mapCcFields(body.cc),
      },
      update: mapCcFields(body.cc),
    })
  }

  return NextResponse.json({ id: talent.id })
}

function mapCcFields(cc) {
  return {
    objektif:              cc.objektif               ?? null,
    pillar:                cc.pillar                 ?? null,
    subPillar:             cc.sub_pillar             ?? null,
    hook:                  cc.hook                   ?? null,
    referensi:             cc.referensi              ?? null,
    briefKonten:           cc.brief_konten           ?? null,
    caption:               cc.caption                ?? null,
    assigneeContentEditor: cc.assignee_content_editor ?? null,
    bookingTalentDate:     cc.booking_talent_date    ? new Date(cc.booking_talent_date) : null,
    bookingVenueDate:      cc.booking_venue_date     ? new Date(cc.booking_venue_date)  : null,
    productionDate:        cc.production_date        ? new Date(cc.production_date)     : null,
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { count } = await prisma.talent.deleteMany({
    where: { id: parseInt(id), tenantId: session.user.tenantId },
  })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
