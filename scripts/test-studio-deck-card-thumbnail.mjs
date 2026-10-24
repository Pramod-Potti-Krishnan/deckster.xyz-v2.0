// COMPOSER-2 (PROGRAM-1 "thumbnails instead of live viewers in the deck list"): lib/studio-deck-card-thumbnail.ts and its page pin
// (flag NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED, exact "true", default off).
// Run: node scripts/test-studio-deck-card-thumbnail.mjs   (plain node: transpile + vm, `git show` reads the base commit; no network, no browser, no model call)
//
//   1. the lib       flag read rule; id extraction (an ALLOWED decision on the configured origin only); the row-0 rule (thumbnail_url, then last_good_thumbnail_url, then none; an absent field is null);
//                    the cue decision and FRONTEND-2's strings; the read (URL, time limit, every failure is a fallback); one read per id (the store); first visibility (the observer helper).
//   2. the page pin  flag off is the base: the Decks page without this change's lines is BASE_COMMIT's file byte for byte; every added page line carries the marker DECK-CARD-THUMBNAIL and no base
//                    line is changed or removed; the card's TITLE line is untouched; the flag is read in the lib only; .env.example is left alone; the strip module; a secret scan of the added lines.
//   3. mutants       every key rule broken in the lib or the page must fail a check above.
// The behaviour of the real hook, component and page under ReactDOM is scripts/test-studio-deck-card-thumbnail-cards.mjs.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  BASE_COMMIT, DASHBOARD_PAGE, DECK_CARD_THUMBNAIL_ENV_BLOCK, DECK_CARD_THUMBNAIL_FILES, DECK_CARD_THUMBNAIL_MARKER, DECK_CARD_THUMBNAIL_NEW_FILES, DECK_CARD_THUMBNAIL_SCOPE_FILES, stripDeckCardThumbnail,
} from './studio-deck-card-thumbnail-strip.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const LIB = 'lib/studio-deck-card-thumbnail.ts'
const OWNERSHIP = 'lib/builder-presentation-ownership.ts'
const HOOK = 'hooks/use-studio-deck-card-thumbnail.tsx'
const COMPONENT = 'components/studio-deck-card-thumbnail.tsx'
const CSS = 'components/studio-deck-card-thumbnail.css'
const FLAG = 'NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED'
const LAYOUT = 'https://layout.example.invalid'

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value))) // objects made inside the vm have the vm's Object.prototype
const eq = count(assert.equal), deep = count((actual, expected, message) => assert.deepEqual(plain(actual), expected, message)), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// ---------------------------------------------------------------- the lib, loaded from its text in a vm (the real lib + the real ownership parser)
const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function loadLib(source, { env = {}, timers = { setTimeout, clearTimeout } } = {}) {
  const run = (text, file, requireFn) => {
    const module = { exports: {} }
    vm.runInNewContext(compile(text, file), { module, exports: module.exports, require: requireFn, process: { env }, URL, AbortController, encodeURIComponent, decodeURIComponent, ...timers }, { filename: file })
    return module.exports
  }
  return run(source, LIB, spec => {
    if (spec === './builder-presentation-ownership') return run(read(OWNERSHIP), OWNERSHIP, () => { throw new Error('ownership is import-free') })
    throw new Error(`unexpected import ${spec}`)
  })
}

const allowed = (url, origin = LAYOUT) => ({ status: 'allowed', url, origin })
const response = (status, body, { badJson = false } = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (badJson) throw new SyntaxError('bad json'); return body } })
const inventory = (id, slides) => ({ presentation_id: id, slide_count: slides.length, slides })
const IMG = n => `https://cdn.example.invalid/slide-qa/${n}.png`

