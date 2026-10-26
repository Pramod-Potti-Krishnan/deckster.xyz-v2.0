// FRONTEND-2 (SPEED + ROUTER ACCELERATION, 25 Oct): proof of NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED (exact "true", default off), the "Sending…" echo of a typed message
// (lib/studio-speed-perceived.ts, hooks/use-studio-speed-perceived-echo.ts, components/builder/studio-speed-echo.tsx, marked lines in app/builder/page.tsx; MessageList is not changed).
//
// QUALITY LOCK: the end state is the base's, flag off and on.
//   A. Recorded Director transcripts (scripts/fixtures/director-chat/*.json, 9 transcripts x 3 profiles) through the REAL hook, MessageList, ChatInput and the page's own prop
//      expressions (the chat harness, with this change's lines kept in the page it parses). Flag off: every snapshot file equals the committed baseline (markup, sends, keys,
//      handler calls, state, cache, diagnostics). Flag on: every file equals flag off, except env.json, which differs by the flag's own line.
//   B. The echo's life through the REAL hook, the REAL MessageList and the REAL echo component, drawn after it as the page does (offline React host, virtual clock), flag on next to flag off, for slow, fast, refused, failed,
//      choice, scope-change, duplicate, resend, attachment and throwing sends: when it shows, what it says, and that once it is gone the chat markup is byte-equal to flag off.
//   C. Mutants of the lib: each must be caught by A-B's checks.
//   D. Scope over the COMMITTED diff (BASE..HEAD only; the working tree is never read for it): the files are exactly this change's, every line added to an existing file is a
//      pure insertion with the marker, the strip gives the base file byte for byte, .env.example is the base plus the block, the registry gains three lines.
//
//   node scripts/test-studio-speed-perceived.mjs
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed); git is read only for D.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FLAG = 'NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED'
const LIB = 'lib/studio-speed-perceived.ts'
const release = installHostNetworkGuard(net, dns)
let checks = 0
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message) }
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)

// The registry strips this change's page lines for every other reader (the chat harness parses the page through it). In THIS process only, take that one strip out,
// so the harness runs the page WITH its lines.
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-speed-perceived-strip.mjs')
const stripAt = registry.LATER_STRIPS.indexOf(stripModule.stripSpeedPerceived)
ok(stripAt >= 0, 'the registry names this change\'s strip')
registry.LATER_STRIPS.splice(stripAt, 1)

const React = (await import('react')).default
const { renderToStaticMarkup } = await import('react-dom/server')
const { Root, toElements } = await import('./studio-chat-harness/mini-react.mjs')
const { createEnvironment } = await import('./studio-chat-harness/fake-env.mjs')
const { createModuleLoader } = await import('./studio-chat-harness/module-loader.mjs')
const { esmPackages, lucideStub } = await import('./studio-chat-harness/esm-packages.mjs')
const { runTranscript } = await import('./studio-chat-harness/transcript.mjs')
const { PROFILES, BASE_ENV } = await import('./studio-chat-harness/profiles.mjs')
const { readSnapshot, compareSnapshots } = await import('./studio-chat-harness/snapshot.mjs')
const macrotask = () => new Promise(resolve => setImmediate(resolve))

