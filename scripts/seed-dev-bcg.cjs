// DEV-ONLY seeder for the BCG Product Matrix (BcgProduct). Tenant 2 ONLY.
// Builds ~3 months of per-SKU rows (1st-of-month dates) from that tenant's REAL
// OrderItem⋈Product data, then layers DUMMY fields on top.
//
// CRITICAL HONESTY: the row as a whole is flagged source='DUMMY' even though
// some fields are real — because the matrix AXES (visitor, ctr) are fabricated,
// so the quadrant a SKU lands in is FICTIONAL. See docs/BCG_DATA_SOURCES.md.
//
//   REAL  (from data):  sku, namaProduk(Product.name), qtySold+sales(OrderItem),
//                       harga(Product.price), stock(Product.stock)
//   SEMI  (from data):  jumlahPembeli ≈ distinct orders for the SKU/month
//   DUMMY (fabricated):  visitor, jumlahAtc, biayaAds, omsetPenjualan, ctr
//
// visitor is sized so conversion = pembeli/visitor lands in a believable 0.5–5%.
// Idempotent: clears this tenant's DUMMY rows first.
require('./_load-env')
const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient()

const TENANT = 2
const MONTHS = 3
// Same exclusion basis as the HPP engine (cancelled/unpaid) so REAL sales/qty
// line up with product-summary / HPP.
const EXCLUDED = ['Batal', 'Belum Bayar', 'pending', 'cancelled', 'Canceled',
  'request_cancel', 'request_return', 'Pembatalan diajukan', 'Dibatalkan Sistem', 'Dibatalkan']

const randInt   = (a, b) => Math.floor(a + Math.random() * (b - a + 1))
const randFloat = (a, b) => a + Math.random() * (b - a)
const round2    = n => Math.round(n * 100) / 100

// First-of-month (UTC) + the following month start (exclusive end), from a YYYY-MM key.
function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number)
  return { mStart: new Date(Date.UTC(y, m - 1, 1)), mEnd: new Date(Date.UTC(y, m, 1)) }
}

