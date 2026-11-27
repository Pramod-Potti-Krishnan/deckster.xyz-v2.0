// PL-70 STEP A (Platform card PL-70-STEP0, CHIEF-ARCH CA-123 / CA-124 / CA-127(A), 27 Nov 2026): the named allowlist for PATCH /api/sessions/[id], and the store-name guard of POST /api/sessions/[id]/files, behind TWO
// server-only flags that default off (STUDIO_SESSION_PATCH_ALLOWLIST_SHADOW_V1_ENABLED, STUDIO_SESSION_PATCH_ALLOWLIST_V1_ENABLED). The change touches four existing files; older proofs hold them to the base byte for byte, so it
// registers a strip: the marked lines of the two routes come out (three each: the import and two calls, all pure insertions), the api-hardening owner lookup goes back to the unordered list (a generated reverse hunk), the
// registry takes its own three lines out, and the env block comes out through the registry's own env mechanism. Plain node, nothing is read from disk or git here.

export const PL70_BASE_COMMIT = '3bfd58a5' // origin/claude/pl54-registry-tolerance (uat 7a743ed281 + the tests-only generic registry tolerance): the commit this change is cut from
export const PL70_COMMIT_SUBJECT = /^PL-70:/
export const PL70_MARKER_RE = /PL-70 STEP A/
export const PL70_MARK = 'PL-70 STEP A'

/** The two routes that gain marked lines (every one a whole inserted line, no existing line rewritten). */
export const PL70_ROUTE_FILES = new Set([
  'app/api/sessions/[id]/route.ts',
  'app/api/sessions/[id]/files/route.ts',
])
export const PL70_API_HARDENING = 'lib/api-hardening.ts'

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL70_SCOPE_FILES = new Set([
  ...PL70_ROUTE_FILES,
  'lib/api-hardening.ts',
  'lib/studio-session-patch-allowlist.ts',
  'lib/studio-session-patch-guard.ts',
  '.env.example',
  'scripts/studio-pl70-session-patch-allowlist-strip.mjs',
  'scripts/test-studio-pl70-session-patch-allowlist.mjs',
  'scripts/studio-later-changes.mjs',
])

/** The .env.example block, exactly as added (the registry takes it out). */
export const PL70_ENV_BLOCK = "# STUDIO SESSION PATCH ALLOWLIST (PL-70 Step A, server-side). Both flags take the exact value \"true\" and default off; off, PATCH /api/sessions/[id] and POST /api/sessions/[id]/files behave exactly as before.\n# SHADOW (the first flag): the writes happen as they do today; the NAME of a refused key and a reason code are logged, never a value, an id, a URL, a store name or a user id. Run a full deck set (save, duplicate, upload, reload) in shadow and read the log before enforcing.\n# ENFORCE (the second flag): a key outside the named allowlist, or an invalid value, refuses the whole request with one uniform 400 and nothing is written. Enforce wins when both are on. Roll back in one toggle: enforce off, then shadow off.\nSTUDIO_SESSION_PATCH_ALLOWLIST_SHADOW_V1_ENABLED=\"false\"\nSTUDIO_SESSION_PATCH_ALLOWLIST_V1_ENABLED=\"false\"\n"

/** The three lines this change adds to scripts/studio-later-changes.mjs, exactly as registered. */
export const PL70_REGISTRY_LINES = [
  "  ...(await import('./studio-pl70-session-patch-allowlist-strip.mjs')).PL70_SCOPE_FILES, // LATER-CHANGE: PLATFORM (LEAD-PLATFORM-CLAUDE), PL-70 Step A session PATCH allowlist (STUDIO_SESSION_PATCH_ALLOWLIST_SHADOW_V1_ENABLED / STUDIO_SESSION_PATCH_ALLOWLIST_V1_ENABLED)\n",
  "  (await import('./studio-pl70-session-patch-allowlist-strip.mjs')).PL70_ENV_BLOCK, // LATER-CHANGE: PLATFORM (LEAD-PLATFORM-CLAUDE), PL-70 Step A session PATCH allowlist (STUDIO_SESSION_PATCH_ALLOWLIST_SHADOW_V1_ENABLED / STUDIO_SESSION_PATCH_ALLOWLIST_V1_ENABLED)\n",
  "  (await import('./studio-pl70-session-patch-allowlist-strip.mjs')).stripPl70SessionPatchAllowlist, // LATER-CHANGE: PLATFORM (LEAD-PLATFORM-CLAUDE), PL-70 Step A session PATCH allowlist (STUDIO_SESSION_PATCH_ALLOWLIST_SHADOW_V1_ENABLED / STUDIO_SESSION_PATCH_ALLOWLIST_V1_ENABLED)\n",
]

/** The reverse hunks of lib/api-hardening.ts: [text as it stands now, text as it was before], generated from the diff (not retyped). */
export const PL70_REVERSE_HUNKS = {
  "lib/api-hardening.ts": [
    [
      "    // PL-70 STEP A: an existence query for ANOTHER user's row, not an unordered list of 20 (a caller with 20 rows of their own could push the other owner out of it)\n    const foreignOwner = pid\n      ? await prisma.chatSession.findFirst({\n          where: {\n            userId: { not: userId },\n            OR: [\n              { blankPresentationId: pid },\n              { strawmanPresentationId: pid },\n              { finalPresentationId: pid },\n            ],\n          },\n          select: { userId: true },\n        })\n      : null\n    const presentationOwners = foreignOwner ? [foreignOwner] : [] // PL-70 STEP A\n",
      "    const presentationOwners = pid\n      ? await prisma.chatSession.findMany({\n          where: {\n            OR: [\n              { blankPresentationId: pid },\n              { strawmanPresentationId: pid },\n              { finalPresentationId: pid },\n            ],\n          },\n          select: { userId: true },\n          take: 20,\n        })\n      : []\n"
    ]
  ],
}

export function stripPl70SessionPatchAllowlist(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') {
    let reg = text
    for (const line of PL70_REGISTRY_LINES) { const at = reg.indexOf(line); if (at >= 0) reg = reg.slice(0, at) + reg.slice(at + line.length) }
    return reg
  }
  if (PL70_ROUTE_FILES.has(rel)) return text.split('\n').filter((line) => !line.includes(PL70_MARK)).join('\n')
  const hunks = PL70_REVERSE_HUNKS[rel]
  if (!hunks) return text
  let out = text
  for (const [now, before] of hunks) { const at = out.indexOf(now); if (at >= 0) out = out.slice(0, at) + before + out.slice(at + now.length) }
  return out
}
