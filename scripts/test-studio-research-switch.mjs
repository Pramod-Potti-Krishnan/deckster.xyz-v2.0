// FRONTEND-1: proof of the Research on / off switch (PK mandate M4 of 15 Nov 2026: "Research is its own switch, separate from the level, feeding the same package to every level"). Flag NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH, the exact string
// "true", default off; it acts only with NEXT_PUBLIC_STUDIO_V4_SHELL and NEXT_PUBLIC_STUDIO_CHAT_CLEAN on as well.
//
//   node scripts/test-studio-research-switch.mjs        (plain node, offline: the REAL sources transpiled and run in a vm; the page's research handlers and the hook's research lines are cut out of the real files and RUN; react-dom/server for markup;
//                                                        git is read for the strip, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to E), then mutants (F):
//  A. the lib: the flag (each of the three, odd values), when the switch reads on (web search or deep research), what a click asks for (the other state; nothing while the deck's research settings are frozen), the words;
//  B. the chip: drawn only with the flag, beside the model / level button, never beside the v3 study's own chips; pressed while research is on; disabled and said so while locked; a click calls the composer's web-search handler with the other state, once, and nothing else;
//  C. WHAT GOES OUT (pinned with DIRECTOR-2 and KNOWLEDGE-3, 15 Nov). The page's real handlers (the same ones the research options menu uses: Deep research implies web search, turning web search off turns Deep research off) and the hook's real research lines give, for each of the
//     chip's states and for the menu's Deep research on top of it, the two booleans Director already reads and latches, unchanged (data.web_search, data.deep_research; src/handlers/websocket.py:3212 and :3220 of branch agent1/agent-theme-rules, 2246b8af; the freeze after the
//     strawman is src/utils/research_settings.py), and with the flag on ONE additive key, data.research "on" | "off", that always agrees with them; the other two research booleans (file_upload, use_knowledge_graph) are not touched. Default (never touched): both false, research "off",
//     as today plus the one key; flag off: no key at all. The switch is independent of the level picker: the same at every level, and no level-dependent research key anywhere in the marked lines;
//  D. the send side with the flag off is the base's, byte for byte (every combination of the composer's props, with and without the model picker and the level picker's flag), and the sources: the marked lines, the strip (which leaves the level picker's lines alone),
//     the registry, .env.example, the scope (read from the COMMITTED diff only), the commits;
//  E. each flag is read from one literal env name; nothing else reads it.
//  F. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import * as stripModule from './studio-research-switch-strip.mjs'
import * as levelsStrip from './studio-thinking-levels-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const { BASE_COMMIT, RESEARCH_SWITCH_SCOPE_FILES: SCOPE, RESEARCH_SWITCH_NEW_FILES: NEW_FILES, RESEARCH_SWITCH_FILES: APP_FILES, RESEARCH_SWITCH_MARKER_RE: MARKER_RE, RESEARCH_SWITCH_ENV_BLOCK: ENV_BLOCK, RESEARCH_SWITCH_SUBJECT: SUBJECT, RESEARCH_SWITCH_EDITS: EDITS, RESEARCH_SWITCH_FLAGS: FLAGS } = stripModule
const STRIP_FN = stripModule.stripResearchSwitch

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }
const deepEqual = (actual, expected, ...message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual ?? null)), JSON.parse(JSON.stringify(expected ?? null)), ...message)

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
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

