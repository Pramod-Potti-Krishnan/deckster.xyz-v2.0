// FRONTEND-2 (PK's W2 P4-7/8 rulings, 2 Nov): proof of NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH (the string "true", default off, build-time).
//   lib/studio-template-match.ts (pure decisions), lib/studio-template-match-wire.ts (the capability), hooks/use-studio-template-match.ts (the latest frame, the preference, the sends), components/builder/studio-template-match-*.tsx
//   and studio-template-auto-apply-check.tsx (+ studio-template-match.css), marked lines in five existing files, and the .env.example block.
//
//   A. The REAL recorded frames (DIRECTOR-2's M0-M5, scripts/studio-template-match-fixtures/frames.json, extracted verbatim from streams/director2/p4-7-template-match/out): replayed through the REAL hook and lib. Every Studio->Director
//      message of a recording is what Studio's builders produce, in the recorded order (the connect-time template_auto_apply before the first user_message, the switches, the toggles); every Director frame is drawn as the recorded
//      state says: all six reasons, no_match, auto-apply off (no badge, no chips, no group), a switch with built slides (the built chips keep the old template), Undo to null, a chat switch. No frame is made by hand.
//   B. The lib's pure functions: the flag, the words (the mock's), the counts, the preference with a throwing localStorage, a malformed / unknown-version frame (a negative case: derived from a real frame by one change).
//   C. The REAL components in the offline React host with the real CSS: the badge (Change, Undo, the stage gate, phone), the chip, the group, the sheet, the check; and flag off: nothing is sent, stored or drawn.
//   D. The wire: the capability only with the flag on and LAST, the base caps equal to the recorded Studio list; the socket hook's marked lines.
//   E. The marked lines in the existing files, the strip (flag off = the base, byte for byte), .env.example, the registry, and the scope over the COMMITTED diff, gate-safe.
//   F. MUTANTS: every one of them must be caught.
//
//   node scripts/test-studio-template-match.mjs
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed); git is read only for E (objects are written from temporary files, never `hash-object --stdin`).
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
installHostNetworkGuard(net, dns)
const React = (await import('react')).default
const { renderToStaticMarkup } = await import('react-dom/server')
const { Root, hostNodes, textOf, toElements } = await import('./studio-chat-harness/mini-react.mjs')
const strip = await import('./studio-template-match-strip.mjs')
const registry = await import('./studio-later-changes.mjs')

let checks = 0, passed = 0
const failures = []
const SUITE = [] // the checks of A-D (re-run for every mutant with the mutant's text in place)
function check(label, fn, { mutable = true } = {}) {
  if (mutable) SUITE.push({ label, fn })
  const before = checks
  try { fn(); passed++; console.log(`ok   ${label} (${checks - before} asserts)`) } catch (error) { failures.push(`${label}: ${error.message.split('\n')[0]}`); console.log(`FAIL ${label}\n     ${error.message.split('\n').slice(0, 4).join('\n     ')}`) }
}
function mutant(label, run) {
  try { run() } catch { passed++; console.log(`ok   mutant caught: ${label}`); return }
  failures.push(`mutant survived: ${label}`); console.log(`FAIL mutant survived: ${label}`)
}
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const attr = (node, name) => node.props[name]
const noComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }

// ---- the recordings ------------------------------------------------------------------------------------------------------------------------------------------------------
const FIXTURE_PATH = 'scripts/studio-template-match-fixtures/frames.json'
const FIX = JSON.parse(read(FIXTURE_PATH))
const SC = FIX.scenarios
const SESSION = 's_p47_m'
const inbound = (name, type) => SC[name].frames.filter(item => item.direction === 'in' && item.type === type)
const recorded = (name, seq) => { const item = SC[name].frames.find(frame => frame.seq === seq); assert.ok(item, `${name} seq ${seq}`); return item.frame }
const directorFrames = name => SC[name].frames.filter(item => item.type === 'template_match')
/** One real frame with one change (a field deleted or altered): for a NEGATIVE case or a precedence check, never evidence of what Director sends. */
const derive = (name, seq, edit) => { const copy = JSON.parse(JSON.stringify(recorded(name, seq))); edit(copy.payload); return copy } // a NEGATIVE case: one real frame, one change
const ENVELOPE_CAPS = SC.M1.client_caps.slice(0, -1) // Studio's list as the recordings carry it, without the new cap
const WORKSPACE_OUT = path.join(process.env.HOME || '', 'Deckster/.worktrees/frontend2-ws/streams/director2/p4-7-template-match/out')

// ---- evaluation of module text (the real files and the mutants) -----------------------------------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
const resolveRepo = spec => { const base = spec.slice(2); for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, base + ext))) return base + ext; throw new Error(`no repo file for ${spec}`) }
const fakeLink = ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children)
const dialogStub = { // a stand-in for Radix Dialog in the offline host: the content is there while open
  Root: ({ open, children }) => (open ? React.createElement(React.Fragment, null, children) : null),
  Portal: ({ children }) => children,
  Overlay: props => React.createElement('div', props),
  Content: ({ children, ...rest }) => React.createElement('div', rest, children),
  Title: ({ asChild, children, ...rest }) => (asChild ? children : React.createElement('h2', rest, children)),
}
function makeLoader({ env = {}, window, overrides = {}, stubs = {} } = {}) {
  const cache = new Map()
  const load = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const scope = { process: { env }, ...(window !== undefined ? { window } : {}) }
    new Function('module', 'exports', 'require', ...Object.keys(scope), compile(rel in overrides ? overrides[rel] : src(rel), rel))(module, module.exports, spec => requireFor(rel, spec), ...Object.values(scope))
    return module.exports
  }
  const requireFor = (from, spec) => {
    if (spec in stubs) return stubs[spec]
    if (spec.startsWith('@/')) return load(resolveRepo(spec))
    if (spec.startsWith('./')) return spec.endsWith('.css') ? {} : load(resolveRepo(`@/${path.posix.join(path.posix.dirname(from), spec.slice(2))}`))
    if (spec === 'next/link') return { __esModule: true, default: fakeLink }
    if (['react', 'react/jsx-runtime', 'lucide-react'].includes(spec)) return require(spec)
    throw new Error(`unexpected import ${spec} in ${from}`)
  }
  return { load }
}

let ACTIVE = {} // a mutant's text, merged into every loader (set and restored by mutantSuite)
const src = rel => (rel in ACTIVE ? ACTIVE[rel] : read(rel))
const FLAG = strip.STUDIO_TEMPLATE_MATCH_FLAG
const ON_ENV = { [FLAG]: 'true' }
const LIB = 'lib/studio-template-match.ts', WIRE = 'lib/studio-template-match-wire.ts', HOOK = 'hooks/use-studio-template-match.ts'
const BADGE = 'components/builder/studio-template-match-badge.tsx', CHIP = 'components/builder/studio-template-match-chip.tsx', GROUP = 'components/builder/studio-template-match-group.tsx'
const SHEET = 'components/builder/studio-template-match-sheet.tsx', CHECK = 'components/builder/studio-template-auto-apply-check.tsx', CSS = 'components/builder/studio-template-match.css'
const WS_HOOK = 'hooks/use-deckster-websocket-v2.ts', PICKER = 'components/studio-template-workspace/picker.tsx', COMPOSER_PICKER = 'components/builder/template-picker.tsx'
const AREA = 'components/builder/presentation-area.tsx', STRIP = 'components/slide-thumbnail-strip.tsx'

/** A throwaway browser: localStorage (or a broken one) and matchMedia. */
function fakeStorage(seed) {
  const map = new Map(seed ? Object.entries(seed) : [])
  const storage = { map, writes: 0, getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { storage.writes++; map.set(key, String(value)) } } // writes counts what the code wrote (a seed put in the map is not a write)
  return storage
}
function makeWorld({ env = ON_ENV, storage = fakeStorage(), gateOpen = true, phoneShell = false, phone = false, overrides = {}, brokenWindow = false } = {}) {
  const state = { gateOpen, phone }
  const window = { matchMedia: () => ({ matches: state.phone }) }
  if (brokenWindow) Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked') } })
  else window.localStorage = storage
  const stubs = {
    '@/lib/studio-stage-open-gate': { useStudioStageOpen: () => state.gateOpen },
    '@/lib/studio-phone-shell': { STUDIO_PHONE_SHELL_ENABLED: phoneShell },
    '@radix-ui/react-dialog': dialogStub,
  }
  const loader = makeLoader({ env, window, overrides, stubs })
  return { state, window, storage, lib: loader.load(LIB), hook: loader.load(HOOK), load: loader.load }
}
function mount(world, rel, exportName, props = {}) {
  const Component = world.load(rel)[exportName]
  const root_ = new Root()
  root_.setElement(React.createElement(Component, props))
  root_.flush()
  const handle = {
    refresh() { root_.schedule(); root_.flush(); return handle },
    hosts: () => hostNodes(root_.tree),
    text: () => textOf(root_.tree),
    html: () => (root_.tree ? renderToStaticMarkup(toElements(root_.tree)) : ''),
    byAttr: (name, value) => handle.hosts().filter(node => node.props[name] === value),
    click(node) { node.props.onClick({ preventDefault() {}, stopPropagation() {} }); return handle.refresh() },
    unmount: () => root_.unmount(),
  }
  return handle
}

// ============================================================================================================================================
// What the recordings must draw (written from reading the recorded frames, not computed by the lib)
// ============================================================================================================================================
const ATLAS_CHIPS = [1, 2, 3, 4].map(n => `Atlas Quarterly · slide ${n}`).concat(['New in your theme'], [6, 7, 8, 9, 10].map(n => `Atlas Quarterly · slide ${n}`))
const FROM_MERIDIAN = Array(10).fill('From Meridian Roadmap')
const MERIDIAN_OWN = ['New in your theme', ...[2, 3, 4, 5].map(n => `Meridian Roadmap \u00b7 slide ${n}`), 'New in your theme', ...[7, 8].map(n => `Meridian Roadmap \u00b7 slide ${n}`), 'New in your theme', 'New in your theme'] // M3-s11: Meridian's own matches (slides 2, 3, 4, 5, 7, 8)
const rowsOf = inUse => [['Atlas Quarterly', 'Yours', inUse === 'atlas', '9 of 10 slides'], ['Meridian Roadmap', 'Yours', inUse === 'meridian', '6 of 10 slides'], ['No template', null, inUse === 'none', null]]
const EXPECT = {
  'M1:14': { reason: 'match', badge: 'Using your template Atlas Quarterly · 9 of 10 slides', undo: undefined, chips: ATLAS_CHIPS, rows: rowsOf('atlas') },
  'M2:13': { reason: 'match', badge: '5 slides use your templates', undo: undefined,
    chips: ['Atlas Quarterly · slide 1', 'New in your theme', 'Meridian Roadmap · slide 3', 'Meridian Roadmap · slide 4', 'New in your theme', 'New in your theme', 'Meridian Roadmap · slide 7', 'New in your theme', 'New in your theme', 'Atlas Quarterly · slide 10'],
    rows: [['Meridian Roadmap', 'Yours', true, '3 of 10 slides'], ['Atlas Quarterly', 'Yours', false, '2 of 10 slides'], ['No template', null, false, null]] },
  'M3:14': { reason: 'match', badge: 'Using your template Atlas Quarterly · 9 of 10 slides', undo: undefined, chips: ATLAS_CHIPS, rows: rowsOf('atlas') },
  'M3:16': { reason: 'switch', badge: 'Using your template Meridian Roadmap · 6 of 10 slides', undo: { to: 'tpl_fake_atlas' }, chips: FROM_MERIDIAN, rows: rowsOf('meridian') },
  'M3:18': { reason: 'undo', badge: 'Using your template Atlas Quarterly · 9 of 10 slides', undo: { to: 'tpl_fake_meridian' }, chips: ATLAS_CHIPS, rows: rowsOf('atlas') },
  'M3:21': { reason: 'chat_switch', badge: 'Using your template Meridian Roadmap · 6 of 10 slides', undo: { to: 'tpl_fake_atlas' }, chips: FROM_MERIDIAN, rows: rowsOf('meridian') },
  'M3:23': { reason: 'no_template', badge: null, undo: undefined, chips: Array(10).fill(null), rows: rowsOf('none') },
  'M3:25': { reason: 'undo', badge: 'Using your template Meridian Roadmap · 6 of 10 slides', undo: { to: null }, chips: FROM_MERIDIAN, rows: rowsOf('meridian') },
  'M4:14': { reason: 'match', badge: null, undo: undefined, chips: Array(10).fill(null), rows: [] },
  'M4:16': { reason: 'match', badge: 'Using your template Atlas Quarterly · 9 of 10 slides', undo: undefined, chips: ATLAS_CHIPS, rows: rowsOf('atlas') },
  'M4:18': { reason: 'auto_apply_off', badge: null, undo: undefined, chips: Array(10).fill(null), rows: [] },
  'M5:14': { reason: 'match', badge: 'Using your template Atlas Quarterly · 9 of 10 slides', undo: undefined, chips: ATLAS_CHIPS, rows: rowsOf('atlas') },
  // section 11 (P4-7b, Director !606): the applied template's own chips follow every switch; the counts are covered / total
  'M1-s11:14': { reason: 'match', badge: 'Using your template Atlas Quarterly \u00b7 9 of 10 slides', undo: undefined, chips: ATLAS_CHIPS, rows: rowsOf('atlas') },
  'M3-s11:14': { reason: 'match', badge: 'Using your template Atlas Quarterly \u00b7 9 of 10 slides', undo: undefined, chips: ATLAS_CHIPS, rows: rowsOf('atlas') },
  'M3-s11:16': { reason: 'switch', badge: '6 slides use your templates', undo: { to: 'tpl_fake_atlas' }, chips: MERIDIAN_OWN, rows: rowsOf('meridian') },
  'M3-s11:18': { reason: 'undo', badge: 'Using your template Atlas Quarterly \u00b7 9 of 10 slides', undo: { to: 'tpl_fake_meridian' }, chips: ATLAS_CHIPS, rows: rowsOf('atlas') },
  'M3-s11:21': { reason: 'chat_switch', badge: '6 slides use your templates', undo: { to: 'tpl_fake_atlas' }, chips: MERIDIAN_OWN, rows: rowsOf('meridian') },
  'M3-s11:23': { reason: 'no_template', badge: null, undo: undefined, chips: Array(10).fill(null), rows: rowsOf('none') },
  'M3-s11:25': { reason: 'undo', badge: '6 slides use your templates', undo: { to: null }, chips: MERIDIAN_OWN, rows: rowsOf('meridian') },
  'M5:77': { reason: 'chat_switch', badge: 'Using Meridian Roadmap for the slides not built yet', undo: { to: 'tpl_fake_atlas' }, chips: ATLAS_CHIPS, rows: rowsOf('meridian') },
}
/** What a snapshot of the store draws, in the proof's terms. */
const viewOf = snapshot => ({
  reason: snapshot.frame ? snapshot.frame.reason : undefined,
  badge: snapshot.badge ? snapshot.badge.text : null,
  undo: snapshot.badge && snapshot.badge.undo ? snapshot.badge.undo : undefined,
  chips: Array.from({ length: 10 }, (_, i) => (snapshot.chips.get(i + 1) ? snapshot.chips.get(i + 1).text : null)),
  rows: snapshot.rows.map(row => [row.name, row.owner, row.inUse, row.coverage]),
})

