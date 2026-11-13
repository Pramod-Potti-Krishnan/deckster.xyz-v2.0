// FRONTEND-1 (production frontend audit, P-17, Present mode Exit): proof of NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX (exact "true", default off, build-time).
//
// THE DEFECT (components/presentation-viewer.tsx handleFullscreen; lib/studio-present-exit.ts has the root cause, reproduced on the real Builder): Exit is a toggle that reads the BROWSER's fullscreenElement. The page's Present mode
// (isFullscreen) and the browser can disagree; then Exit takes the enter branch, asks for fullscreen again, and the page stays in Present. With the flag on, "page presenting and browser not full screen" leaves Present.
//
//   1. The lib, function by function: the flag, the desync rule (the whole truth table, odd values), leaving the browser's fullscreen (only while it is in fullscreen, a refusal swallowed).
//   2. The viewer's three marked lines: the check sits first inside the toggle's try, before the original branch; it waits for the browser, then sets the page's state and returns; the callback depends on isFullscreen; the viewer does not read the env.
//
//   3. The sources: every marked line, the strip gives each touched file its base back byte for byte, the registry, .env.example, the scope (read from the
//      COMMITTED diff BASE..HEAD only, never the working tree), the commits.
//   4. Mutants: each must be caught.
//
//   node scripts/test-studio-audit-present-exit.mjs
//
// Offline: no socket or fetch (the harness's host network guard is installed); git is read only for 3.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

setTimeout(() => { process.stderr.write('[watchdog] test-studio-audit-present-exit stalled for 240 s; exit 124\n'); process.exit(124) }, Number(process.env.STUDIO_PROOF_TRACE_WATCHDOG_MS) || 240_000).unref()

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const STRIP = 'scripts/studio-audit-present-exit-strip.mjs'
const SELF = 'scripts/test-studio-audit-present-exit.mjs'
const REGISTRY = 'scripts/studio-later-changes.mjs'
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')
let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}
/** True when `fn` (sync or async) throws. */
async function throws(fn) { try { await fn(); return false } catch { return true } }

const { installHostNetworkGuard } = await import('./studio-chat-harness/fake-env.mjs')
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-audit-present-exit-strip.mjs')
const { BASE_COMMIT, AUDIT_PRESENT_EXIT_FILES: TOUCHED, AUDIT_PRESENT_EXIT_NEW_FILES: NEW_FILES, AUDIT_PRESENT_EXIT_SCOPE_FILES: SCOPE_FILES, AUDIT_PRESENT_EXIT_ENV_BLOCK: ENV_BLOCK, AUDIT_PRESENT_EXIT_SUBJECT: SUBJECT, AUDIT_PRESENT_EXIT_MARKER_RE: MARKER_RE, AUDIT_PRESENT_EXIT_EDITS: EDITS } = stripModule
const STRIP_FN = stripModule.stripAuditPresentExit
const release = installHostNetworkGuard(net, dns)
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }
const plain = value => JSON.parse(JSON.stringify(value)) // values built inside a vm have their own prototypes

// ---- an import-free lib, evaluated in THIS realm with a fake process -------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function loadLib(rel, text = read(rel), env = {}) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', 'process', compile(text, rel))(module, module.exports, () => { throw new Error(`${rel} must stay import-free`) }, { env })
  return module.exports
}
const tick = () => new Promise(resolve => setImmediate(resolve))

