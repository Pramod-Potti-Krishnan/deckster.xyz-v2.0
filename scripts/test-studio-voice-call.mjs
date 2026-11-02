// FRONTEND-1 (W6 P4-20 "Talk to the Director", the Studio voice call UI): proof of NEXT_PUBLIC_STUDIO_VOICE_CALL (the string "true", default off, build-time) and NEXT_PUBLIC_STUDIO_VOICE_COMPANION.
//   lib/studio-voice-call-ui.ts (pure: flag, wire, frame -> scene, scene -> clips, framing, words), lib/studio-voice-call-router.ts (the same-origin seam to model-router), lib/studio-voice-call-controller.ts (one call's life,
//   run here against ELEMENT-3's REAL core with a virtual clock and fakes), hooks/use-studio-voice-call.ts, components/builder/voice-call/*, and the marked lines in app/builder/page.tsx, hooks/use-deckster-websocket-v2.ts and
//   components/builder/chat-input.tsx, the .env.example block, the registry. The Director side is DIRECTOR-2's final P4-18 schema (client cap voice1, user_message data.mode "voice", payload.spoken, payload.companion_state).
//
//   A.  The lib, function by function (flags, the armed voice turn and its fields, every row of the frame -> scene table and the companion_state hint, spoken lines, the track, the scene, the chip, the clip plans, frames at a time,
//       the mouth, the framing, the controls, the words).
//   A2. The router seam (a fake fetch: statuses -> kinds, abort, nothing requested until a method is called).
//   B.  The controller against the real core: the microphone is asked for by the call and by nothing else, honest errors, push-to-talk, the voice turn (armed words, mode and cap), the reply's spoken line only, talk-over and Stop,
//       the filler, progress lines between turns, the timeout, the character's scene from Director's frames, tear-down (no timer, no track left).
//   C.  The components drawn offline (dock states, the call button, the player's fallback) and the hook (flag off: nothing loaded, listened to or timed).
//   D.  The page, the socket hook, the composer, .env.example, the strip, the scope and the registry: every marked line is where and as gated as it must be; stripping them gives the base's files byte for byte.
//   E.  MUTANTS: every one of them must be caught by A-D.
//
//   node scripts/test-studio-voice-call.mjs
//
// Offline: no microphone, no audio, no socket, no fetch and no real timer (the host network guard is installed); git is read only for D.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const release = installHostNetworkGuard(net, dns)
let checks = 0
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const React = (await import('react')).default
const { renderToStaticMarkup } = await import('react-dom/server')
const mini = await import('./studio-chat-harness/mini-react.mjs')
const { Root } = mini
const strip = await import('./studio-voice-call-strip.mjs')
const core = await import('./studio-voice-core-strip.mjs')

const UI = 'lib/studio-voice-call-ui.ts', ROUTER = 'lib/studio-voice-call-router.ts', CTL = 'lib/studio-voice-call-controller.ts', BROWSER = 'lib/studio-voice-call-browser.ts'
const HOOK = 'hooks/use-studio-voice-call.ts', DOCK = 'components/builder/voice-call/voice-call-dock.tsx', BUTTON = 'components/builder/voice-call/voice-call-button.tsx', PLAYER = 'components/builder/voice-call/companion-player.tsx'
const CSS = 'components/builder/voice-call/voice-call.css'
const PAGE = 'app/builder/page.tsx', WS = 'hooks/use-deckster-websocket-v2.ts', INPUT = 'components/builder/chat-input.tsx'
const CORE = 'lib/studio/voice'
const CORE_STRIP = 'scripts/studio-voice-core-strip.mjs'
const SOURCES = Object.fromEntries([UI, ROUTER, CTL, BROWSER, HOOK, DOCK, BUTTON, PLAYER, CSS, PAGE, WS, INPUT, CORE_STRIP, '.env.example'].map(rel => [rel, read(rel)]))

// ---- a tiny module host: the real files (or a mutant of one), their imports resolved against the repo, in THIS realm --------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function makeHost({ env = {}, stubs = {}, over = {} } = {}) {
  const cache = new Map()
  const resolve = (from, spec) => {
    const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
    throw new Error(`cannot resolve ${spec} from ${path.relative(root, from)}`)
  }
  const load = abs => {
    if (cache.has(abs)) return cache.get(abs).exports
    const module = { exports: {} }
    cache.set(abs, module)
    const rel = path.relative(root, abs)
    const text = rel in over ? over[rel] : fs.readFileSync(abs, 'utf8')
    const require_ = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(abs, spec))
      return require(spec)
    }
    new Function('module', 'exports', 'require', 'process', compile(text, rel.replace(/\.mjs$/, '.ts')))(module, module.exports, require_, { env })
    return module.exports
  }
  return { load: rel => load(path.join(root, rel)) }
}
const ENV_ON = { NEXT_PUBLIC_STUDIO_VOICE_CALL: 'true' }
const loadUi = (over = {}, env = ENV_ON) => makeHost({ env, over }).load(UI)
const macro = () => new Promise(resolve => setImmediate(resolve))
const settle = async () => { for (let i = 0; i < 4; i++) { await Promise.resolve(); await macro() } }

