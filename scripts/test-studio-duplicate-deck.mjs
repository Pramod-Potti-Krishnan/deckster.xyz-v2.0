// FRONTEND-2 Pass 3: "Duplicate a deck", the Studio half. Flag NEXT_PUBLIC_STUDIO_DUPLICATE_DECK (exact "true"), default off, read at build time.
// Layout half: layout-builder-v7.5 !244, POST /api/presentations/{id}/duplicate, body { operation_id, title? }, reply { success, id, presentation_id, url, presentation_url,
// slide_count, reused } with RELATIVE urls; 404 while its own flag is off. Not deployed (Railway is paused), so every request here goes to a recording fake. No network.
//
// Run: node scripts/test-studio-duplicate-deck.mjs     (plain node: the real TypeScript transpiled and run in a vm; no React runtime, no browser, no services)
//   --base-root <checkout of the base>   also: the flag-off dashboard (one card and the whole page) built from the BASE tree hashes the same as this tree
//   --mutation-check                     also: break the code in several ways in memory, each must be caught by this suite
//   PRINT_GOLDEN=1 node scripts/test-studio-duplicate-deck.mjs --base-root <base>   prints the flag-off hashes pinned below (run it on the pristine base)
//
// What it pins:
//   1. the flag: exact "true", default off, documented in .env.example, read inline in both pages (never imported: the older page harnesses stub every import);
//   2. which decks can be copied (final slot, else strawman; a viewer URL the policy refuses, or no deck, is disabled with a short reason);
//   3. the wire: Layout POST first, then POST /api/sessions, then PATCH /api/sessions/{id}, each request byte for byte (headers, bodies, the copiedFrom marker's exact
//      shape), the order, that the original session is never touched;
//   4. every failure path: a Layout failure creates nothing; a session POST/PATCH failure (incl. the 404 write-race retry) soft-DELETEs the new session and says
//      "The copy could not be finished." + that a stray Layout copy may remain; a DELETE that fails or throws is reported too;
//   5. the "Copied from <title>. Chat history stays with the original." line as its own element; and the chat hard rule (no Director/WS/cache/restore file knows about it);
//   6. flag off is the base: a card and the whole dashboard page hash the same as the base's; the disabled Duplicate item and its note are unchanged; with this change's lines
//      stripped (scripts/studio-duplicate-deck-strip.mjs) both pages and .env.example are the base commit's, byte for byte, and the chat/WS/cache/restore/sessions-API files are untouched;
//   7. flag on, the dashboard end to end: copying/locked states, the new card first, the toast, the paging count, the error alert, the double-click guard.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { stripDuplicateDeck, DUPLICATE_DECK_ADDITIONS, DASHBOARD_PAGE, BUILDER_PAGE, ENV_FILE } from './studio-duplicate-deck-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripDeckTitle } from './studio-deck-title-strip.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const optionValue = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const BASE_ROOT = optionValue('--base-root') ? path.resolve(optionValue('--base-root')) : null
// DUPLICATE_DECK_BASE=<commit> overrides the base commit the flag-off identity is checked against (default 1079ba4, the studio-v4-dev-preparation-code tip this change is stacked on: #459 added only the Profile page,
// its .env.example block and its package script on top of bcd8aed, and none of the files this change touches).
const BASE_COMMIT = process.env.DUPLICATE_DECK_BASE || '1079ba4b7cd277ece7cc46ee7624d74419c3a5aa'
const git = gitArgs => execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
function baseSource(rel) {
  try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]); return git(['show', `${BASE_COMMIT}:${rel}`]) } catch { return null }
}
// .env.example and package.json are the two files every flag-gated change appends a line or a block to, so once other changes are stacked on this one (Ask your second brain, Themes/Templates manage ...)
// they hold lines this change never wrote. For those two (and only those) the base's lines must all still be there, in order, with nothing of this change left, and any extra line must be a comment, a
// blank, an env line or a test script line (the rule scripts/test-studio-p2-polish.mjs and scripts/test-studio-p2-publish.mjs use). Every other file is held to the base byte for byte, as before.
function appendOnlyOver(rel, text, baseText) {
  const norm = line => rel === 'package.json' ? line.replace(/,\s*$/, '') : line
  const want = baseText.split('\n').map(norm), extras = []
  let next = 0
  for (const line of text.split('\n').map(norm)) { if (next < want.length && line === want[next]) next++; else extras.push(line) }
  const kind = rel === 'package.json' ? /^\s*"test:[a-z0-9-]+": "node scripts\/test-[a-z0-9-]+\.mjs"$/ : /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/
  return next === want.length && extras.every(line => line === '' || kind.test(line)) && !extras.some(line => /DUPLICATE_DECK|duplicate-deck/.test(line))
}
const PAGE = 'app/(app)/dashboard/page.tsx'
const BUILDER = 'app/builder/page.tsx'
const LIB = 'lib/studio-duplicate-deck.ts'
const NOTE = 'components/builder/studio-copied-from-note.tsx'
const FLAG = 'NEXT_PUBLIC_STUDIO_DUPLICATE_DECK'

// ---- mutation hook: the child runs of --mutation-check apply one source edit in memory -----------------------------------------------------------------------
const MUTATIONS = [
  { name: 'PATCH loses the copiedFrom marker', file: LIB, from: "currentStatus: { copiedFrom: { sessionId: source.sessionId, title: source.shownTitle } },", to: 'currentStatus: {},' },
  { name: 'marker sent as a top-level key (the API would drop it)', file: LIB, from: "      stateCache: {\n        activeVersion: target.slot,\n        currentStatus: { copiedFrom: { sessionId: source.sessionId, title: source.shownTitle } },\n      },", to: "      copiedFrom: { sessionId: source.sessionId, title: source.shownTitle },\n      stateCache: { activeVersion: target.slot },"},
  { name: 'session is not removed after a failed PATCH', file: LIB, from: "    if (!patched.ok) return await unfinished()", to: "    if (!patched.ok) return { ok: false, step: 'session', message: COPY_UNFINISHED_MESSAGE, strayLayoutPresentationId: copyId, sessionCleanup: 'removed' }" },
  { name: 'session POST happens before the Layout copy', file: LIB, from: "  // 1. Layout copies the deck. A failure here leaves nothing behind.\n", to: "  await deps.fetch('/api/sessions', { method: 'POST', headers: JSON_HEADERS, body: '{}' })\n" },
  { name: 'Layout copy title loses the suffix', file: LIB, from: "return `${cut}${COPY_TITLE_SUFFIX}`", to: 'return cut' },
  { name: 'relative Layout url is stored as is', file: LIB, from: "  if (candidate.startsWith('/')) return `${trimmed}${candidate}`\n", to: "  if (candidate.startsWith('/')) return candidate\n" },
  { name: 'a blocked viewer url is copyable', file: LIB, from: "if (decision.status !== 'allowed' || typeof decision.url !== 'string') return", to: "if (decision.status === 'never') return" },
  { name: 'lastMessageAt dropped (7-day ghost filter would hide the copy)', file: LIB, from: "      lastMessageAt: deps.now().toISOString(),\n", to: '' },
  { name: 'flag read loosely in the dashboard', file: PAGE, from: 'process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK === "true"', to: 'Boolean(process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK)' },
  { name: 'flag-off Duplicate item enabled', file: PAGE, from: '<DropdownMenuItem disabled aria-describedby={unavailableNote}>Duplicate</DropdownMenuItem>}{onDelete', to: '<DropdownMenuItem aria-describedby={unavailableNote}>Duplicate</DropdownMenuItem>}{onDelete' },
]
const MUTATION = process.env.DUP_TEST_MUTATION === undefined ? null : Number(process.env.DUP_TEST_MUTATION)
const read = (file, from = root) => {
  let text = fs.readFileSync(path.join(from, file), 'utf8')
  const mutation = from === root && MUTATION !== null ? MUTATIONS[MUTATION] : null
  if (mutation && mutation.file === file) {
    assert.ok(text.includes(mutation.from), `mutation "${mutation.name}" no longer applies; update MUTATIONS`)
    text = text.replace(mutation.from, mutation.to)
  }
  return text
}

// ---- a tiny module loader: the real TS compiled to CommonJS, run in a vm with a chosen process.env -----------------------------------------------------------
const libCache = new Map()
function loadTs(file, env, stubs = {}, { append = '', from = root, globals = {} } = {}) {
  const compiled = ts.transpileModule(read(file, from) + append, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  })
  assert.equal(compiled.diagnostics.length, 0, file)
  const mod = { exports: {} }
  const requireFn = id => {
    if (id in stubs) return stubs[id]
    if (id.endsWith('.css')) return {}
    if (id === '@/lib/studio-duplicate-deck') {
      if (!libCache.has(from)) libCache.set(from, loadTs(LIB, env, {}, { from }))
      return libCache.get(from)
    }
    return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
  }
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, require: requireFn, process: { env }, console, Date, Set, Map, Array, encodeURIComponent, decodeURIComponent, URL, ...globals,
  })
  return mod.exports
}

