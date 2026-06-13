import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { extractDateFromCreatorListFilename } from '@/lib/affiliate-utils'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const formData = await request.formData()
  const file     = formData.get('file')
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  let importDate
  try {
    importDate = extractDateFromCreatorListFilename(file.name)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const buffer   = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet    = workbook.Sheets[workbook.SheetNames[0]]
  const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  let imported = 0, skipped = 0

  // A=username, B=aff_gmv, C=aff_orders, D=aff_refund_gmv, E=aff_refund_orders,
  // F=product_impression, G=est_commission, H=avg_order_value, I=products_sold,
  // J=estimated_orders, K=impressions, L=video_clicks, M=video_comments,
  // N=video_likes, O=video_shares, P=video_views, Q=aff_followers, R=aff_videos
  for (let i = 1; i < rows.length; i++) {
    const r        = rows[i]
    const username = String(r[0] || '').trim()
    if (!username) continue

    const data = {
      tenantId,
      date:                   importDate,
      creatorUsername:        username,
      affiliateGmv:           parseFloat(r[1])  || 0,
      affiliateOrders:        parseFloat(r[2])  || 0,
      affiliateRefundedGmv:   parseFloat(r[3])  || 0,
      affiliateRefundedOrders: parseFloat(r[4]) || 0,
      productImpression:      BigInt(parseInt(r[5])  || 0),
      estCommission:          parseFloat(r[6])  || 0,
      avgOrderValue:          parseFloat(r[7])  || 0,
      productsSold:           parseInt(r[8])    || 0,
      estimatedOrders:        parseFloat(r[9])  || 0,
      impressions:            BigInt(parseInt(r[10]) || 0),
      videoClicks:            parseInt(r[11])   || 0,
      videoComments:          parseInt(r[12])   || 0,
      videoLikes:             parseInt(r[13])   || 0,
      videoShares:            parseInt(r[14])   || 0,
      videoViews:             BigInt(parseInt(r[15]) || 0),
      affiliateFollowers:     parseInt(r[16])   || 0,
      affiliateVideos:        parseInt(r[17])   || 0,
    }

    const existing = await prisma.affiliateTiktok.findFirst({
      where: { tenantId, creatorUsername: username, date: importDate },
    })

    try {
      if (existing) {
        await prisma.affiliateTiktok.update({ where: { id: existing.id }, data })
      } else {
        await prisma.affiliateTiktok.create({ data })
      }
      imported++
    } catch { skipped++ }
  }

  return NextResponse.json({ imported, skipped })
}
