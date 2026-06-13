import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date') ?? ''
  const tenantId  = session.user.tenantId

  if (!dateParam) return NextResponse.json({ error: 'date query param required' }, { status: 400 })

  const importDate = new Date(dateParam)
  const formData   = await request.formData()
  const file       = formData.get('file')
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const text   = buffer.toString('utf-8')
  const lines  = text.split('\n').filter(l => l.trim())

  let imported = 0, skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 8) continue

    const [affiliateId, username, channel, orderType, produkTerjual, pesanan, clicks,
           omzetPenjualan, biayaIklan, komisiAffiliate, pembeliBaru] = cols

    if (!username) continue

    const existing = await prisma.affiliateShopee.findFirst({
      where: { tenantId, username, date: importDate, channel: channel || null },
    })

    if (existing) { skipped++; continue }

    try {
      await prisma.affiliateShopee.create({
        data: {
          tenantId,
          date:            importDate,
          affiliateId:     affiliateId || null,
          username,
          channel:         channel  || null,
          orderType:       orderType || null,
          produkTerjual:   parseInt(produkTerjual)   || 0,
          pesanan:         parseInt(pesanan)          || 0,
          clicks:          parseInt(clicks)           || 0,
          omzetPenjualan:  parseFloat(omzetPenjualan) || 0,
          biayaIklan:      parseFloat(biayaIklan)     || 0,
          komisiAffiliate: parseFloat(komisiAffiliate) || 0,
          pembeliBaru:     parseInt(pembeliBaru)       || 0,
        },
      })
      imported++
    } catch { skipped++ }
  }

  return NextResponse.json({ imported, skipped })
}
