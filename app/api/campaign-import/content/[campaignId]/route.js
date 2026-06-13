import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// ─── Excel header → CampaignContent field (STANDARD layout) ─────────────────
// Adjust the LEFT-hand keys to match the real .xlsx column headers once you
// have a sample sheet. Several headers may map to the same field so both
// snake_case and Title Case spellings are tolerated; lookup is also
// case-insensitive as a fallback (see normalizeRow).
const COLUMN_MAP = {
  username: 'username',          Username: 'username',
  creator_name: 'creatorName',   'Creator Name': 'creatorName',
  pic: 'pic',                    PIC: 'pic',
  task_name: 'taskName',         'Task Name': 'taskName',  task: 'taskName',    Task: 'taskName',
  channel: 'channel',            Channel: 'channel',       platform: 'channel', Platform: 'channel',
  link: 'link',                  Link: 'link',             url: 'link',         URL: 'link',
  product: 'product',            Product: 'product',
  boost_code: 'boostCode',       'Boost Code': 'boostCode',
  kode_ads: 'kodeAds',           'Kode Ads': 'kodeAds',    'Ads Code': 'kodeAds',
  rate_card: 'rateCard',         'Rate Card': 'rateCard',
}

// Build a normalized { field: value } object from a raw sheet row using the map.
function normalizeRow(row, map) {
  const out = {}
  for (const [header, value] of Object.entries(row)) {
    const field = map[header] ?? map[header.trim()] ?? map[header.trim().toLowerCase()]
    if (field && out[field] == null) out[field] = value
  }
  return out
}

const toStr = v => { const s = String(v ?? '').trim(); return s || null }
// Parse an IDR money value. Handles native numeric cells AND Indonesian-formatted
// text where '.' is the thousands separator and ',' the decimal (e.g.
// "Rp 1.500.000" → 1500000, "1.500.000,50" → 1500000.5).
function toRupiah(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  let s = String(v).trim()
  s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, '')
  const n = parseFloat(s.replace(/[^\d.-]/g, ''))
  return isNaN(n) ? null : n
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const { campaignId } = await params
  const cid = parseInt(campaignId)

  // Verify the campaign belongs to this tenant before importing into it.
  const campaign = await prisma.campaign.findFirst({ where: { id: cid, tenantId } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  let formData
  try { formData = await request.formData() } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }
  const file = formData.get('file')
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  let rows
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  } catch {
    return NextResponse.json({ error: 'Could not parse spreadsheet' }, { status: 400 })
  }

  const errors = []
  let created = 0, updated = 0

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2 // +1 for the header row, +1 to be 1-based (matches Excel)
    const r = normalizeRow(rows[i], COLUMN_MAP)

    // Skip fully-empty rows silently.
    if (!Object.values(r).some(v => String(v ?? '').trim() !== '')) continue

    const link = toStr(r.link)
    if (!link) { errors.push({ row: rowNum, reason: 'Missing link' }); continue }
    const username = toStr(r.username)
    if (!username) { errors.push({ row: rowNum, reason: 'Missing username' }); continue }

    const creatorName = toStr(r.creatorName)
    const channel     = toStr(r.channel)
    const rateCard    = toRupiah(r.rateCard)

    try {
      // 1) Upsert the per-campaign KOL. No unique constraint exists, so this is
      //    a manual find-then-write keyed by (campaignId, name).
      const kolName = creatorName || username
      const kolData = { campaignId: cid, tenantId, name: kolName, platform: channel, contentUrl: link, fee: rateCard }
      const kol = await prisma.keyOpinionLeader.findFirst({ where: { campaignId: cid, name: kolName } })
      if (kol) await prisma.keyOpinionLeader.update({ where: { id: kol.id }, data: kolData })
      else     await prisma.keyOpinionLeader.create({ data: kolData })

      // 2) Upsert CampaignContent keyed by (campaignId, link) so re-importing
      //    the same sheet updates rows instead of duplicating them. Only the
      //    imported fields are written — engagement counts/flags are preserved.
      const contentData = {
        campaignId: cid, tenantId, username,
        creatorName, pic: toStr(r.pic), taskName: toStr(r.taskName),
        channel, link, product: toStr(r.product),
        boostCode: toStr(r.boostCode), kodeAds: toStr(r.kodeAds),
        rateCard,
      }
      const existing = await prisma.campaignContent.findFirst({ where: { campaignId: cid, link } })
      if (existing) { await prisma.campaignContent.update({ where: { id: existing.id }, data: contentData }); updated++ }
      else          { await prisma.campaignContent.create({ data: contentData }); created++ }
    } catch (err) {
      errors.push({ row: rowNum, reason: err.message })
    }
  }

  const imported = created + updated
  return NextResponse.json({
    status: 'ok',
    message: `${imported} rows imported (${created} new, ${updated} updated)` +
      (errors.length ? `, ${errors.length} skipped` : ''),
    created,
    imported,
    errors,
  })
}
