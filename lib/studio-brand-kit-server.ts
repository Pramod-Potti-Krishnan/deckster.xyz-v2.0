// BRAND-KIT-CALLER (FRONTEND-1, Brand Kit, Studio caller half; BK-C19): the server-only half. It signs the eight existing theme proxy fetches (when the Brand Kit flag is on) and holds the per-user daily cap on the paid
// extraction (BK-Q6). Import it from a route, never from a client component (it reaches the HMAC minter and the database).
//
// Signing: the existing helper, lib/director-rest-entitlement.ts (OPS-2's #312), mints X-Deckster-Entitlement for the SAME user id string the proxy puts in the Director path, per request, never cached, never logged. It returns {} unless
// DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED is "true" and DIRECTOR_WS_AUTH_SECRET is set. THIS file adds one more condition for the EXISTING proxies: NEXT_PUBLIC_STUDIO_BRAND_KIT "true". With the Brand Kit flag off the eight fetches
// are exactly what they were, whatever the entitlement flag says. (The new brand proxy signs without the second condition: it only exists with the flag on, and Director's brand routes refuse an unsigned call, !673.)

import { restEntitlementHeaders } from '@/lib/director-rest-entitlement'
import { countRateEvents, recordRateEvent } from '@/lib/api-hardening'
import { BRAND_EXTRACT_CAP_BUCKET, BRAND_EXTRACT_DAILY_CAP, isStudioBrandKitEnabled } from '@/lib/studio-brand-kit'

/** { 'X-Deckster-Entitlement': ... } for a theme proxy's headers, or {} (flag off, entitlement flag off, no secret). */
export function brandKitSignedHeaders(userId: string, method: string): Record<string, string> {
  return isStudioBrandKitEnabled() ? restEntitlementHeaders(userId, method) : {}
}

/** The same, as the part of a fetch init that carries it: {} or { headers }, so a call with nothing to add is the init it was. */
export function brandKitSignedInit(userId: string, method: string): { headers?: Record<string, string> } {
  const headers = brandKitSignedHeaders(userId, method)
  return Object.keys(headers).length ? { headers } : {}
}

/** Today's cap: STUDIO_BRAND_EXTRACT_DAILY_CAP (server, a whole number from 1 to 100) or the default. Anything else is the default. */
export function brandExtractDailyCap(env: Record<string, string | undefined> = process.env): number {
  const raw = env.STUDIO_BRAND_EXTRACT_DAILY_CAP
  if (typeof raw !== 'string' || !/^\d{1,3}$/.test(raw.trim())) return BRAND_EXTRACT_DAILY_CAP
  const value = Number(raw.trim())
  return value >= 1 && value <= 100 ? value : BRAND_EXTRACT_DAILY_CAP
}

const startOfUtcDay = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

/**
 * One more extraction for this person today? Counts today's attempts (UTC day) in fe_api_rate_events, then records this one BEFORE the paid call goes out: a 422, 502 or 504 may still have reached the model, so every attempt counts.
 * Fails CLOSED: when the count cannot be read the call is not made (a paid call that cannot be counted is not made).
 */
export async function takeBrandExtractSlot(userId: string, now: Date = new Date()): Promise<'ok' | 'cap' | 'unavailable'> {
  try {
    const used = await countRateEvents({ bucket: BRAND_EXTRACT_CAP_BUCKET, subject: userId, since: startOfUtcDay(now) })
    if (used >= brandExtractDailyCap()) return 'cap'
    await recordRateEvent(BRAND_EXTRACT_CAP_BUCKET, 'user', userId)
    return 'ok'
  } catch {
    return 'unavailable'
  }
}
