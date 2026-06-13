import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenantId = session.user.tenantId

  const campaigns = await prisma.campaign.findMany({
    where: { tenantId },
    include: { contents: true },
  })

  let processed = 0
  for (const campaign of campaigns) {
    const agg = campaign.contents.reduce((acc, c) => ({
      view:         acc.view    + Number(c.view ?? 0),
      like:         acc.like    + Number(c.like ?? 0),
      comment:      acc.comment + Number(c.comment ?? 0),
      gmv:          acc.gmv     + Number(c.gmv ?? 0),
      totalExpense: acc.totalExpense + Number(c.rateCard ?? 0),
    }), { view: 0, like: 0, comment: 0, gmv: 0, totalExpense: 0 })

    const cpm = agg.view > 0 ? agg.totalExpense / (agg.view / 1000) : 0
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        view: agg.view, like: agg.like, comment: agg.comment,
        gmv: agg.gmv, totalExpense: agg.totalExpense,
        cpm: Math.round(cpm * 100) / 100,
      },
    })
    processed++
  }
  return NextResponse.json({ message: 'success', processed })
}
