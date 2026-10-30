// FRONTEND-1 (PK's UAT feedback F-06, F-08, F-09, 30 Oct): proof of NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT (exact "true", default off, build-time).
//
//   F-08  the outline card in the chat (components/builder/chat/studio-outline-card.tsx) no longer lists the slides; Director's one-line message and its buttons are other components and are not touched.
//   F-09  chat clean's Plan / Outline / Build / Check / Package job card is gone from the chat (components/builder/chat/studio-chat-clean.tsx), and the presence row's Build log is replaced, while a build is narrated,
//         by ONE quiet status line, phase words and an elapsed clock ("Drafting your outline… 0:18"), shown only while the stage is hidden.
//   F-06  "Waiting for your go-ahead" is not shown when Director's build_phase said auto_proceed === true for this build. Studio never presses approve.
//
//   1. The lib, function by function: the flag, the elapsed clock, the line's decision table, auto_proceed, the outline model.
//   2. F-08, the REAL card: flag off is the base card's markup for every variant; flag on keeps the base's own words and drops the slide list.
//   3. F-09, the REAL chat clean tail: flag off is the base's markup; flag on draws no job card, keeps the notes and Director's ordinary status line.
//   4. F-09, the REAL status line on the offline React host: the words, the clock that ticks, nothing once the stage is open, nothing at the go-ahead gate when Director builds on by itself.
//   5. F-06, the REAL hook beside chat clean's: the handler is wrapped once and stays wrapped across commits, in either order; auto_proceed is kept per build and per session.
//   6. The page: the slot is a ternary around the presence row, "stage open" is ONE marked line, the hook comes after chat clean's, FRONTEND-2's spots and the outline canvas are untouched.
//   7. Mutants: each must be caught.
//   8. The sources: every marked line is a pure insertion, the strip gives the base back byte for byte, the registry, .env.example, and the scope over the COMMITTED diff (BASE..HEAD; the own commits are found by SUBJECT).
//
//   node scripts/test-studio-strawman-chat.mjs
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed; the loader's clock is a fake one); git is read only for 8.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

setTimeout(() => { process.stderr.write('[watchdog] test-studio-strawman-chat stalled for 240 s; exit 124\n'); process.exit(124) }, Number(process.env.STUDIO_PROOF_TRACE_WATCHDOG_MS) || 240_000).unref()

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const FLAG = 'NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT'
const LIB = 'lib/studio-strawman-chat.ts'
const COMP = 'components/builder/chat/studio-strawman-chat.tsx'
const HOOK = 'hooks/use-studio-strawman-chat.ts'
const CARD = 'components/builder/chat/studio-outline-card.tsx'
const JOB = 'components/builder/chat/studio-chat-clean.tsx'
const PAGE = 'app/builder/page.tsx'
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')
let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}

const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { installHostNetworkGuard } = await import('./studio-chat-harness/fake-env.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { Root, textOf, toElements } = await import('./studio-chat-harness/mini-react.mjs')
const { esmPackages, lucideStub } = await import('./studio-chat-harness/esm-packages.mjs')
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-strawman-chat-strip.mjs')
const { stripStrawmanChat, BASE_COMMIT, STRAWMAN_CHAT_FILES, STRAWMAN_CHAT_NEW_FILES, STRAWMAN_CHAT_SCOPE_FILES, STRAWMAN_CHAT_ENV_BLOCK, STRAWMAN_CHAT_SUBJECT, STRAWMAN_CHAT_MARKER_RE, STRAWMAN_CHAT_PIN_EDITS } = stripModule
const release = installHostNetworkGuard(net, dns)
const macrotask = () => new Promise(resolve => setImmediate(resolve))
const plain = value => JSON.parse(JSON.stringify(value)) // values built inside the loader's vm have their own prototypes
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)

// ---- the lib, evaluated in THIS realm with a fake process -----------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function loadLib(text = read(LIB), env = { [FLAG]: 'true' }) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, LIB))(module, module.exports, () => { throw new Error('the lib must stay import-free') }, { env })
  return module.exports
}

