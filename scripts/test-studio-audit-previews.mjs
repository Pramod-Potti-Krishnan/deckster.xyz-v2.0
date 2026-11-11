// FRONTEND-1 (production frontend audit, P-01 deck-card previews, P-07 Duplicate, P-29 slide rail and Publish preview): proof of NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME and NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK (exact "true", default off, build-time).
//
// THE DEFECTS: P-01/P-07 the Decks page rejects a saved viewer URL by origin and never asks this Layout whether the deck is here (the Builder does); P-29 the inventory route answers 405 on production (LAYOUT_SLIDE_THUMBNAILS_ENABLED off), so the
// rail keeps the path with no slide list and the Publish preview says "Deck preview unavailable".
//
//   1. The re-home lib (P-01/P-07), function by function: the flag, the id, the target rule, the read (status mapping, abort at the status, the time limit), the store (one read per id, in-flight sharing, the concurrency limit, subscribe/version),
//      the decision Duplicate and the card read.
//   2. The fallback lib (P-29): the flag, the 404/405 rule, the titles, the inventory from a presentation body (every refusal), the read, the Publish frame's gate.
//   3. The REAL inventory controller (lib/slide-rail-identity.ts, evaluated bare): 404/405 asks the fallback once and a derived inventory stands in for it; anything else does not; no fallback = the base's behaviour; the rail rows it gives.
//   4. The marked lines of the four existing files and of the new hooks and component.
//
//   3. The sources: every marked line, the strip gives each touched file its base back byte for byte, the registry, .env.example, the voice-call proof's four-line pin edit (the same four lines FRONTEND-2's #603 carries), the scope (read from the
//      COMMITTED diff BASE..HEAD only, never the working tree), the commits.
//   4. Mutants: each must be caught.
//
//   node scripts/test-studio-audit-previews.mjs
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

setTimeout(() => { process.stderr.write('[watchdog] test-studio-audit-previews stalled for 240 s; exit 124\n'); process.exit(124) }, Number(process.env.STUDIO_PROOF_TRACE_WATCHDOG_MS) || 240_000).unref()

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const STRIP = 'scripts/studio-audit-previews-strip.mjs'
const SELF = 'scripts/test-studio-audit-previews.mjs'
const VOICE_CALL = 'scripts/test-studio-voice-call.mjs'
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
const stripModule = await import('./studio-audit-previews-strip.mjs')
const { BASE_COMMIT, AUDIT_PREVIEWS_FILES: TOUCHED, AUDIT_PREVIEWS_NEW_FILES: NEW_FILES, AUDIT_PREVIEWS_SCOPE_FILES: SCOPE_FILES, AUDIT_PREVIEWS_ENV_BLOCK: ENV_BLOCK, AUDIT_PREVIEWS_SUBJECT: SUBJECT, AUDIT_PREVIEWS_MARKER_RE: MARKER_RE, AUDIT_PREVIEWS_EDITS: EDITS } = stripModule
const STRIP_FN = stripModule.stripAuditPreviews
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
// 1. The re-home lib
// ============================================================================================================================================
const REHOME = 'lib/studio-deck-card-rehome.ts', FALLBACK = 'lib/studio-inventory-fallback.ts', RAIL = 'lib/slide-rail-identity.ts'
const DASH = 'app/(app)/dashboard/page.tsx', PUBLISH = 'components/studio-publish-preview.tsx', RAIL_HOOK = 'hooks/use-slide-rail-identity.ts'
const CARD_HOOK = 'hooks/use-studio-deck-card-rehome.ts', FRAME_HOOK = 'hooks/use-studio-publish-preview-frame.ts', FRAME = 'components/studio-publish-preview-frame.tsx'
const unhandled = []; process.on('unhandledRejection', error => { unhandled.push(error) }) // a mutant that lets a rejection through must fail a check, not end the proof
const REHOME_FLAG = 'NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME', FALLBACK_FLAG = 'NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK'
const FLAG_VALUES = [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['', false], ['yes', false], ['true', true]]
const ORIGIN = 'https://layout.here.test'
const blocked = (reason = 'unapproved_origin') => ({ status: 'blocked', reason, origin: 'https://layout.other.test' })
/** A Response-like answer. */
const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new SyntaxError('not json'); return body } })
/** A promise that must settle in time: a mutant that never answers fails the check instead of ending the proof (an unsettled top-level await). */
const within = async (promise, ms = 2000) => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`did not settle within ${ms} ms`)), ms) })]) } finally { clearTimeout(timer) } }
/** A promise someone else resolves. */
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); promise.catch(() => {}); return { promise, resolve, reject } }

