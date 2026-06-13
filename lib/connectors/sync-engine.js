// ─── Generic sync engine ─────────────────────────────────────────────────────
// Reads a DataConnector config, fetches its Google Sheet, applies the
// columnMapping transforms, and writes to the target table. Supports:
//   • order_sync   → Order (+ OrderItem) — groups rows by orderId; Order.gmv/nett
//     /qty are SUMS across its lines; OrderItems are replaced per order (NP1).
//   • product_sync → Product — simple per-row upsert (1 sheet row = 1 Product).
// The transform layer is pure (lib/connectors/transforms.js); this module owns
// the I/O (sheet fetch + DB) and the aggregation/write layer.
//
// Note: imported/updated count the TARGET ENTITY (orders / products), not sheet
// rows. A multi-SKU order = several rows = one Order (summed) + several OrderItems.
import { prisma } from '../prisma'
import { getSheetRows } from '../google-sheets'
import { applyTransform, validateColumnMapping, TRANSFORMS } from './transforms'

// ── Order write-layer field sets ─────────────────────────────────────────────
const ORDER_COLUMNS = new Set([
  'orderId', 'orderDate', 'gmv', 'nett', 'qty', 'skuCount',
  'status', 'customerName', 'customerUsername', 'customerId',
  'platform', 'tenantId',
])
const AGGREGATE_FIELDS = new Set(['gmv', 'nett', 'qty', 'skuCount']) // computed, not from header
const HEADER_FIELDS = new Set([...ORDER_COLUMNS].filter(c => !AGGREGATE_FIELDS.has(c)))

// ── Product write-layer field set (NP2a) ─────────────────────────────────────
// Real writable Product columns. Mapped fields outside this set are dropped (the
// sheet's type / combination_sku_* have no Product columns).
const PRODUCT_COLUMNS = new Set([
  'sku', 'name', 'price', 'hargaCogs', 'hargaMarkup', 'hargaBatasBawah',
  'stock', 'platform', 'category', 'tenantId',
])

// Each write is a sequence of SINGLE statements (no interactive transaction), so
// it never holds a connection across awaits — safe with the Supabase pooler's
// connection_limit=1. 5 is conservative (real parallelism is capped at 1 anyway).
const WRITE_CONCURRENCY = 5
const CHUNK_DELAY_MS = 100
const MAX_SAMPLE_ERRORS = 10

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const isEmptyRow = (row) => !Array.isArray(row) || row.every(c => c == null || c === '')
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v))
const pick = (obj, allowed) => {
  const out = {}
  for (const k of Object.keys(obj)) if (allowed.has(k)) out[k] = obj[k]
  return out
}
// Prisma where for an upsert key: scalar form for a single @unique field
// (e.g. { sku: 'X' }), compound form for a composite (e.g. { orderId_tenantId: {...} }).
const buildWhere = (upsertKey, vals) =>
  upsertKey.length === 1
    ? { [upsertKey[0]]: vals[upsertKey[0]] }
    : { [upsertKey.join('_')]: vals }
// Map one sheet row → object: tenantId context, then columnMapping, then staticValues.
const mapRow = (row, connector) => {
  const mapped = { tenantId: connector.tenantId }
  for (const [field, m] of Object.entries(connector.columnMapping)) {
    const raw = m.transform === TRANSFORMS.STATIC ? undefined : row[m.sheetColumn]
    mapped[field] = applyTransform(raw, m, row)
  }
  Object.assign(mapped, connector.staticValues ?? {}) // staticValues precedence
  return mapped
}
const dateFieldsOf = (columnMapping) =>
  Object.entries(columnMapping)
    .filter(([, m]) => m.transform === TRANSFORMS.DATE_AUTO || m.transform === TRANSFORMS.DATE_DMY)
    .map(([f]) => f)

/**
 * Run a connector's sync. Dispatches by connectorType/targetTable.
 * @param {number} connectorId
 * @param {object} [opts]
 * @param {Function} [opts.fetchRows] row fetcher (spreadsheetId, range) → string[][].
 *   Defaults to the real Google Sheets fetch; injectable for tests.
 */
