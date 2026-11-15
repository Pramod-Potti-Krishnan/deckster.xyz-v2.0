// FRONTEND-1: proof of the thinking-level picker (PK mandate M1 of 15 Nov 2026: "the picker's four positions map to the four levels; Auto lets Deckster choose"). Flags NEXT_PUBLIC_STUDIO_THINKING_LEVELS and NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW,
// each only the exact string "true", default off. The picker acts only with NEXT_PUBLIC_STUDIO_V4_SHELL, NEXT_PUBLIC_AGENT_MODE and NEXT_PUBLIC_STUDIO_CHAT_CLEAN on as well; the direct preview only with the picker on.
//
//   node scripts/test-studio-thinking-levels.mjs        (plain node, offline: the REAL sources transpiled and run in a vm; the page's and the hook's own marked lines are cut out of the real files and RUN with spies, over the REAL Agent-mode libs;
//                                                        react-dom/server for markup; git is read for the strips, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to G), then mutants (H):
//  A. the lib: the flag (each of the four, odd values), the direct preview needs the picker, the map (Auto and Fast are Standard; Balanced, Best and Max are the Agent build), the plan rule for every plan (Free, Starter, Pro, Max = premium, not loaded), the stops (Best and Max only with the
//     preview, each marked coming soon), every pick (plan x level x preview, and junk), what the picker shows, the words (plain; no model, provider, router or price);
//  B. THE WIRE, from the page's real marked lines through #621's real functions to the hook's real lines: for every plan and every position, the build_mode and the thinking_level the message carries. thinking_level is what the person PICKED (pinned with DIRECTOR-2 and KNOWLEDGE-3, 15 Nov),
//     build_mode the route that runs: Auto and Fast send what Standard sent before (explicit "standard" on Pro and Max, which clears Director's sticky Agent opt-in; no key on Free, Starter, an unloaded plan); Balanced, and Best and Max (which run as Balanced for now), send "agent" on Pro and Max only;
//     Balanced then Fast resets; a voice turn never starts Agent (build_mode "standard", thinking_level still what was picked); the level resets to Auto once a run is over and in another session; every flag off: no thinking_level, no change at all;
//  C. the picker: the markup for each plan and flag (names in order, disabled positions, Auto has no thumb, coming-soon marks, the reset icon), the gauge, and its choices (a disabled position and the level already shown call nothing, the others call onChange with the level);
//  D. ONE CONTROL: the composer's send side draws the level picker in the model gauge's place with the flag on and the model picker as before without it; the build-mode chips (#621, their component untouched) are hidden by one rule of the picker's stylesheet while the level picker is in the composer; flag off, the send side's markup is the base's, byte for byte;
//  E. the sources: every marked line, the strip gives each touched file its base back byte for byte (and leaves the research switch's lines alone), the registry, .env.example, the scope (read from the COMMITTED diff only), the commits;
//  F. what Director reads (read-only citations: branch agent1/agent-theme-rules of director-v4.0, 2246b8af): no build_mode key changes nothing (src/utils/agent_mode.py:144 latch_build_mode returns on a message without a string build_mode; the opt-in is sticky), and no message key is validated
//     (the user message is a dict read with .get), so the additive thinking_level is ignored today and read by DIRECTOR-2 tomorrow;
//  G. the lib reads each flag from one literal env name; nothing else reads them.
//  H. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
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
import * as stripModule from './studio-thinking-levels-strip.mjs'
/** The research switch's strip, when that change is in the tree (it is the next commit of the same branch): without it the two changes' lines cannot meet, and this one is read alone. */
const researchStrip = await import('./studio-research-switch-strip.mjs').catch(() => ({ stripResearchSwitch: (_rel, text) => text }))
import * as registry from './studio-later-changes.mjs'

const { BASE_COMMIT, THINKING_LEVELS_SCOPE_FILES: SCOPE, THINKING_LEVELS_NEW_FILES: NEW_FILES, THINKING_LEVELS_FILES: APP_FILES, THINKING_LEVELS_MARKER_RE: MARKER_RE, THINKING_LEVELS_ENV_BLOCK: ENV_BLOCK, THINKING_LEVELS_SUBJECT: SUBJECT, THINKING_LEVELS_EDITS: EDITS, THINKING_LEVELS_FLAGS: FLAGS } = stripModule
const STRIP_FN = stripModule.stripThinkingLevels

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }
/** The sources run in a vm, so their objects and arrays come from another realm: compare them through JSON. */
const deepEqual = (actual, expected, ...message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual ?? null)), JSON.parse(JSON.stringify(expected ?? null)), ...message)

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 700)}`) }
}
let caught = 0
const missed = []
/** A mutant is caught only by a failed ASSERTION of a check. A mutant whose edit did not apply (SwapError) or that crashed some other way proves nothing and is reported as missed. */
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

// ---- the real sources in a vm ---------------------------------------------------------------------------------------------------------------------------------------------
const LIB = 'lib/studio-thinking-levels.ts', AGENT = 'lib/studio-agent-mode.ts', WIRE = 'lib/studio-agent-mode-wire.ts', HOOK = 'hooks/use-deckster-websocket-v2.ts', PAGE = 'app/builder/page.tsx', INPUT = 'components/builder/chat-input.tsx'
const CLEAN = 'components/builder/chat/studio-chat-clean.tsx', CHIPS = 'components/builder/agent-mode/build-mode-picker.tsx', PICKER = 'components/builder/thinking-levels/level-picker.tsx', CSS = 'components/builder/thinking-levels/level-picker.css', REGISTRY = 'scripts/studio-later-changes.mjs', STRIP = 'scripts/studio-thinking-levels-strip.mjs'
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
/** Load one real source in a new context. `texts` replaces the text of any file (a mutant); `react` replaces React; every other import is the REAL source or package, loaded with the same `env`. A .css import is an empty module. */
function load(rel, { env = {}, texts = {}, react = React } = {}) {
  const key = `${rel}\0${JSON.stringify(env)}\0${textsKey(texts)}\0${react === React ? 'react' : react.__id || 'stub'}`
  if (modules.has(key)) return modules.get(key)
  const module = { exports: {} }
  modules.set(key, module.exports)
  const req = spec => {
    if (spec === 'react') return react
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    const local = localFile(spec, rel)
    return local ? load(local, { env, texts, react }) : nodeRequire(spec)
  }
  vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), { module, exports: module.exports, require: req, process: { env: { ...env } }, setTimeout, clearTimeout, AbortController, matchMedia: undefined, fetch: () => assert.fail(`${rel} fetched`) }, { filename: rel })
  return module.exports
}
const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const BASE_ON = { ...SHELL, NEXT_PUBLIC_AGENT_MODE: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' }
const ENV_ON = { ...BASE_ON, NEXT_PUBLIC_STUDIO_THINKING_LEVELS: 'true' }
const ENV_DIRECT = { ...ENV_ON, NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW: 'true' }
const without = (env, key) => Object.fromEntries(Object.entries(env).filter(([k]) => k !== key))
/** Every way for the picker to be off: each of its four flags missing or odd, and nothing set. The agent flags stay on where they are not the one under test, so the AGENT-MODE-WIRE behaviour is the base's. */
const ENV_OFF = {
  'nothing set': {},
  'levels unset (the rest on)': BASE_ON,
  'levels "false"': { ...BASE_ON, NEXT_PUBLIC_STUDIO_THINKING_LEVELS: 'false' },
  'levels "True"': { ...BASE_ON, NEXT_PUBLIC_STUDIO_THINKING_LEVELS: 'True' },
  'levels "1"': { ...BASE_ON, NEXT_PUBLIC_STUDIO_THINKING_LEVELS: '1' },
  'levels " true"': { ...BASE_ON, NEXT_PUBLIC_STUDIO_THINKING_LEVELS: ' true' },
  'agent mode unset (levels on)': without(ENV_ON, 'NEXT_PUBLIC_AGENT_MODE'),
  'agent mode "false"': { ...ENV_ON, NEXT_PUBLIC_AGENT_MODE: 'false' },
  'shell unset (levels on)': without(ENV_ON, 'NEXT_PUBLIC_STUDIO_V4_SHELL'),
  'shell "TRUE"': { ...ENV_ON, NEXT_PUBLIC_STUDIO_V4_SHELL: 'TRUE' },
  'clean composer unset (levels on)': without(ENV_ON, 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN'),
  'clean composer "yes"': { ...ENV_ON, NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'yes' },
  'direct preview alone': { ...BASE_ON, NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW: 'true' },
}
const stubReact = { ...React, useId: () => 'pid', useState: init => [typeof init === 'function' ? init() : init, () => {}], useEffect: () => {}, useRef: init => ({ current: init }) }
const h = React.createElement
const textOf = markup => markup.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
const walk = (node, visit) => {
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return }
  if (!React.isValidElement(node)) return
  visit(node)
  walk(typeof node.type === 'function' ? node.type(node.props) : node.props?.children, visit)
}
const elements = (root0, pred) => { const out = []; walk(root0, el => { if (pred(el)) out.push(el) }); return out }
/** A marked source's one line holding `needle` (exactly one). */
const lineWith = (text, needle) => { const hits = text.split('\n').filter(line => line.includes(needle)); assert.equal(hits.length, 1, `exactly one line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] }
/** A source fragment (TS, with JSX) as the body of a function whose parameters are `names`: returns that function (its objects are from the vm's realm). */
function runFragment(code, names) {
  const source = `(function (${names.join(', ')}) {\n${code}\n})`
  const js = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } })
  const errors = (js.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `the marked lines parse: ${errors[0] ? ts.flattenDiagnosticMessageText(errors[0].messageText, ' ') : ''}`)
  return vm.runInNewContext(js.outputText, { React, setTimeout: () => assert.fail('a marked line scheduled a timer'), setInterval: () => assert.fail('a marked line scheduled an interval'), queueMicrotask: () => assert.fail('a marked line queued a microtask') })
}

