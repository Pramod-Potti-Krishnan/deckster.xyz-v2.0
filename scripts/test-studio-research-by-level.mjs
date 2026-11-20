// FRONTEND-1: proof of Research by level (wave 1 step 0.5c). Flag NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL, the exact string "true", default off, build-time; independent of the plan-based research default.
// In a chat with no outline yet, moving the level picker to Best or Max turns web search on; moving it to anything else (Fast, Balanced, Auto, the automatic return to Auto after a run or a chat change included) turns it off again if THIS rule turned it on;
// the person's own change of the web switch (or of Deep research) in a chat always wins; an outline ends the rule; a new chat starts over; deep research and the knowledge graph are not touched. Off, the page behaves as dev's.
// (A pure function, researchByLevel(prev, event), in lib/studio-research-by-level.ts; in the Builder page one ref, two wrappers for the person's own change, one prop spread and one effect, all marked RESEARCH-BY-LEVEL, all insertions.)
//
//   node scripts/test-studio-research-by-level.mjs        (plain node, offline: the REAL sources transpiled and run in a vm; the page's ref, wrappers, prop spread and effect are cut out of the real file and RUN, the effect re-run exactly when its real dependency array changes;
//                                                         git is read for the strip, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to H), then mutants (I):
//  A. the lib: the flag is on for the exact string "true" and nothing else, one literal env read, nothing imported, the pure function a table of explicit rows (rules 1 to 5), never mutating its input, flag off: always the state it was given;
//  B. the page, as a page view made of events (pick a level, the person's own switch, Deep research, an outline appearing, a new chat, opening a chat, a run ending, another writer): every run of up to four events (five over a smaller vocabulary) equals the spec written in words; named cases for each rule; flag off, the page's traces
//     are dev's, event for event (sha256 of both runs equal);
//  B2. the page's text: the effect's keys, its first line, the outline test (the plan-based default's own), the one marked writer of web search, the wrappers, the prop spread after the base's two props, nothing for deep research or the knowledge graph;
//  C. only insertions: no base line of the page is rewritten (the strip gives dev's page byte for byte; twelve marked lines in five places); the five older proofs taught (one line each for two, two lines for the other three) are their previous text byte for byte;
//  D. .env.example: one block at the very end, "false", plain words, naming only its own flag;
//  E. the registry: exactly three lines, each marked LATER-CHANGE, at the true end of each list, the strip independent of its neighbours' strips;
//  F. the base is the head this change is stacked on (an ancestor of the branch), own-commit scope, by the subject prefix "Research by level:" on the first-parent line (and, once the gate has merged it, over the whole range), the commit message, and a secret scan;
//  G. the flag is read from one literal env name and nothing but the lib reads it; the lib's names are used on marked lines only;
//  I. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as stripModule from './studio-research-by-level-strip.mjs'
import * as defaultStrip from './studio-research-default-strip.mjs'
import * as heroOnlyStrip from './studio-replace-picture-hero-only-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const { BASE_COMMIT, RESEARCH_BY_LEVEL_PIN_FILES: PIN_FILES, RESEARCH_BY_LEVEL_PIN_MARK: PIN_MARK, RESEARCH_BY_LEVEL_PIN_EDITS: PIN_EDITS, RESEARCH_BY_LEVEL_SCOPE_FILES: SCOPE, RESEARCH_BY_LEVEL_NEW_FILES: NEW_FILES, RESEARCH_BY_LEVEL_FILES: APP_FILES, RESEARCH_BY_LEVEL_MARKER_RE: MARKER_RE, RESEARCH_BY_LEVEL_ENV_BLOCK: ENV_BLOCK, RESEARCH_BY_LEVEL_SUBJECT: SUBJECT, RESEARCH_BY_LEVEL_EDITS: EDITS, RESEARCH_BY_LEVEL_FLAGS: FLAGS } = stripModule
const STRIP_FN = stripModule.stripResearchByLevel
const [FLAG] = FLAGS

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
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

const LIB = 'lib/studio-research-by-level.ts', PAGE = 'app/builder/page.tsx', REGISTRY = 'scripts/studio-later-changes.mjs', ENV = '.env.example'
const compile = (file, text) => ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
function load(rel, { env = {}, texts = {} } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), { module, exports: module.exports, require: spec => nodeRequire(spec), process: { env: { ...env } } }, { filename: rel })
  return module.exports
}
const lineWith = (text, needle) => { const hits = text.split('\n').filter(line => line.includes(needle)); assert.equal(hits.length, 1, `exactly one line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] }
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
/** What a later change's strips (those registered after this one) leave of a file: none are registered after this change, so the file as it is. */
const laterOnly = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }

// ============================================================================================================================================
// A. the lib
// ============================================================================================================================================
const FRESH = { chat: null, touched: false, auto: false, pending: null }
const st = (chat, touched = false, auto = false, pending = null) => ({ chat, touched, auto, pending })
const lv = (chat, level, { noOutline = true, web = false } = {}) => ({ kind: 'level', chat, level, noOutline, web })
const touch = chat => ({ kind: 'touch', chat })
/** The pure function as a table: [what the rule knew, what happened, the answer]. `web` is absent when the switch is left alone. */
const ROWS = [
  // rule 1: Best or Max, in a chat with no outline, the switch off: on, and remembered
  ['pick Best, switch off: on, remembered', st('c1'), lv('c1', 'best'), { state: st('c1', false, true), web: true }],
  ['pick Max, switch off: on, remembered', st('c1'), lv('c1', 'max'), { state: st('c1', false, true), web: true }],
  ['the first chat takes its id and still decides (a state with no chat yet)', FRESH, lv('c1', 'best'), { state: st('c1', false, true), web: true }],
  ['a page whose chat has no id yet decides too', FRESH, lv(null, 'best'), { state: st(null, false, true), web: true }],
  ['Best with the switch already on (any other writer): nothing, and not remembered', st('c1'), lv('c1', 'best', { web: true }), { state: st('c1') }],
  ['Max with the switch already on, remembered earlier by the rule: stays remembered', st('c1', false, true), lv('c1', 'max', { web: true }), { state: st('c1', false, true) }],
  // rule 2: anything else turns it back off, only if the rule turned it on, and only while there is no outline
  ['Fast after the rule turned it on: off, forgotten', st('c1', false, true), lv('c1', 'fast', { web: true }), { state: st('c1'), web: false }],
  ['Balanced after the rule turned it on: off, forgotten', st('c1', false, true), lv('c1', 'balanced', { web: true }), { state: st('c1'), web: false }],
  ['back to Auto after the rule turned it on: off, forgotten', st('c1', false, true), lv('c1', 'auto', { web: true }), { state: st('c1'), web: false }],
  ['Fast when the rule did not turn it on (the switch is on for another reason): nothing', st('c1'), lv('c1', 'fast', { web: true }), { state: st('c1') }],
  ['Auto with nothing remembered, switch off: nothing', st('c1'), lv('c1', 'auto'), { state: st('c1') }],
  ['remembered, but the switch is already off by another writer: forgotten, nothing set', st('c1', false, true), lv('c1', 'fast'), { state: st('c1') }],
  ['an unknown level is "anything else"', st('c1', false, true), lv('c1', 'turbo', { web: true }), { state: st('c1'), web: false }],
  // rule 3: the person's own change always wins
  ['the person changed the switch: noted', st('c1'), touch('c1'), { state: st('c1', true) }],
  ['touched, then Best: nothing', st('c1', true), lv('c1', 'best'), { state: st('c1', true) }],
  ['touched, then Fast after the rule had turned it on (the person turned it off, say): nothing', st('c1', true, true), lv('c1', 'fast', { web: true }), { state: st('c1', true, true) }],
  ['touched before the page\'s first chat had an id: kept when the id arrives', st(null, true), lv('c1', 'best'), { state: st('c1', true) }],
  ['a touch noted twice is the same state', st('c1', true), touch('c1'), { state: st('c1', true) }],
  // rule 3, a choice made for a chat the rule has not looked at yet: the chat being opened (the effect waits while it loads), or the chat a dashboard hand-off opens
  ['a state with no chat yet takes the chat the touch was made in', FRESH, touch('c1'), { state: st('c1', true) }],
  ['a touch before the page\'s first chat has an id: touched, still no chat', FRESH, touch(null), { state: st(null, true) }],
  ['a touch for another chat than the state\'s: kept for that chat, nothing touched here', st('c1', false, true), touch('c2'), { state: st('c1', false, true, { chat: 'c2' }) }],
  ['a touch for another chat, again for a third: the latest is kept', st('c1', false, true, { chat: 'c2' }), touch('c3'), { state: st('c1', false, true, { chat: 'c3' }) }],
  ['a touch for the state\'s own chat clears what was kept for another', st('c1', false, false, { chat: 'c2' }), touch('c1'), { state: st('c1', true) }],
  ['the fresh state for the chat a touch was kept for starts touched', st('c1', false, true, { chat: 'c2' }), lv('c2', 'auto', { web: false }), { state: st('c2', true) }],
  ['and Best there does nothing', st('c2', true), lv('c2', 'best'), { state: st('c2', true) }],
  ['the rule does not take its switch back over the choice made for the chat it is leaving for', st('c1', false, true, { chat: 'c2' }), lv('c2', 'auto', { web: true }), { state: st('c2', true) }],
  ['a choice kept for a different chat is not this one\'s: the fresh state is untouched, the rule takes its switch back', st('c1', false, true, { chat: 'c3' }), lv('c2', 'auto', { web: true }), { state: st('c2'), web: false }],
  ['a choice made for a chat with no id (null) is kept for it', st('c1', false, true, { chat: null }), lv(null, 'auto', { web: false }), { state: st(null, true) }],
  ['the page is back in the chat the state knows: what was kept for another chat is dropped', st('c1', false, false, { chat: 'c2' }), lv('c1', 'auto'), { state: st('c1') }],
  ['dropped, then Best still decides in the chat the state knows', st('c1', false, false, { chat: 'c2' }), lv('c1', 'best'), { state: st('c1', false, true), web: true }],
  // rule 3, new chat: starts over
  ['another chat: a fresh state, nothing else this time', st('c1', true, true), lv('c2', 'best', { web: false }), { state: st('c2') }],
  ['another chat, the level (stale for a render) is Best: still nothing this time', st('c1'), lv('c2', 'best'), { state: st('c2') }],
  ['leaving the chat where the rule turned it on, new chat with no outline: the rule takes its switch back', st('c1', false, true), lv('c2', 'auto', { web: true }), { state: st('c2'), web: false }],
  ['leaving it for a chat that has an outline: the switch stays (nothing is unlocked)', st('c1', false, true), lv('c2', 'auto', { web: true, noOutline: false }), { state: st('c2') }],
  ['leaving it when the person had touched the switch: the switch stays', st('c1', true, true), lv('c2', 'auto', { web: true }), { state: st('c2') }],
  ['leaving a chat where nothing was turned on: nothing', st('c1'), lv('c2', 'auto', { web: true }), { state: st('c2') }],
  ['the new chat\'s base reset already turned the switch off: nothing set', st('c1', false, true), lv('c2', 'auto', { web: false }), { state: st('c2') }],
  ['a chat whose id goes back to none starts over', st('c1', false, true), lv(null, 'auto', { web: true }), { state: st(null), web: false }],
  // rule 4: an outline ends the rule
  ['Best with an outline: nothing', st('c1'), lv('c1', 'best', { noOutline: false }), { state: st('c1') }],
  ['an outline arrives after the rule turned it on, then Auto: nothing (the switch stays)', st('c1', false, true), lv('c1', 'auto', { web: true, noOutline: false }), { state: st('c1', false, true) }],
]
const NOT_TRUE = [undefined, '', 'false', 'True', 'TRUE', '1', ' true', 'true ', 'yes', 'on']
const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze) } return o }
function libChecks(texts = {}) {
  const text = texts[LIB] ?? read(LIB)
  for (const value of NOT_TRUE) assert.equal(load(LIB, { env: value === undefined ? {} : { [FLAG]: value }, texts }).STUDIO_RESEARCH_DEFAULT_BY_LEVEL, false, `${FLAG}=${JSON.stringify(value)}: off`)
  assert.equal(load(LIB, { env: { [FLAG]: 'true' }, texts }).STUDIO_RESEARCH_DEFAULT_BY_LEVEL, true, 'exactly "true" is on')
  assert.equal(load(LIB, { env: { NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON: 'true', NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE: 'true' }, texts }).STUDIO_RESEARCH_DEFAULT_BY_LEVEL, false, 'the flag does not follow the plan-based default\'s two flags')
  assert.equal((text.match(new RegExp(`process\\.env\\.${FLAG}\\b`, 'g')) || []).length, 1, 'the literal env name is read once (so Next inlines it)')
  assert.equal((text.match(/process\.env/g) || []).length, 1, 'one env read in all, and none in the function')
  assert.deepEqual(Object.keys(load(LIB, { env: { [FLAG]: 'true' }, texts })).sort(), ['RESEARCH_BY_LEVEL_FRESH', 'STUDIO_RESEARCH_DEFAULT_BY_LEVEL', 'researchByLevel'], 'the lib exports the flag, the first state and the one function')
  assert.deepEqual([...text.matchAll(/^\s*(import|require)\b.*$/gm)].map(m => m[0]), [], 'the lib imports nothing')
  assert.doesNotMatch(text.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/**')).join('\n'), /\b(fetch|Date|Math\.random|localStorage|sessionStorage|window|document|console|setTimeout)\b/, 'pure: nothing in the lib reads a clock, storage or the network')
  const on = load(LIB, { env: { [FLAG]: 'true' }, texts }), off = load(LIB, { env: {}, texts })
  assert.deepEqual(JSON.parse(JSON.stringify(on.RESEARCH_BY_LEVEL_FRESH)), FRESH, 'a page\'s first state: no chat, nothing touched, nothing turned on')
  for (const [name, prev, event, want] of ROWS) {
    let got
    assert.doesNotThrow(() => { got = on.researchByLevel(deepFreeze(JSON.parse(JSON.stringify(prev))), deepFreeze(JSON.parse(JSON.stringify(event)))) }, `${name}: never writes to the state or the event it is given (both frozen here)`)
    assert.deepEqual(JSON.parse(JSON.stringify(got)), want, `${name}: flag on`)
    assert.equal(Object.hasOwn(got, 'web'), Object.hasOwn(want, 'web'), `${name}: the answer carries \`web\` only when the switch is to be set`)
    // the flag is a parameter too: the table again with the parameter, whatever the environment says
    assert.deepEqual(JSON.parse(JSON.stringify(off.researchByLevel(JSON.parse(JSON.stringify(prev)), JSON.parse(JSON.stringify(event)), true))), want, `${name}: flag passed as true`)
    const was = JSON.parse(JSON.stringify(prev)), unchanged = off.researchByLevel(was, event)
    assert.equal(unchanged.state, was, `${name}: flag off: the very state it was given`)
    assert.equal(Object.hasOwn(unchanged, 'web'), false, `${name}: flag off: never sets the switch`)
    assert.equal(on.researchByLevel(was, event, false).state, was, `${name}: the flag parameter false: the very state it was given`)
  }
  // a state that already holds a decision is handed back as it is when nothing changes (no new object per render)
  const still = st('c1')
  assert.equal(on.researchByLevel(still, lv('c1', 'auto')).state, still, 'nothing to do: the same state object')
  assert.equal(on.researchByLevel(st('c1', true), touch('c1')).state.touched, true)
}

