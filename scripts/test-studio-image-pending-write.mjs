// IMAGE-PENDING-WRITE: a hero-background image job stores its "pending" state where Layout !240 reads it (flag NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE,
// exact "true", default off; Studio half of Layout MR !240, LAYOUT_IMAGE_GHOST_ONLY_WHEN_PENDING_ENABLED, contract v1 in streams/slide/RESULT-B3B-GHOST.md).
// Offline and self-contained: no network, no browser, no git. The repo root is found from this file. Four layers:
//   helper   lib/studio-image-pending-write.ts on its own (import-free): who writes, the fields, the positional batch body, finding the hero slide;
//   writer   the same file's writer against a fake Layout that merges the batch PUT the way Layout's update_all_slides does (server.py 3637-3735);
//   runtime  lib/studio-image-pending-runtime.ts in a vm: the viewer-saved listener, the service URL, the wait for a clean save;
//   hook     the REAL useTextLabsGeneration hook (and the real Text Labs client) in a vm, a hero background IMAGE refine through a fake Text Labs and a fake
//            Layout viewer + REST: the stored pending state while the job runs, ready / failed when it ends, the slide found by id, nothing for other jobs;
//   identity flag off (and every value that is not "true") sends exactly the base's Text Labs bytes + Layout commands and makes no REST call; with the marked
//            lines removed the hook is the base's file (sha256 below); the flag is documented in .env.example.
// Then every suite re-runs against deliberately broken copies of the sources: each mutant must be caught.
// Flag-off digests were recorded by running this script against the base tree (studio-v4-dev-preparation-code @ 5865ac0) with IPW_TREE=<that tree> IPW_PRINT_DIGESTS=1.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
// FRONTEND-2 Pass 3 (NEXT_PUBLIC_CHAT_ELEMENT_REFINE) added flag-gated lines to the hook; with them taken out it is the file this pin holds it to.
import { stripChatElementRefine } from './studio-chat-element-refine-strip.mjs'
import { stripChatAddTargeted } from './studio-chat-add-targeted-strip.mjs' // LATER-CHANGES: registry read (CHAT-ADD-TARGETED): the targeted chat add stacked after this change, so its marked lines in the generation hook come out first

const here = path.dirname(fileURLToPath(import.meta.url))
let ownRoot = here
while (!fs.existsSync(path.join(ownRoot, 'package.json'))) {
  const parent = path.dirname(ownRoot)
  assert.notEqual(parent, ownRoot, 'no package.json above this script')
  ownRoot = parent
}
assert.equal(JSON.parse(fs.readFileSync(path.join(ownRoot, 'package.json'), 'utf8')).name, 'deckster', 'the anchor package.json must be the Deckster frontend')
const requireOwn = createRequire(path.join(ownRoot, 'package.json'))
const ts = requireOwn('typescript')
const React = requireOwn('react')
const TREE = process.env.IPW_TREE ? path.resolve(process.env.IPW_TREE) : ownRoot
const PRINT = process.env.IPW_PRINT_DIGESTS === '1'
const FLAG = 'NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE'
const MARK = 'IMAGE-PENDING-WRITE'
// sha256 of hooks/use-textlabs-generation.ts at the base (5865ac0): the hook with the marked lines removed must be this file.
const BASE_HOOK_SHA256 = '98094f7e93cd4f7aae66a1fdc070b1cf86d102037d712eb45f22593e0da79cef'
// Recorded from the base tree (see header): the exact Text Labs request bytes + every Layout command + toasts + outcome of three IMAGE jobs.
const BASE_DIGESTS = {
  background_refine_ok: 'c9f28ab472c5e53b102c63ba261276a6680518d6f0e33c69abd425c2c1f8d44a',
  background_refine_error: '0f5ab6824eb85abe701947f64c7ac9377e6d9124ffe5143e9037103aa4d5409d',
  blank_placeholder_ok: '16c79cee5f33e897158e87993e5dee9c06a8ac03a9c7cfda628510a6abb693dd',
}

const FILES = {
  lib: 'lib/studio-image-pending-write.ts',
  runtime: 'lib/studio-image-pending-runtime.ts',
  hook: 'hooks/use-textlabs-generation.ts',
}
const readFrom = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const SRC = Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, readFrom(ownRoot, rel)]))
const HOOK_SRC_AT_TREE = TREE === ownRoot ? SRC.hook : readFrom(TREE, FILES.hook)
const ENVEX = readFrom(ownRoot, '.env.example')

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }
const copy = value => JSON.parse(JSON.stringify(value))
const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex')
const flush = async () => { for (let i = 0; i < 300; i++) await Promise.resolve() }
const replaceOnce = (source, from, to) => { assert.ok(source.includes(from), `mutant anchor missing: ${from}`); return source.replace(from, to) }

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}

/**
 * A world: any repo file loaded on demand into its own vm context, `src` overriding the three files under test. `globalsFor(rel)` adds globals per file
 * (the runtime module alone gets a `window`). The hook's React is a small hook shim (refs, effects, callbacks run inline).
 */
