// J2-SILENT-FAIL: an async slide-compose job can no longer vanish without a word
// (flag NEXT_PUBLIC_STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED, default off).
// Offline and self-contained: no network, no git, no browser. The repo root is found from this file (package.json anchor).
// It drives the real controller (lib/studio-compose-job-failsafe.ts) with a fake clock, fake storage, a scripted job-status
// route and a fake viewer: a job with no outcome becomes an error card at its deadline (wording picked by one status
// re-check; a job the route still reports as building is rescheduled until the 25 minute cap), a reload restores the stored record after one re-check (pending, error, or gone), a late "ready" is normal,
// Retry keeps the prompt, Dismiss removes the card and the record. It also runs the real hook against a tiny hook runtime
// (flag off = inert), server-renders the real rail strip, pins the page wiring, then re-runs every suite against
// deliberately broken copies of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED'
const FILES = {
  lib: 'lib/studio-compose-job-failsafe.ts',
  hook: 'hooks/use-studio-compose-job-failsafe.ts',
  strip: 'components/slide-thumbnail-strip.tsx',
  page: 'app/builder/page.tsx',
}
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const SRC = Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, read(rel)]))
const ENVEX = read('.env.example')
const PKG = JSON.parse(read('package.json'))

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }
// An exception inside a fire-and-forget async path must fail the suite, not crash the process.
const unhandled = []
process.on('unhandledRejection', error => { unhandled.push(error) })

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
/** `overrides`: repo-relative path -> source text; `stubs`: import specifier as written -> module object; `globals`: extra free names. */
function createWorld({ env = {}, overrides = {}, stubs = {}, globals = {} } = {}) {
  const cache = new Map()
  const names = Object.keys(globals)
  const exists = rel => rel in overrides || (fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile())
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext
    throw new Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const source = rel in overrides ? overrides[rel] : read(rel)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      return nodeRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', ...names, compile(rel, source))(
      module, module.exports, require, { env }, ...names.map(name => globals[name]))
    return module.exports
  }
  return { load }
}

// ---------------------------------------------------------------- fakes
const tick = () => new Promise(resolve => setImmediate(resolve))
function makeClock(start = 1_700_000_000_000) {
  const clock = { now: start, timers: new Set(), seq: 0 }
  clock.setTimer = (callback, ms) => { const timer = { at: clock.now + Math.max(0, ms), callback, seq: clock.seq++ }; clock.timers.add(timer); return timer }
  clock.clearTimer = handle => { clock.timers.delete(handle) }
  clock.advance = async ms => {
    const target = clock.now + ms
    for (let fired = 0; ; fired++) {
      if (fired > 500) throw new Error('timer storm: a timer keeps re-arming itself')
      const due = [...clock.timers].filter(timer => timer.at <= target).sort((a, b) => a.at - b.at || a.seq - b.seq)[0]
      if (!due) break
      clock.timers.delete(due)
      clock.now = Math.max(clock.now, due.at)
      due.callback()
      await tick()
    }
    clock.now = target
    await tick()
  }
  return clock
}
class MemStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
  removeItem(key) { this.map.delete(key) }
}
const throwingStorage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }

const MIN = 60_000
const SESSION = 'sess-1'
const DECK = 'pres-1'
const PROMPT = 'Chart of Q3 revenue by region, call out EMEA'
const makeJob = (id, over = {}) => ({
  job_id: id, kind: 'compose', target_visual_index: 2, target_layout_index: 2, target_slide_id: null, status: 'building',
  title: 'Chart of Q3 revenue by region', target_presentation_id: DECK, expected_slide_count: 5,
  request: {
    session_id: SESSION, presentation_id: DECK, insert_after_index: 1, instruction: PROMPT,
    selections: { canvas_type: 'C1', content_type: 'chart', chart_subtype: 'single' },
    theme: { mode: 'preset', preset_id: 'corporate_light' },
    research: { use_uploaded_documents: false, use_web_search: true, use_deep_research: false, use_knowledge_graph: false, web_search_max_queries: 3 },
    job_id: id, async: true, assume_on_missing: true,
  },
  ...over,
})
const statusBody = (id, status, over = {}) => ({
  job_id: id, kind: 'compose', session_id: SESSION, presentation_id: DECK, target_index: 2, status, slide_index: null,
  real_slide_id: null, presentation_url: null, stage: null, errors: [], ...over,
})
const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const makeApi = () => {
  const api = { adds: [], fails: [], addError: null, attempts: 0 }
  api.composePlaceholderAdd = async (id, index) => { api.attempts++; if (api.addError) throw api.addError; api.adds.push([id, index]) }
  api.composePlaceholderFail = async id => { api.fails.push(id) }
  return api
}

function harness(lib, { storage = new MemStorage(), clock = makeClock(), jobs = {}, sessionId = SESSION, presentationId = DECK } = {}) {
  const state = { jobs }
  const h = {
    lib, storage, clock, state, outcomes: {}, ownerGeneration: 0, api: makeApi(),
    fetches: [], armed: [], disarmed: [], failed: [], dismissed: [], deferJobs: false, pendingUpdates: [],
    key: lib.composeJobFailsafeKey(sessionId, presentationId),
  }
  const deps = {
    sessionId, presentationId, storage,
    now: () => clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    fetchJson: async url => {
      h.fetches.push(url)
      const id = decodeURIComponent(url.split('/api/slides/jobs/')[1].split('?')[0])
      const planned = h.outcomes[id]
      if (planned === 'throw') throw new Error('offline')
      if (typeof planned === 'function') return planned()
      // The default re-check cannot tell (a proxy failure). A "still building" answer reschedules the deadline instead of
      // failing, so a test that wants that plans it explicitly (see the reschedule block in timeoutSuite).
      return planned ?? answer(502, { errors: ['proxy'] })
    },
    getJobs: () => state.jobs,
    setJobs: update => {
      if (h.deferJobs) { h.pendingUpdates.push(update); return } // React commits a state update a little later
      state.jobs = update(state.jobs); queueMicrotask(() => h.controller.sync(state.jobs))
    },
    captureOwner: () => { const generation = h.ownerGeneration; return () => h.ownerGeneration === generation },
    getViewerApi: () => h.api,
    armJob: job => h.armed.push(job.job_id),
    disarmJob: id => h.disarmed.push(id),
    onFailed: (job, message) => h.failed.push([job.job_id, message]),
    onDismissed: (job, visualIndex) => h.dismissed.push([job.job_id, visualIndex]),
  }
  h.controller = lib.createComposeJobFailsafe(deps)
  h.register = job => { state.jobs = { ...state.jobs, [job.job_id]: job }; h.controller.sync(state.jobs); return job }
  h.update = (id, patch) => { state.jobs = { ...state.jobs, [id]: { ...state.jobs[id], ...patch } }; h.controller.sync(state.jobs) }
  h.remove = id => { const { [id]: _gone, ...rest } = state.jobs; state.jobs = rest; h.controller.sync(state.jobs) }
  h.flushJobs = () => { for (const update of h.pendingUpdates.splice(0)) state.jobs = update(state.jobs); h.controller.sync(state.jobs) }
  h.records = () => lib.readComposeJobRecords(storage, h.key)
  h.fetchesFor = id => h.fetches.filter(url => url.includes(`/api/slides/jobs/${id}?`))
  h.restore = async () => { await h.controller.restore(); await tick() }
  return h
}

function loadLib(overrides, env = { [FLAG]: 'true' }) {
  return createWorld({ env, overrides }).load(FILES.lib)
}

