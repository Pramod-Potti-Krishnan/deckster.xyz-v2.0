// KNOWLEDGE-3 for FRONTEND-1: proof of the Research default. Flag NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON, the exact string "true", default off.
// On a new chat, or a chat that has no outline yet, web search starts on. A chat that already has an outline opens with web search off, as before. Deep research is unchanged.
// (The page's first `webSearchEnabled` state and its new-chat reset start it on; ONE line in the session-restore wrapper, restoreBuilderSessionMessages, sets it off for a chat opened with its strawman or final deck already in the loaded row.)
// Off, the page is byte for byte what it was.
//
//   node scripts/test-studio-research-default.mjs        (plain node, offline: the REAL sources transpiled and run in a vm; the page's two state lines AND the whole session-restore wrapper are cut out of the real file and RUN, with the flag off and on; git is read for the
//                                                        strip, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to H), then mutants (I):
//  A. the lib: the flag is on for the exact string "true" and for nothing else (unset, "false", "True", "TRUE", "1", " true", "true ", "yes", ""), one literal env read, and the file imports nothing;
//  B. the page, flag off AND on: the first state and the new-chat reset (the two real lines, run) give web search = the flag and deep research false; flag off they are the base's, value for value; the base's own lines give false, false;
//  B2. the OPEN of a chat (the real session-restore wrapper, run, flag off AND on): flag on, a chat opened with its outline (a strawman or a final deck in the loaded row, by url or by id) reads web search off; a new chat reads on; a chat opened with NO outline reads on
//      (blank deck, empty row, nothing loaded); a person's switch in a no-outline chat is not overridden by anything later (the outline appearing in this page view runs nothing); a superseded restore sets nothing; deep research and the restore call itself are
//      the base's; flag off the wrapper's calls are the base's, call for call, and web search is never set;
//  B3. who sets web search: the page's only writers are the base's (the two switch handlers, the new-deck handoff) plus this change's two (the restore line inside the wrapper, the new-chat reset); none reads hasStrawman, the lock or a session id;
//  C. only those lines and the import changed (the strip gives dev's page byte for byte; two base lines rewritten, two lines inserted, every added line carries the marker RESEARCH-DEFAULT);
//  C2. the older proofs this change teaches (six, pure insertions): each is dev's file without those lines, gains only marked lines and loses none, reads the page through this change's own strip (never the registry), drops its subject from the first-parent line, or its lines from the diff it counts;
//  D. deep research and the new-deck handoff are untouched: the deep research state, its reset, the two handlers and the handoff's setters (:6851, the new-deck handoff, not a restore) are the base's lines, and so are the hook's and the composer's files (web_search already goes out on every build message);
//  E. .env.example: the block is the last thing in the file, once, "false", the file is dev's plus that block, and the block (and the lib's comment) say what the flag does;
//  F. the registry: exactly three lines, each marked LATER-CHANGE, in the three lists (the files after the uat marketing-v4 line, the other two at the true end), the strip independent of the neighbouring changes' strips;
//  G. own-commit scope, by the subject prefix "Research default:" on the first-parent line (and, once the gate has merged it, over the whole range), the commit message, and a secret scan;
//  H. the flag is read from one literal env name and nothing but the lib reads it.
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

const { BASE_COMMIT, RESEARCH_DEFAULT_PIN_FILES: PIN_FILES, RESEARCH_DEFAULT_PIN_MARK: PIN_MARK, RESEARCH_DEFAULT_PIN_EDITS: PIN_EDITS, RESEARCH_DEFAULT_SCOPE_FILES: SCOPE, RESEARCH_DEFAULT_NEW_FILES: NEW_FILES, RESEARCH_DEFAULT_FILES: APP_FILES, RESEARCH_DEFAULT_MARKER_RE: MARKER_RE, RESEARCH_DEFAULT_ENV_BLOCK: ENV_BLOCK, RESEARCH_DEFAULT_SUBJECT: SUBJECT, RESEARCH_DEFAULT_EDITS: EDITS, RESEARCH_DEFAULT_FLAGS: FLAGS } = stripModule
const STRIP_FN = stripModule.stripResearchDefault
const FLAG = FLAGS[0]

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

const LIB = 'lib/studio-research-default.ts', PAGE = 'app/builder/page.tsx', HOOK = 'hooks/use-deckster-websocket-v2.ts', CLEAN = 'components/builder/chat/studio-chat-clean.tsx', REGISTRY = 'scripts/studio-later-changes.mjs', ENV = '.env.example'
/** What the flag does, in the words FRONTEND-1 gave: in the lib's comment and in the .env.example block. */
const SENTENCE = 'On a new chat, or a chat that has no outline yet, web search starts on. A chat that already has an outline opens with web search off, as before. Deep research is unchanged.'
const LIB_LINE = "export const STUDIO_RESEARCH_DEFAULT_ON = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'"
/** The one line this change inserts into the session-restore wrapper (it calls setWebSearchEnabled(false), nothing else in the page's marked lines does). */
const RESTORE_LINE_RE = /^    if \(STUDIO_RESEARCH_DEFAULT_ON && .*\) setWebSearchEnabled\(false\) \/\/ RESEARCH-DEFAULT/
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

