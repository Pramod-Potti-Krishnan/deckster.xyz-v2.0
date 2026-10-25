// FRONTEND-2: proof for scripts/studio-later-changes.mjs, "registry v2": a change stacked after bulk edit + chat undo registers THREE lines (its files, its .env.example block, its strip) and the older pins read through
// stripLaterChanges(rel, text) innermost, so a later change's lines in an app file (the Decks page, the Builder page, the viewer, the hook) no longer fail a pin that holds the file to an earlier commit.
// Plain node, no browser, no network, no services; nothing is written (the made-up change lives in memory only and is never committed):
//   1. identity   the empty registry returns every file byte for byte (and anything that is not a string as it is)
//   2. strips     a made-up strip for a made-up added line in the Decks page and one in the Builder page: each takes its own line out and leaves the other file alone; strips run in order, each on the previous result;
//                 a non-function entry is skipped and a result that is not a string is ignored; the strips run BEFORE the .env.example blocks; a block is taken only from .env.example
//   3. reach      stripBulkEditUndo (which every older pin and every shared strip root calls innermost) and the three roots (open-read-only, dark-persist, add-slide-status) take the registered lines out too
//   4. pins       the REAL pins that hold the Decks page and the Builder page to a base (duplicate-copy-title, duplicate-deck, deck-import, and the Pass 3 pins that may only gain lines) run as child processes with the
//                 made-up lines appended to those two files IN MEMORY (a preload patches fs.readFileSync; nothing on disk changes): registered, they pass; unregistered, the ones that hold the file byte for byte fail
//   5. change     the registry exports and header, the pins that import it, the committed diff (BASE..HEAD) holds this change's files only, no app code, no .env.example change, secret scan
//   6. mutants    each one must make sections 1-5 fail
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { stripBulkEditUndo } from './studio-bulk-edit-undo-strip.mjs'
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { LATER_STRIPS, LATER_CHANGE_FILES, LATER_ENV_BLOCKS } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.LATER_CHANGES_BASE || '74aaf20c5402f76268f93b8833a0b8c3830a73cc' // #499, frozen: bulk edit + chat undo and the registry v1
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
let overrides = {} // in-memory mutations: the suite reads every source through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const raw = rel => fs.readFileSync(path.join(root, rel), 'utf8')

const REGISTRY = 'scripts/studio-later-changes.mjs', V1_STRIP = 'scripts/studio-bulk-edit-undo-strip.mjs', PROOF = 'scripts/test-studio-later-changes.mjs'
const DASH = 'app/(app)/dashboard/page.tsx', BUILDER = 'app/builder/page.tsx', ENV = '.env.example'
const DASH_LINE = '// LATER-TEST-DASH: a made-up added line\n', BUILDER_LINE = '// LATER-TEST-BUILDER: a made-up added line\n'
// the change: every file its commit touches (the older scope checks skip the files a later change registers; this one is registered by the v1 strip's lists, as registry v1 was)
const OWN_FILES = [REGISTRY, V1_STRIP, PROOF, 'scripts/test-studio-bulk-edit-undo.mjs', 'scripts/test-studio-compose-entitlement.mjs', 'scripts/test-studio-payments-open-soon.mjs', 'scripts/test-studio-publish-preview-inventory.mjs',
  'scripts/test-studio-template-library-manage.mjs', 'scripts/test-studio-version-history-deck-only.mjs', 'scripts/test-studio-publish-review-fit.mjs', 'scripts/test-studio-duplicate-copy-title.mjs',
  'scripts/test-studio-thumbnail-last-good.mjs', 'scripts/test-studio-deck-import.mjs', 'scripts/test-studio-duplicate-deck.mjs',
  'scripts/studio-library-manage-harness.mjs', 'scripts/test-studio-chat-theme-export.mjs']

// the made-up change: one strip that owns the Decks page's added line, one that owns the Builder page's; each returns every other file untouched
const dropLines = (text, marker) => text.split('\n').filter(line => !line.includes(marker)).join('\n')
const stripDash = (rel, text) => (rel === DASH ? dropLines(text, 'LATER-TEST-DASH') : text)
const stripBuilder = (rel, text) => (rel === BUILDER ? dropLines(text, 'LATER-TEST-BUILDER') : text)

