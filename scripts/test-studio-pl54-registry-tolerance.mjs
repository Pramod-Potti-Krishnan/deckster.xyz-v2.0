// PL-54 (Platform card, 26 Nov 2026): the generic tolerance in the registry-order pins of three older proofs (test-studio-my-companions-wiring, test-studio-research-by-level, test-studio-upload-formats). Tests only.
//   node scripts/test-studio-pl54-registry-tolerance.mjs     Plain node: reads files and git, makes a throw-away git worktree in the temp folder for the simulations, no network, nothing in the repository is written.
//   A. the strip: the three proofs lose exactly their two marked lines and the registry its two rows, and each is the base's byte for byte; every other file is returned as it came; twice over changes nothing more;
//   B. the helper's pure parts: the registry rows are read (and a row it cannot read, or an anchor the registry lacks, THROWS); the later rows are taken out; env blocks come out as the registry takes them out;
//   C. the three proofs: exactly two marked lines each, an import and one call, the call before any read hook of their own, naming the last change each knows;
//   D. THE POINT: a made-up later change (never committed to the product) registered after the three proofs makes them red on the base (uat before this change) and leaves them green with this change, on one change, a change that
//      registers a scope row only, and two changes in a row; E. the tolerance keeps each proof honest about ITS OWN change; F. mutants: each is one edit of the real text, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as stripModule from './studio-pl54-registry-tolerance-strip.mjs'
import * as tolerance from './studio-registry-tolerance.mjs'
import * as registry from './studio-later-changes.mjs'

const { PL54_BASE_COMMIT: BASE, PL54_COMMIT_SUBJECT: SUBJECT, PL54_MARK: MARK, PL54_PIN_TEST_FILES: PINS, PL54_SCOPE_FILES: SCOPE, PL54_REGISTRY_LINES: REG_LINES } = stripModule
const STRIP_FN = stripModule.stripPl54RegistryTolerance
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const REGISTRY = 'scripts/studio-later-changes.mjs', HELPER = 'scripts/studio-registry-tolerance.mjs', ENV = '.env.example'
const TESTS = { 'my-companions-wiring': 'scripts/test-studio-my-companions-wiring.mjs', 'research-by-level': 'scripts/test-studio-research-by-level.mjs', 'upload-formats': 'scripts/test-studio-upload-formats.mjs' }
const KNOWN = { files: 'studio-pl42-locked-copy-strip.mjs', env: 'studio-upload-formats-strip.mjs', strips: 'studio-pl42-locked-copy-strip.mjs' }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const HEAD_SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() // the simulation worktree moves its own HEAD around: this one is the commit under test
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git(root, 'show', `${BASE}:${rel}`)); return baseCache.get(rel) }
const lineDiff = (was, now) => { const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1); const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) } const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line); return { added, removed } }

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 900)}`) }
}
let caught = 0
const missed = []
/** A mutant is caught only by a failed ASSERTION of a check. A mutant whose edit did not apply (SwapError) or that crashed some other way proves nothing and is reported as missed. */
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 200)})`) } else { caught++; console.log(`CAUGHT mutant ${label}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

// ============================================================================================================================================
// A. the strip
// ============================================================================================================================================
function stripChecks(strip = STRIP_FN, texts = {}) {
  const get = rel => texts[rel] ?? read(rel)
  for (const rel of PINS) {
    const now = get(rel), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's lines the proof is the base's, byte for byte`); assert.equal(strip(rel, strip(rel, now)), baseText(rel), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, 2], `${rel}: the proof gains two lines and loses none`)
    assert.ok(diff.added.every(line => line.includes(MARK)), `${rel}: both added lines carry the mark ${MARK}`)
  }
  const reg = get(REGISTRY), regDiff = lineDiff(baseText(REGISTRY), reg)
  assert.equal(strip(REGISTRY, reg), baseText(REGISTRY), 'the registry without this change\'s two rows is the base\'s, byte for byte'); assert.deepEqual(regDiff.removed, [], 'and loses none')
  assert.deepEqual(regDiff.added.sort(), REG_LINES.map(line => line.replace(/\n$/, '')).sort(), 'the two rows are the only lines it gains')
  for (const rel of ['app/builder/page.tsx', ENV, 'scripts/test-studio-chat-commands.mjs', HELPER, 'scripts/studio-pl54-registry-tolerance-strip.mjs']) assert.equal(strip(rel, `x\n${MARK}\n`), `x\n${MARK}\n`, `${rel}: a file this change does not teach comes back untouched, even with the mark in it`)
  assert.equal(strip(REGISTRY, 'x'), 'x'); assert.equal(strip('a.mjs', 5), 5); assert.equal(strip(REGISTRY, undefined), undefined)
}

