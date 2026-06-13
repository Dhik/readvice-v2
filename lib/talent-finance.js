// Shared talent finance helpers (PPh / tax) — single source of truth.
// Previously duplicated inline in app/api/talent/[id]/route.js and
// app/api/talent-payments/kpi/route.js.

// PPh withholding: custom tax_percentage override, else PT/CV → 2%, else 2.5%.
export function calcTax(rateFinal, namaRekening, taxPercentage) {
  const rate = Number(rateFinal ?? 0)
  if (taxPercentage) return rate * Number(taxPercentage) / 100
  const isPTCV = namaRekening?.startsWith('PT') || namaRekening?.startsWith('CV')
  return rate * (isPTCV ? 0.02 : 0.025)
}

// Human label for the PPh line on the invoice.
export function pphLabel(namaRekening, taxPercentage) {
  if (taxPercentage) return `PPh (${Number(taxPercentage)}%)`
  const isPTCV = namaRekening?.startsWith('PT') || namaRekening?.startsWith('CV')
  return isPTCV ? 'PPh 23 (2%)' : 'PPh 21 (2.5%)'
}

// Net amount the talent receives = rate - PPh.
export function talentShouldGet(rateFinal, namaRekening, taxPercentage) {
  return Number(rateFinal ?? 0) - calcTax(rateFinal, namaRekening, taxPercentage)
}
