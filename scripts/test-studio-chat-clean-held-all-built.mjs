// FRONTEND-2 (B40; E2E-2 finding, Studio dev, 28 Oct 13:11-13:24Z, session 39a3f141): proof of NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT (exact "true", default off, build-time; it needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN).
//
// THE DEFECT. The user pressed Stop at 13:17:10Z when all 5 slides were already built and typed a plain QUESTION. lib/studio-chat-clean.ts chatCleanComposerState, `held` branch, says
// `sendMode: input.controlEnabled ? 'instructions' : 'wait'` (placeholder "New directions from slide N…", hint "Enter sends new directions from slide N · Continue resumes as planned", context "New directions apply from slide N");
// chatCleanDirectionsFrom is min(done + 1, count), so 5 of 5 built still said "from slide 5". Enter / Send then ran app/builder/page.tsx chatCleanSendDirections: build_control resume with the text as instructions, the thread note
// "Resumed · building from slide 5", Director: "Everything was already built — generating the final deck now." The question was never answered.
// DIRECTOR-2 (Director uat code): a plain user_message while STOPPED is an ordinary engine turn; nothing auto-resumes, build_state is untouched, only resume-type words resume. So with nothing left to build a plain message is safe and gets an answer.
//
// THE FIX (flag on). In the held state with slideCount > 0 and slidesDone >= slideCount the composer state is the base's own: sendMode 'message' (ChatInput's normal Send path, the page's handleSendMessage), no directions placeholder, hint or context.
// The slim bar ("Stopped after the last slide · slides 1-N kept") and Continue stay. Everything else is unchanged. Two marked lines (and one comment line) in lib/studio-chat-clean.ts; the page, the composer and the bar are untouched.
// PAUSED with every slide built reads the same way (the lib's `held` covers both): nothing is left to direct, and a plain message while paused is no worse than Continue (the worst case is the deck finishing). DIRECTOR-2 confirmed STOPPED; paused is the
// same rule applied by the same word "held" (the report asks FRONTEND-2 to have it confirmed).
//
//   1. The lib, function by function: the flag, the composer table over a grid of 40k inputs. Flag off hashes as the base lib (this lib with the marked lines stripped); flag on differs from the base ONLY in the held, all-built region, and there only in
//      sendMode / placeholder / hint / context / directionsFrom; the named cases; no new copy.
//   2. The world, on recorded frames (DIRECTOR-2's 27 Oct stop frames, scripts/fixtures/chat-clean-order): the REAL narration hook and notes hook, the REAL lib, the REAL ChatInput and StudioChatCleanBar, and the page's REAL chatCleanSendDirections /
//      chatCleanContinue (cut out of app/builder/page.tsx by AST). All built + stopped + typed + Enter / Send: flag off is the resume with instructions (today, the E2E-2 transcript), flag on is the plain message with no build_control, no directions note, no
//      "Resumed" note. 4 of 5 built: directions as today either way. Continue: unchanged either way. Paused all built: the plain message. Flag off hashes as the base lib at every checkpoint.
//   3. Wiring and the strip: the marked lines, the strip gives the base lib back byte for byte, no import, one inline flag read, no new string literal, the page's send chain (ChatInput onSubmit -> handleSendMessage -> user_message, no build control), .env.example.
//   4. Mutants: each must be caught.
//   5. Scope over the COMMITTED diff, GATE-SAFE and robust after merge: this change's commits are found by SUBJECT across `rev-list --no-merges BASE..head`; on the gate's merge (first parent dev, second parent this change) the scope head is HEAD^2; the registry,
//      .env.example and strip reads go past every other change (all other registered strips applied to BOTH sides), proved on a gate-style merge, on a merge onto an advanced dev and on a synthetic change stacked after this one.
//
//   node scripts/test-studio-chat-clean-held-all-built.mjs
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed; the loader's clock is a fake one); git is read only for 5 (objects only, no ref, no working-tree write).
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT'
const LIB = 'lib/studio-chat-clean.ts'
const PAGE = 'app/builder/page.tsx'
const INPUT = 'components/builder/chat-input.tsx'
const FIXTURE = 'scripts/fixtures/chat-clean-order/outline-gate-director2-27oct.json'
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}

// React and the offline host are loaded AFTER NODE_ENV is set above (a static import would load React's development build first and mismatch the production server renderer).
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { installHostNetworkGuard } = await import('./studio-chat-harness/fake-env.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { Root, hostNodes, textOf, toElements } = await import('./studio-chat-harness/mini-react.mjs')
const { esmPackages, lucideStub } = await import('./studio-chat-harness/esm-packages.mjs')
const extract = await import('./studio-chat-harness/page-extract.mjs')
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-chat-clean-held-all-built-strip.mjs')
const { stripHeldAllBuilt, BASE_COMMIT, HELD_ALL_BUILT_FILES, HELD_ALL_BUILT_NEW_FILES, HELD_ALL_BUILT_SCOPE_FILES, HELD_ALL_BUILT_ENV_BLOCK, HELD_ALL_BUILT_SUBJECT, HELD_ALL_BUILT_MARKER_RE, HELD_ALL_BUILT_PIN_EDITS } = stripModule
const release = installHostNetworkGuard(net, dns)
const macrotask = () => new Promise(resolve => setImmediate(resolve))
/** The paths at which two plain values differ (a readable failure for the flow comparisons). */
const diffPaths = (a, b, at = '') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return []
  if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => diffPaths(a[key], b[key], `${at}.${key}`))
  return [`${at}: ${JSON.stringify(a)?.slice(0, 90)} vs ${JSON.stringify(b)?.slice(0, 90)}`]
}

// The strips of the changes registered AFTER this one, applied first (a later change's marked lines in a file this change touches); and, for the sources section, every OTHER registered strip (applied to both sides of a comparison).
const strips = registry.LATER_STRIPS
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
const laterStrips = (rel, text) => { const at = strips.indexOf(stripHeldAllBuilt); return applyAll(at === -1 ? [] : strips.slice(at + 1), rel, text) }
const otherStrips = (rel, text) => applyAll(strips.filter(strip => strip !== stripHeldAllBuilt), rel, text)
/** The file as this change left it (the later changes' marked lines out), and the same without this change's lines (the base's file). */
const ownText = rel => laterStrips(rel, read(rel))
const baseText = rel => stripHeldAllBuilt(rel, ownText(rel))

// ---- the lib, evaluated in THIS realm with a fake process ---------------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function loadLib(text, env = { NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true', [FLAG]: 'true' }) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, LIB))(module, module.exports, () => { throw new Error('the lib must stay import-free') }, { env })
  return module.exports
}

// ============================================================================================================================================
// 1. The lib
// ============================================================================================================================================
const PHASES = ['planning', 'strawman', 'building', 'qa', 'finalizing', 'paused', 'stopped', 'complete', 'error', 'idle', 'awaiting_user', 'surprise']
const CONTROLS = ['running', 'stopped', 'paused', 'stop_requested', 'resume_requested', 'idle']
const COUNTS = [0, 1, 4, 5, 10, -3, Number.NaN, 5.5]
const DONES = [-1, 0, 1, 3, 4, 5, 6, Number.NaN, 2.5]
const GRID = []
for (const enabled of [true, false]) for (const active of [true, false]) for (const phase of PHASES) for (const control of CONTROLS) for (const controlEnabled of [true, false]) for (const slideCount of COUNTS) for (const slidesDone of DONES) GRID.push({ enabled, active, phase, control, slidesDone, slideCount, controlEnabled, ackKey: null, ackLine: '' })
const HELD = i => i.control === 'stopped' || i.control === 'paused' || i.phase === 'stopped' || i.phase === 'paused'
/** The region the fix changes, stated without the lib: enabled and active, a running-or-held phase, held (not stop_requested / resume_requested), a known count, every slide built. */
const IN_REGION = i => i.enabled && i.active && !['complete', 'error', 'idle', 'awaiting_user'].includes(i.phase) && i.control !== 'stop_requested' && i.control !== 'resume_requested' && HELD(i)
  && Number.isSafeInteger(i.slideCount) && i.slideCount > 0 && Number.isSafeInteger(i.slidesDone) && i.slidesDone >= i.slideCount