// ============================================================================================================================================
// 1. The lib
// ============================================================================================================================================
const T0 = Date.UTC(2026, 9, 30, 12, 0, 0)
function libChecks(libText = read(LIB)) {
  const lib = loadLib(libText)
  // -- the flag --------------------------------------------------------------------------------------------------------------------------
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['', false], ['yes', false], ['true', true]]) assert.equal(lib.strawmanChatFlagOn(value), want, `flag ${JSON.stringify(value)}`)
  assert.equal(loadLib(libText, {}).STUDIO_STRAWMAN_CHAT_ENABLED, false, 'unset: off')
  assert.equal(loadLib(libText, { [FLAG]: 'true' }).STUDIO_STRAWMAN_CHAT_ENABLED, true, '"true": on')
  assert.equal(loadLib(libText, { [FLAG]: 'on' }).STUDIO_STRAWMAN_CHAT_ENABLED, false, '"on": off')
  // -- the elapsed clock (the stage ribbon's arithmetic) -------------------------------------------------------------------------------------
  const elapsed = lib.strawmanChatElapsed
  assert.equal(elapsed(T0, T0), '0:00'); assert.equal(elapsed(T0, T0 + 18_000), '0:18'); assert.equal(elapsed(T0, T0 + 18_999), '0:18', 'whole seconds, rounded down')
  assert.equal(elapsed(T0, T0 + 65_000), '1:05'); assert.equal(elapsed(T0, T0 + 59_000), '0:59'); assert.equal(elapsed(T0, T0 + 60_000), '1:00'); assert.equal(elapsed(T0, T0 + 75 * 60_000 + 3_000), '75:03')
  assert.equal(elapsed(T0 + 5_000, T0), '0:00', 'a start in the future is zero, never negative')
  for (const start of [null, undefined, Number.NaN, Infinity, '5']) assert.equal(elapsed(start, T0), null, `no usable start: ${String(start)}`)
  assert.equal(elapsed(T0, Number.NaN), null)
  // -- the line's decision table ---------------------------------------------------------------------------------------------------------
  const base = { enabled: true, active: true, phase: 'planning', control: 'running', startedAt: T0, now: T0 + 18_000, stageOpen: false, autoProceed: false, heldCovered: false }
  const line = over => plain(lib.strawmanChatLine({ ...base, ...over }))
  const text = over => { const l = lib.strawmanChatLine({ ...base, ...over }); return l === null ? null : lib.strawmanChatLineText(l) }
  assert.deepEqual(line({}), { words: 'Drafting your outline…', elapsed: '0:18', running: true }, 'the first words PK named')
  assert.equal(text({}), 'Drafting your outline… 0:18')
  assert.equal(text({ phase: 'strawman' }), 'Shaping your outline… 0:18'); assert.equal(text({ phase: 'building' }), 'Building your slides… 0:18')
  assert.equal(text({ phase: 'qa' }), 'Checking your slides… 0:18'); assert.equal(text({ phase: 'finalizing' }), 'Packaging your deck… 0:18')
  assert.equal(text({ now: T0 + 83_000 }), 'Drafting your outline… 1:23', 'the clock moves with now')
  assert.equal(text({ startedAt: null }), 'Drafting your outline…', 'no start: the words alone')
  assert.deepEqual(line({ startedAt: null }), { words: 'Drafting your outline…', elapsed: null, running: true })
  // nothing: off, not narrated, the stage open, over, failed, unknown
  assert.equal(text({ enabled: false }), null, 'flag off'); assert.equal(text({ active: false }), null, 'nothing narrated'); assert.equal(text({ stageOpen: true }), null, 'the stage is open: the chat says nothing')
  for (const phase of ['idle', 'complete', 'error', 'nonsense', '']) assert.equal(text({ phase }), null, `phase ${JSON.stringify(phase)}`)
  for (const phase of ['planning', 'strawman', 'awaiting_user', 'building', 'qa', 'finalizing', 'paused', 'stopped']) for (const control of ['running', 'paused', 'stopped', 'stop_requested', 'pause_requested', 'resume_requested']) assert.equal(text({ phase, control, stageOpen: true, autoProceed: true }), null, `stage open: ${phase}/${control} says nothing`)
  // F-06: the go-ahead gate
  assert.equal(text({ phase: 'awaiting_user' }), 'Waiting for your go-ahead', 'the gate without auto_proceed: the existing words, no clock')
  assert.deepEqual(line({ phase: 'awaiting_user' }), { words: 'Waiting for your go-ahead', elapsed: null, running: false })
  assert.equal(text({ phase: 'awaiting_user', autoProceed: true }), null, 'Director builds on by itself: no go-ahead line')
  assert.equal(text({ phase: 'planning', autoProceed: true }), 'Drafting your outline… 0:18', 'auto_proceed hides only the go-ahead line')
  assert.equal(text({ phase: 'building', autoProceed: true }), 'Building your slides… 0:18')
  // a held build: said by a bar when one is up, else in two words
  assert.equal(text({ phase: 'paused', control: 'paused' }), 'Paused'); assert.equal(text({ phase: 'stopped', control: 'stopped' }), 'Stopped')
  assert.equal(text({ phase: 'building', control: 'paused' }), 'Paused', 'the control state decides (a late "building" status on a paused build)'); assert.equal(text({ phase: 'building', control: 'stopped' }), 'Stopped')
  assert.equal(text({ phase: 'stopped', control: 'running' }), 'Stopped'); assert.equal(text({ phase: 'paused', control: 'running' }), 'Paused')
  assert.equal(text({ phase: 'stopped', control: 'paused' }), 'Paused', 'paused control wins over a stopped phase (chat clean\'s own rule)')
  for (const args of [{ phase: 'paused', control: 'paused' }, { phase: 'stopped', control: 'stopped' }, { phase: 'building', control: 'stopped' }]) assert.equal(text({ ...args, heldCovered: true }), null, `held and covered by a bar: ${JSON.stringify(args)}`)
  assert.deepEqual(line({ phase: 'paused', control: 'paused' }), { words: 'Paused', elapsed: null, running: false })
  // a control request on its way
  assert.equal(text({ phase: 'building', control: 'stop_requested' }), 'Stopping…'); assert.equal(text({ phase: 'building', control: 'pause_requested' }), 'Pausing…'); assert.equal(text({ phase: 'paused', control: 'resume_requested' }), 'Resuming…')
  assert.equal(text({ phase: 'building', control: 'stop_requested', heldCovered: true }), 'Stopping…', 'a request on its way is not a held state')
  assert.deepEqual(line({ phase: 'building', control: 'stop_requested' }), { words: 'Stopping…', elapsed: null, running: false })
  // -- F-06: what Studio remembers of auto_proceed ----------------------------------------------------------------------------------------------
  const none = lib.STRAWMAN_CHAT_NO_AUTO_PROCEED, step = lib.strawmanChatAutoProceedStep, auto = lib.strawmanChatAutoProceedFor
  assert.deepEqual(plain(none), { buildId: null, autoProceed: false }); assert.ok(Object.isFrozen(none), 'the initial state is frozen')
  const frame = (build_id, auto_proceed, phase = 'building') => ({ build_id, phase, label: 'x', ...(auto_proceed === undefined ? {} : { auto_proceed }) })
  const s1 = step(none, frame('b1', true), 'S', 'S')
  assert.deepEqual(plain(s1), { buildId: 'b1', autoProceed: true }, 'an owned frame that says true')
  assert.equal(auto(s1, 'b1'), true); assert.equal(auto(s1, 'b2'), false, 'another build'); assert.equal(auto(s1, null), false, 'the narration has no build id (heuristic path)'); assert.equal(auto(s1, undefined), false); assert.equal(auto(s1, ''), false); assert.equal(auto(none, null), false)
  assert.equal(step(s1, frame('b1', undefined), 'S', 'S'), s1, 'a frame without the field keeps what is known for the same build (the same object)')
  assert.equal(step(s1, frame('b1', null), 'S', 'S'), s1, 'null is not a value'); assert.equal(step(s1, frame('b1', 'true'), 'S', 'S'), s1, 'a string is not a value')
  assert.equal(step(s1, frame('b1', true), 'S', 'S'), s1, 'the same value again: the same object (no render)')
  assert.deepEqual(plain(step(s1, frame('b1', false), 'S', 'S')), { buildId: 'b1', autoProceed: false }, 'an explicit false flips it')
  assert.deepEqual(plain(step(s1, frame('b2', undefined), 'S', 'S')), { buildId: 'b2', autoProceed: false }, 'a new build starts from "not auto"')
  assert.deepEqual(plain(step(s1, frame('b2', true), 'S', 'S')), { buildId: 'b2', autoProceed: true }, '...unless its first frame says so')
  assert.equal(auto(step(s1, frame('b2', undefined), 'S', 'S'), 'b1'), false, 'the old build\'s "true" does not leak into the next build')
  for (const [owner, session] of [['T', 'S'], [null, 'S'], [undefined, 'S'], ['S', null], ['S', undefined], ['S', 'new'], ['S', ''], ['new', 'new'], ['', '']]) assert.equal(step(none, frame('b1', true), owner, session), none, `owner ${String(owner)} / session ${String(session)}: ignored`)
  for (const bad of [null, undefined, 'x', 5, {}, { build_id: '' }, { build_id: '  ' }, { build_id: 7, auto_proceed: true }, { auto_proceed: true }]) assert.equal(step(none, bad, 'S', 'S'), none, `payload ${JSON.stringify(bad)}: ignored`)
  // -- F-08: the outline card's model -----------------------------------------------------------------------------------------------------------
  const outline = over => plain(lib.strawmanChatOutlineModel({ mainTitle: 'Q3 Review', slideCount: 7, durationMinutes: 20, overallTheme: 'Corporate', audience: 'Executives', ...over }))
  assert.deepEqual(outline({}), { part: 'outline-review', ariaLabel: 'Presentation outline', heading: 'Presentation outline', title: 'Q3 Review', meta: '7 slides · 20 min · Corporate', deckCount: null, currentNote: null, audience: 'Executives', canvasNote: null, supersededNote: null, historySummary: null })
  assert.equal(outline({ overallTheme: '' }).meta, '7 slides · 20 min'); assert.equal(outline({ overallTheme: undefined }).meta, '7 slides · 20 min'); assert.equal(outline({ outlineLabel: true }).meta, 'Outline · 7 slides · 20 min · Corporate')
  assert.equal(outline({ outlineLabel: true, deckSlideCount: 9 }).deckCount, 'The deck now has 9 slides.'); assert.equal(outline({ outlineLabel: true, deckSlideCount: 7 }).deckCount, null); assert.equal(outline({ deckSlideCount: 9 }).deckCount, null, 'no outline label: no deck count')
  assert.equal(outline({ outlineLabel: true, deckSlideCount: Number.NaN }).deckCount, null); assert.equal(outline({ outlineLabel: true, deckSlideCount: null }).deckCount, null)
  const earlier = outline({ historyStatus: 'earlier' }); assert.equal(earlier.part, 'outline-history-review'); assert.equal(earlier.heading, 'Earlier outline'); assert.equal(earlier.ariaLabel, 'Earlier presentation outline'); assert.equal(earlier.historySummary, 'Earlier outline · 7 slides')
  const current = outline({ historyStatus: 'current' }); assert.equal(current.heading, 'Current outline'); assert.equal(current.part, 'outline-review'); assert.equal(current.currentNote, 'This outline has different notes. The earlier outline remains available above.'); assert.equal(current.historySummary, null)
  const onCanvas = outline({ onCanvas: true }); assert.equal(onCanvas.canvasNote, 'The outline is on the canvas. Review each slide there, then approve it or ask for changes.'); assert.equal(onCanvas.audience, null, 'the audience was inside the folded details')
  const superseded = outline({ canvasSuperseded: true }); assert.equal(superseded.supersededNote, 'Replaced by the outline on the canvas.'); assert.equal(superseded.heading, 'Earlier outline'); assert.equal(superseded.ariaLabel, 'Earlier presentation outline'); assert.equal(superseded.part, 'outline-review', 'a superseded outline is not a history pair'); assert.equal(superseded.audience, null)
  const both = outline({ onCanvas: true, canvasSuperseded: true }); assert.ok(both.canvasNote && both.supersededNote === null, 'on the canvas wins over superseded, as the card\'s own ternary does')
  assert.equal(outline({ audience: null }).audience, null); assert.equal(outline({ audience: '' }).audience, null)
}