;(async () => {
  try {
    // Pick the N most-recent months that actually have SKU-level data (OrderItem
    // rows). The matrix is per-SKU and REAL sales/qty must come from OrderItem, so a
    // month with orders but NO line items can't produce honest rows. (Tenant 2 today:
    // only 2026-06 has OrderItems — Jan/Feb orders carry no line items — so this seeds
    // 1 month, not 3. As more OrderItem data lands, it auto-extends to MONTHS.)
    const monthRows = await prisma.$queryRaw(Prisma.sql`
      SELECT to_char(o.order_date, 'YYYY-MM') AS ym, COUNT(oi.id)::int AS items
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE o.tenant_id = ${TENANT} AND oi.sku IS NOT NULL
      GROUP BY 1 ORDER BY 1 DESC LIMIT ${MONTHS}`)
    if (!monthRows.length) { console.log(`No SKU-level (OrderItem) data for tenant ${TENANT} — nothing to seed.`); return }
    const targetMonths = monthRows.map(r => r.ym).reverse() // oldest → newest

    // Idempotent: wipe this tenant's DUMMY rows first.
    const del = await prisma.bcgProduct.deleteMany({ where: { tenantId: TENANT, source: 'DUMMY' } })
    console.log(`Cleared existing DUMMY BcgProduct → ${del.count}`)
    console.log(`Seeding months (most recent ${MONTHS} with data): ${targetMonths.join(', ')}`)

    // Catalog snapshot (REAL harga + stock + name) keyed by sku.
    const products = await prisma.product.findMany({
      where: { tenantId: TENANT }, select: { sku: true, name: true, price: true, stock: true },
    })
    const catalog = new Map(products.filter(p => p.sku).map(p => [String(p.sku).trim(), p]))

    const allRows = []
    let realSalesTotal = 0
    const monthCounts = []

    for (const ym of targetMonths) {
      const { mStart, mEnd } = monthBounds(ym)

      // REAL per-SKU aggregate for this month: qty, sales(subtotal), distinct orders.
      // Tenant-scoped; excludes cancelled/unpaid. Raw sku grouping (matches SP1/HPP basis).
      const agg = await prisma.$queryRaw(Prisma.sql`
        SELECT oi.sku                                 AS sku,
               COALESCE(MAX(p.name), MAX(oi.product_name)) AS name,
               SUM(oi.qty)::int                       AS qty_sold,
               SUM(oi.subtotal)                       AS sales,
               COUNT(DISTINCT oi.order_id)::int       AS buyers
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.sku = oi.sku AND p.tenant_id = o.tenant_id
        WHERE o.tenant_id = ${TENANT}
          AND o.order_date >= ${mStart} AND o.order_date < ${mEnd}
          AND o.status NOT IN (${Prisma.join(EXCLUDED)})
          AND oi.sku IS NOT NULL
        GROUP BY oi.sku
        ORDER BY sales DESC NULLS LAST`)

      monthCounts.push({ month: mStart.toISOString().slice(0, 7), skus: agg.length })

      for (const r of agg) {
        const sku      = String(r.sku).trim()
        const qtySold  = Number(r.qty_sold ?? 0)
        const sales    = Number(r.sales ?? 0)             // REAL
        const buyers   = Number(r.buyers ?? 0)            // SEMI-real (distinct orders)
        const cat      = catalog.get(sku)
        const harga    = cat?.price != null ? Math.round(Number(cat.price)) : 0      // REAL
        const stock    = cat?.stock != null ? Number(cat.stock) : 0                  // REAL
        const namaProduk = (cat?.name ?? r.name ?? sku)                              // REAL

        realSalesTotal += sales

        // ── DUMMY fields ────────────────────────────────────────────────────────
        // conversion (pembeli/visitor) target ∈ [0.5%, 5%] → derive visitor from buyers.
        const convPct  = randFloat(0.5, 5)
        const visitor  = buyers > 0 ? Math.max(buyers, Math.round(buyers / (convPct / 100)))
                                    : randInt(200, 3000)
        // atc sits between buyers and visitor.
        const jumlahAtc = Math.min(visitor, buyers + Math.round((visitor - buyers) * randFloat(0.2, 0.6)))
        // ads sized so ROAS = omset/ads ∈ [1, 4]; omset anchored to real sales.
        const roas     = randFloat(1, 4)
        const omset    = sales > 0 ? Math.round(sales * randFloat(0.85, 1.15)) : randInt(100000, 5000000)
        const biayaAds = Math.max(1, Math.round(omset / roas))
        const ctr      = round2(randFloat(0.5, 3))         // %

        allRows.push({
          tenantId: TENANT,
          date: mStart,
          kodeProduk: sku,            // no parent code in new app → use sku
          namaProduk,
          sku,
          visitor,
          jumlahAtc,
          jumlahPembeli: buyers,
          qtySold,
          sales: BigInt(Math.round(sales)),
          stock,
          harga,
          biayaAds,
          omsetPenjualan: omset,
          ctr,
          strategyNotes: null,
          actionItems: null,
          source: 'DUMMY',
        })
      }
    }

    if (!allRows.length) { console.log('No SKU sales found in the window — nothing seeded.'); return }

    // Single bulk insert (createMany = one statement; safe with connection_limit=1).
    await prisma.bcgProduct.createMany({ data: allRows })

    console.log(`\nSeeded tenant ${TENANT}: ${allRows.length} BcgProduct rows across ${monthCounts.length} month(s)`)
    for (const m of monthCounts) console.log(`  ${m.month}: ${m.skus} SKUs`)
    console.log(`  REAL sales total (sum across rows): ${realSalesTotal.toLocaleString('id-ID')}`)
    console.log(`  All rows source='DUMMY' (axes visitor/ctr fabricated → positions fictional)`)
  } catch (e) {
    console.error('SEED FAILED:', e.message)
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
})()
