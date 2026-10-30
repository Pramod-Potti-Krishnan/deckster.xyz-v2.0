// FRONTEND-2 (B52, 30 Oct): the stage open gate. PK UAT feedback F-03, flag NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE (exact "true", default off; with NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 on, as on dev).
// The chat stays full-width through Director's clarifying questions; the deck stage opens only on the strawman or build streaming, a ready deck, or an explicit ask, then stays open for the session.
//
// Proves, offline (plain node: TypeScript transpile + vm; no socket, fetch, timer or server):
//   1. the REAL lib (lib/studio-stage-open-gate.ts): the flag is the exact "true"; the phrase list (whole phrases, normalised); the triggers; the latch, per session; arming only in a fresh session;
//   2. the REAL page wiring, read raw (app/builder/page.tsx, the later changes' lines out first): the gate step beside studioFirstRunStage, the attribute beside data-studio-first-run-stage, one import; nothing else;
//   3. a behavioural harness: the page's own statements (the canvas lifecycle call, studioWelcome, studioFirstRunStage, the gate step, studioFirstRunRestoring, the stage element's attributes), cut out of the page
//      with the TypeScript parser and evaluated in a vm with the REAL libs, driven by REAL recorded Director frames (never hand-made ones). MAIN: DIRECTOR-2's recording of a new session for F-03
//      (scripts/fixtures/studio-stage-open-gate/director2-pk-f03/, from workspace b88aca96 streams/director2/pk-f03-new-session; real Director code at uat 749df53e, scripted model, $0): scenario A (connect ->
//      greeting -> brief -> clarifying card -> answer -> plan card -> accept -> outline streaming -> outline gate -> Approve & build -> build -> deck ready), its "Approve & build" label twin, and B1 / B2
//      ("show me the deck" typed during the questions; Director answers respond / generate_strawman). EXTRA: DIRECTOR-2's preview-b b-questions-mdc1 and scripts/fixtures/build-resume/j7-stop-resume.json (planning ->
//      strawman -> build -> partial deck URL; the reload's send_history). Frames are replayed as recorded; the scenarios that need "no strawman" or "deck ready only" replay a SUBSET of recorded frames, unchanged.
//      The frame -> page-state step (what the socket hook and the narration hook would set) is the harness's model; the narration phase comes from the REAL narrationReducer;
//   4. the REAL stylesheet (components/builder/studio-first-run.css) matched with a small selector engine against the stage/chat markup the harness produced: closed -> full-width chat and the stage hidden;
//      open -> today's split; flag off -> byte-identical to the base page (attributes and layout hashed per step, against the page with this change's lines stripped);
//   5. scope over the COMMITTED diff, gate-safe (own commits by subject across `rev-list --no-merges BASE..HEAD`, HEAD^2 on the gate's merge, registry / .env / strip reads past later changes; a gate-style
//      merge and a synthetic later branch; no `hash-object --stdin`);
//   6. mutants: broken copies of the lib, the page lines and the stylesheet must each be caught.
//
//   node scripts/test-studio-stage-open-gate.mjs
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'
import * as registry from './studio-later-changes.mjs'
import {
  BASE_COMMIT, STAGE_OPEN_GATE_FLAG, STAGE_OPEN_GATE_MARKER_RE, STAGE_OPEN_GATE_SUBJECT, STAGE_OPEN_GATE_FILES, STAGE_OPEN_GATE_NEW_FILES, STAGE_OPEN_GATE_SCOPE_FILES,
  STAGE_OPEN_GATE_ENV_BLOCK, stripStageOpenGate,
} from './studio-stage-open-gate-strip.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const [LIB, PAGE, CSS] = ['lib/studio-stage-open-gate.ts', 'app/builder/page.tsx', 'components/builder/studio-first-run.css']
const FIRST_RUN_V2 = 'NEXT_PUBLIC_STUDIO_FIRST_RUN_V2'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'

/** The strips of every change registered AFTER this one, applied first: a file is read as this change left it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripStageOpenGate); return (at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1)).reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text) }
const laterRead = rel => laterStrips(rel, read(rel))
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
/** Every OTHER registered change's strip, in the registry's order (this change's is left out). */
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripStageOpenGate), rel, text)

let passed = 0
const failed = []
function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch { caught++; console.log(`CAUGHT mutant ${label}`) }
}
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }

// ===== the REAL libs in a vm ===================================================================================================================================================
const refuse = name => () => { throw new Error(`the stage gate proof refuses ${name}`) }
function makeLibs({ env = {}, overrides = {} } = {}) {
  const cache = new Map()
  const load = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const text = overrides[rel] ?? laterRead(rel)
    const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const req = spec => {
      if (spec.startsWith('@/')) return load(spec.slice(2) + '.ts')
      if (spec.startsWith('../types/')) return {}
      throw new Error(`unexpected import ${spec} in ${rel}`)
    }
    vm.runInNewContext(js, { module, exports: module.exports, require: req, process: { env: { ...env } }, console, fetch: refuse('fetch'), setTimeout: refuse('setTimeout'), Date })
    return module.exports
  }
  return {
    gate: load(LIB),
    lifecycle: load('lib/studio-canvas-lifecycle.ts'),
    restoring: load('lib/studio-first-run-restoring.ts'),
    narration: load('lib/build-narration-heuristics.ts'),
    greeting: load('lib/studio-greeting-lifecycle.ts'),
  }
}
const ON_ENV = { [STAGE_OPEN_GATE_FLAG]: 'true', [FIRST_RUN_V2]: 'true', [SHELL]: 'true' }
const OFF_ENV = { [FIRST_RUN_V2]: 'true', [SHELL]: 'true' }
const ON = makeLibs({ env: ON_ENV })
const OFF = makeLibs({ env: OFF_ENV })

// ===== 1. the lib ==============================================================================================================================================================
console.log('1. the lib')
const LIB_SRC = read(LIB)
const PHRASES = ['show me the deck', 'show the deck', 'open the deck', 'show me the slides', 'show the slides', 'open the slides', 'add slides', 'add a slide', 'show me the canvas', 'open the canvas']
const NEAR_MISSES = ['deck', 'the deck', 'show me the plan', 'show me the outline', 'show me', 'Build me a deck about Q4 sales', 'add', 'slides', 'open the decks', 'showme the deck', 'add slide', 'show me the deckhand',
  'reshow the deck', 'Executives', '20 minutes', 'Who is the audience?']
const STARTER_PROMPTS = [...read('components/builder/chat/studio-welcome.tsx').matchAll(/prompt: "([^"]+)"/g)].map(m => m[1])
const baseInput = (over = {}) => ({ enabled: true, sessionKey: 's1', landing: true, workflow: false, fullscreen: false, inspector: false, historyLoading: false, resumed: false,
  userMessages: [], generatingStrawman: false, generatingFinal: false, phase: 'idle', hasGeneratedDeck: false, hasOwnedFinal: false, hasAuthoredDeck: false, blankChosen: false, addSlideOpen: false, ...over })
