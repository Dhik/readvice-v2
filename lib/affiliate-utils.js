/**
 * Affiliate module utility functions
 */

/** Extract date from AMS Excel filename: YYYY.MM.DD.xlsx */
export function extractDateFromAmsFilename(filename) {
  const match = filename.match(/(\d{4})\.(\d{2})\.(\d{2})/)
  if (!match) throw new Error(`Invalid AMS filename: ${filename}. Expected YYYY.MM.DD.xlsx`)
  return new Date(`${match[1]}-${match[2]}-${match[3]}`)
}

/** Extract date from TikTok Creator_List filename: YYYYMMDD-YYYYMMDD */
export function extractDateFromCreatorListFilename(filename) {
  const match = filename.match(/(\d{8})-(\d{8})/)
  if (!match) throw new Error(`Invalid Creator List filename. Expected YYYYMMDD-YYYYMMDD pattern`)
  const d = match[1]
  return new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`)
}

/** Extract TikTok video code from URL */
export function extractVideoCode(url) {
  if (!url) return null
  const longMatch = url.match(/video\/(\d+)/)
  if (longMatch) return longMatch[1]
  const shortMatch = url.match(/tiktok\.com\/([A-Za-z0-9]+)\/?$/)
  return shortMatch ? shortMatch[1] : null
}

/** Shopee performance badge by ROI */
export function getShopeePerformanceBadge(roi) {
  const r = parseFloat(roi ?? 0)
  if (r >= 15) return { label: 'Excellent', cls: 'badge-success' }
  if (r >= 10) return { label: 'Good',      cls: 'badge-info'    }
  if (r >= 5)  return { label: 'Average',   cls: 'badge-warning' }
  return              { label: 'Poor',      cls: 'badge-danger'  }
}

/** TikTok performance badge by conversion rate */
export function getTiktokPerformanceBadge(conversionRate) {
  const cr = parseFloat(conversionRate ?? 0)
  if (cr >= 2)   return { label: 'Excellent', cls: 'badge-success' }
  if (cr >= 1)   return { label: 'Good',      cls: 'badge-info'    }
  if (cr >= 0.5) return { label: 'Average',   cls: 'badge-warning' }
  return                { label: 'Poor',      cls: 'badge-danger'  }
}

/** Non-RC activity level badge */
export function getActivityLevelBadge(activeDays) {
  const d = parseInt(activeDays ?? 0)
  if (d >= 20) return { label: 'Very Active', cls: 'badge-success' }
  if (d >= 10) return { label: 'Active',      cls: 'badge-info'    }
  if (d >= 5)  return { label: 'Moderate',    cls: 'badge-warning' }
  return              { label: 'Low',         cls: 'badge-danger'  }
}

/** RC affiliate status: New Affiliate vs Existed */
export function getRcAffiliateStatus(firstAffiliateDate, dealingDate) {
  if (!dealingDate || !firstAffiliateDate) return 'Unknown'
  const diff = (new Date(firstAffiliateDate) - new Date(dealingDate)) / (1000 * 60 * 60 * 24)
  return diff > 7 ? 'New Affiliate' : 'Existed'
}

/** Timeline status relative to dealing date */
export function getTimelineStatus(affiliateDate, dealingDate) {
  if (!dealingDate) return 'Unknown'
  const diff = (new Date(affiliateDate) - new Date(dealingDate)) / (1000 * 60 * 60 * 24)
  if (diff < -7)  return 'Before Dealing'
  if (diff <= 7)  return 'Same Period'
  return 'After Dealing'
}

/** Dealing overall status (two-tier approval) */
export function getDealingOverallStatus(dealing) {
  if (dealing.approvalFromLeaderStatus === 'Approve' &&
      dealing.approvalFromManagementStatus === 'Approve') return 'Approve'
  if (dealing.approvalFromLeaderStatus === 'Reject' ||
      dealing.approvalFromManagementStatus === 'Reject') return 'Reject'
  return 'Pending'
}

/** Check if name is PT or CV (for 2% tax rate) */
export function isPtOrCv(name) {
  const upper = (name ?? '').toUpperCase().trim()
  return upper.startsWith('PT') || upper.startsWith('CV')
}

/** Generate document number: MMYY/INV/{prefix}/{sequence:05d} */
export async function generateDocumentNumber(prisma, tenantId) {
  const now    = new Date()
  const mmyy   = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`
  const prefix = process.env[`TENANT_${tenantId}_PREFIX`] ?? 'RDV'
  const lastDoc = await prisma.talent.findFirst({
    where:   { tenantId, noDocument: { startsWith: `${mmyy}/INV/${prefix}/` } },
    orderBy: { noDocument: 'desc' },
    select:  { noDocument: true },
  })
  const seq = lastDoc ? parseInt(lastDoc.noDocument.split('/').pop()) + 1 : 1
  return `${mmyy}/INV/${prefix}/${String(seq).padStart(5, '0')}`
}

/** Generate dealing number: MMYY/DEAL/{prefix}/{sequence:05d} */
export async function generateDealingNumber(prisma, tenantId) {
  const now    = new Date()
  const mmyy   = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`
  const prefix = process.env[`TENANT_${tenantId}_PREFIX`] ?? 'RDV'
  const last   = await prisma.talent.findFirst({
    where:   { tenantId, dealingNumber: { startsWith: `${mmyy}/DEAL/${prefix}/` } },
    orderBy: { dealingNumber: 'desc' },
    select:  { dealingNumber: true },
  })
  const seq = last ? parseInt(last.dealingNumber.split('/').pop()) + 1 : 1
  return `${mmyy}/DEAL/${prefix}/${String(seq).padStart(5, '0')}`
}

/** RC performance score (0–100) */
export function calcRcScore(roi, activeDays, revenue, maxRevenue) {
  const roiScore = Math.min(parseFloat(roi || 0) / 15 * 40, 40)
  const dayScore = Math.min((activeDays || 0) / 30 * 30, 30)
  const revScore = maxRevenue > 0 ? Math.min((revenue || 0) / maxRevenue * 30, 30) : 0
  return Math.round(roiScore + dayScore + revScore)
}

/** Non-RC performance score (0–100) */
export function calcNonRcScore(activeDays, revenue, followers, maxRevenue, maxFollowers) {
  const dayScore      = Math.min((activeDays || 0) / 30 * 40, 40)
  const revScore      = maxRevenue > 0 ? Math.min((revenue || 0) / maxRevenue * 40, 40) : 0
  const followerScore = maxFollowers > 0 ? Math.min((followers || 0) / maxFollowers * 20, 20) : 0
  return Math.round(dayScore + revScore + followerScore)
}

/** Format number with Indonesian locale */
export function fmtRp(n) {
  return new Intl.NumberFormat('id-ID').format(Math.round(n ?? 0))
}

/** PIC options list */
export const PIC_LIST = ['Anisa', 'Iis', 'Kiki', 'Zalsa', 'Rina', 'Others']
