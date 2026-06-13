import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import AdmZip from 'adm-zip'

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMN MAPS  ── only thing to edit when real export files differ
// ═══════════════════════════════════════════════════════════════════════════════

// META: 0-indexed positional, applied to every raw row after skipping the
// header (row 0).  Source: Meta Ads Manager → Reports → Export → CSV.
// roas/cpc/ctr are NOT in the file — they are computed from the columns below.
//   Col 0  "Reporting starts"        → date   (YYYY-MM-DD string)
//   Col 1  "Reporting ends"          (ignored)
//   Col 2  "Ad set name"             → adsetName
//   Col 3  "Amount spent (IDR)"      → spent
//   Col 4  "Impressions"             → impressions
//   Col 5  "Reach"                   (ignored)
//   Col 6  "Frequency"               (ignored)
//   Col 7  "Results"                 → conversions
//   Col 8  "Revenue"                 → revenue
//   Col 9  "Link clicks"             → clicks
const META_COL = {
  date:        0,
  adsetName:   2,
  spent:       3,
  impressions: 4,
  conversions: 7,
  revenue:     8,
  clicks:      9,
}

// TIKTOK: header-driven XLSX.  Parser scans rows until it finds one containing
// BOTH "Campaign name" AND "Cost" — that row becomes the dynamic index map.
// Date comes from the filename (first YYYY-MM-DD pattern found).
// revenue and roas are absent from TikTok Ads exports → stored as null.
//   "Campaign name"          → adName
//   "Cost"                   → spent
//   "Impressions"            → impressions
//   "Clicks (destination)"   → clicks
//   "CPC (Destination)"      → cpc   (IDR / click, already a ratio)
//   "CTR (destination)"      → ctr   (percentage string "1.26%" → stored as 0.0126)
//   "Conversions"            → conversions
const TIKTOK_HEADER_MAP = {
  adName:      'Campaign name',
  spent:       'Cost',
  impressions: 'Impressions',
  clicks:      'Clicks (destination)',
  cpc:         'CPC (Destination)',
  ctr:         'CTR (destination)',
  conversions: 'Conversions',
}

// LAZADA: 0-indexed positional, applied to raw rows after skipping header (row 0).
// Source: Lazada Seller Center → Ads → Campaign Report → Export.
// Indonesian number format (1.234.567,89).
// Schema AdSpentLazada has NO impressions column and NO ctr column — omitted.
//   Col 0   "Date"           → date   (DD/MM/YYYY or YYYY-MM-DD)
//   Col 1   "Ad Spend (IDR)" → spent
//   Col 2   "GMV (IDR)"      → revenue
//   Col 3   (ignored)
//   Col 4   "ROAS"           → roas
//   Col 5   (ignored)
//   Col 6   "Clicks"         → clicks
//   …
//   Col 10  "Orders"         → orders
//   …
//   Col 15  "CPC (IDR)"      → cpc
const LAZADA_COL = {
  date:     0,
  spent:    1,
  revenue:  2,
  roas:     4,
  clicks:   6,
  orders:   10,
  cpc:      15,
}

