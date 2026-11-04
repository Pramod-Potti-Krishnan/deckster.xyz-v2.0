import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { requireComposerServiceUrl } from '@/lib/composer-library'
import { restEntitlementHeaders } from '@/lib/director-rest-entitlement'
import { DECK_IMPORT_START_MAX_BYTES, DECK_IMPORT_WORDS, parseDeckImportStart } from '@/lib/studio-deck-import'

export const dynamic = 'force-dynamic'

// STUDIO DECK IMPORT (flag NEXT_PUBLIC_STUDIO_DECK_IMPORT, exact "true", default off): POST /api/template-ingest/stage/import-reference on Director (streams/director2/deck-import/CONTRACT.md,
// Director !518). Same front door as the template upload proxy (app/api/composer-library/[...path]/route.ts): COMPOSER_DIRECTOR_URL, COMPOSER_FRONTDOOR_TOKEN as the bearer, the signed-in person's
// own id as X-Composer-User-Id. With the flag off this route does not exist: 404 before the session is read, the database is asked or Director is called.
// NEXT_PUBLIC_ is inlined at build time, so the rule is the build's.
//
// REST entitlement (Director class W): the signed X-Deckster-Entitlement header is minted HERE, on the server, per request, for the same user id this route sends as X-Composer-User-Id, and only
// when BOTH this feature's flag AND DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED are on (the helper then also needs the existing DIRECTOR_WS_AUTH_SECRET). With either flag off no header is added and
// nothing reads that secret. The browser never sees the header, the secret or this helper.
export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Sign in to import a deck.' }, { status: 401 })
  let userId: string
  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'Sign in to import a deck.' }, { status: 401 })
    userId = user.id
  } catch {
    return NextResponse.json({ error: 'Deck import could not check your account. Try again.' }, { status: 503 })
  }

  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'JSON references only; upload files directly to storage.' }, { status: 415 })
  }
  let body = ''
  try {
    const reader = req.body?.getReader()
    if (!reader) throw new Error('missing body')
    const chunks: Uint8Array[] = []
    let bytes = 0
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > DECK_IMPORT_START_MAX_BYTES) {
        await reader.cancel()
        return NextResponse.json({ error: 'Reference is too large.' }, { status: 413 })
      }
      chunks.push(chunk.value)
    }
    const checked = parseDeckImportStart(JSON.parse(Buffer.concat(chunks).toString('utf8')))
    if (!checked.ok) throw new Error('invalid reference')
    const ownedSession = await prisma.chatSession.findFirst({
      where: { id: checked.body.session_id, userId, status: { not: 'deleted' } }, select: { id: true },
    })
    if (!ownedSession) return NextResponse.json({ error: 'The import session was not found. Upload the file again.' }, { status: 404 })
    body = JSON.stringify(checked.body)
  } catch {
    return NextResponse.json({ error: DECK_IMPORT_WORDS.START_FAILED }, { status: 400 })
  }

  let base: string
  const token = process.env.COMPOSER_FRONTDOOR_TOKEN
  try {
    const configured = requireServiceUrl('Deck import Director', [
      { name: 'COMPOSER_DIRECTOR_URL', value: process.env.COMPOSER_DIRECTOR_URL },
    ])
    base = requireComposerServiceUrl(configured, 'directorv40-uat.up.railway.app')
    if (!token) throw new Error('missing token')
  } catch (error) {
    if (error instanceof ServiceUrlConfigError) return NextResponse.json({ error: DECK_IMPORT_WORDS.IMPORT_UNAVAILABLE, code: error.code }, { status: 503 })
    return NextResponse.json({ error: DECK_IMPORT_WORDS.IMPORT_UNAVAILABLE }, { status: 503 })
  }

  try {
    const entitlement = process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === 'true' && process.env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED === 'true'
      ? restEntitlementHeaders(userId, 'POST')
      : {}
    const response = await fetch(`${base}/api/template-ingest/stage/import-reference`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Composer-User-Id': userId,
        'Content-Type': 'application/json',
        ...entitlement,
      },
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(25000),
    })
    const answer = await response.json()
    return NextResponse.json(answer, { status: response.status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Deck import is temporarily unavailable. Try again.' }, { status: 502 })
  }
}