// ============================================================================================================================================
// A. The lib
// ============================================================================================================================================
const frame = (type, payload = {}, id = null) => ({ type, session_id: 's1', message_id: id ?? `${type}-${++frame.n}`, payload })
frame.n = 0
function uiSuite(ui, over = {}) {
  // -- flags ------------------------------------------------------------------------------------------------------------------------------
  for (const [label, value, want] of [['unset', undefined, false], ['"false"', 'false', false], ['"TRUE"', 'TRUE', false], ['"1"', '1', false], ['empty', '', false], ['" true"', ' true', false], ['"true"', 'true', true]]) {
    eq(loadUi(over, value === undefined ? {} : { NEXT_PUBLIC_STUDIO_VOICE_CALL: value }).STUDIO_VOICE_CALL_UI_ENABLED, want, `flag: ${label}`)
  }
  eq(ui.voiceCallFlagOn('true'), true, 'flag fn: true'); eq(ui.voiceCallFlagOn(undefined), false, 'flag fn: unset')
  for (const [value, want] of [[undefined, 'bob'], ['', 'bob'], ['bob', 'bob'], ['deckster-owl', 'deckster-owl'], ['Bob', 'bob'], ['../etc', 'bob'], ['a/b', 'bob'], ['-x', 'bob'], ['x'.repeat(33), 'bob'], ['x'.repeat(32), 'x'.repeat(32)], ['b o b', 'bob'], ['bob.webp', 'bob']]) {
    eq(ui.companionNameFrom(value), want, `companion name: ${String(value).slice(0, 20)}`)
  }
  eq(loadUi(over, { NEXT_PUBLIC_STUDIO_VOICE_COMPANION: 'toy-1' }).STUDIO_VOICE_COMPANION, 'toy-1', 'companion: read from the environment')
  eq(loadUi(over, {}).STUDIO_VOICE_COMPANION, 'bob', 'companion: default')

  // -- the voice turn on the wire ----------------------------------------------------------------------------------------------------------
  eq([ui.voiceCallBus.frame, ui.voiceCallBus.sent, ui.voiceCallBus.pending], [null, null, null], 'bus: empty at rest')
  eq([ui.VOICE_TURN_MODE, ui.VOICE_CAP], ['voice', 'voice1'], 'wire: mode "voice", cap "voice1"')
  const typed = { text: 'hello', client_caps: ['mdc1'] }
  eq(ui.addVoiceCallFields({ ...typed }, 'hello'), typed, 'wire: nothing armed, nothing added (a typed message is exactly as before)')
  ui.armVoiceTurn('make it shorter')
  eq(ui.addVoiceCallFields({ text: 'something else', client_caps: ['mdc1'] }, 'something else'), { text: 'something else', client_caps: ['mdc1'] }, 'wire: another message is not the voice turn')
  eq(ui.voiceCallBus.pending, { text: 'make it shorter' }, 'wire: ...and the armed turn stays armed for its own words')
  eq(ui.addVoiceCallFields({ text: 'make it shorter', client_caps: ['mdc1', 'element_edit1'] }, 'make it shorter'), { text: 'make it shorter', client_caps: ['mdc1', 'element_edit1', 'voice1'], mode: 'voice' }, 'wire: the armed words get mode and the cap, after the other caps')
  eq(ui.voiceCallBus.pending, null, 'wire: ...once')
  eq(ui.addVoiceCallFields({ text: 'make it shorter' }, 'make it shorter'), { text: 'make it shorter' }, 'wire: a second message with the same words is not a voice turn')
  ui.armVoiceTurn('a'); eq(ui.addVoiceCallFields({ text: 'a' }, 'a'), { text: 'a', mode: 'voice', client_caps: ['voice1'] }, 'wire: no caps before: just voice1')
  ui.armVoiceTurn('a'); eq(ui.addVoiceCallFields({ text: 'a', client_caps: ['voice1', 'x'] }, 'a').client_caps, ['voice1', 'x'], 'wire: voice1 once')
  ui.armVoiceTurn('a'); eq(ui.addVoiceCallFields({ text: 'a', client_caps: 'oops' }, 'a').client_caps, ['voice1'], 'wire: caps that are not a list are replaced by ours')
  ui.armVoiceTurn('a'); ui.disarmVoiceTurn(); eq(ui.voiceCallBus.pending, null, 'wire: disarmed')
  eq(ui.isVoiceCallFrameType('chat_message') && ui.isVoiceCallFrameType('build_event') && ui.isVoiceCallFrameType('status_update') && ui.isVoiceCallFrameType('action_request'), true, 'frame types: the ones Director\'s state rides')
  eq(['sync_response', 'error', 'slide_update', 'deck_mutation', 'token_usage', undefined].map(ui.isVoiceCallFrameType), [false, false, false, false, false, false], 'frame types: nothing else is shown to the call')

  // -- Director's frames -> a signal (Garud's table, DIRECTOR-2's frames) -----------------------------------------------------------------------
  const sig = (type, payload) => ui.signalFromFrame(frame(type, payload))
  eq(sig('status_update', { status: 'thinking' }), { kind: 'thinking' }, 'signal: status_update thinking')
  eq(sig('status_update', { status: 'generating' }), { kind: 'working' }, 'signal: status_update generating')
  eq(sig('status_update', { status: 'error' }), { kind: 'concerned' }, 'signal: status_update error')
  eq(sig('status_update', { status: 'idle' }), { kind: 'idle' }, 'signal: status_update idle')
  eq(sig('status_update', { status: 'complete' }), null, 'signal: status_update complete says nothing about the character')
  for (const phase of ['planning', 'strawman', 'building', 'qa', 'finalizing']) eq(sig('build_phase', { phase }), { kind: 'working' }, `signal: build_phase ${phase} is working`)
  eq(sig('build_phase', { phase: 'complete' }), { kind: 'pleased', big: true }, 'signal: build_phase complete is the big pleased')
  eq([sig('build_phase', { phase: 'paused' }), sig('build_phase', { phase: 'stopped' })], [{ kind: 'paused' }, { kind: 'paused' }], 'signal: build_phase paused / stopped is paused')
  eq(sig('build_phase', { phase: 'error' }), { kind: 'concerned' }, 'signal: build_phase error')
  eq(sig('build_phase', { phase: 'settled' }), null, 'signal: an unknown phase says nothing')
  eq([sig('build_event', { status: 'started' }), sig('build_event', { status: 'progress' })], [{ kind: 'working' }, { kind: 'working' }], 'signal: build_event started / progress is working')
  eq(sig('build_event', { status: 'error' }), { kind: 'concerned' }, 'signal: build_event error'); eq(sig('build_event', { status: 'done' }), null, 'signal: build_event done is not a state')
  eq(sig('slide_progress', { text: 'x' }), { kind: 'working' }, 'signal: slide_progress is working')
  eq(sig('slide_built', {}), { kind: 'pleased', big: false }, 'signal: slide_built is the small pleased'); eq(sig('slide_failed', {}), { kind: 'concerned' }, 'signal: slide_failed')
  eq(sig('action_request', {}), { kind: 'waiting' }, 'signal: action_request is waiting')
  eq(sig('chat_message', { text: 'Done.' }), { kind: 'reporting', decline: false }, 'signal: chat_message is reporting')
  eq(sig('chat_message', { text: 'Preparing...', ephemeral: true }), null, 'signal: an ephemeral progress bubble is not a report')
  for (const text of ["I can't do that yet.", 'I cannot change the logo.', "Sorry, that is not possible.", "I couldn't open that file.", "I'm unable to do that.", "I'm not able to add a video."]) eq(sig('chat_message', { text }), { kind: 'reporting', decline: true }, `signal: an honest decline is sorry: ${text}`)
  for (const text of ['I can see the problem.', 'It cannot hurt.', 'Sure, I can do that.', 'I have changed the title.']) eq(sig('chat_message', { text }), { kind: 'reporting', decline: false }, `signal: not a decline: ${text}`)
  eq([sig('slide_update', {}), sig('presentation_url', {}), ui.signalFromFrame(null), ui.signalFromFrame('x'), ui.signalFromFrame({ type: 'chat_message' })], [null, null, null, null, { kind: 'reporting', decline: false }], 'signal: other frames and junk say nothing, and never throw')
  // the Director's own hint wins, refined only by what the frame itself knows
  for (const [hint, want] of [['thinking', { kind: 'thinking' }], ['working', { kind: 'working' }], ['reporting', { kind: 'reporting', decline: false }], ['pleased', { kind: 'pleased', big: false }], ['concerned', { kind: 'concerned' }], ['waiting', { kind: 'waiting' }]]) {
    eq(sig('status_update', { status: 'idle', companion_state: hint }), want, `hint: ${hint} wins over the frame's type`)
  }
  eq(sig('chat_message', { text: "I can't do that.", companion_state: 'reporting' }), { kind: 'reporting', decline: true }, 'hint: reporting on a decline is sorry')
  eq(sig('build_phase', { phase: 'complete', companion_state: 'pleased' }), { kind: 'pleased', big: true }, 'hint: pleased on build_phase complete is the big one')
  eq(sig('slide_built', { companion_state: 'pleased' }), { kind: 'pleased', big: false }, 'hint: pleased on slide_built is the small one')
  eq(sig('build_phase', { phase: 'paused', companion_state: 'waiting' }), { kind: 'paused' }, 'hint: waiting on a paused build is the hold pose')
  eq(sig('action_request', { companion_state: 'waiting' }), { kind: 'waiting' }, 'hint: waiting on a question is the invitation')
  eq(sig('build_phase', { phase: 'stopped', companion_state: 'concerned' }), { kind: 'concerned' }, 'hint: concerned on a stopped build (DIRECTOR-2) is concerned')
  eq(sig('build_phase', { phase: 'building', companion_state: 'listening' }), { kind: 'working' }, 'hint: "listening" is client-only: ignored, the frame decides')
  eq(sig('build_phase', { phase: 'building', companion_state: 'dancing' }), { kind: 'working' }, 'hint: an unknown state is ignored, never guessed at')
  eq(sig('build_phase', { phase: 'building', companion_state: 7 }), { kind: 'working' }, 'hint: a non-string is ignored')

  // -- words on frames -------------------------------------------------------------------------------------------------------------------------
  const spoken = (type, payload) => ui.spokenLineFromFrame(frame(type, payload))
  eq(spoken('chat_message', { text: 'Long text', spoken: ' Sure, done. ' }), 'Sure, done.', 'spoken: a chat_message\'s payload.spoken, trimmed')
  eq(spoken('chat_message', { text: 'Long text' }), null, 'spoken: no spoken line, nothing to say (nothing is made up from the text)')
  eq(spoken('chat_message', { text: 'x', spoken: '   ' }), null, 'spoken: blank is nothing'); eq(spoken('chat_message', { spoken: 7 }), null, 'spoken: not a string is nothing')
  eq(spoken('chat_message', { spoken: 'a'.repeat(300) }) !== null && spoken('chat_message', { spoken: 'a'.repeat(301) }) === null, true, 'spoken: a chat line over 300 characters is not said')
  eq(spoken('status_update', { status: 'generating', text: 'Researching', spoken: 'Researching the topic.' }), 'Researching the topic.', 'spoken: a status_update\'s line')
  eq(spoken('build_phase', { phase: 'building', label: 'Building', spoken: 'Building your slides.' }), 'Building your slides.', 'spoken: a build_phase\'s line')
  eq(spoken('build_event', { scope: 'deck', text: 'x', spoken: 'Checking the layouts.' }), 'Checking the layouts.', 'spoken: a deck-scope build_event\'s line')
  eq(spoken('build_event', { scope: 'slide', text: 'x', spoken: 'Slide three.' }), null, 'spoken: a slide-scope build_event says nothing aloud')
  eq(spoken('slide_built', { spoken: 'Hi' }), null, 'spoken: no other frame is read aloud'); eq(spoken('action_request', { prompt_text: 'Which theme?', spoken: 'Which theme?' }), 'Which theme?', 'spoken: a card\'s (or the clarifying questions\') payload.spoken')
  eq(spoken('action_request', { prompt_text: 'Which theme?' }), null, 'spoken: a card with no spoken line says nothing'); eq(spoken('action_request', { spoken: 'a'.repeat(300) }) !== null && spoken('action_request', { spoken: 'a'.repeat(301) }) === null, true, 'spoken: a card line over 300 characters is not said')
  eq(spoken('status_update', { status: 'generating', spoken: 'a'.repeat(160) }) !== null && spoken('status_update', { status: 'generating', spoken: 'a'.repeat(161) }) === null, true, 'spoken: a progress line over 160 characters is not said')
  eq(ui.isProgressSpoken(frame('build_phase', { phase: 'building', spoken: 'On it.' })), true, 'progress: a progress frame with a line'); eq([ui.isProgressSpoken(frame('chat_message', { spoken: 'On it.' })), ui.isProgressSpoken(frame('action_request', { spoken: 'On it.' }))], [false, false], 'progress: a chat_message or a card is a reply, not progress')
  eq(ui.isProgressSpoken(frame('build_phase', { phase: 'building' })), false, 'progress: no line, no progress speech')
  const words = (type, payload) => ui.progressTextFromFrame(frame(type, payload))
  eq([words('build_event', { scope: 'deck', text: 'Researching…' }), words('build_event', { scope: 'slide', text: 'Slide 3' }), words('build_phase', { label: 'Building your slides…' }), words('status_update', { status: 'generating', text: 'Drafting' }), words('status_update', { status: 'thinking', text: 'Thinking…' }), words('slide_progress', { text: 'Rendering' }), words('chat_message', { text: 'x' })],
    ['Researching…', null, 'Building your slides…', 'Drafting', null, 'Rendering', null], 'progress text: deck events, labels, statuses (not "thinking"), slide_progress; a slide-scoped event is not the deck\'s story')
  eq(ui.replyTextFromFrame(frame('chat_message', { text: ' hi ' })), 'hi', 'reply text'); eq(ui.replyTextFromFrame(frame('status_update', { text: 'hi' })), null, 'reply text: chat_message only')

  // -- a spoken answer to a card (PROVISIONAL, P4-18) -----------------------------------------------------------------------------------------------------
  const PLAN = [{ label: "Yes, let's build it!", value: 'accept_plan', primary: true, requires_input: false }, { label: "I'd like to make changes", value: 'reject_plan', primary: false, requires_input: false }]
  const NEXT = [{ label: 'Done, looks great!', value: 'complete_presentation', primary: true, requires_input: false }, { label: 'Make adjustments', value: 'request_adjustments', primary: false, requires_input: true }]
  const SKIP = [{ label: 'Skip \u2014 use sensible defaults', value: 'skip_questions', primary: false, requires_input: false }]
  const said = (transcript, actions) => ui.matchSpokenAnswer(transcript, actions)?.value ?? null
  for (const [words, want] of [["Yes, let's build it!", 'accept_plan'], ['yes', 'accept_plan'], ['Yes please.', 'accept_plan'], ['yeah', 'accept_plan'], ['Go ahead', 'accept_plan'], ['looks good', 'accept_plan'], ['OK', 'accept_plan'], ['sounds good, thanks', 'accept_plan'], ['let\u2019s build it', 'accept_plan'],
    ['no', 'reject_plan'], ['Nope.', 'reject_plan'], ['not yet', 'reject_plan'], ['change it', 'reject_plan'], ["I'd like to make changes", 'reject_plan'], ['make some changes please', 'reject_plan'],
    ['yes but make the deck shorter', null], ['yes, and add a slide about risks', null], ['no, make it blue', null], ['', null], ['   ', null], ['the weather is nice', null], ['yes yes yes yes yes yes yes yes yes', null], ['maybe', null]]) {
    eq(said(words, PLAN), want, `answer: "${words}" on the plan card is ${want ?? 'not a click'}`)
  }
  eq([said('yes', NEXT), said('Done, looks great', NEXT), said('no', NEXT), said('make adjustments', NEXT), said('adjust', NEXT)], ['complete_presentation', 'complete_presentation', null, null, null], 'answer: a button that asks for typed input is never picked by voice (so "no" has nothing to press)')
  eq([said('yes', SKIP), said('no', SKIP), said('skip use sensible defaults', SKIP), said('skip', SKIP)], [null, null, 'skip_questions', null], 'answer: a card with one non-primary button is answered by its label only')
  eq([said('yes', null), said('yes', undefined), said('yes', []), ui.matchSpokenAnswer(7, PLAN)], [null, null, null, null], 'answer: no card, no click, and junk never throws')
  eq(said('yes', [{ ...PLAN[0], primary: true }, { ...PLAN[1], primary: true }]), null, 'answer: two primary buttons: "yes" is ambiguous')
  eq(said('go', [{ label: 'Go', value: 'a', primary: true, requires_input: false }, { label: 'Go', value: 'b', primary: false, requires_input: false }]), null, 'answer: two buttons with the same label: not a click')
  eq(said('yes', [{ ...PLAN[0], requires_input: true }, PLAN[1]]), null, 'answer: a primary button that asks for input is not clicked by "yes"')
  eq(ui.actionsFromFrame(frame('action_request', { actions: PLAN })), PLAN, 'card: the buttons of an action_request')
  eq([ui.actionsFromFrame(frame('action_request', { actions: [] })), ui.actionsFromFrame(frame('action_request', {})), ui.actionsFromFrame(frame('action_request', { actions: 'x' })), ui.actionsFromFrame(frame('chat_message', { actions: PLAN })), ui.actionsFromFrame(null)], [null, null, null, null, null], 'card: no buttons, no card')
  eq(ui.actionsFromFrame(frame('action_request', { actions: [{ label: ' Ok ', value: 'ok' }, { label: '', value: 'x' }, { label: 'y', value: '' }, 5, null, { label: 'Go', value: 'go', primary: true, requires_input: 'yes' }] })), [{ label: 'Ok', value: 'ok', primary: false, requires_input: false }, { label: 'Go', value: 'go', primary: true, requires_input: false }], 'card: junk buttons are left out and the flags are booleans')
  eq([['status_update', { status: 'thinking' }], ['status_update', { status: 'generating' }], ['build_phase', { phase: 'planning' }], ['build_phase', { phase: 'building' }]].map(([type, payload]) => ui.closesOpenAction(frame(type, payload))), [true, true, true, true], 'card: Director taking a new turn closes it')
  eq([['status_update', { status: 'idle' }], ['status_update', { status: 'error' }], ['build_phase', { phase: 'complete' }], ['build_phase', { phase: 'paused' }], ['chat_message', { text: 'x' }], ['slide_built', {}], ['action_request', {}]].map(([type, payload]) => ui.closesOpenAction(frame(type, payload))), [false, false, false, false, false, false, false], 'card: ...and a report, a finished build or another frame does not (the "what next?" card arrives beside build_phase complete)')

  // -- the track and the scene ------------------------------------------------------------------------------------------------------------------
  const T0 = ui.initialDirectorTrack()
  eq([T0.background, T0.beat], ['none', null], 'track: starts empty')
  const at = (track, signal, now) => ui.applyDirectorSignal(track, signal, now)
  let track = at(T0, { kind: 'working' }, 1000)
  eq(track.background, 'working', 'track: working is held'); eq(ui.companionScene({ phase: 'idle', track, now: 1500 }), 'working', 'scene: idle call, Director working -> working')
  eq(ui.companionScene({ phase: 'listening', track, now: 1500 }), 'listening', 'scene: the user\'s turn wins'); eq(ui.companionScene({ phase: 'speaking', track, now: 1500 }), 'speaking', 'scene: Director\'s speech wins')
  eq(ui.companionScene({ phase: 'thinking', track, now: 1500 }), 'thinking', 'scene: a turn waiting for its reply is thinking'); eq(ui.companionScene({ phase: 'idle', speakingNow: true, track, now: 1500 }), 'speaking', 'scene: a line coming out is speaking')
  track = at(track, { kind: 'pleased', big: false }, 2000)
  eq(ui.companionScene({ phase: 'idle', track, now: 2100 }), 'pleased', 'scene: a beat over what Director was doing'); eq(ui.companionScene({ phase: 'idle', track, now: 2000 + ui.BEAT_MS.pleased }), 'working', 'scene: ...and back to it when the beat is over')
  track = at(track, { kind: 'pleased', big: false }, 2000 + ui.PLEASED_EVERY_MS - 1)
  eq(ui.companionScene({ phase: 'idle', track, now: 2000 + ui.PLEASED_EVERY_MS }), 'working', 'track: a small pleased at most every 20 s (a slide built 19.999 s later is not another one)')
  track = at(track, { kind: 'pleased', big: false }, 2000 + ui.PLEASED_EVERY_MS)
  eq(ui.companionScene({ phase: 'idle', track, now: 2000 + ui.PLEASED_EVERY_MS + 10 }), 'pleased', 'track: ...and 20 s later it is')
  track = at(T0, { kind: 'thinking' }, 0); eq(ui.companionScene({ phase: 'idle', track, now: 1 }), 'thinking', 'scene: Director thinking on a typed turn')
  const replied = at(track, { kind: 'reporting', decline: false }, 10)
  eq([replied.background, replied.beat.scene], ['none', 'reporting'], 'track: a report ends the thinking'); eq(at(at(T0, { kind: 'working' }, 0), { kind: 'reporting', decline: false }, 10).background, 'working', 'track: ...but not a build that is still going')
  eq(at(T0, { kind: 'reporting', decline: true }, 0).beat.scene, 'sorry', 'track: a decline is sorry'); eq(at(T0, { kind: 'concerned' }, 0).beat.scene, 'concerned', 'track: concerned')
  for (const [kind, want] of [['waiting', 'waiting'], ['paused', 'paused'], ['reading', 'reading']]) eq(ui.companionScene({ phase: 'idle', track: at(T0, { kind }, 0), now: 1 }), want, `scene: ${kind}`)
  eq(ui.companionScene({ phase: 'idle', track: at(at(T0, { kind: 'waiting' }, 0), { kind: 'idle' }, 1), now: 2 }), 'idle', 'scene: idle clears a held state')
  const big1 = at(T0, { kind: 'pleased', big: true }, 0), big2 = at(big1, { kind: 'pleased', big: true }, 10000), big3 = at(big2, { kind: 'pleased', big: true }, 20000)
  eq([big1.dance, big2.dance, big3.dance, big3.beat.scene], [false, false, true, 'celebrating'], 'track: every third celebration dances')
  eq(at(big3, { kind: 'pleased', big: true }, 30000).dance, false, 'track: ...and the next does not'); eq(at(at(at(at(at(T0, { kind: 'pleased', big: true }, 0), { kind: 'pleased', big: true }, 70000), { kind: 'pleased', big: true }, 140000), { kind: 'pleased', big: true }, 210000), { kind: 'pleased', big: true }, 280000).celebrations, 5, 'track: the count is kept')
  const dancer = at(at(at(T0, { kind: 'pleased', big: true }, 0), { kind: 'pleased', big: true }, 100), { kind: 'pleased', big: true }, 200), dancer2 = at(at(at(dancer, { kind: 'pleased', big: true }, 300), { kind: 'pleased', big: true }, 400), { kind: 'pleased', big: true }, 500)
  eq([dancer.dance, dancer2.dance], [true, false], 'track: a dance never comes twice within a minute')
  const failed = at(T0, { kind: 'concerned' }, 0)
  eq([at(failed, { kind: 'reporting', decline: false }, 100).beat.scene, at(failed, { kind: 'reporting', decline: true }, 100).beat.scene, at(failed, { kind: 'pleased', big: true }, 100).beat.scene, at(failed, { kind: 'pleased', big: false }, 100).beat.scene], ['concerned', 'concerned', 'concerned', 'concerned'], 'track: a failure is not covered by the report that explains it, a celebration or a slide built')
  eq([at(failed, { kind: 'reporting', decline: false }, ui.BEAT_MS.concerned).beat.scene, at(at(T0, { kind: 'reporting', decline: true }, 0), { kind: 'reporting', decline: false }, 100).beat.scene, at(at(T0, { kind: 'reporting', decline: false }, 0), { kind: 'pleased', big: false }, 100).beat.scene, at(at(T0, { kind: 'reporting', decline: false }, 0), { kind: 'concerned' }, 100).beat.scene], ['reporting', 'sorry', 'pleased', 'concerned'], 'track: ...once it is over the next beat is shown; a decline outranks a plain report; a pleased, a report; a failure, anything')
  eq([at(at(T0, { kind: 'pleased', big: true }, 0), { kind: 'reporting', decline: false }, 100).beat.scene, at(at(T0, { kind: 'reporting', decline: false }, 0), { kind: 'pleased', big: true }, 100).beat.scene], ['celebrating', 'celebrating'], 'track: a celebration is not covered by the report before or after it')
  const hidden = at(T0, { kind: 'concerned' }, 0)
  eq([ui.rearmBeat(hidden, 50000).beat, ui.rearmBeat(at(T0, { kind: 'reporting', decline: false }, 0), 50000).beat?.scene, ui.rearmBeat(T0, 5).beat], [{ scene: 'concerned', until: 50000 + ui.BEAT_MS.concerned }, 'reporting', null], 'track: a beat that speech hid gets its full time when the speech ends (a report does not: it was just spoken)')
  eq(ui.rearmBeat(at(T0, { kind: 'reporting', decline: false }, 7), 50000).beat.until, 7 + ui.BEAT_MS.reporting, 'track: ...and a reporting beat is left as it was')
  eq(ui.chipLabel('listening'), 'Listening', 'chip: listening'); eq(ui.chipLabel('thinking'), 'Thinking', 'chip: thinking'); eq(ui.chipLabel('speaking'), 'Speaking', 'chip: speaking')
  eq(ui.SCENES.filter(scene => !['listening', 'thinking', 'speaking'].includes(scene)).map(ui.chipLabel).every(label => label === 'Your turn'), true, 'chip: every other scene is the user\'s turn (the user may talk while Director works)')

  // -- scenes -> clips (Garud's table) ---------------------------------------------------------------------------------------------------------
  const plan = (scene, dance = false) => ui.scenePlan(scene, { dance })
  const names = scene => plan(scene).steps.map(step => `${step.clip}:${step.mode}`)
  eq(names('idle'), ['idle_breathe:loop'], 'clips: idle breathes'); eq(plan('idle').blink, true, 'clips: idle blinks')
  eq(names('listening'), ['lean_in:hold'], 'clips: listening = lean_in hold'); eq(plan('listening').accent, { clip: 'nod', reverse: false, everyMs: [3500, 5500] }, 'clips: ...and a nod every few seconds')
  eq(names('thinking'), ['expr_thinking_front:hold'], 'clips: thinking = expr_thinking')
  eq(names('working'), ['work_loop:loop'], 'clips: working = work_loop'); eq(plan('working').accent, { clip: 'look_down', reverse: true, everyMs: [8000, 12000] }, 'clips: ...with a glance up (look_down reversed) every 8-12 s')
  eq(names('reporting'), ['present:once', 'idle_breathe:loop'], 'clips: reporting = present, then talk (the talk is the speaking scene)')
  eq(names('pleased'), ['expr_happy_front:hold'], 'clips: pleased = a happy beat'); eq(names('celebrating'), ['expr_happy_front:once', 'wave_both:once', 'expr_happy_front:hold'], 'clips: the big pleased = happy -> wave_both')
  eq(plan('celebrating', true).steps.map(step => step.clip), ['expr_happy_front', 'wave_both', 'dance_bounce', 'expr_happy_front'], 'clips: ...sometimes a dance')
  eq(names('concerned'), ['expr_concerned_front:hold'], 'clips: concerned'); eq(names('sorry'), ['expr_sorry_front:once', 'shrug:once', 'expr_sorry_front:hold'], 'clips: sorry = expr_sorry + shrug')
  eq(names('waiting'), ['invite:once', 'lean_in:hold'], 'clips: waiting = invite, then lean_in'); eq(names('paused'), ['hold:hold'], 'clips: paused = hold'); eq(names('reading'), ['look_down:hold'], 'clips: reading = look_down')
  eq(names('speaking'), ['talk_neutral:talk'], 'clips: speaking = the talk set')
  eq(ui.SCENES.every(scene => plan(scene).steps.length > 0 && !!plan(scene).still.clip), true, 'clips: every scene has a plan and a still')
  eq(['idle', 'listening', 'thinking', 'speaking', 'pleased', 'concerned'].map(scene => `${plan(scene).still.clip}:${plan(scene).still.at}`), ['idle_breathe:first', 'lean_in:hold', 'expr_thinking_front:hold', 'talk_neutral:first', 'expr_happy_front:hold', 'expr_concerned_front:hold'], 'reduced motion: one still per state (listening = lean_in hold, thinking, speaking = talk closed, pleased = happy, concerned)')
  eq(ui.clipsForScene('working'), ['work_loop', 'look_down', 'blink'], 'clips: a scene\'s clips, accent and blink included'); eq(ui.clipsForScene('celebrating').includes('dance_bounce'), true, 'clips: a celebration may ask for the dance')
  // frames at a time
  const clip = { frames: ['a', 'b', 'c', 'd'], fps: 2, hold: 2 }, looped = { frames: ['a', 'b', 'c', 'd'], fps: 2, loop: [1, 3] }
  eq([0, 0.49, 0.5, 1.2, 1.9, 5].map(t => ui.stepFrameIndex(clip, 'once', t)), [0, 0, 1, 2, 3, 3], 'frames: once runs to the last frame and stays')
  eq([0, 1.1, 1.6, 9].map(t => ui.stepFrameIndex(clip, 'hold', t)), [0, 2, 2, 2], 'frames: hold stops at the hold frame')
  eq([0, 1.5, 2.0, 2.5, 3.0].map(t => ui.stepFrameIndex(looped, 'loop', t)), [0, 1, 2, 1, 2], 'frames: a loop repeats its loop range')
  eq([0, 3, 4, 5, 9].map(t => ui.stepFrameIndex({ frames: ['a', 'b', 'c'], fps: 1 }, 'loop', t)), [0, 0, 1, 2, 0], 'frames: a loop with no range repeats all of it')
  eq(ui.stepFrameIndex(clip, 'hold', -5), 0, 'frames: negative time is the first frame'); eq(ui.stepFrameIndex({ frames: ['a'], fps: 5 }, 'loop', 100), 0, 'frames: a one-frame loop')
  const clips = { present: { frames: ['p1', 'p2', 'p3', 'p4'], fps: 4 }, idle_breathe: { frames: ['i1', 'i2'], fps: 2 }, expr_sorry_front: { frames: ['s1', 's2'], fps: 2, hold: 1 }, shrug: { frames: ['h1', 'h2'], fps: 2 } }
  const poseOf = (scene, t) => { const pose = ui.planPoseAt(plan(scene), name => clips[name], t); return `${pose.clip}:${pose.index}:${pose.resting}` }
  eq([0, 0.5, 0.99, 1.0, 5].map(t => poseOf('reporting', t)), ['present:0:false', 'present:2:false', 'present:3:false', 'idle_breathe:0:true', 'idle_breathe:0:true'], 'plan: a one-shot step plays, then the resting loop')
  eq([0, 0.6, 1.0, 1.6, 3].map(t => poseOf('sorry', t)), ['expr_sorry_front:0:false', 'expr_sorry_front:1:false', 'shrug:0:false', 'shrug:1:false', 'expr_sorry_front:1:true'], 'plan: sorry plays its beat, the shrug, then rests on the hold frame')
  eq(ui.stillFrameIndex(plan('sorry'), clips.expr_sorry_front), 1, 'still: the hold frame'); eq(ui.stillFrameIndex(plan('idle'), clips.idle_breathe), 0, 'still: the first frame'); eq(ui.stillFrameIndex({ still: { clip: 'x', at: 'last' } }, clips.present), 3, 'still: the last frame')
  eq(ui.nextDelayMs([3000, 6000], 0), 3000, 'delay: low'); eq(ui.nextDelayMs([3000, 6000], 0.5), 4500, 'delay: middle'); eq(ui.nextDelayMs([3000, 6000], 5) <= 6000 && ui.nextDelayMs([3000, 6000], -1) === 3000 && ui.nextDelayMs([3000, 6000], NaN) === 3000, true, 'delay: clamped')
  eq([[0, 0.1], [0.01, 0.1], [0.1, 0], [0.3, 0], [0.9, 0]].map(([level, time]) => ui.mouthShapeIndex(level, time, 10)), [0, 0, 6, 3, 2], 'mouth: closed, closed, fv, open, wide (the core rig\'s mapping)')
  eq(ui.mouthShapeIndex(0.1, 0.1, 10), 1, 'mouth: a quiet level varies with the syllable clock'); eq(ui.mouthShapeIndex(NaN, 3, 10), 0, 'mouth: a bad level is closed')
  eq(new Set([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(t => ui.mouthShapeIndex(0.3, t, 10))).size > 1, true, 'mouth: an open mouth does not hold one shape')

  // -- the recording as the router wants it: WAV, mono, 16-bit, 16 kHz ---------------------------------------------------------------------------------------
  eq(ui.VOICE_WAV_RATE, 16000, 'wav: 16 kHz')
  const wav = ui.encodeWavPcm16([0, 0.5, -0.5, 1, -1, 2, -2, NaN], 16000), v = new DataView(wav.buffer), tag = at => String.fromCharCode(...wav.slice(at, at + 4))
  eq([wav.length, tag(0), tag(8), tag(12), tag(36), v.getUint32(4, true), v.getUint32(16, true), v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true), v.getUint32(28, true), v.getUint16(32, true), v.getUint16(34, true), v.getUint32(40, true)], [44 + 16, 'RIFF', 'WAVE', 'fmt ', 'data', 36 + 16, 16, 1, 1, 16000, 32000, 2, 16, 16], 'wav: the header of a 16-bit mono PCM file at 16 kHz')
  eq([0, 1, 2, 3, 4, 5, 6, 7].map(i => v.getInt16(44 + i * 2, true)), [0, 16384, -16384, 32767, -32768, 32767, -32768, 0], 'wav: samples are 16-bit little-endian, clipped at full scale, and a bad number is silence')
  eq([ui.encodeWavPcm16([], 8000).length, new DataView(ui.encodeWavPcm16([], 8000).buffer).getUint32(40, true)], [44, 0], 'wav: no samples is a valid empty file')
  eq(Array.from(ui.mixToMono([[1, 0.5, 0], [0, 0.5, 1]])), [0.5, 0.5, 0.5], 'wav: two channels are averaged'); eq(Array.from(ui.mixToMono([[0.25, -0.25]])), [0.25, -0.25], 'wav: one channel is as it is'); eq([ui.mixToMono([]).length, ui.mixToMono([[1, 2], [1]]).length], [0, 2], 'wav: no channels is empty; the longest channel sets the length')
  eq(Array.from(ui.resampleLinear([0, 1, 0, -1], 4, 4)), [0, 1, 0, -1], 'wav: the same rate keeps the samples'); eq(Array.from(ui.resampleLinear([0, 1, 2, 3], 4, 2)), [0, 2], 'wav: half the rate takes every second sample')
  eq(Array.from(ui.resampleLinear([0, 2], 1, 2)).map(x => Math.round(x * 100) / 100), [0, 1, 2, 2], 'wav: double the rate interpolates (and holds the last sample)'); eq([ui.resampleLinear([], 4, 2).length, ui.resampleLinear([1], 0, 2).length, ui.resampleLinear([1, 2, 3], 48000, 16000).length], [0, 0, 1], 'wav: nothing to resample, a bad rate, and 48 kHz to 16 kHz is a third as long')
  eq(ui.resampleLinear(new Float32Array(48000), 48000, 16000).length, 16000, 'wav: one second stays one second')

  // -- framing, controls, words ----------------------------------------------------------------------------------------------------------------
  const full = { size: { width: 768, height: 768 }, bbox: { x: 47, y: 92, width: 655, height: 619 } }, face = { size: { width: 627, height: 627 }, bbox: { x: 0, y: 82, width: 627, height: 545 }, variant: 'face' }
  eq(ui.framingRect(face, 'disc'), { sx: 0, sy: 0, sw: 627, sh: 627 }, 'framing: a Face pack is drawn whole in the disc')
  const disc = ui.framingRect(full, 'disc'), chest = ui.framingRect(full, 'chest')
  eq([Math.round(disc.sw), Math.round(disc.sh), disc.sy], [248, 248, 92], 'framing: the disc of a full pack is the head and shoulders, a square at the top of the character')
  ok(Math.abs(disc.sx + disc.sw / 2 - (47 + 655 / 2)) < 1, 'framing: ...centred on the character')
  eq([Math.round(chest.sh), chest.sy, Math.round(chest.sw)], [384, 92, 441], 'framing: the chest is the top 62% of the character, at most 1.15 times as wide as tall')
  eq([ui.framedWidth('disc', 88, chest), ui.framedWidth('disc', 88, null), ui.framedWidth('chest', 240, chest), ui.framedWidth('chest', 240, null)], [88, 88, 276, 240], 'framing: the disc is a square, the chest is as wide as its crop (a square before the pack is read)')
  eq(ui.framingRect(face, 'chest'), ui.framingRect(face, 'chest'), 'framing: deterministic'); ok(chest.sx >= 0 && chest.sx + chest.sw <= 768 && disc.sx >= 0 && disc.sx + disc.sw <= 768, 'framing: inside the canvas')
  eq([ui.DISC_PX_DESKTOP, ui.DISC_PX_PHONE, ui.CHEST_PX, ui.VOICE_PHONE_MEDIA], [88, 64, 240, '(max-width: 767px)'], 'sizes: 88, 64, 240, and a phone is 767 px and narrower')
  eq(['bob', 'deckster-owl', 'a', 'x-y-z', '', 'DECK'].map(ui.initialsFor), ['B', 'DO', 'A', 'XY', 'D', 'DECK'.slice(0, 1)], 'initials: one or two capitals')
  eq(ui.callControls({ active: false, starting: false, phase: 'idle', speakingNow: false, connected: true }), { talk: false, stop: false, end: false, expand: false }, 'controls: nothing before the call')
  eq(ui.callControls({ active: true, starting: false, phase: 'idle', speakingNow: false, connected: true }), { talk: true, stop: false, end: true, expand: true }, 'controls: in a call, your turn')
  eq(ui.callControls({ active: true, starting: false, phase: 'speaking', speakingNow: true, connected: true }).stop, true, 'controls: Stop while Director speaks'); eq(ui.callControls({ active: true, starting: false, phase: 'thinking', speakingNow: false, connected: true }).stop, true, 'controls: Stop while a turn waits')
  eq(ui.callControls({ active: true, starting: false, phase: 'idle', speakingNow: false, connected: false }).talk, false, 'controls: no talking without a socket'); eq(ui.callControls({ active: true, starting: true, phase: 'idle', speakingNow: false, connected: true }), { talk: false, stop: false, end: false, expand: false }, 'controls: nothing while the microphone is being asked for')
  eq([ui.callButtonLabel(false), ui.callButtonLabel(true)], ['Start a voice call', 'End the voice call'], 'button: label')
  eq([{ tagName: 'TEXTAREA' }, { tagName: 'input' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }, { tagName: 'BUTTON' }, { tagName: 'DIV' }, null].map(ui.isTypingTarget), [true, true, true, true, false, false, false], 'typing target: text fields keep their Space')
  const el = (tagName, attrs = {}, own = false, editable = false) => ({ tagName, isContentEditable: editable, getAttribute: name => attrs[name] ?? null, closest: () => (own ? {} : null) })
  eq([el('TEXTAREA'), el('INPUT'), el('SELECT'), el('DIV', {}, false, true), el('BUTTON'), el('A'), el('SUMMARY'), el('DIV', { role: 'menuitem' }), el('DIV', { role: 'tab' }), el('SPAN', { role: 'checkbox' }), el('DIV'), el('BODY'), el('SPAN'), null, undefined].map(ui.spaceBelongsToTarget),
    [true, true, true, true, true, true, true, true, true, true, false, false, false, false, false], 'space: a text field and every other control that Space activates keep their Space; the page itself does not')
  eq([ui.spaceBelongsToTarget(el('BUTTON', {}, true)), ui.spaceBelongsToTarget(el('SPAN', { role: 'button' }, true))], [false, false], 'space: ...except the call\'s own button and the talk button: Space talks there (focus stays on the call button after it is pressed)')
  eq([{ code: 'Space' }, { key: ' ' }, { code: 'Space', repeat: true }, { code: 'Space', metaKey: true }, { code: 'Space', ctrlKey: true }, { code: 'Space', altKey: true }, { code: 'Space', shiftKey: true }, { code: 'KeyA' }].map(ui.isTalkKey), [true, true, false, false, false, false, false, false], 'talk key: Space alone, not a repeat')
  eq(['not_connected', 'limit', 'failed', 'too_short', 'no_words', 'not_sent', 'no_answer'].every(problem => ui.describeSpeechProblem(problem).title && ui.describeSpeechProblem(problem).steps.length > 0), true, 'words: every speech problem has a title and a step')
  eq(ui.describeSpeechProblem('not_connected').title, "Speech isn't connected yet", 'words: the honest one for a missing router')
  eq([ui.progressCaption('Building slide 3', 'working'), ui.progressCaption('Building slide 3', 'idle'), ui.progressCaption(null, 'working'), ui.progressCaption('  ', 'working'), ui.progressCaption('Researching', 'thinking')], ['Building slide 3', null, null, null, 'Researching'], 'progress caption: under the disc while Director works or thinks')
  const long = 'Researching the market for each of the six slides in detail and checking every source again'
  ok(ui.progressCaption(long, 'working').endsWith('…') && ui.progressCaption(long, 'working').length <= 81 && !ui.progressCaption(long, 'working').slice(0, -1).endsWith(' '), 'progress caption: cut at a word')
}

