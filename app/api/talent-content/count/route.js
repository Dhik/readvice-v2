import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const today    = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [todayCount, doneFalse, doneTrue, total] = await prisma.$transaction([
    prisma.talentContent.count({ where: { talent: { tenantId }, postingDate: { gte: today, lt: tomorrow } } }),
    prisma.talentContent.count({ where: { talent: { tenantId }, done: false } }),
    prisma.talentContent.count({ where: { talent: { tenantId }, done: true, isRefund: false } }),
    prisma.talentContent.count({ where: { talent: { tenantId } } }),
  ])

  return NextResponse.json({
    today_count:      todayCount,
    done_false_count: doneFalse,
    done_true_count:  doneTrue,
    total_count:      total,
  })
}
