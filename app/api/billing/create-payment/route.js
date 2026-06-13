import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createSnapTransaction, paymentMode, snapClientConfig } from '@/lib/payment-provider'

// POST /api/billing/create-payment — auth required.
// body: { planSlug, periodMonths? (default 1) }
export async function POST(request) {
  const { error, session } = await requireAuth()
  if (error) return error

  const tenantId = session.user?.tenantId
  const email    = session.user?.email
  if (!tenantId) return NextResponse.json({ error: 'No active tenant' }, { status: 400 })

  let body
  try { body = await request.json() } catch { body = {} }
  const planSlug     = (body.planSlug ?? '').trim()
  const periodMonths = Math.max(1, parseInt(body.periodMonths ?? 1, 10) || 1)
  if (!planSlug) return NextResponse.json({ error: 'planSlug is required' }, { status: 400 })

  // b. Validate plan
  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } })
  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
  }

  // c. Eligibility: trial/grace/suspended → any plan; active → upgrade-only.
  const subscription = await prisma.subscription.findUnique({
    where:   { tenantId },
    include: { plan: true },
  })
  if (!subscription) {
    return NextResponse.json({ error: 'No subscription found for this tenant' }, { status: 400 })
  }
  if (subscription.status === 'active') {
    const current = Number(subscription.plan.priceMonthly)
    const target  = Number(plan.priceMonthly)
    if (target <= current) {
      return NextResponse.json(
        { error: 'You are already on an active plan. Only upgrades are available.' },
        { status: 400 },
      )
    }
  }

  // d–e. Order id + amount (Decimal → Number before arithmetic)
  const orderId = `RDV-${tenantId}-${Date.now()}`
  const amount  = Number(plan.priceMonthly) * periodMonths

  // f. Tenant name for the Snap customer_details
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })

  // g. Create the Snap transaction (mock or live, behind the abstraction)
  let snap
  try {
    snap = await createSnapTransaction({
      orderId,
      amount,
      tenantName: tenant?.name ?? 'Customer',
      email,
      planName:   plan.name,
      planSlug:   plan.slug,
    })
  } catch (e) {
    console.error('CREATE PAYMENT — Snap failed:', e)
    return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 502 })
  }

  // h. Persist the pending PaymentRecord
  await prisma.paymentRecord.create({
    data: {
      tenantId,
      subscriptionId: subscription.id,
      midtransOrderId: orderId,
      amount,
      status:    'pending',
      planId:    plan.id,
      periodMonths,
      snapToken: snap.snapToken,
      snapUrl:   snap.snapUrl,
    },
  })

  // i. Response — `mode` tells the client how to proceed; live also gets the
  //    public client key + Snap.js URL so it can open the Snap popup.
  const mode = paymentMode()
  const payload = { orderId, snapToken: snap.snapToken, snapUrl: snap.snapUrl, mode }
  if (mode === 'live') Object.assign(payload, snapClientConfig())

  return NextResponse.json(payload)
}
