// FRONTEND-1: proof of the Replace picture hero-only change (PK's UAT test of 17 Nov 2026 on Replace picture, M10: the button was offered on content slides, where a photo behind dense text hurts reading, and on open the dialog showed behind the slide first).
// Flag NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY, only the exact string "true", default off. It acts only where Replace picture itself acts.
//
//   node scripts/test-studio-replace-picture-hero-only.mjs        (plain node, offline: the REAL sources transpiled and run in a vm; the REAL hook runs in the offline React host (scripts/studio-chat-harness/mini-react.mjs) against a viewer double that answers the way
//                                                                   Layout's slide catalog and composeGetState do; react-dom/server for the control's markup; git is read for the strips, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to H), then mutants (I):
//  A. the lib: the flag is on for the exact string "true" and for nothing else, one literal env read; the pure helper heroOnlyReasonFor (a table: hero_slot -> available, slide_background -> the exact words, an unknown target or no answer -> available, flag off -> never a
//     reason); replacePictureDisabledReason honours the helper's words after the reasons the person can act on first and before Layout's own answer, and adds nothing when it is given none;
//  B. the REAL hook: flag off, the transcript (what the hook returns and what it sends, over a matrix of viewers, slides and states) equals dev's hook event for event, hashed; flag on, the same matrix differs from dev's ONLY in the reason of a slide Layout
//     says is slide_background (the words, exactly), unless an earlier state already greys it; an unknown target stays available; hero_slot is unchanged; nothing is sent; and the rule is checked again at CLICK time (a hero slide whose target turns out to be a
//     background while the dialog is open is refused with the words, nothing sent; flag off it is sent);
//  C. the control: flag off its markup (the dialog opened, under a stand-in for the shadcn Dialog) is dev's, byte for byte; flag on it differs by one data attribute on the dialog and nothing else;
//  D. the css (a new file, the Replace picture css is dev's): every rule needs the attribute the control sets only with the flag on; the dialog and its overlay get a z-index above the shell's phone overlays and below the toast and the tooltip, and no entrance
//     animation while open (the root cause: the shadcn Dialog fades in over 200 ms, so for the first frames it is see-through and the slide shows through it);
//  E. only insertions: every line this change adds to an existing file carries the marker REPLACE-PICTURE-HERO-ONLY and is a pure insertion (the strip gives dev's file byte for byte); the older proofs it teaches; the viewer, the slide area and the Builder page are dev's;
//  F. .env.example (one block at the end, "false"), the registry (three lines after the Research default's, each marked LATER-CHANGE), the strips commute;
//  G. own-commit scope by the subject prefix "Replace picture hero only:" on the first-parent line (with none there, as after a merge into dev, a NOTE and a pass), the commit message, a secret scan of the added lines;
//  H. the flag is read from one literal env name, and nothing but the lib reads it.
//  I. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
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
import { Root } from './studio-chat-harness/mini-react.mjs'
import * as stripModule from './studio-replace-picture-hero-only-strip.mjs'
import * as replacePictureStrip from './studio-replace-picture-strip.mjs'
import * as researchDefaultStrip from './studio-research-default-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const { BASE_COMMIT, HERO_ONLY_FLAGS: FLAGS, HERO_ONLY_MARKER_RE: MARKER_RE, HERO_ONLY_SUBJECT: SUBJECT, HERO_ONLY_FILES: APP_FILES, HERO_ONLY_NEW_FILES: NEW_FILES, HERO_ONLY_EDITS: EDITS, HERO_ONLY_PIN_EDITS: PIN_EDITS, HERO_ONLY_PIN_FILES: PIN_FILES, HERO_ONLY_PIN_MARK: PIN_MARK, HERO_ONLY_LIB_FLAGS: LIB_FLAGS,
  REPLACE_PICTURE_HERO_ONLY_SCOPE_FILES: SCOPE, REPLACE_PICTURE_HERO_ONLY_ENV_BLOCK: ENV_BLOCK } = stripModule
