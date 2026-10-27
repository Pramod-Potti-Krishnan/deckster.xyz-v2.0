// FRONTEND-2 (B27, E2E-2 chat parity Pass A, 27 Oct): proof of NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END (exact "true", default off, build-time).
//
// THE DEFECT. At the outline gate a typed "Looks perfect, go ahead." is not the exact J1 phrase, so Director falls through to its legacy invoke_tools turn. The turn sends status_update "Generating presentation content..."
// BEFORE the tools run, the tools fail, and it sends ONE chat_message ("I couldn't finish generating the content: ...") and token_usage: no build_phase, no build_event, no slide_built, no terminal status
// (streams/director2/build-failure-frames/FINDINGS.md; src/handlers/websocket.py _handle_invoke_tools, _send_status, _send_chat, _send_token_usage). Studio's narration reducer maps that status text to the "building" phase
// (lib/build-narration-heuristics.ts interpretStatus) and the outline's five slides give "0 of 5 built"; nothing in the reducer ever leaves "building" without a final URL or a typed terminal phase, and the narration hook ignores
// currentStatus going back to null (hooks/use-build-narration.ts, the status effect: `if (!enabled || !currentStatus) return`), although the socket hook clears it on the chat_message
// (hooks/use-deckster-websocket-v2.ts, case 'chat_message': currentStatus = null). So "Building your slides... 0 of 5 built", Pause, Stop and "Building slides" under the composer stay until the user presses Stop.
//
// THE FIX (flag on). The narration hook notices a status that opened "building" going away with no typed build frame in between (a counter in the four typed handlers) and not for a build the user accepted with the button
// (isGeneratingFinal), and the reducer's new status_ended action leaves the "building" only if nothing is built behind it (isUnbackedBuilding). The outline and its ghosts stay. No new text, no Director change.
//
//   1. The failure turn through the REAL socket hook, narration hook and reducer, and the REAL StageRibbon (the build-resume harness: fake socket, virtual clock, the page's own argument object for useBuildNarration): flag
//      off the stuck "Building your slides... 0 of 5 built" with Pause and Stop is still there 2.5 minutes later; flag on it is gone right after the reply; a real build after the failure starts as usual.
//   2. A normal build, Stop, resume, a reload (the J7 recorded frames) and a pause / resume: flag on is byte-for-byte the flag-off run (checkpoints, socket bytes, handler calls, build-control requests).
//   3. Flag off is byte-identical to the base: every flag-off run hashes as the run recorded from the base tree (scripts/fixtures/build-failure-end/baselines/flag-off.json); the strip gives the base files back; the hook's
//      dispatched actions equal the base hook's for the same renders.
//   4. The reducer and the hook in isolation (every guard), and the flag plumbing.
//   5. Mutants: each must be caught.
//   6. Scope over the COMMITTED diff (BASE..HEAD, the commits that start "Build failure end:").
//
//   node scripts/test-studio-build-failure-end.mjs
//   node scripts/test-studio-build-failure-end.mjs --record-baseline --root <base checkout>   (re-record the flag-off baseline from a base tree)
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed); git is read only for 6.
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

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const recordBaseline = args.includes('--record-baseline')
const root = path.resolve(option('--root') || repo)
const FLAG = 'NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const baselineFile = path.join(repo, 'scripts/fixtures/build-failure-end/baselines/flag-off.json')

let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}

// The registry strips this change's page line for every other reader (the chat harness parses the page through it). In THIS process only, take that one strip out, so the harness runs the page WITH its line.
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-build-failure-end-strip.mjs')
const { stripBuildFailureEnd, BASE_COMMIT, BUILD_FAILURE_END_FILES, BUILD_FAILURE_END_SCOPE_FILES, BUILD_FAILURE_END_ENV_BLOCK, BUILD_FAILURE_END_SUBJECT, BUILD_FAILURE_END_MARKER_RE, BUILD_FAILURE_END_PIN_EDITS } = stripModule
const stripAt = registry.LATER_STRIPS.indexOf(stripBuildFailureEnd)
assert.ok(stripAt >= 0, 'the registry names this change\'s strip')
registry.LATER_STRIPS.splice(stripAt, 1)

const { installHostNetworkGuard } = await import('./studio-chat-harness/fake-env.mjs')
const { runBuildResumeTranscript } = await import('./studio-chat-harness/build-resume-transcript.mjs')

