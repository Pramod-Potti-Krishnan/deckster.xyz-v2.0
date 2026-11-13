// FRONTEND-1 (F-13 phone orientation, PR 2 of 2; PK's answers of 1 Nov): proof of the portrait hints, swipe to change slide and Full screen. Flag NEXT_PUBLIC_STUDIO_PHONE_HINTS (exact "true", build-time, default off), only active with PR 1's flag
// (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE) and so with the phone shell. In the portrait slide view: a one-time "Rotate for the best view" card (X, Full screen, Not now; stored per phone in localStorage, in try / catch), a Full screen button above the slide, and swipe
// left / right to change slide (no prev / next arrows) with a one-time swipe hint; in PR 1's landscape stage a Full screen button beside Chat. Full screen asks the browser INSIDE the tap and falls back to a fixed 100dvh stage of our own; never an orientation lock.
//
//   node scripts/test-studio-phone-hints.mjs        (plain node: transpile + vm of the REAL lib, hooks and component, postcss over the REAL stylesheets, no network, no browser; the real page is driven by the harness shots)
//
// What it proves:
//  1. the flag is the exact string "true" AND PR 1's flag AND the phone shell AND the Studio shell (every other spelling of each is off); nothing is attached or drawn with it off;
//  2. the decisions (lib): storage in try / catch (a throwing storage reads as not seen and cannot break a dismiss), when each hint is shown, the Full screen state machine, the swipe's thresholds, direction and edges;
//  3. the hooks: the swipe listens only while it is on (and never with the flag off), turns a drag into the viewer's own next / previous, counts swipes, ignores a cancelled or foreign pointer; Full screen calls requestFullscreen INSIDE the tap before anything is awaited, a refusal
//     (a rejected promise, a throw, no API, fullscreenEnabled false) becomes the fallback stage, the browser's own end is followed, Exit and Escape end our own stage;
//  4. the component: its markup (the Full screen button above the slide, the rotate card with its words, the swipe hint, Exit, the landscape Full screen button) in the states that show each and nowhere else; no prev / next arrows; no orientation lock anywhere;
//  5. the stylesheet (postcss, the REAL file): every rule is inside one of the two phone queries or keyed to an <html> attribute this change sets, no !important, the queries are PR 1's, the swipe lets touches through the frame only while on, our own full-screen stage hides what it must and
//     keeps the top bar and the authoring row laid out, and every rule of PR 1's sheet it must beat is beaten on specificity; PR 1's sheet reads the one custom property this one sets;
//  6. the pins: page and viewer without the marked lines are PR 1's files byte for byte (also through the registry); the marked lines are where they should be and gated on the constant;
//  7. scope over the COMMITTED diff, GATE-SAFE (subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, registry / .env.example / strip reads past a synthetic later change, no hash-object --stdin);  8. mutants are caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'
import {
  BASE_COMMIT, PHONE_HINTS_FILES, PHONE_HINTS_NEW_FILES, PHONE_HINTS_PIN_EDITS, PHONE_HINTS_PIN_FILES, PHONE_HINTS_PIN_MARK, PHONE_HINTS_SCOPE_FILES, PHONE_HINTS_ENV_BLOCK, PHONE_HINTS_MARKER_RE, PHONE_HINTS_SUBJECT, PHONE_HINTS_FLAG, stripPhoneHints,
} from './studio-phone-hints-strip.mjs'
import * as registry from './studio-later-changes.mjs'
import { stripChatParityViewer, CHAT_PARITY_VIEWER_FILES } from './studio-chat-parity-viewer-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (stacked after this change) mark lines in the viewer and the page; this proof reads them as the change before the viewer's left them

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_VIEWER_FILES.includes(rel) ? stripChatParityViewer(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): every read of a file the viewer's change touched is the file without its marked lines (the viewer's own strip, never the registry: this proof's own lines stay visible to its pins)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
/** Every OTHER registered change's strip, in the registry's order (this change's is left out): a file is read as this change left it, whatever other changes marked in it. */
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripPhoneHints), rel, text)

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch { caught++; console.log(`CAUGHT mutant ${label}`) }
}
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }
const count = (text, pattern) => (text.match(pattern) || []).length

// ---- the real sources in a vm ---------------------------------------------------------------------------------------------------------------------
const LIB = 'lib/studio-phone-hints.ts', HOOK = 'hooks/use-studio-phone-hints.ts', COMPONENT = 'components/builder/studio-phone-hints.tsx', CSS = 'components/builder/studio-phone-hints.css'
const PR1_LIB = 'lib/studio-phone-landscape.ts', PR1_CSS = 'components/builder/studio-phone-landscape.css'
const PAGE = 'app/builder/page.tsx', VIEWER = 'components/presentation-viewer.tsx'
const env = {}
const compile = (file, text) => ts.transpileModule(text, { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
const icons = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), ...(props?.['aria-hidden'] ? { 'aria-hidden': 'true' } : {}) })) })
const makeLoader = ({ sourceOverrides = {}, stubs = {}, globals = {}, reactImpl = React } = {}) => {
  const all = { react: reactImpl, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, ...stubs }
  const cache = new Map()
  const resolve = (spec, from) => { const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec); for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return base + suffix; return null }
  const requireFor = (spec, from) => {
    if (spec in all) return all[spec]
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) { const file = resolve(spec, from); assert.ok(file, `unresolved import ${spec} in ${path.relative(root, from)}`); return run(file) }
    throw new Error(`unexpected import ${spec} in ${path.relative(root, from)}`)
  }
  function run(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }; cache.set(file, mod.exports)
    const rel = path.relative(root, file)
    vm.runInNewContext(compile(file, rel in sourceOverrides ? sourceOverrides[rel] : fs.readFileSync(file, 'utf8')), { module: mod, exports: mod.exports, process: { env }, console, require: spec => requireFor(spec, file), ...globals })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return { load: rel => run(path.join(root, rel)) }
}
const KEYS = ['NEXT_PUBLIC_STUDIO_V4_SHELL', 'NEXT_PUBLIC_STUDIO_PHONE_SHELL', 'NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE', PHONE_HINTS_FLAG]
const setFlags = ({ flag, landscape = 'true', phoneShell = 'true', shell = 'true' } = {}) => {
  for (const key of KEYS) delete env[key]
  if (shell !== null) env[KEYS[0]] = shell
  if (phoneShell !== null) env[KEYS[1]] = phoneShell
  if (landscape !== null) env[KEYS[2]] = landscape
  if (flag !== undefined) env[PHONE_HINTS_FLAG] = flag
}
const SPELLINGS = [undefined, null, 'false', 'TRUE', '1', 'true ', ' true', '']
const libWith = (flags, sourceOverrides) => { setFlags(flags); try { return makeLoader({ sourceOverrides }).load(LIB) } finally { setFlags({}) } }
const lib = libWith({ flag: 'true' })
const libOff = libWith({})
const pr1 = (() => { setFlags({}); try { return makeLoader().load(PR1_LIB) } finally { setFlags({}) } })()

// ---- a small hooks runtime (state, refs, callbacks, effects with cleanups, useSyncExternalStore) so the REAL hook file can be driven render by render ---
function hookRuntime() {
  const state = { values: [], index: 0, effects: [], last: [], cleanups: [] }
  const impl = {
    ...React,
    useState: init => { const slot = state.index++; if (!(slot in state.values)) state.values[slot] = typeof init === 'function' ? init() : init; return [state.values[slot], next => { state.values[slot] = typeof next === 'function' ? next(state.values[slot]) : next }] },
    useRef: init => { const slot = state.index++; return state.values[slot] ??= { current: init } },
    useCallback: fn => { state.index++; return fn },
    useEffect: (cb, deps) => { state.effects.push({ slot: state.index++, cb, deps }) },
    useSyncExternalStore: (subscribe, snapshot) => { state.index++; return snapshot() },
  }
  return {
    impl,
    render(fn) {
      state.index = 0; state.effects = []
      const out = fn()
      for (const { slot, cb, deps } of state.effects) {
        const prev = state.last[slot]
        if (!prev || !deps || deps.length !== prev.length || deps.some((dep, i) => !Object.is(dep, prev[i]))) { state.cleanups[slot]?.(); state.last[slot] = deps; const cleanup = cb(); state.cleanups[slot] = typeof cleanup === 'function' ? cleanup : null }
      }
      return out
    },
    unmount() { for (const cleanup of state.cleanups) cleanup?.(); state.cleanups = [] },
  }
}
/** An element (and a document) that records its listeners and fires them. */
const target = () => {
  const handlers = {}
  return { handlers, addEventListener: (type, fn) => { (handlers[type] ??= []).push(fn) }, removeEventListener: (type, fn) => { handlers[type] = (handlers[type] ?? []).filter(x => x !== fn) }, fire: (type, event) => (handlers[type] ?? []).slice().forEach(fn => fn(event)) }
}
/** A touch event on the page: its target is an element that is inside the slide space or not (the swipe only starts from the slide space), `closest` answering as the browser would. */
class FakeElement { constructor(inside) { this.inside = inside } closest(selector) { return this.inside && selector === '[data-studio-slide-space="true"]' ? this : null } }
class FakeKeyboardEvent { constructor(type, init) { this.type = type; Object.assign(this, init) } }
const pointer = (x, y, t, id = 1, inside = true) => ({ clientX: x, clientY: y, timeStamp: t, pointerId: id, target: new FakeElement(inside) })
/** A document that records its listeners and the keys dispatched on its body. */
const swipeDocument = () => { const doc = target(); doc.keys = []; doc.body = { dispatchEvent: event => { doc.keys.push(event.key); return true } }; return doc }
const swipeGlobals = doc => ({ document: doc, Element: FakeElement, KeyboardEvent: FakeKeyboardEvent })