// ============================================================================================================================================
// B. the helper's pure parts
// ============================================================================================================================================
const SAMPLE_REGISTRY = ['export const LATER_CHANGE_FILES = new Set([', "  ...(await import('./studio-a-strip.mjs')).A_SCOPE, // LATER-CHANGE: A", "  ...(await import('./studio-b-strip.mjs')).B_SCOPE, // LATER-CHANGE: B", "  ...(await import('./studio-c-strip.mjs')).C_SCOPE, // LATER-CHANGE: C", '  // one line per later change, above this comment', '])', '',
  'export const LATER_ENV_BLOCKS = [', "  (await import('./studio-a-strip.mjs')).A_ENV, // LATER-CHANGE: A", "  (await import('./studio-c-strip.mjs')).C_ENV, // LATER-CHANGE: C", '  // one line per later change, above this comment', ']', '',
  'export const LATER_STRIPS = [', "  (await import('./studio-a-strip.mjs')).stripA, // LATER-CHANGE: A", "  (await import('./studio-b-strip.mjs')).stripB, // LATER-CHANGE: B", "  (await import('./studio-c-strip.mjs')).stripC, // LATER-CHANGE: C", '  // one line per later change, above this comment', ']', ''].join('\n')
const SAMPLE_ANCHORS = { files: 'studio-a-strip.mjs', env: 'studio-a-strip.mjs', strips: 'studio-a-strip.mjs' }
function pureChecks(lib = tolerance) {
  const rows = lib.listRows(SAMPLE_REGISTRY, 'LATER_STRIPS')
  assert.deepEqual(rows.map(row => [row.module, row.name]), [['./studio-a-strip.mjs', 'stripA'], ['./studio-b-strip.mjs', 'stripB'], ['./studio-c-strip.mjs', 'stripC']], 'listRows reads the module and the name of each row, the end comment is not a row')
  assert.deepEqual(lib.laterRows(SAMPLE_REGISTRY, 'LATER_CHANGE_FILES', 'studio-a-strip.mjs').map(row => row.name), ['B_SCOPE', 'C_SCOPE'], 'laterRows: the rows after the anchor, not the anchor itself')
  assert.deepEqual(lib.laterRows(SAMPLE_REGISTRY, 'LATER_STRIPS', 'studio-c-strip.mjs'), [], 'the anchor on the last row: nothing is later')
  assert.throws(() => lib.laterRows(SAMPLE_REGISTRY, 'LATER_STRIPS', 'studio-zz-strip.mjs'), /no row names studio-zz-strip\.mjs/, 'an anchor the registry lacks throws (it never reads nothing silently)')
  assert.throws(() => lib.laterRows(SAMPLE_REGISTRY.replace("  (await import('./studio-c-strip.mjs')).stripC, // LATER-CHANGE: C", '  stripC, // LATER-CHANGE: C'), 'LATER_STRIPS', 'studio-a-strip.mjs'), /not in the registry's form/, 'a later row in another form throws')
  assert.throws(() => lib.listRows('export const LATER_STRIPS = [\n]\n', 'LATER_STRIPS'), /no LATER_STRIPS list/, 'a list with no end comment throws')
  const cut = lib.withoutLaterRows(SAMPLE_REGISTRY, SAMPLE_ANCHORS)
  assert.equal(cut, SAMPLE_REGISTRY.replace(/^.*studio-(b|c)-strip\.mjs.*\n/gm, ''), 'withoutLaterRows: every row after the anchor of each of the three lists goes, the others and the end comments stay')
  assert.equal(lib.withoutLaterRows(cut, SAMPLE_ANCHORS), cut, 'twice over changes nothing more'); assert.equal(lib.withoutLaterRows(SAMPLE_REGISTRY, { files: 'studio-zz.mjs', env: 'studio-zz.mjs', strips: 'studio-zz.mjs' }), SAMPLE_REGISTRY, 'a list whose anchor is not there is left as it is')
  const BLOCK = '# STUDIO ZZ\nNEXT_PUBLIC_ZZ="false"\n'
  for (const [name, text] of Object.entries({ 'in the middle': `A=1\n\n${BLOCK}\nB=2\n`, 'last, with its blank line': `A=1\n\n${BLOCK}`, 'last, no blank line': `A=1\n${BLOCK}`, 'with a leading blank line in the block': `A=1\n\n\n${BLOCK}`, 'twice (only the first)': `A=1\n\n${BLOCK}\n${BLOCK}` }))
    assert.equal(lib.withoutEnvBlocks(text, [BLOCK]), (() => { const saved = registry.LATER_ENV_BLOCKS.slice(); registry.LATER_ENV_BLOCKS.length = 0; registry.LATER_ENV_BLOCKS.push(BLOCK); try { return registry.stripLaterEnvBlocks(ENV, text) } finally { registry.LATER_ENV_BLOCKS.length = 0; registry.LATER_ENV_BLOCKS.push(...saved) } })(), `env block ${name}: the same text as the registry's own stripLaterEnvBlocks`)
  assert.equal(lib.withoutEnvBlocks('A=1\n# STUDIO ZZ\nNEXT_PUBLIC_ZZ="false"\nmore\n', ['# STUDIO ZZ\nNEXT_PUBLIC_ZZ="false"']), 'A=1\nmore\n', 'a whole block is taken out')
  assert.equal(lib.withoutEnvBlocks('A=1\n# STUDIO ZZ x\n', ['# STUDIO ZZ']), 'A=1\n# STUDIO ZZ x\n', 'a partial match is not a block and stays')
  const realRows = lib.listRows(read(REGISTRY), 'LATER_STRIPS')
  assert.ok(realRows.some(row => row.line.includes(KNOWN.strips)) && realRows.every(row => row.module !== null), 'the real registry: PL-42\'s row is there and every row of the list is in the registry\'s form')
  for (const [key, list] of Object.entries(tolerance.REGISTRY_LISTS)) assert.ok(lib.laterRows(read(REGISTRY), list, KNOWN[key]).length >= 0, `the real ${list} list has its anchor`)
}

// ============================================================================================================================================
// C. the three proofs
// ============================================================================================================================================
function wiringChecks(texts = {}) {
  for (const [name, rel] of Object.entries(TESTS)) {
    const text = texts[rel] ?? read(rel), lines = text.split('\n'), marked = lines.filter(line => line.includes(MARK))
    assert.equal(marked.length, 2, `${name}: exactly two marked lines`)
    assert.equal(marked.filter(line => line.startsWith("import { tolerateLaterChanges } from './studio-registry-tolerance.mjs'")).length, 1, `${name}: one is the import of the helper`)
    const calls = marked.filter(line => line.startsWith('await tolerateLaterChanges({ registry, root, known: '))
    assert.equal(calls.length, 1, `${name}: the other is one call`)
    for (const [key, anchor] of Object.entries(KNOWN)) assert.ok(calls[0].includes(`${key}: '${anchor}'`), `${name}: the call names the last known change of the ${key} list (${anchor})`)
    assert.equal(calls[0].includes('scopeSink: PL42_SCOPE_FILES'), name === 'research-by-level', `${name}: only research-by-level, whose whole-range scope check names sets, takes a scope sink`)
    const at = lines.indexOf(calls[0]), readAt = lines.findIndex(line => line.startsWith('const read = rel => fs.readFileSync(')), hookAt = lines.findIndex(line => line.includes('fs.readFileSync = function'))
    assert.ok(readAt >= 0 && at > readAt, `${name}: the call is after the proof's read`); assert.ok(hookAt === -1 || at < hookAt, `${name}: and before every read hook of the proof's own (this one is the innermost)`)
  }
}

// ============================================================================================================================================
// D. THE POINT: a made-up later change, simulated in a throw-away worktree
// ============================================================================================================================================
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pl54-sim-'))
const WT = path.join(tmpRoot, 'wt')
let simReady = false
function sim() {
  if (!simReady) {
    git(root, 'worktree', 'add', '--detach', WT, 'HEAD')
    const modules = path.join(root, 'node_modules'); fs.symlinkSync(fs.realpathSync(modules), path.join(WT, 'node_modules'))
    simReady = true
  }
  return WT
}
function cleanup() { try { if (simReady) git(root, 'worktree', 'remove', '--force', WT) } catch {} fs.rmSync(tmpRoot, { recursive: true, force: true }); try { git(root, 'worktree', 'prune') } catch {} }
process.on('exit', cleanup)
const APP_FILES = ['app/builder/page.tsx', 'components/builder/chat-input.tsx', 'next.config.mjs', 'lib/studio-thinking-levels.ts']
function addFake(dir, id, { full }) {
  const mod = `studio-${id}-fake-strip.mjs`, up = id.toUpperCase(), mark = `${up}-FAKE-LATER`, files = full ? [...APP_FILES, ENV, REGISTRY, `scripts/${mod}`] : [`lib/${id}-fake-new-file.ts`, REGISTRY, `scripts/${mod}`]
  const stripBody = full ? `const APP = new Set(${JSON.stringify(APP_FILES)})
export function strip${up}(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === '${REGISTRY}') return text.split('\\n').filter(line => !line.includes('${mod}')).join('\\n')
  return APP.has(rel) ? text.split('\\n').filter(line => !line.includes('${mark}')).join('\\n') : text
}
export const ${up}_ENV_BLOCK = '# ${up} FAKE LATER\\nNEXT_PUBLIC_${up}_FAKE_LATER="false"\\n'
` : ''
  fs.writeFileSync(path.join(dir, 'scripts', mod), `// a FAKE later change for the PL-54 proof: never committed to the product\nexport const ${up}_SCOPE = new Set(${JSON.stringify(files)})\n${stripBody}`)
  let reg = fs.readFileSync(path.join(dir, REGISTRY), 'utf8'); const END = '  // one line per later change, above this comment\n', parts = reg.split(END)
  assert.equal(parts.length, 4, 'the registry has three end comments')
  const rows = [`  ...(await import('./${mod}')).${up}_SCOPE, // LATER-CHANGE: ZZ, fake later change ${id} (NEXT_PUBLIC_${up}_FAKE_LATER)\n`, full ? `  (await import('./${mod}')).${up}_ENV_BLOCK, // LATER-CHANGE: ZZ, fake later change ${id}\n` : '', full ? `  (await import('./${mod}')).strip${up}, // LATER-CHANGE: ZZ, fake later change ${id}\n` : '']
  fs.writeFileSync(path.join(dir, REGISTRY), parts[0] + rows[0] + END + parts[1] + rows[1] + END + parts[2] + rows[2] + END + parts[3])
  if (full) { for (const rel of APP_FILES) { const p = path.join(dir, rel), s = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, `${s}${s.endsWith('\n') ? '' : '\n'}// ${mark}\n`) } const e = path.join(dir, ENV), s = fs.readFileSync(e, 'utf8'); fs.writeFileSync(e, `${s}${s.endsWith('\n') ? '' : '\n'}\n# ${up} FAKE LATER\nNEXT_PUBLIC_${up}_FAKE_LATER="false"\n`) } else fs.writeFileSync(path.join(dir, `lib/${id}-fake-new-file.ts`), `export const ${id} = 1\n`)
  git(dir, 'add', '-A'); git(dir, '-c', 'user.name=sim', '-c', 'user.email=sim@example.com', 'commit', '-q', '-m', `ZZ fake later change ${id}`)
}
/** The simulation state: the worktree at `rev`, clean, with the fake changes committed on it. */
function state(rev, fakes) {
  const dir = sim(); git(dir, 'reset', '-q', '--hard'); git(dir, 'clean', '-fdq'); git(dir, 'checkout', '-q', '--detach', rev)
  for (const [id, opts] of fakes) addFake(dir, id, opts)
  return dir
}
function runProof(dir, rel) { const out = spawnSync(process.execPath, [rel], { cwd: dir, encoding: 'utf8', timeout: 240_000, maxBuffer: 1 << 26 }); const text = `${out.stdout}\n${out.stderr}`; return { rc: out.status, text, fails: text.split('\n').filter(line => line.startsWith('FAIL ')).map(line => line.slice(5).split('.')[0]) } }
const runAll = dir => Object.fromEntries(Object.entries(TESTS).map(([name, rel]) => [name, runProof(dir, rel)]))
const summary = results => Object.fromEntries(Object.entries(results).map(([name, r]) => [name, r.rc === 0 ? 'green' : `red ${r.fails.join('')}`]))
const VARIANTS = { 'one full change (scope, env block, strip; four app files, .env.example)': [['zza', { full: true }]], 'a change that registers a scope row only (a new file)': [['zzb', { full: false }]], 'two full changes and a scope-only one in a row': [['zza', { full: true }], ['zzb', { full: false }], ['zzc', { full: true }]] }
// what the proofs said on the base (uat before this change) with that made-up change: the labels of the failed checks (A: strips and untouched files; C: insertions/pins; D: .env.example; E: the registry order; F: scope)
const RED_ON_BASE = { 'one full change (scope, env block, strip; four app files, .env.example)': { 'my-companions-wiring': 'red A', 'research-by-level': 'red CDEF', 'upload-formats': 'red CDE' }, 'a change that registers a scope row only (a new file)': { 'my-companions-wiring': 'green', 'research-by-level': 'red EF', 'upload-formats': 'red CE' }, 'two full changes and a scope-only one in a row': { 'my-companions-wiring': 'red A', 'research-by-level': 'red CDEF', 'upload-formats': 'red CDE' } }
const simResults = {}
function simulate(variant) {
  if (simResults[variant]) return simResults[variant]
  const fakes = VARIANTS[variant]
  const base = summary(runAll(state(BASE, fakes))), now = summary(runAll(state(HEAD_SHA, fakes)))
  return (simResults[variant] = { base, now })
}

