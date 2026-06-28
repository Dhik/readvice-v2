// BCG product-metrics importer (dummy→real) — the BCG Matrix funnel axes.
// Sheet columns: month | sku | nama_produk | visitor | jumlah_atc | jumlah_pembeli |
//                biaya_ads | omset_penjualan | ctr
// Upserts into `bcg_product` keyed by (tenantId, date, sku), writing the funnel fields and
// flipping source="REAL". The real fields (sales/qty/stock/harga) keep their values on update;
// on create they default to 0 (the BCG generator fills them from OrderItem/Product).
// See docs/DUMMY_TO_REAL_IMPORT.md.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSheetRows, rowsToObjects } from '@/lib/google-sheets'
import { prisma } from '@/lib/prisma'
import { pick, num, monthStart } from '@/lib/import-helpers'
import { NextResponse } from 'next/server'

const SPREADSHEET_ID = process.env.BCG_METRICS_SHEET_ID
const RANGE = 'Sheet1!A:Z'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenantId = session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant in session' }, { status: 400 })
  if (!SPREADSHEET_ID) return NextResponse.json({ error: 'BCG_METRICS_SHEET_ID not configured' }, { status: 500 })

  let rows
  try { rows = rowsToObjects(await getSheetRows(SPREADSHEET_ID, RANGE)) }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 502 }) }

  let imported = 0, skipped = 0
  for (const r of rows) {
    const date = monthStart(pick(r, 'month', 'period', 'date', 'bulan'))
    const sku = String(pick(r, 'sku', 'SKU') ?? '').trim()
    if (!date || !sku) { skipped++; continue }
    const fields = {
      visitor:        Math.round(num(pick(r, 'visitor', 'visitors', 'kunjungan'))),
      jumlahAtc:      Math.round(num(pick(r, 'jumlah_atc', 'atc', 'add_to_cart'))),
      jumlahPembeli:  Math.round(num(pick(r, 'jumlah_pembeli', 'buyers', 'pembeli'))),
      biayaAds:       Math.round(num(pick(r, 'biaya_ads', 'ads', 'ad_spend'))),
      omsetPenjualan: Math.round(num(pick(r, 'omset_penjualan', 'omset', 'ads_revenue'))),
      ctr:            num(pick(r, 'ctr')),
      source: 'REAL',
    }
    const nama = pick(r, 'nama_produk', 'product', 'name')
    try {
      await prisma.bcgProduct.upsert({
        where: { tenantId_date_sku: { tenantId, date, sku } },
        update: { ...fields, ...(nama ? { namaProduk: String(nama) } : {}) },
        create: { tenantId, date, sku, kodeProduk: sku, namaProduk: nama ? String(nama) : sku, ...fields },
      })
      imported++
    } catch { skipped++ }
  }
  return NextResponse.json({ imported, skipped, total: rows.length })
}
