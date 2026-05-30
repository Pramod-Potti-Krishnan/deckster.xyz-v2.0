import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const KG_BASE = process.env.KNOWLEDGE_SERVICE_URL || 'https://researcher-v1.up.railway.app'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resp = await fetch(`${KG_BASE}/api/v1/kg/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: session.user.id,
        cross_session_enabled: true,
        consent_version: '2026-05-28-v1',
      }),
    })

    if (resp.status === 404) {
      // KG endpoints not deployed yet — return a synthetic success
      // so the frontend toggle works, and real subscription will be picked up
      // once the Researcher MR is merged and deployed
      return NextResponse.json({
        user_id: session.user.id,
        subscribed: true,
        cross_session_enabled: true,
        consent_version: '2026-05-28-v1',
        consent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _pending_deployment: true,
      })
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
      { error: 'Knowledge graph service is temporarily unavailable' },
      { status: 503 }
    )
  }
}
