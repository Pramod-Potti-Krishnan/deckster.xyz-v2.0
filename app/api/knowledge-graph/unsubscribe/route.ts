import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { KG_BASE, kgHeaders } from '@/lib/kg-proxy'

/**
 * Pause the knowledge graph for this user (KG v2 P0).
 *
 * Durable, non-destructive: sets cross_session_enabled=false on the
 * Researcher so neither retrieval nor consolidation engages, while all
 * accumulated graph data is preserved. Purge remains the destructive path.
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resp = await fetch(`${KG_BASE}/api/v1/kg/unsubscribe`, {
      method: 'POST',
      headers: kgHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ user_id: session.user.id }),
    })

    if (resp.status === 404) {
      return NextResponse.json(
        {
          error: 'Knowledge Graph is not activated on the backend yet',
          service_unavailable: true,
        },
        { status: 503 }
      )
    }

    if (!resp.ok) {
      const body = await resp.text()
      console.error('[KG Proxy] Unsubscribe error:', resp.status, body)
      return NextResponse.json(
        { error: 'Failed to pause knowledge graph' },
        { status: resp.status }
      )
    }

    return NextResponse.json(await resp.json())
  } catch (e) {
    console.error('[KG Proxy] Unsubscribe network error:', e)
    return NextResponse.json(
      {
        error: 'Knowledge graph service is temporarily unavailable',
        service_unavailable: true,
      },
      { status: 503 }
    )
  }
}
