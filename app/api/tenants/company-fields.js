// Company-metadata fields used in document exports (Invoice / SPK). Shared by the
// Tenant create (POST) and update (PUT) routes so the field list stays in one place.
export const COMPANY_FIELDS = [
  'invoiceDisplayName', 'invoiceDisplayHandle', 'legalName',
  'companyAddress', 'companyEmail', 'companyPhone',
  'contactPerson', 'contactTitle', 'contactPhone',
  'senderBankName', 'senderBankAccount', 'senderAccountName',
  'companyNpwp', 'footerPhone', 'footerAddress',
  'logoFile', 'letterheadFile',
]

// Build a Prisma data fragment from the request body: only keys present in the
// body are included; empty strings become null.
export function companyData(body) {
  const out = {}
  for (const k of COMPANY_FIELDS) {
    if (body[k] !== undefined) {
      const v = typeof body[k] === 'string' ? body[k].trim() : body[k]
      out[k] = v || null
    }
  }
  return out
}
