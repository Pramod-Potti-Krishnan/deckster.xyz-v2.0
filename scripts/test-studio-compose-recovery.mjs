import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { parse, current, declaration, print, evaluate, find, harness, flush } from './test-studio-compose-ownership.mjs'

// Actual native timers/callbacks; no service, iframe or persistence operations.
const firstFence = parse(execFileSync('git', ['show', '6799122:app/builder/page.tsx'], { encoding: 'utf8' }))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
let checks = 0
function recoveryHarness({ source = current, kind = 'compose', outcome = 'built', hold = false, studioShell = true } = {}) {
  const h = harness({ source, kind, studioShell }), c = h.context, timers = new Map(), old = deferred()
  c.studioSlideComposeCountsRef = { current: { 'presentation-A': 3, 'presentation-B': 9 } }
  const sessionOwner = find(source, n => ts.isFunctionDeclaration(n) && n.name?.text === 'captureStudioSlideComposeSessionOwner')
  if (sessionOwner) evaluate(`${print(sessionOwner, source)}; globalThis.captureStudioSlideComposeSessionOwner = captureStudioSlideComposeSessionOwner;`, c)
  let serial = 0, clock = 0, fetchCount = 0
  const job = c.slideComposeJobsRef.current['job-A']; job.request.session_id = 'session-A'; job.request.presentation_id = 'presentation-A'
  c.slideComposePollersRef = { current: {} }; c.pendingComposePlaceholdersRef = { current: new Map() }
  c.Date = class extends Date { static now() { return clock } }
  const schedule = (fn, delay, interval = false) => { const id = ++serial; timers.set(id, { fn, delay, interval }); h.events.push(['schedule', id, delay, interval]); return id }
  c.setTimeout = c.window.setTimeout = (fn, delay) => schedule(fn, delay)
  c.setInterval = (fn, delay) => schedule(fn, delay, true)
  c.clearTimeout = c.clearInterval = id => { h.events.push(['clear-timer', id]); timers.delete(id) }
  const body = () => ({ job_id: 'job-A', session_id: 'session-A', presentation_id: 'presentation-A', kind, status: outcome, real_slide_id: outcome === 'built' ? 'new-slide-A' : null, slide_index: 1, errors: outcome === 'built' ? [] : ['Native local failure'] })
  c.fetch = async (...args) => { h.events.push(['status-fetch', ...args]); fetchCount++; return hold && fetchCount === 1 ? old.promise : { ok: true, json: async () => body() } }
  c.fetchSlideComposePresentationSnapshot = async id => { h.events.push(['snapshot-fetch', id]); return { slideCount: kind === 'compose' ? 4 : 3, slideIds: new Set(['new-slide-A']) } }
  c.composeViewerApiRef.current.composePlaceholderFail = async id => h.events.push(['placeholder-fail', c.slideComposerPresentationRef.current.presentationId, id])
  c.composeViewerApiRef.current.refineOverlayClear = async id => h.events.push(['overlay-clear', c.slideComposerPresentationRef.current.presentationId, id])
  c.composeViewerApiRef.current.composePlaceholderAdd = async (...args) => h.events.push(['placeholder-add', c.slideComposerPresentationRef.current.presentationId, ...args])
  c.composeViewerApiRef.current.refineOverlayMark = async (...args) => h.events.push(['overlay-mark', c.slideComposerPresentationRef.current.presentationId, ...args])
  c.crypto = { randomUUID: () => 'retry-A' }
  for (const [exposed, native] of [['clearSlideComposePoller', 'clearSlideComposePoller'], ['clearSlideComposeWatchdog', 'clearSlideComposeWatchdog'], ['removeSlideComposeJob', 'removeSlideComposeJob'], ['confirmSlideComposeJobAfterRefresh', 'confirmSlideComposeJobAfterRefresh'], ['startSlideComposePoller', 'startSlideComposePoller'], ['startStudioSlideComposeWatchdog', 'startStudioSlideComposeWatchdog']]) {
    const node = declaration(source, native)
    if (node) evaluate(`globalThis.${exposed} = ${print(node.arguments[0], source)};`, c)
  }
  const effect = find(source, n => ts.isCallExpression(n) && n.expression.getText(source) === 'React.useEffect' && n.arguments[0]?.getText(source).includes('const retireTimers'))
  if (effect) evaluate(`globalThis.resumeNative = ${print(effect.arguments[0], source)};`, c)
  let cleanup
  function effectRun() { cleanup?.(); cleanup = c.resumeNative?.() }
  function version(id) {
    const activeVersion = id === 'presentation-A' ? 'final' : 'strawman'
    c.presentationId = id
    c.slideComposerPresentationRef.current = { ...c.slideComposerPresentationRef.current, presentationId: id, presentationUrl: `https://fixture.invalid/${id}`, activeVersion }
    c.studioSlideComposeOwnerRef.current = { key: `${id}-${++serial}`, sessionId: 'session-A', presentationId: id, activeVersion }
    // Execute the existing cleanup effect with no override: native retained jobs.
    const nativeCleanup = find(source, n => ts.isCallExpression(n) && n.expression.getText(source) === 'useEffect' && n.arguments[0]?.getText(source).includes('builder.override.cleared_for_director_deck'))
    c.slideComposerOverride = null; c.directorOwnedPresentation = { usesOverride: false }; c.activeVersion = activeVersion
    c.clearSlideComposerWork = () => assert.fail('Native no-override version change must retain jobs')
    evaluate(`(${print(nativeCleanup.arguments[0], source)})()`, c)
    effectRun()
  }
  const tick = async id => { const timer = timers.get(id); assert.ok(timer, `Native timer ${id} remains registered`); if (!timer.interval) timers.delete(id); timer.fn(); await flush() }
  effectRun()
  return { ...h, job, old, timers, version, effectRun, tick, clock(value) { clock = value }, start() { c.startSlideComposePoller('job-A') }, body, get fetchCount() { return fetchCount } }
}

