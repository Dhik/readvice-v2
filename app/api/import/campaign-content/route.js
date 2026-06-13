import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const campaignId = parseInt(searchParams.get('campaignId') ?? '0')
  const type       = searchParams.get('type') ?? 'creative'

  const formData = await request.formData()
  const file     = formData.get('file')
  const buffer   = Buffer.from(await file.arrayBuffer())
  const wb       = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const rows     = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

  const tenantId = session.user.tenantId
  let created = 0
  const errors = []

  for (const row of rows) {
    try {
      if (type === 'kol') {
        await prisma.keyOpinionLeader.create({
          data: {
            campaignId,
            tenantId,
            name:       row['username']?.toString() ?? row['name']?.toString() ?? '',
            platform:   row['channel']?.toString() ?? null,
            fee:        parseFloat(row['rate_card'] ?? 0) || null,
            contentUrl: row['link']?.toString() ?? null,
            status:     'pending',
          },
        })
      } else {
        await prisma.campaignContent.create({
          data: {
            campaignId,
            title:      row['task_name']?.toString() ?? null,
            platform:   row['channel']?.toString() ?? null,
            contentUrl: row['link']?.toString() ?? null,
          },
        })
      }
      created++
    } catch (e) {
      errors.push({ error: e.message })
    }
  }

  return NextResponse.json({ created, errors })
}
