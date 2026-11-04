import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { resolveDirectorUserId, directorRestSignHeaders } from '@/lib/studio-director-rest-sign'
import { directorEmailFallbackRead, missOnEmpty } from '@/lib/studio-director-email-fallback' // DUAL-LOOKUP
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

function directorBaseUrl(): string {
  return requireServiceUrl('Director', [{ name: 'DIRECTOR_API_URL', value: process.env.DIRECTOR_API_URL }])
}

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const uid = (session?.user as { id?: string } | undefined)?.id || session?.user?.email
  return resolveDirectorUserId(uid)
}

export async function GET() {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await fetch(
      `${directorBaseUrl()}/api/users/${encodeURIComponent(userId)}/themes/standard`,
      { cache: 'no-store', headers: await directorRestSignHeaders(userId, 'GET') },
    )
    const legacy = await directorEmailFallbackRead(r, userId, (id, headers) => fetch(`${directorBaseUrl()}/api/users/${encodeURIComponent(id)}/themes/standard`, { cache: 'no-store', headers }), missOnEmpty('theme')) // DUAL-LOOKUP
    if (legacy) return NextResponse.json(await legacy.json(), { status: legacy.status }) // DUAL-LOOKUP
    const body = await r.json()
    return NextResponse.json(body, { status: r.status })
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    return NextResponse.json({ error: 'director_unreachable', theme: null }, { status: 502 })
  }
}

export async function DELETE() {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const r = await fetch(
      `${directorBaseUrl()}/api/users/${encodeURIComponent(userId)}/themes/standard`,
      { method: 'DELETE', headers: await directorRestSignHeaders(userId, 'DELETE') },
    )
    const body = await r.json()
    return NextResponse.json(body, { status: r.status })
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 })
  }
}