async function rehomeChecks(libText = read(REHOME)) {
  const lib = loadLib(REHOME, libText, {})
  // -- the flag --------------------------------------------------------------------------------------------------------------------------
  for (const [value, want] of FLAG_VALUES) assert.equal(lib.deckCardRehomeOn(value), want, `flag ${JSON.stringify(value)}`)
  assert.equal(loadLib(REHOME, libText, {}).STUDIO_DECK_CARD_REHOME_ENABLED, false, 'unset: off')
  assert.equal(loadLib(REHOME, libText, { [REHOME_FLAG]: 'true' }).STUDIO_DECK_CARD_REHOME_ENABLED, true, '"true": on')
  assert.equal(loadLib(REHOME, libText, { [REHOME_FLAG]: 'on' }).STUDIO_DECK_CARD_REHOME_ENABLED, false, '"on": off')
  // -- the id of a saved viewer URL ----------------------------------------------------------------------------------------------------------
  const id = lib.rehomePresentationId
  assert.equal(id('https://layout.other.test/p/abc-123'), 'abc-123'); assert.equal(id('https://layout.other.test/p/abc-123?viewOnly=true#/3'), 'abc-123', 'query and hash do not matter')
  assert.equal(id('https://layout.other.test/prefix/p/abc'), 'abc', 'the segment after the last "p"'); assert.equal(id('https://x.test/p/a%20b'), 'a b', 'decoded')
  for (const bad of [null, undefined, '', 'not a url', 'https://x.test/', 'https://x.test/p', 'https://x.test/p/', 'https://x.test/q/abc', 5, {}]) assert.equal(id(bad), null, `no id: ${JSON.stringify(bad)}`)
  assert.equal(id(`https://x.test/p/${'a'.repeat(201)}`), null, 'an id over 200 characters'); assert.equal(id('https://x.test/p/%20abc'), null, 'an id with an outer space'); assert.equal(id('https://x.test/p/a%00b'), null, 'a control character in the id')
  assert.equal(lib.rehomedViewerUrl(ORIGIN, 'abc'), `${ORIGIN}/p/abc`); assert.equal(lib.rehomedViewerUrl(ORIGIN, 'a b/c'), `${ORIGIN}/p/a%20b%2Fc`, 'encoded')
  assert.equal(lib.rehomeReadUrl('https://l.test/', 'a b'), 'https://l.test/api/presentations/a%20b', 'no double slash, encoded'); assert.equal(lib.rehomeReadUrl('https://l.test', 'x'), 'https://l.test/api/presentations/x')
  // -- the target rule ---------------------------------------------------------------------------------------------------------------------
  const saved = 'https://layout.other.test/p/deck-1'
  assert.deepEqual(plain(lib.rehomeTarget(true, saved, blocked(), ORIGIN)), { presentationId: 'deck-1' }, 'flag on, blocked by origin, with an id: a target')
  assert.equal(lib.rehomeTarget(false, saved, blocked(), ORIGIN), null, 'flag off: nothing')
  for (const odd of ['true', 1, null, undefined]) assert.equal(lib.rehomeTarget(odd, saved, blocked(), ORIGIN), null, `flag ${JSON.stringify(odd)} is not the boolean true`)
  for (const reason of ['invalid_url', 'unsupported_protocol', 'credentials_not_allowed', undefined]) assert.equal(lib.rehomeTarget(true, saved, { status: 'blocked', reason }, ORIGIN), null, `blocked for ${reason}: never re-homed`)
  for (const decision of [{ status: 'allowed', url: saved }, { status: 'empty' }, null, undefined]) assert.equal(lib.rehomeTarget(true, saved, decision, ORIGIN), null, `not blocked: ${JSON.stringify(decision)}`)
  for (const origin of [null, undefined, '']) assert.equal(lib.rehomeTarget(true, saved, blocked(), origin), null, `no configured Layout origin: ${JSON.stringify(origin)}`)
  assert.equal(lib.rehomeTarget(true, 'https://layout.other.test/', blocked(), ORIGIN), null, 'a saved URL with no id')
  // -- the read: status mapping, abort at the status, the time limit ---------------------------------------------------------------------------
  const read = async (fetchImpl, over = {}) => lib.readPresentationHere({ getBaseUrl: () => ORIGIN, presentationId: 'deck-1', fetchImpl, ...over })
  const seen = []; const fetchOf = (status, signalLog = seen) => async (url, init) => { signalLog.push({ url, init, signal: init?.signal }); return { ok: status >= 200 && status < 300, status } }
  assert.equal(await read(fetchOf(200)), 'here'); assert.equal(await read(fetchOf(204)), 'here'); assert.equal(await read(fetchOf(404)), 'absent')
  for (const status of [401, 403, 500, 502, 503, 429]) assert.equal(await read(fetchOf(status)), 'unknown', `${status} cannot say`)
  assert.equal(seen[0].url, `${ORIGIN}/api/presentations/deck-1`, 'the read is the presentation GET of this Layout'); assert.equal(seen[0].init.cache, 'no-store', 'never cached')
  assert.equal(await read(async () => { throw new TypeError('network') }), 'unknown', 'a network failure cannot say')
  assert.equal(await read(fetchOf(200), { getBaseUrl: () => { throw new Error('no layout url') } }), 'unknown', 'no Layout URL cannot say')
  { const log = []; await read(fetchOf(200, log)); assert.equal(log[0].signal.aborted, true, 'the request is aborted as soon as the status is known (the body is never downloaded)') }
  { const log = []; await read(fetchOf(404, log)); assert.equal(log[0].signal.aborted, true, 'a 404 is aborted too') }
  const started = Date.now()
  assert.equal(await within(read(() => new Promise(() => {}), { timeoutMs: 20 })), 'unknown', 'a read that never answers ends at the time limit'); assert.ok(Date.now() - started < 1000)
  { let aborted = false; const result = await within(read((url, init) => new Promise(() => { init.signal.addEventListener('abort', () => { aborted = true }) }), { timeoutMs: 20 })); assert.equal(result, 'unknown'); assert.equal(aborted, true, 'the limit aborts the request') }
  assert.equal(lib.DECK_CARD_REHOME_TIMEOUT_MS, 8000); assert.equal(lib.DECK_CARD_REHOME_MAX_CONCURRENT_READS, 3)
  // -- the store: one answer per id, shared, kept, at most 3 at once, in order ------------------------------------------------------------------
  {
    const store = lib.createRehomeStore(), calls = []
    const readOf = (name, answerValue) => () => { calls.push(name); return Promise.resolve(answerValue) }
    assert.equal(store.peek('a'), null, 'nothing settled yet')
    const [one, two] = await within(Promise.all([store.request('a', readOf('a1', 'here')), store.request('a', readOf('a2', 'absent'))]))
    assert.deepEqual([one, two], ['here', 'here'], 'the second asker gets the first read\'s answer'); assert.deepEqual(calls, ['a1'], 'one read per id')
    assert.equal(store.peek('a'), 'here'); assert.equal(await store.request('a', readOf('a3', 'absent')), 'here', 'a settled id is never read again'); assert.deepEqual(calls, ['a1'])
    assert.equal(await store.request('b', () => { throw new Error('sync') }), 'unknown', 'a read that throws is "unknown"'); assert.equal(store.peek('b'), 'unknown')
    assert.equal(await store.request('c', () => Promise.reject(new Error('rejected'))), 'unknown', 'a read that rejects is "unknown"')
    assert.equal(await store.request('d', () => Promise.resolve('absent')), 'absent')
    // subscribe and version
    const before = store.version(), heard = []; const stop = store.subscribe(() => heard.push(store.version()))
    await store.request('e', () => Promise.resolve('here')); assert.equal(store.version(), before + 1, 'the version moves when an answer settles'); assert.deepEqual(heard, [before + 1], 'subscribers are told')
    stop(); await store.request('f', () => Promise.resolve('here')); assert.deepEqual(heard, [before + 1], 'an unsubscribed listener hears nothing more')
    store.clear(); assert.equal(store.peek('a'), null, 'clear forgets')
  }
  {
    // the concurrency limit: six reads asked at once, three run
    const store = lib.createRehomeStore(), gates = Array.from({ length: 6 }, () => deferred()); let running = 0, peak = 0; const order = []
    const results = gates.map((gate, index) => store.request(`id-${index}`, () => { running += 1; peak = Math.max(peak, running); order.push(index); return gate.promise.then(value => { running -= 1; return value }) }))
    await tick(); assert.equal(running, 3, 'three reads run at once'); assert.deepEqual(order, [0, 1, 2], 'in the order asked')
    gates[1].resolve('here'); await tick(); await tick(); assert.deepEqual(order, [0, 1, 2, 3], 'a finished read starts the next waiting one'); assert.equal(running, 3)
    gates.forEach((gate, index) => gate.resolve(index % 2 ? 'here' : 'absent')); assert.deepEqual(await within(Promise.all(results)), ['absent', 'here', 'absent', 'here', 'absent', 'here']); assert.equal(peak, 3, 'never more than three at once')
    const one = lib.createRehomeStore(1), g = [deferred(), deferred()]; let r = 0, p = 0
    const both = g.map((gate, index) => one.request(`k${index}`, () => { r += 1; p = Math.max(p, r); return gate.promise.then(v => { r -= 1; return v }) })); await tick(); assert.equal(r, 1, 'a limit of 1 is honoured'); g.forEach(gate => gate.resolve('here')); await within(Promise.all(both)); assert.equal(p, 1)
  }
  // -- the decision Duplicate and the card read ----------------------------------------------------------------------------------------------
  {
    const evaluate = url => { if (!url) return { status: 'empty', url: null }; const u = new URL(url); if (u.protocol !== 'https:' && u.protocol !== 'http:') return { status: 'blocked', reason: 'unsupported_protocol', origin: null }; return u.origin === ORIGIN ? { status: 'allowed', url, origin: u.origin } : { status: 'blocked', reason: 'unapproved_origin', origin: u.origin } }
    const peekOf = map => key => map[key] ?? null
    const foreign = 'https://layout.other.test/p/deck-1', own = `${ORIGIN}/p/deck-1`
    const decide = (enabled, url, map) => plain(lib.rehomeAwareDecision(enabled, url, evaluate, ORIGIN, peekOf(map)))
    assert.deepEqual(decide(true, foreign, { 'deck-1': 'here' }), { status: 'allowed', url: own, origin: ORIGIN }, 'here: this Layout\'s own URL, allowed')
    for (const answered of ['absent', 'unknown', null]) assert.equal(decide(true, foreign, answered === null ? {} : { 'deck-1': answered }).status, 'blocked', `${answered}: the saved decision stays (blocked)`)
    assert.equal(decide(false, foreign, { 'deck-1': 'here' }).status, 'blocked', 'flag off: the saved decision, whatever the store says')
    assert.deepEqual(decide(true, own, { 'deck-1': 'absent' }), { status: 'allowed', url: own, origin: ORIGIN }, 'an allowed URL is untouched')
    assert.equal(decide(true, null, {}).status, 'empty', 'no URL: empty')
    assert.equal(decide(true, 'ftp://layout.other.test/p/deck-1', { 'deck-1': 'here' }).status, 'blocked', 'another protocol is never re-homed')
    // a policy that does not approve this Layout's own URL keeps the saved decision (never an unapproved URL)
    const tagged = url => ({ status: 'blocked', reason: 'unapproved_origin', tag: url === foreign ? 'saved' : 'here' })
    assert.equal(plain(lib.rehomeAwareDecision(true, foreign, tagged, ORIGIN, () => 'here')).tag, 'saved', 'the re-homed URL must itself be approved, else the saved decision is returned')
  }
}

