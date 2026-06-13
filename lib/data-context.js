import { getAdsSummary } from '@/lib/ads-summary'
import { getCampaignSummary } from '@/lib/campaign-summary'
import { getTalentSummary } from '@/lib/talent-summary'
import { getAffiliateSummary } from '@/lib/affiliate-summary'
import { hasPermission } from '@/lib/api-helpers'

const CAMPAIGN_KW = [
  'campaign', 'konten', 'content', 'kol', 'influencer', 'viral', 'fyp',
  'creator', 'brief', 'gmv campaign', 'view', 'like', 'comment', 'cpm',
  'impression content',
]
const ADS_KW = [
  'ads', 'iklan', 'roas', 'spend', 'spent', 'cpc', 'ctr',
  'shopee ads', 'tiktok ads', 'meta ads', 'lazada', 'budget ads',
]
const TALENT_KW = [
  'talent', 'kol payment', 'bayar talent', 'hutang talent', 'piutang',
  'rate talent', 'slot', 'dealing', 'payment talent', 'transfer',
  'pelunasan', 'dp talent',
]
const AFFILIATE_KW = [
  'affiliate', 'creator affiliate', 'komisi', 'omzet affiliate',
  'shopee affiliate', 'tiktok affiliate', 'roi affiliate', 'commission',
]

// Decide which datasets are relevant. None match → all four (broad fallback).
export function detectSources(question) {
  const s = (question ?? '').toLowerCase()
  const m = []
  if (ADS_KW.some(k => s.includes(k)))       m.push('ads')
  if (CAMPAIGN_KW.some(k => s.includes(k)))  m.push('campaign')
  if (TALENT_KW.some(k => s.includes(k)))    m.push('talent')
  if (AFFILIATE_KW.some(k => s.includes(k))) m.push('affiliate')
  return m.length ? m : ['ads', 'campaign', 'talent', 'affiliate']
}

// Fetch only the relevant tenant-scoped summaries. Talent is permission-gated
// SERVER-SIDE here: without `view_talent`, talent data is never fetched, and a
// `talentGated` flag is returned so the route can inform Claude/the user.
// `sources` reflects what was ACTUALLY included (non-null). Never throws.
export async function getDataContext(question, tenantId, session) {
  const want = detectSources(question)
  const out  = { sources: [] }

  if (want.includes('ads')) {
    const d = await getAdsSummary(tenantId).catch(() => null)
    if (d) { out.ads = d; out.sources.push('ads') }
  }
  if (want.includes('campaign')) {
    const d = await getCampaignSummary(tenantId).catch(() => null)
    if (d) { out.campaign = d; out.sources.push('campaign') }
  }
  if (want.includes('talent')) {
    if (hasPermission(session, 'view_talent')) {
      const d = await getTalentSummary(tenantId).catch(() => null)
      if (d) { out.talent = d; out.sources.push('talent') }
    } else {
      out.talentGated = true   // detected but blocked → not fetched, not in sources
    }
  }
  if (want.includes('affiliate')) {
    const d = await getAffiliateSummary(tenantId).catch(() => null)
    if (d) { out.affiliate = d; out.sources.push('affiliate') }
  }

  return out   // { ads?, campaign?, talent?, affiliate?, sources, talentGated? }
}
