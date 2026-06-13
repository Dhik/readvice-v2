// Seeds realistic Talent data (talents + content + payments + content-creator
// rows + approval signers) for testing the /talent pages.
//
//   node scripts/seed-talent.js [tenantSlug]      (default: cleora-beauty)
//
// Idempotent: seeded talents are tagged with gdriveKolAccepting='seeded' (a
// non-displayed field) and removed on each run before re-seeding, so re-running
// refreshes rather than duplicates. Only touches the chosen tenant.
require('./_load-env')
const { PrismaClient } = require('@prisma/client')
const { faker } = require('@faker-js/faker')

const prisma = new PrismaClient()
const SLUG = process.argv[2] || 'cleora-beauty'
const MARKER = 'seeded'

const randInt  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const randFrom = arr => arr[Math.floor(Math.random() * arr.length)]
const chance   = p => Math.random() < p
const noon     = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x }
const daysAgo  = n => noon(new Date(Date.now() - n * 86_400_000))
const round    = (v, step = 1000) => Math.round(v / step) * step

const TYPES      = ['Affiliate', 'KOL', 'Content Creator', 'Clipper']
const TYPE_PLAN  = { Affiliate: 7, KOL: 8, 'Content Creator': 5, Clipper: 4 }   // 24 total
const PLATFORMS  = ['Instagram', 'Tiktok', 'Youtube', 'Twitter', 'Shopee']
const BANKS      = ['BCA', 'BNI', 'Mandiri', 'BRI', 'CIMB Niaga']
const PICS       = ['Ari', 'Dina', 'Rizky', 'Sari', 'Bagus', 'Nadia']
const NICHES     = ['Beauty', 'Skincare', 'Fashion', 'Lifestyle', 'Food', 'Tech', 'Parenting', 'Travel']
const PRODUKS    = ['Serum Vitamin C', 'Sunscreen SPF50', 'Moisturizer', 'Lip Tint', 'Facial Wash', 'Toner', 'Day Cream', 'Brightening Mask']
const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December']
const STATUSES   = ['Full Payment', 'DP 50%', 'Pelunasan 50%', 'Termin 1', 'Termin 2', 'Termin 3']
const PREFIXES   = { cleora: 'CLR', azrina: 'AZR', delmoura: 'DLM' }

function docNumber(dealingDate, slug, dealingNumber) {
  const d   = new Date(dealingDate)
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const yy  = String(d.getFullYear()).slice(-2)
  const pfx = PREFIXES[slug?.toLowerCase()] ?? 'ORG'
  return `${mm}${yy}/INV/${pfx}/${String(dealingNumber).padStart(5, '0')}`
}