// ============================================================================================================================================
// 1. The lib
// ============================================================================================================================================
const LIB = 'lib/studio-present-exit.ts'
const VIEWER = 'components/presentation-viewer.tsx'
const FLAG = 'NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX'
async function libChecks(libText = read(LIB)) {
  const lib = loadLib(LIB, libText, { [FLAG]: 'true' })
  // -- the flag --------------------------------------------------------------------------------------------------------------------------
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['', false], ['yes', false], ['true', true]]) assert.equal(lib.presentExitFixOn(value), want, `flag ${JSON.stringify(value)}`)
  assert.equal(loadLib(LIB, libText, {}).STUDIO_PRESENT_EXIT_FIX_ENABLED, false, 'unset: off')
  assert.equal(loadLib(LIB, libText, { [FLAG]: 'true' }).STUDIO_PRESENT_EXIT_FIX_ENABLED, true, '"true": on')
  assert.equal(loadLib(LIB, libText, { [FLAG]: 'on' }).STUDIO_PRESENT_EXIT_FIX_ENABLED, false, '"on": off')
  // -- the desync rule: only (flag on, page presenting, browser not full screen) ------------------------------------------------------------
  for (const enabled of [true, false]) for (const page of [true, false]) for (const browser of [true, false]) {
    assert.equal(lib.presentExitDesynced(enabled, page, browser), enabled && page && !browser, `desynced(${enabled}, ${page}, ${browser})`)
  }
  assert.equal(lib.presentExitDesynced(true, true, undefined), true, 'a browser that does not report fullscreen at all counts as not full screen')
  for (const odd of ['true', 1, 'yes', null, undefined, {}]) {
    assert.equal(lib.presentExitDesynced(odd, true, false), false, `flag ${JSON.stringify(odd)} is not the boolean true`)
    assert.equal(lib.presentExitDesynced(true, odd, false), false, `page state ${JSON.stringify(odd)} is not the boolean true`)
  }
  // -- leaving the browser's fullscreen ------------------------------------------------------------------------------------------------------
  const calls = []
  const doc = (over = {}) => ({ fullscreenElement: {}, exitFullscreen: async () => { calls.push('exit') }, ...over })
  calls.length = 0; await lib.leaveBrowserFullscreen(doc()); assert.deepEqual(calls, ['exit'], 'in fullscreen: the browser is asked to leave, once')
  calls.length = 0; await lib.leaveBrowserFullscreen(doc({ fullscreenElement: null })); assert.deepEqual(calls, [], 'not in fullscreen: nothing is asked (it would reject)')
  calls.length = 0; await lib.leaveBrowserFullscreen(doc({ fullscreenElement: undefined })); assert.deepEqual(calls, [], 'fullscreen not reported: nothing is asked')
  const refuse = () => { const rejected = Promise.reject(new TypeError('Document not active')); rejected.catch(() => {}); return rejected } // handled for node, still a rejection for whoever awaits it (a mutant that does not await must not crash the proof)
  assert.equal(await lib.leaveBrowserFullscreen(doc({ exitFullscreen: refuse })), undefined, 'a refusal is swallowed')
  assert.equal(await lib.leaveBrowserFullscreen(doc({ exitFullscreen: () => { throw new Error('sync') } })), undefined, 'a synchronous throw is swallowed')
  assert.equal(await lib.leaveBrowserFullscreen(doc({ exitFullscreen: undefined })), undefined, 'no exitFullscreen at all (an old browser) does not throw')
  assert.equal(await lib.leaveBrowserFullscreen(doc({ exitFullscreen: 'nope' })), undefined, 'a non-function exitFullscreen does not throw')
  let finished = false
  await lib.leaveBrowserFullscreen(doc({ exitFullscreen: () => new Promise(resolve => setTimeout(() => { finished = true; resolve() }, 5)) }))
  assert.equal(finished, true, 'it waits for the browser before the page sets its own state')
}

