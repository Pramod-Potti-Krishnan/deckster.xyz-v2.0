// FRONTEND-2 (B69): proof of the Studio Agent build shell, P4-16 Track A, MR A-F1: NEW files only (lib/studio-agent-mode.ts, eight components under components/builder/agent-mode/ and AGENT-1's contract fixture), behind NEXT_PUBLIC_AGENT_MODE (the shell) and
// NEXT_PUBLIC_AUTHOR_MODE_PICKER (the Author option of the picker): each counts only as the exact string "true", is off by default, and works only with NEXT_PUBLIC_STUDIO_V4_SHELL "true". Nothing is applied to FRONTEND-1's hook or Builder page:
// the lines they would need are DRAFTS (scripts/studio-agent-mode-shell-strip.mjs). The six inbound frames and the outbound card answer are read as AGENT-1's shared fixture has them (tests/fixtures/agent_frames_contract.json, copied as it is).
//
//   node scripts/test-studio-agent-mode-shell.mjs        (plain node: transpile + vm of the REAL sources, react-dom/server for the markup, the cards' plain function components walked for their buttons; no network, no browser, no .next, no Next runtime)
//
// What it proves:
//  A. flags off: every component renders the empty string, for every mis-spelled flag and with the shell off; the Author option shows only with its flag, Agent only with its flag; the frame allow-list is empty off and the six types on;
//  B. the reducer over a scripted sequence (estimate, steps, checkpoint, done) and a failure path (steps, failed, credit back); the meter never exceeds the cap in display; state is not lost on an unknown or wrong frame (the same object comes back);
//     another run's frame, a stale frame after done / failed, a second run while one is live, a credit total that goes down: all refused; the reducer is pure; padded fields are ignored; a server string that would leak is replaced;
//  C. credits only: the markup and the text of every state of every card, and of the picker, hold no "token", "provider", "margin", "$" (nor USD, cost, price, model, router or model names; the one allowed "cost" is A1's label "Estimated cost"), also with foreign fields and leaking words fed in; // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
//  D. the picker: Free and Starter (and a plan not known) see Agent disabled with a plain reason; Pro and Max can pick it; Author only with its flag; build_mode on the wire (omitted unless chosen and allowed; an explicit "standard" only when switching back);
//  E. the cards: nothing is sent at render, every card answers only on a click and with exactly its answer, an answered card is off, A1 is information (no Start; one Stop that sends cancel), A3 Continue and Finish now, A4 Add and Skip, A6 NEVER a silent fallback (a fallback is // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
//     an explicit button, with its price, and with none offered the one button is OK); no card carries data-director-action-id (a voice "yes" cannot answer a paid card);
//  F. the strip, the env block, the registry (three lines) and the drafts: not applied (the committed diff leaves the hook and the page alone), each anchor is the dev line it names, a pure insertion except one replace, and the result parses;
//  G. scope over the COMMITTED diff, GATE-SAFE (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, no hash-object --stdin), each with the co-author line;
//  H. ROBUST AFTER MERGE and a LINEAR STACK (a later change directly on this head adds registered-shape registry lines below ours and a subject filter beside ours; an unregistered file in that commit still fails);
//  J. THE CONTRACT: the fixture is AGENT-1's byte for byte (git blob id, size); every frame example is read with exactly the fixture's field names, required and optional fields and wrong types behave as its flags say; the answer envelope,
//     the card ids and the choices (A1 start / cancel, A3 continue / stop, A4 add / skip, A6 fallback / stop) equal the fixture's; each of the 13 step labels and 3 + 3 states is read; each of the 50 reason codes has one plain credits-only sentence
//     and an unknown code says "Something went wrong."; every card is driven from the fixture's own examples; the estimate card does not read expires_at (no Start to expire; the lib's own guard still refuses a late start); a run stopped before an A3 / A4 card stays open and goes back to running on the // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
//     answer; an answer goes out only on a live socket and is never queued or replayed (the drafted hook lines are run against fake sockets);
//  I. mutants are caught (each is one edit of the real sources, fed to the same checks).
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import {
  AGENT_MODE_SHELL_COMPONENT_FILES, AGENT_MODE_SHELL_DRAFTS, AGENT_MODE_SHELL_DRAFT_FILES, AGENT_MODE_SHELL_EDITS, AGENT_MODE_SHELL_ENV_BLOCK, AGENT_MODE_SHELL_FE1_PROOF_FILES, AGENT_MODE_SHELL_FE1_PROOF_OK, AGENT_MODE_SHELL_FIXTURE, AGENT_MODE_SHELL_FLAGS, AGENT_MODE_SHELL_MARKER_RE, AGENT_MODE_SHELL_NEW_FILES,
  AGENT_MODE_SHELL_OWN_EDITS, AGENT_MODE_SHELL_PIN_AFTER, AGENT_MODE_SHELL_PIN_EDITS, AGENT_MODE_SHELL_PIN_FILES, AGENT_MODE_SHELL_PIN_MARK, AGENT_MODE_SHELL_SCOPE_FILES, AGENT_MODE_SHELL_SUBJECT, BASE_COMMIT, stripAgentModeShell,
} from './studio-agent-mode-shell-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
/** Only the strips of the changes registered AFTER this one, in the registry's order: on a branch stacked after this change a later change's own lines are undone first, so a file reads as this change left it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripAgentModeShell); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const count = (text, needle) => text.split(needle).length - 1
/** The sources run in a vm, so their objects and arrays come from another realm: compare them through JSON (undefined and null alike). */
const deepEqual = (actual, expected, ...message) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual ?? null)), JSON.parse(JSON.stringify(expected ?? null)), ...message)

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 700)} @ ${(String(error?.stack ?? '').match(/test-studio-agent-mode-shell\.mjs:\d+:\d+/) ?? ['?'])[0]}`) }
}
let caught = 0
const missed = []
/** A mutant is caught only by a failed ASSERTION of a check. A mutant whose edit did not apply (SwapError) or that crashed some other way proves nothing and is reported as missed. */
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}  [${String(error.message).replace(/\s+/g, ' ').slice(0, 100)}]`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }
const swapFirst = (text, from, to) => { if (!text.includes(from)) throw new SwapError(`${JSON.stringify(from.slice(0, 80))} not found`); return text.replace(from, () => to) }

// ---- the real sources in a vm ------------------------------------------------------------------------------------------------------------------
const LIB = 'lib/studio-agent-mode.ts', DIR = 'components/builder/agent-mode', REGISTRY = 'scripts/studio-later-changes.mjs'
const FILE = { frame: `${DIR}/agent-card-parts.tsx`, estimate: `${DIR}/agent-estimate-card.tsx`, run: `${DIR}/agent-run-card.tsx`, checkpoint: `${DIR}/agent-checkpoint-card.tsx`, research: `${DIR}/agent-research-offer-card.tsx`, failed: `${DIR}/agent-failed-card.tsx`, cards: `${DIR}/agent-run-cards.tsx`, picker: `${DIR}/build-mode-picker.tsx` }
const SRC = { lib: read(LIB), ...Object.fromEntries(Object.entries(FILE).map(([k, rel]) => [k, read(rel)])) }
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
/** Load one real source in a new context. `texts` replaces the text of any file (a mutant); `react` replaces React (useId stubbed for a direct call of a component); every other import is the REAL source or package, loaded with the same `env`. */
const textsKeys = new WeakMap(), modules = new Map(), timers = { set: globalThis.setTimeout, clear: globalThis.clearTimeout } // the sources' timer, replaceable for a proof
const textsKey = texts => { if (!textsKeys.has(texts)) textsKeys.set(texts, crypto.createHash('sha1').update(JSON.stringify(texts)).digest('hex')); return textsKeys.get(texts) }
function load(rel, { env = {}, texts = {}, react = React } = {}) {
  const key = `${rel}\0${JSON.stringify(env)}\0${textsKey(texts)}\0${react === React ? 'react' : (react.__tag ?? 'stub')}` // the sources are pure: one module per (file, env, mutant text)
  if (modules.has(key)) return modules.get(key)
  const module = { exports: {} }
  modules.set(key, module.exports)
  const req = spec => {
    if (spec === 'react') return react
    if (spec === 'react/jsx-runtime') return jsxRuntime
    const local = localFile(spec, rel)
    return local ? load(local, { env, texts, react }) : nodeRequire(spec)
  }
  vm.runInNewContext(compile(rel, texts[rel] ?? read(rel)), { module, exports: module.exports, require: req, process: { env: { ...env } }, setTimeout: (...a) => timers.set(...a), clearTimeout: (...a) => timers.clear(...a) }, { filename: rel })
  return module.exports
}
const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const ENV_AGENT = { ...SHELL, NEXT_PUBLIC_AGENT_MODE: 'true' }, ENV_AUTHOR = { ...SHELL, NEXT_PUBLIC_AUTHOR_MODE_PICKER: 'true' }, ENV_BOTH = { ...ENV_AGENT, ...ENV_AUTHOR }
const libOf = (env = ENV_BOTH, texts = {}) => load(LIB, { env, texts })
const h = React.createElement
const textOf = html => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
const stubReact = { ...React, useId: () => 'pid', useState: init => [typeof init === 'function' ? init() : init, () => {}], useEffect: () => {} }
/** A component's markup. */
const html = (file, name, props, { env = ENV_BOTH, texts = {} } = {}) => renderToStaticMarkup(h(load(FILE[file], { env, texts })[name], props))
/** A plain function component called directly (the picker's useId and the estimate card's clock hooks are stubbed): its element tree, walked for every element. */
const tree = (file, name, props, { env = ENV_BOTH, texts = {} } = {}) => load(FILE[file], { env, texts, react: stubReact })[name](props)
const walk = (node, visit) => {
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return }
  if (!React.isValidElement(node)) return
  visit(node)
  walk(typeof node.type === 'function' ? node.type(node.props) : node.props?.children, visit)
}
const elements = (root0, pred) => { const out = []; walk(root0, el => { if (pred(el)) out.push(el) }); return out }
const byProp = (root0, prop, value) => elements(root0, el => el.props?.[prop] === value)

// ---- AGENT-1's contract fixture (copied as it is) and the scripted frames ---------------------------------------------------------------------------
const FIXTURE_BYTES = fs.readFileSync(path.join(root, AGENT_MODE_SHELL_FIXTURE))
const FIX = JSON.parse(FIXTURE_BYTES.toString('utf8'))
const EX = type => FIX.frames[type].example.payload
const RUN = EX('agent_estimate').run_id, OTHER = 'agr_0123456789cd'
const F = (type, payload) => ({ message_id: 'm1', session_id: 's1', timestamp: '2026-11-08T00:00:00Z', type, payload })
const fx = (type, o = {}) => F(type, { ...EX(type), ...o }) // the fixture's own example, with overrides
const omit = (o, ...keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)))
const est = (o = {}) => F('agent_estimate', { ...omit(EX('agent_estimate'), 'expires_at'), ...o }) // D3 sends no expires_at yet
const stepF = (n, label, o = {}) => F('agent_step', { run_id: RUN, step: n, label, ...o })
const checkF = (o = {}) => fx('agent_checkpoint', { credits_used: 480, more_credits: 120, ...o })
const offerF = (o = {}) => fx('agent_research_offer', o)
const failF = (o = {}) => F('agent_failed', { run_id: RUN, reason: 'credit_cap', step: 3, charged_credits: 300, credited_back_credits: 300, slides_kept: 0, ...o })
const doneF = (o = {}) => fx('agent_done', { slides: 10, charged_credits: 560, ...o })
const run = (lib, frames, from) => frames.reduce((s, f) => lib.agentRunReducer(s, f), from ?? lib.initialAgentRunState())
const answer = (card, choice) => ({ runId: RUN, card, choice })
const SCRIPT_OK = [est(), stepF(1, 'Reading your outline', { credits_used: 20 }), stepF(1, 'Reading your outline', { step_state: 'done', credits_used: 60 }), stepF(2, 'Looking for a matching template', { credits_used: 90 }), stepF(3, 'Researching slides 3 to 5', { credits_used: 300 }), checkF(), stepF(4, 'Building your slides', { credits_used: 520 }), doneF()]
const SCRIPT_FAIL = [est(), stepF(1, 'Reading your outline', { step_state: 'done', credits_used: 60 }), stepF(2, 'Looking for a matching template', { step_state: 'done', credits_used: 90 }), stepF(3, 'Researching slides 3 to 5', { step_state: 'failed', credits_used: 300 }), failF()]

// ---- every state of every card (for the flag, leak and card checks) --------------------------------------------------------------------------------
function allStates(lib) {
  const s = (frames, from) => run(lib, frames, from)
  const mid = s(SCRIPT_OK.slice(0, 5))
  return {
    idle: lib.initialAgentRunState(),
    estimate: s([est()]), 'estimate over the cap': s([est({ est_credits: 900 })]), 'estimate answered': s([est(), lib.agentAnswered(answer('A1', 'start'))]), 'estimate small': s([est({ est_credits: 100 })]), 'estimate with an expiry': s([est({ expires_at: EX('agent_estimate').expires_at })]),
    running: mid, paused: s([stepF(5, 'Pausing', { run_status: 'paused' })], mid), stopped: s([stepF(5, 'Stopped', { run_status: 'stopped' })], mid), done: s(SCRIPT_OK),
    checkpoint: s([checkF()], mid), 'checkpoint answered': s([checkF(), lib.agentAnswered(answer('A3', 'continue'))], mid), 'research offer': s([offerF()], mid), 'research offer one slide': s([offerF({ slides: [4], est_credits: 1 })], mid),
    'stopped, then a checkpoint': s([stepF(3, 'Researching slides 3 to 5', { run_status: 'stopped' }), checkF()], mid), 'stopped, then a research offer': s([stepF(3, 'Researching slides 3 to 5', { run_status: 'stopped' }), offerF()], mid),
    'failed, no deck, credited back': s(SCRIPT_FAIL), 'failed with a fallback offered': s([failF({ fallback_credits: 80, credited_back_credits: 0, slides_kept: 4 })], s(SCRIPT_FAIL.slice(0, 4))), 'failed, nothing charged': s([failF({ charged_credits: 0, credited_back_credits: 0, step: undefined })], s([est()])),
    'failed answered': s([failF({ fallback_credits: 80 }), lib.agentAnswered(answer('A6', 'stop'))], s(SCRIPT_FAIL.slice(0, 4))), 'over the cap': s([stepF(6, 'Still working', { credits_used: 9999 })], mid),
  }
}
const CARD_VIEWS = [['estimate', 'AgentEstimateCard'], ['run', 'AgentRunCard'], ['checkpoint', 'AgentCheckpointCard'], ['research', 'AgentResearchOfferCard'], ['failed', 'AgentFailedCard'], ['cards', 'AgentRunCards']]
/** Every card and the composite for one state, and the picker for every plan, as markup. */
function allMarkup(env, texts, states = allStates(libOf(ENV_BOTH, texts))) {
  const out = []
  for (const [name, state] of Object.entries(states)) for (const [file, comp] of CARD_VIEWS) out.push([`${comp} / ${name}`, html(file, comp, { state, onAnswer() {}, onControl() {} }, { env, texts })])
  for (const plan of [undefined, null, 'free', 'starter', 'pro', 'premium', 'max']) for (const value of ['standard', 'author', 'agent']) out.push([`picker ${plan} / ${value}`, html('picker', 'BuildModePicker', { value, plan, onChange() {} }, { env, texts })])
  return out
}

// ===== A. flags ====================================================================================================================================
console.log('A. flags off: nothing is drawn')
function proveFlags(texts = {}) {
  const lib = libOf(ENV_BOTH, texts)
  for (const value of ['false', 'FALSE', 'TRUE', '1', 'yes', ' true', 'true ', '', 'on']) {
    for (const [env, label] of [[{ ...SHELL, NEXT_PUBLIC_AGENT_MODE: value }, 'agent'], [{ ...SHELL, NEXT_PUBLIC_AUTHOR_MODE_PICKER: value }, 'author']]) {
      const l = libOf(env, texts); assert.equal(l.STUDIO_AGENT_MODE_ENABLED, false, `${label} flag ${JSON.stringify(value)} is off`); assert.equal(l.STUDIO_AUTHOR_MODE_PICKER_ENABLED, false); deepEqual([...l.STUDIO_AGENT_FRAME_TYPES], [])
    }
  }
  for (const env of [{}, SHELL, { NEXT_PUBLIC_AGENT_MODE: 'true' }, { NEXT_PUBLIC_AGENT_MODE: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'false' }, { NEXT_PUBLIC_AGENT_MODE: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: '1' }, { NEXT_PUBLIC_AUTHOR_MODE_PICKER: 'true' }, { NEXT_PUBLIC_AUTHOR_MODE_PICKER: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'TRUE' }]) {
    const l = libOf(env, texts); assert.equal(l.STUDIO_AGENT_MODE_ENABLED, false, `agent off without the shell: ${JSON.stringify(env)}`); assert.equal(l.STUDIO_AUTHOR_MODE_PICKER_ENABLED, false, `author off without the shell: ${JSON.stringify(env)}`)
    for (const [label, markup] of allMarkup(env, texts)) assert.equal(markup, '', `flags off ${JSON.stringify(env)}: ${label} renders the empty string`)
  }
  const on = libOf(ENV_BOTH, texts); assert.equal(on.STUDIO_AGENT_MODE_ENABLED, true); assert.equal(on.STUDIO_AUTHOR_MODE_PICKER_ENABLED, true); deepEqual([...on.STUDIO_AGENT_FRAME_TYPES], ['agent_estimate', 'agent_step', 'agent_checkpoint', 'agent_research_offer', 'agent_failed', 'agent_done'])
  deepEqual([...libOf(ENV_AGENT, texts).STUDIO_AGENT_FRAME_TYPES], [...on.STUDIO_AGENT_FRAME_TYPES]); assert.equal(libOf(ENV_AUTHOR, texts).STUDIO_AGENT_MODE_ENABLED, false, 'the author flag alone does not turn the agent shell on'); assert.equal(libOf(ENV_AGENT, texts).STUDIO_AUTHOR_MODE_PICKER_ENABLED, false)
  // each flag alone: only its part is drawn
  const states = allStates(lib)
  assert.equal(html('cards', 'AgentRunCards', { state: states.estimate }, { env: ENV_AUTHOR, texts }), '', 'the author flag alone draws no agent card'); assert.notEqual(html('cards', 'AgentRunCards', { state: states.estimate }, { env: ENV_AGENT, texts }), '')
  const modes = env => [...html('picker', 'BuildModePicker', { value: 'standard', plan: 'pro' }, { env, texts }).matchAll(/data-build-mode="(\w+)"/g)].map(m => m[1])
  deepEqual(modes(ENV_AGENT), ['standard', 'agent']); deepEqual(modes(ENV_AUTHOR), ['standard', 'author']); deepEqual(modes(ENV_BOTH), ['standard', 'author', 'agent'])
  assert.equal(html('picker', 'BuildModePicker', { value: 'standard', plan: 'pro' }, { env: SHELL, texts }), '', 'neither flag: no picker')
  // the flag read is a pure function of the two strings
  assert.equal(lib.studioAgentModeOn('true', 'true'), true); assert.equal(lib.studioAgentModeOn('true', undefined), false); assert.equal(lib.studioAgentModeOn('1', 'true'), false); assert.equal(lib.studioAuthorModePickerOn('true', 'true'), true); assert.equal(lib.studioAuthorModePickerOn('true', 'false'), false); assert.equal(lib.studioAuthorModePickerOn('True', 'true'), false)
}
await check('flags off (every mis-spelling, the shell off): every component, for every state, renders the empty string; the frame allow-list is empty; each flag alone draws only its part (Author with its flag, Agent with its flag, neither: no picker)', () => proveFlags())

