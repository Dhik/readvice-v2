import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function fmtDate(d) {
  if (!d) return null
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page          = parseInt(searchParams.get('page')   ?? '1')
  const limit         = parseInt(searchParams.get('limit')  ?? '50')
  const pic           = searchParams.get('pic')             ?? ''
  const type          = searchParams.get('type')            ?? ''
  const statusPayment = searchParams.get('status_payment')  ?? ''
  const username      = searchParams.get('username')        ?? ''
  const doneFrom      = searchParams.get('done_payment_start')
  const doneTo        = searchParams.get('done_payment_end')
  const pengFrom      = searchParams.get('tanggal_pengajuan_start')
  const pengTo        = searchParams.get('tanggal_pengajuan_end')
  const tenantId      = session.user.tenantId

  const where = {
    talent: {
      tenantId,
      ...(pic      ? { pic: { contains: pic, mode: 'insensitive' } }      : {}),
      ...(type     ? { type }                                               : {}),
      ...(username ? { username: { contains: username, mode: 'insensitive' } } : {}),
    },
    ...(statusPayment ? { statusPayment }                              : {}),
    ...(doneFrom || doneTo ? {
      donePayment: {
        ...(doneFrom ? { gte: new Date(doneFrom) } : {}),
        ...(doneTo   ? { lte: new Date(doneTo)   } : {}),
      }
    } : {}),
    ...(pengFrom || pengTo ? {
      tanggalPengajuan: {
        ...(pengFrom ? { gte: new Date(pengFrom) } : {}),
        ...(pengTo   ? { lte: new Date(pengTo)   } : {}),
      }
    } : {}),
  }

  const [total, payments] = await prisma.$transaction([
    prisma.talentPayment.count({ where }),
    prisma.talentPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: {
        talent: { select: { username: true, talentName: true, namaRekening: true, type: true, pic: true, followers: true } },
      },
    }),
  ])

  const data = payments.map(p => ({
    id:                p.id,
    talent_id:         p.talentId,
    username:          p.talent.username,
    talent_name:       p.talent.talentName,
    nama_rekening:     p.talent.namaRekening ?? '-',
    type:              p.talent.type,
    pic:               p.talent.pic          ?? '-',
    followers:         p.talent.followers    ?? 0,
    status_payment:    p.statusPayment,
    done_payment:      fmtDate(p.donePayment),
    tanggal_pengajuan: fmtDate(p.tanggalPengajuan),
    amount_tf:         p.amountTf ? Number(p.amountTf) : null,
  }))

  return NextResponse.json({ data, total, page, limit })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const talentId = parseInt(body.talent_id)

  // Fetch the talent (tenant-scoped) to know rateFinal
  const talent = await prisma.talent.findFirst({
    where: { id: talentId, tenantId: session.user.tenantId },
  })
  if (!talent) return NextResponse.json({ error: 'Talent not found' }, { status: 404 })

  const payment = await prisma.talentPayment.create({
    data: {
      talentId,
      statusPayment:    body.status_payment,
      tanggalPengajuan: body.tanggal_pengajuan ? new Date(body.tanggal_pengajuan) : null,
    },
  })

  // Update dpAmount on talent based on payment type
  let dpAmount = null
  if (body.status_payment === 'DP 50%')       dpAmount = Number(talent.rateFinal ?? 0) * 0.5
  if (body.status_payment === 'Full Payment')  dpAmount = Number(talent.rateFinal ?? 0)
  if (dpAmount !== null) {
    await prisma.talent.update({ where: { id: talentId }, data: { dpAmount } })
  }

  return NextResponse.json({ id: payment.id }, { status: 201 })
}
