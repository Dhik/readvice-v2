// Smoke for the redesigned usage route: date-range params, daily time series,
// totals/daily consistency, cost formula, tenant block, and no last30Days.
// Key-independent (the usage route makes no Claude call).
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
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0)

async function run() {
  let serverChild = null, browser = null
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

    // Wide range (90 days) so any historical messages are included.
    const end = new Date(); const start = new Date(Date.now() - 90 * 864e5)
    const ymd = d => d.toISOString().slice(0, 10)
    const res = await ctx.request.get(`${BASE}/api/ai/usage?startDate=${ymd(start)}&endDate=${ymd(end)}`)
    const b = await res.json()
    ok('GET usage (range) → 200', res.status() === 200)
    ok('range echoed', b.range?.start === ymd(start) && b.range?.end === ymd(end), JSON.stringify(b.range))

    const p = b.personal
    ok('personal has totals + daily array', p && ['totalConversations','totalMessages','inputTokens','outputTokens','estimatedCostUsd'].every(k => k in p) && Array.isArray(p.daily))
    ok('NO last30Days field (removed)', p && p.last30Days === undefined)
    ok('daily entries well-formed', p.daily.every(d => 'date' in d && 'inputTokens' in d && 'outputTokens' in d && 'messages' in d && 'costUsd' in d))
    ok('daily sums equal totals', sum(p.daily, d => d.inputTokens) === p.inputTokens && sum(p.daily, d => d.outputTokens) === p.outputTokens && sum(p.daily, d => d.messages) === p.totalMessages,
       `Σin=${sum(p.daily,d=>d.inputTokens)} vs ${p.inputTokens}`)
    const expCost = p.inputTokens / 1e6 * 3 + p.outputTokens / 1e6 * 15
    ok('cost = $3/$15 formula', Math.abs(p.estimatedCostUsd - expCost) < 1e-9)
    ok('daily sorted ascending by date', p.daily.every((d, i) => i === 0 || p.daily[i-1].date <= d.date))

    const rocky = await prisma.user.findUnique({ where: { email: ROCKY }, include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } } })
    const canTenant = new Set(rocky.userRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.name))).has('view_tenant')
    if (canTenant) {
      ok('tenant block present (view_tenant)', !!b.tenant && Array.isArray(b.tenant.daily) && Array.isArray(b.tenant.byUser))
      const costs = (b.tenant?.byUser ?? []).map(u => u.estimatedCostUsd)
      ok('tenant.byUser sorted by cost desc', costs.every((c, i) => i === 0 || costs[i-1] >= c))
    } else {
      ok('tenant null (no permission)', b.tenant === null)
    }

    // Narrow range (today only) should be ⊆ wide range.
    const today = ymd(end)
    const res2 = await ctx.request.get(`${BASE}/api/ai/usage?startDate=${today}&endDate=${today}`)
    const b2 = await res2.json()
    ok('narrow range → 200 + range applied', res2.status() === 200 && b2.range.start === today && b2.range.end === today)
    ok('narrow totals ≤ wide totals (filter works)', b2.personal.totalMessages <= p.totalMessages)

    console.log(`  → wide range: ${p.totalMessages} msgs over ${p.daily.length} day(s), ${p.inputTokens + p.outputTokens} tokens, $${p.estimatedCostUsd.toFixed(4)}`)
    await ctx.close()
  } finally {
    await prisma.$disconnect()
    if (browser) await browser.close()
    if (serverChild) { try { serverChild.kill() } catch {} }
  }
  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`)
  process.exit(failed === 0 ? 0 : 1)
}
run().catch(e => { console.error('SMOKE ERROR:', e); process.exit(1) })