// ---- the stylesheets, parsed --------------------------------------------------------------------------------------------------------------------
const ruleList = text => { const out = []; postcss.parse(text).walkRules(rule => out.push({ selectors: rule.selectors.map(selector => selector.trim()), media: rule.parent?.type === 'atrule' ? rule.parent.params : null, decls: rule.nodes.filter(node => node.type === 'decl').map(node => ({ prop: node.prop, value: node.value, important: node.important })) })); return out }
const cssText = read(CSS), pr1CssText = read(PR1_CSS), shellCssText = read('components/layout/studio-phone-shell.css')
const mine = () => ruleList(cssText)
/** CSS specificity of a selector (a, b, c): ids, classes / attributes / pseudo-classes, types. :has / :is / :not count as their most specific argument, :where as nothing. */
function specificity(selector) {
  let a = 0, b = 0, c = 0, i = 0
  const ident = at => { let j = at; while (j < selector.length && /[\w-]/.test(selector[j])) j++; return j }
  const close = open => { let depth = 0; for (let j = open; j < selector.length; j++) { if (selector[j] === '(') depth++; else if (selector[j] === ')' && --depth === 0) return j } throw new Error(`unbalanced ${selector}`) }
  const top = text => { const parts = []; let depth = 0, from = 0; for (let j = 0; j < text.length; j++) { if (text[j] === '(' || text[j] === '[') depth++; else if (text[j] === ')' || text[j] === ']') depth--; else if (text[j] === ',' && depth === 0) { parts.push(text.slice(from, j)); from = j + 1 } } parts.push(text.slice(from)); return parts }
  while (i < selector.length) {
    const ch = selector[i]
    if (ch === '[') { b++; i = selector.indexOf(']', i) + 1 } else if (ch === '.') { b++; i = ident(i + 1) } else if (ch === '#') { a++; i = ident(i + 1) }
    else if (ch === ':') {
      if (selector[i + 1] === ':') { c++; i = ident(i + 2); continue }
      const end = ident(i + 1), name = selector.slice(i + 1, end)
      if (selector[end] === '(') {
        const stop = close(end), inner = selector.slice(end + 1, stop)
        if (['has', 'is', 'not', 'matches'].includes(name)) { let best = [0, 0, 0]; for (const arg of top(inner)) { const s = specificity(arg); if (s[0] > best[0] || (s[0] === best[0] && (s[1] > best[1] || (s[1] === best[1] && s[2] > best[2])))) best = s } a += best[0]; b += best[1]; c += best[2] }
        else if (name !== 'where') b++
        i = stop + 1
      } else { b++; i = end }
    } else if (/[A-Za-z]/.test(ch)) { c++; i = ident(i) } else i++
  }
  return [a, b, c]
}
const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
const LANDSCAPE_MEDIA = '(orientation: landscape) and (max-height: 500px) and (pointer: coarse)', PORTRAIT_MEDIA = '(max-width: 640px) and (orientation: portrait)'
const OWN_ELEMENTS = ['[data-studio-phone-fullscreen-button', '[data-studio-phone-fullscreen-pill', '[data-studio-phone-rotate-hint', '[data-studio-phone-hint-', '[data-studio-phone-swipe-hint', '[data-studio-phone-exit']
const HTML_KEYS = ['html[data-studio-phone-hints', 'html[data-studio-phone-swipe=', 'html[data-studio-phone-fullscreen=']
const keyed = selector => HTML_KEYS.some(key => selector.includes(key)) || OWN_ELEMENTS.some(own => selector.includes(own))

