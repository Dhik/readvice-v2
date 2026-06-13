import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcTax, pphLabel } from '@/lib/talent-finance'
import { renderHtmlToPdf, imgDataUri } from '@/lib/pdf'
import { invoiceHtml } from '@/lib/talent-docs/invoice'
import { todayDMY } from '@/lib/talent-docs/_fmt'
import { assertFeature, GateError } from '@/lib/subscription-gate'

export const runtime = 'nodejs'

function safeName(s) {
  return String(s ?? 'document').replace(/[\/\\:*?"<>|]/g, '-')
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id }     = await params
  const tenantId   = session.user.tenantId
  const talentId   = parseInt(id)

  const talent = await prisma.talent.findFirst({ where: { id: talentId, tenantId } })
  if (!talent) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // PDF exports gate
  try {
    await assertFeature(tenantId, 'hasPdfExports')
  } catch (e) {
    if (e instanceof GateError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })

  // Approval (signer) — optional; template renders a "No Image" block if absent.
  const { searchParams } = new URL(request.url)
  const approvalId = parseInt(searchParams.get('approval') ?? '')
  const approval = Number.isInteger(approvalId)
    ? await prisma.approval.findFirst({ where: { id: approvalId, tenantId } })
    : null

  // Latest payment drives the DP / Sisa / Termin lines.
  const payment = await prisma.talentPayment.findFirst({
    where:   { talentId },
    orderBy: { id: 'desc' },
  })

  const subtotal    = Number(talent.rateFinal ?? 0)
  const pph         = calcTax(talent.rateFinal, talent.namaRekening, talent.taxPercentage)
  const total       = subtotal - pph
  const downPayment = Number(talent.dpAmount ?? 0)
  const money = {
    noDocument:    talent.noDocument,
    today:         todayDMY(),
    subtotal,
    pph,
    pphLabel:      pphLabel(talent.namaRekening, talent.taxPercentage),
    total,
    statusPayment: payment?.statusPayment ?? null,
    downPayment,
    sisa:          total - downPayment,
  }

  const logoDataUri      = tenant?.logoFile ? await imgDataUri(`img/${tenant.logoFile}`) : null
  const signatureDataUri = approval?.photo  ? await imgDataUri(approval.photo)           : null

  const html = invoiceHtml({ tenant: tenant ?? {}, talent, approval, money, logoDataUri, signatureDataUri })
  const pdf  = await renderHtmlToPdf(html)

  return new NextResponse(pdf, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="invoice_${safeName(talent.noDocument)}.pdf"`,
    },
  })
}
