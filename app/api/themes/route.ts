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

export async function GET() {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await fetch(
      `${DIRECTOR_API_URL}/api/users/${encodeURIComponent(userId)}/themes`,
      { cache: 'no-store' },
    )
    const body = await r.json()
    return NextResponse.json(body, { status: r.status })
  } catch {
    return NextResponse.json(
      { error: 'director_unreachable', themes: [], count: 0 },
      { status: 502 },
    )
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  try {
    const r = await fetch(
      `${DIRECTOR_API_URL}/api/users/${encodeURIComponent(userId)}/themes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    const body = await r.json()
    return NextResponse.json(body, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 })
  }
}
