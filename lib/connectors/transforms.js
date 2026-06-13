// ─── DataConnector transform constants & validation ──────────────────────────
// The ONLY allowed cell transforms. These are data, never executable code — the
// sync engine switches on these literals, so a connector config can never run
// arbitrary logic.

export const TRANSFORMS = Object.freeze({
  STRING:    'string',     // pass through as string
  INT:       'int',        // parseInt(raw, 10)
  CURRENCY:  'currency',   // strip non-digits → parseInt. "." = THOUSANDS sep ("Rp 1.000.000" → 1000000)
  DECIMAL:   'decimal',    // parseFloat, keep [0-9.-]. "." = DECIMAL sep ("18428.50" → 18428.5)
  DATE_AUTO: 'date_auto',  // new Date(v) — ISO / native parse
  DATE_DMY:  'date_dmy',   // explicit d/m/Y [H:i[:s]] parser
  STATIC:    'static',     // ignore sheetColumn, use mapping.value
})
export const TRANSFORM_VALUES = Object.freeze(Object.values(TRANSFORMS))

export const CONNECTOR_TYPES = Object.freeze(
  ['order_sync', 'product_sync', 'ad_spend_sync', 'visit_sync', 'netprofit_sync']
)

// Target tables that actually exist in the schema today. 'NetProfit' is
// intentionally absent — netprofit_sync validation is deferred until that model
// is added in a later phase.
export const TARGET_TABLES = Object.freeze(
  ['Order', 'Product', 'AdSpentShopee', 'AdSpentTiktok', 'AdSpentLazada', 'AdSpentMeta', 'AdSpentSocialMedia', 'Visit']
)

export function isValidTransform(t) {
  return TRANSFORM_VALUES.includes(t)
}

// Validate a single field mapping entry: { sheetColumn, transform, addColumn?, value? }
export function validateFieldMapping(field, m) {
  if (!m || typeof m !== 'object') throw new Error(`${field}: mapping must be an object`)
  if (!isValidTransform(m.transform)) throw new Error(`${field}: invalid transform "${m.transform}"`)
  if (m.transform === TRANSFORMS.STATIC) {
    if (m.value === undefined) throw new Error(`${field}: static transform requires "value"`)
  } else if (!Number.isInteger(m.sheetColumn)) {
    throw new Error(`${field}: ${m.transform} requires an integer sheetColumn`)
  }
  if (m.addColumn !== undefined && !Number.isInteger(m.addColumn)) {
    throw new Error(`${field}: addColumn must be an integer`)
  }
  return true
}

// Validate a whole columnMapping object. Throws on the first bad field.
export function validateColumnMapping(mapping) {
  if (!mapping || typeof mapping !== 'object') throw new Error('columnMapping must be an object')
  for (const [field, m] of Object.entries(mapping)) validateFieldMapping(field, m)
  return true
}

// ─── Transform implementations (PURE — no DB, no network) ────────────────────

// Strip every non-digit and parse. "Rp 1.000.000" → 1000000. Empty → null.
export function stripDigits(v) {
  if (v == null || v === '') return null
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10)
  return Number.isNaN(n) ? null : n
}

// Explicit d/m/Y parser with optional time — covers the TikTok/Tokopedia
// formats from SALES_GSHEET_CONFIG.md: 'd/m/Y H:i:s' | 'd/m/Y H:i' | 'd/m/Y'.
// Returns a Date or null (never throws).
export function parseDmy(value) {
  if (value == null || value === '') return null
  const m = String(value).trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  )
  if (!m) return null
  const [, dd, mm, yyyy, h = '0', mi = '0', ss = '0'] = m
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(h), Number(mi), Number(ss))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Apply a single field's transform. Pure: deterministic, no I/O.
 * @param {*}      rawValue  the cell at mapping.sheetColumn (undefined for static)
 * @param {object} mapping   { transform, sheetColumn?, addColumn?, value? }
 * @param {Array}  row       the full sheet row (needed for currency addColumn)
 */
export function applyTransform(rawValue, mapping, row = []) {
  switch (mapping.transform) {
    case TRANSFORMS.STATIC:
      return mapping.value

    case TRANSFORMS.STRING:
      return rawValue == null ? null : (String(rawValue).trim() || null)

    case TRANSFORMS.INT: {
      if (rawValue == null || rawValue === '') return null
      const n = parseInt(String(rawValue).replace(/[^\d-]/g, ''), 10)
      return Number.isNaN(n) ? null : n
    }

    case TRANSFORMS.CURRENCY: {
      const base = stripDigits(rawValue)
      if (mapping.addColumn != null) {
        const add = stripDigits(row[mapping.addColumn])
        if (base == null && add == null) return null
        return (base ?? 0) + (add ?? 0)
      }
      return base
    }

    case TRANSFORMS.DECIMAL: {
      // "." is the DECIMAL separator here (e.g. "18428.50" → 18428.5). Keep digits,
      // dot, minus; strip currency symbols/spaces. NOT for thousands-dot values.
      if (rawValue == null || rawValue === '') return null
      const n = parseFloat(String(rawValue).replace(/[^0-9.\-]/g, ''))
      return Number.isNaN(n) ? null : n
    }

    case TRANSFORMS.DATE_AUTO: {
      if (rawValue == null || rawValue === '') return null
      const d = new Date(rawValue)
      return Number.isNaN(d.getTime()) ? parseDmy(rawValue) : d
    }

    case TRANSFORMS.DATE_DMY:
      return parseDmy(rawValue)

    default:
      return null
  }
}
