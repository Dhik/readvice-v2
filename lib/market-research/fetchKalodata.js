import { chromium } from 'playwright'

// ── Anti-detection helpers ────────────────────────────────────────────
const randomDelay = (min = 3000, max = 8000) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)))

const shortDelay = (min = 800, max = 2000) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)))

/** Type text slowly, character by character, to mimic human typing */
async function humanType(page, selector, text) {
  await page.click(selector)
  await shortDelay(300, 700)
  for (const char of text) {
    await page.keyboard.type(char)
    await new Promise(r => setTimeout(r, 60 + Math.random() * 120))
  }
}

// ── Main scraper ──────────────────────────────────────────────────────
/**
 * @param {string} keyword
 * @param {{ phone: string, password: string }} credentials
 * @param {(msg: string) => void} [onLog]  – optional real-time log callback
 */
export async function fetchKalodata(keyword, credentials, onLog = () => {}) {
  const { phone, password } = credentials
  let browser = null

  const log = (msg) => {
    console.log(`[fetchKalodata] ${msg}`)
    onLog(msg)
  }

  try {
    log('Launching Chromium browser…')
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1366,768',
      ],
    })

    const context = await browser.newContext({
      userAgent:    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport:     { width: 1366, height: 768 },
      locale:       'id-ID',
      timezoneId:   'Asia/Jakarta',
      extraHTTPHeaders: { 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' },
    })

    // Mask webdriver property
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })

    const page = await context.newPage()

    // ── Step 1: Login ─────────────────────────────────────────────────
    log('Navigating to kalodata.com/login…')
    await page.goto('https://www.kalodata.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await randomDelay(2000, 4000)

    log('Filling in phone number…')
    await page.waitForSelector("input[type='text']", { timeout: 15000 })
    await humanType(page, "input[type='text']", phone)
    await shortDelay()

    log('Filling in password…')
    await humanType(page, "input[type='password']", password)
    await shortDelay()

    log('Submitting login form…')
    await page.click("button[type='submit']")

    // Wait for redirect to /explore or dashboard
    // NOTE: Playwright passes a URL object (not a string) to the waitForURL callback — must use url.href
    await page.waitForURL(url => url.href.includes('/explore') || url.href.includes('/dashboard') || url.href.includes('/product'), { timeout: 20000 })
    log('Login successful! Redirected to dashboard.')
    await randomDelay(2000, 4000)

    // ── Step 2: Navigate to Product tab ──────────────────────────────
    log('Navigating to kalodata.com/product…')
    await page.goto('https://www.kalodata.com/product', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await randomDelay(3000, 6000)

    // ── Step 3: Search by keyword ─────────────────────────────────────
    log(`Searching for keyword: "${keyword}"…`)
    const searchSelectors = [
      'input[placeholder*="search" i]',
      'input[placeholder*="cari" i]',
      'input[placeholder*="product" i]',
      'input[placeholder*="produk" i]',
      '.ant-input',
      'input[type="search"]',
    ]

    let searchInput = null
    for (const sel of searchSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 })
        searchInput = sel
        break
      } catch {}
    }

    if (searchInput) {
      await humanType(page, searchInput, keyword)
      await shortDelay(500, 1000)
      await page.keyboard.press('Enter')
      log('Search submitted, waiting for results…')
      await randomDelay(4000, 7000)
    } else {
      log('Search input not found — trying URL-based search…')
      await page.goto(`https://www.kalodata.com/product?keyword=${encodeURIComponent(keyword)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await randomDelay(4000, 7000)
    }

    // ── Step 4: Wait for results table ───────────────────────────────
    log('Waiting for results table to load…')
    await page.waitForSelector('table', { timeout: 30000 })
    // Wait for spinner to disappear
    try {
      await page.waitForSelector('.ant-spin-spinning', { state: 'detached', timeout: 20000 })
    } catch {}
    await shortDelay(1500, 3000)

    // ── Step 5: Scrape pages ──────────────────────────────────────────
    const allProducts = []
    const MAX_PAGES = 5

    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
      const rows = await page.$$('table > tbody > tr')
      if (rows.length === 0) {
        log(`Page ${pageNum}: No rows found, stopping.`)
        break
      }

      log(`Page ${pageNum}: Extracting ${rows.length} rows…`)

      for (const row of rows) {
        try {
          const cells = await row.$$('td')
          if (cells.length < 6) continue

          const getText = async (cell) => (await cell.innerText()).trim()

          const name     = await getText(cells[1])
          const revenue  = await getText(cells[3])
          const growth   = cells[5] ? await getText(cells[5]) : ''
          const sales    = cells[6] ? await getText(cells[6]) : ''
          const avgPrice = cells[7] ? await getText(cells[7]) : ''

          if (!name || name.length === 0) continue

          allProducts.push({ name, revenue, growth, sales, avgPrice })
        } catch {}
      }

      log(`Page ${pageNum}: ${allProducts.length} products collected so far.`)

      if (pageNum >= MAX_PAGES) break

      // Try to click Next button
      const nextBtn = await page.$('li.ant-pagination-next:not(.ant-pagination-disabled)')
      if (!nextBtn) {
        log('No more pages available.')
        break
      }

      const isDisabled = await nextBtn.getAttribute('aria-disabled')
      if (isDisabled === 'true') {
        log('Pagination disabled — last page reached.')
        break
      }

      log(`Navigating to page ${pageNum + 1}… (waiting to avoid detection)`)
      await randomDelay(3000, 8000) // anti-detection delay between pages

      await page.evaluate(el => el.scrollIntoView({ block: 'center' }), nextBtn)
      await shortDelay(500, 1000)
      await page.evaluate(el => el.click(), nextBtn)

      // Wait for new content
      try {
        await page.waitForSelector('.ant-spin-spinning', { timeout: 5000 })
      } catch {}
      try {
        await page.waitForSelector('.ant-spin-spinning', { state: 'detached', timeout: 30000 })
      } catch {}
      await shortDelay(2000, 4000)
    }

    log(`Done! Total products collected: ${allProducts.length}`)
    return allProducts

  } catch (err) {
    log(`Error: ${err.message}`)
    console.error('[fetchKalodata] error:', err.message)
    throw err
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