function createWorld({ env = {}, src = {}, tree = ownRoot, globals = {}, globalsFor = () => ({}), hookReact = React } = {}) {
  const overrides = {}
  for (const [key, rel] of Object.entries(FILES)) if (src[key] !== undefined) overrides[rel] = src[key]
  const cache = new Map()
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const mod = { exports: {} }
    cache.set(rel, mod)
    const source = overrides[rel] ?? (tree === ownRoot || !fs.existsSync(path.join(tree, rel)) ? readFrom(ownRoot, rel) : readFrom(tree, rel))
    const require = id => {
      if (id === 'react') return hookReact
      if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`)
      if (id.startsWith('.')) return load(`${path.normalize(path.join(path.dirname(rel), id))}.ts`)
      throw new Error(`Unexpected non-source dependency: ${id} (from ${rel})`)
    }
    const scope = { module: mod, exports: mod.exports, require, process: { env }, React: hookReact, ...globals, ...globalsFor(rel) }
    vm.runInNewContext(compile(rel, source), scope, { filename: rel })
    return mod.exports
  }
  return { load }
}

// ---------------------------------------------------------------- a fake Layout (REST) that merges the batch PUT like server.py update_all_slides
const KNOWN_SLIDE_KEYS = ['text_boxes', 'images', 'charts', 'infographics', 'diagrams', 'speaker_notes', 'script', 'references',
  'narration_duration_seconds', 'narration_pacing_hints', 'script_compressed', 'layout_pattern', 'source_registry']
const BASE_URL = 'https://layout.example.test'
const slide = (id, layout, content = {}, extra = {}) => ({ slide_id: id, layout, content: { slide_title: `Title ${id}`, ...content }, images: [], ...extra })
const DECK = () => [slide('s-c1', 'C1'), slide('s-h1', 'H1s', { overlay_style: 'gradient' }), slide('s-h2', 'H2', { section_number: '02' })]
const HERO = 1

function fakeLayout({ slides = DECK(), id = 'deck-1' } = {}) {
  const deck = { id, slides: copy(slides) }
  const log = []
  const state = { failGets: 0, failPuts: 0, storeButFail: false, throwFetch: false, holdGet: null }
  const response = (ok, status, body = {}) => ({ ok, status, json: async () => copy(body) })
  async function fetch(url, init = {}) {
    const method = init.method ?? 'GET'
    const u = new URL(url)
    const pathname = decodeURIComponent(u.pathname)
    log.push({ method, path: u.pathname, body: init.body ? JSON.parse(init.body) : null, cache: init.cache ?? null, headers: init.headers ? copy(init.headers) : null })
    if (state.throwFetch) throw new TypeError('network down')
    if (method === 'GET' && pathname === `/api/presentations/${id}`) {
      if (state.holdGet) await state.holdGet
      if (state.failGets > 0) { state.failGets--; return response(false, 503) }
      return response(true, 200, deck)
    }
    if (method === 'PUT' && pathname === `/api/presentations/${id}/slides`) {
      if (state.failPuts > 0 && !state.storeButFail) { state.failPuts--; return response(false, 503) }
      const body = JSON.parse(init.body)
      for (const [i, update] of body.slides.entries()) {
        if (i >= deck.slides.length) continue
        for (const [key, value] of Object.entries(update)) {
          if (KNOWN_SLIDE_KEYS.includes(key)) deck.slides[i][key] = value
          else if (value !== null) deck.slides[i].content[key] = value
        }
      }
      if (state.failPuts > 0) { state.failPuts--; return response(false, 503) }
      return response(true, 200, { success: true })
    }
    return response(false, 404)
  }
  const puts = () => log.filter(entry => entry.method === 'PUT')
  const gets = () => log.filter(entry => entry.method === 'GET')
  return { deck, log, state, fetch, puts, gets }
}

// ---------------------------------------------------------------- suite 1: the helper, on its own
function loadLib(src, env = {}) {
  return createWorld({ env, src }).load(FILES.lib)
}
async function helperSuite(src) {
  check(assert.equal, /^\s*import\s/m.test(src.lib ?? SRC.lib), false, 'the helper stays import-free')
  check(assert.equal, loadLib(src).STUDIO_IMAGE_PENDING_WRITE_ENABLED, false, 'default off')
  for (const value of ['', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true']) {
    check(assert.equal, loadLib(src, { [FLAG]: value }).STUDIO_IMAGE_PENDING_WRITE_ENABLED, false, `"${value}" is off`)
  }
  check(assert.equal, loadLib(src, { [FLAG]: 'true' }).STUDIO_IMAGE_PENDING_WRITE_ENABLED, true, 'the literal "true" is on')

  const lib = loadLib(src, { [FLAG]: 'true' })
  // The contract's names and numbers.
  check(assert.equal, lib.IMAGE_STATUS_FIELD, 'image_status')
  check(assert.equal, lib.IMAGE_JOB_ID_FIELD, 'image_job_id')
  check(assert.equal, lib.HERO_BACKGROUND_SLOT_NAME, 'background')
  check(assert.deepEqual, copy(lib.HERO_LAYOUTS), ['H1s', 'H2', 'H3'], "the hero templates Layout's helper gates")
  check(assert.equal, lib.IMAGE_PENDING_WINDOW_MS, 600000, 'the contract window, 10 minutes')
  check(assert.equal, lib.IMAGE_PENDING_UPDATED_BY, 'studio-image-pending')
  check(assert.equal, lib.IMAGE_PENDING_SETTLE_MS, 8000)
  check(assert.equal, lib.IMAGE_PENDING_RETRY_DELAY_MS, 1500)

  // Who writes: an IMAGE generated into a slot named "background", nothing else.
  check(assert.equal, lib.imageJobWritesPending({ componentType: 'IMAGE', slotName: 'background' }), true)
  for (const job of [
    { componentType: 'IMAGE', slotName: 'logo' }, { componentType: 'IMAGE', slotName: 'image' }, { componentType: 'IMAGE', slotName: null },
    { componentType: 'IMAGE', slotName: undefined }, { componentType: 'IMAGE' }, { componentType: 'IMAGE', slotName: 'Background' },
    { componentType: 'TEXT_BOX', slotName: 'background' }, { componentType: 'INFOGRAPHIC', slotName: 'background' }, { componentType: 'CHART', slotName: 'background' },
    { slotName: 'background' }, {}, null, undefined,
  ]) check(assert.equal, lib.imageJobWritesPending(job), false, JSON.stringify(job))

  // The job id carries its start time and a clean nonce.
  check(assert.equal, lib.newImageJobId(1760000000000, 'abc123'), 'studio-1760000000000-abc123')
  check(assert.equal, lib.newImageJobId(1760000000000.9, 'a-b_c d!'), 'studio-1760000000000-abcd', 'whole ms, no punctuation')
  check(assert.equal, lib.newImageJobId(1760000000000, '0123456789abcdefXYZ'), 'studio-1760000000000-0123456789ab', 'at most 12 characters')
  check(assert.equal, lib.newImageJobId(1760000000000, '----'), 'studio-1760000000000-0', 'an empty nonce becomes 0')
  check(assert.equal, lib.newImageJobId(Number.NaN, 'x'), 'studio-0-x')
  check(assert.equal, lib.newImageJobId(-5, 'x'), 'studio-0-x')

  // The fields are exactly the contract's two.
  check(assert.deepEqual, copy(lib.imageStatusFields('pending', 'J')), { image_status: 'pending', image_job_id: 'J' })
  check(assert.deepEqual, copy(lib.imageStatusFields('ready', 'J')), { image_status: 'ready', image_job_id: 'J' })
  check(assert.deepEqual, copy(lib.imageStatusFields('failed', 'J')), { image_status: 'failed', image_job_id: 'J' })

  // The positional batch body.
  check(assert.deepEqual, copy(lib.imageStatusBatch(0, { a: 1 })), [{ a: 1 }])
  check(assert.deepEqual, copy(lib.imageStatusBatch(3, { a: 1 })), [{}, {}, {}, { a: 1 }], 'empty objects before the target, nothing after')
  const fields = { a: 1 }
  const batch = lib.imageStatusBatch(1, fields)
  batch[1].a = 2
  check(assert.equal, fields.a, 1, 'the target object is a copy')
  for (const bad of [-1, 1.5, Number.NaN, Infinity, '2', null, undefined]) check(assert.equal, lib.imageStatusBatch(bad, { a: 1 }), null, `index ${String(bad)}`)

  // Finding the hero slide in the stored deck.
  const deck = { slides: [
    slide('s0', 'C1'), slide('s1', 'H1s', { image_job_id: 'job-1', image_status: 'pending' }), slide('s2', 'H2'), slide('s3', 'H3'),
    { slide_id: 's4', layout: 'H1s' }, { layout: 'H2', content: { image_job_id: 7 } }, 'junk', null,
  ] }
  const at = (index, id = null) => lib.locateHeroSlide(copy(deck), index, id)
  check(assert.deepEqual, copy(at(1)), { index: 1, slideId: 's1', storedJobId: 'job-1' })
  check(assert.deepEqual, copy(at(2)), { index: 2, slideId: 's2', storedJobId: null })
  check(assert.deepEqual, copy(at(3)), { index: 3, slideId: 's3', storedJobId: null }, 'H3 is a hero')
  check(assert.deepEqual, copy(at(4)), { index: 4, slideId: 's4', storedJobId: null }, 'a hero with no content')
  check(assert.deepEqual, copy(at(5)), { index: 5, slideId: null, storedJobId: null }, 'a hero with no slide_id and a non-string job id')
  check(assert.equal, at(0), null, 'a content slide is not a hero')
  for (const index of [6, 7, 8, -1, 1.5, Number.NaN]) check(assert.equal, at(index), null, `position ${index}`)
  check(assert.equal, lib.locateHeroSlide({ slides: 'x' }, 0, null), null)
  check(assert.equal, lib.locateHeroSlide({}, 0, null), null)
  check(assert.equal, lib.locateHeroSlide(null, 0, null), null)
  // With a slide_id the slide is found wherever it now is, and the position is not consulted.
  check(assert.deepEqual, copy(at(0, 's3')), { index: 3, slideId: 's3', storedJobId: null }, 'by id, not by position')
  check(assert.equal, at(1, 'gone'), null, 'a deleted slide is nowhere')
  check(assert.equal, at(1, 's0'), null, 'a slide found by id that is no longer a hero')
}

// ---------------------------------------------------------------- suite 2: the writer against a fake Layout
function newDeps(layout, over = {}) {
  const order = []
  const warns = []
  const sleeps = []
  const deps = {
    baseUrl: BASE_URL,
    fetchImpl: (url, init) => { order.push(`${init.method ?? 'GET'}`); return layout.fetch(url, init) },
    now: () => 1760000000000,
    nonce: () => 'abc123',
    settleViewer: async () => { order.push('settle') },
    sleep: async ms => { sleeps.push(ms) },
    warn: (message, detail) => warns.push([message, detail instanceof Error ? detail.message : detail]),
    ...over,
  }
  return { deps, order, warns, sleeps }
}
const JOB = 'studio-1760000000000-abc123'
async function writerSuite(src) {
  const lib = loadLib(src)
  const storedStatus = (layout, index = HERO) => [layout.deck.slides[index].content.image_status, layout.deck.slides[index].content.image_job_id]

  // start + end ready
  {
    const layout = fakeLayout()
    const before = copy(layout.deck.slides)
    const { deps, order } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    check(assert.equal, job.jobId, JOB)
    check(assert.equal, await job.started, 'written')
    check(assert.deepEqual, order, ['settle', 'GET', 'PUT'], 'wait for the viewer, read, write')
    check(assert.deepEqual, layout.gets().map(g => [g.path, g.cache]), [['/api/presentations/deck-1', 'no-store']], 'the deck is read fresh')
    const put = layout.puts()[0]
    check(assert.equal, put.path, '/api/presentations/deck-1/slides')
    check(assert.deepEqual, put.body, { slides: [{}, { image_status: 'pending', image_job_id: JOB }], updated_by: 'studio-image-pending', change_summary: 'Image job pending (Studio)' })
    check(assert.deepEqual, put.headers, { 'Content-Type': 'application/json' })
    check(assert.deepEqual, storedStatus(layout), ['pending', JOB], 'stored on the hero slide content (slides[1].content)')
    check(assert.equal, 'image_status' in layout.deck.slides[HERO], false, 'not at the slide top level')
    for (const i of [0, 2]) check(assert.deepEqual, layout.deck.slides[i], before[i], `slide ${i} is untouched`)
    const { image_status, image_job_id, ...rest } = layout.deck.slides[HERO].content
    check(assert.deepEqual, rest, before[HERO].content, 'the rest of the hero content is untouched')

    check(assert.equal, await job.end('ready'), 'written')
    check(assert.deepEqual, order, ['settle', 'GET', 'PUT', 'settle', 'GET', 'PUT'])
    check(assert.deepEqual, layout.puts()[1].body, { slides: [{}, { image_status: 'ready', image_job_id: JOB }], updated_by: 'studio-image-pending', change_summary: 'Image job ready (Studio)' })
    check(assert.deepEqual, storedStatus(layout), ['ready', JOB])
    check(assert.equal, await job.end('failed'), 'written', 'a second end returns the first answer')
    check(assert.equal, layout.puts().length, 2, 'and writes nothing more')
    check(assert.deepEqual, storedStatus(layout), ['ready', JOB], 'the first outcome stands')
  }
  // end failed
  {
    const layout = fakeLayout()
    const { deps } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    check(assert.equal, await job.end('failed'), 'written')
    check(assert.deepEqual, storedStatus(layout), ['failed', JOB])
    check(assert.equal, layout.puts()[1].body.change_summary, 'Image job failed (Studio)')
  }
  // start returns at once; end is ordered behind a start that is still reading
  {
    const layout = fakeLayout()
    let release
    layout.state.holdGet = new Promise(resolve => { release = resolve })
    const { deps, order } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    check(assert.equal, typeof job.end, 'function', 'startImageJobPending returned synchronously')
    const ending = job.end('ready')
    await flush()
    check(assert.equal, layout.puts().length, 0, 'nothing is written while the start is still reading')
    layout.state.holdGet = null
    release()
    check(assert.equal, await job.started, 'written')
    check(assert.equal, await ending, 'written')
    check(assert.deepEqual, layout.puts().map(p => p.body.slides[HERO].image_status), ['pending', 'ready'], 'pending before ready, never the other way')
    check(assert.deepEqual, order.filter(o => o === 'PUT').length, 2)
  }
  // not a hero / no such slide: nothing written, nothing to clear
  for (const [name, slideIndex] of [['a content slide', 0], ['past the end', 7], ['negative', -1]]) {
    const layout = fakeLayout()
    const { deps } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex })
    check(assert.equal, await job.started, 'skipped', name)
    check(assert.equal, await job.end('ready'), 'skipped', `${name}: end`)
    check(assert.equal, layout.puts().length, 0, `${name}: no write`)
    check(assert.equal, layout.gets().length, 1, `${name}: end does not read again`)
  }
  // another writer owns the field now: only our own pending is cleared
  {
    const layout = fakeLayout()
    const { deps } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    await job.started
    layout.deck.slides[HERO].content.image_job_id = 'sb-77'
    layout.deck.slides[HERO].content.image_status = 'pending'
    check(assert.equal, await job.end('ready'), 'not-ours')
    check(assert.equal, layout.puts().length, 1, 'no clearing write')
    check(assert.deepEqual, storedStatus(layout), ['pending', 'sb-77'], "the other producer's pending is left alone")
  }
  // slides moved while the job ran: the slide is found by its id
  {
    const layout = fakeLayout()
    const { deps } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    await job.started
    layout.deck.slides.unshift(slide('s-new', 'H3'))   // s-new, s-c1, s-h1, s-h2: the hero is now at 2
    check(assert.equal, await job.end('ready'), 'written')
    check(assert.deepEqual, layout.puts()[1].body.slides, [{}, {}, { image_status: 'ready', image_job_id: JOB }], 'written at the slide\'s new position')
    check(assert.deepEqual, storedStatus(layout, 2), ['ready', JOB])
    check(assert.equal, layout.deck.slides[1].content.image_status, undefined, 'the slide now at the old position is not touched')
    check(assert.equal, layout.deck.slides[0].content.image_status, undefined)
  }
  // slide deleted while the job ran
  {
    const layout = fakeLayout()
    const { deps } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    await job.started
    layout.deck.slides.splice(HERO, 1)
    check(assert.equal, await job.end('failed'), 'skipped')
    check(assert.equal, layout.puts().length, 1)
  }
  // one failed read is retried once, after the delay; the second pass re-reads
  {
    const layout = fakeLayout()
    layout.state.failGets = 1
    const { deps, warns, sleeps } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    check(assert.equal, await job.started, 'written')
    check(assert.deepEqual, sleeps, [1500])
    check(assert.equal, layout.gets().length, 2)
    check(assert.equal, warns.length, 1)
    check(assert.deepEqual, storedStatus(layout), ['pending', JOB])
  }
  // one failed write is retried once
  {
    const layout = fakeLayout()
    layout.state.failPuts = 1
    const { deps, sleeps } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    check(assert.equal, await job.started, 'written')
    check(assert.deepEqual, sleeps, [1500])
    check(assert.equal, layout.puts().length, 2)
    check(assert.equal, layout.gets().length, 2, 'the retry reads again')
  }
  // two failures: the start reports failed, never throws, and a start that never wrote has nothing to clear
  {
    const layout = fakeLayout()
    layout.state.failGets = 2
    const { deps, warns } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    check(assert.equal, await job.started, 'failed')
    check(assert.equal, await job.end('ready'), 'skipped', 'nothing was written, nothing to clear')
    check(assert.equal, layout.puts().length, 0)
    check(assert.ok, warns.length >= 2)
    check(assert.equal, layout.deck.slides[HERO].content.image_status, undefined)
  }
  // a write whose answer was lost (stored, but the response said 503 twice): the end still finds and clears it
  {
    const layout = fakeLayout()
    layout.state.failPuts = 2
    layout.state.storeButFail = true
    const { deps } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    check(assert.equal, await job.started, 'failed')
    check(assert.deepEqual, storedStatus(layout), ['pending', JOB], 'it was stored')
    layout.state.failPuts = 0
    layout.state.storeButFail = false
    check(assert.equal, await job.end('failed'), 'written', 'the ambiguous start is checked against the stored job id')
    check(assert.deepEqual, storedStatus(layout), ['failed', JOB])
  }
  // the write failed for good and nothing is stored: the end finds no job id and writes nothing
  {
    const layout = fakeLayout()
    layout.state.failPuts = 2
    const { deps } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    check(assert.equal, await job.started, 'failed')
    check(assert.equal, await job.end('ready'), 'not-ours')
    check(assert.equal, layout.deck.slides[HERO].content.image_status, undefined)
  }
  // a network that throws: still never rejects
  {
    const layout = fakeLayout()
    layout.state.throwFetch = true
    const { deps, warns } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    check(assert.equal, await job.started, 'failed')
    check(assert.equal, await job.end('ready'), 'skipped')
    check(assert.ok, warns.length >= 1)
  }
  // the end waits for the viewer, and a failed clear never rejects
  {
    const layout = fakeLayout()
    const { deps, warns } = newDeps(layout)
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    await job.started
    layout.state.failGets = 2
    check(assert.equal, await job.end('ready'), 'failed')
    check(assert.deepEqual, storedStatus(layout), ['pending', JOB], 'left pending: the next job on the slide replaces it')
    check(assert.ok, warns.length >= 1)
  }
  // the viewer is awaited before the start reads, and before the end reads
  {
    const layout = fakeLayout()
    const gate = {}
    gate.promise = new Promise(resolve => { gate.release = resolve })
    const { deps, order } = newDeps(layout, { settleViewer: async () => { order.push('settle'); await gate.promise } })
    const job = lib.startImageJobPending(deps, { presentationId: 'deck-1', slideIndex: HERO })
    await flush()
    check(assert.deepEqual, order, ['settle'], 'nothing is read while the viewer has an unsaved edit')
    gate.release()
    await job.started
    check(assert.deepEqual, order, ['settle', 'GET', 'PUT'])
  }
  // the URL: base trailing slash trimmed, presentation id encoded
  {
    const layout = fakeLayout({ id: 'a b/c' })
    const { deps } = newDeps(layout, { baseUrl: `${BASE_URL}///` })
    const job = lib.startImageJobPending(deps, { presentationId: 'a b/c', slideIndex: HERO })
    check(assert.equal, await job.started, 'written')
    check(assert.equal, layout.log[0].path, '/api/presentations/a%20b%2Fc', 'encoded as one path segment')
  }
}