// ---------------------------------------------------------------- lib: flag, wording, window, records, classification
function pureSuite(overrides) {
  const make = env => loadLib(overrides, env)
  const lib = make()

  check(assert.equal, make({}).STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED, false, 'default off')
  for (const value of ['', 'TRUE', 'True', '1', 'yes', ' true', 'false', 'on'])
    check(assert.equal, make({ [FLAG]: value }).STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED, false, `flag "${value}"`)
  check(assert.equal, make({ [FLAG]: 'true' }).STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED, true)

  // bounded time: 5 min, +3 min per pending job ahead, never more than 25 min
  check(assert.equal, lib.COMPOSE_JOB_FAILSAFE_BASE_MS, 5 * MIN)
  check(assert.equal, lib.COMPOSE_JOB_FAILSAFE_MAX_MS, 25 * MIN)
  check(assert.equal, lib.composeJobFailsafeWindowMs(0), 5 * MIN)
  check(assert.equal, lib.composeJobFailsafeWindowMs(1), 8 * MIN)
  check(assert.equal, lib.composeJobFailsafeWindowMs(2), 11 * MIN)
  check(assert.equal, lib.composeJobFailsafeWindowMs(6), 23 * MIN)
  check(assert.equal, lib.composeJobFailsafeWindowMs(7), 25 * MIN, 'capped')
  check(assert.equal, lib.composeJobFailsafeWindowMs(500), 25 * MIN, 'capped far out')
  for (const bad of [-3, Number.NaN, undefined, 'x']) check(assert.equal, lib.composeJobFailsafeWindowMs(bad), 5 * MIN, `bad input ${String(bad)}`)

  // wording
  check(assert.equal, lib.composeJobFailureCaption({ errors: [lib.COMPOSE_JOB_TIMEOUT_MESSAGE] }), lib.COMPOSE_JOB_TIMEOUT_CAPTION)
  check(assert.equal, lib.composeJobFailureCaption({ errors: [lib.COMPOSE_JOB_LOST_MESSAGE] }), lib.COMPOSE_JOB_LOST_CAPTION)
  check(assert.equal, lib.composeJobFailureCaption({ errors: ['', lib.COMPOSE_JOB_NOT_SHOWN_MESSAGE] }), lib.COMPOSE_JOB_NOT_SHOWN_CAPTION)
  check(assert.equal, lib.composeJobFailureCaption({ errors: ['Slide Builder returned 500'] }), lib.COMPOSE_JOB_GENERIC_CAPTION, 'a backend error gets the generic plain caption')
  check(assert.equal, lib.composeJobFailureCaption({}), lib.COMPOSE_JOB_GENERIC_CAPTION)
  for (const text of [lib.COMPOSE_JOB_TIMEOUT_MESSAGE, lib.COMPOSE_JOB_LOST_MESSAGE, lib.COMPOSE_JOB_NOT_SHOWN_MESSAGE, lib.COMPOSE_JOB_GENERIC_MESSAGE,
    lib.COMPOSE_JOB_TIMEOUT_CAPTION, lib.COMPOSE_JOB_LOST_CAPTION, lib.COMPOSE_JOB_NOT_SHOWN_CAPTION, lib.COMPOSE_JOB_GENERIC_CAPTION]) {
    check(assert.doesNotMatch, text, /job|http|500|timeout|exception|traceback|undefined/i, `plain words: ${text}`)
  }
  for (const caption of [lib.COMPOSE_JOB_TIMEOUT_CAPTION, lib.COMPOSE_JOB_LOST_CAPTION, lib.COMPOSE_JOB_NOT_SHOWN_CAPTION, lib.COMPOSE_JOB_GENERIC_CAPTION])
    check(assert.ok, caption.length <= 40, `caption fits a 112 px card: ${caption}`)

  // the card decoration: errors only, compose only, flag on only; otherwise the same object back
  const dismiss = () => {}
  const errorCard = { jobId: 'a', kind: 'compose', status: 'error', title: 'T', errors: [lib.COMPOSE_JOB_LOST_MESSAGE], onRetry: () => {} }
  const decorated = lib.decorateComposeJobCard(errorCard, { errors: errorCard.errors }, { enabled: true, onDismiss: dismiss })
  check(assert.equal, decorated.failureCaption, lib.COMPOSE_JOB_LOST_CAPTION)
  check(assert.equal, decorated.onDismiss, dismiss)
  check(assert.equal, decorated.onRetry, errorCard.onRetry, 'Retry stays')
  check(assert.equal, decorated.title, 'T')
  check(assert.equal, 'failureCaption' in errorCard, false, 'the input is not mutated')
  check(assert.equal, lib.decorateComposeJobCard(errorCard, { errors: [] }, { enabled: false, onDismiss: dismiss }), errorCard, 'flag off: same object')
  const buildingCard = { ...errorCard, status: 'building' }
  check(assert.equal, lib.decorateComposeJobCard(buildingCard, undefined, { enabled: true, onDismiss: dismiss }), buildingCard, 'a pending card is untouched')
  const refineCard = { ...errorCard, kind: 'refine' }
  check(assert.equal, lib.decorateComposeJobCard(refineCard, undefined, { enabled: true, onDismiss: dismiss }), refineCard, 'a refine card is untouched')
  check(assert.equal, lib.decorateComposeJobCard(errorCard, undefined, { enabled: true, onDismiss: dismiss }).failureCaption, lib.COMPOSE_JOB_GENERIC_CAPTION, 'unknown job: generic')

  // the re-check answer
  const classify = (status, body, id = 'j1') => lib.classifyComposeJobRecheck(status, body, id)
  check(assert.deepEqual, classify(404, { detail: 'Slide compose job not found' }), { kind: 'missing' })
  check(assert.deepEqual, classify(500, null), { kind: 'unreachable' })
  check(assert.deepEqual, classify(502, { status: 'error', stage: 'proxy', errors: ['x'] }), { kind: 'unreachable' }, 'a proxy failure says nothing about the job')
  check(assert.deepEqual, classify(401, { error: 'Unauthorized' }), { kind: 'unreachable' })
  check(assert.deepEqual, classify(200, statusBody('j1', 'built')), { kind: 'built' })
  check(assert.deepEqual, classify(200, statusBody('j1', 'building')), { kind: 'building' })
  check(assert.deepEqual, classify(200, statusBody('j1', 'error', { errors: ['Slide Builder failed'] })), { kind: 'error', errors: ['Slide Builder failed'] })
  check(assert.deepEqual, classify(200, statusBody('j1', 'cancelled')), { kind: 'error', errors: [lib.COMPOSE_JOB_GENERIC_MESSAGE] })
  check(assert.deepEqual, classify(200, statusBody('other', 'built')), { kind: 'unreachable' }, 'another job id is not an answer')
  check(assert.deepEqual, classify(200, { nonsense: true }), { kind: 'unreachable' })
  check(assert.deepEqual, classify(200, null), { kind: 'unreachable' })

  // the deadline decision: still building = alive = reschedule, until the 25 minute cap from acceptance
  const decide = (outcome, sinceAcceptedMs) => lib.decideComposeJobDeadline(outcome, 1_000, 1_000 + sinceAcceptedMs)
  const CAP = lib.COMPOSE_JOB_FAILSAFE_MAX_MS
  const timeoutFail = { action: 'fail', errors: [lib.COMPOSE_JOB_TIMEOUT_MESSAGE] }
  check(assert.deepEqual, decide({ kind: 'building' }, 5 * MIN), { action: 'reschedule' }, 'building at the first deadline: reschedule')
  check(assert.deepEqual, decide({ kind: 'building' }, 0), { action: 'reschedule' })
  check(assert.deepEqual, decide({ kind: 'building' }, CAP - 1), { action: 'reschedule' }, 'one millisecond short of the cap: still reschedule')
  check(assert.deepEqual, decide({ kind: 'building' }, CAP), timeoutFail, 'building at the cap: fail')
  check(assert.deepEqual, decide({ kind: 'building' }, CAP + 1), timeoutFail, 'building past the cap: fail')
  check(assert.deepEqual, decide({ kind: 'building' }, CAP + 60 * MIN), timeoutFail, 'building long past the cap: fail')
  check(assert.deepEqual, lib.decideComposeJobDeadline({ kind: 'building' }, 5_000_000, 5_000_000 + CAP - 1), { action: 'reschedule' }, 'the cap counts from the acceptance time given')
  check(assert.deepEqual, lib.decideComposeJobDeadline({ kind: 'building' }, 5_000_000, 5_000_000 + CAP), timeoutFail)
  for (const since of [0, 5 * MIN, CAP - 1, CAP, CAP + MIN]) {
    check(assert.deepEqual, decide({ kind: 'error', errors: ['Slide Builder failed'] }, since), { action: 'fail', errors: ['Slide Builder failed'] }, `failed at ${since}: fail with its words`)
    check(assert.deepEqual, decide({ kind: 'missing' }, since), { action: 'fail', errors: [lib.COMPOSE_JOB_LOST_MESSAGE] }, `lost at ${since}: fail`)
    check(assert.deepEqual, decide({ kind: 'unreachable' }, since), timeoutFail, `unreachable at ${since}: fail, never rescheduled`)
    check(assert.deepEqual, decide({ kind: 'built' }, since), { action: 'built' }, `ready at ${since}: handed to the built path, not failed or rescheduled`)
  }

  // visual slots
  const slots = lib.composePlaceholderVisualIndexes([{ id: 'late', target: 3, order: 9 }, { id: 'early', target: 3, order: 1 }, { id: 'front', target: 1, order: 5 }])
  check(assert.deepEqual, [...slots.entries()], [['front', 1], ['early', 4], ['late', 5]], 'target plus the jobs placed before it')

  // records
  const key = lib.composeJobFailsafeKey('s', 'p')
  check(assert.equal, key, 'deckster.composeJobFailsafe.v1:s:p')
  check(assert.equal, lib.composeJobFailsafeKey(null, null), 'deckster.composeJobFailsafe.v1:no-session:no-deck')
  const storage = new MemStorage()
  const record = (id, over = {}) => ({ v: 1, job_id: id, status: 'building', title: 'T', accepted_at: 100, target_layout_index: 2, target_visual_index: 2, target_presentation_id: 'p', request: { session_id: 's', instruction: PROMPT }, ...over })
  lib.writeComposeJobRecords(storage, key, [record('a'), record('b', { status: 'error', errors: ['E'] })])
  check(assert.deepEqual, lib.readComposeJobRecords(storage, key).map(r => [r.job_id, r.status, r.errors ?? null]), [['a', 'building', null], ['b', 'error', ['E']]])
  check(assert.equal, lib.readComposeJobRecords(storage, key)[0].request.instruction, PROMPT, 'the prompt is in the record')
  lib.writeComposeJobRecords(storage, key, [])
  check(assert.equal, storage.getItem(key), null, 'an empty list removes the key')
  storage.setItem(key, '{not json')
  check(assert.deepEqual, lib.readComposeJobRecords(storage, key), [], 'corrupt JSON is ignored')
  storage.setItem(key, JSON.stringify({ not: 'a list' }))
  check(assert.deepEqual, lib.readComposeJobRecords(storage, key), [])
  storage.setItem(key, JSON.stringify([record('ok'), null, 7, record(''), record('x', { v: 2 }), record('y', { status: 'done' }), record('z', { request: null }),
    record('w', { request: { instruction: 'no session' } }), record('n', { accepted_at: 'soon' }), record('ok')]))
  check(assert.deepEqual, lib.readComposeJobRecords(storage, key).map(r => r.job_id), ['ok'], 'invalid and duplicate records are dropped')
  const many = Array.from({ length: 20 }, (_, i) => record(`job-${String(i).padStart(2, '0')}`, { accepted_at: i }))
  lib.writeComposeJobRecords(storage, key, many)
  check(assert.deepEqual, lib.readComposeJobRecords(storage, key).map(r => r.job_id),
    many.slice(-lib.COMPOSE_JOB_RECORD_LIMIT).map(r => r.job_id), 'only the newest are kept')
  check(assert.equal, lib.COMPOSE_JOB_RECORD_LIMIT, 12)
  check(assert.doesNotThrow, () => lib.writeComposeJobRecords(throwingStorage, key, many))
  check(assert.deepEqual, lib.readComposeJobRecords(throwingStorage, key), [])
  check(assert.doesNotThrow, () => lib.writeComposeJobRecords(null, key, many))
  check(assert.deepEqual, lib.readComposeJobRecords(null, key), [])
}