// ============================================================================================================================================
// The loader: the REAL modules on the offline React host, with the clock and the timers ours
// ============================================================================================================================================
const clock = { now: T0 }
const intervals = []
const FakeDate = class extends Date { constructor(...args) { if (args.length) super(...args); else super(clock.now) } static now() { return clock.now } }
const ENV = { NODE_ENV: 'production', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true', NEXT_PUBLIC_BUILD_NARRATION: 'true', NEXT_PUBLIC_BUILD_CONTROL: 'true' }
const ESM = await esmPackages(repo)
/** The modules, with `overrides` (rel -> text) served to the loader in place of the files, and the flag on or off. */
function modules({ on, overrides = {}, extra = [] }) {
  const fsReal = fs.readFileSync
  if (Object.keys(overrides).length) fs.readFileSync = function (file, ...rest) { const rel = typeof file === 'string' ? path.relative(repo, file) : null; return rel && rel in overrides ? overrides[rel] : fsReal.call(fs, file, ...rest) }
  try {
    const loader = createModuleLoader({
      root: repo,
      globals: { process: { env: { ...ENV, ...(on ? { [FLAG]: 'true' } : {}) } }, console, setTimeout: () => 0, clearTimeout: () => {}, setInterval: (fn) => { intervals.push(fn); return intervals.length }, clearInterval: id => { intervals[id - 1] = null }, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, Date: FakeDate, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp, TextEncoder, TextDecoder, URL, queueMicrotask },
      stubs: { ...ESM, react: React, 'lucide-react': lucideStub(React) },
    })
    return { card: loader.load(CARD), job: loader.load(JOB), line: loader.load(COMP), hook: loader.load(HOOK), lib: loader.load(LIB), ...Object.fromEntries(extra.map(rel => [rel, loader.load(rel)])) }
  } finally { fs.readFileSync = fsReal }
}
const html = element => renderToStaticMarkup(element)

// ============================================================================================================================================
// 2. F-08, the outline card
// ============================================================================================================================================
const SLIDES = [
  { slide_id: 's1', slide_number: 1, slide_type: 'title_slide', title: 'Zebra Opening Slide', narrative: 'Why now', key_points: ['alpha point', 'beta point'], analytics_needed: null, visuals_needed: null, diagrams_needed: null, structure_preference: null },
  { slide_id: 's2', slide_number: 2, slide_type: 'content_heavy', title: 'Quokka Market Slide', narrative: 'Where', key_points: [], analytics_needed: null, visuals_needed: null, diagrams_needed: null, structure_preference: null },
  { slide_id: 's3', slide_number: 3, slide_type: 'chart', title: 'Narwhal Closing Slide', narrative: '', key_points: ['gamma'], analytics_needed: null, visuals_needed: null, diagrams_needed: null, structure_preference: null },
]
const PAYLOAD = { operation: 'full_update', metadata: { main_title: 'Q3 Review', overall_theme: 'Corporate', design_suggestions: 'x', target_audience: 'Executives', presentation_duration: 20 }, slides: SLIDES, affected_slides: null }
const CONTEXT = { 0: { key_message: 'Hook the room', narrative_role: 'opening', research_status: 'complete', citation_count: 3 }, 1: { key_message: 'Size the market' } }
const VARIANTS = []
for (const historyStatus of [undefined, 'earlier', 'current']) for (const where of ['inline', 'onCanvas', 'superseded']) for (const [outlineLabel, deckSlideCount] of [[undefined, undefined], [true, 3], [true, 9]]) {
  VARIANTS.push({ historyStatus, ...(where === 'onCanvas' ? { onCanvas: true } : where === 'superseded' ? { canvasSuperseded: true } : {}), ...(outlineLabel ? { outlineLabel, deckSlideCount } : {}) })
}
const cardMarkup = (mods, props) => html(React.createElement(mods.card.StudioOutlineCard, { payload: PAYLOAD, contextByIndex: CONTEXT, renderEvidence: () => null, ...props }))
const pick = (markup, re) => { const m = re.exec(markup); return m ? m[0] : null }
/** The pieces of the base card that the flag-on card keeps: its own markup, byte for byte. */
const KEPT = [
  /<section data-studio-director-part="outline(?:-history)?-review" aria-label="[^"]*">/,
  /<div data-studio-director-part="outline-review-heading">.*?<\/div>/,
  /<p class="text-xs text-muted-foreground">This outline has different notes[^<]*<\/p>/,
  /<h3>[^<]*<\/h3>/,
  /<p data-studio-director-part="outline-review-meta">[^<]*<\/p>/,
  /<p data-studio-director-part="outline-review-deck-count">[^<]*<\/p>/,
  /<p data-studio-director-part="outline-review-canvas-note">[^<]*<\/p>/,
  /<p data-studio-director-part="outline-review-superseded-note">[^<]*<\/p>/,
  /<summary class="cursor-pointer text-xs font-medium">[^<]*<\/summary>/,
]
async function cardChecks(overrides = {}) {
  const off = modules({ on: false, overrides }), on = modules({ on: true, overrides }), baseOff = modules({ on: false, overrides: { [CARD]: baseText(CARD) } })
  for (const props of VARIANTS) {
    const label = JSON.stringify(props)
    const was = cardMarkup(baseOff, props), now = cardMarkup(off, props), flagged = cardMarkup(on, props)
    assert.equal(now, was, `flag off is the base card's markup byte for byte: ${label}`)
    assert.ok(was.includes('data-studio-director-part="outline-review-slides"') || props.onCanvas || props.canvasSuperseded, `the base card lists the slides inline: ${label}`)
    for (const needle of ['Zebra Opening Slide', 'Quokka Market Slide', 'Narwhal Closing Slide', 'outline-review-slides', 'outline-review-slide"', 'outline-review-number', 'outline-review-kind', 'outline-review-preview', 'outline-review-hint', 'outline-review-details', 'Slide details', 'Expand a slide', 'Hook the room', 'title_slide', '<ol', '<summary><span']) assert.ok(!flagged.includes(needle), `flag on: no ${needle} (${label})`)
    for (const re of KEPT) assert.equal(pick(flagged, re), pick(was, re), `flag on keeps the base's own ${re.source.slice(0, 60)} (${label})`)
    assert.ok(flagged.includes('<h3>Q3 Review</h3>'), `the deck's title stays (${label})`)
    assert.equal(/outline-review-audience/.test(flagged), !props.onCanvas && !props.canvasSuperseded, `the audience line stays where the list was inline (${label})`)
    if (!props.onCanvas && !props.canvasSuperseded) assert.equal(pick(flagged, /<p data-studio-director-part="outline-review-audience">[^<]*<\/p>/), pick(was, /<p data-studio-director-part="outline-review-audience">[^<]*<\/p>/), `the audience line is the base's (${label})`)
    assert.equal(/<details data-studio-director-part="outline-history"/.test(flagged), props.historyStatus === 'earlier', `the earlier outline keeps its fold (${label})`)
    assert.ok(flagged.length < was.length || props.onCanvas || props.canvasSuperseded, `flag on is shorter where the list was inline (${label})`)
  }
  // a payload with no theme and no audience
  const bare = { ...PAYLOAD, metadata: { ...PAYLOAD.metadata, overall_theme: '', target_audience: '' } }
  const bareOn = html(React.createElement(on.card.StudioOutlineCard, { payload: bare, contextByIndex: null, renderEvidence: () => null })), bareBase = html(React.createElement(baseOff.card.StudioOutlineCard, { payload: bare, contextByIndex: null, renderEvidence: () => null }))
  assert.equal(pick(bareOn, KEPT[4]), pick(bareBase, KEPT[4]), 'no theme: the meta line is the base\'s'); assert.ok(!bareOn.includes('outline-review-audience') && !bareBase.includes('outline-review-audience'), 'no audience: no line, as the base')
}

