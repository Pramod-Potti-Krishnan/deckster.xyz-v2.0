// FRONTEND-2 (P3-10 MODEL CHOICE, Studio picker). Flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE (exact "true", default off, build-time; it acts only with NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE "true" too): the Intelligence
// page's model chooser reads the live model catalogue (GET /api/models/catalogue) and keeps its choices through an adapter (lib/studio-model-choice.ts, components/studio-personal/intelligence-model-choice.tsx
// and its stylesheet) and saves them in the Model Router through three new Studio server routes (lib/studio-model-choice-server.ts; design A of ROUTER-2's P3-10 doc).
// This change edits NO existing app file: everything is new files, its .env.example block, three registry lines and the one older proof it teaches (MODEL_CHOICE_PIN_EDITS). The one place that mounts the chooser is two pure insertions in the Intelligence page
// (MODEL_CHOICE_PAGE_HOOK below, each carrying the marker MODEL-CHOICE as a whole token). They are HELD, not committed: three FRONTEND-1 pins hold that page byte for byte to their base and read it raw
// (not through scripts/studio-later-changes.mjs), so they need a one-line registry read first (PK's OK). stripModelChoice already takes the marked lines out of the page, so once the hook lands
// (add MODEL_CHOICE_HOOK_FILE to MODEL_CHOICE_FILES) every pin that reads through the registry sees the base page. Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '875334faa648ed72e63b260457ca2fc0a2020c0c' // studio-v4-dev-preparation-code at #518 (speed perceived), the branch this change is cut from
export const MODEL_CHOICE_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE'
export const MODEL_CHOICE_MARKER = 'MODEL-CHOICE'
/** The marker as a WHOLE token: MODEL-CHOICE-X or X-MODEL-CHOICE are not this change's. */
export const MODEL_CHOICE_MARKER_RE = /(?<![\w-])MODEL-CHOICE(?![\w-])/

/** Existing files that get marked lines (pure insertions only). None while the page hook is held. */
export const MODEL_CHOICE_FILES = []

/** The page that mounts the chooser, and the two lines that do it: [the base line it goes after (or, with `before`, before), the inserted line]. Held until PK's OK on the three pins. */
export const MODEL_CHOICE_HOOK_FILE = 'app/(app)/studio/intelligence/page.tsx'
export const MODEL_CHOICE_PAGE_HOOK = [
  {
    after: 'import { IntelligenceChooser } from "@/components/studio-personal/intelligence-p2"\n',
    line: 'import { ModelChoiceChooser, STUDIO_MODEL_CHOICE_ENABLED } from "@/components/studio-personal/intelligence-model-choice" // MODEL-CHOICE: NEXT_PUBLIC_STUDIO_MODEL_CHOICE (default off)\n',
  },
  {
    before: '  return <IntelligenceWorkspace chooser={process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === "true" ? <IntelligenceChooser /> : undefined} />\n',
    line: '  if (STUDIO_MODEL_CHOICE_ENABLED) return <IntelligenceWorkspace chooser={<ModelChoiceChooser />} /> // MODEL-CHOICE: the live catalogue chooser in the Pass 2 chooser\'s place (it acts only with NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE on)\n',
  },
]
/** The page with the held hook put in (for the proof, and for whoever lands it). Each anchor must be there exactly once; a page that already has the hook is returned as it is. */
export function applyModelChoiceHook(text) {
  if (typeof text !== 'string' || MODEL_CHOICE_MARKER_RE.test(text)) return text
  let out = text
  for (const step of MODEL_CHOICE_PAGE_HOOK) {
    const anchor = step.after ?? step.before
    if (out.split(anchor).length !== 2) throw new Error(`model choice hook: anchor not found once: ${anchor.trim()}`)
    out = out.replace(anchor, () => (step.after ? anchor + step.line : step.line + anchor))
  }
  return out
}

/** The fixtures this change's proof reads: the catalogue (the recorded shape, with imagery and narration certified) and the router's answers to Studio's routes (shaped as the router's own code answers:
 *  read_api.py prefs GET / PATCH / 412, timeline_api.py items; no keys, no prices). */
export const MODEL_CHOICE_FIXTURE_DIR = 'scripts/fixtures/studio-model-choice'
export const MODEL_CHOICE_FIXTURE = `${MODEL_CHOICE_FIXTURE_DIR}/catalogue-live-shape.json`
export const MODEL_CHOICE_ROUTER_FIXTURES = ['router-prefs-user-200.json', 'router-prefs-session-200.json', 'router-prefs-412.json', 'router-not-found-404.json', 'router-timeline-200.json'].map(name => `${MODEL_CHOICE_FIXTURE_DIR}/${name}`)

/** The three new Studio server routes (the route set grows by exactly these three). */
export const MODEL_CHOICE_ROUTES = [
  'app/api/model-choice/prefs/route.ts',
  'app/api/model-choice/prefs/deck/[deckKey]/route.ts',
  'app/api/model-choice/used/[buildId]/route.ts',
]

/** The compact picker for the chat composer (same flag; FRONTEND-1 places it, nothing here mounts it): new files only. Its proof is scripts/test-studio-model-picker.mjs. */
export const MODEL_PICKER_NEW_FILES = [
  'lib/studio-model-picker.ts',
  'components/model-choice/use-model-choice.ts',
  'components/model-choice/model-picker.tsx',
  'components/model-choice/model-picker.css',
  'scripts/studio-model-picker-kit.mjs',
  'scripts/render-model-picker-fixture.mjs',
  'scripts/test-studio-model-picker.mjs',
]