// ============================================================================================================================================
// A. The recordings, replayed through the real hook
// ============================================================================================================================================
/** Studio's side of one recording: the socket opens (the preference goes out), then each recorded step is driven the way the UI drives it, and each Director frame is received. */
function replay(name, world = makeWorld()) {
  const { hook } = world
  hook.studioTemplateMatchStore.reset()
  const first = inbound(name, 'template_auto_apply')[0]
  if (first && first.frame.data.enabled === false) world.storage.map.set(world.lib.TEMPLATE_AUTO_APPLY_STORAGE_KEY, JSON.stringify({ u_test: false }))
  const sent = [], views = []
  const socket = { send: message => { sent.push(message); return true }, caps: () => ENVELOPE_CAPS }
  ok(hook.templateMatchSocketOpened({ sessionId: SESSION, userId: 'u_test', socket }), `${name}: the socket opened and the preference went out`)
  eq(sent.length, 1, `${name}: exactly one message at connect`)
  eq(sent[0].type, 'template_auto_apply', `${name}: ... a template_auto_apply, before any user_message`)
  let seenConnectStep = false
  for (const step of SC[name].frames) {
    if (step.direction === 'in' && step.type === 'template_auto_apply') { if (seenConnectStep) hook.setTemplateAutoApply(step.frame.data.enabled); seenConnectStep = true }
    else if (step.direction === 'in' && step.type === 'template_switch') hook.switchTemplate(step.frame.data.template_id)
    else if (step.type === 'template_match') {
      ok(hook.templateMatchFrameReceived(step.frame, SESSION), `${name} seq ${step.seq}: the recorded frame is taken`)
      views.push([`${name}:${step.seq}`, viewOf(hook.studioTemplateMatchStore.getSnapshot())])
    }
  }
  return { sent, views, world }
}

check('A. every recorded Director frame is drawn as its recorded state says (all six reasons, no_match, auto-apply off, a chat switch with every slide built)', () => {
  let reasons = new Set(), frames = 0
  for (const name of ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M1-s11', 'M3-s11']) {
    const { views } = replay(name)
    eq(views.length, directorFrames(name).length, `${name}: one view per recorded frame`)
    for (const [key, view] of views) { eq(view, EXPECT[key], key); reasons.add(view.reason); frames++ }
  }
  eq(frames, 20, 'twenty recorded template_match frames (thirteen v0, seven with the section 11 fields)'); eq([...reasons].sort(), ['auto_apply_off', 'chat_switch', 'match', 'no_template', 'switch', 'undo'], 'every reason value of the contract is in the recordings and drawn')
  eq(directorFrames('M0').length, 0, 'M0 (no_match) has no frame at all: nothing is drawn')
  eq(Object.keys(EXPECT).length, 20, 'the table covers every recorded frame')
})

check('A. every message Studio sends in a recording is what the builders produce, in the recorded order; the connect-time template_auto_apply comes before the first user_message', () => {
  for (const name of ['M1', 'M3', 'M4', 'M5', 'M1-s11', 'M3-s11']) {
    const replayed = replay(name), { sent } = replayed
    const want = SC[name].frames.filter(step => step.direction === 'in' && (step.type === 'template_auto_apply' || step.type === 'template_switch')).map(step => step.frame)
    eq(sent, want, `${name}: the sent messages are the recorded ones, verbatim (data, not payload; client_caps ends with template_match1)`)
    const order = SC[name].frames.filter(step => step.direction === 'in').map(step => step.type)
    eq(order[0], 'template_auto_apply', `${name}: recorded: the first inbound is the connect-time step`)
    ok(order.indexOf('template_auto_apply') < order.indexOf('user_message'), `${name}: ... before the first user_message`)
    for (const message of sent) eq(message.data.client_caps.at(-1), 'template_match1', `${name}: the cap is last`)
    eq(replayed.world.storage.writes, Math.max(0, inbound(name, 'template_auto_apply').length - 1), `${name}: the preference was written once per toggle and never by a frame (our own toggle's answer carries the same value; the recorded switches leave auto_apply alone)`)
  }
  // M0 and M2 were recorded without the connect step; Studio sends it on every connect all the same, with the same envelope as M1's
  for (const name of ['M0', 'M2']) {
    eq(inbound(name, 'template_auto_apply').length, 0, `${name}: recorded without the connect step`)
    const { sent } = replay(name)
    eq(sent, [recorded('M1', 7)], `${name}: Studio still sends the connect-time message, the same as M1's`)
  }
  eq(recorded('M3', 26).data.template_id, 'tpl_fake_other_user', 'a foreign id is sent as it is (Director ignores it and sends no frame)')
  eq(replay('M3').sent.at(-1), recorded('M3', 26), 'the foreign-id step is the last message')
})

check('A. a switch with built slides: the built slides keep their recorded chip (the old template), whatever was switched; Undo goes back to the old template', () => {
  const { views } = replay('M5')
  const switched = views.find(([key]) => key === 'M5:77')[1]
  eq(switched.chips, ATLAS_CHIPS, 'all ten slides are built: every chip is the recorded Atlas one, not Meridian')
  eq(switched.badge, 'Using Meridian Roadmap for the slides not built yet', 'the badge names the new template for the slides not built yet')
  eq(switched.undo, { to: 'tpl_fake_atlas' }, 'Undo goes back to Atlas')
  eq(recorded('M5', 77).payload.built_slide_ids.length, 10, 'the frame lists all ten as built')
})

check('A. Undo to null restores "no template": the recorded undo whose previous template was none', () => {
  const frame = directorFrames('M3').find(item => item.seq === 25).frame
  eq(frame.payload.previous_template_id, null, 'recorded: previous_template_id is null (not absent)')
  const world = makeWorld()
  const { hook, lib } = world
  hook.studioTemplateMatchStore.reset()
  const sent = []
  hook.templateMatchSocketOpened({ sessionId: SESSION, userId: 'u_test', socket: { send: m => { sent.push(m); return true }, caps: () => ENVELOPE_CAPS } })
  hook.templateMatchFrameReceived(frame, SESSION)
  const badge = hook.studioTemplateMatchStore.getSnapshot().badge
  eq(badge.undo, { to: null }, 'Undo is offered, and goes to null')
  ok(hook.switchTemplate(badge.undo.to), 'Undo sends')
  eq(sent.at(-1), recorded('M3', 22), 'the Undo is the recorded template_switch with template_id null')
  eq(lib.undoFor(null), null, 'no frame, no Undo')
})

check('A. the store follows the latest frame only: a frame of another session never shows, a bad frame leaves the last good one, a new socket of the same session keeps it', () => {
  const world = makeWorld(); const { hook } = world; const store = hook.studioTemplateMatchStore
  store.reset()
  const socket = { send: () => true, caps: () => ENVELOPE_CAPS }
  hook.templateMatchSocketOpened({ sessionId: SESSION, userId: 'u_test', socket })
  const m1 = directorFrames('M1')[0].frame
  hook.templateMatchFrameReceived(m1, SESSION)
  eq(store.getSnapshot().badge.text, EXPECT['M1:14'].badge, 'the frame shows')
  ok(!hook.templateMatchFrameReceived({ ...m1, payload: { ...m1.payload, version: 2 } }, SESSION), 'an unknown version is not taken')
  eq(store.getSnapshot().badge.text, EXPECT['M1:14'].badge, '... and the last good frame stays')
  hook.templateMatchSocketOpened({ sessionId: SESSION, userId: 'u_test', socket })
  eq(store.getSnapshot().badge.text, EXPECT['M1:14'].badge, 'a reconnect of the same session keeps the frame')
  hook.templateMatchSocketOpened({ sessionId: 's_other', userId: 'u_test', socket })
  eq(store.getSnapshot().badge, null, 'a socket of another session drops it: nothing of the old deck is shown on the new one')
  eq(store.getSnapshot().chips.size, 0, '... no chips either')
  eq(store.getSnapshot().sessionId, 's_other', '... and the store follows the new session')
})

check('A. the standing preference follows the frame\'s auto_apply (PK 17:13Z: the check is the user\'s standing setting; DIRECTOR-2 17:23Z: a chat "no template" turns it off for the session): written once, shown in the check, nothing sent back, nothing announced', () => {
  const frameOf = (name, seq) => directorFrames(name).find(item => item.seq === seq).frame
  const KEY = 'studio.templateAutoApply.v1'
  const stored = world => JSON.parse(world.storage.map.get(KEY) ?? 'null')
  const ticked = (world) => attr(mount(world, CHECK, 'StudioTemplateAutoApplyCheck').hosts().filter(n => n.type === 'input')[0], 'checked')
  const lib = makeWorld().lib
  // the pure rule, on the recorded frames
  const parsed = (name, seq) => lib.parseTemplateMatchFrame(frameOf(name, seq))
  eq([lib.autoApplyAfterFrame(parsed('M4', 18), true), lib.autoApplyAfterFrame(parsed('M4', 18), false), lib.autoApplyAfterFrame(parsed('M4', 16), false), lib.autoApplyAfterFrame(parsed('M4', 16), true)], [false, null, true, null], 'the rule: the frame\'s value when it differs, else null')
  eq([lib.autoApplyAfterFrame(null, true), lib.autoApplyAfterFrame(parsed('M1', 14), 'yes')], [null, null], 'no frame or no real preference: nothing to write')
  // 1. a frame with auto_apply false after true (M4 seq 18 as received while the preference is ON): written, the check unticked, nothing sent back
  let world = makeWorld(), sent = open(world, null, 0)
  eq([ticked(world), world.storage.writes], [true, 0], 'the check starts ticked, nothing written yet')
  ok(world.hook.templateMatchFrameReceived(frameOf('M4', 18), SESSION), 'the frame is taken')
  eq([stored(world), world.storage.writes, world.hook.studioTemplateMatchStore.getSnapshot().autoApply, ticked(world)], [{ u_test: false }, 1, false, false], 'auto_apply false after true: written (false, once), published, the check unticked')
  eq(sent, [], 'nothing is sent back (Director already has the value: no echo loop)')
  eq(world.hook.studioTemplateMatchStore.getSnapshot().badge, null, 'and the frame is drawn as ever (auto-apply off: no badge)')
  // 2. a later true writes true and ticks the check
  ok(world.hook.templateMatchFrameReceived(frameOf('M4', 16), SESSION), 'the next frame is taken')
  eq([stored(world), world.storage.writes, world.hook.studioTemplateMatchStore.getSnapshot().autoApply, ticked(world), sent], [{ u_test: true }, 2, true, true, []], 'a later true: written (true), the check ticked, still nothing sent')
  // 3. a switch to null leaves auto_apply as it was: its frame writes nothing (M3 seq 23 and M3-s11 seq 23 are the recorded template_switch null)
  for (const [name, seq] of [['M3', 23], ['M3-s11', 23]]) {
    world = makeWorld(); sent = open(world, null, 0)
    eq(frameOf(name, seq).payload.reason, 'no_template', `${name}:${seq} is the recorded switch to null`)
    ok(world.hook.templateMatchFrameReceived(frameOf(name, seq), SESSION), `${name}:${seq} is taken`)
    eq([world.storage.writes, world.storage.map.size, world.hook.studioTemplateMatchStore.getSnapshot().autoApply, ticked(world), sent], [0, 0, true, true, []], `${name}:${seq}: a switch to null writes nothing and leaves the check ticked`)
  }
  // 4. a re-sent same-value frame (a reconnect's refresh) writes nothing: auto-apply ON (M1 seq 14, twice) and OFF (M4 seq 14 then 18, with the preference already off)
  world = makeWorld(); sent = open(world, null, 0)
  world.hook.templateMatchFrameReceived(frameOf('M1', 14), SESSION); world.hook.templateMatchFrameReceived(frameOf('M1', 14), SESSION)
  eq([world.storage.writes, ticked(world), sent], [0, true, []], 'a refresh with the same value (ON): nothing written')
  world = makeWorld({ storage: fakeStorage({ [KEY]: JSON.stringify({ u_test: false }) }) }); sent = open(world, null, 0)
  eq(ticked(world), false, 'the saved OFF is what the check starts from')
  for (const seq of [14, 18, 14]) world.hook.templateMatchFrameReceived(frameOf('M4', seq), SESSION)
  eq([world.storage.writes, stored(world), ticked(world), sent], [0, { u_test: false }, false, []], 'a refresh with the same value (OFF), as the connect-time frame and as the auto_apply_off answer: nothing written')
  // 5. another session\'s frame writes nothing and is not taken
  world = makeWorld(); sent = open(world, null, 0)
  eq(world.hook.templateMatchFrameReceived(frameOf('M4', 18), 's_other'), false, 'a frame of another session is not taken')
  eq([world.storage.writes, world.storage.map.size, world.hook.studioTemplateMatchStore.getSnapshot().autoApply, world.hook.studioTemplateMatchStore.getSnapshot().frame, ticked(world)], [0, 0, true, null, true], '... nothing written, the check ticked, no frame kept')
  // 6. a storage that throws: the check still follows for the page
  for (const [label, make] of [['setItem throws', () => makeWorld({ storage: { getItem: () => null, setItem() { throw new Error('QuotaExceededError') } } })], ['localStorage itself throws', () => makeWorld({ brokenWindow: true })]]) {
    world = make(); sent = open(world, null, 0)
    ok(world.hook.templateMatchFrameReceived(frameOf('M4', 18), SESSION), `${label}: the frame is taken`)
    eq([world.hook.studioTemplateMatchStore.getSnapshot().autoApply, ticked(world), sent], [false, false, []], `${label}: the check still follows the frame (this page), nothing thrown, nothing sent`)
  }
  // 7. our own toggle: written by the toggle, its answer writes nothing more, and the only message is the toggle itself
  world = makeWorld(); sent = open(world, null, 0)
  world.hook.setTemplateAutoApply(false)
  world.hook.templateMatchFrameReceived(frameOf('M4', 18), SESSION)
  eq([world.storage.writes, stored(world), sent], [1, { u_test: false }, [recorded('M4', 17)]], 'our own toggle: one write (the toggle\'s), its answer writes nothing, one message (the recorded "off" envelope)')
  // 8. no notice: nothing in the hook or the check announces the change
  ok(!/toast|notice|alert|announce|aria-live/i.test(noComments(src(HOOK)) + noComments(src(CHECK))), 'no toast, notice or live region anywhere in the hook or the check')
})