// ---------------------------------------------------------------- controller: timeout -> error card
async function timeoutSuite(overrides) {
  const lib = loadLib(overrides)
  const { TIMEOUT, LOST } = { TIMEOUT: lib.COMPOSE_JOB_TIMEOUT_MESSAGE, LOST: lib.COMPOSE_JOB_LOST_MESSAGE }

  // the baseline: no outcome for 5 minutes -> one status re-check -> an error card, in plain words
  {
    const h = harness(lib)
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN - 1)
    check(assert.equal, h.fetches.length, 0, 'nothing is asked before the deadline')
    check(assert.equal, h.state.jobs['job-1'].status, 'building')
    await h.clock.advance(1)
    check(assert.deepEqual, h.fetches, [`/api/slides/jobs/job-1?session_id=${SESSION}&presentation_id=${DECK}`], 'the existing job-status route, asked once')
    check(assert.equal, h.state.jobs['job-1'].status, 'error', 'the placeholder becomes an error card')
    check(assert.deepEqual, h.state.jobs['job-1'].errors, [TIMEOUT])
    check(assert.deepEqual, h.api.fails, ['job-1'], 'the in-deck placeholder is marked failed too')
    check(assert.deepEqual, h.disarmed, ['job-1'], 'the existing poller and watchdog are stopped')
    check(assert.deepEqual, h.failed, [['job-1', TIMEOUT]], 'the user is told once')
    check(assert.equal, h.state.jobs['job-1'].request.instruction, PROMPT, 'the prompt stays on the failed job (Retry re-sends it)')
    check(assert.equal, h.records()[0].status, 'error', 'the stored record shows the failure')
    check(assert.deepEqual, h.records()[0].errors, [TIMEOUT])
    check(assert.equal, h.clock.timers.size, 0, 'a failed job holds no timer')
    await h.clock.advance(60 * MIN)
    check(assert.equal, h.fetches.length, 1, 'no further asking')
    check(assert.equal, h.failed.length, 1, 'no second notice')
    check(assert.equal, h.state.jobs['job-1'].status, 'error', 'the card stays until Retry or Dismiss')
  }

  // the wording follows the one re-check
  const wording = async (planned, expected, name) => {
    const h = harness(lib)
    h.outcomes['job-1'] = planned
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN)
    check(assert.equal, h.state.jobs['job-1'].status, 'error', `${name}: error card`)
    check(assert.deepEqual, h.state.jobs['job-1'].errors, expected, name)
    check(assert.equal, h.fetches.length, 1, `${name}: one question`)
  }
  await wording(answer(404, { detail: 'Slide compose job not found' }), [LOST], 'Director never heard of it: lost')
  await wording('throw', [TIMEOUT], 'the route is unreachable: timeout')
  await wording(answer(502, { errors: ['proxy'] }), [TIMEOUT], 'a proxy failure: timeout')
  await wording(answer(200, statusBody('job-1', 'error', { errors: ['Slide Builder: chart data was empty'] })), ['Slide Builder: chart data was empty'], 'the Director reports the failure: its words')
  await wording(answer(200, statusBody('job-1', 'cancelled')), [lib.COMPOSE_JOB_GENERIC_MESSAGE], 'cancelled: generic plain words')

  // built at the deadline: one short grace for the poller / socket, then an honest error
  {
    const h = harness(lib)
    h.outcomes['job-1'] = answer(200, statusBody('job-1', 'built', { real_slide_id: 'slide-9' }))
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN)
    check(assert.equal, h.state.jobs['job-1'].status, 'building', 'built: given a moment to land')
    await h.clock.advance(lib.COMPOSE_JOB_FAILSAFE_BUILT_GRACE_MS - 1)
    check(assert.equal, h.state.jobs['job-1'].status, 'building')
    await h.clock.advance(1)
    check(assert.equal, h.state.jobs['job-1'].status, 'error')
    check(assert.deepEqual, h.state.jobs['job-1'].errors, [lib.COMPOSE_JOB_NOT_SHOWN_MESSAGE])
    const g = harness(lib)
    g.outcomes['job-1'] = answer(200, statusBody('job-1', 'built'))
    g.register(makeJob('job-1'))
    await g.clock.advance(5 * MIN)
    g.remove('job-1')
    await g.clock.advance(10 * MIN)
    check(assert.equal, g.failed.length, 0, 'it landed during the grace: no error')
  }

  // ready (or any removal) before the deadline: no error, no record, no more asking
  {
    const h = harness(lib)
    h.register(makeJob('job-1'))
    check(assert.equal, h.records().length, 1)
    await h.clock.advance(4 * MIN)
    h.remove('job-1')
    check(assert.equal, h.records().length, 0, 'the record goes with the job')
    check(assert.equal, h.clock.timers.size, 0, 'the timer goes with the job')
    await h.clock.advance(60 * MIN)
    check(assert.deepEqual, [h.fetches.length, h.failed.length, h.api.fails.length], [0, 0, 0])
  }

  // ready arrives while the re-check is in flight: nothing is overwritten
  {
    const h = harness(lib)
    let release
    h.outcomes['job-1'] = () => new Promise(resolve => { release = () => resolve(answer(200, statusBody('job-1', 'building'))) })
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN)
    check(assert.equal, h.fetches.length, 1)
    h.remove('job-1')
    release(); await tick()
    check(assert.deepEqual, [h.failed.length, h.api.fails.length, Object.keys(h.state.jobs).length], [0, 0, 0], 'a job that finished while we asked is left alone')
  }
  // ... and so does a job that Director's own failure frame already marked, whatever the answer was
  for (const [name, reply] of [['lost', answer(404, {})], ['still building', answer(200, statusBody('job-1', 'building'))]]) {
    const h = harness(lib)
    let release
    h.outcomes['job-1'] = () => new Promise(resolve => { release = () => resolve(reply) })
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN)
    h.update('job-1', { status: 'error', errors: ['Slide Builder said no'] })
    release(); await tick()
    check(assert.deepEqual, h.state.jobs['job-1'].errors, ['Slide Builder said no'], `${name}: the backend's own failure is not replaced`)
    check(assert.equal, h.failed.length, 0, name)
    check(assert.equal, h.clock.timers.size, 0, `${name}: and no new deadline is set for it`)
  }
  // the owner changed (another deck, version or route) while we asked: this controller's answer is dropped
  {
    const h = harness(lib)
    let release
    h.outcomes['job-1'] = () => new Promise(resolve => { release = () => resolve(answer(404, {})) })
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN)
    h.ownerGeneration += 1
    release(); await tick()
    check(assert.equal, h.state.jobs['job-1'].status, 'building', 'a retired owner changes nothing')
    check(assert.equal, h.failed.length, 0)
  }

  // news restarts the clock: a progress frame, or a recovered slide id
  {
    const h = harness(lib)
    h.register(makeJob('job-1'))
    await h.clock.advance(4 * MIN)
    h.update('job-1', { lastProgressText: 'Researching the topic' })
    await h.clock.advance(4 * MIN)
    check(assert.equal, h.fetches.length, 0, 'eight minutes in, but the last news is four minutes old')
    await h.clock.advance(MIN)
    check(assert.equal, h.fetches.length, 1, 'five minutes after the last news')
    check(assert.equal, h.state.jobs['job-1'].status, 'error')
    const g = harness(lib)
    g.register(makeJob('job-1'))
    await g.clock.advance(4 * MIN)
    g.update('job-1', { real_slide_id: 'slide-3' })
    await g.clock.advance(4 * MIN + 59_000)
    check(assert.equal, g.fetches.length, 0, 'a recovered slide id is news too')
    const same = harness(lib)
    same.register(makeJob('job-1', { lastProgressText: 'Building slide…' }))
    await same.clock.advance(4 * MIN)
    same.update('job-1', { lastProgressText: 'Building slide…', target_layout_index: 3 })
    await same.clock.advance(MIN)
    check(assert.equal, same.fetches.length, 1, 'a re-render with nothing new does not extend the deadline')
  }
  // news that lands while we ask: it is not the deadline any more
  {
    const h = harness(lib)
    let release
    h.outcomes['job-1'] = () => new Promise(resolve => { release = () => resolve(answer(404, {})) })
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN)
    h.update('job-1', { lastProgressText: 'Composing' })
    release(); await tick()
    h.outcomes['job-1'] = answer(502, { errors: ['proxy'] })
    check(assert.equal, h.state.jobs['job-1'].status, 'building', 'progress arrived during the question')
    await h.clock.advance(5 * MIN)
    check(assert.equal, h.state.jobs['job-1'].status, 'error', 'a new five minutes without news')
  }
  // the hard cap counts from acceptance whatever else happens
  {
    const h = harness(lib)
    h.register(makeJob('job-1'))
    for (let minute = 4; minute < 25; minute += 4) {
      await h.clock.advance(4 * MIN)
      h.update('job-1', { lastProgressText: `step ${minute}` })
    }
    check(assert.equal, h.state.jobs['job-1'].status, 'building', '24 minutes, still getting news')
    await h.clock.advance(MIN)
    check(assert.equal, h.state.jobs['job-1'].status, 'error', 'but never more than 25 minutes from acceptance')
  }

  // still building at the deadline: alive, so another interval, never past the 25 minute cap from acceptance
  const building = id => answer(200, statusBody(id, 'building'))
  const timersOf = clock => [...clock.timers]
  const recordTimers = clock => {
    const times = []
    const set = clock.setTimer
    clock.setTimer = (callback, ms) => { const timer = set(callback, ms); times.push(timer.at); return timer }
    return times
  }
  {
    const clock = makeClock()
    const start = clock.now
    const scheduled = recordTimers(clock)
    const h = harness(lib, { clock })
    h.outcomes['job-1'] = () => building('job-1')
    h.register(makeJob('job-1'))
    for (const minute of [5, 10, 15, 20]) {
      await h.clock.advance(minute * MIN - (h.clock.now - start) - 1)
      check(assert.equal, h.state.jobs['job-1'].status, 'building', `minute ${minute} - 1 ms: nothing yet`)
      await h.clock.advance(1)
      check(assert.equal, h.fetches.length, minute / 5, `minute ${minute}: asked once more`)
      check(assert.equal, h.state.jobs['job-1'].status, 'building', `minute ${minute}: still building, so not given up on`)
      check(assert.equal, h.clock.timers.size, 1, `minute ${minute}: exactly one deadline timer`)
      check(assert.equal, timersOf(h.clock)[0].at - start, (minute + 5) * MIN, `minute ${minute}: the next deadline is another interval away`)
      check(assert.deepEqual, [h.failed.length, h.api.fails.length, h.disarmed.length], [0, 0, 0], `minute ${minute}: no failure side effect`)
      check(assert.equal, h.records()[0].status, 'building', `minute ${minute}: the record still says building`)
    }
    await h.clock.advance(5 * MIN - 1)
    check(assert.equal, h.state.jobs['job-1'].status, 'building', 'one millisecond before the cap')
    await h.clock.advance(1)
    check(assert.equal, h.fetches.length, 5, 'the cap deadline asks too')
    check(assert.equal, h.state.jobs['job-1'].status, 'error', 'still building at the 25 minute cap: the error card')
    check(assert.deepEqual, h.state.jobs['job-1'].errors, [TIMEOUT])
    check(assert.deepEqual, h.failed, [['job-1', TIMEOUT]])
    check(assert.equal, h.clock.timers.size, 0, 'a failed job holds no timer')
    check(assert.ok, Math.max(...scheduled) - start <= lib.COMPOSE_JOB_FAILSAFE_MAX_MS, 'no deadline was ever set past the cap')
    await h.clock.advance(60 * MIN)
    check(assert.equal, h.fetches.length, 5, 'no further asking')
  }
  // a window that does not divide the cap: the last interval is cut short at the cap, never past it
  {
    const clock = makeClock()
    const start = clock.now
    const scheduled = recordTimers(clock)
    const h = harness(lib, { clock })
    h.outcomes['job-1'] = () => building('job-1')
    h.outcomes['job-2'] = () => building('job-2')
    h.register(makeJob('job-1', { target_layout_index: 1 }))
    h.register(makeJob('job-2', { target_layout_index: 2 })) // one pending job ahead: an 8 minute window
    await h.clock.advance(5 * MIN)
    check(assert.equal, h.state.jobs['job-1'].status, 'building')
    h.update('job-1', { status: 'error', errors: ['Slide Builder said no'] })
    await h.clock.advance(3 * MIN)
    check(assert.deepEqual, [h.fetchesFor('job-2').length, h.state.jobs['job-2'].status], [1, 'building'], 'minute 8: rescheduled')
    await h.clock.advance(8 * MIN)
    check(assert.deepEqual, [h.fetchesFor('job-2').length, h.state.jobs['job-2'].status], [2, 'building'], 'minute 16: rescheduled again')
    await h.clock.advance(8 * MIN)
    check(assert.deepEqual, [h.fetchesFor('job-2').length, h.state.jobs['job-2'].status], [3, 'building'], 'minute 24: rescheduled again')
    check(assert.equal, timersOf(h.clock)[0].at - start, 25 * MIN, 'the next deadline is cut to the cap, not minute 32')
    await h.clock.advance(MIN - 1)
    check(assert.equal, h.state.jobs['job-2'].status, 'building')
    await h.clock.advance(1)
    check(assert.deepEqual, [h.fetchesFor('job-2').length, h.state.jobs['job-2'].status], [4, 'error'], 'minute 25: the error card')
    check(assert.deepEqual, h.state.jobs['job-2'].errors, [TIMEOUT])
    check(assert.ok, Math.max(...scheduled) - start <= lib.COMPOSE_JOB_FAILSAFE_MAX_MS, 'no deadline was ever set past the cap')
  }
  // a later answer decides: failed -> its words, lost -> lost, unreachable -> timeout, ready -> the built grace
  {
    const later = async (planned, check2, name) => {
      const h = harness(lib)
      h.outcomes['job-1'] = building('job-1')
      h.register(makeJob('job-1'))
      await h.clock.advance(5 * MIN)
      check(assert.deepEqual, [h.state.jobs['job-1'].status, h.failed.length], ['building', 0], `${name}: first deadline reschedules`)
      h.outcomes['job-1'] = planned
      await h.clock.advance(5 * MIN)
      await check2(h)
    }
    await later(answer(200, statusBody('job-1', 'error', { errors: ['Slide Builder: chart data was empty'] })), h => {
      check(assert.equal, h.state.jobs['job-1'].status, 'error')
      check(assert.deepEqual, h.state.jobs['job-1'].errors, ['Slide Builder: chart data was empty'], 'failed: its own words, at once')
    }, 'failed later')
    await later(answer(404, {}), h => { check(assert.deepEqual, h.state.jobs['job-1'].errors, [LOST], 'lost later') }, 'lost later')
    await later('throw', h => { check(assert.deepEqual, h.state.jobs['job-1'].errors, [TIMEOUT], 'unreachable later: timeout') }, 'unreachable later')
    await later(answer(200, statusBody('job-1', 'built', { real_slide_id: 's1' })), async h => {
      check(assert.equal, h.state.jobs['job-1'].status, 'building', 'ready later: the usual moment to land')
      await h.clock.advance(lib.COMPOSE_JOB_FAILSAFE_BUILT_GRACE_MS)
      check(assert.deepEqual, h.state.jobs['job-1'].errors, [lib.COMPOSE_JOB_NOT_SHOWN_MESSAGE], 'ready later but never shown: honest error after the grace')
    }, 'ready later')
  }
  // ready (the slide lands) during the extra interval: normal, no error, nothing asked again
  {
    const h = harness(lib)
    h.outcomes['job-1'] = building('job-1')
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN)
    check(assert.equal, h.state.jobs['job-1'].status, 'building')
    h.remove('job-1')
    check(assert.deepEqual, [h.records().length, h.clock.timers.size], [0, 0], 'the record and the timer go with the job')
    await h.clock.advance(60 * MIN)
    check(assert.deepEqual, [h.fetches.length, h.failed.length, h.api.fails.length], [1, 0, 0])
  }
  // news during the extra interval restarts the clock from the news
  {
    const h = harness(lib)
    h.outcomes['job-1'] = building('job-1')
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN)
    await h.clock.advance(3 * MIN)
    h.update('job-1', { lastProgressText: 'Composing' })
    await h.clock.advance(2 * MIN)
    check(assert.equal, h.fetches.length, 1, 'minute 10 would have been the deadline, but news came at minute 8')
    await h.clock.advance(3 * MIN)
    check(assert.equal, h.fetches.length, 2, 'five minutes after the news')
    check(assert.equal, h.state.jobs['job-1'].status, 'building')
  }
  // the extra intervals count on: a new owner (version, route) keeps the hard cap from the original acceptance
  {
    const storage = new MemStorage()
    const clock = makeClock()
    const a = harness(lib, { storage, clock })
    a.outcomes['job-1'] = building('job-1')
    a.register(makeJob('job-1'))
    await clock.advance(5 * MIN)
    check(assert.equal, a.state.jobs['job-1'].status, 'building')
    a.controller.dispose()
    const b = harness(lib, { storage, clock, jobs: a.state.jobs })
    b.outcomes['job-1'] = building('job-1')
    b.controller.sync(b.state.jobs)
    await clock.advance(20 * MIN - 1)
    check(assert.equal, b.state.jobs['job-1'].status, 'building', 'minute 25 - 1 ms')
    await clock.advance(1)
    check(assert.equal, b.state.jobs['job-1'].status, 'error', 'the cap counts from the original acceptance')
  }

  // a queue: each pending job ahead earns the next one 3 minutes
  {
    const h = harness(lib)
    h.register(makeJob('job-1', { target_layout_index: 1 }))
    h.register(makeJob('job-2', { target_layout_index: 2 }))
    h.register(makeJob('job-3', { target_layout_index: 3 }))
    await h.clock.advance(5 * MIN)
    check(assert.deepEqual, ['job-1', 'job-2', 'job-3'].map(id => h.state.jobs[id].status), ['error', 'building', 'building'])
    await h.clock.advance(3 * MIN - 1)
    check(assert.equal, h.state.jobs['job-2'].status, 'building')
    await h.clock.advance(1)
    check(assert.deepEqual, ['job-1', 'job-2', 'job-3'].map(id => h.state.jobs[id].status), ['error', 'error', 'building'])
    await h.clock.advance(3 * MIN)
    check(assert.deepEqual, ['job-1', 'job-2', 'job-3'].map(id => h.state.jobs[id].status), ['error', 'error', 'error'])
    check(assert.deepEqual, h.failed.map(([id]) => id), ['job-1', 'job-2', 'job-3'])
  }

  // the backend's own failure frame ends the failsafe's watch on that job
  {
    const h = harness(lib)
    h.register(makeJob('job-1'))
    await h.clock.advance(2 * MIN)
    h.update('job-1', { status: 'error', errors: ['Slide Builder said no'] })
    check(assert.equal, h.clock.timers.size, 0, 'a job the backend failed holds no failsafe timer')
    await h.clock.advance(60 * MIN)
    check(assert.deepEqual, [h.fetches.length, h.failed.length], [0, 0], 'and is never asked about or announced a second time')
    check(assert.deepEqual, h.state.jobs['job-1'].errors, ['Slide Builder said no'])
  }

  // only jobs still waiting count as "ahead": a failed one no longer holds the queue
  {
    const h = harness(lib)
    h.register(makeJob('job-1'))
    h.register(makeJob('job-2'))
    await h.clock.advance(5 * MIN)
    check(assert.deepEqual, [h.state.jobs['job-1'].status, h.state.jobs['job-2'].status], ['error', 'building'])
    h.register(makeJob('job-3'))
    await h.clock.advance(8 * MIN - 1)
    check(assert.equal, h.state.jobs['job-3'].status, 'building', 'one pending job ahead (job-2, itself failing at 8 minutes): 5 + 3 minutes')
    await h.clock.advance(1)
    check(assert.equal, h.state.jobs['job-3'].status, 'error')
  }

  // not this failsafe's business
  {
    const h = harness(lib)
    h.register(makeJob('refine-1', { kind: 'refine' }))
    h.register(makeJob('other-deck', { target_presentation_id: 'pres-9' }))
    await h.clock.advance(60 * MIN)
    check(assert.deepEqual, [h.fetches.length, h.failed.length, h.records().length], [0, 0, 0], 'refine jobs and other decks are left alone')
    check(assert.equal, Object.values(h.state.jobs).every(job => job.status === 'building'), true)
  }

  // a job whose request names the deck owner's session (the Slide panel may) is guarded all the same
  {
    const h = harness(lib)
    h.register(makeJob('owned', { request: { ...makeJob('x').request, session_id: 'sess-deck-owner' } }))
    await h.clock.advance(5 * MIN)
    check(assert.equal, h.state.jobs.owned.status, 'error')
    check(assert.ok, h.fetches[0].includes('session_id=sess-deck-owner'), 'and asked about under the session that owns the job')
  }
  // a new owner (version, template mode, route) starts a new controller: the job keeps its acceptance time and so its hard cap
  {
    const storage = new MemStorage()
    const clock = makeClock()
    const a = harness(lib, { storage, clock })
    a.register(makeJob('job-1'))
    await clock.advance(3 * MIN)
    a.controller.dispose()
    const b = harness(lib, { storage, clock, jobs: a.state.jobs })
    b.controller.sync(b.state.jobs)
    for (let i = 0; i < 5; i++) { await clock.advance(4 * MIN); b.update('job-1', { lastProgressText: `step ${i}` }) }
    check(assert.equal, b.state.jobs['job-1'].status, 'building', 'minute 23, still getting news')
    await clock.advance(MIN)
    check(assert.equal, b.state.jobs['job-1'].status, 'building')
    await clock.advance(MIN)
    check(assert.equal, b.state.jobs['job-1'].status, 'error', 'the 25 minutes count from the original acceptance')
    check(assert.equal, b.records().length, 1)
  }

  // storage blocked: the failsafe still works, it just cannot remember
  {
    const h = harness(lib, { storage: throwingStorage })
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN)
    check(assert.equal, h.state.jobs['job-1'].status, 'error')
  }
  check(assert.deepEqual, unhandled.splice(0).map(String), [], 'no failure escaped a fire-and-forget path')
}