// ---- 1-3. the transcripts ----------------------------------------------------------------------------------------------------------------------------------------------------------------
const mine = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/fixtures/build-failure-end/outline-gate-typed-approval-failure.json'), 'utf8'))
const j7 = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/fixtures/build-resume/j7-stop-resume.json'), 'utf8'))
const composed = { ...mine, frames: { ...mine.frames, j7_live_stop: j7.frames.live_stop } }
const myScenarios = Object.keys(mine.scenarios)
const j7Scenarios = Object.keys(j7.scenarios)
// The runner's `director` argument is this change's flag here ('on': NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END="true" in the page's env); the J7 fixtures keep their meaning (Director !490) and run with both.
const withFlag = (fixture, on) => ({ ...fixture, env: { ...(fixture.env || {}), ...(on ? { [FLAG]: 'true' } : {}) } })
const runs = {}
const release = installHostNetworkGuard(net, dns)
for (const scenario of myScenarios) for (const on of recordBaseline ? [false] : [false, true]) {
  runs[`mine/${scenario}|${on ? 'on' : 'off'}`] = await runBuildResumeTranscript({ root, fixture: withFlag(composed, on), scenario, flag: 'off', director: on ? 'on' : 'off' })
}
for (const scenario of j7Scenarios) for (const director of ['off', 'on']) for (const on of recordBaseline ? [false] : [false, true]) {
  runs[`j7/${scenario}/${director}|${on ? 'on' : 'off'}`] = await runBuildResumeTranscript({ root, fixture: withFlag(j7, on), scenario, flag: 'off', director })
}
release()
const identity = run => ({ checkpoints: sha(JSON.stringify(run.checkpoints)), outbound: sha(run.outbound), calls: sha(JSON.stringify(run.calls)), controlRequests: sha(JSON.stringify(run.controlRequests)) })

if (recordBaseline) {
  const baseline = { recorded_from: 'the base tree (studio-v4-dev-preparation-code 14a06c30), flag off', fixture_sha256: sha(JSON.stringify(composed)), j7_fixture_sha256: sha(JSON.stringify(j7)),
    runs: Object.fromEntries(Object.entries(runs).map(([key, run]) => [key, identity(run)])) }
  fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 1) + '\n')
  console.log(`recorded ${Object.keys(baseline.runs).length} flag-off runs from ${root} into ${path.relative(repo, baselineFile)}`)
  process.exit(0)
}

console.log('1. the failure turn, through the real socket hook, narration hook, reducer and ribbon')
const view = (run, label) => run.checkpoints.find(c => c.label === label)
await check('every run is clean: the fixtures\' own expectations hold, no blocked network, no uncaught error, no console error', () => {
  for (const [key, run] of Object.entries(runs)) {
    assert.deepEqual(run.failures, [], key)
    assert.deepEqual(run.diagnostics.blockedNetwork, [], key); assert.deepEqual(run.diagnostics.uncaught, [], key); assert.deepEqual(run.diagnostics.console, [], key)
  }
})
await check('flag OFF is today\'s defect: 2.5 minutes after Director\'s failure reply Studio still reads "Building your slides... 0 of 5 built" with Pause and Stop', () => {
  const end = view(runs['mine/typed-approval-fails|off'], 'end')
  assert.equal(end.narration.phase, 'building'); assert.equal(end.narration.active, true); assert.equal(end.view.ribbon, true)
  assert.match(end.view.headline, /^Building your slides…/); assert.match(end.view.headline, /0\s*of 5 built/)
  assert.deepEqual(end.view.buttons.map(b => b.text), ['Pause', 'Stop'])
  assert.equal(end.narration.slideCount, 5); assert.equal(end.narration.slidesDone, 0); assert.equal(end.narration.buildId, null)
  assert.equal(end.snapshotStored, true, 'the stuck build is even kept for a reload')
})
await check('flag ON: the failure reply ends the building state: no ribbon, no "0 of 5 built", no Pause / Stop, nothing stored for a reload, 2.5 minutes later too', () => {
  const end = view(runs['mine/typed-approval-fails|on'], 'end')
  assert.equal(end.narration.phase, 'idle'); assert.equal(end.narration.active, false)
  assert.equal(end.view.ribbon, false); assert.equal(end.view.headline, null); assert.deepEqual(end.view.buttons, [])
  assert.equal(end.snapshotStored, false)
  assert.equal(end.narration.slideCount, 5, 'the outline stays'); assert.equal(end.narration.slidesDone, 0)
  assert.equal(end.deck.activeVersion, runs['mine/typed-approval-fails|off'].checkpoints.at(-1).deck.activeVersion, 'the deck on the canvas is the same')
})
await check('flag ON is flag OFF until the reply: the outline gate and the status on screen read the same (the loader shows "building" while the tools run), and not one extra socket byte or handler call', () => {
  for (const label of ['outline gate', 'status on screen']) assert.deepEqual(view(runs['mine/typed-approval-fails|on'], label), view(runs['mine/typed-approval-fails|off'], label), label)
  assert.equal(view(runs['mine/typed-approval-fails|on'], 'status on screen').narration.phase, 'building')
  assert.deepEqual(view(runs['mine/typed-approval-fails|on'], 'status on screen').view.buttons.map(b => b.text), ['Pause', 'Stop'])
  const off = runs['mine/typed-approval-fails|off'], on = runs['mine/typed-approval-fails|on']
  assert.equal(on.outbound, off.outbound); assert.deepEqual(on.calls, off.calls); assert.deepEqual(on.controlRequests, off.controlRequests)
})
await check('flag ON: a real build after the failure starts as usual (typed build frames), and its clock is the new build\'s, not the stuck one (flag off shows the stale 2:41)', () => {
  const on = view(runs['mine/real-build-after-the-failure|on'], 'end'), off = view(runs['mine/real-build-after-the-failure|off'], 'end')
  for (const end of [on, off]) { assert.equal(end.narration.phase, 'building'); assert.equal(end.narration.buildId, 'bld_46a5295c9574'); assert.deepEqual(end.view.buttons.map(b => b.text), ['Pause', 'Stop']) }
  assert.match(on.view.headline, /0:0\d/); assert.match(off.view.headline, /2:4\d/)
})

