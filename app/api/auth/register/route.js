import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

// ── PUBLIC ENDPOINT (no auth) ────────────────────────────────────────────────
// TODO(security, S-later): add rate limiting (e.g. per-IP, 5 req / 10 min) before
// production. Unauthenticated + creates DB rows (user/tenant/subscription) → abuse
// surface. Consider an IP+email throttle and basic bot protection.

const TRIAL_DAYS    = 7
const DEFAULT_ROLE  = 'brand_manager' // self-registered users are brand owners
const SALT_ROUNDS   = 10
const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// lowercase, strip accents (handles Indonesian brand names), specials → hyphen
function slugify(input) {
  return (input || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'brand'
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name      = (body.name ?? '').trim()
  const email     = (body.email ?? '').trim().toLowerCase()
  const password  = body.password ?? ''
  const brandName = (body.brandName ?? '').trim()
  const planSlug  = (body.plan ?? '').trim()

  // ── Server-side validation (mirror the client form) ──────────────────────
  if (!name)                       return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  if (!password || password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  if (!brandName)                  return NextResponse.json({ error: 'Brand name is required' }, { status: 400 })
  if (!planSlug)                   return NextResponse.json({ error: 'A plan must be selected' }, { status: 400 })

  // ── Email pre-check: clean error before any writes ───────────────────────
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 400 })

  // ── Resolve plan by slug ─────────────────────────────────────────────────
  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } })
  if (!plan || !plan.isActive) return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })

  // ── Hash password outside the transaction (CPU-bound; keep txn short) ─────
  const hashed = await bcrypt.hash(password, SALT_ROUNDS)

  try {
    await prisma.$transaction(async (tx) => {
      // Compute a collision-free slug. @unique remains the true race guard.
      const base  = slugify(brandName)
      const taken = await tx.tenant.findMany({
        where:  { slug: { startsWith: base } },
        select: { slug: true },
      })
      const used = new Set(taken.map(t => t.slug))
      let slug = base, n = 2
      while (used.has(slug)) slug = `${base}-${n++}`

      // c. Tenant
      const tenant = await tx.tenant.create({
        data: { name: brandName, slug, isActive: true },
      })

      // d. User (currentTenantId → new tenant so they can log in immediately)
      const user = await tx.user.create({
        data: { name, email, password: hashed, currentTenantId: tenant.id, isActive: true },
      })

      // e. Pivot membership (tenant switching / access logic reads this)
      await tx.tenantUser.create({
        data: { tenantId: tenant.id, userId: user.id },
      })

      // f. Default role: brand_manager (full feature access from day one)
      const role = await tx.role.findUnique({ where: { name: DEFAULT_ROLE } })
      if (!role) throw new Error(`Default role "${DEFAULT_ROLE}" not found — seed roles first`)
      await tx.userRole.create({
        data: { userId: user.id, roleId: role.id },
      })

      // g. 7-day trial subscription (grace is for paid subs → null here)
      const now = new Date()
      const end = new Date(now.getTime() + TRIAL_DAYS * 86400000)
      await tx.subscription.create({
        data: {
          tenantId:           tenant.id,
          planId:             plan.id,
          status:             'trial',
          currentPeriodStart: now,
          currentPeriodEnd:   end,
          gracePeriodEnd:     null,
        },
      })
    })
  } catch (e) {
    // Unique-constraint race (email, or — extremely unlikely — slug)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(',') : String(e.meta?.target ?? '')
      if (target.includes('email')) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
      }
      return NextResponse.json({ error: 'A conflict occurred, please try again' }, { status: 409 })
    }
    console.error('REGISTER FAILED:', e)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }

  // Never return the password or the user object.
  return NextResponse.json({ ok: true })
}