// ---------------------------------------------------------------- controller: persistence and reload
async function reloadSuite(overrides) {
  const lib = loadLib(overrides)
  const ERROR_TEXT = 'Slide Builder: chart data was empty'
  const seed = async (jobs, { advance = 0, setup } = {}) => {
    const storage = new MemStorage()
    const first = harness(lib, { storage })
    setup?.(first)
    for (const job of jobs) first.register(job)
    await first.clock.advance(advance)
    return { storage, first, clock: first.clock }
  }
  const reload = async ({ storage, clock, first }, setup) => {
    first?.controller.dispose() // the old page is gone
    const second = harness(lib, { storage, clock })
    setup?.(second)
    await second.restore()
    return second
  }

  // the record: written at acceptance with the whole request, kept current
  {
    const { storage, first } = await seed([makeJob('job-1')])
    const [stored] = first.records()
    check(assert.equal, stored.job_id, 'job-1')
    check(assert.equal, stored.status, 'building')
    check(assert.equal, stored.accepted_at, first.clock.now)
    check(assert.deepEqual, stored.request, makeJob('job-1').request, 'the request, prompt included, is stored whole')
    check(assert.equal, stored.target_presentation_id, DECK)
    check(assert.equal, storage.getItem('deckster.composeJobFailsafe.v1:sess-1:pres-1') !== null, true, 'per session and deck')
  }

  // reload while pending: one status re-check, then it is pending again, with the prompt, and armed
  {
    const ctx = await seed([makeJob('job-1')], { advance: 2 * MIN })
    const second = await reload(ctx)
    check(assert.deepEqual, second.fetches, [`/api/slides/jobs/job-1?session_id=${SESSION}&presentation_id=${DECK}`], 'exactly one re-check')
    const job = second.state.jobs['job-1']
    check(assert.equal, job.status, 'building', 'back as pending')
    check(assert.equal, job.kind, 'compose')
    check(assert.deepEqual, job.request, makeJob('job-1').request, 'the prompt and every setting come back')
    check(assert.equal, job.request.instruction, PROMPT)
    check(assert.equal, job.title, 'Chart of Q3 revenue by region')
    check(assert.equal, job.target_layout_index, 2)
    check(assert.equal, job.expected_slide_count, Number.MAX_SAFE_INTEGER, 'never confirmed by a slide count taken before the reload')
    check(assert.deepEqual, second.armed, ['job-1'], 'the existing poller is started for it')
    check(assert.equal, second.records().length, 1, 'the record stays while the job lives')
    // the in-deck placeholder is put back once a viewer is ready, and again for each viewer reload
    const viewerA = makeApi()
    second.api = viewerA
    await second.controller.onViewerApi(viewerA)
    check(assert.deepEqual, viewerA.adds, [['job-1', 2]], 'placeholder at its slot')
    check(assert.deepEqual, viewerA.fails, [])
    await second.controller.onViewerApi(viewerA); await second.controller.onViewerApi(viewerA)
    check(assert.equal, viewerA.adds.length, 1, 'the same viewer is not asked again')
    const viewerB = makeApi()
    second.api = viewerB
    await second.controller.onViewerApi(viewerB)
    check(assert.deepEqual, viewerB.adds, [['job-1', 2]], 'a reloaded viewer gets it again')
    await second.controller.onViewerApi(null)
    check(assert.equal, viewerB.adds.length, 1, 'no viewer, nothing to do')
    // and the deadline still applies: it was accepted 2 minutes ago
    await second.clock.advance(3 * MIN)
    check(assert.equal, second.state.jobs['job-1'].status, 'error', 'five minutes after acceptance, restored or not')
    check(assert.equal, second.fetches.length, 2, 'the deadline asks again, once')
  }

  // the viewer is not ready yet / a command fails: retried a few times, then it waits for the next viewer
  {
    const ctx = await seed([makeJob('job-1')])
    const second = await reload(ctx)
    const flaky = makeApi()
    flaky.addError = new Error('not ready')
    second.api = flaky
    for (let i = 0; i < 3; i++) await second.controller.onViewerApi(flaky)
    check(assert.equal, flaky.adds.length, 0)
    flaky.addError = null
    await second.controller.onViewerApi(flaky)
    check(assert.deepEqual, flaky.adds, [['job-1', 2]], 'it gets there once the viewer answers')
    const dead = makeApi()
    dead.addError = new Error('never ready')
    second.api = dead
    for (let i = 0; i < 40; i++) await second.controller.onViewerApi(dead)
    check(assert.equal, dead.attempts, 8, 'bounded: eight tries per viewer, no endless loop')
    const fresh = makeApi()
    second.api = fresh
    await second.controller.onViewerApi(fresh)
    check(assert.deepEqual, fresh.adds, [['job-1', 2]], 'the next viewer starts clean')
  }

  // the answer decides what comes back
  const outcomeCase = async (name, planned, expect) => {
    const ctx = await seed([makeJob('job-1')], { advance: MIN })
    const second = await reload(ctx, h => { h.outcomes['job-1'] = planned })
    const job = second.state.jobs['job-1']
    expect(job, second, ctx)
    check(assert.equal, second.fetches.length, 1, `${name}: one re-check`)
  }
  await outcomeCase('built while away', answer(200, statusBody('job-1', 'built', { real_slide_id: 's1' })), (job, second) => {
    check(assert.equal, job, undefined, 'the slide landed: no card')
    check(assert.equal, second.records().length, 0, 'and no record')
    check(assert.deepEqual, second.armed, [])
  })
  await outcomeCase('failed while away', answer(200, statusBody('job-1', 'error', { errors: [ERROR_TEXT] })), (job, second) => {
    check(assert.equal, job.status, 'error')
    check(assert.deepEqual, job.errors, [ERROR_TEXT], "the backend's words")
    check(assert.deepEqual, second.armed, [], 'a failed job is not polled')
    check(assert.equal, job.request.instruction, PROMPT, 'Retry still has the prompt')
  })
  await outcomeCase('cancelled while away', answer(200, statusBody('job-1', 'cancelled')), job => {
    check(assert.equal, job.status, 'error')
    check(assert.deepEqual, job.errors, [lib.COMPOSE_JOB_GENERIC_MESSAGE])
  })
  await outcomeCase('unknown to the Director', answer(404, {}), (job, second) => {
    check(assert.equal, job.status, 'error', 'never silently gone')
    check(assert.deepEqual, job.errors, [lib.COMPOSE_JOB_LOST_MESSAGE])
    check(assert.deepEqual, second.armed, [])
  })
  await outcomeCase('route unreachable', 'throw', (job, second) => {
    check(assert.equal, job.status, 'building', "can't tell: stays pending, the deadline decides")
    check(assert.deepEqual, second.armed, ['job-1'])
  })
  await outcomeCase('route 500', answer(500, {}), job => { check(assert.equal, job.status, 'building') })
  await outcomeCase('still building', answer(200, statusBody('job-1', 'building')), job => { check(assert.equal, job.status, 'building') })

  // an error card survives a reload too, until Dismiss / Retry
  {
    const ctx = await seed([makeJob('job-1')], { advance: 5 * MIN })
    check(assert.equal, ctx.first.state.jobs['job-1'].status, 'error')
    const second = await reload(ctx)
    check(assert.equal, second.state.jobs['job-1'].status, 'error')
    check(assert.deepEqual, second.state.jobs['job-1'].errors, [lib.COMPOSE_JOB_TIMEOUT_MESSAGE], 'same plain words')
    check(assert.equal, second.state.jobs['job-1'].request.instruction, PROMPT)
    check(assert.deepEqual, second.armed, [])
    const viewer = makeApi()
    second.api = viewer
    await second.controller.onViewerApi(viewer)
    check(assert.deepEqual, [viewer.adds, viewer.fails], [[['job-1', 2]], ['job-1']], 'the failed placeholder is drawn: added, then marked failed')
    // ... unless it turned out to have landed after all
    const third = await reload(ctx, h => { h.outcomes['job-1'] = answer(200, statusBody('job-1', 'built')) })
    check(assert.equal, third.state.jobs['job-1'], undefined, 'a late success wins')
    check(assert.equal, third.records().length, 0)
  }

  // several records: oldest first, slots follow the rail's order
  {
    const ctx = await seed([
      makeJob('job-a', { target_layout_index: 3, target_visual_index: 3 }),
      makeJob('job-b', { target_layout_index: 3, target_visual_index: 4 }),
      makeJob('job-c', { target_layout_index: 1, target_visual_index: 1 }),
    ], { advance: MIN })
    const second = await reload(ctx)
    check(assert.equal, second.fetches.length, 3, 'one re-check per record')
    check(assert.deepEqual, Object.keys(second.state.jobs).sort(), ['job-a', 'job-b', 'job-c'])
    const viewer = makeApi()
    second.api = viewer
    await second.controller.onViewerApi(viewer)
    check(assert.deepEqual, viewer.adds, [['job-c', 1], ['job-a', 4], ['job-b', 5]], 'ascending, each after the ones before it')
    check(assert.deepEqual, ['job-a', 'job-b', 'job-c'].map(id => second.state.jobs[id].target_visual_index), [4, 5, 1])
  }

  // hand-written records: words for a failure without any, and oldest first whatever the stored order
  {
    const storage = new MemStorage()
    const probe = harness(lib, { storage })
    const raw = (id, over) => ({ v: 1, job_id: id, status: 'building', title: id, accepted_at: 0, target_layout_index: 1, target_visual_index: 1, target_presentation_id: DECK, request: { session_id: SESSION, instruction: PROMPT }, ...over })
    storage.setItem(probe.key, JSON.stringify([
      raw('late', { accepted_at: probe.clock.now - MIN }),
      raw('early', { accepted_at: probe.clock.now - 3 * MIN }),
      raw('failed', { accepted_at: probe.clock.now - 2 * MIN, status: 'error' }),
    ]))
    const second = harness(lib, { storage, clock: probe.clock })
    await second.restore()
    check(assert.deepEqual, second.armed, ['early', 'late'], 'oldest first')
    check(assert.deepEqual, second.state.jobs.failed.errors, [lib.COMPOSE_JOB_GENERIC_MESSAGE], 'a stored failure without words still has plain words')
    check(assert.equal, second.state.jobs.failed.status, 'error')
  }

  // a viewer that was ready before the restore finished is still told
  {
    const ctx = await seed([makeJob('job-1')])
    ctx.first.controller.dispose()
    const second = harness(lib, { storage: ctx.storage, clock: ctx.clock })
    const viewer = makeApi()
    second.api = viewer
    await second.controller.onViewerApi(viewer) // nothing to draw yet
    check(assert.equal, viewer.adds.length, 0)
    await second.restore()
    await second.controller.onViewerApi(viewer) // the same, already-ready viewer
    check(assert.deepEqual, viewer.adds, [['job-1', 2]], 'a viewer that was already ready gets the restored placeholder')
  }

  // a queue restored in one go keeps its order: 5, 8 and 11 minutes after acceptance
  {
    const ctx = await seed([makeJob('job-a'), makeJob('job-b'), makeJob('job-c')])
    const second = await reload(ctx)
    check(assert.deepEqual, second.armed.sort(), ['job-a', 'job-b', 'job-c'])
    await second.clock.advance(5 * MIN)
    check(assert.deepEqual, ['job-a', 'job-b', 'job-c'].map(id => second.state.jobs[id].status), ['error', 'building', 'building'])
    await second.clock.advance(3 * MIN)
    check(assert.deepEqual, ['job-a', 'job-b', 'job-c'].map(id => second.state.jobs[id].status), ['error', 'error', 'building'])
    await second.clock.advance(3 * MIN)
    check(assert.deepEqual, ['job-a', 'job-b', 'job-c'].map(id => second.state.jobs[id].status), ['error', 'error', 'error'])
  }

  // already past its deadline when the page comes back: decided from the one re-check, no second question
  {
    const oldJob = async minutes => {
      const storage = new MemStorage()
      const clock = makeClock()
      const old = harness(lib, { storage, clock })
      old.register(makeJob('job-2'))
      old.controller.dispose() // the tab went away with the job still pending
      await clock.advance(minutes * MIN)
      return { storage, clock, key: old.key }
    }
    const building = h => { h.outcomes['job-2'] = answer(200, statusBody('job-2', 'building')) }
    // twenty minutes old and the Director still says "building": alive, so no card yet; asked once more at the cap
    const alive = await oldJob(20)
    const second = await reload(alive, building)
    check(assert.equal, second.fetchesFor('job-2').length, 1, 'one question, not two')
    await second.clock.advance(0)
    check(assert.equal, second.state.jobs['job-2'].status, 'building', 'twenty minutes old but still "building": not given up on')
    check(assert.equal, second.fetchesFor('job-2').length, 1, 'still one question')
    check(assert.equal, second.failed.length, 0)
    await second.clock.advance(5 * MIN)
    check(assert.equal, second.fetchesFor('job-2').length, 2, 'asked again at the cap, once')
    check(assert.equal, second.state.jobs['job-2'].status, 'error', 'and an error card at the 25 minute cap')
    check(assert.deepEqual, second.state.jobs['job-2'].errors, [lib.COMPOSE_JOB_TIMEOUT_MESSAGE])
    // past the cap when the page comes back and still "building": an error card now, from the one question
    const past = await oldJob(26)
    const third = await reload(past, building)
    await third.clock.advance(0)
    check(assert.equal, third.fetchesFor('job-2').length, 1, 'one question')
    check(assert.equal, third.state.jobs['job-2'].status, 'error', 'twenty-six minutes old and still "building": an error card now')
    check(assert.deepEqual, third.state.jobs['job-2'].errors, [lib.COMPOSE_JOB_TIMEOUT_MESSAGE])
    const lost = await oldJob(20)
    const fourth = await reload(lost, h => { h.outcomes['job-2'] = answer(404, {}) })
    await fourth.clock.advance(0)
    check(assert.deepEqual, fourth.state.jobs['job-2'].errors, [lib.COMPOSE_JOB_LOST_MESSAGE], 'and "lost" when the Director has never heard of it')
  }

  // ready after restore: normal
  {
    const ctx = await seed([makeJob('job-1')], { advance: MIN })
    const second = await reload(ctx)
    check(assert.equal, second.state.jobs['job-1'].status, 'building')
    second.remove('job-1') // the page's slide_ready path ends by removing the job
    check(assert.equal, second.records().length, 0, 'the record is gone')
    check(assert.equal, second.clock.timers.size, 0, 'and the timer')
    await second.clock.advance(60 * MIN)
    check(assert.deepEqual, [second.failed.length, second.fetches.length], [0, 1], 'never fails afterwards, never asks again')
    const third = await reload(ctx)
    check(assert.deepEqual, [Object.keys(third.state.jobs).length, third.fetches.length], [0, 0], 'a later reload has nothing to restore')
  }
  // a late ready after the error card appeared heals it the same way
  {
    const ctx = await seed([makeJob('job-1')], { advance: 5 * MIN })
    ctx.first.remove('job-1')
    check(assert.equal, ctx.first.records().length, 0)
    const second = await reload(ctx)
    check(assert.equal, Object.keys(second.state.jobs).length, 0)
  }

  // scoping
  {
    const storage = new MemStorage()
    const other = harness(lib, { storage, sessionId: 'sess-9', presentationId: 'pres-9' })
    other.register(makeJob('theirs', { request: { ...makeJob('x').request, session_id: 'sess-9' }, target_presentation_id: 'pres-9' }))
    const before = storage.getItem(other.key)
    const mine = harness(lib, { storage })
    await mine.restore()
    mine.register(makeJob('job-1'))
    mine.remove('job-1')
    check(assert.deepEqual, [mine.fetches.length, Object.keys(mine.state.jobs).length], [0, 0], 'another deck record is not restored')
    check(assert.equal, storage.getItem(other.key), before, 'and not touched')
    // a record that is already on screen is not asked about or duplicated
    const live = harness(lib, { storage })
    live.register(makeJob('job-1'))
    live.controller.dispose()
    const again = harness(lib, { storage, jobs: { 'job-1': makeJob('job-1') } })
    await again.restore()
    check(assert.equal, again.fetches.length, 0)
  }
  // blocked storage: restore is a no-op, never an exception
  {
    const h = harness(lib, { storage: throwingStorage })
    await h.restore()
    check(assert.deepEqual, [h.fetches.length, Object.keys(h.state.jobs).length], [0, 0])
  }
  // the owner changed while the re-checks were out: nothing is applied
  {
    const ctx = await seed([makeJob('job-1')])
    const second = harness(lib, { storage: ctx.storage, clock: ctx.clock })
    let release
    second.outcomes['job-1'] = () => new Promise(resolve => { release = () => resolve(answer(200, statusBody('job-1', 'building'))) })
    const pending = second.controller.restore()
    await tick()
    second.ownerGeneration += 1
    release(); await pending; await tick()
    check(assert.deepEqual, [Object.keys(second.state.jobs).length, second.armed.length], [0, 0])
    check(assert.equal, second.records().length, 1, 'the record is kept for the owner that is current')
  }
  check(assert.deepEqual, unhandled.splice(0).map(String), [], 'no failure escaped a fire-and-forget path')
}