// ---- A. recorded Director transcripts, flag off vs on -----------------------------------------------------
const fixturesDir = path.join(root, 'scripts/fixtures/director-chat')
const baselineRoot = path.join(fixturesDir, 'baselines')
const MARKUP_PROFILES = new Set(['studio']) // as scripts/test-studio-chat-transcripts.mjs records them
const fixtures = fs.readdirSync(fixturesDir).filter(name => name.endsWith('.json')).sort().map(name => JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8')))
const partA = { runs: 0, offEqualBaseline: 0, onEqualOff: 0, offHashes: [], onHashes: [], wrapperRuns: 0 }
for (const fixture of fixtures) {
  for (const profile of Object.keys(PROFILES)) {
    const label = `${fixture.name}/${profile}`
    const env = { ...PROFILES[profile], ...(fixture.env || {}) }
    const includeMarkup = MARKUP_PROFILES.has(profile)
    const off = await runTranscript({ root, fixture, profile, processEnv: env, includeMarkup })
    const on = await runTranscript({ root, fixture, profile, processEnv: { ...env, [FLAG]: 'true' }, includeMarkup })
    partA.runs++
    ok(off.blockedNetwork.length === 0 && on.blockedNetwork.length === 0, `${label}: no network`)
    // The harness parsed the page WITH this change's lines: its hook call and both spreads are regions it executed.
    const labels = on.regions.map(region => region.label)
    ok(labels.includes('page.useStudioSpeedPerceivedEcho(input)'), `${label}: the harness ran the page's own echo hook call`)
    const expected = readSnapshot(path.join(baselineRoot, fixture.name, profile))
    ok(Object.keys(expected).length > 0, `${label}: a committed baseline exists`)
    const offDiffs = compareSnapshots(expected, off.files)
    eq(offDiffs.map(d => d.file), [], `${label}: flag off equals the committed base baseline, every file`)
    partA.offEqualBaseline++
    const onDiffs = compareSnapshots(off.files, on.files)
    eq(onDiffs.map(d => d.file), ['env.json'], `${label}: flag on equals flag off in every file but env.json`)
    const offEnv = JSON.parse(off.files['env.json']), onEnv = JSON.parse(on.files['env.json'])
    eq({ ...onEnv, env: Object.fromEntries(Object.entries(onEnv.env).filter(([key]) => key !== FLAG)) }, offEnv, `${label}: env.json differs only by the flag`)
    eq(onEnv.env[FLAG], 'true', `${label}: the flag-on run had the flag`)
    partA.onEqualOff++
    partA.offHashes.push(off.files['markup.json']); partA.onHashes.push(on.files['markup.json'])
    if (fixture.composer) partA.wrapperRuns++
  }
}
const markupDigestOff = sha(partA.offHashes.join('\n')), markupDigestOn = sha(partA.onHashes.join('\n'))
eq(markupDigestOn, markupDigestOff, 'A: the digest of every checkpoint markup hash is the same flag off and on')
console.log(`PASS A  recorded transcripts: ${partA.runs} runs (${fixtures.length} transcripts x ${Object.keys(PROFILES).length} profiles); flag off = base baseline in ${partA.offEqualBaseline}; flag on = flag off (env.json aside) in ${partA.onEqualOff}; markup digest off ${markupDigestOff} = on ${markupDigestOn}; ${partA.wrapperRuns} runs sent through the real composer and the wrapper`)

// ---- B. the echo's life through the real hook and MessageList ----------------------------------------------
const normalBuild = fixtures.find(fixture => fixture.name === 'normal-build')
const recordedFrames = normalBuild.steps.filter(step => step.op === 'frame' && ['presentation_init', 'chat_message'].includes(step.frame.type)).slice(0, 2).map(step => step.frame)
eq(recordedFrames.map(frame => frame.message_id), ['msg-init-blank', 'msg-greeting'], 'B uses the recorded blank-deck init and greeting frames')
const PROFILE_ENV = { ...BASE_ENV, ...PROFILES.studio }

/** Evaluate the lib's text (the real file or a mutant) as a module for the loader's file stub. */
function evaluateLib(text, processEnv) {
  const compiled = ts.transpileModule(text, { fileName: LIB, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, 'the lib transpiles')
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, process: { env: processEnv }, require: () => { throw new Error('the lib imports types only') } })
  return module.exports
}

