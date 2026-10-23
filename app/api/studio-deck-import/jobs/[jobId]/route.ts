import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { requireServiceUrl, ServiceUrlConfigError } from '@/lib/service-url'
import { requireComposerServiceUrl } from '@/lib/composer-library'
import { restEntitlementHeaders } from '@/lib/director-rest-entitlement'
import { DECK_IMPORT_WORDS, deckImportJobIdValid, projectDeckImportJob } from '@/lib/studio-deck-import'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ jobId: string }> }

// STUDIO DECK IMPORT (flag NEXT_PUBLIC_STUDIO_DECK_IMPORT, exact "true", default off): GET /api/template-ingest/stage/jobs/{job_id} on Director for an IMPORT job (`stage-import-...`), read for its
// `deck_import` block (streams/director2/deck-import/CONTRACT.md section 2.2). Any other job id is a 404 here: reads of other stage jobs stay with app/api/composer-library/[...path]/route.ts,
// unchanged. With the flag off this route does not exist: 404 before the session is read, the database is asked or Director is called.
//
// REST entitlement (Director class R): minted HERE, on the server, per request (method GET), for the user id sent as X-Composer-User-Id, and only when BOTH this feature's flag AND
// DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED are on. With either flag off no header is added and nothing reads DIRECTOR_WS_AUTH_SECRET. Never sent to the browser.
// Only the fields the dialog reads go back to the browser (lib/studio-deck-import.ts projectDeckImportJob).
export async function GET(_req: NextRequest, context: RouteContext) {
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

  const { jobId } = await context.params
  if (!deckImportJobIdValid(jobId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
      ? restEntitlementHeaders(userId, 'GET')
      : {}
    const response = await fetch(`${base}/api/template-ingest/stage/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Composer-User-Id': userId,
        ...entitlement,
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(25000),
    })
    const answer = await response.json()
    const job = response.ok ? projectDeckImportJob(answer) : answer
    if (!job) return NextResponse.json({ error: 'Deck import is temporarily unavailable. Try again.' }, { status: 502 })
    return NextResponse.json(job, { status: response.status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Deck import is temporarily unavailable. Try again.' }, { status: 502 })
  }
}
