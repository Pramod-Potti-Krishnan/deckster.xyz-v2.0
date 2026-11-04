import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Actual Builder callbacks and native reconciliation helpers, supplied local
// promises/counters only. This does not prove a service write or persistence.
const parse = text => ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const current = parse(fs.readFileSync(new URL(process.argv.includes('--selection-snapshot')?'../docs/studio-v4/twenty-four-hour-parity-20261005/builder1/sync-selection-review/FINAL-page.tsx.txt':process.argv.includes('--clarification-snapshot')?'../docs/studio-v4/twenty-four-hour-parity-20261005/builder1/sync-selection-review/PREDECESSOR-page.tsx.txt':'../app/builder/page.tsx', import.meta.url), 'utf8'))
const baseline = parse(execFileSync('git', ['show', '4894987:app/builder/page.tsx'], { encoding: 'utf8' }))
const baselineOnly = process.argv.includes('--baseline-witness')
for (const source of [current, baseline]) assert.equal(source.parseDiagnostics.length, 0)
function find(root, predicate) {
  if (predicate(root)) return root
  let match
  ts.forEachChild(root, child => { if (!match) match = find(child, predicate) })
  return match
}
function all(root, predicate, result = []) {
  if (predicate(root)) result.push(root)
  ts.forEachChild(root, child => all(child, predicate, result))
  return result
}
const declaration = (source, name) => find(source, n => ts.isVariableDeclaration(n) && n.name.getText(source) === name)?.initializer
const print = (node, source) => ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, node, source)
const ready = source => find(source, n => ts.isPropertyAssignment(n) && n.name.getText(source) === 'onSlideComposeReady').initializer
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const evaluate = (text, context) => vm.runInNewContext(compile(text), context)
function pure(path) {
  const module = { exports: {} }
  evaluate(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { module, exports: module.exports, URL, URLSearchParams })
  return module.exports
}
const helpers = { ...pure('../lib/slide-compose-async.ts'), ...pure('../lib/builder-presentation-ownership.ts'), ...pure('../lib/slide-compose-job-recovery.ts'), ...pure('../lib/stage-f-thumbnails.ts') }
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const nativeResult = { success: true, visual_index: 1, real_slide_index: 1, real_slide_count: 4 }
let checks = 0
function harness({ source = current, kind = 'compose', studioShell = true, queued = false, fallback = false, missingSlideId = false } = {}) {
  const events = [], timers = [], wait = deferred(), queue = deferred(), confirm = deferred()
  const snapshot = { presentationId: 'presentation-A', presentationUrl: 'https://fixture.invalid/A', slideCount: 3, activeVersion: 'final', refreshToken: 0 }
  const job = { job_id: 'job-A', kind, target_visual_index: 1, target_layout_index: 1, target_presentation_id: 'presentation-A', target_slide_id: 'old-slide-A', request: { slide_id: 'old-slide-A' }, status: 'building' }
  const context = {
    ...helpers, studioShell, presentationId: 'presentation-A', selectedLayoutSlideIndex: 1,
    payload: undefined, currentSessionIdRef: { current: 'session-A' }, currentSlideIndexRef: { current: 1 },
    slideComposerPresentationRef: { current: snapshot }, slideComposeJobsRef: { current: { 'job-A': job } },
    studioSlideComposeOwnerRef: { current: { key: 'A', sessionId: 'session-A', presentationId: 'presentation-A', activeVersion: 'final' } },
    questionSubmissionScopeRef: { current: { active: true, generation: 0, sessionId: 'session-A', userId: 'offline-owner' } },
    pendingComposeSelectionRestoreRef: { current: null }, composeSelectionAttemptRef: { current: null },
    studioSlideComposePollerOwnersRef: { current: {} }, studioSlideComposeWatchdogsRef: { current: {} },
    slideComposeWatchdogsRef: { current: {} },
    composeViewerApiRef: { current: Object.fromEntries(['composeSlideReconcile', 'refineSlideReconcile'].map(name => [name, (...args) => { events.push(['reconcile', name, args]); return wait.promise }])) },
    persistenceRef: { current: { updateMetadata: value => events.push(['persist', context.currentSessionIdRef.current, value]) } },
    console: { warn: (...args) => events.push(['warning', ...args]) }, scTrace: () => {},
    clearSlideComposePoller: id => events.push(['clear-poller', id]), clearSlideComposeWatchdog: id => events.push(['clear-watchdog', id]),
    mergeStageFInsertedThumbnailUrl: (prev, ...args) => { events.push(['thumbnail', ...args]); return prev },
    setReceivedSlideThumbnailUrlsByPresentation: (presentationId, fn) => { events.push(['received-thumbnail', presentationId]); return fn({}) },
    setSlideThumbnailUrlsByPresentation: fn => fn({}), setSlideComposePanelEvent: value => events.push(['panel', value]),
    enqueueSlideComposeReconcile: (key, task) => { context.task = queued ? queue.promise.then(task) : task(); return context.task },
    removeSlideComposeJob: (...args) => { events.push(['remove-job', ...args]); delete context.slideComposeJobsRef.current[args[0]] },
    setSlideComposeJobs: fn => { context.slideComposeJobsRef.current = fn(context.slideComposeJobsRef.current); events.push(['jobs']) },
    setSlideComposerOverride: value => events.push(['override', context.currentSessionIdRef.current, value]),
    setCurrentSlideIndex: value => events.push(['selection', context.currentSessionIdRef.current, value]),
    setSelectedLayoutSlideIndex: value => events.push(['layout-selection', value]), toast: value => events.push(['toast', context.currentSessionIdRef.current, value]),
    triggerCoalescedSlideComposeReload: () => events.push(['reload', context.currentSessionIdRef.current]),
    window: { setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length } },
    confirmSlideComposeJobAfterRefresh: async id => { events.push(['confirm', id]); return confirm.promise },
    startSlideComposePoller: id => events.push(['start-poller', id]),
  }
  const ownerFunction = find(source, n => ts.isFunctionDeclaration(n) && n.name?.text === 'captureStudioSlideComposeOwner')
  if (ownerFunction) evaluate(`${print(ownerFunction, source)}; globalThis.captureStudioSlideComposeOwner = captureStudioSlideComposeOwner;`, context)
  const queueSelection = find(source, n => ts.isFunctionDeclaration(n) && n.name?.text === 'queueComposeSelectionRestore')
  if (queueSelection) evaluate(`${print(queueSelection, source)}; globalThis.queueComposeSelectionRestore = queueComposeSelectionRestore;`, context)
  evaluate(`globalThis.ready = ${print(ready(source), source)};`, context)
  const message = { payload: { job_id: 'job-A', kind, presentation_id: 'presentation-A', presentation_url: snapshot.presentationUrl, slide_index: 1, real_slide_id: missingSlideId ? undefined : 'new-slide-A', replaced_slide_id: 'old-slide-A' } }
  const retire = type => {
    if (type === 'unmount' || type === 'strict-remount') { context.questionSubmissionScopeRef.current.active = false; context.questionSubmissionScopeRef.current.generation++; if (type === 'strict-remount') context.questionSubmissionScopeRef.current.active = true }
    else {
      const next = type === 'version' ? { ...snapshot, presentationId: 'presentation-strawman', activeVersion: 'strawman' } : { ...snapshot, presentationId: 'presentation-B', presentationUrl: 'https://fixture.invalid/B', slideCount: 2 }
      context.slideComposerPresentationRef.current = next
      context.studioSlideComposeOwnerRef.current = { key: type, sessionId: type === 'version' ? 'session-A' : 'session-B', presentationId: next.presentationId, activeVersion: next.activeVersion }
      if (type !== 'version') { context.currentSessionIdRef.current = 'session-B'; context.questionSubmissionScopeRef.current.sessionId = 'session-B'; context.questionSubmissionScopeRef.current.generation++ }
      if (type === 'roundtrip') { context.slideComposerPresentationRef.current = snapshot; context.studioSlideComposeOwnerRef.current = { key: 'A-again', sessionId: 'session-A', presentationId: 'presentation-A', activeVersion: 'final' }; context.currentSessionIdRef.current = 'session-A'; context.questionSubmissionScopeRef.current.sessionId = 'session-A'; context.questionSubmissionScopeRef.current.generation++ }
      if (type === 'account') { context.questionSubmissionScopeRef.current.userId = 'other-owner'; context.questionSubmissionScopeRef.current.generation++ }
    }
    context.slideComposeJobsRef.current = {}
    context.currentSlideIndexRef.current = 0
  }
  return { context, events, wait, queue, confirm, timers, message, retire, start() { context.ready(message); return context.task }, fallback }
}
const adoption = events => events.filter(event => ['override', 'persist', 'selection', 'layout-selection', 'toast', 'reload', 'start-poller', 'remove-job', 'jobs'].includes(event[0]))
function pollHarness(source, phase = 'snapshot') {
  const h = harness({ source }), c = h.context
  c.jobId = 'job-A'
  c.isCurrentOwner = c.captureStudioSlideComposeOwner?.() ?? (() => true)
  c.slideComposeJobsRef.current['job-A'].request.session_id = 'session-A'
  c.slideComposePollersRef = { current: {} }
  c.fetch = async (...args) => { h.events.push(['status-fetch', ...args]); return phase === 'fetch' ? h.wait.promise : { ok: true, json: () => phase === 'body' ? h.wait.promise : Promise.resolve({ job_id: 'job-A', session_id: 'session-A', presentation_id: 'presentation-A', status: 'built', real_slide_id: 'new-slide-A', slide_index: 1, kind: 'compose' }) } }
  c.fetchSlideComposePresentationSnapshot = async id => { h.events.push(['snapshot-fetch', id]); return phase === 'snapshot' ? h.wait.promise : { slideCount: 4, slideIds: new Set(['new-slide-A']) } }
  c.setTimeout = c.window.setTimeout
  c.setInterval = (callback, delay) => { h.events.push(['interval', delay]); return 99 }
  evaluate(`globalThis.poll = ${print(find(declaration(source, 'startSlideComposePoller'), n => ts.isVariableDeclaration(n) && n.name.getText(source) === 'poll').initializer, source)};`, c)
  return h
}