let testCount = 0
const failures = []
function run(name, fn) {
  testCount += 1
  try { const out = fn(); if (out && typeof out.then === 'function') throw new Error('use runAsync for async tests') } catch (err) { console.error(`FAIL: ${name}`); throw err }
}
const pending = []
function runAsync(name, fn) {
  testCount += 1
  pending.push(Promise.resolve().then(fn).catch(err => { console.error(`FAIL: ${name}`); failures.push(err) }))
}
const plain = value => JSON.parse(JSON.stringify(value))
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const tick = async (times = 12) => { for (let i = 0; i < times; i++) await new Promise(resolve => setImmediate(resolve)) }

// ---- the recording fake: every request this feature makes goes through it --------------------------------------------------------------------------------------
const LAYOUT = 'https://layout.example.invalid'
const SRC_SESSION = 'src-session-0000-4000-8000-000000000000'
const SRC_PRES = 'src-pres-0000-4000-8000-000000000000'
const COPY_PRES = 'copy-pres-0000-4000-8000-000000000000'
const OP_ID = '00000000-0000-4000-8000-0000000000a1'
const NEW_SESSION = '00000000-0000-4000-8000-0000000000a2'
const NOW = new Date('2026-10-22T12:00:00.000Z')
const respond = ({ status = 200, body = {} } = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new SyntaxError('empty body'); return body } })
const layoutOk = (over = {}) => ({ success: true, id: COPY_PRES, presentation_id: COPY_PRES, url: `/p/${COPY_PRES}`, presentation_url: `/p/${COPY_PRES}`, slide_count: 5, reused: false, ...over })
function makeDeps(route = {}, depOver = {}) {
  const calls = [], sleeps = []
  let ids = 0
  const handlers = {
    layout: () => respond({ body: layoutOk() }),
    create: () => respond({ status: 201, body: { session: { id: NEW_SESSION } } }),
    patch: () => respond({ body: { session: { id: NEW_SESSION, createdAt: '2026-10-22T12:00:00.100Z', updatedAt: '2026-10-22T12:00:00.200Z' } } }),
    remove: () => respond({ body: { session: { id: NEW_SESSION, status: 'deleted' } } }),
    ...route,
  }
  const fetchImpl = async (url, init = {}) => {
    const call = { url: String(url), method: init.method ?? 'GET', headers: init.headers === undefined ? null : plain(init.headers), body: init.body === undefined ? null : JSON.parse(init.body) }
    calls.push(call)
    const kind = call.url.includes('/api/presentations/') ? 'layout' : call.method === 'POST' ? 'create' : call.method === 'PATCH' ? 'patch' : call.method === 'DELETE' ? 'remove' : 'other'
    const out = await handlers[kind](call, calls.filter(item => item.method === call.method && item.url === call.url).length)
    if (out instanceof Error) throw out
    return out
  }
  const deps = {
    fetch: fetchImpl,
    layoutBaseUrl: () => LAYOUT,
    newId: () => { ids += 1; return ids === 1 ? OP_ID : ids === 2 ? NEW_SESSION : `00000000-0000-4000-8000-0000000000b${ids}` },
    now: () => NOW,
    sleep: async ms => { sleeps.push(ms) },
    ...depOver,
  }
  return { deps, calls, sleeps }
}

const lib = loadTs(LIB, {})
const {
  duplicateTargetFor, duplicateTitle, runDuplicateDeck, readCopiedFrom, loadCopiedFrom, copiedFromLine, presentationIdFromUrl,
  LAYOUT_FAILURE_MESSAGE, DUPLICATE_BLOCKED, COPY_UNFINISHED_MESSAGE, COPY_STRAY_NOTE, COPY_SESSION_NOT_REMOVED_NOTE, PATCH_RETRY_DELAYS_MS, LAYOUT_TITLE_MAX,
} = lib

const allow = url => url.startsWith(`${LAYOUT}/`) ? { status: 'allowed', url } : url.startsWith('http') ? { status: 'blocked', reason: 'unapproved_origin' } : { status: 'empty', url: null }
const FINAL_URL = `${LAYOUT}/p/${SRC_PRES}`
const finalTarget = duplicateTargetFor({ finalPresentationUrl: FINAL_URL, strawmanPreviewUrl: null }, allow)
const strawTarget = duplicateTargetFor({ finalPresentationUrl: null, strawmanPreviewUrl: FINAL_URL }, allow)
const SOURCE = { sessionId: SRC_SESSION, shownTitle: 'Q3 Review', currentStage: 6, slideCount: 4 }

// ====== 1. the flag ======================================================================================================================================================
run('the flag is read as the exact string "true" inline in the dashboard and the builder page, and defaults off', () => {
  assert.equal((read(PAGE).match(/process\.env\.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK === "true"/g) || []).length, 1)
  assert.equal((read(BUILDER).match(/process\.env\.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK === 'true'/g) || []).length, 1)
  assert.equal(lib.STUDIO_DUPLICATE_DECK_FLAG, FLAG)
  // Neither the lib nor the note component reads the flag: the callers do (a flag imported from a module would be a truthy stub in the existing page harnesses).
  assert.doesNotMatch(read(LIB), /process\.env/)
  assert.doesNotMatch(read(NOTE), /process\.env/)
})
run('the flag is documented in .env.example, default "false", after the polish block; package.json is not touched (it is the base\'s, or the base\'s plus other changes\' test scripts)', () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_DUPLICATE_DECK="false"$/m)
  // test-studio-p2-polish holds .env.example to its own earlier base up to ITS block, so this change's block sits after that block (and is the one just above the Profile page block)
  const env = read('.env.example')
  assert.ok(env.indexOf('NEXT_PUBLIC_STUDIO_P2_POLISH="false"') > 0 && env.indexOf('# PASS3 DUPLICATE A DECK') > env.indexOf('NEXT_PUBLIC_STUDIO_P2_POLISH="false"'), 'the block comes after the polish flag')
  assert.equal(env.split('# PASS3 DUPLICATE A DECK').length - 1, 1, 'the block is there once')
  const base = baseSource('package.json')
  if (base !== null) {
    assert.ok(read('package.json') === base || appendOnlyOver('package.json', read('package.json'), base), 'package.json is untouched (other changes may add their test scripts)')
  }
})

// ====== 2. which decks can be copied =====================================================================================================================================
run('a deck with a final URL is copied from the final slot; its id is read from the viewer URL', () => {
  assert.deepEqual(plain(finalTarget), { ok: true, slot: 'final', presentationId: SRC_PRES, url: FINAL_URL })
})
run('with no final deck the strawman (outline preview) is the slot; when both exist the final wins', () => {
  assert.deepEqual(plain(strawTarget), { ok: true, slot: 'strawman', presentationId: SRC_PRES, url: FINAL_URL })
  const both = duplicateTargetFor({ finalPresentationUrl: `${LAYOUT}/p/final-1`, strawmanPreviewUrl: `${LAYOUT}/p/straw-1` }, allow)
  assert.equal(both.slot, 'final'); assert.equal(both.presentationId, 'final-1')
})
run('no deck, a viewer URL the policy refuses, and a URL without an id are disabled with a short reason', () => {
  assert.deepEqual(plain(duplicateTargetFor({}, allow)), { ok: false, reason: DUPLICATE_BLOCKED.noDeck })
  assert.deepEqual(plain(duplicateTargetFor({ finalPresentationUrl: '' , strawmanPreviewUrl: null }, allow)), { ok: false, reason: DUPLICATE_BLOCKED.noDeck })
  assert.deepEqual(plain(duplicateTargetFor({ finalPresentationUrl: 'https://other-env.example.invalid/p/x' }, allow)), { ok: false, reason: DUPLICATE_BLOCKED.otherEnvironment })
  assert.deepEqual(plain(duplicateTargetFor({ finalPresentationUrl: `${LAYOUT}/not-a-deck` }, allow)), { ok: false, reason: DUPLICATE_BLOCKED.noId })
  for (const reason of Object.values(DUPLICATE_BLOCKED)) assert.ok(reason.length < 90, reason)
})
run('presentationIdFromUrl: the segment after the last /p/, decoded; nothing for other shapes', () => {
  assert.equal(presentationIdFromUrl(`${LAYOUT}/p/a%20b`), 'a b')
  assert.equal(presentationIdFromUrl(`${LAYOUT}/x/p/id-9?mode=view`), 'id-9')
  for (const bad of [null, undefined, '', 'not a url', `${LAYOUT}/p/`, `${LAYOUT}/q/9`]) assert.equal(presentationIdFromUrl(bad), null, String(bad))
})
run('duplicateTitle: "<title> (copy)", never over Layout\'s 200 characters, never empty', () => {
  assert.equal(duplicateTitle('Q3 Review'), 'Q3 Review (copy)')
  assert.equal(duplicateTitle('  Q3 Review  '), 'Q3 Review (copy)')
  assert.equal(duplicateTitle(''), 'Untitled Presentation (copy)')
  assert.equal(duplicateTitle(undefined), 'Untitled Presentation (copy)')
  const long = duplicateTitle('x'.repeat(500))
  assert.equal(Array.from(long).length, LAYOUT_TITLE_MAX); assert.ok(long.endsWith('… (copy)'))
  const emoji = duplicateTitle('\u{1F600}'.repeat(300))
  assert.equal(Array.from(emoji).length, LAYOUT_TITLE_MAX); assert.doesNotMatch(emoji, /[\ud800-\udbff](?![\udc00-\udfff])/)
  assert.equal(duplicateTitle('y'.repeat(193)), `${'y'.repeat(193)} (copy)`)
})

