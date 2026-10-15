// PASS2B J2-04: the Add Slide panel's status line after Generate (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS, default off).
// Offline and self-contained: no network, no browser, no service, no key.
//
// With the flag off the panel, the page wiring and the submit result are the base's, byte for byte (hashes of the panel's markup over a
// matrix, and a scripted Generate, against the base commit's own panel source and against hashes committed from it). With the flag on the
// panel adds ONE line under "Queued": "Building…", then "Added as slide N · Go to slide", or "Couldn't build it · Try again".
//
// The flag-on behaviour is driven end to end from RECORDED frames through the SHIPPED code (scripts/studio-add-slide-status-harness.mjs):
// Director's real slide_ready / slide_failed frames and accepted bodies, the Layout Service's real answers to the viewer commands (both
// recorded by scripts/fixtures/studio-add-slide-status/record-*.py from the real services), the page's own compose handlers cut out of
// app/builder/page.tsx, and the viewer's own command wrappers cut out of components/presentation-viewer.tsx. The commands the page sends the
// viewer must equal, parameter for parameter, the ones that were sent to the real viewer when the answers were recorded.
//
//   node scripts/test-studio-add-slide-status.mjs                  run everything
//   node scripts/test-studio-add-slide-status.mjs --record-base    re-record scripts/fixtures/studio-add-slide-status/base-panel-golden.json
//                                                                  from the base commit's panel (git show), flag off
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  FIXTURES, React, createPageWorld, load, loadLibs, mountPanel, read, read as readFile, readFixture, renderToStaticMarkup, repoRoot, settle, toHtml,
} from './studio-add-slide-status-harness.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'

