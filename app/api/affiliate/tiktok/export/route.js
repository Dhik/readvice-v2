import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const spreadsheetId = process.env.TIKTOK_AFFILIATE_SHEET_ID
  if (!spreadsheetId) {
    return NextResponse.json({ error: 'TIKTOK_AFFILIATE_SHEET_ID not configured', sheetUrl: null }, { status: 501 })
  }

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''
  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    ...(dateFrom && dateTo ? { date: { gte: new Date(dateFrom), lte: new Date(dateTo) } } : {}),
  }

  const rows = await prisma.affiliateTiktok.findMany({
    where, orderBy: [{ date: 'asc' }, { creatorUsername: 'asc' }],
  })

  try {
    const { google } = await import('googleapis')
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}')
    const auth  = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() })
    const values = [
      ['Date','Creator','GMV','Orders','Refund GMV','Commission','Avg Order','Products Sold','Est Orders','Impressions','Video Views','Followers','Videos'],
      ...rows.map(r => [
        r.date.toISOString().slice(0,10), r.creatorUsername,
        Number(r.affiliateGmv ?? 0), Number(r.affiliateOrders ?? 0),
        Number(r.affiliateRefundedGmv ?? 0), Number(r.estCommission ?? 0),
        Number(r.avgOrderValue ?? 0), r.productsSold ?? 0,
        Number(r.estimatedOrders ?? 0), Number(r.impressions ?? 0),
        Number(r.videoViews ?? 0), r.affiliateFollowers ?? 0, r.affiliateVideos ?? 0,
      ]),
    ]
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: 'Sheet1!A1', valueInputOption: 'RAW',
      requestBody: { values },
    })
    return NextResponse.json({ sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` })
  } catch (e) {
    return NextResponse.json({ error: 'Google Sheets export failed: ' + e.message }, { status: 500 })
  }
}