// ============================================================================================================================================
// A2. The router seam
// ============================================================================================================================================
async function routerSuite(over = {}) {
  const mod = makeHost({ over }).load(ROUTER)
  const calls = []
  const reply = (status, body, blob, headers = {}) => async (url, init) => { calls.push({ url, init }); return { ok: status >= 200 && status < 300, status, headers: { get: name => headers[name] ?? null }, json: async () => body, blob: async () => blob ?? new Blob(['audio']) } }
  class Form { constructor() { this.fields = [] } append(name, value, filename) { this.fields.push([name, value, filename]) } }
  const port = fetchImpl => mod.createVoiceRouterPort(fetchImpl, Form)
  mod.createVoiceRouterPort(async () => { throw new Error('nothing may be requested by creating the port') }, Form)
  eq([mod.VOICE_ROUTER_LABELS, mod.VOICE_ROUTER_ENDPOINTS, mod.VOICE_COST_HEADER], [{ stt: 'studio.voice_stt', tts: 'studio.voice_tts' }, { transcribe: '/api/studio/voice/transcribe', speak: '/api/studio/voice/speak' }, 'X-Deckster-Cost-Usd'], 'router: the labels, the same-origin routes and the optional cost header')
  eq(await port(reply(200, { text: ' hello there ' })).transcribe(new Blob(['x'])), { text: 'hello there', costUsd: null }, 'router: transcribe answers the words, trimmed, with no cost when the answer says none')
  eq([calls[0].url, calls[0].init.method, calls[0].init.credentials, calls[0].init.body.fields.map(f => f[0] + '=' + (typeof f[1] === 'string' ? f[1] : 'blob')), calls[0].init.body.fields[0][2]], ['/api/studio/voice/transcribe', 'POST', 'same-origin', ['audio=blob', 'label=studio.voice_stt'], 'turn.wav'], 'router: a multipart POST with the WAV (turn.wav) and the stt label')
  eq((await port(reply(200, {})).transcribe(new Blob(['x']))).text, '', 'router: no text is "no words", not an error'); eq((await port(reply(200, null)).transcribe(new Blob(['x']))).text, '', 'router: a null body is "no words"')
  eq([(await port(reply(200, { text: 'a' }, null, { 'X-Deckster-Cost-Usd': '0.0021' })).transcribe(new Blob(['x']))).costUsd, (await port(reply(200, { text: 'a' }, null, { 'X-Deckster-Cost-Usd': '0' })).transcribe(new Blob(['x']))).costUsd, (await port(reply(200, null, new Blob(['v']), { 'X-Deckster-Cost-Usd': '0.004' })).speak('x')).costUsd], [0.0021, 0, 0.004], 'router: the cost an answer says it had, zero included')
  eq([null, undefined, '', '  ', 'free', '-1', 'NaN', 'Infinity', '0.5', ' 2 '].map(mod.costFromHeader), [null, null, null, null, null, null, null, null, 0.5, 2], 'router: a missing or bad cost is unknown (null), never zero')
  const heardBack = await port(reply(200, null, new Blob(['voice']))).speak('One sentence.'), spoken = heardBack.audio
  eq([heardBack.costUsd, spoken.size, calls.at(-1).url, calls.at(-1).init.method, JSON.parse(calls.at(-1).init.body), calls.at(-1).init.headers], [null, 5, '/api/studio/voice/speak', 'POST', { text: 'One sentence.', label: 'studio.voice_tts' }, { 'Content-Type': 'application/json' }], 'router: speak POSTs the sentence with the tts label and answers the audio')
  for (const [status, kind] of [[404, 'not_connected'], [501, 'not_connected'], [503, 'not_connected'], [402, 'limit'], [429, 'limit'], [500, 'failed'], [400, 'failed'], [401, 'failed']]) {
    eq(mod.routerErrorKind(status), kind, `router: status ${status} is ${kind}`)
    const error = await port(reply(status, {})).transcribe(new Blob(['x'])).catch(e => e)
    eq([error instanceof mod.VoiceRouterError, error.kind], [true, kind], `router: transcribe ${status} throws ${kind}`)
    const error2 = await port(reply(status, {})).speak('x').catch(e => e)
    eq([error2 instanceof mod.VoiceRouterError, error2.kind], [true, kind], `router: speak ${status} throws ${kind}`)
  }
  const down = await port(async () => { throw new TypeError('Failed to fetch') }).speak('x').catch(e => e)
  eq(down.kind, 'not_connected', 'router: an unreachable route is "not connected"')
  const ctl = new AbortController(); ctl.abort()
  const aborted = await port(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }) }).transcribe(new Blob(['x']), { signal: ctl.signal }).catch(e => e)
  eq(aborted.kind, 'aborted', 'router: a cancelled request is "aborted"')
  eq((await port(async () => { throw new Error('boom') }).transcribe(new Blob(['x']), { signal: ctl.signal }).catch(e => e)).kind, 'aborted', 'router: any failure after an abort is "aborted"')
  eq(calls.every(call => call.url.startsWith('/api/')), true, 'router: only same-origin /api routes')
}

// ============================================================================================================================================
// B. The controller against the real core
// ============================================================================================================================================
class Clock {
  constructor() { this.t = 100000; this.timers = new Map(); this.id = 1 }
  now() { return this.t }
  set(fn, ms) { const id = this.id++; this.timers.set(id, { id, fn, at: this.t + ms }); return id }
  clear(id) { this.timers.delete(id) }
  pending() { return this.timers.size }
  async advance(ms) {
    const target = this.t + ms
    for (;;) {
      const next = [...this.timers.values()].filter(timer => timer.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0]
      if (!next) break
      this.timers.delete(next.id); this.t = Math.max(this.t, next.at); next.fn(); await settle()
    }
    this.t = target
    await settle()
  }
}
function makeCall({ over = {}, mic = {}, reduced = false, connected = true, sendObserved = true, takes = true, transcripts = ['make the title shorter'], speakFails = null, transcribeFails = null, costs = {} } = {}) {
  const host = makeHost({ env: ENV_ON, over })
  const ctlMod = host.load(CTL), ui = host.load(UI), router = host.load(ROUTER), core = host.load('lib/studio/voice/index.ts')
  const clock = new Clock()
  const log = { primed: [], micOpened: 0, micClosed: 0, recordings: [], cancelled: 0, plays: [], stops: 0, transcribed: [], spoken: [], sent: [], wire: [], actions: [], aborted: 0, errors: [] }
  const player = { level: 0.3, play(blob, hooks) { log.plays.push({ blob, hooks }) }, stop() { log.stops++ }, getLevel() { return this.level } }
  const recordingSpec = { durationMs: 1200, peak: 0.2, ...mic.recording }
  const env = {
    secureContext: () => mic.insecure !== true, hasMic: () => mic.unsupported !== true,
    openMic: async () => {
      if (mic.error) throw Object.assign(new Error('x'), { name: mic.error })
      if (mic.deferred) await mic.deferred
      log.micOpened++
      return { record: () => { const rec = { stopped: false, stop: async () => { rec.stopped = true; return { blob: new Blob(['audio']), durationMs: recordingSpec.durationMs, peak: recordingSpec.peak } }, cancel: () => { log.cancelled++ } }; log.recordings.push(rec); return rec }, close: () => { log.micClosed++ } }
    },
    createPlayer: () => ({ play: (blob, hooks) => player.play(blob, hooks), stop: () => player.stop(), level: () => player.getLevel(), prime: () => { log.primed.push(log.micOpened) } }),
    now: () => clock.now(), setTimer: (fn, ms) => clock.set(fn, ms), clearTimer: id => clock.clear(id), reducedMotion: () => reduced, macApp: () => false, mac: () => false,
  }
  const queue = [...transcripts]
  const port = {
    transcribe: async (blob, opts) => { log.transcribed.push({ size: blob.size, signal: opts?.signal }); if (transcribeFails) throw new router.VoiceRouterError(transcribeFails, 'x'); return { text: queue.length ? queue.shift() : '', costUsd: costs.stt ?? null } },
    speak: async (text, opts) => { log.spoken.push(text); if (opts?.signal?.aborted) throw new router.VoiceRouterError('aborted', 'x'); if (speakFails) throw new router.VoiceRouterError(speakFails, 'x'); return { audio: new Blob([text]), costUsd: costs.tts ?? null } },
  }
  const state = { connected }
  let ctl = null
  const sendTurn = async text => {
    // What the page's send and the socket hook do with the bus: the user_message is built, the voice fields are applied, and the "sent" tap runs.
    const data = { text, client_caps: ['mdc1'] }
    if (takes) ui.addVoiceCallFields(data, text) // (a page that bails before it builds the message never takes the armed turn)
    log.wire.push(data)
    log.sent.push(text)
    if (sendObserved && data.mode === 'voice') ctl.onSent(text)
  }
  const sendAction = async (action, messageId) => {
    // The page's own click on a card's button (handleActionClick) with the armed words: the button's label and value, and the voice fields from the socket hook.
    const data = { text: action.label, action_value: action.value, action_label: action.label, client_caps: ['mdc1'] }
    if (takes) ui.addVoiceCallFields(data, action.label)
    log.wire.push(data); log.actions.push({ action, messageId })
    if (sendObserved && data.mode === 'voice') ctl.onSent(action.label)
  }
  ctl = new ctlMod.VoiceCallController({ env, port, sendTurn, sendAction, isConnected: () => state.connected })
  const world = {
    ctl, ui, env, clock, log, player, state, ctlMod, core,
    snap: () => ctl.getSnapshot(),
    start: async () => { await ctl.startCall(); await settle() },
    talk: async (ms = 1250) => { ctl.pttDown(); await settle(); await clock.advance(ms); await ctl.pttUp(); await settle() },
    frame: async (type, payload = {}, id = null) => { ctl.onFrame(frame(type, payload, id)); await settle() },
    // the reply's first line is held REPLY_LEAD_MS so the gesture is seen first: by default the clock runs past it
    reply: async (spoken, text = 'Done. The title is shorter.', extra = {}, lead = true) => { await world.frame('chat_message', { text, ephemeral: false, ...(spoken === undefined ? {} : { spoken }), ...extra }); if (lead) await clock.advance(750) },
    // the speaker: start the n-th clip, finish it
    playStart: async n => { log.plays[n].hooks.onStart(); await settle() },
    playEnd: async n => { log.plays[n].hooks.onEnd(); await settle() },
  }
  return world
}