// Regression in the first fence: accepted job retained across native version
// switching, but its existing interval becomes inert on return.
{
  const h = recoveryHarness({ source: firstFence, hold: true }); h.start(); await h.tick(h.context.slideComposePollersRef.current['job-A'])
  const interval = h.context.slideComposePollersRef.current['job-A']; h.version('presentation-B'); h.version('presentation-A'); h.events.length = 0
  await h.tick(interval); assert.equal(h.events.filter(e => e[0] === 'status-fetch').length, 0); assert.equal(h.context.slideComposeJobsRef.current['job-A'].status, 'building'); checks++
}
for (const kind of ['compose', 'refine']) for (const outcome of ['built', 'error', 'cancelled']) for (const hold of [false, true]) {
  const h = recoveryHarness({ kind, outcome, hold }), c = h.context
  // Build polling only once initially; fresh recovery thereafter comes solely
  // from the real effect on native retained-job version switches.
  if (hold) { await h.tick(c.slideComposePollersRef.current['job-A']); assert.equal(h.fetchCount, 1) }
  const oldTimer = [...h.timers.values()].find(t => t.interval)?.fn
  h.version('presentation-B'); assert.equal(c.slideComposeJobsRef.current['job-A'], h.job)
  h.events.length = 0; oldTimer?.(); await flush(); assert.equal(h.events.length, 0, 'No A commands or recovery notices in B')
  h.version('presentation-A'); assert.equal(c.slideComposeJobsRef.current['job-A'], h.job)
  const fresh = c.slideComposePollersRef.current['job-A']; assert.ok(h.timers.has(fresh)); assert.equal(h.timers.get(fresh).delay, 2000)
  h.events.length = 0; await h.tick(fresh)
  assert.equal(h.events.filter(e => e[0] === 'status-fetch').length, 1)
  assert.equal(h.events.find(e => e[0] === 'status-fetch')[1], '/api/slides/jobs/job-A?session_id=session-A&presentation_id=presentation-A')
  assert.ok(h.events.some(e => e[0] === 'schedule' && e[2] === 3000))
  if (outcome === 'built') { assert.ok(h.events.some(e => e[0] === 'reload' && e[1] === 'session-A')); assert.equal(c.slideComposeJobsRef.current['job-A'], undefined) }
  else if (kind === 'refine') { assert.equal(c.slideComposeJobsRef.current['job-A'], undefined); assert.ok(h.events.some(e => e[0] === 'overlay-clear' && e[1] === 'presentation-A')) }
  else { assert.equal(c.slideComposeJobsRef.current['job-A'].status, 'error'); assert.ok(h.events.some(e => e[0] === 'placeholder-fail' && e[1] === 'presentation-A')) }
  if (hold) {
    const eventCount = h.events.length, timersNow = JSON.stringify(c.slideComposePollersRef.current)
    h.old.resolve({ ok: true, json: async () => h.body() }); await flush()
    assert.equal(h.events.length, eventCount, 'Previous epoch response stays retired after return'); assert.equal(JSON.stringify(c.slideComposePollersRef.current), timersNow)
  }
  checks++
}
for (const kind of ['compose', 'refine']) {
  const h = recoveryHarness({ kind, hold: true }), c = h.context
  c.startStudioSlideComposeWatchdog('job-A', `${kind} job job-A exceeded watchdog`)
  const original = c.slideComposeWatchdogsRef.current['job-A'], oldCallback = h.timers.get(original).fn
  assert.equal(h.timers.get(original).delay, c.SLIDE_COMPOSE_WATCHDOG_MS)
  h.clock(100000); h.version('presentation-B'); h.events.length = 0; oldCallback(); await flush(); assert.equal(h.events.length, 0)
  h.clock(200000); h.version('presentation-A')
  const fresh = c.slideComposeWatchdogsRef.current['job-A']; assert.notEqual(fresh, original)
  assert.equal(h.timers.get(fresh).delay, c.SLIDE_COMPOSE_WATCHDOG_MS - 200000, 'Original watchdog budget is not reset')
  h.events.length = 0; await h.tick(fresh); assert.ok(h.events.some(e => e[0] === 'reload' && e[1] === 'session-A'))
  // Fired native one-shot is not repeated when its original version returns.
  h.version('presentation-B'); h.version('presentation-A'); assert.equal(c.slideComposeWatchdogsRef.current['job-A'], undefined); checks++
}
function acceptedHarness(options = {}) {
  const h = recoveryHarness(options), c = h.context
  c.slideComposeJobsRef.current = {}; c.slideComposeJobs = {}
  const source = options.source ?? current
  evaluate(`globalThis.acceptNative = ${print(declaration(source, 'handleSlideComposerAccepted').arguments[0], source)}; globalThis.retryNative = ${print(declaration(source, 'handleRetrySlideCompose').arguments[0], source)}; globalThis.apisReady = ${print(declaration(source, 'handleComposeApiReady').arguments[0], source)};`, c)
  const failed = find(source, n => ts.isPropertyAssignment(n) && n.name.getText(source) === 'onSlideComposeFailed')
  evaluate(`globalThis.failedNative = ${print(failed.initializer, source)};`, c)
  return h
}
for (const kind of ['compose', 'refine']) for (const requestId of ['presentation-A', null]) {
  const h = acceptedHarness({ kind }), c = h.context; h.version('presentation-B'); h.events.length = 0
  c.acceptNative({ job_id: 'job-A', kind, target_index: 1, presentation_id: 'presentation-A', request: { session_id: 'session-A', presentation_id: requestId, slide_id: 'old-slide-A' } })
  assert.equal(c.slideComposeJobsRef.current['job-A'].target_presentation_id, 'presentation-A')
  assert.equal(c.slideComposeJobsRef.current['job-A'].expected_slide_count, kind === 'compose' ? 4 : 3)
  assert.equal(h.events.filter(e => ['placeholder-add', 'overlay-mark', 'toast', 'panel', 'status-fetch'].includes(e[0])).length, 0)
  c.failedNative({ payload: { job_id: 'job-A', kind, errors: ['Off-version local failure'] } }); assert.equal(c.slideComposeJobsRef.current['job-A'].status, 'building', 'Detached failure retains durable recovery data')
  h.version('presentation-A'); await h.tick(c.slideComposePollersRef.current['job-A']); assert.ok(h.events.some(e => e[0] === 'status-fetch')); checks++
}
for (const presentationId of [null, 'presentation-A']) {
  const h = acceptedHarness(), c = h.context
  c.studioSlideComposeOwnerRef.current.presentationId = null; c.slideComposerPresentationRef.current.presentationId = null; c.composeViewerApiRef.current = null
  c.acceptNative({ job_id: 'job-A', target_index: 0, presentation_id: presentationId, request: { session_id: 'session-A', presentation_id: null } })
  assert.equal(c.slideComposeJobsRef.current['job-A'].target_presentation_id, presentationId)
  assert.ok(h.events.some(e => e[0] === 'toast')); assert.ok(c.pendingComposePlaceholdersRef.current.has('job-A')); checks++
}
for (const retirement of ['unmount', 'session', 'account']) {
  const h = acceptedHarness(), c = h.context; h.retire(retirement); h.events.length = 0
  c.acceptNative({ job_id: 'job-A', target_index: 1, presentation_id: 'presentation-A', request: { session_id: 'session-A', presentation_id: 'presentation-A' } })
  assert.equal(Object.keys(c.slideComposeJobsRef.current).length, 0); assert.equal(h.events.length, 0); checks++
}
for (const phase of ['fetch', 'body']) for (const retirement of ['version', 'session', 'account', 'unmount']) for (const failure of [false, true]) {
  const h = acceptedHarness(), c = h.context, waiting = deferred()
  c.slideComposeJobsRef.current = { 'job-A': { ...h.job, status: 'error' } }; c.slideComposeJobs = c.slideComposeJobsRef.current
  const response = { ok: !failure, json: async () => phase === 'body' ? waiting.promise : { status: failure ? 'error' : 'accepted', target_index: 1, errors: failure ? ['Local refused retry'] : [] } }
  c.fetch = async (url, options) => { h.events.push(['retry-fetch', url, JSON.parse(options.body)]); return phase === 'fetch' ? waiting.promise : response }
  const task = c.retryNative('job-A'); await flush(); const next = c.slideComposeJobsRef.current['retry-A']
  h.retire(retirement)
  // Native version selection retains the accepted request; other retirement
  // clears it as the real session/account/mount transition does.
  if (retirement === 'version') c.slideComposeJobsRef.current = { 'retry-A': next }
  h.events.length = 0
  waiting.resolve(phase === 'fetch' ? response : { status: failure ? 'error' : 'accepted', target_index: 1, errors: failure ? ['Local refused retry'] : [] }); await task
  assert.equal(h.events.filter(e => ['placeholder-add', 'overlay-mark', 'toast', 'panel', 'status-fetch'].includes(e[0])).length, 0)
  if (retirement === 'version') assert.equal(c.slideComposeJobsRef.current['retry-A'].status, failure ? 'error' : 'building')
  else assert.equal(Object.keys(c.slideComposeJobsRef.current).length, 0)
  checks++
}
// Actual queued API flush must never apply A placeholders/overlays to B, and
// both accepted and retried placeholder rejections cannot requeue into B.
for (const kind of ['compose', 'refine']) {
  const h = acceptedHarness({ kind }), c = h.context, originalApi = c.composeViewerApiRef.current
  c.composeViewerApiRef.current = null
  c.acceptNative({ job_id: 'job-A', kind, target_index: 1, presentation_id: 'presentation-A', request: { session_id: 'session-A', presentation_id: 'presentation-A', slide_id: 'old-slide-A' } })
  assert.ok(c.pendingComposePlaceholdersRef.current.has('job-A'))
  h.version('presentation-B'); h.events.length = 0; c.apisReady(originalApi)
  assert.equal(h.events.filter(e => ['placeholder-add', 'overlay-mark'].includes(e[0])).length, 0); assert.ok(c.pendingComposePlaceholdersRef.current.has('job-A'))
  h.version('presentation-A'); h.events.length = 0; c.apisReady(originalApi); await flush()
  assert.equal(h.events.filter(e => ['placeholder-add', 'overlay-mark'].includes(e[0])).length, 1); assert.equal(c.pendingComposePlaceholdersRef.current.size, 0); checks++
}
for (const kind of ['compose', 'refine']) {
  const h = acceptedHarness({ kind }), c = h.context; let reject
  const pending = new Promise((_, r) => { reject = r })
  c.composeViewerApiRef.current[kind === 'compose' ? 'composePlaceholderAdd' : 'refineOverlayMark'] = () => pending
  c.acceptNative({ job_id: 'job-A', kind, target_index: 1, presentation_id: 'presentation-A', request: { session_id: 'session-A', presentation_id: 'presentation-A', slide_id: 'old-slide-A' } })
  h.version('presentation-B'); reject(new Error('Local placeholder refusal')); await flush()
  assert.equal(c.pendingComposePlaceholdersRef.current.size, 0); checks++
}
for (const studioShell of [true, false]) for (const fail of [false, true]) {
  const h = acceptedHarness({ studioShell }), c = h.context
  c.slideComposeJobsRef.current = { 'job-A': { ...h.job, status: 'error', expected_slide_count: 4 } }; c.slideComposeJobs = c.slideComposeJobsRef.current
  c.fetch = async (url, options) => { h.events.push(['retry-fetch', url, JSON.parse(options.body)]); return { ok: !fail, json: async () => ({ status: fail ? 'error' : 'accepted', target_index: 1, errors: fail ? ['Local retry refused'] : [] }) } }
  await c.retryNative('job-A')
  assert.deepEqual(h.events.find(e => e[0] === 'retry-fetch')[2], { slide_id: 'old-slide-A', session_id: 'session-A', presentation_id: 'presentation-A', job_id: 'retry-A', async: true, assume_on_missing: true })
  assert.equal(c.slideComposeJobsRef.current['retry-A'].status, fail ? 'error' : 'building')
  assert.equal(h.events.filter(e => e[0] === 'placeholder-add').length, fail ? 0 : 1); checks++
}
// Default-off parent acceptance/retry and timer behavior matches the fixed
// first-fence baseline, including its inherited detached-viewer behavior.
for (const kind of ['compose', 'refine']) {
  const run = source => {
    const h = acceptedHarness({ source, kind, studioShell: false }), c = h.context
    h.version('presentation-B'); h.events.length = 0
    c.acceptNative({ job_id: 'job-A', kind, target_index: 1, presentation_id: 'presentation-A', request: { session_id: 'session-A', presentation_id: null, slide_id: 'old-slide-A' } })
    return { events: JSON.parse(JSON.stringify(h.events)), job: JSON.parse(JSON.stringify(c.slideComposeJobsRef.current['job-A'])) }
  }
  assert.deepEqual(run(current), run(firstFence)); checks++
}
console.log(`PASS ${checks} native compose/refine version-return recovery checks; supplied responses only, no connected proof.`)
