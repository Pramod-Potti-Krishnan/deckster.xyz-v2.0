// FRONTEND-2: Add Slide's compose proxy signs its user for Director (flag STUDIO_COMPOSE_ENTITLEMENT_ENABLED, a server env, exact "true", default off; stacked on #475).
// The exact text this change adds to the files it touches, so a pin that holds one of them to an earlier commit can first put the base text
// back (stripComposeEntitlement(rel, text)), the way the other *-strip.mjs files do. scripts/test-studio-compose-entitlement.mjs proves that
// stripping gives back BASE_COMMIT's file byte for byte. Every pair is context-free: `added` is a literal that occurs once in the file and `original`
// is what stands there in the base ('' for a pure insertion), so removing one needs no neighbouring text. .env.example's block included.
// New files (no base text to put back): COMPOSE_ENTITLEMENT_NEW_FILES below.

export const BASE_COMMIT = '8e19f9f292fdedc431fe68038df92e455e6e3040'

const ENV_BLOCK = `# ADD SLIDE COMPOSE SIGNS ITS USER (FRONTEND-2, stacked on #475; the Next proxy POST /api/slides/compose only). A plain SERVER variable (no NEXT_PUBLIC_ prefix, no rebuild): it is read as each request
# arrives, and only the exact value "true" turns it on; default off, and then the request to Director is byte-for-byte what it was. It pairs with Director !535 (DIRECTOR_ROUTER_COMPOSE_BIND_USER_ENABLED,
# off): Director binds a compose to its user for Model Router attribution ONLY when the request carries a verified X-Deckster-Entitlement (typ "rest", m "POST", sub equal to the body's user_id) AND that id is
# a valid router id as it stands. On, Studio adds that header (signed per request, on the server, by the same helper the deck-import routes use) ONLY when the body's user_id is the person's canonical id
# (the session user's id, or the Knowledge-Graph gate's id on that branch; never the e-mail the route falls back to when a session has no id) and that id matches Director's clean_id rule: starts with a
# letter or digit, then letters, digits and . _ : -, at most 255 characters, ASCII only (director-v4.0 src/utils/mr_context.py:84,101-111). Any other case adds no header and changes nothing. The body's
# user_id is chosen exactly as before. It also needs DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED "true" and DIRECTOR_WS_AUTH_SECRET (the shared helper's own rules; documented where they belong, not here).
# Flip order: either side first is safe (Director ignores a header it does not know; Studio's header alone binds nothing); the bind needs both.
STUDIO_COMPOSE_ENTITLEMENT_ENABLED="false"

`

const ROUTE_IMPORT = `import { composeEntitlementHeaders } from '@/lib/studio-compose-entitlement'
`

const ROUTE_CANONICAL = `  // STUDIO_COMPOSE_ENTITLEMENT_ENABLED (default off, stacked on #475): the id the signed header may carry. Only the session's own id (never the e-mail fallback above) or the KG gate's id.
  let canonicalUserId: string | null = sessionUser?.id || null
`

const ROUTE_GATE = `    canonicalUserId = gate.userId
`

const ROUTE_MINT = `  // STUDIO_COMPOSE_ENTITLEMENT_ENABLED (stacked on #475): the signed X-Deckster-Entitlement Director !535 needs to bind this compose to its user. {} unless the flag is on, the id is canonical and valid.
  const entitlement = composeEntitlementHeaders(payload.user_id, canonicalUserId)

`

// [text this change has, text the base has]; each `added` is a literal that occurs once in the file.
const CHANGES = {
  '.env.example': [[ENV_BLOCK, '']],
  'app/api/slides/compose/route.ts': [
    [ROUTE_IMPORT, ''],
    [ROUTE_CANONICAL, ''],
    [ROUTE_GATE, ''],
    [ROUTE_MINT, ''],
    ['      headers: { ...directorHeaders, ...entitlement },', '      headers: directorHeaders,'],
  ],
}

export const COMPOSE_ENTITLEMENT_FILES = Object.keys(CHANGES)
export const COMPOSE_ENTITLEMENT_NEW_FILES = ['lib/studio-compose-entitlement.ts',
  'scripts/studio-compose-entitlement-strip.mjs', 'scripts/test-studio-compose-entitlement.mjs',
  // Director's real clean_id answers over 877 candidate ids, recorded by running the unmodified src/utils/mr_context.py
  'scripts/fixtures/studio-compose-entitlement/clean-id-recorded.json',
  // the request the REAL route sent, recorded for DIRECTOR-2 (signature redacted to its length)
  'scripts/fixtures/studio-compose-entitlement/recorded-request.json']
export const COMPOSE_ENTITLEMENT_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripComposeEntitlement(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}
