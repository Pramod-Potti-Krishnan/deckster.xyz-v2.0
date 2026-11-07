// FRONTEND-2 (B64): proof of UX findings E (PROGRAM-1's item E, FRONTEND-1's 4 Nov UX pass: UX-08, UX-11, UX-12, UX-19, UX-22, UX-26, UX-27), behind ONE flag, NEXT_PUBLIC_STUDIO_UX_FINDINGS_E (exact "true", with the Studio shell, default off).
//
//   node scripts/test-studio-ux-findings-e.mjs        (plain node: transpile + vm of the REAL sources, react-dom/server for the markup, a small effect runner for the hook; no network, no browser, no .next, no Next runtime; well under 2 minutes)
//
// What it proves:
//  A. the flag reader: on only for the exact "true" (and the Studio shell); "1", "TRUE", " true", "yes" and "" are off; the logo and nav switches the same; the profile redirect names one route; the intro-once rules (played / first time / another account /
//     storage down) are the ones written, and FRONTEND-1's REAL intro code (its seenWorkspaces, its store, its screens, its open event, its seen gate) reads what they write;
//  B. the mount: null with the flag off, and nothing drawn with it on; with the flag off the hook sets no attribute, adds no listener, writes no storage and redirects nowhere; with it on it sets the attribute (and the logo / nav attributes only with their own
//     flags), takes them off on unmount, records the intro as played, and redirects /settings/profile (and only that) to /studio/details. FRONTEND-1's four lines (a DRAFT until OK'd: UX_FINDINGS_E_FE1_DRAFT, then UX_FINDINGS_E_FE1_OK) are checked
//     once each, at their anchor, pure insertions, marked; the account layout renders the same markup with and without them. The Builder page needs the real Next runtime: its hook line is checked by position and by the same hook harness, not rendered;
//  C. the stylesheet is PARSED: every rule (also inside @media) is scoped under html[data-studio-ux-findings-e="true"], no !important, no colour, every class and attribute it names is live in the sources, every finding has its rule;
//  D. the strip: put back = dev for every edited file, idempotent, an untouched file unchanged, every taught line carries the mark;
//  E. the registry: exactly this change's THREE lines (files, env block, strip), each at the true end of its list; .env.example is dev's plus the block at the true end;
//  F. scope over the COMMITTED diff, GATE-SAFE (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, no hash-object --stdin), each with the co-author line; the whole-diff filter leaves a later REGISTERED file to its change;
//  G. ROBUST AFTER MERGE (a second-parent synthetic) and a LINEAR STACK (a later change directly on this head adds registered-shape lines below ours and a subject-filter line beside ours; an unregistered file in it still fails);
//  H. mutants are caught (each is one edit of the real sources, fed to the same checks).
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
import {
  BASE_COMMIT, UX_FINDINGS_E_EDITS, UX_FINDINGS_E_ENV_BLOCK, UX_FINDINGS_E_FE1_DRAFT, UX_FINDINGS_E_FE1_DRAFT_EDITS, UX_FINDINGS_E_FE1_FILES, UX_FINDINGS_E_FE1_OK, UX_FINDINGS_E_FIRST_PARENT_LINE, UX_FINDINGS_E_FLAG,
  UX_FINDINGS_E_MARKER_RE, UX_FINDINGS_E_NEW_FILES, UX_FINDINGS_E_OWN_EDITS, UX_FINDINGS_E_PIN_AFTER, UX_FINDINGS_E_PIN_EDITS, UX_FINDINGS_E_PIN_FILES, UX_FINDINGS_E_PIN_MARK, UX_FINDINGS_E_REGISTRY_ENV_LINE,
  UX_FINDINGS_E_REGISTRY_FILES_LINE, UX_FINDINGS_E_REGISTRY_STRIP_LINE, UX_FINDINGS_E_SCOPE_FILES, UX_FINDINGS_E_SUBJECT, stripUxFindingsE,
} from './studio-ux-findings-e-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
/** Only the strips of the changes registered AFTER this one, in the registry's order: on a branch stacked after this change a later change's own lines are undone first, so a file reads as this change left it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripUxFindingsE); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const count = (text, needle) => text.split(needle).length - 1

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
/** A mutant is caught only by a failed ASSERTION of a check. A mutant whose edit did not apply (SwapError) or that crashed some other way proves nothing and is reported as missed. */
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}  [${String(error.message).replace(/\s+/g, ' ').slice(0, 100)}]`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

// ---- the real sources in a vm -------------------------------------------------------------------------------------------------------------------
const LIB = 'lib/studio-ux-findings-e.ts', MOUNT = 'components/studio-ux-findings-e/studio-ux-findings-e-mount.tsx', CSS = 'components/studio-ux-findings-e/studio-ux-findings-e.css'
const LAYOUT = 'app/(app)/layout.tsx', BUILDER = 'app/builder/page.tsx', INTRO = 'components/workspace-intro/workspace-intro.tsx', REGISTRY = 'scripts/studio-later-changes.mjs', ENV_FILE = '.env.example'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', LOGO = 'NEXT_PUBLIC_STUDIO_NEW_LOGO', NAV = 'NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS'
const ON = { [UX_FINDINGS_E_FLAG]: 'true', [SHELL]: 'true' }
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const h = React.createElement
/** Load one real source in a new context. `overrides` replace any import; the lib is the REAL source with the same env; `globals` are the window / document of the test. */
function load(rel, { env = {}, text, overrides = {}, globals = {} } = {}) {
  const module = { exports: {} }
  const req = spec => {
    if (spec in overrides) return overrides[spec]
    if (spec === 'react') return React
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    if (spec === '@/lib/studio-ux-findings-e') return load(LIB, { env })
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, text ?? read(rel)), { module, exports: module.exports, require: req, process: { env: { ...env } }, ...globals }, { filename: rel })
  return module.exports
}
const lib = (env, text) => load(LIB, { env, text })
const LIB_SRC = read(LIB), MOUNT_SRC = read(MOUNT), CSS_SRC = read(CSS)

// ---- a window, a document and a storage for the hook: every write and every listener is recorded -------------------------------------------------
function makeWindow(store = {}, { storageThrows = false } = {}) {
  const attrs = new Map(), listeners = new Map(), timers = [], data = new Map(Object.entries(store)), writes = [], log = []
  const boom = () => { throw new Error('storage unavailable') }
  const localStorage = { getItem: key => (storageThrows ? boom() : data.has(key) ? data.get(key) : null), setItem: (key, value) => { if (storageThrows) boom(); writes.push([key, String(value)]); data.set(key, String(value)) }, removeItem: key => { if (storageThrows) boom(); writes.push([key, null]); data.delete(key) } }
  const win = {
    localStorage, __decksterWorkspaceIntrosV2: new Set(), attrs, data, writes, timers, log,
    document: { documentElement: { setAttribute: (name, value) => { log.push(['attr', name]); attrs.set(name, value) }, removeAttribute: name => { log.push(['unattr', name]); attrs.delete(name) } } },
    addEventListener: (type, fn) => { log.push(['listen', type]); listeners.set(type, [...(listeners.get(type) ?? []), fn]) },
    removeEventListener: (type, fn) => { listeners.set(type, (listeners.get(type) ?? []).filter(f => f !== fn)) },
    listenerCount: type => (listeners.get(type) ?? []).length, dispatch: (type, detail) => (listeners.get(type) ?? []).slice().forEach(fn => fn({ detail })),
    setTimeout: fn => { timers.push(fn); return timers.length }, flush: () => { while (timers.length) timers.shift()() },
  }
  return win
}
/** A tiny effect runner: useRef persists, an effect runs on first render and when its deps change (a cleanup first), unmount runs every cleanup. */
function runner(env, { text, user = null, path: pathname = '/dashboard', win = makeWindow() } = {}) {
  const slots = [], refs = [], replaced = []
  let ix = 0, rix = 0, current = []
  const stubReact = { ...React, useRef: init => { const i = rix++; if (!(i in refs)) refs[i] = { current: init }; return refs[i] }, useLayoutEffect: (fn, deps) => { current.push([fn, deps]) }, useEffect: (fn, deps) => { current.push([fn, deps]) } }
  const router = { replace: to => replaced.push(to) }
  const overrides = { react: stubReact, 'next/navigation': { usePathname: () => state.path, useRouter: () => router }, 'next-auth/react': { useSession: () => ({ data: state.user ? { user: state.user } : null }) } }
  const mod = load(MOUNT, { env, text, overrides, globals: { window: win, document: win.document } })
  const state = { user, path: pathname }
  const flush = () => {
    current.forEach(([fn, deps], i) => {
      const slot = slots[i]
      if (slot && deps !== undefined && slot.deps !== undefined && deps.length === slot.deps.length && deps.every((d, k) => Object.is(d, slot.deps[k]))) return
      if (slot?.cleanup) slot.cleanup()
      const cleanup = fn(); slots[i] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined }
    })
  }
  const render = (fn) => { rix = 0; current = []; fn(); flush() }
  return {
    win, replaced, state, mod,
    hook(userId) { render(() => mod.useStudioUxFindingsE(userId)) },
    mount() { render(() => { const el = mod.StudioUxFindingsEMount(); if (el) el.type(el.props) }) },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); slots.length = 0 },
  }
}

// ---- FRONTEND-1's REAL intro code: the seen store, read by their own seenWorkspaces ----------------------------------------------------------------
function realIntro(introText = read(INTRO)) {
  const store = /const STORAGE = '([^']+)'/.exec(introText)?.[1]
  const screens = [...(/const COPY: Record<Screen, \{[^\n]*\n([\s\S]*?)\n\};/.exec(introText)?.[1] ?? '').matchAll(/^ {2}(\w+): \{ name:/gm)].map(match => match[1])
  const fn = /function seenWorkspaces\(\) \{[\s\S]*?\n\}\n/.exec(introText)?.[0]
  const openEvent = /const OPEN_EVENT = '([^']+)'/.exec(introText)?.[1]
  assert.ok(store && screens.length >= 7 && fn && openEvent, 'the intro source still has its store, screens, seenWorkspaces and open event')
  const snippet = `type Screen = string; type IntroWindow = Window & { __decksterWorkspaceIntrosV2?: Set<Screen> }; const STORAGE = ${JSON.stringify(store)}; const COPY: Record<string, number> = ${JSON.stringify(Object.fromEntries(screens.map(s => [s, 1])))}; ${fn}; module.exports = { seenWorkspaces }`
  const seenWorkspaces = win => { const module = { exports: {} }; vm.runInNewContext(compile('intro-snippet.ts', snippet), { module, window: win, localStorage: win.localStorage, JSON, Set, Array }); return module.exports.seenWorkspaces() }
  return { store, screens, openEvent, seenWorkspaces, gate: introText.includes('if (!explicitReplay && seen.has(screen) && visit.current?.key !== key) { setShow(false); return; }'), writes: introText.includes('localStorage.setItem(STORAGE, JSON.stringify([...seen]))') }
}

// ===== A. the flag reader, the redirect, the intro-once rules ====================================================================================
console.log('A. the flag reader, the redirect and the intro-once rules')
function proveFlag(libText = LIB_SRC) {
  assert.equal(lib(ON, libText).STUDIO_UX_FINDINGS_E_ENABLED, true, 'the exact "true" with the Studio shell is on')
  for (const value of ['false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', '', 'on', undefined]) assert.equal(lib({ ...ON, [UX_FINDINGS_E_FLAG]: value }, libText).STUDIO_UX_FINDINGS_E_ENABLED, false, `${JSON.stringify(value)} is off`)
  assert.equal(lib({ [UX_FINDINGS_E_FLAG]: 'true' }, libText).STUDIO_UX_FINDINGS_E_ENABLED, false, 'without the Studio shell it is off (the redirect target is a 404 there)'); assert.equal(lib({ [UX_FINDINGS_E_FLAG]: 'true', [SHELL]: 'false' }, libText).STUDIO_UX_FINDINGS_E_ENABLED, false)
  assert.equal(lib({}, libText).STUDIO_UX_FINDINGS_E_ENABLED, false, 'unset is off')
  for (const [key, name] of [[LOGO, 'STUDIO_UX_FINDINGS_E_NEW_LOGO'], [NAV, 'STUDIO_UX_FINDINGS_E_PLAIN_NAV']]) { assert.equal(lib({ ...ON, [key]: 'true' }, libText)[name], true); for (const value of ['1', 'TRUE', ' true', 'false', '', undefined]) assert.equal(lib({ ...ON, [key]: value }, libText)[name], false, `${key}=${JSON.stringify(value)} is off`) }
}
await check('the flag reads only the exact "true" (with the Studio shell): "1", "TRUE", " true", "yes", "" and unset are off, and so are the logo and nav switches', () => proveFlag())
await check('UX-11: /settings/profile (and its trailing-slash spelling) goes to /studio/details, every other route nowhere', () => {
  const l = lib(ON)
  assert.equal(l.studioUxFindingsEProfileTarget('/settings/profile'), '/studio/details'); assert.equal(l.studioUxFindingsEProfileTarget('/settings/profile/'), '/studio/details')
  for (const route of ['/settings', '/settings/account', '/settings/profile/x', '/studio/details', '/profile', '/dashboard', '/builder', '', null, undefined]) assert.equal(l.studioUxFindingsEProfileTarget(route), null, String(route))
})
await check('UX-08: the intro-once rules: first time for a user empties the store, an intro that opened marks every screen and the user, a played user keeps every screen seen, another account gets its own first intro, storage down never throws', () => {
  const l = lib(ON), SCREENS = [...l.STUDIO_UX_FINDINGS_E_INTRO_SCREENS], store = l.STUDIO_UX_FINDINGS_E_INTRO_STORE, key = l.studioUxFindingsEIntroKey
  assert.equal(key('u1'), 'deckster-studio-ux-e-intro-once:u1'); assert.notEqual(key('u1'), key('u2'), 'the user id is in the key')
  const win = makeWindow({ [store]: JSON.stringify(['decks']) }); win.__decksterWorkspaceIntrosV2.add('decks')
  assert.equal(l.studioUxFindingsEIntroReconcile(win, 'u1', false), 'first', 'first time for u1: the old per-page marks are emptied so one intro plays'); assert.equal(win.data.has(store), false); assert.equal(win.__decksterWorkspaceIntrosV2.size, 0)
  l.studioUxFindingsEIntroPlayed(win, 'u1'); assert.equal(win.data.get(key('u1')), '1'); assert.deepEqual(JSON.parse(win.data.get(store)), SCREENS); assert.deepEqual([...win.__decksterWorkspaceIntrosV2].sort(), [...SCREENS].sort())
  win.data.delete(store); win.__decksterWorkspaceIntrosV2.clear()
  assert.equal(l.studioUxFindingsEIntroReconcile(win, 'u1', false), 'played', 'u1 again: played'); assert.deepEqual(JSON.parse(win.data.get(store)), SCREENS, 'every screen seen again')
  assert.equal(l.studioUxFindingsEIntroReconcile(win, 'u2', false), 'first', 'another account on this browser has its own first intro'); assert.equal(win.data.has(store), false); assert.equal(win.data.get(key('u1')), '1', 'u1\'s mark is kept')
  assert.equal(l.studioUxFindingsEIntroReconcile(win, 'u3', true), 'played', 'an intro that opened before the id was known was this user\'s'); assert.equal(win.data.get(key('u3')), '1')
  const quiet = makeWindow(); assert.equal(l.studioUxFindingsEIntroReconcile(quiet, '', false), 'first'); l.studioUxFindingsEIntroPlayed(quiet, ''); assert.deepEqual(quiet.writes, [], 'no user id, no write')
  const down = makeWindow({}, { storageThrows: true }); assert.doesNotThrow(() => { l.studioUxFindingsEIntroReconcile(down, 'u1', false); l.studioUxFindingsEIntroPlayed(down, 'u1') }); assert.equal(down.__decksterWorkspaceIntrosV2.size, SCREENS.length, 'with storage down the intro\'s own memory set still marks every screen')
})
await check('UX-08 meets FRONTEND-1\'s REAL intro: the store, screens and open event are theirs; their seenWorkspaces reads every screen as seen after an intro played, and none for another account; the seen gate and the write they have are still there', () => {
  const l = lib(ON), real = realIntro()
  assert.equal(real.store, l.STUDIO_UX_FINDINGS_E_INTRO_STORE); assert.equal(real.openEvent, l.STUDIO_UX_FINDINGS_E_INTRO_OPEN_EVENT); assert.deepEqual([...real.screens].sort(), [...l.STUDIO_UX_FINDINGS_E_INTRO_SCREENS].sort(), 'the intro\'s COPY keys are the screens this reuses')
  assert.ok(MOUNT_SRC.includes('STUDIO_UX_FINDINGS_E_INTRO_OPEN_EVENT')); assert.equal(l.STUDIO_UX_FINDINGS_E_INTRO_MEMORY, '__decksterWorkspaceIntrosV2', 'the intro\'s in-memory twin'); assert.ok(read(INTRO).includes('__decksterWorkspaceIntrosV2?: Set<Screen>'))
  assert.equal(real.gate, true, 'the intro still skips a seen screen unless it is an explicit replay'); assert.equal(real.writes, true)
  const win = makeWindow(); l.studioUxFindingsEIntroReconcile(win, 'u1', false)
  assert.deepEqual([...real.seenWorkspaces(win)], [], 'first time: nothing is seen, so the first intro plays'); l.studioUxFindingsEIntroPlayed(win, 'u1'); win.__decksterWorkspaceIntrosV2.clear()
  assert.deepEqual([...real.seenWorkspaces(win)].sort(), [...real.screens].sort(), 'after one intro played, their code reads every screen as seen (no page opens another)')
  l.studioUxFindingsEIntroReconcile(win, 'u2', false); assert.deepEqual([...real.seenWorkspaces(win)], [], 'another account: their code reads nothing as seen, so its first intro plays once')
})

// ===== B. the mount and the hook =================================================================================================================
console.log('B. the mount and the hook')
const mountMarkup = (env, text = MOUNT_SRC) => renderToStaticMarkup(h(load(MOUNT, { env, text, overrides: { 'next/navigation': { usePathname: () => '/dashboard', useRouter: () => ({ replace() {} }) }, 'next-auth/react': { useSession: () => ({ data: null }) } } }).StudioUxFindingsEMount))
/** Flag off: nothing is read or written. Flag on: the attribute (and the logo / nav ones with their own flags), the intro mark, the redirect. */
function proveHook(mountText = MOUNT_SRC, libMode = 'real') {
  const offEnvs = [{}, { [UX_FINDINGS_E_FLAG]: 'true' }, { [SHELL]: 'true' }, { ...ON, [UX_FINDINGS_E_FLAG]: '1' }, { ...ON, [UX_FINDINGS_E_FLAG]: 'TRUE' }]
  for (const env of offEnvs) {
    assert.equal(mountMarkup(env, mountText), '', `flag off ${JSON.stringify(env)}: the mount returns null`)
    const run = runner(env, { text: mountText, user: { id: 'u1' }, path: '/settings/profile', win: makeWindow({ 'deckster-studio-workspace-intros-v2': '["decks"]' }) })
    run.hook('u1'); run.mount(); run.win.dispatch('deckster:workspace-intro-open', 'x'); run.win.flush(); run.unmount()
    assert.deepEqual(run.win.log, [], 'the document and the window are never touched (no attribute set or removed, no listener added)'); assert.equal(run.win.attrs.size, 0, 'no attribute is set'); assert.equal(run.win.listenerCount('deckster:workspace-intro-open'), 0, 'no listener is added'); assert.deepEqual(run.win.writes, [], 'no storage write'); assert.deepEqual(run.replaced, [], 'no redirect'); assert.equal(run.win.timers.length, 0)
    assert.equal(run.win.data.get('deckster-studio-workspace-intros-v2'), '["decks"]', 'FRONTEND-1\'s store is exactly as it was')
  }
  assert.equal(mountMarkup(ON, mountText), '', 'flag on: the mount draws nothing either')
  // flag on: the attribute, and the two extra ones only with their own flags
  for (const [extra, names] of [[{}, ['data-studio-ux-findings-e']], [{ [LOGO]: 'true' }, ['data-studio-ux-findings-e', 'data-studio-ux-findings-e-logo']], [{ [NAV]: 'true' }, ['data-studio-ux-findings-e', 'data-studio-ux-findings-e-nav']], [{ [LOGO]: 'true', [NAV]: 'true' }, ['data-studio-ux-findings-e', 'data-studio-ux-findings-e-logo', 'data-studio-ux-findings-e-nav']]]) {
    const run = runner({ ...ON, ...extra }, { text: mountText }); run.hook('')
    assert.deepEqual([...run.win.attrs.keys()].sort(), names.sort(), `attributes with ${JSON.stringify(extra)}`); for (const value of run.win.attrs.values()) assert.equal(value, 'true')
    run.unmount(); assert.equal(run.win.attrs.size, 0, 'unmount takes every attribute off')
  }
  // the intro: an intro opening for a known user records it just after (the last write); before the id is known it is recorded once the id is
  const known = runner(ON, { text: mountText, win: makeWindow({ 'deckster-studio-workspace-intros-v2': '["decks"]' }) }); known.hook('u1'); assert.equal(known.win.data.has('deckster-studio-workspace-intros-v2'), false, 'first time for u1: the old marks are emptied'); assert.equal(known.win.listenerCount('deckster:workspace-intro-open'), 1)
  known.win.dispatch('deckster:workspace-intro-open', 'owner'); assert.deepEqual(known.win.writes.filter(([k]) => k.startsWith('deckster-studio-ux-e')), [], 'nothing is written inside the event: the intro writes its own screen right after it'); known.win.data.set('deckster-studio-workspace-intros-v2', '["decks"]'); known.win.__decksterWorkspaceIntrosV2.add('decks'); known.win.flush() // the intro's own write, right after its event
  assert.equal(known.win.data.get('deckster-studio-ux-e-intro-once:u1'), '1'); assert.equal(JSON.parse(known.win.data.get('deckster-studio-workspace-intros-v2')).length, 7, 'every screen is marked, after the intro\'s own write')
  known.unmount(); assert.equal(known.win.listenerCount('deckster:workspace-intro-open'), 0, 'unmount takes the listener off')
  const early = runner(ON, { text: mountText }); early.hook(''); early.win.dispatch('deckster:workspace-intro-open', 'owner'); early.win.flush(); assert.equal(early.win.data.has('deckster-studio-ux-e-intro-once:u1'), false, 'no id yet: nothing recorded'); early.hook('u1')
  assert.equal(early.win.data.get('deckster-studio-ux-e-intro-once:u1'), '1', 'the id arrives: the intro that opened before it is this user\'s'); assert.equal(JSON.parse(early.win.data.get('deckster-studio-workspace-intros-v2')).length, 7)
  const again = runner(ON, { text: mountText, win: makeWindow({ 'deckster-studio-ux-e-intro-once:u1': '1' }) }); again.hook('u1'); assert.equal(JSON.parse(again.win.data.get('deckster-studio-workspace-intros-v2')).length, 7, 'a played user: every screen is seen before any intro looks')
  // the redirect, from the mount (the session's user id feeds the same hook)
  const profile = runner(ON, { text: mountText, user: { id: 'u1' }, path: '/settings/profile' }); profile.mount(); assert.deepEqual(profile.replaced, ['/studio/details'], '/settings/profile goes to Your details'); assert.equal(profile.win.attrs.get('data-studio-ux-findings-e'), 'true', 'and the mount set the attribute')
  assert.equal(profile.win.data.has('deckster-studio-ux-e-intro-once:u1'), false, 'the mount handed the session user to the hook: u1\'s first intro is still to come'); profile.mount(); assert.deepEqual(profile.replaced, ['/studio/details'], 're-rendering on the same route does not redirect again')
  for (const route of ['/dashboard', '/settings/account', '/studio/details', '/builder']) { const other = runner(ON, { text: mountText, user: { email: 'a@example.invalid' }, path: route }); other.mount(); assert.deepEqual(other.replaced, [], route) }
  const byEmail = runner(ON, { text: mountText, user: { email: 'a@example.invalid' } }); byEmail.mount(); assert.equal(byEmail.win.data.has('deckster-studio-workspace-intros-v2'), false); byEmail.win.dispatch('deckster:workspace-intro-open', 'o'); byEmail.win.flush(); assert.equal(byEmail.win.data.get('deckster-studio-ux-e-intro-once:a@example.invalid'), '1', 'the Builder\'s own id rule (id, else email) is the key')
}
await check('B: the mount is null with the flag off (and with every near-miss value) and draws nothing with it on; flag off the hook sets no attribute, adds no listener, writes no storage and redirects nowhere; flag on it sets the attribute (logo / nav only with their flags), records the intro as played just after the intro\'s own write, and redirects /settings/profile only', () => proveHook())
const FE1_DRAFT_OR_OK = Object.keys(UX_FINDINGS_E_FE1_OK).length > 0 ? UX_FINDINGS_E_FE1_OK : UX_FINDINGS_E_FE1_DRAFT
const FE1_APPLIED = Object.keys(UX_FINDINGS_E_FE1_OK).length > 0
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const lineDiff = (before, after) => { const b = before.split('\n'), a = after.split('\n'), out = []; let i = 0, j = 0; while (i < b.length || j < a.length) { if (b[i] === a[j]) { i++; j++ } else if (a[j] !== undefined && !b.slice(i).includes(a[j])) { out.push(`+${a[j++]}`) } else if (b[i] !== undefined && !a.slice(j).includes(b[i])) { out.push(`-${b[i++]}`) } else { out.push(`-${b[i++]}`); out.push(`+${a[j++]}`) } } return out }
/** The file with the entries' lines inserted, each right after its anchor line (how the file looks once they are applied). */
const applyEntries = (text, entries) => { const lines = text.split('\n'); for (const { after, line } of entries) { const at = lines.indexOf(after); if (at < 0) throw new SwapError(`anchor missing: ${after.slice(0, 60)}`); lines.splice(at + 1, 0, line) } return lines.join('\n') }
/** FRONTEND-1's lines in `rel`, as `text` has them: once each, as whole lines, right after their anchor, nothing else added or removed, all marked; stripping them gives `base`. */
function proveFe1Lines(rel, text, entries, strip, at = '') {
  const a = m => (at ? `${at}: ${m}` : m), base = baseText(rel), lines = text.split('\n')
  for (const { after, line } of entries) {
    assert.equal(count(`\n${text}`, `\n${line}\n`), 1, a(`${rel}: the line is there exactly once, as a whole line`)); assert.equal(count(`\n${base}`, `\n${after}\n`), 1, a(`${rel}: dev has the anchor line exactly once`))
    assert.ok(UX_FINDINGS_E_MARKER_RE.test(line) && !base.split('\n').includes(line), a('the line is marked and dev does not have it')); assert.equal(lines[lines.indexOf(line) - 1] === after || entries.some(e => e.line === lines[lines.indexOf(line) - 1]), true, a(`${rel}: right after its anchor (or after the line this change put there)`))
  }
  assert.equal(lines.filter(line => UX_FINDINGS_E_MARKER_RE.test(line)).length, entries.length, a(`${rel}: ${entries.length} marked lines and no other`))
  const diff = lineDiff(base, text); assert.deepEqual(diff.filter(line => line.startsWith('-')), [], a('nothing of dev\'s is removed or rewritten')); assert.deepEqual(diff, entries.map(({ line }) => `+${line}`), a('exactly the lines are added, in order'))
  assert.equal(strip(rel, text), base, a(`${rel}: without the lines it is dev's, byte for byte`)); assert.equal(strip(rel, strip(rel, text)), base, a('and put back twice changes nothing more'))
}
/** The pairs of a file's entries (was = '') as a strip over a table. */
const stripOver = table => (rel, text) => (table[rel] ?? []).reduce((out, [has, was]) => { let at = out.indexOf(has); while (at !== -1 && !(at === 0 || out[at - 1] === '\n')) at = out.indexOf(has, at + 1); return at === -1 ? out : out.slice(0, at) + was + out.slice(at + has.length) }, text)
const draftStrip = stripOver(UX_FINDINGS_E_FE1_DRAFT_EDITS)
function proveFe1(readNow = rel => laterStrips(rel, read(rel)), at = '') {
  for (const [rel, entries] of Object.entries(FE1_DRAFT_OR_OK)) {
    const now = readNow(rel); proveFe1Lines(rel, FE1_APPLIED ? now : applyEntries(baseText(rel), entries), entries, FE1_APPLIED ? stripUxFindingsE : draftStrip, at)
    if (!FE1_APPLIED) assert.equal(now, baseText(rel), at ? `${at}: ${rel}` : `${rel} is dev's file until FRONTEND-1 OKs the lines (phase 1: nothing applied)`)
  }
  const layout = FE1_DRAFT_OR_OK[LAYOUT], builder = FE1_DRAFT_OR_OK[BUILDER]
  assert.equal(layout.length, 2, 'two lines in the account layout: the import and the mount'); assert.equal(builder.length, 2, 'two lines in the Builder: the import and the hook call'); assert.deepEqual(Object.keys(FE1_DRAFT_OR_OK).sort(), [LAYOUT, BUILDER].sort(), 'only those two files of FRONTEND-1\'s')
  assert.match(layout[0].line, /^import \{ StudioUxFindingsEMount \} from "@\/components\/studio-ux-findings-e\/studio-ux-findings-e-mount" \/\/ UX-FINDINGS-E/); assert.equal(layout[1].line.replace(/\{\/\*.*\*\/\}$/, ''), '      <StudioUxFindingsEMount />'); assert.match(layout[1].line, /\{\/\* UX-FINDINGS-E: [^*]*\*\/\}$/)
  assert.match(builder[0].line, /^import \{ useStudioUxFindingsE \} from '@\/components\/studio-ux-findings-e\/studio-ux-findings-e-mount' \/\/ UX-FINDINGS-E/); assert.match(builder[1].line, /^ {2}useStudioUxFindingsE\(authScopeUserId\) \/\/ UX-FINDINGS-E/)
}
await check('FRONTEND-1\'s four lines (a draft until OK\'d, then the OK\'d ones): once each, as whole lines, right after their anchor in dev\'s file, pure insertions, all marked; stripped, the file is dev\'s byte for byte; until they answer no file of theirs is touched', () => proveFe1())
/** The account layout rendered with every import but the mount stubbed: the markup with the lines is the markup without them, flag off and on. */
function renderLayout(text, env) {
  const stub = name => function Stub() { return h('i', { 'data-stub': name }) }
  const generic = new Proxy({}, { get: (_, name) => (name === '__esModule' ? true : /_ENABLED$/.test(String(name)) ? false : stub(String(name))) })
  const overrides = { 'react': React, 'next/navigation': { usePathname: () => '/dashboard', useRouter: () => ({ replace() {} }) }, 'next-auth/react': { useSession: () => ({ data: null }) } }
  const mod = (() => {
    const module = { exports: {} }
    const req = spec => { if (spec === 'react/jsx-runtime') return jsxRuntime; if (spec === 'react') return React; if (spec.endsWith('.css')) return {}; if (spec === '@/components/studio-ux-findings-e/studio-ux-findings-e-mount') return load(MOUNT, { env, overrides }); return generic }
    vm.runInNewContext(compile(LAYOUT, text), { module, exports: module.exports, require: req, process: { env: { ...env } } }, { filename: LAYOUT }); return module.exports
  })()
  return renderToStaticMarkup(h(mod.default, null, h('main', null, 'page')))
}
await check('the account layout renders the same markup with and without FRONTEND-1\'s lines (flag off, flag on, shell off): the mount returns null; sha256 shown', () => {
  const base = baseText(LAYOUT), now = FE1_APPLIED ? laterStrips(LAYOUT, read(LAYOUT)) : applyEntries(base, FE1_DRAFT_OR_OK[LAYOUT]), rows = []
  if (!FE1_APPLIED) assert.notEqual(now, base, 'the draft lines are in the text rendered')
  for (const env of [{}, { [SHELL]: 'true' }, { [UX_FINDINGS_E_FLAG]: 'true' }, { [UX_FINDINGS_E_FLAG]: 'true', [SHELL]: 'true' }, { [UX_FINDINGS_E_FLAG]: '1', [SHELL]: 'true' }]) {
    const withLines = renderLayout(now, env), without = renderLayout(base, env); assert.equal(withLines, without, `${JSON.stringify(env)}: the layout's markup is the same with and without the lines`); rows.push(sha(withLines))
  }
  console.log(`     account layout markup sha256/16 (with the lines = without): ${rows.join(' ')}`)
})
const BUILDER_TEXT = FE1_APPLIED ? laterStrips(BUILDER, read(BUILDER)) : applyEntries(baseText(BUILDER), FE1_DRAFT_OR_OK[BUILDER])
function proveBuilderHook(text = BUILDER_TEXT) {
  const lines = text.split('\n'), hookAt = lines.findIndex(line => /^ {2}useStudioUxFindingsE\(authScopeUserId\) \/\/ UX-FINDINGS-E/.test(line)), fn = lines.findIndex(line => line === 'function BuilderAuthBoundary() {'), early = lines.findIndex(line => line === '  if (isLoading) return <BuilderLoadingState />')
  assert.ok(fn > 0 && hookAt > fn && hookAt < early, 'the hook call is inside BuilderAuthBoundary, above its first early return (a hook may not come after one)'); assert.equal(lines[hookAt - 1], "  const authScopeUserId = user?.id ?? user?.email ?? ''", 'right after the id it is given')
  assert.equal(lines.filter(line => /^import \{ useStudioUxFindingsE \}/.test(line)).length, 1)
  const importAt = lines.findIndex(line => /^import \{ useStudioUxFindingsE \}/.test(line)); assert.ok(importAt < lines.findIndex(line => line.startsWith('function BuilderLoadingState(')), 'the import is with the late imports, above the first function that follows them')
}
await check('the Builder hook line: inside BuilderAuthBoundary above its early returns, right after the id it is given, its import with the late imports (the page itself needs the real Next runtime and is not rendered here; the same hook is proven above)', () => proveBuilderHook())

