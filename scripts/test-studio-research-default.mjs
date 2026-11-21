// KNOWLEDGE-3 for FRONTEND-1: proof of the Research default. Flags NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON and NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE, each the exact string "true", each default off.
// On a new chat, or a chat with no outline yet, web search starts on for paid plans (starter, pro, premium); free plans only when NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE is also on. A chat that already has an outline opens with web search off, as before. Deep research is unchanged.
// (One marked effect in the Builder page, once per chat, when the plan is known and the chat has loaded; the pure helper researchDefaultFor(plan, { on, free }) in lib/studio-research-default.ts holds the plan rule. Off, the page behaves as dev's.)
//
//   node scripts/test-studio-research-default.mjs        (plain node, offline: the REAL sources transpiled and run in a vm; the page's effect, its two switch handlers and its state lines are cut out of the real file and RUN, with the effect re-run exactly when its real dependency
//                                                        array changes; git is read for the strip, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to H), then mutants (I):
//  A. the lib: each flag is on for the exact string "true" and for nothing else, one literal env read each, the pure helper researchDefaultFor(plan, { on, free }) for every plan (paid on; free only with FREE; unknown, null and anything else off; ON off: everyone off, the FREE flag alone does nothing);
//  B. the page's first state and its new-chat reset are the base's again (the default is decided by the one effect);
//  B2. the default, by the real effect over a page view as a run of events (a chat opened with or without its outline, + New chat, the plan arriving late or changing, the person's own switch, the outline appearing in this page view, Director's late latch): every run of up to three events
//      (four with the flag on) from every flag combination and plan equals the spec written in words: paid + a new chat on; free off; free + FREE on; unknown plan off; an outlined chat off; a person's switch change (seen by the effect before it decides) not overridden when the plan arrives late; FREE alone off; a new chat that
//      builds its first outline in this view is not flipped off; flag off, the page behaves as dev's, event for event;
//  B3. the effect's text: keyed on the session id, the plan, hasStrawman, the end of loading and the switch's own value; returns first with the flag off; sees the person's change before it decides; decided once per chat before anything is set; the only marked writer of web search; every other writer is the base's;
//  C. only insertions: no base line of the page is rewritten (the strip gives dev's page byte for byte; thirteen pure insertions, one per line, each carrying the marker RESEARCH-DEFAULT, in two places);
//  C2. the older proofs: two get one splice line each (the first-parent line carries this change's commits); the four the first commit taught are dev's, byte for byte;
//  D. deep research, the new-deck handoff (:6851, not a restore), the session-restore wrapper, the session hook, the two switch handlers, the hook and the composer are the base's;
//  E. .env.example: one block per flag, both at the end, "false", dev's file plus those blocks, each saying what the flags do in the words FRONTEND-1 gave;
//  F. the registry: exactly three lines, each marked LATER-CHANGE, in the three lists (the files after the uat marketing-v4 line, the other two at the true end), the strip independent of the neighbouring changes' strips;
//  G. own-commit scope, by the subject prefix "Research default:" on the first-parent line (and, once the gate has merged it, over the whole range), the commit message, and a secret scan;
//  H. each flag is read from one literal env name and nothing but the lib reads it.
//  I. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as stripModule from './studio-research-default-strip.mjs'
import * as replacePictureStrip from './studio-replace-picture-strip.mjs'
import * as registry from './studio-later-changes.mjs'
import { stripResearchByLevel, RESEARCH_BY_LEVEL_FILES } from './studio-research-by-level-strip.mjs' // LATER-CHANGES: registry read (RESEARCH-BY-LEVEL): the research-by-level change (stacked after this change) marks lines in the Builder page, a second writer and reader of web search; this proof reads the page as this change left it

const { BASE_COMMIT, RESEARCH_DEFAULT_PIN_FILES: PIN_FILES, RESEARCH_DEFAULT_PIN_MARK: PIN_MARK, RESEARCH_DEFAULT_PIN_EDITS: PIN_EDITS, RESEARCH_DEFAULT_SCOPE_FILES: SCOPE, RESEARCH_DEFAULT_NEW_FILES: NEW_FILES, RESEARCH_DEFAULT_FILES: APP_FILES, RESEARCH_DEFAULT_MARKER_RE: MARKER_RE, RESEARCH_DEFAULT_ENV_BLOCK: ENV_BLOCK, RESEARCH_DEFAULT_SUBJECT: SUBJECT, RESEARCH_DEFAULT_EDITS: EDITS, RESEARCH_DEFAULT_FLAGS: FLAGS } = stripModule
const STRIP_FN = stripModule.stripResearchDefault
const [FLAG_ON, FLAG_FREE] = FLAGS

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && RESEARCH_BY_LEVEL_FILES.includes(rel) ? stripResearchByLevel(rel, out) : out } } // LATER-CHANGES: registry read (RESEARCH-BY-LEVEL): every read of a file the research-by-level change marks goes through that change's own strip (never the registry), so this proof sees the file as this change left it
const nodeRequire = createRequire(path.join(root, 'package.json'))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 700)}`) }
}
let caught = 0
const missed = []
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}${process.env.SHOW_CAUGHT ? ` :: ${String(error?.message ?? error).split('\n')[0].slice(0, 150)}` : ''}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

const LIB = 'lib/studio-research-default.ts', PAGE = 'app/builder/page.tsx', HOOK = 'hooks/use-deckster-websocket-v2.ts', CLEAN = 'components/builder/chat/studio-chat-clean.tsx', REGISTRY = 'scripts/studio-later-changes.mjs', ENV = '.env.example'
/** What the flags do, in the words FRONTEND-1 gave: in the lib's comment and in both .env.example blocks. */
const SENTENCE = 'On a new chat, or a chat with no outline yet, web search starts on for paid plans (starter, pro, premium); free plans only when NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE is also on. A chat that already has an outline opens with web search off, as before. Deep research is unchanged.'
const compile = (file, text) => ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
function load(rel, { env = {}, texts = {} } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), { module, exports: module.exports, require: spec => nodeRequire(spec), process: { env: { ...env } } }, { filename: rel })
  return module.exports
}
const lineWith = (text, needle) => { const hits = text.split('\n').filter(line => line.includes(needle)); assert.equal(hits.length, 1, `exactly one line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] }
const lineIs = (text, line) => { const hits = text.split('\n').filter(l => l === line); assert.equal(hits.length, 1, `exactly one line is ${JSON.stringify(line.slice(0, 90))} (found ${hits.length})`); return hits[0] }
function runFragment(code, names) {
  const source = `(function (${names.join(', ')}) {\n${code}\n})`
  const js = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  const errors = (js.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `the lines parse: ${errors[0] ? ts.flattenDiagnosticMessageText(errors[0].messageText, ' ') : ''}`)
  return vm.runInNewContext(js.outputText, { setTimeout: () => assert.fail('a line scheduled a timer'), setInterval: () => assert.fail('a line scheduled an interval'), queueMicrotask: () => assert.fail('a line queued a microtask') })
}
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/

const ENV_BOTH = { [FLAG_ON]: 'true', [FLAG_FREE]: 'true' }

// ============================================================================================================================================
// A. the lib: two flags, one literal read each, and the pure helper
// ============================================================================================================================================
const PAID = ['starter', 'pro', 'premium']
/** The spec of the helper, written out (independent of the lib's text): what a plan gets for the two flags. */
const defaultSpec = (plan, on, free) => on === true && (PAID.includes(plan) || (plan === 'free' && free === true))
const HELPER_PLANS = ['starter', 'pro', 'premium', 'free', null, undefined, '', 'Pro', 'PRO', ' pro', 'enterprise', 'team', 'trial', 'paid', 'unknown', 5, {}]
const LIB_BODY = [
  "export const STUDIO_RESEARCH_DEFAULT_ON = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'",
  "export const STUDIO_RESEARCH_DEFAULT_FREE = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE === 'true'",
  'export function researchDefaultFor(plan: string | null | undefined, flags: { on: boolean; free: boolean }): boolean {',
  '  if (flags.on !== true) return false',
  "  if (plan === 'starter' || plan === 'pro' || plan === 'premium') return true",
  "  if (plan === 'free') return flags.free === true",
  '  return false',
  '}',
]
function libChecks(texts = {}) {
  const text = texts[LIB] ?? read(LIB)
  const NOT_TRUE = [undefined, '', 'false', 'True', 'TRUE', '1', ' true', 'true ', 'yes', 'on']
  for (const [flag, constant, other] of [[FLAG_ON, 'STUDIO_RESEARCH_DEFAULT_ON', FLAG_FREE], [FLAG_FREE, 'STUDIO_RESEARCH_DEFAULT_FREE', FLAG_ON]]) {
    for (const value of NOT_TRUE) assert.equal(load(LIB, { env: value === undefined ? {} : { [flag]: value }, texts })[constant], false, `${flag}=${JSON.stringify(value)}: off`)
    assert.equal(load(LIB, { env: { [flag]: 'true' }, texts })[constant], true, `${flag}: exactly "true" is on`)
    assert.equal(load(LIB, { env: { [other]: 'true' }, texts })[constant], false, `${flag} does not follow ${other}`)
    assert.equal((text.match(new RegExp(`process\\.env\\.${flag}\\b`, 'g')) || []).length, 1, `the literal env name ${flag} is read once (so Next inlines it)`)
  }
  assert.equal((text.match(/process\.env/g) || []).length, 2, 'two env reads in all, one per flag, and none in the helper')
  assert.deepEqual(Object.keys(load(LIB, { env: ENV_BOTH, texts })).sort(), ['STUDIO_RESEARCH_DEFAULT_FREE', 'STUDIO_RESEARCH_DEFAULT_ON', 'researchDefaultFor'], 'the lib exports the two constants and the one helper')
  const helper = load(LIB, { env: {}, texts }).researchDefaultFor // run with NO env: it decides from its arguments alone
  for (const plan of HELPER_PLANS) for (const on of [true, false]) for (const free of [true, false]) assert.equal(helper(plan, { on, free }), defaultSpec(plan, on, free), `researchDefaultFor(${JSON.stringify(plan)}, on ${on}, free ${free})`)
  for (const on of [1, 'true', null, undefined]) assert.equal(helper('pro', { on, free: true }), false, `a flag that is not the boolean true is off (${JSON.stringify(on)})`)
  assert.equal(load(LIB, { env: ENV_BOTH, texts }).researchDefaultFor('free', { on: false, free: true }), false, 'the helper decides from its arguments, not from the environment')
  assert.equal(helper('free', { on: false, free: true }), false, 'the FREE flag alone (ON off): free is off')
  assert.equal(helper('pro', { on: false, free: true }), false, 'and paid is off too')
  assert.deepEqual([...text.matchAll(/^\s*(import|require)\b.*$/gm)].map(m => m[0]), [], 'the lib imports nothing')
  assert.deepEqual(text.split('\n').filter(line => line.trim() !== '' && !line.trim().startsWith('//') && !line.trim().startsWith('/**')), LIB_BODY, 'nothing in the lib but comments, the two constants and the helper')
  assert.ok(text.includes(SENTENCE), 'the lib\'s comment says what the flags do (the words FRONTEND-1 gave)')
  assert.doesNotMatch(text, /a reopened chat keeps the value it was saved with/, 'and no longer says a reopened chat keeps its saved value (nothing restores it)')
}

