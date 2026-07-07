import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { KG_BASE, kgHeaders } from '@/lib/kg-proxy'

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resp = await fetch(`${KG_BASE}/api/v1/kg/${session.user.id}`, {
      method: 'DELETE',
      headers: kgHeaders(),
    })

    if (resp.status === 404) {
      // KG router not mounted — never claim a deletion happened when the
      // backend could not perform one.
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
      {
        error: 'Knowledge graph service is temporarily unavailable',
        service_unavailable: true,
      },
      { status: 503 }
    )
  }
}
