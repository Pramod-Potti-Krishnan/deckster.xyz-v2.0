// FRONTEND-2 (B60; FRONTEND-1's UX pass finding UX-15: "/redeem still looks like the old site: a purple gradient, the old lowercase wordmark and a purple button"). Flag NEXT_PUBLIC_STUDIO_REDEEM_V4 (exact "true", build-time, default off),
// read in lib/studio-redeem-v4.ts. On, the /redeem page draws the same words, the same coupon field and the same request in the Studio v4 frame (components/studio-redeem.tsx and its stylesheet): the shell's tokens in light and dark,
// the Studio brand tile with "Deckster", the v4 primary button, a phone that fits at 375 wide. Off, nothing changes: the page is the file it was.
// Every line this change adds to the EXISTING page (app/(auth)/redeem/page.tsx) is a pure insertion that carries the marker REDEEM-V4 (a WHOLE token): the next/dynamic import, the flag-tested dynamic() (the flag is tested inline around the
// import(), as app/not-found.tsx does, so with it off the build drops the view and its stylesheet), and three one-line dispatches (the Suspense fallback, the loading state, the card). Strip the marked lines and the page is its base, byte for byte
// (stripRedeemV4(rel, text)). No existing line is rewritten. The request (POST /api/coupons/redeem, { code }), the handlers and the state stay in the page; the view only draws what it is given.
// The older proofs this change teaches (PIN_EDITS, tests only, every line carries the registry-read mark): the two that read the first-parent line of BASE..HEAD for their own commits' subjects (one more inserted line each, for "Redeem v4:", as the
// phone hints did). No proof in FRONTEND-1's or COMPOSER-2's lane is edited.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '1bb42d7f04cf9e0484f18fda1097d9e5fc2611e5' // restacked 6 Nov onto dev 1bb42d7f (#588, #567, #587, #583, #575 in); was 3e1ce88e (#564), the branch this change was made on
export const REDEEM_V4_FLAG = 'NEXT_PUBLIC_STUDIO_REDEEM_V4'
export const REDEEM_V4_MARKER = 'REDEEM-V4'
/** The marker as a WHOLE token: REDEEM-V4 is this change's; REDEEM-V4-X and X-REDEEM-V4 are not. */
export const REDEEM_V4_MARKER_RE = /(?<![\w-])REDEEM-V4(?![\w-])/
/** The subject prefix of this change's own commits. */
export const REDEEM_V4_SUBJECT = 'Redeem v4:'

/** Existing app files that get marked lines. */
export const REDEEM_V4_FILES = ['app/(auth)/redeem/page.tsx']

/** New files (no base text to put back). */
export const REDEEM_V4_NEW_FILES = [
  'lib/studio-redeem-v4.ts',
  'components/studio-redeem.tsx',
  'components/studio-redeem.css',
  'scripts/studio-redeem-v4-strip.mjs',
  'scripts/test-studio-redeem-v4.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the base commit's proof has] per edit, whole lines, so putting them back gives the base file byte for byte. Every line the proof has now carries REDEEM_V4_PIN_MARK. */
export const REDEEM_V4_PIN_MARK = '// LATER-CHANGES: registry read (REDEEM-V4)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Redeem v4:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (REDEEM-V4): on a branch stacked after this change (the redeem v4's), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const REDEEM_V4_PIN_EDITS = {
  "scripts/test-studio-deck-sync-truth.mjs": [[FIRST_PARENT_LINE, ""]],
  "scripts/test-studio-chat-element-edit.mjs": [[FIRST_PARENT_LINE, ""]],
}

/** The proof without this change's edits (the base commit's file). Idempotent: a proof that has none of the edits comes back as it is. */
export function putBackPin(rel, text) {
  return (REDEEM_V4_PIN_EDITS[rel] || []).reduce((out, [has, base]) => out.replace(has, () => base), text)
}

/** The older proofs this change teaches. */
export const REDEEM_V4_PIN_FILES = Object.keys(REDEEM_V4_PIN_EDITS)

/** Files this change edits that are not app code: .env.example (its block, appended), the registry (three lines: its files, its block, its strip) and the older proofs it teaches (REDEEM_V4_PIN_EDITS). */
export const REDEEM_V4_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...REDEEM_V4_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const REDEEM_V4_SCOPE_FILES = new Set([...REDEEM_V4_FILES, ...REDEEM_V4_NEW_FILES, ...REDEEM_V4_OWN_EDITS])

/** The whole .env.example block: its comments and its line (appended at the end of the file, after one blank line). */
export const REDEEM_V4_ENV_BLOCK = `# STUDIO REDEEM V4 (FRONTEND-2; B60; FRONTEND-1's UX pass finding UX-15). On for the exact value "true"; default off, and then nothing changes: /redeem is the page it was (the purple gradient, the old lowercase wordmark, the purple button). Build-time value: change it on Vercel and redeploy.
# On, /redeem draws the same words, the same coupon field and the same request in the Studio v4 frame: the shell's tokens in light and dark, the Studio brand tile with "Deckster" and the v4 primary button. A phone (375 wide) fits with no sideways scroll. Only the look changes.
NEXT_PUBLIC_STUDIO_REDEEM_V4="false"
`

/** The file without this change's lines: in the page every line that carries the marker (as a whole token) is taken out, every other byte stays; an older proof this change taught gets its base text back (putBackPin). Any other file is returned as it is. */
export function stripRedeemV4(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in REDEEM_V4_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its base text, so a proof that holds it byte for byte reads it as it was
  if (!REDEEM_V4_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !REDEEM_V4_MARKER_RE.test(line)).join('\n')
}
