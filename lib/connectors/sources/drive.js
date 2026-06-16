// ─── Google Drive file source (Part E2) ──────────────────────────────────────
// fetchDriveFile(sourceConfig) → string[][], in the SAME shape getSheetRows returns, so
// the ENTIRE transform/mapping/write layer (transforms.js, columnMapping, staticValues,
// order_sync/product_sync dispatch, ORDER_COLUMNS allowlist, replace-per-order writes) is
// reused UNCHANGED — Drive is a fetch swap only. Same service-account as Sheets, just with
// the Drive read-only scope added. NO OAuth (that's OneDrive / E3, deferred).
//
// sourceConfig: { fileId, sheetTab?, headerRows? }
//   • fileId     — the Drive file id. The file MUST be shared with the service-account
//                  email (Viewer) to be readable — the #1 Drive gotcha (see error text).
//   • sheetTab   — xlsx only: the worksheet to read (default: first sheet). csv ignores it.
//   • headerRows — leading rows to skip (default 1), mirroring a Sheets connector's A2:…
//                  range that already excludes the header row.
import { google } from 'googleapis'
import * as XLSX from 'xlsx'
import { validateGoogleCredentials } from '../../google-sheets'

// Drive read-only scope — added alongside the existing Sheets scope; same service-account.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

// Clear, actionable errors (mirrors validateGoogleCredentials) — not a cryptic Drive 4xx.
function driveError(e, fileId) {
  const status = e?.code ?? e?.response?.status
  if (status === 404) return new Error(`Drive file not found (id "${fileId}"). Check the file id, and that the file is shared with the service-account email.`)
  if (status === 403) return new Error(`Drive file access denied (id "${fileId}"). SHARE the file with the service-account email (Viewer) — the #1 Drive gotcha.`)
  return new Error(`Drive fetch failed for file "${fileId}": ${e?.message || 'unknown error'}`)
}

export async function fetchDriveFile(sourceConfig = {}) {
  const fileId = sourceConfig.fileId && String(sourceConfig.fileId).trim()
  if (!fileId) throw new Error('Drive connector misconfigured: sourceConfig.fileId is required.')

  const credentials = validateGoogleCredentials()   // reuses the Sheets service-account + its clear-error path
  const auth = new google.auth.GoogleAuth({ credentials, scopes: [DRIVE_SCOPE] })
  const drive = google.drive({ version: 'v3', auth })

  // Metadata first — clearest place to surface a 403 (not shared) / 404 (bad id).
  let meta
  try { meta = await drive.files.get({ fileId, fields: 'id,name,mimeType', supportsAllDrives: true }) }
  catch (e) { throw driveError(e, fileId) }
  const { name = fileId, mimeType = '' } = meta.data
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    throw new Error(`Drive file "${name}" is a native Google Sheet — use a google_sheets connector (its sheet id), not google_drive_file.`)
  }

  // Download the raw bytes (csv/xlsx).
  let res
  try { res = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' }) }
  catch (e) { throw driveError(e, fileId) }
  const buf = Buffer.from(res.data)

  return parseDriveBytes(buf, name, sourceConfig)
}

// Parse downloaded csv/xlsx bytes → string[][] (SheetJS, the repo's parser — it sniffs the
// format). Exported so it's testable with local bytes without hitting the Drive API.
// header:1 → array-of-arrays; skip the header row(s) so it matches a Sheets connector's
// A2:… range (which already excludes the header). Cells coerced to string/null.
export function parseDriveBytes(buf, name = 'file', sourceConfig = {}) {
  let wb
  try { wb = XLSX.read(buf, { type: 'buffer' }) }
  catch (e) { throw new Error(`Could not parse Drive file "${name}" as csv/xlsx: ${e.message}`) }
  const wantTab = sourceConfig.sheetTab && String(sourceConfig.sheetTab).trim()
  const wsName = wantTab && wb.SheetNames.includes(wantTab) ? wantTab : wb.SheetNames[0]
  const ws = wsName ? wb.Sheets[wsName] : null
  if (!ws) throw new Error(`Drive file "${name}" has no readable sheet${wantTab ? ` named "${wantTab}"` : ''}.`)
  const all = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null, blankrows: false })
  const skip = sourceConfig.headerRows == null ? 1 : Math.max(0, Number(sourceConfig.headerRows) || 0)
  return all.slice(skip).map(r => (Array.isArray(r) ? r.map(c => (c == null || c === '' ? null : String(c))) : []))
}