async function world({ flagOn, libText = null, start = {} }) {
  const processEnv = { ...PROFILE_ENV, ...(flagOn ? { [FLAG]: 'true' } : {}) }
  const env = createEnvironment({ processEnv })
  const loader = createModuleLoader({
    root, globals: env.globals,
    stubs: { ...(await esmPackages(root)), react: React, 'lucide-react': lucideStub(React) },
    fileStubs: {
      'hooks/use-auth': { useAuth: () => ({ user: { id: 'synthetic-user-01' }, isLoading: false }) },
      ...(libText ? { 'lib/studio-speed-perceived': evaluateLib(libText, processEnv) } : {}),
    },
  })
  const { useStudioSpeedPerceivedEcho } = loader.load('hooks/use-studio-speed-perceived-echo.ts')
  const { MessageList } = loader.load('components/builder/message-list.tsx')
  const { StudioSpeedEcho } = loader.load('components/builder/studio-speed-echo.tsx')
  const state = {
    userMessages: [], inputMessage: '', scopeKey: 'synthetic-session-speed', choiceOpen: false, uploadedFiles: [],
    messages: recordedFrames.map((frame, index) => ({ ...frame, clientTimestamp: Date.parse(frame.timestamp) - 3_600_000 + index })),
    ...start,
  }
  const refs = {
    userMessageIdsRef: { current: new Set(state.userMessages.map(m => m.id)) }, userMessageContentMapRef: { current: new Map() },
    hasSeenWelcomeRef: { current: true }, answeredActionsRef: { current: new Set() }, messagesEndRef: { current: null },
  }
  let latest = null
  function Page() {
    const echo = useStudioSpeedPerceivedEcho({ userMessages: state.userMessages, scopeKey: state.scopeKey, inputMessage: state.inputMessage, uploadedFiles: state.uploadedFiles, choiceOpen: state.choiceOpen })
    latest = echo
    // The page: the unchanged MessageList, then its flag-gated echo line right after it (off: nothing drawn).
    return React.createElement(React.Fragment, null,
      React.createElement(MessageList, { sessionId: state.scopeKey, userMessages: state.userMessages, messages: state.messages, ...refs, onActionClick: () => {} }),
      processEnv[FLAG] === 'true' && echo.echo && React.createElement(StudioSpeedEcho, { key: echo.echo.key, echo: echo.echo, studio: true, rootProps: undefined }))
  }
  const rootNode = new Root()
  rootNode.setElement(React.createElement(Page))
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 80) throw new Error('did not settle'); await macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  await settle()
  let ids = 0
  const set = async patch => { Object.assign(state, patch); rootNode.schedule(); await settle() }
  /** What handleSendMessage does, reduced to its outcome: after `ms` (0 = in the same task, like an open socket) it commits the draft as a user turn (or does not). */
  const handler = ({ ms = 0, commit = true, choice = false, throws = false } = {}) => (event) => {
    if (throws) throw new Error('synthetic send failure')
    return new Promise(resolve => {
      const done = () => {
        if (choice) state.choiceOpen = true
        if (commit) {
          const text = state.inputMessage.trim()
          state.userMessages = [...state.userMessages, { id: `synthetic-user-turn-${++ids}`, text, timestamp: env.clock.now(), attachments: state.attachmentsOnCommit ?? [] }]
          state.inputMessage = ''
        }
        rootNode.schedule()
        resolve(event?.type ?? null)
      }
      if (ms === 0) done(); else env.clock.setTimeout(done, ms)
    })
  }
  return {
    env, state, set, handler, settle, snapshot: loader.load('lib/user-message-attachments.ts').snapshotAttachedUploads,
    advance: async ms => { await env.clock.advance(ms, settle) },
    markup: () => renderToStaticMarkup(toElements(rootNode.tree)),
    hook: () => latest,
    /** The composer's submit: wrapped with the flag on (the page's ChatInput spread), the handler itself with it off. */
    submit: async (fn, event = { type: 'submit', preventDefault() {} }) => {
      const run = processEnv[FLAG] === 'true' ? latest.wrapSubmit(fn) : fn
      let result
      try { result = run(event) } catch (error) { await settle(); return { threw: error } }
      await settle()
      return { result }
    },
    pending: () => env.clock.pending(),
  }
}

const echoOf = html => (html.match(/data-studio-speed-echo="(pending|failed)"/) || [])[1] ?? null
const DRAFT = 'Build a four slide deck about tidal energy for city planners'
const expectNoEcho = (html, label) => ok(echoOf(html) === null && !html.includes('data-studio-speed-echo'), `${label}: no echo`)

/** Runs one scenario on two worlds (flag off, flag on) with the same inputs, then checks the end markup is equal. `steps(w, on)` drives a world and asserts along the way. */
async function scenario(name, { start = {}, steps, libText = null }) {
  const off = await world({ flagOn: false, start: structuredClone(start) })
  const on = await world({ flagOn: true, libText, start: structuredClone(start) })
  await steps(off, false)
  await steps(on, true)
  await off.advance(10_000); await on.advance(10_000)
  eq(on.markup(), off.markup(), `${name}: at rest the chat markup is byte-equal to flag off`)
  eq(JSON.stringify(on.state.userMessages), JSON.stringify(off.state.userMessages), `${name}: the committed user turns are the same`) // JSON: each world's arrays come from its own vm context
  eq(on.state.inputMessage, off.state.inputMessage, `${name}: the draft is the same`)
  eq(on.pending(), off.pending(), `${name}: no timer is left behind`)
  return { off: sha(off.markup()), on: sha(on.markup()) }
}

