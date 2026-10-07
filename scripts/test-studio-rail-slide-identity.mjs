// F8 / S-03 (frontend half): Studio slide rail keyed by slide_id, read from Layout's slide inventory.
// Run: node scripts/test-studio-rail-slide-identity.mjs   (plain node: transpile + vm, no network)
// Fixtures: scripts/fixtures/f8-slide-inventory/*.json = the contract v1.1 F8-fixtures (real loopback replay output)
// with the `<project>` placeholder host replaced by `proj` (a valid host). Every fetch is mocked.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const fixture = name => JSON.parse(read(`scripts/fixtures/f8-slide-inventory/${name}.json`))
function compile(text, require, extras = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText, { module, exports: module.exports, require, URL, AbortController, Map, Set, JSON, Date, Number, Object, Array, Promise, Error, encodeURIComponent, ...extras })
  return module.exports
}
const libWith = env => compile(read('lib/slide-rail-identity.ts'), () => { throw Error('unexpected import') },
  { process: { env }, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout })
const lib = libWith({})
const plain = value => JSON.parse(JSON.stringify(value))
// Values built inside the vm sandbox have another realm's prototypes: compare their JSON form.
const same = (actual, expected, message) => message === undefined
  ? assert.deepStrictEqual(plain(actual), plain(expected))
  : assert.deepStrictEqual(plain(actual), plain(expected), message)
let checks = 0
function check(name, action) {
  try {
    const result = action()
    if (result && typeof result.then === 'function') return result.then(() => { checks++; console.log(`PASS ${name}`) })
  } catch (error) { console.error(`FAIL ${name}`); throw error }
  checks++; console.log(`PASS ${name}`)
}

const PID = 'f8-replay-on'
const afterInsert = fixture('inventory-after-insert')
const afterReload = fixture('inventory-after-reload')
const afterDeleteAppend = fixture('inventory-after-delete-and-append')
const ackReorder = fixture('ack-reorder').response
const ackAdd = fixture('ack-add').response
const ackDelete = fixture('ack-delete').response
const ids = inventory => inventory.slides.map(slide => slide.slide_id)
// The same four slides in another order (inventory rows keep their own previews and versions).
const inOrder = (inventory, order) => ({ ...plain(inventory), slides: order.map((id, index) => ({
  ...plain(inventory).slides.find(slide => slide.slide_id === id), slide_index: index })) })
// Real replay: the Add ack appends N at the end; the reorder ack then moves it to position 3 (the post-insert fixtures).
const A = 'slide_8ea0a04600cf', B = 'slide_51f6389579d6', N = 'slide_f9561e229c9a', C = 'slide_d960ba5dbd63'
const APPENDED = [A, B, C, N]
const MOVED = [A, B, N, C]
// What a v1 backend answers: no `title`, no `thumbnail_status`. `untitled` keeps the status and blanks the title.
const untitled = inventory => ({ ...plain(inventory), slides: plain(inventory).slides.map(slide => ({ ...slide, title: null })) })
const v1Of = inventory => ({ ...plain(inventory), slides: plain(inventory).slides.map(({ title, thumbnail_status, ...rest }) => rest) })
const afterEdit = fixture('inventory-after-edit')
const afterManualAdd = fixture('inventory-after-manual-add')
const appendBeforeRegistration = fixture('inventory-append-before-registration')

// ---------------------------------------------------------------- flag
check('flag defaults off and only the exact string true turns it on', () => {
  assert.equal(lib.STUDIO_RAIL_SLIDE_IDENTITY_ENABLED, false)
  for (const value of ['', 'TRUE', 'True', '1', 'yes', ' true', 'false']) {
    assert.equal(libWith({ NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED: value }).STUDIO_RAIL_SLIDE_IDENTITY_ENABLED, false, value)
  }
  assert.equal(libWith({ NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED: 'true' }).STUDIO_RAIL_SLIDE_IDENTITY_ENABLED, true)
})

// ---------------------------------------------------------------- contract shape
check('contract fixtures parse: identity, order, count and previews', () => {
  const inventory = lib.parseSlideInventory(afterInsert, PID)
  assert.equal(inventory.slideCount, 4)
  same(inventory.slides.map(row => row.slideId), ids(afterInsert))
  same(inventory.slides.map(row => row.slideIndex), [0, 1, 2, 3])
  assert.ok(inventory.slides.every(row => /^https:\/\/proj\.supabase\.co\/.+\.png$/.test(row.thumbnailUrl)))
  assert.ok(inventory.slides.every(row => row.thumbnailStale === false && row.thumbnailStatus === 'fresh'))
  same(inventory.slides.map(row => row.title), afterInsert.slides.map(slide => slide.title))
  assert.ok(inventory.slides.every(row => typeof row.title === 'string' && row.title.length > 0))
  assert.equal(inventory.slides[0].layout, 'H2')
})
check('acks carry the full post-mutation order, and the inventory agrees with the last one', () => {
  same(ackAdd.slide_ids, APPENDED)
  assert.equal(ackAdd.slide_count, 4)
  same(ackReorder.slide_ids, MOVED)
  assert.equal(ackReorder.slide_count, 4)
  assert.equal(ackDelete.slide_count, 3)
  assert.equal(ackDelete.slide_ids.length, 3)
  same(ids(afterInsert), ackReorder.slide_ids)
  same(ids(afterReload), ackReorder.slide_ids)
})
check('rejects anything that is not an identity-bearing inventory of this presentation', () => {
  const base = plain(afterInsert)
  const bad = mutate => { const copy = plain(base); mutate(copy); return lib.parseSlideInventory(copy, PID) }
  assert.ok(lib.parseSlideInventory(base, PID))
  assert.equal(lib.parseSlideInventory(base, 'another-deck'), null, 'ABA: another presentation')
  assert.equal(lib.parseSlideInventory(null, PID), null)
  assert.equal(lib.parseSlideInventory([], PID), null)
  assert.equal(lib.parseSlideInventory({ detail: 'Method Not Allowed' }, PID), null)
  assert.equal(bad(inv => { inv.slide_count = 5 }), null, 'count must equal slides.length')
  assert.equal(bad(inv => { inv.slides[1].slide_id = inv.slides[0].slide_id }), null, 'duplicate id')
  assert.equal(bad(inv => { inv.slides[2].slide_id = null }), null, 'missing id (legacy slide)')
  assert.equal(bad(inv => { inv.slides[2].slide_id = '' }), null)
  assert.equal(bad(inv => { inv.slides[2].slide_index = 5 }), null, 'index must be the array position')
  assert.equal(bad(inv => { delete inv.slides[2].slide_index }) !== null, true, 'index is optional')
})
check('a stale or unsafe preview is never shown; the read still answers', () => {
  const copy = plain(afterInsert)
  copy.slides[0].thumbnail_url = null; copy.slides[0].thumbnail_stale = true
  copy.slides[1].thumbnail_url = 'https://proj.supabase.co/slide-qa/old.png'; copy.slides[1].thumbnail_stale = true
  copy.slides[2].thumbnail_url = 'javascript:alert(1)'
  copy.slides[3].thumbnail_url = 'data:image/png;base64,AAAA'
  const inventory = lib.parseSlideInventory(copy, PID)
  same(inventory.slides.map(row => row.thumbnailUrl), [null, null, null, null])
  same(inventory.slides.map(row => row.thumbnailStale), [true, true, false, false])
  same(inventory.slides.map(row => row.thumbnailStatus), ['stale', 'stale', 'none', 'none'], 'an unusable URL on a "fresh" row shows nothing, and says so')
  const rows = lib.buildRailRows(inventory, new Map())
  assert.ok(rows.every(row => !('thumbnailUrl' in row)))
})