// ===== 1. the flag =============================================================================================================================================
await check('the flag is the exact string "true" AND PR 1\'s flag AND the phone shell AND the Studio shell: every other spelling of any of the four is off, and the constant follows the four env values', () => {
  assert.equal(lib.studioPhoneHintsOn('true', 'true', 'true', 'true'), true)
  for (const value of SPELLINGS) for (let at = 0; at < 4; at++) {
    const args = ['true', 'true', 'true', 'true']; args[at] = value
    assert.equal(lib.studioPhoneHintsOn(...args), false, `argument ${at} = ${JSON.stringify(value)}`)
  }
  assert.equal(lib.STUDIO_PHONE_HINTS_ENABLED, true); assert.equal(libOff.STUDIO_PHONE_HINTS_ENABLED, false, 'unset: off')
  for (const flags of [{ flag: 'false' }, { flag: 'TRUE' }, { flag: ' true' }, { flag: 'true', landscape: null }, { flag: 'true', landscape: 'false' }, { flag: 'true', phoneShell: null }, { flag: 'true', shell: 'false' }]) assert.equal(libWith(flags).STUDIO_PHONE_HINTS_ENABLED, false, JSON.stringify(flags))
})
await check('with the flag off nothing is attached and nothing is drawn: the swipe hook adds no listener, Full screen follows no fullscreenchange, and the page mounts the component only behind the constant', () => {
  const rt = hookRuntime(), doc = swipeDocument()
  setFlags({}); const off = makeLoader({ reactImpl: rt.impl, globals: { ...swipeGlobals(doc), }, }).load(HOOK); setFlags({})
  Object.assign(doc, { fullscreenEnabled: true, querySelector: () => null })
  rt.render(() => off.useStudioPhoneSwipe(true, 2, 5, () => {})); rt.render(() => off.useStudioPhoneFullscreen())
  assert.deepEqual(Object.keys(doc.handlers), [], 'no listener on the document: no swipe, no fullscreenchange'); assert.deepEqual(doc.keys, [])
  assert.match(read(PAGE), /\{STUDIO_PHONE_HINTS_ENABLED && <StudioPhoneHints /, 'mounted only behind the constant')
})

// ===== 2. the decisions ======================================================================================================================================
const memory = () => { const data = {}; return { data, getItem: key => key in data ? data[key] : null, setItem: (key, value) => { data[key] = String(value) } } }
await check('the hints are stored per phone, in try / catch: "1" under the two exact keys; a storage that throws on read reads as not seen, one that throws on write cannot break a dismiss, no storage at all is the same', () => {
  assert.equal(lib.STUDIO_PHONE_ROTATE_HINT_KEY, 'studio.phoneRotateHint.v1'); assert.equal(lib.STUDIO_PHONE_SWIPE_HINT_KEY, 'studio.phoneSwipeHint.v1')
  const m = memory()
  assert.equal(lib.studioPhoneHintSeen(m, lib.STUDIO_PHONE_ROTATE_HINT_KEY), false); assert.equal(lib.studioPhoneHintRemember(m, lib.STUDIO_PHONE_ROTATE_HINT_KEY), true); assert.deepEqual({ ...m.data }, { 'studio.phoneRotateHint.v1': '1' })
  assert.equal(lib.studioPhoneHintSeen(m, lib.STUDIO_PHONE_ROTATE_HINT_KEY), true); assert.equal(lib.studioPhoneHintSeen(m, lib.STUDIO_PHONE_SWIPE_HINT_KEY), false, 'the two keys are independent')
  m.data[lib.STUDIO_PHONE_SWIPE_HINT_KEY] = '0'; assert.equal(lib.studioPhoneHintSeen(m, lib.STUDIO_PHONE_SWIPE_HINT_KEY), false, 'only "1" is seen')
  const throwing = { getItem() { throw new Error('SecurityError') }, setItem() { throw new Error('QuotaExceededError') } }
  assert.equal(lib.studioPhoneHintSeen(throwing, 'k'), false); assert.equal(lib.studioPhoneHintRemember(throwing, 'k'), false)
  for (const none of [null, undefined]) { assert.equal(lib.studioPhoneHintSeen(none, 'k'), false); assert.equal(lib.studioPhoneHintRemember(none, 'k'), false) }
})
await check('the portrait slide view (this change\'s, moved here from PR 1: the bottom tab bar stays on screen in it) needs all four: the flag, a phone that is not turned sideways, a deck on the stage, the stage on screen; its query is the phone shell\'s own 640 px plus portrait', () => {
  for (let mask = 0; mask < 16; mask++) {
    const [enabled, portrait, deckOnStage, stageVisible] = [0, 1, 2, 3].map(bit => Boolean(mask & (1 << bit)))
    assert.equal(lib.studioPhonePortraitSlideView({ enabled, portrait, deckOnStage, stageVisible }), mask === 15, `slide view ${mask}`)
  }
  assert.equal(lib.studioPhonePortraitSlideView({ enabled: true, portrait: 1, deckOnStage: true, stageVisible: true }), false, 'a truthy non-boolean is not true'); assert.equal(lib.STUDIO_PHONE_PORTRAIT_QUERY, '(max-width: 640px) and (orientation: portrait)')
})
await check('the rotate card is shown only in the portrait slide view with the storage read and not seen, and not in full screen; the swipe hint only where a swipe works, with something to swipe to, until it has been shown once', () => {
  for (const enabled of [true, false]) for (const portraitSlideView of [true, false]) for (const seen of [null, false, true]) for (const fullscreen of ['off', 'native', 'fallback']) {
    assert.equal(lib.studioPhoneRotateHintShown({ enabled, portraitSlideView, seen, fullscreen }), enabled && portraitSlideView && seen === false && fullscreen === 'off', JSON.stringify({ enabled, portraitSlideView, seen, fullscreen }))
  }
  for (const swipeOn of [true, false]) for (const seen of [null, false, true]) for (const slideCount of [0, 1, 2, 12]) assert.equal(lib.studioPhoneSwipeHintShown({ swipeOn, seen, slideCount }), swipeOn && seen === false && slideCount > 1)
})
await check('Full screen: the browser is asked only when it says it can AND the box has requestFullscreen; a refusal and an unsupported browser both become our own stage; the browser\'s end never ends our own stage (only Exit does); Exit ends either', () => {
  for (const fullscreenEnabled of [true, false, undefined, 1, 'true']) for (const hasRequest of [true, false, undefined, 1]) assert.equal(lib.studioPhoneFullscreenCanTry({ fullscreenEnabled, hasRequest }), fullscreenEnabled === true && hasRequest === true)
  const next = lib.studioPhoneFullscreenNext
  assert.equal(next('off', 'unsupported'), 'fallback'); assert.equal(next('off', 'refused'), 'fallback'); assert.equal(next('off', 'granted'), 'native')
  assert.equal(next('native', 'ended'), 'off'); assert.equal(next('fallback', 'ended'), 'fallback', 'a stray fullscreenchange does not end our own stage'); assert.equal(next('off', 'ended'), 'off')
  for (const state of ['off', 'native', 'fallback']) assert.equal(next(state, 'exit'), 'off')
})
await check('the swipe: left is next, right is previous, only when far enough (40 px), quick enough (800 ms) and clearly more across than up or down (1.5 x); nothing past the first or the last slide; garbage in, nothing out', () => {
  const dir = (dx, dy, dt, slide = 3, count = 6) => lib.studioPhoneSwipeDirection({ dx, dy, dt, slide, count })
  assert.deepEqual({ ...lib.STUDIO_PHONE_SWIPE }, { minDistance: 40, maxMilliseconds: 800, horizontalRatio: 1.5 })
  assert.equal(dir(-80, 5, 200), 'next'); assert.equal(dir(80, -5, 200), 'prev'); assert.equal(dir(-40, 0, 100), 'next', '40 px is far enough'); assert.equal(dir(-39, 0, 100), null, '39 is not')
  assert.equal(dir(-80, 0, 800), 'next', '800 ms is quick enough'); assert.equal(dir(-80, 0, 801), null); assert.equal(dir(-90, 60, 200), 'next', '90 across, 60 down: exactly 1.5'); assert.equal(dir(-89, 60, 200), null, 'less than 1.5 x across'); assert.equal(dir(-10, 90, 100), null, 'a scroll')
  assert.equal(dir(-80, 0, 100, 6, 6), null, 'no next after the last'); assert.equal(dir(80, 0, 100, 1, 6), null, 'no previous before the first'); assert.equal(dir(-80, 0, 100, 5, 6), 'next'); assert.equal(dir(80, 0, 100, 2, 6), 'prev')
  for (const bad of [NaN, Infinity, undefined, null]) { assert.equal(dir(bad, 0, 100), null); assert.equal(dir(-80, bad, 100), null); assert.equal(dir(-80, 0, bad), null) }
  for (const enabled of [true, false]) for (const portraitSlideView of [true, false]) for (const fallback of [true, false]) for (const editing of [true, false]) for (const slideCount of [0, 1, 2]) {
    assert.equal(lib.studioPhoneSwipeOn({ enabled, portraitSlideView, fallback, editing, slideCount }), enabled && (portraitSlideView || fallback) && !editing && slideCount > 1)
  }
})

// ===== 3. the hooks ============================================================================================================================================
const hooksWith = (flags, globals = {}, sourceOverrides = {}) => { const rt = hookRuntime(); setFlags(flags); try { return { rt, hook: makeLoader({ reactImpl: rt.impl, globals, sourceOverrides }).load(HOOK) } } finally { setFlags({}) } }
await check('the swipe (flag on): listens on the document only while it is allowed; a quick left drag that starts in the slide space presses the key the viewer listens for to go to the NEXT slide, a right drag the PREVIOUS one, nothing past the ends or from outside the slide space; the page is told after each; a cancelled drag or another pointer\'s release does nothing; the listeners go with it', () => {
  const doc = swipeDocument(), rt = hookRuntime(); setFlags({ flag: 'true' }); const hook = makeLoader({ reactImpl: rt.impl, globals: swipeGlobals(doc) }).load(HOOK); setFlags({})
  const props = { on: false, slide: 3, count: 6 }; let told = 0
  const render = () => rt.render(() => hook.useStudioPhoneSwipe(props.on, props.slide, props.count, () => { told++ }))
  render(); assert.deepEqual(Object.keys(doc.handlers), [], 'not allowed: nothing attached')
  props.on = true; render(); assert.deepEqual(Object.keys(doc.handlers).sort(), ['pointercancel', 'pointerdown', 'pointerup'])
  doc.fire('pointerdown', pointer(300, 400, 1000)); doc.fire('pointerup', pointer(200, 405, 1250)); assert.deepEqual(doc.keys, ['ArrowRight']); assert.equal(told, 1)
  doc.fire('pointerdown', pointer(100, 400, 2000)); doc.fire('pointerup', pointer(220, 395, 2200)); assert.deepEqual(doc.keys, ['ArrowRight', 'ArrowLeft']); assert.equal(told, 2)
  doc.fire('pointerdown', pointer(100, 400, 3000)); doc.fire('pointerup', pointer(110, 400, 3100)); doc.fire('pointerdown', pointer(100, 400, 3200)); doc.fire('pointerup', pointer(300, 700, 3300)); assert.equal(doc.keys.length, 2, 'a tap and a mostly vertical drag change nothing')
  doc.fire('pointerdown', pointer(300, 400, 4000, 7)); doc.fire('pointercancel', {}); doc.fire('pointerup', pointer(100, 400, 4100, 7)); assert.equal(doc.keys.length, 2, 'cancelled')
  doc.fire('pointerdown', pointer(300, 400, 5000, 1)); doc.fire('pointerup', pointer(100, 400, 5100, 2)); assert.equal(doc.keys.length, 2, 'another pointer\'s release'); doc.fire('pointerup', pointer(100, 400, 5150, 1)); assert.equal(doc.keys.length, 3, 'its own release still counts')
  doc.fire('pointerdown', pointer(300, 400, 5500, 1, false)); doc.fire('pointerup', pointer(100, 400, 5600, 1, false)); assert.equal(doc.keys.length, 3, 'a drag that starts outside the slide space (the chat, the rail, the page) is not a swipe')
  props.slide = 6; render(); doc.fire('pointerdown', pointer(300, 400, 6000)); doc.fire('pointerup', pointer(100, 400, 6100)); assert.equal(doc.keys.length, 3, 'on the last slide a left swipe does nothing (the latest slide is read, not the one the effect started with)'); assert.equal(told, 3)
  props.on = false; render(); assert.deepEqual(Object.values(doc.handlers).flat(), [], 'turned off: every listener removed')
  props.on = true; render(); rt.unmount(); assert.deepEqual(Object.values(doc.handlers).flat(), [], 'unmounted: every listener removed')
  assert.match(read(HOOK), /document\.body\.dispatchEvent\(new KeyboardEvent\("keydown", \{ key: SWIPE_KEYS\[direction\], bubbles: true, cancelable: true \}\)\)/); assert.match(read(HOOK), /const SWIPE_KEYS = \{ next: "ArrowRight", prev: "ArrowLeft" \} as const/)
})
const docStub = (over = {}) => { const d = { ...target(), fullscreenEnabled: true, fullscreenElement: null, exits: 0, exitFullscreen() { d.exits++; return Promise.resolve() }, querySelector: () => box, ...over }; return d }
const box = { requestFullscreen: () => Promise.resolve() }
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
await check('Full screen (flag on): requestFullscreen is called INSIDE the tap, before anything is awaited, on the viewer\'s box; granted is the browser\'s; a rejected promise, a throw, no API and fullscreenEnabled false are the fallback stage (and the browser is not asked when it says it cannot); the browser\'s own end is followed; Exit and Escape end our own stage', async () => {
  const run = async ({ request, enabled = true }) => {
    const calls = { n: 0 }; const doc = docStub({ fullscreenEnabled: enabled, querySelector: selector => { assert.equal(selector, lib.STUDIO_PHONE_FULLSCREEN_TARGET); return request === 'missing' ? {} : { requestFullscreen: () => { calls.n++; return request() } } } })
    const { rt, hook } = hooksWith({ flag: 'true' }, { document: doc }); let api = rt.render(() => hook.useStudioPhoneFullscreen()); api.enter(); const inside = calls.n; await settle(); api = rt.render(() => hook.useStudioPhoneFullscreen())
    return { api, inside, calls, doc, rt, hook }
  }
  let r = await run({ request: () => Promise.resolve() }); assert.equal(r.inside, 1, 'asked inside the tap'); assert.equal(r.api.state, 'native')
  r = await run({ request: () => Promise.reject(new Error('NotAllowedError')) }); assert.equal(r.inside, 1); assert.equal(r.api.state, 'fallback', 'a rejected promise')
  r = await run({ request: () => { throw new Error('TypeError') } }); assert.equal(r.api.state, 'fallback', 'a throw')
  r = await run({ request: 'missing' }); assert.equal(r.api.state, 'fallback', 'no requestFullscreen (iPhone Safari)')
  r = await run({ request: () => Promise.resolve(), enabled: false }); assert.equal(r.calls.n, 0, 'the browser says it cannot: not asked'); assert.equal(r.api.state, 'fallback')
  // the browser's own end (Escape, a system gesture) and Exit
  r = await run({ request: () => Promise.resolve() }); r.doc.fire('fullscreenchange', {}); r.api = r.rt.render(() => r.hook.useStudioPhoneFullscreen()); assert.equal(r.api.state, 'off', 'no fullscreen element: the browser ended it')
  r = await run({ request: () => Promise.resolve() }); r.api.exit(); assert.equal(r.doc.exits, 1, 'Exit in the browser\'s full screen asks the browser to leave')
  r = await run({ request: () => Promise.reject(new Error('x')) }); r.doc.fire('fullscreenchange', {}); r.api = r.rt.render(() => r.hook.useStudioPhoneFullscreen()); assert.equal(r.api.state, 'fallback', 'a change event does not end our own stage')
  r.api.exit(); r.api = r.rt.render(() => r.hook.useStudioPhoneFullscreen()); assert.equal(r.api.state, 'off', 'Exit ends our own stage')
  r = await run({ request: () => Promise.reject(new Error('x')) }); r.doc.fire('keydown', { key: 'Enter' }); r.api = r.rt.render(() => r.hook.useStudioPhoneFullscreen()); assert.equal(r.api.state, 'fallback'); r.doc.fire('keydown', { key: 'Escape' }); r.api = r.rt.render(() => r.hook.useStudioPhoneFullscreen()); assert.equal(r.api.state, 'off', 'Escape ends our own stage')
  assert.ok(!/orientation\s*\.\s*lock|screen\.orientation|\.lock\(/.test(read(HOOK)), 'never an orientation lock')
})

// ===== 4. the component ========================================================================================================================================
const stubFor = ({ landscape = false, portrait = false }) => ({ '@/hooks/use-studio-phone-landscape': { useStudioPhoneQuery: query => query === pr1.STUDIO_PHONE_LANDSCAPE_QUERY ? landscape : query === lib.STUDIO_PHONE_PORTRAIT_QUERY ? portrait : false } })
const componentSrc = read(COMPONENT)
/** The first render the server would draw has not read the storage yet (nothing flashes); `seen` forces what the effect would have read, `hint` what the swipe hint's effect would have set, so the markup of each state can be checked. */
const withState = ({ seen, hint = false }) => swap(swap(swap(componentSrc, 'const [rotateSeen, setRotateSeen] = useState<boolean | null>(null)', `const [rotateSeen, setRotateSeen] = useState<boolean | null>(${seen})`), 'const [swipeSeen, setSwipeSeen] = useState<boolean | null>(null)', `const [swipeSeen, setSwipeSeen] = useState<boolean | null>(${seen})`), 'const [swipeHint, setSwipeHint] = useState(false)', `const [swipeHint, setSwipeHint] = useState(${hint})`)
const render = (flags, props = {}, over = {}) => { setFlags({ flag: 'true' }); try { const C = makeLoader({ stubs: stubFor(flags), sourceOverrides: over }).load(COMPONENT).StudioPhoneHints; return renderToStaticMarkup(React.createElement(C, { deckOnStage: true, stageVisible: true, editing: false, slideNumber: 3, slideCount: 6, ...props })) } finally { setFlags({}) } }
await check('portrait slide view: the Full screen button above the slide always; nothing else before the storage is read; the rotate card with PK\'s words (X, Full screen, Not now) when not seen; the swipe hint when it is on; no prev / next arrows', () => {
  const first = render({ portrait: true })
  assert.match(first, /<button type="button" data-studio-phone-fullscreen-pill="true"[^>]*><svg[^>]*><\/svg>Full screen<\/button>/); assert.ok(!/rotate-hint/.test(first), 'nothing flashes before the storage is read'); assert.ok(!/swipe-hint/.test(first)); assert.equal(count(first, /<button/g), 1)
  const card = render({ portrait: true }, {}, { [COMPONENT]: withState({ seen: false }) })
  assert.match(card, /<section data-studio-phone-rotate-hint="true" aria-label="Rotate for the best view"/); assert.match(card, /<h2>Rotate for the best view<\/h2><p>Turn your phone sideways and the slide fills the screen\.<\/p>/)
  assert.match(card, /aria-label="Dismiss"/); assert.match(card, /data-studio-phone-hint-primary="true"[^>]*><svg[^>]*><\/svg>Full screen<\/button>/); assert.match(card, /data-studio-phone-hint-quiet="true">Not now<\/button>/)
  const hint = render({ portrait: true }, {}, { [COMPONENT]: withState({ seen: true, hint: true }) })
  assert.match(hint, /<div data-studio-phone-swipe-hint="true" role="status"><svg[^>]*><\/svg>Swipe to change slide<svg[^>]*><\/svg><\/div>/); assert.ok(!/rotate-hint/.test(hint), 'seen: no card')
  for (const html of [first, card, hint]) assert.ok(!/(Previous|Next|prev|next)/i.test(html.replace(/data-studio-phone-hint-[a-z]+/g, '')), 'no prev / next arrows')
  assert.equal(render({ portrait: true }, { slideCount: 1 }, { [COMPONENT]: withState({ seen: true, hint: true }) }).includes('swipe-hint'), true, 'the hint\'s own flag is what the markup follows (the effect decides when it is set: not with one slide)')
})
/** The rotate card with the slide's box and the bar's top forced (what the client's measuring effect would have set) and a window of this height: where the card is put. */
const cardTop = ({ bottom, barTop }, innerHeight, over = {}) => {
  const html = (() => { setFlags({ flag: 'true' }); try { const C = makeLoader({ stubs: stubFor({ portrait: true }), globals: { window: { innerHeight } }, sourceOverrides: { [COMPONENT]: swap(over[COMPONENT] ?? withState({ seen: false }), 'const [frame, setFrame] = useState<Frame | null>(null)', `const [frame, setFrame] = useState<Frame | null>({ left: 20, top: 120, right: 370, bottom: ${bottom}, barTop: ${barTop === null ? 'null' : barTop} })`) } }).load(COMPONENT).StudioPhoneHints; return renderToStaticMarkup(React.createElement(C, { deckOnStage: true, stageVisible: true, editing: false, slideNumber: 3, slideCount: 6 })) } finally { setFlags({}) } })()
  return Number(/<section data-studio-phone-rotate-hint="true"[^>]*style="top:(\d+)px"/.exec(html)[1])
}
const ROTATE_ROOM = 164, BAR_HEIGHT = 56
const checkCardAboveBar = (top = cardTop) => {
  for (const [vh, frameBottom, bar] of [[844, 563, 788], [844, 700, 788], [844, 700, 754], [667, 470, 611], [640, 430, 584], [640, 600, 550]]) {
    const placed = top({ bottom: frameBottom, barTop: bar }, vh)
    assert.equal(placed, Math.min(frameBottom + 22, Math.max(8, bar - ROTATE_ROOM)), `${vh} / ${frameBottom} / ${bar}`); assert.ok(placed + ROTATE_ROOM <= Math.max(bar, 8 + ROTATE_ROOM), `the card (${ROTATE_ROOM} px of room) is above the bar's top (${bar}): top ${placed}`)
  }
  assert.equal(top({ bottom: 700, barTop: null }, 844), Math.min(722, 844 - BAR_HEIGHT - ROTATE_ROOM), 'no bar on the page: the 56 px of the phone shell\'s own bar is assumed')
}
await check('the rotate card sits below the slide and ABOVE the phone shell\'s bottom tab bar (which stays on screen in portrait): its top is the slide\'s bottom plus a gap, never lower than the bar\'s measured top minus the card\'s room, so a bar taller by a safe-area inset still clears it; the bar is read from the page by the phone shell\'s own marker and followed with the slide\'s box', () => {
  checkCardAboveBar(); assert.match(componentSrc, /const TAB_BAR = "\[data-studio-phone-tabbar\]"/); assert.match(componentSrc, /document\.querySelector\(TAB_BAR\)\?\.getBoundingClientRect\(\)/); assert.match(componentSrc, /current\.barTop === next\.barTop/, 'a bar that moves re-measures')
  assert.match(read('components/layout/studio-phone-tab-bar.tsx'), /data-studio-phone-tabbar="true"/, 'the marker is the bar\'s own')
})
await check('landscape stage: a Full screen button beside Chat, no card, no pill; the stage with nothing on it, the chat or a panel on screen, and a desktop window draw none of it', () => {
  const stage = render({ landscape: true }, {}, { [COMPONENT]: withState({ seen: false }) })
  assert.match(stage, /<button type="button" data-studio-phone-fullscreen-button="true" aria-label="Full screen"><svg[^>]*><\/svg><\/button>/); assert.ok(!/rotate-hint|fullscreen-pill/.test(stage)); assert.equal(count(stage, /<button/g), 1)
  assert.equal(render({ landscape: true }, { deckOnStage: false }), ''); assert.equal(render({ landscape: true }, { stageVisible: false }), ''); assert.equal(render({}), ''); assert.equal(render({ portrait: true }, { stageVisible: false }), ''); assert.equal(render({ portrait: true }, { deckOnStage: false }), '')
})
await check('every attribute the markup and the effects use is one the stylesheet is keyed to; the <html> attributes are the lib\'s constants; the rotate card is stored by X, Not now, Full screen and by being seen sideways; the swipe hint is stored when it first shows; no orientation lock anywhere', () => {
  assert.deepEqual([lib.STUDIO_PHONE_HINTS_ATTRIBUTE, lib.STUDIO_PHONE_FULLSCREEN_ATTRIBUTE, lib.STUDIO_PHONE_SWIPE_ATTRIBUTE].map(String), ['data-studio-phone-hints', 'data-studio-phone-fullscreen', 'data-studio-phone-swipe'])
  for (const own of componentSrc.match(/data-studio-phone-[a-z-]+/g)) assert.ok(cssText.includes(own) || own === 'data-studio-phone-hint-head' || own === 'data-studio-phone-hint-tile' || own === 'data-studio-phone-hint-actions', `${own} is in the stylesheet`)
  assert.match(componentSrc, /onClick=\{\(\) => \{ dismissRotate\(\); enter\(\) \}\}/, 'Full screen from the card stores it and asks the browser inside the same tap'); assert.match(componentSrc, /onClick=\{dismissRotate\}/); assert.match(componentSrc, /useEffect\(\(\) => \{ if \(stage\) dismissRotate\(\) \}, \[stage\]\)/, 'seen sideways')
  assert.match(componentSrc, /studioPhoneHintRemember\(storage\(\), STUDIO_PHONE_SWIPE_HINT_KEY\)/); assert.match(componentSrc, /const storage = \(\): StudioHintStorage \| null => \{ try \{ return window\.localStorage \} catch \{ return null \} \}/, 'reading the property itself is in try / catch too')
  assert.ok(componentSrc.indexOf('setSwipeHint(false) }, [swipes, swipeOn]') < componentSrc.indexOf('if (!swipeShown) return'), 'the hiding effect is declared before the showing one')
  for (const rel of [LIB, HOOK, COMPONENT, CSS]) assert.ok(!/orientation\s*\.\s*lock|screen\.orientation|lockOrientation|\.lock\(/.test(read(rel)), `${rel}: no orientation lock`)
  let hits = ''; try { hits = git('grep', '-n', '-E', 'orientation\\.lock|screen\\.orientation', '--', 'app', 'components', 'hooks', 'lib') } catch { /* none: exit 1 */ }
  assert.equal(hits.trim(), '', 'no orientation lock anywhere in the app')
})

// ===== 5. the stylesheet =========================================================================================================================================
await check('every rule is inside one of the two phone queries or keyed to an <html> attribute this change sets, every selector is keyed, no !important; the queries are PR 1\'s exact text', () => {
  const rules = mine(); assert.ok(rules.length >= 25)
  assert.equal(pr1.STUDIO_PHONE_LANDSCAPE_QUERY, LANDSCAPE_MEDIA); assert.equal(lib.STUDIO_PHONE_PORTRAIT_QUERY, PORTRAIT_MEDIA); assert.ok(!('STUDIO_PHONE_PORTRAIT_QUERY' in pr1), 'PR 1 has no portrait query: the bottom tab bar is the phone shell\'s own there')
  for (const rule of rules) {
    assert.ok(rule.media === null || rule.media === LANDSCAPE_MEDIA || rule.media === PORTRAIT_MEDIA, `an unknown query: ${rule.media}`)
    for (const selector of rule.selectors) { assert.ok(keyed(selector), `keyed: ${selector.slice(0, 100)}`); if (rule.media === null) assert.ok(HTML_KEYS.some(key => selector.includes(key)), `outside the queries only html-keyed: ${selector.slice(0, 100)}`) }
    for (const decl of rule.decls) assert.ok(!decl.important, `${decl.prop} is not !important`)
  }
  assert.ok(!/!important/.test(cssText))
})
const checkSafeArea = text => {
  const rules = ruleList(text)
  const decl = (test, prop) => rules.find(rule => rule.selectors.some(test) && rule.decls.some(d => d.prop === prop))?.decls.find(d => d.prop === prop)?.value
  assert.equal(decl(s => s === '[data-studio-phone-fullscreen-button="true"]', 'top'), 'calc(8px + env(safe-area-inset-top, 0px))'); assert.equal(decl(s => s === '[data-studio-phone-fullscreen-button="true"]', 'right'), 'calc(8px + env(safe-area-inset-right, 0px))')
  assert.equal(decl(s => s.endsWith('[data-studio-phone-exit="true"]'), 'top'), 'calc(8px + env(safe-area-inset-top, 0px))'); assert.equal(decl(s => s.endsWith('[data-studio-phone-exit="true"]'), 'right'), 'calc(8px + env(safe-area-inset-right, 0px))')
  assert.equal(decl(s => s === 'html[data-studio-phone-hints]', '--studio-phone-controls-right'), '46px', '8 + 30 + 8: Chat sits one gap left of the Full screen button, both inside the same safe area')
}
await check('the landscape Full screen button and our own stage\'s Exit button are inside the screen\'s safe area (top and right), like PR 1\'s Chat, which sits one gap to their left', () => checkSafeArea(cssText))
await check('the swipe: the slide space takes horizontal touches (touch-action: pan-y) and the slide\'s frame lets them through (pointer-events: none), only under the swipe attribute "on"; no prev / next arrow is drawn or unhidden', () => {
  const rules = mine().filter(rule => rule.media === null && rule.selectors.some(s => s.startsWith('html[data-studio-phone-swipe="on"]')))
  assert.equal(rules.length, 2)
  assert.equal(rules.find(rule => rule.selectors[0].endsWith('[data-studio-slide-space]')).decls.find(decl => decl.prop === 'touch-action').value, 'pan-y'); assert.equal(rules.find(rule => rule.selectors[0].endsWith('iframe')).decls.find(decl => decl.prop === 'pointer-events').value, 'none')
  assert.ok(!mine().some(rule => rule.selectors.some(selector => /(arrow|prev|next)/i.test(selector))), 'no arrow, previous or next control is styled (the comments are not rules)')
})
await check('our own full-screen stage hides what it must (rail, tab bar, switch, pull tabs, notes, brand row, the thumbnails and their toggle, PR 1\'s controls, fan, strip and Menu, this change\'s own buttons), fills 100dvh, keeps the top bar and the authoring row LAID OUT and invisible, and shows one Exit button above the dialogs', () => {
  const fall = mine().filter(rule => rule.selectors.some(s => s.startsWith('html[data-studio-phone-fullscreen="fallback"]')))
  const declared = (test, prop) => fall.find(rule => rule.selectors.some(test) && rule.decls.some(decl => decl.prop === prop))?.decls.find(decl => decl.prop === prop)?.value
  assert.equal(declared(s => s.endsWith('[data-studio-v4-shell="true"]'), 'height'), '100dvh'); assert.equal(declared(s => s.endsWith('> [data-studio-v4-rail]'), 'display'), 'none'); assert.equal(declared(s => s.endsWith('> [data-studio-phone-tabbar="true"]'), 'display'), 'none')
  const hideApp = fall.find(rule => rule.decls.some(decl => decl.prop === 'display' && decl.value === 'none') && rule.selectors.some(s => s.includes('[data-studio-workspace-switch]')))
  for (const part of ['[data-studio-workspace-switch]', '[data-studio-drawer-handle]', '[data-studio-notes-handle]', '[data-studio-canvas-brand]', '[data-studio-v4-thumbnail-toggle]', '[data-studio-v4-thumbnail-resize]', '[data-studio-v4-thumbnails]']) assert.ok(hideApp.selectors[0].includes(part), part)
  const hideOwn = fall.find(rule => rule.decls.some(decl => decl.prop === 'display' && decl.value === 'none') && rule.selectors.some(s => s.includes('[data-studio-phone-controls="true"]')))
  for (const part of ['[data-studio-phone-controls="true"]', '[data-studio-phone-dock="true"]', '[data-studio-phone-fan-card="true"]', '[data-studio-phone-nav-card="true"]', '[data-studio-phone-menu-backdrop="true"]', '[data-studio-phone-strip-head="true"]', '[data-studio-phone-strip-handle="true"]', '[data-studio-phone-fullscreen-button="true"]', '[data-studio-phone-fullscreen-pill="true"]']) assert.ok(hideOwn.selectors[0].includes(part), part)
  const lay = fall.find(rule => rule.selectors.some(s => s.includes('[data-studio-v4-shell-header]')) && rule.selectors.some(s => s.includes('[data-studio-authoring-slot]'))); const value = prop => lay.decls.find(decl => decl.prop === prop)?.value
  assert.equal(value('position'), 'fixed'); assert.equal(value('visibility'), 'hidden'); assert.ok(!lay.decls.some(decl => decl.prop === 'display'), 'laid out, never display: none')
  assert.equal(declared(s => s.endsWith('[data-studio-slide-space="true"]'), 'background'), '#000'); assert.equal(declared(s => s.endsWith('[data-studio-slide-space="true"]'), 'padding'), '0'); assert.equal(declared(s => s.endsWith('[data-studio-v4-viewer]:not([data-studio-v4-fullscreen="true"])'), 'padding-left'), '0'); assert.equal(declared(s => s.endsWith('[data-studio-phone-exit="true"]'), 'z-index'), '70')
  const zs = mine().flatMap(rule => rule.decls.filter(decl => decl.prop === 'z-index').map(decl => ({ z: Number(decl.value), sel: rule.selectors[0] })))
  for (const { z, sel } of zs) { if (!sel.includes('exit')) assert.ok(z <= 44, `${sel.slice(0, 70)}: z-index ${z} stays under the dialogs (50) and the bar (45)`) }
})
await check('cascade: every rule of this change that hides an element PR 1\'s sheet gives a display (its controls, the strip, the fan) is MORE specific than PR 1\'s rule, so it wins whatever the order, with no !important; PR 1\'s sheet reads the one custom property this change sets', () => {
  const theirs = ruleList(pr1CssText).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))).filter(rule => rule.decls.some(decl => decl.prop === 'display'))
  const hide = mine().find(rule => rule.decls.some(decl => decl.prop === 'display' && decl.value === 'none') && rule.selectors.some(s => s.includes('[data-studio-phone-controls="true"]'))).selectors[0]
  const parts = ['[data-studio-phone-controls="true"]', '[data-studio-phone-dock="true"]', '[data-studio-phone-fan-card="true"]', '[data-studio-phone-nav-card="true"]', '[data-studio-phone-strip-head="true"]', '[data-studio-phone-strip-handle="true"]']
  let compared = 0
  for (const part of parts) for (const other of theirs.filter(rule => rule.selector.includes(part) || rule.selector === part)) { assert.ok(cmp(specificity(hide), specificity(other.selector)) > 0, `${part}: ${specificity(hide)} beats ${specificity(other.selector)}`); compared++ }
  assert.ok(compared >= 4, `compared ${compared}`)
  const sets = mine().find(rule => rule.decls.some(decl => decl.prop === '--studio-phone-controls-right')); assert.equal(sets.media, LANDSCAPE_MEDIA); assert.equal(sets.selectors[0], 'html[data-studio-phone-hints]'); assert.equal(sets.decls.find(decl => decl.prop === '--studio-phone-controls-right').value, '46px')
  assert.match(pr1CssText, /right: calc\(var\(--studio-phone-controls-right, 8px\) \+ env\(safe-area-inset-right, 0px\)\)/, 'PR 1\'s Chat button reads it, with its own 8 px default, inside the right safe area')
})

