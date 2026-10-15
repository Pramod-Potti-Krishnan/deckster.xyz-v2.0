// J7-RESUME-LOOP-P1, Studio half: NEXT_PUBLIC_STUDIO_BUILD_RESUME_FIX (exact "true"; default off).
//
// After Stop, Director publishes the partial deck's presentation_url. Off, hooks/use-build-narration.ts turns it into the reducer's
// final_url, which completes the stopped build (unbuilt slides counted as built) and the stopped ribbon with Resume closes 1.6 s later;
// a typed resume then sends build_phase "building" for the SAME build id, which a completed build ignores, so the ribbon never reopens.
// On, a final URL that arrives while the build is stopped updates the deck only (lib/build-narration-heuristics.ts final_url).
//
//  1. Recorded Director frames (scripts/fixtures/build-resume/j7-stop-resume.json: Director's real code on the J7 session's shapes,
//     reproducing THEME-2's recorded flag-off frames) replayed through the REAL socket hook, narration hook, reducer, the page's own
//     wiring and the REAL StageRibbon (scripts/studio-chat-harness/build-resume-transcript.mjs): Stop, the URL, a same-tab and a
//     fresh-tab reload, a typed resume answered by Director with and without !490. Every expectation (flag off = today, flag on) is in
//     the fixture. The "Earlier step" lock on approval cards must read the same with the flag off and on at every checkpoint.
//  2. Flag off is byte-identical to the base: every replay's checkpoints, socket bytes and handler calls hash to the baseline recorded
//     from origin/studio-v4-dev-preparation-code @ 282efbd (scripts/fixtures/build-resume/baselines/flag-off.json).
//  3. The reducer and hook in isolation, and the flag plumbing (page reads the literal env name; .env.example documents "false").
//
//   node scripts/test-studio-build-resume.mjs
//   node scripts/test-studio-build-resume.mjs --record-baseline --root <base checkout>   (re-record the flag-off baseline from a base tree)
process.env.NODE_ENV = 'production' // before React loads, as the #371 harness does
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..')
const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const recordBaseline = args.includes('--record-baseline')
const root = path.resolve(option('--root') || repo)
const FLAG = 'NEXT_PUBLIC_STUDIO_BUILD_RESUME_FIX'
const fixture = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/fixtures/build-resume/j7-stop-resume.json'), 'utf8'))
const baselineFile = path.join(repo, 'scripts/fixtures/build-resume/baselines/flag-off.json')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}

const release = installHostNetworkGuard(net, dns)
const { runBuildResumeTranscript, buildResumeRegions } = await import('./studio-chat-harness/build-resume-transcript.mjs')
const scenarios = Object.keys(fixture.scenarios)
const runs = {}
for (const scenario of scenarios) for (const flag of recordBaseline ? ['off'] : ['off', 'on']) for (const director of ['off', 'on']) {
  runs[`${scenario}|${flag}|${director}`] = await runBuildResumeTranscript({ root, fixture, scenario, flag, director })
}
release()
// What a flag-off run is compared on: what the page showed and did. Region anchors (page source hashes) are not part of it.
const identity = run => ({ checkpoints: sha(JSON.stringify(run.checkpoints)), outbound: sha(run.outbound), calls: sha(JSON.stringify(run.calls)) })

if (recordBaseline) {
  const baseline = {
    recorded_from: option('--from-label') || path.basename(root),
    note: 'Flag-off replay of scripts/fixtures/build-resume/j7-stop-resume.json on the base tree (run with --record-baseline --root <base>).',
    fixture_sha256: sha(JSON.stringify(fixture)),
    runs: Object.fromEntries(Object.entries(runs).map(([key, run]) => [key, { ...identity(run), checkpoints_view: run.checkpoints.map(c => ({ label: c.label,
      phase: c.narration.phase, active: c.narration.active, ribbon: c.view.ribbon, buttons: c.view.buttons.map(b => b.text), locked: c.approvalGatesLocked })) }])),
  }
  fs.mkdirSync(path.dirname(baselineFile), { recursive: true })
  fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 1) + '\n')
  console.log(`recorded ${Object.keys(runs).length} flag-off runs from ${root} into ${path.relative(repo, baselineFile)}`)
  process.exit(0)
}