// ---------------------------------------------------------------- rows
check('rows follow inventory order, keyed by slide_id, with the previews of those ids', () => {
  const rows = lib.buildRailRows(lib.parseSlideInventory(afterInsert, PID), new Map())
  same(rows.map(row => row.slideId), ids(afterInsert))
  same(rows.map(row => row.slideNumber), [1, 2, 3, 4])
  same(rows.map(row => row.slideIndex), [0, 1, 2, 3])
  same(rows.map(row => row.actualSlideIndex), [0, 1, 2, 3])
  same(rows.map(row => row.thumbnailUrl), afterInsert.slides.map(slide => slide.thumbnail_url))
  same(rows.map(row => row.title), afterInsert.slides.map(slide => slide.title), 'titles come from the inventory')
  same(rows.map(row => row.thumbnailStatus), ['fresh', 'fresh', 'fresh', 'fresh'])
  const bare = lib.buildRailRows(lib.parseSlideInventory(untitled(afterInsert), PID), new Map())
  same(bare.map(row => row.title), ['Slide 1', 'Slide 2', 'Slide 3', 'Slide 4'], 'null titles and no memory: "Slide N"')
})
check('reorder keeps identity: every slide_id keeps its preview and title, only the position moves', () => {
  const appended = lib.parseSlideInventory(untitled(inOrder(afterInsert, APPENDED)), PID)   // after the Add ack
  const moved = lib.parseSlideInventory(untitled(inOrder(afterInsert, MOVED)), PID)         // after the reorder ack
  const titles = new Map(appended.slides.map(row => [row.slideId, `Title ${row.slideId.slice(-4)}`]))
  const byId = rows => Object.fromEntries(rows.map(row => [row.slideId, [row.title, row.thumbnailUrl]]))
  const rowsBefore = lib.buildRailRows(appended, titles), rowsAfter = lib.buildRailRows(moved, titles)
  same(byId(rowsAfter), byId(rowsBefore))
  same(rowsBefore.map(row => row.slideId), APPENDED)
  same(rowsAfter.map(row => row.slideId), MOVED)
  same(rowsAfter.map(row => row.slideNumber), [1, 2, 3, 4])
  assert.equal(rowsAfter[2].slideId, N)
  assert.equal(rowsAfter[2].thumbnailUrl, afterInsert.slides[2].thumbnail_url)
  // With inventory titles the same holds without any memory.
  const titled = rows => Object.fromEntries(rows.map(row => [row.slideId, [row.title, row.thumbnailUrl]]))
  same(titled(lib.buildRailRows(lib.parseSlideInventory(inOrder(afterInsert, MOVED), PID), new Map())),
    titled(lib.buildRailRows(lib.parseSlideInventory(inOrder(afterInsert, APPENDED), PID), new Map())))
})
check('delete then append: each slide shows its own capture, not an index-carried one', () => {
  const rows = lib.buildRailRows(lib.parseSlideInventory(afterDeleteAppend, PID), new Map())
  const before = lib.buildRailRows(lib.parseSlideInventory(afterInsert, PID), new Map())
  const urlOf = (list, id) => list.find(row => row.slideId === id)?.thumbnailUrl
  assert.equal(urlOf(rows, B), urlOf(before, B))
  assert.equal(urlOf(rows, N), urlOf(before, N))
  assert.equal(urlOf(rows, C), urlOf(before, C))
  assert.notEqual(urlOf(rows, 'slide_04abaf0e7ad8'), urlOf(rows, C))
  assert.equal(new Set(rows.map(row => row.thumbnailUrl)).size, 4)
})
check('title: the inventory wins; null falls back to the remembered (Director) title, then "Slide N"', () => {
  const copy = plain(afterInsert); copy.slides[1].title = 'Backend title'; copy.slides[2].title = null; copy.slides[3].title = null
  const memory = new Map([[B, 'Remembered B'], [N, 'Remembered N']])
  const rows = lib.buildRailRows(lib.parseSlideInventory(copy, PID), memory)
  same(rows.map(row => row.title), [afterInsert.slides[0].title, 'Backend title', 'Remembered N', 'Slide 4'])
  // The remembered title never overrides a present inventory title.
  assert.equal(rows[1].title, 'Backend title')
})
check('title: sanitised on read (plain text, at most 200 characters, never a "Slide N" label)', () => {
  const copy = plain(afterInsert)
  copy.slides[0].title = '  Spaced  '; copy.slides[1].title = 'x'.repeat(201); copy.slides[2].title = 'Slide 7'; copy.slides[3].title = 42
  same(lib.parseSlideInventory(copy, PID).slides.map(row => row.title), ['Spaced', null, null, null])
  delete copy.slides[0].title
  assert.equal(lib.parseSlideInventory(copy, PID).slides[0].title, null, 'an absent key reads as null')
  copy.slides[0].title = 'y'.repeat(200)
  assert.equal(lib.parseSlideInventory(copy, PID).slides[0].title.length, 200)
})
check('thumbnail_status: each of fresh, stale, pending, none maps to the row and drives the preview', () => {
  const parse = inventory => lib.parseSlideInventory(inventory, PID)
  const manual = parse(afterManualAdd), edited = parse(afterEdit), pending = parse(appendBeforeRegistration)
  same(manual.slides.map(row => row.thumbnailStatus), ['fresh', 'fresh', 'fresh', 'fresh', 'stale', 'none'])
  same(edited.slides.map(row => row.thumbnailStatus), ['fresh', 'fresh', 'fresh', 'fresh', 'stale'])
  same(pending.slides.map(row => row.thumbnailStatus), ['fresh', 'fresh', 'fresh', 'fresh', 'pending'])
  // fresh = the URL; stale, pending and none = no URL (the rail never shows a stale or absent image).
  assert.ok(manual.slides.slice(0, 4).every(row => row.thumbnailUrl))
  assert.ok([manual.slides[4], manual.slides[5], pending.slides[4]].every(row => row.thumbnailUrl === null))
  assert.equal(manual.slides[4].thumbnailStale, true)
  assert.equal(pending.slides[4].thumbnailStale, false); assert.equal(manual.slides[5].thumbnailStale, false)
  const rows = lib.buildRailRows(manual, new Map())
  same(rows.map(row => row.thumbnailStatus), ['fresh', 'fresh', 'fresh', 'fresh', 'stale', 'none'])
  same(rows.map(row => 'thumbnailUrl' in row), [true, true, true, true, false, false])
  same(lib.buildRailRows(pending, new Map()).map(row => row.thumbnailStatus), ['fresh', 'fresh', 'fresh', 'fresh', 'pending'])
})
check('title null on a stock manual slide shows "Slide N"; an edited one shows its text', () => {
  const rows = lib.buildRailRows(lib.parseSlideInventory(afterManualAdd, PID), new Map())
  assert.equal(afterManualAdd.slides[5].title, null)
  assert.equal(rows[5].title, 'Slide 6')
  assert.equal(rows[4].title, 'Added and then edited')
})
check('a v1 backend (no title, no thumbnail_status) still works: status derived from URL and stale flag, never pending', () => {
  const v1 = lib.parseSlideInventory(v1Of(afterManualAdd), PID)
  same(v1.slides.map(row => row.thumbnailStatus), ['fresh', 'fresh', 'fresh', 'fresh', 'stale', 'none'])
  assert.ok(v1.slides.every(row => row.title === null))
  const odd = plain(afterInsert); odd.slides[0].thumbnail_status = 'sparkly'; odd.slides[0].thumbnail_url = null
  assert.equal(lib.parseSlideInventory(odd, PID).slides[0].thumbnailStatus, 'none', 'an unknown status is "none"')
})

