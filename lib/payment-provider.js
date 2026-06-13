// ─── Payment provider abstraction (Midtrans Snap) ────────────────────────────
// The rest of the codebase imports ONLY from this file — never calls Midtrans
// directly. Flip MIDTRANS_MODE=live + set the keys to go live; nothing else
// in the app changes.
import crypto from 'node:crypto'

const MODE = process.env.MIDTRANS_MODE || 'mock'

// Sandbox hosts. Swap to the production hosts for go-live:
//   app.midtrans.com/snap/v1/transactions  +  app.midtrans.com/snap/snap.js
const SNAP_API_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions'
const SNAP_JS_URL  = 'https://app.sandbox.midtrans.com/snap/snap.js'

export function paymentMode() {
  return MODE
}

// Public client key + Snap.js URL handed to the browser (live mode only).
// Client key is public by design; delivered via API response, not NEXT_PUBLIC_.
export function snapClientConfig() {
  return { clientKey: process.env.MIDTRANS_CLIENT_KEY || '', snapJsUrl: SNAP_JS_URL }
}

/**
 * Create a Snap transaction.
 * @returns {Promise<{ snapToken: string, snapUrl: string }>}
 */
export async function createSnapTransaction({ orderId, amount, tenantName, email, planName, planSlug }) {
  if (MODE !== 'live') {
    // MOCK — no external API call.
    return {
      snapToken: `mock-token-${orderId}`,
      snapUrl:   `/billing/mock-payment?order=${orderId}`,
    }
  }

  // LIVE
  const auth = Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64')
  const res = await fetch(SNAP_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept:         'application/json',
      Authorization:  `Basic ${auth}`,
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: amount },
      customer_details:    { first_name: tenantName, email },
      item_details: [{ id: planSlug, price: amount, quantity: 1, name: planName }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Midtrans Snap request failed (${res.status}): ${detail}`)
  }

  const data = await res.json()
  return { snapToken: data.token, snapUrl: data.redirect_url }
}

/**
 * Verify a Midtrans webhook signature.
 * Live: SHA512(order_id + status_code + gross_amount + server_key) === signature_key
 * Mock: always true.
 * @returns {boolean}
 */
export function verifyWebhookSignature({ orderId, statusCode, grossAmount, serverKey, signatureKey }) {
  if (MODE !== 'live') return true

  const expected = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex')

  return expected === signatureKey
}
