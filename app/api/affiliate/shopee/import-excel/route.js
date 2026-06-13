import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { extractDateFromAmsFilename } from '@/lib/affiliate-utils'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const formData = await request.formData()
  const file     = formData.get('file')
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  let importDate
  try {
    importDate = extractDateFromAmsFilename(file.name)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const buffer   = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames.find(n => n === 'By Channel')
  if (!sheetName) return NextResponse.json({ error: 'Sheet "By Channel" not found' }, { status: 400 })

  const sheet = workbook.Sheets[sheetName]
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  let created = 0, updated = 0

  for (let i = 2; i < rows.length; i++) {
    const r        = rows[i]
    const username = String(r[4] || '').trim()
    if (!username) continue

    // D=nama(3), E=username(4), F=channel(5), G=order_type(6), H=produk_terjual(7),
    // I=pesanan(8), K=omzet_penjualan(10), M=komisi_affiliate(12), N=roi(13),
    // O=total_pembeli(14), P=pembeli_baru(15)
    const channel         = String(r[5]  || '').trim() || null
    const orderType       = String(r[6]  || '').trim() || null
    const produkTerjual   = parseInt(r[7])    || 0
    const pesanan         = parseInt(r[8])    || 0
    const omzetPenjualan  = parseFloat(r[10]) || 0
    const komisiAffiliate = parseFloat(r[12]) || 0
    const roi             = parseFloat(r[13]) || 0
    const totalPembeli    = parseInt(r[14])   || 0
    const pembeliBaru     = parseInt(r[15])   || 0

    const existing = await prisma.affiliateShopee.findFirst({
      where: { tenantId, username, date: importDate, channel, omzetPenjualan },
    })

    if (existing) {
      await prisma.affiliateShopee.update({ where: { id: existing.id }, data: { orderType } })
      updated++
    } else {
      try {
        await prisma.affiliateShopee.create({
          data: { tenantId, date: importDate, username, channel, orderType,
                  produkTerjual, pesanan, omzetPenjualan, komisiAffiliate,
                  roi, totalPembeli, pembeliBaru },
        })
        created++
      } catch { updated++ }
    }
  }

  return NextResponse.json({ created, updated })
}