// ===== B. the reducer ==============================================================================================================================
console.log('B. the reducer')
const snap = value => JSON.stringify(value)
function proveReducer(texts = {}) {
  const lib = libOf(ENV_BOTH, texts), R = lib.agentRunReducer
  // the scripted success: estimate, steps, checkpoint, done
  let s = lib.initialAgentRunState(); assert.equal(s.status, 'idle')
  s = R(s, SCRIPT_OK[0]); assert.equal(s.status, 'estimate'); deepEqual(s.estimate, { credits: 470, expiresAt: null, answered: null }); assert.equal(s.capCredits, 600); assert.equal(s.usedCredits, 0); assert.equal(s.runId, RUN); deepEqual(s.steps, [])
  s = R(s, SCRIPT_OK[1]); assert.equal(s.status, 'running'); assert.equal(s.estimate, null, 'the estimate is gone once the run has started'); deepEqual(s.steps, [{ n: 1, label: 'Reading your outline', stepState: 'running' }]); assert.equal(s.usedCredits, 20); assert.equal(s.capCredits, 600)
  s = R(s, SCRIPT_OK[2]); deepEqual(s.steps, [{ n: 1, label: 'Reading your outline', stepState: 'done' }], 'the same step is updated in place, not added twice'); assert.equal(s.usedCredits, 60)
  s = R(s, SCRIPT_OK[3]); s = R(s, SCRIPT_OK[4]); deepEqual(s.steps.map(x => [x.n, x.stepState]), [[1, 'done'], [2, 'running'], [3, 'running']], 'steps are kept, in the order they came'); assert.equal(s.usedCredits, 300); assert.equal(s.pending, null)
  s = R(s, SCRIPT_OK[5]); deepEqual(s.pending, { kind: 'checkpoint', usedCredits: 480, moreCredits: 120, capCredits: 600, answered: null }); assert.equal(s.usedCredits, 480); assert.equal(s.steps.length, 3, 'a checkpoint loses no step'); assert.equal(s.status, 'running')
  const answered = R(s, lib.agentAnswered(answer('A3', 'continue'))); assert.equal(answered.pending.answered, 'continue'); assert.equal(R(answered, lib.agentAnswered(answer('A3', 'stop'))), answered, 'a second answer changes nothing')
  s = R(s, SCRIPT_OK[6]); assert.equal(s.pending, null, 'a new step means the run moved on: the checkpoint is gone'); assert.equal(s.steps.length, 4); assert.equal(s.usedCredits, 520)
  s = R(s, SCRIPT_OK[7]); assert.equal(s.status, 'done'); assert.equal(s.usedCredits, 560); assert.equal(s.steps.length, 4, 'done keeps the steps'); assert.equal(s.doneSlides, 10); assert.equal(s.pending, null)
  for (const late of [stepF(9, 'Late'), checkF(), failF(), doneF({ credits_used: 1 }), offerF()]) assert.equal(R(s, late), s, `a stale ${late.type} after done changes nothing`)
  // the failure path: steps, then failed, with a credit back
  const f = run(lib, SCRIPT_FAIL); assert.equal(f.status, 'failed'); deepEqual(f.failure, { step: 3, reason: 'The build reached its credit cap.', chargedCredits: 300, creditedBackCredits: 300, slidesKept: 0, fallbackCredits: null, answered: null })
  deepEqual(f.steps.map(x => x.stepState), ['done', 'done', 'failed']); assert.equal(f.usedCredits, 300); assert.equal(f.pending, null)
  for (const late of [stepF(4, 'Late', { credits_used: 500 }), doneF(), checkF(), est()]) assert.equal(R(f, late), f, `after failed, ${late.type} changes nothing: the run does not quietly go on`)
  const withFallback = R(run(lib, SCRIPT_FAIL.slice(0, 4)), failF({ fallback_credits: 80 })); assert.equal(withFallback.failure.fallbackCredits, 80); assert.equal(withFallback.status, 'failed', 'a fallback offered is an offer: the run stays failed until someone answers')
  assert.equal(R(withFallback, lib.agentAnswered(answer('A6', 'fallback'))).failure.answered, 'fallback')
  // the meter never exceeds the cap in display
  const over = R(run(lib, SCRIPT_OK.slice(0, 5)), stepF(6, 'x', { credits_used: 9999 })); assert.equal(over.capCredits, 600)
  assert.equal(lib.formatMeter(9999, 600), '600 of 600 credits'); assert.equal(lib.formatMeter(300, 600), '300 of 600 credits'); assert.equal(lib.meterFraction(9999, 600), 1); assert.equal(lib.meterFraction(300, 600), 0.5); assert.equal(lib.meterFraction(0, 600), 0); assert.equal(lib.meterFraction(5, null), 0); assert.equal(lib.formatMeter(7, null), '7 credits')
  const meter = html('run', 'AgentRunCard', { state: over }, { texts }); assert.match(meter, /aria-valuenow="600"/); assert.match(meter, /aria-valuemax="600"/); assert.match(meter, /width:100%/); assert.equal(textOf(meter).includes('9,999'), false, 'the used figure past the cap is never drawn'); assert.match(textOf(meter), /600 of 600 credits/)
  assert.match(html('checkpoint', 'AgentCheckpointCard', { state: R(over, checkF({ credits_used: 7000 })) }, { texts }), /600 of 600 credits used/)
  // the state is not lost on an unknown or wrong frame: the SAME object comes back
  const mid = run(lib, SCRIPT_OK.slice(0, 5)), before = snap(mid)
  const noise = [null, undefined, 42, 'agent_step', [], {}, { type: 'chat_message', payload: { text: 'hi' } }, { type: 'agent_mystery', payload: { run_id: RUN } }, { type: 'agent_step' }, { type: 'agent_step', payload: null }, { type: 'agent_step', payload: [] },
    stepF(0, 'zero'), stepF(-1, 'negative'), stepF(1.5, 'fraction'), stepF('2', 'string step'), stepF(2, 7), stepF(2, 'x', { credits_used: -1 }), stepF(2, 'x', { credits_used: NaN }), stepF(2, 'x', { credits_used: Infinity }), stepF(2, 'x', { credits_used: '5' }), F('agent_step', { run_id: 7, step: 2, label: 'x' }),
    F('agent_step', { run_id: '', step: 2, label: 'x' }), F('agent_step', { step: 2, label: 'x' }), F('agent_step', { run_id: 'x'.repeat(300), step: 2, label: 'x' }), checkF({ credits_used: 1, more_credits: 1, cap_credits: 0 }), est({ est_credits: 1, cap_credits: 0 }),
    est({ run_id: OTHER, est_credits: 'a' }), offerF({ slides: [], est_credits: 4 }), offerF({ slides: [1, 'two'], est_credits: 4 }), failF({ charged_credits: -4 }),
    checkF({ card: 'A4' }), checkF({ card: undefined }), checkF({ choices: ['finish', 'stop'] }), checkF({ choices: 'continue' }), checkF({ choices: ['continue'] }), offerF({ card: 'A3' }), offerF({ choices: ['add'] }), offerF({ choices: undefined }), est({ expires_at: 'not a date' }), est({ expires_at: 7 }), doneF({ slides: [3, 4, 5] }), doneF({ slides: -1 }), doneF({ charged_credits: undefined }), failF({ step: 0 }), failF({ slides_kept: 'x' }),
    doneF({ charged_credits: 'many' }), { type: 'agent_answered', payload: { run_id: OTHER, card: 'A3', choice: 'continue' } }, { type: 'agent_answered', payload: { run_id: RUN, card: 'toString', choice: 'continue' } }, { type: 'agent_answered', payload: { run_id: RUN, card: 'A3', choice: 'launch' } }, { type: 'agent_answered', payload: { run_id: RUN, card: 'checkpoint', choice: 'continue' } }, { type: 'agent_answered', payload: { run_id: RUN, card: 'A3', choice: 'finish' } }, { type: 'agent_answered', payload: { run_id: RUN, card: 'A4', choice: 'add' } }]
  for (const [i, frame] of noise.entries()) { assert.equal(R(mid, frame), mid, `frame ${i} (${JSON.stringify(frame)?.slice(0, 70)}) is refused: the same state comes back`); assert.equal(snap(mid), before) }
  for (const frame of [stepF(7, 'Another run', { run_id: OTHER }), checkF({ run_id: OTHER }), failF({ run_id: OTHER }), doneF({ run_id: OTHER }), est({ run_id: OTHER })]) assert.equal(R(mid, frame), mid, `another run's ${frame.type}, or a second run while one is live, is refused`)
  assert.equal(R(lib.initialAgentRunState(), { type: 'chat_message', payload: {} }).status, 'idle')
  // credits only go up; resume and pause; a replayed frame opens a run; a second estimate after done starts a fresh one; a replay of the same estimate does not reset a started run
  assert.equal(R(mid, stepF(3, 'Researching slides 3 to 5', { credits_used: 10 })).usedCredits, 300, 'credits used never go down')
  assert.equal(R(mid, stepF(4, 'Paused', { run_status: 'paused' })).status, 'paused'); assert.equal(R(R(mid, stepF(4, 'Stopped', { run_status: 'stopped' })), stepF(5, 'Resumed')).status, 'running', 'a new step after a stop or pause is the run going on')
  assert.equal(R(R(mid, stepF(4, 'Paused', { run_status: 'paused' })), stepF(4, 'Paused', { step_state: 'done' })).status, 'paused', 'an update of an earlier step does not resume a paused run')
  assert.equal(R(lib.initialAgentRunState(), stepF(2, 'Replayed after a reload', { credits_used: 200, cap_credits: 600 })).runId, RUN); assert.equal(R(lib.initialAgentRunState(), stepF(2, 'Replayed', { credits_used: 200, cap_credits: 600 })).capCredits, 600)
  const next = R(s, est({ run_id: OTHER })); assert.equal(next.runId, OTHER); assert.equal(next.status, 'estimate'); deepEqual(next.steps, []); assert.equal(R(mid, est()), mid, 'the estimate of a run already going is a replay: refused')
  const replay = R(run(lib, [est()]), est({ est_credits: 480 })); assert.equal(replay.estimate.credits, 480, 'the same estimate again, before Start, is refreshed')
  assert.equal(R(replay, lib.agentAnswered(answer('A1', 'cancel'))).status, 'idle', 'Cancel clears the run'); const started = R(replay, lib.agentAnswered(answer('A1', 'start'))); assert.equal(started.estimate.answered, 'start'); assert.equal(R(started, est({ est_credits: 999 })), started, 'a started estimate is not refreshed'); assert.equal(R(started, lib.agentAnswered(answer('A1', 'cancel'))), started, 'it cannot be cancelled once started')
  // pure: the state a reducer is given is never changed; the same input gives the same output
  const frozenBefore = snap(mid); for (const frame of [...SCRIPT_OK, ...SCRIPT_FAIL]) R(mid, frame); assert.equal(snap(mid), frozenBefore, 'the reducer does not change the state it is given'); assert.equal(snap(run(lib, SCRIPT_OK)), snap(run(lib, SCRIPT_OK)), 'same frames, same state')
  // padded fields are ignored (the parse keeps only what the shell uses); no tier, user, deck or balance is read from a frame
  const padded = { cost_usd: '9.99', provider_cost: 1, tokens: 5, total_tokens: 7, margin: 0.4, model: 'a-model', provider: 'a-provider', tier: 'premium', user_id: 'u1', balance: 999, deck_id: 'd1', usd: 3, estimate_low: 1, estimate_high: 2, text: 'An old field', state: 'failed', status: 'stopped', extra_credits: 99 } // the old field names are padding now
  const known = { agent_estimate: ['run_id', 'est_credits', 'cap_credits', 'expires_at'], agent_step: ['run_id', 'step', 'label', 'step_state', 'run_status', 'credits_used', 'cap_credits'], agent_checkpoint: ['run_id', 'card', 'credits_used', 'more_credits', 'cap_credits', 'choices'], agent_research_offer: ['run_id', 'card', 'slides', 'est_credits', 'choices'], agent_failed: ['run_id', 'reason', 'step', 'charged_credits', 'credited_back_credits', 'slides_kept', 'fallback_credits'], agent_done: ['run_id', 'slides', 'charged_credits'] }
  for (const frame of [est(), stepF(1, 'x', { step_state: 'done', run_status: 'running', credits_used: 1, cap_credits: 600 }), checkF(), offerF(), failF({ slides_kept: 1, fallback_credits: 5 }), doneF()]) {
    const parsed = lib.readAgentFrame({ ...frame, payload: { ...frame.payload, ...padded } }); assert.ok(parsed, frame.type); deepEqual(Object.keys(parsed.payload).sort(), Object.keys(frame.payload).filter(k => known[frame.type].includes(k)).sort(), `${frame.type}: only the fields the shell uses`)
    assert.equal(snap(lib.agentRunReducer(mid, { ...frame, payload: { ...frame.payload, ...padded } })), snap(lib.agentRunReducer(mid, frame)), `${frame.type}: a padded frame gives the same state`)
  }
  assert.equal(snap(run(lib, SCRIPT_OK.map(fr => ({ ...fr, payload: { ...fr.payload, ...padded } })))).match(/cost_usd|provider|tokens|margin|"tier"|user_id|balance|deck_id/), null, 'no padded field reaches the state')
  // a server string that would leak is replaced; markup is taken out; long text is cut
  const words = run(lib, [est(), stepF(1, 'Calling the provider for $5 of tokens'), stepF(2, '<b>Reading</b>   your   outline'), stepF(3, 'x'.repeat(400)), stepF(4, 'Asking Sonnet about it'), stepF(5, 'Margin is 40%'), stepF(6, 'Paid 3 USD')]).steps.map(x => x.label)
  deepEqual(words.slice(0, 2), ['Working on your deck', 'Reading your outline']); assert.ok(words[2].length <= 160 && words[2].endsWith('…')); deepEqual(words.slice(3), ['Working on your deck', 'Working on your deck', 'Working on your deck'])
  assert.equal(run(lib, [est(), failF({ reason: 'The provider returned an error' })]).failure.reason, 'Something went wrong.', 'a reason that is not a code is never shown as it came'); assert.equal(lib.plainWords(7, 'fallback'), 'fallback'); assert.equal(lib.plainWords('   ', 'fallback'), 'fallback')
  // more steps than the card keeps: the latest are kept
  const many = run(lib, [est(), ...Array.from({ length: 250 }, (_, i) => stepF(i + 1, `Step ${i + 1}`))]); assert.equal(many.steps.length, lib.AGENT_MAX_STEPS_KEPT); assert.equal(many.steps.at(-1).n, 250); assert.equal(many.steps[0].n, 51)
  // credits words
  assert.equal(lib.formatCredits(1), '1 credit'); assert.equal(lib.formatCredits(1200), '1,200 credits'); assert.equal(lib.formatCredits(0.2), '1 credit'); assert.equal(lib.formatCredits(-5), '0 credits'); assert.equal(lib.formatCredits(NaN), '0 credits'); assert.equal(lib.formatCredits('5'), '0 credits'); assert.equal(lib.formatCreditsNumber(Infinity), '0')
  assert.equal(lib.formatEstimate(470, 600), 'About 470 credits · cap 600 credits'); assert.equal(lib.formatEstimate(100, 1200), 'About 100 credits · cap 1,200 credits'); assert.equal(lib.formatEstimate(0.2, 5), 'About 1 credit · cap 5 credits'); assert.equal(lib.formatEstimate(469.01, 600), 'About 470 credits · cap 600 credits', 'up to 2 decimals are rounded up for display')
  assert.equal(lib.slidesLabel([3, 4, 5]), 'slides 3–5'); assert.equal(lib.slidesLabel([4]), 'slide 4'); assert.equal(lib.slidesLabel([2, 4, 5, 6, 9]), 'slides 2, 4–6, 9'); assert.equal(lib.slidesLabel([3, 4]), 'slides 3, 4'); assert.equal(lib.slidesLabel([5, 3, 3, 4, 0, -1, 2.5]), 'slides 3–5'); assert.equal(lib.slidesLabel([]), 'your slides')
  assert.equal(lib.agentRunReducer.length, 2); deepEqual(Object.keys(lib.initialAgentRunState()).sort(), ['capCredits', 'doneSlides', 'estimate', 'failure', 'pending', 'runId', 'status', 'steps', 'usedCredits'])
}
await check('the reducer: the scripted success (estimate, steps, checkpoint, done) and failure (steps, failed, credit back); steps kept in order; the meter never past the cap; an unknown or wrong frame returns the SAME state; another run, a stale frame, a second run, a credit total going down refused; pure; padded fields and leaking server words handled', () => proveReducer())

// ===== C. credits only =============================================================================================================================
console.log('C. credits only')
/** No currency, USD, cost, price, token, model, provider, margin, router or model name, in markup or text. The one allowed use of the word is A1's label "Estimated cost" (PK's words; the figures after it are credits). */ // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
const LEAK = /\$|\busd\b|_usd\b|dollar|\bcosts\b|(?<!Estimated )\bcost\b|\bprices?\b|per[ -]token|\btokens?\b|\bmodels?\b|\bproviders?\b|openrouter|\bmargin\b|\bcents?\b|\brouter\b|\b(gpt|claude|gemini|llama|sonnet|opus|haiku)\b/i // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
function proveLeaks(texts = {}) {
  const lib = libOf(ENV_BOTH, texts), rows = allMarkup(ENV_BOTH, texts)
  assert.equal(rows.length, Object.keys(allStates(lib)).length * CARD_VIEWS.length + 21, 'every state of every card and every plan of the picker is drawn')
  let drawn = 0
  for (const [label, markup] of rows) { if (markup === '') continue; drawn++; assert.doesNotMatch(markup, LEAK, `${label}: no $, USD, cost, price, token, model, provider, margin or model name in the markup`); assert.doesNotMatch(textOf(markup), LEAK, `${label}: ... nor in the text`) }
  const drew = new Set(rows.filter(([, markup]) => markup !== '').map(([label]) => label.split(' / ')[0].replace(/^picker.*/, 'picker'))); assert.deepEqual([...drew].sort(), ['AgentCheckpointCard', 'AgentEstimateCard', 'AgentFailedCard', 'AgentResearchOfferCard', 'AgentRunCard', 'AgentRunCards', 'picker'], `every card and the picker draw somewhere (${drawn} of ${rows.length} draw), so "no leak" is not "nothing drawn"`)
  // foreign fields and leaking server words fed in: the screen is the same
  const padded = { cost_usd: '9.99', provider_cost: 1, tokens: 5, margin: 0.4, model: 'a-model', provider: 'a-provider', usd: 3 }
  const frames = [est(), stepF(1, 'Calling the provider for $5 of tokens', { credits_used: 20 }), stepF(2, 'Reading your outline', { step_state: 'done', credits_used: 60 }), checkF(), offerF(), failF({ reason: 'The model returned a token error', fallback_credits: 80 })].map(f => ({ ...f, payload: { ...f.payload, ...padded } }))
  let s = lib.initialAgentRunState()
  for (const frame of frames) { s = lib.agentRunReducer(s, frame); for (const [file, comp] of CARD_VIEWS) { const m = html(file, comp, { state: s }, { texts }); assert.doesNotMatch(m, LEAK, `${comp} after ${frame.type}`); assert.doesNotMatch(textOf(m), LEAK) } }
  // every word the lib can say
  const say = [...Object.values(lib.AGENT_COPY).flatMap(v => (typeof v === 'string' ? [v] : Object.values(v))), lib.checkpointWords(480, 600, 120), lib.checkpointWords(1, 600, 1), lib.researchOfferWords([3, 4, 5], 40), lib.researchOfferWords([4], 1), lib.failedStopWords(7), lib.failedStopWords(null), lib.failedMoneyWords(300, 300), lib.failedMoneyWords(0, 0), lib.failedSlidesWords(4), lib.failedSlidesWords(1), lib.failedSlidesWords(0), lib.failedFallbackWords(80), lib.formatEstimate(470, 600), lib.formatMeter(300, 600), lib.formatCredits(1), ...Object.values(lib.AGENT_REASON_WORDS)]
  for (const words of say) assert.doesNotMatch(words, LEAK, words)
  assert.ok(say.length > 90, 'every word, the 50 reason sentences too')
}
await check('credits only: the markup and the text of every state of every card, the composite and the picker (every plan) hold no $, USD, cost, price, token, model, provider, margin or model name; foreign fields and leaking server words fed in change nothing; every word the lib can say is clean', () => proveLeaks())
await check('positive controls: the leak pattern catches each kind of word it is for, the cards really draw credits, and the figures read as credits', () => {
  for (const word of ['$5', '5 USD', 'cost_usd', 'the cost', 'costs', 'Estimated costs', 'Estimated cost in $5', 'a price', 'per token', '3 tokens', 'the model', 'provider', 'openrouter', 'margin', '500 cents', 'the router', 'gpt', 'Sonnet', 'Opus']) assert.match(word, LEAK, word) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  for (const word of ['credits', 'Estimated cost', '480 of 600 credits', 'Continue with up to 120 more credits', 'Agent build', 'Pro and Max', 'Charged 300 credits.']) assert.doesNotMatch(word, LEAK, word) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  const lib = libOf(); const s = run(lib, SCRIPT_OK.slice(0, 6))
  assert.match(textOf(html('cards', 'AgentRunCards', { state: s })), /480 of 600 credits.*Reading your outline.*Looking for a matching template.*Researching slides 3 to 5.*Working.*480 of 600 credits used\. Continue with up to 120 more credits, or stop now\?/)
  assert.match(textOf(html('cards', 'AgentRunCards', { state: run(lib, [est()]) })), /^Agent build Estimated cost: About 470 credits · cap 600 credits · Running Stop$/) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  assert.match(textOf(html('cards', 'AgentRunCards', { state: run(lib, SCRIPT_FAIL) })), /The agent stopped at step 3\. The build reached its credit cap\. Charged 300 credits\. 300 credits credited back\. No slides were built\. OK$/)
  assert.match(textOf(html('cards', 'AgentRunCards', { state: run(lib, [est(), checkF(), offerF()]) })), /Deeper research on slides 3–5 adds about 40 credits\. Add it\? Add research Stop here$/)
})

