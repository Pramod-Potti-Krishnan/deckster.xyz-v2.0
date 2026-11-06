// Template "What changed" admission report, Studio half (frontend). Flag NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT (exact "true"), default off.
//
// Before: an uploaded deck is changed a little on its way to a template (a dashed outline drawn solid, text that cannot be kept left out, a slide rebuilt over a
// picture) and the Template library says nothing about it. Composer (COMPOSER_UPLOAD_ADMISSION_REPORT_ENABLED, composer MR !99) writes what it did in plain words and
// Director (DIRECTOR_TEMPLATE_ADMISSION_REPORT_ENABLED, director MR !502) validates, stores and serves it (streams/composer/ADMISSION-REPORT-CONTRACT.md section 2): the
// job read GET /api/template-ingest/stage/jobs/{job_id} gains `admission_report` (the whole report, or null until Composer has sent one; absent with Director's flag off) and
// the library list GET /api/template-ingest/stage/templates gives each row its `admission_report` without `slides` (a row with no stored report has no key).
// With the flag on the library draws it under the template's row: the headline, the changes in rank order (text left out, slide floor, left out and kept as a picture are
// emphasised), "and N more small changes", and, from the job read, a slide-by-slide strip. No report (absent, null, or anything that does not read as one) shows nothing.
//
// Run: node scripts/test-studio-template-admission-report.mjs   (plain node: transpile + vm, a small hooks runtime, no network, no writes)
//   ADMISSION_REPORT_BASE=<commit> picks the base the flag-off identity is measured against (default 7a4d894, the commit #423, this report's own PR, was merged onto; the
//   dialog, the library CSS and the route are the same files there as at 80dfde4, where this branch was cut; the repository needs that commit in its history). The strip
//   takes out #423's lines and #425's (the template read), so the base is the one before both; a later parent (d502be2, 8aa5f8e) already carries #423's lines and fails.
//
// What is proved, on the REAL dialog, the REAL hook, the REAL component and the REAL lib (the requests run for real against a fake /api/composer-library):
//   0. the fixtures are the answers of Director's own routes for reports Composer's own builder wrote (scripts/fixtures/template-admission-report/capture-admission-report.py runs
//      composer's user_report() and Director's router, store and validator, branches seat2/composer-p3-4-floor-report and seat2/director-admission-report, offline): provenance,
//      the job row's fields, the new one, the list row's, and that the report Director serves is the report Composer wrote (with the slides left out of the list);
//   1. the pure view (lib/studio-template-admission-report.ts) on every one of them: the headline and every sentence shown exactly as sent, the rank order, the emphasised
//      outcomes, "and N more small changes", the open state, the strip and its bounds, the null cases (a report Director dropped, a refusal, Composer's flag off, Director's
//      flag off), and every way a report can fail to read (version, characters, lengths, counts, slide numbers) dropping the whole report, an unknown outcome shown plainly;
//   2. flag off (unset, "false", "1", "TRUE", " true"): the dialog's tree, every request, session, upload and storage access equal the base dialog's (sha256) for 5 scenarios
//      in both shells, even when the library list and the job reads carry reports; and the dialog's source minus the added lines is the base's, byte for byte;
//   3. flag on: the report is drawn under the rows that have one, none under those that have none; the tracked upload's job read (with slides) wins for its own template only
//      and the strip goes with the card's Dismiss; no extra request or storage access; a row with nothing to show is the flag-off tree;
//   4. mutations: every rule above fails when its line is broken.
// The template read (the slide strip of a list report, flag on only; ruling by COMPOSER-1, 16 Oct 2026):
//   5. Director's GET /api/template-ingest/stage/templates/{id} (stage_template_router.py:163, owner-scoped, the front-door token + X-Composer-User-Id of composer_library.py:680)
//      answers the whole stored row; its real answers are scripts/fixtures/template-admission-report/director-admission-report-detail.json (same capture script, Director uat). The
//      Studio proxy lets that ONE read-only GET through, gated on the flag (flag off it is the same 404 as before, proved against the base route on a request matrix) and
//      trimmed to { id, ingest_source: { admission_report } } (the whole row is megabytes, past a Vercel function's answer limit); allowed GET, every other method, bad ids,
//      sub-paths, the token and user id the server sets, and every way the answer can fail are proved on the real route;
//   6. the hook (components/builder/composer-admission-detail.ts) on its own: one read per template, one at a time, kept, quiet on failure, aborted with the dialog, inert flag off;
//   7. the real dialog: a list report without slides asks once when it is opened (at once when it opens by itself), draws the strip from the answer (display only), never when
//      the tracked job already has one, never flag off; mutations of every rule.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { ADMISSION_ADDITIONS, stripAdmissionReport } from './studio-template-admission-report-strip.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.ADMISSION_REPORT_BASE || '7a4d89472681c0046ce7446ea4392ebe4df5e2b0'
const FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT'
const PROGRESS = 'NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const DIALOG = 'components/builder/composer-library-dialog.tsx'
const HOOK = 'components/builder/composer-template-progress.tsx'
const VIEW = 'components/builder/composer-admission-report.tsx'
const LIB = 'lib/studio-template-admission-report.ts'
const CSS = 'components/builder/studio-template-admission-report.css'
const LIBRARY_CSS = 'components/builder/studio-composer-library.css'
const FIXTURE = 'scripts/fixtures/template-admission-report/director-admission-report-reads.json'
const FIXTURE_BIG = 'scripts/fixtures/template-admission-report/director-admission-report-big-deck.json'
const FIXTURE_DETAIL = 'scripts/fixtures/template-admission-report/director-admission-report-detail.json'
const ROUTE = 'app/api/composer-library/[...path]/route.ts'
const DETAIL = 'components/builder/composer-admission-detail.ts'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
const plain = value => JSON.parse(JSON.stringify(value))
const deq = (actual, expected, message) => message === undefined ? assert.deepStrictEqual(plain(actual), plain(expected)) : assert.deepStrictEqual(plain(actual), plain(expected), message)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
let checks = 0
const check = (fn, ...args) => { fn(...args); checks++ }
const unhandled = [] // a rejection nobody handles (a failed template read must raise nothing); recorded, so a mutant that raises one fails a check instead of ending the run
process.on('unhandledRejection', reason => { unhandled.push(reason) })

const branchSources = { [DIALOG]: read(DIALOG), [HOOK]: read(HOOK), [VIEW]: read(VIEW), [LIB]: read(LIB), [DETAIL]: read(DETAIL), [ROUTE]: read(ROUTE) }
const baseDialog = execFileSync('git', ['show', `${BASE}:${DIALOG}`], { cwd: root, encoding: 'utf8' })
const baseRoute = execFileSync('git', ['show', `${BASE}:${ROUTE}`], { cwd: root, encoding: 'utf8' })
const baseSources = { [DIALOG]: baseDialog }

// ---- 0. the fixtures: the answers of Director's routes for reports Composer wrote ----------------------------------------------------------------
const FIX = JSON.parse(read(FIXTURE))
const BIG = JSON.parse(read(FIXTURE_BIG))
const CASES = { ...FIX.cases, ...BIG.cases }
const ROW_FIELDS = ['job_id', 'session_id', 'user_id', 'status', 'upload_ref', 'template_id', 'presentation_id', 'viewer_url', 'slide_count',
  'per_slide_fidelity', 'checkpoint', 'errors', 'created_at', 'updated_at', 'completed_at'] // TemplateIngestJob.model_fields (src/models/template_ingest_job.py)
const PROGRESS_FIELDS = ['template_progress', 'capabilities', 'poll']
const NAMES = ['admitted-clean', 'admitted-no-changes', 'partially-admitted', 'floor-slide', 'many-changes', 'deck-over-500-slides', 'composer-flag-off', 'director-flag-off',
  'report-rejected', 'refused', 'progress-flow-mid-run', 'progress-flow-done', 'big-deck']
const WITH_REPORT = ['admitted-clean', 'admitted-no-changes', 'partially-admitted', 'floor-slide', 'many-changes', 'big-deck', 'progress-flow-mid-run', 'progress-flow-done']
const NO_REPORT = ['deck-over-500-slides', 'composer-flag-off', 'report-rejected', 'refused'] // Director's job read says null
const jobOf = name => CASES[name].job.json
const reportOf = name => structuredClone(jobOf(name).admission_report ?? null)
const rowOf = name => CASES[name].list.json.templates[0] ?? null
const TEMPLATE_ID = '00000000-0000-0000-0000-000000000002'
const NOW = Date.parse('2026-10-15T12:00:00Z')

function fixtureChecks() {
  for (const file of [FIX, BIG]) {
    const { composer, director, how } = file.source
    check(assert.match, composer.sha, /^[0-9a-f]{40}$/, 'the Composer commit is named')
    check(assert.match, director.sha, /^[0-9a-f]{40}$/, 'the Director commit is named')
    deq([composer.mr, composer.branch, director.mr, director.branch], ['!99', 'seat2/composer-p3-4-floor-report', '!502', 'seat2/director-admission-report'])
    check(assert.ok, composer.code[0].includes('service/library_upload_admission.py (user_report'))
    check(assert.ok, director.code.some(item => item.includes('stage_template_router.py (GET /jobs/{job_id}: body[\'admission_report\']')))
    check(assert.match, how, /Composer's real builder \(loaded by path/)
    check(assert.match, how, /Director's own offline world \(real router, real worker client, real template store/)
  }
  check(assert.equal, FIX.source.director.sha, BIG.source.director.sha)
  check(assert.equal, FIX.source.composer.sha, BIG.source.composer.sha)
  deq(Object.keys(CASES), NAMES, 'the cases')
  for (const [name, entry] of Object.entries(CASES)) {
    const body = jobOf(name)
    check(assert.equal, entry.job.status_code, 200, name)
    check(assert.equal, entry.list.status_code, 200, name)
    check(assert.equal, JSON.stringify(entry).match(/eyJ|sk-[A-Za-z0-9]|Bearer|password|secret|@[a-z0-9-]+\.[a-z]{2,}/i), null, `${name}: nothing secret and no address in it`)
    const keys = Object.keys(body)
    const progress = name.startsWith('progress-flow')
    // the row, field for field, plus the one new key when Director's flag is on (and the progress fields in the progress flow); Director's flag off adds nothing
    deq(keys.filter(key => key !== 'admission_report' && !PROGRESS_FIELDS.includes(key)), ROW_FIELDS, `${name}: the row, field for field`)
    check(assert.equal, keys.includes('admission_report'), entry.director_flag, `${name}: the key comes with Director's flag on only`)
    check(assert.equal, PROGRESS_FIELDS.every(field => keys.includes(field)), progress, `${name}: the progress fields come in the progress flow only`)
    if (entry.director_flag) check(assert.equal, body.admission_report === null, !WITH_REPORT.includes(name), `${name}: null exactly when there is no report`)
    // the report Director serves is the one it stored on the job row, and the list row has it without its slides
    if (WITH_REPORT.includes(name)) {
      deq(body.checkpoint.admission_report, body.admission_report, `${name}: the job read is the job row's report`)
      const { slides, ...rest } = body.admission_report
      check(assert.ok, Array.isArray(slides) && slides.length > 0, `${name}: the job read has slide rows`)
      deq(rowOf(name).admission_report, rest, `${name}: the list row is the report without its slides`)
      check(assert.equal, rowOf(name).id, body.template_id, `${name}: the list row is the job's template`)
      deq(Object.keys(body.admission_report), ['version', 'stage', 'headline', 'totals', 'slides', 'changes', 'changes_more'], `${name}: the report's keys`)
    } else {
      check(assert.ok, !body.checkpoint || !('admission_report' in body.checkpoint), `${name}: no report on the job row`)
      for (const row of entry.list.json.templates) check(assert.equal, 'admission_report' in row, false, `${name}: no key on a list row without a report`)
    }
  }
  // what the real chain did with the cases that have no report
  deq(CASES.refused.list.json.templates, [], 'a file-level refusal saves no template')
  check(assert.equal, jobOf('refused').status, 'failed')
  deq(jobOf('refused').errors, ['Template upload could not be completed; no automatic retry was made.'])
  check(assert.equal, jobOf('report-rejected').status, 'complete', 'a report Director drops never fails the upload')
  check(assert.equal, CASES['deck-over-500-slides'].builder_totals_slides, 520, "Composer's builder wrote totals.slides 520 for a 520-slide deck, which Director's validator (500 at most) drops whole")
  check(assert.equal, jobOf('deck-over-500-slides').admission_report, null)
  check(assert.equal, jobOf('progress-flow-mid-run').status, 'cracking', 'the mid-run frame is read while Composer is still locking')
  check(assert.equal, jobOf('progress-flow-mid-run').template_id, TEMPLATE_ID)
  deq(jobOf('progress-flow-mid-run').poll, { next_interval_ms: 2000, stalled: false })
  deq(reportOf('progress-flow-mid-run'), reportOf('progress-flow-done'), 'the report is there from the as-is save and is the same at the end')
  // the report of the contract's example shape (section 4), written by Composer's builder
  check(assert.equal, reportOf('admitted-clean').headline, 'Template ready: 6 slides. All 107 pieces of text are editable. 85 of 85 elements are editable. 2 small changes are listed below.')
  check(assert.equal, reportOf('big-deck').slides.length < reportOf('big-deck').totals.slides, true, "a very large deck's report leaves quiet slide rows out (60 KB bound); totals.slides still counts them")
}

// ---- module loader and hooks runtime (the progress test's harness, trimmed) ---------------------------------------------------------------------------
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
      if (spec.startsWith('@/lib/') || spec.startsWith('@/components/builder/')) return run(resolve(spec))
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
    /** Runs every effect's cleanup, as React does when the component goes away. */
    unmount() { for (const cell of cells) cell?.cleanup?.() },
    /** A state change is waiting for a render (after an unmount, a late answer must not leave one). */
    pending: () => dirty,
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
/** Function components expanded to what they draw, so the tree can be searched. Hashes use the raw tree. */
const expand = node => Array.isArray(node) ? node.map(expand)
  : !node || typeof node !== 'object' ? node
    : typeof node.type === 'function' ? expand(node.type(node.props))
      : { ...node, props: { ...node.props, ...(node.props?.children === undefined ? {} : { children: expand(node.props.children) }) } }
const flat = node => Array.isArray(node) ? node.flatMap(flat) : !node || typeof node !== 'object' ? [] : [node, ...flat(node.props?.children)]
const text = node => Array.isArray(node) ? node.map(text).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)
const squash = value => value.replace(/\s+/g, ' ').trim()

// ---- the fake services and one mounted dialog -----------------------------------------------------------------------------------------------
const OWNER = 'local-owner'
const LAYOUT = 'https://layout-builder-v75-uat.up.railway.app'
const RESEARCHER = 'https://researcher-v11-uat.up.railway.app'
const UPLOAD_JOB = 'stage-upload-0001'
const row = (name, id, extra = {}) => ({ ...structuredClone(rowOf(name)), id, name: `Deck ${id.slice(0, 2)}.pptx — upload 2026-10-15 12:00 UTC [${id}]`, ...extra })
const ID = { quiet: 'a8000000-0000-4000-8000-000000000008', clean: 'a1000000-0000-4000-8000-000000000001', none: 'a2000000-0000-4000-8000-000000000002', partial: 'a3000000-0000-4000-8000-000000000003',
  many: 'a4000000-0000-4000-8000-000000000004', garbage: 'a5000000-0000-4000-8000-000000000005', off: 'a6000000-0000-4000-8000-000000000006', floor: 'a7000000-0000-4000-8000-000000000007' }
const noKey = (id, name) => { const { admission_report, ...rest } = row(name, id); return rest } // a list row the way Director sends one with no stored report
/** A library list as Director sends it: rows with a report, rows with no key, one with a value that is not a report. */
const LIST = () => [row('admitted-clean', ID.clean), row('admitted-no-changes', ID.quiet), noKey(ID.none, 'composer-flag-off'), row('partially-admitted', ID.partial), row('many-changes', ID.many),
  { ...noKey(ID.garbage, 'composer-flag-off'), admission_report: { version: 'composer-admission-report-v9', headline: 'Template ready.' } }, noKey(ID.off, 'director-flag-off'), row('floor-slide', ID.floor)]

/**
 * `templates`: what GET templates gives; `saved`: the template the list gains once a job answer carried its id. `jobs`: job id -> what each GET gives in turn (the last
 * repeats). `queue`: what each POST creates next: {job_id, answers}. `details`: template id -> what GET templates/{id} gives: {status, json}, 'throw' (the network fails), or a
 * function returning one (maybe a promise); an id it does not name answers 404. Every request, session create, upload and storage access is logged in order.
 */
function mount({ sources, flag, progress = false, shell = true, templates = [], jobs = {}, queue = [], saved = null, details = {}, env: extraEnv = {} }) {
  const log = [], store = new Map(), answers = new Map(Object.entries(jobs).map(([id, list]) => [id, [...list]]))
  const pending = [...queue]
  let sessions = 0, listIncludesSaved = false, reading = 0, mostReading = 0
  const reply = (status, data) => ({ ok: status < 400, status, json: async () => plain(data) })
  const fetch = async (url, init = {}) => {
    log.push(['fetch', init.method, url, init.body ?? null])
    const route = url.replace('/api/composer-library/', '')
    if (init.method === 'GET' && route === 'templates') return reply(200, { templates: [...(listIncludesSaved && saved ? [saved] : []), ...templates] })
    const detail = /^templates\/([^/]+)$/.exec(route)
    if (init.method === 'GET' && detail) { // the Studio proxy's trim of Director's template read
      reading++; mostReading = Math.max(mostReading, reading)
      try {
        const answer = details[decodeURIComponent(detail[1])]
        const value = typeof answer === 'function' ? await answer() : answer
        if (value === 'throw') throw new TypeError('network')
        return value ? reply(value.status ?? 200, value.json) : reply(404, { detail: 'Stage template not found' })
      } finally { reading-- }
    }
    const job = /^jobs\/([^/]+)$/.exec(route)
    if (init.method === 'GET' && job) {
      const list = answers.get(decodeURIComponent(job[1]))
      if (!list) return reply(404, { detail: 'Stage ingest job not found' })
      const answer = list.length > 1 ? list.shift() : list[0]
      if (answer.template_id) listIncludesSaved = true
      return reply(200, answer)
    }
    if (init.method === 'POST' && (/^templates\/[^/]+\/use$/.test(route) || route === 'upload-reference')) {
      const next = pending.shift()
      assert.ok(next, `a POST ${route} the scenario did not expect`)
      answers.set(next.job_id, [...next.answers])
      return reply(202, { job_id: next.job_id, status: 'queued' })
    }
    return reply(404, { error: 'Not found' })
  }
  class FixedDate extends Date {}
  FixedDate.now = () => NOW
  const globals = {
    fetch, URL, AbortController, DOMException, Error, Date: FixedDate,
    setTimeout: callback => { setTimeout(callback, 0); return 1 }, clearTimeout: () => {},
    crypto: { randomUUID: () => `fresh-session-000${++sessions}` },
    sessionStorage: {
      getItem: key => { log.push(['getItem', key]); return store.get(key) ?? null },
      setItem: (key, value) => { log.push(['setItem', key, value]); store.set(key, value) },
      removeItem: key => { log.push(['removeItem', key]); store.delete(key) },
    },
    window: { location: { assign: url => log.push(['assign', url]) } },
  }
  const runtime = createRuntime()
  const env = { NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT, NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL: RESEARCHER, NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED: 'true',
    NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true', ...(shell ? { [SHELL]: 'true' } : {}), ...(progress ? { [PROGRESS]: 'true' } : {}),
    ...(flag === undefined ? {} : { [FLAG]: flag }), ...extraEnv }
  const stubs = {
    react: runtime.react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }),
    '@/components/ui/dialog': { Dialog: 'Dialog', DialogContent: 'DialogContent', DialogDescription: 'DialogDescription', DialogHeader: 'DialogHeader', DialogTitle: 'DialogTitle' },
    '@/components/ui/button': { Button: 'Button' }, '@/components/ui/textarea': { Textarea: 'Textarea' },
    '@/hooks/use-toast': { toast: () => ({}) },
    '@/hooks/use-auth': { useAuth: () => ({ user: { id: OWNER } }) },
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
    log, store,
    get tree() { return tree },
    /** The most template reads that were on their way at the same moment. */
    get mostReading() { return mostReading },
    render(next = {}) { props = { ...props, ...next }; tree = runtime.render(Dialog, props); return tree },
    async settle(turns = 12) { ui.render(); for (let i = 0; i < turns; i++) { await tick(); ui.render() } return tree },
    all: () => flat(expand(tree)),
    buttons: label => ui.all().filter(node => node.type === 'Button' && squash(text(node)) === label),
    click(label, index = 0) {
      const button = ui.buttons(label)[index]
      assert.ok(button, `button "${label}" #${index}`)
      if (button.props.disabled) return 'disabled'
      button.props.onClick()
      return 'clicked'
    },
    rowNode: id => ui.all().find(node => node.props?.['data-studio-composer-record'] === id) ?? null,
    chooseFile(file) { ui.all().find(node => node.props?.id === 'composer-template-file').props.onChange({ target: { files: [file] } }) },
    async close() { ui.render({ open: false }); await tick() },
  }
  return ui
}

