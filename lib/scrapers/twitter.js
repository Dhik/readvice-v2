import { rapidGet } from '../rapidapi.js'

// twitter-api45.p.rapidapi.com
// GET /tweet.php?id=<tweetId>  →  { views, likes, retweets, replies, quotes, ... }
const HOST = 'twitter-api45.p.rapidapi.com'

function extractTweetId(link) {
  const m = String(link).match(/status(?:es)?\/(\d+)/)
  return m ? m[1] : String(link)
}

export async function scrape(link) {
  const id = extractTweetId(link)
  const json = await rapidGet(HOST, '/tweet.php', { id })
  const d = json?.data ?? json ?? {}

  const view    = d.views   ?? d.view_count    ?? d.viewCount    ?? 0
  const like    = d.likes   ?? d.favorite_count ?? d.like_count  ?? 0
  const comment = d.replies ?? d.reply_count   ?? d.comment_count ?? 0

  return { view: Number(view), like: Number(like), comment: Number(comment) }
}
