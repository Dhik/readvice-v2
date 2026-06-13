/*
 * Smoke-test the scraper service layer outside of Next.js.
 *
 *   node scripts/test-scraper.js                       # test one sample link per platform
 *   node scripts/test-scraper.js "TikTok video" <url>  # test a single channel + link
 *
 * This file is CommonJS (the project has no "type":"module"), while the lib/
 * scrapers are ESM — so we load them via dynamic import(). RAPID_API_KEY is read
 * from .env.local / .env by the tiny loader below (dotenv is not installed).
 */
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = path.join(__dirname, '..', file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!(m[1] in process.env)) process.env[m[1]] = val
    }
  }
}

// One representative public link per platform. Replace freely when testing.
const SAMPLES = {
  'TikTok video':   'https://www.tiktok.com/@tiktok/video/7106594312292453675',
  'Instagram feed': 'https://www.instagram.com/p/Cw_cQwTLxXz/',
  'youtube video':  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'twitter post':   'https://twitter.com/Twitter/status/1445078208190291973',
  'shopee video':   'https://shopee.co.id/',
}

loadEnv()

;(async () => {
  const indexUrl = pathToFileURL(path.join(__dirname, '..', 'lib', 'scrapers', 'index.js')).href
  const { scrapeByChannel } = await import(indexUrl)

  const [, , channelArg, linkArg] = process.argv
  const targets = channelArg
    ? [[channelArg, linkArg || SAMPLES[channelArg]]]
    : Object.entries(SAMPLES)

  if (!process.env.RAPID_API_KEY) {
    console.warn('⚠  RAPID_API_KEY not set — RapidAPI platforms will fail (Shopee still works).\n')
  }

  for (const [channel, link] of targets) {
    console.log(`\n→ ${channel}\n  ${link}`)
    try {
      const result = await scrapeByChannel(channel, link)
      console.log('  ✓', JSON.stringify(result))
    } catch (e) {
      console.log('  ✗', e.message)
    }
  }
  console.log('')
})()