// ============================================================================================================================================
// 3. F-09, the chat clean tail
// ============================================================================================================================================
const NARRATION = (over = {}) => ({ active: true, buildId: 'b1', phase: 'planning', control: 'running', slidesDone: 0, slideCount: 7, phaseLabel: 'Designing your deck plan…', startedAt: T0, deckEvents: [{ text: 'Drafting the deck outline…', status: 'progress' }], ...over })
const NOTES = [{ id: 'n1', kind: 'stopped', text: 'Stopped at slide 3 · slides 1–2 kept', at: 1, buildId: 'b1' }, { id: 'n2', kind: 'directions', text: 'make it shorter', at: 2, buildId: 'b1' }, { id: 'n3', kind: 'resumed', text: 'Resumed · building from slide 3', at: 3, buildId: 'b1' }]
const COMPOSER = { mode: 'running' }
const jobMarkup = (mods, props) => html(React.createElement(mods.job.StudioChatCleanJob, { composer: COMPOSER, notes: NOTES, currentStatus: null, ...props }))
async function jobChecks(overrides = {}) {
  const off = modules({ on: false, overrides }), on = modules({ on: true, overrides }), baseOff = modules({ on: false, overrides: { [JOB]: baseText(JOB) } })
  const states = []
  for (const phase of ['planning', 'strawman', 'awaiting_user', 'building', 'qa', 'finalizing', 'complete', 'error']) states.push({ narration: NARRATION({ phase }) })
  states.push({ narration: NARRATION({ phase: 'paused', control: 'paused' }), composer: { mode: 'held', barText: 'Paused at slide 3' } })
  states.push({ narration: NARRATION({ active: false }), currentStatus: { status: 'thinking', text: 'Working on your question…' } })
  states.push({ narration: NARRATION({ active: false }), currentStatus: null })
  states.push({ narration: NARRATION({ active: true }), currentStatus: { status: 'thinking', text: 'Working on it…' }, notes: [] })
  for (const props of states) {
    const label = `${props.narration.phase}/${props.narration.active ? 'active' : 'idle'}/${props.currentStatus ? 'status' : 'no status'}`
    const was = jobMarkup(baseOff, props), now = jobMarkup(off, props), flagged = jobMarkup(on, props)
    assert.equal(now, was, `flag off is the base tail's markup byte for byte: ${label}`)
    if (props.narration.active) {
      assert.ok(was.includes('data-studio-chat-clean-job='), `the base draws the job card: ${label}`)
      for (const needle of ['data-studio-chat-clean-job', 'data-studio-chat-clean-step', 'data-studio-chat-clean-status', '>Plan<', '>Outline<', '>Build<', '>Check<', '>Package<', 'Designing your deck plan', 'Waiting for you']) assert.ok(!flagged.includes(needle), `flag on: no ${needle} (${label})`)
    } else assert.equal(flagged, was, `nothing narrated: the tail is the base's, with Director's ordinary status line (${label})`)
    const notesOf = markup => pick(markup, /<div data-studio-chat-clean-notes="true">.*?<\/div><\/div>|<div data-studio-chat-clean-notes="true">.*?<\/p><\/div>/)
    assert.equal(notesOf(flagged), notesOf(was), `the notes are the base's (${label})`)
  }
}

// ============================================================================================================================================
// 4. F-09, the status line on the offline host
// ============================================================================================================================================
async function lineWorld(overrides) {
  const mods = modules({ on: true, overrides })
  const state = { props: { narration: { active: true, phase: 'planning', control: 'running', startedAt: T0 }, stageOpen: false, autoProceed: false, heldCovered: false, loadingSession: false } }
  function Page() { return React.createElement(mods.line.StudioStrawmanChatLine, state.props) }
  const root = new Root()
  root.setElement(React.createElement(Page))
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 120) throw new Error('did not settle'); await macrotask(); quiet = root.flush() ? 0 : quiet + 1 } }
  clock.now = T0; intervals.length = 0
  await settle()
  return {
    state,
    async set(over) { state.props = { ...state.props, ...over, narration: { ...state.props.narration, ...(over.narration || {}) } }; root.schedule(); await settle() },
    async tick(seconds) { for (let i = 0; i < seconds; i++) { clock.now += 1000; for (const fn of intervals.slice()) if (fn) fn(); await settle() } },
    text: () => root.tree ? textOf(root.tree) : '',
    markup: () => root.tree ? html(toElements(root.tree)) : '',
    live: () => intervals.filter(Boolean).length,
    unmount: () => root.unmount(),
  }
}
async function lineChecks(overrides = {}) {
  const w = await lineWorld(overrides)
  assert.equal(w.text(), 'Drafting your outline…0:00', 'the words and the clock (the dots are aria-hidden spans)')
  assert.match(w.markup(), /^<p data-studio-strawman-chat-line="planning" role="status" aria-live="polite"><span aria-hidden="true"><\/span><span aria-hidden="true"><\/span><span aria-hidden="true"><\/span><span data-studio-strawman-chat-words="true">Drafting your outline…<\/span><span data-studio-strawman-chat-elapsed="true" aria-hidden="true">0:00<\/span><\/p>$/, 'the markup: one status line, the clock hidden from the live region')
  assert.equal(w.live(), 1, 'one interval while the clock runs')
  await w.tick(18); assert.equal(w.text(), 'Drafting your outline…0:18', 'the clock ticks once a second'); assert.equal(w.live(), 1, 'still one interval')
  await w.tick(47); assert.equal(w.text(), 'Drafting your outline…1:05')
  await w.set({ narration: { phase: 'building' } }); assert.equal(w.text(), 'Building your slides…1:05', 'a new phase, the same clock'); assert.match(w.markup(), /data-studio-strawman-chat-line="building"/)
  await w.set({ stageOpen: true }); assert.equal(w.text(), '', 'the stage is open: nothing is drawn'); assert.equal(w.markup(), ''); assert.equal(w.live(), 0, '...and no interval runs')
  await w.set({ stageOpen: false }); assert.equal(w.text(), 'Building your slides…1:05', 'the stage is hidden again: the line is back'); assert.equal(w.live(), 1)
  await w.set({ narration: { phase: 'awaiting_user' } }); assert.equal(w.text(), 'Waiting for your go-ahead', 'the gate: the words, no clock'); assert.equal(w.live(), 0, 'the clock stands still at the gate')
  await w.set({ autoProceed: true }); assert.equal(w.text(), '', 'Director builds on by itself: the go-ahead line is hidden (F-06)'); assert.equal(w.markup(), '')
  await w.set({ autoProceed: false, narration: { phase: 'building', control: 'paused' } }); assert.equal(w.text(), 'Paused'); await w.set({ heldCovered: true }); assert.equal(w.text(), '', 'a bar above the composer says it: one line only')
  await w.set({ heldCovered: false, narration: { phase: 'building', control: 'running' } }); assert.equal(w.text(), 'Building your slides…1:05')
  await w.set({ loadingSession: true }); assert.match(w.markup(), /^<p data-studio-strawman-chat-line="building" role="status" aria-live="polite" hidden="">/, 'a session still loading hides the line (as the presence row does)'); await w.set({ loadingSession: false })
  await w.set({ narration: { active: false } }); assert.equal(w.text(), '', 'nothing narrated: nothing')
  w.unmount(); assert.equal(w.live(), 0, 'unmount clears the interval')
}

