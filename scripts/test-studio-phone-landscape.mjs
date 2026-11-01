// FRONTEND-1 (F-13 phone orientation, PR 1 of 2; PK's answers of 1 Nov): proof of the sideways viewing stage and the portrait Menu fold. Flag NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE (exact "true", build-time, default off), only active with the phone
// shell (NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL). A phone turned sideways (the query (orientation: landscape) and (max-height: 500px) and (pointer: coarse), and its CSS twin) with a deck on the stage: the slide fills the screen
// (the viewer's own fit fed a slide space 32 px larger by CSS: the viewer is not edited), the thumbnails are a collapsible strip on the LEFT with a state of its own, the rail, top bar, switch, toolbar, pull tabs and tab bar go, a Chat button is a pane switch back to the Director, and ONE floating button opens an
// overlay fan (Add slide, Add element and the phone "..." menu's deck actions, through the page's own controls). In portrait the slide view folds the bottom bar to one Menu button. The screen is never locked to an orientation.
//
//   node scripts/test-studio-phone-landscape.mjs        (plain node: transpile + vm of the REAL lib, hook and component, postcss over the REAL stylesheets, no network, no browser; the real page is driven by the harness shots)
//
// What it proves:
//  1. the flag is the exact string "true" AND the phone shell AND the Studio shell (every other spelling of each is off); nothing is listened to and nothing is drawn with it off;
//  2. the decisions (lib): the stage needs all four of flag, landscape, a deck on the stage and the stage on screen; the page's width on a phone turned sideways; the strip's own state and what the stage does to the viewer's own rail toggle; the fan's entries;
//  3. the hooks: the media query is read once and followed on `change` (and never touched with the flag off); the stage store tells its subscribers; the viewer's rail is the strip's while the stage is on and the portrait value comes back (no leak into portrait);
//  4. the component: its markup in the stage (Chat with the connection dot, the one floating button, the strip's collapse button or its 30 px handle), in the portrait slide view (one Menu button) and nowhere else; no orientation lock anywhere;
//  5. the stylesheet (postcss, the REAL file): every rule is inside one of the two media queries, every selector is keyed to an <html> attribute this change sets or to one of its own elements, no !important; the queries are the lib's; the stage hides what it must and keeps the controls
//     the fan uses laid out (never display: none: their menus anchor there); every rule it needs to beat in the phone shell's own sheet is beaten on specificity;
//  6. the insertions: page and viewer without the marked lines are the base's files byte for byte (also through the registry; no existing line is rewritten); the marked lines are where they should be and gated on the constant;
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
  BASE_COMMIT, PHONE_LANDSCAPE_FILES, PHONE_LANDSCAPE_NEW_FILES, PHONE_LANDSCAPE_PIN_EDITS, PHONE_LANDSCAPE_PIN_FILES, PHONE_LANDSCAPE_PIN_MARK, PHONE_LANDSCAPE_SCOPE_FILES, PHONE_LANDSCAPE_ENV_BLOCK, PHONE_LANDSCAPE_MARKER_RE, PHONE_LANDSCAPE_SUBJECT, PHONE_LANDSCAPE_FLAG, stripPhoneLandscape,
} from './studio-phone-landscape-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
/** Every OTHER registered change's strip, in the registry's order (this change's is left out): a file is read as this change left it, whatever other changes marked in it. */
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripPhoneLandscape), rel, text)
/** Strips of the changes registered AFTER this one only: what the older pins' reads leave in, and what a later change must not break. */
const laterBlocks = () => { const at = registry.LATER_ENV_BLOCKS.indexOf(PHONE_LANDSCAPE_ENV_BLOCK); return at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1) }

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
const LIB = 'lib/studio-phone-landscape.ts', HOOK = 'hooks/use-studio-phone-landscape.ts', COMPONENT = 'components/builder/studio-phone-landscape.tsx', CSS = 'components/builder/studio-phone-landscape.css'
const PAGE = 'app/builder/page.tsx', VIEWER = 'components/presentation-viewer.tsx', SHELL_CSS = 'components/layout/studio-phone-shell.css'
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
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', PHONE_SHELL = 'NEXT_PUBLIC_STUDIO_PHONE_SHELL'
const setFlags = ({ flag, phoneShell = 'true', shell = 'true' } = {}) => {
  for (const key of [SHELL, PHONE_SHELL, PHONE_LANDSCAPE_FLAG]) delete env[key]
  if (shell !== null) env[SHELL] = shell
  if (phoneShell !== null) env[PHONE_SHELL] = phoneShell
  if (flag !== undefined) env[PHONE_LANDSCAPE_FLAG] = flag
}
const SPELLINGS = [undefined, null, 'false', 'TRUE', '1', 'true ', ' true', '']
setFlags({ flag: 'true' })
const lib = makeLoader().load(LIB)
const libOff = (() => { setFlags({}); return makeLoader().load(LIB) })()
setFlags({})
const libWith = (flags, sourceOverrides) => { setFlags(flags); try { return makeLoader({ sourceOverrides }).load(LIB) } finally { setFlags({}) } }

// ---- a small hooks runtime (refs, effects, useSyncExternalStore) so the REAL hook file can be driven render by render -----------------------------------------
function hookRuntime() {
  const state = { refs: [], index: 0, effects: [], last: [] }
  const impl = {
    ...React,
    useRef: init => { const slot = state.index++; return state.refs[slot] ??= { current: init } },
    useEffect: (cb, deps) => { state.effects.push({ slot: state.index++, cb, deps }) },
    useLayoutEffect: (cb, deps) => { state.effects.push({ slot: state.index++, cb, deps }) },
    useSyncExternalStore: (subscribe, snapshot) => { state.index++; return snapshot() },
  }
  return {
    impl,
    render(fn) {
      state.index = 0; state.effects = []
      const out = fn()
      for (const { slot, cb, deps } of state.effects) {
        const prev = state.last[slot]
        if (!prev || !deps || deps.length !== prev.length || deps.some((dep, i) => !Object.is(dep, prev[i]))) { state.last[slot] = deps; cb() }
      }
      return out
    },
  }
}
const windowStub = (matches = {}) => {
  const listeners = []
  const w = { matchMedia: query => { w.asked.push(query); return { matches: Boolean(matches[query]), addEventListener: (type, fn) => { w.added.push([query, type]); listeners.push(fn) }, removeEventListener: (type, fn) => { w.removed.push([query, type]); const at = listeners.indexOf(fn); if (at >= 0) listeners.splice(at, 1) } } }, asked: [], added: [], removed: [], listeners }
  return w
}

/** A page with the viewer's rail toggle on it (`aria-expanded` says whether the rail is open; a click flips it, as the viewer's own handler does), or without one yet (`arriveLater`), and a MutationObserver that is told when the DOM changes. Everything it is asked is logged. */
const railPage = (open, { arriveLater = false } = {}) => {
  const log = []
  let toggle = arriveLater ? null : { getAttribute: name => (name === 'aria-expanded' ? String(open) : null), click() { open = !open; log.push(`click -> ${open}`) } }
  const observers = []
  class MutationObserver { constructor(cb) { this.cb = cb; observers.push(this) } observe() { log.push('observe') } disconnect() { log.push('disconnect'); this.cb = null } }
  const document = { body: {}, querySelector: selector => { log.push(`query ${selector}`); return toggle } }
  return { document, MutationObserver, log, state: () => open, arrive() { toggle = { getAttribute: name => (name === 'aria-expanded' ? String(open) : null), click() { open = !open; log.push(`click -> ${open}`) } }; for (const o of observers) o.cb?.() } }
}

// ---- the stylesheets, parsed --------------------------------------------------------------------------------------------------------------------
const ruleList = text => { const out = []; postcss.parse(text).walkRules(rule => out.push({ selectors: rule.selectors.map(selector => selector.trim()), media: rule.parent?.type === 'atrule' ? rule.parent.params : null, decls: rule.nodes.filter(node => node.type === 'decl').map(node => ({ prop: node.prop, value: node.value, important: node.important })) })); return out }
const cssText = read(CSS), shellCssText = read(SHELL_CSS)
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
const STAGE = 'html[data-studio-phone-landscape="stage"]', OWN_ELEMENTS = ['[data-studio-phone-strip-head', '[data-studio-phone-strip-handle', '[data-studio-phone-controls', '[data-studio-phone-chat', '[data-studio-phone-fab', '[data-studio-phone-fan', '[data-studio-phone-menu']
const keyed = selector => selector.includes('html[data-studio-phone-landscape=') || selector.includes('html[data-studio-phone-bar') || OWN_ELEMENTS.some(own => selector.includes(own))