async function controllerSuite(over = {}) {
  // ---- the microphone is asked for by the call and by nothing else -------------------------------------------------------------------------
  {
    const w = makeCall({ over })
    eq([w.log.micOpened, w.snap().active, w.snap().starting], [0, false, false], 'call: building the controller asks for nothing')
    eq([w.clock.pending(), w.log.plays.length], [0, 0], 'call: ...and starts no timer')
    await w.frame('chat_message', { text: 'x', spoken: 'Hello.' }); await w.frame('build_phase', { phase: 'building' })
    eq([w.log.micOpened, w.log.spoken.length, w.snap().scene], [0, 0, 'idle'], 'call: frames before a call are ignored (nothing is spoken, nothing moves)')
    w.ctl.pttDown(); await settle()
    eq([w.snap().phase, w.log.recordings.length], ['idle', 0], 'call: talking before the call starts does nothing')
    await w.start()
    eq([w.log.micOpened, w.snap().active, w.snap().chip, w.snap().scene, w.snap().controls.talk], [1, true, 'Your turn', 'idle', true], 'call: the call button asks for the microphone once, and it is the user\'s turn')
    eq(w.log.primed, [0], 'call: the speaker is unlocked inside the click, before the microphone is granted')
    ok(w.clock.pending() > 0, 'call: a call has one tick timer')
    await w.start(); eq(w.log.micOpened, 1, 'call: starting again does not ask again')
    w.ctl.endCall(); await settle()
    eq([w.snap().active, w.log.micClosed, w.clock.pending()], [false, 1, 0], 'call: End releases the microphone and leaves no timer')
    w.ctl.endCall(); eq(w.log.micClosed, 1, 'call: ending twice releases once')
    w.ctl.onFrame(frame('chat_message', { text: 'x', spoken: 'Hi.' })); await settle(); eq(w.log.spoken.length, 0, 'call: a frame after the call is ignored')
  }
  for (const [error, title, kind] of [['NotAllowedError', 'Your browser blocked the microphone', 'denied'], ['PermissionDeniedError', 'Your browser blocked the microphone', 'denied'], ['NotFoundError', 'No microphone found', 'not_found'], ['NotReadableError', 'The microphone is busy', 'in_use'], ['SomethingElse', "Couldn't start the microphone", 'unknown']]) {
    const w = makeCall({ over, mic: { error } })
    await w.start()
    eq([w.snap().active, w.snap().starting, w.snap().notice?.title, w.snap().notice?.kind, w.snap().notice?.retry, w.snap().notice?.steps.length > 0, w.log.micOpened], [false, false, title, 'mic', true, true, 0], `mic: ${error} says why, in the core's words, with Try again`)
  }
  for (const [mic, title] of [[{ insecure: true }, 'Calls need a secure address'], [{ unsupported: true }, "This browser can't record audio"]]) {
    const w = makeCall({ over, mic }); await w.start()
    eq([w.snap().notice?.title, w.log.micOpened, w.snap().active], [title, 0, false], `mic: ${title} (the microphone is not asked for)`)
  }
  {
    const w = makeCall({ over, mic: { error: 'NotAllowedError' } }); await w.start(); w.ctl.dismissNotice(); eq(w.snap().notice, null, 'mic: the notice is dismissed')
    const retry = makeCall({ over }); await retry.start(); eq(retry.snap().active, true, 'mic: Try again is just starting again')
  }
  {
    let grant; const deferred = new Promise(resolve => { grant = resolve })
    const w = makeCall({ over, mic: { deferred } })
    const pending = w.ctl.startCall(); await settle()
    eq([w.snap().starting, w.snap().active, w.snap().controls], [true, false, { talk: false, stop: false, end: false, expand: false }], 'mic: while the browser asks, the call is starting and nothing is live')
    w.ctl.endCall(); grant(); await pending; await settle()
    eq([w.snap().active, w.log.micClosed, w.snap().starting], [false, 1, false], 'mic: a microphone granted after the call was ended is released at once')
  }

  // ---- push to talk, and the voice turn --------------------------------------------------------------------------------------------------------
  {
    const w = makeCall({ over }); await w.start()
    w.ctl.pttDown(); await settle()
    eq([w.snap().phase, w.snap().chip, w.snap().scene, w.snap().holding, w.log.recordings.length], ['listening', 'Listening', 'listening', true, 1], 'ptt: holding listens and records')
    w.ctl.pttDown(); eq(w.log.recordings.length, 1, 'ptt: a second press while held records nothing more')
    await w.clock.advance(1200); await w.ctl.pttUp(); await settle()
    eq([w.snap().phase, w.snap().chip, w.snap().holding, w.log.transcribed.length, w.log.sent, w.snap().scene], ['thinking', 'Thinking', false, 1, ['make the title shorter'], 'thinking'], 'ptt: letting go sends the recording to the router and the words to the page\'s send; the turn is thinking')
    eq(w.log.wire[0], { text: 'make the title shorter', client_caps: ['mdc1', 'voice1'], mode: 'voice' }, 'turn: the user_message is the transcript with mode "voice" and the cap voice1')
    eq(w.ui.voiceCallBus.pending, null, 'turn: nothing stays armed')
    w.ctl.pttDown(); await settle(); await w.clock.advance(1000); await w.ctl.pttUp(); await settle()
    ok(w.snap().notice?.title === "I didn't catch any words" || w.snap().phase === 'thinking', 'ptt: a second press talks over the pending turn')
  }
  {
    const w = makeCall({ over, mic: { recording: { durationMs: 200 } } }); await w.start(); await w.talk(200)
    eq([w.snap().phase, w.log.transcribed.length, w.snap().notice?.title, w.log.cancelled], ['idle', 0, 'That was too short', 0], 'ptt: a tap is too short: nothing is sent and the user is told')
    const silent = makeCall({ over, mic: { recording: { peak: 0.001 } } }); await silent.start(); await silent.talk()
    eq([silent.snap().phase, silent.log.transcribed.length, silent.snap().notice?.title], ['idle', 0, "I didn't catch any words"], 'ptt: a silent recording is not sent')
    const empty = makeCall({ over, transcripts: [''] }); await empty.start(); await empty.talk()
    eq([empty.snap().phase, empty.log.sent.length, empty.snap().notice?.title], ['idle', 0, "I didn't catch any words"], 'ptt: no words heard: no message, the turn ends')
    const off = makeCall({ over, connected: false }); await off.start(); off.ctl.pttDown(); await settle()
    eq([off.snap().phase, off.snap().controls.talk, off.log.recordings.length], ['idle', false, 0], 'ptt: no talking without a socket')
    const bail = makeCall({ over, takes: false, sendObserved: false }); await bail.start(); await bail.talk()
    eq([bail.ui.voiceCallBus.pending, bail.snap().phase], [null, 'idle'], 'turn: a send that never built the message leaves nothing armed (a later typed message with the same words is not a voice turn)')
    const notSent = makeCall({ over, sendObserved: false }); await notSent.start(); await notSent.talk()
    eq([notSent.snap().phase, notSent.snap().notice?.title, notSent.ui.voiceCallBus.pending], ['idle', "That didn't reach the Director", null], 'turn: words the socket never took are told to the user, and the turn ends, disarmed')
    for (const [kind, title] of [['not_connected', "Speech isn't connected yet"], ['limit', 'Voice is paused for now'], ['failed', "Couldn't hear that"]]) {
      const bad = makeCall({ over, transcribeFails: kind }); await bad.start(); await bad.talk()
      eq([bad.snap().phase, bad.snap().notice?.title, bad.log.sent.length, bad.snap().active], ['idle', title, 0, true], `turn: a router that says ${kind} gets "${title}"; the call stays up for typing`)
    }
    const aborted = makeCall({ over, transcribeFails: 'aborted' }); await aborted.start(); await aborted.talk()
    eq([aborted.snap().notice, aborted.snap().phase], [null, 'thinking'], 'turn: an aborted transcription says nothing')
  }

  // ---- the reply: only payload.spoken is said -----------------------------------------------------------------------------------------------
  {
    const w = makeCall({ over }); await w.start(); await w.talk()
    const line = 'Sure. I shortened the title on slide two. Anything else you would like me to change?'
    const chunks = w.core.splitSentences(line)
    ok(chunks.length >= 2, 'reply: the core splits this line into more than one chunk')
    await w.reply(line)
    eq(w.log.spoken, chunks, 'reply: the spoken line, chunk by chunk (the core\'s sentence chunker), through the router (nothing from the chat text)')
    eq([w.snap().phase, w.snap().caption], ['thinking', line], 'reply: the line is the caption; the audio has not started')
    await w.playStart(0)
    eq([w.snap().phase, w.snap().chip, w.snap().scene, w.snap().controls.stop], ['speaking', 'Speaking', 'speaking', true], 'reply: the first chunk starts: speaking')
    eq(w.ctl.getLevel(), 0.3, 'reply: the mouth reads the speaker\'s level')
    for (let i = 0; i < chunks.length - 1; i++) { await w.playEnd(i); eq(w.snap().phase, 'speaking', 'reply: between chunks it is still speaking'); await w.playStart(i + 1) }
    eq(w.ctl.getLevel(), 0.3, 'reply: ...and the last one'); await w.playEnd(chunks.length - 1)
    eq([w.snap().phase, w.snap().chip, w.ctl.getLevel()], ['idle', 'Your turn', 0], 'reply: the last chunk ends: your turn, the mouth shut')
    ok(w.snap().caption !== null, 'reply: the caption stays a moment'); await w.clock.advance(8500); eq(w.snap().caption, null, 'reply: ...then clears')
  }
  {
    const w = makeCall({ over }); await w.start(); await w.talk()
    await w.reply(undefined, 'A long reply with **markdown** and a list.\n- one\n- two')
    eq([w.log.spoken, w.snap().phase, w.snap().caption], [[], 'idle', null], 'reply: no spoken line, nothing is said (nothing is made up from the text), and the turn ends')
    const blank = makeCall({ over }); await blank.start(); await blank.talk(); await blank.reply('   ')
    eq([blank.log.spoken, blank.snap().phase], [[], 'idle'], 'reply: a blank line is nothing')
    const over300 = makeCall({ over }); await over300.start(); await over300.talk(); await over300.reply('A'.repeat(310))
    eq([over300.log.spoken, over300.snap().phase], [[], 'idle'], 'reply: a line over its cap is not said')
    const eph = makeCall({ over }); await eph.start(); await eph.talk(); await eph.frame('chat_message', { text: 'Preparing...', ephemeral: true, spoken: 'Preparing.' })
    eq([eph.log.spoken, eph.snap().phase], [[], 'thinking'], 'reply: a progress bubble is not the reply')
  }
  {
    const w = makeCall({ over }); await w.start()
    await w.reply('Your deck is ready. Take a look.', 'Your deck is ready.')
    eq([w.log.spoken, w.snap().phase, w.snap().scene], [w.core.splitSentences('Your deck is ready. Take a look.'), 'thinking', 'reporting'], 'report: a report with no turn of its own is said all the same (the Director builds while you talk)')
    await w.playStart(0); eq(w.snap().phase, 'speaking', 'report: ...as a turn of its own'); for (let i = 0; i < w.log.spoken.length; i++) { if (i) await w.playStart(i); await w.playEnd(i) }; eq(w.snap().phase, 'idle', 'report: ...which ends')
    const nothing = makeCall({ over }); await nothing.start(); await nothing.reply(undefined, 'Your deck is ready.')
    eq([nothing.log.spoken, nothing.snap().phase, nothing.snap().scene], [[], 'idle', 'reporting'], 'report: a report with no line is a pose and a chat message, no speech')
    const dup = makeCall({ over }); await dup.start(); await dup.frame('chat_message', { text: 'x', spoken: 'Once.' }, 'same-id'); await dup.frame('chat_message', { text: 'x', spoken: 'Once.' }, 'same-id')
    eq(dup.log.spoken, ['Once.'], 'report: a frame seen twice (same message_id) is said once')
  }
  {
    const w = makeCall({ over }); await w.start(); await w.talk()
    w.ctl.pttDown(); await settle()
    await w.reply('You will not hear this.')
    eq([w.log.spoken, w.snap().phase], [[], 'listening'], 'floor: while the user is talking nothing talks over them')
    const idle = makeCall({ over }); await idle.start(); idle.ctl.pttDown(); await settle(); await idle.reply('A report while you talk.'); await idle.frame('build_phase', { phase: 'building', spoken: 'Building.' })
    eq([idle.log.spoken, idle.snap().phase], [[], 'listening'], 'floor: ...and a report or a progress line that arrives with no turn pending waits for you too')
  }
  {
    const w = makeCall({ over, speakFails: 'not_connected', transcripts: ['one', 'two'] }); await w.start(); await w.talk()
    await w.reply('First line. Second line.')
    eq([w.snap().notice?.title, w.snap().phase], ["Speech isn't connected yet", 'idle'], 'reply: speech not connected: said plainly, once, and the turn ends (the reply is in the chat)')
    ok(w.log.spoken.length >= 1, 'reply: ...after one attempt'); const asked = w.log.spoken.length
    await w.talk(); await w.reply('Another line.')
    eq(w.log.spoken.length, asked, 'reply: ...and the router is not asked again for the rest of the call')
  }

  // ---- what the call costs (the core's meter; an answer that does not say is unknown, never zero) -------------------------------------------------------------
  {
    const w = makeCall({ over, costs: { stt: 0.002, tts: 0.001 } }); await w.start(); await w.talk(); await w.reply('One short line.')
    const cost = w.ctl.getCost()
    eq([Math.round(cost.totalUsd * 1e6), cost.unknownCount], [Math.round((0.002 + 0.001 * w.log.spoken.length) * 1e6), 0], 'cost: the hearing and every sentence add what their answers said')
    const unknown = makeCall({ over }); await unknown.start(); await unknown.talk(); await unknown.reply('One short line.')
    eq([unknown.ctl.getCost().totalUsd, unknown.ctl.getCost().unknownCount], [0, 1 + unknown.log.spoken.length], 'cost: answers that do not say are counted as unknown, and the known total stays zero (never a guess)')
    ok(typeof unknown.ctl.getCost().label === 'string' && unknown.ctl.getCost().label.length > 0, 'cost: the core words it')
    w.ctl.endCall(); await w.start(); eq([w.ctl.getCost().totalUsd, w.ctl.getCost().unknownCount], [0, 0], 'cost: a new call starts at nothing')
  }

  // ---- the gesture is seen before the voice, and again after it -------------------------------------------------------------------------------------
  {
    const w = makeCall({ over }); await w.start(); await w.talk()
    await w.reply('Sure, done.', 'Sure, done.', {}, false)
    eq([w.log.plays.length, w.snap().phase, w.snap().scene, w.snap().chip], [0, 'thinking', 'reporting', 'Your turn'], 'gesture: the reply has arrived: the character presents (not "thinking") and its first line is held for a moment')
    await w.clock.advance(250); eq(w.log.plays.length, 0, 'gesture: ...not yet at 0.25 s'); await w.clock.advance(500); eq(w.log.plays.length, 1, 'gesture: ...played at 0.5 s')
    await w.playStart(0); eq(w.snap().scene, 'speaking', 'gesture: then it talks'); await w.playEnd(0); await w.clock.advance(3000); eq(w.snap().scene, 'idle', 'gesture: a plain report is not shown again after it is said')
    const sorry = makeCall({ over }); await sorry.start(); await sorry.talk()
    await sorry.reply("I can't translate the deck yet.", "I can't translate the deck yet.", { companion_state: 'reporting' }, false)
    eq(sorry.snap().scene, 'sorry', 'gesture: an honest decline: sorry (a shrug) before the voice')
    await sorry.clock.advance(750); await sorry.playStart(0); eq(sorry.snap().scene, 'speaking', 'gesture: ...then it speaks'); await sorry.clock.advance(5000); await sorry.playEnd(0)
    eq(sorry.snap().scene, 'sorry', 'gesture: ...and the shrug is seen again once the speech is over (speech had hidden it)')
    await sorry.clock.advance(4000); eq(sorry.snap().scene, 'idle', 'gesture: ...and then it is over')
    const party = makeCall({ over }); await party.start(); await party.reply('Your deck is ready.', 'Your deck is ready.'); await party.frame('build_phase', { phase: 'complete', label: 'Your deck is ready', companion_state: 'pleased' })
    await party.playStart(0); eq(party.snap().scene, 'speaking', 'gesture: the report is said'); await party.playEnd(0)
    eq(party.snap().scene, 'celebrating', 'gesture: the celebration (build complete) comes after the speech that hid it')
  }

  // ---- talk-over and Stop ----------------------------------------------------------------------------------------------------------------------
  {
    const w = makeCall({ over }); await w.start(); await w.talk(); await w.reply('One. Two. Three.'); await w.playStart(0)
    eq(w.snap().phase, 'speaking', 'talk-over: speaking')
    w.ctl.pttDown(); await settle()
    eq([w.snap().phase, w.log.stops >= 1, w.log.recordings.length, w.ctl.getLevel()], ['listening', true, 2, 0], 'talk-over: pressing talk stops the speaker, drops the queue and starts a new recording')
    await w.playEnd(0); eq(w.snap().phase, 'listening', 'talk-over: a late "ended" of the cancelled clip changes nothing')
  }
  {
    const w = makeCall({ over }); await w.start(); await w.talk()
    w.ctl.stop(); await settle()
    eq([w.snap().phase, w.snap().controls.stop], ['idle', false], 'stop: a waiting turn is stopped')
    await w.reply('Late answer.'); eq([w.log.spoken, w.snap().phase], [[], 'idle'], 'stop: the late reply to a stopped turn is not said (it is in the chat)')
    await w.reply('A later, unasked report.'); eq(w.log.spoken, ['A later, unasked report.'], 'stop: ...and only that one is skipped')
  }
  {
    const w = makeCall({ over }); await w.start(); await w.talk(); await w.reply('One. Two.'); await w.playStart(0)
    w.ctl.stop(); await settle()
    eq([w.snap().phase, w.log.stops >= 1, w.snap().scene !== 'speaking', w.ctl.getLevel()], ['idle', true, true, 0], 'stop: speech is stopped at once, the mouth shut')
    await w.playEnd(0); eq(w.snap().phase, 'idle', 'stop: ...and a late end of the clip changes nothing')
  }

  // ---- the filler -----------------------------------------------------------------------------------------------------------------------------
  {
    const w = makeCall({ over }); await w.start(); await w.talk()
    await w.clock.advance(1000); eq(w.log.spoken, [], 'filler: not before 1.2 s')
    await w.clock.advance(400); eq(w.log.spoken.length, 1, 'filler: one short line after 1.2 s of waiting'); ok(w.log.spoken[0].length < 40, 'filler: a short one')
    eq(w.snap().phase, 'thinking', 'filler: the turn is still thinking while it is said')
    await w.playStart(0); eq([w.snap().phase, w.snap().scene, w.snap().chip, w.snap().caption], ['thinking', 'speaking', 'Speaking', w.log.spoken[0]], 'filler: the character speaks it (the reducer is not moved), and its words are the caption'); await w.playEnd(0)
    eq(w.snap().scene, 'thinking', 'filler: ...then is thinking again, not stuck speaking')
    await w.clock.advance(5000); eq(w.log.spoken.length, 1, 'filler: once per turn')
    const early = makeCall({ over }); await early.start(); await early.talk(); await early.reply('Quick answer.'); await early.clock.advance(3000)
    eq(early.log.spoken, ['Quick answer.'], 'filler: never after the reply has arrived')
    const bubble = makeCall({ over }); await bubble.start(); await bubble.talk(); await bubble.frame('chat_message', { text: 'Reviewing your topic…', ephemeral: true }); await bubble.clock.advance(3000)
    eq(bubble.log.spoken, [], 'filler: never once any text of the reply (even a progress bubble) has arrived')
    const reduced = makeCall({ over, reduced: true }); await reduced.start(); await reduced.talk(); await reduced.clock.advance(750)
    eq(reduced.log.spoken.length, 0, 'filler: with reduced motion not before 0.9 s'); await reduced.clock.advance(250)
    eq(reduced.log.spoken.length, 1, 'filler: ...but a little sooner than 1.2 s (the tick at 1.0 s)')
  }

  // ---- progress lines: the Director sends a line for most progress frames; the client decides which are worth saying (a status after 4 s of quiet, one every 6 s, only the newest) -------
  {
    const w = makeCall({ over }); await w.start()
    await w.frame('build_phase', { phase: 'building', label: 'Building your slides…', spoken: 'Building your slides' })
    eq([w.log.spoken, w.snap().scene, w.snap().progress], [[], 'working', 'Building your slides…'], 'progress: a line is not said at once (the label is shown under the disc)')
    await w.clock.advance(3000); eq(w.log.spoken, [], 'progress: ...nor before 4 s of quiet')
    await w.clock.advance(1250); eq(w.log.spoken, ['Building your slides'], 'progress: ...after 4 s of quiet it is said')
    await w.playStart(0); eq([w.snap().phase, w.snap().chip], ['speaking', 'Speaking'], 'progress: said as a turn of Director\'s own'); await w.playEnd(0); eq(w.snap().phase, 'idle', 'progress: ...which ends')
    await w.frame('build_event', { scope: 'deck', text: 'Checking layouts', status: 'progress', spoken: 'Checking the layouts' })
    await w.clock.advance(5000); eq(w.log.spoken.length, 1, 'progress: the next line waits for 4 s of quiet and 6 s since the last one')
    await w.clock.advance(2000); eq(w.log.spoken.at(-1), 'Checking the layouts', 'progress: ...then is said')
    await w.playStart(1); await w.playEnd(1)
    await w.frame('build_event', { scope: 'slide', text: 'Slide 3', status: 'progress', spoken: 'Slide three' }); await w.frame('build_phase', { phase: 'building', label: 'Still building' })
    await w.clock.advance(12000); eq(w.log.spoken.length, 2, 'progress: a slide-scope event, and a frame with no spoken line, say nothing aloud')
  }
  {
    const w = makeCall({ over }); await w.start()
    await w.frame('build_phase', { phase: 'building', spoken: 'First line' }); await w.clock.advance(1000); await w.frame('status_update', { status: 'generating', text: 'x', spoken: 'Second line' })
    await w.clock.advance(4500); eq(w.log.spoken, ['Second line'], 'progress: only the newest line waits: the first was never said')
    const stale = makeCall({ over, mic: { recording: { durationMs: 100 } } }); await stale.start(); stale.ctl.pttDown(); await settle()
    await stale.frame('build_phase', { phase: 'building', spoken: 'Hush' }); await stale.clock.advance(25000)
    eq(stale.log.spoken, [], 'progress: nothing is said while the user is talking')
    await stale.ctl.pttUp(); await settle(); await stale.clock.advance(8000); eq(stale.log.spoken, [], 'progress: ...and a line that waited more than 20 s is stale and dropped')
    const hush = makeCall({ over }); await hush.start(); await hush.talk(); await hush.frame('status_update', { status: 'generating', text: 'x', spoken: 'Researching' })
    await hush.clock.advance(1500); eq(hush.log.spoken.length, 1, 'progress: (the filler is what a waiting turn hears first)'); await hush.playStart(0); await hush.playEnd(0)
    await hush.clock.advance(4500)
    eq([hush.log.spoken.at(-1), hush.snap().phase], ['Researching', 'thinking'], 'progress: while a turn waits for its reply the line is said after the filler, and the turn stays thinking')
    await hush.playStart(1); eq([hush.snap().phase, hush.snap().scene], ['thinking', 'speaking'], 'progress: ...the character speaks it'); await hush.playEnd(1)
    await hush.reply('Done.'); await hush.playStart(2); eq(hush.snap().phase, 'speaking', 'progress: the reply after it is the turn\'s speech'); await hush.playEnd(2); eq(hush.snap().phase, 'idle', 'progress: ...and the turn ends')
    const over_ = makeCall({ over }); await over_.start()
    await over_.reply('A report.', 'x'); await over_.playStart(0)
    await over_.frame('build_phase', { phase: 'building', spoken: 'A progress line' }); await over_.clock.advance(9000)
    eq(over_.log.spoken, ['A report.'], 'progress: never over a line that is being said')
    await over_.playEnd(0); await over_.clock.advance(4500); eq(over_.log.spoken, ['A report.', 'A progress line'], 'progress: ...it waits its turn')
    const quiet = makeCall({ over, speakFails: 'not_connected' }); await quiet.start(); await quiet.frame('build_phase', { phase: 'building', spoken: 'A line' }); await quiet.clock.advance(5000); await quiet.frame('build_phase', { phase: 'building', spoken: 'Another line' }); await quiet.clock.advance(20000)
    eq(quiet.log.spoken.length, 1, 'progress: speech that is not connected is asked for once, not for every line')
  }

  // ---- a spoken answer to a card -----------------------------------------------------------------------------------------------------------------
  {
    const PLAN = [{ label: "Yes, let's build it!", value: 'accept_plan', primary: true, requires_input: false }, { label: "I'd like to make changes", value: 'reject_plan', primary: false, requires_input: false }]
    const w = makeCall({ over, transcripts: ['Yes, lets build it', 'yes'] }); await w.start()
    await w.frame('chat_message', { text: 'Here is the plan.', spoken: 'Here is my plan for the pitch.' }, 'plan-chat')
    await w.frame('action_request', { prompt_text: 'Does this structure work for you?', actions: PLAN, spoken: 'Does this structure work for you?' }, 'plan-card')
    eq(w.log.spoken.length >= 2 && w.log.spoken.join(' ').includes('Here is my plan') && w.log.spoken.at(-1).includes('Does this structure work'), true, 'card: the reply and then the card\'s question are both said, in order (a card\'s line right after a reply\'s)')
    eq(w.snap().scene, 'reporting', 'card: ...while the lines are fetched Director is reporting (a turn of its own, not a thinking one)')
    await w.clock.advance(750)
    for (let i = 0; i < w.log.plays.length; i++) { await w.playStart(i); await w.playEnd(i) }
    await w.clock.advance(3000)
    eq([w.snap().phase, w.snap().scene], ['idle', 'waiting'], 'card: a card is waiting for you')
    await w.talk()
    eq([w.log.actions.length, w.log.sent, w.log.actions[0]?.action.value, w.log.actions[0]?.messageId], [1, [], 'accept_plan', 'plan-card'], 'card: a spoken "yes" presses the plan card\'s own button (not a typed message), on that card')
    eq(w.log.wire[0], { text: "Yes, let's build it!", action_value: 'accept_plan', action_label: "Yes, let's build it!", client_caps: ['mdc1', 'voice1'], mode: 'voice' }, 'card: ...as the card\'s own text and action_value, with mode "voice" and the cap voice1')
    eq([w.snap().phase, w.ui.voiceCallBus.pending], ['thinking', null], 'card: the turn waits for Director like any other; nothing stays armed')
    await w.reply(undefined); w.ctl.pttDown(); await settle(); await w.clock.advance(1000); await w.ctl.pttUp(); await settle()
    eq(w.log.actions.length, 1, 'card: the card is answered once: a second "yes" is not a click')
  }
  {
    const PLAN = [{ label: "Yes, let's build it!", value: 'accept_plan', primary: true, requires_input: false }, { label: "I'd like to make changes", value: 'reject_plan', primary: false, requires_input: false }]
    for (const [words, why] of [['yes but make it ten slides', 'more than a yes'], ['', 'nothing heard']]) {
      const w = makeCall({ over, transcripts: [words] }); await w.start(); await w.frame('action_request', { actions: PLAN, prompt_text: 'x', spoken: 'x' }, 'c1'); await w.talk()
      eq([w.log.actions.length, w.log.sent], [0, words ? [words] : []], `card: ${why}: no button, the words go as an ordinary voice message`)
      if (words) eq(w.log.wire[0].mode, 'voice', 'card: ...a voice turn')
    }
    const moved = makeCall({ over, transcripts: ['yes'] }); await moved.start(); await moved.frame('action_request', { actions: PLAN, prompt_text: 'x' }, 'c1'); await moved.frame('status_update', { status: 'thinking', text: 'x' }); await moved.talk()
    eq([moved.log.actions.length, moved.log.sent], [0, ['yes']], 'card: once Director has moved on (a new turn) the old card is not pressed')
    const finished = makeCall({ over, transcripts: ['yes'] }); await finished.start(); await finished.frame('action_request', { actions: PLAN, prompt_text: 'x' }, 'c1'); await finished.frame('build_phase', { phase: 'complete' }); await finished.talk()
    eq(finished.log.actions.length, 1, 'card: a finished build does not close the "what next?" card that arrives beside it')
    const replaced = makeCall({ over, transcripts: ['yes'] }); await replaced.start(); await replaced.frame('action_request', { actions: PLAN, prompt_text: 'x' }, 'old'); await replaced.frame('action_request', { actions: [{ label: 'Done, looks great!', value: 'complete_presentation', primary: true, requires_input: false }, { label: 'Make adjustments', value: 'request_adjustments', primary: false, requires_input: true }], prompt_text: 'y' }, 'new'); await replaced.talk()
    eq([replaced.log.actions[0]?.action.value, replaced.log.actions[0]?.messageId], ['complete_presentation', 'new'], 'card: the newest card is the open one')
    const none = makeCall({ over, transcripts: ['yes'] }); await none.start(); await none.frame('action_request', { actions: [], prompt_text: 'Who is in the room?', spoken: 'Who is in the room?' }, 'q'); await none.talk()
    eq([none.log.actions.length, none.log.sent], [0, ['yes']], 'card: questions with no buttons are answered by words')
    const failed = makeCall({ over, transcripts: ['yes'], sendObserved: false }); await failed.start(); await failed.frame('action_request', { actions: PLAN, prompt_text: 'x' }, 'c1'); await failed.talk()
    eq([failed.snap().phase, failed.snap().notice?.title, failed.ui.voiceCallBus.pending], ['idle', "That didn't reach the Director", null], 'card: a click the socket never took is told to the user')
    const first = makeCall({ over }); await first.start(); await first.talk(); await first.frame('action_request', { prompt_text: 'Who is in the room, and how many?', actions: [{ label: 'Skip', value: 'skip_questions', primary: false, requires_input: false }], spoken: 'Who is in the room, and how many people?' }, 'q1')
    ok(first.log.spoken.length >= 1 && first.snap().phase === 'thinking', 'card: the clarifying questions are the reply to the turn: said')
    await first.clock.advance(750); await first.playStart(0); eq(first.snap().phase, 'speaking', 'card: ...as the turn\'s speech')
  }

  // ---- the character's scene from Director's frames -----------------------------------------------------------------------------------------
  {
    const w = makeCall({ over }); await w.start()
    await w.frame('status_update', { status: 'thinking', text: 'Thinking…' }); eq([w.snap().scene, w.snap().chip], ['thinking', 'Thinking'], 'scene: a typed turn Director is thinking about')
    await w.frame('build_phase', { phase: 'building', label: 'Building your slides…' }); eq([w.snap().scene, w.snap().chip, w.snap().progress], ['working', 'Your turn', 'Building your slides…'], 'scene: working (your turn: you may talk), with what it is doing')
    await w.frame('build_event', { scope: 'deck', status: 'progress', text: 'Choosing layouts…' }); eq(w.snap().progress, 'Choosing layouts…', 'scene: the latest words')
    await w.frame('slide_built', { slide_index: 0 }); eq(w.snap().scene, 'pleased', 'scene: a slide built')
    await w.clock.advance(2500); eq(w.snap().scene, 'working', 'scene: ...then back to work')
    await w.frame('slide_failed', { job_id: 'j' }); eq(w.snap().scene, 'concerned', 'scene: a slide failed')
    await w.clock.advance(4800); eq(w.snap().scene, 'working', 'scene: ...and back')
    await w.frame('action_request', { prompt_text: 'Proceed?', actions: [] }); eq(w.snap().scene, 'waiting', 'scene: a question from Director is waiting for you')
    await w.frame('build_phase', { phase: 'complete', label: 'Your deck is ready' }); eq([w.snap().scene, w.snap().progress], ['celebrating', null], 'scene: the deck is done: the big pleased, and the old words go')
    await w.clock.advance(4300); eq(w.snap().scene, 'idle', 'scene: ...and rest')
    await w.frame('status_update', { status: 'thinking', text: 'Thinking…' }); eq([w.snap().scene, w.snap().progress], ['thinking', null], 'scene: the last build\'s words are not shown under a new turn')
    await w.frame('action_request', { prompt_text: 'Which theme?', actions: [] }); eq(w.snap().scene, 'waiting', 'scene: waiting for you')
    await w.frame('build_phase', { phase: 'paused' }); eq(w.snap().scene, 'paused', 'scene: paused')
    await w.frame('chat_message', { text: "I can't add a video.", companion_state: 'reporting' }); eq(w.snap().scene, 'sorry', 'scene: an honest decline is sorry')
    await w.frame('status_update', { status: 'idle', companion_state: 'working' }); await w.clock.advance(3900); eq(w.snap().scene, 'working', 'scene: the Director\'s own companion_state drives it')
    await w.frame('slide_update', {}); eq(w.snap().scene, 'working', 'scene: a frame that says nothing changes nothing')
  }
  {
    const w = makeCall({ over }); await w.start(); await w.talk(); await w.frame('build_phase', { phase: 'complete' })
    eq(w.snap().scene, 'thinking', 'scene: a pending turn is thinking whatever else happens (your turn\'s state wins over a beat)')
  }

  // ---- the turn that never gets an answer --------------------------------------------------------------------------------------------------
  {
    const w = makeCall({ over }); await w.start(); await w.talk()
    await w.clock.advance(60000); eq(w.snap().phase, 'thinking', 'timeout: a minute is not too long')
    await w.frame('build_phase', { phase: 'building' }); await w.clock.advance(60000)
    eq(w.snap().phase, 'thinking', 'timeout: any frame keeps the turn alive')
    await w.clock.advance(40000)
    eq([w.snap().phase, w.snap().notice?.title], ['idle', "The Director hasn't answered yet"], 'timeout: 90 s of nothing ends the turn, plainly')
  }

  // ---- tear-down ------------------------------------------------------------------------------------------------------------------------------
  {
    const w = makeCall({ over }); await w.start(); await w.talk(); await w.reply('One. Two.'); await w.playStart(0)
    w.ctl.pttDown(); await settle(); w.ctl.endCall(); await settle()
    eq([w.snap().active, w.log.micClosed, w.clock.pending(), w.log.cancelled >= 1, w.ui.voiceCallBus.pending], [false, 1, 0, true, null], 'end: the recording is dropped, the microphone released, no timer left, nothing armed')
    const d = makeCall({ over }); await d.start(); d.ctl.dispose(); await settle()
    eq([d.log.micClosed, d.clock.pending()], [1, 0], 'dispose: releases everything'); d.ctl.onFrame(frame('chat_message', { spoken: 'x' })); await d.ctl.startCall(); eq(d.log.micOpened, 1, 'dispose: a disposed controller does nothing more')
    const sub = makeCall({ over }); let seen = 0; const off = sub.ctl.subscribe(() => { seen++ }); await sub.start(); ok(seen > 0, 'snapshot: subscribers are told'); off(); const before = seen; sub.ctl.setExpanded(true); eq(seen, before, 'snapshot: an unsubscribed listener is not told')
    const same = sub.ctl.getSnapshot(); sub.ctl.tick(); eq(sub.ctl.getSnapshot() === same, true, 'snapshot: nothing changed, the same snapshot (no render)')
    sub.ctl.setExpanded(false); eq(sub.snap().expanded, false, 'snapshot: expanded toggles')
  }
}