// ---------------------------------------------------------------- suite 3: the runtime glue
function makeClock() {
  let now = 1760000000000, seq = 0
  const timers = new Map()
  return {
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id },
    clearTimeout: id => timers.delete(id),
    now: () => now,
    advance: async ms => {
      now += ms
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= now).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0]); due[1].fn(); await flush()
      }
      await flush()
    },
    pending: () => timers.size,
  }
}
function makeWindow() {
  const listeners = []
  return { listeners, addEventListener: (type, fn) => { if (type === 'message') listeners.push(fn) }, post: data => listeners.forEach(fn => fn({ data })) }
}
function runtimeWorld({ flag, layoutUrl = BASE_URL, layout = fakeLayout(), src = {}, win = makeWindow(), clock = makeClock() } = {}) {
  const env = layoutUrl === null ? {} : { NEXT_PUBLIC_LAYOUT_SERVICE_URL: layoutUrl }
  if (flag !== undefined) env[FLAG] = flag
  const warns = []
  class ClockDate extends Date { static now() { return clock.now() } }
  const world = createWorld({
    env, src,
    globals: { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, Date: ClockDate, URL, Error, Promise,
      fetch: (url, init) => layout.fetch(url, init), crypto: { randomUUID: () => 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }, console: { warn: (...a) => warns.push(a), log() {}, error() {} } },
    globalsFor: rel => (rel === FILES.runtime ? { window: win } : {}),
  })
  return { runtime: world.load(FILES.runtime), layout, win, clock, warns }
}
const saveEvent = (status, hasPendingChanges) => ({ type: 'saveStatusChanged', status, hasPendingChanges })
async function runtimeSuite(src) {
  // Flag off: the module listens to nothing.
  for (const flag of [undefined, 'false', 'TRUE', '']) {
    const w = runtimeWorld({ flag, src })
    check(assert.equal, w.win.listeners.length, 0, `flag ${JSON.stringify(flag)}: no listener`)
  }
  // Flag on: one listener, installed at import.
  {
    const w = runtimeWorld({ flag: 'true', src })
    check(assert.equal, w.win.listeners.length, 1, 'one listener')
    const again = w.runtime.startImagePendingJob('deck-1', HERO)
    check(assert.equal, w.win.listeners.length, 1, 'starting a job does not add another')
    check(assert.ok, again)
  }
  // Configuration: no Layout URL, a bad one, a bad target.
  {
    const w = runtimeWorld({ flag: 'true', layoutUrl: null, src })
    check(assert.equal, w.runtime.startImagePendingJob('deck-1', HERO), null, 'no Layout service URL: no job')
    check(assert.equal, w.layout.log.length, 0)
    const bad = runtimeWorld({ flag: 'true', layoutUrl: 'not a url', src })
    check(assert.equal, bad.runtime.startImagePendingJob('deck-1', HERO), null)
    const ok = runtimeWorld({ flag: 'true', src })
    for (const [id, index] of [['', 1], [null, 1], [undefined, 1], ['deck-1', -1], ['deck-1', 1.5], ['deck-1', Number.NaN], ['deck-1', '1']]) {
      check(assert.equal, ok.runtime.startImagePendingJob(id, index), null, `${JSON.stringify(id)} ${String(index)}`)
    }
    check(assert.equal, ok.layout.log.length, 0, 'nothing sent for a bad target')
  }
  // A job: real fetch with the configured base URL, the real clock and a uuid nonce.
  {
    const w = runtimeWorld({ flag: 'true', src })
    const job = w.runtime.startImagePendingJob('deck-1', HERO)
    check(assert.equal, job.jobId, 'studio-1760000000000-f47ac10b58cc')
    check(assert.equal, await job.started, 'written')
    check(assert.equal, w.layout.deck.slides[HERO].content.image_job_id, job.jobId)
    check(assert.equal, await job.end('ready'), 'written')
    check(assert.equal, w.layout.deck.slides[HERO].content.image_status, 'ready')
  }
  // The viewer has an unsaved edit: the write waits for "saved, nothing pending".
  {
    const w = runtimeWorld({ flag: 'true', src })
    w.win.post(saveEvent('unsaved', true))
    const job = w.runtime.startImagePendingJob('deck-1', HERO)
    await flush()
    check(assert.equal, w.layout.log.length, 0, 'nothing is sent while the viewer has an unsaved edit')
    w.win.post(saveEvent('saving', true))
    await flush()
    check(assert.equal, w.layout.log.length, 0, 'still saving')
    w.win.post(saveEvent('saved', false))
    check(assert.equal, await job.started, 'written')
    check(assert.equal, w.layout.puts().length, 1)
  }
  // The viewer never reports clean: the write goes ahead when the settle budget is spent, not before.
  {
    const w = runtimeWorld({ flag: 'true', src })
    w.win.post(saveEvent('error', true))
    const job = w.runtime.startImagePendingJob('deck-1', HERO)
    await flush()
    await w.clock.advance(7999)
    check(assert.equal, w.layout.log.length, 0, 'still waiting at 7.999 s')
    await w.clock.advance(1)
    check(assert.equal, await job.started, 'written', 'goes ahead at 8 s')
  }
  // A clean viewer, or none seen yet: no wait at all.
  {
    const w = runtimeWorld({ flag: 'true', src })
    const clean = w.runtime.startImagePendingJob('deck-1', HERO)
    check(assert.equal, await clean.started, 'written', 'no status seen yet')
    w.win.post(saveEvent('saved', false))
    const next = w.runtime.startImagePendingJob('deck-1', HERO)
    check(assert.equal, await next.started, 'written', 'clean')
    const other = runtimeWorld({ flag: 'true', src })
    other.win.post({ type: 'somethingElse', status: 'unsaved' })
    other.win.post(null)
    other.win.post('saveStatusChanged')
    check(assert.equal, await other.runtime.startImagePendingJob('deck-1', HERO).started, 'written', 'other messages are ignored')
  }
}

