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
      const date     = row['date'] ? new Date(row['date']) : null
      const type     = row['type']?.toString()?.trim()
      const category = row['marketing_category']?.toString()?.trim()
      if (!date || !type || !category) continue

      await prisma.marketingExpense.create({
        data: {
          tenantId,
          date,
          type,
          marketingCategory: category,
          subCategory:       row['sub_category']?.toString() ?? null,
          amount:            parseFloat(row['amount'] ?? 0) || 0,
        },
      })
      created++
    } catch (e) {
      errors.push({ error: e.message })
    }
  }

  return NextResponse.json({ created, errors })
}