// ---------------------------------------------------------------- controller: Retry keeps the prompt, Dismiss
async function retryDismissSuite(overrides) {
  const lib = loadLib(overrides)

  // Retry: the page's own handleRetrySlideCompose swaps the failed job for a new one carrying the same request
  const pageRetry = (existing, nextId) => ({
    ...existing, job_id: nextId, status: 'building', errors: undefined,
    request: { ...existing.request, job_id: nextId, async: true, assume_on_missing: true },
  })
  {
    const storage = new MemStorage()
    const h = harness(lib, { storage })
    h.register(makeJob('job-1'))
    await h.clock.advance(5 * MIN)
    const failed = h.state.jobs['job-1']
    check(assert.equal, failed.status, 'error')
    const { 'job-1': _old, ...rest } = h.state.jobs
    const retried = pageRetry(failed, 'job-2')
    h.state.jobs = { ...rest, 'job-2': retried }
    h.controller.sync(h.state.jobs)
    check(assert.deepEqual, h.records().map(r => [r.job_id, r.status]), [['job-2', 'building']], 'the failed record is replaced by the retry')
    check(assert.equal, h.records()[0].request.instruction, PROMPT, 'the prompt is kept for Retry')
    check(assert.deepEqual, h.records()[0].request.selections, makeJob('x').request.selections, 'so is every setting')
    check(assert.equal, h.records()[0].errors, undefined, 'the failure text does not travel to the new job')
    await h.clock.advance(4 * MIN + 59_000)
    check(assert.equal, h.state.jobs['job-2'].status, 'building', 'a fresh deadline for the retry')
    await h.clock.advance(1_000)
    check(assert.equal, h.state.jobs['job-2'].status, 'error', 'and it can fail the same way again, with the prompt still there')
    check(assert.equal, h.state.jobs['job-2'].request.instruction, PROMPT)
    // reload after the failure: Retry is still possible with the same prompt
    const second = harness(lib, { storage, clock: h.clock })
    await second.restore()
    check(assert.equal, second.state.jobs['job-2'].request.instruction, PROMPT)
    check(assert.equal, pageRetry(second.state.jobs['job-2'], 'job-3').request.instruction, PROMPT, 'Retry after a reload re-sends the prompt')
  }

  // Dismiss
  {
    const storage = new MemStorage()
    const h = harness(lib, { storage })
    h.register(makeJob('job-1', { target_layout_index: 1, target_visual_index: 9 }))
    h.register(makeJob('job-2', { target_layout_index: 3, target_visual_index: 3 }))
    await h.clock.advance(5 * MIN)
    check(assert.equal, h.state.jobs['job-1'].status, 'error')
    check(assert.equal, h.state.jobs['job-2'].status, 'building')
    h.controller.dismiss('job-2') // still pending: not dismissable
    h.controller.dismiss('nope')
    check(assert.deepEqual, [Object.keys(h.state.jobs).length, h.dismissed.length], [2, 0], 'only a failed card can be dismissed')
    h.controller.dismiss('job-1')
    check(assert.equal, h.state.jobs['job-1'], undefined, 'the card is removed')
    check(assert.deepEqual, h.records().map(r => r.job_id), ['job-2'], 'its record goes at once, the other stays')
    check(assert.deepEqual, h.dismissed, [['job-1', 1]], 'the page is told where it sat (its real slot, not a stale one), once')
    check(assert.ok, h.disarmed.includes('job-1'))
    h.controller.dismiss('job-1')
    check(assert.equal, h.dismissed.length, 1, 'twice does nothing')
    await tick()
    // the viewer reloads: the surviving job's placeholder comes back, the dismissed one does not
    const viewer = makeApi()
    h.api = viewer
    await h.controller.onViewerApi(viewer)
    check(assert.deepEqual, viewer.adds, [['job-2', 3]], 'the pending job is put back; the dismissed one is not')
    // a dismissed card is not restored by a reload
    const second = harness(lib, { storage, clock: h.clock })
    await second.restore()
    check(assert.deepEqual, Object.keys(second.state.jobs), ['job-2'])
    // dismissing a card that sat before the others moves their slots up
    const third = harness(lib, { storage: new MemStorage() })
    third.register(makeJob('a', { target_layout_index: 2 }))
    third.register(makeJob('b', { target_layout_index: 2 }))
    await third.clock.advance(5 * MIN)
    third.controller.dismiss('a')
    check(assert.deepEqual, third.dismissed, [['a', 2]])
  }
  // a card the backend failed (no failsafe involved): its poller is stopped on Dismiss
  {
    const h = harness(lib)
    h.register(makeJob('x', { status: 'error', errors: ['Slide Builder said no'] }))
    h.controller.dismiss('x')
    check(assert.deepEqual, h.disarmed, ['x'])
    check(assert.deepEqual, h.dismissed, [['x', 2]])
  }
  // the state update lands a little after Dismiss: a viewer that reloads in between is not given the dismissed card back
  {
    const h = harness(lib)
    h.register(makeJob('keep', { target_layout_index: 3 }))
    h.register(makeJob('gone', { status: 'error', errors: ['x'], target_layout_index: 1 }))
    h.deferJobs = true
    h.controller.dismiss('gone')
    const viewer = makeApi()
    h.api = viewer
    await h.controller.onViewerApi(viewer)
    check(assert.deepEqual, viewer.adds.map(([id]) => id), ['keep'], 'only the survivor is drawn')
    h.flushJobs()
  }
  // Dismiss of a failed card from another deck: removed, no viewer reload
  {
    const h = harness(lib)
    h.register(makeJob('far', { status: 'error', errors: ['x'], target_presentation_id: 'pres-9' }))
    h.controller.dismiss('far')
    check(assert.deepEqual, [Object.keys(h.state.jobs).length, h.dismissed.length], [0, 0])
  }
  check(assert.deepEqual, unhandled.splice(0).map(String), [], 'no failure escaped a fire-and-forget path')
}

// ---------------------------------------------------------------- the real hook, on a tiny hook runtime
function hookRuntime() {
  let current = null
  const impl = {
    useRef: (...args) => current.useRef(...args),
    useCallback: (...args) => current.useCallback(...args),
    useEffect: (...args) => current.useEffect(...args),
  }
  function instance(call) {
    let cursor = 0, slots = [], pending = []
    const hooks = {
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
      useCallback(fn, deps) {
        const i = cursor++, old = slots[i]
        if (old && deps.length === old.deps.length && deps.every((dep, n) => dep === old.deps[n])) return old.fn
        slots[i] = { fn, deps }
        return fn
      },
      useEffect(callback, deps) {
        const i = cursor++, old = slots[i]
        if (!old || deps.length !== old.deps.length || deps.some((dep, n) => dep !== old.deps[n])) {
          const next = { deps, cleanup: old?.cleanup }
          slots[i] = next
          pending.push(() => { next.cleanup?.(); next.cleanup = callback() })
        }
      },
    }
    return {
      render(props) {
        current = hooks; cursor = 0; pending = []
        let result
        try { result = call(props) } finally { current = null }
        for (const effect of pending) effect()
        return result
      },
      unmount() { for (const slot of slots) if (slot && typeof slot.cleanup === 'function') slot.cleanup() },
    }
  }
  return { impl, instance }
}