async function proveLib(lib, label = 'lib') {
  const at = text => `${label}: ${text}`

  // ---- the flag rule: the exact string "true"
  for (const [value, want] of [['true', true], [undefined, false], ['', false], ['false', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['1', false], ['yes', false], ['on', false]]) {
    eq(lib.deckCardThumbnailsEnabled(value), want, at(`flag rule for ${JSON.stringify(value)}`))
  }
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], ['true ', false], ['true', true]]) {
    // the module constant is read from the environment through the same rule (the lib text under test, not the file on disk)
    eq(lib.__constantFor(value), want, at(`module constant for ${JSON.stringify(value)}`))
  }

  // ---- id extraction: an ALLOWED decision on the configured origin only
  const target = (decision, origin = LAYOUT) => lib.deckCardThumbnailTarget(decision, origin)
  deep(target(allowed(`${LAYOUT}/p/deck-1`)), { presentationId: 'deck-1' }, at('an allowed viewer URL gives its /p/ id'))
  deep(target(allowed(`${LAYOUT}/p/deck-1?viewOnly=true#/2`)), { presentationId: 'deck-1' }, at('a query and a hash are not part of the id'))
  deep(target(allowed(`${LAYOUT}/p/a%20b`)), { presentationId: 'a b' }, at('a percent-encoded id is decoded as the ownership parser does'))
  eq(target({ status: 'empty', url: null, origin: null }), null, at('an empty decision has no id'))
  eq(target({ status: 'blocked', origin: LAYOUT, reason: 'unapproved_origin' }), null, at('a blocked decision has no id'))
  eq(target({ status: 'blocked', url: `${LAYOUT}/p/deck-1`, origin: LAYOUT, reason: 'unapproved_origin' }), null, at('only the status decides: a blocked decision with a URL on the configured origin still has no id'))
  eq(target({ status: 'empty', url: `${LAYOUT}/p/deck-1`, origin: LAYOUT }), null, at('an empty decision with a URL still has no id'))
  eq(target(null), null, at('no decision'))
  eq(target(undefined), null, at('no decision (undefined)'))
  eq(target(allowed('https://extra.example.invalid/p/deck-1', 'https://extra.example.invalid')), null, at('an allowed URL on ANOTHER origin than the configured Layout has no id (its deck is not in the configured Layout)'))
  eq(target(allowed(`${LAYOUT}/p/deck-1`), null), null, at('no configured origin: no id'))
  eq(lib.deckCardThumbnailTarget(allowed(`${LAYOUT}/p/deck-1`), undefined), null, at('no configured origin (undefined): no id'))
  eq(target(allowed(`${LAYOUT}/p/`)), null, at('/p/ without an id'))
  eq(target(allowed(`${LAYOUT}/`)), null, at('a URL without /p/'))
  eq(target(allowed(`${LAYOUT}/p/a%0Ab`)), null, at('a control character in the id'))
  eq(target(allowed(`${LAYOUT}/p/a%20`)), null, at('an id with trailing white space'))
  eq(target(allowed(`${LAYOUT}/p/${'x'.repeat(201)}`)), null, at('an id over 200 characters'))
  deep(target(allowed(`${LAYOUT}/p/${'x'.repeat(200)}`)), { presentationId: 'x'.repeat(200) }, at('an id of exactly 200 characters'))

  // ---- the row-0 rule
  const row = lib.deckCardThumbnailFromRow
  deep(row({ thumbnail_url: IMG(1) }), { url: IMG(1), lag: null }, at('a fresh thumbnail_url is shown, with no cue'))
  deep(row({ thumbnail_url: IMG(1), last_good_thumbnail_url: IMG(1) }), { url: IMG(1), lag: null }, at('fresh and last good equal: no cue'))
  deep(row({ thumbnail_url: IMG(1), last_good_thumbnail_url: IMG(2) }), { url: IMG(1), lag: null }, at('thumbnail_url wins over last_good_thumbnail_url'))
  deep(row({ thumbnail_url: null, last_good_thumbnail_url: IMG(2) }), { url: IMG(2), lag: 'content' }, at('no thumbnail_url: the last good image, with the content cue (reason absent)'))
  deep(row({ thumbnail_url: null, last_good_thumbnail_url: IMG(2), thumbnail_stale_reason: null }), { url: IMG(2), lag: 'content' }, at('reason null: the content cue'))
  deep(row({ thumbnail_url: null, last_good_thumbnail_url: IMG(2), thumbnail_stale_reason: 'content' }), { url: IMG(2), lag: 'content' }, at('reason content'))
  deep(row({ thumbnail_url: null, last_good_thumbnail_url: IMG(2), thumbnail_stale_reason: 'theme' }), { url: IMG(2), lag: 'theme' }, at('reason theme: the theme cue'))
  deep(row({ thumbnail_url: null, last_good_thumbnail_url: IMG(2), thumbnail_stale_reason: 'other' }), { url: IMG(2), lag: 'content' }, at('an unknown reason reads as content'))
  deep(row({ last_good_thumbnail_url: IMG(2), thumbnail_stale: true }), { url: IMG(2), lag: 'content' }, at('thumbnail_url ABSENT counts as null'))
  eq(row({ thumbnail_url: null }), null, at('no image at all (Layout flag off: last_good absent)'))
  eq(row({}), null, at('an empty row'))
  eq(row({ thumbnail_url: null, last_good_thumbnail_url: null }), null, at('both null'))
  deep(row({ thumbnail_url: IMG(1), thumbnail_stale: true, last_good_thumbnail_url: IMG(3) }), { url: IMG(3), lag: 'content' }, at('a row flagged stale does not show its thumbnail_url as fresh (the rail\'s rule); the last good image is shown with the cue'))
  eq(row({ thumbnail_url: IMG(1), thumbnail_stale: true }), null, at('flagged stale and no last good image: none'))
  deep(row({ thumbnail_url: 'javascript:alert(1)', last_good_thumbnail_url: IMG(2) }), { url: IMG(2), lag: 'content' }, at('a non-http(s) thumbnail_url is not an image'))
  deep(row({ thumbnail_url: 'data:image/png;base64,AAAA', last_good_thumbnail_url: IMG(2) }), { url: IMG(2), lag: 'content' }, at('a data: URL is not an image'))
  eq(row({ thumbnail_url: 'not a url' }), null, at('an unparseable URL'))
  eq(row({ thumbnail_url: '   ' }), null, at('a blank URL'))
  eq(row({ thumbnail_url: 42 }), null, at('a non-string URL'))
  eq(row({ thumbnail_url: `https://cdn.example.invalid/${'a'.repeat(8200)}` }), null, at('an over-long URL'))
  eq(row({ last_good_thumbnail_url: 'ftp://cdn.example.invalid/a.png' }), null, at('last good over ftp'))
  deep(row({ thumbnail_url: `  ${IMG(1)}  ` }), { url: IMG(1), lag: null }, at('surrounding white space is trimmed from the URL'))
  deep(row({ thumbnail_url: 'http://cdn.example.invalid/a.png' }), { url: 'http://cdn.example.invalid/a.png', lag: null }, at('http is accepted as the rail accepts it'))
  for (const bad of [null, undefined, 'row', 7, [], [IMG(1)]]) eq(row(bad), null, at(`not a row: ${JSON.stringify(bad)}`))

  // ---- the body: THIS presentation's inventory, row 0 only
  const body = lib.deckCardThumbnailFromBody
  deep(body(inventory('d1', [{ thumbnail_url: IMG(1) }, { thumbnail_url: IMG(2) }]), 'd1'), { kind: 'image', thumbnail: { url: IMG(1), lag: null } }, at('slide 1\'s image'))
  deep(body(inventory('d1', [{ thumbnail_url: null, last_good_thumbnail_url: IMG(5), thumbnail_stale_reason: 'theme' }]), 'd1'), { kind: 'image', thumbnail: { url: IMG(5), lag: 'theme' } }, at('slide 1\'s last good image'))
  eq(body(inventory('d1', [{ thumbnail_url: null }, { thumbnail_url: IMG(2) }, { last_good_thumbnail_url: IMG(3) }]), 'd1').kind, 'fallback', at('slide 1 without an image never takes slide 2\'s or slide 3\'s'))
  eq(body(inventory('d1', [{ thumbnail_url: null }, { thumbnail_url: IMG(2) }]), 'd1').reason, 'no_url', at('the reason: no_url'))
  eq(body(inventory('d2', [{ thumbnail_url: IMG(1) }]), 'd1').kind, 'fallback', at('another presentation\'s inventory is refused'))
  eq(body(inventory('d1', []), 'd1').reason, 'no_row', at('no slides: no row 0'))
  eq(body({ presentation_id: 'd1', slides: 'x' }, 'd1').kind, 'fallback', at('slides that are not an array'))
  eq(body({ presentation_id: 'd1' }, 'd1').kind, 'fallback', at('no slides key'))
  eq(body(null, 'd1').kind, 'fallback', at('a null body'))
  eq(body([], 'd1').kind, 'fallback', at('an array body'))
  eq(body(inventory('d1', [null]), 'd1').kind, 'fallback', at('a null row 0'))

  // ---- the cue strings (FRONTEND-2's, copied: replace with the import from lib/studio-thumbnail-last-good.ts once #498 merges)
  eq(lib.THUMBNAIL_LAG_TEXT, 'May lag', at('visible cue text'))
  deep({ ...lib.THUMBNAIL_LAG_LABELS }, { content: 'Preview may not show recent edits', theme: 'Preview shows the previous theme' }, at('the two labels'))
  eq(lib.thumbnailLagLabel('theme'), 'Preview shows the previous theme', at('theme label'))
  eq(lib.thumbnailLagLabel('content'), 'Preview may not show recent edits', at('content label'))
  eq(lib.thumbnailLagLabel(null), 'Preview may not show recent edits', at('null reason: the content label'))
  eq(lib.thumbnailLagLabel(undefined), 'Preview may not show recent edits', at('absent reason: the content label'))
  eq(lib.thumbnailLagLabel('anything'), 'Preview may not show recent edits', at('unknown reason: the content label'))
  eq(lib.thumbnailLagReason('theme'), 'theme', at('reason theme'))
  eq(lib.thumbnailLagReason('Theme'), 'content', at('reason is case-sensitive'))

  // ---- the read
  eq(lib.deckCardInventoryUrl(LAYOUT, 'd 1/x'), `${LAYOUT}/api/presentations/d%201%2Fx/slides/inventory`, at('the inventory route, id encoded'))
  eq(lib.deckCardInventoryUrl(`${LAYOUT}///`, 'd1'), `${LAYOUT}/api/presentations/d1/slides/inventory`, at('trailing slashes trimmed, as the rail does'))
  eq(lib.DECK_CARD_THUMBNAIL_TIMEOUT_MS, 8000, at('the time limit is the Publish preview\'s 8 s'))
  const read = (fetchImpl, extra = {}) => lib.readDeckCardThumbnail({ getBaseUrl: () => LAYOUT, presentationId: 'd1', fetchImpl, timeoutMs: 40, ...extra })
  {
    const calls = []
    const result = await read((url, init) => { calls.push([url, init]); return Promise.resolve(response(200, inventory('d1', [{ thumbnail_url: IMG(1) }]))) })
    deep(result, { kind: 'image', thumbnail: { url: IMG(1), lag: null } }, at('a good answer is an image'))
    eq(calls.length, 1, at('one request'))
    eq(calls[0][0], `${LAYOUT}/api/presentations/d1/slides/inventory`, at('the request URL'))
    eq(calls[0][1].cache, 'no-store', at('no-store, as the rail reads'))
    ok(calls[0][1].signal && typeof calls[0][1].signal.aborted === 'boolean', at('with an abort signal'))
    eq(Object.keys(calls[0][1]).sort().join(','), 'cache,signal', at('nothing else is sent (no credentials, no headers)'))
  }
  for (const [name, fetchImpl, reason] of [
    ['a 404 (route absent)', () => Promise.resolve(response(404, {})), 'http_404'],
    ['a 500', () => Promise.resolve(response(500, {})), 'http_500'],
    ['a 401', () => Promise.resolve(response(401, {})), 'http_401'],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch')), 'network'],
    ['a synchronous throw from fetch', () => { throw new TypeError('boom') }, 'network'],
    ['a body that is not JSON', () => Promise.resolve(response(200, null, { badJson: true })), 'invalid_json'],
    ['another presentation\'s body', () => Promise.resolve(response(200, inventory('other', [{ thumbnail_url: IMG(1) }]))), 'invalid_inventory'],
    ['no slides', () => Promise.resolve(response(200, inventory('d1', []))), 'no_row'],
    ['a row without any image', () => Promise.resolve(response(200, inventory('d1', [{ thumbnail_url: null }]))), 'no_url'],
  ]) {
    const result = await read(fetchImpl)
    deep(result, { kind: 'fallback', reason }, at(`${name} is a fallback`))
  }
  {
    let fetched = 0
    const result = await lib.readDeckCardThumbnail({ getBaseUrl: () => { throw new Error('Layout service URL is not configured') }, presentationId: 'd1', fetchImpl: () => { fetched++; return Promise.resolve(response(200, {})) }, timeoutMs: 40 })
    deep(result, { kind: 'fallback', reason: 'no_layout_url' }, at('no configured Layout URL is a fallback'))
    eq(fetched, 0, at('and no request is made'))
  }
  {
    // a hung read that ignores the abort signal still ends at the time limit, with the signal aborted
    let signal = null
    const started = Date.now()
    const result = await Promise.race([read((url, init) => { signal = init.signal; return new Promise(() => {}) }), delay(1500).then(() => 'HUNG')])
    ok(result !== 'HUNG', at('a hung read ends'))
    deep(result, { kind: 'fallback', reason: 'timeout' }, at('a hung read is a timeout fallback'))
    ok(Date.now() - started < 1000, at('and ends at the limit, not later'))
    eq(signal && signal.aborted, true, at('the request is aborted at the limit'))
  }
  {
    // a read that honours the signal and rejects with AbortError is also a timeout
    const result = await Promise.race([read((url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))), delay(1500).then(() => 'HUNG')])
    deep(result, { kind: 'fallback', reason: 'timeout' }, at('an aborted read is a timeout fallback'))
  }
  {
    // the limit's timer is cleared once the read has answered
    const made = [], cleared = []
    const timers = { setTimeout: (fn, ms) => { const handle = setTimeout(fn, ms); made.push(handle); return handle }, clearTimeout: handle => { cleared.push(handle); clearTimeout(handle) } }
    const timed = loadLib(lib.__source, { timers })
    await timed.readDeckCardThumbnail({ getBaseUrl: () => LAYOUT, presentationId: 'd1', fetchImpl: () => Promise.resolve(response(200, inventory('d1', [{ thumbnail_url: IMG(1) }]))), timeoutMs: 5000 })
    eq(made.length, 1, at('one timer is started'))
    ok(cleared.length === 1 && cleared[0] === made[0], at('and that timer is cleared after the answer'))
  }

  // ---- one read per id (the store)
  {
    const store = lib.createDeckCardThumbnailStore()
    let reads = 0
    let release
    const slow = () => { reads++; return new Promise(resolve => { release = () => resolve({ kind: 'image', thumbnail: { url: IMG(1), lag: null } }); if (reads > 1) release() }) } // a read that is NOT the first answers at once, so a store that reads twice is counted, not hung
    eq(store.peek('a'), null, at('nothing is known before a read'))
    const first = store.request('a', slow), second = store.request('a', slow)
    eq(reads, 1, at('two asks while the read is in flight start ONE read'))
    release()
    deep(await first, { kind: 'image', thumbnail: { url: IMG(1), lag: null } }, at('the answer'))
    deep(await second, { kind: 'image', thumbnail: { url: IMG(1), lag: null } }, at('the same answer to the second asker'))
    deep(store.peek('a'), { kind: 'image', thumbnail: { url: IMG(1), lag: null } }, at('the answer is kept'))
    await store.request('a', slow)
    await store.request('a', slow)
    eq(reads, 1, at('later asks for the same id never read again'))
    await store.request('b', () => { reads++; return Promise.resolve({ kind: 'fallback', reason: 'http_500' }) })
    eq(reads, 2, at('another id is another read'))
    await store.request('b', () => { reads++; return Promise.resolve({ kind: 'image', thumbnail: { url: IMG(9), lag: null } }) })
    eq(reads, 2, at('a FAILED answer is kept too: no retry'))
    deep(store.peek('b'), { kind: 'fallback', reason: 'http_500' }, at('and it is still the failure'))
    deep(await store.request('c', () => { reads++; throw new Error('sync') }), { kind: 'fallback', reason: 'network' }, at('a read that throws is a fallback'))
    deep(await store.request('d', () => { reads++; return Promise.reject(new Error('async')) }), { kind: 'fallback', reason: 'network' }, at('a read that rejects is a fallback'))
    eq(reads, 4, at('and each ran once'))
    await store.request('c', slow); await store.request('d', slow)
    eq(reads, 4, at('and is kept'))
    store.markImageFailed('a')
    deep(store.peek('a'), { kind: 'fallback', reason: 'image_error' }, at('an image that did not load makes the id a fallback'))
    store.clear()
    eq(store.peek('a'), null, at('clear forgets'))
    await store.request('a', () => { reads++; return Promise.resolve({ kind: 'fallback', reason: 'x' }) })
    eq(reads, 5, at('and reads again after clear'))
  }

  // ---- first visibility
  {
    let made = 0, disconnects = 0, observed = []
    let notify = null
    class FakeObserver {
      constructor(callback, options) { made++; notify = callback; this.options = options }
      observe(target) { observed.push(target) }
      disconnect() { disconnects++ }
    }
    const el = { id: 'card' }
    let visible = 0
    const stop = lib.observeFirstVisibility(el, () => { visible++ }, FakeObserver)
    ok(typeof stop === 'function', at('a stopper'))
    eq(made, 1, at('one observer'))
    deep(observed, [el], at('watching the box'))
    eq(visible, 0, at('nothing before the card is seen'))
    notify([{ isIntersecting: false }]); eq(visible, 0, at('an entry that is not intersecting is not visibility'))
    notify([]); eq(visible, 0, at('no entries'))
    notify([{ isIntersecting: false }, { isIntersecting: true }]); eq(visible, 1, at('visible once an entry intersects'))
    eq(disconnects >= 1, true, at('and the observer stops watching'))
    notify([{ isIntersecting: true }]); notify([{ isIntersecting: true }]); eq(visible, 1, at('later entries never call again'))
    const early = lib.observeFirstVisibility(el, () => { visible++ }, FakeObserver)
    const before = disconnects
    early(); eq(disconnects > before, true, at('the stopper disconnects'))
    notify([{ isIntersecting: true }]); eq(visible, 1, at('after the stopper nothing is called'))
    eq(lib.observeFirstVisibility(el, () => {}, undefined), null, at('no IntersectionObserver: null'))
    eq(lib.observeFirstVisibility(null, () => {}, FakeObserver), null, at('no target: null'))
    eq(lib.observeFirstVisibility(el, () => {}, 'nope'), null, at('not a class: null'))
  }
}

