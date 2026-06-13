import axios from 'axios'

const GQL_URL = 'https://gql.tokopedia.com/graphql/SearchProductQueryV4'

const QUERY = `
  query SearchProductQuery($params: String) {
    searchProductV5(params: $params) {
      header { totalData }
      data {
        products {
          id
          name
          url
          imageUrl
          price
          ratingAverage
          shop { name city }
          stats { sold }
        }
      }
    }
  }
`

function buildParams(keyword, page = 1) {
  const p = new URLSearchParams({
    query:       keyword,
    sort:        '8',      // best selling
    page:        String(page),
    rows:        '60',
    device:      'desktop',
    source:      'search',
    st:          'product',
    safe_search: 'false',
  })
  return p.toString()
}

function parsePrice(raw) {
  if (!raw) return 0
  return parseInt(String(raw).replace(/[^\d]/g, '') || '0', 10)
}

function parseSold(raw) {
  if (!raw) return 0
  // e.g. "1,2rb" → 1200, "500" → 500
  const s = String(raw).replace(/\./g, '').replace(',', '.').toLowerCase()
  if (s.includes('rb')) return Math.round(parseFloat(s) * 1000)
  if (s.includes('jt')) return Math.round(parseFloat(s) * 1_000_000)
  return parseInt(s.replace(/[^\d]/g, '') || '0', 10)
}

export async function fetchTokopedia(keyword) {
  try {
    const res = await axios.post(
      GQL_URL,
      [
        {
          operationName: 'SearchProductQuery',
          variables: { params: buildParams(keyword) },
          query: QUERY,
        },
      ],
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin':       'https://www.tokopedia.com',
          'Referer':      `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent(keyword)}`,
          'X-Source':     'tokopedia-lite',
        },
        timeout: 20000,
      }
    )

    const raw = res.data?.[0]?.data?.searchProductV5
    const products = raw?.data?.products ?? []

    return products.map(p => ({
      name:     p.name ?? '',
      shop:     p.shop?.name ?? '',
      city:     p.shop?.city ?? '',
      price:    parsePrice(p.price),
      sold:     parseSold(p.stats?.sold),
      rating:   parseFloat(p.ratingAverage ?? '0'),
      url:      p.url ?? '',
      imageUrl: p.imageUrl ?? '',
    }))
  } catch (err) {
    console.error('[fetchTokopedia] error:', err.message)
    return []
  }
}
