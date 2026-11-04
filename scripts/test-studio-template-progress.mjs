// Template "wow" flow, Studio half (frontend). Flag NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS (exact "true"), default off.
//
// Before: an uploaded template was one line, "Preparing template: cracking…", with every action of the Template library disabled until the whole
// job was done (up to 15 minutes for a 30-slide deck). Director (COMPOSER_TEMPLATE_PROGRESS_ENABLED) now saves the as-is template early and adds
// `template_progress`, `capabilities` and `poll` to GET /api/template-ingest/stage/jobs/{job_id} (streams/composer/TEMPLATE-PROGRESS-CONTRACT.md 2.2).
// With the flag on the library reads them: it polls at poll.next_interval_ms and stops on poll === null; opens "Use original" as soon as the as-is
// template is ready (toast "Ready to use as-is", once per job); shows slides_done / slide_count, the time left, the stage in words and one dot per
// slide (a slide kept as-is is a neutral dot); follows capabilities.new_topic.state ONLY for "New topic" (PK 13 Oct: an unlockable / kept slide never
// blocks new topics; toast "Template ready for new topics", once per job), with plain words and Director's own locking.message for a paused or
// failed lock; and lets a failed or stalled job ("Still working…", Retry, Dismiss) never block a new upload. The job id is kept in sessionStorage,
// so a reload goes on reading it. A finished card is never a dead end (follow-up to the first version): a failed job, or a lock that failed and Director
// calls retryable, keeps #406's Retry (the dialog's own Upload of the same chosen file, through its retryJob) and Dismiss; a refused, paused or
// otherwise unavailable one gets Dismiss; Dismiss forgets the stored job and stops the poll; a new upload replaces the card.
//
// Run: node scripts/test-studio-template-progress.mjs   (plain node: transpile + vm, a small hooks runtime, a virtual clock, no network, no writes)
//   TEMPLATE_PROGRESS_BASE=<commit> picks the base the flag-off identity is measured against (default 89b47f4, the studio-v4-dev-preparation-code
//   commit this branch was cut from).
//
// What is proved, on the REAL dialog, the REAL hook module and the REAL lib (the requests run for real against a fake /api/composer-library):
//   0. the fixtures are Director's real answers (scripts/fixtures/template-progress/capture-director-template-progress.py runs Director's own router and
//      serializer, branch seat2/director-template-wow, over ASGI against synthetic job rows): their provenance, the row fields and the three new ones;
//   1. the pure mapping (lib/studio-template-progress.ts) on every one of them: the stage words, the bar, the time left, one dot per slide, the as-is
//      rule, the new-topic rule (the slides are never read for it), the plain words (no reason code is ever drawn), the toasts (once per job), the upload
//      hold (a failed or stalled job never holds), the poll pace (poll.next_interval_ms; stop on null; the old 5 s when Director sends none), the watch;
//   2. flag off (unset, "false", "1", "TRUE", " true"): the dialog's tree, every request, session, upload, storage read/write and navigation equal the base
//      dialog's (sha256) for 12 scenarios; and the dialog's source minus the added lines is the base's, byte for byte;
//   3. flag on: the upload hands its job to the hook (the dialog is free at once); the poll follows Director's pace; Use original opens at as-is ready
//      (and works while Composer is still locking); new topics wait for new_topic.state alone; the stalled, failed, paused, refused, legacy and
//      "Director without the flow" answers; Retry and Dismiss; a reload goes on reading the stored job without repeating a toast; no request but the
//      user's own GETs and POSTs is ever made;
//   4. mutations: every rule above fails when its line is broken.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { DIALOG_ADDITIONS, stripTemplateProgress } from './studio-template-progress-strip.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.TEMPLATE_PROGRESS_BASE || '89b47f4'
const FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const DIALOG = 'components/builder/composer-library-dialog.tsx'
const HOOK = 'components/builder/composer-template-progress.tsx'
const LIB = 'lib/studio-template-progress.ts'
const CSS = 'components/builder/studio-composer-library.css'
const FIXTURE = 'scripts/fixtures/template-progress/director-template-progress-reads.json'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
const plain = value => JSON.parse(JSON.stringify(value))
const deq = (actual, expected, message) => message === undefined ? assert.deepStrictEqual(plain(actual), plain(expected)) : assert.deepStrictEqual(plain(actual), plain(expected), message)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
let checks = 0
const check = (fn, ...args) => { fn(...args); checks++ }

const branchSources = { [DIALOG]: read(DIALOG), [HOOK]: read(HOOK), [LIB]: read(LIB) }
const baseDialog = execFileSync('git', ['show', `${BASE}:${DIALOG}`], { cwd: root, encoding: 'utf8' })
const baseSources = { [DIALOG]: baseDialog }

// ---- 0. the fixtures: Director's real answers ----------------------------------------------------------------------------------------------
const FIX = JSON.parse(read(FIXTURE))
const ROW_FIELDS = ['job_id', 'session_id', 'user_id', 'status', 'upload_ref', 'template_id', 'presentation_id', 'viewer_url', 'slide_count',
  'per_slide_fidelity', 'checkpoint', 'errors', 'created_at', 'updated_at', 'completed_at'] // TemplateIngestJob.model_fields (src/models/template_ingest_job.py)
const NEW_FIELDS = ['template_progress', 'capabilities', 'poll']
const real = name => { const read = FIX.reads[name]; assert.ok(read, name); assert.equal(read.status_code, 200, name); return structuredClone(read.json) }
const TEMPLATE = 'f1x7ure0-0000-4000-8000-n0rthw1nd030'
const FILE_NAME = 'Deck03_Northwind_QBR.pptx'
const NOW = Date.parse(FIX.source.clock)

