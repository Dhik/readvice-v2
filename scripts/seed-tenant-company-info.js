// Populates Cleora's company metadata (for Invoice / SPK exports) verbatim from
// the old-app templates. azrina/delmoura are left null until their details are
// supplied — they can be filled via the Tenant edit modal.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const CLEORA = {
  invoiceDisplayName:   'PT. Summer Cantika Indonesia',
  invoiceDisplayHandle: null,
  legalName:            'PT Summer Cantika Indonesia',
  companyAddress:       'Ruko Garden City No. 05, Jl. Ciganitri, Ds. Cipagalo, Kec. Bojongsoang Kab. Bandung, Prov. Jawa Barat, Kode Pos 40287',
  companyEmail:         'clerinawijayaindonesia@gmail.com',
  companyPhone:         '08517325324',
  contactPerson:        'Fahry Husein',
  contactTitle:         'CEO Office',
  contactPhone:         '085173069356',
  senderBankName:       'BCA',
  senderBankAccount:    '3372176463',
  senderAccountName:    'PT SUMMER CANTIKA INDONESIA',
  footerPhone:          '0857-9516-1088',
  footerAddress:        'Ruko Garden City No 6, Cipagalo, Bojongsoang',
  logoFile:             'cleora-logo.png',
  letterheadFile:       'pt_sign.png',
}

// Cleora's tenant slug in this DB is 'cleora-beauty'.
const CLEORA_SLUG = 'cleora-beauty'

async function main() {
  const { count } = await prisma.tenant.updateMany({ where: { slug: CLEORA_SLUG }, data: CLEORA })
  if (count === 0) {
    const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, name: true } })
    console.warn('No tenant with slug "cleora" found. Existing tenants:')
    console.warn(JSON.stringify(tenants, null, 2))
    console.warn('Edit the script slug or populate via the Tenant edit modal.')
    return
  }
  console.log(`Updated Cleora company metadata (${count} tenant). azrina/delmoura left null.`)
}

main()
  .catch(e => { console.error('SEED FAILED:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
