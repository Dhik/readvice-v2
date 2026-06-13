import { getServerSession }  from 'next-auth'
import { authOptions }       from '@/lib/auth'
import { prisma }            from '@/lib/prisma'
import { NextResponse }      from 'next/server'
import { fetchTrends }       from '@/lib/market-research/fetchTrends'
import { fetchTokopedia }    from '@/lib/market-research/fetchTokopedia'
import { fetchKalodata }     from '@/lib/market-research/fetchKalodata'
import { fetchShopee }       from '@/lib/market-research/fetchShopee'
import { parseIngredients }  from '@/lib/market-research/parseIngredients'

const CACHE_HOURS = 24

// ── Append a log entry to a MarketResearch record ────────────────────
async function appendLog(id, message) {
  try {
    const record = await prisma.marketResearch.findUnique({ where: { id }, select: { logs: true } })
    const existing = Array.isArray(record?.logs) ? record.logs : []
    const entry = { t: new Date().toISOString(), msg: message }
    await prisma.marketResearch.update({
      where: { id },
      data:  { logs: [...existing, entry] },
    })
  } catch {} // log failures are non-fatal
}

// ── GET  /api/market-research  — list recent researches ──────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId

  const rows = await prisma.marketResearch.findMany({
    where:   { tenantId },
    orderBy: { createdAt: 'desc' },
    take:    20,
    select:  { id: true, keyword: true, source: true, status: true, createdAt: true },
  })

  return NextResponse.json(rows)
}

// ── POST /api/market-research  — start a new research ────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = session.user.tenantId
  const { keyword, source = 'tokopedia' } = await request.json()

  if (!keyword?.trim()) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  const kw  = keyword.trim().toLowerCase()
  const src = ['tokopedia', 'kalodata', 'shopee'].includes(source) ? source : 'tokopedia'

  // ── 24-hour cache check ──────────────────────────────────────────────
  const cutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000)
  const cached = await prisma.marketResearch.findFirst({
    where: {
      tenantId,
      keyword: kw,
      source:  src,
      status:  'done',
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: 'desc' },
    select:  { id: true },
  })

  if (cached) return NextResponse.json({ id: cached.id, cached: true })

  // ── Validate Kalodata has credentials before starting ────────────────
  if (src === 'kalodata') {
    const cred = await prisma.kalodataCredential.findUnique({ where: { tenantId } })
    if (!cred) {
      return NextResponse.json({ error: 'Kalodata credentials not configured' }, { status: 400 })
    }
  }

  // Create record immediately
  const research = await prisma.marketResearch.create({
    data: { tenantId, keyword: kw, source: src, status: 'processing', logs: [] },
  })

  // Fire-and-forget background processing
  processResearch(research.id, kw, src, tenantId).catch(err =>
    console.error('[market-research] processing failed:', err)
  )

  return NextResponse.json({ id: research.id })
}

// ── Background processing ────────────────────────────────────────────
async function processResearch(id, keyword, source, tenantId) {
  try {
    let trendsData = null
    let products   = []

    if (source === 'kalodata') {
      // Fetch credentials fresh from DB
      const cred = await prisma.kalodataCredential.findUnique({ where: { tenantId } })
      if (!cred) throw new Error('Kalodata credentials missing')

      // onLog callback — persists each log line to DB so client can poll it
      const onLog = (msg) => appendLog(id, msg)

      // Kalodata scraping + trends in parallel (trends are fast)
      const [kProducts, tData] = await Promise.allSettled([
        fetchKalodata(keyword, { phone: cred.phone, password: cred.password }, onLog),
        fetchTrends(keyword),
      ])

      products   = kProducts.status === 'fulfilled'  ? kProducts.value  : []
      trendsData = tData.status     === 'fulfilled'  ? tData.value      : null

    } else if (source === 'shopee') {
      // Shopee: products + trends in parallel
      const [tProducts, tData] = await Promise.all([
        fetchShopee(keyword),
        fetchTrends(keyword),
      ])
      products   = tProducts
      trendsData = tData

    } else {
      // Tokopedia: products + trends in parallel
      const [tProducts, tData] = await Promise.all([
        fetchTokopedia(keyword),
        fetchTrends(keyword),
      ])
      products   = tProducts
      trendsData = tData
    }

    // ── Compute summary ────────────────────────────────────────────────
    let summary = { total_results: products.length, top_brands: [], top_ingredients: [] }

    if (source === 'tokopedia') {
      const prices    = products.map(p => p.price).filter(p => p > 0)
      const avg_price = prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : 0
      const brandMap  = {}
      for (const p of products) {
        if (p.shop) brandMap[p.shop] = (brandMap[p.shop] || 0) + 1
      }
      summary = {
        total_results:   products.length,
        avg_price,
        min_price:       prices.length ? Math.min(...prices) : 0,
        max_price:       prices.length ? Math.max(...prices) : 0,
        top_brands:      Object.entries(brandMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        top_ingredients: parseIngredients(products),
      }

    } else if (source === 'shopee') {
      // Shopee prices are numeric integers (same as Tokopedia)
      // top_brands = top seller cities (shop name not available from search endpoint)
      const prices    = products.map(p => p.price).filter(p => p > 0)
      const avg_price = prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : 0
      const cityMap   = {}
      for (const p of products) {
        if (p.city) cityMap[p.city] = (cityMap[p.city] || 0) + 1
      }
      summary = {
        total_results:   products.length,
        avg_price,
        min_price:       prices.length ? Math.min(...prices) : 0,
        max_price:       prices.length ? Math.max(...prices) : 0,
        top_brands:      Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        top_ingredients: parseIngredients(products),
      }

    } else if (source === 'kalodata') {
      // For Kalodata, products have: name, revenue, growth, sales, avgPrice (all raw strings)
      const top_brands = products.slice(0, 5).map(p => ({ name: p.name, revenue: p.revenue, sales: p.sales }))
      summary = {
        total_results: products.length,
        top_brands,
        top_ingredients: parseIngredients(products), // ingredient names in product titles
      }
    }

    await prisma.marketResearch.update({
      where: { id },
      data:  { status: 'done', trendsData, products, summary },
    })

  } catch (err) {
    console.error('[market-research] processResearch error:', err)
    await prisma.marketResearch.update({
      where: { id },
      data:  { status: 'failed' },
    }).catch(() => {})
  }
}