console.log('1. recorded J7 frames through the real hooks, page wiring and ribbon')
for (const [key, run] of Object.entries(runs)) {
  await check(`${key}: every fixture expectation holds, offline, with no console error`, () => {
    assert.deepEqual(run.failures, [])
    assert.deepEqual(run.diagnostics.blockedNetwork, [])
    assert.deepEqual(run.diagnostics.uncaught, [])
    assert.deepEqual(run.diagnostics.console, [])
  })
}
await check('flag on: Stop -> URL -> 2 s keeps "Stopped — your progress is saved" with Resume, 1 of 3 built (flag off: closed, 3 of 3 "built")', () => {
  const on = runs['resume-without-reload|on|on'].checkpoints[0], off = runs['resume-without-reload|off|on'].checkpoints[0]
  assert.equal(on.narration.phase, 'stopped'); assert.equal(on.narration.slidesDone, 1)
  assert.ok(on.view.headline.startsWith('Stopped — your progress is saved'), on.view.headline)
  assert.deepEqual(on.view.buttons, [{ text: 'Resume', disabled: false }])
  assert.equal(off.narration.phase, 'complete'); assert.equal(off.narration.slidesDone, 3); assert.equal(off.view.ribbon, false)
  // The deck itself is updated either way: the URL is the partial deck, as Director sent it.
  assert.equal(on.deck.finalUrl, off.deck.finalUrl); assert.equal(on.deck.slideCount, 1)
})
await check('flag on: reload (same tab and fresh tab) shows Resume for the same build', () => {
  for (const scenario of ['same-tab-reload', 'fresh-tab-reload']) {
    const c = runs[`${scenario}|on|on`].checkpoints.find(item => item.label === 'after reload + 2 s')
    assert.equal(c.narration.phase, 'stopped'); assert.equal(c.narration.buildId, 'bld_46a5295c9574')
    assert.ok(c.view.buttons.some(b => b.text === 'Resume' && !b.disabled), scenario)
  }
})
await check('flag on: a typed resume answered by Director !490 reopens the ribbon ("Resuming your build…", Pause/Stop) for the same build id', () => {
  for (const scenario of scenarios) {
    const c = runs[`${scenario}|on|on`].checkpoints.at(-1)
    assert.equal(c.narration.phase, 'building', scenario); assert.equal(c.narration.active, true, scenario)
    assert.equal(c.narration.buildId, 'bld_46a5295c9574', scenario)
    assert.ok(c.view.headline.startsWith('Resuming your build…'), c.view.headline)
    assert.deepEqual(c.view.buttons.map(b => b.text), ['Pause', 'Stop'], scenario)
  }
})
await check('flag on, Director without !490: the stopped ribbon keeps Resume after the typed turn', () => {
  for (const scenario of scenarios) assert.ok(runs[`${scenario}|on|off`].checkpoints.at(-1).view.buttons.some(b => b.text === 'Resume'), scenario)
})
await check('"Earlier step" lock on approval cards reads the same with the flag off and on at every checkpoint', () => {
  for (const scenario of scenarios) for (const director of ['off', 'on']) {
    const off = runs[`${scenario}|off|${director}`].checkpoints.map(c => [c.label, c.approvalGatesLocked])
    const on = runs[`${scenario}|on|${director}`].checkpoints.map(c => [c.label, c.approvalGatesLocked])
    assert.deepEqual(on, off, `${scenario}/${director}`)
    assert.ok(off.every(([, locked]) => locked === true), `${scenario}/${director}: the approval cards are locked after a Stop`)
  }
})
await check('flag on: no extra frame, request or socket byte: build-control requests and outbound bytes equal flag off', () => {
  for (const scenario of scenarios) for (const director of ['off', 'on']) {
    const off = runs[`${scenario}|off|${director}`], on = runs[`${scenario}|on|${director}`]
    assert.equal(on.outbound, off.outbound, `${scenario}/${director}`)
    assert.deepEqual(on.controlRequests, off.controlRequests, `${scenario}/${director}`)
  }
})