// ===== C. the stylesheet, parsed ==================================================================================================================
console.log('C. the stylesheet')
const SCOPE = 'html[data-studio-ux-findings-e="true"]'
/** A small CSS parser: comments out, then rules (and rules inside @media / @supports) with their selector lists and declarations. */
function parseCss(text) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, ''), rules = []
  let i = 0
  const scan = stops => { // read to a stop character at depth 0 (quotes and brackets respected); returns the text and the stop
    const start = i; let depth = 0, quote = null
    for (; i < src.length; i++) {
      const c = src[i]
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue }
      if (c === '"' || c === "'") quote = c; else if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; else if (depth === 0 && stops.includes(c)) break
    }
    return [src.slice(start, i), src[i]]
  }
  const splitTop = (s, sep) => { const out = []; let depth = 0, quote = null, last = 0; for (let k = 0; k < s.length; k++) { const c = s[k]; if (quote) { if (c === '\\') k++; else if (c === quote) quote = null; continue } if (c === '"' || c === "'") quote = c; else if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; else if (depth === 0 && c === sep) { out.push(s.slice(last, k)); last = k + 1 } } out.push(s.slice(last)); return out.map(x => x.trim()).filter(Boolean) }
  const block = media => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++
      if (i >= src.length) return
      if (src[i] === '}') { i++; return }
      const [prelude, stop] = scan('{;')
      if (stop === ';') { i++; continue }
      i++ // {
      if (/^@(media|supports)\b/.test(prelude.trim())) { block(prelude.trim()); continue }
      const [body] = scan('}'); i++
      if (prelude.trim().startsWith('@')) { rules.push({ at: prelude.trim(), selectors: [], decls: [], media }); continue }
      rules.push({ selectors: splitTop(prelude, ','), decls: splitTop(body, ';').map(d => { const k = d.indexOf(':'); return [d.slice(0, k).trim().toLowerCase(), d.slice(k + 1).trim()] }), media })
    }
  }
  block(null)
  return rules
}
const COLOUR_VALUE = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(|\b(?:transparent|currentcolor|red|green|blue|black|white|gray|grey|teal|purple|violet|orange|yellow|pink|cyan|magenta|indigo|navy|silver)\b/i
const COLOUR_PROP = /(^|-)color$|^(fill|stroke|filter|box-shadow|text-shadow|outline|border|border-(top|right|bottom|left))$/
const ALLOWED = { background: 'url("/logo-icon-sm.png") center / contain no-repeat', 'box-shadow': 'none' }
function proveCss(cssText = CSS_SRC) {
  assert.doesNotMatch(cssText.replace(/\/\*[\s\S]*?\*\//g, ''), /!important/i, 'no !important'); assert.ok(!/@import|@font-face|@keyframes/.test(cssText.replace(/\/\*[\s\S]*?\*\//g, '')), 'no import, font or animation')
  const rules = parseCss(cssText); assert.ok(rules.length >= 12, `the sheet has its rules (${rules.length})`)
  for (const rule of rules) {
    assert.equal(rule.at, undefined, `no other at-rule: ${rule.at}`); assert.ok(rule.media === null || /^@media \(max-width: 820px\)$/.test(rule.media), `only the one media query: ${rule.media}`)
    assert.ok(rule.selectors.length >= 1 && rule.decls.length >= 1, `a rule with selectors and declarations: ${rule.selectors[0]}`)
    for (const selector of rule.selectors) assert.ok(selector.startsWith(SCOPE), `every selector is scoped under ${SCOPE}: ${selector.slice(0, 120)}`)
    for (const [prop, value] of rule.decls) {
      if (prop in ALLOWED && value === ALLOWED[prop]) continue
      assert.ok(!COLOUR_PROP.test(prop), `${prop}: no colour, shadow or filter property (${rule.selectors[0].slice(0, 60)})`); assert.doesNotMatch(value, COLOUR_VALUE, `${prop}: ${value} holds no colour value`)
    }
  }
  return rules
}
await check('the stylesheet is parsed: every selector of every rule (also inside @media) is scoped under html[data-studio-ux-findings-e="true"]; no !important; no colour value, colour property, shadow or filter (the one logo background and its box-shadow: none excepted); one media query', () => {
  const rules = proveCss()
  const has = fragment => rules.some(rule => rule.selectors.some(s => s.includes(fragment)))
  assert.ok(has('[data-studio-skel-brand="true"]') && has('[data-studio-chat-header]') && has('.sl-context') && has('.sp-profile-confirmation') && has('.sl-heading h1') && has('[data-studio-deck-heading="true"] h1'), 'UX-27, UX-19, UX-22, UX-12 and UX-26 each have their rule')
  const sr = rules.find(rule => rule.selectors.some(s => s.includes('main[data-studio-personal="details"] .sp-heading h1'))); assert.deepEqual(sr.decls.map(([k, v]) => `${k}: ${v}`), ['position: absolute', 'width: 1px', 'height: 1px', 'padding: 0', 'margin: -1px', 'overflow: hidden', 'clip: rect(0, 0, 0, 0)', 'white-space: nowrap', 'border-width: 0'].map(d => d), 'UX-26 is the repo\'s sr-only pattern (kept for assistive technology, not drawn), not display:none')
  assert.ok(fs.existsSync(path.join(root, 'public/logo-icon-sm.png')), 'the logo file the skeleton rule names exists'); assert.equal(read('lib/studio-new-logo.ts').includes("STUDIO_NEW_LOGO_SRC = '/logo-icon-sm.png'"), true, 'and it is the rail\'s own file')
})
/** Every class and data attribute a selector names is in the sources the page is drawn from (a renamed hook would leave a dead rule). */
const SELECTOR_SOURCES = ['components/studio-personal/details-workspace.tsx', 'components/studio-personal/studio-p2-details.tsx', 'components/studio-personal/account-identity-preview.tsx', 'components/studio-personal/intelligence-workspace.tsx', 'components/studio-personal/intelligence-p2.tsx',
  'components/studio-libraries/library-controls.tsx', 'components/studio-libraries/themes-workspace.tsx', 'components/studio-libraries/templates-workspace.tsx', 'app/(app)/dashboard/page.tsx', 'components/builder/chat/studio-director-header.tsx', 'components/builder/studio-session-hygiene.tsx',
  'components/layout/studio-phone-tab-bar.tsx', LAYOUT, LIB, 'components/studio-libraries/libraries.css']
function proveLive(cssText = CSS_SRC, sources = SELECTOR_SOURCES.map(rel => (rel === LIB ? LIB_SRC : read(rel)))) {
  const corpus = sources.join('\n'), tokens = new Set()
  for (const rule of parseCss(cssText)) for (const selector of rule.selectors) { for (const m of selector.matchAll(/\.([A-Za-z][\w-]*)/g)) tokens.add(m[1]); for (const m of selector.matchAll(/\[(data-[\w-]+)/g)) tokens.add(m[1]) }
  assert.ok(tokens.size >= 15, `${tokens.size} hooks`)
  for (const token of tokens) assert.ok(corpus.includes(token), `${token} is live in the sources`)
}
await check('C: every class and data attribute the stylesheet names is live in the sources the page is drawn from (no dead rule), and the findings\' own attributes are the lib\'s', () => { proveLive(); for (const name of ['data-studio-ux-findings-e', 'data-studio-ux-findings-e-logo', 'data-studio-ux-findings-e-nav']) assert.ok(LIB_SRC.includes(`'${name}'`), name) })

const OWN_NAME = 'studio-ux-findings-e-strip.mjs'
const lineStart = (text, at) => at === 0 || text[at - 1] === '\n', lineEnd = (text, at) => at === text.length || text[at] === '\n'
/** The registry's own block removal (a block as whole lines, with the one blank line that separated it), for ONE block: used to take the blocks registered AFTER this change's out. */
function removeBlock(text, registered) {
  const block = String(registered).replace(/^\n+/, '').replace(/\n+$/, ''); if (!block) return text
  let at = text.indexOf(block); while (at !== -1 && !(lineStart(text, at) && lineEnd(text, at + block.length))) at = text.indexOf(block, at + 1)
  if (at === -1) return text
  const before = text.slice(0, at), rest = text.slice(at + block.length)
  if (/^\n*$/.test(rest)) return before.endsWith('\n\n') ? before.slice(0, -1) : before
  return rest.startsWith('\n\n') ? before + rest.slice(2) : before + rest.slice(1)
}
/** .env.example as this change leaves it: the blocks registered AFTER this change's taken out (none at HEAD of a plain branch). */
const laterEnvOnly = text => { const at = registry.LATER_ENV_BLOCKS.indexOf(UX_FINDINGS_E_ENV_BLOCK); return registry.LATER_ENV_BLOCKS.slice(at + 1).reduce((out, block) => removeBlock(out, block), text) }
/** The registry as this change leaves it: the lines a change registered AFTER this one added (in each list, below this change's line, in the registered shape) taken out. */
const laterRegistryOut = text => { let after = false; return text.split('\n').filter(line => { if (/^export const LATER_/.test(line)) after = false; else if (line.includes(OWN_NAME)) after = true; else if (after && line.includes('// LATER-CHANGE:') && /-strip\.mjs/.test(line)) return false; return true }).join('\n') }
/** What this change's strip is held to for a file whose later registered lines (registry, .env.example) are not its to take out: those go first. */
const asThisChangeLeftIt = (rel, text) => (rel === REGISTRY ? laterRegistryOut(text) : rel === ENV_FILE ? laterEnvOnly(text) : text)

// ===== D. the strip ===============================================================================================================================
console.log('D. the strip')
const LEGACY_FILES = ['app/(app)/dashboard/page.tsx', 'hooks/use-auth.ts', 'components/workspace-intro/workspace-intro.tsx', 'scripts/test-studio-usage-credits-page.mjs', 'scripts/test-studio-chat-caps.mjs', 'lib/studio-ux-findings-e.ts']
function proveStrip(strip, readNow = read, later = laterStrips, at = '') {
  const a = m => (at ? `${at}: ${m}` : m)
  assert.deepEqual(Object.keys(UX_FINDINGS_E_EDITS).sort(), [ENV_FILE, REGISTRY, ...UX_FINDINGS_E_PIN_FILES, ...UX_FINDINGS_E_FE1_FILES].sort(), a('the strip edits .env.example, the registry, the two older proofs and FRONTEND-1\'s OK\'d files, nothing else'))
  for (const [rel, edits] of Object.entries(UX_FINDINGS_E_EDITS)) {
    const now = asThisChangeLeftIt(rel, later(rel, readNow(rel))), base = baseText(rel)
    assert.equal(strip(rel, now), base, a(`${rel}: put back it is dev's, byte for byte`)); assert.equal(strip(rel, strip(rel, now)), base, a(`${rel}: put back twice changes nothing more`))
    for (const [has] of edits) assert.equal(count(`\n${now}`, `\n${has.replace(/^\n/, '')}`), 1, a(`${rel}: an edited line is there exactly once`))
    const diff = lineDiff(base, now), hasLines = edits.flatMap(([hasText]) => hasText.split('\n').filter(Boolean)), wasLines = edits.flatMap(([, wasText]) => wasText.split('\n').filter(Boolean))
    assert.deepEqual(diff.filter(line => line.startsWith('+') && line.length > 1), hasLines.map(line => `+${line}`), a(`${rel}: exactly the edited lines are added`)); assert.deepEqual(diff.filter(line => line.startsWith('-')), wasLines.map(line => `-${line}`), a(`${rel}: nothing of dev's is gone`))
  }
  for (const rel of UX_FINDINGS_E_PIN_FILES) {
    const now = later(rel, readNow(rel)), lines = now.split('\n'), marked = lines.filter(line => line.includes(UX_FINDINGS_E_PIN_MARK))
    assert.equal(marked.length, 1, a(`${rel}: one taught line, carrying the registry-read mark`)); assert.equal(`${marked[0]}\n`, UX_FINDINGS_E_PIN_EDITS[rel][0][0]); assert.equal(marked[0], UX_FINDINGS_E_FIRST_PARENT_LINE)
    assert.ok(/^ {2}shas\.splice\(0, shas\.length, \.\.\.shas\.filter\(sha => !\/\^UX findings E:\/\.test\(git\('log', '-1', '--format=%s', sha\)\)\)\) \/\/ LATER-CHANGES: registry read \(UX-FINDINGS-E\): /.test(marked[0]), a(`${rel}: the taught line is a subject filter for "UX findings E:"`))
    assert.ok(UX_FINDINGS_E_PIN_EDITS[rel].every(([, was]) => !was.includes(UX_FINDINGS_E_PIN_MARK)), a('the put-back text has no mark'))
    const at0 = lines.indexOf(marked[0]); assert.ok(/shas\.filter\(sha => !\/\^/.test(lines[at0 - 1]) && baseText(rel).split('\n').includes(lines[at0 - 1]), a(`${rel}: right after a subject filter dev already has (the last "^…:" one before it, whichever change that is)`))
    assert.equal(lines.filter(line => /shas\.filter\(sha => !\/\^UX findings E:\//.test(line)).length, 1, a(`${rel}: no second filter for this subject`))
  }
  for (const rel of LEGACY_FILES) { const text = readNow(rel); assert.equal(strip(rel, text), text, a(`${rel}: not this change's: returned as it is`)) }
  assert.equal(strip(BUILDER, `${UX_FINDINGS_E_FIRST_PARENT_LINE}\n`), `${UX_FINDINGS_E_FIRST_PARENT_LINE}\n`, a('a taught line in another file stays')); assert.equal(strip(REGISTRY, 1), 1); assert.equal(strip(REGISTRY, undefined), undefined)
  assert.equal(strip(REGISTRY, `x${UX_FINDINGS_E_REGISTRY_STRIP_LINE}\n`), `x${UX_FINDINGS_E_REGISTRY_STRIP_LINE}\n`, a('a line that merely ends with it is not it')); assert.equal(strip(REGISTRY, `${UX_FINDINGS_E_REGISTRY_STRIP_LINE}x\n`), `${UX_FINDINGS_E_REGISTRY_STRIP_LINE}x\n`)
  assert.equal(strip(REGISTRY, `a\n${UX_FINDINGS_E_REGISTRY_STRIP_LINE}\n${UX_FINDINGS_E_REGISTRY_STRIP_LINE}\nb\n`), `a\n${UX_FINDINGS_E_REGISTRY_STRIP_LINE}\nb\n`, a('a line that is there twice is a merge mistake: only the first goes'))
  assert.equal(strip(REGISTRY, 'a\nb\n'), 'a\nb\n', a('a file without the lines is returned as it is'))
  assert.equal(strip(ENV_FILE, `x\n\n${UX_FINDINGS_E_ENV_BLOCK}`), 'x\n', a('the env block goes with the one blank line before it'))
}
await check('the strip: .env.example, the registry and the two taught proofs put back are dev\'s, byte for byte, idempotent; every taught line is one subject filter with the registry-read mark, right after a filter dev has; a file it does not own, a longer line, a non-string and a file without the lines come back as they are; a doubled line is not hidden', () => proveStrip(stripUxFindingsE))
await check('the strip is plain data: no imports, nothing read from disk or git; its marker is a whole token; no credential-shaped literal and no stdin pipe into git in the new files; the subject is its own', () => {
  const text = read('scripts/studio-ux-findings-e-strip.mjs')
  assert.doesNotMatch(text.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/`[^`]*`/g, '``').replace(/\/\/.*$/gm, ''), /^import |require\(|readFileSync|execFileSync/m, 'no imports, nothing read from disk or git')
  assert.ok(UX_FINDINGS_E_MARKER_RE.test('a // UX-FINDINGS-E') && !UX_FINDINGS_E_MARKER_RE.test('a // UX-FINDINGS-E-X') && !UX_FINDINGS_E_MARKER_RE.test('a // X-UX-FINDINGS-E') && !UX_FINDINGS_E_MARKER_RE.test('a // UX_FINDINGS_E'), 'the marker is a whole token')
  assert.equal(UX_FINDINGS_E_SUBJECT, 'UX findings E:'); assert.equal(UX_FINDINGS_E_FLAG, 'NEXT_PUBLIC_STUDIO_UX_FINDINGS_E'); assert.match(BASE_COMMIT, /^[0-9a-f]{40}$/); git('merge-tree', '--write-tree', BASE_COMMIT, 'HEAD'); assert.equal(UX_FINDINGS_E_PIN_AFTER.includes('Usage credits page:'), true)
  for (const rel of UX_FINDINGS_E_NEW_FILES) assert.doesNotMatch(read(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, `${rel}: no secret-shaped literal`)
  for (const rel of UX_FINDINGS_E_NEW_FILES) assert.doesNotMatch(read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, ''), new RegExp(`-{2}std${'in'}`), `${rel}: no stdin pipe into git (hash-object reads a temporary file)`)
  for (const rel of ['lib/studio-ux-findings-e.ts']) assert.doesNotMatch(read(rel).replace(/^\s*\/\/.*$/gm, ''), /^import /m, `${rel}: import-free`)
})

// ===== E. the registry ============================================================================================================================
console.log('E. the registry')
const END = '  // one line per later change, above this comment'
const sectionOf = (lines, at) => { for (let i = at; i >= 0; i--) { const m = /^export const (LATER_\w+)/.exec(lines[i]); if (m) return m[1] } return null }
function proveRegistryText(regText) {
  const reg = regText.split('\n'), baseReg = baseText(REGISTRY).split('\n')
  /** Registry lines a change registered AFTER this one added (in each list, below this change's line, in the registered shape): that change's, not this one's. A stray line is still counted. */
  const laterRegistry = (() => { const later = new Set(); let after = false; for (const line of reg) { if (/^export const LATER_/.test(line)) after = false; else if (line.includes(OWN_NAME)) after = true; else if (after && line.includes('// LATER-CHANGE:') && /-strip\.mjs/.test(line)) later.add(line) } return later })()
  const diff = lineDiff(baseText(REGISTRY), regText).filter(line => !(line.startsWith('+') && laterRegistry.has(line.slice(1))))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes(OWN_NAME)); assert.equal(own.length, 3, 'the registry gains exactly this change\'s THREE lines')
  for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE: FRONTEND-2, '), line.slice(0, 140))
  assert.deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['UX_FINDINGS_E_SCOPE_FILES', 'UX_FINDINGS_E_ENV_BLOCK', 'stripUxFindingsE'], 'one files line, one env line, one strip line'); assert.deepEqual(own.map(line => line.slice(1)), [UX_FINDINGS_E_REGISTRY_FILES_LINE, UX_FINDINGS_E_REGISTRY_ENV_LINE, UX_FINDINGS_E_REGISTRY_STRIP_LINE], 'byte for byte the lines the strip names')
  assert.equal(diff.length, 3, 'and nothing else in the registry')
  assert.deepEqual(own.map(line => sectionOf(reg, reg.indexOf(line.slice(1)))), ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS'], 'one in each list')
  for (const line of own) {
    const at = reg.indexOf(line.slice(1)); assert.ok(at > 0, line.slice(1, 80))
    assert.ok(baseReg.includes(reg[at - 1]) && reg[at - 1].includes('// LATER-CHANGE:') && reg[at - 1].includes('studio-voice-call-strip.mjs'), `right after studio-voice-call-strip.mjs's line, a registered line dev already has: ${line.slice(1, 80)}`)
    assert.ok(reg[at + 1].startsWith(END.slice(0, 30)) || laterRegistry.has(reg[at + 1]), 'the true end of its list (or followed only by a later change\'s registered line)')
  }
}
function proveEnvText(envText) {
  const tail = laterEnvOnly(envText)
  assert.ok(tail.endsWith(`\n${UX_FINDINGS_E_ENV_BLOCK}`), 'the block is at the true end of .env.example, after one blank line (a block registered after it taken out first)'); assert.equal(count(tail, UX_FINDINGS_E_ENV_BLOCK), 1, 'once')
  assert.match(UX_FINDINGS_E_ENV_BLOCK, /\nNEXT_PUBLIC_STUDIO_UX_FINDINGS_E="false"\n$/, 'the flag is the last line of its block, default off'); assert.match(UX_FINDINGS_E_ENV_BLOCK, /^# STUDIO UX FINDINGS E /)
  assert.equal(registry.stripLaterEnvBlocks(ENV_FILE, envText), registry.stripLaterEnvBlocks(ENV_FILE, baseText(ENV_FILE)), '.env.example is dev\'s plus the registered blocks and nothing else'); assert.ok(registry.LATER_ENV_BLOCKS.includes(UX_FINDINGS_E_ENV_BLOCK), 'the block is registered')
}
function proveRegistryAt(head) { proveRegistryText(git('show', `${head}:${REGISTRY}`)); proveEnvText(git('show', `${head}:${ENV_FILE}`)) }
await check('the registry file at HEAD: this change\'s files, env block and strip are registered, one line each in the three lists; every scope file is registered, the strip comes after every older strip', () => {
  assert.ok(registry.LATER_STRIPS.includes(stripUxFindingsE) && registry.LATER_ENV_BLOCKS.includes(UX_FINDINGS_E_ENV_BLOCK) && [...UX_FINDINGS_E_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'the registry holds the strip, the block and every file')
  const ownAt = registry.LATER_STRIPS.indexOf(stripUxFindingsE), callAt = registry.LATER_STRIPS.findIndex(fn => typeof fn === 'function' && fn.name === 'stripVoiceCall'); assert.ok(callAt > 0 && ownAt > callAt, 'the strip comes after studio-voice-call-strip.mjs\'s')
  const regLines = read(REGISTRY).split('\n'); assert.equal(regLines.filter(line => line.includes(OWN_NAME)).length, 3, 'three lines name this change\'s strip module')
  assert.deepEqual(regLines.map((line, i) => (line.includes(OWN_NAME) ? sectionOf(regLines, i) : null)).filter(Boolean), ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS'], 'one in each list')
})

// ===== F. scope ====================================================================================================================================
console.log('F. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-07T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-07T00:00:00Z' }
const plumb = (args, env = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxe-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(UX_FINDINGS_E_SUBJECT)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees none of them on the gate's merge. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query: on the gate's merge (dev first, this change's head second) the scope runs against HEAD^2; elsewhere HEAD itself. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim(), parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
/** No older change's subject filter (the taught proofs' own `shas.filter(sha => !/^…/` lines at dev) matches this change's subject; this change's own filter is the one that does. */
const subjectFilters = text => text.split('\n').filter(line => /shas\.filter\(sha => !\//.test(line)).map(line => new RegExp(/shas\.filter\(sha => !\/(.+?)\/\.test\(git\(/.exec(line)[1]))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (?:Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  const olderFilters = UX_FINDINGS_E_PIN_FILES.flatMap(rel => subjectFilters(baseText(rel)))
  assert.ok(olderFilters.length >= 20, 'the older subject filters are read from the taught proofs at dev')
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) { const subject = subjectOf(c); if (isOwnSubject(subject)) assert.ok(!olderFilters.some(re => re.test(subject)), `${c.slice(0, 8)} would be taken for an older change's own commit`) }
  return own
}
/** Lanes this change must not touch (FRONTEND-1's, COMPOSER-2's, the reconnect proof): the four OK'd lines are the only thing of theirs. */
const LANES = /^(scripts\/test-studio-(p2-|billing-|launch-wording|env-append-tolerant|route-params|admin-email-guard|uat-marketing|deck-title|flow-control|ux-honesty)|scripts\/test-atlas-help-recovery|scripts\/test-director-websocket-reconnect|scripts\/test-(deck-card-thumbnail|first-paint)|lib\/studio-flow-control\.ts|hooks\/use-studio-flow-control\.ts|lib\/studio-launch-wording\.ts)/
const UNTOUCHED = ['components/workspace-intro/workspace-intro.tsx', 'components/studio-intro-replay.tsx', 'components/builder/studio-introduction.tsx', 'components/builder/chat/studio-director-header.tsx', 'components/builder/studio-session-hygiene.tsx', 'components/builder/studio-session-hygiene-styles.ts',
  'components/layout/app-header.tsx', 'app/(app)/settings/profile/page.tsx', 'app/(app)/dashboard/page.tsx', 'components/studio-personal/details-workspace.tsx', 'components/studio-personal/account-identity-preview.tsx', 'components/studio-personal/intelligence-p2.tsx', 'components/studio-libraries/themes-workspace.tsx',
  'components/studio-libraries/library-controls.tsx', 'lib/studio-intelligence-p2.ts', 'lib/studio-launch-wording.ts', 'middleware.ts', 'next.config.mjs', 'app/layout.tsx', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json']
const scopeCommittedFiles = (head, { later = laterStrips, registered = registry.LATER_CHANGE_FILES } = {}) => {
  const own = scopeOwnCommits(head), touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  assert.deepEqual([...touched].sort(), [...UX_FINDINGS_E_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  assert.deepEqual([...net].filter(rel => UX_FINDINGS_E_SCOPE_FILES.has(rel) || !registered.has(rel)).sort(), [...UX_FINDINGS_E_SCOPE_FILES].sort(), 'and the whole committed diff from BASE is nothing else (a file the registry names for a later change, stacked on this head, is left to that change; an unregistered file still fails)')
  proveFe1(rel => later(rel, git('show', `${head}:${rel}`)), 'committed'); proveCss(git('show', `${head}:${CSS}`))
  for (const rel of UX_FINDINGS_E_NEW_FILES) { assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel); assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${rel}`), undefined, `${rel} is new: dev has none`) }
  for (const rel of UX_FINDINGS_E_PIN_FILES) assert.equal(stripUxFindingsE(rel, later(rel, git('show', `${head}:${rel}`))), baseText(rel), `${rel}: an older proof taught: put back it is dev's (a later change's registered lines out first)`)
  for (const rel of UNTOUCHED) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
  for (const rel of touched) assert.ok(!LANES.test(rel), `${rel} is in FRONTEND-1's, COMPOSER-2's or the reconnect proof's lane: only the OK'd lines may be`)
}
const scopeAll = (head, opts) => { scopeOwnCommits(head); scopeCommittedFiles(head, opts); proveRegistryAt(head) }

const HEAD = scopeHead('HEAD')
/** This change's own commits on the FIRST-PARENT line of `head` from BASE. Merged into dev, its commits come in by a merge's second parent and that line has none of them. */
const ownOnLine = head => git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** There the committed diff from BASE holds the later changes' work too, so the scope checks stand down; the pins (read past the later changes' strips) and every other section still run. */
const ON_OWN_LINE = ownOnLine(HEAD).length > 0
const scopeCheck = (label, fn) => (ON_OWN_LINE ? check(label, fn) : undefined)
const scopeMutant = (label, fn) => (ON_OWN_LINE ? mutant(label, fn) : undefined)
if (!ON_OWN_LINE) console.log('NOTE scope: no commit of this change on the first-parent line from BASE (merged into dev: its commits are on a second parent); the scope checks stand down, the pins above cover the files')
await scopeCheck(`this change's own commits (subject starts "${UX_FINDINGS_E_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's (the taught proofs' filters at dev do not match)`, () => { scopeOwnCommits(HEAD) })
await scopeCheck('the committed files are exactly this change\'s: the lib, the mount, the stylesheet, the strip, this proof, .env.example, the registry, the two taught proofs (and FRONTEND-1\'s two files once OK\'d); the intro, the Director header, the skeleton, the profile page, the pages, middleware, next.config, the root layout, package.json and the lockfile are not touched', () => scopeCommittedFiles(HEAD))
await scopeCheck('the registry gains exactly this change\'s three marked lines (files, env block, strip) at the true end of each list, right after the voice call\'s, and loses none; .env.example is dev\'s plus the block', () => proveRegistryAt(HEAD))
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : null
await scopeCheck('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); proveRegistryAt(GATE)
  for (const rel of Object.keys(UX_FINDINGS_E_EDITS)) assert.equal(stripUxFindingsE(rel, git('show', `${GATE}:${rel}`)), baseText(rel), `${rel}: the merged tree, without this change's lines, is dev's`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await scopeCheck('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxe-idx-'))
  try {
    const envIdx = { GIT_INDEX_FILE: path.join(dir, 'index') }
    plumb(['read-tree', parent], envIdx)
    for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], envIdx)
    return plumb(['commit-tree', plumb(['write-tree'], envIdx), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = ON_OWN_LINE ? commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE') : null
const ADVANCED_GATE = ON_OWN_LINE ? gateMerge(unrelated, HEAD) : null
await scopeCheck('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE: the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); proveRegistryAt(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
const scopeBreakers = {
  'a stray file in an own commit': () => { const stray = commitWith(HEAD, { 'stray-ux-findings-e.txt': 'stray\n' }, `${UX_FINDINGS_E_SUBJECT} a stray file${TRAILER}`); assert.ok(ownOf(stray).includes(stray)); assert.doesNotThrow(() => scopeCommittedFiles(HEAD)); scopeCommittedFiles(stray) },
  'an own commit without the co-author line': () => { const c = commitWith(HEAD, {}, `${UX_FINDINGS_E_SUBJECT} no trailer`); assert.throws(() => scopeOwnCommits(c), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named'); scopeOwnCommits(c) },
}
await scopeCheck('scope: a stray file in an own commit fails the files check, an own commit without the co-author line is named, a touched file of FRONTEND-1\'s intro, Director header, skeleton or honesty proof fails it, and a real own commit set still passes', () => {
  assert.throws(scopeBreakers['a stray file in an own commit'], /exactly its scope/); assert.throws(scopeBreakers['an own commit without the co-author line'], error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of ['components/workspace-intro/workspace-intro.tsx', 'components/builder/chat/studio-director-header.tsx', 'components/builder/studio-session-hygiene.tsx', 'scripts/test-studio-ux-honesty.mjs']) {
    const foreign = commitWith(HEAD, { [rel]: `${git('show', `${HEAD}:${rel}`)}\n` }, `${UX_FINDINGS_E_SUBJECT} touches ${rel}${TRAILER}`)
    assert.notEqual(git('show', `${foreign}:${rel}`), git('show', `${HEAD}:${rel}`), `positive control: ${rel} is changed`); assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched|lane/, rel)
  }
  scopeAll(HEAD)
})

// ===== G. robust after merge, and a linear stack ===================================================================================================
console.log('G. robust after merge; a linear stack')
const SYN = { file: 'scripts/test-studio-deck-sync-truth.mjs', mark: 'registry read (SYNTHETIC-LATER)' }
const synStrip = (rel, text) => (rel === SYN.file && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.mark)).join('\n') : text)
const SYN_FILTER = `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Synthetic later:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: ${SYN.mark}: a made-up change stacked after this one`
const SYN_LINES = [
  [').UX_FINDINGS_E_SCOPE_FILES, // LATER-CHANGE:', "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_LATER_SCOPE_FILES, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"],
  [').UX_FINDINGS_E_ENV_BLOCK, // LATER-CHANGE:', "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_LATER_ENV_BLOCK, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"],
  [').stripUxFindingsE, // LATER-CHANGE:', "  (await import('./studio-synthetic-later-strip.mjs')).stripSyntheticLater, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"],
]
const after = (lines, needle, line) => { const at = lines.findIndex(l => l.includes(needle)); assert.ok(at > 0, `${needle} is there`); lines.splice(at + 1, 0, line); return lines }
/** A later change stacked after this one: its subject filter beside this one's in a taught proof (and, with `registryLines`, its three registered-shape lines below ours in the registry). */
const laterCommit = (onto, { registryLines = false, extra = {} } = {}) => {
  const edits = { [SYN.file]: after(git('show', `${onto}:${SYN.file}`).split('\n'), 'registry read (UX-FINDINGS-E)', SYN_FILTER).join('\n'), ...extra }
  if (registryLines) edits[REGISTRY] = SYN_LINES.reduce((lines, [needle, line]) => after(lines, needle, line), git('show', `${onto}:${REGISTRY}`).split('\n')).join('\n')
  return commitWith(onto, edits, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const synLater = (rel, text) => synStrip(rel, laterStrips(rel, text))
function provePins(readAt, at, later) { proveFe1(rel => later(rel, readAt(rel)), at); proveStrip(stripUxFindingsE, readAt, later, at) }
await check('ROBUST AFTER MERGE: on a branch stacked after this change (dev\'s merge brings it in by a second parent, then a later change adds its subject filter beside this one\'s in a taught proof) no own commit is on the first-parent line, the scope stands down there, and the pins, read past the later change\'s strip, still pass', () => {
  const dev = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : HEAD, later = laterCommit(dev), readAt = rel => git('show', `${later}:${rel}`)
  assert.equal(ownOf(later).length, ownOf(HEAD).length, 'this change\'s commits are all there (by the second parent)'); if (ON_OWN_LINE) assert.deepEqual(ownOnLine(later), [], 'none of them on the first-parent line: the scope checks stand down there')
  provePins(readAt, 'stacked after', synLater)
  assert.throws(() => provePins(readAt, 'stacked after, not told', laterStrips), /put back it is dev's|exactly the edited lines|exactly once|one taught line|no second filter/, 'mutant caught: without the later change\'s strip, its line breaks the put-back')
})
await scopeCheck('LINEAR STACK: a later change directly on this head (registered-shape registry lines below ours in each list, a subject-filter line beside ours in a taught proof, removed by its own strip passed into laterStrips): this change\'s own commits are still on the first-parent line, the scope still passes, the registry check leaves its lines to it, and the pins pass', () => {
  const later = laterCommit(HEAD, { registryLines: true }), readAt = rel => git('show', `${later}:${rel}`)
  assert.deepEqual(parentsOf(later), [HEAD]); assert.equal(ownOnLine(later).length, ownOnLine(HEAD).length, 'this change\'s commits are on the first-parent line of the later head: the scope checks RUN there')
  assert.equal(scopeHead(later), later); scopeAll(later, { later: synLater }); provePins(readAt, 'linear stack', synLater)
  assert.throws(() => proveRegistryText(after(git('show', `${later}:${REGISTRY}`).split('\n'), ').stripSyntheticLater, // LATER-CHANGE:', "  (await import('./studio-synthetic-later-strip.mjs')).stripSyntheticLaterToo, // stray: not in the registered shape").join('\n')), /nothing else in the registry/, 'a registry line that is not in the registered shape is still counted')
  const gate = gateMerge(BASE_COMMIT, later); assert.equal(scopeHead(gate), later); scopeAll(scopeHead(gate), { later: synLater })
})
await scopeCheck('LINEAR STACK: an unregistered file in the later commit still fails the whole-diff check; the same file once the registry names it (a later change\'s own file) is left to its change', () => {
  const stray = laterCommit(HEAD, { registryLines: true, extra: { 'stray-later-change.txt': 'stray\n' } })
  assert.throws(() => scopeCommittedFiles(stray, { later: synLater }), /nothing else/, 'an unregistered file fails')
  assert.doesNotThrow(() => scopeCommittedFiles(stray, { later: synLater, registered: new Set([...registry.LATER_CHANGE_FILES, 'stray-later-change.txt']) }), 'a registered one is that change\'s')
  const straySubject = commitWith(HEAD, { 'stray-later-change.txt': 'stray\n' }, `Proofs after merge: an unregistered file${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(straySubject), /nothing else/, 'a later commit with another subject that touches a file the registry does not name still fails')
})

// ===== H. mutants (each one edit of the real sources, fed to the same checks) ====================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const withoutLine = (text, line) => { const lines = text.split('\n'), at = lines.indexOf(line); if (at < 0) throw new SwapError('the line is there'); lines.splice(at, 1); return lines }
const DRAFT_LAYOUT = FE1_DRAFT_OR_OK[LAYOUT], DRAFT_BUILDER = FE1_DRAFT_OR_OK[BUILDER]
const layoutNow = applyEntries(baseText(LAYOUT), DRAFT_LAYOUT), builderNow = applyEntries(baseText(BUILDER), DRAFT_BUILDER)
const fe1Mutant = (rel, entries, text) => { if (text === applyEntries(baseText(rel), entries)) throw new SwapError('the edit did not change the file'); proveFe1Lines(rel, text, entries, draftStrip, 'mutant') }
await mutant('A: the flag reads "1" as on', () => proveFlag(swap(LIB_SRC, "process.env.NEXT_PUBLIC_STUDIO_UX_FINDINGS_E === 'true'", "(process.env.NEXT_PUBLIC_STUDIO_UX_FINDINGS_E === 'true' || process.env.NEXT_PUBLIC_STUDIO_UX_FINDINGS_E === '1')")))
await mutant('A: the flag ignores the Studio shell', () => proveFlag(swap(LIB_SRC, " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\n/** The rail", "\n/** The rail")))
await mutant('B: the mount draws something with the flag on (a wrapper)', () => proveHook(swap(MOUNT_SRC, '  return null\n}\n\n/** Drawn', '  return <div />\n}\n\n/** Drawn')))
await mutant('B: the mount draws its active part with the flag off', () => proveHook(swap(MOUNT_SRC, 'return STUDIO_UX_FINDINGS_E_ENABLED ? <StudioUxFindingsEActive /> : null', 'return <StudioUxFindingsEActive />')))
await mutant('B: the hook sets the attribute with the flag off (its guard dropped)', () => proveHook(swap(MOUNT_SRC, '    if (!STUDIO_UX_FINDINGS_E_ENABLED) return\n    const root = document.documentElement', '    const root = document.documentElement')))
await mutant('B: the hook adds its listener with the flag off', () => proveHook(swap(MOUNT_SRC, '    if (!STUDIO_UX_FINDINGS_E_ENABLED) return\n    // The intro sends', '    // The intro sends')))
await mutant('B: the hook empties the store with the flag off', () => proveHook(swap(MOUNT_SRC, '    if (!STUDIO_UX_FINDINGS_E_ENABLED || !userId) return\n    studioUxFindingsEIntroReconcile', '    if (!userId) return\n    studioUxFindingsEIntroReconcile')))
await mutant('B: the unmount leaves the attribute', () => proveHook(swap(MOUNT_SRC, '    return () => names.forEach(name => root.removeAttribute(name))\n', '')))
await mutant('B: the intro is recorded inside the event (before the intro\'s own write, which would then overwrite it)', () => proveHook(swap(MOUNT_SRC, 'window.setTimeout(() => studioUxFindingsEIntroPlayed(window as unknown as StudioUxFindingsEIntroHost, user.current), 0)', 'studioUxFindingsEIntroPlayed(window as unknown as StudioUxFindingsEIntroHost, user.current)')))
await mutant('B: the logo attribute is set without the logo flag', () => proveHook(swap(MOUNT_SRC, '...(STUDIO_UX_FINDINGS_E_NEW_LOGO ? [STUDIO_UX_FINDINGS_E_LOGO_ATTR] : [])', '...[STUDIO_UX_FINDINGS_E_LOGO_ATTR]')))
await mutant('B: /settings/profile is not redirected', () => proveHook(swap(MOUNT_SRC, '    if (target) router.replace(target)', '    if (target) void target')))
await mutant('B: every settings route is redirected (the profile target is read too loosely)', () => { const l = swap(LIB_SRC, "if (pathname === STUDIO_UX_FINDINGS_E_PROFILE_FROM || pathname === `${STUDIO_UX_FINDINGS_E_PROFILE_FROM}/`)", "if (typeof pathname === 'string' && pathname.startsWith('/settings'))"); assert.equal(lib(ON, l).studioUxFindingsEProfileTarget('/settings/account'), null) })
await mutant('A: the intro-once rule does not empty the store for a first-time user (another account would see nothing)', () => { const l = lib(ON, swap(LIB_SRC, "  try { host.localStorage?.removeItem(STUDIO_UX_FINDINGS_E_INTRO_STORE) } catch { /* Nothing to empty. */ }\n", '')); const win = makeWindow({ 'deckster-studio-workspace-intros-v2': '["decks"]' }); l.studioUxFindingsEIntroReconcile(win, 'u2', false); assert.equal(win.data.has('deckster-studio-workspace-intros-v2'), false, 'first time: emptied') })
await mutant('A: the intro mark is not written with the user id in its key', () => { const l = lib(ON, swap(LIB_SRC, '`deckster-studio-ux-e-intro-once:${userId}`', "'deckster-studio-ux-e-intro-once'")); assert.notEqual(l.studioUxFindingsEIntroKey('u1'), l.studioUxFindingsEIntroKey('u2'), 'the user id is in the key') })
await mutant('B: FRONTEND-1\'s layout mount line moved off its anchor (to the top of the file)', () => fe1Mutant(LAYOUT, DRAFT_LAYOUT, (() => { const lines = withoutLine(layoutNow, DRAFT_LAYOUT[1].line); lines.splice(0, 0, DRAFT_LAYOUT[1].line); return lines.join('\n') })()))
await mutant('B: FRONTEND-1\'s Builder hook line moved off its anchor (below the first early return)', () => fe1Mutant(BUILDER, DRAFT_BUILDER, (() => { const lines = withoutLine(builderNow, DRAFT_BUILDER[1].line); lines.splice(lines.indexOf('  if (isLoading) return <BuilderLoadingState />') + 1, 0, DRAFT_BUILDER[1].line); return lines.join('\n') })()))
await mutant('B: a Builder hook line below an early return fails the position check', () => proveBuilderHook((() => { const lines = withoutLine(BUILDER_TEXT, DRAFT_BUILDER[1].line); lines.splice(lines.indexOf('  if (isLoading) return <BuilderLoadingState />') + 1, 0, DRAFT_BUILDER[1].line); return lines.join('\n') })()))
await mutant('B: an extra unmarked line in the layout', () => fe1Mutant(LAYOUT, DRAFT_LAYOUT, swap(layoutNow, DRAFT_LAYOUT[1].line, `${DRAFT_LAYOUT[1].line}\n      <div />`)))
await mutant('B: an extra unmarked line in the Builder (a constant above the hook)', () => fe1Mutant(BUILDER, DRAFT_BUILDER, swap(builderNow, DRAFT_BUILDER[1].line, `  const sneaky = 1\n${DRAFT_BUILDER[1].line}`)))
await mutant('B: the layout line is not marked', () => fe1Mutant(LAYOUT, DRAFT_LAYOUT, swap(layoutNow, DRAFT_LAYOUT[1].line, DRAFT_LAYOUT[1].line.replace('UX-FINDINGS-E', 'UX-FINDINGS'))))
await mutant('B: a base line of the layout is rewritten', () => fe1Mutant(LAYOUT, DRAFT_LAYOUT, swap(layoutNow, '<div data-studio-v4-shell-workspace="true">{children}</div>', '<div data-studio-v4-shell-workspace="true"><main>{children}</main></div>')))
await mutant('B: the layout draws a visible element for the mount (a wrapper div with the flag off)', () => { const bad = swap(layoutNow, '<StudioUxFindingsEMount />', '<div><StudioUxFindingsEMount /></div>'); assert.equal(renderLayout(bad, {}), renderLayout(baseText(LAYOUT), {}), 'markup is the same') })
await mutant('C: a CSS rule outside the attribute', () => proveCss(`${CSS_SRC}\n.sp-heading h1 { display: none; }\n`))
await mutant('C: one selector of a list outside the attribute', () => proveCss(swap(CSS_SRC, '  display: none;\n}', '  display: none;\n}\n[data-studio-skel-brand="true"], html[data-studio-ux-findings-e="true"] .x { margin: 0; }')))
await mutant('C: a rule inside @media outside the attribute', () => proveCss(swap(CSS_SRC, '@media (max-width: 820px) {\n  html[data-studio-ux-findings-e="true"] .studio-library', '@media (max-width: 820px) {\n  .studio-library')))
await mutant('C: a colour is set', () => proveCss(swap(CSS_SRC, 'margin-left: 9px; overflow: hidden;', 'margin-left: 9px; color: #6a4fc0; overflow: hidden;')))
await mutant('C: a colour in a custom shorthand', () => proveCss(swap(CSS_SRC, 'box-shadow: none; }', 'box-shadow: 0 1px 2px rgb(0 0 0 / 10%); }')))
await mutant('C: !important', () => proveCss(swap(CSS_SRC, 'margin-left: 9px; overflow: hidden;', 'margin-left: 9px !important; overflow: hidden;')))
await mutant('C: the H1 is display:none instead of sr-only', () => { const css = swap(CSS_SRC, '  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;', '  display: none;'); const sr = parseCss(css).find(rule => rule.selectors.some(s => s.includes('main[data-studio-personal="details"] .sp-heading h1'))); assert.deepEqual(sr.decls.map(([k]) => k), ['position', 'width'], 'sr-only') })
await mutant('C: a dead rule (a hook renamed in the sources)', () => proveLive(CSS_SRC, SELECTOR_SOURCES.map(rel => (rel === LIB ? LIB_SRC : read(rel))).map(text => text.replaceAll('sp-profile-confirmation', 'sp-profile-confirm'))))
await mutant('D: a strip that leaves a line (the registry strip line stays)', () => proveStrip((rel, text) => (rel === REGISTRY ? text.split('\n').filter(line => line !== UX_FINDINGS_E_REGISTRY_ENV_LINE).join('\n') : stripUxFindingsE(rel, text))))
await mutant('D: a strip that leaves the env block', () => proveStrip((rel, text) => (rel === ENV_FILE ? text : stripUxFindingsE(rel, text))))
await mutant('D: a strip that does not put a taught proof back', () => proveStrip((rel, text) => (UX_FINDINGS_E_PIN_FILES.includes(rel) ? text : stripUxFindingsE(rel, text))))
await mutant('D: a strip that is not idempotent (it takes one more line away each time)', () => proveStrip((rel, text) => { const out = stripUxFindingsE(rel, text); return rel === REGISTRY && out === text ? out.replace(/^\/\/ .*\n/, '') : out }))
await mutant('D: a strip that edits a file it does not own', () => proveStrip((rel, text) => (rel === BUILDER ? `${text}x` : stripUxFindingsE(rel, text))))
await mutant('D: a taught proof keeps a second, unmarked line', () => proveStrip(stripUxFindingsE, rel => (rel === UX_FINDINGS_E_PIN_FILES[0] ? read(rel).replace(UX_FINDINGS_E_PIN_EDITS[rel][0][0], `${UX_FINDINGS_E_PIN_EDITS[rel][0][0]}  // stray\n`) : read(rel))))
await mutant('D: a taught line without the registry-read mark', () => proveStrip(stripUxFindingsE, rel => (rel === UX_FINDINGS_E_PIN_FILES[1] ? swap(read(rel), 'registry read (UX-FINDINGS-E): on a branch', 'on a branch') : read(rel))))
await mutant('D: a taught line put somewhere that is not after a subject filter', () => proveStrip(stripUxFindingsE, rel => {
  if (rel !== UX_FINDINGS_E_PIN_FILES[0]) return read(rel)
  const lines = read(rel).split('\n'), at = lines.findIndex(l => l.includes(UX_FINDINGS_E_PIN_MARK)), [line] = lines.splice(at, 1); lines.splice(lines.findIndex(l => l.startsWith('import ')), 0, line); return lines.join('\n')
}))
const REG_NOW = read(REGISTRY)
const regLinesOf = text => text.split('\n')
await mutant('E: the env line missing (a files line and a strip without their env block)', () => proveRegistryText(regLinesOf(REG_NOW).filter(l => !(l.includes(OWN_NAME) && l.includes('ENV_BLOCK'))).join('\n')))
await mutant('E: the files line above dev\'s last line (not the true end of its list)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('SCOPE_FILES')), [line] = reg.splice(at, 1); reg.splice(reg.findIndex(l => l.includes('studio-voice-call-strip.mjs') && l.includes('SCOPE_FILES')), 0, line); proveRegistryText(reg.join('\n')) })
await mutant('E: the strip line missing', () => proveRegistryText(regLinesOf(REG_NOW).filter(l => !(l.includes(OWN_NAME) && l.includes('stripUxFindingsE'))).join('\n')))
await mutant('E: a line of dev\'s registry lost', () => { const reg = regLinesOf(REG_NOW); reg.splice(reg.findIndex(l => l.includes('studio-voice-call-strip.mjs') && l.includes('stripVoiceCall')), 1); proveRegistryText(reg.join('\n')) })
await mutant('E: a second env line (two lines in one list)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('ENV_BLOCK')); reg.splice(at + 1, 0, reg[at]); proveRegistryText(reg.join('\n')) })
await mutant('E: a registry line that is not in the registered shape below ours', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('stripUxFindingsE')); reg.splice(at + 1, 0, "  (await import('./studio-x-strip.mjs')).stripX, // not registered"); proveRegistryText(reg.join('\n')) })
await mutant('E: .env.example gains a second block', () => proveEnvText(`${read(ENV_FILE)}\n# a block\nNEXT_PUBLIC_X="false"\n`))
await mutant('E: the block is not at the true end (a line follows it)', () => proveEnvText(`${read(ENV_FILE)}NEXT_PUBLIC_X="false"\n`))
await mutant('E: the flag is on by default in the block', () => proveEnvText(read(ENV_FILE).replace('NEXT_PUBLIC_STUDIO_UX_FINDINGS_E="false"', 'NEXT_PUBLIC_STUDIO_UX_FINDINGS_E="true"')))
if (ON_OWN_LINE) {
  await mutant('F: a stray file in an own commit', () => scopeBreakers['a stray file in an own commit']())
  await mutant('F: an own commit without the co-author line', () => scopeBreakers['an own commit without the co-author line']())
  await mutant('F: the old first-parent query (finds no own commit on the gate-style merge)', () => scopeOwnCommits(GATE, { firstParentOnly: true }))
  await mutant('F: the HEAD^2 rule dropped (the scope runs against the merge itself)', () => { assert.equal(scopeHead(GATE, { gateRule: false }), HEAD, 'the scope head is the change\'s head') })
  await mutant('F: a touched file of FRONTEND-1\'s (an own commit edits the intro)', () => scopeCommittedFiles(commitWith(HEAD, { [INTRO]: `${git('show', `${HEAD}:${INTRO}`)}\n` }, `${UX_FINDINGS_E_SUBJECT} edits the intro${TRAILER}`)))
  await mutant('G: a later commit with an unregistered file stacked on this head', () => scopeCommittedFiles(laterCommit(HEAD, { registryLines: true, extra: { 'stray-later-change.txt': 'stray\n' } }), { later: synLater }))
  await mutant('G: the later change\'s strip not told to the pins (its line breaks the put-back)', () => provePins(rel => git('show', `${laterCommit(HEAD, { registryLines: true })}:${rel}`), 'linear stack, not told', laterStrips))
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { for (const label of failed) console.error(`  failed: ${label}`); for (const label of missed) console.error(`  missed: ${label}`); process.exit(1) }
