import { KG_BASE, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const gate = await requireKgEntitled()
  if (gate.error) return gate.error

  const { nodeId } = await params

  try {
    const resp = await fetch(
      `${KG_BASE}/api/v1/kg/${gate.userId}/nodes/${encodeURIComponent(nodeId)}`,
      { headers: kgHeaders({ Accept: 'application/json' }) }
    )
    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to fetch node detail' }, { status: resp.status })
    }
    return NextResponse.json(await resp.json())
  } catch (e) {
    console.error('[KG Proxy] Node detail error:', e)
    return NextResponse.json(
      { error: 'Knowledge graph service is temporarily unavailable', service_unavailable: true },
      { status: 503 }
    )
  }
}