const ENV_ON = { [FLAG]: 'true' }
const ENV_OFF = {
  'nothing set': {},
  'flag "false"': { [FLAG]: 'false' },
  'flag "True"': { [FLAG]: 'True' },
  'flag "TRUE"': { [FLAG]: 'TRUE' },
  'flag "1"': { [FLAG]: '1' },
  'flag " true"': { [FLAG]: ' true' },
  'flag "true "': { [FLAG]: 'true ' },
  'flag "yes"': { [FLAG]: 'yes' },
  'flag ""': { [FLAG]: '' },
  'a neighbour flag on (the Research switch)': { NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' },
}

// ============================================================================================================================================
// A. the lib
// ============================================================================================================================================
function libChecks(texts = {}) {
  const text = texts[LIB] ?? read(LIB)
  for (const [name, env] of Object.entries(ENV_OFF)) assert.equal(load(LIB, { env, texts }).STUDIO_RESEARCH_DEFAULT_ON, false, `${name}: off`)
  assert.equal(load(LIB, { env: ENV_ON, texts }).STUDIO_RESEARCH_DEFAULT_ON, true, 'exactly "true": on')
  assert.deepEqual(Object.keys(load(LIB, { env: ENV_ON, texts })), ['STUDIO_RESEARCH_DEFAULT_ON'], 'the lib exports the one constant')
  assert.equal((text.match(/process\.env\./g) || []).length, 1, 'one env read')
  assert.equal((text.match(new RegExp(`process\\.env\\.${FLAG}\\b`, 'g')) || []).length, 1, `the literal env name ${FLAG} is read once (so Next inlines it)`)
  assert.equal(lineIs(text, LIB_LINE), LIB_LINE, 'the one line is FRONTEND-1\'s, to the letter')
  assert.deepEqual([...text.matchAll(/^\s*(import|require)\b.*$/gm)].map(m => m[0]), [], 'the lib imports nothing')
  assert.deepEqual(text.split('\n').filter(line => line.trim() !== '' && !line.startsWith('//')), [LIB_LINE], 'nothing in the lib but comments and that line')
  assert.ok(text.includes(SENTENCE), 'the lib\'s comment says what the flag does: web search starts on in a new chat or one with no outline, an outlined chat opens off, deep research is unchanged')
  assert.doesNotMatch(text, /a reopened chat keeps the value it was saved with/, 'and no longer says a reopened chat keeps its saved value (nothing restores it)')
}

// ============================================================================================================================================
// B. the page's two lines, run
// ============================================================================================================================================
const FIRST_RESEARCH = '  const [researchEnabled, setResearchEnabled] = useState(false)'
/** The page's first two state lines (deep research, web search), run with a stand-in useState: what each starts as. */
function firstState(page, flag) {
  const lines = page.split('\n'), at = lines.indexOf(FIRST_RESEARCH)
  assert.ok(at >= 0 && lines.indexOf(FIRST_RESEARCH, at + 1) === -1, 'the deep research state is where the base has it, once')
  assert.ok(lines[at + 1].startsWith('  const [webSearchEnabled, setWebSearchEnabled] = useState('), 'the web search state is the line right after it')
  return JSON.parse(JSON.stringify(runFragment(`${lines[at]}\n${lines[at + 1]}\nreturn { researchEnabled, webSearchEnabled }`, ['useState', 'STUDIO_RESEARCH_DEFAULT_ON'])(initial => [initial, () => {}], flag))) // out of the vm's realm
}
/** The new-chat reset's four lines (deep research, web search, extended generation, knowledge graph), run with recording setters. */
function resetCalls(page, flag) {
  const lines = page.split('\n'), at = lines.indexOf('    setResearchEnabled(false)')
  assert.ok(at >= 0 && lines.indexOf('    setResearchEnabled(false)', at + 1) === -1, 'the new-chat reset starts with the base\'s deep research line, once')
  assert.ok(lines[at + 1].startsWith('    setWebSearchEnabled(') && lines[at + 2] === '    setExtendedGenerationEnabled(true)' && lines[at + 3] === '    setKnowledgeGraphEnabled(false)', 'the reset is the base\'s four lines in the base\'s order')
  const calls = [], rec = name => value => { calls.push([name, value]) }
  runFragment(lines.slice(at, at + 4).join('\n'), ['setResearchEnabled', 'setWebSearchEnabled', 'setExtendedGenerationEnabled', 'setKnowledgeGraphEnabled', 'STUDIO_RESEARCH_DEFAULT_ON'])(rec('deep'), rec('web'), rec('extended'), rec('graph'), flag)
  return calls
}
function pageRunChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE), onFlag = load(LIB, { env: ENV_ON, texts }).STUDIO_RESEARCH_DEFAULT_ON
  for (const [name, env] of Object.entries(ENV_OFF)) {
    const flag = load(LIB, { env, texts }).STUDIO_RESEARCH_DEFAULT_ON
    assert.deepEqual(firstState(page, flag), { researchEnabled: false, webSearchEnabled: false }, `${name}: a new chat starts with both off`)
    assert.deepEqual(firstState(page, flag), firstState(base, flag), `${name}: the first state is the base's, value for value`)
    assert.deepEqual(resetCalls(page, flag), [['deep', false], ['web', false], ['extended', true], ['graph', false]], `${name}: the reset gives both off`)
    assert.deepEqual(resetCalls(page, flag), resetCalls(base, flag), `${name}: the reset is the base's, call for call`)
  }
  assert.equal(onFlag, true, 'the flag is on for "true"')
  assert.deepEqual(firstState(page, onFlag), { researchEnabled: false, webSearchEnabled: true }, 'on: a new chat starts with web search on and deep research off')
  assert.deepEqual(resetCalls(page, onFlag), [['deep', false], ['web', true], ['extended', true], ['graph', false]], 'on: the new-chat reset gives web search on and deep research off, and the other two as they were')
  assert.deepEqual(firstState(base, onFlag), { researchEnabled: false, webSearchEnabled: false }, 'the base\'s own lines ignore the flag (there is something to change)')
  assert.deepEqual(resetCalls(base, onFlag), [['deep', false], ['web', false], ['extended', true], ['graph', false]], 'the base\'s reset ignores the flag too')
}

