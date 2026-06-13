import { rapidGet } from '../rapidapi.js'

// tiktok-video-feature-summary.p.rapidapi.com
// GET / ?url=<link>&hd=1  →  { data: { play_count, digg_count, comment_count, ... } }
const HOST = 'tiktok-video-feature-summary.p.rapidapi.com'

export async function scrape(link) {
  const json = await rapidGet(HOST, '/', { url: link, hd: 1 })
  const d = json?.data ?? json ?? {}
  return {
    view:    Number(d.play_count    ?? 0),
    like:    Number(d.digg_count    ?? 0),
    comment: Number(d.comment_count ?? 0),
  }
}