check('A. section 11 (the field-present recordings M1-s11 / M3-s11): the key `applied_match` is on every row of an s11 frame and on none of v0; the counts come from covered / total; the applied template\'s own chips follow every switch (rule 2), and agree with deck[k].slides (rule 3)', () => {
  const rows = name => directorFrames(name).flatMap(item => item.frame.payload.slides)
  for (const name of ['M1-s11', 'M3-s11']) { ok(rows(name).length > 0 && rows(name).every(row => 'applied_match' in row), `${name}: applied_match is on every top-level row (the key, null or not)`); eq(SC[name].client_caps, SC.M1.client_caps, `${name}: the same client caps as the v0 recordings`) }
  for (const name of ['M0', 'M1', 'M2', 'M3', 'M4', 'M5']) ok(rows(name).every(row => !('applied_match' in row)), `${name}: v0 rows have no applied_match key`)
  const frameOf = (name, seq) => directorFrames(name).find(item => item.seq === seq).frame
  const lib = makeWorld().lib
  for (const item of frameOf('M3-s11', 16).payload.deck) ok(Number.isInteger(item.covered) && Number.isInteger(item.total) && Array.isArray(item.slides), `${item.name}: covered, total and its own slides are in the frame`)
  eq(frameOf('M3-s11', 16).payload.deck.map(item => [item.covered, item.total]), [[9, 10], [6, 10]], 'recorded: 9 of 10 and 6 of 10')
  // counts: the integers win over the words; with no integers (null: invalid) the words are read
  const badgeOf = frame => (b => (b ? b.text : null))(lib.templateBadge(lib.parseTemplateMatchFrame(frame)))
  eq(badgeOf(derive('M1-s11', 14, p => { p.deck[0].reason = 'Covers 5 of 8 slides: a different story' })), 'Using your template Atlas Quarterly \u00b7 9 of 10 slides', 'DERIVED (the reason changed): the integers win: still "9 of 10 slides"')
  eq(badgeOf(derive('M1-s11', 14, p => { p.deck[0].covered = null; p.deck[0].total = null })), 'Using your template Atlas Quarterly \u00b7 9 of 10 slides', 'DERIVED (the integers null): the reason\'s words give "9 of 10 slides"')
  eq(badgeOf(derive('M1-s11', 14, p => { p.deck[0].covered = null; p.deck[0].total = null; p.deck[0].reason = 'a good fit' })), 'Using your template Atlas Quarterly', 'DERIVED (no integers, no words): no count')
  eq(badgeOf(derive('M1-s11', 14, p => { p.deck[0].covered = 12; p.deck[0].total = 10 })), 'Using your template Atlas Quarterly \u00b7 9 of 10 slides', 'DERIVED (covered above total, invalid): the words are read')
  eq(lib.pickerRows(lib.parseTemplateMatchFrame(derive('M3-s11', 16, p => { p.deck[1].reason = 'x'; p.deck[1].covered = 4; p.deck[1].total = 7 }))).map(row => row.coverage), ['9 of 10 slides', '4 of 7 slides', null], 'DERIVED: the picker row reads the integers too')
  // the slide-level badge counts the applied template\'s OWN matches (6), not the best across candidates (10)
  eq([frameOf('M3-s11', 16).payload.slides.filter(row => row.match).length, frameOf('M3-s11', 16).payload.slides.filter(row => row.applied_match).length], [10, 6], 'recorded: ten slides have a best match, six have Meridian\'s own')
  // rule 2 (applied_match) and rule 3 (deck[k].slides) agree on every recorded frame; each also stands alone (DERIVED by deleting the other\'s field)
  const chipsOf = frame => { const parsed = lib.parseTemplateMatchFrame(frame); return Array.from({ length: 10 }, (_, i) => (c => (c ? c.text : null))(lib.templateChips(parsed).get(i + 1))) }
  for (const item of directorFrames('M3-s11')) {
    const key = `M3-s11:${item.seq}`, want = EXPECT[key].chips
    eq(chipsOf(item.frame), want, `${key}: rule 2 (both fields present)`)
    eq(chipsOf(derive('M3-s11', item.seq, p => { for (const row of p.slides) delete row.applied_match })), want, `${key}: rule 3 alone (DERIVED: applied_match deleted) gives the same chips`)
    eq(chipsOf(derive('M3-s11', item.seq, p => { for (const entry of p.deck) delete entry.slides })), want, `${key}: rule 2 alone (DERIVED: deck[].slides deleted) gives the same chips`)
    eq(badgeOf(derive('M3-s11', item.seq, p => { for (const row of p.slides) delete row.applied_match })), EXPECT[key].badge, `${key}: the badge's count by rule 3 alone (DERIVED: applied_match deleted)`)
    eq(badgeOf(derive('M3-s11', item.seq, p => { for (const entry of p.deck) delete entry.slides })), EXPECT[key].badge, `${key}: the badge's count by rule 2 alone (DERIVED: deck[].slides deleted)`)
  }
  // neither field: the v0 rule (the first match\'s chips are another template\'s name after a switch)
  const bestPerSlide = ATLAS_CHIPS.map((chip, i) => (i === 4 ? 'Meridian Roadmap \u00b7 slide 5' : chip)) // the top-level rows: Atlas everywhere but slide 5, where only Meridian matched
  eq(chipsOf(derive('M3-s11', 16, p => { for (const row of p.slides) delete row.applied_match; for (const entry of p.deck) delete entry.slides })), bestPerSlide, 'DERIVED (both deleted): v0, Meridian\'s slide-level decision: the best-per-slide chips as given')
  eq(chipsOf(derive('M3-s11', 14, p => { for (const row of p.slides) delete row.applied_match; for (const entry of p.deck) delete entry.slides })), ATLAS_CHIPS.map((chip, i) => (i === 4 ? 'From Atlas Quarterly' : chip)), 'DERIVED (both deleted): v0 on Atlas\'s deck-level match: Atlas\'s own chips as given, and slide 5 (only Meridian matched it) reads "From Atlas Quarterly", never Meridian\'s chip')
  // built slides keep their recorded chip, whatever the applied template\'s own matches say (DERIVED: s1-s3 marked built on the switch to Meridian)
  const built = chipsOf(derive('M3-s11', 16, p => { p.built_slide_ids = ['s1', 's2', 's3'] }))
  eq(built.slice(0, 3), ['Atlas Quarterly \u00b7 slide 1', 'Atlas Quarterly \u00b7 slide 2', 'Atlas Quarterly \u00b7 slide 3'], 'DERIVED: built slides keep their recorded (Atlas) chips')
  eq(built.slice(3), MERIDIAN_OWN.slice(3), 'DERIVED: the slides not built yet take Meridian\'s own chips')
  eq(badgeOf(derive('M3-s11', 16, p => { p.built_slide_ids = ['s1', 's2', 's3'] })), 'Using Meridian Roadmap for the slides not built yet', 'DERIVED: with built slides, the badge names the template for the slides not built yet')
})

// ============================================================================================================================================
// B. The lib
// ============================================================================================================================================
const MOCK_COPY = { // the approved mock's words (streams/frontend2/w2/mock/index.html), word for word
  badgeChange: 'Change', badgeUndo: 'Undo', chipNew: 'New in your theme', groupTitle: 'Use with this deck',
  groupHelp: "Keeps your outline, words and theme; the slides take the template's layouts.", sheetHelp: 'Keeps your outline, words and theme. Built slides keep their template.',
  startHeading: 'Start a new presentation', switchNote: 'Applies to the slides not built yet; built slides keep their template. You can Undo.', cancel: 'Cancel', none: 'No template', noneWhy: 'Your theme only.',
  startFromTemplateInSheet: 'Start a new presentation from a template', checkLabel: 'Use my best-matching template',
  checkHelpOn: 'Director picks the template that fits your outline best. Untick to build with your theme only.', checkHelpOff: 'Off: no template is applied. Your theme only.', inUse: 'In use', yours: 'Yours', library: 'Library',
}

