import { rapidGet } from '../rapidapi.js'

// youtube342.p.rapidapi.com
// GET /api/v1/video/details?id=<videoId>  →  video object with statistics.
// NOTE: confirm the exact path/field names against your RapidAPI subscription;
// the field mapping below covers the common shapes (top-level + nested stats).
const HOST = 'youtube342.p.rapidapi.com'

function extractVideoId(link) {
  const m = String(link).match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([\w-]{11})/)
  return m ? m[1] : String(link)
}

export async function scrape(link) {
  const id = extractVideoId(link)
  const json = await rapidGet(HOST, '/api/v1/video/details', { id })
  const d = json?.data ?? json ?? {}
  const stats = d.statistics ?? d.stats ?? d

  const view =
    stats.viewCount ?? stats.view_count ?? stats.views ?? stats.play_count ?? 0
  const like =
    stats.likeCount ?? stats.like_count ?? stats.likes ?? 0
  const comment =
    stats.commentCount ?? stats.comment_count ?? stats.comments ?? 0

  return { view: Number(view), like: Number(like), comment: Number(comment) }
}