const FILES_LIST = /(export const LATER_CHANGE_FILES = new Set\(\[)([\s\S]*?)(\n\]\))/, BLOCKS_LIST = /(export const LATER_ENV_BLOCKS = \[)([\s\S]*?)(\n\])/, STRIPS_LIST = /(export const LATER_STRIPS = \[)([\s\S]*?)(\n\])/
/** The registry's code with its three lists emptied (what is proved is the code, not what is registered today). */
async function loadRegistry() {
  const source = read(REGISTRY)
  assert.ok(FILES_LIST.test(source) && BLOCKS_LIST.test(source) && STRIPS_LIST.test(source), 'the three lists are exported as written')
  const reg = await import(`data:text/javascript;base64,${Buffer.from(source.replace(FILES_LIST, '$1$3').replace(BLOCKS_LIST, '$1$3').replace(STRIPS_LIST, '$1$3')).toString('base64')}`) // the same source is the same module: every check starts from clean lists
  reg.LATER_STRIPS.length = 0; reg.LATER_ENV_BLOCKS.length = 0; reg.LATER_CHANGE_FILES.clear()
  return reg
}

// ---- the real pins, run with the made-up lines appended in memory
const PRELOAD = String.raw`
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
const DASH = 'app/(app)/dashboard/page.tsx', BUILDER = 'app/builder/page.tsx'
const original = fs.readFileSync
fs.readFileSync = function (file, ...rest) {
  const out = original.call(this, file, ...rest)
  if (typeof out !== 'string') return out
  const name = String(file).split('\\').join('/')
  if (name.endsWith('/' + DASH)) return out + '// LATER-TEST-DASH: a made-up added line\n'
  if (name.endsWith('/' + BUILDER)) return out + '// LATER-TEST-BUILDER: a made-up added line\n'
  return out
}
syncBuiltinESMExports()
if (process.env.LATER_TEST_REGISTER === '1') {
  const reg = await import(process.env.LATER_TEST_REGISTRY_URL)
  const drop = (text, marker) => text.split('\n').filter(line => !line.includes(marker)).join('\n')
  reg.LATER_STRIPS.push((rel, text) => (rel === DASH ? drop(text, 'LATER-TEST-DASH') : text))
  reg.LATER_STRIPS.push((rel, text) => (rel === BUILDER ? drop(text, 'LATER-TEST-BUILDER') : text))
}
`
const PRELOAD_URL = `data:text/javascript;base64,${Buffer.from(PRELOAD).toString('base64')}`
// [pin, holds the file byte for byte (so it must fail unregistered)]: the three the owner named, and two Pass 3 pins that may only gain lines
const PINS = [['test-studio-duplicate-copy-title.mjs', true], ['test-studio-duplicate-deck.mjs', true], ['test-studio-deck-import.mjs', true], ['test-studio-new-deck-handoff-send.mjs', false], ['test-studio-chat-element-refine.mjs', false]]
const runPin = (script, register) => spawnSync(process.execPath, ['--import', PRELOAD_URL, path.join('scripts', script)], {
  cwd: root, encoding: 'utf8', timeout: 110000, maxBuffer: 1 << 26,
  env: { ...process.env, LATER_TEST_REGISTER: register ? '1' : '0', LATER_TEST_REGISTRY_URL: pathToFileURL(path.join(root, REGISTRY)).href },
})

const results = { passed: 0, failed: [] }
let STOP = false
let LAST = ''
async function check(name, fn) {
  try { await fn(); results.passed++ } catch (error) {
    if (STOP) { LAST = `${name} :: ${String(error?.message ?? error).split('\n')[0].slice(0, 110)}`; throw error }
    results.failed.push(name); console.log(`FAIL ${name}\n     ${String(error?.stack ?? error).split('\n').slice(0, 7).join('\n     ')}`)
  }
}

