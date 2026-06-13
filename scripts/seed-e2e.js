// Seeds E2E fixtures for the Talent add-link → Campaign bridge test.
// Creates a Campaign + Talent + TalentContent (linked to the campaign) under
// rocky's tenant, all prefixed "ZZZ_E2E_". Prints the created IDs and also
// writes them to e2e/.e2e-ids.json for the Playwright spec to consume.
require('./_load-env')
const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const TEST_EMAIL = 'rocky@clerinagroup.com'

async function main() {
  // 1) Resolve rocky + tenant + permissions
  const rocky = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
    include: {
      userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
    },
  })
  if (!rocky) throw new Error(`Test user ${TEST_EMAIL} not found`)

  // Mirror auth.js: use currentTenantId, else first accessible tenant
  let tenantId = rocky.currentTenantId
  if (!tenantId) {
    const pivot = await prisma.tenantUser.findFirst({
      where: { userId: rocky.id, tenant: { isActive: true } },
      orderBy: { tenantId: 'asc' },
    })
    tenantId = pivot?.tenantId ?? null
  }
  if (!tenantId) throw new Error(`Could not resolve a tenantId for ${TEST_EMAIL}`)

  const perms = [...new Set(rocky.userRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.name)))]
  const hasUpdateTalent = perms.includes('update_talent')

  // 2) Create Campaign
  const campaign = await prisma.campaign.create({
    data: {
      tenantId,
      title:       'ZZZ_E2E_Bridge_Campaign',
      type:        'kol',
      status:      'active',
      createdById: rocky.id,
    },
  })

  // 3) Create Talent
  const talent = await prisma.talent.create({
    data: {
      tenantId,
      username:   'zzz_e2e_talent',
      talentName: 'ZZZ_E2E Talent',
      type:       'KOL',
      pic:        'ZZZ_E2E_PIC',
      produk:     'ZZZ_E2E_PRODUCT',
      followers:  12345,
      slotFinal:  2,
      rateFinal:  2000000,
      platform:   'Tiktok',
    },
  })

  // 4) Create TalentContent linked to the campaign — pending, no upload link yet
  const content = await prisma.talentContent.create({
    data: {
      talentId:      talent.id,
      campaignId:    campaign.id,
      finalRateCard: 1000000,
      done:          false,
      isRefund:      false,
    },
  })

  const ids = {
    tenantId,
    rockyId:    rocky.id,
    campaignId: campaign.id,
    talentId:   talent.id,
    contentId:  content.id,
    talentName: talent.talentName,
    username:   talent.username,
    hasUpdateTalent,
  }

  const outFile = path.resolve(__dirname, '..', 'e2e', '.e2e-ids.json')
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(ids, null, 2))

  console.log('--- E2E seed complete ---')
  console.log(JSON.stringify(ids, null, 2))
  console.log(`tenantId=${tenantId} (rocky currentTenantId=${rocky.currentTenantId})`)
  console.log(`rocky has update_talent permission: ${hasUpdateTalent}`)
  console.log(`ids written to: ${outFile}`)
}

main()
  .catch(e => { console.error('SEED FAILED:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
