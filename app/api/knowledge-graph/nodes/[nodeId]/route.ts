import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { KG_BASE, kgHeaders } from '@/lib/kg-proxy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { nodeId } = await params

  try {
    const resp = await fetch(
      `${KG_BASE}/api/v1/kg/${session.user.id}/nodes/${encodeURIComponent(nodeId)}`,
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
