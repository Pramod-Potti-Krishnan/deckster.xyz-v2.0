import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const KG_BASE = process.env.KNOWLEDGE_SERVICE_URL || 'https://researcher-v1.up.railway.app'

const unavailableCapability = {
  source: 'knowledge_graph',
  configured: false,
  available: false,
  code: 'KG_NOT_CONFIGURED',
  reason: 'Knowledge Graph is not configured in this environment.',
}

function defaultSettings(userId: string, capability = unavailableCapability) {
  return {
    user_id: userId,
    subscribed: false,
    cross_session_enabled: false,
    consent_version: null,
    consent_at: null,
    created_at: null,
    updated_at: null,
    capability,
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const capabilityResponse = await fetch(`${KG_BASE}/api/v1/kg/capabilities`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    })
    if (capabilityResponse.status === 404) {
      // Rolling-deploy compatibility: old Researcher builds did not expose
      // readiness. This is an unconfigured feature, not an unknown user.
      return NextResponse.json(defaultSettings(session.user.id))
    }
    if (!capabilityResponse.ok) {
      return NextResponse.json({
        error: 'Knowledge Graph capability check failed',
        code: 'KG_BACKEND_FAILURE',
        reason: 'Knowledge Graph availability could not be verified.',
      }, { status: 502 })
    }
    const capability = await capabilityResponse.json()
    if (capability?.available !== true) {
      return NextResponse.json(defaultSettings(session.user.id, capability))
    }

    const resp = await fetch(`${KG_BASE}/api/v1/kg/settings/${session.user.id}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    })

    if (resp.status === 404) {
      // Capability said the router is ready. A 404 here is configuration drift,
      // never the normal "user has not subscribed" state (that returns 200).
      return NextResponse.json({
        error: 'Knowledge Graph settings endpoint is unavailable',
        code: 'KG_SETTINGS_ROUTE_MISSING',
        reason: 'Knowledge Graph is configured but its settings route is unavailable.',
      }, { status: 502 })
    }

    if (!resp.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch KG settings' },
        { status: resp.status }
      )
    }

    return NextResponse.json({ ...(await resp.json()), capability })
  } catch (e) {
    console.error('[KG Proxy] Settings fetch error:', e)
    return NextResponse.json({
      error: 'Knowledge Graph service is temporarily unavailable',
      code: 'KG_BACKEND_FAILURE',
      reason: 'Knowledge Graph availability could not be verified.',
    }, { status: 503 })
  }
}