// ---------------------------------------------------------------- titles by identity
check('titles are learned only from an aligned structure and follow slide_id through insert, reorder, delete', () => {
  const bare = untitled(afterInsert) // the memory path is for rows whose inventory title is null
  const initial = lib.parseSlideInventory({ ...plain(bare), slide_count: 3, slides: plain(bare).slides
    .filter(slide => slide.slide_id !== N).map((slide, index) => ({ ...slide, slide_index: index })) }, PID)
  const structure = [{ title: 'Opening' }, { title: 'Market' }, { slide_type: 'closing' }]
  let memory = lib.learnRailTitles(new Map(), initial, structure)
  same([...memory], [[A, 'Opening'], [B, 'Market'], [C, 'closing']])
  // Insert in the middle: the structure is no longer trusted (the caller passes null after native CRUD).
  const inserted = lib.parseSlideInventory(bare, PID)
  memory = lib.learnRailTitles(memory, inserted, null)
  const rows = lib.buildRailRows(inserted, memory)
  same(rows.map(row => row.title), ['Opening', 'Market', 'Slide 3', 'closing'])
  // A count-mismatched structure never teaches (it would be an index carry-over).
  assert.equal(lib.learnRailTitles(memory, inserted, structure), memory)
  // Reorder (N moves to the end): titles follow the ids.
  const appended = lib.parseSlideInventory(untitled(inOrder(afterInsert, APPENDED)), PID)
  same(lib.buildRailRows(appended, memory).map(row => row.title), ['Opening', 'Market', 'closing', 'Slide 4'])
  // Delete drops the deleted slide's entry.
  const afterDelete = lib.parseSlideInventory(untitled(afterDeleteAppend), PID)
  const pruned = lib.learnRailTitles(memory, afterDelete, null)
  assert.equal(pruned.has(A), false)
  assert.equal(pruned.get(B), 'Market')
})
check('placeholder titles are never remembered', () => {
  const inventory = lib.parseSlideInventory(afterInsert, PID)
  const memory = lib.learnRailTitles(new Map(), inventory, [{ title: 'Slide 1' }, { title: ' ' }, { title: 'x'.repeat(300) }, {}])
  assert.equal(memory.size, 0)
})
check('title memory round-trips per owner and deck, expires, and refuses foreign or hostile data', () => {
  const memory = new Map([['slide_a', 'One'], ['slide_b', 'Two']])
  const raw = lib.serializeRailTitles(memory, 'owner-a', PID, 1000)
  same([...lib.restoreRailTitles(raw, 'owner-a', PID, 2000)], [...memory])
  assert.equal(lib.restoreRailTitles(raw, 'owner-b', PID, 2000).size, 0, 'other account')
  assert.equal(lib.restoreRailTitles(raw, 'owner-a', 'other-deck', 2000).size, 0, 'other deck')
  assert.equal(lib.restoreRailTitles(raw, 'owner-a', PID, 1000 + lib.RAIL_TITLES_CACHE_TTL + 1).size, 0, 'expired')
  assert.equal(lib.restoreRailTitles(raw, 'owner-a', PID, 10).size, 0, 'clock before save')
  assert.equal(lib.restoreRailTitles('{not json', 'owner-a', PID).size, 0)
  assert.equal(lib.restoreRailTitles(null, 'owner-a', PID).size, 0)
  const hostile = JSON.stringify({ version: 1, ownerUserId: 'owner-a', presentationId: PID, savedAt: 1000,
    titles: JSON.parse('{"__proto__":"polluted","ok":"Fine","bad":42,"":"empty"}') })
  const restored = lib.restoreRailTitles(hostile, 'owner-a', PID, 2000)
  assert.equal(restored.get('ok'), 'Fine')
  assert.equal(restored.size, 2, 'non-string and empty ids dropped; __proto__ is just a Map key')
  assert.equal(restored.get('__proto__'), 'polluted')
  assert.equal({}.polluted, undefined)
  assert.equal(Object.getPrototypeOf({}), Object.prototype)
  assert.equal(lib.serializeRailTitles(new Map(), 'owner-a', PID), null)
  assert.equal(lib.railTitlesStorageKey('', PID), null)
  assert.equal(lib.railTitlesStorageKey('owner-a', ' deck'), null)
})

