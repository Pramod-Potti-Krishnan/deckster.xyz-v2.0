// FRONTEND-1 (UX-02, a blocker of the Studio UX pass). Flag NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE (exact "true", build-time, default off; only together with NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE and NEXT_PUBLIC_STUDIO_MODEL_CHOICE):
// the Intelligence page's main control is ONE preset slider (Fast / Balanced / Best / Max) for the account default, the composer's simple picker's own logic (lib/studio-model-picker-simple.ts, the same hook and save queue), the title the
// preset's name, under it the model the router resolves per text step (read-only, from the catalogue), the picker's reset; the per-task dropdowns move, unchanged, under a collapsed "Advanced". A stop saves the PRESET only.
// Every line this change adds to an EXISTING app file is a pure insertion that carries the marker INTELLIGENCE-SIMPLE (a whole token): app/(app)/studio/intelligence/page.tsx (two imports and one early return). Strip them and the page is its base, byte for byte.
// Three older proofs read that page raw (not through scripts/studio-later-changes.mjs); each is taught ONE line (its read also takes this change's marked lines out, innermost), registry-read marks, tests only.
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'cc161f7ee36c006d1276e3d38587010be921044a' // restacked 6 Nov onto frontend1/model-picker-simple cc161f7e (#565 on dev 1bb42d7f); was 9ef18900: frontend1/model-picker-simple (F-14), the branch this change is stacked on
export const INTELLIGENCE_SIMPLE_FLAG = 'NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE'
export const INTELLIGENCE_SIMPLE_MARKER = 'INTELLIGENCE-SIMPLE'
/** The marker as a WHOLE token. */
export const INTELLIGENCE_SIMPLE_MARKER_RE = /(?<![\w-])INTELLIGENCE-SIMPLE(?![\w-])/
export const INTELLIGENCE_SIMPLE_SUBJECT = 'Model picker: Intelligence page'

/** Existing files that get marked lines. */
export const INTELLIGENCE_SIMPLE_FILES = ['app/(app)/studio/intelligence/page.tsx']

