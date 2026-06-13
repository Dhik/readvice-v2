import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDataContext } from '@/lib/data-context'
import { assertFeature, assertAiQuota, GateError } from '@/lib/subscription-gate'

export const runtime = 'nodejs'

const MODEL = 'claude-sonnet-4-6'
const KEEP  = 10   // live message window
const COMPACT_AT = 20   // trigger: 10 live + 10 accumulated since last summary

// Explicit chart triggers (case-insensitive substring). 'tampilkan' is broad —
// non-chart "tampilkan…" queries still parse fine and fall back to chart:null.
const CHART_TRIGGERS = ['grafik', 'chart', 'visualisasikan', 'tampilkan', 'plot']

const CHART_INSTRUCTION =
  '\n\nIf a chart would help answer this question, respond with ONLY valid JSON (no markdown, no backticks) in this exact format:\n' +
  '{ "text": "your analysis here", "chart": { "type": "bar|line|doughnut", "title": "...", "labels": [...], "datasets": [{"label":"...","data":[...]}] } }\n' +
  'If a chart would NOT help, respond with ONLY valid JSON: { "text": "your analysis", "chart": null }'

const textOf = (res) => res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()

// Server-side gatekeeper: only a well-formed spec is allowed to reach the canvas.
function validChart(c) {
  const types = ['bar', 'line', 'doughnut']
  if (!c || typeof c !== 'object' || !types.includes(c.type)) return null
  if (!Array.isArray(c.labels) || !Array.isArray(c.datasets)) return null
  if (!c.datasets.every(d => d && Array.isArray(d.data))) return null
  return {
    type:     c.type,
    title:    typeof c.title === 'string' ? c.title : '',
    labels:   c.labels,
    datasets: c.datasets,
  }
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId, id: userId } = session.user

  // Feature + quota gate — before any AI work. Own try/catch so a GateError is
  // not swallowed by the 502 handler around the Anthropic call below.
  try {
    const plan = await assertFeature(tenantId, 'hasAi')   // 403 if plan has no AI
    await assertAiQuota(tenantId, plan)                    // 429 if quota exceeded
  } catch (e) {
    if (e instanceof GateError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  const { id } = await params
  const convoId = parseInt(id)

  // Step 1 — ownership (tenantId AND userId) + validate.
  const convo = await prisma.aiConversation.findFirst({
    where: { id: convoId, tenantId, userId },
  })
  if (!convo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const question = (body.question ?? '').trim()
  if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })

  const chartMode = CHART_TRIGGERS.some(t => question.toLowerCase().includes(t))

  // Step 2 — load history (pre-question), ordered oldest→newest.
  const history = await prisma.aiMessage.findMany({
    where:   { conversationId: convoId },
    orderBy: { createdAt: 'asc' },
    select:  { id: true, role: true, content: true },
  })

  let summary   = convo.summary
  let compacted = false
  let live      = history

  try {
    const anthropic = new Anthropic()
    // Step 3 — compaction: fold everything older than the last 10 into `summary`,
    // then delete exactly those rows by id.
    if (history.length >= COMPACT_AT) {
      const toCompact  = history.slice(0, history.length - KEEP)   // oldest, length ≥ 10
      const transcript = toCompact.map(m => `${m.role}: ${m.content}`).join('\n')
      const sumRes = await anthropic.messages.create({
        model:      MODEL,
        max_tokens: 500,
        system:
          'Summarize this conversation history concisely, preserving key facts, numbers, and decisions. ' +
          'This summary will be used as context.',
        messages: [{
          role:    'user',
          content: (summary ? `Previous summary: ${summary}\n\n` : '') + transcript,
        }],
      })
      summary = textOf(sumRes)
      await prisma.aiConversation.update({ where: { id: convoId }, data: { summary } })
      await prisma.aiMessage.deleteMany({
        where: { id: { in: toCompact.map(m => m.id) }, conversationId: convoId },
      })
      live = history.slice(history.length - KEEP)
      compacted = true
    }

    // Step 4 — assemble + main call. Stable data + summary go in `system`; only
    // the live turns + new question go in `messages` (token discipline).
    // getDataContext picks Ads / Campaign / Talent / Affiliate data based on the
    // question. Talent is permission-gated server-side inside getDataContext.
    const ctx = await getDataContext(question, tenantId, session)
    const dataSection =
      'DATA (current month, your account only):\n' +
      (ctx.ads       ? 'ADS:\n' + JSON.stringify(ctx.ads) : '') +
      (ctx.campaign  ? '\nCAMPAIGN:\n' + JSON.stringify(ctx.campaign) : '') +
      (ctx.talent    ? '\nTALENT:\n' + JSON.stringify(ctx.talent) : '') +
      (ctx.affiliate ? '\nAFFILIATE:\n' + JSON.stringify(ctx.affiliate) : '')

    const system =
      'You are a marketing analyst for this brand. Use ONLY the provided data and conversation context. ' +
      'Do not invent figures. Amounts are in Indonesian Rupiah (IDR).' +
      (summary ? `\n\nPrevious context: ${summary}` : '') +
      `\n\n${dataSection}` +
      (ctx.talentGated ? '\n\nNote: talent/payment data is restricted for this user — do not speculate about talent finances.' : '') +
      (chartMode ? CHART_INSTRUCTION : '')

    const res = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: chartMode ? 1500 : 1024,   // room for chart-spec JSON
      system,
      messages: [
        ...live.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: question },
      ],
    })

    const inputTokens  = res.usage.input_tokens
    const outputTokens = res.usage.output_tokens

    // Step 4b — in chartMode, parse the JSON envelope. Any failure falls back to
    // plain text (answer = raw output, chart = null) — never throws.
    const fullText = textOf(res)
    let answer = fullText
    let chart  = null
    if (chartMode) {
      let raw = fullText.trim()
      if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed.text === 'string') {
          answer = parsed.text
          chart  = validChart(parsed.chart)
        }
      } catch { /* not JSON — keep answer = fullText, chart = null */ }
    }

    // Step 5 — persist the user+assistant pair only on success (keeps history an
    // even, alternating, user-first sequence — no orphan rows on failure).
    const isFirst = history.length === 0
    const [, assistantMsg] = await prisma.$transaction([
      prisma.aiMessage.create({ data: { conversationId: convoId, role: 'user', content: question } }),
      prisma.aiMessage.create({
        // Persist the validated chart spec so it survives reload (omit when null
        // to keep the Json column NULL without Prisma.JsonNull handling).
        data: { conversationId: convoId, role: 'assistant', content: answer, inputTokens, outputTokens, ...(chart ? { chart } : {}) },
      }),
      prisma.aiConversation.update({
        where: { id: convoId },
        data:  { updatedAt: new Date(), ...(isFirst ? { title: question.slice(0, 60) } : {}) },
      }),
    ])

    // Step 6 — return. `chart` and `sources` are session-only (not persisted);
    // the page renders them under this bubble. Rehydrated history has neither.
    return NextResponse.json({
      message: {
        id:           assistantMsg.id,
        role:         'assistant',
        content:      answer,
        inputTokens,
        outputTokens,
        createdAt:    assistantMsg.createdAt,
        chart,
        sources:      ctx.sources,
        talentGated:  ctx.talentGated ?? false,
      },
      usage:     { input_tokens: inputTokens, output_tokens: outputTokens },
      compacted,
      sources:   ctx.sources,
      talentGated: ctx.talentGated ?? false,
    })
  } catch (err) {
    console.error('chat message Claude call failed:', err?.message)
    const msg = err?.status === 401
      ? 'AI service auth failed — check ANTHROPIC_API_KEY on the server.'
      : 'AI analysis failed. Please try again.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