// ---------------------------------------------------------------- feature detection / reader
function response(status, body) {
  return { status, ok: status >= 200 && status < 300, async json() { if (body === undefined) throw Error('bad json'); return body } }
}
await check('reader: exact path, no-store, one GET', async () => {
  const calls = []
  const result = await lib.fetchSlideInventory({ baseUrl: 'https://layout.example.test/', presentationId: PID,
    fetchImpl: async (url, init) => { calls.push([url, init]); return response(200, afterInsert) } })
  assert.equal(result.kind, 'ok')
  same(plain(calls), [[`https://layout.example.test/api/presentations/${PID}/slides/inventory`, { cache: 'no-store' }]])
  const odd = await lib.fetchSlideInventory({ baseUrl: 'https://layout.example.test', presentationId: 'a/b c', fetchImpl: async url => { calls.push([url]); return response(404) } })
  assert.equal(odd.kind, 'unavailable')
  assert.equal(calls.at(-1)[0], 'https://layout.example.test/api/presentations/a%2Fb%20c/slides/inventory')
})
await check('reader: 404 and 405 (backend flag off) are "unavailable", never an error', async () => {
  for (const status of [404, 405]) {
    const result = await lib.fetchSlideInventory({ baseUrl: 'https://l.test', presentationId: PID, fetchImpl: async () => response(status, { detail: 'x' }) })
    same(plain(result), { kind: 'unavailable', reason: `http_${status}` })
  }
})
await check('reader: invalid JSON or a wrong shape is "unavailable"; 5xx, 401, network and abort are transient "failed"', async () => {
  const read = fetchImpl => lib.fetchSlideInventory({ baseUrl: 'https://l.test', presentationId: PID, fetchImpl })
  assert.equal((await read(async () => response(200, undefined))).kind, 'unavailable')
  assert.equal((await read(async () => response(200, '<html>spa</html>'))).kind, 'unavailable')
  assert.equal((await read(async () => response(200, { presentation_id: PID, slide_count: 1, slides: [{ slide_id: null }] }))).kind, 'unavailable')
  for (const status of [401, 403, 500, 503]) assert.equal((await read(async () => response(status, {}))).kind, 'failed', String(status))
  assert.equal((await read(async () => { throw new TypeError('Failed to fetch') })).kind, 'failed')
  const aborted = await read(async () => { const e = new Error('x'); e.name = 'AbortError'; throw e })
  same(plain(aborted), { kind: 'failed', reason: 'AbortError' })
})

