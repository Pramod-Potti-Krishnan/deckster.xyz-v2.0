import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { handlePrefs, type FetchLike, type Outcome, type SessionUser } from '@/lib/studio-model-choice-server'

export const dynamic = 'force-dynamic'

/**
 * GET / PATCH /api/model-choice/prefs/deck/{deckKey}: the signed-in user's "This presentation" choices for one Studio session (the deck key is the Builder's session id, as ROUTER-2 confirmed), saved in the Model
 * Router's deck scope (R3: GET / PUT /v1/prefs/{user}/sessions/{session}; PUT replaces the map, so PATCH here reads, merges and writes with If-Match). Behind NEXT_PUBLIC_STUDIO_MODEL_CHOICE (404 when off,
 * before any session read). The session must belong to the signed-in user (prisma chatSession.userId, as the other session routes check). Until R3 ships the router answers 404, which this route reports as
 * deck_scope_not_available (not an error). The logic is lib/studio-model-choice-server.ts (handlePrefs).
 */
const deps = () => ({
  env: process.env,
  getSessionUser: async (): Promise<SessionUser> => ((await getServerSession(authOptions))?.user as SessionUser) ?? null,
  findOwnedSession: (id: string) => prisma.chatSession.findUnique({ where: { id }, select: { userId: true, status: true } }),
  fetch: ((url, init) => fetch(url, init as RequestInit)) as FetchLike,
})

function reply(outcome: Outcome) {
  const response = NextResponse.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } })
  if (outcome.etag) response.headers.set('ETag', outcome.etag)
  return response
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ deckKey: string }> }) {
  const { deckKey } = await params
  return reply(await handlePrefs('GET', deckKey, { ifMatch: null }, deps()))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ deckKey: string }> }) {
  const { deckKey } = await params
  return reply(await handlePrefs('PATCH', deckKey, { ifMatch: req.headers.get('if-match'), body: () => req.json() }, deps()))
}