async function hookSuite(overrides) {
  const runtime = hookRuntime()
  const log = { storage: [], fetch: [], timers: [], intervals: [], cleared: [], clearedIntervals: [] }
  const storage = new MemStorage()
  const clock = makeClock()
  const win = {
    get sessionStorage() { log.storage.push('access'); return storage },
    setTimeout: (callback, ms) => { log.timers.push(ms); return clock.setTimer(callback, ms) },
    clearTimeout: handle => { log.cleared.push(handle); clock.clearTimer(handle) },
    setInterval: (callback, ms) => { const id = { callback, ms }; log.intervals.push(id); return id },
    clearInterval: id => { log.clearedIntervals.push(id) },
  }
  const fetchImpl = async url => { log.fetch.push(url); return answer(502, { errors: ['proxy'] }) }
  const world = createWorld({ env: { [FLAG]: 'true' }, overrides, stubs: { react: runtime.impl }, globals: { window: win, fetch: fetchImpl } })
  const hookModule = world.load(FILES.hook)
  const lib = world.load(FILES.lib)

  const state = { jobs: {} }
  const calls = { armed: [], failed: [], dismissed: [] }
  const props = (over = {}) => ({
    enabled: true, sessionId: SESSION, presentationId: DECK, ownerKey: 'owner-1', jobs: state.jobs,
    setJobs: update => { state.jobs = typeof update === 'function' ? update(state.jobs) : update },
    getViewerApi: () => null, captureOwner: () => () => true,
    armJob: job => calls.armed.push(job.job_id), disarmJob() {}, onFailed: (job, message) => calls.failed.push([job.job_id, message]),
    onDismissed: (job, index) => calls.dismissed.push([job.job_id, index]), ...over,
  })
  const card = { jobId: 'job-1', kind: 'compose', status: 'error', title: 'T' }

  // flag off: inert. No storage, no request, no timer, cards untouched.
  {
    const off = runtime.instance(p => hookModule.useStudioComposeJobFailsafe(p))
    storage.setItem(lib.composeJobFailsafeKey(SESSION, DECK), JSON.stringify([{ v: 1, job_id: 'x', status: 'building', title: 'T', accepted_at: 1, target_layout_index: 0, target_visual_index: 0, target_presentation_id: DECK, request: { session_id: SESSION } }]))
    state.jobs = { 'job-1': makeJob('job-1') }
    const api = off.render(props({ enabled: false, jobs: state.jobs }))
    off.render(props({ enabled: false, jobs: state.jobs }))
    await clock.advance(60 * MIN)
    check(assert.deepEqual, [log.storage.length, log.fetch.length, log.timers.length, log.intervals.length], [0, 0, 0, 0], 'flag off: no storage access, no request, no timer')
    check(assert.equal, api.decorate(card, state.jobs['job-1']), card, 'flag off: the card comes back untouched')
    check(assert.equal, state.jobs['job-1'].status, 'building', 'flag off: nothing fails')
    off.unmount()
    storage.removeItem(lib.composeJobFailsafeKey(SESSION, DECK))
  }

  // flag on: a controller per scope, restore at start, cleaned up on unmount or scope change
  {
    log.fetch.length = 0; log.timers.length = 0; log.intervals.length = 0; log.clearedIntervals.length = 0
    state.jobs = {}
    const key = lib.composeJobFailsafeKey(SESSION, DECK)
    storage.setItem(key, JSON.stringify([{ v: 1, job_id: 'job-9', status: 'building', title: 'T', accepted_at: clock.now - MIN, target_layout_index: 2, target_visual_index: 2, target_presentation_id: DECK, request: { session_id: SESSION, instruction: PROMPT } }]))
    const on = runtime.instance(p => hookModule.useStudioComposeJobFailsafe(p))
    const api = on.render(props())
    await tick(); await tick()
    check(assert.equal, log.storage.length > 0, true, 'flag on: the session storage is used')
    check(assert.deepEqual, log.fetch, [`/api/slides/jobs/job-9?session_id=${SESSION}&presentation_id=${DECK}`], 'flag on: the stored record is re-checked once')
    check(assert.equal, state.jobs['job-9']?.status, 'building', 'flag on: restored as pending')
    check(assert.deepEqual, calls.armed, ['job-9'])
    check(assert.equal, log.intervals.length, 1, 'one viewer watcher')
    const decorated = api.decorate(card, { errors: [lib.COMPOSE_JOB_TIMEOUT_MESSAGE] })
    check(assert.equal, decorated.failureCaption, lib.COMPOSE_JOB_TIMEOUT_CAPTION)
    check(assert.equal, typeof decorated.onDismiss, 'function')
    // the same scope again: no new controller
    on.render(props({ jobs: state.jobs }))
    check(assert.equal, log.intervals.length, 1, 'same scope: same controller')
    // a new owner key (deck, version or route changed): the old controller is retired, a new one starts
    on.render(props({ jobs: state.jobs, ownerKey: 'owner-2' }))
    check(assert.equal, log.intervals.length, 2, 'new owner: new controller')
    check(assert.equal, log.clearedIntervals.length, 1, 'new owner: the old watcher is cleared')
    // a session that is not real yet starts nothing
    on.render(props({ jobs: state.jobs, sessionId: 'new', ownerKey: 'owner-3' }))
    check(assert.equal, log.intervals.length, 2, 'no real session: no controller')
    on.render(props({ jobs: state.jobs, presentationId: null, ownerKey: 'owner-4' }))
    check(assert.equal, log.intervals.length, 2, 'no deck: no controller')
    on.render(props({ jobs: state.jobs, ownerKey: 'owner-5' }))
    check(assert.equal, log.intervals.length, 3)
    // a job that appears after the controller started is guarded too
    state.jobs = { ...state.jobs, 'job-7': makeJob('job-7') }
    on.render(props({ jobs: state.jobs, ownerKey: 'owner-5' }))
    await clock.advance(8 * MIN) // 5 minutes + 3 for the restored job-9 ahead of it
    check(assert.equal, state.jobs['job-7'].status, 'error', 'the hook syncs new jobs into the controller')
    check(assert.ok, log.fetch.some(url => url.includes('/job-7?')), 'and asks the status route at its deadline')
    // dismiss reaches the controller; unmount cleans up
    state.jobs = { ...state.jobs, 'job-1': makeJob('job-1', { status: 'error', errors: ['x'] }) }
    const live = on.render(props({ jobs: state.jobs, ownerKey: 'owner-5' }))
    live.dismiss('job-1')
    check(assert.equal, state.jobs['job-1'], undefined, 'dismiss through the hook')
    check(assert.equal, calls.dismissed.length, 1)
    state.jobs = { ...state.jobs, 'job-8': makeJob('job-8') }
    on.render(props({ jobs: state.jobs, ownerKey: 'owner-5' }))
    check(assert.equal, clock.timers.size, 1, 'a pending job holds its deadline timer')
    on.unmount()
    check(assert.equal, log.clearedIntervals.length, 3, 'unmount: watcher cleared')
    check(assert.equal, clock.timers.size, 0, 'unmount: deadline timers cleared')
  }
  check(assert.deepEqual, unhandled.splice(0).map(String), [], 'no failure escaped a fire-and-forget path')
}

// ---------------------------------------------------------------- the real rail strip, server-rendered
function stripWorld(overrides, { shell = true } = {}) {
  const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: shell ? 'true' : 'false' }
  const stubs = { '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: { isAllowed: () => false } } }
  return createWorld({ env, overrides, stubs }).load(FILES.strip).SlideThumbnailStrip
}
const renderStrip = (Strip, composeJobs, extra = {}) => renderToStaticMarkup(React.createElement(Strip, {
  slides: [{ slideNumber: 1, slideId: 's1', title: 'One' }], currentSlide: 1, onSlideClick() {}, orientation: 'vertical', totalSlides: 1, composeJobs, ...extra }))

function stripSuite(overrides) {
  const lib = loadLib(overrides)
  for (const shell of [true, false]) {
    for (const orientation of ['vertical', 'horizontal']) {
      const Strip = stripWorld(overrides, { shell })
      const retries = [], dismissals = []
      const failed = { jobId: 'job-1', targetIndex: 1, targetLayoutIndex: 1, kind: 'compose', status: 'error', title: 'Chart of Q3', errors: [lib.COMPOSE_JOB_TIMEOUT_MESSAGE],
        onRetry: id => retries.push(id), failureCaption: lib.COMPOSE_JOB_TIMEOUT_CAPTION, onDismiss: id => dismissals.push(id) }
      const html = renderStrip(Strip, [failed], { orientation })
      const tag = `shell ${shell} ${orientation}`
      check(assert.match, html, /data-compose-status="error"/, tag)
      check(assert.ok, html.includes(`>${lib.COMPOSE_JOB_TIMEOUT_CAPTION}<`), `${tag}: the plain caption is on the card`)
      check(assert.doesNotMatch, html, />Retry compose</, `${tag}: replaced by the plain caption`)
      check(assert.equal, (html.match(/data-compose-failsafe-action="retry"/g) ?? []).length, 1, `${tag}: a visible Retry`)
      check(assert.equal, (html.match(/data-compose-failsafe-action="dismiss"/g) ?? []).length, 1, `${tag}: a visible Dismiss`)
      check(assert.match, html, />Retry</, tag)
      check(assert.match, html, />Dismiss</, tag)
      check(assert.match, html, /aria-label="Dismiss failed slide 2"/, `${tag}: numbered`)
      check(assert.match, html, /aria-label="Retry slide 2"/, tag)

      // a pending card has no actions
      const pending = renderStrip(Strip, [{ ...failed, status: 'building', errors: undefined, failureCaption: undefined }], { orientation })
      check(assert.doesNotMatch, pending, /data-compose-failsafe/, `${tag}: pending card unchanged`)
      check(assert.match, pending, /data-compose-status="building"/, tag)

      // flag off shape (no caption, no dismiss): today's card, no new markup
      const plain = renderStrip(Strip, [{ ...failed, failureCaption: undefined, onDismiss: undefined }], { orientation })
      check(assert.doesNotMatch, plain, /data-compose-failsafe/, `${tag}: no new markup without the flag`)
      check(assert.equal, shell ? plain.includes('Retry compose') : plain.includes('Retry compose'), true, `${tag}: today's caption`)
      const noRetry = renderStrip(Strip, [{ ...failed, failureCaption: undefined, onDismiss: undefined, onRetry: undefined }], { orientation })
      check(assert.equal, noRetry.includes(shell ? 'Compose failed' : 'Retry compose'), true, `${tag}: today's caption without a retry`)
    }
  }
}