// ============================================================================================================================================
// B. the page's first state and its new-chat reset are the base's again (the default is decided by one effect)
// ============================================================================================================================================
const FIRST_RESEARCH = '  const [researchEnabled, setResearchEnabled] = useState(false)'
const FIRST_WEB = '  const [webSearchEnabled, setWebSearchEnabled] = useState(false)'
/** The page's first two state lines (deep research, web search), run with a stand-in useState: what each starts as. */
function firstState(page) {
  const lines = page.split('\n'), at = lines.indexOf(FIRST_RESEARCH)
  assert.ok(at >= 0 && lines.indexOf(FIRST_RESEARCH, at + 1) === -1, 'the deep research state is where the base has it, once')
  assert.ok(lines[at + 1].startsWith('  const [webSearchEnabled, setWebSearchEnabled] = useState('), 'the web search state is the line right after it')
  return JSON.parse(JSON.stringify(runFragment(`${lines[at]}\n${lines[at + 1]}\nreturn { researchEnabled, webSearchEnabled }`, ['useState', 'STUDIO_RESEARCH_DEFAULT_ON'])(initial => [initial, () => {}], true))) // out of the vm's realm
}
/** The new-chat reset's four lines (deep research, web search, extended generation, knowledge graph), run with recording setters. */
function resetCalls(page) {
  const lines = page.split('\n'), at = lines.indexOf('    setResearchEnabled(false)')
  assert.ok(at >= 0 && lines.indexOf('    setResearchEnabled(false)', at + 1) === -1, 'the new-chat reset starts with the base\'s deep research line, once')
  assert.ok(lines[at + 1] === '    setWebSearchEnabled(false)' && lines[at + 2] === '    setExtendedGenerationEnabled(true)' && lines[at + 3] === '    setKnowledgeGraphEnabled(false)', 'the reset is the base\'s four lines in the base\'s order')
  const calls = [], rec = name => value => { calls.push([name, value]) }
  runFragment(lines.slice(at, at + 4).join('\n'), ['setResearchEnabled', 'setWebSearchEnabled', 'setExtendedGenerationEnabled', 'setKnowledgeGraphEnabled'])(rec('deep'), rec('web'), rec('extended'), rec('graph'))
  return calls
}
function pageBaseLineChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE)
  assert.equal(lineIs(page, FIRST_WEB), FIRST_WEB, 'the first state of web search is the base\'s line: off, whatever the flag')
  assert.deepEqual(firstState(page), { researchEnabled: false, webSearchEnabled: false }, 'a page starts with both off (the effect decides after the first render)')
  assert.deepEqual(firstState(page), firstState(base), 'the first state is the base\'s, value for value')
  assert.deepEqual(resetCalls(page), [['deep', false], ['web', false], ['extended', true], ['graph', false]], 'the new-chat reset is the base\'s: both off (the effect decides for the new chat)')
  assert.deepEqual(resetCalls(page), resetCalls(base), 'the reset is the base\'s, call for call')
}

