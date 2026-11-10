// FRONTEND-1 (W6 P4-21, part 1): the voice call's end-to-end REPLAY, as a repeatable proof. DIRECTOR-2's P4-18 recordings (V0 typed, V1 and V2 voice; scripts/fixtures/studio-voice-call-replay/) are replayed
// frame by frame, in recording order, through the REAL socket hook (hooks/use-deckster-websocket-v2.ts on a fake WebSocket), the REAL call hook (hooks/use-studio-voice-call.ts), the REAL controller and lib
// (lib/studio-voice-call-controller.ts, lib/studio-voice-call-ui.ts, ELEMENT-3's core) and the page's own click on a card (handleActionClick, read out of app/builder/page.tsx by AST, as the chat transcript harness does).
//
// WHICH MODE: the SANDBOX (this file, headless, no network, a virtual clock) is the proof, and its only mode: the repo's own TypeScript is transpiled into one vm context that holds a fake WebSocket, a fake clock, a fake
// microphone, a fake speaker and a fake speech port. Only the browser's things are fakes (the socket, getUserMedia, the speaker, the two same-origin speech routes); every decision is the product's code. A real-page
// replay (a running Studio build, Chromium) is NOT part of this proof and `--browser` is refused with that said (see docs/p4-20/VOICE-CALL-UI.md).
//
//   a  V0 (typed): no voice turns on the wire, nothing spoken, the microphone never opened, the companion idle / absent; the wire is the flag-off wire.
//   b  V1 / V2: every payload.spoken line of a reply or a card is said exactly once and in recording order; nothing is said that is not in payload.spoken (the one named exception is the filler line, which the contract
//      leaves to the client); progress lines follow Garud's spacing rules (4 s of quiet, 6 s apart, only the newest, none stale, never over speech or the user).
//   c  The companion state of every frame matches README.md's table (payload.companion_state when present, else the frame mapping of CONTRACT.md section 3), read where the controller derives it from the frame it was
//      handed by the socket hook; and the scene it draws for the frames that are not masked by the call (listening, a turn waiting, speaking).
//   d  A spoken "yes" to the plan card sends that card's action_value and label with mode "voice" and voice1, and the card is marked answered by askAnswerKey (the bare id; with the identity flag, id and timestamp).
//   e  A typed message in the middle of a call keeps the call open, and its reply is not spoken.
//   f  Stop and barge-in cancel the speech and drop that turn's remaining lines (the rest of the reply and the reply that was still on its way).
//   g  Mutants: every one of them must be caught, and each of a-f has its own.
//   h  The conventions of scripts/test-studio-voice-call.mjs: this change's own commits ("Voice call:"), the strip registered, the marked lines of the existing files untouched by this proof.
//
//   node scripts/test-studio-voice-call-replay.mjs [--only a,e,bcd,c-scene,f] [--verbose] [--timeline live|recorded]
//   (VOICE_TEST_SKIP_MUTANTS=1 skips g; VOICE_CALL_PROOF_NO_COMMITS=1 before the first "Voice call:" commit)
//
// Offline: no microphone, no audio, no socket, no fetch and no real timer (the host network guard is installed); git is read only for h.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import ts from 'typescript'
import { createEnvironment, installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'
import { Root } from './studio-chat-harness/mini-react.mjs'
import { BASE_ENV, PROFILES } from './studio-chat-harness/profiles.mjs'
import { esmPackages, lucideStub } from './studio-chat-harness/esm-packages.mjs'
import { pageSources } from './studio-chat-harness/page-sources.mjs'
import * as extract from './studio-chat-harness/page-extract.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = name => args.includes(name)
const argValue = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : null }
if (flag('--browser')) { console.error('--browser: the real-page replay is not part of this proof (it needs a running Studio build with NEXT_PUBLIC_STUDIO_VOICE_CALL=true and a browser). The sandbox replay is the proof: run it without --browser.'); process.exit(2) }
const release = installHostNetworkGuard(net, dns)
let checks = 0
const state = { mutating: false }
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(plain(actual), plain(expected), message) }
/** Data that crossed the vm boundary or came from the recording, as host-realm JSON (deepEqual compares prototypes). */
function plain(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const strip = await import('./studio-voice-call-strip.mjs')

const UI = 'lib/studio-voice-call-ui.ts', CTL = 'lib/studio-voice-call-controller.ts', HOOK = 'hooks/use-studio-voice-call.ts', WS = 'hooks/use-deckster-websocket-v2.ts', PAGE = 'app/builder/page.tsx'
const FIXTURES = 'scripts/fixtures/studio-voice-call-replay'
const SESSION = 's_p418_v'

// ============================================================================================================================================
// The recordings and the contract's tables
// ============================================================================================================================================
const RECORDINGS = Object.fromEntries(['V0', 'V1', 'V2'].map(name => [name, JSON.parse(read(`${FIXTURES}/scenario-${name}.json`))]))
/** The per-frame tables of README.md (seq -> companion_state, spoken), parsed from the copy of the recorder's README that sits beside the recordings. */
function parseReadmeTable(markdown, heading) {
  const at = markdown.indexOf(heading)
  if (at < 0) throw new Error(`README.md has no "${heading}"`)
  const rows = new Map()
  for (const line of markdown.slice(at).split('\n').slice(1)) {
    if (line.startsWith('## ') && rows.size) break
    const match = /^\| (\d+) \| (\d+) \| ([\d.]+) \| (.*) \| (thinking|working|reporting|pleased|concerned|waiting)? \| (.*) \|$/.exec(line)
    if (match) rows.set(Number(match[1]), { turn: Number(match[2]), frame: match[4], state: match[5] || null, spoken: match[6] || null })
  }
  return rows
}
const README = read(`${FIXTURES}/README.md`)
const README_TABLES = { V1: parseReadmeTable(README, '## V1: per-frame table'), V2: parseReadmeTable(README, '## V2: per-frame table, turns 4 and 5') }

// ============================================================================================================================================
// A tiny module host: the real files (or a mutant of one), in one vm context that holds the fake browser
// ============================================================================================================================================
const compiledCache = new Map()
function compile(text, fileName) {
  const key = `${fileName}\u0000${text}`
  if (compiledCache.has(key)) return compiledCache.get(key)
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  compiledCache.set(key, out.outputText)
  return out.outputText
}
const hostRequire = createRequire(path.join(root, 'package.json'))
function createHost({ globals, stubs = {}, fileStubs = {}, over = {} }) {
  const context = vm.createContext({ ...globals })
  const cache = new Map()
  const resolveFile = base => {
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
    throw new Error(`replay host: cannot resolve ${path.relative(root, base)}`)
  }
  const requireFrom = (from, specifier) => {
    if (Object.prototype.hasOwnProperty.call(stubs, specifier)) return stubs[specifier]
    if (/\.(css|scss|svg|png)$/.test(specifier)) return {}
    if (specifier.startsWith('@/')) return loadFile(resolveFile(path.join(root, specifier.slice(2))))
    if (specifier.startsWith('./') || specifier.startsWith('../')) return loadFile(resolveFile(path.resolve(path.dirname(from), specifier)))
    if (specifier.startsWith('node:') || ['fs', 'net', 'http', 'https', 'child_process', 'dns', 'tls', 'dgram', 'os', 'path', 'crypto', 'stream', 'zlib', 'worker_threads'].includes(specifier)) {
      throw new Error(`replay host: node built-in "${specifier}" is refused (imported by ${path.relative(root, from)})`)
    }
    return hostRequire(specifier)
  }
  const loadFile = file => {
    const rel = path.relative(root, file)
    const stubKey = rel.replace(/\.(tsx?|jsx?|mjs)$/, '')
    if (Object.prototype.hasOwnProperty.call(fileStubs, stubKey)) return fileStubs[stubKey]
    if (cache.has(file)) return cache.get(file).exports
    const text = rel in over ? over[rel] : fs.readFileSync(file, 'utf8')
    const module = { exports: {} }
    cache.set(file, module)
    const wrapper = vm.runInContext(`(function (module, exports, require, __filename) {${compile(text, rel)}\n})`, context, { filename: file })
    wrapper(module, module.exports, specifier => requireFrom(file, specifier), file)
    return module.exports
  }
  return { context, load: rel => loadFile(resolveFile(path.join(root, rel))) }
}

// ============================================================================================================================================
// The world: the page (the socket hook, the call hook, the page's own card click), the call's fakes and the log of everything observable
// ============================================================================================================================================
const macro = () => new Promise(resolve => setImmediate(resolve))
/** The page's own useStudioVoiceCall({...}) argument, as the page writes it (read from the raw page text: the harness strips marked lines). */
function voiceHookOptionsExpression(over = {}) {
  const text = PAGE in over ? over[PAGE] : read(PAGE)
  const source = ts.createSourceFile(PAGE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const call = extract.findCalls(source, 'useStudioVoiceCall')
  if (call.length !== 1) throw new Error(`the page has ${call.length} useStudioVoiceCall calls`)
  return extract.compile(call[0].arguments[0], source, 'page.useStudioVoiceCall(options)')
}

async function makeWorld({ over = {}, processEnv = {}, speech = {} } = {}) {
  const env = createEnvironment({ processEnv: { ...BASE_ENV, ...PROFILES.studio, NEXT_PUBLIC_CHAT_DIRECTIVES: 'true', NEXT_PUBLIC_STUDIO_VOICE_CALL: 'true', ...processEnv } })
  const clock = env.clock
  const log = {
    wire: [], played: [], requested: [], signals: [], delivered: [], micOpened: 0, micClosed: 0, recordings: 0, cancelled: 0, stops: 0, primed: 0, transcribed: [], answeredKeys: [],
    events: [], // everything the progress rules need, in virtual time: { at, kind, ... }
  }
  const t0 = clock.now()
  const rel = () => clock.now() - t0
  const queue = []
  // ---- the browser's things, faked: the microphone, the speaker, the two speech routes -----------------------------------------------------------
  const audioText = new WeakMap()
  /** A line starts 40 ms after it is played and lasts 400 ms plus 65 ms a character (a spoken pace); `fail` makes the speech routes answer with that router error kind. */
  const speechState = { fail: speech.fail ?? null, msPerChar: 65, leadMs: 400, startMs: 40 }
  const player = (() => {
    let timers = [], current = null
    const clear = () => { for (const id of timers) clock.clearTimeout(id); timers = []; current = null }
    return {
      level: 0.3,
      prime() { log.primed++ },
      stop() { log.stops++; if (current) log.events.push({ at: rel(), kind: 'clip_stopped', text: current.text }); clear() },
      play(blob, hooks) {
        const text = audioText.get(blob) ?? '?'
        clear()
        current = { text }
        timers.push(clock.setTimeout(() => { log.played.push({ at: rel(), text }); log.events.push({ at: rel(), kind: 'clip_start', text }); hooks.onStart() }, speechState.startMs))
        timers.push(clock.setTimeout(() => { log.events.push({ at: rel(), kind: 'clip_end', text }); current = null; hooks.onEnd() }, speechState.startMs + speechState.leadMs + speechState.msPerChar * text.length))
      },
    }
  })()
  const voiceEnv = {
    secureContext: () => true, hasMic: () => true, reducedMotion: () => false, macApp: () => false, mac: () => false,
    now: () => clock.now(), setTimer: (fn, ms) => clock.setTimeout(fn, ms), clearTimer: id => clock.clearTimeout(id),
    openMic: async () => {
      log.micOpened++
      return {
        level: () => 0.2, setMuted() {},
        record: () => { log.recordings++; return { stop: async () => ({ blob: new Blob(['audio']), durationMs: 1600, peak: 0.3 }), cancel: () => { log.cancelled++ } } },
        close: () => { log.micClosed++ },
      }
    },
    createPlayer: () => player,
  }
  const voicePort = {
    transcribe: async () => {
      const words = queue.length ? queue.shift() : ''
      log.transcribed.push({ at: rel(), words })
      log.events.push({ at: rel(), kind: 'transcribed', words })
      return { text: words, costUsd: null }
    },
    speak: async (text, opts) => {
      log.requested.push({ at: rel(), text, during: world.currentFrame ? world.currentFrame.seq : null, aborted: !!opts?.signal?.aborted })
      if (opts?.signal?.aborted) throw new (world.router.VoiceRouterError)('aborted', 'x')
      if (speechState.fail) throw new (world.router.VoiceRouterError)(speechState.fail, 'x')
      const audio = new Blob([text])
      audioText.set(audio, text)
      return { audio, costUsd: null }
    },
  }
  // ---- the host: the real files, in one vm context with the fake browser -------------------------------------------------------------------------
  const fileStubs = {
    'hooks/use-auth': { useAuth: () => ({ user: { id: 'u_test', email: 'u_test@example.invalid' }, isLoading: false }) },
    'lib/studio-voice-call-browser': { browserVoiceEnv: () => voiceEnv, browserVoicePort: () => voicePort },
    'components/builder/voice-call/voice-call-stage': { VoiceCallStage: function FakeStage() { return null } },
  }
  const stubs = { ...(await esmPackages(root)), react: React, 'lucide-react': lucideStub(React) }
  const host = createHost({ globals: env.globals, stubs, fileStubs, over })
  const world = { env, clock, log, host, queue, currentFrame: null, speechState, player, ctl: null, t0 }
  // the controller is the real class; the subclass only keeps the instance (the hook builds it, the page never sees it)
  const RealController = host.load(CTL).VoiceCallController
  stubs['@/lib/studio-voice-call-controller'] = { VoiceCallController: class extends RealController { constructor(options) { super(options); world.ctl = this } } }
  world.ui = host.load(UI)
  world.router = host.load('lib/studio-voice-call-router.ts')
  world.core = host.load('lib/studio/voice/index.ts')
  // the spy on the one derivation the controller makes from a frame: which state the frame it was handed means
  const realSignal = world.ui.signalFromFrame
  world.ui.signalFromFrame = frame => {
    const signal = realSignal(frame)
    log.signals.push({ seq: world.currentFrame?.seq ?? null, type: frame?.type, id: frame?.message_id ?? null, signal: signal ? plain(signal) : null })
    return signal
  }
  const hookModule = host.load(WS)
  const voiceHook = host.load(HOOK)
  const askAnswerKey = host.load('lib/director-ask-identity.ts').askAnswerKey
  const sources = pageSources(root)
  const voiceOptions = voiceHookOptionsExpression(over)

  // ---- the page, as the transcript harness builds it (the page's own handlers, read out of app/builder/page.tsx by AST) ---------------------------------
  const refs = {
    answeredActionsRef: { current: new Set() }, userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() }, hasSeenWelcomeRef: { current: false },
    messagesEndRef: { current: null }, textareaRef: { current: null }, actionSubmissionPendingRef: { current: new Set() }, questionSubmissionPendingRef: { current: false }, isExecutingSendRef: { current: false },
    isGeneratingFinalRef: { current: false },
    questionSubmissionScopeRef: { current: { active: true, generation: 0, sessionId: SESSION, userId: 'u_test', routeSessionId: SESSION, freshRouteSourceSessionId: null } },
    transcriptScopeRef: { current: { userIntentSeen: false, generation: 1 } },
  }
  const toasts = []
  const toast = value => { toasts.push(value) }
  const persistence = { queueMessage() {}, generateTitle: text => text.slice(0, 50), updateMetadata() {} }
  const probe = { latest: null, pending: new Set() }
  const track = promise => { const watched = Promise.resolve(promise).catch(() => {}); probe.pending.add(watched); watched.finally(() => probe.pending.delete(watched)); return promise }
  function Page() {
    const R = React
    const [userMessages, setUserMessages] = R.useState([])
    const [isGeneratingFinal, setIsGeneratingFinal] = R.useState(false)
    const [templateReuseAwaitingInput, setTemplateReuseAwaitingInput] = R.useState(false)
    const [inputMessage, setInputMessage] = R.useState('')
    const [pendingActionInput, setPendingActionInput] = R.useState(null)
    refs.isGeneratingFinalRef.current = isGeneratingFinal
    const studioShell = env.globals.process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
    const sessionApi = {
      userMessages, setUserMessages, isLoadingSession: false, answeredActionsRef: refs.answeredActionsRef, userMessageIdsRef: refs.userMessageIdsRef, userMessageContentMapRef: refs.userMessageContentMapRef,
      hasSeenWelcomeRef: refs.hasSeenWelcomeRef, hasTitleFromUserMessageRef: { current: false }, hasTitleFromPresentationRef: { current: false },
      markStudioUserIntent: () => { refs.transcriptScopeRef.current.userIntentSeen = true }, hasStudioUserIntent: () => refs.transcriptScopeRef.current.userIntentSeen, studioFrontendTranscriptReceipt: null,
    }
    const base = {
      React: R, process: env.globals.process, console: env.console, Date: env.globals.Date, crypto: env.crypto, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, requestAnimationFrame: clock.requestAnimationFrame,
      studioShell, features: { immediateConnection: true }, STUDIO_VOICE_INTERACTIVE_ENABLED: false,
      currentSessionId: SESSION, researchEnabled: false, webSearchEnabled: false, extendedGenerationEnabled: true, knowledgeGraphEnabled: false, canUseKnowledgeGraph: false, showKnowledgeGraphToggle: false,
      sessionStoreName: null, buildSendOptions: {}, deckIdentity: null, askGatesLocked: false, suppressEphemeral: false, activeTemplate: null,
      user: { id: 'u_test', email: 'u_test@example.invalid' }, toast, persistence, session: sessionApi, ...refs, isGeneratingFinal, setIsGeneratingFinal, templateReuseAwaitingInput, setTemplateReuseAwaitingInput,
      inputMessage, setInputMessage, pendingActionInput, setPendingActionInput, setWorkflowBrief: () => {}, awaitingDirectorReply: false, uploadedFiles: [], quota: { status: null }, STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED: false,
      SUPERSEDED_NOTICE_TITLE: '', SUPERSEDED_NOTICE_DETAIL: '', studioOutlineCanvas: undefined, turnContext: undefined, effectivePresentationUrl: undefined, isThemeSyncTerminal: () => false,
    }
    const hookOptions = {}
    for (const [name, evaluate] of Object.entries(sources.compiled.hookOptions)) hookOptions[name] = evaluate(base)
    const options = {
      ...hookOptions, existingSessionId: SESSION, autoConnect: false,
      onSessionStateChange: () => {}, onSlideComposeProgress: () => {}, onSlideBuilt: () => {}, onSlideComposeReady: () => {}, onSlideComposeFailed: () => {}, onElementDirective: () => {}, onSessionDirective: () => {},
      onBuildPhase: () => {}, onBuildEvent: () => {}, onBuildStateSync: () => {},
    }
    options.onMessage = message => sources.compiled.onMessage(base)(message)
    const ws = hookModule.useDecksterWebSocketV2(options)
    const values = { ...base, ...ws, wsError: ws.error, wsSessionId: ws.sessionId, session: sessionApi, connected: ws.connected, connecting: ws.connecting, transportNotice: ws.transportNotice, oneLiveTabSuperseded: false }
    values.preflightDirectorTurn = sources.compiled.preflightDirectorTurn(values)
    values.handleActionClick = sources.compiled.handleActionClick(values)
    // The page's handleSendMessage(undefined, text) is the typed-turn path: the preflight, the page's own option object, the hook's own send, then the commit (the tail of handleSendMessage, as the transcript harness mirrors it).
    values.handleSendMessage = async (_event, overrideText) => {
      const text = String(overrideText ?? values.inputMessage).trim()
      if (!values.preflightDirectorTurn()) return false
      const typedOptions = sources.compiled.typedOptions(values)
      const delivered = await ws.sendMessageWhenConnected(text, undefined, 0, typedOptions, undefined, () => true)
      if (delivered !== true) { toast({ title: "Couldn't reach the Director" }); return false }
      const id = env.crypto.randomUUID()
      refs.userMessageIdsRef.current.add(id)
      setUserMessages(prev => [...prev, { id, text, timestamp: clock.now(), attachments: [] }])
      return true
    }
    const voice = voiceHook.useStudioVoiceCall(voiceOptions(values))
    probe.latest = { ws, values, voice, userMessages }
    return R.createElement(R.Fragment, null)
  }
  let root_ = null
  const settle = async () => {
    for (let quiet = 0, rounds = 0; quiet < 2; rounds++) {
      if (rounds > 80) throw new Error('replay: the page did not settle after 80 rounds')
      await macro()
      quiet = root_.flush() || probe.pending.size ? 0 : quiet + 1
    }
    root_.schedule(); root_.flush() // the call hook subscribes to the controller, which the offline React host does not do: draw its snapshot once more
  }
  /** Run virtual time forward `ms`, firing every timer due, letting promises and renders drain after each one. */
  const advance = async ms => { await clock.advance(ms, settle) }
  Object.assign(world, {
    settle, advance, answerKey: askAnswerKey, refs, toasts,
    mount: async () => { root_ = new Root(); root_.setElement(React.createElement(Page)); await settle() },
    unmount: async () => { root_.unmount(); root_ = null; await advance(0) },
    page: () => probe.latest,
    snap: () => world.ctl?.getSnapshot() ?? null,
    outbound: () => env.outbound.filter(item => item.data !== 'ping').map(item => JSON.parse(item.data)),
    userMessages: () => world.outbound().filter(item => item.type === 'user_message'),
  })
  return world
}

// ============================================================================================================================================
// The oracle: written from CONTRACT.md and README.md (and the P4-20 doc's frame table), not read out of the code under test
// ============================================================================================================================================
/** CONTRACT.md section 3: the frames that can carry a spoken line or a state (the socket hook shows exactly these to the call). */
const VOICE_FRAME_TYPES = ['chat_message', 'action_request', 'status_update', 'build_phase', 'build_event', 'slide_progress', 'slide_built', 'slide_failed']
/** reply: a chat_message report or a card (always said, chunk by chunk); progress: a status, a phase or a deck-scope event (the client decides, Garud's rules); null: never said. */
function classOf(frame) {
  const payload = frame.payload ?? {}
  if (typeof payload.spoken !== 'string' || !payload.spoken.trim()) return null
  if (frame.type === 'action_request') return 'reply'
  if (frame.type === 'chat_message') return payload.ephemeral === true ? null : 'reply'
  if (frame.type === 'status_update' || frame.type === 'build_phase') return 'progress'
  if (frame.type === 'build_event') return payload.scope === 'deck' ? 'progress' : null
  return null
}
/** What a frame means with no companion_state on it: Studio's frame mapping (docs/p4-20/VOICE-CALL-UI.md: "from the frame's type when not"; the table of the P4-20 lib proof). */
function frameMapping(frame) {
  const payload = frame.payload ?? {}
  switch (frame.type) {
    case 'status_update': return { thinking: 'thinking', generating: 'working', error: 'concerned', idle: 'idle' }[payload.status] ?? null
    case 'build_phase': return { planning: 'working', strawman: 'working', building: 'working', qa: 'working', finalizing: 'working', complete: 'pleased', paused: 'waiting', stopped: 'waiting', error: 'concerned' }[payload.phase] ?? null
    case 'build_event': return { started: 'working', progress: 'working', error: 'concerned' }[payload.status] ?? null
    case 'slide_progress': return 'working'
    case 'slide_built': return 'pleased'
    case 'slide_failed': return 'concerned'
    case 'action_request': return 'waiting'
    case 'chat_message': return payload.ephemeral === true ? null : 'reporting'
    default: return null
  }
}
/** README.md's rule for the state of a frame: its companion_state when it has one, else the frame mapping. Frames the call is not shown have none. */
const expectedState = frame => (!VOICE_FRAME_TYPES.includes(frame.type) ? null : frame.payload?.companion_state ?? frameMapping(frame))
/** The state a derived signal stands for (a paused build is the hold pose of "waiting"). */
const labelOf = signal => (!signal ? null : ({ thinking: 'thinking', working: 'working', reporting: 'reporting', pleased: 'pleased', concerned: 'concerned', waiting: 'waiting', paused: 'waiting', idle: 'idle' })[signal.kind] ?? `?${signal.kind}`)

/** The recordings agree with themselves and with README.md's tables (so the fixtures are the ones the README describes). */
function recordingSuite() {
  const counts = /V1: (\d+) outbound, (\d+) inbound; (\d+) frames with `spoken`, (\d+) with `companion_state`\. V2: (\d+) outbound, (\d+) inbound; (\d+) frames with `spoken`, (\d+) with `companion_state`\. V0: (\d+) outbound, (\d+) inbound; (\d+) frames with `spoken`, (\d+) with `companion_state`/.exec(README)
  ok(!!counts, 'c: README.md states the frame counts of V1, V2 and V0')
  const stated = { V1: counts.slice(1, 5).map(Number), V2: counts.slice(5, 9).map(Number), V0: counts.slice(9, 13).map(Number) }
  for (const [name, rec] of Object.entries(RECORDINGS)) {
    const out = rec.frames.filter(item => item.direction === 'out'), inbound = rec.frames.filter(item => item.direction === 'in')
    eq([out.length, inbound.length, out.filter(item => item.frame.payload?.spoken !== undefined).length, out.filter(item => item.frame.payload?.companion_state !== undefined).length], stated[name], `c: ${name}: the frame counts of README.md (outbound, inbound, with spoken, with companion_state)`)
    const table = rec.voice_table
    for (const item of out) {
      const row = table.find(entry => entry.seq === item.seq)
      eq([row?.spoken ?? null, row?.companion_state ?? null], [item.frame.payload?.spoken ?? null, item.frame.payload?.companion_state ?? null], `c: ${name} seq ${item.seq}: voice_table is the frame's own payload.spoken / payload.companion_state`)
      const readme = README_TABLES[name]?.get(item.seq)
      if (readme) eq([readme.state, readme.spoken], [item.frame.payload?.companion_state ?? null, item.frame.payload?.spoken ?? null], `c: ${name} seq ${item.seq}: README.md's table row is the frame's own state and spoken line`)
    }
    for (const [seq, readme] of README_TABLES[name] ?? []) ok(out.some(item => item.seq === seq && item.turn === readme.turn), `c: ${name}: README.md's seq ${seq} is a frame of turn ${readme.turn}`)
    if (name === 'V0') eq(out.filter(item => item.frame.payload && ('spoken' in item.frame.payload || 'companion_state' in item.frame.payload)).length, 0, 'a: V0 (typed) carries no spoken line and no companion_state on any frame')
  }
  eq(README_TABLES.V1.size, 68, 'c: README.md\'s V1 table has a row per outbound frame'); eq(README_TABLES.V2.size, 6, 'c: ...and its V2 table the six frames of turns 4 and 5')
  const stateCount = {}
  for (const row of README_TABLES.V1.values()) stateCount[row.state ?? 'none'] = (stateCount[row.state ?? 'none'] ?? 0) + 1
  eq(stateCount, { none: 24, waiting: 3, thinking: 2, reporting: 3, working: 25, pleased: 11 }, 'c: V1 README.md table: the states it lists')
}

// ============================================================================================================================================
// The driver
// ============================================================================================================================================
/** The recorded frames of one turn, in order (direction "out" is Director -> Studio, "in" is the user's message). */
function turnsOf(rec) {
  const turns = new Map()
  for (const item of rec.frames) {
    if (!turns.has(item.turn)) turns.set(item.turn, { turn: item.turn, inbound: null, outbound: [] })
    if (item.direction === 'in') turns.get(item.turn).inbound = item
    else if (item.direction === 'out') turns.get(item.turn).outbound.push(item)
  }
  return [...turns.values()].sort((a, b) => a.turn - b.turn)
}
const turnOf = (rec, turn) => turnsOf(rec).find(item => item.turn === turn)
/** How long (virtual ms) before a frame arrives. `recorded`: the recording's own spacing (the whole build within a second, a burst). `live`: any gap of 5 ms or more is at least 2.5 s (a build takes seconds); frames recorded together stay together. */
const PACES = {
  recorded: item => Math.max(0, Math.round(item.dt_ms)),
  live: item => (item.dt_ms < 5 ? Math.round(item.dt_ms) : Math.max(Math.round(item.dt_ms), 2500)),
}
const TAIL_MS = 40000

/** One recorded frame arrives on the socket (the ids stay as recorded, the timestamps are the virtual clock's). */
async function deliver(w, item, { duplicate = false } = {}) {
  const stamp = new Date(w.clock.now()).toISOString()
  const frame = JSON.parse(JSON.stringify(item.frame).replace(/"<ts>"/g, JSON.stringify(stamp)))
  w.currentFrame = item
  if (duplicate) w.log.duplicates.push({ seq: item.seq, at: w.clock.now() - w.t0 })
  else w.log.delivered.push({ seq: item.seq, at: w.clock.now() - w.t0, type: frame.type, id: frame.message_id ?? null, item, stamp })
  if (frame.type === 'action_request' && Array.isArray(frame.payload?.actions) && frame.payload.actions.length) w.openCard = { id: frame.message_id, timestamp: frame.timestamp, actions: frame.payload.actions }
  w.env.sockets.at(-1).serverMessage(JSON.stringify(frame))
  await w.settle()
  w.currentFrame = null
  w.log.scenes[item.seq] = w.snap()?.scene ?? null
}
async function connect(w) {
  await w.mount()
  w.page().ws.ensureConnected()
  await w.settle()
  w.env.sockets[0].serverOpen()
  await w.settle()
}
const stage = w => w.page().voice.dock
async function startCall(w, mode = 'audio') {
  await w.page().voice.composerProps.onStart(mode)
  await w.settle()
  w.log.events.push({ at: w.clock.now() - w.t0, kind: 'call_start', delivered: w.log.delivered.length })
}
/** The user talks: the talk button is held (the stage's own handler), the recording goes to the speech port, which hears `words`. */
async function utter(w, words, holdMs = 1500) {
  w.queue.push(words)
  if (!stage(w)) throw new Error('replay: there is no call stage to talk into')
  stage(w).props.onTalkPress(); w.log.events.push({ at: w.clock.now() - w.t0, kind: 'press' }); await w.settle()
  await w.advance(holdMs)
  stage(w).props.onTalkRelease(); w.log.events.push({ at: w.clock.now() - w.t0, kind: 'release' }); await w.settle()
  await w.settle()
}
/** Advance in small steps until `predicate` holds (the clip of a line starts, a card is open ...). */
async function until(w, predicate, { maxMs = 60000, step = 100 } = {}) {
  for (let spent = 0; spent <= maxMs; spent += step) { if (predicate()) return true; await w.advance(step) }
  return false
}
const played = (w, text) => w.log.played.some(item => item.text === text)

/** One user turn and the Director's frames for it. `how`: voice (the talk button, the words the recording has, "yes" to a card), or typed (the page's own typed send, or its own click on the card's button). */
async function doTurn(w, { rec, turn, how, pace = 'live', tail = TAIL_MS, stopBefore = null, afterFrame = null }) {
  const t = turnOf(rec, turn)
  const data = t.inbound.frame.data
  const card = data.action_value ? w.openCard : null
  if (data.action_value) ok(!!card && card.actions.some(action => action.value === data.action_value), `the card for turn ${turn}'s ${data.action_value} is open`)
  w.log.turns.push({ turn, how, at: w.clock.now() - w.t0 })
  if (how === 'voice') await utter(w, card ? 'yes' : data.text)
  else if (card) await w.page().values.handleActionClick(card.actions.find(action => action.value === data.action_value), card.id, w.answerKey({ message_id: card.id, timestamp: card.timestamp }))
  else await w.page().values.handleSendMessage(undefined, data.text)
  await w.settle()
  for (const item of t.outbound) {
    if (stopBefore && (await stopBefore(w, item))) break
    await w.advance(PACES[pace](item))
    await deliver(w, item)
    if (afterFrame) await afterFrame(w, item)
  }
  return t
}
async function finishTurn(w, tail = TAIL_MS) { await w.advance(tail); w.log.scenes.atTurnEnd.push({ at: w.clock.now() - w.t0, scene: w.snap()?.scene ?? null, phase: w.snap()?.phase ?? null }) }

/** A whole dialogue. `plan`: [{ rec, turn, how }] for turns 1.. (the greeting, turn 0, is the first recording's). */
async function runScenario({ rec, plan, pace = 'live', call = true, over = {}, processEnv = {}, speech = {}, afterFrame = null }) {
  const w = await makeWorld({ over, processEnv, speech })
  w.log.duplicates = []; w.log.turns = []; w.log.scenes = { atTurnEnd: [] }; w.openCard = null
  await connect(w)
  for (const item of turnOf(rec, 0).outbound) { await w.advance(PACES[pace](item)); await deliver(w, item) }
  if (call) await startCall(w)
  for (const step of plan) { await doTurn(w, { pace, afterFrame, ...step }); await finishTurn(w) }
  return { w, rec, plan, pace }
}
const voicePlan = (rec, turns) => turns.map(turn => ({ rec, turn, how: 'voice' }))
async function endCall(w) { if (stage(w)) stage(w).props.onEnd(); await w.settle() }

// ============================================================================================================================================
// What was said, when, and why: the facts the checks read out of a run
// ============================================================================================================================================
function speechFacts(run) {
  const { w } = run, log = w.log, core = w.core
  const chunks = line => plain(core.splitSentences(core.cleanForSpeech(line)))
  const delivered = log.delivered.map(d => ({ seq: d.seq, at: d.at, type: d.type, cls: classOf(d.item.frame), frame: d.item.frame, chunks: classOf(d.item.frame) ? chunks(d.item.frame.payload.spoken) : [] }))
  const fillers = plain(core.FILLER_PHRASES.calm)
  const replies = delivered.filter(d => d.cls === 'reply')
  const progress = delivered.filter(d => d.cls === 'progress')
  // the frames that tell the controller "a reply (or a card) arrived", spoken or not
  const arrivals = delivered.filter(d => (d.type === 'chat_message' && d.frame.payload?.ephemeral !== true) || d.type === 'action_request')
  const requests = log.requested.map((r, index) => ({ ...r, index }))
  // pair every request with its clip (the same words, the first not yet taken, at or after the request): the interval the speaker is busy with it
  const clips = []
  for (const event of log.events) {
    if (event.kind === 'clip_start') clips.push({ text: event.text, start: event.at, end: null, stopped: false })
    else if (event.kind === 'clip_end' || event.kind === 'clip_stopped') { const open = clips.findLast(clip => clip.text === event.text && clip.end === null); if (open) { open.end = event.at; open.stopped = event.kind === 'clip_stopped' } }
  }
  const taken = new Set()
  for (const request of requests) {
    const clip = clips.find(item => !taken.has(item) && item.text === request.text && item.start >= request.at)
    if (clip) { taken.add(clip); request.clip = clip }
  }
  const presses = log.events.filter(e => e.kind === 'press').map(e => e.at), releases = log.events.filter(e => e.kind === 'release').map(e => e.at)
  return { delivered, fillers, replies, progress, arrivals, requests, clips, presses, releases, chunks }
}
const isFiller = (facts, text) => facts.fillers.includes(text)

/** The moment it last was quiet at `at`: the call began, the user pressed the talk button or was heard, a reply (or card) arrived, a line finished (the controller's own definition, from the contract's "4 s of quiet"). */
function quietSince(run, facts, at) {
  const log = run.w.log
  const marks = [...log.events.filter(e => e.kind === 'call_start' || e.kind === 'press' || e.kind === 'transcribed' || e.kind === 'clip_end').map(e => e.at), ...facts.arrivals.map(a => a.at)]
  return Math.max(...marks.filter(mark => mark <= at), -Infinity)
}
const busyAt = (facts, at, except = null) => facts.requests.some(request => request !== except && request.clip && request.at <= at && at < request.clip.end)
const holdingAt = (facts, at) => facts.presses.some((press, i) => press <= at && at < (facts.releases[i] ?? Infinity))

/** Garud's rules for a progress line at `at`, line `frame` having arrived at frame.at, the previous one said at `previous`: 4 s of quiet, 6 s apart, never over a line or the user, fresh (20 s). */
function progressRuleViolations(run, facts, { at, frame, previous, request = null }) {
  const out = []
  const quiet = at - quietSince(run, facts, at)
  if (quiet < 4000) out.push(`only ${quiet} ms of quiet`)
  if (previous !== null && at - previous < 6000) out.push(`${at - previous} ms after the previous progress line`)
  if (busyAt(facts, at, request)) out.push('over a line that was being said')
  if (holdingAt(facts, at)) out.push('over the user talking')
  if (at - frame.at > 20000) out.push(`${at - frame.at} ms old (stale)`)
  const newer = facts.progress.filter(item => item.at > frame.at && item.at <= at || (item.at === frame.at && item.seq > frame.seq))
  if (newer.length) out.push(`seq ${newer[0].seq} was newer`)
  const text = facts.arrivals.filter(item => item.at > frame.at && item.at <= at)
  if (text.length) out.push(`a reply or card (seq ${text[0].seq}) arrived after it`)
  return out
}

/** b: every line of every reply and card is said exactly once, in recording order; nothing is said that is not in payload.spoken (the filler, which the contract leaves to the client, is the one named exception); progress follows the rules. */
function checkSpeech(run, label) {
  const { w } = run, facts = speechFacts(run), log = w.log
  const replyTexts = facts.replies.flatMap(d => d.chunks), progressTexts = facts.progress.flatMap(d => d.chunks)
  eq(replyTexts.filter(text => progressTexts.includes(text) || facts.fillers.includes(text)), [], `b ${label}: the recording's reply lines, progress lines and the filler are told apart by their words`)
  eq(facts.progress.filter(d => d.chunks.length !== 1).map(d => d.seq), [], `b ${label}: every progress line of the recording is one sentence`)
  // exactly once, in order: the lines of the replies and cards are asked of the speech port as the frame arrives, one request per chunk
  eq(log.requested.filter(r => r.during !== null).map(r => [r.during, r.text]), facts.replies.flatMap(d => d.chunks.map(text => [d.seq, text])), `b ${label}: every reply and card line was asked for exactly once, as its frame arrived, in recording order`)
  eq(log.played.map(item => item.text).filter(text => replyTexts.includes(text)), replyTexts, `b ${label}: ...and every one was said exactly once, in recording order`)
  // nothing else is said
  const said = log.played.map(item => item.text), asked = log.requested.map(item => item.text)
  const allowed = [...replyTexts, ...progressTexts, ...facts.fillers]
  eq(said.filter(text => !allowed.includes(text)), [], `b ${label}: nothing that is not in payload.spoken is said (the filler aside)`)
  eq(asked.filter(text => !allowed.includes(text)), [], `b ${label}: ...nor asked of the speech port`)
  eq(log.requested.filter(r => r.during === null && !isFiller(facts, r.text) && !progressTexts.includes(r.text)).length, 0, `b ${label}: a line asked for between frames is a filler or a progress line of the recording`)
  // the filler (played, whether or not it was asked of the port: it is kept once synthesised): at most one per user turn, after 1.2 s of waiting, never once any text of the reply had arrived
  const turnsHeard = log.events.filter(e => e.kind === 'transcribed')
  const fillerClips = facts.clips.filter(clip => isFiller(facts, clip.text))
  eq(fillerClips.filter(clip => !turnsHeard.some((heard, i) => clip.start >= heard.at && clip.start < (turnsHeard[i + 1]?.at ?? Infinity))).length, 0, `b ${label}: a filler is only said in the wait for a user turn`)
  for (const [i, heard] of turnsHeard.entries()) {
    const mine = fillerClips.filter(clip => clip.start >= heard.at && clip.start < (turnsHeard[i + 1]?.at ?? Infinity))
    ok(mine.length <= 1, `b ${label}: at most one filler for the turn heard at ${heard.at}`)
    for (const clip of mine) {
      ok(clip.start - heard.at >= 1200, `b ${label}: the filler waits 1.2 s (${clip.start - heard.at} ms)`)
      const text = log.delivered.filter(d => (d.type === 'chat_message' || d.type === 'action_request') && d.at >= heard.at && d.at <= clip.start)
      eq(text.map(d => d.seq), [], `b ${label}: ...and not once any text of the reply had arrived`)
    }
  }
  // progress lines: soundness of every line said, then none fresh is missing
  const progressRequests = facts.requests.filter(r => r.during === null && !isFiller(facts, r.text))
  let previous = null
  const saidFrames = new Set()
  for (const request of progressRequests) {
    const frame = facts.progress.findLast(d => d.chunks[0] === request.text && (d.at < request.at || (d.at === request.at)))
    ok(!!frame, `b ${label}: "${request.text}" said at ${request.at} was sent by the Director as a progress line before`)
    if (!frame) continue
    saidFrames.add(frame)
    eq(progressRuleViolations(run, facts, { at: request.at, frame, previous, request }), [], `b ${label}: progress line "${request.text}" (seq ${frame.seq}) said at ${request.at} follows the rules`)
    previous = request.at
  }
  eq([...saidFrames].length, new Set([...saidFrames].map(frame => frame.seq)).size, `b ${label}: no progress line is said twice`)
  for (const frame of facts.progress) {
    if (saidFrames.has(frame)) continue
    const newer = facts.progress.some(item => item.seq > frame.seq && item.at >= frame.at), textAfter = facts.arrivals.some(item => item.at >= frame.at && item.at <= frame.at + 20000 && item.seq > frame.seq)
    if (newer || textAfter) continue // superseded by a newer line, or obsolete once the reply's text arrived
    // the newest line, no text after it: it must have been said unless it never had a moment (a 4 s quiet and 6 s since the last, inside its 20 s)
    let chance = null
    const previousSaid = at => progressRequests.filter(r => r.at <= at).at(-1)?.at ?? null
    for (let at = frame.at; at <= frame.at + 20000 && chance === null; at += 50) {
      if (progressRuleViolations(run, facts, { at, frame, previous: previousSaid(at) }).length === 0 && progressRuleViolations(run, facts, { at: at + 500, frame, previous: previousSaid(at) }).length === 0) chance = at
    }
    eq(chance, null, `b ${label}: the progress line "${frame.chunks[0]}" (seq ${frame.seq}), the newest and with no text after it, was never said though it had a moment at ${chance}`)
  }
  if (flag('--verbose') && !state.mutating) console.log(`  ${label}: ${facts.replies.length} reply/card frames (${replyTexts.length} lines) said once each; ${progressRequests.length} of ${facts.progress.length} progress lines said (${[...saidFrames].map(f => f.seq).join(',')}); ${fillerClips.length} fillers; ${log.played.length} clips in all`)
  return facts
}

/** The user messages that went out on the fake socket, against the recording's own inbound frames. */
function checkWire(run, how, label) {
  const { w, rec } = run
  const sent = w.userMessages().map(message => message.data)
  const inbound = run.plan.map(step => turnOf(step.rec, step.turn).inbound.frame.data)
  eq(sent.length, inbound.length, `d ${label}: one user_message per turn`)
  for (const [i, data] of sent.entries()) {
    const want = inbound[i], voice = how[i] === 'voice'
    eq([data.text, data.action_value ?? null, data.action_label ?? null], [want.text, want.action_value ?? null, want.action_label ?? null], `d ${label}: turn ${i + 1} sends the recorded words${want.action_value ? ' with the card\'s action_value and label' : ''}`)
    if (voice) {
      eq(data.mode, 'voice', `a ${label}: turn ${i + 1} (voice) carries mode "voice"`)
      eq(data.client_caps, ['mdc1', 'voice1'], `d ${label}: turn ${i + 1} has voice1 in its own client_caps, after the caps the client sends on every message, once`)
    } else {
      eq(data.mode, undefined, `a ${label}: turn ${i + 1} (typed) has no mode`)
      ok(!(data.client_caps ?? []).includes('voice1'), `a ${label}: turn ${i + 1} (typed) does not advertise voice1`)
    }
    for (const [key, value] of Object.entries(rec.send_flags_on_every_user_message)) eq(data[key] ?? null, value, `d ${label}: turn ${i + 1} carries ${key} as the recorded user_message does`)
  }
}

/** c: the state each frame means, as the controller derived it from the frame the socket hook handed it, against README.md's table. */
function checkStates(run, label, name) {
  const { w } = run
  const bySeq = new Map()
  for (const entry of w.log.signals) bySeq.set(entry.seq, [...(bySeq.get(entry.seq) ?? []), entry])
  eq([...bySeq.keys()].filter(seq => seq === null).length, 0, `c ${label}: every state was derived while a recorded frame was being delivered`)
  const callStart = w.log.events.find(e => e.kind === 'call_start')?.delivered ?? Infinity
  for (const [index, d] of w.log.delivered.entries()) {
    const frame = d.item.frame, got = bySeq.get(d.seq) ?? []
    if (index < callStart) { eq(got.length, 0, `c ${label}: seq ${d.seq} ${frame.type} came before the call: nothing is derived from it`); continue }
    if (!VOICE_FRAME_TYPES.includes(frame.type)) { eq(got.length, 0, `c ${label}: seq ${d.seq} ${frame.type} is not shown to the call`); continue }
    eq(got.length, 1, `c ${label}: seq ${d.seq} ${frame.type}: one state derived from the frame`)
    eq(labelOf(got[0].signal), expectedState(frame), `c ${label}: seq ${d.seq} ${frame.type} (README.md: ${frame.payload?.companion_state ?? 'no companion_state, the frame mapping'})`)
    const readme = README_TABLES[name]?.get(d.seq)
    if (readme) eq(labelOf(got[0].signal), readme.state ?? frameMapping(frame), `c ${label}: seq ${d.seq} against README.md's table row`)
    const decline = got[0].signal?.kind === 'reporting' ? got[0].signal.decline : null
    if (decline !== null) eq(decline, name === 'V2' && d.seq === 74, `c ${label}: seq ${d.seq}: only the Director's honest "I can't translate the deck yet" is a decline (sorry)`)
    if (got[0].signal?.kind === 'pleased') eq(got[0].signal.big, frame.type === 'build_phase', `c ${label}: seq ${d.seq}: only a finished build is the big pleased`)
  }
  eq(w.log.signals.length, w.log.delivered.filter((d, index) => index >= callStart && VOICE_FRAME_TYPES.includes(d.item.frame.type)).length, `c ${label}: no frame was read twice`)
}

// ============================================================================================================================================
// The suites
// ============================================================================================================================================
const V0 = RECORDINGS.V0, V1 = RECORDINGS.V1, V2 = RECORDINGS.V2
const HOW_VOICE_3 = ['voice', 'voice', 'voice'], HOW_VOICE_5 = ['voice', 'voice', 'voice', 'voice', 'voice']

/** a: V0 (typed), no call: nothing voice anywhere; and the wire is the flag-off wire. */
async function suiteA(over) {
  const typed = [1, 2, 3].map(turn => ({ rec: V0, turn, how: 'typed' }))
  const run = await runScenario({ rec: V0, plan: typed, call: false, over })
  const { w } = run
  checkWire(run, ['typed', 'typed', 'typed'], 'V0')
  eq([w.log.micOpened, w.log.requested.length, w.log.played.length, w.log.signals.length, w.log.transcribed.length], [0, 0, 0, 0, 0], 'a V0: the microphone is never opened, nothing is asked of the speech port or said, no state is derived, nothing is heard')
  eq([w.snap()?.active ?? false, w.snap()?.scene ?? 'idle', w.snap()?.phase ?? 'idle', w.snap()?.transcript?.length ?? 0, stage(w) ?? null, w.page().voice.composerProps?.active], [false, 'idle', 'idle', 0, null, false], 'a V0: the companion is idle (and no stage is drawn), no call is on, the transcript is empty')
  eq(w.log.delivered.length, V0.frames.filter(item => item.direction === 'out').length, 'a V0: every recorded frame was delivered to the page')
  eq(w.userMessages().map(message => message.data.mode ?? null), [null, null, null], 'a V0: no voice turn on the wire')
  eq(w.refs.answeredActionsRef.current.size, 1, 'a V0: the plan card was answered by a click (typed), once')
  // flag off: the same typed dialogue puts the same bytes on the socket
  const off = await runScenario({ rec: V0, plan: typed, call: false, over, processEnv: { NEXT_PUBLIC_STUDIO_VOICE_CALL: 'false' } })
  eq([off.w.ctl, off.w.page().voice.composerProps], [null, null], 'a V0: flag off: no controller, no call buttons')
  eq(w.env.outbound.map(item => item.data), off.w.env.outbound.map(item => item.data), 'a V0: flag on and flag off put exactly the same bytes on the socket for the typed dialogue')
}

/** e: a typed message in the middle of a call keeps the call open, and its reply is not spoken. */
async function suiteE(over) {
  // e1: the whole V0 dialogue typed with a call open
  const typed = [1, 2, 3].map(turn => ({ rec: V0, turn, how: 'typed' }))
  const run = await runScenario({ rec: V0, plan: typed, call: true, over })
  const { w } = run
  eq(w.log.scenes.atTurnEnd.map(item => item.phase), ['idle', 'idle', 'idle'], 'e V0 with a call: every typed turn ends with the call idle (your turn)')
  eq([w.snap().active, w.log.micOpened, w.log.micClosed], [true, 1, 0], 'e V0 with a call: the call is still open after the typed turns, the microphone held (opened once, never closed)')
  eq([w.log.requested.length, w.log.played.length, w.log.transcribed.length], [0, 0, 0], 'e V0 with a call: the replies to typed messages are not spoken (nothing asked of the speech port, nothing said)')
  checkWire(run, ['typed', 'typed', 'typed'], 'V0 with a call')
  checkStates(run, 'V0 with a call', 'V0')
  ok(w.log.signals.some(entry => entry.signal?.kind === 'working') && w.log.signals.some(entry => entry.signal?.kind === 'pleased'), 'e V0 with a call: the character still follows the typed build (working, pleased)')
  await endCall(w)
  eq([w.snap().active, w.log.micClosed], [false, 1], 'e V0 with a call: End releases the microphone')
  // e2: voice, then a typed message in the middle, then voice again (the typed turn's frames are V0's: the Director's reply to a typed turn carries no spoken line)
  const mixed = [{ rec: V1, turn: 1, how: 'voice' }, { rec: V0, turn: 2, how: 'typed' }, { rec: V1, turn: 3, how: 'voice' }]
  const run2 = await runScenario({ rec: V1, plan: mixed, call: true, over })
  const m = run2.w, log = m.log
  eq(m.userMessages().map(message => message.data.mode ?? null), ['voice', null, 'voice'], 'e voice, typed, voice: the typed message in the middle has no mode, the voice turns on both sides do')
  const typedStart = log.turns[1].at, typedEnd = log.turns[2].at
  const typedFrames = log.delivered.filter(d => d.at >= typedStart && d.at < typedEnd)
  ok(typedFrames.length >= 3, 'e voice, typed, voice: the typed turn\'s reply frames were delivered')
  eq(log.requested.filter(r => r.at >= typedStart && r.at < typedEnd).map(r => r.text), [], 'e voice, typed, voice: nothing is asked of the speech port between the typed message and the next voice turn (its reply, and the reply\'s card, are not spoken)')
  eq(log.played.filter(item => item.at >= typedStart && item.at < typedEnd).map(item => item.text), [], 'e voice, typed, voice: ...and nothing is said')
  eq(log.scenes.atTurnEnd.map(item => item.phase), ['idle', 'idle', 'idle'], 'e voice, typed, voice: the call is idle after each turn')
  eq([m.snap().active, log.micOpened, log.micClosed], [true, 1, 0], 'e voice, typed, voice: the call stayed open through the typed message')
  const card = m.refs.answeredActionsRef.current
  eq([...card], ['<id#9>'], 'e voice, typed, voice: the spoken yes pressed the plan card of the typed turn (it carries no spoken line, but it is a card)')
  eq(m.userMessages()[2].data.action_value, 'accept_plan', 'e voice, typed, voice: ...with its action_value')
  checkStates(run2, 'voice, typed, voice', 'V1') // V0's turn-2 frames carry no hints: the frame mapping is the oracle for them
}

/** b, c, d over V1 and V2 (voice), at both paces; d with the card identity flag off and on. */
async function suiteBCD(over) {
  const runs = []
  for (const [name, rec, turns, how] of [['V1', V1, [1, 2, 3], HOW_VOICE_3], ['V2', V2, [1, 2, 3, 4, 5], HOW_VOICE_5]]) {
    for (const pace of ['live', 'recorded']) {
      const label = `${name} ${pace}`
      const run = await runScenario({ rec, plan: voicePlan(rec, turns), pace, over, afterFrame: pace === 'recorded' ? async (w, item) => { if (item.seq === 12 || item.seq === 70) { for (const again of [item]) await deliver(w, again, { duplicate: true }) } } : null })
      const facts = checkSpeech(run, label)
      ok(pace !== 'live' || facts.requests.some(r => r.during === null && !isFiller(facts, r.text)), `b ${label}: at least one progress line was said (the rules are not vacuous)`)
      checkWire(run, how, label)
      checkStates(run, label, name)
      eq(run.w.log.scenes.atTurnEnd.map(item => item.phase), how.map(() => 'idle'), `b ${label}: every turn ends with the call idle (everything said, nothing left)`)
      runs.push({ name, pace, run })
    }
  }
  // d: the plan card, answered aloud
  for (const identity of [false, true]) {
    const run = await runScenario({ rec: V1, plan: voicePlan(V1, [1, 2, 3]), over, processEnv: identity ? { NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED: 'true' } : {} })
    const { w } = run
    const planFrame = V1.frames.find(item => item.seq === 12).frame
    const card = w.log.delivered.find(d => d.seq === 12)
    const label = `identity ${identity ? 'on' : 'off'}`
    eq(w.log.transcribed.map(item => item.words), ['Help me pitch a new onboarding flow to our leadership team', 'Leadership team of 8, 10 slides, focus on time-to-productivity and cost', 'yes'], `d ${label}: the user said "yes", not the button's words`)
    const sent = w.userMessages()[2].data
    eq([sent.text, sent.action_value, sent.action_label, sent.mode], [planFrame.payload.actions[0].label, planFrame.payload.actions[0].value, planFrame.payload.actions[0].label, 'voice'], `d ${label}: a spoken "yes" to the plan card sends that card's label and action_value with mode "voice"`)
    ok(sent.client_caps.includes('voice1'), `d ${label}: ...and voice1 in that message's own client_caps`)
    const key = identity ? `${planFrame.message_id}\u0000${card.stamp}` : planFrame.message_id
    eq([...w.refs.answeredActionsRef.current], [key], `d ${label}: the card is marked answered by askAnswerKey (${identity ? 'its id and its timestamp' : 'its bare id'}), and nothing else is`)
    eq(w.answerKey({ message_id: planFrame.message_id, timestamp: card.stamp }), key, `d ${label}: ...which is the key the click path uses for the card`)
    eq(w.userMessages().filter(message => message.data.text === planFrame.payload.actions[0].label).length, 1, `d ${label}: the button was pressed once`)
  }
  return runs
}

/** c, scene level: the companion the stage draws for the frames the call does not hide behind its own phase (speech off, so nothing is speaking). */
async function suiteScenes(over) {
  const run = await runScenario({ rec: V2, plan: voicePlan(V2, [1, 2, 3, 4, 5]), over, speech: { fail: 'not_connected' } })
  const { w } = run
  const scene = seq => w.log.scenes[seq]
  eq(scene(39), 'pleased', 'c scene: the first slide built: pleased')
  eq(scene(42), 'working', 'c scene: ...the next one, 2.5 s later, is not another pleased (at most one every 20 s): back at work')
  eq(scene(71), 'celebrating', 'c scene: the deck is ready: the big pleased (celebrating)')
  eq(scene(74), 'sorry', 'c scene: the honest "I can\'t translate the deck yet": sorry')
  eq(scene(79), 'concerned', 'c scene: the slide that did not build: concerned')
  eq(scene(80), 'concerned', 'c scene: ...and the report that explains it does not cover it')
  eq(w.log.scenes.atTurnEnd.map(item => item.scene), ['waiting', 'waiting', 'idle', 'idle', 'idle'], 'c scene: with a card open (the questions, the plan) the character waits for you; once the deck is done it rests (the celebration clears the held state, as designed), and after a report it rests')
  checkStates(run, 'V2 no speech', 'V2')
}

/** f: Stop and barge-in cancel the speech and drop that turn's remaining lines. */
async function suiteF(over) {
  const REPLY_28 = ["I've created an outline with 10 slides for Pitch for a new customer onboarding flow.", 'Building the full deck now — watch it take shape on the canvas.']
  const LATER = ['Your presentation is ready!', 'Pitch for a new customer onboarding flow - 10 slides.', 'What would you like to do next?']
  const stopAt = (w) => { stage(w).props.onStop(); w.log.events.push({ at: w.clock.now() - w.t0, kind: 'stop' }) }
  // f1: Stop in the middle of the reply that is being said
  {
    const w = await (async () => {
      const run = await runScenario({ rec: V1, plan: voicePlan(V1, [1, 2]), over })
      return run.w
    })()
    w.log.duplicates = w.log.duplicates ?? []
    await doTurn(w, { rec: V1, turn: 3, how: 'voice', stopBefore: async (w2, item) => {
      if (item.seq !== 29) return false
      ok(await until(w2, () => played(w2, REPLY_28[0])), 'f1: the first line of the reply starts')
      stopAt(w2); await w2.settle()
      return false
    } })
    await finishTurn(w)
    const stop = w.log.events.find(e => e.kind === 'stop').at
    eq(w.log.events.filter(e => e.kind === 'clip_stopped').map(e => e.text), [REPLY_28[0]], 'f1: Stop stopped the line that was being said')
    ok(w.log.stops >= 1, 'f1: the speaker was told to stop')
    ok(!played(w, REPLY_28[1]), 'f1: the rest of the reply is dropped (its second line is never said)')
    eq(w.log.played.filter(item => item.at > stop && REPLY_28.includes(item.text)).length, 0, 'f1: ...nothing of that reply is said after Stop')
    eq(w.log.played.filter(item => LATER.includes(item.text)).map(item => item.text), LATER, 'f1: a later report (the build is done) is still said, once: Stop is not a mute')
    eq(w.snap().phase, 'idle', 'f1: the call is idle (your turn) afterwards')
  }
  // f2: Stop while the reply has not arrived yet, though the build's progress bubbles have: the reply that comes afterwards is not said
  {
    const run = await runScenario({ rec: V1, plan: voicePlan(V1, [1, 2]), over })
    const w = run.w
    await doTurn(w, { rec: V1, turn: 3, how: 'voice', afterFrame: async (w2, item) => { if (item.seq === 22) { stopAt(w2); await w2.settle() } } })
    await finishTurn(w)
    eq(w.log.requested.filter(r => REPLY_28.includes(r.text)).length, 0, 'f2: the reply to the stopped turn is not even asked of the speech port')
    ok(!REPLY_28.some(text => played(w, text)), 'f2: ...and is not said (it is in the chat)')
    eq(w.log.played.filter(item => LATER.includes(item.text)).map(item => item.text), LATER, 'f2: the report after it (the build is done) is said, once')
    eq(w.snap().phase, 'idle', 'f2: the call is idle (your turn) afterwards')
  }
  // f4: barge-in before the reply: the reply that arrives while the user is still talking is not said (and was the debt: the report after it, nobody asked for, is)
  {
    const run = await runScenario({ rec: V1, plan: voicePlan(V1, [1, 2]), over })
    const w = run.w
    await doTurn(w, { rec: V1, turn: 3, how: 'voice',
      stopBefore: async (w2, item) => { if (item.seq === 14) { stage(w2).props.onTalkPress(); w2.log.events.push({ at: w2.clock.now() - w2.t0, kind: 'press' }); await w2.settle() } return false },
      afterFrame: async (w2, item) => { if (item.seq === 28) { stage(w2).props.onTalkRelease(); w2.log.events.push({ at: w2.clock.now() - w2.t0, kind: 'release' }); await w2.settle() } } })
    await finishTurn(w)
    eq(w.log.transcribed.at(-1).words, '', 'f4: the user talked over the turn and said nothing')
    eq(w.log.requested.filter(r => REPLY_28.includes(r.text)).length, 0, 'f4: the reply that came while they were talking is not asked of the speech port')
    ok(!REPLY_28.some(text => played(w, text)), 'f4: ...and is not said (it is in the chat)')
    eq(w.log.played.filter(item => LATER.includes(item.text)).map(item => item.text), LATER, 'f4: the report after it (the build is done) is said, once: the debt was the reply\'s, and it was paid')
    eq(w.snap().phase, 'idle', 'f4: the call is idle (your turn) afterwards')
  }
  // f3: barge-in: the user talks over a reply that is being said
  {
    const w = await makeWorld({ over })
    w.log.duplicates = []; w.log.turns = []; w.log.scenes = { atTurnEnd: [] }; w.openCard = null
    await connect(w)
    for (const item of turnOf(V1, 0).outbound) { await w.advance(PACES.live(item)); await deliver(w, item) }
    await startCall(w)
    const card = ['Happy to help you pitch this.', 'A few quick questions so I can tailor it: Who is in the room, and how many people?', 'How long should the deck be?', 'What should leadership take away or decide?']
    await doTurn(w, { rec: V1, turn: 1, how: 'voice', pace: 'live' })
    ok(await until(w, () => played(w, card[0])), 'f3: the first line of the reply starts')
    eq(w.log.played.map(item => item.text).filter(text => card.includes(text)), [card[0]], 'f3: only the first line has started')
    await doTurn(w, { rec: V1, turn: 2, how: 'voice' }) // the user talks over it with the next answer
    await finishTurn(w)
    eq(w.log.events.filter(e => e.kind === 'clip_stopped').map(e => e.text).slice(0, 1), [card[0]], 'f3: talking over it stopped the line that was being said')
    eq(w.log.played.map(item => item.text).filter(text => card.includes(text)), [card[0]], 'f3: the rest of that reply is dropped (the other three lines are never said)')
    eq(w.userMessages().map(message => [message.data.text, message.data.mode]), [[V1.frames.find(f => f.seq === 7).frame.data.text, 'voice'], [V1.frames.find(f => f.seq === 9).frame.data.text, 'voice']], 'f3: ...and the user\'s new words went out as the next voice turn')
    const plan = ["Here's my proposed plan for your presentation: A redesigned onboarding flow gets new customers productive faster and cuts the cost to serve them.", 'Does this structure work for you?']
    eq(w.log.played.map(item => item.text).filter(text => plan.includes(text)), plan, 'f3: the reply to the new turn is said, in full, once')
  }
}

const SUITES = [['a', suiteA], ['e', suiteE], ['bcd', suiteBCD], ['c-scene', suiteScenes], ['f', suiteF]]
async function all(over = {}, { only = null, fixtures = true } = {}) {
  if (fixtures) recordingSuite()
  for (const [name, suite] of SUITES) if (!only || only.includes(name)) await suite(over)
}

// ============================================================================================================================================
// h. The conventions of scripts/test-studio-voice-call.mjs: this change's own commits ("Voice call:"), the strip registered, the marked lines of the existing files
// ============================================================================================================================================
const git = (...gitArgs) => execFileSync('git', ['-C', root, ...gitArgs], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
async function suiteConventions() {
  const registry = await import('./studio-later-changes.mjs')
  const MARK = strip.VOICE_CALL_MARKER_RE
  const mine = ['scripts/test-studio-voice-call-replay.mjs', ...['README.md', 'CONTRACT.md', 'scenario-V0.json', 'scenario-V1.json', 'scenario-V2.json'].map(name => `${FIXTURES}/${name}`)]
  for (const rel of mine) ok(fs.existsSync(path.join(root, rel)) && strip.VOICE_CALL_NEW_FILES.includes(rel) && strip.VOICE_CALL_SCOPE_FILES.has(rel) && registry.LATER_CHANGE_FILES.has(rel), `h: ${rel} exists and is one of this change's new files (named in the strip, in the scope, in the registry)`)
  ok(registry.LATER_STRIPS.includes(strip.stripVoiceCall) && registry.LATER_ENV_BLOCKS.includes(strip.VOICE_CALL_ENV_BLOCK), 'h: the strip and the .env.example block are registered')
  ok(new Set(strip.VOICE_CALL_NEW_FILES).size === strip.VOICE_CALL_NEW_FILES.length, 'h: no file is named twice in the new files')
  let baseOk = false
  try { git('cat-file', '-e', `${strip.BASE_COMMIT}^{commit}`); baseOk = true } catch { /* a shallow clone */ }
  if (!baseOk) { console.log(`NOTE h  git has no ${strip.BASE_COMMIT.slice(0, 8)}: the commit and marked-line checks were skipped`); return }
  const OWN = git('log', '--no-merges', '--format=%H', `--grep=^${strip.VOICE_CALL_SUBJECT}`, '-E', `${strip.BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)
  ok(OWN.length > 0 || process.env.VOICE_CALL_PROOF_NO_COMMITS === '1', 'h: this change has its own "Voice call:" commits (set VOICE_CALL_PROOF_NO_COMMITS=1 before the first commit)')
  if (OWN.length > 0) {
    const changed = new Set(OWN.flatMap(sha => git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean)))
    eq([...changed].filter(rel => !strip.VOICE_CALL_SCOPE_FILES.has(rel)).sort(), [], 'h: every file of this change\'s own commits is this change\'s')
    const subjects = git('log', '--no-merges', '--format=%s', `${strip.BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)
    ok(subjects.filter(subject => subject.startsWith(strip.VOICE_CALL_SUBJECT)).length === OWN.length, 'h: the commits are named "Voice call: ..." (the proofs read those)')
  }
  const othersOut = (rel, text) => registry.LATER_STRIPS.filter(fn => fn !== strip.stripVoiceCall).reduce((out, fn) => fn(rel, out), text)
  for (const rel of strip.VOICE_CALL_FILES) {
    const base = git('show', `${strip.BASE_COMMIT}:${rel}`)
    ok(othersOut(rel, strip.stripVoiceCall(rel, read(rel))) === othersOut(rel, base), `h: ${rel} without this change's marked lines is the base's file, byte for byte`)
    const was = othersOut(rel, base).split('\n'), now = othersOut(rel, read(rel)).split('\n')
    const added = []
    let at = 0
    for (const line of now) { if (at < was.length && line === was[at]) at++; else added.push(line) }
    ok(at === was.length && added.length > 0 && added.every(line => MARK.test(line)), `h: ${rel}: every line this change adds carries the marker, and no existing line is rewritten or removed`)
  }
}

// ============================================================================================================================================
// g. Mutants: every one must be caught, by the check of the letter it is for
// ============================================================================================================================================
const SOURCES = Object.fromEntries([UI, CTL, HOOK, WS, PAGE].map(rel => [rel, read(rel)]))
const WS_FIELDS = 'if (typeof STUDIO_VOICE_CALL_UI_ENABLED !== \'undefined\' && STUDIO_VOICE_CALL_UI_ENABLED) addVoiceCallFields(message.data as unknown as Record<string, unknown>, text); // VOICE-CALL'
// [file, name, from, to, suite to run it in, the letter of the check that must catch it]
const MUTANTS = [
  // a: typed turns
  [UI, 'a typed message is a voice turn', 'if (!takeVoiceTurn(text)) return data', 'if (false) return data', 'a', 'a'],
  [WS, 'every message is written as a voice turn', 'addVoiceCallFields(message.data as unknown as Record<string, unknown>, text); // VOICE-CALL', "(message.data as unknown as Record<string, unknown>).mode = 'voice'; // VOICE-CALL", 'a', 'a'],
  [CTL, 'the microphone is asked for at construction', "this.snapshot = this.build()\n  }", "this.snapshot = this.build(); void this.env.openMic()\n  }", 'a', 'a'],
  [CTL, 'frames before the call are handled', "if (!this.active || this.disposed) return\n    const id =", "if (this.disposed) return\n    const id =", 'a', 'a'],
  [HOOK, 'the flag does not gate the load', 'const enabled = options.enabled && STUDIO_VOICE_CALL_UI_ENABLED', 'const enabled = options.enabled', 'a', 'a'],
  // b: what is said, once, in order, by the rules
  [CTL, 'a reply is spoken as one block', 'for (const sentence of sentences) this.enqueue(sentence, \'reply\', turn, true)', "this.enqueue(sentences.join(' '), 'reply', turn, true)", 'bcd', 'b'],
  [CTL, 'a frame is handled twice', 'if (this.seen.has(id)) return', 'if (false) return', 'bcd', 'b'],
  [CTL, 'a status outlives the reply it came before', 'this.progressLine = null // a status is only worth saying while the wait goes on', 'void 0 // a status is only worth saying while the wait goes on', 'bcd', 'b'],
  [CTL, 'progress is said before 4 s of quiet', 'now - this.quietSince >= PROGRESS_AFTER_MS', 'true', 'bcd', 'b'],
  [CTL, 'progress is said over speech', 'const busy = this.speakingNow || !!this.playing || this.queue.length > 0', 'const busy = false', 'bcd', 'b'],
  [CTL, 'a stale progress line is said', 'if (now - progress.at > PROGRESS_STALE_MS || this.speechOff) this.progressLine = null', 'if (this.speechOff) this.progressLine = null', 'bcd', 'b'],
  [CTL, 'the oldest progress line is kept', 'this.progressLine = { text: line, at: this.env.now() }', 'this.progressLine = this.progressLine ?? { text: line, at: this.env.now() }', 'bcd', 'b'],
  [CTL, 'the filler is said twice', 'alreadyUsed: awaiting.fillerUsed,', 'alreadyUsed: false,', 'bcd', 'b'],
  // c: the state of each frame
  [UI, 'the hint is ignored', 'const hinted = signalFromHint(payload.companion_state)', 'const hinted = null', 'bcd', 'c'],
  [UI, 'a progress bubble is a report', 'if (payload.ephemeral === true) return null', 'void 0', 'e', 'c'],
  [UI, 'a decline is not sorry (the hint)', "if (hinted.kind === 'reporting' && type === 'chat_message') return { kind: 'reporting', decline: isDeclineText(cleanText(payload.text)) }", "if (hinted.kind === 'reporting' && type === 'chat_message') return { kind: 'reporting', decline: false }", 'bcd', 'c'],
  [UI, 'a finished build is the small pleased', "if (hinted.kind === 'pleased' && type === 'build_phase' && payload.phase === 'complete') return { kind: 'pleased', big: true }", "if (hinted.kind === 'pleased' && type === 'build_phase' && payload.phase === 'complete') return { kind: 'pleased', big: false }", 'bcd', 'c'],
  [UI, 'a card is not waiting', "case 'action_request': return { kind: 'waiting' }", "case 'action_request': return null", 'e', 'c'],
  [UI, 'a small pleased every time', 'now - expired.lastPleasedAt < PLEASED_EVERY_MS', 'false', 'c-scene', 'c'],
  [UI, 'a report covers a failure', 'const outranks = (held: DirectorTrack[\'beat\'], next: BeatScene): boolean => !!held && BEAT_RANK[held.scene] > BEAT_RANK[next]', 'const outranks = (held: DirectorTrack[\'beat\'], next: BeatScene): boolean => false', 'c-scene', 'c'],
  [WS, 'the frame tap shows nothing', 'voiceCallBus.frame?.(parsedMessage); // VOICE-CALL', 'void 0; // VOICE-CALL', 'bcd', 'b'],
  [WS, 'the frame tap is for another session', 'parsedMessage.session_id === socketSessionId && isCurrentSocket()) voiceCallBus', 'parsedMessage.session_id !== socketSessionId && isCurrentSocket()) voiceCallBus', 'bcd', 'b'],
  // d: a spoken yes to a card
  [CTL, 'a card is never pressed', 'const action = open ? matchSpokenAnswer(text, open.actions) : null', 'const action = null', 'bcd', 'd'],
  [CTL, 'a card is pressed by the typed path', 'await (action && open ? this.sendAction(action, open.messageId, askAnswerKey({ message_id: open.messageId, timestamp: open.timestamp })) : this.sendTurn(text))', 'await this.sendTurn(text)', 'bcd', 'd'],
  [PAGE, 'a card is pressed by typing its label', 'sendAction: handleActionClick,', 'sendAction: (action) => handleSendMessage(undefined, action.label),', 'bcd', 'd'],
  [CTL, 'the card is marked answered by its bare id', 'askAnswerKey({ message_id: open.messageId, timestamp: open.timestamp })', 'open.messageId', 'bcd', 'd'],
  [CTL, 'the answer key is not handed on', 'this.sendAction(action, open.messageId, askAnswerKey({ message_id: open.messageId, timestamp: open.timestamp }))', "this.sendAction(action, open.messageId, '')", 'bcd', 'd'],
  [CTL, 'the card\'s timestamp is not kept', 'timestamp: (frame as { timestamp?: unknown }).timestamp, actions: buttons }', 'timestamp: undefined, actions: buttons }', 'bcd', 'd'],
  [UI, 'yes presses the other button', 'if (YES_WORDS.includes(said)) return primary[0]!.requires_input ? null : primary[0]!', 'if (YES_WORDS.includes(said)) return others[0]!', 'bcd', 'd'],
  [UI, 'the mode is not "voice"', "export const VOICE_TURN_MODE = 'voice'", "export const VOICE_TURN_MODE = 'speech'", 'bcd', 'a'],
  [UI, 'the voice cap replaces the others', "data.client_caps = existing.includes(VOICE_CAP) ? existing : [...existing, VOICE_CAP]", "data.client_caps = [VOICE_CAP]", 'bcd', 'd'],
  [UI, 'the cap is not voice1', "export const VOICE_CAP = 'voice1'", "export const VOICE_CAP = 'voice'", 'bcd', 'd'],
  // e: a typed message in the middle of a call
  [CTL, 'a typed reply is read from its text', "const spoken = spokenLineFromFrame(frame)\n    const sentences", "const spoken = spokenLineFromFrame(frame) ?? ((frame as { payload?: { text?: string } }).payload?.text ?? null)\n    const sentences", 'e', 'e'],
  [CTL, 'a reply with no line hangs up', "const sentences = spoken ? splitSentences(cleanForSpeech(spoken)) : []\n", "const sentences = spoken ? splitSentences(cleanForSpeech(spoken)) : []\n    if (!spoken) this.endCall()\n", 'e', 'e'],
  [CTL, 'a reply with no line drops the call\'s microphone', "const sentences = spoken ? splitSentences(cleanForSpeech(spoken)) : []\n", "const sentences = spoken ? splitSentences(cleanForSpeech(spoken)) : []\n    if (!spoken) { this.mic?.close(); this.mic = null }\n", 'e', 'e'],
  [UI, 'a typed message is a voice turn (mid-call)', 'if (!takeVoiceTurn(text)) return data', 'if (false) return data', 'e', 'a'],
  // f: Stop and barge-in
  [CTL, 'talking over does not stop the speech', "case 'cancel_speech':\n        this.stopSpeech()\n        break", "case 'cancel_speech':\n        break", 'f', 'f'],
  [CTL, 'Stop leaves the queue', 'this.speechCtl = null\n    this.queue = []\n    this.playing = null', 'this.speechCtl = null\n    this.playing = null', 'f', 'f'],
  [CTL, 'Stop does not stop the speaker', 'this.speakingNow = false\n    this.player.stop()\n  }', 'this.speakingNow = false\n  }', 'f', 'f'],
  [CTL, 'the reply to a stopped turn is said', "if (!awaiting && this.owedReplies > 0) { this.owedReplies--; return }", '', 'f', 'f'],
  [CTL, 'a progress bubble counts as the reply', 'if (this.awaiting && this.awaiting.sendObserved) this.owedReplies++', 'if (this.awaiting && this.awaiting.sendObserved && !this.awaiting.replyTextArrived) this.owedReplies++', 'f', 'f'],
  [CTL, 'the debt is not paid while the user talks', "if (!awaiting && this.owedReplies > 0) { this.owedReplies--; return } // the reply to a turn the user cancelled: it is in the chat, it is not said (also when the user is already talking: the debt is paid either way)\n    if (this.cs.phase === 'listening') return // the user is talking: the reply is in the chat, and nothing talks over them\n", "if (this.cs.phase === 'listening') return // the user is talking\n    if (!awaiting && this.owedReplies > 0) { this.owedReplies--; return }\n", 'f', 'f'],
  [CTL, 'Stop does not cancel the pending turn', "case 'cancel_turn':\n        if (this.awaiting", "case 'cancel_turn':\n        break\n        if (this.awaiting", 'f', 'f'],
]

async function runMutants() {
  const survivors = [], stale = [], wrongCatcher = [], crashes = []
  state.mutating = true
  const perLetter = {}
  for (const [rel, name, from, to, suite, letter] of MUTANTS) {
    const text = SOURCES[rel]
    const at = text.indexOf(from)
    if (at < 0) { stale.push(`${name} (${rel})`); continue }
    const broken = text.slice(0, at) + to + text.slice(at + from.length)
    if (broken === text) { stale.push(`${name} (${rel}: changes nothing)`); continue }
    if (/\.(ts|tsx)$/.test(rel)) { try { compile(broken, rel) } catch { survivors.push(`${name} (does not transpile: a mutant that is not valid code proves nothing)`); continue } }
    const saved = checks
    let message = null
    try { await all({ [rel]: broken }, { only: [suite], fixtures: false }); survivors.push(name) } catch (error) {
      message = String(error?.message ?? error).split('\n')[0]
      if (error?.name !== 'AssertionError') crashes.push(`${name}: ${message.slice(0, 90)}`)
      else if (!new RegExp(`^${letter}[\\d ]`).test(message)) wrongCatcher.push(`${name} (for ${letter}, caught by: ${message.slice(0, 70)})`)
      else perLetter[letter] = (perLetter[letter] ?? 0) + 1
    }
    checks = saved
    if (flag('--verbose')) console.log(`  mutant "${name}": ${message ? `caught: ${message.slice(0, 100)}` : 'SURVIVED'}`)
  }
  console.log(`stale mutants: ${stale.join('; ') || 'none'}; survivors: ${survivors.join('; ') || 'none'}; caught by a check of another letter: ${wrongCatcher.join('; ') || 'none'}`)
  eq(stale, [], 'g: every mutant still matches its source')
  eq(survivors, [], 'g: every mutant is caught')
  eq(wrongCatcher, [], 'g: every mutant is caught by a check of the letter it is for')
  for (const letter of ['a', 'b', 'c', 'd', 'e', 'f']) ok((perLetter[letter] ?? 0) >= 2, `g: at least two mutants are caught by the checks of ${letter} (${perLetter[letter] ?? 0})`)
  return { count: MUTANTS.length, crashes, perLetter }
}

// ============================================================================================================================================
const only = argValue('--only')?.split(',') ?? null
if (flag('--timeline')) {
  const run = await runScenario({ rec: V1, plan: voicePlan(V1, [1, 2, 3]), pace: argValue('--timeline') })
  const { w } = run
  const rows = [...w.log.delivered.map(d => [d.at, 'frame', `${d.seq} ${d.type}`]), ...w.log.events.filter(e => ['clip_start', 'transcribed', 'clip_stopped', 'clip_end', 'press'].includes(e.kind)).map(e => [e.at, e.kind, e.text ?? e.words ?? '']), ...w.log.requested.map(r => [r.at, 'speak?', `${r.text}${r.during ? ` (during ${r.during})` : ''}`])].sort((a, b) => a[0] - b[0])
  for (const r of rows) if (r[1] !== 'frame' || /chat_message|action_request|build_phase|status_update/.test(r[2])) console.log(String(r[0]).padStart(7), r[1].padEnd(10), r[2])
  release(); process.exit(0)
}
await all({}, { only })
console.log(`PASS a-f  the recordings V0, V1, V2 through the real socket hook, call hook and controller (${checks} checks)`)
if (!only) {
  await suiteConventions()
  console.log(`PASS h    conventions (${checks} checks)`)
}
if (process.env.VOICE_TEST_SKIP_MUTANTS === '1' || only) { release(); console.log(`SKIPPED g  mutants (${only ? '--only' : 'VOICE_TEST_SKIP_MUTANTS=1'}); OK so far: ${checks} checks`); process.exit(0) }
const mutated = await runMutants()
console.log(`PASS g    ${mutated.count} mutants, every one caught by the check of its letter (${Object.entries(mutated.perLetter).map(([k, v]) => `${k}:${v}`).join(' ')})${mutated.crashes.length ? `; ${mutated.crashes.length} by a thrown error` : ''}`)
if (flag('--verbose')) for (const crash of mutated.crashes) console.log(`  threw: ${crash}`)
release()
console.log(`OK studio voice call replay: ${checks} checks`)
