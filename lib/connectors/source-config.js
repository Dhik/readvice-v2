// ─── Connector source-config (Part E1) ───────────────────────────────────────
// The discriminator + back-compat read mapping that lets DataConnector stop being
// Sheets-shaped without breaking a single existing connector. Existing connectors have
// sourceType='google_sheets' (default) and a null sourceConfig → their effective locator
// is read from the legacy spreadsheetId/sheetTab/dataRange columns. When sourceConfig is
// populated, it WINS. The transform/mapping/write layer is untouched — only the FETCH
// differs by sourceType.

export const SOURCE_TYPES = Object.freeze(['google_sheets', 'google_drive_file', 'onedrive_file'])
// onedrive_file is reserved (E3 — needs its own OAuth design pass); not creatable/syncable yet.
export const SUPPORTED_SOURCE_TYPES = Object.freeze(['google_sheets', 'google_drive_file'])

const hasKeys = o => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length > 0

/**
 * Effective per-source locator for a connector. sourceConfig wins if populated; otherwise
 * back-compat: google_sheets reads the legacy columns (so all current connectors — null
 * sourceConfig — keep working untouched).
 * @returns {object} Sheets → { spreadsheetId, sheetTab, dataRange } · Drive → { fileId, sheetTab?, headerRows? }
 */
export function resolveSourceConfig(connector) {
  const sourceType = connector.sourceType || 'google_sheets'
  if (hasKeys(connector.sourceConfig)) return connector.sourceConfig
  if (sourceType === 'google_sheets') {
    return { spreadsheetId: connector.spreadsheetId, sheetTab: connector.sheetTab, dataRange: connector.dataRange }
  }
  return {}   // drive/onedrive without a sourceConfig is a misconfiguration (validated on save)
}

/**
 * Validate the source fields of a connector create/update body by sourceType.
 * @returns {string|null} an error message, or null if valid.
 */
export function validateSourceConfig(body) {
  const sourceType = body.sourceType || 'google_sheets'
  if (!SOURCE_TYPES.includes(sourceType)) return `Invalid sourceType (allowed: ${SOURCE_TYPES.join(', ')})`
  if (sourceType === 'onedrive_file') return 'OneDrive connectors are not yet supported (pending OAuth design — E3).'

  if (sourceType === 'google_sheets') {
    if (!body.spreadsheetId?.trim()) return 'spreadsheetId is required for google_sheets'
    if (!body.sheetTab?.trim())      return 'sheetTab is required for google_sheets'
    if (!body.dataRange?.trim())     return 'dataRange is required for google_sheets'
    return null
  }
  if (sourceType === 'google_drive_file') {
    const fileId = body.sourceConfig?.fileId
    if (!fileId || !String(fileId).trim()) return 'sourceConfig.fileId is required for google_drive_file (the Drive file id, shared with the service-account email)'
    return null
  }
  return null
}

// Normalize a body's persisted source columns/config. Non-Sheets connectors store '' in
// the legacy NOT-NULL columns and keep their real locator in sourceConfig.
export function persistedSourceFields(body) {
  const sourceType = body.sourceType || 'google_sheets'
  if (sourceType === 'google_sheets') {
    return {
      sourceType,
      sourceConfig: hasKeys(body.sourceConfig) ? body.sourceConfig : null,
      spreadsheetId: body.spreadsheetId.trim(),
      sheetTab:      body.sheetTab.trim(),
      dataRange:     body.dataRange.trim(),
    }
  }
  // google_drive_file (onedrive rejected earlier): locator lives in sourceConfig.
  const cfg = body.sourceConfig || {}
  const sourceConfig = { fileId: String(cfg.fileId).trim() }
  if (cfg.sheetTab && String(cfg.sheetTab).trim()) sourceConfig.sheetTab = String(cfg.sheetTab).trim()
  if (cfg.headerRows != null && cfg.headerRows !== '') sourceConfig.headerRows = Number(cfg.headerRows)
  return { sourceType, sourceConfig, spreadsheetId: '', sheetTab: '', dataRange: '' }
}