// ============================================================================================================================================
// B2. the default, decided by the page's real effect: a page view as a run of events
// ============================================================================================================================================
// The effect, the two switch handlers and the page's first state are cut out of the real page and RUN over stand-ins, with the effect re-run exactly when its real dependency array changes (the real array text is evaluated). The page's view is a small machine: a first
// render, a chat opened (the id changes while the chat loads, then the restore and the end of loading commit together), a new chat (the base's reset, a new id, in one render), the plan arriving or changing, the person's own switch changes (through the real handlers, a state change that re-renders), the outline
// appearing in this page view (the latch, or the strawman/final deck state), Director's late latch. The spec below is written independently, in words.
const EFFECT_START = '  useEffect(() => { // RESEARCH-DEFAULT'
const EFFECT_END_PREFIX = '  }, ['
const EFFECT_NAMES = ['STUDIO_RESEARCH_DEFAULT_ON', 'STUDIO_RESEARCH_DEFAULT_FREE', 'researchDefaultFor', 'researchChatRef', 'setWebSearchEnabled', 'setResearchEnabled', 'currentSessionId', 'agentPlan', 'session', 'hasStrawman', 'strawmanPreviewUrl', 'strawmanPresentationId', 'finalPresentationUrl', 'finalPresentationId', 'webSearchEnabled']
const HANDLER_NAMES = { web: '  const handleWebSearchEnabledChange = useCallback((enabled: boolean) => {', deep: '  const handleResearchEnabledChange = useCallback((enabled: boolean) => {' }
const fragments = new Map() // keyed by the page's text (a string's hash is computed once, so a look-up costs nothing)
function effectOf(page) {
  if (!fragments.has(page)) {
    const lines = page.split('\n'), starts = lines.map((line, i) => line.startsWith(EFFECT_START) ? i : -1).filter(i => i >= 0)
    if (starts.length === 0) fragments.set(page, null) // dev's page: no effect
    else {
      assert.equal(starts.length, 1, 'one marked effect in the page')
      const start = starts[0], end = lines.findIndex((line, i) => i > start && line.startsWith(EFFECT_END_PREFIX))
      assert.ok(end > start, 'the effect ends with its dependency array')
      const depsText = lines[end].slice(lines[end].indexOf('['), lines[end].lastIndexOf(']') + 1)
      fragments.set(page, { start, end, depsText, effect: runFragment(['const effect = (() => {', ...lines.slice(start + 1, end), '})', 'return effect'].join('\n'), EFFECT_NAMES), deps: runFragment(`return () => (${depsText})`, EFFECT_NAMES) })
    }
  }
  return fragments.get(page)
}
function handlerOf(page, which) {
  const key = `${which}\n${page}`
  if (!fragments.has(key)) {
    const lines = page.split('\n'), start = lines.indexOf(HANDLER_NAMES[which])
    assert.ok(start >= 0 && lines.indexOf(HANDLER_NAMES[which], start + 1) === -1, `the ${which} switch handler is where the base has it, once`)
    const end = lines.findIndex((line, i) => i > start && line === '  }, [])')
    fragments.set(key, runFragment(['const handle = ((enabled: boolean) => {', ...lines.slice(start + 1, end), '})', 'return handle'].join('\n'), ['setResearchEnabled', 'setWebSearchEnabled']))
  }
  return fragments.get(key)
}
const libs = new Map()
const libOf = (on, free, texts) => { const key = JSON.stringify([on, free, texts[LIB] ?? null]); if (!libs.has(key)) libs.set(key, load(LIB, { env: { ...(on ? { [FLAG_ON]: 'true' } : {}), ...(free ? { [FLAG_FREE]: 'true' } : {}) }, texts })); return libs.get(key) }
const stateCache = new Map()
const baseOf = page => { if (!stateCache.has(page)) stateCache.set(page, { base: firstState(page), reset: resetCalls(page) }); return stateCache.get(page) } // the page's first state and its reset, run once per page text
const EVIDENCE = { strawmanUrl: { strawmanPreviewUrl: 'https://layout.example/p/1' }, strawmanId: { strawmanPresentationId: 'p1' }, finalUrl: { finalPresentationUrl: 'https://layout.example/p/2' }, finalId: { finalPresentationId: 'p2' }, latch: { hasStrawman: true }, all: { hasStrawman: true, strawmanPreviewUrl: 'https://layout.example/p/1', strawmanPresentationId: 'p1', finalPresentationUrl: 'https://layout.example/p/2', finalPresentationId: 'p2' } }
const NO_EVIDENCE = { hasStrawman: false, strawmanPreviewUrl: null, strawmanPresentationId: null, finalPresentationUrl: null, finalPresentationId: null }
/** One page view over the real lines. `page` may be dev's page (no effect: the base's view). `texts` carries a mutated lib, if any. React's batching is modelled: the setters mark a re-render; the effect runs after a render exactly when its real dependency array changed. */
function pageMachine(page, { on, free, plan0, firstId = 'c0' }, texts = {}) {
  const lib = libOf(on, free, texts), effect = effectOf(page), { base, reset } = baseOf(page)
  const flagOn = lib.STUDIO_RESEARCH_DEFAULT_ON, flagFree = lib.STUDIO_RESEARCH_DEFAULT_FREE
  const ref = { current: { id: null, applied: false, touched: false, web: false } }
  const view = { sessionId: firstId, plan: plan0, loading: false, ...NO_EVIDENCE }
  let web = base.webSearchEnabled, deep = base.researchEnabled, prevDeps = null, chats = 0, dirty = false
  const setWeb = value => { if (value !== web) { web = value; dirty = true } }, setDeep = value => { deep = value }
  const args = () => [flagOn, flagFree, lib.researchDefaultFor, ref, setWeb, setDeep, view.sessionId, view.plan, { isLoadingSession: view.loading }, view.hasStrawman, view.strawmanPreviewUrl, view.strawmanPresentationId, view.finalPresentationUrl, view.finalPresentationId, web]
  const render = patch => { // a render: the effect runs after it when (and only when) its dependency array changed
    Object.assign(view, patch); dirty = false
    if (!effect) return
    const deps = effect.deps(...args())()
    if (prevDeps === null || deps.length !== prevDeps.length || deps.some((dep, i) => !Object.is(dep, prevDeps[i]))) { prevDeps = deps; effect.effect(...args())() }
  }
  const commit = patch => { render(patch); for (let n = 0; dirty; n++) { assert.ok(n < 8, 'the effect does not settle: it keeps changing web search'); render({}) } } // a state change made by the effect re-renders
  const handle = (which, value) => { handlerOf(page, which)(setDeep, setWeb)(value); if (dirty) commit({}) }
  commit({})
  return {
    get web() { return web }, get deep() { return deep }, get view() { return view },
    do([kind, arg]) {
      if (kind === 'load') { commit({ sessionId: `c${++chats}`, loading: true, ...NO_EVIDENCE }); commit({ loading: false, ...(EVIDENCE[arg === 'outlined' ? 'all' : arg] || {}) }) } // opening a chat: the id changes while it loads; the restore and the end of loading commit in one render
      else if (kind === 'newChat') { for (const [name, value] of reset) { if (name === 'web') setWeb(value); if (name === 'deep') setDeep(value) } commit({ sessionId: `c${++chats}`, loading: false, ...NO_EVIDENCE }) } // the base's reset and the new id land in one render
      else if (kind === 'plan') commit({ plan: arg })
      else if (kind === 'person') handle('web', arg)
      else if (kind === 'deep') handle('deep', arg)
      else if (kind === 'outline') commit(EVIDENCE.all) // the outline appears in this page view (the build)
      else if (kind === 'sync') commit(EVIDENCE.latch) // Director's late latch only
      else if (kind === 'firstId') commit({ sessionId: arg }) // the page's first chat gets its id
      else throw new Error(`unknown event ${kind}`)
      return this
    },
  }
}
/** The same events, in words (independent of the page's text): web search and deep research after them. */
function specView(events, { on, free, plan0, firstId = 'c0' }) {
  const dflt = plan => on && (PAID.includes(plan) || (plan === 'free' && free))
  let web = false, deep = false, plan = plan0, chat = { id: firstId, decided: false, touched: false, outlined: false }
  const decide = () => { // a chat's default is decided once: when the plan is known and the chat has an id and has loaded
    if (!on || plan === null || chat.id === null || chat.decided) return
    chat.decided = true
    if (chat.touched) return // the person's own change in this chat stands
    web = chat.outlined ? false : dflt(plan) // a chat with its outline gets off; any other chat the plan's default
  }
  const set = value => { if (value !== web) { web = value; if (!chat.decided) chat.touched = true } } // the switch changing in a chat before it is decided is the person's own change (a switch that is already at that value changes nothing)
  decide()
  for (const [kind, arg] of events) {
    if (kind === 'load') { chat = { id: 'x', decided: false, touched: false, outlined: arg !== 'none' }; decide() }
    else if (kind === 'newChat') { web = false; deep = false; chat = { id: 'x', decided: false, touched: false, outlined: false }; decide() } // the base's reset is not a change in the new chat
    else if (kind === 'plan') { plan = arg; decide() }
    else if (kind === 'person') { set(arg); if (!arg) deep = false }
    else if (kind === 'deep') { deep = arg; if (arg) set(true) }
    else if (kind === 'outline' || kind === 'sync') { chat.outlined = true; decide() } // after the chat is decided this changes nothing
    else if (kind === 'firstId') { chat.id = arg; decide() }
  }
  return { web, deep }
}
const VOCAB = [['load', 'outlined'], ['load', 'none'], ['newChat'], ['plan', 'pro'], ['plan', 'free'], ['plan', null], ['person', true], ['person', false], ['deep', true], ['outline'], ['sync']]
const sequenceCache = new Map()
const sequencesOf = (vocab, max) => { const key = `${vocab.length}:${max}`; if (!sequenceCache.has(key)) { const out = [[]]; let layer = [[]]; for (let n = 0; n < max; n++) { layer = layer.flatMap(prefix => vocab.map(event => [...prefix, event])); out.push(...layer) } sequenceCache.set(key, out) } return sequenceCache.get(key) }
const eventLabel = events => events.map(([kind, arg]) => arg === undefined ? kind : `${kind}:${arg}`).join(' > ') || '(a fresh page)'
const FLAG_COMBOS = { 'ON on, FREE off': [true, false], 'ON on, FREE on': [true, true], 'ON off, FREE off': [false, false], 'ON off, FREE on (FREE alone)': [false, true] } // the flag-on combinations first: a mutant of the effect is caught on the first runs
const PLANS0 = [null, 'free', 'starter', 'pro', 'premium']
function defaultChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE)
  // every run of up to three events, from every flag combination and every plan the page can start with: the page equals the spec, deep research included
  for (const [name, [on, free]] of Object.entries(FLAG_COMBOS)) for (const plan0 of PLANS0) for (const events of sequencesOf(VOCAB, 3)) {
    const run = events.reduce((m, event) => m.do(event), pageMachine(page, { on, free, plan0 }, texts)), want = specView(events, { on, free, plan0 })
    assert.deepEqual({ web: run.web, deep: run.deep }, want, `${name}, plan ${plan0}: ${eventLabel(events)}`)
  }
  // longer runs, for the flag on
  for (const [name, [on, free]] of Object.entries(FLAG_COMBOS).filter(([, [on]]) => on)) for (const plan0 of [null, 'pro', 'free']) for (const events of sequencesOf(VOCAB, 4).filter(events => events.length === 4)) {
    const run = events.reduce((m, event) => m.do(event), pageMachine(page, { on, free, plan0 }, texts))
    assert.deepEqual({ web: run.web, deep: run.deep }, specView(events, { on, free, plan0 }), `${name}, plan ${plan0}: ${eventLabel(events)}`)
  }
  // the named cases
  const view = (events, o = {}) => events.reduce((m, event) => m.do(event), pageMachine(page, { on: true, free: false, plan0: 'pro', ...o }, texts))
  const web = (events, o) => view(events, o).web
  for (const plan of PAID) assert.equal(web([], { plan0: plan }), true, `paid (${plan}) + a new chat: on`)
  assert.equal(web([], { plan0: 'free' }), false, 'free: off')
  assert.equal(web([], { plan0: 'free', free: true }), true, 'free + the FREE flag: on')
  assert.equal(web([], { plan0: null }), false, 'an unknown plan (null): off')
  assert.equal(web([['plan', null]], { plan0: 'pro' }), true, 'a plan that goes unknown after the chat was decided changes nothing')
  assert.equal(web([], { plan0: 'pro', on: false, free: true }), false, 'the FREE flag alone (ON off), paid: off')
  assert.equal(web([], { plan0: 'free', on: false, free: true }), false, 'the FREE flag alone (ON off), free: off')
  assert.equal(web([['plan', 'pro']], { plan0: null }), true, 'a paid plan that arrives after the first render: on')
  assert.equal(web([['plan', 'free']], { plan0: null }), false, 'a free plan that arrives late: off')
  assert.equal(web([['plan', 'free']], { plan0: null, free: true }), true, 'a free plan that arrives late, with the FREE flag: on')
  assert.equal(web([['newChat']]), true, 'paid + + New chat: on again')
  assert.equal(web([['load', 'none']]), true, 'a chat opened with no outline: on')
  assert.equal(web([['load', 'outlined']]), false, 'a chat opened with its outline: off (REVIEW-1\'s P2)')
  assert.equal(web([['load', 'outlined'], ['load', 'none']]), true, 'an outlined chat, then a chat with no outline: on again (nothing leaks from the one chat to the other)')
  assert.equal(web([['load', 'none'], ['load', 'outlined']]), false, 'a chat with no outline, then an outlined one: off')
  assert.equal(web([['outline']]), true, 'a new chat that gets its first outline in this page view (it built with research on) is NOT flipped off')
  assert.equal(web([['sync']]), true, 'nor by Director\'s latch alone')
  assert.equal(web([['load', 'none'], ['outline']]), true, 'a chat opened with no outline that then builds one keeps web search on')
  assert.equal(web([['load', 'none'], ['person', false], ['outline']]), false, 'a person\'s switch-off in a no-outline chat (the default is on, the switch is changed off) is not overridden when the outline appears')
  assert.equal(web([['load', 'none'], ['person', false], ['outline'], ['sync'], ['plan', 'pro']]), false, 'nor by anything after it')
  assert.equal(web([['person', true], ['person', false]], { plan0: null }), false, 'a switch turned on and off again before the plan is known stays off...')
  assert.equal(web([['person', true], ['person', false], ['plan', 'pro']], { plan0: null }), false, '...a manual switch-off in a no-outline chat is NOT overridden when the plan arrives late')
  assert.equal(web([['person', true], ['plan', 'free']], { plan0: null }), true, 'a switch-on made before a free plan arrives stands as well')
  assert.equal(web([['person', true], ['person', false], ['firstId', 'c0'], ['plan', 'pro']], { plan0: null, firstId: null }), false, 'a switch-off made before the page\'s first chat had an id is the first chat\'s (the id arriving after it, then the plan, do not undo it)')
  assert.equal(web([['firstId', 'c0'], ['person', true], ['person', false], ['plan', 'pro']], { plan0: null, firstId: null }), false, 'and an id that arrives first, then the switch changes, then the plan')
  assert.equal(web([['firstId', 'c0'], ['plan', 'pro']], { plan0: null, firstId: null }), true, 'a chat with no id yet is decided when it gets one')
  assert.equal(web([['deep', true]], { plan0: 'free' }), true, 'switching Deep research on turns web search on (the base\'s handler)')
  assert.equal(web([['deep', true], ['person', false], ['plan', 'pro']], { plan0: null }), false, 'Deep research on, then off (web search off with it), then the plan: not overridden')
  assert.equal(web([['person', false], ['load', 'none']]), true, 'a switch-off in one chat does not carry to the next chat: that chat gets the plan\'s default')
  assert.equal(web([['person', false], ['newChat']]), true, 'nor to a new chat')
  assert.equal(web([['plan', 'free'], ['plan', 'pro']], { plan0: 'free' }), false, 'once per chat: a plan that changes after the chat was decided changes nothing')
  for (const [name, evidence] of Object.entries(EVIDENCE).filter(([key]) => key !== 'all')) {
    assert.equal(web([['load', name]]), false, `a chat opened with only ${name} as its outline: off`)
    assert.equal(web([['plan', null], ['load', name], ['plan', 'pro']], { plan0: 'pro' }), false, `a chat opened with only ${name}, the plan arriving after the load: off`)
  }
  assert.equal(web([['sync'], ['plan', 'pro']], { plan0: null }), false, 'Director\'s latch before the plan is known: off when it arrives')
  // deep research is never touched by the default
  assert.equal(view([['load', 'none']]).deep, false, 'deep research stays off whatever the default does')
  assert.equal(view([['plan', 'pro'], ['newChat'], ['load', 'outlined']], { plan0: null }).deep, false, 'and after the opens and new chats')
  // flag off: dev's page, event for event, whatever the plan and FREE (the strip gives dev's text byte for byte: C)
  assert.equal(effectOf(base), null, 'dev\'s page has no effect')
  for (const plan0 of PLANS0) for (const free of [false, true]) for (const events of sequencesOf(VOCAB, 3)) {
    const ours = events.reduce((m, event) => m.do(event), pageMachine(page, { on: false, free, plan0 }, texts)), dev = events.reduce((m, event) => m.do(event), pageMachine(base, { on: false, free, plan0 }))
    assert.deepEqual({ web: ours.web, deep: ours.deep }, { web: dev.web, deep: dev.deep }, `ON off, FREE ${free}, plan ${plan0}: ${eventLabel(events)}: the page behaves as dev's`)
  }
}

