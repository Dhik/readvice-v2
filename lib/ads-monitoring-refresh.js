import { prisma } from '@/lib/prisma'

const CHANNEL_CONFIG = {
  meta_ads:   { model: 'adSpentMeta',   denomField: 'conversions' },
  shopee_ads: { model: 'adSpentShopee', denomField: 'orders' },
  tiktok_ads: { model: 'adSpentTiktok', denomField: 'conversions' },
  lazada_ads: { model: 'adSpentLazada', denomField: 'orders' },
}


export const CHANNELS = ['meta_ads', 'shopee_ads', 'tiktok_ads', 'lazada_ads']

export async function refreshChannel(tenantId, channel) {
  const config = CHANNEL_CONFIG[channel]
  if (!config) throw new Error(`Unknown channel: ${channel}`)

  const now        = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  const rows = await prisma[config.model].findMany({
    where:  { tenantId, date: { gte: monthStart, lte: monthEnd } },
    select: { date: true, spent: true, revenue: true, [config.denomField]: true },
  })

  const byDate = {}
  for (const r of rows) {
    const key = r.date.toISOString().substring(0, 10)
    if (!byDate[key]) byDate[key] = { spent: 0, revenue: 0, denom: 0 }
    byDate[key].spent   += Number(r.spent   ?? 0)
    byDate[key].revenue += Number(r.revenue ?? 0)
    byDate[key].denom   += Number(r[config.denomField] ?? 0)
  }

  let datesSync = 0
  for (const [dateStr, d] of Object.entries(byDate)) {
    const date           = new Date(dateStr + 'T00:00:00Z')
    const spentActual    = d.spent
    const gmvActual      = d.revenue
    const denom          = d.denom
    const roasActual     = spentActual > 0 ? gmvActual / spentActual : null
    const cpaActual      = denom       > 0 ? spentActual / denom     : null
    const aovToCpaActual = spentActual > 0 ? gmvActual / spentActual : null

    await prisma.adsMonitoring.upsert({
      where:  { tenantId_date_channel: { tenantId, date, channel } },
      create: { tenantId, date, channel, spentActual, gmvActual, roasActual, cpaActual, aovToCpaActual },
      update: { spentActual, gmvActual, roasActual, cpaActual, aovToCpaActual },
    })
    datesSync++
  }
  return { channel, datesSync }
}
