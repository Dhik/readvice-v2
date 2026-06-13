import googleTrends from 'google-trends-api'

export async function fetchTrends(keyword) {
  const startTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

  const [iotRaw, rqRaw] = await Promise.allSettled([
    googleTrends.interestOverTime({ keyword, geo: 'ID', startTime }),
    googleTrends.relatedQueries({ keyword, geo: 'ID' }),
  ])

  let timeline = []
  if (iotRaw.status === 'fulfilled') {
    try {
      const parsed = JSON.parse(iotRaw.value)
      timeline = (parsed.default?.timelineData ?? []).map(d => ({
        date:  d.formattedAxisTime ?? d.formattedTime,
        value: d.value?.[0] ?? 0,
      }))
    } catch {}
  }

  let related = []
  let rising  = []
  if (rqRaw.status === 'fulfilled') {
    try {
      const parsed = JSON.parse(rqRaw.value)
      const lists  = parsed.default?.rankedList ?? []
      related = (lists[0]?.rankedKeyword ?? []).slice(0, 8).map(k => ({
        query: k.query,
        value: k.value,
      }))
      rising = (lists[1]?.rankedKeyword ?? []).slice(0, 8).map(k => ({
        query:          k.query,
        formattedValue: k.formattedValue ?? String(k.value),
      }))
    } catch {}
  }

  return { timeline, related, rising }
}
