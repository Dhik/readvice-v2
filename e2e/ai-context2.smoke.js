// Smoke test for AI-6 data context (Ads + Campaign + Talent + Affiliate).
// Verifies: 4-way routing, the Talent permission gate BOTH ways (a user with
// view_talent vs one without), no BigInt 500 (affiliate videoViews / talent),
// and Ads/Campaign regression. Needs ANTHROPIC_API_KEY. Cleans up its convos.
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
const has = (arr, v) => Array.isArray(arr) && arr.includes(v)

async function permsOf(email) {
  const u = await prisma.user.findUnique({
    where: { email },
    include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
  })
  if (!u) return null
  return { id: u.id, tenantId: u.currentTenantId, perms: new Set(u.userRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.name))) }
}

async function login(browser, email) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#email', email); await page.fill('#password', PASSWORD)
  await Promise.all([page.waitForURL('**/dashboard', { timeout: 30000 }), page.click('button[type="submit"]')])
  return ctx
}
async function ask(ctx, convoId, question) {
  const res = await ctx.request.post(`${BASE}/api/ai/conversations/${convoId}/message`, {
    headers: { 'Content-Type': 'application/json' }, data: { question }, timeout: 60000,
  })
  return { status: res.status(), body: await res.json() }
}

async function run() {
  let serverChild = null, browser = null
  const cleanup = []
  try {
    const rocky = await permsOf(ROCKY)
    if (!rocky) throw new Error('rocky not found')
    const rockyHasTalent = rocky.perms.has('view_talent')
    console.log(`• rocky #${rocky.id} tenant ${rocky.tenantId} · view_talent=${rockyHasTalent}`)

    // Find a same-tenant user whose view_talent differs from rocky (to test the other gate branch).
    const others = await prisma.user.findMany({
      where: { email: { not: ROCKY }, isActive: true, currentTenantId: rocky.tenantId },
      select: { email: true },
    })
    let opposite = null
    for (const o of others) {
      const p = await permsOf(o.email)
      if (p && p.perms.has('view_talent') !== rockyHasTalent) { opposite = { ...p, email: o.email }; break }
    }
    console.log(opposite ? `• opposite-perm user: ${opposite.email} view_talent=${opposite.perms.has('view_talent')}` : '• no opposite-perm user found (will skip second gate branch)')

    if (await ping(`${BASE}/login`)) { console.log('• Reusing dev server') }
    else {
      console.log('• Starting dev server…')
      serverChild = spawn('npm', ['run', 'dev'], { cwd: path.resolve(__dirname, '..'), shell: true, stdio: 'ignore' })
      if (!await waitForServer(120000)) throw new Error('server not ready')
    }
    browser = await chromium.launch({ headless: true })

    // ── rocky ──
    const rk = await login(browser, ROCKY)
    const { id: convoId } = await (await rk.request.post(`${BASE}/api/ai/conversations`)).json()
    cleanup.push(convoId)

    // Routing (deterministic, permission-independent):
    let r = await ask(rk, convoId, 'Berapa ROAS bulan ini?')
    ok('ads-only → 200 + sources ["ads"]', r.status === 200 && eq(r.body.sources, ['ads']), JSON.stringify(r.body.sources))

    r = await ask(rk, convoId, 'Konten mana yang paling viral bulan ini?')
    ok('campaign-only → 200 + sources ["campaign"]', r.status === 200 && eq(r.body.sources, ['campaign']), JSON.stringify(r.body.sources))

    r = await ask(rk, convoId, 'Affiliate komisi tertinggi bulan ini?')
    ok('affiliate-only → 200 + sources ["affiliate"] (no BigInt 500)', r.status === 200 && eq(r.body.sources, ['affiliate']), JSON.stringify(r.body.sources))

    // Talent gate as rocky:
    r = await ask(rk, convoId, 'Talent mana yang belum lunas pelunasan?')
    ok('talent question → 200 (no BigInt 500)', r.status === 200, `status ${r.status}`)
    if (rockyHasTalent) {
      ok('talent (rocky has view_talent) → sources includes talent', has(r.body.sources, 'talent'), JSON.stringify(r.body.sources))
      ok('talent (rocky) → talentGated false', r.body.talentGated === false)
    } else {
      ok('talent (rocky lacks view_talent) → talentGated true', r.body.talentGated === true)
      ok('talent (rocky blocked) → talent NOT in sources', !has(r.body.sources, 'talent'), JSON.stringify(r.body.sources))
    }

    // Broad → all four detected:
    r = await ask(rk, convoId, 'Strategi apa yang paling bagus untuk bulan depan?')
    ok('broad → 200', r.status === 200)
    ok('broad → includes ads+campaign+affiliate', has(r.body.sources,'ads') && has(r.body.sources,'campaign') && has(r.body.sources,'affiliate'), JSON.stringify(r.body.sources))
    ok('broad → talent presence matches permission', has(r.body.sources,'talent') === rockyHasTalent && r.body.talentGated === !rockyHasTalent)
    await rk.close()

    // ── opposite-perm user: prove the other gate branch ──
    if (opposite) {
      const ot = await login(browser, opposite.email)
      const { id: convo2 } = await (await ot.request.post(`${BASE}/api/ai/conversations`)).json()
      cleanup.push(convo2)
      const oHas = opposite.perms.has('view_talent')
      const rr = await ask(ot, convo2, 'Talent mana yang belum lunas pelunasan?')
      ok('opposite user talent question → 200', rr.status === 200)
      ok(`opposite user (view_talent=${oHas}) → gate is correct`,
         has(rr.body.sources, 'talent') === oHas && rr.body.talentGated === !oHas,
         `sources=${JSON.stringify(rr.body.sources)} gated=${rr.body.talentGated}`)
      await ot.close()
    }
  } finally {
    for (const id of cleanup) { try { await prisma.aiConversation.deleteMany({ where: { id } }) } catch {} }
    await prisma.$disconnect()
    if (browser) await browser.close()
    if (serverChild) { try { serverChild.kill() } catch {} }
  }
  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`)
  process.exit(failed === 0 ? 0 : 1)
}
run().catch(e => { console.error('SMOKE ERROR:', e); process.exit(1) })