// ---------------------------------------------------------------- suite 4: the real hook
const GOOD_IMAGE_URL = 'https://img.example.test/hero.png'
const TEXTLABS_IMAGE = () => ({ success: true, element: { component_type: 'IMAGE', image_url: GOOD_IMAGE_URL, grid_position: { start_col: 1, start_row: 1, position_width: 32, position_height: 18 }, metadata: {}, generation_config: {} } })
const imageForm = () => ({
  componentType: 'IMAGE', prompt: 'A calm skyline at dusk', count: 1, layout: 'horizontal', advancedModified: false, z_index: 1, presentationId: 'deck-1', useDeckTheme: false,
  imageConfig: { operation: 'generate', style: 'photo', quality: 'standard', corners: 'square', border: false, placeholder_mode: false, auto_position: false,
    start_col: 1, start_row: 1, width: 32, height: 18, grid_row: '1/19', grid_column: '1/33', aspect_ratio: '16:9' },
  positionConfig: { start_col: 1, start_row: 1, position_width: 32, position_height: 18, auto_position: false },
})

function hookRuntime({ flag, studio = 'true', tree = TREE, src = {}, layout = fakeLayout(), reply = TEXTLABS_IMAGE(), gate = null, layoutUrl = BASE_URL, target = 'background', slideIndex = HERO, env = {}, failCommands = {} } = {}) {
  let now = 1760000000000, timerId = 0, uuid = 0, refCursor = 0, effectCursor = 0
  const timers = new Map(), refs = [], effectStates = [], pendingEffects = []
  const requests = [], commands = [], toasts = [], rest = []
  const win = makeWindow()
  const panel = { blankElementId: 'blank-1', isOpen: true, elementType: 'IMAGE', isGenerating: false, error: null, mode: 'generate',
    refineContext: null, researchMode: 'off', researchWeb: false, researchUploadedDocs: false, researchKnowledgeGraph: false }
  const blank = { elementId: 'blank-1', componentType: 'IMAGE', slideIndex, startCol: 1, startRow: 1, width: 32, height: 18, status: 'blank' }
  if (target !== 'blank') {
    const slotName = target === 'background' ? 'background' : target
    panel.mode = 'refine'; panel.blankElementId = null; panel.editElementId = 'bg-1'
    panel.refineContext = { elementId: 'bg-1', elementType: 'IMAGE', slideIndex, slotName, generationConfig: {},
      existingElement: { element_id: 'bg-1', component_type: 'IMAGE' }, research: {}, citationsUsed: [] }
  }
  const theme = { status: 'applied', requestId: 'theme-1', presentationId: 'deck-1', themeFingerprint: 'theme-a', error: null }
  const setTimer = (fn, ms) => { const id = ++timerId; timers.set(id, { at: now + ms, fn }); return id }
  const clearTimer = id => timers.delete(id)
  class ClockDate extends Date { static now() { return now } }
  const hookReact = {
    useRef(value) { const i = refCursor++; return refs[i] ??= { current: value } },
    useCallback: fn => fn,
    useEffect(fn, deps) {
      const i = effectCursor++, previous = effectStates[i]
      if (!previous || deps.some((v, j) => !Object.is(v, previous.deps[j]))) {
        pendingEffects.push(() => { previous?.cleanup?.(); effectStates[i] = { deps, cleanup: fn() } })
      }
    },
  }
  const fullEnv = { NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.example.test', NEXT_PUBLIC_STUDIO_V4_SHELL: studio, ...env }
  if (layoutUrl !== null) fullEnv.NEXT_PUBLIC_LAYOUT_SERVICE_URL = layoutUrl
  if (flag !== undefined) fullEnv[FLAG] = flag
  const warns = []
  let layoutSeq = 0
  const world = createWorld({
    env: fullEnv, src, tree, hookReact,
    globals: {
      Date: ClockDate, setTimeout: setTimer, clearTimeout: clearTimer, AbortController, AbortSignal, DOMException, FormData, Blob, URL, Error, Promise,
      crypto: { randomUUID: () => `synthetic-${++uuid}` },
      console: { log() {}, warn: (...a) => warns.push(a), error() {}, info() {} },
      fetch: async (url, init = {}) => {
        const text = String(url)
        if (text.startsWith(BASE_URL) || text.startsWith('https://other-layout.example.test')) {
          rest.push({ method: init.method ?? 'GET', url: text, body: init.body ? JSON.parse(init.body) : null })
          return layout.fetch(text, init)
        }
        if (!text.includes('textlabs.example.test')) return { ok: true, json: async () => ({}) }
        requests.push({ url: text, body: init.body })
        if (gate) {
          await new Promise((resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
            gate.then(resolve)
          })
        }
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => copy(reply) }
      },
    },
    globalsFor: rel => (rel === FILES.runtime ? { window: win } : {}),
  })
  const sendElementCommand = async (action, args) => {
    commands.push({ action, args: copy(args) })
    if (failCommands[action]) return { success: false, error: failCommands[action] }
    if (action === 'getElementGeometry') {
      return { success: true, action, elementId: args.elementId, position: { gridRow: '1/19', gridColumn: '1/33' }, componentType: 'IMAGE', zIndex: 1 }
    }
    if (action === 'insertImage' || action === 'insertTextBox') return { success: true, elementId: args.id ?? `layout-${action}-${++layoutSeq}` }
    return { success: true, elementId: args.elementId }
  }
  const methods = {
    setIsGenerating: value => { panel.isGenerating = value }, setError: value => { panel.error = value; panel.retryStrategy = null },
    setRetryStrategy: value => { panel.retryStrategy = value }, getSnapshot: () => ({ ...panel }), closePanel: () => { panel.isOpen = false },
    rememberDraftForElement: () => {}, openPanelForElement: () => {}, resumePanelForElement: () => {}, openPanelForRefine: () => {},
    completeBlankReplacement: () => { panel.mode = 'refine' }, changeElementType: () => {},
  }
  const params = {
    presentationId: 'deck-1', currentSlideIndex: slideIndex, researchCapabilities: {}, generationPanel: null,
    blankElements: { getElement: id => id === blank.elementId ? blank : undefined, updatePosition: () => {}, updateGenerationMetadata: () => {},
      setStatus: (_id, status) => { blank.status = status }, removeElement: () => { blank.status = 'removed' }, addElement: () => {}, trackElement: () => {} },
    textLabsSession: { ensureSession: async () => 'synthetic-session' },
    layoutServiceApis: { sendElementCommand },
    getThemeSyncSnapshot: () => theme, ensureThemeReady: async () => ({ ready: true, source: 'director', sync: theme }),
    toast: opts => toasts.push(opts),
  }
  params.layoutServiceApis.captureStudioElementGeneration = () => ({ sendElementCommand, isCurrent: () => params.presentationId === 'deck-1' })
  const hook = world.load(FILES.hook).useTextLabsGeneration
  let api
  function render() {
    refCursor = 0; effectCursor = 0
    params.generationPanel = { ...panel, ...methods }
    api = hook(params)
    while (pendingEffects.length) pendingEffects.shift()()
    return api
  }
  render()
  async function settle() {
    await flush()
    while (timers.size) {
      const [id, timer] = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      now = timer.at; timers.delete(id); timer.fn(); await flush()
    }
  }
  return { render, panel, blank, requests, commands, toasts, rest, layout, win, warns, settle, flush, get api() { return api },
    timerCount: () => timers.size,
    advance: async ms => { now += ms; for (;;) { const due = [...timers.entries()].filter(([, t]) => t.at <= now).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; timers.delete(due[0]); due[1].fn(); await flush() } await flush() } }
}