// ============================================================================================================================================
// B. the page as a page view: the real marked lines run over stand-ins
// ============================================================================================================================================
const REF_START = '  const researchLevelRef = useRef<ResearchByLevelState>(RESEARCH_BY_LEVEL_FRESH) // RESEARCH-BY-LEVEL', PERSON_START = '  const researchByPerson = useCallback(', WEB_START = '  const webSearchByPerson = useCallback('
const EFFECT_START = '  useEffect(() => { // RESEARCH-BY-LEVEL', EFFECT_END_PREFIX = '  }, ['
const HANDLER_NAMES = { web: '  const handleWebSearchEnabledChange = useCallback((enabled: boolean) => {', deep: '  const handleResearchEnabledChange = useCallback((enabled: boolean) => {' }
const EFFECT_NAMES = ['STUDIO_RESEARCH_DEFAULT_BY_LEVEL', 'session', 'researchByLevel', 'researchLevelRef', 'currentSessionId', 'shownThinkingLevel', 'hasStrawman', 'strawmanPreviewUrl', 'strawmanPresentationId', 'finalPresentationUrl', 'finalPresentationId', 'webSearchEnabled', 'setWebSearchEnabled']
const WRAPPER_NAMES = ['useCallback', 'researchLevelRef', 'researchByLevel', 'handleResearchEnabledChange', 'handleWebSearchEnabledChange', 'currentSessionId']
const SPREAD_RE = /^\s*\{\.\.\.\((.*)\)\} \/\/ RESEARCH-BY-LEVEL/
const fragments = new Map()
function fragmentsOf(page) {
  if (!fragments.has(page)) {
    const lines = page.split('\n'), starts = lines.map((line, i) => line.startsWith(EFFECT_START) ? i : -1).filter(i => i >= 0)
    if (starts.length === 0) fragments.set(page, null) // dev's page: nothing of this change
    else {
      assert.equal(starts.length, 1, 'one marked effect in the page')
      const start = starts[0], end = lines.findIndex((line, i) => i > start && line.startsWith(EFFECT_END_PREFIX))
      assert.ok(end > start, 'the effect ends with its dependency array')
      const depsText = lines[end].slice(lines[end].indexOf('['), lines[end].lastIndexOf(']') + 1)
      const at = prefix => { const hits = lines.map((line, i) => line.startsWith(prefix) ? i : -1).filter(i => i >= 0); assert.equal(hits.length, 1, `one line starts ${JSON.stringify(prefix.slice(0, 60))}`); return hits[0] }
      const spreadAt = lines.map((line, i) => SPREAD_RE.test(line) ? i : -1).filter(i => i >= 0); assert.equal(spreadAt.length, 1, 'one marked prop spread')
      fragments.set(page, {
        start, end, depsText, spreadAt: spreadAt[0], refLine: lines[at(REF_START)], personLine: lines[at(PERSON_START)], webLine: lines[at(WEB_START)],
        effect: runFragment(['const effect = (() => {', ...lines.slice(start + 1, end), '})', 'return effect'].join('\n'), EFFECT_NAMES),
        deps: runFragment(`return () => (${depsText})`, EFFECT_NAMES),
        wrappers: runFragment([lines[at(PERSON_START)], lines[at(WEB_START)], 'return { researchByPerson, webSearchByPerson }'].join('\n'), WRAPPER_NAMES),
        ref: runFragment([lines[at(REF_START)], 'return researchLevelRef'].join('\n'), ['useRef', 'RESEARCH_BY_LEVEL_FRESH']),
        spread: runFragment(`return (${SPREAD_RE.exec(lines[spreadAt[0]])[1]})`, ['STUDIO_RESEARCH_DEFAULT_BY_LEVEL', 'researchByPerson', 'webSearchByPerson']),
      })
    }
  }
  return fragments.get(page)
}
const handlerCache = { web: new Map(), deep: new Map() } // keyed by the page's own string object (its hash is computed once)
function handlerOf(page, which) {
  if (!handlerCache[which].has(page)) {
    const lines = page.split('\n'), start = lines.indexOf(HANDLER_NAMES[which])
    assert.ok(start >= 0 && lines.indexOf(HANDLER_NAMES[which], start + 1) === -1, `the ${which} switch handler is where the base has it, once`)
    const end = lines.findIndex((line, i) => i > start && line === '  }, [])')
    handlerCache[which].set(page, runFragment(['const handle = ((enabled: boolean) => {', ...lines.slice(start + 1, end), '})', 'return handle'].join('\n'), ['setResearchEnabled', 'setWebSearchEnabled']))
  }
  return handlerCache[which].get(page)
}
/** The dashboard hand-off's own lines: the base's two setters, and this change's one marked line (dev's page has none), run together. */
const HANDOFF_BASE = ['    setResearchEnabled(pending.deep_research)', '    setWebSearchEnabled(pending.web_search || pending.deep_research)']
const handoffCache = new Map()
function handoffOf(page) {
  if (!handoffCache.has(page)) {
    const lines = page.split('\n'), mine = lines.filter(line => MARKER_RE.test(line) && line.includes('pending.new_session_id'))
    assert.ok(mine.length <= 1, 'at most one marked hand-off line')
    for (const line of HANDOFF_BASE) assert.equal(lines.filter(l => l === line).length, 1, `the base's hand-off line is there once: ${line.trim()}`)
    handoffCache.set(page, { mine: mine[0] ?? null, run: runFragment([...HANDOFF_BASE, ...mine].join('\n'), ['STUDIO_RESEARCH_DEFAULT_BY_LEVEL', 'researchByLevel', 'researchLevelRef', 'setResearchEnabled', 'setWebSearchEnabled', 'pending']) })
  }
  return handoffCache.get(page)
}
/**
 * The base's session-change reset (page.tsx, the AGENT-MODE-WIRE effect keyed on the chat id): a picked level belongs to the chat it was picked in, so another chat starts on Auto. The rule's effect leaves the first sight of a changed chat to the state
 * (a fresh one) because the level the picker shows is still the old chat's for that one render; the page gets it back to Auto here, one render later. The machine RUNS the page's own lines for this, so removing them changes what the rule sees.
 */
