// FRONTEND-1: proof of the Agent mode wire, stacked on FRONTEND-2's #607 (the Agent build shell, new files only). Behind NEXT_PUBLIC_AGENT_MODE AND NEXT_PUBLIC_STUDIO_V4_SHELL, each only the exact string "true" (#607's own constant
// STUDIO_AGENT_MODE_ENABLED, reused; no new flag, so no .env.example block). The Studio now mounts the picker above the composer and the cards in the chat after the messages, routes Director's six agent frames to the run card, and sends the
// one card answer { type: 'agent_answer', data: { run_id, card, choice } } on the live socket; off, none of it exists.
//
//   node scripts/test-studio-agent-mode-wire.mjs        (plain node, offline: the REAL sources transpiled and run in a vm; the hook's and the Builder page's own marked lines are cut out of the real files and RUN, with fake sockets and spies;
//                                                        react-dom/server for markup; git is read for the strip, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to H), then mutants (I):
//  A. flags off, for EACH flag: with NEXT_PUBLIC_AGENT_MODE not exactly "true" (unset, "false", "True", "1", " true"), or NEXT_PUBLIC_STUDIO_V4_SHELL not exactly "true", every line this change adds is inert: the hook's route lets every agent frame fall
//     through to the allowlist as today and calls nothing, sendAgentAnswer sends nothing on an open socket, the page's build_mode is undefined (even with Agent picked on a Pro plan), its frame option is not passed, the mounts are null, the session effect
//     does nothing, and the answer rule refuses; and the strip (C) gives #607's head back byte for byte, so the base's output is what is left;
//  B. each of the six frames, as Director sends it ({ type, payload }, no session envelope), is routed to the page's run card and the real reader reads it (state moves as the fixture says); another socket's frame, another session's, and a type that is
//     not an agent frame are not; the route sits ahead of the allowlist and swallows what it takes;
//  C. THE ANSWER FRAME equals the contract: every card and choice of AGENT-1's fixture (tests/fixtures/agent_frames_contract.json:247 the "answer" block, :263-269 its example) goes out as exactly { type: 'agent_answer', data: { run_id, card, choice } },
//     once, on an open socket only; a closed, connecting, closing or missing socket, a throwing send, a bad answer sends nothing and is not retried, queued or replayed. Director's side (read-only, branch agent1/agent-frames of director-v4.0):
//     src/utils/agent_frames.py:28 ANSWER_TYPE = "agent_answer", :669 handle_answer reads data.get("data") for run_id / card / choice, src/handlers/websocket.py:2627 routes a message of that type to it;
//  D. NO PAID START WITHOUT THE PERSON'S CLICK: a frame, a render, a reconnect, the picker, a timer and the expiry of an estimate send nothing; the only way to a frame is the click on a card's own button, through answerAgentCard (the page's real cards
//     line is run); one frame per card, then the card is answered; the A1 estimate is information (the Agent send is the spend click): no Start, one Stop that sends A1 cancel, and the card does not read expires_at (the rule still refuses a late A1 start);
//     an answered card, another run's card and an A6 fallback that was not offered send nothing; a socket that is not live leaves the card open and says so
//     with the next step; Agent is disabled below Pro, a plan that is not loaded, and while a run is in progress; sendAgentAnswer has exactly one caller;
//  E. the page: every mount and option is gated, the plan comes from the signed-in session (never a frame), the four build sends carry build_mode, a session change clears the run and the mode and the first save of a new chat does not, a failure to send
//     (an answer or a Pause / Resume / Stop) is said in plain words with the next step, and the lib's own functions; once a run is done or failed, another run's frame (a refusal before admission has no estimate: daily_cap, has_content, run_exists,
//     tier) reads from a clean state and shows, a late frame of the finished run is still stale, and a live run still refuses another run's frame;
//  F. the sources: every line this change adds to the hook and the page carries the marker and is a pure insertion (no base line is rewritten or removed); #607's own four files and its proof, edited in place (the A1 estimate card is information), have EVERY
//     changed line marked and paired (a line of #607's is never rewritten unmarked); the strip puts #607's head back BYTE FOR BYTE (two app files, #607's files and proof, two older proofs); the registry (two lines, after #607's and at the true end of the
//     files and strips lists, none in the env list; ORDER checks, never adjacency, the older files read through the other changes' strips, so a keep-both restack of the changes queued ahead of this one still passes: F3), .env.example untouched;
//  G. scope, read from the COMMITTED diff only (never the working tree): own commits by subject, each with the co-author line; the files they touch are this change's scope; a stray untracked file changes nothing;
//  H. NO AGENT START FROM VOICE (PK ruling, 11 Nov): a voice accept (a spoken yes to the plan card) or any voice-originated send never carries build_mode "agent" and sends no agent frame; a click on the card or a typed send with the picker on Agent still does.
//     H1 the paths, read from the sources: the voice call's controller is the only sender for the voice (two callbacks, one arming of the bus, one mount, handed the page's two handlers), the Director call is read-only, the guard is at the top of both handlers
//     (before any await) and the four build sends read the ref it picks; H2 the real marked lines of the page and the hook, run with the real voice bus: "standard" for a plan that can hold Director's sticky Agent opt-in (Pro, Max), no key otherwise, a call that
//     ends while the send waits, a slip past the page (the hook's own line), Standard / Author, the click and the typed send as before; H3 each flag off: inert; H4 through the REAL VoiceCallController (fake microphone, speaker, clock and speech route):
//     a spoken yes and a spoken turn, then the click and the typed send beside them;
//  H5. STANDARD IS SAID OUT LOUD (PK ruling, 12 Nov: "both yes"): Director's Agent opt-in is sticky (saved with the session; a message without build_mode leaves it, only an explicit "standard" clears it) and Studio does not read it back, so after a reload the picker
//     is on Standard while the session may still hold an opt-in. On Pro and Max (Agent flags on) every build send with the picker on Standard (the four sends the page's two handlers make: a typed send, an outline accept, a card's button) carries build_mode "standard"
//     explicitly, and the hook puts it on the message as it is; Agent picked: "agent"; Author: as it was; a voice send: "standard" (H2); Free, Starter and a plan that is not loaded, and each flag off: no key, byte for byte as before;
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
import * as stripModule from './studio-agent-mode-wire-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const { STACK_BASE, BASE_COMMIT, AGENT_MODE_WIRE_SCOPE_FILES: SCOPE, AGENT_MODE_WIRE_NEW_FILES: NEW_FILES, AGENT_MODE_WIRE_APP_FILES: APP_FILES, AGENT_MODE_WIRE_PIN_FILES: PIN_FILES, AGENT_MODE_WIRE_SHELL_EDITED_FILES: SHELL_EDITED, AGENT_MODE_WIRE_ALL_EDITS: ALL_EDITS, AGENT_MODE_WIRE_MARKER_RE: MARKER_RE, AGENT_MODE_WIRE_SUBJECT: SUBJECT, AGENT_MODE_WIRE_PIN_MARK: PIN_MARK, stripAgentModeWire } = stripModule

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${STACK_BASE}:${rel}`)
const committed = rel => git('show', `HEAD:${rel}`)
const count = (text, needle) => text.split(needle).length - 1
/** The sources run in a vm, so their objects and arrays come from another realm: compare them through JSON. */
const deepEqual = (actual, expected, ...message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual ?? null)), JSON.parse(JSON.stringify(expected ?? null)), ...message)

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 700)} @ ${(String(error?.stack ?? '').match(/test-studio-agent-mode-wire\.mjs:\d+:\d+/) ?? ['?'])[0]}`) }
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

// ---- the real sources in a vm (as #607's proof does) ------------------------------------------------------------------------------------------
const LIB = 'lib/studio-agent-mode.ts', WIRE = 'lib/studio-agent-mode-wire.ts', HOOK = 'hooks/use-deckster-websocket-v2.ts', PAGE = 'app/builder/page.tsx', REGISTRY = 'scripts/studio-later-changes.mjs', STRIP = 'scripts/studio-agent-mode-wire-strip.mjs', PROOF = 'scripts/test-studio-agent-mode-wire.mjs'
const FIXTURE = 'tests/fixtures/agent_frames_contract.json', DIR = 'components/builder/agent-mode'
const CARDS = `${DIR}/agent-run-cards.tsx`, PICKER = `${DIR}/build-mode-picker.tsx`
const compileCache = new Map()
const compile = (file, text) => {
  const id = `${file}\0${text}`
  if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(id)
}
const localFile = (spec, from) => {
  const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('./') ? path.posix.join(path.posix.dirname(from), spec.slice(2)) : null
  if (base === null) return null
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (fs.existsSync(path.join(root, base + ext))) return base + ext
  throw new Error(`unexpected import ${spec} in ${from}`)
}
const textsKeys = new WeakMap(), modules = new Map()
const textsKey = texts => { if (!textsKeys.has(texts)) textsKeys.set(texts, crypto.createHash('sha1').update(JSON.stringify(texts)).digest('hex')); return textsKeys.get(texts) }
/** Load one real source in a new context. `texts` replaces the text of any file (a mutant); `react` replaces React; every other import is the REAL source or package, loaded with the same `env`. */
function load(rel, { env = {}, texts = {}, react = React } = {}) {
  const key = `${rel}\0${JSON.stringify(env)}\0${textsKey(texts)}\0${react === React ? 'react' : 'stub'}`
  if (modules.has(key)) return modules.get(key)
  const module = { exports: {} }
  modules.set(key, module.exports)
  const req = spec => {
    if (spec === 'react') return react
    if (spec === 'react/jsx-runtime') return jsxRuntime
    const local = localFile(spec, rel)
    return local ? load(local, { env, texts, react }) : nodeRequire(spec)
  }
  vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), { module, exports: module.exports, require: req, process: { env: { ...env } }, setTimeout, clearTimeout, AbortController, fetch: () => assert.fail(`${rel} fetched`) }, { filename: rel })
  return module.exports
}
const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const ENV_ON = { ...SHELL, NEXT_PUBLIC_AGENT_MODE: 'true' }
/** Every way for ONE flag to be off while the other is on, and both off: each must leave the wire inert. */
const ENV_OFF = {
  'both unset': {},
  'agent unset (shell on)': { ...SHELL },
  'agent "false"': { ...SHELL, NEXT_PUBLIC_AGENT_MODE: 'false' },
  'agent "True"': { ...SHELL, NEXT_PUBLIC_AGENT_MODE: 'True' },
  'agent "1"': { ...SHELL, NEXT_PUBLIC_AGENT_MODE: '1' },
  'agent " true"': { ...SHELL, NEXT_PUBLIC_AGENT_MODE: ' true' },
  'shell unset (agent on)': { NEXT_PUBLIC_AGENT_MODE: 'true' },
  'shell "false"': { NEXT_PUBLIC_AGENT_MODE: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'false' },
  'shell "TRUE"': { NEXT_PUBLIC_AGENT_MODE: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'TRUE' },
  'shell "1"': { NEXT_PUBLIC_AGENT_MODE: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: '1' },
  'author picker flag alone': { ...SHELL, NEXT_PUBLIC_AUTHOR_MODE_PICKER: 'true' },
}
const stubReact = { ...React, useId: () => 'pid', useState: init => [typeof init === 'function' ? init() : init, () => {}], useEffect: () => {} }
const h = React.createElement
const textOf = markup => markup.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
const walk = (node, visit) => {
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return }
  if (!React.isValidElement(node)) return
  visit(node)
  walk(typeof node.type === 'function' ? node.type(node.props) : node.props?.children, visit)
}
const elements = (root0, pred) => { const out = []; walk(root0, el => { if (pred(el)) out.push(el) }); return out }
const byProp = (root0, prop, value) => elements(root0, el => el.props?.[prop] === value)
/** A marked source's one line holding `needle` (exactly one). */
const lineWith = (text, needle) => { const hits = text.split('\n').filter(line => line.includes(needle)); assert.equal(hits.length, 1, `exactly one line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] }
/** The lines from the one holding `from` to the next one holding `to`, inclusive. */
const lineBlock = (text, from, to) => { const lines = text.split('\n'), a = lines.findIndex(l => l.includes(from)); assert.ok(a >= 0, `a line holds ${JSON.stringify(from)}`); const b = lines.findIndex((l, i) => i >= a && l.includes(to)); assert.ok(b >= a, `a line holds ${JSON.stringify(to)} after it`); return lines.slice(a, b + 1).join('\n') }
/** A source fragment (TS, with JSX) as the body of a function whose parameters are `names`: returns that function (its objects are from the vm's realm). */
function runFragment(code, names) {
  const source = `(function (${names.join(', ')}) {\n${code}\n})`
  const js = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } })
  const errors = (js.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `the marked lines parse: ${errors[0] ? `${ts.flattenDiagnosticMessageText(errors[0].messageText, ' ')} at ${JSON.stringify(source.slice(Math.max(0, (errors[0].start ?? 0) - 50), (errors[0].start ?? 0) + 50))}` : ''}`)
  return vm.runInNewContext(js.outputText, { React, setTimeout: () => assert.fail('a marked line scheduled a timer'), setInterval: () => assert.fail('a marked line scheduled an interval'), queueMicrotask: () => assert.fail('a marked line queued a task'), fetch: () => assert.fail('a marked line fetched'), localStorage: { setItem: () => assert.fail('a marked line stored something'), getItem: () => assert.fail('a marked line read storage') }, sessionStorage: { setItem: () => assert.fail('a marked line stored something'), getItem: () => assert.fail('a marked line read storage') } })
}
/** The expression of a marked JSX line: "{EXPR}{/* AGENT-MODE-WIRE ... *\/}" gives EXPR. */
const jsxExpression = line => { const m = /^\s*\{(.*)\}\{\/\* AGENT-MODE-WIRE/.exec(line); assert.ok(m, `a marked JSX line: ${line.slice(0, 80)}`); return m[1] }

// ---- AGENT-1's contract fixture (#607 copied it as it is) -------------------------------------------------------------------------------------
const FIXTURE_TEXT = read(FIXTURE)
const FIX = JSON.parse(FIXTURE_TEXT)
const EX = type => FIX.frames[type].example.payload
const RUN = EX('agent_estimate').run_id
/** Director's envelope exactly as the fixture has it: { type, payload }. No session id, no message id, no timestamp (src/utils/agent_frames.py `send` writes the frame as it is). */
const wireFrame = (type, over = {}) => ({ type, payload: { ...EX(type), ...over } })
const omit = (o, ...keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)))
const estimateNow = (over = {}) => ({ type: 'agent_estimate', payload: { ...omit(EX('agent_estimate'), 'expires_at'), ...over } }) // clickable: the fixture's own example has an expires_at that is long past
const FRAME_TYPES = ['agent_estimate', 'agent_step', 'agent_checkpoint', 'agent_research_offer', 'agent_failed', 'agent_done']
const answerOf = (card, choice, runId = RUN) => ({ runId, card, choice })
const CHOICES = FIX.answer.choices

// ---- the fragments of the hook and the page that this change adds, cut out of the REAL files and run -------------------------------------------
const ROUTE = text => lineWith(text, 'if (STUDIO_AGENT_MODE_ENABLED && isAgentFrameType(parsedMessage.type))')
const ALLOWLIST = 'if (!isKnownDirectorMessageType(parsedMessage.type)) {'
const ANSWER_FN = text => lineBlock(text, 'const sendAgentAnswer = useCallback(', '}, []); // AGENT-MODE-WIRE')
/** The hook's route, run on one frame. `current` is whether the frame came on the current socket. Returns what the route did: 'swallowed' (it returned) or 'fell through' (the allowlist is next), and the calls the page's callback got. */
function routeFrame(frame, { env = ENV_ON, text = read(HOOK), current = true, socketSessionId = 'sess-1', raw = frame, withCallback = true } = {}) {
  const lib = load(LIB, { env }), calls = []
  const result = runFragment(`${ROUTE(text)}\nreturn 'fell through'`, ['parsedMessage', 'rawMessage', 'socketSessionId', 'isCurrentSocket', 'transportCallbacksRef', 'STUDIO_AGENT_MODE_ENABLED', 'isAgentFrameType'])(
    frame, raw, socketSessionId, () => current, { current: withCallback ? { onAgentFrame: (f, owner) => calls.push({ frame: f, owner }) } : {} }, lib.STUDIO_AGENT_MODE_ENABLED, lib.isAgentFrameType)
  return { outcome: result === 'fell through' ? 'fell through' : 'swallowed', calls }
}
/** A fake socket: readyState and a send that records (or throws). */
const fakeSocket = (readyState = 1, { throws = false } = {}) => { const s = { readyState, sent: [], attempts: 0, send(data) { s.attempts++; if (throws) throw new Error('send failed'); s.sent.push(data) } }; return s }
/** The hook's sendAgentAnswer, cut out of the REAL file (useCallback is the identity here), over a ref that holds `socket`. */
function answerSender(socket, { env = ENV_ON, text = read(HOOK) } = {}) {
  const lib = load(LIB, { env })
  return runFragment(`const useCallback = fn => fn\n${ANSWER_FN(text)}\nreturn sendAgentAnswer`, ['wsRef', 'WebSocket', 'STUDIO_AGENT_MODE_ENABLED', 'agentAnswerFrame', 'agentAnswerSendable'])(
    { current: socket }, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }, lib.STUDIO_AGENT_MODE_ENABLED, lib.agentAnswerFrame, lib.agentAnswerSendable)
}
const pageLines = text => ({
  plan: lineWith(text, 'const agentPlan = agentPlanOf(user?.tier)'),
  wire: lineWith(text, 'const buildModeWire = STUDIO_AGENT_MODE_ENABLED ?'),
  option: lineWith(text, '...(STUDIO_AGENT_MODE_ENABLED ? { onAgentFrame:'),
  cards: lineWith(text, "{STUDIO_AGENT_MODE_ENABLED && agentRun.status !== 'idle' ? <div ref={agentCardsRef}"),
  picker: lineWith(text, '{STUDIO_AGENT_MODE_ENABLED ? <div className="mx-auto w-full max-w-[668px] px-3 pb-1"><BuildModePicker'),
  reset: lineBlock(text, 'useEffect(() => { // AGENT-MODE-WIRE: a run, its cards', '}, [currentSessionId]) // AGENT-MODE-WIRE'),
  scroll: lineWith(text, 'useEffect(() => { if (STUDIO_AGENT_MODE_ENABLED && agentCardsViewKey)'),
})
/** The page's `buildModeWire` line, run. */
function pageBuildMode({ env = ENV_ON, text = read(PAGE), buildMode = 'agent', plan = 'pro', previous = undefined } = {}) {
  const lib = load(LIB, { env })
  return runFragment(`${pageLines(text).wire}\nreturn buildModeWire`, ['STUDIO_AGENT_MODE_ENABLED', 'buildModeOnWire', 'buildMode', 'agentPlan', 'buildModeFrom'])(lib.STUDIO_AGENT_MODE_ENABLED, lib.buildModeOnWire, buildMode, plan, previous)
}
/** The page's frame option: what `{ ...(flag ? { onAgentFrame } : {}) }` yields. */
function pageFrameOption({ env = ENV_ON, text = read(PAGE) } = {}) {
  const lib = load(LIB, { env }), dispatched = []
  const options = runFragment(`return ({ ${pageLines(text).option}\n })`, ['STUDIO_AGENT_MODE_ENABLED', 'dispatchAgentRun', 'sendAgentAnswer'])(lib.STUDIO_AGENT_MODE_ENABLED, f => dispatched.push(f), () => assert.fail('the frame option sent an answer'))
  return { options, dispatched }
}
/** The page's session effect, run for a move from `previous` to `next`. */
function pageSessionEffect({ env = ENV_ON, text = read(PAGE), wireText = read(WIRE), previous, next }) {
  const lib = load(LIB, { env }), wire = load(WIRE, { env, texts: { [WIRE]: wireText } }), calls = [], ref = { current: previous }
  let effect = null
  runFragment(`${pageLines(text).reset}`, ['useEffect', 'STUDIO_AGENT_MODE_ENABLED', 'agentSessionChanged', 'agentSessionRef', 'currentSessionId', 'dispatchAgentRun', 'AGENT_WIRE_RESET', 'setBuildMode', 'setBuildModeFrom'])(
    fn => { effect = fn }, lib.STUDIO_AGENT_MODE_ENABLED, wire.agentSessionChanged, ref, next, a => calls.push(['dispatch', a]), wire.AGENT_WIRE_RESET, v => calls.push(['mode', v]), v => calls.push(['from', v]))
  effect()
  return { calls: JSON.parse(JSON.stringify(calls)), ref: ref.current }
}
/** The page's cards line evaluated for one state with spies: the element it makes (null when not mounted) and the spies. */
function pageCards({ env = ENV_ON, text = read(PAGE), wireText = read(WIRE), state, send = () => true, now } = {}) {
  const lib = load(LIB, { env }), wire = load(WIRE, { env, texts: { [WIRE]: wireText } }), cards = load(CARDS, { env, react: stubReact })
  const spies = { sent: [], dispatched: [], toasts: [], controls: [], marks: [] }
  const element = runFragment(`return (${jsxExpression(pageLines(text).cards)})`, ['React', 'STUDIO_AGENT_MODE_ENABLED', 'agentRun', 'agentCardsRef', 'AgentRunCards', 'answerAgentCard', 'sendAgentAnswer', 'dispatchAgentRun', 'toast', 'AGENT_WIRE_COPY', 'sendBuildControl', 'buildNarration', 'markNarrationControl', 'AGENT_WIRE_CONTROL_MARK'])(
    React, lib.STUDIO_AGENT_MODE_ENABLED, state, { current: null }, cards.AgentRunCards, now === undefined ? wire.answerAgentCard : (s, a, snd, mark, ns) => wire.answerAgentCard(s, a, snd, mark, ns, now), a => { spies.sent.push(a); return send(a) }, a => spies.dispatched.push(a), t => spies.toasts.push(t), wire.AGENT_WIRE_COPY,
    (action, buildId) => { spies.controls.push([action, buildId]); return spies.controlResult === undefined ? 'req-1' : spies.controlResult }, { buildId: 'b1' }, (kind, buildId, requestId) => spies.marks.push([kind, buildId, requestId]), wire.AGENT_WIRE_CONTROL_MARK)
  return { element, spies, lib, wire }
}
/** The `AgentRunCards` element inside the page's wrapper div, and the real cards' own buttons (their onClick). */
const cardsInside = element => elements(element, el => el.props && typeof el.props.onAnswer === 'function' && typeof el.props.onControl === 'function')[0]
const buttonOf = (element, choice) => { const found = byProp(element, 'data-agent-choice', choice); assert.equal(found.length, 1, `one ${choice} button`); return found[0] }
const controlOf = (element, control) => { const found = byProp(element, 'data-agent-control', control); assert.equal(found.length, 1, `one ${control} control`); return found[0] }
const runOf = (lib, frames, from) => frames.reduce((s, f) => lib.agentRunReducer(s, f), from ?? lib.initialAgentRunState())
const stateOf = (env = ENV_ON, frames = [estimateNow()]) => { const lib = load(LIB, { env }); return runOf(lib, frames) }

// ============================================================================================================================================
// A. flags off, for each flag
// ============================================================================================================================================
function flagsOffChecks(texts = {}) {
  const hook = texts[HOOK] ?? read(HOOK), page = texts[PAGE] ?? read(PAGE), wireText = texts[WIRE] ?? read(WIRE)
  const open = fakeSocket(1)
  for (const [name, env] of Object.entries(ENV_OFF)) {
    assert.equal(load(LIB, { env }).STUDIO_AGENT_MODE_ENABLED, false, `${name}: #607's constant is off`)
    // the hook: every agent frame falls through to the allowlist and the page hears nothing; the answer sends nothing on an OPEN socket
    for (const type of FRAME_TYPES) { const r = routeFrame(wireFrame(type), { env, text: hook }); assert.equal(r.outcome, 'fell through', `${name}: ${type} falls through`); assert.equal(r.calls.length, 0, `${name}: ${type}: the page hears nothing`) }
    for (const [card, choices] of Object.entries(CHOICES)) for (const choice of choices) assert.equal(answerSender(open, { env, text: hook })(answerOf(card, choice)), false, `${name}: ${card} ${choice}: nothing is sent`)
    assert.equal(open.sent.length, 0, `${name}: the open socket got nothing`); assert.equal(open.attempts, 0, `${name}: not even a send attempt`)
    // the page: no build_mode (Agent picked, Pro plan), no frame option, nothing mounted, no session effect, the answer rule refuses
    for (const mode of ['agent', 'author', 'standard']) for (const previous of [undefined, 'agent', 'author']) for (const plan of ['pro', 'premium', null]) assert.equal(pageBuildMode({ env, text: page, buildMode: mode, plan, previous }), undefined, `${name}: build_mode ${mode} / ${previous} / ${plan} is omitted`)
    const opt = pageFrameOption({ env, text: page }); deepEqual(opt.options, {}, `${name}: the frame option is not passed`)
    const busy = stateOf(ENV_ON)
    const mounted = pageCards({ env, text: page, wireText, state: busy }); assert.equal(mounted.element, null, `${name}: the cards are not mounted`)
    const effect = pageSessionEffect({ env, text: page, wireText, previous: 'A', next: 'B' }); deepEqual(effect.calls, [], `${name}: the session effect does nothing`)
    const wire = load(WIRE, { env, texts: { [WIRE]: wireText } }), sent = []
    assert.equal(wire.answerAgentCard(busy, answerOf('A1', 'start'), a => { sent.push(a); return true }, () => {}, () => {}), 'closed', `${name}: the answer rule refuses`); assert.equal(sent.length, 0)
    // the picker: neither mounted (no flag) nor a build mode is held
    assert.equal(pagePicker({ env, text: page, plan: 'pro' }), null, `${name}: the picker is not mounted`)
  }
  // flag on (both exact "true"): the same lines DO act (the positive control: the checks above are not vacuous)
  assert.equal(routeFrame(wireFrame('agent_estimate'), { text: hook }).outcome, 'swallowed', 'on: the route takes the frame')
  assert.equal(answerSender(fakeSocket(1), { text: hook })(answerOf('A3', 'continue')), true, 'on: the answer goes out')
  assert.equal(pageBuildMode({ text: page }), 'agent', 'on: build_mode agent on a Pro plan')
  assert.equal(typeof pageFrameOption({ text: page }).options.onAgentFrame, 'function', 'on: the frame option is passed')
  assert.notEqual(pageCards({ text: page, wireText, state: stateOf() }).element, null, 'on: the cards are mounted')
  deepEqual(pageSessionEffect({ text: page, wireText, previous: 'A', next: 'B' }).calls, [['dispatch', 'agent_wire_reset'], ['mode', 'standard'], ['from', undefined]], 'on: the session effect resets')
  // no line of this change reads the flags itself: the one constant, #607's, is the only gate
  for (const [rel, text] of [[HOOK, hook], [PAGE, page]]) for (const line of text.split('\n').filter(l => MARKER_RE.test(l))) assert.doesNotMatch(line, /process\.env/, `${rel}: a marked line reads process.env itself: ${line.slice(0, 90)}`)
  assert.doesNotMatch(wireText, /process\.env/, 'the wire lib reads no flag itself')
}
/** The page's picker line evaluated: the element it makes (null when not mounted). */
function pagePicker({ env = ENV_ON, text = read(PAGE), wireText = read(WIRE), plan = 'pro', state, buildMode = 'standard' } = {}) {
  const lib = load(LIB, { env }), wire = load(WIRE, { env, texts: { [WIRE]: wireText } }), picker = load(PICKER, { env, react: stubReact }), spies = { mode: [], from: [] }
  const element = runFragment(`return (${jsxExpression(pageLines(text).picker)})`, ['React', 'STUDIO_AGENT_MODE_ENABLED', 'BuildModePicker', 'buildMode', 'agentPlan', 'agentRunBusy', 'agentRun', 'setBuildMode', 'setBuildModeFrom'])(
    React, lib.STUDIO_AGENT_MODE_ENABLED, picker.BuildModePicker, buildMode, plan, wire.agentRunBusy, state ?? lib.initialAgentRunState(), v => spies.mode.push(v), v => spies.from.push(v))
  return element === null ? null : { element, spies }
}