const STRIP_FN = stripModule.stripReplacePictureHeroOnly
const FLAG = FLAGS[0]
const SHELL_FLAG = 'NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }
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
const LIB = 'lib/studio-replace-picture.ts', HERO = 'lib/studio-replace-picture-hero-only.ts', HOOK = 'hooks/use-studio-replace-picture.ts', CONTROL = 'components/builder/replace-picture/replace-picture-control.tsx'
const CSS = 'components/builder/replace-picture/replace-picture-hero-only.css', CSS_OLD = 'components/builder/replace-picture/replace-picture.css'
const ENV = '.env.example', REGISTRY = 'scripts/studio-later-changes.mjs'
const VIEWER = 'components/presentation-viewer.tsx', AREA = 'components/builder/presentation-area.tsx', PAGE = 'app/builder/page.tsx'
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const localFile = (spec, from) => {
  const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('./') ? path.posix.join(path.posix.dirname(from), spec.slice(2)) : null
  if (base === null) return null
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (fs.existsSync(path.join(root, base + ext)) && fs.statSync(path.join(root, base + ext)).isFile()) return base + ext
  throw new Error(`unexpected import ${spec} in ${from}`)
}
const textsKeys = new WeakMap(), modules = new Map()
const textsKey = texts => { if (!textsKeys.has(texts)) textsKeys.set(texts, crypto.createHash('sha1').update(JSON.stringify(texts)).digest('hex')); return textsKeys.get(texts) }
const stubsKeys = new WeakMap()
const stubsKey = stubs => { if (!stubsKeys.has(stubs)) stubsKeys.set(stubs, `${stubsKeys.size}`); return stubsKeys.get(stubs) }
/** Load one real source in a new context. `texts` replaces the text of any file (a mutant, or dev's text); `env` is process.env; `globals` are extra globals (a fake window); `stubs` replaces an import by a stand-in; every other import is the REAL source or package. A .css import is an empty module. */
function load(rel, { env = {}, texts = {}, globals = null, id = '', stubs = {} } = {}) {
  const key = `${rel}\0${JSON.stringify(env)}\0${textsKey(texts)}\0${id}\0${stubsKey(stubs)}`
  if (modules.has(key)) return modules.get(key)
  const module = { exports: {} }
  modules.set(key, module.exports)
  const req = spec => {
    if (spec in stubs) return stubs[spec]
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    const local = localFile(spec, rel)
    return local ? load(local, { env, texts, globals, id, stubs }) : nodeRequire(spec)
  }
  vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), { module, exports: module.exports, require: req, process: { env: { ...env } }, URL, Promise, setTimeout, clearTimeout, console, window: globals?.window, fetch: () => assert.fail(`${rel} fetched`) }, { filename: rel })
  return module.exports
}
const h = React.createElement
const tick = () => new Promise(resolve => setImmediate(resolve))
/** The lib, hook and control as dev has them: the texts the Replace picture change left (this change's marked lines put back). */
const DEV = { [LIB]: baseText(LIB), [HOOK]: baseText(HOOK), [CONTROL]: baseText(CONTROL) }
/** The environments: Replace picture on (as in UAT), and with the hero-only flag too. */
const ON = { [SHELL_FLAG]: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const HERO_ON = { ...ON, [FLAG]: 'true' }
const WORDS = 'Pictures can be replaced on title, section and closing slides.'

// ============================================================================================================================================
// A. the lib
// ============================================================================================================================================
const REASONS = ['NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'VIEW_ONLY_PAGE']
/** Every answer the slide catalog can give for the slide on screen, as lib/studio-replace-picture.ts reads it (readSlideEligibility). */
const ELIGIBILITIES = [
  { state: 'loading' }, { state: 'absent' }, { state: 'unknown' },
  { state: 'known', eligible: true, reason: null, target: 'hero_slot' }, { state: 'known', eligible: true, reason: null, target: 'slide_background' }, { state: 'known', eligible: true, reason: null, target: null },
  ...REASONS.flatMap(reason => [{ state: 'known', eligible: false, reason, target: 'hero_slot' }, { state: 'known', eligible: false, reason, target: 'slide_background' }, { state: 'known', eligible: false, reason, target: null }]),
  { state: 'known', eligible: false, reason: null, target: 'hero_slot' }, { state: 'known', eligible: false, reason: null, target: 'slide_background' },
]
const isBackground = e => e.state === 'known' && e.target === 'slide_background'
function libChecks(texts = {}) {
  // the flag: the exact string "true" and nothing else
  for (const [value, on] of [['true', true], ['TRUE', false], ['True', false], ['1', false], ['yes', false], ['on', false], [' true', false], ['true ', false], ['false', false], ['', false], [undefined, false]]) {
    const env = value === undefined ? {} : { [FLAG]: value }
    assert.equal(load(HERO, { env, texts }).STUDIO_REPLACE_PICTURE_HERO_ONLY, on, `the flag with ${JSON.stringify(value)}`)
    assert.equal(load(HERO, { env: {}, texts }).replacePictureHeroOnlyFlagOn(value), on, `replacePictureHeroOnlyFlagOn(${JSON.stringify(value)})`)
  }
  for (const value of [true, 1, null, {}]) assert.equal(load(HERO, { env: {}, texts }).replacePictureHeroOnlyFlagOn(value), false, `a value that is not a string is off: ${JSON.stringify(value)}`)
  // the words, exactly
  const On = load(HERO, { env: { [FLAG]: 'true' }, texts }), Off = load(HERO, { env: {}, texts })
  assert.equal(On.HERO_ONLY_WORDS, WORDS, 'the words are PK\'s, exactly')
  // the helper: a table (flag on: the words exactly for a KNOWN slide_background, whatever Layout says about eligibility; flag off: never)
  for (const eligibility of ELIGIBILITIES) {
    assert.equal(On.heroOnlyReasonFor(eligibility, true), isBackground(eligibility) ? WORDS : null, `flag on, ${JSON.stringify(eligibility)}`)
    assert.equal(On.heroOnlyReasonFor(eligibility, false), null, `flag off, ${JSON.stringify(eligibility)}: never a reason`)
    assert.equal(Off.heroOnlyReasonFor(eligibility, true), isBackground(eligibility) ? WORDS : null, 'the helper takes the flag as an argument: the env does not matter to it')
  }
  for (const odd of [null, undefined, 5, 'known', [], {}, { state: 'known' }, { state: 'known', target: 'Slide_Background' }, { state: 'known', target: 'slide-background' }, { state: 'unknown', target: 'slide_background' }, { state: 'absent', target: 'slide_background' }]) assert.equal(On.heroOnlyReasonFor(odd, true), null, `a malformed or unknown answer is available: ${JSON.stringify(odd)}`)
  for (const enabled of [undefined, null, 0, 1, 'true', 'yes', {}]) assert.equal(On.heroOnlyReasonFor({ state: 'known', eligible: true, reason: null, target: 'slide_background' }, enabled), null, `the helper acts only for a real true: ${JSON.stringify(enabled)}`)
  // replacePictureDisabledReason: the words come after the reasons the person can act on first, before Layout's own answer; none given, nothing added
  const A = load(LIB, { env: {}, texts })
  const R = A.REPLACE_PICTURE_REASONS
  const open = { deckOpen: true, viewerReady: true, readOnly: null, templateMode: false, building: false, regeneratingThisSlide: false, studioBusy: false, mutationPending: false, eligibility: { state: 'known', eligible: true, reason: null, target: 'slide_background' } }
  assert.equal(A.replacePictureDisabledReason({ ...open, heroOnlyReason: WORDS }), WORDS, 'a content slide with the rule on: the words')
  assert.equal(A.replacePictureDisabledReason({ ...open }), null, 'the same slide without the rule (dev): available')
  const earlier = [[{ readOnly: 'view-only' }, R.viewOnly], [{ readOnly: 'preview' }, R.preview], [{ tabPausedHint: 'This tab is paused (test).' }, 'This tab is paused (test).'], [{ templateMode: true }, R.template], [{ building: true }, R.building], [{ regeneratingThisSlide: true }, R.regenerating],
    [{ studioBusy: true }, R.busy], [{ mutationPending: true }, R.mutating], [{ deckOpen: false }, R.loading], [{ viewerReady: false }, R.loading], [{ placeholderOnScreen: true }, R.placeholder]]
  for (const [patch, words] of earlier) assert.equal(A.replacePictureDisabledReason({ ...open, ...patch, heroOnlyReason: WORDS }), words, `${JSON.stringify(patch)}: that reason comes first, not the hero-only words`)
  for (const eligibility of ELIGIBILITIES) {
    assert.equal(A.replacePictureDisabledReason({ ...open, eligibility, heroOnlyReason: WORDS }), WORDS, `the words win over Layout's own answer: ${JSON.stringify(eligibility)}`)
    const plain = A.replacePictureDisabledReason({ ...open, eligibility })
    for (const none of [null, undefined, '', 5, {}, []]) assert.equal(A.replacePictureDisabledReason({ ...open, eligibility, heroOnlyReason: none }), plain, `no usable words (${JSON.stringify(none)}): exactly dev's answer for ${JSON.stringify(eligibility)}`)
  }
  // the lib stays import-free of runtime code (type imports only), and touches no network, storage or timers
  const src = texts[HERO] ?? read(HERO)
  assert.deepEqual([...src.matchAll(/^import .*$/gm)].map(m => m[0]), ["import type { SlideEligibility } from '@/lib/studio-replace-picture'"], 'the lib imports one type and no runtime code')
  assert.ok(!/\bfetch\(|localStorage|sessionStorage|XMLHttpRequest|WebSocket|setTimeout|Date\.now|Math\.random/.test(src), 'the lib is pure')
  assert.deepEqual([...(texts[LIB] ?? read(LIB)).matchAll(/^import .*$/gm)].map(m => m[0]), [], 'the Replace picture lib stays import-free (the older proof transpiles it into a bare vm)')
}

// ============================================================================================================================================
// B. the REAL hook, in the offline React host, against a viewer double
// ============================================================================================================================================
const FRAME = { frame: 'iframe' }
let mountSeq = 0
function orderReceipt(sections, currentVisualIndex) {
  const slides = [], placeholders = []
  let real = 0
  sections.forEach((section, visualIndex) => { if (section === 'P') { placeholders.push({ job_id: 'job-1', visual_index: visualIndex }); return } slides.push({ slide_id: section, visual_index: visualIndex, layout_index: real }); real += 1 })
  return { success: true, action: 'composeGetState', current_visual_index: currentVisualIndex, current_placeholder_job_id: sections[currentVisualIndex] === 'P' ? 'job-1' : null, real_slide_count: slides.length, visual_section_count: sections.length, total_visual_sections: sections.length, placeholders, slides }
}
/** A viewer double: Layout's slot catalog (with !296's backgroundPicture: every REAL slide eligible, a hero's picture to its slot, any other slide's to its background, unless `entries` says otherwise; `noReport` leaves the key out; `report` puts any value there) and the viewer's order. */
function viewer(over = {}) {
  const calls = [], listeners = new Set(), added = [], removed = []
  const win = { addEventListener: (type, fn) => { if (type === 'message') { listeners.add(fn); added.push(fn) } }, removeEventListener: (type, fn) => { if (type === 'message') { listeners.delete(fn); removed.push(fn) } }, post: (data, source = 'viewer') => { for (const fn of [...listeners]) fn({ data, source, origin: 'https://layout.test' }) } }
  const state = { current: 0, count: 8, heroes: [0, 3, 7], entries: {}, placeholders: [], ...over, currentExplicit: 'current' in over }
  const idOf = layout => `slide_${String(layout + 1).padStart(8, '0')}`
  const sections = () => { const out = []; let real = 0; for (let visual = 0; visual < state.count + state.placeholders.length; visual++) out.push(state.placeholders.includes(visual) ? 'P' : idOf(real++)); return out }
  const send = async (iframe, action, params, options) => {
    calls.push({ action, params: JSON.parse(JSON.stringify(params ?? null)), options: options ? { ...options } : undefined, iframe })
    if (action === 'getTemplateSlotCatalog') {
      if (state.catalogFails) throw new Error('Command timeout')
      const slides = Array.from({ length: state.count }, (_, i) => ({ slide_index: i, slide_id: idOf(i), eligible: true, reason: null, target: state.heroes.includes(i) ? 'hero_slot' : 'slide_background', ...(state.entries[i] ?? {}) }))
      return { success: true, canvas_type: 'H1s', hero_style: null, slots: [], ...(state.noReport ? {} : { backgroundPicture: 'report' in state ? state.report : { enabled: true, slides } }) }
    }
    if (action === 'composeGetState') { if (state.orderFails) throw new Error('Command timeout'); return orderReceipt(sections(), state.current) }
    if (action === 'setSlideBackgroundPicture') return { success: true, action, slide_index: params.slide_index, hidden_image_ids: [] }
    throw new Error(`unexpected command ${action}`)
  }
  return { calls, listeners, added, removed, win, send, state, commands: () => calls.filter(c => c.action === 'setSlideBackgroundPicture') }
}
async function mount(env, v, over = {}, texts = {}) {
  const probe = { begins: [], released: 0, after: 0 }
  const mountId = `mount${++mountSeq}`
  const H = load(HOOK, { env, texts, globals: { window: v.win }, id: mountId })
  const input = () => ({
    enabled: true, deckOpen: true, viewerReady: true, presenting: false, presentationId: 'deck-1', frameUrl: 'https://layout.test/p/deck-1', activeVersion: 'final', currentSlide: 1, railSlideId: 'outline-1', railSlideTitle: 'Why we are rethinking the roadmap',
    tabPausedHint: undefined, templateMode: false, building: false, studioBusy: false, composeJobs: [], mutationPending: false, send: v.send, getIframe: () => FRAME, isTrustedReply: event => event.source === 'viewer', onReloadDeck: undefined,
    begin: operation => { probe.begins.push(operation); return { iframe: FRAME, isCurrent: () => true, release: () => { probe.released++ } } },
    afterReplace: () => { probe.after++ }, ...over,
  })
  const out = { view: null }
  const Probe = ({ props }) => { out.view = H.useStudioReplacePicture(props); return null }
  const rootHost = new Root()
  const set = patch => { Object.assign(over, patch); if (!v.state.currentExplicit && Number.isInteger(over.currentSlide)) v.state.current = over.currentSlide - 1; rootHost.setElement(h(Probe, { props: input() })) }
  const settle = async () => { for (let i = 0; i < 5; i++) { rootHost.flush(); await tick() } rootHost.flush() }
  set({}); await settle()
  // a mount's modules live in their own vm contexts: let them go when the mount is unmounted (a mutant run mounts hundreds)
  const unmount = () => { rootHost.unmount(); for (const key of [...modules.keys()]) if (key.includes(`\0${mountId}\0`)) modules.delete(key) }
  return { out, probe, set, settle, root: { unmount }, view: () => out.view }
}
const NEW = 'https://pictures.example.test/harbour-dawn.jpg'
/** What the hook returned and what it sent: the part of the view a person or the viewer can see. */
const snapshot = (m, v) => ({ visible: m.view().visible, reason: m.view().reason, slideNumber: m.view().slideNumber, slideTitle: m.view().slideTitle, target: m.view().target, slideId: m.view().slideId, calls: v.calls.map(c => [c.action, c.params, c.options]) })

/** The matrix: viewers (what Layout answers), slides on screen, and states of the page. */
const VIEWERS = {
  'default (heroes 1, 4, 8)': {}, 'no hero at all': { heroes: [] }, 'every slide a hero': { heroes: [0, 1, 2, 3, 4, 5, 6, 7] },
  'content slides refused': { entries: { 1: { eligible: false, reason: 'NO_BACKGROUND_PICTURE' }, 2: { eligible: false, reason: 'PICTURE_DECLINED' }, 4: { eligible: false, reason: 'VIEW_ONLY_PAGE' } } },
  'a hero refused': { entries: { 0: { eligible: false, reason: 'PICTURE_DECLINED' }, 3: { eligible: false, reason: null } } },
  'no report': { noReport: true }, 'report that lists no slide': { report: { enabled: true, slides: [{ slide_index: 40, eligible: true, reason: null, target: 'slide_background' }] } }, 'a target Layout did not name': { entries: { 1: { target: 'something_new' }, 0: { target: null } } },
  'catalog read fails': { catalogFails: true }, 'order read fails': { orderFails: true }, 'a placeholder before slide 2': { placeholders: [1] },
}
const STATES = {
  none: {}, building: { building: true }, studioBusy: { studioBusy: true }, mutationPending: { mutationPending: true }, templateMode: { templateMode: true }, paused: { tabPausedHint: 'This tab is paused (test).' }, preview: { activeVersion: 'strawman' },
  viewOnly: { frameUrl: 'https://layout.test/p/deck-1?viewOnly=true' }, notReady: { viewerReady: false }, notOpen: { deckOpen: false }, regenerating: { composeJobs: [{ kind: 'refine', status: 'building', targetSlideId: 'outline-1', targetIndex: 0, targetLayoutIndex: 0 }] },
}
const SLIDES = [1, 2, 3, 4, 8]
async function matrix(env, texts, { viewers = VIEWERS, slides = SLIDES, states = STATES } = {}) {
  const out = {}
  for (const [vName, vOver] of Object.entries(viewers)) for (const slide of slides) for (const [sName, state] of Object.entries(states)) {
    const v = viewer({ ...vOver, entries: { ...(vOver.entries ?? {}) } }), m = await mount(env, v, { currentSlide: slide, ...state }, texts)
    out[`${vName} | slide ${slide} | ${sName}`] = snapshot(m, v); m.root.unmount()
  }
  return out
}
let devMatrix = null
async function hookChecks(texts = {}) {
  const devTexts = { ...texts, ...DEV }
  // flag off (the hook as it is built with Replace picture on and no hero-only flag): the whole transcript is dev's hook's, event for event, and its digest is the same
  const dev = devMatrix ??= await matrix(ON, devTexts), off = await matrix(ON, texts)
  assert.equal(Object.keys(dev).length, Object.keys(VIEWERS).length * SLIDES.length * Object.keys(STATES).length, 'the matrix ran')
  assert.deepEqual(off, dev, 'flag off: every view and every command the hook sends is dev\'s')
  const small = { viewers: { 'default': VIEWERS['default (heroes 1, 4, 8)'], 'content slides refused': VIEWERS['content slides refused'] }, slides: [1, 2], states: { none: {} } }
  for (const flagValue of ['TRUE', '1', 'yes', 'false', '']) { const some = await matrix({ ...ON, [FLAG]: flagValue }, texts, small); for (const key of Object.keys(some)) deepEqual(some[key], dev[key.replace(/^default \|/, 'default (heroes 1, 4, 8) |')], `the flag ${JSON.stringify(flagValue)} is off: dev's transcript (${key})`) }
  const digest = sha(JSON.stringify(dev)); assert.equal(sha(JSON.stringify(off)), digest, 'and the digests agree')
  hookChecks.digest = digest.slice(0, 16)
  // flag on: dev's transcript, except the reason of a slide Layout says is slide_background, which is the words (an earlier state keeps its own reason; nothing else is read or sent differently)
  const on = await matrix(HERO_ON, texts)
  let words = 0, keptEarlier = 0, unchanged = 0
  for (const key of Object.keys(dev)) {
    const base = dev[key], now = on[key], state = key.split(' | ')[2]
    const expectWords = state === 'none' && base.target === 'slide_background'
    deepEqual({ ...now, reason: undefined }, { ...base, reason: undefined }, `${key}: only the reason may differ`)
    if (expectWords) { assert.equal(now.reason, WORDS, `${key}: a known slide_background is greyed with the words`); words++ } else { assert.equal(now.reason, base.reason, `${key}: the reason is dev's`); if (state !== 'none' && base.target === 'slide_background') keptEarlier++; else unchanged++ }
  }
  assert.ok(words >= 10 && keptEarlier >= 20 && unchanged >= 100, `the matrix covers both sides (${words} greyed by the rule, ${keptEarlier} kept by an earlier state, ${unchanged} unchanged)`)
  hookChecks.counts = { words, keptEarlier, unchanged, scenarios: Object.keys(dev).length }
  // named cases, in words
  let v = viewer(), m = await mount(HERO_ON, v, { currentSlide: 1 }, texts)
  assert.equal(m.view().reason, null, 'a title slide (hero_slot): available'); assert.equal(m.view().target, 'hero_slot'); assert.equal(m.view().visible, true)
  m.set({ currentSlide: 2 }); await m.settle(); assert.equal(m.view().reason, WORDS, 'a content slide (slide_background): greyed with the words'); assert.equal(m.view().target, 'slide_background'); assert.equal(m.view().visible, true, 'still drawn, only greyed'); assert.equal(v.commands().length, 0, 'nothing is sent')
  m.set({ currentSlide: 4 }); await m.settle(); assert.equal(m.view().reason, null, 'back on a hero slide: available'); m.root.unmount()
  v = viewer({ report: { enabled: true, slides: [] } }); m = await mount(HERO_ON, v, { currentSlide: 2 }, texts); assert.equal(m.view().reason, null, 'a slide the report does not list (target unknown): available, Layout decides'); m.root.unmount()
  v = viewer({ catalogFails: true }); m = await mount(HERO_ON, v, { currentSlide: 2 }, texts); assert.equal(m.view().reason, null, 'a catalog read that failed (target unknown): available'); m.root.unmount()
  v = viewer({ noReport: true }); m = await mount(HERO_ON, v, { currentSlide: 2 }, texts); assert.equal(m.view().reason, 'Replacing a picture is not turned on for this server yet.', 'no backgroundPicture at all: Layout\'s words, not the hero-only ones'); m.root.unmount()
  v = viewer({ entries: { 1: { eligible: false, reason: 'NO_BACKGROUND_PICTURE' } } }); m = await mount(HERO_ON, v, { currentSlide: 2 }, texts); assert.equal(m.view().reason, WORDS, 'a content slide Layout also refuses: the hero-only words (the slide kind is the reason)'); m.root.unmount()
  v = viewer({ entries: { 0: { eligible: false, reason: 'PICTURE_DECLINED' } } }); m = await mount(HERO_ON, v, { currentSlide: 1 }, texts); assert.equal(m.view().reason, 'This slide was designed without a picture, so a new one would not show. Choose another design for it to use a picture.', 'a hero slide Layout refuses keeps Layout\'s own words'); m.root.unmount()
  v = viewer(); m = await mount(HERO_ON, v, { currentSlide: 2, building: true }, texts); assert.equal(m.view().reason, 'A build is running. Replace picture is available when it finishes.', 'a build greys it first, with its own words'); m.root.unmount()
  // the rule is checked again at click time: a hero slide the dialog was opened on turns out to take its picture as a background while the dialog is open
  for (const [env, label, refused] of [[HERO_ON, 'flag on', true], [ON, 'flag off', false]]) {
    v = viewer(); m = await mount(env, v, { currentSlide: 1 }, texts); assert.equal(m.view().reason, null, `${label}: on when the dialog opens`); const id = m.view().slideId
    v.state.heroes = []; m.set({ composeJobs: [{ kind: 'compose', status: 'building' }] }); await m.settle() // a job started: the read is made again, and Layout now files this slide as a background
    assert.equal(m.view().reason, refused ? WORDS : null, `${label}: the re-read lands`)
    const before = v.calls.length, out = await m.view().replace({ slideNumber: 1, slideId: id }, { url: NEW, alt: '' })
    if (refused) {
      deepEqual(out, load(LIB, { env: {}, texts }).unavailableOutcome(WORDS), 'flag on: Replace refuses with the words (code NOT_AVAILABLE, no Try again)'); assert.equal(out.code, 'NOT_AVAILABLE'); assert.equal(out.retry, false)
      assert.equal(v.commands().length, 0, 'nothing is sent'); assert.equal(v.calls.length, before, 'not even a read'); deepEqual(m.probe.begins, [], 'the busy state is not taken'); assert.equal(m.probe.after, 0)
    } else { assert.equal(out.ok, true, 'flag off: the picture goes out, as before'); assert.equal(v.commands().length, 1) }
    m.root.unmount()
  }
  // a hero slide goes through unchanged with the flag on, to the command, with the stored index and Layout's id
  v = viewer(); m = await mount(HERO_ON, v, { currentSlide: 4 }, texts)
  { const out = await m.view().replace({ slideNumber: 4, slideId: m.view().slideId }, { url: NEW, alt: '' }); assert.equal(out.ok, true); deepEqual(v.commands().map(c => c.params), [{ slide_index: 3, slide_id: 'slide_00000004', url: NEW }]); assert.equal(m.probe.released, 1); assert.equal(v.listeners.size, 0) } m.root.unmount()
  // a content slide with the target unknown goes through (Layout decides at click time)
  v = viewer({ report: { enabled: true, slides: [] } }); m = await mount(HERO_ON, v, { currentSlide: 2 }, texts)
  { const out = await m.view().replace({ slideNumber: 2, slideId: m.view().slideId }, { url: NEW, alt: '' }); assert.equal(out.ok, true, 'an unknown target is sent'); assert.equal(v.commands().length, 1) } m.root.unmount()
  // the hook reads the flag through the lib and hands the helper's answer on; the reasons stay in the Replace picture lib
  const src = texts[HOOK] ?? read(HOOK)
  assert.ok(src.includes('heroOnlyReason: heroOnlyReasonFor(eligibility, STUDIO_REPLACE_PICTURE_HERO_ONLY)'), 'the hook asks the helper with the slide\'s eligibility and the flag'); assert.ok(/reasonNow\.current = shownReason/.test(src) && /if \(reasonNow\.current !== null\) return unavailableOutcome\(reasonNow\.current\)/.test(src), 'the reason Replace re-checks is the one the button shows')
}

// ============================================================================================================================================
// C. the control
// ============================================================================================================================================
const noIds = markup => markup.replace(/radix-_R_[A-Za-z0-9]+_/g, 'radix-ID').replace(/_R_[A-Za-z0-9]+_/g, 'ID')
/** A stand-in for the shadcn Dialog that draws its content open, so the dialog's own attributes can be read from server markup. */
const dialogStub = { Dialog: ({ children }) => h('div', { 'data-stub': 'dialog' }, children), DialogContent: ({ children, onEscapeKeyDown, onPointerDownOutside, onInteractOutside, ...rest }) => h('section', rest, children), DialogDescription: ({ children }) => h('p', null, children), DialogFooter: ({ children, ...rest }) => h('footer', rest, children), DialogHeader: ({ children, ...rest }) => h('header', rest, children), DialogTitle: ({ children }) => h('h2', null, children) }
const stubs = { '@/components/ui/dialog': dialogStub }
function controlMarkup(env, texts = {}, props = {}) {
  const C = load(CONTROL, { env, texts, stubs, id: 'control' })
  return noIds(renderToStaticMarkup(h(C.ReplacePictureControl, { reason: null, slideNumber: 2, slideTitle: 'Title', pictureTarget: 'hero_slot', onReplace: async () => ({}), buttonClassName: 'btn', labelClassName: 'lbl', ...props })))
}
function controlChecks(texts = {}) {
  const ATTR = ' data-studio-replace-picture-layer="front"'
  const dev = controlMarkup(ON, { ...texts, ...DEV }), off = controlMarkup(ON, texts)
  assert.ok(dev.includes('data-studio-replace-picture="dialog"') && !dev.includes('data-studio-replace-picture-layer'), 'the stand-in draws the dialog; dev\'s has no layer attribute')
  assert.equal(off, dev, 'flag off: the control\'s markup, dialog included, is dev\'s byte for byte')
  for (const value of ['TRUE', '1', 'yes', '']) assert.equal(controlMarkup({ ...ON, [FLAG]: value }, texts), dev, `the flag ${JSON.stringify(value)} is off: dev's markup`)
  const on = controlMarkup(HERO_ON, texts)
  assert.equal(on.split(ATTR).length, 2, 'flag on: the layer attribute is on the dialog, once'); assert.equal(on.replace(ATTR, ''), dev, 'and that attribute is the only difference')
  assert.ok(/<section[^>]*data-studio-replace-picture="dialog"[^>]*data-studio-replace-picture-layer="front"/.test(on) || /<section[^>]*data-studio-replace-picture-layer="front"[^>]*data-studio-replace-picture="dialog"/.test(on), 'on the dialog itself')
  for (const props of [{ reason: 'A build is running. Replace picture is available when it finishes.' }, { reason: WORDS }, { pictureTarget: 'slide_background' }]) assert.equal(controlMarkup(HERO_ON, texts, props).replace(ATTR, ''), controlMarkup(ON, { ...texts, ...DEV }, props), `the trigger is dev's with the flag on too: ${JSON.stringify(props).slice(0, 50)}`)
  // the source: the attribute is spread only with the flag, the css is imported by the control only, and the lib's flag is the only one it reads
  const src = texts[CONTROL] ?? read(CONTROL)
  assert.ok(src.includes('{...(STUDIO_REPLACE_PICTURE_HERO_ONLY ? { "data-studio-replace-picture-layer": "front" } : {})}'), 'the attribute is spread only when the flag is on')
  assert.ok(src.includes('import "./replace-picture-hero-only.css"') && src.includes('import { STUDIO_REPLACE_PICTURE_HERO_ONLY } from "@/lib/studio-replace-picture-hero-only"'), 'the control imports the css and the flag')
  assert.equal([...src.matchAll(/data-studio-replace-picture-layer/g)].length, 1, 'the attribute is named once')
  assert.ok(!/process\.env/.test(src), 'the control reads no env itself')
}

// ============================================================================================================================================
// D. the css
// ============================================================================================================================================
function cssChecks(texts = {}) {
  const css = texts[CSS] ?? read(CSS), body = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = body.split('}').map(r => r.trim()).filter(Boolean).map(r => { const at = r.indexOf('{'); return { selectors: r.slice(0, at).split(',').map(s => s.trim()), decls: r.slice(at + 1).trim() } })
  assert.ok(rules.length >= 3, 'the rules are there')
  for (const { selectors } of rules) for (const selector of selectors) assert.ok(/\[data-studio-replace-picture-layer="front"\]/.test(selector), `every selector needs the attribute only the flag sets: ${selector}`)
  assert.ok(!/!important/.test(body), 'no !important')
  assert.ok(!/(^|[^-\w])(\*|body|html|:root)\s*[{,]/m.test(body), 'nothing global')
  const decl = (selectorPart, prop) => rules.filter(r => r.selectors.some(s => s.includes(selectorPart))).flatMap(r => [...r.decls.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'g'))].map(m => m[1].trim()))
  // the dialog and its overlay (the dialog's previous sibling) are above the phone overlays (51) and below the toast and the tooltip (100)
  const overlayZ = rules.filter(r => r.selectors.some(s => /^div:has\(\+ \[data-studio-replace-picture-layer="front"\]\)$/.test(s))).flatMap(r => [...r.decls.matchAll(/z-index:\s*(\d+)/g)].map(m => Number(m[1])))
  const dialogZ = decl('[data-studio-replace-picture="dialog"][data-studio-replace-picture-layer="front"]', 'z-index').map(Number).filter(Number.isFinite)
  assert.equal(overlayZ.length, 1, 'the overlay gets one z-index'); assert.equal(dialogZ.length, 1, 'the dialog gets one z-index')
  assert.ok(overlayZ[0] > 51 && overlayZ[0] < 100, 'the overlay is above the phone overlays (51) and below the toast and the tooltip (100)'); assert.ok(dialogZ[0] > overlayZ[0] && dialogZ[0] < 100, 'the dialog is above its overlay and below the toast and the tooltip')
  // no entrance animation while open (the close fade is kept): the rule with animation: none names data-state="open" in every selector
  const noAnim = rules.filter(r => /(^|;)\s*animation\s*:\s*none\s*;?\s*$/.test(r.decls))
  assert.equal(noAnim.length, 1, 'one rule turns the entrance animation off'); assert.ok(noAnim[0].selectors.length === 2 && noAnim[0].selectors.every(s => s.includes('[data-state="open"]')), 'for the overlay and the dialog, and only while open')
  // specificity: the shadcn classes are one class (z-50) and a class + a data-state attribute (the animate-in variant); each of these selectors beats them
  const spec = selector => { const noHas = selector.replace(/:has\(([^)]*)\)/g, ' $1 '); const attrs = (noHas.match(/\[[^\]]+\]/g) || []).length; const els = (noHas.replace(/\[[^\]]+\]/g, '').match(/(^|[\s+>~])[a-z][a-z0-9]*/g) || []).length; return [0, attrs, els] }
  for (const { selectors, decls } of rules) for (const selector of selectors) {
    const [, attrs, els] = spec(selector)
    if (/z-index/.test(decls)) assert.ok(attrs > 1 || els > 0 && attrs >= 1, `${selector}: beats .z-50 (0,1,0)`)
    if (/animation/.test(decls)) assert.ok(attrs >= 3 || (attrs >= 2 && els >= 1), `${selector}: beats the animate-in variant (0,2,0)`)
  }
  // the Replace picture css is dev's, byte for byte (nothing was added to it)
  assert.equal(read(CSS_OLD), baseText(CSS_OLD), 'replace-picture.css is dev\'s'); assert.ok(!(texts[CSS] ?? read(CSS)).includes('replace-picture.css'))
}