const RESET_START = '  useEffect(() => { // AGENT-MODE-WIRE: a run, its cards and a picked mode belong to the session they were made in', RESET_END_PREFIX = '  }, [currentSessionId]) // AGENT-MODE-WIRE'
const RESET_NAMES = ['STUDIO_AGENT_MODE_ENABLED', 'STUDIO_THINKING_LEVELS_ENABLED', 'agentSessionChanged', 'agentSessionRef', 'currentSessionId', 'dispatchAgentRun', 'AGENT_WIRE_RESET', 'setBuildMode', 'setBuildModeFrom', 'setThinkingLevel']
const resetCache = new Map()
function resetOf(page) {
  if (!resetCache.has(page)) {
    const lines = page.split('\n'), starts = lines.map((line, i) => line.startsWith(RESET_START) ? i : -1).filter(i => i >= 0)
    assert.equal(starts.length, 1, 'the base\'s session-change reset effect is where the base has it, once')
    const start = starts[0], end = lines.findIndex((line, i) => i > start && line.startsWith(RESET_END_PREFIX))
    assert.ok(end > start, 'the reset effect ends with its dependency array [currentSessionId]')
    resetCache.set(page, { start, end, effect: runFragment(['const effect = (() => {', ...lines.slice(start + 1, end), '})', 'return effect'].join('\n'), RESET_NAMES) })
  }
  return resetCache.get(page)
}
/** The real one-line helpers the reset and the shown level use, cut out of their libs (types are erased): which chat change counts, which build mode a level drives, what the picker shows for a level and a mode. */
const oneLiner = (rel, name) => { const hits = read(rel).split('\n').filter(l => l.startsWith(`export const ${name} =`)); assert.equal(hits.length, 1, `${rel}: one ${name}`); return hits[0].replace('export ', '') }
const agentSessionChanged = runFragment(`${oneLiner('lib/studio-agent-mode-wire.ts', 'agentSessionChanged')}\nreturn agentSessionChanged`, [])()
const { levelBuildMode, effectiveLevel } = runFragment(`${oneLiner('lib/studio-thinking-levels.ts', 'levelBuildMode')}\n${oneLiner('lib/studio-thinking-levels.ts', 'effectiveLevel')}\nreturn { levelBuildMode, effectiveLevel }`, [])()
const libCache = new Map() // keyed by the lib's own text (null: the file as it is)
const libOf = (on, texts) => { const key = texts[LIB] ?? null; let entry = libCache.get(key); if (!entry) libCache.set(key, entry = {}); return entry[on] ??= load(LIB, { env: on ? { [FLAG]: 'true' } : {}, texts }) }
const EVIDENCE = { strawmanUrl: { strawmanPreviewUrl: 'https://layout.example/p/1' }, strawmanId: { strawmanPresentationId: 'p1' }, finalUrl: { finalPresentationUrl: 'https://layout.example/p/2' }, finalId: { finalPresentationId: 'p2' }, latch: { hasStrawman: true }, all: { hasStrawman: true, strawmanPreviewUrl: 'https://layout.example/p/1', strawmanPresentationId: 'p1', finalPresentationUrl: 'https://layout.example/p/2', finalPresentationId: 'p2' } }
const NO_EVIDENCE = { hasStrawman: false, strawmanPreviewUrl: null, strawmanPresentationId: null, finalPresentationUrl: null, finalPresentationId: null }
const HANDOFFS = { off: { deep_research: false, web_search: false }, on: { deep_research: false, web_search: true }, deep: { deep_research: true, web_search: false } }
const WHILE_LOADING = ['person', 'deep', 'other', 'opened'] // what can happen while a chat loads: the person changes a switch (the composer is there), another writer sets web search, loading ends; nothing else is asked of the page then
/**
 * One page view over the real lines. `page` may be dev's page (no ref, no effect, no wrappers, no hand-off line: the base's view). React's batching is modelled: the setters mark a re-render, and each effect runs after a render exactly when its real dependency array
 * changed; in a commit the base's reset effect (earlier in the page) runs before this change's effect (later). The composer gets the base's two handlers, then the prop spread on top (a later JSX attribute wins); the wrappers are the ones of the latest render, so they hold
 * the chat id the page shows now.
 * Events: pick a level (the picker: the level kept, the build mode it drives), person (the web switch), deep (Deep research), outline (the build gives the chat its outline), latch (Director's latch alone), evidence (one kind of outline evidence), newChat (the base's reset, a new id; the
 * reset effect then puts the picker back), open (opening another chat: the id changes and loading starts), opened (loading ends, the restore and the end of loading commit together), load (open, then opened), runEnd (the run is over: the build mode goes back to Standard), other
 * (another writer sets web search: the plan-based default: nothing tells the rule), handoff (the dashboard hand-off's setters, with the switches the person set there), firstId (the page's first chat gets its id).
 */