// ============================================================================================================================================
// 2. The fallback lib
// ============================================================================================================================================
const PRES = 'deck-9'
const slideOf = (n, over = {}) => ({ slide_id: `slide_${n}`, layout: 'C1-text', content: { slide_title: `Title ${n}` }, ...over })
const deckOf = (n = 3) => ({ id: PRES, slides: Array.from({ length: n }, (_, i) => slideOf(i + 1)) })
async function fallbackChecks(libText = read(FALLBACK)) {
  const lib = loadLib(FALLBACK, libText, {})
  for (const [value, want] of FLAG_VALUES) assert.equal(lib.inventoryFallbackOn(value), want, `flag ${JSON.stringify(value)}`)
  assert.equal(loadLib(FALLBACK, libText, {}).STUDIO_INVENTORY_FALLBACK_ENABLED, false); assert.equal(loadLib(FALLBACK, libText, { [FALLBACK_FLAG]: 'true' }).STUDIO_INVENTORY_FALLBACK_ENABLED, true); assert.equal(loadLib(FALLBACK, libText, { [FALLBACK_FLAG]: 'on' }).STUDIO_INVENTORY_FALLBACK_ENABLED, false)
  for (const reason of ['http_404', 'http_405']) assert.equal(lib.inventoryRouteAbsent(reason), true, reason)
  for (const reason of ['http_500', 'http_401', 'invalid_json', 'invalid_inventory', 'network', '', null, undefined, 'http_4050']) assert.equal(lib.inventoryRouteAbsent(reason), false, `not "route absent": ${reason}`)
  // -- titles (Layout's own order: the structural title text box, then content.slide_title, then content.title) -------------------------------------
  const title = lib.fallbackSlideTitle
  assert.equal(title({ content: { slide_title: 'From content' } }), 'From content'); assert.equal(title({ content: { title: 'Plain title' } }), 'Plain title', 'content.title when there is no slide_title')
  assert.equal(title({ content: { slide_title: 'Old' }, text_boxes: [{ slot_name: 'title', slot_kind: 'structural', content: 'Edited on canvas' }] }), 'Edited on canvas', 'the structural title mirror wins (a canvas edit lands there)')
  assert.equal(title({ content: { slide_title: 'Old' }, text_boxes: [{ slot_name: 'title', slot_kind: 'system', content: 'System title' }] }), 'System title', 'a system title mirror counts too')
  assert.equal(title({ content: { slide_title: 'Kept' }, text_boxes: [{ slot_name: 'title', slot_kind: 'free', content: 'Not structural' }, { slot_name: 'body', slot_kind: 'structural', content: 'Not a title' }] }), 'Kept', 'only the structural or system title box counts')
  assert.equal(title({ content: { slide_title: '<h1>Bold &amp; <b>clear</b></h1>' } }), 'Bold & clear', 'HTML stripped, entities decoded'); assert.equal(title({ content: { slide_title: '  Spaced \n  out  ' } }), 'Spaced out', 'whitespace collapsed')
  for (const stock of ['Slide Title', 'presentation title', 'SECTION TITLE', 'Diagram Title', 'Chart Title', 'Infographic Title', 'Comparison']) assert.equal(title({ content: { slide_title: stock } }), null, `a placeholder (${stock}) is no title`)
  assert.equal(title({ content: { slide_title: 'Slide Title', title: 'Real one' } }), 'Real one', 'a placeholder is skipped for the next candidate')
  assert.equal(title({ content: { slide_title: 'Slide 3' } }), null, '"Slide N" is no title (the rail writes it itself)'); assert.equal(title({ content: { slide_title: 'x'.repeat(201) } }), null, 'over 200 characters is no title')
  assert.equal(title({ content: { slide_title: 'x'.repeat(200) } }).length, 200, '200 characters is fine')
  for (const slide of [{}, { content: null }, { content: {} }, { content: { slide_title: '' } }, { content: { slide_title: 5 } }, { text_boxes: 'no', content: { slide_title: '   ' } }]) assert.equal(title(slide), null, `no title: ${JSON.stringify(slide)}`)
  // -- the inventory from a presentation body ----------------------------------------------------------------------------------------------------
  const inv = body => lib.inventoryFromPresentation(body, PRES)
  const good = plain(inv(deckOf(3)))
  assert.deepEqual(good, { presentationId: PRES, slideCount: 3, slides: [1, 2, 3].map(n => ({ slideId: `slide_${n}`, slideIndex: n - 1, layout: 'C1-text', contentVersion: null, thumbnailUrl: null, thumbnailStale: false, thumbnailStatus: 'none', title: `Title ${n}` })) }, 'ids, order, layouts and titles; no image, none coming')
  assert.equal(inv({ slides: deckOf(2).slides })?.slideCount, 2, 'a body that names no id is this presentation\'s'); assert.equal(inv({ presentation_id: PRES, slides: deckOf(2).slides })?.slideCount, 2, 'presentation_id may name it')
  assert.equal(inv({ ...deckOf(2), id: 'other' }), null, 'another presentation\'s body (id)'); assert.equal(inv({ ...deckOf(2), presentation_id: 'other' }), null, 'another presentation\'s body (presentation_id)')
  assert.equal(inv({ id: PRES, slides: [slideOf(1, { layout: 5 })] })?.slides[0].layout, null, 'a layout that is not a string is null')
  for (const bad of [null, undefined, 5, 'x', [], {}, { slides: [] }, { slides: 'no' }, { slides: {} }]) assert.equal(inv(bad), null, `no inventory: ${JSON.stringify(bad)}`)
  assert.equal(inv({ slides: [slideOf(1), null] }), null, 'a slide that is not an object'); assert.equal(inv({ slides: [slideOf(1), 'x'] }), null); assert.equal(inv({ slides: [slideOf(1), []] }), null)
  for (const slide_id of [undefined, null, '', ' x', 'x ', 5, 'a'.repeat(101)]) assert.equal(inv({ slides: [slideOf(1), { ...slideOf(2), slide_id }] }), null, `a slide id that cannot key the rail: ${JSON.stringify(slide_id)}`)
  assert.equal(inv({ slides: [slideOf(1), slideOf(1)] }), null, 'two slides with one id'); assert.equal(inv({ slides: [{ ...slideOf(1), slide_id: 'a'.repeat(100) }] })?.slideCount, 1, '100 characters is fine')
  assert.equal(inv({ slides: [slideOf(1, { content: {} })] }).slides[0].title, null, 'a slide with no title has null (the rail then writes "Slide N")')
  // -- the read ----------------------------------------------------------------------------------------------------------------------------------
  const readWith = (fetchImpl, over = {}) => lib.readInventoryFallback({ baseUrl: ORIGIN, presentationId: PRES, fetchImpl, ...over })
  const calls = []; const ok = await readWith(async (url, init) => { calls.push({ url, init }); return answer(200, deckOf(2)) })
  assert.equal(ok.kind, 'ok'); assert.equal(ok.inventory.slideCount, 2); assert.equal(calls[0].url, `${ORIGIN}/api/presentations/${PRES}`, 'the presentation GET'); assert.equal(calls[0].init.cache, 'no-store')
  assert.equal(lib.presentationReadUrl(`${ORIGIN}/`, 'a b'), `${ORIGIN}/api/presentations/a%20b`)
  const signal = new AbortController().signal; let got; await readWith(async (url, init) => { got = init.signal; return answer(200, deckOf(1)) }, { signal }); assert.equal(got, signal, 'the controller\'s own signal reaches the read')
  assert.deepEqual(plain(await readWith(async () => answer(404, {}))), { kind: 'unavailable', reason: 'http_404' }); assert.deepEqual(plain(await readWith(async () => answer(500, {}))), { kind: 'unavailable', reason: 'http_500' })
  assert.deepEqual(plain(await readWith(async () => answer(200, undefined))), { kind: 'unavailable', reason: 'invalid_json' }); assert.deepEqual(plain(await readWith(async () => answer(200, { slides: [] }))), { kind: 'unavailable', reason: 'invalid_presentation' })
  assert.deepEqual(plain(await readWith(async () => { const e = new Error('x'); e.name = 'AbortError'; throw e })), { kind: 'unavailable', reason: 'AbortError' }); assert.deepEqual(plain(await readWith(async () => { throw 'boom' })), { kind: 'unavailable', reason: 'network' }, 'never throws')
  // -- the Publish frame's gate --------------------------------------------------------------------------------------------------------------------
  const source = { sessionId: 's1', ownerSessionId: 's1', finalPresentationId: 'deck-9' }
  assert.deepEqual(plain(lib.publishFrameRequest('unavailable', 's1', source)), { key: JSON.stringify(['s1', 'deck-9']), session: 's1', presentationId: 'deck-9' })
  for (const status of ['loading', 'ready', 'frame', '']) assert.equal(lib.publishFrameRequest(status, 's1', source), null, `${status}: no read`)
  for (const [session, src] of [[null, source], ['', source], ['s1', null], ['s1', undefined], ['s2', source], ['s1', { ...source, sessionId: 's2' }], ['s1', { ...source, ownerSessionId: 's2' }], ['s1', { ...source, ownerSessionId: null }], ['s1', { ...source, finalPresentationId: '' }], ['s1', { ...source, finalPresentationId: '  ' }], ['s1', { sessionId: 's1' }]]) assert.equal(lib.publishFrameRequest('unavailable', session, src), null, `another session's or missing deck: ${JSON.stringify([session, src])}`)
  assert.equal(lib.publishFrameRequest('unavailable', ' s1 ', { sessionId: 's1 ', ownerSessionId: ' s1', finalPresentationId: ' deck-9 ' })?.presentationId, 'deck-9', 'values are trimmed like the other Publish preview sources')
}

