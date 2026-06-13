// Thin RapidAPI GET helper. All RapidAPI-backed scrapers go through this so the
// auth headers + error handling live in one place.
//
//   const json = await rapidGet('some-host.p.rapidapi.com', '/endpoint', { url, hd: 1 })
//
// Reads the key from process.env.RAPID_API_KEY. Throws on a missing key or any
// non-2xx response (with a trimmed snippet of the body for debugging).

export async function rapidGet(host, path = '/', params = {}) {
  const key = process.env.RAPID_API_KEY
  if (!key) throw new Error('RAPID_API_KEY is not set (add it to your .env)')

  const url = new URL(`https://${host}${path.startsWith('/') ? path : '/' + path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': key,
      'X-RapidAPI-Host': host,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`RapidAPI ${host} responded ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json()
}
