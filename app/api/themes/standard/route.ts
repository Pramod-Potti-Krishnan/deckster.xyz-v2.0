import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { directorRestSignHeaders } from '@/lib/studio-director-rest-sign' // DIRECTOR-REST-SIGN
import { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'
import { directorEmailFallbackRead, missOnEmpty } from '@/lib/studio-director-email-fallback' // DUAL-LOOKUP
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { brandKitSignedHeaders, brandKitSignedInit } from '@/lib/studio-brand-kit-server' // BRAND-KIT-CALLER (NEXT_PUBLIC_STUDIO_BRAND_KIT): signs the Director call when the flag AND the entitlement flag are on; off, nothing is added

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
      ((_b: RequestInit, _h: Record<string, string>) => Object.keys(_h).length ? { ..._b, headers: { ...(_b.headers as Record<string, string> | undefined), ..._h } } : _b)( // DIRECTOR-REST-SIGN
      { cache: 'no-store', ...brandKitSignedInit(userId, 'GET') }, // BRAND-KIT-CALLER
      await directorRestSignHeaders(userId, 'GET', { path: `/api/users/${encodeURIComponent(userId)}/themes/standard` })), // DIRECTOR-REST-SIGN
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
      ((_b: RequestInit, _h: Record<string, string>) => Object.keys(_h).length ? { ..._b, headers: { ...(_b.headers as Record<string, string> | undefined), ..._h } } : _b)( // DIRECTOR-REST-SIGN
      { method: 'DELETE', ...brandKitSignedInit(userId, 'DELETE') }, // BRAND-KIT-CALLER
      await directorRestSignHeaders(userId, 'DELETE', { path: `/api/users/${encodeURIComponent(userId)}/themes/standard` })), // DIRECTOR-REST-SIGN
    )
    const body = await r.json()
    return NextResponse.json(body, { status: r.status })
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 })
  }
}