function fixtureChecks() {
  const { source, reads } = FIX
  check(assert.match, source.sha, /^[0-9a-f]{40}$/, 'the Director commit is named')
  check(assert.equal, source.branch, 'seat2/director-template-wow')
  check(assert.match, source.how, /Director's own router and serializer run over ASGI/)
  check(assert.ok, source.code.includes('src/services/composer_template_progress.py (project_progress, final_from_carrier, job_status_fields)'))
  check(assert.equal, Object.keys(reads).length, 18)
  for (const [name, entry] of Object.entries(reads)) {
    const keys = Object.keys(entry.json)
    if (entry.director_flag) deq(keys.filter(key => !NEW_FIELDS.includes(key)), ROW_FIELDS, `${name}: the row, field for field (all existing fields unchanged)`)
    else deq(keys, ROW_FIELDS, `${name}: Director's flag off adds nothing to the row`)
    check(assert.equal, NEW_FIELDS.every(field => keys.includes(field)), entry.director_flag, `${name}: the three fields come with Director's flag on only`)
    check(assert.equal, JSON.stringify(entry).match(/eyJ|sk-[A-Za-z0-9]|Bearer|password|secret|@[a-z0-9-]+\.[a-z]{2,}/i), null, `${name}: nothing secret and no address in it`)
  }
  // The frames' stages and capabilities are what Director's code says (CONTRACT 2.2): a spot check that the fixture was not edited into another shape.
  deq(Object.fromEntries(Object.entries(reads).map(([name, entry]) => [name, [entry.json.status, entry.json.capabilities?.use_original?.state ?? null,
    entry.json.capabilities?.new_topic?.state ?? null, entry.json.poll === undefined ? 'absent' : entry.json.poll === null ? 'null' : entry.json.poll.next_interval_ms + (entry.json.poll.stalled ? 'S' : '')]])), {
    converting: ['cracking', 'processing', 'processing', '3000'], checking: ['cracking', 'processing', 'processing', '5000'],
    'as-is-ready-mid-lock': ['cracking', 'available', 'processing', '2000'], 'locking-unlockable-kept': ['cracking', 'available', 'processing', '2000'],
    'done-available': ['complete', 'available', 'available', 'null'], 'done-available-one-kept': ['complete', 'available', 'available', 'null'],
    'paused-budget-done': ['complete', 'available', 'unavailable', 'null'], 'paused-budget-live': ['cracking', 'available', 'unavailable', '2000'],
    'locking-failed-done': ['complete', 'available', 'unavailable', 'null'], 'refused-done': ['complete', 'available', 'refused', 'null'],
    'failed-upload': ['failed', 'unavailable', 'unavailable', 'null'], 'stalled-locking': ['cracking', 'available', 'processing', '2000S'],
    'stalled-converting': ['cracking', 'processing', 'processing', '10000S'], 'legacy-running': ['cracking', 'processing', 'processing', '3000'],
    'legacy-complete': ['complete', 'available', 'unavailable', 'null'], 'new-topic-flag-disabled': ['complete', 'available', 'unavailable', 'null'],
    'flag-off-running': ['cracking', null, null, 'absent'], 'flag-off-complete': ['complete', null, null, 'absent'],
  })
}

// ---- module loader and hooks runtime (the job-recovery test's harness, with a virtual clock) -------------------------------------------------
const transpiled = new Map()
function createLoader({ sources, env, stubs, globals }) {
  const cache = new Map()
  const resolve = spec => {
    const base = path.join(root, spec.slice(2))
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return path.relative(root, base + suffix)
    throw new Error(`unresolved import ${spec}`)
  }
  function run(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const mod = { exports: {} }
    cache.set(rel, mod.exports)
    const source = sources[rel] ?? fs.readFileSync(path.join(root, rel), 'utf8')
    const key = sha(rel + '\0' + source)
    if (!transpiled.has(key)) {
      const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
      deq((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [], `${rel} transpiles`)
      transpiled.set(key, out.outputText)
    }
    const requireFor = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      // the dialog's report wrapper and the hook that reads a template's slides (NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT, default off) are loaded for real: flag off the
      // wrapper hands the row's block back as it is and the hook asks for nothing
      if (spec.startsWith('@/lib/') || spec === '@/components/builder/composer-template-progress' || spec === '@/components/builder/composer-admission-report' || spec === '@/components/builder/composer-admission-detail') return run(resolve(spec))
      throw new Error(`unexpected import ${spec} in ${rel}`)
    }
    vm.runInNewContext(transpiled.get(key), { module: mod, exports: mod.exports, process: { env }, console, ...globals, require: requireFor })
    cache.set(rel, mod.exports)
    return mod.exports
  }
  return { load: run }
}
const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
function createRuntime() {
  const cells = [], effects = []
  let cursor = 0, dirty = false
  const changed = (old, deps) => !old || !deps || deps.some((value, index) => !Object.is(value, old.deps?.[index]))
  const react = {
    useState(init) {
      const i = cursor++
      cells[i] ??= { value: typeof init === 'function' ? init() : init }
      const cell = cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(init) { const i = cursor++; return cells[i] ??= { current: init } },
    useCallback(fn, deps) { const i = cursor++, old = cells[i]; if (changed(old, deps)) cells[i] = { deps, value: fn }; return cells[i].value },
    useEffect(fn, deps) {
      const i = cursor++, old = cells[i]
      if (changed(old, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
  }
  return {
    react,
    render(Component, props) {
      for (let attempt = 0; attempt < 14; attempt++) {
        cursor = 0; dirty = false
        const tree = Component(props)
        while (effects.length) effects.shift()()
        if (!dirty) return tree
      }
      throw new Error('render did not settle')
    },
  }
}
/** Function components (the progress card) expanded to what they draw, so the tree can be searched. Hashes use the raw tree. */
const expand = node => Array.isArray(node) ? node.map(expand)
  : !node || typeof node !== 'object' ? node
    : typeof node.type === 'function' ? expand(node.type(node.props))
      : { ...node, props: { ...node.props, ...(node.props?.children === undefined ? {} : { children: expand(node.props.children) }) } }
const flat = node => Array.isArray(node) ? node.flatMap(flat) : !node || typeof node !== 'object' ? [] : [node, ...flat(node.props?.children)]
const text = node => Array.isArray(node) ? node.map(text).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)
const squash = value => value.replace(/\s+/g, ' ').trim()

// ---- the fake services and one mounted dialog -----------------------------------------------------------------------------------------------
const OWNER = 'local-owner'
const KEY = `deckster_composer_job_${encodeURIComponent(OWNER)}`
const PKEY = `deckster_composer_template_progress_${encodeURIComponent(OWNER)}`
const LAYOUT = 'https://layout-builder-v75-uat.up.railway.app'
const RESEARCHER = 'https://researcher-v11-uat.up.railway.app'
const OLDER = { id: 'f1x7ure0-0000-4000-8000-j1r0ll0ut006', name: 'J1-rollout-40-stores.pptx — upload 2026-10-12 22:21 UTC [f1x7ure0-0000-4000-8000-j1r0ll0ut006]', slide_count: 6,
  stage_template_summary: { schema_version: 'composer-template-v1', sha256: '1'.repeat(64), slide_count: 6 } }
const SAVED = { id: TEMPLATE, name: `${FILE_NAME} — upload 2026-10-15 12:00 UTC [${TEMPLATE}]`, slide_count: 30,
  stage_template_summary: { schema_version: 'composer-template-v1', sha256: '0'.repeat(64), slide_count: 30 } }
const UPLOAD_JOB = 'stage-upload-0001'
const SESSION = 'fresh-session-0001'

/**
 * `jobs`: job id -> what each GET gives in turn (the last repeats). An answer is a job object, or {__status, __body} for an error. `queue`: what each POST
 * (upload-reference, use) creates next: {job_id, answers}. `saved`: the template the list gains once an answer carried a template_id. Every request, session
 * create, upload, storage read/write and navigation is logged, in order; `times` holds the virtual time of each GET of a job.
 * `clock`: 'virtual' (timers wait for ui.advance) or 'auto' (a timer fires on the next tick, as the job-recovery test's harness does).
 */
function mount({ sources, flag, shell = true, stored = {}, jobs = {}, queue = [], saved = null, ditto = true, topic = true, auth = true, clock: clockMode = 'auto' }) {
  const log = [], times = [], toasts = [], store = new Map(Object.entries(stored)), answers = new Map(Object.entries(jobs).map(([id, list]) => [id, [...list]]))
  const pending = [...queue]
  let sessions = 0, clock = NOW, timerId = 0, listIncludesSaved = false
  const timers = []
  const reply = (status, data) => ({ ok: status < 400, status, json: async () => plain(data) })
  const fetch = async (url, init = {}) => {
    log.push(['fetch', init.method, url, init.body ?? null])
    const route = url.replace('/api/composer-library/', '')
    if (init.method === 'GET' && route === 'templates') return reply(200, { templates: [...(listIncludesSaved && saved ? [saved] : []), OLDER] })
    const job = /^jobs\/([^/]+)$/.exec(route)
    if (init.method === 'GET' && job) {
      const list = answers.get(decodeURIComponent(job[1]))
      if (!list) return reply(404, { detail: 'Stage ingest job not found' })
      times.push(clock - NOW)
      const answer = list.length > 1 ? list.shift() : list[0]
      if (answer.__status) return reply(answer.__status, answer.__body ?? { error: 'blip' })
      if (answer.template_id) listIncludesSaved = true
      return reply(200, answer)
    }
    if (init.method === 'POST' && (/^templates\/[^/]+\/use$/.test(route) || route === 'upload-reference')) {
      const next = pending.shift()
      assert.ok(next, `a POST ${route} the scenario did not expect`)
      answers.set(next.job_id, [...next.answers(JSON.parse(init.body).session_id)])
      return reply(202, { job_id: next.job_id, status: 'queued' })
    }
    return reply(404, { error: 'Not found' })
  }
  class VirtualDate extends Date {}
  VirtualDate.now = () => clock
  const globals = {
    fetch, URL, AbortController, DOMException, Error, Date: VirtualDate,
    setTimeout: clockMode === 'auto' ? callback => { setTimeout(callback, 0); return 1 }
      : (callback, ms = 0) => { timers.push({ id: ++timerId, at: clock + ms, callback }); return timerId },
    clearTimeout: clockMode === 'auto' ? () => {} : id => { const at = timers.findIndex(timer => timer.id === id); if (at >= 0) timers.splice(at, 1) },
    crypto: { randomUUID: () => `fresh-session-000${++sessions}` },
    sessionStorage: {
      getItem: key => { log.push(['getItem', key]); return store.get(key) ?? null },
      setItem: (key, value) => { log.push(['setItem', key, value]); store.set(key, value) },
      removeItem: key => { log.push(['removeItem', key]); store.delete(key) },
    },
    window: { location: { assign: url => log.push(['assign', url]) } },
  }
  const runtime = createRuntime()
  const env = { NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT, NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL: RESEARCHER,
    ...(shell ? { [SHELL]: 'true' } : {}), ...(ditto ? { NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED: 'true' } : {}),
    ...(topic ? { NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true' } : {}), ...(flag === undefined ? {} : { [FLAG]: flag }) }
  const stubs = {
    react: runtime.react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }),
    '@/components/ui/dialog': { Dialog: 'Dialog', DialogContent: 'DialogContent', DialogDescription: 'DialogDescription', DialogHeader: 'DialogHeader', DialogTitle: 'DialogTitle' },
    '@/components/ui/button': { Button: 'Button' }, '@/components/ui/textarea': { Textarea: 'Textarea' },
    '@/hooks/use-toast': { toast: value => { toasts.push(value); return {} } },
    '@/hooks/use-auth': { useAuth: () => ({ user: auth ? { id: OWNER } : null }) },
    '@/hooks/use-chat-sessions': { useChatSessions: () => ({ createSession: async (id, title) => { log.push(['createSession', id, title]); return true } }) },
    '@/lib/researcher-upload': { uploadFileToResearcher: async ({ sessionId, userId, file, intent, storageOnly, onProgress }) => {
      log.push(['uploadFileToResearcher', { sessionId, userId, file: file.name, size: file.size, intent, storageOnly }])
      onProgress?.({ percent: 100 })
      return { researcherSessionId: sessionId, storagePath: `${sessionId}/${file.name}` }
    } },
    '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: () => ({ status: 'allowed' }) },
    '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} },
  }
  const Dialog = createLoader({ sources, env, stubs, globals }).load(DIALOG).ComposerLibraryDialog
  let props = { open: true, onOpenChange() {} }
  let tree = null
  const ui = {
    log, store, times, toasts,
    get tree() { return tree },
    get now() { return clock - NOW },
    render(next = {}) { props = { ...props, ...next }; tree = runtime.render(Dialog, props); return tree },
    async settle(turns = 12) { ui.render(); for (let i = 0; i < turns; i++) { await tick(); ui.render() } return tree },
    /** Virtual time forward by `ms`: every timer due in that span fires in order, the page settling after each. */
    async advance(ms, turns = 6) {
      const target = clock + ms
      for (;;) {
        const due = timers.filter(timer => timer.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0]
        if (!due) break
        timers.splice(timers.indexOf(due), 1)
        clock = Math.max(clock, due.at)
        due.callback()
        await ui.settle(turns)
      }
      clock = target
      await ui.settle(turns)
    },
    all: () => flat(expand(tree)),
    buttons: label => ui.all().filter(node => node.type === 'Button' && squash(text(node)) === label),
    /** A click as a browser makes it: a disabled button does nothing. */
    click(label, index = 0) {
      const button = ui.buttons(label)[index]
      assert.ok(button, `button "${label}" #${index}`)
      if (button.props.disabled) return 'disabled'
      button.props.onClick()
      return 'clicked'
    },
    disabled(label, index = 0) { const button = ui.buttons(label)[index]; assert.ok(button, `button "${label}" #${index}`); return button.props.disabled },
    row: id => ui.all().find(node => node.props?.['data-studio-composer-record'] === id) ?? null,
    rowButton(id, label) { return flat(ui.row(id)).find(node => node.type === 'Button' && squash(text(node)) === label) },
    card: () => ui.all().find(node => node.type === 'div' && node.props?.className === 'space-y-2 rounded-md border p-3') ?? null,
    /** The card's lines, one per paragraph, in order (the buttons are separate). */
    cardLines: () => { const card = ui.card(); return card ? flat(card).filter(node => node.type === 'p').map(node => squash(text(node))) : null },
    cardButtons: () => { const card = ui.card(); return card ? flat(card).filter(node => node.type === 'Button').map(node => squash(text(node))) : [] },
    dots: () => ui.all().filter(node => node.props?.['data-studio-template-dot']).map(node => node.props['data-studio-template-dot']),
    bar: () => ui.all().find(node => node.props?.role === 'progressbar') ?? null,
    progress: () => ui.all().find(node => node.type === 'p' && node.props.role === 'status' && node.props['data-studio-composer-progress']) ?? null,
    busy: () => ui.all().some(node => node.type === 'Icon:Loader2'),
    chooseFile(file) { ui.all().find(node => node.props?.id === 'composer-template-file').props.onChange({ target: { files: [file] } }) },
    async close() { ui.render({ open: false }); await tick() },
  }
  return ui
}
const serverActions = log => log.filter(entry => entry[0] === 'fetch' ? entry[1] !== 'GET' : ['createSession', 'uploadFileToResearcher', 'assign'].includes(entry[0]))
const jobGets = log => log.filter(entry => entry[0] === 'fetch' && entry[1] === 'GET' && /\/jobs\//.test(entry[2]))
const asJob = (name, job_id = UPLOAD_JOB) => ({ ...real(name), job_id })
const uploadQueue = answers => [{ job_id: UPLOAD_JOB, answers: () => answers }]
const DECK = { name: FILE_NAME, size: 4096 }
/** Mount, choose the deck and press Upload template: the state right after the upload's POST. */
async function uploaded(sources, answers, opts = {}) {
  const ui = mount({ sources, flag: 'true', clock: 'virtual', saved: SAVED, jobs: {}, queue: uploadQueue(answers), ...opts })
  await ui.settle()
  ui.chooseFile(DECK); await ui.settle(2)
  assert.equal(ui.click('Upload template'), 'clicked')
  await ui.settle()
  return ui
}

// ---- 1. the pure mapping, on Director's real answers ----------------------------------------------------------------------------------------
const PAUSED = "Locking paused: today's analysis budget is used up. Reuse as-is works now."
const LOCK_FAILED = 'Locking could not finish. Reuse as-is works now.'
const dotCounts = view => view.dots.reduce((out, dot) => ({ ...out, [dot.kind]: (out[dot.kind] ?? 0) + 1 }), {})
/** What each real answer must come out as: [terminal, failed, stalled, detailed, statusLine, percent, countLabel, eta, dots, asIsReady, newTopic, newTopicLine, lockingNote, poll ms or null]. */
const EXPECTED = {
  converting: [false, false, false, true, 'Reading your presentation…', null, null, null, {}, false, 'processing', 'Preparing for new topics…', null, 3000],
  checking: [false, false, false, true, 'Checking the layout…', 0, '0 of 12 slides done', null, { queued: 12 }, false, 'processing', 'Preparing for new topics…', null, 5000],
  'as-is-ready-mid-lock': [false, false, false, true, 'Analysing your slides…', 33, '10 of 30 slides done', 'about 2 minutes left', { locked: 10, analysed: 4, working: 2, queued: 14 }, true, 'processing', 'Preparing for new topics…', null, 2000],
  'locking-unlockable-kept': [false, false, false, true, 'Analysing your slides…', 67, '8 of 12 slides done', 'about a minute left', { locked: 7, kept: 1, working: 2, queued: 2 }, true, 'processing', 'Preparing for new topics…', null, 2000],
  'done-available': [true, false, false, true, 'Template added to your library.', 100, '12 of 12 slides done', null, { locked: 12 }, true, 'available', 'Ready for new topics.', null, null],
  'done-available-one-kept': [true, false, false, true, 'Template added to your library.', 100, '12 of 12 slides done', null, { locked: 11, kept: 1 }, true, 'available', 'Ready for new topics.', null, null],
  'paused-budget-done': [true, false, false, true, 'Template added to your library.', 58, '7 of 12 slides done', null, { locked: 7, queued: 5 }, true, 'unavailable', null, PAUSED, null],
  'paused-budget-live': [false, false, false, true, 'Analysing your slides…', 58, '7 of 12 slides done', 'about a minute left', { locked: 7, working: 1, queued: 4 }, true, 'unavailable', null, PAUSED, 2000],
  'locking-failed-done': [true, false, false, true, 'Template added to your library.', 58, '7 of 12 slides done', null, { locked: 7, queued: 5 }, true, 'unavailable', null, LOCK_FAILED, null],
  'refused-done': [true, false, false, true, 'Template added to your library.', 58, '7 of 12 slides done', null, { locked: 7, queued: 5 }, true, 'refused', null, LOCK_FAILED, null],
  'failed-upload': [true, true, false, true, 'The upload could not be finished.', 0, '0 of 12 slides done', null, { queued: 12 }, false, 'unavailable', null, null, null],
  'stalled-locking': [false, false, true, true, 'Analysing your slides…', 67, '8 of 12 slides done', 'about a minute left', { locked: 7, kept: 1, working: 2, queued: 2 }, true, 'processing', 'Preparing for new topics…', null, 2000],
  'stalled-converting': [false, false, true, true, 'Reading your presentation…', null, null, null, {}, false, 'processing', 'Preparing for new topics…', null, 10000],
  'legacy-running': [false, false, false, false, 'Preparing template: cracking…', null, null, null, {}, false, 'processing', null, null, 3000],
  'legacy-complete': [true, false, false, false, 'Template added to your library.', null, null, null, {}, false, 'unavailable', null, null, null],
  'new-topic-flag-disabled': [true, false, false, true, 'Template added to your library.', 100, '12 of 12 slides done', null, { locked: 12 }, true, 'unavailable', 'New topics are not turned on yet. You can still use it as it is.', null, null],
  'flag-off-running': [false, false, false, false, 'Preparing template: cracking…', null, null, null, {}, false, null, null, null, 5000],
  'flag-off-complete': [true, false, false, false, 'Template added to your library.', null, null, null, {}, false, null, null, null, null],
}
const REASON_CODES = /[A-Z][A-Z0-9]+_[A-Z0-9_]+/
/** [retry, dismissible]: a failed job or a retryable lock failure offers Retry; every finished card that is not clean, and a stalled one, can be dismissed. */
const RETRY_DISMISS = {
  converting: [false, false], checking: [false, false], 'as-is-ready-mid-lock': [false, false], 'locking-unlockable-kept': [false, false],
  'done-available': [false, false], 'done-available-one-kept': [false, false], 'paused-budget-done': [false, true], 'paused-budget-live': [false, false],
  'locking-failed-done': [true, true], 'refused-done': [false, true], 'failed-upload': [true, true], 'stalled-locking': [false, true], 'stalled-converting': [false, true],
  'legacy-running': [false, false], 'legacy-complete': [false, false], 'new-topic-flag-disabled': [false, true], 'flag-off-running': [false, false], 'flag-off-complete': [false, false],
}

function pureChecks(sources) {
  const lib = createLoader({ sources, env: {}, stubs: {}, globals: { Date } }).load(LIB)
  const { templateProgressView, nextTemplatePollMs, templateActionHeld, templateUploadHeld, templateToastsDue, templateEtaWords, parseTrackedTemplateJob, templateProgressKey } = lib
  check(assert.equal, lib.TEMPLATE_POLL_FALLBACK_MS, 5000, 'the old interval of waitForComposerJob')

  // Every real answer: the view, the pace.
  deq(Object.keys(EXPECTED).sort(), Object.keys(FIX.reads).sort(), 'every captured answer is checked')
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const job = real(name), view = templateProgressView(job)
    deq([view.terminal, view.failed, view.stalled, view.detailed, view.statusLine, view.percent, view.countLabel, view.eta, dotCounts(view), view.asIsReady, view.newTopic, view.newTopicLine, view.lockingNote],
      expected.slice(0, 13), name)
    check(assert.equal, nextTemplatePollMs(job), expected[13], `${name}: the wait before the next read (null: stop)`)
    deq([view.retry, view.dismissible], RETRY_DISMISS[name], `${name}: [retry, dismissible]`)
    // Plain words: nothing Director sends as a code, a refusal, an element id or a role is ever drawn.
    const drawn = [view.statusLine, view.countLabel, view.eta, view.newTopicLine, view.lockingNote, view.failure, ...view.dots.map(dot => dot.label)].filter(Boolean).join(' | ')
    check(assert.equal, REASON_CODES.test(drawn), false, `${name}: no code in "${drawn}"`)
    for (const hidden of [job.capabilities?.new_topic?.reason_code, job.capabilities?.use_original?.reason_code, job.template_progress?.locking?.reason_code, job.capabilities?.new_topic?.refusal?.code,
      job.capabilities?.new_topic?.refusal?.site, ...(job.template_progress?.slides ?? []).flatMap(slide => [slide.reason_code, ...Object.keys(slide.fixed), ...Object.keys(slide.roles), ...Object.values(slide.roles)])]) {
      if (hidden) check(assert.equal, drawn.includes(hidden), false, `${name}: ${hidden} is not drawn`)
    }
  }
  // Retry is for a failed job or a retryable lock failure only: never refused, never paused, never a lock failure Director does not call retryable.
  const lockFailed = real('locking-failed-done')
  for (const [patch, retry, why] of [[{}, true, 'locking failed, retryable'], [{ capabilities: { ...lockFailed.capabilities, new_topic: { ...lockFailed.capabilities.new_topic, retryable: false } } }, false, 'locking failed, not retryable'],
    [{ capabilities: { ...lockFailed.capabilities, new_topic: { ...lockFailed.capabilities.new_topic, state: 'refused' } } }, false, 'refused even if retryable'],
    [{ status: 'cracking', poll: { next_interval_ms: 2000 } }, false, 'a lock that failed while the job still runs'],
    [{ capabilities: { ...lockFailed.capabilities, new_topic: { ...lockFailed.capabilities.new_topic, retryable: undefined } } }, false, 'retryable not said']]) {
    check(assert.equal, templateProgressView({ ...lockFailed, ...patch }).retry, retry, why)
  }
  check(assert.equal, templateProgressView({ ...real('paused-budget-done'), capabilities: { ...real('paused-budget-done').capabilities, new_topic: { state: 'unavailable', retryable: true } } }).retry, false, 'paused is never retried (no "Finish now" in this pass)')
  check(assert.equal, templateProgressView({ ...real('failed-upload'), status: 'cancelled' }).retry, true, 'a cancelled job is retried like a failed one (#406)')
  // Director's own words for a paused or failed lock are shown as they are, and only then.
  for (const name of ['paused-budget-done', 'paused-budget-live', 'locking-failed-done', 'refused-done']) {
    const job = real(name)
    check(assert.equal, templateProgressView(job).lockingNote, job.template_progress.locking.message, `${name}: locking.message verbatim`)
  }
  for (const name of Object.keys(EXPECTED)) if (!['paused-budget-done', 'paused-budget-live', 'locking-failed-done', 'refused-done'].includes(name)) check(assert.equal, templateProgressView(real(name)).lockingNote, null, name)

  // The poll pace: poll.next_interval_ms; stop on poll === null; the old 5 s when Director sends no `poll`; a usable value kept inside [1 s, 60 s].
  const running = real('as-is-ready-mid-lock')
  for (const [poll, expected] of [[{ next_interval_ms: 2000, stalled: false }, 2000], [{ next_interval_ms: 3000 }, 3000], [{ next_interval_ms: 10000 }, 10000], [{ next_interval_ms: 1 }, 1000],
    [{ next_interval_ms: 999999 }, 60000], [{ next_interval_ms: 0 }, 5000], [{ next_interval_ms: -5 }, 5000], [{ next_interval_ms: '2000' }, 5000], [{ next_interval_ms: NaN }, 5000], [{}, 5000], [undefined, 5000], [null, null]]) {
    check(assert.equal, nextTemplatePollMs({ ...running, poll }), expected, `poll ${JSON.stringify(poll)}`)
  }
  check(assert.equal, nextTemplatePollMs({ ...running, poll: undefined }, 7000), 7000, 'the fallback is the caller\'s')
  for (const status of ['complete', 'failed', 'cancelled']) check(assert.equal, nextTemplatePollMs({ ...running, status }), null, `a ${status} job is not polled again even if poll says so`)
  check(assert.equal, nextTemplatePollMs({ ...running, status: 'slide:3' }), 2000, 'a slide:N status is still running')

  // The time left in words; nothing when unknown.
  for (const [seconds, words] of [[null, null], [undefined, null], [0, null], [-4, null], [NaN, null], ['140', null], [1, 'less than a minute left'], [45, 'less than a minute left'], [46, 'about a minute left'],
    [90, 'about a minute left'], [91, 'about 2 minutes left'], [140, 'about 2 minutes left'], [600, 'about 10 minutes left'], [3599, 'about 60 minutes left'], [3600, 'more than an hour left']]) {
    check(assert.equal, templateEtaWords(seconds), words, `eta ${seconds}`)
  }

  // As-is: BOTH capabilities.use_original.state "available" AND template_progress.as_is.ready.
  const asIs = patch => templateProgressView({ ...running, ...patch }).asIsReady
  check(assert.equal, asIs({}), true)
  check(assert.equal, asIs({ capabilities: { ...running.capabilities, use_original: { state: 'processing' } } }), false, 'use_original not available')
  check(assert.equal, asIs({ capabilities: { ...running.capabilities, use_original: { state: 'unavailable', reason_code: 'UPLOAD_FAILED' } } }), false)
  check(assert.equal, asIs({ template_progress: { ...running.template_progress, as_is: { ...running.template_progress.as_is, ready: false } } }), false, 'as_is.ready false')
  check(assert.equal, asIs({ template_progress: { ...running.template_progress, as_is: null } }), false, 'no as_is')
  check(assert.equal, asIs({ template_progress: null }), false, 'no progress at all')
  check(assert.equal, asIs({ capabilities: null }), false, 'no capabilities')
  check(assert.equal, asIs({ capabilities: undefined }), false)

  // PK 13 Oct: a slide that is unlockable / kept as-is does not block new topics: "New topic" follows capabilities.new_topic.state and nothing else.
  const held = (job, action = 'new-topic') => templateActionHeld(templateProgressView(job), TEMPLATE, action)
  const withSlides = (job, slides) => ({ ...job, template_progress: { ...job.template_progress, slides } })
  const slide = (index, state, kept = false) => ({ slide_id: `slide-${index}`, index, state, fixed: {}, roles: {}, reason_code: kept ? 'LOW_CONFIDENCE' : null, kept_as_is: kept })
  const oneKept = real('done-available-one-kept')
  check(assert.equal, oneKept.template_progress.slides.filter(item => item.kept_as_is).length, 1, 'the real answer has a kept slide')
  check(assert.equal, oneKept.template_progress.slides.find(item => item.kept_as_is).state, 'unlockable')
  check(assert.equal, oneKept.template_progress.kept_as_is.length, 1, 'and lists it')
  check(assert.equal, held(oneKept), false, 'ONE unlockable / kept slide: new topics are available (real Director answer)')
  check(assert.equal, held(withSlides(oneKept, [1, 2, 3, 4].map(i => slide(i, 'unlockable', true)))), false, 'every slide unlockable and kept: still not blocked')
  check(assert.equal, held(withSlides(oneKept, [slide(1, 'unlockable', false), slide(2, 'queued'), slide(3, 'analysing')])), false, 'unlockable, queued, analysing slides: not read')
  check(assert.equal, held(withSlides(oneKept, [])), false, 'no slides at all: not read')
  const processing = real('locking-unlockable-kept')
  check(assert.equal, held(processing), true, 'new_topic processing holds it (the real answer, with its kept slide)')
  check(assert.equal, held(withSlides(processing, [1, 2, 3].map(i => slide(i, 'locked')))), true, 'every slide locked but new_topic still processing: held')
  check(assert.equal, held({ ...oneKept, capabilities: { ...oneKept.capabilities, new_topic: { invocation: 'job', state: 'processing' } } }), true, 'new_topic processing holds a done-looking template')
  for (const name of ['paused-budget-done', 'paused-budget-live', 'locking-failed-done', 'refused-done', 'new-topic-flag-disabled', 'as-is-ready-mid-lock', 'stalled-locking']) check(assert.equal, held(real(name)), true, `${name}: not available, so held`)
  for (const name of ['converting', 'checking', 'failed-upload', 'stalled-converting']) for (const action of ['use', 'ditto', 'new-topic']) check(assert.equal, held(real(name), action), false, `${name}: no template is saved yet, so no row to hold`)
  for (const name of ['done-available', 'done-available-one-kept']) check(assert.equal, held(real(name)), false, name)
  // No new-topic state to read (no template_progress: a Composer without the flow, or Director without it): nothing is held, as before the flag.
  for (const name of ['legacy-running', 'legacy-complete', 'flag-off-running', 'flag-off-complete']) check(assert.equal, held({ ...real(name), template_id: TEMPLATE }), false, `${name}: nothing to read, nothing held`)
  check(assert.equal, held({ ...oneKept, capabilities: null }), false, 'progress without capabilities: unknown is not "blocked"')
  check(assert.equal, held({ ...oneKept, capabilities: { use_original: { state: 'available' } } }), false)
  // Only the tracked job's own template is ever held; and there is nothing to hold with no view.
  check(assert.equal, templateActionHeld(templateProgressView(processing), 'some-other-template', 'new-topic'), false, 'another template')
  check(assert.equal, templateActionHeld(null, TEMPLATE, 'new-topic'), false, 'no view')
  check(assert.equal, templateActionHeld(null, TEMPLATE, 'use'), false)
  // Use original and Rebuild wait for the as-is template, unless the job has finished.
  for (const action of ['use', 'ditto']) {
    check(assert.equal, held({ ...running, capabilities: { ...running.capabilities, use_original: { state: 'processing' } } }, action), true, `${action}: not ready yet`)
    check(assert.equal, held(running, action), false, `${action}: as-is ready`)
    check(assert.equal, held(real('legacy-complete'), action), false, `${action}: a finished legacy job`)
    check(assert.equal, held({ ...real('flag-off-running'), template_id: TEMPLATE }, action), true, `${action}: a running job that has not said it is ready`)
  }
  for (const name of ['done-available', 'paused-budget-done', 'refused-done']) for (const action of ['use', 'ditto']) check(assert.equal, held(real(name), action), false, `${name}: ${action}`)

  // The upload hold: a job that is moving holds the button; a failed, stalled, cancelled, finished or unreadable one never does.
  const heldUpload = (name, problem = false) => templateUploadHeld(true, templateProgressView(real(name)), problem)
  for (const name of ['converting', 'checking', 'as-is-ready-mid-lock', 'locking-unlockable-kept', 'paused-budget-live', 'legacy-running', 'flag-off-running']) check(assert.equal, heldUpload(name), true, `${name}: moving, holds`)
  for (const name of ['failed-upload', 'stalled-locking', 'stalled-converting', 'done-available', 'done-available-one-kept', 'paused-budget-done', 'refused-done', 'locking-failed-done', 'legacy-complete', 'flag-off-complete']) check(assert.equal, heldUpload(name), false, `${name}: never holds`)
  check(assert.equal, heldUpload('as-is-ready-mid-lock', true), false, 'an answer that cannot be read does not hold')
  check(assert.equal, templateUploadHeld(true, null, false), true, 'just started, nothing read yet: held')
  check(assert.equal, templateUploadHeld(false, null, false), false, 'nothing tracked')
  check(assert.equal, templateUploadHeld(true, templateProgressView({ ...real('failed-upload'), status: 'cancelled' }), false), false, 'cancelled')

  // Toasts: each once per job. Through a whole upload (the answers in order), then a reload with the stored list.
  const story = ['converting', 'checking', 'as-is-ready-mid-lock', 'as-is-ready-mid-lock', 'locking-unlockable-kept', 'locking-unlockable-kept', 'done-available-one-kept', 'done-available-one-kept']
  let shown = [], titles = []
  for (const name of story) {
    const due = templateToastsDue(shown, templateProgressView(real(name)))
    shown = due.shown
    titles.push(...due.toasts.map(item => item.title))
  }
  deq(titles, ['Ready to use as-is', 'Template ready for new topics'], 'one of each, in order, never repeated')
  deq(shown, ['as_is', 'new_topic'])
  deq(templateToastsDue(shown, templateProgressView(real('done-available'))), { toasts: [], shown }, 'a reload with the stored list shows nothing again')
  // A finished job read for the first time (a return): only "ready for new topics", and the as-is one is counted as shown.
  const first = templateToastsDue([], templateProgressView(real('done-available-one-kept')))
  deq(first.toasts.map(item => item.title), ['Template ready for new topics']); deq(first.shown, ['new_topic', 'as_is'])
  // A paused job: the as-is toast only; no new-topic toast, ever.
  const pausedRun = ['as-is-ready-mid-lock', 'paused-budget-live', 'paused-budget-done'].reduce((out, name) => {
    const due = templateToastsDue(out.shown, templateProgressView(real(name)))
    return { shown: due.shown, titles: [...out.titles, ...due.toasts.map(item => item.title)] }
  }, { shown: [], titles: [] })
  deq(pausedRun.titles, ['Ready to use as-is'])
  for (const name of ['converting', 'checking', 'failed-upload', 'legacy-running', 'legacy-complete', 'flag-off-running', 'flag-off-complete', 'stalled-converting']) deq(templateToastsDue([], templateProgressView(real(name))).toasts, [], `${name}: nothing to announce`)
  check(assert.equal, templateToastsDue(['new_topic'], templateProgressView(real('done-available'))).toasts.length, 0)
  deq(templateToastsDue(['as_is'], templateProgressView(real('done-available'))).toasts.map(item => item.kind), ['new_topic'], 'as-is shown, new topics now ready')
  // The dots: a slide kept as-is is neutral whatever its state says; analysing is work in progress only while the job runs.
  const dotsOf = (job, slides) => templateProgressView(withSlides(job, slides)).dots.map(dot => [dot.index, dot.kind])
  deq(dotsOf(running, [slide(3, 'locked'), slide(1, 'queued'), slide(2, 'analysing'), slide(5, 'analysed'), slide(4, 'unlockable', true), slide(6, 'unlockable'), slide(7, 'locked', true), slide(8, 'weird')]),
    [[1, 'queued'], [2, 'working'], [3, 'locked'], [4, 'kept'], [5, 'analysed'], [6, 'kept'], [7, 'kept'], [8, 'queued']], 'sorted, one per slide')
  deq(dotsOf(real('paused-budget-done'), [slide(1, 'analysing')]), [[1, 'queued']], 'a finished job shows no slide as being worked on')
  deq(templateProgressView(withSlides(running, [slide(1, 'locked'), { index: 'x', state: 'locked' }, null, 'bad', { state: 'locked' }])).dots.map(dot => dot.index), [1], 'unreadable rows are skipped')
  deq(templateProgressView(withSlides(running, Array.from({ length: 400 }, (_, i) => slide(i + 1, 'queued')))).dots.length, 150, 'at most 150 dots')
  check(assert.equal, templateProgressView(withSlides(running, [slide(4, 'unlockable', true)])).dots[0].label, 'Slide 4: kept as it is')
  // The bar.
  check(assert.equal, templateProgressView({ ...running, template_progress: { ...running.template_progress, slide_count: 30, slides_done: 99 } }).percent, 100, 'never past 100')
  check(assert.equal, templateProgressView({ ...running, template_progress: { ...running.template_progress, slide_count: 0, slides_done: 0 } }).percent, null, 'no slides, no bar')
  check(assert.equal, templateProgressView({ ...running, template_progress: { ...running.template_progress, slide_count: null } }).percent, null, 'slide count unknown')
  check(assert.equal, templateProgressView({ ...running, template_progress: { ...running.template_progress, slides_done: null } }).countLabel, null)
  // The words for a new topic that is not available (never a code), with and without the as-is template.
  const reasons = (reason, state = 'unavailable', patch = {}) => templateProgressView({ ...real('done-available'), capabilities: { use_original: { state: 'available' }, new_topic: { invocation: 'job', state, reason_code: reason } }, ...patch }).newTopicLine
  check(assert.equal, reasons('FLAG_DISABLED'), 'New topics are not turned on yet. You can still use it as it is.')
  check(assert.equal, reasons('SEMANTIC_NOT_RUN'), 'New topics are not ready for this template. You can still use it as it is.')
  check(assert.equal, reasons('SEMANTIC_REFUSED', 'refused'), 'This template cannot be used for new topics. You can still use it as it is.')
  check(assert.equal, reasons('METADATA_FAILED'), 'New topics are not available for this template yet. You can still use it as it is.')
  check(assert.equal, reasons('SOMETHING_NEW'), 'New topics are not available for this template yet. You can still use it as it is.', 'an unknown code gets the generic words')
  check(assert.equal, reasons('UPLOAD_FAILED'), 'The upload did not finish.')
  check(assert.equal, reasons('FLAG_DISABLED', 'unavailable', { capabilities: { use_original: { state: 'processing' }, new_topic: { invocation: 'job', state: 'unavailable', reason_code: 'FLAG_DISABLED' } } }), 'New topics are not turned on yet.', 'no as-is claim before it is ready')
  // A paused or failed lock: Director's message, and the new-topic line does not repeat it.
  check(assert.equal, templateProgressView(real('paused-budget-live')).newTopicLine, null)
  check(assert.equal, templateProgressView({ ...real('paused-budget-live'), template_progress: { ...real('paused-budget-live').template_progress, locking: { state: 'paused', message: null } } }).lockingNote, null, 'no message, no note')
  check(assert.equal, templateProgressView({ ...real('paused-budget-live'), template_progress: { ...real('paused-budget-live').template_progress, locking: { state: 'running', message: 'ignored' } } }).lockingNote, null, 'a message of a running lock is not shown')
  // Hostile or broken answers never throw.
  for (const broken of [{}, { status: 'cracking' }, { status: 'cracking', template_progress: 'x', capabilities: 4, poll: 'soon' }, { status: 7 }, { template_progress: { slides: 'nope', slide_count: '3' } }, { status: 'cracking', template_progress: { slides: [null, 4, { index: 1 }] } }]) {
    check(assert.doesNotThrow, () => { templateProgressView(broken); nextTemplatePollMs(broken) }, undefined, JSON.stringify(broken))
  }

  // The stored record (sessionStorage is read back as untyped JSON).
  check(assert.equal, templateProgressKey('u@x'), 'deckster_composer_template_progress_u%40x')
  check(assert.equal, templateProgressKey(undefined), 'deckster_composer_template_progress_')
  deq(parseTrackedTemplateJob(JSON.stringify({ job_id: 'j', session_id: 's', file_name: 'a.pptx', shown: ['as_is', 'x', 4] })), { job_id: 'j', session_id: 's', file_name: 'a.pptx', shown: ['as_is'] })
  deq(parseTrackedTemplateJob(JSON.stringify({ job_id: 'j', session_id: 's' })), { job_id: 'j', session_id: 's', file_name: '', shown: [] })
  for (const bad of [null, undefined, '', '{not json', '[]', '"x"', '4', JSON.stringify({ job_id: '', session_id: 's' }), JSON.stringify({ job_id: 'j', session_id: '' }), JSON.stringify({ job_id: 'j' }), JSON.stringify({ job_id: 4, session_id: 's' })]) check(assert.equal, parseTrackedTemplateJob(bad), null, String(bad))
}

// ---- 1b. the watch loop ----------------------------------------------------------------------------------------------------------------------
async function watchChecks(sources) {
  const { watchTemplateJob, TEMPLATE_WATCH_LIMIT_MS } = createLoader({ sources, env: {}, stubs: {}, globals: { Date } }).load(LIB)
  /** Runs the loop on a script: each read gives the next item (a job, or an Error with a status); sleeps and clock are virtual. */
  async function drive(script, { abortAfterReads, limitMs, fallbackMs } = {}) {
    const controller = new AbortController()
    const events = [], sleeps = []
    let clock = 0, reads = 0
    const outcome = await watchTemplateJob({
      jobId: 'j', signal: controller.signal, fallbackMs, limitMs,
      now: () => clock,
      read: async () => { if (reads >= 60) throw new Error('runaway: the watch never stopped'); const item = script[Math.min(reads++, script.length - 1)]; if (abortAfterReads === reads) controller.abort(); if (item instanceof Error) throw item; return structuredClone(item) },
      onJob: job => events.push(['job', job.status, job.poll === undefined ? 'nopoll' : job.poll === null ? 'null' : job.poll.next_interval_ms]),
      onProblem: message => events.push(['problem', message]),
      sleep: async (ms, signal) => { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); sleeps.push(ms); clock += ms },
    })
    return { outcome, events, sleeps, reads }
  }
  const blip = status => Object.assign(new Error('blip'), { status })
  // At Director's pace, and it stops on poll === null: no read after the terminal answer.
  let got = await drive(['converting', 'checking', 'as-is-ready-mid-lock', 'locking-unlockable-kept', 'done-available-one-kept'].map(name => real(name)))
  deq(got.sleeps, [3000, 5000, 2000, 2000], 'one wait per answer, at that answer\'s own next_interval_ms')
  check(assert.equal, got.reads, 5, 'the terminal answer is the last read')
  check(assert.equal, got.outcome, 'terminal')
  deq(got.events.filter(event => event[0] === 'job').map(event => event[2]), [3000, 5000, 2000, 2000, 'null'])
  // Without `poll` (a Director without the flow): the old 5 s; the end is the terminal status.
  got = await drive([real('flag-off-running'), real('flag-off-running'), real('flag-off-complete')])
  deq(got.sleeps, [5000, 5000]); check(assert.equal, got.outcome, 'terminal'); check(assert.equal, got.reads, 3)
  got = await drive([real('flag-off-running'), real('flag-off-complete')], { fallbackMs: 4000 })
  deq(got.sleeps, [4000], 'the caller\'s fallback')
  // A failed job ends it too.
  got = await drive([real('converting'), real('failed-upload')]); deq(got.sleeps, [3000]); check(assert.equal, got.outcome, 'terminal')
  // A service blip (502, 503, 504) is retried; the same job is read again, up to three in a row; the fourth in a row ends it as unreadable.
  got = await drive([real('converting'), blip(503), blip(502), real('as-is-ready-mid-lock'), real('done-available')])
  deq(got.sleeps, [3000, 5000, 5000, 2000]); check(assert.equal, got.outcome, 'terminal'); check(assert.equal, got.reads, 5)
  got = await drive([real('converting'), blip(504), blip(504), blip(504), real('done-available')])
  check(assert.equal, got.outcome, 'terminal', 'three blips in a row are survived')
  got = await drive([real('converting'), blip(504), blip(504), blip(504), blip(504), real('done-available')])
  check(assert.equal, got.outcome, 'unreadable', 'four in a row are not'); check(assert.equal, got.reads, 5)
  deq(got.events.at(-1), ['problem', "We can't check this upload's progress right now."])
  got = await drive([real('converting'), blip(504), real('as-is-ready-mid-lock'), blip(504), real('as-is-ready-mid-lock'), blip(502), real('as-is-ready-mid-lock'), blip(503), real('done-available')])
  check(assert.equal, got.outcome, 'terminal', 'four blips that do not repeat are never counted together')
  // Anything else (a 404 for a job that is gone, a 401, a network error) ends it as unreadable, at once.
  for (const error of [blip(404), blip(401), blip(500), new TypeError('network'), new Error('x')]) {
    got = await drive([real('converting'), error])
    check(assert.equal, got.outcome, 'unreadable', String(error.status ?? error.message)); check(assert.equal, got.reads, 2)
  }
  // Aborted: nothing more is read, nothing is reported after it.
  got = await drive([real('converting')], { abortAfterReads: 1 })
  check(assert.equal, got.outcome, 'aborted'); check(assert.equal, got.events.filter(event => event[0] === 'job').length, 0, 'an answer that arrives after the abort is dropped')
  // A job that never ends is read for at most TEMPLATE_WATCH_LIMIT_MS.
  check(assert.equal, TEMPLATE_WATCH_LIMIT_MS, 90 * 60 * 1000)
  got = await drive([real('as-is-ready-mid-lock')], { limitMs: 10000 })
  check(assert.equal, got.outcome, 'limit'); check(assert.equal, got.sleeps.length, 5, '2 s each: reads at 0, 2, 4, 6, 8 and 10 s; the next wait would pass the limit')
  check(assert.ok, got.sleeps.reduce((a, b) => a + b, 0) <= 10000)
  // A failing display callback never stops the poll.
  {
    const controller = new AbortController(); let reads = 0
    const outcome = await watchTemplateJob({ jobId: 'j', signal: controller.signal, now: () => 0, sleep: async () => {}, onProblem() {},
      read: async () => real(reads++ < 2 ? 'as-is-ready-mid-lock' : 'done-available'), onJob() { throw new Error('a display error') } })
    check(assert.equal, outcome, 'terminal'); check(assert.equal, reads, 3)
  }
}

// ---- 2. flag off: the base dialog's tree, requests and writes, step for step ---------------------------------------------------------------------
const minutesAgo = minutes => new Date(NOW - minutes * 60 * 1000).toISOString().replace(/\.(\d{3})Z$/, '.$1417Z')
/** One TemplateIngestJob record as JSON (the job-recovery test's builders: Director's row shape, flow fields absent). */
const jobRecord = ({ job_id, session_id, status, updated_at, created_at = updated_at, ...rest }) => ({ job_id, session_id, user_id: 'prisma-user-fixture', status, upload_ref: {}, template_id: null,
  presentation_id: null, viewer_url: null, slide_count: null, per_slide_fidelity: [], checkpoint: {}, errors: [], created_at, updated_at, completed_at: null, ...rest })
const useJob = (job_id, session_id, template, status, rest = {}) => jobRecord({ job_id, session_id, status, updated_at: minutesAgo(0), upload_ref: { kind: 'template-use' }, template_id: template.id, ...rest })
const upJob = (job_id, session_id, status, rest = {}) => jobRecord({ job_id, session_id, status, updated_at: minutesAgo(0),
  upload_ref: { session_id, researcher_session_id: session_id, storage_path: `${session_id}/deck.pptx`, file_name: 'deck.pptx', kind: 'pptx' }, ...rest })
const completeUse = (job_id, session_id, template) => {
  const pid = '9b2f61c4-6f4e-4f5a-9d2b-0c1f1e7d3a55', viewer_url = `${LAYOUT}/p/${pid}`
  return useJob(job_id, session_id, template, 'complete', { presentation_id: pid, viewer_url, slide_count: 30, completed_at: minutesAgo(0),
    checkpoint: { operation: 'stage_template_replay', session_adoption: 'verified', result: { presentation_id: pid, template_id: template.id, template_sha256: '0'.repeat(64), viewer_url, slide_count: 30, model_calls: 0, spend_usd: 0, owner_html_replay: 'BYTE_IDENTICAL', session_id } } })
}
const completeUpload = (job_id, session_id) => upJob(job_id, session_id, 'complete', { template_id: 'new-template-1', presentation_id: '5a1f0e2d-0000-4000-8000-00000000c0de', viewer_url: `${LAYOUT}/p/5a1f0e2d-0000-4000-8000-00000000c0de`, slide_count: 6, completed_at: minutesAgo(0) })
const USE_JOB = 'stage-use-run-7e6d5c4b-3a29-4180-8f7e-6d5c4b3a2918'
const useQueue = (template, ending) => [{ job_id: USE_JOB, answers: session => [useJob(USE_JOB, session, template, 'assembling'), ending(USE_JOB, session, template)] }]
const failedUse = (job, session, template) => useJob(job, session, template, 'failed', { errors: ['Stored template could not be used; no automatic retry was made.'] })
const OLD_SESSION = 'b0b0b0b0-0000-4000-8000-000000000001'
const record = (job_id, session_id, kind) => JSON.stringify({ job_id, session_id, kind })
const SCENARIOS = {
  'open, nothing stored': { opts: {}, steps: [] },
  'Use original, complete': { opts: { queue: useQueue(OLDER, completeUse) }, steps: [ui => ui.click('Use original', 0)] },
  'Use original, failed': { opts: { queue: useQueue(OLDER, failedUse) }, steps: [ui => ui.click('Use original', 0)] },
  'Rebuild from own content, failed': { opts: { queue: useQueue(OLDER, failedUse) }, steps: [ui => ui.click('Rebuild from own content', 0)] },
  'New topic, complete': { opts: { queue: useQueue(OLDER, completeUse) }, steps: [ui => ui.click('New topic', 0),
    ui => ui.all().find(node => node.type === 'Textarea').props.onChange({ target: { value: 'Quarterly results for the regional sales team, with three numbers.' } }),
    ui => ui.click('Create deck')] },
  'Upload, complete (the base waits for the whole job)': { opts: { queue: [{ job_id: 'stage-up-1', answers: session => [upJob('stage-up-1', session, 'cracking'), completeUpload('stage-up-1', session)] }] },
    steps: [ui => ui.chooseFile({ name: 'deck.pptx', size: 4096 }), ui => ui.click('Upload template')] },
  'Upload, failed': { opts: { queue: [{ job_id: 'stage-up-2', answers: session => [upJob('stage-up-2', session, 'failed', { errors: ['Template upload could not be completed; no automatic retry was made.'] })] }] },
    steps: [ui => ui.chooseFile({ name: 'deck.pptx', size: 4096 }), ui => ui.click('Upload template')] },
  'Upload, Director with the flow: answers carry template_progress': { opts: { queue: [{ job_id: UPLOAD_JOB, answers: () => ['converting', 'as-is-ready-mid-lock', 'done-available'].map(name => asJob(name)) }], saved: SAVED },
    steps: [ui => ui.chooseFile({ name: FILE_NAME, size: 4096 }), ui => ui.click('Upload template')] },
  'stored upload job, cracking': { opts: { stored: { [KEY]: record('stage-up-3', OLD_SESSION, 'upload') }, jobs: { 'stage-up-3': [upJob('stage-up-3', OLD_SESSION, 'cracking')] } }, steps: [] },
  'stored use job, failed': { opts: { stored: { [KEY]: record(USE_JOB, OLD_SESSION, 'use') }, jobs: { [USE_JOB]: [failedUse(USE_JOB, OLD_SESSION, OLDER)] } }, steps: [] },
  'stored use job, not found': { opts: { stored: { [KEY]: record('stage-use-run-gone', OLD_SESSION, 'use') } }, steps: [] },
  'composer popup request': { opts: { queue: useQueue(OLDER, completeUse) }, request: { action: 'use', template: OLDER }, steps: [] },
}
async function play(sources, flag, name, { shell = true } = {}) {
  const scenario = SCENARIOS[name]
  const ui = mount({ sources, flag, shell, ...scenario.opts })
  if (scenario.request) ui.render({ request: scenario.request, onRequestTaken() {} })
  await ui.settle()
  const snaps = [ser(ui.tree)]
  for (const step of scenario.steps) { step(ui); await ui.settle(); snaps.push(ser(ui.tree)) }
  snaps.push(ser(ui.log))
  await ui.close()
  return { ui, hash: sha(snaps.join('\n')) }
}

function sourceChecks(sources) {
  const dialog = sources[DIALOG], hook = sources[HOOK], lib = sources[LIB]
  // The dialog minus the added lines is the base's, byte for byte: nothing else was touched; and every addition is there exactly once.
  const stripped = stripTemplateProgress(DIALOG, dialog)
  check(assert.equal, stripped, baseDialog, `the dialog without the added lines is ${BASE}'s`)
  for (const [from] of DIALOG_ADDITIONS) check(assert.equal, (dialog.match(new RegExp(from.source, 'g')) ?? []).length, 1, `one: ${from.source.slice(0, 70)}`)
  check(assert.equal, /emplateProgress|TEMPLATE_PROGRESS/.test(stripped), false, 'nothing of this change is left after the strip')
  check(assert.equal, stripTemplateProgress('components/other.tsx', dialog), dialog, 'any other file comes back as it is')
  // The flag is read once, inline, as the exact string "true"; the hook and the lib read no environment.
  check(assert.equal, dialog.split("process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS === 'true'").length, 2)
  check(assert.equal, (dialog.match(/process\.env\.NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS/g) ?? []).length, 1)
  check(assert.equal, /process\.env|NEXT_PUBLIC/.test(hook.replace(/^\/\/.*$/gm, '')) || /process\.env/.test(lib.replace(/^\/\/.*$/gm, '')), false, 'only the dialog reads the flag')
  check(assert.equal, /^import |require\(/m.test(lib.replace(/^\/\/.*$/gm, '').replace(/^import type [^\n]*\n/m, '')), false, 'the lib is pure: its only import is a type')
  // The stylesheet: the base's rules untouched, and the added ones are all scoped to the card's marker (which exists only with the flag on).
  const css = read(CSS), baseCss = execFileSync('git', ['show', `${BASE}:${CSS}`], { cwd: root, encoding: 'utf8' })
  check(assert.equal, css.startsWith(baseCss), true, 'the stylesheet only gains rules at its end')
  const added = css.slice(baseCss.length).split('\n').filter(line => line && !line.startsWith('/*'))
  check(assert.ok, added.length > 8)
  for (const line of added) check(assert.match, line, /^(\[data-studio-template-progress="true"\]|@keyframes scl-dot-pulse|@media \(prefers-reduced-motion: reduce\) \{ \[data-studio-template-progress="true"\])/, line.slice(0, 80))
  check(assert.equal, (dialog.match(/data-studio-template-progress/g) ?? []).length, 0, 'the dialog itself never draws the marker')
  // Documented default off, the script registered, and set nowhere by default.
  check(assert.equal, (read('.env.example').match(/^NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS="false"$/gm) ?? []).length, 1, '.env.example documents the flag, default off')
  check(assert.equal, JSON.parse(read('package.json')).scripts['test:studio-template-progress'], 'node scripts/test-studio-template-progress.mjs', 'the script is registered')
  for (const file of ['vercel.json', 'vercel.dev.json']) check(assert.equal, read(file).includes('STUDIO_TEMPLATE_PROGRESS'), false, `${file} does not turn it on`)
}

async function flagOffChecks(sources) {
  for (const shell of [true, false]) for (const name of Object.keys(SCENARIOS)) {
    const base = (await play(baseSources, undefined, name, { shell })).hash
    for (const flag of [undefined, 'false', '1', 'TRUE', ' true']) {
      check(assert.equal, (await play(sources, flag, name, { shell })).hash, base, `flag ${JSON.stringify(flag)}, shell ${shell}: ${name}`)
    }
  }
  // The hook reads nothing and writes nothing of its own with the flag off.
  for (const flag of [undefined, 'false']) {
    const ui = mount({ sources, flag, ...SCENARIOS['Upload, complete (the base waits for the whole job)'].opts })
    await ui.settle(); ui.chooseFile({ name: 'deck.pptx', size: 4096 }); await ui.settle(2); ui.click('Upload template'); await ui.settle()
    check(assert.equal, ui.log.some(entry => JSON.stringify(entry).includes('template_progress')), false, 'no storage key of the hook')
    check(assert.equal, ui.card(), null)
    await ui.close()
  }
  // Flag on, nothing tracked: the dialog is the base's (tree and requests; the only extra is the hook's one read of its own key).
  for (const shell of [true, false]) for (const name of ['open, nothing stored', 'Use original, complete', 'New topic, complete', 'stored use job, failed']) {
    const base = await play(baseSources, undefined, name, { shell }), lit = await play(sources, 'true', name, { shell })
    const trace = log => ser(log.filter(entry => entry[0] !== 'getItem' || entry[1] !== PKEY))
    check(assert.equal, trace(lit.ui.log), trace(base.ui.log), `flag on, nothing tracked, shell ${shell}: ${name}: the same requests, session and storage writes`)
    check(assert.equal, lit.ui.card(), null)
  }
  { const base = mount({ sources: baseSources, flag: undefined }), lit = mount({ sources, flag: 'true' }); await base.settle(); await lit.settle()
    check(assert.equal, ser(lit.tree), ser(base.tree), 'flag on, nothing tracked: the same tree as the base'); await base.close(); await lit.close() }
}

// ---- 3. flag on ------------------------------------------------------------------------------------------------------------------------------
const FRAME_3 = [FILE_NAME, 'Analysing your slides…', '10 of 30 slides done · about 2 minutes left', 'Ready to use as it is.', 'Preparing for new topics…']
const ACTIONS = ['Use original', 'Rebuild from own content', 'New topic']
const rowState = (ui, id) => Object.fromEntries(ACTIONS.map(label => [label, ui.rowButton(id, label).props.disabled]))
const GETS = ui => ui.times
const toastTitles = ui => ui.toasts.map(item => item.title)
async function flagOnChecks(sources) {
  const FRAMES = ['converting', 'checking', 'as-is-ready-mid-lock', 'locking-unlockable-kept', 'done-available-one-kept']

  // A whole upload, at Director's pace. Right after the POST: the dialog is free, the job is on its way, the first answer is drawn.
  for (const shell of [true, false]) {
    const ui = await uploaded(sources, FRAMES.map(name => asJob(name)), { shell })
    deq(serverActions(ui.log).map(entry => entry[0] === 'fetch' ? ['POST', entry[2]] : [entry[0]]), [['createSession'], ['uploadFileToResearcher'], ['POST', '/api/composer-library/upload-reference']], 'the upload makes its three requests')
    check(assert.equal, JSON.parse(ui.log.find(entry => entry[0] === 'fetch' && entry[1] === 'POST')[3]).file_name, FILE_NAME)
    check(assert.equal, ui.busy(), false, 'the dialog is not busy: it is not waiting for the job')
    check(assert.equal, ui.progress(), null, 'the "Uploading presentation" line is gone')
    deq(JSON.parse(ui.store.get(PKEY)), { job_id: UPLOAD_JOB, session_id: SESSION, file_name: FILE_NAME, shown: [] }, 'the job id is kept in sessionStorage')
    check(assert.equal, ui.store.has(KEY), false, 'the old pending-job key is not used (nothing waits on it)')
    check(assert.equal, ui.card().props['data-studio-template-progress'], shell ? 'true' : undefined, 'the Studio marker follows the shell')
    deq(ui.cardLines(), [FILE_NAME, 'Reading your presentation…', 'Preparing for new topics…'])
    check(assert.equal, ui.bar(), null, 'no slide count yet: no bar'); deq(ui.dots(), [])
    deq(ui.cardButtons(), [], 'a job that is moving has no Retry or Dismiss')
    deq(ui.times, [0], 'the first read is at once')
    for (const label of ACTIONS) check(assert.equal, ui.disabled(label), false, `the library stays usable: ${label} of the older template`)
    ui.chooseFile(DECK); await ui.settle(2)
    check(assert.equal, ui.disabled('Upload template'), true, 'a job that is moving holds the Upload button')
    if (shell === false) { await ui.close(); continue }

    await ui.advance(2999); deq(ui.times, [0], 'nothing before poll.next_interval_ms (3000)')
    await ui.advance(1); deq(ui.times, [0, 3000])
    deq(ui.cardLines(), [FILE_NAME, 'Checking the layout…', '0 of 12 slides done', 'Preparing for new topics…'])
    check(assert.equal, ui.bar().props['aria-valuenow'], 0); deq(ui.dots(), Array(12).fill('queued'))
    await ui.advance(4999); deq(ui.times, [0, 3000], 'checking asked for 5000')
    deq(toastTitles(ui), [])
    await ui.advance(1); deq(ui.times, [0, 3000, 8000])
    // As-is ready: the toast, the row, Use original (and Rebuild) open; New topic waits.
    deq(toastTitles(ui), ['Ready to use as-is'])
    deq(ui.cardLines(), FRAME_3)
    check(assert.equal, ui.bar().props['aria-valuenow'], 33)
    deq(dotCounts({ dots: ui.dots().map(kind => ({ kind })) }), { locked: 10, analysed: 4, working: 2, queued: 14 })
    check(assert.ok, ui.row(TEMPLATE), 'the as-is template is a row of the library now (the list was read again)')
    deq(rowState(ui, TEMPLATE), { 'Use original': false, 'Rebuild from own content': false, 'New topic': true }, 'Use original is open; New topic waits for new_topic.state')
    deq(rowState(ui, OLDER.id), { 'Use original': false, 'Rebuild from own content': false, 'New topic': false }, 'the other template is untouched')
    check(assert.equal, ui.disabled('Upload template'), true)
    await ui.advance(2000); deq(ui.times, [0, 3000, 8000, 10000])
    deq(toastTitles(ui), ['Ready to use as-is'], 'not shown again')
    deq(ui.cardLines(), [FILE_NAME, 'Analysing your slides…', '8 of 12 slides done · about a minute left', 'Ready to use as it is.', 'Preparing for new topics…'])
    check(assert.equal, ui.dots().filter(kind => kind === 'kept').length, 1, 'the kept slide is a neutral dot')
    check(assert.equal, ui.rowButton(TEMPLATE, 'New topic').props.disabled, true, 'new_topic is still processing')
    // Done, with one slide kept as-is: new topics are open (the slide does not block them).
    await ui.advance(2000); deq(ui.times, [0, 3000, 8000, 10000, 12000])
    deq(toastTitles(ui), ['Ready to use as-is', 'Template ready for new topics'])
    deq(ui.cardLines(), [FILE_NAME, 'Template added to your library.', '12 of 12 slides done', 'Ready for new topics.'])
    deq(dotCounts({ dots: ui.dots().map(kind => ({ kind })) }), { locked: 11, kept: 1 })
    deq(rowState(ui, TEMPLATE), { 'Use original': false, 'Rebuild from own content': false, 'New topic': false }, 'ONE kept slide: New topic is enabled')
    check(assert.equal, ui.store.has(PKEY), false, 'a clean finish is forgotten')
    check(assert.equal, ui.disabled('Upload template'), true, 'a clean finish lets go of the chosen file, as a finished upload always did')
    ui.chooseFile(DECK); await ui.settle(2); check(assert.equal, ui.disabled('Upload template'), false, 'and a finished job does not hold the Upload button')
    await ui.advance(10 * 60 * 1000); deq(ui.times.length, 5, 'poll === null: no read after the terminal answer')
    check(assert.equal, ui.toasts.length, 2)
    // Everything the page asked for was the user\'s own GET or POST.
    const requests = ui.log.filter(entry => entry[0] === 'fetch').map(entry => `${entry[1]} ${entry[2].replace('/api/composer-library/', '')}`)
    check(assert.ok, requests.every(request => ['GET templates', `GET jobs/${UPLOAD_JOB}`, 'POST upload-reference'].includes(request)), requests.join(', '))
    check(assert.ok, requests.filter(request => request === 'GET templates').length >= 3, 'the list is read at open, at as-is ready and at the end')
    await ui.close()
  }

  // Use original works while Composer is still locking (the saved as-is template), and the poll keeps going meanwhile.
  {
    const ui = await uploaded(sources, FRAMES.map(name => asJob(name)), { queue: [...uploadQueue(FRAMES.map(name => asJob(name))), ...useQueue(SAVED, completeUse)] })
    await ui.advance(3000); await ui.advance(5000)
    check(assert.equal, ui.rowButton(TEMPLATE, 'Use original').props.disabled, false)
    ui.rowButton(TEMPLATE, 'Use original').props.onClick(); await ui.settle()
    const post = ui.log.find(entry => entry[0] === 'fetch' && entry[1] === 'POST' && entry[2].includes('/use'))
    check(assert.equal, post[2], `/api/composer-library/templates/${TEMPLATE}/use`)
    check(assert.equal, ui.busy(), true, 'the use job is waited for as ever')
    const before = ui.times.length
    await ui.advance(2000); check(assert.ok, ui.times.length > before, 'the upload job is still being read')
    await ui.advance(5000); check(assert.equal, ui.log.some(entry => entry[0] === 'assign' && entry[1].startsWith('/builder?session_id=')), true, 'the deck opens')
    await ui.close()
  }

  // Paused for budget: Director's words; Use original open; New topic closed; the as-is toast only; the record stays, so a reload reads it once.
  {
    const ui = await uploaded(sources, ['as-is-ready-mid-lock', 'paused-budget-live', 'paused-budget-done'].map(name => asJob(name)))
    await ui.advance(2000); await ui.advance(2000)
    deq(ui.times, [0, 2000, 4000])
    deq(ui.cardLines(), [FILE_NAME, 'Template added to your library.', '7 of 12 slides done', PAUSED])
    deq(rowState(ui, TEMPLATE), { 'Use original': false, 'Rebuild from own content': false, 'New topic': true })
    deq(toastTitles(ui), ['Ready to use as-is'])
    deq(JSON.parse(ui.store.get(PKEY)).shown, ['as_is'], 'the record keeps what was shown')
    await ui.advance(60000); deq(ui.times, [0, 2000, 4000])
    ui.chooseFile(DECK); await ui.settle(2); check(assert.equal, ui.disabled('Upload template'), false, 'a finished job (paused lock) does not hold the Upload button')
    await ui.close()
    // Reload (a new page, the same sessionStorage): one read, the same card, no toast again.
    const again = mount({ sources, flag: 'true', clock: 'virtual', saved: SAVED, stored: { [PKEY]: ui.store.get(PKEY) }, jobs: { [UPLOAD_JOB]: [asJob('paused-budget-done')] } })
    await again.settle(); await again.advance(60000)
    deq(again.times, [0], 'a finished job is read once, not polled')
    deq(again.cardLines(), [FILE_NAME, 'Template added to your library.', '7 of 12 slides done', PAUSED])
    deq(toastTitles(again), [], 'the toast is not repeated after a reload')
    deq(rowState(again, TEMPLATE), { 'Use original': false, 'Rebuild from own content': false, 'New topic': true })
    check(assert.equal, again.log.some(entry => entry[0] === 'removeItem'), false, 'the record is kept')
    await again.close()
  }
  // Refused and failed locks: Director's message, New topic closed, Use original open.
  for (const name of ['refused-done', 'locking-failed-done']) {
    const ui = mount({ sources, flag: 'true', clock: 'virtual', saved: SAVED, stored: { [PKEY]: JSON.stringify({ job_id: UPLOAD_JOB, session_id: SESSION, file_name: FILE_NAME, shown: ['as_is'] }) }, jobs: { [UPLOAD_JOB]: [asJob(name)] } })
    await ui.settle()
    deq(ui.cardLines(), [FILE_NAME, 'Template added to your library.', '7 of 12 slides done', LOCK_FAILED], name)
    deq(rowState(ui, TEMPLATE), { 'Use original': false, 'Rebuild from own content': false, 'New topic': true }, name)
    check(assert.equal, /SEMANTIC|REFUSED|METADATA|D10|COMPOSER/.test(ui.cardLines().join(' ')), false, `${name}: no code`)
    deq(ui.cardButtons(), ['Dismiss'], `${name}: no file is chosen in this page, so there is nothing to Retry`)
    ui.click('Dismiss'); await ui.settle()
    check(assert.equal, ui.card(), null, `${name}: Dismiss`); check(assert.equal, ui.store.has(PKEY), false, `${name}: and the stored job is forgotten`)
    await ui.close()
  }
  // Director's own new-topic flag off: plain words.
  {
    const ui = mount({ sources, flag: 'true', clock: 'virtual', saved: SAVED, stored: { [PKEY]: JSON.stringify({ job_id: UPLOAD_JOB, session_id: SESSION, file_name: FILE_NAME, shown: ['as_is'] }) }, jobs: { [UPLOAD_JOB]: [asJob('new-topic-flag-disabled')] } })
    await ui.settle()
    deq(ui.cardLines().slice(-1), ['New topics are not turned on yet. You can still use it as it is.'])
    check(assert.equal, ui.rowButton(TEMPLATE, 'New topic').props.disabled, true)
    await ui.close()
  }

  // Stalled: "Still working…", Retry and Dismiss; the library and the Upload button stay usable; the poll goes on; Retry reads at once; Dismiss forgets it.
  {
    const ui = await uploaded(sources, ['as-is-ready-mid-lock', 'stalled-locking'].map(name => asJob(name)))
    await ui.advance(2000)
    deq(ui.cardLines(), [FILE_NAME, 'Analysing your slides…', '8 of 12 slides done · about a minute left', 'Ready to use as it is.', 'Preparing for new topics…', 'Still working…'])
    deq(ui.cardButtons(), ['Retry', 'Dismiss'])
    ui.chooseFile(DECK); await ui.settle(2); check(assert.equal, ui.disabled('Upload template'), false, 'a stalled job does not hold the Upload button')
    check(assert.equal, ui.rowButton(TEMPLATE, 'Use original').props.disabled, false)
    deq(ui.times, [0, 2000]); await ui.advance(2000); deq(ui.times, [0, 2000, 4000], 'it is still read')
    check(assert.equal, ui.click('Retry'), 'clicked'); await ui.settle()
    deq(ui.times, [0, 2000, 4000, 4000], 'Retry reads at once')
    const before = ui.log.length
    check(assert.equal, ui.click('Dismiss'), 'clicked'); await ui.settle()
    check(assert.equal, ui.card(), null, 'the card is gone'); check(assert.equal, ui.store.has(PKEY), false, 'and forgotten')
    deq(ui.log.slice(before).filter(entry => entry[0] === 'fetch'), [], 'Dismiss asks nothing of the server')
    await ui.advance(60000); deq(ui.times, [0, 2000, 4000, 4000], 'and nothing is read any more')
    for (const label of ACTIONS) check(assert.equal, ui.rowButton(TEMPLATE, label).props.disabled, false, `${label}: nothing is held once dismissed`)
    await ui.close()
  }
  { // a job stalled before any template exists
    const ui = await uploaded(sources, ['converting', 'stalled-converting'].map(name => asJob(name)))
    await ui.advance(3000)
    deq(ui.cardLines(), [FILE_NAME, 'Reading your presentation…', 'Preparing for new topics…', 'Still working…']); deq(ui.cardButtons(), ['Retry', 'Dismiss'])
    ui.chooseFile(DECK); await ui.settle(2); check(assert.equal, ui.disabled('Upload template'), false)
    await ui.advance(10000); deq(ui.times, [0, 3000, 13000], 'at the interval it asked for (10000)')
    await ui.close()
  }
  // Failed: Director's words; nothing is held; the poll ended; the record is forgotten; no toast.
  {
    const ui = await uploaded(sources, ['converting', 'failed-upload'].map(name => asJob(name)))
    await ui.advance(3000)
    deq(ui.cardLines(), [FILE_NAME, 'Your last template upload could not be finished. Template upload could not be completed; no automatic retry was made.'], "#406's words, Director's text after them")
    deq(ui.cardButtons(), ['Retry', 'Dismiss'], 'the file is still chosen, so #406\'s Retry is offered')
    check(assert.equal, ui.bar(), null); deq(ui.dots(), [])
    ui.chooseFile(DECK); await ui.settle(2); check(assert.equal, ui.disabled('Upload template'), false, 'a failed job never holds the Upload button')
    check(assert.equal, ui.store.has(PKEY), false); deq(ui.toasts, [])
    await ui.advance(60000); deq(ui.times, [0, 3000])
    await ui.close()
  }
  await retryAndDismissChecks(sources)
  { // a new upload after a failed one starts a new job
    const second = 'stage-upload-0002'
    const ui = await uploaded(sources, ['failed-upload'].map(name => asJob(name)), { queue: [...uploadQueue(['failed-upload'].map(name => asJob(name))), { job_id: second, answers: () => [asJob('converting', second)] }] })
    ui.chooseFile({ name: 'second.pptx', size: 10 }); await ui.settle(2)
    check(assert.equal, ui.disabled('Upload template'), false, 'the failed job does not block it')
    ui.click('Upload template'); await ui.settle()
    deq(JSON.parse(ui.store.get(PKEY)), { job_id: second, session_id: 'fresh-session-0002', file_name: 'second.pptx', shown: [] })
    deq(ui.cardLines(), ['second.pptx', 'Reading your presentation…', 'Preparing for new topics…'], 'the new job replaces the old card')
    await ui.close()
  }
  // A Composer without the flow (Director's answers carry capabilities and poll, template_progress is null): the old status line, nothing held, no toasts.
  {
    const ui = await uploaded(sources, ['legacy-running', 'legacy-running', 'legacy-complete'].map(name => asJob(name)))
    deq(ui.cardLines(), [FILE_NAME, 'Preparing template: cracking…'])
    await ui.advance(3000); await ui.advance(3000); deq(ui.times, [0, 3000, 6000], 'at poll.next_interval_ms (3000)')
    deq(ui.cardLines(), [FILE_NAME, 'Template added to your library.'])
    deq(rowState(ui, TEMPLATE), { 'Use original': false, 'Rebuild from own content': false, 'New topic': false }, 'nothing is held (unavailable SEMANTIC_NOT_RUN is not read without template_progress)')
    deq(ui.toasts, []); check(assert.equal, ui.store.has(PKEY), false)
    ui.chooseFile(DECK); await ui.settle(2); check(assert.equal, ui.disabled('Upload template'), false, 'a finished job does not hold the Upload button')
    await ui.close()
  }
  // A Director without the flow (no `poll`, no capabilities): the old 5 s, the old status lines, nothing held.
  {
    const ui = await uploaded(sources, ['flag-off-running', 'flag-off-running', 'flag-off-complete'].map(name => asJob(name)))
    deq(ui.cardLines(), [FILE_NAME, 'Preparing template: cracking…'])
    await ui.advance(5000); await ui.advance(5000); deq(ui.times, [0, 5000, 10000], 'the old interval')
    deq(ui.cardLines(), [FILE_NAME, 'Template added to your library.'])
    deq(rowState(ui, TEMPLATE), { 'Use original': false, 'Rebuild from own content': false, 'New topic': false })
    deq(ui.toasts, []); await ui.advance(60000); deq(ui.times, [0, 5000, 10000])
    await ui.close()
  }

  // Back to the job after a reload: the stored job is read again at once and at its pace; a toast shown before is not repeated; one not yet shown appears once.
  for (const [shown, titles] of [[['as_is'], []], [[], ['Ready to use as-is']]]) {
    const frames = ['as-is-ready-mid-lock', 'as-is-ready-mid-lock', 'as-is-ready-mid-lock', 'locking-unlockable-kept']
    const ui = mount({ sources, flag: 'true', clock: 'virtual', saved: SAVED, stored: { [PKEY]: JSON.stringify({ job_id: UPLOAD_JOB, session_id: SESSION, file_name: FILE_NAME, shown }) }, jobs: { [UPLOAD_JOB]: frames.map(name => asJob(name)) } })
    await ui.settle(); await ui.advance(2000); await ui.advance(2000); await ui.advance(2000)
    deq(ui.times, [0, 2000, 4000, 6000], `resumed at once, then at 2000`)
    deq(toastTitles(ui), titles, `shown ${JSON.stringify(shown)}`)
    deq(serverActions(ui.log), [], 'resuming starts nothing')
    check(assert.ok, ui.row(TEMPLATE), 'the saved template is in the list')
    ui.chooseFile(DECK); await ui.settle(2); check(assert.equal, ui.disabled('Upload template'), true, 'the resumed job is moving: it holds the Upload button')
    await ui.close()
  }
  // A stored job that cannot be read (404): plain words, Retry and Dismiss; nothing is held. Retry reads it again.
  {
    const ui = mount({ sources, flag: 'true', clock: 'virtual', stored: { [PKEY]: JSON.stringify({ job_id: 'stage-gone', session_id: SESSION, file_name: FILE_NAME, shown: [] }) } })
    await ui.settle()
    deq(ui.cardLines(), [FILE_NAME, "We can't check this upload's progress right now."]); deq(ui.cardButtons(), ['Retry', 'Dismiss'])
    ui.chooseFile(DECK); await ui.settle(2); check(assert.equal, ui.disabled('Upload template'), false)
    deq(ui.times, [], 'a 404 is not a served job')
    const before = jobGets(ui.log).length; ui.click('Retry'); await ui.settle(); check(assert.equal, jobGets(ui.log).length, before + 1)
    ui.click('Dismiss'); await ui.settle(); check(assert.equal, ui.card(), null); check(assert.equal, ui.store.has(PKEY), false)
    await ui.close()
  }
  // A service blip (503) in the middle is survived without a word.
  {
    const ui = await uploaded(sources, [asJob('converting'), { __status: 503 }, { __status: 503 }, asJob('as-is-ready-mid-lock')])
    await ui.advance(3000); await ui.advance(5000); await ui.advance(5000)
    deq(ui.times, [0, 3000, 8000, 13000], 'a blip waits the old 5 s and reads the same job again')
    deq(ui.cardLines(), FRAME_3, 'no error line')
    await ui.close()
  }
  // A job that never ends is read for at most 90 minutes, then "Still working…" with Retry (a 10 s pace keeps the run short).
  {
    const slow = { ...asJob('converting'), poll: { next_interval_ms: 10000, stalled: false } }
    const ui = await uploaded(sources, [slow])
    await ui.advance(91 * 60 * 1000, 2)
    const reads = ui.times.length
    check(assert.ok, reads > 400 && reads < 560, `${reads} reads in 90 minutes at 10 s`)
    check(assert.equal, ui.cardLines().at(-1), 'Still working…'); deq(ui.cardButtons(), ['Retry', 'Dismiss'])
    ui.chooseFile(DECK); await ui.settle(2); check(assert.equal, ui.disabled('Upload template'), false, 'a job the page gave up on does not hold the Upload button')
    await ui.advance(60000); check(assert.equal, ui.times.length, reads, 'it stopped')
    ui.click('Retry'); await ui.settle(); check(assert.equal, ui.times.length, reads + 1, 'Retry reads again')
    await ui.close()
  }

  // PK 13 Oct, in the page: one unlockable / kept slide does not close New topic; new_topic.state alone does.
  {
    const open = mount({ sources, flag: 'true', clock: 'virtual', saved: SAVED, stored: { [PKEY]: JSON.stringify({ job_id: UPLOAD_JOB, session_id: SESSION, file_name: FILE_NAME, shown: ['as_is', 'new_topic'] }) }, jobs: { [UPLOAD_JOB]: [asJob('done-available-one-kept')] } })
    await open.settle()
    check(assert.equal, open.all().filter(node => node.props?.['data-studio-template-dot'] === 'kept').length, 1, 'the real answer has its kept slide')
    deq(rowState(open, TEMPLATE), { 'Use original': false, 'Rebuild from own content': false, 'New topic': false })
    await open.close()
    const shut = asJob('done-available-one-kept'); shut.capabilities.new_topic = { invocation: 'job', state: 'processing', reason_code: 'METADATA_RUNNING' }
    shut.template_progress.slides = shut.template_progress.slides.map(slide => ({ ...slide, state: 'locked', kept_as_is: false })); shut.template_progress.kept_as_is = []
    const closed = mount({ sources, flag: 'true', clock: 'virtual', saved: SAVED, stored: { [PKEY]: JSON.stringify({ job_id: UPLOAD_JOB, session_id: SESSION, file_name: FILE_NAME, shown: ['as_is'] }) }, jobs: { [UPLOAD_JOB]: [shut] } })
    await closed.settle()
    check(assert.equal, closed.rowButton(TEMPLATE, 'New topic').props.disabled, true, 'every slide locked, new_topic processing: closed')
    await closed.close()
  }
  // A variation of a real answer in which Director has not said "available" yet: Use original waits (as-is must be ready).
  {
    const early = asJob('as-is-ready-mid-lock'); early.capabilities.use_original = { state: 'processing' }
    const ui = mount({ sources, flag: 'true', clock: 'virtual', saved: SAVED, stored: { [PKEY]: JSON.stringify({ job_id: UPLOAD_JOB, session_id: SESSION, file_name: FILE_NAME, shown: ['as_is'] }) }, jobs: { [UPLOAD_JOB]: [early, asJob('as-is-ready-mid-lock')] } })
    await ui.settle()
    check(assert.equal, ui.rowButton(TEMPLATE, 'Use original').props.disabled, true, 'use_original is not available')
    check(assert.equal, ui.rowButton(TEMPLATE, 'Rebuild from own content').props.disabled, true)
    deq(ui.cardLines().includes('Ready to use as it is.'), false); deq(ui.toasts, [])
    await ui.advance(2000)
    check(assert.equal, ui.rowButton(TEMPLATE, 'Use original').props.disabled, false, 'and opens when it is')
    await ui.close()
  }
  // The card follows the dialog being closed and reopened (the poll belongs to the page, not to the open dialog) and a signed-out dialog does nothing.
  {
    const ui = await uploaded(sources, FRAMES.map(name => asJob(name)))
    await ui.close(); await ui.advance(3000)
    check(assert.equal, ui.times.length, 2, 'the job is still read while the dialog is closed')
    await ui.advance(5000); deq(toastTitles(ui), ['Ready to use as-is'], 'and the toast comes even if the dialog is closed')
    await ui.close()
    const out = mount({ sources, flag: 'true', clock: 'virtual', auth: false, stored: { [PKEY]: JSON.stringify({ job_id: UPLOAD_JOB, session_id: SESSION, file_name: FILE_NAME, shown: [] }) }, jobs: { [UPLOAD_JOB]: [asJob('converting')] } })
    await out.settle(); deq(out.times, [], 'no user, no read'); check(assert.equal, out.card(), null)
    await out.close()
  }
}

// ---- 3b. Retry and Dismiss on a finished card ---------------------------------------------------------------------------------------------
/** The requests one upload makes (session create, storage upload, POST upload-reference), the fresh session id normalised. */
function uploadPayload(log, from = 0) {
  const slice = log.slice(from)
  const start = slice.findIndex(entry => entry[0] === 'createSession')
  const end = slice.findIndex((entry, i) => i > start && entry[0] === 'fetch' && entry[1] === 'POST')
  assert.ok(start >= 0 && end > start, 'an upload ran')
  const session = slice[start][1]
  return JSON.parse(JSON.stringify(slice.slice(start, end + 1)).replaceAll(session, '<session>'))
}
async function retryAndDismissChecks(sources) {
  const SECOND = 'stage-upload-0002'
  const second = (name = 'converting') => ({ job_id: SECOND, answers: () => [asJob(name, SECOND)] })
  // A failed upload: #406's Retry runs the dialog's own Upload of the same file (the requests equal the base dialog's own Upload button), and the card
  // follows the new job.
  {
    const ui = await uploaded(sources, [asJob('failed-upload')], { queue: [...uploadQueue([asJob('failed-upload')]), second()] })
    deq(ui.cardButtons(), ['Retry', 'Dismiss'])
    const first = uploadPayload(ui.log), mark = ui.log.length
    check(assert.equal, ui.click('Retry'), 'clicked'); await ui.settle()
    deq(uploadPayload(ui.log, mark), first, 'Retry makes the same requests as the first upload')
    const base = mount({ sources: baseSources, flag: undefined, queue: [{ job_id: 'stage-up-base', answers: s => [upJob('stage-up-base', s, 'cracking')] }] })
    await base.settle(); base.chooseFile(DECK); await base.settle(2); base.click('Upload template'); await base.settle()
    deq(uploadPayload(ui.log, mark), uploadPayload(base.log), "and the base dialog's own Upload button makes")
    check(assert.notEqual, ui.log.slice(mark).find(entry => entry[0] === 'createSession')[1], ui.log.find(entry => entry[0] === 'createSession')[1], 'a new session')
    deq(JSON.parse(ui.store.get(PKEY)).job_id, SECOND, 'the new job is the one kept')
    deq(ui.cardLines(), [FILE_NAME, 'Reading your presentation…', 'Preparing for new topics…'], 'the card follows the new job')
    check(assert.equal, ui.busy(), false)
    await ui.close(); await base.close()
  }
  // A failed upload after a reload (no file chosen any more): #406's words say so; Dismiss only.
  {
    const ui = mount({ sources, flag: 'true', clock: 'virtual', stored: { [PKEY]: JSON.stringify({ job_id: UPLOAD_JOB, session_id: SESSION, file_name: FILE_NAME, shown: [] }) }, jobs: { [UPLOAD_JOB]: [asJob('failed-upload')] } })
    await ui.settle()
    deq(ui.cardLines(), [FILE_NAME, 'Your last template upload could not be finished. Template upload could not be completed; no automatic retry was made. Choose the presentation again to upload it.'])
    deq(ui.cardButtons(), ['Dismiss'])
    ui.click('Dismiss'); await ui.settle(); check(assert.equal, ui.card(), null)
    await ui.close()
  }
  // A lock that failed and Director calls retryable: Retry (the file is kept for it) and Dismiss; New topic stays on capabilities (closed).
  {
    const frames = ['as-is-ready-mid-lock', 'locking-failed-done'].map(name => asJob(name))
    const ui = await uploaded(sources, frames, { queue: [...uploadQueue(frames), second()] })
    await ui.advance(2000)
    deq(ui.cardLines(), [FILE_NAME, 'Template added to your library.', '7 of 12 slides done', LOCK_FAILED])
    deq(ui.cardButtons(), ['Retry', 'Dismiss'])
    check(assert.equal, ui.rowButton(TEMPLATE, 'New topic').props.disabled, true, 'new_topic.state is unavailable')
    check(assert.equal, ui.rowButton(TEMPLATE, 'Use original').props.disabled, false)
    ui.click('Retry'); await ui.settle()
    deq(JSON.parse(ui.store.get(PKEY)).job_id, SECOND, 'Retry uploads the file again: a new job replaces the card')
    await ui.close()
  }
  // Refused and paused: Dismiss only, even with the file still chosen in this page (no Retry for them); Dismiss forgets the stored job and stops the poll.
  for (const [name, lines] of [['refused-done', [FILE_NAME, 'Template added to your library.', '7 of 12 slides done', LOCK_FAILED]], ['paused-budget-done', [FILE_NAME, 'Template added to your library.', '7 of 12 slides done', PAUSED]]]) {
    const frames = ['as-is-ready-mid-lock', name].map(frame => asJob(frame))
    const ui = await uploaded(sources, frames, { queue: [...uploadQueue(frames), second()] })
    await ui.advance(2000)
    deq(ui.cardLines(), lines, name); deq(ui.cardButtons(), ['Dismiss'], `${name}: Dismiss, no Retry`)
    check(assert.equal, ui.disabled('Upload template'), true, `${name}: the file was let go (no Retry is offered), so Upload waits for a file`)
    check(assert.equal, ui.rowButton(TEMPLATE, 'New topic').props.disabled, true, `${name}: New topic follows new_topic.state`)
    check(assert.equal, ui.store.has(PKEY), true, `${name}: the record is kept until Dismiss`)
    const reads = ui.times.length, before = ui.log.length
    ui.click('Dismiss'); await ui.settle()
    check(assert.equal, ui.card(), null); check(assert.equal, ui.store.has(PKEY), false, `${name}: Dismiss forgets the stored job`)
    await ui.advance(60000); check(assert.equal, ui.times.length, reads, `${name}: nothing is read any more`)
    deq(ui.log.slice(before).filter(entry => entry[0] === 'fetch' && entry[1] !== 'GET'), [], 'Dismiss asks nothing of the server')
    await ui.close()
  }
  // A new upload replaces a card that is kept (a refused one).
  {
    const frames = ['as-is-ready-mid-lock', 'refused-done'].map(name => asJob(name))
    const ui = await uploaded(sources, frames, { queue: [...uploadQueue(frames), second()] })
    await ui.advance(2000)
    ui.chooseFile({ name: 'next.pptx', size: 10 }); await ui.settle(2)
    check(assert.equal, ui.disabled('Upload template'), false, 'a kept card does not hold the Upload button')
    ui.click('Upload template'); await ui.settle()
    deq(JSON.parse(ui.store.get(PKEY)), { job_id: SECOND, session_id: 'fresh-session-0002', file_name: 'next.pptx', shown: [] })
    deq(ui.cardLines(), ['next.pptx', 'Reading your presentation…', 'Preparing for new topics…'])
    await ui.close()
  }
  // A stalled job still has Retry (read again) and Dismiss; Retry does not upload anything.
  {
    const ui = await uploaded(sources, ['as-is-ready-mid-lock', 'stalled-locking'].map(name => asJob(name)))
    await ui.advance(2000)
    const before = serverActions(ui.log).length
    ui.click('Retry'); await ui.settle()
    check(assert.equal, serverActions(ui.log).length, before, 'a stalled job is read again, not uploaded again')
    await ui.close()
  }
}

// ---- 4. mutations ---------------------------------------------------------------------------------------------------------------------------
/** `source: false` skips the source pins (a mutant of the dialog is meant to be caught by what the dialog DOES, not by its text). */
async function suite(sources, { source = true } = {}) {
  checks = 0
  if (source) sourceChecks(sources)
  pureChecks(sources)
  await watchChecks(sources)
  await flagOffChecks(sources)
  await flagOnChecks(sources)
}

/** [file, name, the exact text, what it becomes]: every rule above must fail a check when its line is broken. */
const MUTANTS = [
  // the pace
  [LIB, 'a null poll does not stop the watch', "if (job.poll === null || templateJobTerminal(job)) return null", 'if (templateJobTerminal(job)) return null'],
  [LIB, 'a terminal status keeps the watch going', "if (job.poll === null || templateJobTerminal(job)) return null", 'if (job.poll === null) return null'],
  [LIB, 'the old interval is not 5 s', 'export const TEMPLATE_POLL_FALLBACK_MS = 5000', 'export const TEMPLATE_POLL_FALLBACK_MS = 3000'],
  [LIB, 'next_interval_ms ignored', 'const asked = job.poll?.next_interval_ms\n', 'const asked = 2000\n'],
  [LIB, 'next_interval_ms not kept above 1 s', 'Math.min(TEMPLATE_POLL_MAX_MS, Math.max(TEMPLATE_POLL_MIN_MS, Math.round(asked)))', 'Math.min(TEMPLATE_POLL_MAX_MS, Math.round(asked))'],
  [LIB, 'next_interval_ms not kept below 60 s', 'Math.min(TEMPLATE_POLL_MAX_MS, Math.max(TEMPLATE_POLL_MIN_MS, Math.round(asked)))', 'Math.max(TEMPLATE_POLL_MIN_MS, Math.round(asked))'],
  [LIB, 'the watch goes on after a terminal answer', "    if (wait === null) return 'terminal'\n", "    if (wait === null) { try { await sleep(fallbackMs, signal) } catch { return 'aborted' } continue }\n"],
  [LIB, 'a service blip ends the watch', '[502, 503, 504].includes(status) && ++blips <= 3', 'false'],
  [LIB, 'blips are retried for ever', '++blips <= 3)', '++blips <= 3000000)'],
  [LIB, 'blips are counted across good reads', '      blips = 0\n    } catch', '    } catch'],
  [LIB, 'a failing display callback stops the watch', 'try { onJob(job) } catch { /* a display error must not stop the poll */ }', 'onJob(job)'],
  [LIB, 'the watch limit is ignored', "    if (now() - started + wait > limitMs) return 'limit'\n", ''],
  [LIB, 'an answer after the abort is drawn', "    onProblem(null)\n    if (signal.aborted) return 'aborted'\n", '    onProblem(null)\n'],
  // as-is
  [LIB, 'as-is without as_is.ready', ' && asIs?.ready === true', ''],
  [LIB, 'as-is without use_original available', "job.capabilities?.use_original?.state === 'available' && asIs?.ready === true", 'asIs?.ready === true'],
  [LIB, 'use waits on a finished job too', 'return !view.terminal && !view.asIsReady', 'return !view.asIsReady'],
  [LIB, 'use is never held', 'return !view.terminal && !view.asIsReady', 'return false'],
  [LIB, 'another template is held too', 'if (!view || view.templateId !== templateId) return false', 'if (!view) return false'],
  // new topics (PK 13 Oct)
  [LIB, 'a kept slide holds new topics', "return view.detailed && view.newTopic !== null && view.newTopic !== 'available'", "return view.detailed && view.newTopic !== null && (view.newTopic !== 'available' || view.dots.some(dot => dot.kind === 'kept'))"],
  [LIB, 'a slide not locked holds new topics', "return view.detailed && view.newTopic !== null && view.newTopic !== 'available'", "return view.detailed && view.newTopic !== null && (view.newTopic !== 'available' || view.dots.some(dot => dot.kind !== 'locked'))"],
  [LIB, 'new topics follow the as-is template', "return view.detailed && view.newTopic !== null && view.newTopic !== 'available'", 'return view.detailed && !view.asIsReady'],
  [LIB, 'new topics are never held', "return view.detailed && view.newTopic !== null && view.newTopic !== 'available'", 'return false'],
  [LIB, 'new topics are held with no progress (legacy)', 'return view.detailed && view.newTopic !== null &&', 'return view.newTopic !== null &&'],
  // the slides, the bar, the words
  [LIB, 'a kept slide is not neutral', "slide.kept_as_is === true || slide.state === 'unlockable' ? 'kept'", "slide.kept_as_is === true || slide.state === 'unlockable' ? 'queued'"],
  [LIB, 'unlockable is not neutral', " || slide.state === 'unlockable' ? 'kept'", " ? 'kept'"],
  [LIB, 'kept only by state', "slide.kept_as_is === true || slide.state === 'unlockable' ? 'kept'", "slide.state === 'unlockable' ? 'kept'"],
  [LIB, 'a finished job animates a slide', "slide.state === 'analysing' && !terminal ? 'working'", "slide.state === 'analysing' ? 'working'"],
  [LIB, 'dots not in slide order', '.sort((a, b) => a.index - b.index)', ''],
  [LIB, 'dots not capped', '.slice(0, MAX_DOTS)', ''],
  [LIB, 'time left shown for zero', 'seconds <= 0) return null', 'seconds < 0) return null'],
  [LIB, 'minutes rounded down', 'about ${Math.round(seconds / 60)} minutes left', 'about ${Math.floor(seconds / 60)} minutes left'],
  [LIB, 'bar past 100', 'Math.min(100, Math.round(slidesDone / slideCount * 100))', 'Math.round(slidesDone / slideCount * 100)'],
  [LIB, 'a reason code is drawn', "          : 'New topics are not available for this template yet.'\n", "          : `New topics are not available for this template yet (${String(reason)}).`\n"],
  [LIB, "Director's lock message hidden", "const lockingNote = locking && (locking.state === 'paused' || locking.state === 'failed') ? text(locking.message) : null", 'const lockingNote = null'],
  [LIB, 'a running lock shows its message', "(locking.state === 'paused' || locking.state === 'failed')", '(locking.state !== undefined)'],
  [LIB, 'the lock message is repeated by the new-topic line', ': lockingNote ? null : unavailableWords(', ': unavailableWords('],
  [LIB, 'stalled is never read', "const stalled = !terminal && job.poll?.stalled === true", 'const stalled = false'],
  // the toasts
  [LIB, 'the as-is toast repeats', "const asIsDue = view.asIsReady && !next.includes('as_is') && !next.includes('new_topic')", 'const asIsDue = view.asIsReady'],
  [LIB, 'the new-topic toast repeats', "view.newTopic === 'available' && !next.includes('new_topic')", "view.newTopic === 'available'"],
  [LIB, 'both toasts at once', '  } else if (asIsDue) {', '  }\n  if (asIsDue) {'],
  // the upload hold
  [LIB, 'a failed job has no Retry', 'terminal && (failed || (lockFailed', 'terminal && (false || (lockFailed'],
  [LIB, 'a refused template gets Retry', "(lockFailed && newTopic === 'unavailable' && job.capabilities", '(lockFailed && job.capabilities'],
  [LIB, 'a lock failure Director does not call retryable gets Retry', " && job.capabilities?.new_topic?.retryable === true)", ')'],
  [LIB, 'a paused lock gets Retry', "const lockFailed = detailed && locking?.state === 'failed'", "const lockFailed = detailed && (locking?.state === 'failed' || locking?.state === 'paused')"],
  [LIB, 'a lock failure still running gets Retry', 'const retry = terminal && (', 'const retry = ('],
  [LIB, 'a refused or paused card cannot be dismissed', '? failed || (detailed && newTopic !== null && newTopic !== \'available\') : stalled', '? failed || false : stalled'],
  [LIB, 'a clean card can be dismissed', "(detailed && newTopic !== null && newTopic !== 'available')", 'detailed'],
  [LIB, 'a stalled job cannot be dismissed', ': stalled\n', ': false\n'],
  [LIB, 'a stalled job holds the upload', 'return view === null || !(view.terminal || view.stalled)', 'return view === null || !view.terminal'],
  [LIB, 'a failed job holds the upload', 'return view === null || !(view.terminal || view.stalled)', 'return view === null || !view.stalled'],
  [LIB, 'an unreadable job holds the upload', 'if (!tracked || problem) return false', 'if (!tracked) return false'],
  // the stored record
  [LIB, 'a record with no session is accepted', "typeof session_id !== 'string' || !session_id) return null", "typeof session_id !== 'string') return null"],
  [LIB, 'the stored toast list is not checked', ".filter((item): item is string => item === 'as_is' || item === 'new_topic')", '.filter((item): item is string => true)'],
  // the hook
  [HOOK, 'flag off reads storage', 'if (!enabled || !userId) return\n    let stored', 'if (!userId) return\n    let stored'],
  [HOOK, 'no toast is shown', 'for (const item of due.toasts) toast({ title: item.title, description: item.description })', ''],
  [HOOK, 'a toast is not remembered', 'shownRef.current = due.shown\n          remember()', 'shownRef.current = due.shown'],
  [HOOK, 'a toast is not remembered in memory', '          shownRef.current = due.shown\n', ''],
  [HOOK, 'the list is not read at as-is ready', 'if (view.templateId && view.templateId !== savedTemplate) { savedTemplate = view.templateId; reload() } else if (view.terminal) reload()', 'if (view.terminal) reload()'],
  [HOOK, 'the list is not read at the end', ' else if (view.terminal) reload()', ''],
  [HOOK, 'a clean finish is kept', "if (view.terminal && (view.failed || !view.detailed || view.newTopic === 'available')) forget()", ''],
  [HOOK, 'a paused job is forgotten', "(view.failed || !view.detailed || view.newTopic === 'available')", 'true'],
  [HOOK, 'a failed job is kept', "(view.failed || !view.detailed || view.newTopic === 'available')", "(!view.detailed || view.newTopic === 'available')"],
  [HOOK, 'the job is not stored', 'try { sessionStorage.setItem(key, JSON.stringify(record)) } catch { /* storage unavailable */ }\n    setJob(null)', 'setJob(null)'],
  [HOOK, 'Dismiss keeps the record', 'const dismiss = useCallback(() => {\n    try { sessionStorage.removeItem(key) } catch { /* storage unavailable */ }\n', 'const dismiss = useCallback(() => {\n'],
  [HOOK, 'Retry does nothing', 'setAttempt(count => count + 1)', 'setAttempt(count => count)'],
  [HOOK, 'another job is not followed', '}, [enabled, jobId, attempt])', '}, [enabled, attempt])'],
  [HOOK, 'the card is not drawn', 'if (!(tracked && (view || problem))) return node', 'if (true) return node'],
  [HOOK, 'a stalled card has no Retry', 'onRetry={rereading ? retry : uploadAgain}', 'onRetry={uploadAgain}'],
  [HOOK, 'a refused or paused card cannot be dismissed', 'dismissible={!!problem || !view || view.dismissible}', 'dismissible={!!problem || !view || view.failed || view.stalled}'],
  [HOOK, 'Retry of a failed upload only reads the job again', 'onRetry={rereading ? retry : uploadAgain}', 'onRetry={retry}'],
  [HOOK, 'the card never offers the dialog\'s Retry', "const uploadAgain = view?.retry ? retryUpload?.() ?? null : null", 'const uploadAgain = null'],
  [HOOK, 'Retry is offered whatever the view says', "const uploadAgain = view?.retry ? retryUpload?.() ?? null : null", 'const uploadAgain = retryUpload?.() ?? null'],
  [HOOK, 'the end of a job is not reported', 'onEndRef.current?.(view)', ''],
  [HOOK, "a failed upload's words are not #406's", "failure={view?.failed ? composerJobRecoveryMessage({ job_id: tracked.job_id, kind: 'upload', reason: 'failed', detail: view.failure, retry: null }, !!uploadAgain) : null}", 'failure={null}'],
  [HOOK, 'the dots lose their kind', 'data-studio-template-dot={dot.kind}', 'data-studio-template-dot="queued"'],
  [HOOK, 'the bar value is not the percent', 'aria-valuenow={view.percent}', 'aria-valuenow={0}'],
  [HOOK, 'the as-is line stays when finished', '{view.asIsReady && !view.terminal && note(TEMPLATE_AS_IS_LINE)}', '{view.asIsReady && note(TEMPLATE_AS_IS_LINE)}'],
  [HOOK, 'a failed card keeps its bar', '{!view.failed && view.percent !== null && <div', '{view.percent !== null && <div'],
  // the dialog
  [DIALOG, 'the flag is read loosely', "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS === 'true'", "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS !== 'false'"],
  [DIALOG, 'the upload still waits for the job', 'if (templateProgress.enabled) {', 'if (false) {'],
  [DIALOG, 'the job is not handed to the hook', "templateProgress.track({ job_id: job.job_id, session_id: sessionId, file_name: selected.name })", ''],
  [DIALOG, 'the chosen file is let go when a Retry is due', 'if (!view.retry) { setFile(null)', 'if (true) { setFile(null)'],
  [DIALOG, 'the chosen file is kept after a clean finish', 'if (!view.retry) { setFile(null)', 'if (false) { setFile(null)'],
  [DIALOG, 'the file of the upload is not kept for Retry', '        uploadRetryFile.current = selected\n        templateProgress.track', '        templateProgress.track'],
  [DIALOG, "Retry does not go through the dialog's own upload", 'return retryable(retry) ? () => retryJob(retry) : null', 'return null'],
  [DIALOG, 'the progress line stays after the upload', "        setProgress(null)\n        return\n", '        return\n'],
  [DIALOG, 'Upload is not held', ' || templateProgress.uploadHeld', ''],
  [DIALOG, 'New topic is not held', " || templateProgress.held(template.id, 'new-topic')", ''],
  [DIALOG, 'Use original is not held', " || templateProgress.held(template.id, 'use')", ''],
  [DIALOG, 'Rebuild is not held', " || templateProgress.held(template.id, 'ditto')", ''],
]

const started = Date.now()
if (process.env.TP_MUTANT_TARGETS_ONLY) { // a quick look that every mutant still names exactly one place (while editing the sources)
  for (const [rel, name, from] of MUTANTS) assert.equal(branchSources[rel].split(from).length, 2, `mutant "${name}" must match exactly one place in ${rel}`)
  console.log(`${MUTANTS.length} mutant targets match`); process.exit(0)
}
fixtureChecks()
await suite(branchSources)
const total = checks
let caught = 0
for (const [rel, name, from, to] of MUTANTS) {
  const source = branchSources[rel]
  assert.equal(source.split(from).length, 2, `mutant "${name}" must match exactly one place in ${rel}`)
  let failure = null
  try { await suite({ ...branchSources, [rel]: source.replace(from, () => to) }, { source: rel !== DIALOG }) } catch (error) { failure = error }
  assert.ok(failure, `MUTANT SURVIVED: ${name}`)
  caught++
  console.log(`  mutation caught: ${name} (${String(failure.message).split('\n')[0].slice(0, 100)})`)
}
console.log(`PASS: studio template progress (${total} checks, ${caught}/${MUTANTS.length} mutants caught, ${((Date.now() - started) / 1000).toFixed(0)} s)`)