// ============================================================================================================================================
// E. only insertions
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
const TEXTS = Object.fromEntries([...APP_FILES, ...NEW_FILES, ...PIN_FILES, ENV, REGISTRY, CSS, VIEWER, AREA, PAGE].map(rel => [rel, read(rel)]))
function insertionChecks(texts = TEXTS, strip = STRIP_FN, edits = EDITS) {
  for (const rel of APP_FILES) {
    const mine = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), mine)
    assert.equal(strip(rel, mine), baseText(rel), `${rel}: without this change's lines the file is dev's, byte for byte`); assert.equal(strip(rel, strip(rel, mine)), baseText(rel), `${rel}: putting back twice changes nothing more`)
    for (const line of diff.added) assert.match(line, MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    assert.deepEqual(diff.removed, [], `${rel}: no base line is lost or rewritten`)
    assert.equal(diff.added.length, edits[rel].length, `${rel}: one marked line per edit`)
    for (const [has, was] of edits[rel]) assert.ok(was === '' && MARKER_RE.test(has) && has.endsWith('\n') && !has.slice(0, -1).includes('\n'), `${rel}: a pair is one marked line and nothing put back`)
  }
  assert.deepEqual(APP_FILES.map(rel => edits[rel].length), [2, 2, 3], 'two marked lines in the Replace picture lib, two in the hook, three in the control')
  assert.equal(strip(APP_FILES[0], 5), 5, 'a text that is not a string comes back as it is'); assert.equal(strip('components/presentation-viewer.tsx', 'x'), 'x', 'a file this change does not own comes back as it is')
  // the marker is a WHOLE token: the Replace picture change's own marker is not this one's, and the other way round
  assert.ok(MARKER_RE.test('// REPLACE-PICTURE-HERO-ONLY') && !MARKER_RE.test('// REPLACE-PICTURE') && !MARKER_RE.test('// X-REPLACE-PICTURE-HERO-ONLY') && !MARKER_RE.test('// REPLACE-PICTURE-HERO-ONLYX'), 'the marker is a whole token')
  assert.ok(replacePictureStrip.REPLACE_PICTURE_MARKER_RE.test('// REPLACE-PICTURE') && !replacePictureStrip.REPLACE_PICTURE_MARKER_RE.test('// REPLACE-PICTURE-HERO-ONLY'), 'and the Replace picture marker does not match this one')
  // the files this change does not touch are dev's: the viewer, the slide area, the Builder page, the Replace picture css, the viewer bridge
  for (const rel of [VIEWER, AREA, PAGE]) assert.equal(registry.stripLaterChanges(rel, texts[rel]), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: through the registry it is dev's`)
  for (const rel of [VIEWER, AREA, PAGE, CSS_OLD]) assert.equal(read(rel), baseText(rel), `${rel}: not touched by this change (byte for byte dev's)`)
  // the older proofs this change teaches: each gains only marked lines and loses none, and is dev's without them
  for (const rel of PIN_FILES) {
    const now = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), now), gained = PIN_EDITS[rel].length
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's lines the proof is dev's, byte for byte`); assert.equal(strip(rel, strip(rel, now)), baseText(rel), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, gained], `${rel}: the proof gains ${gained} marked line(s) and loses none`)
    for (const line of diff.added) assert.ok(line.includes(PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
    for (const [has, was] of PIN_EDITS[rel]) assert.ok(was === '' && has.includes(PIN_MARK) && has.endsWith('\n') && !has.slice(0, -1).includes('\n'), `${rel}: a pin pair is one marked line and nothing put back`)
    for (const line of diff.added.filter(added => added.includes('shas.splice'))) assert.ok(line.includes('^Replace picture hero only:') && !line.includes('^Replace picture:'), `${rel}: the splice names this change's own subject`)
    for (const line of diff.added.filter(added => added.includes('fs.readFileSync = '))) assert.ok(line.includes('stripReplacePictureHeroOnly(rel, out)') && !line.includes('stripLaterChanges') && !line.includes('registry.'), `${rel}: a read hook uses this change's own strip, never the registry`)
  }
  assert.deepEqual([...PIN_FILES].sort(), ['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs', 'scripts/test-studio-replace-picture.mjs'], 'the older proofs this change teaches: the two that read the first-parent line, and the Replace picture proof (it reads the hook, the lib and the control as that change left them)')
  // the secrets of the added lines
  for (const rel of [...APP_FILES, ...NEW_FILES, ENV, REGISTRY]) assert.doesNotMatch(texts[rel] ?? read(rel), SECRET, `${rel}: no secret`)
}
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/