function libSuite(world) {
  const lib = world.lib
  // -- the flag, exact "true" -----------------------------------------------------------------------------------------------------------------
  for (const [label, env, want] of [['unset', {}, false], ['"false"', { [FLAG]: 'false' }, false], ['TRUE', { [FLAG]: 'TRUE' }, false], ['1', { [FLAG]: '1' }, false], ['empty', { [FLAG]: '' }, false], [' true', { [FLAG]: ' true' }, false], ['"true"', ON_ENV, true]]) {
    eq(makeWorld({ env }).lib.STUDIO_TEMPLATE_MATCH_ENABLED, want, `flag: ${label}`)
  }
  eq([lib.templateMatchFlagOn('true'), lib.templateMatchFlagOn(undefined), lib.templateMatchFlagOn('True')], [true, false, false], 'flag fn')
  // -- the words ------------------------------------------------------------------------------------------------------------------------------
  eq(lib.TEMPLATE_MATCH_WORDS, MOCK_COPY, 'the words are the mock\'s, word for word')
  const mock = path.join(WORKSPACE_OUT, '..', '..', 'frontend2', 'w2', 'mock', 'index.html')
  if (fs.existsSync(mock)) { const html = fs.readFileSync(mock, 'utf8'); for (const word of Object.values(MOCK_COPY)) ok(html.includes(word) || html.includes(word.replace(/'/g, '&#39;')), `the mock has: ${word.slice(0, 60)}`) }
  eq([lib.switchButtonLabel('Meridian Roadmap'), lib.switchButtonLabel(null)], ['Switch to Meridian Roadmap', 'Switch to no template'], 'the primary button')
  eq([lib.TEMPLATE_MATCH_CAP, lib.TEMPLATE_MATCH_VERSION], ['template_match1', 1], 'the cap and the version')
  // -- counts and positions -------------------------------------------------------------------------------------------------------------------
  eq(lib.coverageFromReason('Covers 7 of 8 slides: KPI grid, timeline, team'), { covered: 7, total: 8 }, 'coverage from the reason')
  eq(lib.coverageFromReason('Covers 1 of 1 slide'), { covered: 1, total: 1 }, 'one slide')
  for (const bad of [null, undefined, '', 'Covers many slides', 'Covers 9 of 8 slides', 'Covers 0 of 0 slides', 5]) eq(lib.coverageFromReason(bad), null, `no count from ${JSON.stringify(bad)}`)
  eq([lib.coverageText({ covered: 7, total: 8 }), lib.coverageText({ covered: 1, total: 1 }), lib.coverageText(null)], ['7 of 8 slides', '1 of 1 slide', null], 'coverage words')
  eq([lib.slidePosition('s3', 0), lib.slidePosition('s10', 0), lib.slidePosition('slide_abc', 4), lib.slidePosition('s0', 2), lib.slidePosition('s', 0)], [3, 10, 5, 3, 1], 'rail position: the plan position, else the place in the list')
  eq(lib.coverageOf({ covered: 5, total: 8, reason: 'Covers 2 of 3 slides' }), { covered: 5, total: 8 }, 'section 11: explicit integers win')
  eq(lib.coverageOf({ covered: null, total: null, reason: 'Covers 2 of 3 slides' }), { covered: 2, total: 3 }, '... else the words')
  eq(lib.coverageOf({ covered: null, total: null, reason: 'a template' }), null, '... else none')
  // -- the frame: parse and validate ----------------------------------------------------------------------------------------------------------
  const good = recorded('M3', 16), payload = good.payload
  ok(lib.parseTemplateMatchFrame(good) && lib.parseTemplateMatchFrame(payload), 'the envelope and its bare payload both parse')
  eq(lib.parseTemplateMatchFrame(good), lib.parseTemplateMatchFrame(payload), '... to the same frame')
  const parsed = lib.parseTemplateMatchFrame(good)
  eq([parsed.status, parsed.auto_apply, parsed.applied, parsed.reason, parsed.previous_template_id, parsed.built_slide_ids, parsed.deck.length, parsed.slides.length], ['matched', true, true, 'switch', 'tpl_fake_atlas', [], 2, 10], 'the parsed fields')
  for (const [label, edit] of [
    ['version 2', p => { p.version = 2 }], ['version "1"', p => { p.version = '1' }], ['no version', p => { delete p.version }], ['unknown status', p => { p.status = 'maybe' }],
    ['auto_apply not a boolean', p => { p.auto_apply = 'true' }], ['no applied', p => { delete p.applied }], ['applied false with a template', p => { p.applied = false }],
    ['applied template without a name', p => { delete p.applied_template.name }], ['applied template with an unknown decision', p => { p.applied_template.decision = 'both' }], ['applied template not an object', p => { p.applied_template = 'tpl' }],
  ]) eq(lib.parseTemplateMatchFrame(derive('M3', 16, edit)), null, `ignored: ${label}`)
  for (const bad of [null, undefined, 'template_match', 5, true, [], {}, { type: 'template_match' }, { type: 'template_match', payload: [] }, { type: 'chat_message', payload: payload }]) eq(lib.parseTemplateMatchFrame(bad), null, `ignored: ${JSON.stringify(bad)?.slice(0, 40)}`)
  eq(lib.isTemplateMatchMessage(good), true, 'a template_match message is recognised'); eq([lib.isTemplateMatchMessage({ type: 'slide_built' }), lib.isTemplateMatchMessage(null)], [false, false], '... nothing else is')
  const loud = lib.parseTemplateMatchFrame(derive('M3', 16, p => { p.zzz = 1; p.deck[0].zzz = 2; p.slides[0].zzz = 3; p.slides[0].match.zzz = 4 }))
  eq(viewFromFrame(loud, lib), EXPECT['M3:16'], 'unknown keys are ignored')
  eq(lib.parseTemplateMatchFrame(derive('M3', 16, p => { p.deck = [{ name: 'no id' }, 5, null, p.deck[1]] })).deck.map(item => item.name), ['Meridian Roadmap'], 'a bad candidate is dropped on its own, not the frame')
  eq(lib.parseTemplateMatchFrame(derive('M3', 16, p => { p.deck = [p.deck[0], p.deck[1], p.deck[0], p.deck[1], p.deck[0]] })).deck.length, 3, 'a frame is bounded: the top 3')
  eq(lib.parseTemplateMatchFrame(derive('M3', 16, p => { delete p.previous_template_id })).previous_template_id, undefined, 'no previous_template_id key: undefined')
  eq(lib.parseTemplateMatchFrame(derive('M3', 16, p => { p.previous_template_id = 7 })).previous_template_id, undefined, 'a previous_template_id that is not a string: undefined')
  eq(lib.parseTemplateMatchFrame(derive('M3', 16, p => { p.reason = 'library_update' })).reason, null, 'an unknown reason is read as none')
  eq(lib.templateBadge(lib.parseTemplateMatchFrame(derive('M3', 16, p => { p.reason = 'library_update' }))).undo, null, '... and offers no Undo; the badge stays')
  eq(lib.parseTemplateMatchFrame(derive('M3', 16, p => { p.built_slide_ids = 'all' })).built_slide_ids, [], 'built_slide_ids that is not a list: none')
  // -- Undo: only with a previous template (null counts) and a switch, chat switch or undo --------------------------------------------------------
  for (const [key, want] of [['M3:14', null], ['M3:16', { to: 'tpl_fake_atlas' }], ['M3:18', { to: 'tpl_fake_meridian' }], ['M3:21', { to: 'tpl_fake_atlas' }], ['M3:23', null], ['M3:25', { to: null }], ['M4:18', null], ['M5:77', { to: 'tpl_fake_atlas' }]]) {
    const [name, seq] = key.split(':'); eq(lib.undoFor(lib.parseTemplateMatchFrame(recorded(name, Number(seq)))), want, `Undo at ${key}`)
  }
  eq(recorded('M3', 23).payload.previous_template_id, 'tpl_fake_meridian', 'no_template carries a previous template, and still offers no Undo (the rule is the reason)')
  // -- the badge and the chips on a derived slide-level frame (one template, one slide) ------------------------------------------------------------
  const one = lib.parseTemplateMatchFrame(derive('M2', 13, p => { p.slides = p.slides.map(row => (row.slide_id === 's1' ? row : { slide_id: row.slide_id, match: null })) }))
  eq(lib.templateBadge(one).text, '1 slide uses your template', 'one slide uses your template (singular)')
  eq(lib.templateBadge(lib.parseTemplateMatchFrame(derive('M2', 13, p => { p.slides = p.slides.map(row => ({ slide_id: row.slide_id, match: null })) }))), null, 'a slide-level decision with no slide matched: no badge')
  eq(lib.templateBadge(lib.parseTemplateMatchFrame(derive('M3', 14, p => { p.deck[0].reason = 'a good fit'; p.deck[0].covered = null }))).text, 'Using your template Atlas Quarterly', 'no count in the reason and no integers: no count')
  eq(lib.templateBadge(lib.parseTemplateMatchFrame(derive('M3', 14, p => { p.built_slide_ids = ['s1', 's2'] }))).text, 'Using Atlas Quarterly for the slides not built yet', 'built slides present: the slides-not-built-yet line')
  // -- auto-apply off wins, even over a frame that still says "applied" (derived from a real frame by that one change) ------------------------------------
  const off = lib.parseTemplateMatchFrame(derive('M1', 14, p => { p.auto_apply = false }))
  eq([lib.templateBadge(off), lib.templateChips(off).size, lib.pickerRows(off)], [null, 0, []], 'auto-apply off: no badge, no chips, no group, whatever else the frame says')
  // -- no_match: nothing to show (M0 recorded no frame at all; a no_match frame is DERIVED from a real one: the status, and no candidates, no matches, nothing applied) -----------------------------------------------
  const none = lib.parseTemplateMatchFrame(derive('M1', 14, p => { p.status = 'no_match'; p.deck = []; p.slides = []; p.applied = false; p.applied_template = null }))
  eq([none && none.status, lib.templateBadge(none), lib.templateChips(none).size, lib.pickerRows(none)], ['no_match', null, 0, []], 'no_match: no badge, no chips, no group')
  const noneButApplied = lib.parseTemplateMatchFrame(derive('M1', 14, p => { p.status = 'no_match' }))
  eq([lib.templateBadge(noneButApplied), lib.templateChips(noneButApplied).size, lib.pickerRows(noneButApplied)], [null, 0, []], 'no_match wins even over a frame that still carries a template')
  // -- the wire builders --------------------------------------------------------------------------------------------------------------------------
  eq(lib.templateAutoApplyMessage(false, ['mdc1', 'template_match1', 'x']), { type: 'template_auto_apply', data: { enabled: false, client_caps: ['mdc1', 'x', 'template_match1'] } }, 'auto-apply message: `data`, the cap last and once')
  eq(lib.templateSwitchMessage('tpl_a', 'junk'), { type: 'template_switch', data: { template_id: 'tpl_a', client_caps: ['template_match1'] } }, 'switch message: caps that are not a list are dropped')
  eq([lib.templateSwitchMessage(null, []).data.template_id, lib.templateSwitchMessage('', []).data.template_id, lib.templateSwitchMessage(7, []).data.template_id], [null, null, null], 'switch: no template is null (never an empty or a non-string id)')
  eq(lib.templateAutoApplyMessage('yes', []).data.enabled, false, 'auto-apply: only a real true is true')
}
function viewFromFrame(frame, lib) { // the lib's own derivations of a parsed frame, as the store draws them
  return { reason: frame.reason, badge: (b => (b ? b.text : null))(lib.templateBadge(frame)), undo: (b => (b && b.undo ? b.undo : undefined))(lib.templateBadge(frame)),
    chips: Array.from({ length: 10 }, (_, i) => (c => (c ? c.text : null))(lib.templateChips(frame).get(i + 1))), rows: lib.pickerRows(frame).map(row => [row.name, row.owner, row.inUse, row.coverage]) }
}
check('B. the lib: the flag, the mock\'s words, counts, the frame (a malformed or unknown-version frame is ignored), Undo, the badge variants, the wire builders', () => libSuite(makeWorld()))

function preferenceSuite(world) {
  const lib = world.lib, KEY = 'studio.templateAutoApply.v1'
  eq(lib.TEMPLATE_AUTO_APPLY_STORAGE_KEY, KEY, 'the key')
  const s = fakeStorage()
  eq([lib.readAutoApplyPreference(s, 'u1'), lib.readAutoApplyPreference(null, 'u1'), lib.readAutoApplyPreference(undefined, null)], [true, true, true], 'default ON: nothing saved, no storage')
  ok(lib.writeAutoApplyPreference(s, 'u1', false), 'saved'); eq(lib.readAutoApplyPreference(s, 'u1'), false, 'u1 off')
  eq(lib.readAutoApplyPreference(s, 'u2'), true, 'per user: another user is still on')
  lib.writeAutoApplyPreference(s, 'u2', true); eq(JSON.parse(s.map.get(KEY)), { u1: false, u2: true }, 'one JSON object keyed by user; the others are kept')
  lib.writeAutoApplyPreference(s, 'u1', true); eq(lib.readAutoApplyPreference(s, 'u1'), true, 'u1 on again')
  eq([lib.writeAutoApplyPreference(s, null, false), lib.readAutoApplyPreference(s, ''), lib.readAutoApplyPreference(s, 7)], [true, false, false], 'no user id is one anonymous visitor ("_")')
  for (const bad of ['not json', '[]', '"yes"', '5', 'null', '{"u1":"no"}', '{"u1":0}', '']) eq(lib.readAutoApplyPreference(fakeStorage({ [KEY]: bad }), 'u1'), true, `unreadable ${JSON.stringify(bad)} reads ON`)
  const throwingGet = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
  eq([lib.readAutoApplyPreference(throwingGet, 'u1'), lib.writeAutoApplyPreference(throwingGet, 'u1', false)], [true, false], 'a throwing localStorage: reads ON, a write reports it did not save, nothing throws')
  const full = { getItem: () => null, setItem() { throw new Error('QuotaExceededError') } }
  eq(lib.writeAutoApplyPreference(full, 'u1', false), false, 'a full disk: not saved, no throw')
  lib.writeAutoApplyPreference(fakeStorage(), '__proto__', false); ok(({}).polluted === undefined && Object.getPrototypeOf({}) === Object.prototype, 'a user called __proto__ pollutes nothing')
}
check('B. the preference: default ON, per user on this device, every access guarded (a throwing localStorage never throws)', () => preferenceSuite(makeWorld()))

function hookStorageSuite(overrides) {
  // through the real hook: a blocked window.localStorage, a throwing getItem, a throwing setItem
  const cases = [
    ['window.localStorage itself throws', () => makeWorld({ brokenWindow: true, overrides })],
    ['getItem and setItem throw', () => makeWorld({ storage: { getItem() { throw new Error('x') }, setItem() { throw new Error('y') } }, overrides })],
  ]
  for (const [label, make] of cases) {
    const world = make(), { hook } = world, sent = []
    hook.studioTemplateMatchStore.reset()
    ok(hook.templateMatchSocketOpened({ sessionId: SESSION, userId: 'u_test', socket: { send: m => { sent.push(m); return true }, caps: () => ENVELOPE_CAPS } }), `${label}: the connect message goes out`)
    eq(sent[0], recorded('M1', 7), `${label}: ON by default, the recorded connect envelope`)
    ok(hook.setTemplateAutoApply(false), `${label}: a toggle still sends`); eq(sent[1], recorded('M4', 17), `${label}: the recorded "off" envelope`)
    eq(hook.studioTemplateMatchStore.getSnapshot().autoApply, false, `${label}: the check follows the toggle in memory`)
  }
}
check('B. through the real hook: a blocked or throwing localStorage still connects ON and still toggles (in memory)', () => hookStorageSuite({}))

check('B. flag off: the hook sends nothing, stores nothing and takes no frame', () => {
  const storage = fakeStorage(), world = makeWorld({ env: {}, storage }), { hook } = world, sent = []
  hook.studioTemplateMatchStore.reset()
  eq(hook.templateMatchSocketOpened({ sessionId: SESSION, userId: 'u_test', socket: { send: m => { sent.push(m); return true }, caps: () => ENVELOPE_CAPS } }), false, 'no connect message')
  eq([hook.templateMatchFrameReceived(directorFrames('M1')[0].frame, SESSION), hook.setTemplateAutoApply(false), hook.switchTemplate('tpl_fake_atlas')], [false, false, false], 'no frame taken, no toggle, no switch')
  hook.requestTemplatePicker(); hook.setTemplateSheetOpen(true)
  eq(sent, [], 'nothing sent'); eq(storage.map.size, 0, 'nothing stored'); eq(hook.studioTemplateMatchStore.getSnapshot().frame, null, 'no frame'); eq([hook.studioTemplateMatchStore.getSnapshot().pickerRequest, hook.studioTemplateMatchStore.getSnapshot().sheetOpen], [0, false], 'no request, no sheet')
  eq(world.lib.STUDIO_TEMPLATE_MATCH_ENABLED, false, 'the flag is off')
})

// ============================================================================================================================================
// C. The components, in the offline React host, with the real CSS
// ============================================================================================================================================
function open(world, name, seq, { user = 'u_test' } = {}) {
  const { hook } = world, sent = []
  hook.studioTemplateMatchStore.reset()
  hook.templateMatchSocketOpened({ sessionId: SESSION, userId: user, socket: { send: m => { sent.push(m); return true }, caps: () => ENVELOPE_CAPS } })
  sent.length = 0
  if (name) hook.templateMatchFrameReceived(directorFrames(name).find(item => item.seq === seq).frame, SESSION)
  return sent
}
function badgeSuite(overrides) {
  let world = makeWorld({ overrides }), sent = open(world, 'M1', 14)
  let badge = mount(world, BADGE, 'StudioTemplateMatchBadge')
  eq(badge.byAttr('data-studio-template-match', 'badge').length, 1, 'the badge is drawn')
  eq(badge.byAttr('data-studio-template-match', 'badge-text')[0].children.map(textOf).join(''), EXPECT['M1:14'].badge, 'its line: deck, "n of m slides"')
  eq(badge.hosts().filter(n => n.type === 'button').map(n => textOf(n)), ['Change'], 'Change only (no Undo before a switch); the visible word is "Change"')
  ok(badge.byAttr('role', 'status').length === 1 && badge.byAttr('data-kind', 'deck').length === 1, 'a polite status line of the deck kind')
  badge.click(badge.byAttr('data-studio-template-match-action', 'change')[0])
  eq([world.hook.studioTemplateMatchStore.getSnapshot().pickerRequest, world.hook.studioTemplateMatchStore.getSnapshot().sheetOpen], [1, false], 'Change on a desktop asks the Template picker to open')
  eq(sent, [], 'Change sends nothing')
  // after a switch: Undo, and it sends the recorded switch back
  world = makeWorld({ overrides }); sent = open(world, 'M3', 16); badge = mount(world, BADGE, 'StudioTemplateMatchBadge')
  eq(badge.hosts().filter(n => n.type === 'button').map(n => textOf(n)), ['Change', 'Undo'], 'after a switch: Change and Undo')
  badge.click(badge.byAttr('data-studio-template-match-action', 'undo')[0])
  eq(sent, [recorded('M3', 17)], 'Undo sends the recorded template_switch back to the previous template')
  // Undo to null
  world = makeWorld({ overrides }); sent = open(world, 'M3', 25); badge = mount(world, BADGE, 'StudioTemplateMatchBadge')
  badge.click(badge.byAttr('data-studio-template-match-action', 'undo')[0]); eq(sent, [recorded('M3', 22)], 'Undo to null sends the recorded template_switch with template_id null')
  // a chat switch with everything built
  world = makeWorld({ overrides }); open(world, 'M5', 77); badge = mount(world, BADGE, 'StudioTemplateMatchBadge')
  eq(badge.byAttr('data-studio-template-match', 'badge-text')[0].children.map(textOf).join(''), EXPECT['M5:77'].badge, 'built slides present: "Using <name> for the slides not built yet"')
  eq(badge.byAttr('data-kind', 'built').length, 1, '... the built kind')
  // slide-level
  world = makeWorld({ overrides }); open(world, 'M2', 13); badge = mount(world, BADGE, 'StudioTemplateMatchBadge')
  eq(badge.byAttr('data-studio-template-match', 'badge-text')[0].children.map(textOf).join(''), '5 slides use your templates', 'slide-level: "n slides use your templates"')
  // phone: the shell flag AND the phone width open the sheet; either alone opens the picker
  for (const [shell, phone, wantSheet] of [[true, true, true], [true, false, false], [false, true, false], [false, false, false]]) {
    world = makeWorld({ overrides, phoneShell: shell, phone }); open(world, 'M1', 14); badge = mount(world, BADGE, 'StudioTemplateMatchBadge')
    badge.click(badge.byAttr('data-studio-template-match-action', 'change')[0])
    const snap = world.hook.studioTemplateMatchStore.getSnapshot()
    eq([snap.sheetOpen, snap.pickerRequest], wantSheet ? [true, 0] : [false, 1], `Change: phone shell ${shell}, phone width ${phone}`)
  }
  // nothing to say, or the stage is closed
  for (const [label, name, seq] of [['no frame', null, 0], ['auto-apply off', 'M4', 14], ['auto-apply turned off', 'M4', 18], ['no template applied', 'M3', 23]]) {
    world = makeWorld({ overrides }); open(world, name, seq); badge = mount(world, BADGE, 'StudioTemplateMatchBadge'); eq(badge.html(), '', `no badge: ${label}`)
  }
  world = makeWorld({ overrides, gateOpen: false }); open(world, 'M1', 14); badge = mount(world, BADGE, 'StudioTemplateMatchBadge'); eq(badge.html(), '', 'no badge while the stage-open gate holds the stage closed')
  world.state.gateOpen = true; badge.refresh(); ok(badge.html().includes('Using your template Atlas Quarterly'), '... and it appears when the stage opens')
  // the sheet is the badge's: a closed one draws nothing, a request draws it
  world = makeWorld({ overrides, phoneShell: true, phone: true }); open(world, 'M1', 14); badge = mount(world, BADGE, 'StudioTemplateMatchBadge')
  eq(badge.byAttr('data-studio-template-match', 'sheet').length, 0, 'the sheet is closed until Change'); badge.click(badge.byAttr('data-studio-template-match-action', 'change')[0])
  eq(badge.byAttr('data-studio-template-match', 'sheet').length, 1, 'Change on a phone opens the sheet from the badge component (no page line)')
}
function chipSuite(overrides) {
  const world = makeWorld({ overrides })
  for (const key of Object.keys(EXPECT)) {
    const [name, seq] = key.split(':'); open(world, name, Number(seq))
    const texts = []
    for (let n = 1; n <= 10; n++) { const chip = mount(world, CHIP, 'StudioTemplateMatchChip', { slideNumber: n }); const node = chip.byAttr('data-studio-template-match', 'chip')[0]; texts.push(node ? textOf(node) : null) }
    eq(texts, EXPECT[key].chips, `chips at ${key}`)
    eq(mount(world, CHIP, 'StudioTemplateMatchChip', { slideNumber: 11 }).html(), '', `${key}: no chip for a slide the plan does not have`)
  }
  open(world, 'M3', 16); const node = mount(world, CHIP, 'StudioTemplateMatchChip', { slideNumber: 5 }).byAttr('data-studio-template-match', 'chip')[0]
  eq([attr(node, 'data-tone'), attr(node, 'title')], ['template', 'From Meridian Roadmap'], 'a template chip is toned "template" and carries its text as the tooltip')
  open(world, 'M1', 14); eq(attr(mount(world, CHIP, 'StudioTemplateMatchChip', { slideNumber: 5 }).byAttr('data-studio-template-match', 'chip')[0], 'data-tone'), 'theme', '"New in your theme" is toned "theme"')
  const closed = makeWorld({ overrides, gateOpen: false }); open(closed, 'M1', 14); eq(mount(closed, CHIP, 'StudioTemplateMatchChip', { slideNumber: 1 }).html(), '', 'no chip while the stage-open gate holds the stage closed')
}
function groupSuite(overrides) {
  let world = makeWorld({ overrides }), sent = open(world, 'M1', 14), done = 0
  let group = mount(world, GROUP, 'StudioTemplateMatchGroup', { onDone: () => { done++ } })
  const html = group.html()
  ok(html.includes('Use with this deck') && html.includes(MOCK_COPY.groupHelp.replace("'", '&#x27;')), 'the title and the help line')
  eq(group.byAttr('data-studio-template-match', 'row').map(n => textOf(n)), ['Atlas QuarterlyYoursIn useCovers 9 of 10 slides: title, KPI grid, timeline, closing9 of 10 slides', 'Meridian RoadmapYoursCovers 6 of 10 slides6 of 10 slides', 'No templateYour theme only.'], 'the rows: name, Yours, In use, the reason word for word, "n of m slides"; no score')
  ok(!/\bFit\b|score|%|0\.\d\d/.test(textOf(group.hosts()[0]) + html), 'no score and no Fit %')
  eq(group.byAttr('aria-checked', true).map(n => attr(n, 'data-studio-template-match-option')), ['tpl_fake_meridian'], 'the first row that is not in use is picked')
  const primary = () => group.byAttr('data-primary', 'true')[0]
  eq([textOf(primary()), primary().props.disabled], ['Switch to Meridian Roadmap', false], 'the primary button')
  eq(group.byAttr('data-studio-template-match', 'note').map(n => textOf(n)), [MOCK_COPY.switchNote], 'the note under the buttons')
  group.click(group.byAttr('data-studio-template-match-option', 'tpl_fake_atlas')[0]); eq([textOf(primary()), primary().props.disabled], ['Switch to Atlas Quarterly', true], 'the template in use cannot be switched to')
  group.click(group.byAttr('data-studio-template-match-option', 'none')[0]); eq(textOf(primary()), 'Switch to no template', 'the no-template row')
  group.click(primary()); eq(sent, [recorded('M3', 22)], 'Switch to no template sends the recorded template_switch with template_id null'); eq(done, 1, '... and closes')
  sent.length = 0; group.click(group.byAttr('data-studio-template-match-option', 'tpl_fake_meridian')[0]); group.click(primary())
  eq(sent, [recorded('M3', 15)], 'Switch to Meridian Roadmap sends the recorded template_switch'); eq(done, 2, '... and closes')
  group.click(group.hosts().filter(n => n.type === 'button' && textOf(n) === 'Cancel')[0]); eq([done, sent.length], [3, 1], 'Cancel closes and sends nothing')
  // nothing in use: the first candidate is picked
  world = makeWorld({ overrides }); open(world, 'M3', 23); group = mount(world, GROUP, 'StudioTemplateMatchGroup', { onDone() {} })
  eq([textOf(group.byAttr('data-primary', 'true')[0]), group.byAttr('data-kind', 'use').length], ['Switch to Atlas Quarterly', 1], 'no template applied: "No template" is the one in use, and Atlas is the pick')
  // auto-apply off, no frame, no match: no group
  for (const [label, name, seq] of [['auto-apply off', 'M4', 14], ['auto-apply turned off', 'M4', 18], ['no frame', null, 0]]) { world = makeWorld({ overrides }); open(world, name, seq); eq(mount(world, GROUP, 'StudioTemplateMatchGroup', { onDone() {} }).html(), '', `no group: ${label}`) }
  // the rows move with the latest frame (a switch elsewhere), and the user's pick survives while it is still a row
  world = makeWorld({ overrides }); open(world, 'M3', 14); group = mount(world, GROUP, 'StudioTemplateMatchGroup', { onDone() {} })
  group.click(group.byAttr('data-studio-template-match-option', 'none')[0])
  world.hook.templateMatchFrameReceived(directorFrames('M3').find(item => item.seq === 16).frame, SESSION); group.refresh()
  eq([group.byAttr('data-kind', 'use').map(n => textOf(n)).length, textOf(group.byAttr('data-primary', 'true')[0])], [1, 'Switch to no template'], 'a new frame re-marks the one in use, the user\'s pick stays')
  eq(world.hook.studioTemplateMatchStore.getSnapshot().rows.find(row => row.inUse).name, 'Meridian Roadmap', '... Meridian is now in use')
}
function sheetSuite(overrides) {
  for (const templatesPage of [false, true]) {
    const world = makeWorld({ overrides, env: { ...ON_ENV, ...(templatesPage ? { NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED: 'true' } : {}) }, phoneShell: true, phone: true })
    const sent = open(world, 'M1', 14)
    let sheet = mount(world, SHEET, 'StudioTemplateMatchSheet'); eq(sheet.html(), '', 'closed: nothing')
    world.hook.setTemplateSheetOpen(true); sheet.refresh()
    const content = sheet.byAttr('data-studio-template-match', 'sheet')[0]
    ok(content && content.props['data-studio-v4-shell'] === 'true', 'the sheet carries the Studio tokens (its own marker, like the More sheet)')
    const text = sheet.text()
    ok(text.includes('Use with this deck') && text.includes(MOCK_COPY.sheetHelp), 'title and the sheet\'s help line')
    ok(!text.includes('Cancel') && !text.includes(MOCK_COPY.switchNote), 'no Cancel and no note in the sheet')
    eq(textOf(sheet.byAttr('data-primary', 'true')[0]), 'Switch to Meridian Roadmap', 'the full-width primary')
    const alt = sheet.byAttr('data-studio-template-match', 'alt')
    eq(alt.length, templatesPage ? 1 : 0, `the "start a new presentation" link only where the Templates page works (${templatesPage})`)
    if (templatesPage) eq([alt[0].props.href, textOf(alt[0])], ['/studio/templates', MOCK_COPY.startFromTemplateInSheet], 'it goes to the Templates page, in the mock\'s words')
    sheet.click(sheet.byAttr('data-primary', 'true')[0]); eq(sent, [recorded('M3', 15)], 'it sends the recorded switch'); eq(world.hook.studioTemplateMatchStore.getSnapshot().sheetOpen, false, '... and closes the sheet')
  }
  const world = makeWorld({ overrides, phoneShell: true, phone: true }); open(world, 'M4', 14); world.hook.setTemplateSheetOpen(true)
  eq(mount(world, SHEET, 'StudioTemplateMatchSheet').html(), '', 'open but nothing to choose from (auto-apply off): nothing')
}
function checkSuite(overrides) {
  const storage = fakeStorage(), world = makeWorld({ overrides, storage }), sent = open(world, null, 0)
  const check_ = mount(world, CHECK, 'StudioTemplateAutoApplyCheck')
  const box = () => check_.hosts().filter(n => n.type === 'input')[0]
  eq([attr(box(), 'type'), attr(box(), 'checked')], ['checkbox', true], 'a real checkbox, ticked by default')
  eq(check_.hosts().filter(n => n.type === 'label').map(n => textOf(n)), [`${MOCK_COPY.checkLabel}${MOCK_COPY.checkHelpOn}`], 'the label and the help line when ticked')
  eq(attr(check_.hosts().filter(n => n.type === 'label')[0], 'htmlFor'), attr(box(), 'id'), 'the label is the checkbox\'s')
  box().props.onChange({ target: { checked: false } }); check_.refresh()
  eq([attr(box(), 'checked'), check_.hosts().filter(n => n.type === 'label').map(n => textOf(n))], [false, [`${MOCK_COPY.checkLabel}${MOCK_COPY.checkHelpOff}`]], 'unticked: the help line says no template is applied')
  eq(sent, [recorded('M4', 17)], 'unticking sends the recorded "off" envelope'); eq(JSON.parse(storage.map.get('studio.templateAutoApply.v1')), { u_test: false }, 'and saves it for this user on this device')
  box().props.onChange({ target: { checked: true } }); check_.refresh()
  eq(sent, [recorded('M4', 17), recorded('M4', 15)], 'ticking again sends the recorded "on" envelope'); eq(JSON.parse(storage.map.get('studio.templateAutoApply.v1')), { u_test: true }, '... and saves it')
  // the next visit starts from the saved choice, and sends it at connect
  const storage2 = fakeStorage({ 'studio.templateAutoApply.v1': JSON.stringify({ u_test: false }) }), world2 = makeWorld({ overrides, storage: storage2 })
  const connectSent = []; world2.hook.studioTemplateMatchStore.reset()
  world2.hook.templateMatchSocketOpened({ sessionId: SESSION, userId: 'u_test', socket: { send: m => { connectSent.push(m); return true }, caps: () => ENVELOPE_CAPS } })
  eq(connectSent, [recorded('M4', 7)], 'a saved "off" is what the next connect sends (the recorded M4 connect step)')
  eq(attr(mount(world2, CHECK, 'StudioTemplateAutoApplyCheck').hosts().filter(n => n.type === 'input')[0], 'checked'), false, '... and the check starts unticked')
}
function cssSuite(css) {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(chunk => chunk.trim()).filter(Boolean)
  const selectors = rules.flatMap(rule => { const at = rule.lastIndexOf('{'); const head = rule.slice(0, at).trim(); return head.startsWith('@') ? [] : head.split(',').map(s => s.trim()) })
  ok(selectors.length > 40, 'the stylesheet has its rules')
  for (const selector of selectors) ok(selector.includes('[data-studio-template-match'), `every rule is keyed to the marker: ${selector.slice(0, 90)}`)
  ok(css.includes('@media (max-width: 640px)'), 'the phone rule: the badge is one line the whole width')
  ok(/\[data-studio-template-match="chip"\][^{]*\{[^}]*position: absolute; left: 4px; bottom: 4px/.test(css), 'the chip is bottom-left inside the thumbnail')
  ok(!/!important/.test(css), 'no !important')
  ok(/var\(--ss-teal/.test(css) && /var\(--ss-line\)/.test(css) && /var\(--ss-panel\)/.test(css), 'the shell\'s own tokens')
}
const COMPONENT_SUITES = [['badge', badgeSuite], ['chip', chipSuite], ['group', groupSuite], ['sheet', sheetSuite], ['check', checkSuite]]
for (const [name, suite] of COMPONENT_SUITES) check(`C. ${name}: the real component in the offline host, driven by the recorded frames`, () => suite({}))
check('C. the stylesheet: every rule is keyed to the marker (so flag off, nothing can match), the shell\'s tokens, the phone rule, the chip bottom-left', () => cssSuite(src(CSS)))

// ============================================================================================================================================
// D. The wire: the capability, the base caps, the socket hook's marked lines
// ============================================================================================================================================
const ALL_CAP_FLAGS = { NEXT_PUBLIC_CHAT_DIRECTIVES: 'true', NEXT_PUBLIC_CHAT_THEME_CHANGE: 'true', NEXT_PUBLIC_CHAT_EXPORT: 'true', NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true', NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT: 'true',
  NEXT_PUBLIC_STUDIO_BULK_EDIT: 'true', NEXT_PUBLIC_STUDIO_CHAT_COMMANDS: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const lines = text => text.split('\n')
const MARK = strip.STUDIO_TEMPLATE_MATCH_MARKER_RE
function wsHookChecks(hookText) {
  hookText = registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(strip.stripStudioTemplateMatch) + 1).reduce((out, later) => { const next = typeof later === 'function' ? later(WS_HOOK, out) : out; return typeof next === 'string' ? next : out }, hookText) // LATER-CHANGES: registry read (PROOFS-AFTER-MERGE), #564 robust after merge: the socket hook is read past the strips of the changes registered after this one, so a later change's own line in the cap chain (the voice call's) is that change's business
  const rows = lines(hookText), marked = rows.filter(row => MARK.test(row))
  eq(marked.length, 6, 'the socket hook: six marked lines (three imports, the cap, the connect send, the frame)')
  const only = needle => { const hit = rows.filter(row => row.includes(needle)); ok(hit.length === 1, `exactly one line with: ${needle.slice(0, 80)} (${hit.length})`); return hit[0] }
  const index = row => rows.indexOf(row)
  // the cap: added to the BUILT message (outside buildUserMessage, so the extracted constructor older proofs run needs no new name), after every other cap, gated by the flag
  const capLine = only('addTemplateMatchCap(message.data as unknown as Record<string, unknown>)')
  ok(capLine.trim().startsWith('if (STUDIO_TEMPLATE_MATCH_ENABLED) addTemplateMatchCap(') && MARK.test(capLine), 'cap: only with the flag on')
  const builtAt = index(only('const message = buildUserMessage();')), buildStart = index(only('const buildUserMessage = (): UserMessage => {'))
  eq(index(capLine), builtAt + 1, 'cap: the line right after the message is built, before anything reads it')
  const returnAt = rows.indexOf('      return message;', buildStart)
  ok(buildStart < returnAt && returnAt < builtAt && !rows.slice(buildStart, returnAt).some(row => row.includes('TemplateMatch') || row.includes('TEMPLATE_MATCH')), 'cap: nothing of this change inside buildUserMessage')
  // the same chain as the wire module's, in the same order (the connect-time message advertises what a user_message does)
  const chain = text => [...text.matchAll(/\badd(?!TemplateMatchCap)[A-Z]\w+(?=\()/g)].map(match => match[0])
  const hookChain = chain(rows.slice(index(only('if (CHAT_ELEMENT_REFINE_ENABLED) addChatElementRefineFields(')), returnAt).join('\n'))
  const wireText = src(WIRE), wireChain = chain(wireText.slice(wireText.indexOf('export function templateMatchBaseCaps'))).filter(name => !/^add(Template)/.test(name))
  eq(hookChain, ['addChatElementRefineFields', 'addChatElementEditCaps', 'addBulkEditUndoCaps', 'addChatCommandsFields', 'addChatParityCaps'], 'the hook\'s cap chain, in order')
  eq(wireChain, hookChain, 'the wire module builds the base caps with the same helpers in the same order')
  // the connect send: in ws.onopen right after the heartbeat starts, before any message can be sent on the socket
  const openAt = index(only('ws.onopen = () => {')), msgAt = index(only('ws.onmessage = (event) => {'))
  const beat = rows.indexOf('          startHeartbeat(ws);'), connect = only('templateMatchSocketOpened({')
  ok(openAt < beat && beat < msgAt, 'connect: startHeartbeat is inside onopen')
  eq(index(connect), beat + 1, 'connect: the send is the line right after startHeartbeat(ws)')
  for (const piece of ['if (STUDIO_TEMPLATE_MATCH_ENABLED) templateMatchSocketOpened({', 'sessionId: socketSessionId', 'userId: userIdRef.current || null', 'wsRef.current !== ws || ws.readyState !== WebSocket.OPEN', 'ws.send(JSON.stringify(message))', 'caps: templateMatchBaseCaps']) ok(connect.includes(piece), `connect: ${piece}`)
  // the frame: ahead of the allowlist, a state tick (no clearAwaitReply), only for this socket's session
  const frame = only('isTemplateMatchMessage(parsedMessage)')
  ok(index(frame) > msgAt && index(frame) > index(only('const parsedMessage = normalizeDirectorMessageFrame(rawMessage)')) && index(frame) < index(only("if (parsedMessage.type === 'deck_mutation') {")), 'frame: handled after the frame is normalised and before the deck_mutation handling and the allowlist')
  ok(frame.trim().startsWith('if (STUDIO_TEMPLATE_MATCH_ENABLED && isTemplateMatchMessage(parsedMessage))') && frame.includes('parsedMessage.session_id === socketSessionId') && frame.includes('templateMatchFrameReceived(parsedMessage, socketSessionId)') && /return \}/.test(frame), 'frame: gated, this socket\'s session only, then returns')
  ok(!frame.includes('clearAwaitReply'), 'frame: it does not unlock the turn (a state tick)')
  ok(index(frame) > index(only('if (CHAT_ELEMENT_EDIT_ENABLED && routeElementEditFrame(parsedMessage,')), 'frame: after the element-edit routing (the same family)')
  for (const row of rows.filter(r => /^import /.test(r) && MARK.test(r))) ok(row.includes("from '@/lib/studio-template-match") || row.includes("from '@/hooks/use-studio-template-match"), 'imports: only this change\'s modules')
}
function wireSuite() {
  const flagsOn = makeLoader({ env: { ...ALL_CAP_FLAGS, ...ON_ENV } }), flagsOff = makeLoader({ env: { ...ALL_CAP_FLAGS } })
  const on = flagsOn.load(WIRE), onLib = flagsOn.load(LIB), offLib = flagsOff.load(LIB), offWire = flagsOff.load(WIRE)
  eq(on.templateMatchBaseCaps(), ENVELOPE_CAPS, 'the base caps are Studio\'s list exactly as the recordings carry it (mdc1, theme1, export1, element_refine1, element_edit1, notes1, bulk_edit1, mentions2, commands1)')
  eq(on.addTemplateMatchCap({ client_caps: [...ENVELOPE_CAPS] }).client_caps, SC.M1.client_caps, 'with the cap added, the list is the recorded one: template_match1 last')
  eq(on.addTemplateMatchCap({ client_caps: ['a', 'template_match1', 'b'] }).client_caps, ['a', 'b', 'template_match1'], 'once, and last')
  eq([on.addTemplateMatchCap({}).client_caps, on.addTemplateMatchCap({ client_caps: 'x' }).client_caps], [['template_match1'], ['template_match1']], 'a client with no other caps')
  // the hook's gated line, as it reads: the cap is on the wire only with the flag on
  const advertised = (lib, wire) => { const data = { client_caps: wire.templateMatchBaseCaps() }; if (lib.STUDIO_TEMPLATE_MATCH_ENABLED) wire.addTemplateMatchCap(data); return data.client_caps }
  ok(advertised(onLib, on).includes('template_match1') && advertised(onLib, on).at(-1) === 'template_match1', 'flag on: advertised, last')
  eq(advertised(offLib, offWire), ENVELOPE_CAPS, 'flag off: the list is exactly the base list; the cap is not advertised')
  for (const value of ['false', 'TRUE', '1', '', ' true']) ok(!makeLoader({ env: { ...ALL_CAP_FLAGS, [FLAG]: value } }).load(LIB).STUDIO_TEMPLATE_MATCH_ENABLED, `flag ${JSON.stringify(value)}: not on`)
  eq(offWire.templateMatchBaseCaps(), ENVELOPE_CAPS, 'the base caps do not depend on this flag')
  wsHookChecks(src(WS_HOOK))
}
check('D. the capability: Studio\'s recorded list, template_match1 last and only with the flag on; the socket hook\'s marked lines (connect send, frame, cap)', () => wireSuite())

// ============================================================================================================================================
// E. The marked lines, the strip, .env.example, the registry, the scope over the committed diff
// ============================================================================================================================================
const gitText = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 })
const git = (...a) => gitText(...a)
const BASE_COMMIT = strip.BASE_COMMIT
const baseOk = (() => { try { git('cat-file', '-e', `${BASE_COMMIT}^{commit}`); return true } catch { return false } })()
const SUBJECT = strip.STUDIO_TEMPLATE_MATCH_SUBJECT
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = c => git('rev-list', '--parents', '-n', '1', c).trim().split(/\s+/).slice(1)
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT))
/** GATE-SAFE head: on the gate's merge (first parent dev, second parent this change's head) the scope runs against HEAD^2; a branch head is used as it is. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-02T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-02T00:00:00Z' }
const plumb = (args, extra = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const applyAll = (fns, rel, text) => fns.reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(fn => fn !== strip.stripStudioTemplateMatch), rel, text)
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(strip.stripStudioTemplateMatch); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const HEAD = baseOk ? scopeHead('HEAD') : null
const HAS_OWN = baseOk && ownOf(HEAD).length > 0
const headText = (rel, head = HEAD) => (HAS_OWN ? git('show', `${head}:${rel}`) : read(rel)) // this change's files at its own head (the working tree until the first commit exists)
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)

/** The marked lines of the five existing files, at their places and gated. `sources` maps rel -> text (other changes' lines out). */
function markedSuite(sources, rawHook = sources[WS_HOOK]) {
  const need = rel => sources[rel]
  const only = (text, needle) => { const hit = lines(text).filter(row => row.includes(needle)); ok(hit.length === 1, `exactly one line with: ${needle.slice(0, 80)} (${hit.length})`); return hit[0] }
  const at = (text, row) => lines(text).indexOf(row)
  // presentation-area: the badge is a sibling ABOVE the viewer, drawn with a deck on the stage and not in template mode
  const area = need(AREA), badge = only(area, '<StudioTemplateMatchBadge />')
  eq(lines(area).filter(row => MARK.test(row)).length, 3, 'presentation-area: three marked lines')
  eq(lines(area)[at(area, badge) - 1], '      <div className="flex-1 flex flex-col min-w-0 min-h-0">', 'presentation-area: the first child of the column')
  eq(lines(area)[at(area, badge) + 1], '        {presentationUrl && mountNative ? (', 'presentation-area: right above the viewer')
  ok(badge.trim().startsWith('{STUDIO_TEMPLATE_MATCH_ENABLED && presentationUrl && mountNative && !templateModeOn && <StudioTemplateMatchBadge />}'), 'presentation-area: only with the flag, a deck on the stage and not in template mode')
  // the thumbnail strip: the chip inside the preview, after the refining overlay, never in the title row
  const stripText = need(STRIP), chip = only(stripText, '<StudioTemplateMatchChip slideNumber={visualNumber} />')
  eq(lines(stripText).filter(row => MARK.test(row)).length, 3, 'strip: three marked lines')
  ok(chip.trim().startsWith('{STUDIO_TEMPLATE_MATCH_ENABLED && <StudioTemplateMatchChip slideNumber={visualNumber} />}'), 'strip: gated by the flag, keyed by the rail position')
  ok(at(stripText, chip) > at(stripText, only(stripText, 'data-studio-thumbnail-preview={STUDIO_THUMBNAILS}')) && at(stripText, chip) < at(stripText, only(stripText, 'Title row below the preview')), 'strip: inside the preview, above the title row')
  ok(lines(stripText)[at(stripText, chip) + 1].includes('Canvas v2 P4: no number badge'), 'strip: right before the preview\'s closing comment')
  // the Template picker
  const picker = need(PICKER), group = only(picker, '<StudioTemplateMatchGroup onDone={() => setOpen(false)} />')
  eq(lines(picker).filter(row => MARK.test(row)).length, 7, 'picker: seven marked lines (three imports, two hooks, the group, the heading)')
  eq(lines(picker)[at(picker, group) - 1], '        <div className="stw-picker-main">', 'picker: the group is the first thing in the main column')
  ok(group.trim().startsWith('{STUDIO_TEMPLATE_MATCH_ENABLED && <StudioTemplateMatchGroup'), 'picker: gated by the flag')
  const heading = only(picker, 'studioTemplateGroupShown ?')
  ok(heading.includes("<h3>{studioTemplateGroupShown ? 'Start a new presentation ' : 'Start from a template '}<span>{listedCount}</span></h3>"), 'picker: the heading is one string expression (one text node, as today\'s)')
  eq(lines(picker).filter(row => row.includes('<p>Creates a new presentation.</p>') && !MARK.test(row)).length, 1, 'picker: today\'s "Creates a new presentation." line is untouched')
  const requestAt = at(picker, only(picker, 'useStudioTemplatePickerRequest(() => setOpen(true))')), shownAt = at(picker, only(picker, 'const studioTemplateGroupShown = ')), composerAt = at(picker, only(picker, 'const composerList = useComposerTemplates('))
  const returnAt = lines(picker).indexOf('  return (', composerAt)
  ok(composerAt < requestAt && requestAt < shownAt && shownAt < returnAt && !/^\s*(if|for|\{)/.test(lines(picker)[requestAt]) && !/^\s*(if|for)/.test(lines(picker)[shownAt]), 'picker: the hooks are called unconditionally, in the body, before the return')
  // the composer's pop-up
  const composer = need(COMPOSER_PICKER), check_ = only(composer, '<StudioTemplateAutoApplyCheck />')
  eq(lines(composer).filter(row => MARK.test(row)).length, 3, 'composer pop-up: three marked lines')
  ok(check_.trim().startsWith('{STUDIO_TEMPLATE_MATCH_ENABLED && <StudioTemplateAutoApplyCheck />}'), 'composer pop-up: gated by the flag')
  eq(lines(composer)[at(composer, check_) - 1], '      </div>', 'composer pop-up: right after the heading row')
  ok(lines(composer)[at(composer, check_) - 2].includes('data-studio-template-action="close"') && lines(composer)[at(composer, check_) + 1].startsWith('      {!composer && dropdowns.savedTemplates && <>'), 'composer pop-up: the first thing after "Reuse a template" and its two icons, before the two dropdowns')
  ok(at(composer, check_) > at(composer, 'export function TemplatePickerContent(') && at(composer, check_) < at(composer, '      <div className="stcd-footer">'), 'composer pop-up: inside the dropdowns section')
  wsHookChecks(rawHook)
}

/** The strip: every file back to its base, byte for byte; only insertions but the one rewritten line. */
function stripSuite(sources, bases) {
  for (const rel of strip.STUDIO_TEMPLATE_MATCH_FILES) {
    ok(strip.stripStudioTemplateMatch(rel, sources[rel]) === bases[rel], `${rel}: without this change's lines it is the base's file, byte for byte`)
    ok(sources[rel] !== bases[rel], `${rel}: it is changed`)
    const diff = diffLines(git('diff', '-U0', blobOf(bases[rel]), blobOf(sources[rel])))
    const rewrites = strip.STUDIO_TEMPLATE_MATCH_REWRITES[rel] || []
    for (const row of diff) {
      if (row.startsWith('+')) ok(MARK.test(row), `${rel}: an added line without the marker: ${row.slice(0, 100)}`)
      else ok(rewrites.some(([, was]) => `-${was}` === row), `${rel}: a removed line that is not a registered rewrite: ${row.slice(0, 100)}`)
    }
    eq(diff.filter(row => row.startsWith('-')).length, rewrites.length, `${rel}: exactly the registered rewrites are removed`)
    ok(strip.stripStudioTemplateMatch(rel, strip.stripStudioTemplateMatch(rel, sources[rel])) === bases[rel], `${rel}: the strip is idempotent`)
  }
  eq(Object.keys(strip.STUDIO_TEMPLATE_MATCH_REWRITES), ['components/studio-template-workspace/picker.tsx'], 'one rewritten line, in the picker')
  ok(strip.stripStudioTemplateMatch('lib/other.ts', 'x // STUDIO-TEMPLATE-MATCH\n') === 'x // STUDIO-TEMPLATE-MATCH\n', 'strip: a file that is not this change\'s comes back as it is')
  ok(strip.stripStudioTemplateMatch(AREA, 'a\nb // STUDIO-TEMPLATE-MATCH-X\nc // X-STUDIO-TEMPLATE-MATCH\nd // STUDIO-TEMPLATE-MATCH\n') === 'a\nb // STUDIO-TEMPLATE-MATCH-X\nc // X-STUDIO-TEMPLATE-MATCH\n', 'strip: the marker is a whole token')
  ok(strip.stripStudioTemplateMatch(AREA, 'a\r\nb // STUDIO-TEMPLATE-MATCH\r\nc') === 'a\r\nc', 'strip: only the marked lines go, the other bytes stay')
}

const SOURCE_FILES = strip.STUDIO_TEMPLATE_MATCH_FILES
const normSources = (head = HEAD) => Object.fromEntries(SOURCE_FILES.map(rel => [rel, otherStrips(rel, headText(rel, head))]))
const normBases = () => Object.fromEntries(SOURCE_FILES.map(rel => [rel, otherStrips(rel, baseText(rel))]))
if (baseOk) {
  check('E. the marked lines: where each is, how each is gated; the strip gives every file back as dev has it (flag off = the base, byte for byte)', () => {
    const sources = normSources(), bases = normBases()
    markedSuite(sources, headText(WS_HOOK)); stripSuite(sources, bases)
    ok(registry.stripLaterChanges(AREA, headText(AREA)) === registry.stripLaterChanges(AREA, baseText(AREA)), 'registry: a file read through it is the base\'s (older proofs read it like that)')
    for (const rel of SOURCE_FILES) ok(registry.stripLaterChanges(rel, headText(rel)) === registry.stripLaterChanges(rel, baseText(rel)), `registry: ${rel} read through the registry is the base's`)
  }, { mutable: false })
  check('E. the flag in the new files: one literal process.env read in the lib; the hook and the components read the flag only through it; nothing else touches storage, the network or the socket', () => {
    const libText = src(LIB), hookText = src(HOOK)
    ok(!/^import /m.test(libText) && !/\brequire\(/.test(libText), 'lib: import-free')
    eq((libText.match(/process\.env\./g) ?? []).length, 1, 'lib: one literal process.env read (so Next inlines it)'); ok(libText.includes('process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH'), 'lib: the flag')
    ok(!/\bfetch\(|XMLHttpRequest|sessionStorage|document\./.test(libText + hookText + [BADGE, CHIP, GROUP, SHEET, CHECK].map(src).join('')), 'no fetch, no sessionStorage, no document access')
    ok(!/localStorage|\bwindow\b|\bdocument\b/.test(noComments(libText)), 'lib: storage is handed in, never reached for'); ok((noComments(hookText).match(/localStorage/g) ?? []).length === 1, 'hook: one place reads window.localStorage, guarded')
    ok(/function browserStorage\(\)[^{]*\{\s*try \{[^\n]*window\.localStorage[^\n]*\} catch \{ return null \}/.test(hookText), 'hook: that read is in a try/catch')
    for (const name of ['templateMatchSocketOpened', 'templateMatchFrameReceived', 'setTemplateAutoApply', 'switchTemplate', 'requestTemplatePicker', 'setTemplateSheetOpen']) ok(new RegExp(`export function ${name}\\([^)]*\\)[^{]*\\{\\n  if \\(!STUDIO_TEMPLATE_MATCH_ENABLED`).test(hookText) || new RegExp(`export function ${name}[\\s\\S]{0,160}STUDIO_TEMPLATE_MATCH_ENABLED`).test(hookText), `hook: ${name} returns at once with the flag off`)
    ok(!/\bwindow\.matchMedia/.test(hookText), 'hook: no layout reads')
  })
  const scopeOwnCommits = (head, opts) => {
    const own = ownOf(head, opts); assert.ok(own.length >= 1, 'no own commit yet')
    for (const c of own) { assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude [A-Za-z0-9. ]+ <noreply@anthropic\.com>\s*$/, c.slice(0, 8)); checks++ }
    return own
  }
  const NEVER = ['app/builder/page.tsx', 'lib/studio-strawman-stage.ts', 'components/builder/studio-strawman-note.tsx', 'components/builder/studio-strawman-note.css', 'lib/studio-stage-open-gate.ts', 'components/builder/studio-first-run.css', 'lib/studio-flow-control.ts', 'hooks/use-studio-flow-control.ts', 'components/builder/studio-phone-builder-top.tsx', 'components/layout/studio-phone-tab-bar.tsx']
  const scopeCommittedFiles = (head, ctx) => {
    const own = scopeOwnCommits(head), touched = new Set()
    for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
    eq([...touched].sort(), [...strip.STUDIO_TEMPLATE_MATCH_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
    for (const rel of SOURCE_FILES) {
      const diff = diffLines(git('diff', '-U0', blobOf(ctx.norm(rel, baseText(rel))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`)))))
      const rewrites = strip.STUDIO_TEMPLATE_MATCH_REWRITES[rel] || []
      for (const row of diff) { if (row.startsWith('+')) { ok(MARK.test(row), `${rel}: an unmarked added line: ${row.slice(0, 100)}`) } else ok(rewrites.some(([, was]) => `-${was}` === row), `${rel}: a removed line: ${row.slice(0, 100)}`) }
      ok(diff.length > 0, `${rel}: lines added`)
      ok(strip.stripStudioTemplateMatch(rel, ctx.norm(rel, git('show', `${head}:${rel}`))) === ctx.norm(rel, baseText(rel)), `${rel}: without its marked lines the file is the base's, byte for byte`)
    }
    for (const rel of strip.STUDIO_TEMPLATE_MATCH_NEW_FILES) eq(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
    for (const rel of strip.STUDIO_TEMPLATE_MATCH_PIN_FILES) { // the older proofs this change teaches: one registry-read edit each, every taught line marked, put back byte for byte
      const now = git('show', `${head}:${rel}`), base = baseText(rel)
      ok(ctx.norm(rel, strip.stripStudioTemplateMatch(rel, laterStrips(rel, now))) === ctx.norm(rel, base), `${rel}: the proof this change taught, put back, is the base's`) // later changes' strips first (a later change may rewrite a taught line), then this one's
      ok(strip.stripStudioTemplateMatch(rel, strip.stripStudioTemplateMatch(rel, laterStrips(rel, now))) === strip.stripStudioTemplateMatch(rel, laterStrips(rel, now)), `${rel}: putting back twice changes nothing`)
      for (const [has, was] of strip.STUDIO_TEMPLATE_MATCH_PIN_EDITS[rel]) {
        eq(laterStrips(rel, now).split(has).length - 1, 1, `${rel}: a taught edit is there once`)
        for (const line of has.split('\n').filter(Boolean)) ok(line.includes(strip.STUDIO_TEMPLATE_MATCH_PIN_MARK), `${rel}: every taught line carries the registry-read mark: ${line.slice(0, 80)}`)
        ok(!strip.STUDIO_TEMPLATE_MATCH_MARKER_RE.test(was), `${rel}: what a taught edit replaces is not marked`)
      }
      for (const row of diffLines(git('diff', '-U0', blobOf(ctx.norm(rel, base)), blobOf(ctx.norm(rel, laterStrips(rel, now)))))) if (row.startsWith('+')) ok(row.includes(strip.STUDIO_TEMPLATE_MATCH_PIN_MARK), `${rel}: an added line without the mark: ${row.slice(0, 100)}`)
    }
    ok(strip.STUDIO_TEMPLATE_MATCH_PIN_FILES.length > 0 && strip.STUDIO_TEMPLATE_MATCH_PIN_FILES.every(rel => !strip.STUDIO_TEMPLATE_MATCH_FILES.includes(rel) && !strip.STUDIO_TEMPLATE_MATCH_NEW_FILES.includes(rel)), 'the taught proofs are a list of their own')
    for (const rel of NEVER) ok(!touched.has(rel), `${rel} is not touched by this change`)
    for (const rel of touched) ok(!/^scripts\/test-studio-(p2-|flow-control|stage-open-gate|strawman-stage)|launch-wording|env-append-tolerant|route-params|admin-email-guard|uat-marketing|deck-title|first-paint|deck-card-thumbnail|director-websocket-reconnect/.test(rel) && !/test-director-websocket-reconnect/.test(rel), `${rel}: not on the never-edit list`)
  }
  const scopeEnvAndRegistry = (head, ctx) => {
    const env = git('show', `${head}:.env.example`), baseEnv = baseText('.env.example')
    eq(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
    eq(env.split(strip.STUDIO_TEMPLATE_MATCH_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
    ok(env.includes(`\n\n${strip.STUDIO_TEMPLATE_MATCH_ENV_BLOCK.split('\n')[0]}`), 'a blank line before the block')
    ok(/^NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH="false"$/m.test(strip.STUDIO_TEMPLATE_MATCH_ENV_BLOCK), 'documented, default off')
    ok(lines(strip.STUDIO_TEMPLATE_MATCH_ENV_BLOCK).filter(row => row && !row.startsWith('#') && row !== `${FLAG}="false"`).length === 0, 'the block is comments and its one assignment')
    const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
    eq(diff.filter(row => row.startsWith('-')).length, 0, 'the registry loses no line')
    const mine = diff.filter(row => row.includes('studio-template-match-strip.mjs'))
    eq(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const row of mine) ok(row.startsWith('+') && row.includes('// LATER-CHANGE:'), row.slice(0, 140))
    eq(mine.map(row => /\)\.(\w+), \/\//.exec(row)?.[1]), ['STUDIO_TEMPLATE_MATCH_SCOPE_FILES', 'STUDIO_TEMPLATE_MATCH_ENV_BLOCK', 'stripStudioTemplateMatch'], 'the three lines are the scope, the block and the strip')
    const reg = ctx.norm('scripts/studio-later-changes.mjs', git('show', `${scopeHead(head)}:scripts/studio-later-changes.mjs`)).split('\n')
    for (const name of ['STUDIO_TEMPLATE_MATCH_SCOPE_FILES', 'STUDIO_TEMPLATE_MATCH_ENV_BLOCK', 'stripStudioTemplateMatch']) {
      const found = reg.findIndex(row => row.includes(`studio-template-match-strip.mjs')).${name}`)); ok(found > 0, name)
      const next = reg.slice(found + 1).find(row => row.trim() !== '')
      ok(next.trim() === '// one line per later change, above this comment' || ctx.laterRegistryLine?.(next), `${name} is the last registered line of its list (a later change's own line may follow): ${next.slice(0, 80)}`)
    }
    for (const rel of strip.STUDIO_TEMPLATE_MATCH_NEW_FILES.filter(r => !r.endsWith('.json'))) ok(!/(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(git('show', `${head}:${rel}`)), `${rel}: no credential-shaped literal`)
  }
  const REAL = { norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }
  REAL.laterRegistryLine = (previous => row => previous?.(row) || row.includes('studio-phone-landscape-strip.mjs'))(REAL.laterRegistryLine) // LATER-CHANGES: registry read (PHONE-LANDSCAPE): the phone landscape's registry lines may follow this change's in each list of the registry (a later change's own line), chained like the stage open gate proof's
  const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }
  const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
  const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
  const commitWith = (parent, edits, message) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-idx-'))
    try {
      const env = { GIT_INDEX_FILE: path.join(dir, 'index') }
      plumb(['read-tree', parent], env)
      for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], env)
      return plumb(['commit-tree', plumb(['write-tree'], env), '-p', parent, '-m', message])
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  }
  if (HAS_OWN) {
    check('E. scope over the COMMITTED diff: this change\'s own commits (subject "Template match:", found across `rev-list --no-merges BASE..HEAD`, with the co-author line) touch exactly its files; added lines are marked insertions but the one registered rewrite; FRONTEND-1\'s and the flow-control files are untouched', () => { scopeOwnCommits(HEAD); scopeCommittedFiles(HEAD, REAL) }, { mutable: false })
    check('E. .env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines, each closing its list, and loses none', () => scopeEnvAndRegistry(HEAD, REAL), { mutable: false })
    const GATE = gateMerge(BASE_COMMIT, HEAD)
    check('E. GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the scope passes against it; the merged tree is read too', () => {
      eq(parentsOf(GATE), [BASE_COMMIT, HEAD], 'the gate merge')
      eq(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
      eq(scopeHead(GATE), HEAD, 'HEAD^2 is taken on the gate merge'); scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE, REAL)
      for (const rel of SOURCE_FILES) ok(strip.stripStudioTemplateMatch(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))) === otherStrips(rel, baseText(rel)), `the merged tree, without this change's lines, is the base's ${rel}`)
      eq(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); eq(scopeHead(BASE_COMMIT), BASE_COMMIT, 'a base commit too')
    }, { mutable: false })
    mutant('scope: the old first-parent own-commit query on the gate-style merge (no HEAD^2 rule) finds no own commit', () => { scopeOwnCommits(scopeHead(GATE, { gateRule: false }), { firstParentOnly: true }) })
    const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
    check('E. GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE: the scope head is still this change\'s head and the scope passes', () => {
      const advanced = gateMerge(unrelated, HEAD); eq(parentsOf(advanced), [unrelated, HEAD]); eq(scopeHead(advanced), HEAD); scopeAll(scopeHead(advanced)); scopeEnvAndRegistry(advanced, REAL)
    }, { mutable: false })
    // a SYNTHETIC change stacked after this one: a marked line beside this change's, a registry trio below this change's, an .env.example block, a new file
    const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
    const syntheticStrip = (rel, text) => SOURCE_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(row => !row.includes(SYN.marker)).join('\n') : text
    const syntheticCommit = parent => {
      const at = rel => git('show', `${parent}:${rel}`)
      const area = at(AREA).split('\n').flatMap(row => row.includes('<StudioTemplateMatchBadge />') ? [row, `        {/* ${SYN.marker} */}`] : [row]).join('\n')
      const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(row => {
        if (row.includes('STUDIO_TEMPLATE_MATCH_SCOPE_FILES')) return [row, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
        if (row.includes('STUDIO_TEMPLATE_MATCH_ENV_BLOCK')) return [row, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
        if (row.includes(').stripStudioTemplateMatch')) return [row, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
        return [row]
      }).join('\n')
      ok(area.includes(SYN.marker), 'the synthetic anchor exists')
      return commitWith(parent, { [AREA]: area, 'scripts/studio-later-changes.mjs': reg, '.env.example': `${at('.env.example')}\n${SYN.block}`, [SYN.file]: 'export const SYNTHETIC_SCOPE_FILES = new Set()\n' }, `Synthetic later: a change stacked after this one${TRAILER}`)
    }
    const synthetic = (() => { try { return syntheticCommit(HEAD) } catch (error) { return error } })()
    const SYN_CTX = { norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)), env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''), laterRegistryLine: row => row.includes('studio-synthetic-later-strip.mjs') }
    check('E. ROBUST AFTER MERGE: a synthetic change stacked after this one (a marked line beside this change\'s, a registry trio, an .env.example block, a new file; another subject) leaves this change\'s scope passing on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
      if (synthetic instanceof Error) throw synthetic
      assert.ok(!ownOf(synthetic).includes(synthetic), 'the later commit is not this change\'s'); eq(scopeHead(synthetic), synthetic)
      scopeAll(synthetic, SYN_CTX)
      const gate = gateMerge(BASE_COMMIT, synthetic); eq(scopeHead(gate), synthetic); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
      const advanced = gateMerge(unrelated, synthetic); eq(scopeHead(advanced), synthetic); scopeAll(scopeHead(advanced), SYN_CTX)
      markedSuite({ ...normSources(HEAD), [AREA]: laterStrips(AREA, syntheticStrip(AREA, git('show', `${synthetic}:${AREA}`))) }, headText(WS_HOOK)) // the wiring, read past the later change's line, is still this change's
    }, { mutable: false })
    mutant('scope: the synthetic later change is not told to the scope (its lines are unmarked additions, its registry lines extra)', () => { if (synthetic instanceof Error) throw synthetic; scopeCommittedFiles(synthetic, REAL); scopeEnvAndRegistry(synthetic, REAL) })
    mutant('scope: the .env.example block registered in the middle of its list (the older proofs then misread "the blocks after mine")', () => {
      const reg = git('show', `${HEAD}:scripts/studio-later-changes.mjs`).split('\n')
      const mineAt = reg.findIndex(row => row.includes(').STUDIO_TEMPLATE_MATCH_ENV_BLOCK')); const [row] = reg.splice(mineAt, 1)
      reg.splice(reg.findIndex(r => r.includes(').LEGAL_SHORT_LINKS_ENV_BLOCK')) + 1, 0, row)
      scopeEnvAndRegistry(commitWith(HEAD, { 'scripts/studio-later-changes.mjs': reg.join('\n') }, `${SUBJECT} misplaced env line${TRAILER}`), REAL)
    })
    mutant('scope: a stray foreign file in a "Template match:" commit', () => { scopeCommittedFiles(commitWith(HEAD, { 'stray-template-match.txt': 'stray\n' }, `${SUBJECT} a stray file${TRAILER}`), REAL) })
    mutant('scope: an own commit without the co-author line', () => { scopeOwnCommits(commitWith(HEAD, {}, `${SUBJECT} no trailer`)) })
    mutant('scope: an unmarked line added to the viewer area in an own commit', () => { scopeCommittedFiles(commitWith(HEAD, { [AREA]: git('show', `${HEAD}:${AREA}`).replace('        {presentationUrl && mountNative ? (', '        {/* sneaky */}\n        {presentationUrl && mountNative ? (') }, `${SUBJECT} sneaky${TRAILER}`), REAL) })
    mutant('scope: an own commit that touches the page (FRONTEND-1\'s strawman line lives there)', () => { scopeCommittedFiles(commitWith(HEAD, { 'app/builder/page.tsx': `${git('show', `${HEAD}:app/builder/page.tsx`)}\n` }, `${SUBJECT} touches the page${TRAILER}`), REAL) })
    mutant('scope: a taught proof gains an unmarked line', () => { scopeCommittedFiles(commitWith(HEAD, { 'scripts/test-studio-panel-focus.mjs': git('show', `${HEAD}:scripts/test-studio-panel-focus.mjs`).replace("const read = rel =>", "const sneaky = 1\nconst read = rel =>") }, `${SUBJECT} sneaky proof line${TRAILER}`), REAL) })
    mutant('scope: a taught proof that is not put back by the strip (an edit the table does not know)', () => { scopeCommittedFiles(commitWith(HEAD, { 'scripts/test-studio-panel-focus.mjs': git('show', `${HEAD}:scripts/test-studio-panel-focus.mjs`).replace("const read = rel =>", "const unknown = 1 // LATER-CHANGES: registry read (STUDIO-TEMPLATE-MATCH)\nconst read = rel =>") }, `${SUBJECT} untaught edit${TRAILER}`), REAL) })
    mutant('scope: an existing line rewritten in an own commit (a removed line that is not the registered rewrite)', () => { scopeCommittedFiles(commitWith(HEAD, { [STRIP]: git('show', `${HEAD}:${STRIP}`).replace('const RAIL_V2 = STUDIO_SLIDE_RAIL_V2 && STUDIO_THUMBNAILS', 'const RAIL_V2 = STUDIO_THUMBNAILS') }, `${SUBJECT} rewrites a line${TRAILER}`), REAL) })
  } else console.log(`NOTE E  no commit named "${SUBJECT} ..." yet: the committed-diff scope checks were skipped (the marked lines and the strip were checked on the working tree)`)
} else console.log(`NOTE E  git has no ${BASE_COMMIT.slice(0, 8)}: the base-identity and scope checks were skipped`)

// ============================================================================================================================================
// F. Mutants: every one must be caught (the mutated text is made OUTSIDE the mutant: a mutant whose text is not found fails the proof, it is never counted as caught)
// ============================================================================================================================================
console.log('F. mutants')
function mutantSuite(label, rel, from, to) {
  const mutated = swap(read(rel), from, to)
  mutant(label, () => {
    ACTIVE = { [rel]: mutated }
    try { for (const { fn } of SUITE) fn() } finally { ACTIVE = {} }
  })
}
const L = (label, from, to) => mutantSuite(`lib: ${label}`, LIB, from, to)
L('flag truthy', "export function templateMatchFlagOn(value: string | undefined): boolean {\n  return value === 'true'", "export function templateMatchFlagOn(value: string | undefined): boolean {\n  return Boolean(value)")
L('flag read from another name', 'process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH)', 'process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH_X)')
L('any version taken', 'if (p.version !== TEMPLATE_MATCH_VERSION) return null\n', '')
L('any status taken', "  if (p.status !== 'matched' && p.status !== 'no_match') return null\n", '')
L('auto_apply not required', "  if (typeof p.auto_apply !== 'boolean' || typeof p.applied !== 'boolean') return null", "  if (typeof p.applied !== 'boolean') return null")
L('a template named while nothing is applied is taken', '  if (p.applied === false && applied !== null) return null\n', '')
L('Undo for any reason', 'frame.previous_template_id === undefined || frame.reason === null || !TEMPLATE_UNDO_REASONS.includes(frame.reason)', 'frame.previous_template_id === undefined')
L('Undo needs a template to go back to (null is not allowed)', 'frame.previous_template_id === undefined || frame.reason', '!frame.previous_template_id || frame.reason')
L('no_template offers Undo', "export const TEMPLATE_UNDO_REASONS: readonly string[] = ['switch', 'chat_switch', 'undo']", "export const TEMPLATE_UNDO_REASONS: readonly string[] = ['switch', 'chat_switch', 'undo', 'no_template']")
L('a chat switch offers no Undo', "export const TEMPLATE_UNDO_REASONS: readonly string[] = ['switch', 'chat_switch', 'undo']", "export const TEMPLATE_UNDO_REASONS: readonly string[] = ['switch', 'undo']")
L('the badge ignores auto-apply off', 'frame.status === \'matched\' && frame.auto_apply && frame.applied)', "frame.status === 'matched' && frame.applied)")
L('the badge ignores whether anything is applied', "frame.status === 'matched' && frame.auto_apply && frame.applied)", "frame.status === 'matched' && frame.auto_apply)")
L('the deck badge words', "`Using your template ${applied.name}", "`Using template ${applied.name}")
L('the built badge words', 'for the slides not built yet`', 'for the unbuilt slides`')
L('built slides are not told', 'if (applied && frame.built_slide_ids.length > 0)', 'if (applied && frame.built_slide_ids.length > 99)')
L('the slide-level badge words', "plural(n, 'slide uses your template', 'slides use your templates')", "plural(n, 'slides use your templates', 'slide uses your template')")
L('the count comes from the score', 'if (item.covered !== null && item.total !== null && item.total > 0 && item.covered <= item.total) return { covered: item.covered, total: item.total }\n  return coverageFromReason(item.reason)', 'return null')
L('the count is taken from the words, not the integers', 'if (item.covered !== null && item.total !== null && item.total > 0 && item.covered <= item.total) return { covered: item.covered, total: item.total }\n  return coverageFromReason(item.reason)', 'return coverageFromReason(item.reason)')
L('invalid integers are taken', 'item.total > 0 && item.covered <= item.total) return', 'item.total >= 0) return')
L('rule 2 (applied_match) dropped', 'if (frame.slides.some(row => row.applied_match !== undefined)) { // 2.', 'if (false) { // 2.')
L('rule 3 (deck[k].slides) dropped', 'if (item.slides) { // 3.', 'if (false) { // 3.')
L('a null applied_match is not "New in your theme"', 'chips.set(slidePosition(row.slide_id, index), row.applied_match ? matchChip(row.applied_match, name) : themeChip())', 'chips.set(slidePosition(row.slide_id, index), row.applied_match ? matchChip(row.applied_match, name) : fromChip(name))')
L('applied_match is read as present on v0 rows', "...('applied_match' in item ? { applied_match: parseSlideMatch(item.applied_match) } : {})", '...{ applied_match: parseSlideMatch(item.applied_match) }')
L('the slide-level count is the best across candidates', '  if (frame.applied_template) {\n    if (frame.slides.some(row => row.applied_match !== undefined))', '  if (false) {\n    if (frame.slides.some(row => row.applied_match !== undefined))')
L('the slide-level count ignores applied_match (only the template\'s candidate row)', 'if (frame.slides.some(row => row.applied_match !== undefined)) return frame.slides.filter(row => row.applied_match).length', 'if (false) return 0')
L('built slides take the applied template\'s own chip', "    if (built.has(row.slide_id)) chips.set(slidePosition(row.slide_id, index), recorded(row))\n  })\n  const item", "    if (built.has(row.slide_id)) chips.set(slidePosition(row.slide_id, index), row.applied_match ? matchChip(row.applied_match, name) : themeChip())\n  })\n  const item")
L('the count is not read from the reason', "const found = typeof reason === 'string' ? /\\bCovers (\\d{1,4}) of (\\d{1,4}) slides?\\b/.exec(reason) : null", 'const found = null')
L('built slides lose their recorded chip', "    if (built.has(row.slide_id)) chips.set(slidePosition(row.slide_id, index), recorded(row))\n  })\n  const item", "  })\n  const item")
L('after a switch the old template\'s name stays on the chips', 'else chip = forApplied && row.match === null ? themeChip() : fromChip(name)', 'else chip = row.match ? matchChip(row.match, name) : themeChip()')
L('"New in your theme" never shown', 'const themeChip = (): TemplateChip => ({ tone: \'theme\', text: TEMPLATE_MATCH_WORDS.chipNew })', 'const themeChip = (): TemplateChip => ({ tone: \'theme\', text: \'\' })')
L('no_match is drawn as a match (badge)', "frame.status === 'matched' && frame.auto_apply && frame.applied)", "frame.auto_apply && frame.applied)")
L('no_match is drawn as a match (picker)', "return Boolean(frame && frame.status === 'matched' && frame.auto_apply && frame.deck.length > 0)", "return Boolean(frame && frame.auto_apply && frame.deck.length > 0)")
L('chips drawn with auto-apply off', "frame.status === 'matched' && frame.auto_apply && frame.applied)", "frame.status === 'matched' && frame.applied)")
L('the chip position ignores the plan id', "return found && Number(found[1]) >= 1 ? Number(found[1]) : index + 1", 'return index + 1')
L('Yours and Library swapped', "item.owner === 'user' ? TEMPLATE_MATCH_WORDS.yours : item.owner === 'library' ? TEMPLATE_MATCH_WORDS.library : null", "item.owner === 'user' ? TEMPLATE_MATCH_WORDS.library : item.owner === 'library' ? TEMPLATE_MATCH_WORDS.yours : null")
L('the group is drawn with auto-apply off', "return Boolean(frame && frame.status === 'matched' && frame.auto_apply && frame.deck.length > 0)", "return Boolean(frame && frame.status === 'matched' && frame.deck.length > 0)")
L('no "No template" row', "  rows.push({ templateId: null", "  if (false) rows.push({ templateId: null")
L('the first row is picked even when in use', 'const row = rows.find(candidate => !candidate.inUse)', 'const row = rows[0]')
L('the cap is first, not last', 'return [...list.filter(cap => cap !== TEMPLATE_MATCH_CAP), TEMPLATE_MATCH_CAP]', 'return [TEMPLATE_MATCH_CAP, ...list.filter(cap => cap !== TEMPLATE_MATCH_CAP)]')
L('the auto-apply message carries payload, not data', 'return { type: TEMPLATE_AUTO_APPLY_TYPE, data: {', 'return { type: TEMPLATE_AUTO_APPLY_TYPE, payload: {')
L('no template is sent as an empty id', "template_id: typeof templateId === 'string' && templateId !== '' ? templateId : null", "template_id: templateId ?? ''")
L('the preference defaults to off', 'return Object.prototype.hasOwnProperty.call(map, key) ? map[key] === true : true', 'return Object.prototype.hasOwnProperty.call(map, key) ? map[key] === true : false')
L('the preference is not per user', "(typeof user === 'string' && user.trim() !== '' ? user.trim().slice(0, 200) : TEMPLATE_AUTO_APPLY_ANONYMOUS)", 'TEMPLATE_AUTO_APPLY_ANONYMOUS')
L('a write throws', '  } catch {\n    return false\n  }', '  } catch (error) {\n    throw error\n  }')
L('a write replaces the other users\' choices', '{ ...readMap(storage), [userKeyOf(user)]: enabled === true }', '{ [userKeyOf(user)]: enabled === true }')
L('the storage key', "'studio.templateAutoApply.v1'", "'studio.templateAutoApply'")
const H = (label, from, to) => mutantSuite(`hook: ${label}`, HOOK, from, to)
H('no connect message', 'return input.socket.send(templateAutoApplyMessage(autoApply, input.socket.caps()))', 'return true')
H('the saved preference is not read at connect', 'const autoApply = readAutoApplyPreference(browserStorage(), user)', 'const autoApply = true')
H('a frame of another session stays', 'const sameSession = snapshot.sessionId === input.sessionId', 'const sameSession = true')
H('a bad frame wipes the last good one', '  const frame = parseTemplateMatchFrame(message)\n  if (!frame) return false', '  const frame = parseTemplateMatchFrame(message)\n  if (!frame) { publish(withFrame(null, sessionId)); return false }')
L('a frame never moves the preference', "return frame.auto_apply !== current ? frame.auto_apply : null", 'return null')
L('every frame moves the preference (a refresh and our own answer write too)', "return frame.auto_apply !== current ? frame.auto_apply : null", 'return frame.auto_apply')
L('the preference takes the wrong value', "return frame.auto_apply !== current ? frame.auto_apply : null", 'return frame.auto_apply !== current ? current : null')
H('a frame of another session is taken', "  if (snapshot.sessionId !== null && sessionId !== snapshot.sessionId) return false // another session's frame: nothing of it is taken, shown or written\n", '')
H('the frame\'s value is not written to the device (the check follows, the device forgets)', '  if (standing !== null) writeAutoApplyPreference(browserStorage(), user, standing)\n', '')
H('the check does not follow the frame (the device is written, the page is not)', '...(standing !== null ? { autoApply: standing } : {})', '...{}')
H('the frame is answered with a template_auto_apply (an echo)', '  if (standing !== null) writeAutoApplyPreference(browserStorage(), user, standing)\n', '  if (standing !== null) { writeAutoApplyPreference(browserStorage(), user, standing); if (socket) socket.send(templateAutoApplyMessage(standing, socket.caps())) }\n')
H('a notice is announced when the preference follows a frame', '  if (standing !== null) writeAutoApplyPreference(browserStorage(), user, standing)\n', '  if (standing !== null) { writeAutoApplyPreference(browserStorage(), user, standing); void window.alert }\n')
H('a toggle is not saved', 'writeAutoApplyPreference(browserStorage(), user, on)\n', 'void on\n')
H('a toggle is not sent', 'return socket ? socket.send(templateAutoApplyMessage(on, socket.caps())) : false', 'return false')
H('a switch carries no caps', 'socket.send(templateSwitchMessage(templateId, socket.caps()))', 'socket.send(templateSwitchMessage(templateId, []))')
H('a switch with no socket still claims to send', 'if (!STUDIO_TEMPLATE_MATCH_ENABLED || !socket) return false', 'if (!STUDIO_TEMPLATE_MATCH_ENABLED) return true')
H('the toggle works with the flag off', 'export function setTemplateAutoApply(enabled: boolean): boolean {\n  if (!STUDIO_TEMPLATE_MATCH_ENABLED) return false\n', 'export function setTemplateAutoApply(enabled: boolean): boolean {\n')
H('frames are taken with the flag off', 'export function templateMatchFrameReceived(message: unknown, sessionId: string | null): boolean {\n  if (!STUDIO_TEMPLATE_MATCH_ENABLED) return false\n', 'export function templateMatchFrameReceived(message: unknown, sessionId: string | null): boolean {\n')
H('Change asks for nothing', 'publish({ ...snapshot, pickerRequest: snapshot.pickerRequest + 1 })', 'publish({ ...snapshot })')
H('an unguarded storage read', 'try { return typeof window !== "undefined" ? window.localStorage : null } catch { return null }', 'return typeof window !== "undefined" ? window.localStorage : null')
const C = (label, rel, from, to) => mutantSuite(`${label}`, rel, from, to)
C('badge: shown while the stage gate holds the stage closed', BADGE, 'if (!stageOpen || !badge) return null', 'if (!badge) return null')
C('badge: Undo goes nowhere', BADGE, 'switchTemplate(badge.undo.to)', 'switchTemplate(null)')
C('badge: Change opens the sheet on any phone-width window', BADGE, 'STUDIO_PHONE_SHELL_ENABLED && typeof window', 'typeof window')
C('badge: Change never opens the picker', BADGE, 'else requestTemplatePicker()', 'else void 0')
C('badge: no Undo button', BADGE, '{badge.undo && <>', '{false && <>')
C('badge: the visible word changes', BADGE, '{TEMPLATE_MATCH_WORDS.badgeChange}<ChevronRight', '{"Edit"}<ChevronRight')
C('chip: shown while the gate holds the stage closed', CHIP, 'const chip = stageOpen ? chips.get(slideNumber) : undefined', 'const chip = chips.get(slideNumber)')
C('chip: no tone', CHIP, 'data-tone={chip.tone}', 'data-tone="template"')
C('group: shown with auto-apply off', GROUP, 'if (!pickerAvailable(match.frame)) return null', 'if (!match.frame) return null')
C('group: the template in use can be switched to', GROUP, 'disabled={!row || row.inUse}', 'disabled={!row}')
C('group: the pick is the first row', GROUP, ': defaultPickerChoice(rows)', ': rows[0]?.templateId')
C('group: Cancel stays in the sheet', GROUP, '{!sheet && <button type="button" onClick={onDone}>', '{true && <button type="button" onClick={onDone}>')
C('group: a switch does not close', GROUP, '    match.switchTemplate(row.templateId)\n    onDone()', '    match.switchTemplate(row.templateId)')
C('group: a score is shown', GROUP, '{candidate.coverage && <span data-studio-template-match="row-cov">{candidate.coverage}</span>}', '{candidate.coverage && <span data-studio-template-match="row-cov">{candidate.coverage} Fit 88%</span>}')
C('sheet: opens with nothing to choose from', SHEET, 'const open = match.sheetOpen && pickerAvailable(match.frame)', 'const open = match.sheetOpen')
C('sheet: the Templates link where that page does not work', SHEET, '{TEMPLATES_PAGE_ENABLED && (', '{true && (')
C('check: starts unticked', CHECK, 'checked={autoApply}', 'checked={false}')
C('check: a tick changes nothing', CHECK, 'onChange={event => setAutoApply(event.target.checked)}', 'onChange={() => undefined}')
C('check: the help does not follow', CHECK, '{autoApply ? TEMPLATE_MATCH_WORDS.checkHelpOn : TEMPLATE_MATCH_WORDS.checkHelpOff}', '{TEMPLATE_MATCH_WORDS.checkHelpOn}')
C('stylesheet: a rule that is not keyed to the marker (it would restyle today\'s picker)', CSS, '/* ---- the choices:', '.stw-pick { color: red; }\n/* ---- the choices:')
C('stylesheet: the chip not bottom-left', CSS, 'left: 4px; bottom: 4px; z-index: 1', 'left: 4px; top: 4px; z-index: 1')
C('stylesheet: no phone rule', CSS, '@media (max-width: 640px) {', '@media (max-width: 6px) {')
const W = (label, from, to) => mutantSuite(`wire: ${label}`, WIRE, from, to)
W('the cap is not added', 'data.client_caps = withTemplateMatchCap(data.client_caps)', 'void withTemplateMatchCap')
W('the base caps in another order', '  if (CHAT_ELEMENT_REFINE_ENABLED) addChatElementRefineFields(data, null)\n  if (CHAT_ELEMENT_EDIT_ENABLED) addChatElementEditCaps(data)', '  if (CHAT_ELEMENT_EDIT_ENABLED) addChatElementEditCaps(data)\n  if (CHAT_ELEMENT_REFINE_ENABLED) addChatElementRefineFields(data, null)')
W('a cap left out of the base caps', '  if (STUDIO_CHAT_COMMANDS_ENABLED) addChatCommandsFields(data, \'\')\n', '')
const S = (label, from, to) => mutantSuite(`socket hook: ${label}`, WS_HOOK, from, to)
S('the cap line is not gated by the flag', 'if (STUDIO_TEMPLATE_MATCH_ENABLED) addTemplateMatchCap(', 'addTemplateMatchCap(')
S('the connect send is not gated', 'if (STUDIO_TEMPLATE_MATCH_ENABLED) templateMatchSocketOpened({', 'templateMatchSocketOpened({')
S('the connect send waits for something else', 'userId: userIdRef.current || null, socket:', 'userId: null, socket:')
S('the connect send uses a stale socket', 'if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) return false; try { ws.send(JSON.stringify(message)); return true }', 'try { ws.send(JSON.stringify(message)); return true }')
S('the frame unlocks the turn', 'if (parsedMessage.session_id === socketSessionId) templateMatchFrameReceived(parsedMessage, socketSessionId); return } // STUDIO-TEMPLATE-MATCH', 'if (parsedMessage.session_id === socketSessionId) templateMatchFrameReceived(parsedMessage, socketSessionId); clearAwaitReply(); return } // STUDIO-TEMPLATE-MATCH')
S('a frame of another session is taken', 'if (parsedMessage.session_id === socketSessionId) templateMatchFrameReceived(', 'templateMatchFrameReceived(')
S('the frame falls through to the reducer', 'templateMatchFrameReceived(parsedMessage, socketSessionId); return } // STUDIO-TEMPLATE-MATCH', 'templateMatchFrameReceived(parsedMessage, socketSessionId) } // STUDIO-TEMPLATE-MATCH')

// the marked lines in the existing files (a mutated copy of the normalised text)
if (baseOk) {
  const sources0 = normSources(), bases0 = normBases(), raw0 = headText(WS_HOOK)
  const M = (label, rel, from, to) => { const sources = { ...sources0, [rel]: swap(sources0[rel], from, to) }; mutant(`marked line: ${label}`, () => { markedSuite(sources, rel === WS_HOOK ? sources[WS_HOOK] : raw0); stripSuite(sources, bases0) }) }
  M('the badge is not gated by the flag', AREA, '{STUDIO_TEMPLATE_MATCH_ENABLED && presentationUrl', '{presentationUrl')
  M('the badge is drawn in template mode', AREA, ' && !templateModeOn && <StudioTemplateMatchBadge />', ' && <StudioTemplateMatchBadge />')
  M('the badge is drawn without a deck on the stage', AREA, 'STUDIO_TEMPLATE_MATCH_ENABLED && presentationUrl && mountNative && !templateModeOn', 'STUDIO_TEMPLATE_MATCH_ENABLED && !templateModeOn')
  M('the badge line loses its marker (an unmarked insertion)', AREA, '</StudioTemplateMatchBadge />}{/* STUDIO-TEMPLATE-MATCH'.replace('</', '<'), '<StudioTemplateMatchBadge />}{/* a note')
  M('the chip is not gated by the flag', STRIP, '{STUDIO_TEMPLATE_MATCH_ENABLED && <StudioTemplateMatchChip', '{<StudioTemplateMatchChip')
  M('the chip is keyed by the real slide number', STRIP, '<StudioTemplateMatchChip slideNumber={visualNumber} />', '<StudioTemplateMatchChip slideNumber={realSlideNumber} />')
  M('the group is not gated by the flag', PICKER, '{STUDIO_TEMPLATE_MATCH_ENABLED && <StudioTemplateMatchGroup', '{<StudioTemplateMatchGroup')
  M('the heading is always the new one', PICKER, "{studioTemplateGroupShown ? 'Start a new presentation ' : 'Start from a template '}", "{'Start a new presentation '}")
  M('the heading splits into two text nodes (flag off would no longer be the same markup)', PICKER, "<h3>{studioTemplateGroupShown ? 'Start a new presentation ' : 'Start from a template '}<span>", "<h3>{studioTemplateGroupShown ? 'Start a new presentation' : 'Start from a template'} <span>")
  M('the picker hooks sit in a condition', PICKER, 'useStudioTemplatePickerRequest(() => setOpen(true)) //', 'if (open) useStudioTemplatePickerRequest(() => setOpen(true)) //')
  M('the check is not gated by the flag', COMPOSER_PICKER, '{STUDIO_TEMPLATE_MATCH_ENABLED && <StudioTemplateAutoApplyCheck />}', '{<StudioTemplateAutoApplyCheck />}')
  M('the check sits below the dropdowns', COMPOSER_PICKER, "      {STUDIO_TEMPLATE_MATCH_ENABLED && <StudioTemplateAutoApplyCheck />}{/*", "      {/*")
  mutant('marked line: the strip leaves a marked line of the picker in place', () => stripSuite({ ...sources0, [PICKER]: sources0[PICKER].replace('\n', '\n// not marked\n') }, bases0))
}

// ============================================================================================================================================
console.log(`\n${failures.length ? 'FAIL' : 'PASS'}  studio template match: ${passed} checks and mutants passed, ${failures.length} failed (${checks} asserts)`)
for (const failure of failures) console.log(`  - ${failure}`)
process.exit(failures.length ? 1 : 0)