// ====== 3. the wire ======================================================================================================================================================
runAsync('final deck: Layout POST, then POST /api/sessions, then PATCH /api/sessions/{id}, each byte for byte', async () => {
  const { deps, calls } = makeDeps()
  const result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
  assert.deepEqual(calls.map(call => `${call.method} ${call.url}`), [
    `POST ${LAYOUT}/api/presentations/${SRC_PRES}/duplicate`,
    'POST /api/sessions',
    `PATCH /api/sessions/${NEW_SESSION}`,
  ])
  for (const call of calls) assert.deepEqual(call.headers, { 'Content-Type': 'application/json' })
  assert.deepEqual(calls[0].body, { operation_id: OP_ID, title: 'Q3 Review (copy)' })
  assert.deepEqual(calls[1].body, { sessionId: NEW_SESSION, title: 'Q3 Review (copy)' })
  assert.deepEqual(calls[2].body, {
    currentStage: 6,
    slideCount: 5,
    lastMessageAt: '2026-10-22T12:00:00.000Z',
    finalPresentationUrl: `${LAYOUT}/p/${COPY_PRES}`,
    finalPresentationId: COPY_PRES,
    stateCache: { activeVersion: 'final', currentStatus: { copiedFrom: { sessionId: SRC_SESSION, title: 'Q3 Review' } } },
  })
  assert.notEqual(OP_ID, NEW_SESSION)
  assert.equal(result.ok, true)
  assert.deepEqual({ ...result, session: undefined }, {
    ok: true, sessionId: NEW_SESSION, title: 'Q3 Review (copy)', slot: 'final', presentationId: COPY_PRES, presentationUrl: `${LAYOUT}/p/${COPY_PRES}`,
    slideCount: 5, currentStage: 6, reused: false, session: undefined,
  })
  assert.equal(result.session.createdAt, '2026-10-22T12:00:00.100Z')
})
runAsync('strawman deck: the copy goes in the strawman slot, stage 4, activeVersion strawman, and no final field is sent', async () => {
  const { deps, calls } = makeDeps()
  const result = await runDuplicateDeck({ source: { ...SOURCE, currentStage: 4 }, target: strawTarget, deps })
  assert.equal(result.ok, true)
  assert.deepEqual(calls[2].body, {
    currentStage: 4,
    slideCount: 5,
    lastMessageAt: '2026-10-22T12:00:00.000Z',
    strawmanPreviewUrl: `${LAYOUT}/p/${COPY_PRES}`,
    strawmanPresentationId: COPY_PRES,
    stateCache: { activeVersion: 'strawman', currentStatus: { copiedFrom: { sessionId: SRC_SESSION, title: 'Q3 Review' } } },
  })
})
runAsync('the stage follows the source (4..6); an out-of-range stage falls back to the slot\'s own (final 6, strawman 4)', async () => {
  for (const [stage, slot, want] of [[5, finalTarget, 5], [3, finalTarget, 6], [undefined, finalTarget, 6], [0, strawTarget, 4], [6, strawTarget, 6], [null, strawTarget, 4]]) {
    const { deps, calls } = makeDeps()
    await runDuplicateDeck({ source: { ...SOURCE, currentStage: stage }, target: slot, deps })
    assert.equal(calls[2].body.currentStage, want, String(stage))
  }
})
runAsync('the PATCH carries only the listed fields: no title, status, blank slot, slideStructure, messages, or any chat field', async () => {
  const { deps, calls } = makeDeps()
  await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps })
  assert.deepEqual(Object.keys(calls[2].body).sort(), ['currentStage', 'finalPresentationId', 'finalPresentationUrl', 'lastMessageAt', 'slideCount', 'stateCache'])
  assert.deepEqual(Object.keys(calls[2].body.stateCache).sort(), ['activeVersion', 'currentStatus'])
  assert.deepEqual(Object.keys(calls[2].body.stateCache.currentStatus), ['copiedFrom'])
  assert.deepEqual(Object.keys(calls[2].body.stateCache.currentStatus.copiedFrom).sort(), ['sessionId', 'title'])
})
runAsync('the original session and its Layout deck are never written: only the Layout read-source POST names the original deck, nothing names the original session', async () => {
  const { deps, calls } = makeDeps()
  await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps })
  assert.deepEqual(calls.filter(call => call.url.includes(SRC_SESSION)).map(call => call.url), [])
  assert.equal(calls.filter(call => call.url.includes(SRC_PRES)).length, 1)
  assert.ok(calls.every(call => call.method === 'POST' || call.method === 'PATCH'))
  assert.ok(!calls.some(call => call.method === 'DELETE' || call.method === 'PUT' || call.method === 'GET'))
})
runAsync('Layout\'s relative url becomes an absolute viewer URL on the Layout base; an absolute url is kept; no url falls back to /p/{id}; a trailing slash on the base is dropped', async () => {
  for (const [body, base, want] of [
    [layoutOk(), LAYOUT, `${LAYOUT}/p/${COPY_PRES}`],
    [layoutOk(), `${LAYOUT}/`, `${LAYOUT}/p/${COPY_PRES}`],
    [layoutOk({ presentation_url: `https://other.example.invalid/p/${COPY_PRES}` }), LAYOUT, `https://other.example.invalid/p/${COPY_PRES}`],
    [layoutOk({ presentation_url: undefined, url: undefined }), LAYOUT, `${LAYOUT}/p/${COPY_PRES}`],
    [layoutOk({ presentation_url: undefined, url: `/p/${COPY_PRES}` }), LAYOUT, `${LAYOUT}/p/${COPY_PRES}`],
    [layoutOk({ presentation_id: undefined }), LAYOUT, `${LAYOUT}/p/${COPY_PRES}`],
  ]) {
    const { deps, calls } = makeDeps({ layout: () => respond({ body }) }, { layoutBaseUrl: () => base })
    const result = await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps })
    assert.equal(result.ok, true, JSON.stringify(body))
    assert.equal(calls[2].body.finalPresentationUrl, want)
    assert.ok(calls[0].url.startsWith(`${LAYOUT}/api/presentations/`), calls[0].url)
  }
})
runAsync('a Layout reply that says reused: true is a success and is reported as reused; slide_count falls back to the original\'s count', async () => {
  const { deps, calls } = makeDeps({ layout: () => respond({ body: layoutOk({ reused: true, slide_count: undefined }) }) })
  const result = await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps })
  assert.equal(result.ok, true); assert.equal(result.reused, true); assert.equal(result.slideCount, 4); assert.equal(calls[2].body.slideCount, 4)
})
runAsync('the id of the original deck is URL-encoded in the Layout path', async () => {
  const target = duplicateTargetFor({ finalPresentationUrl: `${LAYOUT}/p/a%2Fb%20c` }, allow)
  assert.equal(target.presentationId, 'a/b c')
  const { deps, calls } = makeDeps()
  await runDuplicateDeck({ source: SOURCE, target, deps })
  assert.equal(calls[0].url, `${LAYOUT}/api/presentations/a%2Fb%20c/duplicate`)
})

