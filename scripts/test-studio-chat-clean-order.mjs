// FRONTEND-2 (B31; E2E-2 live run c737ffe5, Studio dev, 27 Oct): proof of NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER (exact "true", default off, build-time; it needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN).
//
// THE DEFECTS (v3.1 chat clean thread, lib/studio-chat-clean-order.ts has the root causes with file and line):
//   1. The job card's one line stayed "Packaging your outline and picking a theme…" (Director's last canned progress line, mirrored as a deck-scope build_event) at the outline gate and, after the build started, under "Building slides".
//      lib/studio-chat-clean.ts chatCleanJobModel: `line = latestEventText || phaseLabel || title`; nothing retires a deck event when the phase moves on.
//   2. The Paused / Stopped / Resumed notes and the user's directions bubble were drawn after the LAST transcript row (components/builder/chat/studio-chat-clean.tsx StudioChatCleanJob, mounted at the end of
//      components/builder/message-list.tsx), so they followed Director's later replies (its stop replies).
//
// THE FIX (flag on). (1) The card's line closes when the phase, the build, the outline (slide_update) or the newest approval card changes (DIRECTOR-2's frame order, scripts/fixtures/chat-clean-order/outline-gate-director2-27oct.json), and
// shows no event at the outline gate; the card's own words stand in (the phase's label). (2) Each note is drawn between the transcript rows, by time.
//
//   1. The lib, function by function: the flag (and chat clean), a row's time, where each note goes, the hidden stop note, the newest approval card, the line's step and visibility.
//   2. DEFECT 1, through the REAL narration hook and reducer, the REAL notes hook, the REAL MessageList and tail: DIRECTOR-2's frames from plan approval to the outline card, the build start; flag off is today's output, flag on is the fix.
//   3. DEFECT 2, the same pieces: pause, resume with directions, stop, Director's stop reply, resume again; flag off is today's output, flag on is chronological.
//   4. Otherwise unchanged: a normal build, pause / resume and stop / continue, with the flag on, are flag off's at every checkpoint but the line the fix closes and the notes' places.
//   5. Flag off is byte-identical to the base: every checkpoint's markup hashes as the markup of the base MessageList (this tree's message-list.tsx with the marked lines stripped, which section 7 proves is the base file).
//   6. Mutants: each must be caught.
//   7. The sources: every marked line is a pure insertion, the strip gives the base back byte for byte, the registry, .env.example, and the scope over the COMMITTED diff (BASE..HEAD, first-parent, no merges, prefix "Clean chat order:"). GATE-SAFE: when HEAD is the gate's local --no-ff merge (first parent BASE, second parent this change's head) every scope query runs against HEAD^2; proved on a gate-style merge built here, and a mutant that drops that rule is caught.
//
//   node scripts/test-studio-chat-clean-order.mjs
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed; the loader's clock is a fake one); git is read only for 7.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER'
const LIB = 'lib/studio-chat-clean-order.ts'
const TAIL = 'components/builder/chat/studio-chat-clean-order.tsx'
const LIST = 'components/builder/message-list.tsx'
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
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-chat-clean-order-strip.mjs')
const { stripChatCleanOrder, BASE_COMMIT, CHAT_CLEAN_ORDER_FILES, CHAT_CLEAN_ORDER_NEW_FILES, CHAT_CLEAN_ORDER_SCOPE_FILES, CHAT_CLEAN_ORDER_ENV_BLOCK, CHAT_CLEAN_ORDER_SUBJECT, CHAT_CLEAN_ORDER_MARKER_RE, CHAT_CLEAN_ORDER_PIN_EDITS } = stripModule
const release = installHostNetworkGuard(net, dns)
const macrotask = () => new Promise(resolve => setImmediate(resolve))
const plain = value => JSON.parse(JSON.stringify(value)) // values built inside the loader's vm have their own prototypes

// ---- the lib, evaluated in THIS realm with a fake process -----------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function loadLib(text = read(LIB), env = { [FLAG]: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' }) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, LIB))(module, module.exports, () => { throw new Error('the lib must stay import-free') }, { env })
  return module.exports
}