function libChecks(g, { flagged = true } = {}) {
  assert.equal(g.STUDIO_STAGE_OPEN_GATE_ENABLED, flagged, 'the flag constant')
  assert.deepEqual([...g.STUDIO_STAGE_OPEN_PHRASES], PHRASES, 'the phrase list (one per line in the lib, editable by PK)')
  for (const phrase of PHRASES) {
    assert.equal(g.normaliseStageAsk(phrase), phrase, `${phrase}: already normal`)
    for (const said of [phrase, phrase.toUpperCase(), `  ${phrase.replace(/ /g, '   ')}  `, `${phrase}!`, `Please ${phrase}?`, `ok, ${phrase.replace(/^(\w+)/, '$1,')}.`.replace(/,(?=\s)/, ''), `Can you ${phrase} now`])
      assert.equal(g.matchStageAsk(said), phrase, `"${said}" asks with "${phrase}"`)
  }
  assert.equal(g.matchStageAsk('Show me the deck, please.'), 'show me the deck')
  assert.equal(g.matchStageAsk('Let’s add a slide'), 'add a slide', 'a curly apostrophe elsewhere does not matter')
  assert.equal(g.matchStageAsk('OPEN   the\nDECK'), 'open the deck', 'whitespace and case normalised')
  for (const said of NEAR_MISSES) assert.equal(g.matchStageAsk(said), null, `near miss "${said}" does not ask`)
  assert.ok(STARTER_PROMPTS.length >= 3, 'the starters were read')
  for (const prompt of STARTER_PROMPTS) assert.equal(g.matchStageAsk(prompt), null, `no starter implies the canvas: ${prompt.slice(0, 40)}`)
  for (const bad of [undefined, null, 42, {}, '']) assert.equal(g.matchStageAsk(bad), null)
  // the triggers, in order
  const T = over => g.studioStageTrigger(baseInput(over))
  assert.equal(T({}), null, 'nothing yet')
  assert.equal(T({ phase: 'planning' }), null, 'planning (Designing your deck plan) is not a trigger: still the conversation')
  assert.equal(T({ phase: 'strawman' }), 'strawman'); assert.equal(T({ generatingStrawman: true }), 'strawman')
  for (const phase of ['building', 'qa', 'finalizing', 'complete', 'paused', 'stopped', 'error']) assert.equal(T({ phase }), 'build', phase)
  assert.equal(T({ phase: 'awaiting_user' }), null, 'awaiting_user is the plan card (from planning) or the outline gate (after the strawman, which already opened it): not a trigger by itself')
  assert.equal(T({ hasOwnedFinal: true }), 'deck', 'the final deck\'s URL, before the viewer selects it')
  assert.equal(T({ generatingFinal: true }), 'build')
  assert.equal(T({ hasGeneratedDeck: true, phase: 'strawman' }), 'deck', 'deck first')
  assert.equal(T({ hasAuthoredDeck: true }), 'authored'); assert.equal(T({ blankChosen: true }), 'blank'); assert.equal(T({ addSlideOpen: true }), 'add_slide')
  assert.equal(T({ userMessages: [{ text: 'Build me a deck about Q4 sales' }, { text: 'show me the deck' }] }), 'typed')
  assert.equal(T({ userMessages: [{ text: 'Build me a deck about Q4 sales' }] }), null)
  assert.equal(T({ workflow: true, fullscreen: true, inspector: true }), null, 'a workflow link, fullscreen and an inspector are not latching triggers')
  // the step: arming, closing, latching, keys
  const S = g.stepStudioStageGate
  let r = S(null, baseInput({ enabled: false }))
  assert.deepEqual([r.closed, r.reason], [false, 'off'], 'flag off: never closed')
  r = S(null, baseInput())
  assert.deepEqual([r.closed, r.reason, r.state.armed], [true, 'closed', true], 'a fresh session (welcome up) arms and closes')
  const armed = r.state
  assert.equal(S(armed, baseInput()).state, armed, 'nothing moved: the same state object')
  r = S(armed, baseInput({ userMessages: [{ text: 'Build me a deck about Q4 sales' }] }))
  assert.deepEqual([r.closed, r.reason], [true, 'closed'], 'after the first message: still closed (the clarifying turns)')
  r = S(r.state, baseInput({ userMessages: [{ text: 'x' }], phase: 'awaiting_user', landing: false }))
  assert.deepEqual([r.closed, r.reason], [true, 'closed'], 'the plan card (awaiting_user from planning) ends today\'s landing, yet the gate stays closed')
  r = S(r.state, baseInput({ userMessages: [{ text: 'x' }], phase: 'strawman', landing: false }))
  assert.deepEqual([r.closed, r.reason], [false, 'strawman'], 'the strawman opens it')
  r = S(r.state, baseInput({ userMessages: [{ text: 'x' }], phase: 'idle' }))
  assert.deepEqual([r.closed, r.reason], [false, 'strawman'], 'LATCH: back to an idle landing, it stays open (never closes by itself)')
  r = S(r.state, baseInput({ sessionKey: 's2' }))
  assert.deepEqual([r.closed, r.reason, r.state.key], [true, 'closed', 's2'], 'NEW CHAT (a new id): starts closed again')
  // not fresh: loading, resumed, a transcript with user turns
  for (const [over, why] of [[{ historyLoading: true }, 'loading'], [{ resumed: true }, 'resumed'], [{ userMessages: [{ text: 'old' }] }, 'user turns at first sight'], [{ landing: false }, 'not landing']]) {
    const x = S(null, baseInput(over))
    assert.equal(x.closed, false, why); assert.equal(x.state.armed, false, why)
  }
  // a restored session never closes, even after its load finishes with no deck yet
  let rs = S(null, baseInput({ historyLoading: true }))
  rs = S(rs.state, baseInput({ resumed: true, userMessages: [{ text: 'old brief' }] }))
  rs = S(rs.state, baseInput({ resumed: false, userMessages: [{ text: 'old brief' }, { text: 'new' }] }))
  assert.deepEqual([rs.closed, rs.reason], [false, 'not_fresh'], 'restored: never armed, so never closed')
  // resumed after arming disarms
  rs = S(S(null, baseInput()).state, baseInput({ resumed: true, userMessages: [{ text: 'restored' }] }))
  assert.equal(rs.closed, false, 'resumed disarms')
  // adoption: a session without an id adopts one (the first send), the state carries
  let ad = S(null, baseInput({ sessionKey: null }))
  assert.equal(ad.closed, true)
  ad = S(ad.state, baseInput({ sessionKey: 'adopted', userMessages: [{ text: 'brief' }] }))
  assert.deepEqual([ad.closed, ad.state.key], [true, 'adopted'], 'adoption keeps the session closed')
  // overrides: open while they last, not latched
  for (const [over, why] of [[{ workflow: true }, 'workflow'], [{ fullscreen: true }, 'fullscreen'], [{ inspector: true }, 'inspector']]) {
    const x = S(armed, baseInput({ ...over, userMessages: [{ text: 'b' }] }))
    assert.deepEqual([x.closed, x.reason, x.state.latched], [false, why, null], why)
    assert.equal(S(x.state, baseInput({ userMessages: [{ text: 'b' }] })).closed, true, `${why} gone: closed again (as today, it does not latch)`)
  }
  // Add Slide latches
  const as = S(armed, baseInput({ addSlideOpen: true, inspector: true }))
  assert.deepEqual([as.closed, as.reason], [false, 'add_slide'])
  assert.equal(S(as.state, baseInput()).closed, false, 'Add Slide latched: closing its panel leaves the stage open')
  // props
  assert.deepEqual(plain(g.studioStageGateProps(false, true)), {}, 'open: no attribute at all')
  assert.deepEqual(plain(g.studioStageGateProps(true, false)), { 'data-studio-stage-gate': 'closed' })
  assert.deepEqual(plain(g.studioStageGateProps(true, true)), { 'data-studio-stage-gate': 'closed', 'data-studio-stage-gate-width': '560' })
  assert.deepEqual(plain(g.studioStageGateProps('true', true)), {}, 'only the boolean true')
}
function flagMatrix(overrides = {}) {
  for (const value of ['false', '1', 'TRUE', ' true', 'yes', undefined]) assert.equal(makeLibs({ env: { ...OFF_ENV, [STAGE_OPEN_GATE_FLAG]: value }, overrides }).gate.STUDIO_STAGE_OPEN_GATE_ENABLED, false, `flag ${value}: off`)
  assert.equal(makeLibs({ env: ON_ENV, overrides }).gate.STUDIO_STAGE_OPEN_GATE_ENABLED, true, 'flag "true": on')
}
check('the lib: the flag is the exact "true"; the phrase list; whole-phrase normalised matching; near misses and today\'s three starters do not ask; triggers in order; arming only fresh; latch per session; New Chat starts closed; overrides do not latch, Add Slide does', () => {
  libChecks(ON.gate)
  flagMatrix()
  assert.match(LIB_SRC, /export const STUDIO_STAGE_OPEN_GATE_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE === 'true'\n/)
  assert.equal((LIB_SRC.match(/process\.env\./g) || []).length, 2, 'two build-time reads: this flag and the welcome width it follows')
  assert.doesNotMatch(LIB_SRC.replace(/\/\/.*$/gm, ''), /\b(fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|setTimeout|setInterval|Date\.now|window|document)\b/, 'pure: no request, storage, timer or DOM')
  assert.doesNotMatch(LIB_SRC, /^import /m, 'no imports')
  const block = /STUDIO_STAGE_OPEN_PHRASES: readonly string\[\] = \[\n([\s\S]*?)\n\]/.exec(LIB_SRC)?.[1] ?? ''
  assert.deepEqual(block.split('\n').map(line => /^  '([a-z ]+)',$/.exec(line)?.[1] ?? line), PHRASES, 'one phrase per line, nothing else in the list')
})

// ===== 2. the page wiring, read raw ============================================================================================================================================
console.log('2. the page wiring')
const PAGE_NOW = laterRead(PAGE)
const PAGE_BASE = stripStageOpenGate(PAGE, PAGE_NOW)
const MARKED = PAGE_NOW.split('\n').map((line, index) => ({ line, index })).filter(({ line }) => STAGE_OPEN_GATE_MARKER_RE.test(line))
function pageWiring(page) {
  const lines = page.split('\n')
  const marked = lines.map((line, index) => ({ line, index })).filter(({ line }) => STAGE_OPEN_GATE_MARKER_RE.test(line))
  assert.equal(marked.length, 13, 'thirteen marked lines: two comments, the ref, the step (seven lines), the ref write, the attribute, the import')
  const at = lines.findIndex(line => line.startsWith("  const studioFirstRunStage = studioShell && process.env.NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 === 'true' && studioWelcome"))
  assert.ok(at > 0, 'studioFirstRunStage is where it was')
  assert.deepEqual(marked.slice(0, 11).map(m => m.index), Array.from({ length: 11 }, (_, k) => at + 2 + k), 'the gate step sits right after studioFirstRunStage, in one block')
  const attr = lines.findIndex(line => line.trim() === 'data-studio-first-run-stage={studioFirstRunStage && !studioFirstRunRestoring ? "true" : undefined}')
  assert.equal(marked[11].index, attr + 1, 'the attribute sits right after data-studio-first-run-stage')
  assert.equal(marked[11].line.trim(), '{...studioStageGateProps(studioStageGate.closed && !studioFirstRunRestoring) /* STUDIO-STAGE-OPEN-GATE: data-studio-stage-gate="closed" while the gate holds (components/builder/studio-first-run.css); never while a session restores */}')
  assert.equal(marked[12].line, "import { STUDIO_STAGE_OPEN_GATE_ENABLED, stepStudioStageGate, studioStageGateProps, type StudioStageGateState } from '@/lib/studio-stage-open-gate' // STUDIO-STAGE-OPEN-GATE")
  assert.equal(lines[marked[12].index - 1], "import type { ExportDirectiveMessage } from '@/lib/chat-theme-export' // CHAT-COMMANDS", 'the import joins the late import block')
  const step = marked.slice(2, 11).map(m => m.line).join('\n')
  assert.doesNotMatch(step, /studioFirstRunStage/, 'the gate does not follow today\'s landing after the first message (the plan card ends it)')
  for (const needle of ['useRef<StudioStageGateState | null>(null)', 'enabled: STUDIO_STAGE_OPEN_GATE_ENABLED && studioShell && process.env.NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 === \'true\'', 'sessionKey: currentSessionId || wsSessionId',
    'landing: studioWelcome', 'workflow: Boolean(viewerWorkflowRequest)', 'fullscreen: studioViewerFullscreen', 'inspector: workspaceLayout.inspectorVisible',
    'historyLoading: session.isLoadingSession', 'resumed: session.isResumedSession', 'userMessages: session.userMessages', 'generatingStrawman: isGeneratingStrawman', 'generatingFinal: isGeneratingFinal',
    "phase: buildNarration.active ? buildNarration.phase : 'idle'", 'hasGeneratedDeck: studioCanvasLifecycle.hasGeneratedDeck', 'hasOwnedFinal: studioCanvasLifecycle.hasOwnedFinal', 'hasAuthoredDeck: studioCanvasLifecycle.hasAuthoredDeck',
    'blankChosen: blankPlaceholderDismissed', 'addSlideOpen: addSlideV2Open', 'studioStageGateRef.current = studioStageGate.state']) assert.ok(step.includes(needle), `the step reads ${needle}`)
  assert.equal((page.match(/NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE/g) || []).length, 1, 'the page names the flag once (a comment); the read is the lib\'s constant')
  assert.equal(stripStageOpenGate(PAGE, page), PAGE_BASE, 'without its marked lines the page is the base')
}
check('the page wiring, read raw: the gate step right after studioFirstRunStage (one block), the attribute right after data-studio-first-run-stage, one import in the late block; nothing else; strip gives the base', () => {
  pageWiring(PAGE_NOW)
  assert.equal(MARKED.length, 13)
  assert.equal(otherStrips(PAGE, stripStageOpenGate(PAGE, PAGE_NOW)), otherStrips(PAGE, git('show', `${BASE_COMMIT}:${PAGE}`)), 'the page without this change\'s lines is dev\'s, byte for byte (other changes\' lines out of both sides)')
})