// ---------------------------------------------------------------- controller (fake clock)
function clock() {
  let time = 0, nextId = 1
  const timers = new Map()
  return {
    now: () => time,
    setTimer(fn, ms) { const id = nextId++; timers.set(id, { at: time + ms, fn }); return id },
    clearTimer(id) { timers.delete(id) },
    async advance(ms) {
      const end = time + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        time = due[1].at; timers.delete(due[0]); due[1].fn()
        for (let i = 0; i < 10; i++) await Promise.resolve()
      }
      time = end
      for (let i = 0; i < 10; i++) await Promise.resolve()
    },
    pending: () => timers.size,
  }
}
function controllerHarness({ responses, baseUrl = () => 'https://l.test' }) {
  const c = clock(), calls = [], states = []
  const queue = [...responses]
  const controller = lib.createSlideInventoryController({
    presentationId: PID, getBaseUrl: baseUrl, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer,
    fetchImpl: async (url, init) => {
      calls.push(url)
      const next = queue.length > 1 ? queue.shift() : queue[0]
      if (typeof next === 'function') return next(init)
      return next
    },
    onChange: state => states.push(state),
  })
  return { controller, c, calls, states }
}
await check('controller: a burst of triggers is one coalesced read', async () => {
  const h = controllerHarness({ responses: [response(200, afterInsert)] })
  h.controller.refresh(); h.controller.refresh(); h.controller.refresh()
  await h.c.advance(149); assert.equal(h.calls.length, 0)
  await h.c.advance(2); assert.equal(h.calls.length, 1)
  assert.equal(h.controller.getState().status, 'ready')
  assert.equal(h.controller.getState().inventory.slideCount, 4)
})
await check('controller: an ack that lands during an in-flight read is not lost (one follow-up read)', async () => {
  let release
  const slow = () => new Promise(resolve => { release = () => resolve(response(200, afterReload)) })
  const h = controllerHarness({ responses: [slow, response(200, afterInsert)] })
  h.controller.refresh(); await h.c.advance(200)
  assert.equal(h.calls.length, 1)
  h.controller.refresh(); await h.c.advance(200)         // ack arrives mid-read
  assert.equal(h.calls.length, 1, 'never two concurrent reads')
  release(); for (let i = 0; i < 20; i++) await Promise.resolve()
  await h.c.advance(10)
  assert.equal(h.calls.length, 2)
  assert.equal(h.controller.getState().status, 'ready')
})
await check('controller: refresh(true) (a structural ack) reads at once; the debounced path still waits', async () => {
  const h = controllerHarness({ responses: [response(200, afterInsert), response(200, afterReload)] })
  h.controller.refresh(true)
  await h.c.advance(0)
  assert.equal(h.calls.length, 1, 'no debounce for an ack')
  assert.equal(h.controller.getState().status, 'ready')
  h.controller.refresh(); h.controller.refresh(true)           // a pending debounced read is replaced by the immediate one
  await h.c.advance(0); assert.equal(h.calls.length, 2)
  await h.c.advance(500); assert.equal(h.calls.length, 2, 'the cancelled debounce timer never fires a third read')
})
const pendingInventory = () => response(200, appendBeforeRegistration)
const registeredInventory = (() => {
  // The same deck once Stage F has registered the last slide (derived from the pending fixture: that row gets a fresh URL).
  const copy = plain(appendBeforeRegistration)
  copy.slides[4].thumbnail_url = afterInsert.slides[0].thumbnail_url; copy.slides[4].thumbnail_status = 'fresh'
  return copy
})()
await check('controller: a pending preview is re-read on a short timer and the poll stops once it is fresh', async () => {
  const h = controllerHarness({ responses: [pendingInventory(), pendingInventory(), response(200, registeredInventory)] })
  h.controller.refresh(true); await h.c.advance(0)
  assert.equal(h.calls.length, 1); assert.equal(h.controller.getState().inventory.slides[4].thumbnailStatus, 'pending')
  await h.c.advance(2999); assert.equal(h.calls.length, 1)
  await h.c.advance(2); assert.equal(h.calls.length, 2, 're-read after 3 s')
  await h.c.advance(3000); assert.equal(h.calls.length, 3)
  assert.equal(h.controller.getState().inventory.slides[4].thumbnailStatus, 'fresh')
  assert.equal(h.controller.getState().inventory.slides[4].thumbnailUrl, afterInsert.slides[0].thumbnail_url)
  await h.c.advance(60_000); assert.equal(h.calls.length, 3, 'no more reads once nothing is pending')
  assert.equal(h.c.pending(), 0)
})
await check('controller: the backend turning pending into none stops the poll; "none" and "stale" never poll', async () => {
  const none = plain(appendBeforeRegistration); none.slides[4].thumbnail_status = 'none'
  const h = controllerHarness({ responses: [pendingInventory(), response(200, none)] })
  h.controller.refresh(true); await h.c.advance(0); await h.c.advance(3100)
  assert.equal(h.calls.length, 2); assert.equal(h.controller.getState().inventory.slides[4].thumbnailStatus, 'none')
  await h.c.advance(60_000); assert.equal(h.calls.length, 2)
  for (const body of [afterManualAdd, afterEdit]) {
    const quiet = controllerHarness({ responses: [response(200, body)] })
    quiet.controller.refresh(true); await quiet.c.advance(0); await quiet.c.advance(60_000)
    assert.equal(quiet.calls.length, 1)
  }
})
await check('controller: an endless pending is bounded (20 re-reads per trigger) and a new trigger starts a fresh budget', async () => {
  const h = controllerHarness({ responses: [pendingInventory()] })
  h.controller.refresh(true); await h.c.advance(0)
  await h.c.advance(3000 * 40)
  assert.equal(h.calls.length, 1 + 20)
  assert.equal(h.c.pending(), 0)
  h.controller.refresh(true); await h.c.advance(0); await h.c.advance(3000 * 40)
  assert.equal(h.calls.length, 2 * (1 + 20))
})
await check('controller: an unchanged poll publishes nothing (same inventory object, no re-render)', async () => {
  const h = controllerHarness({ responses: [pendingInventory()] })
  h.controller.refresh(true); await h.c.advance(0)
  const first = h.controller.getState().inventory, published = h.states.length
  await h.c.advance(3100); assert.equal(h.calls.length, 2)
  assert.equal(h.controller.getState().inventory, first); assert.equal(h.states.length, published)
})
await check('controller: refresh() cancels the poll timer; dispose clears it', async () => {
  const h = controllerHarness({ responses: [pendingInventory()] })
  h.controller.refresh(true); await h.c.advance(0)
  assert.equal(h.c.pending(), 1)
  h.controller.refresh(); assert.equal(h.c.pending(), 1, 'the debounce timer replaced the poll timer')
  h.controller.dispose(); assert.equal(h.c.pending(), 0)
  await h.c.advance(60_000); assert.equal(h.calls.length, 1)
})
await check('controller: 404 is remembered for the TTL, then asked again', async () => {
  const h = controllerHarness({ responses: [response(404, { detail: 'Not Found' })] })
  h.controller.refresh(); await h.c.advance(200)
  assert.equal(h.controller.getState().status, 'unavailable'); assert.equal(h.controller.getState().inventory, null)
  h.controller.refresh(); await h.c.advance(200); h.controller.refresh(); await h.c.advance(200)
  assert.equal(h.calls.length, 1, 'no hammering while the endpoint is known absent')
  await h.c.advance(60_000)
  h.controller.refresh(); await h.c.advance(200)
  assert.equal(h.calls.length, 2)
})
await check('controller: a later 200 after unavailable brings the rail back', async () => {
  const h = controllerHarness({ responses: [response(405, { detail: 'Method Not Allowed' }), response(200, afterInsert)] })
  h.controller.refresh(); await h.c.advance(200)
  await h.c.advance(60_000); h.controller.refresh(); await h.c.advance(200)
  assert.equal(h.controller.getState().status, 'ready')
})
await check('controller: a transient failure keeps the last good inventory', async () => {
  const h = controllerHarness({ responses: [response(200, afterInsert), response(500, {}), async () => { throw new TypeError('offline') }] })
  h.controller.refresh(); await h.c.advance(200)
  const good = h.controller.getState().inventory
  h.controller.refresh(); await h.c.advance(200)
  assert.equal(h.calls.length, 2)
  assert.equal(h.controller.getState().inventory, good)
  assert.equal(h.controller.getState().status, 'ready')
  h.controller.refresh(); await h.c.advance(200)
  assert.equal(h.controller.getState().inventory, good)
})
await check('controller: a first-read failure leaves the rail on today\'s path (idle, no inventory)', async () => {
  const h = controllerHarness({ responses: [response(503, {})] })
  h.controller.refresh(); await h.c.advance(200)
  assert.equal(h.controller.getState().status, 'idle'); assert.equal(h.controller.getState().inventory, null)
})
await check('controller: an unconfigured Layout URL is "unavailable", not a throw', async () => {
  const h = controllerHarness({ responses: [response(200, afterInsert)], baseUrl: () => { throw Error('Layout service is not configured') } })
  h.controller.refresh(); await h.c.advance(200)
  assert.equal(h.controller.getState().status, 'unavailable'); assert.equal(h.calls.length, 0)
})
await check('controller: dispose cancels timers and aborts; a late answer is never published', async () => {
  let abortedByController = false, release
  const slow = init => new Promise(resolve => { init.signal.addEventListener('abort', () => { abortedByController = true }); release = () => resolve(response(200, afterInsert)) })
  const h = controllerHarness({ responses: [slow] })
  h.controller.refresh(); await h.c.advance(200)
  h.controller.dispose()
  assert.equal(abortedByController, true)
  release(); await h.c.advance(10)
  assert.equal(h.states.some(s => s.status === 'ready'), false)
  const idle = controllerHarness({ responses: [response(200, afterInsert)] })
  idle.controller.refresh(); idle.controller.dispose(); await idle.c.advance(1000)
  assert.equal(idle.calls.length, 0); assert.equal(idle.c.pending(), 0)
})
await check('controller: a hung read is aborted by the timeout and the next trigger can read again', async () => {
  const hang = init => new Promise((_, reject) => init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e) }))
  const h = controllerHarness({ responses: [hang, response(200, afterInsert)] })
  h.controller.refresh(); await h.c.advance(200)
  await h.c.advance(8100)
  h.controller.refresh(); await h.c.advance(200)
  assert.equal(h.calls.length, 2); assert.equal(h.controller.getState().status, 'ready')
})

