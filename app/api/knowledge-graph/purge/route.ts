import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const KG_BASE = process.env.KNOWLEDGE_SERVICE_URL || 'https://researcher-v1.up.railway.app'

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resp = await fetch(`${KG_BASE}/api/v1/kg/${session.user.id}`, {
      method: 'DELETE',
    })

    if (resp.status === 404) {
      // KG endpoints not deployed yet — return synthetic result
      return NextResponse.json({
        user_id: session.user.id,
        settings_deleted: true,
        nodes_deleted: 0,
        edges_deleted: 0,
        evidence_deleted: 0,
      })
    }

    if (!resp.ok) {
      const body = await resp.text()
      console.error('[KG Proxy] Purge error:', resp.status, body)
      return NextResponse.json(
        { error: 'Failed to delete knowledge graph' },
        { status: resp.status }
      )
    }

    return NextResponse.json(await resp.json())
  } catch (e) {
    console.error('[KG Proxy] Purge network error:', e)
    return NextResponse.json(
      { error: 'Knowledge graph service is temporarily unavailable' },
      { status: 503 }
    )
  }
}
