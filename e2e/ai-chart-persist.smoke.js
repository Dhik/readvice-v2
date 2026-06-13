// Verifies chart persistence: a "grafik" answer's chart spec survives a reload.
// Sends a chart question, then RE-FETCHES the conversation (the same GET the page
// runs on navigate-back) and asserts the assistant message still carries a chart.
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
function isValidChart(c){const t=['bar','line','doughnut'];return !!c&&t.includes(c.type)&&Array.isArray(c.labels)&&Array.isArray(c.datasets)&&c.datasets.every(d=>Array.isArray(d.data))}

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

    // 1) Ask for a chart (live response).
    const send = await ctx.request.post(`${BASE}/api/ai/conversations/${convoId}/message`, {
      headers: { 'Content-Type': 'application/json' },
      data: { question: 'Buatkan grafik bar perbandingan spend per platform bulan ini.' }, timeout: 60000,
    })
    const sBody = await send.json()
    const liveChart = sBody.message?.chart
    ok('live response → 200', send.status() === 200)
    ok('live response carries a valid chart', isValidChart(liveChart), JSON.stringify(liveChart).slice(0, 160))

    // 2) Re-fetch the conversation — exactly what the page does on navigate-back.
    const reload = await ctx.request.get(`${BASE}/api/ai/conversations/${convoId}`)
    const rBody = await reload.json()
    const assistant = (rBody.messages ?? []).filter(m => m.role === 'assistant').pop()
    ok('reload → conversation fetched', reload.status() === 200 && !!assistant)
    ok('reloaded assistant message still has a valid chart', isValidChart(assistant?.chart), JSON.stringify(assistant?.chart).slice(0, 160))
    // jsonb does not preserve object key order, so compare content (arrays keep order), not raw string.
    const sameContent = !!assistant?.chart && liveChart &&
      assistant.chart.type === liveChart.type &&
      JSON.stringify(assistant.chart.labels) === JSON.stringify(liveChart.labels) &&
      JSON.stringify(assistant.chart.datasets.map(d => d.data)) === JSON.stringify(liveChart.datasets.map(d => d.data))
    ok('reloaded chart content matches the live chart', sameContent)

    // 3) DB-level: chart column actually populated.
    const row = await prisma.aiMessage.findFirst({ where: { conversationId: convoId, role: 'assistant' }, select: { chart: true } })
    ok('chart persisted in DB (ai_messages.chart not null)', !!row?.chart && isValidChart(row.chart))

    if (liveChart) console.log(`  → chart type=${liveChart.type} labels=${JSON.stringify(liveChart.labels)}`)
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