// ---------------------------------------------------------------- the hook, flag on, end to end
function hookHarness({ storage = new Map(), fetchImpl, clockRef }) {
  const clockImpl = clockRef
  let cursor = 0, dirty = false, pending = [], slots = [], currentProps, api
  const react = {
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
    useState(initial) {
      const i = cursor++
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[i].value, update => {
        const next = typeof update === 'function' ? update(slots[i].value) : update
        if (next !== slots[i].value) { slots[i].value = next; dirty = true }
      }]
    },
    useCallback(callback, deps) {
      const i = cursor++, old = slots[i]
      if (!old || deps.some((dep, n) => dep !== old.deps[n])) slots[i] = { callback, deps }
      return slots[i].callback
    },
    useMemo(factory, deps) {
      const i = cursor++, old = slots[i]
      if (!old || deps.length !== old.deps.length || deps.some((dep, n) => dep !== old.deps[n])) slots[i] = { value: factory(), deps }
      return slots[i].value
    },
    useEffect(callback, deps) {
      const i = cursor++, old = slots[i]
      if (!old || deps.length !== old.deps.length || deps.some((dep, n) => dep !== old.deps[n])) {
        const next = { deps, cleanup: old?.cleanup }; slots[i] = next
        pending.push(() => { next.cleanup?.(); next.cleanup = callback() })
      }
    },
  }
  const sandbox = {
    window: { sessionStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => { storage.set(key, value) },
      removeItem: key => { storage.delete(key) },
    } },
    fetch: fetchImpl, setTimeout: clockImpl.setTimer, clearTimeout: clockImpl.clearTimer,
  }
  const hookLib = compile(read('lib/slide-rail-identity.ts'), () => { throw Error('unexpected import') },
    { process: { env: {} }, ...sandbox, Date: { now: clockImpl.now } })
  const hook = compile(read('hooks/use-slide-rail-identity.ts'), name => {
    if (name === 'react') return react
    if (name === '@/lib/layout-service-client') return { getLayoutServiceUrl: () => 'https://l.test' }
    if (name === '@/lib/slide-rail-identity') return hookLib
    throw Error(`unexpected import ${name}`)
  }, sandbox).useSlideRailIdentity
  const once = () => { cursor = 0; dirty = false; api = hook(currentProps) }
  async function settle() {
    for (let turn = 0; turn < 40; turn++) {
      while (pending.length) pending.shift()()
      if (dirty) once()
      await clockImpl.advance(0)
      if (!dirty && !pending.length) { await clockImpl.advance(200); if (!dirty && !pending.length) break }
    }
    return api
  }
  return {
    async render(props) { currentProps = props; once(); return settle() },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
    get api() { return api },
  }
}
const baseProps = (over = {}) => ({ enabled: true, presentationId: PID, ownerUserId: 'owner-a', structureSlides: null, refreshSignals: [3, '{}'], ...over })
function inventoryServer(initial) {
  const state = { body: initial, status: 200, calls: 0 }
  state.fetch = async () => { state.calls++; return response(state.status, state.body) }
  return state
}
const before3 = (() => {
  const copy = plain(afterInsert)
  copy.slides = copy.slides.filter(slide => slide.slide_id !== N).map((slide, index) => ({ ...slide, slide_index: index }))
  copy.slide_count = 3
  return copy
})()

