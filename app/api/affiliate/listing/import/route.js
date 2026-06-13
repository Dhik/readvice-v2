import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

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

  let imported = 0, skipped = 0

  // A=date, B=pic, C=username, D=followers, E=gmv, F=kontak, G=sow_category, H=salesChannelId
  for (let i = 1; i < rows.length; i++) {
    const r        = rows[i]
    const username = String(r[2] || '').trim()
    const dateVal  = r[0]
    if (!username || !dateVal) continue

    const date         = new Date(dateVal)
    const pic          = String(r[1] || '').trim() || null
    const followers    = parseInt(r[3]) || 0
    const gmv          = parseFloat(r[4]) || null
    const kontak       = String(r[5] || '').trim() || null
    const sowCategory  = String(r[6] || '').trim() || null
    const salesChannelId = parseInt(r[7]) || null

    const existing = await prisma.listingAffiliate.findFirst({
      where: { tenantId, date, username, pic },
    })
    if (existing) { skipped++; continue }

    try {
      await prisma.listingAffiliate.create({
        data: { tenantId, date, pic, username, followers, gmv, kontak, sowCategory, salesChannelId },
      })
      imported++
    } catch { skipped++ }
  }

  return NextResponse.json({ imported, skipped })
}
