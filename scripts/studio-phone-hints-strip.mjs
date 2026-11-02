// FRONTEND-1 (F-13 phone orientation, PR 2 of 2; PK's answers of 1 Nov). Flag NEXT_PUBLIC_STUDIO_PHONE_HINTS (exact "true", build-time, default off), only active with PR 1's flag (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE) and so with the phone shell
// (NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL): in the portrait slide view a one-time "Rotate for the best view" card (dismiss X, Full screen, "Not now"; stored per phone in localStorage, in try / catch; also stored once the phone has been seen
// sideways), a Full screen button above the slide, and swipe left / right to change slide (no prev / next arrows) with a one-time swipe hint stored per phone; in PR 1's landscape stage a Full screen button beside Chat. Full screen asks the browser INSIDE the tap
// (requestFullscreen on the viewer's own box), catches a refusal, and falls back to a fixed 100dvh stage of our own; it never locks the orientation.
// Every line this change adds to an EXISTING app file is a pure insertion that carries the marker PHONE-HINTS (a whole token): app/builder/page.tsx (two imports and one line of JSX at the shell root, after PR 1's). The viewer is not touched (a swipe presses the key the viewer
// already listens for), no existing line is rewritten, and none of PR 1's own files is edited (its stylesheet reads the one custom property this change's stylesheet sets). Strip the marked lines and the page is its base, byte for byte.
// The two older proofs that read the first-parent line of BASE..HEAD for their own commits' subjects (PR 1 taught them to leave "Phone landscape:" commits out) are taught one more inserted line each, for "Phone hints:" (PIN_EDITS, tests only, registry-read marks).
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '05f1bf0a6db33c5f3d86e717bfc69a52bb05f8d7' // PR 1's head (frontend1/phone-landscape) at the start of this change: this change is stacked on it
export const PHONE_HINTS_FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_HINTS'
export const PHONE_HINTS_MARKER = 'PHONE-HINTS'
/** The marker as a WHOLE token: PHONE-HINTS-X and X-PHONE-HINTS are not it. */
export const PHONE_HINTS_MARKER_RE = /(?<![\w-])PHONE-HINTS(?![\w-])/
/** The subject prefix of this change's own commits. */
export const PHONE_HINTS_SUBJECT = 'Phone hints:'

/** Existing files that get marked lines. */
export const PHONE_HINTS_FILES = ['app/builder/page.tsx']

/** New files (no base text to put back). */
export const PHONE_HINTS_NEW_FILES = [
  'lib/studio-phone-hints.ts',
  'hooks/use-studio-phone-hints.ts',
  'components/builder/studio-phone-hints.tsx',
  'components/builder/studio-phone-hints.css',
  'scripts/studio-phone-hints-strip.mjs',
  'scripts/test-studio-phone-hints.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file. Every line the proof has now carries a registry-read mark. */
export const PHONE_HINTS_PIN_MARK = "LATER-CHANGES: registry read (PHONE-HINTS)"
export const PHONE_HINTS_PIN_EDITS = {
  "scripts/test-studio-deck-sync-truth.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Phone hints:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (PHONE-HINTS): on a branch stacked after this change (the phone hints'), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
     ""]
  ],
  "scripts/test-studio-chat-element-edit.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Phone hints:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (PHONE-HINTS): on a branch stacked after this change (the phone hints'), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
     ""]
  ]
}

/** The proof without this change's edits (the previous file). */
export function putBackPin(rel, text) {
  return (PHONE_HINTS_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const PHONE_HINTS_PIN_FILES = Object.keys(PHONE_HINTS_PIN_EDITS)

export const PHONE_HINTS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...PHONE_HINTS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PHONE_HINTS_SCOPE_FILES = new Set([...PHONE_HINTS_FILES, ...PHONE_HINTS_NEW_FILES, ...PHONE_HINTS_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const PHONE_HINTS_ENV_BLOCK = `# STUDIO PHONE HINTS (FRONTEND-1; F-13 phone orientation, PR 2; PK's answers of 1 Nov). On for the exact value "true" AND only together with NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE, NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL (all exact "true"); default off, and then nothing changes. Build-time value: change it on Vercel and redeploy.
# On, the portrait slide view (a deck on the stage, the stage on screen) gets: a one-time "Rotate for the best view" card (X, Full screen, Not now; stored per phone in localStorage, so it stays dismissed; also stored once the phone has been seen sideways), a "Full screen" button above the slide,
# and swipe left / right to change slide (there are no prev / next arrows; a swipe starting on the slide works, and editing the slide turns it off) with a one-time swipe hint stored per phone. In the landscape stage a Full screen button sits beside Chat.
# Full screen asks the browser inside the tap (requestFullscreen on the viewer's own box) and, where the browser has none or refuses (iPhone Safari), becomes a fixed 100dvh stage of our own with an Exit button. The screen is never locked to an orientation.
NEXT_PUBLIC_STUDIO_PHONE_HINTS="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPhoneHints(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in PHONE_HINTS_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!PHONE_HINTS_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !PHONE_HINTS_MARKER_RE.test(line)).join('\n')
}
