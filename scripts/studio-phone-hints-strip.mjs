// FRONTEND-1 (F-13 phone orientation, PR 2 of 2; PK's answers of 1 Nov). Flag NEXT_PUBLIC_STUDIO_PHONE_HINTS (exact "true", build-time, default off), only active with PR 1's flag (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE) and so with the phone shell
// (NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL): in the portrait slide view a one-time "Rotate for the best view" card (dismiss X, Full screen, "Not now"; stored per phone in localStorage, in try / catch; also stored once the phone has been seen
// sideways), a Full screen button above the slide, and swipe left / right to change slide (no prev / next arrows) with a one-time swipe hint stored per phone; in PR 1's landscape stage a Full screen button beside Chat. Full screen asks the browser INSIDE the tap
// (requestFullscreen on the viewer's own box), catches a refusal, and falls back to a fixed 100dvh stage of our own; it never locks the orientation.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker PHONE-HINTS (a whole token): app/builder/page.tsx (two imports and one line of JSX at the shell root, after PR 1's) and components/presentation-viewer.tsx (one import and the
// swipe hook's call, after the next / previous handlers). No existing line is rewritten and none of PR 1's own files is edited (its stylesheet reads the one custom property this change's stylesheet sets). Strip the marked lines and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'e3c2477663026bc0aac89630aeb96e9df5f0365d' // PR 1's head (frontend1/phone-landscape) at the start of this change: this change is stacked on it
export const PHONE_HINTS_FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_HINTS'
export const PHONE_HINTS_MARKER = 'PHONE-HINTS'
/** The marker as a WHOLE token: PHONE-HINTS-X and X-PHONE-HINTS are not it. */
export const PHONE_HINTS_MARKER_RE = /(?<![\w-])PHONE-HINTS(?![\w-])/
/** The subject prefix of this change's own commits. */
export const PHONE_HINTS_SUBJECT = 'Phone hints:'

/** Existing files that get marked lines. */
export const PHONE_HINTS_FILES = ['app/builder/page.tsx', 'components/presentation-viewer.tsx']

/** New files (no base text to put back). */
export const PHONE_HINTS_NEW_FILES = [
  'lib/studio-phone-hints.ts',
  'hooks/use-studio-phone-hints.ts',
  'components/builder/studio-phone-hints.tsx',
  'components/builder/studio-phone-hints.css',
  'scripts/studio-phone-hints-strip.mjs',
  'scripts/test-studio-phone-hints.mjs',
]

export const PHONE_HINTS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

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
  if (!PHONE_HINTS_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !PHONE_HINTS_MARKER_RE.test(line)).join('\n')
}
