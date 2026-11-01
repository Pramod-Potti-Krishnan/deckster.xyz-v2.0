// FRONTEND-1 (F-13 phone orientation, PR 1 of 2; PK's answers of 1 Nov). Flag NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE (exact "true", build-time, default off), only active with the phone shell (NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL):
// a phone turned sideways (the query (orientation: landscape) and (max-height: 500px) and (pointer: coarse), and its CSS twin) with a deck on the stage becomes a viewing stage: the slide fills the screen (the viewer's fit padding is zeroed), the thumbnails are a
// collapsible strip on the LEFT (the viewer's own rail, in a state of its own so it never leaks into portrait), the rail, top bar, switch, toolbar, pull tabs and the tab bar go, a "Chat" button is a full-screen pane switch back to the Director, and ONE floating
// button opens an overlay fan (Add slide, Add element and the deck actions the phone "..." menu has, each through the page's own control). In portrait the slide view folds the bottom bar to one Menu button.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker PHONE-LANDSCAPE (a whole token); no existing line is rewritten. Strip the marked lines and each file is its base, byte for byte: app/builder/page.tsx (three imports, the
// workspace-width clamp's call and one line of JSX at the shell root) and components/presentation-viewer.tsx (two imports, the rail hook's call and the stage's fit, one line before the viewer's own fit). The decisions live in lib/studio-phone-landscape.ts (pure); the state in
// hooks/use-studio-phone-landscape.ts; the drawing in components/builder/studio-phone-landscape.tsx and .css.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'abf52d4d4858b24cdb62549325ae5b9eed36624e' // origin/studio-v4-dev-preparation-code (#554 merged, on #555) merged into this branch before it was finished; this change started on 61a71137 (#555) and its own commits are found by subject
export const PHONE_LANDSCAPE_FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE'
export const PHONE_LANDSCAPE_MARKER = 'PHONE-LANDSCAPE'
/** The marker as a WHOLE token: PHONE-LANDSCAPE-X and X-PHONE-LANDSCAPE are not it. */
export const PHONE_LANDSCAPE_MARKER_RE = /(?<![\w-])PHONE-LANDSCAPE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const PHONE_LANDSCAPE_SUBJECT = 'Phone landscape:'

/** Existing files that get marked lines. */
export const PHONE_LANDSCAPE_FILES = ['app/builder/page.tsx', 'components/presentation-viewer.tsx']

/** New files (no base text to put back). */
export const PHONE_LANDSCAPE_NEW_FILES = [
  'lib/studio-phone-landscape.ts',
  'hooks/use-studio-phone-landscape.ts',
  'components/builder/studio-phone-landscape.tsx',
  'components/builder/studio-phone-landscape.css',
  'scripts/studio-phone-landscape-strip.mjs',
  'scripts/test-studio-phone-landscape.mjs',
]

export const PHONE_LANDSCAPE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PHONE_LANDSCAPE_SCOPE_FILES = new Set([...PHONE_LANDSCAPE_FILES, ...PHONE_LANDSCAPE_NEW_FILES, ...PHONE_LANDSCAPE_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const PHONE_LANDSCAPE_ENV_BLOCK = `# STUDIO PHONE LANDSCAPE (FRONTEND-1; F-13 phone orientation, PR 1; PK's answers of 1 Nov). On for the exact value "true" AND only together with NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL (both exact "true"); default off, and then nothing changes. Build-time value: change it on Vercel and redeploy.
# On, a phone turned sideways (a short, coarse-pointer landscape window: (orientation: landscape) and (max-height: 500px) and (pointer: coarse); a narrow desktop window is not one) with a deck on the stage becomes a viewing stage: the slide fills the screen, the thumbnails are a collapsible strip on the left
# (a state of its own, never the portrait rail's), the rail, top bar, Slides | Director switch, toolbar, pull tabs and tab bar go, a "Chat" button switches the whole screen back to the Director, and ONE floating button opens an overlay fan over the slide: Add slide, Add element and the deck
# actions the phone "..." menu has (each uses the page's own control). Editing is a secondary action: a panel it opens covers the stage, as today. In portrait the slide view folds the bottom bar to one Menu button (Menu brings the bar back as a floating card). The screen is never locked to an orientation.
NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPhoneLandscape(rel, text) {
  if (typeof text !== 'string') return text
  if (!PHONE_LANDSCAPE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !PHONE_LANDSCAPE_MARKER_RE.test(line)).join('\n')
}
