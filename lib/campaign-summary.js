import { prisma } from '@/lib/prisma'

// Number() helper — safe for null, Decimal, and BigInt. Every numeric field that
// could be a Prisma BigInt or Decimal MUST pass through this before it enters the
// returned object: a single raw BigInt reaching JSON.stringify throws (→ 500).
const num = v => Number(v ?? 0)

// Tenant-scoped, compact Campaign summary — mirrors getAdsSummary. Aggregated
// rows only, never raw records. Returns null on any failure (caller treats as
// "no campaign data"), so a data-fetch error can never crash the chat route.
export async function getCampaignSummary(tenantId) {
  try {
    const now   = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthWhere = { tenantId, createdAt: { gte: start, lte: now } }

    const [
      activeCount,
      activeAgg,
      topCampaigns,
      contentAgg,
      contentDone,
      topKols,
    ] = await prisma.$transaction([
      // Current running state (status-based, not month-filtered).
      prisma.campaign.count({ where: { tenantId, status: 'active' } }),
      prisma.campaign.aggregate({
        where: { tenantId, status: 'active' },
        _sum: { budget: true, totalExpense: true },
      }),
      // Top 5 campaigns by GMV (cumulative standouts).
      prisma.campaign.findMany({
        where:   { tenantId },
        orderBy: { gmv: 'desc' },
        take:    5,
        select:  { id: true, title: true, gmv: true, view: true, cpm: true, status: true },
      }),
      // Content performance — current month.
      prisma.campaignContent.aggregate({
        where: monthWhere,
        _sum:  { view: true, like: true, comment: true },
        _avg:  { cpm: true },
        _count: true,
      }),
      prisma.campaignContent.count({ where: { ...monthWhere, isDelivered: true } }),
      // Top 5 KOLs by views (cumulative standouts).
      prisma.keyOpinionLeader.findMany({
        where:   { tenantId },
        orderBy: { views: 'desc' },
        take:    5,
        select:  { name: true, platform: true, views: true, gmv: true, fee: true },
      }),
    ])

    return {
      period: { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) },
      campaigns: {
        active:       activeCount,
        totalBudget:  num(activeAgg._sum.budget),
        totalExpense: num(activeAgg._sum.totalExpense),
      },
      topByGmv: topCampaigns.map(c => ({
        id:     c.id,
        title:  c.title,
        gmv:    num(c.gmv),
        view:   num(c.view),     // BigInt → Number
        cpm:    num(c.cpm),
        status: c.status ?? null,
      })),
      content: {
        total:   contentAgg._count,
        done:    contentDone,
        view:    num(contentAgg._sum.view),     // BigInt → Number
        like:    num(contentAgg._sum.like),     // BigInt → Number
        comment: num(contentAgg._sum.comment),  // BigInt → Number
        avgCpm:  num(contentAgg._avg.cpm),
      },
      topKols: topKols.map(k => ({
        name:     k.name,
        platform: k.platform ?? null,
        views:    num(k.views),
        gmv:      num(k.gmv),
        fee:      num(k.fee),
      })),
    }
  } catch (err) {
    console.error('getCampaignSummary failed:', err?.message)
    return null
  }
}