// ===== 1. the flag =============================================================================================================================================
await check('the flag is the exact string "true" AND the phone shell AND the Studio shell: every other spelling of any of the three is off, and the constant follows the three env values', () => {
  assert.equal(lib.studioPhoneLandscapeOn('true', 'true', 'true'), true)
  for (const value of SPELLINGS) {
    assert.equal(lib.studioPhoneLandscapeOn(value, 'true', 'true'), false, `flag ${JSON.stringify(value)}`)
    assert.equal(lib.studioPhoneLandscapeOn('true', value, 'true'), false, `phone shell ${JSON.stringify(value)}`)
    assert.equal(lib.studioPhoneLandscapeOn('true', 'true', value), false, `studio shell ${JSON.stringify(value)}`)
  }
  assert.equal(lib.STUDIO_PHONE_LANDSCAPE_ENABLED, true)
  assert.equal(libOff.STUDIO_PHONE_LANDSCAPE_ENABLED, false, 'unset: off')
  for (const flags of [{ flag: 'false' }, { flag: 'TRUE' }, { flag: 'true', phoneShell: null }, { flag: 'true', phoneShell: 'false' }, { flag: 'true', shell: null }, { flag: 'true', shell: 'false' }, { flag: ' true' }]) assert.equal(libWith(flags).STUDIO_PHONE_LANDSCAPE_ENABLED, false, JSON.stringify(flags))
  assert.equal(libWith({ flag: 'true' }).STUDIO_PHONE_LANDSCAPE_ENABLED, true)
})
await check('with the flag off nothing is listened to and nothing is drawn: the media-query hook never touches matchMedia and answers false, the rail sync never reads or clicks the viewer\'s toggle, the component is mounted only behind the constant', () => {
  const w = windowStub({ [lib.STUDIO_PHONE_LANDSCAPE_QUERY]: true })
  const subscribed = []
  const impl = { ...React, useSyncExternalStore: (subscribe, snapshot, server) => { subscribed.push({ subscribe, snapshot, server }); return snapshot() } }
  setFlags({}); const off = makeLoader({ reactImpl: impl, globals: { window: w } }).load(HOOK); setFlags({})
  assert.equal(off.useStudioPhoneQuery(lib.STUDIO_PHONE_LANDSCAPE_QUERY), false)
  const { subscribe, snapshot, server } = subscribed.pop()
  const unsubscribe = subscribe(() => {}); unsubscribe()
  assert.equal(snapshot(), false); assert.equal(server(), false)
  assert.deepEqual(w.asked, [], 'matchMedia was never asked'); assert.deepEqual(w.added, [])
  // the rail sync with the flag off, the stage on: the page is never queried, nothing is clicked or observed
  const rail = railPage(false); const rt = hookRuntime(); setFlags({}); const hook = makeLoader({ reactImpl: rt.impl, globals: { window: w, document: rail.document, MutationObserver: rail.MutationObserver } }).load(HOOK); setFlags({})
  rt.render(() => hook.useStudioPhoneRailSync(true, 'open'))
  assert.deepEqual(rail.log, [], 'the viewer\'s rail is left alone with the flag off')
  const page = read(PAGE)
  assert.match(page, /\{STUDIO_PHONE_LANDSCAPE_ENABLED && <StudioPhoneLandscape /, 'mounted only behind the constant')
})

// ===== 2. the decisions ======================================================================================================================================
await check('the queries: the landscape query is height-based and needs a coarse pointer (667x375, 844x390 and 932x430 are in, a short desktop window is out), the portrait query is the phone shell\'s own 640 px plus portrait; both are the exact text of the stylesheet\'s media queries', () => {
  assert.equal(lib.STUDIO_PHONE_LANDSCAPE_QUERY, LANDSCAPE_MEDIA); assert.equal(lib.STUDIO_PHONE_PORTRAIT_QUERY, PORTRAIT_MEDIA)
  const medias = new Set(mine().map(rule => rule.media)); assert.deepEqual([...medias].sort(), [LANDSCAPE_MEDIA, PORTRAIT_MEDIA].sort(), 'the sheet has exactly these two queries')
  assert.match(shellCssText, /@media \(max-width: 640px\)/, 'the phone shell\'s own width')
  // evaluate the query text on viewports (width, height, coarse pointer, orientation): the same words the browser reads
  const matchesLandscape = (w, h, coarse) => w > h && h <= 500 && coarse
  for (const [w, h] of [[667, 375], [844, 390], [932, 430], [568, 320]]) assert.ok(matchesLandscape(w, h, true), `${w}x${h}`)
  assert.ok(!matchesLandscape(1280, 720, false), 'a desktop window'); assert.ok(!matchesLandscape(900, 480, false), 'a short desktop window (fine pointer)'); assert.ok(!matchesLandscape(390, 844, true), 'portrait')
})
await check('the stage needs all four (the flag, a phone turned sideways, a deck on the stage, the stage on screen); the portrait slide view needs its four; the bar is folded in the slide view, open when Menu was tapped, and not this change\'s otherwise', () => {
  for (let mask = 0; mask < 16; mask++) {
    const [enabled, landscape, deckOnStage, stageVisible] = [0, 1, 2, 3].map(bit => Boolean(mask & (1 << bit)))
    assert.equal(lib.studioPhoneLandscapeStage({ enabled, landscape, deckOnStage, stageVisible }), mask === 15, `stage ${mask}`)
    assert.equal(lib.studioPhonePortraitSlideView({ enabled, portrait: landscape, deckOnStage, stageVisible }), mask === 15, `slide view ${mask}`)
  }
  assert.equal(lib.studioPhoneLandscapeStage({ enabled: 1, landscape: true, deckOnStage: true, stageVisible: true }), false, 'a truthy non-boolean is not true')
  assert.equal(lib.studioPhoneBarState(true, false), 'folded'); assert.equal(lib.studioPhoneBarState(true, true), 'open'); assert.equal(lib.studioPhoneBarState(false, true), null); assert.equal(lib.studioPhoneBarState(false, false), null)
})
await check('the page\'s width is never over its own 880 px threshold on a phone turned sideways (and untouched otherwise); the strip toggles between open and collapsed and starts open; what the stage does to the viewer\'s own rail toggle: one click to make it the strip\'s, the portrait value remembered and put back', () => {
  assert.equal(lib.STUDIO_PHONE_OVERLAY_MAX_WIDTH, 880); assert.match(read(PAGE), /const studioOverlayWorkspace = studioShell && workspaceWidth <= 880/, 'the page\'s own threshold is 880')
  for (const [landscape, width, want] of [[true, 932, 880], [true, 926, 880], [true, 881, 880], [true, 880, 880], [true, 844, 844], [true, 568, 568], [false, 932, 932], [false, 1440, 1440], [false, 390, 390]]) assert.equal(lib.studioPhoneWorkspaceWidth(landscape, width), want, `${landscape} ${width}`)
  assert.equal(lib.STUDIO_PHONE_STRIP_DEFAULT, 'open'); assert.equal(lib.studioPhoneStripToggle('open'), 'collapsed'); assert.equal(lib.studioPhoneStripToggle('collapsed'), 'open')
  assert.equal(lib.STUDIO_PHONE_RAIL_TOGGLE, '[data-studio-v4-thumbnail-toggle="true"]')
  const sync = (stage, strip, railOpen, remembered) => { const out = lib.studioPhoneRailSync({ stage, strip, railOpen, remembered }); return { click: out.click, remembered: out.remembered, done: out.done } }
  assert.deepEqual(sync(true, 'open', false, null), { click: true, remembered: false, done: true }, 'stage on, strip open, the portrait rail closed: remembered, then opened')
  assert.deepEqual(sync(true, 'open', true, null), { click: false, remembered: true, done: true }, 'already open: remembered, not clicked')
  assert.deepEqual(sync(true, 'collapsed', true, false), { click: true, remembered: false, done: true }, 'the strip collapsed: closed; the first remembered value is kept, not the one the stage made')
  assert.deepEqual(sync(true, 'open', true, false), { click: false, remembered: false, done: true }, 'sync again: nothing to do')
  assert.deepEqual(sync(false, 'open', true, false), { click: true, remembered: null, done: true }, 'stage off: the portrait value (closed) is put back, once, and forgotten')
  assert.deepEqual(sync(false, 'collapsed', false, true), { click: true, remembered: null, done: true }, 'portrait had it open: opened again, whatever the strip did')
  assert.deepEqual(sync(false, 'open', true, null), { click: false, remembered: null, done: true }, 'off the stage with nothing remembered: nothing')
  assert.deepEqual(sync(true, 'open', null, null), { click: false, remembered: null, done: false }, 'the toggle is not on the page yet: not done, nothing remembered'); assert.deepEqual(sync(false, 'open', null, true), { click: false, remembered: true, done: false }, 'nor when leaving: the remembered value waits')
})
await check('the fan: Add slide, Add element, then the "..." menu\'s deck actions in its own order, then the strip; only controls that are on the page; named as the control is named (a name that is blank falls back); disabled when the control is; the strip entry says Hide or Show', () => {
  const on = (label, disabled = false) => ({ label, disabled })
  const all = { addSlide: on('Add Slide'), addElement: on('Add Element'), newDeck: on('New deck'), export: on('Export presentation'), notes: on('Show script and notes'), slide: on('Open slide panel'), deckList: on('Open deck list'), presenter: on('Presenter details') }
  assert.deepEqual([...lib.studioPhoneFanItems(all, 'open').map(item => item.key)], ['addSlide', 'addElement', 'newDeck', 'export', 'notes', 'thumbnails', 'slide', 'deckList', 'presenter'])
  assert.deepEqual([...lib.STUDIO_PHONE_FAN_ORDER], ['addSlide', 'addElement', 'newDeck', 'export', 'notes', 'thumbnails', 'slide', 'deckList', 'presenter'])
  assert.deepEqual([...lib.studioPhoneFanItems({}, 'open').map(item => ({ ...item }))], [{ key: 'thumbnails', label: 'Hide thumbnails', disabled: false }], 'nothing on the page: the strip\'s own entry only'); assert.equal(lib.studioPhoneFanItems({}, 'collapsed')[0].label, 'Show thumbnails')
  const some = lib.studioPhoneFanItems({ ...all, addElement: null, notes: on('   '), export: on('Export', true), slide: on(null) }, 'collapsed')
  assert.deepEqual([...some.map(item => item.key)], ['addSlide', 'newDeck', 'export', 'notes', 'thumbnails', 'slide', 'deckList', 'presenter'])
  assert.equal(some.find(item => item.key === 'notes').label, 'Notes', 'a blank name falls back'); assert.equal(some.find(item => item.key === 'slide').label, 'Slide panel'); assert.equal(some.find(item => item.key === 'export').disabled, true); assert.equal(some.find(item => item.key === 'addSlide').disabled, false)
  assert.equal(some.find(item => item.key === 'addSlide').label, 'Add Slide', 'the control\'s own name, trimmed')
  assert.deepEqual([...Object.entries(lib.STUDIO_PHONE_FAN_OPENS_MENU).filter(([, opens]) => opens).map(([key]) => key).sort()], ['addElement', 'export'], 'the two Radix dropdown triggers open on the key, the rest on a click')
  // the "..." menu's own entries (lib/studio-phone-builder-top.ts) are all in the fan, and nothing else but Add slide / Add element
  const menu = read('lib/studio-phone-builder-top.ts').match(/STUDIO_PHONE_DECK_MENU_ORDER: readonly StudioPhoneDeckMenuKey\[\] = \[([^\]]*)\]/)[1].split(',').map(item => item.trim().replace(/'/g, ''))
  assert.deepEqual([...lib.STUDIO_PHONE_FAN_ORDER].filter(key => key !== 'addSlide' && key !== 'addElement'), menu, 'the deck actions of the phone "..." menu, in its own order')
})

// ===== 3. the hooks ============================================================================================================================================
await check('the media-query hook (flag on): the answer is the browser\'s, read when asked, followed on `change` (add and remove, the same query), false on the server', () => {
  const w = windowStub({ [lib.STUDIO_PHONE_LANDSCAPE_QUERY]: true })
  const seen = []
  const impl = { ...React, useSyncExternalStore: (subscribe, snapshot, server) => { seen.push({ subscribe, snapshot, server }); return snapshot() } }
  setFlags({ flag: 'true' }); const hook = makeLoader({ reactImpl: impl, globals: { window: w } }).load(HOOK); setFlags({})
  assert.equal(hook.useStudioPhoneQuery(lib.STUDIO_PHONE_LANDSCAPE_QUERY), true); assert.equal(hook.useStudioPhoneQuery(lib.STUDIO_PHONE_PORTRAIT_QUERY), false)
  const { subscribe, server } = seen[0]
  let fired = 0; const unsubscribe = subscribe(() => { fired++ })
  assert.deepEqual(w.added, [[lib.STUDIO_PHONE_LANDSCAPE_QUERY, 'change']]); assert.equal(w.listeners.length, 1)
  w.listeners[0](); assert.equal(fired, 1); unsubscribe()
  assert.deepEqual(w.removed, [[lib.STUDIO_PHONE_LANDSCAPE_QUERY, 'change']]); assert.equal(w.listeners.length, 0); assert.equal(server(), false)
  assert.ok(!/orientationchange|screen\.orientation/.test(read(HOOK)), 'no orientationchange: the media query\'s change event is enough')
})
await check('the rail sync (flag on): off the stage nothing is clicked; the stage on remembers the viewer\'s own value and makes the rail the strip\'s with the viewer\'s OWN toggle; collapsing and expanding follow the strip; leaving puts the portrait value back (a rail closed in portrait is closed again), once; a toggle that arrives after the stage is followed and the observer let go', () => {
  const drive = (portraitOpen, steps, opts = {}) => {
    const page = railPage(portraitOpen, opts), rt = hookRuntime(); setFlags({ flag: 'true' }); const hook = makeLoader({ reactImpl: rt.impl, globals: { window: windowStub(), document: page.document, MutationObserver: page.MutationObserver } }).load(HOOK); setFlags({})
    let stage = false, strip = 'open'; const render = () => rt.render(() => hook.useStudioPhoneRailSync(stage, strip))
    render(); for (const step of steps) { step({ set: (s, t) => { stage = s; strip = t }, render, page }) }
    return { page, rt }
  }
  const clicks = page => page.log.filter(line => line.startsWith('click'))
  let r = drive(false, [({ page }) => assert.deepEqual(clicks(page), [], 'off the stage: nothing is clicked')])
  r = drive(false, [({ set, render }) => { set(true, 'open'); render() }, ({ page }) => assert.equal(page.state(), true, 'stage on: the strip is open (a portrait rail that was closed is opened for the stage)'),
    ({ set, render }) => { set(true, 'collapsed'); render() }, ({ page }) => assert.equal(page.state(), false, 'collapsed: closed'),
    ({ set, render }) => { set(true, 'open'); render() }, ({ page }) => assert.equal(page.state(), true, 'expanded: open'),
    ({ set, render }) => { set(false, 'open'); render() }, ({ page }) => assert.equal(page.state(), false, 'stage off: the portrait value (closed) is back'),
    ({ render }) => render(), ({ page }) => assert.equal(clicks(page).length, 4, 'and only once')])
  r = drive(true, [({ set, render }) => { set(true, 'collapsed'); render() }, ({ page }) => assert.equal(page.state(), false), ({ set, render }) => { set(false, 'collapsed'); render() }, ({ page }) => assert.equal(page.state(), true, 'portrait had it open: open again, whatever the strip did')])
  r = drive(false, [({ set, render }) => { set(true, 'open'); render() }, ({ page }) => { assert.equal(page.state(), true); assert.ok(!page.log.includes('observe'), 'the toggle was there: no observer') }])
  r = drive(false, [({ set, render }) => { set(true, 'open'); render() }, ({ page }) => { assert.ok(page.log.includes('observe'), 'no toggle yet: the page is followed'); assert.deepEqual(clicks(page), []); page.arrive() }, ({ page }) => { assert.equal(page.state(), true, 'it arrived: made open'); assert.ok(page.log.includes('disconnect'), 'and the observer is let go'); assert.equal(clicks(page).length, 1) }], { arriveLater: true })
  assert.match(read(HOOK), /querySelector<HTMLElement>\(STUDIO_PHONE_RAIL_TOGGLE\)/, 'the viewer\'s own toggle is used, never written to the viewer')
})

await check('the workspace clamp (flag on): on a phone turned sideways the page is told at most 880 px, before paint (a layout effect where there is a window); a narrower one, a portrait phone and a desktop window are left as they are; nothing happens with the flag off', () => {
  const run = (flags, landscape, width) => {
    const rt = hookRuntime(), w = windowStub({ [lib.STUDIO_PHONE_LANDSCAPE_QUERY]: landscape }), told = []
    setFlags(flags); const hook = makeLoader({ reactImpl: rt.impl, globals: { window: w } }).load(HOOK); setFlags({})
    rt.render(() => hook.useStudioPhoneWorkspaceClamp(width, next => told.push(next))); return told
  }
  assert.deepEqual(run({ flag: 'true' }, true, 932), [880]); assert.deepEqual(run({ flag: 'true' }, true, 926), [880]); assert.deepEqual(run({ flag: 'true' }, true, 844), []); assert.deepEqual(run({ flag: 'true' }, true, 880), [])
  assert.deepEqual(run({ flag: 'true' }, false, 932), [], 'not a phone turned sideways'); assert.deepEqual(run({ flag: 'true' }, false, 1440), [])
  assert.deepEqual(run({}, true, 932), [], 'flag off: nothing (the media query hook answers false for good, and the effect checks the constant too)')
  assert.match(read(HOOK), /const useIsomorphicLayoutEffect = typeof window === "undefined" \? useEffect : useLayoutEffect/, 'a layout effect in the browser (no wrong frame), an ordinary one on the server (no warning)')
})

// ===== 4. the component ========================================================================================================================================
const stubFor = ({ landscape = false, portrait = false }) => ({
  '@/hooks/use-studio-phone-landscape': {
    useStudioPhoneQuery: query => query === lib.STUDIO_PHONE_LANDSCAPE_QUERY ? landscape : query === lib.STUDIO_PHONE_PORTRAIT_QUERY ? portrait : false,
    useStudioPhoneRailSync() {},
  },
})
const component = (flags, sourceOverrides = {}) => { setFlags({ flag: 'true' }); try { return makeLoader({ stubs: stubFor(flags), sourceOverrides }).load(COMPONENT).StudioPhoneLandscape } finally { setFlags({}) } }
const markup = (flags, props = {}, sourceOverrides = {}) => renderToStaticMarkup(React.createElement(component(flags, sourceOverrides), { deckOnStage: true, stageVisible: true, slideNumber: 3, connectionState: 'connected', onChat() {}, ...props }))
/** The strip's state is the component's own (useState); the collapsed markup is that state forced, as the tap on the button would make it. */
const COLLAPSED = { [COMPONENT]: swap(read(COMPONENT), 'useState<StudioPhoneStripState>(STUDIO_PHONE_STRIP_DEFAULT)', 'useState<StudioPhoneStripState>("collapsed")') }
await check('the component draws the stage only in a phone turned sideways with a deck on the stage on screen: Chat with its connection dot (the Director header\'s own words), the one floating button, the strip\'s collapse button; the strip collapsed is a handle with the current slide number; nowhere else', () => {
  const stage = markup({ landscape: true })
  assert.match(stage, /data-studio-phone-landscape-layer="stage"/); assert.equal(count(stage, /data-studio-phone-fab="true"/g), 1, 'ONE floating button')
  assert.match(stage, /<button[^>]*data-studio-phone-chat="true"[^>]*>.*Chat.*<\/button>/); assert.match(stage, /data-studio-phone-chat-dot="green"/); assert.match(stage, /<span class="sr-only"> connected<\/span>/)
  assert.match(stage, /aria-label="Collapse thumbnails" aria-expanded="true"/); assert.ok(!/data-studio-phone-menu/.test(stage), 'no Menu button in the stage'); assert.ok(!/data-studio-phone-fan-card/.test(stage), 'the fan is closed until the button is tapped')
  assert.match(stage, /aria-label="Actions" aria-haspopup="menu" aria-expanded="false"/)
  const collapsed = markup({ landscape: true }, { slideNumber: 4 }, COLLAPSED)
  assert.match(collapsed, /data-studio-phone-strip-handle="true"/); assert.match(collapsed, /aria-label="Expand thumbnails" aria-expanded="false"/); assert.match(collapsed, /data-studio-phone-strip-current="true"[^>]*>4</); assert.ok(!/strip-head/.test(collapsed))
  for (const [state, tone] of [['connecting', 'amber'], ['error', 'red'], ['disconnected', 'red']]) assert.match(markup({ landscape: true }, { connectionState: state }), new RegExp(`data-studio-phone-chat-dot="${tone}"`), state)
  assert.match(markup({ landscape: true }, { connectionState: 'disconnected', reconnectStatus: 'scheduled' }), /data-studio-phone-chat-dot="amber"/)
  assert.equal(markup({ landscape: true }, { deckOnStage: false }), '', 'no deck on the stage (the welcome, a loading session): nothing'); assert.equal(markup({ landscape: true }, { stageVisible: false }), '', 'the chat or a panel is on screen: nothing (the page is as it is today)')
  assert.equal(markup({}), '', 'neither query matches (a desktop window): nothing'); assert.equal(markup({ landscape: false, portrait: false }), '')
})
await check('the portrait slide view is one Menu button (named "Menu"; the bar returns from it as a floating card) and nothing else; with the chat on screen or no deck, nothing', () => {
  const portrait = markup({ portrait: true })
  assert.match(portrait, /^<button type="button" data-studio-phone-menu="true" aria-label="Menu" aria-expanded="false">/); assert.equal(count(portrait, /<button/g), 1)
  assert.ok(!/data-studio-phone-landscape-layer/.test(portrait))
  assert.equal(markup({ portrait: true }, { stageVisible: false }), ''); assert.equal(markup({ portrait: true }, { deckOnStage: false }), '')
})
await check('every attribute the markup and the effects use is one the stylesheet is keyed to; the <html> attributes are the lib\'s constants; the fan opens from the button with the page\'s own controls (click, or the Enter key a menu trigger opens on), never re-implemented; no orientation lock anywhere', () => {
  const source = read(COMPONENT)
  for (const attr of ['STUDIO_PHONE_STAGE_ATTRIBUTE', 'STUDIO_PHONE_BAR_ATTRIBUTE', 'STUDIO_PHONE_STRIP_ATTRIBUTE', 'STUDIO_PHONE_FAN_ATTRIBUTE']) assert.ok(source.includes(attr), attr)
  assert.deepEqual([lib.STUDIO_PHONE_STAGE_ATTRIBUTE, lib.STUDIO_PHONE_BAR_ATTRIBUTE, lib.STUDIO_PHONE_STRIP_ATTRIBUTE, lib.STUDIO_PHONE_FAN_ATTRIBUTE].map(String), ['data-studio-phone-landscape', 'data-studio-phone-bar', 'data-studio-phone-strip', 'data-studio-phone-fan'])
  for (const own of source.match(/data-studio-phone-[a-z-]+/g)) assert.ok(cssText.includes(own) || /data-studio-phone-(fan-item|landscape-layer|chat-dot|strip-current|strip-label|fan-backdrop|fan-card)/.test(own), `${own} is in the stylesheet`)
  assert.match(source, /control\.dispatchEvent\(new KeyboardEvent\("keydown", \{ key: "Enter"/); assert.match(source, /control\.click\(\)/)
  for (const rel of [LIB, HOOK, COMPONENT, CSS]) assert.ok(!/orientation\s*\.\s*lock|screen\.orientation|lockOrientation|\.lock\(/.test(read(rel)), `${rel}: no orientation lock`)
  let hits = ''; try { hits = git('grep', '-n', '-E', 'orientation\\.lock|screen\\.orientation', '--', 'app', 'components', 'hooks', 'lib') } catch { /* none: exit 1 */ }
  assert.equal(hits.trim(), '', 'no orientation lock anywhere in the app')
})

// ===== 5. the stylesheet =========================================================================================================================================
await check('every rule is inside one of the two media queries (the landscape phone, the portrait phone), every selector is keyed to an <html> attribute this change sets or to one of its own elements, and no !important is used', () => {
  const rules = mine(); assert.ok(rules.length >= 30)
  for (const rule of rules) {
    assert.ok(rule.media === LANDSCAPE_MEDIA || rule.media === PORTRAIT_MEDIA, `a rule outside the two queries: ${rule.selectors[0].slice(0, 80)}`)
    for (const selector of rule.selectors) {
      assert.ok(keyed(selector), `keyed: ${selector.slice(0, 100)}`)
      if (rule.media === PORTRAIT_MEDIA) assert.ok(selector.includes('html[data-studio-phone-bar') || selector.includes('[data-studio-phone-menu'), `a portrait rule is about the bar or the Menu: ${selector.slice(0, 90)}`)
    }
    for (const decl of rule.decls) assert.ok(!decl.important, `${decl.prop} is not !important`)
  }
  assert.ok(!/!important/.test(cssText))
})
await check('the stage hides what it must (rail, tab bar, switch, pull tabs, notes handle, brand row, the viewer\'s own thumbnail toggle and resizer), cancels the viewer\'s fit padding, puts the rail on the left, takes the whole dynamic viewport, and gives the workspace the screen', () => {
  const landscape = mine().filter(rule => rule.media === LANDSCAPE_MEDIA)
  const declared = (test, prop) => landscape.find(rule => rule.selectors.some(test) && rule.decls.some(decl => decl.prop === prop))?.decls.find(decl => decl.prop === prop)?.value
  assert.equal(declared(s => s.endsWith('[data-studio-v4-shell="true"]'), 'height'), '100dvh', 'dvh, not vh: the address bar')
  assert.equal(declared(s => s.endsWith('> [data-studio-v4-rail]'), 'display'), 'none'); assert.equal(declared(s => s.endsWith('> [data-studio-phone-tabbar="true"]'), 'display'), 'none')
  const hidden = landscape.find(rule => rule.decls.some(decl => decl.prop === 'display' && decl.value === 'none') && rule.selectors.some(s => s.includes('[data-studio-workspace-switch]')))
  for (const part of ['[data-studio-workspace-switch]', '[data-studio-drawer-handle]', '[data-studio-notes-handle]', '[data-studio-canvas-brand]', '[data-studio-v4-thumbnail-toggle]', '[data-studio-v4-thumbnail-resize]']) assert.ok(hidden.selectors[0].includes(part), part)
  assert.equal(declared(s => s.endsWith('[data-studio-slide-space]'), 'margin'), '-16px', 'the slide space is 32 px larger than the space on screen (the viewer\'s own fit takes 32 px off what it measures), and the column around it clips the overhang')
  assert.ok(!landscape.some(rule => rule.selectors.some(s => s.endsWith('[data-studio-slide-space]')) && rule.decls.some(decl => decl.prop === 'padding')), 'the viewer\'s own 16 px padding is kept: the fit measures it')
  assert.equal(declared(s => s.includes('[data-studio-v4-viewer] > div:has(> [data-studio-v4-thumbnails])'), 'flex-direction'), 'row-reverse', 'the rail on the LEFT')
  assert.equal(declared(s => s.endsWith('[data-studio-v4-shell-workspace]'), 'margin'), '0'); assert.equal(declared(s => s.endsWith('[data-studio-v4-shell-workspace]'), 'border-radius'), '0'); assert.equal(declared(s => s.endsWith('[data-studio-v4-shell-workspace]'), '--studio-pane-toolbar-height'), '0px')
  assert.equal(declared(s => s.endsWith('[data-studio-v4-thumbnails]') && !s.includes('collapsed'), 'border-left'), '0'); assert.equal(declared(s => s.includes('[data-studio-phone-strip="collapsed"]') && s.endsWith('[data-studio-v4-viewer]'), 'padding-left'), '30px', 'the collapsed strip is a 30 px handle')
  assert.ok(landscape.every(rule => rule.selectors.every(s => !/^\[data-studio-v4-shell/.test(s))), 'no stage rule starts at the shell without the <html> key')
})
await check('the top bar and the authoring row are NOT display: none in the stage: they are out of the flow, laid out and invisible (the fan clicks their controls and their menus open beside the fan button, which a display: none anchor would not allow)', () => {
  const rule = mine().find(rule => rule.media === LANDSCAPE_MEDIA && rule.selectors.some(s => s.includes('[data-studio-v4-shell-header]')) && rule.selectors.some(s => s.includes('[data-studio-authoring-slot]')))
  assert.ok(rule, 'one rule for both'); const value = prop => rule.decls.find(decl => decl.prop === prop)?.value
  assert.equal(value('position'), 'fixed'); assert.equal(value('visibility'), 'hidden'); assert.equal(value('pointer-events'), 'none'); assert.ok(!rule.decls.some(decl => decl.prop === 'display'), 'no display at all')
  assert.ok(!mine().some(r => r.selectors.some(s => /\[data-studio-v4-shell-header\]|\[data-studio-authoring-slot\]/.test(s) && !s.includes(',')) && r.decls.some(decl => decl.prop === 'display' && decl.value === 'none')), 'nowhere else is either one display: none')
})
await check('the portrait fold: the bar is gone in the slide view and its bottom padding with it; Menu brings the SAME bar back as a floating card above the button; the Menu button is the one new element', () => {
  const portrait = mine().filter(rule => rule.media === PORTRAIT_MEDIA)
  const find = (test, prop) => portrait.find(rule => rule.selectors.some(test) && rule.decls.some(decl => decl.prop === prop))?.decls.find(decl => decl.prop === prop)?.value
  assert.equal(find(s => s.startsWith('html[data-studio-phone-bar] ') && s.endsWith('> [data-studio-phone-tabbar="true"]'), 'display'), 'none')
  assert.equal(find(s => s.startsWith('html[data-studio-phone-bar] ') && s.includes(':has('), 'padding-bottom'), '0')
  assert.equal(find(s => s.startsWith('html[data-studio-phone-bar="open"]') && s.endsWith('[data-studio-phone-tabbar="true"]'), 'display'), 'flex'); assert.equal(find(s => s.startsWith('html[data-studio-phone-bar="open"]'), 'position'), undefined, 'position is the phone shell\'s own (fixed)')
  assert.match(find(s => s.startsWith('html[data-studio-phone-bar="open"]'), 'bottom'), /^74px$/); assert.equal(find(s => s === '[data-studio-phone-menu="true"]', 'position'), 'fixed')
})
const cascadeOf = text => {
  const theirs = ruleList(shellCssText).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls }))), ours = ruleList(text).flatMap(rule => rule.selectors.map(selector => ({ selector, decls: rule.decls, media: rule.media })))
  const pairs = [
    ['the bar\'s display: flex', s => s.endsWith('> [data-studio-phone-tabbar="true"]') && !s.includes('composer'), 'display', t => t.endsWith('> [data-studio-phone-tabbar="true"]'), 'display'],
    ['the shell\'s bottom padding', s => s.includes(':has(> [data-studio-phone-tabbar="true"])') && !s.includes('[data-composer-focus'), 'padding-bottom', t => t.includes(':has(> [data-studio-phone-tabbar="true"])') && !t.includes('composer-focus'), 'padding-bottom'],
    ['the workspace\'s 10 px left margin at 640 px and narrower (a 568 px phone turned sideways)', s => s.endsWith('> [data-studio-v4-shell-workspace]'), 'margin-left', t => t.endsWith('> [data-studio-v4-shell-workspace]'), 'margin-left'],
  ]
  let compared = 0
  for (const [label, wantOurs, ourProp, wantTheirs, theirProp] of pairs) {
    const mineRules = ours.filter(rule => wantOurs(rule.selector) && rule.decls.some(decl => decl.prop === ourProp)), others = theirs.filter(rule => wantTheirs(rule.selector) && rule.decls.some(decl => decl.prop === theirProp))
    assert.ok(mineRules.length >= 1 && others.length >= 1, `${label}: rules on both sides`)
    for (const a of mineRules) for (const b of others) { assert.ok(cmp(specificity(a.selector), specificity(b.selector)) > 0, `${label}: ours ${specificity(a.selector)} beats ${specificity(b.selector)}`); compared++ }
  }
  assert.ok(compared >= 4, `compared ${compared}`)
}
await check('cascade: every rule of this change that overrides a rule of the phone shell\'s own sheet (the bar\'s display and position, the shell\'s bottom padding) is MORE specific, so it wins whatever the order, with no !important', () => cascadeOf(cssText))

// ===== 6. the insertions ================================================================================================================================================
await check('the Builder page and the viewer without this change\'s lines are the base commit\'s files byte for byte (no existing line is rewritten), also through the registry, and twice changes nothing more; a file it does not own comes back as it is', () => {
  for (const rel of PHONE_LANDSCAPE_FILES) {
    const now = read(rel), base = baseText(rel)
    assert.notEqual(now, base); assert.equal(stripPhoneLandscape(rel, otherStrips(rel, now)), otherStrips(rel, base), rel)
    assert.equal(stripPhoneLandscape(rel, stripPhoneLandscape(rel, now)), stripPhoneLandscape(rel, now)); assert.equal(registry.stripLaterChanges(rel, now), registry.stripLaterChanges(rel, base), `${rel} through the registry`)
  }
  assert.equal(stripPhoneLandscape('lib/anything.ts', 'x'), 'x'); assert.equal(stripPhoneLandscape(PAGE, 5), 5)
})
await check('the marked lines are where they should be: the page has three imports, the workspace clamp\'s call and one line of JSX (five), every one names the marker as a whole token, no existing line is rewritten; the viewer is not touched at all, and the two lines of it the stage\'s CSS relies on are still there (its 16 px padding, and the fit that takes 32 px off what it measures)', () => {
  const page = read(PAGE), viewer = read(VIEWER)
  assert.equal(count(page, /^.*PHONE-LANDSCAPE.*$/gm), 5)
  for (const line of page.split('\n').filter(line => /PHONE-LANDSCAPE/.test(line))) assert.match(line, PHONE_LANDSCAPE_MARKER_RE)
  assert.match(page, /useStudioPhoneWorkspaceClamp\(workspaceWidth, setWorkspaceWidth\) \/\/ PHONE-LANDSCAPE/); assert.ok(page.indexOf('useStudioPhoneWorkspaceClamp(workspaceWidth') < page.indexOf('const studioOverlayWorkspace ='), 'the clamp is called before the page decides by the width')
  assert.ok(page.indexOf('const [workspaceWidth, setWorkspaceWidth] = useState(1100)') < page.indexOf('useStudioPhoneWorkspaceClamp(workspaceWidth'), 'after the state it reads and sets')
  assert.match(page, /const studioOverlayWorkspace = studioShell && workspaceWidth <= 880\n/, 'the page\'s own line is as it was')
  assert.match(page, /stageVisible=\{studioOverlayWorkspace && !studioCanvasCovered\}/); assert.match(page, /deckOnStage=\{Boolean\(effectivePresentationUrl\) && !studioWelcome && !session\.isLoadingSession\}/); assert.match(page, /onChat=\{\(\) => \{ selectWorkspacePane\('chat'\); if \(!showChat\) setShowChat\(true\) \}\}/, 'Chat is the Director pane of the switch')
  assert.equal(viewer, baseText(VIEWER), 'the viewer is the base\'s, byte for byte'); assert.equal(count(viewer, /PHONE-LANDSCAPE/g), 0)
  assert.match(viewer, /const pw = width - 32, ph = height - 32/, 'the viewer\'s fit takes 32 px off the box it measures: the stage\'s -16px margin gives it exactly the whole space'); assert.match(viewer, /'bg-gray-100 dark:bg-slate-800 p-4'/, 'and the slide space keeps its own p-4')
  assert.match(viewer, /data-studio-v4-thumbnail-toggle=\{studioShell \? "true" : undefined\}[\s\S]{0,1400}aria-expanded=\{railShown\}/, 'the rail toggle the stage clicks says whether the rail is open'); assert.match(viewer, /onClick=\{handleToggleOverview\}/, 'and its click is the viewer\'s own handler')
})

// ===== 7. scope =====================================================================================================================================================
console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-01T00:00:00Z' }
const plumb = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...(input === undefined ? {} : { input }), env: { ...process.env, ...GIT_IDENT }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpl-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(PHONE_LANDSCAPE_SUBJECT)
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
const OLDER_PREFIXES = /^(Stage open gate:|Chat column wide:|Welcome trim:|Director mark trim:|Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:|Text set keep look:|Structural refine decline:)/
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
  assert.deepEqual([...touched].sort(), [...PHONE_LANDSCAPE_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  for (const rel of PHONE_LANDSCAPE_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) {
      assert.ok(!line.startsWith('-'), `${rel}: a removed line (this change only inserts): ${line.slice(0, 120)}`)
      assert.match(line, PHONE_LANDSCAPE_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`)
    }
    assert.ok(diff.filter(line => line.startsWith('+')).length > 0, `${rel}: the number of added lines`)
    assert.equal(stripPhoneLandscape(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of PHONE_LANDSCAPE_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of PHONE_LANDSCAPE_PIN_FILES) {
    const now = git('show', `${head}:${rel}`), base = git('show', `${BASE_COMMIT}:${rel}`)
    assert.equal(stripPhoneLandscape(rel, otherStrips(rel, now)), otherStrips(rel, base), `${rel}: an older proof taught one line; putting it back (past the changes registered after this one) gives dev's proof byte for byte`)
    assert.equal(stripPhoneLandscape(rel, stripPhoneLandscape(rel, otherStrips(rel, now))), otherStrips(rel, base), `${rel}: putting back twice changes nothing more`)
    for (const [has, was] of PHONE_LANDSCAPE_PIN_EDITS[rel]) { assert.equal(now.split(has).length - 1, 1, `${rel}: the taught line is there exactly once`); assert.equal(was, '', `${rel}: a pure insertion`); for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(PHONE_LANDSCAPE_PIN_MARK), `${rel}: the taught line carries the registry-read mark`) }
    const added = diffLines(normDiff(ctx, rel, head)); assert.ok(added.length >= 1 && added.every(line => line.startsWith('+') && line.includes(PHONE_LANDSCAPE_PIN_MARK)), `${rel}: every line this change added to the proof carries the mark and none is removed`)
  }
  for (const rel of ['components/presentation-viewer.tsx', 'components/layout/studio-phone-tab-bar.tsx', 'components/layout/studio-phone-shell.css', 'components/builder/studio-phone-builder-top.tsx', 'components/builder/studio-phone-builder-top.css', 'lib/studio-phone-shell.ts', 'lib/studio-phone-builder-top.ts', 'components/slide-thumbnail-strip.tsx',
    'components/builder/studio-workspace.css', 'lib/studio-workspace-layout.ts', 'app/layout.tsx', 'components/builder/presentation-area.tsx', 'hooks/use-deckster-websocket-v2.ts', 'package.json']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const envText = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(envText), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(envText.split(PHONE_LANDSCAPE_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(envText, new RegExp(`\\n\\n${PHONE_LANDSCAPE_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes('studio-phone-landscape-strip.mjs'))
  assert.equal(own.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['PHONE_LANDSCAPE_SCOPE_FILES', 'PHONE_LANDSCAPE_ENV_BLOCK', 'stripPhoneLandscape'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${PHONE_LANDSCAPE_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to an existing file is a pure insertion that carries the marker; the strip gives the base back byte for byte; the phone shell\'s own files, the rail strip and the layout allocator are not touched', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of PHONE_LANDSCAPE_NEW_FILES.filter(rel => !rel.endsWith('.css'))) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of PHONE_LANDSCAPE_FILES) assert.equal(stripPhoneLandscape(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpl-idx-'))
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
const syntheticStrip = (rel, text) => PHONE_LANDSCAPE_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const edits = {}
  for (const rel of PHONE_LANDSCAPE_FILES) {
    const lines = at(rel).split('\n'); let done = false
    edits[rel] = lines.flatMap(line => { if (!done && PHONE_LANDSCAPE_MARKER_RE.test(line) && line.startsWith('import ')) { done = true; return [line, `const syntheticLater = 1 // ${SYN.marker}`] } return [line] }).join('\n')
    assert.ok(edits[rel].includes(SYN.marker), `the synthetic anchor exists in ${rel}`)
  }
  edits['scripts/studio-later-changes.mjs'] = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('PHONE_LANDSCAPE_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('PHONE_LANDSCAPE_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripPhoneLandscape')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
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
  for (const rel of PHONE_LANDSCAPE_FILES) assert.equal(stripPhoneLandscape(rel, SYN_CTX.norm(rel, git('show', `${gate}:${rel}`))), SYN_CTX.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree is the base's ${rel} without this change's and the later change's lines`)
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
  for (const rel of PHONE_LANDSCAPE_FILES) assert.equal(stripPhoneLandscape(rel, syntheticStrip(rel, otherStrips(rel, git('show', `${SYNTHETIC}:${rel}`)))), otherStrips(rel, baseText(rel)), `${rel}: either order of the two strips gives the base (read past the changes registered after this one, as every other check here does)`)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its lines are unmarked additions, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray foreign file in a "Phone landscape:" commit fails the committed-files check (own commits found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-phone-landscape.txt': 'stray\n' }, `${PHONE_LANDSCAPE_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, an unmarked line added to the page or the viewer in an own commit, and a touched foreign file (the phone shell\'s bar, the rail strip), fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${PHONE_LANDSCAPE_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of PHONE_LANDSCAPE_FILES) {
    const sneaky = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`).replace('\nexport ', '\nconst sneaky = 1\nexport ').replace(/^(import [^\n]*\n)/m, '$1const sneaky = 1\n') }, `${PHONE_LANDSCAPE_SUBJECT} a sneaky line${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/, rel)
  }
  for (const rel of ['components/layout/studio-phone-tab-bar.tsx', 'components/slide-thumbnail-strip.tsx']) {
    const foreign = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`) + '\n' }, `${PHONE_LANDSCAPE_SUBJECT} touches ${rel}${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched/, rel)
  }
})

// ===== 8. mutants (each one edit of the real sources, fed to the same checks) =============================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const libSrc = read(LIB), hookSrc = read(HOOK), componentSrc = read(COMPONENT), pageSrc = read(PAGE)
const sheet = text => ruleList(text)
const notKeyed = text => { for (const rule of sheet(text)) for (const selector of rule.selectors) assert.ok(keyed(selector), selector.slice(0, 80)) }
await mutant('the flag is read as truthy, not exactly "true"', () => assert.equal(libWith({ flag: 'false' }, { [LIB]: swap(libSrc, "flag === 'true' && phoneShell", "flag !== undefined && phoneShell") }).STUDIO_PHONE_LANDSCAPE_ENABLED, false))
await mutant('the flag no longer needs the phone shell', () => assert.equal(libWith({ flag: 'true', phoneShell: 'false' }, { [LIB]: swap(libSrc, " && phoneShell === 'true'", '') }).STUDIO_PHONE_LANDSCAPE_ENABLED, false))
await mutant('the flag no longer needs the Studio shell', () => assert.equal(libWith({ flag: 'true', shell: 'false' }, { [LIB]: swap(libSrc, " && studioShell === 'true'", '') }).STUDIO_PHONE_LANDSCAPE_ENABLED, false))
await mutant('the landscape query loses its coarse-pointer term (a short desktop window would match)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, ' and (pointer: coarse)', '') }).STUDIO_PHONE_LANDSCAPE_QUERY, LANDSCAPE_MEDIA))
await mutant('the landscape query is width-based (a narrow desktop window would match)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, '(max-height: 500px)', '(max-width: 932px)') }).STUDIO_PHONE_LANDSCAPE_QUERY, LANDSCAPE_MEDIA))
await mutant('the stage no longer needs the stage on screen (the chat would be hidden behind the chrome-less stage)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, ' && input.stageVisible === true\n}\n\n/** The portrait slide view', '\n}\n\n/** The portrait slide view') }).studioPhoneLandscapeStage({ enabled: true, landscape: true, deckOnStage: true, stageVisible: false }), false))
await mutant('the stage is on without a deck (the welcome would lose its chrome)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, ' && input.deckOnStage === true && input.stageVisible === true\n}\n\n/** The portrait slide view', ' && input.stageVisible === true\n}\n\n/** The portrait slide view') }).studioPhoneLandscapeStage({ enabled: true, landscape: true, deckOnStage: false, stageVisible: true }), false))
await mutant('the workspace is clamped off a phone turned sideways too (a desktop window would be told 880)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, 'return landscape === true && width > STUDIO_PHONE_OVERLAY_MAX_WIDTH ? STUDIO_PHONE_OVERLAY_MAX_WIDTH : width', 'return width > STUDIO_PHONE_OVERLAY_MAX_WIDTH ? STUDIO_PHONE_OVERLAY_MAX_WIDTH : width') }).studioPhoneWorkspaceWidth(false, 1440), 1440))
await mutant('the workspace clamp\'s threshold drifts from the page\'s own 880', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, 'export const STUDIO_PHONE_OVERLAY_MAX_WIDTH = 880', 'export const STUDIO_PHONE_OVERLAY_MAX_WIDTH = 900') }).STUDIO_PHONE_OVERLAY_MAX_WIDTH, 880))
await mutant('the workspace clamp is called after the page decides by the width', () => { const bad = pageSrc.replace(/^.*useStudioPhoneWorkspaceClamp\(workspaceWidth[^\n]*\n/m, '').replace('  const studioOverlayWorkspace = studioShell && workspaceWidth <= 880\n', '  const studioOverlayWorkspace = studioShell && workspaceWidth <= 880\n  useStudioPhoneWorkspaceClamp(workspaceWidth, setWorkspaceWidth) // PHONE-LANDSCAPE\n'); assert.ok(bad.indexOf('useStudioPhoneWorkspaceClamp(workspaceWidth') < bad.indexOf('const studioOverlayWorkspace =')) })
await mutant('the strip starts collapsed', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "STUDIO_PHONE_STRIP_DEFAULT: StudioPhoneStripState = 'open'", "STUDIO_PHONE_STRIP_DEFAULT: StudioPhoneStripState = 'collapsed'") }).STUDIO_PHONE_STRIP_DEFAULT, 'open'))
await mutant('the stage forgets to remember the portrait value (a rail closed in portrait would stay open after the stage)', () => assert.deepEqual({ ...libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "const keep = remembered === null ? railOpen : remembered", "const keep = railOpen") }).studioPhoneRailSync({ stage: true, strip: 'collapsed', railOpen: true, remembered: false }) }, { click: true, remembered: false, done: true }))
await mutant('the stage follows the viewer\'s own value, not the strip\'s (a collapsed strip would stay open)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "click: railOpen !== (strip === 'open')", "click: false") }).studioPhoneRailSync({ stage: true, strip: 'collapsed', railOpen: true, remembered: null }).click, true))
await mutant('leaving the stage does not put the portrait value back (the rail opened sideways would squeeze the portrait slide)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "return { click: railOpen !== remembered, remembered: null, done: true }", "return { click: false, remembered: null, done: true }") }).studioPhoneRailSync({ stage: false, strip: 'open', railOpen: true, remembered: false }).click, true))
await mutant('the stage clicks the toggle again after it has made the rail the strip\'s (it would flip it back)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "click: railOpen !== (strip === 'open')", "click: true") }).studioPhoneRailSync({ stage: true, strip: 'open', railOpen: true, remembered: false }).click, false))
await mutant('the stage says it is done before the toggle has arrived (the observer would never wait for it)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "if (railOpen === null) return { click: false, remembered, done: false }", "if (railOpen === null) return { click: false, remembered, done: true }") }).studioPhoneRailSync({ stage: true, strip: 'open', railOpen: null, remembered: null }).done, false))
await mutant('the rail sync clicks with the flag off', () => { const rail = railPage(false), rt = hookRuntime(); setFlags({}); const hook = makeLoader({ reactImpl: rt.impl, globals: { window: windowStub(), document: rail.document, MutationObserver: rail.MutationObserver }, sourceOverrides: { [HOOK]: swap(hookSrc, '    if (!STUDIO_PHONE_LANDSCAPE_ENABLED) return\n    const sync', '    const sync') } }).load(HOOK); setFlags({}); rt.render(() => hook.useStudioPhoneRailSync(true, 'open')); assert.deepEqual(rail.log, []) })
await mutant('the rail sync keeps its observer after the toggle has answered', () => { const rail = railPage(false, { arriveLater: true }), rt = hookRuntime(); setFlags({ flag: 'true' }); const hook = makeLoader({ reactImpl: rt.impl, globals: { window: windowStub(), document: rail.document, MutationObserver: rail.MutationObserver }, sourceOverrides: { [HOOK]: swap(hookSrc, 'if (sync()) observer.disconnect()', 'sync()') } }).load(HOOK); setFlags({}); rt.render(() => hook.useStudioPhoneRailSync(true, 'open')); rail.arrive(); assert.ok(rail.log.includes('disconnect')) })
await mutant('the rail sync reads the toggle by a selector that is not the viewer\'s', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, '[data-studio-v4-thumbnail-toggle="true"]', '[data-studio-thumbnail-toggle="true"]') }).STUDIO_PHONE_RAIL_TOGGLE, '[data-studio-v4-thumbnail-toggle="true"]'))
await mutant('the page\'s width is clamped when the phone is not turned sideways (a portrait phone would be told 880)', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, 'return landscape === true && width', 'return width') }).studioPhoneWorkspaceWidth(false, 932), 932))
await mutant('the fan drops the strip\'s own entry', () => assert.ok(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "if (key === 'thumbnails') { items.push({ key, label: stripState === 'open' ? 'Hide thumbnails' : 'Show thumbnails', disabled: false }); continue }", "if (key === 'thumbnails') continue") }).studioPhoneFanItems({}, 'open').some(item => item.key === 'thumbnails')))
await mutant('the fan lists a control that is not on the page', () => assert.equal(libWith({ flag: 'true' }, { [LIB]: swap(libSrc, '    if (!probe) continue\n', '    if (!probe) { items.push({ key, label: FAN_FALLBACK[key], disabled: true }); continue }\n') }).studioPhoneFanItems({}, 'open').length, 1))
await mutant('the fan puts Add element before Add slide', () => assert.deepEqual([...libWith({ flag: 'true' }, { [LIB]: swap(libSrc, "['addSlide', 'addElement', 'newDeck'", "['addElement', 'addSlide', 'newDeck'") }).STUDIO_PHONE_FAN_ORDER].slice(0, 2), ['addSlide', 'addElement']))
await mutant('the media-query hook is listened to with the flag off', () => { const w = windowStub({}); const impl = { ...React, useSyncExternalStore: (subscribe, snapshot) => { subscribe(() => {}); return snapshot() } }; setFlags({}); try { makeLoader({ reactImpl: impl, globals: { window: w }, sourceOverrides: { [HOOK]: swap(hookSrc, 'if (!STUDIO_PHONE_LANDSCAPE_ENABLED || typeof window', 'if (typeof window') } }).load(HOOK).useStudioPhoneQuery('(x)') } finally { setFlags({}) } assert.deepEqual(w.asked, []) })
await mutant('the component draws two floating buttons', () => assert.equal(count(renderToStaticMarkup(React.createElement((() => { setFlags({ flag: 'true' }); try { return makeLoader({ stubs: stubFor({ landscape: true }), sourceOverrides: { [COMPONENT]: swap(componentSrc, '          <button ref={fab} type="button" data-studio-phone-fab="true"', '          <button type="button" data-studio-phone-fab="true" /><button ref={fab} type="button" data-studio-phone-fab="true"') } }).load(COMPONENT).StudioPhoneLandscape } finally { setFlags({}) } })(), { deckOnStage: true, stageVisible: true, slideNumber: 1, connectionState: 'connected', onChat() {} })), /data-studio-phone-fab="true"/g), 1))
await mutant('the component draws in the stage without a deck on it', () => { setFlags({ flag: 'true' }); try { const C = makeLoader({ stubs: stubFor({ landscape: true }), sourceOverrides: { [COMPONENT]: swap(componentSrc, 'studioPhoneLandscapeStage({ enabled: true, landscape, deckOnStage, stageVisible })', 'studioPhoneLandscapeStage({ enabled: true, landscape, deckOnStage: true, stageVisible })') } }).load(COMPONENT).StudioPhoneLandscape; assert.equal(renderToStaticMarkup(React.createElement(C, { deckOnStage: false, stageVisible: true, slideNumber: 1, connectionState: 'connected', onChat() {} })), '') } finally { setFlags({}) } })
await mutant('Chat names no connection state (the dot would say nothing to a screen reader)', () => { setFlags({ flag: 'true' }); try { const C = makeLoader({ stubs: stubFor({ landscape: true }), sourceOverrides: { [COMPONENT]: swap(componentSrc, 'Chat<span className="sr-only">{` ${dot.state}`}</span>', 'Chat') } }).load(COMPONENT).StudioPhoneLandscape; assert.match(renderToStaticMarkup(React.createElement(C, { deckOnStage: true, stageVisible: true, slideNumber: 1, connectionState: 'connected', onChat() {} })), /sr-only/) } finally { setFlags({}) } })
await mutant('a rule loses its <html> key (it would match with the flag off)', () => notKeyed(swap(cssText, `  ${STAGE} [data-studio-v4-shell="true"] > [data-studio-v4-rail] { display: none; }`, '  [data-studio-v4-shell="true"] > [data-studio-v4-rail] { display: none; }')))
await mutant('a rule sits outside the media queries', () => { const text = cssText + '\nhtml[data-studio-phone-landscape="stage"] [data-studio-v4-shell="true"] { color: red; }\n'; for (const rule of sheet(text)) assert.ok(rule.media === LANDSCAPE_MEDIA || rule.media === PORTRAIT_MEDIA) })
await mutant('a rule uses !important', () => assert.ok(!/!important/.test(swap(cssText, '[data-studio-slide-space] { margin: -16px; }', '[data-studio-slide-space] { margin: -16px !important; }'))))
await mutant('the stage query drops the coarse pointer in the stylesheet only (the lib and the sheet would disagree)', () => assert.deepEqual([...new Set(ruleList(cssText.replace('@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse)', '@media (orientation: landscape) and (max-height: 500px)')).map(rule => rule.media))].sort(), [LANDSCAPE_MEDIA, PORTRAIT_MEDIA].sort()))
await mutant('the top bar is hidden with display: none (the fan\'s menus would anchor at the corner)', () => { const text = swap(cssText, 'visibility: hidden; pointer-events: none;', 'display: none;'); const rule = ruleList(text).find(r => r.selectors.some(s => s.includes('[data-studio-v4-shell-header]')) && r.selectors.some(s => s.includes('[data-studio-authoring-slot]'))); assert.ok(!rule.decls.some(decl => decl.prop === 'display')) })
await mutant('the slide space loses its negative margin (the viewer\'s own fit would leave 16 px a side)', () => assert.equal(ruleList(swap(cssText, '[data-studio-slide-space] { margin: -16px; }', '[data-studio-slide-space] { color: inherit; }')).find(rule => rule.media === LANDSCAPE_MEDIA && rule.selectors.some(s => s.endsWith('[data-studio-slide-space]')))?.decls.find(decl => decl.prop === 'margin')?.value, '-16px'))
await mutant('the slide space\'s padding is zeroed as well (the fit would then measure 32 px too little)', () => assert.ok(!ruleList(swap(cssText, '[data-studio-slide-space] { margin: -16px; }', '[data-studio-slide-space] { margin: -16px; padding: 0; }')).some(rule => rule.media === LANDSCAPE_MEDIA && rule.selectors.some(s => s.endsWith('[data-studio-slide-space]')) && rule.decls.some(decl => decl.prop === 'padding'))))
await mutant('the rail stays on the right (no row-reverse)', () => assert.ok(ruleList(swap(cssText, 'flex-direction: row-reverse;', 'flex-direction: row;')).some(rule => rule.decls.some(decl => decl.value === 'row-reverse'))))
await mutant('the shell is 100vh in the stage (iOS counts the address bar)', () => assert.ok(ruleList(swap(cssText, 'height: 100dvh;', 'height: 100vh;')).some(rule => rule.decls.some(decl => decl.value === '100dvh'))))
await mutant('the folded bar keeps its bottom padding (the page would keep 56 px of nothing)', () => assert.equal(ruleList(swap(cssText, `  html[data-studio-phone-bar] [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) { padding-bottom: 0; }`, '')).find(rule => rule.media === PORTRAIT_MEDIA && rule.selectors.some(s => s.startsWith('html[data-studio-phone-bar] ') && s.includes(':has(')))?.decls.find(decl => decl.prop === 'padding-bottom')?.value, '0'))
await mutant('the folded bar loses its <html> key (it would tie with the phone shell\'s own bar rule and lose to it by order)', () => cascadeOf(swap(cssText, 'html[data-studio-phone-bar] [data-studio-v4-shell="true"] > [data-studio-phone-tabbar="true"] { display: none; }', '[data-studio-v4-shell="true"] > [data-studio-phone-tabbar="true"] { display: none; }')))
await mutant('the stage rule for the workspace\'s left margin is gone (a 568 px phone would keep the phone shell\'s 10 px band)', () => cascadeOf(swap(cssText, `  html[data-studio-phone-landscape="stage"] [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) > [data-studio-v4-shell-column] > [data-studio-v4-shell-workspace] { margin-left: 0; }\n`, '')))
await mutant('the stage rule for the workspace\'s left margin loses its <html> key (it would tie with the phone shell\'s own rule and lose by order)', () => cascadeOf(swap(cssText, `${STAGE} [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) > [data-studio-v4-shell-column] > [data-studio-v4-shell-workspace] { margin-left: 0; }`, `[data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) > [data-studio-v4-shell-column] > [data-studio-v4-shell-workspace] { margin-left: 0; }`)))
await mutant('the stage rule for the shell\'s bottom padding loses a step of specificity', () => cascadeOf(swap(cssText, `${STAGE} [data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) { padding-bottom: 0; }`, '[data-studio-v4-shell="true"]:has(> [data-studio-phone-tabbar="true"]) { padding-bottom: 0; }')))
await mutant('a marker line is mistyped (the strip would leave it behind)', () => assert.equal(stripPhoneLandscape(PAGE, pageSrc.replace("import { useStudioPhoneWorkspaceClamp } from '@/hooks/use-studio-phone-landscape' // PHONE-LANDSCAPE", "import { useStudioPhoneWorkspaceClamp } from '@/hooks/use-studio-phone-landscape' // PHONE-LANDSCAPEE")), baseText(PAGE)))
await mutant('the page\'s own overlay line is rewritten (a pin: older proofs that tolerate only insertions would fail)', () => assert.match(swap(pageSrc, 'const studioOverlayWorkspace = studioShell && workspaceWidth <= 880\n', 'const studioOverlayWorkspace = studioShell && (workspaceWidth <= 880 || true) // PHONE-LANDSCAPE\n'), /const studioOverlayWorkspace = studioShell && workspaceWidth <= 880\n/))
await mutant('an orientation lock is added to the component', () => assert.ok(!/orientation\s*\.\s*lock|screen\.orientation/.test(componentSrc + '\nscreen.orientation.lock("landscape")\n')))
await mutant('the page mounts the component without the constant', () => assert.match(swap(pageSrc, '{STUDIO_PHONE_LANDSCAPE_ENABLED && <StudioPhoneLandscape ', '{<StudioPhoneLandscape '), /\{STUDIO_PHONE_LANDSCAPE_ENABLED && <StudioPhoneLandscape /))

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
