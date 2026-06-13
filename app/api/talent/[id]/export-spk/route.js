import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcTax } from '@/lib/talent-finance'
import { renderHtmlToPdf, imgDataUri } from '@/lib/pdf'
import { mouHtml } from '@/lib/talent-docs/mou'
import { todayDMY } from '@/lib/talent-docs/_fmt'
import { assertFeature, GateError } from '@/lib/subscription-gate'

export const runtime = 'nodejs'

function safeName(s) {
  return String(s ?? 'document').replace(/[\/\\:*?"<>|]/g, '-')
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id }   = await params
  const tenantId = session.user.tenantId
  const talentId = parseInt(id)

  const talent = await prisma.talent.findFirst({ where: { id: talentId, tenantId } })
  if (!talent) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // PDF exports gate
  try {
    await assertFeature(tenantId, 'hasPdfExports')
  } catch (e) {
    if (e instanceof GateError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  // SPK (PKS) is a KOL-only contract.
  if (talent.type !== 'KOL') {
    return NextResponse.json({ error: 'SPK only available for KOL talents' }, { status: 400 })
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })

  const subtotal = Number(talent.rateFinal ?? 0)
  const pph      = calcTax(talent.rateFinal, talent.namaRekening, talent.taxPercentage)
  const money    = { total: subtotal - pph, today: todayDMY() }

  const logoDataUri = tenant?.letterheadFile ? await imgDataUri(`img/${tenant.letterheadFile}`) : null

  const html = mouHtml({ tenant: tenant ?? {}, talent, money, logoDataUri })
  const pdf  = await renderHtmlToPdf(html)

  return new NextResponse(pdf, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="spk_${safeName(talent.noDocument)}.pdf"`,
    },
  })
}
