// FRONTEND-2: a chat add-slide was counted twice (flag NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE, exact "true", default off).
// Run: node scripts/test-studio-deck-mutation-dedupe.mjs   (plain node: transpile + vm, no network; `git show` reads the base commit)
//
// What it replays: DIRECTOR-2's RECORDED Director frames (Decision B preview, scripts/fixtures/studio-deck-mutation-dedupe/, byte
// copies of streams/director2/preview-b/frames/), with the Layout calls the preview made at the same points (DELETE slide 2 after
// "Deleting slide 3...", POST at index 3 after the add-slide receipt) on an in-memory Layout that serves the real inventory route.
// What runs for real: the page's own onDeckMutation handler and settler wiring (cut out of app/builder/page.tsx and evaluated),
// planDeckMutationRefresh, the dedupe lib, fetchSlideInventory/parseSlideInventory (the rail list's read), resolveEffectivePresentation,
// withSlideComposerRefreshToken, resolveSlideComposeCountAfterReady, resolveSlideComposeViewerState and syncedFooterTotal.
// What is modelled (each rule pinned to its source line below, so the model cannot drift): slide_ready's compose reconcile commit,
// the viewer's totalSlides/visualTotalSlides prop effect and poll, the page's raise-only Layout count reconcile, and the rail
// header (strip totalSlides), the footer, the rail list (Layout inventory) and the canvas (Layout iframe sections).
//
// The DIRECTOR-2 finding it reproduces (flag off, chat flags on): after e-add, rail header 7, footer "Slide 1 / 7", rail list 6, canvas 6.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const repoRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const BASE_COMMIT = '1079ba4b7cd277ece7cc46ee7624d74419c3a5aa' // studio-v4-dev-preparation-code when this change branched
const FIXTURES = path.join(repoRoot, 'scripts/fixtures/studio-deck-mutation-dedupe')
const LIB = 'lib/studio-deck-mutation-dedupe.ts'
const PAGE = 'app/builder/page.tsx'
const FLAG = 'NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE'
const SHARED_APPEND_ONLY = ['.env.example', 'package.json']

