// FRONTEND-1 (program1/studio-flip-enablers, "Flip enablers: dual lookup"). Server flag STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED (the branch's flag; the string "true", default off, read per call).
// With it on, an e-mail-only session is sent to Director as its DB id; Director rows written before the switch are keyed by the e-mail. Every Director READ of user-owned records
// (templates list / one, themes list / one / standard, ingest job, a chat session's library) asks with the DB id first and, only when that finds nothing, once more with the signed-in
// user's OWN e-mail from the server session, signed for that e-mail. Writes keep the DB id. All logic is lib/studio-director-email-fallback.ts (new).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker DUAL-LOOKUP (a whole token): one import and two lines after the Director fetch in each of the
// seven route files. No existing line is rewritten. Strip the marked lines and each file is its base, byte for byte.
// One older proof is taught to read through the registry (DUAL_LOOKUP_EDITS): test-studio-deck-import's "the minter is imported by the two import routes only" skips registered later-change files
// (the flip enablers' server-only Director signers import the minter too); the strip puts its old line back.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, nothing read from disk or git here.

export const BASE_COMMIT = '359ec0195217c2ca82b3e3cf484468cef5e2a202' // program1/studio-flip-enablers head at the start of this change (already holds origin/studio-v4-dev-preparation-code 3e1ce88e)
export const DUAL_LOOKUP_FLAG = 'STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED'
export const DUAL_LOOKUP_MARKER = 'DUAL-LOOKUP'
/** The marker as a WHOLE token. */
export const DUAL_LOOKUP_MARKER_RE = /(?<![\w-])DUAL-LOOKUP(?![\w-])/

/** Existing files that get marked lines: [file, miss rule]. */
export const DUAL_LOOKUP_ROUTES = {
  'app/api/templates/route.ts': "missOnEmpty('templates')",
  'app/api/templates/[id]/route.ts': 'missOnNotFound',
  'app/api/themes/route.ts': "missOnEmpty('themes')",
  'app/api/themes/[id]/route.ts': 'missOnNotFound',
  'app/api/themes/standard/route.ts': "missOnEmpty('theme')",
  'app/api/ingest-jobs/[jobId]/route.ts': 'missOnNotFound',
  'app/api/director/sessions/[sourceSessionId]/library/route.ts': 'missOnForbiddenOrNotFound',
}
export const DUAL_LOOKUP_FILES = Object.keys(DUAL_LOOKUP_ROUTES)