const fallbackCascade = text => {
  const shellCss = ruleList(shellCssText).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))).filter(rule => rule.selector.endsWith('> [data-studio-v4-shell-workspace]') && rule.decls.some(decl => decl.prop === 'margin-left'))
  const margin = ruleList(text).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))).filter(rule => rule.selector.startsWith('html[data-studio-phone-fullscreen="fallback"]') && rule.selector.endsWith('> [data-studio-v4-shell-workspace]') && rule.decls.some(decl => decl.prop === 'margin-left'))
  assert.ok(shellCss.length >= 1 && margin.length >= 1, 'the phone shell\'s 10 px workspace margin and the stage\'s rule for it'); for (const a of margin) for (const b of shellCss) assert.ok(cmp(specificity(a.selector), specificity(b.selector)) > 0, `workspace margin-left: ours ${specificity(a.selector)} beats ${specificity(b.selector)}`)
  const rulesOf = rel => ruleList(read(rel)).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls })))
  const ours = ruleList(text).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))).filter(rule => rule.selector.startsWith('html[data-studio-phone-fullscreen="fallback"]'))
  const mineSpace = ours.find(rule => rule.selector.endsWith('[data-studio-slide-space="true"]') && rule.decls.some(decl => decl.prop === 'background')), mineViewer = ours.find(rule => rule.selector.endsWith('[data-studio-v4-viewer]:not([data-studio-v4-fullscreen="true"])') && rule.decls.some(decl => decl.prop === 'padding-left'))
  const against = (mineRule, sheets, element, prop) => { let n = 0; for (const rel of sheets) for (const other of rulesOf(rel)) if (other.selector.includes(element) && other.selector.endsWith(element === '[data-studio-slide-space="true"]' ? element : '[data-studio-v4-viewer]') && other.decls.some(decl => decl.prop === prop)) { assert.ok(cmp(specificity(mineRule.selector), specificity(other.selector)) > 0, `${prop}: ours ${specificity(mineRule.selector)} beats ${specificity(other.selector)} (${rel})`); n++ } return n }
  assert.ok(against(mineSpace, ['components/builder/studio-canvas.css'], '[data-studio-slide-space="true"]', 'background') >= 1, 'the canvas sheet\'s surface is compared')
  const collapsed = ruleList(pr1CssText).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))).filter(rule => rule.decls.some(decl => decl.prop === 'padding-left')); assert.ok(collapsed.length >= 1)
  for (const other of collapsed) assert.ok(cmp(specificity(mineViewer.selector), specificity(other.selector)) > 0, `PR 1's collapsed-strip padding ${specificity(other.selector)} is beaten by ${specificity(mineViewer.selector)}`)
}
await check('cascade: the full-screen stage\'s black slide space and its viewer padding are MORE specific than the canvas sheet\'s neutral surface and than PR 1\'s collapsed-strip padding, so they win whatever the order', () => fallbackCascade(cssText))