// Frozen actual source witness: late success writes A metadata through B; late
// failure reloads B. Both compose/refine branches must reproduce before fixing.
for (const kind of ['compose', 'refine']) for (const outcome of ['success', 'reject']) {
  const h = harness({ source: baseline, kind }), task = h.start()
  h.retire('session'); h.events.length = 0
  if (outcome === 'success') h.wait.resolve(nativeResult); else h.wait.reject(new Error('Offline native reconciliation refusal'))
  await task
  if (outcome === 'success') { const write = h.events.find(event => event[0] === 'persist'); assert.equal(write[1], 'session-B'); assert.equal(write[2].finalPresentationId, 'presentation-A') }
  else assert.ok(h.events.some(event => event[0] === 'reload' && event[1] === 'session-B'))
  checks++
}
for (const phase of ['body', 'snapshot']) {
  const h = pollHarness(baseline, phase), task = h.context.poll(); await flush()
  h.retire('session'); h.events.length = 0
  h.wait.resolve(phase === 'body' ? { job_id: 'job-A', session_id: 'session-A', presentation_id: 'presentation-A', status: 'built', real_slide_id: 'new-slide-A', slide_index: 1, kind: 'compose' } : { slideCount: 4, slideIds: new Set(['new-slide-A']) })
  await task
  if (phase === 'body') assert.ok(h.context.slideComposeJobsRef.current['job-A'], 'Actual old job status recreates A in B')
  else assert.ok(h.events.some(event => event[0] === 'reload' && event[1] === 'session-B'))
  checks++
}
if (baselineOnly) { console.log(`PASS ${checks} frozen actual compose/refine ownership witnesses; correction NOT verified.`); process.exit(0) }

