// FRONTEND-2 (PK, 2 Nov 17:48Z, relayed by PROGRAM-1: the template auto-apply check is per USER across devices; flag NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER, the string "true", default off, build-time,
// and effective only together with NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH). Stacked on #559 (the template match), which keeps the check per user on THIS device; this change keeps it per user on the SERVER too
// (Prisma UserPreferences.templateAutoApply, column fe_user_preferences.template_auto_apply, NULL = never set = ON) and keeps localStorage as a cache.
//
// Pure decisions only, IMPORT-FREE by design (scripts/test-studio-template-auto-apply-server.mjs transpiles this file into a bare function scope with a fake `process`): no React, no DOM, no network, no clock, no storage.
// hooks/use-studio-template-auto-apply-server.ts does the I/O (fetch), hooks/use-studio-template-match.ts (#559's store) calls it from six marked lines, app/api/preferences/template-auto-apply/route.ts is the server half.
//
// The contract (the route; same path for the client and the server):
//   GET  /api/preferences/template-auto-apply  ->  200 { templateAutoApply: boolean | null }   (null: never set)
//   PUT  /api/preferences/template-auto-apply  { templateAutoApply: boolean }  ->  200 { templateAutoApply: boolean }
//   both need a signed-in user (401 otherwise), and both are 404 while the flag is off.
// The client asks ONCE per page (and user), when the Director socket first opens: a stored boolean that differs from the local cache replaces it (cache, check and a re-sent template_auto_apply); null or an error keeps the cache.
// Every change the user makes (the check) or Director reports (a taken frame whose auto_apply differs: a chat "no template") is PUT, in order, once more after a network error or a 5xx; a failure keeps the local value.

// ---------------------------------------------------------------------------
// Flag (literal process.env reads so Next inlines them at build time)
// ---------------------------------------------------------------------------

/** On only for the exact string "true" on BOTH flags: the server flag does nothing without the template match it extends. */
export function templateAutoApplyServerActive(templateMatchFlag: string | undefined, serverFlag: string | undefined): boolean {
  return templateMatchFlag === 'true' && serverFlag === 'true'
}

export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENABLED = templateAutoApplyServerActive(process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH, process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER)

export const TEMPLATE_AUTO_APPLY_SERVER_PATH = '/api/preferences/template-auto-apply'

// ---------------------------------------------------------------------------
// The wire (client side)
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The stored preference out of a GET answer: a boolean, or null (never set, or any answer that is not exactly that). */
export function parseServerPreference(body: unknown): boolean | null {
  if (!isRecord(body)) return null
  return typeof body.templateAutoApply === 'boolean' ? body.templateAutoApply : null
}

/** What a PUT carries. */
export function serverPreferenceBody(enabled: boolean): { templateAutoApply: boolean } {
  return { templateAutoApply: enabled === true }
}

/**
 * What to do with the stored value the first GET brought back: the boolean to adopt (cache, check, re-send) when it is a boolean that differs from the local value and nothing has changed since the question was asked
 * (the user toggled, a frame wrote the preference, or another user signed in: that newer value wins and is PUT itself); else null (keep the cache).
 */
export function serverPreferenceToAdopt(input: { server: unknown; local: boolean; changedSinceAsk: boolean }): boolean | null {
  if (input.changedSinceAsk) return null
  return typeof input.server === 'boolean' && typeof input.local === 'boolean' && input.server !== input.local ? input.server : null
}

/** A status that says the server half is not there for this page (flag off on the server: 404; signed out: 401): nothing else is asked or sent this page. */
export function serverPreferenceUnavailable(status: number | null): boolean {
  return status === 404 || status === 401
}

/** One more try for a PUT: only the first failure, and only for a network error (status null) or a 5xx. A 4xx would fail again. */
export function shouldRetryServerPut(status: number | null, attempt: number): boolean {
  return attempt === 0 && (status === null || status >= 500)
}

// ---------------------------------------------------------------------------
// The wire (server side)
// ---------------------------------------------------------------------------

/** The PUT body, strictly: an object with exactly one own key, `templateAutoApply`, a boolean. Anything else is null (the route answers 400). */
export function parseServerPutBody(body: unknown): boolean | null {
  if (!isRecord(body)) return null
  const keys = Object.keys(body)
  if (keys.length !== 1 || keys[0] !== 'templateAutoApply') return null
  return typeof body.templateAutoApply === 'boolean' ? body.templateAutoApply : null
}
