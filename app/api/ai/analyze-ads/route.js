import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAdsSummary } from '@/lib/ads-summary'

export const runtime = 'nodejs'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const question = (body.question ?? '').trim()
  if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })

  const data = await getAdsSummary(session.user.tenantId)

  // Key resolves from ANTHROPIC_API_KEY in the environment — server-side only,
  // never exposed to the client.
  try {
    const anthropic = new Anthropic()
    const res = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:
        'You are a marketing analyst. Analyze the provided ad performance DATA and answer. ' +
        'Use ONLY the numbers given — do not invent figures. Amounts are in Indonesian Rupiah (IDR).',
      messages: [{
        role:    'user',
        content: `Question: ${question}\n\nDATA (current month, your account only):\n${JSON.stringify(data)}`,
      }],
    })

    const answer = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    return NextResponse.json({
      answer,
      usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens },
    })
  } catch (err) {
    console.error('analyze-ads Claude call failed:', err?.message)
    const msg = err?.status === 401
      ? 'AI service auth failed — check ANTHROPIC_API_KEY on the server.'
      : 'AI analysis failed. Please try again.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