const PLANS = ['free', 'starter', 'pro', 'premium', null]
const ELIGIBLE = plan => plan === 'pro' || plan === 'premium'
const LEVELS = ['auto', 'fast', 'balanced', 'best', 'max']
const LEAK = /sonnet|opus|claude|anthropic|openrouter|openai|gpt|gemini|vertex|router|model|provider|token|dollar|\$|price/i

// ============================================================================================================================================
// A. the lib
// ============================================================================================================================================
function libChecks(texts = {}) {
  const lib = env => load(LIB, { env, texts })
  // -- the flags
  for (const [name, env] of Object.entries(ENV_OFF)) {
    assert.equal(lib(env).STUDIO_THINKING_LEVELS_ENABLED, false, `${name}: the picker is off`)
    assert.equal(lib(env).STUDIO_THINKING_LEVELS_DIRECT_PREVIEW, false, `${name}: the direct preview is off (it counts only with the picker, whatever its own flag says)`)
  }
  assert.equal(lib(ENV_ON).STUDIO_THINKING_LEVELS_ENABLED, true, 'all four on: the picker is on')
  assert.equal(lib(ENV_ON).STUDIO_THINKING_LEVELS_DIRECT_PREVIEW, false, 'the picker alone: the direct preview is off by default')
  assert.equal(lib(ENV_DIRECT).STUDIO_THINKING_LEVELS_DIRECT_PREVIEW, true, 'the picker and the preview flag: on')
  for (const odd of ['false', 'True', '1', ' true', '', 'yes']) assert.equal(lib({ ...ENV_ON, NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW: odd }).STUDIO_THINKING_LEVELS_DIRECT_PREVIEW, false, `preview ${JSON.stringify(odd)} is off`)
  const L = lib(ENV_DIRECT)
  assert.deepEqual([L.studioThinkingLevelsOn('true', 'true', 'true', 'true'), L.studioThinkingLevelsOn('true', 'true', 'true', undefined), L.studioThinkingLevelsOn(undefined, 'true', 'true', 'true'), L.studioThinkingLevelsOn('true', undefined, 'true', 'true'), L.studioThinkingLevelsOn('true', 'true', undefined, 'true')], [true, false, false, false, false], 'the four-flag rule')
  assert.deepEqual([L.studioThinkingDirectPreviewOn('true', true), L.studioThinkingDirectPreviewOn('true', false), L.studioThinkingDirectPreviewOn('false', true)], [true, false, false], 'the preview rule')
  // -- the map
  deepEqual(L.THINKING_LEVELS, LEVELS, 'the five levels, in order'); deepEqual(L.THINKING_STOPS, ['fast', 'balanced', 'best', 'max'], 'the scale'); deepEqual(L.THINKING_DIRECT_STOPS, ['best', 'max'], 'the direct levels')
  deepEqual(Object.fromEntries(LEVELS.map(level => [level, L.levelBuildMode(level)])), { auto: 'standard', fast: 'standard', balanced: 'agent', best: 'agent', max: 'agent' }, 'Auto and Fast are Standard; Balanced, Best and Max are the Agent build')
  assert.deepEqual(LEVELS.map(L.levelNeedsAgent), [false, false, true, true, true])
  // -- the plan rule (the Agent shell's own words), every plan
  const SHELL_WORDS = load(AGENT, { env: ENV_DIRECT, texts }).AGENT_COPY
  for (const plan of PLANS) for (const level of LEVELS) {
    const expected = level === 'auto' || level === 'fast' || ELIGIBLE(plan) ? null : plan ? SHELL_WORDS.reasonPlan : SHELL_WORDS.reasonUnknownPlan
    assert.equal(L.levelRefusal(level, plan), expected, `refusal of ${level} on ${plan}`)
  }
  assert.equal(L.levelRefusal('balanced', undefined), SHELL_WORDS.reasonUnknownPlan, 'a plan not loaded (undefined) is not eligible')
  // -- the stops
  for (const plan of PLANS) {
    deepEqual(L.thinkingStops(plan, { levels: true, direct: false }).map(s => s.id), ['fast', 'balanced'], `${plan}: without the preview the scale is Fast and Balanced`)
    const withDirect = L.thinkingStops(plan, { levels: true, direct: true })
    deepEqual(withDirect.map(s => s.id), ['fast', 'balanced', 'best', 'max'], `${plan}: with the preview Best and Max are on the scale`)
    deepEqual(withDirect.map(s => s.disabled), [false, !ELIGIBLE(plan), !ELIGIBLE(plan), !ELIGIBLE(plan)], `${plan}: a position the plan cannot use is disabled (Fast never)`)
    deepEqual(withDirect.map(s => s.comingSoon), [false, false, true, true], `${plan}: Best and Max are coming soon`)
    deepEqual(withDirect.map(s => s.label), ['Fast', 'Balanced', 'Best', 'Max'], 'the names')
  }
  // -- every pick
  for (const direct of [false, true]) for (const plan of PLANS) for (const level of [...LEVELS, 'turbo', '', null, undefined, 7, 'Fast', 'BALANCED']) {
    const expected = !LEVELS.includes(level) ? null
      : level === 'auto' ? { level: 'auto', mode: 'standard' }
      : level === 'fast' ? { level: 'fast', mode: 'standard' }
      : level === 'balanced' ? (ELIGIBLE(plan) ? { level, mode: 'agent' } : null)
      : direct && ELIGIBLE(plan) ? { level, mode: 'agent' } : null
    deepEqual(L.levelPick(level, plan, { levels: true, direct }), expected, `pick ${JSON.stringify(level)} on ${plan}, preview ${direct}`)
    assert.equal(L.levelPick(level, plan, { levels: false, direct }), null, `the flag off: nothing is picked (${JSON.stringify(level)}, ${plan})`)
  }
  deepEqual(lib(ENV_ON).levelPick('balanced', 'pro'), { level: 'balanced', mode: 'agent' }, 'with the build-time flags on a Pro plan picks Balanced')
  assert.equal(lib({}).levelPick('fast', 'pro'), null, 'with the build-time flags off nothing is picked')
  // -- what the page keeps and the picker shows
  for (const [level, mode, expected] of [['balanced', 'agent', 'balanced'], ['balanced', 'standard', 'auto'], ['fast', 'standard', 'fast'], ['fast', 'agent', 'auto'], ['auto', 'standard', 'auto'], ['auto', 'agent', 'auto'], ['best', 'agent', 'best'], ['max', 'agent', 'max'], ['max', 'standard', 'auto'], ['best', 'author', 'auto']]) assert.equal(L.effectiveLevel(level, mode), expected, `effective(${level}, ${mode})`)
  const auto = L.thinkingView('auto', 'pro', { levels: true, direct: true })
  assert.deepEqual([auto.index, auto.thumb, auto.title, auto.line, auto.resetEnabled], [-1, 'none', 'Auto', 'Deckster picks how to build this deck.', false], 'Auto: no thumb, nothing to reset')
  for (const level of ['fast', 'balanced', 'best', 'max']) {
    const view = L.thinkingView(level, 'pro', { levels: true, direct: true })
    assert.deepEqual([view.index, view.thumb, view.title, view.resetEnabled], [['fast', 'balanced', 'best', 'max'].indexOf(level), 'selected', level[0].toUpperCase() + level.slice(1), true], `${level}: the thumb is on it`)
    assert.match(view.valueText, new RegExp(`^${view.title}\\. `), `${level}: the screen reader says the name and the line`)
  }
  assert.equal(L.thinkingView('best', 'pro', { levels: true, direct: false }).title, 'Auto', 'a level that is not on the scale reads as Auto')
  assert.equal(L.stopLine('balanced', 'free'), SHELL_WORDS.reasonPlan, 'a position the plan cannot use says why'); assert.equal(L.stopLine('balanced', null), SHELL_WORDS.reasonUnknownPlan)
  assert.equal(L.stopLine('best', 'pro'), 'Coming soon: runs as Balanced for now.'); assert.equal(L.stopLine('max', 'premium'), 'Coming soon: runs as Balanced for now.')
  assert.equal(L.stopLine('balanced', 'pro'), 'The agent build. Pro and Max plans.'); assert.equal(L.stopLine('fast', 'free'), 'The quickest build, step by step.')
  // -- the words
  const words = []; (function collect(value) { if (typeof value === 'string') words.push(value); else if (value && typeof value === 'object') Object.values(value).forEach(collect) })(L.LEVEL_COPY)
  assert.ok(words.length >= 10, 'the words are there')
  for (const word of words) { assert.doesNotMatch(word, LEAK, `plain words, no model, provider, router, token or price: ${word}`); assert.ok(word.length <= 60, `short: ${word}`) }
}

