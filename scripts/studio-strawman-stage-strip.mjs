// FRONTEND-1 (PK's UAT feedback F-04, F-05, F-07, with F-06's one plain line; 30 Oct). Flag NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE (the string "true", default off, build-time):
// from the outline on, the stage is the normal deck viewer showing Director's Layout strawman preview deck (the slide_update preview_url Studio already loads as the presentation URL), not a separate outline design over it; each slide's plan
// (title, content type, key points) sits under it in a quiet strip with one plain line ("No action needed: building starts automatically."; no Approve on the stage); and when the built deck replaces the preview deck the viewer stays on the same slide.
// Every decision is lib/studio-strawman-stage.ts (pure); hooks/use-studio-strawman-stage.ts holds the slide kept across the swap; components/builder/studio-strawman-plan.tsx (+ .css) draws the strip.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker STRAWMAN-STAGE (matched as a whole token): app/builder/page.tsx (three imports placed after the Builder content, with the flow and chat imports; the phase,
// the plan and the hook's call just before the outline canvas is selected; one spread inside that selection that turns the outline canvas off; and one JSX line before the outline canvas's own). No existing line of app code is rewritten (a later change that
// stacks on this one, or one this is stacked on, may only insert too). Strip the marked lines and each file is its base, byte for byte.
// Not touched, on purpose: components/builder/chat/message-list.tsx and the progress card (another builder's), and the F-03 gate spots in app/builder/page.tsx (after studioFirstRunStage, after the data-studio-first-run-stage attribute) and lib/studio-stage-open-gate.ts (FRONTEND-2's).
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the older proofs that read past it (STRAWMAN_STAGE_PIN_EDITS: one registry-read block each).
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'a470679ca8e198557b2a6f9848e568324305d371' // origin/studio-v4-dev-preparation-code with #553 merged (30 Oct): dev, which this change is cut from
export const STRAWMAN_STAGE_FLAG = 'NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE'
export const STRAWMAN_STAGE_MARKER = 'STRAWMAN-STAGE'
/** The marker as a WHOLE token: STRAWMAN-STAGE-X and X-STRAWMAN-STAGE are not it. */
export const STRAWMAN_STAGE_MARKER_RE = /(?<![\w-])STRAWMAN-STAGE(?![\w-])/
/** The subject prefix of this change's own commits (the proof finds its newest one by it). */
export const STRAWMAN_STAGE_SUBJECT = 'Strawman stage:'

/** Existing files that get marked lines (pure insertions only). */
export const STRAWMAN_STAGE_FILES = [
  'app/builder/page.tsx',
]

/** New files (no base text to put back). */
export const STRAWMAN_STAGE_NEW_FILES = [
  'lib/studio-strawman-stage.ts',
  'hooks/use-studio-strawman-stage.ts',
  'components/builder/studio-strawman-plan.tsx',
  'components/builder/studio-strawman-plan.css',
  'scripts/studio-strawman-stage-strip.mjs',
  'scripts/test-studio-strawman-stage.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries STRAWMAN_STAGE_PIN_MARK. */
export const STRAWMAN_STAGE_PIN_MARK = '// LATER-CHANGES: registry read (STRAWMAN-STAGE)'
export const STRAWMAN_STAGE_PIN_EDITS = {
  "scripts/test-studio-outline-canvas.mjs": [ // PASS2 #4's proof: it reads the page raw and pins the outline canvas's selection and JSX as contiguous text; this change's spread and strip line sit inside those blocks
    [
      "  const page = (await import('./studio-later-changes.mjs')).stripLaterChanges('app/builder/page.tsx', read('app/builder/page.tsx')) // LATER-CHANGES: registry read (STRAWMAN-STAGE): the lines of the changes registered after this one come out of the page first\n",
      "  const page = read('app/builder/page.tsx')\n",
    ],
  ],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (STRAWMAN_STAGE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const STRAWMAN_STAGE_PIN_FILES = Object.keys(STRAWMAN_STAGE_PIN_EDITS)

export const STRAWMAN_STAGE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...STRAWMAN_STAGE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const STRAWMAN_STAGE_SCOPE_FILES = new Set([...STRAWMAN_STAGE_FILES, ...STRAWMAN_STAGE_NEW_FILES, ...STRAWMAN_STAGE_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const STRAWMAN_STAGE_ENV_BLOCK = `# STUDIO STRAWMAN STAGE (FRONTEND-1; PK's UAT feedback F-04, F-05, F-07, with F-06's one plain line). On for the exact value "true"; default off, and then the outline stage, the chat's approval and the jump to the built deck are exactly as today.
# Build-time value: change it on Vercel and redeploy. Only in the Studio shell, and not in template mode.
# On: no separate outline design over the stage (NEXT_PUBLIC_STUDIO_OUTLINE_CANVAS is not drawn); from the outline on the stage is the normal deck viewer, with its thumbnails, showing Director's Layout strawman preview deck (the slide_update preview_url).
# Under the slide while it is still the strawman, a quiet strip shows that slide's plan from what is already on the wire (slide_update title, key_points, service; slide_context content_type, subtype, key_message; an empty field is not drawn, nothing is made up),
# and one plain line: "No action needed: building starts automatically." There is no Approve on the stage. When the built deck replaces the preview deck the viewer is taken back to the slide the user was on (no reset to slide 1).
# Flip it only together with Director's automatic start of the build (the F-06 change): the line is true only then.
NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripStrawmanStage(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in STRAWMAN_STAGE_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!STRAWMAN_STAGE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !STRAWMAN_STAGE_MARKER_RE.test(line)).join('\n')
}
