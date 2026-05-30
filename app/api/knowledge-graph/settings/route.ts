import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const KG_BASE = process.env.KNOWLEDGE_SERVICE_URL || 'https://researcher-v1.up.railway.app'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resp = await fetch(`${KG_BASE}/api/v1/kg/settings/${session.user.id}`, {
      headers: { 'Accept': 'application/json' },
    })

    if (resp.status === 404) {
      // KG endpoints not deployed yet — return default unsubscribed state
      return NextResponse.json({
        user_id: session.user.id,
        subscribed: false,
        cross_session_enabled: false,
        consent_version: null,
        consent_at: null,
        created_at: null,
        updated_at: null,
      })
    }

    if (!resp.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch KG settings' },
        { status: resp.status }
      )
    }

    return NextResponse.json(await resp.json())
  } catch (e) {
    console.error('[KG Proxy] Settings fetch error:', e)
    // Network error or service down — return default state instead of error
    return NextResponse.json({
      user_id: session.user.id,
      subscribed: false,
      cross_session_enabled: false,
      consent_version: null,
      consent_at: null,
      created_at: null,
      updated_at: null,
    })
  }
}
