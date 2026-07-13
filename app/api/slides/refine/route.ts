import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export const maxDuration = 300

const DEFAULT_DIRECTOR_URL = 'http://localhost:8000'

type SessionUserWithId = {
  id?: string | null
  email?: string | null
}

function directorBaseUrl(): string {
  return (
    process.env.SLIDE_COMPOSER_DIRECTOR_URL ||
    process.env.DIRECTOR_API_URL ||
    process.env.NEXT_PUBLIC_DIRECTOR_API_URL ||
    DEFAULT_DIRECTOR_URL
  ).replace(/\/+$/, '')
}

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_SLIDE_REFINER_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Slide Refiner is disabled' },
      { status: 404 },
    )
  }

  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as SessionUserWithId | undefined
  const userId = sessionUser?.id || sessionUser?.email
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = {
    ...body,
    user_id: userId,
  }

  try {
    const response = await fetch(`${directorBaseUrl()}/api/v1/slides/refine-one`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const text = await response.text()
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { error: text }
      }
    }

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        stage: 'proxy',
        errors: [error instanceof Error ? error.message : 'Director proxy failed'],
      },
      { status: 502 },
    )
  }
}
