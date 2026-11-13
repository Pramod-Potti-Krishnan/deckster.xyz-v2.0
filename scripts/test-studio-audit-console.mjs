// FRONTEND-1 (production frontend audit, P-30 analytics script 404, P-32 Completed Presentations naming (P-31 is a backend asset, not in this repo)): proof of NEXT_PUBLIC_STUDIO_ANALYTICS_GATE and NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED and NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST (exact "true", default off, build-time).
//
// THE DEFECTS: P-30 app/layout.tsx mounts <Analytics /> unconditionally, so a deployment without Vercel Web Analytics logs a 404 and a nosniff refusal for its script; P-32 the Decks page's first tab reads "Completed Presentations (N)" for
// every deck that has a built deck, whatever its status. (P-31 is in the Layout service's viewer, not in this repo.)
//
//   1. The libs, function by function: the three flags, the analytics gate (the whole truth table, odd values, the module-level constants under every env combination), the tab label (off = the base's text byte for byte).
//   2. The two files' marked lines: the layout renders <Analytics /> exactly once and only through the gate; the Decks tab keeps the base's JSX for the off path and reads the lib's constant; neither file reads the env itself.
//
//   3. The sources: every marked line, the strip gives each touched file its base back byte for byte, the registry, .env.example, the scope (read from the
//      COMMITTED diff BASE..HEAD only, never the working tree), the commits.
//   4. Mutants: each must be caught.
//
//   node scripts/test-studio-audit-console.mjs
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

setTimeout(() => { process.stderr.write('[watchdog] test-studio-audit-console stalled for 240 s; exit 124\n'); process.exit(124) }, Number(process.env.STUDIO_PROOF_TRACE_WATCHDOG_MS) || 240_000).unref()

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const STRIP = 'scripts/studio-audit-console-strip.mjs'
const SELF = 'scripts/test-studio-audit-console.mjs'
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
const stripModule = await import('./studio-audit-console-strip.mjs')
const { BASE_COMMIT, AUDIT_CONSOLE_FILES: TOUCHED, AUDIT_CONSOLE_NEW_FILES: NEW_FILES, AUDIT_CONSOLE_SCOPE_FILES: SCOPE_FILES, AUDIT_CONSOLE_ENV_BLOCK: ENV_BLOCK, AUDIT_CONSOLE_SUBJECT: SUBJECT, AUDIT_CONSOLE_MARKER_RE: MARKER_RE, AUDIT_CONSOLE_EDITS: EDITS } = stripModule
const STRIP_FN = stripModule.stripAuditConsole
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
// 1. The libs
// ============================================================================================================================================
const GATE_LIB = 'lib/studio-analytics-gate.ts', TABS_LIB = 'lib/studio-deck-tabs-honest.ts'
const LAYOUT = 'app/layout.tsx', DASH = 'app/(app)/dashboard/page.tsx'
const GATE = 'NEXT_PUBLIC_STUDIO_ANALYTICS_GATE', SERVED = 'NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED', HONEST = 'NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST'
function gateChecks(libText = read(GATE_LIB)) {
  const lib = loadLib(GATE_LIB, libText, {})
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['', false], ['yes', false], ['true', true]]) assert.equal(lib.analyticsFlagOn(value), want, `flag ${JSON.stringify(value)}`)
  // the rule: mounts always while the gate is off; with the gate on, only when the deployment says it serves analytics
  for (const gate of [true, false]) for (const served of [true, false]) assert.equal(lib.analyticsMounts(gate, served), !gate || served, `mounts(${gate}, ${served})`)
  for (const odd of ['true', 1, 'yes', null, undefined, {}]) assert.equal(lib.analyticsMounts(odd, false), true, `a gate that is not the boolean true (${JSON.stringify(odd)}) does not hide it`)
  for (const odd of ['true', 1, 'yes', null, undefined, {}]) assert.equal(lib.analyticsMounts(true, odd), false, `a SERVED that is not the boolean true (${JSON.stringify(odd)}) does not show it`)
  // the module-level constants under every env combination (what the layout reads)
  const combos = [[{}, true], [{ [GATE]: 'false' }, true], [{ [GATE]: 'TRUE' }, true], [{ [SERVED]: 'true' }, true], [{ [GATE]: 'true' }, false], [{ [GATE]: 'true', [SERVED]: 'false' }, false], [{ [GATE]: 'true', [SERVED]: 'yes' }, false], [{ [GATE]: 'true', [SERVED]: 'true' }, true], [{ [GATE]: 'on', [SERVED]: 'on' }, true]]
  for (const [env, want] of combos) assert.equal(loadLib(GATE_LIB, libText, env).STUDIO_ANALYTICS_MOUNTS, want, `env ${JSON.stringify(env)} mounts ${want}`)
  assert.equal(loadLib(GATE_LIB, libText, { [GATE]: 'true' }).STUDIO_ANALYTICS_GATE_ENABLED, true); assert.equal(loadLib(GATE_LIB, libText, {}).STUDIO_ANALYTICS_GATE_ENABLED, false)
  assert.equal(loadLib(GATE_LIB, libText, { [SERVED]: 'true' }).STUDIO_ANALYTICS_SERVED, true); assert.equal(loadLib(GATE_LIB, libText, {}).STUDIO_ANALYTICS_SERVED, false)
}
function tabsChecks(libText = read(TABS_LIB)) {
  const lib = loadLib(TABS_LIB, libText, {})
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['', false], ['yes', false], ['true', true]]) assert.equal(lib.deckTabsHonestOn(value), want, `flag ${JSON.stringify(value)}`)
  assert.equal(loadLib(TABS_LIB, libText, {}).STUDIO_DECK_TABS_HONEST_ENABLED, false, 'unset: off'); assert.equal(loadLib(TABS_LIB, libText, { [HONEST]: 'true' }).STUDIO_DECK_TABS_HONEST_ENABLED, true, '"true": on'); assert.equal(loadLib(TABS_LIB, libText, { [HONEST]: 'on' }).STUDIO_DECK_TABS_HONEST_ENABLED, false, '"on": off')
  for (const count of [0, 1, 5, 30, 1234]) {
    assert.equal(lib.deckBuiltTabLabel(false, count), `Completed Presentations (${count})`, `flag off: the base's text for ${count}`)
    assert.equal(lib.deckBuiltTabLabel(true, count), `Built decks (${count})`, `flag on: the honest text for ${count}`)
  }
  for (const odd of ['true', 1, null, undefined]) assert.equal(lib.deckBuiltTabLabel(odd, 3), 'Completed Presentations (3)', `a flag that is not the boolean true (${JSON.stringify(odd)}) keeps the base's text`)
}

