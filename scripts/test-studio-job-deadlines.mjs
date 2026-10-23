// P3-4 slice B (Studio side): every long Studio request ends visibly (flag NEXT_PUBLIC_STUDIO_JOB_DEADLINES, exact "true", default off).
// lib/studio-job-deadlines.ts holds the deadlines (constants with their sources) and the deadline helper; the five call sites load it
// only with the flag on (a dynamic import), so flag off nothing extra is loaded and every request is the call it was.
//
//   node scripts/test-studio-job-deadlines.mjs            (plain node: transpile + vm, no network)
//   node scripts/test-studio-job-deadlines.mjs --no-mutants
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const LIB = 'lib/studio-job-deadlines.ts'
const DL = 'lib/api/download-service.ts'
const SITES = {
  [DL]: read(DL),
  'components/narration-voice-picker.tsx': read('components/narration-voice-picker.tsx'),
}
const transpile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const plain = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

let checks = 0
const ok = (cond, msg) => { assert.ok(cond, msg); checks++ }
const eq = (a, b, msg) => { assert.deepEqual(plain(a), plain(b), msg); checks++ }

function loadLib(text, env = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(text), { module: mod, exports: mod.exports, process: { env }, AbortController, setTimeout, clearTimeout, Math, Number,
    require: id => assert.fail(`the deadlines module must stay import-free: ${id}`) })
  return mod.exports
}

function fakeTimers() {
  const timers = []
  return {
    timers,
    setTimer: (fn, ms) => { const h = { fn, ms, done: false }; timers.push(h); return h },
    clearTimer: h => { if (h) h.done = true },
    fire: () => { for (const h of timers) if (!h.done) { h.done = true; h.fn() } },
  }
}

async function libChecks(text) {
  const lib = loadLib(text, { NEXT_PUBLIC_STUDIO_JOB_DEADLINES: 'true' })
  eq(lib.STUDIO_JOB_DEADLINES_ENABLED, true, 'flag exact "true" is on')
  for (const value of [undefined, '', 'false', 'TRUE', '1', ' true']) eq(loadLib(text, value === undefined ? {} : { NEXT_PUBLIC_STUDIO_JOB_DEADLINES: value }).STUDIO_JOB_DEADLINES_ENABLED, false, `flag ${JSON.stringify(value)} is off`)
  eq([lib.MODEL_CATALOGUE_DEADLINE_MS, lib.NARRATION_LONG_DEADLINE_MS, lib.NARRATION_VOICE_DEADLINE_MS, lib.JOB_DEADLINE_CAP_MS], [20_000, 315_000, 30_000, 300_000], 'the fixed deadlines (route budget + margin)')
  eq([lib.exportDeadlineMs(42), lib.exportDeadlineMs(12), lib.exportDeadlineMs(1)], [156_000, 66_000, 33_000], 'export: 30 s + 3 s per slide')
  eq([lib.exportDeadlineMs(200), lib.exportDeadlineMs(null), lib.exportDeadlineMs(0), lib.exportDeadlineMs(NaN), lib.exportDeadlineMs(-3)], [300_000, 300_000, 300_000, 300_000, 300_000], 'export: capped at 5 min; an unknown count is the cap')
  eq(lib.exportDeadlineMs(41.2), 30_000 + 3_000 * 42, 'a fractional count rounds up')
  eq([lib.duplicateDeadlineMs(10), lib.duplicateDeadlineMs(400), lib.duplicateDeadlineMs(undefined)], [70_000, 300_000, 300_000], 'duplicate: 60 s + 1 s per slide, capped')
  { const t = fakeTimers(); const d = lib.startJobDeadline(5_000, null, t)
    eq(t.timers[0].ms, 5_000, 'the timer is set to the deadline'); ok(!d.signal.aborted && !d.timedOut(), 'not aborted before the deadline')
    t.fire(); ok(d.signal.aborted && d.timedOut(), 'at the deadline: aborted and timed out') }
  { const t = fakeTimers(); const d = lib.startJobDeadline(5_000, null, t); d.clear(); t.fire()
    ok(!d.signal.aborted && !d.timedOut(), 'cleared before the deadline: never aborted') ; d.clear(); checks++ }
  { const t = fakeTimers(); const d = lib.startJobDeadline(5_000, null, t); d.clear(); t.timers[0].fn()
    ok(!d.signal.aborted && !d.timedOut(), 'a timer already due when the job finished does not abort it') }
  { const t = fakeTimers(); const parent = new AbortController(); const d = lib.startJobDeadline(5_000, parent.signal, t)
    parent.abort(); ok(d.signal.aborted && !d.timedOut(), "the caller's own abort aborts, but is not a timeout") }
  { const t = fakeTimers(); const parent = new AbortController(); parent.abort(); const d = lib.startJobDeadline(5_000, parent.signal, t)
    ok(d.signal.aborted && !d.timedOut(), 'an already-aborted caller signal aborts at once') }
  ok(/took longer than 2 minutes/.test(lib.jobDeadlineMessage('The PDF export', 156_000)) && /Try again\.$/.test(lib.jobDeadlineMessage('X', 20_000)), 'the plain message')
  eq(lib.jobDeadlineMessage('X', 20_000), 'X took longer than 20 seconds, so Studio stopped waiting. Try again.', 'seconds under 2 minutes')
}

