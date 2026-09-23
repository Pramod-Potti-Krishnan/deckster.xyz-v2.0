import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { requireComposerServiceUrl } from '@/lib/composer-library'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxy(req: NextRequest, context: RouteContext) {
  if (process.env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let userId: string
  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
  } catch {
    return NextResponse.json({ error: 'Could not verify the template library account.' }, { status: 503 })
  }

  const { path } = await context.params
  const safeId = (value: string | undefined) => !!value && /^[a-zA-Z0-9_-]{1,200}$/.test(value)
  const list = req.method === 'GET' && path.length === 1 && path[0] === 'templates'
  const job = req.method === 'GET' && path.length === 2 && path[0] === 'jobs' && safeId(path[1])
  const upload = req.method === 'POST' && path.length === 1 && path[0] === 'upload-reference'
  const use = req.method === 'POST' && path.length === 3 && path[0] === 'templates' && safeId(path[1]) && path[2] === 'use'
  if (!list && !job && !upload && !use) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let base: string
  const token = process.env.COMPOSER_FRONTDOOR_TOKEN
  try {
    base = requireComposerServiceUrl(process.env.COMPOSER_DIRECTOR_URL, 'directorv40-uat.up.railway.app')
    if (!token) throw new Error('missing token')
  } catch {
    return NextResponse.json({ error: 'Template library is not configured.' }, { status: 503 })
  }

  let body: string | undefined
  if (upload || use) {
    if (!req.headers.get('content-type')?.startsWith('application/json')) {
      return NextResponse.json({ error: 'JSON references only; upload files directly to storage.' }, { status: 415 })
    }
    try {
      const reader = req.body?.getReader()
      if (!reader) throw new Error('missing body')
      const chunks: Uint8Array[] = []
      let bytes = 0
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > 16384) {
          await reader.cancel()
          return NextResponse.json({ error: 'Reference is too large.' }, { status: 413 })
        }
        chunks.push(chunk.value)
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      const keys = upload ? ['session_id', 'researcher_session_id', 'storage_path', 'file_name', 'kind'] : ['session_id']
      if (!payload || Array.isArray(payload) || Object.keys(payload).some(key => !keys.includes(key)) ||
          !keys.every(key => typeof payload[key] === 'string' && payload[key].length > 0) ||
          !safeId(payload.session_id) || upload && payload.kind !== 'pptx') throw new Error('invalid reference')
      if (upload) {
        // Researcher's public session metadata is not an ownership authority.
        // The storage namespace must be this authenticated Builder session.
        const parts = payload.storage_path.split('/')
        if (payload.researcher_session_id !== payload.session_id || parts.length !== 2 ||
            parts[0] !== payload.session_id || !parts[1] || parts[1] === '.' || parts[1] === '..' ||
            /[\\%?#:\x00-\x1f]/.test(payload.storage_path)) throw new Error('invalid storage namespace')
      }
      const ownedSession = await prisma.chatSession.findFirst({
        where: { id: payload.session_id, userId, status: { not: 'deleted' } }, select: { id: true },
      })
      if (!ownedSession) return NextResponse.json({ error: 'Template library session not found.' }, { status: 404 })
      body = JSON.stringify(payload)
    } catch {
      return NextResponse.json({ error: 'Invalid template library reference.' }, { status: 400 })
    }
  }
  try {
    const response = await fetch(`${base}/api/template-ingest/stage/${path.map(encodeURIComponent).join('/')}`, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Composer-User-Id': userId,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(25000),
    })
    return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Template library is temporarily unavailable.' }, { status: 502 })
  }
}

export const GET = proxy
export const POST = proxy