const FLAG = 'NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS'
const ON = { [FLAG]: 'true' }
const ALL_OPTIONS = { NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED_OPTIONS: 'all' }
/** The last commit on studio-v4-dev-preparation-code that changed the panel (PASS2B G29, #410): flag off must be exactly this panel, whatever the base has moved to since. */
const BASE_COMMIT = 'd5603f7'
const GOLDEN = `${FIXTURES}/base-panel-golden.json`

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const baseFile = rel => { try { return execFileSync('git', ['-C', repoRoot, 'show', `${BASE_COMMIT}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null } }

const PANEL = 'components/studio-add-slide-v2.tsx'
const STATUS_LIB = 'lib/studio-add-slide-status.ts'

// ================================================================ 1. the flag, and the pure status resolver
function flagSuite(sources = {}) {
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['true', true], ['TRUE', false], ['1', false], [' true', false], ['true ', false]]) {
    const lib = loadLibs({ env: value === undefined ? {} : { [FLAG]: value }, sources }).status
    check(assert.equal, lib.STUDIO_ADD_SLIDE_STATUS_ENABLED, expected, `flag ${JSON.stringify(value)}`)
  }
}

function resolverSuite(sources = {}) {
  const { resolveAddSlideStatus: resolve, createAddSlideV2StatusSettings: create } = loadLibs({ sources }).status
  const PID = 'pres-1'
  const job = (id, over = {}) => ({ job_id: id, kind: 'compose', status: 'building', title: 'Why a phased rollout', target_visual_index: 2, target_presentation_id: PID, ...over })
  const map = (...jobs) => Object.fromEntries(jobs.map(j => [j.job_id, j]))

  // nothing known about the job yet
  check(assert.equal, resolve({ jobs: {}, jobId: 'j1', previous: null }), null, 'a job the page has not recorded yet says nothing')
  check(assert.equal, resolve({ jobs: map(job('other')), jobId: 'j1', previous: null }), null, 'another job is not this one')

  // building
  const building = resolve({ jobs: map(job('j1')), jobId: 'j1', previous: null })
  check(assert.equal, building.kind, 'building')
  check(assert.equal, building.jobId, 'j1')
  check(assert.deepEqual, building.slot, { presentationId: PID, visualIndex: 2, title: 'Why a phased rollout' })
  check(assert.equal, resolve({ jobs: map(job('j1', { lastProgressText: 'Researching…' })), jobId: 'j1', previous: building }), building, 'unchanged = the same object (the panel settles on identity)')

  // building -> gone: the page removed a finished job. The number is the slot's, one-based.
  const added = resolve({ jobs: {}, jobId: 'j1', previous: building })
  check(assert.deepEqual, added, { kind: 'added', slideNumber: 3 }, 'visual index 2 is slide 3')
  check(assert.equal, resolve({ jobs: {}, jobId: 'j1', previous: added }), added, 'added stays added')
  check(assert.equal, resolve({ jobs: map(job('j1')), jobId: 'j1', previous: added }), added, 'and does not come back to life')
  check(assert.equal, resolve({ jobs: {}, jobId: 'j1', previous: resolve({ jobs: map(job('j1', { target_visual_index: 0 })), jobId: 'j1', previous: null }) }).slideNumber, 1, 'slot 0 is slide 1')
  // a different job in the same slot is not "this" job unless this one failed
  check(assert.equal, resolve({ jobs: map(job('j2')), jobId: 'j1', previous: building }).kind, 'added', 'a building job is never replaced, only a failed one is')

  // error
  const failed = resolve({ jobs: map(job('j1', { status: 'error', errors: ['Slide Builder did not answer in time.', ''] })), jobId: 'j1', previous: building })
  check(assert.equal, failed.kind, 'failed')
  check(assert.equal, failed.message, 'Slide Builder did not answer in time.', 'empty error strings are dropped')
  check(assert.equal, failed.jobId, 'j1')
  check(assert.equal, resolve({ jobs: map(job('j1', { status: 'error', errors: ['Slide Builder did not answer in time.'] })), jobId: 'j1', previous: failed }), failed, 'unchanged failure = same object')
  const failedAgain = resolve({ jobs: map(job('j1', { status: 'error', errors: ['Something else'] })), jobId: 'j1', previous: failed })
  check(assert.notEqual, failedAgain, failed, 'a different message is a change')
  check(assert.equal, resolve({ jobs: map(job('j1', { status: 'error' })), jobId: 'j1', previous: null }).message, '', 'no error text is fine')

  // failed -> the retry replaces the job by a new one in the same slot under a new id: follow it
  const retried = resolve({ jobs: map(job('j3')), jobId: 'j1', previous: failed })
  check(assert.equal, retried.kind, 'building')
  check(assert.equal, retried.jobId, 'j3', 'follows the retry')
  check(assert.equal, resolve({ jobs: map(job('j3')), jobId: 'j1', previous: retried }), retried)
  check(assert.deepEqual, resolve({ jobs: {}, jobId: 'j1', previous: retried }), { kind: 'added', slideNumber: 3 }, 'and the retry landing says so')
  const retriedAndFailed = resolve({ jobs: map(job('j3', { status: 'error', errors: ['x'] })), jobId: 'j1', previous: retried })
  check(assert.equal, retriedAndFailed.kind, 'failed')
  check(assert.equal, retriedAndFailed.jobId, 'j3', 'a second failure is of the second job: Try again then retries that one')
  // not the same slot, not the same slide
  for (const over of [{ target_visual_index: 3 }, { target_presentation_id: 'pres-2' }, { title: 'Something else' }, { kind: 'refine' }]) {
    check(assert.equal, resolve({ jobs: map(job('j3', over)), jobId: 'j1', previous: failed }), null, `a job that does not take the slot (${Object.keys(over)}) is not followed`)
  }
  // a Dismiss on the rail card removes the failed job: say nothing
  check(assert.equal, resolve({ jobs: {}, jobId: 'j1', previous: failed }), null, 'a failed job that is gone was dismissed, not added')

  // a refine job under the id is not an Add Slide job
  check(assert.equal, resolve({ jobs: map(job('j1', { kind: 'refine' })), jobId: 'j1', previous: null }), null)

  // the settings the page builds
  const calls = []
  const settings = create({ jobs: map(job('j1')), goToSlide: i => calls.push(['go', i]), retry: id => calls.push(['retry', id]) })
  check(assert.equal, settings.read('j1', null).kind, 'building')
  settings.goToSlide(4); settings.retry('j9')
  check(assert.deepEqual, calls, [['go', 4], ['retry', 'j9']], 'the two actions are the page\'s, passed through untouched')
}

// ================================================================ 2. the submit result carries the job id only when asked
async function submitSuite(sources = {}) {
  const libs = loadLibs({ sources })
  const request = libs.add.buildAddSlideV2Request({ slideType: 'content', contentSubtype: 'auto', text: 'Q3 revenue' },
    { sessionId: 'sess-1', presentationId: 'pres-1', currentSlide: 3, slideCount: 7, research: { useUploadedDocuments: false, useWebSearch: false, useDeepResearch: false, useKnowledgeGraph: false }, theme: { mode: 'preset', preset_id: 'corporate_light' }, themeLabel: 'x' })
  const deps = over => ({
    fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'accepted', job_id: 'job-1', target_index: 3, session_id: 'sess-1', presentation_id: 'pres-1' }) }),
    newJobId: () => 'job-1', captureSessionOwner: () => () => true, isSessionAdmitted: () => true,
    selection: () => ({ visualIndex: 2, realSlideCount: 4, jobs: {} }), onAccepted() {}, ...over,
  })
  check(assert.deepEqual, await libs.submit.submitAddSlideV2(request, deps()), { ok: true }, 'flag off: the result is the base\'s { ok: true }')
  check(assert.deepEqual, await libs.submit.submitAddSlideV2(request, deps({ includeJobId: false })), { ok: true })
  check(assert.deepEqual, await libs.submit.submitAddSlideV2(request, deps({ includeJobId: true })), { ok: true, jobId: 'job-1' }, 'flag on: the accepted job\'s id')
  const refused = await libs.submit.submitAddSlideV2(request, deps({ includeJobId: true, fetchImpl: async () => ({ ok: false, json: async () => ({ error: 'nope' }) }) }))
  check(assert.equal, refused.ok, false, 'a refusal has no job id')
  check(assert.equal, 'jobId' in refused, false)
  const seen = []
  const hooks = libs.submit.createAddSlideV2Hooks({ ...deps({ includeJobId: true, onAccepted: job => seen.push(job.job_id) }), generationEnabled: true, presentationId: 'pres-1', follow: new Map() })
  check(assert.deepEqual, await hooks.submit(request), { ok: true, jobId: 'job-1' }, 'through the page factory too')
  check(assert.deepEqual, seen, ['job-1'], 'the page queue still gets the job')
}

// ================================================================ 3. flag off: the panel is the base's panel
const IDENTITY_CASES = (libs, optionsAll) => {
  const research = (over = {}) => ({ useUploadedDocuments: false, useWebSearch: false, useDeepResearch: false, useKnowledgeGraph: false, ...over })
  const context = (over = {}) => ({ sessionId: 'sess-1', presentationId: 'pres-1', currentSlide: 3, slideCount: 7, research: research({ useWebSearch: true }), theme: { mode: 'preset', preset_id: 'corporate_light' }, themeLabel: 'Corporate Light', ...over })
  const submit = async () => ({ ok: true })
  const draft = (slideType, contentSubtype, text) => ({ slideType, contentSubtype, text })
  const regenerate = { target: { slideId: 's-1', layoutIndex: 1, slideNumber: 2, title: 'Opening', busy: false, kind: 'content', instruction: 'Why a phased rollout', source: 'compose' }, submit, jobStatus: () => null }
  return {
    unwired: {}, 'unwired, typed': { initialDraft: draft('content', 'auto', 'Why a phased rollout') }, wired: { submit }, 'chart typed': { submit, initialDraft: draft('content', 'chart', 'Revenue by region') },
    'title one word': { submit, initialDraft: draft('title', 'auto', 'Agenda') }, 'title two words': { submit, initialDraft: draft('title', 'auto', 'Q3 review') },
    diagram: { submit, context: context({ research: research({ useWebSearch: true, useDeepResearch: true }) }), initialDraft: draft('content', 'diagram', 'How data flows') },
    disabled: { submit, disabled: true, initialDraft: draft('content', 'auto', 'Why a phased rollout') },
    'no session': { submit, context: context({ sessionId: null }), initialDraft: draft('content', 'auto', 'Why a phased rollout') },
    catalog: { submit, onBrowseCatalog() {} }, 'first slide': { submit, context: context({ currentSlide: 1, slideCount: 1 }) },
    'all options': { submit, options: optionsAll }, 'regenerate switch': { submit, options: optionsAll, regenerate },
    'regenerate switch, disabled': { submit, options: optionsAll, regenerate, disabled: true },
  }
}
function ssrPanel(source, libs, props) {
  const icon = name => () => React.createElement('svg', { 'data-icon': name })
  const mod = load(source, { imports: {
    react: React, 'react/jsx-runtime': nodeRequireJsx(), 'react-dom': { createPortal: (node, host) => ({ portal: true, host, node }) },
    'lucide-react': { Layout: icon('layout'), Plus: icon('plus'), RefreshCw: icon('refresh'), Sparkles: icon('sparkles'), Square: icon('square'), X: icon('x') },
    '@/lib/utils': { cn: (...a) => a.filter(Boolean).join(' ') }, '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [] },
    '@/lib/studio-add-slide-v2': libs.add, '@/lib/studio-add-slide-v2-regenerate': libs.regenerate,
    '@/lib/studio-panel-eyebrow': { slidePanelEyebrow: () => ({ label: '', detail: '' }) }, '@/components/studio-panel-eyebrow': { StudioPanelEyebrow: () => null }, // PASS2B G29: off here
    '@/components/builder/studio-panels.css': {}, './studio-add-slide-v2.css': {},
  } })
  return renderToStaticMarkup(React.createElement(mod.AddSlideV2Panel, { onInsertBlank() {}, onClose() {}, storage: null, context: { sessionId: 'sess-1', presentationId: 'pres-1', currentSlide: 3, slideCount: 7, research: { useUploadedDocuments: false, useWebSearch: true, useDeepResearch: false, useKnowledgeGraph: false }, theme: { mode: 'preset', preset_id: 'corporate_light' }, themeLabel: 'Corporate Light' }, ...props }))
}
function nodeRequireJsx() { return fileRequire('react/jsx-runtime') }
const fileRequire = createRequire(path.join(repoRoot, 'package.json'))

function identityHashes(panelSource) {
  const libs = loadLibs({ env: ALL_OPTIONS })
  const cases = IDENTITY_CASES(libs, libs.add.ADD_SLIDE_V2_OPTIONS)
  return Object.fromEntries(Object.entries(cases).map(([name, props]) => [name, sha(ssrPanel(panelSource, libs, props))]))
}

/** A scripted session, as the tiny runtime sees it: after every step, the tree as HTML. */
async function scriptedSession(panelSource, { submit }) {
  const libs = loadLibs({ env: ALL_OPTIONS })
  const props = { context: { sessionId: 'sess-1', presentationId: 'pres-1', currentSlide: 2, slideCount: 3, research: { useUploadedDocuments: false, useWebSearch: false, useDeepResearch: false, useKnowledgeGraph: false }, theme: { mode: 'preset', preset_id: 'corporate_light' }, themeLabel: 'Corporate Light' }, storage: null, onInsertBlank() {}, onClose() {}, submit }
  const rt = mountPanel(panelSource, libs, props)
  const steps = [rt.html()]
  rt.type('Why a phased rollout'); steps.push(rt.html())
  await rt.click(rt.byClass('asv2-generate')); steps.push(rt.html())
  rt.type('Another slide'); steps.push(rt.html())
  await rt.click(rt.byClass('asv2-generate')); steps.push(rt.html())
  return steps
}

async function flagOffSuite() {
  const current = read(PANEL)
  const hashes = identityHashes(current)
  const golden = JSON.parse(read(GOLDEN))
  check(assert.equal, golden.base_commit, BASE_COMMIT)
  check(assert.deepEqual, Object.keys(hashes), Object.keys(golden.hashes), 'the same cases')
  for (const [name, hash] of Object.entries(hashes)) check(assert.equal, hash, golden.hashes[name], `flag off, no status settings: "${name}" renders exactly as the base commit's panel did`)
  const base = baseFile(PANEL)
  if (base) {
    for (const [name, hash] of Object.entries(identityHashes(base))) check(assert.equal, hash, golden.hashes[name], `the committed hash of "${name}" is the base commit's own render`)
    for (const mode of [{ submit: async () => ({ ok: true }) }, { submit: async () => ({ ok: false, message: 'Not today.' }) }]) {
      const a = await scriptedSession(base, mode), b = await scriptedSession(current, mode)
      check(assert.deepEqual, b, a, 'a scripted type / Generate / type / Generate session draws the same tree at every step as the base panel')
    }
  }
  // Flag off at the page: the panel gets no status settings and the submit result has no job id; the post-Generate copy is the base's.
  const world = createPageWorld({ scenario: 'generate-ready' })
  check(assert.equal, world.panelProps.status, undefined, 'flag off: the page hands the panel no status settings')
  check(assert.equal, world.libs.status.STUDIO_ADD_SLIDE_STATUS_ENABLED, false)
  world.panel.type('Why a phased rollout')
  await world.panel.click(world.panel.button('Generate slide'))
  check(assert.equal, world.panel.statusLine(), null, 'flag off: no status line after Generate')
  check(assert.equal, textOfQueued(world.panel), 'Queued. It appears right after slide 2 when it is ready.', 'flag off: the Queued copy, as before')
  await world.deliverReady(0)
  world.panel.render()
  check(assert.equal, world.panel.statusLine(), null, 'flag off: nothing says it finished (the J2-04 gap, unchanged while the flag is off)')
  check(assert.equal, textOfQueued(world.panel), 'Queued. It appears right after slide 2 when it is ready.', 'flag off: Queued stays, as before')
}
const textOfQueued = rt => { const line = rt.queuedLine(); return line ? line.props.children : null }

// ================================================================ 4. flag on: the panel's three states (stub status settings)
async function panelStatesSuite(panelSource) {
  const libs = loadLibs({ env: ON })
  const calls = []
  let next = null
  const statusSettings = { read: (_jobId, previous) => (sameState(previous, next) ? previous : next), goToSlide: i => calls.push(['go', i]), retry: id => calls.push(['retry', id]) }
  const sameState = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const mk = (over = {}) => {
    const props = { context: { sessionId: 'sess-1', presentationId: 'pres-1', currentSlide: 2, slideCount: 3, research: { useUploadedDocuments: false, useWebSearch: false, useDeepResearch: false, useKnowledgeGraph: false }, theme: {}, themeLabel: 'Corporate Light' },
      storage: null, onInsertBlank() {}, onClose() {}, submit: async () => ({ ok: true, jobId: 'job-1' }), status: statusSettings, ...over }
    return mountPanel(panelSource, libs, props)
  }
  const slot = { presentationId: 'pres-1', visualIndex: 2, title: 'Why a phased rollout' }
  const generate = async rt => { rt.type('Why a phased rollout'); await rt.click(rt.byClass('asv2-generate')) }

  // before Generate there is no line; the queued note is the base's
  next = { kind: 'building', jobId: 'job-1', slot }
  let rt = mk()
  check(assert.equal, rt.statusLine(), null, 'nothing is tracked before Generate')
  await generate(rt)
  let line = rt.statusLine()
  check(assert.equal, line.props['data-add-slide-status'], 'building')
  check(assert.equal, line.type, 'p')
  check(assert.equal, line.props.role, 'status')
  check(assert.equal, line.props.className, 'asv2-queued asv2-status')
  check(assert.equal, line.props.children, 'Building…', 'copy: Building…')
  check(assert.equal, textOfQueued(rt), 'Queued. It appears right after slide 2 when it is ready.', 'building: the Queued note stays, the line is under it')
  const order = rt.all(n => n.type === 'p' && (n === rt.queuedLine() || n === line))
  check(assert.deepEqual, order.map(n => n.props['data-add-slide-status'] ?? 'queued'), ['queued', 'building'], 'the status line comes right after Queued')
  check(assert.equal, rt.all(n => n.type === 'button' && /Go to slide|Try again/.test(JSON.stringify(n.props.children))).length, 0, 'building has no action')

  // added
  next = { kind: 'added', slideNumber: 3 }
  rt.render()
  line = rt.statusLine()
  check(assert.equal, line.props['data-add-slide-status'], 'added')
  check(assert.equal, line.props.role, 'status')
  check(assert.equal, rt.text().includes('Added as slide 3 · Go to slide'), true, 'copy: Added as slide 3 · Go to slide')
  check(assert.equal, rt.queuedLine(), null, 'added: the stale "Queued. It appears…" note is gone')
  const goTo = rt.button('Go to slide')
  check(assert.equal, goTo.props.className, 'asv2-discard')
  check(assert.equal, goTo.props.disabled, false)
  await rt.click(goTo)
  check(assert.deepEqual, calls.splice(0), [['go', 2]], 'Go to slide goes to the 0-based slide before the number')
  check(assert.equal, rt.statusLine().props['data-add-slide-status'], 'added', 'and the line stays')

  // failed
  next = { kind: 'failed', jobId: 'job-1', slot, message: 'Slide Builder did not answer in time.' }
  rt.render()
  line = rt.statusLine()
  check(assert.equal, line.props['data-add-slide-status'], 'failed')
  check(assert.equal, line.props.role, 'alert')
  check(assert.equal, line.props.className, 'asv2-error asv2-status')
  check(assert.equal, line.props.title, 'Slide Builder did not answer in time.', 'the reason is in the title, not the line')
  check(assert.equal, rt.text().includes("Couldn't build it · Try again"), true, "copy: Couldn't build it · Try again")
  check(assert.equal, rt.queuedLine(), null, 'failed: the stale Queued note is gone')
  const retry = rt.button('Try again')
  check(assert.equal, retry.props.disabled, false)
  await rt.click(retry)
  check(assert.deepEqual, calls.splice(0), [['retry', 'job-1']], 'Try again is the page\'s retry for that job')
  check(assert.equal, rt.button('Try again').props.disabled, true, 'and cannot be pressed twice while the failure is still shown')
  // a failure of the retried job (a new job id) can be retried again
  next = { kind: 'failed', jobId: 'job-3', slot, message: 'x' }
  rt.render()
  check(assert.equal, rt.button('Try again').props.disabled, false, 'a new failure is a new chance')
  check(assert.equal, rt.statusLine().props.title, 'x')

  // gone (dismissed): no line, no stale Queued either way round
  next = null
  rt.render()
  check(assert.equal, rt.statusLine(), null, 'a dismissed failure leaves no line')

  // no message: no title
  next = { kind: 'failed', jobId: 'job-1', slot, message: '' }
  rt = mk(); await generate(rt)
  check(assert.equal, rt.statusLine().props.title, undefined)

  // a new Generate clears the previous line, and a refused one leaves none
  next = { kind: 'building', jobId: 'job-1', slot }
  rt = mk({ submit: async () => ({ ok: true, jobId: 'job-1' }) }); await generate(rt)
  check(assert.equal, rt.statusLine().props['data-add-slide-status'], 'building')
  rt.props.submit = async () => ({ ok: false, message: 'No.' })
  rt.type('Another one'); await rt.click(rt.byClass('asv2-generate'))
  check(assert.equal, rt.statusLine(), null, 'Generate clears the earlier line at once')
  check(assert.equal, rt.byClass('asv2-error').props.children, 'No.', 'and a refusal shows the base\'s error')

  // older submit (no job id): nothing to follow
  rt = mk({ submit: async () => ({ ok: true }) }); await generate(rt)
  check(assert.equal, rt.statusLine(), null, 'a result without a job id tracks nothing')
  check(assert.equal, textOfQueued(rt), 'Queued. It appears right after slide 2 when it is ready.')

  // no status settings (flag off at the page): the same session draws no line even if the submit answered a job id
  rt = mk({ status: undefined }); await generate(rt)
  check(assert.equal, rt.statusLine(), null, 'without settings.status nothing is drawn')

  // ONE_LIVE_TAB (#396): a paused tab disables Add Slide; the line's two actions are disabled too
  for (const state of [{ kind: 'added', slideNumber: 3 }, { kind: 'failed', jobId: 'job-1', slot, message: '' }]) {
    next = state
    const live = mk(); await generate(live)
    live.props.disabled = true; live.render()
    for (const label of ['Go to slide', 'Try again']) { const button = live.maybeButton(label); if (button) check(assert.equal, button.props.disabled, true, `${label} is disabled in a paused tab`) }
  }
  // the markup of the three lines
  for (const [state, expected] of [
    [{ kind: 'building', jobId: 'job-1', slot }, '<p class="asv2-queued asv2-status" role="status" data-add-slide-status="building">Building…</p>'],
    [{ kind: 'added', slideNumber: 3 }, '<p class="asv2-queued asv2-status" role="status" data-add-slide-status="added">Added as slide 3 · <button type="button" class="asv2-discard">Go to slide</button></p>'],
    [{ kind: 'failed', jobId: 'job-1', slot, message: '' }, `<p class="asv2-error asv2-status" role="alert" data-add-slide-status="failed">Couldn't build it · <button type="button" class="asv2-discard">Try again</button></p>`],
  ]) {
    next = state
    const view = mk(); await generate(view)
    const html = toHtml(view.statusLine())
    check(assert.equal, html, expected, `markup of ${state.kind}`)
  }
}

// ================================================================ 5. flag on, end to end from the recorded frames through the shipped code
async function endToEndSuite({ sources = {}, panelSource } = {}) {
  const make = scenario => createPageWorld({ scenario, env: ON, sources, panelSource })
  const layoutSteps = (world, action) => world.layout.steps.filter(s => s.do === 'command' && s.action === action)
  const lineKind = rt => rt.statusLine()?.props['data-add-slide-status'] ?? null

  // ---- generate -> ready -> Go to slide
  {
    const w = make('generate-ready'), rt = w.panel
    check(assert.equal, w.ctx.STUDIO_ADD_SLIDE_STATUS_ENABLED, true)
    check(assert.equal, rt.statusLine(), null)
    rt.type('Why a phased rollout')
    await rt.click(rt.button('Generate slide'))
    // The page queued the job the way the base does: Director accepted it, the real viewer was sent the recorded placeholder command.
    const posts = w.events.filter(e => e[0] === 'compose-post')
    check(assert.deepEqual, posts, [['compose-post', 'job-add-1', 1]], 'one compose POST, after slide 2 (insert_after_index 1)')
    const job = w.jobs()['job-add-1']
    check(assert.equal, job.status, 'building')
    check(assert.equal, job.target_visual_index, 2)
    const state1 = w.replay.read('composeGetState').reply
    check(assert.deepEqual, state1.placeholders, [{ job_id: 'job-add-1', visual_index: job.target_visual_index }], 'the REAL viewer holds the placeholder where the page says the job lands')
    check(assert.equal, lineKind(rt), 'building')
    check(assert.equal, textOfQueued(rt), 'Queued. It appears right after slide 2 when it is ready.')

    // Director's real slide_ready frame
    const frame = w.frame(0)
    check(assert.equal, frame.type, 'slide_ready')
    await w.deliverReady(0)
    rt.render()
    check(assert.deepEqual, w.jobs(), {}, 'the page removed the finished job (the rail\'s card goes with it)')
    const reconcile = layoutSteps(w, 'composeSlideReconcile')[0]
    check(assert.equal, lineKind(rt), 'added')
    const number = reconcile.reply.visual_index + 1
    check(assert.equal, rt.text().includes(`Added as slide ${number} · Go to slide`), true, 'the number is the REAL viewer\'s visual index of the new slide, plus one')
    check(assert.equal, number, 3)
    const state2 = w.replay.read('composeGetState').reply
    check(assert.deepEqual, state2.placeholders, [], 'the real viewer has no placeholder left')
    check(assert.equal, state2.slides.find(s => s.visual_index === number - 1).slide_id, frame.payload.real_slide_id, 'and the real slide Director named is the one at that number')
    check(assert.equal, rt.queuedLine(), null)

    // Go to slide: the viewer's go-to, with the recorded answer
    await rt.click(rt.button('Go to slide'))
    const nav = w.replay.log.at(-1)
    check(assert.deepEqual, nav, { action: 'goToSlide', params: { index: number - 1 } }, 'goToSlide with the 0-based index, as a rail thumbnail sends it')
    const info = w.replay.read('getCurrentSlideInfo').reply
    check(assert.equal, info.data.index, number - 1, 'the REAL viewer is now on that slide')
    check(assert.equal, w.ctx.currentSlideIndexRef.current, number - 1, 'and so is the page')
    check(assert.deepEqual, w.replay.unconsumed(), [], 'every recorded answer was used')
    check(assert.equal, lineKind(rt), 'added', 'the line stays')
  }

  // ---- generate -> fails -> Try again (the rail card's retry) -> ready
  {
    const w = make('fail-retry-ready'), rt = w.panel
    rt.type('Why a phased rollout')
    await rt.click(rt.button('Generate slide'))
    check(assert.equal, lineKind(rt), 'building')
    await w.deliverFailed(0)
    rt.render()
    check(assert.equal, w.frame(0).type, 'slide_failed')
    check(assert.equal, lineKind(rt), 'failed')
    check(assert.equal, w.jobs()['job-add-2'].status, 'error', 'the rail still has the failed card')
    check(assert.equal, rt.statusLine().props.title, 'Slide Builder did not answer in time.', 'Director\'s own error text')
    check(assert.equal, rt.text().includes("Couldn't build it · Try again"), true)
    const failedState = w.replay.read('composeGetState').reply
    check(assert.deepEqual, failedState.placeholders, [{ job_id: 'job-add-2', visual_index: 2 }], 'the REAL viewer still holds the failed placeholder')
    // Try again is the rail card's onRetry, i.e. the page's handleRetrySlideCompose
    const cards = w.ctx.slideComposeThumbnailJobs
    check(assert.equal, cards.length, 1)
    check(assert.equal, cards[0].onRetry, w.ctx.handleRetrySlideCompose, 'the rail card\'s retry is the page\'s retry')
    await rt.click(rt.button('Try again'))
    check(assert.deepEqual, Object.keys(w.jobs()), ['job-add-3'], 'the retry replaced the failed job by a new one')
    check(assert.equal, lineKind(rt), 'building', 'the line follows the new job')
    check(assert.equal, rt.maybeButton('Try again'), null)
    const retryCommand = w.replay.log.at(-1)
    check(assert.deepEqual, retryCommand, { action: 'composePlaceholderAdd', params: { job_id: 'job-add-3', visual_index: 2, replace_job_id: 'job-add-2' } }, 'the retry replaces the placeholder in the real viewer')
    const retriedState = w.replay.read('composeGetState').reply
    check(assert.deepEqual, retriedState.placeholders, [{ job_id: 'job-add-3', visual_index: 2 }])
    await w.deliverReady(1)
    rt.render()
    const reconcile = layoutSteps(w, 'composeSlideReconcile')[0]
    check(assert.equal, lineKind(rt), 'added', 'the retried slide landing says so')
    check(assert.equal, rt.text().includes(`Added as slide ${reconcile.reply.visual_index + 1} · Go to slide`), true)
    const finalState = w.replay.read('composeGetState').reply
    check(assert.equal, finalState.slides[reconcile.reply.visual_index].slide_id, w.frame(1).payload.real_slide_id)
    check(assert.deepEqual, w.replay.unconsumed(), [], 'every recorded answer was used')
  }

  // ---- the rail's own retry (the user shows the rail) moves the panel's line too; a Dismiss on the rail card clears it
  {
    const w = make('fail-retry-ready'), rt = w.panel
    rt.type('Why a phased rollout')
    await rt.click(rt.button('Generate slide'))
    await w.deliverFailed(0)
    rt.render()
    check(assert.equal, lineKind(rt), 'failed')
    w.ctx.slideComposeThumbnailJobs[0].onRetry('job-add-2')
    await settle()
    rt.render()
    check(assert.equal, lineKind(rt), 'building', 'a retry from the rail card is followed by the panel')
    await w.deliverReady(1)
    rt.render()
    check(assert.equal, lineKind(rt), 'added')

    const d = make('fail-retry-ready')
    d.panel.type('Why a phased rollout')
    await d.panel.click(d.panel.button('Generate slide'))
    await d.deliverFailed(0)
    d.panel.render()
    check(assert.equal, lineKind(d.panel), 'failed')
    d.ctx.setSlideComposeJobs(prev => { const { 'job-add-2': _gone, ...rest } = prev; return rest }) // the failsafe's Dismiss removes the card and the record
    d.panel.render()
    check(assert.equal, lineKind(d.panel), null, 'a dismissed card leaves no line')
  }
}

// ================================================================ 6. flag off vs on at the page: the page behaves the same, only the panel's line differs
async function flagParitySuite() {
  const run = async env => {
    const w = createPageWorld({ scenario: 'fail-retry-ready', env })
    const trace = []
    const stamp = text => text.replace(/"lastMessageAt":"[^"]*"/g, '"lastMessageAt":"-"')
    const snap = label => trace.push([label, JSON.stringify(w.jobs()), stamp(JSON.stringify(w.events)), JSON.stringify(w.replay.log)])
    w.panel.type('Why a phased rollout')
    await w.panel.click(w.panel.button('Generate slide')); snap('generated')
    await w.deliverFailed(0); w.panel.render(); snap('failed')
    w.ctx.slideComposeThumbnailJobs[0].onRetry('job-add-2'); await settle(); w.panel.render(); snap('retried')
    await w.deliverReady(1); w.panel.render(); snap('ready')
    return { trace, html: w.panel.html() }
  }
  const off = await run({}), unset = await run({ [FLAG]: 'false' }), on = await run(ON)
  check(assert.deepEqual, unset.trace, off.trace, 'the flag set to "false" is the flag unset')
  check(assert.deepEqual, on.trace, off.trace, 'the page\'s jobs, events and viewer commands are identical with the flag on (the line only reads them)')
  check(assert.equal, off.html.includes('data-add-slide-status'), false)
  check(assert.equal, on.html.includes('data-add-slide-status="added"'), true)
  check(assert.equal, off.html.includes('Queued. It appears'), true, 'flag off: the Queued note outlives the slide, as before')
  check(assert.equal, on.html.includes('Queued. It appears'), false, 'flag on: and is replaced once the slide is added')
}

// ================================================================ 7. static pins
function pinsSuite(sources = {}) {
  const read = rel => sources[rel] ?? readFile(rel)
  const page = read('app/builder/page.tsx'), panel = read(PANEL), lib = read(STATUS_LIB), submit = read('lib/studio-add-slide-v2-submit.ts'), addLib = read('lib/studio-add-slide-v2.ts')
  const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  // the status module: pure, one flag read, no I/O
  check(assert.equal, /^\s*import\s/m.test(lib), false, 'the status module has no imports')
  check(assert.equal, (strip(lib).match(/process\.env\./g) ?? []).length, 1, 'one env read')
  check(assert.match, lib, /export const STUDIO_ADD_SLIDE_STATUS_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS === 'true'/, 'literal access (Next inlines it), exact "true"')
  check(assert.equal, /fetch\(|WebSocket|XMLHttpRequest|sendCommand|postMessage|localStorage|sessionStorage/.test(strip(lib)), false, 'no backend call, no frame, no storage')
  // the panel: type-only import of the module (the tests\' import allow-lists see no new runtime import), no env read, no I/O
  check(assert.match, panel, /^import type \{ AddSlideStatus, AddSlideV2StatusSettings \} from '@\/lib\/studio-add-slide-status'$/m)
  check(assert.equal, /import \{[^}]*\} from '@\/lib\/studio-add-slide-status'/.test(panel), false, 'no runtime import of the status module in the panel')
  check(assert.equal, /NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS/.test(strip(panel)), false, 'the panel does not read the flag: the page decides by handing it settings.status')
  check(assert.equal, /fetch\(|sendCommand|postMessage/.test(strip(panel)), false, 'the panel still makes no call of its own')
  check(assert.equal, (strip(panel).match(/statusSettings\.read\(/g) ?? []).length, 1)
  // the lib types and the submit
  check(assert.match, addLib, /export type AddSlideV2SubmitResult = \{ ok: true; jobId\?: string \} \| \{ ok: false; message: string \}/)
  check(assert.match, addLib, /status\?: import\('@\/lib\/studio-add-slide-status'\)\.AddSlideV2StatusSettings/)
  check(assert.equal, /^\s*import\s/m.test(addLib), false, 'the add-slide lib stays import-free')
  check(assert.match, submit, /return deps\.includeJobId \? \{ ok: true, jobId: data\.job_id \} : \{ ok: true \}/)
  check(assert.equal, (submit.match(/includeJobId/g) ?? []).length, 2, 'one dep, one read')
  // the page: three entries, all behind the flag constant
  check(assert.equal, (page.match(/studio-add-slide-status/g) ?? []).length, 1, 'one import')
  check(assert.match, page, /import \{ STUDIO_ADD_SLIDE_STATUS_ENABLED, createAddSlideV2StatusSettings \} from '@\/lib\/studio-add-slide-status'/)
  check(assert.equal, (page.match(/includeJobId: STUDIO_ADD_SLIDE_STATUS_ENABLED,/g) ?? []).length, 1)
  check(assert.equal, (page.match(/status: STUDIO_ADD_SLIDE_STATUS_ENABLED \? createAddSlideV2StatusSettings\(\{/g) ?? []).length, 1)
  check(assert.equal, (page.match(/STUDIO_ADD_SLIDE_STATUS_ENABLED/g) ?? []).length, 3, 'the constant appears in the import and two entries only')
  check(assert.equal, /NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS/.test(strip(page)), false, 'the page does not read the env itself')
  check(assert.match, page, /createAddSlideV2StatusSettings\(\{\s*jobs: slideComposeJobs,\s*goToSlide: narrationNavigate,/, 'the jobs of this render (state, not the ref that is synced after it); Go to slide is the viewer go-to the page already has')
  check(assert.match, page, /retry: jobId => \{ void slideComposeThumbnailJobs\.find\(job => job\.jobId === jobId\)\?\.onRetry\?\.\(jobId\) \},/, 'Try again is the rail card\'s own retry')
  // the strip the sibling pins use (scripts/studio-add-slide-status-strip.mjs) takes out exactly what this change added: the panel is the base's
  // panel again, and nothing of the feature is left in the page
  const basePanel = baseFile(PANEL)
  if (basePanel) check(assert.equal, stripAddSlideStatus(PANEL, panel), basePanel, 'the panel without this change\'s lines is the base commit\'s panel, byte for byte')
  check(assert.equal, /ADD_SLIDE_STATUS|createAddSlideV2StatusSettings|PASS2B J2-04/.test(stripAddSlideStatus('app/builder/page.tsx', page)), false, 'the page without this change\'s lines names none of it')
  // the rail and the viewer are not touched by this feature: they never see the module
  for (const rel of ['components/slide-thumbnail-strip.tsx', 'components/presentation-viewer.tsx', 'components/builder/presentation-area.tsx', 'components/slide-layout-picker.tsx', 'lib/studio-slide-rail-v2.ts', 'lib/studio-panel-focus.ts']) {
    check(assert.equal, /studio-add-slide-status|ADD_SLIDE_STATUS|data-add-slide-status/.test(read(rel)), false, `${rel} does not know this feature`)
  }
  // docs, script, css
  check(assert.equal, (read('.env.example').match(/^NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS="false"$/gm) ?? []).length, 1, '.env.example documents the flag, off')
  check(assert.match, read('package.json'), /"test:studio-add-slide-status": "node scripts\/test-studio-add-slide-status\.mjs"/)
  const css = read('components/studio-add-slide-v2.css')
  check(assert.match, css, /\[data-studio-add-slide-v2="true"\] \.asv2-status \{[^}]*\}/, 'the status rule is scoped under the panel')
  check(assert.match, css, /\[data-studio-add-slide-v2="true"\] \.asv2-queued \+ \.asv2-status \{ margin-top: -8px; \}/, 'and the one that sets it under Queued')
  check(assert.equal, (css.match(/asv2-status/g) ?? []).length, 2, 'two rules, both scoped, nothing else names the class')
  // fixtures carry their provenance
  const layout = readFixture('layout-viewer-replies.json'), director = readFixture('director-frames.json')
  check(assert.match, layout._provenance.layout_builder_sha, /^[0-9a-f]{40}$/)
  check(assert.match, director._provenance.director_sha, /^[0-9a-f]{40}$/)
  check(assert.equal, director._provenance.layout_builder_sha, layout._provenance.layout_builder_sha, 'both recordings describe the same deck')
  for (const name of ['generate-ready', 'fail-retry-ready']) check(assert.equal, director.scenarios[name].presentation_id, layout.scenarios[name].presentation_id)
  check(assert.equal, director.scenarios['generate-ready'].frames.find(f => f.at === 'ws').frame.type, 'slide_ready')
  check(assert.equal, director.scenarios['fail-retry-ready'].frames.find(f => f.at === 'ws').frame.type, 'slide_failed')
}

// ================================================================ 8. the suites that must fail when the code is broken
async function behaviourSuites({ sources = {}, panelSource } = {}) {
  flagSuite(sources)
  resolverSuite(sources)
  await submitSuite(sources)
  await panelStatesSuite(panelSource ?? sources[PANEL] ?? read(PANEL))
  await endToEndSuite({ sources, panelSource: panelSource ?? sources[PANEL] })
}

if (process.argv.includes('--record-base')) {
  const base = baseFile(PANEL)
  assert.ok(base, `the base commit ${BASE_COMMIT} is not in this clone`)
  fs.writeFileSync(path.join(repoRoot, GOLDEN), JSON.stringify({
    base_commit: BASE_COMMIT,
    note: 'sha256 of the server-rendered Add Slide panel of the base commit (components/studio-add-slide-v2.tsx) over the cases in scripts/test-studio-add-slide-status.mjs, no status settings',
    hashes: identityHashes(base),
  }, null, 1) + '\n')
  console.log(`recorded ${GOLDEN} from ${BASE_COMMIT}`)
  process.exit(0)
}

await behaviourSuites()
await flagOffSuite()
await flagParitySuite()
pinsSuite()

// ---- mutants: break the shipped code in scratch copies and the suites above must notice
const MUTANTS = [
  ['status lib: the number is off by one', STATUS_LIB, s => s.replace('slideNumber: previous.slot.visualIndex + 1', 'slideNumber: previous.slot.visualIndex + 2')],
  ['status lib: an error job reads as building', STATUS_LIB, s => s.replace("if (job.status === 'error') {", "if (job.status === 'never') {")],
  ['status lib: a retry is not followed', STATUS_LIB, s => s.replace("previous?.kind === 'failed') {\n    const slot", "previous?.kind === 'nothing') {\n    const slot")],
  ['status lib: a vanished failed job counts as added', STATUS_LIB, s => s.replace("if (previous?.kind === 'building') return { kind: 'added'", "if (previous) return { kind: 'added'")],
  ['status lib: reads the flag loosely', STATUS_LIB, s => s.replace("=== 'true'", "!== 'false'")],
  ['panel: Go to slide goes to the number, not the index', PANEL, s => s.replace('goToSlide(addStatus.slideNumber - 1)', 'goToSlide(addStatus.slideNumber)')],
  ['panel: Try again stays pressable', PANEL, s => s.replace('disabled={disabled || retrySent === addStatus.jobId}', 'disabled={disabled}')],
  ['panel: the actions ignore a paused tab', PANEL, s => s.replace('<button type="button" className="asv2-discard" disabled={disabled} onClick={() => statusSettings?.goToSlide', '<button type="button" className="asv2-discard" onClick={() => statusSettings?.goToSlide')],
  ['panel: the stale Queued note stays', PANEL, s => s.replace("{queued && !(addStatus?.kind === 'added' || addStatus?.kind === 'failed') &&", '{queued &&')],
  ['panel: Generate does not clear the earlier line', PANEL, s => s.replace('    setQueued(null)\n    setTracked(null)\n', '    setQueued(null)\n')],
  ['submit: the job id is never answered', 'lib/studio-add-slide-v2-submit.ts', s => s.replace('deps.includeJobId ?', 'false ?')],
  ['page: the job id is not asked for', 'app/builder/page.tsx', s => s.replace('includeJobId: STUDIO_ADD_SLIDE_STATUS_ENABLED,', '')],
  ['page: the status settings are not handed over', 'app/builder/page.tsx', s => s.replace('status: STUDIO_ADD_SLIDE_STATUS_ENABLED ? createAddSlideV2StatusSettings({', 'status: false ? createAddSlideV2StatusSettings({')],
  ['page: Go to slide is not the viewer go-to', 'app/builder/page.tsx', s => s.replace('goToSlide: narrationNavigate,', 'goToSlide: () => {},')],
  ['page: Try again is not the rail card retry', 'app/builder/page.tsx', s => s.replace('?.onRetry?.(jobId) },', '?.onSelect?.(jobId) },')],
  ['page: the jobs are the ref, one render late', 'app/builder/page.tsx', s => s.replace('jobs: slideComposeJobs,\n                goToSlide', 'jobs: slideComposeJobsRef.current,\n                goToSlide')],
]
let caught = 0
for (const [name, rel, mutate] of MUTANTS) {
  const original = read(rel), mutated = mutate(original)
  assert.notEqual(mutated, original, `mutant "${name}" changed nothing: its anchor moved`)
  let failure = null
  try { await behaviourSuites({ sources: { [rel]: mutated }, panelSource: rel === PANEL ? mutated : undefined }) } catch (error) { failure = error }
  if (!failure) { try { pinsSuite({ [rel]: mutated }) } catch (error) { failure = error } }
  assert.ok(failure, `the suites did not notice: ${name}`)
  caught++
}

console.log(`PASS studio add-slide status: ${checks} checks, ${caught} of ${MUTANTS.length} mutants caught`)
