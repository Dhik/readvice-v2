// E2E: Talent document exports (Invoice PDF + SPK/MoU PDF).
// Seeds a KOL + Affiliate talent (+ payment + approval) under rocky's tenant,
// logs in, hits the export endpoints with the authenticated session, and asserts
// real PDF bytes come back (not just a 200). Cleans up by id afterwards.
//
// Uses the bare `playwright` library (no @playwright/test runner) + Prisma, same
// harness as add-link-bridge.spec.js. Self-contained: boots the dev server if needed.
require('../scripts/_load-env')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')
const { chromium } = require('playwright')
const { PrismaClient } = require('@prisma/client')

const BASE = 'http://localhost:3006'
const EMAIL = 'rocky@clerinagroup.com'
const PASSWORD = 'Password'
const prisma = new PrismaClient()

let passed = 0, failed = 0
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else      { failed++; console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) }
}
function isPdf(buf) { return buf && buf.length > 4 && buf.slice(0, 5).toString('latin1') === '%PDF-' }

function ping(url) {
  return new Promise(resolve => {
    const req = http.get(url, res => { res.resume(); resolve(true) })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => { req.destroy(); resolve(false) })
  })
}
async function waitForServer(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) { if (await ping(`${BASE}/login`)) return true; await new Promise(r => setTimeout(r, 1500)) }
  return false
}

async function run() {
  let serverChild = null, browser = null
  const seeded = { kolId: null, affId: null, approvalId: null }

  try {
    // ── resolve rocky tenant + seed ──
    const rocky = await prisma.user.findUnique({ where: { email: EMAIL } })
    if (!rocky) throw new Error('rocky user not found')
    let tenantId = rocky.currentTenantId
    if (!tenantId) {
      const pivot = await prisma.tenantUser.findFirst({ where: { userId: rocky.id }, orderBy: { tenantId: 'asc' } })
      tenantId = pivot?.tenantId
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    console.log(`• rocky tenantId=${tenantId} slug=${tenant?.slug}`)

    const approval = await prisma.approval.create({ data: { tenantId, name: 'ZZZ_E2E Signer', photo: 'img/pt_sign.png' } })
    seeded.approvalId = approval.id

    const kol = await prisma.talent.create({ data: {
      tenantId, username: 'zzz_e2e_kol', talentName: 'ZZZ_E2E KOL', type: 'KOL',
      noDocument: 'ZZZ/E2E/INV/00001', nik: '1234567890', address: 'Jl. Test No. 1', phoneNumber: '08123',
      bank: 'BCA', namaRekening: 'PT Test Talent', noRekening: '999888777', noNpwp: '00.000.000.0',
      slotFinal: 2, rateFinal: 5000000, dpAmount: 2500000, scopeOfWork: '2 video', masaKerjasama: '1 bulan',
      platform: 'Tiktok', followers: 50000,
    }})
    seeded.kolId = kol.id
    await prisma.talentPayment.create({ data: { talentId: kol.id, statusPayment: 'DP 50%' } })

    const aff = await prisma.talent.create({ data: {
      tenantId, username: 'zzz_e2e_aff', talentName: 'ZZZ_E2E Aff', type: 'Affiliate',
      rateFinal: 1000000, platform: 'Shopee',
    }})
    seeded.affId = aff.id

    // ── ensure server ──
    if (await ping(`${BASE}/login`)) {
      console.log('• Reusing dev server on :3006')
    } else {
      console.log('• Starting dev server…')
      serverChild = spawn('npm', ['run', 'dev'], { cwd: path.resolve(__dirname, '..'), shell: true, stdio: 'ignore' })
      if (!await waitForServer(120000)) throw new Error('dev server not ready in 120s')
      console.log('• Dev server ready')
    }

    // ── login ──
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('#email', EMAIL)
    await page.fill('#password', PASSWORD)
    await Promise.all([ page.waitForURL('**/dashboard', { timeout: 30000 }), page.click('button[type="submit"]') ])
    check('logged in', page.url().includes('/dashboard'))

    // ── invoice (with approval) ──
    const inv = await context.request.get(`${BASE}/api/talent/${kol.id}/export-invoice?approval=${approval.id}`)
    const invBody = await inv.body()
    check('invoice → 200', inv.status() === 200, `status ${inv.status()}`)
    check('invoice → application/pdf', (inv.headers()['content-type'] || '').includes('application/pdf'), inv.headers()['content-type'])
    check('invoice → %PDF bytes', isPdf(invBody), `first bytes: ${invBody?.slice(0,8).toString('latin1')}`)
    check('invoice → non-trivial size', invBody.length > 1000, `${invBody.length} bytes`)

    // ── invoice without approval (signature optional) ──
    const inv2 = await context.request.get(`${BASE}/api/talent/${kol.id}/export-invoice`)
    check('invoice (no signature) → 200 + %PDF', inv2.status() === 200 && isPdf(await inv2.body()))

    // ── SPK for KOL ──
    const spk = await context.request.get(`${BASE}/api/talent/${kol.id}/export-spk`)
    const spkBody = await spk.body()
    check('SPK (KOL) → 200', spk.status() === 200, `status ${spk.status()}`)
    check('SPK (KOL) → %PDF bytes', isPdf(spkBody), `first bytes: ${spkBody?.slice(0,8).toString('latin1')}`)
    check('SPK (KOL) → non-trivial size', spkBody.length > 1000, `${spkBody.length} bytes`)

    // ── SPK rejected for non-KOL ──
    const spkAff = await context.request.get(`${BASE}/api/talent/${aff.id}/export-spk`)
    check('SPK (Affiliate) → 400', spkAff.status() === 400, `status ${spkAff.status()}`)

    // ── cross-tenant guard: bogus id ──
    const bogus = await context.request.get(`${BASE}/api/talent/99999999/export-invoice`)
    check('invoice (unknown id) → 404', bogus.status() === 404, `status ${bogus.status()}`)

    await context.close()
  } finally {
    console.log('• Cleaning up…')
    try { if (seeded.kolId) await prisma.talent.deleteMany({ where: { id: seeded.kolId } }) } catch (e) { console.error('cleanup kol:', e.message) }
    try { if (seeded.affId) await prisma.talent.deleteMany({ where: { id: seeded.affId } }) } catch (e) { console.error('cleanup aff:', e.message) }
    try { if (seeded.approvalId) await prisma.approval.deleteMany({ where: { id: seeded.approvalId } }) } catch (e) { console.error('cleanup approval:', e.message) }
    await prisma.$disconnect()
    if (browser) await browser.close()
    if (serverChild) { try { serverChild.kill() } catch {} }
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch(e => { console.error('SPEC ERROR:', e); process.exit(1) })