console.log('2. a normal build, pause, stop and resume are unchanged')
await check('pause and resume of a real build: flag on equals flag off (checkpoints, socket bytes, handler calls, build-control requests), and both pause and resume reached Director', () => {
  const off = runs['mine/pause-and-resume-a-real-build|off'], on = runs['mine/pause-and-resume-a-real-build|on']
  assert.deepEqual(identity(on), identity(off)); assert.deepEqual(on.checkpoints, off.checkpoints)
  assert.deepEqual(on.controlRequests.map(r => r.action), ['pause', 'resume']); assert.deepEqual(off.controlRequests.map(r => r.action), ['pause', 'resume'])
})
await check('the J7 recording (build, Stop, reload, typed resume; 3 scenarios x Director with and without !490): flag on equals flag off in every checkpoint, socket byte, handler call and build-control request', () => {
  for (const scenario of j7Scenarios) for (const director of ['off', 'on']) {
    const off = runs[`j7/${scenario}/${director}|off`], on = runs[`j7/${scenario}/${director}|on`]
    assert.deepEqual(on.checkpoints, off.checkpoints, `${scenario}/${director}`); assert.equal(on.outbound, off.outbound, `${scenario}/${director}`)
    assert.deepEqual(on.calls, off.calls, `${scenario}/${director}`); assert.deepEqual(on.controlRequests, off.controlRequests, `${scenario}/${director}`)
    assert.ok(off.checkpoints.length > 0, `${scenario}/${director}: the run has checkpoints`)
  }
  assert.equal(j7Scenarios.length * 2, 6)
})

console.log('3. flag off is byte-identical to the base')
const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
await check('the baseline was recorded from these fixtures', () => { assert.equal(baseline.fixture_sha256, sha(JSON.stringify(composed))); assert.equal(baseline.j7_fixture_sha256, sha(JSON.stringify(j7))) })
for (const [key, run] of Object.entries(runs)) {
  if (!key.endsWith('|off')) continue
  await check(`${key}: checkpoints, socket bytes, handler calls and control requests hash as on the base`, () => {
    const want = baseline.runs[key]; assert.ok(want, `no baseline for ${key}`)
    assert.deepEqual(identity(run), want)
  })
}

console.log('4. the reducer and the hook in isolation')
const T = 1_700_000_000_000
const plain = value => JSON.parse(JSON.stringify(value))
const transpile = (text, rel, sandbox) => {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(text, { fileName: rel, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module: mod, exports: mod.exports, ...sandbox })
  return mod.exports
}
const GHOSTS = [0, 1, 2, 3, 4].map(index => ({ index, title: `Slide ${index + 1}`, points: [], slideType: null }))
const STATUS = { type: 'status', status: 'thinking', text: 'Generating presentation content...' }