// ===== 3. the behavioural harness: the page's own statements, the REAL libs, REAL recorded frames ============================================================================
console.log('3. the behavioural harness on recorded frames')
const F03 = 'scripts/fixtures/studio-stage-open-gate/director2-pk-f03'
const PROVENANCE = JSON.parse(read(`${F03}/provenance.json`))
const F03_SOURCE = path.join(os.homedir(), 'Deckster/.worktrees/frontend2-ws/streams/director2/pk-f03-new-session')
const RECORDED = {
  ...Object.fromEntries(Object.entries(PROVENANCE.files).map(([name, digest]) => [`${F03}/${name}`, digest])),
  'scripts/fixtures/studio-stage-open-gate/b-questions-mdc1.json': '39e8393827c6e6e9eb442145fb04ef7455f9995c376085f6e8726a1d0873eb57',
  'scripts/fixtures/build-resume/j7-stop-resume.json': 'd32385548c276a6be07efc4dddc87d6542cafbe26540b64571a2bc44f2c71478',
}
const WORKSPACE_ORIGINAL = path.join(os.homedir(), 'Deckster/.worktrees/frontend2-ws/streams/director2/preview-b/frames/b-questions-mdc1.json')
const QUESTIONS = JSON.parse(read('scripts/fixtures/studio-stage-open-gate/b-questions-mdc1.json'))
const [F03_A, F03_A_LABEL, F03_B1, F03_B2] = ['scenario-A.json', 'scenario-A-label-approve-and-build.json', 'scenario-B1.json', 'scenario-B2.json'].map(name => JSON.parse(read(`${F03}/${name}`)))
const J7 = JSON.parse(read('scripts/fixtures/build-resume/j7-stop-resume.json'))
check('the frames are the recorded ones, byte for byte (DIRECTOR-2\'s preview-b recording; the j7 recording already in the repo); the workspace original matches when present', () => {
  for (const [rel, digest] of Object.entries(RECORDED)) assert.equal(sha(read(rel)), digest, rel)
  assert.equal(Object.keys(PROVENANCE.files).length, 4); assert.equal(PROVENANCE.workspace_commit, 'b88aca96ac42ea4aacf25fe80ddfd85117d82df4'); assert.equal(PROVENANCE.director_base_sha, '749df53ef323be231777d5ee90e8ab28c3e9301a')
  if (fs.existsSync(F03_SOURCE)) for (const [name, digest] of Object.entries(PROVENANCE.files)) assert.equal(sha(fs.readFileSync(path.join(F03_SOURCE, name), 'utf8')), digest, `the workspace original ${name}`)
  for (const s of [F03_A, F03_A_LABEL, F03_B1, F03_B2]) { assert.equal(s.base_sha, PROVENANCE.director_base_sha); assert.equal(s.fatal_error, null); assert.deepEqual(s.socket_connect_attempts, []); assert.deepEqual(s.live_call_guard_violations, []) }
  assert.deepEqual(F03_A.frames.filter(f => f.direction === 'out').map(f => f.type), F03_A_LABEL.frames.filter(f => f.direction === 'out').map(f => f.type), 'A and its label twin send the same frame types in the same order')
  if (fs.existsSync(WORKSPACE_ORIGINAL)) assert.equal(sha(fs.readFileSync(WORKSPACE_ORIGINAL, 'utf8')), RECORDED['scripts/fixtures/studio-stage-open-gate/b-questions-mdc1.json'], 'the workspace original')
  assert.equal(QUESTIONS.director_commit, '19d09d603095e263ea87ab55af79fa59a8ad2370'); assert.match(QUESTIONS.recorded_by, /record\.py/)
  assert.match(J7.source.how, /Director's real code, keyless/)
  assert.deepEqual(Object.keys(J7.frames), ['live_stop', 'reconnect_send_history', 'reconnect_skip_history', 'typed_resume_director_off', 'typed_resume_director_on'])
})
const BRIEF = QUESTIONS.frames.find(f => f.direction === 'in').frame.data.text
const CLARIFY = QUESTIONS.frames.filter(f => f.direction === 'out').map(f => f.frame)
const LIVE = J7.frames.live_stop
const HISTORY = J7.frames.reconnect_send_history

// the page's own statements, cut out with the TypeScript parser
function pageStatements(page) {
  const sf = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const consts = new Map(), attrs = { named: null, spreads: [] }
  const gateBlock = []
  const visit = node => {
    if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) {
      const name = d.name.text
      if (['studioCanvasLifecycle', 'studioWelcome', 'studioFirstRunStage', 'studioFirstRunRestoring', 'studioInitialKnownFresh'].includes(name)) { assert.ok(!consts.has(name), `one ${name}`); consts.set(name, d.initializer.getText(sf)) }
    }
    if ((ts.isVariableStatement(node) || ts.isExpressionStatement(node)) && STAGE_OPEN_GATE_MARKER_RE.test(node.getFullText(sf))) {
      const own = node.getText(sf)
      if (/studioStageGate/.test(own)) gateBlock.push(own)
    }
    if (ts.isJsxAttributes(node) && node.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(sf) === 'data-studio-v4-shell-presentation')) {
      for (const p of node.properties) {
        if (ts.isJsxAttribute(p) && p.name.getText(sf) === 'data-studio-first-run-stage') attrs.named = p.initializer.expression.getText(sf)
        if (ts.isJsxSpreadAttribute(p) && /studioStageGate/.test(p.expression.getText(sf))) attrs.spreads.push(p.expression.getText(sf)) // the gate's own spread (the stage's other spreads read state this change does not touch)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  for (const name of ['studioCanvasLifecycle', 'studioWelcome', 'studioFirstRunStage', 'studioFirstRunRestoring']) assert.ok(consts.has(name), name)
  assert.ok(attrs.named, 'the stage element and its first-run attribute')
  return { consts, attrs, gateBlock }
}
const js = expr => ts.transpileModule(`(${expr})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText.replace(/^"use strict";\s*/, '').replace(/;\s*$/, '')
const evalIn = (code, ctx) => vm.runInNewContext(code, ctx)

/** One "render" of the page's gate-relevant statements with the harness state `S`. */
function makeRenderer({ page = PAGE_NOW, libs = ON, env = ON_ENV } = {}) {
  const st = pageStatements(page)
  const code = {
    lifecycle: js(st.consts.get('studioCanvasLifecycle')), welcome: js(st.consts.get('studioWelcome')), firstRunStage: js(st.consts.get('studioFirstRunStage')),
    restoring: js(st.consts.get('studioFirstRunRestoring')), named: js(st.attrs.named), spreads: st.attrs.spreads.map(js),
    gate: st.gateBlock.length ? ts.transpileModule(`${st.gateBlock.join('\n')}\n;({ studioStageGate })`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText.replace(/^"use strict";\s*/, '') : null,
  }
  const refs = []
  let hook = 0
  const useRef = initial => { const at = hook++; if (!refs[at]) refs[at] = { current: initial }; return refs[at] }
  return S => {
    hook = 0
    const ctx = {
      process: { env: { ...env } }, Boolean, JSON, window: { sessionStorage: null }, useRef,
      classifyStudioCanvasLifecycle: libs.lifecycle.classifyStudioCanvasLifecycle, isStudioSessionRestoring: libs.restoring.isStudioSessionRestoring, isLocalUnsavedRoute: libs.restoring.isLocalUnsavedRoute,
      STUDIO_STAGE_OPEN_GATE_ENABLED: libs.gate.STUDIO_STAGE_OPEN_GATE_ENABLED, stepStudioStageGate: libs.gate.stepStudioStageGate, studioStageGateProps: libs.gate.studioStageGateProps,
      ...S.vars, session: S.session, buildNarration: S.narration, workspaceLayout: { inspectorVisible: S.vars.inspectorVisible, chatVisible: S.vars.chatVisible },
      searchParams: { get: key => key === 'session_id' ? S.vars.currentSessionId : null }, authScopeUserId: 'user-1',
    }
    ctx.studioCanvasLifecycle = evalIn(code.lifecycle, ctx)
    ctx.studioWelcome = evalIn(code.welcome, ctx)
    ctx.studioFirstRunStage = evalIn(code.firstRunStage, ctx)
    const gate = code.gate ? evalIn(code.gate, ctx).studioStageGate : null
    ctx.studioStageGate = gate
    ctx.studioFirstRunRestoring = evalIn(code.restoring, ctx)
    const attributes = {}
    const named = evalIn(code.named, ctx)
    if (named !== undefined) attributes['data-studio-first-run-stage'] = named
    for (const spread of code.spreads) Object.assign(attributes, evalIn(spread, ctx))
    for (const [k, v] of Object.entries(attributes)) if (v === undefined) delete attributes[k]
    return { attributes, gate, welcome: ctx.studioWelcome, firstRunStage: ctx.studioFirstRunStage, restoring: ctx.studioFirstRunRestoring, lifecycle: ctx.studioCanvasLifecycle }
  }
}

// the harness state: what the socket hook, the session hook and the narration hook would hold. The narration phase is the REAL reducer's.
function freshState(libs, sessionId = 'synthetic-5e2675b8', { narration = true } = {}) {
  return {
    narrationLib: libs.narration, narrationOn: narration,
    vars: { currentSessionId: sessionId, wsSessionId: sessionId, deckOwnerSessionId: sessionId, effectivePresentationId: null, effectivePresentationUrl: null, narrationCenterStage: 'idle',
      templateModeSourcePresentationUrl: null, directorOwnedPresentation: { presentationUrl: null }, effectiveActiveVersion: 'blank', effectiveSlideCount: null, finalPresentationId: null, finalPresentationUrl: null,
      effectiveSlideStructure: null, isGeneratingFinal: false, isGeneratingStrawman: false, blankPlaceholderDismissed: false, connected: true, connecting: false, studioShell: true, studioPartialMetadata: false,
      viewerWorkflowRequest: null, studioViewerFullscreen: false, inspectorVisible: false, chatVisible: true, addSlideV2Open: false, studioInitialKnownFresh: false },
    session: { isLoadingSession: false, isResumedSession: false, userMessages: [], studioInitialFreshCanonicalEntry: null },
    narration: libs.narration.initialNarrationState(),
    messages: [],
  }
}
/** NEXT_PUBLIC_BUILD_NARRATION off: the narration hook keeps its initial, inactive state (the page then passes phase 'idle'). */
const dispatch = (S, action) => { if (S.narrationOn) S.narration = S.narrationLib.narrationReducer(S.narration, { ts: 1_760_000_000_000, ...action }) }
/** A recorded Director frame -> the state the page would hold (the socket hook's and the narration hook's part, modelled). */
function applyFrame(S, frame) {
  const p = frame.payload || {}
  S.messages.push(frame)
  switch (frame.type) {
    case 'status_update': dispatch(S, { type: 'status', status: p.status, text: p.text || '' }); break
    case 'build_phase': dispatch(S, { type: 'typed_phase', payload: p }); break
    case 'build_event': dispatch(S, { type: 'typed_event', payload: p }); break
    case 'slide_built': dispatch(S, { type: 'typed_slide_built', payload: p }); break
    case 'action_request': if ((p.actions || []).some(a => a?.value === 'accept_strawman' || a?.value === 'accept_plan')) dispatch(S, { type: 'awaiting_user' }); break
    case 'slide_update':
      if (p.is_blank !== true && Array.isArray(p.slides) && p.slides.length) {
        S.vars.effectiveSlideStructure = p
        if (p.metadata?.preview_url) Object.assign(S.vars, { effectivePresentationId: p.metadata.preview_presentation_id ?? null, effectivePresentationUrl: p.metadata.preview_url, effectiveActiveVersion: 'strawman', directorOwnedPresentation: { presentationUrl: p.metadata.preview_url } })
        dispatch(S, { type: 'strawman', ghosts: p.slides.map((s, i) => ({ index: i, title: String(s.title || ''), points: [], slideType: s.slide_type ?? null })) })
      }
      break
    case 'presentation_init': // the blank deck at connect: owned, selected, nothing authored (the welcome stays: a blank deck is not a deck)
      if (p.metadata?.preview_url) Object.assign(S.vars, { effectivePresentationId: p.metadata.preview_presentation_id ?? null, effectivePresentationUrl: p.metadata.preview_url, effectiveActiveVersion: 'blank', directorOwnedPresentation: { presentationUrl: p.metadata.preview_url } })
      break
    case 'presentation_url':
      Object.assign(S.vars, { finalPresentationId: p.presentation_id, finalPresentationUrl: p.url, effectivePresentationId: p.presentation_id, effectivePresentationUrl: p.url, effectiveActiveVersion: 'final', effectiveSlideCount: p.slide_count, narrationCenterStage: 'final_fill' })
      dispatch(S, { type: 'final_url', presentationId: p.presentation_id })
      break
    case 'sync_response':
      if (p.presentation_url && p.presentation_id) Object.assign(S.vars, { directorOwnedPresentation: { presentationUrl: p.presentation_url }, effectivePresentationId: p.presentation_id, effectivePresentationUrl: p.presentation_url, effectiveActiveVersion: 'strawman' })
      break
    default: break // chat_message, theme_sync, slide_context, token_usage: nothing the gate reads
  }
}
const send = (S, text) => { S.session.userMessages = [...S.session.userMessages, { id: `u${S.session.userMessages.length + 1}`, text, timestamp: 0 }] }

/** The chat's welcome is drawn (MessageList, FIRST_RUN_V2): no user turn, not restoring, and nothing but Director's opening greeting or a blank deck in the transcript. */
const NOT_IN_TRANSCRIPT = new Set(['build_control_capability', 'theme_sync', 'presentation_init', 'token_usage', 'slide_context'])
const welcomeInChat = (S, view, libs) => !view.restoring && S.session.userMessages.length === 0
  && S.messages.filter(m => !NOT_IN_TRANSCRIPT.has(m.type)).every(m => (m.type === 'slide_update' && m.payload?.is_blank === true) || (m.type === 'chat_message' && m.payload?.text === libs.greeting.DIRECTOR_522_INITIAL_GREETING))

// ===== 4. the stylesheet, matched =========================================================================================================================================
/** A small selector engine: [attr], [attr="v"], tag, *, :has(), :not(), :is(); descendant and child combinators. Anything else throws (a stylesheet change it does not know fails the proof). */
function parseSelectorList(text) {
  const parts = []; let depth = 0, cur = '', quote = null
  for (const ch of text) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue }
    if (ch === '(') depth++; if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts.map(parseComplex)
}
function parseComplex(text) {
  const steps = []; let i = 0, comb = null
  const skipWs = () => { const s = i; while (i < text.length && /\s/.test(text[i])) i++; return i > s }
  skipWs()
  if (text[i] === '>') { comb = '>'; i++; skipWs() }
  const leading = comb
  while (i < text.length) {
    const compound = []
    while (i < text.length && !/[\s>]/.test(text[i])) {
      if (text[i] === '[') { const end = text.indexOf(']', i); const body = text.slice(i + 1, end); const m = /^([\w-]+)(?:="([^"]*)")?$/.exec(body); if (!m) throw new Error(`attribute ${body}`); compound.push({ kind: 'attr', name: m[1], value: m[2] ?? null }); i = end + 1 }
      else if (text[i] === ':') {
        const state = /^:(hover|focus|focus-visible|disabled|active)(?![\w-(])/.exec(text.slice(i))
        if (state) { compound.push({ kind: 'state', name: state[1] }); i += state[0].length; continue }
        const m = /^:(has|not|is)\(/.exec(text.slice(i)); if (!m) throw new Error(`pseudo at ${text.slice(i, i + 20)}`)
        let depth = 0, j = i + m[0].length - 1, quote = null
        for (; j < text.length; j++) { const ch = text[j]; if (quote) { if (ch === quote) quote = null; continue } if (ch === '"') quote = ch; else if (ch === '(') depth++; else if (ch === ')') { depth--; if (depth === 0) break } }
        compound.push({ kind: m[1], list: parseSelectorList(text.slice(i + m[0].length, j)) }); i = j + 1
      } else if (text[i] === '*') { compound.push({ kind: 'any' }); i++ }
      else if (text[i] === '.') { const m = /^\.[\w-]+/.exec(text.slice(i)); compound.push({ kind: 'class', name: m[0].slice(1) }); i += m[0].length }
      else { const m = /^[a-z][\w-]*/.exec(text.slice(i)); if (!m) throw new Error(`token at ${text.slice(i, i + 20)}`); compound.push({ kind: 'tag', name: m[0] }); i += m[0].length }
    }
    steps.push({ comb, compound })
    const ws = skipWs(); comb = ws ? ' ' : null
    if (text[i] === '>') { comb = '>'; i++; skipWs() }
    if (i < text.length && comb === null) throw new Error(`no combinator at ${text.slice(i, i + 20)}`)
  }
  steps[0].comb = leading
  return steps
}
function matchCompound(el, compound) {
  for (const s of compound) {
    if (s.kind === 'attr') { if (!(s.name in el.attrs) || (s.value !== null && el.attrs[s.name] !== s.value)) return false }
    else if (s.kind === 'tag') { if (el.tag !== s.name) return false }
    else if (s.kind === 'class') { if (!String(el.attrs.class || '').split(/\s+/).includes(s.name)) return false }
    else if (s.kind === 'state') return false // an interactive state (hover, focus, disabled): never in this static markup
    else if (s.kind === 'is') { if (!s.list.some(c => matchComplex(el, c))) return false }
    else if (s.kind === 'not') { if (s.list.some(c => matchComplex(el, c))) return false }
    else if (s.kind === 'has') { if (!s.list.some(c => descendants(el).some(d => matchComplex(d, c, el)))) return false }
  }
  return true
}
const descendants = el => el.children.flatMap(c => [c, ...descendants(c)])
/** Right-to-left with backtracking; `anchor` (for :has) ties the leftmost step to the :has element (child for a leading '>', else descendant). */
function matchComplex(el, steps, anchor = null, k = steps.length - 1) {
  if (!matchCompound(el, steps[k].compound)) return false
  if (k === 0) {
    if (!anchor) return true
    return steps[0].comb === '>' ? el.parent === anchor : ancestors(el).includes(anchor)
  }
  const comb = steps[k].comb
  if (comb === '>') return el.parent ? matchComplex(el.parent, steps, anchor, k - 1) : false
  for (const a of ancestors(el)) { if (anchor && a === anchor) break; if (matchComplex(a, steps, anchor, k - 1)) return true }
  return false
}
const ancestors = el => { const out = []; for (let p = el.parent; p; p = p.parent) out.push(p); return out }
const node = (tag, attrs = {}, children = []) => { const n = { tag, attrs, children, parent: null }; for (const c of children) c.parent = n; return n }
/** The Studio workspace markup the stylesheet sees (the parts its rules name), with the stage's attributes from the page and the chat's welcome or not. */
function workspaceDom({ stageAttrs, chatVisible = true, welcome }) {
  const transcript = node('div', {}, welcome
    ? [node('section', { 'data-studio-director-welcome': 'true', 'data-studio-first-run': 'true' }), node('section', { 'data-studio-first-run-starters': 'true' })]
    : [node('div', { 'data-studio-director-message': 'user' }), node('div', { 'data-studio-director-message': 'director' })])
  const chat = node('div', { 'data-studio-workspace-drawer': 'deck', 'data-studio-workspace-visible': String(chatVisible) }, [
    node('div', { 'data-studio-workspace-content': 'true' }, [node('div', { 'data-radix-scroll-area-viewport': '' }, [node('div', {}, [transcript])]), node('div', { 'data-studio-v4-composer': 'true' })]),
  ])
  const handle = node('div', { 'data-studio-drawer-handle': 'director' })
  const resize = node('div', { 'data-studio-workspace-resize': 'chat' })
  const stage = node('div', { 'data-studio-v4-shell-presentation': 'true', ...stageAttrs })
  const workspace = node('div', { 'data-studio-v4-shell-workspace': 'true' }, [chat, handle, resize, stage])
  const shell = node('div', { 'data-studio-v4-shell': 'true' }, [workspace])
  return { shell, chat, chatContent: chat.children[0], stage, handle, resize, transcript, composer: chat.children[0].children[1] }
}
function cssRules(cssText) {
  const out = []
  postcss.parse(cssText).walkRules(rule => { if (rule.parent?.type === 'root') out.push({ selectors: parseSelectorList(rule.selector), decls: rule.nodes.filter(n => n.type === 'decl').map(d => ({ prop: d.prop, value: d.value, important: Boolean(d.important) })), selector: rule.selector }) })
  return out
}
const declsFor = (rules, el) => rules.filter(r => r.selectors.some(s => matchComplex(el, s))).flatMap(r => r.decls)
/** The layout the stylesheet gives: the chat full-width, the stage hidden, the handles gone, the column centred. */
function layoutOf(rules, dom) {
  const has = (el, prop, value, important) => declsFor(rules, el).some(d => d.prop === prop && d.value === value && (important === undefined || d.important === important))
  return {
    chatFull: has(dom.chat, 'width', '100%', true) && has(dom.chatContent, 'width', '100%', true),
    stageHidden: has(dom.stage, 'visibility', 'hidden'),
    handlesGone: has(dom.handle, 'display', 'none') && has(dom.resize, 'display', 'none'),
    columnCentred: has(dom.transcript, 'align-items', 'center') && has(dom.transcript, 'flex-direction', 'column') && declsFor(rules, dom.transcript.children[0]).some(d => d.prop === 'width' && /^min\((100%, (560|620)px|(560|620)px, 100%)\)$/.test(d.value)),
    composerWidth: declsFor(rules, dom.composer).filter(d => d.prop === 'width').map(d => d.value).pop() ?? null,
  }
}
const CSS_NOW = laterRead(CSS)
const RULES_ON = cssRules(CSS_NOW)
const RULES_BASE = cssRules(stripStageOpenGate(CSS, CSS_NOW))

// ===== the scenarios, on the recorded frames ==============================================================================================================================
/** Run a scenario: `steps` is a list of [label, (S) => void]; each step is followed by one render. Returns the per-step view (gate, attributes, layout). */
function runScenario(steps, { page = PAGE_NOW, libs = ON, env = ON_ENV, rules = RULES_ON, state, narration = true } = {}) {
  const render = makeRenderer({ page, libs, env })
  const S = state ? state(libs) : freshState(libs, undefined, { narration })
  const out = []
  for (const [label, act] of steps) {
    act(S)
    const view = render(S)
    const welcome = welcomeInChat(S, view, libs)
    const layout = layoutOf(rules, workspaceDom({ stageAttrs: view.attributes, chatVisible: S.vars.chatVisible, welcome }))
    out.push({ label, closed: view.gate?.closed ?? false, reason: view.gate?.reason ?? null, attributes: view.attributes, welcome, layout })
  }
  return out
}
const step = (label, act = () => {}) => [label, act]
const framesSteps = (frames, prefix) => frames.map((f, i) => step(`${prefix} ${i} ${f.type}${f.payload?.phase ? ':' + f.payload.phase : ''}`, S => applyFrame(S, f)))
/** DIRECTOR-2's scenario file -> steps: each outbound frame as recorded; each inbound user_message is the user's send (its text, as Studio adds it to the transcript); the connect record starts the session. */
const f03Steps = (scenario, sessionId = 's_f03_a') => [
  step('fresh session (connect)', S => { Object.assign(S.vars, { currentSessionId: sessionId, wsSessionId: sessionId, deckOwnerSessionId: sessionId }) }),
  ...scenario.frames.filter(f => f.direction !== 'connect').map(f => f.direction === 'in'
    ? step(`seq ${f.seq} in user_message "${f.frame.data.text}"`, S => send(S, f.frame.data.text))
    : step(`seq ${f.seq} ${f.type}${f.frame.payload?.phase ? ':' + f.frame.payload.phase : ''}`, S => applyFrame(S, f.frame))),
]
const at = (views, seq) => { const i = views.findIndex(v => v.label.startsWith(`seq ${seq} `)); assert.ok(i >= 0, `seq ${seq}`); return i }
const NEW_SESSION = [
  step('fresh session: the welcome'),
  step(`user brief: "${BRIEF}"`, S => send(S, BRIEF)),
  ...framesSteps(CLARIFY, 'clarifying'),
  step('user answers: "Executives, 20 minutes"', S => send(S, 'Executives, 20 minutes')),
  ...framesSteps(LIVE, 'j7'),
]
const firstOpen = views => views.findIndex(v => !v.layout.stageHidden && v.label !== 'fresh session: the welcome' && !v.welcome)
const expectSplit = v => { assert.equal(v.layout.stageHidden, false, `${v.label}: stage visible`); assert.equal(v.layout.chatFull, false, `${v.label}: split`) }
const expectFull = v => { assert.equal(v.layout.stageHidden, true, `${v.label}: stage hidden`); assert.equal(v.layout.chatFull, true, `${v.label}: chat full width`); assert.equal(v.layout.handlesGone, true, `${v.label}: no resize handle`); assert.ok(v.layout.columnCentred, `${v.label}: the column centred`) }

function scenarioChecks({ page = PAGE_NOW, libs = ON, rules = RULES_ON } = {}) {
  const o = { page, libs, rules }
  // MAIN, DIRECTOR-2's scenario A: the welcome until the brief; closed through the clarifying card, the answer, the plan card and the outline being planned; opens at the FIRST strawman frame; latched
  const fa = runScenario(f03Steps(F03_A), o)
  for (const v of fa.slice(0, at(fa, 7))) { expectFull(v); assert.equal(v.welcome, true, `${v.label}: the first-run welcome (connect frames and the greeting)`) }
  const strawA = at(fa, 26)
  assert.equal(fa[strawA].label, 'seq 26 build_phase:strawman')
  for (const v of fa.slice(at(fa, 7), strawA)) { expectFull(v); assert.equal(v.welcome, false); assert.equal(v.attributes['data-studio-stage-gate'], 'closed', v.label); assert.equal(v.reason, 'closed', v.label) }
  assert.ok(fa[at(fa, 12)].label.startsWith('seq 12 action_request'), 'the plan card'); expectFull(fa[at(fa, 12)])
  for (const v of fa.slice(strawA)) { expectSplit(v); assert.equal(v.reason, 'strawman', `${v.label}: latched on the strawman`) }
  assert.ok(fa[at(fa, 34)].label === 'seq 34 build_phase:building' && fa[at(fa, 70)].label === 'seq 70 presentation_url' && fa.at(-1).label === 'seq 73 build_phase:complete')
  // the label twin ("Approve & build"): the same gate, step for step
  const fal = runScenario(f03Steps(F03_A_LABEL), o)
  assert.deepEqual(fal.map(v => [v.closed, v.reason, v.layout.stageHidden]), fa.map(v => [v.closed, v.reason, v.layout.stageHidden]), 'A and its label twin gate identically')
  // B1 and B2: "show me the deck" typed during the questions opens it at once, whatever Director answers (respond: one chat line; generate_strawman: the outline)
  for (const [name, scenario, last] of [['B1', F03_B1, 10], ['B2', F03_B2, 25]]) {
    const v = runScenario(f03Steps(scenario), o)
    for (const x of v.slice(at(v, 7), at(v, 9))) expectFull(x)
    assert.equal(v[at(v, 9)].label, 'seq 9 in user_message "show me the deck"', name)
    for (const x of v.slice(at(v, 9))) { expectSplit(x); assert.equal(x.reason, 'typed', `${name} ${x.label}`) }
    assert.ok(v.at(-1).label.startsWith(`seq ${last} `), name)
  }
  // the narration canvas OFF (NEXT_PUBLIC_BUILD_NARRATION unset; dev's value is not on record): no narration phase reaches the gate, so the strawman opens it at the outline itself, seq 27 slide_update (authored
  // structure), one frame after build_phase strawman; B1 / B2 still open on the typed phrase; the deck's URL (seq 70) is past the latch
  const faOff = runScenario(f03Steps(F03_A), { ...o, narration: false })
  const outlineAt = at(faOff, 27)
  assert.equal(faOff[outlineAt].label, 'seq 27 slide_update')
  for (const v of faOff.slice(at(faOff, 7), outlineAt)) { expectFull(v); assert.equal(v.reason, 'closed', `narration off: ${v.label}`) }
  for (const v of faOff.slice(outlineAt)) { expectSplit(v); assert.equal(v.reason, 'authored', `narration off: ${v.label}`) }
  for (const scenario of [F03_B1, F03_B2]) { const v = runScenario(f03Steps(scenario), { ...o, narration: false }); expectFull(v[at(v, 8)]); for (const x of v.slice(at(v, 9))) { expectSplit(x); assert.equal(x.reason, 'typed') } }
  // no strawman in A (its strawman frames and outline gate left out, every other frame as recorded): the first build frame opens it (the build turn's status_update, which the narration reads as building)
  const aNoStraw = { ...F03_A, frames: F03_A.frames.filter(f => !(f.direction === 'out' && ((f.type === 'build_phase' && f.frame.payload?.phase === 'strawman') || f.type === 'slide_update' || (f.type === 'action_request' && f.seq === 29)))) }
  const fn = runScenario(f03Steps(aNoStraw), o)
  const firstOpenAt = fn.findIndex(v => v.reason !== 'closed' && !v.welcome)
  assert.equal(fn[firstOpenAt].label, 'seq 32 status_update', 'the first build frame (Generating presentation content...)')
  for (const v of fn.slice(at(fn, 7), firstOpenAt)) expectFull(v)
  for (const v of fn.slice(firstOpenAt)) { expectSplit(v); assert.equal(v.reason, 'build') }
  // A. a new session: closed through the clarifying turns, opens at the FIRST strawman frame, then latched
  const a = runScenario(NEW_SESSION, o)
  expectFull(a[0]); assert.equal(a[0].welcome, true, 'the welcome is up first (today\'s first-run layout)')
  for (const v of a.slice(1, 2 + CLARIFY.length + 1)) { expectFull(v); assert.equal(v.welcome, false); assert.deepEqual(v.attributes['data-studio-stage-gate'], 'closed', v.label) }
  const strawmanAt = a.findIndex(v => v.label === 'j7 1 build_phase:strawman')
  assert.ok(strawmanAt > 0)
  for (const v of a.slice(1, strawmanAt)) expectFull(v)
  assert.equal(a[strawmanAt - 1].label, 'j7 0 build_phase:planning', 'planning (the plan being designed) is still closed')
  for (const v of a.slice(strawmanAt)) { expectSplit(v); assert.equal(v.reason, 'strawman', `${v.label}: latched on the strawman`); assert.equal('data-studio-stage-gate' in v.attributes, false) }
  // B. no strawman: the first build frame opens it
  const noStraw = LIVE.filter(f => !(f.type === 'build_phase' && f.payload.phase === 'strawman') && f.type !== 'slide_update')
  const b = runScenario([step('fresh'), step('brief', S => send(S, BRIEF)), ...framesSteps(CLARIFY, 'clarifying'), ...framesSteps(noStraw, 'j7-no-strawman')], o)
  // the first build frame in the recorded order is Director's status_update "Generating presentation content..." (the narration's real reducer reads it as building), then build_phase:building
  const buildAt = b.findIndex(v => v.label.startsWith('j7-no-strawman') && !v.label.endsWith('build_phase:planning'))
  assert.equal(b[buildAt].label, 'j7-no-strawman 1 status_update', 'the first frame after planning')
  assert.equal(noStraw[1].payload.text, 'Generating presentation content...')
  for (const v of b.slice(1, buildAt)) expectFull(v)
  assert.equal(b[buildAt - 1].label, 'j7-no-strawman 0 build_phase:planning')
  for (const v of b.slice(buildAt)) { expectSplit(v); assert.equal(v.reason, 'build', v.label) }
  // C. deck ready, with nothing before it (the recorded presentation_url frame alone)
  const url = LIVE.find(f => f.type === 'presentation_url')
  const c = runScenario([step('fresh'), step('brief', S => send(S, BRIEF)), ...framesSteps(CLARIFY, 'clarifying'), ...framesSteps([url], 'deck')], o)
  for (const v of c.slice(1, -1)) expectFull(v)
  expectSplit(c.at(-1)); assert.equal(c.at(-1).reason, 'deck')
  // D. each typed phrase opens it; near misses do not
  for (const phrase of PHRASES) {
    const d = runScenario([step('fresh'), step('brief', S => send(S, BRIEF)), ...framesSteps(CLARIFY, 'clarifying'), step(`typed "${phrase}"`, S => send(S, `Can you ${phrase}?`)), step('Director answers (recorded question card again)', S => applyFrame(S, CLARIFY[0]))], o)
    expectFull(d.at(-3)); expectSplit(d.at(-2)); assert.equal(d.at(-2).reason, 'typed'); expectSplit(d.at(-1))
  }
  for (const said of NEAR_MISSES) {
    const d = runScenario([step('fresh'), step('brief', S => send(S, BRIEF)), ...framesSteps(CLARIFY, 'clarifying'), step(`near miss "${said}"`, S => send(S, said))], o)
    expectFull(d.at(-1))
  }
  // E. Blank canvas (the first-run row's choice) and Add Slide (its panel), then the latch
  const e1 = runScenario([step('fresh'), step('Start on a blank canvas', S => { S.vars.blankPlaceholderDismissed = true }), step('brief', S => send(S, BRIEF)), ...framesSteps(CLARIFY, 'clarifying')], o)
  for (const v of e1.slice(1)) { expectSplit(v); assert.equal(v.reason, 'blank') }
  const e2 = runScenario([step('fresh'), step('brief', S => send(S, BRIEF)), ...framesSteps(CLARIFY, 'clarifying'),
    step('Add Slide panel opens (an inspector)', S => { S.vars.addSlideV2Open = true; S.vars.inspectorVisible = true }), step('panel closed', S => { S.vars.addSlideV2Open = false; S.vars.inspectorVisible = false })], o)
  expectSplit(e2.at(-2)); expectSplit(e2.at(-1)); assert.equal(e2.at(-1).reason, 'add_slide', 'Add Slide latched')
  // F. the latch never lets go by itself; a New Chat starts closed again
  const f = runScenario([...NEW_SESSION, step('the narration is reset (a later idle state)', S => { S.narration = S.narrationLib.initialNarrationState(); S.vars.effectiveSlideStructure = null; Object.assign(S.vars, { finalPresentationId: null, finalPresentationUrl: null, effectivePresentationId: null, effectivePresentationUrl: null, effectiveActiveVersion: 'blank', narrationCenterStage: 'idle' }) }),
    step('NEW CHAT: a new session id, empty transcript', S => { Object.assign(S.vars, { currentSessionId: 'new-chat-2', wsSessionId: 'new-chat-2', deckOwnerSessionId: 'new-chat-2' }); S.session.userMessages = []; S.messages = [] }),
    step('brief in the new chat', S => send(S, BRIEF)), ...framesSteps(CLARIFY, 'clarifying 2')], o)
  const reset = f.findIndex(v => v.label.startsWith('the narration is reset'))
  expectSplit(f[reset]); assert.equal(f[reset].reason, 'strawman', 'latched: the landing came back, the stage stays')
  expectFull(f[reset + 1]); assert.equal(f[reset + 1].welcome, true)
  for (const v of f.slice(reset + 2)) { expectFull(v); assert.equal(v.reason, 'closed') }
  // G. a restored session with a deck: open at once, never full-width, while loading or after
  const g = runScenario([
    step('reload: the history is loading', S => { S.session.isLoadingSession = true }),
    step('history restored (resumed, user turns, the outline deck)', S => { Object.assign(S.session, { isLoadingSession: false, isResumedSession: true, userMessages: [{ id: 'u1', text: 'Transition weekly status meetings to async updates', timestamp: 0 }] }) }),
    ...framesSteps(HISTORY, 'send_history'),
    step('user types (resumed cleared)', S => { S.session.isResumedSession = false; send(S, 'tighten slide 2') }),
  ], o)
  for (const v of g) { expectSplit(v); assert.equal('data-studio-stage-gate' in v.attributes, false, `${v.label}: never closed`) }
  // and the in-between moment (loaded, deck not yet adopted) is not full-width either
  const g2 = runScenario([step('reload: loading', S => { S.session.isLoadingSession = true }), step('loaded, no deck adopted yet', S => { Object.assign(S.session, { isLoadingSession: false, isResumedSession: true, userMessages: [{ id: 'u1', text: 'old', timestamp: 0 }] }) })], o)
  for (const v of g2) expectSplit(v)
  // H. workflow link, fullscreen and an inspector open it as today, while they last
  for (const [name, on, off] of [['workflow link', S => { S.vars.viewerWorkflowRequest = { action: 'theme', key: 'k', itemId: null } }, S => { S.vars.viewerWorkflowRequest = null }],
    ['fullscreen', S => { S.vars.studioViewerFullscreen = true }, S => { S.vars.studioViewerFullscreen = false }], ['inspector', S => { S.vars.inspectorVisible = true }, S => { S.vars.inspectorVisible = false }]]) {
    const h = runScenario([step('fresh'), step('brief', S => send(S, BRIEF)), ...framesSteps(CLARIFY, 'clarifying'), step(`${name} on`, on), step(`${name} off`, off)], o)
    expectSplit(h.at(-2)); assert.equal(h.at(-2).attributes['data-studio-first-run-stage'], undefined, `${name}: the first-run attribute is off, as today`)
    expectFull(h.at(-1))
  }
  return { a, b, c, f, g }
}
check('BEHAVIOUR (flag on, recorded frames): closed through the clarifying turns and the plan card; opens at the first strawman frame (with the narration canvas off: at the outline itself); at the first build frame when there is no strawman; on deck ready; on each typed phrase; on Blank canvas and Add Slide; not on a near miss; stays open (latch); New Chat starts closed; a restored deck opens at once with no full-width flash; workflow link / fullscreen / inspector as today', () => {
  scenarioChecks()
})

// flag off: today's behaviour for every case, byte-identical to the base page (this change's lines stripped)
const OFF_SCENARIOS = () => {
  const noStraw = LIVE.filter(f => !(f.type === 'build_phase' && f.payload.phase === 'strawman') && f.type !== 'slide_update')
  return {
    f03A: f03Steps(F03_A), f03ALabel: f03Steps(F03_A_LABEL), f03B1: f03Steps(F03_B1), f03B2: f03Steps(F03_B2),
    newSession: NEW_SESSION,
    noStrawman: [step('fresh'), step('brief', S => send(S, BRIEF)), ...framesSteps(CLARIFY, 'clarifying'), ...framesSteps(noStraw, 'j7-no-strawman')],
    typed: [step('fresh'), step('brief', S => send(S, BRIEF)), ...framesSteps(CLARIFY, 'clarifying'), step('typed', S => send(S, 'show me the deck'))],
    blank: [step('fresh'), step('blank', S => { S.vars.blankPlaceholderDismissed = true }), step('brief', S => send(S, BRIEF))],
    restored: [step('loading', S => { S.session.isLoadingSession = true }), step('restored', S => { Object.assign(S.session, { isLoadingSession: false, isResumedSession: true, userMessages: [{ id: 'u1', text: 'old', timestamp: 0 }] }) }), ...framesSteps(HISTORY, 'h')],
    overrides: [step('fresh'), step('workflow', S => { S.vars.viewerWorkflowRequest = { action: 'theme', key: 'k', itemId: null } }), step('inspector', S => { S.vars.viewerWorkflowRequest = null; S.vars.inspectorVisible = true }), step('brief', S => { S.vars.inspectorVisible = false; send(S, BRIEF) })],
  }
}
const viewDigest = views => sha(JSON.stringify(views.map(v => ({ label: v.label, attributes: v.attributes, welcome: v.welcome, layout: v.layout }))))
check('FLAG OFF: every scenario renders byte-identical to the base page and stylesheet (this change\'s lines stripped): the same stage attributes, the same welcome, the same layout, step by step (hashed); no data-studio-stage-gate ever; after the first message the split (today\'s F-03)', () => {
  for (const [name, steps] of Object.entries(OFF_SCENARIOS())) {
    const now = runScenario(steps, { libs: OFF, env: OFF_ENV })
    const base = runScenario(steps, { page: PAGE_BASE, libs: OFF, env: OFF_ENV, rules: RULES_BASE })
    assert.equal(viewDigest(now), viewDigest(base), `${name}: flag off == base`)
    for (const v of now) assert.equal('data-studio-stage-gate' in v.attributes, false, `${name}/${v.label}`)
  }
  const off = runScenario(NEW_SESSION, { libs: OFF, env: OFF_ENV })
  expectFull(off[0]); expectSplit(off[1]); expectSplit(off[2])
  for (const narration of [true, false]) assert.equal(viewDigest(runScenario(f03Steps(F03_A), { libs: OFF, env: OFF_ENV, narration })), viewDigest(runScenario(f03Steps(F03_A), { page: PAGE_BASE, libs: OFF, env: OFF_ENV, rules: RULES_BASE, narration })), `scenario A, narration ${narration ? 'on' : 'off'}: flag off == base`)
  const offA = runScenario(f03Steps(F03_A), { libs: OFF, env: OFF_ENV })
  expectFull(offA[at(offA, 6)]); for (const v of offA.slice(at(offA, 7))) expectSplit(v) // today: the split from the first message (PK's F-03)
  // and with the flag on but FIRST_RUN_V2 off: nothing either
  const noFirstRun = runScenario(NEW_SESSION, { libs: makeLibs({ env: { [STAGE_OPEN_GATE_FLAG]: 'true', [SHELL]: 'true' } }), env: { [STAGE_OPEN_GATE_FLAG]: 'true', [SHELL]: 'true' } })
  for (const v of noFirstRun) assert.equal('data-studio-stage-gate' in v.attributes, false, `FIRST_RUN_V2 off: ${v.label}`)
})

function cssChecks(cssText) {
  const RULES_ON = cssRules(cssText), CSS_NOW = cssText
  const gateRules = RULES_ON.filter(r => STAGE_OPEN_GATE_MARKER_RE.test(CSS_NOW.split('\n').find(line => line.startsWith(r.selector)) ?? ''))
  assert.equal(gateRules.length, 8, 'eight rules')
  for (const r of gateRules) {
    assert.match(r.selector, /^\[data-studio-v4-shell="true"\] \[data-studio-v4-shell-workspace\]:has\(> \[data-studio-v4-shell-presentation\]\[data-studio-stage-gate="closed"\](\[data-studio-stage-gate-width="560"\])?\):has\(\[data-studio-workspace-drawer="deck"\]\[data-studio-workspace-visible="true"\]\):not\(:has\(\[data-studio-workspace-drawer="deck"\] \[data-studio-first-run\]\)\) /, r.selector.slice(0, 120))
  }
  assert.equal(otherStrips(CSS, stripStageOpenGate(CSS, CSS_NOW)), otherStrips(CSS, git('show', `${BASE_COMMIT}:${CSS}`)), 'the stylesheet without this change\'s lines is dev\'s')
  assert.doesNotMatch(stripStageOpenGate(CSS, CSS_NOW), /data-studio-stage-gate/, 'no other rule names the attribute')
  // matched: no attribute -> no gate rule applies, whatever the chat holds; closed + welcome -> only the first-run rules; closed + transcript -> the full-width layout
  for (const welcome of [true, false]) for (const chatVisible of [true, false]) {
    const dom = workspaceDom({ stageAttrs: {}, chatVisible, welcome })
    for (const el of [dom.chat, dom.stage, dom.transcript, dom.composer, dom.handle]) assert.equal(declsFor(gateRules, el).length, 0, 'no attribute: no gate rule')
  }
  const pre = workspaceDom({ stageAttrs: { 'data-studio-first-run-stage': 'true', 'data-studio-stage-gate': 'closed' }, welcome: true })
  for (const el of [pre.chat, pre.stage, pre.transcript, pre.composer, pre.handle]) assert.equal(declsFor(gateRules, el).length, 0, 'the welcome is up: the gate rules stay out of the first-run layout')
  const hiddenChat = workspaceDom({ stageAttrs: { 'data-studio-stage-gate': 'closed' }, chatVisible: false, welcome: false })
  assert.equal(layoutOf(RULES_ON, hiddenChat).stageHidden, false, 'a hidden chat (single-pane, stage chosen) never leaves an empty workspace')
  const closed = layoutOf(RULES_ON, workspaceDom({ stageAttrs: { 'data-studio-stage-gate': 'closed' }, welcome: false }))
  assert.deepEqual([closed.chatFull, closed.stageHidden, closed.handlesGone, Boolean(closed.columnCentred), closed.composerWidth], [true, true, true, true, 'min(100%, 668px)'])
  const closed560 = layoutOf(RULES_ON, workspaceDom({ stageAttrs: { 'data-studio-stage-gate': 'closed', 'data-studio-stage-gate-width': '560' }, welcome: false }))
  assert.equal(closed560.composerWidth, 'min(100%, calc(24px + 560px))', 'the 560 column follows the welcome width decision')
  // the older pins (test-studio-welcome-width, test-studio-first-run-v2) find the welcome's rules by their literal text and mutate its FIRST occurrence: none of those literals may appear in this change's lines
  for (const literal of ['width: min(620px, 100%)', 'width: min(668px, 100%)', 'max-width: 620px;', 'width: min(560px, 100%)', 'calc(560px + 24px)', 'data-studio-first-run-width', 'data-studio-first-run-stage']) {
    for (const line of CSS_NOW.split('\n').filter(line => STAGE_OPEN_GATE_MARKER_RE.test(line))) assert.ok(!line.includes(literal), `this change's CSS never repeats the older rules' literal ${literal}`)
  }
  const firstRunHidden = RULES_ON.filter(r => r.decls.some(d => d.prop === 'visibility' && d.value === 'hidden'))
  assert.equal(firstRunHidden.length, 2, 'two rules hide the stage: the first-run one and this one, both with visibility (the stage stays mounted)')
  for (const r of gateRules) for (const d of r.decls) assert.ok(!(d.prop === 'display' && d.value === 'none') || /resize|drawer-handle/.test(r.selector), 'only the handles are display:none; the stage is never unmounted or display:none')
}
check('the stylesheet: every gate rule is keyed to [data-studio-stage-gate="closed"] on the stage AND a visible chat AND no welcome in it (so before the first message the first-run rules alone apply); with no attribute none matches; the strip gives the base CSS byte for byte', () => cssChecks(CSS_NOW))

// ===== 5. scope over the COMMITTED diff (BASE..head), gate-safe and robust after merge ==========================================================================
console.log('5. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-30T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-30T00:00:00Z' }
const plumb = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sog-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = c => git('rev-list', '--parents', '-n', '1', c).trim().split(/\s+/).slice(1)
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(STAGE_OPEN_GATE_SUBJECT))
/** GATE-SAFE head: on the gate's merge (first parent dev, second parent this change's head) the scope runs against HEAD^2; a branch head (an ordinary commit) is used as it is. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const REAL = { norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const normDiff = (ctx, rel, head) => git('diff', '-U0', blobOf(ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`))))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  return own
}
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].sort(), [...STAGE_OPEN_GATE_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of STAGE_OPEN_GATE_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, STAGE_OPEN_GATE_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.ok(diff.length > 0, `${rel}: lines added`)
    assert.equal(stripStageOpenGate(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of STAGE_OPEN_GATE_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['components/builder/presentation-area.tsx', 'components/builder/studio-outline-canvas.tsx', 'lib/studio-flow-control.ts', 'hooks/use-studio-flow-control.ts', 'components/builder/studio-first-run-actions.tsx',
    'lib/studio-first-run-restoring.ts', 'hooks/use-deckster-websocket-v2.ts', 'components/builder/message-list.tsx']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(STAGE_OPEN_GATE_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.ok(env.includes(`\n\n${STAGE_OPEN_GATE_ENV_BLOCK.split('\n')[0]}`), 'a blank line before the block')
  assert.match(STAGE_OPEN_GATE_ENV_BLOCK, /^NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE="false"$/m, 'documented, default off')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-stage-open-gate-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['STAGE_OPEN_GATE_SCOPE_FILES', 'STAGE_OPEN_GATE_ENV_BLOCK', 'stripStageOpenGate'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }
const HEAD = scopeHead('HEAD')
check(`this change's own commits (subject starts "${STAGE_OPEN_GATE_SUBJECT}", found across the whole line, no merges) exist, with the co-author line`, () => { scopeOwnCommits(HEAD) })
check('the committed files are exactly this change\'s; every line added to page.tsx and the stylesheet is a pure insertion that carries the marker; the strip gives the base back byte for byte; FRONTEND-1\'s files and the flow-control files are untouched', () => scopeCommittedFiles(HEAD))
check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of STAGE_OPEN_GATE_NEW_FILES.filter(rel => !rel.endsWith('.json'))) assert.doesNotMatch(read(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD)
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of STAGE_OPEN_GATE_FILES) assert.equal(stripStageOpenGate(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT)
})
mutant('the old first-parent own-commit query on the gate-style merge (no HEAD^2 rule) finds no own commit', () => { scopeOwnCommits(scopeHead(GATE, { gateRule: false }), { firstParentOnly: true }) })
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sog-idx-'))
  try {
    const env = { ...process.env, ...GIT_IDENT, GIT_INDEX_FILE: path.join(dir, 'index') }
    const viaIndex = (...a) => execFileSync('git', a, { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim()
    viaIndex('read-tree', parent)
    for (const [rel, text] of Object.entries(edits)) viaIndex('update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`)
    return plumb(['commit-tree', viaIndex('write-tree'), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
check('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE: the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD])
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
})
// a SYNTHETIC change stacked after this one: a marked line beside this change's in the page and in the stylesheet, a registry trio below this change's, an .env.example block, a new file
const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
const syntheticStrip = (rel, text) => STAGE_OPEN_GATE_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const page = at(PAGE).split('\n').flatMap(line => line.startsWith('  studioStageGateRef.current = studioStageGate.state') ? [line, `  const syntheticLater = 1 // ${SYN.marker}`] : [line]).join('\n')
  const css = `${at(CSS)}\n/* ${SYN.marker} */ [data-synthetic-later] { color: red; }`
  assert.ok(page.includes(SYN.marker), 'the synthetic anchor exists')
  const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('STAGE_OPEN_GATE_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('STAGE_OPEN_GATE_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripStageOpenGate')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  return commitWith(parent, { [PAGE]: page, [CSS]: css, 'scripts/studio-later-changes.mjs': reg, '.env.example': `${at('.env.example')}\n${SYN.block}`, [SYN.file]: 'export const SYNTHETIC_SCOPE_FILES = new Set()\n' }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC_OR_ERROR = (() => { try { return syntheticCommit(HEAD) } catch (error) { return error } })()
const synthetic = () => { if (SYNTHETIC_OR_ERROR instanceof Error) throw SYNTHETIC_OR_ERROR; return SYNTHETIC_OR_ERROR }
const SYN_CTX = { norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)), env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, '') }
check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked lines beside this change\'s in the page and the stylesheet, a registry trio, an .env.example block, a new file; another subject) leaves this change\'s scope passing on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  const SYNTHETIC = synthetic()
  assert.ok(!ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
  // and the page wiring, read past the later change's line, is still this change's
  const later = syntheticStrip(PAGE, git('show', `${SYNTHETIC}:${PAGE}`)) // read as this change left it: the later change's lines out (as laterStrips does for a registered one)
  pageWiring(later)
})
mutant('scope: the synthetic later change is not told to the scope (its lines are unmarked additions, its registry lines extra)', () => { scopeCommittedFiles(synthetic()); scopeEnvAndRegistry(synthetic()) })
mutant('scope: a stray foreign file in a "Stage open gate:" commit', () => { scopeCommittedFiles(commitWith(HEAD, { 'stray-stage-gate.txt': 'stray\n' }, `${STAGE_OPEN_GATE_SUBJECT} a stray file${TRAILER}`)) })
mutant('scope: an own commit without the co-author line', () => { scopeOwnCommits(commitWith(HEAD, {}, `${STAGE_OPEN_GATE_SUBJECT} no trailer`)) })
mutant('scope: an unmarked line added to page.tsx in an own commit', () => { scopeCommittedFiles(commitWith(HEAD, { [PAGE]: git('show', `${HEAD}:${PAGE}`).replace('  studioStageGateRef.current = studioStageGate.state', '  const sneaky = 1\n  studioStageGateRef.current = studioStageGate.state') }, `${STAGE_OPEN_GATE_SUBJECT} sneaky${TRAILER}`)) })
mutant('scope: an own commit that touches FRONTEND-1\'s presentation-area.tsx', () => { scopeCommittedFiles(commitWith(HEAD, { 'components/builder/presentation-area.tsx': `${git('show', `${HEAD}:components/builder/presentation-area.tsx`)}\n` }, `${STAGE_OPEN_GATE_SUBJECT} touches presentation-area${TRAILER}`)) })

// ===== 6. mutants ==============================================================================================================================================================
console.log('6. mutants')
// every mutated text is made OUTSIDE the mutant: a mutant whose text is not found fails the proof, it is never counted as caught
const libMutant = (label, from, to) => { const mutated = swap(LIB_SRC, from, to); mutant(`lib: ${label}`, () => {
  const overrides = { [LIB]: mutated }
  const libs = makeLibs({ env: ON_ENV, overrides })
  flagMatrix(overrides); libChecks(libs.gate); scenarioChecks({ libs })
}) }
libMutant('flag truthy', "process.env.NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE === 'true'", "Boolean(process.env.NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE)")
libMutant('a phrase dropped', "  'add a slide',\n", '')
libMutant('substring match instead of whole phrases', 'padded.includes(` ${wanted} `)', 'said.includes(wanted)')
libMutant('case not normalised', ".normalize('NFKC').toLowerCase()", ".normalize('NFKC')")
libMutant('planning opens it', "return phase !== 'idle' && phase !== 'planning' && phase !== 'strawman'", "return phase !== 'idle' && phase !== 'strawman'")
libMutant('the strawman phase ignored', "if (input.generatingStrawman || input.phase === 'strawman') return 'strawman'", "if (input.generatingStrawman) return 'strawman'")
libMutant('the plan card opens it (awaiting_user read as a build phase)', "return phase !== 'idle' && phase !== 'planning' && phase !== 'strawman' && phase !== 'awaiting_user'", "return phase !== 'idle' && phase !== 'planning' && phase !== 'strawman'")
libMutant('the gate follows today\'s landing (closes only while the landing lasts)', 'const closed = state.armed && state.latched === null && override === null', 'const closed = state.armed && state.latched === null && override === null && input.landing === true')
libMutant('the owned final deck ignored', 'if (input.hasGeneratedDeck || input.hasOwnedFinal) return \'deck\'', 'if (input.hasGeneratedDeck) return \'deck\'')
libMutant('no latch', 'const latched = next.latched ?? studioStageTrigger(input)', 'const latched = studioStageTrigger(input)')
libMutant('arms on any landing (not only fresh)', "const fresh = input.landing === true && !input.historyLoading && !input.resumed && (input.userMessages || []).length === 0", 'const fresh = input.landing === true')
libMutant('resumed does not disarm', 'const armed = input.resumed ? false : next.armed || fresh', 'const armed = next.armed || fresh')
libMutant('no reset on a new session', "else next = { key, armed: false, latched: null }", "else next = { ...before, key }")
libMutant('ignores a workflow link, fullscreen and an inspector', "const override: StudioStageGateReason | null = input.workflow ? 'workflow' : input.fullscreen ? 'fullscreen' : input.inspector ? 'inspector' : null", "const override: StudioStageGateReason | null = null")
libMutant('Add Slide not a trigger', "  if (input.addSlideOpen) return 'add_slide'\n", '')
libMutant('authored slides (the outline) not a trigger', "  if (input.hasAuthoredDeck) return 'authored'\n", '')
libMutant('blank canvas not a trigger', "  if (input.blankChosen) return 'blank'\n", '')
libMutant('deck ready not a trigger', "  if (input.hasGeneratedDeck || input.hasOwnedFinal) return 'deck'\n", '')
libMutant('typed ask not a trigger', "  if ((input.userMessages || []).some(message => matchStageAsk(message?.text) !== null)) return 'typed'\n", '')
libMutant('props: attribute even when open', "  if (closed !== true) return {}\n", '')
const pageMutant = (label, from, to) => { const page = swap(PAGE_NOW, from, to); mutant(`page: ${label}`, () => { pageWiring(page); scenarioChecks({ page }) }) }
pageMutant('the attribute ignores restoring', '{...studioStageGateProps(studioStageGate.closed && !studioFirstRunRestoring)', '{...studioStageGateProps(studioStageGate.closed)')
pageMutant('the workflow link not passed', 'workflow: Boolean(viewerWorkflowRequest)', 'workflow: false')
pageMutant('the inspector not passed', 'inspector: workspaceLayout.inspectorVisible', 'inspector: false')
pageMutant('the user messages not passed', 'resumed: session.isResumedSession, userMessages: session.userMessages', 'resumed: session.isResumedSession, userMessages: []')
pageMutant('the phase not passed', "generatingFinal: isGeneratingFinal, phase: buildNarration.active ? buildNarration.phase : 'idle'", "generatingFinal: isGeneratingFinal, phase: 'idle'")
pageMutant('the resumed flag not passed', 'resumed: session.isResumedSession', 'resumed: false')
pageMutant('the session key fixed', 'sessionKey: currentSessionId || wsSessionId, landing: studioWelcome', "sessionKey: 'one', landing: studioWelcome")
pageMutant('the latch not written back', '  studioStageGateRef.current = studioStageGate.state // STUDIO-STAGE-OPEN-GATE', '  void studioStageGate // STUDIO-STAGE-OPEN-GATE')
pageMutant('enabled without FIRST_RUN_V2', "enabled: STUDIO_STAGE_OPEN_GATE_ENABLED && studioShell && process.env.NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 === 'true'", 'enabled: STUDIO_STAGE_OPEN_GATE_ENABLED && studioShell')
const cssMutant = (label, edit) => { const css = edit(CSS_NOW); assert.notEqual(css, CSS_NOW, `stylesheet mutant "${label}" changes nothing`); mutant(`stylesheet: ${label}`, () => { const rules = cssRules(css); cssChecks(css); scenarioChecks({ rules }) }) }
cssMutant('the welcome guard dropped (the gate rules also restyle the first-run welcome)', css => css.split('\n').map(line => STAGE_OPEN_GATE_MARKER_RE.test(line) ? line.replace(':not(:has([data-studio-workspace-drawer="deck"] [data-studio-first-run]))', '') : line).join('\n'))
cssMutant('the stage-hiding rule dropped', css => css.split('\n').filter(line => !(STAGE_OPEN_GATE_MARKER_RE.test(line) && line.includes('{ visibility: hidden; }'))).join('\n'))
cssMutant('the chat-width rule dropped', css => css.split('\n').filter(line => !(STAGE_OPEN_GATE_MARKER_RE.test(line) && line.includes('width: 100% !important'))).join('\n'))
cssMutant('the column not centred', css => css.split('\n').filter(line => !(STAGE_OPEN_GATE_MARKER_RE.test(line) && line.includes('align-items: center'))).join('\n'))
cssMutant('keyed to a different attribute value', css => css.split('\n').map(line => STAGE_OPEN_GATE_MARKER_RE.test(line) ? line.replace(/\[data-studio-stage-gate="closed"\]\)/g, '[data-studio-stage-gate="shut"])') : line).join('\n'))
mutant('stylesheet: a gate rule without the attribute (would apply flag off)', () => {
  const css = CSS_NOW.replace('/* PASS2D W', '[data-studio-v4-shell="true"] [data-studio-v4-shell-workspace]:has([data-studio-workspace-drawer="deck"][data-studio-workspace-visible="true"]):not(:has([data-studio-workspace-drawer="deck"] [data-studio-first-run])) [data-studio-v4-shell-presentation] { visibility: hidden; } /* STUDIO-STAGE-OPEN-GATE */\n/* PASS2D W')
  const rules = cssRules(css)
  for (const [name, steps] of Object.entries(OFF_SCENARIOS())) assert.equal(viewDigest(runScenario(steps, { libs: OFF, env: OFF_ENV, rules })), viewDigest(runScenario(steps, { page: PAGE_BASE, libs: OFF, env: OFF_ENV, rules: RULES_BASE })), name)
})

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed (offline: the real lib, the page's own statements, the real stylesheet, recorded Director frames)`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