// ===== 6. the pins ================================================================================================================================================
await check('the Builder page without this change\'s lines is PR 1\'s page byte for byte, also through the registry, and twice changes nothing more; a file it does not own comes back as it is', () => {
  for (const rel of PHONE_HINTS_FILES) {
    const now = read(rel), base = baseText(rel)
    assert.notEqual(now, base); assert.equal(stripPhoneHints(rel, otherStrips(rel, now)), otherStrips(rel, base), rel)
    assert.equal(stripPhoneHints(rel, stripPhoneHints(rel, now)), stripPhoneHints(rel, now)); assert.equal(registry.stripLaterChanges(rel, now), registry.stripLaterChanges(rel, base), `${rel} through the registry`)
  }
  assert.equal(stripPhoneHints('lib/anything.ts', 'x'), 'x'); assert.equal(stripPhoneHints(PAGE, 5), 5)
})
await check('the marked lines are where they should be: the page has two imports and one line of JSX (after PR 1\'s), every one names the marker as a whole token and none names PR 1\'s (neither strip can take out the other\'s lines); the viewer is not touched at all and still answers the key the swipe presses', () => {
  const page = read(PAGE), viewer = read(VIEWER)
  assert.equal(count(page, /^.*PHONE-HINTS.*$/gm), 3); assert.equal(count(viewer, /PHONE-HINTS/g), 0)
  for (const line of page.split('\n').filter(line => /PHONE-HINTS/.test(line))) assert.match(line, PHONE_HINTS_MARKER_RE)
  assert.match(page, /\{STUDIO_PHONE_HINTS_ENABLED && <StudioPhoneHints deckOnStage=\{Boolean\(effectivePresentationUrl\) && !studioWelcome && !session\.isLoadingSession\} stageVisible=\{studioOverlayWorkspace && !studioCanvasCovered\} editing=\{studioViewerEditing\} slideNumber=\{currentSlideIndex \+ 1\} slideCount=\{effectiveSlideCount \?\? 0\} \/>\}/)
  assert.ok(page.indexOf('<StudioPhoneLandscape ') < page.indexOf('<StudioPhoneHints '), 'after PR 1\'s line')
  for (const line of page.split('\n').filter(line => PHONE_HINTS_MARKER_RE.test(line))) assert.ok(!/(?<![\w-])PHONE-LANDSCAPE(?![\w-])/.test(line), `a PHONE-HINTS line must not name PR 1's marker (its strip would take this line out too): ${line.slice(0, 100)}`)
  assert.equal(viewer, baseText(VIEWER), 'the viewer is PR 1\'s (the base\'s), byte for byte')
  assert.match(viewer, /window\.addEventListener\('keydown', handleKeyDown\)/); assert.match(viewer, /case 'ArrowRight':\n        case 'ArrowDown':\n          e\.preventDefault\(\)\n          handleNextSlide\(\)/); assert.match(viewer, /case 'ArrowLeft':\n        case 'ArrowUp':\n          e\.preventDefault\(\)\n          handlePrevSlide\(\)/)
  assert.match(viewer, /if \(studioShell && !shouldHandleStudioCanvasShortcut\(e\)\) return/, 'the viewer\'s own guard (a panel over the canvas, a dialog) applies to a swipe too')
})