// ============================================================================================================================================
// F. .env.example and the registry
// ============================================================================================================================================
function envChecks(texts = {}, block = ENV_BLOCK) {
  const env = laterEnv(texts[ENV] ?? read(ENV))
  assert.ok(env.endsWith(`\n${block}`), '.env.example ends with the block')
  assert.equal(env.slice(0, env.length - block.length - 1), baseText(ENV), '.env.example is dev\'s file plus that one blank-line-separated block')
  assert.equal((env.match(new RegExp(`^${FLAG}=`, 'gm')) || []).length, 1, `.env.example assigns ${FLAG} once`); assert.match(block, new RegExp(`^${FLAG}="false"$`, 'm'), `${FLAG} is documented as "false"`)
  assert.ok(block.split('\n').filter(line => line && !line.startsWith('#')).length === 1 && block.split('\n').filter(line => line.startsWith('#')).length >= 2 && block.endsWith(`${FLAG}="false"\n`), 'the block is comments and one assignment, which ends it')
  assert.ok(block.includes(WORDS) && block.includes('exact value "true"') && block.includes('default off'), 'the block names the words, the exact value and the default')
  assert.ok(!block.includes('NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE') && !block.includes('NEXT_PUBLIC_STUDIO_V4_SHELL'), 'the block names only its own flag (other proofs count the others\' names in the file)')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes(FLAG), false, 'the registry takes the block out of .env.example'); assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes('STUDIO REPLACE PICTURE HERO ONLY'), false, 'and its comments with it')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env), registry.stripLaterEnvBlocks(ENV, baseText(ENV)), 'read through the registry it is what the registry makes of dev\'s file')
}
const REG_MARK = '// LATER-CHANGE: FRONTEND-1, Replace picture hero slides only'
function registryChecks(text = read(REGISTRY)) {
  const lists = { LATER_CHANGE_FILES: 'REPLACE_PICTURE_HERO_ONLY_SCOPE_FILES', LATER_ENV_BLOCKS: 'REPLACE_PICTURE_HERO_ONLY_ENV_BLOCK', LATER_STRIPS: 'stripReplacePictureHeroOnly' }
  for (const [list, name] of Object.entries(lists)) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n').filter(Boolean), at = rows.findIndex(line => line.includes('studio-replace-picture-hero-only-strip.mjs')), research = rows.findIndex(line => line.includes('studio-research-default-strip.mjs'))
    assert.ok(at > 0, `${list}: this change's line is in the list`); assert.ok(at > research && research > 0, `${list}: it comes after the Research default's line (the last one before it when this was written; a later change's line may follow)`)
    assert.ok(rows[at].includes(`).${name},`), `${list}: the line reads ${name}`); assert.equal((text.slice(start, end).match(/studio-replace-picture-hero-only-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
    assert.ok(rows[at].includes(REG_MARK) && /(?<![\w-])LATER-CHANGE(?![\w-])/.test(rows[at]), `${list}: the line carries the registry marker`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-replace-picture-hero-only-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines')
  const diff = lineDiff(baseText(REGISTRY), text)
  assert.deepEqual(diff.removed, [], 'and loses none'); assert.ok(registered.every(line => diff.added.includes(line)), 'and the three are among the lines it adds')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the block is registered'); assert.ok([...SCOPE].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  assert.ok(registry.LATER_STRIPS.indexOf(STRIP_FN) > registry.LATER_STRIPS.indexOf(researchDefaultStrip.stripResearchDefault) && registry.LATER_STRIPS.indexOf(researchDefaultStrip.stripResearchDefault) > registry.LATER_STRIPS.indexOf(replacePictureStrip.stripReplacePicture), 'the strip runs after the Research default\'s and the Replace picture\'s (the order the changes were stacked)')
  assert.ok(registry.LATER_ENV_BLOCKS.indexOf(ENV_BLOCK) > registry.LATER_ENV_BLOCKS.indexOf(researchDefaultStrip.RESEARCH_DEFAULT_ENV_BLOCK), 'and its block follows the Research default\'s')
  // an older proof that holds an app file to dev's reads it through the registry: it is dev's
  for (const rel of [...APP_FILES, ...PIN_FILES]) assert.equal(registry.stripLaterChanges(rel, read(rel)), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is dev's (older proofs read it like that)`)
  // the neighbouring changes' strips leave each other's lines alone, in either order
  for (const rel of [...APP_FILES, PAGE, VIEWER, AREA, ...PIN_FILES]) {
    const now = read(rel), a = STRIP_FN(rel, replacePictureStrip.stripReplacePicture(rel, researchDefaultStrip.stripResearchDefault(rel, now))), b = replacePictureStrip.stripReplacePicture(rel, researchDefaultStrip.stripResearchDefault(rel, STRIP_FN(rel, now)))
    assert.equal(a, b, `${rel}: the strips commute`)
  }
  assert.ok(STRIP_FN(PAGE, read(PAGE)).includes('REPLACE-PICTURE') && STRIP_FN(PAGE, read(PAGE)).includes('RESEARCH-DEFAULT'), 'this strip leaves the page\'s other changes\' lines alone'); assert.equal(replacePictureStrip.stripReplacePicture(HOOK, read(HOOK)), read(HOOK), 'the Replace picture strip leaves the hook alone (this change\'s lines are marked REPLACE-PICTURE-HERO-ONLY)')
}

// ============================================================================================================================================
// G. scope, commits, secrets
// ============================================================================================================================================
const subjectOf = commit => git('log', '-1', '--format=%s', commit)
/** This change's commits: on the first-parent line, by the subject prefix. Once the gate has merged the branch they sit on the merge's second parent and the first-parent line has none: then there is nothing of its own to read and the proof says so. */
const ownCommits = (...args) => git('rev-list', '--no-merges', ...args, `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter(commit => subjectOf(commit).startsWith(SUBJECT))
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body) { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line'); if (!/layering|z-index|fade|animat/i.test(body)) problems.push('the root cause of the dialog layering'); return problems }
function commitChecks() {
  const commits = ownCommits('--first-parent')
  if (commits.length === 0) { console.log('NOTE scope: no commit of this change on the first-parent line (merged into dev: its commits are on the second parent); the strip, source and registry checks above cover the files'); return }
  scopeCheck(commits)
  for (const commit of commits) {
    assert.deepEqual(messageProblems(subjectOf(commit), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
    assert.doesNotMatch(git('show', '--format=%B', commit), SECRET, `commit ${commit.slice(0, 8)}: no secret in the message or the diff`)
    const added = git('show', '--format=', '-U0', commit).split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')); for (const line of added) assert.doesNotMatch(line, SECRET, `commit ${commit.slice(0, 8)}: no secret in an added line`)
  }
  // nothing the commits touch is a file of another change's that the registry does not name
  assert.deepEqual([...touchedFiles(commits)].filter(rel => !registry.LATER_CHANGE_FILES.has(rel)), [], 'every file the commits touch is registered')
}

// ============================================================================================================================================
// H. one literal read
// ============================================================================================================================================
function oneReadChecks(texts = {}) {
  for (const rel of git('ls-files', 'app', 'hooks', 'components', 'lib', 'middleware.ts', 'next.config.mjs').split('\n').filter(Boolean).filter(f => /\.(ts|tsx|mjs|js)$/.test(f))) {
    const text = texts[rel] ?? read(rel)
    for (const [file] of LIB_FLAGS) if (rel === file) assert.equal((text.match(new RegExp(`process\\.env\\.${FLAG}\\b`, 'g')) || []).length, 1, `${rel}: reads ${FLAG} once`); else assert.equal((text.match(new RegExp(`process\\.env\\.${FLAG}\\b`, 'g')) || []).length, 0, `${rel}: does not read ${FLAG} itself`)
  }
  for (const rel of git('grep', '-l', '-e', 'STUDIO_REPLACE_PICTURE_HERO_ONLY', '--', 'app', 'hooks', 'components', 'lib').split('\n').filter(Boolean)) assert.ok([HERO, HOOK, CONTROL, CSS].includes(rel), `${rel}: only the lib, the hook, the control and the css (in a comment) name the flag`)
  const lib = texts[HERO] ?? read(HERO); assert.equal((lib.match(/process\.env\.[A-Z]/g) || []).length, 1, 'the lib reads one env name')
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
await check('A. the lib: the flag on for the exact string "true" and nothing else; the helper\'s table; the words; the reason order in replacePictureDisabledReason', () => libChecks())
await check('B. the REAL hook: flag off is dev\'s hook event for event (hashed); flag on differs only in the reason of a known slide_background; unknown stays available; rechecked at click time', () => hookChecks())
await check('C. the control: flag off its markup is dev\'s byte for byte; flag on one data attribute on the dialog', () => controlChecks())
await check('D. the css: every rule needs the attribute; z-index between the phone overlays and the toast; no entrance animation while open', () => cssChecks())
await check('E. only insertions: the strip gives dev\'s files byte for byte; the older proofs taught; the viewer, the slide area and the page are dev\'s', () => insertionChecks())
await check('F1. .env.example: one block at the end, "false", dev\'s file plus the block', () => envChecks(TEXTS))
await check('F2. the registry: three lines after the Research default\'s, each marked LATER-CHANGE; the strips commute', () => registryChecks())
await check('G. own-commit scope by the subject prefix on the first-parent line (a NOTE once merged); the commit message; secrets', () => commitChecks())
await check('H. the flag is read from one literal env name, and only the lib reads it', () => oneReadChecks())

// ---- I. mutants -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const T = { [HERO]: read(HERO), [LIB]: read(LIB), [HOOK]: read(HOOK), [CONTROL]: read(CONTROL), [CSS]: read(CSS), [ENV]: TEXTS[ENV], [REGISTRY]: TEXTS[REGISTRY] }
const M = (rel, from, to) => ({ [rel]: swap(T[rel], from, to) })
const lineOf = (rel, needle) => { const hits = T[rel].split('\n').filter(line => line.includes(needle)); assert.equal(hits.length, 1, `exactly one line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] + '\n' }
const L_IFACE = lineOf(LIB, 'heroOnlyReason?: string | null // REPLACE-PICTURE-HERO-ONLY'), L_CHECK = lineOf(LIB, "if (typeof a.heroOnlyReason === 'string'")
const L_HOOK_IMPORT = lineOf(HOOK, "from '@/lib/studio-replace-picture-hero-only'"), L_HOOK_FIELD = lineOf(HOOK, 'heroOnlyReason: heroOnlyReasonFor(')
const L_CTRL_ATTR = lineOf(CONTROL, '...(STUDIO_REPLACE_PICTURE_HERO_ONLY ?')
const fullMutants = [
  // the flag and the helper
  ['lib: the flag is on for any non-empty value', M(HERO, "return value === 'true'", "return typeof value === 'string' && value !== ''"), libChecks],
  ['lib: the flag is case-insensitive', M(HERO, "return value === 'true'", "return value?.toLowerCase() === 'true'"), libChecks],
  ['lib: the flag is read from another env name', M(HERO, 'process.env.NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY', 'process.env.NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO'), libChecks],
  ['lib: the words are changed', M(HERO, "'Pictures can be replaced on title, section and closing slides.'", "'Pictures can be replaced on title and section slides.'"), libChecks],
  ['lib: the helper ignores the flag', M(HERO, '  if (enabled !== true) return null\n', ''), libChecks],
  ['lib: the helper also greys hero_slot', M(HERO, "eligibility.target === 'slide_background'", "eligibility.target !== null"), libChecks],
  ['lib: the helper greys an unknown target', M(HERO, "eligibility && eligibility.state === 'known' && eligibility.target === 'slide_background'", "!eligibility || eligibility.state !== 'known' || eligibility.target === 'slide_background'"), libChecks],
  ['lib: the helper acts on a slide whose state is not known', M(HERO, "eligibility && eligibility.state === 'known' && eligibility.target === 'slide_background'", "eligibility && eligibility.target === 'slide_background'"), libChecks],
  ['lib: the helper only greys an eligible slide', M(HERO, "eligibility.state === 'known' && eligibility.target === 'slide_background') return", "eligibility.state === 'known' && eligibility.eligible && eligibility.target === 'slide_background') return"), libChecks],
  ['lib: the helper reads the flag from the env', M(HERO, '  if (enabled !== true) return null\n', '  if (!STUDIO_REPLACE_PICTURE_HERO_ONLY) return null\n'), libChecks],
  // replacePictureDisabledReason
  ['lib: the words come before the build\'s reason', { [LIB]: swap(swap(T[LIB], L_CHECK, ''), "  if (a.readOnly === 'view-only') return REPLACE_PICTURE_REASONS.viewOnly\n", L_CHECK + "  if (a.readOnly === 'view-only') return REPLACE_PICTURE_REASONS.viewOnly\n") }, libChecks],
  ['lib: the words come after Layout\'s own answer', { [LIB]: swap(swap(T[LIB], L_CHECK, ''), "  if (a.eligibility.state === 'loading') return REPLACE_PICTURE_REASONS.checking\n", "  if (a.eligibility.state === 'loading') return REPLACE_PICTURE_REASONS.checking\n" + L_CHECK) }, libChecks],
  ['lib: the words come after the not-on-yet answer', { [LIB]: swap(swap(T[LIB], L_CHECK, ''), "  if (a.eligibility.state === 'absent') return REPLACE_PICTURE_REASONS.notOnYet\n", "  if (a.eligibility.state === 'absent') return REPLACE_PICTURE_REASONS.notOnYet\n" + L_CHECK) }, libChecks],
  ['lib: the words come before a placeholder\'s reason', { [LIB]: swap(swap(T[LIB], L_CHECK, ''), '  if (a.placeholderOnScreen) return REPLACE_PICTURE_REASONS.placeholder\n', L_CHECK + '  if (a.placeholderOnScreen) return REPLACE_PICTURE_REASONS.placeholder\n') }, libChecks],
  ['lib: an empty string is taken as the words', M(LIB, "typeof a.heroOnlyReason === 'string' && a.heroOnlyReason !== ''", "typeof a.heroOnlyReason === 'string'"), libChecks],
  ['lib: any truthy value is taken as the words', M(LIB, "typeof a.heroOnlyReason === 'string' && a.heroOnlyReason !== ''", 'a.heroOnlyReason'), libChecks],
  ['lib: the words are a literal in the Replace picture lib, not the helper\'s', M(LIB, 'return a.heroOnlyReason // REPLACE-PICTURE-HERO-ONLY', "return 'Pictures cannot be replaced here.' // REPLACE-PICTURE-HERO-ONLY"), libChecks],
  // the hook
  ['hook: the helper\'s answer is not handed on', { [HOOK]: swap(T[HOOK], L_HOOK_FIELD, '') }, hookChecks],
  ['hook: the rule is always on (the flag constant is replaced by true)', M(HOOK, 'heroOnlyReasonFor(eligibility, STUDIO_REPLACE_PICTURE_HERO_ONLY)', 'heroOnlyReasonFor(eligibility, true)'), hookChecks],
  ['hook: the rule is always off', M(HOOK, 'heroOnlyReasonFor(eligibility, STUDIO_REPLACE_PICTURE_HERO_ONLY)', 'heroOnlyReasonFor(eligibility, false)'), hookChecks],
  ['hook: the rule reads the wrong eligibility', M(HOOK, 'heroOnlyReasonFor(eligibility, STUDIO_REPLACE_PICTURE_HERO_ONLY)', "heroOnlyReasonFor({ state: 'unknown' }, STUDIO_REPLACE_PICTURE_HERO_ONLY)"), hookChecks],
  ['hook: the reason is not checked again when Replace is pressed', M(HOOK, '    if (reasonNow.current !== null) return unavailableOutcome(reasonNow.current)\n', ''), hookChecks],
  ['hook: the re-check ignores the rule (it holds the reason without it)', M(HOOK, '  reasonNow.current = shownReason\n', '  reasonNow.current = null\n'), hookChecks],
  ['hook: the rule follows the Replace picture switch, not its own flag', M(HOOK, 'heroOnlyReasonFor(eligibility, STUDIO_REPLACE_PICTURE_HERO_ONLY)', 'heroOnlyReasonFor(eligibility, input.enabled)'), hookChecks],
  // the control
  ['control: the layer attribute is always set', M(CONTROL, '{...(STUDIO_REPLACE_PICTURE_HERO_ONLY ? { "data-studio-replace-picture-layer": "front" } : {})}', '{...{ "data-studio-replace-picture-layer": "front" }}'), controlChecks],
  ['control: the layer attribute is set only with the flag off', M(CONTROL, '{...(STUDIO_REPLACE_PICTURE_HERO_ONLY ? { "data-studio-replace-picture-layer": "front" } : {})}', '{...(!STUDIO_REPLACE_PICTURE_HERO_ONLY ? { "data-studio-replace-picture-layer": "front" } : {})}'), controlChecks],
  ['control: the attribute is gone', { [CONTROL]: swap(T[CONTROL], L_CTRL_ATTR, '') }, controlChecks],
  ['control: the attribute has another value', M(CONTROL, '"data-studio-replace-picture-layer": "front"', '"data-studio-replace-picture-layer": "back"'), controlChecks],
  ['control: the css is not imported', M(CONTROL, 'import "./replace-picture-hero-only.css" // REPLACE-PICTURE-HERO-ONLY\n', ''), controlChecks],
  ['control: the control reads the env itself', M(CONTROL, 'import { STUDIO_REPLACE_PICTURE_HERO_ONLY } from "@/lib/studio-replace-picture-hero-only" // REPLACE-PICTURE-HERO-ONLY', 'const STUDIO_REPLACE_PICTURE_HERO_ONLY = process.env.NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY === "true" // REPLACE-PICTURE-HERO-ONLY'), controlChecks],
  ['control: the trigger is changed with the flag on', M(CONTROL, 'data-studio-replace-picture="trigger"', 'data-studio-replace-picture="trigger" data-hero-only={STUDIO_REPLACE_PICTURE_HERO_ONLY ? "on" : undefined}'), controlChecks],
  // the css
  ['css: the dialog rule loses the attribute', M(CSS, '[data-studio-replace-picture="dialog"][data-studio-replace-picture-layer="front"] { z-index: 91; }', '[data-studio-replace-picture="dialog"] { z-index: 91; }'), cssChecks],
  ['css: the overlay rule reaches every div', M(CSS, 'div:has(+ [data-studio-replace-picture-layer="front"]) { z-index: 90; }', 'div { z-index: 90; }'), cssChecks],
  ['css: the dialog is above the toast', M(CSS, '{ z-index: 91; }', '{ z-index: 200; }'), cssChecks],
  ['css: the overlay is below the phone overlays', M(CSS, '{ z-index: 90; }', '{ z-index: 40; }'), cssChecks],
  ['css: the dialog is below its overlay', M(CSS, '{ z-index: 91; }', '{ z-index: 89; }'), cssChecks],
  ['css: the entrance animation stays on', { [CSS]: swap(T[CSS], '{ animation: none; }', '{ opacity: 1; }') }, cssChecks],
  ['css: the animation is off for the close fade too', M(CSS, 'div[data-state="open"]:has(+ [data-studio-replace-picture-layer="front"]),\n[data-studio-replace-picture="dialog"][data-studio-replace-picture-layer="front"][data-state="open"] { animation: none; }', 'div:has(+ [data-studio-replace-picture-layer="front"]),\n[data-studio-replace-picture="dialog"][data-studio-replace-picture-layer="front"] { animation: none; }'), cssChecks],
  ['css: !important', M(CSS, '{ z-index: 91; }', '{ z-index: 91 !important; }'), cssChecks],
  ['css: a global rule', { [CSS]: T[CSS] + '.fixed { z-index: 91; }\n' }, cssChecks],
  ['css: too weak to beat the shadcn z-50 (a class selector)', M(CSS, '[data-studio-replace-picture="dialog"][data-studio-replace-picture-layer="front"] { z-index: 91; }', '[data-studio-replace-picture-layer="front"] { z-index: 91; }'), cssChecks],
  // .env.example, the registry
  ['env: the block is gone', { [ENV]: swap(T[ENV], '\n' + ENV_BLOCK, '') }, envChecks],
  ['env: the flag is documented "true"', { [ENV]: swap(T[ENV], `${FLAG}="false"`, `${FLAG}="true"`) }, envChecks],
  ['env: the block is not at the end', { [ENV]: swap(T[ENV], '\n' + ENV_BLOCK, '') + '\nSOMETHING_ELSE="x"\n' }, envChecks],
  ['env: a second assignment', { [ENV]: T[ENV] + `${FLAG}="false"\n` }, envChecks],
]
for (const [label, texts, fn] of fullMutants) await mutant(label, () => fn(texts))
{ const named = swap(ENV_BLOCK, '# Also on:', '# NEXT_PUBLIC_STUDIO_V4_SHELL. Also on:'); await mutant('env: the block names another change\'s flag', () => envChecks({ [ENV]: swap(T[ENV], ENV_BLOCK, named) }, named)) }
const ownLine = name => T[REGISTRY].split('\n').find(line => line.includes('studio-replace-picture-hero-only-strip.mjs') && line.includes(name)) + '\n'
const researchLine = name => T[REGISTRY].split('\n').find(line => line.includes('studio-research-default-strip.mjs') && line.includes(name)) + '\n'
await mutant('registry: the files line is gone', () => registryChecks(swap(T[REGISTRY], ownLine('REPLACE_PICTURE_HERO_ONLY_SCOPE_FILES'), '')))
await mutant('registry: the env line is gone', () => registryChecks(swap(T[REGISTRY], ownLine('REPLACE_PICTURE_HERO_ONLY_ENV_BLOCK'), '')))
await mutant('registry: the strip line is gone', () => registryChecks(swap(T[REGISTRY], ownLine('stripReplacePictureHeroOnly'), '')))
await mutant('registry: the strip line has no LATER-CHANGE marker', () => registryChecks(swap(T[REGISTRY], ownLine('stripReplacePictureHeroOnly'), ownLine('stripReplacePictureHeroOnly').replace('LATER-CHANGE', 'LATER'))))
await mutant('registry: the files line sits before the Research default\'s', () => registryChecks(swap(swap(T[REGISTRY], ownLine('REPLACE_PICTURE_HERO_ONLY_SCOPE_FILES'), ''), researchLine('RESEARCH_DEFAULT_SCOPE_FILES'), ownLine('REPLACE_PICTURE_HERO_ONLY_SCOPE_FILES') + researchLine('RESEARCH_DEFAULT_SCOPE_FILES'))))
await mutant('registry: the strip line sits before the Research default\'s', () => registryChecks(swap(swap(T[REGISTRY], ownLine('stripReplacePictureHeroOnly'), ''), researchLine('stripResearchDefault'), ownLine('stripReplacePictureHeroOnly') + researchLine('stripResearchDefault'))))
await mutant('registry: a base line is lost', () => registryChecks(swap(T[REGISTRY], researchLine('RESEARCH_DEFAULT_ENV_BLOCK'), '')))
await mutant('registry: a fourth line', () => registryChecks(swap(T[REGISTRY], '  // one line per later change, above this comment\n])\n\nexport const LATER_ENV_BLOCKS', ownLine('REPLACE_PICTURE_HERO_ONLY_SCOPE_FILES').replace('SCOPE_FILES', 'SCOPE_FILES_2') + '  // one line per later change, above this comment\n])\n\nexport const LATER_ENV_BLOCKS')))
// the strips and the insertions
const TX = (rel, from, to) => ({ ...TEXTS, [rel]: swap(TEXTS[rel], from, to) })
await mutant('insertion: a marked line loses its marker', () => insertionChecks(TX(HOOK, 'heroOnlyReason: heroOnlyReasonFor(eligibility, STUDIO_REPLACE_PICTURE_HERO_ONLY), // REPLACE-PICTURE-HERO-ONLY', 'heroOnlyReason: heroOnlyReasonFor(eligibility, STUDIO_REPLACE_PICTURE_HERO_ONLY), // x')))
await mutant('insertion: a base line of the hook is rewritten', () => insertionChecks(TX(HOOK, 'const shownReason = input.enabled ? reason : null', 'const shownReason = input.enabled ? reason ?? null : null')))
await mutant('insertion: a base line of the control is lost', () => insertionChecks(TX(CONTROL, '          data-phase={phase}\n', '')))
await mutant('insertion: an unmarked line is added to the Replace picture lib', () => insertionChecks(TX(LIB, '  if (a.mutationPending) return REPLACE_PICTURE_REASONS.mutating\n', '  if (a.mutationPending) return REPLACE_PICTURE_REASONS.mutating\n  if (a.extra) return null\n')))
await mutant('insertion: the strip forgets a pair', () => insertionChecks(TEXTS, STRIP_FN, { ...EDITS, [HOOK]: EDITS[HOOK].slice(1) }))
await mutant('insertion: a pair puts back non-empty text', () => insertionChecks(TEXTS, STRIP_FN, { ...EDITS, [HOOK]: EDITS[HOOK].map(([has]) => [has, 'x\n']) }))
await mutant('insertion: the viewer is touched', () => insertionChecks({ ...TEXTS, [VIEWER]: TEXTS[VIEWER] + '// REPLACE-PICTURE-HERO-ONLY\n' }))
await mutant('insertion: the page is touched', () => insertionChecks({ ...TEXTS, [PAGE]: TEXTS[PAGE] + '// x\n' }))
await mutant('insertion: a splice line names the other subject', () => insertionChecks(TX('scripts/test-studio-chat-element-edit.mjs', '!/^Replace picture hero only:/', '!/^Replace picture:/')))
await mutant('insertion: a splice line is gone from a taught proof', () => insertionChecks({ ...TEXTS, 'scripts/test-studio-deck-sync-truth.mjs': TEXTS['scripts/test-studio-deck-sync-truth.mjs'].split('\n').filter(line => !line.includes('^Replace picture hero only:')).join('\n') }))
await mutant('insertion: the Replace picture proof\'s read hook uses the registry', () => insertionChecks(TX('scripts/test-studio-replace-picture.mjs', 'stripReplacePictureHeroOnly(rel, out) : out', 'registry.stripLaterChanges(rel, out) : out')))
await mutant('insertion: a taught proof loses a base line', () => insertionChecks(TX('scripts/test-studio-chat-element-edit.mjs', "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Chat parity/.test(git('log', '-1', '--format=%s', sha)))) // stacked after #475", "  // stacked after #475")))
await mutant('insertion: a secret in the lib', () => insertionChecks({ ...TEXTS, [HERO]: TEXTS[HERO] + `// ${['sk', 'abcdefghijklmnopqrstuvwxyz0123'].join('-')}\n` }))
// the commits
await mutant('commit: no co-author line', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'a body about the layering fade\n'), []))
await mutant('commit: the wrong subject', () => assert.deepEqual(messageProblems('Replace picture: x', 'layering fade\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))
await mutant('commit: no root cause in the body', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'a body\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))
await mutant('scope: a stray file', () => { scopeCheck(ownCommits('--first-parent'), ['components/builder/message-list.tsx']) })
// a mutant that must be caught by the one-literal-read check
await mutant('reads: another file reads the flag', () => oneReadChecks({ [PAGE]: TEXTS[PAGE] + "\nconst x = process.env.NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY\n" }))
await mutant('reads: the lib reads it twice', () => oneReadChecks({ [HERO]: T[HERO] + "\nexport const again = process.env.NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY === 'true'\n" }))

const verdict = failed.length > 0 || missed.length > 0 ? 1 : passed === 0 ? 1 : 0
console.log(`${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (hookChecks.digest && hookChecks.counts) console.log(`flag-off transcript digest (dev's hook = this hook, ${hookChecks.counts.scenarios} scenarios): sha256 ${hookChecks.digest}...; flag-on: ${hookChecks.counts.words} greyed by the rule, ${hookChecks.counts.keptEarlier} kept by an earlier state, ${hookChecks.counts.unchanged} unchanged`)
if (passed === 0 && failed.length === 0) console.error('NO CHECK RAN: 0 checks passed (does CHECK_ONLY match the label of a check?)')
if (failed.length) console.error(`FAILED: ${failed.join(' | ')}`)
if (missed.length) console.error(`MISSED: ${missed.join(' | ')}`)
process.exit(verdict)