assert.ok(find(current, n => ts.isFunctionDeclaration(n) && n.name?.text === 'captureStudioSlideComposeOwner'), 'Actual shared Studio owner capture')
// Execute the actual render retirement expressions, not an invented epoch.
{
  const key = find(current, n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(current) === 'studioSlideComposeOwnerKey'))
  const retirement = find(current, n => ts.isIfStatement(n) && n.expression.getText(current).includes('studioSlideComposeOwnerRef.current.key !== studioSlideComposeOwnerKey'))
  assert.ok(key && retirement)
  const c = { studioSlideComposeOwnerRef: { current: {} }, currentSessionId: 'session-A', wsSessionId: 'session-A', authScopeUserId: 'offline-owner', searchParams: { get: () => c.route }, route: 'session-A', effectivePresentationId: 'presentation-A', activeVersion: 'final', templateModeOn: false }
  const render = () => evaluate(`(() => { ${print(key, current)} ${print(retirement, current)} })()`, c)
  render(); const a = c.studioSlideComposeOwnerRef.current
  c.slideCount = 10; c.refreshToken = 15; render(); assert.equal(c.studioSlideComposeOwnerRef.current, a, 'Same-deck progress/refresh keeps owner')
  c.route = 'session-B'; render(); assert.notEqual(c.studioSlideComposeOwnerRef.current, a, 'Route intent retires before B loads')
  c.route = 'session-A'; render(); assert.notEqual(c.studioSlideComposeOwnerRef.current, a, 'A→B→A remains retired')
  const again = c.studioSlideComposeOwnerRef.current; c.activeVersion = 'strawman'; render(); assert.notEqual(c.studioSlideComposeOwnerRef.current, again)
  checks += 4
}
for (const name of ['composeSlideReconcile', 'refineSlideReconcile']) {
  const call = source => all(ready(source), n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === name).map(n => print(n, source))
  assert.deepEqual(call(current), call(baseline), 'Native reconciliation arguments retained'); checks++
}
for (const kind of ['compose', 'refine']) for (const studioShell of [true, false]) {
  const h = harness({ kind, studioShell }), task = h.start(); h.wait.resolve(nativeResult); await task
  assert.equal(h.events.find(event => event[0] === 'persist')[2].finalPresentationId, 'presentation-A')
  assert.equal(h.events.find(event => event[0] === 'override')[2].slideCount, 4)
  assert.equal(h.events.find(event => event[0] === 'toast')[2].title, kind === 'compose' ? 'Slide built' : 'Slide refined'); checks++
}
for (const kind of ['compose', 'refine']) for (const retirement of ['session', 'version', 'roundtrip', 'account', 'unmount', 'strict-remount']) for (const outcome of ['success', 'reject']) {
  const h = harness({ kind }), task = h.start(); h.retire(retirement); h.events.length = 0
  if (outcome === 'success') h.wait.resolve(nativeResult); else h.wait.reject(new Error('Offline refusal'))
  await task; assert.equal(adoption(h.events).length, 0, `${kind}/${retirement}/${outcome} cannot adopt or reload retired owner`); assert.equal(h.timers.length, 0); checks++
}
for (const kind of ['compose', 'refine']) {
  const h = harness({ kind, queued: true }); h.start(); h.retire('session'); h.events.length = 0; h.queue.resolve(); await h.context.task
  assert.equal(h.events.length, 0, 'Retired queued task never dispatches into another viewer'); checks++
}
// The current initial-deck path still admits a missing live/payload identity.
for (const missing of ['live', 'payload']) {
  const h = harness()
  if (missing === 'live') { h.context.presentationId = null; h.context.studioSlideComposeOwnerRef.current.presentationId = null; h.context.slideComposerPresentationRef.current.presentationId = null }
  else h.message.payload.presentation_id = undefined
  const task = h.start(); h.wait.resolve(nativeResult); await task
  assert.ok(h.events.some(event => event[0] === 'persist')); checks++
}
// Loaded route B with A still visible must not dispatch into A during loading.
{
  const h = harness(); h.context.questionSubmissionScopeRef.current.sessionId = 'session-B'; h.start()
  assert.equal(h.events.length, 0); checks++
}
// Real refresh confirmation must fence its own fetched snapshot adoption.
for (const retirement of ['session', 'version', 'roundtrip', 'account', 'unmount']) {
  const h = harness(), c = h.context
  c.slideComposeJobsRef.current['job-A'].real_slide_id = 'new-slide-A'
  c.fetchSlideComposePresentationSnapshot = () => h.wait.promise
  evaluate(`globalThis.confirmNative = ${print(declaration(current, 'confirmSlideComposeJobAfterRefresh').arguments[0], current)};`, c)
  const task = c.confirmNative('job-A'); h.retire(retirement); h.events.length = 0
  h.wait.resolve({ slideCount: 4, slideIds: new Set(['new-slide-A']) }); assert.equal(await task, false)
  assert.equal(adoption(h.events).length, 0); checks++
}
for (const phase of ['fetch', 'body', 'snapshot']) for (const retirement of ['session', 'version', 'roundtrip', 'account', 'unmount']) {
  const h = pollHarness(current, phase), task = h.context.poll(); await flush()
  h.retire(retirement); h.events.length = 0
  h.wait.resolve(phase === 'fetch' ? { ok: true, json: async () => ({ status: 'building' }) } : phase === 'body' ? { job_id: 'job-A', session_id: 'session-A', presentation_id: 'presentation-A', status: 'built', real_slide_id: 'new-slide-A', slide_index: 1, kind: 'compose' } : { slideCount: 4, slideIds: new Set(['new-slide-A']) })
  await task; assert.equal(h.events.length, 0, `Retired native poll ${phase}/${retirement}`); assert.deepEqual(Object.keys(h.context.slideComposeJobsRef.current), []); checks++
}
// Exercise the native startup timeout, interval and cleanup rather than just
// the inner poll. A scheduled old callback cannot overwrite B's timer slot.
for (const retirement of ['session', 'version', 'roundtrip', 'unmount']) {
  const h = pollHarness(current, 'fetch'), c = h.context
  c.clearInterval = id => h.events.push(['clear-interval', id])
  evaluate(`globalThis.clearSlideComposePoller = ${print(declaration(current, 'clearSlideComposePoller').arguments[0], current)}; globalThis.startNative = ${print(declaration(current, 'startSlideComposePoller').arguments[0], current)};`, c)
  c.startNative('job-A'); assert.equal(h.timers[0].delay, 2000)
  h.retire(retirement); c.slideComposePollersRef.current = {}; c.slideComposePollersRef.current['job-A'] = 'replacement-owner-timer'
  h.events.length = 0; h.timers[0].callback(); await flush()
  assert.equal(h.events.length, 0); assert.equal(c.slideComposePollersRef.current['job-A'], 'replacement-owner-timer'); checks++
}
{
  const h = pollHarness(current, 'fetch'), c = h.context
  evaluate(`globalThis.startNative = ${print(declaration(current, 'startSlideComposePoller').arguments[0], current)};`, c)
  c.startNative('job-A'); h.timers[0].callback(); await flush()
  assert.equal(h.timers[0].delay, 2000); assert.equal(h.events.find(event => event[0] === 'interval')[1], 3000)
  assert.equal(h.events.find(event => event[0] === 'status-fetch')[1], '/api/slides/jobs/job-A?session_id=session-A&presentation_id=presentation-A')
  h.wait.resolve({ ok: true, json: async () => ({ job_id: 'job-A', session_id: 'session-A', presentation_id: 'presentation-A', status: 'built', real_slide_id: 'new-slide-A', slide_index: 1, kind: 'compose' }) }); await flush()
  assert.ok(h.events.some(event => event[0] === 'reload')); assert.ok(h.events.some(event => event[0] === 'confirm')); checks++
}
// Distinct current-owner jobs retain their ACK counts and original targets.
{
  const h = harness(), c = h.context, second = deferred()
  c.slideComposeJobsRef.current['job-B'] = { ...c.slideComposeJobsRef.current['job-A'], job_id: 'job-B', target_visual_index: 2, target_layout_index: 2 }
  c.composeViewerApiRef.current.composeSlideReconcile = (id, ...args) => { h.events.push(['reconcile', id, args]); return id === 'job-A' ? h.wait.promise : second.promise }
  const firstTask = h.start(); c.ready({ payload: { ...h.message.payload, job_id: 'job-B', slide_index: 2, real_slide_id: 'new-slide-B' } }); const secondTask = c.task
  const owner = c.studioSlideComposeOwnerRef.current
  h.wait.resolve(nativeResult); await firstTask; assert.equal(c.studioSlideComposeOwnerRef.current, owner)
  second.resolve({ ...nativeResult, visual_index: 2, real_slide_index: 2, real_slide_count: 5 }); await secondTask
  assert.deepEqual(h.events.filter(event => event[0] === 'override').map(event => event[2].slideCount), [4, 5]); assert.equal(h.events.filter(event => event[0] === 'persist').length, 2); checks++
}
for (const kind of ['compose', 'refine']) for (const retirement of ['session', 'version', 'unmount']) {
  const h = harness({ kind, missingSlideId: true }); await h.start()
  assert.equal(h.timers.length, 1); assert.equal(h.timers[0].delay, 1500)
  h.retire(retirement); h.events.length = 0; h.timers[0].callback(); await flush()
  assert.equal(h.events.length, 0, 'Retired fallback callback never confirms or restarts polling'); checks++
}
for (const kind of ['compose', 'refine']) {
  const h = harness({ kind }); const task = h.start(); h.wait.reject(new Error('Native refusal')); await task
  assert.ok(h.events.some(event => event[0] === 'reload')); assert.equal(h.timers[0].delay, 1500)
  h.events.length = 0; h.timers[0].callback(); await flush(); assert.equal(h.events[0][0], 'confirm')
  h.retire('session'); h.events.length = 0; h.confirm.resolve(false); await flush(); assert.equal(h.events.length, 0); checks++
}
// Flag-off preserves inherited late-result behavior exactly, including notices.
for (const kind of ['compose', 'refine']) {
  const h = harness({ kind, studioShell: false }), task = h.start(); h.retire('session'); h.wait.resolve(nativeResult); await task
  assert.equal(h.events.find(event => event[0] === 'persist')[1], 'session-B'); checks++
}
console.log(`PASS ${checks} actual compose/refine callback checks; supplied local responses only, no service or persistence proof.`)

export { parse, current, baseline, declaration, print, evaluate, find, harness, flush, helpers }
