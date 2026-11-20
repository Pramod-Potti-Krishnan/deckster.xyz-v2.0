// FRONTEND-1: proof of "Levels direct live" (wave 1 step 4.1c). Director now has a real direct route for Best and Max (it picks the route from the thinking_level the Studio already sends), so the level picker can stop saying "Coming soon: runs as Balanced for now."
// Flags NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_LIVE (Best) and NEXT_PUBLIC_STUDIO_THINKING_LEVELS_MAX_LIVE (Max), each only the exact string "true", default off. DIRECT_LIVE acts only where the direct preview already acts; MAX_LIVE only with DIRECT_LIVE also on.
//
//   node scripts/test-studio-levels-direct-live.mjs        (plain node, offline: the REAL sources transpiled and run in a vm, dev's lib read from git (the base commit) and run beside it; react-dom/server for the picker's markup; git is read for the strips, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to J), then mutants (K):
//  A. the flags: each is on for the exact string "true" and for nothing else; DIRECT_LIVE needs the direct preview (which needs the picker and its three other flags); MAX_LIVE needs DIRECT_LIVE; read from the env as literals, one read each (the lib's whole list of env reads is pinned);
//  B. the words and the rules, over EVERY combination (preview off/on x DIRECT_LIVE off/on x MAX_LIVE off/on x plan free/starter/pro/premium/not loaded x level): thinkingStops, stopLine, levelRefusal, levelPick and thinkingView against an independent table that holds the exact words: Best live says
//     "A deeper build in one pass. Pro and Max plans." and is not marked coming soon; Max live says "Our most thorough build. Max plan only.", is not marked coming soon, and is pickable on the Max plan (premium) only: a Pro user sees it disabled with "Max is on the Max plan.";
//     Free, Starter and a plan not loaded keep the Agent shell's words; Max NOT live keeps today's words and rule exactly, even with DIRECT_LIVE on; Auto, Fast and Balanced never change; the words are plain (no model, provider, router or price); every line the picker can show, the live ones included, is at most 60 characters (the popover's room, as M1 keeps it);
//  C. THE DEFAULT PATH (what the picker, the page and the hook call, with no flags handed in): the module's flags from the build-time env, over a few hundred env combinations (the odd values of each flag included), equal the table;
//  D. FLAG OFF IS DEV'S, byte for byte: dev's lib (git, the base commit) and this lib are run on every flag-off state (live flags missing, false, or on without what they stand on: DIRECT_LIVE without the preview, MAX_LIVE without DIRECT_LIVE) over every plan, level and odd input; the transcripts are hashed and equal;
//     and with the flags on, Auto, Fast and Balanced and the wire (levelBuildMode, the picks' modes) are still dev's, Best and Max differ only in the lines, the coming-soon marks and Max's plan rule;
//  E. the picker (its component is NOT edited): the markup for each plan and state (names, disabled marks, coming-soon marks, the line under the slider), the real LevelPicker's choices with a stubbed React (a Pro user's Max is refused, a Max-plan user's is chosen), the line while the thumb is dragged; flag off its markup is dev's, hashed;
//  F. only insertions and the few rewritten base lines: every added line carries the marker LEVELS-DIRECT-LIVE; the base lines lost are exactly the ones the [has, was] pairs rewrite; the strip gives dev's file byte for byte; the base words (LEVEL_COPY) are untouched; the lib's imports are dev's; the older proofs it teaches;
//  G. .env.example (one block at the end, both flags "false", naming only its own flags) and the registry (three lines after the hero-only Replace picture's, each marked LATER-CHANGE);
//  H. own-commit scope by the subject prefix "Levels direct live:" on the first-parent line, from the COMMITTED diff only (the working tree is never read for scope); the commit message; a secret scan of the added lines;
//  I. the two flags are read from one literal env name each, and nothing but the lib reads them;
//  J. the wire and the other files: the page, the hook, the picker, the composer and the Agent libs are dev's.
//  K. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
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
import * as stripModule from './studio-levels-direct-live-strip.mjs'
import * as levelsStrip from './studio-thinking-levels-strip.mjs'
import * as heroOnlyStrip from './studio-replace-picture-hero-only-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const { BASE_COMMIT, LEVELS_DIRECT_LIVE_FLAGS: FLAGS, LEVELS_DIRECT_LIVE_MARKER_RE: MARKER_RE, LEVELS_DIRECT_LIVE_SUBJECT: SUBJECT, LEVELS_DIRECT_LIVE_FILES: APP_FILES, LEVELS_DIRECT_LIVE_NEW_FILES: NEW_FILES, LEVELS_DIRECT_LIVE_EDITS: EDITS, LEVELS_DIRECT_LIVE_PIN_EDITS: PIN_EDITS,
  LEVELS_DIRECT_LIVE_PIN_FILES: PIN_FILES, LEVELS_DIRECT_LIVE_PIN_MARK: PIN_MARK, LEVELS_DIRECT_LIVE_LIB_FLAGS: LIB_FLAGS, LEVELS_DIRECT_LIVE_SCOPE_FILES: SCOPE, LEVELS_DIRECT_LIVE_ENV_BLOCK: ENV_BLOCK } = stripModule