await check('hook, flag on, v1 inventory (no titles): rows null until the inventory answers; remembered titles and previews stay after an insert, a reorder and a remount', async () => {
  const storage = new Map(), c = clock(), server = inventoryServer(untitled(before3))
  const h = hookHarness({ storage, fetchImpl: server.fetch, clockRef: c })
  const structure = [{ title: 'Opening' }, { title: 'Market' }, { title: 'Wrap-up' }]
  assert.equal((await h.render(baseProps({ structureSlides: structure }))).rows?.length, 3)
  same(h.api.rows.map(r => r.title), ['Opening', 'Market', 'Wrap-up'])
  same(h.api.rows.map(r => r.slideId), ids(before3))
  const previewsBefore = Object.fromEntries(h.api.rows.map(r => [r.slideId, r.thumbnailUrl]))
  // Insert: count signal changes, native CRUD means the structure is no longer trusted, the inventory has 4 rows.
  server.body = untitled(afterInsert)
  await h.render(baseProps({ structureSlides: null, refreshSignals: [4, '{}'] }))
  same(h.api.rows.map(r => r.slideId), ids(afterInsert))
  same(h.api.rows.map(r => r.title), ['Opening', 'Market', 'Slide 3', 'Wrap-up'])
  for (const row of h.api.rows) if (previewsBefore[row.slideId]) assert.equal(row.thumbnailUrl, previewsBefore[row.slideId])
  assert.ok(h.api.rows.every(row => row.thumbnailUrl), 'previews present on every slide after the insert')
  // Reorder ack (N moves to the end): refresh() with no count change.
  server.body = untitled(inOrder(afterInsert, APPENDED))
  h.api.refresh(); await h.render(baseProps({ structureSlides: null, refreshSignals: [4, '{}'] }))
  same(h.api.rows.map(r => r.slideId), APPENDED)
  same(h.api.rows.map(r => r.title), ['Opening', 'Market', 'Wrap-up', 'Slide 4'])
  assert.ok(h.api.rows.every(row => row.thumbnailUrl))
  h.unmount()
  // Reload (remount, same tab): the structure is the stale 3-row Director one, which must not teach.
  server.body = untitled(afterReload)
  const reload = hookHarness({ storage, fetchImpl: server.fetch, clockRef: c })
  await reload.render(baseProps({ structureSlides: null, refreshSignals: [4, '{}'] }))
  same(reload.api.rows.map(r => r.slideId), ids(afterReload))
  same(reload.api.rows.map(r => r.title), ['Opening', 'Market', 'Slide 3', 'Wrap-up'])
  same(reload.api.rows.map(r => r.thumbnailUrl), afterReload.slides.map(s => s.thumbnail_url))
  // A different account in the same tab sees none of it.
  const other = hookHarness({ storage, fetchImpl: server.fetch, clockRef: c })
  await other.render(baseProps({ ownerUserId: 'owner-b' }))
  same(other.api.rows.map(r => r.title), ['Slide 1', 'Slide 2', 'Slide 3', 'Slide 4'])
  reload.unmount(); other.unmount()
})
await check('hook, flag on, v1.1 inventory: titles come from the inventory alone (empty storage, no structure), through insert, reorder and a fresh-tab reload', async () => {
  const c = clock(), server = inventoryServer(before3)
  const h = hookHarness({ fetchImpl: server.fetch, clockRef: c })
  await h.render(baseProps())
  same(h.api.rows.map(r => r.title), before3.slides.map(s => s.title))
  server.body = afterInsert
  await h.render(baseProps({ refreshSignals: [4, '{}'] }))
  same(h.api.rows.map(r => r.title), afterInsert.slides.map(s => s.title))
  same(h.api.rows.map(r => r.slideId), MOVED)
  server.body = inOrder(afterInsert, APPENDED)
  h.api.refresh(); await h.render(baseProps({ refreshSignals: [4, '{}'] }))
  same(h.api.rows.map(r => r.slideId), APPENDED)
  same(h.api.rows.map(r => r.title), inOrder(afterInsert, APPENDED).slides.map(s => s.title))
  h.unmount()
  const freshTab = hookHarness({ storage: new Map(), fetchImpl: server.fetch, clockRef: c })   // new tab: empty sessionStorage
  server.body = afterReload
  await freshTab.render(baseProps({ refreshSignals: [4, '{}'] }))
  same(freshTab.api.rows.map(r => r.title), afterReload.slides.map(s => s.title))
  assert.ok(freshTab.api.rows.every(r => r.thumbnailUrl && r.thumbnailStatus === 'fresh'))
  freshTab.unmount()
})
await check('hook: a null inventory title falls back to the remembered Director title; the inventory wins when present', async () => {
  const c = clock(), server = inventoryServer(null)
  const mixed = plain(before3); mixed.slides[0].title = null          // slide A has no inventory title
  server.body = mixed
  const h = hookHarness({ fetchImpl: server.fetch, clockRef: c })
  const structure = [{ title: 'Director opening' }, { title: 'Director market' }, { title: 'Director wrap-up' }]
  await h.render(baseProps({ structureSlides: structure }))
  same(h.api.rows.map(r => r.title), ['Director opening', before3.slides[1].title, before3.slides[2].title])
  h.unmount()
})
await check('hook: a pending preview shows as pending, then fresh with no other trigger (short timer); none and stale never poll', async () => {
  const c = clock(), server = inventoryServer(appendBeforeRegistration)
  const h = hookHarness({ fetchImpl: server.fetch, clockRef: c })
  await h.render(baseProps({ refreshSignals: [5, '{}'] }))
  same(h.api.rows.map(r => r.thumbnailStatus), ['fresh', 'fresh', 'fresh', 'fresh', 'pending'])
  assert.equal('thumbnailUrl' in h.api.rows[4], false)
  const callsBefore = server.calls
  server.body = registeredInventory
  await c.advance(3100)
  for (let i = 0; i < 5; i++) await h.render(baseProps({ refreshSignals: [5, '{}'] }))
  assert.equal(server.calls, callsBefore + 1)
  same(h.api.rows.map(r => r.thumbnailStatus), ['fresh', 'fresh', 'fresh', 'fresh', 'fresh'])
  assert.ok(h.api.rows[4].thumbnailUrl)
  h.unmount()
  const stale = hookHarness({ fetchImpl: inventoryServer(afterManualAdd).fetch, clockRef: clock() })
  await stale.render(baseProps({ refreshSignals: [6, '{}'] }))
  same(stale.api.rows.map(r => r.thumbnailStatus), ['fresh', 'fresh', 'fresh', 'fresh', 'stale', 'none'])
  same(stale.api.rows.map(r => r.title).slice(4), ['Added and then edited', 'Slide 6'])
  stale.unmount()
})
await check('hook, endpoint 404 (backend flag off): rows stay null, so the viewer keeps today\'s rail', async () => {
  const c = clock(), server = inventoryServer({ detail: 'Not Found' }); server.status = 404
  const h = hookHarness({ fetchImpl: server.fetch, clockRef: c })
  await h.render(baseProps({ structureSlides: [{ title: 'Opening' }] }))
  assert.equal(h.api.rows, null)
  assert.equal(server.calls, 1)
  await h.render(baseProps({ refreshSignals: [4, '{"0":"x"}'] }))
  assert.equal(h.api.rows, null); assert.equal(server.calls, 1, 'not asked again inside the TTL')
  h.unmount()
})
await check('hook, flag off or no presentation: never reads, rows null', async () => {
  const c = clock(), server = inventoryServer(afterInsert)
  const off = hookHarness({ fetchImpl: server.fetch, clockRef: c })
  await off.render(baseProps({ enabled: false })); assert.equal(off.api.rows, null)
  await off.render(baseProps({ enabled: false, refreshSignals: [9, 'x'] })); assert.equal(off.api.rows, null)
  off.api.refresh(); await c.advance(1000)
  const none = hookHarness({ fetchImpl: server.fetch, clockRef: c })
  await none.render(baseProps({ presentationId: null })); assert.equal(none.api.rows, null)
  await none.render(baseProps({ presentationId: '' })); assert.equal(none.api.rows, null)
  assert.equal(server.calls, 0)
  off.unmount(); none.unmount()
})
await check('hook: switching deck drops the old deck\'s rows at once and never shows them under the new id', async () => {
  const c = clock(), server = inventoryServer(afterInsert)
  const h = hookHarness({ fetchImpl: server.fetch, clockRef: c })
  await h.render(baseProps()); assert.equal(h.api.rows.length, 4)
  // deck-b's read still answers with deck "f8-replay-on" (a late/aliased reply): rejected, so today's rail.
  await h.render(baseProps({ presentationId: 'deck-b' }))
  assert.equal(h.api.rows, null)
  server.body = { ...plain(afterInsert), presentation_id: 'deck-b' }
  await c.advance(60_000); h.api.refresh(); await h.render(baseProps({ presentationId: 'deck-b', refreshSignals: [4, 'x'] }))
  assert.equal(h.api.rows.length, 4)
  h.unmount()
})
await check('hook: flag on but the structure is stale and ignored when the deck was touched (structureSlides null); null inventory titles read "Slide N"', async () => {
  const c = clock(), server = inventoryServer(untitled(afterInsert))
  const h = hookHarness({ fetchImpl: server.fetch, clockRef: c })
  await h.render(baseProps({ structureSlides: null }))
  same(h.api.rows.map(r => r.title), ['Slide 1', 'Slide 2', 'Slide 3', 'Slide 4'])
  assert.ok(h.api.rows.every(r => r.thumbnailUrl))
  h.unmount()
})