// ============================================================================================================================================
// B. each frame is routed to the reader
// ============================================================================================================================================
function routingChecks(texts = {}) {
  const hook = texts[HOOK] ?? read(HOOK), page = texts[PAGE] ?? read(PAGE), wireText = texts[WIRE] ?? read(WIRE)
  const lib = load(LIB, { env: ENV_ON }), wire = load(WIRE, { env: ENV_ON, texts: { [WIRE]: wireText } })
  const frames = { agent_estimate: estimateNow(), agent_step: wireFrame('agent_step'), agent_checkpoint: wireFrame('agent_checkpoint'), agent_research_offer: wireFrame('agent_research_offer'), agent_failed: wireFrame('agent_failed'), agent_done: wireFrame('agent_done') }
  deepEqual(Object.keys(frames), FRAME_TYPES); deepEqual(lib.AGENT_FRAME_TYPES, FRAME_TYPES, "the six types are #607's, in the fixture's order")
  const opt = pageFrameOption({ text: page })
  // each of the six, as Director sends it: routed to the page's callback once, untouched, swallowed; the real reader reads it and the page's reducer moves
  for (const [type, frame] of Object.entries(frames)) {
    assert.ok(lib.readAgentFrame(frame) !== null, `${type}: #607's reader reads the fixture's example`)
    const r = routeFrame(frame, { text: hook })
    assert.equal(r.outcome, 'swallowed', `${type}: the route takes it (it never reaches the allowlist, the reducer, the transcript or the cache)`); assert.equal(r.calls.length, 1, `${type}: the page's callback is called once`)
    assert.strictEqual(r.calls[0].frame, frame, `${type}: the frame goes to the reader as it came`); assert.equal(r.calls[0].owner.sessionId, 'sess-1'); assert.equal(typeof r.calls[0].owner.isCurrent, 'function')
    // the page's option hands it to the reducer, only while the owner is current
    opt.dispatched.length = 0; opt.options.onAgentFrame(frame, { isCurrent: () => true }); assert.equal(opt.dispatched.length, 1, `${type}: dispatched`); assert.strictEqual(opt.dispatched[0], frame)
    opt.options.onAgentFrame(frame, { isCurrent: () => false }); assert.equal(opt.dispatched.length, 1, `${type}: a frame of a socket that is no longer current is not dispatched`)
    const moved = wire.agentWireReducer(lib.initialAgentRunState(), frame); assert.notEqual(moved.status, 'idle', `${type}: the run card's state moves`)
  }
  // the whole run through the wire's own reducer, as the page holds it
  const run = fr => fr.reduce((s, f) => wire.agentWireReducer(s, f), lib.initialAgentRunState())
  let s = run([frames.agent_estimate]); assert.equal(s.status, 'estimate'); assert.equal(s.estimate.credits, 470); assert.equal(s.capCredits, 600)
  s = run([frames.agent_estimate, frames.agent_step]); assert.equal(s.status, 'running'); assert.equal(s.steps.length, 1)
  s = run([frames.agent_estimate, frames.agent_step, frames.agent_checkpoint]); assert.equal(s.pending.kind, 'checkpoint'); assert.equal(s.pending.answered, null)
  s = run([frames.agent_estimate, frames.agent_step, frames.agent_research_offer]); assert.equal(s.pending.kind, 'research_offer')
  s = run([frames.agent_estimate, frames.agent_step, frames.agent_failed]); assert.equal(s.status, 'failed'); assert.equal(s.failure.reason, lib.agentReasonWords(EX('agent_failed').reason))
  s = run([frames.agent_estimate, frames.agent_step, frames.agent_done]); assert.equal(s.status, 'done'); assert.equal(s.doneSlides, EX('agent_done').slides)
  // negatives: the owner (this exact socket), the session if one is sent, the type
  assert.equal(routeFrame(frames.agent_step, { text: hook, current: false }).outcome, 'swallowed', 'a frame of a socket that is not current is swallowed (as today it would be dropped) ...')
  assert.equal(routeFrame(frames.agent_step, { text: hook, current: false }).calls.length, 0, '... and the page hears nothing')
  assert.equal(routeFrame(frames.agent_step, { text: hook, raw: { ...frames.agent_step, session_id: 'sess-other' } }).calls.length, 0, 'a frame that names another session is not routed')
  assert.equal(routeFrame(frames.agent_step, { text: hook, raw: { ...frames.agent_step, session_id: 'sess-1' } }).calls.length, 1, 'one that names this socket\'s session is')
  assert.equal(routeFrame(frames.agent_step, { text: hook, raw: frames.agent_step }).calls.length, 1, 'one that names none (Director\'s frames carry no session envelope) is: the owner is this exact socket')
  assert.equal(routeFrame(frames.agent_step, { text: hook, withCallback: false }).outcome, 'swallowed', 'no callback registered (another page): taken, nothing thrown')
  for (const type of ['chat_message', 'action_request', 'build_phase', 'agent_answer', 'agent_unknown', 'agent_', 'AGENT_STEP', undefined, 7]) { const r = routeFrame({ type, payload: {} }, { text: hook }); assert.equal(r.outcome, 'fell through', `${String(type)}: not an agent frame: on to the allowlist as before`); assert.equal(r.calls.length, 0) }
  // the route sits ahead of the allowlist, once, and the hook adds the type to no list
  assert.ok(hook.indexOf(ROUTE(hook)) > 0 && hook.indexOf(ROUTE(hook)) < hook.indexOf(ALLOWLIST), 'the route is ahead of the allowlist check'); assert.equal(count(hook, ALLOWLIST), 1)
  assert.equal(/KNOWN_DIRECTOR_MESSAGE_TYPES[^\n]*agent_|'agent_(estimate|step|checkpoint|research_offer|failed|done)'/.test(hook), false, 'the six types are not added to the allowlist or the message union (the route takes them before it)')
  assert.equal(count(hook, 'onAgentFrame?.('), 1, 'the callback is called from one place')
  // the page passes the option, gated, to the one hook call
  assert.equal(count(page, 'onAgentFrame:'), 1)
}

