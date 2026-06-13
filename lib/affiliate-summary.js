import { prisma } from '@/lib/prisma'

const num = v => Number(v ?? 0)   // safe for null / Decimal / BigInt
const ratio = (a, b) => (b > 0 ? Number((a / b).toFixed(2)) : null)

// Tenant-scoped current-month affiliate summary across Shopee + TikTok.
// avgRoi / per-creator roi are COMPUTED FROM SUMS (not averaging the stored roi
// column). videoViews (TikTok) is BigInt → wrapped in Number() like everything
// else. Returns null on any failure.
export async function getAffiliateSummary(tenantId) {
  try {
    const now   = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const where = { tenantId, date: { gte: start } }

    const [shopeeAgg, shopeeTop, tiktokAgg, tiktokTop] = await prisma.$transaction([
      prisma.affiliateShopee.aggregate({
        where,
        _sum: { omzetPenjualan: true, biayaIklan: true, komisiAffiliate: true, pesanan: true, clicks: true },
      }),
      prisma.affiliateShopee.groupBy({
        by:      ['username'],
        where,
        _sum:    { omzetPenjualan: true, komisiAffiliate: true, pesanan: true, biayaIklan: true },
        orderBy: { _sum: { omzetPenjualan: 'desc' } },
        take:    5,
      }),
      prisma.affiliateTiktok.aggregate({
        where,
        // videoViews is BigInt — summed here, Number()-wrapped below.
        _sum: { affiliateGmv: true, estCommission: true, productsSold: true, videoViews: true },
      }),
      prisma.affiliateTiktok.groupBy({
        by:      ['creatorUsername'],
        where,
        _sum:    { affiliateGmv: true, estCommission: true, productsSold: true },
        _max:    { affiliateFollowers: true },   // follower count is a snapshot — max, not sum
        orderBy: { _sum: { affiliateGmv: 'desc' } },
        take:    5,
      }),
    ])

    const sOmzet = num(shopeeAgg._sum.omzetPenjualan)
    const sBiaya = num(shopeeAgg._sum.biayaIklan)

    return {
      period: { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) },
      shopee: {
        totals: {
          omzetPenjualan:  sOmzet,
          biayaIklan:      sBiaya,
          komisiAffiliate: num(shopeeAgg._sum.komisiAffiliate),
          pesanan:         num(shopeeAgg._sum.pesanan),
          clicks:          num(shopeeAgg._sum.clicks),
        },
        avgRoi: ratio(sOmzet, sBiaya),
        topCreators: shopeeTop.map(r => {
          const o = num(r._sum.omzetPenjualan), b = num(r._sum.biayaIklan)
          return {
            username:        r.username,
            omzetPenjualan:  o,
            komisiAffiliate: num(r._sum.komisiAffiliate),
            pesanan:         num(r._sum.pesanan),
            roi:             ratio(o, b),
          }
        }),
      },
      tiktok: {
        totals: {
          affiliateGmv:  num(tiktokAgg._sum.affiliateGmv),
          estCommission: num(tiktokAgg._sum.estCommission),
          productsSold:  num(tiktokAgg._sum.productsSold),
          videoViews:    num(tiktokAgg._sum.videoViews),   // BigInt → Number
        },
        topCreators: tiktokTop.map(r => ({
          creatorUsername:    r.creatorUsername,
          affiliateGmv:       num(r._sum.affiliateGmv),
          estCommission:      num(r._sum.estCommission),
          productsSold:       num(r._sum.productsSold),
          affiliateFollowers: num(r._max.affiliateFollowers),
        })),
      },
    }
  } catch (err) {
    console.error('getAffiliateSummary failed:', err?.message)
    return null
  }
}