function pageMachine(page, { on, firstId = 'c0' }, texts = {}) {
  const lib = libOf(on, texts), frag = fragmentsOf(page), handoff = handoffOf(page), reset = resetOf(page)
  const view = { sessionId: firstId, thinkingLevel: 'auto', mode: 'standard', loading: false, ...NO_EVIDENCE }
  let web = false, deep = false, prevDeps = null, prevResetDeps = undefined, chats = 0, dirty = false, incoming = 'none'
  const setWeb = value => { if (value !== web) { web = value; dirty = true } }, setDeep = value => { if (value !== deep) { deep = value; dirty = true } }
  const setMode = value => { if (value !== view.mode) { view.mode = value; dirty = true } }, setLevel = value => { if (value !== view.thinkingLevel) { view.thinkingLevel = value; dirty = true } }
  const baseResearch = handlerOf(page, 'deep')(setDeep, setWeb), baseWeb = handlerOf(page, 'web')(setDeep, setWeb)
  const refReal = frag ? frag.ref(initial => ({ current: initial }), lib.RESEARCH_BY_LEVEL_FRESH) : null
  const agentSessionRef = { current: null }
  const composed = () => { const wrappers = frag ? frag.wrappers(fn => fn, refReal, lib.researchByLevel, baseResearch, baseWeb, view.sessionId) : null; return { onResearchEnabledChange: baseResearch, onWebSearchEnabledChange: baseWeb, ...(frag ? frag.spread(lib.STUDIO_RESEARCH_DEFAULT_BY_LEVEL, wrappers.researchByPerson, wrappers.webSearchByPerson) : {}) } }
  const shown = () => effectiveLevel(view.thinkingLevel, view.mode)
  const args = () => [lib.STUDIO_RESEARCH_DEFAULT_BY_LEVEL, { isLoadingSession: view.loading }, lib.researchByLevel, refReal, view.sessionId, shown(), view.hasStrawman, view.strawmanPreviewUrl, view.strawmanPresentationId, view.finalPresentationUrl, view.finalPresentationId, web, setWeb]
  const resetArgs = () => [true, true, agentSessionChanged, agentSessionRef, view.sessionId, () => {}, 'AGENT_WIRE_RESET', setMode, () => {}, setLevel]
  const render = patch => {
    Object.assign(view, patch); dirty = false
    if (!Object.is(prevResetDeps, view.sessionId)) { prevResetDeps = view.sessionId; reset.effect(...resetArgs())() } // the base's reset effect, keyed on the chat id: it comes before this change's effect in the page
    if (!frag) return
    const deps = frag.deps(...args())()
    if (prevDeps === null || deps.length !== prevDeps.length || deps.some((dep, i) => !Object.is(dep, prevDeps[i]))) { prevDeps = deps; frag.effect(...args())() }
  }
  const commit = patch => { render(patch); for (let n = 0; dirty; n++) { assert.ok(n < 8, 'the page does not settle: an effect keeps changing state'); render({}) } }
  commit({})
  const trace = []
  const machine = {
    get web() { return web }, get deep() { return deep }, get view() { return view }, get shown() { return shown() }, trace,
    do([kind, arg]) {
      if ((view.loading && !WHILE_LOADING.includes(kind)) || (!view.loading && kind === 'opened')) { trace.push([kind, arg ?? null, web, deep, 'not now']); return this }
      if (kind === 'pick') commit({ thinkingLevel: arg, mode: levelBuildMode(arg) })
      else if (kind === 'person') { composed().onWebSearchEnabledChange(arg); if (dirty) commit({}) }
      else if (kind === 'deep') { composed().onResearchEnabledChange(arg); if (dirty) commit({}) }
      else if (kind === 'outline') commit(EVIDENCE.all)
      else if (kind === 'latch') commit(EVIDENCE.latch)
      else if (kind === 'evidence') commit(EVIDENCE[arg])
      else if (kind === 'newChat') { setWeb(false); setDeep(false); commit({ sessionId: `c${++chats}`, loading: false, ...NO_EVIDENCE }) }
      else if (kind === 'open') { incoming = arg; commit({ sessionId: `c${++chats}`, loading: true, ...NO_EVIDENCE }) }
      else if (kind === 'opened') commit({ loading: false, ...(incoming === 'outlined' ? EVIDENCE.all : {}) })
      else if (kind === 'load') { machine.do(['open', arg]); machine.do(['opened']) }
      else if (kind === 'runEnd') commit({ mode: 'standard' })
      else if (kind === 'other') { setWeb(arg); commit({}) }
      else if (kind === 'handoff') { handoff.run(lib.STUDIO_RESEARCH_DEFAULT_BY_LEVEL, lib.researchByLevel, refReal, setDeep, setWeb, { ...HANDOFFS[arg], new_session_id: view.sessionId }); if (dirty) commit({}) }
      else if (kind === 'firstId') commit({ sessionId: arg })
      else throw new Error(`unknown event ${kind}`)
      trace.push([kind, arg ?? null, web, deep])
      return this
    },
  }
  return machine
}
/** The same events, in words (independent of the page's text and of the lib's): web search and deep research after them. `level` is the level the picker shows. */
function specView(events, { on }) {
  let web = false, deep = false, level = 'auto', chat = { touched: false, auto: false, outlined: false }, loading = false, incoming = null
  const direct = () => level === 'best' || level === 'max'
  const rule = () => { // after a change of level or of outline, in a chat the rule still owns
    if (!on || chat.touched || chat.outlined) return
    if (direct()) { if (!web) { web = true; chat.auto = true } } else if (chat.auto) { chat.auto = false; web = false }
  }
  const touch = () => { if (loading) incoming.touched = true; else chat.touched = true } // a change made while the next chat loads is that chat's
  for (const [kind, arg] of events.flatMap(([k, a]) => (k === 'load' ? [['open', a], ['opened']] : [[k, a]]))) { // load is open, then opened
    if ((loading && !WHILE_LOADING.includes(kind)) || (!loading && kind === 'opened')) continue
    if (kind === 'pick') { if (arg !== level) { level = arg; rule() } } // picking the level the picker already shows is not a move
    else if (kind === 'person') { web = arg; if (!arg) deep = false; touch() }
    else if (kind === 'deep') { deep = arg; if (arg) web = true; touch() }
    else if (kind === 'handoff') { deep = HANDOFFS[arg].deep_research; web = HANDOFFS[arg].web_search || HANDOFFS[arg].deep_research; chat.touched = true } // the person's own choice, made on the dashboard, for the chat the hand-off opens
    else if (kind === 'outline' || kind === 'latch' || kind === 'evidence') chat.outlined = true
    else if (kind === 'newChat') { web = false; deep = false; chat = { touched: false, auto: false, outlined: false }; level = 'auto' }
    else if (kind === 'open') { loading = true; incoming = { outlined: arg === 'outlined', touched: false }; level = 'auto' } // the level goes back to Auto with the chat id; the rule looks at the chat when loading ends
    else if (kind === 'opened') { // the rule's own switch does not follow the person into a chat that has no outline (nor over a choice they made for it while it loaded); the chat starts over
      if (on && chat.auto && !chat.touched && !incoming.touched && !incoming.outlined) web = false
      chat = { touched: incoming.touched, auto: false, outlined: incoming.outlined }; loading = false; incoming = null
    }
    else if (kind === 'runEnd') { if (level !== 'auto') { level = 'auto'; rule() } }
    else if (kind === 'other') web = arg
    else if (kind === 'firstId') { /* the id arriving changes nothing for a chat that already is the page's */ }
  }
  return { web, deep }
}
const LEVELS = ['auto', 'fast', 'balanced', 'best', 'max']
const VOCAB = [...LEVELS.map(l => ['pick', l]), ['person', true], ['person', false], ['deep', true], ['outline'], ['latch'], ['newChat'], ['open', 'none'], ['open', 'outlined'], ['opened'], ['runEnd'], ['other', true], ['other', false], ['handoff', 'off'], ['handoff', 'on'], ['handoff', 'deep']]
const SMALL = [['pick', 'best'], ['pick', 'max'], ['pick', 'fast'], ['person', true], ['person', false], ['outline'], ['newChat'], ['open', 'none'], ['opened'], ['runEnd'], ['handoff', 'off']]
const sequenceCache = new Map()
const sequencesOf = (vocab, max) => { const key = `${vocab.length}:${max}`; if (!sequenceCache.has(key)) { const out = [[]]; let layer = [[]]; for (let n = 0; n < max; n++) { layer = layer.flatMap(prefix => vocab.map(event => [...prefix, event])); for (const sequence of layer) out.push(sequence) } sequenceCache.set(key, out) } return sequenceCache.get(key) }
const eventLabel = events => events.map(([kind, arg]) => arg === undefined ? kind : `${kind}:${arg}`).join(' > ') || '(a fresh page)'
const run = (page, o, events, texts) => events.reduce((m, event) => m.do(event), pageMachine(page, o, texts))
function pageBehaviourChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE)
  assert.ok(fragmentsOf(page), 'the page has the marked lines')
  assert.equal(fragmentsOf(base), null, 'dev\'s page has none of them')
  const web = (events, o = {}) => run(page, { on: true, ...o }, events, texts).web
  const view = (events, o = {}) => { const m = run(page, { on: true, ...o }, events, texts); return { web: m.web, deep: m.deep } }
  // the named cases, one or two per rule
  assert.equal(web([]), false, 'a fresh page: web search off')
  assert.equal(web([['pick', 'best']]), true, 'rule 1: Best in a chat with no outline: on')
  assert.equal(web([['pick', 'max']]), true, 'rule 1: Max the same')
  assert.equal(web([['pick', 'best'], ['pick', 'max']]), true, 'Best then Max: still on')
  assert.equal(web([['pick', 'fast']]), false, 'Fast alone: nothing (off already)')
  assert.equal(web([['pick', 'balanced']]), false, 'Balanced alone: nothing')
  assert.equal(web([['pick', 'best'], ['pick', 'fast']]), false, 'rule 2: Best, then Fast: off again')
  assert.equal(web([['pick', 'best'], ['pick', 'balanced']]), false, 'Best, then Balanced: off again')
  assert.equal(web([['pick', 'max'], ['pick', 'auto']]), false, 'Max, then back to Auto: off again')
  assert.equal(web([['pick', 'best'], ['runEnd']]), false, 'Best, then the automatic return to Auto after a run (no outline): off again')
  assert.equal(web([['pick', 'best'], ['pick', 'fast'], ['pick', 'best']]), true, 'Best, Fast, Best: on again (the rule can turn it on again until the person touches it)')
  assert.equal(web([['other', true], ['pick', 'best'], ['pick', 'fast']]), true, 'rule 2: already on by another writer before Best: stays on when the level moves to Fast')
  assert.equal(web([['person', true], ['pick', 'best'], ['pick', 'fast']]), true, 'the person turned it on first, then Best, then Fast: stays on')
  assert.equal(web([['person', true], ['person', false], ['pick', 'best']]), false, 'rule 3: the person turned it on and off, then Best: stays off')
  assert.equal(web([['pick', 'best'], ['person', false], ['pick', 'max']]), false, 'rule 3: on by the rule, the person turns it off, then Max: stays off')
  assert.equal(web([['pick', 'best'], ['person', false], ['pick', 'fast'], ['pick', 'best']]), false, 'and it stays off however the level moves after that')
  assert.equal(web([['pick', 'best'], ['person', true], ['pick', 'fast']]), true, 'rule 3: on by the rule, the person sets it on (the same value), then Fast: the switch is the person\'s now, so it stays on')
  assert.equal(web([['pick', 'best'], ['deep', true], ['pick', 'fast']]), true, 'turning Deep research on is the person\'s own change (it turns web search on): Fast leaves it on')
  assert.deepEqual(view([['pick', 'best'], ['deep', true], ['pick', 'fast']]), { web: true, deep: true }, 'and deep research stays what the person made it')
  assert.deepEqual(view([['pick', 'best'], ['pick', 'max'], ['pick', 'fast']]), { web: false, deep: false }, 'deep research is never touched by the rule')
  assert.equal(web([['load', 'outlined'], ['pick', 'best']]), false, 'rule 4: a chat opened with its outline: Best does nothing')
  assert.equal(web([['pick', 'best'], ['outline'], ['runEnd']]), true, 'rule 4: the outline arrives, then the level returns to Auto: the rule does nothing, the switch stays')
  assert.equal(web([['pick', 'best'], ['latch'], ['pick', 'fast']]), true, 'rule 4: Director\'s latch alone ends the rule')
  assert.equal(web([['load', 'none'], ['pick', 'best']]), true, 'a chat opened with no outline: Best turns it on')
  for (const name of ['strawmanUrl', 'strawmanId', 'finalUrl', 'finalId', 'latch']) {
    assert.equal(web([['load', 'none'], ['evidence', name], ['pick', 'best']]), false, `rule 4: ${name} alone is an outline: Best does nothing`)
    assert.equal(web([['load', 'none'], ['pick', 'best'], ['evidence', name], ['pick', 'fast']]), true, `rule 4: ${name} alone ends the rule: Fast leaves the switch on`)
  }
  assert.equal(web([['pick', 'best'], ['newChat']]), false, 'rule 3: a new chat starts over (the base\'s reset turns the switch off)')
  assert.equal(web([['pick', 'best'], ['newChat'], ['pick', 'best']]), true, 'a new chat: Best turns it on again')
  assert.equal(web([['person', false], ['newChat'], ['pick', 'best']]), true, 'the person\'s change in the chat before does not carry into the new chat')
  assert.equal(web([['pick', 'best'], ['person', false], ['newChat'], ['pick', 'best'], ['pick', 'fast']]), false, 'a new chat after a touch: the rule works again there')
  assert.equal(web([['pick', 'best'], ['load', 'none']]), false, 'opening another chat with no outline: the switch the rule turned on does not follow (the level went back to Auto)')
  assert.equal(web([['pick', 'best'], ['load', 'outlined']]), true, 'opening a chat that has its outline: nothing is unlocked, the rule does nothing there')
  assert.equal(web([['pick', 'best'], ['person', true], ['load', 'none']]), true, 'the person touched the switch: it follows them as the base does')
  assert.equal(web([['pick', 'best'], ['load', 'none'], ['pick', 'best']]), true, 'and Best in the chat they opened turns it on there')
  assert.equal(web([['pick', 'best'], ['firstId', 'c0']], { firstId: null }), true, 'a page whose first chat has no id yet: Best works, and the id arriving changes nothing')
  assert.equal(web([['pick', 'best'], ['firstId', 'c0'], ['pick', 'fast']], { firstId: null }), false, 'and Fast after the id arrives takes it back')
  assert.equal(web([['person', true], ['person', false], ['firstId', 'c0'], ['pick', 'best']], { firstId: null }), false, 'a change made before the first chat had an id is that chat\'s: it is not undone by the id arriving')
  // (1) the dashboard hand-off is the person's own choice, for the chat it opens, whatever its value (FRONTEND-1's ruling): the rule does nothing in that chat
  assert.equal(web([['handoff', 'off'], ['pick', 'best']]), false, 'a hand-off that carried web search OFF: Best does not turn it on')
  assert.equal(web([['handoff', 'off'], ['pick', 'max'], ['pick', 'fast']]), false, 'and Max, Fast after it change nothing')
  assert.equal(web([['handoff', 'on'], ['pick', 'best'], ['pick', 'fast']]), true, 'a hand-off that carried web search ON: Best, then Fast, leave it on (it is the person\'s, not the rule\'s)')
  assert.deepEqual(view([['handoff', 'deep'], ['pick', 'best'], ['pick', 'fast']]), { web: true, deep: true }, 'a hand-off that carried Deep research (which turns web search on): both stay as the person set them')
  assert.equal(web([['pick', 'best'], ['handoff', 'off'], ['pick', 'fast'], ['pick', 'best']]), false, 'the hand-off\'s setters win over a switch the rule had turned on, and the rule does nothing more after them')
  assert.equal(web([['handoff', 'off'], ['newChat'], ['pick', 'best']]), true, 'the hand-off\'s choice is that chat\'s: a new chat starts over')
  assert.equal(web([['handoff', 'off'], ['load', 'none'], ['pick', 'best']]), true, 'and so does an opened chat')
  assert.equal(web([['pick', 'best'], ['handoff', 'on'], ['load', 'none']]), true, 'the rule does not take back what a hand-off set (it is the person\'s)')
  // (2) a change made while the next chat loads is that chat's, and is not lost when the rule first looks at the chat
  assert.equal(web([['pick', 'best'], ['open', 'none'], ['person', false], ['opened'], ['pick', 'best']]), false, 'Best, open another chat, switch web search off while it loads, loading ends, Best: it stays off')
  assert.equal(web([['pick', 'best'], ['open', 'none'], ['person', true], ['opened']]), true, 'Best, open another chat, switch web search on while it loads: the rule does not take its switch back over the person\'s choice')
  assert.equal(web([['pick', 'best'], ['open', 'none'], ['opened']]), false, 'with no change made while it loaded the rule takes its own switch back, as before')
  assert.equal(web([['pick', 'best'], ['open', 'none'], ['deep', true], ['opened'], ['pick', 'best'], ['pick', 'fast']]), true, 'Deep research switched on while the next chat loads is the person\'s change for it')
  assert.equal(web([['person', false], ['open', 'none'], ['opened'], ['pick', 'best']]), true, 'a change made in the chat before is not carried to the chat that was opened')
  assert.equal(web([['open', 'none'], ['person', false], ['opened'], ['load', 'none'], ['pick', 'best']]), true, 'and a change made for one chat while it loaded is not carried to the next chat either')
  assert.equal(web([['open', 'outlined'], ['person', false], ['opened'], ['pick', 'best']]), false, 'a chat opened with its outline: nothing happens, whatever was changed')
  // (3) the first sight of a changed chat is the state\'s (fresh); the picker is back on Auto one render later because the page\'s own reset effect (RUN here) says so
  assert.equal(web([['pick', 'best'], ['newChat'], ['pick', 'best']]), true, 'a new chat: the level the page kept was reset, so Best is a move again')
  assert.equal(web([['pick', 'max'], ['open', 'none'], ['opened'], ['pick', 'max']]), true, 'an opened chat: the same')
  const m = pageMachine(page, { on: true }, texts).do(['pick', 'best']).do(['open', 'none'])
  assert.equal(m.shown, 'auto', 'the picker shows Auto as soon as the chat id has changed (the reset effect has run)')
  // flag off: never changes anything
  for (const events of [[['pick', 'best']], [['pick', 'best'], ['pick', 'fast']], [['pick', 'max'], ['runEnd']], [['handoff', 'off'], ['pick', 'best']], [['pick', 'best'], ['open', 'none'], ['person', false], ['opened'], ['pick', 'best']]]) assert.equal(run(page, { on: false }, events, texts).web, run(base, { on: false }, events).web, `flag off: ${eventLabel(events)}`)
  // every run of up to four events (five over a smaller vocabulary), page = spec; flag off: page = dev's page
  let runs = 0, turnedOn = 0
  for (const events of [...sequencesOf(VOCAB, 4), ...sequencesOf(SMALL, 5).filter(e => e.length === 5)]) { const m = run(page, { on: true }, events, texts); runs++; if (m.web) turnedOn++; assert.deepEqual({ web: m.web, deep: m.deep }, specView(events, { on: true }), `flag on: ${eventLabel(events)}`) }
  assert.ok(runs > 300000 && turnedOn > 20000 && turnedOn < runs - 20000, `a real number of runs, many ending on and many off (${runs} runs, ${turnedOn} on)`)
  const hashOf = (p, on) => { const h = crypto.createHash('sha256'), t = []; for (const events of sequencesOf(VOCAB, 4)) { const m = run(p, { on }, events, p === page ? texts : {}); h.update(JSON.stringify([eventLabel(events), m.trace])); t.push(m.web ? 1 : 0) } return { digest: h.digest('hex'), runs: t.length } }
  const ours = hashOf(page, false), dev = hashOf(base, false)
  assert.ok(ours.runs > 150000, 'a real number of runs')
  assert.deepEqual(ours, dev, 'flag off: the sha256 of every run\'s event-by-event trace is dev\'s page\'s, run for run')
}

