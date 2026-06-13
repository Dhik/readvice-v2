import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

function toNum(v) { return v == null ? null : Number(v) }

function performanceStatus(row) {
  if (row.roasActual == null || row.roasTarget == null) return null
  const actual = Number(row.roasActual)
  const target = Number(row.roasTarget)
  if (actual >= target)         return 'ahead'
  if (actual >= target * 0.9)   return 'on_track'
  return 'behind'
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page      = Math.max(1, parseInt(searchParams.get('page')    || '1'))
  const limit     = Math.min(100, parseInt(searchParams.get('limit') || '25'))
  const startDate = searchParams.get('startDate') ?? ''
  const endDate   = searchParams.get('endDate')   ?? ''
  const channel   = searchParams.get('channel')   ?? ''
  const tenantId  = session.user.tenantId

  const where = {
    tenantId,
    ...(startDate && endDate ? { date: { gte: new Date(startDate), lte: new Date(endDate) } } : {}),
    ...(channel ? { channel } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.adsMonitoring.findMany({
      where,
      orderBy: [{ date: 'desc' }, { channel: 'asc' }],
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.adsMonitoring.count({ where }),
  ])

  const data = rows.map(r => {
    const gmvT   = toNum(r.gmvTarget)
    const gmvA   = toNum(r.gmvActual)
    const sptT   = toNum(r.spentTarget)
    const sptA   = toNum(r.spentActual)
    const roasT  = toNum(r.roasTarget)
    const roasA  = toNum(r.roasActual)
    const cpaT   = toNum(r.cpaTarget)
    const cpaA   = toNum(r.cpaActual)
    const aovT   = toNum(r.aovToCpaTarget)
    const aovA   = toNum(r.aovToCpaActual)

    return {
      id:               r.id,
      date:             r.date,
      channel:          r.channel,
      gmvTarget:        gmvT,
      gmvActual:        gmvA,
      gmvVariance:      gmvA != null && gmvT != null ? gmvA - gmvT : null,
      spentTarget:      sptT,
      spentActual:      sptA,
      spentVariance:    sptA != null && sptT != null ? sptA - sptT : null,
      roasTarget:       roasT,
      roasActual:       roasA,
      roasVariance:     roasA != null && roasT != null ? roasA - roasT : null,
      cpaTarget:        cpaT,
      cpaActual:        cpaA,
      cpaVariance:      cpaA != null && cpaT != null ? cpaA - cpaT : null,
      aovToCpaTarget:   aovT,
      aovToCpaActual:   aovA,
      performanceStatus: performanceStatus(r),
      updatedAt:        r.updatedAt,
    }
  })

  return NextResponse.json({ data, total, page, limit })
}
