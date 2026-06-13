import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const PLATFORM_CONFIG = {
  meta:   { model: 'adSpentMeta',   hasImpressions: true,  hasCtr: true,  countField: 'conversions', extraField: 'adsetName' },
  shopee: { model: 'adSpentShopee', hasImpressions: true,  hasCtr: true,  countField: 'orders',      extraField: 'adType'    },
  tiktok: { model: 'adSpentTiktok', hasImpressions: true,  hasCtr: true,  countField: 'conversions', extraField: 'adName'    },
  lazada: { model: 'adSpentLazada', hasImpressions: false, hasCtr: false, countField: 'orders',      extraField: null        },
}

function serialise(row, config) {
  return {
    ...row,
    spent:       Number(row.spent),
    revenue:     row.revenue     != null ? Number(row.revenue)     : null,
    roas:        row.roas        != null ? Number(row.roas)        : null,
    cpc:         row.cpc         != null ? Number(row.cpc)         : null,
    ...(config.hasImpressions ? {
      impressions: row.impressions != null ? Number(row.impressions) : null,
      ctr:         row.ctr         != null ? Number(row.ctr)         : null,
    } : {}),
  }
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, id } = params
  const config = PLATFORM_CONFIG[platform]
  if (!config) return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })

  const tenantId = session.user.tenantId
  const numId    = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const existing = await prisma[config.model].findFirst({ where: { id: numId, tenantId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()

  const spent   = Number(body.spent   ?? 0)
  const revenue = body.revenue !== '' && body.revenue != null ? Number(body.revenue) : null
  const clicks  = parseInt(body.clicks ?? 0) || 0

  const roas = spent > 0 && revenue != null ? revenue / spent : null
  const cpc  = clicks > 0 ? spent / clicks : null

  const data = {
    date:    body.date ? new Date(body.date) : existing.date,
    spent,
    revenue,
    clicks,
    roas,
    cpc,
    [config.countField]: parseInt(body[config.countField] ?? 0) || 0,
  }

  if (config.hasImpressions) {
    const imp        = BigInt(Math.round(Number(body.impressions ?? 0)))
    data.impressions = imp
    data.ctr         = Number(imp) > 0 ? clicks / Number(imp) : null
  }

  if (config.extraField) {
    data[config.extraField] = body[config.extraField] ?? null
  }

  const updated = await prisma[config.model].update({ where: { id: numId }, data })
  return NextResponse.json(serialise(updated, config))
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, id } = params
  const config = PLATFORM_CONFIG[platform]
  if (!config) return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })

  const tenantId = session.user.tenantId
  const numId    = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { count } = await prisma[config.model].deleteMany({ where: { id: numId, tenantId } })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ message: 'Deleted' })
}
