import { NextResponse } from 'next/server'
import { KG_BASE, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'

export async function POST() {
  // Paid-entitlement gate (review finding 1): only a Pro-and-above account
  // may create backend entitlement — a free user cannot self-grant here.
  const gate = await requireKgEntitled()
  if (gate.error) return gate.error
  const userId = gate.userId

  try {
    const resp = await fetch(`${KG_BASE}/api/v1/kg/subscribe`, {
      method: 'POST',
      headers: kgHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        user_id: userId,
        cross_session_enabled: true,
        consent_version: '2026-05-28-v1',
      }),
    })

    if (resp.status === 404) {
      // KG router not mounted on the Researcher (RESEARCHER_KG_ENABLED off).
      // Be honest: nothing was stored, so nothing succeeded.
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
      console.error('[KG Proxy] Subscribe error:', resp.status, body)
      return NextResponse.json(
        { error: 'Failed to subscribe to knowledge graph' },
        { status: resp.status }
      )
    }

    return NextResponse.json(await resp.json())
  } catch (e) {
    console.error('[KG Proxy] Subscribe network error:', e)
    return NextResponse.json(
      {
        error: 'Knowledge graph service is temporarily unavailable',
        service_unavailable: true,
      },
      { status: 503 }
    )
  }
}