// SHOPEE: 0-indexed positional, applied to data rows AFTER the row-7 header.
// Source: Shopee Seller Center → Iklan → Laporan Iklan CPC (CSV / XLSX).
// File layout: rows 0–6 are metadata, row 7 is the header, data from row 8+.
// Date is extracted from metadata cell B6 (A1 notation) which contains
// "DD/MM/YYYY - DD/MM/YYYY"; falls back to the filename YYYY-MM-DD pattern.
// Rows sharing the same adType (idx 3) are GROUPED and SUMMED before inserting.
// roas/cpc/ctr are computed after aggregation.
//   Col 3   "Jenis Iklan"      → adType       (grouping key)
//   Col 10  "Dilihat"          → impressions
//   Col 11  "Jumlah Klik"      → clicks
//   Col 13  "Konversi"         → orders
//   Col 21  "Omzet Penjualan"  → revenue
//   Col 23  "Biaya"            → spent
const SHOPEE_COL = {
  adType:      3,
  impressions: 10,
  clicks:      11,
  orders:      13,
  revenue:     21,
  spent:       23,
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// Indonesian-aware number parser.
// "1.234.567,89" → 1234567.89 | "1.234.567" → 1234567 | "1234.56" → 1234.56
// "-" or empty → fallback (null by default)
function parseIdr(v, fallback = null) {
  if (v === undefined || v === null || v === '' || v === '-') return fallback
  if (typeof v === 'number') return v
  const s = String(v).trim().replace(/[Rp\s]/g, '')
  if (!s || s === '-') return fallback
  let n
  if (s.includes(',')) {
    // Comma is decimal separator; dots are thousands separators
    n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
  } else if ((s.match(/\./g) ?? []).length > 1) {
    // Multiple dots → all are thousands separators (no decimal part)
    n = parseFloat(s.replace(/\./g, ''))
  } else if (/^\d+\.\d{3}$/.test(s)) {
    // Single dot followed by exactly 3 digits → Indonesian thousands separator
    n = parseFloat(s.replace('.', ''))
  } else {
    n = parseFloat(s)
  }
  return isNaN(n) ? fallback : n
}

// CTR / ratio parser.
// "1.26%" → 0.0126 (percentage string divided by 100)
// 0.0126  → 0.0126 (already a ratio — xlsx stores % cells as ratios internally)
// null / "-" → null
function parsePct(v) {
  if (v === undefined || v === null || v === '' || v === '-') return null
  if (typeof v === 'number') return v
  const s = String(v).trim()
  const n = parseFloat(s.replace('%', ''))
  if (isNaN(n)) return null
  return s.includes('%') ? n / 100 : n
}

// Multi-format date parser → UTC-midnight JS Date or null.
// Handles: YYYY-MM-DD strings, DD/MM/YYYY strings, Excel serial numbers.
function parseDate(v) {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') {
    // Excel date serial (1900 epoch, Windows system)
    const d = new Date(Math.round((v - 25569) * 86400000))
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  if (!s || s === '-') return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.substring(0, 10) + 'T00:00:00Z')
    return isNaN(d.getTime()) ? null : d
  }
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const [, dd, mm, yyyy] = dmy
    const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00Z`)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// Extract the first YYYY-MM-DD found in a filename.
function dateFromFilename(name) {
  const m = (name ?? '').match(/(\d{4}-\d{2}-\d{2})/)
  if (!m) return null
  const d = new Date(m[1] + 'T00:00:00Z')
  return isNaN(d.getTime()) ? null : d
}

// Safe BigInt from any number-like value (handles NaN, Infinity).
function toBigInt(n) {
  return BigInt(Math.max(0, Math.trunc(Number(n) || 0)))
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM PARSERS  — each returns { rows: Array, errors: Array<{row,reason}> }
// ═══════════════════════════════════════════════════════════════════════════════

function parseMeta(buffer) {
  const wb  = XLSX.read(buffer, { type: 'buffer' })
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
  const rows = []
  const errors = []
  // raw[0] is the header row; data rows start at index 1
  for (let i = 1; i < raw.length; i++) {
    const r    = raw[i]
    const date = parseDate(r[META_COL.date])
    if (!date) continue  // blank / "Total" rows have no date

    const spent       = parseIdr(r[META_COL.spent], 0)
    const impressions = parseIdr(r[META_COL.impressions], 0)
    const clicks      = parseIdr(r[META_COL.clicks], 0)
    const conversions = parseIdr(r[META_COL.conversions], 0)
    const revenue     = parseIdr(r[META_COL.revenue])

    rows.push({
      date,
      adsetName:   String(r[META_COL.adsetName] ?? '').trim() || null,
      spent,
      impressions: toBigInt(impressions),
      clicks:      Math.trunc(clicks),
      conversions: Math.trunc(conversions),
      revenue,
      roas: spent > 0 && revenue != null ? revenue / spent : null,
      cpc:  clicks > 0 ? spent / clicks : null,
      ctr:  impressions > 0 ? clicks / impressions : null,
    })
  }
  return { rows, errors }
}

function parseTiktok(buffer, filename) {
  const wb  = XLSX.read(buffer, { type: 'buffer' })
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
  const errors = []
  const colIdx = {}

  // Locate the header row: first row containing both anchor columns
  let headerIdx = -1
  for (let i = 0; i < raw.length; i++) {
    const cells = raw[i].map(c => String(c ?? '').trim())
    if (cells.includes('Campaign name') && cells.includes('Cost')) {
      headerIdx = i
      for (const [field, colName] of Object.entries(TIKTOK_HEADER_MAP)) {
        const idx = cells.indexOf(colName)
        if (idx >= 0) colIdx[field] = idx
      }
      break
    }
  }
  if (headerIdx < 0) {
    errors.push({ row: 0, reason: 'Header row not found — expected a row with "Campaign name" and "Cost" columns' })
    return { rows: [], errors }
  }

  const date = dateFromFilename(filename)
  const rows = []

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r      = raw[i]
    const adName = String(r[colIdx.adName] ?? '').trim()
    if (!adName || adName === '-') continue  // blank / aggregate rows

    const impressions = parseIdr(r[colIdx.impressions], 0)
    const clicks      = parseIdr(r[colIdx.clicks], 0)

    rows.push({
      date,
      adName:      adName || null,
      spent:       parseIdr(r[colIdx.spent], 0),
      impressions: toBigInt(impressions),
      clicks:      Math.trunc(clicks),
      cpc:         parseIdr(r[colIdx.cpc]),
      ctr:         parsePct(r[colIdx.ctr]),
      conversions: Math.trunc(parseIdr(r[colIdx.conversions], 0)),
      revenue:     null,
      roas:        null,
    })
  }
  return { rows, errors }
}

function parseLazada(buffer) {
  const wb  = XLSX.read(buffer, { type: 'buffer' })
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
  const rows  = []
  const errors = []
  // raw[0] is the header row; data rows start at index 1
  for (let i = 1; i < raw.length; i++) {
    const r    = raw[i]
    const date = parseDate(r[LAZADA_COL.date])
    if (!date) continue

    rows.push({
      date,
      spent:   parseIdr(r[LAZADA_COL.spent], 0),
      revenue: parseIdr(r[LAZADA_COL.revenue]),
      roas:    parseIdr(r[LAZADA_COL.roas]),
      clicks:  Math.trunc(parseIdr(r[LAZADA_COL.clicks], 0)),
      orders:  Math.trunc(parseIdr(r[LAZADA_COL.orders], 0)),
      cpc:     parseIdr(r[LAZADA_COL.cpc]),
      // impressions and ctr intentionally absent — AdSpentLazada has no such columns
    })
  }
  return { rows, errors }
}

function parseShopee(buffer, filename) {
  const wb    = XLSX.read(buffer, { type: 'buffer', raw: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const errors = []

  // Date from metadata cell B6: "DD/MM/YYYY - DD/MM/YYYY" — take the start date
  const periodeRaw = String(sheet['B6']?.v ?? '').split(' - ')[0].trim()
  const reportDate = parseDate(periodeRaw) ?? dateFromFilename(filename)
  if (!reportDate) {
    errors.push({ row: 0, reason: `Cannot parse date from B6 ("${periodeRaw}") or filename` })
    return { rows: [], errors }
  }

  // Positional arrays starting at row index 7 (0-indexed).
  // allRows[0] = the Indonesian header row; allRows[1+] = data.
  const allRows = XLSX.utils.sheet_to_json(sheet, { range: 7, header: 1, defval: '' })

  // Group and sum by adType before inserting (one DB row per unique adType per date)
  const groups = {}
  for (let i = 1; i < allRows.length; i++) {
    const r      = allRows[i]
    const adType = String(r[SHOPEE_COL.adType] ?? '').trim()
    if (!adType || adType === '-') continue
    if (!groups[adType]) groups[adType] = { impressions: 0, clicks: 0, orders: 0, revenue: 0, spent: 0 }
    groups[adType].impressions += parseIdr(r[SHOPEE_COL.impressions], 0)
    groups[adType].clicks      += parseIdr(r[SHOPEE_COL.clicks], 0)
    groups[adType].orders      += parseIdr(r[SHOPEE_COL.orders], 0)
    groups[adType].revenue     += parseIdr(r[SHOPEE_COL.revenue], 0)
    groups[adType].spent       += parseIdr(r[SHOPEE_COL.spent], 0)
  }

  const rows = []
  for (const [adType, g] of Object.entries(groups)) {
    if (g.spent === 0 && g.impressions === 0) continue
    rows.push({
      date:        reportDate,
      adType,
      impressions: toBigInt(g.impressions),
      clicks:      Math.trunc(g.clicks),
      orders:      Math.trunc(g.orders),
      revenue:     g.revenue > 0 ? g.revenue : null,
      spent:       g.spent,
      roas:        g.spent > 0 && g.revenue > 0 ? g.revenue / g.spent : null,
      cpc:         g.clicks > 0 ? g.spent / g.clicks : null,
      ctr:         g.impressions > 0 ? g.clicks / g.impressions : null,
    })
  }
  return { rows, errors }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSERT HELPERS  — field names match the schema exactly
// ═══════════════════════════════════════════════════════════════════════════════

function makeInsertFn(platform, tenantId) {
  switch (platform) {
    case 'meta':
      return r => prisma.adSpentMeta.create({ data: {
        tenantId,
        date:        r.date,
        spent:       r.spent,
        impressions: r.impressions,
        clicks:      r.clicks,
        conversions: r.conversions,
        revenue:     r.revenue,
        roas:        r.roas,
        cpc:         r.cpc,
        ctr:         r.ctr,
        adsetName:   r.adsetName,
      }})
    case 'tiktok':
      return r => prisma.adSpentTiktok.create({ data: {
        tenantId,
        date:        r.date,
        spent:       r.spent,
        impressions: r.impressions,
        clicks:      r.clicks,
        conversions: r.conversions,
        revenue:     r.revenue,
        roas:        r.roas,
        cpc:         r.cpc,
        ctr:         r.ctr,
        adName:      r.adName,
      }})
    case 'lazada':
      return r => prisma.adSpentLazada.create({ data: {
        tenantId,
        date:    r.date,
        spent:   r.spent,
        clicks:  r.clicks,
        orders:  r.orders,
        revenue: r.revenue,
        roas:    r.roas,
        cpc:     r.cpc,
        // impressions, ctr, adName absent — no column in AdSpentLazada
      }})
    case 'shopee':
      return r => prisma.adSpentShopee.create({ data: {
        tenantId,
        date:        r.date,
        spent:       r.spent,
        impressions: r.impressions,
        clicks:      r.clicks,
        orders:      r.orders,
        revenue:     r.revenue,
        roas:        r.roas,
        cpc:         r.cpc,
        ctr:         r.ctr,
        adType:      r.adType,
      }})
  }
}

async function insertRows(rows, insertFn) {
  let count = 0
  const errors = []
  for (let i = 0; i < rows.length; i++) {
    try {
      await insertFn(rows[i])
      count++
    } catch (e) {
      errors.push({ row: i + 2, reason: e.message })  // +2 = 1-indexed + skip header
    }
  }
  return { count, errors }
}

// Delete existing rows for the exact dates found in this file, scoped to the
// tenant.  Called AFTER parsing succeeds so we never wipe data without having
// replacement rows ready.
async function deleteForDates(platform, tenantId, dates) {
  const where = { tenantId, date: { in: dates } }
  switch (platform) {
    case 'meta':   return prisma.adSpentMeta.deleteMany({ where })
    case 'tiktok': return prisma.adSpentTiktok.deleteMany({ where })
    case 'lazada': return prisma.adSpentLazada.deleteMany({ where })
    case 'shopee': return prisma.adSpentShopee.deleteMany({ where })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/import/ad-spent?platform=meta|shopee|tiktok|lazada
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const platform = (searchParams.get('platform') ?? '').toLowerCase()

  if (!['meta', 'shopee', 'tiktok', 'lazada'].includes(platform)) {
    return NextResponse.json(
      { error: 'Invalid platform. Supported: meta, shopee, tiktok, lazada' },
      { status: 400 },
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const filename = file.name ?? ''
  const ext = filename.split('.').pop().toLowerCase()
  if (!['csv', 'xlsx', 'xls', 'zip'].includes(ext)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use .csv, .xlsx, or .zip' },
      { status: 400 },
    )
  }

  const buffer   = Buffer.from(await file.arrayBuffer())
  const tenantId = session.user.tenantId

  // Resolve file list: unwrap .zip, otherwise use the single upload directly
  const filesToProcess = []
  if (ext === 'zip') {
    try {
      const zip = new AdmZip(buffer)
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue
        const innerExt = entry.entryName.split('.').pop().toLowerCase()
        if (['csv', 'xlsx', 'xls'].includes(innerExt)) {
          filesToProcess.push({ buf: entry.getData(), name: entry.entryName })
        }
      }
    } catch (e) {
      return NextResponse.json({ error: `Could not read ZIP: ${e.message}` }, { status: 400 })
    }
    if (!filesToProcess.length) {
      return NextResponse.json(
        { error: 'ZIP contains no supported files (.csv / .xlsx)' },
        { status: 400 },
      )
    }
  } else {
    filesToProcess.push({ buf: buffer, name: filename })
  }

  let totalCount = 0
  const allErrors = []

  for (const { buf, name } of filesToProcess) {
    let parsed
    try {
      if      (platform === 'meta')   parsed = parseMeta(buf)
      else if (platform === 'tiktok') parsed = parseTiktok(buf, name)
      else if (platform === 'lazada') parsed = parseLazada(buf)
      else                            parsed = parseShopee(buf, name)
    } catch (e) {
      allErrors.push({ row: 0, file: name, reason: `Parse failed: ${e.message}` })
      continue
    }

    allErrors.push(...parsed.errors.map(e => ({ ...e, file: name })))
    if (!parsed.rows.length) continue

    // Collect distinct dates from this file's rows, then delete any existing
    // rows for those dates before inserting fresh ones.  Parsing is done first
    // so we never delete without having replacement data ready.
    const distinctDates = [...new Set(parsed.rows.map(r => r.date?.toISOString()).filter(Boolean))]
      .map(iso => new Date(iso))
    await deleteForDates(platform, tenantId, distinctDates)

    const { count, errors } = await insertRows(parsed.rows, makeInsertFn(platform, tenantId))
    totalCount += count
    allErrors.push(...errors.map(e => ({ ...e, file: name })))
  }

  return NextResponse.json({
    status:       allErrors.length === 0 ? 'ok' : 'partial',
    message:      `Imported ${totalCount} row(s) for ${platform}` +
                  (allErrors.length ? ` (${allErrors.length} error(s))` : ''),
    record_count: totalCount,
    errors:       allErrors,
  })
}