// ============================================================================================================================================
// 2. The viewer's marked lines
// ============================================================================================================================================
function viewerChecks(text = read(VIEWER)) {
  const lines = text.split('\n'), marked = lines.filter(line => MARKER_RE.test(line))
  assert.equal(marked.length, 3, 'the viewer carries the marker on three lines: the import, the ref line, the check')
  const at = lines.findIndex(line => line.includes('presentExitDesynced('))
  assert.ok(at > 0, 'the check is there')
  assert.equal(lines[at - 1], '    try {', 'the check is the first thing inside the toggle\'s try')
  assert.equal(lines[at + 1], '      if (!document.fullscreenElement) {', 'the original toggle follows it untouched')
  assert.ok(lines.slice(0, at).reverse().find(line => line.startsWith('  const handleFullscreen = useCallback(')), 'the check is in handleFullscreen')
  assert.match(lines[at], /^      if \(presentExitDesynced\(STUDIO_PRESENT_EXIT_FIX_ENABLED, isFullscreenRef\.current, Boolean\(document\.fullscreenElement\)\)\) \{ await leaveBrowserFullscreen\(document\); if \(!isCurrent\(\)\) return; setIsFullscreen\(false\); return \} \/\/ AUDIT-PRESENT-EXIT: /, 'the check reads the flag, the page state and the browser, waits for the browser, then sets the page state and returns')
  assert.ok(text.includes("  const [isFullscreen, setIsFullscreen] = useState(false)\n  const isFullscreenRef = useRef(isFullscreen); isFullscreenRef.current = isFullscreen // AUDIT-PRESENT-EXIT: "), 'the ref follows the page\'s own state, right after it is declared (so the toggle never reads a stale value)')
  assert.ok(text.includes("\n  }, [studioShell, isEditMode, onEditModeChange, isGridActive, isBordersActive, beginStudioViewerInteraction])\n"), 'the toggle\'s dependency list is the base\'s (the callback is not rebuilt for the flag)')
  assert.match(text, /^import \{ STUDIO_PRESENT_EXIT_FIX_ENABLED, presentExitDesynced, leaveBrowserFullscreen \} from '@\/lib\/studio-present-exit' \/\/ AUDIT-PRESENT-EXIT$/m, 'the viewer imports the lib')
  assert.equal(text.includes('process.env.NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX'), false, 'the viewer does not read the env itself')
}



// ============================================================================================================================================
// 3. The sources
// ============================================================================================================================================
/** The strips of the changes registered after this one come out first (none today): a later change that touches these files must not hide this change's edits from the identity check. */
const laterStrips = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }
/** The older proofs this change teaches (their first-parent scope checks leave the commits whose subject starts "Audit fix:" out). */
const PIN_FILES = ['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs']
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/
/** The lines added to and removed from `was` to make `now` (a multiset difference by line). */
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}
/** The base lines this change rewrites, per file: the `was` side of its [has, was] pairs. */
const rewritten = (edits, rel) => new Set((edits[rel] || []).flatMap(([, was]) => was.split('\n')).filter(line => line !== ''))