// ============================================================================================================================================
// B2. the page's text
// ============================================================================================================================================
const DEPS_NOW = '[currentSessionId, shownThinkingLevel, hasStrawman, strawmanPreviewUrl, strawmanPresentationId, finalPresentationUrl, finalPresentationId, session.isLoadingSession]'
const OUTLINE_TEST = '!(hasStrawman || strawmanPreviewUrl || strawmanPresentationId || finalPresentationUrl || finalPresentationId)'
function pageTextChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE), lines = page.split('\n')
  const frag = fragmentsOf(page)
  assert.ok(frag, 'the page has the marked lines')
  assert.equal(frag.depsText, DEPS_NOW, 'the effect is keyed on the chat, the shown level, the outline evidence and the end of loading (not on the switch: a change of the switch decides nothing)')
  assert.equal(lines.filter(line => /\buseEffect\(/.test(line) && MARKER_RE.test(line)).length, 1, 'one marked effect')
  assert.ok(lines[frag.start + 1].startsWith('    if (!STUDIO_RESEARCH_DEFAULT_BY_LEVEL || session.isLoadingSession) return'), 'the effect returns first when the flag is off (and while the chat is loading): flag off, nothing in it runs')
  assert.ok(page.indexOf(EFFECT_START) > page.indexOf('  const session = useBuilderSession({'), 'the effect sits after the session hook (it reads session.isLoadingSession)')
  assert.ok(page.indexOf(EFFECT_START) > page.indexOf('  const shownThinkingLevel = effectiveLevel('), 'and after the shown level is computed')
  assert.ok(page.indexOf(EFFECT_START) > page.indexOf('  useEffect(() => { // RESEARCH-DEFAULT'), 'and after the plan-based default\'s effect (the default is decided first)')
  assert.ok(page.indexOf(REF_START) < page.indexOf(PERSON_START) && page.indexOf(PERSON_START) < page.indexOf(WEB_START), 'the ref, then the two wrappers')
  assert.ok(page.indexOf(WEB_START) > page.indexOf(HANDLER_NAMES.web), 'the wrappers sit after the base\'s two handlers they call')
  // the outline test is the plan-based default's own, word for word
  const defaultLine = lineWith(page, 'setWebSearchEnabled(!(hasStrawman')
  assert.ok(defaultLine.includes(OUTLINE_TEST), 'the plan-based default\'s line holds the outline test')
  assert.ok(lines[frag.start + 2].includes(`noOutline: ${OUTLINE_TEST}`), 'this effect uses exactly the same test')
  assert.ok(lines[frag.start + 2].includes('level: shownThinkingLevel') && lines[frag.start + 2].includes('chat: currentSessionId') && lines[frag.start + 2].includes('web: webSearchEnabled'), 'the shown level (what the picker shows), the chat id and the switch\'s value go in')
  // the one marked writer of web search is inside the effect, and it sets what the pure function said
  const writers = text => text.split('\n').map((line, index) => ({ line, index })).filter(({ line }) => /\bsetWebSearchEnabled\(/.test(line))
  const mine = writers(page).filter(({ line }) => MARKER_RE.test(line)), others = writers(page).filter(({ line }) => !MARKER_RE.test(line))
  assert.deepEqual(others.map(({ line }) => line), writers(base).map(({ line }) => line), 'every other line that sets web search is the base\'s (the plan-based default, the handlers, the hand-off, the reset)')
  assert.equal(mine.length, 1, 'this change sets web search in one place')
  assert.ok(mine[0].index > frag.start && mine[0].index < frag.end, 'inside the effect')
  assert.ok(mine[0].line.includes('if (decided.web !== undefined) setWebSearchEnabled(decided.web)'), 'and only when the answer carries a value')
  // the rest of the marked lines do not touch deep research or the knowledge graph, and nothing else carries the marker
  const marked = lines.filter(line => MARKER_RE.test(line))
  assert.equal(marked.length, 12, 'twelve marked lines in the page: the import, the ref, two wrappers, the hand-off\'s one line, the prop spread and six in the effect')
  assert.equal(marked.filter(line => /\bsetResearchEnabled\(|setKnowledgeGraphEnabled|useState\(|knowledgeGraph/.test(line)).length, 0, 'no marked line sets deep research or the knowledge graph (deep research only goes through the base\'s own handler)')
  assert.equal(marked.filter(line => /\bhandleResearchEnabledChange\(enabled\)|\bhandleWebSearchEnabledChange\(enabled\)/.test(line)).length, 2, 'the two wrappers call the base\'s own handlers')
  const TOUCH_CALL = "researchByLevel(researchLevelRef.current, { kind: 'touch', chat: currentSessionId })"
  const wrapperLine = (l, handler) => { assert.ok(l.indexOf(TOUCH_CALL) > 0 && l.indexOf(TOUCH_CALL) < l.indexOf(`${handler}(enabled)`), 'the person\'s change is noted first, for the chat the page shows now, then the base\'s handler runs'); assert.ok(l.includes(`[${handler}, currentSessionId])`), 'the wrapper is made again when the chat changes (it holds the chat the page shows)') }
  wrapperLine(frag.personLine, 'handleResearchEnabledChange'); wrapperLine(frag.webLine, 'handleWebSearchEnabledChange')
  assert.ok(page.indexOf(REF_START) > page.indexOf('  const [currentSessionId, setCurrentSessionId] = useState'), 'the ref and the wrappers sit after the chat id state (they hold the chat id)')
  // (1) the dashboard hand-off: one marked line, keyed to the chat the hand-off opens, guarded by the flag, after the base\'s four setters and the file clear (the setters stay together)
  const handoffMine = lines.filter(line => MARKER_RE.test(line) && line.includes('pending.new_session_id')); assert.equal(handoffMine.length, 1, 'one marked hand-off line')
  assert.ok(handoffMine[0].startsWith("    if (STUDIO_RESEARCH_DEFAULT_BY_LEVEL) researchLevelRef.current = researchByLevel(researchLevelRef.current, { kind: 'touch', chat: pending.new_session_id }).state // RESEARCH-BY-LEVEL"), 'it records a touch for the hand-off\'s own chat, only with the flag on')
  const at = lines.indexOf(handoffMine[0])
  assert.deepEqual(lines.slice(at - 6, at), ['    setSessionStoreName(pending.store_name)', '    setResearchEnabled(pending.deep_research)', '    setWebSearchEnabled(pending.web_search || pending.deep_research)', '    setExtendedGenerationEnabled(pending.extended_generation)', '    setKnowledgeGraphEnabled(pending.use_knowledge_graph)', '    clearAllFiles()'], 'it sits right after the base\'s hand-off setters and clearAllFiles, which are the base\'s lines in the base\'s order')
  // (3) the page\'s own reset of the picker on a chat change: the base\'s lines are all still there (the rule\'s first sight of a changed chat relies on them), and run before this change\'s effect
  const resetLines = base.split('\n').filter(line => line.includes('agentSessionChanged(agentSessionRef.current, currentSessionId)')); assert.equal(resetLines.length, 2, 'the base has its two session-change lines (the build mode back to Standard, the picked level back to Auto)')
  for (const line of resetLines) assert.equal(lines.filter(l => l === line).length, 1, `the base's session-change reset line is in the page once: ${line.trim().slice(0, 110)}`)
  assert.ok(resetLines.some(l => l.includes("setBuildMode('standard')")) && resetLines.some(l => l.includes("setThinkingLevel('auto')")), 'one resets the build mode, one the level')
  assert.ok(resetOf(page).start < frag.start, 'the reset effect is earlier in the page than this change\'s effect (so it runs first in a commit)')
  // the prop spread: after the base's two props, in the same element, on only with the flag
  const research = lines.indexOf('                    onResearchEnabledChange={handleResearchEnabledChange}'), webProp = lines.indexOf('                    onWebSearchEnabledChange={handleWebSearchEnabledChange}')
  assert.ok(research > 0 && webProp === research + 2, 'the base\'s two research props are where the base has them')
  assert.ok(frag.spreadAt > webProp && frag.spreadAt < webProp + 3, 'the prop spread comes right after them (a later attribute wins in JSX)')
  const spread = frag.spread(true, 'P', 'W'), off = frag.spread(false, 'P', 'W')
  assert.deepEqual(JSON.parse(JSON.stringify(spread)), { onResearchEnabledChange: 'P', onWebSearchEnabledChange: 'W' }, 'flag on: the composer gets the two wrappers')
  assert.deepEqual(JSON.parse(JSON.stringify(off)), {}, 'flag off: nothing is added, the base\'s props stand')
  // the names of this change are used on marked lines only
  assert.equal(lines.filter(line => /\bresearchLevelRef\b|\bresearchByPerson\b|\bwebSearchByPerson\b|\bresearchByLevel\b|\bRESEARCH_BY_LEVEL_FRESH\b|\bSTUDIO_RESEARCH_DEFAULT_BY_LEVEL\b/.test(line) && !MARKER_RE.test(line)).length, 0, 'the names this change brings are used on marked lines only')
  assert.equal(lineWith(page, "from '@/lib/studio-research-by-level'"), "import { RESEARCH_BY_LEVEL_FRESH, STUDIO_RESEARCH_DEFAULT_BY_LEVEL, researchByLevel, type ResearchByLevelState } from '@/lib/studio-research-by-level' // RESEARCH-BY-LEVEL", 'the import is the lib\'s flag, first state, function and state type')
  // the base's own lines this change leans on are untouched
  for (const line of ['  const [webSearchEnabled, setWebSearchEnabled] = useState(false)', '  const [researchEnabled, setResearchEnabled] = useState(false)', '    setWebSearchEnabled(false)', '    setWebSearchEnabled(pending.web_search || pending.deep_research)']) assert.ok(lines.includes(line), `the base's line is still there: ${line.trim()}`)
}

// ============================================================================================================================================
// C. only insertions: the strip gives dev's page byte for byte
// ============================================================================================================================================
function pageDiffChecks(texts = {}, strip = STRIP_FN, edits = EDITS) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE)
  const out = strip(PAGE, laterOnly(PAGE, page))
  assert.equal(out, base, `${PAGE}: without this change's lines the page is dev's, byte for byte`)
  assert.equal(strip(PAGE, out), out, `${PAGE}: stripping twice changes nothing more`)
  assert.notEqual(page, base, `${PAGE}: the change is there to strip`)
  const diff = lineDiff(base, page)
  assert.deepEqual(diff.removed, [], 'no base line is rewritten or lost: every change to the page is a pure insertion')
  assert.equal(edits[PAGE].filter(([, was]) => was !== '').length, 0, 'every pair of the strip is an insertion (its `was` is empty)')
  assert.equal(edits[PAGE].length, 12, 'twelve insertions, one per marked line (the older proofs that count a peer\'s lines read them one at a time)')
  assert.ok(edits[PAGE].every(([has]) => has.endsWith('\n') && has.split('\n').length === 2), 'each is one whole line')
  for (const line of diff.added) assert.match(line, MARKER_RE, `a line added to the page carries the marker: ${line.trim().slice(0, 100)}`)
  assert.deepEqual([...diff.added].sort(), edits[PAGE].flatMap(([has]) => has.split('\n').filter(Boolean)).sort(), 'the lines added to the page are exactly the strip\'s')
  // four places: the wrappers' three lines, the effect's six, the spread, the import
  const at = page.split('\n').map((line, i) => MARKER_RE.test(line) && !/RESEARCH-DEFAULT/.test(line) ? i : -1).filter(i => i >= 0)
  const groups = at.reduce((out, i) => (out.length && i === out.at(-1).at(-1) + 1 ? out.at(-1).push(i) : out.push([i]), out), [])
  assert.deepEqual(groups.map(g => g.length), [3, 6, 1, 1, 1], 'five places: three lines (the ref and the two wrappers), six (the effect), one (the hand-off\'s), one (the prop spread), one (the import)')
  for (const rel of APP_FILES) assert.equal(STRIP_FN(rel, 'x\nRESEARCH-BY-LEVEL\n'), 'x\nRESEARCH-BY-LEVEL\n', 'a text with no edit in it comes back as it is')
  for (const rel of ['hooks/use-deckster-websocket-v2.ts', 'hooks/use-builder-session.ts', 'components/builder/chat-input.tsx', 'lib/studio-research-default.ts', ENV, REGISTRY]) assert.equal(STRIP_FN(rel, 'x\nRESEARCH-BY-LEVEL\n'), 'x\nRESEARCH-BY-LEVEL\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(STRIP_FN(PAGE, 5), 5, 'a text that is not a string comes back as it is')
  // the files this change must not touch are the base's, byte for byte
  for (const rel of ['hooks/use-deckster-websocket-v2.ts', 'hooks/use-builder-session.ts', 'components/builder/chat-input.tsx', 'lib/studio-research-default.ts', 'lib/studio-thinking-levels.ts']) assert.equal(texts[rel] ?? read(rel), baseText(rel), `${rel} is the base's file, byte for byte`)
}
const PIN_GAINS = { 'scripts/test-studio-research-default.mjs': 2, 'scripts/test-studio-replace-picture-hero-only.mjs': 2, 'scripts/test-studio-my-companions-wiring.mjs': 2, 'scripts/test-studio-chat-element-edit.mjs': 1, 'scripts/test-studio-deck-sync-truth.mjs': 1 }
function pinChecks(texts = {}, mod = stripModule) {
  const strip = mod.stripResearchByLevel, pinFiles = mod.RESEARCH_BY_LEVEL_PIN_FILES
  assert.deepEqual([...pinFiles].sort(), Object.keys(PIN_GAINS).sort(), 'the older proofs this change teaches: the three that pin the raw page (the plan-based default\'s, the hero-only Replace picture\'s, the My companions wiring\'s) and the two that read the first-parent line')
  for (const [rel, gained] of Object.entries(PIN_GAINS)) {
    const now = laterOnly(rel, texts[rel] ?? read(rel)), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's lines the proof is dev's, byte for byte`)
    assert.equal(strip(rel, strip(rel, now)), strip(rel, now), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, gained], `${rel}: the proof gains ${gained} marked line(s) and loses none`)
    for (const line of diff.added) assert.ok(line.includes(mod.RESEARCH_BY_LEVEL_PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
  }
  for (const rel of ['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs']) for (const line of lineDiff(baseText(rel), texts[rel] ?? read(rel)).added) assert.ok(line.includes('shas.splice') && line.includes('^Research by level:') && !line.includes('Research default') && !line.includes('Research switch'), `${rel}: the line is a splice that names this change's own subject, and only that`)
  for (const rel of ['scripts/test-studio-research-default.mjs', 'scripts/test-studio-replace-picture-hero-only.mjs', 'scripts/test-studio-my-companions-wiring.mjs']) {
    const fp = lineDiff(baseText(rel), texts[rel] ?? read(rel)).added
    assert.equal(fp.filter(l => l.startsWith("import { stripResearchByLevel, RESEARCH_BY_LEVEL_FILES } from './studio-research-by-level-strip.mjs'")).length, 1, `${rel}: imports this change's own strip (not the registry)`)
    assert.equal(fp.filter(l => l.startsWith('{ const realRead = fs.readFileSync;') && l.includes('RESEARCH_BY_LEVEL_FILES.includes(rel) ? stripResearchByLevel(rel, out) : out') && !l.includes('registry.')).length, 1, `${rel}: reads the files this change marks through it`)
  }
  assert.equal(Object.values(mod.RESEARCH_BY_LEVEL_PIN_EDITS).flat().every(([, was]) => was === ''), true, 'every pin edit is a pure insertion')
}

// ============================================================================================================================================
// D. .env.example: one block, at the very end
// ============================================================================================================================================
function envChecks(texts = {}, block = ENV_BLOCK) {
  const env = texts[ENV] ?? read(ENV)
  assert.ok(env.endsWith(`\n${block}`), '.env.example ends with the block (at the very end)')
  assert.equal(env.slice(0, env.length - block.length - 1), baseText(ENV), '.env.example is dev\'s file plus that one blank-line-separated block')
  assert.equal(baseText(ENV).trimEnd().split('\n').at(-1), 'NEXT_PUBLIC_STUDIO_THINKING_LEVELS_MAX_LIVE="false"', 'the block follows the last block of the line this change is stacked on (PR 644\'s)')
  assert.equal((env.match(new RegExp(`^${FLAG}=`, 'gm')) || []).length, 1, `.env.example assigns ${FLAG} once`)
  assert.equal(block.split('\n').at(-2), `${FLAG}="false"`, 'the block ends with its assignment, "false"')
  assert.ok(block.split('\n').filter(line => line && !line.startsWith('#')).length === 1 && block.split('\n').filter(line => line.startsWith('#')).length >= 2, 'comments and one assignment')
  assert.deepEqual([...new Set(block.match(/NEXT_PUBLIC_[A-Z0-9_]+/g))], [FLAG], 'the block names its own flag and no other (an older proof counts flag names)')
  assert.doesNotMatch(block, /STUDIO_RESEARCH_DEFAULT_(ON|FREE)/, 'in particular not the plan-based default\'s')
  for (const words of ['exact value "true"', 'default off', 'Build-time value', 'levels-3/4 default', 'Best or Max turns web search on', 'Fast, Balanced or back to Auto', 'automatic return to Auto after a run or a chat change', 'only when this rule is the one that turned it on', 'while the chat still has no outline', 'own change of the web search switch', 'always wins', 'A new chat starts over', 'Once the chat has an outline the rule does nothing', 'Deep research and the knowledge graph are never touched', 'Off, nothing here runs', 'plan-based research default']) assert.ok(block.includes(words), `the block says: ${words}`)
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes(FLAG), false, 'the registry takes the block out of .env.example')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env), registry.stripLaterEnvBlocks(ENV, baseText(ENV)), 'read through the registry it is what the registry makes of dev\'s file')
}

