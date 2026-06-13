import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // Verify the campaign belongs to this tenant before exporting its contents.
  const campaign = await prisma.campaign.findFirst({ where: { id: parseInt(id), tenantId: session.user.tenantId } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const contents = await prisma.campaignContent.findMany({
    where: { campaignId: parseInt(id), tenantId: session.user.tenantId },
    orderBy: { createdAt: 'asc' },
  })

  const rows = contents.map(c => {
    const view = Number(c.view ?? 0), like = Number(c.like ?? 0), comment = Number(c.comment ?? 0)
    return {
      'ID': c.id, 'Username': c.username, 'Creator Name': c.creatorName ?? '',
      'PIC': c.pic ?? '', 'Task': c.taskName ?? '', 'Channel': c.channel ?? '', 'Product': c.product ?? '',
      'Ads Code': c.kodeAds ?? '',
      'Upload Date': c.uploadDate ? new Date(c.uploadDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '',
      'Rate Card': Number(c.rateCard ?? 0), 'Views': view, 'Likes': like, 'Comments': comment,
      'CPM': Number(c.cpm ?? 0),
      'ER': view > 0 ? ((like + comment) / view * 100).toFixed(2) + '%' : '0.00%',
      'GMV': Number(c.gmv ?? 0), 'Followers': Number(c.kolFollowers ?? 0), 'Tier': c.tiering ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Contents')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="campaign-${id}-contents.xlsx"`,
    },
  })
}
