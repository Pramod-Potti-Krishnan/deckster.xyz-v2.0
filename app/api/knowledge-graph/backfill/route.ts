import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { KG_BASE, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'

/**
 * "Import my past sessions" (KG v2 P3, D-KG7).
 *
 * Asks the Researcher to consolidate the user's past research-bearing sessions
 * into their knowledge graph. The consolidator is idempotent per session, so
 * re-runs are safe no-ops.
 *
 * Session-id coverage (review finding 7): a chat's research can be keyed under
 * two different ids —
 *   - uploads/chunks under `ChatSession.geminiStoreId` (the Researcher session
 *     minted when the first file was uploaded), and
 *   - web/deep-research artifacts under `ChatSession.id` (Director keys
 *     `researcher_context` by the frontend session id it connects with).
 * A web-research-only session has no `geminiStoreId`, so filtering on it (the
 * old behavior) missed those. We now send the UNION of both ids across
 * research-bearing sessions. We deliberately exclude pure drafts so we don't
 * consolidate-and-mark empty sessions (which would pre-empt a later real
 * consolidation of that id).
 */
export async function POST() {
  const gate = await requireKgEntitled()
  if (gate.error) return gate.error
  const userId = gate.userId

  const chatSessions = await prisma.chatSession.findMany({
    where: {
      userId,
      NOT: { status: 'deleted' },
      // Research-bearing AND output-producing signals only: uploaded a file,
      // reached a strawman, or produced a deck. We intentionally do NOT
      // include a bare `currentStage >= 3` (review round 2, finding 3): that
      // catches in-progress sessions that may have no material yet, which the
      // consolidator would consolidate empty. (The consolidator now also
      // refuses to mark empty sessions, so this is defense-in-depth.)
      OR: [
        { geminiStoreId: { not: null } },
        { strawmanPresentationId: { not: null } },
        { finalPresentationId: { not: null } },
      ],
    },
    select: { id: true, geminiStoreId: true },
    orderBy: { updatedAt: 'desc' },
    take: 40,
  })

  const idSet = new Set<string>()
  for (const s of chatSessions) {
    if (s.id) idSet.add(s.id)
    if (s.geminiStoreId && s.geminiStoreId.trim()) idSet.add(s.geminiStoreId)
  }
  const sessionIds = Array.from(idSet).slice(0, 50) // backend cap per request

  if (sessionIds.length === 0) {
    return NextResponse.json({
      user_id: userId,
      sessions_processed: 0,
      sessions_already_consolidated: 0,
      entities_created: 0,
      entities_merged: 0,
      results: [],
      no_sessions_found: true,
    })
  }

  try {
    const resp = await fetch(`${KG_BASE}/api/v1/kg/backfill`, {
      method: 'POST',
      headers: kgHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ user_id: userId, session_ids: sessionIds }),
    })
    if (resp.status === 404) {
      return NextResponse.json(
        { error: 'Knowledge Graph is not activated on the backend yet', service_unavailable: true },
        { status: 503 }
      )
    }
    if (!resp.ok) {
      const body = await resp.text()
      console.error('[KG Proxy] Backfill error:', resp.status, body)
      return NextResponse.json({ error: 'Backfill failed' }, { status: resp.status })
    }
    return NextResponse.json(await resp.json())
  } catch (e) {
    console.error('[KG Proxy] Backfill network error:', e)
    return NextResponse.json(
      { error: 'Knowledge graph service is temporarily unavailable', service_unavailable: true },
      { status: 503 }
    )
  }
}
