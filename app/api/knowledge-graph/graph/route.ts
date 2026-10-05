import { ServiceUrlConfigError } from '@/lib/service-url'
import { NextRequest, NextResponse } from 'next/server'
import { getKgBaseUrl, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'

export async function GET(request: NextRequest) {
  const gate = await requireKgEntitled()
  if (gate.error) return gate.error

  const limit = request.nextUrl.searchParams.get('limit') || '100'

  try {
    const kgBaseUrl = getKgBaseUrl()
    const resp = await fetch(
      `${kgBaseUrl}/api/v1/kg/${gate.userId}/graph?limit=${encodeURIComponent(limit)}`,
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
    if (e instanceof ServiceUrlConfigError) return NextResponse.json({ error: e.message, code: e.code, service_unavailable: true }, { status: 503 })
    console.error('[KG Proxy] Graph error:', e)
    return NextResponse.json(
      { error: 'Knowledge graph service is temporarily unavailable', service_unavailable: true },
      { status: 503 }
    )
  }
}
