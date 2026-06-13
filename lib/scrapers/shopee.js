// Shopee — no RapidAPI. Fetch the public shopee.co.id page and parse the
// <script id="__NEXT_DATA__"> JSON blob, then deep-search for `countInfo`.
//
// Shopee aggressively guards its pages; a desktop User-Agent is required and
// requests may still be challenged/blocked, in which case the __NEXT_DATA__
// blob will be absent and we throw.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Recursively find the first value stored under `key` anywhere in the tree.
function findKey(obj, key) {
  if (!obj || typeof obj !== 'object') return null
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
  for (const v of Object.values(obj)) {
    const found = findKey(v, key)
    if (found != null) return found
  }
  return null
}

export async function scrape(link) {
  const res = await fetch(link, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' },
  })
  if (!res.ok) throw new Error(`Shopee page responded ${res.status}`)

  const html = await res.text()
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) throw new Error('Shopee __NEXT_DATA__ not found (page blocked or requires JS)')

  let json
  try {
    json = JSON.parse(m[1])
  } catch {
    throw new Error('Failed to parse Shopee __NEXT_DATA__ JSON')
  }

  const c = findKey(json, 'countInfo') ?? findKey(json, 'count_info') ?? {}
  const view    = c.view_count    ?? c.play_count ?? c.viewCount    ?? 0
  const like    = c.like_count    ?? c.liked_count ?? c.likeCount   ?? 0
  const comment = c.comment_count ?? c.commentCount ?? 0

  return { view: Number(view), like: Number(like), comment: Number(comment) }
}
