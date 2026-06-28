import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const DIRECTOR_API_URL =
  process.env.DIRECTOR_API_URL || 'https://directorv33-production.up.railway.app'

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email
  return uid ?? null
}

export async function PUT(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  try {
    const r = await fetch(
      `${DIRECTOR_API_URL}/api/users/${encodeURIComponent(userId)}/themes/${encodeURIComponent(id)}/standard`,
      { method: 'PUT' },
    )
    const body = await r.json()
    return NextResponse.json(body, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 })
  }
}