console.log('2. flag off is byte-identical to the base')
const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
await check('the baseline was recorded from this fixture', () => assert.equal(baseline.fixture_sha256, sha(JSON.stringify(fixture))))
for (const [key, run] of Object.entries(runs)) {
  if (!key.includes('|off|')) continue
  await check(`${key}: checkpoints, socket bytes and handler calls hash as on the base`, () => {
    const want = baseline.runs[key]
    assert.ok(want, `no baseline for ${key}`)
    assert.deepEqual(identity(run), { checkpoints: want.checkpoints, outbound: want.outbound, calls: want.calls })
  })
}

console.log('3. reducer, hook and flag plumbing')
const transpile = (rel, sandbox) => {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { module: mod, exports: mod.exports, ...sandbox })
  return mod.exports
}
const reducerLib = transpile('lib/build-narration-heuristics.ts', {})
const { narrationReducer, initialNarrationState } = reducerLib
const T = 1_700_000_000_000
// Objects made inside the vm sandbox have that realm's prototypes: compare them as plain JSON.
const plain = value => JSON.parse(JSON.stringify(value))
const GHOSTS = [0, 1, 2].map(index => ({ index, title: `Slide ${index + 1}`, points: [], slideType: null }))
const stopped = () => {
  let s = narrationReducer(initialNarrationState(), { type: 'strawman', ghosts: GHOSTS, ts: T - 1 })
  s = narrationReducer(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', label: 'Building', slide_count: 3 }, ts: T })
  s = narrationReducer(s, { type: 'typed_slide_built', payload: { build_id: 'b1', slide_index: 0, slide_count: 3, presentation_id: 'deck' }, ts: T + 1 })
  return narrationReducer(s, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'stopped', label: 'Stopped', presentation_id: 'deck' }, ts: T + 2 })
}
await check('reducer: keepStopped leaves a stopped build exactly as it was (same object)', () => {
  const s = stopped()
  assert.equal(narrationReducer(s, { type: 'final_url', presentationId: 'deck', ts: T + 3, keepStopped: true }), s)
})
await check('reducer: without keepStopped the URL completes the stopped build (today)', () => {
  const next = narrationReducer(stopped(), { type: 'final_url', presentationId: 'deck', ts: T + 3 })
  assert.equal(next.phase, 'complete'); assert.equal(next.slidesDone, 1 + 2)
})
await check('reducer: keepStopped changes nothing outside the stopped phase (a finishing build still completes)', () => {
  for (const phase of ['building', 'finalizing', 'paused', 'error']) {
    let s = narrationReducer(initialNarrationState(), { type: 'typed_phase', payload: { build_id: 'b1', phase, label: phase, slide_count: 2 }, ts: T })
    const a = narrationReducer(s, { type: 'final_url', presentationId: null, ts: T + 1, keepStopped: true })
    const b = narrationReducer(s, { type: 'final_url', presentationId: null, ts: T + 1 })
    assert.deepEqual(plain(a), plain(b), phase)
  }
  const cold = narrationReducer(initialNarrationState(), { type: 'final_url', presentationId: 'deck', ts: T, keepStopped: true })
  assert.deepEqual(plain(cold), plain(narrationReducer(initialNarrationState(), { type: 'final_url', presentationId: 'deck', ts: T })))
})
await check('reducer: the stopped build then reopens on its own build_phase, and a new build id starts fresh', () => {
  const kept = narrationReducer(stopped(), { type: 'final_url', presentationId: 'deck', ts: T + 3, keepStopped: true })
  const resumed = narrationReducer(kept, { type: 'typed_phase', payload: { build_id: 'b1', phase: 'building', label: 'Resuming your build…' }, ts: T + 4 })
  assert.equal(resumed.phase, 'building'); assert.equal(resumed.active, true); assert.equal(resumed.control, 'running'); assert.equal(resumed.slidesDone, 1)
  const fresh = narrationReducer(kept, { type: 'typed_phase', payload: { build_id: 'b2', phase: 'planning', label: 'Planning' }, ts: T + 5 })
  assert.equal(fresh.buildId, 'b2'); assert.deepEqual(plain(fresh.retiredBuildIds), ['b1'])
})
await check('reducer: the order a reload can take does not matter with keepStopped (sync then URL, URL then sync)', () => {
  const sync = { type: 'typed_sync', buildState: { build_id: 'b1', phase: 'stopped', slide_count: 3, slides: { 0: 'built', 1: 'skipped', 2: 'skipped' } }, ts: T }
  const url = keep => ({ type: 'final_url', presentationId: 'deck', ts: T + 1, ...(keep ? { keepStopped: true } : {}) })
  const syncThenUrl = narrationReducer(narrationReducer(initialNarrationState(), sync), url(true))
  const urlThenSync = narrationReducer(narrationReducer(initialNarrationState(), url(true)), sync)
  assert.equal(syncThenUrl.phase, 'stopped'); assert.equal(urlThenSync.phase, 'stopped')
  // Off, the sync-then-URL order completes the stopped build (the same false "complete" as after a live Stop).
  assert.equal(narrationReducer(narrationReducer(initialNarrationState(), sync), url(false)).phase, 'complete')
})