const LIB = 'lib/studio-research-switch.ts', HOOK = 'hooks/use-deckster-websocket-v2.ts', PAGE = 'app/builder/page.tsx', CLEAN = 'components/builder/chat/studio-chat-clean.tsx', REGISTRY = 'scripts/studio-later-changes.mjs'
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const localFile = (spec, from) => {
  const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('./') ? path.posix.join(path.posix.dirname(from), spec.slice(2)) : null
  if (base === null) return null
  for (const ext of ['', '.ts', '.tsx', '/index.ts']) if (fs.existsSync(path.join(root, base + ext)) && fs.statSync(path.join(root, base + ext)).isFile()) return base + ext
  throw new Error(`unexpected import ${spec} in ${from}`)
}
const textsKeys = new WeakMap(), modules = new Map()
const textsKey = texts => { if (!textsKeys.has(texts)) textsKeys.set(texts, crypto.createHash('sha1').update(JSON.stringify(texts)).digest('hex')); return textsKeys.get(texts) }
function load(rel, { env = {}, texts = {} } = {}) {
  const key = `${rel}\0${JSON.stringify(env)}\0${textsKey(texts)}`
  if (modules.has(key)) return modules.get(key)
  const module = { exports: {} }
  modules.set(key, module.exports)
  const req = spec => {
    if (spec === 'react') return React
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    const local = localFile(spec, rel)
    return local ? load(local, { env, texts }) : nodeRequire(spec)
  }
  vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), { module, exports: module.exports, require: req, process: { env: { ...env } }, setTimeout, clearTimeout, AbortController, matchMedia: undefined, fetch: () => assert.fail(`${rel} fetched`) }, { filename: rel })
  return module.exports
}
const h = React.createElement
const walk = (node, visit) => {
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return }
  if (!React.isValidElement(node)) return
  visit(node)
  walk(typeof node.type === 'function' ? node.type(node.props) : node.props?.children, visit)
}
const elements = (root0, pred) => { const out = []; walk(root0, el => { if (pred(el)) out.push(el) }); return out }
const lineWith = (text, needle) => { const hits = text.split('\n').filter(line => line.includes(needle)); assert.equal(hits.length, 1, `exactly one line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] }
function runFragment(code, names) {
  const source = `(function (${names.join(', ')}) {\n${code}\n})`
  const js = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } })
  const errors = (js.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `the marked lines parse: ${errors[0] ? ts.flattenDiagnosticMessageText(errors[0].messageText, ' ') : ''}`)
  return vm.runInNewContext(js.outputText, { React, setTimeout: () => assert.fail('a line scheduled a timer'), setInterval: () => assert.fail('a line scheduled an interval'), queueMicrotask: () => assert.fail('a line queued a microtask') })
}

const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' }
const ENV_ON = { ...SHELL, NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH: 'true' }
const without = (env, key) => Object.fromEntries(Object.entries(env).filter(([k]) => k !== key))
const ENV_OFF = {
  'nothing set': {},
  'switch unset (the rest on)': SHELL,
  'switch "false"': { ...SHELL, NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH: 'false' },
  'switch "True"': { ...SHELL, NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH: 'True' },
  'switch "1"': { ...SHELL, NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH: '1' },
  'switch " true"': { ...SHELL, NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH: ' true' },
  'shell unset (switch on)': without(ENV_ON, 'NEXT_PUBLIC_STUDIO_V4_SHELL'),
  'shell "TRUE"': { ...ENV_ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'TRUE' },
  'clean composer unset (switch on)': without(ENV_ON, 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN'),
  'clean composer "yes"': { ...ENV_ON, NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'yes' },
}
const LEAK = /sonnet|opus|claude|anthropic|openrouter|openai|gpt|gemini|vertex|router|model|provider|token|dollar|\$|price/i

// ============================================================================================================================================
// A. the lib
// ============================================================================================================================================
function libChecks(texts = {}) {
  const lib = env => load(LIB, { env, texts })
  for (const [name, env] of Object.entries(ENV_OFF)) assert.equal(lib(env).STUDIO_RESEARCH_SWITCH_ENABLED, false, `${name}: off`)
  assert.equal(lib(ENV_ON).STUDIO_RESEARCH_SWITCH_ENABLED, true, 'all three on: on')
  const L = lib(ENV_ON)
  assert.deepEqual([L.studioResearchSwitchOn('true', 'true', 'true'), L.studioResearchSwitchOn(undefined, 'true', 'true'), L.studioResearchSwitchOn('true', undefined, 'true'), L.studioResearchSwitchOn('true', 'true', undefined), L.studioResearchSwitchOn('TRUE', 'true', 'true')], [true, false, false, false, false], 'the three-flag rule')
  for (const web of [true, false]) for (const deep of [true, false]) for (const locked of [true, false]) {
    const state = { web, deep, locked }
    assert.equal(L.researchSwitchOn(state), web || deep, `on while web search or deep research is on (${JSON.stringify(state)})`)
    assert.equal(L.researchSwitchNext(state), locked ? null : !(web || deep), `a click asks for the other state, nothing while frozen (${JSON.stringify(state)})`)
  }
  for (const web of [true, false]) for (const deep of [true, false]) assert.equal(L.researchOnWire(web, deep), web || deep ? 'on' : 'off', `the research key for web ${web}, deep ${deep}`)
  const words = []; (function collect(value) { if (typeof value === 'string') words.push(value); else if (value && typeof value === 'object') Object.values(value).forEach(collect) })(L.RESEARCH_COPY)
  assert.equal(L.RESEARCH_COPY.label, 'Research'); for (const word of words) assert.doesNotMatch(word, LEAK, `plain words: ${word}`)
  assert.equal(L.RESEARCH_COPY.lockedNote, load('lib/studio-chat-clean.ts', { env: {} }).CHAT_CLEAN_WORDS.lockedNote, 'the locked note is the composer\'s own words')
}

// ============================================================================================================================================
// B. the chip
// ============================================================================================================================================
const sendSideProps = (over = {}) => ({ composer: { showStop: false, stopEnabled: false }, onStop() {}, research: { deep: false, onDeep() {}, web: false, onWeb() {}, locked: false }, picker: { sessionId: null, disabled: false }, ...over })
/** Radix numbers its ids from one counter per React, so two renders in one process differ in aria-controls only: the ids are normalised. */
const noIds = markup => markup.replace(/radix-_R_[A-Za-z0-9]+_/g, 'radix-ID')
function sendSide(env, props = {}, text = read(CLEAN), texts = {}) { const C = load(CLEAN, { env, texts: { ...texts, [CLEAN]: text } }); return noIds(renderToStaticMarkup(h(C.StudioChatCleanSendSide, sendSideProps(props)))) }
const chipOf = (env, research, texts = {}) => {
  const C = load(CLEAN, { env, texts })
  const found = elements(C.StudioChatCleanSendSide(sendSideProps({ research })), el => el.props?.['data-studio-chat-clean-toggle'] === 'research')
  return found
}
function chipChecks(texts = {}) {
  const calls = [], research = (over = {}) => ({ deep: false, web: false, locked: false, onDeep: v => calls.push(['deep', v]), onWeb: v => calls.push(['web', v]), ...over })
  for (const [name, env] of Object.entries(ENV_OFF)) assert.equal(chipOf(env, research(), texts).length, 0, `${name}: no chip`)
  assert.equal(chipOf(ENV_ON, research(), texts).length, 1, 'on: one chip')
  const markup = (over, env = ENV_ON) => sendSide(env, { research: research(over) }, texts[CLEAN] ?? read(CLEAN), texts)
  const off = markup({}), on = markup({ web: true }), deepOnly = markup({ deep: true }), locked = markup({ web: true, locked: true })
  assert.ok(/data-studio-chat-clean-toggle="research"/.test(off) && />Research</.test(off), 'the chip says Research'); assert.ok(off.includes('aria-pressed="false"'), 'off: not pressed')
  assert.ok(on.includes('aria-pressed="true"'), 'web search on: pressed'); assert.ok(deepOnly.includes('aria-pressed="true"'), 'deep research on: pressed')
  assert.ok(/ disabled=""/.test(locked) && locked.includes('Locked for this deck'), 'locked: disabled, and the title says why'); assert.ok(!/ disabled=""/.test(off) && off.includes('Gather sources before building this deck.'), 'unlocked: enabled, with its note')
  // v3 study chips: with CHAT_CLEAN_CHOICES.research = 'chips' the switch is not drawn beside them (the composer's own Web search chip is the same switch)
  const chipsMod = { 'lib/studio-chat-clean.ts': swap(read('lib/studio-chat-clean.ts'), "research: 'menu' as 'chips' | 'menu',", "research: 'chips' as 'chips' | 'menu',") }
  const withChips = load(CLEAN, { env: ENV_ON, texts: { ...texts, ...chipsMod } })
  assert.equal(elements(withChips.StudioChatCleanSendSide(sendSideProps()), el => el.props?.['data-studio-chat-clean-toggle'] === 'research').length, 0, 'beside the study\'s own Web search / Deep research chips there is no third one')
  // a click: the other state, once, through the composer's web-search handler, and nothing else; frozen: nothing
  for (const [state, expected] of [[{ web: false, deep: false }, [['web', true]]], [{ web: true, deep: false }, [['web', false]]], [{ web: true, deep: true }, [['web', false]]], [{ web: false, deep: true }, [['web', false]]], [{ web: false, deep: false, locked: true }, []], [{ web: true, deep: false, locked: true }, []]]) {
    calls.length = 0
    const [chip] = chipOf(ENV_ON, research(state), texts); chip.props.onClick()
    deepEqual(calls, expected, `a click at ${JSON.stringify(state)}`)
  }
  // beside the model picker or the level picker, in the same place: the chip comes before it in the send side (the stylesheet orders them: chip 11, gauge 10)
  const both = sendSide({ ...ENV_ON, NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' }, {}, texts[CLEAN] ?? read(CLEAN), texts)
  assert.ok(both.indexOf('data-studio-chat-clean-toggle="research"') >= 0 && both.indexOf('data-studio-chat-clean-toggle="research"') < both.indexOf('data-mpick="gauge"'), 'the chip stands before the model gauge in the markup (the stylesheet puts the gauge first on screen)')
  const css = read('components/builder/studio-chat-clean.css')
  assert.ok(css.includes('[data-studio-chat-clean-toggle] {') && css.includes('order: 11;'), 'the existing stylesheet already styles a toggle chip (nothing to add)')
}

// ============================================================================================================================================
// C. what goes out: the page's real handlers and the hook's real research lines
// ============================================================================================================================================
function wireChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), hook = texts[HOOK] ?? read(HOOK), lines = page.split('\n')
  const from = lines.findIndex(l => l.startsWith('  const handleResearchEnabledChange = useCallback(')), to = lines.findIndex((l, i) => i > from && l === '  }, [])', from) // first close
  const second = lines.findIndex((l, i) => i > to && l === '  }, [])')
  assert.ok(from > 0 && to > from && second > to && lines[second - 3].startsWith('  const handleWebSearchEnabledChange = useCallback('), 'the two handlers are where the base has them')
  const block = lines.slice(from, second + 1).join('\n')
  const send = lineWith(hook, 'const deepResearch = options?.deepResearch ?? false;') + '\n' + lineWith(hook, 'const webSearch = (options?.webSearch ?? false) || deepResearch;')
  const field = [lineWith(hook, 'deep_research: deepResearch,'), lineWith(hook, 'web_search: webSearch,')].join('\n')
  // the composer's state through the page's handlers, a send through the hook's lines
  const spreadLine = lineWith(hook, '...(STUDIO_RESEARCH_SWITCH_ENABLED && { research: researchOnWire(webSearch, deepResearch) })')
  const model = (env = ENV_ON) => {
    const state = { deep: false, web: false }, flags = load(LIB, { env, texts })
    const handlers = runFragment(`const useCallback = fn => fn\n${block}\nreturn { handleResearchEnabledChange, handleWebSearchEnabledChange }`, ['setResearchEnabled', 'setWebSearchEnabled'])(v => { state.deep = v }, v => { state.web = v })
    const message = () => runFragment(`${send}\nreturn { ${field}\n${spreadLine}\n}`, ['options', 'STUDIO_RESEARCH_SWITCH_ENABLED', 'researchOnWire'])({ deepResearch: state.deep, webSearch: state.web }, flags.STUDIO_RESEARCH_SWITCH_ENABLED, flags.researchOnWire)
    return { state, handlers, message }
  }
  const C = load(LIB, { env: ENV_ON, texts }), click = m => { const next = C.researchSwitchNext({ ...m.state, locked: false }); m.handlers.handleWebSearchEnabledChange(next) } // the chip's click: onWeb is the page's web-search handler
  const untouched = model(); deepEqual(untouched.message(), { deep_research: false, web_search: false, research: 'off' }, 'never touched: both false, research "off"')
  const a = model(); click(a); deepEqual(a.message(), { deep_research: false, web_search: true, research: 'on' }, 'chip on: web search (standard research), no deep research, research "on"')
  click(a); deepEqual(a.message(), { deep_research: false, web_search: false, research: 'off' }, 'chip off again: both false, research "off"')
  const b = model(); click(b); b.handlers.handleResearchEnabledChange(true); deepEqual(b.message(), { deep_research: true, web_search: true, research: 'on' }, 'the menu\'s Deep research on top of the chip: both, research "on"')
  assert.equal(C.researchSwitchOn({ ...b.state, locked: false }), true, 'the chip reads on'); click(b); deepEqual(b.message(), { deep_research: false, web_search: false, research: 'off' }, 'the chip off turns both off, the menu agrees')
  const c = model(); c.handlers.handleResearchEnabledChange(true); assert.equal(C.researchSwitchOn({ ...c.state, locked: false }), true, 'Deep research from the menu alone reads as on (it implies web search)'); click(c); deepEqual(c.message(), { deep_research: false, web_search: false, research: 'off' }, 'and the chip turns it off')
  const flagOff = model({ ...SHELL }); click(flagOff); deepEqual(flagOff.message(), { deep_research: false, web_search: true }, 'flag off: the two booleans as before and no research key')
  for (const [name, env] of Object.entries(ENV_OFF)) { const m = model(env); m.handlers.handleWebSearchEnabledChange(true); assert.equal('research' in m.message(), false, `${name}: no research key`) }
  for (const web of [true, false]) for (const deep of [true, false]) { const m = model(); m.state.web = web; m.state.deep = deep; const out = m.message(); assert.equal(out.research, out.web_search || out.deep_research ? 'on' : 'off', `the research key agrees with the booleans (${web}, ${deep})`) }
  // the hook's other research booleans are not touched: file_upload and use_knowledge_graph are the base's lines
  for (const needle of ['file_upload: options?.fileUpload ?? !!effectiveStoreName,', 'use_knowledge_graph: options?.useKnowledgeGraph ?? false,']) assert.equal(lineWith(hook, needle), lineWith(baseText(HOOK), needle), `${needle} is the base's line`)
  // frozen once the deck's research ran: the chip changes nothing (the page's lock, hasStrawman, disables it; Director refuses the change anyway)
  assert.equal(C.researchSwitchNext({ web: true, deep: false, locked: true }), null)
  assert.ok(page.includes('const researchSettingsLocked = hasStrawman'), 'the lock is the page\'s own (hasStrawman)')
  // the same two booleans at every level: the level picker adds no research key, and nothing in the marked lines of either change is level dependent
  const RESEARCH_WORD = /\b(web_search|deep_research|webSearch|deepResearch|research)\b/g, wordsOf = text => (text.match(RESEARCH_WORD) || []).length
  for (const [rel, pairs] of Object.entries(levelsStrip.THINKING_LEVELS_EDITS)) for (const [has, was] of pairs) assert.equal(wordsOf(has), wordsOf(was), `the level picker's lines add no research key (${rel}: ${has.trim().slice(0, 70)})`) // a rewritten line keeps the research props it had (research={chatCleanResearch}); an inserted one has none
  const mine = Object.values(EDITS).flat().map(([has]) => has).join('\n')
  assert.equal(/thinking|level|build_mode|buildMode/i.test(mine.replace(/RESEARCH-SWITCH[^\n]*/g, '')), false, 'the switch\'s lines read no level and no build mode')
  assert.deepEqual(EDITS[HOOK].map(([has]) => has.trim().split(' ')[0]), ['import', 'research?:', '...(STUDIO_RESEARCH_SWITCH_ENABLED'], 'the hook gains three lines: the import, the type, the spread')
  assert.equal(/user_message|sendMessage|web_search|deep_research|use_knowledge_graph|file_upload/.test(mine.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), false, 'and name no other research key (comments aside): the one key they add is "research"')
  // Director's side, read-only: the two keys are read and latched session-sticky; nothing here claims more
  assert.match(texts[LIB] ?? read(LIB), /websocket\.py, "Extract and latch researcher/, 'the lib cites where Director reads them')
}

// ============================================================================================================================================
// D. flag off, and the sources
// ============================================================================================================================================
function offChecks(texts = {}) {
  const modelOn = { ...SHELL, NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' }
  for (const env of [{}, SHELL, modelOn, { ...modelOn, NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE: 'true' }, { ...modelOn, NEXT_PUBLIC_STUDIO_THINKING_LEVELS: 'true', NEXT_PUBLIC_AGENT_MODE: 'true' }, ...Object.values(ENV_OFF)]) for (const props of [{}, { composer: { showStop: true, stopEnabled: true } }, { research: { deep: true, onDeep() {}, web: true, onWeb() {}, locked: true } }, { picker: { sessionId: 'abc', disabled: true } }]) {
    const base = sendSide(env, props, baseText(CLEAN), { [CLEAN]: baseText(CLEAN) }), now = sendSide(env, props, texts[CLEAN] ?? read(CLEAN), texts)
    assert.equal(now, base, `flag off: the send side is the base's, byte for byte (${JSON.stringify(Object.keys(props))}, ${JSON.stringify(Object.keys(env))})`)
  }
}
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}
const laterStrips = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }
const laterEnv = text => { const blocks = registry.LATER_ENV_BLOCKS, at = blocks.indexOf(ENV_BLOCK); return (at === -1 ? [] : blocks.slice(at + 1)).reduce((out, later) => out.replace(`\n${later}`, ''), text) }
const TEXTS = Object.fromEntries([...APP_FILES, ...NEW_FILES, ...stripModule.RESEARCH_SWITCH_PIN_FILES, '.env.example', REGISTRY].map(rel => [rel, read(rel)]))

function sourceChecks(texts, mod = stripModule) {
  const strip = mod.stripResearchSwitch, edits = mod.RESEARCH_SWITCH_EDITS, files = mod.RESEARCH_SWITCH_FILES, block = mod.RESEARCH_SWITCH_ENV_BLOCK
  for (const rel of files) {
    const now = laterStrips(rel, texts[rel]), out = strip(rel, now), noLevels = levelsStrip.stripThinkingLevels(rel, out)
    assert.equal(noLevels, baseText(rel), `${rel}: without this change's edits (and the level picker's) the file is the base's, byte for byte`)
    assert.equal(strip(rel, out), out, `${rel}: stripping twice changes nothing more`)
    assert.notEqual(now, baseText(rel), `${rel}: the change is there to strip`)
    assert.ok(out.includes('THINKING-LEVELS') && !out.includes('RESEARCH-SWITCH'), `${rel}: this strip leaves the level picker's lines and takes only its own`)
  }
  for (const rel of ['components/builder/message-list.tsx', '.env.example', REGISTRY]) assert.equal(strip(rel, 'x\nRESEARCH-SWITCH\n'), 'x\nRESEARCH-SWITCH\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(strip(files[0], 5), 5, 'a text that is not a string comes back as it is')
  for (const rel of files) {
    const mine = levelsStrip.stripThinkingLevels(rel, laterStrips(rel, texts[rel])), diff = lineDiff(baseText(rel), mine)
    const allowed = new Set((edits[rel] || []).flatMap(([, was]) => was.split('\n')).filter(line => line !== ''))
    for (const line of diff.added) assert.match(line, MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    assert.deepEqual(diff.removed, [], `${rel}: a pure insertion: no base line is lost`); assert.equal(allowed.size, 0, `${rel}: no pair rewrites a base line`)
  }
  // the older proofs this change teaches: each gains its marked lines and loses none, and is the base's without them (past the level picker's, which is another change's)
  const PIN_GAINS = { 'scripts/test-studio-agent-mode-wire.mjs': 2, 'scripts/test-studio-chat-element-edit.mjs': 1, 'scripts/test-studio-deck-sync-truth.mjs': 1 }
  assert.deepEqual([...mod.RESEARCH_SWITCH_PIN_FILES].sort(), Object.keys(PIN_GAINS).sort(), 'the older proofs this change teaches')
  for (const [rel, gained] of Object.entries(PIN_GAINS)) {
    const now = laterStrips(rel, texts[rel]), mine = levelsStrip.stripThinkingLevels(rel, now), diff = lineDiff(baseText(rel), mine)
    assert.equal(levelsStrip.stripThinkingLevels(rel, strip(rel, now)), baseText(rel), `${rel}: without this change's lines (and the level picker's) the proof is the base's, byte for byte`)
    assert.equal(strip(rel, strip(rel, now)), strip(rel, now), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, gained], `${rel}: the proof gains ${gained} marked lines and loses none`)
    for (const line of diff.added) assert.ok(line.includes(mod.RESEARCH_SWITCH_PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
    for (const line of diff.added.filter(added => added.includes('fs.readFileSync = '))) assert.ok(line.includes('stripResearchSwitch(rel, out)') && !line.includes('stripLaterChanges') && !line.includes('registry.'), `${rel}: the read hook uses this change's own strip, never the registry`)
    for (const line of diff.added.filter(added => added.includes('shas.splice'))) assert.ok(line.includes('^Research switch:') && !line.includes('Thinking levels'), `${rel}: the splice names this change's own subject, and only that`)
  }
  for (const [rel, flag] of mod.RESEARCH_SWITCH_LIB_FLAGS) {
    assert.equal((texts[rel].match(new RegExp(`process\\.env\\.${flag}\\b`, 'g')) || []).length, 1, `${rel} reads the literal env name ${flag} once`)
    assert.deepEqual([...texts[rel].matchAll(/^import .*$/gm)].map(m => m[0]), [], `${rel} is import-free`)
    for (const other of [...files, ...mod.RESEARCH_SWITCH_NEW_FILES.filter(f => /^(hooks|components)\//.test(f))]) assert.equal((texts[other] || '').includes(`process.env.${flag}`), false, `${other} does not read ${flag} itself`)
  }
  assert.equal(laterEnv(texts['.env.example']), `${baseText('.env.example')}\n${levelsBlockOf()}\n${block}`, '.env.example is the base plus the blocks')
  for (const flag of mod.RESEARCH_SWITCH_FLAGS) {
    assert.match(block, new RegExp(`^${flag}="false"$`, 'm'), `the block documents ${flag} as "false"`)
    assert.equal((texts['.env.example'].match(new RegExp(`^${flag}=`, 'gm')) || []).length, 1, `.env.example assigns ${flag} once`)
  }
  assert.ok(block.endsWith('\n') && block.split('\n').filter(line => line && !line.startsWith('#')).length === mod.RESEARCH_SWITCH_FLAGS.length, 'the block is comments and one assignment per flag')
  for (const rel of [...files, ...mod.RESEARCH_SWITCH_NEW_FILES, '.env.example']) assert.doesNotMatch(texts[rel] ?? read(rel), SECRET, `${rel}: no secret`)
}
/** The level picker's block as it stands in .env.example (registered before this one): "" when the registry does not name it. */
const levelsBlockOf = () => { const at = registry.LATER_ENV_BLOCKS.indexOf(levelsStrip.THINKING_LEVELS_ENV_BLOCK); return at >= 0 && at < registry.LATER_ENV_BLOCKS.indexOf(ENV_BLOCK) ? levelsStrip.THINKING_LEVELS_ENV_BLOCK : '' }
function registryChecks(text, texts = TEXTS) {
  for (const list of ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS']) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n').filter(Boolean)
    const own = rows.findIndex(line => line.includes('studio-research-switch-strip.mjs')), levels = rows.findIndex(line => line.includes('studio-thinking-levels-strip.mjs'))
    assert.ok(own > levels && levels > 0, `${list}: this change's line comes after the level picker's`)
    assert.equal((text.slice(start, end).match(/studio-research-switch-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-research-switch-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes('// LATER-CHANGE: FRONTEND-1, M4 the Research on / off switch')), 'each carries the registry marker')
  assert.deepEqual(lineDiff(baseText(REGISTRY), text).removed, [], 'and loses none')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the block is registered')
  assert.ok([...SCOPE].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  for (const rel of APP_FILES) assert.equal(registry.stripLaterChanges(rel, texts[rel]), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(FLAGS.some(flag => registry.stripLaterEnvBlocks('.env.example', texts['.env.example']).includes(flag)), false, 'the registry takes the block out of .env.example')
}
function ownCommits(ref = 'HEAD') { return git('rev-list', '--no-merges', `${BASE_COMMIT}..${ref}`).split('\n').filter(Boolean).filter(commit => git('log', '-1', '--format=%s', commit).startsWith(SUBJECT)) }
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body) { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line'); return problems }

// ============================================================================================================================================
// run
// ============================================================================================================================================
await check('A. the lib: the flag, when the switch reads on, what a click asks for, the words', () => libChecks())
await check('B. the chip: drawn only with the flag, pressed while research is on, locked, one call per click', () => chipChecks())
await check('C. what goes out: the page\'s real handlers and the hook\'s real lines give the two booleans Director already reads; default as today; the same at every level', () => wireChecks())
await check('D1. flag off: the send side is the base\'s, byte for byte, for every combination', () => offChecks())
await check('D2. the sources: markers, the strip, the lib, .env.example, secrets', () => sourceChecks(TEXTS))
await check('D3. the registry (three lines, after the level picker\'s, at the true ends)', () => registryChecks(TEXTS[REGISTRY]))
await check('D4. scope, from the COMMITTED diff only; the commits', () => {
  const commits = ownCommits(); assert.ok(commits.length >= 1, 'this change has commits of its own')
  scopeCheck(commits)
  for (const commit of commits) assert.deepEqual(messageProblems(git('log', '-1', '--format=%s', commit), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
})
await check('E. the flag is read from one literal env name', () => { assert.equal((TEXTS[LIB].match(/process\.env\.NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH\b/g) || []).length, 1) })

// ---- F. mutants ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const TEXT = { [LIB]: read(LIB), [CLEAN]: read(CLEAN), [PAGE]: read(PAGE), [HOOK]: read(HOOK) }
const M = (rel, from, to) => ({ [rel]: swap(TEXT[rel], from, to) })
const MUTANTS = [
  ['lib: the flag does not need the clean composer', M(LIB, "flag === 'true' && shell === 'true' && chatClean === 'true'", "flag === 'true' && shell === 'true'"), libChecks],
  ['lib: the flag accepts "True"', M(LIB, "flag === 'true' &&", "flag?.toLowerCase() === 'true' &&"), libChecks],
  ['lib: deep research alone reads as off', M(LIB, 'state.web || state.deep', 'state.web'), libChecks],
  ['lib: a click while frozen still asks for a change', M(LIB, '(state.locked ? null : !researchSwitchOn(state))', '!researchSwitchOn(state)'), libChecks],
  ['lib: a click asks for the same state', M(LIB, '(state.locked ? null : !researchSwitchOn(state))', '(state.locked ? null : researchSwitchOn(state))'), libChecks],
  ['lib: the note names a model', M(LIB, "note: 'Gather sources before building this deck. Deep research is in the research options.'", "note: 'Gather sources with the best model before building this deck.'"), libChecks],
  ['chip: drawn with no flag', M(CLEAN, '{STUDIO_RESEARCH_SWITCH_ENABLED && !chips ?', '{!chips ?'), chipChecks],
  ['chip: drawn beside the study\'s own chips', M(CLEAN, '{STUDIO_RESEARCH_SWITCH_ENABLED && !chips ?', '{STUDIO_RESEARCH_SWITCH_ENABLED ?'), chipChecks],
  ['chip: never pressed', M(CLEAN, 'aria-pressed={researchSwitchOn(research)}', 'aria-pressed={false}'), chipChecks],
  ['chip: not disabled while locked', M(CLEAN, 'disabled={research.locked} onClick={() => { const next = researchSwitchNext(research)', 'onClick={() => { const next = researchSwitchNext(research)'), chipChecks],
  ['chip: a click turns deep research on, not web search', M(CLEAN, 'if (next !== null) research.onWeb(next)', 'if (next !== null) research.onDeep(next)'), chipChecks],
  ['chip: a click ignores the lock', M(CLEAN, 'if (next !== null) research.onWeb(next)', 'research.onWeb(!research.web)'), chipChecks],
  ['chip: a click also touches deep research', M(CLEAN, 'if (next !== null) research.onWeb(next)', 'if (next !== null) { research.onWeb(next); research.onDeep(next) }'), chipChecks],
  ['hook: research is sent without the flag', M(HOOK, '...(STUDIO_RESEARCH_SWITCH_ENABLED && { research: researchOnWire(webSearch, deepResearch) })', '...({ research: researchOnWire(webSearch, deepResearch) })'), wireChecks],
  ['hook: research disagrees with the booleans (deep only)', M(HOOK, 'research: researchOnWire(webSearch, deepResearch)', 'research: researchOnWire(deepResearch, deepResearch)'), wireChecks],
  ['hook: research is always on', M(HOOK, 'research: researchOnWire(webSearch, deepResearch)', "research: 'on'"), wireChecks],
  ['lib: research "on" only for deep research', M(LIB, '(web || deep ? \'on\' : \'off\')', '(deep ? \'on\' : \'off\')'), libChecks],
  ['page: the handler stops linking the two switches', M(PAGE, '    if (!enabled) setResearchEnabled(false)\n', ''), wireChecks],
]
for (const [label, texts, fn] of MUTANTS) await mutant(label, () => fn(texts))
await mutant('sources: a marked line loses its marker', () => sourceChecks({ ...TEXTS, [CLEAN]: swap(TEXTS[CLEAN], '// RESEARCH-SWITCH (NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH, default off)', '// RESEARCH (NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH, default off)') }))
await mutant('sources: a base line is lost', () => sourceChecks({ ...TEXTS, [CLEAN]: swap(TEXTS[CLEAN], "  const chips = CHAT_CLEAN_CHOICES.research === 'chips'\n", '') }))
await mutant('sources: the env block is edited', () => sourceChecks({ ...TEXTS, '.env.example': swap(TEXTS['.env.example'], 'NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH="false"', 'NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH="true"') }))
await mutant('sources: the registry line is gone', () => registryChecks(swap(TEXTS[REGISTRY], "  (await import('./studio-research-switch-strip.mjs')).stripResearchSwitch, // LATER-CHANGE: FRONTEND-1, M4 the Research on / off switch in the composer (NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH)\n", '')))
await mutant('scope: a stray file', () => scopeCheck(ownCommits(), ['components/builder/message-list.tsx']))
await mutant('commit: no co-author line', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'a body\n'), []))
await mutant('commit: another subject', () => assert.deepEqual(messageProblems('Fix a thing', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))

console.log(`\n${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`FAILED: ${failed.join('; ')}`); if (missed.length) console.error(`MISSED: ${missed.join('; ')}`); process.exit(1) }
process.exit(0)
