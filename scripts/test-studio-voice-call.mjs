// FRONTEND-1 (W6 P4-20 "Talk to the Director", the Studio voice call UI): proof of NEXT_PUBLIC_STUDIO_VOICE_CALL (the string "true", default off, build-time) and NEXT_PUBLIC_STUDIO_VOICE_COMPANION.
//   lib/studio-voice-call-ui.ts (pure: flag, wire, frame -> scene, scene -> clips, framing, words), lib/studio-voice-call-router.ts (the same-origin seam to model-router), lib/studio-voice-call-controller.ts (one call's life,
//   run here against ELEMENT-3's REAL core with a virtual clock and fakes), hooks/use-studio-voice-call.ts, components/builder/voice-call/*, and the marked lines in app/builder/page.tsx, hooks/use-deckster-websocket-v2.ts and
//   components/builder/chat-input.tsx, the .env.example block, the registry. The Director side is DIRECTOR-2's final P4-18 schema (client cap voice1, user_message data.mode "voice", payload.spoken, payload.companion_state).
//
//   A.  The lib, function by function (flags, the armed voice turn and its fields, every row of the frame -> scene table and the companion_state hint, spoken lines, the track, the scene, the chip, the clip plans, frames at a time,
//       the mouth, the framing, the controls, the words).
//   A2. The router seam (a fake fetch: statuses -> kinds, abort, nothing requested until a method is called).
//   B.  The controller against the real core: the microphone is asked for by the call and by nothing else, honest errors, push-to-talk, the voice turn (armed words, mode and cap), the reply's spoken line only, talk-over and Stop,
//       the filler, progress lines between turns, the timeout, the character's scene from Director's frames, audio or video, mute, tap-to-talk, the live transcript, the level, tear-down (no timer, no track left).
//   C.  The components drawn offline (the call stage in audio and video, its transcript and controls, the scene art, the two call buttons, the player's fallback) and the hook (flag off: nothing loaded, listened to or timed).
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
const HOOK = 'hooks/use-studio-voice-call.ts', STAGE = 'components/builder/voice-call/voice-call-stage.tsx', BUTTONS = 'components/builder/voice-call/voice-call-buttons.tsx', PLAYER = 'components/builder/voice-call/companion-player.tsx'
const LAYERED = 'components/builder/voice-call/layered-face.ts'
const CSS = 'components/builder/voice-call/voice-call.css'
const PAGE = 'app/builder/page.tsx', WS = 'hooks/use-deckster-websocket-v2.ts', INPUT = 'components/builder/chat-input.tsx'
const CORE = 'lib/studio/voice'
const CORE_STRIP = 'scripts/studio-voice-core-strip.mjs'
const SOURCES = Object.fromEntries([UI, ROUTER, CTL, BROWSER, HOOK, STAGE, BUTTONS, PLAYER, LAYERED, CSS, PAGE, WS, INPUT, CORE_STRIP, '.env.example'].map(rel => [rel, read(rel)]))

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
  for (const [value, want] of [[undefined, 'felix'], ['', 'felix'], ['bob', 'bob'], ['felix', 'felix'], ['deckster-owl', 'deckster-owl'], ['Bob', 'felix'], ['../etc', 'felix'], ['a/b', 'felix'], ['-x', 'felix'], ['x'.repeat(33), 'felix'], ['x'.repeat(32), 'x'.repeat(32)], ['b o b', 'felix'], ['bob.webp', 'felix']]) {
    eq(ui.companionNameFrom(value), want, `companion name: ${String(value).slice(0, 20)}`)
  }
  eq(loadUi(over, { NEXT_PUBLIC_STUDIO_VOICE_COMPANION: 'toy-1' }).STUDIO_VOICE_COMPANION, 'toy-1', 'companion: read from the environment')
  eq(loadUi(over, {}).STUDIO_VOICE_COMPANION, 'felix', 'companion: default is Felix')

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
  eq([ui.AUDIO_DISC_PX, ui.AUDIO_DISC_PX_PHONE, ui.VOICE_PHONE_MEDIA], [176, 148, '(max-width: 767px)'], 'sizes: the audio call\'s disc is 176 px (148 on a phone), and a phone is 767 px and narrower')
  eq(['bob', 'deckster-owl', 'a', 'x-y-z', '', 'DECK'].map(ui.initialsFor), ['B', 'DO', 'A', 'XY', 'D', 'DECK'.slice(0, 1)], 'initials: one or two capitals')
  eq(ui.callControls({ active: false, starting: false, phase: 'idle', speakingNow: false, connected: true }), { talk: false, stop: false, mute: false, end: false }, 'controls: nothing before the call')
  eq(ui.callControls({ active: true, starting: false, phase: 'idle', speakingNow: false, connected: true }), { talk: true, stop: false, mute: true, end: true }, 'controls: in a call, your turn')
  eq(ui.callControls({ active: true, starting: false, phase: 'speaking', speakingNow: true, connected: true }).stop, true, 'controls: Stop while Director speaks'); eq(ui.callControls({ active: true, starting: false, phase: 'thinking', speakingNow: false, connected: true }).stop, true, 'controls: Stop while a turn waits')
  eq(ui.callControls({ active: true, starting: false, phase: 'idle', speakingNow: false, connected: false }).talk, false, 'controls: no talking without a socket'); eq(ui.callControls({ active: true, starting: true, phase: 'idle', speakingNow: false, connected: true }), { talk: false, stop: false, mute: false, end: false }, 'controls: nothing while the microphone is being asked for')
  eq(ui.callControls({ active: true, starting: false, phase: 'idle', speakingNow: false, connected: true, muted: true }), { talk: false, stop: false, mute: true, end: true }, 'controls: muted: no talking, but the microphone can be unmuted and the call ended')
  eq([ui.callButtonLabel('audio'), ui.callButtonLabel('video'), ui.CALL_MODES, ['audio', 'video', 'both', '', null, 1].map(ui.isCallMode)], ['Start an audio call', 'Start a video call', ['audio', 'video'], [true, true, false, false, false, false]], 'buttons: Audio and Video, named')
  eq([{ tagName: 'TEXTAREA' }, { tagName: 'input' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }, { tagName: 'BUTTON' }, { tagName: 'DIV' }, null].map(ui.isTypingTarget), [true, true, true, true, false, false, false], 'typing target: text fields keep their Space')
  const el = (tagName, attrs = {}, own = false, editable = false) => ({ tagName, isContentEditable: editable, getAttribute: name => attrs[name] ?? null, closest: () => (own ? {} : null) })
  eq([el('TEXTAREA'), el('INPUT'), el('SELECT'), el('DIV', {}, false, true), el('BUTTON'), el('A'), el('SUMMARY'), el('DIV', { role: 'menuitem' }), el('DIV', { role: 'tab' }), el('SPAN', { role: 'checkbox' }), el('DIV'), el('BODY'), el('SPAN'), null, undefined].map(ui.spaceBelongsToTarget),
    [true, true, true, true, true, true, true, true, true, true, false, false, false, false, false], 'space: a text field and every other control that Space activates keep their Space; the page itself does not')
  eq([ui.spaceBelongsToTarget(el('BUTTON', {}, true)), ui.spaceBelongsToTarget(el('SPAN', { role: 'button' }, true))], [false, false], 'space: ...except the talk button: Space talks there (focus stays on it after it is pressed)')
  {
    // focus on the way out of a call: only when it was lost with the call (the page itself) or is still in the call's UI; anywhere else is the person's
    const at = (tagName, inCall = false) => ({ tagName, closest: selector => (selector === '[data-studio-voice-call]' && inCall ? {} : null) })
    eq([null, undefined, at('BODY'), at('body'), at('HTML'), at('BUTTON', true), at('DIV', true), at('BUTTON'), at('TEXTAREA'), at('A'), at('INPUT'), at('DIV'), { tagName: 'DIV' }].map(ui.callEndFocusGoesToComposer),
      [true, true, true, true, true, true, true, false, false, false, false, false, false], 'call end focus: the page itself (nothing, body, html) and the call\'s own UI give the composer the focus; the sidebar, a menu, a field, a link, a dialog keep theirs')
  }
  eq([{ code: 'Space' }, { key: ' ' }, { code: 'Space', repeat: true }, { code: 'Space', metaKey: true }, { code: 'Space', ctrlKey: true }, { code: 'Space', altKey: true }, { code: 'Space', shiftKey: true }, { code: 'KeyA' }].map(ui.isTalkKey), [true, true, false, false, false, false, false, false], 'talk key: Space alone, not a repeat')
  eq(['not_connected', 'limit', 'failed', 'too_short', 'no_words', 'not_sent', 'no_answer'].every(problem => ui.describeSpeechProblem(problem).title && ui.describeSpeechProblem(problem).steps.length > 0), true, 'words: every speech problem has a title and a step')
  eq(ui.describeSpeechProblem('not_connected').title, "Speech isn't connected yet", 'words: the honest one for a missing router')
  eq([ui.progressCaption('Building slide 3', 'working'), ui.progressCaption('Building slide 3', 'idle'), ui.progressCaption(null, 'working'), ui.progressCaption('  ', 'working'), ui.progressCaption('Researching', 'thinking')], ['Building slide 3', null, null, null, 'Researching'], 'progress caption: under the disc while Director works or thinks')
  const long = 'Researching the market for each of the six slides in detail and checking every source again'
  ok(ui.progressCaption(long, 'working').endsWith('…') && ui.progressCaption(long, 'working').length <= 81 && !ui.progressCaption(long, 'working').slice(0, -1).endsWith(' '), 'progress caption: cut at a word')
  // ---- the call's transcript, its scene, its talk button ----
  {
    const talkOnly = sel => ({ tagName: 'BUTTON', getAttribute: () => null, closest: s2 => (s2 === '.studio-voice-talk' ? {} : null) })
    eq([ui.spaceBelongsToTarget(talkOnly()), ui.spaceBelongsToTarget({ tagName: 'BUTTON', getAttribute: () => null, closest: () => null })], [false, true], 'space: only the talk button (.studio-voice-talk) is excepted; Stop, Mute, End and the transcript toggle keep their Space')
    const add = ui.appendTranscript
    let list = []
    list = add(list, 'you', '  make the title\n shorter  '); eq(list, [{ id: 1, who: 'you', text: 'make the title shorter' }], 'transcript: a line is trimmed and its spaces collapsed')
    eq([add(list, 'you', '   '), add(list, 'director', ''), add(list, 'you', undefined)].every(next => next === list), true, 'transcript: a blank line adds nothing (the same list comes back)')
    eq(add(list, 'you', 'make the title shorter') === list, true, 'transcript: the same line twice in a row by the same speaker is not repeated')
    list = add(list, 'director', 'Sure. Shortened.'); list = add(list, 'you', 'make the title shorter'); eq(list.map(entry => [entry.id, entry.who]), [[1, 'you'], [2, 'director'], [3, 'you']], 'transcript: ...but the same words after the other speaker are a new line (ids count up)')
    const joined = add(list, 'you', 'and the subtitle', undefined, true); eq([joined.length, joined[2].text, joined[2].id], [3, 'make the title shorter and the subtitle', 3], 'transcript: join carries on the same speaker\'s last entry, keeping its id')
    eq(add(list, 'director', 'New.', undefined, true).length, 4, 'transcript: ...but never joins the other speaker\'s entry')
    let many = []; for (let i = 0; i < 70; i++) many = add(many, i % 2 ? 'you' : 'director', `line ${i}`)
    eq([many.length, many[0].text, many[many.length - 1].text, ui.TRANSCRIPT_MAX], [60, 'line 10', 'line 69', 60], 'transcript: the newest 60 are kept')
    eq(add([], 'you', 'x', 1).length, 1, 'transcript: the cap is a parameter'); eq(add(add([], 'you', 'a', 1), 'director', 'b', 1).map(entry => entry.text), ['b'], 'transcript: ...and the oldest goes first')
    const frozen = Object.freeze([]); add(frozen, 'you', 'x'); eq(frozen.length, 0, 'transcript: pure (the list given is not changed)')
    eq([ui.TRANSCRIPT_SHARE, ui.SCENE_SHARE], [0.2, 0.8], 'scene: the transcript is the bottom fifth, the scene the rest')
    eq([ui.videoCharacterPx(900), ui.videoCharacterPx(844), ui.videoCharacterPx(0), ui.videoCharacterPx(NaN), ui.videoCharacterPx(100), ui.videoCharacterPx(5000)], [562, 527, 240, 240, 160, 640], 'scene: the character fills the scene\'s share of the call, less room for the overlays, within 160 and 640 px')
    eq([ui.sceneFileFrom(undefined), ui.sceneFileFrom('scene.webp'), ui.sceneFileFrom('scenes/desk-01.png'), ui.sceneFileFrom('../x.webp'), ui.sceneFileFrom('/etc/x.webp'), ui.sceneFileFrom('a//b.webp'), ui.sceneFileFrom('x.gif'), ui.sceneFileFrom('x.webp?y=1'), ui.sceneFileFrom(7), ui.sceneFileFrom(' room.jpg ')],
      ['scene.webp', 'scene.webp', 'scenes/desk-01.png', 'scene.webp', 'scene.webp', 'scene.webp', 'scene.webp', 'scene.webp', 'scene.webp', 'room.jpg'], 'scene: a pack\'s scene file is a web image inside its own folder, else scene.webp')
    eq([ui.sceneUrl('bob', 'scene.webp'), ui.DEFAULT_SCENE_FILE], ['/companions/bob/scene.webp', 'scene.webp'], 'scene: the image is read from the pack\'s folder')
    eq([ui.talkLabel({ holding: false, latched: false, muted: false }), ui.talkLabel({ holding: true, latched: false, muted: false }), ui.talkLabel({ holding: true, latched: true, muted: false }), ui.talkLabel({ holding: false, latched: false, muted: true }), ui.talkLabel({ holding: true, latched: true, muted: true })],
      ['Hold to talk', 'Release to send', 'Tap to send', 'Muted', 'Muted'], 'talk button: it says what the next press or letting go does')
    eq([ui.companionName('bob'), ui.companionName('deckster-owl'), ui.companionName(''), ui.companionName('---')], ['Bob', 'Deckster Owl', 'Companion', 'Companion'], 'transcript: the companion goes by its pack\'s name')
    eq([ui.ringLevel(0), ui.ringLevel(-1), ui.ringLevel(NaN), ui.ringLevel(0.1), ui.ringLevel(0.2), ui.ringLevel(0.333), ui.ringLevel(0.5), ui.ringLevel(9)], [0, 0, 0, 0.4, 0.8, 1, 1, 1], 'ring: a quiet voice (0.05 to 0.3) is most of the ring, clamped to 0..1, two decimals')
    eq([ui.TAP_TALK_MS, ui.LATCH_MAX_MS], [300, 60000], 'talk: a press under 300 ms is a tap (it latches); a latch left on is sent after a minute')
    eq([ui.MUTE_LABEL, ui.UNMUTE_LABEL], ['Mute microphone', 'Unmute microphone'], 'mute: named')
    // the character: Felix by default, then Bob and Maya, remembered per device
    eq([ui.DEFAULT_COMPANION, ui.COMPANION_CHOICES, ui.COMPANION_STORAGE_KEY], ['felix', ['felix', 'bob', 'maya'], 'deckster.studio.voiceCompanion'], 'character: Felix is the default, Bob and Maya the others')
    eq([ui.companionChoices('felix'), ui.companionChoices('bob'), ui.companionChoices('maya'), ui.companionChoices('deckster-owl')], [['felix', 'bob', 'maya'], ['bob', 'felix', 'maya'], ['maya', 'felix', 'bob'], ['deckster-owl', 'felix', 'bob', 'maya']], 'character: the build\'s default is always on offer, then Felix, Bob and Maya, none twice')
    const store = (initial = {}) => { const data = { ...initial }; return { data, getItem: key => (key in data ? data[key] : null), setItem: (key, value) => { data[key] = value } } }
    eq([ui.readCompanionChoice(store(), 'felix'), ui.readCompanionChoice(store({ 'deckster.studio.voiceCompanion': 'bob' }), 'felix'), ui.readCompanionChoice(store({ 'deckster.studio.voiceCompanion': 'felix' }), 'felix')], ['felix', 'bob', 'felix'], 'character: a device\'s choice is read, else the default')
    eq([ui.readCompanionChoice(store({ 'deckster.studio.voiceCompanion': '../etc' }), 'felix'), ui.readCompanionChoice(store({ 'deckster.studio.voiceCompanion': 'toy' }), 'felix'), ui.readCompanionChoice(store({ 'deckster.studio.voiceCompanion': 7 }), 'felix'), ui.readCompanionChoice(null, 'felix'), ui.readCompanionChoice(undefined, 'bob')], ['felix', 'felix', 'felix', 'felix', 'bob'], 'character: a stored name that is not on offer is not believed; no storage is the default')
    eq(ui.readCompanionChoice({ getItem() { throw new Error('blocked') }, setItem() {} }, 'felix'), 'felix', 'character: storage that throws is the default (a private window, blocked site data)')
    const kept = store(); eq([ui.writeCompanionChoice(kept, 'bob', 'felix'), kept.data], [true, { 'deckster.studio.voiceCompanion': 'bob' }], 'character: the choice is written')
    eq([ui.writeCompanionChoice(kept, 'toy', 'felix'), ui.writeCompanionChoice(null, 'bob', 'felix'), ui.writeCompanionChoice({ getItem: () => null, setItem() { throw new Error('quota') } }, 'bob', 'felix'), kept.data], [false, false, false, { 'deckster.studio.voiceCompanion': 'bob' }], 'character: only a character on offer is written, and a write that fails is not an error')
    eq([ui.nextCompanion('felix', ['felix', 'bob']), ui.nextCompanion('bob', ['felix', 'bob']), ui.nextCompanion('owl', ['felix', 'bob']), ui.nextCompanion('x', []), ui.nextCompanion('a', ['a'])], ['bob', 'felix', 'felix', 'x', 'a'], 'character: one tap goes to the next, round the list (one that is not on offer goes to the first)')
    // Maya, the third: one tap goes round all three, her choice is remembered like the others
    eq([ui.nextCompanion('felix', ui.COMPANION_CHOICES), ui.nextCompanion('bob', ui.COMPANION_CHOICES), ui.nextCompanion('maya', ui.COMPANION_CHOICES), ui.nextCompanion('x', ui.COMPANION_CHOICES)], ['bob', 'maya', 'felix', 'felix'], 'character: one tap cycles through all three: Felix, Bob, Maya, Felix')
    eq([ui.readCompanionChoice(store({ 'deckster.studio.voiceCompanion': 'maya' }), 'felix'), ui.readCompanionChoice(store({ 'deckster.studio.voiceCompanion': 'maya' }), 'bob'), ui.readCompanionChoice(store({ 'deckster.studio.voiceCompanion': 'Maya' }), 'felix')], ['maya', 'maya', 'felix'], 'character: Maya is remembered on a device (her name is the folder\'s: another spelling is not believed)')
    const mayaKept = store(); eq([ui.writeCompanionChoice(mayaKept, 'maya', 'felix'), mayaKept.data], [true, { 'deckster.studio.voiceCompanion': 'maya' }], 'character: Maya\'s choice is written')
    eq([ui.companionName('maya'), ui.companionNameFrom('maya'), ui.initialsFor('maya')], ['Maya', 'maya', 'M'], 'character: Maya goes by her name in the top bar and the transcript')
    // a pack with a layered (v2) face is read in its compatibility view; the section is kept whole for the v2 renderer
    {
      const layered = { angles: ['front', 'left', 'right'], pieces: { mouth: { front: { closed: 'layers/mouth_front_closed.webp' } } }, patch: {}, heads: {}, recipes: {} }
      const v1Pointer = { manifest: 'face/manifest.json', totalBytes: 10 }
      eq([ui.isLayeredFace(layered), ui.isLayeredFace(v1Pointer), ui.isLayeredFace({ manifest: 'x.json', pieces: {} }), ui.isLayeredFace({ pieces: {} }), ui.isLayeredFace({}), ui.isLayeredFace([]), ui.isLayeredFace(null), ui.isLayeredFace(undefined), ui.isLayeredFace('face'), ui.isLayeredFace(7), ui.isLayeredFace({ pieces: 'x' })],
        [true, false, false, true, false, false, false, false, false, false, false], 'layered face: an object with its pieces and no pointer is the v2 section; the v1 pointer (a manifest path) and anything else is not')
      const raw = { version: 1, bird: 'maya', neutral: 'neutral', frames: { neutral: { src: 'neutral.webp' } }, clips: { idle_breathe: { frames: ['neutral'], fps: 2 } }, face: layered }
      const view = ui.compatCatalog(raw)
      eq([view.layered === layered, 'face' in view.catalog, Object.keys(view.catalog).sort(), raw.face === layered], [true, false, ['bird', 'clips', 'frames', 'neutral', 'version'], true], 'compat view: the catalog is the manifest without its layered face, the section is kept whole beside it, and the manifest read is not changed')
      const v1 = { ...raw, face: v1Pointer }
      eq([ui.compatCatalog(v1).catalog === v1, ui.compatCatalog(v1).layered], [true, null], 'compat view: a v1 pack (a Face pointer) is handed through as it is')
      const plain = { ...raw }; delete plain.face
      eq([ui.compatCatalog(plain).catalog === plain, ui.compatCatalog(plain).layered, ui.compatCatalog({ ...raw, face: 'x' }).catalog.face, ui.compatCatalog({ ...raw, face: 'x' }).layered], [true, null, 'x', null], 'compat view: no face, or a face that is neither form, is left for the core\'s parser to refuse')
      eq([ui.compatCatalog(null), ui.compatCatalog(undefined), ui.compatCatalog('x'), ui.compatCatalog(7), ui.compatCatalog([raw]).layered], [{ catalog: null, layered: null }, { catalog: undefined, layered: null }, { catalog: 'x', layered: null }, { catalog: 7, layered: null }, null], 'compat view: nothing that is not an object is touched (and nothing throws)')
      eq([ui.portraitUrl('maya'), ui.portraitUrl('bob')], ['/companions/maya/portrait-512.webp', '/companions/bob/portrait-512.webp'], 'portrait: the fallback still is the pack\'s 512 px portrait')
    }
    // a companion catalog (Bob's motion/companion.json) is merged into the base only when the base lacks lean_in
    const baseCatalog = { version: 1, bird: 'bob', packBudgetMiB: 8, totalBytes: 6000000, uniqueFrames: 2, neutral: 'neutral', frames: { neutral: { src: 'neutral.webp' }, a: { src: 'a.webp' } }, clips: { idle_breathe: { frames: ['neutral'], fps: 4 }, nod: { frames: ['a'], fps: 4 } } }
    const companionCatalog = { totalBytes: 4700000, frames: { neutral: { src: 'OTHER.webp' }, lean_1: { src: 'lean_1.webp' } }, clips: { idle_breathe: { frames: ['neutral'], fps: 9 }, lean_in: { frames: ['lean_1'], fps: 6 } } }
    eq([ui.needsCompanionCatalog(baseCatalog), ui.needsCompanionCatalog({ clips: { lean_in: {} } }), ui.needsCompanionCatalog({}), ui.needsCompanionCatalog(null), ui.needsCompanionCatalog(undefined), ui.needsCompanionCatalog('x')], [true, false, false, false, false, false], 'catalog: asked for only when the base has no lean_in (Felix\'s one manifest is never followed by a request)')
    const merged = ui.mergeCompanionCatalog(baseCatalog, companionCatalog)
    eq([Object.keys(merged.clips).sort(), Object.keys(merged.frames).sort(), merged.uniqueFrames, merged.frames.neutral.src, merged.clips.idle_breathe.fps], [['idle_breathe', 'lean_in', 'nod'], ['a', 'lean_1', 'neutral'], 3, 'neutral.webp', 4], 'catalog: the companion\'s clips and frames are added and the base\'s win')
    eq([merged.totalBytes, merged.packBudgetMiB, merged.bird, merged.neutral], [8 * 1024 * 1024, 8, 'bob', 'neutral'], 'catalog: the combined size is capped at the budget (the two share their frames), the rest of the base is kept')
    eq(ui.mergeCompanionCatalog({ ...baseCatalog, totalBytes: 1000 }, { ...companionCatalog, totalBytes: 2000 }).totalBytes, 3000, 'catalog: below the budget the sizes add')
    eq([ui.mergeCompanionCatalog(baseCatalog, null) === baseCatalog, ui.mergeCompanionCatalog(baseCatalog, 'x') === baseCatalog, ui.mergeCompanionCatalog(baseCatalog, { clips: {} }) === baseCatalog, ui.mergeCompanionCatalog({ clips: {} }, companionCatalog) !== undefined], [true, true, true, true], 'catalog: one that is missing or not a catalog leaves the base as it is')
    eq([ui.mergeCompanionCatalog({ ...baseCatalog, packBudgetMiB: 99 }, companionCatalog).packBudgetMiB, ui.mergeCompanionCatalog({ ...baseCatalog, packBudgetMiB: undefined }, companionCatalog).packBudgetMiB, ui.mergeCompanionCatalog({ ...baseCatalog, packBudgetMiB: 6 }, companionCatalog).totalBytes], [8, 8, 6 * 1024 * 1024], 'catalog: the pack\'s budget is 6 to 8 MiB, as the core\'s parser holds it')
    eq(Object.keys(baseCatalog.clips), ['idle_breathe', 'nod'], 'catalog: the base is not changed')
    eq(ui.scenePlan('speaking').accent, { clip: 'emphasis', reverse: false, everyMs: [7000, 11000] }, 'clips: while it speaks, an emphasis now and then'); eq(ui.clipsForScene('speaking'), ['talk_neutral', 'emphasis'], 'clips: ...which is asked for early')
  }
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
function makeCall({ over = {}, mic = {}, reduced = false, connected = true, sendObserved = true, takes = true, transcripts = ['make the title shorter'], speakFails = null, transcribeFails = null, costs = {}, identity = false } = {}) {
  const host = makeHost({ env: identity ? { ...ENV_ON, NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED: 'true' } : ENV_ON, over })
  const ctlMod = host.load(CTL), ui = host.load(UI), router = host.load(ROUTER), core = host.load('lib/studio/voice/index.ts')
  const clock = new Clock()
  const log = { primed: [], micOpened: 0, micClosed: 0, recordings: [], cancelled: 0, plays: [], stops: 0, transcribed: [], spoken: [], sent: [], wire: [], actions: [], aborted: 0, errors: [], muted: [] }
  const player = { level: 0.3, play(blob, hooks) { log.plays.push({ blob, hooks }) }, stop() { log.stops++ }, getLevel() { return this.level } }
  const recordingSpec = { durationMs: 1200, peak: 0.2, ...mic.recording }
  const env = {
    secureContext: () => mic.insecure !== true, hasMic: () => mic.unsupported !== true,
    openMic: async () => {
      if (mic.error) throw Object.assign(new Error('x'), { name: mic.error })
      if (mic.deferred) await mic.deferred
      log.micOpened++
      return { ...(mic.noMeter ? {} : { level: () => mic.level ?? 0 }), setMuted: muted => { log.muted.push(muted) }, record: () => { const rec = { stopped: false, stop: async () => { rec.stopped = true; return { blob: new Blob(['audio']), durationMs: recordingSpec.durationMs, peak: recordingSpec.peak } }, cancel: () => { log.cancelled++ } }; log.recordings.push(rec); return rec }, close: () => { log.micClosed++ } }
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
  const sendAction = async (action, messageId, answerKey) => {
    // The page's own click on a card's button (handleActionClick) with the armed words: the button's label and value, and the voice fields from the socket hook.
    const data = { text: action.label, action_value: action.value, action_label: action.label, client_caps: ['mdc1'] }
    if (takes) ui.addVoiceCallFields(data, action.label)
    log.wire.push(data); log.actions.push({ action, messageId, answerKey })
    if (sendObserved && data.mode === 'voice') ctl.onSent(action.label)
  }
  ctl = new ctlMod.VoiceCallController({ env, port, sendTurn, sendAction, isConnected: () => state.connected })
  const world = {
    ctl, ui, env, clock, log, player, state, ctlMod, core,
    snap: () => ctl.getSnapshot(),
    start: async mode => { await ctl.startCall(mode); await settle() },
    press: async () => { ctl.talkPress(); await settle() },
    release: async () => { ctl.talkRelease(); await settle() },
    talk: async (ms = 1250) => { ctl.pttDown(); await settle(); await clock.advance(ms); await ctl.pttUp(); await settle() },
    frame: async (type, payload = {}, id = null, extra = {}) => { ctl.onFrame({ ...frame(type, payload, id), ...extra }); await settle() },
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
    eq([w.snap().starting, w.snap().active, w.snap().controls], [true, false, { talk: false, stop: false, mute: false, end: false }], 'mic: while the browser asks, the call is starting and nothing is live')
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
    // (P4-21, found by the replay of the recordings) a progress bubble that came before Stop is "reply text" for the filler, but it is not the reply: the reply that follows is still the stopped turn's, and is not said
    const w = makeCall({ over }); await w.start(); await w.talk()
    await w.frame('chat_message', { text: 'Reviewing your topic\u2026', ephemeral: true }); w.ctl.stop(); await settle()
    await w.reply('Late answer.'); eq([w.log.spoken, w.snap().phase], [[], 'idle'], 'stop: a progress bubble before Stop does not make the stopped turn\'s reply one to be said')
    await w.reply('A later, unasked report.'); eq(w.log.spoken, ['A later, unasked report.'], 'stop: ...and only that one is skipped')
    // (P4-21) the user talks over a pending turn, and its reply arrives while they are still talking: it is not said, and the debt is paid, so the next report that nobody asked for is said
    const listening = makeCall({ over }); await listening.start(); await listening.talk(); listening.ctl.pttDown(); await settle()
    await listening.reply('Said to nobody.'); eq(listening.log.spoken, [], 'floor: the reply to the turn the user talked over, arriving while they talk, is not said')
    await listening.clock.advance(1000); await listening.ctl.pttUp(); await settle()
    await listening.reply('The next report.'); eq(listening.log.spoken, ['The next report.'], 'floor: ...and it was the reply that was owed: the next report that nobody asked for is said')
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
    // (P4-21, found by the replay of the recordings) a status is only worth saying while the wait goes on: once the reply (or the card) it came before has arrived it is stale, and is not said after it
    const before = makeCall({ over }); await before.start()
    await before.frame('status_update', { status: 'generating', text: 'x', spoken: 'Analyzing presentation strategy' }); await before.reply(undefined, 'Here is the plan.'); await before.clock.advance(30000)
    eq(before.log.spoken, [], 'progress: a status that came before the reply is not said after it')
    await before.frame('build_phase', { phase: 'building', spoken: 'Building the slides' }); await before.clock.advance(5000)
    eq(before.log.spoken, ['Building the slides'], 'progress: ...a status after the reply is')
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
  // the spoken yes is a click in everything but its mode: the button's value AND label, voice + voice1 in that message's own caps, marked answered by the click path's own key (askAnswerKey)
  {
    const PLAN = [{ label: "Yes, let's build it!", value: 'accept_plan', primary: true, requires_input: false }, { label: "I'd like to make changes", value: 'reject_plan', primary: false, requires_input: false }]
    const WHEN = '2026-11-02T01:23:45.000Z'
    for (const [identity, key] of [[false, 'plan-card'], [true, `plan-card\u0000${WHEN}`]]) {
      const w = makeCall({ over, identity, transcripts: ['yes'] }); await w.start(); await w.frame('action_request', { actions: PLAN, prompt_text: 'Does this structure work for you?' }, 'plan-card', { timestamp: WHEN }); await w.talk()
      eq([w.log.actions.length, w.log.actions[0]?.action.value, w.log.actions[0]?.action.label, w.log.actions[0]?.messageId, w.log.actions[0]?.answerKey], [1, 'accept_plan', "Yes, let's build it!", 'plan-card', key], `card: the spoken yes is marked answered by askAnswerKey of the card (identity flag ${identity ? 'on: id and timestamp' : 'off: the bare id'})`)
      const sent = w.log.wire[0]
      eq([sent.text, sent.action_value, sent.action_label, sent.mode, sent.client_caps.includes('voice1')], ["Yes, let's build it!", 'accept_plan', "Yes, let's build it!", 'voice', true], 'card: the message carries the button\'s value AND label (as a click does), mode "voice" and voice1 in its own client_caps (else Director counts a click and ends voice mode)')
    }
    const bare = { text: "Yes, let's build it!", action_value: 'accept_plan', action_label: "Yes, let's build it!" }
    const armed = makeCall({ over }); armed.ui.armVoiceTurn(bare.text)
    eq(armed.ui.addVoiceCallFields({ ...bare }, bare.text), { ...bare, mode: 'voice', client_caps: ['voice1'] }, 'card: even a message with no caps of its own gets voice1 and the mode (they are not read from the session\'s last list)')
    const noStamp = makeCall({ over, identity: true, transcripts: ['yes'] }); await noStamp.start(); await noStamp.frame('action_request', { actions: PLAN, prompt_text: 'x' }, 'plan-card'); await noStamp.talk()
    eq(noStamp.log.actions[0]?.answerKey, 'plan-card\u0000', 'card: a card with no timestamp is keyed as the click path keys it (id and an empty stamp)')
  }
  // a typed message in the middle of a call: the call stays open and that reply is not said (no payload.spoken arrives: Director's voice mode ends with it)
  {
    const w = makeCall({ over }); await w.start()
    await w.frame('status_update', { status: 'thinking', text: 'Thinking…' }); await w.frame('chat_message', { text: 'I changed the title as you typed.' }, 'typed-reply'); await w.clock.advance(5000)
    eq([w.log.spoken, w.snap().active, w.snap().phase, w.log.micClosed], [[], true, 'idle', 0], 'typed: a reply to a typed message (no spoken line) says nothing and the call stays open, the microphone held')
    await w.talk(); eq(w.log.sent, ['make the title shorter'], 'typed: ...and the next voice turn is a voice turn again')
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

  // ---- audio or video, and the controls of the redesigned call: mute, tap-to-latch, the transcript, the level ---------------------------------------
  {
    const m = makeCall({ over }); await m.start()
    eq([m.snap().mode, m.snap().muted, m.snap().latched, m.snap().transcript, m.snap().controls.mute], ['audio', false, false, [], true], 'call: starts as an audio call, not muted, nothing said, Mute available')
    m.ctl.endCall(); await settle(); await m.start('video'); eq(m.snap().mode, 'video', 'call: the video button starts a video call'); m.ctl.endCall(); await settle(); await m.start('audio'); eq(m.snap().mode, 'audio', 'call: ...and the audio button an audio call')
    const idle = makeCall({ over }); idle.ctl.setMuted(true); eq([idle.snap().muted, idle.log.muted], [false, []], 'mute: nothing to mute before a call')
    // mute: nothing can be said, a recording in progress is dropped, the microphone's tracks are told
    m.ctl.setMuted(true); await settle()
    eq([m.snap().muted, m.snap().controls.talk, m.snap().controls.mute, m.log.muted], [true, false, true, [true]], 'mute: muted: the talk button is off, Mute stays (it is Unmute), the microphone is told')
    m.ctl.pttDown(); m.ctl.talkPress(); await settle(); eq([m.snap().holding, m.snap().phase, m.log.recordings.length], [false, 'idle', 0], 'mute: ...nobody can talk (button or Space)')
    m.ctl.setMuted(true); eq(m.log.muted, [true], 'mute: muting twice tells the microphone once')
    m.ctl.setMuted(false); await settle(); eq([m.snap().muted, m.snap().controls.talk, m.log.muted], [false, true, [true, false]], 'mute: unmuted: talking again')
    m.ctl.pttDown(); await settle(); eq(m.snap().phase, 'listening', 'mute: ...listening')
    m.ctl.setMuted(true); await settle(); eq([m.snap().holding, m.snap().phase, m.snap().latched, m.log.cancelled >= 1], [false, 'idle', false, true], 'mute: muting while you talk drops the recording')
    m.ctl.endCall(); await settle(); await m.start(); eq([m.snap().muted, m.snap().transcript], [false, []], 'mute: a new call starts unmuted')
  }
  {
    // hold to talk: letting go sends (as before); a tap latches the microphone on, and the next tap sends
    const w = makeCall({ over }); await w.start()
    await w.press(); eq([w.snap().holding, w.snap().latched, w.snap().phase], [true, false, 'listening'], 'talk: pressing starts listening')
    await w.clock.advance(900); await w.release(); await settle()
    eq([w.snap().holding, w.log.transcribed.length, w.log.sent], [false, 1, ['make the title shorter']], 'talk: a long press is hold to talk: letting go sends it')
    const t = makeCall({ over, transcripts: ['one', 'two', 'three'] }); await t.start()
    await t.press(); await t.clock.advance(120); await t.release()
    eq([t.snap().holding, t.snap().latched, t.snap().phase, t.log.recordings.length, t.log.transcribed.length], [true, true, 'listening', 1, 0], 'talk: a tap latches the microphone on (still listening, nothing sent)')
    await t.clock.advance(1500); await t.press()
    eq([t.snap().holding, t.snap().latched, t.log.transcribed.length], [false, false, 1], 'talk: ...and the next tap sends')
    await t.release(); eq(t.log.transcribed.length, 1, 'talk: ...and the lifting of that finger sends nothing more')
    await t.press(); await t.clock.advance(100); await t.release(); eq(t.snap().latched, true, 'talk: latched again')
    t.ctl.stop(); await settle(); await t.ctl.pttUp(); await settle(); eq([t.snap().holding, t.snap().latched], [false, false], 'talk: letting go any other way (the window loses focus) sends and clears the latch')
    // a latch left on is sent after a minute
    const f = makeCall({ over }); await f.start(); await f.press(); await f.clock.advance(100); await f.release()
    eq(f.snap().latched, true, 'talk: latched'); await f.clock.advance(59000); eq([f.snap().latched, f.log.transcribed.length], [true, 0], 'talk: ...still on at 59 s')
    await f.clock.advance(2000); await settle(); eq([f.snap().latched, f.snap().holding, f.log.transcribed.length], [false, false, 1], 'talk: ...sent at a minute')
    // the key: the same two calls
    const k = makeCall({ over }); await k.start(); k.ctl.talkRelease(); await settle(); eq(k.snap().holding, false, 'talk: letting go without a press does nothing')
    const n = makeCall({ over, connected: false }); await n.start(); await n.press(); await n.release(); eq([n.snap().holding, n.snap().latched, n.log.recordings.length], [false, false, 0], 'talk: no socket: a tap latches nothing')
    // ending a call clears a latch
    const e = makeCall({ over }); await e.start(); await e.press(); await e.clock.advance(100); await e.release(); e.ctl.endCall(); await settle(); await e.start(); eq([e.snap().latched, e.snap().holding], [false, false], 'talk: a new call starts with nothing latched')
  }
  {
    // the live transcript: what you said (as heard), then what the companion said, in pieces joined into one message
    const w = makeCall({ over, transcripts: ['make the title shorter', 'and the subtitle too'] }); await w.start()
    await w.talk()
    eq(w.snap().transcript.map(entry => [entry.who, entry.text]), [['you', 'make the title shorter']], 'transcript: your words, as heard')
    await w.reply('I shortened the title to fit on one line. The subtitle stays exactly as it was.')
    const pieces = w.log.plays.length
    ok(pieces >= 1, 'transcript: the reply is spoken')
    eq(w.snap().transcript.length, 1, 'transcript: a line is added when it starts to be spoken, not before')
    await w.playStart(0)
    eq(w.snap().transcript.map(entry => entry.who), ['you', 'director'], 'transcript: ...the first piece starts: the companion\'s message begins')
    await w.playEnd(0)
    for (let i = 1; i < w.log.plays.length; i++) { await w.playStart(i); await w.playEnd(i) }
    eq(w.snap().transcript.length, 2, 'transcript: a reply spoken in pieces is one message')
    eq(w.snap().transcript[1].text, w.log.spoken.join(' '), 'transcript: ...of everything that was said, in order')
    await w.talk(); eq(w.snap().transcript.map(entry => entry.who), ['you', 'director', 'you'], 'transcript: your next turn is a new line')
    const ids = w.snap().transcript.map(entry => entry.id); eq(ids, [1, 2, 3], 'transcript: ids count up')
    ok(w.snap().transcript === w.ctl.getSnapshot().transcript, 'transcript: the same list until a line is added (no render)')
    w.ctl.endCall(); await settle(); await w.start(); eq(w.snap().transcript, [], 'transcript: a new call starts empty')
    // a typed message is not said and not in the transcript
    const g = makeCall({ over, transcripts: [] }); await g.start(); await g.ctl.onSent('typed words'); await g.reply(undefined, 'Done, typed.'); eq(g.snap().transcript, [], 'transcript: typed words and an unspoken reply are chat, not call')
  }
  {
    // the level: the microphone's while you talk, the speaker's while it speaks, else nothing
    const w = makeCall({ over, mic: { level: 0.42 } }); await w.start()
    eq(w.ctl.getLevel(), 0, 'level: nothing before anyone talks')
    w.ctl.pttDown(); await settle(); eq(w.ctl.getLevel(), 0.42, 'level: while you talk it is the microphone\'s')
    await w.clock.advance(1250); await w.ctl.pttUp(); await settle(); eq(w.ctl.getLevel(), 0, 'level: ...and nothing once you let go')
    await w.reply('Done. The title is now on one line.'); await w.playStart(0); eq(w.ctl.getLevel(), 0.3, 'level: while it speaks it is the speaker\'s')
    const bare = makeCall({ over, mic: { noMeter: true } }); await bare.start(); bare.ctl.pttDown(); await settle(); eq(bare.ctl.getLevel(), 0, 'level: a microphone with no meter reads zero')
  }
  // ---- tear-down ------------------------------------------------------------------------------------------------------------------------------
  {
    const w = makeCall({ over }); await w.start(); await w.talk(); await w.reply('One. Two.'); await w.playStart(0)
    w.ctl.pttDown(); await settle(); w.ctl.endCall(); await settle()
    eq([w.snap().active, w.log.micClosed, w.clock.pending(), w.log.cancelled >= 1, w.ui.voiceCallBus.pending], [false, 1, 0, true, null], 'end: the recording is dropped, the microphone released, no timer left, nothing armed')
    const d = makeCall({ over }); await d.start(); d.ctl.dispose(); await settle()
    eq([d.log.micClosed, d.clock.pending()], [1, 0], 'dispose: releases everything'); d.ctl.onFrame(frame('chat_message', { spoken: 'x' })); await d.ctl.startCall(); eq(d.log.micOpened, 1, 'dispose: a disposed controller does nothing more')
    const sub = makeCall({ over }); let seen = 0; const off = sub.ctl.subscribe(() => { seen++ }); await sub.start(); ok(seen > 0, 'snapshot: subscribers are told'); off(); const before = seen; sub.ctl.setMuted(true); eq(seen, before, 'snapshot: an unsubscribed listener is not told')
    const same = sub.ctl.getSnapshot(); sub.ctl.tick(); eq(sub.ctl.getSnapshot() === same, true, 'snapshot: nothing changed, the same snapshot (no render)')
    sub.ctl.setMuted(false); eq(sub.snap().muted, false, 'snapshot: mute toggles')
  }
}

// ============================================================================================================================================
// C. Components and the hook, offline
// ============================================================================================================================================
const noHint = ({ children }) => children
function componentStubs(host) {
  return { './voice-call.css': {}, '../studio-composer-hint': { StudioComposerHint: noHint }, './companion-player': host.load(PLAYER) }
}
async function stageSuite(over = {}) {
  const was = { fetch: globalThis.fetch, Image: globalThis.Image }
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } // a desktop; the offline renderer runs the stage's effects
  globalThis.fetch = async () => { throw new Error('offline') } // no scene art unless a scene is staged (sceneWorld): nothing is requested from anywhere
  globalThis.Image = class { set src(_url) { queueMicrotask(() => this.onerror?.()) } }
  try { await stageSuiteBody(over) } finally { delete globalThis.window; globalThis.fetch = was.fetch; globalThis.Image = was.Image }
}
async function stageSuiteBody(over = {}) {
  const fakePlayer = ({ pack, scene, framing, size, reducedMotion }) => React.createElement('div', { 'data-fake-player': 'true', 'data-pack': pack, 'data-scene': scene, 'data-framing': framing, 'data-size': size, 'data-reduced': String(reducedMotion) })
  const loadStage = () => makeHost({ env: ENV_ON, over, stubs: { './companion-player': { CompanionPlayer: fakePlayer } } }).load(STAGE)
  const stage = loadStage()
  const base = { active: true, starting: false, phase: 'idle', scene: 'idle', chip: 'Your turn', dance: false, caption: null, progress: null, notice: null, mode: 'audio', muted: false, reducedMotion: false, holding: false, latched: false, transcript: [], controls: { talk: true, stop: false, mute: true, end: true } }
  const calls = []
  const props = (snapshot, extra = {}) => ({ snapshot: { ...base, ...snapshot }, pack: 'bob', choices: ['felix', 'bob'], onChooseCompanion: () => calls.push('character'), ...extra, getLevel: () => 0, onTalkPress: () => calls.push('press'), onTalkRelease: () => calls.push('release'), onStop: () => calls.push('stop'), onMute: muted => calls.push(`mute:${muted}`), onEnd: () => calls.push('end'), onRetry: () => calls.push('retry'), onDismissNotice: () => calls.push('dismiss') })
  const html = (snapshot, mod = stage, extra = {}) => renderToStaticMarkup(React.createElement(mod.VoiceCallStage, props(snapshot, extra)))
  const { toElements } = mini
  const hostNodes = (node, pred, out = []) => { if (!node) return out; if (node.t === 'host' && pred(node)) out.push(node); if (node.t === 'comp') hostNodes(node.child, pred, out); else if (node.children) for (const child of node.children) hostNodes(child, pred, out); return out }
  const settleRoot = async rootNode => { for (let i = 0; i < 30; i++) { await macro(); if (!rootNode.flush()) break } }
  const mount = async (snapshot, mod = stage) => { const rootNode = new Root(); rootNode.setElement(React.createElement(mod.VoiceCallStage, props(snapshot))); await settleRoot(rootNode); return rootNode }
  const markup = rootNode => renderToStaticMarkup(toElements(rootNode.tree))
  // an audio call, your turn
  const idle = html({})
  ok(idle.includes('data-studio-voice-call="stage"') && idle.includes('data-voice-mode="audio"') && idle.includes('aria-label="Audio call"') && idle.includes('data-voice-chip="Your turn"') && idle.includes('data-studio-voice-status="hint"'), 'stage: audio, idle: the chip and the hint')
  ok(idle.includes('data-framing="disc"') && idle.includes('data-size="176"') && idle.includes('data-pack="bob"') && idle.includes('studio-voice-ring') && idle.includes('studio-voice-halo'), 'stage: audio: the pack\'s face as a 176 px disc in a level ring')
  ok(idle.includes('aria-label="Hold to talk"') && idle.includes('aria-label="Stop"') && idle.includes('aria-label="Mute microphone"') && idle.includes('aria-label="End call"') && idle.includes('aria-label="Hide transcript"') && idle.includes('>Hold to talk<'), 'stage: the controls are named: talk, Stop, Mute, End, and the transcript toggle')
  ok(/aria-label="Stop"[^>]*disabled|disabled=""[^>]*aria-label="Stop"/.test(idle) && !/aria-label="Hold to talk"[^>]*disabled/.test(idle) && !/disabled=""[^>]*aria-label="Hold to talk"/.test(idle) && !/disabled=""[^>]*aria-label="Mute microphone"/.test(idle), 'stage: Stop is off in your turn, the talk button and Mute are on')
  ok(idle.includes('data-voice-transcript="open"') && idle.includes('role="log"') && idle.includes('What you and the companion say will appear here.') && idle.includes('aria-expanded="true"'), 'stage: the transcript is shown by default (empty, it says what it is for)')
  ok(!idle.includes('--voice-scene-art') && idle.includes('data-voice-art="gradient"'), 'stage: no scene art: the token gradient')
  // the character switch: the companion's name in the top bar; one tap goes to the next
  ok(idle.includes('data-studio-voice-character="bob"') && idle.includes('aria-label="Character: Bob. Switch to Felix"') && idle.includes('title="Switch to Felix"') && />Bob<\/button>/.test(idle), 'character: the top bar names the companion and offers the other one')
  ok(html({}, stage, { pack: 'felix' }).includes('aria-label="Character: Felix. Switch to Bob"') && html({}, stage, { pack: 'felix' }).includes('data-pack="felix"'), 'character: Felix is switched to Bob, and the player is given Felix\'s pack')
  ok(!html({}, stage, { choices: ['bob'] }).includes('studio-voice-pack') && !html({}, stage, { choices: [] }).includes('studio-voice-pack'), 'character: with no other character there is no switch')
  ok(html({}).indexOf('studio-voice-pack') < html({}).indexOf('aria-label="Stop"'), 'character: the switch is first of the top bar\'s tools')
  {
    // three characters: the same one tap cycles round them, and the switch shows all three (a dot each, the one on screen filled)
    const three = ['felix', 'bob', 'maya']
    const dots = out => (out.match(/<i data-choice="[a-z]+" data-on="(true|false)"><\/i>/g) ?? []).map(dot => dot.replace(/<i data-choice="([a-z]+)" data-on="(true|false)"><\/i>/, '$1:$2'))
    const first = html({}, stage, { pack: 'felix', choices: three }), second = html({}, stage, { pack: 'bob', choices: three }), third = html({}, stage, { pack: 'maya', choices: three })
    eq([dots(first), dots(second), dots(third)], [['felix:true', 'bob:false', 'maya:false'], ['felix:false', 'bob:true', 'maya:false'], ['felix:false', 'bob:false', 'maya:true']], 'character: three on offer: a dot for each, in order, the one on screen filled')
    ok(first.includes('aria-label="Character: Felix. Switch to Bob"') && second.includes('aria-label="Character: Bob. Switch to Maya"') && third.includes('aria-label="Character: Maya. Switch to Felix"') && third.includes('title="Switch to Felix"') && third.includes('data-studio-voice-character="maya"') && third.includes('data-pack="maya"') && />Maya<span class="studio-voice-pack-dots"/.test(third), 'character: Felix goes to Bob, Bob to Maya, Maya back to Felix; the button says who is on screen, and the player is given her pack')
    ok(!html({}, stage, { pack: 'bob', choices: ['felix', 'bob'] }).includes('studio-voice-pack-dots') && html({}, stage, { pack: 'bob', choices: ['felix', 'bob'] }).includes('>Bob</button>') && !html({}, stage, { choices: ['bob'] }).includes('studio-voice-pack-dots'), 'character: with two there is no pager (the name and one tap say it all), with one there is no switch')
    const mayaVideo = html({ mode: 'video' }, stage, { pack: 'maya', choices: three })
    ok(mayaVideo.includes('data-pack="maya"') && mayaVideo.includes('data-framing="chest"'), 'character: Maya is drawn in the video call too (the chest view)')
  }
  // a video call
  const video = html({ mode: 'video' })
  ok(video.includes('data-voice-mode="video"') && video.includes('aria-label="Video call"') && video.includes('data-framing="chest"') && video.includes('data-size="240"') && video.includes('studio-voice-actor') && !video.includes('studio-voice-ring') && !video.includes('studio-voice-halo'), 'stage: video: the pack\'s chest view large in its scene, no level ring (the size follows the call\'s measured height: 240 before it is measured)')
  for (const [chip, scene] of [['Listening', 'listening'], ['Thinking', 'thinking'], ['Speaking', 'speaking']]) ok(html({ chip, scene }).includes(`data-voice-chip="${chip}"`) && html({ chip, scene }).includes(`>${chip}</span>`) && html({ chip, scene }).includes(`data-ring="${scene}"`), `stage: the chip says ${chip}`)
  const speaking = html({ chip: 'Speaking', scene: 'speaking', phase: 'speaking', caption: 'Sure. I shortened the title.', controls: { talk: true, stop: true, mute: true, end: true } })
  ok(!/aria-label="Stop"[^>]*disabled/.test(speaking) && !/disabled=""[^>]*aria-label="Stop"/.test(speaking), 'stage: Stop is on while it speaks')
  ok(!speaking.includes('data-studio-voice-caption'), 'stage: with the transcript shown, the line being said is not repeated as a subtitle')
  const working = html({ scene: 'working', progress: 'Building your slides…' })
  ok(working.includes('Building your slides…') && working.includes('data-studio-voice-status="progress"') && working.includes('class="studio-voice-progress"') && !working.includes('data-studio-voice-status="hint"') && !working.includes('class="studio-voice-hint"') && idle.includes('class="studio-voice-hint"'), 'stage: what the Director is doing shows under the figure (instead of the hint)')
  // the talk button's words and states
  ok(html({ holding: true }).includes('>Release to send<') && html({ holding: true }).includes('aria-pressed="true"') && html({ holding: true }).includes('data-holding="true"'), 'stage: held: Release to send')
  const latched = html({ holding: true, latched: true })
  ok(latched.includes('>Tap to send<') && latched.includes('data-latched="true"') && latched.includes('data-studio-voice-status="hint"') && latched.includes('Tap again to send'), 'stage: latched on by a tap: Tap to send, and the hint says so')
  const muted = html({ muted: true, controls: { talk: false, stop: false, mute: true, end: true } })
  ok(muted.includes('data-voice-muted="true"') && muted.includes('aria-label="Unmute microphone"') && muted.includes('aria-pressed="true"') && muted.includes('>Muted<') && muted.includes('Your microphone is muted') && /disabled=""[^>]*aria-label="Hold to talk"|aria-label="Hold to talk"[^>]*disabled/.test(muted), 'stage: muted: Unmute, the talk button says Muted and is off, the status says why')
  ok(html({ reducedMotion: true }).includes('data-reduced="true"'), 'stage: reduced motion is handed to the player')
  ok(html({ active: false, starting: true, controls: { talk: false, stop: false, mute: false, end: false } }).includes('Waiting for your microphone…'), 'stage: while the browser asks, it says so')
  // the transcript
  const talk = [{ id: 1, who: 'you', text: 'make the title shorter' }, { id: 2, who: 'director', text: 'Done. The title is on one line now.' }]
  const withLines = html({ transcript: talk })
  ok(withLines.includes('make the title shorter') && withLines.includes('Done. The title is on one line now.') && withLines.includes('data-who="you"') && withLines.includes('data-who="director"') && withLines.includes('<b>You</b>') && withLines.includes('<b>Bob</b>') && !withLines.includes('will appear here'), 'transcript: your words and the companion\'s, each labelled, oldest first')
  ok(withLines.indexOf('make the title shorter') < withLines.indexOf('Done. The title is on one line now.') && /role="log"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="log"/.test(withLines) && withLines.includes('tabindex="0"'), 'transcript: a log, announced politely, reachable by keyboard (it scrolls)')
  // hide it and show it again (the toggle is real state: the offline renderer clicks it)
  {
    const rootNode = await mount({ transcript: talk, caption: 'Done. The title is on one line now.' })
    const toggle = () => hostNodes(rootNode.tree, node => node.props?.['aria-expanded'] !== undefined)[0]
    ok(markup(rootNode).includes('data-voice-transcript="open"') && !markup(rootNode).includes('data-studio-voice-caption'), 'transcript: shown by default')
    toggle().props.onClick(); await settleRoot(rootNode)
    const hidden = markup(rootNode)
    ok(hidden.includes('data-voice-transcript="collapsed"') && !hidden.includes('role="log"') && hidden.includes('aria-label="Show transcript"') && hidden.includes('aria-expanded="false"') && hidden.includes('>Transcript<'), 'transcript: hidden: only its bar is left')
    ok(hidden.includes('data-studio-voice-caption="line"') && hidden.includes('Done. The title is on one line now.'), 'transcript: ...and the line being said shows as a subtitle instead')
    toggle().props.onClick(); await settleRoot(rootNode)
    ok(markup(rootNode).includes('data-voice-transcript="open"') && markup(rootNode).includes('role="log"') && !markup(rootNode).includes('data-studio-voice-caption'), 'transcript: shown again')
    rootNode.unmount()
  }
  // the controls call the page's handlers
  {
    const rootNode = await mount({ controls: { talk: true, stop: true, mute: true, end: true } })
    const byLabel = label => hostNodes(rootNode.tree, node => node.props?.['aria-label'] === label)[0]
    calls.length = 0
    byLabel('Character: Bob. Switch to Felix').props.onClick(); byLabel('Stop').props.onClick(); byLabel('Mute microphone').props.onClick(); byLabel('End call').props.onClick()
    const talkButton = byLabel('Hold to talk')
    const ev = { preventDefault() {}, pointerId: 1, currentTarget: { setPointerCapture() {}, releasePointerCapture() {} } }
    talkButton.props.onPointerDown(ev); talkButton.props.onPointerUp(ev); talkButton.props.onPointerDown(ev); talkButton.props.onPointerCancel()
    eq(calls, ['character', 'stop', 'mute:true', 'end', 'press', 'release', 'press', 'release'], 'controls: the character switch, Stop, Mute (to muted), End, and the talk button\'s press and release (up or cancelled) reach the call')
    let prevented = 0; talkButton.props.onKeyDown({ key: ' ', preventDefault: () => { prevented++ } }); talkButton.props.onKeyDown({ key: 'a', preventDefault: () => { prevented++ } }); eq(prevented, 1, 'controls: Space on the talk button does not click it (the page\'s Space handler talks)')
    rootNode.unmount()
    const m = await mount({ muted: true }); calls.length = 0; hostNodes(m.tree, node => node.props?.['aria-label'] === 'Unmute microphone')[0].props.onClick(); eq(calls, ['mute:false'], 'controls: when muted the button unmutes'); m.unmount()
  }
  // a notice: with no call it is docked above the composer; during a call it floats over the stage
  const noMic = html({ active: false, notice: { kind: 'mic', title: 'Your browser blocked the microphone', steps: ['Click the lock icon.', 'Then press Try again.'], retry: true }, controls: { talk: false, stop: false, mute: false, end: false } })
  ok(noMic.includes('data-studio-voice-call="notice"') && !noMic.includes('data-studio-voice-call="stage"') && !noMic.includes('role="log"') && !noMic.includes('Hold to talk'), 'notice: no call: only the words, docked (no stage, no controls)')
  ok(noMic.includes('role="alert"') && noMic.includes('Your browser blocked the microphone') && noMic.includes('Click the lock icon.') && noMic.includes('Try again</button>') && noMic.includes('aria-label="Dismiss"') && noMic.includes('data-studio-voice-notice="mic"'), 'notice: a refused microphone says why, what to do, with Try again and Dismiss')
  const turnNotice = html({ notice: { kind: 'turn', title: 'That was too short', steps: ['Hold the button the whole time you speak.'], retry: false } })
  ok(turnNotice.includes('data-studio-voice-call="stage"') && turnNotice.includes('data-studio-voice-notice="turn"') && !turnNotice.includes('Try again'), 'notice: during a call it is on the stage, and a notice that cannot be retried has no Try again')
  ok(html({ active: false }) === '' && !html({ active: false }).includes('data-studio-voice-caption'), 'notice: nothing to say and no call: nothing is drawn')
  {
    const rootNode = await mount({ active: false, notice: { kind: 'mic', title: 'x', steps: ['y'], retry: true }, controls: { talk: false, stop: false, mute: false, end: false } }); calls.length = 0
    const named = (tag, text) => hostNodes(rootNode.tree, node => node.type === tag && JSON.stringify(node.children).includes(text))[0]
    named('button', 'Try again').props.onClick(); hostNodes(rootNode.tree, node => node.props?.['aria-label'] === 'Dismiss')[0].props.onClick(); eq(calls, ['retry', 'dismiss'], 'notice: Try again and Dismiss reach the call'); rootNode.unmount()
  }
  // a phone: the disc is 148 px (the media query is read in an effect, so the stage is run in the offline host)
  const phoneStage = async matches => {
    const prev = globalThis.window
    globalThis.window = { matchMedia: () => ({ matches, addEventListener() {}, removeEventListener() {} }) }
    try { const rootNode = await mount({}); const out = markup(rootNode); rootNode.unmount(); return out } finally { globalThis.window = prev }
  }
  const phoneHtml = await phoneStage(true), deskHtml = await phoneStage(false)
  ok(phoneHtml.includes('data-voice-phone="true"') && phoneHtml.includes('data-size="148"') && deskHtml.includes('data-voice-phone="false"') && deskHtml.includes('data-size="176"'), 'stage: a phone gets the 148 px disc, a desktop the 176 px one')
  // the catalog loader (Bob's companion.json): asked for only when the base lacks lean_in, merged, and never fatal
  {
    const catalogUi = makeHost({ env: ENV_ON, over }).load(UI)
    const withBase = { version: 1, bird: 'b', neutral: 'neutral', packBudgetMiB: 8, totalBytes: 100, uniqueFrames: 1, frames: { neutral: { src: 'n.webp' } }, clips: { idle_breathe: { frames: ['neutral'], fps: 4 } } }
    const withCompanion = { totalBytes: 50, frames: { lean_1: { src: 'l.webp' } }, clips: { lean_in: { frames: ['lean_1'], fps: 4 } } }
    const run = async (map, parse = raw => raw) => { const asked = []; const out = await catalogUi.loadCatalog('/companions/b/motion/manifest.json', async url => { asked.push(url); const hit = map[url]; if (hit instanceof Error) throw hit; if (hit === undefined) throw new Error('404'); return hit }, parse); return { out, asked } }
    const full = await run({ '/companions/b/motion/manifest.json': { ...withBase, clips: { ...withBase.clips, lean_in: {} } } })
    eq(full.asked, ['/companions/b/motion/manifest.json'], 'catalog loader: a pack that has lean_in is read once (no request for a companion.json)')
    const joined = await run({ '/companions/b/motion/manifest.json': withBase, '/companions/b/motion/companion.json': withCompanion })
    eq([joined.asked, Object.keys(joined.out.clips).sort(), joined.out.uniqueFrames], [['/companions/b/motion/manifest.json', '/companions/b/motion/companion.json'], ['idle_breathe', 'lean_in'], 2], 'catalog loader: a pack without lean_in has companion.json (beside the manifest) merged in')
    const gone = await run({ '/companions/b/motion/manifest.json': withBase })
    eq([gone.asked.length, Object.keys(gone.out.clips)], [2, ['idle_breathe']], 'catalog loader: a companion.json that is not there leaves the base')
    let seen = 0; const refused = await run({ '/companions/b/motion/manifest.json': withBase, '/companions/b/motion/companion.json': withCompanion }, raw => { seen++; if (seen === 1) throw new Error('refused'); return raw })
    eq([seen, Object.keys(refused.out.clips)], [2, ['idle_breathe']], 'catalog loader: a merged set the parser refuses falls back to the base')
    let rejected = null; try { await run({}) } catch (error) { rejected = error.message } eq(rejected, '404', 'catalog loader: the base failing is a failure (the pack is a plain disc)')
    const nested = await catalogUi.loadCatalog('/companions/b/motion/face/manifest.json', async url => (url.endsWith('companion.json') ? withCompanion : withBase), raw => raw)
    ok(!!nested.clips.lean_in, 'catalog loader: the Face pack\'s companion.json is the one beside its own manifest')
  }
  // Maya (a v2 layered-face pack) and the packs that are not: the pack loader, through the real core's parser and the real files
  {
    const core = makeHost({ over: {} }).load('lib/studio/voice/bird-motion.ts')
    const packUi = makeHost({ env: ENV_ON, over }).load(UI)
    const readDisk = url => { const file = path.join(root, 'public', url); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null }
    const asked = []
    const disk = async url => { asked.push(url); const hit = readDisk(url); if (hit === null) throw new Error('404'); return hit }
    const load = (pack, framing, fetchJson = disk) => { asked.length = 0; return packUi.loadCompanionPack(pack, framing, fetchJson, core.parseBirdMotionManifest) }
    const broken = (match, patch) => async url => { const hit = await disk(url); return url.includes(match) ? { ...hit, ...patch } : hit }
    const mayaChest = await load('maya', 'chest')
    eq([mayaChest.base, mayaChest.manifest.bird, [mayaChest.manifest.size.width, mayaChest.manifest.size.height], 'face' in mayaChest.manifest, packUi.isLayeredFace(mayaChest.layered), Object.keys(mayaChest.layered).sort(), asked], ['/companions/maya/motion/', 'maya', [768, 768], false, true, ['angles', 'heads', 'patch', 'pieces', 'recipes'], ['/companions/maya/motion/manifest.json']], 'Maya: the video call reads her 768 catalog in the compatibility view (her face section is kept beside it, not in it) and asks for nothing else (no companion.json, no Face catalog)')
    const mayaDisc = await load('maya', 'disc')
    eq([mayaDisc.base, mayaDisc.manifest.variant, [mayaDisc.manifest.size.width, mayaDisc.manifest.size.height], 'face' in mayaDisc.manifest, packUi.isLayeredFace(mayaDisc.layered), asked], ['/companions/maya/face/', 'face', [604, 594], false, true, ['/companions/maya/motion/manifest.json', '/companions/maya/face/manifest.json']], 'Maya: the audio call reads her native Face catalog, which is at the pack\'s root (face/), after the whole character')
    const noFace = await load('maya', 'disc', broken('/face/', { version: 2 })), missingFace = await load('maya', 'disc', async url => { if (url.includes('/face/')) throw new Error('404'); return disk(url) })
    eq([noFace.base, noFace.manifest.size.width, missingFace.base, missingFace.manifest.bird], ['/companions/maya/motion/', 768, '/companions/maya/motion/', 'maya'], 'Maya: a Face catalog the parser refuses, or that is not there, leaves her whole character, cropped (the disc is never empty for it)')
    eq([await load('maya', 'chest', broken('/motion/', { version: 2 })), await load('maya', 'disc', broken('/motion/', { neutral: 'nobody' })), await load('maya', 'chest', broken('/motion/', { clips: {} })), await load('nobody', 'chest'), await load('maya', 'chest', async () => { throw new Error('offline') }), await load('maya', 'chest', async () => null)],
      [null, null, null, null, null, null], 'Maya: a manifest the parser refuses (even after the compatibility view), one that is missing or unreadable: no catalog, no throw (the caller shows her portrait)')
    const stripped = { ...JSON.parse(fs.readFileSync(path.join(root, 'public/companions/maya/motion/manifest.json'), 'utf8')) }; delete stripped.face
    eq(await load('maya', 'chest', async () => stripped).then(found => [found.layered, found.manifest.bird]), [null, 'maya'], 'Maya: with no face section at all she is simply a v1 pack')
    const felixChest = await load('felix', 'chest'), felixDisc = await load('felix', 'disc'), bobDisc = await load('bob', 'disc')
    eq([felixChest.base, felixChest.layered, felixChest.manifest.bird], ['/companions/felix/motion/', null, 'felix'], 'v1 packs: Felix\'s video call is his one manifest, no layered face')
    eq([felixDisc.base, felixDisc.layered, felixDisc.manifest.variant], ['/companions/felix/motion/face/', null, 'face'], 'v1 packs: Felix\'s disc is the Face pack his manifest points at')
    eq([bobDisc.base, bobDisc.layered, bobDisc.manifest.variant, !!bobDisc.manifest.clips.lean_in, asked], ['/companions/bob/motion/face/', null, 'face', true, ['/companions/bob/motion/manifest.json', '/companions/bob/motion/companion.json', '/companions/bob/motion/face/manifest.json', '/companions/bob/motion/face/companion.json']], 'v1 packs: Bob\'s disc is his Face pack, each catalog with the companion.json beside it merged in (unchanged by the compatibility view)')
    // her compatibility view, scene by scene: every clip a scene asks for is hers except the dance (a celebration without it falls back to a nod), and every picture is a file
    for (const [label, catalog] of [['whole character', mayaChest], ['Face catalog', mayaDisc]]) {
      const manifest = catalog.manifest, fallbacks = [], missing = []
      for (const scene of packUi.SCENES) for (const clip of packUi.clipsForScene(scene)) {
        const used = core.resolveCompanionClip(manifest, clip)
        if (used !== clip) fallbacks.push(`${scene}:${clip}>${used}`)
        for (const id of manifest.clips[used].frames) if (!fs.existsSync(path.join(root, 'public', catalog.base, manifest.frames[id].src))) missing.push(`${used}:${id}`)
      }
      eq([fallbacks, missing, Object.values(manifest.frames).every(frame => fs.existsSync(path.join(root, 'public', catalog.base, frame.src))), manifest.talking, manifest.clips[manifest.talking.neutral].frames.length], [['celebrating:dance_bounce>nod'], [], true, { neutral: 'talk_neutral', left: 'talk_left', right: 'talk_right' }, 9], `Maya's ${label}: all 13 scenes resolve to her own clips (only the dance falls back, to a nod), every picture is in her folder, and the talk slots are the nine mouth places the player reads`)
    }
    // the player: her catalogs are used; a pack with no usable catalog shows its portrait, and the initials only when that fails too
    const withFetch = async (serve, body) => {
      const was = globalThis.fetch, urls = []
      globalThis.fetch = async url => { urls.push(url); const hit = await serve(url); return hit === null ? { ok: false, status: 404, json: async () => null } : { ok: true, status: 200, json: async () => hit } }
      try { return await body(urls) } finally { globalThis.fetch = was }
    }
    const playerProps = (pack, framing) => ({ pack, scene: 'speaking', dance: false, framing, size: framing === 'disc' ? 176 : 360, reducedMotion: false, getLevel: () => 0.2 })
    const mountPlayer = async (mod, pack, framing) => { const rootNode = new Root(); rootNode.setElement(React.createElement(mod.CompanionPlayer, playerProps(pack, framing))); await settleRoot(rootNode); return rootNode }
    await withFetch(async url => readDisk(url), async urls => {
      const chest = await mountPlayer(makeHost({ env: ENV_ON, over }).load(PLAYER), 'maya', 'chest'), chestOut = markup(chest); chest.unmount()
      ok(chestOut.includes('data-studio-voice-companion="loading"') && chestOut.includes('data-companion-pack="maya"') && chestOut.includes('<canvas') && !chestOut.includes('<img') && !chestOut.includes('data-companion-art') && urls.join() === '/companions/maya/motion/manifest.json', 'player: Maya in the video call: her catalog is accepted (a canvas, no portrait, no fallback), one request')
      urls.length = 0
      const disc = await mountPlayer(makeHost({ env: ENV_ON, over }).load(PLAYER), 'maya', 'disc'), discOut = markup(disc); disc.unmount()
      ok(discOut.includes('data-studio-voice-companion="loading"') && discOut.includes('<canvas') && !discOut.includes('<img') && urls.join() === '/companions/maya/motion/manifest.json,/companions/maya/face/manifest.json', 'player: ...and in the audio call (her Face catalog after the whole character)')
    })
    for (const [label, pack, framing, serve] of [
      ['Maya\'s manifest refused by the parser', 'maya', 'chest', async url => { const hit = readDisk(url); return hit && { ...hit, version: 2 } }],
      ['Maya\'s manifest refused, audio', 'maya', 'disc', async url => { const hit = readDisk(url); return hit && { ...hit, neutral: 'nobody' } }],
      ['no manifest at all (404)', 'maya', 'chest', async () => null],
      ['a pack that is not there', 'nobody', 'disc', async () => null],
      ['Felix, whose manifest is gone', 'felix', 'chest', async () => null],
    ]) {
      await withFetch(serve, async urls => {
        const mod = makeHost({ env: ENV_ON, over }).load(PLAYER)
        const rootNode = await mountPlayer(mod, pack, framing), out = markup(rootNode)
        ok(out.includes('data-studio-voice-companion="fallback"') && out.includes('data-companion-art="portrait"') && out.includes(`<img class="studio-voice-portrait" src="/companions/${pack}/portrait-512.webp"`) && !out.includes('<canvas') && !out.includes('studio-voice-initials') && out.includes(`data-companion-framing="${framing}"`), `player: ${label}: the pack's portrait, still, and nothing throws`)
        hostNodes(rootNode.tree, node => node.type === 'img')[0].props.onError(); await settleRoot(rootNode)
        const bare = markup(rootNode)
        ok(bare.includes('data-companion-art="initials"') && !bare.includes('<img') && bare.includes('studio-voice-initials') && bare.includes(`>${packUi.initialsFor(pack)}<`), `player: ${label}: and when the portrait cannot be shown either, the initials`)
        rootNode.setElement(React.createElement(mod.CompanionPlayer, playerProps(pack === 'felix' ? 'bob' : 'felix', framing))); await settleRoot(rootNode)
        ok(markup(rootNode).includes('data-companion-art="portrait"'), `player: ${label}: ...and another pack's portrait is tried again (one failure is not remembered for the next)`)
        rootNode.unmount()
      })
    }
  }
  // a phone: the stage is drawn as a child of the shell itself, above the shell's own chrome (a desktop keeps it in the chat column)
  {
    let playerMounts = 0
    const countingPlayer = props => { React.useEffect(() => { playerMounts++ }, []); return fakePlayer(props) }
    const portalStage = makeHost({ env: ENV_ON, over, stubs: { './companion-player': { CompanionPlayer: countingPlayer }, 'react-dom': { createPortal: (child, target) => React.createElement('div', { 'data-portal': target.id }, child) } } }).load(STAGE)
    const withDocument = async (matches, shell) => {
      const prevWindow = globalThis.window
      globalThis.window = { matchMedia: () => ({ matches, addEventListener() {}, removeEventListener() {} }) }
      globalThis.document = { querySelector: selector => (selector === '[data-studio-v4-shell="true"]' ? shell : null) }
      try { const rootNode = await mount({}, portalStage); const out = markup(rootNode); rootNode.unmount(); return out } finally { globalThis.window = prevWindow; delete globalThis.document }
    }
    const onPhone = await withDocument(true, { id: 'the-shell' }); eq(playerMounts, 1, 'phone: it is under the shell from the first render (the character is mounted once, not moved after a first draw)')
    const onDesk = await withDocument(false, { id: 'the-shell' }), noShell = await withDocument(true, null)
    ok(onPhone.includes('data-portal="the-shell"') && onPhone.includes('data-voice-phone="true"') && onPhone.includes('data-studio-voice-call="stage"'), 'phone: the stage is a child of the shell (above its tab bar and logo)')
    ok(!onDesk.includes('data-portal') && onDesk.includes('data-voice-phone="false"'), 'phone: a desktop keeps the stage in the chat column')
    ok(!noShell.includes('data-portal') && noShell.includes('data-studio-voice-call="stage"'), 'phone: with no shell found it stays where it is')
  }
  // the character's scene: the pack's own image when it has one, else the gradient
  const sceneWorld = async (manifest, have, snapshot = { mode: 'video' }) => {
    const asked = []
    const was = { fetch: globalThis.fetch, Image: globalThis.Image }
    globalThis.fetch = async url => { asked.push(url); if (manifest === 'throws') throw new Error('offline'); return { ok: manifest !== null, json: async () => manifest } }
    globalThis.Image = class { set src(url) { asked.push(url); queueMicrotask(() => { if (have.includes(url)) this.onload?.(); else this.onerror?.() }) } }
    try {
      const mod = loadStage()
      const rootNode = await mount(snapshot, mod); const out = markup(rootNode); rootNode.unmount(); return { out, asked }
    } finally { Object.assign(globalThis, { fetch: was.fetch, Image: was.Image }) }
  }
  const art1 = await sceneWorld({}, ['/companions/bob/scene.webp'])
  ok(art1.out.includes('data-voice-art="image"') && art1.out.includes('/companions/bob/scene.webp') && art1.asked.join(' ').includes('/companions/bob/motion/manifest.json'), 'scene: a pack with scene.webp: it is the canvas (the manifest is read for a named file first)')
  const art2 = await sceneWorld({ scene: 'scenes/desk.png' }, ['/companions/bob/scenes/desk.png', '/companions/bob/scene.webp'])
  ok(art2.out.includes('data-voice-art="image"') && art2.out.includes('/companions/bob/scenes/desk.png') && !art2.out.includes('/companions/bob/scene.webp'), 'scene: ...or the file its manifest names')
  const art3 = await sceneWorld({}, [])
  ok(art3.out.includes('data-voice-art="gradient"') && !art3.out.includes('--voice-scene-art'), 'scene: a pack with none: the gradient')
  const art4 = await sceneWorld('throws', ['/companions/bob/scene.webp'])
  ok(art4.out.includes('data-voice-art="image"'), 'scene: a manifest that cannot be read falls back to scene.webp')
  const art5 = await sceneWorld({ scene: '../../etc/passwd.webp' }, ['/companions/bob/scene.webp'])
  ok(art5.out.includes('/companions/bob/scene.webp') && !art5.out.includes('passwd'), 'scene: a manifest\'s path that leaves the pack\'s folder is not followed')
  const art6 = await sceneWorld({}, ['/companions/bob/scene.webp'], { mode: 'audio' })
  eq([art6.asked.length, art6.out.includes('data-voice-art="gradient"')], [0, true], 'scene: an audio call asks for no scene (it has none)')
  const art7 = await sceneWorld({}, ['/companions/bob/scene.webp'], { active: false, notice: { kind: 'mic', title: 'x', steps: ['y'], retry: true }, mode: 'video' })
  eq(art7.asked.length, 0, 'scene: with no call nothing is asked for')
  // the two buttons beside Send
  const buttons = makeHost({ env: ENV_ON, over, stubs: { '../studio-composer-hint': { StudioComposerHint: noHint } } }).load(BUTTONS)
  const starts = []
  const b = p => renderToStaticMarkup(React.createElement(buttons.VoiceCallButtons, { active: false, busy: false, disabled: false, onStart: mode => starts.push(mode), studio: true, ...p }))
  ok(b({}).includes('data-studio-voice-call="buttons"') && b({}).includes('role="group"') && b({}).includes('aria-label="Start a call"'), 'buttons: one group beside Send')
  ok(b({}).includes('aria-label="Start an audio call"') && b({}).includes('aria-label="Start a video call"') && b({}).includes('data-voice-mode="audio"') && b({}).includes('data-voice-mode="video"') && (b({}).match(/type="button"/g) ?? []).length === 2, 'buttons: Audio and Video, two buttons, one tap each')
  ok(b({}).indexOf('data-voice-mode="audio"') < b({}).indexOf('data-voice-mode="video"') && b({}).includes('>Audio<') && b({}).includes('>Video<') && b({}).includes('studio-voice-start-word hidden'), 'buttons: Audio first; each has its word, shown on a phone only (the stylesheet)')
  ok((b({ busy: true }).match(/disabled=""/g) ?? []).length === 2 && (b({ disabled: true }).match(/disabled=""/g) ?? []).length === 2 && !/disabled=""/.test(b({})), 'buttons: both off while the microphone is asked for')
  ok(!b({ studio: true }).includes('title=') && b({ studio: false }).includes('title="Start an audio call"') && b({ studio: false }).includes('title="Start a video call"'), 'buttons: a tooltip in the shell, a title elsewhere')
  {
    const rootNode = new Root(); rootNode.setElement(React.createElement(buttons.VoiceCallButtons, { active: false, busy: false, disabled: false, onStart: mode => starts.push(mode), studio: true })); await settleRoot(rootNode)
    starts.length = 0; for (const node of hostNodes(rootNode.tree, n => n.type === 'button')) node.props.onClick()
    eq(starts, ['audio', 'video'], 'buttons: Audio starts an audio call, Video a video call')
    let kept = 0; for (const node of hostNodes(rootNode.tree, n => n.type === 'button')) node.props.onMouseDown({ preventDefault: () => { kept++ } })
    eq(kept, 2, 'buttons: pressing one does not take focus (or the keyboard) from the draft: the layout cannot move under the tap'); rootNode.unmount()
  }
  // the player without a pack
  const player = makeHost({ env: ENV_ON, over }).load(PLAYER)
  const p = renderToStaticMarkup(React.createElement(player.CompanionPlayer, { pack: 'bob', scene: 'idle', dance: false, framing: 'disc', size: 88, reducedMotion: false, getLevel: () => 0 }))
  ok(p.includes('data-studio-voice-companion="loading"') && p.includes('>B<') && p.includes('width:88px') && p.includes('height:88px') && !p.includes('<canvas'), 'player: before the pack is read: a plain disc with initials, no canvas')
  ok(renderToStaticMarkup(React.createElement(player.CompanionPlayer, { pack: 'deckster-owl', scene: 'idle', dance: false, framing: 'chest', size: 240, reducedMotion: true, getLevel: () => 0 })).includes('>DO<'), 'player: initials of the pack\'s name')
  // THE SEAM (P4-21b): Maya's layered face. A v1 pack and a face section that does not parse get no painter (the compatibility view); hers gets one, which draws her mouth, eyes and brows over the held body
  {
    const disk = rel => JSON.parse(fs.readFileSync(path.join(root, 'public/companions', rel), 'utf8'))
    const ui = makeHost({ env: ENV_ON, over }).load(UI), coreMod = makeHost({ env: ENV_ON, over }).load(`${CORE}/bird-motion.ts`)
    const packOf = (raw, base) => { const view = ui.compatCatalog(raw); return { manifest: coreMod.parseBirdMotionManifest(view.catalog), layered: view.layered, base } }
    const was = { fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap }
    const asked = []
    globalThis.fetch = async url => { asked.push(url); return { ok: true, status: 200, blob: async () => ({ url }) } }
    globalThis.createImageBitmap = async blob => ({ src: blob.url, width: 10, height: 10 })
    try {
      const mod = makeHost({ env: ENV_ON, over }).load(PLAYER)
      const felix = packOf(disk('felix/motion/manifest.json'), '/companions/felix/motion/')
      eq(mod.layeredPainterFor(felix), null, 'seam: a v1 pack (Felix) gets no painter: unchanged')
      const mayaRaw = disk('maya/motion/manifest.json'), maya = packOf(mayaRaw, '/companions/maya/motion/')
      const brokenFace = { ...mayaRaw, face: { ...mayaRaw.face, recipes: { ...mayaRaw.face.recipes, sorry: { brows: 'nope', eyes: 'open', mouthSet: 'plain' } } } }
      const broken = packOf(brokenFace, '/companions/maya/motion/')
      eq([broken.layered !== null, mod.layeredPainterFor(broken)], [true, null], 'seam: a face section the locked contract refuses keeps the compatibility view (no painter)')
      const noHeads = packOf({ ...mayaRaw, face: { ...mayaRaw.face, heads: {} } }, '/companions/maya/motion/')
      eq(mod.layeredPainterFor(noHeads), null, 'seam: ...and so does one whose heads do not match the body frames')
      const painter = mod.layeredPainterFor(maya)
      ok(typeof painter === 'function' && mod.layeredPainterFor(maya) === painter, 'seam: Maya gets a painter, one per loaded pack')
      await settle(); await settle()
      const pieces = new Set(); for (const kind of ['mouth', 'eyes', 'brows']) for (const a of mayaRaw.face.angles) for (const v of Object.values(mayaRaw.face.pieces[kind][a])) pieces.add(`/companions/maya/motion/${v}`)
      eq([...new Set(asked)].sort(), [...pieces].sort(), 'seam: every piece of every angle is fetched once, from the catalog\'s own folder')
      const fakeCanvas = () => { const calls = []; const c2d = new Proxy({ calls }, { get: (t, k) => k in t ? t[k] : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...args) => { calls.push([k, ...args]) }, set: (t, k, v) => { calls.push([`=${String(k)}`, v]); return true } }); return { width: 100, height: 100, dataset: {}, getContext: () => c2d, c2d } }
      const was2 = globalThis.document; globalThis.document = { createElement: () => fakeCanvas() }
      try {
        const run = (scene, level, timeSec, extra = {}) => { const canvas = fakeCanvas(); painter({ context: canvas.c2d, canvas, pack: maya, frame: 'neutral', bitmap: { width: 768, height: 768 }, rect: { sx: 0, sy: 0, sw: 768, sh: 768 }, scene, level, timeSec, ...extra }); return { canvas, drawn: canvas.c2d.calls.filter(c => c[0] === 'drawImage' && c.length === 6).length, ds: { ...canvas.dataset } } }
        const quiet = run('listening', 0.6, 1)
        eq([quiet.ds.faceMouth, quiet.drawn], ['closed', 3], 'seam: listening: three patches (mouth, eyes, brows) over the body, the mouth closed whatever the level')
        const mouths = new Set(); for (let t = 0.5; t < 1.5; t += 0.05) mouths.add(run('speaking', 0.5, t).ds.faceMouth)
        ok(mouths.size >= 3 && !mouths.has('closed'), `seam: speaking at a loud level the mouth moves through open shapes (${[...mouths]})`)
        ok(['closed', 'mbp', 'smile'].includes(run('speaking', 0, 0.5).ds.faceMouth), 'seam: silence while speaking is a closed mouth (Garud: closed, an occasional mbp or smile)')
        eq(['thinking', 'pleased', 'concerned', 'sorry', 'idle'].map(scene => run(scene, 0, 1).ds.faceExpression), ['thinking', 'happy', 'concerned', 'sorry', 'neutral'], 'seam: thinking, pleased, concerned and sorry wear their recipes')
        ok(run('thinking', 0, 1).ds.faceEyes.endsWith('look_left.webp') && run('sorry', 0, 1).ds.faceEyes.endsWith('half.webp'), 'seam: the recipe changes the eye patch (thinking looks away, sorry is tired)')
        eq(run('speaking', 0.5, 1, { reduced: true }).ds.faceMouth, 'closed', 'seam: reduced motion: the mouth holds closed')
      } finally { globalThis.document = was2 }
    } finally { Object.assign(globalThis, was) }
  }
}

async function hookSuite(over = {}) {
  const loads = []
  const mk = env => {
    const calls = { controllers: [] }
    const stubs = {
      '@/components/builder/voice-call/voice-call-stage': { VoiceCallStage: function FakeStage() { return null } },
      '@/lib/studio-voice-call-controller': { VoiceCallController: class { constructor(o) {
        calls.controllers.push(o); calls.snapshot = { active: false, starting: false, notice: null, mode: 'audio' }; calls.did = []
        this.subscribe = () => () => {}; this.getSnapshot = () => calls.snapshot; this.onFrame = () => {}; this.onSent = () => {}; this.dispose = () => { calls.disposed = true }; this.endCall = () => { calls.ended = (calls.ended ?? 0) + 1 }; this.getLevel = () => 0
        this.startCall = async mode => { calls.did.push(['start', mode]) }; this.talkPress = () => { calls.did.push(['press']) }; this.talkRelease = () => { calls.did.push(['release']) }; this.pttUp = async () => { calls.did.push(['pttUp']) }
        this.stop = () => { calls.did.push(['stop']) }; this.setMuted = muted => { calls.did.push(['mute', muted]) }; this.dismissNotice = () => { calls.did.push(['dismiss']) }
      } } },
      '@/lib/studio-voice-call-browser': { browserVoiceEnv: () => ({ marker: 'env' }), browserVoicePort: () => ({ marker: 'port' }) },
    }
    const host = makeHost({ env, over, stubs })
    return { calls, ui: host.load(UI), hook: host.load(HOOK) }
  }
  const listeners = []
  const win = { addEventListener: (type, fn) => listeners.push(['add', type, fn]), removeEventListener: (type, fn) => listeners.push(['remove', type, fn]) }
  let deviceStore = null // what window.localStorage is: a store, null (none) or 'throws' (blocked site data)
  Object.defineProperty(win, 'localStorage', { get() { if (deviceStore === 'throws') throw new Error('SecurityError'); return deviceStore }, configurable: true })
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
    const cp = onRun.latest().composerProps
    eq([cp?.active, cp?.busy, cp?.disabled, typeof cp?.onStart, onRun.latest().dock], [false, false, false, 'function', null], 'hook: the composer gets the two buttons\' state and handler; no stage while there is no call')
    cp.onStart('video'); cp.onStart('audio'); await settle(); eq(on.calls.did, [['start', 'video'], ['start', 'audio']], 'hook: Video and Audio start the call in their mode')
    eq(listeners.length, 0, 'hook: no key listener before a call')
    // a call is on: the stage is drawn from the snapshot, the composer is told to hide, Space talks
    on.calls.snapshot = { active: true, starting: false, notice: null, mode: 'video', muted: false }; await onRun.set({})
    const live = onRun.latest(), stageEl = live.dock
    eq([live.composerProps.active, typeof stageEl?.type, stageEl?.props.pack, stageEl?.props.choices, stageEl?.props.snapshot === on.calls.snapshot], [true, 'function', 'felix', ['felix', 'bob', 'maya'], true], 'hook: a call is on: the stage is drawn (Felix, the default character, with all three on offer) and the composer is told to hide')
    // the character: one tap switches, the device remembers (localStorage), a device that cannot remember still switches for the session
    {
      const kept = {}; deviceStore = { getItem: key => (key in kept ? kept[key] : null), setItem: (key, value) => { kept[key] = value } }
      await onRun.set({}); on.calls.snapshot = { ...on.calls.snapshot }; await onRun.set({})
      onRun.latest().dock.props.onChooseCompanion(); await onRun.set({})
      eq([onRun.latest().dock.props.pack, kept['deckster.studio.voiceCompanion']], ['bob', 'bob'], 'hook: one tap on the character switch: Bob, and it is stored on the device')
      onRun.latest().dock.props.onChooseCompanion(); await onRun.set({})
      eq([onRun.latest().dock.props.pack, kept['deckster.studio.voiceCompanion']], ['maya', 'maya'], 'hook: ...one more is Maya, stored')
      onRun.latest().dock.props.onChooseCompanion(); await onRun.set({})
      eq([onRun.latest().dock.props.pack, kept['deckster.studio.voiceCompanion']], ['felix', 'felix'], 'hook: ...and one more goes back to Felix (round all three)')
      deviceStore = 'throws'; onRun.latest().dock.props.onChooseCompanion(); await onRun.set({})
      eq(onRun.latest().dock.props.pack, 'bob', 'hook: blocked storage (it throws): the switch still works for the session')
      deviceStore = null; onRun.latest().dock.props.onChooseCompanion(); await onRun.set({}); eq(onRun.latest().dock.props.pack, 'maya', 'hook: no storage at all: the same')
    }
    on.calls.did.length = 0
    stageEl.props.onTalkPress(); stageEl.props.onTalkRelease(); stageEl.props.onStop(); stageEl.props.onMute(true); stageEl.props.onEnd(); stageEl.props.onDismissNotice(); stageEl.props.onRetry()
    eq([on.calls.did, on.calls.ended ?? 0], [[['press'], ['release'], ['stop'], ['mute', true], ['dismiss'], ['start', 'video']], 1], 'hook: the stage\'s controls reach the call (Try again starts the same kind of call)')
    on.calls.ended = 0
    const types = listeners.filter(l => l[0] === 'add').map(l => l[1]).sort(); eq(types, ['blur', 'keydown', 'keyup'], 'hook: ...Space and losing the window are listened to only while a call is on')
    const handler = type => listeners.filter(l => l[0] === 'add' && l[1] === type).at(-1)[2]
    const target = (tag = 'DIV') => ({ tagName: tag, getAttribute: () => null, closest: () => null })
    let prevented = 0
    const key = (type, extra = {}) => handler(type)({ code: 'Space', key: ' ', target: target(), preventDefault: () => { prevented++ }, ...extra })
    on.calls.did.length = 0
    key('keydown'); key('keyup'); key('keydown', { target: target('TEXTAREA') }); key('keyup', { target: target('TEXTAREA') }); key('keydown', { repeat: true }); key('keydown', { code: 'KeyA', key: 'a' })
    eq([on.calls.did, prevented], [[['press'], ['release']], 2], 'hook: Space presses and releases the talk button; in a text field, repeating or another key it does nothing (and keeps its default)')
    on.calls.did.length = 0; handler('blur')(); eq(on.calls.did, [['pttUp']], 'hook: losing the window lets go')
    on.calls.snapshot = { active: false, starting: false, notice: { kind: 'mic', title: 'x', steps: [], retry: true }, mode: 'video' }; await onRun.set({})
    eq([onRun.latest().composerProps.active, typeof onRun.latest().dock?.type], [false, 'function'], 'hook: a refused microphone: the composer is back and the notice is drawn')
    on.calls.snapshot = { active: false, starting: false, notice: null, mode: 'video' }; await onRun.set({}); eq([onRun.latest().dock, listeners.filter(l => l[0] === 'remove').length], [null, 3], 'hook: the call is over: nothing drawn, the listeners removed')
    eq(on.calls.ended ?? 0, 0, 'hook: the call is not ended while the session stays')
    await onRun.set({ sessionKey: 's2' }); eq(on.calls.ended, 1, 'hook: the session on screen changed: the call is ended')
    await onRun.set({ connected: false }); eq([on.calls.ended, o.isConnected()], [1, false], 'hook: ...and only a change of session ends it (the socket state is read live)')
    onRun.rootNode.unmount()
    eq([on.calls.disposed, on.ui.voiceCallBus.frame, on.ui.voiceCallBus.sent], [true, null, null], 'hook: unmounting disposes the controller and clears the bus')
    // a device that chose Bob gets Bob at once; a blocked or foreign value is Felix
    for (const [label, store, want] of [['Bob remembered', { 'deckster.studio.voiceCompanion': 'bob' }, 'bob'], ['Maya remembered', { 'deckster.studio.voiceCompanion': 'maya' }, 'maya'], ['a stranger is not believed', { 'deckster.studio.voiceCompanion': '../x' }, 'felix'], ['blocked storage', 'throws', 'felix'], ['no storage', null, 'felix']]) {
      deviceStore = store && store !== 'throws' ? { getItem: key => (key in store ? store[key] : null), setItem() {} } : store
      const w = mk(ENV_ON); const r = await run(w, { enabled: true, sendTurn: () => {}, sendAction: () => {}, sessionKey: 's1', connected: true })
      w.calls.snapshot = { active: true, starting: false, notice: null, mode: 'audio' }; await r.set({})
      eq(r.latest().dock.props.pack, want, `hook: ${label}: ${want}`); r.rootNode.unmount()
    }
    deviceStore = null
  } finally { delete globalThis.window }
}

// ============================================================================================================================================
// D. The page, the socket hook, the composer, .env.example, the scope
// ============================================================================================================================================
const lines = text => text.split('\n')
const MARK = strip.VOICE_CALL_MARKER_RE
/** Every other registered later change's lines taken out (the merged core brings the voice core's and the strawman stage's marked lines into the same files; this change is read on its own). */
const othersOut = (registry, rel, text) => registry.LATER_STRIPS.filter(fn => fn !== strip.stripVoiceCall).reduce((out, fn) => fn(rel, out), text)

function sourceSuite(sources, { base = null } = {}) {
  const core_text = () => sources[CORE_STRIP]
  const coreMod = makeHost({ over: { [CORE_STRIP]: sources[CORE_STRIP] } }).load(CORE_STRIP)
  const page = sources[PAGE], ws = sources[WS], input = sources[INPUT], env = sources['.env.example'], hook = sources[HOOK]
  const lineOf = (text, needle) => { const found = lines(text).filter(line => line.includes(needle)); ok(found.length === 1, `exactly one line with: ${needle.slice(0, 70)} (${found.length})`); return found[0] }
  // the page
  eq(lines(page).filter(line => MARK.test(line)).length, 6, 'page: six marked lines (the comment and the hook call, the call, the composer prop, the comment and the import at the end)')
  const call = lineOf(page, 'const voiceCall = useStudioVoiceCall({')
  ok(call.includes('enabled: studioShell') && call.includes('sendTurn: text => handleSendMessage(undefined, text)') && call.includes('sendAction: handleActionClick,') && call.includes('sessionKey: currentSessionId || wsSessionId') && call.includes('connected }) // VOICE-CALL'), 'page: the hook is handed the Studio shell, the page\'s ordinary send, the session and the socket state')
  ok(page.indexOf(call) > page.indexOf('const handleSendMessage = useCallback(') && page.indexOf(call) > page.indexOf('const handleActionClick = useCallback(') && page.indexOf(call) > page.indexOf('const flowControl = useStudioFlowControl({'), 'page: the call hook comes after the two sends it uses (a typed turn, a card\'s button) and after the flow hook')
  eq(lines(page).filter(line => MARK.test(line) && /handleActionClick\(/.test(line)).length, 0, 'page: no call of handleActionClick( is written by this change (the outline canvas proof counts them: the hook is handed the function itself)')
  const dockLine = lineOf(page, '{voiceCall.dock}{/* VOICE-CALL')
  ok(page.indexOf(dockLine) > page.indexOf('{flowControl.bar}') && page.indexOf(dockLine) < page.indexOf('<ChatInput\n'), 'page: the call (its stage over the column, or the notice above the composer) sits under the flow bar, before the composer')
  const propLine = lineOf(page, '{...(voiceCall.composerProps ? { voiceCall: voiceCall.composerProps } : {})} // VOICE-CALL')
  ok(page.indexOf(propLine) > page.indexOf('<ChatInput\n') && page.indexOf(propLine) < page.indexOf('onSubmit={handleSendMessage}'), 'page: the call button\'s props reach the composer (and only with the flag on)')
  const importLine = lineOf(page, "import { useStudioVoiceCall } from '@/hooks/use-studio-voice-call' // VOICE-CALL")
  ok(page.indexOf(importLine) > page.indexOf("import { useStudioFlowControl } from '@/hooks/use-studio-flow-control' // FLOW-CONTROL") && page.indexOf(importLine) > page.indexOf('function AuthenticatedBuilderContent('), 'page: the import sits after the Builder content, beside the flow import (older proofs slice the page by position)')
  ok(!page.includes('getUserMedia') && !page.includes('MediaRecorder') && !page.includes('voice-call-controller') && !page.includes('STUDIO_VOICE_CALL_UI_ENABLED'), 'page: it knows the hook and nothing of the microphone, the controller or the flag')
  const click = page.slice(page.indexOf('const handleActionClick = useCallback('), page.indexOf('const handleActionClick = useCallback(') + 6000)
  ok(/sendMessageWhenConnected\(action\.label, undefined, undefined, \{[\s\S]*?actionValue: action\.value,\s*actionLabel: action\.label,/.test(click) && click.includes('const handleActionClick = useCallback(async (action: ActionRequest[\'payload\'][\'actions\'][0], actionRequestMessageId: string, answerKey: string = actionRequestMessageId)'), 'page: a card\'s click (which the spoken yes is handed to) sends the button\'s label as the text with action_value and action_label, and marks the card answered under the answerKey it is given')
  // the socket hook
  eq(lines(ws).filter(line => MARK.test(line)).length, 5, 'ws: five marked lines (the import, the comment, the frame tap, the voice fields, the sent tap)')
  lineOf(ws, "import { STUDIO_VOICE_CALL_UI_ENABLED, addVoiceCallFields, isVoiceCallFrameType, voiceCallBus } from '@/lib/studio-voice-call-ui'; // VOICE-CALL")
  const tap = lineOf(ws, 'voiceCallBus.frame?.(parsedMessage); // VOICE-CALL')
  ok(tap.includes('if (STUDIO_VOICE_CALL_UI_ENABLED && isVoiceCallFrameType(parsedMessage.type) && parsedMessage.session_id === socketSessionId && isCurrentSocket())'), 'ws: the frame tap is gated: the flag, the types that carry state, this socket\'s session, while this socket is current')
  for (const needle of ['routeStudioBulkEditUndoFrame(parsedMessage', 'if (!isKnownDirectorMessageType(parsedMessage.type))', "if (parsedMessage.type === 'deck_mutation') {"]) ok(ws.indexOf(tap) < ws.indexOf(needle), `ws: the tap is ahead of ${needle.slice(0, 40)}`)
  ok(ws.indexOf(tap) > ws.indexOf('flowBus.phase?.(parsedMessage.payload)'), 'ws: ...and after the flow control taps (a frame carries on exactly as before)')
  ok(!/voiceCallBus\.frame\?\.\(parsedMessage\);[^\n]*\n\s*(return|continue)/.test(ws.slice(ws.indexOf(tap), ws.indexOf(tap) + 400)), 'ws: the tap never consumes a frame')
  const fields = lineOf(ws, "if (typeof STUDIO_VOICE_CALL_UI_ENABLED !== 'undefined' && STUDIO_VOICE_CALL_UI_ENABLED) addVoiceCallFields(message.data as unknown as Record<string, unknown>, text); // VOICE-CALL")
  ok(ws.indexOf(fields) > ws.indexOf('if (CHAT_PARITY_CAPS.length > 0) addChatParityCaps(') && ws.indexOf(fields) < ws.indexOf('      return message;\n    };'), 'ws: the voice fields come last, after every other cap, inside buildUserMessage')
  const sentTap = lineOf(ws, 'voiceCallBus.sent?.(text); // VOICE-CALL')
  ok(sentTap.includes("if (STUDIO_VOICE_CALL_UI_ENABLED && (message.data as unknown as Record<string, unknown>).mode === 'voice')"), 'ws: the sent tap is gated and for a voice turn only')
  ok(ws.indexOf(sentTap) > ws.indexOf(fields) && lines(ws)[lines(ws).indexOf(sentTap) - 1].includes('wsRef.current.send(JSON.stringify(message));'), 'ws: ...right after the send')
  ok(!ws.includes('onVoiceCall') && !ws.includes('getUserMedia') && !/mode:\s*'voice'/.test(ws.replace(sentTap, '')), 'ws: no new option, no microphone; the mode is written in the lib only')
  // the composer
  eq(lines(input).filter(line => MARK.test(line)).length, 12, 'input: twelve marked lines (three imports, the prop, its destructuring, the line that hides the composer during a call, the two buttons; the six of the focus: import, flag ref, the effect\'s open, its two lines, its close)')
  lineOf(input, "import { VoiceCallButtons } from './voice-call/voice-call-buttons' // VOICE-CALL"); lineOf(input, "import type { VoiceCallComposerProps } from '@/lib/studio-voice-call-ui' // VOICE-CALL")
  lineOf(input, '  voiceCall?: VoiceCallComposerProps // VOICE-CALL'); lineOf(input, '  voiceCall, // VOICE-CALL')
  const btn = lineOf(input, '{voiceCall ? <VoiceCallButtons {...voiceCall} studio={studio} /> : null}{/* VOICE-CALL')
  ok(input.indexOf(btn) > input.indexOf('{chatClean ? <StudioChatCleanSendSide') && input.indexOf(btn) < input.indexOf('{isTemplateReuseRunning ? (') && input.indexOf(btn) < input.indexOf('data-studio-v4-send="true"') && input.indexOf(btn) > input.indexOf('aria-label="Build theme"'), 'input: the two call buttons sit right beside Send: after the toolbar\'s tools and the chat-clean send side, before Send')
  const hide = lineOf(input, 'if (voiceCall?.active) return null // VOICE-CALL')
  const mainReturn = input.indexOf('  return (\n    <div\n      data-studio-v4-chrome=')
  ok(input.indexOf(hide) < mainReturn && input.slice(input.indexOf(hide) + hide.length, mainReturn).trim() === '' && !/(^\s+|=\s*)use[A-Z]\w*\(/m.test(input.slice(input.indexOf(hide))), 'input: while a call is on the composer returns nothing, right before the main return and after every hook (its draft, uploads and state stay)')
  ok(!lines(input).some(line => /VOICE-CALL/.test(line) && /ml-auto|justify-between/.test(line)), 'input: the call changes none of the toolbar\'s layout in the component (the stylesheet places the buttons)')
  {
    // focus: when a call ends the composer's text box takes it, only if it was lost with the call (the page) or is still in the call's UI
    lineOf(input, "import { callEndFocusGoesToComposer } from '@/lib/studio-voice-call-ui' // VOICE-CALL")
    const inputLines = lines(input)
    const wasOn = lineOf(input, '  const voiceCallWasOn = useRef(false) // VOICE-CALL')
    const open = inputLines.findIndex(line => line.startsWith('  useEffect(() => { // VOICE-CALL (NEXT_PUBLIC_STUDIO_VOICE_CALL): when a call ends'))
    const close = inputLines.findIndex(line => line === '  }, [voiceCall?.active]) // VOICE-CALL')
    ok(open > 0 && close === open + 3 && inputLines.slice(open, close + 1).every(line => MARK.test(line)), 'input: the focus effect is four marked lines, reading only voiceCall.active')
    ok(input.indexOf(wasOn) < input.indexOf(inputLines[open]) && inputLines[open - 1] === wasOn && input.indexOf(inputLines[close]) < input.indexOf(hide) && inputLines[close + 1] === hide, 'input: ...a flag ref and the effect sit together, above the line that hides the composer (hooks run every render)')
    ok(input.indexOf('const textareaRef = useRef<HTMLTextAreaElement | null>(null)') < input.indexOf(wasOn), 'input: ...after the text box ref they focus')
    const body = inputLines.slice(open + 1, close).join('\n')
    const uiLib = makeHost({ over: { [UI]: sources[UI] } }).load(UI)
    const at = (tagName, inCall = false) => ({ tagName, closest: selector => (selector === '[data-studio-voice-call]' && inCall ? {} : null) })
    const BODY = at('BODY'), SIDEBAR = at('BUTTON'), END = at('BUTTON', true)
    const run = steps => {
      const flagRef = { current: false }, focused = [], textareaRef = { current: { focus: options => focused.push(options), blur: () => undefined } }
      const effect = new Function('voiceCall', 'voiceCallWasOn', 'textareaRef', 'callEndFocusGoesToComposer', 'document', body)
      for (const [active, focus] of steps) effect(active === undefined ? undefined : { active }, flagRef, textareaRef, uiLib.callEndFocusGoesToComposer, { activeElement: focus })
      return focused
    }
    eq(run([[false, BODY], [true, BODY], [false, BODY]]), [{ preventScroll: true }], 'focus: the call ends with focus on the page: the text box takes it (without scrolling)')
    eq(run([[false, BODY], [true, null], [false, null]]).length, 1, 'focus: ...focus on nothing: the same')
    eq(run([[false, BODY], [true, END], [false, END]]).length, 1, 'focus: ...focus still in the call\'s UI: the same')
    eq(run([[false, BODY], [true, BODY], [false, SIDEBAR]]).length, 0, 'focus: ...focus anywhere else (the sidebar, a menu, a field) is not taken')
    eq(run([[false, BODY], [true, BODY], [true, BODY], [true, BODY]]).length, 0, 'focus: ...nothing while the call is on')
    eq(run([[false, BODY], [false, BODY], [false, BODY]]).length, 0, 'focus: ...nothing when there was no call')
    eq(run([[undefined, BODY], [undefined, BODY], [undefined, null]]).length, 0, 'focus: ...flag off (no call props): nothing, ever')
    eq(run([[true, BODY], [false, BODY], [false, BODY], [true, BODY], [false, BODY]]).length, 2, 'focus: ...once for each end of a call')
    ok(sources[UI].includes("active.closest?.('[data-studio-voice-call]')") && sources[STAGE].includes('data-studio-voice-call="stage"') && sources[STAGE].includes('data-studio-voice-call="notice"'), 'focus: the call\'s UI is what the stage and the notice are marked with')
  }
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
  ok(hook.includes("import('@/components/builder/voice-call/voice-call-stage')") && !/^import (?!type )[^\n]*voice-call-stage/m.test(hook) && !hook.includes("from 'next/dynamic'"), 'hook: the stage (and its stylesheet and icons, which the two buttons use too) is its own chunk, loaded with the controller when the flag is on, before the buttons are handed out')
  ok(!/^import (?!type )[^\n]*voice-call-buttons/m.test(hook) && /import \{ VoiceCallButtons \}/.test(input), 'hook: the two buttons are the composer\'s own import (a few lines, no stylesheet)')
  // .env.example
  ok(env.endsWith(`\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\n'), '.env.example: the block is the last thing in the file, after one blank line')
  eq(lines(env).filter(line => line === 'NEXT_PUBLIC_STUDIO_VOICE_COMPANION="felix"').length, 1, '.env.example: the companion once, "felix"'); eq(lines(env).filter(line => /^NEXT_PUBLIC_STUDIO_VOICE_CALL=/.test(line)).length, 1, '.env.example: the call flag is on ELEMENT-3\'s one line, not repeated here')
  ok(lines(strip.VOICE_CALL_ENV_BLOCK).filter(line => line && !line.startsWith('#') && line !== 'NEXT_PUBLIC_STUDIO_VOICE_COMPANION="felix"').length === 0, '.env.example: the block is comments and its one assignment')
  ok(lines(env.slice(env.indexOf('# STUDIO VOICE CALL UI'))).every(line => !/exact "true" enables it/.test(line)), '.env.example: the block does not use the phrase older proofs read')
  if (base) {
    for (const rel of strip.VOICE_CALL_FILES) {
      ok(othersOut(base.__reg, rel, strip.stripVoiceCall(rel, sources[rel])) === othersOut(base.__reg, rel, base[rel]), `${rel}: without this change's lines it is the base's file, byte for byte (read past the other registered changes, which came with the merged core)`)
      ok(sources[rel] !== base[rel], `${rel}: it is changed`)
    }
  }
  // the older proofs this change teaches, and the registry text
  if (base && base.__reg) {
    eq(lines(read('scripts/test-theme-font-selection.mjs')).filter(line => MARK.test(line)).length, 0, 'pins: the font-selection sandbox is not touched (the socket hook\'s voice line guards the flag with typeof: nothing to define there)')
    eq(lines(read('scripts/test-studio-chat-theme-export.mjs')).filter(line => MARK.test(line)).length, 0, 'pins: the chat theme export proof is not touched here (it is the voice core\'s: ELEMENT-3 taught it at ad5b5232)')
    eq(lines(read('scripts/test-studio-stage-open-gate.mjs')).filter(line => MARK.test(line)).length, 0, 'pins: the stage open gate proof is not touched here (it reads the page past every registered later change: laterStrips)')
    eq(['Voice call: the lib', 'Voice core: x', 'Chat element edit: x', 'Voice caller: x'].map(coreMod.isVoiceCoreCommitSubject), [true, true, false, false], 'subjects: the voice core\'s subject helper (read by the scope proofs that were taught it) also leaves out "Voice call:" commits, and nothing else')
    eq(strip.VOICE_CALL_PUT_BACK_FILES.map(rel => lines(read(rel)).filter(line => MARK.test(line)).length), [0, 0, 0, 0, 0], 'pins: the five proofs one commit touched and a later one put back carry nothing of this change now')
    eq(lines(core_text()).filter(line => MARK.test(line)).length, 1, 'core strip: one marked line (the helper\'s return), nothing else of the core\'s file is touched here')
    ok(!strip.VOICE_CALL_FILES.includes('scripts/studio-voice-core-strip.mjs') && strip.VOICE_CALL_SCOPE_FILES.has('scripts/studio-voice-core-strip.mjs'), 'core strip: it is a scope file of this change, and the strip does not take its marked line out (that line is an edit, not an insertion)')
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
  ok(sources[PLAYER].includes('const catalog = await loadCompanionPack(pack, framing, fetchJson, core.parseBirdMotionManifest)') && sources[PLAYER].includes('core.resolveCompanionClip(manifest, name)') && !sources[PLAYER].includes('loadCatalog('), 'player: the whole character and its Face pack both read through the lib\'s pack loader (the compatibility view, companion clips merged when the base lacks them), and every clip is resolved through the core (a pack without one falls back)')
  // the v2 seam: one function, null today (the compatibility view), called right after the body is drawn, and the loop repaints every frame when a painter is there
  ok(sources[PLAYER].includes("export function layeredPainterFor(pack: Pick<LoadedPack, 'layered' | 'manifest' | 'base'>): LayerPainter | null {") && sources[PLAYER].includes('const face = parsedLayeredFace(pack)') && (sources[PLAYER].match(/layeredPainterFor\(/g) ?? []).length === 2, 'player: the v2 renderer plugs in at one function (layeredPainterFor), which parses the face section and returns null (the compatibility view) when it does not parse')
  ok(sources[PLAYER].includes('const painter = layeredPainterFor(loaded)') && /context\.drawImage\(bitmap[^\n]*\n\s*shownId = id\n\s*painter\?\.\(\{ context, canvas, pack: loaded, frame: store\.has\(id\) \? id : loaded\.manifest\.neutral, bitmap, rect, scene: currentScene, level: live\.current\.getLevel\(\), timeSec: \(performance\.now\(\) - sceneStart\) \/ 1000, reduced: live\.current\.reducedMotion \}\)/.test(sources[PLAYER]) && sources[PLAYER].includes('if (next.id !== shownId || !store.has(next.id) || painter) {') && sources[PLAYER].includes('layered: catalog.layered'), 'player: a painter is called with the body just drawn, the loop repaints each frame when there is one (the body holds while the mouth changes), and the pack keeps its layered section')
  ok(sources[PLAYER].includes("const portrait = loaded === null && noPortrait !== pack") && sources[PLAYER].includes('src={portraitUrl(pack)}') && sources[PLAYER].includes('onError={() => setNoPortrait(pack)}') && sources[PLAYER].includes("data-companion-art={loaded === null ? (portrait ? 'portrait' : 'initials') : undefined}") && sources[PLAYER].includes('{!ready && !portrait ? <span className="studio-voice-initials"'), 'player: a pack with no usable catalog shows its portrait, and the initials only when that fails too')
  ok(sources[STAGE].includes('size={videoCharacterPx(height)}') && sources[STAGE].includes("useLevelVariable(ringRef, getLevel, live && !snapshot.reducedMotion && (snapshot.holding || snapshot.scene === 'speaking'))") && sources[STAGE].includes('const read = () => setHeight(element.clientHeight)') && sources[STAGE].includes('new ResizeObserver(read)'), 'stage: the character is as tall as the call\'s measured height allows (it follows a resize), and the level ring is driven only while you talk or it speaks, never in reduced motion')
  ok(/if \(plan\.accent\) \{[\s\S]{0,260}overlay = \{ clip: plan\.accent\.clip[\s\S]{0,400}mouthShapeIndex\(/.test(sources[PLAYER]), 'player: an accent can play while it speaks (before the mouth is drawn)')
  // the stylesheet: nothing global, nothing that reaches an element without the call's own attributes
  const css = sources[CSS]
  const selectorParts = selector => { const out = []; let depth = 0, cur = ''; for (const ch of selector) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch } out.push(cur); return out }
  const keyed = line => selectorParts(line.slice(0, line.indexOf('{'))).every(part => part.includes('[data-studio-voice-call="'))
  ok(lines(css).filter(line => /^[^\s@/}]/.test(line) && !keyed(line)).length === 0, 'css: every rule is keyed to the call\'s own attribute')
  ok(!/\[data-studio-v4-send\]/.test(css) && !/(^|\n)(html|body|button|\*)\b/.test(css), 'css: nothing reaches Send or any element the call does not own')
  ok(/@media \(max-width: 767px\)[\s\S]*position: fixed; inset: 0; z-index: 200/.test(css) && /studio-voice-start-word \{ display: inline; \}/.test(css) && /\[data-studio-chat-clean\] \[data-studio-v4-composer-toolbar\] button\[data-studio-voice-call="button"\]\[data-voice-mode\] \{ width: 24px; height: 24px/.test(css) && /flex: 0 0 20%/.test(css), 'css: the stage is the whole screen on a phone, the buttons are the chat-clean 24 px square beside Send (a word on each on a phone), the transcript is a fifth')
  ok(/prefers-reduced-motion: reduce/.test(css) && /max-width: 767px/.test(css), 'css: reduced motion and the phone layout are there')
}

const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const baseOk = (() => { try { git('cat-file', '-e', `${strip.BASE_COMMIT}^{commit}`); return true } catch { return false } })()
const baseSources = baseOk ? Object.fromEntries(strip.VOICE_CALL_FILES.map(rel => [rel, git('show', `${strip.BASE_COMMIT}:${rel}`)])) : null
// This change's own commits (the merge of ELEMENT-3's core is not one of them): by subject, from the base.
const OWN = baseOk ? git('log', '--no-merges', '--format=%H', `--grep=^${strip.VOICE_CALL_SUBJECT}`, '-E', `${strip.BASE_COMMIT}..HEAD`).split('\n').filter(Boolean) : []

async function all(over = {}, { slow = true } = {}) {
  if (baseSources && !baseSources.__reg) Object.defineProperty(baseSources, '__reg', { value: await import('./studio-later-changes.mjs'), enumerable: false })
  uiSuite(loadUi(over), over)
  await routerSuite(over)
  await controllerSuite(over)
  await stageSuite(over)
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
    for (const rel of strip.VOICE_CALL_FILES) {
      // the lines of the base, read past the other registered changes (the merged core's own marked lines), must all be in the file, in order, and every other line must carry this change's marker
      const was = othersOut(registry, rel, baseSources[rel]).split('\n'), now = othersOut(registry, rel, git('show', `HEAD:${rel}`)).split('\n')
      const added = [], removed = []
      let at = 0
      for (const line of now) { if (at < was.length && line === was[at]) at++; else added.push(line) }
      for (let i = at; i < was.length; i++) removed.push(was[i])
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
  for (const rel of strip.VOICE_CALL_RETIRED_FILES) ok(!fs.existsSync(path.join(root, rel)) && strip.VOICE_CALL_SCOPE_FILES.has(rel) && !strip.VOICE_CALL_NEW_FILES.includes(rel), `scope: ${rel} is gone from the tree (the stage and the two buttons replaced it) and stays named for the history`)
  ok(strip.VOICE_CALL_FILES.every(rel => !strip.VOICE_CALL_NEW_FILES.includes(rel)), 'scope: marked and new files are different lists')
  // the committed art: Felix and Bob in Garud's bird layout, Maya in the v2 layout (her native Face catalog at the pack's root), the runtime files only
  {
    const tracked = git('ls-files', 'public/companions').split('\n').filter(Boolean).sort()
    eq(tracked, [...strip.VOICE_CALL_ART_FILES].sort(), 'art: the written-out list (scripts/studio-voice-call-art-files.mjs) is exactly what is tracked under public/companions')
    const layout = /^public\/companions\/(felix|bob|maya)\/(portrait-(256|512)\.webp|icon-(20|32|64|96)\.webp|blink-[12]\.webp|talk-[0-3]\.webp|motion\/[A-Za-z0-9_.\/-]+\.(webp|json)|face\/[A-Za-z0-9_.\/-]+\.(webp|json)|video\/[A-Za-z0-9_.-]+\.webp)$/
    eq(tracked.filter(rel => !layout.test(rel)), [], 'art: only the bird layout\'s runtime files (portraits, icons, blink and talk stills, motion/ with its Face pack and manifests, video/; Maya\'s native Face catalog is face/ at her root), no README, no review images, no scene')
    eq([...new Set(tracked.filter(rel => /\/face\//.test(rel) && !/\/motion\/face\//.test(rel)).map(rel => rel.split('/')[2]))], ['maya'], 'art: only Maya has a Face catalog at the pack\'s root (Felix and Bob\'s is motion/face/)')
    for (const name of ['felix', 'bob']) for (const file of ['motion/manifest.json', 'motion/face/manifest.json', 'portrait-256.webp', 'icon-96.webp']) ok(tracked.includes(`public/companions/${name}/${file}`), `art: ${name} has ${file}`)
    for (const file of ['motion/manifest.json', 'face/manifest.json', 'portrait-256.webp', 'portrait-512.webp', 'icon-96.webp', 'blink-1.webp', 'blink-2.webp', 'talk-0.webp', 'talk-3.webp', 'video/gesture-point.webp']) ok(tracked.includes(`public/companions/maya/${file}`), `art: maya has ${file}`)
    ok(!tracked.some(rel => rel.startsWith('public/companions/maya/') && (/README|\.md$/i.test(rel) || /motion\/face\//.test(rel))), 'art: Maya has no README and no motion/face/ (her Face catalog is the one at her root)')
    ok(tracked.includes('public/companions/bob/motion/companion.json') && tracked.includes('public/companions/bob/motion/face/companion.json') && !tracked.includes('public/companions/felix/motion/companion.json'), 'art: Bob keeps his companion clips in companion.json (the player merges it), Felix has all of his in the manifest')
    const bytes = tracked.reduce((sum, rel) => sum + fs.statSync(path.join(root, rel)).size, 0)
    ok(bytes > 30 * 1024 * 1024 && bytes < 40 * 1024 * 1024, `art: about 34 MiB in all (${(bytes / 1048576).toFixed(1)} MiB)`)
    const mayaFiles = tracked.filter(rel => rel.startsWith('public/companions/maya/')), mayaBytes = mayaFiles.reduce((sum, rel) => sum + fs.statSync(path.join(root, rel)).size, 0)
    eq([mayaFiles.length, mayaBytes], [360, 10746812], 'art: Maya is 360 files, 10,746,812 bytes (10.2 MiB, no README)')
    for (const name of ['felix', 'bob', 'maya']) { const manifest = JSON.parse(fs.readFileSync(path.join(root, `public/companions/${name}/motion/manifest.json`), 'utf8')); eq([manifest.version, manifest.bird, typeof manifest.clips.idle_breathe, typeof manifest.clips.talk_neutral], [1, name, 'object', 'object'], `art: ${name}'s manifest is the bird layout's`) }
    // Maya: two self-contained catalogs (the 768 whole character, the native Face), each with the v2 face section inline; each is read in the compatibility view by the real core's parser
    {
      const uiHost = makeHost({ over: {} }), uiMod = uiHost.load(UI), coreMod = uiHost.load('lib/studio/voice/bird-motion.ts')
      for (const [dir, size, bytes, variant] of [['motion', [768, 768], 4791288, undefined], ['face', [604, 594], 4999106, 'face']]) {
        const raw = JSON.parse(fs.readFileSync(path.join(root, `public/companions/maya/${dir}/manifest.json`), 'utf8'))
        const files = mayaFiles.filter(rel => rel.startsWith(`public/companions/maya/${dir}/`)), sum = files.reduce((total, rel) => total + fs.statSync(path.join(root, rel)).size, 0)
        eq([raw.version, raw.bird, raw.packBudgetMiB, [raw.size.width, raw.size.height], raw.totalBytes, sum, raw.variant, uiMod.isLayeredFace(raw.face), raw.face.angles, Object.keys(raw.face.pieces).sort()], [1, 'maya', 8, size, bytes, bytes, variant, true, ['front', 'left', 'right'], ['brows', 'eyes', 'mouth']], `art: Maya's ${dir} catalog is self-contained (its own manifest, bodies and ${dir === 'motion' ? 'default 768' : 'native Face'} pictures: ${bytes} bytes, under the 8 MiB budget) with the v2 face section inline`)
        const refs = new Set(Object.values(raw.frames).map(frame => frame.src)), walk = value => { if (typeof value === 'string') { if (value.endsWith('.webp')) refs.add(value) } else if (value && typeof value === 'object') for (const item of Object.values(value)) walk(item) }
        walk(raw.face)
        eq([[...refs].filter(rel => !fs.existsSync(path.join(root, `public/companions/maya/${dir}`, rel))), files.length - 1 - refs.size, raw.uniqueFrames, Object.keys(raw.frames).length, raw.totalBytes < 8 * 1024 * 1024], [[], 0, 77, 77, true], `art: Maya's ${dir} catalog: every body picture and every face piece it names is in the folder, and nothing else is (77 bodies, ${refs.size - 77} face pieces)`)
        const view = uiMod.compatCatalog(raw), parsed = coreMod.parseBirdMotionManifest(view.catalog)
        eq([view.layered === raw.face, 'face' in parsed, parsed.bird, parsed.variant, Object.keys(parsed.clips).length, !!parsed.clips.lean_in, uiMod.needsCompanionCatalog(raw)], [true, false, 'maya', variant, 61, true, false], `art: Maya's ${dir} catalog in the compatibility view is accepted by the core's parser (61 clips, her own lean_in, so no companion.json is asked for)`)
      }
    }
    const felixManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/companions/felix/motion/manifest.json'), 'utf8'))
    eq(['lean_in', 'work_loop', 'look_down', 'one_moment', 'invite', 'hold', 'point_left', 'point_right', 'emphasis', 'shrug', 'thank_you', 'count', 'wave_both'].filter(name => !felixManifest.clips[name]), [], 'art: Felix has every companion clip (so the player never falls back for him)')
    const bobManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/companions/bob/motion/manifest.json'), 'utf8'))
    ok(!bobManifest.clips.lean_in && !bobManifest.clips.emphasis, 'art: Bob\'s base manifest lacks the companion clips (they are in companion.json)')
    const bobCatalog = JSON.parse(fs.readFileSync(path.join(root, 'public/companions/bob/motion/companion.json'), 'utf8'))
    const bobMerged = (makeHost({ over: {} }).load(UI)).mergeCompanionCatalog(bobManifest, bobCatalog)
    eq(['lean_in', 'work_loop', 'look_down', 'one_moment', 'invite', 'hold', 'point_left', 'point_right', 'emphasis', 'shrug', 'thank_you', 'wave_both'].filter(name => !bobMerged.clips[name]), [], 'art: merged, Bob has the clips he was delivered (only count falls back)')
    eq([bobMerged.uniqueFrames, Object.keys(bobMerged.frames).length, bobMerged.totalBytes <= 8 * 1024 * 1024], [Object.keys(bobMerged.frames).length, Object.keys(bobMerged.frames).length, true], 'art: ...and the merged catalog\'s counts are the core parser\'s (uniqueFrames, size within the budget)')
    ok(Object.values(bobMerged.frames).every(frame => fs.existsSync(path.join(root, 'public/companions/bob/motion', frame.src))), 'art: ...every frame of it is a file in the pack')
  }
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
  [UI, 'the audio disc is 180 px', 'export const AUDIO_DISC_PX = 176', 'export const AUDIO_DISC_PX = 180'],
  [UI, 'the phone disc is 160 px', 'export const AUDIO_DISC_PX_PHONE = 148', 'export const AUDIO_DISC_PX_PHONE = 160'],
  [UI, 'the transcript is a quarter', 'export const TRANSCRIPT_SHARE = 0.2', 'export const TRANSCRIPT_SHARE = 0.25'],
  [UI, 'the character ignores the scene\'s share', 'canvasHeight * SCENE_SHARE * 0.78', 'canvasHeight * 0.78'],
  [UI, 'the character may be huge', 'Math.min(640, Math.max(160,', 'Math.min(2000, Math.max(160,'],
  [UI, 'a scene path may leave the pack', "&& !path.split('/').includes('..') && !path.includes('//') ? path", '? path'],
  [UI, 'a scene may be any file', '\\.(webp|png|jpg|jpeg)$/.test(path)', '\\.[a-z]+$/.test(path)'],
  [UI, 'the transcript repeats a line', 'if (last && last.who === who && last.text === line) return list', ''],
  [UI, 'the transcript never joins', 'if (join && last && last.who === who) return', 'if (false) return'],
  [UI, 'the transcript is unbounded', 'return next.length > max ? next.slice(next.length - max) : next', 'return next'],
  [UI, 'the transcript keeps the oldest', 'next.slice(next.length - max)', 'next.slice(0, max)'],
  [UI, 'Felix is not the default', "export const DEFAULT_COMPANION = 'felix'", "export const DEFAULT_COMPANION = 'bob'"],
  [UI, 'a stranger\'s character is believed', "return typeof stored === 'string' && companionChoices(fallback).includes(stored) ? stored : fallback", "return typeof stored === 'string' ? stored : fallback"],
  [UI, 'blocked storage fails the read', "  } catch { return fallback }\n}\nexport function writeCompanionChoice", "  } catch (e) { throw e }\n}\nexport function writeCompanionChoice"],
  [UI, 'any name is written', "if (!storage || !companionChoices(fallback).includes(name)) return false", "if (!storage) return false"],
  [UI, 'a failed write is an error', "  } catch { return false }\n}\n/** The next character", "  } catch (e) { throw e }\n}\n/** The next character"],
  [UI, 'the switch does not wrap', 'choices[(at + 1) % choices.length]!', 'choices[Math.min(at + 1, choices.length - 1)]!'],
  [UI, 'the catalog is always asked for', '!!raw.clips && !raw.clips.lean_in', '!!raw.clips'],
  [UI, 'the companion\'s frames win', 'const frames = { ...companion.frames, ...base.frames }', 'const frames = { ...base.frames, ...companion.frames }'],
  [UI, 'the companion\'s clips win', 'const clips = { ...companion.clips, ...base.clips }', 'const clips = { ...base.clips, ...companion.clips }'],
  [UI, 'the merged size is not capped', 'Math.min(budget * 1024 * 1024, (base.totalBytes ?? 0) + (companion.totalBytes ?? 0))', '(base.totalBytes ?? 0) + (companion.totalBytes ?? 0)'],
  [UI, 'the merged frame count is stale', 'uniqueFrames: Object.keys(frames).length, totalBytes: bytes', 'uniqueFrames: base.uniqueFrames, totalBytes: bytes'],
  [UI, 'the budget is not held to 6..8', 'Math.min(8, Math.max(6, base.packBudgetMiB as number))', '(base.packBudgetMiB as number)'],
  [UI, 'the speaking scene has no emphasis', "accent: { clip: 'emphasis', reverse: false, everyMs: [7000, 11000] }, blink: false, still: { clip: 'talk_neutral', at: 'first' } }", "accent: null, blink: false, still: { clip: 'talk_neutral', at: 'first' } }"],
  [UI, 'a tap is a long press', 'export const TAP_TALK_MS = 300', 'export const TAP_TALK_MS = 0'],
  [UI, 'a latch is never sent', 'export const LATCH_MAX_MS = 60000', 'export const LATCH_MAX_MS = 6000000'],
  [UI, 'the talk button does not say Muted', "if (input.muted) return 'Muted'", "if (input.muted) return 'Hold to talk'"],
  [UI, 'the talk button does not say Tap to send', "if (input.latched) return 'Tap to send'", "if (input.latched) return 'Release to send'"],
  [UI, 'the ring is not clamped', 'Math.round(Math.min(1, level * 4) * 100) / 100', 'Math.round(level * 4 * 100) / 100'],
  [UI, 'Space is taken from the talk button', "if (target.closest?.('.studio-voice-talk')) return false", ''],
  [UI, 'a muted call can talk', 'talk: live && input.connected && !input.muted', 'talk: live && input.connected'],
  [UI, 'a call cannot be muted', 'mute: live, end: live', 'mute: false, end: live'],
  [UI, 'a phone is wider', "'(max-width: 767px)'", "'(max-width: 1023px)'"],
  [UI, 'Stop is always on', 'stop: live && (input.phase', 'stop: live || (input.phase'],
  [UI, 'talking works without a socket', 'talk: live && input.connected', 'talk: live'],
  [UI, 'Space talks in a text field', "tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true", 'false'],
  [UI, 'Space is taken from a button', "if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true", ''],
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
  [CTL, 'the debt is not paid while the user talks', "if (!awaiting && this.owedReplies > 0) { this.owedReplies--; return } // the reply to a turn the user cancelled: it is in the chat, it is not said (also when the user is already talking: the debt is paid either way)\n    if (this.cs.phase === 'listening') return // the user is talking: the reply is in the chat, and nothing talks over them\n", "if (this.cs.phase === 'listening') return // the user is talking\n    if (!awaiting && this.owedReplies > 0) { this.owedReplies--; return }\n"],
  [CTL, 'a status outlives the reply it came before', 'this.progressLine = null // a status is only worth saying while the wait goes on', 'void 0 // a status is only worth saying while the wait goes on'],
  [CTL, 'a progress bubble counts as the reply', 'if (this.awaiting && this.awaiting.sendObserved) this.owedReplies++', 'if (this.awaiting && this.awaiting.sendObserved && !this.awaiting.replyTextArrived) this.owedReplies++'],
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
  [CTL, 'a card is not tracked', "if (buttons && typeof id === 'string' && id) this.openAction = { messageId: id, timestamp: (frame as { timestamp?: unknown }).timestamp, actions: buttons }", ''],
  [CTL, 'the card is marked answered by its bare id', 'askAnswerKey({ message_id: open.messageId, timestamp: open.timestamp })', 'open.messageId'],
  [CTL, 'the card\'s timestamp is not kept', 'timestamp: (frame as { timestamp?: unknown }).timestamp, actions: buttons }', 'timestamp: undefined, actions: buttons }'],
  [CTL, 'the answer key is not handed on', 'this.sendAction(action, open.messageId, askAnswerKey({ message_id: open.messageId, timestamp: open.timestamp }))', "this.sendAction(action, open.messageId, '')"],
  [CTL, 'a card is pressed by the typed path', 'await (action && open ? this.sendAction(action, open.messageId, askAnswerKey({ message_id: open.messageId, timestamp: open.timestamp })) : this.sendTurn(text))', 'await this.sendTurn(text)'],
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
  [CTL, 'the mouth reads the speaker when it is silent', 'getLevel = (): number => (this.speakingNow ? this.player.level() : this.holding && this.mic?.level ? this.mic.level() : 0)', 'getLevel = (): number => this.player.level()'],
  [CTL, 'the ring never reads the microphone', ': this.holding && this.mic?.level ? this.mic.level() : 0)', ': 0)'],
  [CTL, 'a snapshot is rebuilt for nothing', 'if (same) return\n    this.snapshot = next', 'this.snapshot = next'],
  // the hook and the components
  [HOOK, 'the flag does not gate the load', 'const enabled = options.enabled && STUDIO_VOICE_CALL_UI_ENABLED', 'const enabled = options.enabled'],
  [HOOK, 'the bus is not cleared', 'if (voiceCallBus.frame === made.onFrame) voiceCallBus.frame = null', ''],
  [HOOK, 'the call outlives the session', 'controller?.endCall()', 'void 0'],
  [HOOK, 'the controller is not disposed', 'made.dispose()', 'void 0'],
  [HOOK, 'Space presses the wrong way', '      event.preventDefault()\n      controller.talkPress()\n', '      event.preventDefault()\n      controller.talkRelease()\n'],
  [HOOK, 'Space is not let go', '      event.preventDefault()\n      controller.talkRelease()\n', '      event.preventDefault()\n      controller.talkPress()\n'],
  [HOOK, 'losing the window does not let go', "const release = () => { void controller.pttUp() }", 'const release = () => {}'],
  [HOOK, 'a button starts the wrong kind of call', 'onStart: mode => { void controller.startCall(mode) }', 'onStart: () => { void controller.startCall() }'],
  [HOOK, 'Try again starts another kind of call', 'void controller.startCall(controller.getSnapshot().mode)', 'void controller.startCall()'],
  [HOOK, 'the composer stays during a call', 'active: snapshot.active || snapshot.starting, busy', 'active: false, busy'],
  [HOOK, 'the stage is never drawn', 'const showDock = snapshot.active || snapshot.starting || !!snapshot.notice', 'const showDock = false'],
  [HOOK, 'the choice is not stored', 'writeCompanionChoice(deviceStorage(), next, STUDIO_VOICE_COMPANION); ', ''],
  [HOOK, 'the choice is not read', 'readCompanionChoice(deviceStorage(), STUDIO_VOICE_COMPANION)', 'STUDIO_VOICE_COMPANION'],
  [HOOK, 'the switch does not switch', 'setCompanion(next) }', 'void 0 }'],
  [HOOK, 'blocked storage breaks the page', 'try { return typeof window !== \'undefined\' ? window.localStorage : null } catch { return null }', 'return typeof window !== \'undefined\' ? window.localStorage : null'],
  [HOOK, 'the mute button does nothing', 'onMute: muted => controller.setMuted(muted)', 'onMute: () => {}'],
  [STAGE, 'the chip is not shown', '<span className="studio-voice-chip" data-chip={snapshot.chip} role="status"><i aria-hidden />{snapshot.chip}</span>', ''],
  [STAGE, 'video draws the disc', 'framing="chest" size={videoCharacterPx(height)}', 'framing="disc" size={videoCharacterPx(height)}'],
  [STAGE, 'video ignores the call\'s height', 'size={videoCharacterPx(height)}', 'size={240}'],
  [STAGE, 'the disc is not smaller on a phone', 'const discPx = phone ? AUDIO_DISC_PX_PHONE : AUDIO_DISC_PX', 'const discPx = AUDIO_DISC_PX'],
  [STAGE, 'audio has no ring', '<i className="studio-voice-ring" aria-hidden />', ''],
  [STAGE, 'the level ring runs for nothing', "live && !snapshot.reducedMotion && (snapshot.holding || snapshot.scene === 'speaking')", 'true'],
  [STAGE, 'Mute is always off', 'disabled={!controls.mute}', 'disabled={true}'],
  [STAGE, 'Mute does not toggle', 'onClick={() => onMute(!muted)}', 'onClick={() => onMute(false)}'],
  [STAGE, 'the talk button is not off when muted', 'disabled={!controls.talk}', 'disabled={false}'],
  [STAGE, 'the talk button\'s press is its release', 'event.currentTarget.setPointerCapture?.(event.pointerId); onTalkPress() }}', 'event.currentTarget.setPointerCapture?.(event.pointerId); onTalkRelease() }}'],
  [STAGE, 'a cancelled touch does not let go', 'onPointerCancel={onTalkRelease}', 'onPointerCancel={() => {}}'],
  [STAGE, 'Space clicks the talk button', "if (event.key === ' ') event.preventDefault()", ''],
  [STAGE, 'the transcript is hidden by default', 'const [collapsed, setCollapsed] = useState(false)', 'const [collapsed, setCollapsed] = useState(true)'],
  [STAGE, 'the transcript toggle does not toggle', 'onToggle={() => setCollapsed(value => !value)}', 'onToggle={() => setCollapsed(true)}'],
  [STAGE, 'a hidden transcript still lists', '{collapsed ? null : (', '{false ? null : ('],
  [STAGE, 'the subtitle is always shown', "const subtitle = collapsed && !snapshot.starting ? snapshot.caption : null", "const subtitle = !snapshot.starting ? snapshot.caption : null"],
  [STAGE, 'the subtitle never shows', "const subtitle = collapsed && !snapshot.starting ? snapshot.caption : null", 'const subtitle = null'],
  [STAGE, 'you are the companion', "<b>{entry.who === 'you' ? 'You' : name}</b>", '<b>{name}</b>'],
  [STAGE, 'the transcript is not a log', 'role="log"', 'role="region"'],
  [STAGE, 'the scene is asked for in audio', 'useSceneArt(pack, live && mode === \'video\')', 'useSceneArt(pack, live)'],
  [STAGE, 'the scene is asked for without a call', 'useSceneArt(pack, live && mode === \'video\')', 'useSceneArt(pack, mode === \'video\')'],
  [STAGE, 'the scene is never used', "data-voice-art={art ? 'image' : 'gradient'}", "data-voice-art=\"gradient\""],
  [STAGE, 'the scene is the wrong file', 'const url = sceneUrl(pack, file)', 'const url = sceneUrl(pack, DEFAULT_SCENE_FILE)'],
  [STAGE, 'the manifest\'s scene is not read', 'file = sceneFileFrom(((await response.json()) as { scene?: unknown } | null)?.scene)', 'file = DEFAULT_SCENE_FILE'],
  [STAGE, 'a missing scene is shown', 'image.onerror = () => resolve(null)', 'image.onerror = () => resolve(url)'],
  [STAGE, 'the notice has no stage-less form', "if (!live) return noticeBlock ?", "if (false) return noticeBlock ?"],
  [STAGE, 'the phone stage stays under the shell', 'const portalTo = phone ? shellRoot() : null', 'const portalTo = null'],
  [STAGE, 'the desktop stage leaves the column', 'const portalTo = phone ? shellRoot() : null', 'const portalTo = shellRoot()'],
  [STAGE, 'the phone is read after the first render', "useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(VOICE_PHONE_MEDIA).matches)", 'useState(false)'],
  [STAGE, 'the switch is always shown', '{choices.length > 1 ? (', '{true ? ('],
  [STAGE, 'the switch goes nowhere', 'onClick={onChooseCompanion}', 'onClick={() => {}}'],
  [STAGE, 'the switch names the same character', 'Character: ${name}. Switch to ${companionName(nextCompanion(pack, choices))}', 'Character: ${name}. Switch to ${name}'],
  [STAGE, 'the status is always the hint', "snapshot.progress && !muted && !snapshot.starting ? 'studio-voice-progress' : 'studio-voice-hint'", "'studio-voice-hint'"],
  [STAGE, 'the muted status is lost', "muted ? MUTED_HINT : snapshot.progress", "snapshot.progress"],
  [STAGE, 'a notice has no way to retry', '{notice.retry ? <button type="button" onClick={onRetry}>Try again</button> : null}', ''],
  [STAGE, 'Stop is not off in your turn', 'disabled={!controls.stop}', 'disabled={false}'],
  [BUTTONS, 'both buttons say the same', 'const label = callButtonLabel(mode)', "const label = callButtonLabel('audio')"],
  [BUTTONS, 'both buttons start the same call', 'onClick={() => onStart(mode)}', "onClick={() => onStart('audio')}"],
  [BUTTONS, 'the buttons stay on while the mic is asked for', 'disabled={disabled || busy}', 'disabled={disabled}'],
  [BUTTONS, 'a press takes the draft\'s focus', 'onMouseDown={event => event.preventDefault()}', 'onMouseDown={() => {}}'],
  [BUTTONS, 'only one button', 'CALL_MODES.map(mode', "CALL_MODES.slice(0, 1).map(mode"],
  [BUTTONS, 'the word shows on a desktop', 'studio-voice-start-word hidden', 'studio-voice-start-word'],
  [UI, 'the Face pack does not read its catalog', 'const face = await read(url)', 'const face = { manifest: parse(await fetchJson(url)), layered: null }'],
  [UI, 'the whole character does not read its catalog', 'const main = await read(`${root}manifest.json`)', 'const main = { manifest: parse(await fetchJson(`${root}manifest.json`)), layered: null, pointer: null }'],
  [UI, 'the catalog is asked for every time', '  if (needsCompanionCatalog(raw)) {\n    try {', '  if (true) {\n    try {'],
  [UI, 'a catalog that fails fails the pack', '    } catch { /* the base alone */ }\n  }\n  return parse(raw)', '    } catch (e) { throw e }\n  }\n  return parse(raw)'],
  [UI, 'the catalog is read from the wrong place', "url.replace(/[^/]*$/, 'companion.json')", "'companion.json'"],
  [UI, 'the catalog is not merged', 'return parse(mergeCompanionCatalog(raw, (await fetchJson(', 'return parse((raw, (await fetchJson('],
  [PLAYER, 'nothing plays while it speaks', '// an emphasis now and then while it speaks (the mouth is still for the moment it takes)\n        if (plan.accent) {', '// an emphasis now and then while it speaks (the mouth is still for the moment it takes)\n        if (false) {'],
  [PLAYER, 'a pack that fails shows nothing', "{!ready && !portrait ? <span className=\"studio-voice-initials\" aria-hidden>{initialsFor(pack)}</span> : null}", ''],
  // Maya, the third companion: the choice, the compatibility view of a v2 pack, the pack loader, the v2 seam, the portrait fallback, the dots
  [UI, 'Maya is not on offer', "export const COMPANION_CHOICES: readonly string[] = ['felix', 'bob', 'maya']", "export const COMPANION_CHOICES: readonly string[] = ['felix', 'bob']"],
  [UI, 'Maya is first', "export const COMPANION_CHOICES: readonly string[] = ['felix', 'bob', 'maya']", "export const COMPANION_CHOICES: readonly string[] = ['maya', 'felix', 'bob']"],
  [UI, 'a v1 Face pointer is a layered face', "return typeof section.manifest !== 'string' && !!section.pieces && typeof section.pieces === 'object'", "return !!section.pieces && typeof section.pieces === 'object'"],
  [UI, 'a layered face needs no pieces', "return typeof section.manifest !== 'string' && !!section.pieces && typeof section.pieces === 'object'", "return typeof section.manifest !== 'string'"],
  [UI, 'any object is a layered face', "return isLayeredFace(face) ? { catalog: rest, layered: face } : { catalog: raw, layered: null }", "return face && typeof face === 'object' ? { catalog: rest, layered: face as Record<string, unknown> } : { catalog: raw, layered: null }"],
  [UI, 'the compatibility view keeps the section in the catalog', "return isLayeredFace(face) ? { catalog: rest, layered: face } : { catalog: raw, layered: null }", "return isLayeredFace(face) ? { catalog: raw, layered: face } : { catalog: raw, layered: null }"],
  [UI, 'the compatibility view drops the section', "return isLayeredFace(face) ? { catalog: rest, layered: face } : { catalog: raw, layered: null }", "return isLayeredFace(face) ? { catalog: rest, layered: null } : { catalog: raw, layered: null }"],
  [UI, 'the compatibility view changes the manifest it was given', "const { face, ...rest } = raw as Record<string, unknown>\n  return isLayeredFace", "const { face, ...rest } = raw as Record<string, unknown>\n  delete (raw as Record<string, unknown>).face\n  return isLayeredFace"],
  [UI, 'the compatibility view touches a non-object', "if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { catalog: raw, layered: null }\n  const { face, ...rest }", "const { face, ...rest }"],
  [UI, 'a v2 pack\'s Face catalog is in motion/face', "main.layered ? `/companions/${pack}/face/manifest.json` : main.pointer", "main.layered ? `${root}face/manifest.json` : main.pointer"],
  [UI, 'a v1 pack\'s Face pointer is ignored', ": main.pointer ? `${root}${main.pointer}` : null", ": null"],
  [UI, 'the audio call reads no Face catalog', "    if (framing === 'disc') {\n      const url =", "    if (false) {\n      const url ="],
  [UI, 'a refused Face catalog fails the pack', "        } catch { /* the Face pack is optional: the whole character is cropped instead */ }", "        } catch (e) { throw e }"],
  [UI, 'a refused character is thrown', "    return { manifest: main.manifest, layered: main.layered, base: root }\n  } catch {\n    return null\n  }", "    return { manifest: main.manifest, layered: main.layered, base: root }\n  } catch (e) {\n    throw e\n  }"],
  [UI, 'the Face catalog\'s files are read from the wrong folder', "return { manifest: face.manifest, layered: face.layered, base: url.replace(/[^/]*$/, '') }", "return { manifest: face.manifest, layered: face.layered, base: root }"],
  [UI, 'the pack loses its layered section', "return { manifest: main.manifest, layered: main.layered, base: root }", "return { manifest: main.manifest, layered: null, base: root }"],
  [UI, 'the Face catalog loses its layered section', "return { manifest: face.manifest, layered: face.layered, base:", "return { manifest: face.manifest, layered: null, base:"],
  [UI, 'the portrait is the small one', "`/companions/${pack}/portrait-512.webp`", "`/companions/${pack}/portrait-256.webp`"],
  [PLAYER, 'a face that does not parse is drawn anyway', 'const painter: LayerPainter | null = face ? createLayeredPainter(pack, face) : null', 'const painter: LayerPainter | null = createLayeredPainter(pack, face ?? (pack.layered as never))'],
  [PLAYER, 'the seam never draws (the compatibility view for all)', 'const painter: LayerPainter | null = face ? createLayeredPainter(pack, face) : null', 'const painter: LayerPainter | null = null'],
  [LAYERED, 'the mouth ignores the scene', "const speaking = input.scene === 'speaking'", 'const speaking = true'],
  [LAYERED, 'the mouth ignores the level', 'level: input.level, audioTime', 'level: 0, audioTime'],
  [LAYERED, 'no expressions', 'expression: sceneExpression(input.scene), mouth', "expression: 'neutral', mouth"],
  [LAYERED, 'reduced motion is not passed on', 'audioTime: input.timeSec, reduced: input.reduced }', 'audioTime: input.timeSec }'],
  [LAYERED, 'pieces from the pack root', 'void load(`${pack.base}${src}`)', 'void load(`/companions/${src}`)'],
  [LAYERED, 'a patch is not drawn', 'ctx.drawImage(patch, r.x, r.y, r.w, r.h)', 'void patch'],
  [PLAYER, 'a painter is never called', 'painter?.({ context, canvas, pack: loaded,', 'void ({ context, canvas, pack: loaded,'],
  [PLAYER, 'a painter does not make the loop repaint', 'if (next.id !== shownId || !store.has(next.id) || painter) {', 'if (next.id !== shownId || !store.has(next.id)) {'],
  [PLAYER, 'the player does not keep the layered section', 'layered: catalog.layered', 'layered: null'],
  [PLAYER, 'the player does not use the lib\'s pack loader', 'const catalog = await loadCompanionPack(pack, framing, fetchJson, core.parseBirdMotionManifest)\n        if (!catalog) return null', 'const catalog = { manifest: core.parseBirdMotionManifest(await fetchJson(`/companions/${pack}/motion/manifest.json`)), layered: null, base: `/companions/${pack}/motion/` }\n        if (!catalog) return null'],
  [PLAYER, 'a pack with a catalog shows its portrait', 'const portrait = loaded === null && noPortrait !== pack', 'const portrait = noPortrait !== pack'],
  [PLAYER, 'a portrait that fails is remembered for every pack', 'const portrait = loaded === null && noPortrait !== pack', 'const portrait = loaded === null && noPortrait === null'],
  [PLAYER, 'a portrait that fails stays', 'onError={() => setNoPortrait(pack)}', 'onError={() => undefined}'],
  [PLAYER, 'the portrait is another file', 'src={portraitUrl(pack)}', 'src={`/companions/${pack}/icon-96.webp`}'],
  [PLAYER, 'the fallback is not named', "data-companion-art={loaded === null ? (portrait ? 'portrait' : 'initials') : undefined}", 'data-companion-art={undefined}'],
  [STAGE, 'two characters get a pager', '{choices.length > 2 ? <span className="studio-voice-pack-dots"', '{choices.length > 1 ? <span className="studio-voice-pack-dots"'],
  [STAGE, 'three characters have no pager', '{choices.length > 2 ? <span className="studio-voice-pack-dots"', '{choices.length > 3 ? <span className="studio-voice-pack-dots"'],
  [STAGE, 'the pager marks the wrong character', "data-on={choice === pack ? 'true' : 'false'}", "data-on={choice !== pack ? 'true' : 'false'}"],
  [STAGE, 'the pager has a dot missing', "{choices.map(choice => <i key={choice} data-choice={choice}", "{choices.slice(0, 2).map(choice => <i key={choice} data-choice={choice}"],
  [UI, 'the disc is as wide as its crop', "return rect && framing === 'chest' ? Math.round(size * rect.sw / rect.sh) : size", 'return rect ? Math.round(size * rect.sw / rect.sh) : size'],
  [PLAYER, 'the player sizes itself by hand', 'const width = framedWidth(framing, size, rect)', 'const width = size'],
  // the sources
  [WS, 'the frame tap is not gated by the flag', 'if (STUDIO_VOICE_CALL_UI_ENABLED && isVoiceCallFrameType(parsedMessage.type)', 'if (isVoiceCallFrameType(parsedMessage.type)'],
  [WS, 'the frame tap shows another session\'s frames', "isVoiceCallFrameType(parsedMessage.type) && parsedMessage.session_id === socketSessionId && isCurrentSocket()) voiceCallBus", "isVoiceCallFrameType(parsedMessage.type) && isCurrentSocket()) voiceCallBus"],
  [WS, 'the voice fields are not gated', "if (typeof STUDIO_VOICE_CALL_UI_ENABLED !== 'undefined' && STUDIO_VOICE_CALL_UI_ENABLED) addVoiceCallFields(", 'if (true) addVoiceCallFields('],
  [WS, 'the voice fields are gated by typeof alone', "typeof STUDIO_VOICE_CALL_UI_ENABLED !== 'undefined' && STUDIO_VOICE_CALL_UI_ENABLED) addVoiceCallFields(", "typeof STUDIO_VOICE_CALL_UI_ENABLED !== 'undefined') addVoiceCallFields("],
  [WS, 'the voice fields are written by hand', 'addVoiceCallFields(message.data as unknown as Record<string, unknown>, text); // VOICE-CALL', "(message.data as unknown as Record<string, unknown>).mode = 'voice'; // VOICE-CALL"],
  [WS, 'the sent tap is for every message', "(message.data as unknown as Record<string, unknown>).mode === 'voice')", 'true)'],
  [PAGE, 'the hook is called with the flag only', 'enabled: studioShell,', 'enabled: true,'],
  [PAGE, 'the dock is drawn without the hook', '{voiceCall.dock}{/* VOICE-CALL', '{null}{/* VOICE-CALL'],
  [PAGE, 'the voice turn goes by another send', 'sendTurn: text => handleSendMessage(undefined, text)', 'sendTurn: text => sendMessage(text)'],
  [INPUT, 'the buttons are drawn with the flag off', '{voiceCall ? <VoiceCallButtons', '{true ? <VoiceCallButtons'],
  [INPUT, 'the composer stays during a call', 'if (voiceCall?.active) return null // VOICE-CALL', 'if (false) return null // VOICE-CALL'],
  [INPUT, 'the call end gives no focus', 'textareaRef.current?.focus({ preventScroll: true }) // VOICE-CALL', 'textareaRef.current?.blur() // VOICE-CALL'],
  [INPUT, 'every render takes the focus', 'if (ended && callEndFocusGoesToComposer(document.activeElement))', 'if (callEndFocusGoesToComposer(document.activeElement))'],
  [INPUT, 'the call end takes the focus from anywhere', 'if (ended && callEndFocusGoesToComposer(document.activeElement))', 'if (ended)'],
  [INPUT, 'the focus is not remembered', 'voiceCallWasOn.current = voiceCall?.active === true // VOICE-CALL', 'voiceCallWasOn.current = false // VOICE-CALL'],
  [INPUT, 'the call start takes the focus', 'const ended = voiceCallWasOn.current && voiceCall?.active !== true;', 'const ended = voiceCallWasOn.current !== (voiceCall?.active === true);'],
  [UI, 'the page does not give the focus back', "if (tag === 'BODY' || tag === 'HTML') return true", "if (tag === 'BODY' || tag === 'HTML') return false"],
  [UI, 'the call\'s UI does not give the focus back', "return !!active.closest?.('[data-studio-voice-call]')", 'return false'],
  [UI, 'nothing in focus does not give it back', 'if (!active) return true\n  const tag = (active.tagName', 'if (!active) return false\n  const tag = (active.tagName'],
  [UI, 'any focus is taken', "return !!active.closest?.('[data-studio-voice-call]')", 'return true'],
  [INPUT, 'the composer hides before its hooks', '  if (voiceCall?.active) return null // VOICE-CALL (NEXT_PUBLIC_STUDIO_VOICE_CALL): while a call is on you are only talking; the composer (and its draft, which stays in the page) comes back when it ends', '  if (voiceCall?.active) return null // VOICE-CALL (NEXT_PUBLIC_STUDIO_VOICE_CALL): while a call is on you are only talking; the composer (and its draft, which stays in the page) comes back when it ends\n  useEffect(() => {}, [])'],
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
    ['another file is stripped too', "if (!VOICE_CALL_FILES.includes(rel)) return text", 'if (false) return text'],
    ['the composer is not stripped', "export const VOICE_CALL_FILES = ['app/builder/page.tsx', 'hooks/use-deckster-websocket-v2.ts', 'components/builder/chat-input.tsx']", "export const VOICE_CALL_FILES = ['app/builder/page.tsx', 'hooks/use-deckster-websocket-v2.ts']"],
  ]
  const run = text => {
    const out = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const module = { exports: {} }; new Function('module', 'exports', 'require', out)(module, module.exports, () => ({ VOICE_CALL_ART_FILES: strip.VOICE_CALL_ART_FILES })); return module.exports
  }
  for (const [name, from, to] of stripCases) {
    mutantCount++; stripMutants++
    ok(stripText.includes(from), `strip mutant "${name}" matches`)
    const mod = run(stripText.replace(from, () => to))
    const otherFile = mod.stripVoiceCall('lib/other.ts', 'x // VOICE-CALL\n') === 'x // VOICE-CALL\n'
    const token = mod.stripVoiceCall(PAGE, 'b // VOICE-CALL-X\n') === 'b // VOICE-CALL-X\n'
    const identity = strip.VOICE_CALL_FILES.every(rel => othersOut(baseSources.__reg, rel, mod.stripVoiceCall(rel, SOURCES[rel])) === othersOut(baseSources.__reg, rel, baseSources[rel]))
    const first = mod.stripVoiceCall(PAGE, 'a // VOICE-CALL\nb // VOICE-CALL\n') === '\n'
    const regText = read('scripts/studio-later-changes.mjs')
    const registryOut = mod.stripVoiceCall('scripts/studio-later-changes.mjs', regText).split('\n').length === regText.split('\n').length - 3
    if (otherFile && token && identity && first && registryOut) survivors.push(`strip: ${name}`)
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