const mutating = run => run.commands.filter(c => /^(insert|upsert|delete)/.test(c.action))
async function hookJob(options = {}) {
  const run = hookRuntime(options)
  const promise = run.api.handleGenerate(imageForm())
  await run.settle()
  const outcome = await promise
  await run.settle()
  return {
    run, outcome,
    summary: copy({ requests: run.requests.map(r => ({ url: r.url, body: r.body })), commands: run.commands, toasts: run.toasts, error: run.panel.error, outcome, rest: run.rest }),
    layoutOnly: copy({ requests: run.requests.map(r => ({ url: r.url, body: r.body })), commands: run.commands, toasts: run.toasts, error: run.panel.error, outcome }),
  }
}
const storedOf = (layout, index = HERO) => [layout.deck.slides[index].content.image_status, layout.deck.slides[index].content.image_job_id]

const BACKGROUND_SCENARIOS = {
  background_refine_ok: { target: 'background', reply: TEXTLABS_IMAGE() },
  background_refine_error: { target: 'background', reply: { success: false, error: 'image service refused' } },
  blank_placeholder_ok: { target: 'blank', reply: TEXTLABS_IMAGE() },
}

async function hookSuite(src) {
  // ---- flag off, unset, or anything that is not the literal "true": the base's bytes and commands, no REST call, no listener
  const recorded = {}
  for (const [name, config] of Object.entries(BACKGROUND_SCENARIOS)) {
    const off = await hookJob({ ...config, flag: undefined, src })
    recorded[name] = digest(off.layoutOnly)
    check(assert.equal, off.run.rest.length, 0, `${name}: flag unset makes no request to Layout`)
    check(assert.equal, off.run.win.listeners.length, 0, `${name}: and listens to nothing`)
    if (!PRINT) check(assert.equal, recorded[name], BASE_DIGESTS[name], `${name}: flag off is byte-identical to the base (Text Labs bytes + every Layout command + toasts + outcome)`)
    for (const value of ['false', '', 'TRUE', 'True', '1', 'yes', ' true']) {
      const other = await hookJob({ ...config, flag: value, src })
      check(assert.equal, digest(other.layoutOnly), recorded[name], `${name}: flag ${JSON.stringify(value)} is still off`)
      check(assert.equal, other.run.rest.length, 0, `${name}: flag ${JSON.stringify(value)} makes no request to Layout`)
    }
    const legacy = await hookJob({ ...config, flag: undefined, studio: 'false', src })
    const legacyFalse = await hookJob({ ...config, flag: 'false', studio: 'false', src })
    check(assert.equal, digest(legacyFalse.layoutOnly), digest(legacy.layoutOnly), `${name}: studio shell off, flag off`)
  }
  if (PRINT) return recorded

  // ---- flag on, the hero background job: the Layout commands and Text Labs bytes are the flag-off ones
  const ON = 'true'
  for (const [name, config] of Object.entries(BACKGROUND_SCENARIOS)) {
    const on = await hookJob({ ...config, flag: ON, src })
    check(assert.equal, digest(on.layoutOnly), recorded[name], `${name}: flag on does not change a single Text Labs byte or Layout command`)
  }

  // pending while the job runs, ready when it ends
  {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const run = hookRuntime({ flag: ON, src, gate })
    const promise = run.api.handleGenerate(imageForm())
    await run.flush()
    check(assert.equal, run.requests.length, 1, 'the Text Labs request is out and held')
    const jobId = run.layout.deck.slides[HERO].content.image_job_id
    check(assert.match, jobId, /^studio-1760000000000-synthetic[0-9]+$/, 'the stored job id carries the start time')
    check(assert.deepEqual, storedOf(run.layout), ['pending', jobId], 'pending is STORED while the job runs')
    check(assert.deepEqual, run.rest.map(r => r.method), ['GET', 'PUT'])
    check(assert.equal, run.rest[0].url, `${BASE_URL}/api/presentations/deck-1`)
    check(assert.equal, run.rest[1].url, `${BASE_URL}/api/presentations/deck-1/slides`)
    check(assert.deepEqual, run.rest[1].body.slides, [{}, { image_status: 'pending', image_job_id: jobId }])
    check(assert.equal, run.panel.isGenerating, true)
    release()
    await run.settle()
    const outcome = await promise
    check(assert.equal, outcome.status, 'inserted')
    check(assert.deepEqual, storedOf(run.layout), ['ready', jobId], 'ready when the image went in')
    check(assert.deepEqual, run.rest.map(r => r.method), ['GET', 'PUT', 'GET', 'PUT'])
    check(assert.deepEqual, run.rest[3].body.slides, [{}, { image_status: 'ready', image_job_id: jobId }])
    check(assert.equal, run.layout.deck.slides[0].content.image_status, undefined, 'no other slide is touched')
    check(assert.equal, run.layout.deck.slides[2].content.image_status, undefined)
    check(assert.deepEqual, mutating(run).map(c => [c.action, c.args.elementId === 'bg-1' ? 'bg-1' : null]), [['insertImage', null], ['deleteElement', 'bg-1']], 'the picture went in and the empty background placeholder went out')
  }
  // failed when the job fails
  {
    const failed = await hookJob({ ...BACKGROUND_SCENARIOS.background_refine_error, flag: ON, src })
    check(assert.equal, failed.outcome.status, 'failed')
    const [status, jobId] = storedOf(failed.run.layout)
    check(assert.equal, status, 'failed')
    check(assert.match, jobId, /^studio-/)
    check(assert.deepEqual, failed.run.rest.map(r => r.method), ['GET', 'PUT', 'GET', 'PUT'])
    check(assert.equal, failed.run.rest[3].body.slides[HERO].image_job_id, failed.run.rest[1].body.slides[HERO].image_job_id, 'the same job id')
  }
  // failed when the image cannot be inserted (the viewer refuses it)
  {
    const refused = await hookJob({ flag: ON, src, failCommands: { insertImage: 'no room' } })
    check(assert.equal, refused.outcome.status, 'failed')
    const [status, jobId] = storedOf(refused.run.layout)
    check(assert.equal, status, 'failed', 'a refused insert clears the pending state to failed')
    check(assert.match, jobId, /^studio-/)
  }
  // failed when the request times out (the generation timeout aborts it)
  {
    const gate = new Promise(() => {})   // Text Labs never answers
    const run = hookRuntime({ flag: ON, src, gate })
    const promise = run.api.handleGenerate(imageForm())
    await run.flush()
    check(assert.deepEqual, storedOf(run.layout)[0], 'pending')
    await run.settle()   // the timer fires the abort
    const outcome = await promise
    await run.settle()
    check(assert.equal, outcome.status, 'failed')
    check(assert.equal, storedOf(run.layout)[0], 'failed', 'a timeout clears the pending state')
  }
  // the job does not wait for either write: a Layout that never answers leaves the generation untouched
  {
    const layout = fakeLayout()
    layout.state.holdGet = new Promise(() => {})
    const run = hookRuntime({ flag: ON, src, layout })
    const promise = run.api.handleGenerate(imageForm())
    await run.settle()
    const outcome = await promise
    check(assert.equal, outcome.status, 'inserted', 'a stuck Layout read does not stall or fail the job')
    check(assert.equal, run.panel.isGenerating, false, 'the panel is released')
    check(assert.deepEqual, mutating(run).map(c => c.action), ['insertImage', 'deleteElement'])
  }
  // a Layout that errors never fails the job either; the failure is logged
  {
    const layout = fakeLayout()
    layout.state.throwFetch = true
    const job = await hookJob({ flag: ON, src, layout })
    check(assert.equal, job.outcome.status, 'inserted')
    check(assert.ok, job.run.warns.length > 0, 'and it is logged')
  }
  // slides moved while the job ran: the clear lands on the hero's new position
  {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const run = hookRuntime({ flag: ON, src, gate })
    const promise = run.api.handleGenerate(imageForm())
    await run.flush()
    const before = copy(run.layout.deck.slides)
    run.layout.deck.slides.unshift(slide('s-new', 'H3'))
    release()
    await run.settle()
    check(assert.equal, (await promise).status, 'inserted')
    const jobId = run.rest[1].body.slides[HERO].image_job_id
    check(assert.deepEqual, run.rest[3].body.slides, [{}, {}, { image_status: 'ready', image_job_id: jobId }])
    check(assert.deepEqual, storedOf(run.layout, 2), ['ready', jobId])
    check(assert.equal, run.layout.deck.slides[HERO].content.image_status, undefined)
    check(assert.equal, before.length + 1, run.layout.deck.slides.length)
  }
  // the slide at the position is not a hero (the position drifted): nothing is written, the job runs as ever
  {
    const layout = fakeLayout({ slides: [slide('s0', 'C1'), slide('s1', 'C1'), slide('s2', 'H2')] })
    const job = await hookJob({ flag: ON, src, layout })
    check(assert.equal, job.outcome.status, 'inserted')
    check(assert.deepEqual, job.run.rest.map(r => r.method), ['GET'], 'one read, no write')
  }
  // the viewer has an unsaved edit when the job starts: the write waits for the clean save
  {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const run = hookRuntime({ flag: ON, src, gate })
    run.win.post(saveEvent('unsaved', true))
    const promise = run.api.handleGenerate(imageForm())
    await run.flush()
    check(assert.equal, run.rest.length, 0, 'nothing is sent while the viewer has an unsaved edit')
    run.win.post(saveEvent('saved', false))
    await run.flush()
    check(assert.deepEqual, storedOf(run.layout)[0], 'pending', 'written once the viewer is clean')
    release()
    await run.settle()
    await promise
    check(assert.deepEqual, storedOf(run.layout)[0], 'ready')
  }
  // Layout not configured: no request, the job runs
  {
    const job = await hookJob({ flag: ON, src, layoutUrl: null })
    check(assert.equal, job.outcome.status, 'inserted')
    check(assert.equal, job.run.rest.length, 0)
  }
  // the request goes to the configured Layout, whatever it is
  {
    const layout = fakeLayout()
    const job = await hookJob({ flag: ON, src, layout, layoutUrl: 'https://other-layout.example.test' })
    check(assert.ok, job.run.rest.every(r => r.url.startsWith('https://other-layout.example.test/')))
  }
  // no write for any other image job
  for (const [name, options] of [
    ['a blank Add Element placeholder', { target: 'blank' }],
    ['a logo slot', { target: 'logo' }],
    ['a content image slot', { target: 'image' }],
  ]) {
    const job = await hookJob({ flag: ON, src, ...options })
    check(assert.equal, job.run.rest.length, 0, `${name}: no request to Layout`)
    check(assert.equal, job.run.layout.deck.slides[HERO].content.image_status, undefined, `${name}: nothing stored`)
  }
}