// ---------------------------------------------------------------- page wiring and flag-off identity pins
function guardSuite(sources = {}) {
  const page = sources.page ?? SRC.page
  const strip = sources.strip ?? SRC.strip
  const hook = sources.hook ?? SRC.hook
  const env = sources.env ?? ENVEX
  const pkg = sources.pkg ?? PKG
  const retryStart = page.indexOf('const handleRetrySlideCompose = useCallback(')
  const retry = page.slice(retryStart, page.indexOf('const handleSelectPendingSlideCompose', retryStart))

  // the page: one import, one hook call, the flag is the module constant, the cards pass through decorate
  check(assert.match, page, /import \{\s*COMPOSE_JOB_FAILSAFE_TOAST_TITLE,\s*STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED,\s*\} from '@\/lib\/studio-compose-job-failsafe'/)
  check(assert.match, page, /import \{ useStudioComposeJobFailsafe \} from '@\/hooks\/use-studio-compose-job-failsafe'/)
  check(assert.equal, (page.match(/useStudioComposeJobFailsafe\(/g) ?? []).length, 1, 'one call site')
  check(assert.match, page, /enabled: STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED,/)
  check(assert.match, page, /\.map\(job => composeFailsafe\.decorate\(\{/)
  check(assert.match, page, /\}, job\)\),\s*\n\s*\[composeFailsafe\.decorate, handleRetrySlideCompose/)
  check(assert.match, page, /jobs: slideComposeJobs,\s*\n\s*setJobs: setSlideComposeJobs,/)
  check(assert.match, page, /captureOwner: captureStudioSlideComposeOwner,/)
  check(assert.match, page, /armJob: job => startSlideComposePoller\(job\.job_id\),/)
  check(assert.match, page, /ownerKey: studioSlideComposeOwnerKey,/)
  check(assert.match, page, /presentationId: effectivePresentationId,\s*\n\s*ownerKey/)
  // Retry is the page's own path: it re-sends the stored request with only the job id changed
  check(assert.ok, retryStart > 0, 'handleRetrySlideCompose exists')
  check(assert.match, retry, /\.\.\.existing\.request,\s*\n\s*job_id: nextJobId,\s*\n\s*async: true,\s*\n\s*assume_on_missing: true,/)
  check(assert.match, retry, /fetch\('\/api\/slides\/compose', \{\s*\n\s*method: 'POST',/)
  check(assert.match, retry, /body: JSON\.stringify\(retryRequest\)/)
  // the viewer reload for a dismissed card may not be swallowed by the 8 s coalescing; the default is unchanged
  check(assert.match, page, /\(reason: string, options\?: \{ force\?: boolean \}\) => \{\s*\n\s*if \(slideComposeFallbackReloadInFlightRef\.current && !options\?\.force\) return/)
  check(assert.match, page, /triggerCoalescedSlideComposeReload\('compose job dismissed', \{ force: true \}\)/)
  check(assert.match, page, /queueComposeSelectionRestore\(current > visualIndex \? current - 1 : current\)/)
  // refine and the existing watchdog / poller are untouched by this change
  check(assert.match, page, /const startStudioSlideComposeWatchdog = useCallback\(\(jobId: string, reason: string, deadline = Date\.now\(\) \+ SLIDE_COMPOSE_WATCHDOG_MS/)

  // the strip: Dismiss only on an error card that was given onDismiss; the caption falls back to today's
  check(assert.match, strip, /\{isError && job\.onDismiss && \(/)
  check(assert.match, strip, /\{isError \? job\.failureCaption \?\? \(STUDIO_THUMBNAILS && !job\.onRetry \? 'Compose failed' : 'Retry compose'\) : title\}/)
  check(assert.match, strip, /onClick=\{\(\) => job\.onDismiss\?\.\(job\.jobId\)\}/)
  check(assert.match, strip, /onClick=\{\(\) => job\.onRetry\?\.\(job\.jobId\)\}/)

  // the hook: inert unless enabled, scoped to a real session and deck
  check(assert.match, hook, /if \(!enabled \|\| !sessionId \|\| sessionId === 'new' \|\| !presentationId\) return/)
  check(assert.match, hook, /\}, \[enabled, sessionId, presentationId, ownerKey\]\)/)
  check(assert.match, hook, /controller\.dispose\(\)/)
  check(assert.match, hook, /decorateComposeJobCard\(card, job, \{ enabled, onDismiss: dismiss \}\)/)

  // flag documented, default off; test script registered
  check(assert.match, env, /^NEXT_PUBLIC_STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED="false"$/m)
  check(assert.equal, pkg.scripts['test:studio-compose-job-failsafe'], 'node scripts/test-studio-compose-job-failsafe.mjs')
}

async function fullSuite(overrides = {}, only = ['pure', 'timeout', 'reload', 'retry', 'hook', 'strip', 'guard']) {
  if (only.includes('pure')) pureSuite(overrides)
  if (only.includes('timeout')) await timeoutSuite(overrides)
  if (only.includes('reload')) await reloadSuite(overrides)
  if (only.includes('retry')) await retryDismissSuite(overrides)
  if (only.includes('hook')) await hookSuite(overrides)
  if (only.includes('strip')) stripSuite(overrides)
  if (only.includes('guard')) {
    const by = Object.fromEntries(Object.entries(FILES).filter(([, rel]) => rel in overrides).map(([key, rel]) => [key, overrides[rel]]))
    guardSuite(by)
  }
}

// ---------------------------------------------------------------- the real sources
await fullSuite()

// ---------------------------------------------------------------- mutation check: every mutant must be caught
// [name, file key, from, to, suites to run]
const L = 'lib'
const mutants = [
  // flag and window
  ['flag: any value enables', L, "=== 'true'", "!== 'false'", ['pure']],
  ['flag: on by default', L, "=== 'true'", "!== 'never'", ['pure']],
  ['window: base is shorter', L, 'COMPOSE_JOB_FAILSAFE_BASE_MS = 300_000', 'COMPOSE_JOB_FAILSAFE_BASE_MS = 30_000', ['pure', 'timeout']],
  ['window: no allowance for the queue', L, 'COMPOSE_JOB_FAILSAFE_PER_JOB_AHEAD_MS = 180_000', 'COMPOSE_JOB_FAILSAFE_PER_JOB_AHEAD_MS = 0', ['pure', 'timeout']],
  ['window: the cap is gone', L, ', COMPOSE_JOB_FAILSAFE_MAX_MS)\n}', ', Number.MAX_SAFE_INTEGER)\n}', ['pure']],
  ['window: the hard cap does not count from acceptance', L, 'entry.acceptedAt + COMPOSE_JOB_FAILSAFE_MAX_MS)', 'Infinity)', ['timeout']],
  ['window: a queue allowance per job is applied to the wrong jobs', L, "other.status === 'building' && tracked.has(other.job_id)", "other.status === 'building'", ['timeout', 'reload']],
  ['window: ahead counts error jobs too', L, "other.status === 'building' && tracked.has(other.job_id)", 'tracked.has(other.job_id)', ['timeout']],
  ['window: everything gets the base window', L, 'windowMs: composeJobFailsafeWindowMs(pendingAhead),', 'windowMs: composeJobFailsafeWindowMs(0),', ['timeout']],
  ['news: progress does not restart the clock', L, 'if (job.lastProgressText !== entry.progress || job.real_slide_id !== entry.realSlideId) {', 'if (false) {', ['timeout']],
  ['news: a slide id is not news', L, ' || job.real_slide_id !== entry.realSlideId) {', ') {', ['timeout']],
  ['news: any re-render is news', L, 'if (job.lastProgressText !== entry.progress || job.real_slide_id !== entry.realSlideId) {', 'if (true) {', ['timeout']],
  ['news: news during the question is ignored', L, 'if (entry.lastLifeAt !== lifeAtStart) { schedule(jobId); return }', '', ['timeout']],
  // the deadline
  ['deadline: the status is never asked', L, ": await recheck(String(job.request.session_id ?? deps.sessionId), job.target_presentation_id ?? deps.presentationId, jobId)", ': { kind: \'building\' }', ['timeout']],
  ['deadline: asks the wrong deck', L, 'job.target_presentation_id ?? deps.presentationId, jobId)', "'pres-wrong', jobId)", ['timeout']],
  ['deadline: built fails at once', L, 'if (!entry.builtGraceUsed) {', 'if (false) {', ['timeout']],
  ['deadline: built is never an error', L, 'fail(latest, [COMPOSE_JOB_NOT_SHOWN_MESSAGE])', 'schedule(jobId)', ['timeout']],
  ['deadline: lost reads as timeout', L, "outcome.kind === 'missing' ? COMPOSE_JOB_LOST_MESSAGE : COMPOSE_JOB_TIMEOUT_MESSAGE", 'COMPOSE_JOB_TIMEOUT_MESSAGE', ['pure', 'timeout']],
  ['deadline: timeout reads as lost', L, "outcome.kind === 'missing' ? COMPOSE_JOB_LOST_MESSAGE : COMPOSE_JOB_TIMEOUT_MESSAGE", 'COMPOSE_JOB_LOST_MESSAGE', ['pure', 'timeout']],
  // still building at the deadline: reschedule until the hard cap
  ['reschedule: building fails at the first deadline as before', L, "  if (outcome.kind === 'building' && now < acceptedAt + COMPOSE_JOB_FAILSAFE_MAX_MS) return { action: 'reschedule' }\n", '', ['pure', 'timeout', 'reload']],
  ['reschedule: the hard cap is ignored', L, "outcome.kind === 'building' && now < acceptedAt + COMPOSE_JOB_FAILSAFE_MAX_MS", "outcome.kind === 'building'", ['pure', 'timeout']],
  ['reschedule: one more interval at the cap itself', L, 'now < acceptedAt + COMPOSE_JOB_FAILSAFE_MAX_MS', 'now <= acceptedAt + COMPOSE_JOB_FAILSAFE_MAX_MS', ['pure']],
  ['reschedule: the cap counts from now, not from acceptance', L, 'now < acceptedAt + COMPOSE_JOB_FAILSAFE_MAX_MS', 'now < now + COMPOSE_JOB_FAILSAFE_MAX_MS', ['pure', 'timeout']],
  ['reschedule: the cap is shorter than the real one', L, 'now < acceptedAt + COMPOSE_JOB_FAILSAFE_MAX_MS', 'now < acceptedAt + COMPOSE_JOB_FAILSAFE_MAX_MS / 2', ['pure', 'timeout']],
  ['reschedule: an unreachable route is rescheduled', L, "outcome.kind === 'building' && now <", "outcome.kind !== 'missing' && now <", ['pure', 'timeout']],
  ['reschedule: a lost job is rescheduled', L, "outcome.kind === 'building' && now <", "outcome.kind !== 'unreachable' && now <", ['pure', 'timeout']],
  ['reschedule: a failed job is rescheduled', L, "  if (outcome.kind === 'error') return { action: 'fail', errors: outcome.errors }\n  if (outcome.kind === 'building' && now <", "  if (outcome.kind === 'building' && now <", ['pure', 'timeout']],
  ['reschedule: a built job is not handed to the built path', L, "  if (outcome.kind === 'built') return { action: 'built' }\n", '', ['pure', 'timeout']],
  ['reschedule: the controller always fails', L, "if (decision.action === 'reschedule') {", 'if (false) {', ['timeout', 'reload']],
  ['reschedule: the clock is not restarted', L, "      entry.lastLifeAt = deps.now()\n      schedule(jobId)\n      return\n    }\n    fail(latest, decision.errors)", "      schedule(jobId)\n      return\n    }\n    fail(latest, decision.errors)", ['timeout']],
  ['reschedule: no new timer is set', L, "      entry.lastLifeAt = deps.now()\n      schedule(jobId)\n      return\n    }\n    fail(latest, decision.errors)", "      entry.lastLifeAt = deps.now()\n      return\n    }\n    fail(latest, decision.errors)", ['timeout']],
  ['reschedule: the built grace window is reused', L, "      entry.lastLifeAt = deps.now()\n      schedule(jobId)\n      return\n    }\n    fail(latest, decision.errors)", "      entry.lastLifeAt = deps.now()\n      entry.windowMs = COMPOSE_JOB_FAILSAFE_BUILT_GRACE_MS\n      schedule(jobId)\n      return\n    }\n    fail(latest, decision.errors)", ['timeout']],
  ['deadline: the backend failure words are dropped', L, "if (outcome.kind === 'error') return { action: 'fail', errors: outcome.errors }\n", '', ['pure', 'timeout']],
  ['deadline: an unreachable route is left pending', L, "    fail(latest, decision.errors)\n", "    if (outcome.kind === 'unreachable') return\n    fail(latest, decision.errors)\n", ['timeout']],
  ['deadline: a finished job is overwritten', L, "if (disposed || !isOwner() || !latest || latest.status !== 'building' || tracked.get(jobId) !== entry) return", "if (disposed || !isOwner() || tracked.get(jobId) !== entry) return", ['timeout']],
  ['deadline: a failure frame is overwritten', L, "if (disposed || !isOwner() || !latest || latest.status !== 'building' || tracked.get(jobId) !== entry) return", "if (disposed || !isOwner() || !latest || tracked.get(jobId) !== entry) return", ['timeout']],
  ['deadline: a retired owner still acts', L, "if (disposed || !isOwner() || !latest ||", "if (disposed || !latest ||", ['timeout']],
  ['fail: the poller is left running', L, 'deps.disarmJob(job.job_id)\n    deps.setJobs', 'deps.setJobs', ['timeout']],
  ['fail: the in-deck placeholder is left spinning', L, "if (api) void Promise.resolve(api.composePlaceholderFail(job.job_id)).catch(() => undefined)", '', ['timeout']],
  ['fail: the user is not told', L, 'deps.onFailed(job, errors[0])', '', ['timeout']],
  ['fail: the error text is dropped', L, "return { ...previous, [job.job_id]: { ...current, status: 'error', errors } }", "return { ...previous, [job.job_id]: { ...current, status: 'error' } }", ['timeout']],
  ['fail: the job is removed instead of marked', L, "return { ...previous, [job.job_id]: { ...current, status: 'error', errors } }", 'const { [job.job_id]: _gone, ...rest } = previous; return rest as typeof previous', ['timeout']],
  ['scope: refine jobs are guarded', L, "(job.kind ?? 'compose') !== 'refine'\n", 'true\n', ['timeout']],
  ['scope: only the page session is guarded', L, '    && (job.target_presentation_id == null ||', "    && job.request?.session_id === deps.sessionId\n    && (job.target_presentation_id == null ||", ['timeout']],
  ['window: a new owner restarts the hard cap', L, '?? stored.get(jobId)?.accepted_at ?? now', '?? now', ['timeout']],
  ['scope: another deck is guarded', L, '(job.target_presentation_id == null || job.target_presentation_id === deps.presentationId)', 'true', ['timeout']],
  ['gone: a removed job keeps its timer and record', L, 'if (!jobs[jobId]) forget(jobId)', '', ['timeout', 'reload']],
  ['gone: a failed job keeps its timer', L, "if (entry.timer != null) { deps.clearTimer(entry.timer); entry.timer = null }\n        continue", 'continue', ['timeout']],
  // records
  ['record: never written', L, 'if (changed) writeComposeJobRecords(deps.storage, key, [...persisted.values()])', '', ['timeout', 'reload']],
  ['record: the request is not kept', L, '      request: job.request,\n      ...(job.status', '      request: { session_id: job.request.session_id },\n      ...(job.status', ['reload', 'retry']],
  ['record: the failure text is not kept', L, "...(job.status === 'error' && job.errors?.length ? { errors: job.errors } : {}),", '', ['timeout', 'reload']],
  ['record: invalid entries are accepted', L, "if (raw.v !== 1 || typeof raw.job_id !== 'string' || !raw.job_id) return null", '', ['pure']],
  ['record: no session in the request is accepted', L, "if (typeof (request as Record<string, unknown>).session_id !== 'string') return null", '', ['pure']],
  ['record: duplicates are accepted', L, 'if (!record || seen.has(record.job_id)) continue', 'if (!record) continue', ['pure']],
  ['record: no limit', L, '      .slice(-COMPOSE_JOB_RECORD_LIMIT)', '', ['pure']],
  ['record: the oldest are kept', L, '.slice(-COMPOSE_JOB_RECORD_LIMIT)', '.slice(0, COMPOSE_JOB_RECORD_LIMIT)', ['pure']],
  ['record: one key for every deck', L, "return `deckster.composeJobFailsafe.v1:${sessionId ?? 'no-session'}:${presentationId ?? 'no-deck'}`", "return 'deckster.composeJobFailsafe.v1'", ['pure']],
  ['record: an empty list is stored', L, 'if (records.length === 0) { storage.removeItem(key); return }', '', ['pure']],
  ['record: an exception escapes', L, '  } catch { /* storage unavailable or full: the failsafe still runs, the reload just cannot restore */ }', '  } finally { }', ['pure']],
  // status answers
  ['status: 404 is not "missing"', L, "if (status === 404) return { kind: 'missing' }", '', ['pure', 'timeout', 'reload']],
  ['status: built reads as building', L, "if (result.status === 'built') return { kind: 'built' }", "if (result.status === 'built') return { kind: 'building' }", ['pure', 'reload']],
  ['status: another job id is accepted', L, '|| result.job_id !== jobId) return', ') return', ['pure']],
  ['status: a server error reads as building', L, "if (status < 200 || status >= 300) return { kind: 'unreachable' }", "if (status < 200 || status >= 300) return { kind: 'building' }", ['pure']],
  ['status: a failure without words', L, 'errors: result.errors.length > 0 ? result.errors : [COMPOSE_JOB_GENERIC_MESSAGE]', 'errors: result.errors', ['pure', 'reload']],
  // restore
  ['restore: no re-check', L, "outcomes.set(record.job_id, await recheck(String(record.request.session_id), record.target_presentation_id ?? deps.presentationId, record.job_id))", "outcomes.set(record.job_id, { kind: 'building' })", ['reload']],
  ['restore: built still shows a card', L, "if (outcome.kind === 'built') { removeRecord(record.job_id); continue }", '', ['reload']],
  ['restore: built keeps the record', L, "if (outcome.kind === 'built') { removeRecord(record.job_id); continue }", "if (outcome.kind === 'built') continue", ['reload']],
  ['restore: a lost job stays pending', L, "else if (outcome.kind === 'missing') { status = 'error'; errors = [COMPOSE_JOB_LOST_MESSAGE] }", '', ['reload']],
  ['restore: a failed job stays pending', L, "if (outcome.kind === 'error') { status = 'error'; errors = outcome.errors }", "if (false) { status = 'error'; errors = outcome.errors }", ['reload']],
  ['restore: an error card comes back pending', L, "let status: 'building' | 'error' = record.status", "let status: 'building' | 'error' = 'building'", ['reload']],
  ['restore: a late success on an error card is ignored', L, "if (outcome.kind === 'built') { removeRecord(record.job_id); continue } // the slide landed while the page was away", '', ['reload']],
  ['restore: an error card without words', L, "if (status === 'error' && !errors?.length) errors = [COMPOSE_JOB_GENERIC_MESSAGE]", '', ['reload']],
  ['restore: a slide count is trusted', L, 'expected_slide_count: Number.MAX_SAFE_INTEGER,', 'expected_slide_count: 1,', ['reload']],
  ['restore: the poller is not started', L, "if (job.status === 'building') deps.armJob(job)", '', ['reload']],
  ['restore: a failed card is polled', L, "if (job.status === 'building') deps.armJob(job)", 'deps.armJob(job)', ['reload']],
  ['restore: the placeholder is never put back', L, 'debt.add(job.job_id)\n', '', ['reload']],
  ['restore: the viewer is not told to look', L, '    apiDirty = true\n  }\n\n  async function runPlaceholders', '  }\n\n  async function runPlaceholders', ['reload']],
  ['restore: the slots ignore the rail order', L, 'target_visual_index: ranks.get(job.job_id) ?? job.target_visual_index }', 'target_visual_index: job.target_visual_index }', ['reload']],
  ['restore: on-screen jobs are asked about again', L, '.filter(record => !onScreen[record.job_id])', '', ['reload']],
  ['restore: the second question at once', L, 'if (status === \'building\') knownOutcomes.set(record.job_id, { outcome, at: now })', '', ['reload']],
  ['restore: a retired owner still applies', L, 'if (disposed || !isOwner()) return\n    const now = deps.now()', 'if (disposed) return\n    const now = deps.now()', ['reload']],
  ['restore: an old restored job gets a fresh clock', L, 'lastLifeAt: restored ? acceptedAt : now,', 'lastLifeAt: now,', ['reload']],
  ['restore: an old acceptance time is forgotten', L, 'const acceptedAt = acceptedAtOf(job.job_id)', 'const acceptedAt = now', ['reload', 'timeout']],
  ['restore: an invalid record order', L, "for (const record of [...records].sort((a, b) => a.accepted_at - b.accepted_at || a.job_id.localeCompare(b.job_id))) {", 'for (const record of [...records]) {', ['reload']],
  // placeholders
  ['viewer: a failed placeholder is not marked', L, "if (deps.getJobs()[id]?.status === 'error') await api.composePlaceholderFail(id)", '', ['reload']],
  ['viewer: every tick asks again', L, 'if (!apiDirty || apiRunning) return', 'if (apiRunning) return', ['reload']],
  ['viewer: a reloaded viewer is not noticed', L, 'if (api !== lastApi) { lastApi = api; apiDirty = true; apiAttempts = 0 }', '', ['reload', 'retry']],
  ['viewer: no retry when the viewer is not ready', L, 'if (!ok && ++apiAttempts < MAX_PLACEHOLDER_ATTEMPTS) apiDirty = true', '', ['reload']],
  ['viewer: unbounded retries', L, 'if (!ok && ++apiAttempts < MAX_PLACEHOLDER_ATTEMPTS) apiDirty = true', 'if (!ok) apiDirty = true', ['reload']],
  ['viewer: slots are not ordered', L, '.sort((a, b) => (ranks.get(a) ?? 0) - (ranks.get(b) ?? 0))', '', ['reload']],
  ['viewer: slots without the jobs before', L, 'Math.max(0, entry.target) + rank]', 'Math.max(0, entry.target)]', ['pure']],
  ['viewer: slots ignore the target', L, 'Math.max(0, entry.target) + rank]', 'rank]', ['pure']],
  // dismiss
  ['dismiss: a pending job can be dismissed', L, "if (disposed || !job || job.status !== 'error') return", 'if (disposed || !job) return', ['retry']],
  ['dismiss: the page is not told', L, 'deps.onDismissed(job, visualIndex)', '', ['retry']],
  ['dismiss: the record is kept until the next sync', L, '    forget(jobId)\n    if (!scoped) return', '    if (!scoped) return', ['retry']],
  ['dismiss: the poller is left', L, 'deps.disarmJob(jobId)\n    deps.setJobs(previous => {\n      if (!previous[jobId]) return previous', 'deps.setJobs(previous => {\n      if (!previous[jobId]) return previous', ['retry']],
  ['dismiss: the card stays', L, 'const { [jobId]: _dismissed, ...rest } = previous\n      return rest as Record<string, TJob>', 'return previous', ['retry']],
  ['dismiss: the others are not put back', L, 'for (const other of liveJobs(deps.getJobs())) if (other.job_id !== jobId) debt.add(other.job_id)', '', ['retry']],
  ['dismiss: the dismissed one is put back', L, 'if (other.job_id !== jobId) debt.add(other.job_id)', 'debt.add(other.job_id)', ['retry']],
  ['dismiss: the slot is the stale one', L, 'visualIndexes(liveJobs(deps.getJobs())).get(jobId) ?? job.target_visual_index', 'job.target_visual_index', ['retry']],
  ['dismiss: another deck still reloads the viewer', L, '    if (!scoped) return\n', '', ['retry']],
  ['dispose: timers survive', L, 'for (const entry of tracked.values()) if (entry.timer != null) deps.clearTimer(entry.timer)', '', ['hook', 'retry']],
  // wording
  ['wording: a backend error is shown as ours', L, "return (first && CAPTION_BY_MESSAGE[first]) || COMPOSE_JOB_GENERIC_CAPTION", 'return first ?? COMPOSE_JOB_GENERIC_CAPTION', ['pure']],
  ['wording: technical words', L, 'export const COMPOSE_JOB_TIMEOUT_MESSAGE = "This slide is taking much longer than expected. It may still show up; if it doesn\'t, retry it."', 'export const COMPOSE_JOB_TIMEOUT_MESSAGE = "Job timeout (HTTP 500)."', ['pure']],
  ['decorate: a pending card is decorated', L, "card.kind === 'refine' || card.status !== 'error'", "card.kind === 'refine'", ['pure']],
  ['decorate: a refine card is decorated', L, "card.kind === 'refine' || card.status !== 'error'", "card.status !== 'error'", ['pure']],
  ['decorate: the flag is ignored', L, '!options.enabled || card.kind', 'card.kind', ['pure']],
  ['decorate: Dismiss missing', L, 'failureCaption: composeJobFailureCaption(job ?? {}), onDismiss: options.onDismiss }', 'failureCaption: composeJobFailureCaption(job ?? {}) }', ['pure']],
  // hook
  ['hook: runs with the flag off', 'hook', '!enabled || !sessionId', '!sessionId', ['hook', 'guard']],
  ['hook: runs without a deck', 'hook', ' || !presentationId) return', ') return', ['hook', 'guard']],
  ['hook: runs for a new session', 'hook', " || sessionId === 'new'", '', ['hook', 'guard']],
  ['hook: the old controller survives a new owner', 'hook', '}, [enabled, sessionId, presentationId, ownerKey])', '}, [enabled, sessionId, presentationId])', ['hook', 'guard']],
  ['hook: the controller is not disposed', 'hook', '      controller.dispose()\n', '', ['hook', 'guard']],
  ['hook: the watcher is not cleared', 'hook', '      window.clearInterval(watcher)\n', '', ['hook']],
  ['hook: no restore', 'hook', '    void controller.restore()\n', '', ['hook']],
  ['hook: the cards are decorated with the flag off', 'hook', 'decorateComposeJobCard(card, job, { enabled, onDismiss: dismiss })', 'decorateComposeJobCard(card, job, { enabled: true, onDismiss: dismiss })', ['hook', 'guard']],
  ['hook: dismiss does not reach the controller', 'hook', 'if (controller) { controller.dismiss(jobId); return }', '', ['hook']],
  ['hook: jobs are not synced', 'hook', '    controllerRef.current?.sync(options.jobs)\n', '', ['hook']],
  // strip
  ['strip: Dismiss on a pending card', 'strip', '{isError && job.onDismiss && (', '{job.onDismiss && (', ['strip', 'guard']],
  ['strip: the plain caption is ignored', 'strip', "{isError ? job.failureCaption ?? (STUDIO_THUMBNAILS", "{isError ? (STUDIO_THUMBNAILS", ['strip', 'guard']],
  ['strip: Dismiss calls Retry', 'strip', 'onClick={() => job.onDismiss?.(job.jobId)}', 'onClick={() => job.onRetry?.(job.jobId)}', ['strip', 'guard']],
  ['strip: always the new caption', 'strip', "{isError ? job.failureCaption ?? (STUDIO_THUMBNAILS && !job.onRetry ? 'Compose failed' : 'Retry compose') : title}", "{isError ? job.failureCaption ?? 'Taking too long.' : title}", ['strip', 'guard']],
  ['strip: Retry button missing', 'strip', '{job.onRetry && (\n              <button type="button" data-compose-failsafe-action="retry"', '{false && (\n              <button type="button" data-compose-failsafe-action="retry"', ['strip']],
  // page
  ['page: the flag is always on', 'page', 'enabled: STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED,', 'enabled: true,', ['guard']],
  ['page: cards bypass decorate', 'page', '.map(job => composeFailsafe.decorate({', '.map(job => ({', ['guard']],
  ['page: Retry re-sends something else', 'page', '...existing.request,\n      job_id: nextJobId,', '...existing.request,\n      instruction: \'\',\n      job_id: nextJobId,', ['guard']],
  ['page: the dismissed placeholder stays in the viewer', 'page', "triggerCoalescedSlideComposeReload('compose job dismissed', { force: true })", "triggerCoalescedSlideComposeReload('compose job dismissed')", ['guard']],
  ['page: the default coalescing changes', 'page', 'if (slideComposeFallbackReloadInFlightRef.current && !options?.force) return', 'if (slideComposeFallbackReloadInFlightRef.current) return', ['guard']],
  ['page: the selection is lost on Dismiss', 'page', 'queueComposeSelectionRestore(current > visualIndex ? current - 1 : current)', '', ['guard']],
  ['page: the owner key is not passed', 'page', '    ownerKey: studioSlideComposeOwnerKey,\n', '', ['guard']],
  ['page: no poller for a restored job', 'page', 'armJob: job => startSlideComposePoller(job.job_id),', 'armJob: () => undefined,', ['guard']],
  // docs and wiring
  ['env: documented on', 'env', 'NEXT_PUBLIC_STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED="false"', 'NEXT_PUBLIC_STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED="true"', ['guard']],
  ['env: not documented', 'env', 'NEXT_PUBLIC_STUDIO_COMPOSE_JOB_FAILSAFE_ENABLED="false"', '', ['guard']],
]

const REL = { lib: FILES.lib, hook: FILES.hook, strip: FILES.strip, page: FILES.page }
let caught = 0
const survivors = []
const invalid = []
for (const [name, key, from, to, suites] of mutants) {
  const original = key === 'env' ? ENVEX : SRC[key]
  assert.ok(original.includes(from), `mutant "${name}" no longer matches the ${key} source`)
  const broken = original.replace(from, () => to)
  assert.notEqual(broken, original, `mutant "${name}" changes nothing`)
  if (key !== 'env') {
    // a mutant must be valid code: it is caught by behaviour, not by a syntax error
    try { compile(REL[key], broken) } catch (error) { invalid.push(`${name}: ${String(error.message).slice(0, 80)}`); continue }
  }
  const seen = checks
  let survived = false
  try {
    if (key === 'env') guardSuite({ env: broken })
    else await fullSuite({ [REL[key]]: broken }, suites)
    survived = true
  } catch { /* caught */ }
  unhandled.length = 0
  checks = seen
  if (survived) survivors.push(name)
  else caught++
}
assert.deepEqual(invalid, [], 'every mutant must be valid code')
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(' | ')}`)
check(assert.equal, caught, mutants.length)

console.log(`studio-compose-job-failsafe: ${checks} checks passed, ${caught} mutants caught`)
