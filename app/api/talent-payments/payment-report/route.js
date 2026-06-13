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
  const page       = parseInt(searchParams.get('page')   ?? '1')
  const limit      = parseInt(searchParams.get('limit')  ?? '50')
  const username   = searchParams.get('username')   ?? ''
  const talentType = searchParams.get('talentType') ?? ''
  const dateRange  = searchParams.get('dateRange')  ?? ''
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
      ...(username   ? { username }        : {}),
      ...(talentType ? { type: talentType } : {}),
    },
    ...(startDate || endDate ? {
      tanggalPengajuan: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate   ? { lte: endDate   } : {}),
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
      include: { talent: { select: { username: true, talentName: true, pic: true, type: true } } },
    }),
  ])

  const data = payments.map(p => ({
    id:                p.id,
    username:          p.talent.username,
    talent_name:       p.talent.talentName,
    type:              p.talent.type,
    pic:               p.talent.pic ?? '-',
    status_payment:    p.statusPayment,
    done_payment:      fmtDate(p.donePayment),
    tanggal_pengajuan: fmtDate(p.tanggalPengajuan),
    amount_tf:         p.amountTf ? Number(p.amountTf) : null,
  }))

  return NextResponse.json({ data, total, page, limit })
}