/** New files (no base text to put back). */
export const MODEL_CHOICE_NEW_FILES = [
  'lib/studio-model-choice.ts',
  'lib/studio-model-choice-server.ts',
  ...MODEL_CHOICE_ROUTES,
  'components/studio-personal/intelligence-model-choice.tsx',
  'components/studio-personal/intelligence-model-choice.css',
  'scripts/studio-model-choice-strip.mjs',
  'scripts/test-studio-model-choice.mjs',
  MODEL_CHOICE_FIXTURE,
  ...MODEL_CHOICE_ROUTER_FIXTURES,
  ...MODEL_PICKER_NEW_FILES,
]

/** The older proofs this change teaches (FRONTEND-2's own): the legal short links proof's route-set check counts the routes a later registered change ADDS, as it already counts the ones one removes;
 *  the speed perceived proof's scope check reads its own newest commit (subject "Speed perceived:"), not HEAD, so a change stacked after it is not read as its diff (the form #520 teaches it too): [text the proof has now, text the
 *  proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries MODEL_CHOICE_PIN_MARK. */
export const MODEL_CHOICE_PIN_MARK = '// LATER-CHANGES: registry read (MODEL-CHOICE)'
export const MODEL_CHOICE_PIN_EDITS = {
  "scripts/test-studio-legal-short-links.mjs": [
    [
      "  const laterAdded = routesOf([...LATER_CHANGE_FILES].filter(rel => !LEGAL_SHORT_LINKS_SCOPE_FILES.has(rel) && headFiles.has(rel))).filter(route => !before.includes(route) && after.includes(route)) // LATER-CHANGES: registry read (MODEL-CHOICE): a change registered after this one may add route files of its own (model choice: three server routes)\n",
      ""
    ],
    [
      "  deep(after.filter(route => !before.includes(route) && !laterAdded.includes(route)), ['/privacy', '/terms'], a('the flags-off build\\'s route list gains exactly /privacy and /terms (+2)')) // LATER-CHANGES: registry read (MODEL-CHOICE)\n",
      "  deep(after.filter(route => !before.includes(route)), ['/privacy', '/terms'], a('the flags-off build\\'s route list gains exactly /privacy and /terms (+2)'))\n"
    ],
    [
      "  eq(after.length, before.length + 2 - laterRemoved.length + laterAdded.length, a(`${before.length} routes become ${before.length + 2 - laterRemoved.length + laterAdded.length}`)) // LATER-CHANGES: registry read (MODEL-CHOICE)\n",
      "  eq(after.length, before.length + 2 - laterRemoved.length, a(`${before.length} routes become ${before.length + 2 - laterRemoved.length}`))\n"
    ]
  ],
  "scripts/test-studio-speed-perceived.mjs": [
    [
      "const HEAD = git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^(Speed perceived|Studio perceived speed):', 'HEAD').trim() || git('rev-parse', 'HEAD').trim() // LATER-CHANGES: registry read (MODEL-CHOICE): this change's own newest commit, so a change stacked after it is not read as this one's diff\n",
      "const HEAD = git('rev-parse', 'HEAD').trim()\n"
    ]
  ]
}
export const MODEL_CHOICE_PIN_FILES = Object.keys(MODEL_CHOICE_PIN_EDITS)
/** The proof without this change's edits (the previous file). */
export function putBackPin(rel, text) {
  return (MODEL_CHOICE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** Files this change edits that are neither app code nor new: its .env.example block and the registry (three lines). */
export const MODEL_CHOICE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...MODEL_CHOICE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const MODEL_CHOICE_SCOPE_FILES = new Set([...MODEL_CHOICE_FILES, ...MODEL_CHOICE_NEW_FILES, ...MODEL_CHOICE_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const MODEL_CHOICE_ENV_BLOCK = `# P3-10 MODEL CHOICE (FRONTEND-2): the Intelligence page's model chooser offers, per text task, the models and presets the live model catalogue opens for it (Fast / Balanced / Best with a cost
# hint), for "Reusable defaults" or "This presentation" (the Builder session). On for the exact value "true"; default off, and then the page is exactly as before and the three new server routes
# (/api/model-choice/prefs, /api/model-choice/prefs/deck/{session id}, /api/model-choice/used/{build id}) answer 404. Build-time value: change it on Vercel and redeploy. The chooser acts only while the Pass 2
# Intelligence flag is "true" too, and reads the catalogue only while the Models section's catalogue flag is on. The routes save choices in the Model Router at the router address the narration block
# above sets, with MODEL_ROUTER_FRONTEND_KEY: server-only, a router key labelled "frontend" with the prefs and read scopes, minted by the router's owner, never sent to the browser or logged.
# While either is empty the routes answer 503 and choices stay in this browser, and the page says so. The page mounts the chooser once its two-line page hook lands (held for PK's OK on three pins).
NEXT_PUBLIC_STUDIO_MODEL_CHOICE="false"
MODEL_ROUTER_FRONTEND_KEY=
`

/** The file without this change's lines: in the page (once the hook lands) and the files above, every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file
 * is returned as it is. */
export function stripModelChoice(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in MODEL_CHOICE_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (rel !== MODEL_CHOICE_HOOK_FILE && !MODEL_CHOICE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !MODEL_CHOICE_MARKER_RE.test(line)).join('\n')
}
