import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    select:  { id: true, name: true },
  })

  return NextResponse.json(roles)
}
