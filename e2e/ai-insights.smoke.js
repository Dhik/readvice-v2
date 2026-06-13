// Smoke test for the AI Ads Insights route.
// Logs in as rocky (real browser → NextAuth session) and POSTs one question to
// /api/ai/analyze-ads, then prints the answer + token usage. Read-only: it does
// not seed or mutate data. Without ANTHROPIC_API_KEY set it still exercises
// auth + tenant-scoped aggregation + error handling (expect a 502 from the
// Claude call); with the key set it reports real token usage.
require('../scripts/_load-env')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')
const { chromium } = require('playwright')

const BASE = 'http://localhost:3006'
const EMAIL = 'rocky@clerinagroup.com'
const PASSWORD = 'Password'
const QUESTION = 'Compare Shopee, TikTok and Lazada ROAS this month and say where to shift budget.'

function ping(url) {
  return new Promise(resolve => {
    const req = http.get(url, r => { r.resume(); resolve(true) })
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
  try {
    if (await ping(`${BASE}/login`)) {
      console.log('• Reusing dev server on :3006')
    } else {
      console.log('• Starting dev server…')
      serverChild = spawn('npm', ['run', 'dev'], { cwd: path.resolve(__dirname, '..'), shell: true, stdio: 'ignore' })
      if (!await waitForServer(120000)) throw new Error('dev server not ready in 120s')
      console.log('• Dev server ready')
    }

    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('#email', EMAIL)
    await page.fill('#password', PASSWORD)
    await Promise.all([ page.waitForURL('**/dashboard', { timeout: 30000 }), page.click('button[type="submit"]') ])
    console.log('• Logged in as', EMAIL)

    console.log('• Question:', QUESTION)
    const res = await context.request.post(`${BASE}/api/ai/analyze-ads`, {
      headers: { 'Content-Type': 'application/json' },
      data: { question: QUESTION },
      timeout: 60000,
    })
    const status = res.status()
    const body = await res.json().catch(() => ({}))

    console.log(`\n=== HTTP ${status} ===`)
    if (status === 200) {
      console.log('\nANSWER:\n' + body.answer)
      console.log(`\nUSAGE: ${body.usage.input_tokens} in / ${body.usage.output_tokens} out`)
      // Sonnet 4.6: $3 / 1M in, $15 / 1M out
      const cost = (body.usage.input_tokens / 1e6) * 3 + (body.usage.output_tokens / 1e6) * 15
      console.log(`EST COST: $${cost.toFixed(6)}`)
    } else {
      console.log('BODY:', JSON.stringify(body))
      if (status === 502) console.log('\n(Expected when ANTHROPIC_API_KEY is not set — the pipeline is wired; add the key to get a real answer.)')
    }

    await context.close()
  } finally {
    if (browser) await browser.close()
    if (serverChild) { try { serverChild.kill() } catch {} }
  }
}

run().catch(e => { console.error('SMOKE ERROR:', e); process.exit(1) })