/** The checks on the files as given: `texts` (rel -> text); `mod` is the strip module under test. */
function sourceChecks(texts, mod = stripModule) {
  const strip = mod.stripAuditPresentExit, edits = mod.AUDIT_PRESENT_EXIT_EDITS, files = mod.AUDIT_PRESENT_EXIT_FILES, block = mod.AUDIT_PRESENT_EXIT_ENV_BLOCK
  // the strip gives each touched file its base back, byte for byte, and is idempotent
  for (const rel of files) {
    const now = laterStrips(rel, texts[rel]), out = strip(rel, now)
    assert.equal(out, baseText(rel), `${rel}: without this change's edits the file is the base's, byte for byte`)
    assert.equal(strip(rel, out), out, `${rel}: stripping twice changes nothing more`)
    assert.notEqual(now, baseText(rel), `${rel}: the change is there to strip`)
  }
  for (const rel of ['app/builder/page.tsx', 'components/builder/message-list.tsx', '.env.example', REGISTRY]) assert.equal(strip(rel, 'x\nAUDIT-PRESENT-EXIT\n'), 'x\nAUDIT-PRESENT-EXIT\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(strip(files[0], 5), 5, 'a text that is not a string comes back as it is')
  // every line a file gains carries the marker; the only base lines lost are the ones this change rewrites (its pairs' `was` lines), all of them
  for (const rel of files) {
    const diff = lineDiff(baseText(rel), laterStrips(rel, texts[rel])), allowed = rewritten(edits, rel)
    for (const line of diff.added) assert.match(line, MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    for (const line of diff.removed) assert.ok(allowed.has(line), `${rel}: a base line is lost that this change does not rewrite: ${line.trim().slice(0, 100)}`)
    assert.equal(diff.removed.length, (edits[rel] || []).flatMap(([, was]) => was.split('\n')).filter(line => line !== '').length, `${rel}: the base lines this change rewrites (all of them, no other)`)
  }
  // the older proofs this change teaches: each gains one marked line (the first-parent walk leaves this change's commits out) and is the base's without it
  assert.deepEqual([...mod.AUDIT_PRESENT_EXIT_PIN_FILES].sort(), PIN_FILES, 'the older proofs this change teaches')
  for (const rel of PIN_FILES) {
    const now = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's line the proof is the base's, byte for byte`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, 1], `${rel}: the proof gains one line and loses none`)
    assert.ok(diff.added[0].includes(mod.AUDIT_PRESENT_EXIT_PIN_MARK) && diff.added[0].includes('^Audit fix:'), `${rel}: the line carries the pin mark and names this change's subject`)
  }
  // the voice-call proof: its four-line after-merge edit is in dev since 506bcbb3, so it is the base's own text and this change carries no edit of it (nothing to pin here)
  // the new libs: import-free, one literal env read each (nothing else reads the flag)
  for (const [rel, flag] of mod.AUDIT_PRESENT_EXIT_LIB_FLAGS) {
    assert.equal((texts[rel].match(new RegExp(`process\\.env\\.${flag}\\b`, 'g')) || []).length, 1, `${rel} reads the literal env name ${flag} once`)
    assert.deepEqual([...texts[rel].matchAll(/^import .*$/gm)].map(m => m[0]), [], `${rel} is import-free`)
    for (const other of [...files, ...mod.AUDIT_PRESENT_EXIT_NEW_FILES.filter(f => /^(hooks|components)\//.test(f))]) assert.equal((texts[other] || '').includes(`process.env.${flag}`), false, `${other} does not read ${flag} itself`)
  }
  // .env.example: the base plus the block (after one blank line); every flag documented "false", once
  assert.equal(texts['.env.example'], `${baseText('.env.example')}\n${block}`, '.env.example is the base plus the block')
  for (const flag of mod.AUDIT_PRESENT_EXIT_FLAGS) {
    assert.match(block, new RegExp(`^${flag}="false"$`, 'm'), `the block documents ${flag} as "false"`)
    assert.equal((texts['.env.example'].match(new RegExp(`^${flag}=`, 'gm')) || []).length, 1, `.env.example assigns ${flag} once`)
  }
  assert.ok(block.endsWith('\n') && block.split('\n').filter(line => line && !line.startsWith('#')).length === mod.AUDIT_PRESENT_EXIT_FLAGS.length, 'the block is comments and one assignment per flag')
}

/** The registry checks on the registry's text. */
function registryChecks(text, texts = TEXTS) {
  const { AUDIT_PRESENT_EXIT_SCOPE_FILES: scope, AUDIT_PRESENT_EXIT_ENV_BLOCK: block } = stripModule
  for (const list of ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS']) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n'), own = rows.findIndex(line => line.includes('studio-audit-present-exit-strip.mjs')), voice = rows.findIndex(line => line.includes('studio-voice-call-strip.mjs'))
    assert.ok(own > voice && voice > 0, `${list}: this change's line comes after the voice call's`)
    assert.equal((text.slice(start, end).match(/studio-audit-present-exit-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-audit-present-exit-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes('// LATER-CHANGE: FRONTEND-1, audit P-17, Present Exit leaves Present when the browser is not full screen')), 'each carries the registry marker')
  assert.deepEqual(lineDiff(baseText(REGISTRY), text).removed, [], 'and loses none')
  assert.equal(lineDiff(baseText(REGISTRY), text).added.filter(line => registered.includes(line)).length, 3, 'the three lines are what it gains (a change registered later adds its own)')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(block), 'the block is registered')
  assert.ok([...scope].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  for (const rel of TOUCHED) assert.equal(registry.stripLaterChanges(rel, texts[rel]), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(stripModule.AUDIT_PRESENT_EXIT_FLAGS.some(flag => registry.stripLaterEnvBlocks('.env.example', texts['.env.example']).includes(flag)), false, 'the registry takes the block out of .env.example')
}

/** This change's own commits, found by SUBJECT across `rev-list --no-merges` (so a merge of dev does not hide or add any). */
function ownCommits(ref = 'HEAD') { return git('rev-list', '--no-merges', `${BASE_COMMIT}..${ref}`).split('\n').filter(Boolean).filter(commit => git('log', '-1', '--format=%s', commit).startsWith(SUBJECT)) }
/** The files that differ from the base: what this change's own commits touch, that the COMMITTED diff BASE..HEAD still shows (a file put back to the base nets to nothing). Nothing is read from the working tree, the index or the untracked files: a polluted tree must not fail the scope check. */
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE_FILES.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
/** What is wrong with one commit message (an empty list: nothing). */
function messageProblems(subject, body) {
  const problems = []
  if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`)
  if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line')
  return problems
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
const TEXTS = Object.fromEntries([...TOUCHED, ...NEW_FILES, '.env.example', REGISTRY, ...PIN_FILES].map(rel => [rel, read(rel)]))

await check('1. the lib: the flag, the desync rule (whole truth table, odd values), leaving the browser\'s fullscreen', () => libChecks())
await check('2. the viewer: the check is the first thing in the toggle\'s try, waits for the browser, sets the page state and returns; the page state is read through a ref that follows isFullscreen; no env read', () => viewerChecks())

await check('3a. the strip gives every touched file its base back byte for byte; every marked line is where it should be; the libs, the flag reads, the older proofs\' pin lines and .env.example', () => sourceChecks(TEXTS))
await check('3b. the registry names this change in all three lists (strip, block, files) and loses nothing; read through it, the files are the base\'s', () => registryChecks(TEXTS[REGISTRY]))
await check('3c. the scope: every file that differs from the base (own commits, edited, new) is this change\'s; the own commits carry the subject and the co-author line; no secret-shaped literal in the new files', () => {
  const own = ownCommits()
  scopeCheck(own)
  assert.deepEqual(NEW_FILES.filter(rel => !fs.existsSync(path.join(repo, rel))), [], 'the new files exist')
  if (git('status', '--porcelain').trim() === '') assert.ok(own.length >= 1, `a clean tree has this change committed (commits whose subject starts "${SUBJECT}")`)
  for (const commit of own) assert.deepEqual(messageProblems(git('log', '-1', '--format=%s', commit).trim(), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
  for (const rel of [...NEW_FILES, '.env.example']) assert.doesNotMatch(read(rel), SECRET, `${rel}: no secret-shaped literal`)
})

// ============================================================================================================================================
// 4. Mutants: each must be caught
// ============================================================================================================================================
const mutate = (text, from, to, name) => { assert.equal(text.split(from).length - 1, 1, `mutant "${name}": the text to change is there exactly once`); return text.replace(from, () => to) }
const dataModule = text => import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)

const LIB_TEXT = TEXTS[LIB], VIEWER_TEXT = TEXTS[VIEWER]
const LIB_MUTANTS = [
  ['the flag accepts "1"', "return value === 'true'", "return value === 'true' || value === '1'"],
  ['the flag is always on', "return value === 'true'", 'return true'],
  ['the desync rule ignores the flag', 'return enabled === true && pagePresenting === true && browserFullscreen !== true', 'return pagePresenting === true && browserFullscreen !== true'],
  ['the desync rule ignores the page state', 'return enabled === true && pagePresenting === true && browserFullscreen !== true', 'return enabled === true && browserFullscreen !== true'],
  ['the desync rule fires while the browser IS full screen', 'return enabled === true && pagePresenting === true && browserFullscreen !== true', 'return enabled === true && pagePresenting === true'],
  ['the desync rule accepts a truthy flag', 'return enabled === true && pagePresenting === true && browserFullscreen !== true', 'return Boolean(enabled) && pagePresenting === true && browserFullscreen !== true'],
  ['leaving asks the browser even when it is not in fullscreen', 'if (doc.fullscreenElement && typeof doc.exitFullscreen === \'function\') await doc.exitFullscreen()', 'if (typeof doc.exitFullscreen === \'function\') await doc.exitFullscreen()'],
  ['leaving does not wait for the browser', 'await doc.exitFullscreen()', 'doc.exitFullscreen()'],
  ['leaving lets a refusal through', '  } catch {\n    // The page leaves Present anyway.\n  }', '  } finally {\n  }'],
  ['leaving never asks the browser', "if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') await doc.exitFullscreen()", ''],
  ['the lib imports something', 'export function presentExitFixOn', "import { x } from '@/lib/x'\nexport function presentExitFixOn"],
]
for (const [name, from, to] of LIB_MUTANTS) {
  await check(`mutant caught: lib: ${name}`, async () => {
    const mutant = mutate(LIB_TEXT, from, to, name)
    assert.ok(await throws(async () => { await libChecks(mutant); sourceChecks({ ...TEXTS, [LIB]: mutant }) }), 'sections 1 and 3 must fail')
  })
}
const VIEWER_MUTANTS = [
  ['the check does not wait for the browser', 'await leaveBrowserFullscreen(document); if (!isCurrent()) return; setIsFullscreen(false); return }', 'leaveBrowserFullscreen(document); if (!isCurrent()) return; setIsFullscreen(false); return }'],
  ['the check never sets the page state', 'setIsFullscreen(false); return } // AUDIT-PRESENT-EXIT', 'return } // AUDIT-PRESENT-EXIT'],
  ['the check does not return (the toggle would run too)', 'setIsFullscreen(false); return } // AUDIT-PRESENT-EXIT', 'setIsFullscreen(false) } // AUDIT-PRESENT-EXIT'],
  ['the check reads true instead of the flag', 'presentExitDesynced(STUDIO_PRESENT_EXIT_FIX_ENABLED,', 'presentExitDesynced(true,'],
  ['the check reads a stale page state', 'presentExitDesynced(STUDIO_PRESENT_EXIT_FIX_ENABLED, isFullscreenRef.current,', 'presentExitDesynced(STUDIO_PRESENT_EXIT_FIX_ENABLED, false,'],
  ['the ref is never updated', 'isFullscreenRef.current = isFullscreen // AUDIT-PRESENT-EXIT', '// AUDIT-PRESENT-EXIT'],
  ['the ref is declared away from the state', "  const isFullscreenRef = useRef(isFullscreen); isFullscreenRef.current = isFullscreen // AUDIT-PRESENT-EXIT", "  const unrelated = 1\n  const isFullscreenRef = useRef(isFullscreen); isFullscreenRef.current = isFullscreen // AUDIT-PRESENT-EXIT"],
  ['the dependency list is rewritten again', '  }, [studioShell, isEditMode, onEditModeChange, isGridActive, isBordersActive, beginStudioViewerInteraction])\n', '  }, [studioShell, isEditMode, onEditModeChange, isGridActive, isBordersActive, beginStudioViewerInteraction, isFullscreen])\n'],
  ['the check sits after the toggle (not first in the try)', '    try {\n      if (presentExitDesynced(', '    try {\n      const first = 1\n      if (presentExitDesynced('],
  ['the flag is read from the env by the viewer', 'presentExitDesynced(STUDIO_PRESENT_EXIT_FIX_ENABLED,', 'presentExitDesynced(process.env.NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX === "true",'],
  ['the check line loses its marker', ' // AUDIT-PRESENT-EXIT: the page says presenting', ' // the page says presenting'],
]
for (const [name, from, to] of VIEWER_MUTANTS) {
  await check(`mutant caught: viewer: ${name}`, async () => {
    const mutant = mutate(VIEWER_TEXT, from, to, name)
    assert.ok(await throws(() => { viewerChecks(mutant); sourceChecks({ ...TEXTS, [VIEWER]: mutant }) }), 'sections 2 and 3 must fail')
  })
}

// -- the sources: a marked file edited without its pair, an unmarked extra line, a lost marker, the flags on by default, the older proofs' pin lines
for (const rel of TOUCHED) {
  await check(`mutant caught: ${rel}: an unmarked line added, the first marked line losing its marker, a base line lost`, async () => {
    const text = TEXTS[rel], lines = text.split('\n'), first = lines.findIndex(line => MARKER_RE.test(line))
    assert.ok(first >= 0)
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: `${text}// stray\n` })), 'an unmarked extra line')
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: lines.map((line, at) => at === first ? line.replace(MARKER_RE, 'OTHER-MARK') : line).join('\n') })), 'a lost marker')
    const baseLines = baseText(rel).split('\n'), drop = baseLines.findIndex(line => line.trim() !== '' && !EDITS[rel].some(([, was]) => was.includes(line)))
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: lines.filter(line => line !== baseLines[drop]).join('\n') })), 'a base line lost')
  })
}
await check('mutant caught: a taught proof with an unmarked extra line, or without this change\'s line', async () => {
  for (const rel of PIN_FILES) {
    const text = TEXTS[rel]
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: text + '// stray\n' })), 'an unmarked extra line')
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: text.split('\n').filter(line => !line.includes('registry read (AUDIT-PRESENT-EXIT)')).join('\n') })), 'the line removed (the proof would fail on this change\'s own commits)')
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: text.replace('registry read (AUDIT-PRESENT-EXIT)', 'registry read (OTHER)') })), 'the pin mark changed')
  }
})
await check('mutant caught: .env.example with a flag on by default, or the block missing', async () => {
  for (const flag of stripModule.AUDIT_PRESENT_EXIT_FLAGS) assert.ok(await throws(() => sourceChecks({ ...TEXTS, '.env.example': TEXTS['.env.example'].replace(`${flag}="false"`, `${flag}="true"`) })), `${flag} true by default`)
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, '.env.example': baseText('.env.example') })))
})
const STRIP_TEXT = read(STRIP)
const STRIP_MUTANTS = [
  ['the strip puts nothing back', 'return putBackAuditPresentExit(rel, text)', 'return text'],
  ['the strip touches a file it does not own', 'if (!(rel in AUDIT_PRESENT_EXIT_EDITS) && !(rel in AUDIT_PRESENT_EXIT_PIN_EDITS)) return text', "if (rel === 'app/builder/page.tsx') return text.toUpperCase()"],
  ['the strip does not know the older proofs', 'if (!(rel in AUDIT_PRESENT_EXIT_EDITS) && !(rel in AUDIT_PRESENT_EXIT_PIN_EDITS)) return text', 'if (!(rel in AUDIT_PRESENT_EXIT_EDITS)) return text'],
]
for (const [name, from, to] of STRIP_MUTANTS) {
  await check(`mutant caught: strip: ${name}`, async () => {
    const mutant = await dataModule(mutate(STRIP_TEXT, from, to, name))
    assert.ok(await throws(() => sourceChecks(TEXTS, mutant)), 'section 3 must fail')
  })
}
await check('mutant caught: strip: a [has, was] pair is missing, or puts back a changed line (each pair of every file in turn)', async () => {
  for (const rel of TOUCHED) {
    for (let at = 0; at < EDITS[rel].length; at++) {
      const dropped = { ...stripModule, AUDIT_PRESENT_EXIT_EDITS: { ...EDITS, [rel]: EDITS[rel].filter((_, index) => index !== at) } }
      const changed = { ...stripModule, AUDIT_PRESENT_EXIT_EDITS: { ...EDITS, [rel]: EDITS[rel].map((pair, index) => index === at ? [pair[0], `${pair[1]}// changed\n`] : pair) } }
      // the strip function closes over its own tables, so the mutant is a rebuilt strip over the mutated table
      for (const mod of [dropped, changed]) {
        const mutantStrip = (r, text) => (typeof text !== 'string' || !(r in mod.AUDIT_PRESENT_EXIT_EDITS)) ? stripModule.stripAuditPresentExit(r, text) : (mod.AUDIT_PRESENT_EXIT_EDITS[r] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
        assert.ok(await throws(() => sourceChecks(TEXTS, { ...mod, stripAuditPresentExit: mutantStrip })), `${rel} pair ${at}`)
      }
    }
  }
})
await check('mutant caught: a stray file outside the scope (in a commit) fails the scope check, a polluted working tree does not; a commit message without the subject or the co-author line fails the message check', async () => {
  const own = ownCommits()
  assert.doesNotThrow(() => scopeCheck(own), 'the real tree passes')
  assert.ok(await throws(() => scopeCheck(own, ['stray-audit-present-exit.txt'])), 'a stray file fails the scope check')
  assert.ok(await throws(() => scopeCheck(own, ['app/builder/page.tsx'])), 'an app file nobody registered fails it too')
  // the scope reads the COMMITTED diff only: an untracked file in the tree (or an edited, or a staged one) is not a file this change commits, so it changes nothing
  const stray = path.join(repo, 'stray-audit-present-exit.txt'), before = [...touchedFiles(own)].sort()
  fs.writeFileSync(stray, 'stray\n')
  try { assert.deepEqual([...touchedFiles(own)].sort(), before, 'an untracked stray file does not change the files read'); assert.doesNotThrow(() => scopeCheck(own), 'and does not fail the scope check') } finally { fs.rmSync(stray) }
  assert.deepEqual(messageProblems(`${SUBJECT} a change`, 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [], 'a good message has no problem')
  assert.deepEqual(messageProblems(`${SUBJECT} a change`, 'body\n'), ['the co-author line'], 'no co-author line')
  assert.deepEqual(messageProblems('Fix the page', 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [`the subject starts "${SUBJECT}"`], 'another subject')
})
await check('mutant caught: the registry without one of the three lines, with a line changed, or with a base line lost', async () => {
  const text = TEXTS[REGISTRY], lines = text.split('\n')
  const mine = lines.map((line, index) => [line, index]).filter(([line]) => line.includes('studio-audit-present-exit-strip.mjs'))
  assert.equal(mine.length, 3)
  assert.doesNotThrow(() => registryChecks(text), 'the real registry passes')
  for (const [, index] of mine) assert.ok(await throws(() => registryChecks(lines.filter((_, at) => at !== index).join('\n'))), `without line ${index + 1}`)
  assert.ok(await throws(() => registryChecks(text.replace('// LATER-CHANGE: FRONTEND-1, audit P-17, Present Exit leaves Present when the browser is not full screen', '// LATER-CHANGE: FRONTEND-1, something else'))), 'a changed marker comment')
  assert.ok(await throws(() => registryChecks(lines.filter(line => !line.includes('studio-voice-call-strip.mjs')).join('\n'))), 'a base line lost')
  assert.ok(await throws(() => registryChecks(lines.filter(line => !line.includes('one line per later change, above this comment')).join('\n'))), 'the marker comments lost')
})

release()
console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