// ============================================================================================================================================
// C. the answer frame equals the contract
// ============================================================================================================================================
const FIXTURE_LINES = FIXTURE_TEXT.split('\n')
/** Where the contract is, in the committed fixture: the "answer" block and its example (cited by file:line in the report and above). */
const CITED = { answerBlock: 247, exampleType: 265 }
function answerChecks(texts = {}) {
  const hook = texts[HOOK] ?? read(HOOK)
  // the contract, from the fixture itself, at the lines cited
  assert.match(FIXTURE_LINES[CITED.answerBlock - 1], /^  "answer": \{/, `${FIXTURE}:${CITED.answerBlock} is the answer block`); assert.match(FIXTURE_LINES[CITED.answerBlock + 1], /"type": "agent_answer"/, `${FIXTURE}:${CITED.answerBlock + 2} is its type`)
  assert.match(FIXTURE_LINES[CITED.exampleType - 1], /"type": "agent_answer"/, `${FIXTURE}:${CITED.exampleType} is the example's type`); assert.equal(FIX.answer.type, 'agent_answer'); assert.equal(FIX.answer.direction, 'studio_to_director')
  deepEqual(Object.keys(FIX.answer.fields), ['run_id', 'card', 'choice']); deepEqual(Object.keys(FIX.answer.example), ['type', 'data']); deepEqual(Object.keys(FIX.answer.example.data), ['run_id', 'card', 'choice'])
  deepEqual(CHOICES, { A1: ['start', 'cancel'], A3: ['continue', 'stop'], A4: ['add', 'skip'], A6: ['fallback', 'stop'] })
  // the example, byte for byte: A3 continue on the example's run id
  const ex = FIX.answer.example, socket = fakeSocket(1)
  assert.equal(answerSender(socket, { text: hook })(answerOf(ex.data.card, ex.data.choice, ex.data.run_id)), true, 'the example\'s answer is sent')
  assert.equal(socket.sent.length, 1); assert.equal(socket.sent[0], JSON.stringify(ex), `the frame is the fixture's example (${FIXTURE}:${CITED.exampleType - 2}-${CITED.exampleType + 4}), byte for byte`)
  // every card and choice: exactly one frame, exactly { type, data: { run_id, card, choice } }
  for (const [card, choices] of Object.entries(CHOICES)) for (const choice of choices) {
    const s = fakeSocket(1), send = answerSender(s, { text: hook })
    assert.equal(send(answerOf(card, choice)), true, `${card} ${choice}: sent`); assert.equal(s.sent.length, 1, `${card} ${choice}: one frame`); assert.equal(s.attempts, 1)
    const frame = JSON.parse(s.sent[0]); deepEqual(Object.keys(frame), ['type', 'data'], 'the envelope has type and data and nothing else'); assert.equal(frame.type, 'agent_answer'); deepEqual(Object.keys(frame.data), ['run_id', 'card', 'choice'], 'data has the three fields and nothing else')
    deepEqual(frame, { type: 'agent_answer', data: { run_id: RUN, card, choice } }, `${card} ${choice}`)
  }
  // what is not sent: a socket that is not open (nothing queued, nothing retried), a send that throws, a bad answer
  for (const [name, state] of [['connecting', 0], ['closing', 2], ['closed', 3]]) { const s = fakeSocket(state); assert.equal(answerSender(s, { text: hook })(answerOf('A3', 'stop')), false, `${name}: false`); assert.equal(s.attempts, 0, `${name}: no send attempt`) }
  assert.equal(answerSender(null, { text: hook })(answerOf('A3', 'stop')), false, 'no socket: false')
  const throwing = fakeSocket(1, { throws: true }); let thrown = false, result; try { result = answerSender(throwing, { text: hook })(answerOf('A3', 'stop')) } catch { thrown = true }; assert.equal(thrown, false, 'a throwing send does not throw out of the sender'); assert.equal(result, false, 'a throwing send: false'); assert.equal(throwing.attempts, 1, 'tried once, not retried')
  for (const bad of [answerOf('A2', 'continue'), answerOf('A3', 'start'), answerOf('A3', 'finish'), answerOf('A4', 'continue'), answerOf('A6', 'add'), answerOf('A1', 'stop'), answerOf('A3', 'continue', ''), { runId: 7, card: 'A3', choice: 'continue' }, { card: 'A3', choice: 'continue' }]) { const s = fakeSocket(1); assert.equal(answerSender(s, { text: hook })(bad), false, `a bad answer is not sent: ${JSON.stringify(bad)}`); assert.equal(s.attempts, 0) }
  // never replayed: the function holds no state; a closed socket then an open one sends only the second call's frame
  const ref = { current: fakeSocket(3) }; const lib = load(LIB, { env: ENV_ON })
  const send = runFragment(`const useCallback = fn => fn\n${ANSWER_FN(hook)}\nreturn sendAgentAnswer`, ['wsRef', 'WebSocket', 'STUDIO_AGENT_MODE_ENABLED', 'agentAnswerFrame', 'agentAnswerSendable'])(ref, { OPEN: 1 }, lib.STUDIO_AGENT_MODE_ENABLED, lib.agentAnswerFrame, lib.agentAnswerSendable)
  assert.equal(send(answerOf('A3', 'continue')), false); const reconnected = fakeSocket(1); ref.current = reconnected; assert.equal(reconnected.sent.length, 0, 'after a reconnect nothing is replayed'); assert.equal(send(answerOf('A3', 'stop')), true); assert.equal(reconnected.sent.length, 1); assert.equal(JSON.parse(reconnected.sent[0]).data.choice, 'stop')
  const body = ANSWER_FN(hook)
  assert.doesNotMatch(body, /setTimeout|setInterval|queue|localStorage|sessionStorage|\.push\(|retry|await |Promise|requestAnimationFrame/i, 'the sender holds no queue, timer, storage or retry')
  assert.match(body, /socket\.readyState === WebSocket\.OPEN/, 'it asks the live socket'); assert.equal(count(body, 'socket.send('), 1, 'one send')
  // the envelope is built in ONE place, #607's agentAnswerFrame; the literal type is nowhere else
  assert.equal(count(hook, 'agentAnswerFrame('), 1, 'the hook builds the frame with #607\'s agentAnswerFrame, once'); assert.equal(/agent_answer/.test(hook.split('\n').map(l => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/ .*$/, '')).join('\n')), false, 'the hook has no hand-built agent_answer in its code (the type is #607\'s, in agentAnswerFrame)')
}

// ============================================================================================================================================
// D. no paid start without the person's click
// ============================================================================================================================================
function noAutoStartChecks(texts = {}) {
  const hook = texts[HOOK] ?? read(HOOK), page = texts[PAGE] ?? read(PAGE), wireText = texts[WIRE] ?? read(WIRE)
  const lib = load(LIB, { env: ENV_ON }), wire = load(WIRE, { env: ENV_ON, texts: { [WIRE]: wireText } })
  // 1. the callers: sendAgentAnswer is handed to answerAgentCard in one place; agentAnswerFrame is built in one; nothing else in the app names the answer type
  assert.equal(count(hook, 'sendAgentAnswer'), 2, 'the hook names it twice: the definition and the return, nothing that calls it'); assert.equal(/sendAgentAnswer\(/.test(hook.replace(/const sendAgentAnswer = useCallback\(/, '')), false, 'the hook never calls sendAgentAnswer')
  const pageCalls = page.split('\n').filter(l => /\bsendAgentAnswer\b/.test(l)); assert.equal(pageCalls.length, 2, 'the page names it twice: the hook\'s return, and the one cards line'); assert.ok(pageCalls.some(l => /^\s*sendAgentAnswer, \/\/ AGENT-MODE-WIRE$/.test(l)), 'the destructure'); assert.ok(pageCalls.some(l => l.includes('answerAgentCard(agentRun, answer, sendAgentAnswer, dispatchAgentRun')), 'the one use: answerAgentCard, from the cards\' onAnswer')
  assert.equal(count(page, 'answerAgentCard('), 1); assert.equal(/agentAnswerFrame|agent_answer/.test(page.replace(/\/\/ AGENT-MODE-WIRE[^\n]*/g, '')), false, 'the page builds no frame')
  // 2. frames never send: all six, in every order, through the route, the page's option and the reducer: no send
  const sendSpy = []; const s0 = fakeSocket(1)
  let state = lib.initialAgentRunState(); const opt = pageFrameOption({ text: page })
  for (const type of [...FRAME_TYPES, ...FRAME_TYPES]) { const frame = type === 'agent_estimate' ? estimateNow() : wireFrame(type); const r = routeFrame(frame, { text: hook }); r.calls.forEach(c => { opt.options.onAgentFrame(c.frame, c.owner); state = wire.agentWireReducer(state, c.frame) }) }
  assert.equal(s0.attempts, 0); assert.equal(sendSpy.length, 0); assert.equal(opt.dispatched.length, FRAME_TYPES.length * 2, 'every frame was only dispatched to the reducer')
  // 3. rendering the cards sends nothing; only the person's click does, and each click sends once
  const open = stateOf(ENV_ON, [estimateNow()]); const mounted = pageCards({ text: page, wireText, state: open })
  assert.notEqual(mounted.element, null); const markup = renderToStaticMarkup(mounted.element); assert.match(textOf(markup), /Estimated cost: About 470 credits · cap 600 credits · Running/, 'the estimate card is drawn, as information')
  deepEqual(mounted.spies.sent, [], 'drawing the estimate sends nothing'); deepEqual(mounted.spies.dispatched, [])
  const inside = cardsInside(mounted.element); assert.ok(inside, 'the cards element carries onAnswer and onControl')
  assert.equal(byProp(inside, 'data-agent-choice', 'start').length, 0, 'no Start on the estimate card (PK ruling: the Agent send is the spend click; the estimate is information)')
  buttonOf(inside, 'cancel').props.onClick()
  deepEqual(mounted.spies.sent, [answerOf('A1', 'cancel')], 'Stop: exactly one answer, A1 cancel'); assert.equal(mounted.spies.dispatched.length, 1, 'and the run is marked once'); deepEqual(mounted.spies.toasts, [])
  assert.equal(wire.agentWireReducer(open, mounted.spies.dispatched[0]).status, 'idle', 'Stop (A1 cancel) clears the run')
  // an answered card: a click that lands anyway (a second click before the card re-draws) sends nothing
  const answeredState = { ...open, estimate: { ...open.estimate, answered: 'cancel' } }
  const second = pageCards({ text: page, wireText, state: answeredState }); buttonOf(cardsInside(second.element), 'cancel').props.onClick(); deepEqual(second.spies.sent, [], 'an answered card: a second click sends nothing')
  // 4. the estimate's expires_at is not read by the card (it has no Start to expire): the fixture's own example has long expired and its Stop still goes (a cancel is never expiry-gated)
  const expired = stateOf(ENV_ON, [wireFrame('agent_estimate')]); const exp = pageCards({ text: page, wireText, state: expired }); assert.equal(byProp(cardsInside(exp.element), 'data-agent-choice', 'start').length, 0, 'no Start, expired or not'); buttonOf(cardsInside(exp.element), 'cancel').props.onClick(); deepEqual(exp.spies.sent, [answerOf('A1', 'cancel')], 'an expired estimate: Stop still goes'); deepEqual(exp.spies.toasts, [], '... and says nothing is wrong with the connection')
  // 4b. the rule itself (the lib's, unchanged: nothing in the card sends a start any more): before expires_at an A1 start goes, from the instant on it does not, Cancel always does
  const expiresAt = Date.parse(EX('agent_estimate').expires_at), sent4 = []
  assert.equal(wire.answerAgentCard(expired, answerOf('A1', 'start'), a => { sent4.push(a); return true }, () => {}, () => {}, expiresAt - 1), 'sent', 'one instant before the expiry: Start goes'); assert.equal(wire.answerAgentCard(expired, answerOf('A1', 'start'), a => { sent4.push(a); return true }, () => {}, () => {}, expiresAt), 'closed', 'at the expiry: not'); assert.equal(wire.answerAgentCard(expired, answerOf('A1', 'start'), a => { sent4.push(a); return true }, () => {}, () => {}), 'closed', 'now (long past it): not'); assert.equal(wire.answerAgentCard(expired, answerOf('A1', 'cancel'), a => { sent4.push(a); return true }, () => {}, () => {}), 'sent', 'Cancel always goes'); deepEqual(sent4, [answerOf('A1', 'start'), answerOf('A1', 'cancel')])
  // 5. A3, A4, A6: one frame per click, with its own choice; a card that is not open, another run's, and an A6 fallback that was not offered send nothing
  const withCard = frame => runOf(lib, [estimateNow(), wireFrame('agent_step'), frame])
  for (const [type, card, choices] of [['agent_checkpoint', 'A3', ['continue', 'stop']], ['agent_research_offer', 'A4', ['add', 'skip']]]) for (const choice of choices) {
    const view = pageCards({ text: page, wireText, state: withCard(wireFrame(type)) }); const el = cardsInside(view.element)
    deepEqual(view.spies.sent, [], `${card}: nothing sent by drawing`); const uiChoice = choice === 'skip' ? 'skip' : choice; buttonOf(el, uiChoice).props.onClick(); deepEqual(view.spies.sent, [answerOf(card, choice)], `${card} ${choice}: one answer`)
  }
  const failedOffered = runOf(lib, [estimateNow(), wireFrame('agent_failed', { fallback_credits: 80 })]), failedPlain = runOf(lib, [estimateNow(), { type: 'agent_failed', payload: omit(EX('agent_failed'), 'fallback_credits') }])
  const offered = pageCards({ text: page, wireText, state: failedOffered }); assert.match(textOf(renderToStaticMarkup(offered.element)), /Build the rest with the standard build, about 80 credits\?/); deepEqual(offered.spies.sent, [], 'a priced fallback is only OFFERED: drawing sends nothing'); buttonOf(cardsInside(offered.element), 'fallback').props.onClick(); deepEqual(offered.spies.sent, [answerOf('A6', 'fallback')], 'and goes only on the click')
  const plain = pageCards({ text: page, wireText, state: failedPlain }); assert.equal(byProp(plain.element, 'data-agent-choice', 'fallback').length, 0, 'none offered: no fallback button'); assert.equal(wire.answerAgentCard(failedPlain, answerOf('A6', 'fallback'), a => { plain.spies.sent.push(a); return true }, () => {}, () => {}), 'closed', 'a fallback that was not offered is refused'); deepEqual(plain.spies.sent, [])
  assert.equal(wire.answerAgentCard(open, answerOf('A1', 'start', 'agr_other'), () => assert.fail('another run\'s answer was sent'), () => {}, () => {}), 'closed', 'another run\'s answer'); assert.equal(wire.answerAgentCard(lib.initialAgentRunState(), answerOf('A3', 'continue'), () => assert.fail('sent with no card open'), () => {}, () => {}), 'closed', 'no card open')
  // 6. a socket that is not live: the card stays open, nothing was sent, and the person is told with the next step
  const down = pageCards({ text: page, wireText, state: open, send: () => false }); buttonOf(cardsInside(down.element), 'cancel').props.onClick()
  assert.equal(down.spies.sent.length, 1, 'the send was asked once'); deepEqual(down.spies.dispatched, [], 'a failed send does NOT mark the card answered (it stays open for another click)'); assert.equal(down.spies.toasts.length, 1); deepEqual(down.spies.toasts[0], wire.AGENT_WIRE_COPY.answerNotSent)
  assert.match(down.spies.toasts[0].title, /send/); assert.match(down.spies.toasts[0].description, /nothing was sent/); assert.match(down.spies.toasts[0].description, /Try again/, 'plain words, and the next step')
  // 7. the build controls go through the existing build control and say so when Director does not take them
  const live = pageCards({ text: page, wireText, state: runOf(lib, [estimateNow(), wireFrame('agent_step')]) }); const ctl = cardsInside(live.element)
  for (const action of ['pause', 'stop']) { live.spies.controls.length = 0; live.spies.marks.length = 0; controlOf(ctl, action).props.onClick(); deepEqual(live.spies.controls, [[action, 'b1']], `${action}: the build control, with the build id`); deepEqual(live.spies.marks, [[`${action}_requested`, 'b1', 'req-1']], `${action}: marked as the ribbon marks it`); deepEqual(live.spies.sent, [], `${action}: no card answer`) }
  const refused = pageCards({ text: page, wireText, state: runOf(lib, [estimateNow(), wireFrame('agent_step')]) }); refused.spies.controlResult = null; controlOf(cardsInside(refused.element), 'stop').props.onClick(); deepEqual(refused.spies.marks, [], 'not taken: not marked'); deepEqual(refused.spies.toasts, [wire.AGENT_WIRE_COPY.controlNotSent('stop')]); assert.match(wire.AGENT_WIRE_COPY.controlNotSent('stop').title, /Couldn't stop the build/); assert.match(wire.AGENT_WIRE_COPY.controlNotSent('stop').description, /Try again/)
  // 8. the picker sends nothing; a build_mode goes only for a plan that may have it; Agent is off below Pro, with no plan, and while a run is in progress
  const picked = pagePicker({ text: page, wireText, plan: 'pro' }); assert.notEqual(picked, null)
  const btns = elements(picked.element, el => el.props?.['data-build-mode']); deepEqual(btns.map(b => b.props['data-build-mode']), ['standard', 'agent'], 'Standard and Agent (the Author option only with its own flag)')
  btns.find(b => b.props['data-build-mode'] === 'agent').props.onClick(); deepEqual(picked.spies.mode, ['agent']); deepEqual(picked.spies.from, ['agent'], 'a pick holds the mode and that it was picked; no socket call exists in the picker')
  btns.find(b => b.props['data-build-mode'] === 'standard').props.onClick(); deepEqual(picked.spies.mode, ['agent', 'standard']); deepEqual(picked.spies.from, ['agent'], 'going back to Standard does not clear "was picked": it goes as an explicit reset')
  for (const plan of ['free', 'starter', null, 'enterprise']) { const p = pagePicker({ text: page, wireText, plan }); const agent = elements(p.element, el => el.props?.['data-build-mode'] === 'agent')[0]; assert.equal(agent.props.disabled, true, `plan ${plan}: Agent is disabled`); assert.equal(pageBuildMode({ text: page, plan }), undefined, `plan ${plan}: no build_mode agent on the wire even if picked`) }
  for (const plan of ['pro', 'premium']) { assert.equal(elements(pagePicker({ text: page, wireText, plan }).element, el => el.props?.['data-build-mode'] === 'agent')[0].props.disabled, false, `plan ${plan}: Agent can be picked`); assert.equal(pageBuildMode({ text: page, plan }), 'agent') }
  assert.equal(pageBuildMode({ text: page, buildMode: 'standard', plan: 'pro' }), undefined, 'Standard, never picked another: omitted (the legacy frame)'); assert.equal(pageBuildMode({ text: page, buildMode: 'standard', plan: 'pro', previous: 'agent' }), 'standard', 'back to Standard after Agent: an explicit reset')
  assert.equal(pageBuildMode({ text: page, buildMode: 'author', plan: 'pro' }), undefined, 'Author needs its own flag, which this wire does not turn on')
  for (const status of ['estimate', 'running', 'paused', 'stopped']) assert.equal(wire.agentRunBusy({ ...lib.initialAgentRunState(), status }), true, `${status}: a run is in progress`)
  for (const status of ['idle', 'done', 'failed']) assert.equal(wire.agentRunBusy({ ...lib.initialAgentRunState(), status }), false, `${status}: no run in progress`)
  const busyPicker = pagePicker({ text: page, wireText, plan: 'pro', state: runOf(lib, [estimateNow(), wireFrame('agent_step')]) }); assert.ok(elements(busyPicker.element, el => el.props?.['data-build-mode']).every(b => b.props.disabled === true), 'while a run is in progress the picker is off')
  // 9. the build mode rides the four build sends and nothing else: each `...buildSendOptions,` is followed by the marked line (which reads the ref its handler's entry line picked: the picker's, or for a voice send the voice's: H), and the memo that holds them is untouched
  const lines = page.split('\n'), at = lines.map((l, i) => (/^\s*\.\.\.buildSendOptions,$/.test(l) ? i : -1)).filter(i => i >= 0); assert.equal(at.length, 4, 'four build sends')
  for (const i of at) assert.equal(lines[i + 1].trim(), ATTACH_LINE, `the send at line ${i + 1} carries the build mode`)
  assert.equal(count(page, 'agentBuildModeRef.current = STUDIO_AGENT_MODE_ENABLED ? typedBuildMode(buildModeWire, agentPlan) : undefined'), 1, 'the ref is written once per render, from the one buildModeWire, through the plan (H5)')
}

// ============================================================================================================================================
// E. the page and the lib
// ============================================================================================================================================
function pageChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), wireText = texts[WIRE] ?? read(WIRE), hook = texts[HOOK] ?? read(HOOK)
  const lib = load(LIB, { env: ENV_ON }), wire = load(WIRE, { env: ENV_ON, texts: { [WIRE]: wireText } })
  const L = pageLines(page)
  // the plan: the signed-in session's, mapped by #607's own agentPlanOf; never read from a frame
  assert.match(L.plan, /agentPlanOf\(user\?\.tier\)/); assert.equal(count(page, 'agentPlanOf('), 1, 'one plan read'); assert.equal(/agentPlanOf\([^)]*(frame|payload|message)/.test(page), false)
  assert.equal(lib.agentPlanOf('pro'), 'pro'); assert.equal(lib.agentPlanOf('enterprise'), null); assert.equal(lib.agentPlanOf(undefined), null)
  // every mount is gated and null when off; the cards only when a run exists; the picker is off while a run is in progress
  assert.match(L.cards, /^\s*\{STUDIO_AGENT_MODE_ENABLED && agentRun\.status !== 'idle' \? .* : null\}/); assert.match(L.picker, /^\s*\{STUDIO_AGENT_MODE_ENABLED \? .* : null\}/)
  assert.match(L.picker, /disabled=\{agentRunBusy\(agentRun\)\}/); assert.match(L.picker, /plan=\{agentPlan\}/); assert.match(L.cards, /state=\{agentRun\}/)
  assert.ok(L.cards.includes('<AgentRunCards ') && L.picker.includes('<BuildModePicker '), 'the real components are the ones mounted')
  // where they sit: the cards in the chat's scroll area, after the messages; the picker right above the composer
  const lines = page.split('\n'), idx = needle => lines.findIndex(l => l.includes(needle))
  assert.ok(idx('<MessageList') < idx("{STUDIO_AGENT_MODE_ENABLED && agentRun.status !== 'idle'") && idx("{STUDIO_AGENT_MODE_ENABLED && agentRun.status !== 'idle'") < idx('</ScrollArea>'), 'the cards are in the scroll area, after the message list')
  assert.equal(lines[idx('{STUDIO_AGENT_MODE_ENABLED ? <div className="mx-auto w-full max-w-[668px] px-3 pb-1"><BuildModePicker') + 1].trim(), '<ChatInput', 'the picker is the element right above the composer')
  // the session effect: a move clears the run, the cards and the mode; the first save of a new chat does not; a no-op when off
  const move = (previous, next) => pageSessionEffect({ text: page, wireText, previous, next })
  deepEqual(move('A', 'B').calls, [['dispatch', 'agent_wire_reset'], ['mode', 'standard'], ['from', undefined]], 'A to B: cleared'); assert.equal(move('A', 'B').ref, 'B')
  deepEqual(move('A', null).calls, [['dispatch', 'agent_wire_reset'], ['mode', 'standard'], ['from', undefined]], 'A to a new chat: cleared'); assert.equal(move('A', null).ref, 'A', 'the ref keeps the last session shown')
  deepEqual(move(null, 'A').calls, [], 'a new chat saved by its first message (none to A): NOT a move'); assert.equal(move(null, 'A').ref, 'A')
  deepEqual(move('A', 'A').calls, [], 'the same session: nothing')
  // the scroll effect brings a new card into view, only with the flag, only when the key says something
  assert.match(L.scroll, /agentCardsRef\.current\?\.scrollIntoView\?\.\(\{ block: 'nearest'/)
  // the lib: the reducer's reset, the key, the busy states, the words
  const idle = lib.initialAgentRunState(), running = runOf(lib, [estimateNow(), wireFrame('agent_step')])
  assert.strictEqual(wire.agentWireReducer(idle, wire.AGENT_WIRE_RESET), idle, 'reset on an idle state: the same object (no re-render)'); deepEqual(wire.agentWireReducer(running, wire.AGENT_WIRE_RESET), idle, 'reset clears a run'); assert.equal(wire.agentWireReducer(running, 'agent_wire_reset').status, 'idle')
  for (const junk of [undefined, null, 'x', 7, {}, { type: 'agent_unknown', payload: {} }, { type: 'agent_step', payload: {} }]) assert.strictEqual(wire.agentWireReducer(running, junk), running, `a frame the reducer does not take gives the same state: ${JSON.stringify(junk)}`)
  deepEqual(wire.agentWireReducer(idle, estimateNow()), lib.agentRunReducer(idle, estimateNow()), 'a frame goes to #607\'s reducer as it is')
  // THE NEXT RUN AFTER A FINISHED ONE (review of #621, MAJOR 2): once a run is done or failed, a frame for ANOTHER run is the next run's: its refusal before admission (the fixture: "A refusal before admission carries a fresh run_id") has no estimate and must show
  const NEXT = 'agr_ba9876543210', refusal = (reason, over = {}) => ({ type: 'agent_failed', payload: { run_id: NEXT, reason, charged_credits: 0, credited_back_credits: 0, ...over } })
  const done = runOf(lib, [estimateNow(), wireFrame('agent_step'), wireFrame('agent_done')]), failedRun = runOf(lib, [estimateNow(), wireFrame('agent_step'), wireFrame('agent_failed')])
  assert.equal(done.status, 'done'); assert.equal(failedRun.status, 'failed')
  for (const [label, finished] of [['done', done], ['failed', failedRun]]) {
    for (const reason of ['daily_cap', 'has_content', 'run_exists', 'tier']) {
      const shown = wire.agentWireReducer(finished, refusal(reason)); assert.equal(shown.status, 'failed', `${label}, then a fresh-id ${reason} refusal: it shows`); assert.equal(shown.runId, NEXT, `${label}, then ${reason}: the card is the new run's`)
      assert.equal(shown.failure.reason, lib.agentReasonWords(reason), `${label}, then ${reason}: the reason in plain words`); assert.equal(shown.failure.answered, null); deepEqual(shown.steps, [], `${label}, then ${reason}: nothing of the finished run is left on the card`); assert.equal(shown.doneSlides, null)
      assert.notEqual(wire.agentCardsKey(shown), wire.agentCardsKey(finished), `${label}, then ${reason}: the chat is told (the key changes)`); assert.equal(wire.agentRunBusy(shown), false, `${label}, then ${reason}: the picker is free`)
    }
    assert.equal(wire.agentWireReducer(finished, refusal('daily_cap')).failure.reason, "You have reached today's credit limit for Agent build.", 'the daily limit is said in plain words')
    // the next run's estimate gives what #607's reducer gives (it already opened a new run after done or failed), and a frame of the finished run itself is still stale
    deepEqual(wire.agentWireReducer(finished, estimateNow({ run_id: NEXT })), lib.agentRunReducer(finished, estimateNow({ run_id: NEXT })), `${label}, then the next run's estimate: as #607's reducer has it`)
    for (const stale of [wireFrame('agent_step'), wireFrame('agent_checkpoint'), wireFrame('agent_failed'), wireFrame('agent_done')]) assert.strictEqual(wire.agentWireReducer(finished, stale), finished, `${label}, then a late ${stale.type} of the finished run: still stale, the same state`)
    // a local answer is not a frame of another run
    assert.strictEqual(wire.agentWireReducer(finished, lib.agentAnswered({ runId: NEXT, card: 'A6', choice: 'stop' })), finished, `${label}: an answer for another run changes nothing`); assert.strictEqual(wire.agentWireReducer(finished, { type: 'agent_unknown', payload: { run_id: NEXT } }), finished, `${label}: a frame the reader does not take is the same state`)
    assert.equal(wire.agentWireReducer(wire.agentWireReducer(finished, refusal('daily_cap')), wire.AGENT_WIRE_RESET).status, 'idle', `${label}: a session change still clears it`)
  }
  // a run that is NOT over still refuses another run's frame (one run at a time; the card is not swapped under a live run)
  for (const [label, live] of [['an estimate waiting', runOf(lib, [estimateNow()])], ['running', running], ['paused', runOf(lib, [estimateNow(), wireFrame('agent_step', { run_status: 'paused' })])], ['stopped', runOf(lib, [estimateNow(), wireFrame('agent_step', { run_status: 'stopped' })])]]) {
    assert.strictEqual(wire.agentWireReducer(live, refusal('daily_cap')), live, `${label}: another run's refusal is refused, the same state`); assert.strictEqual(wire.agentWireReducer(live, wireFrame('agent_done', { run_id: NEXT })), live, `${label}: another run's done is refused`)
  }
  assert.equal(wire.agentWireReducer(idle, refusal('daily_cap')).status, 'failed', 'from idle a refusal shows (as before)')
  assert.equal(wire.agentCardsKey(idle), ''); const k1 = wire.agentCardsKey(runOf(lib, [estimateNow()])), k2 = wire.agentCardsKey(running), k3 = wire.agentCardsKey(runOf(lib, [estimateNow(), wireFrame('agent_step'), wireFrame('agent_checkpoint')]))
  assert.ok(k1 && k2 && k3 && new Set([k1, k2, k3]).size === 3, 'the key changes when a card appears or goes')
  assert.equal(wire.agentCardsKey(runOf(lib, [estimateNow(), wireFrame('agent_step')])), wire.agentCardsKey(runOf(lib, [estimateNow(), wireFrame('agent_step'), wireFrame('agent_step', { step: 2, label: 'Building slide 2', credits_used: 500 })])), 'a run\'s progress (another step, more credits used) does not pull the chat')
  assert.equal(wire.agentSessionChanged(null, 'A'), false); assert.equal(wire.agentSessionChanged('A', 'A'), false); assert.equal(wire.agentSessionChanged('A', 'B'), true); assert.equal(wire.agentSessionChanged('A', null), true); assert.equal(wire.agentSessionChanged(null, null), false)
  // the words: plain, with the next step, no leak words, no currency
  const words = [wire.AGENT_WIRE_COPY.answerNotSent, wire.AGENT_WIRE_COPY.controlNotSent('pause'), wire.AGENT_WIRE_COPY.controlNotSent('resume'), wire.AGENT_WIRE_COPY.controlNotSent('stop')].flatMap(w => [w.title, w.description])
  for (const w of words) { assert.equal(lib.plainWords(w, 'LEAK'), w, `plain: ${w}`); assert.doesNotMatch(w, /\$|credit|charge|price|cost/i, `no money talk in a transport failure: ${w}`) }
  deepEqual(wire.AGENT_WIRE_CONTROL_MARK, { pause: 'pause_requested', resume: 'resume_requested', stop: 'stop_requested' })
  // the wire lib is pure: its only import is #607's lib, no top-level effect, no network
  assert.equal(count(wireText, "from '@/lib/studio-agent-mode'"), 1); assert.equal(count(wireText, "from '@/lib/studio-voice-call-ui'"), 1); assert.equal(/^import /m.test(wireText.replace(/^import \{[^}]*\} from '@\/lib\/studio-agent-mode'\n/m, '').replace(/^import \{ voiceCallBus \} from '@\/lib\/studio-voice-call-ui'\n/m, '')), false, 'two imports: #607\'s lib and the voice call\'s bus (voiceCallBus, only read: H2);'); assert.doesNotMatch(wireText, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.|window\./, 'no network, storage or DOM in the wire lib')
  // the hook: build_mode is the optional key of a user message and of the send options, and only that; the option type is optional
  assert.match(hook, /build_mode\?: 'standard' \| 'author' \| 'agent'; \/\/ AGENT-MODE-WIRE/); assert.match(hook, /\n  buildMode\?: 'standard' \| 'author' \| 'agent'; \/\/ AGENT-MODE-WIRE/); assert.equal(count(hook, '...(options?.buildMode && { build_mode: options.buildMode }), // AGENT-MODE-WIRE'), 1)
  assert.match(hook, /onAgentFrame\?: \(frame: unknown, owner: \{ sessionId: string \| null; isCurrent: \(\) => boolean \}\) => void; \/\/ AGENT-MODE-WIRE/)
}

// ============================================================================================================================================
// H. NO AGENT START FROM VOICE (PK ruling, 11 Nov): a voice accept / a voice-originated send never carries build_mode "agent"; a click or a typed send with the picker on Agent still does
// ============================================================================================================================================
// Every voice path, found by reading the voice code (H1 holds the inventory to the files): the call (lib/studio-voice-call-controller.ts) is the ONLY thing that sends for the voice, and it sends through the page's own two handlers, handleSendMessage (words:
// sendTurn) and handleActionClick (a card's button, "yes" to the plan: sendAction), after arming the words on the bus (armVoiceTurn); the socket hook marks the one user message with those words mode "voice" (addVoiceCallFields). The Director call
// (hooks/use-studio-director-call.ts, components/builder/voice-interactive/*) is read-only: it points at a card and never answers it, and speech input there is reported unavailable. This change's guard is two lines deep: the page asks at the top of each handler
// (voiceOriginatedSend) and reads the voice build mode (voiceBuildMode: "standard" for a plan that can hold an Agent opt-in, because Director's opt-in is sticky; else no key); the hook turns "agent" on a message marked mode "voice" into "standard".
const ENV_VOICE = { ...ENV_ON, NEXT_PUBLIC_STUDIO_VOICE_CALL: 'true' }
const VOICE_UI = 'lib/studio-voice-call-ui.ts', VOICE_CTL = 'lib/studio-voice-call-controller.ts'
const ATTACH_LINE = '...(agentModeRef.current ? { buildMode: agentModeRef.current } : {}), // AGENT-MODE-WIRE'
const voiceLines = (page, hook) => ({
  wire: lineWith(page, 'const buildModeWire = STUDIO_AGENT_MODE_ENABLED ?'),
  buildRef: lineWith(page, 'agentBuildModeRef.current = '),
  ref: lineWith(page, 'agentVoiceModeRef.current = STUDIO_AGENT_MODE_ENABLED'),
  entrySend: lineWith(page, 'voiceOriginatedSend(messageText)'),
  entryAction: lineWith(page, 'voiceOriginatedSend(action.label)'),
  spread: lineWith(hook, '...(options?.buildMode && { build_mode: options.buildMode }), // AGENT-MODE-WIRE'),
  voiceFields: lineWith(hook, 'addVoiceCallFields(message.data as unknown as Record<string, unknown>, text); // VOICE-CALL'),
  guard: lineWith(hook, "message.data.build_mode === 'agent') message.data.build_mode = 'standard'"),
})
/** The real sources under one env and one set of mutated texts: the page's and the hook's marked lines, and the lib, the wire lib and the voice lib (all three loaded together, so they share ONE voice bus). */
function voiceRig({ env = ENV_VOICE, texts = {} } = {}) {
  const page = texts[PAGE] ?? read(PAGE), hook = texts[HOOK] ?? read(HOOK)
  const rig = { env, texts, page, hook, L: voiceLines(page, hook), lib: load(LIB, { env, texts }), wire: load(WIRE, { env, texts }), ui: load(VOICE_UI, { env, texts }) }
  rig.ui.disarmVoiceTurn()
  return rig
}
/** The page's per-render lines, run for one picker state: the build mode the picker puts on the wire and the two refs the handlers read. */
function renderRefs(rig, { buildMode = 'agent', plan = 'pro', previous = buildMode === 'standard' ? undefined : buildMode } = {}) {
  const refs = { agentBuildModeRef: { current: 'unset' }, agentVoiceModeRef: { current: 'unset' } }
  runFragment(`${rig.L.wire}\n${rig.L.buildRef}\n${rig.L.ref}`, ['STUDIO_AGENT_MODE_ENABLED', 'buildModeOnWire', 'typedBuildMode', 'voiceBuildMode', 'buildMode', 'agentPlan', 'buildModeFrom', 'agentBuildModeRef', 'agentVoiceModeRef'])(
    rig.lib.STUDIO_AGENT_MODE_ENABLED, rig.lib.buildModeOnWire, rig.wire.typedBuildMode, rig.wire.voiceBuildMode, buildMode, plan, previous, refs.agentBuildModeRef, refs.agentVoiceModeRef)
  return refs
}
/**
 * One page handler's send, as far as the build mode goes: the handler's own entry line (asked at its very top) and its own build-mode line, run. `kind`: 'send' (handleSendMessage, `words` are its text) or 'action' (handleActionClick, `words` are the button's label).
 * `bus`: null = nothing armed (a click or a typed send), a string = the call armed those words just before, LEAVE_BUS = leave the bus as it is (the real controller armed it). Returns the options the handler hands the socket hook.
 */
const LEAVE_BUS = Symbol('the bus as the call left it')
function pageSend(rig, refs, kind, words, { bus = null } = {}) {
  if (bus !== LEAVE_BUS) { rig.ui.disarmVoiceTurn(); if (bus !== null) rig.ui.armVoiceTurn(bus) }
  const run = runFragment(`${kind === 'send' ? rig.L.entrySend : rig.L.entryAction}\nreturn ({ ${ATTACH_LINE}\n})`, ['STUDIO_AGENT_MODE_ENABLED', 'voiceOriginatedSend', 'agentVoiceModeRef', 'agentBuildModeRef', 'messageText', 'action'])
  return JSON.parse(JSON.stringify(run(rig.lib.STUDIO_AGENT_MODE_ENABLED, rig.wire.voiceOriginatedSend, refs.agentVoiceModeRef, refs.agentBuildModeRef, words, { label: words })))
}
/** The socket hook's user message for `options`: its real build_mode line, its real voice-fields line (the armed turn is taken here, as in the hook) and this change's real voice line. */
function hookMessage(rig, options, text, extra = {}) {
  const data = runFragment(`return ({ text, ...extra, ${rig.L.spread}\n})`, ['options', 'text', 'extra'])(options, text, extra)
  runFragment(`const message = { data }\n${rig.L.voiceFields}\n${rig.L.guard}`, ['data', 'STUDIO_VOICE_CALL_UI_ENABLED', 'addVoiceCallFields', 'text', 'STUDIO_AGENT_MODE_ENABLED'])(data, rig.ui.STUDIO_VOICE_CALL_UI_ENABLED, rig.ui.addVoiceCallFields, text, rig.lib.STUDIO_AGENT_MODE_ENABLED)
  return JSON.parse(JSON.stringify(data))
}
/** What the page and the hook put on the wire for one send: the handler's options and the user message. */
const sendOnWire = (rig, refs, kind, words, bus) => { const options = pageSend(rig, refs, kind, words, { bus }); return { options, data: hookMessage(rig, options, words, kind === 'action' ? { action_value: 'accept_plan', action_label: words } : {}) } }
const noAgent = (data, why) => { assert.notEqual(data.build_mode, 'agent', `${why}: no build_mode "agent"`); assert.equal(/"agent"/.test(JSON.stringify(data)), false, `${why}: nothing on the message says "agent"`) }

const sourceCache = new Map(), readOnce = rel => { if (!sourceCache.has(rel)) sourceCache.set(rel, read(rel)); return sourceCache.get(rel) }
/** Every source file under `dirs`, as repo-relative paths (.ts / .tsx / .mjs). */
const sourceFiles = dirs => dirs.flatMap(dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? (entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : sourceFiles([`${dir}/${entry.name}`])) : /\.(tsx?|mjs)$/.test(entry.name) ? [`${dir}/${entry.name}`] : []))
const VOICE_CALL_FILES = ['hooks/use-studio-voice-call.ts', 'lib/studio-voice-call-browser.ts', 'lib/studio-voice-call-controller.ts', 'lib/studio-voice-call-router.ts', 'lib/studio-voice-call-ui.ts', 'components/builder/voice-call/companion-player.tsx', 'components/builder/voice-call/voice-call-buttons.tsx', 'components/builder/voice-call/voice-call-stage.tsx']
const DIRECTOR_CALL_FILES = ['hooks/use-studio-director-call.ts', 'components/builder/voice-interactive/director-call.tsx', 'components/builder/voice-interactive/use-director-call.ts', 'lib/studio-voice-interactive.ts', 'lib/studio-voice-owner.ts', 'lib/studio-voice-transcript-provenance.ts', 'lib/studio-director-message-policy.ts']

/** H1: the voice paths, read from the sources: where a voice send can come from, and that the guard sits on each. */
function voiceInventoryChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), hook = texts[HOOK] ?? read(HOOK), src = rel => texts[rel] ?? readOnce(rel)
  // the call's own files: the one thing that sends for the voice is the controller, through two callbacks, and armVoiceTurn is called there only; no voice file names a build mode, an agent answer or an agent frame
  const everySource = sourceFiles(['app', 'components', 'hooks', 'lib'])
  const writers = everySource.filter(rel => { const t = src(rel).split('\n').filter(l => !/export function armVoiceTurn/.test(l)).join('\n'); return /\barmVoiceTurn\(/.test(t) || (rel !== VOICE_UI && /\bvoiceCallBus\.pending\s*=[^=]/.test(t)) })
  deepEqual(writers, [VOICE_CTL], 'the voice bus is armed by the call\'s controller and by nothing else')
  assert.equal(count(src(VOICE_CTL), 'this.sendTurn(') + count(src(VOICE_CTL), 'this.sendAction('), 2, 'the controller sends in two places: words (sendTurn) and a card\'s button (sendAction)')
  assert.equal(count(src(VOICE_CTL), 'armVoiceTurn(words)'), 1, 'it arms the words once, before either')
  const callers = everySource.filter(rel => /\buseStudioVoiceCall\(/.test(src(rel)) && rel !== 'hooks/use-studio-voice-call.ts'); deepEqual(callers, [PAGE], 'the call hook is mounted by the Builder page only')
  const mount = lineWith(page, 'const voiceCall = useStudioVoiceCall({'); assert.ok(mount.startsWith('  const voiceCall = useStudioVoiceCall({ enabled: studioShell, sendTurn: text => handleSendMessage(undefined, text), sendAction: handleActionClick, sessionKey: currentSessionId || wsSessionId, connected })'), 'the call is handed the page\'s two handlers, handleSendMessage and handleActionClick, and nothing else that sends')
  for (const rel of VOICE_CALL_FILES) assert.doesNotMatch(src(rel), /\b(build_?[Mm]ode|agent_answer|sendAgentAnswer|agentAnswerFrame|onAgentFrame)\b/, `${rel}: the call never names a build mode or an agent frame`)
  assert.equal(count(src('hooks/use-studio-voice-call.ts'), 'sendTurn: text => live.current.sendTurn(text)'), 1)
  // the Director call (voice-interactive): read-only; it sends nothing, answers nothing and presses nothing
  for (const rel of DIRECTOR_CALL_FILES) assert.doesNotMatch(src(rel), /\b(sendMessage\w*|sendTurn|sendAction|handleSendMessage|handleActionClick|sendControlMessage|sendBuildControl|requestSubmit|dispatchEvent)\b|\.click\(/, `${rel}: the Director call sends and presses nothing`)
  const interactive = load('lib/studio-voice-interactive.ts', { env: ENV_VOICE, texts }); assert.equal(interactive.speechInputStatus(undefined).available, false, 'speech input is reported unavailable (no approved speech service)'); assert.equal(interactive.speechInputStatus({ SpeechRecognition: {} }).available, false, '... even where the browser has recognition')
  // where a voice send turns into a build send: the page's two handlers carry the guard's entry line, once each, before any await, and the four sends read the ref it picks
  const lines = page.split('\n'), at = needle => { const i = lines.findIndex(l => l.includes(needle)); assert.ok(i >= 0, `a line holds ${needle}`); return i }
  const sendDecl = at('const handleSendMessage = useCallback(async ('), actionDecl = at('const handleActionClick = useCallback(async (')
  const entrySend = lines.findIndex(l => l.includes('voiceOriginatedSend(messageText)')), entryAction = lines.findIndex(l => l.includes('voiceOriginatedSend(action.label)'))
  assert.equal(count(page, 'voiceOriginatedSend('), 2, 'two entry lines'); assert.ok(sendDecl < entrySend && entrySend < actionDecl && actionDecl < entryAction, 'one in each handler, in their order')
  assert.equal(lines.slice(sendDecl, entrySend).some(l => /\bawait\b/.test(l)), false, 'handleSendMessage: asked before any await (a call that ends while the send waits still leaves it a voice send)'); assert.equal(lines.slice(actionDecl, entryAction).some(l => /\bawait\b/.test(l)), false, 'handleActionClick: the same')
  const attach = lines.map((l, i) => (/^\s*\.\.\.buildSendOptions,$/.test(l) ? i : -1)).filter(i => i >= 0); assert.equal(attach.length, 4)
  for (const i of attach) assert.equal(lines[i + 1].trim(), ATTACH_LINE, `the send at line ${i + 1} reads the ref the entry line picks`)
  assert.ok(attach.slice(0, 3).every(i => i > entrySend && i < actionDecl) && attach[3] > entryAction, 'three sends in handleSendMessage after its entry line, one in handleActionClick after its own')
  assert.equal(lines.filter(l => /agentBuildModeRef\.current/.test(l)).length, 1, 'the picker\'s ref is read by one line only: the render-time assignment'); assert.equal(lines.filter(l => /agentVoiceModeRef\.current/.test(l)).length, 1, 'the voice ref is written by one line only'); assert.equal(count(page, 'buildMode: agentModeRef.current'), 4)
  // the hook: one guard line, inside buildUserMessage, after the line that marks the voice turn and before the message is returned
  const hl = hook.split('\n'), g = hl.findIndex(l => l.includes("message.data.build_mode === 'agent') message.data.build_mode = 'standard'")), f = hl.findIndex(l => l.includes('addVoiceCallFields(message.data as unknown as Record<string, unknown>, text); // VOICE-CALL')), r = hl.findIndex((l, i) => i > f && l.trim() === 'return message;')
  assert.ok(f > 0 && g === f + 1 && g < r, 'the hook\'s guard line is right after the line that marks the voice turn, before the message is returned'); assert.equal(count(hook, "build_mode = 'standard'"), 1); assert.equal(count(hook, 'build_mode: options.buildMode'), 1, 'the one place the hook puts a build_mode on a message')
}

/** H2: what goes on the wire, for the picker on Agent and the other states, with the real lines run. */
function voiceChecks(texts = {}) {
  const rig = voiceRig({ texts }), SAY = "Yes, let's build it!", WORDS = 'yes please, go ahead and build it'
  const PAIRS = [['send', WORDS], ['action', SAY]]
  // 1. the picker is on Agent, on a plan that has it
  for (const plan of ['pro', 'premium']) {
    const refs = renderRefs(rig, { buildMode: 'agent', plan })
    assert.equal(refs.agentBuildModeRef.current, 'agent', `${plan}: the picker's mode is Agent`); assert.equal(refs.agentVoiceModeRef.current, 'standard', `${plan}: the voice mode is "standard", never the picker's`)
    for (const [kind, words] of PAIRS) {
      // (b) an explicit click (the card's button) or a typed send, nothing armed: still Agent, and not a voice turn
      const click = sendOnWire(rig, refs, kind, words, null)
      assert.equal(click.options.buildMode, 'agent', `${plan} ${kind}: a click / typed send hands the hook "agent"`); assert.equal(click.data.build_mode, 'agent', `${plan} ${kind}: ... and it is on the wire`); assert.equal(click.data.mode, undefined, `${plan} ${kind}: ... as a typed turn`)
      // (a) the same words, armed by the call: a voice turn that carries "standard", never "agent", and still says it is voice
      const voice = sendOnWire(rig, refs, kind, words, words)
      assert.equal(voice.options.buildMode, 'standard', `${plan} ${kind}: the voice send hands the hook "standard"`); assert.equal(voice.data.build_mode, 'standard', `${plan} ${kind}: ... and that is on the wire`); assert.equal(voice.data.mode, 'voice'); assert.ok(voice.data.client_caps.includes('voice1')); assert.equal(voice.data.text, words); noAgent(voice.data, `${plan} ${kind} voice`)
      if (kind === 'action') { assert.equal(voice.data.action_value, 'accept_plan', 'the spoken yes is still the card\'s own button: its value goes'); assert.equal(voice.data.action_label, words) }
      // the call armed other words (a turn of its own): THIS send is a typed one and keeps the picker's mode
      assert.equal(sendOnWire(rig, refs, kind, words, 'a different sentence').data.build_mode, 'agent', `${plan} ${kind}: the guard is for the call's own words, not for every send while a call is on`)
      // the call ends or cancels the turn while the handler waits (a new session, a reconnect, an interruption): the handler asked at its top, so what it sends is still the voice send's: not Agent
      const options = pageSend(rig, refs, kind, words, { bus: words }); rig.ui.disarmVoiceTurn(); const late = hookMessage(rig, options, words)
      assert.equal(options.buildMode, 'standard', `${plan} ${kind}: asked before the wait`); assert.equal(late.build_mode, 'standard', `${plan} ${kind}: the call ended before the message was built: still not Agent`); assert.equal(late.mode, undefined, `${plan} ${kind}: (it is no longer marked voice: the page's line is what held)`)
      // the hook's own last line, for a send that got past the page (a handler with no entry line): marked voice, "agent" becomes "standard"; not marked voice, it stays
      rig.ui.disarmVoiceTurn(); rig.ui.armVoiceTurn(words); const slipped = hookMessage(rig, { buildMode: 'agent' }, words)
      assert.equal(slipped.mode, 'voice'); assert.equal(slipped.build_mode, 'standard', `${plan} ${kind}: the hook turns a voice turn's "agent" into "standard"`); noAgent(slipped, `${plan} ${kind} slipped`)
      rig.ui.disarmVoiceTurn(); assert.equal(hookMessage(rig, { buildMode: 'agent' }, words).build_mode, 'agent', `${plan} ${kind}: a typed message's "agent" is left alone`)
      for (const other of ['standard', 'author']) { rig.ui.armVoiceTurn(words); assert.equal(hookMessage(rig, { buildMode: other }, words).build_mode, other, `${plan}: a voice turn's "${other}" is left alone (only "agent" is turned)`) }
      // the voice turn is taken once: the next message with the same words is typed again
      rig.ui.armVoiceTurn(words); hookMessage(rig, {}, words); assert.equal(hookMessage(rig, { buildMode: 'agent' }, words).build_mode, 'agent', 'the armed turn is spent by its own message')
    }
  }
  // 2. a plan that cannot have Agent (the picker cannot hold it, Studio never sends it): the voice send has no key at all, and neither does a typed one
  for (const plan of ['free', 'starter', null, 'enterprise']) {
    const refs = renderRefs(rig, { buildMode: 'agent', plan }); assert.equal(refs.agentBuildModeRef.current, undefined, `plan ${plan}: no Agent on the wire`); assert.equal(refs.agentVoiceModeRef.current, undefined, `plan ${plan}: ... nor for voice`)
    for (const [kind, words] of PAIRS) for (const bus of [null, words]) { const w = sendOnWire(rig, refs, kind, words, bus); assert.equal('build_mode' in w.data, false, `plan ${plan} ${kind}: no build_mode key`); noAgent(w.data, `plan ${plan} ${kind}`) }
  }
  // 3. the picker is on Standard on a plan that has Agent: a typed send and a voice send both say "standard" (Director's opt-in is sticky and saved: a session reloaded with Standard picked can still hold one; the typed send used to leave the key out: H5)
  for (const previous of [undefined, 'agent']) {
    const refs = renderRefs(rig, { buildMode: 'standard', plan: 'pro', previous })
    for (const [kind, words] of PAIRS) {
      const typed = sendOnWire(rig, refs, kind, words, null); assert.equal(typed.data.build_mode, 'standard', `Standard (was ${previous}) ${kind}: a typed send says "standard" too`)
      const voice = sendOnWire(rig, refs, kind, words, words); assert.equal(voice.data.build_mode, 'standard', `Standard (was ${previous}) ${kind}: a voice send says "standard"`); assert.equal(voice.data.mode, 'voice'); noAgent(voice.data, `Standard ${kind}`)
    }
  }
  // 4. Author (its own flag; the ruling is about Agent): unchanged, by voice or by typing, and never "agent"
  const author = voiceRig({ env: { ...ENV_VOICE, NEXT_PUBLIC_AUTHOR_MODE_PICKER: 'true' }, texts }), arefs = renderRefs(author, { buildMode: 'author', plan: 'pro' })
  assert.equal(arefs.agentBuildModeRef.current, 'author'); assert.equal(arefs.agentVoiceModeRef.current, 'author', 'Author is not ruled on: the voice send keeps it')
  for (const [kind, words] of PAIRS) for (const bus of [null, words]) assert.equal(sendOnWire(author, arefs, kind, words, bus).data.build_mode, 'author', `Author ${kind}: ${bus === null ? 'typed' : 'voice'}`)
  // 5. the pure functions
  const { wire } = rig
  for (const text of ['x', WORDS]) { rig.ui.disarmVoiceTurn(); assert.equal(wire.voiceOriginatedSend(text), false, 'nothing armed: not a voice send'); rig.ui.armVoiceTurn(WORDS); assert.equal(wire.voiceOriginatedSend(text), text === WORDS, `armed ${JSON.stringify(WORDS)}: ${JSON.stringify(text)}`); rig.ui.disarmVoiceTurn() }
  assert.equal(wire.voiceOriginatedSend(''), false)
  for (const [w, plan, want] of [['agent', 'pro', 'standard'], ['agent', 'premium', 'standard'], [undefined, 'pro', 'standard'], ['standard', 'premium', 'standard'], ['agent', 'free', undefined], [undefined, 'starter', undefined], [undefined, null, undefined], [undefined, undefined, undefined], ['author', 'pro', 'author'], ['author', 'free', 'author']]) assert.equal(wire.voiceBuildMode(w, plan), want, `voiceBuildMode(${w}, ${plan})`)
  for (const w of ['agent', 'standard', 'author', undefined]) for (const plan of ['free', 'starter', 'pro', 'premium', null, undefined]) assert.notEqual(wire.voiceBuildMode(w, plan), 'agent', `voiceBuildMode(${w}, ${plan}) is never "agent"`)
  // 6. the wire lib reads the bus, never writes it
  const wireText = texts[WIRE] ?? read(WIRE); assert.doesNotMatch(wireText.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''), /voiceCallBus\.(?!pending\b)|voiceCallBus\.pending\s*=[^=]|armVoiceTurn|disarmVoiceTurn|takeVoiceTurn/, 'the wire lib only reads voiceCallBus.pending')
}
/** H3: flags off, for each flag: the guard's lines are inert (no ref holds a mode, no send carries a key, the hook's line leaves a message as it is). */
function voiceFlagsOffChecks(texts = {}) {
  for (const [name, off] of Object.entries(ENV_OFF)) {
    const rig = voiceRig({ env: { ...off, NEXT_PUBLIC_STUDIO_VOICE_CALL: 'true' }, texts }), refs = renderRefs(rig, { buildMode: 'agent', plan: 'pro' })
    assert.equal(rig.lib.STUDIO_AGENT_MODE_ENABLED, false, `${name}: off`); assert.equal(refs.agentBuildModeRef.current, undefined, `${name}: the picker's mode is undefined`); assert.equal(refs.agentVoiceModeRef.current, undefined, `${name}: the voice mode is undefined`)
    for (const [kind, words] of [['send', 'yes build it'], ['action', 'Yes!']]) for (const bus of [null, words]) { const w = sendOnWire(rig, refs, kind, words, bus); assert.equal('build_mode' in w.data, false, `${name} ${kind}: no key, voice or typed`); assert.equal(w.options.buildMode, undefined) }
    rig.ui.armVoiceTurn('x'); assert.equal(hookMessage(rig, { buildMode: 'agent' }, 'x').build_mode, 'agent', `${name}: the hook's line does nothing with the flags off`); rig.ui.disarmVoiceTurn()
    assert.equal(rig.wire.voiceBuildMode('agent', 'pro'), 'agent', `${name}: the function itself changes nothing`)
  }
  const on = voiceRig({ texts }); on.ui.armVoiceTurn('x'); assert.equal(hookMessage(on, { buildMode: 'agent' }, 'x').build_mode, 'standard', 'on: the same line acts (the positive control)'); on.ui.disarmVoiceTurn()
}

/** Director's rule as the ruling states it (agent_mode.latch_build_mode): a message without build_mode leaves the mode a session holds; an explicit one replaces it. A model, so the proof can show what a reloaded session ends up holding. */
const latchBuildMode = (held, data) => ('build_mode' in data ? data.build_mode : held)
/** H5: STANDARD IS SAID OUT LOUD (PK ruling, 12 Nov): with the picker on Standard, Pro and Max send build_mode "standard" on every build send; the other plans and the flags off send no key; Agent and Author are as they were. The page's real lines and the hook's real lines, run. */
function standardSaidChecks(texts = {}) {
  const rig = voiceRig({ texts }), WORDS = 'build me a deck about the harbour', SAY = "Yes, let's build it!"
  const PAIRS = [['send', WORDS], ['action', SAY]]
  // 1. Pro and Max, the picker on Standard: never another picked (a page just loaded or reloaded: the picker starts on Standard), and back from Agent (an explicit reset, as before). The typed send and the click carry "standard", the hook puts it on the message, and a session that held an Agent opt-in ends up holding none
  for (const plan of ['pro', 'premium']) for (const previous of [undefined, 'agent']) {
    const refs = renderRefs(rig, { buildMode: 'standard', plan, previous })
    assert.equal(refs.agentBuildModeRef.current, 'standard', `${plan} (was ${previous}): the ref a typed send reads is "standard"`)
    for (const [kind, words] of PAIRS) {
      const typed = sendOnWire(rig, refs, kind, words, null)
      assert.equal(typed.options.buildMode, 'standard', `${plan} (was ${previous}) ${kind}: the handler hands the hook "standard"`); assert.equal(typed.data.build_mode, 'standard', `${plan} (was ${previous}) ${kind}: ... and it is on the message`); assert.equal(typed.data.mode, undefined, `${plan} ${kind}: a typed turn`); noAgent(typed.data, `${plan} ${kind} typed Standard`)
      assert.equal(latchBuildMode('agent', typed.data), 'standard', `${plan} (was ${previous}) ${kind}: a session that held an Agent opt-in holds none after this send`)
      const voice = sendOnWire(rig, refs, kind, words, words); assert.equal(voice.data.build_mode, 'standard', `${plan} ${kind}: a voice send still says "standard"`); assert.equal(voice.data.mode, 'voice')
    }
  }
  // 2. Free, Starter, a plan that is not loaded or not known: Standard sends no key at all, typed or by voice, as before (Agent is never sent for them, so there is no opt-in to clear)
  for (const plan of ['free', 'starter', null, 'enterprise']) {
    const refs = renderRefs(rig, { buildMode: 'standard', plan })
    assert.equal(refs.agentBuildModeRef.current, undefined, `plan ${plan}: no mode on the ref`); assert.equal(refs.agentVoiceModeRef.current, undefined, `plan ${plan}: ... nor on the voice ref`)
    for (const [kind, words] of PAIRS) for (const bus of [null, words]) { const w = sendOnWire(rig, refs, kind, words, bus); assert.equal('build_mode' in w.data, false, `plan ${plan} ${kind}: no build_mode key (${bus === null ? 'typed' : 'voice'})`); assert.equal(w.options.buildMode, undefined, `plan ${plan} ${kind}: the handler hands the hook nothing`) }
  }
  // 3. Agent picked: "agent" for a typed send and a click on Pro and Max (the person's own Agent send), "standard" for a voice send (H2); a plan without Agent: no key
  for (const plan of ['pro', 'premium']) {
    const refs = renderRefs(rig, { buildMode: 'agent', plan })
    for (const [kind, words] of PAIRS) { assert.equal(sendOnWire(rig, refs, kind, words, null).data.build_mode, 'agent', `${plan} ${kind}: Agent picked, typed`); assert.equal(sendOnWire(rig, refs, kind, words, words).data.build_mode, 'standard', `${plan} ${kind}: Agent picked, voice`) }
  }
  // 4. Author (its own flag; not part of the ruling): "author" on every plan that can pick it, typed or by voice; and Standard picked after Author on a plan without Agent is the explicit reset it always was
  const author = voiceRig({ env: { ...ENV_VOICE, NEXT_PUBLIC_AUTHOR_MODE_PICKER: 'true' }, texts })
  for (const plan of ['free', 'pro', 'premium']) { const refs = renderRefs(author, { buildMode: 'author', plan }); for (const [kind, words] of PAIRS) for (const bus of [null, words]) assert.equal(sendOnWire(author, refs, kind, words, bus).data.build_mode, 'author', `Author ${plan} ${kind}: ${bus === null ? 'typed' : 'voice'}`) }
  for (const plan of ['free', 'starter']) { const refs = renderRefs(author, { buildMode: 'standard', plan, previous: 'author' }); for (const [kind, words] of PAIRS) assert.equal(sendOnWire(author, refs, kind, words, null).data.build_mode, 'standard', `${plan} ${kind}: back to Standard from Author: the explicit reset, as before`) }
  // 5. each flag off: no mode held, no key, typed or by voice, whatever the plan (the lines are inert), and the function itself changes nothing
  for (const [name, off] of Object.entries(ENV_OFF)) {
    const flagsOff = voiceRig({ env: { ...off, NEXT_PUBLIC_STUDIO_VOICE_CALL: 'true' }, texts }); assert.equal(flagsOff.lib.STUDIO_AGENT_MODE_ENABLED, false, `${name}: off`)
    for (const plan of ['pro', 'premium']) {
      const refs = renderRefs(flagsOff, { buildMode: 'standard', plan }); assert.equal(refs.agentBuildModeRef.current, undefined, `${name} ${plan}: no mode on the ref`)
      for (const [kind, words] of PAIRS) for (const bus of [null, words]) { const w = sendOnWire(flagsOff, refs, kind, words, bus); assert.equal('build_mode' in w.data, false, `${name} ${plan} ${kind}: no key, byte for byte as today`); assert.equal(w.options.buildMode, undefined) }
    }
    assert.equal(flagsOff.wire.typedBuildMode(undefined, 'pro'), undefined, `${name}: the function leaves Standard's key out`); assert.equal(flagsOff.wire.typedBuildMode('agent', 'pro'), 'agent', `${name}: ... and everything else as it is`)
  }
  // 6. the pure function: [wire, plan, want]
  const { wire } = rig
  for (const [w, plan, want] of [[undefined, 'pro', 'standard'], [undefined, 'premium', 'standard'], ['standard', 'pro', 'standard'], ['standard', 'premium', 'standard'], ['agent', 'pro', 'agent'], ['agent', 'premium', 'agent'], ['author', 'pro', 'author'], ['author', 'premium', 'author'], ['author', 'free', 'author'], ['standard', 'free', 'standard'], ['standard', 'starter', 'standard'], [undefined, 'free', undefined], [undefined, 'starter', undefined], [undefined, null, undefined], [undefined, undefined, undefined], [undefined, 'enterprise', undefined]]) assert.equal(wire.typedBuildMode(w, plan), want, `typedBuildMode(${w}, ${plan})`)
  // 7. the source: one line writes the typed ref, through typedBuildMode with the plan, and the page imports it
  const page = texts[PAGE] ?? read(PAGE), writes = page.split('\n').filter(l => /agentBuildModeRef\.current\s*=[^=]/.test(l)); assert.equal(writes.length, 1, 'one line writes the typed ref'); assert.match(writes[0], /typedBuildMode\(buildModeWire, agentPlan\)/, 'from the picker\'s wire mode and the signed-in plan'); assert.equal(count(page, 'typedBuildMode,'), 1, 'imported from the wire lib, once')
  const hook = texts[HOOK] ?? read(HOOK); assert.equal(count(hook, "build_mode = 'standard'"), 1, 'the hook adds no other place that decides a build_mode (its one voice line is H1\'s)'); assert.equal(count(hook, 'build_mode: options.buildMode'), 1, 'and puts the page\'s mode on the message as it is, once')
}

class FakeClock {
  constructor() { this.t = 100000; this.timers = new Map(); this.id = 1 }
  now() { return this.t }
  set(fn, ms) { const id = this.id++; this.timers.set(id, { id, fn, at: this.t + ms }); return id }
  clear(id) { this.timers.delete(id) }
  async advance(ms) {
    const target = this.t + ms
    for (;;) {
      const next = [...this.timers.values()].filter(timer => timer.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0]
      if (!next) break
      this.timers.delete(next.id); this.t = Math.max(this.t, next.at); next.fn(); await settle()
    }
    this.t = target; await settle()
  }
}
const macro = () => new Promise(resolve => setImmediate(resolve))
const settle = async () => { for (let i = 0; i < 4; i++) { await Promise.resolve(); await macro() } }
const PLAN_CARD = [{ label: "Yes, let's build it!", value: 'accept_plan', primary: true, requires_input: false }, { label: "I'd like to make changes", value: 'reject_plan', primary: false, requires_input: false }]
/** A real voice call (the REAL controller, with a fake microphone, speaker, clock and speech route) in front of the page's and the hook's real lines. `said`: what the speech route hears, one transcript per turn. */
function voiceCall(rig, refs, said) {
  const clock = new FakeClock(), queue = [...said], sent = []
  const env = {
    secureContext: () => true, hasMic: () => true,
    openMic: async () => ({ level: () => 0, setMuted() {}, record: () => ({ stop: async () => ({ blob: { size: 5 }, durationMs: 1200, peak: 0.2 }), cancel() {} }), close() {} }),
    createPlayer: () => ({ play() {}, stop() {}, level: () => 0, prime() {} }),
    now: () => clock.now(), setTimer: (fn, ms) => clock.set(fn, ms), clearTimer: id => clock.clear(id), reducedMotion: () => true, macApp: () => false, mac: () => false,
  }
  const port = { transcribe: async () => ({ text: queue.length ? queue.shift() : '', costUsd: null }), speak: async () => ({ audio: { size: 1 }, costUsd: null }) }
  let ctl = null
  // the page's two handlers, as far as the build mode goes (the real entry line and the real build-mode line), and the hook's real lines; the "sent" tap is the hook's, once a user message marked mode "voice" went out
  const sendTurn = async text => { const w = sendOnWire(rig, refs, 'send', text, LEAVE_BUS); sent.push(w.data); if (w.data.mode === 'voice') ctl.onSent(text) }
  const sendAction = async action => { const w = sendOnWire(rig, refs, 'action', action.label, LEAVE_BUS); sent.push(w.data); if (w.data.mode === 'voice') ctl.onSent(action.label) }
  ctl = new (load(VOICE_CTL, { env: rig.env, texts: rig.texts }).VoiceCallController)({ env, port, sendTurn, sendAction, isConnected: () => true })
  return {
    ctl, sent, clock,
    start: async () => { await ctl.startCall(); await settle() },
    card: async (actions = PLAN_CARD) => { ctl.onFrame({ type: 'action_request', session_id: 's1', message_id: 'plan-card', payload: { prompt_text: 'Does this structure work for you?', actions } }); await settle() },
    talk: async () => { ctl.pttDown(); await settle(); await clock.advance(1250); await ctl.pttUp(); await settle() },
  }
}
/** H4: a spoken "yes" to the plan card, and a turn of spoken words, through the REAL call: the user messages that go out, with the picker on Agent. */
async function voiceAcceptChecks(texts = {}) {
  for (const [plan, want] of [['pro', 'standard'], ['premium', 'standard'], ['free', undefined]]) {
    const rig = voiceRig({ texts }), refs = renderRefs(rig, { buildMode: 'agent', plan })
    // a spoken yes, with a plan card open: the card's own button, as a voice turn
    const yes = voiceCall(rig, refs, ['yes']); await yes.start(); await yes.card(); await yes.talk()
    assert.equal(yes.sent.length, 1, `${plan}: one user message went out for the spoken yes`); const [m] = yes.sent
    assert.equal(m.mode, 'voice', `${plan}: it is a voice turn`); assert.equal(m.action_value, 'accept_plan', `${plan}: it is the plan card's accept button`); assert.equal(m.build_mode, want, `${plan}: build_mode ${want === undefined ? 'omitted' : `"${want}"`}`); noAgent(m, `${plan} spoken yes`)
    assert.equal(yes.ctl.getSnapshot().notice, null, `${plan}: the call saw the send go out (no "not sent" notice)`)
    // a turn of spoken words
    const words = voiceCall(rig, refs, ['make the deck a little longer']); await words.start(); await words.talk()
    assert.equal(words.sent.length, 1, `${plan}: one user message for the spoken words`); assert.equal(words.sent[0].mode, 'voice'); assert.equal(words.sent[0].text, 'make the deck a little longer'); assert.equal(words.sent[0].build_mode, want); noAgent(words.sent[0], `${plan} spoken words`)
    // the positive control: the person's own click on the same button, and a typed send, on the same page state, still carry Agent (on a plan that has it)
    const click = sendOnWire(rig, refs, 'action', PLAN_CARD[0].label, null), typed = sendOnWire(rig, refs, 'send', 'build it', null)
    for (const w of [click, typed]) assert.equal(w.data.build_mode, plan === 'free' ? undefined : 'agent', `${plan}: a click or a typed send carries the picker's mode`)
    assert.equal(rig.ui.voiceCallBus.pending, null, `${plan}: nothing stays armed`)
  }
}

// ============================================================================================================================================
// F. the sources: marked pure insertions, the strip, the registry, .env.example
// ============================================================================================================================================
/** The lines `now` adds to `base`, and whether every base line is still there, in order and untouched (a rewrite or a removal fails it). Greedy: all edits here are pure insertions. */
function insertionsOf(base, now) {
  const b = base.split('\n'), n = now.split('\n'), added = []; let p = 0
  for (const line of n) { if (p < b.length && line === b[p]) p++; else added.push(line) }
  return { added, baseKept: p === b.length }
}
const SHELL_PROOF = 'scripts/test-studio-agent-mode-shell.mjs'
/** The strips of every OTHER change the registry holds after #607's. A keep-both restack puts a later change's lines in a file before (or after) this change's: the chain's #600 / #606 / #605 add subject filters to the same two older proofs, in the registry's tails. Read through those strips a file is #607's head
 *  plus this change's own lines, whatever order the lines sit in. On this branch there are none, and the checks are as they were. */
const otherStripsOf = (reg = registry) => { const at = reg.LATER_STRIPS.findIndex(fn => typeof fn === 'function' && fn.name === 'stripAgentModeShell'); return at === -1 ? [] : reg.LATER_STRIPS.slice(at + 1).filter(fn => fn !== stripAgentModeWire) }
const readThrough = (rel, text, others) => others.reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, text)
/** `small` is `big` with lines left out: every line of `small` is in `big`, in order (greedy is exact for a subsequence). */
const isSubsequence = (small, big) => { let p = 0; for (const line of big) if (p < small.length && line === small[p]) p++; return p === small.length }
const wholeLines = text => (text === '' ? [] : text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n'))
function sourceChecks(texts = {}, strip = stripAgentModeWire, shown = {}, others = otherStripsOf()) {
  // every file is read through the other changes' strips (none on this branch): on a keep-both restack their lines are theirs, and the base is #607's head either way
  const now = rel => readThrough(rel, texts[rel] ?? shown[rel] ?? committed(rel), others), base = rel => readThrough(rel, baseText(rel), others)
  const only = (a, b) => { const seen = new Map(); for (const l of b) seen.set(l, (seen.get(l) ?? 0) + 1); return a.filter(l => { const n = seen.get(l) ?? 0; if (n > 0) { seen.set(l, n - 1); return false } return true }) }
  const onceAtLineStart = (text, block) => ('\n' + text).split('\n' + block).length - 1 === 1
  // the two app files: every added line carries the marker, none is a rewrite, the strip gives #607's head back byte for byte
  for (const rel of APP_FILES) {
    const { added, baseKept } = insertionsOf(base(rel), now(rel)); assert.ok(baseKept, `${rel}: every base line is kept, in order (this change rewrites and removes none)`)
    assert.ok(added.length > 0, `${rel}: lines are added`); for (const line of added) assert.match(line, MARKER_RE, `${rel}: an added line without the marker: ${line.slice(0, 90)}`)
    assert.equal(added.length, ALL_EDITS[rel].length, `${rel}: one [has, was] pair per added line`); for (const [has, was] of ALL_EDITS[rel]) { assert.equal(was, '', `${rel}: a pure insertion`); assert.ok(MARKER_RE.test(has) && has.endsWith('\n'), `${rel}: the pair line carries the marker`) }
    assert.equal(strip(rel, now(rel)), base(rel), `${rel}: the strip puts #607's head back byte for byte`); assert.equal(strip(rel, base(rel)), base(rel), `${rel}: idempotent on the base`)
    assert.equal(count(now(rel), 'AGENT-MODE-WIRE') >= added.length, true)
  }
  // #607's own files and proof, edited IN PLACE (PK ruling: the A1 estimate card is information, not a gate; FRONTEND-2, #607's owner, OK'd the substance): the same rule as the hook and the page, read strictly. EVERY line that is not #607's carries the marker (a line of #607's is never
  // rewritten without it), every line of every pair carries it, each pair is in the file once, and the strip puts #607's head back BYTE FOR BYTE
  for (const rel of [...SHELL_EDITED, SHELL_PROOF]) {
    const proof = rel === SHELL_PROOF, nowText = now(rel), baseLines = base(rel).split('\n'), nowLines = nowText.split('\n'), pairs = ALL_EDITS[rel]
    assert.ok(pairs.length > 0, `${rel}: it has pairs`); assert.equal(base(rel).includes('AGENT-MODE-WIRE'), false, `${rel}: #607's head has none of this change's marker`)
    assert.ok(isSubsequence(nowLines.filter(l => !MARKER_RE.test(l)), baseLines), `${rel}: every line without the marker is a line of #607's, in order (nothing of #607's is rewritten, added or removed without the marker)`)
    for (const [has, was] of pairs) {
      assert.ok(has !== '' && has.endsWith('\n') && (was === '' || was.endsWith('\n')), `${rel}: the pair is whole lines`)
      for (const line of wholeLines(has)) { assert.match(line, MARKER_RE, `${rel}: a pair line without the marker: ${line.slice(0, 90)}`); if (proof) assert.ok(line.includes(PIN_MARK.replace('// ', '')), `${rel}: a line of #607's proof carries the registry-read mark: ${line.slice(0, 70)}`) }
      assert.ok(onceAtLineStart(nowText, has), `${rel}: the pair's lines are in the file once, from the start of a line: ${has.slice(0, 70)}`)
      for (const line of wholeLines(was)) assert.equal(MARKER_RE.test(line), false, `${rel}: what a pair puts back is #607's, not ours`)
    }
    assert.equal(nowLines.filter(l => MARKER_RE.test(l)).length, pairs.reduce((n, [has]) => n + wholeLines(has).length, 0), `${rel}: every marked line is in a pair (and in one only)`)
    assert.equal(strip(rel, nowText), base(rel), `${rel}: the strip puts #607's head back byte for byte (nothing weaker: no line is left registered only)`); assert.equal(strip(rel, base(rel)), base(rel), `${rel}: idempotent on the base`)
  }
  // the two older proofs taught a subject filter (pure insertions): each pair carries the registry-read mark, is in the file once, and nothing else differs from #607's head once the other changes' lines are read out
  for (const rel of PIN_FILES.filter(r => r !== SHELL_PROOF)) {
    const baseLines = base(rel).split('\n'), nowLines = now(rel).split('\n')
    for (const [has, was] of ALL_EDITS[rel]) { assert.ok(has.includes(PIN_MARK.replace('// ', '')), `${rel}: the line carries the registry-read mark: ${has.slice(0, 70)}`); assert.equal(nowLines.filter(l => l === has.slice(0, -1)).length, 1, `${rel}: in the file once, as a whole line`); assert.equal(was, '', `${rel}: a pure insertion`) }
    assert.equal(only(nowLines, baseLines).length, ALL_EDITS[rel].length, `${rel}: the lines this change has that #607's head lacks (the other changes' read out) are its pairs'`); assert.equal(only(baseLines, nowLines).length, 0, `${rel}: no base line is lost`)
    assert.equal(strip(rel, now(rel)), base(rel), `${rel}: the strip puts #607's head back`)
  }
  // the strip: other files untouched, no line of another file is claimed, the pairs are whole lines
  for (const rel of ['package.json', '.env.example', REGISTRY]) assert.equal(strip(rel, baseText(rel)), baseText(rel), `${rel}: not this strip's`)
  assert.equal(strip('x.ts', 7), 7); assert.equal(strip('x.ts', 'a\nb\n'), 'a\nb\n')
  // the hook: each of its added lines, one by one, is where the strip says (a pair removed puts back a line the file kept)
  for (const rel of APP_FILES) for (const [has] of ALL_EDITS[rel]) assert.equal(now(rel).split('\n').filter(l => l === has.slice(0, -1)).length, 1, `${rel}: the pair's line is in the file exactly once (as a whole line, indent included): ${has.slice(0, 70)}`)
  // .env.example: this change touches it not at all (the flag's block is #607's): read without the registered blocks (#607's, and the changes restacked with this one) it is #607's head's, so a block of this change's own would stay and fail; #607's block still names the flag once
  const env = texts['.env.example'] ?? committed('.env.example')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', env), registry.stripLaterEnvBlocks('.env.example', baseText('.env.example')), '.env.example is #607\'s byte for byte once the registered blocks are read out (no block of this change)'); assert.equal(count(env, 'NEXT_PUBLIC_AGENT_MODE="false"'), 1)
}
const END = '  // one line per later change, above this comment'
/** A line another change registered (any change's, as the registry's own convention has them): its strip module and its marker comment. */
const registeredLine = l => /\/\/ LATER-CHANGE: /.test(l) && /-strip\.mjs/.test(l)
// ORDER, never adjacency: a keep-both restack puts the changes queued ahead of this one (#600, #606, #605) between #607's line and this change's, so each check asks only whether this change's line comes AFTER #607's in the same list, is followed by
// registered lines only until the end of the list, and whether the registry gained anything that is neither this change's nor another change's registered line
function registryChecks(text = read(REGISTRY), reg = registry) {
  const lines = text.split('\n'), section = i => { for (let k = i; k >= 0; k--) { const m = /^export const (LATER_\w+)/.exec(lines[k]); if (m) return m[1] } return null }
  const own = lines.map((l, i) => [l, i]).filter(([l]) => l.includes('studio-agent-mode-wire-strip.mjs'))
  assert.equal(own.length, 2, 'two registry lines name this change\'s strip module'); deepEqual(own.map(([, i]) => section(i)), ['LATER_CHANGE_FILES', 'LATER_STRIPS'], 'one in the files list and one in the strips list; the env list gets none (no block)')
  for (const [line, i] of own) {
    assert.match(line, /\/\/ LATER-CHANGE: FRONTEND-1, Agent mode wire/, 'the registry marker')
    const shellAt = lines.findIndex((l, k) => l.includes('studio-agent-mode-shell-strip.mjs') && section(k) === section(i)); assert.ok(shellAt !== -1 && shellAt < i, `after #607's line in the same list (line ${i + 1}; changes restacked between them are fine, a line before it is not)`)
    let k = i + 1; while (k < lines.length && lines[k] !== END) { assert.ok(registeredLine(lines[k]), `the true end of its list: only another change's registered line may follow it (line ${k + 1}: ${lines[k].slice(0, 80)})`); k++ }
    assert.equal(lines[k], END, 'the list ends at the registry\'s own end line')
  }
  assert.deepEqual(own.map(([l]) => /\)\.(\w+), \/\//.exec(l)?.[1]), ['AGENT_MODE_WIRE_SCOPE_FILES', 'stripAgentModeWire'])
  const base = baseText(REGISTRY).split('\n'); assert.ok(base.every(l => lines.includes(l)), 'the registry loses no line'); assert.equal(lines.filter(l => !base.includes(l)).filter(l => !l.includes('studio-agent-mode-wire-strip.mjs')).filter(l => !registeredLine(l)).length, 0, 'and gains nothing else (the registered lines of changes restacked with this one are theirs)')
  assert.ok(reg.LATER_STRIPS.includes(stripAgentModeWire), 'the strip is registered'); assert.ok([...SCOPE].every(rel => reg.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  const shellAt = reg.LATER_STRIPS.findIndex(fn => typeof fn === 'function' && fn.name === 'stripAgentModeShell'), ownAt = reg.LATER_STRIPS.indexOf(stripAgentModeWire); assert.ok(shellAt > 0 && ownAt > shellAt, 'the strip comes after #607\'s (changes restacked between them are fine)')
  // read through the registry (as the older proofs do), the hook and the page are #607's head's
  for (const rel of APP_FILES) assert.equal(reg.stripLaterChanges(rel, committed(rel)), reg.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's`)
}

/** Three changes queued ahead of this one, as a keep-both restack lays them out (the chain first, this change's lines after): each registers a files line and a strips line, and adds one subject filter to each of the two older proofs. They are modelled, not read from the chain. */
const CHAIN = ['one', 'two', 'three'], CHAIN_PINS = ['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs']
const chainFilter = name => `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Chain ${name}:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CHAIN-${name.toUpperCase()}): a change queued ahead of this one\n`
const chainStrips = CHAIN.map(name => { const f = chainFilter(name); const fn = (rel, text) => (CHAIN_PINS.includes(rel) && typeof text === 'string' ? text.replace(f, '') : text); Object.defineProperty(fn, 'name', { value: `stripChain${name}` }); return fn })
function restackedRegistry() {
  const lines = read(REGISTRY).split('\n'), out = []
  for (const line of lines) {
    if (line.includes('studio-agent-mode-wire-strip.mjs')) for (const name of CHAIN) out.push(line.includes('SCOPE_FILES') ? `  ...(await import('./studio-chain-${name}-strip.mjs')).CHAIN_SCOPE_FILES, // LATER-CHANGE: CHAIN, change ${name}, queued ahead of the Agent mode wire` : `  (await import('./studio-chain-${name}-strip.mjs')).stripChain${name}, // LATER-CHANGE: CHAIN, change ${name}, queued ahead of the Agent mode wire`)
    out.push(line)
  }
  return out.join('\n')
}
const restackedReg = () => { const shell = registry.LATER_STRIPS.find(fn => typeof fn === 'function' && fn.name === 'stripAgentModeShell'), at = registry.LATER_STRIPS.indexOf(shell); return { ...registry, LATER_STRIPS: [...registry.LATER_STRIPS.slice(0, at + 1), ...chainStrips, ...registry.LATER_STRIPS.slice(at + 1)] } }
const restackedProofs = () => Object.fromEntries(CHAIN_PINS.map(rel => { const own = ALL_EDITS[rel][0][0]; assert.equal(count(committed(rel), own), 1); return [rel, committed(rel).replace(own, () => CHAIN.map(chainFilter).join('') + own)] }))
function restackChecks(text = restackedRegistry(), reg = restackedReg(), texts = restackedProofs(), others = [...otherStripsOf(), ...chainStrips]) {
  registryChecks(text, reg); sourceChecks(texts, stripAgentModeWire, {}, others)
}

// ============================================================================================================================================
// G. scope: the COMMITTED diff only
// ============================================================================================================================================
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
/** This change's own commits, found by SUBJECT across `rev-list --no-merges` (a merge of #607's later commits or of dev hides or adds none). */
const ownCommits = (head = 'HEAD') => git('rev-list', '--no-merges', `${STACK_BASE}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT))
/** The files that differ from #607's head, from the COMMITTED diff: what this change's own commits touch and the net diff still shows. Never the working tree, the index or an untracked file. */
const touchedFiles = commits => { const net = new Set(git('diff', '--name-only', `${STACK_BASE}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(c => git('show', '--name-only', '--format=', c).split('\n')).filter(rel => rel && net.has(rel))) }
const scopeCheck = (commits, extra = []) => assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from #607\'s head')
const messageProblems = (subject, body) => { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line'); return problems }
const SECRET = /(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{30,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/
function scopeChecks() {
  const own = ownCommits(); assert.ok(own.length >= 1, `an own commit exists (subject starts "${SUBJECT}")`)
  scopeCheck(own)
  for (const rel of NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)), `${rel} exists`)
  for (const c of own) deepEqual(messageProblems(subjectOf(c), git('log', '-1', '--format=%B', c)), [], `commit ${c.slice(0, 8)}`)
  // what is committed differs from #607's head in the scope files only (a later change stacked after this one is left to its registered files)
  const net = git('diff', '--name-only', `${STACK_BASE}..HEAD`).split('\n').filter(Boolean); deepEqual(net.filter(rel => !SCOPE.has(rel) && !registry.LATER_CHANGE_FILES.has(rel)), [], 'the whole committed diff from #607\'s head is this change\'s scope (or a later change\'s registered files)')
  // #607's and the base's files this change does not touch: its own commits never do, and the diff from #607's head shows none of them unless another change registered it (a keep-both restack: the chain's .env.example blocks)
  const mine = touchedFiles(own)
  for (const rel of ['tests/fixtures/agent_frames_contract.json', 'package.json', 'pnpm-lock.yaml', '.env.example', 'components/builder/message-list.tsx', 'components/builder/chat-input.tsx', 'components/builder/agent-mode/build-mode-picker.tsx', 'scripts/studio-agent-mode-shell-strip.mjs']) { assert.ok(!mine.has(rel) || SCOPE.has(rel), `${rel} is #607's / the base's: this change's commits do not touch it`); assert.ok(!net.includes(rel) || SCOPE.has(rel) || registry.LATER_CHANGE_FILES.has(rel), `${rel} is #607's / the base's: untouched (or another change's registered file)`) }
  deepEqual(net.filter(rel => rel.startsWith('components/builder/agent-mode/') || rel === 'lib/studio-agent-mode.ts').sort(), [...SHELL_EDITED].sort(), 'of #607\'s card files and words, exactly the ones this change edits in place (the A1 estimate card) differ from #607\'s head, and each is in its scope'); assert.ok(SHELL_EDITED.every(rel => SCOPE.has(rel)))
  for (const rel of NEW_FILES) assert.doesNotMatch(committed(rel), SECRET, `${rel}: no secret-shaped literal`)
  // the working tree is not read: an untracked stray file changes nothing
  const stray = path.join(root, 'stray-agent-mode-wire.txt'), before = [...touchedFiles(own)].sort()
  fs.writeFileSync(stray, 'stray\n')
  try { deepEqual([...touchedFiles(own)].sort(), before, 'an untracked stray file does not change the files read'); assert.doesNotThrow(() => scopeCheck(own), 'and does not fail the scope check') } finally { fs.rmSync(stray) }
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
await check('A. flags off, EACH flag (the other on, and both off; every mis-spelled value): the hook\'s route falls through and calls nothing, the answer sends nothing on an open socket, build_mode is omitted, the frame option is not passed, the picker and the cards are not mounted, the session effect and the answer rule do nothing; on, the same lines act', () => flagsOffChecks())
await check('B. each of the six agent frames, as Director sends it ({ type, payload }, no session envelope), is routed to the page\'s run card and read by #607\'s reader; the owner is this exact socket; other types fall through; the route is ahead of the allowlist', () => routingChecks())
await check('C. THE ANSWER FRAME is the contract\'s: every card and choice of AGENT-1\'s fixture goes out as exactly { type: "agent_answer", data: { run_id, card, choice } } (the fixture\'s example byte for byte), once, on an open socket only; never queued, retried or replayed', () => answerChecks())
await check('D. NO PAID START WITHOUT A CLICK: frames, renders, the picker and expiry send nothing; one click is one frame on its own card; an answered, expired, foreign or unoffered card sends nothing; a socket that is not live leaves the card open and says so with the next step; Agent is off below Pro, with no plan and while a run is in progress; one caller of sendAgentAnswer', () => noAutoStartChecks())
await check('E. the page: gated mounts and options, the plan from the session (never a frame), the cards in the chat after the messages and the picker above the composer, the session effect, the lib\'s reducer / key / words', () => pageChecks())
await check('H1. NO AGENT START FROM VOICE, the paths: the voice call is the only thing that sends for the voice (two callbacks, one arming of the bus, one mount); the Director call is read-only; the guard sits at the top of both handlers it reaches, before any await, and the four build sends read the ref it picks; the hook\'s line is right after the one that marks the voice turn', () => voiceInventoryChecks())
await check('H2. a voice accept / a voice-originated send (the picker on Agent, Pro and Max) carries "standard", never "agent", and no agent frame; a click or a typed send still carries "agent"; the call ending while the send waits, a slip past the page, another plan, Standard, Author', () => voiceChecks())
await check('H3. the same lines with each flag off: no mode held, no key sent (voice or typed), the hook\'s line does nothing; on, it acts', () => voiceFlagsOffChecks())
await check('H4. THROUGH THE REAL CALL: a spoken yes to the plan card and a spoken turn (the real controller, a fake microphone and speech route) put a voice user message on the wire with "standard" (no key below Pro), the click and the typed send beside it carry Agent', () => voiceAcceptChecks())
await check('H5. STANDARD IS SAID OUT LOUD: with the picker on Standard (a page just loaded, or back from Agent) Pro and Max send build_mode "standard" on a typed send and on a card\'s button, and a session that held an Agent opt-in holds none; Free, Starter, an unknown plan and each flag off send no key; Agent picked sends "agent", Author "author", a voice send "standard"', () => standardSaidChecks())
await check('F1. the sources: every line this change adds to the hook and the page carries the marker and is a pure insertion (no base line rewritten or removed); #607\'s four files and its proof, edited in place, have every changed line marked and paired; the strip puts #607\'s head back byte for byte (two app files, #607\'s files and proof, two older proofs); .env.example untouched', () => sourceChecks())
await check('F2. the registry: two marked lines (files, strips) after #607\'s (in order: changes restacked between them are fine) and at the true end of their lists, none in the env list, nothing lost, nothing gained but registered lines; read through it the hook and the page are the base\'s', () => registryChecks())
await check('F3. A KEEP-BOTH RESTACK (the changes queued ahead of this one, #600 / #606 / #605, put their registry lines and their subject filters in the same places, before this change\'s): the registry checks and the older-proof checks still pass, the base read through the other strips', () => restackChecks())
await check('G. scope, read from the COMMITTED diff only: the own commits (by subject) carry the co-author line; every file they touch is this change\'s scope; the whole diff from #607\'s head is nothing else; a stray untracked file changes nothing', () => scopeChecks())

// ============================================================================================================================================
// I. mutants: each is one edit of the real sources, fed to the same checks
// ============================================================================================================================================
const HOOK_TEXT = read(HOOK), PAGE_TEXT = read(PAGE), WIRE_TEXT = read(WIRE), STRIP_TEXT = read(STRIP)
const hookMutant = (label, from, to, checks = [flagsOffChecks, routingChecks, answerChecks, noAutoStartChecks, pageChecks]) => mutant(`hook: ${label}`, () => { const texts = { [HOOK]: swap(HOOK_TEXT, from, to) }; for (const fn of checks) fn(texts) })
const pageMutant = (label, from, to, checks = [flagsOffChecks, routingChecks, noAutoStartChecks, pageChecks]) => mutant(`page: ${label}`, () => { const texts = { [PAGE]: swap(PAGE_TEXT, from, to) }; for (const fn of checks) fn(texts) })
const wireMutant = (label, from, to, checks = [flagsOffChecks, noAutoStartChecks, pageChecks]) => mutant(`wire lib: ${label}`, () => { const texts = { [WIRE]: swap(WIRE_TEXT, from, to) }; for (const fn of checks) fn(texts) })
const ROUTE_LINE = ROUTE(HOOK_TEXT), SEND_LINE = lineWith(HOOK_TEXT, 'if (!STUDIO_AGENT_MODE_ENABLED || !socket ||'), SOCKET_SEND = lineWith(HOOK_TEXT, 'try { socket.send(JSON.stringify(agentAnswerFrame(answer)))')
const L0 = pageLines(PAGE_TEXT)

// the hook's route
await hookMutant('the route is not gated by the flag', 'if (STUDIO_AGENT_MODE_ENABLED && isAgentFrameType(parsedMessage.type)) {', 'if (isAgentFrameType(parsedMessage.type)) {')
await hookMutant('the route ignores which socket the frame came on', 'if (isCurrentSocket() && (rawMessage.session_id === undefined', 'if ((rawMessage.session_id === undefined')
await hookMutant('the route requires a session id (Director sends none)', 'rawMessage.session_id === undefined || rawMessage.session_id === socketSessionId', 'rawMessage.session_id === socketSessionId')
await hookMutant('the route accepts another session\'s frame', 'rawMessage.session_id === undefined || rawMessage.session_id === socketSessionId', 'true')
await hookMutant('the route does not swallow the frame (it falls on to the allowlist)', 'isCurrent: isCurrentSocket }); return; } // AGENT-MODE-WIRE', 'isCurrent: isCurrentSocket }); } // AGENT-MODE-WIRE')
await hookMutant('the route hands the page a copy', 'onAgentFrame?.(parsedMessage,', 'onAgentFrame?.({ ...parsedMessage },')
await hookMutant('the route is behind the allowlist (the frame is dropped first)', ROUTE_LINE + '\n', '')
await mutant('hook: the route placed after the allowlist check', () => { const t = swap(swap(HOOK_TEXT, ROUTE_LINE + '\n', ''), `            ${ALLOWLIST}\n              return;\n            }\n`, `            ${ALLOWLIST}\n              return;\n            }\n${ROUTE_LINE}\n`); routingChecks({ [HOOK]: t }) })
await hookMutant('the route only knows five of the six types (the type list is #607\'s; the hook adds one of its own)', 'isAgentFrameType(parsedMessage.type)', "(isAgentFrameType(parsedMessage.type) && parsedMessage.type !== 'agent_done')")
await hookMutant('an agent type is added to the allowlist too', "  'template_ingest_failed',\n]);", "  'template_ingest_failed',\n  'agent_step',\n]);")
await hookMutant('the page callback is called twice', 'transportCallbacksRef.current.onAgentFrame?.(parsedMessage, { sessionId: socketSessionId, isCurrent: isCurrentSocket });', 'transportCallbacksRef.current.onAgentFrame?.(parsedMessage, { sessionId: socketSessionId, isCurrent: isCurrentSocket }); transportCallbacksRef.current.onAgentFrame?.(parsedMessage, { sessionId: socketSessionId, isCurrent: isCurrentSocket });')
// the hook's answer sender
await hookMutant('the sender is not gated by the flag', 'if (!STUDIO_AGENT_MODE_ENABLED || !socket ||', 'if (!socket ||')
await hookMutant('the sender sends on a socket that is not open', 'agentAnswerSendable(answer, socket.readyState === WebSocket.OPEN)', 'agentAnswerSendable(answer, true)')
await hookMutant('the sender skips the answer check', '!agentAnswerSendable(answer, socket.readyState === WebSocket.OPEN)', '!(socket.readyState === WebSocket.OPEN)')
await hookMutant('the sender retries once', SOCKET_SEND, 'try { socket.send(JSON.stringify(agentAnswerFrame(answer))); return true; } catch { try { socket.send(JSON.stringify(agentAnswerFrame(answer))); return true; } catch { return false; } } // AGENT-MODE-WIRE')
await hookMutant('the sender throws instead of saying false', SOCKET_SEND, 'socket.send(JSON.stringify(agentAnswerFrame(answer))); return true; // AGENT-MODE-WIRE')
await hookMutant('the sender builds the envelope by hand with payload instead of data', 'JSON.stringify(agentAnswerFrame(answer))', "JSON.stringify({ type: 'agent_answer', payload: { run_id: answer.runId, card: answer.card, choice: answer.choice } })")
await hookMutant('the sender builds the envelope by hand with the wrong field names', 'JSON.stringify(agentAnswerFrame(answer))', "JSON.stringify({ type: 'agent_answer', data: { runId: answer.runId, card: answer.card, choice: answer.choice } })")
await hookMutant('the sender sends the answer twice', 'try { socket.send(JSON.stringify(agentAnswerFrame(answer))); return true; }', 'try { socket.send(JSON.stringify(agentAnswerFrame(answer))); socket.send(JSON.stringify(agentAnswerFrame(answer))); return true; }')
await hookMutant('the sender keeps an answer for a later reconnect', 'const socket = wsRef.current; // AGENT-MODE-WIRE\n', 'const socket = wsRef.current; setTimeout(() => socket?.send?.(JSON.stringify(agentAnswerFrame(answer))), 1000); // AGENT-MODE-WIRE\n')
await mutant('hook: a self-call of the sender on a frame (an auto answer)', () => { const t = swap(HOOK_TEXT, 'transportCallbacksRef.current.onAgentFrame?.(parsedMessage, { sessionId: socketSessionId, isCurrent: isCurrentSocket });', 'transportCallbacksRef.current.onAgentFrame?.(parsedMessage, { sessionId: socketSessionId, isCurrent: isCurrentSocket }); sendAgentAnswer({ runId: String((rawMessage.payload as any)?.run_id), card: \'A1\', choice: \'start\' });'); noAutoStartChecks({ [HOOK]: t }) })
await hookMutant('the build_mode key is sent unguarded as "agent"', '...(options?.buildMode && { build_mode: options.buildMode }), // AGENT-MODE-WIRE', "build_mode: 'agent', // AGENT-MODE-WIRE", [pageChecks])
await hookMutant('a marked line without the marker (a changed line the strip cannot find)', "    sendAgentAnswer, // AGENT-MODE-WIRE\n", "    sendAgentAnswer,\n", [sourceChecks])
await mutant('hook: a base line rewritten (the allowlist check)', () => sourceChecks({ [HOOK]: swap(HOOK_TEXT, ALLOWLIST, 'if (!isKnownDirectorMessageType(parsedMessage.type) && !isAgentFrameType(parsedMessage.type)) {') }))
await mutant('hook: an unmarked extra line', () => sourceChecks({ [HOOK]: swap(HOOK_TEXT, "    sendAgentAnswer, // AGENT-MODE-WIRE\n", "    sendAgentAnswer, // AGENT-MODE-WIRE\n    extraThing,\n") }))
await mutant('hook: the change\'s own line missing (the strip would restore a line the file never had)', () => sourceChecks({ [HOOK]: swap(HOOK_TEXT, "    sendAgentAnswer, // AGENT-MODE-WIRE\n", '') }))

// the page
await pageMutant('build_mode ignores the flag', 'const buildModeWire = STUDIO_AGENT_MODE_ENABLED ? buildModeOnWire(buildMode, { plan: agentPlan, previous: buildModeFrom }) : undefined', 'const buildModeWire = buildModeOnWire(buildMode, { plan: agentPlan, previous: buildModeFrom })')
await pageMutant('build_mode ignores the plan', 'buildModeOnWire(buildMode, { plan: agentPlan, previous: buildModeFrom })', "buildModeOnWire(buildMode, { plan: 'pro', previous: buildModeFrom })")
await pageMutant('the plan is read from a frame', 'const agentPlan = agentPlanOf(user?.tier)', 'const agentPlan = agentPlanOf((agentRun as any)?.plan ?? user?.tier)')
await pageMutant('the plan is always Pro', 'const agentPlan = agentPlanOf(user?.tier)', "const agentPlan = agentPlanOf('pro')")
await pageMutant('the frame option is passed with the flag off', '...(STUDIO_AGENT_MODE_ENABLED ? { onAgentFrame:', '...(true ? { onAgentFrame:')
await pageMutant('the frame option dispatches a frame of a socket that is no longer current', '=> { if (owner.isCurrent()) dispatchAgentRun(frame) }', '=> { dispatchAgentRun(frame) }')
await pageMutant('the frame option answers the frame', '=> { if (owner.isCurrent()) dispatchAgentRun(frame) }', "=> { if (owner.isCurrent()) { dispatchAgentRun(frame); sendAgentAnswer({ runId: 'x', card: 'A1', choice: 'start' }) } }")
await pageMutant('the cards are mounted with the flag off', "{STUDIO_AGENT_MODE_ENABLED && agentRun.status !== 'idle' ? <div ref={agentCardsRef}", "{agentRun.status !== 'idle' ? <div ref={agentCardsRef}")
await pageMutant('the picker is mounted with the flag off', '{STUDIO_AGENT_MODE_ENABLED ? <div className="mx-auto w-full max-w-[668px] px-3 pb-1"><BuildModePicker', '{true ? <div className="mx-auto w-full max-w-[668px] px-3 pb-1"><BuildModePicker')
await pageMutant('the picker is not off while a run is in progress', 'disabled={agentRunBusy(agentRun)}', 'disabled={false}')
await pageMutant('the picker is given a plan that is always Pro', 'plan={agentPlan}', 'plan="pro"')
await pageMutant('a card answer sends without the open-card rule', 'answerAgentCard(agentRun, answer, sendAgentAnswer, dispatchAgentRun, () => toast(AGENT_WIRE_COPY.answerNotSent))', 'sendAgentAnswer(answer)')
await pageMutant('a failed answer says nothing', 'answerAgentCard(agentRun, answer, sendAgentAnswer, dispatchAgentRun, () => toast(AGENT_WIRE_COPY.answerNotSent))', 'answerAgentCard(agentRun, answer, sendAgentAnswer, dispatchAgentRun, () => {})')
await pageMutant('a failed answer says the wrong thing', 'toast(AGENT_WIRE_COPY.answerNotSent)', "toast({ title: 'Error', description: '' })")
await pageMutant('the cards\' state is not the run\'s', '<AgentRunCards state={agentRun}', '<AgentRunCards state={agentRun as any as never}')
await pageMutant('a refused control says nothing', 'else toast(AGENT_WIRE_COPY.controlNotSent(action)) }}', 'else { } }}')
await pageMutant('a control is marked even when Director did not take it', 'if (requestId) markNarrationControl(AGENT_WIRE_CONTROL_MARK[action], buildNarration.buildId, requestId); else', 'markNarrationControl(AGENT_WIRE_CONTROL_MARK[action], buildNarration.buildId, requestId ?? \'\'); if (!requestId)')
await pageMutant('the session effect resets on the first save of a new chat', 'agentSessionChanged(agentSessionRef.current, currentSessionId)', 'agentSessionRef.current !== currentSessionId')
await pageMutant('the session effect never resets', 'if (agentSessionChanged(agentSessionRef.current, currentSessionId)) {', 'if (false) {')
await pageMutant('the session effect keeps the picked mode', 'dispatchAgentRun(AGENT_WIRE_RESET); setBuildMode(\'standard\'); setBuildModeFrom(undefined) }', 'dispatchAgentRun(AGENT_WIRE_RESET) }')
await pageMutant('the session effect runs with the flag off', 'if (!STUDIO_AGENT_MODE_ENABLED) return // AGENT-MODE-WIRE', '')
await pageMutant('one build send loses the build mode', '          ...buildSendOptions,\n          ...(agentModeRef.current ? { buildMode: agentModeRef.current } : {}), // AGENT-MODE-WIRE\n          manualDeck: turnContext?.manualDeck,', '          ...buildSendOptions,\n          manualDeck: turnContext?.manualDeck,')
await pageMutant('the build mode ref is never written', 'agentBuildModeRef.current = STUDIO_AGENT_MODE_ENABLED ? typedBuildMode(buildModeWire, agentPlan) : undefined // AGENT-MODE-WIRE', 'void buildModeWire // AGENT-MODE-WIRE')
await pageMutant('the cards sit outside the scroll area (before the message list)', "{STUDIO_AGENT_MODE_ENABLED && agentRun.status !== 'idle' ? <div ref={agentCardsRef}", "{STUDIO_AGENT_MODE_ENABLED && agentRun.status !== 'idle' && false ? <div ref={agentCardsRef}")
await pageMutant('an auto answer: Start is sent by an effect when an estimate arrives', "  const agentCardsViewKey = agentCardsKey(agentRun) // AGENT-MODE-WIRE\n", "  const agentCardsViewKey = agentCardsKey(agentRun) // AGENT-MODE-WIRE\n  useEffect(() => { if (agentRun.status === 'estimate' && agentRun.runId) sendAgentAnswer({ runId: agentRun.runId, card: 'A1', choice: 'start' }) }, [agentRun.status]) // AGENT-MODE-WIRE\n")
await mutant('page: a base line rewritten', () => sourceChecks({ [PAGE]: swap(PAGE_TEXT, '    [templateSendOptions, buildThemeSelection, deckIdentity],', '    [templateSendOptions, buildThemeSelection, deckIdentity, buildMode],') }))
await mutant('page: an unmarked extra line', () => sourceChecks({ [PAGE]: swap(PAGE_TEXT, 'import { BuilderQuotaRefusal } from \'@/components/billing/builder-quota-refusal\' // BILLING-F5-USAGE\n', 'import { BuilderQuotaRefusal } from \'@/components/billing/builder-quota-refusal\' // BILLING-F5-USAGE\nimport { extra } from \'@/lib/extra\'\n') }))

// the wire lib
await wireMutant('the answer rule ignores the flag', 'if (!STUDIO_AGENT_MODE_ENABLED || !agentAnswerOpenCard(state, answer, nowMs)) return', 'if (!agentAnswerOpenCard(state, answer, nowMs)) return')
await wireMutant('the answer rule ignores whether the card is open', 'if (!STUDIO_AGENT_MODE_ENABLED || !agentAnswerOpenCard(state, answer, nowMs)) return', 'if (!STUDIO_AGENT_MODE_ENABLED) return')
await wireMutant('the card is marked answered before the send', "  if (!send(answer)) { notSent(); return 'not_sent' }\n  mark(agentAnswered(answer))\n", "  mark(agentAnswered(answer))\n  if (!send(answer)) { notSent(); return 'not_sent' }\n")
await wireMutant('the card is marked answered even when the send failed', "if (!send(answer)) { notSent(); return 'not_sent' }", "if (!send(answer)) { mark(agentAnswered(answer)); notSent(); return 'not_sent' }")
await wireMutant('a failed send says nothing', "if (!send(answer)) { notSent(); return 'not_sent' }", "if (!send(answer)) { return 'not_sent' }")
await wireMutant('the answer is sent twice', "  mark(agentAnswered(answer))\n  return 'sent'", "  send(answer)\n  mark(agentAnswered(answer))\n  return 'sent'")
await wireMutant('the answer rule reads the clock wrongly (the expiry is ignored)', 'agentAnswerOpenCard(state, answer, nowMs)', 'agentAnswerOpenCard(state, answer, 0)')
await wireMutant('the reset does not clear a run', 'return state.status === \'idle\' && state.runId === null ? state : initialAgentRunState()', 'return state')
await wireMutant('the reset always makes a new state (a re-render for nothing)', 'return state.status === \'idle\' && state.runId === null ? state : initialAgentRunState()', 'return initialAgentRunState()')
await wireMutant('the reducer drops a frame', 'return agentRunReducer(frame !== null && frame.payload.run_id !== state.runId ? initialAgentRunState() : state, action)', 'return state')
await wireMutant('a finished run reads another run\'s frame as stale again (the refusal after done shows nothing)', 'frame !== null && frame.payload.run_id !== state.runId ? initialAgentRunState() : state', 'state')
await wireMutant('a finished run takes a late frame of its own run as a new one', 'frame !== null && frame.payload.run_id !== state.runId ? initialAgentRunState() : state', 'frame !== null ? initialAgentRunState() : state')
await wireMutant('a run that is live is reset by another run\'s frame', 'const frame = agentRunOver(state) ? readAgentFrame(action) : null', 'const frame = readAgentFrame(action)')
await wireMutant('only a done run lets the next run\'s frame in (a failed one does not)', "state.status === 'done' || state.status === 'failed'", "state.status === 'done'")
await wireMutant('only a failed run lets the next run\'s frame in (a done one does not)', "state.status === 'done' || state.status === 'failed'", "state.status === 'failed'")
await wireMutant('a stopped run counts as over', "state.status === 'done' || state.status === 'failed'", "state.status === 'done' || state.status === 'failed' || state.status === 'stopped'")
await wireMutant('a stopped run is not "in progress"', "|| state.status === 'paused' || state.status === 'stopped'", "|| state.status === 'paused'")
await wireMutant('an estimate is not "in progress"', "state.status === 'estimate' || state.status === 'running'", "state.status === 'running'")
await wireMutant('a move to another session is not a move', 'previous !== null && previous !== next', 'false')
await wireMutant('the first save of a new chat is a move', 'previous !== null && previous !== next', 'previous !== next')
await wireMutant('the key follows a run\'s credits', "[state.runId, state.status, state.estimate ?", "[state.runId, state.status, state.usedCredits, state.estimate ?")
await wireMutant('the failed-send words talk about credits', "nothing was sent. Try again in a moment.", "nothing was charged. Try again in a moment.")
await wireMutant('the failed-send words give no next step', "The connection is not ready, so nothing was sent. Try again in a moment.", "The connection is not ready, so nothing was sent.")
await wireMutant('the control mark names the wrong request', "stop: 'stop_requested'", "stop: 'pause_requested'")
await wireMutant('the wire lib reads a flag itself', "export const AGENT_WIRE_RESET = 'agent_wire_reset'", "export const AGENT_WIRE_RESET = 'agent_wire_reset'\nexport const X = process.env.NEXT_PUBLIC_AGENT_MODE === 'true'")
await wireMutant('the wire lib fetches', "export const AGENT_WIRE_RESET = 'agent_wire_reset'", "export const AGENT_WIRE_RESET = 'agent_wire_reset'\nvoid fetch('/x')")

// no Agent start from voice (H): each is one edit of the real sources, fed to every H check (the paths, the wire, the flags, the real call)
const TEXT0 = { [PAGE]: PAGE_TEXT, [HOOK]: HOOK_TEXT, [WIRE]: WIRE_TEXT }, text0 = rel => TEXT0[rel] ?? read(rel)
const voiceMutant = (label, rel, from, to) => mutant(`voice: ${label}`, async () => { const texts = { [rel]: swap(text0(rel), from, to) }; voiceInventoryChecks(texts); voiceChecks(texts); voiceFlagsOffChecks(texts); standardSaidChecks(texts); await voiceAcceptChecks(texts) })
const GUARD_LINE = lineWith(HOOK_TEXT, "message.data.build_mode === 'agent') message.data.build_mode = 'standard'"), VOICE_FIELDS_LINE = lineWith(HOOK_TEXT, 'addVoiceCallFields(message.data as unknown as Record<string, unknown>, text); // VOICE-CALL')
const ENTRY_SEND = 'STUDIO_AGENT_MODE_ENABLED && voiceOriginatedSend(messageText) ? agentVoiceModeRef : agentBuildModeRef', ENTRY_ACTION = 'STUDIO_AGENT_MODE_ENABLED && voiceOriginatedSend(action.label) ? agentVoiceModeRef : agentBuildModeRef'
// the page: the two handlers' entry lines, the voice ref, the four sends
await voiceMutant('handleSendMessage has no guard (every send reads the picker\'s mode)', PAGE, ENTRY_SEND, 'agentBuildModeRef')
await voiceMutant('handleActionClick has no guard (a spoken yes presses the button with Agent)', PAGE, ENTRY_ACTION, 'agentBuildModeRef')
await voiceMutant('handleSendMessage\'s guard never fires', PAGE, ENTRY_SEND, 'STUDIO_AGENT_MODE_ENABLED && false ? agentVoiceModeRef : agentBuildModeRef')
await voiceMutant('handleActionClick\'s guard never fires', PAGE, ENTRY_ACTION, 'STUDIO_AGENT_MODE_ENABLED && false ? agentVoiceModeRef : agentBuildModeRef')
await voiceMutant('the guard is inverted in handleSendMessage (voice words read the picker\'s mode, typed ones the voice\'s)', PAGE, ENTRY_SEND, 'STUDIO_AGENT_MODE_ENABLED && voiceOriginatedSend(messageText) ? agentBuildModeRef : agentVoiceModeRef')
await voiceMutant('the guard is inverted in handleActionClick', PAGE, ENTRY_ACTION, 'STUDIO_AGENT_MODE_ENABLED && voiceOriginatedSend(action.label) ? agentBuildModeRef : agentVoiceModeRef')
await voiceMutant('handleSendMessage asks after an await (a call that ends while the send waits is not caught)', PAGE, '    if (!messageText) return\n    const agentModeRef', '    if (!messageText) return\n    await Promise.resolve()\n    const agentModeRef')
await voiceMutant('handleActionClick asks after an await', PAGE, "answerKey: string = actionRequestMessageId) => {\n    const agentModeRef", "answerKey: string = actionRequestMessageId) => {\n    await Promise.resolve()\n    const agentModeRef")
await voiceMutant('the voice ref is the picker\'s mode', PAGE, 'agentVoiceModeRef.current = STUDIO_AGENT_MODE_ENABLED ? voiceBuildMode(buildModeWire, agentPlan) : undefined', 'agentVoiceModeRef.current = buildModeWire')
await voiceMutant('the voice ref is never written (it stays empty: no reset of a sticky opt-in)', PAGE, 'agentVoiceModeRef.current = STUDIO_AGENT_MODE_ENABLED ? voiceBuildMode(buildModeWire, agentPlan) : undefined', 'void agentVoiceModeRef')
await voiceMutant('the voice ref ignores the plan', PAGE, 'voiceBuildMode(buildModeWire, agentPlan)', "voiceBuildMode(buildModeWire, 'pro')")
for (const ind of ['          ', '              ', '        ', '            ']) await voiceMutant(`the ${ind.length}-space build send reads the picker's ref, unguarded`, PAGE, `${ind}...buildSendOptions,\n${ind}...(agentModeRef.current ? { buildMode: agentModeRef.current } : {}), // AGENT-MODE-WIRE\n`, `${ind}...buildSendOptions,\n${ind}...(agentBuildModeRef.current ? { buildMode: agentBuildModeRef.current } : {}), // AGENT-MODE-WIRE\n`)
// Standard is said out loud (H5): each is one edit of the real sources, fed to the H5 checks and the voice checks that read the same lines
const standardMutant = (label, rel, from, to) => mutant(`standard: ${label}`, () => { const texts = { [rel]: swap(text0(rel), from, to) }; standardSaidChecks(texts); voiceChecks(texts); voiceFlagsOffChecks(texts) })
const TYPED_BODY = "if (!STUDIO_AGENT_MODE_ENABLED || wire !== undefined) return wire\n  return agentEligible(plan) ? 'standard' : undefined", TYPED_REF = 'agentBuildModeRef.current = STUDIO_AGENT_MODE_ENABLED ? typedBuildMode(buildModeWire, agentPlan) : undefined'
// the wire lib
await standardMutant('Standard omits the key (the reload gap: a sticky Agent opt-in stays)', WIRE, TYPED_BODY, 'return wire')
await standardMutant('Standard omits the key for everyone', WIRE, TYPED_BODY, "if (!STUDIO_AGENT_MODE_ENABLED || wire !== undefined) return wire\n  return undefined")
await standardMutant('Standard sends the key on a free plan too', WIRE, TYPED_BODY, "if (!STUDIO_AGENT_MODE_ENABLED || wire !== undefined) return wire\n  return 'standard'")
await standardMutant('Standard sends the key on Pro only (not Max)', WIRE, TYPED_BODY, "if (!STUDIO_AGENT_MODE_ENABLED || wire !== undefined) return wire\n  return plan === 'pro' ? 'standard' : undefined")
await standardMutant('Standard sends the key on an unknown plan (a plan not loaded yet)', WIRE, TYPED_BODY, "if (!STUDIO_AGENT_MODE_ENABLED || wire !== undefined) return wire\n  return plan === 'free' || plan === 'starter' ? undefined : 'standard'")
await standardMutant('Author is rewritten to "standard"', WIRE, TYPED_BODY, "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'agent' || wire === 'standard') return wire\n  return agentEligible(plan) ? 'standard' : undefined")
await standardMutant('Agent is rewritten to "standard"', WIRE, TYPED_BODY, "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author' || wire === 'standard') return wire\n  return agentEligible(plan) ? 'standard' : undefined")
await standardMutant('a plan without Agent loses an explicit mode (Author, or the reset after it)', WIRE, TYPED_BODY, "if (!STUDIO_AGENT_MODE_ENABLED || wire !== undefined) return agentEligible(plan) ? wire : undefined\n  return agentEligible(plan) ? 'standard' : undefined")
await standardMutant('the function ignores the flags', WIRE, TYPED_BODY, "if (wire !== undefined) return wire\n  return agentEligible(plan) ? 'standard' : undefined")
await standardMutant('the function says "agent"', WIRE, TYPED_BODY, "if (!STUDIO_AGENT_MODE_ENABLED || wire !== undefined) return wire\n  return agentEligible(plan) ? 'agent' : undefined")
// the page: the one line that writes the typed ref
await standardMutant('the typed ref is the picker\'s raw mode (Standard omits the key)', PAGE, TYPED_REF, 'agentBuildModeRef.current = buildModeWire')
await standardMutant('the typed ref ignores the plan (a free plan sends the key)', PAGE, 'typedBuildMode(buildModeWire, agentPlan)', "typedBuildMode(buildModeWire, 'pro')")
await standardMutant('the typed ref rewrites Author', PAGE, 'typedBuildMode(buildModeWire, agentPlan)', "typedBuildMode(buildModeWire === 'author' ? undefined : buildModeWire, agentPlan)")
await standardMutant('the voice ref follows the typed one (voice would start Agent)', PAGE, 'agentVoiceModeRef.current = STUDIO_AGENT_MODE_ENABLED ? voiceBuildMode(buildModeWire, agentPlan) : undefined', 'agentVoiceModeRef.current = STUDIO_AGENT_MODE_ENABLED ? typedBuildMode(buildModeWire, agentPlan) : undefined')
// the hook
await voiceMutant('the hook has no voice line', HOOK, GUARD_LINE + '\n', '')
await voiceMutant('the hook\'s voice line is inverted (it turns "standard" into "standard" only for typed messages)', HOOK, ".mode === 'voice' && message.data.build_mode === 'agent'", ".mode !== 'voice' && message.data.build_mode === 'agent'")
await voiceMutant('the hook\'s voice line turns only "standard" (the wrong mode)', HOOK, "message.data.build_mode === 'agent') message.data.build_mode = 'standard'", "message.data.build_mode === 'standard') message.data.build_mode = 'standard'")
await voiceMutant('the hook\'s voice line drops the key instead of resetting', HOOK, "message.data.build_mode === 'agent') message.data.build_mode = 'standard'", "message.data.build_mode === 'agent') delete message.data.build_mode")
await voiceMutant('the hook\'s voice line sits before the line that marks the voice turn (the message is not voice yet)', HOOK, VOICE_FIELDS_LINE + '\n' + GUARD_LINE, GUARD_LINE + '\n' + VOICE_FIELDS_LINE)
await voiceMutant('the hook\'s voice line ignores the flags', HOOK, 'if (STUDIO_AGENT_MODE_ENABLED && (message.data as unknown as Record<string, unknown>).mode === \'voice\'', 'if ((message.data as unknown as Record<string, unknown>).mode === \'voice\'')
// the wire lib
await voiceMutant('voiceOriginatedSend is always false', WIRE, 'voiceCallBus.pending !== null && voiceCallBus.pending.text === text', 'false')
await voiceMutant('voiceOriginatedSend is always true (a typed send while a call is on reads the voice mode)', WIRE, 'voiceCallBus.pending !== null && voiceCallBus.pending.text === text', 'true')
await voiceMutant('voiceOriginatedSend takes any armed words, not the handler\'s own', WIRE, 'voiceCallBus.pending !== null && voiceCallBus.pending.text === text', 'voiceCallBus.pending !== null')
await voiceMutant('voiceOriginatedSend spends the armed turn (the hook then cannot mark it voice)', WIRE, 'export const voiceOriginatedSend = (text: string): boolean => voiceCallBus.pending !== null && voiceCallBus.pending.text === text', 'export const voiceOriginatedSend = (text: string): boolean => { const hit = voiceCallBus.pending !== null && voiceCallBus.pending.text === text; voiceCallBus.pending = null; return hit }')
await voiceMutant('voiceBuildMode passes the picker\'s mode through', WIRE, "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire\n  return agentEligible(plan) ? 'standard' : undefined", "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire\n  return wire")
await voiceMutant('voiceBuildMode leaves the key out for everyone (a sticky Agent opt-in stays)', WIRE, "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire\n  return agentEligible(plan) ? 'standard' : undefined", "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire\n  return undefined")
await voiceMutant('voiceBuildMode sends "standard" for every plan', WIRE, "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire\n  return agentEligible(plan) ? 'standard' : undefined", "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire\n  return 'standard'")
await voiceMutant('voiceBuildMode rewrites Author too', WIRE, "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire", 'if (!STUDIO_AGENT_MODE_ENABLED) return wire')
await voiceMutant('voiceBuildMode ignores the flags', WIRE, "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire", "if (wire === 'author') return wire")
await voiceMutant('voiceBuildMode says "agent" for a plan that has it', WIRE, "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire\n  return agentEligible(plan) ? 'standard' : undefined", "if (!STUDIO_AGENT_MODE_ENABLED || wire === 'author') return wire\n  return agentEligible(plan) ? 'agent' : undefined")
// the real call and the paths
await voiceMutant('the call stops arming the words on the bus (the page cannot tell a voice send)', VOICE_CTL, '    armVoiceTurn(words)\n', '')
await voiceMutant('a second place arms the bus', 'hooks/use-studio-voice-call.ts', 'const noopSubscribe = () => () => {}', "const noopSubscribe = () => () => {}\nconst armElsewhere = () => armVoiceTurn('x')")
await voiceMutant('the call names a build mode', VOICE_CTL, 'private readonly sendTurn:', "private readonly build_mode = 'agent'\n  private readonly sendTurn:")
await voiceMutant('the Director call sends', 'hooks/use-studio-director-call.ts', '/** Shared projection only', 'void sendMessage\n/** Shared projection only')
await voiceMutant('the Director call presses a card', 'components/builder/voice-interactive/use-director-call.ts', 'export function useDirectorCall', 'const pressCard = (el: HTMLElement) => el.click()\nexport function useDirectorCall')
await voiceMutant('the call is mounted with a third handler that sends', PAGE, 'sendAction: handleActionClick,', 'sendAction: handleActionClick, sendExtra: handleSendMessage,')

// the strip and the registry
const stripLine = needle => { const found = STRIP_TEXT.split('\n').filter(line => line.includes(needle)); assert.equal(found.length, 1, `the strip has one line with ${needle}`); return found[0] }
const dataModule = text => import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
await mutant('strip: it puts nothing back', async () => { const m = await dataModule(swap(STRIP_TEXT, 'return (Object.prototype.hasOwnProperty.call(AGENT_MODE_WIRE_ALL_EDITS, rel) ? AGENT_MODE_WIRE_ALL_EDITS[rel] : []).reduce((out, [has, was]) => putBackLine(out, has, was), text)', 'return text')); sourceChecks({}, m.stripAgentModeWire) })
await mutant('strip: it touches a file it does not own', async () => { const m = await dataModule(swap(STRIP_TEXT, 'if (!Object.prototype.hasOwnProperty.call(AGENT_MODE_WIRE_ALL_EDITS, rel)) return text', "if (rel === 'package.json') return text.toUpperCase()")); sourceChecks({}, m.stripAgentModeWire) })
await mutant('strip: a pair for the hook is missing', async () => { const m = await dataModule(swap(STRIP_TEXT, `${stripLine('    sendAgentAnswer, // AGENT-MODE-WIRE')}\n`, '')); sourceChecks({}, m.stripAgentModeWire) })
await mutant('strip: a pair for the page is missing', async () => { const m = await dataModule(swap(STRIP_TEXT, `${stripLine("const [buildMode, setBuildMode] = useState<BuildMode>('standard')")}\n`, '')); sourceChecks({}, m.stripAgentModeWire) })
await mutant('strip: a pair puts back a changed line (the shell proof\'s)', async () => { const m = await dataModule(swap(STRIP_TEXT, "assert.equal(git('diff', '--stat'", "assert.equal(git('diff', '--shortstat'")); sourceChecks({}, m.stripAgentModeWire) })
await mutant('strip: a subject filter pair is missing (the element-edit proof)', async () => { const m = await dataModule(swap(STRIP_TEXT, "  'scripts/test-studio-chat-element-edit.mjs': [[PIN_LINE, '']],\n", '')); sourceChecks({}, m.stripAgentModeWire) })
await mutant('strip: the base is not #607\'s head (a line of #607\'s taken for ours)', () => { const text = baseText(HOOK).replace('\n', '\n// AGENT-MODE-WIRE a line that was never added\n'); assert.equal(stripAgentModeWire(HOOK, text), baseText(HOOK), 'a line the strip does not know is left in, so the base is not restored') })
await mutant('strip: the pair for the hook\'s voice line is missing', async () => { const m = await dataModule(swap(STRIP_TEXT, `${stripLine("message.data.build_mode === 'agent') message.data.build_mode = 'standard'")}\n`, '')); sourceChecks({}, m.stripAgentModeWire) })
await mutant('strip: the pair for a handler\'s entry line is missing', async () => { const m = await dataModule(swap(STRIP_TEXT, `${stripLine('voiceOriginatedSend(messageText)')}\n`, '')); sourceChecks({}, m.stripAgentModeWire) })
await mutant('strip: the pair for the voice ref is missing', async () => { const m = await dataModule(swap(STRIP_TEXT, `${stripLine('const agentVoiceModeRef = useRef')}\n`, '')); sourceChecks({}, m.stripAgentModeWire) })
await mutant('registry: a line is missing', () => registryChecks(read(REGISTRY).split('\n').filter(l => !l.includes('stripAgentModeWire')).join('\n')))
await mutant('registry: a base line is lost', () => registryChecks(read(REGISTRY).split('\n').filter(l => !l.includes('studio-agent-mode-shell-strip.mjs') || l.includes('wire')).join('\n')))
await mutant('registry: our line is not at the end of its list (the end line comes before it)', () => { const lines = read(REGISTRY).split('\n'), at = lines.findIndex(l => l.includes('studio-agent-mode-wire-strip.mjs')); [lines[at], lines[at + 1]] = [lines[at + 1], lines[at]]; registryChecks(lines.join('\n')) })
await mutant('registry: our line comes BEFORE #607\'s in its list (an order, not an adjacency)', () => { const lines = read(REGISTRY).split('\n'), at = lines.findIndex(l => l.includes('studio-agent-mode-wire-strip.mjs')), shell = lines.findIndex((l, i) => i < at && l.includes('studio-agent-mode-shell-strip.mjs') && l.includes('SCOPE_FILES')); const [own] = lines.splice(at, 1); lines.splice(shell, 0, own); registryChecks(lines.join('\n')) })
await mutant('env: a block of this change in .env.example', () => sourceChecks({ '.env.example': `${committed('.env.example')}\n# Agent mode wire (AGENT-MODE-WIRE)\nNEXT_PUBLIC_AGENT_MODE_WIRE=\"false\"\n` }))
await mutant('registry: a line in the env list (no block exists)', () => { const lines = read(REGISTRY).split('\n'), at = lines.findIndex(l => l.includes('(await import(\'./studio-agent-mode-shell-strip.mjs\')).AGENT_MODE_SHELL_ENV_BLOCK')); lines.splice(at + 1, 0, "  (await import('./studio-agent-mode-wire-strip.mjs')).AGENT_MODE_WIRE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, Agent mode wire"); registryChecks(lines.join('\n')) })
await mutant('registry: the marker comment changed', () => registryChecks(read(REGISTRY).replace('// LATER-CHANGE: FRONTEND-1, Agent mode wire (', '// LATER-CHANGE: FRONTEND-1, wiring (')))
// the restack: positive control above (F3); each of these is a restack that must still FAIL
await mutant('restack: a subject filter nobody registered (a chain line no strip reads out) is not this change\'s', () => restackChecks(undefined, undefined, Object.fromEntries(CHAIN_PINS.map(rel => [rel, restackedProofs()[rel].replace(chainFilter('three'), chainFilter('three') + chainFilter('four'))]))))
await mutant('restack: a line in the registry that is neither this change\'s nor a registered change\'s', () => restackChecks(restackedRegistry().replace(/^(.*studio-agent-mode-wire-strip\.mjs.*SCOPE_FILES.*)$/m, "  console.log('stray registry line')\n$1")))
await mutant('restack: this change\'s strip is registered BEFORE #607\'s (not an order)', () => { const reg = restackedReg(), list = reg.LATER_STRIPS.filter(fn => fn !== stripAgentModeWire), at = list.findIndex(fn => typeof fn === 'function' && fn.name === 'stripAgentModeShell'); list.splice(at, 0, stripAgentModeWire); restackChecks(undefined, { ...reg, LATER_STRIPS: list }) })
await mutant('restack: a line that is not a registered change\'s follows this change\'s at the end of its list', () => restackChecks(restackedRegistry().replace(/^(.*studio-agent-mode-wire-strip\.mjs.*stripAgentModeWire.*)$/m, "$1\n  console.log('after ours')")))
await mutant('restack: the chain\'s lines are not read out of the older proof (a base line is lost behind them, or a line is left)', () => restackChecks(undefined, undefined, undefined, []))
// #607's own files and proof, edited in place: nothing weaker than a byte for byte strip, and every changed line marked
const SHELL_CARD = 'components/builder/agent-mode/agent-estimate-card.tsx', SHELL_WORDS = 'lib/studio-agent-mode.ts'
await mutant('in place: a pair for #607\'s estimate card is missing (the strip leaves a line of ours in it)', async () => { const m = await dataModule(swap(STRIP_TEXT, `${stripLine('line is not here, the card does not read expires_at')}\n`, '')); sourceChecks({}, m.stripAgentModeWire) })
await mutant('in place: a pair for #607\'s words is missing', async () => { const m = await dataModule(swap(STRIP_TEXT, `${stripLine("estimateRunning: 'Running', // AGENT-MODE-WIRE")}\n`, '')); sourceChecks({}, m.stripAgentModeWire) })
await mutant('in place: a pair for #607\'s proof is missing (the weak path: "its one registered line")', async () => { const m = await dataModule(swap(STRIP_TEXT, `${stripLine('a Start button comes back on the estimate card')}\n`, '')); sourceChecks({}, m.stripAgentModeWire) })
await mutant('in place: a line of #607\'s card is rewritten without the marker', () => sourceChecks({ [SHELL_CARD]: swap(read(SHELL_CARD), 'import { AgentActionButton, AgentActions, AgentCardFrame, AgentCardText, type AgentCardCallbacks } from "./agent-card-parts"\n', 'import { AgentActionButton, AgentActions, AgentCardFrame, AgentCardText, type AgentCardCallbacks } from "./agent-card-parts-x"\n') }))
await mutant('in place: a line of ours in #607\'s card is not marked (the Stop button)', () => sourceChecks({ [SHELL_CARD]: swap(read(SHELL_CARD), '{AGENT_COPY.stop}</AgentActionButton>{/* AGENT-MODE-WIRE */}', '{AGENT_COPY.stop}</AgentActionButton>') }))
await mutant('in place: a line of ours in #607\'s words is not marked', () => sourceChecks({ [SHELL_WORDS]: swap(read(SHELL_WORDS), "estimateRunning: 'Running', // AGENT-MODE-WIRE", "estimateRunning: 'Running',") }))
await mutant('in place: a marked line of ours that no pair puts back (an extra line in the card)', () => sourceChecks({ [SHELL_CARD]: swap(read(SHELL_CARD), 'import React from "react"\n', 'import React from "react"\nvoid 0 // AGENT-MODE-WIRE\n') }))
await mutant('in place: a line of #607\'s is removed from the card without a trace', () => sourceChecks({ [SHELL_CARD]: swap(read(SHELL_CARD), '"use client"\n\n', '') }))
await mutant('in place: a line of #607\'s proof is changed without the mark', () => sourceChecks({ [SHELL_PROOF]: swap(read(SHELL_PROOF), 'const count = (text, needle) => text.split(needle).length - 1\n', 'const count = (text, needle) => text.split(needle).length - 2\n') }))
await mutant('in place: a changed line of #607\'s proof carries the marker but not the registry-read mark', () => sourceChecks({ [SHELL_PROOF]: swap(read(SHELL_PROOF), 'function proveEstimateInfo(texts = {}) { // LATER-CHANGES: registry read (AGENT-MODE-WIRE)\n', 'function proveEstimateInfo(texts = {}) { // AGENT-MODE-WIRE\n') }))
await mutant('in place: a line of #607\'s proof is removed without a trace', () => sourceChecks({ [SHELL_PROOF]: swap(read(SHELL_PROOF), 'const count = (text, needle) => text.split(needle).length - 1\n', '') }))
await mutant('scope: a stray file in a commit fails the scope check, a commit message without the subject or the co-author line is named; a polluted working tree is not read', () => {
  const own = ownCommits(); assert.doesNotThrow(() => scopeCheck(own), 'the real tree passes')
  assert.throws(() => scopeCheck(own, ['stray-agent-mode-wire.txt']), undefined, 'a stray file fails the scope check')
  assert.throws(() => scopeCheck(own, ['components/builder/message-list.tsx']), undefined, 'an app file nobody registered fails it too')
  assert.throws(() => assert.deepEqual(messageProblems('Agent mode wire: a change', 'body\n'), []), undefined, 'no co-author line')
  assert.throws(() => assert.deepEqual(messageProblems('Fix the page', 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []), undefined, 'another subject')
  assert.deepEqual(messageProblems('Agent mode wire: a change', 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [], 'a good message has no problem')
  assert.fail('caught (the scope check is the real tree\'s and passed; the failures above were each expected)')
})
await mutant('fixture: a reformatted contract fixture is not the contract the lines are cited from', () => { const lines = FIXTURE_TEXT.split('\n'); lines.splice(10, 0, ''); const shifted = lines.join('\n').split('\n'); assert.match(shifted[CITED.answerBlock - 1], /^  "answer": \{/, 'the cited line is where the answer block is') })

console.log(`\n${failed.length ? 'FAILED' : 'PASS'}: ${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed${missed.length ? ` (${missed.join(' | ')})` : ''}`)
process.exit(failed.length || missed.length ? 1 : 0)