async function suite() {
  const dashText = raw(DASH), builderText = raw(BUILDER), envText = raw(ENV)
  const dashWith = dashText + DASH_LINE, builderWith = builderText + BUILDER_LINE

  await check('identity: the empty registry returns every file byte for byte, and anything that is not a string as it is', async () => {
    const reg = await loadRegistry()
    for (const [rel, text] of [[DASH, dashText], [BUILDER, builderText], [ENV, envText], ['components/presentation-viewer.tsx', raw('components/presentation-viewer.tsx')], ['hooks/use-deckster-websocket-v2.ts', raw('hooks/use-deckster-websocket-v2.ts')],
      ['lib/other.ts', 'no newline at the end'], ['lib/other.ts', ''], [ENV, 'A=1\n\nB=2'], [DASH, dashWith]]) assert.equal(reg.stripLaterChanges(rel, text), text, `${rel}: byte for byte`)
    for (const value of [null, undefined, 7, {}, ['x']]) assert.equal(reg.stripLaterChanges(DASH, value), value)
  })
  await check('strips: each registered strip takes its own line out of its own file and leaves every other file alone; strips run in order, each on the previous result; the strips run BEFORE the .env.example blocks', async () => {
    const reg = await loadRegistry()
    reg.LATER_STRIPS.push(stripDash, stripBuilder)
    assert.equal(reg.stripLaterChanges(DASH, dashWith), dashText, 'the Decks page without the made-up line is the page'); assert.equal(reg.stripLaterChanges(BUILDER, builderWith), builderText)
    assert.equal(reg.stripLaterChanges(BUILDER, dashWith), dashWith, 'a strip that owns the Decks page does not touch the Builder page'); assert.equal(reg.stripLaterChanges(DASH, builderWith), builderWith)
    assert.equal(reg.stripLaterChanges(ENV, envText), envText); assert.equal(reg.stripLaterChanges('lib/other.ts', 'x'), 'x')
    assert.equal(reg.stripLaterChanges(DASH, dashWith + DASH_LINE.replace('DASH', 'DASH-2')), dashText, 'every line that carries the marker goes')
    // order: each strip sees the previous one's result
    reg.LATER_STRIPS.length = 0
    reg.LATER_STRIPS.push((rel, text) => text.replace('x1', 'x2'), (rel, text) => text.replace('x2', 'x3')); assert.equal(reg.stripLaterChanges('lib/o.ts', 'x1'), 'x3', 'registered order, on the previous result')
    reg.LATER_STRIPS.reverse(); assert.equal(reg.stripLaterChanges('lib/o.ts', 'x1'), 'x2', 'the other order gives the other result')
    // entries that are not functions are skipped; a result that is not a string is ignored
    reg.LATER_STRIPS.length = 0
    reg.LATER_STRIPS.push(null, 'x', {}, () => undefined, () => 7, (rel, text) => text.replace('a', 'b')); assert.equal(reg.stripLaterChanges('lib/o.ts', 'a'), 'b')
    // the strips run before the .env.example blocks: a strip that only works while the block is still there
    const BLOCK = '# LATER TEST BLOCK (made up, never committed)\nNEXT_PUBLIC_LATER_TEST_BLOCK="false"'
    reg.LATER_STRIPS.length = 0; reg.LATER_ENV_BLOCKS.push(BLOCK)
    reg.LATER_STRIPS.push((rel, text) => (rel === ENV ? text.replace(`${BLOCK}\nNEXT_PUBLIC_LATER_TEST_LINE=1\n`, `${BLOCK}\n`) : text))
    assert.equal(reg.stripLaterChanges(ENV, `${envText}\n${BLOCK}\nNEXT_PUBLIC_LATER_TEST_LINE=1\n`), envText, 'the strip took its line out while the block was there, then the block went')
    assert.equal(reg.stripLaterChanges(ENV, `${envText}\n${BLOCK}\n`), envText); assert.equal(reg.stripLaterChanges(BUILDER, `${builderText}\n${BLOCK}\n`), `${builderText}\n${BLOCK}\n`, 'a block is taken from .env.example only')
    reg.LATER_STRIPS.length = 0; reg.LATER_ENV_BLOCKS.length = 0
  })
  await check('reach: stripBulkEditUndo (called innermost by every older pin and every shared root) and the three roots take a registered strip\'s lines out; with nothing registered they are what they were', () => {
    const before = [...LATER_STRIPS]
    try {
      // the roots own the Builder page (open-read-only and dark-persist return any other file as it is; add-slide-status chains every file): each is tried on the files it handles
      for (const [rel, withLine, plain, fns] of [[DASH, dashWith, dashText, [stripBulkEditUndo, stripAddSlideStatus]], [BUILDER, builderWith, builderText, [stripBulkEditUndo, stripOpenReadOnly, stripDarkPersist, stripAddSlideStatus]]]) {
        for (const fn of fns) {
          LATER_STRIPS.length = 0; const unregistered = fn(rel, withLine)
          LATER_STRIPS.push(stripDash, stripBuilder)
          assert.equal(fn(rel, withLine), fn(rel, plain), `${fn.name}(${rel}): registered, the line is out`)
          assert.notEqual(unregistered, fn(rel, plain), `${fn.name}(${rel}): unregistered, the made-up line stays`)
        }
      }
    } finally { LATER_STRIPS.length = 0; LATER_STRIPS.push(...before) }
    const v1 = read(V1_STRIP)
    assert.match(v1, /^import \{ stripLaterChanges \} from '\.\/studio-later-changes\.mjs'/m); assert.match(v1, /const inner = stripLaterChanges\(rel, text\)/); assert.match(v1, /table\.reduce\(\(out, \[added, original\]\) => out\.replace\(added, \(\) => original\), inner\)/)
    for (const rel of ['scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs']) assert.match(read(rel), /stripBulkEditUndo\(rel, text\)/, `${rel}: chains the strip innermost`)
  })
  await check('pins: the REAL pins that hold the Decks page and the Builder page to a base pass with the made-up lines registered and (the byte-for-byte ones) fail without it; the made-up lines are appended in memory, nothing on disk changes', () => {
    if (STOP) return // the child processes run in the baseline pass only; the mutants are judged by the cheap checks above
    for (const [script, holdsByteForByte] of PINS) {
      const registered = runPin(script, true), unregistered = runPin(script, false)
      assert.equal(registered.status, 0, `${script}: registered, it passes\n${(registered.stdout || '').split('\n').filter(line => /FAIL|Error|not ok/.test(line)).slice(0, 4).join('\n')}${(registered.stderr || '').slice(-300)}`)
      if (holdsByteForByte) assert.notEqual(unregistered.status, 0, `${script}: unregistered, it fails (it holds the file byte for byte)`)
      process.stdout.write(`     ${script}: registered rc=${registered.status}, unregistered rc=${unregistered.status}${holdsByteForByte ? '' : ' (may only gain lines: it may or may not see the line)'}\n`)
    }
    assert.equal(git('status', '--porcelain', '--', DASH, BUILDER).trim(), '', 'nothing was written to the two pages')
  })
  await check('change: the registry exports the three lists and the two strips; its header says how to register three lines; the pins that read through it import it', () => {
    const source = read(REGISTRY)
    for (const name of ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS']) assert.match(source, new RegExp(`export const ${name} = `))
    for (const name of ['stripLaterEnvBlocks', 'stripLaterChanges']) assert.match(source, new RegExp(`export function ${name}\\(rel, text\\)`))
    assert.match(source, /LATER_STRIPS +\(await import\('\.\/studio-example-strip\.mjs'\)\)\.stripExample, \/\/ LATER-CHANGE: /, 'the header shows the third line'); assert.match(source, /three lines/)
    const strips = source.match(STRIPS_LIST); assert.ok(strips); for (const line of strips[2].split('\n').map(text => text.trim()).filter(text => text && !text.startsWith('//'))) assert.ok(line.includes('LATER-CHANGE'), `a registration is one marked line: ${line.slice(0, 80)}`)
    for (const name of ['compose-entitlement', 'payments-open-soon', 'publish-preview-inventory', 'template-library-manage', 'version-history-deck-only', 'publish-review-fit', 'duplicate-copy-title', 'thumbnail-last-good', 'deck-import', 'duplicate-deck']) {
      const text = read(`scripts/test-studio-${name}.mjs`)
      assert.match(text, /import \{[^}]*\bstripLaterChanges\b[^}]*\} from '\.\/studio-later-changes\.mjs'/, `${name}: imports the registry`); assert.match(text, /stripLaterChanges\((?:rel|file|'\.env\.example'), /, `${name}: reads through it`)
    }
  })
  await check('scope: the COMMITTED diff BASE..HEAD holds this change\'s files only (scripts/ only, no app code, no .env.example); secrets: no credential-shaped literal in what it adds', () => {
    const changed = git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean), own = new Set(OWN_FILES)
    const later = rel => LATER_CHANGE_FILES.has(rel) || (rel === ENV && LATER_ENV_BLOCKS.length > 0) // a change stacked after this one registers its files, and a registered .env.example block means it touched .env.example: not this change's to answer for
    const stray = changed.filter(rel => !own.has(rel) && !later(rel)); assert.deepEqual(stray, [], `files outside this change: ${stray.join(', ')}`)
    assert.ok(changed.filter(rel => !later(rel)).every(rel => rel.startsWith('scripts/')), 'scripts/ only'); assert.deepEqual(git('diff', '--name-only', '--diff-filter=D', BASE, 'HEAD').split('\n').filter(rel => rel && !later(rel)), [], 'nothing deleted (a registered later change\'s deletions are not this change\'s)')
    const added = git('diff', '-U0', BASE, 'HEAD').split('\n').filter(line => /^\+(?!\+\+)/.test(line)).join('\n')
    for (const pattern of [/AKIA[0-9A-Z]{16}/, /sk-[A-Za-z0-9]{20,}/, /xox[bap]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, /(?<![A-Za-z_])(?:password|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"\s]{12,}['"]/i]) assert.ok(!pattern.test(added), `credential-shaped text: ${pattern}`)
    if (!STOP) process.stdout.write(`     (committed diff ${BASE.slice(0, 8)}..HEAD: ${changed.length} files)\n`)
  })
}