// ============================================================================================================================================
// 3. The REAL inventory controller (lib/slide-rail-identity.ts, evaluated bare) with the fallback
// ============================================================================================================================================
async function controllerChecks(railText = read(RAIL), fallbackText = read(FALLBACK)) {
  const rail = loadLib(RAIL, railText, {}), fb = loadLib(FALLBACK, fallbackText, {})
  const run = async ({ inventory, presentation, withFallback = true, throwingFallback = false, refreshes = 1 }) => {
    const states = [], urls = [], fallbackArgs = []
    const fetchImpl = async (url, init) => { urls.push(url); return url.endsWith('/slides/inventory') ? inventory() : (presentation ? presentation() : answer(404, {})) }
    const controller = rail.createSlideInventoryController({
      presentationId: PRES, getBaseUrl: () => ORIGIN, fetchImpl, onChange: state => states.push(plain(state)), setTimer: () => 1, clearTimer: () => {}, unavailableTtlMs: 0,
      ...(withFallback ? { readFallback: async args => { fallbackArgs.push(args); if (throwingFallback) throw new Error('boom'); const derived = await fb.readInventoryFallback({ ...args, fetchImpl: (u, i) => fetchImpl(u, i) }); return derived.kind === 'ok' ? derived : null } } : {}),
    })
    unhandled.length = 0
    for (let i = 0; i < refreshes; i++) { controller.refresh(true); await tick(); await tick(); await tick() }
    controller.dispose()
    assert.equal(unhandled.length, 0, `no unhandled rejection from the controller: ${unhandled.map(String).join('; ')}`)
    return { states, urls, fallbackArgs, last: states[states.length - 1] }
  }
  const status = code => () => answer(code, code < 300 ? deckOf(2) : { detail: 'x' })
  for (const code of [405, 404]) {
    const result = await run({ inventory: status(code), presentation: () => answer(200, deckOf(3)) })
    assert.deepEqual(result.states.map(state => state.status), ['loading', 'ready'], `${code}: loading, then ready (the derived inventory stands in)`)
    assert.equal(result.last.inventory.slideCount, 3); assert.deepEqual(result.last.inventory.slides.map(row => row.title), ['Title 1', 'Title 2', 'Title 3']); assert.ok(result.last.inventory.slides.every(row => row.thumbnailStatus === 'none' && row.thumbnailUrl === null), 'every row: no preview, none coming')
    assert.deepEqual(result.urls, [`${ORIGIN}/api/presentations/${PRES}/slides/inventory`, `${ORIGIN}/api/presentations/${PRES}`], 'the inventory first, then ONE presentation read')
    assert.equal(result.fallbackArgs.length, 1); assert.equal(result.fallbackArgs[0].baseUrl, ORIGIN); assert.equal(result.fallbackArgs[0].presentationId, PRES)
    // the rail rows it gives (the existing builder): numbered, titled, status none
    const rows = plain(rail.buildRailRows(result.last.inventory, new Map()))
    assert.deepEqual(rows.map(row => [row.slideNumber, row.slideId, row.title, row.thumbnailStatus]), [[1, 'slide_1', 'Title 1', 'none'], [2, 'slide_2', 'Title 2', 'none'], [3, 'slide_3', 'Title 3', 'none']], `${code}: the rail rows`)
  }
  // the fallback cannot derive an inventory (404, bad body, ids): the base's answer stands
  for (const presentation of [() => answer(404, {}), () => answer(500, {}), () => answer(200, undefined), () => answer(200, { slides: [] }), () => answer(200, { slides: [{ layout: 'x' }] }), null]) {
    const result = await run({ inventory: status(405), presentation })
    assert.deepEqual(result.states.map(state => state.status), ['loading', 'unavailable'], 'no usable presentation: unavailable, as without the fallback'); assert.equal(result.last.inventory, null)
  }
  { const result = await run({ inventory: status(405), presentation: () => answer(200, deckOf(2)), throwingFallback: true }); assert.deepEqual(result.states.map(state => state.status), ['loading', 'unavailable'], 'a fallback that throws is the base\'s unavailable') }
  // without the fallback (what the base passes): the base's behaviour, one request
  { const result = await run({ inventory: status(405), presentation: () => answer(200, deckOf(3)), withFallback: false }); assert.deepEqual(result.states.map(state => state.status), ['loading', 'unavailable'], 'no readFallback: unavailable'); assert.deepEqual(result.urls, [`${ORIGIN}/api/presentations/${PRES}/slides/inventory`], 'one request, the inventory') }
  // only 404 and 405 ask the fallback
  for (const code of [500, 502, 401, 403]) { const result = await run({ inventory: status(code), presentation: () => answer(200, deckOf(3)) }); assert.equal(result.fallbackArgs.length, 0, `${code}: the fallback is not asked`); assert.equal(result.urls.length, 1, `${code}: one request`) }
  { const result = await run({ inventory: () => answer(200, undefined), presentation: () => answer(200, deckOf(3)) }); assert.equal(result.fallbackArgs.length, 0, 'invalid_json: not asked'); assert.equal(result.last.status, 'unavailable') }
  { const result = await run({ inventory: () => answer(200, { presentation_id: PRES, slide_count: 9, slides: [] }), presentation: () => answer(200, deckOf(3)) }); assert.equal(result.fallbackArgs.length, 0, 'invalid_inventory: not asked') }
  { const result = await run({ inventory: () => answer(200, { presentation_id: PRES, slide_count: 1, slides: [{ slide_id: 'real', slide_index: 0, title: 'From inventory', thumbnail_url: 'https://img.test/1.png', thumbnail_stale: false, thumbnail_status: 'fresh' }] }), presentation: () => answer(200, deckOf(3)) })
    assert.equal(result.fallbackArgs.length, 0, 'a real inventory: the fallback is not asked'); assert.equal(result.last.inventory.slides[0].thumbnailUrl, 'https://img.test/1.png', 'and its image is used') }
  // a second refresh with the same slides publishes nothing new (the rail does not re-render for it)
  { const result = await run({ inventory: status(405), presentation: () => answer(200, deckOf(3)), refreshes: 2 }); assert.deepEqual(result.states.map(state => state.status), ['loading', 'ready'], 'an unchanged derived inventory is not published twice') }
  { let n = 3; const result = await run({ inventory: status(405), presentation: () => answer(200, deckOf(n++)), refreshes: 2 }); assert.deepEqual(result.states.map(state => `${state.status}:${state.inventory?.slideCount ?? '-'}`), ['loading:-', 'ready:3', 'ready:4'], 'a changed deck is published') }
}


