// BRAND-KIT-CALLER (FRONTEND-1, Brand Kit, Studio caller half; BK-C19): the server-only signing half. It signs the eight existing theme proxy fetches (when the Brand Kit flag is on). Import it from a route, never from a client
// component (it reaches the HMAC minter). It imports nothing that reaches the database: the three theme proxies that had no database import before gain none (the daily cap is in lib/studio-brand-kit-cap.ts, which only the extract route imports).
//
// Signing: the existing helper, lib/director-rest-entitlement.ts (OPS-2's #312), mints X-Deckster-Entitlement for the SAME user id string the proxy puts in the Director path, per request, never cached, never logged. It returns {} unless
// DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED is "true" and DIRECTOR_WS_AUTH_SECRET is set. THIS file adds one more condition for the EXISTING proxies: NEXT_PUBLIC_STUDIO_BRAND_KIT "true". With the Brand Kit flag off the eight fetches
// are exactly what they were, whatever the entitlement flag says. (The new brand proxy signs without the second condition: it only exists with the flag on, and Director's brand routes refuse an unsigned call, !673.)

import { restEntitlementHeaders } from '@/lib/director-rest-entitlement'
import { isStudioBrandKitEnabled } from '@/lib/studio-brand-kit'

/** { 'X-Deckster-Entitlement': ... } for a theme proxy's headers, or {} (flag off, entitlement flag off, no secret). */
export function brandKitSignedHeaders(userId: string, method: string): Record<string, string> {
  return isStudioBrandKitEnabled() ? restEntitlementHeaders(userId, method) : {}
}

/** The same, as the part of a fetch init that carries it: {} or { headers }, so a call with nothing to add is the init it was. */
export function brandKitSignedInit(userId: string, method: string): { headers?: Record<string, string> } {
  const headers = brandKitSignedHeaders(userId, method)
  return Object.keys(headers).length ? { headers } : {}
}
