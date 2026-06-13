import { rapidGet } from '../rapidapi.js'

// instagram-looter2.p.rapidapi.com
// GET /post?url=<link>  →  post media node (Instagram GraphQL-shaped JSON).
// Field names vary by post type, so map defensively across the known variants.
const HOST = 'instagram-looter2.p.rapidapi.com'

export async function scrape(link) {
  const json = await rapidGet(HOST, '/post', { url: link })
  const d = json?.data ?? json ?? {}

  const like =
    d.like_count ??
    d.edge_media_preview_like?.count ??
    d.edge_liked_by?.count ??
    0
  const comment =
    d.comment_count ??
    d.edge_media_to_comment?.count ??
    d.edge_media_to_parent_comment?.count ??
    0
  const view =
    d.video_view_count ??
    d.video_play_count ??
    d.play_count ??
    d.view_count ??
    0

  return { view: Number(view), like: Number(like), comment: Number(comment) }
}
