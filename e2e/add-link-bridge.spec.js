// E2E: Talent add-link → Campaign bridge.
// Drives a real Chromium through login + the Add Link modal, then asserts the
// bridge actually wrote CampaignContent + KeyOpinionLeader rows in Postgres
// (via Prisma) — not just the UI. Also proves (campaignId, link) dedup on a
// second add-link with the same link.
//
// Uses the bare `playwright` library (the @playwright/test runner is not
// installed) with a tiny assert harness. Self-contained: boots the dev server
// if it isn't already running, and cleans up all seeded rows at the end.
require('../scripts/_load-env')
const fs = require('fs')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')
const { chromium } = require('playwright')
const { PrismaClient } = require('@prisma/client')

const BASE = 'http://localhost:3006'
const EMAIL = 'rocky@clerinagroup.com'
const PASSWORD = 'Password'
const prisma = new PrismaClient()

const ids = JSON.parse(fs.readFileSync(path.resolve(__dirname, '.e2e-ids.json'), 'utf8'))
const TEST_LINK = `https://example.com/zzz-e2e/${Date.now()}`

// ── tiny assert harness ───────────────────────────────────────────────
let passed = 0, failed = 0
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else      { failed++; console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) }
}

// ── dev-server helpers ────────────────────────────────────────────────
function ping(url) {
  return new Promise(resolve => {
    const req = http.get(url, res => { res.resume(); resolve(true) })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => { req.destroy(); resolve(false) })
  })
}
async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await ping(`${BASE}/login`)) return true
    await new Promise(r => setTimeout(r, 1500))
  }
  return false
}