/** Every reducer expectation, on the reducer's text (the real file or a mutant). Throws on the first one that does not hold. */
function reducerChecks(reducerText) {
  const lib = transpile(reducerText, 'lib/build-narration-heuristics.ts', {})
  const R = lib.narrationReducer, init = lib.initialNarrationState
  const unbacked = () => R(R(R(R(init(), { type: 'strawman', ghosts: GHOSTS, ts: T }), { type: 'awaiting_user', ts: T + 1 }), { ...STATUS, ts: T + 2 }), { type: 'ephemeral', id: 'e1', text: 'Reviewing your topic', ts: T + 2 })
  // an outline that waits for the user, then the status: a "building" no build frame backs
  let s = unbacked()
  assert.equal(s.phase, 'building'); assert.equal(s.active, true); assert.equal(s.source, 'heuristic')
  assert.equal(lib.isUnbackedBuilding(s), true, 'a status-only building is unbacked')
  const ended = R(s, { type: 'status_ended', ts: T + 3 })
  assert.notEqual(ended, s)
  assert.equal(ended.phase, 'idle'); assert.equal(ended.active, false); assert.equal(ended.phaseLabel, ''); assert.equal(ended.startedAt, null); assert.equal(ended.waitingSince, null)
  assert.deepEqual(plain(ended.deckEvents), []); assert.equal(ended.control, 'running')
  assert.equal(ended.ghosts.length, 5, 'the outline stays'); assert.equal(ended.slideCount, 5); assert.equal(ended.slidesDone, 0)
  assert.deepEqual(plain(Object.values(ended.slideStates)), [0, 1, 2, 3, 4].map(() => 'pending'))
  assert.deepEqual(plain(ended.seenEphemeralIds), plain(s.seenEphemeralIds), 'ephemeral lines already seen are not replayed')
  // the typed variant: typed planning / strawman frames first (a build id), then the status opens "building"
  let typed = R(init(), { type: 'typed_phase', payload: { build_id: 'b1', phase: 'strawman', label: 'Outline ready', slide_count: 5 }, ts: T })
  typed = R(R(R(typed, { type: 'strawman', ghosts: GHOSTS, ts: T }), { type: 'awaiting_user', ts: T + 1 }), { ...STATUS, ts: T + 2 })
  assert.equal(typed.phase, 'building'); assert.equal(typed.source, 'typed'); assert.equal(typed.buildId, 'b1')
  const typedEnded = R(typed, { type: 'status_ended', ts: T + 3 })
  assert.equal(typedEnded.phase, 'idle'); assert.equal(typedEnded.active, false); assert.equal(typedEnded.ghosts.length, 5); assert.equal(typedEnded.buildId, 'b1')
  // nothing else is touched: the SAME object comes back (a no-op the host re-renders nothing for)
  const stay = (label, state) => assert.equal(R(state, { type: 'status_ended', ts: T + 9 }), state, label)
  stay('idle', init()); stay('planning', R(init(), { type: 'session_start', ts: T })); stay('strawman', R(init(), { type: 'strawman', ghosts: GHOSTS, ts: T }))
  stay('awaiting_user', R(R(init(), { type: 'strawman', ghosts: GHOSTS, ts: T }), { type: 'awaiting_user', ts: T + 1 }))
  stay('inactive building (receded)', R(unbacked(), { type: 'dismiss' }))
  for (const phase of ['building', 'qa', 'finalizing', 'complete', 'error', 'paused', 'stopped']) {
    stay(`typed ${phase}`, R(R(init(), { type: 'strawman', ghosts: GHOSTS, ts: T }), { type: 'typed_phase', payload: { build_id: 'b1', phase, label: phase, slide_count: 5 }, ts: T + 1 }))
  }
  stay('paused by the user', R(unbacked(), { type: 'control', control: 'paused', ts: T + 3 }))
  stay('stopped by the user', R(unbacked(), { type: 'control', control: 'stopped', ts: T + 3 }))
  stay('a stop is requested', R(unbacked(), { type: 'control', control: 'stop_requested', ts: T + 3 }))
  stay('a pause is requested', R(unbacked(), { type: 'control', control: 'pause_requested', ts: T + 3 }))
  stay('a slide is being built (per-slide text)', R(unbacked(), { type: 'ephemeral', id: 'e2', text: 'Building slide 1/5 — chart', ts: T + 3 }))
  stay('a slide is built', R(unbacked(), { type: 'typed_slide_built', payload: { build_id: 'b2', slide_index: 0, slide_count: 5, presentation_id: 'deck' }, ts: T + 3 }))
  stay('a slide failed', R(R(unbacked(), { type: 'typed_phase', payload: { build_id: 'b2', phase: 'building', label: 'Building', slide_count: 5 }, ts: T + 3 }), { type: 'typed_event', payload: { build_id: 'b2', seq: 0, scope: 'slide', stage: 'render', status: 'error', text: 'x', slide_index: 1 }, ts: T + 4 }))
  assert.equal(lib.isUnbackedBuilding(R(unbacked(), { type: 'control', control: 'paused', ts: T + 3 })), false)
  // after the end the build can start again, from the same outline
  const again = (label, action, phase) => { const next = R(ended, action); assert.equal(next.phase, phase, label); assert.equal(next.active, true, label); assert.equal(next.ghosts.length, 5, label); return next }
  again('a new status', { ...STATUS, ts: T + 5 }, 'building')
  again('the Accept button', { type: 'accepted', ts: T + 5 }, 'building')
  const retry = again('a typed build', { type: 'typed_phase', payload: { build_id: 'b3', phase: 'building', label: 'Building your slides…', slide_count: 5 }, ts: T + 5 }, 'building')
  assert.equal(retry.buildId, 'b3'); assert.equal(retry.source, 'typed')
  // only the new action differs from the base reducer: every other action gives the same result with or without the lines
  const baseLib = transpile(stripBuildFailureEnd('lib/build-narration-heuristics.ts', reducerText), 'lib/build-narration-heuristics.ts', {})
  const actions = [{ type: 'session_start', ts: T }, { ...STATUS, ts: T + 1 }, { type: 'status', status: 'idle', text: '', ts: T + 2 }, { type: 'strawman', ghosts: GHOSTS, ts: T + 3 }, { type: 'awaiting_user', ts: T + 4 }, { type: 'accepted', ts: T + 5 },
    { type: 'ephemeral', id: 'e9', text: 'Building slide 2/5 — chart', ts: T + 6 }, { type: 'control', control: 'stop_requested', ts: T + 7 }, { type: 'final_url', ts: T + 8 }]
  let a = init(), b = baseLib.initialNarrationState()
  for (const action of actions) { a = R(a, action); b = baseLib.narrationReducer(b, action); assert.deepEqual(plain(a), plain(b), action.type) }
}

