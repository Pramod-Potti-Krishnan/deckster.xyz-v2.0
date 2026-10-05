import { ServiceUrlConfigError } from '@/lib/service-url'
import { getKgBaseUrl, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const gate = await requireKgEntitled()
  if (gate.error) return gate.error

  const { nodeId } = await params

  try {
    const kgBaseUrl = getKgBaseUrl()
    const resp = await fetch(
      `${kgBaseUrl}/api/v1/kg/${gate.userId}/nodes/${encodeURIComponent(nodeId)}`,
      { headers: kgHeaders({ Accept: 'application/json' }) }
    )
    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to fetch node detail' }, { status: resp.status })
    }
    return NextResponse.json(await resp.json())
  } catch (e) {
    if (e instanceof ServiceUrlConfigError) return NextResponse.json({ error: e.message, code: e.code, service_unavailable: true }, { status: 503 })
    console.error('[KG Proxy] Node detail error:', e)
    return NextResponse.json(
      { error: 'Knowledge graph service is temporarily unavailable', service_unavailable: true },
      { status: 503 }
    )
  }
}
