// FRONTEND-1 (program1/studio-director-rest-sign, handed by PROGRAM-1, 4 Nov). Flag STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED (server env, the string "true", default off): every Next proxy to a Director
// user-scoped REST route adds a DB-verified X-Deckster-Entitlement (lib/studio-director-rest-sign.ts). Every line this change adds to an EXISTING file carries the marker DIRECTOR-REST-SIGN (a whole token):
// an import in each of the 13 proxies, the signed headers line of each Director fetch (a whole line that replaces the base's line: DIRECTOR_REST_SIGN_EDITS holds [line now, line before]),
// two pure insertions in app/api/slides/compose/route.ts (after the compose-only signer, which stays as it was) and two in lib/director-rest-entitlement.ts (the optional "path" claim).
// Strip the marked lines (and put each replaced line back) and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // origin/studio-v4-dev-preparation-code under this change
export const DIRECTOR_REST_SIGN_FLAG = 'STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED'
export const DIRECTOR_REST_SIGN_MARKER = 'DIRECTOR-REST-SIGN'
/** The marker as a WHOLE token. */
export const DIRECTOR_REST_SIGN_MARKER_RE = /(?<![\w-])DIRECTOR-REST-SIGN(?![\w-])/

/** Existing files that get marked lines. */
export const DIRECTOR_REST_SIGN_FILES = [
  'app/api/director/sessions/[sourceSessionId]/handoff/route.ts',
  'app/api/ingest-jobs/[jobId]/route.ts',
  'app/api/slides/compose/route.ts',
  'app/api/slides/jobs/[jobId]/route.ts',
  'app/api/slides/refine/route.ts',
  'app/api/templates/[id]/blueprint/route.ts',
  'app/api/templates/[id]/enrich/route.ts',
  'app/api/templates/[id]/route.ts',
  'app/api/templates/route.ts',
  'app/api/themes/[id]/route.ts',
  'app/api/themes/[id]/standard/route.ts',
  'app/api/themes/route.ts',
  'app/api/themes/standard/route.ts',
  'lib/director-rest-entitlement.ts'
]

/** Whole lines that replace a base line: [line now, line before] per file (a line now carries the marker and occurs once in its file). */
export const DIRECTOR_REST_SIGN_EDITS = {
  "app/api/director/sessions/[sourceSessionId]/handoff/route.ts": [
    [
      "        headers: { 'Content-Type': 'application/json', ...(await directorRestSignHeaders(userId, 'POST', { path: `/api/sessions/${encodeURIComponent(sourceSessionId)}/handoff` })) }, // DIRECTOR-REST-SIGN",
      "        headers: { 'Content-Type': 'application/json' },"
    ]
  ],
  "app/api/ingest-jobs/[jobId]/route.ts": [
    [
      "      { cache: 'no-store', headers: await directorRestSignHeaders(userId, 'GET', { path: `/api/users/${encodeURIComponent(userId)}/ingest-jobs/${encodeURIComponent(jobId)}` }) }, // DIRECTOR-REST-SIGN",
      "      { cache: 'no-store' },"
    ]
  ],
  "app/api/slides/jobs/[jobId]/route.ts": [
    [
      "      { cache: 'no-store', headers: await directorRestSignHeaders(userId, 'GET', { path: `/api/v1/slides/compose-jobs/${encodeURIComponent(jobId)}` }) }, // DIRECTOR-REST-SIGN",
      "      { cache: 'no-store' },"
    ]
  ],
  "app/api/templates/[id]/blueprint/route.ts": [
    [
      "        headers: { 'Content-Type': 'application/json', ...(await directorRestSignHeaders(userId, 'PATCH', { path: `/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(id)}/blueprint` })) }, // DIRECTOR-REST-SIGN",
      "        headers: { 'Content-Type': 'application/json' },"
    ]
  ],
  "app/api/templates/[id]/enrich/route.ts": [
    [
      "      { method: 'POST', headers: await directorRestSignHeaders(userId, 'POST', { path: `/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(id)}/enrich` }) }, // DIRECTOR-REST-SIGN",
      "      { method: 'POST' },"
    ]
  ],
  "app/api/templates/[id]/route.ts": [
    [
      "      { cache: 'no-store', headers: await directorRestSignHeaders(userId, 'GET', { path: `/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(id)}` }) }, // DIRECTOR-REST-SIGN",
      "      { cache: 'no-store' },"
    ],
    [
      "      { method: 'DELETE', headers: await directorRestSignHeaders(userId, 'DELETE', { path: `/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(id)}` }) }, // DIRECTOR-REST-SIGN",
      "      { method: 'DELETE' },"
    ],
    [
      "      { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await directorRestSignHeaders(userId, 'PATCH', { path: `/api/users/${encodeURIComponent(userId)}/templates/${encodeURIComponent(id)}` })) }, body: JSON.stringify({ name }) }, // DIRECTOR-REST-SIGN",
      "      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) },"
    ]
  ],
  "app/api/templates/route.ts": [
    [
      "      { cache: 'no-store', headers: await directorRestSignHeaders(userId, 'GET', { path: `/api/users/${encodeURIComponent(userId)}/templates` }) }, // DIRECTOR-REST-SIGN",
      "      { cache: 'no-store' },"
    ],
    [
      "        headers: { 'Content-Type': 'application/json', ...(await directorRestSignHeaders(userId, 'POST', { path: `/api/users/${encodeURIComponent(userId)}/templates` })) }, // DIRECTOR-REST-SIGN",
      "        headers: { 'Content-Type': 'application/json' },"
    ]
  ],
  "app/api/themes/[id]/route.ts": [
    [
      "      { cache: 'no-store', headers: await directorRestSignHeaders(userId, 'GET', { path: `/api/users/${encodeURIComponent(userId)}/themes/${encodeURIComponent(id)}` }) }, // DIRECTOR-REST-SIGN",
      "      { cache: 'no-store' },"
    ],
    [
      "        headers: { 'Content-Type': 'application/json', ...(await directorRestSignHeaders(userId, 'PATCH', { path: `/api/users/${encodeURIComponent(userId)}/themes/${encodeURIComponent(id)}` })) }, // DIRECTOR-REST-SIGN",
      "        headers: { 'Content-Type': 'application/json' },"
    ],
    [
      "      { method: 'DELETE', headers: await directorRestSignHeaders(userId, 'DELETE', { path: `/api/users/${encodeURIComponent(userId)}/themes/${encodeURIComponent(id)}` }) }, // DIRECTOR-REST-SIGN",
      "      { method: 'DELETE' },"
    ]
  ],
  "app/api/themes/[id]/standard/route.ts": [
    [
      "      { method: 'PUT', headers: await directorRestSignHeaders(userId, 'PUT', { path: `/api/users/${encodeURIComponent(userId)}/themes/${encodeURIComponent(id)}/standard` }) }, // DIRECTOR-REST-SIGN",
      "      { method: 'PUT' },"
    ]
  ],
  "app/api/themes/route.ts": [
    [
      "      { cache: 'no-store', headers: await directorRestSignHeaders(userId, 'GET', { path: `/api/users/${encodeURIComponent(userId)}/themes` }) }, // DIRECTOR-REST-SIGN",
      "      { cache: 'no-store' },"
    ],
    [
      "        headers: { 'Content-Type': 'application/json', ...(await directorRestSignHeaders(userId, 'POST', { path: `/api/users/${encodeURIComponent(userId)}/themes` })) }, // DIRECTOR-REST-SIGN",
      "        headers: { 'Content-Type': 'application/json' },"
    ]
  ],
  "app/api/themes/standard/route.ts": [
    [
      "      { cache: 'no-store', headers: await directorRestSignHeaders(userId, 'GET', { path: `/api/users/${encodeURIComponent(userId)}/themes/standard` }) }, // DIRECTOR-REST-SIGN",
      "      { cache: 'no-store' },"
    ],
    [
      "      { method: 'DELETE', headers: await directorRestSignHeaders(userId, 'DELETE', { path: `/api/users/${encodeURIComponent(userId)}/themes/standard` }) }, // DIRECTOR-REST-SIGN",
      "      { method: 'DELETE' },"
    ]
  ]
}

