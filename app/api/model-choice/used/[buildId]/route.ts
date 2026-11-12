import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { handleUsed, type FetchLike, type SessionUser } from '@/lib/studio-model-choice-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/model-choice/used/{buildId}: "Used for this deck", the models one build actually used, from the Model Router's ledger (GET /v1/usage/trace/{build_id}/timeline; the build id is the narrator's build_id,
 * which Director uses as the router trace id). Only the rows of the signed-in user are returned. Behind NEXT_PUBLIC_STUDIO_MODEL_CHOICE (404 when off, before any session read); MODEL_ROUTER_URL and the
 * server-only MODEL_ROUTER_FRONTEND_KEY (read scope) or 503 router_not_configured. The logic is lib/studio-model-choice-server.ts (handleUsed).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ buildId: string }> }) {
  const { buildId } = await params
  const outcome = await handleUsed(buildId, {
    env: process.env,
    getSessionUser: async (): Promise<SessionUser> => ((await getServerSession(authOptions))?.user as SessionUser) ?? null,
    fetch: ((url, init) => fetch(url, init as RequestInit)) as FetchLike,
  })
  return NextResponse.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } })
}
