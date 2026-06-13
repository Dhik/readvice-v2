// Scraper service layer for the Campaign module.
// The BLL routes to a platform service by the content's `channel` value and
// gets back normalized { view, like, comment, gmv? } numbers.

import * as tiktok    from './tiktok.js'
import * as instagram from './instagram.js'
import * as youtube   from './youtube.js'
import * as twitter   from './twitter.js'
import * as shopee    from './shopee.js'

// Keys are the exact CHANNEL values used throughout the app.
const CHANNEL_SCRAPERS = {
  'TikTok video':   tiktok,
  'Instagram feed': instagram,
  'youtube video':  youtube,
  'twitter post':   twitter,
  'shopee video':   shopee,
}

export async function scrapeByChannel(channel, link) {
  const mod = CHANNEL_SCRAPERS[channel]
  if (!mod) throw new Error(`Unknown channel: ${channel}`)
  if (!link) throw new Error(`Empty link for channel: ${channel}`)

  const result = await mod.scrape(link)
  if (!result) throw new Error(`Empty scrape result for channel: ${channel}`)

  return {
    view:    Number(result.view    ?? 0),
    like:    Number(result.like    ?? 0),
    comment: Number(result.comment ?? 0),
    ...(result.gmv != null ? { gmv: Number(result.gmv) } : {}),
  }
}

export { CHANNEL_SCRAPERS }
