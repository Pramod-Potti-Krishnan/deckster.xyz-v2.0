import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { handlePrefs, type FetchLike, type Outcome, type SessionUser } from '@/lib/studio-model-choice-server'

export const dynamic = 'force-dynamic'
/** NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION (exact "true", default off): the version travels in X-Prefs-Version (read from the request, sent back on every answer), never in If-Match, which Vercel's edge would apply to the response. */ // MODEL-CHOICE-PREFS-VERSION
const prefsVersionOn = () => process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION === 'true' // MODEL-CHOICE-PREFS-VERSION

/**
 * GET / PATCH /api/model-choice/prefs: the signed-in user's "Reusable defaults" for the Intelligence page's model chooser, saved in the Model Router (P3-10, design A). Behind NEXT_PUBLIC_STUDIO_MODEL_CHOICE (exact "true",
 * default off): off, this is not a route at all (404, before any session read or router call). The user is the session's (never the browser's); the router call uses MODEL_ROUTER_URL and the server-only
 * MODEL_ROUTER_FRONTEND_KEY (503 router_not_configured while either is empty). PATCH is a read-modify-write with the router's ETag (If-Match). The logic is lib/studio-model-choice-server.ts (handlePrefs).
 */
const deps = () => ({
  env: process.env,
  getSessionUser: async (): Promise<SessionUser> => ((await getServerSession(authOptions))?.user as SessionUser) ?? null,
  findOwnedSession: async () => null, // the user scope reads no Studio session
  fetch: ((url, init) => fetch(url, init as RequestInit)) as FetchLike,
})

function reply(outcome: Outcome) {
  const response = NextResponse.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } })
  if (outcome.etag) response.headers.set('ETag', outcome.etag)
  if (prefsVersionOn() && outcome.etag) response.headers.set('X-Prefs-Version', outcome.etag) // MODEL-CHOICE-PREFS-VERSION
  return response
}

export async function GET() {
  return reply(await handlePrefs('GET', null, { ifMatch: null }, deps()))
}

export async function PATCH(req: NextRequest) {
  if (prefsVersionOn()) { const request = { ifMatch: req.headers.get('x-prefs-version') ?? req.headers.get('if-match'), opaqueTag: true, body: () => req.json() }; return reply(await handlePrefs('PATCH', null, request, deps())) } // MODEL-CHOICE-PREFS-VERSION: the version header first (If-Match still accepted), compared as an opaque tag
  return reply(await handlePrefs('PATCH', null, { ifMatch: req.headers.get('if-match'), body: () => req.json() }, deps()))
}