// ============================================================================================================================================
// 4. The marked lines
// ============================================================================================================================================
function fileChecks(texts = TEXTS) {
  const marked = rel => texts[rel].split('\n').filter(line => MARKER_RE.test(line))
  const dash = texts[DASH], rail = texts[RAIL], railHook = texts[RAIL_HOOK], pub = texts[PUBLISH]
  // the Decks page: nine marked lines
  assert.equal(marked(DASH).length, 9, 'the Decks page carries the marker on nine lines: the import, three in PresentationPreview, the box ref, the note, the page re-render, two Duplicate targets')
  assert.match(dash, /^import \{ useStudioDeckCardRehome, useStudioDeckRehomeVersion, studioDeckRehomeDecision \} from "@\/hooks\/use-studio-deck-card-rehome" \/\/ AUDIT-PREVIEWS /m, 'the page imports the hook')
  assert.ok(dash.includes('  const savedDecision = evaluateLayoutViewerUrl(candidate, LAYOUT_VIEWER_URL_POLICY) // AUDIT-PREVIEWS\n  const rehome = useStudioDeckCardRehome(candidate, savedDecision) // AUDIT-PREVIEWS'), 'the saved decision is made first and the hook reads it')
  assert.ok(dash.includes('\n  const decision = rehome.url ? evaluateLayoutViewerUrl(rehome.url, LAYOUT_VIEWER_URL_POLICY) : savedDecision // AUDIT-PREVIEWS\n  const deckCardThumbnail = useStudioDeckCardThumbnail(decision, deckTitle(presentation))'), 'the card decision is this Layout\'s own URL once the deck is here, and the thumbnail reads it')
  assert.ok(dash.includes('    <div ref={rehome.boxRef} className="relative h-full w-full">{/* AUDIT-PREVIEWS */}\n      <img\n'), 'the placeholder is the box the first-visibility read watches')
  assert.ok(dash.includes("      {decision.status === 'blocked' && !rehome.pending && ( // AUDIT-PREVIEWS\n"), 'the honest note waits for the answer')
  assert.equal((dash.match(/duplicateTargetFor\(presentation, url => studioDeckRehomeDecision\(url, saved => evaluateLayoutViewerUrl\(saved, LAYOUT_VIEWER_URL_POLICY\)\)\) \/\/ AUDIT-PREVIEWS/g) || []).length, 2, 'both Duplicate targets (the click and the menu item) read the re-homed decision')
  assert.equal((dash.match(/duplicateTargetFor\(/g) || []).length, 2, 'duplicateTargetFor is called twice by the page, and both calls are the ones above') 
  assert.ok(dash.includes('  const router = useRouter()\n  useStudioDeckRehomeVersion() // AUDIT-PREVIEWS'), 'the page re-renders when an answer settles')
  assert.equal(/process\.env\.NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME/.test(dash), false, 'the page does not read the env itself')
  // the controller: four marked lines, import-free, the fallback asked inside the try right after the inventory read
  assert.equal(marked(RAIL).length, 4, 'the controller carries the marker on four lines: the parameter, its two doc lines (comment and type), the call')
  assert.deepEqual([...rail.matchAll(/^import .*$/gm)].map(m => m[0]), [], 'the inventory module stays import-free')
  const lines = rail.split('\n'), call = lines.findIndex(line => line.includes('await readFallback('))
  assert.ok(call > 0 && lines[call - 1].includes('result = await fetchSlideInventory({ baseUrl, presentationId, fetchImpl, signal: abort?.signal })') && lines[call + 1] === '    } finally {', 'the fallback is asked inside the try, right after the inventory read and before the finally')
  assert.ok(lines[call].includes("readFallback && result.kind === 'unavailable' && (result.reason === 'http_404' || result.reason === 'http_405')") && lines[call].includes('.catch(() => null)') && lines[call].includes('if (derived) result = derived'), 'only 404 and 405, never throws, a null keeps the answer')
  assert.ok(lines.some(line => line === '  readFallback, // AUDIT-PREVIEWS') && lines.some(line => line.startsWith('  readFallback?: (args: { baseUrl: string; presentationId: string; fetchImpl: typeof fetch; signal?: AbortSignal }) => Promise<SlideInventoryResult | null> // AUDIT-PREVIEWS')), 'the optional parameter and its type')
  // the rail hook: the fallback is passed only with the flag on, and only an ok result
  assert.equal(marked(RAIL_HOOK).length, 2, 'the rail hook carries the marker on two lines')
  assert.ok(railHook.includes("import { STUDIO_INVENTORY_FALLBACK_ENABLED, readInventoryFallback } from '@/lib/studio-inventory-fallback' // AUDIT-PREVIEWS"), 'the rail hook imports the lib')
  assert.ok(railHook.includes("      ...(STUDIO_INVENTORY_FALLBACK_ENABLED ? { readFallback: async args => { const derived = await readInventoryFallback(args); return derived.kind === 'ok' ? derived : null } } : {}), // AUDIT-PREVIEWS\n"), 'the fallback is passed only with the flag on, and only a derived inventory counts')
  // the Publish preview: five marked lines, the frame after the image and before the unavailable state
  assert.equal(marked(PUBLISH).length, 5, 'the Publish preview carries the marker on five lines')
  assert.ok(pub.includes("  const preview = useStudioPublishPreviewInventory(sessionId, source, resolved)\n  const frame = useStudioPublishPreviewFrame(sessionId, source, preview) // AUDIT-PREVIEWS"), 'the frame reads the preview the other sources resolved')
  assert.ok(pub.includes("      {preview.status === 'ready' ? (\n        <OwnedPreviewImage key={preview.ownerKey} ownerKey={preview.ownerKey} thumbnailUrl={preview.thumbnailUrl} />\n      ) : frame ? ( // AUDIT-PREVIEWS\n        <PublishPreviewFrame src={frame.src} /> // AUDIT-PREVIEWS\n      ) : (\n        <PreviewFallback loading={preview.status === 'loading'} />\n"), 'an image first, then the frame, then the unavailable state')
  assert.equal(/process\.env\./.test(pub), false, 'the Publish preview reads no env itself')
  // the new hooks and the frame component read no env; the frame is view-only
  for (const rel of [CARD_HOOK, FRAME_HOOK]) assert.equal(/process\.env\./.test(texts[rel]), false, `${rel} reads no env itself (the libs do)`)
  assert.ok(texts[CARD_HOOK].includes("STUDIO_DECK_CARD_REHOME_ENABLED, savedUrl, decision, LAYOUT_VIEWER_URL_POLICY.configuredOrigin") && texts[CARD_HOOK].includes('observeFirstVisibility('), 'the card hook reads the flag from the lib and waits for the first visibility')
  assert.ok(texts[FRAME_HOOK].includes('STUDIO_INVENTORY_FALLBACK_ENABLED ? publishFrameRequest(preview.status, publishSessionId, source) : null') && texts[FRAME_HOOK].includes("answers[request.key] !== 'here'"), 'the frame hook asks only with the flag on and only for an unavailable preview, and needs the answer "here"')
  assert.ok(texts[FRAME_HOOK].includes('railLivePreviewSrc(rehomedViewerUrl(origin, request.presentationId), 0, LAYOUT_VIEWER_URL_POLICY)'), 'the frame URL goes through the view-only builder and the Layout allow-list')
  assert.ok(texts[FRAME].includes('aria-hidden="true"') && texts[FRAME].includes('tabIndex={-1}') && texts[FRAME].includes("pointerEvents: 'none'") && texts[FRAME].includes('<iframe src={src}'), 'the frame is not clickable, focusable or read aloud')
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
  const strip = mod.stripAuditPreviews, edits = mod.AUDIT_PREVIEWS_EDITS, files = mod.AUDIT_PREVIEWS_FILES, block = mod.AUDIT_PREVIEWS_ENV_BLOCK
  // the strip gives each touched file its base back, byte for byte, and is idempotent
  for (const rel of files) {
    const now = laterStrips(rel, texts[rel]), out = strip(rel, now)
    assert.equal(out, baseText(rel), `${rel}: without this change's edits the file is the base's, byte for byte`)
    assert.equal(strip(rel, out), out, `${rel}: stripping twice changes nothing more`)
    assert.notEqual(now, baseText(rel), `${rel}: the change is there to strip`)
  }
  for (const rel of ['app/builder/page.tsx', 'components/builder/message-list.tsx', '.env.example', REGISTRY]) assert.equal(strip(rel, 'x\nAUDIT-PREVIEWS\n'), 'x\nAUDIT-PREVIEWS\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(strip(files[0], 5), 5, 'a text that is not a string comes back as it is')
  // every line a file gains carries the marker; the only base lines lost are the ones this change rewrites (its pairs' `was` lines), all of them
  for (const rel of files) {
    const diff = lineDiff(baseText(rel), laterStrips(rel, texts[rel])), allowed = rewritten(edits, rel)
    for (const line of diff.added) assert.match(line, MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    for (const line of diff.removed) assert.ok(allowed.has(line), `${rel}: a base line is lost that this change does not rewrite: ${line.trim().slice(0, 100)}`)
    assert.equal(diff.removed.length, (edits[rel] || []).flatMap(([, was]) => was.split('\n')).filter(line => line !== '').length, `${rel}: the base lines this change rewrites (all of them, no other)`)
  }
  // the older proofs this change teaches: each gains one marked line (the first-parent walk leaves this change's commits out) and is the base's without it
  const EXTRA_PIN_FILES = ["scripts/test-studio-deck-card-count.mjs","scripts/test-studio-create-word.mjs","scripts/test-studio-deck-cards-v2.mjs","scripts/test-studio-plain-nav-labels.mjs","scripts/test-atlas-decks-pagination.mjs","scripts/test-present-view-only.mjs","scripts/test-studio-deck-card-thumbnail-cards.mjs","scripts/test-studio-deck-card-thumbnail.mjs","scripts/test-studio-rail-slide-identity.mjs","scripts/test-studio-publish-preview.mjs","scripts/test-studio-publish-preview-inventory.mjs"]
  assert.deepEqual([...mod.AUDIT_PREVIEWS_PIN_FILES].sort(), [...PIN_FILES, ...EXTRA_PIN_FILES].sort(), 'the older proofs this change teaches')
  // an older proof that compiles a touched file with a fixed import list: one marked insertion, the base's proof without it
  for (const rel of EXTRA_PIN_FILES) {
    const now = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's line the proof is the base's, byte for byte`)
    const pairs = mod.AUDIT_PREVIEWS_PIN_EDITS[rel], wasLines = pairs.flatMap(([, was]) => was.split('\n')).filter(line => line !== ''), hasLines = pairs.flatMap(([has]) => has.split('\n')).filter(line => line !== '')
    assert.deepEqual([diff.removed.length, diff.added.length], [wasLines.length, hasLines.length], `${rel}: the proof gains and loses exactly the lines of its pairs`)
    for (const line of diff.added) assert.ok(line.includes(mod.AUDIT_PREVIEWS_PIN_MARK), `${rel}: a line added carries the pin mark`)
  }
  for (const rel of PIN_FILES) {
    const now = laterStrips(rel, texts[rel]), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's line the proof is the base's, byte for byte`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, 1], `${rel}: the proof gains one line and loses none`)
    assert.ok(diff.added[0].includes(mod.AUDIT_PREVIEWS_PIN_MARK) && diff.added[0].includes('^Audit fix:'), `${rel}: the line carries the pin mark and names this change's subject`)
  }
  // the voice-call proof: FRONTEND-1's four-line after-merge edit (2 lines inserted after the strip import, 2 lines changed), the same four lines FRONTEND-2's #603 carries byte for byte (so every PR merges clean in any order)
  assert.deepEqual([...mod.AUDIT_PREVIEWS_VOICE_CALL_PIN_FILES], [VOICE_CALL], 'the one voice-call proof this change edits')
  {
    const now = texts[VOICE_CALL], diff = lineDiff(baseText(VOICE_CALL), now)
    assert.equal(strip(VOICE_CALL, laterStrips(VOICE_CALL, now)), baseText(VOICE_CALL), `${VOICE_CALL}: without the four lines the proof is the base's, byte for byte`)
    assert.equal(strip(VOICE_CALL, strip(VOICE_CALL, now)), strip(VOICE_CALL, now), `${VOICE_CALL}: stripping twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [2, 4], `${VOICE_CALL}: two base lines changed and two lines inserted, nothing else`)
    for (const line of diff.added) assert.ok(line.endsWith(mod.AUDIT_PREVIEWS_VOICE_CALL_PIN_MARK), `${VOICE_CALL}: a line added carries the registry-read mark: ${line.trim().slice(0, 90)}`)
    const lines = now.split('\n'), at = lines.indexOf(mod.AUDIT_PREVIEWS_VOICE_CALL_PIN_ANCHOR)
    assert.ok(at >= 0 && lines[at + 1].startsWith('const laterRegistry = await import(') && lines[at + 2].startsWith('const laterEnvOut = text =>'), `${VOICE_CALL}: the two inserted lines sit right after the strip import`)
    assert.equal(now.split('\n').filter(line => line.includes('laterEnvOut(')).length, 2, `${VOICE_CALL}: the helper is read by the two .env.example pins`)
  }
  // the new libs: import-free, one literal env read each (nothing else reads the flag)
  for (const [rel, flag] of mod.AUDIT_PREVIEWS_LIB_FLAGS) {
    assert.equal((texts[rel].match(new RegExp(`process\\.env\\.${flag}\\b`, 'g')) || []).length, 1, `${rel} reads the literal env name ${flag} once`)
    assert.deepEqual([...texts[rel].matchAll(/^import .*$/gm)].map(m => m[0]), [], `${rel} is import-free`)
    for (const other of [...files, ...mod.AUDIT_PREVIEWS_NEW_FILES.filter(f => /^(hooks|components)\//.test(f))]) assert.equal((texts[other] || '').includes(`process.env.${flag}`), false, `${other} does not read ${flag} itself`)
  }
  // .env.example: the base plus the block (after one blank line); every flag documented "false", once
  assert.equal(texts['.env.example'], `${baseText('.env.example')}\n${block}`, '.env.example is the base plus the block')
  for (const flag of mod.AUDIT_PREVIEWS_FLAGS) {
    assert.match(block, new RegExp(`^${flag}="false"$`, 'm'), `the block documents ${flag} as "false"`)
    assert.equal((texts['.env.example'].match(new RegExp(`^${flag}=`, 'gm')) || []).length, 1, `.env.example assigns ${flag} once`)
  }
  assert.ok(block.endsWith('\n') && block.split('\n').filter(line => line && !line.startsWith('#')).length === mod.AUDIT_PREVIEWS_FLAGS.length, 'the block is comments and one assignment per flag')
}

/** The registry checks on the registry's text. */
function registryChecks(text, texts = TEXTS) {
  const { AUDIT_PREVIEWS_SCOPE_FILES: scope, AUDIT_PREVIEWS_ENV_BLOCK: block } = stripModule
  for (const list of ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS']) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n'), own = rows.findIndex(line => line.includes('studio-audit-previews-strip.mjs')), voice = rows.findIndex(line => line.includes('studio-voice-call-strip.mjs'))
    assert.ok(own > voice && voice > 0, `${list}: this change's line comes after the voice call's`)
    assert.equal((text.slice(start, end).match(/studio-audit-previews-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-audit-previews-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes('// LATER-CHANGE: FRONTEND-1, audit P-01 / P-07 / P-29, deck cards and Duplicate for a deck that exists on this Layout, the slide list and a live Publish preview when the inventory route is absent')), 'each carries the registry marker')
  assert.deepEqual(lineDiff(baseText(REGISTRY), text).removed, [], 'and loses none')
  assert.equal(lineDiff(baseText(REGISTRY), text).added.filter(line => registered.includes(line)).length, 3, 'the three lines are what it gains (a change registered later adds its own)')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(block), 'the block is registered')
  assert.ok([...scope].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  for (const rel of TOUCHED) assert.equal(registry.stripLaterChanges(rel, texts[rel]), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(stripModule.AUDIT_PREVIEWS_FLAGS.some(flag => registry.stripLaterEnvBlocks('.env.example', texts['.env.example']).includes(flag)), false, 'the registry takes the block out of .env.example')
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
const TEXTS = Object.fromEntries([...TOUCHED, ...NEW_FILES, '.env.example', REGISTRY, ...PIN_FILES, ...["scripts/test-studio-deck-card-count.mjs","scripts/test-studio-create-word.mjs","scripts/test-studio-deck-cards-v2.mjs","scripts/test-studio-plain-nav-labels.mjs","scripts/test-atlas-decks-pagination.mjs","scripts/test-present-view-only.mjs","scripts/test-studio-deck-card-thumbnail-cards.mjs","scripts/test-studio-deck-card-thumbnail.mjs","scripts/test-studio-rail-slide-identity.mjs","scripts/test-studio-publish-preview.mjs","scripts/test-studio-publish-preview-inventory.mjs"], VOICE_CALL].map(rel => [rel, read(rel)]))

await check('1. the re-home lib: the flag, the id, the target rule, the read (status mapping, abort at the status, the limit), the store (one read per id, shared, three at once), the decision Duplicate reads', () => rehomeChecks())
await check('2. the fallback lib: the flag, the 404/405 rule, titles, the inventory from a presentation body (every refusal), the read, the Publish frame gate', () => fallbackChecks())
await check('3. the REAL inventory controller: 404/405 asks the fallback once and a derived inventory stands in; anything else does not; no fallback = the base\'s behaviour; the rail rows', () => controllerChecks())
await check('4. the marked lines: the Decks page (card, note, Duplicate, page re-render), the rail hook and controller, the Publish preview and its frame; the hooks read no env', () => fileChecks())

await check('3a. the strip gives every touched file its base back byte for byte; every marked line is where it should be; the libs, the flag reads, the older proofs\' pin lines, the voice-call pin and .env.example', () => sourceChecks(TEXTS))
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

const mutateAll = (text, from, to, name) => { assert.ok(text.split(from).length > 1, `mutant "${name}": the text to change is there`); return text.split(from).join(to) }
const REHOME_TEXT = TEXTS[REHOME], FALLBACK_TEXT = TEXTS[FALLBACK], RAIL_TEXT = TEXTS[RAIL]
const REHOME_MUTANTS = [
  ['the flag accepts "1"', "return value === 'true'", "return value === 'true' || value === '1'"],
  ['the flag is always on', "return value === 'true'", 'return true'],
  ['the target ignores the flag', 'if (enabled !== true || !configuredOrigin) return null', 'if (!configuredOrigin) return null'],
  ['the target accepts any block reason', "if (!decision || decision.status !== 'blocked' || decision.reason !== 'unapproved_origin') return null", "if (!decision || decision.status !== 'blocked') return null"],
  ['the target does not guard a missing decision', "if (!decision || decision.status !== 'blocked' || ", "if (decision.status !== 'blocked' || "],
  ['a 5xx counts as "absent"', "response.ok ? 'here' : response.status === 404 ? 'absent' : 'unknown'", "response.ok ? 'here' : 'absent'"],
  ['any answer counts as "here"', "response.ok ? 'here' : response.status === 404 ? 'absent' : 'unknown'", "'here'"],
  ['the body is not given up (no abort at the status)', '      abort?.abort() // the status is known; the (possibly large) body is not wanted\n', ''],
  ['the time limit does not end the read', "timer = setTimeout(() => { abort?.abort(); resolve('unknown') }, timeoutMs)", 'timer = setTimeout(() => {}, timeoutMs)'],
  ['the limit does not abort the request', "timer = setTimeout(() => { abort?.abort(); resolve('unknown') }, timeoutMs)", "timer = setTimeout(() => { resolve('unknown') }, timeoutMs)"],
  ['the read is cached by the browser', "{ cache: 'no-store', signal: abort?.signal }", '{ signal: abort?.signal }'],
  ['the id is not length-checked', 'id.length > MAX_ID_LENGTH || ', ''],
  ['the id is not decoded', 'decodeURIComponent(parts[marker + 1])', 'parts[marker + 1]'],
  ['the re-homed URL is not encoded', '`${configuredOrigin}/p/${encodeURIComponent(presentationId)}`', '`${configuredOrigin}/p/${presentationId}`'],
  ['the store does not share an in-flight read', '      const pending = inFlight.get(presentationId)\n      if (pending) return pending\n', ''],
  ['the store does not keep an answer', '            settled.set(presentationId, result)\n', ''],
  ['the store has no concurrency limit', 'while (running < Math.max(1, maxConcurrent) && waiting.length > 0)', 'while (waiting.length > 0)'],
  ['the store does not move its version', '            version += 1\n            listeners.forEach', '            listeners.forEach'],
  ['the store does not tell subscribers', '            listeners.forEach(listener => listener())\n', ''],
  ['the store lets a throwing read through', "try { started = Promise.resolve(read()) } catch { started = Promise.resolve('unknown' as DeckCardRehomeAnswer) }", 'started = Promise.resolve(read())'],
  ['the decision is re-homed without the answer', "if (!target || peek(target.presentationId) !== 'here') return saved", 'if (!target) return saved'],
  ['the decision is re-homed to an unapproved URL', "return here.status === 'allowed' ? here : saved", 'return here'],
  ['the lib imports something', 'export function deckCardRehomeOn', "import { x } from '@/lib/x'\nexport function deckCardRehomeOn"],
]
for (const [name, from, to] of REHOME_MUTANTS) {
  await check(`mutant caught: re-home lib: ${name}`, async () => {
    const mutant = mutate(REHOME_TEXT, from, to, name)
    assert.ok(await throws(async () => { await rehomeChecks(mutant); sourceChecks({ ...TEXTS, [REHOME]: mutant }) }), 'sections 1 and 3 must fail')
  })
}
const FALLBACK_MUTANTS = [
  ['the flag accepts "1"', "return value === 'true'", "return value === 'true' || value === '1'"],
  ['the flag is always on', "return value === 'true'", 'return true'],
  ['a 500 counts as "route absent"', "return reason === 'http_404' || reason === 'http_405'", "return reason === 'http_404' || reason === 'http_405' || reason === 'http_500'"],
  ['only a 405 counts as "route absent"', "return reason === 'http_404' || reason === 'http_405'", "return reason === 'http_405'"],
  ['a placeholder title is a title', "if (!text || STOCK_TITLES.has(text.toLowerCase())) continue", 'if (!text) continue'],
  ['"Slide N" is a title', ' || /^Slide \\d+$/i.test(text)', ''],
  ['an over-long title is kept', 'if (text.length > MAX_TITLE_LENGTH || ', 'if ('],
  ['HTML is not stripped', ".replace(/<[^>]*>/g, ' ')", ''],
  ['the system title box is ignored', "(box.slot_kind === 'structural' || box.slot_kind === 'system')", "box.slot_kind === 'structural'"],
  ['any text box counts as the title mirror', "box.slot_name === 'title' && (box.slot_kind === 'structural' || box.slot_kind === 'system')", "box.slot_name === 'title'"],
  ['a duplicate slide id is accepted', ' || seen.has(id)', ''],
  ['a slide with no id is accepted', "if (typeof id !== 'string' || !id || id.length > MAX_SLIDE_ID_LENGTH || id !== id.trim() || seen.has(id)) return null", 'if (seen.has(id)) return null'],
  ['another presentation\'s body is accepted', "if (body[key] !== undefined && body[key] !== presentationId) return null", ''],
  ['an empty deck is an inventory', ' || body.slides.length === 0', ''],
  ['a row claims a preview is pending', "      thumbnailStatus: 'none',\n      title: fallbackSlideTitle(slide),", "      thumbnailStatus: 'pending' as 'none',\n      title: fallbackSlideTitle(slide),"],
  ['a row carries an image', '      thumbnailUrl: null,\n', "      thumbnailUrl: 'https://x.test/1.png',\n"],
  ['the order of the slides changes', '      slideIndex: position,', '      slideIndex: rows.length + 1,'],
  ['a failed read is an inventory', "  if (!response.ok) return { kind: 'unavailable', reason: `http_${response.status}` }\n", ''],
  ['the controller\'s signal is dropped', "{ cache: 'no-store', signal }", "{ cache: 'no-store' }"],
  ['the read throws on a network failure', "  } catch (error) {\n    return { kind: 'unavailable', reason: record(error) && typeof error.name === 'string' ? error.name : 'network' }\n  }", '  } finally {\n  }'],
  ['the Publish frame reads for a loading preview', "if (previewStatus !== 'unavailable') return null", ''],
  ['the Publish frame ignores the held deck owner', ' || nonempty(source?.ownerSessionId) !== session', ''],
  ['the Publish frame ignores the session', 'nonempty(source?.sessionId) !== session || ', ''],
  ['the lib imports something', 'export function inventoryFallbackOn', "import { x } from '@/lib/x'\nexport function inventoryFallbackOn"],
]
for (const [name, from, to] of FALLBACK_MUTANTS) {
  await check(`mutant caught: fallback lib: ${name}`, async () => {
    const mutant = mutate(FALLBACK_TEXT, from, to, name)
    assert.ok(await throws(async () => { await fallbackChecks(mutant); await controllerChecks(RAIL_TEXT, mutant); sourceChecks({ ...TEXTS, [FALLBACK]: mutant }) }), 'sections 2, 3 and the sources must fail')
  })
}
const RAIL_MUTANTS = [
  ['the fallback is asked for any failed read', "result.kind === 'unavailable' && (result.reason === 'http_404' || result.reason === 'http_405')", "result.kind !== 'ok'"],
  ['the fallback is asked only for a 405', "(result.reason === 'http_404' || result.reason === 'http_405')", "(result.reason === 'http_405')"],
  ['the derived inventory is dropped', 'if (derived) result = derived', ''],
  ['a throwing fallback is not contained', '.catch(() => null)', ''],
  ['the fallback is not optional', 'if (readFallback && result.kind', 'if (result.kind'],
  ['the fallback is asked outside the try', "      result = await fetchSlideInventory({ baseUrl, presentationId, fetchImpl, signal: abort?.signal })\n      if (readFallback", "      result = await fetchSlideInventory({ baseUrl, presentationId, fetchImpl, signal: abort?.signal })\n      if (false && readFallback"],
]
for (const [name, from, to] of RAIL_MUTANTS) {
  await check(`mutant caught: controller: ${name}`, async () => {
    const mutant = mutate(RAIL_TEXT, from, to, name)
    assert.ok(await throws(async () => { await controllerChecks(mutant); fileChecks({ ...TEXTS, [RAIL]: mutant }); sourceChecks({ ...TEXTS, [RAIL]: mutant }) }), 'sections 3, 4 and the sources must fail')
  })
}
const FILE_MUTANTS = [
  [DASH, 'the card ignores the re-homed URL', 'const decision = rehome.url ? evaluateLayoutViewerUrl(rehome.url, LAYOUT_VIEWER_URL_POLICY) : savedDecision', 'const decision = savedDecision', false],
  [DASH, 'the note shows while the read is pending', "{decision.status === 'blocked' && !rehome.pending && ( // AUDIT-PREVIEWS", "{decision.status === 'blocked' && ( // AUDIT-PREVIEWS", false],
  [DASH, 'the box ref is dropped (no first-visibility read)', '<div ref={rehome.boxRef} className="relative h-full w-full">{/* AUDIT-PREVIEWS */}', '<div className="relative h-full w-full">{/* AUDIT-PREVIEWS */}', false],
  [DASH, 'both Duplicate targets ignore the re-home', 'url => studioDeckRehomeDecision(url, saved => evaluateLayoutViewerUrl(saved, LAYOUT_VIEWER_URL_POLICY))', 'url => evaluateLayoutViewerUrl(url, LAYOUT_VIEWER_URL_POLICY)', true],
  [DASH, 'one Duplicate target ignores the re-home', "const target = duplicateTargetFor(presentation, url => studioDeckRehomeDecision(url, saved => evaluateLayoutViewerUrl(saved, LAYOUT_VIEWER_URL_POLICY))) // AUDIT-PREVIEWS\n    return {", "const target = duplicateTargetFor(presentation, url => evaluateLayoutViewerUrl(url, LAYOUT_VIEWER_URL_POLICY)) // AUDIT-PREVIEWS\n    return {", false],
  [DASH, 'the page does not re-render on an answer', '  useStudioDeckRehomeVersion() // AUDIT-PREVIEWS', '  // AUDIT-PREVIEWS', false],
  [DASH, 'the hook reads the page\'s env', 'useStudioDeckCardRehome(candidate, savedDecision)', 'useStudioDeckCardRehome(process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME === "true" ? candidate : null, savedDecision)', false],
  [RAIL_HOOK, 'the fallback is always passed', '...(STUDIO_INVENTORY_FALLBACK_ENABLED ? {', '...(true ? {', false],
  [RAIL_HOOK, 'any fallback result counts', "return derived.kind === 'ok' ? derived : null", 'return derived as any', false],
  [PUBLISH, 'the frame replaces a ready image', "{preview.status === 'ready' ? (", "{frame ? (<PublishPreviewFrame src={frame.src} />) : preview.status === 'ready' ? (", false],
  [PUBLISH, 'the frame is never drawn', ') : frame ? ( // AUDIT-PREVIEWS', ') : false ? ( // AUDIT-PREVIEWS', false],
  [CARD_HOOK, 'the card hook reads the env itself', 'STUDIO_DECK_CARD_REHOME_ENABLED, savedUrl', "process.env.NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME === 'true', savedUrl", false],
  [CARD_HOOK, 'the card hook reads without waiting for the card to be seen', 'observeFirstVisibility(', 'ignoreVisibility(', false],
  [FRAME_HOOK, 'the frame hook reads the env itself', 'STUDIO_INVENTORY_FALLBACK_ENABLED ? publishFrameRequest', "process.env.NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK === 'true' ? publishFrameRequest", false],
  [FRAME_HOOK, 'the frame is drawn without the deck being here', "answers[request.key] !== 'here'", "answers[request.key] === 'absent'", false],
  [FRAME_HOOK, 'the frame URL skips the allow-list', 'railLivePreviewSrc(rehomedViewerUrl(origin, request.presentationId), 0, LAYOUT_VIEWER_URL_POLICY)', 'rehomedViewerUrl(origin, request.presentationId)', false],
  [FRAME, 'the frame can be clicked', "pointerEvents: 'none'", "pointerEvents: 'auto'", false],
  [FRAME, 'the frame can be focused', 'tabIndex={-1}', 'tabIndex={0}', false],
]
for (const [rel, name, from, to, all] of FILE_MUTANTS) {
  await check(`mutant caught: ${rel}: ${name}`, async () => {
    const mutant = (all ? mutateAll : mutate)(TEXTS[rel], from, to, name)
    assert.ok(await throws(() => { fileChecks({ ...TEXTS, [rel]: mutant }); sourceChecks({ ...TEXTS, [rel]: mutant }) }), 'sections 4 and the sources must fail')
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
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: text.split('\n').filter(line => !line.includes('registry read (AUDIT-PREVIEWS)')).join('\n') })), 'the line removed (the proof would fail on this change\'s own commits)')
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [rel]: text.replace('registry read (AUDIT-PREVIEWS)', 'registry read (OTHER)') })), 'the pin mark changed')
  }
})
await check('mutant caught: the voice-call proof without one of the four lines, or with one changed', async () => {
  const text = TEXTS[VOICE_CALL], lines = text.split('\n')
  for (const needle of ["const laterRegistry = await import(", "const laterEnvOut = text =>", "ok(laterEnvOut(env).endsWith(", "ok(laterEnvOut(`${envDiff"]) {
    const at = lines.findIndex(line => line.includes(needle)); assert.ok(at >= 0, needle)
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [VOICE_CALL]: lines.filter((_, index) => index !== at).join('\n') })), `without ${needle}`)
    assert.ok(await throws(() => sourceChecks({ ...TEXTS, [VOICE_CALL]: lines.map((line, index) => index === at ? `${line} // changed` : line).join('\n') })), `${needle} changed`)
  }
})
await check('mutant caught: .env.example with a flag on by default, or the block missing', async () => {
  for (const flag of stripModule.AUDIT_PREVIEWS_FLAGS) assert.ok(await throws(() => sourceChecks({ ...TEXTS, '.env.example': TEXTS['.env.example'].replace(`${flag}="false"`, `${flag}="true"`) })), `${flag} true by default`)
  assert.ok(await throws(() => sourceChecks({ ...TEXTS, '.env.example': baseText('.env.example') })))
})
const STRIP_TEXT = read(STRIP)
const STRIP_MUTANTS = [
  ['the strip puts nothing back', 'return putBackAuditPreviews(rel, text)', 'return text'],
  ['the strip touches a file it does not own', 'if (!(rel in AUDIT_PREVIEWS_EDITS) && !(rel in AUDIT_PREVIEWS_PIN_EDITS) && !(rel in AUDIT_PREVIEWS_VOICE_CALL_PIN_EDITS)) return text', "if (rel === 'app/builder/page.tsx') return text.toUpperCase()"],
  ['the strip does not know the voice-call proof', 'if (!(rel in AUDIT_PREVIEWS_EDITS) && !(rel in AUDIT_PREVIEWS_PIN_EDITS) && !(rel in AUDIT_PREVIEWS_VOICE_CALL_PIN_EDITS)) return text', 'if (!(rel in AUDIT_PREVIEWS_EDITS) && !(rel in AUDIT_PREVIEWS_PIN_EDITS)) return text'],
  ['the strip does not know the older proofs', 'if (!(rel in AUDIT_PREVIEWS_EDITS) && !(rel in AUDIT_PREVIEWS_PIN_EDITS) && !(rel in AUDIT_PREVIEWS_VOICE_CALL_PIN_EDITS)) return text', 'if (!(rel in AUDIT_PREVIEWS_EDITS) && !(rel in AUDIT_PREVIEWS_VOICE_CALL_PIN_EDITS)) return text'],
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
      const dropped = { ...stripModule, AUDIT_PREVIEWS_EDITS: { ...EDITS, [rel]: EDITS[rel].filter((_, index) => index !== at) } }
      const changed = { ...stripModule, AUDIT_PREVIEWS_EDITS: { ...EDITS, [rel]: EDITS[rel].map((pair, index) => index === at ? [pair[0], `${pair[1]}// changed\n`] : pair) } }
      // the strip function closes over its own tables, so the mutant is a rebuilt strip over the mutated table
      for (const mod of [dropped, changed]) {
        const mutantStrip = (r, text) => (typeof text !== 'string' || !(r in mod.AUDIT_PREVIEWS_EDITS)) ? stripModule.stripAuditPreviews(r, text) : (mod.AUDIT_PREVIEWS_EDITS[r] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
        assert.ok(await throws(() => sourceChecks(TEXTS, { ...mod, stripAuditPreviews: mutantStrip })), `${rel} pair ${at}`)
      }
    }
  }
})
await check('mutant caught: a stray file outside the scope (in a commit) fails the scope check, a polluted working tree does not; a commit message without the subject or the co-author line fails the message check', async () => {
  const own = ownCommits()
  assert.doesNotThrow(() => scopeCheck(own), 'the real tree passes')
  assert.ok(await throws(() => scopeCheck(own, ['stray-audit-previews.txt'])), 'a stray file fails the scope check')
  assert.ok(await throws(() => scopeCheck(own, ['app/builder/page.tsx'])), 'an app file nobody registered fails it too')
  // the scope reads the COMMITTED diff only: an untracked file in the tree (or an edited, or a staged one) is not a file this change commits, so it changes nothing
  const stray = path.join(repo, 'stray-audit-previews.txt'), before = [...touchedFiles(own)].sort()
  fs.writeFileSync(stray, 'stray\n')
  try { assert.deepEqual([...touchedFiles(own)].sort(), before, 'an untracked stray file does not change the files read'); assert.doesNotThrow(() => scopeCheck(own), 'and does not fail the scope check') } finally { fs.rmSync(stray) }
  assert.deepEqual(messageProblems(`${SUBJECT} a change`, 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [], 'a good message has no problem')
  assert.deepEqual(messageProblems(`${SUBJECT} a change`, 'body\n'), ['the co-author line'], 'no co-author line')
  assert.deepEqual(messageProblems('Fix the page', 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [`the subject starts "${SUBJECT}"`], 'another subject')
})
await check('mutant caught: the registry without one of the three lines, with a line changed, or with a base line lost', async () => {
  const text = TEXTS[REGISTRY], lines = text.split('\n')
  const mine = lines.map((line, index) => [line, index]).filter(([line]) => line.includes('studio-audit-previews-strip.mjs'))
  assert.equal(mine.length, 3)
  assert.doesNotThrow(() => registryChecks(text), 'the real registry passes')
  for (const [, index] of mine) assert.ok(await throws(() => registryChecks(lines.filter((_, at) => at !== index).join('\n'))), `without line ${index + 1}`)
  assert.ok(await throws(() => registryChecks(text.replace('// LATER-CHANGE: FRONTEND-1, audit P-01 / P-07 / P-29, deck cards and Duplicate for a deck that exists on this Layout, the slide list and a live Publish preview when the inventory route is absent', '// LATER-CHANGE: FRONTEND-1, something else'))), 'a changed marker comment')
  assert.ok(await throws(() => registryChecks(lines.filter(line => !line.includes('studio-voice-call-strip.mjs')).join('\n'))), 'a base line lost')
  assert.ok(await throws(() => registryChecks(lines.filter(line => !line.includes('one line per later change, above this comment')).join('\n'))), 'the marker comments lost')
})

release()
console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
