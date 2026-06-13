// Invoice PDF template — ported 1:1 from the old-app Blade `invoice.html`.
// Blade {{ }} → JS interpolation (HTML-escaped), @if/@elseif → JS conditionals.
// The per-tenant header block reads from Tenant company-metadata fields; logo and
// approval signature are passed in as base64 data URIs.
import { esc, rupiah, todayDMY } from './_fmt'

export function invoiceHtml({ tenant = {}, talent = {}, approval = null, money = {}, logoDataUri = null, signatureDataUri = null }) {
  const displayName = tenant.invoiceDisplayName ?? tenant.name ?? ''
  const handle      = tenant.invoiceDisplayHandle ?? ''

  // Header: logo + name when a logo exists (e.g. Cleora); text name + handle otherwise.
  const headerCell = logoDataUri
    ? `<td><img src="${logoDataUri}" style="width:100%; max-width:250px;"><br>${esc(displayName)}<br></td>`
    : `<td><strong>${esc(displayName)}</strong><br>${esc(handle)}<br></td>`

  const status = money.statusPayment ?? ''
  let extraRows = ''
  if (status === 'Termin 1' || status === 'Termin 2' || status === 'Termin 3') {
    const t = (money.total ?? 0) / 3
    extraRows = `
      <tr><td>Termin 1</td><td>Rp ${rupiah(t)}</td></tr>
      <tr><td>Termin 2</td><td>Rp ${rupiah(t)}</td></tr>
      <tr><td>Termin 3</td><td>Rp ${rupiah(t)}</td></tr>`
  } else if (status && status !== 'Full Payment') {
    extraRows = `
      <tr><td>Down Payment</td><td>Rp ${rupiah(money.downPayment)}</td></tr>
      <tr><td>Sisa</td><td>Rp ${rupiah(money.sisa)}</td></tr>`
  }

  const signatureCell = signatureDataUri
    ? `<img src="${signatureDataUri}" style="width:50%; max-width:150px;">`
    : `<div style="width:50%; max-width:150px; height:75px; margin:auto; border:1px solid #ccc; display:flex; align-items:center; justify-content:center;">No Image</div>`

  return `<!DOCTYPE html>
<html>
<head>
  <title>Invoice</title>
  <style>
    @page { margin: 0.5cm; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
    .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.15); font-size: 16px; line-height: 22px; color: #555; }
    .invoice-box table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
    .invoice-box table th, .invoice-box table td { padding: 5px; }
    .invoice-box table th { background-color: #f2f2f2; }
    .invoice-box table tr td:nth-child(2) { text-align: right; }
    .invoice-box table tr.top table td { padding-bottom: 20px; }
    .invoice-box table tr.top table td.title { font-size: 55px; line-height: 55px; color: black; }
    .invoice-box table tr.information table td { padding-bottom: 40px; }
    .invoice-box table tr.total td:nth-child(2) { border-top: 2px solid #eee; font-weight: bold; }
    .totals-table { width: 100%; margin-top: 20px; text-align: right; }
    .totals-table td { padding: 5px; text-align: right; }
    .invoice-box .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #fff; background-color: #f5c441; padding: 10px 0; }
    .invoice-box .footer .footer-info { display: flex; justify-content: space-between; padding: 0 15px; }
    .invoice-box .payment-signature-section .payment-method p { margin-block-start: 1px; margin-block-end: 1px; }
  </style>
</head>
<body>
  <div class="invoice-box">
    <table cellpadding="0" cellspacing="0">
      <tr class="top">
        <td colspan="2">
          <table>
            <tr>
              ${headerCell}
              <td class="title">
                INVOICE<br>
                <span style="font-size: 16px; color: #555;">${esc(money.noDocument ?? talent.noDocument ?? '')}</span><br>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr class="information">
        <td colspan="2">
          <table>
            <tr>
              <td style="font-size: 15px;">
                Invoice to: <br><br>
                NIK: ${esc(talent.nik ?? '')}<br>
                ${esc(talent.talentName ?? '')}<br>
                Alamat: ${esc(talent.address ?? '')}<br>
                No HP: ${esc(talent.phoneNumber ?? '')}
              </td>
              <td>
                Invoice#<br>
                Date: ${esc(money.today ?? todayDMY())}<br>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Nama Akun</th>
          <th style="text-align: left;">Quantity Slot</th>
          <th style="text-align: left;">Deskripsi</th>
          <th style="text-align: left;">Harga</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align: left; padding-top:20px; padding-bottom: 20px;">${esc(talent.username ?? '')}</td>
          <td style="text-align: left; padding-top:20px; padding-bottom: 20px;">${esc(talent.slotFinal ?? '')}</td>
          <td style="text-align: left; padding-top:20px; padding-bottom: 20px;">${esc(talent.scopeOfWork ?? '')}</td>
          <td style="text-align: left; padding-top:20px; padding-bottom: 20px; font-size: 20px;">Rp ${rupiah(money.subtotal, 2)}</td>
        </tr>
      </tbody>
    </table>

    <table class="totals-table">
      <tr><td>Subtotal</td><td>Rp ${rupiah(money.subtotal)}</td></tr>
      <tr><td>${esc(money.pphLabel ?? '')}</td><td>Rp ${rupiah(money.pph)}</td></tr>
      <tr><td><strong>TOTAL</strong></td><td><strong>Rp ${rupiah(money.total)}</strong></td></tr>
      ${extraRows}
    </table>

    <table style="width: 100%; margin-top: 40px;">
      <tr>
        <td style="width: 40%; vertical-align: top;">
          <h3 style="margin: 0; padding: 0;">Payment Method</h3>
          <p style="margin: 0; padding: 0;">Bank: <strong>${esc(talent.bank ?? '')}</strong></p>
          <p style="margin: 0; padding: 0;">Atas Nama: <strong>${esc(talent.namaRekening ?? '')}</strong></p>
          <p style="margin: 0; padding: 0;">Account No: <strong>${esc(talent.noRekening ?? '')}</strong></p>
          <p style="margin: 0; padding: 0;">No. NPWP: <strong>${esc(talent.noNpwp ?? '')}</strong></p>
        </td>
        <td style="width: 30%; text-align: center; vertical-align: bottom;">
          <div style="margin-top: 100px;">
            <div style="border-top: 1px solid #555; width: 80%; margin: auto;"></div>
            <p>${esc(talent.talentName ?? '')}</p>
          </div>
        </td>
        <td style="width: 30%; text-align: center;">
          ${signatureCell}
          <div style="border-top: 1px solid #555; width: 80%; margin: auto;"></div>
          <p>${esc(approval?.name ?? '')}</p>
        </td>
      </tr>
    </table>
    Thank you for your business!
    <div class="footer">
      <div class="footer-info">
        <span>${esc(tenant.footerPhone ?? '')}</span>
        <span>${esc(tenant.footerAddress ?? '')}</span>
      </div>
    </div>
  </div>
</body>
</html>`
}