// ====== 4. failure paths =================================================================================================================================================
const noSessionCalls = calls => assert.deepEqual(calls.filter(call => call.url.startsWith('/api/sessions')), [], 'nothing may be created or removed in the sessions API')
runAsync('Layout failure creates nothing: 404 "Not Found" (Layout flag off), 404 "Presentation not found", 409, 422, 500, bad body, success:false, no id', async () => {
  const cases = [
    ['404 route not found (Layout flag off)', respond({ status: 404, body: { detail: 'Not Found' } }), 'unavailable'],
    ['404 with no body', respond({ status: 404, body: undefined }), 'unavailable'],
    ['404 source missing', respond({ status: 404, body: { detail: 'Presentation not found' } }), 'source_missing'],
    ['409', respond({ status: 409, body: { detail: 'Duplicate operation id is already bound to a different source' } }), 'failed'],
    ['422', respond({ status: 422, body: { detail: [] } }), 'failed'],
    ['500', respond({ status: 500, body: { detail: 'Error duplicating presentation: X' } }), 'failed'],
    ['200 without a body', respond({ status: 200, body: undefined }), 'failed'],
    ['200 success:false', respond({ body: layoutOk({ success: false }) }), 'failed'],
    ['200 no id', respond({ body: layoutOk({ id: undefined, presentation_id: undefined }) }), 'failed'],
  ]
  for (const [name, response, reason] of cases) {
    const { deps, calls } = makeDeps({ layout: () => response })
    const result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
    assert.deepEqual(result, { ok: false, step: 'layout', reason, message: LAYOUT_FAILURE_MESSAGE[reason] }, name)
    assert.equal(calls.length, 1, name); noSessionCalls(calls)
    assert.match(result.message, /Nothing was created\.$/, name)
  }
})
runAsync('Layout unreachable (fetch rejects) and Layout not configured (base URL throws) create nothing', async () => {
  let { deps, calls } = makeDeps({ layout: () => new TypeError('Failed to fetch') })
  let result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
  assert.deepEqual(result, { ok: false, step: 'layout', reason: 'unreachable', message: LAYOUT_FAILURE_MESSAGE.unreachable }); noSessionCalls(calls)
  ;({ deps, calls } = makeDeps({}, { layoutBaseUrl: () => { throw new Error('Layout service is not configured.') } }))
  result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
  assert.deepEqual(result, { ok: false, step: 'layout', reason: 'not_configured', message: LAYOUT_FAILURE_MESSAGE.not_configured }); assert.equal(calls.length, 0)
  ;({ deps, calls } = makeDeps({}, { newId: () => { throw new Error('no crypto') } }))
  result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
  assert.equal(result.reason, 'failed'); assert.equal(calls.length, 0)
})
const UNFINISHED = `${COPY_UNFINISHED_MESSAGE} ${COPY_STRAY_NOTE}`
runAsync('session POST fails (500): the new session is soft-deleted and the person hears "The copy could not be finished." plus the stray-copy note', async () => {
  const { deps, calls } = makeDeps({ create: () => respond({ status: 500, body: { error: 'Internal server error' } }) })
  const result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
  assert.deepEqual(result, { ok: false, step: 'session', message: UNFINISHED, strayLayoutPresentationId: COPY_PRES, sessionCleanup: 'removed' })
  assert.deepEqual(calls.map(call => `${call.method} ${call.url}`), [`POST ${LAYOUT}/api/presentations/${SRC_PRES}/duplicate`, 'POST /api/sessions', `DELETE /api/sessions/${NEW_SESSION}`])
  assert.equal(calls[2].body, null)
})
runAsync('session POST answers 401, 403, 409, or the network drops: same cleanup', async () => {
  for (const create of [() => respond({ status: 401, body: {} }), () => respond({ status: 403, body: {} }), () => respond({ status: 409, body: {} }), () => new TypeError('Failed to fetch')]) {
    const { deps, calls } = makeDeps({ create })
    const result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
    assert.equal(result.step, 'session'); assert.equal(result.message, UNFINISHED)
    assert.equal(calls.at(-1).method, 'DELETE'); assert.equal(calls.at(-1).url, `/api/sessions/${NEW_SESSION}`)
  }
})
runAsync('PATCH fails (500): the new session is soft-deleted, the message is the same, the Layout copy is named as stray', async () => {
  const { deps, calls } = makeDeps({ patch: () => respond({ status: 500, body: { error: 'Internal server error' } }) })
  const result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
  assert.deepEqual(result, { ok: false, step: 'session', message: UNFINISHED, strayLayoutPresentationId: COPY_PRES, sessionCleanup: 'removed' })
  assert.deepEqual(calls.map(call => `${call.method} ${call.url}`), [
    `POST ${LAYOUT}/api/presentations/${SRC_PRES}/duplicate`, 'POST /api/sessions', `PATCH /api/sessions/${NEW_SESSION}`, `DELETE /api/sessions/${NEW_SESSION}`,
  ])
})
runAsync('PATCH rejects with a network error: same cleanup', async () => {
  const { deps, calls } = makeDeps({ patch: () => new TypeError('Failed to fetch') })
  const result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
  assert.equal(result.step, 'session'); assert.equal(calls.at(-1).method, 'DELETE')
})
runAsync('PATCH 404 right after the create (write race): retried after 400, 800, 1200 ms like the sessions hook; a later 200 is a success and nothing is deleted', async () => {
  assert.deepEqual([...PATCH_RETRY_DELAYS_MS], [400, 800, 1200])
  const { deps, calls, sleeps } = makeDeps({ patch: (_call, n) => n < 3 ? respond({ status: 404, body: {} }) : respond({ body: { session: { id: NEW_SESSION } } }) })
  const result = await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps })
  assert.equal(result.ok, true)
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 3)
  assert.deepEqual(sleeps, [400, 800])
  assert.ok(!calls.some(call => call.method === 'DELETE'))
  assert.deepEqual(calls[2].body, calls[3].body); assert.deepEqual(calls[3].body, calls[4].body)
})
runAsync('PATCH 404 on every attempt: four tries, then the session is deleted (a 404 on DELETE counts as already gone)', async () => {
  const { deps, calls, sleeps } = makeDeps({ patch: () => respond({ status: 404, body: {} }), remove: () => respond({ status: 404, body: {} }) })
  const result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 4); assert.deepEqual(sleeps, [400, 800, 1200])
  assert.deepEqual(result, { ok: false, step: 'session', message: UNFINISHED, strayLayoutPresentationId: COPY_PRES, sessionCleanup: 'removed' })
  assert.equal(calls.at(-1).method, 'DELETE')
})
runAsync('a cleanup DELETE that fails (500) or throws is reported: the session may remain in history', async () => {
  for (const remove of [() => respond({ status: 500, body: {} }), () => new TypeError('Failed to fetch')]) {
    const { deps } = makeDeps({ patch: () => respond({ status: 500, body: {} }), remove })
    const result = plain(await runDuplicateDeck({ source: SOURCE, target: finalTarget, deps }))
    assert.equal(result.sessionCleanup, 'failed')
    assert.equal(result.message, `${UNFINISHED} ${COPY_SESSION_NOT_REMOVED_NOTE}`)
  }
})
run('the failure texts are the ones the brief asks for', () => {
  assert.equal(COPY_UNFINISHED_MESSAGE, 'The copy could not be finished.')
  assert.match(COPY_STRAY_NOTE, /stray copy/); assert.match(COPY_STRAY_NOTE, /storage/); assert.match(COPY_STRAY_NOTE, /cannot be removed from here/)
  for (const message of Object.values(LAYOUT_FAILURE_MESSAGE)) assert.match(message, /Nothing was created\.$/)
  assert.match(LAYOUT_FAILURE_MESSAGE.unavailable, /not available in this environment yet/)
})

// ====== 5. the Copied-from line, and the chat hard rule ==================================================================================================================
run('readCopiedFrom reads exactly stateCache.currentStatus.copiedFrom { sessionId, title } and nothing looser', () => {
  const session = (copiedFrom, extra = {}) => ({ id: 'n', stateCache: { currentStatus: { copiedFrom, ...extra }, slideStructure: null, activeVersion: 'final' } })
  assert.deepEqual(plain(readCopiedFrom(session({ sessionId: ' s1 ', title: ' Q3 Review ' }))), { sessionId: 's1', title: 'Q3 Review' })
  for (const bad of [null, undefined, {}, { sessionId: 's1' }, { title: 'T' }, { sessionId: '', title: 'T' }, { sessionId: 's', title: '  ' }, { sessionId: 1, title: 'T' }, 'x', []]) assert.equal(readCopiedFrom(session(bad)), null, JSON.stringify(bad))
  for (const bad of [null, undefined, {}, { stateCache: null }, { stateCache: {} }, { stateCache: { currentStatus: null } }, { stateCache: { currentStatus: { status: 'ready' } } },
    { stateCache: { copiedFrom: { sessionId: 's', title: 'T' } } }, { copiedFrom: { sessionId: 's', title: 'T' } }, 'x']) assert.equal(readCopiedFrom(bad), null, JSON.stringify(bad))
})
runAsync('loadCopiedFrom: one GET /api/sessions/{id} (no-store), the marker back; any failure is "no marker" and nothing is ever written', async () => {
  const calls = []
  const mk = response => async (url, init) => { calls.push({ url, init: plain(init ?? {}) }); if (response instanceof Error) throw response; return response }
  const found = await loadCopiedFrom('new copy/1', mk(respond({ body: { session: { stateCache: { currentStatus: { copiedFrom: { sessionId: SRC_SESSION, title: 'Q3 Review' } } } } } })))
  assert.deepEqual(plain(found), { sessionId: SRC_SESSION, title: 'Q3 Review' })
  assert.deepEqual(calls, [{ url: '/api/sessions/new%20copy%2F1', init: { cache: 'no-store' } }])
  for (const response of [respond({ status: 404 }), respond({ status: 410 }), respond({ status: 401 }), respond({ body: undefined }), respond({ body: { session: null } }), new TypeError('offline')]) {
    assert.equal(await loadCopiedFrom('x', mk(response)), null)
  }
  assert.ok(calls.every(call => !call.init.method || call.init.method === 'GET'))
})
run('copiedFromLine is the one sentence PROGRAM-1 decided', () => {
  assert.equal(copiedFromLine('Q3 Review'), 'Copied from Q3 Review. Chat history stays with the original.')
})