export async function syncConnector(connectorId, { fetchRows = getSheetRows } = {}) {
  const connector = await prisma.dataConnector.findUnique({ where: { id: connectorId } })
  if (!connector) throw new Error('Connector not found')

  const { connectorType, targetTable } = connector
  const isOrder   = connectorType === 'order_sync'   && targetTable === 'Order'
  const isProduct = connectorType === 'product_sync' && targetTable === 'Product'
  if (!isOrder && !isProduct) {
    throw new Error(`Sync supports order_sync→Order or product_sync→Product (got ${connectorType}/${targetTable})`)
  }

  // Defense in depth — CS2 validates on save, but never trust stored config.
  validateColumnMapping(connector.columnMapping)
  const upsertKey = Array.isArray(connector.upsertKey) ? connector.upsertKey : []
  if (upsertKey.length === 0) throw new Error('Connector has no upsertKey')

  // ── Fetch (may throw → propagates to the route as 502; lastSync* untouched) ──
  const range = `${connector.sheetTab}!${connector.dataRange}`
  const rows = await fetchRows(connector.spreadsheetId, range)

  const { persist, ret } = isOrder
    ? await syncOrders(connector, rows, upsertKey)
    : await syncProducts(connector, rows, upsertKey)

  // ── Persist run outcome (only on a completed run, not on fetch failure) ──────
  await prisma.dataConnector.update({
    where: { id: connector.id },
    data:  { lastSyncAt: new Date(), lastSyncResult: persist },
  })
  return ret
}

// ── order_sync → Order (+ OrderItem) — group rows by orderId, dual-write ───────
async function syncOrders(connector, rows, upsertKey) {
  const columnMapping = connector.columnMapping
  const dateFields = dateFieldsOf(columnMapping)
  const sheetKeyFields = upsertKey.filter(k => columnMapping[k])
  const hasItemMapping = 'sku' in columnMapping // OrderItems only when line identity is mapped

  // Phase 1: map every row, group by orderId (across the WHOLE sheet)
  const groups = new Map() // orderId → { header: mappedObj, lines: [...] }
  let skipped = 0
  for (const row of rows) {
    if (isEmptyRow(row)) { skipped++; continue }
    const mapped = mapRow(row, connector)
    if (dateFields.some(f => mapped[f] == null)) { skipped++; continue }
    if (sheetKeyFields.some(f => mapped[f] == null || mapped[f] === '')) { skipped++; continue }
    const oid = mapped.orderId
    if (!groups.has(oid)) groups.set(oid, { header: mapped, lines: [] })
    groups.get(oid).lines.push({
      sku:         mapped.sku ?? null,
      productName: mapped.productName ?? null,
      qty:         mapped.qty ?? null,
      price:       mapped.gmv ?? null,  // line gmv  → OrderItem.price
      subtotal:    mapped.nett ?? null, // line nett → OrderItem.subtotal
    })
  }

  // Phase 2: write groups (Order upsert → OrderItem replace), bounded concurrency
  const groupList = [...groups.values()]
  let imported = 0, updated = 0, errorCount = 0
  let orderItemsWritten = 0, ordersWithItemsReplaced = 0
  const sampleErrors = []

  for (let start = 0; start < groupList.length; start += WRITE_CONCURRENCY) {
    const batch = groupList.slice(start, start + WRITE_CONCURRENCY)
    const results = await Promise.all(batch.map(async (g) => {
      try {
        const agg = {
          gmv:      g.lines.reduce((a, l) => a + num(l.price), 0),
          nett:     g.lines.reduce((a, l) => a + num(l.subtotal), 0),
          qty:      g.lines.reduce((a, l) => a + num(l.qty), 0),
          skuCount: g.lines.length,
        }
        const write = { ...pick(g.header, HEADER_FIELDS), ...agg }
        const whereVal   = Object.fromEntries(upsertKey.map(k => [k, write[k] ?? g.header[k]]))
        const updateData = { ...write }
        for (const k of upsertKey) delete updateData[k]

        // No interactive transaction — single statements (connection_limit=1).
        // Replace-per-order is idempotent, so a partial write self-heals next sync.
        const existing = await prisma.order.findUnique({ where: buildWhere(upsertKey, whereVal) })
        const order = await prisma.order.upsert({
          where: buildWhere(upsertKey, whereVal), create: write, update: updateData,
        })

        let itemsWritten = 0, replaced = false
        if (hasItemMapping) {
          const del = await prisma.orderItem.deleteMany({ where: { orderId: order.id } })
          replaced = del.count > 0
          const itemRows = g.lines
            .filter(l => l.sku != null && l.sku !== '')
            .map(l => ({
              orderId: order.id, sku: l.sku, productName: l.productName,
              qty: l.qty, price: l.price, subtotal: l.subtotal,
            }))
          if (itemRows.length) {
            const cr = await prisma.orderItem.createMany({ data: itemRows })
            itemsWritten = cr.count
          }
        }
        return { kind: existing ? 'updated' : 'imported', itemsWritten, replaced }
      } catch (e) {
        return { kind: 'error', orderId: g.header?.orderId, message: e.message }
      }
    }))

    for (const r of results) {
      if (r.kind === 'imported')     imported++
      else if (r.kind === 'updated') updated++
      else if (r.kind === 'error') {
        errorCount++
        if (sampleErrors.length < MAX_SAMPLE_ERRORS) sampleErrors.push({ orderId: r.orderId, error: r.message })
      }
      if (r.itemsWritten) orderItemsWritten += r.itemsWritten
      if (r.replaced)     ordersWithItemsReplaced++
    }
    if (start + WRITE_CONCURRENCY < groupList.length) await sleep(CHUNK_DELAY_MS)
  }

  return {
    persist: { imported, updated, skipped, orderItemsWritten, ordersWithItemsReplaced, errors: errorCount, errorSamples: sampleErrors },
    ret:     { imported, updated, skipped, orderItemsWritten, ordersWithItemsReplaced, errors: sampleErrors },
  }
}