/** downloadPDF with the flag on and a Downloads request that never answers: it ends in a failure result, and no download starts. */
async function downloadChecks(dlText) {
  const calls = { fetch: [], downloads: 0 }
  const deadlineStub = { started: [] }
  const jobsStub = {
    exportDeadlineMs: n => (n === 42 ? 156_000 : 300_000),
    jobDeadlineMessage: (what, ms) => `${what} took longer than ${ms}`,
    startJobDeadline: ms => {
      const controller = new AbortController(); let expired = false
      deadlineStub.started.push(ms)
      const d = { signal: controller.signal, clear() { d.cleared = true }, timedOut: () => expired, cleared: false, expire() { expired = true; controller.abort() } }
      deadlineStub.last = d
      return d
    },
  }
  const fetchHang = (url, init) => new Promise((resolve, reject) => {
    calls.fetch.push({ url, init })
    init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
  })
  const load = env => {
    const mod = { exports: {} }
    const windowStub = { URL: { createObjectURL: () => { calls.downloads++; return 'blob:x' }, revokeObjectURL() {} } }
    vm.runInNewContext(transpile(dlText), { module: mod, exports: mod.exports, process: { env }, fetch: fetchHang, console: { error() {} }, window: windowStub, document: {},
      require: id => {
        if (id === '@/lib/service-url') return { requireServiceUrl: () => 'https://dl.test' }
        if (id === '@/lib/export-view-only') return { withExportViewOnly: x => x }
        if (id === '@/lib/studio-job-deadlines') return jobsStub
        assert.fail(`unexpected import ${id}`)
      } })
    return mod.exports
  }
  { const dl = load({ NEXT_PUBLIC_STUDIO_JOB_DEADLINES: 'true' })
    const pending = dl.downloadPDF('https://layout.test/p/abc', 'high', 42)
    await new Promise(r => setTimeout(r, 5))
    eq(deadlineStub.started, [156_000], 'the PDF export starts its slide-scaled deadline')
    ok(calls.fetch[0].init.signal === deadlineStub.last.signal, 'the request carries the deadline signal')
    deadlineStub.last.expire()
    const out = await pending
    eq(out, { success: false, error: 'The PDF export took longer than 156000' }, 'at the deadline the export ends in a failure result (the caller shows it)')
    eq(calls.downloads, 0, 'no download and no blob URL is created for an aborted export')
    ok(deadlineStub.last.cleared, 'the deadline is cleared') }
  { calls.fetch.length = 0; deadlineStub.started.length = 0
    const dl = load({ NEXT_PUBLIC_STUDIO_JOB_DEADLINES: 'true' })
    const pending = dl.downloadPPTX('https://layout.test/p/abc', 42, 'high')
    await new Promise(r => setTimeout(r, 5))
    deadlineStub.last.expire()
    eq(await pending, { success: false, error: 'The PowerPoint export took longer than 156000' }, 'the PowerPoint export ends the same way') }
  { calls.fetch.length = 0; deadlineStub.started.length = 0
    const dl = load({})
    void dl.downloadPDF('https://layout.test/p/abc', 'high', 42)
    await new Promise(r => setTimeout(r, 5))
    eq(deadlineStub.started, [], 'flag off: no deadline is started (the module is not even loaded)')
    ok(!('signal' in calls.fetch[0].init), 'flag off: the request has no signal, as before') }
}