// What the dialog draws for the report of one row (the studio shell marks everything; the plain shell is found by its roles and labels).
function blockOf(ui, id, shell = true) {
  const record = shell ? ui.rowNode(id) : flat(expand(ui.tree)).filter(node => node.type === 'div' && node.props?.className === 'space-y-3 rounded-md border p-3')[ids().indexOf(id)]
  assert.ok(record, `row ${id}`)
  const blocks = flat(record).filter(node => node.type === 'div' && node.props?.['aria-label'] === 'What changed')
  assert.ok(blocks.length <= 1, 'at most one report per row')
  return blocks[0] ?? null
}
const ids = () => LIST().map(item => item.id)
function readBlock(block) {
  const nodes = flat(block)
  const paragraphs = nodes.filter(node => node.type === 'p').map(node => squash(text(node)))
  const changes = nodes.find(node => node.type === 'ul' && node.props['aria-label'] === 'Changes')
  const strip = nodes.find(node => node.type === 'ul' && node.props['aria-label'] === 'Slide by slide')
  const details = nodes.find(node => node.type === 'details') ?? null
  const lines = changes ? flat(changes).filter(node => node.type === 'li').map(li => ({
    text: squash(text(li)), label: flat(li).find(node => String(node.type).startsWith('Icon:')).props['aria-label'], icon: flat(li).find(node => String(node.type).startsWith('Icon:')).type,
    outcome: li.props['data-studio-admission-row'], emphasis: li.props['data-studio-admission-emphasis'], bold: /font-medium/.test(li.props.className),
  })) : []
  const chips = strip ? flat(strip).filter(node => node.type === 'li').map(li => ({ slide: squash(text(li)), kind: li.props['data-studio-admission-chip'], label: li.props['aria-label'], title: li.props.title })) : []
  return { headline: nodes.find(node => node.props?.['data-studio-admission-headline'])?.props.children ?? paragraphs[1], caption: paragraphs[0], paragraphs, details, lines, chips,
    more: paragraphs.find(line => /^and \d+ more small changes?$/.test(line)) ?? null }
}

// ---- 1. the pure view, on the real answers --------------------------------------------------------------------------------------------------
const OUTCOME_WORDS = { text_left_out: 'Text left out', floor: 'Slide rebuilt over a picture', dropped: 'Left out', picture: 'Kept as a picture', check: 'Please check',
  rebuilt: 'Rebuilt', simplified: 'Simplified', text_split: 'Text box separated', other: 'Changed' }
const EMPHASISED = ['text_left_out', 'floor', 'dropped', 'picture']
const OUTCOMES = ['text_left_out', 'floor', 'dropped', 'picture', 'check', 'rebuilt', 'simplified', 'text_split']
const CLEAN_TEXTS = ['On slide 4, a dashed outline is drawn solid.', 'On slide 1, letter spacing is set to normal in 1 text box.']

