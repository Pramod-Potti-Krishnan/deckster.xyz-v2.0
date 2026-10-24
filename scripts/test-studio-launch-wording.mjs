// FRONTEND-1 Pass 3: launched wording on the signed-in pages (flag NEXT_PUBLIC_STUDIO_LAUNCH_WORDING, exact "true", default off, read at build time).
// PK 23 Oct: "replace 'coming soon' / mock wording with launched wording (we are going out); grey out what is truly not ready instead of promising it."
// Plan and evidence per row: streams/frontend/pass3/launched-wording/PLAN.md (workspace). The list of changed sentences is lib/studio-launch-wording.ts (import-free).
//
// Offline and self-contained: no network, no browser. It reads the sources as they are, the base commit's files through `git show`, and loads the two pure word files
// (lib/studio-intelligence-p2.ts, lib/studio-model-catalog.ts) in a vm with the flag off, on, and in every spelling that is not the exact string "true".
//   1. the flag      read as the exact string everywhere it appears (never loosely, never imported); declared once per file that uses a constant; documented default "false".
//   2. flag off      with this change's edits put back (scripts/studio-launch-wording-strip.mjs) every touched file is the base commit's, byte for byte (or, when a LATER change
//                    edited the same file too, every base line is still there in order and none of this change's lines is left: scripts/studio-stack-tolerant.mjs).
//   3. the words     each `today` sentence is in the base file it came from; each `launched` sentence is in the file now; none is the old sentence, none promises anything
//                    (soon, planned, yet, future release, v2.1, "candidate", "not connected", "when enabled", "in this environment") and the list has no duplicate id.
//   4. greyed        every control the flag disables or does not draw is still in the source it was written in.
//   5. pure files    the two word files give today's text with the flag unset or any other value than "true", and the launched text with "true".
// Then every check is re-run against deliberately broken copies: each mutant must be caught.
//
// Run: node scripts/test-studio-launch-wording.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { BASE_COMMIT, LAUNCH_FILES, LAUNCH_NEW_FILES, LAUNCH_PAIRS, stripLaunchWording } from './studio-launch-wording-strip.mjs'
import { stripFirstPaint } from './studio-first-paint-strip.mjs' // stacked: NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED (COMPOSER-2 first paint): its flag-gated viewer lines come out first, inside read(), next to stripLaunchWording
import { sameOrTolerant, stackScope } from './studio-stack-tolerant.mjs'
import { sameAsBase } from './studio-env-append-tolerant.mjs'
import { stripJobDeadlines } from './studio-job-deadlines-strip.mjs' // P3-4b (NEXT_PUBLIC_STUDIO_JOB_DEADLINES) is in the base and edits components/narration-voice-picker.tsx too: its lines come out first

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
const read = rel => stripFirstPaint(rel, fs.readFileSync(path.join(root, rel), 'utf8'))
const baseOf = rel => git('show', `${BASE_COMMIT}:${rel}`)
const FLAG = 'NEXT_PUBLIC_STUDIO_LAUNCH_WORDING'
const WORDS_LIB = 'lib/studio-launch-wording.ts'

const results = []
const record = (label, fn) => { try { fn(); results.push([label, true]) } catch (error) { results.push([label, false, error.message.split('\n')[0]]) } }
const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function loadTs(source, fileName, env = {}) {
  const module = { exports: {} }
  // env === null: no `process` at all, so a file that reads the environment throws when it is loaded
  vm.runInNewContext(`(function (module, exports, process) {${compile(source, fileName)}\n})`, {})(module, module.exports, env === null ? undefined : { env })
  return module.exports
}
// what a sentence looks like in a source file: JSX entities, escaped quotes and runs of white space folded
const flat = text => text.replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\s+/g, ' ')

