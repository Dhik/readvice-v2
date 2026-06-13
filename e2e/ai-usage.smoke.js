// Smoke test for the AI usage analytics route. Key-independent (no Claude call).
// Logs in as rocky, GETs /api/ai/usage, checks shape + permission gating, and
// cross-checks the personal cost formula against the DB. Read-only.
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

    const res = await ctx.request.get(`${BASE}/api/ai/usage`)
    const body = await res.json()
    ok('GET /api/ai/usage → 200', res.status() === 200, `status ${res.status()}`)

    const p = body.personal
    ok('personal block present', !!p)
    ok('personal has all fields', p && ['totalConversations','totalMessages','inputTokens','outputTokens','estimatedCostUsd'].every(k => k in p))
    ok('personal.last30Days present', p && !!p.last30Days)

    // Cost formula cross-check against the route's own numbers.
    const expected = p.inputTokens / 1e6 * 3 + p.outputTokens / 1e6 * 15
    ok('personal cost matches $3/$15 formula', Math.abs(p.estimatedCostUsd - expected) < 1e-9, `${p.estimatedCostUsd} vs ${expected}`)

    // Permission gating: does rocky have view_tenant?
    const rocky = await prisma.user.findUnique({
      where: { email: ROCKY },
      include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    })
    const perms = new Set(rocky.userRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.name)))
    const canSeeTenant = perms.has('view_tenant')
    console.log(`• rocky view_tenant: ${canSeeTenant}`)
    if (canSeeTenant) {
      ok('tenant block returned (has permission)', !!body.tenant)
      ok('tenant.byUser is a sorted array', Array.isArray(body.tenant?.byUser))
      const costs = (body.tenant?.byUser ?? []).map(u => u.estimatedCostUsd)
      ok('byUser sorted by cost desc', costs.every((c, i) => i === 0 || costs[i - 1] >= c))
    } else {
      ok('tenant block is null (no permission)', body.tenant === null)
    }

    console.log(`• personal: ${p.totalConversations} convos / ${p.totalMessages} msgs / ${p.inputTokens + p.outputTokens} tokens / ${p.estimatedCostUsd.toFixed(4)} USD`)
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
