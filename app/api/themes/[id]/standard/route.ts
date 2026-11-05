import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { directorRestSignHeaders } from '@/lib/studio-director-rest-sign' // DIRECTOR-REST-SIGN
import { resolveDirectorUserId } from '@/lib/studio-director-rest-sign'
import { NextRequest, NextResponse } from 'next/server'
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

export async function PUT(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await resolveUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  try {
    const r = await fetch(
      `${directorBaseUrl()}/api/users/${encodeURIComponent(userId)}/themes/${encodeURIComponent(id)}/standard`,
      { method: 'PUT', headers: await directorRestSignHeaders(userId, 'PUT', { path: `/api/users/${encodeURIComponent(userId)}/themes/${encodeURIComponent(id)}/standard` }) }, // DIRECTOR-REST-SIGN
    )
    const body = await r.json()
    return NextResponse.json(body, { status: r.status })
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    return NextResponse.json({ error: 'director_unreachable' }, { status: 502 })
  }
}