const SPEED = evaluateLib(fs.readFileSync(path.join(root, LIB), 'utf8'), { [FLAG]: 'true' })
const scenarios = {
  'slow first send (session row + Layout check, 900 ms)': {
    async steps(w, on) {
      await w.set({ inputMessage: DRAFT })
      await w.submit(w.handler({ ms: 900 }))
      await w.advance(SPEED.SPEED_ECHO_REVEAL_MS - 1); expectNoEcho(w.markup(), 'before the reveal window')
      await w.advance(1)
      const html = w.markup()
      if (on) {
        ok(echoOf(html) === 'pending', 'pending echo at 80 ms')
        ok(html.includes(DRAFT) && html.includes(SPEED.SPEED_ECHO_PENDING_LABEL), 'the echo shows the draft and "Sending…"')
        ok(html.includes('role="status"') && html.includes('data-studio-director-message="user"'), 'the echo is a quiet status and carries the user-bubble styling attribute')
        eq(w.state.userMessages.length, 0, 'the echo committed nothing')
      } else expectNoEcho(html, 'flag off: the base shows nothing yet')
      await w.advance(900 - SPEED.SPEED_ECHO_REVEAL_MS)
      expectNoEcho(w.markup(), 'after the commit'); eq(w.state.userMessages.length, 1, 'the base committed its bubble')
    },
  },
  'open socket: delivered in the same task': {
    async steps(w) {
      await w.set({ inputMessage: DRAFT }); await w.submit(w.handler({ ms: 0 }))
      for (const ms of [0, 80, 200]) { await w.advance(ms); expectNoEcho(w.markup(), `fast path at +${ms} ms`) }
    },
  },
  'refused at once (a preflight guard)': {
    async steps(w) {
      await w.set({ inputMessage: DRAFT }); await w.submit(w.handler({ ms: 0, commit: false }))
      for (const ms of [80, 500, 7000]) { await w.advance(ms); expectNoEcho(w.markup(), `refused send at +${ms} ms`) }
    },
  },
  'send fails after 1.2 s (draft kept, toast in the base)': {
    async steps(w, on) {
      await w.set({ inputMessage: DRAFT }); await w.submit(w.handler({ ms: 1200, commit: false }))
      await w.advance(1200)
      const html = w.markup()
      if (on) ok(echoOf(html) === 'failed' && html.includes(SPEED.SPEED_ECHO_FAILED_LABEL) && html.includes('role="alert"'), 'failed echo says "Not sent"')
      else expectNoEcho(html, 'flag off after the failure')
      await w.advance(SPEED.SPEED_ECHO_FAILED_MS - 1)
      if (on) ok(echoOf(w.markup()) === 'failed', 'still there 1 ms before it leaves')
      await w.advance(1); expectNoEcho(w.markup(), 'gone after SPEED_ECHO_FAILED_MS')
    },
  },
  'send fails, then the user edits the draft': {
    async steps(w, on) {
      await w.set({ inputMessage: DRAFT }); await w.submit(w.handler({ ms: 1200, commit: false }))
      await w.advance(1200); if (on) ok(echoOf(w.markup()) === 'failed', 'failed echo shown')
      await w.set({ inputMessage: `${DRAFT} and transit` }); expectNoEcho(w.markup(), 'gone as soon as the draft changes')
    },
  },
  'manual-deck choice opened instead of sending': {
    async steps(w, on) {
      await w.set({ inputMessage: DRAFT }); await w.submit(w.handler({ ms: 700, commit: false, choice: true }))
      await w.advance(100); if (on) ok(echoOf(w.markup()) === 'pending', 'pending while Layout is asked')
      await w.advance(600); expectNoEcho(w.markup(), 'the choice is waiting on the user: no "Not sent"')
    },
  },
  'session switched while pending': {
    async steps(w, on) {
      await w.set({ inputMessage: DRAFT }); await w.submit(w.handler({ ms: 900, commit: false }))
      await w.advance(300); if (on) ok(echoOf(w.markup()) === 'pending', 'pending before the switch')
      await w.set({ scopeKey: 'synthetic-session-other', inputMessage: '' }); expectNoEcho(w.markup(), 'dropped on the switch')
    },
  },
  'second Enter while the first send is in flight': {
    async steps(w, on) {
      await w.set({ inputMessage: DRAFT }); await w.submit(w.handler({ ms: 900 }))
      await w.advance(200); const first = (w.markup().match(/data-studio-speed-echo="pending"/g) || []).length
      await w.submit(w.handler({ ms: 0, commit: false }))
      await w.advance(100)
      if (on) { eq(first, 1, 'one echo'); eq((w.markup().match(/data-studio-speed-echo="pending"/g) || []).length, 1, 'still exactly one pending echo after the duplicate') }
      await w.advance(600); expectNoEcho(w.markup(), 'gone with the commit')
    },
  },
  'resend of a message already in the chat': {
    start: { userMessages: [{ id: 'synthetic-earlier-turn', text: DRAFT, timestamp: Date.UTC(2026, 9, 5, 11, 0, 0), attachments: [] }] },
    async steps(w, on) {
      await w.set({ inputMessage: DRAFT }); await w.submit(w.handler({ ms: 900 }))
      await w.advance(100); if (on) ok(echoOf(w.markup()) === 'pending', 'an earlier turn with the same text is not taken for the commit')
      await w.advance(800); expectNoEcho(w.markup(), 'gone with the new commit')
    },
  },
  'with an attached file': {
    start: { uploadedFiles: [{ id: 'synthetic-file-1', name: 'tides.pdf', size: 1200, type: 'application/pdf', status: 'success' }] },
    async steps(w, on) {
      await w.set({ inputMessage: DRAFT })
      w.state.attachmentsOnCommit = w.snapshot(w.state.uploadedFiles) // what the page commits: snapshotAttachedUploads of the attached files
      ok(w.state.attachmentsOnCommit.length === 1, 'the synthetic file is one the page attaches')
      await w.submit(w.handler({ ms: 900 }))
      await w.advance(100)
      if (on) ok(w.markup().includes('aria-label="1 attached file"'), 'the echo shows the attached file chip')
      await w.advance(800); expectNoEcho(w.markup(), 'gone with the commit')
    },
  },
  'the handler throws': {
    async steps(w) {
      await w.set({ inputMessage: DRAFT })
      const outcome = await w.submit(w.handler({ throws: true }))
      ok(outcome.threw instanceof Error, 'the error reaches the caller unchanged')
      for (const ms of [80, 500]) { await w.advance(ms); expectNoEcho(w.markup(), `after a throw at +${ms} ms`) }
    },
  },
  'empty draft': {
    async steps(w) {
      await w.set({ inputMessage: '   ' }); await w.submit(w.handler({ ms: 900, commit: false }))
      for (const ms of [80, 1000]) { await w.advance(ms); expectNoEcho(w.markup(), `empty draft at +${ms} ms`) }
    },
  },
}