// ── product_sync → Product — simple per-row upsert (1 row = 1 Product) ─────────
async function syncProducts(connector, rows, upsertKey) {
  const columnMapping = connector.columnMapping
  const dateFields = dateFieldsOf(columnMapping)
  const sheetKeyFields = upsertKey.filter(k => columnMapping[k]) // e.g. ['sku']

  // Map + filter rows (no grouping — each valid row is one Product).
  const records = []
  let skipped = 0
  for (const row of rows) {
    if (isEmptyRow(row)) { skipped++; continue }
    const mapped = mapRow(row, connector)
    if (dateFields.some(f => mapped[f] == null)) { skipped++; continue }
    if (sheetKeyFields.some(f => mapped[f] == null || mapped[f] === '')) { skipped++; continue }
    records.push(mapped)
  }

  let imported = 0, updated = 0, errorCount = 0
  const sampleErrors = []

  for (let start = 0; start < records.length; start += WRITE_CONCURRENCY) {
    const batch = records.slice(start, start + WRITE_CONCURRENCY)
    const results = await Promise.all(batch.map(async (mapped) => {
      try {
        const write = pick(mapped, PRODUCT_COLUMNS)
        // Product.name is required (NOT NULL). Some sheet rows have only sku + cost
        // (blank name) — fall back to the SKU so the row still imports (HPP needs
        // sku + hargaCogs, not the display name).
        if ((write.name == null || write.name === '') && write.sku) write.name = write.sku
        const whereVal   = Object.fromEntries(upsertKey.map(k => [k, write[k] ?? mapped[k]]))
        const updateData = { ...write }
        for (const k of upsertKey) delete updateData[k] // identity field isn't updated

        const existing = await prisma.product.findUnique({ where: buildWhere(upsertKey, whereVal) })
        await prisma.product.upsert({
          where: buildWhere(upsertKey, whereVal), create: write, update: updateData,
        })
        return { kind: existing ? 'updated' : 'imported' }
      } catch (e) {
        return { kind: 'error', sku: mapped.sku, message: e.message }
      }
    }))

    for (const r of results) {
      if (r.kind === 'imported')     imported++
      else if (r.kind === 'updated') updated++
      else if (r.kind === 'error') {
        errorCount++
        if (sampleErrors.length < MAX_SAMPLE_ERRORS) sampleErrors.push({ sku: r.sku, error: r.message })
      }
    }
    if (start + WRITE_CONCURRENCY < records.length) await sleep(CHUNK_DELAY_MS)
  }

  return {
    persist: { imported, updated, skipped, errors: errorCount, errorSamples: sampleErrors },
    ret:     { imported, updated, skipped, errors: sampleErrors },
  }
}