/** New files. */
export const INTELLIGENCE_SIMPLE_NEW_FILES = [
  'lib/studio-intelligence-simple.ts',
  'components/studio-personal/intelligence-simple.tsx',
  'components/studio-personal/intelligence-simple.css',
  'scripts/studio-intelligence-simple-strip.mjs',
  'scripts/test-studio-intelligence-simple.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text it had before], whole lines. */
export const INTELLIGENCE_SIMPLE_PIN_MARK = 'LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE)'
const TAUGHT = "const { stripIntelligenceSimple } = await import('./studio-intelligence-simple-strip.mjs') // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE): the Intelligence page's two marked imports and one marked return (a later change, stacked) are taken out of what this proof reads\n"
export const INTELLIGENCE_SIMPLE_PIN_EDITS = {
  'scripts/test-studio-model-catalog.mjs': [
    [TAUGHT + "const read = rel => stripLaunchWording(rel, stripIntelligenceSimple(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'))) // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE)\n", "const read = rel => stripLaunchWording(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'))\n"],
    ["    const text = rel in sources ? sources[rel] : stripIntelligenceSimple(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')) // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE)\n", "    const text = rel in sources ? sources[rel] : fs.readFileSync(path.join(ROOT, rel), 'utf8')\n"],
  ],
  'scripts/test-studio-p2-polish.mjs': [
    [TAUGHT + "const read = rel => stripLaunchWording(rel, stripIntelligenceSimple(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE)\n", "const read = rel => stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))\n"],
  ],
  'scripts/test-studio-p2-intelligence.mjs': [
    [TAUGHT + "const read = rel => stripP2Polish(rel, stripLaunchWording(rel, stripIntelligenceSimple(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE)\n", "const read = rel => stripP2Polish(rel, stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))\n"],
  ],
  'scripts/test-studio-model-choice.mjs': [
    [TAUGHT + "const read = rel => (rel in overrides ? overrides[rel] : stripIntelligenceSimple(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE)\n", "const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))\n"],
  ],
  'scripts/test-studio-model-picker-simple.mjs': [
    ["  const env = disk(ENV).replace('\\n' + registry.LATER_ENV_BLOCKS.find(block => block.includes('NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE=')), ''), was = baseText(ENV) // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE)\n", "  const env = disk(ENV), was = baseText(ENV)\n"],
    ["  eq(reg.split('\\n').filter(line => !line.includes('studio-model-picker-simple-strip.mjs') && !line.includes('studio-intelligence-simple-strip.mjs')).join('\\n'), baseText(REGISTRY), 'the registry is the base plus those three lines') // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE)\n", "  eq(reg.split('\\n').filter(line => !line.includes('studio-model-picker-simple-strip.mjs')).join('\\n'), baseText(REGISTRY), 'the registry is the base plus those three lines')\n"],
    ["  const hits = git('grep', '-l', '-E', 'model-picker-simple|studio-model-picker-simple', '--', 'app', 'components', 'lib', 'hooks').split('\\n').filter(Boolean); assert.ok(hits.includes(PICKER) && hits.includes(COMPONENT), 'the picker and its component'); eq(hits.filter(rel => ![PICKER, COMPONENT, LIB, CSS].includes(rel) && !/intelligence-simple/.test(rel)), [], 'no other file names the new modules') // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE): the Intelligence page's simple picker (a later change, stacked) reuses them\n", "  const hits = git('grep', '-l', '-E', 'model-picker-simple|studio-model-picker-simple', '--', 'app', 'components', 'lib', 'hooks').split('\\n').filter(Boolean); assert.ok(hits.includes(PICKER) && hits.includes(COMPONENT), 'the picker and its component'); eq(hits.filter(rel => ![PICKER, COMPONENT, LIB, CSS].includes(rel)), [], 'no other file names the new modules')\n"],
    ["  const own = ownOf(scopeHead()); const firstParentOnly = git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..HEAD`).split('\\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT) && !subjectOf(c).startsWith('Model picker: Intelligence page')) // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE)\n", "  const own = ownOf(scopeHead()); const firstParentOnly = git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..HEAD`).split('\\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT))\n"],
    ["const ownOf = head => git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT) && !subjectOf(c).startsWith('Model picker: Intelligence page')) // LATER-CHANGES: registry read (INTELLIGENCE-SIMPLE): a stacked change that shares the subject prefix is not this change's\n", "const ownOf = head => git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT))\n"],
  ],
}
export const INTELLIGENCE_SIMPLE_PIN_FILES = Object.keys(INTELLIGENCE_SIMPLE_PIN_EDITS)

/** Files this change edits that are neither marked app code nor new. */
export const INTELLIGENCE_SIMPLE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...INTELLIGENCE_SIMPLE_PIN_FILES]
export const INTELLIGENCE_SIMPLE_SCOPE_FILES = new Set([...INTELLIGENCE_SIMPLE_FILES, ...INTELLIGENCE_SIMPLE_NEW_FILES, ...INTELLIGENCE_SIMPLE_OWN_EDITS])

export const INTELLIGENCE_SIMPLE_ENV_BLOCK = `# STUDIO INTELLIGENCE SIMPLE (FRONTEND-1; UX-02). On for the exact value "true" AND only together with NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE and NEXT_PUBLIC_STUDIO_MODEL_CHOICE; default off, and then the Intelligence page is exactly as before. Build-time value: change it on Vercel and redeploy.
# On, the Intelligence page's main control is one preset slider (Fast / Balanced / Best / Max) for the account default, the composer's simple picker's logic: the preset's name as the title, under it the model the router resolves for each text step (read-only, from the catalogue), the picker's reset icon. The per-task dropdowns move, unchanged, under a collapsed "Advanced". A stop saves the preset only.
NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE="false"
`

/** The proof without this change's taught lines (its previous text). */
export function putBackPin(rel, text) {
  return (INTELLIGENCE_SIMPLE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's lines: marked lines out of the page, the taught proofs back to their previous text; any other file as it is. */
export function stripIntelligenceSimple(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in INTELLIGENCE_SIMPLE_PIN_EDITS) return putBackPin(rel, text)
  if (!INTELLIGENCE_SIMPLE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !INTELLIGENCE_SIMPLE_MARKER_RE.test(line)).join('\n')
}