// ============================================================================================================================================
// 2. The two files' marked lines
// ============================================================================================================================================
function fileChecks(texts = TEXTS) {
  const layout = texts[LAYOUT], dash = texts[DASH]
  assert.equal(layout.split('\n').filter(line => MARKER_RE.test(line)).length, 3, 'the layout carries the marker on three lines: the renamed component import, the gate import and the gated alias')
  assert.equal((layout.match(/<Analytics \/>/g) || []).length, 1, 'the layout renders <Analytics /> once')
  assert.ok(layout.includes("\n        <Analytics />\n"), 'and that element line is the base\'s, byte for byte (older proofs pin the lines around it)')
  assert.ok(layout.includes("import { Analytics as VercelAnalytics } from '@vercel/analytics/next' // AUDIT-CONSOLE\nimport { STUDIO_ANALYTICS_MOUNTS } from '@/lib/studio-analytics-gate' // AUDIT-CONSOLE\n"), 'the real component is imported under its own name, then the lib\'s constant')
  assert.ok(layout.includes("const inter = Inter({ subsets: ['latin'] })\nconst Analytics = STUDIO_ANALYTICS_MOUNTS ? VercelAnalytics : () => null // AUDIT-CONSOLE: "), 'the name <Analytics /> is the real component with the gate open and nothing with it closed')
  assert.equal(/process\.env\.NEXT_PUBLIC_STUDIO_ANALYTICS/.test(layout), false, 'the layout does not read the env itself')
  assert.equal(dash.split('\n').filter(line => MARKER_RE.test(line)).length, 2, 'the Decks page carries the marker on two lines: the import and the tab label')
  assert.ok(dash.includes('import { STUDIO_DECK_TABS_HONEST_ENABLED, deckBuiltTabLabel } from "@/lib/studio-deck-tabs-honest" // AUDIT-CONSOLE\n'), 'the page imports the lib')
  assert.ok(dash.includes("              {STUDIO_DECK_TABS_HONEST_ENABLED ? deckBuiltTabLabel(true, completedPresentations.length) : <>Completed Presentations ({completedPresentations.length})</>}{/* AUDIT-CONSOLE */}\n"), 'the tab: the lib\'s label with the flag on, the base\'s own JSX with it off')
  assert.equal(/process\.env\.NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST/.test(dash), false, 'the page does not read the env itself')
  // the tab keeps its value, its position and the second tab as they were
  assert.ok(dash.includes('<TabsTrigger value="completed">\n') && dash.includes('const completedPresentations = presentations.filter(p => p.finalPresentationUrl)'), 'the first tab and the grouping are the base\'s')
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
  const strip = mod.stripAuditConsole, edits = mod.AUDIT_CONSOLE_EDITS, files = mod.AUDIT_CONSOLE_FILES, block = mod.AUDIT_CONSOLE_ENV_BLOCK
  // the strip gives each touched file its base back, byte for byte, and is idempotent
  for (const rel of files) {
    const now = laterStrips(rel, texts[rel]), out = strip(rel, now)
    assert.equal(out, baseText(rel), `${rel}: without this change's edits the file is the base's, byte for byte`)
    assert.equal(strip(rel, out), out, `${rel}: stripping twice changes nothing more`)
    assert.notEqual(now, baseText(rel), `${rel}: the change is there to strip`)
  }
  for (const rel of ['app/builder/page.tsx', 'components/builder/message-list.tsx', '.env.example', REGISTRY]) assert.equal(strip(rel, 'x\nAUDIT-CONSOLE\n'), 'x\nAUDIT-CONSOLE\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(strip(files[0], 5), 5, 'a text that is not a string comes back as it is')
  // every line a file gains carries the marker; the only base lines lost are the ones this change rewrites (its pairs' `was` lines), all of them
  for (const rel of files) {
    const diff = lineDiff(baseText(rel), laterStrips(rel, texts[rel])), allowed = rewritten(edits, rel)
    for (const line of diff.added) assert.match(line, MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    for (const line of diff.removed) assert.ok(allowed.has(line), `${rel}: a base line is lost that this change does not rewrite: ${line.trim().slice(0, 100)}`)
    assert.equal(diff.removed.length, (edits[rel] || []).flatMap(([, was]) => was.split('\n')).filter(line => line !== '').length, `${rel}: the base lines this change rewrites (all of them, no other)`)
  }
  // the older proofs this change teaches: each gains one marked line (the first-parent walk leaves this change's commits out) and is the base's without it
  const EXTRA_PIN_FILES = ["scripts/test-studio-deck-card-count.mjs","scripts/test-studio-deck-cards-v2.mjs","scripts/test-atlas-decks-pagination.mjs","scripts/test-present-view-only.mjs","scripts/test-studio-deck-card-thumbnail-cards.mjs","scripts/test-studio-p2-publish.mjs","scripts/test-studio-deck-card-thumbnail.mjs","scripts/test-studio-deck-grid-4.mjs"]
  assert.deepEqual([...mod.AUDIT_CONSOLE_PIN_FILES].sort(), [...PIN_FILES, ...EXTRA_PIN_FILES].sort(), 'the older proofs this change teaches')
  // an older proof that compiles a touched file with a fixed import list: one marked insertion, the base's proof without it
  for (const rel of EXTRA_PIN_FILES) {
    const now = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's line the proof is the base's, byte for byte`)
    const pairs = mod.AUDIT_CONSOLE_PIN_EDITS[rel], wasLines = pairs.flatMap(([, was]) => was.split('\n')).filter(line => line !== ''), hasLines = pairs.flatMap(([has]) => has.split('\n')).filter(line => line !== '')
    assert.deepEqual([diff.removed.length, diff.added.length], [wasLines.length, hasLines.length], `${rel}: the proof gains and loses exactly the lines of its pairs`)
    for (const line of diff.added) assert.ok(line.includes(mod.AUDIT_CONSOLE_PIN_MARK), `${rel}: a line added carries the pin mark`)
  }
  for (const rel of PIN_FILES) {
    const now = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's line the proof is the base's, byte for byte`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, 1], `${rel}: the proof gains one line and loses none`)
    assert.ok(diff.added[0].includes(mod.AUDIT_CONSOLE_PIN_MARK) && diff.added[0].includes('^Audit fix:'), `${rel}: the line carries the pin mark and names this change's subject`)
  }
  // the voice-call proof: its four-line after-merge edit is in dev since 506bcbb3, so it is the base's own text and this change carries no edit of it (nothing to pin here)
  // the new libs: import-free, one literal env read each (nothing else reads the flag)
  for (const [rel, flag] of mod.AUDIT_CONSOLE_LIB_FLAGS) {
    assert.equal((texts[rel].match(new RegExp(`process\\.env\\.${flag}\\b`, 'g')) || []).length, 1, `${rel} reads the literal env name ${flag} once`)
    assert.deepEqual([...texts[rel].matchAll(/^import .*$/gm)].map(m => m[0]), [], `${rel} is import-free`)
    for (const other of [...files, ...mod.AUDIT_CONSOLE_NEW_FILES.filter(f => /^(hooks|components)\//.test(f))]) assert.equal((texts[other] || '').includes(`process.env.${flag}`), false, `${other} does not read ${flag} itself`)
  }
  // .env.example: the base plus the block (after one blank line); every flag documented "false", once
  assert.equal(texts['.env.example'], `${baseText('.env.example')}\n${block}`, '.env.example is the base plus the block')
  for (const flag of mod.AUDIT_CONSOLE_FLAGS) {
    assert.match(block, new RegExp(`^${flag}="false"$`, 'm'), `the block documents ${flag} as "false"`)
    assert.equal((texts['.env.example'].match(new RegExp(`^${flag}=`, 'gm')) || []).length, 1, `.env.example assigns ${flag} once`)
  }
  assert.ok(block.endsWith('\n') && block.split('\n').filter(line => line && !line.startsWith('#')).length === mod.AUDIT_CONSOLE_FLAGS.length, 'the block is comments and one assignment per flag')
}

/** The registry checks on the registry's text. */
function registryChecks(text, texts = TEXTS) {
  const { AUDIT_CONSOLE_SCOPE_FILES: scope, AUDIT_CONSOLE_ENV_BLOCK: block } = stripModule
  for (const list of ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS']) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n'), own = rows.findIndex(line => line.includes('studio-audit-console-strip.mjs')), voice = rows.findIndex(line => line.includes('studio-voice-call-strip.mjs'))
    assert.ok(own > voice && voice > 0, `${list}: this change's line comes after the voice call's`)
    assert.equal((text.slice(start, end).match(/studio-audit-console-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-audit-console-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes('// LATER-CHANGE: FRONTEND-1, audit P-30 / P-32, no analytics script request where none is served, an honest first Decks tab')), 'each carries the registry marker')
  assert.deepEqual(lineDiff(baseText(REGISTRY), text).removed, [], 'and loses none')
  assert.equal(lineDiff(baseText(REGISTRY), text).added.filter(line => registered.includes(line)).length, 3, 'the three lines are what it gains (a change registered later adds its own)')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(block), 'the block is registered')
  assert.ok([...scope].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  for (const rel of TOUCHED) assert.equal(registry.stripLaterChanges(rel, texts[rel]), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(stripModule.AUDIT_CONSOLE_FLAGS.some(flag => registry.stripLaterEnvBlocks('.env.example', texts['.env.example']).includes(flag)), false, 'the registry takes the block out of .env.example')
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
const TEXTS = Object.fromEntries([...TOUCHED, ...NEW_FILES, '.env.example', REGISTRY, ...PIN_FILES, ...["scripts/test-studio-deck-card-count.mjs","scripts/test-studio-deck-cards-v2.mjs","scripts/test-atlas-decks-pagination.mjs","scripts/test-present-view-only.mjs","scripts/test-studio-deck-card-thumbnail-cards.mjs","scripts/test-studio-p2-publish.mjs","scripts/test-studio-deck-card-thumbnail.mjs","scripts/test-studio-deck-grid-4.mjs"]].map(rel => [rel, read(rel)]))

await check('1a. the analytics gate: the flag, the whole truth table, odd values, the constants under every env combination', () => gateChecks())
await check('1b. the deck tab label: the flag, off = the base\'s text for every count, on = "Built decks (N)", odd values', () => tabsChecks())
await check('2. the layout renders <Analytics /> once and only through the gate; the Decks tab keeps the base\'s JSX off and reads the lib on; no env read in either file', () => fileChecks())

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

const GATE_TEXT = TEXTS[GATE_LIB], TABS_TEXT = TEXTS[TABS_LIB], LAYOUT_TEXT = TEXTS[LAYOUT], DASH_TEXT = TEXTS[DASH]
const GATE_MUTANTS = [
  ['the flag accepts "1"', "return value === 'true'", "return value === 'true' || value === '1'"],
  ['the flag is always on', "return value === 'true'", 'return true'],
  ['the gate never hides it', 'return gate !== true || served === true', 'return true'],
  ['the gate always hides it', 'return gate !== true || served === true', 'return gate !== true'],
  ['a gate-off deployment is hidden too', 'return gate !== true || served === true', 'return served === true'],
  ['SERVED is ignored (the gate hides it everywhere)', 'return gate !== true || served === true', 'return gate !== true'],
  ['a truthy SERVED shows it', 'return gate !== true || served === true', 'return gate !== true || Boolean(served)'],
  ['a truthy gate hides it', 'return gate !== true || served === true', 'return !gate || served === true'],
  ['the constant ignores SERVED', 'analyticsMounts(STUDIO_ANALYTICS_GATE_ENABLED, STUDIO_ANALYTICS_SERVED)', 'analyticsMounts(STUDIO_ANALYTICS_GATE_ENABLED, false)'],
  ['the constant ignores the gate', 'analyticsMounts(STUDIO_ANALYTICS_GATE_ENABLED, STUDIO_ANALYTICS_SERVED)', 'analyticsMounts(false, STUDIO_ANALYTICS_SERVED)'],
  ['SERVED is read from another variable', 'process.env.NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED', 'process.env.NEXT_PUBLIC_STUDIO_ANALYTICS_ON'],
  ['the lib imports something', 'export function analyticsFlagOn', "import { x } from '@/lib/x'\nexport function analyticsFlagOn"],
]
for (const [name, from, to] of GATE_MUTANTS) {
  await check(`mutant caught: analytics gate: ${name}`, async () => {
    const mutant = mutate(GATE_TEXT, from, to, name)
    assert.ok(await throws(() => { gateChecks(mutant); sourceChecks({ ...TEXTS, [GATE_LIB]: mutant }) }), 'sections 1 and 3 must fail')
  })
}
const TABS_MUTANTS = [
  ['the flag accepts "1"', "return value === 'true'", "return value === 'true' || value === '1'"],
  ['the label is always honest', "return honest === true ? `Built decks (${count})` : `Completed Presentations (${count})`", 'return `Built decks (${count})`'],
  ['the label is never honest', "return honest === true ? `Built decks (${count})` : `Completed Presentations (${count})`", 'return `Completed Presentations (${count})`'],
  ['a truthy flag is honest', "return honest === true ?", 'return honest ?'],
  ['the honest label drops the count', 'Built decks (${count})`', 'Built decks`'],
  ['the base label changes', 'Completed Presentations (${count})`', 'Completed presentations (${count})`'],
  ['the lib imports something', 'export function deckTabsHonestOn', "import { x } from '@/lib/x'\nexport function deckTabsHonestOn"],
]
for (const [name, from, to] of TABS_MUTANTS) {
  await check(`mutant caught: deck tabs: ${name}`, async () => {
    const mutant = mutate(TABS_TEXT, from, to, name)
    assert.ok(await throws(() => { tabsChecks(mutant); sourceChecks({ ...TEXTS, [TABS_LIB]: mutant }) }), 'sections 1 and 3 must fail')
  })
}
const FILE_MUTANTS = [
  [LAYOUT, 'the layout mounts the real component unconditionally again', 'const Analytics = STUDIO_ANALYTICS_MOUNTS ? VercelAnalytics : () => null', 'const Analytics = VercelAnalytics'],
  [LAYOUT, 'the layout gates on true', 'const Analytics = STUDIO_ANALYTICS_MOUNTS ? VercelAnalytics', 'const Analytics = true ? VercelAnalytics'],
  [LAYOUT, 'the layout never mounts it', 'const Analytics = STUDIO_ANALYTICS_MOUNTS ? VercelAnalytics : () => null', 'const Analytics = () => null'],
  [LAYOUT, 'the layout mounts a second <Analytics />', '\n        <Analytics />\n', '\n        <Analytics />\n        <Analytics />\n'],
  [LAYOUT, 'the layout rewrites the element line (older proofs pin it)', '\n        <Analytics />\n', '\n        <Analytics /> {/* x */}\n'],
  [LAYOUT, 'the layout reads the env itself', 'const Analytics = STUDIO_ANALYTICS_MOUNTS ?', "const Analytics = process.env.NEXT_PUBLIC_STUDIO_ANALYTICS_GATE !== 'true' ?"],
  [LAYOUT, 'the component keeps its old name (the gate is bypassed)', "import { Analytics as VercelAnalytics } from '@vercel/analytics/next' // AUDIT-CONSOLE", "import { Analytics } from '@vercel/analytics/next' // AUDIT-CONSOLE"],
  [DASH, 'the tab is always the honest label', '{STUDIO_DECK_TABS_HONEST_ENABLED ? deckBuiltTabLabel(true, completedPresentations.length) : <>Completed Presentations ({completedPresentations.length})</>}', '{deckBuiltTabLabel(true, completedPresentations.length)}'],
  [DASH, 'the tab ignores the flag (honest only when off)', '{STUDIO_DECK_TABS_HONEST_ENABLED ? deckBuiltTabLabel(true,', '{!STUDIO_DECK_TABS_HONEST_ENABLED ? deckBuiltTabLabel(true,'],
  [DASH, 'the off path changes the base\'s JSX', ': <>Completed Presentations ({completedPresentations.length})</>}', ': <>Completed Presentations</>}'],
  [DASH, 'the page changes the grouping', 'const completedPresentations = presentations.filter(p => p.finalPresentationUrl)', 'const completedPresentations = presentations.filter(p => p.finalPresentationUrl && p.status === "completed")'],
]
for (const [rel, name, from, to] of FILE_MUTANTS) {
  await check(`mutant caught: ${rel}: ${name}`, async () => {
    const mutant = mutate(TEXTS[rel], from, to, name)
    assert.ok(await throws(() => { fileChecks({ ...TEXTS, [rel]: mutant }); sourceChecks({ ...TEXTS, [rel]: mutant }) }), 'sections 2 and 3 must fail')
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
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: text.split('\n').filter(line => !line.includes('registry read (AUDIT-CONSOLE)')).join('\n') })), 'the line removed (the proof would fail on this change\'s own commits)')
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: text.replace('registry read (AUDIT-CONSOLE)', 'registry read (OTHER)') })), 'the pin mark changed')
  }
})
await check('mutant caught: .env.example with a flag on by default, or the block missing', async () => {
  for (const flag of stripModule.AUDIT_CONSOLE_FLAGS) assert.ok(await throws(() => sourceChecks({ ...TEXTS, '.env.example': TEXTS['.env.example'].replace(`${flag}="false"`, `${flag}="true"`) })), `${flag} true by default`)
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, '.env.example': baseText('.env.example') })))
})
const STRIP_TEXT = read(STRIP)
const STRIP_MUTANTS = [
  ['the strip puts nothing back', 'return putBackAuditConsole(rel, text)', 'return text'],
  ['the strip touches a file it does not own', 'if (!(rel in AUDIT_CONSOLE_EDITS) && !(rel in AUDIT_CONSOLE_PIN_EDITS)) return text', "if (rel === 'app/builder/page.tsx') return text.toUpperCase()"],
  ['the strip does not know the older proofs', 'if (!(rel in AUDIT_CONSOLE_EDITS) && !(rel in AUDIT_CONSOLE_PIN_EDITS)) return text', 'if (!(rel in AUDIT_CONSOLE_EDITS)) return text'],
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
      const dropped = { ...stripModule, AUDIT_CONSOLE_EDITS: { ...EDITS, [rel]: EDITS[rel].filter((_, index) => index !== at) } }
      const changed = { ...stripModule, AUDIT_CONSOLE_EDITS: { ...EDITS, [rel]: EDITS[rel].map((pair, index) => index === at ? [pair[0], `${pair[1]}// changed\n`] : pair) } }
      // the strip function closes over its own tables, so the mutant is a rebuilt strip over the mutated table
      for (const mod of [dropped, changed]) {
        const mutantStrip = (r, text) => (typeof text !== 'string' || !(r in mod.AUDIT_CONSOLE_EDITS)) ? stripModule.stripAuditConsole(r, text) : (mod.AUDIT_CONSOLE_EDITS[r] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
        assert.ok(await throws(() => sourceChecks(TEXTS, { ...mod, stripAuditConsole: mutantStrip })), `${rel} pair ${at}`)
      }
    }
  }
})
await check('mutant caught: a stray file outside the scope (in a commit) fails the scope check, a polluted working tree does not; a commit message without the subject or the co-author line fails the message check', async () => {
  const own = ownCommits()
  assert.doesNotThrow(() => scopeCheck(own), 'the real tree passes')
  assert.ok(await throws(() => scopeCheck(own, ['stray-audit-console.txt'])), 'a stray file fails the scope check')
  assert.ok(await throws(() => scopeCheck(own, ['app/builder/page.tsx'])), 'an app file nobody registered fails it too')
  // the scope reads the COMMITTED diff only: an untracked file in the tree (or an edited, or a staged one) is not a file this change commits, so it changes nothing
  const stray = path.join(repo, 'stray-audit-console.txt'), before = [...touchedFiles(own)].sort()
  fs.writeFileSync(stray, 'stray\n')
  try { assert.deepEqual([...touchedFiles(own)].sort(), before, 'an untracked stray file does not change the files read'); assert.doesNotThrow(() => scopeCheck(own), 'and does not fail the scope check') } finally { fs.rmSync(stray) }
  assert.deepEqual(messageProblems(`${SUBJECT} a change`, 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [], 'a good message has no problem')
  assert.deepEqual(messageProblems(`${SUBJECT} a change`, 'body\n'), ['the co-author line'], 'no co-author line')
  assert.deepEqual(messageProblems('Fix the page', 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [`the subject starts "${SUBJECT}"`], 'another subject')
})
await check('mutant caught: the registry without one of the three lines, with a line changed, or with a base line lost', async () => {
  const text = TEXTS[REGISTRY], lines = text.split('\n')
  const mine = lines.map((line, index) => [line, index]).filter(([line]) => line.includes('studio-audit-console-strip.mjs'))
  assert.equal(mine.length, 3)
  assert.doesNotThrow(() => registryChecks(text), 'the real registry passes')
  for (const [, index] of mine) assert.ok(await throws(() => registryChecks(lines.filter((_, at) => at !== index).join('\n'))), `without line ${index + 1}`)
  assert.ok(await throws(() => registryChecks(text.replace('// LATER-CHANGE: FRONTEND-1, audit P-30 / P-32, no analytics script request where none is served, an honest first Decks tab', '// LATER-CHANGE: FRONTEND-1, something else'))), 'a changed marker comment')
  assert.ok(await throws(() => registryChecks(lines.filter(line => !line.includes('studio-voice-call-strip.mjs')).join('\n'))), 'a base line lost')
  assert.ok(await throws(() => registryChecks(lines.filter(line => !line.includes('one line per later change, above this comment')).join('\n'))), 'the marker comments lost')
})

release()
console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
