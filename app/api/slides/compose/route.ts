import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'

export const maxDuration = 300

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

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Slide Composer is disabled' },
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

  const research = body.research
  const useKnowledgeGraph = Boolean(
    research &&
    typeof research === 'object' &&
    !Array.isArray(research) &&
    (research as Record<string, unknown>).use_knowledge_graph === true
  )

  let effectiveUserId = userId
  let directorHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (useKnowledgeGraph) {
    // Re-read billing live rather than trusting the long-lived NextAuth JWT.
    // The returned user id is authoritative for this request, preventing a
    // downgraded account or a forged JSON user_id from using Director as a KG
    // service-secret proxy.
    const gate = await requireKgEntitled()
    if (gate.error) return gate.error
    effectiveUserId = gate.userId
    directorHeaders = kgHeaders(directorHeaders)
  }

  const payload = {
    ...body,
    user_id: effectiveUserId,
  }

  try {
    const response = await fetch(`${directorBaseUrl()}/api/v1/slides/compose-one`, {
      method: 'POST',
      headers: directorHeaders,
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
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code, status: 'error', stage: 'proxy', errors: [error.message] }, { status: 503 })
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
