import { ServiceUrlConfigError } from '@/lib/service-url'
import { NextRequest, NextResponse } from 'next/server'
import { getKgBaseUrl, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'
import { studioKgAskBackendBody, studioKgAskCheck, studioKgAskOn } from '@/lib/studio-kg-ask'

// "Ask your second brain" (flag NEXT_PUBLIC_STUDIO_KG_ASK, default off): POST /api/v1/kg/query on the Researcher (KgQueryRequest -> KgQueryResponse, see lib/studio-kg-ask.ts).
// Same pattern as the other /api/knowledge-graph/* routes: the paid-entitlement gate first, KNOWLEDGE_SERVICE_URL, X-API-Key from KNOWLEDGE_API_KEY. The backend route is keyed by a
// user_id in the body, so that id is ALWAYS the signed-in person's own (from the session); the browser's body can only carry the question.
// With the flag off this route does not exist: 404 before anything else runs (no session read, no backend call).
// NEXT_PUBLIC_ is inlined at build time, so the rule is the build's. The Studio shell part of the rule is the page's (it only decides whether the box is drawn).
export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_STUDIO_KG_ASK !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const gate = await requireKgEntitled()
  if (gate.error) return gate.error

  let body: { query?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const checked = studioKgAskCheck(body?.query)
  if (!checked.ok) {
    return NextResponse.json({ error: checked.message, code: checked.reason }, { status: 400 })
  }

  try {
    const kgBaseUrl = getKgBaseUrl()
    const resp = await fetch(`${kgBaseUrl}/api/v1/kg/query`, {
      method: 'POST',
      headers: kgHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(studioKgAskBackendBody(gate.userId, checked.question)),
    })
    if (resp.status === 404) {
      // The Researcher mounts /kg/* only when RESEARCHER_KG_ENABLED is on.
      return NextResponse.json(
        { error: 'Knowledge Graph is not activated on the backend yet', service_unavailable: true },
        { status: 503 }
      )
    }
    if (!resp.ok) {
      return NextResponse.json({ error: 'Ask failed' }, { status: resp.status })
    }
    return NextResponse.json(await resp.json())
  } catch (e) {
    if (e instanceof ServiceUrlConfigError) return NextResponse.json({ error: e.message, code: e.code, service_unavailable: true }, { status: 503 })
    console.error('[KG Proxy] Ask error:', e)
    return NextResponse.json(
      { error: 'Knowledge graph service is temporarily unavailable', service_unavailable: true },
      { status: 503 }
    )
  }
}
