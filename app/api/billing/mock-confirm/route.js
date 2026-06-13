import { NextResponse } from 'next/server'
import { paymentMode } from '@/lib/payment-provider'
import { processPayment } from '@/lib/billing'

// POST /api/billing/mock-confirm — MOCK MODE ONLY.
// Simulates a successful Midtrans callback by running the same processPayment
// logic the webhook uses. Returns 404 in live mode so it can never be hit.
export async function POST(request) {
  if (paymentMode() !== 'mock') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body
  try { body = await request.json() } catch { body = {} }
  const orderId = (body.orderId ?? '').trim()
  if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })

  const result = await processPayment({
    orderId,
    transactionStatus: 'settlement',
    fraudStatus:       'accept',
    transactionId:     `mock-txn-${orderId}`,
  })
  if (!result.found) {
    return NextResponse.json({ error: 'Payment record not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, redirect: '/dashboard' })
}