// =========================================================== 1. the lib, as it is
const libSource = read(LIB)
const libFor = source => {
  const lib = loadLib(source)
  // the module constant, for a given environment value, from the text under test
  lib.__constantFor = value => loadLib(source, { env: value === undefined ? {} : { [FLAG]: value } }).STUDIO_DECK_CARD_THUMBNAILS_ENABLED
  lib.__source = source
  return lib
}
await proveLib(libFor(libSource), 'lib')
console.log(`PASS lib: ${checks} checks`)

// =========================================================== 2. the page pin
const pageText = read(DASHBOARD_PAGE)
const basePage = git('show', `${BASE_COMMIT}:${DASHBOARD_PAGE}`)
function provePage(page, label = 'page') {
  const at = text => `${label}: ${text}`
  const stripped = stripDeckCardThumbnail(DASHBOARD_PAGE, page)
  eq(sha(stripped), sha(basePage), at('flag-off identity: the Decks page without this change\'s lines is the base commit\'s, byte for byte'))
  ok(!stripped.includes(DECK_CARD_THUMBNAIL_MARKER), at('the stripped page carries no marker'))
  ok(!basePage.includes(DECK_CARD_THUMBNAIL_MARKER), at('the base page never carried the marker'))
  const marked = page.split('\n').filter(line => line.includes(DECK_CARD_THUMBNAIL_MARKER))
  eq(marked.length, 3, at('exactly three page lines are this change\'s: the import, the hook call, the early return'))
  // every changed or added page line carries the marker, and no base line is removed or changed (the diff against the base commit)
  const baseLines = basePage.split('\n'), have = new Map()
  for (const line of baseLines) have.set(line, (have.get(line) ?? 0) + 1)
  const added = []
  for (const line of page.split('\n')) { const n = have.get(line) ?? 0; if (n > 0) have.set(line, n - 1); else added.push(line) }
  ok(added.every(line => line.includes(DECK_CARD_THUMBNAIL_MARKER)), at(`every added line carries the marker (found unmarked: ${JSON.stringify(added.filter(line => !line.includes(DECK_CARD_THUMBNAIL_MARKER)))})`))
  eq(added.length, marked.length, at('and every marked line is an added one'))
  const left = [...have.values()].reduce((sum, n) => sum + n, 0)
  eq(left, 0, at('no base line is changed or removed'))
  // the order of the base lines is kept
  let next = 0
  for (const line of page.split('\n')) if (next < baseLines.length && line === baseLines[next]) next++
  eq(next, baseLines.length, at('the base lines are all there, in order'))
  // the card's title markup is exactly the base's (#497 marks the title box at runtime: no re-key, no replacement)
  const titleLine = baseLines.find(line => line.includes('<CardTitle className="text-lg line-clamp-1">'))
  ok(titleLine, at('the base has the title line'))
  eq(page.split('\n').filter(line => line === titleLine).length, 1, at('the title line is in the page once, exactly as the base has it'))
  ok(!titleLine.includes(DECK_CARD_THUMBNAIL_MARKER), at('and it carries no marker'))
  eq((page.match(/<CardTitle/g) ?? []).length, (basePage.match(/<CardTitle/g) ?? []).length, at('no second title node'))
  eq((page.match(/studioDeckTitleProps\(/g) ?? []).length, (basePage.match(/studioDeckTitleProps\(/g) ?? []).length, at('the title props are as they were'))
  nomatch(marked.join('\n'), /key=|CardTitle|studioDeckTitleProps|data-studio-deck-card-header/, at('no marked line touches a key or the title'))
  // the flag is read in the lib only; the page has the hook call and the early return, nothing else
  nomatch(page, new RegExp(`process\\.env\\.${FLAG}`), at('the page reads no flag'))
  match(marked[0], /^import \{ useStudioDeckCardThumbnail \} from "@\/hooks\/use-studio-deck-card-thumbnail" \/\/ DECK-CARD-THUMBNAIL/, at('the import'))
  match(marked[1], /^  const deckCardThumbnail = useStudioDeckCardThumbnail\(decision, deckTitle\(presentation\)\) \/\/ DECK-CARD-THUMBNAIL/, at('the hook call: the card\'s own decision and title'))
  eq(marked[2], '  if (deckCardThumbnail) return deckCardThumbnail // DECK-CARD-THUMBNAIL', at('the early return'))
  const lines = page.split('\n')
  const decisionAt = lines.findIndex(line => line.startsWith('  const decision = evaluateLayoutViewerUrl(')), hookAt = lines.indexOf(marked[1]), allowedAt = lines.findIndex(line => line === "  if (decision.status === 'allowed') {")
  ok(decisionAt >= 0 && hookAt === decisionAt + 1 && lines[hookAt + 1] === marked[2] && allowedAt > hookAt, at('the hook runs straight after the decision and before today\'s branches (hooks before any return)'))
}
provePage(pageText)

// the lib reads the flag once, exact "true", and the new files import no page
eq((libSource.match(new RegExp(`process\\.env\\.${FLAG}`, 'g')) ?? []).length, 1, 'lib: the flag is read once')
match(libSource, new RegExp(`process\\.env\\.${FLAG} === 'true'`), 'lib: exact "true"')
for (const rel of [LIB, HOOK, COMPONENT]) nomatch(read(rel).replace(/^\s*(\/\/|\*|\/\*).*$/gm, ''), /dashboard\/page|process\.env\.NEXT_PUBLIC_(?!STUDIO_DECK_CARD_THUMBNAILS_ENABLED)/, `${rel}: reads no other flag and imports no page`)
nomatch(read(HOOK) + read(COMPONENT), new RegExp(`process\\.env`), 'the hook and the component read no environment (the flag is the lib\'s)')
// the cue is scoped to the card's own attribute, never the rail's selector
match(read(CSS), /\[data-studio-deck-card-thumbnail\] \.studio-deck-card-lag-cue/, 'css: the cue is scoped to the card\'s own attribute')
nomatch(read(CSS).replace(/\/\*[\s\S]*?\*\//g, ''), /data-studio-thumbnail-strip|studio-thumbnail-lag-cue/, 'css: the rail\'s selectors are not reused (outside comments)')
nomatch(read(COMPONENT), /data-studio-thumbnail-lag|studio-thumbnail-lag-cue/, 'component: the rail\'s cue attribute and class are not reused')
match(read(COMPONENT), /loading="lazy" decoding="async"/, 'component: the image is lazy and async-decoded')
match(read(COMPONENT), /alt=\{title\}/, 'component: alt is the deck title')
match(read(COMPONENT), /src=\{url\}/, 'component: the URL is used as it is')
match(read(COMPONENT), /role="img" aria-label=\{thumbnailLagLabel\(lag\)\}/, 'component: the cue has an accessible label by reason')
match(read(COMPONENT), /\{lag \? \(/, 'component: no cue without lag')

// .env.example is left alone; the block is ready
{
  ok(!read('.env.example').includes(FLAG), '.env.example carries no trace of the flag (this change leaves it alone)')
  match(DECK_CARD_THUMBNAIL_ENV_BLOCK, new RegExp(`^# DECK CARD THUMBNAILS [\\s\\S]*\\n${FLAG}="false"\\n\\n$`), 'the ready-made block: its own flag, documented "false", a blank line after it')
  eq((DECK_CARD_THUMBNAIL_ENV_BLOCK.match(/^[A-Z][A-Z0-9_]*=/gm) ?? []).length, 1, 'the block assigns one variable')
  ok(DECK_CARD_THUMBNAIL_ENV_BLOCK.split('\n').filter(line => line.startsWith('#')).every(line => line.length <= 200), 'the block\'s comment lines are of the usual width')
}
// the strip module
{
  eq(stripDeckCardThumbnail('lib/other.ts', 'x // DECK-CARD-THUMBNAIL'), 'x // DECK-CARD-THUMBNAIL', 'any other file is returned as it is')
  eq(stripDeckCardThumbnail('.env.example', 'a\nb'), 'a\nb', '.env.example is returned as it is')
  eq(stripDeckCardThumbnail(DASHBOARD_PAGE, 'a\nb // DECK-CARD-THUMBNAIL\nc\n'), 'a\nc\n', 'a marked line goes, every other byte stays (trailing newline too)')
  eq(stripDeckCardThumbnail(DASHBOARD_PAGE, pageText), stripDeckCardThumbnail(DASHBOARD_PAGE, stripDeckCardThumbnail(DASHBOARD_PAGE, pageText)), 'stripping twice changes nothing more')
  deep(DECK_CARD_THUMBNAIL_FILES, [DASHBOARD_PAGE], 'the strip touches the Decks page only')
  ok(DECK_CARD_THUMBNAIL_NEW_FILES.every(rel => fs.existsSync(path.join(root, rel))), 'every new file listed exists')
  ok(DECK_CARD_THUMBNAIL_SCOPE_FILES.every(rel => fs.existsSync(path.join(root, rel))), 'every scope file listed exists')
  ok([HOOK, COMPONENT, CSS, LIB].every(rel => DECK_CARD_THUMBNAIL_NEW_FILES.includes(rel)), 'the code files are in the list')
  // a stray file of this change's family that the list does not name
  const family = ['lib', 'hooks', 'components', 'scripts'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(name => /deck-card-thumbnail/.test(name)).map(name => `${dir}/${name}`))
  deep(family.filter(rel => !DECK_CARD_THUMBNAIL_SCOPE_FILES.includes(rel)), [], 'no file of this change\'s family is missing from its list')
  // the committed change: every file in the list is in BASE..HEAD once committed (nothing to compare while the work is uncommitted)
  const changed = git('diff', '--name-only', BASE_COMMIT, 'HEAD').split('\n').filter(Boolean)
  if (changed.length) deep(DECK_CARD_THUMBNAIL_SCOPE_FILES.filter(rel => !changed.includes(rel)), [], 'every file of this change is in the committed diff')
}
// a secret scan of what this change adds: no 8+ character quoted literal assigned to a key/secret/token/password name, no user:pass@ in a URL
{
  const added = [HOOK, COMPONENT, CSS, LIB, 'scripts/studio-deck-card-thumbnail-strip.mjs', 'scripts/test-studio-deck-card-thumbnail.mjs', 'scripts/test-studio-deck-card-thumbnail-cards.mjs']
    .map(rel => read(rel)).concat(pageText.split('\n').filter(line => line.includes(DECK_CARD_THUMBNAIL_MARKER))).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, 'no credential-shaped literal in the added lines')
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, 'no user:pass@ in an added URL')
}
console.log(`PASS page pin and source pins: ${checks} checks`)

// =========================================================== 3. mutants
const killed = [], survived = []
async function mutant(name, run) {
  try { await run() } catch (error) { killed.push(name); return }
  survived.push(name)
}
const swapIn = (source, from, to) => { ok(source.includes(from), `mutant text exists: ${from.slice(0, 70)}`); return source.replace(from, () => to) }
const libMutant = (name, from, to) => mutant(`lib: ${name}`, async () => proveLib(libFor(swapIn(libSource, from, to)), name))
const pageMutant = (name, change) => mutant(`page: ${name}`, async () => provePage(change(pageText), name))

await libMutant('the flag rule loosened to anything set', "return value === 'true'", 'return Boolean(value)')
await libMutant('the module constant read as "not false"', `process.env.${FLAG} === 'true'`, `process.env.${FLAG} !== 'false'`)
await libMutant('a blocked decision gets an id', "if (!decision || decision.status !== 'allowed') return null", 'if (!decision) return null')
await libMutant('another origin gets an id', "if (!configuredOrigin || decision.origin !== configuredOrigin) return null", 'if (!configuredOrigin) return null')
await libMutant('the origin is not required', "if (!configuredOrigin || decision.origin !== configuredOrigin) return null", '')
await libMutant('a control character in the id allowed', "|| /[\\u0000-\\u001f\\u007f]/.test(id)", '')
await libMutant('a padded id allowed', "|| id !== id.trim()", '')
await libMutant('a long id allowed', "id.length > MAX_ID_LENGTH || ", '')
await libMutant('last good before thumbnail_url', "const fresh = row.thumbnail_stale === true ? null : safeUrl(row.thumbnail_url)\n  if (fresh) return { url: fresh, lag: null }\n  const lastGood = safeUrl(row.last_good_thumbnail_url)\n  return lastGood ? { url: lastGood, lag: thumbnailLagReason(row.thumbnail_stale_reason) } : null",
  "const lastGood = safeUrl(row.last_good_thumbnail_url)\n  if (lastGood) return { url: lastGood, lag: null }\n  const fresh = safeUrl(row.thumbnail_url)\n  return fresh ? { url: fresh, lag: null } : null")
await libMutant('the stale flag is ignored', "row.thumbnail_stale === true ? null : safeUrl(row.thumbnail_url)", 'safeUrl(row.thumbnail_url)')
await libMutant('the cue is never decided (lag always null)', "{ url: lastGood, lag: thumbnailLagReason(row.thumbnail_stale_reason) }", '{ url: lastGood, lag: null }')
await libMutant('the reason is always content', "{ url: lastGood, lag: thumbnailLagReason(row.thumbnail_stale_reason) }", "{ url: lastGood, lag: 'content' }")
await libMutant('a fresh image gets a cue', "if (fresh) return { url: fresh, lag: null }", "if (fresh) return { url: fresh, lag: 'content' }")
await libMutant('the protocol is not checked', "return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? trimmed : null", 'return trimmed')
await libMutant('an over-long URL accepted', "if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null", 'if (!trimmed) return null')
await libMutant('a URL is not trimmed', "return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? trimmed : null", "return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? value : null")
await libMutant('another presentation\'s body accepted', "if (!record(body) || body.presentation_id !== presentationId) return fallback('invalid_inventory')", "if (!record(body)) return fallback('invalid_inventory')")
await libMutant('the first slide with an image is taken', "const thumbnail = deckCardThumbnailFromRow(slides[0])", "const thumbnail = slides.map(deckCardThumbnailFromRow).find(Boolean) ?? null")
await libMutant('slide 2 is read', "const thumbnail = deckCardThumbnailFromRow(slides[0])", "const thumbnail = deckCardThumbnailFromRow(slides[1] ?? slides[0])")
await libMutant('an empty inventory is not refused', "if (!Array.isArray(slides) || slides.length === 0) return fallback('no_row')", "if (!Array.isArray(slides)) return fallback('no_row')")
await libMutant('the id is not encoded', "encodeURIComponent(presentationId)}/slides/inventory", "presentationId}/slides/inventory")
await libMutant('trailing slashes kept', "baseUrl.replace(/\\/+$/, '')", 'baseUrl')
await libMutant('the cache mode dropped', "{ cache: 'no-store', signal: abort?.signal }", '{ signal: abort?.signal }')
await libMutant('the abort signal dropped', "{ cache: 'no-store', signal: abort?.signal }", "{ cache: 'no-store' }")
await libMutant('credentials added', "{ cache: 'no-store', signal: abort?.signal }", "{ cache: 'no-store', credentials: 'include', signal: abort?.signal }")
await libMutant('no time limit', "return await Promise.race([read, limit])", 'return await read')
await libMutant('the limit does not abort the request', "timer = setTimeout(() => { abort?.abort(); resolve(fallback('timeout')) }, timeoutMs)", "timer = setTimeout(() => { resolve(fallback('timeout')) }, timeoutMs)")
await libMutant('the timer is never cleared', "if (timer !== undefined) clearTimeout(timer)", '')
await libMutant('a non-2xx answer is read', "if (!response.ok) return fallback(`http_${response.status}`)", '')
await libMutant('a bad body throws', "try { body = await response.json() } catch { return fallback('invalid_json') }", 'body = await response.json()')
await libMutant('a missing Layout URL throws', "try { baseUrl = getBaseUrl() } catch { return fallback('no_layout_url') }", 'baseUrl = getBaseUrl()')
await libMutant('a network error throws', "} catch (error) {\n      return fallback(record(error) && error.name === 'AbortError' ? 'timeout' : 'network')\n    }", '} finally {}')
await libMutant('the store does not share an in-flight read', "const pending = inFlight.get(presentationId)\n      if (pending) return pending\n", '')
await libMutant('the store does not keep an answer', "settled.set(presentationId, result)\n        inFlight.delete(presentationId)", 'inFlight.delete(presentationId)')
await libMutant('the store does not keep a failure', "settled.set(presentationId, result)", "if (result.kind === 'image') settled.set(presentationId, result)")
await libMutant('the store forgets after peeking', "peek(presentationId: string): DeckCardThumbnailResult | null {\n      return settled.get(presentationId) ?? null", "peek(presentationId: string): DeckCardThumbnailResult | null {\n      const kept = settled.get(presentationId) ?? null\n      settled.delete(presentationId)\n      return kept")
await libMutant('a throwing read is not caught', "try { started = Promise.resolve(read()) } catch { started = Promise.resolve(fallback('network')) }", 'started = Promise.resolve(read())')
await libMutant('a rejected read is not caught', "started.catch(() => fallback('network')).then(", 'started.then(')
await libMutant('a failed image is not remembered', "settled.set(presentationId, fallback('image_error'))", '')
await libMutant('the observer fires on a card that is not visible', "if (done || !entries.some(entry => entry.isIntersecting)) return", 'if (done) return')
await libMutant('the observer fires more than once', "if (done || !entries.some(entry => entry.isIntersecting)) return\n    done = true", "if (!entries.some(entry => entry.isIntersecting)) return")
await libMutant('the observer keeps watching', "    observer.disconnect()\n    onVisible()", '    onVisible()')
await libMutant('no observer still reads', "if (!target || typeof ObserverClass !== 'function') return null", "if (!target) return () => {}")
await libMutant('the stopper does nothing', "return () => { done = true; observer.disconnect() }", 'return () => {}')
await libMutant('the lag text changed', "export const THUMBNAIL_LAG_TEXT = 'May lag'", "export const THUMBNAIL_LAG_TEXT = 'Out of date'")
await libMutant('the labels swapped', "content: 'Preview may not show recent edits',\n  theme: 'Preview shows the previous theme',", "content: 'Preview shows the previous theme',\n  theme: 'Preview may not show recent edits',")
await libMutant('the reason is case-insensitive', "return value === 'theme' ? 'theme' : 'content'", "return String(value).toLowerCase() === 'theme' ? 'theme' : 'content'")
await libMutant('the time limit changed', 'export const DECK_CARD_THUMBNAIL_TIMEOUT_MS = 8_000', 'export const DECK_CARD_THUMBNAIL_TIMEOUT_MS = 30_000')

// the page
await pageMutant('a marker taken off the hook call', page => swapIn(page, 'deckTitle(presentation)) // DECK-CARD-THUMBNAIL', 'deckTitle(presentation)) //'))
await pageMutant('a marker taken off the import', page => swapIn(page, '"@/hooks/use-studio-deck-card-thumbnail" // DECK-CARD-THUMBNAIL', '"@/hooks/use-studio-deck-card-thumbnail" //'))
await pageMutant('an unmarked line added', page => swapIn(page, '  if (deckCardThumbnail) return deckCardThumbnail // DECK-CARD-THUMBNAIL\n', '  if (deckCardThumbnail) return deckCardThumbnail // DECK-CARD-THUMBNAIL\n  const extra = 1\n'))
await pageMutant('a base line changed', page => swapIn(page, 'className="w-full h-full pointer-events-none"', 'className="w-full h-full"'))
await pageMutant('a base line removed', page => swapIn(page, '        loading="lazy"\n', ''))
await pageMutant('the title line re-keyed', page => swapIn(page, '<CardTitle className="text-lg line-clamp-1"><Link href={href}', '<CardTitle key={presentation.id} className="text-lg line-clamp-1"><Link href={href}'))
await pageMutant('the title line replaced', page => swapIn(page, '<CardTitle className="text-lg line-clamp-1">', '<CardTitle className="text-lg line-clamp-2">'))
await pageMutant('the title line marked', page => swapIn(page, '<CardTitle className="text-lg line-clamp-1">', '<CardTitle className="text-lg line-clamp-1"> {/* DECK-CARD-THUMBNAIL */}'))
await pageMutant('the early return dropped', page => swapIn(page, '  if (deckCardThumbnail) return deckCardThumbnail // DECK-CARD-THUMBNAIL\n', ''))
await pageMutant('the hook called after the iframe branch (a conditional hook)', page => {
  const hook = "  const deckCardThumbnail = useStudioDeckCardThumbnail(decision, deckTitle(presentation)) // DECK-CARD-THUMBNAIL: null with the flag off, and whenever today's preview is to be drawn\n  if (deckCardThumbnail) return deckCardThumbnail // DECK-CARD-THUMBNAIL\n"
  return swapIn(swapIn(page, hook, ''), '  return (\n    <div className="relative h-full w-full">\n', `${hook}  return (\n    <div className="relative h-full w-full">\n`)
})
await pageMutant('the flag read in the page', page => swapIn(page, '  if (deckCardThumbnail) return deckCardThumbnail // DECK-CARD-THUMBNAIL\n', `  if (process.env.${FLAG} === "true" && deckCardThumbnail) return deckCardThumbnail // DECK-CARD-THUMBNAIL\n`))
await pageMutant('the hook gets the stored title', page => swapIn(page, 'useStudioDeckCardThumbnail(decision, deckTitle(presentation))', 'useStudioDeckCardThumbnail(decision, presentation.title)'))

// the strip itself: a different rule must not give the base back
const stripIs = fn => () => eq(sha(fn(pageText)), sha(basePage), 'strip')
await mutant('strip: leaves the marked lines', stripIs(text => text))
await mutant('strip: also removes an unmarked line', stripIs(text => text.split('\n').filter(line => !line.includes('DECK-CARD-THUMBNAIL') && !line.includes('loading="lazy"')).join('\n')))
await mutant('strip: removes only the first marked line', stripIs(text => { const lines = text.split('\n'), at = lines.findIndex(line => line.includes('DECK-CARD-THUMBNAIL')); lines.splice(at, 1); return lines.join('\n') }))
await mutant('strip: drops the trailing newline', stripIs(text => stripDeckCardThumbnail(DASHBOARD_PAGE, text).replace(/\n$/, '')))
await mutant('strip: joins with a different line end', stripIs(text => text.split('\n').filter(line => !line.includes('DECK-CARD-THUMBNAIL')).join('\r\n')))
await mutant('strip: a looser marker', stripIs(text => text.split('\n').filter(line => !line.includes('DECK-CARD')).join('\n') + 'x'))

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.error(`SURVIVED:\n  ${survived.join('\n  ')}`); process.exit(1) }
console.log(`test-studio-deck-card-thumbnail: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
