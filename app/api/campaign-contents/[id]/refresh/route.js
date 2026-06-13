import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scrapeByChannel } from '@/lib/scrapers'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const contentId = parseInt(id)
  const tenantId = session.user.tenantId

  // Scope by tenant — never trust an id alone.
  const content = await prisma.campaignContent.findFirst({
    where: { id: contentId, tenantId },
  })
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Scrape live stats. Any failure (bad link, blocked page, RapidAPI error) must
  // surface as a clean 502 so the sequential refresh loop can flag this one row
  // and keep going instead of dying.
  let result
  try {
    result = await scrapeByChannel(content.channel, content.link)
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Scrape failed' },
      { status: 502 },
    )
  }

  const rateCard = content.rateCard != null ? Number(content.rateCard) : 0
  const cpm = rateCard > 0 && result.view > 0 ? (rateCard / result.view) * 1000 : null
  // gmv only comes back from platforms that expose it (e.g. Shopee); otherwise
  // keep whatever was already on the row rather than zeroing it out.
  const gmv = result.gmv != null ? result.gmv : content.gmv
  // Promote to FYP past the threshold, but never demote a flag set elsewhere.
  const isFyp = result.view > 10000 ? true : (content.isFyp ?? false)

  const today = new Date(); today.setHours(0, 0, 0, 0)

  // view/like/comment are BigInt columns — convert the scraped Numbers explicitly.
  const view = BigInt(Math.trunc(result.view))
  const like = BigInt(Math.trunc(result.like))
  const comment = BigInt(Math.trunc(result.comment))

  await prisma.$transaction([
    prisma.contentStatistic.upsert({
      where: { contentId_date: { contentId, date: today } },
      update: { view, like, comment, gmv, spend: content.rateCard },
      create: { contentId, date: today, view, like, comment, gmv, spend: content.rateCard },
    }),
    prisma.campaignContent.update({
      where: { id: contentId },
      data: { view, like, comment, cpm, isFyp },
    }),
  ])

  return NextResponse.json({
    view: Number(result.view),
    like: Number(result.like),
    comment: Number(result.comment),
    cpm: cpm != null ? Number(cpm) : null,
    isFyp,
  })
}