const HOOK = 'hooks/use-build-narration.ts'
const REDUCER = 'lib/build-narration-heuristics.ts'
/** A fake React host for the narration hook: refs persist across renders, effects run on every render (the hook's own guards decide), dispatch is recorded. */
function hookHost(hookText, reducerText) {
  const lib = transpile(reducerText, REDUCER, {})
  const dispatched = [], slots = []
  let index = 0, phase = 'awaiting_user'
  const react = {
    useRef: value => (slots[index++] ||= { current: value }), useMemo: fn => fn(), useCallback: fn => fn,
    useReducer: () => [{ ...lib.initialNarrationState(), phase, active: phase !== 'idle' }, action => dispatched.push(action)],
    useEffect: setup => { index++; setup() },
  }
  const hook = transpile(hookText, HOOK, {
    require: name => {
      if (name === 'react') return react
      if (name === '@/lib/build-narration-heuristics') return lib
      if (name === '@/lib/build-control-helpers') return { isBuildControlRequestPending: () => false, isMatchingBuildControlBuild: () => false, isMatchingBuildControlAck: () => false,
        retireBuildControlRequestId: list => list, shouldIgnoreBuildControlPhaseCorrelation: () => false, shouldRetirePendingControl: () => false }
      if (name === '@/hooks/use-toast') return { toast() {} }
      throw new Error(`unexpected import ${name}`)
    },
    window: { sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } }, Date: { now: () => T }, setTimeout: () => 0, clearTimeout() {},
  })
  const base = { enabled: true, sessionId: 's1', messages: [], currentStatus: null, slideStructure: null, isGeneratingFinal: false, isGeneratingStrawman: false, finalPresentationUrl: null }
  let latest = null
  return {
    dispatched, handlers: () => latest,
    render(inputs = {}, atPhase = 'awaiting_user') { index = 0; phase = atPhase; latest = hook.useBuildNarration({ ...base, ...inputs }); return latest },
    ended: () => plain(dispatched.filter(action => action.type === 'status_ended')),
  }
}
const LIVE = { status: 'thinking', text: 'Generating presentation content...' }
const OTHER = { status: 'thinking', text: 'Syncing with preview changes...' }
const TYPED_FRAMES = {
  onBuildPhase: { build_id: 'b1', phase: 'building', label: 'Building your slides…', slide_count: 5, slides_done: 0, auto_proceed: null, presentation_id: null, control_request_id: null },
  onBuildEvent: { build_id: 'b1', seq: 0, scope: 'deck', stage: 'content', status: 'progress', text: 'x', detail: null, slide_index: null },
  onSlideBuilt: { build_id: 'b1', presentation_id: 'deck', slide_index: 0, slide_count: 5, thumbnail_url: null, qa_verdict: null, qa_skipped_reason: null },
  syncBuildState: { build_id: 'b1', phase: 'building', slide_count: 5, slides: {} },
}

