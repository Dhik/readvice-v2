import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Modal channel labels → Campaign scraper's expected casing.
// Instagram Story has no scraper; it passes through unchanged (won't be stat-matched).
const CHANNEL_NORMALIZE = {
  'Instagram Feed':  'Instagram feed',
  'Tiktok Video':    'TikTok video',
  'Twitter Post':    'twitter post',
  'Shopee Video':    'shopee video',
  'Instagram Story': 'Instagram Story',
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id }   = await params
  const body     = await request.json()
  const tenantId = session.user.tenantId
  const contentId = parseInt(id)

  // Tenant-verify via the parent talent
  const tc = await prisma.talentContent.findFirst({
    where:   { id: contentId, talent: { tenantId } },
    include: { talent: true },
  })
  if (!tc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const uploadLink  = body.upload_link ?? null
  const postingDate = body.posting_date ? new Date(body.posting_date) : tc.postingDate
  const channelNorm = CHANNEL_NORMALIZE[body.channel] ?? body.channel ?? null

  const talent     = tc.talent
  const rateCard   = tc.finalRateCard != null
    ? Number(tc.finalRateCard)
    : (talent.rateFinal != null && talent.slotFinal
        ? Number(talent.rateFinal) / talent.slotFinal
        : null)
  const followers  = talent.followers ?? null

  await prisma.$transaction(async (tx) => {
    // 1) Always update the TalentContent record
    await tx.talentContent.update({
      where: { id: contentId },
      data: {
        done:        true,
        postingDate,
        uploadLink,
        picCode:     body.kode_ads ?? tc.picCode,
      },
    })

    // 2) Bridge to the Campaign module — only when linked to a campaign
    //    (CampaignContent.campaignId and KeyOpinionLeader.campaignId are required).
    if (!tc.campaignId) return

    const campaignId = tc.campaignId
    const kolName    = talent.talentName || talent.username

    // Upsert KeyOpinionLeader keyed by (campaignId, name) — mirrors campaign-import/kol-content
    const kolData = {
      campaignId, tenantId,
      name:       kolName,
      platform:   channelNorm,
      contentUrl: uploadLink,
      fee:        rateCard,
      followers,
    }
    const kol = await tx.keyOpinionLeader.findFirst({ where: { campaignId, name: kolName } })
    if (kol) await tx.keyOpinionLeader.update({ where: { id: kol.id }, data: kolData })
    else     await tx.keyOpinionLeader.create({ data: kolData })

    // Upsert CampaignContent keyed by (campaignId, link) — mirrors campaign-import/kol-content
    const contentData = {
      campaignId, tenantId,
      username:     talent.username,
      creatorName:  talent.talentName,
      pic:          talent.pic,
      taskName:     body.task_name ?? null,
      channel:      channelNorm,
      link:         uploadLink,
      product:      talent.produk,
      kodeAds:      body.kode_ads ?? null,
      rateCard,
      kolFollowers: followers != null ? BigInt(followers) : 0n,
      uploadDate:   postingDate,
    }
    const existing = await tx.campaignContent.findFirst({ where: { campaignId, link: uploadLink } })
    if (existing) await tx.campaignContent.update({ where: { id: existing.id }, data: contentData })
    else          await tx.campaignContent.create({ data: contentData })
  })

  return NextResponse.json({ ok: true })
}