// ============================================================================================================================================
// the checks
// ============================================================================================================================================
await check('A. the strip: the three proofs and the registry are the base\'s without this change\'s lines; nothing else is touched', () => stripChecks())
await check('B. the helper reads the registry rows (a row it cannot read, or an anchor it lacks, throws), takes the later rows and env blocks out as the registry does', () => pureChecks())
await check('C. each of the three proofs has two marked lines, an import and one call before its own read hooks, naming the last change it knows', () => wiringChecks())
await check('C2. scope: every file this change\'s commits touch is named by its scope set', () => {
  assert.deepEqual([...SCOPE].sort(), [...PINS, HELPER, 'scripts/studio-pl54-registry-tolerance-strip.mjs', 'scripts/test-studio-pl54-registry-tolerance.mjs', REGISTRY].sort(), 'the scope set is the three proofs, the helper, the strip, this proof and the registry')
  const commits = git(root, 'log', '--format=%H %s', `${BASE}..HEAD`).split('\n').filter(Boolean).filter(line => SUBJECT.test(line.slice(41)))
  if (commits.length === 0) { console.log('NOTE scope: no commit of this change on the range (not committed yet, or squash merged): the strip, source and wiring checks cover the files'); return }
  const touched = new Set(commits.flatMap(line => git(root, 'show', '--name-only', '--format=', line.slice(0, 40)).split('\n').filter(Boolean)))
  assert.deepEqual([...touched].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside the scope')
  assert.ok(registry.LATER_CHANGE_FILES.has(HELPER) && [...SCOPE].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'the registry names every scope file')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered')
})
for (const variant of Object.keys(VARIANTS)) {
  await check(`D. a made-up later change: ${variant}: red on the base, green with this change`, () => {
    const { base, now } = simulate(variant)
    assert.deepEqual(base, RED_ON_BASE[variant], 'on the base (uat before this change) the made-up change turns the older proofs red')
    assert.deepEqual(now, { 'my-companions-wiring': 'green', 'research-by-level': 'green', 'upload-formats': 'green' }, 'with this change all three are green')
  })
}
const FULL = [['zza', { full: true }]]
await check('E. the tolerance keeps each proof honest about its own change: its own row gone, a stray edit, an unreadable later row and a missing anchor still fail', () => {
  const dir = state(HEAD_SHA, FULL), file = rel => path.join(dir, rel), revert = () => git(dir, 'checkout', '-q', '--', '.')
  const reg = fs.readFileSync(file(REGISTRY), 'utf8')
  fs.writeFileSync(file(REGISTRY), reg.split('\n').filter(line => !(line.includes('studio-research-by-level-strip.mjs') && line.includes('stripResearchByLevel'))).join('\n'))
  let r = runProof(dir, TESTS['research-by-level']); assert.ok(r.rc !== 0 && r.fails.includes('E'), `its own strip row gone: the proof fails its registry check (${r.fails})`); revert()
  const page = fs.readFileSync(file('app/builder/page.tsx'), 'utf8'); fs.writeFileSync(file('app/builder/page.tsx'), `${page}// a stray edit that is no change's\n`)
  r = runProof(dir, TESTS['research-by-level']); assert.ok(r.rc !== 0 && r.fails.includes('C'), `a stray line in the page: still caught (${r.fails})`); revert()
  fs.writeFileSync(file(REGISTRY), reg.replace("  (await import('./studio-zza-fake-strip.mjs')).stripZZA, // LATER-CHANGE: ZZ, fake later change zza\n", "  (await import('./studio-zza-fake-strip.mjs')).stripZZA ?? null, // LATER-CHANGE: ZZ, fake later change zza\n"))
  r = runProof(dir, TESTS['my-companions-wiring']); assert.ok(r.rc !== 0 && /not in the registry's form/.test(r.text), 'a later row the helper cannot read stops the proof loudly'); revert()
  fs.writeFileSync(file(REGISTRY), reg.split('\n').filter(line => !line.includes('studio-pl42-locked-copy-strip.mjs')).join('\n'))
  r = runProof(dir, TESTS['upload-formats']); assert.ok(r.rc !== 0 && /no row names studio-pl42-locked-copy-strip\.mjs/.test(r.text), 'an anchor the registry lacks stops the proof loudly'); revert()
})

// ============================================================================================================================================
// F. mutants
// ============================================================================================================================================
const HELPER_TEXT = read(HELPER)
const fromHelper = async text => { const file = path.join(tmpRoot, `mut-${Math.random().toString(36).slice(2)}.mjs`); fs.writeFileSync(file, text); return import(pathToFileURL(file).href) }
const viaSim = (name, edited, fakes = FULL) => { const dir = state(HEAD_SHA, fakes); fs.writeFileSync(path.join(dir, HELPER), edited); const r = runProof(dir, TESTS[name]); git(dir, 'checkout', '-q', '--', '.'); assert.equal(r.rc, 0, `${name} is green with the helper as written (red: ${r.fails})`) }
await mutant('helper: the strips of later changes are not applied on a read', () => viaSim('my-companions-wiring', swap(HELPER_TEXT, 'for (const strip of laterStrips) {', 'for (const strip of []) {')))
await mutant('helper: later env blocks are not taken out of .env.example', () => viaSim('research-by-level', swap(HELPER_TEXT, "if (rel === '.env.example') text = withoutEnvBlocks(text, laterBlocks)", '')))
await mutant('helper: later rows are not taken out of the registry text (a change with no strip of its own)', () => viaSim('research-by-level', swap(HELPER_TEXT, 'if (rel === REGISTRY_REL) text = withoutLaterRows(text, known)', ''), [['zzb', { full: false }]]))
await mutant('helper: the registry arrays are not cut after the known entry', () => viaSim('upload-formats', swap(HELPER_TEXT, 'array.length = array.length - rows.length', '')))
await mutant('helper: the later scope files are not added to the sink', () => viaSim('research-by-level', swap(HELPER_TEXT, 'if (scopeSink) for (const rel of laterScopeFiles) scopeSink.add(rel)', '')))
await mutant('helper: the known entry is cut with the later ones (off by one)', () => viaSim('upload-formats', swap(HELPER_TEXT, 'const later = rows.slice(at + 1)', 'const later = rows.slice(at)')))
await mutant('helper (pure): an anchor the registry lacks reads as nothing', async () => pureChecks(await fromHelper(swap(HELPER_TEXT, "if (at === -1) throw new Error(`${list}: no row names ${anchor} (the last change this proof knows)`)", ''))))
await mutant('helper (pure): a later row in another form is skipped', async () => pureChecks(await fromHelper(swap(HELPER_TEXT, 'if (unreadable.length) throw', 'if (false) throw'))))
await mutant('helper (pure): the later rows stay in the registry text', async () => pureChecks(await fromHelper(swap(HELPER_TEXT, 'const drop = new Set(rows.slice(at + 1).map(row => row.index))', 'const drop = new Set()'))))
await mutant('helper (pure): an env block is taken out by plain replace (a partial match too)', async () => pureChecks(await fromHelper(swap(HELPER_TEXT, 'while (at !== -1 && !(lineStart(out, at) && lineEnd(out, at + block.length))) at = out.indexOf(block, at + 1)', ''))))
await mutant('strip: one of the three proofs keeps a marked line', () => stripChecks(STRIP_FN, { [TESTS['upload-formats']]: read(TESTS['upload-formats']).replace(/^.*PL-54-TOLERANCE.*\n/m, '') }))
await mutant('strip: a registry row is missing', () => stripChecks(STRIP_FN, { [REGISTRY]: read(REGISTRY).replace(REG_LINES[0], '') }))
await mutant('strip: it takes the mark out of every file, not only the three proofs', () => stripChecks((rel, text) => typeof text === 'string' ? text.split('\n').filter(line => !line.includes(MARK)).join('\n') : text))
await mutant('wiring: a proof loses its call', () => wiringChecks({ [TESTS['research-by-level']]: read(TESTS['research-by-level']).replace(/^await tolerateLaterChanges.*\n/m, '') }))
await mutant('wiring: the call is after the proof\'s own read hooks', () => { const rel = TESTS['my-companions-wiring'], lines = read(rel).split('\n'), at = lines.findIndex(line => line.startsWith('await tolerateLaterChanges')), hook = lines.findIndex(line => line.includes('fs.readFileSync = function')); const [call] = lines.splice(at, 1); lines.splice(hook + 1, 0, call); wiringChecks({ [rel]: lines.join('\n') }) })
await mutant('wiring: the call names the wrong last known change', () => wiringChecks({ [TESTS['upload-formats']]: read(TESTS['upload-formats']).replace("strips: 'studio-pl42-locked-copy-strip.mjs'", "strips: 'studio-upload-formats-strip.mjs'") }))

if (!process.env.CHECK_ONLY) { console.log(`\n${passed} checks passed, ${failed.length} failed; mutants ${caught} caught, ${missed.length} missed`); if (failed.length || missed.length) process.exit(1) } else if (failed.length) process.exit(1)
