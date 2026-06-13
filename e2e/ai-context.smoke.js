// Smoke test for AI data-context routing (Ads + Campaign).
//  - ads-only question     → sources = ['ads']
//  - campaign-only question→ sources = ['campaign']
//  - generic question      → sources = ['ads','campaign']
// Also proves no BigInt leak in getCampaignSummary (a leak → 502, not 200).
// Needs ANTHROPIC_API_KEY (the route calls Claude). Cleans up its convo.
require('../scripts/_load-env')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')
const { chromium } = require('playwright')
const { PrismaClient } = require('@prisma/client')

const BASE = 'http://localhost:3006'
const ROCKY = 'rocky@clerinagroup.com'
const PASSWORD = 'Password'
const prisma = new PrismaClient()

let passed = 0, failed = 0
const ok = (n, c, d = '') => { c ? (passed++, console.log(`  ✓ ${n}`)) : (failed++, console.error(`  ✗ ${n}${d ? ' — ' + d : ''}`)) }
const ping = url => new Promise(r => { const q = http.get(url, x => { x.resume(); r(true) }); q.on('error', () => r(false)); q.setTimeout(2000, () => { q.destroy(); r(false) }) })
async function waitForServer(ms){const e=Date.now()+ms;while(Date.now()<e){if(await ping(`${BASE}/login`))return true;await new Promise(r=>setTimeout(r,1500))}return false}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

async function run() {
  let serverChild = null, browser = null
  const created = []
  try {
    if (await ping(`${BASE}/login`)) { console.log('• Reusing dev server') }
    else {
      console.log('• Starting dev server…')
      serverChild = spawn('npm', ['run', 'dev'], { cwd: path.resolve(__dirname, '..'), shell: true, stdio: 'ignore' })
      if (!await waitForServer(120000)) throw new Error('server not ready')
    }
    browser = await chromium.launch({ headless: true })
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('#email', ROCKY); await page.fill('#password', PASSWORD)
    await Promise.all([page.waitForURL('**/dashboard', { timeout: 30000 }), page.click('button[type="submit"]')])
    console.log('• Logged in as rocky')

    const { id: convoId } = await (await ctx.request.post(`${BASE}/api/ai/conversations`)).json()
    created.push(convoId)

    const cases = [
      { label: 'ads-only',     q: 'Berapa ROAS TikTok ads bulan ini?',                expect: ['ads'] },
      { label: 'campaign-only',q: 'Konten mana yang paling viral bulan ini?',          expect: ['campaign'] },
      { label: 'both',         q: 'Strategi apa yang paling bagus untuk bulan depan?',  expect: ['ads', 'campaign'] },
    ]

    for (const c of cases) {
      const res = await ctx.request.post(`${BASE}/api/ai/conversations/${convoId}/message`, {
        headers: { 'Content-Type': 'application/json' }, data: { question: c.q }, timeout: 60000,
      })
      const body = await res.json()
      ok(`${c.label} → 200 (no BigInt/500)`, res.status() === 200, `status ${res.status()} ${JSON.stringify(body).slice(0,120)}`)
      ok(`${c.label} → sources = [${c.expect}]`, eq(body.sources, c.expect), `got ${JSON.stringify(body.sources)}`)
      ok(`${c.label} → message.sources mirrors response`, eq(body.message?.sources, c.expect))
      console.log(`  → "${c.q}"  sources=${JSON.stringify(body.sources)}`)
    }

    await ctx.close()
  } finally {
    for (const id of created) { try { await prisma.aiConversation.deleteMany({ where: { id } }) } catch {} }
    await prisma.$disconnect()
    if (browser) await browser.close()
    if (serverChild) { try { serverChild.kill() } catch {} }
  }
  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`)
  process.exit(failed === 0 ? 0 : 1)
}
run().catch(e => { console.error('SMOKE ERROR:', e); process.exit(1) })