// ---------------------------------------------------------------- suite 5: identity
function stripMarked(source) {
  source = stripChatElementRefine('hooks/use-textlabs-generation.ts', source) // NEXT_PUBLIC_CHAT_ELEMENT_REFINE
  source = stripChatAddTargeted('hooks/use-textlabs-generation.ts', source) // LATER-CHANGES: registry read (CHAT-ADD-TARGETED)
  const out = []
  let inBlock = false
  for (const line of source.split('\n')) {
    if (line.includes(`// ${MARK} begin`)) { inBlock = true; continue }
    if (line.includes(`// ${MARK} end`)) { inBlock = false; continue }
    if (inBlock || line.includes(`// ${MARK}`)) continue
    out.push(line)
  }
  return out.join('\n')
}
async function identitySuite(src) {
  const hook = src.hook ?? SRC.hook
  check(assert.equal, sha256(stripMarked(hook)), BASE_HOOK_SHA256, 'with the marked lines removed the hook is the base file')
  const marked = hook.split('\n').filter(line => line.includes(MARK))
  check(assert.equal, marked.length, 8, 'three blocks (begin + end each) and the two single marked lines')
  check(assert.equal, (hook.match(/STUDIO_IMAGE_PENDING_WRITE_ENABLED/g) ?? []).length, 2, 'the flag is read in the import and in the one start condition only')
  check(assert.equal, (hook.match(/imagePendingJob\.end\(/g) ?? []).length, 1)
  check(assert.equal, (hook.match(/startImagePendingJob\b/g) ?? []).length, 2, 'import + one call')
  check(assert.equal, /process\.env\.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE/.test(hook), false, 'the hook does not read the flag itself')
  const runtime = src.runtime ?? SRC.runtime
  check(assert.equal, /process\.env\.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE/.test(runtime), false, 'the runtime does not read the flag itself either')
  check(assert.equal, (runtime.match(/^if \(STUDIO_IMAGE_PENDING_WRITE_ENABLED\)/gm) ?? []).length, 1, 'the one top-level side effect is gated')
  check(assert.equal, /process\.env\.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE === 'true'/.test(src.lib ?? SRC.lib), true, 'the flag is the exact literal')
  const envex = src.env ?? ENVEX
  const lines = envex.split('\n').filter(l => l.startsWith('NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE='))
  check(assert.deepEqual, lines, ['NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE="false"'], '.env.example documents the flag, off')
  const at = envex.indexOf('NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE=')
  check(assert.ok, envex.slice(Math.max(0, at - 1500), at).includes('IMAGE-PENDING-WRITE'), 'with a comment above it')
}

const SUITES = { helper: helperSuite, writer: writerSuite, runtime: runtimeSuite, hook: hookSuite, identity: identitySuite }

// ---------------------------------------------------------------- run
if (PRINT) {
  console.log(JSON.stringify(await hookSuite({}), null, 2))
  process.exit(0)
}
// A suite that waits for something a broken source never delivers must fail, not hang.
async function runSuite(suite, src, ms) {
  let timer
  try {
    await Promise.race([suite(src), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`suite timed out after ${ms} ms`)), ms) })])
  } finally { clearTimeout(timer) }
}
for (const [name, suite] of Object.entries(SUITES)) {
  await runSuite(suite, {}, 30_000)
  console.log(`ok   ${name}`)
}
const REAL_CHECKS = checks