// react stub with cursor-based hooks, so the note's effect can be driven by hand
function reactHarness() {
  const cells = [], effects = []
  let cursor = 0
  const jsx = (type, props, key) => ({ type, props: props || {}, key })
  return {
    stubs: {
      'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
      react: {
        useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value }] },
        useEffect(fn, deps) { const i = cursor++; const prev = effects[i]; if (!prev || !prev.deps || deps.some((d, k) => !Object.is(d, prev.deps[k]))) { prev?.cleanup?.(); effects[i] = { deps, run: fn } } else effects[i] = prev },
      },
    },
    start() { cursor = 0 },
    flush() { for (const e of effects) if (e && e.run) { const run = e.run; e.run = null; e.cleanup = run() } },
    unmount() { for (const e of effects) e?.cleanup?.() },
  }
}
const textOf = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(textOf).join('') : textOf(node.props?.children)
runAsync('StudioCopiedFromNote reads the marker once and shows ONE element with the exact sentence; its own element, not a chat message', async () => {
  const react = reactHarness()
  const fetched = []
  const fakeFetch = async (url, init) => { fetched.push({ url, method: init?.method ?? 'GET', hasSignal: Boolean(init?.signal) }); return respond({ body: { session: { stateCache: { currentStatus: { copiedFrom: { sessionId: SRC_SESSION, title: 'Q3 Review' } } } } } }) }
  const mod = loadTs(NOTE, {}, react.stubs, { globals: { fetch: fakeFetch, AbortController } })
  react.start(); let out = mod.StudioCopiedFromNote({ sessionId: 'copy-1', studioShell: true, className: 'mx-3 mt-2' })
  assert.equal(out.props.copiedFrom ?? null, null, 'nothing before the read lands')
  assert.equal(mod.StudioCopiedFromLine(out.props), null)
  react.flush(); await tick()
  react.start(); out = mod.StudioCopiedFromNote({ sessionId: 'copy-1', studioShell: true, className: 'mx-3 mt-2' })
  const line = mod.StudioCopiedFromLine(out.props)
  assert.equal(textOf(line), 'Copied from Q3 Review. Chat history stays with the original.')
  assert.equal(line.type, 'p'); assert.equal(line.props['data-studio-copied-from-note'], 'true'); assert.match(line.props.className, /mx-3 mt-2/)
  assert.deepEqual(fetched, [{ url: '/api/sessions/copy-1', method: 'GET', hasSignal: true }])
  // a marker read for another session is never shown for this one
  react.start(); out = mod.StudioCopiedFromNote({ sessionId: 'someone-else', studioShell: true })
  assert.equal(mod.StudioCopiedFromLine(out.props), null)
  react.unmount()
})
runAsync('StudioCopiedFromNote: no session, "new", or no marker renders nothing; an unmounted read lands nowhere; shell and classic variants differ only in styling', async () => {
  const react = reactHarness(); let calls = 0
  const mod = loadTs(NOTE, {}, react.stubs, { globals: { fetch: async () => { calls += 1; return respond({ status: 404 }) }, AbortController } })
  for (const sessionId of [null, undefined, 'new']) { react.start(); mod.StudioCopiedFromNote({ sessionId }); react.flush(); await tick() }
  assert.equal(calls, 0)
  react.start(); const out = mod.StudioCopiedFromNote({ sessionId: 'saved-without-marker' }); react.flush(); await tick()
  assert.equal(calls, 1); assert.equal(mod.StudioCopiedFromLine(out.props), null)
  react.unmount()
  const shell = mod.StudioCopiedFromLine({ copiedFrom: { sessionId: 's', title: 'T' }, studioShell: true })
  const classic = mod.StudioCopiedFromLine({ copiedFrom: { sessionId: 's', title: 'T' }, studioShell: false })
  assert.equal(textOf(shell), textOf(classic)); assert.match(shell.props.style.background, /--ss-panel/); assert.match(classic.props.className, /dark:bg-slate-800/)
  assert.equal(mod.StudioCopiedFromLine({ copiedFrom: null }), null)
})
run('chat hard rule: the note and the lib import nothing from the chat, socket, cache or restore code, and none of that code mentions the feature', () => {
  const imports = file => [...read(file).matchAll(/from '([^']+)'/g)].map(match => match[1]).sort()
  assert.deepEqual(imports(NOTE), ['@/lib/studio-duplicate-deck', 'react'])
  assert.deepEqual(imports(LIB), [])
  for (const file of ['hooks/use-deckster-websocket-v2.ts', 'hooks/use-builder-session.ts', 'hooks/use-session-cache.ts', 'hooks/use-session-persistence.ts', 'hooks/use-chat-sessions.ts',
    'components/builder/message-list.tsx', 'components/builder/chat-input.tsx', 'lib/director-chat-history.ts', 'lib/director-transcript.ts', 'app/api/sessions/route.ts', 'app/api/sessions/[id]/route.ts']) {
    const source = read(file)
    assert.doesNotMatch(source, /copiedFrom|studio-duplicate-deck|STUDIO_DUPLICATE_DECK|StudioCopiedFrom/, file)
  }
})
run('the strip: without this change\'s lines each page (and .env.example) is the base commit\'s, byte for byte (sibling pins reach it through stripDeckTitle and stripAddSlideStatus)', () => {
  for (const rel of [DASHBOARD_PAGE, BUILDER_PAGE, ENV_FILE]) {
    const table = DUPLICATE_DECK_ADDITIONS[rel]
    assert.ok(table.length > 0)
    for (const [added] of table) assert.equal(read(rel).split(added).length - 1, 1, `${rel}: strip entry applies once`)
    const stripped = stripDuplicateDeck(rel, read(rel))
    assert.doesNotMatch(stripped, /DUPLICATE_DECK|studio-duplicate-deck|StudioCopiedFrom|duplicateControl|duplicateSession|DuplicateControl/, `${rel}: no trace left`)
    const base = baseSource(rel)
    if (base === null) console.log(`  SKIP base-commit identity of ${rel}: ${BASE_COMMIT} is not in this clone`)
    else if (rel === ENV_FILE) assert.ok(stripped === base || appendOnlyOver(rel, stripped, base), `${rel}: without the added lines the file is ${BASE_COMMIT}'s lines, in order (a later change's block may follow)`)
    // The Builder page also carries later stacked changes (e.g. NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE), and each chains its strip into stripOpenReadOnly:
    // alone this change must give back the base exactly; stacked, the page and the base must agree once every chained strip has run.
    else if (rel === BUILDER_PAGE) assert.ok(stripped === base || stripOpenReadOnly(rel, read(rel)) === stripOpenReadOnly(rel, base), `${rel}: without the added lines the page is ${BASE_COMMIT}'s (or differs only by lines a stacked change strips through stripOpenReadOnly)`)
    else assert.equal(stripped, base, `${rel}: without the added lines the page is ${BASE_COMMIT}'s`)
  }
  assert.equal(stripDuplicateDeck('lib/other.ts', 'x'), 'x')
})
run('the older pins reach the strip: every strip a sibling pin already calls on these pages takes this change\'s lines out first', () => {
  const builder = read(BUILDER_PAGE), decks = read(DASHBOARD_PAGE)
  for (const [name, strip] of [['stripAddSlideStatus', stripAddSlideStatus], ['stripOpenReadOnly', stripOpenReadOnly], ['stripDarkPersist', stripDarkPersist]]) {
    assert.doesNotMatch(strip(BUILDER_PAGE, builder), /StudioCopiedFrom|DUPLICATE_DECK/, `${name} on the Builder page`)
  }
  assert.doesNotMatch(stripDeckTitle(decks), /DUPLICATE_DECK|duplicateControl|duplicateSession|studio-duplicate-deck/, 'stripDeckTitle on the Decks page')
})
run('the chat hard rule, against the base commit: the reducer, cache, history restore, socket, composer, message list and the sessions API are byte-for-byte untouched', () => {
  const files = ['hooks/use-deckster-websocket-v2.ts', 'hooks/use-builder-session.ts', 'hooks/use-session-cache.ts', 'hooks/use-session-persistence.ts', 'hooks/use-chat-sessions.ts',
    'components/builder/message-list.tsx', 'components/builder/chat-input.tsx', 'lib/director-chat-history.ts', 'lib/director-transcript.ts', 'lib/director-layout-url-ingress.ts',
    'app/api/sessions/route.ts', 'app/api/sessions/[id]/route.ts', 'app/api/sessions/[id]/messages/route.ts', 'components/builder/studio-decks.css']
  for (const rel of files) {
    const base = baseSource(rel)
    if (base === null) { console.log(`  SKIP ${rel}: ${BASE_COMMIT} is not in this clone`); continue }
    assert.equal(read(rel), base, `${rel} is untouched`)
  }
})
run('the builder page mounts the note once, as a sibling beside the other chat notices, gated on the flag; the page adds no other reference', () => {
  const page = read(BUILDER)
  assert.equal((page.match(/<StudioCopiedFromNote\b/g) || []).length, 1)
  assert.match(page, /\{process\.env\.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK === 'true' && !session\.isLoadingSession && !session\.isResumedSession && !isUnsavedSession && <StudioCopiedFromNote className="mx-3 mt-2" studioShell=\{studioShell\} sessionId=\{currentSessionId\} \/>\}/)
  const at = page.indexOf('<StudioCopiedFromNote'), before = page.slice(0, at), after = page.slice(at)
  assert.ok(before.lastIndexOf('<StudioSupersededNotice') > before.lastIndexOf('<ScrollArea'), 'after the chat notices')
  assert.ok(after.indexOf('<ScrollArea') > 0 && after.indexOf('<ScrollArea') < after.indexOf('<MessageList'), 'before the message list scroller, not inside it')
  assert.equal((page.match(/copiedFrom|STUDIO_DUPLICATE_DECK|studio-duplicate-deck/g) || []).length, 2, 'import and mount only (the import path has no flag name; the comment names the flag once)')
})

