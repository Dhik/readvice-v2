import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BASELINE = new Date('2025-07-24')

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const where    = { tenantId, createdAt: { gte: BASELINE } }

  const talents  = await prisma.talent.count({ where })
  const dpAgg    = await prisma.talent.aggregate({ where, _sum: { dpAmount: true } })
  const rateAgg  = await prisma.talent.aggregate({ where, _sum: { rateFinal: true } })
  const slotAgg  = await prisma.talent.aggregate({ where, _sum: { slotFinal: true } })
  const uploaded = await prisma.talentContent.count({
    where: { done: true, isRefund: false, talent: { tenantId, createdAt: { gte: BASELINE } } },
  })

  return NextResponse.json({
    total_talents:    talents,
    total_dp_amount:  Number(dpAgg._sum.dpAmount   ?? 0),
    total_rate_final: Number(rateAgg._sum.rateFinal ?? 0),
    total_slot_final: slotAgg._sum.slotFinal        ?? 0,
    actual_uploaded:  uploaded,
  })
}