// ============================================================================================================================================
// B2. the OPEN of a chat: the real session-restore wrapper (restoreBuilderSessionMessages), run
// ============================================================================================================================================
// The session load calls this wrapper once per opened chat, with the loaded row's deck state (use-builder-session: restoreMessages(botMsgs, sessionState)). It is where the page already sets per-chat state, so the one line this change adds sits in it.
// A chat built in this page view never goes through it (a new chat has no row to load), and the outline appearing during the view (hasStrawman, a presentation_url) runs none of the page's research lines (B3), so those cannot flip the switch.
const WRAP_START = '  const restoreBuilderSessionMessages = useCallback(('
const WRAP_END = '  }, [studioShell, studioHandoffRestoreOwner, authScopeUserId, restoreMessages,'
const WRAP_NAMES = ['studioShell', 'studioHandoffRestoreOwner', 'questionSubmissionScopeRef', 'authScopeUserId', 'currentSessionIdRef', 'retireStudioVoiceOwner', 'STUDIO_VOICE_INTERACTIVE_ENABLED', 'restoreMessages', 'session', 'getExpectedStudioHandoffRequest', 'readCurrentStudioHandoff', 'expectedStudioHandoffRequestRef', 'trackHandoffRequest', 'setWebSearchEnabled', 'STUDIO_RESEARCH_DEFAULT_ON']
const HANDLER_START = '  const handleWebSearchEnabledChange = useCallback((enabled: boolean) => {'
const wrapperCache = new Map(), handlerCache = new Map() // keyed by the page's text: a string's hash is computed once, so a look-up costs nothing
/** The wrapper's real text (the page's lines between its opening and its dependency list), where it sits, and a factory that builds it over stand-ins. */
function wrapperOf(page) {
  if (!wrapperCache.has(page)) {
    const lines = page.split('\n'), start = lines.indexOf(WRAP_START)
    assert.ok(start >= 0 && lines.indexOf(WRAP_START, start + 1) === -1, 'the session-restore wrapper is where the base has it, once')
    const end = lines.findIndex((line, i) => i > start && line.startsWith(WRAP_END))
    assert.ok(end > start, 'the wrapper ends with its dependency list')
    wrapperCache.set(page, { start, end, make: runFragment(['const restore = ((', ...lines.slice(start + 1, end), '})', 'return restore'].join('\n'), WRAP_NAMES) })
  }
  return wrapperCache.get(page)
}
/** The real handler of the composer's web search switch (the person's own change), over stand-in setters. */
function handlerOf(page) {
  if (!handlerCache.has(page)) {
    const lines = page.split('\n'), start = lines.indexOf(HANDLER_START)
    assert.ok(start >= 0 && lines.indexOf(HANDLER_START, start + 1) === -1, 'the web search switch handler is where the base has it, once')
    const end = lines.findIndex((line, i) => i > start && line === '  }, [])')
    handlerCache.set(page, runFragment(['const handle = ((enabled: boolean) => {', ...lines.slice(start + 1, end), '})', 'return handle'].join('\n'), ['setWebSearchEnabled', 'setResearchEnabled']))
  }
  return handlerCache.get(page)
}
const LAYOUT_URL = 'https://layout.example/p/abc'
/** Rows as the session load hands them over. Outlined: the row already holds the chat's strawman or final deck (url or id). */
const OUTLINED = {
  'a strawman url': { strawmanPreviewUrl: LAYOUT_URL },
  'a strawman id': { strawmanPresentationId: 'p1' },
  'a final deck url': { finalPresentationUrl: LAYOUT_URL },
  'a final deck id': { finalPresentationId: 'p2' },
  'a strawman only (stage 4)': { strawmanPreviewUrl: LAYOUT_URL, strawmanPresentationId: 'p1', presentationUrl: LAYOUT_URL, presentationId: 'p1', slideCount: 8, currentStage: 4, activeVersion: 'strawman' },
  'a final deck (stage 6)': { strawmanPreviewUrl: LAYOUT_URL, strawmanPresentationId: 'p1', finalPresentationUrl: LAYOUT_URL, finalPresentationId: 'p2', presentationUrl: LAYOUT_URL, presentationId: 'p2', slideCount: 8, currentStage: 6, activeVersion: 'final', deckOwnerSessionId: 's1' },
}
/** No outline yet: nothing loaded, an empty row, every deck field empty, a blank deck only. */
const NO_OUTLINE = {
  'nothing loaded (no state at all)': undefined,
  'an empty row': {},
  'every deck field null': { presentationUrl: null, presentationId: null, blankPresentationUrl: null, blankPresentationId: null, isBlankPresentation: false, strawmanPreviewUrl: null, strawmanPresentationId: null, finalPresentationUrl: null, finalPresentationId: null, slideCount: 0, slideStructure: null, currentStage: null, activeVersion: null },
  'every deck field an empty string': { strawmanPreviewUrl: '', strawmanPresentationId: '', finalPresentationUrl: '', finalPresentationId: '' },
  'a blank deck only': { presentationUrl: LAYOUT_URL, presentationId: 'b1', blankPresentationUrl: LAYOUT_URL, blankPresentationId: 'b1', isBlankPresentation: true, activeVersion: 'blank', slideCount: 1, deckOwnerSessionId: 's1' },
}
const copy = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
/** One open of a chat: the real wrapper over stand-ins. Returns every call it made, in order, and the switch's value after it (`web` in, `web` out). `stale`: the restore's owner was superseded (the shell's guard). */
function openChat(page, { flag, shell = false, stale = false, state, web }) {
  const calls = [], rec = name => (...args) => { calls.push([name, ...args.map(copy)]) }
  const owner = { generation: 1, sessionId: 's1', userId: 'u1' }, scope = { current: { active: true, generation: stale ? 2 : 1, sessionId: 's1', userId: 'u1' } }
  let value = web
  const restore = wrapperOf(page).make(shell, owner, scope, 'u1', { current: 's1' }, rec('retireVoice'), false, rec('restoreMessages'), { userMessageIdsRef: { current: new Set() } }, () => null, () => null, { current: null }, rec('trackHandoff'), next => { calls.push(['web', next]); value = next }, flag)
  restore([{ type: 'x' }], state)
  return { calls, web: value }
}
/** The page as a small machine over the real lines: the first state, the new-chat reset, the wrapper (an open), the switch's handler. One run of events. */
function machine(page, flag) {
  const initial = firstState(page, flag).webSearchEnabled, reset = resetCalls(page, flag).find(call => call[0] === 'web')[1], handle = handlerOf(page)
  return events => {
    let web = initial
    for (const [kind, arg] of events) {
      if (kind === 'open') web = openChat(page, { flag, state: arg, web }).web
      else if (kind === 'switch') { handle(next => { web = next }, () => {})(arg) } // the person's own change, through the real handler
      else if (kind === 'newChat') web = reset
      else if (kind === 'outline') { /* an outline appears in this page view (hasStrawman latches, a presentation_url arrives): the page runs none of its research lines on it (B3) */ }
      else throw new Error(`unknown event ${kind}`)
    }
    return web
  }
}
/** The same events, as the spec says (independent of the page's text). */
function specWeb(events, flag, startFlag = flag) {
  let web = startFlag
  for (const [kind, arg] of events) {
    if (kind === 'open') { if (flag && arg === 'outlined') web = false } // flag on: an opened chat with its outline reads off; a no-outline chat keeps what it has
    else if (kind === 'switch') web = arg
    else if (kind === 'newChat') web = flag
  }
  return web
}
const EVENT_KINDS = [['open', 'outlined'], ['open', 'none'], ['switch', true], ['switch', false], ['outline'], ['newChat']]
const sequences = max => { const out = [[]]; let layer = [[]]; for (let n = 0; n < max; n++) { layer = layer.flatMap(prefix => EVENT_KINDS.map(event => [...prefix, event])); out.push(...layer) } return out }
const STATE_OF = { outlined: OUTLINED['a final deck (stage 6)'], none: NO_OUTLINE['an empty row'] }
function openChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE), onFlag = load(LIB, { env: ENV_ON, texts }).STUDIO_RESEARCH_DEFAULT_ON
  assert.equal(onFlag, true, 'the flag is on for "true"')
  // flag on, every outlined row, in and out of the shell: the chat opens with web search off, set once, and the restore call itself is the base's
  for (const shell of [false, true]) {
    for (const [name, state] of Object.entries(OUTLINED)) {
      const out = openChat(page, { flag: onFlag, shell, state, web: true }), was = openChat(base, { flag: onFlag, shell, state, web: true })
      assert.equal(out.web, false, `on: a chat opened with ${name} reads web search off (shell ${shell})`)
      assert.deepEqual(out.calls.filter(call => call[0] === 'web'), [['web', false]], `on: ${name}: web search is set once, to off`)
      assert.deepEqual(out.calls.filter(call => call[0] !== 'web'), was.calls, `on: ${name}: every other call the wrapper makes is the base's (the restore itself is untouched)`)
      assert.equal(openChat(page, { flag: onFlag, shell, state, web: false }).web, false, `on: ${name}: and it stays off when it was already off`)
    }
    for (const [name, state] of Object.entries(NO_OUTLINE)) {
      for (const before of [true, false]) {
        const out = openChat(page, { flag: onFlag, shell, state, web: before }), was = openChat(base, { flag: onFlag, shell, state, web: before })
        assert.equal(out.web, before, `on: a chat opened with ${name} keeps the switch as it is (${before}; shell ${shell})`)
        assert.deepEqual(out.calls, was.calls, `on: ${name}: the wrapper makes the base's calls and sets nothing`)
      }
    }
  }
  // a superseded restore (the shell's owner guard) returns before anything: nothing is set, nothing is restored
  for (const [name, state] of Object.entries(OUTLINED)) assert.deepEqual(openChat(page, { flag: onFlag, shell: true, stale: true, state, web: true }).calls, [], `on: a superseded restore sets nothing and restores nothing (${name})`)
  // flag off: the wrapper makes the base's calls, call for call, and never sets web search
  for (const [label, env] of Object.entries(ENV_OFF)) {
    const flag = load(LIB, { env, texts }).STUDIO_RESEARCH_DEFAULT_ON
    for (const shell of [false, true]) for (const state of [...Object.values(OUTLINED), ...Object.values(NO_OUTLINE)]) {
      const out = openChat(page, { flag, shell, state, web: false }), was = openChat(base, { flag, shell, state, web: false })
      assert.deepEqual(out.calls, was.calls, `${label}: the wrapper's calls are the base's`)
      assert.equal(out.calls.some(call => call[0] === 'web'), false, `${label}: web search is never set`)
      assert.equal(out.web, false, `${label}: and it reads what the base reads (off)`)
    }
  }
  // the whole page view as a run of events: flag on, the spec's answer for every run of up to four events; flag off, the base's
  const on = machine(page, true), off = machine(page, false), baseOn = machine(base, true)
  for (const events of sequences(4)) {
    const label = events.map(([kind, arg]) => arg === undefined ? kind : `${kind}:${arg}`).join(' > ') || '(nothing)'
    const mapped = events.map(([kind, arg]) => [kind, kind === 'open' ? STATE_OF[arg] : arg])
    assert.equal(on(mapped), specWeb(events, true), `on: ${label}`)
    assert.equal(off(mapped), baseOn(mapped), `off: ${label}: the same as the base's lines`)
    assert.equal(off(mapped), specWeb(events, false), `off: ${label}: the spec's answer`)
  }
  // the named cases of the order
  const web = events => on(events.map(([kind, arg]) => [kind, kind === 'open' ? STATE_OF[arg] : arg]))
  assert.equal(web([]), true, 'on: a fresh page with no chat opened reads on')
  assert.equal(web([['outline']]), true, 'on: a new chat that gets its first outline in this page view (it built with research on) is NOT flipped off')
  assert.equal(web([['newChat'], ['outline']]), true, 'on: the same after + New chat')
  assert.equal(web([['open', 'none'], ['outline']]), true, 'on: a chat opened with no outline that then builds one keeps web search on')
  assert.equal(web([['open', 'none'], ['switch', false], ['outline']]), false, 'on: a person\'s switch in a no-outline chat is not overridden when its outline appears')
  assert.equal(web([['open', 'none'], ['switch', false], ['outline'], ['outline']]), false, 'on: nor by anything after it')
  assert.equal(web([['switch', false], ['outline']]), false, 'on: nor in a new chat')
  assert.equal(web([['open', 'outlined']]), false, 'on: a chat opened with its outline reads off')
  assert.equal(web([['open', 'outlined'], ['newChat']]), true, 'on: and + New chat starts on again')
}