// ====== 6. a dashboard card: flag off is the base ========================================================================================================================
const jsxFn = (type, props, key) => ({ type, props: props || {}, key })
function pageStubs(extra = {}) {
  return {
    'react/jsx-runtime': { jsx: jsxFn, jsxs: jsxFn, Fragment: 'Fragment' },
    react: { useState: v => [v, () => {}], useRef: v => ({ current: v }), useCallback: f => f, useEffect: () => {} },
    'next/link': { __esModule: true, default: 'Link' },
    '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {}, getLayoutServiceUrl: () => LAYOUT },
    '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: url => typeof url === 'string' && url.startsWith(`${LAYOUT}/`) ? { status: 'allowed', url } : typeof url === 'string' && url.startsWith('http') ? { status: 'blocked', origin: null, reason: 'unapproved_origin' } : { status: 'empty', url: null, origin: null } },
    '@/lib/present-view-only': { viewOnlyIfEnabled: url => url },
    '@/lib/studio-create-word': { studioCreateLabel: (_enabled, original) => original },
    ...extra,
  }
}
function loadCard(env, from = root) {
  const source = loadTs(PAGE, env, pageStubs(), { append: '\nexport { PresentationCard };', from })
  return source.PresentationCard
}
function serialise(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(serialise).join('')
  if (typeof node.type === 'function') return serialise(node.type(node.props))
  const { children, ...rest } = node.props
  const attrs = Object.keys(rest).sort().map(key => typeof rest[key] === 'function' ? `${key}=<fn>` : `${key}=${JSON.stringify(rest[key])}`)
  return `<${node.type}${attrs.length ? ' ' + attrs.join(' ') : ''}>${serialise(children)}</${node.type}>`
}
const normaliseDates = html => html.replace(/Updated [^<]*/g, 'Updated <date>')
const walk = (tree, predicate, found = []) => {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(item => walk(item, predicate, found)); return found }
  if (typeof tree.type === 'function') return walk(tree.type(tree.props), predicate, found)
  if (predicate(tree)) found.push(tree)
  walk(tree.props?.children, predicate, found); return found
}
const getStatusColor = status => `color-${status}`
const getStageName = stage => ({ 4: 'Preview Ready', 6: 'Complete' }[stage] ?? 'Unknown')
const cardBase = {
  id: 'deck-1', title: 'Q3 Review', description: 'Q3 Review', createdAt: '2026-10-10T09:00:00Z', updatedAt: '2026-10-10T09:30:00Z', slideCount: 4, status: 'completed',
  thumbnail: '/placeholder.svg', folder: 'general', tags: [], strawmanPreviewUrl: null, finalPresentationUrl: `${LAYOUT}/p/deck-1`, currentStage: 6,
}
const CARD_FIXTURES = {
  'completed deck': cardBase,
  'outline preview only': { ...cardBase, id: 'deck-2', status: 'in-progress', currentStage: 4, finalPresentationUrl: null, strawmanPreviewUrl: `${LAYOUT}/p/deck-2`, description: 'Build a board deck' },
  'no deck at all': { ...cardBase, id: 'deck-3', status: 'draft', currentStage: 4, finalPresentationUrl: null, strawmanPreviewUrl: null },
  'tags and a long title': { ...cardBase, id: 'deck-4', title: 'Adopting AI-driven demand forecasting in mid-size retail', tags: ['ops', 'retail', 'q4', 'board'], slideCount: 62 },
}
const renderCard = (Card, presentation, withDelete, extra = {}) => Card({ presentation, onOpen() {}, getStatusColor, getStageName, ...(withDelete ? { onDelete() {}, deleteDisabled: false } : {}), ...extra })

// ---- the whole dashboard page, driven like scripts/test-atlas-decks-pagination.mjs: the REAL DashboardForAccount, hooks by cursor, every service a recording fake --------
const deferred = () => { let resolve; const promise = new Promise(value => { resolve = value }); return { promise, resolve } }
const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
const PAGE_NOW = '2026-10-22T12:00:00.000Z'
class FixedDate extends Date {
  constructor(...a) { super(...(a.length ? a : [PAGE_NOW])) }
  static now() { return new Date(PAGE_NOW).getTime() }
}
function pageHarness({ from = root, env, fetchImpl, toasts = [], randomUUID } = {}) {
  const cells = [], slots = [], pendingEffects = []
  let cursor = 0
  const reading = [], pushes = [], fetches = []
  const auth = { user: { id: 'owner-a', email: 'owner-a@example.invalid', tier: 'pro' }, isLoading: false }
  const loadSessions = () => { const request = deferred(); reading.push(request); return request.promise }
  const deleteSession = async () => true
  const react = {
    useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial; return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value }] },
    useRef(initial) { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index] },
    useCallback(fn, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) slots[index] = { deps, fn }; return slots[index].fn },
    useEffect(fn, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) pendingEffects.push({ index, fn, deps }) },
  }
  const stubs = pageStubs({
    react,
    '@/hooks/use-auth': { useAuth: () => auth },
    '@/hooks/use-chat-sessions': { useChatSessions: () => ({ loadSessions, deleteSession }) },
    'next/navigation': { useRouter: () => ({ push: url => pushes.push(url) }) },
    '@/hooks/use-session-cache': { sessionCacheKey: (owner, session) => `c_${owner}_${session}`, sessionMetadataCacheKey: (owner, session) => `m_${owner}_${session}` },
    '@/lib/last-builder-session': { lastBuilderSessionKey: owner => `last:${owner}` },
    '@/hooks/use-toast': { toast: arg => toasts.push(plain(arg)) },
  })
  const noFetch = async () => { throw new Error('No services are permitted in this offline witness') }
  const exports = loadTs(PAGE, env, stubs, {
    append: '\nexport { DashboardForAccount, PresentationCard };', from,
    globals: {
      Date: FixedDate, fetch: async (...a) => { fetches.push(a[0]); return (fetchImpl ?? noFetch)(...a) },
      crypto: { randomUUID: randomUUID ?? (() => { throw new Error('crypto.randomUUID must not be called with the flag off') }) },
      setTimeout: fn => { Promise.resolve().then(fn); return 0 },
      sessionStorage: { removeItem() {} }, localStorage: { getItem: () => null, removeItem() {} },
    },
  })
  return {
    auth, reading, pushes, fetches, toasts, exports,
    render() { cursor = 0; pendingEffects.length = 0; return exports.DashboardForAccount(auth) },
    effects() { const changes = pendingEffects.splice(0); for (const effect of changes) { slots[effect.index]?.cleanup?.(); slots[effect.index] = { deps: effect.deps, cleanup: effect.fn() } } },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}
const sessionRow = (id, over = {}) => ({ id, title: `Deck ${id}`, currentStage: 6, finalPresentationUrl: `${LAYOUT}/p/${id}-pres`, strawmanPreviewUrl: null, createdAt: '2026-10-02T12:00:00Z', updatedAt: '2026-10-03T12:00:00Z', slideCount: 5, messages: [], ...over })
const SESSION_ROWS = [
  sessionRow('a'),
  sessionRow('b', { currentStage: 4, finalPresentationUrl: null, strawmanPreviewUrl: `${LAYOUT}/p/b-pres`, slideCount: 3 }),
  sessionRow('c', { finalPresentationUrl: 'https://other-env.example.invalid/p/c-pres' }),
  sessionRow('d', { currentStage: 5, finalPresentationUrl: `${LAYOUT}/p/d-pres`, messages: [{ userText: 'Make a deck on supplier risk' }] }),
]
const listPage = (sessions, hasMore = false) => ({ sessions, pagination: { offset: 0, limit: 100, hasMore, total: sessions.length } })
async function mountPage(h, sessions = SESSION_ROWS) {
  h.render(); h.effects()
  assert.equal(h.reading.length, 1)
  h.reading[0].resolve(listPage(sessions)); await tick(4)
  const tree = h.render(); h.effects(); return tree
}
const activeCards = tree => {
  const tabs = walk(tree, node => node.type === 'Tabs')[0]
  const content = walk(tabs, node => node.type === 'TabsContent' && node.props.value === tabs.props.value)[0]
  const found = []
  const collect = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) { node.forEach(collect); return } if (typeof node.type === 'function' && node.type.name === 'PresentationCard') found.push(node); collect(node.props?.children) }
  collect(content); return found
}
const pageText = tree => { const out = []; const visit = node => { if (node == null || typeof node === 'boolean') return; if (typeof node !== 'object') { out.push(String(node)); return } if (Array.isArray(node)) { node.forEach(visit); return } if (typeof node.type === 'function') { visit(node.type(node.props)); return } visit(node.props?.children) }; visit(tree); return out.join(' ').replace(/\s+/g, ' ') }
const byAttr = (tree, attr) => walk(tree, node => node.props && node.props[attr] !== undefined)

async function pageFlagOffHash(from) {
  const parts = []
  for (const shell of ['true', 'false']) {
    const h = pageHarness({ from, env: { NEXT_PUBLIC_STUDIO_V4_SHELL: shell } })
    let tree = await mountPage(h)
    parts.push(normaliseDates(serialise(tree)))
    walk(tree, node => node.type === 'Tabs')[0].props.onValueChange('strawman'); tree = h.render(); h.effects()
    parts.push(normaliseDates(serialise(tree)))
    assert.equal(h.fetches.length, 0)
  }
  return sha(parts.join('\n--\n'))
}

if (process.env.PRINT_GOLDEN) {
  const from = BASE_ROOT ?? root
  const Card = loadCard({}, from)
  const cards = {}
  for (const [name, presentation] of Object.entries(CARD_FIXTURES)) cards[name] = [false, true].map(del => sha(normaliseDates(serialise(renderCard(Card, presentation, del)))))
  console.log(JSON.stringify({ cards, page: await pageFlagOffHash(from) }, null, 2))
  process.exit(0)
}