// ============================================================================================================================================
// B3. the effect's text: what it is keyed on, where it sits, what else writes web search
// ============================================================================================================================================
const DEPS_NOW = '[currentSessionId, agentPlan, hasStrawman, session.isLoadingSession, webSearchEnabled]'
function writersChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE), lines = page.split('\n')
  const effect = effectOf(page)
  assert.ok(effect, 'the page has the marked effect')
  assert.equal(effect.depsText, DEPS_NOW, 'the effect is keyed on the session id, the plan, hasStrawman, the end of loading and the switch\'s own value (a re-run decides nothing for a chat already decided)')
  assert.equal(lines.filter(line => /\buseEffect\(/.test(line) && MARKER_RE.test(line)).length, 1, 'one marked effect')
  assert.ok(lines[effect.start + 1].startsWith('    if (!STUDIO_RESEARCH_DEFAULT_ON) return'), 'the effect returns first when the flag is off: flag off, nothing in it runs')
  assert.ok(page.indexOf(EFFECT_START) > page.indexOf('  const session = useBuilderSession({'), 'the effect sits after the session hook (it reads session.isLoadingSession)')
  const writers = text => text.split('\n').map((line, index) => ({ line, index })).filter(({ line }) => /\bsetWebSearchEnabled\(/.test(line))
  const mine = writers(page).filter(({ line }) => MARKER_RE.test(line)), others = writers(page).filter(({ line }) => !MARKER_RE.test(line))
  assert.deepEqual(others.map(({ line }) => line), writers(base).map(({ line }) => line), 'every other line that sets web search is the base\'s: the two switch handlers, the new-deck handoff and the new-chat reset')
  assert.equal(mine.length, 1, 'this change sets web search in one place: the effect')
  assert.ok(mine[0].index > effect.start && mine[0].index < effect.end, 'and it is inside the effect')
  assert.ok(mine[0].line.includes('researchDefaultFor(agentPlan, { on: STUDIO_RESEARCH_DEFAULT_ON, free: STUDIO_RESEARCH_DEFAULT_FREE })'), 'the value is the helper\'s default for the plan with the two flags')
  const body = lines.slice(effect.start + 1, effect.end), at = needle => body.findIndex(line => line.includes(needle))
  assert.ok(at('chat.applied = true') > 0 && at('chat.applied = true') < at('if (chat.touched) return') && at('if (chat.touched) return') < at('setWebSearchEnabled('), 'the chat is marked decided, and the person\'s change checked, before anything is set')
  assert.ok(body.some(line => /if \(!currentSessionId \|\| agentPlan === null \|\| session\.isLoadingSession \|\| chat\.applied\) return/.test(line)), 'it waits for a chat id, the plan and the end of loading, and decides a chat once')
  assert.ok(at('webSearchEnabled !== chat.web && !chat.applied') > 0 && at('webSearchEnabled !== chat.web && !chat.applied') < at('if (!currentSessionId'), 'a change of the switch before the chat is decided is seen first (the person\'s own change)')
  assert.doesNotMatch(body.join('\n'), /setResearchEnabled|useState/, 'it does not set deep research')
  assert.equal(lines.filter(line => /\bresearchChatRef\b/.test(line) && !MARKER_RE.test(line)).length, 0, 'the per-chat ref is named on marked lines only')
  assert.equal(lines.filter(line => /\bSTUDIO_RESEARCH_DEFAULT_ON\b|\bSTUDIO_RESEARCH_DEFAULT_FREE\b|\bresearchDefaultFor\b/.test(line) && !MARKER_RE.test(line)).length, 0, 'the lib\'s names are used on marked lines only')
  assert.equal(lines.filter(line => MARKER_RE.test(line)).length, 13, 'thirteen marked lines in the page: the import, the ref and eleven in the effect')
  assert.equal(lines.filter(line => /\bSTUDIO_RESEARCH_DEFAULT_FREE\b/.test(line)).length, 2, 'FREE is named twice: the import and the effect\'s one use')
}

// ============================================================================================================================================
// C. only insertions: the strip gives dev's page byte for byte
// ============================================================================================================================================
function pageDiffChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE)
  const out = STRIP_FN(PAGE, laterOnly(PAGE, page))
  assert.equal(out, base, `${PAGE}: without this change's lines (and any later change's) the page is dev's, byte for byte`)
  assert.equal(STRIP_FN(PAGE, out), out, `${PAGE}: stripping twice changes nothing more`)
  assert.notEqual(laterOnly(PAGE, page), base, `${PAGE}: the change is there to strip`)
  const mine = laterOnly(PAGE, page), diff = lineDiff(base, mine)
  assert.deepEqual(diff.removed, [], 'no base line is rewritten or lost: every change to the page is a pure insertion')
  assert.equal(EDITS[PAGE].filter(([, was]) => was !== '').length, 0, 'every pair of the strip is an insertion (its `was` is empty)')
  assert.equal(EDITS[PAGE].length, 13, 'thirteen insertions, one per marked line (the older proofs that count a peer\'s lines read them one at a time)')
  assert.ok(EDITS[PAGE].every(([has]) => has.endsWith('\n') && has.split('\n').length === 2), 'each is one whole line')
  for (const line of diff.added) assert.match(line, MARKER_RE, `a line added to the page carries the marker: ${line.trim().slice(0, 100)}`)
  assert.deepEqual(diff.added.sort(), EDITS[PAGE].flatMap(([has]) => has.split('\n').filter(Boolean)).sort(), 'the lines added to the page are exactly the strip\'s')
  assert.equal(diff.added.length, 13, 'thirteen lines added in all')
  assert.equal(lineWith(mine, "from '@/lib/studio-research-default'"), "import { STUDIO_RESEARCH_DEFAULT_FREE, STUDIO_RESEARCH_DEFAULT_ON, researchDefaultFor } from '@/lib/studio-research-default' // RESEARCH-DEFAULT", 'the import is the lib\'s two constants and the helper')
  for (const rel of APP_FILES) assert.equal(STRIP_FN(rel, 'x\nRESEARCH-DEFAULT\n'), 'x\nRESEARCH-DEFAULT\n', 'a text with no edit in it comes back as it is')
  for (const rel of ['hooks/use-deckster-websocket-v2.ts', 'hooks/use-builder-session.ts', 'components/builder/chat/studio-chat-clean.tsx', ENV, REGISTRY]) assert.equal(STRIP_FN(rel, 'x\nRESEARCH-DEFAULT\n'), 'x\nRESEARCH-DEFAULT\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(STRIP_FN(PAGE, 5), 5, 'a text that is not a string comes back as it is')
}
/** What a later change's strips (those registered after this one) leave of a file, so that the check sees this change's lines and the base's others. */
const laterOnly = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }

// ============================================================================================================================================
// C2. the older proofs: two get one line (the subject splice); the other four are dev's, byte for byte
// ============================================================================================================================================
// The Builder page change is a pure insertion now (no base line is rewritten), so the four older proofs that the first commit taught (the read hook, the diff helper) need nothing: the registry's strips and the marker already cover it. The two that read the first-parent line of
// BASE..HEAD still meet this change's own commits there, so each drops this change's subject from it, as for every later change.
const PIN_GAINS = { 'scripts/test-studio-chat-element-edit.mjs': 1, 'scripts/test-studio-deck-sync-truth.mjs': 1 }
const UNTAUGHT = ['scripts/test-studio-job-ledger.mjs', 'scripts/test-studio-new-deck-handoff-send.mjs', 'scripts/test-studio-chat-element-refine.mjs', 'scripts/test-studio-billing-f5-usage.mjs']
function pinChecks(texts = {}, mod = stripModule) {
  const strip = mod.stripResearchDefault, pinFiles = mod.RESEARCH_DEFAULT_PIN_FILES
  assert.deepEqual([...pinFiles].sort(), Object.keys(PIN_GAINS).sort(), 'the older proofs this change teaches: the two that read the first-parent line')
  for (const [rel, gained] of Object.entries(PIN_GAINS)) {
    const now = laterOnly(rel, texts[rel] ?? read(rel)), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's line the proof is dev's, byte for byte`)
    assert.equal(strip(rel, strip(rel, now)), strip(rel, now), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, gained], `${rel}: the proof gains ${gained} marked line and loses none`)
    for (const line of diff.added) assert.ok(line.includes(mod.RESEARCH_DEFAULT_PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
    for (const line of diff.added) assert.ok(line.includes('shas.splice') && line.includes('^Research default:') && !line.includes('Research switch') && !line.includes('Replace picture'), `${rel}: the line is a splice that names this change's own subject, and only that`)
  }
  assert.equal(Object.values(mod.RESEARCH_DEFAULT_PIN_EDITS).flat().every(([, was]) => was === ''), true, 'every pin edit is a pure insertion')
  for (const rel of UNTAUGHT) assert.equal(laterOnly(rel, texts[rel] ?? read(rel)), baseText(rel), `${rel} is dev's file, byte for byte (nothing to teach it: the page change is a pure insertion)`)
}

