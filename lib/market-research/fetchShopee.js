import axios from 'axios'

const HOST  = 'shopee-e-commerce-data.p.rapidapi.com'
const BASE  = `https://${HOST}/shopee/search/items/v2`
const PAGES = 3   // 3 × 60 = up to 180 products

export async function fetchShopee(keyword) {
  const allProducts = []

  for (let page = 1; page <= PAGES; page++) {
    try {
      const res = await axios.get(BASE, {
        params: {
          keyword,
          site:     'id',
          page,
          pageSize: 60,
          by:       'sales',
          order:    'desc',
        },
        headers: {
          'x-rapidapi-host': HOST,
          'x-rapidapi-key':  process.env.RAPIDAPI_KEY,
        },
        timeout: 20000,
      })

      const items = res.data?.data?.items ?? []
      if (!items.length) break

      for (const p of items) {
        if (!p?.title) continue

        const slug = p.title
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .slice(0, 80)

        allProducts.push({
          name:   p.title,
          shop:   p.shop_info?.shop_location ?? '',
          city:   p.shop_info?.shop_location ?? '',
          price:  Math.round(parseFloat(p.price_info?.price ?? '0')),
          sold:   p.sold_count ?? p.sold ?? 0,
          rating: p.item_rating?.rating_star ?? 0,
          url:    `https://shopee.co.id/${slug}-i.${p.shop_id}.${p.item_id}`,
        })
      }

      if (items.length < 60) break   // last page
    } catch (err) {
      console.error(`[fetchShopee] page ${page} error:`, err.response?.status, err.message)
      break
    }
  }

  return allProducts
}
