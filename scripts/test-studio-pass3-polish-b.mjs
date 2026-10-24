// FRONTEND-2 (PROGRAM-1 Saturday evening push, 24 Oct: the Pass 3 polish set, PR B): proof for the flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time; the SAME flag as PR A).
// PR B holds two findings of the static audit (POLISH-AUDIT.md): #7, the browser's native confirm() / alert() in Studio flows become the Studio dialog and toast (the viewer's "discard all changes" confirm and its
// "Failed to save changes" alert; the Builder's two "Failed to create session" alerts); #5, the Decks page's empty state says "No decks yet / No outline previews yet" (with NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS too).
// Run: node scripts/test-studio-pass3-polish-b.mjs   (plain node: TypeScript transpiled and run in a vm, `git show` reads the base commit; no network, no browser, no model call)
//
//   1. lib        the flag rule (exact "true", and only with the Studio shell); the words, exactly; the second Builder message; the Decks empty-state rule (needs the flag AND the plain labels)
//   2. pin        the viewer, the Builder page and the Decks page without this change's marked lines are BASE_COMMIT's files byte for byte; every added line carries PASS3-POLISH; no base line changes; the marked
//                 lines are exactly the ones listed here
//   3. viewer     the REAL handlers (handleSaveChanges, handleCancelEdits and the added confirm handler) run in a vm with stubs: flag off, every scenario leaves the SAME trace as the base commit's code (sha256 over all of them:
//                 the browser's confirm asks with the same words, a cancelled confirm does NOT discard, an accepted one does, a failed save raises the same alert); flag on: the Studio dialog opens and NOTHING is discarded
//                 and no native call is made until the dialog is confirmed, a dialog that is never confirmed discards nothing, the confirm path discards once, the next discard asks again, a failed save is a toast
//   4. builder    the two alert sites, extracted from the REAL page and run: flag off the alerts are the base's (same words, same return); flag on a toast with the plain words and the same return
//   5. decks      the REAL empty-state ternaries, extracted and evaluated: flag off the base's words in every state; on, with the plain labels, the plain words; a search/filter result is never changed
//   6. dialog     the real component with stand-ins for the alert-dialog parts: the words, the Studio look attribute, only the confirm button calls onConfirm
//   7. change     the strip (two rules), the registry (two lines, no older test edited), scope (the COMMITTED diff only), no secret
//   8. mutants    each one must make sections 1-7 fail
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
  BASE_COMMIT, PASS3_POLISH_B_BUILDER, PASS3_POLISH_B_DASHBOARD, PASS3_POLISH_B_FILES, PASS3_POLISH_B_FRAGMENTS, PASS3_POLISH_B_NEW_FILES, PASS3_POLISH_B_SCOPE_FILES, PASS3_POLISH_B_VIEWER, PASS3_POLISH_MARKER, stripPass3PolishB,
} from './studio-pass3-polish-b-strip.mjs'
import { LATER_CHANGE_FILES, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const jsxRuntime = nodeRequire('react/jsx-runtime')
const BASE = process.env.PASS3_POLISH_B_BASE || BASE_COMMIT
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

const VIEWER = PASS3_POLISH_B_VIEWER, PAGE = PASS3_POLISH_B_BUILDER, DASH = PASS3_POLISH_B_DASHBOARD
const LIB = 'lib/studio-pass3-polish-b.ts', DIALOG = 'components/studio-pass3-polish/studio-discard-edits-dialog.tsx'
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-pass3-polish-b-strip.mjs', THIS_TEST = 'scripts/test-studio-pass3-polish-b.mjs'
const FLAG = 'NEXT_PUBLIC_STUDIO_PASS3_POLISH', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const ON = { [FLAG]: 'true', [SHELL]: 'true' }
const OFF_STATES = [{}, { [FLAG]: 'true' }, { [SHELL]: 'true' }, { [FLAG]: 'false', [SHELL]: 'true' }, { [FLAG]: 'TRUE', [SHELL]: 'true' }, { [FLAG]: '1', [SHELL]: 'true' }, { [FLAG]: '', [SHELL]: 'true' }, { [FLAG]: ' true', [SHELL]: 'true' }, { [FLAG]: 'true', [SHELL]: 'false' }]

// the words, exactly (the native messages they replace are in the lib's comment and in the traces below)
const WORDS = {
  discard: { title: 'Discard all changes?', description: 'Your edits will be lost.', keep: 'Keep editing', confirm: 'Discard changes' },
  saveFailed: { title: 'Your changes were not saved', description: 'Something went wrong while saving. Please try again.' },
  deckStartFailed: { title: 'Could not start your deck', description: 'Please check your connection and try again.' },
  deckStartError: { title: 'Could not start your deck' },
}
const EMPTY = { completed: { title: 'No decks yet', description: 'Start a new deck and it will appear here.' }, strawman: { title: 'No outline previews yet', description: 'Start a new deck to see its outline here.' } }
const NATIVE = { confirm: 'Are you sure you want to discard all changes?', save: 'Failed to save changes. Please try again.', create: 'Failed to create session. Please check your connection and try again.' }

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
const libOf = (env, text = read(LIB)) => loadTs(LIB, text, { env })

// ---------------------------------------------------------------- 1. the lib
function proveLib(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  eq(libOf(ON, text).STUDIO_PASS3_POLISH_B_ENABLED, true, a('lib: flag and shell on'))
  for (const state of OFF_STATES) eq(libOf(state, text).STUDIO_PASS3_POLISH_B_ENABLED, false, a(`lib: ${JSON.stringify(state)} is off`))
  const lib = libOf(ON, text)
  deep(plain(lib.STUDIO_POLISH_COPY), WORDS, a('lib: the words'))
  deep(plain(lib.STUDIO_DECKS_EMPTY_COPY), EMPTY, a('lib: the Decks empty-state words'))
  eq(lib.deckStartErrorDescription(new Error('Network down')), 'Network down. Please try refreshing the page.', a('lib: second Builder message, an Error'))
  eq(lib.deckStartErrorDescription('boom'), 'Unknown error. Please try refreshing the page.', a('lib: second Builder message, not an Error'))
  eq(lib.deckStartErrorDescription(undefined), 'Unknown error. Please try refreshing the page.', a('lib: second Builder message, nothing'))
  deep(plain(lib.studioDecksEmptyCopy(true, true)), EMPTY, a('lib: flag + plain labels give the plain words'))
  eq(lib.studioDecksEmptyCopy(true, false), null, a('lib: the flag without the plain labels gives nothing'))
  eq(lib.studioDecksEmptyCopy(false, true), null, a('lib: the plain labels without the flag give nothing'))
  eq(lib.studioDecksEmptyCopy(false, false), null, a('lib: neither gives nothing'))
  for (const notTrue of ['true', 1, {}, [], 'yes', undefined, null]) {
    eq(lib.studioDecksEmptyCopy(notTrue, true), null, a(`lib: ${JSON.stringify(notTrue) ?? 'undefined'} is not a real true (flag)`))
    eq(lib.studioDecksEmptyCopy(true, notTrue), null, a(`lib: ${JSON.stringify(notTrue) ?? 'undefined'} is not a real true (labels)`))
  }
  nomatch(text.replace(/^\s*(\/\/|\*|\/\*\*).*$/gm, ''), /^import |require\(/m, a('lib: import-free'))
  const allWords = JSON.stringify(plain(lib.STUDIO_POLISH_COPY), (key, value) => value).replace(/"[A-Za-z]+":/g, '') + JSON.stringify(plain(lib.STUDIO_DECKS_EMPTY_COPY)).replace(/"[A-Za-z]+":/g, '') // the words only, not the keys
  for (const word of ['strawman', 'Strawman', 'session', 'Failed', 'Complete a']) nomatch(allWords, new RegExp(word), a(`lib: the plain words do not say "${word}"`))
}

// ---------------------------------------------------------------- 2. the pins
// The code part of each marked line (the text before its trailing "// PASS3-POLISH ..." comment, or the whole line for a JSX one): what this change adds, exactly.
const ADDED = {
  [VIEWER]: [
    "import { STUDIO_PASS3_POLISH_B_ENABLED, STUDIO_POLISH_COPY } from '@/lib/studio-pass3-polish-b'",
    "import { StudioDiscardEditsDialog } from '@/components/studio-pass3-polish/studio-discard-edits-dialog'",
    "      if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' }); return }",
    '  const [studioDiscardAsk, setStudioDiscardAsk] = useState(false)',
    '  const studioDiscardAnsweredRef = useRef(false)',
    '    if (STUDIO_PASS3_POLISH_B_ENABLED && !studioDiscardAnsweredRef.current) { setStudioDiscardAsk(true); return }',
    '    const confirm = (message?: string) => (STUDIO_PASS3_POLISH_B_ENABLED && studioDiscardAnsweredRef.current ? true : window.confirm(message))',
    '  const confirmStudioDiscard = useCallback(async () => {',
    '    studioDiscardAnsweredRef.current = true',
    '    setStudioDiscardAsk(false)',
    '    try { await handleCancelEdits() } finally { studioDiscardAnsweredRef.current = false }',
    '  }, [handleCancelEdits])',
    '      {STUDIO_PASS3_POLISH_B_ENABLED && <StudioDiscardEditsDialog open={studioDiscardAsk} onOpenChange={setStudioDiscardAsk} onConfirm={confirmStudioDiscard} />',
  ],
  [PAGE]: [
    "import { STUDIO_PASS3_POLISH_B_ENABLED, STUDIO_POLISH_COPY, deckStartErrorDescription } from '@/lib/studio-pass3-polish-b'",
    "            if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.deckStartFailed, variant: 'destructive' }); return }",
    "          if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.deckStartError, description: deckStartErrorDescription(error), variant: 'destructive' }); return }",
  ],
  [DASH]: [
    'import { STUDIO_PASS3_POLISH_B_ENABLED, studioDecksEmptyCopy } from "@/lib/studio-pass3-polish-b"',
    '  const decksEmptyCopy = studioDecksEmptyCopy(STUDIO_PASS3_POLISH_B_ENABLED, plainNavLabels)',
  ],
}
const codeOf = line => { const at = line.indexOf(PASS3_POLISH_MARKER); return line.slice(0, line.lastIndexOf(/\/\*/.test(line.slice(Math.max(0, at - 3), at)) ? '/*' : '//', at)).trimEnd() }
const restored = (rel, text) => (PASS3_POLISH_B_FRAGMENTS[rel] || []).reduce((out, [has, base]) => out.replace(has, () => base), text)
function provePin(rel, text, at = '', stripFn = stripPass3PolishB) {
  const a = message => (at ? `${at}: ${message}` : message)
  const base = baseOf(rel)
  eq(sha(stripFn(rel, text)), sha(base), a(`${rel}: without this change's lines it is ${BASE.slice(0, 8)}'s file byte for byte`))
  const lines = text.split('\n')
  const marked = lines.filter(line => line.includes(PASS3_POLISH_MARKER) && !(PASS3_POLISH_B_FRAGMENTS[rel] || []).some(([has]) => line.includes(has.split(' /* ')[0])))
  deep(marked.map(codeOf), ADDED[rel], a(`${rel}: the marked lines are exactly the ones this change adds, in order`))
  // no base line changes: the lines without the marker (after the marked fragments of the one grown line are taken back out) are the base's lines, in order
  deep(restored(rel, text).split('\n').filter(line => !line.includes(PASS3_POLISH_MARKER)), base.split('\n'), a(`${rel}: every other line is the base's, in order`))
  for (const [has] of PASS3_POLISH_B_FRAGMENTS[rel] || []) eq(text.split(has).length - 1, 1, a(`${rel}: each marked fragment occurs once`))
  if (rel !== DASH) eq(restored(rel, text), text, a(`${rel}: no fragments`))
  else eq(text.split(PASS3_POLISH_MARKER).length - 1, ADDED[rel].length + 4, a(`${rel}: two marked lines and four marked fragments, nothing else carries the marker`))
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
  ['discard, browser confirm says no', { confirm: false }, async api => { await api.handleCancelEdits() }],
  ['discard, browser confirm says yes', { confirm: true }, async api => { await api.handleCancelEdits() }],
  ['discard, browser confirm yes, the command fails', { confirm: true, failCommand: 'cancelEdits' }, async api => { await api.handleCancelEdits() }],
  ['discard twice, no then yes', { confirm: false }, async api => { await api.handleCancelEdits(); await api.handleCancelEdits() }],
]
const trace = (text, env, scenarios = SCENARIOS) => scenarios.map(([name, behaviour, run]) => { const h = viewerHarness(text, env, behaviour); return run(h.api).then(() => [name, h.calls]) })
async function proveViewer(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  // flag off: every scenario leaves the base commit's trace
  const baseTraces = await Promise.all(trace(baseOf(VIEWER), {}))
  for (const state of OFF_STATES) {
    const headTraces = await Promise.all(trace(text, state))
    deep(headTraces, baseTraces, a(`viewer: flag off (${JSON.stringify(state)}): every trace equals the base commit's`))
  }
  const offHash = sha(JSON.stringify(await Promise.all(trace(text, {}))))
  eq(offHash, sha(JSON.stringify(baseTraces)), a('viewer: flag off, sha256 of all traces equals the base commit\'s'))
  const baseByName = Object.fromEntries(baseTraces)
  deep(baseByName['discard, browser confirm says no'], [`confirm:${NATIVE.confirm}`], a('viewer: base: a cancelled confirm discards nothing'))
  deep(baseByName['save fails'].filter(x => x.startsWith('alert')), [`alert:${NATIVE.save}`], a('viewer: base: the save alert'))
  ok(baseByName['discard, browser confirm says yes'].includes('sendCommand:cancelEdits'), a('viewer: base: an accepted confirm discards'))
  // flag on
  const on = Object.fromEntries(await Promise.all(trace(text, ON)))
  deep(on['save ok'], baseByName['save ok'], a('viewer: flag on: a good save is unchanged'))
  deep(on['save fails'].filter(x => x.startsWith('toast') || x.startsWith('alert')), [`toast:${JSON.stringify({ ...WORDS.saveFailed, variant: 'destructive' })}`], a('viewer: flag on: a failed save is a toast with the plain words, and no alert'))
  deep(on['save fails'].filter(x => !x.startsWith('toast')), baseByName['save fails'].filter(x => !x.startsWith('alert')), a('viewer: flag on: a failed save otherwise does what it did'))
  for (const name of ['discard, browser confirm says no', 'discard, browser confirm says yes', 'discard, browser confirm yes, the command fails']) {
    deep(on[name], ['setStudioDiscardAsk:true'], a(`viewer: flag on: "${name}": only the Studio dialog opens; no native confirm, nothing discarded`))
  }
  deep(on['discard twice, no then yes'], ['setStudioDiscardAsk:true', 'setStudioDiscardAsk:true'], a('viewer: flag on: asking twice opens the dialog twice and discards nothing'))
  // the confirm path
  {
    const h = viewerHarness(text, ON, { confirm: false })
    await h.api.handleCancelEdits()
    deep(h.calls, ['setStudioDiscardAsk:true'], a('viewer: confirm path: asked'))
    await h.api.confirmStudioDiscard()
    deep(h.calls, ['setStudioDiscardAsk:true', 'setStudioDiscardAsk:false', 'sendCommand:cancelEdits', 'setIsEditMode:false', 'onEditModeChange:false'], a('viewer: confirm path: the dialog closes, the discard runs once, the native confirm is never asked'))
    h.calls.length = 0
    await h.api.handleCancelEdits()
    deep(h.calls, ['setStudioDiscardAsk:true'], a('viewer: the next discard asks again (the answer is not remembered)'))
  }
  {
    const h = viewerHarness(text, ON, { confirm: true, failCommand: 'cancelEdits' })
    await h.api.confirmStudioDiscard()
    deep(h.calls, ['setStudioDiscardAsk:false', 'sendCommand:cancelEdits'], a('viewer: confirm path with a failing command: handled as the base handles it'))
    h.calls.length = 0
    await h.api.handleCancelEdits()
    deep(h.calls, ['setStudioDiscardAsk:true'], a('viewer: after a failing confirmed discard the next one asks again'))
  }
  {
    const h = viewerHarness(text, ON, { confirm: true })
    await h.api.handleCancelEdits() // the dialog opens and is dismissed: nothing else is ever called
    deep(h.calls.filter(x => x.startsWith('sendCommand') || x.startsWith('confirm') || x.startsWith('setIsEditMode')), [], a('viewer: a dialog that is cancelled or closed discards nothing'))
  }
  // the dialog is mounted only under the flag, and nothing else about the markup differs
  match(text, /\{STUDIO_PASS3_POLISH_B_ENABLED && <StudioDiscardEditsDialog open=\{studioDiscardAsk\} onOpenChange=\{setStudioDiscardAsk\} onConfirm=\{confirmStudioDiscard\} \/>/, a('viewer: the dialog is mounted behind the flag, wired to its own state and handler'))
  return offHash
}

// ---------------------------------------------------------------- 4. the Builder's two alerts, run
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
  const head = builderSnippets(text), base = builderSnippets(baseOf(PAGE))
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

// ---------------------------------------------------------------- 5. the Decks empty state, run
function emptyExpressions(text) {
  const line = text.split('\n').find(l => l.includes('data-studio-deck-empty="true" className="text-center py-12"><Sparkles'))
  assert.ok(line, 'decks: cannot find the empty-state line')
  const h3 = line.match(/<h3 className="text-lg font-semibold mb-2">\{([^}]*)\}<\/h3>/), p = line.match(/<p className="text-slate-600 mb-4">\{([^}]*)\}<\/p>/)
  assert.ok(h3 && p, 'decks: cannot find the heading and the sentence of the empty state')
  return { title: new Function('hasActiveCriteria', 'tab', 'decksEmptyCopy', `return ${h3[1]}`), description: new Function('hasActiveCriteria', 'tab', 'decksEmptyCopy', `return ${p[1]}`) }
}
function proveDecks(text, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const head = emptyExpressions(text), base = emptyExpressions(baseOf(DASH))
  const BASE_WORDS = { completed: { title: 'No completed presentations found', description: 'Complete a strawman preview to create your first presentation.' }, strawman: { title: 'No strawman previews found', description: 'Create a presentation to generate a strawman preview.' } }
  const MATCHING = { title: 'No matching presentations', description: 'Try a different search or clear the folder, tag, and status filters.' }
  for (const tab of ['completed', 'strawman']) {
    for (const hasActiveCriteria of [false, true]) {
      const expected = hasActiveCriteria ? MATCHING : BASE_WORDS[tab]
      deep({ title: base.title(hasActiveCriteria, tab, undefined), description: base.description(hasActiveCriteria, tab, undefined) }, expected, a(`decks: the base says what the proof expects (${tab}, filters ${hasActiveCriteria})`))
      // the page's own const: null unless the flag AND the plain labels are on
      for (const [flagState, plainLabels, copyWanted] of [[{}, true, false], [{}, false, false], [ON, false, false], [{ [FLAG]: 'true' }, true, false], [ON, true, true]]) {
        const copy = libOf(flagState).studioDecksEmptyCopy(libOf(flagState).STUDIO_PASS3_POLISH_B_ENABLED, plainLabels)
        const got = { title: head.title(hasActiveCriteria, tab, copy), description: head.description(hasActiveCriteria, tab, copy) }
        deep(got, copyWanted && !hasActiveCriteria ? EMPTY[tab] : expected, a(`decks: ${tab}, filters ${hasActiveCriteria}, ${JSON.stringify(flagState)}, plain labels ${plainLabels}`))
      }
    }
  }
  // flag off, every state (the flag and the plain labels in every combination that is not "both on"): the words of the head equal the base's, hashed
  const offHead = [], offBase = []
  for (const state of OFF_STATES) for (const plainLabels of [true, false]) for (const tab of ['completed', 'strawman']) for (const hasActiveCriteria of [false, true]) {
    const copy = libOf(state).studioDecksEmptyCopy(libOf(state).STUDIO_PASS3_POLISH_B_ENABLED, plainLabels)
    offHead.push([head.title(hasActiveCriteria, tab, copy), head.description(hasActiveCriteria, tab, copy)])
    offBase.push([base.title(hasActiveCriteria, tab, undefined), base.description(hasActiveCriteria, tab, undefined)])
  }
  eq(sha(JSON.stringify(offHead)), sha(JSON.stringify(offBase)), a('decks: flag off (every off state, with and without the plain labels), sha256 of the words equals the base commit\'s'))
  match(text, /studioDecksEmptyCopy\(STUDIO_PASS3_POLISH_B_ENABLED, plainNavLabels\)/, a('decks: the page asks with its flag and its plain-labels rule'))
  match(text, /const plainNavLabels = studioShell && process\.env\.NEXT_PUBLIC_STUDIO_PLAIN_NAV_LABELS === "true"/, a('decks: the plain-labels rule is the base\'s'))
}

// ---------------------------------------------------------------- 6. the dialog
function walk(node, out = []) {
  if (node && typeof node === 'object' && 'props' in node) { out.push(node); [].concat(node.props.children ?? []).forEach(child => walk(child, out)) }
  return out
}
const textOf = node => [].concat(node.props.children ?? []).filter(child => typeof child === 'string').join('')
function proveDialog(text, libText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const part = name => { const f = function () {}; Object.defineProperty(f, 'name', { value: name }); return f }
  const parts = Object.fromEntries(['AlertDialog', 'AlertDialogAction', 'AlertDialogCancel', 'AlertDialogContent', 'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogHeader', 'AlertDialogTitle'].map(n => [n, part(n)]))
  const lib = libOf(ON, libText)
  const mod = loadTs(DIALOG, text, { mocks: { '@/components/ui/alert-dialog': parts, '@/lib/studio-pass3-polish-b': lib, '@/components/studio-slide-delete.css': {} } })
  const onOpenChange = () => 'open', onConfirm = () => 'confirm'
  const nodes = walk(mod.StudioDiscardEditsDialog({ open: true, onOpenChange, onConfirm }))
  const of = name => nodes.filter(n => n.type === parts[name])
  eq(of('AlertDialog').length, 1, a('dialog: one AlertDialog'))
  eq(of('AlertDialog')[0].props.open, true, a('dialog: open is passed through'))
  eq(of('AlertDialog')[0].props.onOpenChange, onOpenChange, a('dialog: onOpenChange is passed through'))
  eq(mod.StudioDiscardEditsDialog({ open: false, onOpenChange, onConfirm }).props.open, false, a('dialog: closed stays closed'))
  eq(of('AlertDialogContent')[0].props['data-studio-slide-delete'], 'true', a('dialog: carries the Studio slide-delete look'))
  eq(textOf(of('AlertDialogTitle')[0]), WORDS.discard.title, a('dialog: title'))
  eq(textOf(of('AlertDialogDescription')[0]), WORDS.discard.description, a('dialog: description'))
  eq(textOf(of('AlertDialogCancel')[0]), WORDS.discard.keep, a('dialog: the cancel button says Keep editing'))
  eq(textOf(of('AlertDialogAction')[0]), WORDS.discard.confirm, a('dialog: the confirm button says Discard changes'))
  eq(of('AlertDialogAction')[0].props.onClick, onConfirm, a('dialog: the confirm button calls onConfirm'))
  eq(of('AlertDialogCancel').length, 1, a('dialog: one cancel'))
  eq(of('AlertDialogAction').length, 1, a('dialog: one confirm'))
  ok(nodes.filter(n => n.props.onClick === onConfirm || n.props.onOpenChange === onConfirm || n.props.onSelect === onConfirm).length === 1, a('dialog: nothing but the confirm button can call onConfirm'))
  nomatch(JSON.stringify(nodes.map(n => ({ ...n.props, children: undefined }))), /confirm\(|alert\(/, a('dialog: no native call'))
  match(text, /import '@\/components\/studio-slide-delete\.css'/, a('dialog: the look comes from the Studio slide-delete stylesheet'))
}

// ---------------------------------------------------------------- 7. the change: strip, registry, scope, secret scan
function proveChange(stripFn, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  eq(stripFn('app/(app)/layout.tsx', 'x // PASS3-POLISH\n'), 'x // PASS3-POLISH\n', a('strip: another file comes back untouched'))
  eq(stripFn(VIEWER, 5), 5, a('strip: a non-string comes back'))
  eq(stripFn('.env.example', 'NEXT_PUBLIC_STUDIO_PASS3_POLISH="false" # PASS3-POLISH\n'), 'NEXT_PUBLIC_STUDIO_PASS3_POLISH="false" # PASS3-POLISH\n', a('strip: .env.example is not its file (the flag block is PR A\'s)'))
  eq(stripFn(VIEWER, 'a\nb // PASS3-POLISH x\nc\n'), 'a\nc\n', a('strip: a marked line goes, the rest stays'))
  eq(stripFn(DASH, 'a\nb\n'), 'a\nb\n', a('strip: a file with nothing to strip is untouched'))
  deep(PASS3_POLISH_B_FILES, [VIEWER, PAGE, DASH], a('strip: the three files'))
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
    ok(!committed.includes('.env.example'), a('.env.example is not touched (the flag\'s block is PR A\'s)'))
  }
}
function proveSecretScan(texts, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [LIB, DIALOG, STRIP_MODULE, THIS_TEST].map(rel => (rel in texts ? texts[rel] : read(rel))).concat(PASS3_POLISH_B_FILES.flatMap(rel => texts[rel].split('\n').filter(line => line.includes(PASS3_POLISH_MARKER)))).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
}

// ---------------------------------------------------------------- run everything
async function proveAll(stripFn = stripPass3PolishB, at = '') {
  const texts = { [VIEWER]: read(VIEWER), [PAGE]: read(PAGE), [DASH]: read(DASH) }
  proveLib(read(LIB), at)
  for (const rel of PASS3_POLISH_B_FILES) provePin(rel, texts[rel], at, stripFn)
  const offHash = await proveViewer(texts[VIEWER], at)
  proveBuilder(texts[PAGE], at)
  proveDecks(texts[DASH], at)
  proveDialog(read(DIALOG), read(LIB), at)
  proveChange(stripFn, at)
  proveRegistry(read(REGISTRY), at)
  proveRegistryStripsToBase(texts, at)
  proveScope(at)
  proveSecretScan(texts, at)
  return offHash
}
const offHash = await proveAll()
console.log(`flag off: viewer, Builder and Decks output sha256 == base ${offHash.slice(0, 16)} (${OFF_STATES.length} off states each)`)
console.log(`PASS lib, pins, viewer, builder, decks, dialog, change: ${checks} checks`)

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
      await proveViewer(read(VIEWER), name); proveBuilder(read(PAGE), name); proveDecks(read(DASH), name)
    } else await proveAll(strip, name)
  } catch (error) {
    if (/no longer applies/.test(String(error.message))) throw error
    killed.push(name); if (process.env.PASS3_POLISH_B_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
// lib
await mutant('lib: the flag rule loosened to anything set', [[LIB, `process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true'`, `Boolean(process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH)`]])
await mutant('lib: the Studio shell is not required', [[LIB, ` && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'`, '']])
await mutant('lib: the discard title changed', [[LIB, "title: 'Discard all changes?'", "title: 'Are you sure?'"]])
await mutant('lib: the discard says "Cancel" not "Keep editing"', [[LIB, "keep: 'Keep editing'", "keep: 'Cancel'"]])
await mutant('lib: the save toast is not plain', [[LIB, "title: 'Your changes were not saved'", "title: 'Failed to save changes'"]])
await mutant('lib: the second Builder message loses "Unknown error"', [[LIB, "error instanceof Error ? error.message : 'Unknown error'", "error instanceof Error ? error.message : ''"]])
await mutant('lib: the empty state ignores the plain labels', [[LIB, 'return polish === true && plainNavLabels === true ?', 'return polish === true ?']])
await mutant('lib: the empty state ignores the flag', [[LIB, 'return polish === true && plainNavLabels === true ?', 'return plainNavLabels === true ?']])
await mutant('lib: the empty state says "strawman"', [[LIB, "title: 'No outline previews yet'", "title: 'No strawman previews yet'"]])
// viewer
await mutant('viewer: the Studio dialog is never asked (the gate is gone)', [[VIEWER, '    if (STUDIO_PASS3_POLISH_B_ENABLED && !studioDiscardAnsweredRef.current) { setStudioDiscardAsk(true); return }', '    if (false) { setStudioDiscardAsk(true); return }']])
await mutant('viewer: the gate does not wait for the answer (it asks forever)', [[VIEWER, 'STUDIO_PASS3_POLISH_B_ENABLED && !studioDiscardAnsweredRef.current) { setStudioDiscardAsk(true)', 'STUDIO_PASS3_POLISH_B_ENABLED) { setStudioDiscardAsk(true)']])
await mutant('viewer: a cancelled confirm discards (the shadow always says yes)', [[VIEWER, '(STUDIO_PASS3_POLISH_B_ENABLED && studioDiscardAnsweredRef.current ? true : window.confirm(message))', 'true']])
await mutant('viewer: the shadow ignores the flag (flag off a confirmed answer is trusted)', [[VIEWER, '(STUDIO_PASS3_POLISH_B_ENABLED && studioDiscardAnsweredRef.current ? true : window.confirm(message))', '(studioDiscardAnsweredRef.current ? true : window.confirm(message))']])
await mutant('viewer: the browser confirm is asked again after the Studio dialog', [[VIEWER, '(STUDIO_PASS3_POLISH_B_ENABLED && studioDiscardAnsweredRef.current ? true : window.confirm(message))', 'window.confirm(message)']])
await mutant('viewer: the confirm handler does not mark the answer (nothing is discarded)', [[VIEWER, '    studioDiscardAnsweredRef.current = true', '    studioDiscardAnsweredRef.current = false']])
await mutant('viewer: the answer is remembered (the next discard skips the dialog)', [[VIEWER, 'finally { studioDiscardAnsweredRef.current = false }', 'finally { }']])
await mutant('viewer: the dialog stays open after the confirm', [[VIEWER, '    setStudioDiscardAsk(false) // PASS3-POLISH\n', '']])
await mutant('viewer: the dialog opens even with the flag off', [[VIEWER, 'if (STUDIO_PASS3_POLISH_B_ENABLED && !studioDiscardAnsweredRef.current)', 'if (!studioDiscardAnsweredRef.current)']])
await mutant('viewer: the save toast also raises the alert (no return)', [[VIEWER, "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' }); return }", "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' }) }"]])
await mutant('viewer: the save toast ignores the flag', [[VIEWER, "      if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.saveFailed", "      if (true) { toast({ ...STUDIO_POLISH_COPY.saveFailed"]])
await mutant('viewer: the save toast is not destructive', [[VIEWER, "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' })", "toast({ ...STUDIO_POLISH_COPY.saveFailed })"]])
await mutant('viewer: the dialog is mounted without the flag', [[VIEWER, '{STUDIO_PASS3_POLISH_B_ENABLED && <StudioDiscardEditsDialog', '{true && <StudioDiscardEditsDialog']])
await mutant('viewer: the dialog\'s confirm is wired to the state setter', [[VIEWER, 'onConfirm={confirmStudioDiscard}', 'onConfirm={() => setStudioDiscardAsk(false)}']])
await mutant('viewer: a base line changed (the native message)', [[VIEWER, "if (!confirm('Are you sure you want to discard all changes?')) {", "if (!confirm('Discard all changes?')) {"]])
await mutant('viewer: the base alert line is gone', [[VIEWER, "      alert('Failed to save changes. Please try again.')\n", '']])
// builder
await mutant('builder: alert 1 toast without the return', [[PAGE, "toast({ ...STUDIO_POLISH_COPY.deckStartFailed, variant: 'destructive' }); return }", "toast({ ...STUDIO_POLISH_COPY.deckStartFailed, variant: 'destructive' }) }"]])
await mutant('builder: alert 2 toast without the return', [[PAGE, "description: deckStartErrorDescription(error), variant: 'destructive' }); return }", "description: deckStartErrorDescription(error), variant: 'destructive' }) }"]])
await mutant('builder: alert 1 ignores the flag', [[PAGE, "            if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.deckStartFailed", "            if (true) { toast({ ...STUDIO_POLISH_COPY.deckStartFailed"]])
await mutant('builder: alert 2 loses the error message', [[PAGE, 'description: deckStartErrorDescription(error), variant', "description: STUDIO_POLISH_COPY.deckStartFailed.description, variant"]])
await mutant('builder: a base alert line changed', [[PAGE, "alert('Failed to create session. Please check your connection and try again.')", "alert('Failed to create session.')"]])
// decks
await mutant('decks: the empty state ignores the flag (plain labels alone)', [[DASH, 'studioDecksEmptyCopy(STUDIO_PASS3_POLISH_B_ENABLED, plainNavLabels)', 'studioDecksEmptyCopy(true, plainNavLabels)']])
await mutant('decks: the empty state ignores the plain labels', [[DASH, 'studioDecksEmptyCopy(STUDIO_PASS3_POLISH_B_ENABLED, plainNavLabels)', 'studioDecksEmptyCopy(STUDIO_PASS3_POLISH_B_ENABLED, true)']])
await mutant('decks: a filter result is replaced too', [[DASH, '{hasActiveCriteria ? "No matching presentations" :', '{hasActiveCriteria ? decksEmptyCopy?.completed.title ?? "No matching presentations" :']])
await mutant('decks: the heading fragment points at the wrong tab', [[DASH, '/* PASS3-POLISH */ decksEmptyCopy?.completed.title ?? "No completed presentations found"', '/* PASS3-POLISH */ decksEmptyCopy?.strawman.title ?? "No completed presentations found"']])
// dialog
await mutant('dialog: Keep editing is wired to onConfirm', [[DIALOG, '<AlertDialogCancel data-studio-slide-delete-part="cancel">', '<AlertDialogCancel data-studio-slide-delete-part="cancel" onClick={onConfirm}>']])
await mutant('dialog: the confirm button does nothing', [[DIALOG, ' onClick={onConfirm} className', ' className']])
await mutant('dialog: the Studio look attribute is gone', [[DIALOG, 'data-studio-slide-delete="true" data-studio-discard-edits="true"', 'data-studio-discard-edits="true"']])
// behaviour alone: the same kinds of mutant, caught by running the real handlers / alert sites / ternaries, with the text pins switched off
const BEH = { only: 'behaviour' }
await mutant('behaviour: the gate is gone (no Studio dialog, the native confirm asks)', [[VIEWER, '    if (STUDIO_PASS3_POLISH_B_ENABLED && !studioDiscardAnsweredRef.current) { setStudioDiscardAsk(true); return }', '    if (false) { setStudioDiscardAsk(true); return }']], BEH)
await mutant('behaviour: a cancelled confirm discards (the shadow always says yes)', [[VIEWER, '(STUDIO_PASS3_POLISH_B_ENABLED && studioDiscardAnsweredRef.current ? true : window.confirm(message))', 'true']], BEH)
await mutant('behaviour: the browser confirm is asked again after the Studio dialog', [[VIEWER, '(STUDIO_PASS3_POLISH_B_ENABLED && studioDiscardAnsweredRef.current ? true : window.confirm(message))', 'window.confirm(message)']], BEH)
await mutant('behaviour: the confirm handler does not mark the answer', [[VIEWER, '    studioDiscardAnsweredRef.current = true', '    studioDiscardAnsweredRef.current = false']], BEH)
await mutant('behaviour: the answer is remembered', [[VIEWER, 'finally { studioDiscardAnsweredRef.current = false }', 'finally { }']], BEH)
await mutant('behaviour: the dialog opens with the flag off', [[VIEWER, 'if (STUDIO_PASS3_POLISH_B_ENABLED && !studioDiscardAnsweredRef.current)', 'if (!studioDiscardAnsweredRef.current)']], BEH)
await mutant('behaviour: the save toast also raises the alert', [[VIEWER, "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' }); return }", "toast({ ...STUDIO_POLISH_COPY.saveFailed, variant: 'destructive' }) }"]], BEH)
await mutant('behaviour: the save toast ignores the flag', [[VIEWER, "      if (STUDIO_PASS3_POLISH_B_ENABLED) { toast({ ...STUDIO_POLISH_COPY.saveFailed", "      if (true) { toast({ ...STUDIO_POLISH_COPY.saveFailed"]], BEH)
await mutant('behaviour: the Builder toast has no return', [[PAGE, "toast({ ...STUDIO_POLISH_COPY.deckStartFailed, variant: 'destructive' }); return }", "toast({ ...STUDIO_POLISH_COPY.deckStartFailed, variant: 'destructive' }) }"]], BEH)
await mutant('behaviour: the second Builder toast loses the message', [[PAGE, 'description: deckStartErrorDescription(error), variant', "description: STUDIO_POLISH_COPY.deckStartFailed.description, variant"]], BEH)
await mutant('behaviour: the Decks heading ignores the flag', [[DASH, 'studioDecksEmptyCopy(STUDIO_PASS3_POLISH_B_ENABLED, plainNavLabels)', 'studioDecksEmptyCopy(true, plainNavLabels)']], BEH)
await mutant('behaviour: a filter result is replaced', [[DASH, '{hasActiveCriteria ? "No matching presentations" :', '{hasActiveCriteria ? decksEmptyCopy?.completed.title ?? "No matching presentations" :']], BEH)
// change
await mutant('strip: the marked fragments are not put back', [], { strip: (rel, text) => (PASS3_POLISH_B_FILES.includes(rel) ? text.split('\n').filter(line => !line.includes(PASS3_POLISH_MARKER)).join('\n') : text) })
await mutant('strip: the fragments come out but the marked lines stay', [], { strip: (rel, text) => restored(rel, text) })
await mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-pass3-polish-b-strip.mjs')).stripPass3PolishB, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR B (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n", '']])
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-pass3-polish-b-strip.mjs')).PASS3_POLISH_B_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR B (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)\n", '']])
const FAKE_NAME = ['api', 'Key', 'Value'].join(''), FAKE_VALUE = ['abcdef', '1234567890'].join('') // built here so that this file carries no credential-shaped literal itself
await mutant('secret scan: a credential-shaped literal', [[LIB, 'export function deckStartErrorDescription', `const ${FAKE_NAME} = '${FAKE_VALUE}'\nexport function deckStartErrorDescription`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.error(`SURVIVED:\n  ${survived.join('\n  ')}`); process.exit(1) }
console.log(`test-studio-pass3-polish-b: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