// ============================================================================================================================================
// D. deep research, the new-deck handoff, the restore, the hook and the composer are untouched
// ============================================================================================================================================
function untouchedChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE)
  // deep research: its first state, its reset, and every line that sets or reads it
  assert.equal(lineIs(page, FIRST_RESEARCH), FIRST_RESEARCH, 'deep research starts false')
  assert.equal(lineIs(page, '    setResearchEnabled(false)'), '    setResearchEnabled(false)', 'deep research is reset to false')
  assert.equal(page.split('\n').filter(l => /\bsetResearchEnabled\(/.test(l)).join('\n'), base.split('\n').filter(l => /\bsetResearchEnabled\(/.test(l)).join('\n'), 'every line that sets deep research is the base\'s')
  assert.equal(page.split('\n').filter(l => /\bresearchEnabled\b/.test(l) && !/webSearchEnabled/.test(l)).join('\n'), base.split('\n').filter(l => /\bresearchEnabled\b/.test(l) && !/webSearchEnabled/.test(l)).join('\n'), 'every line that reads deep research alone is the base\'s')
  // the two switch handlers: the base's lines, untouched (the effect sees the switch change; nothing is added inside them)
  const handlerLines = (text, which) => { const lines = text.split('\n'), start = lines.indexOf(HANDLER_NAMES[which]); assert.ok(start > 0, `the ${which} handler is where the base has it`); return lines.slice(start, lines.findIndex((l, i) => i > start && l === '  }, [])') + 1) }
  for (const which of ['web', 'deep']) assert.deepEqual(handlerLines(page, which), handlerLines(base, which), `the ${which} handler is the base's lines`)
  // the new-deck handoff (the lines after `setSessionStoreName(pending.store_name)`): it sets the switches from the handed-off request, whatever the flags. It is NOT a restore of an opened chat: nothing restores a chat's web search
  assert.equal(lineIs(page, '    setResearchEnabled(pending.deep_research)'), '    setResearchEnabled(pending.deep_research)', 'the new-deck handoff sets deep research from the handed-off request')
  assert.equal(lineIs(page, '    setWebSearchEnabled(pending.web_search || pending.deep_research)'), '    setWebSearchEnabled(pending.web_search || pending.deep_research)', 'the new-deck handoff sets web search from the handed-off request, the flags are not in it')
  assert.equal(lineIs(page, '    setExtendedGenerationEnabled(pending.extended_generation)'), '    setExtendedGenerationEnabled(pending.extended_generation)', 'and the line after it is the base\'s')
  // the session-restore wrapper and the session hook: the base's, byte for byte
  const wrapperText = text => { const lines = text.split('\n'), start = lines.indexOf('  const restoreBuilderSessionMessages = useCallback(('), end = lines.findIndex((l, i) => i > start && l.startsWith('  }, [studioShell, studioHandoffRestoreOwner')); assert.ok(start > 0 && end > start, 'the restore wrapper is where the base has it'); return lines.slice(start, end + 1).join('\n') }
  assert.equal(wrapperText(page), wrapperText(base), 'the session-restore wrapper is the base\'s lines (nothing is set when a chat is opened: the effect decides after the load)')
  assert.equal(laterOnly('hooks/use-builder-session.ts', texts['hooks/use-builder-session.ts'] ?? read('hooks/use-builder-session.ts')), baseText('hooks/use-builder-session.ts'), 'the session hook is the base\'s file')
  // every other line that reads web search is the base's: the build message still carries web_search on every send
  const reads = text => text.split('\n').filter(l => /\bwebSearchEnabled\b/.test(l) && !MARKER_RE.test(l)).join('\n') // the effect's own (marked) lines read it too
  assert.equal(reads(page), reads(base), 'every other line that reads web search is the base\'s')
  // the hook and the composer: nothing (web_search already goes out on every build message)
  for (const rel of [HOOK, CLEAN]) assert.equal(laterOnly(rel, texts[rel] ?? read(rel)), baseText(rel), `${rel} is the base's file, byte for byte (nothing in the hook, nothing in the composer)`)
  assert.ok((texts[HOOK] ?? read(HOOK)).includes('web_search: webSearch,'), 'the hook already sends web_search')
}

// ============================================================================================================================================
// E. .env.example: one block per flag
// ============================================================================================================================================
/** .env.example without the blocks registered after this one (a later change's block sits below this one's). */
const laterEnv = text => { const blocks = registry.LATER_ENV_BLOCKS, at = blocks.indexOf(ENV_BLOCK); return (at === -1 ? [] : blocks.slice(at + 1)).reduce((out, later) => out.replace(`\n${later}`, ''), text) }
function envChecks(texts = {}, block = ENV_BLOCK) {
  const env = laterEnv(texts[ENV] ?? read(ENV))
  assert.ok(env.endsWith(`\n${block}`), '.env.example ends with the block (both flags, at the end)')
  assert.equal(env.slice(0, env.length - block.length - 1), baseText(ENV), '.env.example is dev\'s file plus that one blank-line-separated block')
  const parts = block.replace(/\n$/, '').split('\n\n')
  assert.equal(parts.length, 2, 'the block is two blocks: one per flag, a blank line between')
  for (const [part, flag] of [[parts[0], FLAG_ON], [parts[1], FLAG_FREE]]) {
    assert.equal((env.match(new RegExp(`^${flag}=`, 'gm')) || []).length, 1, `.env.example assigns ${flag} once`)
    assert.match(part, new RegExp(`^${flag}="false"$`, 'm'), `${flag} is documented as "false"`)
    assert.ok(part.split('\n').filter(line => line && !line.startsWith('#')).length === 1 && part.split('\n').filter(line => line.startsWith('#')).length >= 2, `${flag}: comments and one assignment`)
    assert.ok(part.includes(SENTENCE), `${flag}'s block says what the flags do, in the words FRONTEND-1 gave`)
    assert.ok(part.split('\n').at(-1) === `${flag}="false"`, `${flag}: the block ends with its assignment`)
  }
  assert.ok(parts[1].includes('does nothing while NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON is off'), 'the FREE block says it does nothing while ON is off')
  assert.doesNotMatch(env, /a reopened chat keeps the value it was saved with/, 'and no longer says a reopened chat keeps its saved value')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes(FLAG_ON) || registry.stripLaterEnvBlocks(ENV, env).includes(FLAG_FREE), false, 'the registry takes both blocks out of .env.example')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes('STUDIO RESEARCH DEFAULT'), false, 'and their comments with them')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env), registry.stripLaterEnvBlocks(ENV, baseText(ENV)), 'read through the registry it is what the registry makes of dev\'s file')
}