const partB = {}
for (const [name, spec] of Object.entries(scenarios)) partB[name] = await scenario(name, spec)

// Flag off: the hook hands back the very handler, sets no state and starts no timer.
{
  const off = await world({ flagOn: false })
  const fn = off.handler({ ms: 900 })
  ok(off.hook().wrapSubmit(fn) === fn, 'flag off: wrapSubmit returns the handler itself')
  ok(off.hook().echo === null, 'flag off: no echo')
  const before = off.pending(); await off.set({ inputMessage: DRAFT }); off.hook().wrapSubmit(fn)
  eq(off.pending(), before, 'flag off: no timer started')
}
console.log(`PASS B  echo life, ${Object.keys(scenarios).length} scenarios through the real hook + MessageList: ${Object.entries(partB).map(([name, h]) => `${name.split(' (')[0]} ${h.on}`).join('; ')} (each = flag off at rest)`)

// ---- C. mutants of the lib --------------------------------------------------------------------------------
const libText = fs.readFileSync(path.join(root, LIB), 'utf8')
/** The lib's pure rules, one by one (some guard races the offline host cannot produce, e.g. a reveal timer firing between a settle and the effect that drops the echo). */
function unitChecks(lib) {
  const begin = lib.speedEchoBegin({ token: 7, text: DRAFT, userMessages: [{ id: 'a', text: DRAFT, timestamp: 1 }], scopeKey: 's' })
  const context = { userMessages: [{ id: 'a', text: DRAFT, timestamp: 1 }], scopeKey: 's', inputMessage: DRAFT, choiceOpen: false }
  eq(lib.speedEchoBegin({ token: 1, text: '', userMessages: [], scopeKey: 's' }), null, 'unit: an empty draft has no echo')
  eq(lib.speedEchoView(begin, context), null, 'unit: not drawn before the reveal')
  const settledFirst = lib.speedEchoSettle(begin, 7)
  eq(lib.speedEchoReveal(settledFirst, 7).revealed, false, 'unit: a send that settled inside the window is never revealed')
  const shown = lib.speedEchoReveal(begin, 7)
  eq(lib.speedEchoView(shown, context)?.status, 'pending', 'unit: revealed and in flight = pending (an earlier turn with the same text is not its commit)')
  eq(lib.speedEchoView(shown, { ...context, userMessages: [...context.userMessages, { id: 'b', text: DRAFT, timestamp: 2 }] }), null, 'unit: a new turn with the text = committed')
  eq(lib.speedEchoView(shown, { ...context, scopeKey: 'other' }), null, 'unit: another session drops it')
  const failed = lib.speedEchoSettle(shown, 7)
  eq(lib.speedEchoView(failed, context)?.status, 'failed', 'unit: settled without a commit = failed')
  eq(lib.speedEchoView(failed, { ...context, choiceOpen: true }), null, 'unit: the manual-deck choice is not a failure')
  eq(lib.speedEchoView(failed, { ...context, inputMessage: 'edited' }), null, 'unit: an edited draft dismisses it')
  eq(lib.speedEchoReveal(shown, 8), shown, 'unit: another token changes nothing')
  eq(lib.speedEchoInFlight(shown, DRAFT, 's'), true, 'unit: the same draft in flight')
  eq(lib.speedEchoInFlight(failed, DRAFT, 's'), false, 'unit: a settled echo is not in flight')
  eq([lib.SPEED_ECHO_REVEAL_MS, lib.SPEED_ECHO_FAILED_MS], [80, 6000], 'unit: the two timings')
}
unitChecks(SPEED)
eq(evaluateLib(libText, {}).STUDIO_SPEED_PERCEIVED_ENABLED, false, 'unit: flag unset = off')
eq(evaluateLib(libText, { [FLAG]: 'TRUE' }).STUDIO_SPEED_PERCEIVED_ENABLED, false, 'unit: only the exact "true" turns it on')
eq(evaluateLib(libText, { [FLAG]: 'true' }).STUDIO_SPEED_PERCEIVED_ENABLED, true, 'unit: "true" turns it on')
const mutants = [
  ['reveal ignores a settled send', 'return echo && echo.token === token && !echo.revealed && !echo.settled ?', 'return echo && echo.token === token && !echo.revealed ?'],
  ['commit ignores the known ids', 'userMessages.some(message => !known.has(message.id) && message.text === echo.text)', 'userMessages.some(message => message.text === echo.text)'],
  ['failed shown while the choice is open', 'if (!echo.revealed || context.choiceOpen) return true', 'if (!echo.revealed) return true'],
  ['no scope check', 'if (echo.scopeKey !== context.scopeKey) return true', ''],
  ['failed echo never times out', 'export const SPEED_ECHO_FAILED_MS = 6000', 'export const SPEED_ECHO_FAILED_MS = 600000'],
  ['a draft edit does not dismiss', 'return speedEchoText(context.inputMessage) !== echo.text', 'return false'],
  ['status inverted', "status: echo.settled ? 'failed' : 'pending'", "status: echo.settled ? 'pending' : 'failed'"],
  ['duplicate submit replaces the echo', 'return Boolean(echo && !echo.settled && echo.text === text && echo.scopeKey === scopeKey)', 'return false'],
  ['reveal at once', 'export const SPEED_ECHO_REVEAL_MS = 80', 'export const SPEED_ECHO_REVEAL_MS = 0'],
  ['flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED === 'true'", "process.env.NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED !== 'off'"],
  ['empty draft echoed', 'if (!input.text) return null', ''],
]
// Control: the unmutated text through the same stub path passes every scenario.
for (const [name, spec] of Object.entries(scenarios)) await scenario(`control ${name}`, { ...spec, libText })
let caught = 0
for (const [label, from, to] of mutants) {
  assert.equal(libText.split(from).length, 2, `mutant "${label}" anchors once`)
  const text = libText.replace(from, to)
  let killed = false
  try {
    unitChecks(evaluateLib(text, { [FLAG]: 'true' }))
    if (evaluateLib(text, { [FLAG]: '1' }).STUDIO_SPEED_PERCEIVED_ENABLED !== false) throw new Error('loose flag')
    for (const [name, spec] of Object.entries(scenarios)) await scenario(`mutant ${name}`, { ...spec, libText: text })
    if (label === 'flag read loosely') {
      const w = await world({ flagOn: false, libText: text })
      const fn = w.handler({ ms: 900 }); if (w.hook().wrapSubmit(fn) !== fn) throw new Error('flag off wraps')
    }
  } catch { killed = true }
  ok(killed, `mutant "${label}" is caught`)
  caught++
}
console.log(`PASS C  ${caught} of ${mutants.length} lib mutants caught (control run of the unmutated text through the same stub path passed)`)

// ---- D. scope over the committed diff -----------------------------------------------------------------------
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
const BASE = stripModule.BASE_COMMIT
const HEAD = git('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^(Speed perceived|Studio perceived speed):', 'HEAD').trim() || git('rev-parse', 'HEAD').trim() // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): this change's own newest commit, so a change stacked after it is not read as this one's diff
if (HEAD === BASE) {
  console.log('SKIP D  nothing committed on top of the base yet (the scope check reads BASE..HEAD only)')
} else {
  const changed = git('diff', '--name-only', `${BASE}..${HEAD}`).split('\n').filter(Boolean).sort()
  eq(changed, [...stripModule.SPEED_PERCEIVED_SCOPE_FILES].sort(), 'D: the committed diff touches exactly this change\'s files')
  for (const rel of stripModule.SPEED_PERCEIVED_FILES) {
    const head = git('show', `${HEAD}:${rel}`), base = git('show', `${BASE}:${rel}`)
    eq(stripModule.stripSpeedPerceived(rel, head), base, `D: ${rel} without its marked lines is the base, byte for byte`)
    const diff = git('diff', '-U0', `${BASE}..${HEAD}`, '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    ok(diff.length > 0 && diff.every(line => line.startsWith('+') && stripModule.SPEED_PERCEIVED_MARKER_RE.test(line)), `D: ${rel} gains only marked lines`)
  }
  eq(git('show', `${HEAD}:.env.example`), `${git('show', `${BASE}:.env.example`)}\n${stripModule.SPEED_PERCEIVED_ENV_BLOCK}`, 'D: .env.example is the base plus the block')
  // the older proofs this change teaches (all FRONTEND-2's own): with their registry-read lines put back they are the base's files, byte for byte; each taught line is there once and carries the mark; an unmarked change is not put back
  eq(stripModule.SPEED_PERCEIVED_PIN_FILES.length, 3, 'D: three older proofs are taught')
  for (const rel of stripModule.SPEED_PERCEIVED_PIN_FILES) {
    const head = git('show', `${HEAD}:${rel}`), base = git('show', `${BASE}:${rel}`)
    ok(!/test-studio-p2-|launch-wording|env-append-tolerant|route-params|admin-email-guard|uat-marketing|docs|landing/.test(rel), `D: ${rel} is not a FRONTEND-1 test`)
    eq(stripModule.putBackPin(rel, head), base, `D: ${rel} with its registry-read lines put back is the base, byte for byte`)
    eq(stripModule.stripSpeedPerceived(rel, head), base, `D: ${rel} through the strip is the base, byte for byte`)
    for (const [has, was] of stripModule.SPEED_PERCEIVED_PIN_EDITS[rel]) {
      eq(head.split(has).length - 1, 1, `D: ${rel}: a taught line is there once`)
      ok(has.endsWith('\n') && has.includes(stripModule.SPEED_PERCEIVED_PIN_MARK) && has.split('\n').length === 2 && (was === '' || (was.endsWith('\n') && was.split('\n').length === 2)), `D: ${rel}: one whole line, marked, for one whole line or none`)
      ok(was === '' || base.includes(was), `D: ${rel}: the line it replaces is the base's`)
    }
    const [firstHas] = stripModule.SPEED_PERCEIVED_PIN_EDITS[rel][0]
    ok(stripModule.putBackPin(rel, head.replace(firstHas, () => `${firstHas}const unmarked = 1\n`)) !== base, `D: ${rel}: an unmarked line added next to a taught one is not put back`)
    ok(stripModule.putBackPin(rel, head.replace(stripModule.SPEED_PERCEIVED_PIN_MARK, () => '//')) !== base, `D: ${rel}: a taught line that loses its mark is not put back`)
  }
  const registryDiff = git('diff', '-U0', `${BASE}..${HEAD}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
  eq(registryDiff.length, 3, 'D: the registry gains three lines')
  ok(registryDiff.every(line => line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-speed-perceived-strip.mjs')), 'D: each is a LATER-CHANGE line naming this strip')
  const css = git('show', `${HEAD}:components/builder/studio-speed-perceived.css`).replace(/\/\*[\s\S]*?\*\//g, '')
  const selectors = css.split('}').map(rule => rule.split('{')[0].trim()).filter(Boolean)
  ok(selectors.length > 0 && selectors.every(selector => selector.includes('[data-studio-speed-echo')), 'D: every CSS rule is keyed to [data-studio-speed-echo] (flag off nothing can match)')
  console.log(`PASS D  committed diff ${BASE.slice(0, 8)}..${HEAD.slice(0, 8)}: ${changed.length} files, all this change's; marked insertions only; strips give the base byte for byte`)
}

// ---- E. no credential-shaped literal in this change's new files and marked lines ----------------------------------------------------------------
// The patterns of scripts/test-studio-thumbnail-last-good.mjs, whose added-lines scan leaves a registered later change's NEW files to their own proofs (this change's among them). Its bare "key" name is narrowed to api_key: a React
// key (key: `speed-echo-${echo.token}`) and the synthetic scopeKey values of the scenarios are not credentials.
{
  const CRED_NAME = /(?:api[_-]?key|secret|token|passw(?:or)?d|credential)[A-Za-z0-9_]*['"]?\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i
  const CRED_STRING = /eyJ[A-Za-z0-9_-]{10,}\.|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|Bearer [A-Za-z0-9._-]{20,}/
  const text = rel => fs.readFileSync(path.join(root, rel), 'utf8')
  const added = [...stripModule.SPEED_PERCEIVED_NEW_FILES.map(text), ...stripModule.SPEED_PERCEIVED_FILES.flatMap(rel => text(rel).split('\n').filter(line => stripModule.SPEED_PERCEIVED_MARKER_RE.test(line))), stripModule.SPEED_PERCEIVED_ENV_BLOCK].join('\n')
  ok(!CRED_NAME.test(added), 'E: no quoted literal assigned to a credential-shaped name in the new files, the marked lines and the .env.example block')
  ok(!CRED_STRING.test(added), 'E: no token, key or bearer string there either')
  // the scan bites: a credential-named literal, and a bearer string in an ordinary name, are both seen (built from parts so that this file does not match)
  ok(CRED_NAME.test(`const ${['api', 'Key'].join('')} = '${['abcdefgh', '12345678'].join('')}'`), 'E: control: a credential-named literal is seen')
  ok(CRED_STRING.test(`const note = '${['Bearer ', 'a'.repeat(24)].join('')}'`) && CRED_STRING.test(['AKIA', 'ABCDEFGH', '12345678'].join('')), 'E: control: a bearer string and a key id are seen')
  console.log(`PASS E  no credential-shaped literal in ${stripModule.SPEED_PERCEIVED_NEW_FILES.length} new files, the marked lines and the .env.example block (the patterns of scripts/test-studio-thumbnail-last-good.mjs)`)
}

release()
console.log(`\nStudio perceived speed (${FLAG}): ${checks} checks passed.`)