const read = rel => readFileSync(path.join(repoRoot, rel), 'utf8')
const readIf = rel => existsSync(path.join(repoRoot, rel)) ? read(rel) : null
const baseCache = new Map()
const baseSource = rel => {
  if (!baseCache.has(rel)) {
    try { baseCache.set(rel, execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })) }
    catch (error) { throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history): ${error.message}`) }
  }
  return baseCache.get(rel)
}
const sha = text => createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))

// ---------- module loading (import-free libs; @/lib/* resolved inside the same loader) ----------
function transpile(text) {
  return ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
}
function makeLoader(sources, env, globals) {
  const cache = new Map()
  const load = rel => {
    if (cache.has(rel)) return cache.get(rel)
    const module = { exports: {} }
    cache.set(rel, module.exports)
    const text = sources[rel] ?? null
    if (text == null) { cache.set(rel, null); return null }
    vm.runInNewContext(transpile(text), { module, exports: module.exports, process: { env }, URL, Response, ...globals,
      require: spec => {
        if (spec.startsWith('@/lib/')) return load(`lib/${spec.slice(6)}.ts`)
        throw Error(`unexpected import ${spec}`)
      } })
    cache.set(rel, module.exports)
    return module.exports
  }
  return load
}

// Cut a balanced {...} body that starts at the first `=> {` after `anchor`.
function cutArrow(text, anchor) {
  const at = text.indexOf(anchor)
  if (at < 0) return null
  const start = text.indexOf('(', at)
  const open = text.indexOf('=> {', at) + 3
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1)
  }
  return null
}
const SETTLER_START = '  // NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE: a deck_mutation\'s count comes from Layout'
function cutSettler(text) {
  const at = text.indexOf('  const deckMutationCountSettlerRef = useRef(')
  if (at < 0) return null
  const end = text.indexOf('}) : null)\n', at)
  return end < 0 ? null : text.slice(at, end + '}) : null)'.length)
}
function cutFunction(text, name) {
  const at = text.indexOf(`function ${name}(`)
  if (at < 0) return null
  let depth = 0
  for (let i = text.indexOf('{', at); i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return text.slice(at, i + 1)
  }
  return null
}
const PAGE_DEPS = ['slideComposerPresentationRef', 'planDeckMutationRefresh', 'deckMutationSeenRef', 'setSlideComposerOverride',
  'requestSlideRailRefresh', 'reportDeckChange', 'deckMutationCountSettlerRef', 'useRef', 'STUDIO_DECK_MUTATION_DEDUPE_ENABLED',
  'createDeckMutationCountSettler', 'fetchSlideInventory', 'getLayoutServiceUrl', 'fetch', 'Date']
function evalPageSnippet(snippet, returnExpr, globals, declares = []) {
  const module = { exports: {} }
  const names = PAGE_DEPS.filter(name => !declares.includes(name))
  vm.runInNewContext(transpile(`module.exports = function (deps) { const { ${names.join(', ')} } = deps;\n${snippet}\nreturn ${returnExpr} }`),
    { module, exports: module.exports, ...globals })
  return module.exports
}

// ---------- the sources one run uses ----------
const LIBS = ['lib/studio-deck-mutation-refresh.ts', LIB, 'lib/slide-rail-identity.ts', 'lib/builder-presentation-ownership.ts',
  'lib/slide-compose-async.ts', 'lib/studio-slide-count-sync.ts']
function sourceSet(which, overrides = {}) {
  const get = which === 'base' ? rel => (rel === LIB ? null : baseSource(rel)) : readIf // the lib is new in this change
  const sources = {}
  for (const rel of [...LIBS, PAGE]) sources[rel] = rel in overrides ? overrides[rel] : get(rel)
  return sources
}

// ---------- in-memory Layout (inventory + the two writes the preview made) ----------
function createLayout(presentationId, titles, { inventory = 'ok' } = {}) {
  const slides = titles.map((title, i) => ({ slide_id: `slide_${String(i + 1).padStart(4, '0')}`, title }))
  const calls = []
  return {
    calls,
    count: () => slides.length,
    insert(index, slideId, title) { slides.splice(index, 0, { slide_id: slideId, title }); calls.push(['POST', index]) },
    remove(index) { slides.splice(index, 1); calls.push(['DELETE', index]) },
    fetch: async url => {
      calls.push(['GET', String(url).replace(/^.*\/api\//, '/api/')])
      const want = `/api/presentations/${encodeURIComponent(presentationId)}/slides/inventory`
      if (inventory === 'absent' || !String(url).endsWith(want)) return new Response('', { status: 404 })
      if (inventory === 'error') throw new TypeError('Failed to fetch')
      return new Response(JSON.stringify({ presentation_id: presentationId, slide_count: slides.length,
        slides: slides.map((s, i) => ({ slide_index: i, slide_id: s.slide_id, title: s.title, layout: 'C1', thumbnail_url: null })) }),
        { status: 200, headers: { 'content-type': 'application/json' } })
    },
  }
}

// ---------- one replay ----------
// order: 'ready-first' = slide_ready's reconcile lands before the deck_mutation (the preview's timing: frames 0.4 s apart, a local
// reconcile takes milliseconds); 'mutation-first' = the reconcile is still in flight when the deck_mutation is handled.
async function replay(transcript, { sources, dedupe, refreshFlag = true, order = 'ready-first', inventory = 'ok' }) {
  const env = { NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED: refreshFlag ? 'true' : 'false', NEXT_PUBLIC_STUDIO_SLIDE_COUNT_SYNC_ENABLED: 'true' }
  if (dedupe) env[FLAG] = 'true'
  const timers = []
  const clock = { t: 1_800_000_000_000 }
  const globals = { setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length }, Date: { now: () => clock.t } }
  const load = makeLoader(sources, env, globals)
  const refresh = load('lib/studio-deck-mutation-refresh.ts')
  const dedupeLib = load(LIB)
  const rail = load('lib/slide-rail-identity.ts')
  const ownership = load('lib/builder-presentation-ownership.ts')
  const compose = load('lib/slide-compose-async.ts')
  const countSync = load('lib/studio-slide-count-sync.ts')
  const page = sources[PAGE]
  const withToken = evalPageSnippet(cutFunction(page, 'withSlideComposerRefreshToken'), 'withSlideComposerRefreshToken', {})({})

  const start = transcript.session_at_start
  const PID = 'pres-local-1'
  const LAYOUT = 'http://127.0.0.1:8641'
  const liveUrl = `${LAYOUT}/p/${PID}`
  const layout = createLayout(PID, start.slide_titles ?? [], { inventory })
  const live = { presentationUrl: start.presentation_id ? liveUrl : null, presentationId: start.presentation_id ? PID : null,
    slideCount: start.presentation_id ? (start.slide_titles ?? []).length : null }
  const trace = []
  const builder = { override: null }
  const ref = { current: { presentationUrl: live.presentationUrl, presentationId: live.presentationId, slideCount: live.slideCount, activeVersion: 'final', refreshToken: 0 } }
  const setSlideComposerOverride = value => { builder.override = plain(value); trace.push(['override', plain(value)]); render() }
  const deckChanges = []
  const viewer = { url: undefined, totalSlides: 0, visual: 0, canvas: 0, railList: 0, railReads: 0 }
  const effective = () => ownership.resolveEffectivePresentation({ livePresentationUrl: live.presentationUrl,
    livePresentationId: live.presentationId, liveSlideCount: live.slideCount, override: builder.override })
  const readRail = () => { viewer.railReads++; viewer.railList = layout.count() }
  const off = refresh.onSlideRailRefreshRequest(id => { if (id === effective().presentationId) readRail() })
  let lastLocalCountKey = null
  const pendingRaises = []
  function render() {
    const eff = effective()
    // page useEffect: the ref follows the effective deck (directorOwnedPresentation).
    ref.current = { presentationUrl: eff.presentationUrl, presentationId: eff.presentationId, slideCount: eff.slideCount, activeVersion: 'final', refreshToken: eff.refreshToken }
    const url = withToken(eff.presentationUrl, eff.refreshToken)
    const slideCount = eff.slideCount
    // viewer: totalSlides follows the prop (exact on a new URL, else raise-only); a new URL reloads the iframe.
    const changed = viewer.url !== url
    if (changed) { viewer.canvas = layout.count(); trace.push(['iframe', url, viewer.canvas]) }
    if (slideCount && slideCount > 0) {
      const presentationChanged = viewer.lastPropUrl !== url
      viewer.lastPropUrl = url
      const prevTotal = viewer.totalSlides
      viewer.totalSlides = presentationChanged ? slideCount : Math.max(viewer.totalSlides, slideCount)
      viewer.visual = presentationChanged ? slideCount : Math.max(viewer.visual, slideCount)
      if (viewer.totalSlides !== prevTotal) readRail() // refreshSignals: [totalSlides, ...]
    }
    viewer.url = url
    // page: raise-only Layout count reconcile, keyed by `${id}:${localSlideCount}`.
    if (eff.presentationId) {
      const key = `${eff.presentationId}:${Math.max(0, eff.slideCount ?? 0)}`
      if (key !== lastLocalCountKey) { lastLocalCountKey = key; pendingRaises.push(Math.max(0, eff.slideCount ?? 0)) }
    }
  }
  function poll() {
    if (!viewer.url) return
    const data = { real_slide_count: viewer.canvas, visual_section_count: viewer.canvas, current_visual_index: 0 }
    const verifiedMinimumTotal = Math.max(0, viewer.totalSlides || 0, (effective().slideCount) || 0)
    const { realTotal, visualTotal: resolvedVisual } = compose.resolveSlideComposeViewerState(data, verifiedMinimumTotal)
    const total = Math.max(realTotal, verifiedMinimumTotal)
    const visualTotal = Math.max(resolvedVisual, total)
    if (viewer.totalSlides !== total) { viewer.totalSlides = total; readRail() }
    viewer.visual = visualTotal
  }
  async function settleAll() {
    for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve))
    while (pendingRaises.length) {
      const local = pendingRaises.shift()
      const layoutCount = layout.count()
      if (layoutCount <= local) continue // `presentation.slideCount <= localSlideCount) return`
      const latest = ref.current
      const nextOverride = { presentationUrl: latest.presentationUrl ?? live.presentationUrl, presentationId: latest.presentationId, slideCount: layoutCount, refreshToken: clock.t }
      ref.current = { ...latest, ...nextOverride }
      setSlideComposerOverride(nextOverride)
    }
    poll()
  }

  // page wiring, cut from the page source under test
  const pageDeps = { slideComposerPresentationRef: ref, planDeckMutationRefresh: refresh.planDeckMutationRefresh,
    deckMutationSeenRef: { current: refresh.createDeckMutationSeen() }, setSlideComposerOverride,
    requestSlideRailRefresh: refresh.requestSlideRailRefresh, reportDeckChange: kind => deckChanges.push(kind),
    useRef: value => ({ current: value }), STUDIO_DECK_MUTATION_DEDUPE_ENABLED: dedupeLib?.STUDIO_DECK_MUTATION_DEDUPE_ENABLED ?? false,
    createDeckMutationCountSettler: dedupeLib?.createDeckMutationCountSettler, fetchSlideInventory: rail.fetchSlideInventory,
    getLayoutServiceUrl: () => LAYOUT, fetch: layout.fetch, Date: globals.Date }
  const settlerText = cutSettler(page)
  pageDeps.deckMutationCountSettlerRef = settlerText ? evalPageSnippet(settlerText, 'deckMutationCountSettlerRef', { ...globals, process: { env } }, ['deckMutationCountSettlerRef'])(pageDeps) : { current: null }
  const handlerText = cutArrow(page, 'onDeckMutation: (message')
  const onDeckMutation = refreshFlag && handlerText ? evalPageSnippet('', `(${handlerText})`, globals)(pageDeps) : null

  // slide_ready, compose kind, live reconcile success (page onSlideComposeReady): the viewer's composeSlideReconcile answers
  // with Layout's real_slide_count; the page commits resolveSlideComposeCountAfterReady(...) under refreshToken = Date.now().
  const reconcile = (payload, latest) => {
    const viewerSlideCount = layout.count()
    const resolvedVisualIndex = Math.max(0, payload.slide_index)
    const existingDeck = !!latest.presentationId && PID === latest.presentationId
    const nextSlideCount = compose.resolveSlideComposeCountAfterReady({ currentSlideCount: latest.slideCount, existingDeck, resolvedVisualIndex, viewerSlideCount })
    const nextOverride = { presentationUrl: latest.presentationUrl ?? liveUrl, presentationId: PID, slideCount: nextSlideCount, refreshToken: clock.t }
    ref.current = { ...latest, ...nextOverride }
    viewer.canvas = layout.count() // the live swap inserts the section into the mounted iframe
    setSlideComposerOverride(nextOverride)
  }

  render(); await settleAll()
  const before = { header: viewer.totalSlides, footer: countSync.syncedFooterTotal({ visualTotalSlides: viewer.visual, totalSlides: viewer.totalSlides, slideCount: effective().slideCount, partialArtifact: false }), rail: viewer.railList, canvas: viewer.canvas }
  const composes = [...(transcript.stubbed_outside_world?.composes ?? [])]
  const deletes = [...(transcript.stubbed_outside_world?.layout_deletes ?? [])]
  let deferred = null
  let lastTurn = -1
  for (const { turn, direction, frame } of transcript.frames) {
    if (direction !== 'out') continue
    if (turn !== lastTurn) { lastTurn = turn; clock.t += 3000 } else clock.t += 400
    const f = JSON.parse(JSON.stringify(frame).replaceAll(start.presentation_id ?? '\u0000', PID)
      .replaceAll(`https://layout.synthetic.invalid/p/${PID}`, liveUrl))
    trace.push(['frame', f.type])
    if (f.type === 'chat_message') {
      const text = f.payload?.text ?? ''
      if (/^Deleting slide/.test(text) && deletes.length) layout.remove(deletes.shift()[1])
      if (/^On it/.test(text) && composes.length) {
        const c = composes.shift()
        layout.insert(c.insert_after_index + 1, 'real-new-1', 'Competitor Pricing')
      }
    } else if (f.type === 'slide_ready' && (f.payload.kind ?? 'compose') === 'compose') {
      const latest = ref.current
      if (order === 'mutation-first') deferred = () => reconcile(f.payload, latest)
      else reconcile(f.payload, latest)
    } else if (f.type === 'deck_mutation' && onDeckMutation) {
      onDeckMutation(f, { isCurrent: () => true, presentationId: PID })
    }
    await settleAll()
    if (deferred && f.type === 'deck_mutation') { const run = deferred; deferred = null; run(); await settleAll() }
  }
  if (deferred) { deferred(); await settleAll() }
  for (let i = 0; i < 3; i++) { clock.t += 3000; await settleAll() } // a few 3 s polls
  off()
  const after = { header: viewer.totalSlides, footer: countSync.syncedFooterTotal({ visualTotalSlides: viewer.visual, totalSlides: viewer.totalSlides, slideCount: effective().slideCount, partialArtifact: false }), rail: viewer.railList, canvas: viewer.canvas }
  return { before, after, trace, deckChanges, layoutCalls: layout.calls, timers: timers.length }
}

