import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      const username = row['username']?.toString()?.trim()
      if (!username) continue

      await prisma.talent.upsert({
        where:  { username },
        update: {
          tenantId,
          talentName:    row['talent_name']?.toString() ?? null,
          videoSlot:     parseInt(row['video_slot']) || null,
          contentType:   row['content_type']?.toString() ?? null,
          product:       row['product']?.toString() ?? null,
          rateFinal:     parseFloat(row['rate_final']) || null,
          pic:           row['pic']?.toString() ?? null,
          monthRunning:  row['month_running']?.toString() ?? null,
          niche:         row['niche']?.toString() ?? null,
          followers:     parseInt(row['followers']) || null,
          address:       row['address']?.toString() ?? null,
          phone:         row['phone']?.toString() ?? null,
          bank:          row['bank']?.toString() ?? null,
          accountNumber: row['account_number']?.toString() ?? null,
          accountHolder: row['account_holder']?.toString() ?? null,
          npwp:          row['npwp']?.toString() ?? null,
          nik:           row['nik']?.toString() ?? null,
          priceRate:     parseFloat(row['price_rate']) || null,
          firstRateCard: parseFloat(row['first_rate_card']) || null,
          discount:      parseFloat(row['discount']) || null,
          slotFinal:     parseInt(row['slot_final']) || null,
          taxDeduction:  parseFloat(row['tax_deduction']) || null,
        },
        create: {
          username,
          tenantId,
          talentName:    row['talent_name']?.toString() ?? null,
          videoSlot:     parseInt(row['video_slot']) || null,
          contentType:   row['content_type']?.toString() ?? null,
          product:       row['product']?.toString() ?? null,
          rateFinal:     parseFloat(row['rate_final']) || null,
          pic:           row['pic']?.toString() ?? null,
          monthRunning:  row['month_running']?.toString() ?? null,
          niche:         row['niche']?.toString() ?? null,
          followers:     parseInt(row['followers']) || null,
        },
      })
      created++
    } catch (e) {
      errors.push({ error: e.message })
    }
  }

  return NextResponse.json({ created, errors })
}
