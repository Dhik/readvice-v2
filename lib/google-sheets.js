import { google } from 'googleapis'

const CRED_ERROR =
  'GOOGLE_SERVICE_ACCOUNT_JSON appears to be a placeholder or invalid ' +
  '(missing/malformed private_key or client_email). ' +
  'Set up real credentials — see docs/CONNECTOR_SETUP.md'

let cachedCredentials // memoized once valid (per process)

// Validate GOOGLE_SERVICE_ACCOUNT_JSON before the first Sheets API call. Throws
// a clear, actionable error instead of the cryptic OpenSSL "DECODER routines::
// unsupported" you get when the key is a placeholder. Returns the parsed creds
// with the private_key newlines un-escaped.
export function validateGoogleCredentials() {
  if (cachedCredentials) return cachedCredentials

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw || !raw.trim()) throw new Error(CRED_ERROR)

  let creds
  try { creds = JSON.parse(raw) } catch { throw new Error(CRED_ERROR) }

  // client_email: must be a real service-account address, not '...' / empty.
  const email = creds.client_email
  if (!email || email === '...' || !email.includes('@') || !email.includes('.iam.gserviceaccount.com')) {
    throw new Error(CRED_ERROR)
  }

  // private_key: real PEM after un-escaping \n, comfortably longer than a stub.
  const privateKey = (creds.private_key || '').replace(/\\n/g, '\n')
  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----') || privateKey.length <= 100) {
    throw new Error(CRED_ERROR)
  }

  cachedCredentials = { ...creds, private_key: privateKey }
  return cachedCredentials
}

export async function getSheetRows(spreadsheetId, range = 'Sheet1!A:Z') {
  const credentials = validateGoogleCredentials()
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return res.data.values ?? []
}

export function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return []
  const [headers, ...data] = rows
  return data.map(row =>
    Object.fromEntries(headers.map((h, i) => [h?.toString().trim(), row[i] ?? null]))
  )
}
