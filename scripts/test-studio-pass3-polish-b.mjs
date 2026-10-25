// FRONTEND-2 (PROGRAM-1 Saturday evening push, 24 Oct: the Pass 3 polish set, PR B, stacked on PR A): proof for the flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time; the SAME flag as PR A).
// PR B holds the audit's finding #7 (POLISH-AUDIT.md) where it is reachable: the browser's native alert() of the viewer's failed save and of the Builder's two failed session creations become the Studio toast,
// in plain words, and the code after each is the same. (The viewer's discard-edits confirm() is NOT here: handleCancelEdits has no caller at the dev head, so a dialog could never appear.)
// Run: node scripts/test-studio-pass3-polish-b.mjs   (plain node: TypeScript transpiled and run in a vm, `git show` reads the base commit; no network, no browser, no model call)
//
//   1. lib        the flag is PR A's constant (exact "true", and only with the Studio shell); the words, exactly; the second Builder message
//   2. pin        the viewer and the Builder page without this change's marked lines (marker PASS3-POLISH-B) are BASE_COMMIT's files byte for byte; every added line carries the marker; no base line changes; the marked
//                 lines are exactly the ones listed here
//   3. viewer     the REAL handleSaveChanges runs in a vm with stubs: flag off, every scenario leaves the SAME trace as the base commit's code (sha256: a failed save raises the same alert); flag on: a failed save is a
//                 toast with the plain words and no alert, a good save is unchanged
//   4. builder    the two alert sites, extracted from the REAL page and run: flag off the alerts are the base's (same words, same return); flag on a toast with the plain words and the same return
//   5. change     the strip (one rule), the registry (two lines), the older pins that read these files (one registry-read edit each, nothing else changed in them), scope (the COMMITTED diff only), no secret
//   6. mutants    each one must make sections 1-5 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  BASE_COMMIT, PASS3_POLISH_B_BUILDER, PASS3_POLISH_B_FILES, PASS3_POLISH_B_NEW_FILES, PASS3_POLISH_B_PIN_EDITS, PASS3_POLISH_B_PIN_FILES, PASS3_POLISH_B_PIN_MARK, putBackPin, PASS3_POLISH_B_SCOPE_FILES, PASS3_POLISH_B_VIEWER, PASS3_POLISH_MARKER, stripPass3PolishB,
} from './studio-pass3-polish-b-strip.mjs'
import { LATER_CHANGE_FILES, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'
import { stripPass3Polish } from './studio-pass3-polish-strip.mjs' // PR A's strip (marker PASS3-POLISH): this PR is stacked on PR A, whose own lines are in the Builder page

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const jsxRuntime = nodeRequire('react/jsx-runtime')
const BASE = process.env.PASS3_POLISH_B_BASE || BASE_COMMIT
const A_HEAD = '3db2f0a3fcdbe89514e6e14b4fbca12adeaa0304' // PR A's pushed head (frontend2/pass3-polish): this PR is stacked on it
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
// This change's OWN committed files: the non-merge commits on the first-parent line BASE..HEAD. The working tree is never consulted (the suites of other changes write into docs/ and scripts/).
const ownCommitted = () => [...new Set(git('log', '--first-parent', '--no-merges', '--name-only', '--format=', `${BASE}..HEAD`).split('\n').filter(Boolean))]
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
let overrides = {} // in-memory mutations: every proof reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), deep = count(assert.deepEqual), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const VIEWER = PASS3_POLISH_B_VIEWER, BUILDER_PAGE = PASS3_POLISH_B_BUILDER, PAGE = BUILDER_PAGE
const LIB = 'lib/studio-pass3-polish-b.ts'
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-pass3-polish-b-strip.mjs', THIS_TEST = 'scripts/test-studio-pass3-polish-b.mjs'
const FLAG = 'NEXT_PUBLIC_STUDIO_PASS3_POLISH', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const ON = { [FLAG]: 'true', [SHELL]: 'true' }
const OFF_STATES = [{}, { [FLAG]: 'true' }, { [SHELL]: 'true' }, { [FLAG]: 'false', [SHELL]: 'true' }, { [FLAG]: 'TRUE', [SHELL]: 'true' }, { [FLAG]: '1', [SHELL]: 'true' }, { [FLAG]: '', [SHELL]: 'true' }, { [FLAG]: ' true', [SHELL]: 'true' }, { [FLAG]: 'true', [SHELL]: 'false' }]

// the words, exactly (the native messages they replace are in the lib's comment and in the traces below)
const WORDS = {
  saveFailed: { title: 'Your changes were not saved', description: 'Something went wrong while saving. Please try again.' },
  deckStartFailed: { title: 'Could not start your deck', description: 'Please check your connection and try again.' },
  deckStartError: { title: 'Could not start your deck' },
}
const NATIVE = { save: 'Failed to save changes. Please try again.', create: 'Failed to create session. Please check your connection and try again.' }

// ---------------------------------------------------------------- loading: the real TypeScript in a vm
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
function loadTs(rel, text, { env = {}, mocks = {}, globals = {} } = {}) {
  const module = { exports: {} }
  const req = spec => {
    if (Object.prototype.hasOwnProperty.call(mocks, spec)) return mocks[spec]
    if (spec === 'react/jsx-runtime') return jsxRuntime
    throw new Error(`unexpected import ${spec} in ${rel}`)
  }
  vm.runInNewContext(compile(rel, text), { module, exports: module.exports, require: req, process: { env }, Error, ...globals }, { filename: rel })
  return module.exports
}
const A_LIB = 'lib/studio-pass3-polish.ts' // PR A's lib: the flag (exact "true" + the Studio shell)
const libOf = (env, text = read(LIB)) => loadTs(LIB, text, { env, mocks: { './studio-pass3-polish': loadTs(A_LIB, read(A_LIB), { env }) } })

// ---------------------------------------------------------------- 1. the lib
function proveLib(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  eq(libOf(ON, text).STUDIO_PASS3_POLISH_B_ENABLED, true, a('lib: flag and shell on'))
  for (const state of OFF_STATES) eq(libOf(state, text).STUDIO_PASS3_POLISH_B_ENABLED, false, a(`lib: ${JSON.stringify(state)} is off`))
  const lib = libOf(ON, text)
  deep(plain(lib.STUDIO_POLISH_COPY), WORDS, a('lib: the words'))
  eq(lib.deckStartErrorDescription(new Error('Network down')), 'Network down. Please try refreshing the page.', a('lib: second Builder message, an Error'))
  eq(lib.deckStartErrorDescription('boom'), 'Unknown error. Please try refreshing the page.', a('lib: second Builder message, not an Error'))
  eq(lib.deckStartErrorDescription(undefined), 'Unknown error. Please try refreshing the page.', a('lib: second Builder message, nothing'))
  deep(text.split('\n').filter(line => /^import |require\(/.test(line)), ["import { STUDIO_PASS3_POLISH_ENABLED } from './studio-pass3-polish'"], a('lib: its only import is PR A\'s flag'))
  match(text, /export const STUDIO_PASS3_POLISH_B_ENABLED = STUDIO_PASS3_POLISH_ENABLED\n/, a('lib: the flag is PR A\'s constant, not a rule of its own'))
  nomatch(text, /process\.env/, a('lib: it reads no environment variable itself'))
  const allWords = JSON.stringify(plain(lib.STUDIO_POLISH_COPY)).replace(/"[A-Za-z]+":/g, '') // the words only, not the keys
  for (const word of ['strawman', 'Strawman', 'session', 'Failed', 'Complete a']) nomatch(allWords, new RegExp(word), a(`lib: the plain words do not say "${word}"`))
}

// ---------------------------------------------------------------- 2. the pins
// The code part of each marked line (the text before its trailing "// PASS3-POLISH ..." comment, or the whole line for a JSX one): what this change adds, exactly.
const ADDED = {
  [VIEWER]: [
    "import { STUDIO_PASS3_POLISH_B_ENABLED, STUDIO_POLISH_COPY } from '@/lib/studio-pass3-polish-b'",
    "      if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' }); return }",
  ],
  [BUILDER_PAGE]: [
    "import { STUDIO_PASS3_POLISH_B_ENABLED, STUDIO_POLISH_COPY, deckStartErrorDescription } from '@/lib/studio-pass3-polish-b'",
    "            if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.deckStartFailed, variant: 'destructive' }); return }",
    "          if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.deckStartError, description: deckStartErrorDescription(error), variant: 'destructive' }); return }",
  ],
}
const codeOf = line => { const at = line.indexOf(PASS3_POLISH_MARKER); return line.slice(0, Math.max(line.lastIndexOf('//', at), line.lastIndexOf('/*', at))).trimEnd() } // the text before the "// PASS3-POLISH ..." (or "/* PASS3-POLISH ... */") comment
function provePin(rel, text, at = '', stripFn = stripPass3PolishB) {
  const a = message => (at ? `${at}: ${message}` : message)
  const base = baseOf(rel)
  // PR A's lines (marker PASS3-POLISH, three in the Builder page) are in the stacked tree too: with this change's lines AND PR A's out, the file is the base's
  eq(sha(stripPass3Polish(rel, stripFn(rel, text))), sha(base), a(`${rel}: without this change's lines (and PR A's) it is ${BASE.slice(0, 8)}'s file byte for byte`))
  eq(stripFn(rel, text).split('\n').filter(line => line.includes('PASS3-POLISH')).length, rel === BUILDER_PAGE ? 3 : 0, a(`${rel}: with only this change's lines out, nothing is left but PR A's own three (Builder page)`))
  const lines = text.split('\n')
  const marked = lines.filter(line => line.includes(PASS3_POLISH_MARKER))
  deep(marked.map(codeOf), ADDED[rel], a(`${rel}: the marked lines are exactly the ones this change adds, in order`))
  // no base line changes: the lines without the marker are the base's lines, in order
  deep(lines.filter(line => !line.includes('PASS3-POLISH')), base.split('\n'), a(`${rel}: every other line is the base's, in order (PR A's marked lines aside)`))
  eq(lines.filter(line => line.includes(PASS3_POLISH_MARKER)).length, ADDED[rel].length, a(`${rel}: only the added lines carry the marker`))
  // the native calls are still where they were
  const nativeCalls = source => source.split('\n').filter(line => /\b(confirm|alert)\(/.test(line) && !line.includes(PASS3_POLISH_MARKER))
  deep(nativeCalls(text), nativeCalls(base), a(`${rel}: every native confirm() / alert() line of the base is still there, untouched`))
  eq(stripFn(rel, stripFn(rel, text)), stripFn(rel, text), a(`${rel}: stripping twice changes nothing more`))
}

// ---------------------------------------------------------------- 3. the viewer's handlers, run
function sliceOf(text, from, to) {
  const start = text.indexOf(from), end = text.indexOf(to, start)
  assert.ok(start !== -1 && end !== -1 && end > start, `viewer: cannot find the slice ${from.slice(0, 40)} .. ${to.slice(0, 30)}`)
  return text.slice(start, end)
}
function viewerHarness(text, env, behaviour) {
  const calls = []
  const lib = libOf(env)
  const slice = sliceOf(text, '  const handleSaveChanges = useCallback(', '  // Add slide handler')
  const code = `(function (e) { const { iframeRef, studioShell, beginStudioViewerInteraction, studioSaveRequestRef, setIsSaving, sendCommand, debugLog, setIsEditMode, onEditModeChange, toast, alert, confirm, window, useCallback, useState, useRef, STUDIO_PASS3_POLISH_B_ENABLED, STUDIO_POLISH_COPY } = e\n${slice}\nreturn { handleSaveChanges, handleCancelEdits, confirmStudioDiscard: typeof confirmStudioDiscard === 'undefined' ? undefined : confirmStudioDiscard }\n})`
  const rec = (name, ...args) => calls.push(`${name}:${args.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join('|')}`)
  const native = message => { rec('confirm', message); return behaviour.confirm }
  const make = vm.runInNewContext(compile('viewer-slice.tsx', code), { Error, console: { error() {}, log() {} } })
  const api = make({
    iframeRef: { current: { id: 'frame' } }, studioShell: true,
    beginStudioViewerInteraction: () => ({ iframe: { id: 'frame' }, isCurrent: () => true, isSourceCurrent: () => true }),
    studioSaveRequestRef: { current: null }, setIsSaving: value => rec('setIsSaving', value),
    sendCommand: async (frame, command) => { rec('sendCommand', command); if (behaviour.failCommand === command) throw new Error('command failed') },
    debugLog: () => {}, setIsEditMode: value => rec('setIsEditMode', value), onEditModeChange: value => rec('onEditModeChange', value),
    toast: value => rec('toast', value), alert: message => rec('alert', message), confirm: native, window: { confirm: native },
    useCallback: fn => fn, useState: initial => { let v = initial; return [v, value => { v = value; rec('setStudioDiscardAsk', value) }] }, useRef: initial => ({ current: initial }),
    STUDIO_PASS3_POLISH_B_ENABLED: lib.STUDIO_PASS3_POLISH_B_ENABLED, STUDIO_POLISH_COPY: lib.STUDIO_POLISH_COPY,
  })
  return { api, calls }
}
// scenarios: [name, behaviour, steps]; a step is a function (api) => promise
const SCENARIOS = [
  ['save ok', {}, async api => { await api.handleSaveChanges() }],
  ['save fails', { failCommand: 'saveAllChanges' }, async api => { await api.handleSaveChanges() }],
  ['save fails twice', { failCommand: 'saveAllChanges' }, async api => { await api.handleSaveChanges(); await api.handleSaveChanges() }],
]
const trace = (text, env, scenarios = SCENARIOS) => scenarios.map(([name, behaviour, run]) => { const h = viewerHarness(text, env, behaviour); return run(h.api).then(() => [name, h.calls]) })
async function proveViewer(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  // flag off: every scenario leaves the base commit's trace
  const baseTraces = await Promise.all(trace(baseOf(VIEWER), {}))
  for (const state of OFF_STATES) deep(await Promise.all(trace(text, state)), baseTraces, a(`viewer: flag off (${JSON.stringify(state)}): every trace equals the base commit's`))
  const offHash = sha(JSON.stringify(await Promise.all(trace(text, {}))))
  eq(offHash, sha(JSON.stringify(baseTraces)), a('viewer: flag off, sha256 of all traces equals the base commit\'s'))
  const baseByName = Object.fromEntries(baseTraces)
  deep(baseByName['save fails'].filter(x => x.startsWith('alert')), [`alert:${NATIVE.save}`], a('viewer: base: the save alert'))
  // flag on
  const on = Object.fromEntries(await Promise.all(trace(text, ON)))
  deep(on['save ok'], baseByName['save ok'], a('viewer: flag on: a good save is unchanged'))
  const toast = `toast:${JSON.stringify({ ...WORDS.saveFailed, variant: 'destructive' })}`
  deep(on['save fails'].filter(x => x.startsWith('toast') || x.startsWith('alert')), [toast], a('viewer: flag on: a failed save is a toast with the plain words, and no alert'))
  deep(on['save fails'].filter(x => !x.startsWith('toast')), baseByName['save fails'].filter(x => !x.startsWith('alert')), a('viewer: flag on: a failed save otherwise does what it did (the finally block runs)'))
  deep(on['save fails twice'].filter(x => x.startsWith('toast') || x.startsWith('alert')), [toast, toast], a('viewer: flag on: every failed save is one toast'))
  return offHash
}

function builderSnippets(text) {
  const first = text.match(/console\.error\('createSession returned null'\)\n([\s\S]*?\n\s*return\n)/)
  const second = text.match(/console\.error\('Error creating session:', error\)\n([\s\S]*?\n\s*return\n)/)
  assert.ok(first && second, 'builder: cannot find the two alert sites')
  return { first: first[1], second: second[1] }
}
function runSnippet(snippet, env, error) {
  const calls = []
  const lib = libOf(env)
  const fn = vm.runInNewContext(compile('builder-snippet.tsx', `(function (e) { const { toast, alert, STUDIO_PASS3_POLISH_B_ENABLED, STUDIO_POLISH_COPY, deckStartErrorDescription, error } = e\n${snippet}\nreturn 'fell through'\n})`), { Error })
  const result = fn({ toast: value => calls.push(`toast:${JSON.stringify(value)}`), alert: message => calls.push(`alert:${message}`), STUDIO_PASS3_POLISH_B_ENABLED: lib.STUDIO_PASS3_POLISH_B_ENABLED,
    STUDIO_POLISH_COPY: lib.STUDIO_POLISH_COPY, deckStartErrorDescription: lib.deckStartErrorDescription, error })
  return { calls, result }
}
function proveBuilder(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const head = builderSnippets(text), base = builderSnippets(baseOf(BUILDER_PAGE))
  const errors = [new Error('Network down'), new Error('Session limit reached'), 'plain string', undefined]
  const hashes = []
  for (const state of OFF_STATES) {
    deep(runSnippet(head.first, state), runSnippet(base.first, {}), a(`builder: flag off (${JSON.stringify(state)}): alert 1 is the base's, with its return`))
    for (const error of errors) deep(runSnippet(head.second, state, error), runSnippet(base.second, {}, error), a(`builder: flag off (${JSON.stringify(state)}): alert 2 is the base's`))
  }
  for (const error of errors) hashes.push(runSnippet(head.second, {}, error))
  hashes.push(runSnippet(head.first, {}))
  eq(sha(JSON.stringify(hashes)), sha(JSON.stringify([...errors.map(error => runSnippet(base.second, {}, error)), runSnippet(base.first, {})])), a('builder: flag off, sha256 of the outputs equals the base commit\'s'))
  deep(runSnippet(base.first, {}), { calls: [`alert:${NATIVE.create}`], result: undefined }, a('builder: the base says what the proof expects (alert 1)'))
  deep(runSnippet(head.first, ON), { calls: [`toast:${JSON.stringify({ ...WORDS.deckStartFailed, variant: 'destructive' })}`], result: undefined }, a('builder: flag on: alert 1 is a toast with the plain words, no alert, the same return'))
  for (const error of errors) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    deep(runSnippet(head.second, ON, error), { calls: [`toast:${JSON.stringify({ ...WORDS.deckStartError, description: `${message}. Please try refreshing the page.`, variant: 'destructive' })}`], result: undefined }, a(`builder: flag on: alert 2 is a toast (${message})`))
    deep(runSnippet(base.second, {}, error).calls, [`alert:Failed to create session: ${message}. Please try refreshing the page.`], a(`builder: the base says what the proof expects (alert 2, ${message})`))
  }
}

// ---------------------------------------------------------------- 5. the change: strip, registry, older pins, scope, secret scan
function proveChange(stripFn, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  eq(stripFn('app/(app)/layout.tsx', 'x // PASS3-POLISH-B\n'), 'x // PASS3-POLISH-B\n', a('strip: another file comes back untouched'))
  eq(stripFn(VIEWER, 5), 5, a('strip: a non-string comes back'))
  eq(stripFn('.env.example', 'NEXT_PUBLIC_STUDIO_PASS3_POLISH="false" # PASS3-POLISH-B\n'), 'NEXT_PUBLIC_STUDIO_PASS3_POLISH="false" # PASS3-POLISH-B\n', a('strip: .env.example is not its file (the flag block is PR A\'s)'))
  eq(stripFn(VIEWER, 'a\nb // PASS3-POLISH-B x\nc\n'), 'a\nc\n', a('strip: a marked line goes, the rest stays'))
  eq(stripFn(VIEWER, 'a\nb\n'), 'a\nb\n', a('strip: a file with nothing to strip is untouched'))
  eq(stripFn('app/(app)/layout.tsx', 'a // PASS3-POLISH-B\n'), 'a // PASS3-POLISH-B\n', a('strip: the account layout is not its file (PR A\'s)'))
  eq(stripFn('app/(app)/dashboard/page.tsx', 'a // PASS3-POLISH-B\n'), 'a // PASS3-POLISH-B\n', a('strip: the Decks page is not its file (nothing of this change is in it)'))
  deep(PASS3_POLISH_B_FILES, [VIEWER, BUILDER_PAGE], a('strip: the two files'))
  eq(PASS3_POLISH_MARKER, 'PASS3-POLISH-B', a('strip: its own marker'))
  ok([...PASS3_POLISH_B_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = registryText.split('\n').filter(line => !baseOf(REGISTRY).split('\n').includes(line))
  const mine = added.filter(line => line.includes('studio-pass3-polish-b-strip.mjs'))
  eq(mine.length, 2, a('registry: this change adds two lines to it (its files, its strip)'))
  ok(mine.every(line => line.includes('LATER-CHANGE')), a('registry: both lines carry LATER-CHANGE'))
  ok(mine.some(line => line.includes('PASS3_POLISH_B_SCOPE_FILES')) && mine.some(line => line.includes('stripPass3PolishB')), a('registry: one names the files, one the strip'))
  ok(added.every(line => line.includes('LATER-CHANGE') || /pass3-polish/i.test(line)), a('registry: nothing else in it changed'))
  eq(registryText.split('\n').filter(line => !added.includes(line)).join('\n'), baseOf(REGISTRY), a('registry: without the added lines it is the base\'s file'))
  ok(LATER_STRIPS.includes(stripPass3PolishB) || LATER_STRIPS.some(fn => fn.name === 'stripPass3PolishB'), a('registry: holds the strip'))
  ok([...PASS3_POLISH_B_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('registry: names every file of this change'))
}
function provePinEdits(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  deep([...PASS3_POLISH_B_PIN_FILES].sort(), ['scripts/studio-chat-harness/page-extract.mjs', 'scripts/test-studio-blocked-send-feedback.mjs', 'scripts/test-studio-first-paint-viewer.mjs', 'scripts/test-studio-rail-add-slide.mjs', 'scripts/test-studio-version-history-v2.mjs'], a('pins: the older pins (and the chat harness helper) that failed on this change\'s lines and passed on the base'))
  for (const rel of PASS3_POLISH_B_PIN_FILES) {
    nomatch(rel, /p2-|launch-wording|env-append|route-params|admin-email/, a(`pins: ${rel} is not one of FRONTEND-1's tests`))
    const text = read(rel)
    eq(sha(putBackPin(rel, text)), sha(baseOf(rel)), a(`pins: ${rel} with this change's lines put back is the base commit's file byte for byte`))
    for (const [has, base] of PASS3_POLISH_B_PIN_EDITS[rel]) {
      eq(text.split(has).length - 1, 1, a(`pins: ${rel}: each edit occurs once`))
      ok(has.split('\n').filter(Boolean).every(line => line.includes(PASS3_POLISH_B_PIN_MARK)), a(`pins: ${rel}: every line of an edit carries the marker comment`))
      ok(base === '' || base.split('\n').filter(Boolean).length === has.split('\n').filter(Boolean).length, a(`pins: ${rel}: an edit changes as many lines as it replaces (or adds an import)`))
    }
    ok(/stripLaterChanges|stripPass3PolishB/.test(text), a(`pins: ${rel}: reads the viewer through a later-change strip`))
  }
  // the registry read is the one the registry documents: rail-add-slide and version-history-v2 call stripLaterChanges innermost; COMPOSER-2's pin takes only this change's lines out (the registry would take its own first-paint lines out too)
  match(read('scripts/test-studio-version-history-v2.mjs'), /stripLaunchWording\(rel, stripLaterChanges\(rel, fs\.readFileSync/, a('pins: version-history-v2 calls stripLaterChanges innermost'))
  match(read('scripts/test-studio-rail-add-slide.mjs'), /stripLaunchWording\(rel, stripLaterChanges\(rel, fs\.readFileSync/, a('pins: rail-add-slide calls stripLaterChanges innermost'))
  match(read('scripts/test-studio-first-paint-viewer.mjs'), /stripPass3PolishB\(rel, fs\.readFileSync/, a('pins: first-paint-viewer takes only this change\'s lines out'))
  match(read('scripts/test-studio-blocked-send-feedback.mjs'), /stripLaterChanges\('app\/builder\/page\.tsx', read\('app\/builder\/page\.tsx'\)\)/, a('pins: blocked-send-feedback reads the Builder page through the registry'))
  match(read('scripts/studio-chat-harness/page-extract.mjs'), /stripLaterChanges\(file\.endsWith\('app\/builder\/page\.tsx'\)/, a('pins: the chat harness reads the Builder page through the registry'))
}
function proveRegistryStripsToBase(texts, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of PASS3_POLISH_B_FILES) eq(sha(stripLaterChanges(rel, texts[rel])), sha(stripLaterChanges(rel, baseOf(rel))), a(`${rel}: through the registry (innermost, as every older pin reads it) it is the base commit's file`))
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const rel of PASS3_POLISH_B_SCOPE_FILES) nomatch(rel, /^app\/admin|^components\/admin|^app\/docs|^components\/studio-docs|^app\/help|^components\/help|^app\/p\/|publish|published|^components\/settings|^app\/\(app\)\/settings|^app\/\(app\)\/billing|^components\/billing|user-profile-menu|launch-wording|studio-p2-/, a(`scope: ${rel} is not in FRONTEND-1's areas`))
  const committed = ownCommitted()
  const stray = committed.filter(rel => !PASS3_POLISH_B_SCOPE_FILES.has(rel) && !LATER_CHANGE_FILES.has(rel))
  deep(stray, [], a(`every file in the committed diff ${BASE.slice(0, 8)}..HEAD is this change's or a registered later change's (no older test is edited)`))
  if (committed.length) {
    deep([...PASS3_POLISH_B_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    ok(committed.filter(rel => /^scripts\/test-/.test(rel)).every(rel => rel === THIS_TEST || LATER_CHANGE_FILES.has(rel)), a('the only test it adds or edits is its own'))
    // PR B is stacked on PR A (3db2f0a3, pushed): A_HEAD..HEAD is this PR's own commits; .env.example (the flag's block) is PR A's and is not touched here
    try { git('merge-base', '--is-ancestor', A_HEAD, 'HEAD') ; ok(!git('log', '--first-parent', '--no-merges', '--name-only', '--format=', `${A_HEAD}..HEAD`).split('\n').includes('.env.example'), a('.env.example is not touched by this PR\'s own commits (the flag\'s block is PR A\'s)')) } catch { /* PR A's head is not an ancestor (the stack was rebased): nothing to compare */ }
  }
}
function proveSecretScan(texts, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [LIB, STRIP_MODULE, THIS_TEST].map(rel => (rel in texts ? texts[rel] : read(rel))).concat(PASS3_POLISH_B_FILES.flatMap(rel => texts[rel].split('\n').filter(line => line.includes(PASS3_POLISH_MARKER)))).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
}

// ---------------------------------------------------------------- run everything
async function proveAll(stripFn = stripPass3PolishB, at = '') {
  const texts = { [VIEWER]: read(VIEWER), [BUILDER_PAGE]: read(BUILDER_PAGE) }
  proveLib(read(LIB), at)
  for (const rel of PASS3_POLISH_B_FILES) provePin(rel, texts[rel], at, stripFn)
  const offHash = await proveViewer(texts[VIEWER], at)
  proveBuilder(texts[BUILDER_PAGE], at)
  proveChange(stripFn, at)
  proveRegistry(read(REGISTRY), at)
  proveRegistryStripsToBase(texts, at)
  provePinEdits(at)
  proveScope(at)
  proveSecretScan(texts, at)
  return offHash
}
const offHash = await proveAll()
console.log(`flag off: viewer and Builder output sha256 == base ${offHash.slice(0, 16)} (${OFF_STATES.length} off states each)`)
console.log(`PASS lib, pins, viewer, builder, change: ${checks} checks`)

// =========================================================== 8. mutants
const killed = [], survived = []
async function mutant(name, edits, { strip = stripPass3PolishB, only = '' } = {}) {
  const before = overrides
  try {
    overrides = { ...before }
    for (const [rel, from, to, mode] of edits) { // mode: none = the text occurs once; 'first' = the first of several; 'all' = every one
      const source = read(rel), n = source.split(from).length - 1
      assert.ok(mode ? n >= 1 : n === 1, `mutant "${name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = mode === 'all' ? source.split(from).join(to) : source.replace(from, () => to)
    }
    if (only === 'behaviour') { // the executed proofs alone (no text pin, no exact-lines check): the behaviour itself must catch the mutant
      await proveViewer(read(VIEWER), name); proveBuilder(read(BUILDER_PAGE), name)
    } else await proveAll(strip, name)
  } catch (error) {
    if (/no longer applies/.test(String(error.message))) throw error
    killed.push(name); if (process.env.PASS3_POLISH_B_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
// lib
await mutant('lib: the flag is always on', [[LIB, 'export const STUDIO_PASS3_POLISH_B_ENABLED = STUDIO_PASS3_POLISH_ENABLED', 'export const STUDIO_PASS3_POLISH_B_ENABLED = true']])
await mutant('lib: the flag has a rule of its own, looser than PR A\'s', [[LIB, 'export const STUDIO_PASS3_POLISH_B_ENABLED = STUDIO_PASS3_POLISH_ENABLED', "export const STUDIO_PASS3_POLISH_B_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true'"]])
await mutant('lib: the save toast is not plain', [[LIB, "title: 'Your changes were not saved'", "title: 'Failed to save changes'"]])
await mutant('lib: the Builder toast says "session"', [[LIB, "deckStartFailed: { title: 'Could not start your deck'", "deckStartFailed: { title: 'Failed to create session'"]])
await mutant('lib: the second Builder message loses "Unknown error"', [[LIB, "error instanceof Error ? error.message : 'Unknown error'", "error instanceof Error ? error.message : ''"]])
await mutant('lib: the second Builder message loses the advice', [[LIB, '. Please try refreshing the page.`', '.`']])
// viewer
await mutant('viewer: the save toast also raises the alert (no return)', [[VIEWER, "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' }); return }", "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' }) }"]])
await mutant('viewer: the save toast ignores the flag', [[VIEWER, "      if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.saveFailed", "      if (true) { toast({ ...STUDIO_POLISH_COPY.saveFailed"]])
await mutant('viewer: the save toast is not destructive', [[VIEWER, "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' })", "toast({ ...STUDIO_POLISH_COPY.saveFailed })"]])
await mutant('viewer: the save toast says the Builder words', [[VIEWER, 'STUDIO_POLISH_COPY.saveFailed,', 'STUDIO_POLISH_COPY.deckStartFailed,']])
await mutant('viewer: a base line changed (the native message)', [[VIEWER, "alert('Failed to save changes. Please try again.')", "alert('Save failed.')"]])
await mutant('viewer: the base alert line is gone', [[VIEWER, "      alert('Failed to save changes. Please try again.')\n", '']])
await mutant('viewer: the confirm is gone (an unrelated base line)', [[VIEWER, "if (!confirm('Are you sure you want to discard all changes?')) {", 'if (false) {']])
// builder
await mutant('builder: alert 1 toast without the return', [[PAGE, "toast({ ...STUDIO_POLISH_COPY.deckStartFailed, variant: 'destructive' }); return }", "toast({ ...STUDIO_POLISH_COPY.deckStartFailed, variant: 'destructive' }) }"]])
await mutant('builder: alert 2 toast without the return', [[PAGE, "description: deckStartErrorDescription(error), variant: 'destructive' }); return }", "description: deckStartErrorDescription(error), variant: 'destructive' }) }"]])
await mutant('builder: alert 1 ignores the flag', [[PAGE, "            if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.deckStartFailed", "            if (true) { toast({ ...STUDIO_POLISH_COPY.deckStartFailed"]])
await mutant('builder: alert 2 ignores the flag', [[PAGE, "          if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.deckStartError", "          if (true) { toast({ ...STUDIO_POLISH_COPY.deckStartError"]])
await mutant('builder: alert 2 loses the error message', [[PAGE, 'description: deckStartErrorDescription(error), variant', "description: STUDIO_POLISH_COPY.deckStartFailed.description, variant"]])
await mutant('builder: a base alert line changed', [[PAGE, "alert('Failed to create session. Please check your connection and try again.')", "alert('Failed to create session.')"]])
// behaviour alone: the same kinds of mutant, caught by running the real handler / alert sites, with the text pins switched off
const BEH = { only: 'behaviour' }
await mutant('behaviour: the save toast also raises the alert', [[VIEWER, "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' }); return }", "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' }) }"]], BEH)
await mutant('behaviour: the save toast ignores the flag', [[VIEWER, "      if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.saveFailed", "      if (true) { toast({ ...STUDIO_POLISH_COPY.saveFailed"]], BEH)
await mutant('behaviour: the save toast is not destructive', [[VIEWER, "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' })", "toast({ ...STUDIO_POLISH_COPY.saveFailed })"]], BEH)
await mutant('behaviour: the Builder toast has no return', [[PAGE, "toast({ ...STUDIO_POLISH_COPY.deckStartFailed, variant: 'destructive' }); return }", "toast({ ...STUDIO_POLISH_COPY.deckStartFailed, variant: 'destructive' }) }"]], BEH)
await mutant('behaviour: the second Builder toast loses the message', [[PAGE, 'description: deckStartErrorDescription(error), variant', "description: STUDIO_POLISH_COPY.deckStartFailed.description, variant"]], BEH)
await mutant('behaviour: the second Builder toast ignores the flag', [[PAGE, "          if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.deckStartError", "          if (true) { toast({ ...STUDIO_POLISH_COPY.deckStartError"]], BEH)
// change
await mutant('strip: the marked lines stay', [], { strip: (rel, text) => text })
await mutant('strip: an unmarked line goes too', [], { strip: (rel, text) => (PASS3_POLISH_B_FILES.includes(rel) ? text.split('\n').filter(line => !line.includes(PASS3_POLISH_MARKER)).slice(0, -2).join('\n') : text) })
await mutant('pins: version-history-v2 reads the viewer without the registry', [['scripts/test-studio-version-history-v2.mjs', 'stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), \'utf8\')))', 'stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), \'utf8\'))']])
await mutant('pins: blocked-send-feedback reads the Builder page without the registry', [['scripts/test-studio-blocked-send-feedback.mjs', "const pageText = stripLaterChanges('app/builder/page.tsx', read('app/builder/page.tsx'))", "const pageText = read('app/builder/page.tsx')"]])
await mutant('pins: the chat harness reads the Builder page without the registry', [['scripts/studio-chat-harness/page-extract.mjs', "const text = stripLaterChanges(file.endsWith('app/builder/page.tsx') ? 'app/builder/page.tsx' : file, fs.readFileSync(file, 'utf8'))", "const text = fs.readFileSync(file, 'utf8')"]])
await mutant('pins: a base line of rail-add-slide changed', [['scripts/test-studio-rail-add-slide.mjs', "const BASE_COMMIT = process.env.RAIL_ADD_SLIDE_BASE || 'bb5a89f'", "const BASE_COMMIT = process.env.RAIL_ADD_SLIDE_BASE || 'bb5a89e'"]])
await mutant('pins: the marker comment is missing from an edit', [['scripts/test-studio-first-paint-viewer.mjs', "const read = rel => stripPass3PolishB(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (PASS3-POLISH-B)", "const read = rel => stripPass3PolishB(rel, fs.readFileSync(path.join(root, rel), 'utf8'))"]])
await mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-pass3-polish-b-strip.mjs')).stripPass3PolishB, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR B (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n", '']])
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-pass3-polish-b-strip.mjs')).PASS3_POLISH_B_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR B (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)\n", '']])
const FAKE_NAME = ['api', 'Key', 'Value'].join(''), FAKE_VALUE = ['abcdef', '1234567890'].join('') // built here so that this file carries no credential-shaped literal itself
await mutant('secret scan: a credential-shaped literal', [[LIB, 'export const STUDIO_POLISH_COPY', `const ${FAKE_NAME} = '${FAKE_VALUE}'\nexport const STUDIO_POLISH_COPY`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.error(`SURVIVED:\n  ${survived.join('\n  ')}`); process.exit(1) }
console.log(`test-studio-pass3-polish-b: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