// ============================================================================================================================================
// F. the registry
// ============================================================================================================================================
const REG_MARK = '// LATER-CHANGE: KNOWLEDGE-3, the Research default'
function registryChecks(text = read(REGISTRY)) {
  const lists = { LATER_CHANGE_FILES: 'RESEARCH_DEFAULT_SCOPE_FILES', LATER_ENV_BLOCKS: 'RESEARCH_DEFAULT_ENV_BLOCK', LATER_STRIPS: 'stripResearchDefault' }
  for (const [list, name] of Object.entries(lists)) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n').filter(Boolean), at = rows.findIndex(line => line.includes('studio-research-default-strip.mjs'))
    assert.ok(at > 0, `${list}: this change's line is in the list`)
    assert.ok(rows[at].includes(`).${name},`), `${list}: the line reads ${name}`)
    assert.equal((text.slice(start, end).match(/studio-research-default-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
  }
  const files = text.slice(text.indexOf('export const LATER_CHANGE_FILES = '), text.indexOf('// one line per later change, above this comment')).split('\n').filter(Boolean)
  const own = files.findIndex(line => line.includes('studio-research-default-strip.mjs'))
  assert.ok(files[own - 1].includes('studio-uat-marketing-v4-strip.mjs'), 'LATER_CHANGE_FILES: the line comes right after the uat marketing-v4 line')
  const stripsList = text.slice(text.indexOf('export const LATER_STRIPS = ')).split('\n').filter(Boolean), envList = text.slice(text.indexOf('export const LATER_ENV_BLOCKS = '), text.indexOf('export const LATER_STRIPS = ')).split('\n').filter(Boolean)
  assert.ok(stripsList[stripsList.findIndex(line => line.includes('studio-research-default-strip.mjs')) - 1].includes('studio-replace-picture-strip.mjs'), 'LATER_STRIPS: after the last change before it')
  assert.ok(envList[envList.findIndex(line => line.includes('studio-research-default-strip.mjs')) - 1].includes('studio-replace-picture-strip.mjs'), 'LATER_ENV_BLOCKS: after the last change before it')
  const registered = text.split('\n').filter(line => line.includes('studio-research-default-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes(REG_MARK) && /(?<![\w-])LATER-CHANGE(?![\w-])/.test(line)), 'each carries the registry marker')
  const diff = lineDiff(baseText(REGISTRY), text)
  assert.deepEqual(diff.removed, [], 'and loses none'); assert.ok(registered.every(line => diff.added.includes(line)), 'and the three are among the lines it adds')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the block is registered')
  assert.ok([...SCOPE].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  assert.ok(registry.LATER_STRIPS.indexOf(STRIP_FN) > registry.LATER_STRIPS.findIndex(strip => strip === replacePictureStrip.stripReplacePicture), 'the strip runs after the Replace picture\'s (the order the changes were stacked)')
  // an older proof that holds the page to dev's file reads it through the registry: it is dev's
  assert.equal(registry.stripLaterChanges(PAGE, read(PAGE)), registry.stripLaterChanges(PAGE, baseText(PAGE)), `${PAGE}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(registry.stripLaterChanges(ENV, read(ENV)), registry.stripLaterChanges(ENV, baseText(ENV)), `${ENV}: read through the registry it is the base's`)
  // the strips of the neighbouring changes leave each other's lines alone, whichever order they run in
  const now = read(PAGE)
  assert.ok(replacePictureStrip.stripReplacePicture(PAGE, now).includes('RESEARCH-DEFAULT') && !replacePictureStrip.stripReplacePicture(PAGE, now).includes('REPLACE-PICTURE'), 'the Replace picture strip takes its lines and leaves this one\'s')
  assert.ok(STRIP_FN(PAGE, now).includes('REPLACE-PICTURE') && !STRIP_FN(PAGE, now).includes('RESEARCH-DEFAULT'), 'this strip takes its lines and leaves the Replace picture\'s')
  assert.equal(STRIP_FN(PAGE, replacePictureStrip.stripReplacePicture(PAGE, now)), replacePictureStrip.stripReplacePicture(PAGE, STRIP_FN(PAGE, now)), 'the two strips commute')
}

// ============================================================================================================================================
// G. scope, commits, secrets
// ============================================================================================================================================
const subjectOf = sha => git('log', '-1', '--format=%s', sha)
const own = (...args) => git('rev-list', '--no-merges', ...args, `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter(sha => subjectOf(sha).startsWith(SUBJECT))
/** This change's commits: on the first-parent line, by the subject prefix; once the gate has merged the branch they sit on the merge's second parent, so the whole range is read as well. */
const firstParentCommits = () => own('--first-parent'), allCommits = () => own()
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body) { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line'); return problems }
function secretChecks(texts = {}) {
  for (const rel of [...APP_FILES, ...NEW_FILES, ENV, REGISTRY]) assert.doesNotMatch(texts[rel] ?? read(rel), SECRET, `${rel}: no secret`)
  for (const sha of allCommits()) assert.doesNotMatch(git('show', '--format=%B', sha), SECRET, `commit ${sha.slice(0, 8)}: no secret in the diff or the message`)
}

// ============================================================================================================================================
// H. one literal read each
// ============================================================================================================================================
function oneReadChecks(texts = {}) {
  for (const rel of git('ls-files', 'app', 'hooks', 'components', 'lib', 'middleware.ts', 'next.config.mjs').split('\n').filter(Boolean).filter(f => /\.(ts|tsx|mjs|js)$/.test(f))) {
    const text = texts[rel] ?? read(rel)
    for (const flag of FLAGS) assert.equal((text.match(new RegExp(`process\\.env\\.${flag}\\b`, 'g')) || []).length, rel === LIB ? 1 : 0, `${rel}: ${rel === LIB ? `reads ${flag} once` : `does not read ${flag} itself`}`)
  }
  for (const rel of git('grep', '-l', '-E', '-e', 'STUDIO_RESEARCH_DEFAULT_(ON|FREE)', '--', 'app', 'hooks', 'components', 'lib').split('\n').filter(Boolean)) assert.ok([LIB, PAGE].includes(rel), `${rel}: only the lib and the Builder page name the flags`)
  const lib = texts[LIB] ?? read(LIB); assert.equal((lib.match(/process\.env/g) || []).length, 2)
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
const SESSION_HOOK = 'hooks/use-builder-session.ts'
const TEXTS = Object.fromEntries([...APP_FILES, ...NEW_FILES.filter(f => f !== 'scripts/test-studio-research-default.mjs'), ...PIN_FILES, ...UNTAUGHT, ENV, REGISTRY, HOOK, CLEAN, SESSION_HOOK].map(rel => [rel, read(rel)]))
await check('A. the lib: both flags on for the exact string "true" and nothing else; one literal read each; researchDefaultFor for every plan; FREE alone does nothing', () => libChecks())
await check('B. the page\'s first state and its new-chat reset are the base\'s again', () => pageBaseLineChecks(TEXTS))
await check('B2. the default, by the real effect over a page view as a run of events: paid on, free off, free + FREE on, unknown off, an outlined chat off, a person\'s change not overridden, a new chat\'s first outline not flipped; flag off, dev\'s', () => defaultChecks(TEXTS))
await check('B3. the effect\'s text: its keys, its order, the one marked writer of web search; every other writer is the base\'s', () => writersChecks(TEXTS))
await check('C. only insertions: no base line of the page is rewritten; the strip gives dev\'s page byte for byte', () => pageDiffChecks(TEXTS))
await check('C2. the older proofs: two get one splice line each; the four the first commit taught are dev\'s again', () => pinChecks(TEXTS))
await check('D. deep research, the new-deck handoff, the restore, the handlers, the hook and the composer are the base\'s', () => untouchedChecks(TEXTS))
await check('E. .env.example: one block per flag at the end, "false", dev\'s file plus the blocks, the words FRONTEND-1 gave', () => envChecks(TEXTS))
await check('F. the registry: three lines, each marked LATER-CHANGE, at the right places; the strips commute', () => registryChecks())
await check('G1. own-commit scope, by the subject prefix on the first-parent line; the commit message', () => {
  const commits = allCommits(); assert.ok(commits.length >= 1, 'this change has commits of its own')
  scopeCheck(firstParentCommits()); scopeCheck(commits)
  for (const commit of commits) assert.deepEqual(messageProblems(subjectOf(commit), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
})
await check('G2. a secret scan of the files and the commits', () => secretChecks(TEXTS))
await check('H. each flag is read from one literal env name, and only the lib reads it', () => oneReadChecks())

// ---- I. mutants ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const P = (from, to) => ({ [PAGE]: swap(TEXTS[PAGE], from, to) })
const L = (from, to) => ({ [LIB]: swap(read(LIB), from, to) })
const E = (from, to) => ({ [ENV]: swap(TEXTS[ENV], from, to) })
const L_GUARD = lineWith(TEXTS[PAGE], '    if (!STUDIO_RESEARCH_DEFAULT_ON) return // RESEARCH-DEFAULT')
const L_SYNC = lineWith(TEXTS[PAGE], '    if (chat.id !== currentSessionId) {')
const L_OBS = lineWith(TEXTS[PAGE], '    else if (webSearchEnabled !== chat.web && !chat.applied)')
const L_WEB = lineWith(TEXTS[PAGE], '    chat.web = webSearchEnabled // RESEARCH-DEFAULT')
const L_WAIT = lineWith(TEXTS[PAGE], '    if (!currentSessionId || agentPlan === null')
const L_APPLIED = lineWith(TEXTS[PAGE], '    chat.applied = true // RESEARCH-DEFAULT')
const L_TOUCHED = lineWith(TEXTS[PAGE], '    if (chat.touched) return // RESEARCH-DEFAULT')
const L_SET = lineWith(TEXTS[PAGE], '    setWebSearchEnabled(!(hasStrawman ||')
const L_DEPS = lineWith(TEXTS[PAGE], '  }, [currentSessionId, agentPlan, hasStrawman, session.isLoadingSession, webSearchEnabled]) // RESEARCH-DEFAULT')
const L_REF = lineWith(TEXTS[PAGE], '  const researchChatRef = useRef<')
const L_IMPORT = "import { STUDIO_RESEARCH_DEFAULT_FREE, STUDIO_RESEARCH_DEFAULT_ON, researchDefaultFor } from '@/lib/studio-research-default' // RESEARCH-DEFAULT"
const EFFECT_BLOCK = TEXTS[PAGE].slice(TEXTS[PAGE].indexOf(L_REF), TEXTS[PAGE].indexOf(L_DEPS) + L_DEPS.length + 1) // the ref line and the whole effect, as the page has them
const set = (line, from, to) => P(line, line.replace(from, to))
const DEPS_WITHOUT = dep => P(L_DEPS, L_DEPS.replace(`, ${dep}`, ''))
const MUTANTS = [
  // the lib: the two flags and the helper
  ['lib: ON accepts "True"', L("process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'", "process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON?.toLowerCase() === 'true'"), libChecks],
  ['lib: ON is on for anything but "false"', L("NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'", "NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON !== 'false'"), libChecks],
  ['lib: ON is on for any value', L("process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON"), libChecks],
  ['lib: FREE accepts "True"', L("process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE === 'true'", "process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE?.toLowerCase() === 'true'"), libChecks],
  ['lib: FREE is on for anything but "false"', L("NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE === 'true'", "NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE !== 'false'"), libChecks],
  ['lib: FREE is on for any value', L("process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE"), libChecks],
  ['lib: ON reads another env name', L('NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON ===', 'NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT ==='), libChecks],
  ['lib: FREE reads the ON env name', L('process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE ===', 'process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON ==='), libChecks],
  ['lib: a second read through a dynamic key', L("=== 'true'\nexport const STUDIO_RESEARCH_DEFAULT_FREE", "=== 'true' || process.env['NEXT_PUBLIC_STUDIO_RESEARCH_' + 'DEFAULT_ON'] === 'true'\nexport const STUDIO_RESEARCH_DEFAULT_FREE"), libChecks],
  ['lib: an import', L('export const STUDIO_RESEARCH_DEFAULT_ON', "import { x } from './y'\nexport const STUDIO_RESEARCH_DEFAULT_ON"), libChecks],
  ['lib: the helper reads the environment', L("if (flags.on !== true) return false", "if (flags.on !== true && process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON !== 'true') return false"), libChecks],
  ['lib: the helper ignores ON (the FREE flag alone turns free on)', L("  if (flags.on !== true) return false\n", ''), libChecks],
  ['lib: the helper ignores FREE (free is on with ON)', L("if (plan === 'free') return flags.free === true", "if (plan === 'free') return true"), libChecks],
  ['lib: the helper needs FREE for a paid plan too', L("plan === 'premium') return true", "plan === 'premium') return flags.free === true"), libChecks],
  ['lib: starter is not paid', L("plan === 'starter' || ", ''), libChecks],
  ['lib: pro is not paid', L("plan === 'pro' || ", ''), libChecks],
  ['lib: premium is not paid', L(" || plan === 'premium'", ''), libChecks],
  ['lib: an unknown plan is on', L('  return false\n}', '  return true\n}'), libChecks],
  ['lib: the plan is matched without case', L("if (plan === 'free') return flags.free === true", "if (String(plan).toLowerCase() === 'free') return flags.free === true"), libChecks],
  ['lib: ON may be any truthy value', L('flags.on !== true', '!flags.on'), libChecks],
  ['lib: the comment goes back to the old words', { [LIB]: swap(read(LIB), SENTENCE, 'On, a new chat in the Builder starts with web search on. Deep research stays off, and a reopened chat keeps the value it was saved with.') }, libChecks],
  ['lib: the comment drops the free plans', { [LIB]: swap(read(LIB), ' free plans only when NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE is also on.', '') }, libChecks],
  ['lib: a secret', { [LIB]: `${read(LIB)}// sk-${'a'.repeat(24)}\n` }, secretChecks],
  // the page: the effect
  ['effect: it runs with the flag off', P(`${L_GUARD}\n`, ''), defaultChecks],
  ['effect: it runs with the flag off (text check)', P(`${L_GUARD}\n`, ''), writersChecks],
  ['effect: it does not wait for the plan', set(L_WAIT, 'agentPlan === null || ', ''), defaultChecks],
  ['effect: it does not wait for the chat to load (an outlined chat opened is decided before its row is restored)', set(L_WAIT, ' || session.isLoadingSession', ''), defaultChecks],
  ['effect: a chat is decided every time it runs, not once', set(L_WAIT, ' || chat.applied', ''), defaultChecks],
  ['effect: the person\'s change is not checked', P(`${L_TOUCHED}\n`, ''), defaultChecks],
  ['effect: the person\'s change is not seen', P(`${L_OBS}\n`, ''), defaultChecks],
  ['effect: the last seen value is not kept', P(`${L_WEB}\n`, ''), defaultChecks],
  ['effect: another chat does not start over', set(L_SYNC, 'chat.applied = false; chat.touched = false', ''), defaultChecks],
  ['effect: another chat keeps the person\'s change', set(L_SYNC, 'chat.applied = false; chat.touched = false', 'chat.applied = false'), defaultChecks],
  ['effect: the page\'s first chat loses a change made before it had an id', set(L_SYNC, 'if (chat.id !== null) { chat.applied = false; chat.touched = false }', 'chat.applied = false; chat.touched = false'), defaultChecks],
  ['effect: a chat with its outline gets the default', set(L_SET, '!(hasStrawman || strawmanPreviewUrl || strawmanPresentationId || finalPresentationUrl || finalPresentationId) && ', ''), defaultChecks],
  ['effect: Director\'s latch is not an outline', set(L_SET, 'hasStrawman || ', ''), defaultChecks],
  ['effect: a strawman url is not an outline', set(L_SET, 'strawmanPreviewUrl || ', ''), defaultChecks],
  ['effect: a strawman id is not an outline', set(L_SET, 'strawmanPresentationId || ', ''), defaultChecks],
  ['effect: a final deck url is not an outline', set(L_SET, 'finalPresentationUrl || ', ''), defaultChecks],
  ['effect: a final deck id is not an outline', set(L_SET, ' || finalPresentationId)', ')'), defaultChecks],
  ['effect: the free flag is wired to ON', set(L_SET, 'free: STUDIO_RESEARCH_DEFAULT_FREE', 'free: STUDIO_RESEARCH_DEFAULT_ON'), defaultChecks],
  ['effect: free is always on', set(L_SET, 'free: STUDIO_RESEARCH_DEFAULT_FREE', 'free: true'), defaultChecks],
  ['effect: the plan is not passed (every plan is unknown)', set(L_SET, 'researchDefaultFor(agentPlan,', 'researchDefaultFor(null,'), defaultChecks],
  ['effect: it also switches deep research on', P(`${L_APPLIED}\n`, `${L_APPLIED}\n    setResearchEnabled(true) // RESEARCH-DEFAULT\n`), defaultChecks],
  ['effect: it also switches deep research on (text check)', P(`${L_APPLIED}\n`, `${L_APPLIED}\n    setResearchEnabled(true) // RESEARCH-DEFAULT\n`), writersChecks],
  ['effect: it sets web search a second time', P(`${L_APPLIED}\n`, `${L_APPLIED}\n    setWebSearchEnabled(true) // RESEARCH-DEFAULT\n`), writersChecks],
  ['effect: it sets web search before the chat is marked decided', P(`${L_APPLIED}\n${L_TOUCHED}\n${L_SET}\n`, `${L_SET}\n${L_APPLIED}\n${L_TOUCHED}\n`), writersChecks],
  ['effect: it keeps flipping web search (does not settle)', { [PAGE]: TEXTS[PAGE].replace(L_WAIT, L_WAIT.replace(' || chat.applied', '')).replace(L_SET, '    setWebSearchEnabled(!webSearchEnabled) // RESEARCH-DEFAULT') }, defaultChecks],
  ['effect: keyed without the session id', P(L_DEPS, L_DEPS.replace('[currentSessionId, ', '[')), defaultChecks],
  ['effect: keyed without the plan', DEPS_WITHOUT('agentPlan'), defaultChecks],
  ['effect: keyed without the end of loading', DEPS_WITHOUT('session.isLoadingSession'), defaultChecks],
  ['effect: keyed without the switch\'s own value (a change before the plan arrives is not seen)', DEPS_WITHOUT('webSearchEnabled'), defaultChecks],
  ['effect: keyed without hasStrawman (text check)', DEPS_WITHOUT('hasStrawman'), writersChecks],
  ['effect: keyed without the end of loading (text check)', DEPS_WITHOUT('session.isLoadingSession'), writersChecks],
  ['effect: the effect sits before the session hook', { [PAGE]: TEXTS[PAGE].replace(EFFECT_BLOCK, '').replace('  const session = useBuilderSession({', `${EFFECT_BLOCK}  const session = useBuilderSession({`) }, writersChecks],
  ['page: the first state is the flag again (a base line rewritten)', P(FIRST_WEB, '  const [webSearchEnabled, setWebSearchEnabled] = useState(STUDIO_RESEARCH_DEFAULT_ON)'), pageBaseLineChecks],
  ['page: the first state is the flag again (diff check)', P(FIRST_WEB, '  const [webSearchEnabled, setWebSearchEnabled] = useState(STUDIO_RESEARCH_DEFAULT_ON) // RESEARCH-DEFAULT'), pageDiffChecks],
  ['page: the new-chat reset gives the flag (a base line rewritten)', P('    setWebSearchEnabled(false)\n    setExtendedGenerationEnabled(true)', '    setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON) // RESEARCH-DEFAULT\n    setExtendedGenerationEnabled(true)'), pageBaseLineChecks],
  ['page: the new-chat reset gives the flag (diff check)', P('    setWebSearchEnabled(false)\n    setExtendedGenerationEnabled(true)', '    setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON) // RESEARCH-DEFAULT\n    setExtendedGenerationEnabled(true)'), pageDiffChecks],
  ['page: a marked line is added inside the web search handler', P('    if (!enabled) setResearchEnabled(false)\n', '    if (!enabled) setResearchEnabled(false)\n    researchChatRef.current.touched = true // RESEARCH-DEFAULT\n'), untouchedChecks],
  ['page: a marked line is added inside the Deep research handler', P('    if (enabled) setWebSearchEnabled(true)\n', '    if (enabled) setWebSearchEnabled(true)\n    researchChatRef.current.touched = true // RESEARCH-DEFAULT\n'), untouchedChecks],
  ['page: a handler stops linking the two switches', P('    if (!enabled) setResearchEnabled(false)\n', ''), untouchedChecks],
  ['page: the session restore sets web search', P('    retireStudioVoiceOwner()\n    if (STUDIO_VOICE_INTERACTIVE_ENABLED) {', '    if (STUDIO_RESEARCH_DEFAULT_ON && restoredSessionState?.strawmanPreviewUrl) setWebSearchEnabled(false) // RESEARCH-DEFAULT\n    retireStudioVoiceOwner()\n    if (STUDIO_VOICE_INTERACTIVE_ENABLED) {'), untouchedChecks],
  ['page: the session hook is edited', { [SESSION_HOOK]: `${TEXTS[SESSION_HOOK]}// x\n` }, untouchedChecks],
  ['page: a second marked effect', P(L_REF, `  useEffect(() => { /* RESEARCH-DEFAULT */ }, [])\n${L_REF}`), writersChecks],
  ['page: an effect without the marker sets it off when the lock latches', P(L_REF, `  useEffect(() => { if (hasStrawman) setWebSearchEnabled(false) }, [hasStrawman])\n${L_REF}`), writersChecks],
  ['page: a line loses its marker', set(L_APPLIED, ' // RESEARCH-DEFAULT', ' // research default'), pageDiffChecks],
  ['page: a third insertion elsewhere is marked', P('  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)\n', '  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)\n  const researchDefaultNote = 1 // RESEARCH-DEFAULT\n'), pageDiffChecks],
  ['page: the effect differs from the strip\'s pair (the strip cannot put it back)', set(L_APPLIED, 'chat.applied = true', 'chat.applied  = true'), pageDiffChecks],
  ['page: the import is gone', P(`${L_IMPORT}\n`, ''), pageDiffChecks],
  ['page: the import names a third thing', P(L_IMPORT, L_IMPORT.replace('researchDefaultFor }', 'researchDefaultFor, x }')), pageDiffChecks],
  ['page: a base line is lost', P('    setKnowledgeGraphEnabled(false)\n    setIsGeneratingFinal(false)\n', '    setIsGeneratingFinal(false)\n'), pageDiffChecks],
  ['page: another base line changes (extended generation resets on)', P('    setExtendedGenerationEnabled(true)\n    setKnowledgeGraphEnabled(false)\n', '    setExtendedGenerationEnabled(false)\n    setKnowledgeGraphEnabled(false)\n'), pageDiffChecks],
  ['page: deep research starts true', P(FIRST_RESEARCH, '  const [researchEnabled, setResearchEnabled] = useState(true)'), untouchedChecks],
  ['page: the deep research reset is changed', P('    setResearchEnabled(false)\n', '    setResearchEnabled(true)\n'), untouchedChecks],
  ['page: the new-deck handoff takes the flag', P('    setWebSearchEnabled(pending.web_search || pending.deep_research)', '    setWebSearchEnabled(pending.web_search || pending.deep_research || STUDIO_RESEARCH_DEFAULT_ON)'), untouchedChecks],
  ['page: the new-deck handoff is replaced by the flag', P('    setWebSearchEnabled(pending.web_search || pending.deep_research)', '    setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON)'), untouchedChecks],
  ['page: the deep research setter of the new-deck handoff is dropped', P('    setResearchEnabled(pending.deep_research)\n', ''), untouchedChecks],
  ['page: a send reads web search differently', P('        web_search: webSearchEnabled,\n', '        web_search: webSearchEnabled || STUDIO_RESEARCH_DEFAULT_ON,\n'), untouchedChecks],
  ['hook: a line is added', { [HOOK]: TEXTS[HOOK].replace('web_search: webSearch,', 'web_search: webSearch || false,') }, untouchedChecks],
  ['composer: a line is added', { [CLEAN]: `${TEXTS[CLEAN]}// x\n` }, untouchedChecks],
  // .env.example
  ['env: ON\'s default is edited to "true"', E(`${FLAG_ON}="false"`, `${FLAG_ON}="true"`), envChecks],
  ['env: FREE\'s default is edited to "true"', E(`${FLAG_FREE}="false"`, `${FLAG_FREE}="true"`), envChecks],
  ['env: the blocks are not last', { [ENV]: `${TEXTS[ENV]}\n# something after\n` }, envChecks],
  ['env: both blocks are gone', E(`\n${ENV_BLOCK}`, ''), envChecks],
  ['env: the FREE block is gone', E(`\n${ENV_BLOCK.slice(ENV_BLOCK.indexOf('# STUDIO RESEARCH DEFAULT FREE'))}`, ''), envChecks],
  ['env: ON is assigned twice', { [ENV]: `${TEXTS[ENV]}${FLAG_ON}="false"\n` }, envChecks],
  ['env: FREE is assigned twice', { [ENV]: `${TEXTS[ENV]}${FLAG_FREE}="false"\n` }, envChecks],
  ['env: a base line is edited', E('NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH="false"', 'NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH="true"'), envChecks],
  ['env: ON\'s block says the old words', { [ENV]: swap(TEXTS[ENV], `# ${SENTENCE} (Once per chat`, '# On: a new chat in the Builder starts with Research (web search) switched on, and a reopened chat keeps the value it was saved with. (Once per chat') }, envChecks],
  ['env: FREE\'s block says the old words', { [ENV]: swap(TEXTS[ENV], `# ${SENTENCE}\n${FLAG_FREE}`, `# On: free plans start with web search on.\n${FLAG_FREE}`) }, envChecks],
  ['env: ON\'s block drops the free plans', { [ENV]: TEXTS[ENV].replace(' free plans only when NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE is also on.', '') }, envChecks],
  ['env: the FREE block does not say it does nothing while ON is off', E('It does nothing while NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON is off;', 'It is independent of the other flag;'), envChecks],
  ['hook: it reads a flag itself', { [HOOK]: `${TEXTS[HOOK]}const x = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON\n` }, oneReadChecks],
  ['hook: it reads the FREE flag itself', { [HOOK]: `${TEXTS[HOOK]}const x = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE\n` }, oneReadChecks],
  ['page: it reads a flag itself', { [PAGE]: `${TEXTS[PAGE]}const y = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON\n` }, oneReadChecks],
  // the two older proofs that read the first-parent line, and the four that are dev's again
  ['pin: a taught proof loses its mark', { 'scripts/test-studio-chat-element-edit.mjs': swap(TEXTS['scripts/test-studio-chat-element-edit.mjs'], 'registry read (RESEARCH-DEFAULT): on a branch', 'registry read: on a branch') }, pinChecks],
  ['pin: a subject splice names another subject too', { 'scripts/test-studio-deck-sync-truth.mjs': TEXTS['scripts/test-studio-deck-sync-truth.mjs'].replace('!/^Research default:/.test', '!/^(Research default|Research switch):/.test') }, pinChecks],
  ['pin: a taught proof loses a base line', { 'scripts/test-studio-chat-element-edit.mjs': swap(TEXTS['scripts/test-studio-chat-element-edit.mjs'], "import { LATER_STRIPS } from './studio-later-changes.mjs'\n", '') }, pinChecks],
  ['pin: a taught proof gains a stray unmarked line', { 'scripts/test-studio-deck-sync-truth.mjs': `${TEXTS['scripts/test-studio-deck-sync-truth.mjs']}// stray\n` }, pinChecks],
  ['pin: a taught proof gains a second splice', { 'scripts/test-studio-chat-element-edit.mjs': `${TEXTS['scripts/test-studio-chat-element-edit.mjs']}shas.splice(0, shas.length) // LATER-CHANGES: registry read (RESEARCH-DEFAULT)\n` }, pinChecks],
  ['pin: a proof the first commit taught keeps a line of it', { 'scripts/test-studio-job-ledger.mjs': `${TEXTS['scripts/test-studio-job-ledger.mjs']}// LATER-CHANGES: registry read (RESEARCH-DEFAULT)\n` }, pinChecks],
]
for (const [label, texts, fn] of MUTANTS) await mutant(label, () => fn({ ...TEXTS, ...texts }))
const registryText = TEXTS[REGISTRY]
const ownLine = list => registryText.split('\n').filter(line => line.includes('studio-research-default-strip.mjs')).find(line => line.includes(list)) + '\n'
await mutant('registry: the files line is gone', () => registryChecks(swap(registryText, ownLine('RESEARCH_DEFAULT_SCOPE_FILES'), '')))
await mutant('registry: the env line is gone', () => registryChecks(swap(registryText, ownLine('RESEARCH_DEFAULT_ENV_BLOCK'), '')))
await mutant('registry: the strip line is gone', () => registryChecks(swap(registryText, ownLine('stripResearchDefault'), '')))
await mutant('registry: the strip line has no LATER-CHANGE marker', () => registryChecks(swap(registryText, ownLine('stripResearchDefault'), ownLine('stripResearchDefault').replace('LATER-CHANGE', 'LATER'))))
await mutant('registry: the files line sits before the uat marketing-v4 line', () => {
  const marketing = registryText.split('\n').find(line => line.includes('studio-uat-marketing-v4-strip.mjs') && line.includes('UAT_MARKETING_V4_SCOPE_FILES')) + '\n'
  registryChecks(swap(swap(registryText, ownLine('RESEARCH_DEFAULT_SCOPE_FILES'), ''), marketing, ownLine('RESEARCH_DEFAULT_SCOPE_FILES') + marketing))
})
await mutant('registry: the strip line is not at the true end', () => {
  const replacePicture = registryText.split('\n').find(line => line.includes('studio-replace-picture-strip.mjs') && line.includes('stripReplacePicture')) + '\n'
  registryChecks(swap(swap(registryText, ownLine('stripResearchDefault'), ''), replacePicture, ownLine('stripResearchDefault') + replacePicture))
})
await mutant('registry: another line is lost', () => registryChecks(swap(registryText, registryText.split('\n').find(line => line.includes('studio-replace-picture-strip.mjs') && line.includes('stripReplacePicture')) + '\n', '')))
await mutant('registry: a fourth line', () => registryChecks(swap(registryText, '  // one line per later change, above this comment\n])\n\nexport const LATER_ENV_BLOCKS', `  ...(await import('./studio-research-default-strip.mjs')).RESEARCH_DEFAULT_FLAGS, // LATER-CHANGE: KNOWLEDGE-3, the Research default: x\n  // one line per later change, above this comment\n])\n\nexport const LATER_ENV_BLOCKS`)))
const STRIP_FILE = 'scripts/studio-research-default-strip.mjs', STRIP_TEXT = read(STRIP_FILE)
const strippedWith = async (from, to) => import(`data:text/javascript;base64,${Buffer.from(swap(STRIP_TEXT, from, to)).toString('base64')}`) // a mutated copy of the strip module (it imports nothing)
await mutant('strip module: a taught proof is left out of the list', async () => pinChecks(TEXTS, await strippedWith('Object.keys(RESEARCH_DEFAULT_PIN_EDITS)', 'Object.keys(RESEARCH_DEFAULT_PIN_EDITS).slice(1)')))
await mutant('strip module: the strip does not put the proofs back', async () => pinChecks(TEXTS, await strippedWith('if (!(rel in RESEARCH_DEFAULT_EDITS) && !(rel in RESEARCH_DEFAULT_PIN_EDITS)) return text', 'if (!(rel in RESEARCH_DEFAULT_EDITS)) return text')))
await mutant('strip module: the page edits are not put back', async () => { const mod = await strippedWith('.reduce((out, [has, was]) => out.replace(has, () => was), text)', '.reduce((out) => out, text)'); assert.equal(mod.stripResearchDefault(PAGE, read(PAGE)), baseText(PAGE), 'the strip gives dev\'s page') })
await mutant('strip module: the page edits are put back once only', async () => { const mod = await strippedWith('.reduce((out, [has, was]) => out.replace(has, () => was), text)', '.reduce((out, [has, was], i) => i === 0 ? out.replace(has, () => was) : out, text)'); assert.equal(mod.stripResearchDefault(PAGE, read(PAGE)), baseText(PAGE), 'the strip gives dev\'s page') })
await mutant('scope: a stray file', () => scopeCheck(allCommits(), ['components/builder/message-list.tsx']))
await mutant('scope: the page of another change', () => scopeCheck(allCommits(), ['components/presentation-viewer.tsx']))
await mutant('commit: no co-author line', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'a body\n'), []))
await mutant('commit: another co-author', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\n'), []))
await mutant('commit: another subject', () => assert.deepEqual(messageProblems('Fix a thing', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))

console.log(`\n${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`FAILED: ${failed.join('; ')}`); if (missed.length) console.error(`MISSED: ${missed.join('; ')}`); process.exit(1) }
process.exit(0)
