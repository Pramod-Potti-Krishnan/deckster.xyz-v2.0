import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { KG_BASE, kgHeaders } from '@/lib/kg-proxy'

/**
 * "Import my past sessions" (KG v2 P3, D-KG7).
 *
 * Gathers the user's past Researcher session ids from Prisma
 * (ChatSession.geminiStoreId — one per chat session that uploaded files or
 * ran research) and asks the Researcher to consolidate them into the user's
 * knowledge graph. The consolidator is idempotent per session, so re-runs
 * are safe no-ops.
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Researcher sessions are created with the frontend chat-session id
  // passed through (use-file-upload.ts), and geminiStoreId records it.
  const chatSessions = await prisma.chatSession.findMany({
    where: {
      userId: session.user.id,
      geminiStoreId: { not: null },
      NOT: { status: 'deleted' },
    },
    select: { geminiStoreId: true },
    orderBy: { updatedAt: 'desc' },
    take: 50, // backend cap per request
  })
  const sessionIds = Array.from(
    new Set(
      chatSessions
        .map((s) => s.geminiStoreId)
        .filter((id): id is string => !!id && id.trim().length > 0)
    )
  )

  if (sessionIds.length === 0) {
    return NextResponse.json({
      user_id: session.user.id,
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
      body: JSON.stringify({
        user_id: session.user.id,
        session_ids: sessionIds,
      }),
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