// ============================================================================================================================================
// B3. who sets web search
// ============================================================================================================================================
// "A person's own switch in a no-outline chat is never overridden later in the same chat, and a new chat that gets its first outline in this page view is not flipped": nothing keyed on the outline (hasStrawman, the lock, a session id) may write the switch.
// The writers of web search in the page are the base's (the two switch handlers, the new-deck handoff) and this change's two: the restore line (inside the session-restore wrapper) and the new-chat reset (inside the new-chat handler).
const RESET_START = '  const handleNewChatWrapped = useCallback(() => {', RESET_END = '  handleNewChatWrappedRef.current = handleNewChatWrapped'
const FORBIDDEN_ON_MARKED = /hasStrawman|researchSettingsLocked|useEffect|useLayoutEffect|currentSessionId|wsSessionId|socketSessionId|presentation_url|slide_update|sync_response/
function writersChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE), lines = page.split('\n')
  const writers = text => text.split('\n').map((line, index) => ({ line, index })).filter(({ line }) => /\bsetWebSearchEnabled\(/.test(line))
  const mine = writers(page).filter(({ line }) => MARKER_RE.test(line)), others = writers(page).filter(({ line }) => !MARKER_RE.test(line))
  const replaced = new Set(EDITS[PAGE].map(([, was]) => was.replace(/\n$/, '')).filter(Boolean))
  assert.deepEqual(others.map(({ line }) => line), writers(base).map(({ line }) => line).filter(line => !replaced.has(line)), 'every other line that sets web search is the base\'s: the two switch handlers and the new-deck handoff')
  assert.equal(mine.length, 2, 'this change sets web search in two places only: the restore line and the new-chat reset')
  const wrapper = wrapperOf(page), resetStart = lines.indexOf(RESET_START), resetEnd = lines.indexOf(RESET_END)
  assert.ok(resetStart > 0 && resetEnd > resetStart, 'the new-chat handler is where the base has it')
  assert.ok(mine[0].index > wrapper.start && mine[0].index < wrapper.end && RESTORE_LINE_RE.test(mine[0].line), 'the first is the restore line, inside the session-restore wrapper (the call the session load makes once per opened chat)')
  assert.ok(mine[1].index > resetStart && mine[1].index < resetEnd && mine[1].line.startsWith('    setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON)'), 'the second is the new-chat reset, inside the new-chat handler')
  assert.ok(mine[0].index > lines.indexOf('    if (studioShell && !isCurrentRestore()) return', wrapper.start) && lines.indexOf('    if (studioShell && !isCurrentRestore()) return', wrapper.start) > wrapper.start, 'the restore line is after the owner guard: a superseded restore sets nothing')
  const marked = lines.filter(line => MARKER_RE.test(line))
  assert.equal(marked.length, 4, 'four lines of the page carry the marker: the import, the first state, the restore line and the reset')
  for (const line of marked) assert.doesNotMatch(line, FORBIDDEN_ON_MARKED, `a marked line does not read the outline, the lock, a session id or a socket message, and is no effect: ${line.trim().slice(0, 90)}`)
  assert.equal(lines.filter(line => /\bSTUDIO_RESEARCH_DEFAULT_ON\b/.test(line)).length, 4, 'the constant is named on four lines only (the import and the three that use it): no effect, no other handler reads it')
}

// ============================================================================================================================================
// C. only the marked lines changed
// ============================================================================================================================================
function pageDiffChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE)
  const out = STRIP_FN(PAGE, laterOnly(PAGE, page))
  assert.equal(out, base, `${PAGE}: without this change's lines (and any later change's) the page is dev's, byte for byte`)
  assert.equal(STRIP_FN(PAGE, out), out, `${PAGE}: stripping twice changes nothing more`)
  assert.notEqual(laterOnly(PAGE, page), base, `${PAGE}: the change is there to strip`)
  const mine = laterOnly(PAGE, page), diff = lineDiff(base, mine)
  const was = EDITS[PAGE].map(([, w]) => w).filter(w => w !== '').map(w => w.replace(/\n$/, ''))
  assert.deepEqual(diff.removed.sort(), was.sort(), 'two base lines are rewritten, no other base line is lost')
  assert.equal(was.length, 2, 'two modified lines')
  assert.equal(diff.added.length, 4, 'four lines added in all: the two modified lines, the one restore line and one import')
  for (const line of diff.added) assert.match(line, MARKER_RE, `a line added to the page carries the marker: ${line.trim().slice(0, 100)}`)
  assert.equal(diff.added.filter(line => /^import /.test(line)).length, 1, 'one of them is the import')
  assert.deepEqual(diff.added.filter(line => !/^import /.test(line) && !RESTORE_LINE_RE.test(line)).map(line => line.replace(/ \/\/ RESEARCH-DEFAULT.*$/, '')).sort(), ['  const [webSearchEnabled, setWebSearchEnabled] = useState(STUDIO_RESEARCH_DEFAULT_ON)', '    setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON)'].sort(), 'the two modified lines are exactly the two initial values, and use only the flag')
  assert.equal(diff.added.filter(line => RESTORE_LINE_RE.test(line)).length, 1, 'one line is the restore line (a pure insertion: it replaces no base line)')
  assert.equal(lineWith(mine, "from '@/lib/studio-research-default'"), "import { STUDIO_RESEARCH_DEFAULT_ON } from '@/lib/studio-research-default' // RESEARCH-DEFAULT", 'the import is the lib\'s one constant')
  assert.equal(diff.added.reduce((n, line) => n + (line.match(/\bSTUDIO_RESEARCH_DEFAULT_ON\b/g) || []).length, 0), 4, 'and uses the constant four times: the import, the two modified lines and the restore line (the comments name the env flag, not the constant)')
  assert.equal(EDITS[PAGE].filter(([, w]) => w === '').length, 2, 'two pure insertions in the strip: the restore line and the import')
  for (const rel of APP_FILES) assert.equal(STRIP_FN(rel, 'x\nRESEARCH-DEFAULT\n'), 'x\nRESEARCH-DEFAULT\n', 'a text with no edit in it comes back as it is')
  for (const rel of ['hooks/use-deckster-websocket-v2.ts', 'components/builder/chat/studio-chat-clean.tsx', ENV, REGISTRY]) assert.equal(STRIP_FN(rel, 'x\nRESEARCH-DEFAULT\n'), 'x\nRESEARCH-DEFAULT\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(STRIP_FN(PAGE, 5), 5, 'a text that is not a string comes back as it is')
}
/** What a later change's strips (those registered after this one) leave of a file, so that the check sees this change's lines and the base's others. */
const laterOnly = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }

// ============================================================================================================================================
// C2. the older proofs this change teaches
// ============================================================================================================================================
// Six older proofs hold the Builder page to an older base as pure insertions (a base line may never be replaced), or read the first-parent line: this change replaces two base lines, so each is taught with pure insertions. [lines gained, what they are]
const PIN_GAINS = {
  'scripts/test-studio-billing-f5-usage.mjs': 2, 'scripts/test-studio-chat-element-edit.mjs': 3, 'scripts/test-studio-chat-element-refine.mjs': 2,
  'scripts/test-studio-deck-sync-truth.mjs': 1, 'scripts/test-studio-job-ledger.mjs': 2, 'scripts/test-studio-new-deck-handoff-send.mjs': 2,
}
function pinChecks(texts = {}, mod = stripModule) {
  const strip = mod.stripResearchDefault, pinFiles = mod.RESEARCH_DEFAULT_PIN_FILES, DIFF_LINE = mod.researchDefaultDiffLine
  assert.deepEqual([...pinFiles].sort(), Object.keys(PIN_GAINS).sort(), 'the older proofs this change teaches')
  for (const [rel, gained] of Object.entries(PIN_GAINS)) {
    const now = laterOnly(rel, texts[rel] ?? read(rel)), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's lines the proof is dev's, byte for byte`)
    assert.equal(strip(rel, strip(rel, now)), strip(rel, now), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, gained], `${rel}: the proof gains ${gained} marked lines and loses none`)
    for (const line of diff.added) assert.ok(line.includes(mod.RESEARCH_DEFAULT_PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
    for (const line of diff.added.filter(added => added.includes('fs.readFileSync = '))) assert.ok(line.includes('stripResearchDefault(rel, out)') && line.includes('RESEARCH_DEFAULT_FILES.includes(rel)') && !line.includes('stripLaterChanges') && !line.includes('registry.'), `${rel}: the read hook uses this change's own strip, never the registry`)
    for (const line of diff.added.filter(added => added.includes('shas.splice'))) assert.ok(line.includes('^Research default:') && !line.includes('Research switch') && !line.includes('Replace picture'), `${rel}: the splice names this change's own subject, and only that`)
    for (const line of diff.added.filter(added => /\.splice\(0, (diff|added)\.length/.test(added))) assert.ok(/researchDefaultDiffLine\(/.test(line) && /filter\(/.test(line), `${rel}: the diff splice drops this change's lines by its own helper`)
    for (const line of diff.added.filter(added => added.startsWith('import '))) assert.ok(/from '\.\/studio-research-default-strip\.mjs'/.test(line), `${rel}: an import added to the proof names this change's strip only`)
  }
  assert.equal(Object.values(PIN_EDITS).flat().every(([, was]) => was === ''), true, 'every pin edit is a pure insertion')
  // the diff helper: this change's lines of a `git diff -U0`, and no other
  const was = ['  const [webSearchEnabled, setWebSearchEnabled] = useState(false)', '    setWebSearchEnabled(false)']
  const markedPlus = '+  const [webSearchEnabled, setWebSearchEnabled] = useState(STUDIO_RESEARCH_DEFAULT_ON) // RESEARCH-DEFAULT (x)'
  assert.deepEqual([DIFF_LINE(markedPlus), ...was.map(line => DIFF_LINE(`-${line}`))], [true, true, true], 'an added marked line and the two base lines it replaces are this change\'s')
  for (const line of ['+  const x = 1', '+  setWebSearchEnabled(false)', '-    setKnowledgeGraphEnabled(false)', '-  const [researchEnabled, setResearchEnabled] = useState(false)', '+  x // RESEARCH-DEFAULT-X', '+++ b/app/builder/page.tsx', '--- a/app/builder/page.tsx', '@@ -884 +884 @@', ' context', '', '-', '+']) assert.equal(DIFF_LINE(line), false, `not this change's: ${JSON.stringify(line)}`)
  assert.equal(DIFF_LINE(5), false, 'a value that is not a string is not')
  assert.equal(DIFF_LINE('+  x // RESEARCH-DEFAULT'), true, 'any added line with the marker')
}

// ============================================================================================================================================
// D. deep research and the new-deck handoff are untouched; the hook and the composer are untouched
// ============================================================================================================================================
function untouchedChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE)
  // deep research: its first state, its reset, the two handlers that tie it to web search
  assert.equal(lineIs(page, FIRST_RESEARCH), FIRST_RESEARCH, 'deep research starts false')
  assert.equal(lineIs(page, '    setResearchEnabled(false)'), '    setResearchEnabled(false)', 'deep research is reset to false')
  assert.equal(page.split('\n').filter(l => /\bsetResearchEnabled\(/.test(l)).join('\n'), base.split('\n').filter(l => /\bsetResearchEnabled\(/.test(l)).join('\n'), 'every line that sets deep research is the base\'s')
  assert.equal(page.split('\n').filter(l => /\bresearchEnabled\b/.test(l) && !/webSearchEnabled/.test(l)).join('\n'), base.split('\n').filter(l => /\bresearchEnabled\b/.test(l) && !/webSearchEnabled/.test(l)).join('\n'), 'every line that reads deep research alone is the base\'s')
  const lines = page.split('\n'), from = lines.findIndex(l => l.startsWith('  const handleResearchEnabledChange = useCallback(')), baseLines = base.split('\n'), baseFrom = baseLines.findIndex(l => l.startsWith('  const handleResearchEnabledChange = useCallback('))
  assert.ok(from > 0 && baseFrom > 0, 'the two handlers are where the base has them')
  assert.equal(lines.slice(from, from + 8).join('\n'), baseLines.slice(baseFrom, baseFrom + 8).join('\n'), 'the two handlers (Deep research implies web search; web search off turns Deep research off) are the base\'s lines')
  // the new-deck handoff (the lines after `setSessionStoreName(pending.store_name)`, :6851): it sets the switches from the handed-off request, whatever the flag. It is NOT a restore of an opened chat: nothing restores a chat's web search (the page's restore line is B2's)
  assert.equal(lineIs(page, '    setResearchEnabled(pending.deep_research)'), '    setResearchEnabled(pending.deep_research)', 'the new-deck handoff sets deep research from the handed-off request')
  assert.equal(lineIs(page, '    setWebSearchEnabled(pending.web_search || pending.deep_research)'), '    setWebSearchEnabled(pending.web_search || pending.deep_research)', 'the new-deck handoff sets web search from the handed-off request, the flag is not in it')
  assert.equal(lineIs(page, '    setExtendedGenerationEnabled(pending.extended_generation)'), '    setExtendedGenerationEnabled(pending.extended_generation)', 'and the line after it is the base\'s')
  // the restore, run: the saved values come back whatever the flag
  for (const flag of [false, true]) for (const web of [true, false]) for (const deep of [true, false]) {
    const calls = [], rec = name => value => { calls.push([name, value]) }
    runFragment('setResearchEnabled(pending.deep_research)\nsetWebSearchEnabled(pending.web_search || pending.deep_research)', ['setResearchEnabled', 'setWebSearchEnabled', 'pending', 'STUDIO_RESEARCH_DEFAULT_ON'])(rec('deep'), rec('web'), { web_search: web, deep_research: deep }, flag)
    assert.deepEqual(calls, [['deep', deep], ['web', web || deep]], `the new-deck handoff (flag ${flag}, request web ${web}, deep ${deep}) sets the requested values`)
  }
  // every other line that reads web search is the base's: the build message still carries web_search on every send
  const reads = text => text.split('\n').filter(l => /\bwebSearchEnabled\b/.test(l) && !l.startsWith('  const [webSearchEnabled, setWebSearchEnabled] = useState(')).join('\n')
  assert.equal(reads(page), reads(base), 'every other line that reads or sets web search is the base\'s')
  // the hook and the composer: nothing (web_search already goes out on every build message)
  for (const rel of [HOOK, CLEAN]) assert.equal(laterOnly(rel, texts[rel] ?? read(rel)), baseText(rel), `${rel} is the base's file, byte for byte (nothing in the hook, nothing in the composer)`)
  assert.ok((texts[HOOK] ?? read(HOOK)).includes('web_search: webSearch,'), 'the hook already sends web_search')
}

// ============================================================================================================================================
// E. .env.example
// ============================================================================================================================================
/** .env.example without the blocks registered after this one (a later change's block sits below this one's). */
const laterEnv = text => { const blocks = registry.LATER_ENV_BLOCKS, at = blocks.indexOf(ENV_BLOCK); return (at === -1 ? [] : blocks.slice(at + 1)).reduce((out, later) => out.replace(`\n${later}`, ''), text) }
function envChecks(texts = {}, block = ENV_BLOCK) {
  const env = laterEnv(texts[ENV] ?? read(ENV))
  assert.ok(env.endsWith(`\n${block}`), '.env.example ends with the block (one block, at the end)')
  assert.equal(env.slice(0, env.length - block.length - 1), baseText(ENV), '.env.example is dev\'s file plus that one blank-line-separated block')
  assert.ok(block.includes(SENTENCE) && env.includes(SENTENCE), 'the block says what the flag does: web search starts on in a new chat or one with no outline, an outlined chat opens off, deep research is unchanged')
  assert.doesNotMatch(env, /a reopened chat keeps the value it was saved with/, 'and no longer says a reopened chat keeps its saved value')
  assert.equal((env.match(new RegExp(`^${FLAG}=`, 'gm')) || []).length, 1, `.env.example assigns ${FLAG} once`)
  assert.match(block, new RegExp(`^${FLAG}="false"$`, 'm'), `the block documents ${FLAG} as "false"`)
  assert.ok(block.endsWith('\n') && block.split('\n').filter(line => line && !line.startsWith('#')).length === 1 && block.split('\n').filter(line => line.startsWith('#')).length >= 1, 'the block is a comment and one assignment')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes(FLAG), false, 'the registry takes the block out of .env.example')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes('STUDIO RESEARCH DEFAULT'), false, 'and its comment with it')
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
// H. one literal read
// ============================================================================================================================================
function oneReadChecks(texts = {}) {
  for (const rel of git('ls-files', 'app', 'hooks', 'components', 'lib', 'middleware.ts', 'next.config.mjs').split('\n').filter(Boolean).filter(f => /\.(ts|tsx|mjs|js)$/.test(f))) {
    const text = texts[rel] ?? read(rel), hits = (text.match(/process\.env\.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON\b/g) || []).length
    assert.equal(hits, rel === LIB ? 1 : 0, `${rel}: ${rel === LIB ? 'reads the flag once' : 'does not read the flag itself'}`)
  }
  for (const rel of git('grep', '-l', '-e', 'STUDIO_RESEARCH_DEFAULT_ON', '--', 'app', 'hooks', 'components', 'lib').split('\n').filter(Boolean)) assert.ok([LIB, PAGE].includes(rel), `${rel}: only the lib and the Builder page name the flag`)
  const lib = texts[LIB] ?? read(LIB); assert.equal((lib.match(/process\.env/g) || []).length, 1)
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
const TEXTS = Object.fromEntries([...APP_FILES, ...NEW_FILES.filter(f => f !== 'scripts/test-studio-research-default.mjs'), ...PIN_FILES, ENV, REGISTRY, HOOK, CLEAN].map(rel => [rel, read(rel)]))
await check('A. the lib: on for the exact string "true" and nothing else; one literal read; imports nothing', () => libChecks())
await check('B. the page\'s two lines, run: flag off they are the base\'s; flag on web search starts on, deep research off', () => pageRunChecks())
await check('B2. the open of a chat (the real session-restore wrapper, run): flag on an outlined chat reads off, a new chat and a no-outline chat read on, a person\'s switch is not overridden, a superseded restore sets nothing; flag off the base\'s calls', () => openChecks(TEXTS))
await check('B3. who sets web search: the base\'s writers plus the restore line and the reset; nothing keyed on the outline, the lock or a session', () => writersChecks(TEXTS))
await check('C. only the marked lines changed (two base lines rewritten, the restore line and the import inserted): the strip gives dev\'s page byte for byte', () => pageDiffChecks(TEXTS))
await check('C2. the six older proofs this change teaches: pure insertions, dev\'s file without them; read hook, subject splice and diff helper', () => pinChecks(TEXTS))
await check('D. deep research, the new-deck handoff, the hook and the composer are untouched', () => untouchedChecks(TEXTS))
await check('E. .env.example: one block at the end, "false", dev\'s file plus the block', () => envChecks(TEXTS))
await check('F. the registry: three lines, each marked LATER-CHANGE, at the right places; the strips commute', () => registryChecks())
await check('G1. own-commit scope, by the subject prefix on the first-parent line; the commit message', () => {
  const commits = allCommits(); assert.ok(commits.length >= 1, 'this change has commits of its own')
  scopeCheck(firstParentCommits()); scopeCheck(commits)
  for (const commit of commits) assert.deepEqual(messageProblems(subjectOf(commit), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
})
await check('G2. a secret scan of the files and the commits', () => secretChecks(TEXTS))
await check('H. the flag is read from one literal env name, and only the lib reads it', () => oneReadChecks())

// ---- I. mutants ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const FIRST_LINE_NOW = lineWith(TEXTS[PAGE], 'const [webSearchEnabled, setWebSearchEnabled] = useState(STUDIO_RESEARCH_DEFAULT_ON)')
const RESET_LINE_NOW = lineWith(TEXTS[PAGE], '    setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON)')
const RESTORE_NOW = lineWith(TEXTS[PAGE], '    if (STUDIO_RESEARCH_DEFAULT_ON && (restoredSessionState?.strawmanPreviewUrl')
const OWNER_GUARD = '    if (studioShell && !isCurrentRestore()) return\n'
const P = (from, to) => ({ [PAGE]: swap(TEXTS[PAGE], from, to) })
const R = to => P(RESTORE_NOW, to) // a page whose restore line is replaced by `to`
const RESTORE_COND = RESTORE_NOW.slice(RESTORE_NOW.indexOf('if (') + 4, RESTORE_NOW.indexOf(') setWebSearchEnabled(false)')) // the condition between `if (` and `) setWebSearchEnabled(false)`
const RESTORE_TAIL = RESTORE_NOW.slice(RESTORE_NOW.indexOf(') setWebSearchEnabled(false)'))
const restoreWith = cond => `    if (${cond}${RESTORE_TAIL}`
const L = (from, to) => ({ [LIB]: swap(read(LIB), from, to) })
const MUTANTS = [
  ['lib: "True" turns it on', L("process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'", "process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON?.toLowerCase() === 'true'"), libChecks],
  ['lib: anything but "false" turns it on', L("=== 'true'", "!== 'false'"), libChecks],
  ['lib: any value turns it on', L("process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON"), libChecks],
  ['lib: on by default', L("process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'", "process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON !== 'false'"), libChecks],
  ['lib: another env name', L('NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON ===', 'NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT ==='), libChecks],
  ['lib: a second read through a dynamic key', L("=== 'true'", "=== 'true' || process.env['NEXT_PUBLIC_STUDIO_RESEARCH_' + 'DEFAULT_ON'] === 'true'"), libChecks],
  ['lib: an import', L('export const', "import { x } from './y'\nexport const"), libChecks],
  ['page: the first state ignores the flag', P(FIRST_LINE_NOW, FIRST_LINE_NOW.replace('useState(STUDIO_RESEARCH_DEFAULT_ON)', 'useState(false)')), pageRunChecks],
  ['page: the first state is always on', P(FIRST_LINE_NOW, FIRST_LINE_NOW.replace('useState(STUDIO_RESEARCH_DEFAULT_ON)', 'useState(true)')), pageRunChecks],
  ['page: the reset ignores the flag', P(RESET_LINE_NOW, RESET_LINE_NOW.replace('setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON)', 'setWebSearchEnabled(false)')), pageRunChecks],
  ['page: the reset is always on', P(RESET_LINE_NOW, RESET_LINE_NOW.replace('setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON)', 'setWebSearchEnabled(true)')), pageRunChecks],
  ['page: deep research starts with the flag', P(FIRST_RESEARCH, '  const [researchEnabled, setResearchEnabled] = useState(STUDIO_RESEARCH_DEFAULT_ON)'), pageRunChecks],
  ['page: the reset gives deep research the flag', P('    setResearchEnabled(false)\n', '    setResearchEnabled(STUDIO_RESEARCH_DEFAULT_ON)\n'), pageRunChecks],
  ['page: deep research starts with the flag (untouched check)', P(FIRST_RESEARCH, '  const [researchEnabled, setResearchEnabled] = useState(STUDIO_RESEARCH_DEFAULT_ON)'), untouchedChecks],
  ['page: the new-deck handoff also takes the flag', P('    setWebSearchEnabled(pending.web_search || pending.deep_research)', '    setWebSearchEnabled(pending.web_search || pending.deep_research || STUDIO_RESEARCH_DEFAULT_ON)'), untouchedChecks],
  ['page: the new-deck handoff is replaced by the flag', P('    setWebSearchEnabled(pending.web_search || pending.deep_research)', '    setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON)'), untouchedChecks],
  ['page: the deep research setter of the new-deck handoff is dropped', P('    setResearchEnabled(pending.deep_research)\n', ''), untouchedChecks],
  ['page: a handler stops linking the two switches', P('    if (!enabled) setResearchEnabled(false)\n', ''), untouchedChecks],
  ['page: a send reads web search differently', P('        web_search: webSearchEnabled,\n', '        web_search: webSearchEnabled || STUDIO_RESEARCH_DEFAULT_ON,\n'), untouchedChecks],
  ['page: a base line is lost', P('    setKnowledgeGraphEnabled(false)\n    setIsGeneratingFinal(false)\n', '    setIsGeneratingFinal(false)\n'), pageDiffChecks],
  ['page: another base line changes (extended generation resets on)', P('    setExtendedGenerationEnabled(true)\n    setKnowledgeGraphEnabled(false)\n', '    setExtendedGenerationEnabled(false)\n    setKnowledgeGraphEnabled(false)\n'), pageDiffChecks],
  ['page: a marked line loses its marker', P(`${RESET_LINE_NOW}`, RESET_LINE_NOW.replace('// RESEARCH-DEFAULT', '// RESEARCH')), pageDiffChecks],
  ['page: a third line is marked and added', P('  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)\n', '  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)\n  const researchDefaultNote = 1 // RESEARCH-DEFAULT\n'), pageDiffChecks],
  ['page: the import is gone', P("import { STUDIO_RESEARCH_DEFAULT_ON } from '@/lib/studio-research-default' // RESEARCH-DEFAULT\n", ''), pageDiffChecks],
  // the open of a chat (REVIEW-1's P2 and FRONTEND-1's cure 1): the restore line and who may set the switch
  ['open: the restore line runs with the flag off', R(restoreWith(RESTORE_COND.replace('STUDIO_RESEARCH_DEFAULT_ON && ', ''))), openChecks],
  ['open: the restore line sets web search on', R(RESTORE_NOW.replace(') setWebSearchEnabled(false)', ') setWebSearchEnabled(true)')), openChecks],
  ['open: every opened chat is set off (no outline test)', R(`    if (STUDIO_RESEARCH_DEFAULT_ON${RESTORE_TAIL}`), openChecks],
  ['open: a strawman url alone does not count', R(restoreWith(RESTORE_COND.replace('restoredSessionState?.strawmanPreviewUrl || ', ''))), openChecks],
  ['open: a strawman id alone does not count', R(restoreWith(RESTORE_COND.replace('restoredSessionState?.strawmanPresentationId || ', ''))), openChecks],
  ['open: a final deck url alone does not count', R(restoreWith(RESTORE_COND.replace('restoredSessionState?.finalPresentationUrl || ', ''))), openChecks],
  ['open: a final deck id alone does not count', R(restoreWith(RESTORE_COND.replace(' || restoredSessionState?.finalPresentationId', ''))), openChecks],
  ['open: a blank deck counts as an outline', R(restoreWith(RESTORE_COND.replace(' || restoredSessionState?.finalPresentationId)', ' || restoredSessionState?.finalPresentationId || restoredSessionState?.blankPresentationUrl)'))), openChecks],
  ['open: any deck url counts as an outline', R(restoreWith(RESTORE_COND.replace(' || restoredSessionState?.finalPresentationId)', ' || restoredSessionState?.finalPresentationId || restoredSessionState?.presentationUrl)'))), openChecks],
  ['open: the line sits before the owner guard (a superseded restore sets it)', P(`${OWNER_GUARD}${RESTORE_NOW}\n`, `${RESTORE_NOW}\n${OWNER_GUARD}`), openChecks],
  ['open: the line sits before the owner guard (writers check)', P(`${OWNER_GUARD}${RESTORE_NOW}\n`, `${RESTORE_NOW}\n${OWNER_GUARD}`), writersChecks],
  ['open: the line also sets deep research', R(RESTORE_NOW.replace(') setWebSearchEnabled(false)', ') { setWebSearchEnabled(false); setResearchEnabled(false) }')), untouchedChecks],
  ['open: the line is gone', P(`${RESTORE_NOW}\n`, ''), openChecks],
  ['open: the line has no marker', R(RESTORE_NOW.replace(' // RESEARCH-DEFAULT', ' // research default')), pageDiffChecks],
  ['open: the line has no marker (writers check)', R(RESTORE_NOW.replace(' // RESEARCH-DEFAULT', ' // research default')), writersChecks],
  ['open: the line differs from the strip\'s pair (the strip cannot put it back)', R(RESTORE_NOW.replace('setWebSearchEnabled(false)', 'setWebSearchEnabled( false)')), pageDiffChecks],
  ['open: the line reads the outline latch (hasStrawman)', R(restoreWith(RESTORE_COND.replace('STUDIO_RESEARCH_DEFAULT_ON && ', 'STUDIO_RESEARCH_DEFAULT_ON && hasStrawman && '))), writersChecks],
  ['open: an effect keyed on the outline sets it off', P('  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)\n', '  useEffect(() => { if (STUDIO_RESEARCH_DEFAULT_ON && hasStrawman) setWebSearchEnabled(false) }, [hasStrawman]) // RESEARCH-DEFAULT\n  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)\n'), writersChecks],
  ['open: an effect keyed on the outline sets it off (diff check)', P('  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)\n', '  useEffect(() => { if (STUDIO_RESEARCH_DEFAULT_ON && hasStrawman) setWebSearchEnabled(false) }, [hasStrawman]) // RESEARCH-DEFAULT\n  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)\n'), pageDiffChecks],
  ['open: an effect without the marker sets it off when the lock latches', P('  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)\n', '  useEffect(() => { if (hasStrawman) setWebSearchEnabled(false) }, [hasStrawman])\n  const [extendedGenerationEnabled, setExtendedGenerationEnabled] = useState(true)\n'), writersChecks],
  ['open: choosing a chat in the history also sets it off', P('    setKnowledgeGraphEnabled(false)\n    session.handleSessionSelect(sessionId)', '    setKnowledgeGraphEnabled(false)\n    setWebSearchEnabled(false)\n    session.handleSessionSelect(sessionId)'), writersChecks],
  ['open: a marked second restore line (every opened chat sets the default)', P(`${RESTORE_NOW}\n`, `${RESTORE_NOW}\n    setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON) // RESEARCH-DEFAULT\n`), writersChecks],
  ['open: the wrapper loses its owner guard', P(OWNER_GUARD, ''), openChecks],
  ['lib: the comment goes back to the old words (a reopened chat keeps its saved value)', { [LIB]: swap(read(LIB), SENTENCE, 'On, a new chat in the Builder starts with web search on. Deep research stays off, and a reopened chat keeps the value it was saved with.') }, libChecks],
  ['lib: the comment drops the outlined chat', { [LIB]: swap(read(LIB), ' A chat that already has an outline opens with web search off, as before.', '') }, libChecks],
  ['env: the block says the old words', { [ENV]: swap(TEXTS[ENV], SENTENCE, 'On: a new chat in the Builder starts with Research (web search) switched on. Deep research stays off, and a reopened chat keeps the value it was saved with.') }, envChecks],
  ['env: the block drops the outlined chat', { [ENV]: swap(TEXTS[ENV], ' A chat that already has an outline opens with web search off, as before.', '') }, envChecks],
  ['hook: a line is added', { [HOOK]: TEXTS[HOOK].replace('web_search: webSearch,', 'web_search: webSearch || false,') }, untouchedChecks],
  ['composer: a line is added', { [CLEAN]: `${TEXTS[CLEAN]}// x\n` }, untouchedChecks],
  ['env: the default is edited to "true"', { [ENV]: swap(TEXTS[ENV], `${FLAG}="false"`, `${FLAG}="true"`) }, envChecks],
  ['env: the block is not last', { [ENV]: `${TEXTS[ENV]}\n# something after\n` }, envChecks],
  ['env: the block is gone', { [ENV]: swap(TEXTS[ENV], `\n${ENV_BLOCK}`, '') }, envChecks],
  ['env: the flag is assigned twice', { [ENV]: `${TEXTS[ENV]}${FLAG}="false"\n` }, envChecks],
  ['env: a base line is edited', { [ENV]: swap(TEXTS[ENV], 'NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH="false"', 'NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH="true"') }, envChecks],
  ['hook: it reads the flag itself', { [HOOK]: `${TEXTS[HOOK]}const x = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON\n` }, oneReadChecks],
  ['page: it reads the flag itself', { [PAGE]: `${TEXTS[PAGE]}const y = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON\n` }, oneReadChecks],
  ['pin: a taught proof loses its mark', { 'scripts/test-studio-job-ledger.mjs': swap(TEXTS['scripts/test-studio-job-ledger.mjs'], 'registry read (RESEARCH-DEFAULT): every read', 'registry read: every read') }, pinChecks],
  ['pin: a read hook goes through the whole registry', { 'scripts/test-studio-job-ledger.mjs': TEXTS['scripts/test-studio-job-ledger.mjs'].replace('stripResearchDefault(rel, out) : out', 'registry.stripLaterChanges(rel, out) : out') }, pinChecks],
  ['pin: a subject splice names another subject too', { 'scripts/test-studio-deck-sync-truth.mjs': TEXTS['scripts/test-studio-deck-sync-truth.mjs'].replace('!/^Research default:/.test', '!/^(Research default|Research switch):/.test') }, pinChecks],
  ['pin: a taught proof loses a base line', { 'scripts/test-studio-billing-f5-usage.mjs': swap(TEXTS['scripts/test-studio-billing-f5-usage.mjs'], "import * as registry from './studio-later-changes.mjs'\n", '') }, pinChecks],
  ['pin: a taught proof gains a stray unmarked line', { 'scripts/test-studio-chat-element-refine.mjs': `${TEXTS['scripts/test-studio-chat-element-refine.mjs']}// stray\n` }, pinChecks],
  ['pin: a taught proof gains a second hook', { 'scripts/test-studio-new-deck-handoff-send.mjs': `${TEXTS['scripts/test-studio-new-deck-handoff-send.mjs']}{ fs.readFileSync = () => '' } // LATER-CHANGES: registry read (RESEARCH-DEFAULT)\n` }, pinChecks],
  ['pin: the diff splice drops every removed line', { 'scripts/test-studio-chat-element-edit.mjs': TEXTS['scripts/test-studio-chat-element-edit.mjs'].replace('diff.filter(line => !researchDefaultDiffLine(line))', "diff.filter(line => !line.startsWith('-'))") }, pinChecks],
  ['lib: a secret', { [LIB]: `${read(LIB)}// sk-${'a'.repeat(24)}\n` }, secretChecks],
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
await mutant('strip module: the diff helper takes any removed line', async () => pinChecks(TEXTS, await strippedWith('return RESEARCH_DEFAULT_WAS_LINES.has(line.slice(1))', 'return true')))
await mutant('strip module: the diff helper takes any added line', async () => pinChecks(TEXTS, await strippedWith('return RESEARCH_DEFAULT_MARKER_RE.test(line)', 'return true')))
await mutant('strip module: a taught proof is left out of the list', async () => pinChecks(TEXTS, await strippedWith('Object.keys(RESEARCH_DEFAULT_PIN_EDITS)', 'Object.keys(RESEARCH_DEFAULT_PIN_EDITS).slice(1)')))
await mutant('strip module: the strip does not put the proofs back', async () => pinChecks(TEXTS, await strippedWith('if (!(rel in RESEARCH_DEFAULT_EDITS) && !(rel in RESEARCH_DEFAULT_PIN_EDITS)) return text', 'if (!(rel in RESEARCH_DEFAULT_EDITS)) return text')))
await mutant('strip module: the page edit is not put back', async () => { const mod = await strippedWith('.reduce((out, [has, was]) => out.replace(has, () => was), text)', '.reduce((out, [has, was]) => was === "" ? out.replace(has, () => was) : out, text)'); assert.equal(mod.stripResearchDefault(PAGE, read(PAGE)), baseText(PAGE), 'the strip gives dev\'s page') })
await mutant('scope: a stray file', () => scopeCheck(allCommits(), ['components/builder/message-list.tsx']))
await mutant('scope: the page of another change', () => scopeCheck(allCommits(), ['components/presentation-viewer.tsx']))
await mutant('commit: no co-author line', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'a body\n'), []))
await mutant('commit: another co-author', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\n'), []))
await mutant('commit: another subject', () => assert.deepEqual(messageProblems('Fix a thing', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))

console.log(`\n${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`FAILED: ${failed.join('; ')}`); if (missed.length) console.error(`MISSED: ${missed.join('; ')}`); process.exit(1) }
process.exit(0)
