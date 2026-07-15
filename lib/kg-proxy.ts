/**
 * Server-side helpers for the /api/knowledge-graph/* proxy routes (KG v2 P0).
 *
 * Server-only: reads KNOWLEDGE_API_KEY. Never import from client components.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { isKgEntitled } from '@/lib/kg-entitlement'

export const KG_BASE =
  process.env.KNOWLEDGE_SERVICE_URL || 'https://researcher-v1.up.railway.app'

/**
 * Server-side auth + paid-entitlement gate for KG proxy routes.
 *
 * The KG tier gate lives in the frontend/billing layer — the Researcher
 * backend does not check subscription tier. Without a SERVER-side check, a
 * free account could call these routes directly (bypassing the client UI
 * gate) and self-grant KG via `POST /subscribe` (review finding 1). So every
 * entitlement-requiring proxy calls this first.
 *
 * Returns `{ userId }` when the caller is authenticated AND KG-entitled, or a
 * ready-to-return `NextResponse` (401/403) otherwise.
 */
export async function requireKgEntitled(): Promise<
  { userId: string; error?: undefined } | { userId?: undefined; error: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!isKgEntitled(session.user.tier, session.user.subscription)) {
    return {
      error: NextResponse.json(
        { error: 'Knowledge Graph requires a Pro plan or above' },
        { status: 403 }
      ),
    }
  }
  return { userId: session.user.id }
}

/**
 * Headers for Researcher KG calls. Attaches X-API-Key when the deployment
 * has KNOWLEDGE_API_KEY set (the Researcher's KG router requires it when
 * configured; without the env var both sides run in open dev mode).
 */
export function kgHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  const apiKey = process.env.KNOWLEDGE_API_KEY
  if (apiKey) headers['X-API-Key'] = apiKey
  return headers
}