// ============================================================================================================================================
// 5. F-06, the hook beside chat clean's
// ============================================================================================================================================
async function hookChecks(overrides = {}) {
  const mods = modules({ on: true, overrides, extra: ['components/builder/chat/studio-chat-clean.tsx'] })
  const clean = mods['components/builder/chat/studio-chat-clean.tsx']
  const SID = 'sess-1'
  async function world({ order = 'after', enabledMine = true, enabledClean = true, seed = true, sessionId = SID } = {}) {
    const calls = []
    const raw = (payload, owner) => { calls.push([payload, owner]) }
    const handlers = { current: seed ? { onBuildPhase: raw, other: 1 } : {} }
    const S = { buildId: 'b1', sessionId, enabledMine }
    const api = {}
    const narration = { active: true, buildId: 'b1', phase: 'building', control: 'running', slidesDone: 0, slideCount: 3 }
    function Page() {
      const mine = () => { api.mine = mods.hook.useStudioStrawmanChat({ enabled: S.enabledMine, sessionId: S.sessionId, buildId: S.buildId, handlers }) }
      const theirs = () => { api.notes = clean.useStudioChatCleanNotes({ enabled: enabledClean, sessionKey: SID, narration, handlers }) }
      if (order === 'after') { theirs(); mine() } else { mine(); theirs() }
      return null
    }
    const root = new Root()
    root.setElement(React.createElement(Page))
    const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 120) throw new Error('did not settle'); await macrotask(); quiet = root.flush() ? 0 : quiet + 1 } }
    await settle()
    return { calls, raw, handlers, api, S, root, async refresh() { root.schedule(); await settle() }, unmount: () => root.unmount() }
  }
  const frame = (build_id, auto_proceed) => ({ build_id, phase: 'building', label: 'Building', ...(auto_proceed === undefined ? {} : { auto_proceed }) })
  for (const order of ['after', 'before']) {
    const w = await world({ order })
    const first = w.handlers.current.onBuildPhase
    assert.notEqual(first, w.raw, `${order}: the handler is wrapped`); assert.equal(w.handlers.current.other, 1, 'the rest of the ref is kept')
    for (let i = 0; i < 12; i++) await w.refresh()
    const settled = w.handlers.current.onBuildPhase
    for (let i = 0; i < 8; i++) await w.refresh()
    assert.equal(w.handlers.current.onBuildPhase, settled, `${order}: the wrapper stops changing across commits (it does not nest again and again)`)
    assert.equal(w.api.mine.autoProceed, false, 'nothing said yet')
    w.handlers.current.onBuildPhase(frame('b1', true), SID); await w.refresh()
    assert.equal(w.calls.length, 1, `${order}: the page's own handler is called exactly once per frame`); assert.deepEqual(plain(w.calls[0]), [frame('b1', true), SID], 'with the same arguments')
    assert.equal(w.api.mine.autoProceed, true, `${order}: auto_proceed true for the build the narration is on`)
    w.handlers.current.onBuildPhase(frame('b1', false), 'other-session'); await w.refresh(); assert.equal(w.api.mine.autoProceed, true, 'a frame of another session changes nothing (not even an explicit false)'); assert.equal(w.calls.length, 2, '...but still reaches the page\'s handler')
    w.handlers.current.onBuildPhase(frame('b1', false), SID); await w.refresh(); assert.equal(w.api.mine.autoProceed, false, 'an explicit false')
    w.handlers.current.onBuildPhase(frame('b9', true), SID); await w.refresh(); assert.equal(w.api.mine.autoProceed, false, 'another build\'s true is not this build\'s'); w.S.buildId = 'b9'; await w.refresh(); assert.equal(w.api.mine.autoProceed, true, '...until the narration is on that build')
    w.S.buildId = null; await w.refresh(); assert.equal(w.api.mine.autoProceed, false, 'no build id on the narration: not auto')
    // the page's own effect replaces the ref with a fresh object: wrapped again at the next commit
    w.handlers.current = { onBuildPhase: w.raw }; await w.refresh()
    assert.notEqual(w.handlers.current.onBuildPhase, w.raw, `${order}: wrapped again after the page replaced the handlers`)
    w.unmount()
  }
  // chat clean's own marker survives my wrapper (it checks its marker on the outermost handler), whichever hook ran first
  const w = await world({ order: 'after' })
  const markers = Object.getOwnPropertySymbols(w.handlers.current.onBuildPhase)
  assert.ok(markers.length >= 2, 'my wrapper carries my marker and the marker of the wrapper under it'); w.unmount()
  // off: nothing is wrapped, nothing is kept
  const offW = await world({ enabledMine: false, enabledClean: false })
  assert.equal(offW.handlers.current.onBuildPhase, offW.raw, 'off: the handler is the page\'s own'); offW.handlers.current.onBuildPhase(frame('b1', true), SID); await offW.refresh(); assert.equal(offW.api.mine.autoProceed, false, 'off: false'); offW.unmount()
  // narration off: the ref is empty, nothing is invented
  const emptyW = await world({ seed: false, enabledClean: false })
  assert.equal(emptyW.handlers.current.onBuildPhase, undefined, 'an empty handlers ref (narration off) stays empty'); emptyW.unmount()
  // turned off after the wrapper is in: a frame no longer changes anything
  const lateW = await world({ enabledClean: false }); lateW.S.enabledMine = false; await lateW.refresh(); lateW.handlers.current.onBuildPhase(frame('b1', true), SID); await lateW.refresh(); assert.equal(lateW.api.mine.autoProceed, false); lateW.unmount()
}