// Captured from the BASE tree (bcd8aed, origin/studio-v4-dev-preparation-code) with PRINT_GOLDEN=1 --base-root <that checkout>: [card without delete, card with delete], and the whole page
// (studio shell on and off, completed tab and outline-preview tab).
const BASE_HASHES = {
  'completed deck': ['518da4e827b41896800f5e48a9ef24fae1287786b9be9c2f9a350c49f6513633', '4dcde3e15ef7300cbe07f441bd2c72e49ca1253633fa59c03ea02c4f9d0def76'],
  'outline preview only': ['cb4d5f909e0a1c5936632cdd954ea3a4ce52b90050228df48fd902abed2cadcc', '514be8a761f08d619f954192e7848530a8461d8333ad68b845f1b19cd75d2d20'],
  'no deck at all': ['4905948d1b356df12208e05ca1313b51708ffaa7cd5c28b11d72b82bd0ba4f10', '8821f8746004da34a18987ebaba6ddbf318f775a6285d871f360462af0d467f7'],
  'tags and a long title': ['3bac714f051283d938e715e3f62dbc9bb569d0af7f4be3d160238c6a27529d37', 'f7f044de3405eb39f61d7a0ca41a4d6437ba0cef4ab1283fc2bcd72ebf16cd90'],
}
const PAGE_BASE_HASH = '10ad02c02a5ff46f55c8270dd9b0e4b7d451085a1e5475c22a017e8eabf1855b'

run('flag off: every card renders byte-for-byte as the base did (hash-identical, with and without delete)', () => {
  for (const env of [{}, { [FLAG]: 'false' }, { [FLAG]: '' }, { [FLAG]: 'TRUE' }, { [FLAG]: '1' }, { [FLAG]: ' true' }]) {
    const Card = loadCard(env)
    for (const [name, presentation] of Object.entries(CARD_FIXTURES)) {
      assert.deepEqual([false, true].map(del => sha(normaliseDates(serialise(renderCard(Card, presentation, del))))), BASE_HASHES[name], `${name} ${JSON.stringify(env)}`)
    }
  }
})
runAsync('flag off: the whole dashboard page (studio shell on and off, both tabs) hashes the same as the base page, and nothing is fetched', async () => {
  assert.equal(await pageFlagOffHash(root), PAGE_BASE_HASH)
  if (BASE_ROOT) assert.equal(await pageFlagOffHash(root), await pageFlagOffHash(BASE_ROOT), 'live comparison against --base-root')
})
run('flag off: the Duplicate item is still disabled with its note; no duplicate control, status or error exists', () => {
  const Card = loadCard({})
  const withDelete = renderCard(Card, cardBase, true), withoutDelete = renderCard(Card, cardBase, false)
  const item = tree => walk(tree, node => node.type === 'DropdownMenuItem' && textOf(node) === 'Duplicate')[0]
  assert.equal(item(withDelete).props.disabled, true); assert.equal(item(withDelete).props['data-studio-deck-duplicate'], undefined)
  assert.equal(item(withDelete).props['aria-describedby'], 'deck-actions-deck-1')
  assert.equal(walk(withDelete, node => node.type === 'p' && node.props.id === 'deck-actions-deck-1').map(textOf)[0], 'Duplicate is not connected in this library.')
  assert.equal(walk(withoutDelete, node => node.type === 'p' && node.props.id === 'deck-actions-deck-1').map(textOf)[0], 'Duplicate and delete are not connected in this library.')
  for (const html of [serialise(withDelete), serialise(withoutDelete)]) assert.doesNotMatch(html, /data-studio-deck-duplicat|Copying|Loader2|opacity-70/)
})
runAsync('flag off: the page hands no card a duplicate control, never calls fetch, toast or crypto, and shows no duplicate status or error', async () => {
  const toasts = []
  const h = pageHarness({ env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }, toasts })
  const tree = await mountPage(h)
  assert.equal(activeCards(tree).length, 3)
  for (const card of activeCards(tree)) assert.equal(card.props.duplicate, undefined)
  assert.equal(byAttr(tree, 'data-studio-deck-duplicate-status').length + byAttr(tree, 'data-studio-deck-duplicate-error').length, 0)
  assert.deepEqual([h.fetches.length, toasts.length], [0, 0])
})

// ====== 7. flag on, the dashboard end to end ==============================================================================================================================
const ON = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', [FLAG]: 'true' }
const idSource = () => { let n = 0; return () => { n += 1; return n === 1 ? OP_ID : n === 2 ? NEW_SESSION : `00000000-0000-4000-8000-0000000000c${n}` } }


run('flag on, a card: an enabled Duplicate item (no "not connected" note) that calls the page\'s handler; a copyable deck needs no reason', () => {
  const Card = loadCard(ON)
  let selected = 0
  const html = renderCard(Card, cardBase, true, { duplicate: { reason: null, state: 'idle', onSelect() { selected += 1 } } })
  const item = walk(html, node => node.type === 'DropdownMenuItem' && node.props['data-studio-deck-duplicate'] === 'true')[0]
  assert.ok(item); assert.equal(item.props.disabled, false); assert.equal(textOf(item), 'Duplicate'); assert.equal(item.props['aria-describedby'], undefined)
  item.props.onSelect(); assert.equal(selected, 1)
  assert.doesNotMatch(serialise(html), /not connected/)
  assert.equal(walk(html, node => node.type === 'p' && node.props.id).length, 0)
  const del = walk(html, node => node.type === 'DropdownMenuItem' && node.props['data-studio-deck-delete'] === 'true')[0]
  assert.equal(textOf(del), 'Delete session…')
})
run('flag on, a card with no delete (classic library): the note is only the delete line, still wired to the Delete item', () => {
  const Card = loadCard(ON)
  const html = renderCard(Card, cardBase, false, { duplicate: { reason: null, state: 'idle', onSelect() {} } })
  const note = walk(html, node => node.type === 'p' && node.props.id === 'deck-actions-deck-1')[0]
  assert.equal(textOf(note), 'Delete is not connected in this library.')
  const del = walk(html, node => node.type === 'DropdownMenuItem' && textOf(node) === 'Delete')[0]
  assert.equal(del.props.disabled, true); assert.equal(del.props['aria-describedby'], 'deck-actions-deck-1')
})
run('flag on, a deck that cannot be copied: Duplicate is disabled and its short reason is the note it points to', () => {
  const Card = loadCard(ON)
  for (const [reason, withDelete, want] of [
    [DUPLICATE_BLOCKED.noDeck, true, DUPLICATE_BLOCKED.noDeck],
    [DUPLICATE_BLOCKED.otherEnvironment, false, `${DUPLICATE_BLOCKED.otherEnvironment} Delete is not connected in this library.`],
  ]) {
    const html = renderCard(Card, cardBase, withDelete, { duplicate: { reason, state: 'idle', onSelect() { throw new Error('must not run') } } })
    const item = walk(html, node => node.type === 'DropdownMenuItem' && textOf(node) === 'Duplicate')[0]
    assert.equal(item.props.disabled, true); assert.equal(item.props['data-studio-deck-duplicate'], undefined); assert.equal(item.props['aria-describedby'], 'deck-actions-deck-1')
    assert.equal(textOf(walk(html, node => node.type === 'p' && node.props.id === 'deck-actions-deck-1')[0]), want)
  }
})
run('flag on, copying and locked states: this card says "Copying…", spins, dims and is marked; the others only disable Duplicate', () => {
  const Card = loadCard(ON)
  const busy = renderCard(Card, cardBase, true, { duplicate: { reason: null, state: 'busy', onSelect() {} } })
  const item = walk(busy, node => node.type === 'DropdownMenuItem' && node.props['data-studio-deck-duplicate'] === 'true')[0]
  assert.equal(textOf(item), 'Copying…'); assert.equal(item.props.disabled, true)
  const card = walk(busy, node => node.type === 'Card')[0]
  assert.equal(card.props['data-studio-deck-duplicating'], 'true'); assert.match(card.props.className, /opacity-70/)
  const trigger = walk(busy, node => node.type === 'Button' && /^Manage /.test(node.props['aria-label'] || ''))[0]
  assert.equal(walk(trigger, node => node.type === 'Loader2').length, 1); assert.equal(walk(trigger, node => node.type === 'MoreVertical').length, 0)
  const locked = renderCard(Card, cardBase, true, { duplicate: { reason: null, state: 'locked', onSelect() {} } })
  const lockedItem = walk(locked, node => node.type === 'DropdownMenuItem' && node.props['data-studio-deck-duplicate'] === 'true')[0]
  assert.equal(textOf(lockedItem), 'Duplicate'); assert.equal(lockedItem.props.disabled, true)
  assert.equal(walk(locked, node => node.type === 'Card')[0].props['data-studio-deck-duplicating'], undefined)
  assert.equal(walk(locked, node => node.type === 'Loader2').length, 0)
})