// ============================================================================================================================================
// 1. The lib
// ============================================================================================================================================
function libChecks(libText = read(LIB)) {
  const lib = loadLib(libText)
  // -- the flag, and chat clean ---------------------------------------------------------------------------------------------------------
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['', false], ['true', true]]) assert.equal(lib.chatCleanOrderFlagOn(value), want, `flag ${JSON.stringify(value)}`)
  const enabled = env => loadLib(libText, env).STUDIO_CHAT_CLEAN_ORDER_ENABLED
  assert.equal(enabled({}), false, 'unset: off')
  assert.equal(enabled({ [FLAG]: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' }), true, 'both "true": on')
  assert.equal(enabled({ [FLAG]: 'true' }), false, 'the order flag without chat clean: off (the thread it orders does not exist)')
  assert.equal(enabled({ NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' }), false, 'chat clean without the order flag: off')
  assert.equal(enabled({ [FLAG]: 'yes', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true' }), false, '"yes": off')
  // -- a row's time ---------------------------------------------------------------------------------------------------------------------------
  const time = lib.chatCleanRowTime
  assert.equal(time({ messageType: 'user', id: 'u', text: 'x', timestamp: 1234 }), 1234, 'a user turn: its timestamp')
  assert.equal(time({ messageType: 'bot', type: 'chat_message', timestamp: '2026-10-27T16:59:00Z', clientTimestamp: 77 }), 77, 'a Director frame: its arrival stamp first')
  assert.equal(time({ messageType: 'bot', type: 'chat_message', timestamp: '2026-10-27T16:59:00Z' }), Date.UTC(2026, 9, 27, 16, 59, 0), 'else its frame timestamp')
  assert.equal(time({ messageType: 'bot', type: 'chat_message', timestamp: '2026-10-27T16:59:00' }), Date.UTC(2026, 9, 27, 16, 59, 0), 'a timestamp without a zone is UTC (as the transcript sorts it)')
  assert.equal(time({ messageType: 'bot', type: 'combined_strawman', slideUpdate: { clientTimestamp: 55 } }), 55, 'the combined outline card: its outline frame')
  assert.equal(time({ messageType: 'bot', type: 'thinking_stream', messages: [{ clientTimestamp: 66 }, { clientTimestamp: 99 }] }), 66, 'a thinking stream: its first line')
  for (const item of [null, undefined, 'x', {}, { messageType: 'user' }, { messageType: 'user', timestamp: '5' }, { messageType: 'bot', timestamp: '' }, { messageType: 'bot', type: 'thinking_stream', messages: [] }]) assert.ok(Number.isNaN(time(item)), `no usable time: ${JSON.stringify(item)}`)
  // -- where each note goes ---------------------------------------------------------------------------------------------------------------------
  const row = (kind, time) => ({ kind, time })
  const note = (id, at) => ({ id, at, kind: 'resumed', text: id })
  const ids = list => (list ?? []).map(item => item.id)
  const view = plan => ({ before: Object.fromEntries(Object.entries(plan.before).map(([k, v]) => [k, ids(v)])), after: Object.fromEntries(Object.entries(plan.after).map(([k, v]) => [k, ids(v)])), tail: ids(plan.tail) })
  const plan = (rows, notes, hidden = null) => view(plain(lib.chatCleanNotePlan(rows, notes, hidden)))
  const rows = [row('user', 10), row('bot', 20), row('bot', 30), row('user', 40), row('bot', 50)]
  assert.deepEqual(plan(rows, []), { before: {}, after: {}, tail: [] }, 'no notes')
  assert.deepEqual(plan([], [note('a', 5)]), { before: {}, after: {}, tail: ['a'] }, 'no rows: the tail, as ever')
  assert.deepEqual(plan(rows, [note('n', 60)]), { before: {}, after: {}, tail: ['n'] }, 'after every row: the tail')
  assert.deepEqual(plan(rows, [note('n', 50)]), { before: {}, after: {}, tail: ['n'] }, 'at the last row\'s own time: after it (the tail)')
  assert.deepEqual(plan(rows, [note('n', 25)]), { before: {}, after: { 1: ['n'] }, tail: [] }, 'between two Director rows: after the first (the end of its slot)')
  assert.deepEqual(plan(rows, [note('n', 35)]), { before: {}, after: { 2: ['n'] }, tail: [] }, 'before a user row: the end of the Director row before it')
  assert.deepEqual(plan(rows, [note('n', 45)]), { before: { 4: ['n'] }, after: {}, tail: [] }, 'after a user row, before a Director row: the start of that Director row')
  assert.deepEqual(plan(rows, [note('n', 5)]), { before: { 1: ['n'] }, after: {}, tail: [] }, 'before every row: the start of the first Director row (a user row has no slot)')
  assert.deepEqual(plan(rows, [note('a', 25), note('b', 26), note('c', 35)]), { before: {}, after: { 1: ['a', 'b'], 2: ['c'] }, tail: [] }, 'several notes keep their order within a slot')
  const twoUsers = [row('bot', 10), row('user', 20), row('user', 30), row('bot', 40)]
  assert.deepEqual(plan(twoUsers, [note('n', 25)]), { before: { 3: ['n'] }, after: {}, tail: [] }, 'between two user rows: the start of the next Director row')
  assert.deepEqual(plan([row('bot', 10), row('user', 20), row('user', 30)], [note('n', 25)]), { before: {}, after: { 0: ['n'] }, tail: [] }, 'between two user rows with no Director row after: the end of the one before')
  assert.deepEqual(plan([row('user', 20), row('user', 30)], [note('n', 25)]), { before: {}, after: {}, tail: ['n'] }, 'no Director row at all: the tail')
  assert.deepEqual(plan([row('bot', 10), row('bot', Number.NaN), row('bot', 30)], [note('n', 20)]), { before: {}, after: { 1: ['n'] }, tail: [] }, 'a row without a time takes the time of the row before it')
  assert.deepEqual(plan([row('bot', 30), row('bot', 10), row('bot', 40)], [note('n', 20)]), { before: { 0: ['n'] }, after: {}, tail: [] }, 'an out-of-order time is lifted to its neighbour\'s: a note before the first row\'s time is before it')
  assert.deepEqual(plan([row('bot', 30), row('bot', 10), row('bot', 40)], [note('n', 35)]), { before: {}, after: { 1: ['n'] }, tail: [] }, '...so the note sits after the lifted row')
  // the stop note that the slim bar carries: not drawn between the rows; in the tail it stays (the thread's own rule leaves it out)
  assert.deepEqual(plan(rows, [note('h', 25)], 'h'), { before: {}, after: {}, tail: [] }, 'hidden, between rows: not drawn')
  assert.deepEqual(plan(rows, [note('h', 60)], 'h'), { before: {}, after: {}, tail: ['h'] }, 'hidden, in the tail: kept there for the thread\'s own rule')
  assert.deepEqual(plan(rows, [note('a', 25), note('h', 26)], 'h'), { before: {}, after: { 1: ['a'] }, tail: [] }, 'only the hidden one is left out')
  const hidden = lib.chatCleanHiddenNoteId
  const n = (id, kind) => ({ id, kind })
  assert.equal(hidden([n('a', 'resumed'), n('b', 'stopped')], 'held'), 'b', 'held, newest is a stop note')
  assert.equal(hidden([n('a', 'resumed'), n('b', 'paused')], 'resuming'), 'b', 'resuming, newest is a pause note')
  for (const mode of ['idle', 'running', 'stopping']) assert.equal(hidden([n('b', 'stopped')], mode), null, `${mode}: nothing hidden`)
  assert.equal(hidden([n('a', 'stopped'), n('b', 'resumed')], 'held'), null, 'held, newest is not a stop note')
  assert.equal(hidden([], 'held'), null, 'no notes')
  // -- the newest approval card -----------------------------------------------------------------------------------------------------------------
  assert.equal(lib.chatCleanLastGateId([{ type: 'chat_message', message_id: 'c' }, { type: 'action_request', message_id: 'g1' }, { type: 'chat_message', message_id: 'd' }, { type: 'action_request', message_id: 'g2' }, { type: 'slide_update', message_id: 's' }]), 'g2', 'the newest action_request')
  assert.equal(lib.chatCleanLastGateId([{ type: 'chat_message', message_id: 'c' }]), null, 'none')
  assert.equal(lib.chatCleanLastGateId([]), null, 'empty')
  // -- the line's step and visibility ------------------------------------------------------------------------------------------------------------
  const g0 = [], g1 = []
  const input = over => ({ phase: 'planning', buildId: 'b1', ghosts: g0, gate: null, latestId: 'P', ...over })
  const step = lib.chatCleanLineStep, visible = lib.chatCleanLineVisible
  const first = step(null, input({}))
  assert.deepEqual(plain({ ...first, ghosts: null }), { phase: 'planning', buildId: 'b1', ghosts: null, gate: null, latestId: 'P', retired: null }, 'the first draw retires nothing')
  assert.equal(visible(first), true, 'the first draw shows the newest event')
  assert.equal(visible(step(first, input({}))), true, 'a second draw with nothing changed: still shown')
  assert.equal(visible(step(first, input({ latestId: 'Q' }))), true, 'a new event in the same stretch: shown')
  const moved = over => step(first, input(over))
  assert.equal(moved({ phase: 'strawman' }).retired, 'P', 'the phase moved on: the event that was the newest is retired')
  assert.equal(visible(moved({ phase: 'strawman' })), false, '...and is not the line')
  assert.equal(visible(moved({ buildId: 'b2' })), false, 'a new build: retired')
  const running = step(null, input({ phase: 'building', latestId: 'W' }))
  for (const phase of ['paused', 'stopped', 'qa', 'finalizing', 'error', 'complete']) assert.equal(visible(step(running, input({ phase, latestId: 'W' }))), true, `building -> ${phase}: inside the build's stretch, the line stays (a pause / stop / resume / Continue changes nothing)`)
  assert.equal(visible(step(step(running, input({ phase: 'paused', latestId: 'W' })), input({ phase: 'building', latestId: 'W' }))), true, '...and back')
  assert.equal(visible(step(running, input({ phase: 'building', latestId: 'W', gate: 'g9' }))), true, 'an approval card in the build\'s stretch changes nothing')
  assert.equal(visible(step(running, input({ phase: 'building', latestId: 'W', ghosts: g1 }))), true, 'nor does a replayed outline')
  assert.equal(visible(step(running, input({ phase: 'planning', latestId: 'W' }))), false, 'back to the outline\'s stretch (a refinement): retired')
  assert.equal(visible(moved({ ghosts: g1 })), false, 'a new outline (slide_update): retired')
  assert.equal(visible(moved({ gate: 'g1' })), false, 'a new approval card / ask: retired')
  assert.equal(visible(moved({ phase: 'strawman', latestId: 'Q' })), true, 'an event that arrived in the same step as the change is new: it stays')
  assert.equal(moved({ phase: 'strawman', latestId: 'Q' }).retired, 'P', '...and P stays retired')
  const afterMove = moved({ phase: 'strawman' })
  assert.equal(visible(step(afterMove, input({ phase: 'strawman' }))), false, 'later draws with nothing changed: still closed')
  assert.equal(step(afterMove, input({ phase: 'strawman' })).retired, 'P')
  assert.equal(visible(step(afterMove, input({ phase: 'strawman', latestId: 'Q' }))), true, 'the next event of the new stretch: shown')
  assert.equal(visible(step(step(afterMove, input({ phase: 'strawman', latestId: 'Q' })), input({ phase: 'building', latestId: 'Q' }))), false, 'and retired in its turn when the work moves on again')
  assert.equal(visible(step(null, input({ phase: 'awaiting_user' }))), false, 'the outline gate: no event line at all, even on the first draw')
  assert.equal(visible(step(first, input({ phase: 'awaiting_user', latestId: 'Q' }))), false, '...and not for an event that arrives while waiting')
  assert.equal(visible(step(first, input({ latestId: null }))), false, 'no event: nothing to show')
}

console.log('1. the lib')
await check('the flag, a row\'s time, where each note goes, the hidden stop note, the newest approval card, the line\'s step and visibility', () => libChecks())

// ============================================================================================================================================
// The world: the REAL narration hook and reducer, the REAL notes hook, the REAL MessageList (and, flag on, the REAL tail), on the offline React host
// ============================================================================================================================================
const FIX = JSON.parse(read(FIXTURE))
const framesOf = group => FIX.frames[group].map(({ name, ...frame }) => frame) // `name` is the fixture's own label, not a Director field
const frameNamed = (group, name) => { const found = FIX.frames[group].find(frame => frame.name === name); if (!found) throw new Error(`fixture: no frame "${name}" in ${group}`); const { name: _n, ...frame } = found; return frame }
const BUILD = FIX.frames.outline_gate[1].payload.build_id
const SID = 'sess-cco'
const T0 = Date.UTC(2026, 9, 27, 16, 59, 0)
const CANNED = { package: 'Packaging your outline and picking a theme…', framing: 'Reviewing your topic and audience…', outline: 'Drafting the deck outline…' }
const STRAWMAN_LABEL = 'Outline ready — shaping your slides…'
const BUILDING_LABEL = 'Building your slides…'
const ENV = { NODE_ENV: 'production', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_CHAT_CLEAN: 'true', NEXT_PUBLIC_BUILD_NARRATION: 'true', NEXT_PUBLIC_BUILD_CONTROL: 'true' }

async function makeWorld({ order = false, overrides = {} } = {}) {
  const clock = { now: T0 }
  const FakeDate = class extends Date { constructor(...args) { if (args.length) super(...args); else super(clock.now) } static now() { return clock.now } }
  const processEnv = { ...ENV, ...(order ? { [FLAG]: 'true' } : {}) }
  const fsReal = fs.readFileSync
  if (Object.keys(overrides).length) fs.readFileSync = function (file, ...rest) { const rel = typeof file === 'string' ? path.relative(repo, file) : null; return rel && rel in overrides ? overrides[rel] : fsReal.call(fs, file, ...rest) }
  let loader, mods
  try {
    loader = createModuleLoader({
      root: repo,
      globals: { process: { env: processEnv }, console, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, Date: FakeDate, Symbol, Promise, Math, JSON, Object, Array, Error, Map, Set, Number, String, Boolean, RegExp, TextEncoder, TextDecoder, URL, queueMicrotask },
      stubs: { ...(await esmPackages(repo)), react: React, 'lucide-react': lucideStub(React) },
    })
    mods = {
      narrationHook: loader.load('hooks/use-build-narration.ts'),
      notesHook: loader.load('components/builder/chat/studio-chat-clean.tsx'),
      cleanLib: loader.load('lib/studio-chat-clean.ts'),
      list: loader.load(LIST),
    }
  } finally { fs.readFileSync = fsReal }
  const S = { messages: [], userMessages: [], status: null, structure: null, final: false }
  const refs = { ids: { current: new Set() }, content: { current: new Map() }, welcome: { current: true }, answered: { current: new Set() }, end: { current: null } }
  const handlers = { current: {} }
  const api = {}
  function Page() {
    const n = mods.narrationHook.useBuildNarration({ enabled: true, sessionId: SID, messages: S.messages, currentStatus: S.status, slideStructure: S.structure, isGeneratingFinal: S.final, isGeneratingStrawman: false, finalPresentationUrl: null, finalPresentationId: null, restoredComplete: false, keepStoppedOnFinalUrl: false, endUnbackedBuild: false })
    api.n = n
    // the page's effect that hands the typed-frame handlers to the socket hook; the notes hook (declared after it) wraps the build_phase one
    React.useEffect(() => { handlers.current = { onBuildPhase: payload => n.onBuildPhase(payload), onBuildEvent: payload => n.onBuildEvent(payload), onSlideBuilt: payload => n.onSlideBuilt(payload) } })
    const m = n.narration
    const notes = mods.notesHook.useStudioChatCleanNotes({ enabled: true, sessionKey: SID, narration: { active: m.active, buildId: m.buildId, phase: m.phase, control: m.control, slidesDone: m.slidesDone, slideCount: m.slideCount }, handlers })
    api.notes = notes
    const composer = mods.cleanLib.chatCleanComposerState({ enabled: true, active: m.active, phase: m.phase, control: m.control, slidesDone: m.slidesDone, slideCount: m.slideCount, controlEnabled: true, ackKey: notes.ack.key, ackLine: notes.ack.line })
    return React.createElement(mods.list.MessageList, {
      sessionId: SID, userMessages: S.userMessages, messages: S.messages, userMessageIdsRef: refs.ids, userMessageContentMapRef: refs.content, hasSeenWelcomeRef: refs.welcome, answeredActionsRef: refs.answered,
      messagesEndRef: refs.end, onActionClick() {}, onSubmitAnswers() {}, suppressEphemeral: true, currentStatus: S.status, isGeneratingFinal: S.final,
      studioChatClean: { narration: m, notes: notes.notes, composer },
    })
  }
  const root = new Root()
  root.setElement(React.createElement(Page))
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 120) throw new Error('did not settle'); await macrotask(); quiet = root.flush() ? 0 : quiet + 1 } }
  await settle()
  const refresh = async () => { root.schedule(); await settle() }
  return {
    clock, api, S, root,
    advance(ms) { clock.now += ms },
    refresh,
    /** One Director frame, the way the page and the socket hook hand it on (the typed ones to the page's handlers, the rest into the transcript / status / outline). */
    async deliver(frame) {
      const type = frame.type
      if (type === 'build_phase') handlers.current.onBuildPhase(frame.payload, SID)
      else if (type === 'build_event') handlers.current.onBuildEvent(frame.payload)
      else if (type === 'slide_built') handlers.current.onSlideBuilt(frame.payload)
      else if (type === 'status_update') S.status = frame.payload
      else if (type === 'chat_message' || type === 'action_request' || type === 'slide_update') {
        S.messages = [...S.messages, { ...frame, clientTimestamp: clock.now }]
        if (type === 'slide_update') S.structure = frame.payload
        if (type === 'action_request' || (type === 'chat_message' && frame.payload.ephemeral !== true)) S.status = null // the socket hook clears the status on a reply and on a card
      } // slide_context, presentation_url and token_usage do not reach the transcript the thread draws
      await refresh()
    },
    async userSays(text) { S.userMessages = [...S.userMessages, { id: `user-${S.userMessages.length + 1}`, text, timestamp: clock.now, attachments: [] }]; await refresh() },
    async markControl(control, requestId) { api.n.markControl(control, api.n.narration.buildId ?? BUILD, requestId); await refresh() },
    async addDirections(text) { api.notes.addDirections(text); await refresh() },
    observe() {
      const nodes = hostNodes(root.tree)
      const attr = (node, key) => node.props?.[key]
      const card = nodes.find(node => attr(node, 'data-studio-chat-clean-job') !== undefined) ?? null
      const lineNode = nodes.find(node => attr(node, 'data-studio-chat-clean-job-part') === 'line') ?? null
      const titleNode = card ? hostNodes(card).find(node => node.type === 'h3') : null
      const thread = []
      for (const node of nodes) {
        const who = attr(node, 'data-studio-director-message')
        if (who === 'user') thread.push(`you: ${textOf(node).replace(/^You/, '')}`)
        else if (who === 'director') thread.push(`director: ${textOf(node).replace(/^Director/, '').slice(0, 70)}`)
        else if (attr(node, 'data-studio-chat-clean-note') !== undefined) thread.push(`note ${attr(node, 'data-studio-chat-clean-note')}: ${textOf(node)}`)
        else if (attr(node, 'data-studio-chat-clean-directions') !== undefined) thread.push(`directions: ${textOf(node)}`)
      }
      const cardMarkup = card ? renderToStaticMarkup(toElements(card)) : ''
      return {
        thread, title: titleNode ? textOf(titleNode) : null, line: lineNode ? textOf(lineNode) : null, phase: api.n.narration.phase, control: api.n.narration.control,
        cardSansLine: cardMarkup.replace(/<p data-studio-chat-clean-job-part="line">[^<]*<\/p>/, '<p data-studio-chat-clean-job-part="line">LINE</p>'),
        markup: sha(renderToStaticMarkup(toElements(root.tree))),
      }
    },
    unmount() { root.unmount() },
  }
}

/** The whole scripted session, with a checkpoint after each step: DIRECTOR-2's frames from plan approval to the outline card, the build start, then pause / resume with directions / stop / Director's stop reply / resume / stop / Continue. */
async function runSession(options) {
  const w = await makeWorld(options)
  const cps = {}
  const cp = name => { cps[name] = w.observe() }
  const gate = framesOf('outline_gate')
  await w.userSays('Make a four slide deck on cutting food waste with smarter ordering'); cp('brief')
  for (const frame of gate) {
    w.advance(400)
    await w.deliver(frame)
    const label = FIX.frames.outline_gate[gate.indexOf(frame)].name
    if (label.startsWith('deck build_event ')) cp(`progress ${label.slice('deck build_event '.length)}`)
    else if (['status_update: Generating presentation outline...', 'build_phase planning', 'build_phase strawman', 'outline chat line', 'token_usage'].includes(label)) cp(label.split(':')[0].split(' (')[0])
    else if (label.startsWith('slide_update')) cp('slide_update')
    else if (label.startsWith('action_request')) cp('action_request')
  }
  w.advance(180000); await w.refresh(); cp('the gate, 3 minutes later')
  await w.userSays('Looks perfect, go ahead.')
  for (const [i, frame] of framesOf('build_start').entries()) {
    w.advance(300); await w.deliver(frame)
    if (i === 0) cp('status after the approval')
    if (i === 2) cp('build_phase building')
    if (i === 5) cp('first slide event')
  }
  const deckEvent = { ...frameNamed('outline_gate', 'deck build_event package') }
  deckEvent.message_id = 'msg_cco_build_deck_event'; deckEvent.payload = { ...deckEvent.payload, seq: 20, stage: 'content', text: 'Writing the slide text…' }
  w.advance(300); await w.deliver(deckEvent); cp('a deck event of the build')
  // pause, then the user types "resume" (new directions as instructions: the page marks the resume and keeps the user's text as a note)
  w.advance(5000); await w.markControl('pause_requested', 'req-pause')
  const ack = (group, name, id) => { const f = frameNamed(group, name); return { ...f, payload: { ...f.payload, control_request_id: id } } }
  w.advance(200); await w.deliver(ack('pause_ack', 'build_phase paused (the ack)', 'req-pause')); cp('paused')
  w.advance(4000); await w.markControl('resume_requested', 'req-resume-1'); await w.addDirections('resume')
  w.advance(200); await w.deliver(ack('resume_ack', 'build_phase building (the resume ack)', 'req-resume-1')); cp('resumed with the first "resume"')
  w.advance(500); await w.deliver({ ...frameNamed('stop', 'Director stop reply'), message_id: 'msg_cco_reply_resume', payload: { ...frameNamed('stop', 'Director stop reply').payload, text: 'Picking up where we left off: building all 5 slides now.' } }); cp('Director answers the resume')
  w.advance(3000); await w.deliver(frameNamed('stop', 'slide_built')); cp('slide 1 built')
  // stop: the ack, the slide in flight, Director's stop reply
  w.advance(2000); await w.markControl('stop_requested', 'synthetic-stop-request-1')
  const stopFrames = framesOf('stop')
  w.advance(200); await w.deliver(stopFrames[0]); cp('stopped')
  w.advance(900); await w.deliver(stopFrames[stopFrames.length - 1]); cp('Director\'s stop reply')
  // the user types "resume" again while held; Director answers
  w.advance(6000); await w.markControl('resume_requested', 'req-resume-2'); await w.addDirections('resume')
  w.advance(200); await w.deliver(ack('resume_ack', 'build_phase building (the resume ack)', 'req-resume-2')); cp('resumed with the second "resume"')
  w.advance(500); await w.deliver({ ...frameNamed('stop', 'Director stop reply'), message_id: 'msg_cco_reply_resume_2', payload: { ...frameNamed('stop', 'Director stop reply').payload, text: 'Resuming: the remaining 4 slides are in the queue.' } }); cp('Director answers the second resume')
  // stop again, then Continue (resume as planned: no directions)
  w.advance(3000); await w.markControl('stop_requested', 'req-stop-2')
  w.advance(200); await w.deliver(ack('stop', 'build_phase stopped (the ack)', 'req-stop-2')); cp('stopped again')
  w.advance(4000); await w.markControl('resume_requested', 'req-continue')
  w.advance(200); await w.deliver(ack('resume_ack', 'build_phase building (the resume ack)', 'req-continue')); cp('Continue')
  // a normal typed message after that (a user row follows the notes), and Director's answer
  w.advance(8000); await w.userSays('Make the titles shorter please'); cp('the user types a message')
  w.advance(700); await w.deliver({ ...frameNamed('stop', 'Director stop reply'), message_id: 'msg_cco_reply_titles', payload: { ...frameNamed('stop', 'Director stop reply').payload, text: 'Done: the titles are shorter.' } }); cp('Director answers the message')
  w.unmount()
  return cps
}

// node scripts/test-studio-chat-clean-order.mjs --dump on|off   prints every checkpoint of the scripted session (a reader's aid; not a check)
if (process.argv.includes('--dump')) {
  const cps = await runSession({ order: process.argv[process.argv.indexOf('--dump') + 1] === 'on' })
  for (const [name, c] of Object.entries(cps)) console.log(`${name.padEnd(36)} ${c.phase}/${c.control} | ${c.title} | ${c.line}\n    ${c.thread.filter(t => !t.startsWith('director: ') || /Stopped|Picking|Resuming/.test(t)).join('\n    ')}`)
  release(); process.exit(0)
}

// ---- what the session must show --------------------------------------------------------------------------------------------------------------
const PACKAGING = CANNED.package
const REPLY_1 = 'Picking up where we left off: building all 5 slides now.'
const STOP_REPLY = 'Stopped. The slides that finished are saved in your deck.'
const REPLY_2 = 'Resuming: the remaining 4 slides are in the queue.'
const BRIEF = 'you: Make a four slide deck on cutting food waste with smarter ordering'
const APPROVAL = 'you: Looks perfect, go ahead.'
/** The checkpoints of defect 1, with the card's title and the line flag off shows (today's) and the line flag on shows. */
const LINE_TABLE = [
  ['build_phase strawman', 'Shaping the outline', PACKAGING, STRAWMAN_LABEL],
  ['slide_update', 'Shaping the outline', PACKAGING, STRAWMAN_LABEL],
  ['outline chat line', 'Shaping the outline', PACKAGING, STRAWMAN_LABEL],
  ['action_request', 'Waiting for you', PACKAGING, 'Waiting for your go-ahead'],
  ['token_usage', 'Waiting for you', PACKAGING, 'Waiting for your go-ahead'],
  ['the gate, 3 minutes later', 'Waiting for you', PACKAGING, 'Waiting for your go-ahead'],
  ['status after the approval', 'Building slides', PACKAGING, BUILDING_LABEL],
  ['build_phase building', 'Building slides', PACKAGING, BUILDING_LABEL],
  ['first slide event', 'Building slides', PACKAGING, BUILDING_LABEL],
]
const LINE_DIFFERS = new Set(LINE_TABLE.map(row => row[0]))
const CANNED_LINES = [['progress framing', CANNED.framing], ['progress research', 'Researching the topic for context…'], ['progress outline', CANNED.outline], ['progress slide_layouts', 'Choosing layouts for each slide…'], ['progress slide_research', 'Researching each slide in detail…'], ['progress package', PACKAGING]]
/** The thread at the end of the session, flag on: chronological (the order the steps happened in). */
const THREAD_ON = [
  BRIEF, APPROVAL,
  'note paused: Paused at slide 1 · no slide finished yet', 'directions: resume', 'note resumed: Resumed · building from slide 1',
  `director: ${REPLY_1}`,
  'note stopped: Stopped at slide 2 · slide 1 kept',
  `director: ${STOP_REPLY}`,
  'directions: resume', 'note resumed: Resumed · building from slide 2',
  `director: ${REPLY_2}`,
  'note stopped: Stopped at slide 2 · slide 1 kept', 'note resumed: Resumed · building from slide 2',
  'you: Make the titles shorter please', 'director: Done: the titles are shorter.',
]
/** ...and flag off: every note after the last Director row. */
const THREAD_OFF = [
  BRIEF, APPROVAL, `director: ${REPLY_1}`, `director: ${STOP_REPLY}`, `director: ${REPLY_2}`, 'you: Make the titles shorter please', 'director: Done: the titles are shorter.',
  'note paused: Paused at slide 1 · no slide finished yet', 'directions: resume', 'note resumed: Resumed · building from slide 1',
  'note stopped: Stopped at slide 2 · slide 1 kept', 'directions: resume', 'note resumed: Resumed · building from slide 2',
  'note stopped: Stopped at slide 2 · slide 1 kept', 'note resumed: Resumed · building from slide 2',
]
const keepThread = thread => thread.filter(item => !item.startsWith('director: ') || /Picking up|Stopped\.|Resuming:|Done:/.test(item))

function expectDefect1({ on, off }) {
  for (const [name, text] of CANNED_LINES) { assert.equal(off[name].line, text, `off ${name}`); assert.equal(on[name].line, text, `on ${name}: a progress line inside its own stretch is the card's line, as before`) }
  for (const [name, title, offLine, onLine] of LINE_TABLE) {
    assert.equal(off[name].title, title, `off ${name}: title`); assert.equal(on[name].title, title, `on ${name}: title`)
    assert.equal(off[name].line, offLine, `off ${name}: today's line`)
    assert.equal(on[name].line, onLine, `on ${name}: the line`)
  }
  assert.equal(off['a deck event of the build'].line, 'Writing the slide text…'); assert.equal(on['a deck event of the build'].line, 'Writing the slide text…', 'a deck event of the build itself is the line, flag on too')
}
function expectDefect2({ on, off }) {
  assert.deepEqual(keepThread(on['Director answers the message'].thread), THREAD_ON, 'flag on: chronological')
  assert.deepEqual(keepThread(off['Director answers the message'].thread), THREAD_OFF, 'flag off: every note after the last Director row (today\'s)')
  const stoppedReply = keepThread(off["Director's stop reply"].thread)
  assert.ok(stoppedReply.indexOf(`director: ${STOP_REPLY}`) < stoppedReply.length && !stoppedReply.some(item => item.startsWith('note stopped')), 'the newest stop note stays out while held (the slim bar carries it), flag off')
  const held = keepThread(on["Director's stop reply"].thread)
  assert.deepEqual(held, [BRIEF, APPROVAL, 'note paused: Paused at slide 1 · no slide finished yet', 'directions: resume', 'note resumed: Resumed · building from slide 1', `director: ${REPLY_1}`, `director: ${STOP_REPLY}`], 'flag on, held: the same, the newest stop note still out')
  // the user's first "resume" bubble sits before Director's answer to it, and the Paused marker before the bubble
  const order = keepThread(on['Director answers the resume'].thread)
  assert.ok(order.indexOf('note paused: Paused at slide 1 · no slide finished yet') < order.indexOf('directions: resume') && order.indexOf('directions: resume') < order.indexOf(`director: ${REPLY_1}`), 'paused marker, then the user\'s "resume", then Director\'s answer')
}
function expectUnchanged({ on, off }) {
  for (const name of Object.keys(off)) {
    assert.equal(on[name].cardSansLine, off[name].cardSansLine, `${name}: the job card is flag off's but for its line`)
    assert.equal(on[name].phase, off[name].phase, `${name}: phase`); assert.equal(on[name].control, off[name].control, `${name}: control`)
    if (!LINE_DIFFERS.has(name)) assert.equal(on[name].line, off[name].line, `${name}: the line is flag off's`)
    const rows = thread => thread.filter(item => !item.startsWith('note ') && !item.startsWith('directions: '))
    const notes = thread => thread.filter(item => item.startsWith('note ') || item.startsWith('directions: ')).sort()
    assert.deepEqual(rows(on[name].thread), rows(off[name].thread), `${name}: the transcript rows, in order`)
    assert.deepEqual(notes(on[name].thread), notes(off[name].thread), `${name}: the same notes, once each`)
  }
  for (const name of ['paused', 'resumed with the first "resume"', 'stopped', 'resumed with the second "resume"', 'stopped again', 'Continue']) assert.equal(on[name].line, off[name].line, `${name}: pause / resume / stop / Continue show flag off's line`)
  assert.equal(on.paused.line, 'Paused before slide 1.'); assert.equal(on.stopped.line, 'Stopped while working on slide 2.')
  assert.equal(on.Continue.line, 'Writing the slide text…', 'a resumed build keeps the line it had')
}
function expectIdentity({ off, base }) {
  for (const name of Object.keys(base)) assert.equal(off[name].markup, base[name].markup, `${name}: flag off's markup is the base MessageList's`)
  assert.deepEqual(Object.keys(off), Object.keys(base))
}

function expectAsk({ off, on }) {
  assert.equal(off.progress.line, 'Drafting the deck outline…'); assert.equal(on.progress.line, 'Drafting the deck outline…')
  assert.equal(off.ask.line, 'Drafting the deck outline…', 'off: stale')
  assert.equal(on.ask.line, 'Designing your deck plan…', 'on: the phase\'s own words')
  assert.equal(off.next.line, 'Choosing layouts for each slide…'); assert.equal(on.next.line, 'Choosing layouts for each slide…')
  assert.equal(on.ask.phase, 'planning', 'the phase did not move (so only the approval card closed the line)')
}

// ---- one ask while the phase stays planning (no frame says "waiting") ---------------------------------------------------------------------------
async function runAsk(options) {
  const w = await makeWorld(options)
  const out = {}
  const gate = framesOf('outline_gate')
  for (const frame of gate.slice(0, 2)) { w.advance(400); await w.deliver(frame) }
  for (const frame of gate.slice(2, 8)) { w.advance(400); await w.deliver(frame) } // three progress pairs: framing, research, outline
  out.progress = w.observe()
  const ask = { message_id: 'msg_cco_ask', session_id: SID, timestamp: '2026-10-27T17:00:00.000000Z', type: 'action_request', role: 'assistant', payload: { prompt_text: 'Quick question before I plan: who is the audience?', actions: [{ label: 'Skip questions', value: 'skip', primary: false, requires_input: false }] } }
  w.advance(400); await w.deliver(ask); out.ask = w.observe()
  for (const frame of gate.slice(8, 10)) { w.advance(400); await w.deliver(frame) } // the next progress line of the same stretch
  out.next = w.observe()
  w.unmount()
  return out
}

console.log('2. defect 1: the working line (DIRECTOR-2\'s frames, through the real narration hook, reducer and notes hook, MessageList and tail)')
const sessions = {}
await check('the session runs flag off, flag on, and on the base MessageList (this tree\'s file with the marked lines stripped)', async () => {
  sessions.off = await runSession({ order: false })
  sessions.on = await runSession({ order: true })
  sessions.base = await runSession({ order: false, overrides: { [LIST]: stripChatCleanOrder(LIST, read(LIST)) } })
  assert.equal(Object.keys(sessions.off).length, 31)
})
await check('flag OFF is today\'s defect: "Packaging your outline and picking a theme…" stays under "Shaping the outline", under "Waiting for you" at the outline card (and 3 minutes later) and under "Building slides"', () => {
  for (const [name, title, offLine] of LINE_TABLE) { assert.equal(sessions.off[name].title, title, name); assert.equal(sessions.off[name].line, offLine, name) }
})
await check('flag ON: the line closes on the strawman, the outline, the approval card, and the build starting; the card\'s own words stand in; the build\'s own deck events are the line again; progress lines inside the stretch are untouched', () => expectDefect1(sessions))
await check('an ask while the phase stays planning (Director asked a question, no frame says "waiting"): flag off keeps the last progress line, flag on closes it on the card, and the next progress line is the line again', async () => {
  expectAsk({ off: await runAsk({ order: false }), on: await runAsk({ order: true }) })
})

console.log('3. defect 2: the order of the notes (pause, resume with directions, stop, Director\'s stop reply, resume, stop, Continue)')
await check('flag OFF is today\'s defect: every note (the Paused marker, the user\'s "resume" bubble, the Resumed and Stopped markers) is after Director\'s stop reply', () => {
  const thread = keepThread(sessions.off['Director answers the message'].thread)
  assert.deepEqual(thread, THREAD_OFF)
  assert.ok(thread.indexOf(`director: ${STOP_REPLY}`) < thread.indexOf('note paused: Paused at slide 1 · no slide finished yet'))
})
await check('flag ON: chronological: the Paused marker sits before the user\'s first "resume" and Director\'s answer, the Stopped marker before Director\'s stop reply, the second "resume" after it; the newest stop note stays out while held', () => expectDefect2(sessions))

console.log('4. otherwise unchanged')
await check('flag on is flag off at every one of the 31 checkpoints but the closed line (defect 1) and the notes\' places (defect 2): the card, the phase and control, the rows, the notes (the same, once each), pause / resume / stop / Continue', () => expectUnchanged(sessions))

console.log('5. flag off is byte-identical to the base')
await check('every checkpoint\'s whole chat markup with the flag off hashes as the base MessageList\'s (31 renders); and flag on really differs at the checkpoints of the fix', () => {
  expectIdentity(sessions)
  const differing = Object.keys(sessions.off).filter(name => sessions.on[name].markup !== sessions.off[name].markup)
  assert.ok(differing.includes('action_request') && differing.includes('build_phase building') && differing.includes('Continue'), differing.join(', '))
  assert.ok(!differing.includes('progress package') && !differing.includes('brief'), 'and nowhere before the fix has anything to do')
})


console.log('6. mutants')
const mutate = (text, from, to, label) => { const at = text.indexOf(from); if (at === -1 || text.indexOf(from, at + 1) !== -1) throw new Error(`mutant "${label}": target ${JSON.stringify(from.slice(0, 70))} not found exactly once`); return text.replace(from, () => to) }
/** Every expectation above, on a mutant (its overrides served to the loader, flag off and on): must throw. */
async function mutantChecks(overrides) {
  const m = { off: await runSession({ order: false, overrides }), on: await runSession({ order: true, overrides }) }
  if (LIB in overrides) libChecks(overrides[LIB])
  expectDefect1(m); expectDefect2(m); expectUnchanged(m); expectIdentity({ off: m.off, base: sessions.base })
  expectAsk({ off: await runAsk({ order: false, overrides }), on: await runAsk({ order: true, overrides }) })
}
const libText = read(LIB), tailText = read(TAIL), listText = read(LIST)
await check('the unmutated files pass the mutant checks (the checks can pass)', async () => { await mutantChecks({}) })
const NOTE_BEFORE = '{chatCleanOrder?.plan.before[index] ? <StudioChatCleanNotesAt notes={chatCleanOrder.plan.before[index]} /> : null}'
const NOTE_AFTER = '{chatCleanOrder?.plan.after[index] ? <StudioChatCleanNotesAt notes={chatCleanOrder.plan.after[index]} /> : null}'
const mutants = [
  // the lib
  ['the flag is ignored (always on)', LIB, 'chatCleanOrderFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER) && ', 'true && '],
  ['the flag is read loosely (!== "false"; unset is on)', LIB, "return value === 'true'", "return value !== 'false'"],
  ['chat clean is not required', LIB, ' && chatCleanOrderFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN)', ''],
  ['a note at a row\'s own time goes before the next row, not after it', LIB, 'if (times[i] > note.at)', 'if (times[i] >= note.at)'],
  ['a note after a Director row is drawn before it', LIB, "{ bucket = 'after'; index = later - 1 }\n      else if", "{ bucket = 'before'; index = later - 1 }\n      else if"],
  ['the hidden stop note is drawn between the rows', LIB, 'if (note.id === hiddenId) continue', ''],
  ['the hidden note ignores a resume in flight', LIB, "if (composerMode !== 'held' && composerMode !== 'resuming') return null", "if (composerMode !== 'held') return null"],
  ['a user row\'s time is ignored', LIB, "return typeof row.timestamp === 'number' && Number.isFinite(row.timestamp) ? row.timestamp : Number.NaN", 'return Number.NaN'],
  ['the line is never retired', LIB, 'const retired = previous === null ? null : moved ? previous.latestId : previous.retired', 'const retired = previous === null ? null : previous.retired'],
  ['the first draw retires the newest event', LIB, 'const retired = previous === null ? null :', 'const retired = previous === null ? input.latestId :'],
  ['a new approval card / ask does not retire it', LIB, 'previous.gate !== input.gate || ', ''],
  ['a new outline (slide_update) does not retire it', LIB, ' || !Object.is(previous.ghosts, input.ghosts)', ''],
  ['a new build does not retire it', LIB, 'previous.buildId !== input.buildId', 'false'],
  ['a pause, resume or stop retires it too', LIB, '(inOutline(previous.phase) || inOutline(input.phase))', 'true'],
  ['the outline gate shows an event line', LIB, " && state.phase !== 'awaiting_user'", ''],
  // the tail
  ['the tail hands the card every event', TAIL, 'narration={chatCleanLineVisible(state) ? narration : { ...narration, deckEvents: [] }}', 'narration={narration}'],
  ['the tail never keeps its last step (every draw is a first draw)', TAIL, 'useEffect(() => { previous.current = state })', ''],
  ['the user\'s directions are drawn as an ordinary note', TAIL, "note.kind === 'directions'", "note.kind === 'directions-x'"],
  // the list
  ['no notes at the start of a Director row', LIST, NOTE_BEFORE, '{null}'],
  ['no notes at the end of a Director row', LIST, NOTE_AFTER, '{null}'],
  ['the prop\'s own tail is not silenced (the notes and the card are drawn twice)', LIST, 'if (chatCleanOrder) studioChatClean = undefined ', ''],
  ['the ordered tail is not drawn', LIST, '{chatCleanOrder ? <StudioChatCleanOrderTail', '{false ? <StudioChatCleanOrderTail'],
  ['the flag is not consulted by the list', LIST, 'STUDIO_CHAT_CLEAN_ORDER_ENABLED && studio && studioChatClean ?', 'studio && studioChatClean ?'],
  ['the tail keeps every note', LIST, 'notes={chatCleanOrder.plan.tail}', 'notes={chatCleanOrder.thread.notes}'],
  ['the newest approval card is not passed', LIST, 'gate={chatCleanLastGateId(messages)}', 'gate={null}'],
  ['the slim bar\'s stop note is not left out', LIST, 'chatCleanHiddenNoteId(studioChatClean.notes, studioChatClean.composer.mode)', 'null'],
  ['no row has a time', LIST, 'time: chatCleanRowTime(row)', 'time: Number.NaN'],
  ['a user row is taken for a Director row (it has no slot)', LIST, "kind: row.messageType === 'user' ? 'user' as const : 'bot' as const", "kind: 'bot' as const"],
]
for (const [label, rel, from, to] of mutants) await check(`mutant caught: ${label}`, async () => {
  const text = { [LIB]: libText, [TAIL]: tailText, [LIST]: listText }[rel]
  const mutant = mutate(text, from, to, label)
  await assert.rejects(() => mutantChecks({ [rel]: mutant }), undefined, 'the checks must fail on this mutant')
})
await check('mutant caught: an unmarked line added to the list is not stripped (the strip gives the base back only for marked lines)', () => {
  const mutant = mutate(listText, 'import "./studio-chat-clean.css" //', 'import { extra } from "./extra"\nimport "./studio-chat-clean.css" //', 'unmarked')
  assert.notEqual(stripChatCleanOrder(LIST, mutant), stripChatCleanOrder(LIST, listText))
})

console.log('7. the sources, and the scope over the committed diff (BASE..HEAD)')
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 })
/** GATE-SAFE head of every own-commit / scope query. In the gate, HEAD is a local --no-ff merge whose FIRST parent is BASE (dev) and whose second parent is this change's head, so `rev-list --first-parent --no-merges BASE..HEAD` is empty: the
 *  scope then runs against HEAD^2. On a branch (HEAD is this change's own tip, or a merge of dev INTO it whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const sha = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = git('rev-list', '--parents', '-n', '1', sha).trim().split(/\s+/).slice(1)
  return gateRule && parents.length === 2 && parents[0] === BASE_COMMIT ? parents[1] : sha
}
const HEAD = scopeHead('HEAD')
const ownOf = head => git('log', '--format=%H', '--first-parent', '--no-merges', '-E', `--grep=^${CHAT_CLEAN_ORDER_SUBJECT}`, `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)
const scopeOwnCommits = head => {
  const own = ownOf(head)
  assert.ok(own.length >= 1, 'no own commit yet')
  const all = git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)
  assert.deepEqual([...all].sort(), [...own].sort(), 'a commit between the base and HEAD is not this change\'s')
  for (const c of own) {
    assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
    assert.doesNotMatch(git('log', '-1', '--format=%s', c), /^Chat clean/, c.slice(0, 8))
  }
}
const scopeCommittedFiles = HEAD => {
  const changed = git('diff', '--name-only', `${BASE_COMMIT}..${HEAD}`).split('\n').filter(Boolean).filter(rel => CHAT_CLEAN_ORDER_SCOPE_FILES.has(rel) || !registry.LATER_CHANGE_FILES.has(rel)).sort()
  assert.deepEqual(changed, [...CHAT_CLEAN_ORDER_SCOPE_FILES].sort())
  assert.deepEqual(Object.keys(CHAT_CLEAN_ORDER_PIN_EDITS), ['scripts/test-studio-chat-undo-v2.mjs', 'scripts/test-studio-chat-element-edit-2.mjs'], 'two older proofs are taught: chat undo v2\'s strip of the message list, and #538\'s scope section (its own commits found by subject, a stray-file mutant); dev\'s generic registry read (#542) already reads past this change\'s three registry lines')
  for (const rel of Object.keys(CHAT_CLEAN_ORDER_PIN_EDITS)) {
    assert.equal(stripChatCleanOrder(rel, git('show', `${HEAD}:${rel}`)), git('show', `${BASE_COMMIT}:${rel}`), `${rel}: the taught proof, put back, is the previous file byte for byte`)
    const diff = git('diff', '-U0', `${BASE_COMMIT}..${HEAD}`, '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    const lines = text => text.split('\n').filter(Boolean).length // the lines an edit adds (has) or takes out (was)
    assert.equal(diff.filter(line => line.startsWith('+')).length, CHAT_CLEAN_ORDER_PIN_EDITS[rel].reduce((n, [has]) => n + lines(has), 0)); assert.equal(diff.filter(line => line.startsWith('-')).length, CHAT_CLEAN_ORDER_PIN_EDITS[rel].reduce((n, [, was]) => n + lines(was), 0))
    for (const line of diff.filter(line => line.startsWith('+'))) assert.ok(line.includes(stripModule.CHAT_CLEAN_ORDER_PIN_MARK), `${rel}: a taught line without the mark: ${line.slice(0, 100)}`)
  }
  assert.deepEqual(CHAT_CLEAN_ORDER_FILES, [LIST])
  for (const rel of CHAT_CLEAN_ORDER_FILES) {
    const diff = git('diff', '-U0', `${BASE_COMMIT}..${HEAD}`, '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    assert.equal(diff.length, 8, `${rel}: two imports, a comment, the plan, the one reassignment, the two row slots and the tail`)
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, CHAT_CLEAN_ORDER_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.equal(stripChatCleanOrder(rel, git('show', `${HEAD}:${rel}`)), git('show', `${BASE_COMMIT}:${rel}`), `${rel}: without its marked lines the file is the base's, byte for byte`)
    assert.equal(registry.stripLaterChanges(rel, git('show', `${HEAD}:${rel}`)), registry.stripLaterChanges(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: ...and through the registry (both sides)`)
  }
  for (const rel of CHAT_CLEAN_ORDER_NEW_FILES) assert.ok(git('cat-file', '-t', `${HEAD}:${rel}`).trim() === 'blob', rel)
}
const scopeEnvAndRegistry = HEAD => {
  assert.equal(registry.stripLaterEnvBlocks('.env.example', git('show', `${HEAD}:.env.example`)), registry.stripLaterEnvBlocks('.env.example', `${git('show', `${BASE_COMMIT}:.env.example`)}\n${CHAT_CLEAN_ORDER_ENV_BLOCK}`))
  assert.equal(git('show', `${HEAD}:.env.example`), `${git('show', `${BASE_COMMIT}:.env.example`)}\n${CHAT_CLEAN_ORDER_ENV_BLOCK}`, 'byte for byte: the base, one blank line, the block')
  const diff = git('diff', '-U0', `${BASE_COMMIT}..${HEAD}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
  assert.equal(diff.length, 3); for (const line of diff) assert.ok(line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-chat-clean-order-strip.mjs'), line.slice(0, 140))
}
await check(`this change's own commits (subject starts "${CHAT_CLEAN_ORDER_SUBJECT}") exist; every first-parent non-merge commit between the base and HEAD (HEAD^2 in the gate) is one, with the co-author line; none starts "Chat clean" (that prefix is the chat clean proof's own-commit grep)`, () => scopeOwnCommits(HEAD))
await check('the committed files are exactly this change\'s (two older proofs, chat undo v2\'s and #538\'s, taught a registry read); every line added to the list is a pure insertion that carries the marker (eight of them); the strip gives the base back byte for byte, also through the registry', () => scopeCommittedFiles(HEAD))
// GATE-SAFE: build the gate's merge (first parent BASE, second parent this change's head; the tree is `git merge-tree --write-tree BASE head`) and run the whole scope section against it.
const GATE_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-27T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-27T00:00:00Z' }
const gateStyleMerge = head => {
  const tree = git('merge-tree', '--write-tree', BASE_COMMIT, head).trim().split('\n')[0]
  return execFileSync('git', ['commit-tree', tree, '-p', BASE_COMMIT, '-p', head, '-m', 'gate-style merge (local, no ref)'], { cwd: repo, encoding: 'utf8', env: { ...process.env, ...GATE_IDENT } }).trim()
}
const GATE = gateStyleMerge(HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it', () => {
  assert.deepEqual(git('rev-list', '--parents', '-n', '1', GATE).trim().split(/\s+/).slice(1), [BASE_COMMIT, HEAD], 'the gate-style merge: first parent BASE, second parent the head')
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  const head = scopeHead(GATE)
  assert.equal(head, HEAD, 'HEAD^2 is the change\'s head')
  scopeOwnCommits(head); scopeCommittedFiles(head); scopeEnvAndRegistry(head)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head (not a merge onto BASE) is used as it is')
  assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself (a merge with other parents) is used as it is')
})
await check('mutant caught: without the HEAD^2 rule the gate-style merge has no own commit (the scope section fails on it)', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head), /no own commit yet/)
})
await check('plumbing: the lib reads the literal env names (exact "true", both flags); the list reads the lib\'s constant; .env.example documents "false" once; the new lib and component import only what they need', () => {
  const text = read(LIB)
  assert.equal((text.match(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER\b/g) || []).length, 1)
  assert.equal((text.match(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_CLEAN\b/g) || []).length, 1)
  assert.deepEqual([...text.matchAll(/^import .*$/gm)].map(m => m[0]), ["import type { ChatCleanNote } from '@/lib/studio-chat-clean'"], 'the lib is import-free but for a type')
  assert.equal((read(LIST).match(/NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER/g) || []).length, 2, 'the list names the flag in two comments only (the lib reads it)')
  assert.match(read('.env.example'), new RegExp(`^${FLAG}="false"$`, 'm'))
  assert.equal((read('.env.example').match(new RegExp(FLAG, 'g')) || []).length, 1)
})
await check('.env.example is the base plus the block (a blank line before it); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of ['scripts/test-studio-chat-clean-order.mjs', 'scripts/studio-chat-clean-order-strip.mjs', LIB, TAIL, FIXTURE]) assert.doesNotMatch(read(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/, rel)
})
await check('the fixture is DIRECTOR-2\'s frame order (27 Oct) in recorded shapes: status_update, build_phase planning, six progress chat_messages each followed by its deck-scope build_event (the last "Packaging…"), slide_context, build_phase strawman, slide_update, the outline chat line, action_request, token_usage', () => {
  assert.deepEqual(FIX.frames.outline_gate.map(f => f.type), ['status_update', 'build_phase', ...[0, 1, 2, 3, 4, 5].flatMap(() => ['chat_message', 'build_event']), 'slide_context', 'build_phase', 'slide_update', 'chat_message', 'action_request', 'token_usage'])
  assert.deepEqual(FIX.frames.outline_gate.filter(f => f.type === 'build_event').map(f => [f.payload.scope, f.payload.stage]), [['deck', 'framing'], ['deck', 'research'], ['deck', 'outline'], ['deck', 'slide_layouts'], ['deck', 'slide_research'], ['deck', 'package']])
  assert.equal(FIX.frames.outline_gate.filter(f => f.type === 'build_event').at(-1).payload.text, PACKAGING)
  assert.equal(FIX.frames.outline_gate.filter(f => f.type === 'build_phase')[1].payload.label, STRAWMAN_LABEL)
  assert.ok(FIX.frames.outline_gate.every(f => f.session_id === FIX.session.id))
})

release()
console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
