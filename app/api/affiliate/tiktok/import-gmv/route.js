import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { extractVideoCode } from '@/lib/affiliate-utils'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const formData = await request.formData()
  const file     = formData.get('file')
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const buffer   = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet    = workbook.Sheets[workbook.SheetNames[0]]
  const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  let matched = 0, notFound = 0
  const errors = []

  // B=video_link(1), C=posting_date(2), D=username(3), E=gmv(4)
  for (let i = 1; i < rows.length; i++) {
    const r           = rows[i]
    const link        = String(r[1] || '').trim()
    const postingDate = r[2] ? new Date(r[2]) : null
    const username    = String(r[3] || '').trim()
    const gmv         = parseFloat(r[4]) || 0

    if (!link) continue

    try {
      const videoCode = extractVideoCode(link)
      const content   = videoCode ? await prisma.campaignContent.findFirst({
        where: { tenantId, link: { contains: videoCode } },
      }) : null

      if (content) {
        await prisma.contentStatistic.upsert({
          where: { contentId_date: { contentId: content.id, date: postingDate ?? new Date() } },
          update: { gmv },
          create: { contentId: content.id, date: postingDate ?? new Date(), gmv },
        })
        matched++
      } else {
        await prisma.affiliateGmvTiktok.create({
          data: { tenantId, username, link, postingDate, gmv, linkNotFound: true },
        })
        notFound++
      }
    } catch (e) {
      errors.push({ row: i + 1, error: e.message })
    }
  }

  return NextResponse.json({ matched, notFound, errors })
}
