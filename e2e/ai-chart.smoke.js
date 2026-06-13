// Smoke test for AI chat chart support.
//  - normal question (no trigger word) → 200, message.chart === null (deterministic)
//  - "grafik" question (trigger) → 200, text answer + a well-formed chart spec
// Needs ANTHROPIC_API_KEY (the message route calls Claude). Cleans up its convo.
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

function isValidChart(c) {
  const types = ['bar', 'line', 'doughnut']
  return !!c && types.includes(c.type) && Array.isArray(c.labels) &&
    Array.isArray(c.datasets) && c.datasets.every(d => Array.isArray(d.data))
}

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

    // 1) Normal question — no trigger word → chart must be null.
    const normal = await ctx.request.post(`${BASE}/api/ai/conversations/${convoId}/message`, {
      headers: { 'Content-Type': 'application/json' },
      data: { question: 'Which platform spent the most this month?' }, timeout: 60000,
    })
    const nBody = await normal.json()
    ok('normal question → 200', normal.status() === 200, JSON.stringify(nBody).slice(0, 120))
    ok('normal question → chart is null', nBody.message?.chart === null, `chart=${JSON.stringify(nBody.message?.chart)}`)
    ok('normal question → has text answer', typeof nBody.message?.content === 'string' && nBody.message.content.length > 0)

    // 2) Chart question — explicit "grafik" trigger.
    const grafik = await ctx.request.post(`${BASE}/api/ai/conversations/${convoId}/message`, {
      headers: { 'Content-Type': 'application/json' },
      data: { question: 'Buatkan grafik bar yang membandingkan total spend per platform bulan ini.' }, timeout: 60000,
    })
    const gBody = await grafik.json()
    ok('grafik question → 200', grafik.status() === 200, JSON.stringify(gBody).slice(0, 120))
    ok('grafik question → has text answer (not raw JSON)', typeof gBody.message?.content === 'string' && !gBody.message.content.trim().startsWith('{'))
    const chart = gBody.message?.chart
    if (chart) {
      ok('grafik question → well-formed chart spec', isValidChart(chart), JSON.stringify(chart).slice(0, 200))
      console.log(`  → chart: type=${chart.type} labels=${JSON.stringify(chart.labels)} datasets=${chart.datasets.length}`)
    } else {
      // Acceptable per the graceful contract, but note it — the model chose no chart.
      console.log('  ⚠ grafik question returned chart:null (model declined / fallback) — graceful, but no chart to verify')
    }

    // 3) Persistence: stored content is the text answer, never a chart field in DB.
    const stored = await prisma.aiMessage.findMany({ where: { conversationId: convoId, role: 'assistant' }, select: { content: true } })
    ok('stored assistant content is plain text (no JSON envelope persisted)', stored.every(m => !m.content.trim().startsWith('{')))

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
