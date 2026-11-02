// FRONTEND-1 (F-13 phone orientation, PR 1 of 2; PK's answers of 1 Nov, amended 2 Nov). Flag NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE (exact "true", build-time, default off), only active with the phone shell (NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL):
// a phone turned sideways (the query (orientation: landscape) and (max-height: 500px) and (pointer: coarse), and its CSS twin) with a deck on the stage becomes a viewing stage: the slide fills the screen (the viewer's fit padding is zeroed), the thumbnails are a
// collapsible strip on the LEFT (the viewer's own rail, in a state of its own so it never leaks into portrait), the rail, top bar, switch, toolbar, pull tabs and the tab bar go, a "Chat" button is a full-screen pane switch back to the Director, and TWO floating
// buttons each open one overlay menu, one at a time: a hamburger for the bar's destinations (Studio, Your decks, Templates, Themes, More: a click on the real tab bar's own control) and a plus for the editing fan (Add slide, Add element and the deck actions the phone "..." menu has, each
// through the page's own control). In portrait nothing changes: the phone shell's bottom tab bar stays in the slide view (PK, 2 Nov).
// Every line this change adds to an EXISTING app file is a pure insertion that carries the marker PHONE-LANDSCAPE (a whole token); no existing line is rewritten, and the viewer is not touched (its own rail toggle is clicked, its own fit is fed a slide space 32 px larger by
// CSS). Strip the marked lines and app/builder/page.tsx is its base, byte for byte (three imports, the workspace-width clamp's call and one line of JSX at the shell root). The decisions live in lib/studio-phone-landscape.ts (pure); the hooks in
// hooks/use-studio-phone-landscape.ts; the drawing in components/builder/studio-phone-landscape.tsx and .css.
// Two older proofs read the first-parent line of BASE..HEAD for their own commits' subjects, and a branch with this change on it has this change's commits there: each is taught one inserted line that leaves "Phone landscape:" commits out (PIN_EDITS, tests only, registry-read marks).
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'abf52d4d4858b24cdb62549325ae5b9eed36624e' // origin/studio-v4-dev-preparation-code (#554 merged, on #555) merged into this branch before it was finished; this change started on 61a71137 (#555) and its own commits are found by subject
export const PHONE_LANDSCAPE_FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE'
export const PHONE_LANDSCAPE_MARKER = 'PHONE-LANDSCAPE'
/** The marker as a WHOLE token: PHONE-LANDSCAPE-X and X-PHONE-LANDSCAPE are not it. */
export const PHONE_LANDSCAPE_MARKER_RE = /(?<![\w-])PHONE-LANDSCAPE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const PHONE_LANDSCAPE_SUBJECT = 'Phone landscape:'

/** Existing files that get marked lines. */
export const PHONE_LANDSCAPE_FILES = ['app/builder/page.tsx']

