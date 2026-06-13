// Seeds the 12 order_sync DataConnector rows (Cleora ×6, Azrina ×4, Delmoura ×2)
// from docs/SALES_GSHEET_CONFIG.md Section B column maps + SHEET_ORDERS_DEFAULT.
// Idempotent: upserts by (tenantId, name). sheetTab is a 'Sheet1' placeholder,
// editable later via the CS2 UI. salesChannelId is captured in staticValues
// (Order has no such column yet — persisted in a later sync-engine phase).
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ── Column maps (0-based) derived from Section B ──────────────────────────────
const shopeeMap = (shopee3 = false) => ({
  orderId:          { sheetColumn: 0,  transform: 'string'    },
  orderDate:        { sheetColumn: 3,  transform: 'date_auto' },
  gmv:              { sheetColumn: 14, transform: 'currency'  },
  nett:             shopee3 ? { sheetColumn: 16, transform: 'currency' }
                            : { sheetColumn: 14, transform: 'currency', addColumn: 15 },
  qty:              { sheetColumn: 12, transform: 'int'    },
  status:           { sheetColumn: 17, transform: 'string' },
  customerName:     { sheetColumn: 7,  transform: 'string' },
  customerUsername: { sheetColumn: 6,  transform: 'string' },
})

// TikTok + Tokopedia share the same indices.
const tiktokMap = () => ({
  orderId:          { sheetColumn: 0,  transform: 'string'   },
  orderDate:        { sheetColumn: 6,  transform: 'date_dmy' },
  gmv:              { sheetColumn: 5,  transform: 'currency' },
  nett:             { sheetColumn: 18, transform: 'currency' },
  qty:              { sheetColumn: 4,  transform: 'int'    },
  status:           { sheetColumn: 13, transform: 'string' },
  customerName:     { sheetColumn: 8,  transform: 'string' },
  customerUsername: { sheetColumn: 7,  transform: 'string' },
})

const lazadaMap = () => ({
  orderId:          { sheetColumn: 0,  transform: 'string'    },
  orderDate:        { sheetColumn: 3,  transform: 'date_auto' },
  gmv:              { sheetColumn: 8,  transform: 'currency'  },
  nett:             { sheetColumn: 8,  transform: 'currency'  },
  qty:              { transform: 'static', value: 1 },
  status:           { sheetColumn: 14, transform: 'string' },
  customerName:     { sheetColumn: 9,  transform: 'string' },
  customerUsername: { sheetColumn: 9,  transform: 'string' },
})

// ── 12 connector definitions ──────────────────────────────────────────────────
const CONNECTORS = [
  // Cleora ×6
  { slug: 'cleora-beauty', name: 'cleora-shopee',    platform: 'shopee',    channel: 1, range: 'A2:R', map: shopeeMap()     },
  { slug: 'cleora-beauty', name: 'cleora-shopee-2',  platform: 'shopee',    channel: 8, range: 'A2:R', map: shopeeMap()     },
  { slug: 'cleora-beauty', name: 'cleora-shopee-3',  platform: 'shopee',    channel: 9, range: 'A2:R', map: shopeeMap(true) },
  { slug: 'cleora-beauty', name: 'cleora-tiktok',    platform: 'tiktok',    channel: 4, range: 'A2:S', map: tiktokMap()     },
  { slug: 'cleora-beauty', name: 'cleora-tokopedia', platform: 'tokopedia', channel: 3, range: 'A2:S', map: tiktokMap()     },
  { slug: 'cleora-beauty', name: 'cleora-lazada',    platform: 'lazada',    channel: 2, range: 'A2:Q', map: lazadaMap()     },
  // Azrina ×4
  { slug: 'azrina-beauty', name: 'azrina-shopee',    platform: 'shopee',    channel: 1, range: 'A2:R', map: shopeeMap()     },
  { slug: 'azrina-beauty', name: 'azrina-tiktok',    platform: 'tiktok',    channel: 4, range: 'A2:S', map: tiktokMap()     },
  { slug: 'azrina-beauty', name: 'azrina-tokopedia', platform: 'tokopedia', channel: 3, range: 'A2:S', map: tiktokMap()     },
  { slug: 'azrina-beauty', name: 'azrina-lazada',    platform: 'lazada',    channel: 2, range: 'A2:Q', map: lazadaMap()     },
  // Delmoura ×2
  { slug: 'delmoura',      name: 'delmoura-shopee',  platform: 'shopee',    channel: 1, range: 'A2:R', map: shopeeMap()     },
  { slug: 'delmoura',      name: 'delmoura-tiktok',  platform: 'tiktok',    channel: 4, range: 'A2:S', map: tiktokMap()     },
]

async function main() {
  const spreadsheetId = process.env.SHEET_ORDERS_DEFAULT
  if (!spreadsheetId) {
    console.error('FAILED: SHEET_ORDERS_DEFAULT is not set in the environment.')
    process.exit(1)
  }

  // Resolve tenants by slug once.
  const slugs = [...new Set(CONNECTORS.map(c => c.slug))]
  const tenants = {}
  for (const slug of slugs) {
    const t = await prisma.tenant.findFirst({ where: { slug }, select: { id: true } })
    if (!t) { console.error(`FAILED: tenant slug "${slug}" not found.`); process.exit(1) }
    tenants[slug] = t.id
  }

  let created = 0, updated = 0
  for (const c of CONNECTORS) {
    const tenantId = tenants[c.slug]
    const data = {
      connectorType: 'order_sync',
      spreadsheetId,
      sheetTab:      'Sheet1',
      dataRange:     c.range,
      targetTable:   'Order',
      upsertKey:     ['orderId', 'tenantId'],
      columnMapping: c.map,
      staticValues:  { platform: c.platform, salesChannelId: c.channel },
      isActive:      true,
    }

    const existing = await prisma.dataConnector.findUnique({
      where:  { tenantId_name: { tenantId, name: c.name } },
      select: { id: true },
    })
    await prisma.dataConnector.upsert({
      where:  { tenantId_name: { tenantId, name: c.name } },
      update: data,
      create: { tenantId, name: c.name, ...data },
    })
    if (existing) { updated++; console.log(`  ~ updated  ${c.name} (tenant ${tenantId}, ch ${c.channel})`) }
    else          { created++; console.log(`  + created  ${c.name} (tenant ${tenantId}, ch ${c.channel})`) }
  }

  console.log(`\nSeeded ${CONNECTORS.length} order_sync connectors — ${created} created, ${updated} updated.`)
}

main()
  .catch(e => { console.error('SEED FAILED:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