/** Every hook expectation, on the hook's text (the real file or a mutant), flag on and off. */
function hookChecks(hookText, reducerText) {
  const on = { endUnbackedBuild: true }
  { // the failure turn: the status is on screen, then it goes away (the socket hook cleared it on the chat_message)
    const h = hookHost(hookText, reducerText)
    h.render({ ...on, currentStatus: null }); assert.deepEqual(h.ended(), [], 'a mount with no status ends nothing')
    h.render({ ...on, currentStatus: LIVE }); assert.deepEqual(h.ended(), [], 'a status on screen ends nothing')
    h.render({ ...on, currentStatus: null }); assert.deepEqual(h.ended(), [{ type: 'status_ended', ts: T }], 'the status going away ends the unbacked building')
    h.render({ ...on, currentStatus: null }); assert.equal(h.ended().length, 1, 'only once')
  }
  { const h = hookHost(hookText, reducerText); h.render({ ...on, currentStatus: LIVE }); h.render({ ...on, currentStatus: OTHER }); h.render({ ...on, currentStatus: OTHER }); assert.deepEqual(h.ended(), [], 'a status replaced by another is still on screen'); h.render({ ...on, currentStatus: null }); assert.equal(h.ended().length, 1) }
  for (const [name, payload] of Object.entries(TYPED_FRAMES)) { // a typed build frame while the status was on screen: a real build, never ended
    const h = hookHost(hookText, reducerText); h.render({ ...on, currentStatus: LIVE }); h.handlers()[name](payload); h.render({ ...on, currentStatus: null }); assert.deepEqual(h.ended(), [], `${name} while the status is on screen`)
  }
  { const h = hookHost(hookText, reducerText); h.render({ ...on }); h.handlers().onBuildPhase(TYPED_FRAMES.onBuildPhase); h.render({ ...on, currentStatus: LIVE }); h.render({ ...on, currentStatus: null }); assert.equal(h.ended().length, 1, 'a typed frame from BEFORE the status does not protect it') }
  { const h = hookHost(hookText, reducerText); h.render({ ...on, currentStatus: LIVE, isGeneratingFinal: true }); h.render({ ...on, currentStatus: null, isGeneratingFinal: true }); assert.deepEqual(h.ended(), [], 'a build accepted with the button (isGeneratingFinal)') }
  { const h = hookHost(hookText, reducerText); h.render({ ...on, currentStatus: LIVE }, 'building'); h.render({ ...on, currentStatus: null }, 'building'); assert.deepEqual(h.ended(), [], 'the status did not open this "building": it was already building') }
  { const h = hookHost(hookText, reducerText); h.render({ ...on, currentStatus: LIVE }, 'idle'); h.render({ ...on, currentStatus: null }, 'idle'); assert.equal(h.ended().length, 1, 'any other phase at the start is the status\'s own (the reducer decides)') }
  { const h = hookHost(hookText, reducerText); h.render({ ...on, currentStatus: LIVE }); h.render({ ...on, sessionId: 's2', currentStatus: null }); assert.deepEqual(h.ended(), [], 'a session switch is not the status going away') }
  { const h = hookHost(hookText, reducerText); h.render({ ...on, enabled: false, currentStatus: LIVE }); h.render({ ...on, enabled: false, currentStatus: null }); assert.deepEqual(h.ended(), [], 'narration off') }
  for (const off of [{}, { endUnbackedBuild: false }]) { const h = hookHost(hookText, reducerText); h.render({ ...off, currentStatus: LIVE }); h.render({ ...off, currentStatus: null }); assert.deepEqual(h.ended(), [], `flag off ${JSON.stringify(off)}`) }
  // flag off, and flag on for everything but the one action: the hook dispatches exactly what the base hook dispatches, render for render
  const script = [{ currentStatus: null }, { currentStatus: LIVE }, { currentStatus: OTHER }, { currentStatus: null }, { currentStatus: LIVE, isGeneratingFinal: true }, { currentStatus: null, isGeneratingFinal: true },
    { messages: [{ message_id: 'm1', type: 'chat_message', payload: { text: 'x', ephemeral: true } }, { message_id: 'm2', type: 'action_request', payload: { actions: [{ value: 'accept_strawman' }] } }] },
    { slideStructure: [{ title: 'A' }, { title: 'B' }] }, { isGeneratingFinal: true }, { finalPresentationUrl: 'https://layout.synthetic.invalid/p/deck' }]
  const baseText = stripBuildFailureEnd(HOOK, hookText)
  const play = (text, flagInputs) => { const h = hookHost(text, reducerText); for (const step of script) h.render({ ...flagInputs, ...step }); h.handlers().onBuildPhase(TYPED_FRAMES.onBuildPhase); h.handlers().onBuildEvent(TYPED_FRAMES.onBuildEvent); h.handlers().onSlideBuilt(TYPED_FRAMES.onSlideBuilt); h.handlers().syncBuildState(TYPED_FRAMES.syncBuildState); return plain(h.dispatched) }
  const baseline = play(baseText, {})
  assert.deepEqual(play(hookText, {}), baseline, 'flag unset: the same actions as the base hook')
  assert.deepEqual(play(hookText, { endUnbackedBuild: false }), baseline, 'flag false: the same actions as the base hook')
  assert.deepEqual(play(hookText, on).filter(action => action.type !== 'status_ended'), baseline, 'flag on: the base hook\'s actions, plus status_ended only')
  assert.equal(play(hookText, on).filter(action => action.type === 'status_ended').length, 1, 'flag on, the script above: exactly one status_ended (the guarded ones add none)')
}