/** New files (no base text to put back). */
export const DIRECTOR_REST_SIGN_NEW_FILES = ['lib/studio-director-rest-sign.ts', 'scripts/studio-director-rest-sign-strip.mjs', 'scripts/test-studio-director-rest-sign.mjs']

/** Files this change edits that are neither marked app code nor new: its .env.example block and the registry (three lines). Run the proof with `node scripts/test-studio-director-rest-sign.mjs`. */
export const DIRECTOR_REST_SIGN_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

/** Every file this change's commits touch. */
export const DIRECTOR_REST_SIGN_SCOPE_FILES = new Set([...DIRECTOR_REST_SIGN_FILES, ...DIRECTOR_REST_SIGN_NEW_FILES, ...DIRECTOR_REST_SIGN_OWN_EDITS])

/** The whole .env.example block. */
export const DIRECTOR_REST_SIGN_ENV_BLOCK = `# STUDIO DIRECTOR REST SIGN ALL (PROGRAM-1 / FRONTEND-1; program1/studio-director-rest-sign). Server env, read on every call; on only for the exact string "true", default off, and then every Director REST proxy sends exactly what it sent before (no session read, no DB read, no secret read).
# On: every Next proxy to a Director user-scoped REST route (templates, themes, ingest jobs, compose-one, compose jobs, refine-one, handoff) adds X-Deckster-Entitlement, signed with DIRECTOR_WS_AUTH_SECRET, ONLY when the session user's DB id is exactly the user_id the proxy sends
# (the DB id is reused for 30 s per user, in-process). The claims also carry the Director path of the call as "path". A session with no id (the e-mail fallback) gets no header and one log line: keep Director's DIRECTOR_REST_AUTH_ALL_ENABLED off until every session has an id.
STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED="false"
`

/** The file without this change's lines: each replaced line goes back to the base's, every other line that carries the marker comes out, every other byte stays. Any other file is returned as it is. */
export function stripDirectorRestSign(rel, text) {
  if (typeof text !== 'string' || !DIRECTOR_REST_SIGN_FILES.includes(rel)) return text
  const back = (DIRECTOR_REST_SIGN_EDITS[rel] || []).reduce((out, [has, was]) => out.split('\n').map(line => (line === has ? was : line)).join('\n'), text)
  return back.split('\n').filter(line => !DIRECTOR_REST_SIGN_MARKER_RE.test(line)).join('\n')
}