runAsync('flag on, success: busy and locked while it runs, then the new card first, the toast, the paging count; the wire is the pinned one', async () => {
  const gate = deferred(), toasts = []
  const { deps, calls } = makeDeps({ layout: async () => { await gate.promise; return respond({ body: layoutOk({ slide_count: 6 }) }) } })
  const h = pageHarness({ env: ON, fetchImpl: deps.fetch, toasts, randomUUID: idSource() })
  let tree = await mountPage(h)
  assert.match(pageText(tree), /4 active sessions loaded/)
  let cards = activeCards(tree)
  assert.deepEqual(cards.map(card => card.props.presentation.id), ['a', 'c', 'd'])
  assert.deepEqual(cards.map(card => [card.props.duplicate.reason, card.props.duplicate.state]), [[null, 'idle'], [DUPLICATE_BLOCKED.otherEnvironment, 'idle'], [null, 'idle']])
  cards[0].props.duplicate.onSelect(); cards[0].props.duplicate.onSelect()
  await tick(4)
  tree = h.render(); h.effects(); cards = activeCards(tree)
  assert.deepEqual(cards.map(card => card.props.duplicate.state), ['busy', 'locked', 'locked'])
  const status = byAttr(tree, 'data-studio-deck-duplicate-status')[0]
  assert.equal(status.props.role, 'status'); assert.equal(textOf(status), 'Copying “Deck a”… This can take a moment.')
  assert.equal(calls.length, 1, 'a second click while it runs does nothing')
  gate.resolve(); await tick(20)
  tree = h.render(); h.effects(); cards = activeCards(tree)
  assert.deepEqual(cards.map(card => card.props.presentation.id), [NEW_SESSION, 'a', 'c', 'd'])
  const copy = cards[0].props.presentation
  assert.deepEqual(plain({ ...copy, createdAt: 0, updatedAt: 0 }), {
    id: NEW_SESSION, title: 'Deck a (copy)', description: 'Deck a (copy)', createdAt: 0, updatedAt: 0, slideCount: 6, status: 'completed', thumbnail: '/placeholder.svg', folder: 'general', tags: [],
    strawmanPreviewUrl: null, finalPresentationUrl: `${LAYOUT}/p/${COPY_PRES}`, currentStage: 6,
  })
  assert.equal(copy.createdAt, '2026-10-22T12:00:00.100Z'); assert.equal(copy.updatedAt, '2026-10-22T12:00:00.200Z')
  assert.deepEqual(cards.map(card => card.props.duplicate.state), ['idle', 'idle', 'idle', 'idle'])
  assert.equal(byAttr(tree, 'data-studio-deck-duplicate-status').length + byAttr(tree, 'data-studio-deck-duplicate-error').length, 0)
  assert.deepEqual(toasts, [{ title: 'Deck copied', description: '“Deck a (copy)” is in your decks. Chat history stays with the original.' }])
  assert.match(pageText(tree), /5 active sessions loaded/)
  assert.deepEqual(calls.map(call => `${call.method} ${call.url}`), [`POST ${LAYOUT}/api/presentations/a-pres/duplicate`, 'POST /api/sessions', `PATCH /api/sessions/${NEW_SESSION}`])
  assert.deepEqual(calls[0].body, { operation_id: OP_ID, title: 'Deck a (copy)' })
  assert.deepEqual(calls[2].body.stateCache, { activeVersion: 'final', currentStatus: { copiedFrom: { sessionId: 'a', title: 'Deck a' } } })
  assert.equal(calls[2].body.slideCount, 6)
  assert.deepEqual(h.pushes, [])
})
runAsync('flag on, an outline preview (strawman) is copied into the strawman slot and the new card is an outline preview too', async () => {
  const toasts = []
  const { deps, calls } = makeDeps()
  const h = pageHarness({ env: ON, fetchImpl: deps.fetch, toasts, randomUUID: idSource() })
  let tree = await mountPage(h)
  walk(tree, node => node.type === 'Tabs')[0].props.onValueChange('strawman'); tree = h.render(); h.effects()
  const cards = activeCards(tree)
  assert.deepEqual(cards.map(card => card.props.presentation.id), ['b'])
  cards[0].props.duplicate.onSelect(); await tick(20)
  tree = h.render(); h.effects()
  const copy = activeCards(tree)[0].props.presentation
  assert.deepEqual([copy.id, copy.strawmanPreviewUrl, copy.finalPresentationUrl, copy.currentStage, copy.status], [NEW_SESSION, `${LAYOUT}/p/${COPY_PRES}`, null, 4, 'in-progress'])
  assert.equal(calls[2].body.strawmanPresentationId, COPY_PRES); assert.equal(calls[2].body.finalPresentationId, undefined)
})
runAsync('flag on, Layout says 404 (its flag is off): a clear alert, no new card, no session created, no toast; Dismiss clears it', async () => {
  const toasts = []
  const { deps, calls } = makeDeps({ layout: () => respond({ status: 404, body: { detail: 'Not Found' } }) })
  const h = pageHarness({ env: ON, fetchImpl: deps.fetch, toasts, randomUUID: idSource() })
  let tree = await mountPage(h)
  activeCards(tree)[0].props.duplicate.onSelect(); await tick(20)
  tree = h.render(); h.effects()
  const alert = byAttr(tree, 'data-studio-deck-duplicate-error')[0]
  assert.equal(alert.props.role, 'alert'); assert.equal(textOf(walk(alert, node => node.type === 'p')[0]), LAYOUT_FAILURE_MESSAGE.unavailable)
  assert.deepEqual(activeCards(tree).map(card => card.props.presentation.id), ['a', 'c', 'd'])
  assert.deepEqual(activeCards(tree).map(card => card.props.duplicate.state), ['idle', 'idle', 'idle'])
  assert.equal(byAttr(tree, 'data-studio-deck-duplicate-status').length, 0)
  noSessionCalls(calls); assert.deepEqual(toasts, [])
  walk(alert, node => node.type === 'Button')[0].props.onClick(); tree = h.render(); h.effects()
  assert.equal(byAttr(tree, 'data-studio-deck-duplicate-error').length, 0)
})
runAsync('flag on, the session PATCH fails: the new session is soft-deleted, the alert says the copy could not be finished and a stray copy may remain, the list is unchanged', async () => {
  const toasts = []
  const { deps, calls } = makeDeps({ patch: () => respond({ status: 500, body: {} }) })
  const h = pageHarness({ env: ON, fetchImpl: deps.fetch, toasts, randomUUID: idSource() })
  let tree = await mountPage(h)
  activeCards(tree)[0].props.duplicate.onSelect(); await tick(30)
  tree = h.render(); h.effects()
  assert.equal(textOf(walk(byAttr(tree, 'data-studio-deck-duplicate-error')[0], node => node.type === 'p')[0]), UNFINISHED)
  assert.deepEqual(calls.map(call => `${call.method} ${call.url}`), [
    `POST ${LAYOUT}/api/presentations/a-pres/duplicate`, 'POST /api/sessions', `PATCH /api/sessions/${NEW_SESSION}`, `DELETE /api/sessions/${NEW_SESSION}`,
  ])
  assert.deepEqual(activeCards(tree).map(card => card.props.presentation.id), ['a', 'c', 'd'])
  assert.match(pageText(tree), /4 active sessions loaded/); assert.deepEqual(toasts, [])
})
runAsync('flag on, a deck that cannot be copied does nothing when its handler is called; a failed crypto.randomUUID creates nothing; a new run clears the old alert', async () => {
  const { deps, calls } = makeDeps({ layout: () => respond({ status: 500, body: {} }) })
  const h = pageHarness({ env: ON, fetchImpl: deps.fetch, randomUUID: idSource() })
  let tree = await mountPage(h)
  activeCards(tree)[1].props.duplicate.onSelect(); await tick(10)
  assert.equal(calls.length, 0)
  activeCards(tree)[0].props.duplicate.onSelect(); await tick(20)
  tree = h.render(); h.effects()
  assert.equal(byAttr(tree, 'data-studio-deck-duplicate-error').length, 1)
  activeCards(tree)[2].props.duplicate.onSelect()
  tree = h.render(); h.effects()
  assert.equal(byAttr(tree, 'data-studio-deck-duplicate-error').length, 0, 'the old alert is cleared as soon as a new copy starts')
  await tick(20)
  const h2 = pageHarness({ env: ON, fetchImpl: makeDeps().deps.fetch, randomUUID: () => { throw new TypeError('crypto.randomUUID is not a function') } })
  let tree2 = await mountPage(h2)
  activeCards(tree2)[0].props.duplicate.onSelect(); await tick(20)
  tree2 = h2.render(); h2.effects()
  assert.equal(h2.fetches.length, 0)
  assert.match(textOf(byAttr(tree2, 'data-studio-deck-duplicate-error')[0]), /Nothing was created\./)
})

// ====== finish ===========================================================================================================================================================
await Promise.all(pending)
if (failures.length) { for (const err of failures) console.error(err); process.exit(1) }

if (args.includes('--mutation-check') && MUTATION === null) {
  const survived = []
  for (const mutation of MUTATIONS) assert.ok(fs.readFileSync(path.join(root, mutation.file), 'utf8').includes(mutation.from), `mutation "${mutation.name}" does not apply to ${mutation.file}`)
  for (let index = 0; index < MUTATIONS.length; index++) {
    const child = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url)], { env: { ...process.env, DUP_TEST_MUTATION: String(index) }, encoding: 'utf8' })
    const caught = child.status !== 0
    console.log(`${caught ? 'caught  ' : 'SURVIVED'} mutation ${index + 1}/${MUTATIONS.length}: ${MUTATIONS[index].name}`)
    if (!caught) survived.push(MUTATIONS[index].name)
  }
  assert.deepEqual(survived, [], 'every mutation must be caught')
}
if (MUTATION === null) console.log(`studio duplicate-deck: ${testCount} tests passed`)