// ============================================================================================================================================
// C. Components and the hook, offline
// ============================================================================================================================================
const noHint = ({ children }) => children
function componentStubs(host) {
  return { './voice-call.css': {}, '../studio-composer-hint': { StudioComposerHint: noHint }, './companion-player': host.load(PLAYER) }
}
async function dockSuite(over = {}) {
  const host = makeHost({ env: ENV_ON, over })
  const stubs = {}
  const dock = makeHost({ env: ENV_ON, over, stubs: { './companion-player': { CompanionPlayer: ({ pack, scene, framing, size, reducedMotion }) => React.createElement('div', { 'data-fake-player': 'true', 'data-pack': pack, 'data-scene': scene, 'data-framing': framing, 'data-size': size, 'data-reduced': String(reducedMotion) }) }, ...stubs } }).load(DOCK)
  const base = { active: true, starting: false, phase: 'idle', scene: 'idle', chip: 'Your turn', dance: false, caption: null, progress: null, notice: null, expanded: false, reducedMotion: false, holding: false, controls: { talk: true, stop: false, end: true, expand: true } }
  const calls = []
  const props = snapshot => ({ snapshot: { ...base, ...snapshot }, pack: 'bob', getLevel: () => 0, onTalkStart: () => calls.push('down'), onTalkEnd: () => calls.push('up'), onStop: () => calls.push('stop'), onEnd: () => calls.push('end'), onToggleExpanded: () => calls.push('expand'), onRetry: () => calls.push('retry'), onDismissNotice: () => calls.push('dismiss') })
  const html = snapshot => renderToStaticMarkup(React.createElement(dock.VoiceCallDock, props(snapshot)))
  const idle = html({})
  ok(idle.includes('data-studio-voice-call="dock"') && idle.includes('data-voice-chip="Your turn"') && idle.includes('data-studio-voice-caption="hint"') && idle.includes('data-voice-expanded="false"'), 'dock: idle: the chip, the hint and the disc')
  ok(idle.includes('data-framing="disc"') && idle.includes('data-size="88"') && idle.includes('data-pack="bob"'), 'dock: the player is the 88 px disc of the pack')
  ok(idle.includes('aria-label="Hold to talk"') && idle.includes('aria-label="Stop"') && idle.includes('aria-label="Bigger view"') && idle.includes('aria-label="End call"'), 'dock: the four controls are named')
  ok(/aria-label="Stop"[^>]*disabled|disabled=""[^>]*aria-label="Stop"/.test(idle) && !/aria-label="Hold to talk"[^>]*disabled/.test(idle) && !/disabled=""[^>]*aria-label="Hold to talk"/.test(idle), 'dock: Stop is off in your turn, the talk button is on')
  for (const [chip, scene] of [['Listening', 'listening'], ['Thinking', 'thinking'], ['Speaking', 'speaking']]) ok(html({ chip, scene }).includes(`data-voice-chip="${chip}"`) && html({ chip, scene }).includes(`>${chip}</span>`), `dock: the chip says ${chip}`)
  const speaking = html({ chip: 'Speaking', scene: 'speaking', phase: 'speaking', caption: 'Sure. I shortened the title.', controls: { talk: true, stop: true, end: true, expand: true } })
  ok(speaking.includes('Sure. I shortened the title.') && speaking.includes('data-studio-voice-caption="line"') && !speaking.includes('data-studio-voice-caption="hint"'), 'dock: speaking shows the line, not the hint')
  ok(html({ scene: 'working', progress: 'Building your slides…' }).includes('Building your slides…') && html({ scene: 'working', progress: 'Building your slides…' }).includes('data-studio-voice-progress'), 'dock: what the Director is doing sits under the disc')
  ok(html({ holding: true }).includes('Release to send') && html({ holding: true }).includes('aria-pressed="true"') && html({}).includes('>Hold to talk<'), 'dock: the talk button says what letting go does')
  const big = html({ expanded: true })
  ok(big.includes('data-voice-expanded="true"') && big.includes('data-framing="chest"') && big.includes('data-size="240"') && big.includes('aria-label="Smaller view"'), 'dock: expanded: the chest view, 240 px, and the way back')
  ok(html({ reducedMotion: true }).includes('data-reduced="true"'), 'dock: reduced motion is handed to the player')
  const noMic = html({ active: false, notice: { kind: 'mic', title: 'Your browser blocked the microphone', steps: ['Click the lock icon.', 'Then press Try again.'], retry: true }, controls: { talk: false, stop: false, end: false, expand: false } })
  ok(noMic.includes('role="alert"') && noMic.includes('Your browser blocked the microphone') && noMic.includes('Click the lock icon.') && noMic.includes('Try again</button>') && noMic.includes('aria-label="Dismiss"') && noMic.includes('data-studio-voice-notice="mic"'), 'dock: a refused microphone says why, what to do, with Try again and Dismiss')
  ok(!html({ notice: { kind: 'turn', title: 'That was too short', steps: ['Hold the button the whole time you speak.'], retry: false } }).includes('Try again'), 'dock: a notice that cannot be retried has no Try again')
  ok(html({ active: false, starting: true }).includes('Waiting for your microphone…'), 'dock: while the browser asks, it says so')
  ok(!html({ active: false }).includes('data-studio-voice-caption'), 'dock: no talking hint when no call is on')
  // a phone: the disc is 64 px (the media query is read in an effect, so the dock is run in the offline host)
  const { toElements } = mini
  const phoneDock = async matches => {
    globalThis.window = { matchMedia: () => ({ matches, addEventListener() {}, removeEventListener() {} }) }
    try {
      const Dock = dock.VoiceCallDock
      const rootNode = new Root(); rootNode.setElement(React.createElement(Dock, props({})))
      for (let i = 0; i < 20; i++) { await macro(); if (!rootNode.flush()) break }
      const out = renderToStaticMarkup(toElements(rootNode.tree)); rootNode.unmount(); return out
    } finally { delete globalThis.window }
  }
  const phoneHtml = await phoneDock(true), deskHtml = await phoneDock(false)
  ok(phoneHtml.includes('data-voice-phone="true"') && phoneHtml.includes('data-size="64"') && deskHtml.includes('data-voice-phone="false"') && deskHtml.includes('data-size="88"'), 'dock: a phone gets the 64 px disc, a desktop the 88 px one')
  // the button
  const button = makeHost({ env: ENV_ON, over, stubs: { '../studio-composer-hint': { StudioComposerHint: noHint } } }).load(BUTTON)
  const b = p => renderToStaticMarkup(React.createElement(button.VoiceCallButton, { active: false, busy: false, disabled: false, onClick: () => {}, studio: true, ...p }))
  ok(b({}).includes('aria-label="Start a voice call"') && b({}).includes('data-voice-active="false"') && b({}).includes('type="button"') && b({}).includes('aria-pressed="false"'), 'button: starts a call')
  ok(b({ active: true }).includes('aria-label="End the voice call"') && b({ active: true }).includes('data-voice-active="true"') && b({ active: true }).includes('aria-pressed="true"'), 'button: ends it')
  ok(/disabled=""/.test(b({ busy: true })) && /disabled=""/.test(b({ disabled: true })) && !/disabled=""/.test(b({})), 'button: off while the microphone is asked for')
  ok(!b({ studio: true }).includes('title=') && b({ studio: false }).includes('title="Start a voice call"'), 'button: a tooltip in the shell, a title elsewhere')
  // the player without a pack
  const player = makeHost({ env: ENV_ON, over }).load(PLAYER)
  const p = renderToStaticMarkup(React.createElement(player.CompanionPlayer, { pack: 'bob', scene: 'idle', dance: false, framing: 'disc', size: 88, reducedMotion: false, getLevel: () => 0 }))
  ok(p.includes('data-studio-voice-companion="loading"') && p.includes('>B<') && p.includes('width:88px') && p.includes('height:88px') && !p.includes('<canvas'), 'player: before the pack is read: a plain disc with initials, no canvas')
  ok(renderToStaticMarkup(React.createElement(player.CompanionPlayer, { pack: 'deckster-owl', scene: 'idle', dance: false, framing: 'chest', size: 240, reducedMotion: true, getLevel: () => 0 })).includes('>DO<'), 'player: initials of the pack\'s name')
  return host
}