/** The older proof this change teaches: [line now, line before], whole lines (the line now carries DUAL-LOOKUP; the line before is the base's). */
export const DUAL_LOOKUP_EDITS = {
  "scripts/test-studio-rail-add-slide.mjs": [
    ["const withoutFirstPaint = lines => lines.filter(line => !(line.startsWith('+') && ((rel) => { const raw = fs.readFileSync(path.join(repoRoot, rel), 'utf8').split('\\n'), kept = new Set(stripLaterChanges(rel, raw.join('\\n')).split('\\n')); return new Set(raw.filter(l => !kept.has(l))) })(VIEWER).has(line.slice(1))) && !belongsToFirstPaint(line) && !line.includes('PASS3-POLISH-B') && !line.includes('CHAT-STALE-VIEWER-GUARD')) // LATER-CHANGES: registry read (PASS3-POLISH-B) // LATER-CHANGES: registry read (CHAT-STALE-VIEWER-GUARD): the stale viewer guard stacked after this change marks its own viewer lines // LATER-CHANGES: registry read (DUAL-LOOKUP): a viewer line a registered later change's strip takes out of the whole file (the flip enablers' viewer ticket) is its own; laterStripRemoves = the lines the registry's strips remove\n", "const withoutFirstPaint = lines => lines.filter(line => !belongsToFirstPaint(line) && !line.includes('PASS3-POLISH-B') && !line.includes('CHAT-STALE-VIEWER-GUARD')) // LATER-CHANGES: registry read (PASS3-POLISH-B) // LATER-CHANGES: registry read (CHAT-STALE-VIEWER-GUARD): the stale viewer guard stacked after this change marks its own viewer lines\n"],
  ],
  "scripts/test-studio-chat-element-edit.mjs": [
    ["  const added = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n').filter(l => l.startsWith('+') && !l.startsWith('+++') && stripPeers(rel, `${l.slice(1)}\\n`) !== '').filter(((raw, kept) => l => !(raw.includes(l.slice(1)) && !kept.includes(l.slice(1))))(read(rel).split('\\n'), stripPeers(rel, read(rel)).split('\\n'))) // a line another registered change marks (Arrange's) is its own // LATER-CHANGES: registry read (DUAL-LOOKUP): a line a registered later change's strip takes out of the whole file (the flip enablers' viewer ticket) is its own\n", "  const added = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n').filter(l => l.startsWith('+') && !l.startsWith('+++') && stripPeers(rel, `${l.slice(1)}\\n`) !== '') // a line another registered change marks (Arrange's) is its own\n"],
  ],
  'scripts/test-studio-deck-import.mjs': [
    ["import { stripLaterChanges, LATER_CHANGE_FILES } from './studio-later-changes.mjs' // stacked: the later-changes registry (a change stacked after this one registers its files, its .env.example block and its strip there; every read of an app file goes through it first) // LATER-CHANGES: registry read (DUAL-LOOKUP): the registered later-change files\n", "import { stripLaterChanges } from './studio-later-changes.mjs' // stacked: the later-changes registry (a change stacked after this one registers its files, its .env.example block and its strip there; every read of an app file goes through it first)\n"],
    ["  deepEq([...text.keys()].filter(rel => rel !== HELPER && /director-rest-entitlement/.test(text.get(rel))).filter(rel => !(LATER_CHANGE_FILES.has(rel))).sort(), [JOBS, START].sort(), 'the minter is imported by the two import routes only') // LATER-CHANGES: registry read (DUAL-LOOKUP): a registered later change's server-only Director signers are its own\n", "  deepEq([...text.keys()].filter(rel => rel !== HELPER && /director-rest-entitlement/.test(text.get(rel))).sort(), [JOBS, START].sort(), 'the minter is imported by the two import routes only')\n"],
  ],
}
export const DUAL_LOOKUP_PIN_FILES = Object.keys(DUAL_LOOKUP_EDITS)

/** New files (no base text to put back). */
export const DUAL_LOOKUP_NEW_FILES = ['lib/studio-director-email-fallback.ts', 'scripts/studio-dual-lookup-strip.mjs', 'scripts/test-studio-dual-lookup.mjs']

/** Files this change edits that are neither marked app code nor new. Run the proof with `node scripts/test-studio-dual-lookup.mjs`. */
export const DUAL_LOOKUP_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...DUAL_LOOKUP_PIN_FILES]

/** Every file this change's commit touches. */
export const DUAL_LOOKUP_SCOPE_FILES = new Set([...DUAL_LOOKUP_FILES, ...DUAL_LOOKUP_NEW_FILES, ...DUAL_LOOKUP_OWN_EDITS])

/** The whole .env.example block (comments only: the flag is the branch's own). */
export const DUAL_LOOKUP_ENV_BLOCK = `# STUDIO DIRECTOR DUAL LOOKUP (FRONTEND-1; flip enablers). No flag of its own: it rides STUDIO_DIRECTOR_REST_SIGN_ALL_ENABLED (server, "true" only, default off; off = nothing read, nothing re-asked).
# On: reads of Director user-owned records (templates, themes, the standard theme, ingest jobs, a chat session's library) ask with the DB id first and, only when that finds nothing, once more with the
# signed-in user's own e-mail (server session, never the request), signed for that e-mail, so records saved under the e-mail before the switch still load. Writes always use the DB id.
`

/** The file without this change's lines: every line that carries the marker is taken out. Any other file is returned as it is. */
export function stripDualLookup(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in DUAL_LOOKUP_EDITS) return DUAL_LOOKUP_EDITS[rel].reduce((out, [has, was]) => out.replace(has, () => was), text) // a taught proof: its previous text
  if (!DUAL_LOOKUP_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !DUAL_LOOKUP_MARKER_RE.test(line)).join('\n')
}
