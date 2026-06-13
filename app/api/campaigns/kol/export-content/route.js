import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const startDateParam = searchParams.get('start_date')
  const endDateParam   = searchParams.get('end_date')

  // Build date filters for campaign start/end dates. Scope to this tenant —
  // without tenantId this exported KOL content across ALL tenants.
  const where = { tenantId: session.user.tenantId, campaign: { type: 'kol' } }

  if (startDateParam || endDateParam) {
    where.uploadDate = {}
    if (startDateParam) where.uploadDate.gte = new Date(startDateParam + 'T00:00:00.000Z')
    if (endDateParam)   where.uploadDate.lte = new Date(endDateParam   + 'T23:59:59.999Z')
  }

  const contents = await prisma.campaignContent.findMany({
    where,
    include: { campaign: { select: { title: true, type: true } } },
    orderBy: [{ campaign: { title: 'asc' } }, { username: 'asc' }],
  })

  const rows = contents.map((c, i) => ({
    '#':            i + 1,
    Campaign:       c.campaign?.title ?? '',
    Username:       c.username,
    'Creator Name': c.creatorName ?? '',
    PIC:            c.pic ?? '',
    Task:           c.taskName ?? '',
    Channel:        c.channel ?? '',
    Product:        c.product ?? '',
    'Kode Ads':     c.kodeAds ?? '',
    'Upload Date':  c.uploadDate ? format(c.uploadDate, 'dd MMM yyyy') : '',
    'Rate Card':    Number(c.rateCard ?? 0),
    Views:          Number(c.view ?? 0),
    Likes:          Number(c.like ?? 0),
    Comments:       Number(c.comment ?? 0),
    GMV:            Number(c.gmv ?? 0),
    Followers:      Number(c.kolFollowers ?? 0),
    Tier:           c.tiering ?? '',
    'FYP':          c.isFyp ? 'Yes' : 'No',
    'Delivered':    c.isDelivered ? 'Yes' : 'No',
    'Paid':         c.isPaid ? 'Yes' : 'No',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'KOL Content')

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

  const filename = `kol-content-${startDateParam ?? 'all'}-to-${endDateParam ?? 'all'}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