async function hookSuite(over = {}) {
  const loads = []
  const mk = env => {
    const calls = { controllers: [] }
    const stubs = {
      'next/dynamic': () => () => null,
      '@/lib/studio-voice-call-controller': { VoiceCallController: class { constructor(o) { calls.controllers.push(o); this.subscribe = () => () => {}; this.getSnapshot = () => ({ active: false, starting: false, notice: null }); this.onFrame = () => {}; this.onSent = () => {}; this.dispose = () => { calls.disposed = true }; this.endCall = () => { calls.ended = (calls.ended ?? 0) + 1 }; this.getLevel = () => 0 } } },
      '@/lib/studio-voice-call-browser': { browserVoiceEnv: () => ({ marker: 'env' }), browserVoicePort: () => ({ marker: 'port' }) },
    }
    const host = makeHost({ env, over, stubs })
    return { calls, ui: host.load(UI), hook: host.load(HOOK) }
  }
  const listeners = []
  const win = { addEventListener: (type, fn) => listeners.push(['add', type, fn]), removeEventListener: (type, fn) => listeners.push(['remove', type, fn]) }
  globalThis.window = win
  const run = async (world, opts) => {
    let latest = null
    function Page() { latest = world.hook.useStudioVoiceCall({ ...opts }); return null }
    const rootNode = new Root(); rootNode.setElement(React.createElement(Page))
    for (let i = 0; i < 40; i++) { await macro(); if (!rootNode.flush()) break }
    return { rootNode, latest: () => latest, set: async patch => { Object.assign(opts, patch); rootNode.schedule(); for (let i = 0; i < 40; i++) { await macro(); if (!rootNode.flush()) break } } }
  }
  try {
    const off = mk({})
    const offRun = await run(off, { enabled: true, sendTurn: () => {}, sendAction: () => {}, sessionKey: 's1', connected: true })
    eq([offRun.latest().dock, offRun.latest().composerProps, off.calls.controllers.length, listeners.length, off.ui.voiceCallBus.frame, off.ui.voiceCallBus.sent], [null, null, 0, 0, null, null], 'hook: flag off: no dock, no button, no controller, no listener, nothing on the bus')
    offRun.rootNode.unmount()
    const shell = mk(ENV_ON)
    const shellOff = await run(shell, { enabled: false, sendTurn: () => {}, sessionKey: 's1', connected: true })
    eq([shellOff.latest().dock, shellOff.latest().composerProps, shell.calls.controllers.length, shell.ui.voiceCallBus.frame], [null, null, 0, null], 'hook: flag on but not the Studio shell: nothing')
    shellOff.rootNode.unmount()
    const on = mk(ENV_ON)
    const sent = [], actions = []
    const onRun = await run(on, { enabled: true, sendTurn: text => { sent.push(text) }, sendAction: (action, id) => { actions.push([action, id]) }, sessionKey: 's1', connected: true })
    eq(on.calls.controllers.length, 1, 'hook: flag on: one controller, loaded after mount')
    const o = on.calls.controllers[0]
    eq([o.env, o.port], [{ marker: 'env' }, { marker: 'port' }], 'hook: ...with the browser\'s environment and the router port')
    ok(typeof on.ui.voiceCallBus.frame === 'function' && typeof on.ui.voiceCallBus.sent === 'function', 'hook: ...and the bus is wired to it')
    o.sendTurn('hello'); eq(sent, ['hello'], 'hook: the controller\'s send is the page\'s send'); o.sendAction({ label: 'Yes' }, 'm1'); eq(actions, [[{ label: 'Yes' }, 'm1']], 'hook: ...and a card\'s button is the page\'s own click'); eq(o.isConnected(), true, 'hook: ...and it knows the socket is open')
    eq(onRun.latest().composerProps?.active, false, 'hook: the composer gets the call button\'s state')
    eq(listeners.length, 0, 'hook: no key listener before a call')
    eq(on.calls.ended ?? 0, 0, 'hook: the call is not ended while the session stays')
    await onRun.set({ sessionKey: 's2' }); eq(on.calls.ended, 1, 'hook: the session on screen changed: the call is ended')
    await onRun.set({ connected: false }); eq([on.calls.ended, o.isConnected()], [1, false], 'hook: ...and only a change of session ends it (the socket state is read live)')
    onRun.rootNode.unmount()
    eq([on.calls.disposed, on.ui.voiceCallBus.frame, on.ui.voiceCallBus.sent], [true, null, null], 'hook: unmounting disposes the controller and clears the bus')
  } finally { delete globalThis.window }
}