// ---------------------------------------------------------------- the inputs, gathered once (a mutant edits a copy)
function gather() {
  const wordsSource = read(WORDS_LIB)
  const lib = loadTs(wordsSource, WORDS_LIB)
  const heads = {}, bases = {}
  for (const rel of LAUNCH_FILES) { heads[rel] = read(rel); bases[rel] = baseOf(rel) }
  const touched = new Set(lib.LAUNCH_WORDS.flatMap(word => [word.file, word.todayFile ?? word.file]))
  for (const rel of touched) { heads[rel] ??= read(rel); bases[rel] ??= baseOf(rel) }
  return { wordsSource, lib, heads, bases }
}

// ---------------------------------------------------------------- 1. the flag
function proveFlag({ heads }) {
  const hits = []
  for (const [rel, text] of Object.entries(heads)) {
    if (rel === '.env.example' || rel === 'package.json') continue
    const code = text.replace(/^\s*\/\/.*$/gm, '')
    for (const found of code.matchAll(/process\.env\.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING\b([^\n]{0,24})/g)) {
      assert.match(found[1], /^ === (?:'true'|"true")/, `${rel}: the flag must be compared with === "true" and nothing looser: ${found[0]}`)
      hits.push(rel)
    }
    assert.doesNotMatch(code, /^import .*studio-launch-wording/m, `${rel}: the words list is not imported by the app (a flag or a word imported into a page is a stub in the older page harnesses)`)
    assert.doesNotMatch(code, /process\.env\[|\{ *NEXT_PUBLIC_STUDIO_LAUNCH_WORDING/, `${rel}: no computed or destructured read of the flag`)
    const declared = [...code.matchAll(/^const LAUNCH_WORDING = process\.env\.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === (?:'true'|"true");?$/gm)]
    if (/\bLAUNCH_WORDING\b/.test(code)) assert.equal(declared.length, 1, `${rel}: LAUNCH_WORDING is declared once, from the exact string`)
  }
  assert.ok(new Set(hits).size >= 20, 'the flag is read in the files that carry launched text')
  const env = heads['.env.example']
  assert.equal((env.match(/^NEXT_PUBLIC_STUDIO_LAUNCH_WORDING="false"$/gm) ?? []).length, 1, '.env.example documents the flag once, default "false"')
  const start = env.indexOf('# PASS3 LAUNCHED WORDING (')
  assert.ok(start !== -1, '.env.example: the block is introduced')
  const block = env.slice(start, env.indexOf('NEXT_PUBLIC_STUDIO_LAUNCH_WORDING="false"', start))
  assert.doesNotMatch(block, /exact "true" enables it/, '.env.example: this block does not use the phrase the other blocks use')
  assert.match(block, /the string "true" turns it on/, '.env.example: the block says how the flag is read')
  const pkg = JSON.parse(heads['package.json'])
  assert.equal(pkg.scripts['test:studio-launch-wording'], 'node scripts/test-studio-launch-wording.mjs', 'package.json registers this test')
}

// ---------------------------------------------------------------- 2. flag off is the base
function proveOff({ heads, bases }, strip = stripLaunchWording) {
  for (const rel of LAUNCH_FILES) {
    const head = stripJobDeadlines(rel, heads[rel]) // the base's P3-4b lines out first (they change a base line in narration-voice-picker.tsx); a text without them is returned as it is
    const stripped = strip(rel, head)
    if (rel === '.env.example') { assert.ok(sameAsBase(rel, stripped, bases[rel], /LAUNCH_WORDING/), `${rel}: with this change's block out the file is the base's (or a later flag block was added after it)`); continue }
    const verdict = sameOrTolerant(rel, head, stripped, bases[rel], LAUNCH_PAIRS[rel])
    assert.ok(verdict.ok, `${rel}: flag off is the base: ${verdict.reason}`)
  }
  for (const rel of LAUNCH_FILES) {
    if (rel === '.env.example' || rel === 'package.json') continue
    assert.ok(/LAUNCH_WORDING|STUDIO_LAUNCH_WORDING/.test(heads[rel]), `${rel}: a touched file reads the flag`)
  }
}
function proveScope() {
  const changed = git('diff', '--name-only', BASE_COMMIT, 'HEAD').split('\n').filter(Boolean)
  const known = [...LAUNCH_FILES, ...LAUNCH_NEW_FILES, 'scripts/studio-launch-wording-strip.mjs', 'scripts/test-studio-launch-wording.mjs']
  const change = { pr: 'launch-wording', files: known, family: /^(lib\/studio-launch-wording[^/]*|scripts\/(test-)?studio-launch-wording[^/]*)$/, stray: 'lib/studio-launch-wording-later.ts' }
  if (changed.length === 0) return // nothing committed yet: the working tree is checked by the other proofs
  const scope = stackScope(changed, change)
  assert.deepEqual(scope.stray, [], 'no stray file in this change\'s path family')
  assert.deepEqual(scope.missing, [], 'every file of this change is in the diff')
}

// ---------------------------------------------------------------- 3. the words
const FORBIDDEN = lib => lib.LAUNCH_FORBIDDEN
function proveWords({ lib, heads, bases }) {
  const ids = new Set()
  assert.ok(lib.LAUNCH_WORDS.length >= 45, 'the list is the plan\'s')
  for (const word of lib.LAUNCH_WORDS) {
    assert.ok(!ids.has(word.id), `${word.id}: a duplicate id`); ids.add(word.id)
    const todayFile = word.todayFile ?? word.file
    assert.ok(LAUNCH_FILES.includes(word.file), `${word.id}: ${word.file} is a touched file`)
    assert.ok(flat(bases[todayFile]).includes(flat(word.today)), `${word.id}: "${word.today.slice(0, 60)}" is in the base ${todayFile}`)
    assert.ok(flat(heads[word.file]).includes(flat(word.launched)), `${word.id}: "${word.launched.slice(0, 60)}" is in ${word.file}`)
    assert.notEqual(word.today, word.launched, `${word.id}: the launched text is not the old text`)
    assert.doesNotMatch(word.launched, FORBIDDEN(lib), `${word.id}: a launched sentence promises nothing and names no developer concept: ${word.launched}`)
    assert.ok(word.launched.trim() === word.launched || /· $/.test(word.launched), `${word.id}: tidy`)
    assert.ok(['promise', 'claim', 'dev-speak', 'prototype'].includes(word.kind), `${word.id}: a known kind`)
  }
  // the launched literals of one file are only the list's: no sentence with a promise word hides in a flagged branch
  for (const rel of LAUNCH_FILES) {
    if (!/\.tsx?$/.test(rel) || rel === WORDS_LIB) continue
    for (const found of heads[rel].matchAll(/LAUNCH_WORDING\s*\?\s*(?:\()?(["'`])((?:\\.|(?!\1).)*)\1/g)) {
      assert.doesNotMatch(found[2], FORBIDDEN(lib), `${rel}: a flagged sentence promises something: ${found[2]}`)
    }
  }
}

// ---------------------------------------------------------------- 4. greyed or not drawn
function proveGreyed({ lib, heads }) {
  const ids = new Set()
  for (const item of lib.LAUNCH_GREYED) {
    assert.ok(!ids.has(item.id), `${item.id}: a duplicate id`); ids.add(item.id)
    assert.ok(heads[item.file] ?? read(item.file), `${item.file} exists`)
    assert.ok((heads[item.file] ?? read(item.file)).includes(item.pattern), `${item.id}: ${item.what}: "${item.pattern.slice(0, 70)}" is in ${item.file}`)
  }
  assert.ok(lib.LAUNCH_GREYED.length >= 12, 'the plan\'s greyed and removed rows are all listed')
}

// ---------------------------------------------------------------- 5. the pure word files stay pure; the words list reads no environment
const NOT_TRUE = [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ']
// The pure word files the launched text sits beside (they say they read no environment, and their own pins hold them to that) do not know the flag, and still hold the sentences the table says they hold.
const PURE = ['lib/studio-intelligence-p2.ts', 'lib/studio-model-catalog.ts', 'lib/studio-deck-import.ts', 'lib/studio-add-slide-v2-submit.ts', 'lib/studio-library-manage.ts', 'lib/studio-templates-notice.ts', 'lib/studio-template-progress.ts', 'lib/studio-kg-ask.ts', 'lib/studio-duplicate-deck.ts']
function provePure({ lib }, sources = {}) {
  const textOf = rel => sources[rel] ?? read(rel)
  for (const rel of PURE) assert.doesNotMatch(textOf(rel), /LAUNCH_WORDING/, `${rel}: a pure word file does not know the flag (its launched text lives in the file that shows it)`)
  for (const word of lib.LAUNCH_WORDS.filter(item => item.todayFile)) assert.ok(flat(textOf(word.todayFile)).includes(flat(word.today)), `${word.id}: the pure file ${word.todayFile} still holds today's sentence`)
  const byId = id => lib.LAUNCH_WORDS.find(word => word.id === id)
  const flagged = loadTs(textOf(WORDS_LIB), WORDS_LIB, null) // loads with no `process`: it reads no environment
  assert.equal(flagged.launchWord('help-share', 'true'), byId('help-share').launched, 'launchWord: exact true')
  for (const value of NOT_TRUE) assert.equal(flagged.launchWord('help-share', value), byId('help-share').today, `launchWord: ${JSON.stringify(value)} reads as off`)
  assert.equal(flagged.launchWord('no-such-id', 'true'), '', 'launchWord: an unknown id is empty')
  assert.doesNotMatch(textOf(WORDS_LIB).replace(/^\s*\/\/.*$/gm, ''), /^import /m, 'the words list is import-free')
}

// ---------------------------------------------------------------- the suite and its mutants
function suite(input, extra = {}) {
  const run = []
  const one = (label, fn) => { try { fn(); run.push([label, true]) } catch (error) { run.push([label, false, error.message.split('\n')[0]]) } }
  one('the flag is the exact string, declared once per file, documented default "false"', () => proveFlag(input))
  one('flag off is the base: every touched file with the edits put back is the base commit\'s', () => proveOff(input, extra.strip))
  one('the words: today is in the base, launched is in the file, nothing promises', () => proveWords(input))
  one('the greyed and removed controls are in the sources', () => proveGreyed(input))
  one('the pure word files do not know the flag; the words list is import-free and reads no environment', () => provePure(input, extra.sources))
  return run
}

const input = gather()
for (const [label, ok, why] of suite(input)) results.push([label, ok, why])
record('the change touches only its own files (a later change\'s files are ignored)', proveScope)

const mutants = []
const mutate = (label, edit, extra = {}) => mutants.push([label, edit, extra])
const clone = () => ({ ...input, heads: { ...input.heads }, bases: { ...input.bases }, wordsSource: input.wordsSource })
const withWords = (replace) => { const next = clone(); next.wordsSource = replace(input.wordsSource); next.lib = loadTs(next.wordsSource, WORDS_LIB); return next }
const swapHead = (rel, from, to) => { const next = clone(); assert.ok(next.heads[rel].includes(from), `mutant setup: ${from.slice(0, 50)} is in ${rel}`); next.heads[rel] = next.heads[rel].replace(from, to); return next }

mutate('a flag read loosely (!== "false")', () => swapHead('app/(app)/settings/security/page.tsx', 'NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === "true"', 'NEXT_PUBLIC_STUDIO_LAUNCH_WORDING !== "false"'))
mutate('a flag read as a truthy value', () => swapHead('app/help/page.tsx', 'process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === "true"', 'process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING'))
mutate('the words list imported by a page', () => swapHead('app/help/page.tsx', 'const STUDIO_HELP =', "import { launchWord } from '@/lib/studio-launch-wording'\nconst STUDIO_HELP ="))
mutate('the flag documented as default "true"', () => swapHead('.env.example', 'NEXT_PUBLIC_STUDIO_LAUNCH_WORDING="false"', 'NEXT_PUBLIC_STUDIO_LAUNCH_WORDING="true"'))
mutate('an edit left out of the strip (the file differs from the base with the strip applied)', () => swapHead('app/help/page.tsx', 'Share a published link with your team', 'Share a link with your team'))
mutate('the flag-off branch changed (the old sentence reworded)', () => swapHead('app/(app)/settings/security/page.tsx', 'App-level TOTP is planned for a future release.', 'App-level TOTP is planned for later.'))
mutate('a base line dropped from a touched file', () => swapHead('app/(app)/dashboard/page.tsx', 'import Link from "next/link"\n', ''))
mutate('a launched sentence promising a release', () => withWords(text => text.replace("launched: 'Via Google'", "launched: 'Coming soon'")))
mutate('a launched sentence that is the old sentence', () => withWords(text => text.replace("launched: 'Via Google'", "launched: 'Planned'")))
mutate('a launched sentence with "yet"', () => withWords(text => text.replace("launched: 'Colors above are editable.'", "launched: 'Colors above are editable yet.'")))
mutate('a launched sentence naming a version', () => withWords(text => text.replace("launched: 'Reusable templates from your own decks'", "launched: 'Reusable templates arrive in v2.1'")))
mutate('a launched sentence that is not in the file', () => withWords(text => text.replace("launched: 'Share a published link with your team'", "launched: 'Share a link with your whole team'")))
mutate('a today sentence that was never in the base', () => withWords(text => text.replace("today: 'Collaborate with team members by sharing presentations'", "today: 'Collaborate with colleagues by sharing presentations'")))
mutate('a duplicate id', () => withWords(text => text.replace("id: 'help-tip'", "id: 'help-share'")))
mutate('a greyed control gone from the source', () => swapHead('app/(app)/settings/notifications/page.tsx', 'const disabled = LAUNCH_WORDING || !owner', 'const disabled = !owner'))
mutate('the Folders block drawn with the flag on', () => swapHead('app/(app)/dashboard/page.tsx', '{!LAUNCH_WORDING && <div data-studio-deck-folders="true"', '{<div data-studio-deck-folders="true"'))
mutate('a pure word file reading the flag (it must read no environment)', () => clone(), { sources: { 'lib/studio-model-catalog.ts': baseOf('lib/studio-model-catalog.ts') + "\nexport const LAUNCH = process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === 'true'\n" } })
mutate('a pure word file with one sentence reworded', () => clone(), { sources: { 'lib/studio-intelligence-p2.ts': baseOf('lib/studio-intelligence-p2.ts').replace('pick models yet', 'pick models') } })
mutate('a flag that "1" turns on', () => swapHead('app/help/page.tsx', 'process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === "true"', 'process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === "1" || process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === "true"'))
mutate('the words list reading the environment', () => withWords(text => text + "\nexport const LAUNCH_ON = process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === 'true'\n"), { sources: { [WORDS_LIB]: input.wordsSource + "\nexport const LAUNCH_ON = process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === 'true'\n" } })
mutate('a strip that puts the wrong text back', () => clone(), { strip: (rel, text) => stripLaunchWording(rel, text).replace('Collaborate with team members', 'Collaborate with team mates') })

for (const [label, edit, extra] of mutants) {
  let caught = false
  try {
    const next = edit()
    caught = suite({ ...next }, extra).some(([, ok]) => !ok)
  } catch { caught = true }
  results.push([`mutant caught: ${label}`, caught, caught ? undefined : 'not caught'])
}
const control = suite(input)
results.push(['control: the suite passes on the real tree after all the mutants', control.every(([, ok]) => ok), control.find(([, ok]) => !ok)?.[2]])

let failed = 0
for (const [label, ok, why] of results) { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `: ${why}`}`) }
console.log(`\n${results.length - failed}/${results.length} checks, ${mutants.length} mutants`)
process.exit(failed ? 1 : 0)
