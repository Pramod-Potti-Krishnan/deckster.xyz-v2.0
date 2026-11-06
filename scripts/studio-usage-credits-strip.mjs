// FRONTEND-2 (B62; the Model Router's usage read API, CODEX-8's streams/router/USAGE-READ-API.md): Studio reads a person's credits for the Usage page. Flag NEXT_PUBLIC_STUDIO_USAGE_CREDITS (exact "true", build-time, default off), defined in
// lib/studio-usage-credits.ts. EVERYTHING this change adds is a NEW file: the server route app/api/usage/credits/route.ts (GET, session-bound, 404 with the flag off), the parser and the words in lib/studio-usage-credits.ts, the credits view in
// components/studio-usage-credits.tsx with its stylesheet, this strip and the proof. No existing app file is edited, so there are no marked lines in app code and nothing for a strip to take out of one; the Usage page (FRONTEND-1's #585) is
// NOT touched: ONE marked dispatch into it comes after #585 merges. The server-only key is MODEL_ROUTER_USAGE_READ_KEY (a router key with the read scope; never a NEXT_PUBLIC_ name).
// Its marker is USAGE-CREDITS (a WHOLE token). What this change adds to existing files: .env.example (one block, appended), the registry (three lines, at the true end of each list) and ONE subject-filter line in each of the two older proofs that
// read the first-parent commits of BASE..HEAD for their own subjects (the pin table below, tests only, every line carries the registry-read mark), exactly as the phone shell coverage did.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'f36e9f8506b16cc0bb13f8f8020a2b9cd85b0f09' // studio-v4-dev-preparation-code at #567 (phone shell coverage), the branch this change is made on
export const USAGE_CREDITS_FLAG = 'NEXT_PUBLIC_STUDIO_USAGE_CREDITS'
export const USAGE_CREDITS_KEY_NAME = 'MODEL_ROUTER_USAGE_READ_KEY'
export const USAGE_CREDITS_MARKER = 'USAGE-CREDITS'
/** The marker as a WHOLE token: USAGE-CREDITS is this change's; USAGE-CREDITS-X, X-USAGE-CREDITS and any other prefix or suffix are not. */
export const USAGE_CREDITS_MARKER_RE = /(?<![\w-])USAGE-CREDITS(?![\w-])/
/** The subject prefix of this change's own commits. */
export const USAGE_CREDITS_SUBJECT = 'Usage credits:'

/** Existing app files that get marked lines: none (every file this change adds to the app is new). */
export const USAGE_CREDITS_FILES = []

/** New files (no base text to put back). */
export const USAGE_CREDITS_NEW_FILES = [
  'app/api/usage/credits/route.ts',
  'lib/studio-usage-credits.ts',
  'components/studio-usage-credits.tsx',
  'components/studio-usage-credits.css',
  'scripts/studio-usage-credits-strip.mjs',
  'scripts/test-studio-usage-credits.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the base commit's proof has] per edit, whole lines, so putting them back gives the base file byte for byte. Every line the proof has now carries USAGE_CREDITS_PIN_MARK. None is in FRONTEND-1's or COMPOSER-2's lane. */
export const USAGE_CREDITS_PIN_MARK = '// LATER-CHANGES: registry read (USAGE-CREDITS)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Usage credits:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (USAGE-CREDITS): on a branch stacked after this change (the usage credits'), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const USAGE_CREDITS_PIN_EDITS = {
  "scripts/test-studio-deck-sync-truth.mjs": [[FIRST_PARENT_LINE, ""]],
  "scripts/test-studio-chat-element-edit.mjs": [[FIRST_PARENT_LINE, ""]],
}

/** The proof without this change's edits (the base commit's file). Idempotent: a proof that has none of the edits comes back as it is. */
export function putBackPin(rel, text) {
  return (USAGE_CREDITS_PIN_EDITS[rel] || []).reduce((out, [has, base]) => out.replace(has, () => base), text)
}

/** The older proofs this change teaches. */
export const USAGE_CREDITS_PIN_FILES = Object.keys(USAGE_CREDITS_PIN_EDITS)

/** Files this change edits that are not app code: .env.example (its block, appended), the registry (three lines: its files, its block, its strip) and the older proofs it teaches (USAGE_CREDITS_PIN_EDITS). */
export const USAGE_CREDITS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...USAGE_CREDITS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const USAGE_CREDITS_SCOPE_FILES = new Set([...USAGE_CREDITS_FILES, ...USAGE_CREDITS_NEW_FILES, ...USAGE_CREDITS_OWN_EDITS])

/** The whole .env.example block: its comments and its two lines (appended at the end of the file, after one blank line). The key's value is EMPTY: nothing secret is written down. */
export const USAGE_CREDITS_ENV_BLOCK = `# STUDIO USAGE CREDITS (FRONTEND-2; B62; the Model Router's usage read API for the Usage page). On for the exact value "true"; default off, and then nothing changes: no element is drawn and the new route GET /api/usage/credits answers 404. Build-time value: change it on Vercel and redeploy.
# On, that route (signed in) reads the Model Router's usage read API, GET /v1/usage/user/{the session's user id}/credits, at the router address the narration block above sets, and returns this UTC month's credits: the day-by-day chart, the plan's used-of-granted with its reset date, top-up credits left and total spendable credits. The Usage page that draws them is a later step.
# MODEL_ROUTER_USAGE_READ_KEY is SERVER-ONLY (never a NEXT_PUBLIC_ name; never sent to the browser or logged): a Model Router key with the read scope, minted by the router's owner, sent as Authorization: Bearer. A read key can read ANY person's usage, so Studio binds the path to the session:
# the user id comes from the signed-in session only, never from a query, a body or a header. Leave it empty until the router's MODEL_ROUTER_USAGE_READ_ENABLED is on; while it or the router address is empty the route answers 503 usage_read_unconfigured.
NEXT_PUBLIC_STUDIO_USAGE_CREDITS="false"
MODEL_ROUTER_USAGE_READ_KEY=
`

/** The file without this change's lines: an older proof this change taught gets its base text back (putBackPin). Any other file is returned as it is (this change marks no line in an app file). */
export function stripUsageCredits(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in USAGE_CREDITS_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its base text, so a proof that holds it byte for byte reads it as it was
  return text
}
