import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Claude Sonnet 4.6 pricing — $3.00 / 1M input, $15.00 / 1M output.
const COST_IN_PER_TOKEN  = 3  / 1_000_000
const COST_OUT_PER_TOKEN = 15 / 1_000_000
const costUsd = (inTok, outTok) => inTok * COST_IN_PER_TOKEN + outTok * COST_OUT_PER_TOKEN
const n = v => Number(v ?? 0)   // token columns are Int; defensive
const pad = x => String(x).padStart(2, '0')
// Local calendar day (matches the date picker the user selects, avoids UTC drift).
const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }

// Roll a flat message list into totals + a per-day time series.
function buildBlock(messages) {
  let inputTokens = 0, outputTokens = 0
  const byDay = new Map()
  for (const m of messages) {
    const i = n(m.inputTokens), o = n(m.outputTokens)
    inputTokens += i; outputTokens += o
    const k = dayKey(m.createdAt)
    const d = byDay.get(k) ?? { date: k, inputTokens: 0, outputTokens: 0, messages: 0 }
    d.inputTokens += i; d.outputTokens += o; d.messages += 1
    byDay.set(k, d)
  }
  const daily = [...byDay.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(d => ({ ...d, costUsd: costUsd(d.inputTokens, d.outputTokens) }))
  return {
    totalMessages:    messages.length,
    inputTokens,
    outputTokens,
    estimatedCostUsd: costUsd(inputTokens, outputTokens),
    daily,
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId, id: userId } = session.user
  const canSeeTenant = hasPermission(session, 'view_tenant')

  // Date range — defaults to the last 30 days when not supplied.
  const { searchParams } = new URL(request.url)
  const sp = searchParams.get('startDate')
  const ep = searchParams.get('endDate')
  const end   = ep ? new Date(`${ep}T23:59:59.999`) : new Date()
  const start = sp ? new Date(`${sp}T00:00:00`)     : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const createdAt = { gte: start, lte: end }
  // Echo the user's selected dates verbatim (no UTC round-trip).
  const range = { start: sp || dayKey(start), end: ep || dayKey(end) }

  // ── Personal — scoped to tenantId AND userId ──
  const [pMsgs, pConvos] = await Promise.all([
    prisma.aiMessage.findMany({
      where:  { conversation: { tenantId, userId }, createdAt },
      select: { createdAt: true, inputTokens: true, outputTokens: true },
    }),
    prisma.aiConversation.count({ where: { tenantId, userId, createdAt } }),
  ])
  const personal = { totalConversations: pConvos, ...buildBlock(pMsgs) }

  // ── Tenant — only with view_tenant permission ──
  let tenant = null
  if (canSeeTenant) {
    const [tMsgs, tConvos] = await Promise.all([
      prisma.aiMessage.findMany({
        where:  { conversation: { tenantId }, createdAt },
        select: { createdAt: true, inputTokens: true, outputTokens: true, conversationId: true, conversation: { select: { userId: true } } },
      }),
      prisma.aiConversation.count({ where: { tenantId, createdAt } }),
    ])

    const block = buildBlock(tMsgs)

    // Per-user fold (group via conversation.userId; count distinct conversations).
    const map = new Map()
    for (const m of tMsgs) {
      const uid = m.conversation.userId
      const u = map.get(uid) ?? { userId: uid, inputTokens: 0, outputTokens: 0, convoIds: new Set() }
      u.inputTokens  += n(m.inputTokens)
      u.outputTokens += n(m.outputTokens)
      u.convoIds.add(m.conversationId)
      map.set(uid, u)
    }
    const userIds = [...map.keys()]
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    const nameOf = new Map(users.map(u => [u.id, u.name]))

    const byUser = [...map.values()]
      .map(u => ({
        userId:            u.userId,
        userName:          nameOf.get(u.userId) ?? `User #${u.userId}`,
        inputTokens:       u.inputTokens,
        outputTokens:      u.outputTokens,
        estimatedCostUsd:  costUsd(u.inputTokens, u.outputTokens),
        conversationCount: u.convoIds.size,
      }))
      .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)

    tenant = { totalConversations: tConvos, ...block, byUser }
  }

  return NextResponse.json({ range, personal, tenant })
}