// ===== 7. scope =====================================================================================================================================================
console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-01T00:00:00Z' }
const plumb = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...(input === undefined ? {} : { input }), env: { ...process.env, ...GIT_IDENT }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wph-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(PHONE_HINTS_SUBJECT)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  The branch tip must be an ORDINARY commit (one parent), never itself a dev-first two-parent merge. On a branch (HEAD is this change's tip, or a merge of dev INTO it) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const REAL = { norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const normDiff = (ctx, rel, head) => git('diff', '-U0', blobOf(ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`))))
const OLDER_PREFIXES = /^(Phone landscape:|Stage open gate:|Chat column wide:|Welcome trim:|Director mark trim:|Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:|Text set keep look:|Structural refine decline:)/
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), OLDER_PREFIXES, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  // a file an own commit touched and a later own commit put back (the viewer, which an earlier version of this change edited) has no net change: it is not this change's file
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  for (const rel of [...touched]) if (!PHONE_HINTS_SCOPE_FILES.has(rel) && (() => { try { return registry.stripLaterChanges(rel, git('show', `${head}:${rel}`)) === registry.stripLaterChanges(rel, git('show', `${BASE_COMMIT}:${rel}`)) } catch { return false } })()) touched.delete(rel) // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): a file this change did not take (the viewer) that a later change marks is touched by no net change of this one's once every registered change strips its own lines; any other foreign file still counts
  assert.deepEqual([...touched].sort(), [...PHONE_HINTS_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  for (const rel of PHONE_HINTS_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) {
      assert.ok(!line.startsWith('-'), `${rel}: a removed line (this change only inserts): ${line.slice(0, 120)}`)
      assert.match(line, PHONE_HINTS_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`)
    }
    assert.ok(diff.filter(line => line.startsWith('+')).length > 0, `${rel}: the number of added lines`)
    assert.equal(stripPhoneHints(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of PHONE_HINTS_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of PHONE_HINTS_PIN_FILES) {
    const now = git('show', `${head}:${rel}`), base = git('show', `${BASE_COMMIT}:${rel}`)
    assert.equal(stripPhoneHints(rel, otherStrips(rel, now)), otherStrips(rel, base), `${rel}: an older proof taught one more line; putting it back (past the changes registered after this one) gives PR 1's proof byte for byte`)
    assert.equal(stripPhoneHints(rel, stripPhoneHints(rel, otherStrips(rel, now))), otherStrips(rel, base), `${rel}: putting back twice changes nothing more`)
    for (const [has, was] of PHONE_HINTS_PIN_EDITS[rel]) { assert.equal(now.split(has).length - 1, 1, `${rel}: the taught line is there exactly once`); assert.equal(was, '', `${rel}: a pure insertion`); for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(PHONE_HINTS_PIN_MARK), `${rel}: the taught line carries the registry-read mark`) }
    const added = diffLines(normDiff(ctx, rel, head)); assert.ok(added.length >= 1 && added.every(line => line.startsWith('+') && line.includes(PHONE_HINTS_PIN_MARK)), `${rel}: every line this change added to the proof carries the mark and none is removed`)
  }
  for (const rel of ['components/presentation-viewer.tsx', 'components/builder/studio-phone-landscape.tsx', 'components/builder/studio-phone-landscape.css', 'lib/studio-phone-landscape.ts', 'hooks/use-studio-phone-landscape.ts', 'scripts/studio-phone-landscape-strip.mjs', 'scripts/test-studio-phone-landscape.mjs', 'components/layout/studio-phone-tab-bar.tsx',
    'components/layout/studio-phone-shell.css', 'components/slide-thumbnail-strip.tsx', 'app/layout.tsx', 'components/builder/presentation-area.tsx', 'hooks/use-deckster-websocket-v2.ts', 'package.json']) assert.ok(!touched.has(rel), `${rel} is not touched by this change (PR 1's files stay as PR 1 made them)`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const envText = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(envText), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(envText.split(PHONE_HINTS_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(envText, new RegExp(`\\n\\n${PHONE_HINTS_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes('studio-phone-hints-strip.mjs'))
  assert.equal(own.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['PHONE_HINTS_SCOPE_FILES', 'PHONE_HINTS_ENV_BLOCK', 'stripPhoneHints'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${PHONE_HINTS_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to an existing file is a pure insertion that carries the marker (the two pinned lines aside); the strip gives the base back byte for byte; the phone shell\'s own files, the rail strip and the layout allocator are not touched', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of PHONE_HINTS_NEW_FILES.filter(rel => !rel.endsWith('.css'))) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of PHONE_HINTS_FILES) assert.equal(stripPhoneHints(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await check('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wph-idx-'))
  try {
    const envIdx = { ...process.env, ...GIT_IDENT, GIT_INDEX_FILE: path.join(dir, 'index') }
    const viaIndex = (...a) => execFileSync('git', a, { cwd: root, env: envIdx, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim()
    viaIndex('read-tree', parent)
    for (const [rel, text] of Object.entries(edits)) viaIndex('update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`)
    return plumb(['commit-tree', viaIndex('write-tree'), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await check('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE (an unrelated commit): the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
// a SYNTHETIC change stacked after this one: marked lines in the page and the viewer (next to this change's own), a registry trio below this change's, an .env.example block, a new file
const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
const syntheticStrip = (rel, text) => PHONE_HINTS_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const edits = {}
  for (const rel of PHONE_HINTS_FILES) {
    const lines = at(rel).split('\n'); let done = false
    edits[rel] = lines.flatMap(line => { if (!done && PHONE_HINTS_MARKER_RE.test(line) && line.startsWith('import ')) { done = true; return [line, `const syntheticLater = 1 // ${SYN.marker}`] } return [line] }).join('\n')
    assert.ok(edits[rel].includes(SYN.marker), `the synthetic anchor exists in ${rel}`)
  }
  edits['scripts/studio-later-changes.mjs'] = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('PHONE_HINTS_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('PHONE_HINTS_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripPhoneHints')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  edits['.env.example'] = `${at('.env.example')}\n${SYN.block}`
  edits[SYN.file] = 'export const SYNTHETIC_SCOPE_FILES = new Set()\n'
  return commitWith(parent, edits, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC = syntheticCommit(HEAD)
const SYN_CTX = {
  norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)),
  env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''),
}
await check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked lines beside this change\'s in the page and the viewer, a registry trio, an .env.example block, a new file; its own commit has another subject) leaves this change\'s scope section passing, on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  assert.ok(ownOf(SYNTHETIC).length === ownOf(HEAD).length && !ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  for (const rel of PHONE_HINTS_FILES) assert.equal(stripPhoneHints(rel, SYN_CTX.norm(rel, git('show', `${gate}:${rel}`))), SYN_CTX.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree is the base's ${rel} without this change's and the later change's lines`)
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
  for (const rel of PHONE_HINTS_FILES) assert.equal(stripPhoneHints(rel, syntheticStrip(rel, otherStrips(rel, git('show', `${SYNTHETIC}:${rel}`)))), otherStrips(rel, baseText(rel)), `${rel}: either order of the two strips gives the base (read past the changes registered after this one, as every other check here does)`)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its lines are unmarked additions, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray foreign file in a "Phone hints:" commit fails the committed-files check (own commits found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-phone-hints.txt': 'stray\n' }, `${PHONE_HINTS_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, an unmarked line added to the page or the viewer in an own commit, and a touched foreign file (PR 1\'s component, the phone shell\'s bar), fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${PHONE_HINTS_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of PHONE_HINTS_FILES) {
    const sneaky = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`).replace('\nexport ', '\nconst sneaky = 1\nexport ').replace(/^(import [^\n]*\n)/m, '$1const sneaky = 1\n') }, `${PHONE_HINTS_SUBJECT} a sneaky line${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/, rel)
  }
  for (const rel of ['components/builder/studio-phone-landscape.tsx', 'components/layout/studio-phone-tab-bar.tsx']) {
    const foreign = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`) + '\n' }, `${PHONE_HINTS_SUBJECT} touches ${rel}${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched/, rel)
  }
})


// ===== 8. mutants (each one edit of the real sources, fed to the same checks) =============================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const libSrc = read(LIB), hookSrc = read(HOOK), pageSrc = read(PAGE)
const sheetKeyed = text => { for (const rule of ruleList(text)) for (const selector of rule.selectors) assert.ok(keyed(selector), selector.slice(0, 80)) }
const fullscreenWith = async (over, request, { enabled = true } = {}) => { const doc = docStub({ fullscreenEnabled: enabled, querySelector: () => ({ requestFullscreen: request }) }); const { rt, hook } = hooksWith({ flag: 'true' }, { document: doc }, over); let api = rt.render(() => hook.useStudioPhoneFullscreen()); api.enter(); await settle(); api = rt.render(() => hook.useStudioPhoneFullscreen()); return { api, doc, rt, hook } }
await mutant('the flag is read as truthy, not exactly "true"', () => assert.equal(libWith({ flag: 'false' }, { [LIB]: swap(libSrc, "flag === 'true' && landscape", "flag !== undefined && landscape") }).STUDIO_PHONE_HINTS_ENABLED, false))
await mutant('the flag no longer needs PR 1\'s flag', () => assert.equal(libWith({ flag: 'true', landscape: 'false' }, { [LIB]: swap(libSrc, " && landscape === 'true'", '') }).STUDIO_PHONE_HINTS_ENABLED, false))
await mutant('the flag no longer needs the phone shell', () => assert.equal(libWith({ flag: 'true', phoneShell: 'false' }, { [LIB]: swap(libSrc, " && phoneShell === 'true'", '') }).STUDIO_PHONE_HINTS_ENABLED, false))
await mutant('the rotate card\'s storage key changes (a phone that dismissed it would see it again)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "'studio.phoneRotateHint.v1'", "'studio.phoneRotateHint.v2'") }).STUDIO_PHONE_ROTATE_HINT_KEY, 'studio.phoneRotateHint.v1'))
await mutant('the storage read is not in try / catch (Safari private mode would break the page)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, 'try { return storage ? storage.getItem(key) === \'1\' : false } catch { return false }', 'return storage ? storage.getItem(key) === \'1\' : false') }).studioPhoneHintSeen({ getItem() { throw new Error('x') } }, 'k'), false))
await mutant('the storage write is not in try / catch (a dismiss would throw)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "try { if (!storage) return false; storage.setItem(key, '1'); return true } catch { return false }", "if (!storage) return false; storage.setItem(key, '1'); return true") }).studioPhoneHintRemember({ setItem() { throw new Error('x') } }, 'k'), false))
await mutant('the rotate card is shown before the storage is read (it would flash for a phone that dismissed it)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, 'input.seen === false && input.fullscreen', 'input.seen !== true && input.fullscreen') }).studioPhoneRotateHintShown({ enabled: true, portraitSlideView: true, seen: null, fullscreen: 'off' }), false))
await mutant('the portrait slide view needs no deck on the stage (the welcome would be a slide view)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, ' && input.deckOnStage === true && input.stageVisible === true\n}\n\n/** What is asked of the browser', ' && input.stageVisible === true\n}\n\n/** What is asked of the browser') }).studioPhonePortraitSlideView({ enabled: true, portrait: true, deckOnStage: false, stageVisible: true }), false))
await mutant('the portrait slide view is on for a phone turned sideways too', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, 'return input.enabled === true && input.portrait === true && input.deckOnStage', 'return input.enabled === true && input.deckOnStage') }).studioPhonePortraitSlideView({ enabled: true, portrait: false, deckOnStage: true, stageVisible: true }), false))
await mutant('the rotate card ignores the bar (the old window-height clamp: a bar taller by a safe-area inset would cover it)', () => checkCardAboveBar((frame, vh) => cardTop(frame, vh, { [COMPONENT]: swap(withState({ seen: false }), '(frame.barTop ?? window.innerHeight - BAR_HEIGHT) - ROTATE_CARD_ROOM', 'window.innerHeight - 220') })))
await mutant('the rotate card is put at the slide\'s bottom whatever the bar (no clamp)', () => checkCardAboveBar((frame, vh) => cardTop(frame, vh, { [COMPONENT]: swap(withState({ seen: false }), 'Math.min(frame.bottom + 22, Math.max(8, (frame.barTop ?? window.innerHeight - BAR_HEIGHT) - ROTATE_CARD_ROOM))', 'frame.bottom + 22') })))
await mutant('the bar is not re-measured when it moves', () => assert.match(swap(componentSrc, ' && current.barTop === next.barTop', ''), /current\.barTop === next\.barTop/))
await mutant('the landscape Full screen button ignores the right safe area', () => checkSafeArea(swap(cssText, 'right: calc(8px + env(safe-area-inset-right, 0px)); z-index: 44;', 'right: 8px; z-index: 44;')))
await mutant('our own stage\'s Exit button ignores the top safe area', () => checkSafeArea(swap(cssText, 'position: fixed; top: calc(8px + env(safe-area-inset-top, 0px)); right: calc(8px + env(safe-area-inset-right, 0px)); z-index: 70;', 'position: fixed; top: 8px; right: calc(8px + env(safe-area-inset-right, 0px)); z-index: 70;')))
await mutant('the rotate card is shown in full screen', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, " && input.fullscreen === 'off'\n}", '\n}') }).studioPhoneRotateHintShown({ enabled: true, portraitSlideView: true, seen: false, fullscreen: 'fallback' }), false))
await mutant('the swipe hint is shown with one slide', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, 'input.slideCount > 1\n}\n\n// ---- Full screen', 'true\n}\n\n// ---- Full screen') }).studioPhoneSwipeHintShown({ swipeOn: true, seen: false, slideCount: 1 }), false))
await mutant('a refusal does not become the fallback stage (a rejected request would leave Full screen doing nothing)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "if (event === 'unsupported' || event === 'refused') return 'fallback'", "if (event === 'unsupported') return 'fallback'") }).studioPhoneFullscreenNext('off', 'refused'), 'fallback'))
await mutant('the browser\'s own end ends our own stage (a stray fullscreenchange would close it)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "if (event === 'ended') return state === 'native' ? 'off' : state", "if (event === 'ended') return 'off'") }).studioPhoneFullscreenNext('fallback', 'ended'), 'fallback'))
await mutant('the browser is asked without checking it can (iPhone Safari would throw)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "input.fullscreenEnabled === true && input.hasRequest === true", "input.hasRequest === true") }).studioPhoneFullscreenCanTry({ fullscreenEnabled: false, hasRequest: true }), false))
await mutant('the swipe distance is 20 px (a tap with a slip would turn the slide)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, 'minDistance: 40', 'minDistance: 20') }).studioPhoneSwipeDirection({ dx: -30, dy: 0, dt: 100, slide: 3, count: 6 }), null))
await mutant('left is previous (the directions are swapped)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "if (dx < 0) return slide < count ? 'next' : null\n  return slide > 1 ? 'prev' : null", "if (dx < 0) return slide > 1 ? 'prev' : null\n  return slide < count ? 'next' : null") }).studioPhoneSwipeDirection({ dx: -80, dy: 0, dt: 100, slide: 3, count: 6 }), 'next'))
await mutant('the swipe goes past the last slide', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "return slide < count ? 'next' : null", "return 'next'") }).studioPhoneSwipeDirection({ dx: -80, dy: 0, dt: 100, slide: 6, count: 6 }), null))
await mutant('a mostly vertical drag turns the slide (the ratio is gone)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, ' || Math.abs(dx) < Math.abs(dy) * STUDIO_PHONE_SWIPE.horizontalRatio', '') }).studioPhoneSwipeDirection({ dx: -50, dy: 80, dt: 100, slide: 3, count: 6 }), null))
await mutant('a swipe works while the slide is being edited', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, ' && input.editing !== true', '') }).studioPhoneSwipeOn({ enabled: true, portraitSlideView: true, fallback: false, editing: true, slideCount: 6 }), false))
const swipeRun = (over, props, run) => { const doc = swipeDocument(), rt = hookRuntime(); setFlags({ flag: 'true' }); const hook = makeLoader({ reactImpl: rt.impl, globals: swipeGlobals(doc), sourceOverrides: over }).load(HOOK); setFlags({}); let told = 0; const render = () => rt.render(() => hook.useStudioPhoneSwipe(props.on, props.slide, props.count, () => { told++ })); render(); run({ doc, render, rt, told: () => told }) }
await mutant('the swipe hook listens with the flag off', () => { const doc = swipeDocument(), rt = hookRuntime(); setFlags({}); const hook = makeLoader({ reactImpl: rt.impl, globals: swipeGlobals(doc), sourceOverrides: { [HOOK]: swap(hookSrc, 'if (!STUDIO_PHONE_HINTS_ENABLED || !on) return', 'if (!on) return') } }).load(HOOK); setFlags({}); rt.render(() => hook.useStudioPhoneSwipe(true, 2, 5, () => {})); assert.deepEqual(Object.keys(doc.handlers), []) })
await mutant('the swipe hook listens while a swipe is not allowed', () => swipeRun({ [HOOK]: swap(hookSrc, 'if (!STUDIO_PHONE_HINTS_ENABLED || !on) return', 'if (!STUDIO_PHONE_HINTS_ENABLED) return') }, { on: false, slide: 3, count: 6 }, ({ doc }) => assert.deepEqual(Object.keys(doc.handlers), [])))
await mutant('the swipe hook reads the slide it started with, not the latest (a left swipe on the last slide would go on)', () => swipeRun({ [HOOK]: swap(hookSrc, 'slide: latest.current.slide, count: latest.current.count', 'slide: 3, count: 6') }, { on: true, slide: 6, count: 6 }, ({ doc }) => { doc.fire('pointerdown', pointer(300, 400, 1000)); doc.fire('pointerup', pointer(100, 400, 1100)); assert.deepEqual(doc.keys, []) }))
await mutant('the swipe hook ignores which pointer was released', () => swipeRun({ [HOOK]: swap(hookSrc, 'if (!start || event.pointerId !== start.id) return', 'if (!start) return') }, { on: true, slide: 3, count: 6 }, ({ doc }) => { doc.fire('pointerdown', pointer(300, 400, 1000, 1)); doc.fire('pointerup', pointer(100, 400, 1100, 2)); assert.deepEqual(doc.keys, []) }))
await mutant('a cancelled drag still turns the slide', () => swipeRun({ [HOOK]: swap(hookSrc, 'const onCancel = () => { start = null }', 'const onCancel = () => {}') }, { on: true, slide: 3, count: 6 }, ({ doc }) => { doc.fire('pointerdown', pointer(300, 400, 1000)); doc.fire('pointercancel', {}); doc.fire('pointerup', pointer(100, 400, 1100)); assert.deepEqual(doc.keys, []) }))
await mutant('a drag that starts outside the slide space turns the slide (the chat, the rail and the page would swipe too)', () => swipeRun({ [HOOK]: swap(hookSrc, 'start = inside(event) ? { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId } : null', 'start = { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId }') }, { on: true, slide: 3, count: 6 }, ({ doc }) => { doc.fire('pointerdown', pointer(300, 400, 1000, 1, false)); doc.fire('pointerup', pointer(100, 400, 1100, 1, false)); assert.deepEqual(doc.keys, []) }))
await mutant('a left swipe goes to the previous slide (the keys are swapped)', () => swipeRun({ [HOOK]: swap(hookSrc, 'const SWIPE_KEYS = { next: "ArrowRight", prev: "ArrowLeft" } as const', 'const SWIPE_KEYS = { next: "ArrowLeft", prev: "ArrowRight" } as const') }, { on: true, slide: 3, count: 6 }, ({ doc }) => { doc.fire('pointerdown', pointer(300, 400, 1000)); doc.fire('pointerup', pointer(100, 400, 1100)); assert.deepEqual(doc.keys, ['ArrowRight']) }))
await mutant('the page is not told about a swipe (the hint would stay after it)', () => swipeRun({ [HOOK]: swap(hookSrc, '      latest.current.onSwiped()\n', '') }, { on: true, slide: 3, count: 6 }, ({ doc, told }) => { doc.fire('pointerdown', pointer(300, 400, 1000)); doc.fire('pointerup', pointer(100, 400, 1100)); assert.equal(told(), 1) }))
await mutant('the swipe hook leaves its listeners behind', () => swipeRun({ [HOOK]: swap(hookSrc, '      document.removeEventListener("pointerup", onUp, true)\n', '') }, { on: true, slide: 3, count: 6 }, ({ doc, rt }) => { rt.unmount(); assert.deepEqual(Object.values(doc.handlers).flat(), []) }))
await mutant('Full screen awaits something before asking the browser (the tap\'s permission could be gone)', async () => { const calls = { n: 0 }; const { rt, hook } = hooksWith({ flag: 'true' }, { document: docStub({ querySelector: () => ({ requestFullscreen: () => { calls.n++; return Promise.resolve() } }) }) }, { [HOOK]: swap(hookSrc, '    try {\n      Promise.resolve(target.requestFullscreen())', '    try {\n      Promise.resolve().then(() => target.requestFullscreen())') }); const api = rt.render(() => hook.useStudioPhoneFullscreen()); api.enter(); assert.equal(calls.n, 1) })
await mutant('a rejected request leaves Full screen doing nothing', async () => { const r = await fullscreenWith({ [HOOK]: swap(hookSrc, '.then(() => move("granted"), () => move("refused"))', '.then(() => move("granted"), () => {})') }, () => Promise.reject(new Error('x'))); assert.equal(r.api.state, 'fallback') })
await mutant('a synchronous throw from requestFullscreen is not caught', async () => { await fullscreenWith({ [HOOK]: swap(hookSrc, '    } catch {\n      move("refused")\n    }', '    } finally {\n    }') }, () => { throw new Error('x') }) })
await mutant('the browser is asked even when it says it cannot', async () => { let asked = 0; await fullscreenWith({ [HOOK]: swap(hookSrc, 'fullscreenEnabled: document.fullscreenEnabled, hasRequest', 'fullscreenEnabled: true, hasRequest') }, () => { asked++; return Promise.resolve() }, { enabled: false }); assert.equal(asked, 0) })
await mutant('the browser\'s own end is not followed (Full screen would stay "on" after Escape)', async () => { const r = await fullscreenWith({ [HOOK]: swap(hookSrc, 'if (!document.fullscreenElement) move("ended")', 'if (document.fullscreenElement) move("ended")') }, () => Promise.resolve()); r.doc.fire('fullscreenchange', {}); const api = r.rt.render(() => r.hook.useStudioPhoneFullscreen()); assert.equal(api.state, 'off') })
await mutant('Escape does not end our own stage', async () => { const r = await fullscreenWith({ [HOOK]: swap(hookSrc, 'if (event.key === "Escape") move("exit")', 'if (event.key === "Escape") {}') }, () => Promise.reject(new Error('x'))); r.doc.fire('keydown', { key: 'Escape' }); const api = r.rt.render(() => r.hook.useStudioPhoneFullscreen()); assert.equal(api.state, 'off') })
await mutant('an orientation lock is added to the hook', () => assert.ok(!/orientation\s*\.\s*lock|screen\.orientation/.test(hookSrc + '\nscreen.orientation.lock("landscape")\n')))
await mutant('the rotate card has different words', () => assert.match(render({ portrait: true }, {}, { [COMPONENT]: swap(withState({ seen: false }), 'Turn your phone sideways and the slide fills the screen.', 'Rotate your phone.') }), /Turn your phone sideways and the slide fills the screen\./))
await mutant('"Not now" does not store the card (it would come back)', () => assert.match(swap(componentSrc, 'data-studio-phone-hint-quiet="true" onClick={dismissRotate}', 'data-studio-phone-hint-quiet="true" onClick={() => setRotateSeen(true)}'), /data-studio-phone-hint-quiet="true" onClick=\{dismissRotate\}/))
await mutant('Full screen from the card asks the browser after the tap (not inside it)', () => assert.match(swap(componentSrc, 'onClick={() => { dismissRotate(); enter() }}', 'onClick={() => { dismissRotate(); setTimeout(enter, 0) }}'), /onClick=\{\(\) => \{ dismissRotate\(\); enter\(\) \}\}/))
await mutant('the card is not stored when the phone has been seen sideways', () => assert.match(swap(componentSrc, 'useEffect(() => { if (stage) dismissRotate() }, [stage])', ''), /useEffect\(\(\) => \{ if \(stage\) dismissRotate\(\) \}, \[stage\]\)/))
await mutant('the storage is read without try / catch (the property itself can throw)', () => assert.match(swap(componentSrc, 'const storage = (): StudioHintStorage | null => { try { return window.localStorage } catch { return null } }', 'const storage = (): StudioHintStorage | null => window.localStorage'), /try \{ return window\.localStorage \} catch \{ return null \}/))
await mutant('the swipe hint\'s hiding effect is declared after its showing effect (it would never show)', () => { const text = swap(swap(componentSrc, '  useEffect(() => { setSwipeHint(false) }, [swipes, swipeOn])\n', ''), '  }, [swipeShown])\n', '  }, [swipeShown])\n  useEffect(() => { setSwipeHint(false) }, [swipes, swipeOn])\n'); assert.ok(text.indexOf('setSwipeHint(false) }, [swipes, swipeOn]') < text.indexOf('if (!swipeShown) return')) })
await mutant('a rule loses its <html> key (it would match with the flag off)', () => sheetKeyed(swap(cssText, 'html[data-studio-phone-swipe="on"] [data-studio-v4-shell="true"] [data-studio-slide-space] iframe { pointer-events: none; }', '[data-studio-v4-shell="true"] [data-studio-slide-space] iframe { pointer-events: none; }')))
await mutant('a rule uses !important', () => assert.ok(!/!important/.test(swap(cssText, 'pointer-events: none; }\n\n/* the full-screen stage', 'pointer-events: none !important; }\n\n/* the full-screen stage'))))
await mutant('the swipe lets the frame keep the touches (no pointer-events: none)', () => assert.equal(ruleList(swap(cssText, 'pointer-events: none; }\n\n/* the full-screen stage', 'color: inherit; }\n\n/* the full-screen stage')).find(rule => rule.selectors[0].startsWith('html[data-studio-phone-swipe="on"]') && rule.selectors[0].endsWith('iframe')).decls.find(decl => decl.prop === 'pointer-events')?.value, 'none'))
await mutant('the top bar is hidden with display: none in our own stage (the fan\'s menus would anchor at the corner)', () => { const lay = ruleList(swap(cssText, 'visibility: hidden; pointer-events: none;\n}', 'display: none;\n}')).find(rule => rule.selectors.some(s => s.includes('[data-studio-v4-shell-header]')) && rule.selectors.some(s => s.includes('[data-studio-authoring-slot]'))); assert.ok(!lay.decls.some(decl => decl.prop === 'display')) })
await mutant('our own full-screen stage keeps PR 1\'s thumbnail strip', () => assert.ok(ruleList(swap(cssText, ', [data-studio-v4-thumbnails]) { display: none; }', ') { display: none; }')).find(rule => rule.selectors.some(s => s.includes('[data-studio-workspace-switch]')) && rule.decls.some(decl => decl.prop === 'display')).selectors[0].includes('[data-studio-v4-thumbnails]')))
await mutant('our own full-screen stage keeps PR 1\'s two floating buttons (the dock)', () => assert.ok(ruleList(swap(cssText, '[data-studio-phone-dock="true"], ', '')).find(rule => rule.selectors.some(s => s.includes('[data-studio-phone-controls="true"]')) && rule.decls.some(decl => decl.prop === 'display')).selectors[0].includes('[data-studio-phone-dock="true"]')))
await mutant('our own full-screen stage keeps PR 1\'s hamburger menu card', () => assert.ok(ruleList(swap(cssText, '[data-studio-phone-nav-card="true"], ', '')).find(rule => rule.selectors.some(s => s.includes('[data-studio-phone-controls="true"]')) && rule.decls.some(decl => decl.prop === 'display')).selectors[0].includes('[data-studio-phone-nav-card="true"]')))
await mutant('the controls-right custom property is not set in the landscape stage (Chat and Full screen would overlap)', () => assert.ok(ruleList(swap(cssText, '  html[data-studio-phone-hints] { --studio-phone-controls-right: 46px; }\n', '')).some(rule => rule.decls.some(decl => decl.prop === '--studio-phone-controls-right'))))
await mutant('the exit button sits under the dialogs', () => assert.equal(ruleList(swap(cssText, 'right: calc(8px + env(safe-area-inset-right, 0px)); z-index: 70;', 'right: calc(8px + env(safe-area-inset-right, 0px)); z-index: 40;')).find(rule => rule.selectors[0].endsWith('[data-studio-phone-exit="true"]') && rule.decls.some(decl => decl.prop === 'z-index')).decls.find(decl => decl.prop === 'z-index').value, '70'))
await mutant('the full-screen stage\'s slide space loses the viewer\'s :not() form (the canvas sheet\'s neutral surface would win)', () => fallbackCascade(swap(cssText, 'html[data-studio-phone-fullscreen="fallback"][data-studio-phone-hints] [data-studio-v4-shell="true"] [data-studio-v4-viewer]:not([data-studio-v4-fullscreen="true"]) [data-studio-slide-space="true"] { padding: 0; background: #000; }', 'html[data-studio-phone-fullscreen="fallback"] [data-studio-v4-shell="true"] [data-studio-slide-space="true"] { padding: 0; background: #000; }')))
await mutant('the full-screen stage has no rule for the workspace\'s left margin (a 360 px phone would keep the phone shell\'s 10 px band)', () => fallbackCascade(swap(cssText, `html[data-studio-phone-fullscreen="fallback"][data-studio-phone-hints] [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) > [data-studio-v4-shell-column] > [data-studio-v4-shell-workspace] { margin-left: 0; }\n`, '')))
await mutant('the full-screen stage\'s workspace margin loses its <html> keys (it would tie with the phone shell\'s own rule and lose by order)', () => fallbackCascade(swap(cssText, 'html[data-studio-phone-fullscreen="fallback"][data-studio-phone-hints] [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) > [data-studio-v4-shell-column] > [data-studio-v4-shell-workspace] { margin-left: 0; }', '[data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) > [data-studio-v4-shell-column] > [data-studio-v4-shell-workspace] { margin-left: 0; }')))
await mutant('the full-screen stage\'s viewer padding loses the hints attribute (it would tie with PR 1\'s collapsed-strip rule)', () => fallbackCascade(swap(cssText, 'html[data-studio-phone-fullscreen="fallback"][data-studio-phone-hints] [data-studio-v4-shell="true"] [data-studio-v4-viewer]:not([data-studio-v4-fullscreen="true"]) { padding-left: 0; }', 'html[data-studio-phone-fullscreen="fallback"] [data-studio-v4-shell="true"] [data-studio-v4-viewer]:not([data-studio-v4-fullscreen="true"]) { padding-left: 0; }')))
await mutant('a PHONE-HINTS line names PR 1\'s marker (PR 1\'s strip would take it out too)', () => { const bad = pageSrc.replace('// PHONE-HINTS (NEXT_PUBLIC_STUDIO_PHONE_HINTS, default off, needs the landscape flag too)', '// PHONE-HINTS (NEXT_PUBLIC_STUDIO_PHONE_HINTS, default off, with PHONE-LANDSCAPE)'); assert.notEqual(bad, pageSrc); for (const line of bad.split('\n').filter(line => PHONE_HINTS_MARKER_RE.test(line))) assert.ok(!/(?<![\w-])PHONE-LANDSCAPE(?![\w-])/.test(line), line.slice(0, 80)) })
await mutant('a marker line is mistyped (the strip would leave it behind)', () => assert.equal(stripPhoneHints(PAGE, pageSrc.replace("import { STUDIO_PHONE_HINTS_ENABLED } from '@/lib/studio-phone-hints' // PHONE-HINTS", "import { STUDIO_PHONE_HINTS_ENABLED } from '@/lib/studio-phone-hints' // PHONE-HINTSS")), baseText(PAGE)))
await mutant('an existing line of the page is changed (not a pure insertion)', () => assert.equal(stripPhoneHints(PAGE, swap(pageSrc, "const studioWelcome = studioShell && !studioPartialMetadata", "const studioWelcome = studioShell && !studioPartialMetadata /* edited */")), baseText(PAGE)))
await mutant('the page mounts the component without the constant', () => assert.match(swap(pageSrc, '{STUDIO_PHONE_HINTS_ENABLED && <StudioPhoneHints ', '{<StudioPhoneHints '), /\{STUDIO_PHONE_HINTS_ENABLED && <StudioPhoneHints /))

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