// ---------------------------------------------------------------- the mutants
const MUTANTS = [
  { name: 'the strips are ignored (their results are thrown away)', edits: [[REGISTRY, "if (typeof next === 'string') out = next", "if (typeof next === 'string') out = out"]] },
  { name: 'a strip is handed the wrong file name', edits: [[REGISTRY, 'const next = strip(rel, out)', "const next = strip('lib/other.ts', out)"]] },
  { name: 'a strip is applied to the original text, not the previous strip\'s result', edits: [[REGISTRY, 'const next = strip(rel, out)', 'const next = strip(rel, text)']] },
  { name: 'the strips run in reverse order', edits: [[REGISTRY, 'for (const strip of LATER_STRIPS) {', 'for (const strip of [...LATER_STRIPS].reverse()) {']] },
  { name: 'order: the .env.example blocks come out before the strips', edits: [[REGISTRY, '  let out = text\n  for (const strip of LATER_STRIPS) {', '  let out = stripLaterEnvBlocks(rel, text)\n  for (const strip of LATER_STRIPS) {'], [REGISTRY, '  return stripLaterEnvBlocks(rel, out)\n}\n', '  return out\n}\n']] },
  { name: 'the .env.example blocks are not applied at all', edits: [[REGISTRY, '  return stripLaterEnvBlocks(rel, out)\n}\n', '  return out\n}\n']] },
  { name: 'the empty registry is not an identity (a trailing newline is added)', edits: [[REGISTRY, '  let out = text\n  for (const strip of LATER_STRIPS) {', "  let out = text.endsWith('\\n') ? text : `${text}\\n`\n  for (const strip of LATER_STRIPS) {"]] },
  { name: 'a non-function entry is called', edits: [[REGISTRY, "    if (typeof strip !== 'function') continue\n", '']] },
  { name: 'a result that is not a string replaces the text', edits: [[REGISTRY, "if (typeof next === 'string') out = next", 'out = next']] },
  { name: 'a block is taken from any file, not only .env.example', edits: [[REGISTRY, "if (rel !== '.env.example' || typeof text", 'if (typeof text']] },
  { name: 'bulk edit + chat undo\'s strip no longer runs the registry first', edits: [[V1_STRIP, 'const inner = stripLaterChanges(rel, text)', 'const inner = text']] },
  { name: 'a pin stops reading through the registry', edits: [['scripts/test-studio-deck-import.mjs', "stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(root, rel), 'utf8')))", "stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8'))"]] },
]