// ===== D. the picker ===============================================================================================================================
console.log('D. the picker')
function provePicker(texts = {}) {
  const lib = libOf(ENV_BOTH, texts), opts = plan => lib.buildModeOptions(plan, { agent: true, author: true }), agent = plan => opts(plan).find(o => o.mode === 'agent')
  for (const plan of ['free', 'starter']) { const a = agent(plan); assert.equal(a.disabled, true, `${plan}: Agent is disabled`); assert.equal(a.note, 'Agent build is on Pro and Max plans.', `${plan}: with a plain reason`); assert.equal(lib.agentEligible(plan), false) }
  for (const plan of ['pro', 'premium']) { const a = agent(plan); assert.equal(a.disabled, false, `${plan}: Agent can be picked`); assert.equal(a.note, 'Pro and Max'); assert.equal(lib.agentEligible(plan), true) }
  for (const plan of [undefined, null]) { const a = agent(plan); assert.equal(a.disabled, true, `${String(plan)}: a plan not loaded yet: disabled`); assert.equal(a.note, 'Your plan is not loaded yet.') }
  for (const raw of ['max', 'Pro', 'PREMIUM', 'enterprise', '', 7, null, undefined, {}, 'toString']) assert.equal(lib.agentPlanOf(raw), null, `${JSON.stringify(raw)} is not a plan (there is no "max" key: Max is premium's label)`)
  for (const plan of ['free', 'starter', 'pro', 'premium']) assert.equal(lib.agentPlanOf(plan), plan)
  assert.equal(lib.agentEligible('max'), false); assert.equal(opts('free')[0].disabled, false, 'Standard is always on')
  deepEqual(lib.buildModeOptions('pro', { agent: true, author: false }).map(o => o.mode), ['standard', 'agent']); deepEqual(lib.buildModeOptions('pro', { agent: false, author: true }).map(o => o.mode), ['standard', 'author']); deepEqual(lib.buildModeOptions('pro', { agent: false, author: false }).map(o => o.mode), ['standard'])
  assert.equal(opts('free').find(o => o.mode === 'author').disabled, false, 'Author is not plan-gated here (Director decides)')
  // the markup: Free sees Agent disabled with the reason beside it, Pro does not
  const free = html('picker', 'BuildModePicker', { value: 'standard', plan: 'free' }, { texts }), pro = html('picker', 'BuildModePicker', { value: 'standard', plan: 'pro' }, { texts })
  assert.match(free, /data-build-mode="agent"[^>]*disabled=""/); assert.match(textOf(free), /Agent build is on Pro and Max plans\./); assert.doesNotMatch(pro, /data-build-mode="agent"[^>]*disabled=""/); assert.match(textOf(pro), /Agent Pro and Max$/)
  assert.match(free, /data-build-mode="agent"[^>]*aria-describedby="([^"]+)"/); const id = /data-build-mode="agent"[^>]*aria-describedby="([^"]+)"/.exec(free)[1]; assert.ok(free.includes(`id="${id}"`), 'the reason is what Agent is described by')
  assert.match(html('picker', 'BuildModePicker', { value: 'agent', plan: 'premium' }, { texts }), /data-build-mode="agent"[^>]*aria-pressed="true"/); assert.match(html('picker', 'BuildModePicker', { value: 'standard', plan: 'pro' }, { texts }), /data-build-mode="standard"[^>]*aria-pressed="true"/)
  // a click: the picker answers with the mode it was given, and a disabled option is disabled for the browser
  const chosen = []; const t = tree('picker', 'BuildModePicker', { value: 'standard', plan: 'pro', onChange: m => chosen.push(m) }, { texts })
  const buttons = elements(t, el => el.props?.['data-build-mode']); deepEqual(buttons.map(b => b.props['data-build-mode']), ['standard', 'author', 'agent']); for (const b of buttons) b.props.onClick()
  deepEqual(chosen, ['standard', 'author', 'agent']); deepEqual(buttons.map(b => b.props.disabled), [false, false, false])
  const t2 = tree('picker', 'BuildModePicker', { value: 'standard', plan: 'free', onChange() {} }, { texts }); assert.equal(byProp(t2, 'data-build-mode', 'agent')[0].props.disabled, true); assert.equal(byProp(t2, 'data-build-mode', 'standard')[0].props.disabled, false)
  deepEqual(elements(tree('picker', 'BuildModePicker', { value: 'standard', plan: 'pro', disabled: true }, { texts }), el => el.props?.['data-build-mode']).map(b => b.props.disabled), [true, true, true], 'a busy host turns every option off')
  // build_mode on the wire: omitted unless chosen and allowed; "standard" only as an explicit switch back
  const both = { agent: true, author: true }, none = { agent: false, author: false }, wire = (mode, o = {}) => lib.buildModeOnWire(mode, { flags: both, ...o })
  assert.equal(wire('standard'), undefined, 'a build that never touched the picker carries no build_mode'); assert.equal(wire('standard', { previous: 'standard' }), undefined); assert.equal(wire('standard', { previous: 'author' }), 'standard'); assert.equal(wire('standard', { previous: 'agent' }), 'standard')
  assert.equal(wire('author'), 'author'); assert.equal(wire('author', { flags: { agent: true, author: false } }), undefined, 'Author without its flag is never sent'); assert.equal(wire('agent', { plan: 'pro' }), 'agent'); assert.equal(wire('agent', { plan: 'premium' }), 'agent')
  for (const plan of ['free', 'starter', 'max', null, undefined]) assert.equal(wire('agent', { plan }), undefined, `Agent is never sent for ${String(plan)}`)
  assert.equal(wire('agent', { plan: 'pro', flags: { agent: false, author: true } }), undefined, 'Agent without its flag is never sent')
  for (const mode of ['standard', 'author', 'agent']) assert.equal(lib.buildModeOnWire(mode, { flags: none, plan: 'premium' }), mode === 'standard' ? undefined : undefined, `flags off: ${mode} carries no build_mode`)
  assert.equal(libOf({}, texts).buildModeOnWire('agent', { plan: 'pro' }), undefined, 'with the flags off (the default flags) nothing is sent'); assert.equal(libOf({}, texts).buildModeOnWire('author'), undefined)
  deepEqual([...lib.BUILD_MODES], ['standard', 'author', 'agent'])
}
await check('the picker: Free, Starter and a plan not known see Agent disabled with a plain reason, Pro and Max can pick it, "max" is no plan key; Author only with its flag; a click answers with its mode; build_mode is omitted unless chosen and allowed, "standard" only as a switch back', () => provePicker())

// ===== E. the cards ================================================================================================================================
console.log('E. the cards')
function proveCards(texts = {}) {
  const lib = libOf(ENV_BOTH, texts), S = allStates(lib), calls = [], controls = []
  const props = state => ({ state, onAnswer: a => calls.push(a), onControl: c => controls.push(c) })
  const buttonsOf = (file, comp, state) => { const t = tree(file, comp, props(state), { texts }); return { answers: elements(t, el => el.props?.['data-agent-choice']), controls: elements(t, el => el.props?.['data-agent-control']), all: elements(t, el => el.props?.['data-studio-director-option']) } }
  // nothing is sent at render, for any card and any state; no card can be answered by a voice "yes"
  for (const [name, state] of Object.entries(S)) for (const [file, comp] of CARD_VIEWS) { tree(file, comp, props(state), { texts }); const m = html(file, comp, props(state), { texts }); assert.doesNotMatch(m, /data-director-action-id/, `${comp} / ${name}: no data-director-action-id (the voice call reads the cards that have one)`) }
  deepEqual(calls, [], 'a render sends nothing'); deepEqual(controls, [])
  // A1 is INFORMATION, not a gate (PK ruling: the Agent send is the spend click): no Start; one Stop, and it sends exactly A1 cancel (the wire contract is unchanged) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  const a1 = buttonsOf('estimate', 'AgentEstimateCard', S.estimate); deepEqual(a1.answers.map(b => b.props['data-agent-choice']), ['cancel'], 'one button, and it is not a Start'); deepEqual(a1.all.map(b => b.props['data-agent-choice']), ['cancel']); assert.equal(a1.answers[0].props['data-primary'], undefined, 'Stop is not the primary button'); for (const b of a1.answers) b.props.onClick() // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  deepEqual(calls.splice(0), [answer('A1', 'cancel')], 'a click on Stop sends exactly A1 cancel'); deepEqual(a1.answers.map(b => b.props.disabled), [false]) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  assert.match(textOf(html('estimate', 'AgentEstimateCard', { state: S.estimate }, { texts })), /^Agent build Estimated cost: About 470 credits · cap 600 credits · Running Stop$/, 'the card reads as information, with the one Stop'); assert.doesNotMatch(html('estimate', 'AgentEstimateCard', { state: S.estimate }, { texts }), /data-agent-choice="start"|>Start<|>Cancel</, 'no Start (and no Cancel) button') // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  deepEqual(buttonsOf('estimate', 'AgentEstimateCard', S['estimate answered']).answers.map(b => [b.props.disabled, b.props['data-answered']]), [[true, undefined]], 'once the estimate is answered Stop is off') // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  deepEqual(buttonsOf('estimate', 'AgentEstimateCard', { ...S.estimate, estimate: { ...S.estimate.estimate, answered: 'cancel' } }).answers.map(b => [b.props.disabled, b.props['data-answered']]), [[true, 'true']], 'a taken Stop is off and marked') // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  assert.equal(html('estimate', 'AgentEstimateCard', { state: S.estimate }, { texts }).includes('It may stop at the cap.'), false); assert.match(textOf(html('estimate', 'AgentEstimateCard', { state: S['estimate over the cap'] }, { texts })), /Estimated cost: About 900 credits · cap 600 credits · Running It may stop at the cap\./) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  for (const state of [S.running, S.done, S.idle, S.checkpoint, S['failed, no deck, credited back']]) assert.equal(html('estimate', 'AgentEstimateCard', { state }, { texts }), '', 'the estimate card is for the estimate only')
  // the run card: steps, meter, Pause / Resume / Stop
  const running = buttonsOf('run', 'AgentRunCard', S.running); deepEqual(running.controls.map(b => b.props['data-agent-control']), ['pause', 'stop']); for (const b of running.controls) b.props.onClick(); deepEqual(controls.splice(0), ['pause', 'stop']); deepEqual(running.answers, [])
  deepEqual(buttonsOf('run', 'AgentRunCard', S.paused).controls.map(b => b.props['data-agent-control']), ['resume', 'stop']); deepEqual(buttonsOf('run', 'AgentRunCard', S.stopped).controls.map(b => b.props['data-agent-control']), ['resume'], 'a stopped run can be resumed, not stopped again')
  for (const state of [S.done, S['failed, no deck, credited back']]) deepEqual(buttonsOf('run', 'AgentRunCard', state).controls, [], 'a finished run has no control')
  assert.equal(html('run', 'AgentRunCard', { state: S.idle }, { texts }), ''); assert.equal(html('run', 'AgentRunCard', { state: S.estimate }, { texts }), '', 'no run card before the paid click')
  const text = status => textOf(html('run', 'AgentRunCard', { state: S[status] }, { texts })); assert.match(text('stopped'), /Stopped\. Your slides are kept\./); assert.match(text('paused'), /Paused/); assert.match(text('done'), /Done/); assert.match(text('running'), /Working/)
  assert.match(html('run', 'AgentRunCard', { state: S.running }, { texts }), /data-studio-agent-step="done"[\s\S]*data-studio-agent-step="running"/); assert.equal(count(html('run', 'AgentRunCard', { state: S.done }, { texts }), 'data-studio-agent-step='), 4, 'every step is listed')
  // A3 and A4: two explicit answers each (continue / stop, add / skip), only a click sends, an answered card is off
  const a3 = buttonsOf('checkpoint', 'AgentCheckpointCard', S.checkpoint); deepEqual(a3.answers.map(b => b.props['data-agent-choice']), ['continue', 'stop']); for (const b of a3.answers) b.props.onClick(); deepEqual(calls.splice(0), [answer('A3', 'continue'), answer('A3', 'stop')])
  assert.match(textOf(html('checkpoint', 'AgentCheckpointCard', { state: S.checkpoint }, { texts })), /Continue with up to 120 more credits, or stop now\? Continue Stop now$/, 'a stop is a Stop (the run is resumable), so the words say stop, not finish')
  deepEqual(buttonsOf('checkpoint', 'AgentCheckpointCard', S['checkpoint answered']).answers.map(b => b.props.disabled), [true, true]); for (const state of [S.running, S['research offer'], S.done]) assert.equal(html('checkpoint', 'AgentCheckpointCard', { state }, { texts }), '')
  const a4 = buttonsOf('research', 'AgentResearchOfferCard', S['research offer']); deepEqual(a4.answers.map(b => b.props['data-agent-choice']), ['add', 'skip']); for (const b of a4.answers) b.props.onClick(); deepEqual(calls.splice(0), [answer('A4', 'add'), answer('A4', 'skip')])
  assert.match(textOf(html('research', 'AgentResearchOfferCard', { state: S['research offer'] }, { texts })), /Add it\? Add research Stop here$/, 'a skip is a Stop (the run stays stopped and asks again on Resume), so the words say stop')
  assert.equal(html('research', 'AgentResearchOfferCard', { state: S.checkpoint }, { texts }), ''); assert.match(textOf(html('research', 'AgentResearchOfferCard', { state: S['research offer one slide'] }, { texts })), /Deeper research on slide 4 adds about 1 credit\. Add it\?/)
  // A6: what failed (a reason code, in its plain sentence), what was charged and credited back; NO SILENT FALLBACK
  const offered = S['failed with a fallback offered'], none = S['failed, no deck, credited back']
  const f1 = buttonsOf('failed', 'AgentFailedCard', offered); deepEqual(calls, [], 'a failed run with a fallback offered sends nothing by itself'); deepEqual(f1.answers.map(b => b.props['data-agent-choice']), ['fallback', 'stop'], 'the fallback is an explicit button, beside "keep what is built"')
  assert.match(textOf(html('failed', 'AgentFailedCard', { state: offered }, { texts })), /Build the rest with the standard build, about 80 credits\?/, 'with its price'); for (const b of f1.answers) b.props.onClick(); deepEqual(calls.splice(0), [answer('A6', 'fallback'), answer('A6', 'stop')])
  const f2 = buttonsOf('failed', 'AgentFailedCard', none); deepEqual(f2.answers.map(b => b.props['data-agent-choice']), ['stop'], 'no fallback offered: the one explicit button is OK'); assert.equal(textOf(html('failed', 'AgentFailedCard', { state: none }, { texts })).includes('standard build'), false); deepEqual(calls, [])
  deepEqual(buttonsOf('failed', 'AgentFailedCard', S['failed answered']).answers.map(b => b.props.disabled), [true, true]); assert.match(textOf(html('failed', 'AgentFailedCard', { state: S['failed, nothing charged'] }, { texts })), /The agent stopped\. The build reached its credit cap\. Nothing was charged\. No slides were built\. OK$/)
  assert.match(textOf(html('failed', 'AgentFailedCard', { state: none }, { texts })), /The build reached its credit cap\. Charged 300 credits\. 300 credits credited back\. No slides were built\./); assert.match(textOf(html('failed', 'AgentFailedCard', { state: offered }, { texts })), /Charged 300 credits\. 4 slides are kept\./)
  for (const state of [S.running, S.done, S.checkpoint]) assert.equal(html('failed', 'AgentFailedCard', { state }, { texts }), '')
  // the composite: the right card for each state, one of each, in order
  const cards = state => [...html('cards', 'AgentRunCards', { state }, { texts }).matchAll(/data-studio-agent-card="(\w+)"/g)].map(m => m[1])
  deepEqual(cards(S.estimate), ['estimate']); deepEqual(cards(S.running), ['run']); deepEqual(cards(S.checkpoint), ['run', 'checkpoint']); deepEqual(cards(S['research offer']), ['run', 'research_offer']); deepEqual(cards(S['failed, no deck, credited back']), ['run', 'failed']); deepEqual(cards(S.done), ['run']); deepEqual(cards(S.idle), [])
  deepEqual(cards(S['stopped, then a checkpoint']), ['run', 'checkpoint'], 'a card after a stop shows beside the run card'); deepEqual(cards(S['stopped, then a research offer']), ['run', 'research_offer'])
  // the card words are the existing question card's parts (so the shell's styles apply), with no new colour
  const m = html('cards', 'AgentRunCards', { state: S.checkpoint }, { texts }); assert.match(m, /data-studio-director-ask="agent"/); assert.match(m, /data-studio-director-part="heading"/); assert.match(m, /data-studio-director-part="actions"/); assert.match(m, /data-studio-director-option="action"/)
  assert.doesNotMatch(m, /#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/, 'no colour literal in the markup'); assert.doesNotMatch(m.replace(/var\(--ss-(?:line|accent)\)/g, ''), /style="[^"]*(?:color|background)/, 'the only inline style is the meter width')
  // the answer a click makes, as a frame: the contract's envelope and card ids
  deepEqual(lib.agentAnswerFrame(answer('A1', 'start')), { type: 'agent_answer', data: { run_id: RUN, card: 'A1', choice: 'start' } }); assert.equal(lib.agentAnswerValid(answer('A1', 'start')), true)
  for (const bad of [{ runId: '', card: 'A1', choice: 'start' }, answer('A3', 'finish'), answer('A3', 'standard'), answer('A4', 'keep'), { runId: RUN, card: 'toString', choice: 'start' }, answer('A6', 'dismiss'), answer('A6', 'keep'), answer('A6', 'standard'), answer('estimate', 'start'), answer('checkpoint', 'continue'), answer('failed', 'stop'), answer('A2', 'stop')]) assert.equal(lib.agentAnswerValid(bad), false, JSON.stringify(bad))
}
await check('the cards: nothing is sent at render and no card has data-director-action-id; A1 Start / Cancel, A3 Continue / Stop now, A4 Add research / Stop here, Pause / Resume / Stop; an answered card is off; A6 says what failed (a code in its plain sentence), what was charged and credited back, and a fallback is only ever an explicit button with its price (none offered: OK)', () => proveCards())

// ===== J. the contract: AGENT-1's fixture ==========================================================================================================
console.log('J. the contract (AGENT-1\'s fixture)')
const FIXTURE_BLOB = 'cbd263a541d69d27c7edef52272b2ecabc0e62df', FIXTURE_SIZE = 9997
const gitBlobId = bytes => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') // the id git hash-object gives a file with these bytes
/** The fixture is AGENT-1's, byte for byte: its size and its git blob id (Director repo, tests/fixtures/agent_frames_contract.json at 476a5617d68c5c76598700cf8172d1fbe5ca4b23). A reformatted copy fails. */
function proveFixtureBytes(bytes) {
  assert.equal(bytes.length, FIXTURE_SIZE, 'the fixture is 9997 bytes'); assert.equal(gitBlobId(bytes), FIXTURE_BLOB, 'the fixture is the Director file, byte for byte (git blob cbd263a5)')
  assert.equal(bytes.includes(0x0d), false, 'no carriage return'); assert.equal(bytes.at(-2), 0x7d, 'it ends as the Director file does (a closing brace, one final newline)'); assert.equal(bytes.at(-1), 0x0a)
}
await check('the contract fixture is AGENT-1\'s file byte for byte (9997 bytes, git blob cbd263a5), at tests/fixtures/agent_frames_contract.json; its own header names the six frames, the answer and its version', () => {
  proveFixtureBytes(FIXTURE_BYTES); assert.equal(AGENT_MODE_SHELL_FIXTURE, 'tests/fixtures/agent_frames_contract.json'); assert.equal(FIX.version, 1)
  deepEqual(Object.keys(FIX.frames), ['agent_estimate', 'agent_step', 'agent_checkpoint', 'agent_research_offer', 'agent_failed', 'agent_done']); assert.equal(FIX.answer.type, 'agent_answer'); assert.equal(FIX.reason_codes.length, 50); assert.equal(FIX.step_labels.length, 13)
  assert.equal(gitBlobId(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a', 'positive control: the blob id function is git\'s (the id of "hello\\n")')
  const ranTest = execFileSync('git', ['hash-object', '--no-filters', '--', path.join(root, AGENT_MODE_SHELL_FIXTURE)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim(); assert.equal(ranTest, FIXTURE_BLOB, 'git hash-object of the file (a file argument) agrees')
})

const IGNORED_FIELDS = { agent_done: ['presentation_id'] } // the deck's own id: the deck arrives through the normal frames
const FORGIVEN_FIELDS = ['step_state', 'run_status', 'reason'] // an unknown state is dropped; an unknown or missing reason says "Something went wrong."
function proveContract(texts = {}) {
  const lib = libOf(ENV_BOTH, texts), R = lib.agentRunReducer
  // every example is read, with exactly the fixture's field names; required and optional fields, wrong types
  for (const [type, def] of Object.entries(FIX.frames)) {
    const ex = def.example, ignored = IGNORED_FIELDS[type] ?? [], names = Object.keys(def.fields), used = names.filter(n => !ignored.includes(n)); assert.equal(ex.type, type); deepEqual(Object.keys(ex.payload).sort(), names.sort(), `${type}: the fixture's example holds every field`)
    const parsed = lib.readAgentFrame(ex); assert.ok(parsed, `${type}: the fixture's own example is read`); assert.equal(parsed.type, type); deepEqual(Object.keys(parsed.payload).sort(), used.sort(), `${type}: the reader reads the fixture's field names, and no others`)
    for (const name of used) deepEqual(parsed.payload[name], ex.payload[name], `${type}.${name} is read as sent`)
    for (const [name, spec] of Object.entries(def.fields)) {
      const dropped = lib.readAgentFrame({ type, payload: omit(ex.payload, name) })
      if (ignored.includes(name) || name === 'reason' || !spec.required) assert.ok(dropped, `${type}.${name} may be missing`); else assert.equal(dropped, null, `${type}.${name} is required: without it the frame is refused`)
      if (ignored.includes(name) || FORGIVEN_FIELDS.includes(name)) continue
      const wrong = { string: 7, integer: 'x', 'string[]': 'x', 'integer[]': 'x' }[spec.type]; assert.notEqual(wrong, undefined, `${type}.${name}: a known fixture type`)
      assert.equal(lib.readAgentFrame({ type, payload: { ...ex.payload, [name]: wrong } }), null, `${type}.${name} is ${spec.type}: a ${typeof wrong} is refused`)
    }
  }
  for (const bad of ['not a date', '', 'tomorrow', '2026-13-45T00:00:00Z', 'x'.repeat(100)]) assert.equal(lib.readAgentFrame(est({ expires_at: bad })), null, `expires_at ${JSON.stringify(bad.slice(0, 20))} is not a date: the estimate is refused (it would never expire)`)
  for (const good of ['2026-11-09T12:05:00Z', '2026-11-09T12:05:00.250+00:00', '2026-11-09T07:05:00-05:00']) assert.equal(lib.readAgentFrame(est({ expires_at: good })).payload.expires_at, good, `expires_at ${good} is read as sent`)
  assert.ok(lib.readAgentFrame({ type: 'agent_estimate', payload: { ...EX('agent_estimate'), model: 'a-model' } }), 'a model field, if one is sent, is ignored'); assert.equal(Object.keys(lib.readAgentFrame({ type: 'agent_estimate', payload: { ...EX('agent_estimate'), model: 'a-model' } }).payload).includes('model'), false)
  // a count is not a list (agent_done.slides), a list is not a count (agent_research_offer.slides)
  assert.equal(lib.readAgentFrame(fx('agent_done', { slides: [3, 4, 5] })), null, 'agent_done.slides is a COUNT: a list is refused'); assert.equal(lib.readAgentFrame(fx('agent_research_offer', { slides: 3 })), null, 'agent_research_offer.slides is a list: a count is refused'); assert.equal(lib.readAgentFrame(fx('agent_done')).payload.slides, 12)
  // the states and statuses of the fixture are read, and an unknown one is dropped
  for (const v of FIX.step_states) assert.equal(lib.readAgentFrame(stepF(1, 'x', { step_state: v })).payload.step_state, v); for (const v of FIX.run_statuses) assert.equal(lib.readAgentFrame(stepF(1, 'x', { run_status: v })).payload.run_status, v)
  for (const v of ['sleeping', 7, null, 'RUNNING', 'done']) assert.equal('run_status' in lib.readAgentFrame(stepF(1, 'x', { run_status: v })).payload, false, `run_status ${JSON.stringify(v)} is dropped`); for (const v of ['sleeping', 7, null, 'paused']) assert.equal('step_state' in lib.readAgentFrame(stepF(1, 'x', { step_state: v })).payload, false, `step_state ${JSON.stringify(v)} is dropped`)
  const s0 = run(lib, [est(), stepF(1, 'Planning the build')]); for (const v of FIX.run_statuses) assert.equal(R(s0, stepF(1, 'Planning the build', { run_status: v })).status, v, `run_status ${v} is the run's status`)
  for (const v of FIX.step_states) assert.equal(R(s0, stepF(1, 'Planning the build', { step_state: v })).steps[0].stepState, v, `step_state ${v} is the step's own state`)
  assert.equal(R(s0, stepF(1, 'Planning the build', { step_state: 'failed' })).status, 'running', 'a failed step is not a failed run')
  // the 13 step labels: read as sent (no HTML, model, provider, $ or tokens in them), and drawn
  const labels = FIX.step_labels.map((label, i) => label.replace('{n}', String(i + 3))); assert.equal(labels.some(l => l.includes('{')), false)
  let steps = lib.initialAgentRunState(); labels.forEach((label, i) => { assert.equal(lib.readAgentFrame(stepF(i + 1, label)).payload.label, label, `label ${JSON.stringify(label)} is read as sent`); assert.equal(lib.plainWords(label, '#'), label); assert.doesNotMatch(label, LEAK); steps = R(steps, stepF(i + 1, label)) })
  deepEqual(steps.steps.map(x => x.label), labels); const drawn = textOf(html('run', 'AgentRunCard', { state: steps }, { texts })); for (const label of labels) assert.ok(drawn.includes(label), `the run card draws ${label}`)
  assert.equal(R(lib.initialAgentRunState(), stepF(1, 'Calling a model for $5')).steps[0].label, 'Working on your deck', 'a label with a model, provider, $ or token is the fallback "Working on your deck"'); assert.equal(R(lib.initialAgentRunState(), stepF(1, '<b>Planning</b> the build')).steps[0].label, 'Planning the build', 'no HTML')
  // the 50 reason codes: one plain sentence each, credits only; an unknown code is "Something went wrong."
  deepEqual(Object.keys(lib.AGENT_REASON_WORDS).sort(), [...FIX.reason_codes].sort(), 'the sentences are the fixture\'s 50 reason codes, both ways'); const sentences = Object.entries(lib.AGENT_REASON_WORDS)
  assert.equal(sentences.length, 50); assert.equal(new Set(sentences.map(([, w]) => w)).size, 50, 'each code has its own sentence')
  for (const code of FIX.reason_codes) {
    const words = lib.AGENT_REASON_WORDS[code]; assert.equal(typeof words, 'string', code); assert.ok(words.length >= 8 && words.length <= 90 && /^[A-Z]/.test(words) && /[.]$/.test(words), `${code}: one short sentence (${JSON.stringify(words)})`)
    assert.equal(lib.plainWords(words, '#'), words, `${code}: plainWords accepts the sentence`); assert.doesNotMatch(words, LEAK, `${code}: no model, provider, currency, token, cost, price or router name`); assert.equal(lib.agentReasonWords(code), words)
    const failed = R(run(lib, [est()]), failF({ reason: code })); assert.equal(failed.failure.reason, words, `${code}: the failed card holds its sentence`); const card = html('failed', 'AgentFailedCard', { state: failed }, { texts }), reasonPart = /data-studio-director-part="reason"[^>]*>([^<]*)</.exec(card); assert.ok(reasonPart, `${code}: the reason line is there`); assert.equal(textOf(reasonPart[1]), words.replace(/'/g, "'"), `${code}: the reason line is exactly its sentence, never the code`)
  }
  assert.equal(lib.agentReasonWords('tier'), 'Agent build is on Pro and Max plans.'); assert.equal(lib.agentReasonWords('credit_cap'), 'The build reached its credit cap.'); assert.equal(lib.agentReasonWords('credit_cap'), lib.agentReasonWords(EX('agent_failed').reason))
  for (const code of ['brand_new_code', 'CREDIT_CAP', 'credit_cap ', ' credit_cap', 'toString', '__proto__', 'constructor', 'hasOwnProperty', 'valueOf', '', 'The model returned a token error', 'openrouter_error', 7, null, undefined, {}, ['tier']]) assert.equal(lib.agentReasonWords(code), 'Something went wrong.', `an unknown code ${JSON.stringify(code)} shows "Something went wrong."`)
  assert.equal(R(run(lib, [est()]), failF({ reason: 'brand_new_code' })).failure.reason, 'Something went wrong.'); assert.equal(R(run(lib, [est()]), fx('agent_failed', { reason: undefined })).failure.reason, 'Something went wrong.', 'no reason at all'); assert.equal(R(run(lib, [est()]), failF({ reason: 7 })).failure.reason, 'Something went wrong.')
  // the answer envelope, the card ids and the choices are the fixture's
  const ans = FIX.answer; deepEqual(Object.keys(ans.example.data).sort(), Object.keys(ans.fields).sort()); deepEqual(lib.agentAnswerFrame({ runId: ans.example.data.run_id, card: ans.example.data.card, choice: ans.example.data.choice }), ans.example, 'the answer example is exactly the frame the shell makes')
  deepEqual(JSON.parse(JSON.stringify(lib.AGENT_ANSWER_CHOICES)), ans.choices, 'the card ids and the choices are the fixture\'s: A1 start / cancel, A3 continue / stop, A4 add / skip, A6 fallback / stop')
  for (const [card, choices] of Object.entries(ans.choices)) for (const choice of choices) { const a = { runId: RUN, card, choice }; assert.equal(lib.agentAnswerValid(a), true, `${card} ${choice}`); deepEqual(lib.agentAnswerFrame(a), { type: ans.type, data: { run_id: RUN, card, choice } }); deepEqual(Object.keys(lib.agentAnswerFrame(a).data), Object.keys(ans.fields)) }
  for (const [card, choices] of Object.entries(ans.choices)) for (const [other, theirs] of Object.entries(ans.choices)) for (const choice of theirs) if (!choices.includes(choice)) assert.equal(lib.agentAnswerValid({ runId: RUN, card, choice }), false, `${card} does not take ${choice} (${other}'s)`)
  deepEqual(JSON.parse(JSON.stringify(lib.readAgentFrame(EX_FRAME('agent_checkpoint')).payload.choices)), FIX.frames.agent_checkpoint.example.payload.choices); deepEqual(JSON.parse(JSON.stringify(lib.readAgentFrame(EX_FRAME('agent_research_offer')).payload.choices)), FIX.frames.agent_research_offer.example.payload.choices)
}
const EX_FRAME = type => ({ type, payload: EX(type) })
await check('the contract: every fixture example is read with exactly the fixture\'s field names; required and optional fields and wrong types behave as its flags say; a count is not a list; the 13 step labels and the 3 + 3 states are read; the 50 reason codes each have one clean sentence and an unknown code says "Something went wrong."; the answer envelope, the card ids and the choices equal the fixture\'s', () => proveContract())

/** Every card driven from the fixture's own examples, in the order a run goes: the words, the buttons, the answers a click makes (each equal to the fixture's envelope), the state after each. */
function proveExamples(texts = {}) {
  const lib = libOf(ENV_BOTH, texts), R = lib.agentRunReducer, calls = [], onAnswer = a => calls.push(a) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  const choicesOf = (file, comp, props) => { const t = tree(file, comp, { ...props, onAnswer }, { texts }); return elements(t, el => el.props?.['data-agent-choice']) }
  const click = (file, comp, props) => { const buttons = choicesOf(file, comp, props); for (const b of buttons) b.props.onClick(); return buttons.map(b => b.props['data-agent-choice']) }
  const frames = calls => calls.map(c => lib.agentAnswerFrame(c))
  // A1, the estimate: "Estimated cost: About N credits · cap M credits · Running", one Stop (it sends cancel) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  let s = R(lib.initialAgentRunState(), EX_FRAME('agent_estimate')); assert.equal(s.status, 'estimate'); assert.equal(s.runId, RUN); deepEqual(s.estimate, { credits: 470, expiresAt: '2026-11-09T12:05:00Z', answered: null }); assert.equal(s.capCredits, 600)
  assert.match(textOf(html('cards', 'AgentRunCards', { state: s }, { texts })), /^Agent build Estimated cost: About 470 credits · cap 600 credits · Running Stop$/) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  deepEqual(click('estimate', 'AgentEstimateCard', { state: s }), ['cancel'], 'A1: one Stop (the fixture\'s expires_at is long past: the card does not read it)'); deepEqual(frames(calls.splice(0)), [{ type: 'agent_answer', data: { run_id: RUN, card: 'A1', choice: 'cancel' } }]) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  // the step: the label in plain words, both states, the run's totals
  s = R(s, EX_FRAME('agent_step')); assert.equal(s.status, 'running'); deepEqual(s.steps, [{ n: 4, label: 'Rebuilding slide 4', stepState: 'running' }]); assert.equal(s.usedCredits, 340); assert.equal(s.capCredits, 600); assert.equal(s.estimate, null)
  assert.match(textOf(html('run', 'AgentRunCard', { state: s }, { texts })), /340 of 600 credits Rebuilding slide 4 Working Pause Stop/)
  // A3, the checkpoint: "340 of 600 credits used. Continue with up to 260 more credits, or stop now?", Continue / Stop now
  const a3 = R(s, EX_FRAME('agent_checkpoint')); deepEqual(a3.pending, { kind: 'checkpoint', usedCredits: 340, moreCredits: 260, capCredits: 600, answered: null })
  assert.match(textOf(html('checkpoint', 'AgentCheckpointCard', { state: a3 }, { texts })), /^Agent build 340 of 600 credits used\. Continue with up to 260 more credits, or stop now\? Continue Stop now$/)
  deepEqual(click('checkpoint', 'AgentCheckpointCard', { state: a3 }), FIX.answer.choices.A3, 'A3: the fixture\'s choices'); deepEqual(frames(calls.splice(0)), FIX.answer.choices.A3.map(choice => ({ type: 'agent_answer', data: { run_id: RUN, card: 'A3', choice } })))
  deepEqual(frames([{ runId: RUN, card: 'A3', choice: 'continue' }]), [FIX.answer.example], 'the fixture\'s own answer example')
  // A4, the research offer: "Deeper research on slides 3-5 adds about 40 credits. Add it?", Add research / Stop here
  const a4 = R(s, EX_FRAME('agent_research_offer')); deepEqual(a4.pending, { kind: 'research_offer', slides: [3, 4, 5], estCredits: 40, answered: null })
  assert.match(textOf(html('research', 'AgentResearchOfferCard', { state: a4 }, { texts })), /^Agent build Deeper research on slides 3–5 adds about 40 credits\. Add it\? Add research Stop here$/)
  deepEqual(click('research', 'AgentResearchOfferCard', { state: a4 }), FIX.answer.choices.A4, 'A4: the fixture\'s choices'); deepEqual(frames(calls.splice(0)), FIX.answer.choices.A4.map(choice => ({ type: 'agent_answer', data: { run_id: RUN, card: 'A4', choice } })))
  // A6, the failure: the reason code in its sentence, charged, kept, and the priced fallback OFFERED (never started)
  const a6 = R(s, EX_FRAME('agent_failed')); assert.equal(a6.status, 'failed'); deepEqual(a6.failure, { step: 7, reason: 'The build reached its credit cap.', chargedCredits: 120, creditedBackCredits: 0, slidesKept: 3, fallbackCredits: 80, answered: null })
  assert.match(textOf(html('failed', 'AgentFailedCard', { state: a6 }, { texts })), /^Agent build The agent stopped at step 7\. The build reached its credit cap\. Charged 120 credits\. 3 slides are kept\. Build the rest with the standard build, about 80 credits\? Build the rest Keep what is built$/)
  deepEqual(calls, [], 'A6 sends nothing by itself'); deepEqual(click('failed', 'AgentFailedCard', { state: a6 }), FIX.answer.choices.A6, 'A6: the fixture\'s choices'); deepEqual(frames(calls.splice(0)), FIX.answer.choices.A6.map(choice => ({ type: 'agent_answer', data: { run_id: RUN, card: 'A6', choice } })))
  // the done frame: slides is a COUNT, charged_credits the total
  const done = R(s, EX_FRAME('agent_done')); assert.equal(done.status, 'done'); assert.equal(done.doneSlides, 12); assert.equal(done.usedCredits, 412); assert.match(textOf(html('run', 'AgentRunCard', { state: done }, { texts })), /412 of 600 credits Rebuilding slide 4 Done$/)
  // every card id of the fixture was driven
  deepEqual(Object.keys(FIX.answer.choices), ['A1', 'A3', 'A4', 'A6'])
}
await check('every card driven from the fixture\'s own examples, in the order a run goes (A1 estimate with its expires_at, step, A3, A4, A6 with its fallback offer, done): the words, the buttons, and each answer a click makes equals the fixture\'s envelope', () => proveExamples())

/** The estimate card is information (PK ruling: the Agent send is the spend click): it does not read the estimate's expires_at. Past it, ahead of it, or none: the same card with the one Stop on, no timer and no hook. The lib's own rule (estimateExpired, and the answer guard that refuses a late A1 start but never a cancel) is unchanged. */ // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
function proveEstimateInfo(texts = {}) { // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  const lib = libOf(ENV_BOTH, texts), S = allStates(lib), T0 = Date.parse(EX('agent_estimate').expires_at), state = S['estimate with an expiry'], calls = [], onAnswer = a => calls.push(a)
  // LATER-CHANGES: registry read (AGENT-MODE-WIRE): #607's view / start / cancel closures (the card read a clock) are not here: the estimate card does not read expires_at
  assert.equal(lib.estimateExpired('2026-11-09T12:05:00Z', T0 - 1), false); assert.equal(lib.estimateExpired('2026-11-09T12:05:00Z', T0), true, 'at the instant it has passed'); assert.equal(lib.estimateExpired('2026-11-09T12:05:00Z', T0 + 1), true)
  for (const none of [undefined, null, '', 'not a date', 7]) assert.equal(lib.estimateExpired(none, T0 + 1e9), false, `no usable expires_at: never expired (${JSON.stringify(none)})`)
  // the card is the same with an expiry long past (the fixture's), far ahead, or none: Stop is on and one click sends A1 cancel // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  const card = (st, extra = {}) => html('estimate', 'AgentEstimateCard', { state: st, onAnswer, ...extra }, { texts }), stop = st => byProp(tree('estimate', 'AgentEstimateCard', { state: st, onAnswer }, { texts }), 'data-agent-choice', 'cancel')[0] // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  for (const [label, st] of [['an expiry long past', state], ['no expiry', S.estimate], ['an expiry far ahead', run(lib, [est({ expires_at: '2999-01-01T00:00:00Z' })])]]) { // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
    assert.match(textOf(card(st)), /^Agent build Estimated cost: About 470 credits · cap 600 credits · Running Stop$/, `${label}: the same card`); assert.equal(card(st).includes('expired'), false, `${label}: no expired line`); assert.doesNotMatch(card(st), /data-agent-choice="start"/, `${label}: no Start`) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
    assert.equal(stop(st).props.disabled, false, `${label}: Stop is on`); stop(st).props.onClick(); deepEqual(calls.splice(0), [answer('A1', 'cancel')], `${label}: a click on Stop sends A1 cancel`) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  }
  assert.equal(card(state, { now: T0 + 1 }), card(state), 'a clock handed in changes nothing'); assert.doesNotMatch(textOf(html('cards', 'AgentRunCards', { state, now: T0 + 1 }, { texts })), /expired|ask again/i, 'the composite says nothing about an expiry either') // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  // the lib's guard is as it was: a start is refused from the expiry on (it can only come from outside the card now), a cancel never // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  assert.equal(lib.agentAnswerOpenCard(state, answer('A1', 'start'), T0 - 1), true); assert.equal(lib.agentAnswerOpenCard(state, answer('A1', 'start'), T0), false); assert.equal(lib.agentAnswerOpenCard(state, answer('A1', 'cancel'), T0 + 1e6), true, 'a cancel is never expiry-gated') // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  // no timer and no hook: every hook is counted and every effect is run, with the timers spied; a draw for an expiry still ahead sets none // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  const hooks = { n: 0 }, spy = { ...stubReact, __tag: 'spy', useState: init => { hooks.n++; return [typeof init === 'function' ? init() : init, () => {}] }, useEffect: fn => { hooks.n++; fn() } } // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  const mod = load(FILE.estimate, { env: ENV_BOTH, texts, react: spy }), saved = { ...timers }, log = [] // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  try {
    timers.set = (...a) => { log.push(['set', a[1]]); return 7 }; timers.clear = id => log.push(['clear', id]) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
    for (const st of [state, S.estimate, S['estimate answered'], run(lib, [est({ expires_at: new Date(Date.now() + 5000).toISOString() })])]) { hooks.n = 0; const el = mod.AgentEstimateCard({ state: st, onAnswer }); el.type(el.props); assert.equal(hooks.n, 0, 'the estimate card uses no React hook') } // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
    deepEqual(log, [], 'and sets no timer') // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
  } finally { Object.assign(timers, saved) }
}
await check('the estimate is information, not a gate: the card does not read expires_at (an expiry long past, far ahead or none: the same card, Stop on, one click sends A1 cancel, no expired line, no timer, no hook); the lib guard still refuses a late start and never a cancel', () => proveEstimateInfo()) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)

/** Reducer note 1 (AGENT-1, 9 Nov): an A3 / A4 card arrives AFTER run_status "stopped": the run is stopped and resumable while the card shows, the run card stays open, and answering goes back to running. "stopped" is final only when no card follows. */
function proveStopped(texts = {}) {
  const lib = libOf(ENV_BOTH, texts), R = lib.agentRunReducer, mid = run(lib, SCRIPT_OK.slice(0, 5))
  const cardsOf = state => [...html('cards', 'AgentRunCards', { state }, { texts }).matchAll(/data-studio-agent-card="(\w+)"/g)].map(m => m[1]), runText = state => textOf(html('run', 'AgentRunCard', { state }, { texts })), controls = state => elements(tree('run', 'AgentRunCard', { state }, { texts }), el => el.props?.['data-agent-control']).map(b => b.props['data-agent-control'])
  const stopped = R(mid, stepF(3, 'Researching slides 3 to 5', { run_status: 'stopped' })); assert.equal(stopped.status, 'stopped'); assert.equal(stopped.pending, null)
  deepEqual(cardsOf(stopped), ['run'], 'stopped with no card following: just the run card, saying so'); assert.match(runText(stopped), /Stopped\. Your slides are kept\./); deepEqual(controls(stopped), ['resume'])
  assert.equal(R(stopped, stepF(4, 'Building your slides')).status, 'running', 'and it can be resumed'); assert.equal(R(stopped, doneF()).status, 'done', 'a stopped run that finishes is done'); assert.equal(R(stopped, failF()).status, 'failed')
  for (const [card, frame, kind, yes, no, shown] of [['A3', checkF(), 'checkpoint', 'continue', 'stop', 'checkpoint'], ['A4', offerF(), 'research_offer', 'add', 'skip', 'research_offer']]) {
    const open = R(stopped, frame); assert.equal(open.status, 'stopped', `${card}: the run stays stopped while the card shows`); assert.equal(open.pending.kind, kind); assert.equal(open.pending.answered, null); assert.equal(open.runId, RUN); assert.equal(open.steps.length, 3, `${card}: the run card keeps its steps`)
    deepEqual(cardsOf(open), ['run', shown], `${card}: the run card stays open and the card shows`); assert.match(runText(open), /Stopped\. Your slides are kept\./); deepEqual(controls(open), ['resume'])
    const resumed = R(open, lib.agentAnswered(answer(card, yes))); assert.equal(resumed.status, 'running', `${card} ${yes}: the answer goes back to running`); assert.equal(resumed.pending.answered, yes); assert.match(runText(resumed), /Working/); deepEqual(controls(resumed), ['pause', 'stop'])
    assert.equal(R(resumed, lib.agentAnswered(answer(card, no))), resumed, `${card}: a second answer changes nothing`); assert.equal(R(resumed, stepF(4, 'Building your slides', { run_status: 'running' })).pending, null, `${card}: the run's next step carries on and the answered card is gone`)
    const kept = R(open, lib.agentAnswered(answer(card, no))); assert.equal(kept.status, 'stopped', `${card} ${no}: a Stop: the run stays stopped (resumable)`); assert.equal(kept.pending.answered, no); deepEqual(controls(kept), ['resume'])
    const paused = R(R(mid, stepF(3, 'Researching slides 3 to 5', { run_status: 'paused' })), frame); assert.equal(paused.status, 'paused'); assert.equal(R(paused, lib.agentAnswered(answer(card, yes))).status, 'running', `${card}: a paused run answered goes back to running`)
    const live = R(mid, frame); assert.equal(live.status, 'running'); assert.equal(R(live, lib.agentAnswered(answer(card, yes))).status, 'running'); assert.equal(R(live, lib.agentAnswered(answer(card, no))).status, 'stopped', `${card} ${no}: a Stop stops a run that was still showing as running`)
    const done = run(lib, SCRIPT_OK); assert.equal(R(done, frame), done, `${card}: a card never revives a run that is done`); const failed = run(lib, SCRIPT_FAIL); assert.equal(R(failed, frame), failed); assert.equal(R(done, lib.agentAnswered(answer(card, yes))), done)
    assert.equal(R(open, lib.agentAnswered({ runId: OTHER, card, choice: yes })), open, 'another run\'s answer changes nothing'); assert.equal(R(open, lib.agentAnswered(answer(card === 'A3' ? 'A4' : 'A3', yes === 'continue' ? 'add' : 'continue'))), open, 'the other card\'s answer changes nothing')
  }
}
await check('reducer note 1: a stopped run followed by an A3 / A4 card stays open (the run card and the card both show, the run is stopped and resumable); an answer continue / add goes back to running (also from paused); stop / skip stay stopped; stopped with no card is just stopped; a card never revives a done or failed run', () => proveStopped())

/** Reducer note 2 (AGENT-1, 9 Nov): answers go only on the signed socket and are never queued for replay after a reconnect. The drafted hook lines H7 and P7 are run against fake sockets. */
function proveAnswerPath(texts = {}, drafts = AGENT_MODE_SHELL_DRAFTS) {
  const lib = libOf(ENV_BOTH, texts), S = allStates(lib), ok = answer('A3', 'continue')
  assert.equal(lib.agentAnswerSendable(ok, true), true); for (const open of [false, undefined, null, 1, 0, 'true', {}]) assert.equal(lib.agentAnswerSendable(ok, open), false, `a socket that is not exactly open (${JSON.stringify(open)}) sends nothing`)
  for (const bad of [answer('A3', 'finish'), answer('estimate', 'start'), { runId: '', card: 'A3', choice: 'continue' }, answer('A6', 'keep')]) assert.equal(lib.agentAnswerSendable(bad, true), false, `${JSON.stringify(bad)}: not valid, not sent even on an open socket`)
  // the drafted hook lines: no queue, no retry, no replay (code only: the comments are taken out)
  const h7 = drafts.find(d => d.id === 'H7'), p7 = drafts.find(d => d.id === 'P7'), codeOnly = h7.add.map(line => line.replace(/\s\/\/ .*$/, '')).join('\n')
  assert.doesNotMatch(codeOnly, /setTimeout|setInterval|\.push\(|queue|outbox|pending|retry|replay|localStorage|sessionStorage|Ref\.current\s*=/i, 'H7 holds no queue, timer or storage'); assert.match(codeOnly, /agentAnswerSendable\(answer, socket\.readyState === WebSocket\.OPEN\)/, 'H7 sends only through the guard, on the socket that is open now')
  assert.match(codeOnly, /\bsocket\.send\(JSON\.stringify\(agentAnswerFrame\(answer\)\)\)/); assert.equal((codeOnly.match(/\.send\(/g) ?? []).length, 1, 'one send, no retry')
  const code = ts.transpileModule(h7.add.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, wsRef = { current: null }
  const send = vm.runInNewContext(`${code}\nsendAgentAnswer`, { wsRef, WebSocket: { OPEN: 1 }, useCallback: fn => fn, agentAnswerFrame: lib.agentAnswerFrame, agentAnswerSendable: lib.agentAnswerSendable, JSON })
  const socket = readyState => { const sent = []; return { readyState, sent, send(text) { sent.push(JSON.parse(text)) } } }
  const open = socket(1); wsRef.current = open; assert.equal(send(ok), true); deepEqual(open.sent, [FIX.answer.example], 'an open socket gets exactly the contract\'s envelope, once')
  const down = [socket(0), socket(2), socket(3)]; for (const s of down) { wsRef.current = s; assert.equal(send(ok), false, `readyState ${s.readyState}: not sent`); deepEqual(s.sent, []) }
  wsRef.current = null; assert.equal(send(ok), false, 'no socket: not sent')
  const reconnected = socket(1); wsRef.current = reconnected; deepEqual(reconnected.sent, [], 'after a reconnect nothing is replayed'); for (const s of down) s.readyState = 1; deepEqual(down.flatMap(s => s.sent), [], 'a socket that comes back sends nothing it was refused')
  assert.equal(send({ ...ok, choice: 'finish' }), false); deepEqual(reconnected.sent, [], 'an invalid answer is not sent on an open socket either')
  const boom = { readyState: 1, sends: 0, send() { this.sends++; throw new Error('closed') } }; wsRef.current = boom; assert.equal(send(ok), false, 'a send that throws is false'); assert.equal(boom.sends, 1, 'and is not retried')
  // P7: the card is marked answered only when the answer went out, and only for the card that is open now
  const p7code = p7.add.join('\n'); assert.match(p7code, /agentAnswerOpenCard\(agentRun, answer\) && sendAgentAnswer\(answer\)\) dispatchAgentRun\(agentAnswered\(answer\)\)/, 'P7 marks the card answered only after a send')
  const open1 = S.checkpoint, now = Date.now()
  assert.equal(lib.agentAnswerOpenCard(open1, answer('A3', 'continue'), now), true); assert.equal(lib.agentAnswerOpenCard(open1, answer('A3', 'stop'), now), true); assert.equal(lib.agentAnswerOpenCard(open1, answer('A4', 'add'), now), false, 'the other card is not open'); assert.equal(lib.agentAnswerOpenCard(open1, { runId: OTHER, card: 'A3', choice: 'continue' }, now), false, 'another run\'s answer is dropped here, as the server drops it')
  assert.equal(lib.agentAnswerOpenCard(S['checkpoint answered'], answer('A3', 'continue'), now), false, 'an answered card is not open'); assert.equal(lib.agentAnswerOpenCard(S.running, answer('A3', 'continue'), now), false); assert.equal(lib.agentAnswerOpenCard(S.done, answer('A3', 'continue'), now), false); assert.equal(lib.agentAnswerOpenCard(S.idle, answer('A3', 'continue'), now), false)
  assert.equal(lib.agentAnswerOpenCard(S['research offer'], answer('A4', 'add'), now), true); assert.equal(lib.agentAnswerOpenCard(S['stopped, then a checkpoint'], answer('A3', 'continue'), now), true, 'a card that follows a stop is open'); assert.equal(lib.agentAnswerOpenCard(S['stopped, then a research offer'], answer('A4', 'skip'), now), true)
  assert.equal(lib.agentAnswerOpenCard(S.estimate, answer('A1', 'start'), now), true); assert.equal(lib.agentAnswerOpenCard(S['estimate answered'], answer('A1', 'cancel'), now), false); assert.equal(lib.agentAnswerOpenCard(S.estimate, answer('A3', 'continue'), now), false)
  const offered = S['failed with a fallback offered'], none = S['failed, no deck, credited back']; assert.equal(lib.agentAnswerOpenCard(offered, answer('A6', 'fallback'), now), true); assert.equal(lib.agentAnswerOpenCard(offered, answer('A6', 'stop'), now), true); assert.equal(lib.agentAnswerOpenCard(none, answer('A6', 'fallback'), now), false, 'no fallback was offered: it is not an answer'); assert.equal(lib.agentAnswerOpenCard(none, answer('A6', 'stop'), now), true); assert.equal(lib.agentAnswerOpenCard(S['failed answered'], answer('A6', 'stop'), now), false)
  assert.equal(lib.agentAnswerOpenCard(open1, { runId: RUN, card: 'A3', choice: 'finish' }, now), false)
}
await check('reducer note 2: an answer goes out only through agentAnswerSendable on a socket that is open now, never queued, retried or replayed after a reconnect (the drafted hook line H7 run against fake sockets); the card is marked answered only after a send (P7), and only for the card that is open', () => proveAnswerPath())

async function proveShell(texts = {}) { proveFlags(texts); proveReducer(texts); proveLeaks(texts); provePicker(texts); proveCards(texts); proveContract(texts); proveExamples(texts); proveEstimateInfo(texts); proveStopped(texts); proveAnswerPath(texts) } // LATER-CHANGES: registry read (AGENT-MODE-WIRE)


// ===== F. the strip, the env block, the registry, the drafts =========================================================================================
console.log('F. the strip, the env block, the registry and the drafts')
const lineDiff = (before, after) => { const b = before.split('\n'), a = after.split('\n'), out = []; let i = 0, j = 0; while (i < b.length || j < a.length) { if (b[i] === a[j]) { i++; j++ } else if (a[j] !== undefined && !b.slice(i).includes(a[j])) { out.push(`+${a[j++]}`) } else if (b[i] !== undefined && !a.slice(j).includes(b[i])) { out.push(`-${b[i++]}`) } else { out.push(`-${b[i++]}`); out.push(`+${a[j++]}`) } } return out }
const LEGACY_FILES = ['app/builder/page.tsx', 'hooks/use-deckster-websocket-v2.ts', LIB, REGISTRY, '.env.example', 'scripts/test-studio-usage-credits-page.mjs', 'scripts/test-studio-chat-caps.mjs', 'scripts/studio-chat-caps-strip.mjs']
const SHAPE = /^ {2}shas\.splice\(0, shas\.length, \.\.\.shas\.filter\(sha => !\/\^Agent mode shell:\/\.test\(git\('log', '-1', '--format=%s', sha\)\)\)\) \/\/ LATER-CHANGES: registry read \(AGENT-MODE-SHELL\): /
/** FRONTEND-1's voice-call proof and the four lines they OK'd (to-FRONTEND-2.md lines 545 / 528): the bytes are pinned by hash (the same four pairs #603 carries), each a whole line with the mark (the put-back text has none), the two inserted lines sit right after the anchor, four marked lines and no more. */
const FE1_MARK = '// LATER-CHANGES: registry read (UX-FINDINGS-E)', FE1_ANCHOR = "const core = await import('./studio-voice-core-strip.mjs')", FE1_OK_SHA256 = 'a1d866850327b3d4d621ec1c135e5600400d1fd2a587e4d2fd3af58cd708d0c8', VCALL = AGENT_MODE_SHELL_FE1_PROOF_FILES[0]
function proveFe1Proof(rel, now, a = m => m) {
  const pairs = AGENT_MODE_SHELL_FE1_PROOF_OK[rel], hash = crypto.createHash('sha256')
  for (const [has, was] of pairs) { hash.update(has); hash.update('\0'); hash.update(was); hash.update('\0') }
  assert.equal(hash.digest('hex'), FE1_OK_SHA256, a(`${rel}: the OK'd lines are the four FRONTEND-1 OK'd, byte for byte`))
  assert.equal(pairs.length, 4, a(`${rel}: four OK'd lines`)); assert.ok(pairs.every(([has, was], i) => has.endsWith('\n') && has.includes(FE1_MARK) && !was.includes(FE1_MARK) && (was === '') === (i < 2)), a(`${rel}: whole lines with the mark; two insertions, then two rewrites; the put-back text has no mark`))
  const lines = now.split('\n'), base = baseText(rel).split('\n'), at = lines.indexOf(FE1_ANCHOR)
  assert.ok(at >= 0 && at === base.indexOf(FE1_ANCHOR), a(`${rel}: the anchor line is where dev has it`)); deepEqual(lines.slice(at + 1, at + 3), pairs.slice(0, 2).map(([has]) => has.slice(0, -1)), a(`${rel}: the two inserted lines sit right after the anchor`))
  assert.equal(lines.filter(line => line.includes(FE1_MARK)).length, 4, a(`${rel}: four marked lines, no more`)); assert.equal(lines.length - base.length, 2, a(`${rel}: two lines longer than dev's`))
}
function proveStrip(strip, readNow = read, later = laterStrips, at = '') {
  const a = m => (at ? `${at}: ${m}` : m)
  deepEqual(Object.keys(AGENT_MODE_SHELL_EDITS).sort(), [...AGENT_MODE_SHELL_PIN_FILES, ...AGENT_MODE_SHELL_FE1_PROOF_FILES].sort(), a('the strip edits the two older proofs it teaches and FRONTEND-1\'s voice-call proof (the four lines they OK\'d), and no app file'))
  for (const [rel, edits] of Object.entries(AGENT_MODE_SHELL_EDITS)) {
    // FRONTEND-1's voice-call proof carries the same four lines in every Draft (and #603): it is read as it is on disk, never past a later change's strip, which would take the same lines out first
    const now = AGENT_MODE_SHELL_FE1_PROOF_FILES.includes(rel) ? readNow(rel) : later(rel, readNow(rel)), base = baseText(rel)
    assert.equal(strip(rel, now), base, a(`${rel}: put back it is the base's, byte for byte`)); assert.equal(strip(rel, strip(rel, now)), base, a(`${rel}: put back twice changes nothing more`))
    for (const [has] of edits) assert.equal(count(`\n${now}`, `\n${has}`), 1, a(`${rel}: an edited line is there exactly once`))
    const diff = lineDiff(base, now), has = edits.flatMap(([hasText]) => hasText.split('\n').filter(Boolean)), was = edits.flatMap(([, wasText]) => wasText.split('\n').filter(Boolean))
    deepEqual(diff.filter(line => line.startsWith('+')), has.map(line => `+${line}`), a(`${rel}: exactly the edited lines are added`)); deepEqual(diff.filter(line => line.startsWith('-')), was.map(line => `-${line}`), a(`${rel}: nothing of the base is gone`))
  }
  for (const rel of AGENT_MODE_SHELL_FE1_PROOF_FILES) proveFe1Proof(rel, readNow(rel), a)
  for (const rel of AGENT_MODE_SHELL_PIN_FILES) {
    const now = later(rel, readNow(rel)), lines = now.split('\n'), marked = lines.filter(line => line.includes(AGENT_MODE_SHELL_PIN_MARK))
    assert.equal(marked.length, 1, a(`${rel}: one taught line, carrying the registry-read mark`)); assert.equal(`${marked[0]}\n`, AGENT_MODE_SHELL_PIN_EDITS[rel][0][0]); assert.ok(SHAPE.test(marked[0]), a(`${rel}: the taught line is a subject filter for "Agent mode shell:"`))
    assert.ok(AGENT_MODE_SHELL_PIN_EDITS[rel].every(([, was]) => !was.includes(AGENT_MODE_SHELL_PIN_MARK)), a('the put-back text has no mark'))
    const at0 = lines.indexOf(marked[0]); assert.ok(/shas\.filter\(sha => !\/\^/.test(lines[at0 - 1]) && baseText(rel).split('\n').includes(lines[at0 - 1]), a(`${rel}: an insertion right after a subject filter its base already has (the last one before it, whichever change that is)`))
    assert.equal(lines.filter(line => /shas\.filter\(sha => !\/\^Agent mode shell:\//.test(line)).length, 1, a(`${rel}: no second filter for this subject`)); assert.ok(baseText(rel).split('\n').some(line => line.startsWith(AGENT_MODE_SHELL_PIN_AFTER)), a('the filter it goes after is in the base'))
  }
  for (const rel of LEGACY_FILES) { const text = readNow(rel); assert.equal(strip(rel, text), text, a(`${rel}: not this change's: returned as it is`)) }
  const line = AGENT_MODE_SHELL_PIN_EDITS[AGENT_MODE_SHELL_PIN_FILES[0]][0][0], rel0 = AGENT_MODE_SHELL_PIN_FILES[0]
  assert.equal(strip('app/builder/page.tsx', line), line, a('the line in another file stays')); assert.equal(strip(rel0, 1), 1); assert.equal(strip(rel0, undefined), undefined)
  assert.equal(strip(rel0, `x${line}`), `x${line}`, a('a line that merely ends with it is not it')); assert.equal(strip(rel0, `${line.trimEnd()}x\n`), `${line.trimEnd()}x\n`)
  assert.equal(strip(rel0, `a\n${line}${line}b\n`), `a\n${line}b\n`, a('a line that is there twice is a merge mistake: only the first goes, the older pins still see the second')); assert.equal(strip(rel0, 'a\nb\n'), 'a\nb\n', a('a proof without the line is returned as it is'))
}
await check('the strip: the two taught proofs and FRONTEND-1\'s voice-call proof (their four OK\'d lines, byte for byte as #603 carries them) put back are the base\'s, byte for byte, idempotent; each taught line is one subject filter with the registry-read mark, right after a filter the base has; a file it does not own (also with the line in it), a longer line, a non-string and a proof without the line come back as they are; a doubled line is not hidden', () => proveStrip(stripAgentModeShell))
await check('the strip is plain data: no imports, nothing read from disk or git; its marker is a whole token; the subject is its own; the flags are the two named; no secret-shaped literal; no stdin pipe into git', () => {
  const text = read('scripts/studio-agent-mode-shell-strip.mjs')
  assert.doesNotMatch(text.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/`[^`]*`/g, '``').replace(/\/\/.*$/gm, ''), /^import |require\(|readFileSync|execFileSync/m, 'no imports, nothing read from disk or git')
  assert.ok(AGENT_MODE_SHELL_MARKER_RE.test('a // AGENT-MODE-SHELL') && !AGENT_MODE_SHELL_MARKER_RE.test('a // AGENT-MODE-SHELL-X') && !AGENT_MODE_SHELL_MARKER_RE.test('a // X-AGENT-MODE-SHELL') && !AGENT_MODE_SHELL_MARKER_RE.test('a // AGENT_MODE'), 'the marker is a whole token')
  assert.equal(AGENT_MODE_SHELL_SUBJECT, 'Agent mode shell:'); deepEqual(AGENT_MODE_SHELL_FLAGS, ['NEXT_PUBLIC_AGENT_MODE', 'NEXT_PUBLIC_AUTHOR_MODE_PICKER']); assert.match(BASE_COMMIT, /^[0-9a-f]{40}$/); git('merge-tree', '--write-tree', BASE_COMMIT, 'HEAD')
  deepEqual([...AGENT_MODE_SHELL_NEW_FILES].sort(), [...AGENT_MODE_SHELL_NEW_FILES].sort()); assert.equal(AGENT_MODE_SHELL_COMPONENT_FILES.length, 8); for (const rel of AGENT_MODE_SHELL_COMPONENT_FILES) assert.ok(fs.existsSync(path.join(root, rel)), rel)
  assert.ok(AGENT_MODE_SHELL_SCOPE_FILES.has('scripts/test-studio-agent-mode-shell.mjs') && AGENT_MODE_SHELL_SCOPE_FILES.has('.env.example') && AGENT_MODE_SHELL_SCOPE_FILES.has(LIB)); assert.equal(AGENT_MODE_SHELL_SCOPE_FILES.size, AGENT_MODE_SHELL_NEW_FILES.length + AGENT_MODE_SHELL_OWN_EDITS.length)
  for (const rel of AGENT_MODE_SHELL_NEW_FILES) { assert.doesNotMatch(read(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|[a-z]+:\/\/[^\s/:@]+:[^\s/@]+@)/, `${rel}: no secret-shaped literal`); assert.doesNotMatch(read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, ''), new RegExp(`-{2}std${'in'}`), `${rel}: no stdin pipe into git (hash-object reads a temporary file)`) }
})

/** The block out of .env.example the way the registry takes one out: whole lines, the one blank line that separated it goes too. */
function removeBlock(text, registered) {
  const block = String(registered).replace(/^\n+/, '').replace(/\n+$/, ''); let at = text.indexOf(block)
  while (at !== -1 && !((at === 0 || text[at - 1] === '\n') && (at + block.length === text.length || text[at + block.length] === '\n'))) at = text.indexOf(block, at + 1)
  if (at === -1) return text
  const before = text.slice(0, at), after = text.slice(at + block.length)
  return /^\n*$/.test(after) ? (before.endsWith('\n\n') ? before.slice(0, -1) : before) : after.startsWith('\n\n') ? before + after.slice(2) : before + after.slice(1)
}
function proveEnvText(envText, block = AGENT_MODE_SHELL_ENV_BLOCK) {
  const at = registry.LATER_ENV_BLOCKS.indexOf(AGENT_MODE_SHELL_ENV_BLOCK); assert.ok(at >= 0, 'the registry holds the block')
  const mine = registry.LATER_ENV_BLOCKS.slice(at + 1).reduce(removeBlock, envText)  // a block registered after this one is that change's
  assert.equal(count(mine, block), 1, 'this change\'s block is there exactly once, verbatim'); assert.ok(mine.includes(`\n\n${block}`), 'a blank line before the block'); assert.ok(mine.endsWith(block), 'the block is the last one (the true end of the file)')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', envText), registry.stripLaterEnvBlocks('.env.example', baseText('.env.example')), '.env.example is dev\'s plus the registered blocks and nothing else')
  for (const flag of AGENT_MODE_SHELL_FLAGS) { assert.equal(count(`\n${envText}`, `\n${flag}="false"\n`), 1, `${flag} is documented as off, once`); assert.ok(block.includes(`${flag}="false"`)); assert.equal(new RegExp(`^${flag}=(?!"false"$)`, 'm').test(envText), false, `${flag} is never set on`) }
  assert.ok(AGENT_MODE_SHELL_MARKER_RE.test(block), 'the block carries the marker'); assert.ok(block.split('\n').filter(l => l && !l.startsWith('#')).every(l => /^NEXT_PUBLIC_[A-Z_]+="false"$/.test(l)), 'names and "false" only'); assert.ok(block.endsWith('\n') && !block.endsWith('\n\n'))
}
await check('the env block: appended at the TRUE END of .env.example after one blank line, verbatim and once, both flags "false", names only; .env.example is dev\'s plus the registered blocks', () => proveEnvText(read('.env.example')))

const END = '  // one line per later change, above this comment'
const OWN_NAME = 'studio-agent-mode-shell-strip.mjs'
/** The list a registry line sits in (the nearest `export const LATER_...` above it). */
const sectionOf = (lines, at) => { for (let i = at; i >= 0; i--) { const m = /^export const (LATER_\w+)/.exec(lines[i]); if (m) return m[1] } return null }
function proveRegistryText(regText) {
  const reg = regText.split('\n'), baseReg = baseText(REGISTRY).split('\n')
  /** Registry lines a change registered AFTER this one added (in each list, below this change's line, in the registered shape): that change's, not this one's. A stray line is still counted. */
  const laterRegistry = (() => { const later = new Set(); let after = false; for (const line of reg) { if (/^export const LATER_/.test(line)) after = false; else if (line.includes(OWN_NAME)) after = true; else if (after && line.includes('// LATER-CHANGE:') && /-strip\.mjs/.test(line)) later.add(line) } return later })()
  const diff = lineDiff(baseText(REGISTRY), regText).filter(line => !(line.startsWith('+') && laterRegistry.has(line.slice(1))))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes(OWN_NAME)); assert.equal(own.length, 3, 'the registry gains exactly this change\'s THREE lines')
  for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE: FRONTEND-2, '), line.slice(0, 140))
  deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['AGENT_MODE_SHELL_SCOPE_FILES', 'AGENT_MODE_SHELL_ENV_BLOCK', 'stripAgentModeShell'], 'one files line, one env line, one strip line')
  assert.equal(diff.length, 3, 'and nothing else in the registry')
  deepEqual(own.map(line => sectionOf(reg, reg.indexOf(line.slice(1)))), ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS'], 'one in each list')
  for (const line of own) {
    const at = reg.indexOf(line.slice(1)); assert.ok(at > 0, line.slice(1, 80))
    assert.ok(baseReg.includes(reg[at - 1]) && reg[at - 1].includes('// LATER-CHANGE:') && reg[at - 1].includes('studio-voice-call-strip.mjs'), `right after studio-voice-call-strip.mjs's line, a registered line dev already has: ${line.slice(1, 80)}`)
    assert.ok(reg[at + 1].startsWith('  // one line per later change') || laterRegistry.has(reg[at + 1]), 'the true end of its list (or followed only by a later change\'s registered line)')
  }
}
function proveRegistryAt(head) { proveRegistryText(git('show', `${head}:${REGISTRY}`)); proveEnvText(git('show', `${head}:.env.example`)) }
await check('the registry file at HEAD: this change\'s files, its env block and its strip, one at the true end of each list right after studio-voice-call-strip.mjs\'s; every scope file is registered; the strip comes after every older strip', () => {
  assert.ok(registry.LATER_STRIPS.includes(stripAgentModeShell) && registry.LATER_ENV_BLOCKS.includes(AGENT_MODE_SHELL_ENV_BLOCK), 'the registry holds the strip and the block'); assert.ok([...AGENT_MODE_SHELL_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'and every file')
  const ownAt = registry.LATER_STRIPS.indexOf(stripAgentModeShell), voiceAt = registry.LATER_STRIPS.findIndex(fn => typeof fn === 'function' && fn.name === 'stripVoiceCall'); assert.ok(voiceAt > 0 && ownAt > voiceAt, 'the strip comes after studio-voice-call-strip.mjs\'s')
  const regLines = read(REGISTRY).split('\n'); assert.equal(regLines.filter(line => line.includes(OWN_NAME)).length, 3, 'three lines name this change\'s strip module')
  deepEqual(regLines.map((line, i) => (line.includes(OWN_NAME) ? sectionOf(regLines, i) : null)).filter(Boolean), ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS'], 'one in each list'); proveRegistryText(read(REGISTRY))
})

/** The drafts: not applied, each anchor the dev line it names, a pure insertion but for one replace, the marker on every line, the result parses and its imports are real. `drafts` and `readAt` are parameters so a mutant can feed a bad one. */
const exportsOf = text => new Set([...text.matchAll(/^export (?:const|function|interface|type) (\w+)/gm)].map(m => m[1]))
function proveDrafts(readAt = read, drafts = AGENT_MODE_SHELL_DRAFTS) {
  deepEqual([...new Set(drafts.map(d => d.file))].sort(), ['app/builder/page.tsx', 'hooks/use-deckster-websocket-v2.ts'], 'the drafts are for the hook and the Builder page, FRONTEND-1\'s'); assert.equal(new Set(drafts.map(d => d.id)).size, drafts.length, 'ids are unique')
  const libExports = exportsOf(SRC.lib), compExports = Object.fromEntries(AGENT_MODE_SHELL_COMPONENT_FILES.map(rel => [rel, exportsOf(read(rel))]))
  for (const file of new Set(drafts.map(d => d.file))) {
    const mine = drafts.filter(d => d.file === file), base = baseText(file), baseLines = base.split('\n'), committed = readAt(file).split('\n')
    deepEqual(mine.map(d => d.line), [...mine.map(d => d.line)].sort((x, y) => x - y), `${file}: anchors in file order`); assert.equal(new Set(mine.map(d => d.line)).size, mine.length, `${file}: one draft per anchor line`)
    for (const d of mine) {
      assert.ok(['after', 'before', 'replace'].includes(d.where), `${d.id}: where`); assert.equal(baseLines[d.line - 1], d.anchor, `${d.id}: the anchor is dev line ${d.line} of ${file}, byte for byte`)
      assert.ok(d.add.length >= 1 && d.add.every(line => line.trim() !== '' && AGENT_MODE_SHELL_MARKER_RE.test(line)), `${d.id}: every new line carries the marker`); for (const line of d.add) assert.equal(committed.includes(line), false, `${d.id}: NOT applied: the committed ${file} has no such line`)
      for (const m of d.add.join('\n').matchAll(/import \{([^}]+)\} from '@\/lib\/studio-agent-mode'/g)) for (const name of m[1].split(',').map(x => x.trim().replace(/^type /, '')).filter(Boolean)) assert.ok(libExports.has(name), `${d.id}: the lib exports ${name}`)
      for (const m of d.add.join('\n').matchAll(/import \{ (\w+) \} from '@\/components\/builder\/agent-mode\/([\w-]+)'/g)) assert.ok(compExports[`components/builder/agent-mode/${m[2]}.tsx`]?.has(m[1]), `${d.id}: ${m[2]} exports ${m[1]}`)
    }
    assert.equal(mine.filter(d => d.where === 'replace').length <= 1, true, `${file}: at most one replaced line`)
    // apply them (bottom up) to dev's file: the result parses, and taking the marked lines out (the replaced line back) gives dev's file again
    const lines = [...baseLines]; for (const d of [...mine].reverse()) lines.splice(d.where === 'before' ? d.line - 1 : d.where === 'replace' ? d.line - 1 : d.line, d.where === 'replace' ? 1 : 0, ...d.add)
    const applied = lines.join('\n'), replaced = mine.find(d => d.where === 'replace')
    const restored = applied.split('\n').flatMap(line => (AGENT_MODE_SHELL_MARKER_RE.test(line) ? (replaced && line === replaced.add[0] ? [replaced.anchor] : []) : [line])).join('\n')
    assert.equal(restored, base, `${file}: with the drafts applied and taken out again it is dev's file`); assert.equal(lineDiff(base, applied).filter(l => l.startsWith('-')).length, replaced ? 1 : 0, `${file}: a pure insertion${replaced ? ' but for one replaced line' : ''}`)
    const parse = text => ts.transpileModule(text, { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve } }).diagnostics?.length ?? 0
    assert.equal(parse(base), 0, `${file}: positive control: dev's file parses`); assert.equal(parse(applied), 0, `${file}: with the drafts applied it still parses`)
  }
}
await check('the drafts (FRONTEND-1\'s hook and Builder page; NOT applied): each anchor is the dev line it names, byte for byte; every new line carries the marker; a pure insertion but for one replaced line; applied and taken out again it is dev\'s file; applied it parses; the lib names they import exist', () => proveDrafts())

// ===== G. scope ====================================================================================================================================
console.log('G. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-08T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-08T00:00:00Z' }
const plumb = (args, env = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(AGENT_MODE_SHELL_SUBJECT)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees none of them on the gate's merge. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query: on the gate's merge (dev first, this change's head second) the scope runs against HEAD^2; elsewhere HEAD itself. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim(), parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
/** No older change's subject filter (the taught proofs' own `shas.filter(sha => !/^…/` lines at dev) matches this change's subject; this change's own filter is the one that does. */
const subjectFilters = text => text.split('\n').filter(line => /shas\.filter\(sha => !\//.test(line)).map(line => new RegExp(/shas\.filter\(sha => !\/(.+?)\/\.test\(git\(/.exec(line)[1]))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (?:Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  const olderFilters = AGENT_MODE_SHELL_PIN_FILES.flatMap(rel => subjectFilters(baseText(rel)))
  assert.ok(olderFilters.length >= 20, 'the older subject filters are read from the taught proofs at dev')
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) { const subject = subjectOf(c); if (isOwnSubject(subject)) assert.ok(!olderFilters.some(re => re.test(subject)), `${c.slice(0, 8)} would be taken for an older change's own commit`) }
  return own
}
/** Lanes this change must not touch (FRONTEND-1's, COMPOSER-2's, the reconnect proof): it touches none of their files, not even a line. */
const LANES = /^(scripts\/test-studio-(p2-|billing-|launch-wording|env-append-tolerant|route-params|admin-email-guard|uat-marketing|deck-title|flow-control)|scripts\/test-atlas-help-recovery|scripts\/test-director-websocket-reconnect|scripts\/test-(deck-card-thumbnail|first-paint)|lib\/studio-flow-control\.ts|hooks\/use-studio-flow-control\.ts|lib\/studio-billing-usage\.ts|hooks\/use-deckster-websocket-v2\.ts|app\/builder\/page\.tsx|types\/mdc\.ts|components\/builder\/chat\/)/
const UNTOUCHED = ['hooks/use-deckster-websocket-v2.ts', 'app/builder/page.tsx', 'types/mdc.ts', 'components/builder/chat/question-card.tsx', 'components/builder/chat/studio-recovery-card.tsx', 'components/builder/studio-director.css', 'components/builder/message-list.tsx', 'components/ui/button.tsx', 'components/billing/builder-quota-refusal.tsx', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'next.config.mjs']
const scopeCommittedFiles = (head, { later = laterStrips, registered = registry.LATER_CHANGE_FILES } = {}) => {
  const own = scopeOwnCommits(head), touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  deepEqual([...touched].sort(), [...AGENT_MODE_SHELL_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  deepEqual([...net].filter(rel => AGENT_MODE_SHELL_SCOPE_FILES.has(rel) || !registered.has(rel)).sort(), [...AGENT_MODE_SHELL_SCOPE_FILES].sort(), 'and the whole committed diff from BASE is nothing else (a file the registry names for a later change, stacked on this head, is left to that change; an unregistered file still fails)')
  for (const rel of AGENT_MODE_SHELL_NEW_FILES) { assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel); assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${rel}`), undefined, `${rel} is new: dev has none`) }
  for (const rel of AGENT_MODE_SHELL_PIN_FILES) assert.equal(stripAgentModeShell(rel, later(rel, git('show', `${head}:${rel}`))), baseText(rel), `${rel}: an older proof taught: put back it is the base's (a later change's registered lines out first)`)
  for (const rel of AGENT_MODE_SHELL_FE1_PROOF_FILES) { const text = git('show', `${head}:${rel}`); assert.equal(stripAgentModeShell(rel, text), baseText(rel), `${rel}: FRONTEND-1's voice-call proof, the one file of theirs this change edits: put back it is the base's (exactly the four OK'd lines differ)`); proveFe1Proof(rel, text) }
  for (const rel of UNTOUCHED) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
  for (const rel of touched) assert.ok(!LANES.test(rel), `${rel} is in FRONTEND-1's, COMPOSER-2's or the reconnect proof's lane: no file of theirs may be touched`)
  for (const rel of AGENT_MODE_SHELL_DRAFT_FILES) assert.equal(later(rel, git('show', `${head}:${rel}`)), baseText(rel), `the drafts are not applied: ${rel} is dev's, byte for byte (a later change's registered lines out first)`) // LATER-CHANGES: registry read (AGENT-MODE-WIRE): on a branch stacked after this change (the Agent build wire applies lines to the hook and the Builder page), the committed files are read past the later changes' strips
  proveDrafts(rel => git('show', `${head}:${rel}`))
}
const scopeAll = (head, opts) => { scopeOwnCommits(head); scopeCommittedFiles(head, opts); proveRegistryAt(head) }

const HEAD = scopeHead('HEAD')
/** This change's own commits on the FIRST-PARENT line of `head` from BASE. Merged into dev, its commits come in by a merge's second parent and that line has none of them. */
const ownOnLine = head => git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** There the committed diff from BASE holds the later changes' work too, so the scope checks stand down; the pins (read past the later changes' strips) and every other section still run. */
const ON_OWN_LINE = ownOnLine(HEAD).length > 0
const scopeCheck = (label, fn) => (ON_OWN_LINE ? check(label, fn) : undefined)
const scopeMutant = (label, fn) => (ON_OWN_LINE ? mutant(label, fn) : undefined)
if (!ON_OWN_LINE) console.log('NOTE scope: no commit of this change on the first-parent line from BASE (merged into dev: its commits are on a second parent); the scope checks stand down, the pins above cover the files')
await scopeCheck(`this change's own commits (subject starts "${AGENT_MODE_SHELL_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await scopeCheck('the committed files are exactly this change\'s: the lib, the eight components, the strip, this proof, .env.example, the registry, the two taught proofs and FRONTEND-1\'s voice-call proof (only their four OK\'d lines); the hook, the Builder page, the chat cards, the director styles, package.json and the lockfile are not touched; the drafts are not applied', () => scopeCommittedFiles(HEAD))
await scopeCheck('the registry gains exactly this change\'s three marked lines (files, env block, strip) at the true end of each list, right after studio-voice-call-strip.mjs\'s, and loses none; .env.example is dev\'s plus the registered blocks, this change\'s at the true end', () => proveRegistryAt(HEAD))
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : null
await scopeCheck('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); proveRegistryAt(GATE)
  for (const rel of AGENT_MODE_SHELL_PIN_FILES) assert.equal(stripAgentModeShell(rel, laterStrips(rel, git('show', `${GATE}:${rel}`))), baseText(rel), `${rel}: the merged tree, without this change's line, is dev's`)
  for (const rel of AGENT_MODE_SHELL_FE1_PROOF_FILES) assert.equal(stripAgentModeShell(rel, git('show', `${GATE}:${rel}`)), baseText(rel), `${rel}: the merged tree, without the four OK'd lines, is dev's`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await scopeCheck('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-idx-'))
  try {
    const envIdx = { GIT_INDEX_FILE: path.join(dir, 'index') }
    plumb(['read-tree', parent], envIdx)
    for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], envIdx)
    return plumb(['commit-tree', plumb(['write-tree'], envIdx), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = ON_OWN_LINE ? commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE') : null
const ADVANCED_GATE = ON_OWN_LINE ? gateMerge(unrelated, HEAD) : null
await scopeCheck('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE: the scope head is still this change\'s head and the scope section passes', () => {
  deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); proveRegistryAt(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
const hookNow = ON_OWN_LINE ? git('show', `${HEAD}:hooks/use-deckster-websocket-v2.ts`) : ''
const scopeBreakers = {
  'a stray file in an own commit': () => { const stray = commitWith(HEAD, { 'stray-agent-mode-shell.txt': 'stray\n' }, `${AGENT_MODE_SHELL_SUBJECT} a stray file${TRAILER}`); assert.ok(ownOf(stray).includes(stray)); assert.doesNotThrow(() => scopeCommittedFiles(HEAD)); scopeCommittedFiles(stray) },
  'an own commit without the co-author line': () => { const c = commitWith(HEAD, {}, `${AGENT_MODE_SHELL_SUBJECT} no trailer`); assert.throws(() => scopeOwnCommits(c), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named'); scopeOwnCommits(c) },
  'a draft applied to the hook in an own commit': () => { const d = AGENT_MODE_SHELL_DRAFTS.find(x => x.id === 'H6'), lines = hookNow.split('\n'); lines.splice(d.line, 0, ...d.add); const c = commitWith(HEAD, { 'hooks/use-deckster-websocket-v2.ts': lines.join('\n') }, `${AGENT_MODE_SHELL_SUBJECT} applies a draft${TRAILER}`); assert.doesNotThrow(() => scopeCommittedFiles(HEAD)); scopeCommittedFiles(c) },
}
await scopeCheck('scope: a stray file in an own commit fails the files check, an own commit without the co-author line is named, a draft applied to the hook or a touched file of FRONTEND-1\'s lane (the page, the hook, the question card, the billing lib, another voice-call proof) fails it, a fifth line in FRONTEND-1\'s voice-call proof fails it (only their four OK\'d lines are allowed), and a real own commit set still passes', () => {
  assert.throws(scopeBreakers['a stray file in an own commit'], /exactly its scope/); assert.throws(scopeBreakers['an own commit without the co-author line'], error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named'); assert.throws(scopeBreakers['a draft applied to the hook in an own commit'], /exactly its scope|is not touched|lane|not applied|NOT applied/)
  for (const rel of ['app/builder/page.tsx', 'hooks/use-deckster-websocket-v2.ts', 'components/builder/chat/question-card.tsx', 'lib/studio-billing-usage.ts', 'scripts/test-studio-voice-call-replay.mjs']) {
    const foreign = commitWith(HEAD, { [rel]: `${git('show', `${HEAD}:${rel}`)}\n` }, `${AGENT_MODE_SHELL_SUBJECT} touches ${rel}${TRAILER}`)
    assert.notEqual(git('show', `${foreign}:${rel}`), git('show', `${HEAD}:${rel}`), `positive control: ${rel} is changed`); assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched|lane/, rel)
  }
  assert.throws(() => scopeCommittedFiles(commitWith(HEAD, { [VCALL]: `${git('show', `${HEAD}:${VCALL}`)}// a fifth line\n` }, `${AGENT_MODE_SHELL_SUBJECT} a fifth voice-call line${TRAILER}`)), /put back it is the base's/, 'a fifth line in the voice-call proof')
  scopeAll(HEAD)
})

// ===== H. robust after merge, and a linear stack ===================================================================================================
console.log('H. robust after merge; a linear stack')
const SYN = { file: 'scripts/test-studio-deck-sync-truth.mjs', mark: 'registry read (SYNTHETIC-LATER)' }
const synStrip = (rel, text) => (rel === SYN.file && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.mark)).join('\n') : text)
const SYN_FILTER = `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Synthetic later:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: ${SYN.mark}: a made-up change stacked after this one`
const SYN_FILES = "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_LATER_SCOPE_FILES, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"
const SYN_ENV = "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_LATER_ENV_BLOCK, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"
const SYN_STRIP = "  (await import('./studio-synthetic-later-strip.mjs')).stripSyntheticLater, // LATER-CHANGE: SYNTHETIC, a made-up change stacked after this one"
const after = (lines, needle, line) => { const at = lines.findIndex(l => l.includes(needle)); assert.ok(at > 0, `${needle} is there`); lines.splice(at + 1, 0, line); return lines }
/** A later change stacked after this one: its subject filter beside this one's in a taught proof (and, with `registryLines`, its three registered-shape lines below ours in the registry). */
const laterCommit = (onto, { registryLines = false, extra = {} } = {}) => {
  const edits = { [SYN.file]: after(git('show', `${onto}:${SYN.file}`).split('\n'), 'registry read (AGENT-MODE-SHELL)', SYN_FILTER).join('\n'), ...extra }
  if (registryLines) edits[REGISTRY] = after(after(after(git('show', `${onto}:${REGISTRY}`).split('\n'), ').AGENT_MODE_SHELL_SCOPE_FILES, // LATER-CHANGE:', SYN_FILES), ').AGENT_MODE_SHELL_ENV_BLOCK, // LATER-CHANGE:', SYN_ENV), ').stripAgentModeShell, // LATER-CHANGE:', SYN_STRIP).join('\n')
  return commitWith(onto, edits, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const synLater = (rel, text) => synStrip(rel, laterStrips(rel, text))
function provePins(readAt, at, later) { proveStrip(stripAgentModeShell, readAt, later, at); proveEnvText(readAt('.env.example')); proveDrafts(readAt) }
await check('ROBUST AFTER MERGE: on a branch stacked after this change (dev\'s merge brings it in by a second parent, then a later change adds its subject filter beside this one\'s in a taught proof) no own commit is on the first-parent line, the scope stands down there, and the pins, read past the later change\'s strip, still pass', () => {
  const dev = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : HEAD, later = laterCommit(dev), readAt = rel => git('show', `${later}:${rel}`)
  assert.equal(ownOf(later).length, ownOf(HEAD).length, 'this change\'s commits are all there (by the second parent)'); if (ON_OWN_LINE) deepEqual(ownOnLine(later), [], 'none of them on the first-parent line: the scope checks stand down there')
  provePins(readAt, 'stacked after', synLater)
  assert.throws(() => provePins(readAt, 'stacked after, not told', laterStrips), /put back it is the base's|exactly the edited lines|exactly once|one taught line|no second filter/, 'mutant caught: without the later change\'s strip, its line breaks the put-back')
})
await scopeCheck('LINEAR STACK: a later change directly on this head (registered-shape registry lines below ours in each of the three lists, a subject-filter line beside ours in a taught proof, removed by its own strip passed into laterStrips): this change\'s own commits are still on the first-parent line, the scope still passes, the registry check leaves its lines to it, and the pins pass', () => {
  const later = laterCommit(HEAD, { registryLines: true }), readAt = rel => git('show', `${later}:${rel}`)
  deepEqual(parentsOf(later), [HEAD]); assert.equal(ownOnLine(later).length, ownOnLine(HEAD).length, 'this change\'s commits are on the first-parent line of the later head: the scope checks RUN there')
  assert.equal(scopeHead(later), later); scopeAll(later, { later: synLater }); provePins(readAt, 'linear stack', synLater)
  assert.throws(() => proveRegistryText(after(git('show', `${later}:${REGISTRY}`).split('\n'), ').stripSyntheticLater, // LATER-CHANGE:', "  (await import('./studio-synthetic-later-strip.mjs')).stripSyntheticLaterToo, // stray: not in the registered shape").join('\n')), /nothing else in the registry/, 'a registry line that is not in the registered shape is still counted')
  const gate = gateMerge(BASE_COMMIT, later); assert.equal(scopeHead(gate), later); scopeAll(scopeHead(gate), { later: synLater })
})
await scopeCheck('LINEAR STACK: an unregistered file in the later commit still fails the whole-diff check; the same file once the registry names it (a later change\'s own file) is left to its change', () => {
  const stray = laterCommit(HEAD, { registryLines: true, extra: { 'stray-later-change.txt': 'stray\n' } })
  assert.throws(() => scopeCommittedFiles(stray, { later: synLater }), /nothing else/, 'an unregistered file fails')
  assert.doesNotThrow(() => scopeCommittedFiles(stray, { later: synLater, registered: new Set([...registry.LATER_CHANGE_FILES, 'stray-later-change.txt']) }), 'a registered one is that change\'s')
  const straySubject = commitWith(HEAD, { 'stray-later-change.txt': 'stray\n' }, `Proofs after merge: an unregistered file${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(straySubject), /nothing else/, 'a later commit with another subject that touches a file the registry does not name still fails')
})

// ===== I. mutants (each one edit of the real sources, fed to the same checks) =================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const lib = (from, to) => ({ [LIB]: swap(SRC.lib, from, to) })
const libFirst = (from, to) => ({ [LIB]: swapFirst(SRC.lib, from, to) })
const comp = (key, from, to) => ({ [FILE[key]]: swap(SRC[key], from, to) })
// behaviour mutants of the lib (the reducer, the meter, the words, the plans, the flags)
await mutant('B: the reducer drops steps', () => proveShell(lib('fresh ? [...base.steps, step].slice(-AGENT_MAX_STEPS_KEPT)', 'fresh ? base.steps.slice(-AGENT_MAX_STEPS_KEPT)')))
await mutant('B: the meter text shows over the cap', () => proveShell(lib('${formatCreditsNumber(Math.min(used, cap))} of', '${formatCreditsNumber(used)} of')))
await mutant('B: the meter bar draws over the cap', () => proveShell(lib('return Math.min(1, used / cap)', 'return used / cap')))
await mutant('B: the state is lost on an unknown frame', () => proveShell(lib('if (!frame) return state', 'if (!frame) return initialAgentRunState()')))
await mutant('B: credits used can go down', () => proveShell(lib('usedCredits: Math.max(base.usedCredits, p.credits_used ?? 0), steps,', 'usedCredits: p.credits_used ?? base.usedCredits, steps,')))
await mutant('B: another run\'s frame is accepted', () => proveShell(lib('if (state.runId !== null && state.runId !== runId) return state', 'if (false) return state')))
await mutant('B: a stale frame after done / failed is accepted', () => proveShell(lib('if (TERMINAL.includes(state.status)) return state', 'if (false) return state')))
await mutant('B: a second run starts while one is live', () => proveShell(lib('    if (LIVE.includes(state.status)) return state\n', '')))
await mutant('B: a started estimate is refreshed', () => proveShell(lib("state.status === 'estimate' && state.estimate !== null && state.estimate.answered === null ?", "state.status === 'estimate' && state.estimate !== null ?")))
await mutant('B: a checkpoint stays after the run moved on', () => proveShell(lib('pending: fresh ? null : base.pending', 'pending: base.pending')))
await mutant('B: the reducer changes the state it is given', () => proveShell(lib('const at = base.steps.findIndex(s => s.n === p.step), fresh = at === -1', "const at = base.steps.findIndex(s => s.n === p.step), fresh = at === -1\n      base.steps.push({ n: 0, label: 'x', stepState: 'done' })")))
await mutant('B: a server step label is not cleaned', () => proveShell(lib('label: plainWords(p.label, AGENT_COPY.stepFallback)', 'label: p.label')))
await mutant('B: a padded payload passes through the parse', () => proveShell(lib("return { type: 'agent_step', payload: { run_id, step, label:", "return { type: 'agent_step', payload: { ...p, run_id, step, label:")))
await mutant('B: a silent fallback in the reducer (failed with a fallback offered goes on running)', () => proveShell(lib("return { ...base, status: 'failed', estimate: null, pending: null, failure:", "return { ...base, status: p.fallback_credits !== undefined ? 'running' : 'failed', estimate: null, pending: null, failure:")))
await mutant('B: the answer frame loses the choice', () => proveShell(lib('data: { run_id: answer.runId, card: answer.card, choice: answer.choice }', 'data: { run_id: answer.runId, card: answer.card }')))
await mutant('C: a leak word in the Stop button ("$")', () => proveShell(lib("  stop: 'Stop',", "  stop: 'Stop ($)',"))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('C: a leak word in the meter label ("tokens")', () => proveShell(lib("creditsUsed: 'Credits used',", "creditsUsed: 'Tokens used',")))
await mutant('C: a currency sign in the estimate', () => proveShell(lib('`About ${formatCredits(est)} · cap ${formatCredits(cap)}`', '`About $${formatCredits(est)} · cap ${formatCredits(cap)}`')))
await mutant('C: credits drawn as dollars', () => proveShell(lib("return `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`", "return `$${n.toLocaleString('en-US')}`")))
await mutant('C: the leak backstop for a server string is off', () => proveShell(lib("if (clean === '' || AGENT_LEAK.test(clean)) return fallback", "if (clean === '') return fallback")))
await mutant('D: Agent enabled for Free', () => proveShell(lib("plan === 'pro' || plan === 'premium'", "plan === 'pro' || plan === 'premium' || plan === 'free'")))
await mutant('D: "max" is taken for a plan', () => proveShell(lib("raw === 'premium' ? raw : null)", "raw === 'premium' ? raw : raw === 'max' ? 'premium' : null)")))
await mutant('D: Author shows without its flag', () => proveShell(lib('if (flags.author) out.push(', 'if (true) out.push(')))
await mutant('D: Agent sent for a plan that is not Pro or Max', () => proveShell(lib("return flags.agent && agentEligible(opts.plan) ? 'agent' : undefined", "return flags.agent ? 'agent' : undefined")))
await mutant('D: "standard" is always sent (a legacy build carries build_mode)', () => proveShell(lib("return opts.previous === 'author' || opts.previous === 'agent' ? 'standard' : undefined", "return 'standard'")))
await mutant('A: the agent flag reads "1" as on', () => proveShell(lib("agent === 'true' && shell === 'true'", "(agent === 'true' || agent === '1') && shell === 'true'")))
await mutant('A: the author flag reads "1" as on', () => proveShell(lib("author === 'true' && shell === 'true'", "(author === 'true' || author === '1') && shell === 'true'")))
await mutant('A: the agent flag works without the Studio shell', () => proveShell(lib("agent === 'true' && shell === 'true'", "agent === 'true'")))
await mutant('A: the frame allow-list is open with the flag off', () => proveShell(lib('STUDIO_AGENT_MODE_ENABLED ? AGENT_FRAME_TYPES : []', 'AGENT_FRAME_TYPES')))
// component mutants
await mutant('A: the estimate card draws with the flag off', () => proveShell(comp('estimate', 'if (!STUDIO_AGENT_MODE_ENABLED || state.status !== "estimate"', 'if (state.status !== "estimate"')))
await mutant('A: the run card draws with the flag off', () => proveShell(comp('run', 'if (!STUDIO_AGENT_MODE_ENABLED || state.runId === null', 'if (state.runId === null')))
await mutant('A: the failed card draws with the flag off', () => proveShell(comp('failed', 'if (!STUDIO_AGENT_MODE_ENABLED || state.runId === null', 'if (state.runId === null')))
await mutant('A: the picker draws with both flags off', () => proveShell(comp('picker', 'if (!STUDIO_AGENT_MODE_ENABLED && !STUDIO_AUTHOR_MODE_PICKER_ENABLED) return null\n', '')))
await mutant('D: the picker turns Agent on for every plan', () => proveShell(comp('picker', 'disabled={disabled || option.disabled}', 'disabled={disabled}')))
await mutant('E: a silent fallback: the failed card answers by itself', () => proveShell(comp('failed', 'const runId = state.runId, offered = failure.fallbackCredits !== null', 'const runId = state.runId, offered = failure.fallbackCredits !== null\n  if (offered) onAnswer?.({ runId, card: "A6", choice: "fallback" })')))
await mutant('E: no explicit fallback button when one is offered', () => proveShell(comp('failed', '{offered ? <AgentActionButton choice="fallback" answered={failure.answered} onClick={() => onAnswer?.({ runId, card: "A6", choice: "fallback" })}>{AGENT_COPY.failedFallback}</AgentActionButton> : null}', '')))
await mutant('E: the fallback is offered without its price', () => proveShell(comp('failed', '{offered ? <AgentCardText>{failedFallbackWords(failure.fallbackCredits ?? 0)}</AgentCardText> : null}', '')))
await mutant('E: an answered card can be answered again', () => proveShell(comp('frame', 'disabled={Boolean(answered) || disabled}', 'disabled={disabled}')))
await mutant('E: a card carries data-director-action-id (a voice "yes" could answer it)', () => proveShell(comp('frame', 'data-studio-agent-card={kind}', 'data-studio-agent-card={kind} data-director-action-id="x"')))
await mutant('E: a colour literal in the card frame', () => proveShell(comp('frame', '<div data-studio-director-part="heading" className="flex items-center gap-1.5 mb-1.5">', '<div data-studio-director-part="heading" style={{ color: "#ff0000" }} className="flex items-center gap-1.5 mb-1.5">')))
await mutant('E: a finished run keeps its controls', () => proveShell(comp('run', 'const live = state.status === "running" || state.status === "paused" || state.status === "stopped"', 'const live = true')))
await mutant('B: the meter fill is not held to the cap', () => proveShell(comp('run', '${Math.round(meterFraction(state.usedCredits, cap) * 100)}%', '${Math.round((cap ? state.usedCredits / cap : 0) * 100)}%')))
await mutant('B: the meter value is not held to the cap', () => proveShell(comp('run', 'aria-valuenow={cap === null ? undefined : shown}', 'aria-valuenow={cap === null ? undefined : state.usedCredits}')))
await mutant('E: the estimate card has no Stop', () => proveShell(comp('estimate', '<AgentActionButton choice="cancel" answered={answered} onClick={() => onAnswer?.({ runId, card: "A1", choice: "cancel" })}>{AGENT_COPY.stop}</AgentActionButton>', ''))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
const draftsWith = (i, over) => AGENT_MODE_SHELL_DRAFTS.map((d, j) => (j === i ? { ...d, ...over } : d))
// the contract (J): the reader, the card ids and choices, the reason words, the stopped run, the answer path, the fixture itself
await mutant('J: a reader still using estimate_low', () => proveShell(lib('const est = credits(p.est_credits), cap = credits(p.cap_credits), expires =', 'const est = credits(p.estimate_low), cap = credits(p.cap_credits), expires =')))
await mutant('J: the research offer reader still uses extra_credits', () => proveShell(lib('const est = credits(p.est_credits), slides = Array.isArray(p.slides)', 'const est = credits(p.extra_credits), slides = Array.isArray(p.slides)')))
await mutant('J: text instead of label', () => proveShell(lib("typeof p.label !== 'string'", "typeof p.text !== 'string'")))
await mutant('J: state and status instead of step_state and run_status', () => proveShell(lib("const stepState = p.step_state === 'running' || p.step_state === 'done' || p.step_state === 'failed' ? p.step_state : undefined, runStatus = p.run_status === 'running' || p.run_status === 'paused' || p.run_status === 'stopped' ? p.run_status : undefined", "const stepState = p.state === 'running' || p.state === 'done' || p.state === 'failed' ? p.state : undefined, runStatus = p.status === 'running' || p.status === 'paused' || p.status === 'stopped' ? p.status : undefined")))
await mutant('J: agent_done still reads credits_used', () => proveShell(lib('const slides = wholeCount(p.slides), charged = credits(p.charged_credits)', 'const slides = wholeCount(p.slides), charged = credits(p.credits_used)')))
await mutant('J: agent_done.slides read as a list length', () => proveShell(lib('const slides = wholeCount(p.slides), charged', 'const slides = Array.isArray(p.slides) ? p.slides.length : wholeCount(p.slides), charged')))
await mutant('J: agent_failed.step required again', () => proveShell(lib("const step = p.step === undefined ? undefined : whole(p.step), charged", "const step = whole(p.step), charged")))
await mutant('J: an A3 choice finish (the old word)', () => proveShell(lib("A3: ['continue', 'stop']", "A3: ['continue', 'finish']")))
await mutant('J: an A4 choice keep (an old word)', () => proveShell(lib("A4: ['add', 'skip']", "A4: ['add', 'keep']")))
await mutant('J: an A6 choice standard (the old word)', () => proveShell(lib("A6: ['fallback', 'stop']", "A6: ['standard', 'stop']")))
await mutant('J: the A3 card id is not checked on the frame', () => proveShell(lib(" || p.card !== 'A3' || !offersAll(p.choices, CHOICES.A3)", '')))
await mutant('J: the answer card is the old kind, not the contract\'s id', () => proveShell(lib("data: { run_id: answer.runId, card: answer.card, choice: answer.choice }", "data: { run_id: answer.runId, card: answer.card === 'A3' ? 'checkpoint' : answer.card, choice: answer.choice }")))
await mutant('J: a missing reason code', () => proveShell(lib("  timeout: 'The build took too long.',\n", '')))
await mutant('J: a reason code the fixture does not have', () => proveShell(lib("  tool_error: 'A build tool reported a problem.',\n", "  tool_error: 'A build tool reported a problem.',\n  brand_new_code: 'Something new went wrong.',\n")))
await mutant('J: a reason sentence with a model name', () => proveShell(lib("timeout: 'The build took too long.'", "timeout: 'The Sonnet model took too long.'")))
await mutant('J: a reason sentence with a provider and a currency sign', () => proveShell(lib("budget: 'The build would go over its credit budget.'", "budget: 'The provider charged $2 over the budget.'")))
await mutant('J: a reason sentence with a router name', () => proveShell(lib("router_error: 'A build service reported a problem.'", "router_error: 'The router reported a problem.'")))
await mutant('J: two codes share one sentence', () => proveShell(lib("stopped: 'The build was stopped.'", "stopped: 'The build was stopped from its controls.'")))
await mutant('J: an unknown reason code is shown as it came', () => proveShell(lib(': AGENT_COPY.reasonFallback)', ': String(code))')))
await mutant('J: the failure holds the raw code, not its sentence', () => proveShell(lib('reason: agentReasonWords(p.reason),', 'reason: p.reason,')))
await mutant('J: stopped treated as final before an A3 card', () => proveShell(lib("const TERMINAL: readonly AgentRunStatus[] = ['done', 'failed']", "const TERMINAL: readonly AgentRunStatus[] = ['done', 'failed', 'stopped']")))
await mutant('J: an answer to A3 / A4 does not resume the run', () => proveShell(lib("status: LIVE.includes(state.status) ? (resumes ? 'running' : 'stopped') : state.status,", 'status: state.status,')))
await mutant('J: a Stop answer (stop / skip) resumes the run too', () => proveShell(lib("(resumes ? 'running' : 'stopped')", "'running'")))
await mutant('J: the answer guard ignores the socket', () => proveShell(lib('socketOpen === true && agentAnswerValid(answer)', 'agentAnswerValid(answer)')))
await mutant('J: the answer guard takes any truthy socket', () => proveShell(lib('socketOpen === true && agentAnswerValid(answer)', 'Boolean(socketOpen) && agentAnswerValid(answer)')))
await mutant('J: a card that is not open can be answered', () => proveShell(lib("case 'A3': return state.pending !== null && state.pending.kind === 'checkpoint' && state.pending.answered === null && !TERMINAL.includes(state.status)", "case 'A3': return true")))
await mutant('J: the estimate expiry is ignored by the guard', () => proveShell(lib("(answer.choice === 'cancel' || !estimateExpired(state.estimate.expiresAt, nowMs))", 'true')))
await mutant('J: the estimate expiry is ignored by the reader (a bad date accepted)', () => proveShell(lib('Number.isFinite(Date.parse(v)) ? v : null', 'true ? v : null')))
await mutant('J: the estimate never expires', () => proveShell(lib('return Number.isFinite(at) && nowMs >= at', 'return false')))
await mutant('J: the estimate expires one instant late', () => proveShell(lib('return Number.isFinite(at) && nowMs >= at', 'return Number.isFinite(at) && nowMs > at')))
const STOP_BUTTON = '<AgentActionButton choice="cancel" answered={answered} onClick={() => onAnswer?.({ runId, card: "A1", choice: "cancel" })}>{AGENT_COPY.stop}</AgentActionButton>' // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: a Start button comes back on the estimate card', () => proveShell(comp('estimate', STOP_BUTTON, '<AgentActionButton choice="start" primary answered={answered} onClick={() => onAnswer?.({ runId, card: "A1", choice: "start" })}>Start</AgentActionButton>' + STOP_BUTTON))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: a Cancel button comes back beside Stop', () => proveShell(comp('estimate', STOP_BUTTON, STOP_BUTTON + '<AgentActionButton choice="cancel" answered={answered} onClick={() => onAnswer?.({ runId, card: "A1", choice: "cancel" })}>Cancel</AgentActionButton>'))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: the Stop sends start', () => proveShell(comp('estimate', 'card: "A1", choice: "cancel" })}>{AGENT_COPY.stop}', 'card: "A1", choice: "start" })}>{AGENT_COPY.stop}'))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: the Stop sends another card\'s answer (A3)', () => proveShell(comp('estimate', 'card: "A1", choice: "cancel" })}>{AGENT_COPY.stop}', 'card: "A3", choice: "stop" })}>{AGENT_COPY.stop}'))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: the Stop is always off', () => proveShell(comp('estimate', 'answered={answered} onClick={() => onAnswer?.({ runId, card: "A1", choice: "cancel" })}', 'answered={answered} disabled onClick={() => onAnswer?.({ runId, card: "A1", choice: "cancel" })}'))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: the Stop can be taken again once answered', () => proveShell(comp('estimate', 'choice="cancel" answered={answered} onClick', 'choice="cancel" answered={null} onClick'))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: "Running" is dropped from the estimate line', () => proveShell(comp('estimate', ' · ${AGENT_COPY.estimateRunning}`', '`'))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: "Estimated cost" is dropped from the estimate line', () => proveShell(comp('estimate', '`${AGENT_COPY.estimateLabel}: ${formatEstimate(credits, cap)}', '`${formatEstimate(credits, cap)}'))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: the word "Running" changes in the copy', () => proveShell(lib("estimateRunning: 'Running',", "estimateRunning: 'Waiting',"))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: a leak word beside the label (a currency sign)', () => proveShell(lib("estimateLabel: 'Estimated cost',", "estimateLabel: 'Estimated cost in $',"))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: the label says "price" instead of "cost" (a leak word)', () => proveShell(lib("estimateLabel: 'Estimated cost',", "estimateLabel: 'Estimated price',"))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: the estimate card keeps a timer (a hook comes back)', () => proveShell(comp('estimate', '  return (\n    <AgentCardFrame kind="estimate"', '  React.useEffect(() => { const t = setTimeout(() => {}, 1000); return () => clearTimeout(t) }, [])\n  return (\n    <AgentCardFrame kind="estimate"'))) // LATER-CHANGES: registry read (AGENT-MODE-WIRE)
await mutant('J: the estimate card still shows a range (the old words)', () => proveShell(lib('`About ${formatCredits(est)} · cap ${formatCredits(cap)}`', '`About ${formatCredits(est)}–${formatCredits(est + 1)} · cap ${formatCredits(cap)}`')))
await mutant('J: the A3 sentence says finish again', () => proveShell(lib('more ${Math.ceil(more) === 1 ? \'credit\' : \'credits\'}, or stop now?`', 'more ${Math.ceil(more) === 1 ? \'credit\' : \'credits\'}, or finish now?`')))
await mutant('J: a model name in the A3 stop button', () => proveShell(lib("checkpointStop: 'Stop now',", "checkpointStop: 'Stop Claude',")))
const DRAFT_H7 = AGENT_MODE_SHELL_DRAFTS.findIndex(d => d.id === 'H7'), h7 = AGENT_MODE_SHELL_DRAFTS[DRAFT_H7].add
await mutant('J: the drafted hook queues an answer for after a reconnect', () => proveAnswerPath({}, draftsWith(DRAFT_H7, { add: [h7[0], "    const socket = wsRef.current; if (!socket || !agentAnswerSendable(answer, socket.readyState === WebSocket.OPEN)) { agentAnswerQueue.push(answer); return false; } try { socket.send(JSON.stringify(agentAnswerFrame(answer))); return true; } catch { return false; } // AGENT-MODE-SHELL", h7[2]] })))
await mutant('J: the drafted hook sends on a socket that is not open', () => proveAnswerPath({}, draftsWith(DRAFT_H7, { add: [h7[0], "    const socket = wsRef.current; if (!socket) return false; try { socket.send(JSON.stringify(agentAnswerFrame(answer))); return true; } catch { return false; } // AGENT-MODE-SHELL", h7[2]] })))
await mutant('J: the drafted hook retries a failed send', () => proveAnswerPath({}, draftsWith(DRAFT_H7, { add: [h7[0], "    const socket = wsRef.current; if (!socket || !agentAnswerSendable(answer, socket.readyState === WebSocket.OPEN)) return false; try { socket.send(JSON.stringify(agentAnswerFrame(answer))); return true; } catch { try { socket.send(JSON.stringify(agentAnswerFrame(answer))); return true; } catch { return false; } } // AGENT-MODE-SHELL", h7[2]] })))
await mutant('J: the drafted page marks the card answered without checking it is open', () => proveAnswerPath({}, draftsWith(AGENT_MODE_SHELL_DRAFTS.findIndex(d => d.id === 'P7'), { add: ['                  <AgentRunCards state={agentRun} onAnswer={answer => { sendAgentAnswer(answer); dispatchAgentRun(agentAnswered(answer)) }} onControl={action => { sendBuildControl(action, buildNarration.buildId ?? undefined) }} />{/* AGENT-MODE-SHELL */}'] })))
await mutant('J: the fixture reformatted (indented by 4)', () => proveFixtureBytes(Buffer.from(`${JSON.stringify(FIX, null, 4)}\n`)))
await mutant('J: the fixture reformatted (compact)', () => proveFixtureBytes(Buffer.from(`${JSON.stringify(FIX)}\n`)))
await mutant('J: the fixture with one byte added', () => proveFixtureBytes(Buffer.concat([FIXTURE_BYTES, Buffer.from('\n')])))
await mutant('J: the fixture with one reason code dropped', () => proveFixtureBytes(Buffer.from(FIXTURE_BYTES.toString('utf8').replace('    "timeout",\n', ''))))
// the strip, the env block, the registry, the drafts
await mutant('F: a strip that leaves a line (the taught line stays in a proof)', () => proveStrip((rel, text) => (rel === AGENT_MODE_SHELL_PIN_FILES[0] ? text : stripAgentModeShell(rel, text))))
await mutant('F: a strip that is not idempotent (it takes one more line away each time)', () => proveStrip((rel, text) => { const out = stripAgentModeShell(rel, text); return rel === AGENT_MODE_SHELL_PIN_FILES[1] && out === text ? out.replace(/^[^\n]*\n/, '') : out }))
await mutant('F: a strip that edits a file it does not own', () => proveStrip((rel, text) => (rel === 'app/builder/page.tsx' ? `${text}x` : stripAgentModeShell(rel, text))))
await mutant('F: a taught proof keeps a second, unmarked line', () => proveStrip(stripAgentModeShell, rel => (rel === AGENT_MODE_SHELL_PIN_FILES[0] ? read(rel).replace(AGENT_MODE_SHELL_PIN_EDITS[rel][0][0], `${AGENT_MODE_SHELL_PIN_EDITS[rel][0][0]}  // stray\n`) : read(rel))))
await mutant('F: a taught line without the registry-read mark', () => proveStrip(stripAgentModeShell, rel => (rel === AGENT_MODE_SHELL_PIN_FILES[1] ? swap(read(rel), 'registry read (AGENT-MODE-SHELL): on a branch', 'on a branch') : read(rel))))
await mutant('F: a taught line put somewhere that is not after a subject filter', () => proveStrip(stripAgentModeShell, rel => {
  if (rel !== AGENT_MODE_SHELL_PIN_FILES[0]) return read(rel)
  const lines = read(rel).split('\n'), at = lines.findIndex(l => l.includes(AGENT_MODE_SHELL_PIN_MARK)), [line] = lines.splice(at, 1); lines.splice(lines.findIndex(l => l.startsWith('import ')), 0, line); return lines.join('\n')
}))
await mutant('F: a strip that leaves the voice-call lines (FRONTEND-1\'s OK\'d edit stays in the proof)', () => proveStrip((rel, text) => (rel === VCALL ? text : stripAgentModeShell(rel, text))))
await mutant('F: an OK\'d voice-call line edited by one character (the changed .env.example line loses its trimEnd)', () => proveStrip(stripAgentModeShell, rel => (rel === VCALL ? swap(read(rel), ".trimEnd().endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly", ".endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly") : read(rel))))
await mutant('F: a fifth line in the voice-call proof (an unlisted edit beside the four OK\'d)', () => proveStrip(stripAgentModeShell, rel => (rel === VCALL ? `${read(rel)}// a fifth line\n` : read(rel))))
await mutant('F: the two inserted voice-call lines moved off their anchor (to the top of the file)', () => proveStrip(stripAgentModeShell, rel => {
  if (rel !== VCALL) return read(rel)
  const lines = read(rel).split('\n'), at = lines.indexOf(FE1_ANCHOR), moved = lines.splice(at + 1, 2); lines.splice(0, 0, ...moved); return lines.join('\n')
}))
await mutant('F: an OK\'d voice-call line without its mark in the file (the helper line)', () => proveStrip(stripAgentModeShell, rel => (rel === VCALL ? swap(read(rel), "''), text) // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "''), text)\n") : read(rel))))
const ENV_NOW = read('.env.example'), REG_NOW = read(REGISTRY), regLinesOf = text => text.split('\n')
await mutant('F: the env block moved off the true end (above the voice call block)', () => { const body = ENV_NOW.slice(0, -AGENT_MODE_SHELL_ENV_BLOCK.length - 1), at = body.lastIndexOf('# STUDIO VOICE CALL UI'); assert.ok(at > 0); proveEnvText(`${body.slice(0, at)}${AGENT_MODE_SHELL_ENV_BLOCK}\n${body.slice(at)}\n`.replace(/\n\n\n$/, '\n')) })
await mutant('F: a flag documented as "true"', () => proveEnvText(swap(ENV_NOW, 'NEXT_PUBLIC_AGENT_MODE="false"', 'NEXT_PUBLIC_AGENT_MODE="true"'), swap(AGENT_MODE_SHELL_ENV_BLOCK, 'NEXT_PUBLIC_AGENT_MODE="false"', 'NEXT_PUBLIC_AGENT_MODE="true"')))
await mutant('F: a stray line after the env block', () => proveEnvText(`${ENV_NOW}NEXT_PUBLIC_STRAY="false"\n`))
await mutant('F: the env block missing', () => proveEnvText(removeBlock(ENV_NOW, AGENT_MODE_SHELL_ENV_BLOCK)))
await mutant('F: a registry line in the wrong list (the files line moved above dev\'s last)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('SCOPE_FILES')), [line] = reg.splice(at, 1); reg.splice(reg.findIndex(l => l.includes('studio-voice-call-strip.mjs') && l.includes('SCOPE_FILES')), 0, line); proveRegistryText(reg.join('\n')) })
await mutant('F: a registry line moved off the true end (the env line above dev\'s last)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('ENV_BLOCK')), [line] = reg.splice(at, 1); reg.splice(reg.findIndex(l => l.includes('studio-voice-call-strip.mjs') && l.includes('ENV_BLOCK')), 0, line); proveRegistryText(reg.join('\n')) })
await mutant('F: the strip line missing', () => proveRegistryText(regLinesOf(REG_NOW).filter(l => !(l.includes(OWN_NAME) && l.includes('stripAgentModeShell'))).join('\n')))
await mutant('F: the files line missing', () => proveRegistryText(regLinesOf(REG_NOW).filter(l => !(l.includes(OWN_NAME) && l.includes('SCOPE_FILES'))).join('\n')))
await mutant('F: the env line missing', () => proveRegistryText(regLinesOf(REG_NOW).filter(l => !(l.includes(OWN_NAME) && l.includes('ENV_BLOCK'))).join('\n')))
await mutant('F: a line of dev\'s registry lost', () => { const reg = regLinesOf(REG_NOW); reg.splice(reg.findIndex(l => l.includes('studio-voice-call-strip.mjs') && l.includes('stripVoiceCall')), 1); proveRegistryText(reg.join('\n')) })
await mutant('F: a second files line (two lines in one list)', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('SCOPE_FILES')); reg.splice(at + 1, 0, reg[at]); proveRegistryText(reg.join('\n')) })
await mutant('F: a registry line that is not in the registered shape below ours', () => { const reg = regLinesOf(REG_NOW), at = reg.findIndex(l => l.includes(OWN_NAME) && l.includes('stripAgentModeShell')); reg.splice(at + 1, 0, "  (await import('./studio-x-strip.mjs')).stripX, // not registered"); proveRegistryText(reg.join('\n')) })
const DRAFT_H6 = AGENT_MODE_SHELL_DRAFTS.findIndex(d => d.id === 'H6')
await mutant('F: a draft anchor that drifted (a wrong dev line number)', () => proveDrafts(read, draftsWith(DRAFT_H6, { line: AGENT_MODE_SHELL_DRAFTS[DRAFT_H6].line + 1 })))
await mutant('F: a draft line without the marker', () => proveDrafts(read, draftsWith(DRAFT_H6, { add: ['          ...(options?.buildMode && { build_mode: options.buildMode }),'] })))
await mutant('F: a draft that is already applied (the hook has its line)', () => proveDrafts(rel => (rel === 'hooks/use-deckster-websocket-v2.ts' ? `${read(rel)}\n${AGENT_MODE_SHELL_DRAFTS[DRAFT_H6].add[0]}\n` : read(rel))))
await mutant('F: a draft that does not parse', () => proveDrafts(read, draftsWith(DRAFT_H6, { add: ['          ...(options?.buildMode && { build_mode: options.buildMode ), // AGENT-MODE-SHELL'] })))
await mutant('F: a draft that imports a name the lib does not export', () => proveDrafts(read, draftsWith(0, { add: ["import { STUDIO_AGENT_FRAME_TYPES, noSuchName } from '@/lib/studio-agent-mode'; // AGENT-MODE-SHELL"] })))
// scope and the stack
if (ON_OWN_LINE) {
  await mutant('G: a stray file in an own commit', () => scopeBreakers['a stray file in an own commit']())
  await mutant('G: an own commit without the co-author line', () => scopeBreakers['an own commit without the co-author line']())
  await mutant('G: a draft applied to the hook in an own commit', () => scopeBreakers['a draft applied to the hook in an own commit']())
  await mutant('G: the old first-parent query (finds no own commit on the gate-style merge)', () => scopeOwnCommits(GATE, { firstParentOnly: true }))
  await mutant('G: the HEAD^2 rule dropped (the scope runs against the merge itself)', () => { assert.equal(scopeHead(GATE, { gateRule: false }), HEAD, 'the scope head is the change\'s head') })
  await mutant('G: a touched file of FRONTEND-1\'s lane (an own commit edits the Builder page)', () => scopeCommittedFiles(commitWith(HEAD, { 'app/builder/page.tsx': `${git('show', `${HEAD}:app/builder/page.tsx`)}\n` }, `${AGENT_MODE_SHELL_SUBJECT} edits their page${TRAILER}`)))
  await mutant('G: a fifth line added to FRONTEND-1\'s voice-call proof in an own commit (only their four OK\'d lines are allowed)', () => scopeCommittedFiles(commitWith(HEAD, { [VCALL]: `${git('show', `${HEAD}:${VCALL}`)}// a fifth line\n` }, `${AGENT_MODE_SHELL_SUBJECT} a fifth voice-call line${TRAILER}`)))
  await mutant('G: another FRONTEND-1 voice-call proof touched in an own commit (the replay proof was not OK\'d)', () => scopeCommittedFiles(commitWith(HEAD, { 'scripts/test-studio-voice-call-replay.mjs': `${git('show', `${HEAD}:scripts/test-studio-voice-call-replay.mjs`)}\n` }, `${AGENT_MODE_SHELL_SUBJECT} touches the replay proof${TRAILER}`)))
  await mutant('H: a later commit with an unregistered file stacked on this head', () => scopeCommittedFiles(laterCommit(HEAD, { registryLines: true, extra: { 'stray-later-change.txt': 'stray\n' } }), { later: synLater }))
  await mutant('H: the later change\'s strip not told to the pins (its line breaks the put-back)', () => provePins(rel => git('show', `${laterCommit(HEAD, { registryLines: true })}:${rel}`), 'linear stack, not told', laterStrips))
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { for (const label of failed) console.error(`  failed: ${label}`); for (const label of missed) console.error(`  missed: ${label}`); process.exit(1) }
