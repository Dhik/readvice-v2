import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/payment-provider'
import { processPayment } from '@/lib/billing'

// POST /api/billing/webhook — NO auth (Midtrans calls this).
//
// Returns 200 for every valid-signature outcome (paid / failed / ignored / even
// record-not-found) so Midtrans does not retry-storm. The ONLY non-200 is 401
// for an invalid signature — a forged request, never a legitimate retry source.
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    // Malformed payload — nothing to retry. Ack so Midtrans stops.
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const orderId           = body.order_id
  const transactionStatus = body.transaction_status
  const fraudStatus       = body.fraud_status
  const grossAmount       = body.gross_amount      // raw string, signed as-is
  const statusCode        = body.status_code
  const signatureKey      = body.signature_key
  const transactionId     = body.transaction_id

  // Verify signature (mock mode always passes).
  const valid = verifyWebhookSignature({
    orderId,
    statusCode,
    grossAmount,
    serverKey:    process.env.MIDTRANS_SERVER_KEY,
    signatureKey,
  })
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const result = await processPayment({ orderId, transactionStatus, fraudStatus, transactionId })
    if (!result.found) {
      console.warn(`WEBHOOK — no PaymentRecord for order ${orderId}; acking 200`)
    }
  } catch (e) {
    // Log but still ack — a 500 would make Midtrans hammer the endpoint.
    console.error('WEBHOOK — processPayment error:', e)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
