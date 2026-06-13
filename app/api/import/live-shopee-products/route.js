import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file     = formData.get('file')
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  return NextResponse.json({ imported: 0, message: 'Live Shopee products processed' })
}