// ============================================================================================================================================
// B. the wire: the page's real lines, #621's real functions, the hook's real lines
// ============================================================================================================================================
const pageLines = text => ({
  pick: lineWith(text, 'const pickThinkingLevel = (level: ThinkingLevel) =>'),
  shown: lineWith(text, 'const shownThinkingLevel = effectiveLevel(thinkingLevel, buildMode)'),
  ref: lineWith(text, 'thinkingLevelRef.current = STUDIO_THINKING_LEVELS_ENABLED ?'),
  session: lineWith(text, "if (STUDIO_THINKING_LEVELS_ENABLED && agentSessionChanged(agentSessionRef.current, currentSessionId)) setThinkingLevel('auto')"),
  send: lineWith(text, '...(thinkingLevelRef.current ? { thinkingLevel: thinkingLevelRef.current } : {}), // THINKING-LEVELS: a typed message'),
  prop: lineWith(text, '{...(STUDIO_THINKING_LEVELS_ENABLED ? { studioThinkingLevels:'),
  wire: lineWith(text, 'const buildModeWire = STUDIO_AGENT_MODE_ENABLED ?'),
  typed: lineWith(text, 'agentBuildModeRef.current = STUDIO_AGENT_MODE_ENABLED ?'),
  voice: lineWith(text, 'agentVoiceModeRef.current = STUDIO_AGENT_MODE_ENABLED ?'),
})
const hookLines = text => ({
  spread: lineWith(text, '...(STUDIO_THINKING_LEVELS_ENABLED && options?.thinkingLevel'),
  voiceRule: lineWith(text, "(message.data as unknown as Record<string, unknown>).mode === 'voice' && message.data.build_mode === 'agent'"),
  agentKey: lineWith(text, '...(options?.buildMode && { build_mode: options.buildMode }), // AGENT-MODE-WIRE'),
})
/** One person's session on the page: picks, then a send. Returns what the message carries (build_mode and thinking_level, each or absent) and what the picker shows. `voice`: the send came from the voice call. */
function session({ env = ENV_ON, plan = 'pro', picks = [], voice = false, texts = {} } = {}) {
  const page = texts[PAGE] ?? read(PAGE), hook = texts[HOOK] ?? read(HOOK)
  const lib = load(LIB, { env, texts }), agent = load(AGENT, { env, texts }), wire = load(WIRE, { env, texts })
  const L = pageLines(page), K = hookLines(hook)
  const state = { buildMode: 'standard', buildModeFrom: undefined, thinkingLevel: 'auto' }
  const setters = { setBuildMode: v => { state.buildMode = v }, setBuildModeFrom: v => { state.buildModeFrom = v }, setThinkingLevel: v => { state.thinkingLevel = v } }
  const pick = runFragment(`${L.pick}\nreturn pickThinkingLevel`, ['levelPick', 'agentPlan', 'setBuildModeFrom', 'setBuildMode', 'setThinkingLevel'])(lib.levelPick, plan, setters.setBuildModeFrom, setters.setBuildMode, setters.setThinkingLevel)
  for (const level of picks) pick(level)
  const refs = { agentBuildModeRef: { current: undefined }, agentVoiceModeRef: { current: undefined }, thinkingLevelRef: { current: undefined } }
  const render = runFragment(`${L.wire}\n${L.typed}\n${L.voice}\n${L.shown}\n${L.ref}\nreturn { buildModeWire, shownThinkingLevel }`,
    ['STUDIO_AGENT_MODE_ENABLED', 'buildModeOnWire', 'typedBuildMode', 'voiceBuildMode', 'buildMode', 'buildModeFrom', 'agentPlan', 'agentBuildModeRef', 'agentVoiceModeRef', 'effectiveLevel', 'thinkingLevel', 'thinkingLevelRef', 'STUDIO_THINKING_LEVELS_ENABLED'])
  const rendered = render(agent.STUDIO_AGENT_MODE_ENABLED, agent.buildModeOnWire, wire.typedBuildMode, wire.voiceBuildMode, state.buildMode, state.buildModeFrom, plan, refs.agentBuildModeRef, refs.agentVoiceModeRef, lib.effectiveLevel, state.thinkingLevel, refs.thinkingLevelRef, lib.STUDIO_THINKING_LEVELS_ENABLED)
  // a send site: the options the page builds (build mode as #621 reads its ref, the level as this change reads its own), then the hook's own lines on the message
  const modeRef = voice ? refs.agentVoiceModeRef : refs.agentBuildModeRef
  const options = runFragment(`return ({ ...(agentModeRef.current ? { buildMode: agentModeRef.current } : {}),\n${L.send}\n})`, ['agentModeRef', 'thinkingLevelRef'])(modeRef, refs.thinkingLevelRef)
  const data = runFragment(`const data: Record<string, any> = { text: 'hello', ${K.agentKey}\n${K.spread}\n${voice ? "mode: 'voice'," : ''} }\nconst message = { data }\n${K.voiceRule}\nreturn message.data`,
    ['options', 'STUDIO_AGENT_MODE_ENABLED', 'STUDIO_THINKING_LEVELS_ENABLED'])(options, agent.STUDIO_AGENT_MODE_ENABLED, lib.STUDIO_THINKING_LEVELS_ENABLED)
  return { build_mode: data.build_mode, thinking_level: data.thinking_level, keys: Object.keys(data), shown: rendered.shownThinkingLevel, state: JSON.parse(JSON.stringify(state)), options: JSON.parse(JSON.stringify(options)) }
}
function wireChecks(texts = {}) {
  const S = args => session({ ...args, texts })
  // -- every plan, every position, the preview on (so Best and Max are reachable), a typed send
  for (const plan of PLANS) {
    const eligible = ELIGIBLE(plan)
    const standardKey = eligible ? 'standard' : undefined // #621: on a plan that can hold an Agent opt-in Standard is said out loud (Director's opt-in is sticky); no key for Free, Starter, not loaded
    deepEqual(S({ env: ENV_DIRECT, plan, picks: [] }), { build_mode: standardKey, thinking_level: 'auto', keys: ['text', ...(eligible ? ['build_mode'] : []), 'thinking_level'], shown: 'auto', state: { buildMode: 'standard', thinkingLevel: 'auto' }, options: { ...(eligible ? { buildMode: 'standard' } : {}), thinkingLevel: 'auto' } }, `${plan}: nothing picked is Auto: the build mode Standard sent, thinking_level "auto"`)
    deepEqual(S({ env: ENV_DIRECT, plan, picks: ['auto'] }).thinking_level, 'auto')
    const fast = S({ env: ENV_DIRECT, plan, picks: ['fast'] })
    assert.deepEqual([fast.build_mode, fast.thinking_level, fast.shown], [standardKey, 'fast', 'fast'], `${plan}: Fast is the linear build`)
    for (const level of ['balanced', 'best', 'max']) {
      const r = S({ env: ENV_DIRECT, plan, picks: [level] })
      if (eligible) assert.deepEqual([r.build_mode, r.thinking_level, r.shown], ['agent', level, level], `${plan}: ${level} is the Agent build and says so`)
      else assert.deepEqual([r.build_mode, r.thinking_level, r.shown, r.state.thinkingLevel], [standardKey, 'auto', 'auto', 'auto'], `${plan}: ${level} is refused, the picker stays where it was (Auto) and the send is as Auto's`)
    }
  }
  // -- without the direct preview Best and Max cannot be picked at all
  for (const level of ['best', 'max']) { const r = S({ env: ENV_ON, plan: 'premium', picks: [level] }); assert.deepEqual([r.build_mode, r.thinking_level], ['standard', 'auto'], `no preview: ${level} is not on the scale, so nothing happens`) }
  // -- the order of picks: Balanced then Fast resets the Agent opt-in explicitly; Balanced then Auto too; the last pick wins; a refused pick changes nothing
  for (const back of ['fast', 'auto']) { const r = S({ env: ENV_ON, plan: 'pro', picks: ['balanced', back] }); assert.deepEqual([r.build_mode, r.thinking_level], ['standard', back], `Balanced then ${back}: Standard, said out loud`) }
  assert.deepEqual(['build_mode', 'thinking_level'].map(k => S({ env: ENV_DIRECT, plan: 'pro', picks: ['balanced', 'max'] })[k]), ['agent', 'max'], 'Balanced then Max: the Agent build, now as Max')
  assert.deepEqual(['build_mode', 'thinking_level'].map(k => S({ env: ENV_ON, plan: 'free', picks: ['fast', 'balanced'] })[k]), [undefined, 'fast'], 'Fast, then a Balanced the plan cannot use: still Fast')
  // -- a voice turn never starts the Agent build: build_mode "standard" (Pro and Max; no key otherwise) says the route that runs; thinking_level still says what the person picked (the pinned meaning)
  for (const plan of PLANS) for (const level of ['balanced', 'best', 'max']) {
    const r = S({ env: ENV_DIRECT, plan, picks: [level], voice: true })
    if (!ELIGIBLE(plan)) { assert.deepEqual([r.build_mode, r.thinking_level], [undefined, 'auto'], `${plan}: ${level} was refused; a voice turn is Auto's`); continue }
    assert.deepEqual([r.build_mode, r.thinking_level, r.shown], ['standard', level, level], `${plan}: a voice turn at ${level} runs as the linear build (build_mode "standard"), thinking_level still says ${level}, and the picker still shows ${level}`)
  }
  assert.deepEqual(['build_mode', 'thinking_level'].map(k => S({ env: ENV_ON, plan: 'pro', picks: ['fast'], voice: true })[k]), ['standard', 'fast'], 'a voice turn at Fast')
  assert.deepEqual(['build_mode', 'thinking_level'].map(k => S({ env: ENV_ON, plan: 'pro', picks: [], voice: true })[k]), ['standard', 'auto'], 'a voice turn at Auto')
  // -- every flag off: no thinking_level anywhere, and the message is the Agent mode's own (the base's)
  for (const [name, env] of Object.entries(ENV_OFF)) for (const plan of PLANS) {
    const r = S({ env, plan, picks: ['balanced', 'fast', 'max', 'auto'] })
    assert.equal('thinking_level' in r.options, false, `${name}, ${plan}: the page does not pass a level`); assert.equal(r.keys.includes('thinking_level'), false, `${name}, ${plan}: the message carries none`)
    assert.equal(r.shown === 'auto' || r.state.thinkingLevel === 'auto', true, `${name}, ${plan}: no pick is taken`)
    const agentOn = env.NEXT_PUBLIC_AGENT_MODE === 'true' && env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
    assert.equal(r.build_mode, agentOn && ELIGIBLE(plan) ? 'standard' : undefined, `${name}, ${plan}: the build mode is #621's (Standard said out loud on Pro and Max with the Agent flags on, no key otherwise)`)
  }
  // -- the hook's spread, alone: a level the page passes goes out as it is (what was picked), only with the flag; none passed, none sent
  const hook = texts[HOOK] ?? read(HOOK), K = hookLines(hook), lib = load(LIB, { env: ENV_ON, texts }), off = load(LIB, { env: BASE_ON, texts })
  const finish = (mod, options, build) => runFragment(`const data: Record<string, any> = { text: 'x', ${build ? `build_mode: '${build}',` : ''} ${K.spread}\n}\nreturn data`, ['options', 'STUDIO_THINKING_LEVELS_ENABLED'])(options, mod.STUDIO_THINKING_LEVELS_ENABLED)
  deepEqual(finish(lib, { thinkingLevel: 'balanced' }, 'standard'), { text: 'x', build_mode: 'standard', thinking_level: 'balanced' }, 'the level is what was picked, whatever route runs')
  deepEqual(finish(lib, { thinkingLevel: 'max' }, 'agent'), { text: 'x', build_mode: 'agent', thinking_level: 'max' }, 'Max with the Agent build says "max"')
  deepEqual(finish(lib, {}, 'agent'), { text: 'x', build_mode: 'agent' }, 'no level asked, none sent')
  deepEqual(finish(off, { thinkingLevel: 'balanced' }, 'agent'), { text: 'x', build_mode: 'agent' }, 'flag off: a level passed anyway is not sent')
  // -- the page: the four sends, the mount, the pass-through, the session
  const page = texts[PAGE] ?? read(PAGE), lines = page.split('\n')
  const modeSpreads = lines.map((l, i) => [l, i]).filter(([l]) => l.trim() === '...(agentModeRef.current ? { buildMode: agentModeRef.current } : {}), // AGENT-MODE-WIRE')
  assert.equal(modeSpreads.length, 4, 'four build sends carry the build mode')
  for (const [l, i] of modeSpreads) {
    const indent = l.slice(0, l.length - l.trimStart().length)
    assert.match(lines[i + 1], /^\s+\.\.\.\(thinkingLevelRef\.current \? \{ thinkingLevel: thinkingLevelRef\.current \} : \{\}\), \/\/ THINKING-LEVELS: [a-z' ()]+$/, `line ${i + 1}: the level rides next to the build mode`); assert.equal(lines[i + 1].slice(0, indent.length), indent, `line ${i + 1}: as deep as the build mode's line`)
  }
  assert.equal(lines.filter(l => l.includes('thinkingLevel: thinkingLevelRef.current')).length, 4, 'and nowhere else'); assert.equal(new Set(lines.filter(l => l.includes('thinkingLevel: thinkingLevelRef.current')).map(l => l.trim())).size, 4, 'each of the four lines is its own text (so a registry strip can take one line alone)')
  for (const levels of [true, false]) for (const [busy, plan] of [[true, 'pro'], [false, 'free'], [false, null]]) {
    const out = runFragment(`return ({ ${pageLines(page).prop.trim().replace(/^\{/, '').replace(/\}$/, '').replace(/\/\*.*\*\//, '')}\n})`, ['STUDIO_THINKING_LEVELS_ENABLED', 'shownThinkingLevel', 'agentPlan', 'agentRunBusy', 'agentRun', 'pickThinkingLevel'])(levels, 'fast', plan, () => busy, {}, () => {})
    if (!levels) deepEqual(out, {}, 'off: the composer gets no level props')
    else { assert.deepEqual(Object.keys(out), ['studioThinkingLevels']); assert.deepEqual([out.studioThinkingLevels.value, out.studioThinkingLevels.plan, out.studioThinkingLevels.disabled, typeof out.studioThinkingLevels.onChange], ['fast', plan, busy, 'function'], 'on: the value, the plan, busy while a run is in progress, the handler') }
  }
  const wireLib = load(WIRE, { env: ENV_ON, texts })
  const resetCalls = (env, prev, next) => { const calls = [], ref = { current: prev }; runFragment(`${pageLines(page).session}`, ['STUDIO_THINKING_LEVELS_ENABLED', 'agentSessionChanged', 'agentSessionRef', 'currentSessionId', 'setThinkingLevel'])(env, wireLib.agentSessionChanged, ref, next, v => calls.push(v)); return calls }
  assert.deepEqual(resetCalls(true, 'A', 'B'), ['auto'], 'another session: Auto'); assert.deepEqual(resetCalls(true, null, 'B'), [], 'the first save of a new chat is not a move'); assert.deepEqual(resetCalls(true, 'A', 'A'), [], 'the same session: nothing'); assert.deepEqual(resetCalls(false, 'A', 'B'), [], 'off: nothing')
  // -- an Agent run that finishes: #621 puts the build mode back to Standard, and the level the picker shows follows (Auto) without a line of its own
  const lib2 = load(LIB, { env: ENV_ON, texts }), agent = load(AGENT, { env: ENV_ON, texts }), wire = load(WIRE, { env: ENV_ON, texts })
  const done = wire.agentWireReducer(wire.agentWireReducer(agent.initialAgentRunState(), { type: 'agent_estimate', payload: { run_id: 'r1', est_credits: 5, cap_credits: 10 } }), { type: 'agent_done', payload: { run_id: 'r1', slides: 5, charged_credits: 4 } })
  const after = wire.agentPickerAfterRun(null, done, 'agent')
  assert.equal(after, 'standard', 'a finished Agent run puts the build mode back to Standard (#621)')
  assert.equal(lib2.effectiveLevel('balanced', after), 'auto', 'and the picker then shows Auto')
  assert.equal(lib2.effectiveLevel('fast', wire.agentPickerAfterRun(null, done, 'standard')), 'fast', 'Fast stays Fast after a run')
  assert.equal(wire.agentRunBusy(wire.agentWireReducer(agent.initialAgentRunState(), { type: 'agent_estimate', payload: { run_id: 'r2', est_credits: 5, cap_credits: 10 } })), true, 'while a run is in progress the picker is disabled (the page passes agentRunBusy)')
}

// ============================================================================================================================================
// C. the picker
// ============================================================================================================================================
async function pickerChecks(texts = {}) {
  const P = load(PICKER, { env: ENV_DIRECT, texts }), lib = load(LIB, { env: ENV_DIRECT, texts })
  const attr = (markup, name) => [...markup.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map(m => m[1])
  const panel = (level, plan, direct, over = {}) => renderToStaticMarkup(h(P.LevelPanel, { Title: 'h2', view: lib.thinkingView(level, plan, { levels: true, direct }), blocked: false, onDraft() {}, onCommit() {}, onReset() {}, ...over }))
  for (const plan of PLANS) for (const direct of [false, true]) {
    const m = panel('auto', plan, direct), names = [...m.matchAll(/mpick-stop-name">([^<]*)</g)].map(x => x[1])
    deepEqual(names, direct ? ['Fast', 'Balanced', 'Best', 'Max'] : ['Fast', 'Balanced'], `${plan}/${direct}: the names under the slider, in order`)
    deepEqual(attr(m, 'data-level-disabled'), direct ? ['false', ...Array(3).fill(String(!ELIGIBLE(plan)))] : ['false', String(!ELIGIBLE(plan))], `${plan}/${direct}: a position the plan cannot use is marked disabled`)
    deepEqual(attr(m, 'data-level-soon'), direct ? ['false', 'false', 'true', 'true'] : ['false', 'false'], `${plan}/${direct}: Best and Max are marked coming soon`)
    assert.ok(attr(m, 'data-active').every(v => v === 'false') && attr(m, 'data-current').every(v => v === 'false'), 'Auto: no stop is marked active or current'); assert.ok(m.includes('data-thumb="none"'), 'Auto: no thumb'); assert.ok(/<h2[^>]*>Auto</.test(m), 'the title is the level'); assert.ok(m.includes('Deckster picks how to build this deck.'), 'Auto says what it is')
    assert.ok(/data-mpick="reset"[^>]*disabled/.test(m) || /disabled=""[^>]*data-mpick="reset"/.test(m), 'Auto: the reset icon has nothing to reset')
    assert.ok(m.includes(`--mpick-stops:${direct ? 4 : 2}`), 'the slider is as long as the scale')
  }
  const fast = panel('fast', 'pro', true); deepEqual(attr(fast, 'data-active'), ['true', 'false', 'false', 'false'], 'Fast: its name is the active one'); assert.ok(fast.includes('data-thumb="selected"') && /<h2[^>]*>Fast</.test(fast) && fast.includes('The quickest build, step by step.'), 'Fast: the thumb, the name, the line'); assert.ok(!/data-mpick="reset"[^>]*disabled/.test(fast), 'Fast: the reset icon works')
  const best = panel('best', 'pro', true); assert.ok(/<h2[^>]*>Best</.test(best) && best.includes('Coming soon: runs as Balanced for now.'), 'Best: coming soon, runs as Balanced for now')
  const free = panel('balanced', 'free', true, { view: { ...lib.thinkingView('auto', 'free', { levels: true, direct: true }), title: 'Balanced', line: lib.stopLine('balanced', 'free') } }); assert.ok(free.includes('Agent build is on Pro and Max plans.'), 'a position dragged to on Free says the plan reason')
  assert.ok(panel('auto', 'pro', true, { blocked: true }).includes('disabled'), 'blocked: the slider and the reset are disabled')
  // the gauge
  const view = lib.thinkingView('balanced', 'pro', { levels: true, direct: false })
  const gauge = (over = {}) => renderToStaticMarkup(h(P.LevelPickerView, { view, level: 'balanced', open: false, onOpenChange() {}, onDraft() {}, onCommit() {}, onReset() {}, className: 'studio-chat-clean-model', ...over }))
  const closed = gauge()
  assert.ok(closed.includes('aria-label="Thinking level: Balanced"') && closed.includes('data-level="balanced"') && closed.includes('data-level-picker="gauge"') && /class="mpick-gauge studio-chat-clean-model"/.test(closed), 'the gauge: named for the level, drawn as the model gauge was')
  assert.ok(!/ disabled=""/.test(closed), 'enabled by default'); const busy = gauge({ disabled: true }); assert.ok(/ disabled=""/.test(busy) && busy.includes('The level cannot change while the agent build is running.'), 'a run in progress disables it and says why')
  // its choices: the picker's own function, run with a stubbed React so the closures can be called
  const S = load(PICKER, { env: ENV_DIRECT, texts, react: stubReact })
  const calls = []
  const run = (value, plan, args = {}) => { calls.length = 0; const el = S.LevelPicker({ value, plan, onChange: l => calls.push(l), ...args }); return el.props }
  const free2 = run('auto', 'free'); free2.onCommit(1); free2.onCommit(0); assert.deepEqual(calls, ['fast'], 'Free: Fast can be chosen, Balanced (the Agent build) cannot: choosing it calls nothing')
  const pro = run('auto', 'pro'); pro.onCommit(1); pro.onCommit(2); pro.onCommit(3); assert.deepEqual(calls, ['balanced', 'best', 'max'], 'Pro: every position can be chosen')
  const fastShown = run('fast', 'pro'); fastShown.onCommit(0); assert.deepEqual(calls, [], 'the level already shown is not chosen again'); fastShown.onReset(); assert.deepEqual(calls, ['auto'], 'the reset icon chooses Auto')
  const auto = run('auto', 'pro'); auto.onReset(); assert.deepEqual(calls, [], 'Auto is already Auto')
  const none = run('auto', null); none.onCommit(1); assert.deepEqual(calls, [], 'a plan that is not loaded cannot choose the Agent build')
  const outOfRange = run('auto', 'pro'); outOfRange.onCommit(9); assert.deepEqual(calls, [], 'a stop that is not there chooses nothing')
  const noPreview = load(PICKER, { env: ENV_ON, texts, react: stubReact }); const o = noPreview.LevelPicker({ value: 'auto', plan: 'premium', onChange: l => calls.push(l) }).props; calls.length = 0; o.onCommit(2); assert.deepEqual(calls, [], 'without the preview there is no third stop')
  assert.equal(run('auto', 'pro').view.stops.length, 4); assert.equal(o.view.stops.length, 2, 'two stops without the preview')
  // a refused position leaves no draft under the thumb: the draft is cleared at once and once more after the slider's own late report (the real page showed the thumb stuck on Balanced on a Free plan)
  const log = [], rec = { ...stubReact, __id: 'recording', useState: init => [typeof init === 'function' ? init() : init, v => log.push(v)] }
  const R = load(PICKER, { env: ENV_DIRECT, texts, react: rec }).LevelPicker({ value: 'fast', plan: 'free', onChange: () => assert.fail('a refused position chose') }).props
  R.onCommit(1); assert.deepEqual(log, [null], 'cleared at once'); await new Promise(resolve => setTimeout(resolve, 30)); assert.deepEqual(log, [null, null], 'and cleared again after the slider\'s late report')
}

/** The Standard / Author / Agent chips (#607 / #621): their component and the page's mount are the base's (nothing of #621 is edited), so they are hidden by one rule of this change's stylesheet: only where a level gauge is in the clean composer, only the chips' own wrapper. */
const CHIPS_RULE = '[data-studio-chat-clean]:has([data-level-picker="gauge"]) div:has(> [data-studio-build-mode-picker]) { display: none; }'
function chipsChecks(texts = {}) {
  const css = texts[CSS] ?? read(CSS)
  assert.equal(css.split('\n').filter(l => l === CHIPS_RULE).length, 1, 'the one rule that hides the chips is in the stylesheet')
  assert.equal(CHIPS_RULE.includes('display: none'), true)
  // what the rule relies on, from the real sources: the chips' root and wrapper, the gauge's own attribute, the chat column's attribute
  const chips = texts[CHIPS] ?? read(CHIPS), page = texts[PAGE] ?? read(PAGE)
  assert.equal(chips, baseText(CHIPS), 'the chips\' component is the base\'s, byte for byte (nothing of #621 is edited)')
  assert.ok(chips.includes('<div data-studio-build-mode-picker role="group"'), 'the chips\' root carries data-studio-build-mode-picker')
  assert.ok(page.includes('<div className="mx-auto w-full max-w-[668px] px-3 pb-1"><BuildModePicker'), 'the page mounts the chips in a plain div wrapper, the picker its only child')
  const P = load(PICKER, { env: ENV_ON, texts }); const closed = renderToStaticMarkup(h(P.LevelPickerView, { view: load(LIB, { env: ENV_ON, texts }).thinkingView('auto', 'pro', { levels: true, direct: false }), level: 'auto', open: false, onOpenChange() {}, onDraft() {}, onCommit() {}, onReset() {} }))
  assert.ok(closed.includes('data-level-picker="gauge"'), 'the level gauge carries the attribute the rule looks for')
  assert.equal(load('lib/studio-chat-clean.ts', { env: {} }).chatCleanRootAttributes()['data-studio-chat-clean'], 'v3', 'the chat column carries data-studio-chat-clean (the rule\'s root)')
  assert.ok(page.includes('{...(chatCleanShell ? chatCleanRootAttributes() : {})'), 'and the page puts it there only with the clean composer')
  assert.ok(page.indexOf('chatCleanRootAttributes() : {})') < page.indexOf('<BuildModePicker value={buildMode}'), 'the column\'s attributes come before the chips (the chips are inside that column)')
  // with the picker off nothing can match: no gauge, no rule match; and the model gauge is not the level gauge
  assert.ok(!sendSide(BASE_ON, {}, texts[CLEAN] ?? read(CLEAN), texts).includes('data-level-picker'), 'no level gauge without the flag, so the rule matches nothing')
}

// ============================================================================================================================================
// D. one control: the send side
// ============================================================================================================================================
const sendSideProps = (over = {}) => ({ composer: { showStop: false, stopEnabled: false }, onStop() {}, research: { deep: false, onDeep() {}, web: false, onWeb() {}, locked: false }, picker: { sessionId: null, disabled: false }, ...over })
/** Radix numbers its ids from one counter per React, so two renders in one process differ in aria-controls only: the ids are normalised. */
const noIds = markup => markup.replace(/radix-_R_[A-Za-z0-9]+_/g, 'radix-ID')
function sendSide(env, props = {}, text = read(CLEAN), texts = {}) { const C = load(CLEAN, { env, texts: { ...texts, [CLEAN]: text } }); return noIds(renderToStaticMarkup(h(C.StudioChatCleanSendSide, sendSideProps(props)))) }
function sendSideChecks(texts = {}) {
  const levels = { value: 'auto', plan: 'pro', disabled: false, onChange() {} }
  const on = sendSide(ENV_ON, { levels }, texts[CLEAN] ?? read(CLEAN), texts)
  assert.ok(on.includes('data-level-picker="gauge"'), 'with the flag on the level picker is in the model gauge\'s place'); assert.ok(!on.includes('data-mpick="chip"'), 'and no model chip')
  assert.equal((on.match(/data-mpick="gauge"/g) || []).length, 1, 'one gauge, not two')
  const modelOn = { ...ENV_ON, NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' }
  const withModel = sendSide(modelOn, { levels }, texts[CLEAN] ?? read(CLEAN), texts)
  assert.equal((withModel.match(/data-mpick="gauge"/g) || []).length, 1, 'even with model choice on there is one gauge: the level picker replaces the model gauge, it does not stand beside it')
  assert.ok(withModel.includes('data-level-picker="gauge"') && !/Model: /.test(withModel), 'and it is the level picker')
  const off = sendSide({ ...modelOn, NEXT_PUBLIC_STUDIO_THINKING_LEVELS: undefined }, {}, texts[CLEAN] ?? read(CLEAN), texts)
  assert.ok(off.includes('data-mpick="gauge"') && !off.includes('data-level-picker'), 'flag off (the page passes no level props): the model picker, as before')
  // flag off: the send side's markup is the base's, byte for byte, for every combination of the composer's props, with and without model choice and the research switch
  for (const env of [{}, BASE_ON, modelOn, { ...modelOn, NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE: 'true' }]) for (const props of [{}, { composer: { showStop: true, stopEnabled: true } }, { research: { deep: true, onDeep() {}, web: true, onWeb() {}, locked: true } }, { picker: { sessionId: 'abc', disabled: true } }]) {
    const base = sendSide(env, props, baseText(CLEAN), { [CLEAN]: baseText(CLEAN) }), now = sendSide(env, props, texts[CLEAN] ?? read(CLEAN), texts)
    assert.equal(now, base, `flag off: the send side is the base's, byte for byte (${JSON.stringify(Object.keys(props))})`)
  }
}

// ============================================================================================================================================
// E. the sources
// ============================================================================================================================================
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/
/** The lines added to and removed from `was` to make `now` (a multiset difference by line). */
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}
const laterStrips = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }
const laterEnv = text => { const blocks = registry.LATER_ENV_BLOCKS, at = blocks.indexOf(ENV_BLOCK); return (at === -1 ? [] : blocks.slice(at + 1)).reduce((out, later) => out.replace(`\n${later}`, ''), text) }
const TEXTS = Object.fromEntries([...APP_FILES, ...NEW_FILES, ...stripModule.THINKING_LEVELS_PIN_FILES, '.env.example', REGISTRY].map(rel => [rel, read(rel)]))

function sourceChecks(texts, mod = stripModule) {
  const strip = mod.stripThinkingLevels, edits = mod.THINKING_LEVELS_EDITS, files = mod.THINKING_LEVELS_FILES, block = mod.THINKING_LEVELS_ENV_BLOCK
  // the strip gives each touched file its base back (past the research switch's lines, which are another change's and stay when only this strip runs), byte for byte, and is idempotent
  for (const rel of files) {
    const now = laterStrips(rel, texts[rel]), out = strip(rel, now), noResearch = researchStrip.stripResearchSwitch(rel, out)
    assert.equal(noResearch, baseText(rel), `${rel}: without this change's edits (and the research switch's) the file is the base's, byte for byte`)
    assert.equal(strip(rel, out), out, `${rel}: stripping twice changes nothing more`)
    assert.notEqual(now, baseText(rel), `${rel}: the change is there to strip`)
  }
  if (researchStrip.RESEARCH_SWITCH_FILES) assert.ok(researchStrip.stripResearchSwitch(CLEAN, texts[CLEAN]).includes('RESEARCH-SWITCH') === false && strip(CLEAN, texts[CLEAN]).includes('RESEARCH-SWITCH'), 'the two strips are independent in the send side: each leaves the other change\'s lines')
  for (const rel of ['components/builder/message-list.tsx', '.env.example', REGISTRY]) assert.equal(strip(rel, 'x\nTHINKING-LEVELS\n'), 'x\nTHINKING-LEVELS\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(strip(files[0], 5), 5, 'a text that is not a string comes back as it is')
  // every line a file gains carries the marker; the only base lines lost are the ones this change rewrites (its pairs' `was` lines), all of them
  for (const rel of files) {
    const mine = researchStrip.stripResearchSwitch(rel, laterStrips(rel, texts[rel])), diff = lineDiff(baseText(rel), mine)
    const allowed = new Set((edits[rel] || []).flatMap(([, was]) => was.split('\n')).filter(line => line !== ''))
    for (const line of diff.added) assert.match(line, MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    for (const line of diff.removed) assert.ok(allowed.has(line), `${rel}: a base line is lost that this change does not rewrite: ${line.trim().slice(0, 100)}`)
    assert.equal(diff.removed.length, allowed.size, `${rel}: the base lines this change rewrites (all of them, no other)`)
  }
  // the older proofs this change teaches: each gains its marked lines (a read hook with its import; the first-parent splice for this change's commit subject) and loses none, and is the base's without them
  const PIN_GAINS = { 'scripts/test-studio-agent-mode-wire.mjs': 2, 'scripts/test-studio-chat-element-edit.mjs': 1, 'scripts/test-studio-deck-sync-truth.mjs': 1 }
  assert.deepEqual([...mod.THINKING_LEVELS_PIN_FILES].sort(), Object.keys(PIN_GAINS).sort(), 'the older proofs this change teaches')
  for (const [rel, gained] of Object.entries(PIN_GAINS)) {
    const now = researchStrip.stripResearchSwitch(rel, laterStrips(rel, texts[rel])), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's lines the proof is the base's, byte for byte`)
    assert.equal(strip(rel, strip(rel, now)), baseText(rel), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, gained], `${rel}: the proof gains ${gained} marked lines and loses none`)
    for (const line of diff.added) assert.ok(line.includes(mod.THINKING_LEVELS_PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
    for (const line of diff.added.filter(added => added.includes('fs.readFileSync = '))) assert.ok(line.includes('stripThinkingLevels(rel, out)') && !line.includes('stripLaterChanges') && !line.includes('registry.'), `${rel}: the read hook uses this change's own strip, never the registry`)
    for (const line of diff.added.filter(added => added.includes('shas.splice'))) assert.ok(line.includes('^Thinking levels:') && !line.includes('Research switch'), `${rel}: the splice names this change's own subject, and only that`)
  }
  // the new libs: one literal env read per flag, and nothing else reads the flags
  for (const [rel, flag] of mod.THINKING_LEVELS_LIB_FLAGS) {
    assert.equal((texts[rel].match(new RegExp(`process\\.env\\.${flag}\\b`, 'g')) || []).length, 1, `${rel} reads the literal env name ${flag} once`)
    for (const other of [...files, ...mod.THINKING_LEVELS_NEW_FILES.filter(f => /^(hooks|components)\//.test(f))]) assert.equal((texts[other] || '').includes(`process.env.${flag}`), false, `${other} does not read ${flag} itself`)
  }
  assert.deepEqual([...texts['lib/studio-thinking-levels.ts'].matchAll(/^import .*$/gm)].map(m => m[0]), ["import { AGENT_COPY, agentEligible, type AgentPlan, type BuildMode } from '@/lib/studio-agent-mode'"], 'the lib imports only the Agent shell\'s words, plan rule and types')
  // .env.example: the base plus the block (after one blank line, past the blocks registered after this one); every flag documented "false", once
  assert.equal(laterEnv(texts['.env.example']), `${baseText('.env.example')}\n${block}`, '.env.example is the base plus the block')
  for (const flag of mod.THINKING_LEVELS_FLAGS) {
    assert.match(block, new RegExp(`^${flag}="false"$`, 'm'), `the block documents ${flag} as "false"`)
    assert.equal((texts['.env.example'].match(new RegExp(`^${flag}=`, 'gm')) || []).length, 1, `.env.example assigns ${flag} once`)
  }
  assert.ok(block.endsWith('\n') && block.split('\n').filter(line => line && !line.startsWith('#')).length === mod.THINKING_LEVELS_FLAGS.length, 'the block is comments and one assignment per flag')
  // secrets, in everything this change adds
  for (const rel of [...files, ...mod.THINKING_LEVELS_NEW_FILES, '.env.example']) assert.doesNotMatch(texts[rel] ?? read(rel), SECRET, `${rel}: no secret`)
  // the css: only classes the level picker draws, nothing global
  const css = texts[CSS] ?? read(CSS)
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(r => r.split('{')[0].trim()).filter(Boolean)) assert.ok(/^\.mpick-simple-pop /.test(rule) || rule === CHIPS_RULE.split(' {')[0], `a rule that only reaches the picker's popover (or the chips' wrapper, only beside the level gauge): ${rule}`)
}
function registryChecks(text, texts = TEXTS) {
  const { THINKING_LEVELS_SCOPE_FILES: scope } = stripModule
  for (const list of ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS']) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n').filter(Boolean)
    const reference = { LATER_CHANGE_FILES: 'studio-sessions-owner-strip.mjs', LATER_ENV_BLOCKS: 'studio-connectors-session-links-strip.mjs', LATER_STRIPS: 'studio-sessions-owner-strip.mjs' }[list]
    const own = rows.findIndex(line => line.includes('studio-thinking-levels-strip.mjs')), before = rows.findIndex(line => line.includes(reference))
    assert.ok(own > before && before > 0, `${list}: this change's line comes after ${reference} (the last one before it)`)
    assert.equal((text.slice(start, end).match(/studio-thinking-levels-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-thinking-levels-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes('// LATER-CHANGE: FRONTEND-1, M1 the thinking-level picker')), 'each carries the registry marker')
  assert.deepEqual(lineDiff(baseText(REGISTRY), text).removed, [], 'and loses none')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the block is registered')
  assert.ok([...scope].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  for (const rel of APP_FILES) assert.equal(registry.stripLaterChanges(rel, texts[rel]), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(FLAGS.some(flag => registry.stripLaterEnvBlocks('.env.example', texts['.env.example']).includes(flag)), false, 'the registry takes the block out of .env.example')
}
const isOwnCommit = subject => subject.startsWith(SUBJECT)
function ownCommits(ref = 'HEAD') { return git('rev-list', '--no-merges', `${BASE_COMMIT}..${ref}`).split('\n').filter(Boolean).filter(commit => isOwnCommit(git('log', '-1', '--format=%s', commit))) }
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body) { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line'); return problems }

// ============================================================================================================================================
// F. what Director reads: nothing in this file can run Director, so the citation is checked for being there and the Studio's side for consistency with it
// ============================================================================================================================================
function directorChecks(texts = {}) {
  assert.match(texts[LIB] ?? read(LIB), /DIRECTOR-2 reads it; today Director ignores it/, 'the lib says who reads thinking_level')
  assert.match(texts[HOOK] ?? read(HOOK), /thinking_level\?: ThinkingLevel; \/\/ THINKING-LEVELS: .*DIRECTOR-2 reads it; today Director ignores it/, 'the hook documents who reads thinking_level')
  assert.match(texts['.env.example'] ?? read('.env.example'), /DIRECTOR-2 reads it; Director ignores it today/, '.env.example says who reads thinking_level')
  // the keys the picker puts on a message, from its marked hook lines: build_mode is Director's (MR-604, #621's line, untouched), thinking_level is additive; no research key (that is the Research switch, its own change)
  const hookKeys = new Set(EDITS[HOOK].flatMap(([has]) => [...has.matchAll(/\b(thinking_level|build_mode|web_search|deep_research|research)\b/g)].map(m => m[1])))
  assert.deepEqual([...hookKeys].sort(), ['build_mode', 'thinking_level'], 'the marked hook lines name thinking_level (and read build_mode); no research key')
  assert.equal(Object.values(EDITS).flat().some(([has]) => /\b(web_search|deep_research)\b/.test(has)), false, 'no marked line of the picker touches a research key')
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
await check('A. the lib: the flags, the map, the plan rule, the stops, every pick, the views, the words', () => libChecks())
await check('B. the wire: every plan x every position through the page\'s real lines, #621\'s real functions and the hook\'s real lines', () => wireChecks())
await check('C. the picker: the markup for each plan and flag, the gauge, its choices', () => pickerChecks())
await check('D0. the build-mode chips (their component untouched) are hidden by one rule beside the level gauge only', () => chipsChecks())
await check('D. one control: the send side draws the level picker in the gauge\'s place; flag off it is the base\'s, byte for byte', () => sendSideChecks())
await check('E1. the sources: markers, the strip, the lib, .env.example, secrets, the css', () => sourceChecks(TEXTS))
await check('E2. the registry (three lines, after the last one, at the true ends)', () => registryChecks(TEXTS[REGISTRY]))
await check('E3. scope, from the COMMITTED diff only; the commits', () => {
  const commits = ownCommits(); assert.ok(commits.length >= 1, 'this change has commits of its own')
  scopeCheck(commits)
  for (const commit of commits) assert.deepEqual(messageProblems(git('log', '-1', '--format=%s', commit), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
})
await check('F. what Director reads, and the keys the picker adds', () => directorChecks(TEXTS))
await check('G. each flag is read from one literal env name', () => {
  for (const flag of FLAGS) {
    const holders = [...TEXTS['lib/studio-thinking-levels.ts'].matchAll(new RegExp(`process\\.env\\.${flag}\\b`, 'g'))]
    assert.equal(holders.length, 1, `${flag} is read once`)
  }
})

// ---- H. mutants: one edit of the real sources each, fed to the same checks ------------------------------------------------------------------------------------------------------------
const TEXT = { [LIB]: read(LIB), [HOOK]: read(HOOK), [PAGE]: read(PAGE), [PICKER]: read(PICKER), [CLEAN]: read(CLEAN), [CHIPS]: read(CHIPS), [CSS]: read(CSS) }
const M = (rel, from, to) => ({ ...{}, [rel]: swap(TEXT[rel], from, to) })
const MUTANTS = [
  ['lib: Balanced is Standard', M(LIB, "(level === 'balanced' || level === 'best' || level === 'max' ? 'agent' : 'standard')", "(level === 'best' || level === 'max' ? 'agent' : 'standard')"), libChecks],
  ['lib: Fast is the Agent build', M(LIB, "(level === 'balanced' || level === 'best' || level === 'max' ? 'agent' : 'standard')", "(level !== 'auto' ? 'agent' : 'standard')"), libChecks],
  ['lib: the plan rule is dropped', M(LIB, 'if (!levelNeedsAgent(level) || agentEligible(plan)) return null', 'return null'), libChecks],
  ['lib: Best and Max are always on the scale', M(LIB, 'filter(stop => flags.direct || !THINKING_DIRECT_STOPS.includes(stop))', 'filter(() => true)'), libChecks],
  ['lib: a pick ignores the flag', M(LIB, 'if (!flags.levels || !isLevel(level)) return null', 'if (!isLevel(level)) return null'), libChecks],
  ['lib: a level off the scale is accepted', M(LIB, "if (level !== 'auto' && !thinkingStops(plan, flags).some(stop => stop.id === level)) return null\n", ''), libChecks],
  ['lib: a stale level still shows', M(LIB, "(levelBuildMode(level) === mode ? level : 'auto')", 'level'), libChecks],
  ['lib: the flag does not need the Agent shell', M(LIB, "levels === 'true' && agent === 'true' && shell === 'true' && chatClean === 'true'", "levels === 'true' && shell === 'true' && chatClean === 'true'"), libChecks],
  ['lib: the flag does not need the clean composer', M(LIB, "&& shell === 'true' && chatClean === 'true'", "&& shell === 'true'"), libChecks],
  ['lib: the flag accepts "True"', M(LIB, "levels === 'true' &&", "levels?.toLowerCase() === 'true' &&"), libChecks],
  ['lib: the preview counts without the picker', M(LIB, 'levelsOn && preview === \'true\'', "preview === 'true'"), libChecks],
  ['lib: Auto says a model', M(LIB, "auto: 'Deckster picks how to build this deck.'", "auto: 'Deckster picks the best model for this deck.'"), libChecks],
  ['hook: thinking_level goes out without the flag', M(HOOK, '...(STUDIO_THINKING_LEVELS_ENABLED && options?.thinkingLevel &&', '...(options?.thinkingLevel &&'), wireChecks],
  ['hook: thinking_level is lost (the spread is gone)', M(HOOK, '...(STUDIO_THINKING_LEVELS_ENABLED && options?.thinkingLevel && { thinking_level: options.thinkingLevel }),', ''), wireChecks],
  ['chips: the hiding rule is gone', M(CSS, CHIPS_RULE + '\n', ''), chipsChecks],
  ['chips: hidden even without the level gauge', M(CSS, '[data-studio-chat-clean]:has([data-level-picker="gauge"]) div:has(', '[data-studio-chat-clean] div:has('), chipsChecks],
  ['chips: the component is edited', M(CHIPS, '  const noteId = React.useId()', '  const noteId = React.useId() // edited'), chipsChecks],
  ['page: a pick does not drive the build mode', M(PAGE, 'setBuildMode(pick.mode); setThinkingLevel(pick.level) }', 'setThinkingLevel(pick.level) }'), wireChecks],
  ['page: a pick skips the plan rule', M(PAGE, 'const pick = levelPick(level, agentPlan); if (!pick) return;', "const pick = { level, mode: level === 'fast' || level === 'auto' ? 'standard' : 'agent' };"), wireChecks],
  ['page: the level is always sent, flag or not', M(PAGE, 'thinkingLevelRef.current = STUDIO_THINKING_LEVELS_ENABLED ? shownThinkingLevel : undefined', 'thinkingLevelRef.current = shownThinkingLevel'), wireChecks],
  ['page: the session reset is gone', M(PAGE, "setThinkingLevel('auto') // THINKING-LEVELS: a picked level belongs to the session it was picked in", '0 // THINKING-LEVELS'), wireChecks],
  ['page: the picker is not disabled under a run', M(PAGE, 'disabled: agentRunBusy(agentRun), onChange: pickThinkingLevel', 'disabled: false, onChange: pickThinkingLevel'), wireChecks],
  ['page: one send forgets the level', M(PAGE, "            ...(thinkingLevelRef.current ? { thinkingLevel: thinkingLevelRef.current } : {}), // THINKING-LEVELS: a card's button\n", ''), wireChecks],
  ['picker: a position the plan cannot use is chosen', M(PICKER, 'const pick = levelPick(level, plan)\n    if (pick) onChange(pick.level)', 'onChange(level)'), pickerChecks],
  ['picker: the draft is not cleared after the slider\'s late report', M(PICKER, '    setTimeout(() => setDraft(null), 0) // the slider reports', '    // the slider reports'), pickerChecks],
  ['picker: the level already shown is chosen again', M(PICKER, 'if (level === value) return\n', ''), pickerChecks],
  ['picker: the disabled mark is gone', M(PICKER, 'data-level-disabled={stop.disabled ? "true" : "false"}', 'data-level-disabled="false"'), pickerChecks],
  ['picker: Auto shows a thumb', M(PICKER, 'const onScale = kind === "selected"', 'const onScale = true'), pickerChecks],
  ['send side: the model gauge stays beside the level picker', M(CLEAN, '{levels ? <LevelPicker {...levels} className="studio-chat-clean-model" /> : <ModelPicker', '{levels ? <><LevelPicker {...levels} className="studio-chat-clean-model" /><ModelPicker variant="slider" sessionId={picker.sessionId} disabled={picker.disabled} className="studio-chat-clean-model" /></> : <ModelPicker'), sendSideChecks],
  ['send side: the level picker is drawn with no flag (levels prop ignored)', M(CLEAN, '{levels ? <LevelPicker', '{false ? <LevelPicker'), sendSideChecks],
]
for (const [label, texts, fn] of MUTANTS) await mutant(label, () => fn(texts))
// source mutants: a marker lost, a base line lost, a stray file, a missing co-author line
await mutant('sources: a marked line loses its marker', () => sourceChecks({ ...TEXTS, [PAGE]: swap(TEXTS[PAGE], "  const thinkingLevelRef = useRef<ThinkingLevel | undefined>(undefined) // THINKING-LEVELS:", "  const thinkingLevelRef = useRef<ThinkingLevel | undefined>(undefined) // THINKING:") }))
await mutant('sources: a base line is lost', () => sourceChecks({ ...TEXTS, [PAGE]: swap(TEXTS[PAGE], "  const [researchEnabled, setResearchEnabled] = useState(false)\n", '') }))
await mutant('sources: the env block is edited', () => sourceChecks({ ...TEXTS, '.env.example': swap(TEXTS['.env.example'], 'NEXT_PUBLIC_STUDIO_THINKING_LEVELS="false"', 'NEXT_PUBLIC_STUDIO_THINKING_LEVELS="true"') }))
await mutant('sources: the registry line is gone', () => registryChecks(swap(TEXTS[REGISTRY], "  (await import('./studio-thinking-levels-strip.mjs')).stripThinkingLevels, // LATER-CHANGE: FRONTEND-1, M1 the thinking-level picker (NEXT_PUBLIC_STUDIO_THINKING_LEVELS / _DIRECT_PREVIEW)\n", '')))
await mutant('scope: a stray file', () => scopeCheck(ownCommits(), ['components/builder/message-list.tsx']))
await mutant('commit: no co-author line', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'a body\n'), []))
await mutant('commit: another subject', () => assert.deepEqual(messageProblems('Fix a thing', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))

console.log(`\n${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`FAILED: ${failed.join('; ')}`); if (missed.length) console.error(`MISSED: ${missed.join('; ')}`); process.exit(1) }
process.exit(0)
