import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export const dynamic = 'force-dynamic'

type SessionUserWithId = {
  id?: string | null
  email?: string | null
}

function directorBaseUrl(): string {
  return requireServiceUrl('Slide Composer Director', [
    { name: 'SLIDE_COMPOSER_DIRECTOR_URL', value: process.env.SLIDE_COMPOSER_DIRECTOR_URL },
    { name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL },
    { name: 'NEXT_PUBLIC_DIRECTOR_API_URL', value: process.env.NEXT_PUBLIC_DIRECTOR_API_URL },
  ], { stripTrailingSlash: true })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as SessionUserWithId | undefined
  const userId = sessionUser?.id || sessionUser?.email
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get('session_id')
  const presentationId = req.nextUrl.searchParams.get('presentation_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  const { jobId } = await params
  const query = new URLSearchParams({
    user_id: userId,
    session_id: sessionId,
  })
  if (presentationId) query.set('presentation_id', presentationId)

  try {
    const response = await fetch(
      `${directorBaseUrl()}/api/v1/slides/compose-jobs/${encodeURIComponent(jobId)}?${query.toString()}`,
      { cache: 'no-store' },
    )
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
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code, status: 'error', stage: 'proxy', errors: [error.message] }, { status: 503 })
    return NextResponse.json(
      {
        status: 'error',
        stage: 'proxy',
        errors: [error instanceof Error ? error.message : 'Director job status proxy failed'],
      },
      { status: 502 },
    )
  }
}