/** New files (no base text to put back). */
export const PHONE_LANDSCAPE_NEW_FILES = [
  'lib/studio-phone-landscape.ts',
  'hooks/use-studio-phone-landscape.ts',
  'components/builder/studio-phone-landscape.tsx',
  'components/builder/studio-phone-landscape.css',
  'scripts/studio-phone-landscape-strip.mjs',
  'scripts/test-studio-phone-landscape.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file. Every line the proof has now carries a registry-read mark. */
export const PHONE_LANDSCAPE_PIN_MARK = "LATER-CHANGES: registry read (PHONE-LANDSCAPE)"
export const PHONE_LANDSCAPE_PIN_EDITS = {
  "scripts/test-studio-deck-sync-truth.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Phone landscape:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (PHONE-LANDSCAPE): on a branch stacked after this change (the phone landscape's), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
     ""]
  ],
  "scripts/test-studio-chat-element-edit.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Phone landscape:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (PHONE-LANDSCAPE): on a branch stacked after this change (the phone landscape's), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
     ""]
  ],
  "scripts/test-studio-stage-open-gate.mjs": [
    ["const REAL = { norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text), laterRegistryLine: line => line.includes('studio-phone-landscape-strip.mjs') } // LATER-CHANGES: registry read (PHONE-LANDSCAPE): the phone landscape (registered after this one) puts its own lines after this one's in each list of the registry\n",
     "const REAL = { norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }\n"],
    ["    for (const line of diffLines(normDiff({ norm: (r, text) => r === rel ? registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(stripStageOpenGate) + 1).reduce((out, strip) => { const next = typeof strip === 'function' ? strip(r, out) : out; return typeof next === 'string' ? next : out }, text) : ctx.norm(r, text) }, rel, head))) if (line.startsWith('+')) assert.ok(line.includes(STAGE_OPEN_GATE_PIN_MARK), `${rel}: an added line without the mark: ${line.slice(0, 100)}`) // LATER-CHANGES: registry read (PHONE-LANDSCAPE): the lines of the changes registered after this one come out of a proof it taught before its added lines are read\n",
     "    for (const line of diffLines(normDiff({ norm: (r, text) => r === rel ? text : ctx.norm(r, text) }, rel, head))) if (line.startsWith('+')) assert.ok(line.includes(STAGE_OPEN_GATE_PIN_MARK), `${rel}: an added line without the mark: ${line.slice(0, 100)}`)\n"],
    ["  const later = laterStrips(PAGE, syntheticStrip(PAGE, git('show', `${SYNTHETIC}:${PAGE}`))) // read as this change left it: the later change's lines out (as laterStrips does for a registered one) // LATER-CHANGES: registry read (PHONE-LANDSCAPE): the lines of the changes registered after this one come out too\n",
     "  const later = syntheticStrip(PAGE, git('show', `${SYNTHETIC}:${PAGE}`)) // read as this change left it: the later change's lines out (as laterStrips does for a registered one)\n"]
  ]
}

/** The proof without this change's edits (the previous file). */
export function putBackPin(rel, text) {
  return (PHONE_LANDSCAPE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const PHONE_LANDSCAPE_PIN_FILES = Object.keys(PHONE_LANDSCAPE_PIN_EDITS)

export const PHONE_LANDSCAPE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...PHONE_LANDSCAPE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PHONE_LANDSCAPE_SCOPE_FILES = new Set([...PHONE_LANDSCAPE_FILES, ...PHONE_LANDSCAPE_NEW_FILES, ...PHONE_LANDSCAPE_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const PHONE_LANDSCAPE_ENV_BLOCK = `# STUDIO PHONE LANDSCAPE (FRONTEND-1; F-13 phone orientation, PR 1; PK's answers of 1 Nov). On for the exact value "true" AND only together with NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL (both exact "true"); default off, and then nothing changes. Build-time value: change it on Vercel and redeploy.
# On, a phone turned sideways (a short, coarse-pointer landscape window: (orientation: landscape) and (max-height: 500px) and (pointer: coarse); a narrow desktop window is not one) with a deck on the stage becomes a viewing stage: the slide fills the screen, the thumbnails are a collapsible strip on the left
# (a state of its own, never the portrait rail's), the rail, top bar, Slides | Director switch, toolbar, pull tabs and tab bar go, a "Chat" button switches the whole screen back to the Director, and TWO small floating buttons each open one overlay menu over the slide (one at a time): a hamburger for the bar's
# destinations (Studio, Your decks, Templates, Themes, More: each is the real tab bar's own control) and a plus for the editing fan (Add slide, Add element and the deck actions the phone "..." menu has, each using the page's own control). Editing is a secondary action: a panel it opens covers the stage, as today. In portrait nothing changes: the phone shell's bottom tab bar stays in the slide view. The screen is never locked to an orientation.
NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPhoneLandscape(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in PHONE_LANDSCAPE_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!PHONE_LANDSCAPE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !PHONE_LANDSCAPE_MARKER_RE.test(line)).join('\n')
}