const run = (lib, inputs) => inputs.map(input => JSON.stringify(lib.chatCleanComposerState(input)))

function libSuite(ownLibText = ownText(LIB), baseLibText = baseText(LIB)) {
  const base = loadLib(baseLibText, { NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' })
  const off = loadLib(ownLibText, { NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' })
  const on = loadLib(ownLibText)
  // -- the flag: exact "true", build-time -----------------------------------------------------------------------------------------------------
  assert.equal(base.STUDIO_CHAT_CLEAN_HELD_ALL_BUILT_ENABLED, undefined, 'the base has no such flag')
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['yes', false], ['', false], ['true', true]]) {
    assert.equal(loadLib(ownLibText, { NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true', ...(value === undefined ? {} : { [FLAG]: value }) }).STUDIO_CHAT_CLEAN_HELD_ALL_BUILT_ENABLED, want, `flag ${JSON.stringify(value)}`)
  }
  // -- over the grid -------------------------------------------------------------------------------------------------------------------------
  const baseOut = run(base, GRID)
  const offOut = run(off, GRID)
  assert.equal(sha(offOut.join('\n')), sha(baseOut.join('\n')), 'flag off: the composer state of every grid input hashes as the base lib\'s')
  for (const value of ['false', 'TRUE', '1', ' true', 'yes', '']) assert.equal(sha(run(loadLib(ownLibText, { NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true', [FLAG]: value }), GRID).join('\n')), sha(baseOut.join('\n')), `the flag set to ${JSON.stringify(value)} is off`)
  const onOut = run(on, GRID)
  let region = 0
  GRID.forEach((input, n) => {
    if (!IN_REGION(input)) { assert.equal(onOut[n], baseOut[n], `flag on, outside the region, is the base: ${JSON.stringify(input)}`); return }
    region++
    const was = JSON.parse(baseOut[n]), now = JSON.parse(onOut[n])
    assert.deepEqual(now, { ...was, sendMode: 'message', placeholder: null, hint: input.controlEnabled ? null : was.hint, directionsFrom: null, context: null }, `flag on, in the region: only sendMode / placeholder / hint / context / directionsFrom change: ${JSON.stringify(input)}`)
    assert.equal(was.mode, 'held'); assert.equal(now.mode, 'held'); assert.equal(now.showContinue, true)
    for (const key of ['barText', 'barDetail']) assert.equal(now[key], was[key], `${key} is the base's own words: ${JSON.stringify(input)}`)
  })
  assert.ok(region > 100, `the region is exercised (${region} inputs)`)
  // -- the named cases (literal, not derived from the base) -------------------------------------------------------------------------------------
  const state = (lib, over) => lib.chatCleanComposerState({ enabled: true, active: true, phase: 'stopped', control: 'stopped', slidesDone: 5, slideCount: 5, controlEnabled: true, ackKey: null, ackLine: '', ...over })
  const plain = (barText, barDetail, extra = {}) => ({ mode: 'held', showStop: false, stopEnabled: false, barText, barDetail, showContinue: true, continueEnabled: true, sendMode: 'message', placeholder: null, hint: null, directionsFrom: null, context: null, ...extra })
  assert.deepEqual({ ...state(on, {}) }, plain('Stopped after the last slide', 'slides 1–5 kept'), 'on: stopped, 5 of 5: the plain message, the bar and Continue as before')
  assert.deepEqual({ ...state(off, {}) }, plain('Stopped after the last slide', 'slides 1–5 kept', { sendMode: 'instructions', placeholder: 'New directions from slide 5…', hint: 'Enter sends new directions from slide 5 · Continue resumes as planned', directionsFrom: 5, context: 'New directions apply from slide 5' }), 'off: today\'s directions at 5 of 5')
  assert.deepEqual({ ...state(on, { control: 'paused', phase: 'paused' }) }, plain('Paused after the last slide', 'slides 1–5 kept'), 'on: paused, 5 of 5: the plain message too')
  assert.equal(state(off, { control: 'paused', phase: 'paused' }).sendMode, 'instructions', 'off: paused, 5 of 5: directions')
  assert.deepEqual({ ...state(on, { control: 'running', phase: 'stopped' }) }, plain('Stopped after the last slide', 'slides 1–5 kept'), 'on: the phase alone says stopped')
  assert.deepEqual({ ...state(on, { slidesDone: 6 }) }, plain('Stopped after the last slide', 'slides 1–6 kept'), 'on: more done than planned counts as every slide built')
  assert.deepEqual({ ...state(on, { slidesDone: 1, slideCount: 1 }) }, plain('Stopped after the last slide', 'slide 1 kept'), 'on: a one-slide deck')
  for (const lib of [on, off]) {
    assert.deepEqual({ ...state(lib, { slidesDone: 4 }) }, { ...plain('Stopped at slide 5', 'slides 1–4 kept'), sendMode: 'instructions', placeholder: 'New directions from slide 5…', hint: 'Enter sends new directions from slide 5 · Continue resumes as planned', directionsFrom: 5, context: 'New directions apply from slide 5' }, '4 of 5: directions, flag on or off')
    assert.equal(state(lib, { slidesDone: 0 }).sendMode, 'instructions', '0 of 5: directions, flag on or off')
    assert.equal(state(lib, { slideCount: 0 }).sendMode, 'instructions', 'unknown count: directions, flag on or off')
    assert.equal(state(lib, { slideCount: 0, slidesDone: 0 }).sendMode, 'instructions', '0 of 0: directions, flag on or off')
    assert.deepEqual(state(lib, { control: 'stop_requested' }).sendMode, 'message', 'stop_requested: unchanged'); assert.equal(state(lib, { control: 'stop_requested' }).placeholder, 'Stopping…')
    assert.equal(state(lib, { control: 'resume_requested' }).sendMode, 'wait', 'resume_requested: Enter waits, flag on or off'); assert.equal(state(lib, { control: 'resume_requested' }).placeholder, 'Resuming…')
    assert.equal(state(lib, { control: 'running', phase: 'building', slidesDone: 5 }).mode, 'running', 'running is untouched')
    assert.equal(state(lib, { enabled: false }).mode, 'idle', 'chat clean off: idle, whatever this flag says')
  }
  const noControl = state(on, { controlEnabled: false })
  assert.deepEqual({ ...noControl }, plain('Stopped after the last slide', 'slides 1–5 kept', { continueEnabled: false, hint: 'slides 1–5 kept · the build cannot be resumed from here' }), 'on, no build control: a plain message can go (it needs no control), Continue cannot, and the base\'s own no-control hint stays')
  assert.equal(state(off, { controlEnabled: false }).sendMode, 'wait', 'off, no build control: today\'s wait')
  assert.equal(state(on, { slidesDone: 4, controlEnabled: false }).sendMode, 'wait', 'on, 4 of 5, no build control: today\'s wait')
  assert.equal(state(on, { ackKey: 'not_applied', ackLine: 'x' }).sendMode, 'message', 'an old acknowledgement does not bring directions back')
  // -- no new copy: every string the fix can emit is a string the base emits for the same input ----------------------------------------------------
  const words = new Set()
  const COPY = ['barText', 'barDetail', 'placeholder', 'hint', 'context']
  GRID.forEach((input, n) => { if (IN_REGION(input)) for (const [key, value] of Object.entries(JSON.parse(onOut[n]))) if (COPY.includes(key) && typeof value === 'string') words.add(`${key}=${value}`) })
  const baseWords = new Set()
  GRID.forEach((input, n) => { if (IN_REGION(input)) for (const [key, value] of Object.entries(JSON.parse(baseOut[n]))) if (COPY.includes(key) && typeof value === 'string') baseWords.add(`${key}=${value}`) })
  for (const word of words) assert.ok(baseWords.has(word), `a string the base does not say for that input: ${word}`)
  return { regionInputs: region, inputs: GRID.length, hash: sha(offOut.join('\n')).slice(0, 12) }
}
console.log('1. the lib')
let libReport
await check('the flag; flag off hashes as the base lib over the grid; flag on differs only in the held, all-built region; the named cases; no new copy', () => { libReport = libSuite() })
if (libReport) console.log(`       (${libReport.inputs} inputs, ${libReport.regionInputs} in the region, flag-off hash ${libReport.hash})`)

// ============================================================================================================================================
// 2. The world: recorded frames, the REAL hooks, lib, ChatInput and bar, the page's REAL send handlers
// ============================================================================================================================================
const FIX = JSON.parse(read(FIXTURE))
const frame = (group, name, patch = {}) => {
  const found = FIX.frames[group]?.find(item => item.name === name)
  if (!found) throw new Error(`fixture ${FIXTURE}: no frame "${name}" in ${group}`)
  const { name: _label, ...copy } = JSON.parse(JSON.stringify(found))
  return { ...copy, payload: { ...copy.payload, ...patch } }
}
const BUILD = frame('build_start', 'build_phase building').payload.build_id
const SID = 'sess-hab'
const T0 = Date.UTC(2026, 9, 28, 13, 11, 0)
const QUESTION = 'Which slide covers the budget?'

// the page's two handlers, cut out of app/builder/page.tsx as this change left it (the later changes' marked lines out), by AST
const pageSource = ts.createSourceFile(PAGE, ownText(PAGE), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const pageSend = extract.compile(extract.findVariableInitializer(pageSource, 'chatCleanSendDirections'), pageSource, 'page.chatCleanSendDirections')
const pageContinue = extract.compile(extract.findVariableInitializer(pageSource, 'chatCleanContinue'), pageSource, 'page.chatCleanContinue')

const FILE_STUBS = records => ({
  'components/builder/studio-composer-hint': { StudioComposerHint: ({ children }) => children },
  'components/ui/dropdown-menu': { DropdownMenu: props => props.children, DropdownMenuTrigger: ({ children }) => children, DropdownMenuContent: props => props.children },
  'components/ui/switch': { Switch: () => null }, 'components/file-chip': { FileChip: () => null },
  // the field: a plain textarea that hands its ref to the proof (the harness' host nodes do not keep refs)
  'components/ui/textarea': { Textarea: React.forwardRef((props, ref) => { records.textareaRef = ref; return React.createElement('textarea', props) }) },
  'components/model-choice/model-picker': { ModelPicker: props => React.createElement('button', { type: 'button', 'data-mpick': 'gauge', disabled: Boolean(props.disabled) }) },
  'components/builder/studio-theme-menu': { StudioThemeMenu: () => null },
  'components/builder/template-picker': { TemplatePicker: () => null },
})

/** One loader per flag state (and per lib text): the flag is read when the lib loads. `libOverride` replaces the lib the modules see (the base lib, for the byte-identity run). */
async function makeEngine({ held, libOverride = null }) {
  const clock = { now: T0 }
  const FakeDate = class extends Date { constructor(...args) { if (args.length) super(...args); else super(clock.now) } static now() { return clock.now } }
  const processEnv = { NODE_ENV: 'production', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true', NEXT_PUBLIC_BUILD_NARRATION: 'true', NEXT_PUBLIC_BUILD_CONTROL: 'true', ...(held ? { [FLAG]: 'true' } : {}) }
  const records = { textareaRef: null }
  const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ templates: [], themes: [], count: 0 }) })
  const fsReal = fs.readFileSync
  if (libOverride !== null) fs.readFileSync = function (file, ...rest) { return typeof file === 'string' && path.relative(repo, file) === LIB ? libOverride : fsReal.call(fs, file, ...rest) }
  let loader, mods
  try {
    loader = createModuleLoader({
      root: repo,
      globals: { process: { env: processEnv }, console, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, Date: FakeDate, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp, TextEncoder, TextDecoder, URL, queueMicrotask, fetch: fetchFn, document: { querySelectorAll: () => [], getElementById: () => ({ scrollIntoView() {} }) } },
      stubs: { ...(await esmPackages(repo)), react: React, 'lucide-react': lucideStub(React) },
      fileStubs: FILE_STUBS(records),
    })
    mods = { narrationHook: loader.load('hooks/use-build-narration.ts'), clean: loader.load('components/builder/chat/studio-chat-clean.tsx'), cleanLib: loader.load(LIB), input: loader.load(INPUT) }
  } finally { fs.readFileSync = fsReal }
  return { clock, records, mods }
}

/** One mounted session: the page's pieces on the offline host. */
async function mount(engine, { controlEnabled = true } = {}) {
  const { clock, records, mods } = engine
  clock.now = T0
  const api = { draft: '' }
  const handlers = { current: {} }
  const calls = { buildControl: [], messages: [], toasts: [] }
  const flowBus = {}
  let requestCount = 0
  const sendBuildControl = (type, buildId) => { calls.buildControl.push({ type, buildId: buildId ?? null, instructions: flowBus.instructions ?? null }); return `req-${type}-${++requestCount}` }
  const toast = options => calls.toasts.push(options.title)
  const fakeTextarea = { style: {}, scrollHeight: 20, getBoundingClientRect: () => ({ width: 300 }), focus() {}, setSelectionRange() {}, closest: () => ({ querySelectorAll: () => [] }), get value() { return api.draft } }
  function Page() {
    const n = mods.narrationHook.useBuildNarration({ enabled: true, sessionId: SID, messages: [], currentStatus: null, slideStructure: null, isGeneratingFinal: false, isGeneratingStrawman: false, finalPresentationUrl: null, finalPresentationId: null, restoredComplete: false, keepStoppedOnFinalUrl: false, endUnbackedBuild: false })
    api.n = n
    React.useEffect(() => { handlers.current = { onBuildPhase: payload => n.onBuildPhase(payload), onBuildEvent: payload => n.onBuildEvent(payload), onSlideBuilt: payload => n.onSlideBuilt(payload) } })
    const m = n.narration
    const notes = mods.clean.useStudioChatCleanNotes({ enabled: true, sessionKey: SID, narration: { active: m.active, buildId: m.buildId, phase: m.phase, control: m.control, slidesDone: m.slidesDone, slideCount: m.slideCount }, handlers })
    api.notes = notes
    const composer = mods.cleanLib.chatCleanComposerState({ enabled: true, active: m.active, phase: m.phase, control: m.control, slidesDone: m.slidesDone, slideCount: m.slideCount, controlEnabled, ackKey: notes.ack.key, ackLine: notes.ack.line })
    api.composer = composer
    const [draft, setDraft] = React.useState('')
    api.draft = draft; api.setDraft = setDraft
    // the page's scope for its two handlers: the names app/builder/page.tsx gives them
    const scope = () => ({ chatCleanInstructions: mods.cleanLib.chatCleanInstructions, inputMessage: api.draft, chatCleanComposer: api.composer, flowBus, sendBuildControl, buildNarration: api.n.narration, toast, markNarrationControl: api.n.markControl, chatCleanNotes: api.notes, setInputMessage: api.setDraft })
    const onSendDirections = () => pageSend(scope())()
    const onContinue = () => pageContinue(scope())()
    return React.createElement(React.Fragment, null,
      React.createElement(mods.clean.StudioChatCleanBar, { composer, onContinue }),
      React.createElement(mods.input.ChatInput, {
        // the base's Send: the page hands the composer handleSendMessage, which ignores an empty draft and otherwise sends the text (the proof records it; the chain to the user_message frame is checked in section 3)
        inputMessage: draft, onInputChange: setDraft, onSubmit: () => { const text = api.draft.trim(); if (!text) return; calls.messages.push(text); api.setDraft('') }, uploadedFiles: [], onFilesSelected() {}, onRemoveFile() {}, onClearAllFiles() {}, pendingActionInput: null, onCancelAction() {},
        researchEnabled: false, onResearchEnabledChange() {}, webSearchEnabled: false, onWebSearchEnabledChange() {}, knowledgeGraphEnabled: false, onKnowledgeGraphEnabledChange() {}, showKnowledgeGraphToggle: false,
        knowledgeGraphAccess: 'unavailable', onKnowledgeGraphAccessClick() {}, isReady: true, isLoadingSession: false, connected: true, connecting: false, user: { id: 'u1' }, currentSessionId: SID, onRequestSession: async () => {}, buildTheme: { mode: 'auto' }, onBuildThemeChange() {},
        templateBuilderEnabled: true, onSelectTemplate() {}, onOpenComposerLibrary: undefined,
        studioChatClean: { composer, onStop() {}, onSendDirections, sessionId: SID },
      }))
  }
  const root = new Root()
  root.setElement(React.createElement(Page))
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 160) throw new Error('did not settle'); await macrotask(); quiet = root.flush() ? 0 : quiet + 1 } }
  await settle()
  const refresh = async () => { root.schedule(); await settle() }
  const nodes = () => hostNodes(root.tree)
  const ta = () => { const node = nodes().find(n => n.type === 'textarea'); if (records.textareaRef && typeof records.textareaRef === 'object') records.textareaRef.current = fakeTextarea; return node }
  const w = {
    api, calls, root,
    async deliver(f) {
      const type = f.type
      if (type === 'build_phase') handlers.current.onBuildPhase(f.payload, SID)
      else if (type === 'build_event') handlers.current.onBuildEvent(f.payload)
      else if (type === 'slide_built') handlers.current.onSlideBuilt(f.payload)
      else throw new Error(`world: no route for ${type}`)
      clock.now += 300; await refresh()
    },
    async markControl(control, requestId) { api.n.markControl(control, api.n.narration.buildId ?? BUILD, requestId); clock.now += 200; await refresh() },
    /** DIRECTOR-2's frames: the build starts (5 slides), `built` slides are built, the user presses Stop (or Pause) and Director acknowledges it with the slides done. */
    async buildAndHold(built, kind = 'stopped') {
      await w.deliver(frame('build_start', 'build_phase building'))
      for (let slide = 0; slide < built; slide++) await w.deliver(frame('stop', 'slide_built', { slide_index: slide }))
      if (kind === 'stopped') { await w.markControl('stop_requested', 'req-stop'); await w.deliver(frame('stop', 'build_phase stopped 1/5', { slides_done: built, control_request_id: 'req-stop' })) }
      else { await w.markControl('pause_requested', 'req-pause'); await w.deliver(frame('pause_ack', 'build_phase paused (the ack)', { slides_done: built, control_request_id: 'req-pause' })) }
    },
    /** Director's acknowledgement of the last resume request (the recorded resume ack), the way the page hands it on; nothing to acknowledge when no resume was requested. */
    async resumeAck() { const at = calls.buildControl.map(c => c.type).lastIndexOf('resume'); if (at === -1) return false; await w.deliver(frame('resume_ack', 'build_phase building (the resume ack)', { slides_done: api.n.narration.slidesDone, control_request_id: `req-resume-${at + 1}` })); return true },
    async type(value) { ta().props.onChange({ target: { value } }); await settle() },
    async enter() { const event = { key: 'Enter', shiftKey: false, nativeEvent: {}, prevented: 0, preventDefault() { this.prevented++ } }; ta().props.onKeyDown(event); await refresh(); return event },
    async submitForm() { const event = { prevented: 0, preventDefault() { this.prevented++ } }; nodes().find(n => n.type === 'form').props.onSubmit(event); await refresh(); return event },
    sendButton: () => nodes().find(n => n.props?.['data-studio-v4-send'] === 'true') ?? null,
    continueButton: () => nodes().find(n => n.props?.['data-studio-chat-clean-continue'] === 'true') ?? null,
    async pressContinue() { w.continueButton().props.onClick(); await refresh() },
    /** Everything a reader or the wire could tell flag on from flag off. */
    observe() {
      const all = nodes()
      const attr = (node, key) => node.props?.[key]
      const field = all.find(n => n.type === 'textarea')
      const hint = all.find(n => attr(n, 'data-studio-chat-clean-hint') !== undefined), context = all.find(n => attr(n, 'data-studio-chat-clean-context') !== undefined)
      const bar = all.find(n => attr(n, 'data-studio-chat-clean-bar') !== undefined), cont = w.continueButton(), send = w.sendButton()
      const markup = renderToStaticMarkup(toElements(root.tree))
      const m = api.n.narration
      return {
        phase: m.phase, control: m.control, slidesDone: m.slidesDone, slideCount: m.slideCount,
        composer: JSON.parse(JSON.stringify(api.composer)),
        placeholder: field?.props.placeholder ?? null, hint: hint ? textOf(hint) : null, context: context ? textOf(context) : null,
        bar: bar ? textOf(bar) : null, continueDisabled: cont ? Boolean(cont.props.disabled) : null, sendDisabled: send ? Boolean(send.props.disabled) : null,
        wordsOfDirections: /New directions|Enter sends new directions/.test(markup),
        notes: [...api.notes.notes.map(note => `${note.kind}: ${note.text}`)], // spread: an array of THIS realm (the hook's arrays have the loader's prototypes)
        buildControl: JSON.parse(JSON.stringify(calls.buildControl)), messages: [...calls.messages], toasts: [...calls.toasts],
        markup: sha(markup),
      }
    },
    unmount() { root.unmount() },
  }
  return w
}

/** The scripted flows, each from a fresh mount; returns the observation after each step. */
const FLOWS = {
  'stopped, 5 of 5, typed question, Enter': async w => { await w.buildAndHold(5); const held = w.observe(); await w.type(QUESTION); const typed = w.observe(); await w.enter(); const sent = w.observe(); await w.resumeAck(); return { held, typed, sent, after: w.observe() } },
  'stopped, 5 of 5, typed question, Send button (form submit)': async w => { await w.buildAndHold(5); await w.type(QUESTION); const typed = w.observe(); await w.submitForm(); return { typed, sent: w.observe() } },
  'stopped, 4 of 5, typed, Enter': async w => { await w.buildAndHold(4); await w.type(QUESTION); const typed = w.observe(); await w.enter(); const sent = w.observe(); await w.resumeAck(); return { typed, sent, after: w.observe() } },
  'stopped, 5 of 5, Continue': async w => { await w.buildAndHold(5); const held = w.observe(); await w.pressContinue(); const sent = w.observe(); await w.resumeAck(); return { held, sent, after: w.observe() } },
  'stopped, 4 of 5, Continue': async w => { await w.buildAndHold(4); const held = w.observe(); await w.pressContinue(); const sent = w.observe(); await w.resumeAck(); return { held, sent, after: w.observe() } },
  'stopped, 5 of 5, a draft typed, then Continue (the draft stays)': async w => { await w.buildAndHold(5); await w.type(QUESTION); await w.pressContinue(); return { sent: w.observe(), draft: w.api.draft } },
  'paused, 5 of 5, typed question, Enter': async w => { await w.buildAndHold(5, 'paused'); const held = w.observe(); await w.type(QUESTION); const typed = w.observe(); await w.enter(); return { held, typed, sent: w.observe() } },
  'paused, 4 of 5, typed, Enter': async w => { await w.buildAndHold(4, 'paused'); await w.type(QUESTION); const typed = w.observe(); await w.enter(); return { typed, sent: w.observe() } },
  'stopped, 5 of 5, no build control, typed, Enter': async w => { await w.buildAndHold(5); await w.type(QUESTION); const typed = w.observe(); await w.enter(); return { typed, sent: w.observe() } },
  'stopped, 5 of 5, nothing typed, Enter': async w => { await w.buildAndHold(5); await w.enter(); return { sent: w.observe() } },
}
const NO_CONTROL = new Set(['stopped, 5 of 5, no build control, typed, Enter'])
const runFlows = async engine => {
  const out = {}
  for (const [name, flow] of Object.entries(FLOWS)) { const w = await mount(engine, { controlEnabled: !NO_CONTROL.has(name) }); try { out[name] = await flow(w) } finally { w.unmount() } }
  return out
}

console.log('2. the world: recorded frames, the real hooks, lib, ChatInput and bar, the page\'s real send handlers')
let baseRun, offRun, onRun
await check('the engines load (one loader per flag state; the base lib is this lib with the marked lines stripped)', async () => {
  baseRun = await runFlows(await makeEngine({ held: false, libOverride: baseText(LIB) }))
  offRun = await runFlows(await makeEngine({ held: false }))
  onRun = await runFlows(await makeEngine({ held: true }))
  for (const run of [baseRun, offRun, onRun]) assert.equal(Object.keys(run).length, Object.keys(FLOWS).length)
})
const FL = Object.keys(FLOWS)
const step = (run, flow, name) => run[flow][name]
if (baseRun && offRun && onRun) {
  await check('the recorded frames reproduce the state: the narration is stopped with 5 of 5 (and 4 of 5, paused) built', () => {
    const held = step(offRun, FL[0], 'held')
    assert.deepEqual([held.phase, held.control, held.slidesDone, held.slideCount], ['stopped', 'stopped', 5, 5])
    assert.equal(held.bar, 'Stopped after the last slide · slides 1–5 keptContinue')
    const four = step(offRun, FL[2], 'typed'); assert.deepEqual([four.phase, four.control, four.slidesDone, four.slideCount], ['stopped', 'stopped', 4, 5])
    const paused = step(offRun, FL[6], 'held'); assert.deepEqual([paused.phase, paused.control, paused.slidesDone, paused.slideCount], ['paused', 'paused', 5, 5]); assert.equal(paused.bar, 'Paused after the last slide · slides 1–5 keptContinue')
  })
  await check('FLAG OFF is byte-identical to the base: every flow\'s every checkpoint (state, bar, composer, notes, calls, the whole composer markup hash) equals the base lib\'s', () => {
    for (const flow of FL) assert.deepEqual(diffPaths(offRun[flow], baseRun[flow], flow), [], flow)
    assert.equal(sha(JSON.stringify(offRun)), sha(JSON.stringify(baseRun)))
  })
  await check('TODAY (flag off), the E2E-2 transcript: stopped with 5 of 5, a typed question is a resume with the text as instructions, a directions note, "Resumed · building from slide 5"; the question is not sent', () => {
    const f = offRun[FL[0]]
    assert.equal(f.held.placeholder, 'New directions from slide 5…'); assert.equal(f.held.hint, 'Enter sends new directions from slide 5 · Continue resumes as planned'); assert.equal(f.held.context, 'New directions apply from slide 5')
    assert.equal(f.typed.sendDisabled, false, 'Send is enabled for the draft (the directions gate)')
    assert.deepEqual(f.sent.buildControl, [{ type: 'resume', buildId: BUILD, instructions: QUESTION }], 'build_control resume, the question as instructions')
    assert.deepEqual(f.sent.messages, [], 'no plain message')
    assert.ok(f.sent.notes.includes(`directions: ${QUESTION}`), 'the directions note'); assert.equal(f.sent.composer.mode, 'resuming')
    assert.ok(f.after.notes.includes('resumed: Resumed · building from slide 5'), 'the thread says "Resumed · building from slide 5"')
    const button = offRun[FL[1]]; assert.deepEqual(button.sent.buildControl, [{ type: 'resume', buildId: BUILD, instructions: QUESTION }], 'the Send button does the same'); assert.deepEqual(button.sent.messages, [])
  })
  await check('FLAG ON: stopped with 5 of 5, a typed question (Enter and the Send button) is a plain message: no build_control, no directions note, no "Resumed" note, no directions words anywhere', () => {
    for (const flow of [FL[0], FL[1]]) {
      const f = onRun[flow]
      assert.equal(f.typed.composer.sendMode, 'message')
      assert.equal(f.typed.placeholder, 'Message Director...', 'the base\'s own placeholder'); assert.equal(f.typed.hint, null, 'no chat-clean hint (the base\'s own hint shows)'); assert.equal(f.typed.context, null)
      assert.equal(f.typed.wordsOfDirections, false, 'no "New directions" words in the composer or the bar')
      assert.equal(f.typed.sendDisabled, false, 'Send is enabled for the draft by the base\'s own rule')
      assert.equal(f.typed.bar, 'Stopped after the last slide · slides 1–5 keptContinue', 'the bar is unchanged'); assert.equal(f.typed.continueDisabled, false, 'Continue is enabled')
      assert.deepEqual(f.sent.buildControl, [], 'NO build_control'); assert.deepEqual(f.sent.messages, [QUESTION], 'the base\'s send got the question')
      assert.deepEqual(f.sent.notes, ['stopped: Stopped after the last slide · slides 1–5 kept'], 'no directions note, no resumed note')
      assert.equal(f.sent.control, 'stopped'); assert.equal(f.sent.composer.mode, 'held', 'the build is still held (a plain message resumes nothing)')
      assert.deepEqual(f.sent.toasts, [])
    }
    assert.deepEqual(onRun[FL[0]].after.notes, ['stopped: Stopped after the last slide · slides 1–5 kept'], 'and nothing "resumed" follows (nothing was requested)')
  })
  await check('4 of 5 built: directions exactly as today, flag on or off (every checkpoint equal)', () => { assert.deepEqual(diffPaths(onRun[FL[2]], offRun[FL[2]]), []); const f = onRun[FL[2]]; assert.equal(f.typed.placeholder, 'New directions from slide 5…'); assert.deepEqual(f.sent.buildControl, [{ type: 'resume', buildId: BUILD, instructions: QUESTION }]); assert.deepEqual(f.sent.messages, []) })
  await check('Continue is unchanged either way: 5 of 5 and 4 of 5 resume as planned (no instructions), "Resumed · building from slide N"; a draft typed before Continue stays in the box', () => {
    for (const flow of [FL[3], FL[4], FL[5]]) { assert.deepEqual(diffPaths(onRun[flow].sent, offRun[flow].sent, flow), [], `${flow}: after the click`); if (onRun[flow].after) assert.deepEqual(diffPaths(onRun[flow].after, offRun[flow].after, flow), [], `${flow}: after Director's ack`) }
    for (const flow of [FL[3], FL[4]]) { const on = onRun[flow].held, off = offRun[flow].held; assert.deepEqual([on.bar, on.continueDisabled, on.phase, on.control, on.composer.mode, on.composer.showContinue, on.composer.continueEnabled], [off.bar, off.continueDisabled, off.phase, off.control, off.composer.mode, off.composer.showContinue, off.composer.continueEnabled], `${flow}: the bar and Continue before the click`) }
    for (const run of [offRun, onRun]) {
      assert.deepEqual(run[FL[3]].sent.buildControl, [{ type: 'resume', buildId: BUILD, instructions: null }]); assert.equal(run[FL[3]].sent.composer.mode, 'resuming')
      assert.ok(run[FL[3]].after.notes.includes('resumed: Resumed · building from slide 5')); assert.ok(run[FL[4]].after.notes.includes('resumed: Resumed · building from slide 5'))
      assert.equal(run[FL[5]].draft, QUESTION, 'the draft stays')
    }
  })
  await check('PAUSED with every slide built (what it does and why): flag on, the typed message is a plain message, like stopped, because nothing is left to direct and the worst a plain message can do while paused is what Continue does; flag off is today\'s resume; paused 4 of 5 is directions either way', () => {
    const off = offRun[FL[6]], on = onRun[FL[6]]
    assert.equal(off.held.bar, 'Paused after the last slide · slides 1–5 keptContinue'); assert.equal(on.held.bar, 'Paused after the last slide · slides 1–5 keptContinue')
    assert.deepEqual(off.sent.buildControl, [{ type: 'resume', buildId: BUILD, instructions: QUESTION }])
    assert.deepEqual(on.sent.buildControl, []); assert.deepEqual(on.sent.messages, [QUESTION]); assert.equal(on.typed.wordsOfDirections, false); assert.deepEqual(on.sent.notes, ['paused: Paused after the last slide · slides 1–5 kept'])
    assert.deepEqual(diffPaths(onRun[FL[7]], offRun[FL[7]]), []); assert.equal(onRun[FL[7]].typed.composer.sendMode, 'instructions')
  })
  await check('no build control (NEXT_PUBLIC_BUILD_CONTROL off): 5 of 5 flag on lets the plain message go (it needs no control); flag off waits as today; Continue is disabled either way', () => {
    const off = offRun[FL[8]], on = onRun[FL[8]]
    assert.equal(off.typed.composer.sendMode, 'wait'); assert.deepEqual(off.sent.messages, []); assert.deepEqual(off.sent.buildControl, [])
    assert.equal(on.typed.composer.sendMode, 'message'); assert.deepEqual(on.sent.messages, [QUESTION]); assert.deepEqual(on.sent.buildControl, [])
    assert.equal(off.typed.continueDisabled, true); assert.equal(on.typed.continueDisabled, true)
    assert.equal(on.typed.hint, 'slides 1–5 kept · the build cannot be resumed from here', 'the base\'s own no-control hint')
  })
  await check('nothing typed: Enter sends nothing, flag on or off', () => { assert.deepEqual(onRun[FL[9]].sent.messages, []); assert.deepEqual(onRun[FL[9]].sent.buildControl, []); assert.deepEqual(offRun[FL[9]].sent.buildControl, []) })
}

// ============================================================================================================================================
// 3. Wiring and the strip
// ============================================================================================================================================
console.log('3. wiring and the strip')
const literalsOf = (text, file) => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const found = []
  const visit = node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) found.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
function wiringSuite(sources) {
  const own = sources.lib
  const base = stripHeldAllBuilt(LIB, own)
  const added = own.split('\n').filter(line => HELD_ALL_BUILT_MARKER_RE.test(line))
  assert.equal(added.length, 3, 'three marked lines: the flag, the comment, the early return')
  assert.equal(own.split('\n').length - base.split('\n').length, 3, 'and nothing else is added')
  assert.ok(!/CHAT-CLEAN-HELD-ALL-BUILT/.test(base), 'the strip takes every line that carries the marker')
  assert.equal(stripHeldAllBuilt(LIB, stripHeldAllBuilt(LIB, own)), base, 'stripping twice changes nothing more')
  const flagLine = added.find(line => line.includes('process.env.')), returnLine = added.find(line => line.includes('return {')), comment = added.find(line => /^\s*\/\//.test(line))
  assert.ok(flagLine && returnLine && comment)
  assert.equal(flagLine, "export const STUDIO_CHAT_CLEAN_HELD_ALL_BUILT_ENABLED = chatCleanFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT)" + flagLine.slice(flagLine.indexOf(' // CHAT-CLEAN-HELD-ALL-BUILT')), 'the flag is read inline (a literal process.env read, so Next inlines it) through the exact-"true" rule')
  assert.equal((own.match(/process\.env\./g) ?? []).length, 2, 'the lib reads exactly two env names: chat clean and this flag')
  assert.ok(returnLine.startsWith('    if (STUDIO_CHAT_CLEAN_HELD_ALL_BUILT_ENABLED && '), 'the early return is behind the flag')
  assert.ok(own.indexOf(returnLine) > own.indexOf('  if (held) {') && own.indexOf(returnLine) < own.indexOf("    // Director's contract: a plain message after a stop never rebuilds"), 'inside the held branch, before the base\'s directions return')
  assert.ok(!/^\s*import\s/m.test(own) && !/\brequire\(/.test(own), 'the lib stays import-free')
  const had = new Set(literalsOf(base, LIB))
  for (const literal of literalsOf(added.join('\n'), LIB)) assert.ok(had.has(literal), `a string the base lib does not have: ${JSON.stringify(literal)}`)
  assert.ok(new Set(literalsOf(returnLine, LIB)).size > 0 && [...literalsOf(returnLine, LIB)].every(literal => had.has(literal)), 'no new copy: every string in the fix is one the base lib already has')
  // the page and the composer are the base's: no line of this change in them, and the page's handlers are the ones the proof ran
  for (const rel of [PAGE, INPUT, 'components/builder/chat/studio-chat-clean.tsx']) assert.ok(!HELD_ALL_BUILT_MARKER_RE.test(sources.files[rel]), `${rel} carries none of this change's lines`)
  assert.ok(/const chatCleanSendDirections = \(\) => \{ const text = chatCleanInstructions\(inputMessage\); if \(!text \|\| chatCleanComposer\.sendMode !== 'instructions'\) return; flowBus\.instructions = text;/.test(sources.files[PAGE]), 'the page\'s handler still returns unless sendMode is instructions')
  assert.ok(/if \(chatClean && chatClean\.composer\.sendMode !== 'message'\) \{ e\?\.preventDefault\(\); if \(chatClean\.composer\.sendMode !== 'wait' && inputMessage\.trim\(\)\) chatClean\.onSendDirections\(\); return \}/.test(sources.files[INPUT]), 'the composer falls through to the base submit for sendMode message')
  assert.ok(/isSubmitDisabled = \(studio \? !user \|\| isLoadingSession : !isReady\) \|\| !inputMessage\.trim\(\) \|\| isSendBlocked/.test(sources.files[INPUT]), 'Send is enabled by the base\'s own rule')
}
const wiringSources = () => ({ lib: ownText(LIB), files: { [PAGE]: ownText(PAGE), [INPUT]: ownText(INPUT), 'components/builder/chat/studio-chat-clean.tsx': ownText('components/builder/chat/studio-chat-clean.tsx') } })
await check('the marked lines (flag, comment, early return), the inline exact-"true" flag read, import-free, no new string literal, the page and composer untouched', () => wiringSuite(wiringSources()))
await check('the page\'s send chain: ChatInput onSubmit is handleSendMessage; its body has no build control, flow bus or chat clean; its sends are sendTypedTurn -> sendMessageWhenConnected; the socket hook\'s frame is type "user_message"', () => {
  const page = ownText(PAGE)
  const input = extract.jsxAttributes(pageSource, 'ChatInput')
  assert.equal(input.onSubmit.text, 'handleSendMessage', 'the composer\'s submit is the page\'s handleSendMessage')
  const body = extract.useCallbackFunction(pageSource, 'handleSendMessage').getText(pageSource)
  assert.ok(body.length > 5000, 'the real handler'); assert.doesNotMatch(body, /sendBuildControl|build_control|flowBus|chatClean|markNarrationControl/, 'no build control, no flow bus, no chat clean in a plain send')
  const sites = extract.sendCallSites(pageSource).filter(site => /^(sendTypedTurn|success|\(module\))$/.test(site.enclosing))
  assert.ok(sites.some(site => site.enclosing === 'sendTypedTurn' && site.callee === 'sendMessageWhenConnected'), 'sendTypedTurn sends through sendMessageWhenConnected')
  assert.ok(sites.some(site => site.enclosing === 'success' && site.callee === 'sendTypedTurn'), 'handleSendMessage sends through sendTypedTurn')
  assert.ok(/const handleSendMessage = useCallback\(/.test(page) && page.indexOf('sendTypedTurn') > page.indexOf('const handleSendMessage = useCallback('), 'declared in the page')
  const hook = read('hooks/use-deckster-websocket-v2.ts')
  assert.ok(/const buildUserMessage = \(\): UserMessage => \{[\s\S]{0,900}type: 'user_message',/.test(hook), 'the socket hook builds type "user_message"')
})
const baseAt = rel => execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 })
const stripIdentity = (rel, text) => assert.equal(otherStrips(rel, stripHeldAllBuilt(rel, text)), otherStrips(rel, baseAt(rel)), `${rel}: without this change's lines the file is the base's, byte for byte`)
await check('the strip gives the base lib back byte for byte: working tree and BASE, other strips applied to both sides', () => {
  for (const rel of HELD_ALL_BUILT_FILES) stripIdentity(rel, read(rel))
  assert.deepEqual(HELD_ALL_BUILT_FILES, [LIB]); assert.deepEqual(Object.keys(HELD_ALL_BUILT_PIN_EDITS), [], 'no older proof is taught: none reads the lib in a way this change breaks')
  assert.equal(stripHeldAllBuilt('app/builder/page.tsx', 'x // CHAT-CLEAN-HELD-ALL-BUILT\n'), 'x // CHAT-CLEAN-HELD-ALL-BUILT\n', 'a file the change does not own is returned as it is')
  assert.equal(stripHeldAllBuilt(LIB, 'a\nb // CHAT-CLEAN\nc // CHAT-CLEAN-HELD-ALL-BUILT-X\nd // X-CHAT-CLEAN-HELD-ALL-BUILT\ne // CHAT-CLEAN-HELD-ALL-BUILT\n'), 'a\nb // CHAT-CLEAN\nc // CHAT-CLEAN-HELD-ALL-BUILT-X\nd // X-CHAT-CLEAN-HELD-ALL-BUILT\n', 'the marker is a whole token')
})

// ============================================================================================================================================
// 4. Mutants
// ============================================================================================================================================
console.log('4. mutants')
const FLAGLINE = 'chatCleanFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT)'
const MUTANTS = [
  ['the flag is ignored (always on)', 'STUDIO_CHAT_CLEAN_HELD_ALL_BUILT_ENABLED && Number.isSafeInteger(input.slideCount)', 'Number.isSafeInteger(input.slideCount)'],
  ['the flag is inverted', FLAGLINE, `!${FLAGLINE}`],
  ['any non-empty value turns it on', FLAGLINE, 'Boolean(process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT)'],
  ['"every slide built" needs one more (> instead of >=)', 'input.slidesDone >= input.slideCount) return', 'input.slidesDone > input.slideCount) return'],
  ['"every slide built" is one early (4 of 5 counts)', 'input.slidesDone >= input.slideCount) return', 'input.slidesDone >= input.slideCount - 1) return'],
  ['an unknown count (0) counts as every slide built', 'Number.isSafeInteger(input.slideCount) && input.slideCount > 0 && Number.isSafeInteger(input.slidesDone)', 'Number.isSafeInteger(input.slidesDone)'],
  ['a fractional done count is accepted', 'Number.isSafeInteger(input.slidesDone) && input.slidesDone >= input.slideCount', 'input.slidesDone >= input.slideCount'],
  ['Continue is dropped from the bar', 'barDetail: chatCleanSlidesKept(input.slidesDone), showContinue: true, continueEnabled: input.controlEnabled, hint: input.controlEnabled', 'barDetail: chatCleanSlidesKept(input.slidesDone), showContinue: false, continueEnabled: input.controlEnabled, hint: input.controlEnabled'],
  ['Continue is disabled', 'continueEnabled: input.controlEnabled, hint: input.controlEnabled', 'continueEnabled: false, hint: input.controlEnabled'],
  ['the directions context stays', '{ ...COMPOSER_IDLE, mode: \'held\', barText:', '{ ...COMPOSER_IDLE, context: \'New directions apply from slide 5\', mode: \'held\', barText:'],
  ['the directions placeholder stays', '{ ...COMPOSER_IDLE, mode: \'held\', barText:', '{ ...COMPOSER_IDLE, placeholder: \'New directions from slide 5…\', mode: \'held\', barText:'],
  ['the directions hint stays', 'hint: input.controlEnabled ? null :', 'hint: input.controlEnabled ? \'Enter sends new directions from slide 5 · Continue resumes as planned\' :'],
  ['the send mode waits without the control flag', '{ ...COMPOSER_IDLE, mode: \'held\', barText:', '{ ...COMPOSER_IDLE, sendMode: input.controlEnabled ? \'message\' : \'wait\', mode: \'held\', barText:'],
  ['the no-control hint is dropped', 'hint: input.controlEnabled ? null : `${chatCleanSlidesKept(input.slidesDone)} · the build cannot be resumed from here` }', 'hint: null }'],
  ['paused reads as stopped on the bar', 'barText: chatCleanHeldAt(kind, input.slidesDone, input.slideCount), barDetail: chatCleanSlidesKept(input.slidesDone), showContinue: true, continueEnabled: input.controlEnabled, hint', 'barText: chatCleanHeldAt(\'stopped\', input.slidesDone, input.slideCount), barDetail: chatCleanSlidesKept(input.slidesDone), showContinue: true, continueEnabled: input.controlEnabled, hint'],
  ['the mode is not held', '{ ...COMPOSER_IDLE, mode: \'held\', barText:', '{ ...COMPOSER_IDLE, mode: \'idle\', barText:'],
  ['the slim bar loses its detail', 'barDetail: chatCleanSlidesKept(input.slidesDone), showContinue: true, continueEnabled: input.controlEnabled, hint: input.controlEnabled', 'barDetail: null, showContinue: true, continueEnabled: input.controlEnabled, hint: input.controlEnabled'],
  ['everything held becomes a plain message (4 of 5 too)', "sendMode: input.controlEnabled ? 'instructions' : 'wait',", "sendMode: 'message',"],
  ['4 of 5 loses its directions placeholder', 'placeholder: `New directions from slide ${from}…`', 'placeholder: `Directions from slide ${from}…`'],
  ['resume_requested stops waiting', "showContinue: true, continueEnabled: false, sendMode: 'wait', placeholder: CHAT_CLEAN_WORDS.placeholderResuming,", "showContinue: true, continueEnabled: false, sendMode: 'message', placeholder: CHAT_CLEAN_WORDS.placeholderResuming,"],
  ['stop_requested loses its placeholder', "sendMode: 'message',\n      placeholder: CHAT_CLEAN_WORDS.placeholderStopping,", "sendMode: 'message',\n      placeholder: null,"],
]
const caughtBy = []
for (const [name, from, to] of MUTANTS) {
  await check(`mutant caught: ${name}`, () => {
    const source = ownText(LIB)
    const at = source.indexOf(from)
    assert.ok(at !== -1 && source.indexOf(from, at + 1) === -1, `mutant "${name}": anchor not found exactly once in ${LIB}`)
    let by = null
    try { libSuite(source.replace(from, () => to), baseText(LIB)) } catch (error) { by = String(error?.message ?? error).split('\n')[0].slice(0, 90) }
    assert.ok(by, 'MUTANT SURVIVED')
    caughtBy.push(`  ${name.slice(0, 58).padEnd(58)} ${by}`)
  })
}
await check('mutant caught: an unmarked line added to the lib is not stripped (the strip gives the base back only for marked lines)', () => {
  const mutated = read(LIB).replace('export const STUDIO_CHAT_CLEAN_ENABLED', 'const extra = 1\nexport const STUDIO_CHAT_CLEAN_ENABLED')
  assert.throws(() => stripIdentity(LIB, mutated), /without this change's lines/)
  assert.throws(() => stripIdentity(LIB, read(LIB).replace('    // CHAT-CLEAN-HELD-ALL-BUILT:', '    // a marker-less comment:')), /without this change's lines/, 'a marked line that lost its marker')
})
await check('mutant caught: a new string in the fix, a second process.env read and an import in the lib are caught by the wiring check', () => {
  const lib = ownText(LIB)
  assert.throws(() => wiringSuite({ ...wiringSources(), lib: lib.replace('hint: input.controlEnabled ? null : `', 'hint: input.controlEnabled ? \'Nothing left to build\' : `') }), /does not have|no new copy/)
  assert.throws(() => wiringSuite({ ...wiringSources(), lib: lib.replace('chatCleanFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT)', "chatCleanFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN_HELD_ALL_BUILT) && process.env.NEXT_PUBLIC_X !== 'no'") }), undefined)
  assert.throws(() => wiringSuite({ ...wiringSources(), lib: "import { x } from './y'\n" + lib }), undefined)
})
await check('mutant caught: a line of this change in the page or the composer, and a page handler that no longer returns unless sendMode is instructions', () => {
  const s = wiringSources()
  assert.throws(() => wiringSuite({ ...s, files: { ...s.files, [PAGE]: s.files[PAGE] + '\nconst x = 1 // CHAT-CLEAN-HELD-ALL-BUILT\n' } }), /carries none/)
  assert.throws(() => wiringSuite({ ...s, files: { ...s.files, [PAGE]: s.files[PAGE].replace("chatCleanComposer.sendMode !== 'instructions') return", "false) return") } }), /returns unless/)
  assert.throws(() => wiringSuite({ ...s, files: { ...s.files, [INPUT]: s.files[INPUT].replace("chat-clean-send-gate", 'x').replace("chatClean.composer.sendMode !== 'message') { e?.preventDefault()", "chatClean.composer.sendMode !== 'never') { e?.preventDefault()") } }), /falls through/)
})
// the E2E result itself is a mutant too: a lib that keeps sending directions at 5 of 5 fails the world (flag on)
await check('mutant caught by the world: with the fix removed (flag on, the base lib) the plain-message flows fail', async () => {
  const engine = await makeEngine({ held: true, libOverride: baseText(LIB) })
  const w = await mount(engine)
  try { await FLOWS[FL[0]](w); const sent = w.observe(); assert.notDeepEqual(sent.buildControl, [], 'the base lib sends the resume') } finally { w.unmount() }
})

// ============================================================================================================================================
// 5. Scope over the COMMITTED diff (BASE..head), gate-safe and robust after merge
// ============================================================================================================================================
console.log('5. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-28T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-28T00:00:00Z' }
const plumb = (args, input) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', ...(input === undefined ? {} : { input }), env: { ...process.env, ...GIT_IDENT }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run). */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hab-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = sha => git('rev-list', '--parents', '-n', '1', sha).trim().split(/\s+/).slice(1)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(HELD_ALL_BUILT_SUBJECT))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits, whether or not dev has moved past BASE) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it, whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const sha = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(sha)
  if (!gateRule || parents.length !== 2) return sha
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : sha
}
const REAL = { // what a head is read through: every other registered change (both sides of a comparison), the registered files
  files: registry.LATER_CHANGE_FILES, norm: otherStrips,
  env: text => registry.stripLaterEnvBlocks('.env.example', text),
}
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
/** `git diff -U0` of the base file against the file at `head`, both read through ctx.norm (every other change's lines out). */
const normDiff = (ctx, rel, head) => {
  return git('diff', '-U0', blobOf(ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`))))
}
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  return own
}
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].sort(), [...HELD_ALL_BUILT_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of HELD_ALL_BUILT_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, HELD_ALL_BUILT_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.equal(diff.length, 3, `${rel}: the number of added lines`)
    assert.equal(stripHeldAllBuilt(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of stripModule.HELD_ALL_BUILT_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['app/builder/page.tsx', INPUT, 'components/builder/chat/studio-chat-clean.tsx']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(HELD_ALL_BUILT_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${HELD_ALL_BUILT_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-chat-clean-held-all-built-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['HELD_ALL_BUILT_SCOPE_FILES', 'HELD_ALL_BUILT_ENV_BLOCK', 'stripHeldAllBuilt'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${HELD_ALL_BUILT_SUBJECT}", found across the whole line, no merges) exist, with the co-author line`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to the lib is a pure insertion that carries the marker; the strip gives the base back byte for byte (other changes\' lines out of both sides)', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of ['scripts/test-studio-chat-clean-held-all-built.mjs', 'scripts/studio-chat-clean-held-all-built-strip.mjs', LIB]) assert.doesNotMatch(fs.readFileSync(path.join(repo, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
// GATE-SAFE: the gate's merge (first parent dev, second parent this change's head; the tree is `git merge-tree --write-tree dev head`) and the whole scope section against it
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE))
  scopeEnvAndRegistry(GATE)
  assert.equal(stripHeldAllBuilt(LIB, otherStrips(LIB, git('show', `${GATE}:${LIB}`))), otherStrips(LIB, git('show', `${BASE_COMMIT}:${LIB}`)), 'the merged tree, without this change\'s lines, is the base\'s lib')
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hab-idx-'))
  try {
    const env = { ...process.env, ...GIT_IDENT, GIT_INDEX_FILE: path.join(dir, 'index') }
    const viaIndex = (...a) => execFileSync('git', a, { cwd: repo, env, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    viaIndex('read-tree', parent)
    for (const [rel, text] of Object.entries(edits)) viaIndex('update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`)
    return plumb(['commit-tree', viaIndex('write-tree'), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
// a merge onto an ADVANCED dev: a commit on dev after BASE that touches an unrelated file; the gate's first parent is no longer BASE
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await check('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE (an unrelated commit): the scope head is still this change\'s head and the scope section passes; the unrelated commit is not this change\'s concern', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
// a SYNTHETIC change stacked after this one: marked lines in the lib (next to this change's own), in the page, a registry trio below this change's, an .env.example block, a new file
const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
const syntheticStrip = (rel, text) => (rel === LIB || rel === PAGE) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const lib = at(LIB).split('\n').flatMap(line => {
    if (line.startsWith('export const STUDIO_CHAT_CLEAN_HELD_ALL_BUILT_ENABLED')) return [line, `export const SYNTHETIC_LATER_ENABLED = false // ${SYN.marker}`]
    if (line.includes("return { ...COMPOSER_IDLE, mode: 'held'")) return [line, `    if (SYNTHETIC_LATER_ENABLED) return COMPOSER_IDLE // ${SYN.marker}`]
    return [line]
  }).join('\n')
  const page = at(PAGE).replace('\n', `\nconst syntheticLater = 1 // ${SYN.marker}\n`)
  const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('HELD_ALL_BUILT_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('HELD_ALL_BUILT_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripHeldAllBuilt')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  return commitWith(parent, { [LIB]: lib, [PAGE]: page, 'scripts/studio-later-changes.mjs': reg, '.env.example': `${at('.env.example')}\n${SYN.block}`, [SYN.file]: 'export const SYNTHETIC_SCOPE_FILES = new Set()\n' }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC = syntheticCommit(HEAD)
const SYN_CTX = {
  files: new Set([...registry.LATER_CHANGE_FILES, SYN.file]),
  norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)),
  env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''),
}
await check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked lines beside this change\'s in the lib, a page line, a registry trio, an .env.example block, a new file; its own commit has another subject) leaves this change\'s scope section passing, on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  assert.ok(ownOf(SYNTHETIC).length === ownOf(HEAD).length && !ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  assert.equal(stripHeldAllBuilt(LIB, SYN_CTX.norm(LIB, git('show', `${gate}:${LIB}`))), SYN_CTX.norm(LIB, git('show', `${BASE_COMMIT}:${LIB}`)), 'the merged tree is the base\'s lib without this change\'s and the later change\'s lines')
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its lib lines are unmarked additions, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|number of added lines/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray non-B40 file in a "Held all built:" commit fails the committed-files check (the own commits are found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-held-all-built.txt': 'stray\n' }, `${HELD_ALL_BUILT_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, and an unmarked line added to the lib in an own commit, fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${HELD_ALL_BUILT_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  const sneaky = commitWith(HEAD, { [LIB]: git('show', `${HEAD}:${LIB}`).replace('export const STUDIO_CHAT_CLEAN_ENABLED', 'const sneaky = 1\nexport const STUDIO_CHAT_CLEAN_ENABLED') }, `${HELD_ALL_BUILT_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/)
})

release()
console.log('mutants (each caught by):'); for (const line of caughtBy) console.log(line)
console.log('flows (flag off -> flag on), what Enter / Send does:')
if (offRun && onRun) {
  const outcome = o => (o.buildControl.length ? 'resume + instructions' : o.messages.length ? 'plain message' : 'nothing sent')
  for (const flow of FL) { const o = offRun[flow].sent ?? offRun[flow].held, n = onRun[flow].sent ?? onRun[flow].held; console.log(`  ${flow.padEnd(66)} ${outcome(o).padEnd(22)} -> ${outcome(n)}`) }
}
console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
