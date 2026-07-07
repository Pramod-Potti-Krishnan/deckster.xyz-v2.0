import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { KG_BASE, kgHeaders } from '@/lib/kg-proxy'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = request.nextUrl.searchParams.get('limit') || '100'

  try {
    const resp = await fetch(
      `${KG_BASE}/api/v1/kg/${session.user.id}/graph?limit=${encodeURIComponent(limit)}`,
      { headers: kgHeaders({ Accept: 'application/json' }) }
    )
    if (resp.status === 404) {
      return NextResponse.json(
        { error: 'Knowledge Graph is not activated on the backend yet', service_unavailable: true },
        { status: 503 }
      )
    }
    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to fetch KG graph' }, { status: resp.status })
    }
    return NextResponse.json(await resp.json())
  } catch (e) {
    console.error('[KG Proxy] Graph error:', e)
    return NextResponse.json(
      { error: 'Knowledge graph service is temporarily unavailable', service_unavailable: true },
      { status: 503 }
    )
  }
}