// ============================================================================================================================================
// E. the registry
// ============================================================================================================================================
const REG_MARK = '// LATER-CHANGE: FRONTEND-1, Research by level'
function registryChecks(text = read(REGISTRY)) {
  const lists = { LATER_CHANGE_FILES: 'RESEARCH_BY_LEVEL_SCOPE_FILES', LATER_ENV_BLOCKS: 'RESEARCH_BY_LEVEL_ENV_BLOCK', LATER_STRIPS: 'stripResearchByLevel' }
  for (const [list, name] of Object.entries(lists)) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n').filter(line => line.trim() !== ''), at = rows.findIndex(line => line.includes('studio-research-by-level-strip.mjs'))
    assert.ok(at > 0, `${list}: this change's line is in the list`)
    assert.equal(at, rows.length - 1, `${list}: the line is at the true end, just above the marker comment`)
    assert.ok(rows[at].includes(`).${name},`), `${list}: the line reads ${name}`)
    assert.equal((text.slice(start, end).match(/studio-research-by-level-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
    assert.ok(rows[at - 1].includes('studio-levels-direct-live-strip.mjs') && rows[at - 2].includes('studio-my-companions-strip.mjs') && rows[at - 3].includes('studio-replace-picture-hero-only-strip.mjs'), `${list}: after PR 644's line, after #642's (My companions), after the hero-only Replace picture's: this change last`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-research-by-level-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes(REG_MARK) && /(?<![\w-])LATER-CHANGE(?![\w-])/.test(line) && line.includes(`(${FLAG})`)), 'each carries the registry marker and the flag')
  const diff = lineDiff(baseText(REGISTRY), text)
  assert.deepEqual(diff.removed, [], 'and loses none'); assert.deepEqual([...diff.added].sort(), [...registered].sort(), 'the three are the only lines it adds')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the block is registered')
  assert.ok([...SCOPE].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  assert.equal(registry.LATER_STRIPS.at(-1), STRIP_FN, 'the strip runs last (the order the changes were stacked)')
  assert.equal(registry.stripLaterChanges(PAGE, read(PAGE)), registry.stripLaterChanges(PAGE, baseText(PAGE)), `${PAGE}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(registry.stripLaterChanges(ENV, read(ENV)), registry.stripLaterChanges(ENV, baseText(ENV)), `${ENV}: read through the registry it is the base's`)
  // the strips of the neighbouring changes leave each other's lines alone, whichever order they run in
  const now = read(PAGE)
  assert.ok(defaultStrip.stripResearchDefault(PAGE, now).includes('RESEARCH-BY-LEVEL') && !defaultStrip.stripResearchDefault(PAGE, now).includes('RESEARCH-DEFAULT'), 'the plan-based default\'s strip takes its lines and leaves this one\'s')
  assert.ok(STRIP_FN(PAGE, now).includes('RESEARCH-DEFAULT') && !STRIP_FN(PAGE, now).includes('RESEARCH-BY-LEVEL'), 'this strip takes its lines and leaves the plan-based default\'s')
  assert.equal(STRIP_FN(PAGE, defaultStrip.stripResearchDefault(PAGE, now)), defaultStrip.stripResearchDefault(PAGE, STRIP_FN(PAGE, now)), 'the two strips commute')
  assert.equal(heroOnlyStrip.stripReplacePictureHeroOnly(PAGE, now), now, 'the hero-only strip leaves the page alone')
}

// ============================================================================================================================================
// F. scope, commits, secrets
// ============================================================================================================================================
const subjectOf = sha => git('log', '-1', '--format=%s', sha)
const own = (...args) => git('rev-list', '--no-merges', ...args, `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter(sha => subjectOf(sha).startsWith(SUBJECT))
/** This change's commits: on the first-parent line, by the subject prefix; once the gate has merged the branch they sit on the merge's second parent, so the whole range is read as well. */
const firstParentCommits = () => own('--first-parent'), allCommits = () => own()
/** The committed files only (BASE..HEAD): never the working tree, which a gate run and the suites write into. */
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body) { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line'); return problems }
function secretChecks(texts = {}) {
  for (const rel of [...APP_FILES, ...NEW_FILES, ENV, REGISTRY]) assert.doesNotMatch(texts[rel] ?? read(rel), SECRET, `${rel}: no secret`)
  for (const sha of allCommits()) assert.doesNotMatch(git('show', '--format=%B', sha), SECRET, `commit ${sha.slice(0, 8)}: no secret in the diff or the message`)
}

// ============================================================================================================================================
// G. one literal read; the names only where they belong
// ============================================================================================================================================
function oneReadChecks(texts = {}) {
  for (const rel of git('ls-files', 'app', 'hooks', 'components', 'lib', 'middleware.ts', 'next.config.mjs').split('\n').filter(Boolean).filter(f => /\.(ts|tsx|mjs|js)$/.test(f))) {
    const text = texts[rel] ?? read(rel)
    assert.equal((text.match(new RegExp(`process\\.env\\.${FLAG}\\b`, 'g')) || []).length, rel === LIB ? 1 : 0, `${rel}: ${rel === LIB ? `reads ${FLAG} once` : `does not read ${FLAG} itself`}`)
  }
  for (const rel of git('grep', '-l', '-E', '-e', 'STUDIO_RESEARCH_DEFAULT_BY_LEVEL', '--', 'app', 'hooks', 'components', 'lib').split('\n').filter(Boolean)) assert.ok([LIB, PAGE].includes(rel), `${rel}: only the lib and the Builder page name the flag`)
  const lib = texts[LIB] ?? read(LIB); assert.equal((lib.match(/process\.env/g) || []).length, 1)
  assert.equal((texts['lib/studio-research-default.ts'] ?? read('lib/studio-research-default.ts')).includes('BY_LEVEL'), false, 'the plan-based default\'s lib does not know this flag: they are independent')
}

// ============================================================================================================================================
// the checks
// ============================================================================================================================================
await check('A. the lib: the flag, one literal read, nothing imported, the pure function as a table of rows, flag off hands the state back', () => libChecks())
await check('B. the page as a page view: every run of up to four events equals the spec in words; named cases for rules 1 to 4; flag off is dev\'s page, sha256 of every trace', () => pageBehaviourChecks())
await check('B2. the page\'s text: the effect\'s keys and first line, the outline test, the one marked writer, the wrappers, the prop spread after the base\'s props, nothing for deep research', () => pageTextChecks())
await check('C. only insertions: the strip gives dev\'s page byte for byte; twelve marked lines in five places', () => pageDiffChecks())
await check('C2. the five older proofs taught: dev\'s text byte for byte without this change\'s marked lines', () => pinChecks())
await check('D. .env.example: one block at the very end, "false", plain words, names only its own flag', () => envChecks())
await check('E. the registry: three lines, marked, at the true end of each list; the strip commutes with its neighbours', () => registryChecks())
await check('F. scope: this change\'s own commits touch only its files; the message; no secret', () => {
  let ancestor = true
  try { git('merge-base', '--is-ancestor', BASE_COMMIT, 'HEAD') } catch { ancestor = false }
  assert.ok(ancestor, 'the strip\'s BASE_COMMIT (the head this change is stacked on, PR 644\'s) is an ancestor of this branch: the Studio Drafts are one line')
  const first = firstParentCommits()
  assert.ok(first.length >= 1 || allCommits().length >= 1, 'this change has commits on the branch')
  scopeCheck(first); scopeCheck(allCommits())
  for (const sha of allCommits()) assert.deepEqual(messageProblems(subjectOf(sha), git('show', '--no-patch', '--format=%B', sha)), [], `commit ${sha.slice(0, 8)}: the message`)
  assert.deepEqual(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter(rel => !SCOPE.has(rel)).sort(), [], 'over the whole committed range no file is outside the scope either')
  secretChecks()
})
await check('G. one literal env read; only the lib and the Builder page name the flag; the plan-based default\'s lib is independent', () => oneReadChecks())

// ============================================================================================================================================
// I. mutants: one edit each of the real sources, fed to the same checks
// ============================================================================================================================================
const TX = (rel, from, to) => ({ [rel]: swap(read(rel), from, to) })
const libMut = (from, to) => TX(LIB, from, to)
const frag0 = () => fragmentsOf(read(PAGE))
const pageMut = (from, to) => TX(PAGE, from, to)
const allLib = texts => { libChecks(texts); pageBehaviourChecks(texts) }
await mutant('lib: the flag is on for "True" as well', () => allLib(libMut("=== 'true'", "=== 'true' || process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL === 'True'")))
await mutant('lib: the flag is on unless it is "false"', () => allLib(libMut("process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL === 'true'", "process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL !== 'false'")))
await mutant('lib: the flag follows the plan-based default\'s flag', () => allLib(libMut("process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL === 'true'", "(process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL === 'true' || process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true')")))
await mutant('lib: the function ignores the flag parameter (always on)', () => allLib(libMut('if (on !== true) return { state: prev }\n', '')))
await mutant('lib: Max does nothing (only Best turns it on)', () => allLib(libMut("event.level === 'best' || event.level === 'max'", "event.level === 'best'")))
await mutant('lib: Balanced turns it on too', () => allLib(libMut("event.level === 'best' || event.level === 'max'", "event.level === 'best' || event.level === 'max' || event.level === 'balanced'")))
await mutant('lib: Best claims the switch even when it was already on (then Fast turns the person\'s switch off)', () => allLib(libMut('return event.web ? { state } : { state: { ...state, auto: true }, web: true }', 'return event.web ? { state: { ...state, auto: true } } : { state: { ...state, auto: true }, web: true }')))
await mutant('lib: Fast turns the switch off even when the rule did not turn it on', () => allLib(libMut('if (state.auto) return', 'if (true) return')))
await mutant('lib: the switch is turned off but the rule still remembers it', () => allLib(libMut('{ state: { ...state, auto: false }, web: false }', '{ state, web: false }')))
await mutant('lib: the person\'s change is ignored (a touch does nothing)', () => allLib(libMut("  if (event.kind === 'touch') {\n", "  if (event.kind === 'touch') return { state: prev }\n  if (event.kind === 'touch') {\n")))
await mutant('lib: a touch for another chat is not kept for it (it is marked on the chat the state knows instead)', () => allLib(libMut("    if (prev.chat !== null && prev.chat !== event.chat) return { state: { ...prev, pending: { chat: event.chat } } }\n", "")))
await mutant('lib: a touch for another chat is kept for no chat', () => allLib(libMut('pending: { chat: event.chat } } }', 'pending: { chat: null } } }')))
await mutant('lib: a touch for another chat is dropped', () => allLib(libMut('return { state: { ...prev, pending: { chat: event.chat } } }', 'return { state: prev }')))
await mutant('lib: a touched chat still decides', () => allLib(libMut('if (state.touched || !event.noOutline) return { state }', 'if (!event.noOutline) return { state }')))
await mutant('lib: an outline does not end the rule', () => allLib(libMut('if (state.touched || !event.noOutline) return { state }', 'if (state.touched) return { state }')))
await mutant('lib: another chat does not start over (the touch carries)', () => allLib(libMut('const fresh: ResearchByLevelState = { chat: event.chat, touched: owned, auto: false, pending: null }', 'const fresh: ResearchByLevelState = { chat: event.chat, touched: owned || prev.touched, auto: false, pending: null }')))
await mutant('lib: another chat does not take the rule\'s switch back', () => allLib(libMut('return !owned && prev.auto && !prev.touched && event.web && event.noOutline ? { state: fresh, web: false } : { state: fresh }', 'return { state: fresh }')))
await mutant('lib: the fresh state for a chat a change was kept for starts untouched', () => allLib(libMut('touched: owned, auto: false, pending: null }', 'touched: false, auto: false, pending: null }')))
await mutant('lib: the rule takes its switch back over a choice made for the chat it is leaving for', () => allLib(libMut('return !owned && prev.auto', 'return prev.auto')))
await mutant('lib: a change kept for another chat stays when the page is back in this one', () => allLib(libMut('  } else if (prev.pending !== null) state = { ...prev, pending: null }', '  }') ))
await mutant('lib: leaving a chat takes the rule\'s switch back even for a chat with an outline', () => allLib(libMut('prev.auto && !prev.touched && event.web && event.noOutline ?', 'prev.auto && !prev.touched && event.web ?')))
await mutant('lib: leaving a chat takes the switch back even when the person touched it', () => allLib(libMut('prev.auto && !prev.touched && event.web && event.noOutline ?', 'prev.auto && event.web && event.noOutline ?')))
await mutant('lib: a state with no chat yet restarts instead of taking the id (the change made before the first id is lost)', () => allLib(libMut('state = { ...prev, chat: event.chat, pending: null }', 'state = { chat: event.chat, touched: false, auto: false, pending: null }')))
await mutant('lib: the function mutates the state it is given', () => allLib(libMut("  if (event.kind === 'touch') {\n", "  if (event.kind === 'touch') prev.touched = true\n  if (event.kind === 'touch') {\n")))
await mutant('lib: the lib reads the network', () => libChecks(libMut('export const STUDIO_RESEARCH_DEFAULT_BY_LEVEL', 'export const NOTE = typeof fetch\nexport const STUDIO_RESEARCH_DEFAULT_BY_LEVEL')))
await mutant('lib: the lib imports something', () => libChecks(libMut('export const STUDIO_RESEARCH_DEFAULT_BY_LEVEL', "import type { ThinkingLevel } from '@/lib/studio-thinking-levels'\nexport const STUDIO_RESEARCH_DEFAULT_BY_LEVEL")))
await mutant('lib: a second env read', () => libChecks(libMut('export const RESEARCH_BY_LEVEL_FRESH', "const other = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON\nexport const RESEARCH_BY_LEVEL_FRESH")))
await mutant('page: the effect does not return first when the flag is off', () => pageTextChecks(pageMut('if (!STUDIO_RESEARCH_DEFAULT_BY_LEVEL || session.isLoadingSession) return', 'if (session.isLoadingSession) return')))
await mutant('page: the effect is not keyed on the shown level', () => pageTextChecks(pageMut('[currentSessionId, shownThinkingLevel, hasStrawman,', '[currentSessionId, hasStrawman,')))
await mutant('page: the effect is not keyed on the shown level (behaviour)', () => pageBehaviourChecks(pageMut('[currentSessionId, shownThinkingLevel, hasStrawman,', '[currentSessionId, hasStrawman,')))
await mutant('page: the effect reads the level the page kept, not the one the picker shows', () => pageTextChecks(pageMut('level: shownThinkingLevel,', 'level: thinkingLevel,')))
await mutant('page: the outline test forgets the final deck id', () => pageBehaviourChecks(pageMut('noOutline: !(hasStrawman || strawmanPreviewUrl || strawmanPresentationId || finalPresentationUrl || finalPresentationId)', 'noOutline: !(hasStrawman || strawmanPreviewUrl || strawmanPresentationId || finalPresentationUrl)')))
await mutant('page: the outline test forgets the final deck id (text)', () => pageTextChecks(pageMut('noOutline: !(hasStrawman || strawmanPreviewUrl || strawmanPresentationId || finalPresentationUrl || finalPresentationId)', 'noOutline: !(hasStrawman || strawmanPreviewUrl || strawmanPresentationId || finalPresentationUrl)')))
await mutant('page: the chat is not passed (every chat is the same chat)', () => pageBehaviourChecks(pageMut('chat: currentSessionId,', "chat: 'same',")))
await mutant('page: the switch\'s value is not passed (always off)', () => pageBehaviourChecks(pageMut('web: webSearchEnabled })', 'web: false })')))
await mutant('page: the effect sets web search whatever the answer says', () => pageBehaviourChecks(pageMut('if (decided.web !== undefined) setWebSearchEnabled(decided.web)', 'setWebSearchEnabled(Boolean(decided.web))')))
await mutant('page: the effect drops the new state', () => pageBehaviourChecks(pageMut('researchLevelRef.current = decided.state // RESEARCH-BY-LEVEL', 'void decided.state // RESEARCH-BY-LEVEL')))
await mutant('page: the effect does not wait for a loading chat', () => pageTextChecks(pageMut('|| session.isLoadingSession) return // RESEARCH-BY-LEVEL', ') return // RESEARCH-BY-LEVEL')))
await mutant('page: the web wrapper does not note the person\'s change', () => pageBehaviourChecks(pageMut("const webSearchByPerson = useCallback((enabled: boolean) => { researchLevelRef.current = researchByLevel(researchLevelRef.current, { kind: 'touch', chat: currentSessionId }).state; ", 'const webSearchByPerson = useCallback((enabled: boolean) => { ')))
await mutant('page: the Deep research wrapper does not note the person\'s change', () => pageBehaviourChecks(pageMut("const researchByPerson = useCallback((enabled: boolean) => { researchLevelRef.current = researchByLevel(researchLevelRef.current, { kind: 'touch', chat: currentSessionId }).state; ", 'const researchByPerson = useCallback((enabled: boolean) => { ')))
await mutant('page: the web wrapper notes the change but does not call the base\'s handler', () => pageBehaviourChecks(pageMut('.state; handleWebSearchEnabledChange(enabled) }', '.state }')))
await mutant('page: the Deep research wrapper calls the web handler', () => pageBehaviourChecks(pageMut('.state; handleResearchEnabledChange(enabled) }, [handleResearchEnabledChange, currentSessionId])', '.state; handleWebSearchEnabledChange(enabled) }, [handleWebSearchEnabledChange, currentSessionId])')))
await mutant('page: the web wrapper notes the touch for no chat', () => pageBehaviourChecks(pageMut("{ kind: 'touch', chat: currentSessionId }).state; handleWebSearchEnabledChange(enabled)", "{ kind: 'touch', chat: null }).state; handleWebSearchEnabledChange(enabled)")))
await mutant('page: the Deep research wrapper notes the touch for no chat', () => pageBehaviourChecks(pageMut("{ kind: 'touch', chat: currentSessionId }).state; handleResearchEnabledChange(enabled)", "{ kind: 'touch', chat: null }).state; handleResearchEnabledChange(enabled)")))
await mutant('page: the web wrapper is not made again when the chat changes (it would hold an old chat id)', () => pageTextChecks(pageMut('[handleWebSearchEnabledChange, currentSessionId])', '[handleWebSearchEnabledChange])')))
await mutant('page: the wrappers sit before the chat id state (they could not hold the chat id)', () => { const lines = read(PAGE).split('\n'), at = lines.indexOf(frag0().refLine); lines.splice(at, 3); lines.splice(lines.indexOf('  const [webSearchEnabled, setWebSearchEnabled] = useState(false)') + 1, 0, ...[frag0().refLine, frag0().personLine, frag0().webLine]); pageTextChecks({ [PAGE]: lines.join('\n') }) })
// (1) the hand-off
const handoffLine = text => text.split('\n').find(line => MARKER_RE.test(line) && line.includes('pending.new_session_id'))
await mutant('page: the hand-off records no touch (the person\'s dashboard choice can be overridden)', () => pageBehaviourChecks(pageMut(`${handoffLine(read(PAGE))}\n`, '')))
await mutant('page: the hand-off records the touch for no chat', () => pageBehaviourChecks(pageMut('{ kind: \'touch\', chat: pending.new_session_id }', '{ kind: \'touch\', chat: null }')))
await mutant('page: the hand-off records the touch for a chat that is not the one it opens', () => pageBehaviourChecks(pageMut('{ kind: \'touch\', chat: pending.new_session_id }', '{ kind: \'touch\', chat: \'elsewhere\' }')))
await mutant('page: the hand-off\'s touch is not behind the flag', () => pageTextChecks(pageMut('    if (STUDIO_RESEARCH_DEFAULT_BY_LEVEL) researchLevelRef.current = researchByLevel(researchLevelRef.current, { kind: \'touch\', chat: pending.new_session_id })', '    researchLevelRef.current = researchByLevel(researchLevelRef.current, { kind: \'touch\', chat: pending.new_session_id })')))
await mutant('page: the hand-off\'s touch sits between the base\'s setters', () => { const text = read(PAGE).split('\n'), mine = handoffLine(read(PAGE)); text.splice(text.indexOf(mine), 1); text.splice(text.indexOf('    setWebSearchEnabled(pending.web_search || pending.deep_research)'), 0, mine); pageTextChecks({ [PAGE]: text.join('\n') }) })
await mutant('page: a base hand-off setter is rewritten', () => pageBehaviourChecks(pageMut('    setWebSearchEnabled(pending.web_search || pending.deep_research)', '    setWebSearchEnabled(pending.web_search)')))
// (3) the page's own reset of the picker on a chat change
const RESET_MODE = "{ dispatchAgentRun(AGENT_WIRE_RESET); setBuildMode('standard'); setBuildModeFrom(undefined) }", RESET_LEVEL = "if (STUDIO_THINKING_LEVELS_ENABLED && agentSessionChanged(agentSessionRef.current, currentSessionId)) setThinkingLevel('auto')"
await mutant('page: the session-change reset loses both its lines (a changed chat keeps the old level for the rule\'s first sight, and after it)', () => pageBehaviourChecks({ [PAGE]: swap(swap(read(PAGE), RESET_MODE, '{ dispatchAgentRun(AGENT_WIRE_RESET); setBuildModeFrom(undefined) }'), RESET_LEVEL, 'if (false) setThinkingLevel(\'auto\')') }))
await mutant('page: the session-change reset loses its build-mode line (text pin)', () => pageTextChecks(pageMut(RESET_MODE, '{ dispatchAgentRun(AGENT_WIRE_RESET); setBuildModeFrom(undefined) }')))
await mutant('page: the session-change reset loses its level line (text pin)', () => pageTextChecks(pageMut(RESET_LEVEL, 'if (false) setThinkingLevel(\'auto\')')))
await mutant('page: the session-change reset is keyed on something else', () => pageBehaviourChecks(pageMut("  }, [currentSessionId]) // AGENT-MODE-WIRE", "  }, []) // AGENT-MODE-WIRE")))
await mutant('page: the prop spread only wraps the web switch', () => pageBehaviourChecks(pageMut('{ onResearchEnabledChange: researchByPerson, onWebSearchEnabledChange: webSearchByPerson }', '{ onWebSearchEnabledChange: webSearchByPerson }')))
await mutant('page: the prop spread is on whatever the flag says', () => pageTextChecks(pageMut('{...(STUDIO_RESEARCH_DEFAULT_BY_LEVEL ? {', '{...(true ? {')))
await mutant('page: the prop spread sits before the base\'s props', () => {
  const text = read(PAGE).split('\n'), at = text.findIndex(l => SPREAD_RE.test(l)); const [spread] = text.splice(at, 1); const research = text.indexOf('                    onResearchEnabledChange={handleResearchEnabledChange}'); text.splice(research, 0, spread)
  pageTextChecks({ [PAGE]: text.join('\n') })
})
await mutant('page: a second marked writer of web search', () => pageTextChecks(pageMut('    researchLevelRef.current = decided.state // RESEARCH-BY-LEVEL\n', '    researchLevelRef.current = decided.state // RESEARCH-BY-LEVEL\n    if (decided.web === false) setWebSearchEnabled(false) // RESEARCH-BY-LEVEL\n')))
await mutant('page: the rule sets deep research', () => pageTextChecks(pageMut('    researchLevelRef.current = decided.state // RESEARCH-BY-LEVEL\n', '    researchLevelRef.current = decided.state // RESEARCH-BY-LEVEL\n    if (decided.web === false) setResearchEnabled(false) // RESEARCH-BY-LEVEL\n')))
await mutant('page: a base line is rewritten (the base\'s web handler)', () => pageDiffChecks(pageMut('    if (!enabled) setResearchEnabled(false)\n  }, [])', '    if (!enabled) setResearchEnabled(false) // RESEARCH-BY-LEVEL\n  }, [])')))
await mutant('page: a line is added without the marker', () => pageDiffChecks(pageMut('    researchLevelRef.current = decided.state // RESEARCH-BY-LEVEL\n', '    researchLevelRef.current = decided.state // RESEARCH-BY-LEVEL\n    void 0\n')))
await mutant('page: an extra marked line (twelve)', () => pageDiffChecks(pageMut('    researchLevelRef.current = decided.state // RESEARCH-BY-LEVEL\n', '    researchLevelRef.current = decided.state // RESEARCH-BY-LEVEL\n    void 0 // RESEARCH-BY-LEVEL\n')))
await mutant('page: another file (the composer) is touched', () => pageDiffChecks({ 'components/builder/chat-input.tsx': `${read('components/builder/chat-input.tsx')}\n` }))
await mutant('page: the plan-based default\'s lib names this flag', () => oneReadChecks({ 'lib/studio-research-default.ts': `${read('lib/studio-research-default.ts')}// BY_LEVEL\n` }))
const stripOf = edits => (rel, text) => (typeof text === 'string' && edits[rel] ? edits[rel].reduce((out, [has, was]) => out.replace(has, () => was), text) : text)
await mutant('strip: a pair is missing (the import stays behind)', () => { const edits = { [PAGE]: EDITS[PAGE].slice(0, -1) }; pageDiffChecks({}, stripOf(edits), edits) })
await mutant('strip: a pair puts back text that is not dev\'s', () => { const edits = { [PAGE]: EDITS[PAGE].map(([has, was], i) => i === 0 ? [has, `${was}  // x\n`] : [has, was]) }; pageDiffChecks({}, stripOf(edits), edits) })
await mutant('strip: one pair is not a whole line', () => { const edits = { [PAGE]: EDITS[PAGE].map(([has, was], i) => i === 0 ? [has.replace(/\n$/, ''), was] : [has, was]) }; pageDiffChecks({}, stripOf(edits), edits) })
await mutant('env: the block names the plan-based default\'s flag', () => envChecks({ [ENV]: read(ENV).replace('Every level later is the plan-based research default', 'Every level later is NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON') }, ENV_BLOCK.replace('Every level later is the plan-based research default', 'Every level later is NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON')))
await mutant('env: the block says "true"', () => envChecks({ [ENV]: read(ENV).replace(`${FLAG}="false"`, `${FLAG}="true"`) }, ENV_BLOCK.replace(`${FLAG}="false"`, `${FLAG}="true"`)))
await mutant('env: the block does not say the person\'s own change wins', () => envChecks({ [ENV]: read(ENV).replace('always wins', 'sometimes wins') }, ENV_BLOCK.replace('always wins', 'sometimes wins')))
await mutant('env: the block is not at the very end', () => envChecks({ [ENV]: `${read(ENV)}\n# STUDIO SOMETHING LATER\nNEXT_PUBLIC_STUDIO_SOMETHING_LATER="false"\n` }))
await mutant('env: the block is missing', () => envChecks({ [ENV]: read(ENV).replace(ENV_BLOCK, '') }))
await mutant('registry: this change\'s strip line is in the middle of its list', () => { const t = read(REGISTRY), line = t.split('\n').find(l => l.includes('studio-research-by-level-strip.mjs') && l.includes('stripResearchByLevel')); const moved = t.replace(`${line}\n`, '').replace('  (await import(\'./studio-replace-picture-hero-only-strip.mjs\')).stripReplacePictureHeroOnly,', `${line}\n  (await import('./studio-replace-picture-hero-only-strip.mjs')).stripReplacePictureHeroOnly,`); registryChecks(moved) })
await mutant('registry: a line is missing (the scope list)', () => registryChecks(read(REGISTRY).split('\n').filter(l => !(l.includes('studio-research-by-level-strip.mjs') && l.includes('SCOPE_FILES'))).join('\n')))
await mutant('registry: a line loses its marker', () => registryChecks(read(REGISTRY).replace('// LATER-CHANGE: FRONTEND-1, Research by level', '// FRONTEND-1, Research by level')))
await mutant('registry: a line is added that is not this change\'s', () => registryChecks(read(REGISTRY).replace('  // one line per later change, above this comment\n])', '  // LATER-CHANGE: someone, something\n  // one line per later change, above this comment\n])')))
await mutant('scope: a stray file in the commit', () => scopeCheck(firstParentCommits(), ['README.md']))
await mutant('message: the subject does not start with the prefix', () => assert.deepEqual(messageProblems('Fix things', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))
await mutant('message: the co-author line is missing', () => assert.deepEqual(messageProblems('Research by level: x', 'body\n'), []))
await mutant('secret: a credential-shaped literal in the lib', () => assert.doesNotMatch(`${read(LIB)}\n// ${'sk-'}${'a'.repeat(24)}\n`, SECRET))
await mutant('older proofs: the plan-based default\'s proof loses its registry read', () => pinChecks({ 'scripts/test-studio-research-default.mjs': read('scripts/test-studio-research-default.mjs').split('\n').filter(l => !l.startsWith('{ const realRead = fs.readFileSync;') || !l.includes('RESEARCH_BY_LEVEL_FILES')).join('\n') }))
await mutant('older proofs: the hero-only Replace picture\'s proof loses its registry read', () => pinChecks({ 'scripts/test-studio-replace-picture-hero-only.mjs': read('scripts/test-studio-replace-picture-hero-only.mjs').split('\n').filter(l => !l.startsWith('{ const realRead = fs.readFileSync;') || !l.includes('RESEARCH_BY_LEVEL_FILES')).join('\n') }))
await mutant('older proofs: the hero-only Replace picture\'s proof reads through the registry instead of this change\'s strip', () => pinChecks({ 'scripts/test-studio-replace-picture-hero-only.mjs': read('scripts/test-studio-replace-picture-hero-only.mjs').replace('RESEARCH_BY_LEVEL_FILES.includes(rel) ? stripResearchByLevel(rel, out) : out', 'RESEARCH_BY_LEVEL_FILES.includes(rel) ? registry.stripLaterChanges(rel, out) : out') }))
await mutant('older proofs: the My companions wiring proof loses its registry read', () => pinChecks({ 'scripts/test-studio-my-companions-wiring.mjs': read('scripts/test-studio-my-companions-wiring.mjs').split('\n').filter(l => !l.startsWith('{ const realRead = fs.readFileSync;') || !l.includes('RESEARCH_BY_LEVEL_FILES')).join('\n') }))
await mutant('older proofs: a splice line names another subject', () => pinChecks({ 'scripts/test-studio-chat-element-edit.mjs': read('scripts/test-studio-chat-element-edit.mjs').replace('^Research by level:/', '^Research by lev:/') }))
await mutant('older proofs: a proof gains an unmarked line', () => pinChecks({ 'scripts/test-studio-deck-sync-truth.mjs': `${read('scripts/test-studio-deck-sync-truth.mjs')}\n// stray\n` }))

console.log(`\n${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) { console.error(`FAILED: ${[...failed, ...missed.map(m => `mutant ${m}`)].join('; ')}`); process.exit(1) }
