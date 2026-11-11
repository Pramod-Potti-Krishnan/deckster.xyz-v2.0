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
//     line is run); one frame per card, then the card is answered; an estimate past its expires_at, an answered card, another run's card and an A6 fallback that was not offered send nothing; a socket that is not live leaves the card open and says so
//     with the next step; Agent is disabled below Pro, a plan that is not loaded, and while a run is in progress; sendAgentAnswer has exactly one caller;
//  E. the page: every mount and option is gated, the plan comes from the signed-in session (never a frame), the four build sends carry build_mode, a session change clears the run and the mode and the first save of a new chat does not, a failure to send
//     (an answer or a Pause / Resume / Stop) is said in plain words with the next step, and the lib's own functions;
//  F. the sources: every line this change adds to the hook and the page carries the marker and is a pure insertion (no base line is rewritten or removed), the strip puts #607's head back byte for byte (two app files, three older proofs), the registry
//     (two lines, at the true end of the files and strips lists, none in the env list), .env.example untouched;
//  G. scope, read from the COMMITTED diff only (never the working tree): own commits by subject, each with the co-author line; the files they touch are this change's scope; a stray untracked file changes nothing;
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

const { STACK_BASE, BASE_COMMIT, AGENT_MODE_WIRE_SCOPE_FILES: SCOPE, AGENT_MODE_WIRE_NEW_FILES: NEW_FILES, AGENT_MODE_WIRE_APP_FILES: APP_FILES, AGENT_MODE_WIRE_PIN_FILES: PIN_FILES, AGENT_MODE_WIRE_ALL_EDITS: ALL_EDITS, AGENT_MODE_WIRE_MARKER_RE: MARKER_RE, AGENT_MODE_WIRE_SUBJECT: SUBJECT, AGENT_MODE_WIRE_PIN_MARK: PIN_MARK, stripAgentModeWire } = stripModule

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
  for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, base + ext))) return base + ext
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
  vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), { module, exports: module.exports, require: req, process: { env: { ...env } }, setTimeout, clearTimeout, fetch: () => assert.fail(`${rel} fetched`) }, { filename: rel })
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
  assert.notEqual(mounted.element, null); const markup = renderToStaticMarkup(mounted.element); assert.match(textOf(markup), /About 470 credits · cap 600 credits/, 'the estimate card is drawn')
  deepEqual(mounted.spies.sent, [], 'drawing the estimate sends nothing'); deepEqual(mounted.spies.dispatched, [])
  const inside = cardsInside(mounted.element); assert.ok(inside, 'the cards element carries onAnswer and onControl')
  buttonOf(inside, 'start').props.onClick()
  deepEqual(mounted.spies.sent, [answerOf('A1', 'start')], 'Start: exactly one answer, A1 start'); assert.equal(mounted.spies.dispatched.length, 1, 'and the card is marked answered once'); deepEqual(mounted.spies.toasts, [])
  // the same state again (a second click before the card re-draws, or one after it did) sends nothing more
  const answeredState = wire.agentWireReducer(open, mounted.spies.dispatched[0])
  const second = pageCards({ text: page, wireText, state: answeredState }); buttonOf(cardsInside(second.element), 'start').props.onClick(); deepEqual(second.spies.sent, [], 'an answered card: a second click sends nothing')
  // Cancel sends A1 cancel and clears the run
  const cancel = pageCards({ text: page, wireText, state: open }); buttonOf(cardsInside(cancel.element), 'cancel').props.onClick(); deepEqual(cancel.spies.sent, [answerOf('A1', 'cancel')]); assert.equal(wire.agentWireReducer(open, cancel.spies.dispatched[0]).status, 'idle', 'Cancel clears the run')
  // 4. an estimate past its expires_at: Start sends nothing (Cancel still goes); the fixture's own example has long expired
  const expired = stateOf(ENV_ON, [wireFrame('agent_estimate')]); const exp = pageCards({ text: page, wireText, state: expired }); buttonOf(cardsInside(exp.element), 'start').props.onClick(); deepEqual(exp.spies.sent, [], 'an expired estimate: Start sends nothing'); deepEqual(exp.spies.toasts, [], '... and says nothing is wrong with the connection')
  buttonOf(cardsInside(exp.element), 'cancel').props.onClick(); deepEqual(exp.spies.sent, [answerOf('A1', 'cancel')], 'Cancel still goes')
  // 4b. the rule itself (the card guards the click too): before expires_at an A1 start goes, from the instant on it does not, Cancel always does
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
  const down = pageCards({ text: page, wireText, state: open, send: () => false }); buttonOf(cardsInside(down.element), 'start').props.onClick()
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
  // 9. the build mode rides the four build sends and nothing else: each `...buildSendOptions,` is followed by the marked line, and the memo that holds them is untouched
  const lines = page.split('\n'), at = lines.map((l, i) => (/^\s*\.\.\.buildSendOptions,$/.test(l) ? i : -1)).filter(i => i >= 0); assert.equal(at.length, 4, 'four build sends')
  for (const i of at) assert.equal(lines[i + 1].trim(), '...(agentBuildModeRef.current ? { buildMode: agentBuildModeRef.current } : {}), // AGENT-MODE-WIRE', `the send at line ${i + 1} carries the build mode`)
  assert.equal(count(page, 'agentBuildModeRef.current = buildModeWire'), 1, 'the ref is written once per render, from the one buildModeWire')
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
  assert.equal(wire.agentCardsKey(idle), ''); const k1 = wire.agentCardsKey(runOf(lib, [estimateNow()])), k2 = wire.agentCardsKey(running), k3 = wire.agentCardsKey(runOf(lib, [estimateNow(), wireFrame('agent_step'), wireFrame('agent_checkpoint')]))
  assert.ok(k1 && k2 && k3 && new Set([k1, k2, k3]).size === 3, 'the key changes when a card appears or goes')
  assert.equal(wire.agentCardsKey(runOf(lib, [estimateNow(), wireFrame('agent_step')])), wire.agentCardsKey(runOf(lib, [estimateNow(), wireFrame('agent_step'), wireFrame('agent_step', { step: 2, label: 'Building slide 2', credits_used: 500 })])), 'a run\'s progress (another step, more credits used) does not pull the chat')
  assert.equal(wire.agentSessionChanged(null, 'A'), false); assert.equal(wire.agentSessionChanged('A', 'A'), false); assert.equal(wire.agentSessionChanged('A', 'B'), true); assert.equal(wire.agentSessionChanged('A', null), true); assert.equal(wire.agentSessionChanged(null, null), false)
  // the words: plain, with the next step, no leak words, no currency
  const words = [wire.AGENT_WIRE_COPY.answerNotSent, wire.AGENT_WIRE_COPY.controlNotSent('pause'), wire.AGENT_WIRE_COPY.controlNotSent('resume'), wire.AGENT_WIRE_COPY.controlNotSent('stop')].flatMap(w => [w.title, w.description])
  for (const w of words) { assert.equal(lib.plainWords(w, 'LEAK'), w, `plain: ${w}`); assert.doesNotMatch(w, /\$|credit|charge|price|cost/i, `no money talk in a transport failure: ${w}`) }
  deepEqual(wire.AGENT_WIRE_CONTROL_MARK, { pause: 'pause_requested', resume: 'resume_requested', stop: 'stop_requested' })
  // the wire lib is pure: its only import is #607's lib, no top-level effect, no network
  assert.equal(count(wireText, "from '@/lib/studio-agent-mode'"), 1); assert.equal(/^import /m.test(wireText.replace(/^import \{[^}]*\} from '@\/lib\/studio-agent-mode'\n/m, '')), false, 'one import: #607\'s lib'); assert.doesNotMatch(wireText, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.|window\./, 'no network, storage or DOM in the wire lib')
  // the hook: build_mode is the optional key of a user message and of the send options, and only that; the option type is optional
  assert.match(hook, /build_mode\?: 'standard' \| 'author' \| 'agent'; \/\/ AGENT-MODE-WIRE/); assert.match(hook, /\n  buildMode\?: 'standard' \| 'author' \| 'agent'; \/\/ AGENT-MODE-WIRE/); assert.equal(count(hook, '...(options?.buildMode && { build_mode: options.buildMode }), // AGENT-MODE-WIRE'), 1)
  assert.match(hook, /onAgentFrame\?: \(frame: unknown, owner: \{ sessionId: string \| null; isCurrent: \(\) => boolean \}\) => void; \/\/ AGENT-MODE-WIRE/)
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
function sourceChecks(texts = {}, strip = stripAgentModeWire, shown = {}) {
  const now = rel => texts[rel] ?? shown[rel] ?? committed(rel)
  // the two app files: every added line carries the marker, none is a rewrite, the strip gives #607's head back byte for byte
  for (const rel of APP_FILES) {
    const { added, baseKept } = insertionsOf(baseText(rel), now(rel)); assert.ok(baseKept, `${rel}: every base line is kept, in order (this change rewrites and removes none)`)
    assert.ok(added.length > 0, `${rel}: lines are added`); for (const line of added) assert.match(line, MARKER_RE, `${rel}: an added line without the marker: ${line.slice(0, 90)}`)
    assert.equal(added.length, ALL_EDITS[rel].length, `${rel}: one [has, was] pair per added line`); for (const [has, was] of ALL_EDITS[rel]) { assert.equal(was, '', `${rel}: a pure insertion`); assert.ok(MARKER_RE.test(has) && has.endsWith('\n'), `${rel}: the pair line carries the marker`) }
    assert.equal(strip(rel, now(rel)), baseText(rel), `${rel}: the strip puts #607's head back byte for byte`); assert.equal(strip(rel, baseText(rel)), baseText(rel), `${rel}: idempotent on the base`)
    assert.equal(count(now(rel), 'AGENT-MODE-WIRE') >= added.length, true)
  }
  // the older proofs: each [has, was] pair carries the registry-read mark and is in the file once; the two subject filters are pure insertions; the shell's one scope line is the one replaced line; the strip puts #607's head back
  for (const rel of PIN_FILES) {
    const shell = rel === 'scripts/test-studio-agent-mode-shell.mjs', baseLines = baseText(rel).split('\n'), nowLines = now(rel).split('\n')
    for (const [has, was] of ALL_EDITS[rel]) { assert.ok(has.includes(PIN_MARK.replace('// ', '')), `${rel}: the line carries the registry-read mark: ${has.slice(0, 70)}`); assert.equal(now(rel).split('\n').filter(l => l === has.slice(0, -1)).length, 1, `${rel}: in the file once, as a whole line`); assert.equal(was === '', !shell, `${rel}: ${shell ? 'the replaced line' : 'a pure insertion'}`) }
    const only = (a, b) => { const seen = new Map(); for (const l of b) seen.set(l, (seen.get(l) ?? 0) + 1); return a.filter(l => { const n = seen.get(l) ?? 0; if (n > 0) { seen.set(l, n - 1); return false } return true }) }
    assert.equal(only(nowLines, baseLines).length, ALL_EDITS[rel].length, `${rel}: the lines this change has that the base lacks are its pairs'`); assert.equal(only(baseLines, nowLines).length, shell ? 1 : 0, `${rel}: ${shell ? 'exactly one base line is replaced' : 'no base line is lost'}`)
    assert.equal(strip(rel, now(rel)), baseText(rel), `${rel}: the strip puts #607's head back`)
  }
  // the strip: other files untouched, no line of another file is claimed, the pairs are whole lines
  for (const rel of ['lib/studio-agent-mode.ts', 'package.json', '.env.example', REGISTRY]) assert.equal(strip(rel, baseText(rel)), baseText(rel), `${rel}: not this strip's`)
  assert.equal(strip('x.ts', 7), 7); assert.equal(strip('x.ts', 'a\nb\n'), 'a\nb\n')
  // the hook: each of its added lines, one by one, is where the strip says (a pair removed puts back a line the file kept)
  for (const rel of APP_FILES) for (const [has] of ALL_EDITS[rel]) assert.equal(now(rel).split('\n').filter(l => l === has.slice(0, -1)).length, 1, `${rel}: the pair's line is in the file exactly once (as a whole line, indent included): ${has.slice(0, 70)}`)
  // .env.example: this change touches it not at all (the flag's block is #607's), and #607's block still names the flag once
  assert.equal(git('diff', '--name-only', STACK_BASE, 'HEAD', '--', '.env.example').trim(), '', '.env.example is #607\'s byte for byte (no block of this change)'); assert.equal(count(read('.env.example'), 'NEXT_PUBLIC_AGENT_MODE="false"'), 1)
}
const END = '  // one line per later change, above this comment'
function registryChecks(text = read(REGISTRY), reg = registry) {
  const lines = text.split('\n'), section = i => { for (let k = i; k >= 0; k--) { const m = /^export const (LATER_\w+)/.exec(lines[k]); if (m) return m[1] } return null }
  const own = lines.map((l, i) => [l, i]).filter(([l]) => l.includes('studio-agent-mode-wire-strip.mjs'))
  assert.equal(own.length, 2, 'two registry lines name this change\'s strip module'); deepEqual(own.map(([, i]) => section(i)), ['LATER_CHANGE_FILES', 'LATER_STRIPS'], 'one in the files list and one in the strips list; the env list gets none (no block)')
  for (const [line, i] of own) { assert.match(line, /\/\/ LATER-CHANGE: FRONTEND-1, Agent mode wire/, 'the registry marker'); assert.ok(lines[i - 1].includes('studio-agent-mode-shell-strip.mjs'), 'right after #607\'s line (the end of the stack at the time)'); assert.ok(lines[i + 1] === END || lines[i + 1].includes('// LATER-CHANGE:') && /-strip\.mjs/.test(lines[i + 1]), 'the true end of its list (or followed only by a later change\'s registered line)') }
  assert.deepEqual(own.map(([l]) => /\)\.(\w+), \/\//.exec(l)?.[1]), ['AGENT_MODE_WIRE_SCOPE_FILES', 'stripAgentModeWire'])
  const base = baseText(REGISTRY).split('\n'); assert.ok(base.every(l => lines.includes(l)), 'the registry loses no line'); assert.equal(lines.filter(l => !base.includes(l)).filter(l => !l.includes('studio-agent-mode-wire-strip.mjs')).length, 0, 'and gains nothing else')
  assert.ok(reg.LATER_STRIPS.includes(stripAgentModeWire), 'the strip is registered'); assert.ok([...SCOPE].every(rel => reg.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  const shellAt = reg.LATER_STRIPS.findIndex(fn => typeof fn === 'function' && fn.name === 'stripAgentModeShell'), ownAt = reg.LATER_STRIPS.indexOf(stripAgentModeWire); assert.ok(shellAt > 0 && ownAt === shellAt + 1, 'the strip comes right after #607\'s')
  // read through the registry (as the older proofs do), the hook and the page are #607's head's
  for (const rel of APP_FILES) assert.equal(reg.stripLaterChanges(rel, committed(rel)), reg.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's`)
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
  for (const rel of ['lib/studio-agent-mode.ts', 'tests/fixtures/agent_frames_contract.json', 'package.json', 'pnpm-lock.yaml', '.env.example', 'components/builder/message-list.tsx', 'components/builder/chat-input.tsx', 'components/builder/agent-mode/agent-run-cards.tsx', 'components/builder/agent-mode/build-mode-picker.tsx', 'scripts/studio-agent-mode-shell-strip.mjs']) assert.ok(!net.includes(rel) || SCOPE.has(rel), `${rel} is #607's / the base's: untouched`)
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
await check('F1. the sources: every line this change adds to the hook and the page carries the marker and is a pure insertion (no base line rewritten or removed); the strip puts #607\'s head back byte for byte (two app files, three older proofs); .env.example untouched', () => sourceChecks())
await check('F2. the registry: two marked lines (files, strips) at the true end of their lists right after #607\'s, none in the env list, nothing lost; read through it the hook and the page are the base\'s', () => registryChecks())
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
await pageMutant('one build send loses the build mode', '          ...buildSendOptions,\n          ...(agentBuildModeRef.current ? { buildMode: agentBuildModeRef.current } : {}), // AGENT-MODE-WIRE\n          manualDeck: turnContext?.manualDeck,', '          ...buildSendOptions,\n          manualDeck: turnContext?.manualDeck,')
await pageMutant('the build mode ref is never written', 'agentBuildModeRef.current = buildModeWire // AGENT-MODE-WIRE', 'void buildModeWire // AGENT-MODE-WIRE')
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
await wireMutant('the reducer drops a frame', 'return agentRunReducer(state, action)', 'return state')
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
await mutant('registry: a line is missing', () => registryChecks(read(REGISTRY).split('\n').filter(l => !l.includes('stripAgentModeWire')).join('\n')))
await mutant('registry: a base line is lost', () => registryChecks(read(REGISTRY).split('\n').filter(l => !l.includes('studio-agent-mode-shell-strip.mjs') || l.includes('wire')).join('\n')))
await mutant('registry: our line is not at the end of its list', () => { const lines = read(REGISTRY).split('\n'), at = lines.findIndex(l => l.includes('studio-agent-mode-wire-strip.mjs')); [lines[at], lines[at - 1]] = [lines[at - 1], lines[at]]; registryChecks(lines.join('\n')) })
await mutant('registry: a line in the env list (no block exists)', () => { const lines = read(REGISTRY).split('\n'), at = lines.findIndex(l => l.includes('(await import(\'./studio-agent-mode-shell-strip.mjs\')).AGENT_MODE_SHELL_ENV_BLOCK')); lines.splice(at + 1, 0, "  (await import('./studio-agent-mode-wire-strip.mjs')).AGENT_MODE_WIRE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, Agent mode wire"); registryChecks(lines.join('\n')) })
await mutant('registry: the marker comment changed', () => registryChecks(read(REGISTRY).replace('// LATER-CHANGE: FRONTEND-1, Agent mode wire (', '// LATER-CHANGE: FRONTEND-1, wiring (')))
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
