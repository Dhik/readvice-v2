import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcTax } from '@/lib/talent-finance'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const username   = searchParams.get('username')    ?? ''
  const talentType = searchParams.get('talentType')  ?? ''
  const dateRange  = searchParams.get('dateRange')   ?? ''
  const tenantId   = session.user.tenantId

  let startDate, endDate
  if (dateRange) {
    const [s, e] = dateRange.split(' - ')
    if (s) startDate = new Date(s)
    if (e) endDate   = new Date(e)
  }

  const talentWhere = {
    tenantId,
    ...(username   ? { username }   : {}),
    ...(talentType ? { type: talentType } : {}),
  }

  const talents = await prisma.talent.findMany({
    where:   talentWhere,
    include: { payments: {
      where: startDate || endDate ? {
        tanggalPengajuan: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate   ? { lte: endDate   } : {}),
        }
      } : {},
    }},
  })

  let totalSpent   = 0
  let totalHutang  = 0
  let totalPiutang = 0

  for (const t of talents) {
    const taxDed    = calcTax(t.rateFinal, t.namaRekening, t.taxPercentage)
    const shouldGet = Number(t.rateFinal ?? 0) - taxDed
    const totalPaid = t.payments.reduce((s, p) => s + Number(p.amountTf ?? 0), 0)
    totalSpent   += totalPaid
    totalHutang  += Math.max(0, shouldGet - totalPaid)
    totalPiutang += Math.max(0, totalPaid - shouldGet)
  }

  return NextResponse.json({
    totals: {
      total_spent:   totalSpent,
      total_hutang:  totalHutang,
      total_piutang: totalPiutang,
    },
  })
}