async function run() {
  let serverChild = null
  let browser = null

  try {
    // 1) Ensure dev server is up
    if (await ping(`${BASE}/login`)) {
      console.log('• Reusing already-running dev server on :3006')
    } else {
      console.log('• Starting dev server (npm run dev)…')
      serverChild = spawn('npm', ['run', 'dev'], {
        cwd: path.resolve(__dirname, '..'),
        shell: true,
        stdio: 'ignore',
      })
      const ready = await waitForServer(120000)
      if (!ready) throw new Error('Dev server did not become ready within 120s')
      console.log('• Dev server ready')
    }

    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()

    // 2) Log in as rocky via the real NextAuth credentials flow
    console.log('• Logging in as', EMAIL)
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('#email', EMAIL)
    await page.fill('#password', PASSWORD)
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 30000 }),
      page.click('button[type="submit"]'),
    ])
    check('logged in (redirected to /dashboard)', page.url().includes('/dashboard'))

    // 3) Open Talent Content, filter to the seeded row
    await page.goto(`${BASE}/talent/content`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[placeholder*="Search username"]', ids.username)
    const row = page.locator('tr', { hasText: ids.username })
    await row.first().waitFor({ timeout: 15000 })

    // 4) Click "+link" → fill modal → submit (full UI path)
    await row.first().locator('button', { hasText: '+link' }).click()
    await page.locator('.modal-box').waitFor({ timeout: 5000 })
    await page.locator('.form-group', { hasText: 'Task Name' }).locator('select').selectOption({ label: 'Soft Selling' })
    await page.locator('.form-group', { hasText: 'Channel' }).locator('select').selectOption({ label: 'Tiktok Video' })
    await page.locator('.form-group', { hasText: 'Upload Link' }).locator('input').fill(TEST_LINK)
    await page.locator('.form-group', { hasText: 'Posting Date' }).locator('input').fill('2026-06-07')
    await page.locator('.form-group', { hasText: 'Kode Ads' }).locator('input').fill('ZZZ_E2E_ADS')

    const resp1 = await Promise.all([
      page.waitForResponse(r => r.url().includes('/add-link') && r.request().method() === 'POST', { timeout: 20000 }),
      page.locator('.modal-box button[type="submit"]').click(),
    ]).then(([r]) => r)
    check('first add-link POST returned 200', resp1.status() === 200, `got ${resp1.status()}`)

    // 5) Assert DB state after first add-link
    const tc1 = await prisma.talentContent.findUnique({ where: { id: ids.contentId } })
    check('TalentContent.done = true', tc1.done === true)
    check('TalentContent.uploadLink = test link', tc1.uploadLink === TEST_LINK, tc1.uploadLink)

    const cc1 = await prisma.campaignContent.findMany({
      where: { campaignId: ids.campaignId, link: TEST_LINK },
    })
    check('exactly 1 CampaignContent for (campaignId, link)', cc1.length === 1, `found ${cc1.length}`)
    if (cc1.length === 1) {
      check('CampaignContent.tenantId = test tenant', cc1[0].tenantId === ids.tenantId, String(cc1[0].tenantId))
      check('CampaignContent.channel normalized to "TikTok video"', cc1[0].channel === 'TikTok video', cc1[0].channel)
      check('CampaignContent.username = talent username', cc1[0].username === ids.username, cc1[0].username)
      check('CampaignContent.taskName = "Soft Selling"', cc1[0].taskName === 'Soft Selling', cc1[0].taskName)
    }

    const kol1 = await prisma.keyOpinionLeader.findMany({
      where: { campaignId: ids.campaignId, name: ids.talentName },
    })
    check('exactly 1 KeyOpinionLeader for (campaignId, name)', kol1.length === 1, `found ${kol1.length}`)
    if (kol1.length === 1) {
      check('KOL.tenantId = test tenant', kol1[0].tenantId === ids.tenantId, String(kol1[0].tenantId))
      check('KOL.contentUrl = test link', kol1[0].contentUrl === TEST_LINK, kol1[0].contentUrl)
      check('KOL.platform normalized to "TikTok video"', kol1[0].platform === 'TikTok video', kol1[0].platform)
    }

    // 6) Second add-link with the SAME link (UI hides +link once a link exists,
    //    so re-hit the same authenticated endpoint directly via the browser's
    //    session cookies). Proves dedup, not duplication.
    console.log('• Second add-link with identical link (dedup check)…')
    const resp2 = await context.request.post(`${BASE}/api/talent-content/${ids.contentId}/add-link`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        task_name:   'Soft Selling',
        channel:     'Tiktok Video',
        upload_link: TEST_LINK,
        posting_date:'2026-06-07',
        kode_ads:    'ZZZ_E2E_ADS',
      },
    })
    check('second add-link POST returned 200', resp2.status() === 200, `got ${resp2.status()}`)

    const cc2 = await prisma.campaignContent.findMany({
      where: { campaignId: ids.campaignId, link: TEST_LINK },
    })
    check('STILL exactly 1 CampaignContent after 2nd add-link (dedup)', cc2.length === 1, `found ${cc2.length}`)

    const kol2 = await prisma.keyOpinionLeader.findMany({
      where: { campaignId: ids.campaignId, name: ids.talentName },
    })
    check('STILL exactly 1 KeyOpinionLeader after 2nd add-link (dedup)', kol2.length === 1, `found ${kol2.length}`)

    await context.close()
  } finally {
    // 7) Cleanup seeded rows by ID. Delete content+talent before campaign
    //    (TalentContent.campaignId has no cascade); campaign delete cascades
    //    CampaignContent + KeyOpinionLeader.
    console.log('• Cleaning up seeded rows…')
    try { await prisma.talentContent.deleteMany({ where: { id: ids.contentId } }) } catch (e) { console.error('cleanup talentContent:', e.message) }
    try { await prisma.talent.deleteMany({ where: { id: ids.talentId } }) } catch (e) { console.error('cleanup talent:', e.message) }
    try { await prisma.campaign.deleteMany({ where: { id: ids.campaignId } }) } catch (e) { console.error('cleanup campaign:', e.message) }
    await prisma.$disconnect()
    if (browser) await browser.close()
    if (serverChild) { try { process.kill(-serverChild.pid) } catch { try { serverChild.kill() } catch {} } }
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch(e => { console.error('SPEC ERROR:', e); process.exit(1) })