// ============================================================================================================================================
// 6. The page
// ============================================================================================================================================
function pageChecks(pageText = read(PAGE)) {
  const ast = ts.createSourceFile(PAGE, pageText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found = { slot: [], decl: {} }
  const visit = node => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && node.left.getText(ast) === 'effectiveBuildNarrationEnabled' && /DirectorPresence/.test(node.right.getText(ast))) found.slot.push(node)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^strawmanChat/.test(node.name.text)) (found.decl[node.name.text] ||= []).push(node)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.equal(found.slot.length, 1, 'one slot: {effectiveBuildNarrationEnabled && (...DirectorPresence...)}')
  const paren = found.slot[0].right
  assert.ok(ts.isParenthesizedExpression(paren), 'the slot is parenthesised'); const ternary = paren.expression
  assert.ok(ts.isConditionalExpression(ternary), 'the slot is a ternary around the presence row')
  assert.equal(ternary.condition.getText(ast), 'strawmanChatOn && buildNarration.active', 'the line replaces the row only while the flag is on and a build is narrated')
  assert.ok(ts.isJsxSelfClosingElement(ternary.whenTrue) && ternary.whenTrue.tagName.getText(ast) === 'StudioStrawmanChatLine', 'whenTrue: the quiet line')
  const attrs = Object.fromEntries(ternary.whenTrue.attributes.properties.map(p => [p.name.getText(ast), p.initializer.getText(ast)]))
  assert.deepEqual(attrs, { narration: '{buildNarration}', stageOpen: '{strawmanChatStageOpen}', autoProceed: '{strawmanChat.autoProceed}', heldCovered: '{chatCleanOn || Boolean(flowControl.bar)}', loadingSession: '{studioShell ? session.isLoadingSession : undefined}' }, 'its props: the stage-open line, auto_proceed, a held build said by a bar, the session loading')
  assert.ok(ts.isParenthesizedExpression(ternary.whenFalse) && ts.isJsxSelfClosingElement(ternary.whenFalse.expression) && ternary.whenFalse.expression.tagName.getText(ast) === 'DirectorPresence', 'whenFalse: the presence row, as ever')
  assert.equal(ternary.whenFalse.expression.getText(ast), baseText(PAGE).match(/<DirectorPresence [^\n]*\/>/)[0], 'the presence row\'s own line is the base\'s')
  // the flag line, the hook call, the ONE stage-open line
  assert.deepEqual(Object.keys(found.decl).sort(), ['strawmanChat', 'strawmanChatOn', 'strawmanChatStageOpen'])
  for (const name of Object.keys(found.decl)) assert.equal(found.decl[name].length, 1, `${name} is declared once`)
  assert.equal(found.decl.strawmanChatOn[0].initializer.getText(ast), 'STUDIO_STRAWMAN_CHAT_ENABLED && studioShell && effectiveBuildNarrationEnabled', 'the flag, the Studio shell and the narration canvas')
  assert.equal(found.decl.strawmanChat[0].initializer.getText(ast), 'useStudioStrawmanChat({ enabled: strawmanChatOn, sessionId: currentSessionId, buildId: buildNarration.buildId, handlers: buildNarrationHandlersRef })')
  assert.equal(found.decl.strawmanChatStageOpen[0].initializer.getText(ast), '!studioWelcome && !studioCanvasCovered', 'stage open = what the page has today: the welcome is not on the canvas and the chat is not covering it')
  const lines = pageText.split('\n')
  const stageLines = lines.filter(line => /strawmanChatStageOpen\b/.test(line))
  assert.equal(stageLines.filter(line => /^\s*const strawmanChatStageOpen =/.test(line)).length, 1, 'the stage-open boolean is computed on ONE line'); assert.match(stageLines.find(line => /^\s*const strawmanChatStageOpen =/.test(line)), /THE ONE LINE to swap for FRONTEND-2's studio-stage-open-gate export: once #554 merges this call site becomes useStudioStageOpen\(\) from lib\/studio-stage-open-gate\.ts/, 'and says how to swap it (to useStudioStageOpen() once #554 merges)')
  assert.ok(!/studio-stage-open-gate/.test(lines.filter(line => /^import /.test(line)).join('\n')), 'the gate file does not exist on this base: nothing imports it')
  assert.ok(!/TODO/i.test(stageLines.join('\n')), 'the swap note is a plain comment')
  assert.equal(pageText.indexOf('useStudioChatCleanNotes({') < pageText.indexOf('useStudioStrawmanChat({'), true, 'my hook is declared after chat clean\'s notes hook (the wrapper order)')
  // not touched: FRONTEND-2's F-03 spots, the outline canvas selection and render, the narration handlers effect
  const after = (text, anchor, n) => { const at = text.split('\n').findIndex(line => line.includes(anchor)); assert.notEqual(at, -1, anchor); return text.split('\n').slice(at - 1, at + 1 + n).join('\n') }
  const baseP = baseText(PAGE)
  for (const [anchor, n] of [['const studioFirstRunStage = ', 3], ['data-studio-first-run-stage=', 2], ['const studioOutlineCanvas = selectStudioOutlineCanvas({', 12], ['<StudioOutlineCanvas key=', 3], ['buildNarrationHandlersRef.current = effectiveBuildNarrationEnabled', 12]]) assert.equal(after(pageText, anchor, n), after(baseP, anchor, n), `untouched: the lines around ${anchor}`)
}

// ============================================================================================================================================
// the whole behaviour, once, for the run and for every mutant
// ============================================================================================================================================
async function behaviour(overrides = {}) {
  if (LIB in overrides) libChecks(overrides[LIB]); else libChecks()
  await cardChecks(overrides); await jobChecks(overrides); await lineChecks(overrides); await hookChecks(overrides)
  pageChecks(PAGE in overrides ? overrides[PAGE] : read(PAGE))
}

console.log('1. the lib')
await check('the flag, the elapsed clock, the line\'s decision table, auto_proceed, the outline model', () => libChecks())
console.log('2. F-08, the outline card (the real component, flag off against the base file, flag on against its own words)')
await check(`${VARIANTS.length} variants: flag off is the base card byte for byte; flag on has no slide list and keeps the base's heading, title, meta, notes and fold`, () => cardChecks())
console.log('3. F-09, the chat clean tail')
await check('flag off is the base tail byte for byte; flag on draws no job card and no Plan / Outline / Build / Check / Package, keeps the notes and Director\'s ordinary status line', () => jobChecks())
console.log('4. F-09, the quiet status line')
await check('the words and the clock, ticking, nothing once the stage is open, nothing at the go-ahead gate when Director builds on by itself, a held build said once', () => lineChecks())
console.log('5. F-06, the hook')
await check('the handler is wrapped once and stays wrapped (either order next to chat clean\'s hook), auto_proceed per build and per session, off wraps nothing', () => hookChecks())
console.log('6. the page')
await check('the slot is a ternary around the presence row; "stage open" is one marked line; the hook is declared after chat clean\'s; FRONTEND-2\'s spots and the outline canvas are untouched', () => pageChecks())

console.log('7. mutants')
const mutate = (text, from, to, label) => { const at = text.indexOf(from); if (at === -1 || text.indexOf(from, at + 1) !== -1) throw new Error(`mutant "${label}": target ${JSON.stringify(from.slice(0, 70))} not found exactly once`); return text.replace(from, () => to) }
await check('the unmutated files pass the mutant checks (the checks can pass)', () => behaviour({}))
const texts = { [LIB]: read(LIB), [COMP]: read(COMP), [HOOK]: read(HOOK), [CARD]: read(CARD), [JOB]: read(JOB), [PAGE]: read(PAGE) }
const mutants = [
  // the lib
  ['the flag is read loosely (!== "false"; unset is on)', LIB, "return value === 'true'", "return value !== 'false'"],
  ['the flag is ignored (always on)', LIB, 'strawmanChatFlagOn(process.env.NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT)', 'true'],
  ['the line ignores that the stage is open', LIB, 'if (!input.enabled || !input.active || input.stageOpen) return null', 'if (!input.enabled || !input.active) return null'],
  ['the line ignores that the flag is off', LIB, 'if (!input.enabled || !input.active || input.stageOpen) return null', 'if (!input.active || input.stageOpen) return null'],
  ['the go-ahead line ignores auto_proceed', LIB, "if (phase === 'awaiting_user') return input.autoProceed ? null :", "if (phase === 'awaiting_user') return"],
  ['auto_proceed hides every line, not only the go-ahead one', LIB, "if (phase === 'awaiting_user') return input.autoProceed ?", "if (input.autoProceed) return null\n  if (phase === 'awaiting_user') return input.autoProceed ?"],
  ['a held build is drawn although a bar says it', LIB, 'if (input.heldCovered) return null', ''],
  ['a stop request is not worded', LIB, 'if (Object.prototype.hasOwnProperty.call(STRAWMAN_CHAT_CONTROL_WORDS, control))', 'if (false)'],
  ['the clock counts from now, not from the narration\'s start', LIB, 'strawmanChatElapsed(input.startedAt, input.now)', 'strawmanChatElapsed(input.now, input.now)'],
  ['the clock has no zero padding', LIB, "String(seconds % 60).padStart(2, '0')", 'String(seconds % 60)'],
  ['the clock rounds up', LIB, 'Math.floor((now - startedAt) / 1000)', 'Math.ceil((now - startedAt) / 1000)'],
  ['the outline phase is worded as the build phase', LIB, "planning: 'Drafting your outline…'", "planning: 'Building your slides…'"],
  ['a frame of another session is taken', LIB, 'ownerSessionId !== sessionId) return state', 'false) return state'],
  ['the new build keeps the old build\'s auto_proceed', LIB, 'return { buildId, autoProceed: value === true }', 'return { buildId, autoProceed: value === true || state.autoProceed }'],
  ['a frame without the field resets the value', LIB, 'return value === null || value === state.autoProceed ? state : { buildId, autoProceed: value }', 'return { buildId, autoProceed: value === true }'],
  ['auto_proceed is true for any build', LIB, "state.autoProceed === true && typeof narrationBuildId === 'string' && narrationBuildId !== '' && state.buildId === narrationBuildId", 'state.autoProceed === true'],
  ['the outline model drops the canvas note', LIB, "canvasNote: input.onCanvas ? 'The outline is on the canvas. Review each slide there, then approve it or ask for changes.' : null", 'canvasNote: null'],
  ['the outline model shows the audience beside the canvas', LIB, 'audience: input.onCanvas || input.canvasSuperseded ? null : audience', 'audience'],
  // the component
  ['the line never ticks', COMP, 'const timer = setInterval(() => setNow(Date.now()), 1000)', 'const timer = 0'],
  ['the line leaks its interval', COMP, 'return () => clearInterval(timer)', 'return () => {}'],
  ['the clock is read by the live region', COMP, '<span data-studio-strawman-chat-elapsed="true" aria-hidden="true">', '<span data-studio-strawman-chat-elapsed="true">'],
  ['the card lists the slides again', COMP, '{model.audience && <p data-studio-director-part="outline-review-audience">For {model.audience}</p>}', '{model.audience && <p data-studio-director-part="outline-review-audience">For {model.audience}</p>}<ol data-studio-director-part="outline-review-slides" />'],
  // the hook
  ['the wrapper is not marked (it wraps on every commit)', HOOK, 'wrapped[WRAPPED] = true', ''],
  ['the wrapper drops the markers under it', HOOK, 'for (const key of Object.getOwnPropertySymbols(previous)) wrapped[key] = (previous as unknown as Record<symbol, unknown>)[key]', ''],
  ['the page\'s own handler is not called', HOOK, '      previous(payload, ownerSessionId)\n', ''],
  ['the hook wraps while off', HOOK, 'if (!latestRef.current.enabled || !ref) return', 'if (!ref) return'],
  ['the hook wraps a handler that is not there', HOOK, "if (typeof previous !== 'function' || previous[WRAPPED]) return", 'if (previous?.[WRAPPED]) return'],
  ['the session is not the displayed one', HOOK, 'ownerSessionId, now.sessionId))', 'ownerSessionId, ownerSessionId))'],
  // the app files
  ['the card ignores the flag', CARD, 'if (STUDIO_STRAWMAN_CHAT_ENABLED) return', 'if (false) return'],
  ['the job card ignores the flag', JOB, 'STUDIO_STRAWMAN_CHAT_ENABLED ? null : (', 'false ? null : ('],
  ['the job card is dropped with the flag off too', JOB, 'STUDIO_STRAWMAN_CHAT_ENABLED ? null : (', 'true ? null : ('],
  ['the page: the line replaces the row without a narrated build', PAGE, 'strawmanChatOn && buildNarration.active ?', 'strawmanChatOn ?'],
  ['the page: the line ignores the stage', PAGE, 'stageOpen={strawmanChatStageOpen}', 'stageOpen={false}'],
  ['the page: the stage-open line is computed twice', PAGE, 'stageOpen={strawmanChatStageOpen}', 'stageOpen={!studioWelcome && !studioCanvasCovered}'],
  ['the page: the hook is declared before chat clean\'s', PAGE, 'const strawmanChat = useStudioStrawmanChat(', 'const strawmanChatEarly = useStudioStrawmanChat('],
  ['the page: a held build is drawn although a bar says it', PAGE, 'heldCovered={chatCleanOn || Boolean(flowControl.bar)}', 'heldCovered={false}'],
]
for (const [label, rel, from, to] of mutants) await check(`mutant caught: ${label}`, async () => {
  const mutant = mutate(texts[rel], from, to, label)
  await assert.rejects(() => behaviour({ [rel]: mutant }), undefined, 'the checks must fail on this mutant')
})

console.log('8. the sources, and the scope over the committed diff (BASE..HEAD)')
/** GATE-SAFE head of every own-commit / scope query. In the gate, HEAD is a local --no-ff merge whose FIRST parent is BASE (dev) and whose second parent is this change's head, so `rev-list --first-parent --no-merges BASE..HEAD` is empty: the scope then runs against HEAD^2. On a branch HEAD itself is used. */
function scopeHead(ref = 'HEAD') {
  const sha = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = git('rev-list', '--parents', '-n', '1', sha).trim().split(/\s+/).slice(1)
  return parents.length === 2 && parents[0] === BASE_COMMIT ? parents[1] : sha
}
const HEAD = scopeHead('HEAD')
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. */
const ownOf = head => git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(STRAWMAN_CHAT_SUBJECT))
const scopeOwnCommits = head => {
  const own = ownOf(head)
  assert.ok(own.length >= 1, 'no own commit yet')
  const all = git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)
  for (const c of all.filter(c => !own.includes(c))) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) assert.ok(STRAWMAN_CHAT_SCOPE_FILES.has(rel) || registry.LATER_CHANGE_FILES.has(rel), `a commit between the base and HEAD that is not this change's (${c.slice(0, 8)}) touches ${rel}, which no later change registered`)
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m, c.slice(0, 8))
}
/** The strips of every change registered AFTER this one (below this change's strip in LATER_STRIPS), applied first: the identity checks read a file as this change left it. */
const laterStrips = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(stripStrawmanChat); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }
/** `git diff -U0` of the base file against the file at `head` with the later changes' marked lines out (one blob object is written; a FILE in a fresh temp dir, not stdin). */
const strippedDiff = (rel, head) => {
  const text = laterStrips(rel, git('show', `${head}:${rel}`))
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-strawman-chat-strip-'))
  try {
    const file = path.join(dir, 'stripped')
    fs.writeFileSync(file, text)
    const blob = execFileSync('git', ['hash-object', '-w', '--no-filters', '--', file], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
    return git('diff', '-U0', `${BASE_COMMIT}:${rel}`, blob)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const scopeCommittedFiles = head => {
  const changed = git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(rel => STRAWMAN_CHAT_SCOPE_FILES.has(rel) || !registry.LATER_CHANGE_FILES.has(rel)).sort()
  assert.deepEqual(changed, [...STRAWMAN_CHAT_SCOPE_FILES].sort(), 'the committed files are exactly this change\'s')
  assert.deepEqual(STRAWMAN_CHAT_FILES, [PAGE, CARD, JOB])
  const expectedAdded = { [PAGE]: 8, [CARD]: 3, [JOB]: 3 }
  for (const rel of STRAWMAN_CHAT_FILES) {
    const diff = strippedDiff(rel, head).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    assert.equal(diff.length, expectedAdded[rel], `${rel}: ${expectedAdded[rel]} added lines and no removed one`)
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, STRAWMAN_CHAT_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.equal(stripStrawmanChat(rel, laterStrips(rel, git('show', `${head}:${rel}`))), git('show', `${BASE_COMMIT}:${rel}`), `${rel}: without its marked lines the file is the base's, byte for byte`)
    assert.equal(registry.stripLaterChanges(rel, git('show', `${head}:${rel}`)), registry.stripLaterChanges(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: ...and through the registry (both sides)`)
  }
  for (const rel of Object.keys(STRAWMAN_CHAT_PIN_EDITS)) {
    assert.equal(stripStrawmanChat(rel, laterStrips(rel, git('show', `${head}:${rel}`))), git('show', `${BASE_COMMIT}:${rel}`), `${rel}: the taught proof, put back, is the previous file byte for byte`)
    const diff = strippedDiff(rel, head).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    const lines = text => text.split('\n').filter(Boolean).length
    assert.equal(diff.filter(line => line.startsWith('+')).length, STRAWMAN_CHAT_PIN_EDITS[rel].reduce((n, [has]) => n + lines(has), 0)); assert.equal(diff.filter(line => line.startsWith('-')).length, STRAWMAN_CHAT_PIN_EDITS[rel].reduce((n, [, was]) => n + lines(was), 0))
    for (const line of diff.filter(line => line.startsWith('+'))) assert.ok(line.includes(stripModule.STRAWMAN_CHAT_PIN_MARK), `${rel}: a taught line without the mark: ${line.slice(0, 100)}`)
  }
  for (const rel of STRAWMAN_CHAT_NEW_FILES) assert.ok(git('cat-file', '-t', `${head}:${rel}`).trim() === 'blob', rel)
}
const scopeEnvAndRegistry = head => {
  assert.equal(registry.stripLaterEnvBlocks('.env.example', git('show', `${head}:.env.example`)), registry.stripLaterEnvBlocks('.env.example', `${baseText('.env.example')}\n${STRAWMAN_CHAT_ENV_BLOCK}`))
  const laterBlocks = registry.LATER_ENV_BLOCKS.slice(registry.LATER_ENV_BLOCKS.indexOf(STRAWMAN_CHAT_ENV_BLOCK) + 1)
  const withoutLaterBlocks = laterBlocks.reduce((text, block) => text.replace(`\n${String(block).replace(/^\n+/, '').replace(/\n+$/, '')}\n`, () => ''), git('show', `${head}:.env.example`))
  assert.equal(withoutLaterBlocks, `${baseText('.env.example')}\n${STRAWMAN_CHAT_ENV_BLOCK}`, 'byte for byte: the base, one blank line, the block (the blocks of the changes registered after this one aside)')
  const laterRegistry = (() => { const later = new Set(); let after = false; for (const line of git('show', `${head}:scripts/studio-later-changes.mjs`).split('\n')) { if (/^export const LATER_/.test(line)) after = false; else if (line.includes('studio-strawman-chat-strip.mjs')) after = true; else if (after && line.includes('// LATER-CHANGE')) later.add(line) } return later })()
  const diff = git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line) && !(line.startsWith('+') && laterRegistry.has(line.slice(1))))
  assert.equal(diff.length, 3, 'the registry gains exactly three lines')
  for (const line of diff) assert.ok(line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-strawman-chat-strip.mjs'), line.slice(0, 140))
}
await check(`this change's own commits (subject starts "${STRAWMAN_CHAT_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; a commit that is not one touches only files a later change registered`, () => scopeOwnCommits(HEAD))
await check('the committed files are exactly this change\'s; every line added to an existing file is a pure insertion that carries the marker (eight in the page, three in the card, three in the chat clean tail); the strip gives the base back byte for byte, also through the registry', () => scopeCommittedFiles(HEAD))
const GATE_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-30T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-30T00:00:00Z' }
const gateStyleMerge = head => {
  const tree = git('merge-tree', '--write-tree', BASE_COMMIT, head).trim().split('\n')[0]
  return execFileSync('git', ['commit-tree', tree, '-p', BASE_COMMIT, '-p', head, '-m', 'gate-style merge (local, no ref)'], { cwd: repo, encoding: 'utf8', env: { ...process.env, ...GATE_IDENT }, timeout: 60_000 }).trim()
}
const GATE = gateStyleMerge(HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it', () => {
  assert.deepEqual(git('rev-list', '--parents', '-n', '1', GATE).trim().split(/\s+/).slice(1), [BASE_COMMIT, HEAD], 'the gate-style merge: first parent BASE, second parent the head')
  const head = scopeHead(GATE)
  assert.equal(head, HEAD, 'HEAD^2 is the change\'s head')
  scopeOwnCommits(head); scopeCommittedFiles(head); scopeEnvAndRegistry(head)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head (not a merge onto BASE) is used as it is')
})
await check('mutant caught: a stray file in a "Strawman chat:" commit fails the committed-files check (the own commits are found by subject, the diff names the file)', () => {
  const run = (args, input) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', input, env: { ...process.env, ...GATE_IDENT }, stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000 }).trim()
  const tree = run(['mktree'], `${git('ls-tree', HEAD)}100644 blob ${run(['hash-object', '-w', '--stdin'], 'stray\n')}\tstray-strawman-chat.txt\n`)
  const stray = run(['commit-tree', tree, '-p', HEAD, '-m', `${STRAWMAN_CHAT_SUBJECT} a stray file\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`])
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), undefined, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an unmarked line added to the card is not stripped (the strip gives the base back only for marked lines)', () => {
  const mutant = mutate(texts[CARD], 'import type { ReactNode } from "react"\n', 'import type { ReactNode } from "react"\nimport { extra } from "./extra"\n', 'unmarked')
  assert.notEqual(stripStrawmanChat(CARD, mutant), stripStrawmanChat(CARD, texts[CARD]))
})
await check('plumbing: the lib reads the literal env name (exact "true") once; the app files read the lib\'s constant; .env.example documents "false" once; the lib is import-free; no secret-shaped literal in the new files', () => {
  const text = read(LIB)
  assert.equal((text.match(/process\.env\.NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT\b/g) || []).length, 1)
  assert.deepEqual([...text.matchAll(/^import .*$/gm)].map(m => m[0]), [], 'the lib is import-free')
  for (const rel of [PAGE, CARD, JOB, COMP, HOOK]) assert.equal((read(rel).match(/process\.env\.NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT\b/g) || []).length, 0, `${rel} does not read the env itself`)
  assert.match(read('.env.example'), new RegExp(`^${FLAG}="false"$`, 'm'))
  assert.equal((read('.env.example').match(new RegExp(FLAG, 'g')) || []).length, 1)
  for (const rel of ['scripts/test-studio-strawman-chat.mjs', 'scripts/studio-strawman-chat-strip.mjs', LIB, COMP, HOOK]) assert.doesNotMatch(read(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/, rel)
})
await check('.env.example is the base plus the block (a blank line before it); the registry gains exactly its three marked lines and loses none', () => scopeEnvAndRegistry(HEAD))

release()
console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