const reducerText = read(REDUCER), hookText = read(HOOK), pageText = read('app/builder/page.tsx')
await check('reducer: status_ended leaves an unbacked "building" and keeps the outline; paused, stopped, built, per-slide and every other phase are untouched (same object); a retry starts from the outline', () => reducerChecks(reducerText))
await check('hook: the status going away ends the unbacked building only when no typed build frame came, the build was not accepted with the button, this status opened it, in the same session; flag off dispatches the base hook\'s actions', () => hookChecks(hookText, reducerText))
await check('plumbing: the page reads the literal env name, exact "true", into the narration hook only; the hooks stay free of process.env; .env.example documents "false"', () => {
  assert.equal((pageText.match(/NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END/g) || []).length, 1)
  assert.match(pageText, /^    endUnbackedBuild: process\.env\.NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END === 'true', \/\/ BUILD-FAILURE-END/m)
  assert.doesNotMatch(hookText, /process\.env/, 'the narration hook takes the flag as an input (it is unit-tested in a bare vm)')
  assert.doesNotMatch(reducerText, /process\.env/)
  assert.doesNotMatch(read('hooks/use-deckster-websocket-v2.ts'), /BUILD_FAILURE_END|BUILD-FAILURE-END/, 'the socket hook is untouched')
  assert.match(read('.env.example'), new RegExp(`^${FLAG}="false"$`, 'm'))
  assert.equal((read('.env.example').match(new RegExp(FLAG, 'g')) || []).length, 1)
})
await check('the socket hook still clears currentStatus on a non-ephemeral chat_message and on an action card, and keeps it on an ephemeral one (what this change reads, unchanged)', () => {
  const socket = read('hooks/use-deckster-websocket-v2.ts')
  assert.match(socket, /case 'chat_message':[\s\S]{0,420}if \(\(message\.payload as any\)\.ephemeral !== true\) \{\s*newState\.currentStatus = null;/)
  assert.match(socket, /case 'action_request':[\s\S]{0,360}newState\.currentStatus = null;/)
  assert.match(socket, /case 'status_update':[\s\S]{0,200}newState\.currentStatus = message\.payload;/)
})
await check('the narration reducer still reads the status text as "building" (the premise: a status alone opens it) and has no way out without a build frame or a final URL (the defect)', () => {
  const base = transpile(stripBuildFailureEnd(REDUCER, reducerText), REDUCER, {})
  let s = base.narrationReducer(base.narrationReducer(base.initialNarrationState(), { type: 'strawman', ghosts: GHOSTS, ts: T }), { type: 'awaiting_user', ts: T + 1 })
  s = base.narrationReducer(s, { ...STATUS, ts: T + 2 })
  assert.equal(s.phase, 'building')
  for (const status of ['complete', 'idle', 'error']) assert.equal(base.narrationReducer(s, { type: 'status', status, text: 'done', ts: T + 3 }).phase, 'building', status)
})

console.log('5. mutants')
const mutate = (text, from, to, label) => { const at = text.indexOf(from); if (at === -1 || text.indexOf(from, at + 1) !== -1) throw new Error(`mutant "${label}": target ${JSON.stringify(from.slice(0, 60))} not found exactly once`); return text.replace(from, () => to) }
const reducerMutants = [
  ['reducer: a paused or stopped build can be ended (control guard dropped)', "state.phase === 'building' && state.control === 'running' && ", "state.phase === 'building' && "],
  ['reducer: a build with slides built can be ended (slidesDone guard dropped)', ' && state.slidesDone === 0 && Object.keys', ' && Object.keys'],
  ['reducer: a build with per-slide events can be ended', ' && Object.keys(state.slideEvents).length === 0', ''],
  ['reducer: a build with a slide started or failed can be ended', ' && !Object.values(state.slideStates).some((s) => s !== \'pending\')', ''],
  ['reducer: any phase can be ended (building guard dropped)', "state.active && state.phase === 'building' && ", 'state.active && '],
  ['reducer: the outline is lost (ghosts reset on the end)', "return { ...state, active: false, phase: 'idle', phaseLabel: ''", "return { ...state, ghosts: [], slideCount: 0, active: false, phase: 'idle', phaseLabel: ''"],
  ['reducer: the end leaves the building label (phase not reset)', "active: false, phase: 'idle', phaseLabel: ''", "active: false, phase: 'building', phaseLabel: ''"],
  ['reducer: the end leaves the ribbon on (active kept)', "return { ...state, active: false, phase: 'idle'", "return { ...state, phase: 'idle'"],
  ['reducer: the end is a no-op (status_ended ignored)', "if (!isUnbackedBuilding(state)) return state // BUILD-FAILURE-END", "return state // BUILD-FAILURE-END"],
  ['reducer: the end is not guarded (isUnbackedBuilding ignored)', "if (!isUnbackedBuilding(state)) return state // BUILD-FAILURE-END", "if (false) return state // BUILD-FAILURE-END"],
]
const hookMutants = [
  ['hook: a build accepted with the button can be ended (isGeneratingFinal guard dropped)', ' || isGeneratingFinal) return // BUILD-FAILURE-END', ') return // BUILD-FAILURE-END'],
  ['hook: a typed build frame does not protect the build (frame compare dropped)', " || episode.frames !== buildFramesRef.current", ''],
  ['hook: a status that did not open the building can end it (phase-at-start guard dropped)', " || episode.phase === 'building'", ''],
  ['hook: ends on any status going away in any session (session guard dropped)', "!episode || episode.sessionId !== sessionId || ", '!episode || '],
  ['hook: ends with no status ever on screen (episode guard dropped)', "!enabled || !endUnbackedBuild || !episode || ", '!enabled || !endUnbackedBuild || '],
  ['hook: the flag is ignored (always on)', "!enabled || !endUnbackedBuild || !episode", "!enabled || !episode"],
  ['hook: narration off still ends (enabled guard dropped)', "if (!enabled || !endUnbackedBuild || !episode", "if (!endUnbackedBuild || !episode"],
  ['hook: onBuildPhase does not count (counter missing)', "  const onBuildPhase = useCallback((payload: BuildPhasePayload) => {\n    buildFramesRef.current += 1 // BUILD-FAILURE-END\n", "  const onBuildPhase = useCallback((payload: BuildPhasePayload) => {\n"],
  ['hook: onBuildEvent does not count (counter missing)', "  const onBuildEvent = useCallback((payload: BuildEventPayload) => {\n    buildFramesRef.current += 1 // BUILD-FAILURE-END\n", "  const onBuildEvent = useCallback((payload: BuildEventPayload) => {\n"],
  ['hook: onSlideBuilt does not count (counter missing)', "  const onSlideBuilt = useCallback((payload: SlideBuiltPayload) => {\n    buildFramesRef.current += 1 // BUILD-FAILURE-END\n", "  const onSlideBuilt = useCallback((payload: SlideBuiltPayload) => {\n"],
  ['hook: syncBuildState does not count (counter missing)', "  const syncBuildState = useCallback((buildState: unknown) => {\n    buildFramesRef.current += 1 // BUILD-FAILURE-END\n", "  const syncBuildState = useCallback((buildState: unknown) => {\n"],
  ['hook: the end action has another name', "dispatch({ type: 'status_ended', ts: Date.now() })", "dispatch({ type: 'status_over', ts: Date.now() })"],
]
for (const [label, from, to] of reducerMutants) await check(`mutant caught: ${label}`, () => { const mutant = mutate(reducerText, from, to, label); assert.throws(() => { reducerChecks(mutant); hookChecks(hookText, mutant) }, undefined, 'the checks must fail on this mutant') })
for (const [label, from, to] of hookMutants) await check(`mutant caught: ${label}`, () => { const mutant = mutate(hookText, from, to, label); assert.throws(() => hookChecks(mutant, reducerText), undefined, 'the checks must fail on this mutant') })
await check('mutant caught: the page reads the flag loosely (!== "false")', () => {
  const mutant = mutate(pageText, "process.env.NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END === 'true'", "process.env.NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END !== 'false'", 'page')
  assert.throws(() => assert.match(mutant, /^    endUnbackedBuild: process\.env\.NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END === 'true', \/\/ BUILD-FAILURE-END/m))
})
await check('mutant caught: an unmarked line added to an existing file is not stripped (the strip gives the base back only for marked lines)', () => {
  const mutant = mutate(hookText, "    endUnbackedBuild = false, // BUILD-FAILURE-END\n", "    endUnbackedBuild = false, // BUILD-FAILURE-END\n    extra = false,\n", 'unmarked')
  assert.notEqual(stripBuildFailureEnd(HOOK, mutant), stripBuildFailureEnd(HOOK, hookText))
})

console.log('6. scope over the committed diff (BASE..HEAD)')
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 })
const own = git('log', '--format=%H', '--no-merges', '-E', `--grep=^${BUILD_FAILURE_END_SUBJECT}`, `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)
const HEAD = own[0] || git('rev-parse', 'HEAD').trim()
await check(`this change's own commits (subject starts "${BUILD_FAILURE_END_SUBJECT}") exist, and every non-merge commit between the base and the newest of them is one`, () => {
  assert.ok(own.length >= 1, 'no own commit yet')
  const all = git('log', '--format=%H', '--no-merges', `${BASE_COMMIT}..${HEAD}`).split('\n').filter(Boolean)
  assert.deepEqual([...all].sort(), [...own].sort(), 'a commit between the base and HEAD is not this change\'s')
  for (const sha1 of own) assert.match(git('log', '-1', '--format=%B', sha1), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, sha1.slice(0, 8))
})
await check('the committed files are exactly this change\'s (the older scope checks skip them once the registry names them); every line added to an existing file is a pure insertion that carries the marker', () => {
  const changed = git('diff', '--name-only', `${BASE_COMMIT}..${HEAD}`).split('\n').filter(Boolean).filter(rel => BUILD_FAILURE_END_SCOPE_FILES.has(rel) || !registry.LATER_CHANGE_FILES.has(rel)).sort()
  assert.deepEqual(changed, [...BUILD_FAILURE_END_SCOPE_FILES].sort())
  for (const rel of BUILD_FAILURE_END_FILES) {
    const diff = git('diff', '-U0', `${BASE_COMMIT}..${HEAD}`, '--', rel).split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
    assert.ok(diff.length > 0, rel)
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, BUILD_FAILURE_END_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.equal(stripBuildFailureEnd(rel, git('show', `${HEAD}:${rel}`)), git('show', `${BASE_COMMIT}:${rel}`), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of Object.keys(BUILD_FAILURE_END_PIN_EDITS)) assert.equal(stripBuildFailureEnd(rel, git('show', `${HEAD}:${rel}`)), git('show', `${BASE_COMMIT}:${rel}`), `${rel}: the taught proof is its base's text without this change's edits`)
  for (const rel of stripModule.BUILD_FAILURE_END_NEW_FILES) assert.ok(git('cat-file', '-t', `${HEAD}:${rel}`).trim() === 'blob', rel)
})
await check('.env.example is the base plus the block; the registry gains exactly its three marked lines and loses none', () => {
  assert.equal(registry.stripLaterEnvBlocks('.env.example', git('show', `${HEAD}:.env.example`)), registry.stripLaterEnvBlocks('.env.example', `${git('show', `${BASE_COMMIT}:.env.example`)}\n${BUILD_FAILURE_END_ENV_BLOCK}`))
  const diff = git('diff', '-U0', `${BASE_COMMIT}..${HEAD}`, '--', 'scripts/studio-later-changes.mjs').split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
  assert.equal(diff.length, 3); for (const line of diff) { assert.ok(line.startsWith('+') && line.includes('LATER-CHANGE') && line.includes('studio-build-failure-end-strip.mjs'), line.slice(0, 140)) }
})
await check('no secret-shaped literal is in the new files', () => {
  for (const rel of ['scripts/test-studio-build-failure-end.mjs', 'scripts/studio-build-failure-end-strip.mjs', 'scripts/fixtures/build-failure-end/outline-gate-typed-approval-failure.json']) {
    const text = fs.readFileSync(path.join(repo, rel), 'utf8')
    assert.doesNotMatch(text, /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/, rel)
  }
})

console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
