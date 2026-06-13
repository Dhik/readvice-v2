import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcTax } from '@/lib/talent-finance'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const username   = searchParams.get('username')   ?? ''
  const talentType = searchParams.get('talentType') ?? ''
  const dateRange  = searchParams.get('dateRange')  ?? ''
  const page       = parseInt(searchParams.get('page')  ?? '1')
  const limit      = parseInt(searchParams.get('limit') ?? '50')
  const tenantId   = session.user.tenantId

  let startDate, endDate
  if (dateRange) {
    const [s, e] = dateRange.split(' - ')
    if (s) startDate = new Date(s)
    if (e) endDate   = new Date(e)
  }

  const talentWhere = {
    tenantId,
    ...(username   ? { username }        : {}),
    ...(talentType ? { type: talentType } : {}),
  }

  const paymentWhere = startDate || endDate ? {
    tanggalPengajuan: {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate   ? { lte: endDate   } : {}),
    }
  } : {}

  const [total, talents] = await prisma.$transaction([
    prisma.talent.count({ where: talentWhere }),
    prisma.talent.findMany({
      where:   talentWhere,
      include: { payments: { where: paymentWhere } },
      orderBy: { username: 'asc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ])

  const data = talents.map(t => {
    const taxDed    = calcTax(t.rateFinal, t.namaRekening, t.taxPercentage)
    const shouldGet = Number(t.rateFinal ?? 0) - taxDed
    const totalPaid = t.payments.reduce((s, p) => s + Number(p.amountTf ?? 0), 0)
    return {
      username:          t.username,
      talent_name:       t.talentName,
      total_spent:       totalPaid,
      talent_should_get: shouldGet,
      hutang:            Math.max(0, shouldGet - totalPaid),
      piutang:           Math.max(0, totalPaid - shouldGet),
    }
  })

  return NextResponse.json({ data, total, page, limit })
}
