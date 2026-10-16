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
//   ADMISSION_REPORT_BASE=<commit> picks the base the flag-off identity is measured against (default 80dfde4, the studio-v4-dev-preparation-code commit this branch was
//   cut from; the repository needs that commit in its history).
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
const BASE = process.env.ADMISSION_REPORT_BASE || '80dfde4'
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
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item === undefined ? '__undefined__' : item)
const plain = value => JSON.parse(JSON.stringify(value))
const deq = (actual, expected, message) => message === undefined ? assert.deepStrictEqual(plain(actual), plain(expected)) : assert.deepStrictEqual(plain(actual), plain(expected), message)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
let checks = 0
const check = (fn, ...args) => { fn(...args); checks++ }

const branchSources = { [DIALOG]: read(DIALOG), [HOOK]: read(HOOK), [VIEW]: read(VIEW), [LIB]: read(LIB) }
const baseDialog = execFileSync('git', ['show', `${BASE}:${DIALOG}`], { cwd: root, encoding: 'utf8' })
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
 * repeats). `queue`: what each POST creates next: {job_id, answers}. Every request, session create, upload and storage access is logged in order.
 */
function mount({ sources, flag, progress = false, shell = true, templates = [], jobs = {}, queue = [], saved = null, env: extraEnv = {} }) {
  const log = [], store = new Map(), answers = new Map(Object.entries(jobs).map(([id, list]) => [id, [...list]]))
  const pending = [...queue]
  let sessions = 0, listIncludesSaved = false
  const reply = (status, data) => ({ ok: status < 400, status, json: async () => plain(data) })
  const fetch = async (url, init = {}) => {
    log.push(['fetch', init.method, url, init.body ?? null])
    const route = url.replace('/api/composer-library/', '')
    if (init.method === 'GET' && route === 'templates') return reply(200, { templates: [...(listIncludesSaved && saved ? [saved] : []), ...templates] })
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
    // no extra request, no storage access, no session: the same trace as the flag off
    const off = mount({ sources, flag: undefined, shell, templates: LIST() }); await off.settle()
    check(assert.equal, ser(ui.log), ser(off.log), `shell ${shell}: the same requests and storage access as flag off`)
    check(assert.deepStrictEqual, ui.log.map(entry => entry[0] === 'fetch' ? `${entry[1]} ${entry[2]}` : entry[0]), ['GET /api/composer-library/templates', 'getItem'], 'one list read and the dialog\'s own read of its stored job; nothing else')
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

// ---- 4. mutations ---------------------------------------------------------------------------------------------------------------------------
/** `source: false` skips the source pins (a mutant of the dialog is meant to be caught by what the dialog DOES, not by its text). */
async function suite(sources, { source = true, light = false } = {}) {
  checks = 0
  if (source) sourceChecks(sources)
  pureChecks(sources)
  await flagOffChecks(sources, light)
  await flagOnChecks(sources)
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
  [LIB, 'the job report loses to the row', 'return admissionReportView(jobReport) ?? admissionReportView(rowReport)', 'return admissionReportView(rowReport) ?? admissionReportView(jobReport)'],
  [LIB, 'an unreadable job report hides the row', 'return admissionReportView(jobReport) ?? admissionReportView(rowReport)', 'return jobReport === null || jobReport === undefined ? admissionReportView(rowReport) : admissionReportView(jobReport)'],
  [LIB, 'the words of an outcome change', "text_left_out: 'Text left out', floor: 'Slide rebuilt over a picture', dropped: 'Left out'", "text_left_out: 'Text left out', floor: 'Slide rebuilt over a picture', dropped: 'Dropped'"],
  // the component
  [VIEW, 'flag off draws the report', 'if (!enabled) return node\n', ''],
  [VIEW, 'flag on draws a wrapper with nothing in it', 'return view ? <>{node}<AdmissionReportBlock view={view} studioShell={studioShell} /></> : node', 'return <>{node}{view && <AdmissionReportBlock view={view} studioShell={studioShell} />}</>'],
  [VIEW, 'the row\'s own report is ignored', '(template as { admission_report?: unknown }).admission_report', 'undefined'],
  [VIEW, 'the job report is ignored', 'admissionReportFor(jobReport, ', 'admissionReportFor(null, '],
  [VIEW, 'the report goes before the row', '<>{node}<AdmissionReportBlock view={view} studioShell={studioShell} /></>', '<><AdmissionReportBlock view={view} studioShell={studioShell} />{node}</>'],
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
  [DIALOG, 'the shell flag is not handed on', ', studioShell)}\n                {newTopicEnabled', ', true)}\n                {newTopicEnabled'],
]

const started = Date.now()
if (process.env.AR_MUTANT_TARGETS_ONLY) { // a quick look that every mutant still names exactly one place (while editing the sources)
  for (const [rel, name, from] of MUTANTS) assert.equal(branchSources[rel].split(from).length, 2, `mutant "${name}" must match exactly one place in ${rel}`)
  console.log(`${MUTANTS.length} mutant targets match`); process.exit(0)
}
fixtureChecks()
await suite(branchSources)
const total = checks
if (process.env.AR_NO_MUTANTS) { console.log(`PASS (no mutants run): studio template admission report (${total} checks)`); process.exit(0) }
let caught = 0
const survivors = []
for (const [rel, name, from, to] of MUTANTS) {
  const source = branchSources[rel]
  assert.equal(source.split(from).length, 2, `mutant "${name}" must match exactly one place in ${rel}`)
  let failure = null
  try { await suite({ ...branchSources, [rel]: source.replace(from, () => to) }, { source: rel !== DIALOG, light: true }) } catch (error) { failure = error }
  if (!failure) { survivors.push(name); console.log(`  MUTANT SURVIVED: ${name}`); continue }
  caught++
  console.log(`  mutation caught: ${name} (${String(failure.message).split('\n')[0].slice(0, 100)})`)
}
assert.deepStrictEqual(survivors, [], `MUTANTS SURVIVED: ${survivors.join('; ')}`)
console.log(`PASS: studio template admission report (${total} checks, ${caught}/${MUTANTS.length} mutants caught, ${((Date.now() - started) / 1000).toFixed(0)} s)`)
process.exit(0) // the fake runtime has no unmount; every scenario ends its job (a finished frame), and this makes the exit certain