// ---------------------------------------------------------------- mutants
const MUTANTS = []
if (process.env.IPW_NO_MUTANTS !== '1') {
  const lib = (label, from, to) => MUTANTS.push([`lib: ${label}`, { lib: s => replaceOnce(s, from, to) }])
  const rt = (label, from, to) => MUTANTS.push([`runtime: ${label}`, { runtime: s => replaceOnce(s, from, to) }])
  const hk = (label, from, to) => MUTANTS.push([`hook: ${label}`, { hook: s => replaceOnce(s, from, to) }])
  lib('any slot name writes', "job.slotName === HERO_BACKGROUND_SLOT_NAME", "typeof job.slotName === 'string'")
  lib('any component writes', "job.componentType === 'IMAGE' && ", '')
  lib('slot name case-insensitive', "job.slotName === HERO_BACKGROUND_SLOT_NAME", "String(job.slotName).toLowerCase() === HERO_BACKGROUND_SLOT_NAME")
  lib('H3 is not a hero', "['H1s', 'H2', 'H3']", "['H1s', 'H2']")
  lib('every layout is a hero', "!HERO_LAYOUTS.includes(slide.layout)", 'false')
  lib('the slide id is ignored', "const index = slideId ? slides.findIndex(slide => (slide as { slide_id?: unknown } | null)?.slide_id === slideId) : slideIndex", 'const index = slideIndex')
  lib('the position wins over the id', "const index = slideId ? slides.findIndex(", "const index = slideIndex >= 0 && slides[slideIndex] ? slideIndex : slideId ? slides.findIndex(")
  lib('the batch is one empty object short', 'Array.from({ length: slideIndex + 1 }', 'Array.from({ length: slideIndex }')
  lib('the batch has no empty objects', '(index === slideIndex ? { ...fields } : {})', '(index === slideIndex ? { ...fields } : { ...fields })')
  lib('the batch takes a fractional index', 'if (!Number.isInteger(slideIndex) || slideIndex < 0) return null', 'if (slideIndex < 0) return null')
  lib('the job id loses its prefix', 'return `studio-${stamp}-${clean}`', 'return `job-${stamp}-${clean}`')
  lib('the job id loses its start time', 'return `studio-${stamp}-${clean}`', 'return `studio-0-${clean}`')
  lib('the nonce is not cleaned', ".replace(/[^A-Za-z0-9]/g, '')", '')
  lib('the nonce is not capped', '.slice(0, 12) || ', ' || ')
  lib('the status field is renamed', "export const IMAGE_STATUS_FIELD = 'image_status'", "export const IMAGE_STATUS_FIELD = 'background_image_status'")
  lib('the job id field is renamed', "export const IMAGE_JOB_ID_FIELD = 'image_job_id'", "export const IMAGE_JOB_ID_FIELD = 'job_id'")
  lib('the start writes queued', "imageStatusFields('pending', jobId)", "imageStatusFields('queued' as never, jobId)")
  lib('the end ignores the outcome', 'imageStatusFields(outcome, jobId)', "imageStatusFields('ready', jobId)")
  lib('the end is not once', 'ended ??= (async () => {', 'ended = (async () => {')
  lib('the end does not wait for the start', 'const start = await started', 'const start = await Promise.resolve(\'written\' as ImagePendingWriteResult)')
  lib('a start that may be stored is not cleared', 'if (start !== \'written\' && !mayBeStored) return \'skipped\'', "if (start !== 'written') return 'skipped'")
  lib('a start that wrote nothing still tries a clear', 'if (start !== \'written\' && !mayBeStored) return \'skipped\'', "if (false) return 'skipped'")
  lib('the clear is not checked against the job id', 'if (located.storedJobId !== jobId) return \'not-ours\'', "if (false) return 'not-ours'")
  lib('the clear needs no job id match, only a stored one', 'if (located.storedJobId !== jobId) return \'not-ours\'', "if (located.storedJobId === null) return 'not-ours'")
  lib('the end re-reads with the start position, not the id', 'locateHeroSlide(await readDeck(), target.slideIndex, slideId)', 'locateHeroSlide(await readDeck(), target.slideIndex, null)')
  lib('the id is not remembered', 'slideId = located.slideId\n', '\n')
  lib('no retry', 'try { return await pass() } catch (first) {', 'try { return await pass() } catch (first) { throw first\n')
  lib('retry without delay', 'await deps.sleep(IMAGE_PENDING_RETRY_DELAY_MS)', 'void 0')
  lib('retry delay changed', 'export const IMAGE_PENDING_RETRY_DELAY_MS = 1_500', 'export const IMAGE_PENDING_RETRY_DELAY_MS = 500')
  lib('the start does not wait for the viewer', "await deps.settleViewer()\n      return await twice(async () => {\n        const located = locateHeroSlide(await readDeck(), target.slideIndex, null)", "return await twice(async () => {\n        const located = locateHeroSlide(await readDeck(), target.slideIndex, null)")
  lib('the end does not wait for the viewer', "try {\n          await deps.settleViewer()\n          return await twice", "try {\n          return await twice")
  lib('the deck is read from the cache', "{ cache: 'no-store' }", '{}')
  lib('the presentation id is not encoded', 'encodeURIComponent(target.presentationId)', 'target.presentationId')
  lib('the base url keeps its slashes', ".replace(/\\/+$/, '')", '')
  lib('wrong updated_by', 'updated_by: IMAGE_PENDING_UPDATED_BY', "updated_by: 'user'")
  lib('no content type', "headers: { 'Content-Type': 'application/json' },", '')
  lib('a failed write is not an error', "if (!response.ok) throw new Error(`Layout answered ${response.status} to the slide write`)", '')
  lib('a failed read is not an error', "if (!response.ok) throw new Error(`Layout answered ${response.status} to the deck read`)", '')
  lib('a failed start throws', "deps.warn('[ImagePending] could not store the pending state', error)\n      return 'failed'", "throw error")
  lib('a failed clear throws', "deps.warn('[ImagePending] could not clear the pending state', error)\n          return 'failed'", "throw error")
  lib('the flag is on for anything but false', "process.env.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE === 'true'", "process.env.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE !== 'false'")
  lib('the flag is case-insensitive', "process.env.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE === 'true'", "String(process.env.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE).toLowerCase() === 'true'")
  lib('the flag is on by default', "process.env.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE === 'true'", "process.env.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE !== 'off'")
  lib('an import is added', 'export const STUDIO_IMAGE_PENDING_WRITE_ENABLED', "import { x } from '@/lib/x'\nexport const STUDIO_IMAGE_PENDING_WRITE_ENABLED")
  lib('the settle budget changed', 'export const IMAGE_PENDING_SETTLE_MS = 8_000', 'export const IMAGE_PENDING_SETTLE_MS = 1_000')
  lib('the contract window changed', 'export const IMAGE_PENDING_WINDOW_MS = 10 * 60 * 1000', 'export const IMAGE_PENDING_WINDOW_MS = 60 * 1000')
  rt('the listener is installed without the flag', 'if (STUDIO_IMAGE_PENDING_WRITE_ENABLED) viewerSaveTracker()', 'viewerSaveTracker()')
  rt('the listener is never installed', 'if (STUDIO_IMAGE_PENDING_WRITE_ENABLED) viewerSaveTracker()', 'void 0')
  rt('the listener feeds nothing', 'window.addEventListener(\'message\', event => tracker?.record(event.data))', "window.addEventListener('message', () => {})")
  rt('a second listener per job', 'if (tracker || typeof window === \'undefined\') return tracker', "if (typeof window === 'undefined') return tracker")
  rt('no Layout url still returns a job', 'return null\n  }\n  const deps', 'void 0\n  }\n  const deps')
  rt('the service url is read from the wrong variable', "name: 'NEXT_PUBLIC_LAYOUT_SERVICE_URL', value: process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL", "name: 'NEXT_PUBLIC_LAYOUT_SERVICE_URL', value: process.env.NEXT_PUBLIC_ELEMENTOR_URL")
  rt('a bad slide index is accepted', '!Number.isInteger(slideIndex) || slideIndex < 0', 'false')
  rt('an empty presentation id is accepted', '!presentationId || ', '')
  rt('the viewer is never waited for', 'await saves.waitForClean(IMAGE_PENDING_SETTLE_MS).promise', 'void 0')
  rt('the viewer wait is unbounded', 'waitForClean(IMAGE_PENDING_SETTLE_MS)', 'waitForClean(1e12)')
  rt('a clean viewer is waited for too', '|| isCleanSaveEvent(saves.last())) return', '|| false) return')
  rt('an unseen viewer is waited for', '!saves.last() || ', '')
  rt('the clock is not the real one', 'now: () => Date.now()', 'now: () => 0')
  rt('the nonce is constant', 'nonce: randomNonce', "nonce: () => 'x'")
  hk('the start is not gated by the flag', 'if (STUDIO_IMAGE_PENDING_WRITE_ENABLED && imageJobWritesPending(', 'if (imageJobWritesPending(')
  hk('every image job writes', "imageJobWritesPending({ componentType: formData.componentType, slotName: formData.slotName })", "formData.componentType === 'IMAGE'")
  hk('the slot name is not passed', "slotName: formData.slotName })", 'slotName: null })')
  hk('the wrong slide index', 'startImagePendingJob(expectedPresentationTarget.presentationId ?? \'\', generationSlideIndex)', "startImagePendingJob(expectedPresentationTarget.presentationId ?? '', 0)")
  hk('the wrong presentation id', "startImagePendingJob(expectedPresentationTarget.presentationId ?? ''", "startImagePendingJob('deck-2'")
  hk('the outcome starts as ready', "let imagePendingOutcome: ImageJobEnd = 'failed'", "let imagePendingOutcome: ImageJobEnd = 'ready'")
  hk('the outcome is never ready', "imagePendingOutcome = 'ready' // IMAGE-PENDING-WRITE", 'void 0 // IMAGE-PENDING-WRITE')
  hk('the end is never sent', 'if (imagePendingJob) void imagePendingJob.end(imagePendingOutcome)', 'void 0')
  hk('the end is awaited', 'if (imagePendingJob) void imagePendingJob.end(imagePendingOutcome)', 'if (imagePendingJob) await imagePendingJob.end(imagePendingOutcome)')
  hk('the end is sent as ready always', 'void imagePendingJob.end(imagePendingOutcome)', "void imagePendingJob.end('ready')")
  hk('the start never happens', 'if (STUDIO_IMAGE_PENDING_WRITE_ENABLED && imageJobWritesPending(', 'if (false && imageJobWritesPending(')
  hk('an unmarked line is added', "      const sessionId = await textLabsSession.ensureSession(controller.signal)\n", "      const sessionId = await textLabsSession.ensureSession(controller.signal)\n      void 0\n")
  hk('the flag is read by the hook itself', 'if (STUDIO_IMAGE_PENDING_WRITE_ENABLED && imageJobWritesPending(', "if (process.env.NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE === 'true' && imageJobWritesPending(")
  MUTANTS.push(['env: the flag line is gone', { env: s => replaceOnce(s, 'NEXT_PUBLIC_STUDIO_IMAGE_PENDING_WRITE="false"\n', '') }])
}
let caught = 0
for (const [label, mutation] of MUTANTS) {
  const src = {}
  let failedIn = null
  for (const [key, fn] of Object.entries(mutation)) src[key] = fn(key === 'env' ? ENVEX : SRC[key])
  // A mutant must be valid code: one that does not even compile proves nothing.
  for (const [key, text] of Object.entries(src)) if (key !== 'env') compile(FILES[key], text)
  for (const [name, suite] of Object.entries(SUITES)) {
    try { await runSuite(suite, src, 6_000) } catch { failedIn = name; break }
  }
  assert.ok(failedIn, `mutant NOT caught: ${label}`)
  caught++
  if (process.env.VERBOSE) console.log(`     caught by [${failedIn}]: ${label}`)
}
console.log(`ok   mutants: ${caught} of ${MUTANTS.length} caught`)
console.log(`PASS: studio image pending write (${REAL_CHECKS} checks, ${MUTANTS.length} mutants)`)