const STRIP_FN = stripModule.stripLevelsDirectLive
const [DL, ML] = FLAGS
const PREVIEW = 'NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }
/** The sources run in a vm, so their objects and arrays come from another realm: compare them through JSON. */
const deepEqual = (actual, expected, ...message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual ?? null)), JSON.parse(JSON.stringify(expected ?? null)), ...message)
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

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
const LIB = 'lib/studio-thinking-levels.ts', AGENT = 'lib/studio-agent-mode.ts', PICKER = 'components/builder/thinking-levels/level-picker.tsx', CSS = 'components/builder/thinking-levels/level-picker.css'
const HOOK = 'hooks/use-deckster-websocket-v2.ts', PAGE = 'app/builder/page.tsx', INPUT = 'components/builder/chat-input.tsx', CLEAN = 'components/builder/chat/studio-chat-clean.tsx', WIRE = 'lib/studio-agent-mode-wire.ts'
const ENV = '.env.example', REGISTRY = 'scripts/studio-later-changes.mjs'
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
/** Load one real source in a new context. `texts` replaces the text of any file (a mutant, or dev's text); `react` replaces React; every other import is the REAL source or package, loaded with the same `env`. A .css import is an empty module. */
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
/** The lib as dev has it (the base commit's text), under the same env. */
const DEV = { [LIB]: baseText(LIB) }
const devLib = env => load(LIB, { env, texts: DEV })
const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const BASE_ON = { ...SHELL, NEXT_PUBLIC_AGENT_MODE: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' }
const ENV_ON = { ...BASE_ON, NEXT_PUBLIC_STUDIO_THINKING_LEVELS: 'true' }
const ENV_PREVIEW = { ...ENV_ON, [PREVIEW]: 'true' }
const ENV_BEST = { ...ENV_PREVIEW, [DL]: 'true' }
const ENV_MAX = { ...ENV_BEST, [ML]: 'true' }
const without = (env, key) => Object.fromEntries(Object.entries(env).filter(([k]) => k !== key))
const stubReact = { ...React, useId: () => 'pid', useState: init => [typeof init === 'function' ? init() : init, () => {}], useEffect: () => {}, useRef: init => ({ current: init }) }
const h = React.createElement

const PLANS = ['free', 'starter', 'pro', 'premium', null, undefined]
const LEVELS = ['auto', 'fast', 'balanced', 'best', 'max']
const JUNK = ['turbo', '', null, undefined, 7, 'Fast', 'BEST']
const LEAK = /sonnet|opus|claude|anthropic|openrouter|openai|gpt|gemini|vertex|router|model|provider|token|dollar|\$|price/i
/** The words, written out here (not read from the lib): what each state must say. */
const WORDS = {
  soon: 'Coming soon: runs as Balanced for now.', best: 'A deeper build in one pass. Pro and Max plans.', max: 'Our most thorough build. Max plan only.', maxPlan: 'Max is on the Max plan.',
  agentPlan: 'Agent build is on Pro and Max plans.', unknownPlan: 'Your plan is not loaded yet.', auto: 'Deckster picks how to build this deck.', fast: 'The quickest build, step by step.', balanced: 'The agent build. Pro and Max plans.',
}
const LABEL = { auto: 'Auto', fast: 'Fast', balanced: 'Balanced', best: 'Best', max: 'Max' }

// ============================================================================================================================================
// the table: what every state must do, independent of the lib's own code
// ============================================================================================================================================
/** `s` = { levels, preview, directLive, maxLive } as the flags a caller hands in (booleans). Best is live only with the preview and DIRECT_LIVE; Max only with Best live and MAX_LIVE. */
const table = s => {
  const bestLive = s.preview && s.directLive, maxLive = bestLive && s.maxLive
  const refusal = (level, plan) => {
    if (level === 'max' && maxLive && plan === 'pro') return WORDS.maxPlan
    if (level !== 'balanced' && level !== 'best' && level !== 'max') return null
    if (plan === 'pro' || plan === 'premium') return null
    return plan ? WORDS.agentPlan : WORDS.unknownPlan
  }
  const line = (level, plan) => refusal(level, plan) ?? (level === 'best' && bestLive ? WORDS.best : level === 'max' && maxLive ? WORDS.max : { auto: WORDS.auto, fast: WORDS.fast, balanced: WORDS.balanced, best: WORDS.soon, max: WORDS.soon }[level])
  const stops = plan => ['fast', 'balanced', ...(s.preview ? ['best', 'max'] : [])].map(id => ({ id, label: LABEL[id], disabled: refusal(id, plan) !== null, comingSoon: (id === 'best' && !bestLive) || (id === 'max' && !maxLive) }))
  const pick = (level, plan) => {
    if (!s.levels || !LEVELS.includes(level)) return null
    if (level !== 'auto' && !stops(plan).some(stop => stop.id === level)) return null
    if (refusal(level, plan) !== null) return null
    return { level, mode: level === 'balanced' || level === 'best' || level === 'max' ? 'agent' : 'standard' }
  }
  const view = (level, plan) => {
    const list = stops(plan), index = list.findIndex(stop => stop.id === level), shown = index >= 0 ? level : 'auto'
    return { stops: list, index, thumb: index >= 0 ? 'selected' : 'none', title: LABEL[shown], line: line(shown, plan), valueText: `${LABEL[shown]}. ${line(shown, plan)}`, resetLabel: 'Auto: Deckster chooses', resetEnabled: shown !== 'auto' }
  }
  return { bestLive, maxLive, refusal, line, stops, pick, view }
}
const flagsOf = s => ({ levels: s.levels, direct: s.preview, bestLive: s.directLive, maxLive: s.maxLive })
/** Every combination of the three flags the lib takes, with the picker on and off. */
const STATES = []
for (const levels of [true, false]) for (const preview of [false, true]) for (const directLive of [false, true]) for (const maxLive of [false, true]) STATES.push({ levels, preview, directLive, maxLive })
const nameOf = s => `levels ${s.levels ? 'on' : 'off'}, preview ${s.preview ? 'on' : 'off'}, DIRECT_LIVE ${s.directLive ? 'on' : 'off'}, MAX_LIVE ${s.maxLive ? 'on' : 'off'}`

// ============================================================================================================================================
// A. the flags
// ============================================================================================================================================
/** Each of the three states of the three build-time flags, odd values included. */
const ODD = ['false', 'True', 'TRUE', '1', ' true', 'true ', '', 'yes']
function flagChecks(texts = {}) {
  const lib = env => load(LIB, { env, texts })
  const L = lib(ENV_MAX)
  // the pure helpers: exact "true", and only on top of what they stand on
  assert.deepEqual([L.studioThinkingDirectLiveOn('true', true), L.studioThinkingDirectLiveOn('true', false), L.studioThinkingDirectLiveOn('false', true), L.studioThinkingDirectLiveOn(undefined, true), L.studioThinkingDirectLiveOn('True', true), L.studioThinkingDirectLiveOn('1', true)], [true, false, false, false, false, false], 'the DIRECT_LIVE rule: exact "true", only where the direct preview counts')
  assert.deepEqual([L.studioThinkingMaxLiveOn('true', true), L.studioThinkingMaxLiveOn('true', false), L.studioThinkingMaxLiveOn('false', true), L.studioThinkingMaxLiveOn(undefined, true), L.studioThinkingMaxLiveOn(' true', true)], [true, false, false, false, false], 'the MAX_LIVE rule: exact "true", only where Best is live')
  // the module's flags from the env
  assert.deepEqual([lib({}).STUDIO_THINKING_LEVELS_DIRECT_LIVE, lib({}).STUDIO_THINKING_LEVELS_MAX_LIVE], [false, false], 'nothing set: both off')
  assert.deepEqual([lib(ENV_ON).STUDIO_THINKING_LEVELS_DIRECT_LIVE, lib(ENV_ON).STUDIO_THINKING_LEVELS_MAX_LIVE], [false, false], 'the picker alone: both off')
  assert.deepEqual([lib(ENV_PREVIEW).STUDIO_THINKING_LEVELS_DIRECT_LIVE, lib(ENV_PREVIEW).STUDIO_THINKING_LEVELS_MAX_LIVE], [false, false], 'the preview alone: both off (default off)')
  assert.deepEqual([lib(ENV_BEST).STUDIO_THINKING_LEVELS_DIRECT_LIVE, lib(ENV_BEST).STUDIO_THINKING_LEVELS_MAX_LIVE], [true, false], 'the preview and DIRECT_LIVE: Best live, Max not')
  assert.deepEqual([lib(ENV_MAX).STUDIO_THINKING_LEVELS_DIRECT_LIVE, lib(ENV_MAX).STUDIO_THINKING_LEVELS_MAX_LIVE], [true, true], 'and MAX_LIVE: both')
  assert.deepEqual([lib({ ...ENV_PREVIEW, [ML]: 'true' }).STUDIO_THINKING_LEVELS_DIRECT_LIVE, lib({ ...ENV_PREVIEW, [ML]: 'true' }).STUDIO_THINKING_LEVELS_MAX_LIVE], [false, false], 'MAX_LIVE without DIRECT_LIVE: nothing')
  for (const odd of ODD) {
    assert.deepEqual([lib({ ...ENV_PREVIEW, [DL]: odd }).STUDIO_THINKING_LEVELS_DIRECT_LIVE, lib({ ...ENV_PREVIEW, [DL]: odd, [ML]: 'true' }).STUDIO_THINKING_LEVELS_MAX_LIVE], [false, false], `DIRECT_LIVE ${JSON.stringify(odd)} is off (and MAX_LIVE with it)`)
    assert.equal(lib({ ...ENV_BEST, [ML]: odd }).STUDIO_THINKING_LEVELS_MAX_LIVE, false, `MAX_LIVE ${JSON.stringify(odd)} is off`)
  }
  // the preview and the picker underneath: each of the four picker flags, and the preview flag, missing or odd: neither live flag counts
  for (const [name, env] of Object.entries({ 'no picker flag': without(ENV_MAX, 'NEXT_PUBLIC_STUDIO_THINKING_LEVELS'), 'no agent mode': without(ENV_MAX, 'NEXT_PUBLIC_AGENT_MODE'), 'no shell': without(ENV_MAX, 'NEXT_PUBLIC_STUDIO_V4_SHELL'), 'no clean composer': without(ENV_MAX, 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN'), 'no preview': without(ENV_MAX, PREVIEW), 'preview "false"': { ...ENV_MAX, [PREVIEW]: 'false' }, 'preview "True"': { ...ENV_MAX, [PREVIEW]: 'True' }, 'picker "1"': { ...ENV_MAX, NEXT_PUBLIC_STUDIO_THINKING_LEVELS: '1' } })) {
    assert.deepEqual([lib(env).STUDIO_THINKING_LEVELS_DIRECT_LIVE, lib(env).STUDIO_THINKING_LEVELS_MAX_LIVE], [false, false], `${name}: DIRECT_LIVE and MAX_LIVE do not count (they act only where the direct preview does)`)
  }
}

// ============================================================================================================================================
// B. the words and the rules, over every combination, against the table
// ============================================================================================================================================
function matrixChecks(texts = {}) {
  const L = load(LIB, { env: {}, texts })
  let cells = 0
  for (const s of STATES) {
    const T = table(s), flags = flagsOf(s), label = nameOf(s)
    for (const plan of PLANS) {
      deepEqual(L.thinkingStops(plan, flags), T.stops(plan), `${label}, ${plan}: the stops`)
      for (const level of LEVELS) {
        assert.equal(L.stopLine(level, plan, flags), T.line(level, plan), `${label}, ${plan}: the line of ${level}`)
        assert.equal(L.levelRefusal(level, plan, flags), T.refusal(level, plan), `${label}, ${plan}: the refusal of ${level}`)
        deepEqual(L.thinkingView(level, plan, flags), T.view(level, plan), `${label}, ${plan}: the view at ${level}`)
        cells++
      }
      for (const level of [...LEVELS, ...JUNK]) { deepEqual(L.levelPick(level, plan, flags), T.pick(level, plan), `${label}, ${plan}: a pick of ${JSON.stringify(level)}`); cells++ }
    }
  }
  assert.ok(cells > 600, 'a real matrix ran')
  // flags handed in without the live fields read as not live (the shape dev's callers use): dev's behaviour
  for (const levels of [true, false]) for (const preview of [false, true]) for (const plan of PLANS) for (const level of LEVELS) {
    const T = table({ levels, preview, directLive: false, maxLive: false })
    assert.equal(L.stopLine(level, plan, { levels, direct: preview }), T.line(level, plan), `no live fields: the line of ${level} on ${plan}`)
    deepEqual(L.thinkingStops(plan, { levels, direct: preview }), T.stops(plan), `no live fields: the stops on ${plan}`)
    deepEqual(L.levelPick(level, plan, { levels, direct: preview }), T.pick(level, plan), `no live fields: a pick of ${level} on ${plan}`)
  }
  // the named cases, in words (so a reader sees the rule and the table is not the only witness)
  const F = (preview, directLive, maxLive) => ({ levels: true, direct: preview, bestLive: directLive, maxLive })
  assert.equal(L.stopLine('best', 'pro', F(true, true, false)), 'A deeper build in one pass. Pro and Max plans.', 'Best live on Pro')
  assert.equal(L.stopLine('best', 'premium', F(true, true, false)), 'A deeper build in one pass. Pro and Max plans.', 'Best live on Max')
  assert.equal(L.stopLine('best', 'free', F(true, true, false)), 'Agent build is on Pro and Max plans.', 'Best live on Free: the Agent shell\'s reason')
  assert.equal(L.stopLine('best', null, F(true, true, false)), 'Your plan is not loaded yet.', 'Best live, plan not loaded')
  assert.equal(L.stopLine('max', 'pro', F(true, true, false)), 'Coming soon: runs as Balanced for now.', 'Max not live (DIRECT_LIVE on): today\'s words, on Pro')
  assert.equal(L.stopLine('max', 'premium', F(true, true, false)), 'Coming soon: runs as Balanced for now.', 'Max not live (DIRECT_LIVE on): today\'s words, on Max')
  assert.equal(L.stopLine('max', 'premium', F(true, true, true)), 'Our most thorough build. Max plan only.', 'Max live on the Max plan')
  assert.equal(L.stopLine('max', 'pro', F(true, true, true)), 'Max is on the Max plan.', 'Max live: a Pro user is told it is on the Max plan')
  for (const plan of ['free', 'starter']) assert.equal(L.stopLine('max', plan, F(true, true, true)), 'Agent build is on Pro and Max plans.', `Max live on ${plan}: the Agent shell's words`)
  assert.equal(L.stopLine('max', undefined, F(true, true, true)), 'Your plan is not loaded yet.', 'Max live, plan not loaded: the Agent shell\'s words')
  assert.equal(L.levelPick('max', 'pro', F(true, true, true)), null, 'a Pro pick of live Max is refused')
  deepEqual(L.levelPick('max', 'premium', F(true, true, true)), { level: 'max', mode: 'agent' }, 'a Max-plan pick of live Max is the Agent build')
  deepEqual(L.levelPick('max', 'pro', F(true, true, false)), { level: 'max', mode: 'agent' }, 'Max not live: a Pro pick works as it does today (it runs as Balanced)')
  deepEqual(L.levelPick('best', 'pro', F(true, true, true)), { level: 'best', mode: 'agent' }, 'Best live: a Pro pick works')
  const live = L.thinkingStops('pro', F(true, true, true)); deepEqual(live.map(stop => [stop.id, stop.disabled, stop.comingSoon]), [['fast', false, false], ['balanced', false, false], ['best', false, false], ['max', true, false]], 'Pro, both live: Best on, Max disabled, nothing marked coming soon')
  const prem = L.thinkingStops('premium', F(true, true, true)); deepEqual(prem.map(stop => [stop.id, stop.disabled, stop.comingSoon]), [['fast', false, false], ['balanced', false, false], ['best', false, false], ['max', false, false]], 'Max plan, both live: all four on, nothing marked coming soon')
  const half = L.thinkingStops('premium', F(true, true, false)); deepEqual(half.map(stop => stop.comingSoon), [false, false, false, true], 'DIRECT_LIVE only: Best live, Max still coming soon')
  // the words are plain: no model, provider, router or price, and the live words do not say "coming soon" (they are not the coming-soon words)
  const COPY = L.LEVEL_COPY_LIVE
  deepEqual(COPY, { best: WORDS.best, max: WORDS.max, maxPlan: WORDS.maxPlan }, 'the live words, exactly')
  for (const word of Object.values(COPY)) { assert.doesNotMatch(word, LEAK, `plain words: ${word}`); assert.doesNotMatch(word, /coming soon|runs as/i, `no "coming soon": ${word}`) }
  lengthChecks(texts)
  return cells
}
/** The popover's room: M1 keeps every picker line at 60 characters or fewer (its LEVEL_COPY check), so every live line is too: each string of LEVEL_COPY_LIVE, and each line the picker can show once a level is live. */
const MAX_LINE = 60
function lengthChecks(texts = {}) {
  const L = load(LIB, { env: {}, texts })
  for (const [key, word] of Object.entries(L.LEVEL_COPY_LIVE)) assert.ok(word.length <= MAX_LINE, `LEVEL_COPY_LIVE.${key} is ${word.length} characters, over ${MAX_LINE}: ${word}`)
  for (const [key, word] of Object.entries(WORDS)) assert.ok(word.length <= MAX_LINE, `the table's own words (${key}) are at most ${MAX_LINE} characters (${word.length})`)
  for (const s of STATES) for (const plan of PLANS) for (const level of LEVELS) { const line = L.stopLine(level, plan, flagsOf(s)); assert.ok(line.length <= MAX_LINE, `${nameOf(s)}, ${plan}: the line of ${level} is ${line.length} characters, over ${MAX_LINE}: ${line}`) }
}

// ============================================================================================================================================
// C. the default path: the module's flags from the build-time env (what the picker, the page and the hook call)
// ============================================================================================================================================
function envCombos() {
  const out = []
  const vals = [undefined, 'true', ...ODD]
  for (const [pickerName, base] of [['picker off', BASE_ON], ['picker on', ENV_ON]]) for (const preview of [undefined, 'true', 'false']) for (const dl of vals) for (const ml of vals) {
    const env = { ...base }; if (preview !== undefined) env[PREVIEW] = preview; if (dl !== undefined) env[DL] = dl; if (ml !== undefined) env[ML] = ml
    out.push({ name: `${pickerName}, preview ${JSON.stringify(preview)}, DIRECT_LIVE ${JSON.stringify(dl)}, MAX_LIVE ${JSON.stringify(ml)}`, env, picker: pickerName === 'picker on', previewOn: preview === 'true', dl: dl === 'true', ml: ml === 'true' })
  }
  return out
}
const ENV_COMBOS = envCombos()
function defaultPathChecks(texts = {}) {
  let n = 0
  for (const { name, env, picker, previewOn, dl, ml } of ENV_COMBOS) {
    const L = load(LIB, { env, texts })
    const s = { levels: picker, preview: picker && previewOn, directLive: picker && previewOn && dl, maxLive: picker && previewOn && dl && ml }, T = table(s)
    assert.deepEqual([L.STUDIO_THINKING_LEVELS_ENABLED, L.STUDIO_THINKING_LEVELS_DIRECT_PREVIEW, L.STUDIO_THINKING_LEVELS_DIRECT_LIVE, L.STUDIO_THINKING_LEVELS_MAX_LIVE], [s.levels, s.preview, s.directLive, s.maxLive], `${name}: the module's four flags`)
    for (const plan of PLANS) {
      deepEqual(L.thinkingStops(plan), T.stops(plan), `${name}, ${plan}: the stops, flags from the env`)
      for (const level of LEVELS) {
        assert.equal(L.stopLine(level, plan), T.line(level, plan), `${name}, ${plan}: stopLine(${level}) with no flags handed in`)
        assert.equal(L.levelRefusal(level, plan), T.refusal(level, plan), `${name}, ${plan}: levelRefusal(${level}) with no flags handed in`)
        deepEqual(L.levelPick(level, plan), T.pick(level, plan), `${name}, ${plan}: levelPick(${level}) with no flags handed in`)
        deepEqual(L.thinkingView(level, plan), T.view(level, plan), `${name}, ${plan}: thinkingView(${level}) with no flags handed in`)
        n++
      }
    }
  }
  assert.ok(n >= ENV_COMBOS.length * 30, 'the whole env matrix ran')
  return n
}

// ============================================================================================================================================
// D. flag off is dev's, byte for byte (hashed); with the flags on, only Best and Max move
// ============================================================================================================================================
/** Everything the lib can say or do on one set of arguments, as one JSON text: the same calls are made on dev's lib and on this one. `mkFlags` gives the flags object each lib is handed (dev's ignores any live fields). */
function transcript(L, mkFlags) {
  const out = []
  for (const levels of [true, false]) for (const preview of [false, true]) {
    const flags = mkFlags({ levels, preview })
    for (const plan of PLANS) {
      out.push(['stops', levels, preview, plan, L.thinkingStops(plan, flags)])
      for (const level of [...LEVELS, ...JUNK]) out.push(['pick', levels, preview, plan, level, L.levelPick(level, plan, flags)])
      for (const level of LEVELS) out.push(['line', levels, preview, plan, level, L.stopLine(level, plan, flags), L.levelRefusal(level, plan, flags), L.thinkingView(level, plan, flags)])
    }
  }
  return JSON.stringify(out)
}
/** What a lib says with no flags handed in, under one env. */
function defaultTranscript(L) {
  const out = [L.STUDIO_THINKING_LEVELS_ENABLED, L.STUDIO_THINKING_LEVELS_DIRECT_PREVIEW]
  for (const plan of PLANS) {
    out.push(L.thinkingStops(plan))
    for (const level of [...LEVELS, ...JUNK]) out.push(L.levelPick(level, plan))
    for (const level of LEVELS) out.push(L.stopLine(level, plan), L.levelRefusal(level, plan), L.thinkingView(level, plan))
  }
  return JSON.stringify(out)
}
/** The words and exports dev's lib has that this one must still have, as they are. */
const baseExports = L => JSON.stringify({ copy: L.LEVEL_COPY, levels: L.THINKING_LEVELS, stops: L.THINKING_STOPS, direct: L.THINKING_DIRECT_STOPS, build: LEVELS.map(level => [level, L.levelBuildMode(level), L.levelNeedsAgent(level)]), eff: LEVELS.flatMap(a => ['standard', 'agent', 'author'].map(m => L.effectiveLevel(a, m))) })
function flagOffChecks(texts = {}) {
  const mine = load(LIB, { env: {}, texts }), dev = devLib({})
  // 1. flags handed in: dev's shape, the live fields false, the live fields missing, and the live fields on without what they stand on
  const variants = { 'no live fields (dev\'s shape)': ({ levels, preview }) => ({ levels, direct: preview }), 'live fields false': ({ levels, preview }) => ({ levels, direct: preview, bestLive: false, maxLive: false }), 'live fields undefined': ({ levels, preview }) => ({ levels, direct: preview, bestLive: undefined, maxLive: undefined }) }
  const reference = transcript(dev, variants['no live fields (dev\'s shape)'])
  const digests = {}
  for (const [name, mk] of Object.entries(variants)) { const got = transcript(mine, mk); assert.equal(got, reference, `${name}: this lib says and does what dev's does, event for event`); digests[name] = sha(got) }
  const offStates = { 'DIRECT_LIVE on without the preview': ({ levels, preview }) => ({ levels, direct: false, bestLive: true, maxLive: true }), 'MAX_LIVE on without DIRECT_LIVE': ({ levels, preview }) => ({ levels, direct: preview, bestLive: false, maxLive: true }) }
  for (const [name, mk] of Object.entries(offStates)) {
    const devOnSame = transcript(dev, ({ levels, preview }) => ({ levels, direct: mk({ levels, preview }).direct })), got = transcript(mine, mk)
    assert.equal(got, devOnSame, `${name}: dev's behaviour`)
  }
  // 2. the build-time path: every env where neither live flag is in force gives dev's transcript, hashed
  let envCount = 0; const hash = crypto.createHash('sha256')
  for (const { name, env, picker, previewOn, dl, ml } of ENV_COMBOS) {
    const inForce = picker && previewOn && dl
    if (inForce) continue
    const a = defaultTranscript(load(LIB, { env, texts })), b = defaultTranscript(devLib(env))
    assert.equal(a, b, `${name}: with no flag in force this lib is dev's on the default path`)
    hash.update(a); envCount++
  }
  assert.ok(envCount > 300, 'many flag-off envs ran')
  // 3. the exports dev's lib has: the words, the scale, the build modes (the wire), untouched, in every state
  for (const env of [{}, ENV_ON, ENV_PREVIEW, ENV_BEST, ENV_MAX]) assert.equal(baseExports(load(LIB, { env, texts })), baseExports(devLib(env)), 'the base words (LEVEL_COPY), the scale and the build modes are dev\'s')
  // the lib's exports: everything dev's had is still there, and what is new is exactly the three constants and the five helpers
  const keysOf = L => Object.keys(L).sort(), devKeys = keysOf(dev), myKeys = keysOf(mine)
  assert.deepEqual(devKeys.filter(key => !myKeys.includes(key)), [], 'every export dev\'s lib has is still there')
  assert.deepEqual(myKeys.filter(key => !devKeys.includes(key)), ['LEVEL_COPY_LIVE', 'STUDIO_THINKING_LEVELS_DIRECT_LIVE', 'STUDIO_THINKING_LEVELS_MAX_LIVE', 'bestIsLive', 'liveLine', 'maxIsLive', 'studioThinkingDirectLiveOn', 'studioThinkingMaxLiveOn'], 'and the new exports are exactly these eight')
  // 4. flags on: Auto, Fast and Balanced are dev's; Max with only DIRECT_LIVE is dev's; Best and Max move only as the rule says
  const flagsOn = [['DIRECT_LIVE', { bestLive: true, maxLive: false }], ['DIRECT_LIVE and MAX_LIVE', { bestLive: true, maxLive: true }]]
  for (const [name, live] of flagsOn) for (const plan of PLANS) {
    const flags = { levels: true, direct: true, ...live }, devFlags = { levels: true, direct: true }
    for (const level of ['auto', 'fast', 'balanced']) {
      assert.equal(mine.stopLine(level, plan, flags), dev.stopLine(level, plan, devFlags), `${name}, ${plan}: the line of ${level} is dev's`)
      assert.equal(mine.levelRefusal(level, plan, flags), dev.levelRefusal(level, plan, devFlags), `${name}, ${plan}: the refusal of ${level} is dev's`)
      deepEqual(mine.levelPick(level, plan, flags), dev.levelPick(level, plan, devFlags), `${name}, ${plan}: a pick of ${level} is dev's`)
      const a = mine.thinkingView(level, plan, flags), b = dev.thinkingView(level, plan, devFlags)
      deepEqual({ ...a, stops: a.stops.filter(stop => stop.id === 'fast' || stop.id === 'balanced') }, { ...b, stops: b.stops.filter(stop => stop.id === 'fast' || stop.id === 'balanced') }, `${name}, ${plan}: the view at ${level} is dev's (Fast and Balanced stops included)`)
    }
    deepEqual(mine.thinkingStops(plan, flags).slice(0, 2), dev.thinkingStops(plan, devFlags).slice(0, 2), `${name}, ${plan}: the Fast and Balanced stops are dev's`)
  }
  return { digests, envCount, envDigest: hash.digest('hex') }
}

// ============================================================================================================================================
// E. the picker: its component is not edited; its markup and its choices follow the lib
// ============================================================================================================================================
function pickerChecks(texts = {}) {
  const attr = (markup, name) => [...markup.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map(m => m[1])
  const panel = (P, lib, level, plan, s, over = {}) => renderToStaticMarkup(h(P.LevelPanel, { Title: 'h2', view: lib.thinkingView(level, plan, flagsOf(s)), blocked: false, onDraft() {}, onCommit() {}, onReset() {}, ...over }))
  const P = load(PICKER, { env: ENV_MAX, texts }), lib = load(LIB, { env: ENV_MAX, texts })
  for (const s of STATES.filter(state => state.levels)) for (const plan of PLANS) for (const level of LEVELS) {
    const T = table(s), m = panel(P, lib, level, plan, s), label = `${nameOf(s)}, ${plan}, at ${level}`
    deepEqual(attr(m, 'data-level-soon'), T.stops(plan).map(stop => String(stop.comingSoon)), `${label}: the coming-soon marks`)
    deepEqual(attr(m, 'data-level-disabled'), T.stops(plan).map(stop => String(stop.disabled)), `${label}: the disabled marks`)
    deepEqual([...m.matchAll(/mpick-stop-name">([^<]*)</g)].map(x => x[1]), T.stops(plan).map(stop => stop.label), `${label}: the names`)
    const view = T.view(level, plan)
    assert.ok(textOf(m).includes(view.line), `${label}: the line under the slider reads: ${view.line}`)
    assert.ok(new RegExp(`<h2[^>]*>${view.title}<`).test(m), `${label}: the title`)
  }
  // flag off, the picker's markup is dev's: the same component over dev's lib, hashed
  const hashOff = crypto.createHash('sha256'); let off = 0
  for (const s of STATES.filter(state => !(state.preview && state.directLive))) for (const plan of PLANS) for (const level of LEVELS) {
    const devP = load(PICKER, { env: ENV_MAX, texts: { ...texts, ...DEV } }), devL = load(LIB, { env: ENV_MAX, texts: { ...texts, ...DEV } })
    const a = panel(P, lib, level, plan, s), b = panel(devP, devL, level, plan, { ...s, directLive: false, maxLive: false })
    assert.equal(a, b, `${nameOf(s)}, ${plan}, at ${level}: no live flag in force: the markup is dev's`); hashOff.update(a); off++
  }
  // the real LevelPicker (stubbed React): the build-time flags decide, with no flags handed in
  const calls = []
  const run = (env, value, plan, react = stubReact) => { calls.length = 0; return load(PICKER, { env, texts, react }).LevelPicker({ value, plan, onChange: l => calls.push(l) }).props }
  // Best live
  const bestPro = run(ENV_BEST, 'auto', 'pro'); deepEqual(bestPro.view.stops.map(stop => stop.comingSoon), [false, false, false, true], 'DIRECT_LIVE only, Pro: Best is not marked coming soon, Max is')
  bestPro.onCommit(2); bestPro.onCommit(3); assert.deepEqual(calls, ['best', 'max'], 'DIRECT_LIVE only, Pro: Best and Max (not live) can both be chosen, as today')
  // both live
  const maxPro = run(ENV_MAX, 'auto', 'pro'); deepEqual(maxPro.view.stops.map(stop => [stop.id, stop.disabled, stop.comingSoon]), [['fast', false, false], ['balanced', false, false], ['best', false, false], ['max', true, false]], 'both live, Pro: Max is shown disabled, nothing is coming soon')
  maxPro.onCommit(2); maxPro.onCommit(3); assert.deepEqual(calls, ['best'], 'both live, Pro: Best can be chosen, Max cannot (the pick calls nothing)')
  const maxPrem = run(ENV_MAX, 'auto', 'premium'); maxPrem.onCommit(3); maxPrem.onCommit(2); assert.deepEqual(calls, ['max', 'best'], 'both live, Max plan: Max and Best can be chosen')
  const maxFree = run(ENV_MAX, 'auto', 'free'); maxFree.onCommit(3); maxFree.onCommit(2); maxFree.onCommit(1); assert.deepEqual(calls, [], 'both live, Free: Balanced, Best and Max cannot be chosen')
  const maxNone = run(ENV_MAX, 'auto', null); maxNone.onCommit(3); assert.deepEqual(calls, [], 'both live, plan not loaded: Max cannot be chosen')
  // the shown level: a Max pick stays shown on the Max plan
  assert.equal(run(ENV_MAX, 'max', 'premium').view.valueText, 'Max. Our most thorough build. Max plan only.', 'the screen reader reads Max and its live line on the Max plan')
  assert.equal(run(ENV_MAX, 'best', 'pro').view.valueText, 'Best. A deeper build in one pass. Pro and Max plans.', 'the screen reader reads Best and its live line')
  // while the thumb is dragged the title and the line follow it (the picker's own call, with no flags handed in): drag to Max
  const drag = index => ({ ...stubReact, __id: `drag${index}`, useState: init => [init === null ? index : typeof init === 'function' ? init() : init, () => {}] })
  const dragged = (env, plan, index) => { const el = load(PICKER, { env, texts, react: drag(index) }).LevelPicker({ value: 'auto', plan, onChange() {} }); return el.props.view }
  assert.deepEqual([dragged(ENV_MAX, 'pro', 3).title, dragged(ENV_MAX, 'pro', 3).line], ['Max', 'Max is on the Max plan.'], 'dragging to Max on Pro says it is on the Max plan')
  assert.deepEqual([dragged(ENV_MAX, 'premium', 3).title, dragged(ENV_MAX, 'premium', 3).line], ['Max', 'Our most thorough build. Max plan only.'], 'dragging to Max on the Max plan says its live line')
  assert.deepEqual([dragged(ENV_MAX, 'pro', 2).title, dragged(ENV_MAX, 'pro', 2).line], ['Best', 'A deeper build in one pass. Pro and Max plans.'], 'dragging to Best says its live line')
  assert.deepEqual([dragged(ENV_PREVIEW, 'pro', 3).title, dragged(ENV_PREVIEW, 'pro', 3).line], ['Max', 'Coming soon: runs as Balanced for now.'], 'no live flag: dragging to Max says what it said before')
  assert.equal(dragged(ENV_BEST, 'premium', 3).line, 'Coming soon: runs as Balanced for now.', 'DIRECT_LIVE only: Max still says coming soon')
  return { off, offDigest: hashOff.digest('hex') }
}
const textOf = markup => markup.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()

// ============================================================================================================================================
// F. only insertions and the few rewritten base lines
// ============================================================================================================================================
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}
/** What the strips of the changes registered AFTER this one do to a text (they are other changes' lines and stay when only this strip runs). */
const laterStrips = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }
const laterEnv = text => { const blocks = registry.LATER_ENV_BLOCKS, at = blocks.indexOf(ENV_BLOCK); return (at === -1 ? [] : blocks.slice(at + 1)).reduce((out, later) => out.replace(`\n${later}`, ''), text) }
const TEXTS = Object.fromEntries([...APP_FILES, ...NEW_FILES, ...PIN_FILES, ENV, REGISTRY, PAGE, HOOK, PICKER, CSS, INPUT, CLEAN].map(rel => [rel, read(rel)]))
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/
const REWRITTEN = 8, INSERTED = 10
function insertionChecks(texts = TEXTS, strip = STRIP_FN, edits = EDITS) {
  for (const rel of APP_FILES) {
    const mine = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), mine)
    assert.equal(strip(rel, mine), baseText(rel), `${rel}: without this change's lines the file is dev's, byte for byte`); assert.equal(strip(rel, strip(rel, mine)), baseText(rel), `${rel}: putting back twice changes nothing more`)
    assert.notEqual(mine, baseText(rel), `${rel}: the change is there to strip`)
    for (const line of diff.added) assert.match(line, MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    const rewritten = edits[rel].flatMap(([, was]) => was.split('\n')).filter(Boolean)
    assert.deepEqual([...diff.removed].sort(), [...rewritten].sort(), `${rel}: the base lines lost are exactly the ones the pairs rewrite, all of them and no other`)
    assert.equal(diff.added.length, edits[rel].length, `${rel}: one marked line per edit`)
    for (const [has, was] of edits[rel]) assert.ok(MARKER_RE.test(has) && has.endsWith('\n') && !has.slice(0, -1).includes('\n') && (was === '' || (was.endsWith('\n') && !was.slice(0, -1).includes('\n') && !MARKER_RE.test(was))), `${rel}: a pair is one marked line, and what it puts back is nothing or one base line`)
  }
  const pairs = edits[LIB]
  assert.deepEqual([pairs.filter(([, was]) => was !== '').length, pairs.filter(([, was]) => was === '').length], [REWRITTEN, INSERTED], `the lib: ${REWRITTEN} base lines rewritten (each gains the flags it passes on), ${INSERTED} lines inserted`)
  // the base words and the base constants are not among the rewritten lines
  const base = baseText(LIB)
  for (const [, was] of pairs.filter(([, w]) => w !== '')) assert.ok(!/Coming soon|^\s*(best|max|auto|fast|balanced):|^export const LEVEL_COPY|levelBuildMode|THINKING_DIRECT_STOPS =|THINKING_STOPS =/.test(was), `a rewritten base line is not one of the words or the map: ${was.trim().slice(0, 90)}`)
  assert.equal(base.split('\n').filter(l => l.includes("'Coming soon: runs as Balanced for now.'")).length, 3, 'the three base "coming soon" lines (best, max, comingSoon) are in dev\'s file')
  assert.equal(laterStrips(LIB, texts[LIB]).split('\n').filter(l => l.includes("'Coming soon: runs as Balanced for now.'")).length, 3, 'and they are all still there (the base words are untouched)')
  assert.equal(strip(APP_FILES[0], 5), 5, 'a text that is not a string comes back as it is'); assert.equal(strip('components/builder/message-list.tsx', 'x'), 'x', 'a file this change does not own comes back as it is')
  // the lib's imports are dev's (an older proof pins "one import: the Agent shell's")
  const imports = t => [...t.matchAll(/^import .*$/gm)].map(m => m[0])
  deepEqual(imports(texts[LIB]), imports(baseText(LIB)), 'the lib imports what dev\'s did, nothing more')
  // the marker is a WHOLE token: the level picker's own marker is not this one's, and the other way round
  assert.ok(MARKER_RE.test('// LEVELS-DIRECT-LIVE') && !MARKER_RE.test('// THINKING-LEVELS') && !MARKER_RE.test('// X-LEVELS-DIRECT-LIVE') && !MARKER_RE.test('// LEVELS-DIRECT-LIVEX'), 'the marker is a whole token')
  assert.ok(levelsStrip.THINKING_LEVELS_MARKER_RE.test('// THINKING-LEVELS') && !levelsStrip.THINKING_LEVELS_MARKER_RE.test('// LEVELS-DIRECT-LIVE'), 'and the level picker\'s marker does not match this one')
  // the older proofs this change teaches: each gains one marked line and loses none, and is dev's without it
  for (const rel of PIN_FILES) {
    const now = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), now), gained = PIN_EDITS[rel].length
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's lines the proof is dev's, byte for byte`); assert.equal(strip(rel, strip(rel, now)), baseText(rel), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, gained], `${rel}: the proof gains ${gained} marked line(s) and loses none`)
    for (const line of diff.added) assert.ok(line.includes(PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
    for (const [has, was] of PIN_EDITS[rel]) assert.ok(was === '' && has.includes(PIN_MARK) && has.endsWith('\n') && !has.slice(0, -1).includes('\n'), `${rel}: a pin pair is one marked line and nothing put back`)
    for (const line of diff.added.filter(added => added.includes('fs.readFileSync = '))) assert.ok(line.includes('stripLevelsDirectLive(rel, out)') && !line.includes('stripLaterChanges') && !line.includes('registry.'), `${rel}: a read hook uses this change's own strip, never the registry`)
    for (const line of diff.added.filter(added => added.includes('shas.splice'))) assert.ok(line.includes('^Levels direct live:') && !line.includes('^Replace picture hero only:') && !line.includes('^Thinking levels:'), `${rel}: the splice names this change's own subject, and only that`)
  }
  assert.deepEqual([...PIN_FILES].sort(), ['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs', 'scripts/test-studio-my-companions-wiring.mjs'], 'the older proofs this change teaches: the two that read the first-parent line, and the My companions wiring proof (it holds the levels lib to dev\'s bytes)')
  // the secrets of the added lines
  for (const rel of [...APP_FILES, ...NEW_FILES, ENV, REGISTRY]) assert.doesNotMatch(texts[rel] ?? read(rel), SECRET, `${rel}: no secret`)
}

// ============================================================================================================================================
// G. .env.example and the registry
// ============================================================================================================================================
function envChecks(texts = {}, block = ENV_BLOCK) {
  const env = laterEnv(texts[ENV] ?? read(ENV))
  assert.ok(env.endsWith(`\n${block}`), '.env.example ends with the block')
  assert.equal(env.slice(0, env.length - block.length - 1), baseText(ENV), '.env.example is dev\'s file plus that one blank-line-separated block')
  for (const flag of FLAGS) { assert.equal((env.match(new RegExp(`^${flag}=`, 'gm')) || []).length, 1, `.env.example assigns ${flag} once`); assert.match(block, new RegExp(`^${flag}="false"$`, 'm'), `${flag} is documented as "false"`) }
  assert.ok(block.split('\n').filter(line => line && !line.startsWith('#')).length === 2 && block.split('\n').filter(line => line.startsWith('#')).length >= 4 && block.endsWith(`${ML}="false"\n`), 'the block is comments and one assignment per flag, which end it')
  assert.ok(block.includes(WORDS.best) && block.includes(WORDS.max) && block.includes(WORDS.maxPlan) && block.includes('exact value "true"') && block.includes('default off') && block.includes('Build-time value'), 'the block names the words, the exact value, the default and that it is build-time')
  // the block names ONLY its own flags (an older proof counts flag names in the file): every NEXT_PUBLIC_ name in it is one of the two
  assert.deepEqual([...new Set(block.match(/NEXT_PUBLIC_[A-Z0-9_]+/g) || [])].sort(), [...FLAGS].sort(), 'the block names only its own flags')
  assert.ok(!block.includes(PREVIEW) && !block.includes('NEXT_PUBLIC_STUDIO_V4_SHELL') && !block.includes('NEXT_PUBLIC_AGENT_MODE'), 'it does not name the preview, the shell or the agent flag')
  assert.doesNotMatch(block, LEAK, 'the block says no model, provider, router or price')
  for (const flag of FLAGS) assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes(flag), false, `the registry takes ${flag} out of .env.example`)
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes('STUDIO THINKING LEVELS DIRECT LIVE'), false, 'and its comments with it')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env), registry.stripLaterEnvBlocks(ENV, baseText(ENV)), 'read through the registry it is what the registry makes of dev\'s file')
}
const REG_MARK = '// LATER-CHANGE: FRONTEND-1, wave 1 step 4.1c Best and Max live'
function registryChecks(text = read(REGISTRY)) {
  const lists = { LATER_CHANGE_FILES: 'LEVELS_DIRECT_LIVE_SCOPE_FILES', LATER_ENV_BLOCKS: 'LEVELS_DIRECT_LIVE_ENV_BLOCK', LATER_STRIPS: 'stripLevelsDirectLive' }
  for (const [list, name] of Object.entries(lists)) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n').filter(Boolean), at = rows.findIndex(line => line.includes('studio-levels-direct-live-strip.mjs')), hero = rows.findIndex(line => line.includes('studio-replace-picture-hero-only-strip.mjs'))
    assert.ok(at > 0, `${list}: this change's line is in the list`); assert.ok(at > hero && hero > 0, `${list}: it comes after the hero-only Replace picture's line (the last one before it when this was written; a later change's line may follow)`)
    assert.ok(rows[at].includes(`).${name},`), `${list}: the line reads ${name}`); assert.equal((text.slice(start, end).match(/studio-levels-direct-live-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
    assert.ok(rows[at].includes(REG_MARK) && /(?<![\w-])LATER-CHANGE(?![\w-])/.test(rows[at]), `${list}: the line carries the registry marker`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-levels-direct-live-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines')
  const diff = lineDiff(baseText(REGISTRY), text)
  assert.deepEqual(diff.removed, [], 'and loses none'); assert.ok(registered.every(line => diff.added.includes(line)), 'and the three are among the lines it adds')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the block is registered'); assert.ok([...SCOPE].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  assert.ok(registry.LATER_STRIPS.indexOf(STRIP_FN) > registry.LATER_STRIPS.indexOf(heroOnlyStrip.stripReplacePictureHeroOnly), 'the strip runs after the hero-only Replace picture\'s (the order the changes were stacked)')
  assert.ok(registry.LATER_ENV_BLOCKS.indexOf(ENV_BLOCK) > registry.LATER_ENV_BLOCKS.indexOf(heroOnlyStrip.REPLACE_PICTURE_HERO_ONLY_ENV_BLOCK), 'and its block follows the hero-only Replace picture\'s')
  // an older proof that holds an app file to dev's reads it through the registry: it is dev's
  for (const rel of [...APP_FILES, ...PIN_FILES]) assert.equal(registry.stripLaterChanges(rel, read(rel)), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is dev's (older proofs read it like that)`)
  // the level picker's own strip leaves this change's lines alone, and this strip leaves the level picker's alone, in either order
  for (const rel of [...APP_FILES, PAGE, HOOK, INPUT, CLEAN, ...PIN_FILES]) {
    const now = read(rel), a = STRIP_FN(rel, levelsStrip.stripThinkingLevels(rel, now)), b = levelsStrip.stripThinkingLevels(rel, STRIP_FN(rel, now))
    assert.equal(a, b, `${rel}: the strips commute`)
  }
  assert.ok(levelsStrip.stripThinkingLevels(LIB, read(LIB)).includes('LEVELS-DIRECT-LIVE'), 'the level picker\'s strip leaves this change\'s lib lines alone (it has no entries for the lib)')
}

// ============================================================================================================================================
// H. scope, commits, secrets (the COMMITTED diff only)
// ============================================================================================================================================
const subjectOf = commit => git('log', '-1', '--format=%s', commit)
/** This change's commits: on the first-parent line, by the subject prefix. Once the gate has merged the branch they sit on the merge's second parent and the first-parent line has none of them: then there is nothing of its own to read and the proof says so. */
const ownCommits = (...args) => git('rev-list', '--no-merges', ...args, `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter(commit => subjectOf(commit).startsWith(SUBJECT))
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body) { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line'); return problems }
function commitChecks() {
  const commits = ownCommits('--first-parent')
  if (commits.length === 0) { console.log('NOTE scope: no commit of this change on the first-parent line (merged into dev: its commits are on the second parent); the strip, source and registry checks above cover the files'); return }
  scopeCheck(commits)
  // when every commit on the first-parent line is this change's, the whole net diff against the base is in scope (a stacked branch has others' commits and is read by the commit list above)
  const line = git('rev-list', '--first-parent', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)
  if (line.every(commit => subjectOf(commit).startsWith(SUBJECT))) assert.deepEqual(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter(rel => !SCOPE.has(rel)), [], 'the whole committed diff against the base is in scope (the level picker, the page, the hook and the composer are not edited)')
  for (const commit of commits) {
    assert.deepEqual(messageProblems(subjectOf(commit), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
    assert.doesNotMatch(git('show', '--format=%B', commit), SECRET, `commit ${commit.slice(0, 8)}: no secret in the message or the diff`)
    const added = git('show', '--format=', '-U0', commit).split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')); for (const l of added) assert.doesNotMatch(l, SECRET, `commit ${commit.slice(0, 8)}: no secret in an added line`)
  }
  assert.deepEqual([...touchedFiles(commits)].filter(rel => !registry.LATER_CHANGE_FILES.has(rel)), [], 'every file the commits touch is registered')
}

// ============================================================================================================================================
// I. one literal read each, and only the lib reads them
// ============================================================================================================================================
function oneReadChecks(texts = {}) {
  for (const rel of git('ls-files', 'app', 'hooks', 'components', 'lib', 'middleware.ts', 'next.config.mjs').split('\n').filter(Boolean).filter(f => /\.(ts|tsx|mjs|js)$/.test(f))) {
    const text = texts[rel] ?? read(rel)
    for (const flag of FLAGS) {
      const count = (text.match(new RegExp(`process\\.env\\.${flag}\\b`, 'g')) || []).length
      assert.equal(count, LIB_FLAGS.some(([file, f]) => file === rel && f === flag) ? 1 : 0, `${rel}: reads ${flag} ${rel === LIB ? 'once' : 'not at all'}`)
      assert.equal(text.includes(flag), rel === LIB, `${rel}: ${rel === LIB ? 'names' : 'does not name'} ${flag}`)
    }
  }
  // the lib's whole list of env reads: literal names only, the seven it had plus these two (Next inlines only literal reads)
  const lib = texts[LIB] ?? read(LIB)
  assert.deepEqual([...new Set(lib.match(/process\.env\.[A-Z0-9_]+/g) || [])].sort(), ['process.env.NEXT_PUBLIC_AGENT_MODE', `process.env.${DL}`, 'process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN', `process.env.${ML}`, `process.env.${PREVIEW}`, 'process.env.NEXT_PUBLIC_STUDIO_THINKING_LEVELS', 'process.env.NEXT_PUBLIC_STUDIO_V4_SHELL'].sort(), 'the env names the lib reads')
  assert.equal((lib.match(/process\.env/g) || []).length, 7, 'seven reads: the picker\'s four, the preview, and the two new flags')
  assert.equal(/process\.env\s*\[/.test(lib) || /\.\.\.process\.env/.test(lib) || /\{[^}]*\}\s*=\s*process\.env/.test(lib), false, 'no dynamic read of the env')
}

// ============================================================================================================================================
// J. the wire and the other files
// ============================================================================================================================================
function untouchedChecks(texts = TEXTS) {
  for (const rel of [PAGE, HOOK, PICKER, CSS, INPUT, CLEAN, WIRE, AGENT, 'components/builder/agent-mode/build-mode-picker.tsx']) assert.equal(registry.stripLaterChanges(rel, texts[rel] ?? read(rel)), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: through the registry it is dev's (this change does not edit it)`)
  for (const rel of [PICKER, CSS]) assert.equal(texts[rel] ?? read(rel), baseText(rel), `${rel}: the level picker's component and stylesheet are dev's, byte for byte`)
}
/** The wire is the lib's own map and the page's lines, which are dev's: Best and Max still drive build_mode 'agent', every level its mode. */
function wireChecks(texts = {}) {
  const L = load(LIB, { env: ENV_MAX, texts })
  deepEqual(Object.fromEntries(LEVELS.map(level => [level, L.levelBuildMode(level)])), { auto: 'standard', fast: 'standard', balanced: 'agent', best: 'agent', max: 'agent' }, 'Auto and Fast are Standard; Balanced, Best and Max are the Agent build, live or not')
  deepEqual(LEVELS.map(L.levelNeedsAgent), [false, false, true, true, true], 'the levels that need the Agent build')
  deepEqual(L.THINKING_LEVELS, LEVELS, 'the five levels, in order, for the thinking_level key'); deepEqual(L.THINKING_STOPS, ['fast', 'balanced', 'best', 'max'], 'the scale')
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
let matrixCells = 0, defaultCells = 0, offInfo = null, pickerInfo = null
await check('A. the flags: exact "true" and nothing else; DIRECT_LIVE needs the preview, MAX_LIVE needs DIRECT_LIVE', () => flagChecks())
await check('B. the words and the rules, every combination (preview x DIRECT_LIVE x MAX_LIVE x plan x level), against an independent table', () => { matrixCells = matrixChecks() })
await check('C. the default path: the module\'s flags from the build-time env, a few hundred env combinations, odd values included', () => { defaultCells = defaultPathChecks() })
await check('D. flag off is dev\'s, hashed; with the flags on only Best and Max move', () => { offInfo = flagOffChecks() })
await check('E. the picker (not edited): markup for every state, flag off is dev\'s hashed, the real picker\'s choices and its dragged line', () => { pickerInfo = pickerChecks() })
await check('F. only insertions and the few rewritten base lines (the strip gives dev\'s lib byte for byte); the base words untouched; the older proofs taught', () => insertionChecks())
await check('G1. .env.example: one block at the end, both flags "false", naming only its own flags', () => envChecks(TEXTS))
await check('G2. the registry: three lines after the hero-only Replace picture\'s, each marked LATER-CHANGE; the strips commute', () => registryChecks())
await check('H. own-commit scope by the subject prefix on the first-parent line, committed diff only (a NOTE once merged); the commit message; secrets', () => commitChecks())
await check('I. each flag is read from one literal env name, and only the lib reads them', () => oneReadChecks())
await check('J. the wire (build_mode per level) and the other files are dev\'s: the page, the hook, the picker, the composer, the Agent libs', () => { wireChecks(); untouchedChecks() })

// ---- K. mutants -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const T = { [LIB]: read(LIB), [PAGE]: TEXTS[PAGE], [ENV]: TEXTS[ENV], [REGISTRY]: TEXTS[REGISTRY], [PICKER]: TEXTS[PICKER] }
const M = (rel, from, to) => ({ [rel]: swap(T[rel], from, to) })
const lineOf = (rel, needle) => { const hits = T[rel].split('\n').filter(line => line.includes(needle)); assert.equal(hits.length, 1, `exactly one line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] + '\n' }
/** A mutant of the lib's BEHAVIOUR is fed to the behaviour checks only (so the behaviour checks themselves are what catch it, not the byte-for-byte strip); an edit of the text itself (an import, a read, a line lost or unmarked) to the source checks. */
const behaviour = async texts => { flagChecks(texts); matrixChecks(texts); defaultPathChecks(texts); flagOffChecks(texts); pickerChecks(texts); wireChecks(texts) }
/** The source checks (the strip, the insertions, the reads): for an edit of the text itself. */
const sources = async texts => { insertionChecks({ ...TEXTS, ...texts }); oneReadChecks(texts) }
const L_RULE = lineOf(LIB, "if (level === 'max' && plan === 'pro' && maxIsLive(flags))")
const libMutants = [
  // the flags
  ['lib: DIRECT_LIVE counts without the preview', M(LIB, 'directPreviewOn && live === \'true\'', "live === 'true'")],
  ['lib: DIRECT_LIVE is case-insensitive', M(LIB, 'directPreviewOn && live === \'true\'', "directPreviewOn && live?.toLowerCase() === 'true'")],
  ['lib: DIRECT_LIVE is on for any non-empty value', M(LIB, 'directPreviewOn && live === \'true\'', "directPreviewOn && typeof live === 'string' && live !== ''")],
  ['lib: MAX_LIVE counts without DIRECT_LIVE', M(LIB, 'directLiveOn && live === \'true\'', "live === 'true'")],
  ['lib: MAX_LIVE is case-insensitive', M(LIB, 'directLiveOn && live === \'true\'', "directLiveOn && live?.toLowerCase() === 'true'")],
  ['lib: DIRECT_LIVE is read from another env name', M(LIB, `process.env.${DL}`, `process.env.${DL}_X`)],
  ['lib: MAX_LIVE is read from DIRECT_LIVE\'s name', M(LIB, `process.env.${ML}`, `process.env.${DL}`)],
  ['lib: MAX_LIVE is read from another env name', M(LIB, `process.env.${ML}`, `process.env.${ML}_X`)],
  ['lib: MAX_LIVE stands on the preview, not on DIRECT_LIVE', M(LIB, `process.env.${ML}, STUDIO_THINKING_LEVELS_DIRECT_LIVE)`, `process.env.${ML}, STUDIO_THINKING_LEVELS_DIRECT_PREVIEW)`)],
  ['lib: the module flags drop bestLive', M(LIB, 'direct: STUDIO_THINKING_LEVELS_DIRECT_PREVIEW, bestLive: STUDIO_THINKING_LEVELS_DIRECT_LIVE, maxLive', 'direct: STUDIO_THINKING_LEVELS_DIRECT_PREVIEW, maxLive')],
  ['lib: the module flags drop maxLive', M(LIB, ', maxLive: STUDIO_THINKING_LEVELS_MAX_LIVE } // LEVELS-DIRECT-LIVE', ' } // LEVELS-DIRECT-LIVE')],
  ['lib: the module flags swap the two', M(LIB, 'bestLive: STUDIO_THINKING_LEVELS_DIRECT_LIVE, maxLive: STUDIO_THINKING_LEVELS_MAX_LIVE', 'bestLive: STUDIO_THINKING_LEVELS_MAX_LIVE, maxLive: STUDIO_THINKING_LEVELS_DIRECT_LIVE')],
  ['lib: Best is live without the direct preview (flags handed in)', M(LIB, 'flags.direct && flags.bestLive === true', 'flags.bestLive === true')],
  ['lib: Max is live without Best', M(LIB, 'bestIsLive(flags) && flags.maxLive === true', 'flags.maxLive === true')],
  ['lib: Max is live whenever Best is', M(LIB, 'bestIsLive(flags) && flags.maxLive === true', 'bestIsLive(flags)')],
  ['lib: Best is live whenever the preview is', M(LIB, 'flags.direct && flags.bestLive === true', 'flags.direct')],
  // the words
  ['lib: Best and Max swap their words', M(LIB, "level === 'best' && bestIsLive(flags) ? LEVEL_COPY_LIVE.best : level === 'max' && maxIsLive(flags) ? LEVEL_COPY_LIVE.max", "level === 'best' && bestIsLive(flags) ? LEVEL_COPY_LIVE.max : level === 'max' && maxIsLive(flags) ? LEVEL_COPY_LIVE.best")],
  ['lib: Best\'s words are cut short', M(LIB, "best: 'A deeper build in one pass. Pro and Max plans.'", "best: 'A deeper build.'")],
  ['lib: Max\'s words are reworded', M(LIB, "max: 'Our most thorough build. Max plan only.'", "max: 'Our most thorough build. Max plans only.'")],
  ['lib: the Pro refusal is reworded', M(LIB, "maxPlan: 'Max is on the Max plan.'", "maxPlan: 'Max needs the Max plan.'")],
  ['lib: Best\'s words are the old, longer line (68 characters)', M(LIB, "best: 'A deeper build in one pass. Pro and Max plans.'", "best: 'A deeper build, planned and written in one pass. Pro and Max plans.'")],
  ['lib: Best\'s words are 61 characters', M(LIB, "best: 'A deeper build in one pass. Pro and Max plans.'", `best: '${'A deeper build in one pass. Pro and Max plans.'.padEnd(61, '.')}'`)],
  ['lib: Max\'s words are 61 characters', M(LIB, "max: 'Our most thorough build. Max plan only.'", `max: '${'Our most thorough build. Max plan only.'.padEnd(61, '.')}'`)],
  ['lib: the Pro refusal is 61 characters', M(LIB, "maxPlan: 'Max is on the Max plan.'", `maxPlan: '${'Max is on the Max plan.'.padEnd(61, '.')}'`)],
  ['lib: Best\'s words name a model', M(LIB, "best: 'A deeper build in one pass. Pro and Max plans.'", "best: 'A deeper build with a stronger model, planned and written in one pass. Pro and Max plans.'")],
  ['lib: Max\'s words name a price', M(LIB, "max: 'Our most thorough build. Max plan only.'", "max: 'Our most thorough build. Max plan only, $40.'")],
  ['lib: Best\'s words still say coming soon', M(LIB, "best: 'A deeper build in one pass. Pro and Max plans.'", "best: 'Coming soon: a deeper build. Pro and Max plans.'")],
  ['lib: the base words are edited (best)', M(LIB, "    best: 'Coming soon: runs as Balanced for now.',", "    best: 'Coming soon.',")],
  ['lib: the base words are edited (max)', M(LIB, "    max: 'Coming soon: runs as Balanced for now.',", "    max: 'Coming soon: runs as Balanced.',")],
  ['lib: the base coming-soon note is edited', M(LIB, "  comingSoon: 'Coming soon: runs as Balanced for now.',", "  comingSoon: 'Soon.',")],
  // the Max plan rule
  ['lib: the Max plan rule is dropped', { [LIB]: swap(T[LIB], L_RULE, '') }],
  ['lib: the Max plan rule refuses the Max plan too', M(LIB, "level === 'max' && plan === 'pro' && maxIsLive(flags)", "level === 'max' && plan !== undefined && plan !== null && maxIsLive(flags)")],
  ['lib: the Max plan rule says "the Max plan" to Free and Starter', M(LIB, "level === 'max' && plan === 'pro' && maxIsLive(flags)", "level === 'max' && plan !== 'premium' && maxIsLive(flags)")],
  ['lib: the Max plan rule holds without MAX_LIVE', M(LIB, "level === 'max' && plan === 'pro' && maxIsLive(flags)", "level === 'max' && plan === 'pro'")],
  ['lib: the Max plan rule stands on DIRECT_LIVE alone', M(LIB, "level === 'max' && plan === 'pro' && maxIsLive(flags)", "level === 'max' && plan === 'pro' && bestIsLive(flags)")],
  ['lib: the Max plan rule is on Best', M(LIB, "level === 'max' && plan === 'pro' && maxIsLive(flags)", "level === 'best' && plan === 'pro' && maxIsLive(flags)")],
  ['lib: the Max plan rule runs after the Agent rule (never reached for Pro)', { [LIB]: swap(swap(T[LIB], L_RULE, ''), '  if (!levelNeedsAgent(level) || agentEligible(plan)) return null\n', '  if (!levelNeedsAgent(level) || agentEligible(plan)) return null\n' + L_RULE) }],
  ['lib: the Max plan words are used for an unloaded plan', M(LIB, "level === 'max' && plan === 'pro' && maxIsLive(flags)", "level === 'max' && plan !== 'premium' && plan !== 'free' && plan !== 'starter' && maxIsLive(flags)")],
  // the marks and the stops
  ['lib: a live level is still marked coming soon', M(LIB, ' && liveLine(stop, flags) === null }))', ' }))')],
  ['lib: Max is unmarked as soon as Best is live', M(LIB, 'liveLine(stop, flags) === null', '!bestIsLive(flags)')],
  ['lib: no level is ever marked coming soon', M(LIB, 'comingSoon: THINKING_DIRECT_STOPS.includes(stop) && liveLine(stop, flags) === null', 'comingSoon: false')],
  ['lib: the stops ignore the plan rule for Max (flags not handed on)', M(LIB, 'disabled: levelRefusal(stop, plan, flags) !== null', 'disabled: levelRefusal(stop, plan) !== null')],
  ['lib: a pick ignores the Max plan rule (flags not handed on)', M(LIB, 'if (levelRefusal(level, plan, flags) !== null) return null', 'if (levelRefusal(level, plan) !== null) return null')],
  ['lib: a pick drops the refusal', { [LIB]: swap(T[LIB], '  if (levelRefusal(level, plan, flags) !== null) return null // LEVELS-DIRECT-LIVE: the refusal the scale shows\n', '') }],
  ['lib: the line ignores the live words', M(LIB, '?? liveLine(level, flags) ??', '??')],
  ['lib: the line ignores the refusal flags', M(LIB, 'levelRefusal(level, plan, flags) ?? liveLine', 'levelRefusal(level, plan) ?? liveLine')],
  ['lib: the line takes the live words before the plan\'s reason', M(LIB, 'levelRefusal(level, plan, flags) ?? liveLine(level, flags) ?? LEVEL_COPY.line[level]', 'liveLine(level, flags) ?? levelRefusal(level, plan, flags) ?? LEVEL_COPY.line[level]')],
  ['lib: the view\'s line ignores the flags', M(LIB, 'line: stopLine(shown, plan, flags),', 'line: stopLine(shown, plan),')],
  ['lib: the view\'s spoken text ignores the flags', M(LIB, '${stopLine(shown, plan, flags)}`', '${stopLine(shown, plan)}`')],
  ['lib: the wire: Max no longer drives the Agent build', M(LIB, "(level === 'balanced' || level === 'best' || level === 'max' ? 'agent' : 'standard')", "(level === 'balanced' || level === 'best' ? 'agent' : 'standard')")],
  ['lib: the wire: Best drives the linear build', M(LIB, "(level === 'balanced' || level === 'best' || level === 'max' ? 'agent' : 'standard')", "(level === 'balanced' || level === 'max' ? 'agent' : 'standard')")],
  ['lib: the scale loses Max', M(LIB, "export const THINKING_STOPS: readonly ThinkingStop[] = ['fast', 'balanced', 'best', 'max']", "export const THINKING_STOPS: readonly ThinkingStop[] = ['fast', 'balanced', 'best']")],
  ['lib: Best and Max are always on the scale', M(LIB, 'filter(stop => flags.direct || !THINKING_DIRECT_STOPS.includes(stop))', 'filter(() => true)')],
  ['lib: a new import', M(LIB, "import { AGENT_COPY, agentEligible, type AgentPlan, type BuildMode } from '@/lib/studio-agent-mode'\n", "import { AGENT_COPY, agentEligible, type AgentPlan, type BuildMode } from '@/lib/studio-agent-mode'\nimport { x } from '@/lib/x' // LEVELS-DIRECT-LIVE\n")],
  ['lib: a second read of DIRECT_LIVE', { [LIB]: T[LIB] + `export const again = process.env.${DL} === 'true' // LEVELS-DIRECT-LIVE\n` }],
  ['lib: a dynamic env read', { [LIB]: T[LIB] + "export const dyn = (name: string) => process.env[name] // LEVELS-DIRECT-LIVE\n" }],
  ['lib: an unmarked line is added', { [LIB]: T[LIB] + 'export const extra = 1\n' }],
  ['lib: a base line is lost (a comment)', M(LIB, '/** The scale, quickest first. Best and Max are on it only with the direct preview. */\n', '')],
  ['lib: a base line is lost (code)', M(LIB, "const isLevel = (value: unknown): value is ThinkingLevel => typeof value === 'string' && (THINKING_LEVELS as readonly string[]).includes(value)\n", "const isLevel = (value: unknown): value is ThinkingLevel => true\n")],
  ['lib: a base line is rewritten without a pair', M(LIB, "export const effectiveLevel = (level: ThinkingLevel, mode: BuildMode): ThinkingLevel => (levelBuildMode(level) === mode ? level : 'auto')", "export const effectiveLevel = (level: ThinkingLevel, mode: BuildMode): ThinkingLevel => (levelBuildMode(level) === mode ? level : 'auto') // LEVELS-DIRECT-LIVE")],
  ['lib: a secret', { [LIB]: T[LIB] + `// ${['sk', 'abcdefghijklmnopqrstuvwxyz0123'].join('-')} LEVELS-DIRECT-LIVE\n` }],
]
const SOURCE_MUTANTS = new Set(['lib: a new import', 'lib: a second read of DIRECT_LIVE', 'lib: a dynamic env read', 'lib: an unmarked line is added', 'lib: a base line is lost (a comment)', 'lib: a base line is lost (code)', 'lib: a base line is rewritten without a pair', 'lib: a secret'])
for (const [label, texts] of libMutants) await mutant(label, () => (SOURCE_MUTANTS.has(label) ? sources(texts) : behaviour(texts)))
// the length check ALONE catches a line over the popover's 60 characters (the exact-words checks are not run on these)
await mutant('length: Best\'s words at 61 characters (the length check alone)', () => lengthChecks(M(LIB, "best: 'A deeper build in one pass. Pro and Max plans.'", `best: '${'A deeper build in one pass. Pro and Max plans.'.padEnd(61, '.')}'`)))
await mutant('length: Max\'s words at 61 characters (the length check alone)', () => lengthChecks(M(LIB, "max: 'Our most thorough build. Max plan only.'", `max: '${'Our most thorough build. Max plan only.'.padEnd(61, '.')}'`)))
await mutant('length: the Pro refusal at 61 characters (the length check alone)', () => lengthChecks(M(LIB, "maxPlan: 'Max is on the Max plan.'", `maxPlan: '${'Max is on the Max plan.'.padEnd(61, '.')}'`)))
await mutant('length: Best\'s old 68-character line (the length check alone)', () => lengthChecks(M(LIB, "best: 'A deeper build in one pass. Pro and Max plans.'", "best: 'A deeper build, planned and written in one pass. Pro and Max plans.'")))
// the other files: touching them is caught
await mutant('picker: the component is edited', () => untouchedChecks({ ...TEXTS, [PICKER]: TEXTS[PICKER] + '// LEVELS-DIRECT-LIVE\n' }))
await mutant('page: the Builder page is edited', () => untouchedChecks({ ...TEXTS, [PAGE]: TEXTS[PAGE] + '// LEVELS-DIRECT-LIVE\n' }))
await mutant('hook: the socket hook is edited', () => untouchedChecks({ ...TEXTS, [HOOK]: TEXTS[HOOK] + '// LEVELS-DIRECT-LIVE\n' }))
await mutant('css: the picker\'s stylesheet is edited', () => untouchedChecks({ ...TEXTS, [CSS]: TEXTS[CSS] + '/* LEVELS-DIRECT-LIVE */\n' }))
await mutant('reads: another file reads DIRECT_LIVE', () => oneReadChecks({ [PAGE]: TEXTS[PAGE] + `\nconst x = process.env.${DL}\n` }))
await mutant('reads: another file names MAX_LIVE (in a comment)', () => oneReadChecks({ [HOOK]: TEXTS[HOOK] + `\n// ${ML}\n` }))
// the strips and the insertions
const TX = (rel, from, to) => ({ ...TEXTS, [rel]: swap(TEXTS[rel], from, to) })
await mutant('insertion: the strip forgets a pair', () => insertionChecks(TEXTS, STRIP_FN, { ...EDITS, [LIB]: EDITS[LIB].slice(1) }))
await mutant('insertion: the strip forgets a rewritten line\'s base', () => insertionChecks(TEXTS, STRIP_FN, { ...EDITS, [LIB]: EDITS[LIB].map(([has, was], i) => (was !== '' && i === 4 ? [has, ''] : [has, was])) }))
await mutant('insertion: an inserted line puts back text', () => insertionChecks(TEXTS, STRIP_FN, { ...EDITS, [LIB]: EDITS[LIB].map(([has, was], i) => (i === 0 ? [has, 'x\n'] : [has, was])) }))
await mutant('insertion: a pair is two lines', () => insertionChecks(TEXTS, STRIP_FN, { ...EDITS, [LIB]: [[EDITS[LIB][0][0] + EDITS[LIB][1][0], ''], ...EDITS[LIB].slice(2)] }))
await mutant('insertion: a splice line names the other subject', () => insertionChecks(TX('scripts/test-studio-chat-element-edit.mjs', '!/^Levels direct live:/', '!/^Replace picture hero only:/')))
await mutant('insertion: a splice line is gone from a taught proof', () => insertionChecks({ ...TEXTS, 'scripts/test-studio-deck-sync-truth.mjs': TEXTS['scripts/test-studio-deck-sync-truth.mjs'].split('\n').filter(line => !line.includes('^Levels direct live:')).join('\n') }))
const WIRING = 'scripts/test-studio-my-companions-wiring.mjs'
await mutant('insertion: the My companions proof\'s read hook uses the registry', () => insertionChecks(TX(WIRING, 'stripLevelsDirectLive(rel, out) : out', 'registry.stripLaterChanges(rel, out) : out')))
await mutant('insertion: the My companions proof\'s read hook is gone', () => insertionChecks({ ...TEXTS, [WIRING]: TEXTS[WIRING].split('\n').filter(line => !line.includes('fs.readFileSync = ')).join('\n') }))
await mutant('insertion: the My companions proof\'s import is gone', () => insertionChecks({ ...TEXTS, [WIRING]: TEXTS[WIRING].split('\n').filter(line => !line.includes("from './studio-levels-direct-live-strip.mjs'")).join('\n') }))
await mutant('insertion: the My companions proof loses a base line', () => insertionChecks(TX(WIRING, "const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')\n", '')))
await mutant('insertion: a taught proof loses a base line', () => insertionChecks(TX('scripts/test-studio-chat-element-edit.mjs', "!/^Card reasons:/", "!/^Card reasons/")))
// .env.example
const ownEnvBlock = swap(ENV_BLOCK, 'Build-time value, as above.', 'Build-time value, as above. NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW is the flag it stands on.')
await mutant('env: the block is gone', () => envChecks({ [ENV]: swap(T[ENV], '\n' + ENV_BLOCK, '') }))
await mutant('env: DIRECT_LIVE is documented "true"', () => envChecks({ [ENV]: swap(T[ENV], `${DL}="false"`, `${DL}="true"`) }))
await mutant('env: MAX_LIVE is documented "true"', () => envChecks({ [ENV]: swap(T[ENV], `${ML}="false"`, `${ML}="true"`) }))
await mutant('env: MAX_LIVE is not documented', () => envChecks({ [ENV]: swap(T[ENV], `${ML}="false"\n`, '') }))
await mutant('env: the block is not at the end', () => envChecks({ [ENV]: T[ENV] + 'SOMETHING_ELSE="x"\n' }))
await mutant('env: a second assignment', () => envChecks({ [ENV]: T[ENV] + `${DL}="false"\n` }))
await mutant('env: the block names the preview flag', () => envChecks({ [ENV]: swap(T[ENV], ENV_BLOCK, ownEnvBlock) }, ownEnvBlock))
await mutant('env: the block says a model', () => { const bad = swap(ENV_BLOCK, 'Build-time value, as above.', 'Build-time value, as above. Best runs on a stronger model.'); envChecks({ [ENV]: swap(T[ENV], ENV_BLOCK, bad) }, bad) })
await mutant('env: the block quotes other words', () => { const bad = swap(ENV_BLOCK, WORDS.best, 'A deeper build.'); envChecks({ [ENV]: swap(T[ENV], ENV_BLOCK, bad) }, bad) })
// the registry
const ownLine = name => T[REGISTRY].split('\n').find(line => line.includes('studio-levels-direct-live-strip.mjs') && line.includes(name)) + '\n'
const heroLine = name => T[REGISTRY].split('\n').find(line => line.includes('studio-replace-picture-hero-only-strip.mjs') && line.includes(name)) + '\n'
await mutant('registry: the files line is gone', () => registryChecks(swap(T[REGISTRY], ownLine('LEVELS_DIRECT_LIVE_SCOPE_FILES'), '')))
await mutant('registry: the env line is gone', () => registryChecks(swap(T[REGISTRY], ownLine('LEVELS_DIRECT_LIVE_ENV_BLOCK'), '')))
await mutant('registry: the strip line is gone', () => registryChecks(swap(T[REGISTRY], ownLine('stripLevelsDirectLive'), '')))
await mutant('registry: the strip line has no LATER-CHANGE marker', () => registryChecks(swap(T[REGISTRY], ownLine('stripLevelsDirectLive'), ownLine('stripLevelsDirectLive').replace('LATER-CHANGE', 'LATER'))))
await mutant('registry: the files line sits before the hero-only\'s', () => registryChecks(swap(swap(T[REGISTRY], ownLine('LEVELS_DIRECT_LIVE_SCOPE_FILES'), ''), heroLine('REPLACE_PICTURE_HERO_ONLY_SCOPE_FILES'), ownLine('LEVELS_DIRECT_LIVE_SCOPE_FILES') + heroLine('REPLACE_PICTURE_HERO_ONLY_SCOPE_FILES'))))
await mutant('registry: the strip line sits before the hero-only\'s', () => registryChecks(swap(swap(T[REGISTRY], ownLine('stripLevelsDirectLive'), ''), heroLine('stripReplacePictureHeroOnly'), ownLine('stripLevelsDirectLive') + heroLine('stripReplacePictureHeroOnly'))))
await mutant('registry: a base line is lost', () => registryChecks(swap(T[REGISTRY], heroLine('REPLACE_PICTURE_HERO_ONLY_ENV_BLOCK'), '')))
await mutant('registry: a fourth line', () => registryChecks(swap(T[REGISTRY], '  // one line per later change, above this comment\n])\n\nexport const LATER_ENV_BLOCKS', ownLine('LEVELS_DIRECT_LIVE_SCOPE_FILES').replace('SCOPE_FILES', 'SCOPE_FILES_2') + '  // one line per later change, above this comment\n])\n\nexport const LATER_ENV_BLOCKS')))
// the commits
await mutant('commit: no co-author line', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'a body\n'), []))
await mutant('commit: the wrong subject', () => assert.deepEqual(messageProblems('Replace picture hero only: x', 'a body\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))
await mutant('scope: a stray file', () => { scopeCheck(ownCommits('--first-parent'), ['components/builder/message-list.tsx']) })
await mutant('scope: the level picker\'s component', () => { scopeCheck(ownCommits('--first-parent'), [PICKER]) })
await mutant('scope: the Builder page', () => { scopeCheck(ownCommits('--first-parent'), [PAGE]) })

const verdict = failed.length > 0 || missed.length > 0 ? 1 : passed === 0 ? 1 : 0
console.log(`${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (offInfo) console.log(`flag-off transcripts (dev's lib = this lib, hashed): ${Object.entries(offInfo.digests).map(([name, digest]) => `${name}: sha256 ${digest.slice(0, 16)}`).join('; ')}; ${offInfo.envCount} flag-off env combinations on the default path, digest sha256 ${offInfo.envDigest.slice(0, 16)}`)
if (pickerInfo) console.log(`flag-off picker markup (dev's picker over dev's lib = this picker over this lib): ${pickerInfo.off} renders, digest sha256 ${pickerInfo.offDigest.slice(0, 16)}`)
console.log(`matrix: ${matrixCells} flag-injected cells; ${defaultCells} default-path cells over ${ENV_COMBOS.length} env combinations`)
if (passed === 0 && failed.length === 0) console.error('NO CHECK RAN: 0 checks passed (does CHECK_ONLY match the label of a check?)')
if (failed.length) console.error(`FAILED: ${failed.join(' | ')}`)
if (missed.length) console.error(`MISSED: ${missed.join(' | ')}`)
process.exit(verdict)