// ---------------------------------------------------------------- the real strip, server-rendered
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const tsModules = new Map()
function loadTs(file) {   // transpile-on-require for repo files ('@/' and relative), node_modules as installed, css ignored
  if (tsModules.has(file)) return tsModules.get(file).exports
  const module = { exports: {} }; tsModules.set(file, module)
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(repoRoot, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext
    throw Error(`unresolved ${spec}`)
  }
  const req = spec => spec.endsWith('.css') ? {} : spec.startsWith('@/') || spec.startsWith('.') ? loadTs(resolve(spec, file)) : nodeRequire(spec)
  vm.runInThisContext(`(function(exports, require, module, __filename){${out}\n})`, { filename: file })(module.exports, req, module, file)
  return module.exports
}
process.env.NEXT_PUBLIC_STUDIO_V4_SHELL = 'true'   // the strip reads it at load: the Studio rendering is the one this flag serves
const { SlideThumbnailStrip } = loadTs(path.join(repoRoot, 'components/slide-thumbnail-strip.tsx'))
const React = nodeRequire('react'), { renderToStaticMarkup } = nodeRequire('react-dom/server')
const renderStrip = (slides, extra = {}) => renderToStaticMarkup(React.createElement(SlideThumbnailStrip, {
  slides, currentSlide: 1, onSlideClick() {}, orientation: 'vertical', totalSlides: slides.length, ...extra }))
const cards = html => html.split('data-studio-thumbnail-card="true"').slice(1)

check('strip (real component, server-rendered): fresh = image; pending = spinner label; none, stale and no status = today\'s "No preview"', () => {
  const html = renderStrip([
    { slideNumber: 1, title: 'Fresh one', thumbnailUrl: 'https://proj.test/a.png', thumbnailStatus: 'fresh' },
    { slideNumber: 2, title: 'Pending one', thumbnailStatus: 'pending' },
    { slideNumber: 3, title: 'None one', thumbnailStatus: 'none' },
    { slideNumber: 4, title: 'Stale one', thumbnailStatus: 'stale' },
    { slideNumber: 5, title: 'Legacy one' },
  ])
  const [fresh, pending, none, stale, legacy] = cards(html)
  assert.match(fresh, /<img[^>]+src="https:\/\/proj\.test\/a\.png"/); assert.doesNotMatch(fresh, /No preview|Preview loading/)
  assert.match(pending, /data-studio-thumbnail-pending="true"/); assert.match(pending, /Preview loading/); assert.doesNotMatch(pending, /No preview/)
  assert.match(pending, /animate-spin/); assert.match(pending, /data-has-preview="false"/)
  for (const card of [none, stale, legacy]) {
    assert.match(card, /<span class="studio-thumbnail-placeholder-label">No preview<\/span>/)
    assert.doesNotMatch(card, /Preview loading|data-studio-thumbnail-pending/)
  }
  assert.equal((html.match(/data-studio-thumbnail-pending/g) ?? []).length, 1)
})
check('strip (real component): a row without thumbnailStatus renders exactly as before (the flag-off row shape)', () => {
  const rows = [{ slideNumber: 1, title: 'A', thumbnailUrl: 'https://proj.test/a.png' }, { slideNumber: 2, title: 'Slide 2' }]
  const withStatus = rows.map(row => ({ ...row, thumbnailStatus: row.thumbnailUrl ? 'fresh' : 'none' }))
  assert.equal(renderStrip(rows), renderStrip(withStatus), 'none and fresh add no markup of their own')
  assert.match(renderStrip(rows), /No preview/)
})
check('rows from the real inventory, through the real strip: titles, previews and the pending spinner show up', () => {
  const rows = lib.buildRailRows(lib.parseSlideInventory(afterManualAdd, PID), new Map())
  const html = renderStrip(rows, { keyBySlideId: true })
  const list = cards(html)
  assert.equal(list.length, 6)
  assert.match(list[4], /Added and then edited/); assert.match(list[4], /No preview/)
  assert.match(list[5], /Slide 6/); assert.match(list[5], /No preview/)
  assert.equal((html.match(/<img /g) ?? []).length, 4)
  const pendingHtml = renderStrip(lib.buildRailRows(lib.parseSlideInventory(appendBeforeRegistration, PID), new Map()), { keyBySlideId: true })
  const last = cards(pendingHtml).at(-1)
  assert.match(last, /Added after the build/); assert.match(last, /Preview loading/); assert.doesNotMatch(last, /No preview/)
})

// ---------------------------------------------------------------- wiring (source guards)
const strip = read('components/slide-thumbnail-strip.tsx')
const viewer = read('components/presentation-viewer.tsx')
check('strip: keys by slide_id only when asked; the default key is today\'s slide number', () => {
  assert.match(strip, /keyBySlideId = false,/)
  assert.match(strip, /const itemKey = keyBySlideId && slide\.slideId \? `slide-\$\{slide\.slideId\}` : realSlideNumber/)
  assert.match(strip, /<ContextMenu key=\{itemKey\}>/)
  assert.match(strip, /<React\.Fragment key=\{itemKey\}>\{thumbnailContent\}<\/React\.Fragment>/)
  assert.doesNotMatch(strip, /key=\{realSlideNumber\}/)
})
check('viewer: rail identity is behind the flag, uses the inventory only when rows exist, and refreshes after acks', () => {
  assert.match(viewer, /enabled: STUDIO_RAIL_SLIDE_IDENTITY_ENABLED && studioShell && Boolean\(approvedPresentationUrl\)/)
  assert.match(viewer, /const slideThumbnails = useMemo<SlideThumbnail\[\]>\(\(\) => \{\n    if \(railIdentityRows\) return railIdentityRows\n/)
  assert.match(viewer, /keyBySlideId=\{railIdentityRows !== null\}/)
  assert.match(viewer, /onThumbnailInvalidatedRef\.current\?\.\(owner\.presentationId\)\n      slideRailRefreshRef\.current\(\)/)
  assert.match(viewer, /commit\(setTotalSlides, newTotal\)\n        slideRailRefreshRef\.current\(\)/)
  assert.match(viewer, /railThumbnailFrames = useMemo\(\(\) => STUDIO_RAIL_SLIDE_IDENTITY_ENABLED \? JSON\.stringify\(thumbnailUrlsBySlide\) : ''/)
})
check('flag off is inert: no inventory request path exists outside the hook, and the hook early-returns', () => {
  const hook = read('hooks/use-slide-rail-identity.ts')
  assert.match(hook, /const active = enabled && Boolean\(presentationId\)/)
  assert.match(hook, /if \(!active \|\| !presentationId\) \{\n      controllerRef\.current = null\n      return\n    \}/)
  assert.equal((viewer.match(/slides\/inventory/g) ?? []).length, 0)
  assert.equal((viewer.match(/\bSTUDIO_RAIL_SLIDE_IDENTITY_ENABLED\b/g) ?? []).length, 3)
})

console.log(`\n${checks} checks passed`)
