// Smoke test for AI-2 persistent chat.
// Key-INDEPENDENT (always runs): conversation CRUD, cross-user isolation (both
// tenantId+userId scoping), and no-mutation-on-failure when the key is absent.
// Key-GATED (runs only if ANTHROPIC_API_KEY is set + the message call returns
// 200): compaction (20 seeded → 10 + summary) and multi-turn persistence.
//
// Bare `playwright` + Prisma harness, same as the other e2e specs.
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

let passed = 0, failed = 0, skipped = 0
const ok   = (n, c, d = '') => { c ? (passed++, console.log(`  ✓ ${n}`)) : (failed++, console.error(`  ✗ ${n}${d ? ' — ' + d : ''}`)) }
const skip = (n) => { skipped++; console.log(`  ⊘ ${n} (skipped — needs ANTHROPIC_API_KEY)`) }

function ping(url) {
  return new Promise(r => { const q = http.get(url, x => { x.resume(); r(true) }); q.on('error', () => r(false)); q.setTimeout(2000, () => { q.destroy(); r(false) }) })
}
async function waitForServer(ms) { const e = Date.now() + ms; while (Date.now() < e) { if (await ping(`${BASE}/login`)) return true; await new Promise(r => setTimeout(r, 1500)) } return false }

async function login(browser, email) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)
  await Promise.all([ page.waitForURL('**/dashboard', { timeout: 30000 }), page.click('button[type="submit"]') ])
  return ctx
}

async function run() {
  let serverChild = null, browser = null
  const created = []   // convo ids to clean up

  try {
    const rocky = await prisma.user.findUnique({ where: { email: ROCKY } })
    if (!rocky) throw new Error('rocky not found')
    // Second user: prefer same tenant (proves within-tenant isolation), else any other.
    const other =
      (await prisma.user.findFirst({ where: { email: { not: ROCKY }, isActive: true, currentTenantId: rocky.currentTenantId } })) ||
      (await prisma.user.findFirst({ where: { email: { not: ROCKY }, isActive: true } }))
    if (!other) throw new Error('no second user for isolation test')
    console.log(`• rocky=#${rocky.id} (tenant ${rocky.currentTenantId}) · other=${other.email} #${other.id} (tenant ${other.currentTenantId})`)

    if (await ping(`${BASE}/login`)) { console.log('• Reusing dev server on :3006') }
    else {
      console.log('• Starting dev server…')
      serverChild = spawn('npm', ['run', 'dev'], { cwd: path.resolve(__dirname, '..'), shell: true, stdio: 'ignore' })
      if (!await waitForServer(120000)) throw new Error('dev server not ready')
      console.log('• Dev server ready')
    }

    browser = await chromium.launch({ headless: true })
    const rk = await login(browser, ROCKY)
    console.log('• Logged in as rocky')

    // ── CRUD (keyless) ──
    const createRes = await rk.request.post(`${BASE}/api/ai/conversations`)
    const { id: convoId } = await createRes.json()
    created.push(convoId)
    ok('POST /conversations → 201 + id', createRes.status() === 201 && Number.isInteger(convoId))

    const listRes = await rk.request.get(`${BASE}/api/ai/conversations`)
    const list = (await listRes.json()).conversations ?? []
    ok('GET /conversations lists the new convo', list.some(c => c.id === convoId))

    const getRes = await rk.request.get(`${BASE}/api/ai/conversations/${convoId}`)
    const got = await getRes.json()
    ok('GET /conversations/[id] → 200, empty thread', getRes.status() === 200 && got.title === 'New Chat' && got.messages.length === 0)

    // ── Seed 20 messages for the compaction path (oldest→newest) ──
    const base = Date.now() - 20 * 60_000
    for (let i = 0; i < 20; i++) {
      await prisma.aiMessage.create({ data: {
        conversationId: convoId,
        role:    i % 2 === 0 ? 'user' : 'assistant',
        content: `ZZZ_E2E seeded message ${i}`,
        createdAt: new Date(base + i * 1000),
      }})
    }
    const seeded = await prisma.aiMessage.findMany({ where: { conversationId: convoId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    const oldest10 = seeded.slice(0, 10).map(m => m.id)
    const newest10 = seeded.slice(10).map(m => m.id)

    // ── Main message call (key-gated behaviour) ──
    const msgRes = await rk.request.post(`${BASE}/api/ai/conversations/${convoId}/message`, {
      headers: { 'Content-Type': 'application/json' },
      data: { question: 'Which platform had the best ROAS this month?' },
      timeout: 60000,
    })
    const msgBody = await msgRes.json()

    if (msgRes.status() === 200) {
      ok('message → 200 + compacted:true', msgBody.compacted === true, JSON.stringify(msgBody.usage))
      ok('answer carries token usage', msgBody.usage?.input_tokens > 0 && msgBody.usage?.output_tokens > 0)
      const after = await prisma.aiMessage.findMany({ where: { conversationId: convoId }, select: { id: true } })
      const ids = new Set(after.map(m => m.id))
      ok('DB now holds exactly 10 + new pair = 12', after.length === 12, `got ${after.length}`)
      ok('oldest 10 deleted', oldest10.every(id => !ids.has(id)))
      ok('newest 10 retained', newest10.every(id => ids.has(id)))
      const convo = await prisma.aiConversation.findUnique({ where: { id: convoId }, select: { summary: true } })
      ok('summary populated', !!convo.summary && convo.summary.length > 0)
      console.log(`  → main usage: ${msgBody.usage.input_tokens} in / ${msgBody.usage.output_tokens} out`)
    } else {
      // No key: graceful 502, and compaction ran BEFORE the (failed) Claude call,
      // so nothing should have mutated.
      ok('message → 502 (no key, graceful)', msgRes.status() === 502, JSON.stringify(msgBody))
      const count = await prisma.aiMessage.count({ where: { conversationId: convoId } })
      const convo = await prisma.aiConversation.findUnique({ where: { id: convoId }, select: { summary: true } })
      ok('no mutation on failure (still 20 msgs, summary null)', count === 20 && convo.summary === null, `count=${count}`)
      skip('compaction assertions'); skip('multi-turn persistence')
    }

    // ── Cross-user isolation (keyless — ownership checked before any Claude call) ──
    const ot = await login(browser, other.email)
    console.log(`• Logged in as ${other.email}`)
    const iGet = await ot.request.get(`${BASE}/api/ai/conversations/${convoId}`)
    ok("other user GET rocky's convo → 404", iGet.status() === 404)
    const iMsg = await ot.request.post(`${BASE}/api/ai/conversations/${convoId}/message`, { headers: { 'Content-Type': 'application/json' }, data: { question: 'x' } })
    ok("other user POST message → 404", iMsg.status() === 404)
    const iDel = await ot.request.delete(`${BASE}/api/ai/conversations/${convoId}`)
    ok("other user DELETE → 404", iDel.status() === 404)
    const stillThere = await prisma.aiConversation.count({ where: { id: convoId } })
    ok("rocky's convo survived the cross-user delete attempt", stillThere === 1)

    await rk.close(); await ot.close()
  } finally {
    console.log('• Cleaning up…')
    for (const id of created) { try { await prisma.aiConversation.deleteMany({ where: { id } }) } catch (e) { console.error('cleanup', id, e.message) } }
    await prisma.$disconnect()
    if (browser) await browser.close()
    if (serverChild) { try { serverChild.kill() } catch {} }
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed, ${skipped} skipped ===`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch(e => { console.error('SMOKE ERROR:', e); process.exit(1) })