function staticChecks() {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'app', 'lib', 'hooks', 'components'], { cwd: root, encoding: 'utf8' }).split('\n').filter(f => /\.(ts|tsx)$/.test(f))
  eq(files.filter(f => /from ['"]@\/lib\/studio-job-deadlines['"]/.test(read(f))), [], 'no static import of the deadlines module anywhere')
  const dynamic = /process\.env\.NEXT_PUBLIC_STUDIO_JOB_DEADLINES === ["']true["'] \? await import\(["']@\/lib\/studio-job-deadlines["']\) : null/g
  eq((SITES[DL].match(dynamic) || []).length, 2, 'the export loads the module only with the exact flag, in PDF and PowerPoint')
  ok(/if \(process\.env\.NEXT_PUBLIC_STUDIO_JOB_DEADLINES !== 'true'\) return fetch\(input, init\)/.test(SITES['components/narration-voice-picker.tsx']), 'narration: flag off is the plain fetch')
  eq((SITES['components/narration-voice-picker.tsx'].match(/await narrationFetch\(/g) || []).length, 4, 'narration: all four requests go through the deadline helper')
  eq((SITES['components/narration-voice-picker.tsx'].match(/await fetch\(/g) || []).length, 1, "narration: the helper's own request is the only bare one left")
  eq((SITES[DL].match(/const blob = await response\.blob\(\);\n    deadline\?\.clear\(\)/g) || []).length, 2, 'the export deadline stops once the file is in hand (before the download starts)')
  ok(read('components/presentation-download-controls.tsx').includes('const result = await downloadPDF(presentationUrl, quality);'), 'the Download menu is untouched (its PDF passes no slide count: the 5 min cap applies)')
  const env = read('.env.example')
  eq((env.match(/^NEXT_PUBLIC_STUDIO_JOB_DEADLINES="false"$/gm) || []).length, 1, '.env.example declares the flag once, "false"')
  ok(env.indexOf('NEXT_PUBLIC_STUDIO_JOB_DEADLINES="false"') < env.indexOf('# PASS2 ADMIN'), 'its block sits before # PASS2 ADMIN')
}

/** The strip module (for pins that hold these files to an earlier commit): it removes exactly this change's text. */
async function stripChecks() {
  const BASE_COMMIT = 'cfc09f899ee47a5e828f2eb5fb0a7007dd3c694a' // studio-v4-dev-preparation-code this change is stacked on (#484's merge)
  const { stripJobDeadlines, JOB_DEADLINES_FILES } = await import('./studio-job-deadlines-strip.mjs')
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  eq([...JOB_DEADLINES_FILES].sort(), ['.env.example', 'components/narration-voice-picker.tsx', DL].sort(), 'the strip covers exactly the 3 changed files')
  for (const rel of JOB_DEADLINES_FILES) {
    const stripped = stripJobDeadlines(rel, read(rel))
    let later = false
    try { later = git(['log', '--format=%s', `${BASE_COMMIT}..HEAD`, '--', rel]).split('\n').filter(Boolean).some(s => !/p3-4b|job.deadlines/i.test(s)) } catch { later = false }
    if (!later) { eq(stripped, git(['show', `${BASE_COMMIT}:${rel}`]), `${rel}: stripping gives back the base byte for byte`); continue }
    ok(!/NEXT_PUBLIC_STUDIO_JOB_DEADLINES|studio-job-deadlines|narrationFetch/.test(stripped), `${rel}: stripping leaves none of this change's text (stacked)`)
  }
  eq(stripJobDeadlines('lib/other.ts', 'x'), 'x', 'any other file comes back as it is')
}

const MUTANTS = [
  ['loose flag', s => s.replace("process.env.NEXT_PUBLIC_STUDIO_JOB_DEADLINES === 'true'", 'Boolean(process.env.NEXT_PUBLIC_STUDIO_JOB_DEADLINES)')],
  ['export slope 1 s', s => s.replace('30_000 + 3_000 * Math.ceil(slideCount)', '30_000 + 1_000 * Math.ceil(slideCount)')],
  ['no export cap', s => s.replace('return Math.min(30_000 + 3_000 * Math.ceil(slideCount), JOB_DEADLINE_CAP_MS)', 'return 30_000 + 3_000 * Math.ceil(slideCount)')],
  ['unknown count not capped', s => s.replace("if (typeof slideCount !== 'number' || !Number.isFinite(slideCount) || slideCount < 1) return JOB_DEADLINE_CAP_MS\n  return Math.min(30_000", "if (typeof slideCount !== 'number') return 30_000\n  return Math.min(30_000")],
  ['catalogue deadline', s => s.replace('export const MODEL_CATALOGUE_DEADLINE_MS = 20_000', 'export const MODEL_CATALOGUE_DEADLINE_MS = 15_000')],
  ['narration deadline', s => s.replace('export const NARRATION_LONG_DEADLINE_MS = 315_000', 'export const NARRATION_LONG_DEADLINE_MS = 300_000')],
  ['clear ignored', s => s.replace("setTimer(() => { if (!cleared) { expired = true; controller.abort() } }, ms)", "setTimer(() => { expired = true; controller.abort() }, ms)")],
  ['parent abort counts as timeout', s => s.replace('const onParentAbort = () => controller.abort()', 'const onParentAbort = () => { expired = true; controller.abort() }')],
  ['parent ignored', s => s.replace("    if (parent.aborted) controller.abort()\n    else parent.addEventListener('abort', onParentAbort, { once: true })", "    // mutant")],
  ['duplicate slope', s => s.replace('60_000 + 1_000 * Math.ceil(slideCount)', '60_000 + 3_000 * Math.ceil(slideCount)')],
]

await libChecks(read(LIB))
await downloadChecks(SITES[DL])
staticChecks()
await stripChecks()
console.log(`job deadlines: ${checks} checks passed`)
if (!process.argv.includes('--no-mutants')) {
  const survivors = []
  for (const [name, mutate] of MUTANTS) {
    const mutated = mutate(read(LIB))
    assert.notEqual(mutated, read(LIB), `mutant "${name}" must change the source`)
    try { await libChecks(mutated); survivors.push(name) } catch { /* caught */ }
  }
  assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
  console.log(`PASS mutation check: ${MUTANTS.length} of ${MUTANTS.length} mutants fail at least one check`)
}