function pureChecks(sources) {
  const lib = createLoader({ sources, env: {}, stubs: {}, globals: {} }).load(LIB)
  const view = lib.admissionReportView
  // every real report: its sentences exactly as sent, in rank order, the emphasised ones, the open state, the strip
  for (const name of WITH_REPORT) {
    const report = reportOf(name), v = view(report)
    check(assert.ok, v, name)
    check(assert.equal, v.headline, report.headline, `${name}: the headline as sent`)
    deq(v.rows.map(item => item.text), [...report.changes].sort((a, b) => a.rank - b.rank).map(change => change.text), `${name}: the sentences as sent, most serious first`)
    deq(v.rows.map(item => item.outcome), [...report.changes].sort((a, b) => a.rank - b.rank).map(change => change.outcome), `${name}: the outcomes`)
    deq(v.rows.map(item => item.slides), [...report.changes].sort((a, b) => a.rank - b.rank).map(change => change.slides), `${name}: the slides of each row`)
    for (const item of v.rows) check(assert.equal, item.emphasised, EMPHASISED.includes(item.outcome), `${name}: ${item.outcome} emphasised or not`)
    for (let i = 1; i < v.rows.length; i++) check(assert.ok, OUTCOMES.indexOf(v.rows[i - 1].outcome) <= OUTCOMES.indexOf(v.rows[i].outcome), `${name}: rank order`)
    check(assert.equal, v.open, v.rows.some(item => item.emphasised), `${name}: open exactly when something is emphasised`)
    check(assert.equal, v.moreLine, report.changes_more > 0 ? `and ${report.changes_more} more small ${report.changes_more === 1 ? 'change' : 'changes'}` : null, `${name}: the more line`)
    // the library list's version of the same report: the same view without the strip
    const listed = view(rowOf(name).admission_report)
    deq({ ...listed, strip: undefined, stripNote: undefined }, { ...v, strip: undefined, stripNote: undefined }, `${name}: the list row reads as the job read, without the strip`)
    check(assert.equal, listed.strip, null, `${name}: no slides in the list, so no strip`)
    check(assert.equal, listed.stripNote, null)
    check(assert.ok, Array.isArray(v.strip), `${name}: the job read has a strip`)
  }
  // the pinned facts of the cases
  const clean = view(reportOf('admitted-clean'))
  deq(clean.rows.map(item => item.text), CLEAN_TEXTS)
  deq(clean.rows.map(item => [item.outcome, item.emphasised]), [['simplified', false], ['simplified', false]])
  check(assert.equal, clean.open, false, 'only small changes: the list starts closed')
  check(assert.equal, clean.moreLine, null)
  deq(clean.strip, [{ slide: 1, kind: 'changed', label: 'Slide 1: 14 editable' }, { slide: 2, kind: 'quiet', label: 'Slide 2: 12 editable' }, { slide: 3, kind: 'quiet', label: 'Slide 3: 15 editable' },
    { slide: 4, kind: 'changed', label: 'Slide 4: 16 editable' }, { slide: 5, kind: 'quiet', label: 'Slide 5: 14 editable' }, { slide: 6, kind: 'quiet', label: 'Slide 6: 14 editable' }])
  check(assert.equal, clean.stripNote, null)
  const none = view(reportOf('admitted-no-changes'))
  deq(none.rows, [])
  check(assert.equal, none.headline, 'Template ready: 8 slides. All 72 pieces of text are editable. 112 of 112 elements are editable. No changes were needed.')
  check(assert.equal, none.open, false)
  check(assert.ok, none.strip.every(chip => chip.kind === 'quiet'))
  const partial = view(reportOf('partially-admitted'))
  deq(partial.rows.map(item => [item.outcome, item.emphasised]), [['text_left_out', true], ['text_left_out', true], ['dropped', true], ['picture', true], ['picture', true], ['check', false],
    ['rebuilt', false], ['simplified', false], ['simplified', false], ['simplified', false], ['simplified', false], ['text_split', false]])
  check(assert.equal, partial.open, true, 'something left out: the list starts open')
  check(assert.equal, partial.rows[5].text, 'Slide 7 may look slightly different in an area we did not change.')
  deq(partial.strip.map(chip => [chip.slide, chip.kind]), [[1, 'changed'], [2, 'attention'], [3, 'attention'], [4, 'changed'], [5, 'picture'], [6, 'quiet'], [7, 'changed'], [8, 'changed'],
    [9, 'attention'], [10, 'changed'], [11, 'changed'], [12, 'quiet']])
  check(assert.equal, partial.strip[1].label, 'Slide 2: 19 editable, 1 element left out, 2 pieces of text left out')
  check(assert.equal, partial.strip[2].label, 'Slide 3: 15 editable, 1 element left out')
  check(assert.equal, partial.strip[4].label, 'Slide 5: 15 editable, 3 kept as pictures')
  const floor = view(reportOf('floor-slide'))
  deq(floor.rows.map(item => [item.outcome, item.emphasised]), [['text_left_out', true], ['floor', true]])
  check(assert.equal, floor.rows[1].text, 'Slide 6 could not be read piece by piece: its text is editable over one picture of the rest.')
  deq(floor.strip.filter(chip => chip.kind !== 'quiet'), [{ slide: 6, kind: 'floor', label: floor.strip[5].label }])
  check(assert.match, floor.strip[5].label, /^Slide 6: .*built over one picture$/)
  const many = view(reportOf('many-changes'))
  check(assert.equal, many.rows.length, 40)
  check(assert.equal, many.moreLine, 'and 1 more small change', 'changes_more 1: singular')
  check(assert.equal, many.open, false)
  const big = view(reportOf('big-deck')), bigReport = reportOf('big-deck')
  const loud = bigReport.slides.filter(slide => slide.floor || slide.dropped || slide.text_listed || slide.picture || slide.changed || slide.changes)
  check(assert.ok, bigReport.slides.length > 60, 'a long deck')
  deq(big.strip.map(chip => chip.slide), loud.map(slide => slide.slide), 'a long deck: only the slides with something to say, in order')
  check(assert.equal, big.stripNote, `${bigReport.totals.slides - loud.length} slides with nothing to report are not shown.`, 'the count comes from totals.slides, not from the rows the report kept')
  check(assert.equal, big.strip.find(chip => chip.slide === 200).kind, 'attention')
  check(assert.equal, big.strip.find(chip => chip.slide === 413).kind, 'picture')
  // nothing to show
  for (const name of NO_REPORT) check(assert.equal, view(jobOf(name).admission_report), null, `${name}: Director says null`)
  check(assert.equal, view(jobOf('director-flag-off').admission_report), null, "Director's flag off: no key")
  for (const name of [...NO_REPORT, 'director-flag-off']) for (const item of CASES[name].list.json.templates) check(assert.equal, view(item.admission_report), null, `${name}: a list row with no key`)
  for (const garbage of [undefined, null, 0, 1, '', 'x', true, false, [], [1], {}, { version: 'composer-admission-report-v1' }, () => 1, new Date(0), NaN]) check(assert.equal, view(garbage), null, `garbage ${String(garbage)}`)

  // a report that does not read as one is dropped whole
  const base = () => reportOf('partially-admitted')
  const set = (path, value) => { const report = base(); let holder = report; for (const step of path.slice(0, -1)) holder = holder[step]; if (value === undefined) delete holder[path.at(-1)]; else holder[path.at(-1)] = value; return report }
  const drop = (label, report) => check(assert.equal, view(report), null, `dropped: ${label}`)
  drop('another version', set(['version'], 'composer-admission-report-v2'))
  drop('no version', set(['version'], undefined))
  for (const headline of ['', 'x'.repeat(241), '<b>Template ready</b>', 'Template ready.\n', 'Template "ready".', 'Template ready!', 7, null, undefined]) drop(`headline ${JSON.stringify(headline)}`, set(['headline'], headline))
  check(assert.ok, view(set(['headline'], "Template ready: 6 slides, 100% (all) a/b + c & d; e-f 'g'.")), 'every allowed punctuation mark reads')
  check(assert.ok, view(set(['headline'], 'x'.repeat(240))), '240 characters read')
  drop('changes not a list', set(['changes'], {}))
  drop('41 changes', set(['changes'], Array.from({ length: 41 }, () => base().changes[0])))
  check(assert.ok, view(set(['changes'], Array.from({ length: 40 }, () => base().changes[0]))), '40 changes read')
  for (const value of [null, 'On slide 1, text.', 7]) drop(`a change that is ${JSON.stringify(value)}`, set(['changes', 0], value))
  for (const value of ['', 'On slide 1, <i>text</i> is left out.', 'On slide 1, text is left out.\n', 'x'.repeat(241), 7, null, undefined]) drop(`change text ${JSON.stringify(value)}`, set(['changes', 2, 'text'], value))
  for (const value of [[0], [501], [1.5], ['3'], [null], Array.from({ length: 13 }, (_, i) => i + 1), 3, null, undefined]) drop(`change slides ${JSON.stringify(value)}`, set(['changes', 1, 'slides'], value))
  check(assert.ok, view(set(['changes', 1, 'slides'], Array.from({ length: 12 }, (_, i) => i + 1))), '12 slide numbers read')
  check(assert.ok, view(set(['changes', 1, 'slides'], [500])), 'slide 500 reads')
  for (const value of [-1, 1.5, '2', null, undefined]) drop(`change count ${JSON.stringify(value)}`, set(['changes', 0, 'count'], value))
  for (const value of [-1, 1.5, '1', null, undefined]) drop(`changes_more ${JSON.stringify(value)}`, set(['changes_more'], value))
  check(assert.ok, view(set(['changes_more'], 0)), 'changes_more 0 reads')
  // what is tolerated: other keys, a rank or outcome this list does not know, a bad strip
  const extra = base(); extra.future = { a: 1 }; extra.changes[0].more = true; extra.slides[0].more = 1
  deq(view(extra), view(base()), 'unknown keys are ignored')
  const unknown = base(); unknown.changes[3] = { ...unknown.changes[3], outcome: 'future_outcome', rank: 4 }
  const unknownView = view(unknown)
  check(assert.ok, unknownView, 'an outcome this list does not know is shown')
  deq(unknownView.rows[3], { outcome: 'other', emphasised: false, text: unknown.changes[3].text, slides: unknown.changes[3].slides }, 'plainly, not emphasised')
  const unranked = base(); delete unranked.changes[4].rank; delete unranked.changes[2].rank
  deq(view(unranked).rows.map(item => item.text), view(base()).rows.map(item => item.text), 'a missing rank is the outcome\'s own')
  const lastUnknown = base(); lastUnknown.changes.unshift({ ...base().changes[0], outcome: 'future_outcome', rank: 99, text: 'On slide 1, something new happened.' })
  check(assert.equal, view(lastUnknown).rows.at(-1).text, 'On slide 1, something new happened.', 'an unranked unknown outcome goes last')
  const shuffled = base(); shuffled.changes.reverse()
  const shuffledView = view(shuffled)
  deq(shuffledView.rows.map(item => OUTCOMES.indexOf(item.outcome)), [...shuffledView.rows.map(item => OUTCOMES.indexOf(item.outcome))].sort((a, b) => a - b), 'sorted by rank whatever order it arrives in')
  deq(shuffledView.rows.filter(item => item.outcome === 'simplified').map(item => item.text), base().changes.filter(change => change.outcome === 'simplified').map(change => change.text).reverse(), 'equal ranks keep the order they arrived in')
  const noStrip = (label, report) => { const v = view(report); check(assert.ok, v, `${label}: the report is kept`); check(assert.equal, v.strip, null, `${label}: no strip`); check(assert.equal, v.stripNote, null); deq(v.rows, view(base()).rows) }
  noStrip('no slides', set(['slides'], undefined))
  noStrip('slides not a list', set(['slides'], {}))
  noStrip('501 slide rows', set(['slides'], Array.from({ length: 501 }, (_, i) => ({ ...base().slides[0], slide: Math.min(i + 1, 500) }))))
  noStrip('a slide row that is null', set(['slides', 3], null))
  noStrip('slide 0', set(['slides', 0, 'slide'], 0))
  noStrip('slide 501', set(['slides', 0, 'slide'], 501))
  noStrip('a count that is a string', set(['slides', 2, 'editable'], '4'))
  noStrip('a negative count', set(['slides', 2, 'dropped'], -1))
  noStrip('floor not a boolean', set(['slides', 2, 'floor'], 'false'))
  noStrip('a count missing', set(['slides', 5, 'text_listed'], undefined))
  // the strip: order, the long-deck rule, the cap
  const unordered = base(); unordered.slides.reverse()
  deq(view(unordered).strip, view(base()).strip, 'the strip is in slide order')
  const rows = (count, loudOn = []) => Array.from({ length: count }, (_, i) => ({ slide: i + 1, elements: 10, editable: loudOn.includes(i + 1) ? 8 : 10, picture: 0, dropped: loudOn.includes(i + 1) ? 2 : 0, changed: 0, text_pieces: 4,
    text_editable: 4, text_listed: 0, floor: false, changes: loudOn.includes(i + 1) ? 2 : 0 }))
  const shaped = (slides, totalSlides = slides.length) => ({ ...base(), slides, totals: { ...base().totals, slides: totalSlides } })
  check(assert.equal, view(shaped(rows(60))).strip.length, 60, 'a deck of 60 slides: every slide has a chip')
  check(assert.equal, view(shaped(rows(61, [7]))).strip.length, 1, 'a deck of 61 slides: only the slide with something to say')
  check(assert.equal, view(shaped(rows(61, [7]))).stripNote, '60 slides with nothing to report are not shown.')
  check(assert.equal, view(shaped(rows(61, [7, 9]))).stripNote, '59 slides with nothing to report are not shown.')
  check(assert.equal, view(shaped(rows(62, [7]), 63)).stripNote, '62 slides with nothing to report are not shown.', 'totals.slides counts the rows the report left out')
  check(assert.equal, view(shaped(rows(61, [7]))).strip[0].label, 'Slide 7: 8 editable, 2 elements left out')
  const crowd = Array.from({ length: 200 }, (_, i) => i + 1)
  const crowded = view(shaped(rows(200, crowd)))
  check(assert.equal, crowded.strip.length, 120, 'at most 120 chips')
  check(assert.equal, crowded.stripNote, '80 more slides with changes are not shown.')
  check(assert.equal, view(shaped(rows(61, [7]), 50)).stripNote, '60 slides with nothing to report are not shown.', 'a total below the rows never lowers the count')
  check(assert.equal, view(shaped(rows(1))).stripNote, null)
  check(assert.equal, view(shaped(rows(2, [1]), 1)).stripNote, null, 'a total lower than the rows never makes a note')
  check(assert.equal, view(set(['totals'], undefined)).stripNote, null, 'no totals: no note')
  // the chip kinds and their priority
  const chip = patch => view(shaped([{ ...rows(1)[0], ...patch }])).strip[0]
  check(assert.equal, chip({ floor: true, dropped: 1, picture: 1, changed: 1, changes: 1 }).kind, 'floor', 'floor outranks the rest')
  check(assert.equal, chip({ dropped: 1, picture: 1, changed: 1, changes: 1, editable: 9 }).kind, 'attention', 'left out outranks a picture')
  check(assert.equal, chip({ text_listed: 1, picture: 1 }).kind, 'attention', 'text left out is attention too')
  check(assert.equal, chip({ picture: 1, changed: 1, editable: 9 }).kind, 'picture')
  check(assert.equal, chip({ changed: 1 }).kind, 'changed')
  check(assert.equal, chip({ changes: 1 }).kind, 'changed', 'a change that touched no editable element still shows')
  check(assert.equal, chip({}).kind, 'quiet')
  check(assert.equal, chip({ picture: 1 }).label, 'Slide 1: 10 editable, 1 kept as a picture')
  check(assert.equal, chip({ picture: 2 }).label, 'Slide 1: 10 editable, 2 kept as pictures')
  check(assert.equal, chip({ dropped: 3 }).label, 'Slide 1: 10 editable, 3 elements left out')
  check(assert.equal, chip({ text_listed: 1 }).label, 'Slide 1: 10 editable, 1 piece of text left out')
  check(assert.equal, chip({ text_listed: 4 }).label, 'Slide 1: 10 editable, 4 pieces of text left out')
  check(assert.equal, chip({ floor: true }).label, 'Slide 1: 10 editable, built over one picture')
  // the more line
  for (const [n, line] of [[1, 'and 1 more small change'], [2, 'and 2 more small changes'], [40, 'and 40 more small changes']]) check(assert.equal, view(set(['changes_more'], n)).moreLine, line)
  check(assert.equal, view(set(['changes_more'], 0)).moreLine, null)
  // job read or list row
  const jobView = lib.admissionReportFor(reportOf('admitted-clean'), reportOf('partially-admitted'))
  check(assert.equal, jobView.headline, reportOf('admitted-clean').headline, 'the tracked job wins when it reads as a report')
  check(assert.ok, Array.isArray(jobView.strip))
  for (const unreadable of [null, undefined, {}, { version: 'x' }, 'x']) check(assert.equal, lib.admissionReportFor(unreadable, reportOf('partially-admitted')).headline, reportOf('partially-admitted').headline, 'otherwise the row\'s own')
  check(assert.equal, lib.admissionReportFor(null, null), null)
  check(assert.equal, lib.admissionReportFor(reportOf('admitted-clean'), null).headline, reportOf('admitted-clean').headline)
  check(assert.equal, lib.admissionReportFor(null, reportOf('admitted-clean')).strip.length, 6)
  // reading changes nothing
  const frozen = base()
  const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze) } return value }
  const before = ser(frozen)
  view(freeze(frozen))
  check(assert.equal, ser(frozen), before, 'a frozen report reads and is left as it was')
  const input = base(), inputBefore = ser(input), read = view(input)
  for (const item of read.rows) item.slides.push(999)
  for (const item of read.strip) item.label += '!'
  check(assert.equal, ser(input), inputBefore, 'what the view hands out shares nothing with the report it read')
  deq(lib.ADMISSION_OUTCOMES, OUTCOMES, "the contract's closed list, most serious first")
  deq(lib.ADMISSION_EMPHASISED, EMPHASISED, 'the four to emphasise')
  deq(lib.ADMISSION_OUTCOME_WORDS, OUTCOME_WORDS)
  check(assert.equal, lib.ADMISSION_REPORT_VERSION, 'composer-admission-report-v1')
}

// ---- 2. flag off: the base dialog's tree, requests and writes, step for step -----------------------------------------------------------------
const framesJob = (name, job_id = UPLOAD_JOB) => ({ ...structuredClone(jobOf(name)), job_id })
/** A frame that ends the watch (a finished job: status complete, poll null), so no scenario leaves a poll running when it is done. */
const ending = job => ({ ...job, status: 'complete', poll: null })
const SAVED = () => ({ ...structuredClone(rowOf('progress-flow-mid-run')), id: TEMPLATE_ID, name: `Deck04_Fabrikam_Review.pptx — upload 2026-10-15 12:00 UTC [${TEMPLATE_ID}]` })
const SCENARIOS = {
  'open, the list carries reports': { opts: () => ({ templates: LIST() }), steps: [] },
  'open, an empty library': { opts: () => ({ templates: [] }), steps: [] },
  'open, a list with no report at all': { opts: () => ({ templates: LIST().map(item => { const { admission_report, ...rest } = item; return rest }) }), steps: [] },
  'New topic opened on a row with a report': { opts: () => ({ templates: LIST() }), steps: [ui => ui.click('New topic', 2)] },
  'upload (progress on): the job reads carry the report': { opts: () => ({ progress: true, templates: LIST(), saved: SAVED(),
    queue: [{ job_id: UPLOAD_JOB, answers: [framesJob('progress-flow-mid-run'), framesJob('progress-flow-done')] }] }),
  steps: [ui => ui.chooseFile({ name: 'Deck04_Fabrikam_Review.pptx', size: 4096 }), ui => ui.click('Upload template')] },
}
async function play(sources, flag, name, { shell = true } = {}) {
  const scenario = SCENARIOS[name]
  const ui = mount({ sources, flag, shell, ...scenario.opts() })
  await ui.settle()
  const snaps = [ser(ui.tree)]
  for (const step of scenario.steps) { step(ui); await ui.settle(); snaps.push(ser(ui.tree)) }
  snaps.push(ser(ui.log))
  await ui.close()
  return { ui, hash: sha(snaps.join('\n')) }
}