const hookSource = read('hooks/use-build-narration.ts')
const runHook = inputs => {
  const dispatched = []
  const slots = []
  let index = 0
  const react = {
    useRef: value => (slots[index++] ||= { current: value }),
    useMemo: fn => fn(), useCallback: fn => fn,
    useReducer: (reducer, value, init) => [init ? init(value) : value, action => dispatched.push(action)],
    useEffect: setup => { index++; setup() },
  }
  const hook = transpile('hooks/use-build-narration.ts', {
    require: name => {
      if (name === 'react') return react
      if (name === '@/lib/build-narration-heuristics') return reducerLib
      if (name === '@/lib/build-control-helpers') return { isBuildControlRequestPending: () => false, isMatchingBuildControlBuild: () => false, isMatchingBuildControlAck: () => false,
        retireBuildControlRequestId: list => list, shouldIgnoreBuildControlPhaseCorrelation: () => false, shouldRetirePendingControl: () => false }
      if (name === '@/hooks/use-toast') return { toast() {} }
      throw new Error(`unexpected import ${name}`)
    },
    window: { sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } },
    Date: { now: () => T }, setTimeout: () => 0, clearTimeout() {},
  })
  hook.useBuildNarration({ enabled: true, sessionId: 's1', messages: [], currentStatus: null, slideStructure: null, isGeneratingFinal: false,
    isGeneratingStrawman: false, finalPresentationUrl: 'https://layout.synthetic.invalid/p/deck', finalPresentationId: 'deck', ...inputs })
  return plain(dispatched.filter(action => action.type === 'final_url'))
}
await check('hook: keepStoppedOnFinalUrl adds keepStopped to final_url; unset or false dispatches exactly today\'s action', () => {
  assert.deepEqual(runHook({ keepStoppedOnFinalUrl: true }), [{ type: 'final_url', presentationId: 'deck', ts: T, keepStopped: true }])
  assert.deepEqual(runHook({}), [{ type: 'final_url', presentationId: 'deck', ts: T }])
  assert.deepEqual(runHook({ keepStoppedOnFinalUrl: false }), [{ type: 'final_url', presentationId: 'deck', ts: T }])
  assert.equal(Object.keys(runHook({})[0]).join(','), 'type,presentationId,ts')
})
await check('page: the flag is read as the literal env name (inlined by the build), exact "true", into the narration hook only', () => {
  const page = read('app/builder/page.tsx')
  assert.equal((page.match(/NEXT_PUBLIC_STUDIO_BUILD_RESUME_FIX/g) || []).length, 2) // the comment and the read
  assert.match(page, /keepStoppedOnFinalUrl: process\.env\.NEXT_PUBLIC_STUDIO_BUILD_RESUME_FIX === 'true',/)
  assert.ok(buildResumeRegions(root).anchors.some(a => a.label === 'page.useBuildNarration(args)'))
  assert.doesNotMatch(hookSource, /process\.env/, 'the hook takes the flag as an input (it is unit-tested in a bare vm)')
  assert.doesNotMatch(read('hooks/use-deckster-websocket-v2.ts'), /BUILD_RESUME/, 'the socket hook is untouched')
})
await check('.env.example documents the flag, default "false"', () => {
  assert.match(read('.env.example'), new RegExp(`^${FLAG}="false"$`, 'm'))
})

console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