console.log(`Studio later-changes registry v2 (${BASE.slice(0, 8)} base)`)
await suite()
console.log(`${results.passed} checks passed, ${results.failed.length} failed`)
let escaped = 0
if (results.failed.length === 0 && !process.env.LATER_CHANGES_NO_MUTANTS) {
  STOP = true
  let killed = 0
  for (const mutant of MUTANTS) {
    overrides = {}
    for (const [rel, from, to] of mutant.edits) {
      const source = rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8')
      assert.equal(source.split(from).length - 1, 1, `mutant "${mutant.name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = source.replace(from, () => to)
    }
    let caught = false
    try { await suite() } catch { caught = true }
    overrides = {}
    if (process.env.LATER_CHANGES_WHY) console.log(`  ${caught ? 'killed' : 'SURVIVED'} ${mutant.name}\n     by ${LAST}`)
    if (caught) killed++; else { escaped++; console.log(`SURVIVED mutant: ${mutant.name}`) }
  }
  console.log(`${killed}/${MUTANTS.length} mutants killed`)
}
const bad = results.failed.length + escaped
console.log(bad === 0 ? 'PASS test-studio-later-changes' : `FAIL test-studio-later-changes (${results.failed.length} checks, ${escaped} surviving mutants)`)
process.exit(bad === 0 ? 0 : 1)