function sourceChecks(sources) {
  const dialog = sources[DIALOG], hook = sources[HOOK], lib = sources[LIB], view = sources[VIEW]
  // The dialog minus the added lines is the base's, byte for byte: nothing else was touched; and every addition is there exactly once.
  const stripped = stripAdmissionReport(DIALOG, dialog)
  check(assert.equal, stripped, baseDialog, `the dialog without the added lines is ${BASE}'s`)
  for (const [from] of ADMISSION_ADDITIONS) check(assert.equal, (dialog.match(new RegExp(from.source, 'g')) ?? []).length, 1, `one: ${from.source.slice(0, 70)}`)
  check(assert.equal, /dmission/.test(stripped), false, 'nothing of this change is left after the strip')
  check(assert.equal, stripAdmissionReport('components/other.tsx', dialog), dialog, 'any other file comes back as it is')
  // The flag is read once, inline, as the exact string "true", and only by the dialog; the lib, the component and the hook read no environment.
  check(assert.equal, dialog.split("process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT === 'true'").length, 2)
  check(assert.equal, (dialog.match(/process\.env\.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT/g) ?? []).length, 1)
  const code = value => value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  check(assert.equal, [lib, view, hook].some(value => /process\.env|NEXT_PUBLIC/.test(code(value))), false, 'only the dialog reads the flag')
  // The lib is pure and import-free.
  check(assert.equal, /^\s*import\b|\brequire\(|\bimport\(/m.test(code(lib)), false, 'the lib has no imports at all')
  check(assert.equal, /\bfetch\b|sessionStorage|localStorage|document\.|window\./.test(code(lib)), false, 'the lib touches nothing')
  // The component draws no network, no storage, and no text of its own beyond the caption and the toggle (every sentence is Director's).
  check(assert.equal, /fetch|sessionStorage|localStorage|dangerouslySetInnerHTML|innerHTML/.test(code(view)), false, 'the component only draws')
  check(assert.equal, (code(view).match(/\.key\b/g) ?? []).length + [...code(view).matchAll(/(\w+)\.kind\b/g)].filter(found => found[1] !== 'chip').length, 0, "no sentence is built from the report's key or kind (the strip's own chip.kind is the only .kind)")
  // The hook: the one addition is `report`, inert (null) when the progress flag is off.
  check(assert.ok, hook.includes('around: node => node, report: () => null,'), 'inert hook: report is null')
  check(assert.ok, hook.includes("report: templateId => job && job.template_id === templateId ? (job as { admission_report?: unknown }).admission_report ?? null : null,"))
  // The stylesheets: the library's own untouched, the new one scoped to the report's markers (which exist only with the flag on).
  const css = read(CSS), baseCss = execFileSync('git', ['show', `${BASE}:${LIBRARY_CSS}`], { cwd: root, encoding: 'utf8' })
  check(assert.equal, read(LIBRARY_CSS), baseCss, "the library's stylesheet is untouched")
  const rules = css.split('\n').filter(line => line && !line.startsWith('/*'))
  check(assert.ok, rules.length > 12)
  for (const line of rules) check(assert.match, line, /^(\.dark )?\[data-studio-admission-(report|headline|details|row|emphasis|more|chip)/, line.slice(0, 80))
  check(assert.equal, (dialog.match(/data-studio-admission/g) ?? []).length, 0, 'the dialog itself never draws a marker')
  // Documented default off, the script registered, and set nowhere by default.
  check(assert.equal, (read('.env.example').match(/^NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT="false"$/gm) ?? []).length, 1, '.env.example documents the flag, default off')
  check(assert.equal, JSON.parse(read('package.json')).scripts['test:studio-template-admission-report'], 'node scripts/test-studio-template-admission-report.mjs', 'the script is registered')
  for (const file of ['vercel.json', 'vercel.dev.json']) check(assert.equal, read(file).includes('STUDIO_TEMPLATE_ADMISSION_REPORT'), false, `${file} does not turn it on`)
}

const baseHashes = new Map() // the base dialog's hash per scenario and shell: the same for every mutant, so measured once
async function baseHash(name, shell) {
  const key = `${name}|${shell}`
  if (!baseHashes.has(key)) baseHashes.set(key, (await play(baseSources, undefined, name, { shell })).hash)
  return baseHashes.get(key)
}
/** `light` (the mutants): the studio shell and three spellings of the flag; the whole suite runs both shells and five spellings once, unmutated. */
async function flagOffChecks(sources, light = false) {
  const withProgress = name => SCENARIOS[name].opts().progress === true
  const shells = light ? [true] : [true, false], spellings = light ? [undefined, 'false', '1'] : [undefined, 'false', '1', 'TRUE', ' true']
  for (const shell of shells) for (const name of Object.keys(SCENARIOS)) {
    const base = await baseHash(name, shell)
    for (const flag of spellings) {
      check(assert.equal, (await play(sources, flag, name, { shell })).hash, base, `flag ${JSON.stringify(flag)}, shell ${shell}: ${name}`)
    }
  }
  check(assert.equal, withProgress('upload (progress on): the job reads carry the report'), true)
  // Flag on, but no row has a report to show: the base's tree, requests and storage access.
  for (const shell of shells) for (const name of ['open, an empty library', 'open, a list with no report at all']) {
    const lit = await play(sources, 'true', name, { shell })
    check(assert.equal, lit.hash, await baseHash(name, shell), `flag on, nothing to show, shell ${shell}: ${name}: the base's tree, requests and storage access`)
  }
  { // a list whose only reports are unreadable
    const templates = [noKey(ID.none, 'composer-flag-off'), { ...noKey(ID.garbage, 'composer-flag-off'), admission_report: { version: 'composer-admission-report-v9' } }, { ...noKey(ID.off, 'director-flag-off'), admission_report: null }]
    const hash = async (sourceSet, flag) => { const ui = mount({ sources: sourceSet, flag, templates }); await ui.settle(); const out = sha(ser(ui.tree) + ser(ui.log)); await ui.close(); return out }
    if (!baseHashes.has('unreadable')) baseHashes.set('unreadable', await hash(baseSources, undefined))
    check(assert.equal, await hash(sources, 'true'), baseHashes.get('unreadable'), 'flag on, reports that do not read as reports: the base\'s tree')
  }
}

const expectedView = raw => createLoader({ sources: branchSources, env: {}, stubs: {}, globals: {} }).load(LIB).admissionReportView(raw) // what the dialog must draw (the unmutated lib)

// ---- 3. flag on ------------------------------------------------------------------------------------------------------------------------------
async function flagOnChecks(sources) {
  for (const shell of [true, false]) {
    const ui = mount({ sources, flag: 'true', shell, templates: LIST() })
    await ui.settle()
    const find = id => shell ? blockOf(ui, id) : (() => { const rows = flat(expand(ui.tree)).filter(node => node.type === 'div' && node.props?.className === 'space-y-3 rounded-md border p-3'); const at = ids().indexOf(id); return flat(rows[at]).find(node => node.type === 'div' && node.props?.['aria-label'] === 'What changed') ?? null })()
    // under the rows with a report; none under the others
    for (const id of [ID.clean, ID.quiet, ID.partial, ID.many, ID.floor]) check(assert.ok, find(id), `shell ${shell}: ${id} has its report`)
    for (const id of [ID.none, ID.garbage, ID.off]) check(assert.equal, find(id), null, `shell ${shell}: ${id} shows nothing`)
    const clean = readBlock(find(ID.clean))
    check(assert.equal, clean.caption, 'What changed')
    check(assert.equal, clean.headline, reportOf('admitted-clean').headline, 'the headline as sent')
    deq(clean.lines.map(line => line.text), CLEAN_TEXTS, 'each change as sent, most serious first')
    deq(clean.lines.map(line => line.label), ['Simplified', 'Simplified'])
    deq(clean.lines.map(line => line.icon), ['Icon:SlidersHorizontal', 'Icon:SlidersHorizontal'])
    check(assert.equal, clean.details.props.open, false, 'only small changes: the list starts closed')
    check(assert.equal, squash(text(flat(clean.details).find(node => node.type === 'summary'))), 'List of changes')
    check(assert.equal, clean.chips.length, 0, 'the library list has no slides: no strip')
    check(assert.equal, clean.more, null)
    deq(clean.lines.map(line => line.emphasis), shell ? [undefined, undefined] : [undefined, undefined])
    check(assert.equal, clean.lines.some(line => line.bold), false)
    const quiet = readBlock(find(ID.quiet))
    check(assert.equal, quiet.headline, reportOf('admitted-no-changes').headline, 'no changes: the headline alone')
    check(assert.equal, quiet.details, null, 'no changes: no list to open')
    deq(quiet.lines, [])
    deq(quiet.chips, [])
    check(assert.equal, quiet.caption, 'What changed')
    const partial = readBlock(find(ID.partial))
    check(assert.equal, partial.headline, reportOf('partially-admitted').headline)
    deq(partial.lines.map(line => line.text), expectedView(reportOf('partially-admitted')).rows.map(item => item.text), 'the sentences as sent')
    deq(partial.lines.map(line => line.label), ['Text left out', 'Text left out', 'Left out', 'Kept as a picture', 'Kept as a picture', 'Please check', 'Rebuilt', 'Simplified', 'Simplified', 'Simplified', 'Simplified', 'Text box separated'])
    deq(partial.lines.map(line => line.icon), ['Icon:Type', 'Icon:Type', 'Icon:EyeOff', 'Icon:Image', 'Icon:Image', 'Icon:ScanSearch', 'Icon:Wrench', 'Icon:SlidersHorizontal', 'Icon:SlidersHorizontal',
      'Icon:SlidersHorizontal', 'Icon:SlidersHorizontal', 'Icon:Scissors'])
    deq(partial.lines.map(line => line.bold), [true, true, true, true, true, false, false, false, false, false, false, false], 'the four are emphasised')
    if (shell) {
      deq(partial.lines.map(line => line.emphasis), ['true', 'true', 'true', 'true', 'true', undefined, undefined, undefined, undefined, undefined, undefined, undefined])
      deq(partial.lines.map(line => line.outcome), ['text_left_out', 'text_left_out', 'dropped', 'picture', 'picture', 'check', 'rebuilt', 'simplified', 'simplified', 'simplified', 'simplified', 'text_split'])
    }
    check(assert.equal, partial.details.props.open, true, 'something left out: the list starts open')
    const many = readBlock(find(ID.many))
    check(assert.equal, many.lines.length, 40)
    check(assert.equal, many.more, 'and 1 more small change')
    check(assert.equal, many.details.props.open, false)
    const floor = readBlock(find(ID.floor))
    deq(floor.lines.map(line => [line.label, line.icon, line.bold]), [['Text left out', 'Icon:Type', true], ['Slide rebuilt over a picture', 'Icon:Layers', true]])
    // the block sits after the row's own block, inside the same card, and the row's buttons are where they were
    const record = shell ? ui.rowNode(ID.partial) : null
    if (shell) {
      const order = flat(record)
      check(assert.ok, order.findIndex(node => node.props?.['data-studio-composer-record-row'] !== undefined) < order.findIndex(node => node.props?.['aria-label'] === 'What changed'), 'the report comes after the row')
      check(assert.ok, order.findIndex(node => node.props?.['aria-label'] === 'What changed') >= 0)
      const kids = flat(record).filter(node => node.type === 'div' && node.props?.['data-studio-composer-record-row'] !== undefined)
      check(assert.equal, kids.length, 1)
      check(assert.deepStrictEqual, ['Use original', 'Rebuild from own content', 'New topic'].map(label => flat(record).some(node => node.type === 'Button' && squash(text(node)) === label)), [true, true, true])
    }
    // no storage access, no session, no write: the flag-off trace, plus the template reads (here answered "not found", so nothing is drawn from them) of the two reports that
    // open by themselves (something left out: partial, floor); the closed ones and the rows with nothing to open ask nothing
    const off = mount({ sources, flag: undefined, shell, templates: LIST() }); await off.settle()
    const isRead = entry => entry[0] === 'fetch' && /\/templates\/[^/]+$/.test(entry[2])
    check(assert.equal, ser(ui.log.filter(entry => !isRead(entry))), ser(off.log), `shell ${shell}: the same requests and storage access as flag off, but for the template reads`)
    check(assert.deepStrictEqual, ui.log.map(entry => entry[0] === 'fetch' ? `${entry[1]} ${entry[2]}` : entry[0]),
      ['GET /api/composer-library/templates', 'getItem', `GET /api/composer-library/templates/${ID.partial}`, `GET /api/composer-library/templates/${ID.floor}`],
      'one list read, the dialog\'s own read of its stored job, and one template read for each report that opens by itself; nothing else')
    check(assert.equal, ui.mostReading, 1, 'one template read at a time')
    // the markers exist only in the studio shell
    check(assert.equal, flat(expand(ui.tree)).some(node => Object.entries(node.props ?? {}).some(([name, value]) => name.startsWith('data-studio-admission') && value !== undefined)), shell, `markers in shell ${shell}: ${shell}`)
    await ui.close(); await off.close()
  }

  // The tracked upload: its job read carries the whole report (with slides); it wins for its own template and no other.
  {
    const saved = SAVED()
    const ui = mount({ sources, flag: 'true', progress: true, templates: [row('partially-admitted', ID.partial)], saved,
      queue: [{ job_id: UPLOAD_JOB, answers: [framesJob('progress-flow-mid-run'), framesJob('progress-flow-done')] }] })
    await ui.settle()
    // before the upload: the other row shows its list report, no strip
    check(assert.equal, readBlock(blockOf(ui, ID.partial)).chips.length, 0)
    ui.chooseFile({ name: 'Deck04_Fabrikam_Review.pptx', size: 4096 }); await ui.settle(2)
    check(assert.equal, ui.click('Upload template'), 'clicked')
    await ui.settle(30)
    const own = readBlock(blockOf(ui, TEMPLATE_ID))
    check(assert.equal, own.headline, reportOf('progress-flow-mid-run').headline, 'the saved template shows the report the moment the as-is template is saved')
    deq(own.lines.map(line => line.text), expectedView(reportOf('progress-flow-mid-run')).rows.map(item => item.text))
    deq(own.chips.map(chip => [chip.slide, chip.kind]), expectedView(reportOf('progress-flow-mid-run')).strip.map(chip => [String(chip.slide), chip.kind]), 'with its slide strip (the job read has the slides)')
    deq(own.chips.map(chip => chip.label), expectedView(reportOf('progress-flow-mid-run')).strip.map(chip => chip.label))
    deq(own.chips.map(chip => chip.title), own.chips.map(chip => chip.label), 'each chip says its slide in words')
    check(assert.ok, own.paragraphs.includes('Slide by slide'))
    check(assert.equal, readBlock(blockOf(ui, ID.partial)).chips.length, 0, "another template never gets the job's report (or its strip)")
    check(assert.equal, readBlock(blockOf(ui, ID.partial)).headline, reportOf('partially-admitted').headline)
    // the job ends ("ready for new topics" has nothing to dismiss): the card stays, and the row keeps the job's report with its strip while the library is open
    check(assert.equal, ui.buttons('Dismiss').length, 0)
    check(assert.equal, readBlock(blockOf(ui, TEMPLATE_ID)).chips.length, own.chips.length, 'the strip stays with the tracked job')
    // a library opened afresh (no tracked job) reads the list: the same report without the strip
    const fresh = mount({ sources, flag: 'true', progress: true, templates: [SAVED()] })
    await fresh.settle()
    const listed = readBlock(blockOf(fresh, TEMPLATE_ID))
    check(assert.equal, listed.headline, own.headline)
    deq(listed.lines.map(line => line.text), own.lines.map(line => line.text), 'the same report')
    check(assert.equal, listed.chips.length, 0, 'without the strip: the list has no slides')
    await fresh.close()
    await ui.close()
  }
  { // a long deck's job read (a real progress frame with the 450-slide report Director served): only the slides with something to say, and the note
    const longDeck = { ...framesJob('progress-flow-mid-run'), admission_report: reportOf('big-deck') }
    const ui = mount({ sources, flag: 'true', progress: true, templates: [], saved: SAVED(), queue: [{ job_id: UPLOAD_JOB, answers: [ending(longDeck)] }] })
    await ui.settle(); ui.chooseFile({ name: 'a.pptx', size: 4096 }); await ui.settle(2); ui.click('Upload template'); await ui.settle(30)
    const block = readBlock(blockOf(ui, TEMPLATE_ID)), wanted = expectedView(reportOf('big-deck'))
    deq(block.chips.map(chip => Number(chip.slide)), wanted.strip.map(chip => chip.slide), 'only the slides with something to say')
    check(assert.ok, wanted.stripNote)
    check(assert.ok, block.paragraphs.includes(wanted.stripNote), 'and the note that the others are not shown')
    deq(block.lines.map(line => line.text), wanted.rows.map(item => item.text))
    await ui.close()
  }
  // The tracked job's report is the row's only when it reads as a report, and only for the job's own template.
  {
    const bad = { ...framesJob('progress-flow-mid-run'), admission_report: { version: 'composer-admission-report-v1', headline: '<x>', totals: {}, slides: [], changes: [], changes_more: 0 } }
    const listRow = { ...SAVED(), admission_report: structuredClone(rowOf('progress-flow-mid-run').admission_report) }
    const ui = mount({ sources, flag: 'true', progress: true, templates: [], saved: listRow, queue: [{ job_id: UPLOAD_JOB, answers: [ending(bad)] }] })
    await ui.settle(); ui.chooseFile({ name: 'a.pptx', size: 4096 }); await ui.settle(2); ui.click('Upload template'); await ui.settle(30)
    const block = readBlock(blockOf(ui, TEMPLATE_ID))
    check(assert.equal, block.headline, reportOf('progress-flow-mid-run').headline, "a job report that does not read falls back to the row's own")
    check(assert.equal, block.chips.length, 0)
    await ui.close()
  }
  { // a job whose report is null (Composer's flag off): the row's report, if any, is the list's; nothing otherwise
    const nullJob = { ...framesJob('progress-flow-mid-run'), admission_report: null }
    const ui = mount({ sources, flag: 'true', progress: true, templates: [], saved: SAVED(), queue: [{ job_id: UPLOAD_JOB, answers: [ending(nullJob)] }] })
    await ui.settle(); ui.chooseFile({ name: 'a.pptx', size: 4096 }); await ui.settle(2); ui.click('Upload template'); await ui.settle(30)
    const saved = SAVED()
    const record = ui.rowNode(TEMPLATE_ID)
    check(assert.ok, record, 'the saved template is in the list')
    check(assert.equal, flat(record).some(node => node.props?.['aria-label'] === 'What changed'), true, "the list row's own report")
    await ui.close()
    const clean = mount({ sources, flag: 'true', progress: true, templates: [], saved: (({ admission_report, ...rest }) => rest)(saved), queue: [{ job_id: UPLOAD_JOB, answers: [ending(nullJob)] }] })
    await clean.settle(); clean.chooseFile({ name: 'a.pptx', size: 4096 }); await clean.settle(2); clean.click('Upload template'); await clean.settle(30)
    check(assert.equal, flat(clean.rowNode(TEMPLATE_ID)).some(node => node.props?.['aria-label'] === 'What changed'), false, 'nothing to show: nothing drawn')
    await clean.close()
  }
}

// ---- 5. the template read: Director's real answers, the Studio proxy, the hook, the dialog --------------------------------------------------------
const DET = JSON.parse(read(FIXTURE_DETAIL))
const DETAIL_NAMES = NAMES.filter(name => name !== 'refused') // a file-level refusal saves no template, so there is nothing to read
const DETAIL_FIELDS = ['id', 'user_id', 'name', 'description', 'created_at', 'updated_at', 'usage_count', 'source_session_id', 'source_presentation_id', 'source_fact_manifest',
  'blueprint_enrichment_status', 'blueprint_enrichment_error', 'blueprint_enriched_at', 'template_purity_status', 'template_purity_error', 'template_purified_at', 'presentation_brief',
  'deck_arc', 'slide_style_preset', 'strawman_frozen', 'slots', 'frozen_plan', 'template_blueprint', 'ingest_source', 'stage_template'] // TemplateSnapshot (src/models/template.py:166) as model_dump gives it
const SECRET = /eyJ|sk-[A-Za-z0-9]|Bearer|password|secret|@[a-z0-9-]+\.[a-z]{2,}/i
const detailRow = name => structuredClone(DET.cases[name].detail.json)
/** What the Studio proxy answers for a template read: Director's row trimmed to its id and its report. */
const trim = row => ({ id: row.id, ingest_source: row.ingest_source?.admission_report ? { admission_report: row.ingest_source.admission_report } : {} })
/** The proxy's answer for the template `id` whose report is the one of the fixture case `name` (no report: the case has none). */
const proxied = (id, name) => ({ json: { id, ingest_source: reportOf(name) ? { admission_report: reportOf(name) } : {} } })
const withoutSlides = report => { const { slides, ...rest } = report; return rest }

function detailFixtureChecks() {
  const { director, how } = DET.source
  check(assert.match, director.sha, /^[0-9a-f]{40}$/, 'the Director commit (uat, which holds !502) is named')
  deq([director.mr, director.branch], ['!502', 'seat2/director-admission-report'])
  check(assert.ok, director.code.some(item => item.startsWith('src/services/stage_template_router.py (GET /templates/{template_id}')), 'the route is named')
  check(assert.ok, director.code.some(item => item.startsWith('src/services/composer_library.py (identity')), "the route's auth is named")
  check(assert.match, how, /Director's own offline world \(real router, real worker client, real template store/)
  deq(Object.keys(DET.cases), DETAIL_NAMES, 'every case that saved a template')
  for (const name of DETAIL_NAMES) {
    const { detail } = DET.cases[name], job = jobOf(name)
    check(assert.equal, detail.status_code, 200, name)
    check(assert.equal, detail.template_id, job.template_id, `${name}: the template the job saved`)
    check(assert.equal, detail.json.id, job.template_id)
    check(assert.equal, JSON.stringify(DET.cases[name]).match(SECRET), null, `${name}: nothing secret and no address in it`)
    deq(Object.keys(detail.json), DETAIL_FIELDS, `${name}: the whole row, field for field`)
    check(assert.ok, detail.json.stage_template && typeof detail.json.stage_template === 'object', `${name}: the stored template is in the row (what the proxy trims)`)
    const stored = detail.json.ingest_source
    if (WITH_REPORT.includes(name)) {
      deq(stored.admission_report, reportOf(name), `${name}: the report stored with the template is the job read's, slides and all`)
      deq(withoutSlides(stored.admission_report), rowOf(name).admission_report, `${name}: the list row is that report without its slides`)
      check(assert.ok, stored.admission_report.slides.length > 0)
    } else {
      check(assert.equal, 'admission_report' in stored, false, `${name}: no report stored, no key`)
    }
  }
  deq(DET.cases['progress-flow-mid-run'].detail.json.ingest_source, DET.cases['progress-flow-done'].detail.json.ingest_source, 'the as-is template already holds the report the finished one holds')
  check(assert.ok, JSON.stringify(detailRow('big-deck')).length > 60000, 'a long deck: the row is large')
  check(assert.ok, DETAIL_NAMES.every(name => JSON.stringify(trim(detailRow(name))).length < JSON.stringify(detailRow(name)).length), 'the trim is smaller than the row, every case')
}

function detailPureChecks(sources) {
  const lib = createLoader({ sources, env: {}, stubs: {}, globals: {} }).load(LIB)
  const { templateDetailReport, admissionReportFor, admissionReportView } = lib
  for (const name of DETAIL_NAMES) {
    const row = detailRow(name), id = row.id
    const report = templateDetailReport(row, id)
    if (WITH_REPORT.includes(name)) {
      deq(report, reportOf(name), `${name}: the report of Director's row`)
      check(assert.ok, Array.isArray(admissionReportView(report).strip), `${name}: it has the slides, so the strip`)
    } else check(assert.equal, report, null, `${name}: no report in the row`)
    deq(templateDetailReport(trim(row), id), report, `${name}: the proxy's trim reads the same`)
    check(assert.equal, templateDetailReport(row, `${id}x`), null, `${name}: the row of another template is not this one's`)
    check(assert.equal, templateDetailReport({ ...row, id: undefined }, id), null)
  }
  for (const bad of [undefined, null, 0, 'x', true, [], [1], {}, { id: 't' }, { id: 't', ingest_source: null }, { id: 't', ingest_source: 'x' }, { id: 't', ingest_source: [] }, { id: 't', ingest_source: {} },
    { id: 't', ingest_source: { admission_report: null } }, { id: 't', ingest_source: { admission_report: 'x' } }, { id: 't', ingest_source: { admission_report: [] } },
    { id: 't', ingest_source: { admission_report: 7 } }, { id: 7, ingest_source: { admission_report: {} } }]) check(assert.equal, templateDetailReport(bad, 't'), null, `garbage ${ser(bad)}`)
  check(assert.equal, templateDetailReport({ id: 't', ingest_source: { admission_report: { a: 1 } } }, 't').a, 1, 'the report is handed on whole (admissionReportView checks it)')
  // which report a row draws: the tracked job's, else the template read's, else the list's
  const clean = reportOf('admitted-clean'), partial = reportOf('partially-admitted'), floor = reportOf('floor-slide'), listed = withoutSlides(partial)
  const headline = (job, row, read) => admissionReportFor(job, row, read)?.headline ?? null
  check(assert.equal, headline(clean, listed, floor), clean.headline, 'the tracked job wins')
  check(assert.equal, headline(null, listed, floor), floor.headline, 'then the template read')
  check(assert.equal, headline(null, listed, null), partial.headline, 'then the list')
  check(assert.equal, headline(null, listed, undefined), partial.headline, 'no template read yet')
  check(assert.equal, headline({ version: 'x' }, listed, floor), floor.headline, 'an unreadable job report gives way to the template read')
  check(assert.equal, headline(null, listed, { version: 'x' }), partial.headline, 'an unreadable template read gives way to the list')
  check(assert.equal, headline(null, null, floor), floor.headline, 'the template read alone')
  check(assert.equal, headline(null, null, null), null)
  check(assert.equal, admissionReportFor(clean, listed).headline, clean.headline, 'two arguments, as before')
  check(assert.equal, admissionReportFor(null, listed).strip, null, 'the list has no slides')
  check(assert.ok, Array.isArray(admissionReportFor(null, listed, partial).strip), 'the template read has them')
  deq(admissionReportFor(null, listed, partial).strip, admissionReportView(partial).strip)
}

// ---- the Studio proxy (app/api/composer-library/[...path]/route.ts) on the real route ----------------------------------------------------------------
const FRONTDOOR_HOST = 'directorv40-uat.up.railway.app'
const FRONTDOOR_TOKEN = 'unit-test-placeholder'
/** One route module on a fake session, database and Director: `request` runs one request and records what left (the Director calls, the database queries). */
function routeWorld(routeSource, envExtra = {}) {
  const world = { calls: [], queries: [], identity: { user: { id: 'untrusted-stale-id', email: 'owner@example.test' } }, dbUser: { id: 'trusted-user' }, dbFails: false,
    upstream: () => Response.json({ templates: [] }) }
  const env = { NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: 'true', COMPOSER_DIRECTOR_URL: `https://${FRONTDOOR_HOST}`, COMPOSER_FRONTDOOR_TOKEN: FRONTDOOR_TOKEN, ...envExtra }
  const stubs = {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => world.identity },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma: {
      user: { findUnique: async query => { world.queries.push(['user', query.where.email]); if (world.dbFails) throw new Error('database down'); return world.dbUser } },
      chatSession: { findFirst: async query => { world.queries.push(['session', query.where.id, query.where.userId]); return { id: query.where.id } } },
    } },
  }
  const globals = { fetch: async (url, init) => { world.calls.push({ url, init }); const answer = await world.upstream(url, init); if (answer instanceof Error) throw answer; return answer }, URL, Buffer, AbortSignal, DOMException }
  const route = createLoader({ sources: { [ROUTE]: routeSource }, env, stubs, globals }).load(ROUTE)
  Object.assign(world, { env, route })
  world.request = async (method, path, { body, headers = {} } = {}) => {
    world.calls = []; world.queries = []
    const handler = method === 'HEAD' ? route.GET : route[method]
    if (!handler) return { handler: false, calls: [], queries: [] }
    const req = new Request('http://localhost/api/composer-library/x', { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const res = await handler(req, { params: Promise.resolve({ path }) })
    const text = await res.text()
    return { handler: true, status: res.status, cache: res.headers.get('cache-control'), text, body: text ? JSON.parse(text) : null,
      calls: world.calls.map(call => ({ url: call.url, method: call.init.method, headers: { ...call.init.headers }, body: call.init.body ?? null, redirect: call.init.redirect, cache: call.init.cache })),
      queries: world.queries }
  }
  return world
}
const GOOD_ID = '00000000-0000-0000-0000-000000000002'
const NOT_FOUND = { error: 'Not found' }

async function routeChecks(sources) {
  const source = sources[ROUTE]
  const on = (extra = {}) => routeWorld(source, { [FLAG]: 'true', ...extra })
  // 1. the allowed GET, on every real answer of Director's: the trim, the request that leaves
  for (const name of DETAIL_NAMES) {
    const world = on(), row = detailRow(name)
    world.upstream = () => Response.json(structuredClone(row))
    const out = await world.request('GET', ['templates', row.id])
    check(assert.equal, out.status, 200, name)
    deq(out.body, trim(row), `${name}: the answer is the report of the row and nothing else`)
    deq(Object.keys(out.body), ['id', 'ingest_source'], `${name}: the keys`)
    check(assert.equal, out.cache, 'no-store')
    check(assert.equal, /stage_template|user_id|storage_path|frozen_plan|source_fact_manifest|presentation_brief/.test(out.text), false, `${name}: no part of the stored template goes on`)
    deq(out.calls, [{ url: `https://${FRONTDOOR_HOST}/api/template-ingest/stage/templates/${row.id}`, method: 'GET', body: null, redirect: 'error', cache: 'no-store',
      headers: { Authorization: `Bearer ${FRONTDOOR_TOKEN}`, 'X-Composer-User-Id': 'trusted-user' } }], `${name}: one GET to Director's route with the front door's token and the signed-in user`)
    deq(out.queries, [['user', 'owner@example.test']], `${name}: the signed-in user is looked up; nothing else is read or written`)
  }
  { // what the browser sends never decides who is asking
    const world = on(); world.upstream = () => Response.json(detailRow('admitted-clean'))
    const out = await world.request('GET', ['templates', GOOD_ID], { headers: { Authorization: 'Bearer attacker', 'X-Composer-User-Id': 'attacker', Cookie: 'a=b', 'X-Forwarded-For': '1.2.3.4' } })
    check(assert.equal, out.status, 200)
    deq(out.calls[0].headers, { Authorization: `Bearer ${FRONTDOOR_TOKEN}`, 'X-Composer-User-Id': 'trusted-user' }, 'the token and the user id are the server\'s own; nothing of the browser\'s goes on')
    check(assert.equal, JSON.stringify(out.calls[0]).includes('attacker'), false)
    check(assert.equal, out.calls[0].body, null, 'a read has no body')
  }
  // 2. sign-in, account and configuration: the same refusals as for the list, and nothing leaves
  const refused = async (label, mutate, status) => {
    const world = on(); mutate(world); world.upstream = () => Response.json(detailRow('admitted-clean'))
    const out = await world.request('GET', ['templates', GOOD_ID])
    check(assert.equal, out.status, status, label); check(assert.equal, out.calls.length, 0, `${label}: nothing left for Director`)
    return out
  }
  await refused('no session', world => { world.identity = null }, 401)
  await refused('a session with no email', world => { world.identity = { user: { id: 'x' } } }, 401)
  await refused('an account the database does not know', world => { world.dbUser = null }, 401)
  await refused('the database is down', world => { world.dbFails = true }, 503)
  await refused('no front-door token', world => { delete world.env.COMPOSER_FRONTDOOR_TOKEN }, 503)
  await refused('no Director address', world => { delete world.env.COMPOSER_DIRECTOR_URL }, 503)
  await refused('an address that is not approved', world => { world.env.COMPOSER_DIRECTOR_URL = 'https://unapproved.example' }, 503)
  { const out = await refused('the library is off', world => { world.env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED = 'false' }, 404); deq(out.queries, [], 'the library off: not even a lookup') }
  // 3. the id: only [A-Za-z0-9_-], 1 to 200 characters (the allow-list the job and use routes already apply)
  for (const id of ['..', '.', '', ' ', '%2e%2e', '%2E%2E', 'a/b', '../x', 'a\\b', 'a b', 'a.b', 'a?x=1', 'a#b', 'a%2Fb', 'a;b', 'a\nb', 'a\u0000b', 'é', 'a'.repeat(201), '😀', 'id/', '/id', 'a:b', 'a@b', 'a%00']) {
    const world = on(), out = await world.request('GET', ['templates', id])
    check(assert.equal, out.status, 404, `id ${JSON.stringify(id)}`); deq(out.body, NOT_FOUND); check(assert.equal, out.calls.length, 0, `id ${JSON.stringify(id)}: nothing left for Director`)
  }
  for (const id of [GOOD_ID, 'a', 'Template_1-b', 'x'.repeat(200), '0'.repeat(200)]) {
    const world = on(); world.upstream = () => Response.json({ id, ingest_source: {} })
    const out = await world.request('GET', ['templates', id])
    check(assert.equal, out.status, 200, `id ${id.slice(0, 20)}`); check(assert.equal, out.calls[0].url, `https://${FRONTDOOR_HOST}/api/template-ingest/stage/templates/${id}`)
  }
  // 4. only this one shape: no sub-path (the template's uses, infographics, use), no neighbour, no other segment count or name
  for (const path of [['templates', GOOD_ID, 'uses'], ['templates', GOOD_ID, 'infographics'], ['templates', GOOD_ID, 'use'], ['templates', GOOD_ID, 'fill-infographic'], ['templates', GOOD_ID, 'x'],
    ['templates', GOOD_ID, ''], ['template', GOOD_ID], ['Templates', GOOD_ID], ['TEMPLATES', GOOD_ID], ['jobs', 'x', GOOD_ID], ['upload-reference', GOOD_ID], ['x', GOOD_ID], [GOOD_ID], ['templates', '', GOOD_ID], [], ['']]) {
    const world = on(), out = await world.request('GET', path)
    check(assert.equal, out.status, 404, `GET ${path.join('/')}`); deq(out.body, NOT_FOUND); check(assert.equal, out.calls.length, 0, `GET ${path.join('/')}: nothing left for Director`)
  }
  // 5. the other answers of the proxy are what they were: the list is not trimmed, the job read is not trimmed
  { const world = on(), listBody = { templates: [{ id: GOOD_ID, name: 'n', stage_template_summary: { slide_count: 1 }, ingest_source: { more: true } }] }
    world.upstream = () => Response.json(structuredClone(listBody))
    const out = await world.request('GET', ['templates']); deq(out.body, listBody, 'the list passes through whole'); check(assert.equal, out.calls[0].url, `https://${FRONTDOOR_HOST}/api/template-ingest/stage/templates`)
    const job = { job_id: 'j1', status: 'complete', admission_report: reportOf('admitted-clean'), checkpoint: { a: 1 } }
    world.upstream = () => Response.json(structuredClone(job))
    deq((await world.request('GET', ['jobs', 'j1'])).body, job, 'the job read passes through whole') }
  // 6. every method but GET: Next answers 405 for the verbs the route does not export; the ones it exports (POST) and HEAD (served by GET) never read a template
  deq(Object.keys(on().route).sort(), ['GET', 'POST', 'dynamic'], 'the route exports GET and POST only (PUT, PATCH, DELETE and OPTIONS get no handler)')
  for (const [method, body, headers] of [['POST', { session_id: 's' }], ['POST', undefined], ['POST', 'x'], ['HEAD'], ['PUT', undefined], ['PATCH', undefined], ['DELETE', undefined], ['OPTIONS', undefined]]) {
    const world = on(), out = await world.request(method, ['templates', GOOD_ID], { body, headers })
    if (!out.handler) { check(assert.ok, ['PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method), `${method} has no handler`); continue }
    check(assert.equal, out.status, 404, `${method} templates/{id}`); deq(out.body, NOT_FOUND); check(assert.equal, out.calls.length, 0, `${method}: nothing left for Director`)
  }
  // 7. every way Director's answer can go wrong: its error is the browser's error (untrimmed); a 200 that is not a row trims to nothing; never a crash
  for (const [status, json] of [[404, { detail: 'Stage template not found' }], [401, { detail: 'Authenticated Composer proxy is required' }], [403, { detail: 'no' }], [422, { detail: [{ loc: ['x'] }] }], [500, { detail: 'boom' }], [503, { detail: 'down' }]]) {
    const world = on(); world.upstream = () => Response.json(structuredClone(json), { status })
    const out = await world.request('GET', ['templates', GOOD_ID])
    check(assert.equal, out.status, status, `Director ${status}`); deq(out.body, json, `Director ${status}: its answer, not trimmed`)
  }
  for (const json of [null, 7, 'x', true, [], [detailRow('admitted-clean')], {}, { id: 7 }, { ingest_source: 'x' }, { ingest_source: null }, { ingest_source: [] }, { ingest_source: {} }, { ingest_source: { admission_report: null } },
    { ingest_source: { admission_report: 'x' } }, { ingest_source: { admission_report: [1] } }, { ingest_source: { admission_report: 7 } }]) {
    const world = on(); world.upstream = () => Response.json(json)
    const out = await world.request('GET', ['templates', GOOD_ID])
    check(assert.equal, out.status, 200, `a 200 of ${ser(json)}`)
    deq(out.body, { ...(json && typeof json === 'object' && !Array.isArray(json) && typeof json.id === 'string' ? { id: json.id } : {}), ingest_source: {} }, `a 200 of ${ser(json)} trims to nothing`)
  }
  for (const [label, upstream] of [['the network fails', () => new TypeError('fetch failed')], ['the answer is not JSON', () => new Response('<html>', { status: 200 })], ['an empty answer', () => new Response('', { status: 200 })]]) {
    const world = on(); world.upstream = upstream
    const out = await world.request('GET', ['templates', GOOD_ID])
    check(assert.equal, out.status, 502, label); deq(out.body, { error: 'Template library is temporarily unavailable.' })
  }
  // 8. flag off: the request is the base route's 404 (and every other request is exactly the base's): measured on a matrix against the base route itself
  const upload = { session_id: 's1', researcher_session_id: 's1', storage_path: 's1/deck.pptx', file_name: 'deck.pptx', kind: 'pptx' }
  const MATRIX = [['GET', ['templates']], ['GET', ['templates', GOOD_ID]], ['GET', ['templates', '..']], ['GET', ['templates', GOOD_ID, 'uses']],
    ['GET', ['templates', GOOD_ID, 'infographics']], ['GET', ['jobs', 'j1']], ['GET', ['jobs']], ['GET', []], ['GET', ['nope']], ['HEAD', ['templates', GOOD_ID]], ['HEAD', ['templates']],
    ['POST', ['templates', GOOD_ID], { session_id: 's1' }], ['POST', ['templates', GOOD_ID, 'use'], { session_id: 's1' }], ['POST', ['upload-reference'], upload], ['POST', ['upload']],
    ['PUT', ['templates', GOOD_ID]], ['DELETE', ['templates', GOOD_ID]]]
  const run = async (world, upstream) => { world.upstream = upstream; const out = []; for (const [method, path, body] of MATRIX) out.push(await world.request(method, path, { body })); return out }
  const upstream = (url, init) => Response.json(url.endsWith(`/templates/${GOOD_ID}`) ? detailRow('partially-admitted') : { ok: true, url: url.slice(-30), method: init.method }, { status: 200 })
  const baseOut = await run(routeWorld(baseRoute), upstream)
  for (const spelling of [undefined, 'false', '1', 'TRUE', ' true', 'yes', '']) {
    const out = await run(routeWorld(source, spelling === undefined ? {} : { [FLAG]: spelling }), upstream)
    deq(out, baseOut, `flag ${JSON.stringify(spelling)}: every request answers, queries and sends exactly what the base route does`)
  }
  { // flag on: the same, but for the one request that is now allowed
    const out = await run(routeWorld(source, { [FLAG]: 'true' }), upstream)
    const index = MATRIX.findIndex(([method, path]) => method === 'GET' && path.join('/') === `templates/${GOOD_ID}`)
    out.forEach((item, at) => { if (at !== index) deq(item, baseOut[at], `flag on: ${MATRIX[at][0]} ${MATRIX[at][1].join('/')} is the base's`) })
    check(assert.equal, baseOut[index].status, 404); check(assert.equal, out[index].status, 200)
    deq(out[index].body, trim(detailRow('partially-admitted')))
  }
}

// ---- the hook on its own (components/builder/composer-admission-detail.ts) -----------------------------------------------------------------------------
async function hookChecks(sources) {
  const make = (enabled = true, { ignoreAbort = false } = {}) => {
    const runtime = createRuntime(), asks = []
    const composerRequest = (path, body, signal) => new Promise((resolve, reject) => {
      asks.push({ path, body, signal, resolve, reject })
      if (!ignoreAbort) signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
    const mod = createLoader({ sources, env: {}, stubs: { react: runtime.react, '@/lib/composer-library': { composerRequest } }, globals: { DOMException, AbortController } }).load(DETAIL)
    const world = { runtime, asks, enabled, render: () => runtime.render(() => mod.useAdmissionDetails(world.enabled)) }
    return world
  }
  const R = reportOf('partially-admitted'), answer = (id, report = R) => ({ id, ingest_source: { admission_report: report } })
  { // flag off: nothing is asked, kept or returned, however it is called
    const w = make(false), details = w.render()
    details.open('a'); details.want('a'); details.want('b'); w.render(); await tick(); w.render(); await tick()
    check(assert.equal, w.asks.length, 0, 'flag off: no read')
    check(assert.equal, w.render().report('a'), null)
    check(assert.equal, w.runtime.pending(), false, 'flag off: no state is ever changed')
  }
  { // a read: GET, the template's own path, once; kept; shown on the next render
    const w = make(), details = w.render()
    check(assert.equal, details.report('a'), null, 'nothing before it is asked')
    details.open('a'); await tick()
    deq(w.asks.map(item => [item.path, item.body]), [['templates/a', undefined]], 'a GET of the template, with no body')
    check(assert.ok, w.asks[0].signal && !w.asks[0].signal.aborted)
    details.open('a'); details.open('a'); w.render(); await tick()
    check(assert.equal, w.asks.length, 1, 'asked once, however often it is opened')
    w.asks[0].resolve(answer('a')); await tick()
    check(assert.equal, w.runtime.pending(), true, 'the answer changes state')
    deq(w.render().report('a'), R, 'kept')
    check(assert.equal, w.render().report('b'), null, 'for that template only')
    w.render().open('a'); await tick()
    check(assert.equal, w.asks.length, 1, 'answered once, never asked again')
    deq(w.render().report('a'), R)
  }
  { // one read at a time, in the order asked
    const w = make(), details = w.render()
    for (const id of ['a', 'b', 'c']) details.open(id)
    await tick()
    deq(w.asks.map(item => item.path), ['templates/a'], 'the first is on its way, the others wait')
    w.asks[0].resolve(answer('a')); await tick()
    deq(w.asks.map(item => item.path), ['templates/a', 'templates/b'])
    w.asks[1].reject(new Error('down')); await tick()
    deq(w.asks.map(item => item.path), ['templates/a', 'templates/b', 'templates/c'], 'a read that fails does not hold the next')
    w.asks[2].resolve(answer('c')); await tick()
    deq([w.render().report('a'), w.render().report('b'), w.render().report('c')], [R, null, R])
  }
  { // quietly: a failure, an answer with no report, an answer for another template: nothing shown, nothing raised, never asked again
    const w = make(), details = w.render()
    const results = ['fail', 'no-report', 'other-template', 'garbage', 'wrong-report']
    results.forEach(id => details.open(id)); await tick()
    for (let i = 0; i < results.length; i++) {
      await tick(); check(assert.equal, w.asks.length, i + 1, `read ${i + 1} starts after the one before it ended`)
      const ask = w.asks[i]
      if (results[i] === 'fail') ask.reject(new TypeError('network'))
      else if (results[i] === 'no-report') ask.resolve({ id: results[i], ingest_source: {} })
      else if (results[i] === 'other-template') ask.resolve(answer('someone-else'))
      else if (results[i] === 'garbage') ask.resolve('<html>')
      else ask.resolve({ id: results[i], ingest_source: { admission_report: 'x' } })
      await tick()
    }
    for (const id of results) check(assert.equal, w.render().report(id), null, `${id}: nothing to show`)
    await tick(); await tick()
    check(assert.equal, unhandled.length, 0, 'a failed read raises nothing')
    results.forEach(id => details.open(id)); w.render(); await tick(); await tick()
    check(assert.equal, w.asks.length, results.length, 'a failed read is not asked again')
    check(assert.equal, w.runtime.pending(), false, 'and changed nothing')
  }
  { // an id is encoded into the path
    const w = make(), details = w.render()
    details.open('a b/c?d'); await tick()
    check(assert.equal, w.asks[0].path, 'templates/a%20b%2Fc%3Fd')
  }
  { // a report that opens by itself is asked after the render that drew it, once
    const w = make(), details = w.render()
    details.want('w'); check(assert.equal, w.asks.length, 0, 'registering asks nothing yet')
    w.render(); await tick()
    deq(w.asks.map(item => item.path), ['templates/w'], 'asked once the render is on screen')
    for (let i = 0; i < 4; i++) { w.render().want('w'); w.render(); await tick() }
    check(assert.equal, w.asks.length, 1, 'registered on every render, asked once')
  }
  { // the dialog going away: what is on its way is stopped, nothing more is asked, a late answer changes nothing
    const w = make(true, { ignoreAbort: true }), details = w.render()
    details.open('u1'); details.open('u2'); await tick()
    check(assert.equal, w.asks.length, 1)
    w.runtime.unmount(); await tick()
    check(assert.equal, w.asks[0].signal.aborted, true, 'the read on its way is aborted')
    w.asks[0].resolve(answer('u1')); await tick(); await tick()
    check(assert.equal, w.asks.length, 1, 'the one waiting is never asked')
    check(assert.equal, w.runtime.pending(), false, 'a late answer changes no state')
    // React\'s development double-mount runs the cleanup and then the effects again: the next render asks again, with a signal that is not aborted
    const again = w.render(); again.want('u1'); w.render(); await tick()
    check(assert.equal, w.asks.length, 2, 'after the cleanup a render asks again')
    check(assert.equal, w.asks[1].signal.aborted, false, 'with a fresh signal')
  }
}

// ---- the real dialog: when a report asks for its slides, what it draws ------------------------------------------------------------------------------
const traceOf = ui => ui.log.map(entry => entry[0] === 'fetch' ? `${entry[1]} ${entry[2].replace('/api/composer-library/', '')}` : entry[0])
const reads = ui => traceOf(ui).filter(line => /^GET templates\/[^/]+$/.test(line))
/** The block of a row's report, in either shell, and the person opening or closing its list of changes. */
const blockIn = (ui, id, shell = true) => shell ? blockOf(ui, id) : readBlockById(ui, id)
const toggle = (ui, id, open = true, shell = true) => readBlock(blockIn(ui, id, shell)).details.props.onToggle({ currentTarget: { open } })

async function dialogDetailChecks(sources) {
  const answers = () => ({ [ID.partial]: proxied(ID.partial, 'partially-admitted'), [ID.floor]: proxied(ID.floor, 'floor-slide'), [ID.clean]: proxied(ID.clean, 'admitted-clean'), [ID.many]: proxied(ID.many, 'many-changes') })
  for (const shell of [true, false]) {
    const ui = mount({ sources, flag: 'true', shell, templates: LIST(), details: answers() })
    await ui.settle(20)
    const find = id => blockIn(ui, id, shell)
    const chipsOf = id => readBlock(find(id)).chips
    // the reports that open by themselves are asked, one at a time, in list order; the others, and the rows with nothing to open, are not
    deq(reads(ui), [`GET templates/${ID.partial}`, `GET templates/${ID.floor}`], `shell ${shell}: only the reports that open by themselves are asked`)
    check(assert.equal, ui.mostReading, 1, `shell ${shell}: one read at a time`)
    const shown = chips => chips.map(chip => [chip.slide, shell ? chip.kind : null, chip.label]) // the plain shell carries no markers, so no kind
    const wanted = name => expectedView(reportOf(name)).strip.map(chip => [String(chip.slide), shell ? chip.kind : null, chip.label])
    deq(shown(chipsOf(ID.partial)), wanted('partially-admitted'), `shell ${shell}: the strip of the partly admitted deck`)
    deq(shown(chipsOf(ID.floor)), wanted('floor-slide'), `shell ${shell}: the floor slide's strip`)
    for (const id of [ID.clean, ID.many, ID.quiet]) check(assert.equal, chipsOf(id).length, 0, `shell ${shell}: ${id}: closed, or nothing to open: no strip`)
    for (const id of [ID.none, ID.garbage, ID.off]) check(assert.equal, find(id), null, `shell ${shell}: ${id}: no report, nothing drawn`)
    const partial = readBlock(find(ID.partial))
    deq(partial.lines.map(line => line.text), expectedView(reportOf('partially-admitted')).rows.map(item => item.text), 'the changes are as before')
    check(assert.equal, partial.headline, reportOf('partially-admitted').headline)
    check(assert.equal, partial.details.props.open, true, 'still open')
    check(assert.ok, partial.paragraphs.includes('Slide by slide'))
    // display only: no chip does anything, and nothing in the strip can be pressed or focused
    const strip = flat(find(ID.partial)).find(node => node.type === 'ul' && node.props['aria-label'] === 'Slide by slide')
    const parts = flat(strip)
    check(assert.equal, parts.some(node => ['Button', 'button', 'a', 'input', 'select'].includes(node.type)), false, 'no control in the strip')
    check(assert.equal, parts.some(node => Object.keys(node.props ?? {}).some(name => /^on[A-Z]|tabIndex|role|href/.test(name))), false, 'no handler, focus stop, role or link on a chip')
    // a closed report asks when the person opens it, once
    const before = reads(ui).length
    toggle(ui, ID.clean, false, shell); await ui.settle(20)
    check(assert.equal, reads(ui).length, before, `shell ${shell}: closing a list asks nothing`)
    for (const open of [true, true, false, true]) toggle(ui, ID.clean, open, shell) // opened, opened again, closed, opened: before the answer is back
    await ui.settle(20)
    deq(reads(ui).slice(before), [`GET templates/${ID.clean}`], `shell ${shell}: opening it asks for its template, once`)
    deq(shown(chipsOf(ID.clean)), wanted('admitted-clean'), 'and the strip appears')
    check(assert.equal, readBlock(find(ID.clean)).details.props.onToggle, undefined, 'a list with its strip has nothing left to ask')
    check(assert.equal, readBlock(find(ID.partial)).details.props.onToggle, undefined)
    check(assert.equal, ui.mostReading, 1)
    // the answers are kept while the dialog lives: closed and opened again, the list is read again and the templates are not
    const logBefore = ui.log.length
    await ui.close(); ui.render({ open: true }); await ui.settle(20)
    deq(traceOf(ui).slice(logBefore).filter(line => line !== 'getItem'), ['GET templates'], `shell ${shell}: closed and opened again: the list is read, no template is`)
    check(assert.equal, chipsOf(ID.partial).length, expectedView(reportOf('partially-admitted')).strip.length, 'the strips are still there')
    check(assert.equal, chipsOf(ID.clean).length, 6)
    // the person opens the rest
    toggle(ui, ID.many, true, shell); await ui.settle(20)
    check(assert.equal, chipsOf(ID.many).length, expectedView(reportOf('many-changes')).strip.length)
    deq(reads(ui).map(line => line.slice(14)), [ID.partial, ID.floor, ID.clean, ID.many])
    // nothing but reads: no session, no storage write, no upload, no other request
    check(assert.equal, ui.log.every(entry => entry[0] === 'fetch' ? entry[1] === 'GET' : entry[0] === 'getItem'), true, 'only GETs and the dialog\'s own read of its stored job')
    await ui.close()
  }
  { // quietly: whatever goes wrong with the read, the list's report stays as it was, no message, no second try
    const bad = {
      [ID.partial]: 'throw', [ID.floor]: { status: 502, json: { error: 'Template library is temporarily unavailable.' } },
      [ID.clean]: { json: { id: ID.clean, ingest_source: {} } }, [ID.many]: { json: { id: 'a-different-template', ingest_source: { admission_report: reportOf('many-changes') } } },
    }
    const ui = mount({ sources, flag: 'true', templates: LIST(), details: bad })
    await ui.settle(20); toggle(ui, ID.clean); toggle(ui, ID.many); await ui.settle(20)
    deq(reads(ui).map(line => line.slice(14)), [ID.partial, ID.floor, ID.clean, ID.many], 'each is asked, once')
    for (const id of [ID.partial, ID.floor, ID.clean, ID.many]) check(assert.equal, readBlock(blockOf(ui, id)).chips.length, 0, `${id}: no strip`)
    deq(readBlock(blockOf(ui, ID.partial)).lines.map(line => line.text), expectedView(reportOf('partially-admitted')).rows.map(item => item.text), 'the list\'s report is as it was')
    check(assert.equal, ui.all().some(node => node.props?.['data-studio-composer-error'] !== undefined || node.props?.role === 'alert'), false, 'no message')
    for (let i = 0; i < 4; i++) { await ui.settle(10); toggle(ui, ID.partial); toggle(ui, ID.clean) }
    check(assert.equal, reads(ui).length, 4, 'no second try')
    await ui.close()
  }
  { // an answer that does not read as a report draws nothing new
    const odd = { [ID.partial]: { json: { id: ID.partial, ingest_source: { admission_report: { ...reportOf('partially-admitted'), version: 'composer-admission-report-v9' } } } } }
    const ui = mount({ sources, flag: 'true', templates: LIST(), details: odd })
    await ui.settle(20)
    check(assert.equal, readBlock(blockOf(ui, ID.partial)).chips.length, 0)
    check(assert.equal, readBlock(blockOf(ui, ID.partial)).headline, reportOf('partially-admitted').headline, 'the list\'s headline stays')
    await ui.close()
  }
  { // a slow read holds the ones behind it
    let release
    const gate = new Promise(resolve => { release = resolve })
    const ui = mount({ sources, flag: 'true', templates: LIST(), details: { ...answers(), [ID.partial]: async () => { await gate; return proxied(ID.partial, 'partially-admitted') } } })
    await ui.settle(20)
    deq(reads(ui), [`GET templates/${ID.partial}`], 'the second report waits for the first read')
    release(); await ui.settle(20)
    deq(reads(ui), [`GET templates/${ID.partial}`, `GET templates/${ID.floor}`])
    check(assert.equal, ui.mostReading, 1)
    await ui.close()
  }
  { // the tracked upload's job read has the slides: the job wins and nothing is asked for its template; the other row is asked. A library opened afresh (card gone) asks.
    const mid = framesJob('progress-flow-mid-run'), done = framesJob('progress-flow-done')
    const ui = mount({ sources, flag: 'true', progress: true, templates: [row('partially-admitted', ID.partial)], saved: SAVED(), queue: [{ job_id: UPLOAD_JOB, answers: [mid, done] }],
      details: { [ID.partial]: proxied(ID.partial, 'partially-admitted'), [TEMPLATE_ID]: proxied(TEMPLATE_ID, 'progress-flow-mid-run') } })
    await ui.settle(20)
    deq(reads(ui), [`GET templates/${ID.partial}`], 'before the upload: the one row with a report asks')
    ui.chooseFile({ name: 'Deck04_Fabrikam_Review.pptx', size: 4096 }); await ui.settle(2); ui.click('Upload template'); await ui.settle(40)
    check(assert.equal, readBlock(blockOf(ui, TEMPLATE_ID)).chips.length, expectedView(reportOf('progress-flow-mid-run')).strip.length, 'the saved template has its strip from the job read')
    deq(reads(ui), [`GET templates/${ID.partial}`], 'the tracked job has the slides: its template is not asked for')
    await ui.close()
    const fresh = mount({ sources, flag: 'true', progress: true, templates: [SAVED()], details: { [TEMPLATE_ID]: proxied(TEMPLATE_ID, 'progress-flow-mid-run') } })
    await fresh.settle(20)
    deq(reads(fresh), [`GET templates/${TEMPLATE_ID}`], 'a library opened afresh has no card: the template is asked for')
    deq(readBlock(blockOf(fresh, TEMPLATE_ID)).chips.map(chip => [chip.slide, chip.kind]), expectedView(reportOf('progress-flow-mid-run')).strip.map(chip => [String(chip.slide), chip.kind]), 'and the strip is drawn')
    await fresh.close()
  }
  { // a report with nothing to open (no changes listed) has no list and so asks nothing; rows with no report, or one that does not read, ask nothing
    const ui = mount({ sources, flag: 'true', templates: [row('admitted-no-changes', ID.quiet), noKey(ID.none, 'composer-flag-off'), { ...noKey(ID.garbage, 'composer-flag-off'), admission_report: { version: 'x' } }],
      details: { [ID.quiet]: proxied(ID.quiet, 'admitted-no-changes') } })
    await ui.settle(20)
    check(assert.equal, reads(ui).length, 0)
    check(assert.equal, readBlock(blockOf(ui, ID.quiet)).details, null)
    await ui.close()
  }
  { // flag off: the same library, the same answers on offer: nothing is asked, whatever is opened (the rest of flag off is in section 2)
    for (const flag of [undefined, 'false', '1', 'TRUE']) {
      const ui = mount({ sources, flag, templates: LIST(), details: answers() })
      await ui.settle(20)
      check(assert.equal, reads(ui).length, 0, `flag ${JSON.stringify(flag)}: no template read`)
      check(assert.equal, ui.all().some(node => node.props?.['aria-label'] === 'What changed'), false)
      await ui.close()
    }
  }
}
/** The plain shell has no markers: a row's report is found by position. */
function readBlockById(ui, id) {
  const rows = flat(expand(ui.tree)).filter(node => node.type === 'div' && node.props?.className === 'space-y-3 rounded-md border p-3')
  return flat(rows[ids().indexOf(id)]).find(node => node.type === 'div' && node.props?.['aria-label'] === 'What changed') ?? null
}

// the lines the route, the hook and the dialog gain, as source pins
const ROUTE_ADDITIONS = [
  [/\/\/ Director's GET templates\/\{id\} is the whole stored template[^\n]*\n\/\/ [^\n]*Template library wants only[^\n]*\nfunction admissionTemplate\(row: unknown\) \{\n(?: {2}[^\n]*\n)+\}\n\n/, ''],
  [/ {2}\/\/ NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT \(exact "true", default off\): one read-only GET[^\n]*\n {2}\/\/ not a route at all[^\n]*\n {2}const detail = [^\n]*\n/, ''],
  [/ && !detail/, ''],
  [/ {4}const answer = await response\.json\(\)\n {4}return NextResponse\.json\(detail && response\.ok \? admissionTemplate\(answer\) : answer, /, '    return NextResponse.json(await response.json(), '],
]
function detailSourceChecks(sources) {
  const route = sources[ROUTE], detail = sources[DETAIL], view = sources[VIEW]
  const code = value => value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const stripped = ROUTE_ADDITIONS.reduce((out, [from, to]) => out.replace(from, to), route)
  check(assert.equal, stripped, baseRoute, `the route without the added lines is ${BASE}'s`)
  for (const [from] of ROUTE_ADDITIONS) check(assert.equal, (route.match(new RegExp(from.source, 'g')) ?? []).length, 1, `one: ${from.source.slice(0, 70)}`)
  check(assert.equal, /dmission/.test(stripped), false, 'nothing of this change is left after the strip')
  check(assert.equal, (code(route).match(/NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT/g) ?? []).length, 1, 'the route reads the flag once')
  check(assert.equal, code(route).includes("process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT === 'true' && req.method === 'GET'"), true, 'as the exact string "true", and only for GET')
  check(assert.equal, /process\.env|NEXT_PUBLIC/.test(code(detail)), false, 'the hook reads no environment')
  check(assert.equal, /sessionStorage|localStorage|document\.|window\.|\bfetch\b|XMLHttpRequest|WebSocket/.test(code(detail)), false, 'the hook uses no storage and no request of its own')
  check(assert.equal, code(detail).includes("composerRequest<unknown>(`templates/${encodeURIComponent(templateId)}`, undefined, signal)"), true, 'its one request is a GET of the template, by the library proxy')
  check(assert.equal, (code(detail).match(/composerRequest\(|composerRequest</g) ?? []).length, 1)
  check(assert.equal, (code(view).match(/onToggle/g) ?? []).length, 1, 'the block listens to the list being opened, nowhere else')
  check(assert.equal, /onClick|onKeyDown|onPointer|onMouse|tabIndex|role=/.test(code(view).split('<ul aria-label="Slide by slide"')[1] ?? 'x'), false, 'the strip is display only')
}

// ---- 4. mutations ---------------------------------------------------------------------------------------------------------------------------
/** `source: false` skips the source pins (a mutant of the dialog is meant to be caught by what the dialog DOES, not by its text). */
async function suite(sources, { source = true, light = false, route = true } = {}) {
  checks = 0
  if (source) sourceChecks(sources)
  if (source && route) detailSourceChecks(sources)
  pureChecks(sources)
  detailPureChecks(sources)
  await flagOffChecks(sources, light)
  await flagOnChecks(sources)
  await routeChecks(sources)
  await hookChecks(sources)
  await dialogDetailChecks(sources)
}

const MUTANTS = [
  // what reads as a report
  [LIB, 'another version is read', "raw.version !== ADMISSION_REPORT_VERSION ||", ''],
  [LIB, 'a headline of any characters', "typeof value === 'string' && value.length <= MAX_TEXT && SENTENCE.test(value)", "typeof value === 'string' && value.length <= MAX_TEXT"],
  [LIB, 'a headline of any length', "typeof value === 'string' && value.length <= MAX_TEXT && SENTENCE.test(value)", "typeof value === 'string' && /^[A-Za-z0-9 ,.;:()'%/+&-]+$/.test(value)"],
  [LIB, 'markup in a sentence', "const SENTENCE = /^[A-Za-z0-9 ,.;:()'%/+&-]{1,240}$/", "const SENTENCE = /^[A-Za-z0-9 ,.;:()'%/+&<>\"-]{1,240}$/"],
  [LIB, 'a line break in a sentence', "const SENTENCE = /^[A-Za-z0-9 ,.;:()'%/+&-]{1,240}$/", "const SENTENCE = /^[A-Za-z0-9 ,.;:()'%/+&\\n-]{1,240}$/"],
  [LIB, 'a change text of any kind', 'if (!isRecord(value) || !sentence(value.text)) return null', 'if (!isRecord(value)) return null'],
  [LIB, '41 changes read', 'raw.changes.length > MAX_CHANGES', 'raw.changes.length > MAX_CHANGES + 1'],
  [LIB, 'changes_more unchecked', "!whole(raw.changes_more, 0, 1e9)", 'false'],
  [LIB, 'a change with a bad slide number', "slides.every(number => whole(number, 1, MAX_SLIDE_NUMBER))", 'true'],
  [LIB, 'slide 0 read', "slides.every(number => whole(number, 1, MAX_SLIDE_NUMBER))", 'slides.every(number => whole(number, 0, MAX_SLIDE_NUMBER))'],
  [LIB, 'slide 501 read', "slides.every(number => whole(number, 1, MAX_SLIDE_NUMBER))", 'slides.every(number => whole(number, 1, MAX_SLIDE_NUMBER + 1))'],
  [LIB, '13 slide numbers read', 'slides.length > MAX_CHANGE_SLIDES', 'slides.length > MAX_CHANGE_SLIDES + 1'],
  [LIB, 'a count unchecked', 'if (!whole(value.count, 0, 1e9)) return null\n', ''],
  [LIB, 'a bad change drops only itself', '    if (!change) return null\n', '    if (!change) continue\n'],
  [LIB, 'an unknown outcome drops the report', "? value as AdmissionOutcome : 'other'", "? value as AdmissionOutcome : (null as never)"],
  [LIB, 'an unknown outcome is emphasised', "change.outcome !== 'other' && ADMISSION_EMPHASISED.includes(change.outcome)", 'true'],
  [LIB, 'an unranked unknown outcome goes first', "outcome === 'other' ? 9 :", "outcome === 'other' ? 0 :"],
  [LIB, 'a missing rank is not derived', ': outcome === \'other\' ? 9 : ADMISSION_OUTCOMES.indexOf(outcome) + 1', ': 5'],
  [LIB, 'a bad strip drops the report', "if (rows.every((row): row is AdmissionSlide => row !== null)) slides = rows", "if (rows.every((row): row is AdmissionSlide => row !== null)) slides = rows\n    else return null"],
  [LIB, 'a slide row unchecked', "if (!isRecord(value) || !whole(value.slide, 1, MAX_SLIDE_NUMBER) || typeof value.floor !== 'boolean') return null", "if (!isRecord(value)) return null"],
  [LIB, 'a slide count unchecked', "if (!counts.every(name => whole(value[name], 0, 1e9))) return null", ''],
  [LIB, '501 slide rows read', 'raw.slides.length <= MAX_SLIDE_ROWS', 'raw.slides.length <= MAX_SLIDE_ROWS + 1'],
  [LIB, 'the report is changed in place', "return { outcome, rank, text: value.text, slides: [...slides], count: value.count }", "return { outcome, rank, text: value.text, slides: slides as number[], count: value.count }; value.text = value.text"],
  // the view
  [LIB, 'not sorted by rank', ".sort((a, b) => a.change.rank - b.change.rank || a.index - b.index)", ''],
  [LIB, 'equal ranks reordered', "a.change.rank - b.change.rank || a.index - b.index", "a.change.rank - b.change.rank || b.index - a.index"],
  [LIB, 'check is emphasised', "export const ADMISSION_EMPHASISED: readonly AdmissionOutcome[] = ['text_left_out', 'floor', 'dropped', 'picture']", "export const ADMISSION_EMPHASISED: readonly AdmissionOutcome[] = ['text_left_out', 'floor', 'dropped', 'picture', 'check']"],
  [LIB, 'the floor is not emphasised', "['text_left_out', 'floor', 'dropped', 'picture']\n", "['text_left_out', 'dropped', 'picture']\n"],
  [LIB, 'a picture is not emphasised', "ADMISSION_EMPHASISED: readonly AdmissionOutcome[] = ['text_left_out', 'floor', 'dropped', 'picture']", "ADMISSION_EMPHASISED: readonly AdmissionOutcome[] = ['text_left_out', 'floor', 'dropped']"],
  [LIB, 'the list never starts open', 'open: rows.some(row => row.emphasised)', 'open: false'],
  [LIB, 'the list always starts open', 'open: rows.some(row => row.emphasised)', 'open: true'],
  [LIB, 'the more line is always there', 'moreLine: report.changesMore > 0 ?', 'moreLine: true ?'],
  [LIB, 'the more line is never there', 'moreLine: report.changesMore > 0 ?', 'moreLine: false ?'],
  [LIB, 'one more change in the plural', "plural(report.changesMore, 'change', 'changes')", "'changes'"],
  [LIB, 'the more line says changes, not small changes', 'and ${report.changesMore} more small ${', 'and ${report.changesMore} more ${'],
  [LIB, 'the text is built from the key', "text: value.text, slides: [...slides]", "text: String(value.key), slides: [...slides]"],
  [LIB, 'the strip is not in slide order', "[...report.slides].sort((a, b) => a.slide - b.slide).map(chipFor)", '[...report.slides].map(chipFor)'],
  [LIB, 'the floor does not outrank', "const kind: AdmissionChipKind = row.floor ? 'floor' : row.dropped > 0 || row.textListed > 0 ? 'attention'", "const kind: AdmissionChipKind = row.dropped > 0 || row.textListed > 0 ? 'attention' : row.floor ? 'floor'"],
  [LIB, 'text left out is not attention', "row.dropped > 0 || row.textListed > 0 ? 'attention'", "row.dropped > 0 ? 'attention'"],
  [LIB, 'a left-out element is not attention', "row.dropped > 0 || row.textListed > 0 ? 'attention'", "row.textListed > 0 ? 'attention'"],
  [LIB, 'a picture is not a picture', ": row.picture > 0 ? 'picture'", ": row.picture > 0 ? 'changed'"],
  [LIB, 'a change is quiet', ": row.changed > 0 || row.changes > 0 ? 'changed' : 'quiet'", ": row.changed > 0 ? 'changed' : 'quiet'"],
  [LIB, 'a long deck shows every slide', 'chips.length <= STRIP_ALL ? chips : chips.filter(chip => chip.kind !== \'quiet\')', 'chips'],
  [LIB, 'a short deck hides its quiet slides', 'chips.length <= STRIP_ALL ? chips :', 'chips.length <= 0 ? chips :'],
  [LIB, 'the strip limit is 61', 'export const STRIP_ALL = 60', 'export const STRIP_ALL = 61'],
  [LIB, 'the strip is not capped', 'const kept = shown.slice(0, STRIP_MAX)', 'const kept = shown'],
  [LIB, 'the strip cap is 100', 'export const STRIP_MAX = 120', 'export const STRIP_MAX = 100'],
  [LIB, 'the note ignores totals.slides', 'Math.max(report.slideCount ?? chips.length, chips.length)', 'chips.length'],
  [LIB, 'a slide total below the rows makes a note', 'Math.max(report.slideCount ?? chips.length, chips.length)', '(report.slideCount ?? chips.length)'],
  [LIB, 'the note counts the capped slides as quiet', 'const quiet = Math.max(report.slideCount ?? chips.length, chips.length) - shown.length', 'const quiet = Math.max(report.slideCount ?? chips.length, chips.length) - kept.length'],
  [LIB, 'the note says "is" for many', "plural(quiet, 'is', 'are')", "'is'"],
  [LIB, 'a plural piece of text', "plural(row.textListed, 'piece', 'pieces')", "'piece'"],
  [LIB, 'a plural picture', "plural(row.picture, 'a picture', 'pictures')", "'a picture'"],
  [LIB, 'the job report loses to the row', 'return admissionReportView(jobReport) ?? admissionReportView(detailReport) ?? admissionReportView(rowReport)', 'return admissionReportView(rowReport) ?? admissionReportView(detailReport) ?? admissionReportView(jobReport)'],
  [LIB, 'an unreadable job report hides the row', 'return admissionReportView(jobReport) ?? admissionReportView(detailReport) ?? admissionReportView(rowReport)', 'return jobReport === null || jobReport === undefined ? (admissionReportView(detailReport) ?? admissionReportView(rowReport)) : admissionReportView(jobReport)'],
  [LIB, 'the words of an outcome change', "text_left_out: 'Text left out', floor: 'Slide rebuilt over a picture', dropped: 'Left out'", "text_left_out: 'Text left out', floor: 'Slide rebuilt over a picture', dropped: 'Dropped'"],
  // the component
  [VIEW, 'flag off draws the report', 'if (!enabled) return node\n', ''],
  [VIEW, 'flag on draws a wrapper with nothing in it', '  if (!view) return node\n', '  if (!view) return <>{node}</>\n'],
  [VIEW, 'the row\'s own report is ignored', '(template as { admission_report?: unknown }).admission_report', 'undefined'],
  [VIEW, 'the job report is ignored', 'admissionReportFor(jobReport, ', 'admissionReportFor(null, '],
  [VIEW, 'the report goes before the row', '<>{node}<AdmissionReportBlock view={view} studioShell={studioShell} onOpen={askable ? () => details.open(templateId) : undefined} /></>', '<><AdmissionReportBlock view={view} studioShell={studioShell} onOpen={askable ? () => details.open(templateId) : undefined} />{node}</>'],
  [VIEW, 'the group has no name', 'role="group" aria-label="What changed"', 'role="group"'],
  [VIEW, 'the caption goes', '<p className="font-medium">What changed</p>', ''],
  [VIEW, 'the headline is not shown', "{view.headline}</p>", '</p>'],
  [VIEW, 'the headline is shown only with the list', '<p data-studio-admission-headline={studioShell ? \'true\' : undefined} className="text-muted-foreground">{view.headline}</p>\n      {view.rows.length > 0 && <details', '{view.rows.length > 0 && <p data-studio-admission-headline={studioShell ? \'true\' : undefined} className="text-muted-foreground">{view.headline}</p>}\n      {view.rows.length > 0 && <details'],
  [VIEW, 'the list opens whatever the view says', 'open={view.open}', 'open'],
  [VIEW, 'the list never opens', 'open={view.open}', 'open={false}'],
  [VIEW, 'a report with no changes still has a list', '{view.rows.length > 0 && <details', '{<details'],
  [VIEW, 'the emphasis is not marked', "data-studio-admission-emphasis={studioShell && row.emphasised ? 'true' : undefined}", 'data-studio-admission-emphasis={undefined}'],
  [VIEW, 'every row is marked emphasised', "data-studio-admission-emphasis={studioShell && row.emphasised ? 'true' : undefined}", "data-studio-admission-emphasis={studioShell ? 'true' : undefined}"],
  [VIEW, 'the emphasis is not bold', "${row.emphasised ? 'font-medium' : ''}", "${''}"],
  [VIEW, 'the outcome is not marked', 'data-studio-admission-row={studioShell ? row.outcome : undefined}', 'data-studio-admission-row={undefined}'],
  [VIEW, 'a picture has the wrong icon', 'picture: ImageIcon,', 'picture: Info,'],
  [VIEW, 'text left out has the wrong icon', 'text_left_out: Type,', 'text_left_out: Info,'],
  [VIEW, 'the floor has the wrong icon', 'floor: Layers,', 'floor: Info,'],
  [VIEW, 'the icon has no name', 'aria-label={ADMISSION_OUTCOME_WORDS[row.outcome]}', ''],
  [VIEW, 'the icon names the wrong outcome', 'aria-label={ADMISSION_OUTCOME_WORDS[row.outcome]}', 'aria-label={ADMISSION_OUTCOME_WORDS.other}'],
  [VIEW, 'the sentence is not shown', '<span>{row.text}</span>', '<span>{row.outcome}</span>'],
  [VIEW, 'the more line is not shown', '{view.moreLine && <p', '{false && <p'],
  [VIEW, 'the strip is not shown', '{view.strip && view.strip.length > 0 && <div', '{false && <div'],
  [VIEW, 'a chip loses its slide', "className=\"min-w-[1.5rem] rounded border px-1 text-center\">{chip.slide}</li>", "className=\"min-w-[1.5rem] rounded border px-1 text-center\"></li>"],
  [VIEW, 'a chip loses its words', "title={chip.label} aria-label={chip.label}", 'title={chip.label}'],
  [VIEW, 'a chip loses its kind', "data-studio-admission-chip={studioShell ? chip.kind : undefined}", 'data-studio-admission-chip={undefined}'],
  [VIEW, 'the strip note is not shown', '{view.stripNote && <p', '{false && <p'],
  [VIEW, 'the markers are drawn in the plain shell', "data-studio-admission-report={studioShell ? 'true' : undefined}", "data-studio-admission-report=\"true\""],
  // the hook and the dialog
  [HOOK, 'any job gives its report', 'job && job.template_id === templateId ?', 'job ?'],
  [HOOK, 'the job report is never given', "(job as { admission_report?: unknown }).admission_report ?? null : null", 'null : null'],
  [HOOK, 'an inert hook gives a report', 'around: node => node, report: () => null,', 'around: node => node, report: () => ({ version: \'composer-admission-report-v1\' }),'],
  [DIALOG, 'the flag is read loosely', "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT === 'true'", "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT !== 'false'"],
  [DIALOG, 'the flag is on whatever is set', "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT"],
  [DIALOG, 'the tracked job is not offered', 'templateProgress.report(template.id)', 'null'],
  [DIALOG, 'the tracked job is offered to every row', 'templateProgress.report(template.id)', "templateProgress.report(templateProgress.view?.templateId ?? '')"],
  [DIALOG, 'the report is drawn for the wrong template', 'admissionReportAround(ADMISSION_REPORT, template, ', 'admissionReportAround(ADMISSION_REPORT, templates[0], '],
  [DIALOG, 'the shell flag is not handed on', ', studioShell, admissionDetails)}\n                {newTopicEnabled', ', true, admissionDetails)}\n                {newTopicEnabled'],
  // the template read (section 5): the Studio proxy
  [ROUTE, 'the template read ignores the flag', "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT === 'true' && req.method === 'GET'", "req.method === 'GET'"],
  [ROUTE, 'the flag is read loosely (route)', "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT === 'true'", "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT !== 'false'"],
  [ROUTE, 'the flag is on whatever is set (route)', "process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT"],
  [ROUTE, 'any method reads a template', "=== 'true' && req.method === 'GET' && path.length === 2 && path[0] === 'templates' && safeId(path[1])\n  const upload", "=== 'true' && path.length === 2 && path[0] === 'templates' && safeId(path[1])\n  const upload"],
  [ROUTE, 'the template id is not checked', "&& path.length === 2 && path[0] === 'templates' && safeId(path[1])\n  const upload", "&& path.length === 2 && path[0] === 'templates'\n  const upload"],
  [ROUTE, 'a deeper path reads a template', "&& path.length === 2 && path[0] === 'templates' && safeId(path[1])\n  const upload", "&& path.length >= 2 && path[0] === 'templates' && safeId(path[1])\n  const upload"],
  [ROUTE, 'any first segment reads a template', "&& path.length === 2 && path[0] === 'templates' && safeId(path[1])\n  const upload", "&& path.length === 2 && safeId(path[1])\n  const upload"],
  [ROUTE, 'the whole template goes on', 'detail && response.ok ? admissionTemplate(answer) : answer', 'answer'],
  [ROUTE, 'Director\'s error is trimmed', 'detail && response.ok ? admissionTemplate(answer) : answer', 'detail ? admissionTemplate(answer) : answer'],
  [ROUTE, 'the list and the job read are trimmed', 'detail && response.ok ? admissionTemplate(answer) : answer', 'response.ok ? admissionTemplate(answer) : answer'],
  [ROUTE, 'the trim keeps the whole row', "{ ...(record(row) && typeof row.id === 'string' ? { id: row.id } : {}), ingest_source:", "{ ...(record(row) ? row : {}), ingest_source:"],
  [ROUTE, 'the trim keeps the whole ingest_source', 'ingest_source: record(source.admission_report) ? { admission_report: source.admission_report } : {} }', 'ingest_source: source }'],
  [ROUTE, 'the trim passes a report that is not an object', 'ingest_source: record(source.admission_report) ?', 'ingest_source: source.admission_report !== undefined ?'],
  [ROUTE, 'the trim drops the id', "record(row) && typeof row.id === 'string' ?", 'false ?'],
  [ROUTE, 'the browser\'s user id is forwarded', "'X-Composer-User-Id': userId,", "'X-Composer-User-Id': req.headers.get('x-composer-user-id') ?? userId,"],
  [ROUTE, 'the browser\'s token is forwarded', 'Authorization: `Bearer ${token}`,', 'Authorization: req.headers.get(\'authorization\') ?? `Bearer ${token}`,'],
  [ROUTE, 'redirects are followed', "redirect: 'error',", "redirect: 'follow',"],
  [ROUTE, 'every read goes out as a GET', 'method: req.method,', "method: 'GET',"],
  [ROUTE, 'the answer may be cached', "headers: { 'Cache-Control': 'no-store' } })", 'headers: {} })'],
  [ROUTE, 'the library flag no longer gates', "if (process.env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED !== 'true') {", 'if (false) {'],
  [ROUTE, 'no sign-in is asked for', "if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })", ''],
  // the hook
  [DETAIL, 'a template is asked again whenever its list is opened', 'if (asked.current.has(templateId)) return', ''],
  [DETAIL, 'the hook is live with the flag off', 'if (!enabled) return INERT\n', ''],
  [DETAIL, 'the reads run together', 'queue.current = queue.current.then(async () => {', 'queue.current = Promise.resolve().then(async () => {'],
  [DETAIL, 'a failed read is asked again', 'catch { /* quietly: the row stays as the list drew it */ }', 'catch { asked.current.delete(templateId) }'],
  [DETAIL, 'a failed read is raised', 'catch { /* quietly: the row stays as the list drew it */ }', 'catch (error) { throw error }'],
  [DETAIL, 'an answer for another template is kept', 'templateDetailReport(row, templateId)', 'templateDetailReport(row, (row as { id?: string })?.id ?? templateId)'],
  [DETAIL, 'a late answer is kept', 'if (report && !signal.aborted) setReports', 'if (report) setReports'],
  [DETAIL, 'the dialog going away stops nothing', '    controller.current?.abort()\n', ''],
  [DETAIL, 'a read that was waiting still runs after the dialog goes', '      if (signal.aborted) return\n      try {', '      try {'],
  [DETAIL, 'a report that opens by itself is never asked', 'useEffect(() => { wanted.current.forEach(open) })', 'useEffect(() => { /* never */ })'],
  [DETAIL, 'the cleanup forgets nothing', '    asked.current = new Set()\n', ''],
  [DETAIL, 'the cleanup keeps the aborted signal', '    controller.current = null\n', ''],
  [DETAIL, 'the id is not encoded', '${encodeURIComponent(templateId)}', '${templateId}'],
  [DETAIL, 'the read has a body', 'undefined, signal)', '{}, signal)'],
  [DETAIL, 'an answer with no report is kept as one', 'if (report && !signal.aborted)', 'if (!signal.aborted)'],
  // the block and the wrapper
  [VIEW, 'opening the list is not heard', 'onToggle={onOpen && (event => { if (event.currentTarget.open) onOpen() })}', 'onToggle={undefined}'],
  [VIEW, 'closing the list asks too', 'if (event.currentTarget.open) onOpen()', 'onOpen()'],
  [VIEW, 'a report that has its strip asks', 'view.strip === null && ', ''],
  [VIEW, 'a report with no list asks', 'view.rows.length > 0 && details !== undefined', 'details !== undefined'],
  [VIEW, 'a closed report asks at once', 'if (askable && view.open) details.want(templateId)', 'if (askable) details.want(templateId)'],
  [VIEW, 'an open report waits to be touched', 'if (askable && view.open) details.want(templateId)', 'if (false) details.want(templateId)'],
  [VIEW, 'the template read is ignored', 'templateId === null ? null : details?.report(templateId)', 'null'],
  [VIEW, 'the wrong template is asked for', '() => details.open(templateId)', '() => details.open(`${templateId}!`)'],
  [VIEW, 'a chip can be pressed', 'className="min-w-[1.5rem] rounded border px-1 text-center">{chip.slide}</li>', 'onClick={() => {}} className="min-w-[1.5rem] rounded border px-1 text-center">{chip.slide}</li>'],
  [VIEW, 'a chip takes focus', '<li key={chip.slide}', '<li tabIndex={0} key={chip.slide}'],
  [LIB, 'the template read ignores which template', 'row.id !== templateId || ', ''],
  [LIB, 'a report that is not an object is handed on', 'return isRecord(report) ? report : null', 'return (report as Record<string, unknown>) ?? null'],
  [LIB, 'the template read wins over the tracked job', 'return admissionReportView(jobReport) ?? admissionReportView(detailReport) ?? admissionReportView(rowReport)', 'return admissionReportView(detailReport) ?? admissionReportView(jobReport) ?? admissionReportView(rowReport)'],
  [LIB, 'the list wins over the template read', 'return admissionReportView(jobReport) ?? admissionReportView(detailReport) ?? admissionReportView(rowReport)', 'return admissionReportView(jobReport) ?? admissionReportView(rowReport) ?? admissionReportView(detailReport)'],
  [LIB, 'the template read is not given a row\'s ingest_source', ' || !isRecord(row.ingest_source)) return null', ') return null'],
  [DIALOG, 'the template reads are not handed to the wrapper', ', studioShell, admissionDetails)}\n                {newTopicEnabled', ', studioShell)}\n                {newTopicEnabled'],
  [DIALOG, 'the hook is given the wrong flag', 'useAdmissionDetails(ADMISSION_REPORT)', 'useAdmissionDetails(false)'],
]

const started = Date.now()
if (process.env.AR_MUTANT_TARGETS_ONLY) { // a quick look that every mutant still names exactly one place (while editing the sources)
  for (const [rel, name, from] of MUTANTS) assert.equal(branchSources[rel].split(from).length, 2, `mutant "${name}" must match exactly one place in ${rel}`)
  console.log(`${MUTANTS.length} mutant targets match`); process.exit(0)
}
fixtureChecks()
detailFixtureChecks()
await suite(branchSources)
const total = checks
if (process.env.AR_NO_MUTANTS) { console.log(`PASS (no mutants run): studio template admission report (${total} checks)`); process.exit(0) }
let caught = 0
const survivors = []
for (const [rel, name, from, to] of MUTANTS) {
  const source = branchSources[rel]
  assert.equal(source.split(from).length, 2, `mutant "${name}" must match exactly one place in ${rel}`)
  let failure = null
  // a mutant of the dialog or of the route is meant to be caught by what it DOES, not by its text (the pins compare those files to the base's, line for line)
  try { await suite({ ...branchSources, [rel]: source.replace(from, () => to) }, { source: rel !== DIALOG, route: rel !== ROUTE, light: true }) } catch (error) { failure = error }
  if (!failure) { survivors.push(name); console.log(`  MUTANT SURVIVED: ${name}`); continue }
  caught++
  console.log(`  mutation caught: ${name} (${String(failure.message).split('\n')[0].slice(0, 100)})`)
}
assert.deepStrictEqual(survivors, [], `MUTANTS SURVIVED: ${survivors.join('; ')}`)
console.log(`PASS: studio template admission report (${total} checks, ${caught}/${MUTANTS.length} mutants caught, ${((Date.now() - started) / 1000).toFixed(0)} s)`)
process.exit(0) // the fake runtime has no unmount; every scenario ends its job (a finished frame), and this makes the exit certain