const transcripts = readdirSync(FIXTURES).filter(name => name.endsWith('.json')).sort()
  .map(name => ({ name: name.replace(/\.json$/, ''), data: JSON.parse(readFileSync(path.join(FIXTURES, name), 'utf8')) }))
const T = name => transcripts.find(t => t.name === name)?.data

// ---------- the checks (run once on the real sources, then once per mutant) ----------
async function suite(sources, { log = false } = {}) {
  const failures = []
  let passed = 0
  const check = async (name, fn) => {
    try { await fn(); passed++; if (log) console.log(`PASS ${name}`) }
    catch (error) { failures.push(name); if (log) console.error(`FAIL ${name}\n  ${String(error.message).split('\n').join('\n  ')}`) }
  }
  const libText = sources[LIB]
  const lib = libText == null ? null : makeLoader(sources, { [FLAG]: 'true' }, {})(LIB)

  await check('recorded frames are DIRECTOR-2\'s Decision B transcripts (a-e, mdc1 and nocaps)', () => {
    assert.deepEqual(transcripts.map(t => t.name), ['a-qa-mdc1', 'a-qa-nocaps', 'b-questions-mdc1', 'b-questions-nocaps', 'c-redirect-mdc1',
      'c-redirect-nocaps', 'd-delete-mdc1', 'd-delete-nocaps', 'e-add-mdc1', 'e-add-nocaps'])
    for (const t of transcripts) assert.equal(t.data.director_commit, '19d09d603095e263ea87ab55af79fa59a8ad2370', t.name)
    const add = T('e-add-mdc1').frames.map(f => f.frame)
    const ready = add.find(f => f.type === 'slide_ready'), mutation = add.find(f => f.type === 'deck_mutation')
    assert.equal(ready.payload.slide_index, 3); assert.equal(ready.payload.real_slide_id, 'real-new-1')
    assert.equal(mutation.payload.mutation, 'slide_added'); assert.equal(mutation.payload.slide_index, 3)
    // No slide id and no job id on the deck_mutation: a slide-id keyed dedupe is not possible with these frames.
    for (const key of ['slide_id', 'real_slide_id', 'job_id']) assert.equal(key in mutation.payload, false, key)
  })

  // --- the bug, reproduced from the recorded frames with the flag off (this must hold on the base too) ---
  await check('flag off, chat flags on: e-add counts the new slide twice (header 7, footer 7, rail list 6, canvas 6)', async () => {
    const r = await replay(T('e-add-mdc1'), { sources, dedupe: false })
    assert.deepEqual(r.before, { header: 5, footer: 5, rail: 5, canvas: 5 })
    assert.deepEqual(r.after, { header: 7, footer: 7, rail: 6, canvas: 6 })
  })
  await check('flag off, chat flags off: e-add agrees at 6 (slide_ready alone)', async () => {
    assert.deepEqual((await replay(T('e-add-nocaps'), { sources, dedupe: false, refreshFlag: false })).after, { header: 6, footer: 6, rail: 6, canvas: 6 })
  })
  await check('flag off, chat flags on: d-delete agrees at 4', async () => {
    assert.deepEqual((await replay(T('d-delete-mdc1'), { sources, dedupe: false })).after, { header: 4, footer: 4, rail: 4, canvas: 4 })
  })

  // --- the fix ---
  for (const order of ['ready-first', 'mutation-first']) {
    await check(`flag on (${order}): e-add, rail header, footer, rail list and canvas all say 6`, async () => {
      const r = await replay(T('e-add-mdc1'), { sources, dedupe: true, order })
      assert.deepEqual(r.after, { header: 6, footer: 6, rail: 6, canvas: 6 }, JSON.stringify(r.after))
      assert.deepEqual(r.deckChanges, ['slide'])
      assert.ok(r.layoutCalls.some(([m, p]) => m === 'GET' && p === '/api/presentations/pres-local-1/slides/inventory'))
    })
  }
  await check('flag on: d-delete still agrees at 4', async () => {
    const r = await replay(T('d-delete-mdc1'), { sources, dedupe: true })
    assert.deepEqual(r.after, { header: 4, footer: 4, rail: 4, canvas: 4 }); assert.deepEqual(r.deckChanges, ['slide'])
  })
  await check('flag on, Layout has no inventory route (404): the frame\'s own count stands, as today', async () => {
    const off = await replay(T('e-add-mdc1'), { sources, dedupe: false })
    const on = await replay(T('e-add-mdc1'), { sources, dedupe: true, inventory: 'absent' })
    assert.deepEqual(on.after, off.after)
  })
  await check('flag on, Layout read fails (network): the frame\'s own count stands, and the refresh still happens', async () => {
    const on = await replay(T('d-delete-mdc1'), { sources, dedupe: true, inventory: 'error' })
    assert.deepEqual(on.after, { header: 4, footer: 4, rail: 4, canvas: 4 }); assert.deepEqual(on.deckChanges, ['slide'])
  })
  await check('flag on: frame sets with no deck_mutation (a, b, c, every nocaps) replay exactly as the base', async () => {
    for (const t of transcripts.filter(t => !t.data.frames.some(f => f.frame.type === 'deck_mutation'))) {
      for (const refreshFlag of [true, false]) {
        const head = await replay(t.data, { sources, dedupe: true, refreshFlag })
        const base = await replay(t.data, { sources: sourceSet('base'), dedupe: true, refreshFlag })
        assert.equal(sha(JSON.stringify(head)), sha(JSON.stringify(base)), `${t.name} refresh=${refreshFlag}`)
      }
    }
  })

  // --- the lib on its own ---
  const P = 'pres-a'
  const override = (extra = {}) => ({ presentationUrl: 'http://127.0.0.1:8641/p/pres-a', presentationId: P, slideCount: 7, refreshToken: 100, ...extra })
  const harness = (readLayoutCount, opts = {}) => {
    const commits = [], timers = []
    const displayed = { presentationId: P, refreshToken: 50, ...opts.displayed }
    const settle = lib.createDeckMutationCountSettler({ readLayoutCount, getDisplayed: () => opts.getDisplayed ? opts.getDisplayed() : displayed,
      commit: o => { if (opts.throwOnce && !commits.thrown) { commits.thrown = true; throw Error('boom') } commits.push(plain(o)) },
      timeoutMs: 4000, setTimer: (fn, ms) => timers.push({ fn, ms }) })
    return { settle, commits, timers, displayed }
  }
  await check('flag: exact "true" only, default off; the lib is import-free', () => {
    assert.ok(lib, `${LIB} is missing`)
    assert.equal(lib.STUDIO_DECK_MUTATION_DEDUPE_ENABLED, true)
    for (const value of [undefined, '', 'false', 'TRUE', '1', ' true', 'true ']) {
      assert.equal(makeLoader(sources, value === undefined ? {} : { [FLAG]: value }, {})(LIB).STUDIO_DECK_MUTATION_DEDUPE_ENABLED, false, String(value))
    }
    assert.doesNotMatch(libText, /^\s*import\s/m)
  })
  await check('lib: Layout\'s count replaces the plan\'s; everything else in the override is kept', async () => {
    const h = harness(async id => (id === P ? 6 : 99))
    await h.settle(override(), () => true)
    assert.deepEqual(h.commits, [{ ...override(), slideCount: 6 }])
  })
  await check('lib: no usable Layout count (null, negative, fraction, string, NaN, throw, reject) keeps the plan\'s count', async () => {
    for (const reader of [async () => null, async () => -1, async () => 2.5, async () => '6', async () => NaN,
      () => { throw Error('x') }, async () => { throw Error('x') }]) {
      const h = harness(reader)
      await h.settle(override(), () => true)
      assert.deepEqual(h.commits, [override()])
    }
  })
  await check('lib: a Layout read that does not answer in 4 s commits the plan\'s count once; a late answer is ignored', async () => {
    let answer
    const h = harness(() => new Promise(resolve => { answer = resolve }))
    const done = h.settle(override(), () => true)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(h.timers[0].ms, 4000)
    h.timers[0].fn(); await done
    answer(6); await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(h.commits, [override()])
  })
  await check('lib: owner retired, or another deck displayed, while Layout answered: nothing is committed', async () => {
    let current = true
    const h = harness(async () => { current = false; return 6 })
    await h.settle(override(), () => current)
    assert.deepEqual(h.commits, [])
    const other = harness(async () => 6, { displayed: { presentationId: 'pres-b' } })
    await other.settle(override(), () => true)
    assert.deepEqual(other.commits, [])
  })
  await check('lib: the refresh token never goes backwards (a reconcile committed a later token meanwhile)', async () => {
    const h = harness(async () => 6, { displayed: { refreshToken: 900 } })
    await h.settle(override(), () => true)
    assert.equal(h.commits[0].refreshToken, 901)
    const k = harness(async () => 6, { displayed: { refreshToken: 10 } })
    await k.settle(override(), () => true)
    assert.equal(k.commits[0].refreshToken, 100)
  })
  await check('lib: commits run one at a time in frame order; a later read starts after the earlier commit', async () => {
    const events = []
    let releaseFirst
    let n = 0
    const commits = []
    const settle = lib.createDeckMutationCountSettler({
      readLayoutCount: () => { const i = ++n; events.push(`read${i}`); return i === 1 ? new Promise(resolve => { releaseFirst = () => resolve(5) }) : Promise.resolve(4) },
      getDisplayed: () => ({ presentationId: P, refreshToken: 0 }),
      commit: o => { events.push(`commit${o.slideCount}`); commits.push(o.slideCount) }, setTimer: () => 0 })
    const a = settle(override({ refreshToken: 1 }), () => true)
    const b = settle(override({ refreshToken: 2 }), () => true)
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(events, ['read1'])
    releaseFirst(); await a; await b
    assert.deepEqual(events, ['read1', 'commit5', 'read2', 'commit4'])
  })
  await check('lib: a commit that throws does not stop the next one', async () => {
    const h = harness(async () => 6, { throwOnce: true })
    await h.settle(override(), () => true).catch(() => undefined)
    await h.settle(override({ refreshToken: 200 }), () => true)
    assert.deepEqual(h.commits.map(c => c.refreshToken), [200])
  })

  // --- page wiring ---
  const pageText = sources[PAGE]
  const has = (text, re) => assert.ok(re.test(text ?? ''), `missing: ${re}`) // never dumps the 400 KB page into the log
  await check('page: the settler exists only with the flag on and reads Layout\'s inventory the way the rail list does', () => {
    has(pageText, /^import \{ createDeckMutationCountSettler \} from '@\/lib\/studio-deck-mutation-dedupe'$/m)
    has(pageText, /^import \{ fetchSlideInventory \} from '@\/lib\/slide-rail-identity'$/m)
    const settler = cutSettler(pageText)
    assert.ok(settler, 'settler block missing')
    has(settler, /useRef\(process\.env\.NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE === 'true' \? createDeckMutationCountSettler\(\{/)
    // Inline, never an imported flag: older page harnesses stub every import with a truthy string.
    assert.ok(!/STUDIO_DECK_MUTATION_DEDUPE_ENABLED/.test(pageText), 'the page must not import the flag constant')
    has(settler, /fetchSlideInventory\(\{ baseUrl: getLayoutServiceUrl\(\), presentationId: id, fetchImpl: \(input, init\) => fetch\(input, init\) \}\)/)
    has(settler, /return result\.kind === 'ok' \? result\.inventory\.slideCount : null/)
    // The commit is the flag-off handler's four steps, in the same order.
    has(settler, /slideComposerPresentationRef\.current = \{ \.\.\.slideComposerPresentationRef\.current, \.\.\.override \}\n\s+setSlideComposerOverride\(override\)\n\s+requestSlideRailRefresh\(override\.presentationId\)\n\s+reportDeckChange\('slide'\)/)
    has(read('hooks/use-slide-rail-identity.ts'), /fetchImpl: \(input, init\) => fetch\(input, init\)/)
  })
  await check('page: the handler hands the plan to the settler only when it exists; otherwise it runs exactly as before', () => {
    const body = cutArrow(pageText, 'onDeckMutation: (message')
    has(body, /if \(!plan\) return\n        if \(deckMutationCountSettlerRef\.current\) \{ void deckMutationCountSettlerRef\.current\(plan\.override, owner\.isCurrent\); return \} \/\/ NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE\n        slideComposerPresentationRef\.current = \{ \.\.\.displayed, \.\.\.plan\.override \}\n/)
    assert.equal((pageText.match(/onDeckMutation/g) ?? []).length, 1)
  })
  return { passed, failures }
}

// ---------- flag-off identity against the base (not part of the mutation run) ----------
let pins = 0
function pin(name, fn) {
  try { fn() } catch (error) { console.error(`FAIL ${name}`); throw error }
  pins++; console.log(`PASS ${name}`)
}
async function identity() {
  const UNTOUCHED = ['hooks/use-deckster-websocket-v2.ts', 'lib/studio-deck-mutation-refresh.ts', 'components/presentation-viewer.tsx',
    'components/slide-thumbnail-strip.tsx', 'lib/slide-rail-identity.ts', 'hooks/use-slide-rail-identity.ts', 'lib/slide-compose-async.ts',
    'lib/builder-presentation-ownership.ts', 'lib/studio-slide-count-sync.ts', 'types/mdc.ts', 'hooks/use-builder-session.ts',
    'lib/studio-deck-changed-notice.ts', 'scripts/test-studio-deck-mutation-refresh.mjs']
  pin('flag-off identity: the hook (deck_mutation and slide_ready paths, message cache, history, send payloads), the viewer, the rail and every count lib are byte-identical to the base', () => {
    for (const rel of UNTOUCHED) assert.equal(sha(read(rel)), sha(baseSource(rel)), rel)
  })
  const { stripDeckMutationDedupe, DECK_MUTATION_DEDUPE_PAGE_ADDITION } = await import('./studio-deck-mutation-dedupe-strip.mjs')
  const { stripOpenReadOnly } = await import('./studio-open-read-only-strip.mjs')
  // This change's page lines, cut by hand (independent of the strip helper, which is checked against it below).
  const cutMine = head => {
    const settler = cutSettler(head)
    const settlerFrom = head.indexOf(SETTLER_START)
    assert.ok(settler && settlerFrom >= 0, 'settler block not found')
    return head.replace(head.slice(settlerFrom, head.indexOf(settler) + settler.length + 1), '')
      .replace("import { createDeckMutationCountSettler } from '@/lib/studio-deck-mutation-dedupe'\n", '')
      .replace("import { fetchSlideInventory } from '@/lib/slide-rail-identity'\n", '')
      .replace('        if (deckMutationCountSettlerRef.current) { void deckMutationCountSettlerRef.current(plan.override, owner.isCurrent); return } // NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE\n', '')
  }
  pin('flag-off identity: the page is the base plus only the flag-gated lines (cut them and the bytes are the base\'s; stacking-tolerant through stripOpenReadOnly, which later page changes chain into)', () => {
    assert.equal(sha(stripOpenReadOnly(PAGE, cutMine(read(PAGE)))), sha(stripOpenReadOnly(PAGE, baseSource(PAGE))))
  })
  {
    pin('sibling-pin strip: studio-deck-mutation-dedupe-strip.mjs removes exactly this change\'s page lines, and stripOpenReadOnly (which the base-holding pins call) carries it', () => {
      assert.equal(sha(stripDeckMutationDedupe(PAGE, read(PAGE))), sha(cutMine(read(PAGE))))
      assert.equal(stripDeckMutationDedupe('components/presentation-viewer.tsx', 'x'), 'x')
      assert.ok(DECK_MUTATION_DEDUPE_PAGE_ADDITION[0].global)
      assert.equal(sha(stripOpenReadOnly(PAGE, read(PAGE))), sha(stripOpenReadOnly(PAGE, baseSource(PAGE))))
      assert.doesNotMatch(stripOpenReadOnly(PAGE, read(PAGE)), /DECK_MUTATION_DEDUPE|deckMutationCountSettler|fetchSlideInventory/)
      const helper = read('scripts/studio-open-read-only-strip.mjs')
      // One import line and one additive table line, nothing else of this change in FRONTEND-1's helper.
      assert.equal(helper.split('\n').filter(line => /DECK_MUTATION_DEDUPE/.test(line)).length, 2)
      assert.match(helper, /^import \{ DECK_MUTATION_DEDUPE_PAGE_ADDITION \} from '\.\/studio-deck-mutation-dedupe-strip\.mjs'$/m)
      assert.match(helper, /^  DECK_MUTATION_DEDUPE_PAGE_ADDITION, \/\/ FRONTEND-2 #469/m)
    })
  }
  // The pinned model rules (so the replay model above cannot drift from the code it stands in for).
  pin('model pins: viewer prop effect, poll, footer and strip header; page slide_ready commit and raise-only Layout reconcile', () => {
    const viewer = read('components/presentation-viewer.tsx')
    for (const line of [
      'const next = presentationChanged ? slideCount : Math.max(prev, slideCount)',
      'setVisualTotalSlides(prev => presentationChanged ? slideCount : Math.max(prev, slideCount))',
      'const verifiedMinimumTotal = Math.max(0, totalSlides || 0, slideCount || 0)',
      'const total = Math.max(resolvedRealTotal, verifiedMinimumTotal)',
      'const visualTotal = Math.max(resolvedVisualTotal, total)',
      'refreshSignals: [totalSlides, railThumbnailFrames],',
      'syncedFooterTotal({ visualTotalSlides, totalSlides, slideCount, partialArtifact: Boolean(studioPartialArtifact) })',
      'totalSlides={totalSlides}',
    ]) assert.ok(viewer.includes(line), line)
    assert.ok(read('components/slide-thumbnail-strip.tsx').includes('const slidesTotal = totalSlides ?? slides.length'))
    const page = read(PAGE)
    for (const line of [
      'viewerSlideCount = Number(reconcileResult.real_slide_count)',
      'const nextSlideCount = resolveSlideComposeCountAfterReady({\n          currentSlideCount: latest.slideCount,\n          existingDeck,\n          resolvedVisualIndex,\n          viewerSlideCount,\n        })',
      '        refreshToken = Date.now()\n',
      '        slideComposerPresentationRef.current = {\n          ...latest,\n          ...nextOverride,\n        }\n        setSlideComposerOverride(nextOverride)\n        if (navigate) {',
      'if (cancelled || !presentation || presentation.slideCount <= localSlideCount) return',
      'presentationUrl: studioPartialMetadata ? effectivePresentationUrl : directorOwnedPresentation.presentationUrl,',
      'return withSlideComposerRefreshToken(\n        templateModeSourcePresentationUrl ?? directorOwnedPresentation.presentationUrl,',
    ]) assert.ok(page.includes(line), line)
  })
  const hashes = []
  for (const t of transcripts) {
    for (const refreshFlag of [true, false]) {
      for (const order of ['ready-first', 'mutation-first']) {
        const head = await replay(t.data, { sources: sourceSet('head'), dedupe: false, refreshFlag, order })
        const base = await replay(t.data, { sources: sourceSet('base'), dedupe: false, refreshFlag, order })
        const h = sha(JSON.stringify(head)), b = sha(JSON.stringify(base))
        assert.equal(h, b, `${t.name} refresh=${refreshFlag} ${order}`)
        hashes.push(`${t.name} refresh=${refreshFlag ? 'on' : 'off'} ${order} ${h.slice(0, 16)} header=${head.after.header} footer=${head.after.footer} rail=${head.after.rail} canvas=${head.after.canvas}`)
      }
    }
  }
  pins++
  console.log(`PASS flag-off identity: every recorded frame set (a-e, mdc1 and nocaps, refresh flag on and off, both orderings) replays to the base's exact state (${hashes.length} replays)`)
  console.log(hashes.map(line => `  ${line}`).join('\n'))
  pin('.env.example and package.json: the base\'s lines all kept in order (append-only, stacking-tolerant); the flag documented "false" in a block after the base\'s last line', () => {
    for (const rel of SHARED_APPEND_ONLY) {
      const norm = line => rel === 'package.json' ? line.replace(/,\s*$/, '') : line
      // a flag's comment is prose that a later change may reword in place (PP-8 rewords the polish block's), so for .env.example what must survive, in order, is every env assignment of the base; every other line must be a comment or a blank
      const assignment = line => /^[A-Z][A-Z0-9_]*=/.test(line)
      const keep = rel === '.env.example' ? assignment : () => true
      const want = baseSource(rel).split('\n').map(norm).filter(keep)
      const extras = rel === '.env.example' ? read(rel).split('\n').filter(line => !assignment(line) && !/^\s*$|^\s*#/.test(line)) : []
      let next = 0
      for (const line of read(rel).split('\n').map(norm).filter(keep)) {
        if (next < want.length && line === want[next]) next++
        else extras.push(line)
      }
      const kind = rel === 'package.json' ? /^\s*"test:[a-z0-9-]+": "node scripts\/test-[a-z0-9-]+\.mjs"$/ : /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/
      assert.equal(next, want.length, `${rel}: a base line is missing or out of order`)
      assert.ok(extras.every(line => line === '' || kind.test(line)), `${rel}: unexpected extra line`)
    }
    const env = read('.env.example')
    assert.match(env, new RegExp(`^${FLAG}="false"$`, 'm'))
    const baseEnv = baseSource('.env.example').trimEnd().split('\n')
    assert.ok(env.indexOf(`${FLAG}="false"`) > env.indexOf(baseEnv[baseEnv.length - 1]), 'flag block is not after the base\'s end')
    assert.match(read('package.json'), /"test:studio-deck-mutation-dedupe": "node scripts\/test-studio-deck-mutation-dedupe\.mjs"/)
  })
}

// ---------- mutation check: each mutant of the lib or the page wiring must fail at least one check ----------
const MUTANTS = [
  [LIB, 'slideCount: layoutCount ?? override.slideCount,', 'slideCount: override.slideCount,'],
  [LIB, 'if (!ownerIsCurrent()) return', ''],
  [LIB, "if (!displayed || displayed.presentationId !== override.presentationId) return", ''],
  [LIB, 'refreshToken: Math.max(override.refreshToken, displayedToken + 1),', 'refreshToken: override.refreshToken,'],
  [LIB, 'queue = queue.catch(() => undefined).then(run)', 'queue = run()'],
  [LIB, 'queue = queue.catch(() => undefined).then(run)', 'queue = queue.then(run)'],
  [LIB, "process.env.NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE === 'true'", "process.env.NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE !== 'false'"],
  [LIB, 'value >= 0', 'value >= -1'],
  [LIB, 'setTimer(() => finish(null), timeoutMs)', ''],
  [PAGE, 'if (deckMutationCountSettlerRef.current) { void deckMutationCountSettlerRef.current(plan.override, owner.isCurrent); return }', ''],
  [PAGE, "return result.kind === 'ok' ? result.inventory.slideCount : null", 'return null'],
  [PAGE, '      requestSlideRailRefresh(override.presentationId)\n', ''],
  [PAGE, "useRef(process.env.NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE === 'true' ? createDeckMutationCountSettler({", 'useRef(true ? createDeckMutationCountSettler({'],
  [PAGE, "useRef(process.env.NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE === 'true' ? createDeckMutationCountSettler({", "useRef(process.env.NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE !== 'false' ? createDeckMutationCountSettler({"],
]

const head = sourceSet('head')
const result = await suite(head, { log: true })
let mutantsKilled = 0
if (result.failures.length === 0) {
  await identity()
  for (const [rel, from, to] of MUTANTS) {
    assert.ok(head[rel]?.includes(from), `mutant anchor missing in ${rel}: ${from}`)
    const mutated = await suite({ ...head, [rel]: head[rel].replace(from, to) })
    // The flag-default mutant is caught by the flag check; the page mutants also by the wiring pins.
    if (mutated.failures.length === 0) { console.error(`FAIL mutant survived: ${rel}: ${from} -> ${to || '(removed)'}`); process.exitCode = 1 }
    else mutantsKilled++
  }
  console.log(`PASS mutation check: ${mutantsKilled}/${MUTANTS.length} mutants killed`)
}
if (result.failures.length) {
  console.error(`\n${result.failures.length} check(s) failed: ${result.failures.join(' | ')}`)
  process.exit(1)
}
console.log(`\n${result.passed + pins} checks passed (${result.passed} behaviour, ${pins} flag-off identity), ${mutantsKilled} mutants killed`)