// ============================================================================================================================================
// D. The page, the socket hook, the composer, .env.example, the scope
// ============================================================================================================================================
const lines = text => text.split('\n')
const MARK = strip.VOICE_CALL_MARKER_RE
function sourceSuite(sources, { base = null } = {}) {
  const core_text = () => sources[CORE_STRIP]
  const coreMod = makeHost({ over: { [CORE_STRIP]: sources[CORE_STRIP] } }).load(CORE_STRIP)
  const page = sources[PAGE], ws = sources[WS], input = sources[INPUT], env = sources['.env.example'], hook = sources[HOOK]
  const lineOf = (text, needle) => { const found = lines(text).filter(line => line.includes(needle)); ok(found.length === 1, `exactly one line with: ${needle.slice(0, 70)} (${found.length})`); return found[0] }
  // the page
  eq(lines(page).filter(line => MARK.test(line)).length, 6, 'page: six marked lines (the comment and the hook call, the dock, the composer prop, the comment and the import at the end)')
  const call = lineOf(page, 'const voiceCall = useStudioVoiceCall({')
  ok(call.includes('enabled: studioShell') && call.includes('sendTurn: text => handleSendMessage(undefined, text)') && call.includes('sendAction: handleActionClick,') && call.includes('sessionKey: currentSessionId || wsSessionId') && call.includes('connected }) // VOICE-CALL'), 'page: the hook is handed the Studio shell, the page\'s ordinary send, the session and the socket state')
  ok(page.indexOf(call) > page.indexOf('const handleSendMessage = useCallback(') && page.indexOf(call) > page.indexOf('const handleActionClick = useCallback(') && page.indexOf(call) > page.indexOf('const flowControl = useStudioFlowControl({'), 'page: the call hook comes after the two sends it uses (a typed turn, a card\'s button) and after the flow hook')
  eq(lines(page).filter(line => MARK.test(line) && /handleActionClick\(/.test(line)).length, 0, 'page: no call of handleActionClick( is written by this change (the outline canvas proof counts them: the hook is handed the function itself)')
  const dockLine = lineOf(page, '{voiceCall.dock}{/* VOICE-CALL')
  ok(page.indexOf(dockLine) > page.indexOf('{flowControl.bar}') && page.indexOf(dockLine) < page.indexOf('<ChatInput\n'), 'page: the dock sits above the composer, under the flow bar')
  const propLine = lineOf(page, '{...(voiceCall.composerProps ? { voiceCall: voiceCall.composerProps } : {})} // VOICE-CALL')
  ok(page.indexOf(propLine) > page.indexOf('<ChatInput\n') && page.indexOf(propLine) < page.indexOf('onSubmit={handleSendMessage}'), 'page: the call button\'s props reach the composer (and only with the flag on)')
  const importLine = lineOf(page, "import { useStudioVoiceCall } from '@/hooks/use-studio-voice-call' // VOICE-CALL")
  ok(page.indexOf(importLine) > page.indexOf("import { useStudioFlowControl } from '@/hooks/use-studio-flow-control' // FLOW-CONTROL") && page.indexOf(importLine) > page.indexOf('function AuthenticatedBuilderContent('), 'page: the import sits after the Builder content, beside the flow import (older proofs slice the page by position)')
  ok(!page.includes('getUserMedia') && !page.includes('MediaRecorder') && !page.includes('voice-call-controller') && !page.includes('STUDIO_VOICE_CALL_UI_ENABLED'), 'page: it knows the hook and nothing of the microphone, the controller or the flag')
  // the socket hook
  eq(lines(ws).filter(line => MARK.test(line)).length, 5, 'ws: five marked lines (the import, the comment, the frame tap, the voice fields, the sent tap)')
  lineOf(ws, "import { STUDIO_VOICE_CALL_UI_ENABLED, addVoiceCallFields, isVoiceCallFrameType, voiceCallBus } from '@/lib/studio-voice-call-ui'; // VOICE-CALL")
  const tap = lineOf(ws, 'voiceCallBus.frame?.(parsedMessage); // VOICE-CALL')
  ok(tap.includes('if (STUDIO_VOICE_CALL_UI_ENABLED && isVoiceCallFrameType(parsedMessage.type) && parsedMessage.session_id === socketSessionId && isCurrentSocket())'), 'ws: the frame tap is gated: the flag, the types that carry state, this socket\'s session, while this socket is current')
  for (const needle of ['routeStudioBulkEditUndoFrame(parsedMessage', 'if (!isKnownDirectorMessageType(parsedMessage.type))', "if (parsedMessage.type === 'deck_mutation') {"]) ok(ws.indexOf(tap) < ws.indexOf(needle), `ws: the tap is ahead of ${needle.slice(0, 40)}`)
  ok(ws.indexOf(tap) > ws.indexOf('flowBus.phase?.(parsedMessage.payload)'), 'ws: ...and after the flow control taps (a frame carries on exactly as before)')
  ok(!/voiceCallBus\.frame\?\.\(parsedMessage\);[^\n]*\n\s*(return|continue)/.test(ws.slice(ws.indexOf(tap), ws.indexOf(tap) + 400)), 'ws: the tap never consumes a frame')
  const fields = lineOf(ws, 'if (STUDIO_VOICE_CALL_UI_ENABLED) addVoiceCallFields(message.data as unknown as Record<string, unknown>, text); // VOICE-CALL')
  ok(ws.indexOf(fields) > ws.indexOf('if (CHAT_PARITY_CAPS.length > 0) addChatParityCaps(') && ws.indexOf(fields) < ws.indexOf('      return message;\n    };'), 'ws: the voice fields come last, after every other cap, inside buildUserMessage')
  const sentTap = lineOf(ws, 'voiceCallBus.sent?.(text); // VOICE-CALL')
  ok(sentTap.includes("if (STUDIO_VOICE_CALL_UI_ENABLED && (message.data as unknown as Record<string, unknown>).mode === 'voice')"), 'ws: the sent tap is gated and for a voice turn only')
  ok(ws.indexOf(sentTap) > ws.indexOf(fields) && lines(ws)[lines(ws).indexOf(sentTap) - 1].includes('wsRef.current.send(JSON.stringify(message));'), 'ws: ...right after the send')
  ok(!ws.includes('onVoiceCall') && !ws.includes('getUserMedia') && !/mode:\s*'voice'/.test(ws.replace(sentTap, '')), 'ws: no new option, no microphone; the mode is written in the lib only')
  // the composer
  eq(lines(input).filter(line => MARK.test(line)).length, 5, 'input: five marked lines (two imports, the prop, its destructuring, the button)')
  lineOf(input, "import { VoiceCallButton } from './voice-call/voice-call-button' // VOICE-CALL"); lineOf(input, "import type { VoiceCallComposerProps } from '@/lib/studio-voice-call-ui' // VOICE-CALL")
  lineOf(input, '  voiceCall?: VoiceCallComposerProps // VOICE-CALL'); lineOf(input, '  voiceCall, // VOICE-CALL')
  const btn = lineOf(input, '{voiceCall ? <VoiceCallButton {...voiceCall} studio={studio} /> : null}{/* VOICE-CALL')
  ok(input.indexOf(btn) > input.indexOf('aria-label="Build theme"') && input.indexOf(btn) > input.indexOf("data-studio-composer-menu={studio ? 'research' : undefined}") && input.indexOf(btn) < input.indexOf('{chatClean ? <StudioChatCleanSendSide'), 'input: the call button is last in the toolbar\'s left group, before the send side')
  ok(!input.includes('getUserMedia'), 'input: the composer never asks for the microphone')
  // the microphone: asked for in one place
  const code = text => text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  ok(fs.readdirSync(path.join(root, 'lib')).filter(f => f.startsWith('studio-voice-call')).every(f => (code(f === 'studio-voice-call-browser.ts' ? sources[BROWSER] : read(`lib/${f}`)).match(/getUserMedia\(/g) ?? []).length === (f === 'studio-voice-call-browser.ts' ? 1 : 0)) && !code(hook).includes('getUserMedia'), 'microphone: getUserMedia is called in exactly one place (the browser adapter\'s openMic), which only the controller\'s startCall calls')
  const ctlText = sources[CTL]
  eq(lines(ctlText).filter(line => /\.openMic\(/.test(line)).length, 1, 'microphone: the controller opens it in one place'); ok(ctlText.indexOf('this.env.openMic()') > ctlText.indexOf('async startCall()') && ctlText.indexOf('this.env.openMic()') < ctlText.indexOf('private micFailed'), 'microphone: ...inside startCall')
  ok(!/fetch\(|XMLHttpRequest|speechSynthesis|SpeechRecognition|new WebSocket|OpenRouter|api\.openai|elevenlabs/i.test([UI, ROUTER, CTL, HOOK].map(rel => sources[rel] ?? read(rel)).join('\n').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'speech: no fetch, no browser speech, no vendor in the lib, the controller or the hook (the router port is handed its fetch)')
  ok(sources[BROWSER].includes('fetch(input, init as RequestInit)') && (sources[BROWSER].match(/\bfetch\(/g) ?? []).length === 1, 'speech: the only fetch is the router port\'s, on the page\'s own origin')
  ok(hook.includes("import('@/lib/studio-voice-call-controller')") && hook.includes("import('@/lib/studio-voice-call-browser')") && !/^import (?!type )[^\n]*studio-voice-call-(controller|browser)'/m.test(hook) && !/^import (?!type )[^\n]*@\/lib\/studio\/voice/m.test(hook), 'hook: the controller, the browser adapters and the core are loaded on demand, not imported')
  ok(hook.includes('spaceBelongsToTarget(event.target as HTMLElement | null)') && !hook.includes('isTypingTarget('), 'hook: Space is the talk key unless the target keeps it (a text field, a control that Space activates)')
  ok(hook.includes('const enabled = options.enabled && STUDIO_VOICE_CALL_UI_ENABLED') && /if \(!enabled\) return\n/.test(hook), 'hook: the flag gates the load')
  ok(hook.includes("dynamic(() => import('@/components/builder/voice-call/voice-call-dock')") && !/^import .*voice-call-dock/m.test(hook), 'hook: the dock (and its stylesheet and icons) is its own chunk')
  // .env.example
  ok(env.endsWith(`\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\n'), '.env.example: the block is the last thing in the file, after one blank line')
  eq(lines(env).filter(line => line === 'NEXT_PUBLIC_STUDIO_VOICE_COMPANION="bob"').length, 1, '.env.example: the companion once, "bob"'); eq(lines(env).filter(line => /^NEXT_PUBLIC_STUDIO_VOICE_CALL=/.test(line)).length, 1, '.env.example: the call flag is on ELEMENT-3\'s one line, not repeated here')
  ok(lines(strip.VOICE_CALL_ENV_BLOCK).filter(line => line && !line.startsWith('#') && line !== 'NEXT_PUBLIC_STUDIO_VOICE_COMPANION="bob"').length === 0, '.env.example: the block is comments and its one assignment')
  ok(lines(env.slice(env.indexOf('# STUDIO VOICE CALL UI'))).every(line => !/exact "true" enables it/.test(line)), '.env.example: the block does not use the phrase older proofs read')
  if (base) {
    for (const rel of strip.VOICE_CALL_FILES) {
      ok(strip.stripVoiceCall(rel, sources[rel]) === base[rel], `${rel}: without this change's lines it is the base's file, byte for byte`)
      ok(sources[rel] !== base[rel], `${rel}: it is changed`)
    }
  }
  // the older proofs this change teaches, and the registry text
  if (base && base.__pins) {
    const reg = base.__reg
    for (const rel of strip.VOICE_CALL_PIN_FILES) {
      const marked = lines(sources[rel] ?? read(rel)).filter(line => MARK.test(line))
      ok(marked.length > 0 && marked.every(line => /LATER-CHANGES: registry read \(VOICE-CALL\)/.test(line)), `${rel}: this change's lines in it are marked VOICE-CALL and say why`)
      ok(reg.stripLaterChanges(rel, sources[rel] ?? read(rel)) === reg.stripLaterChanges(rel, base.__pins[rel]), `${rel}: read through the registry it is the base's file (older proofs read it like that)`)
      ok(strip.stripVoiceCall(rel, sources[rel] ?? read(rel)).split('\n').every(line => !MARK.test(line)), `${rel}: the strip takes every marked line out`)
    }
    eq([lines(read('scripts/test-theme-font-selection.mjs')).filter(line => MARK.test(line)).length, lines(read('scripts/test-studio-chat-theme-export.mjs')).filter(line => MARK.test(line)).length], [1, 1], 'pins: the sandbox gets one constant, the line counter one filter')
    eq(['Voice call: the lib', 'Voice core: x', 'Chat element edit: x', 'Voice caller: x'].map(coreMod.isVoiceCoreCommitSubject), [true, true, false, false], 'subjects: the voice core\'s subject helper (read by the scope proofs that were taught it) also leaves out "Voice call:" commits, and nothing else')
    eq(strip.VOICE_CALL_PUT_BACK_FILES.map(rel => lines(read(rel)).filter(line => MARK.test(line)).length), [0, 0], 'pins: the two scope proofs one commit taught and a later one put back carry nothing of this change now')
    eq(lines(core_text()).filter(line => MARK.test(line)).length, 1, 'core strip: one marked line (the helper\'s return), nothing else of the core\'s file is touched here')
    ok(!strip.VOICE_CALL_FILES.includes('scripts/studio-voice-core-strip.mjs') && !strip.VOICE_CALL_PIN_FILES.includes('scripts/studio-voice-core-strip.mjs') && strip.VOICE_CALL_SCOPE_FILES.has('scripts/studio-voice-core-strip.mjs'), 'core strip: it is a scope file of this change, and the strip does not take its marked line out (that line is an edit, not an insertion)')
    const registryText = read('scripts/studio-later-changes.mjs')
    const without = strip.stripVoiceCall('scripts/studio-later-changes.mjs', registryText)
    eq([registryText.split('\n').length - without.split('\n').length, without.includes("studio-voice-call-strip.mjs')"), without.includes('studio-voice-core-strip.mjs')], [3, false, true], 'registry: the strip takes this change\'s three lines out of the registry text, and only those (older proofs read "the last registered line of its list" that way)')
  }
  eq(['Voice call: the lib', ' Voice call: x', 'Voice core: x', 'voice call: x', 'A Voice call: x', ''].map(strip.isVoiceCallCommitSubject), [true, true, false, false, false, false], 'subjects: "Voice call:" is this change\'s (the older scope proofs leave these commits out, as they do the voice core\'s)')
  // the strip itself
  ok(strip.stripVoiceCall('lib/other.ts', 'x // VOICE-CALL\n') === 'x // VOICE-CALL\n', 'strip: a file that is not this change\'s comes back as it is')
  ok(strip.stripVoiceCall(PAGE, 'a\nb // VOICE-CALL-X\nc // X-VOICE-CALL\nd // VOICE-CALL\ne // NEXT_PUBLIC_STUDIO_VOICE_CALL\n') === 'a\nb // VOICE-CALL-X\nc // X-VOICE-CALL\ne // NEXT_PUBLIC_STUDIO_VOICE_CALL\n', 'strip: the marker is a whole token')
  ok(strip.stripVoiceCall(PAGE, 42) === 42, 'strip: not text comes back as it is')
  ok(sources[BROWSER].includes('blob: await toWav(heard, context)') && sources[BROWSER].includes('encodeWavPcm16(resampleLinear(mixToMono(channels), decoded.sampleRate, VOICE_WAV_RATE), VOICE_WAV_RATE)') && sources[BROWSER].includes("type: 'audio/wav'"), 'browser: what was recorded is decoded, mixed to mono, brought to 16 kHz and sent as WAV (ROUTER-1: hearing takes base64 WAV)')
  ok(sources[PLAYER].includes('const width = framedWidth(framing, size, rect)'), 'player: its width is the lib\'s (the disc is a square, the chest as wide as its crop)')
  // the stylesheet: nothing global, nothing that reaches an element without the call's own attributes
  const css = sources[CSS]
  ok(lines(css).filter(line => /^[^\s@/}]/.test(line) && !line.startsWith('[data-studio-v4-shell="true"] [data-studio-voice-call="dock"]') && !line.startsWith('[data-studio-voice-call="dock"]')).length === 0, 'css: every rule is keyed to the call\'s own attribute')
  ok(/prefers-reduced-motion: reduce/.test(css) && /max-width: 767px/.test(css), 'css: reduced motion and the phone layout are there')
}

const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const baseOk = (() => { try { git('cat-file', '-e', `${strip.BASE_COMMIT}^{commit}`); return true } catch { return false } })()
const baseSources = baseOk ? Object.fromEntries(strip.VOICE_CALL_FILES.map(rel => [rel, git('show', `${strip.BASE_COMMIT}:${rel}`)])) : null
// This change's own commits (the merge of ELEMENT-3's core is not one of them): by subject, from the base.
const OWN = baseOk ? git('log', '--no-merges', '--format=%H', `--grep=^${strip.VOICE_CALL_SUBJECT}`, '-E', `${strip.BASE_COMMIT}..HEAD`).split('\n').filter(Boolean) : []

async function all(over = {}, { slow = true } = {}) {
  if (baseSources && !baseSources.__pins) { Object.defineProperty(baseSources, '__pins', { value: Object.fromEntries(strip.VOICE_CALL_PIN_FILES.map(rel => [rel, git('show', `${strip.BASE_COMMIT}:${rel}`)])), enumerable: false }); Object.defineProperty(baseSources, '__reg', { value: await import('./studio-later-changes.mjs'), enumerable: false }) }
  uiSuite(loadUi(over), over)
  await routerSuite(over)
  await controllerSuite(over)
  await dockSuite(over)
  await hookSuite(over)
  sourceSuite({ ...SOURCES, ...over }, { base: baseSources })
}

// ============================================================================================================================================
await all()
console.log(`PASS A-D  lib, router, controller, components, hook, sources (${checks} checks)`)
if (baseOk) {
  const registry = await import('./studio-later-changes.mjs')
  ok(registry.LATER_STRIPS.includes(strip.stripVoiceCall), 'registry: the strip is named'); ok(registry.LATER_ENV_BLOCKS.includes(strip.VOICE_CALL_ENV_BLOCK), 'registry: the block is named')
  ok([...strip.VOICE_CALL_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'registry: every file is named')
  for (const rel of strip.VOICE_CALL_FILES) ok(registry.stripLaterChanges(rel, SOURCES[rel]) === registry.stripLaterChanges(rel, baseSources[rel]), `registry: ${rel}, read through it, is the base's (older proofs read it like that)`)
  ok(OWN.length > 0 || process.env.VOICE_CALL_PROOF_NO_COMMITS === '1', 'scope: this change has its own "Voice call:" commits (set VOICE_CALL_PROOF_NO_COMMITS=1 before the first commit)')
  if (OWN.length > 0) {
    const changed = new Set(OWN.flatMap(sha => git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean)))
    eq([...changed].filter(rel => !strip.VOICE_CALL_SCOPE_FILES.has(rel)).sort(), [], 'scope: every file of this change\'s own commits is this change\'s')
    ok([...changed].every(rel => !rel.startsWith('public/companions/')), 'scope: no companion art is committed (Garud delivers the packs)')
    for (const rel of strip.VOICE_CALL_FILES) {
      const diff = git('diff', '--unified=0', strip.BASE_COMMIT, 'HEAD', '--', rel).split('\n')
      const added = diff.filter(line => line.startsWith('+') && !line.startsWith('+++')), removed = diff.filter(line => line.startsWith('-') && !line.startsWith('---'))
      ok(added.length > 0 && added.every(line => MARK.test(line)), `${rel}: every added line carries the marker (${added.filter(line => !MARK.test(line)).length} do not)`)
      eq(removed, [], `${rel}: no existing line is rewritten or removed (pure insertions, so a stacked change cannot be broken by this one)`)
    }
    const envDiff = git('diff', '--unified=0', strip.BASE_COMMIT, 'HEAD', '--', '.env.example').split('\n').filter(line => /^[-+]/.test(line) && !/^(---|\+\+\+)/.test(line))
    ok(envDiff.every(line => line.startsWith('+')), '.env.example: only lines added')
    ok(envDiff.map(line => line.slice(1)).join('\n').endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\'s two lines)')
    const subjects = git('log', '--no-merges', '--format=%s', `${strip.BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)
    ok(OWN.length > 0 && subjects.filter(subject => subject.startsWith(strip.VOICE_CALL_SUBJECT)).length === OWN.length, 'scope: the commits are named "Voice call: ..." (this proof reads those)')
  }
  for (const rel of strip.VOICE_CALL_NEW_FILES) ok(fs.existsSync(path.join(root, rel)), `scope: ${rel} exists`)
  ok(strip.VOICE_CALL_FILES.every(rel => !strip.VOICE_CALL_NEW_FILES.includes(rel)), 'scope: marked and new files are different lists')
  ok(!fs.existsSync(path.join(root, 'public/companions')) || !git('ls-files', 'public/companions').trim(), 'scope: no companion art is tracked')
} else console.log(`NOTE D  git has no ${strip.BASE_COMMIT.slice(0, 8)}: the base-identity and scope checks were skipped`)
console.log(`PASS D  registry, strip identity, scope (${checks} checks)`)
if (process.env.VOICE_TEST_SKIP_MUTANTS === '1') { release(); console.log(`SKIPPED E  mutants (VOICE_TEST_SKIP_MUTANTS=1); OK so far: ${checks} checks`); process.exit(0) }

// ============================================================================================================================================
// E. Mutants: every one must be caught
// ============================================================================================================================================
const mutants = [
  // the lib
  [UI, 'flag: anything but "true" turns it on', "return value === 'true'", "return value !== 'false'"],
  [UI, 'companion: any name is a folder', "/^[a-z0-9][a-z0-9-]{0,31}$/.test(value)", "typeof value === 'string' && value.length > 0"],
  [UI, 'the voice fields go on any message', 'if (!takeVoiceTurn(text)) return data', 'if (false) return data'],
  [UI, 'the voice cap replaces the others', "data.client_caps = existing.includes(VOICE_CAP) ? existing : [...existing, VOICE_CAP]", "data.client_caps = [VOICE_CAP]"],
  [UI, 'the mode is not "voice"', "export const VOICE_TURN_MODE = 'voice'", "export const VOICE_TURN_MODE = 'speech'"],
  [UI, 'the cap is not voice1', "export const VOICE_CAP = 'voice1'", "export const VOICE_CAP = 'voice'"],
  [UI, 'an armed turn is kept after it is taken', 'voiceCallBus.pending = null\n  return true', 'return true'],
  [UI, 'an armed turn is taken by any words', 'if (!pending || pending.text !== text) return false', 'if (!pending) return false'],
  [UI, 'sync_response reaches the call', "'slide_built', 'slide_failed', 'action_request']", "'slide_built', 'slide_failed', 'action_request', 'sync_response']"],
  [UI, 'a progress bubble is a report', "if (payload.ephemeral === true) return null", 'void 0'],
  [UI, 'a decline is not sorry', "return { kind: 'reporting', decline: isDeclineText(cleanText(payload.text)) }\n    }\n    default", "return { kind: 'reporting', decline: false }\n    }\n    default"],
  [UI, 'the hint is ignored', 'const hinted = signalFromHint(payload.companion_state)', 'const hinted = null'],
  [UI, 'listening is accepted from the wire', "'thinking', 'working', 'reporting', 'pleased', 'concerned', 'waiting', 'idle'", "'thinking', 'working', 'reporting', 'pleased', 'concerned', 'waiting', 'listening', 'idle'"],
  [UI, 'a finished build is the small pleased', "if (phase === 'complete') return { kind: 'pleased', big: true }", "if (phase === 'complete') return { kind: 'pleased', big: false }"],
  [UI, 'a paused build is waiting', "if (phase === 'paused' || phase === 'stopped') return { kind: 'paused' }", "if (phase === 'paused' || phase === 'stopped') return { kind: 'waiting' }"],
  [UI, 'a slide failure is not concern', "case 'slide_failed': return { kind: 'concerned' }", "case 'slide_failed': return null"],
  [UI, 'every build_event is the deck\'s', "payload.scope === 'deck'", "true"],
  [UI, 'the spoken cap is gone', 'line.length <= (long ? MAX_SPOKEN_CHARS : MAX_SPOKEN_PROGRESS_CHARS)', 'true'],
  [UI, 'any frame is read aloud', "if (!long && type !== 'status_update' && type !== 'build_phase' && !(type === 'build_event' && payload.scope === 'deck')) return null", ''],
  [UI, 'the text is spoken when there is no line', "const line = cleanText(payload.spoken)", "const line = cleanText(payload.spoken) ?? cleanText(payload.text)"],
  [UI, 'a small pleased every time', 'now - expired.lastPleasedAt < PLEASED_EVERY_MS', 'false'],
  [UI, 'a report does not end the thinking', "const background = expired.background === 'thinking' ? 'none' : expired.background\n      if (outranks(expired.beat, scene))", "const background = expired.background\n      if (outranks(expired.beat, scene))"],
  [UI, 'a beat never ends', 'if (beat && input.now < beat.until) return beat.scene', 'if (beat) return beat.scene'],
  [UI, 'the call phase loses to a beat', "if (input.phase === 'listening') return 'listening'\n  if (input.phase === 'speaking' || input.speakingNow) return 'speaking'\n  if (input.phase === 'thinking') return 'thinking'\n  const beat", "const beat"],
  [UI, 'every celebration dances', '(celebrations - 1) % DANCE_EVERY === DANCE_EVERY - 1 &&', 'true &&'],
  [UI, 'a dance twice within a minute', '(expired.lastDanceAt === null || now - expired.lastDanceAt >= DANCE_COOLDOWN_MS)', 'true'],
  [UI, 'working is not the glance up', "accent: { clip: 'look_down', reverse: true, everyMs: [8000, 12000] }", "accent: { clip: 'look_down', reverse: false, everyMs: [8000, 12000] }"],
  [UI, 'listening does not lean', "steps: [{ clip: 'lean_in', mode: 'hold' }], accent: { clip: 'nod'", "steps: [{ clip: 'head_tilt', mode: 'hold' }], accent: { clip: 'nod'"],
  [UI, 'thinking is not the thinking face', "{ clip: 'expr_thinking_front', mode: 'hold' }], accent: null, blink: false, still: { clip: 'expr_thinking_front', at: 'hold' } }\n    case 'speaking'", "{ clip: 'expr_thinking_front', mode: 'loop' }], accent: null, blink: false, still: { clip: 'expr_thinking_front', at: 'hold' } }\n    case 'speaking'"],
  [UI, 'sorry has no shrug', "{ clip: 'shrug', mode: 'once' }, ", ''],
  [UI, 'waiting does not invite', "{ clip: 'invite', mode: 'once' }, { clip: 'lean_in', mode: 'hold' }", "{ clip: 'lean_in', mode: 'hold' }"],
  [UI, 'the still of listening is the first frame', "still: { clip: 'lean_in', at: 'hold' } }\n    case 'thinking'", "still: { clip: 'lean_in', at: 'first' } }\n    case 'thinking'"],
  [UI, 'a loop ignores its range', 'clip.loop && clip.loop[1] > clip.loop[0] ? clip.loop : [0, clip.frames.length]', '[0, clip.frames.length]'],
  [UI, 'hold runs past its hold frame', "Math.min(raw, clip.hold !== undefined ? Math.min(clip.hold, last) : last)", 'Math.min(raw, last)'],
  [UI, 'the mouth never closes', 'if (smooth < 0.025) return syllable % 11 === 0 ? 7 : syllable % 7 === 0 ? 8 : 0', 'if (smooth < 0.025) return 2'],
  [UI, 'the disc is not square', 'return { sx: clamp(cx - side / 2, 0, size.width - side), sy: bbox.y, sw: side, sh: side }', 'return { sx: clamp(cx - side / 2, 0, size.width - side), sy: bbox.y, sw: side, sh: side * 1.3 }'],
  [UI, 'the disc is 90 px', 'export const DISC_PX_DESKTOP = 88', 'export const DISC_PX_DESKTOP = 90'],
  [UI, 'the chest is 200 px', 'export const CHEST_PX = 240', 'export const CHEST_PX = 200'],
  [UI, 'a phone is wider', "'(max-width: 767px)'", "'(max-width: 1023px)'"],
  [UI, 'Stop is always on', 'stop: live && (input.phase', 'stop: live || (input.phase'],
  [UI, 'talking works without a socket', 'talk: live && input.connected', 'talk: live'],
  [UI, 'Space talks in a text field', "tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true", 'false'],
  [UI, 'Space is taken from a button', "if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true", ''],
  [UI, 'Space is taken from the call\'s own button', "if (target.closest?.('[data-studio-voice-call=\"button\"], .studio-voice-talk')) return false", ''],
  [UI, 'Space with the Command key talks', '&& !event.metaKey && !event.ctrlKey', '&& !event.ctrlKey'],
  [UI, 'a key repeat talks again', '&& !event.repeat', ''],
  [UI, 'the not-connected words blame the user', "title: \"Speech isn't connected yet\"", "title: 'Something went wrong'"],
  // the router
  [ROUTER, 'a 404 is a plain failure', "if (status === 404 || status === 501 || status === 503) return 'not_connected'", "if (status === 501 || status === 503) return 'not_connected'"],
  [ROUTER, 'a limit is a failure', "if (status === 402 || status === 429) return 'limit'", "if (status === 402) return 'limit'"],
  [ROUTER, 'the stt label is wrong', "stt: 'studio.voice_stt'", "stt: 'studio.stt'"],
  [ROUTER, 'the tts label is wrong', "tts: 'studio.voice_tts'", "tts: 'studio.tts'"],
  [ROUTER, 'the transcript is not trimmed', "(body as { text: string }).text.trim()", "(body as { text: string }).text"],
  [ROUTER, 'an abort is a failure', "if (name === 'AbortError' || signal?.aborted) return new VoiceRouterError('aborted', 'The request was cancelled')", ''],
  [ROUTER, 'the speech goes to another origin', "speak: '/api/studio/voice/speak'", "speak: 'https://speech.example.com/speak'"],
  // the controller
  [CTL, 'the microphone is asked for at construction', "this.snapshot = this.build()\n  }", "this.snapshot = this.build(); void this.env.openMic()\n  }"],
  [CORE_STRIP, 'the voice core\'s subject helper does not know this change', ' || subject.startsWith("Voice call:")', ''],
  [CTL, 'the hearing is not metered', 'this.meter.add(heard.costUsd)', ''],
  [CTL, 'an unknown cost is zero', 'this.meter.add(spoken.costUsd)', 'this.meter.add(spoken.costUsd ?? 0)'],
  [CTL, 'the meter outlives the call', 'this.replyLeadUntil = 0\n    this.meter = new CallCostMeter()', 'this.replyLeadUntil = 0'],
  [ROUTER, 'the recording is named as webm', "form.append('audio', audio, 'turn.wav')", "form.append('audio', audio, 'turn.webm')"],
  [ROUTER, 'a bad cost is zero', 'return Number.isFinite(usd) && usd >= 0 ? usd : null', 'return Number.isFinite(usd) && usd >= 0 ? usd : 0'],
  [ROUTER, 'a missing cost is zero', "if (typeof value !== 'string' || !value.trim()) return null", "if (typeof value !== 'string' || !value.trim()) return 0"],
  [UI, 'the WAV says another rate', 'view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)', 'view.setUint32(24, 44100, true); view.setUint32(28, sampleRate * 2, true)'],
  [UI, 'the WAV is stereo', 'view.setUint16(20, 1, true); view.setUint16(22, 1, true)', 'view.setUint16(20, 1, true); view.setUint16(22, 2, true)'],
  [UI, 'the WAV is not clipped', 'const value = Number.isFinite(samples[i]) ? Math.max(-1, Math.min(1, samples[i]!)) : 0', 'const value = Number.isFinite(samples[i]) ? samples[i]! : 0'],
  [UI, 'the channels are summed, not averaged', 'if (channels.length > 1) for (let i = 0; i < length; i++) out[i] = out[i]! / channels.length', ''],
  [UI, 'the rate is not converted', 'const ratio = fromRate / toRate', 'const ratio = 1'],
  [UI, 'the WAV rate is 8 kHz', 'export const VOICE_WAV_RATE = 16000', 'export const VOICE_WAV_RATE = 8000'],
  [BROWSER, 'the recording is sent as it was recorded', 'blob: await toWav(heard, context)', 'blob: heard'],
  [CTL, 'the speaker is not unlocked by the click', 'this.player.prime?.() // inside the click: the speaker is unlocked now, not at the first sentence', ''],
  [UI, 'a report covers a failure', 'const outranks = (held: DirectorTrack[\'beat\'], next: BeatScene): boolean => !!held && BEAT_RANK[held.scene] > BEAT_RANK[next]', 'const outranks = (held: DirectorTrack[\'beat\'], next: BeatScene): boolean => false'],
  [UI, 'a plain report covers a decline', 'reporting: 0, pleased: 1, celebrating: 2, sorry: 3, concerned: 4 }', 'reporting: 3, pleased: 1, celebrating: 2, sorry: 3, concerned: 4 }'],
  [CTL, 'a mic that is granted late stays open', "if (this.disposed || token !== this.startToken) { mic.close(); return }", "if (this.disposed) { mic.close(); return }"],
  [CTL, 'the mic error is swallowed', "return this.micFailed(typeof error === 'object'", "return void (typeof error === 'object'"],
  [CTL, 'the mic is not released on end', "this.mic?.close()\n        this.mic = null", "this.mic = null"],
  [CTL, 'a tick timer is left after the call', "this.mic = null\n        this.clearTick()", "this.mic = null"],
  [CTL, 'a short recording is sent', 'const verdict = worthSending({ durationMs: heard.durationMs, peakLevel: heard.peak })', 'const verdict = { ok: true }'],
  [CTL, 'the words are not armed', 'armVoiceTurn(words)\n    try {', 'try {'],
  [CTL, 'the turn stays armed', 'disarmVoiceTurn()\n    if (this.awaiting?.turn !== turn) return', 'if (this.awaiting?.turn !== turn) return'],
  [CTL, 'a send nobody saw is fine', "if (!this.awaiting.sendObserved) this.failTurn(turn, 'not_sent')", ''],
  [CTL, 'a frame is handled twice', 'if (this.seen.has(id)) return', 'if (false) return'],
  [CTL, 'frames before the call are handled', "if (!this.active || this.disposed) return\n    const id =", "if (this.disposed) return\n    const id ="],
  [CTL, 'the reply is read from the text', "const spoken = spokenLineFromFrame(frame)\n    const sentences", "const spoken = spokenLineFromFrame(frame) ?? replyTextFromFrame(frame)\n    const sentences"],
  [CTL, 'the reply talks over the user', "if (this.cs.phase === 'listening') return // the user is talking: the reply is in the chat, and nothing talks over them\n", ''],
  [CTL, 'the reply to a stopped turn is said', "if (!awaiting && this.owedReplies > 0) { this.owedReplies--; return }", ''],
  [CTL, 'a reply with nothing to say hangs the turn', "this.dispatch({ type: 'reply_done', turn: this.cs.turn })\n      this.dispatch({ type: 'audio_drained', turn: this.cs.turn })\n      return\n    }\n    if (!sentences.length || this.speechOff) return", "return\n    }\n    if (!sentences.length || this.speechOff) return"],
  [CTL, 'a reply is spoken as one block', 'for (const sentence of sentences) this.enqueue(sentence, \'reply\', turn, true)', "this.enqueue(sentences.join(' '), 'reply', turn, true)"],
  [CTL, 'progress is said while the user talks', "!busy && this.cs.phase !== 'listening' && now - this.quietSince", "!busy && now - this.quietSince"],
  [CTL, 'a stale progress line is said', 'if (now - progress.at > PROGRESS_STALE_MS || this.speechOff) this.progressLine = null', 'if (this.speechOff) this.progressLine = null'],
  [CTL, 'progress is said before 4 s of quiet', 'now - this.quietSince >= PROGRESS_AFTER_MS', 'true'],
  [CTL, 'progress is said every tick', 'now - this.lastProgressSaidAt >= PROGRESS_EVERY_MS', 'true'],
  [CTL, 'the oldest progress line is kept', 'this.progressLine = { text: line, at: this.env.now() }', 'this.progressLine = this.progressLine ?? { text: line, at: this.env.now() }'],
  [CTL, 'progress is said over speech', 'const busy = this.speakingNow || !!this.playing || this.queue.length > 0', 'const busy = false'],
  [CTL, 'a card is never pressed', 'const action = open ? matchSpokenAnswer(text, open.actions) : null', 'const action = null'],
  [CTL, 'a card stays open after it is answered', 'this.openAction = null\n    const words = action', 'const words = action'],
  [CTL, 'a card is never closed', 'if (closesOpenAction(frame)) this.openAction = null', ''],
  [CTL, 'a card is not tracked', "if (buttons && typeof id === 'string' && id) this.openAction = { messageId: id, actions: buttons }", ''],
  [CTL, 'a card is pressed by the typed path', 'await (action && open ? this.sendAction(action, open.messageId) : this.sendTurn(text))', 'await this.sendTurn(text)'],
  [CTL, 'the armed words are the transcript, not the label', 'armVoiceTurn(words)', 'armVoiceTurn(text)'],
  [CTL, 'a card is not a reply', "(type === 'action_request' && signal?.kind === 'waiting')) this.heardReply(frame)", "false) this.heardReply(frame)"],
  [UI, 'a card line is not read', "const long = type === 'chat_message' || type === 'action_request'", "const long = type === 'chat_message'"],
  [UI, 'a card is progress', "!== 'chat_message' && frameType(frame) !== 'action_request' && spokenLineFromFrame(frame) !== null", "!== 'chat_message' && spokenLineFromFrame(frame) !== null"],
  [UI, 'yes presses the other button', 'if (YES_WORDS.includes(said)) return primary[0]!.requires_input ? null : primary[0]!', 'if (YES_WORDS.includes(said)) return others[0]!'],
  [UI, 'no works on any card', 'if (primary.length !== 1 || others.length !== 1) return null', ''],
  [UI, 'a button that asks for input is pressed by voice', 'if (YES_WORDS.includes(said)) return primary[0]!.requires_input ? null : primary[0]!', 'if (YES_WORDS.includes(said)) return primary[0]!'],
  [UI, 'a label is matched loosely', 'actions.filter(action => sayNorm(action.label) === said)', 'actions.filter(action => sayNorm(action.label).includes(said))'],
  [UI, 'a build that is starting does not close the card', "return payload.phase === 'planning' || payload.phase === 'strawman' || payload.phase === 'building'", "return payload.phase === 'complete' || payload.phase === 'strawman'"],
  [UI, 'a thinking status does not close the card', "return payload.status === 'thinking' || payload.status === 'generating'", "return payload.status === 'generating'"],
  [UI, 'a card with junk buttons is trusted', "typeof a.label === 'string' && a.label.trim() && typeof a.value === 'string' && a.value", 'true'],
  [PAGE, 'a card is pressed by typing its label', 'sendAction: handleActionClick,', 'sendAction: (action) => handleSendMessage(undefined, action.label),'],
  [CTL, 'a progress line moves the waiting turn to speaking', "for (const sentence of sentences) this.enqueue(sentence, 'progress', this.cs.turn, false)", "for (const sentence of sentences) this.enqueue(sentence, 'progress', this.cs.turn, true)"],
  [CTL, 'the filler comes after the reply', 'replyTextArrived: awaiting.replyTextArrived,', 'replyTextArrived: false,'],
  [CTL, 'the filler is said twice', 'alreadyUsed: awaiting.fillerUsed,', 'alreadyUsed: false,'],
  [CTL, 'the filler ignores reduced motion', 'reducedMotion: this.env.reducedMotion(), speechOff: this.speechOff })', 'reducedMotion: false, speechOff: this.speechOff })'],
  [CTL, 'the turn never times out', 'if (now - awaiting.lastActivity > REPLY_TIMEOUT_MS)', 'if (false)'],
  [CTL, 'a frame does not keep the turn alive', 'if (this.awaiting) this.awaiting.lastActivity = now\n    const words', 'const words'],
  [CTL, 'the timeout is 20 s', 'export const REPLY_TIMEOUT_MS = 90000', 'export const REPLY_TIMEOUT_MS = 20000'],
  [CTL, 'talking over does not stop the speech', "case 'cancel_speech':\n        this.stopSpeech()\n        break", "case 'cancel_speech':\n        break"],
  [CTL, 'talking over does not cancel the turn', "case 'cancel_turn':\n        if", "case 'cancel_turn':\n        break\n        if"],
  [CTL, 'speech that failed is retried for ever', "if (!this.speechOff) {\n        this.speechOff = true", "if (!this.speechOff) {\n        this.speechOff = false"],
  [CTL, 'the character does not speak while a line plays', "return companionScene({ phase, speakingNow: this.speakingNow,", "return companionScene({ phase, speakingNow: false,"],
  [CTL, 'a turn whose reply arrived is still thinking', "const phase = this.cs.phase === 'thinking' && this.cs.replyDone ? 'idle' : this.cs.phase", "const phase = this.cs.phase"],
  [CTL, 'the voice does not wait for the gesture', "if (this.queue[0]!.kind === 'reply' && this.env.now() < this.replyLeadUntil) return", ''],
  [CTL, 'the lead is never set', 'this.replyLeadUntil = this.env.now() + REPLY_LEAD_MS', 'this.replyLeadUntil = 0'],
  [CTL, 'a beat hidden by speech is lost', 'if (this.beatHidden && !this.queue.length) { this.track = rearmBeat(this.track, this.env.now()); this.beatHidden = false }', ''],
  [CTL, 'a hidden beat is not noticed', 'this.beatHidden = true\n', 'this.beatHidden = false\n'],
  [UI, 'a report is shown again after it is said', "if (!beat || beat.scene === 'reporting') return track", 'if (!beat) return track'],
  [UI, 'a re-armed beat keeps its old end', 'beat: { scene: beat.scene, until: now + BEAT_MS[beat.scene] } }', 'beat: { scene: beat.scene, until: beat.until } }'],
  [CTL, 'a status outlives its build', "(signal.kind === 'pleased' && signal.big))) this.status = null", "false)) void 0"],
  [CTL, 'the caption never clears', 'now >= this.captionUntil) this.caption = null', 'false) this.caption = null'],
  [CTL, 'the mouth reads the speaker when it is silent', 'getLevel = (): number => (this.speakingNow ? this.player.level() : 0)', 'getLevel = (): number => this.player.level()'],
  [CTL, 'a snapshot is rebuilt for nothing', 'if (same) return\n    this.snapshot = next', 'this.snapshot = next'],
  // the hook and the components
  [HOOK, 'the flag does not gate the load', 'const enabled = options.enabled && STUDIO_VOICE_CALL_UI_ENABLED', 'const enabled = options.enabled'],
  [HOOK, 'the bus is not cleared', 'if (voiceCallBus.frame === made.onFrame) voiceCallBus.frame = null', ''],
  [HOOK, 'the call outlives the session', 'controller?.endCall()', 'void 0'],
  [HOOK, 'the controller is not disposed', 'made.dispose()', 'void 0'],
  [DOCK, 'the chip is not shown', '<span className="studio-voice-chip" data-chip={snapshot.chip} role="status"><i aria-hidden />{snapshot.chip}</span>', ''],
  [DOCK, 'expanding does not change the framing', "const framing = expanded ? 'chest' : 'disc'", "const framing = 'disc'"],
  [DOCK, 'the disc is not 64 on a phone', 'expanded ? CHEST_PX : phone ? DISC_PX_PHONE : DISC_PX_DESKTOP', 'expanded ? CHEST_PX : DISC_PX_DESKTOP'],
  [DOCK, 'a notice has no way to retry', '{notice.retry ? <button type="button" onClick={onRetry}>Try again</button> : null}', ''],
  [DOCK, 'the line is not shown', "{caption ? <p className=\"studio-voice-caption\"", "{false ? <p className=\"studio-voice-caption\""],
  [DOCK, 'the progress is not shown', '{snapshot.progress ? <p className="studio-voice-progress"', '{false ? <p className="studio-voice-progress"'],
  [DOCK, 'Stop is not off in your turn', 'disabled={!controls.stop}', 'disabled={false}'],
  [BUTTON, 'the button does not toggle its label', 'const label = callButtonLabel(active)', "const label = 'Start a voice call'"],
  [BUTTON, 'the button stays on while the mic is asked for', 'disabled={disabled || busy}', 'disabled={disabled}'],
  [PLAYER, 'a pack that fails shows nothing', "{!ready ? <span className=\"studio-voice-initials\" aria-hidden>{initialsFor(pack)}</span> : null}", ''],
  [UI, 'the disc is as wide as its crop', "return rect && framing === 'chest' ? Math.round(size * rect.sw / rect.sh) : size", 'return rect ? Math.round(size * rect.sw / rect.sh) : size'],
  [PLAYER, 'the player sizes itself by hand', 'const width = framedWidth(framing, size, rect)', 'const width = size'],
  // the sources
  [WS, 'the frame tap is not gated by the flag', 'if (STUDIO_VOICE_CALL_UI_ENABLED && isVoiceCallFrameType(parsedMessage.type)', 'if (isVoiceCallFrameType(parsedMessage.type)'],
  [WS, 'the frame tap shows another session\'s frames', "isVoiceCallFrameType(parsedMessage.type) && parsedMessage.session_id === socketSessionId && isCurrentSocket()) voiceCallBus", "isVoiceCallFrameType(parsedMessage.type) && isCurrentSocket()) voiceCallBus"],
  [WS, 'the voice fields are not gated', 'if (STUDIO_VOICE_CALL_UI_ENABLED) addVoiceCallFields(', 'if (true) addVoiceCallFields('],
  [WS, 'the voice fields are written by hand', 'addVoiceCallFields(message.data as unknown as Record<string, unknown>, text); // VOICE-CALL', "(message.data as unknown as Record<string, unknown>).mode = 'voice'; // VOICE-CALL"],
  [WS, 'the sent tap is for every message', "(message.data as unknown as Record<string, unknown>).mode === 'voice')", 'true)'],
  [PAGE, 'the hook is called with the flag only', 'enabled: studioShell,', 'enabled: true,'],
  [PAGE, 'the dock is drawn without the hook', '{voiceCall.dock}{/* VOICE-CALL', '{null}{/* VOICE-CALL'],
  [PAGE, 'the voice turn goes by another send', 'sendTurn: text => handleSendMessage(undefined, text)', 'sendTurn: text => sendMessage(text)'],
  [INPUT, 'the button is drawn with the flag off', '{voiceCall ? <VoiceCallButton', '{true ? <VoiceCallButton'],
  [INPUT, 'the button is first in the toolbar', "              {voiceCall ? <VoiceCallButton {...voiceCall} studio={studio} /> : null}{/* VOICE-CALL (NEXT_PUBLIC_STUDIO_VOICE_CALL): the call button, last in the left group; the only thing that asks for the microphone */}\n            </div>", "            </div>"],
]
const survivors = [], crashes = [], stale = []
let mutantCount = 0
const before = checks
for (const mutant of mutants) {
  const [rel, name, from, to] = mutant
  mutantCount++
  const text = SOURCES[rel]
  const at = text.indexOf(from)
  if (at < 0) { stale.push(`${name} (${rel})`); continue }
  const broken = text.slice(0, at) + to + text.slice(at + from.length)
  if (broken === text) { stale.push(`${name} (${rel}: changes nothing)`); continue }
  if (/\.(ts|tsx)$/.test(rel)) { try { compile(broken, rel) } catch (error) { crashes.push(`${name}: does not transpile`); survivors.push(`${name} (does not transpile: a mutant that is not valid code proves nothing)`); continue } }
  const saved = checks
  let caught = false
  try { await all({ [rel]: broken }) } catch (error) { caught = true; if (error?.name !== 'AssertionError') crashes.push(`${name}: ${String(error?.message).slice(0, 80)}`) }
  checks = saved
  if (!caught) survivors.push(name)
}
// the strip module itself
const stripText = fs.readFileSync(path.join(root, 'scripts/studio-voice-call-strip.mjs'), 'utf8')
let stripMutants = 0
if (baseSources) {
  const stripCases = [
    ['the marker matches inside a word', '/(?<![\\w-])VOICE-CALL(?![\\w-])/', '/VOICE-CALL/'],
    ['only the first marked line goes', '.filter(line => !VOICE_CALL_MARKER_RE.test(line))', '.filter((line, at, all) => !VOICE_CALL_MARKER_RE.test(line) || all.findIndex(l => VOICE_CALL_MARKER_RE.test(l)) !== at)'],
    ['the registry lines stay', "if (rel === 'scripts/studio-later-changes.mjs') return text.split('\\n').filter(line => !line.includes(VOICE_CALL_REGISTRY_MARK)).join('\\n')", 'if (false) return text'],
    ['a taught proof is not stripped', "if (!VOICE_CALL_FILES.includes(rel) && !VOICE_CALL_PIN_FILES.includes(rel)) return text", "if (!VOICE_CALL_FILES.includes(rel)) return text"],
    ['another file is stripped too', "if (!VOICE_CALL_FILES.includes(rel)) return text", 'if (false) return text'],
    ['the composer is not stripped', "export const VOICE_CALL_FILES = ['app/builder/page.tsx', 'hooks/use-deckster-websocket-v2.ts', 'components/builder/chat-input.tsx']", "export const VOICE_CALL_FILES = ['app/builder/page.tsx', 'hooks/use-deckster-websocket-v2.ts']"],
  ]
  const run = text => {
    const out = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const module = { exports: {} }; new Function('module', 'exports', out)(module, module.exports); return module.exports
  }
  for (const [name, from, to] of stripCases) {
    mutantCount++; stripMutants++
    ok(stripText.includes(from), `strip mutant "${name}" matches`)
    const mod = run(stripText.replace(from, () => to))
    const otherFile = mod.stripVoiceCall('lib/other.ts', 'x // VOICE-CALL\n') === 'x // VOICE-CALL\n'
    const token = mod.stripVoiceCall(PAGE, 'b // VOICE-CALL-X\n') === 'b // VOICE-CALL-X\n'
    const identity = strip.VOICE_CALL_FILES.every(rel => mod.stripVoiceCall(rel, SOURCES[rel]) === baseSources[rel])
    const first = mod.stripVoiceCall(PAGE, 'a // VOICE-CALL\nb // VOICE-CALL\n') === '\n'
    const regText = read('scripts/studio-later-changes.mjs')
    const registryOut = mod.stripVoiceCall('scripts/studio-later-changes.mjs', regText).split('\n').length === regText.split('\n').length - 3
    const pinsOut = strip.VOICE_CALL_PIN_FILES.every(rel => mod.stripVoiceCall(rel, read(rel)).split('\n').every(line => !strip.VOICE_CALL_MARKER_RE.test(line)))
    if (otherFile && token && identity && first && registryOut && pinsOut) survivors.push(`strip: ${name}`)
  }
}
checks = before + 0
console.log(`stale mutants: ${stale.join('; ') || 'none'}; survivors: ${survivors.join('; ') || 'none'}`)
eq(stale, [], 'every mutant still matches its source')
eq(survivors, [], `every mutant is caught (survivors: ${survivors.join('; ') || 'none'})`)
console.log(`PASS E  ${mutantCount} mutants (${stripMutants} of the strip), every one caught${crashes.length ? ` (${crashes.length} by a thrown error)` : ''}`)
if (process.env.VOICE_TEST_VERBOSE) for (const crash of crashes) console.log(`  threw: ${crash}`)
release()
console.log(`OK studio voice call: ${checks} checks`)
