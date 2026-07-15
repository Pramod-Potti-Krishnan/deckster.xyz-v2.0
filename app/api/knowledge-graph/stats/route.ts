import { NextResponse } from 'next/server'
import { KG_BASE, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'

export async function GET() {
  const gate = await requireKgEntitled()
  if (gate.error) return gate.error

  try {
    const resp = await fetch(
      `${KG_BASE}/api/v1/kg/${gate.userId}/stats`,
      { headers: kgHeaders({ Accept: 'application/json' }) }
    )
    if (resp.status === 404) {
      return NextResponse.json(
        { error: 'Knowledge Graph is not activated on the backend yet', service_unavailable: true },
        { status: 503 }
      )
    }
    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to fetch KG stats' }, { status: resp.status })
    }
    return NextResponse.json(await resp.json())
  } catch (e) {
    console.error('[KG Proxy] Stats error:', e)
    return NextResponse.json(
      { error: 'Knowledge graph service is temporarily unavailable', service_unavailable: true },
      { status: 503 }
    )
  }
}