// amountTf transferred for a given payment status (portion of the rate).
function paidAmount(status, rate) {
  if (status === 'Full Payment' || status === 'Pelunasan 50%') return rate
  if (status === 'DP 50%') return round(rate * 0.5)
  return round(rate / 3)   // Termin 1/2/3
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } })
  if (!tenant) {
    const all = await prisma.tenant.findMany({ select: { slug: true, name: true } })
    console.error(`Tenant slug "${SLUG}" not found. Available:`, all.map(t => t.slug).join(', '))
    process.exit(1)
  }
  const tenantId = tenant.id
  const owner = await prisma.user.findFirst({ where: { currentTenantId: tenantId }, select: { id: true } })
  const createdBy = owner?.id ?? null

  // ── wipe previous seed batch (cascade removes content/payments/CC) ──
  const del = await prisma.talent.deleteMany({ where: { tenantId, gdriveKolAccepting: MARKER } })

  let dealingSeq = 0
  const stats = { talents: 0, content: 0, contentDone: 0, contentRefund: 0, payments: 0, paymentsPaid: 0, cc: 0 }

  for (const type of TYPES) {
    for (let i = 0; i < TYPE_PLAN[type]; i++) {
      dealingSeq += 1
      const createdAt   = daysAgo(randInt(3, 120))     // all well after the 2025-07-24 KPI baseline
      const dealingDate = daysAgo(randInt(3, 120))
      const platform    = type === 'Affiliate' ? randFrom(['Shopee', 'Tiktok']) : randFrom(PLATFORMS)
      const rateFinal   = randInt(1, 15) * 1_000_000
      const slotFinal   = randInt(1, 5)

      // DP scenario → drives hutang/piutang variety on the report page.
      const dpRoll = Math.random()
      const dpAmount = dpRoll < 0.30 ? 0
        : dpRoll < 0.60 ? round(rateFinal * 0.5)
        : dpRoll < 0.85 ? rateFinal
        : round(rateFinal * (0.2 + Math.random() * 0.5))

      const isAgency = chance(0.25)
      const personName = faker.person.fullName()
      const namaRekening = isAgency ? `${randFrom(['PT', 'CV'])} ${faker.company.name()}` : personName

      const talent = await prisma.talent.create({
        data: {
          tenantId,
          username:       faker.internet.username().toLowerCase().slice(0, 24),
          talentName:     personName,
          type,
          platform,
          noDocument:     docNumber(dealingDate, SLUG, dealingSeq),
          contentType:    randFrom(['Soft Selling', 'Hard Selling', 'Awareness']),
          produk:         randFrom(PRODUKS),
          pic:            randFrom(PICS),
          bulanRunning:   randFrom(MONTHS),
          niche:          randFrom(NICHES),
          followers:      randInt(5, 2000) * 1000,
          address:        faker.location.streetAddress(),
          phoneNumber:    '08' + faker.string.numeric(10),
          bank:           randFrom(BANKS),
          noRekening:     faker.string.numeric(10),
          namaRekening,
          noNpwp:         faker.string.numeric({ length: 15 }),
          nik:            faker.string.numeric(16),
          dealingDate,
          dealingNumber:  String(dealingSeq),
          priceRate:      rateFinal + randInt(0, 3) * 500_000,
          firstRateCard:  rateFinal + randInt(0, 4) * 500_000,
          slotFinal,
          rateFinal,
          dpAmount,
          taxPercentage:  null,
          scopeOfWork:    `${slotFinal} konten ${platform}`,
          masaKerjasama:  randFrom(['1 bulan', '2 minggu', '3 bulan', '6 minggu']),
          affiliateStatus: type === 'Affiliate' ? randFrom(['New', 'Existing']) : null,
          gdriveKolAccepting: MARKER,
          createdAt,
        },
      })
      stats.talents += 1

      // ── Content Creator extra record ──
      if (type === 'Content Creator') {
        await prisma.contentCreator.create({
          data: {
            talentId: talent.id, tenantId,
            objektif: randFrom(['Awareness', 'Konversi', 'Engagement']),
            pillar:   randFrom(['Edukasi', 'Hiburan', 'Promosi']),
            subPillar: 'Tips & Trick',
            hook:     faker.lorem.sentence(6),
            referensi: faker.internet.url(),
            briefKonten: faker.lorem.paragraph(),
            caption:  faker.lorem.sentence(10),
            assigneeContentEditor: randFrom(PICS),
            bookingTalentDate: daysAgo(randInt(1, 40)),
            productionDate:    daysAgo(randInt(1, 30)),
          },
        })
        stats.cc += 1
      }

      // ── Content rows (some done, some pending, a few refunded; a few today) ──
      const contentCount = randInt(1, slotFinal + 1)
      for (let c = 0; c < contentCount; c++) {
        const done     = chance(0.6)
        const isRefund = chance(0.08)
        const today    = chance(0.12)
        const posting  = today ? noon(new Date()) : (chance(0.2) ? daysAgo(-randInt(1, 10)) : daysAgo(randInt(1, 50)))
        await prisma.talentContent.create({
          data: {
            talentId: talent.id,
            campaignId: null,
            dealingUploadDate: daysAgo(randInt(5, 55)),
            postingDate: posting,
            done,
            isRefund,
            uploadLink: done ? faker.internet.url() : null,
            finalRateCard: round(rateFinal / slotFinal),
            picCode:  chance(0.5) ? 'PIC' + faker.string.numeric(3) : null,
            boostCode: chance(0.4) ? 'BST' + faker.string.numeric(4) : null,
            createdBy,
            createdAt: daysAgo(randInt(1, 60)),
          },
        })
        stats.content += 1
        if (done && !isRefund) stats.contentDone += 1
        if (isRefund) stats.contentRefund += 1
      }

      // ── Payment rows (mix of done / pending) ──
      const payCount = randInt(1, 3)
      for (let p = 0; p < payCount; p++) {
        const status = randFrom(STATUSES)
        const paid   = chance(0.6)
        await prisma.talentPayment.create({
          data: {
            talentId: talent.id,
            statusPayment: status,
            tanggalPengajuan: daysAgo(randInt(5, 70)),
            donePayment: paid ? daysAgo(randInt(1, 40)) : null,
            amountTf:    paid ? paidAmount(status, rateFinal) : null,
            createdAt:   daysAgo(randInt(1, 70)),
          },
        })
        stats.payments += 1
        if (paid) stats.paymentsPaid += 1
      }
    }
  }

  // ── Approval signers (only if none exist for this tenant) ──
  const approvalCount = await prisma.approval.count({ where: { tenantId } })
  if (approvalCount === 0) {
    for (const name of ['Fahry Husein', 'Clerina Wijaya', 'Direktur Operasional']) {
      await prisma.approval.create({ data: { tenantId, name, photo: null } })
    }
  }

  console.log(`\n✓ Talent seed complete for tenant "${tenant.name}" (slug=${SLUG}, id=${tenantId})`)
  if (del.count) console.log(`  (removed ${del.count} previously-seeded talents first)`)
  console.log(`  talents:   ${stats.talents}  (Affiliate/KOL/Content Creator/Clipper = ${Object.values(TYPE_PLAN).join('/')})`)
  console.log(`  content:   ${stats.content}  (done: ${stats.contentDone}, refunded: ${stats.contentRefund})`)
  console.log(`  payments:  ${stats.payments}  (paid: ${stats.paymentsPaid}, pending: ${stats.payments - stats.paymentsPaid})`)
  console.log(`  content-creator records: ${stats.cc}`)
  console.log(`  approvals: ${approvalCount === 0 ? 3 : `${approvalCount} kept`}`)
  console.log(`\n  → Log in to that tenant and open /talent, /talent/content, /talent/payments, /talent/payments/report, /talent/approval`)
}

main()
  .catch(e => { console.error('SEED FAILED:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
