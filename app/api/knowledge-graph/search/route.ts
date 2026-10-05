import { ServiceUrlConfigError } from '@/lib/service-url'
import { NextRequest, NextResponse } from 'next/server'
import { getKgBaseUrl, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'

export async function POST(request: NextRequest) {
  const gate = await requireKgEntitled()
  if (gate.error) return gate.error

  let body: { query?: string; max_nodes?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.query || !body.query.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  try {
    const kgBaseUrl = getKgBaseUrl()
    const resp = await fetch(
      `${kgBaseUrl}/api/v1/kg/${gate.userId}/search`,
      {
        method: 'POST',
        headers: kgHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          query: body.query.trim(),
          max_nodes: Math.min(Math.max(body.max_nodes ?? 10, 1), 50),
        }),
      }
    )
    if (!resp.ok) {
      return NextResponse.json({ error: 'Search failed' }, { status: resp.status })
    }
    return NextResponse.json(await resp.json())
  } catch (e) {
    if (e instanceof ServiceUrlConfigError) return NextResponse.json({ error: e.message, code: e.code, service_unavailable: true }, { status: 503 })
    console.error('[KG Proxy] Search error:', e)
    return NextResponse.json(
      { error: 'Knowledge graph service is temporarily unavailable', service_unavailable: true },
      { status: 503 }
    )
  }
}
