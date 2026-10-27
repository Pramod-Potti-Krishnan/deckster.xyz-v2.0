// FRONTEND-2 (B26): after chat deletes and a reload, "Slides 3" over a 2-slide deck and "This deck changed in another tab" with no other tab (E2E-2, Studio dev, 27 Oct).
// Flag NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH, exact "true", default off.
// Run: node scripts/test-studio-deck-sync-truth.mjs   (plain node: transpile + vm, no network; `git` reads the base commit and the committed diff)
//
// What it replays: E2E-2's sequence (3 slides -> chat delete -> chip undo -> chat delete -> typed undo -> probe delete -> RELOAD) on the code the browser runs.
//   REAL (cut from the source under test and evaluated, or loaded whole): the viewer's poll (`const verifiedMinimumTotal` .. `const visualTotal`), its prop effect, its building ref, its viewer-state
//   report and its footer expression; the Builder page's onDeckMutation handler and deck-mutation count settler; planDeckMutationRefresh, the dedupe lib, fetchSlideInventory (the rail list's and the notice's
//   read), resolveEffectivePresentation, resolveSlideComposeViewerState, syncedFooterTotal, normaliseDeckRestored, the notice controller (createDeckChangedController) with the hook's own deps line, and the
//   notice component's text expression; the restore's choice of the displayed deck (hooks/use-deckster-websocket-v2.ts restoreMessages).
//   RECORDED (never invented): Director's deck_mutation and change_recorded and undo frames come from scripts/fixtures/studio-deck-mutation-dedupe/d-delete-mdc1.json and scripts/fixtures/chat-undo-v2/
//   04-undo-restored.json, 06-change-recorded-anchor.json; only the presentation id and URL are replaced by the world's, and the message ids and refresh tokens made unique per use (a repeated id is a duplicate
//   frame). E2E-2's own Layout reads are scripts/fixtures/studio-deck-sync-truth/e2e2-recorded-reads.json: they are of the strawman PREVIEW (3 slides, unchanged in all eight reads). No read of the FINAL deck was
//   kept, so the final deck's inventory is MODELLED with the preview's three slide ids, removed and restored as the chat ops did.
//   MODELLED (each rule pinned below to its source text): the viewer's iframe (Layout's real count at its last load), the rail list, the clock and timers, Layout (an in-memory inventory route).
//   Not run: React, the browser, the Director socket (the hook validates a frame before the page sees it; the proof starts at the page's handler), a live Layout.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import {
  DECK_SYNC_TRUTH_BASE_COMMIT, DECK_SYNC_TRUTH_ENV_BLOCK, DECK_SYNC_TRUTH_FILES, DECK_SYNC_TRUTH_FLAG, DECK_SYNC_TRUTH_MARKER_RE, DECK_SYNC_TRUTH_NEW_FILES,
  DECK_SYNC_TRUTH_PIN_EDITS, DECK_SYNC_TRUTH_REPLACED, DECK_SYNC_TRUTH_SCOPE_FILES, DECK_SYNC_TRUTH_SUBJECT, stripDeckSyncTruth,
} from './studio-deck-sync-truth-strip.mjs'
import { stripLaterChanges, stripLaterEnvBlocks } from './studio-later-changes.mjs'

const repoRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const BASE = DECK_SYNC_TRUTH_BASE_COMMIT
const FLAG = DECK_SYNC_TRUTH_FLAG
const LIB = 'lib/studio-deck-sync-truth.ts'
const NOTICE_LIB = 'lib/studio-deck-changed-notice.ts'
const HOOK = 'hooks/use-deck-changed-notice.ts'
const COMPONENT = 'components/builder/studio-deck-changed-notice.tsx'
const VIEWER = 'components/presentation-viewer.tsx'
const PAGE = 'app/builder/page.tsx'
const SOCKET_HOOK = 'hooks/use-deckster-websocket-v2.ts'
const LIBS = [LIB, NOTICE_LIB, 'lib/slide-compose-async.ts', 'lib/studio-slide-count-sync.ts', 'lib/studio-deck-mutation-refresh.ts', 'lib/studio-deck-mutation-dedupe.ts',
  'lib/slide-rail-identity.ts', 'lib/builder-presentation-ownership.ts', 'lib/studio-bulk-edit-wire.ts', 'lib/director-sync-recovery.ts']
const APP = [VIEWER, COMPONENT, HOOK, PAGE, SOCKET_HOOK]

const sha = text => createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const rawText = rel => readFileSync(path.join(repoRoot, rel), 'utf8')
const gitText = (rel, rev) => execFileSync('git', ['show', `${rev}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })

// ---------- sources ----------
// head = the working tree as it is (this change's lines in, every other registered change's lines in too); base = the same text with ONLY this change's lines taken out (the strip), so the two differ by this change alone.
function headSources() {
  const sources = {}
  for (const rel of [...LIBS, ...APP]) sources[rel] = existsSync(path.join(repoRoot, rel)) ? rawText(rel) : null
  return sources
}
function baseSources() {
  const sources = {}
  for (const rel of [...LIBS, ...APP]) sources[rel] = rel === LIB ? null : stripDeckSyncTruth(rel, rawText(rel))
  return sources
}

// ---------- module loading ----------
function transpile(text, jsx = false) {
  return ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) } }).outputText
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
        throw Error(`unexpected import ${spec} in ${rel}`)
      } })
    cache.set(rel, module.exports)
    return module.exports
  }
  return load
}
/** Evaluate `snippet` (TS statements) as a function body of `deps`; returns `returnExpr`. */
function evalSnippet(snippet, names, returnExpr, globals = {}) {
  const module = { exports: {} }
  vm.runInNewContext(transpile(`module.exports = function (deps) { const { ${names.join(', ')} } = deps;\n${snippet}\nreturn ${returnExpr} }`), { module, exports: module.exports, ...globals })
  return module.exports
}
function cutLines(text, startNeedle, endNeedle) {
  const a = text.indexOf(startNeedle)
  if (a < 0) return null
  const b = text.indexOf(endNeedle, a)
  if (b < 0) return null
  return text.slice(text.lastIndexOf('\n', a) + 1, text.indexOf('\n', b) + 1)
}
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

// ---------- recorded frames ----------
const fixture = rel => JSON.parse(readFileSync(path.join(repoRoot, 'scripts/fixtures', rel), 'utf8'))
const framesOf = rel => fixture(rel).frames
const frameAt = (rel, seq) => structuredClone(framesOf(rel).find(f => f.seq === seq).frame)
const RECORDED = {
  deleteSlide3: () => frameAt('studio-deck-mutation-dedupe/d-delete-mdc1.json', 5), // deck_mutation slide_deleted, slide_index 2 (Delete slide 3)
  deleteSlide2: () => frameAt('chat-undo-v2/06-change-recorded-anchor.json', 11), // deck_mutation slide_deleted, slide_index 1 (Delete slide 2)
  changeRecorded: () => frameAt('chat-undo-v2/06-change-recorded-anchor.json', 13), // change_recorded for that delete
  undoResult: () => frameAt('chat-undo-v2/04-undo-restored.json', 8), // undo_result restored
  deckRestored: () => frameAt('chat-undo-v2/04-undo-restored.json', 10), // deck_mutation deck_restored (an undo restored a version)
  addSlide: () => frameAt('studio-deck-mutation-dedupe/e-add-mdc1.json', 4), // deck_mutation slide_added, slide_index 3 (a chat add)
}
const E2E2 = JSON.parse(readFileSync(path.join(repoRoot, 'scripts/fixtures/studio-deck-sync-truth/e2e2-recorded-reads.json'), 'utf8'))

// ---------- in-memory Layout (the real inventory route's shape) ----------
const LAYOUT = 'http://127.0.0.1:8641'
const PREVIEW = E2E2.preview_deck
const FINAL = 'b9a1f421-final'
const SLIDES = E2E2.reads[0].slides.map(s => ({ slide_id: s.id, title: s.title }))
function createLayout() {
  const decks = { [FINAL]: SLIDES.map(s => ({ ...s })), [PREVIEW]: SLIDES.map(s => ({ ...s })) }
  const stash = []
  return {
    count: id => decks[id].length,
    remove(id, index) { stash.push({ id, index, slide: decks[id].splice(index, 1)[0] }) },
    insert(id, index, slide) { decks[id].splice(index, 0, slide) },
    restore() { const { id, index, slide } = stash.pop(); decks[id].splice(index, 0, slide) },
    fetch: async url => {
      const m = /\/api\/presentations\/([^/]+)\/slides\/inventory$/.exec(String(url))
      if (!m || !decks[decodeURIComponent(m[1])]) return new Response('', { status: 404 })
      const id = decodeURIComponent(m[1])
      return new Response(JSON.stringify({ presentation_id: id, slide_count: decks[id].length,
        slides: decks[id].map((s, i) => ({ slide_index: i, slide_id: s.slide_id, title: s.title, layout: 'C1', thumbnail_url: null })) }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  }
}

// ---------- the world: one page load of the Builder over Layout ----------
// flag: the value of NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH for this build (undefined = unset). The other flags are the ones Studio dev runs these frames under (the notice, S-03, the count settler, chat undo, count sync).
function world({ sources, flag, layout, row, building = false, liveOverride = null }) {
  const env = { NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE: 'true', NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED: 'true', NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE: 'true',
    NEXT_PUBLIC_STUDIO_CHAT_UNDO: 'true', NEXT_PUBLIC_STUDIO_SLIDE_COUNT_SYNC_ENABLED: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
  if (flag !== undefined) env[FLAG] = flag
  const clock = { t: 1_800_000_000_000, timers: [], next: 1 }
  const setTimer = (fn, ms) => { const id = clock.next++; clock.timers.push({ id, at: clock.t + ms, fn }); return id }
  const clearTimer = id => { clock.timers = clock.timers.filter(timer => timer.id !== id) }
  const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }
  const runDue = async end => {
    for (;;) {
      const due = clock.timers.filter(timer => timer.at <= end).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      clock.timers = clock.timers.filter(timer => timer !== due)
      clock.t = Math.max(clock.t, due.at)
      due.fn()
      await settle()
    }
  }
  /** Move the clock forward; the viewer polls every 3 s (its interval), timers run in order. */
  const advance = async ms => {
    let left = ms
    while (left > 0) {
      const step = Math.min(3000, left)
      const end = clock.t + step
      await runDue(end)
      clock.t = end
      left -= step
      if (step === 3000) poll()
      await settle()
    }
    await runDue(clock.t)
    await settle()
  }
  const globals = { Date: { now: () => clock.t }, setTimeout: setTimer, clearTimeout: clearTimer, globalThis: { crypto: { randomUUID: () => 'tab-uuid' } } }
  const load = makeLoader(sources, env, globals)
  const truth = load(LIB), notice = load(NOTICE_LIB), compose = load('lib/slide-compose-async.ts'), countSync = load('lib/studio-slide-count-sync.ts')
  const refresh = load('lib/studio-deck-mutation-refresh.ts'), dedupe = load('lib/studio-deck-mutation-dedupe.ts'), rail = load('lib/slide-rail-identity.ts')
  const ownership = load('lib/builder-presentation-ownership.ts'), wire = load('lib/studio-bulk-edit-wire.ts')
  const viewerText = sources[VIEWER], pageText = stripLaterChanges(PAGE, sources[PAGE]), hookText = sources[HOOK], componentText = sources[COMPONENT], socketText = sources[SOCKET_HOOK]
  const STUDIO_DECK_SYNC_TRUTH_ENABLED = truth ? truth.STUDIO_DECK_SYNC_TRUTH_ENABLED : false

  // -- the restore's choice of the displayed deck (hooks/use-deckster-websocket-v2.ts restoreMessages, cut) --
  const restoreBlock = cutLines(socketText, "let activeVersion: 'blank' | 'strawman' | 'final' = 'final';", 'displayId = sessionState.finalPresentationId || null;')
  const restored = evalSnippet(restoreBlock + '\n}', ['sessionState'], '{ activeVersion, displayUrl, displayId }')({ sessionState: row })
  // the live state after the restore (restoreMessages sets presentationUrl / presentationId to the display ones and slideCount to the row's)
  const live = liveOverride ?? { presentationUrl: restored.displayUrl, presentationId: restored.displayId, slideCount: row.slideCount || null }

  // -- the page: the real onDeckMutation handler and count settler --
  const builder = { override: null }
  const ref = { current: { presentationUrl: live.presentationUrl, presentationId: live.presentationId, slideCount: live.slideCount, activeVersion: 'final', refreshToken: 0 } }
  const effective = () => ownership.resolveEffectivePresentation({ livePresentationUrl: live.presentationUrl, livePresentationId: live.presentationId, liveSlideCount: live.slideCount, override: builder.override })
  const withToken = evalSnippet(cutFunction(pageText, 'withSlideComposerRefreshToken'), [], 'withSlideComposerRefreshToken')({})
  const viewer = { url: undefined, totalSlides: 0, visual: 0, canvas: 0, railList: 0, iframeReady: false, saveStatus: 'saved' }
  const setSlideComposerOverride = value => { builder.override = plain(value); render() }
  const off = refresh.onSlideRailRefreshRequest(id => { if (id === effective().presentationId) readRail() })
  const readRail = () => { viewer.railList = layout.count(effective().presentationId) }
  const pageDeps = { slideComposerPresentationRef: ref, planDeckMutationRefresh: refresh.planDeckMutationRefresh, deckMutationSeenRef: { current: refresh.createDeckMutationSeen() }, setSlideComposerOverride,
    requestSlideRailRefresh: refresh.requestSlideRailRefresh, reportDeckChange: kind => notice.reportDeckChange(kind), useRef: value => ({ current: value }),
    STUDIO_DECK_MUTATION_DEDUPE_ENABLED: dedupe.STUDIO_DECK_MUTATION_DEDUPE_ENABLED, createDeckMutationCountSettler: dedupe.createDeckMutationCountSettler,
    fetchSlideInventory: rail.fetchSlideInventory, getLayoutServiceUrl: () => LAYOUT, fetch: layout.fetch, Date: globals.Date }
  const pageNames = Object.keys(pageDeps)
  pageDeps.deckMutationCountSettlerRef = evalSnippet(cutSettler(pageText), pageNames, 'deckMutationCountSettlerRef', { ...globals, process: { env } })(pageDeps)
  const onDeckMutation = evalSnippet('', [...pageNames, 'deckMutationCountSettlerRef'], `(${cutArrow(pageText, 'onDeckMutation: (message')})`, globals)(pageDeps)

  // -- the viewer (real snippets of presentation-viewer.tsx) --
  const buildingState = { current: false }
  const buildingLine = viewerText.split('\n').find(l => l.includes('deckSyncBuildingRef.current =')) ?? ''
  const computeBuilding = () => {
    if (!buildingLine) return false
    const expr = buildingLine.slice(buildingLine.indexOf('=') + 1).replace(/\/\/.*$/, '').trim()
    return evalSnippet('', ['studioShell', 'isGenerating', 'studioPartialArtifact'], `(${expr})`)({ studioShell: true, isGenerating: building, studioPartialArtifact: false })
  }
  const syncEffectRun = evalSnippet(cutLines(viewerText, '// Sync totalSlides with slideCount prop changes', '}, [presentationUrl, slideCount])'),
    ['useRef', 'useEffect', 'presentationUrl', 'slideCount', 'setTotalSlides', 'setVisualTotalSlides', 'debugLog'], 'null')
  const urlRef = { current: undefined }
  let lastDeps = null
  const runSyncEffect = () => {
    const slideCount = effective().slideCount, presentationUrl = viewer.url
    const useEffect = (fn, deps) => { if (!lastDeps || deps.some((d, i) => d !== lastDeps[i])) { lastDeps = deps; fn() } }
    const useRef = initial => { if (urlRef.current === undefined) urlRef.current = { current: initial }; return urlRef.current }
    syncEffectRun({ useRef, useEffect, presentationUrl, slideCount,
      setTotalSlides: updater => { viewer.totalSlides = typeof updater === 'function' ? updater(viewer.totalSlides) : updater },
      setVisualTotalSlides: updater => { viewer.visual = typeof updater === 'function' ? updater(viewer.visual) : updater }, debugLog: () => {} })
  }
  const pollRun = evalSnippet(cutLines(viewerText, 'const verifiedMinimumTotal = Math.max(0, totalSlides || 0, slideCount || 0)', 'const visualTotal = Math.max(resolvedVisualTotal, total)'),
    ['data', 'totalSlides', 'slideCount', 'resolveSlideComposeViewerState'], '{ total, visualTotal, resolvedVisualTotal, currentVisualIndex }')
  // the two lines this change adds after the base's own commits (cut by their marker line) and the base's two setters (pinned: the suite asserts the viewer holds them)
  const settledLines = cutLines(viewerText, 'const deckSyncSettled = ', 'if (deckSyncSettled) {')
  const settledRun = settledLines ? evalSnippet(settledLines, ['STUDIO_DECK_SYNC_TRUTH_ENABLED', 'syncTruthSettledTotals', 'data', 'resolvedVisualTotal', 'deckSyncBuildingRef', 'hasComposeJobs', 'setTotalSlides', 'setVisualTotalSlides', 'lastSlideInfoRef'], 'null') : null
  let lastSlideInfo = null
  function poll() {
    if (!viewer.url) return
    const data = { index: 0, total: viewer.canvas, layoutId: 'L25' } // getCurrentSlideInfo's recorded reply shape (scripts/fixtures/studio-add-slide-status/layout-viewer-replies.json); total = what the iframe shows
    buildingState.current = computeBuilding()
    const base = pollRun({ data, totalSlides: viewer.totalSlides, slideCount: effective().slideCount ?? 0, resolveSlideComposeViewerState: compose.resolveSlideComposeViewerState })
    const slideNum = base.currentVisualIndex + 1
    // `slideInfoChanged` and the base's two setters (presentation-viewer.tsx, pinned): the floored totals are committed when the slide info changed since the last poll
    if (!lastSlideInfo || lastSlideInfo.slide !== slideNum || lastSlideInfo.total !== base.total || lastSlideInfo.visualTotal !== base.visualTotal) {
      lastSlideInfo = { slide: slideNum, total: base.total, visualTotal: base.visualTotal }
      viewer.totalSlides = base.total
      viewer.visual = base.visualTotal
    }
    if (settledRun) settledRun({ STUDIO_DECK_SYNC_TRUTH_ENABLED, syncTruthSettledTotals: truth?.syncTruthSettledTotals, data, resolvedVisualTotal: base.resolvedVisualTotal, deckSyncBuildingRef: buildingState, hasComposeJobs: false, lastSlideInfoRef: { current: lastSlideInfo },
      setTotalSlides: updater => { viewer.totalSlides = typeof updater === 'function' ? updater(viewer.totalSlides) : updater },
      setVisualTotalSlides: updater => { viewer.visual = typeof updater === 'function' ? updater(viewer.visual) : updater } })
    readRail() // the rail re-reads when totalSlides changes (refreshSignals)
  }
  const stateReportLine = viewerText.split('\n').find(l => l.includes('reportViewerDeckState({ presentationId: presentationId ?? null')) ?? ''
  const viewerState = () => evalSnippet('', ['presentationId', 'iframeReady', 'totalSlides', 'saveStatus'], stateReportLine.trim().replace(/^reportViewerDeckState\(/, '(').replace(/\)\s*$/, ')'))({
    presentationId: effective().presentationId, iframeReady: viewer.iframeReady, totalSlides: viewer.totalSlides, saveStatus: viewer.saveStatus })
  const footerMatch = /<span>Slide \{currentSlide\} \/ \{([\s\S]*?)\}<\/span>/.exec(viewerText)
  const footer = () => evalSnippet('', ['STUDIO_SLIDE_COUNT_SYNC_ENABLED', 'syncedFooterTotal', 'visualTotalSlides', 'totalSlides', 'slideCount', 'studioPartialArtifact'], `(${footerMatch[1]})`)({
    STUDIO_SLIDE_COUNT_SYNC_ENABLED: countSync.STUDIO_SLIDE_COUNT_SYNC_ENABLED, syncedFooterTotal: countSync.syncedFooterTotal, visualTotalSlides: viewer.visual,
    totalSlides: viewer.totalSlides, slideCount: effective().slideCount, studioPartialArtifact: false })
  const header = () => viewer.totalSlides // the strip's `totalSlides` prop (pinned in the suite: the viewer passes totalSlides={totalSlides})

  function render() {
    const eff = effective()
    ref.current = { presentationUrl: eff.presentationUrl, presentationId: eff.presentationId, slideCount: eff.slideCount, activeVersion: 'final', refreshToken: eff.refreshToken }
    const url = withToken(eff.presentationUrl, eff.refreshToken)
    if (viewer.url !== url) { viewer.canvas = layout.count(eff.presentationId); viewer.url = url; viewer.iframeReady = true } // a new URL reloads the iframe: it shows Layout's real deck
    runSyncEffect()
    readRail()
  }

  // -- the notice: the real controller, with the hook's own deps line (cut) and the bridge the page reports through --
  const notices = []
  let reloads = 0
  const onReloadRef = { current: () => { reloads++; const d = ref.current; setSlideComposerOverride({ presentationUrl: d.presentationUrl, presentationId: d.presentationId, slideCount: d.slideCount, refreshToken: Math.max(clock.t, d.refreshToken + 1) }) } }
  let controller = null, offChange = () => {}
  function mountController() {
    const eff = effective()
    const depsLine = hookText.split('\n').find(l => l.includes('directorWindowMs:')) ?? ''
    const extraDeps = depsLine ? evalSnippet('', ['STUDIO_DECK_SYNC_TRUTH_ENABLED', 'DIRECTOR_CHANGE_WINDOW_MS', 'NOTICE_CONFIRM_DELAY_MS', 'onReloadRef'], `({ ${depsLine.trim().replace(/\/\/.*$/, '').replace(/,\s*$/, '')} })`)({
      STUDIO_DECK_SYNC_TRUTH_ENABLED, DIRECTOR_CHANGE_WINDOW_MS: truth?.DIRECTOR_CHANGE_WINDOW_MS, NOTICE_CONFIRM_DELAY_MS: truth?.NOTICE_CONFIRM_DELAY_MS, onReloadRef }) : {}
    controller = notice.createDeckChangedController({
      sessionId: 'b6cbb408', presentationId: eff.presentationId, tabId: 'tab-a', createChannel: name => (world.hub ? world.hub.create(name) : null),
      readInventory: async () => { const r = await rail.fetchSlideInventory({ baseUrl: LAYOUT, presentationId: eff.presentationId, fetchImpl: layout.fetch }); return r.kind === 'ok' ? r.inventory : null },
      getViewerState: viewerState, onNotice: n => notices.push(n ? { id: n.id, source: n.source } : null),
      doc: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }, win: { addEventListener() {}, removeEventListener() {} },
      now: () => clock.t, setTimer, clearTimer, ...extraDeps })
    offChange = notice.onDeckChange(change => controller.announce(change)) // the hook's own subscription (pinned in the suite)
  }
  const noticeTextExpr = /data-studio-deck-changed-part="text">\{([\s\S]*?)\}<\/span>/.exec(componentText)[1]
  const noticeText = source => evalSnippet('', ['STUDIO_DECK_SYNC_TRUTH_ENABLED', 'deckChangedNoticeText', 'notice'], `(${noticeTextExpr})`)({
    STUDIO_DECK_SYNC_TRUTH_ENABLED, deckChangedNoticeText: truth?.deckChangedNoticeText, notice: { source } })

  return {
    clock, notices, viewer, effective, restored, advance, settle, truth, notice, compose, countSync, STUDIO_DECK_SYNC_TRUTH_ENABLED, noticeText, poll,
    reloadCount: () => reloads, controller: () => controller, setBuilding: value => { building = value },
    /** Page load + first render + the first poll */
    mount() { render(); mountController(); poll() },
    /** the first render after a page load: the iframe loads and the viewer holds the prop's count, before any poll */
    boot() { render(); mountController() },
    /** Director's count rises (the page's live count, as a build's frames raise it); the viewer's iframe shows `canvas` slides */
    setLiveCount(count, canvas) { live.slideCount = count; viewer.canvas = canvas; render() },
    shot: label => ({ label, header: header(), footer: footer(), rail: viewer.railList, canvas: viewer.canvas, notice: notices.length && notices[notices.length - 1] ? noticeText(notices[notices.length - 1].source) : null }),
    /** Director's chat op: Layout changes, then the recorded frame reaches the page's handler (the hook's checks have passed for the displayed deck). */
    async chat(frame, mutate) {
      mutate()
      const f = structuredClone(frame)
      f.payload.presentation_id = FINAL
      if (f.payload.presentation_url) f.payload.presentation_url = `${LAYOUT}/p/${FINAL}`
      f.message_id = `${f.message_id}-${++world.frames}`
      f.payload.refresh_token = `${f.payload.refresh_token}-${world.frames}`
      f.session_id = 'b6cbb408'
      wire.normaliseDeckRestored(f) // the hook does this before the page sees an undo's deck_restored
      onDeckMutation(f, { isCurrent: () => true, presentationId: FINAL })
      await settle()
    },
    /** The tab gets focus six seconds after the last change (past the tab's own-change quiet window): one inventory read and a comparison. */
    async focus() { clock.t += 6000; await controller.check('focus'); await settle() },
    close() { off(); offChange(); if (controller) controller.dispose() },
  }
}
world.frames = 0
world.hub = null

const ROW = () => ({ currentStage: 6, slideCount: 3, finalPresentationId: FINAL, finalPresentationUrl: `${LAYOUT}/p/${FINAL}`, strawmanPresentationId: PREVIEW, strawmanPreviewUrl: `${LAYOUT}/p/${PREVIEW}` })

/** E2E-2's run: 3 slides, delete 3, chip undo, delete 2, typed undo, probe delete, then the reload. Returns what the page showed after each step and after the reload. */
async function e2e2Run({ sources, flag, focusBeforePoll = false }) {
  const layout = createLayout()
  const steps = []
  const w = world({ sources, flag, layout, row: ROW() })
  w.mount()
  await w.settle()
  steps.push(w.shot('built: 3 slides'))
  await w.chat(RECORDED.deleteSlide3(), () => layout.remove(FINAL, 2)); await w.advance(3500)
  steps.push(w.shot('chat: delete slide 3'))
  await w.chat(RECORDED.deckRestored(), () => layout.restore()); await w.advance(3500)
  steps.push(w.shot('chip undo'))
  await w.chat(RECORDED.deleteSlide2(), () => layout.remove(FINAL, 1)); await w.advance(3500)
  steps.push(w.shot('chat: delete slide 2'))
  await w.chat(RECORDED.deckRestored(), () => layout.restore()); await w.advance(3500)
  steps.push(w.shot('typed undo'))
  await w.chat(RECORDED.deleteSlide3(), () => layout.remove(FINAL, 2)); await w.advance(3500)
  steps.push(w.shot('probe delete'))
  const beforeReload = { pageCount: w.effective().slideCount, rowCount: ROW().slideCount }
  const midRunNotices = w.notices.filter(Boolean).length
  w.close()
  // RELOAD: a new page from the session row (nothing wrote a lower count to it: no page code does), a new notice controller
  const r = world({ sources, flag, layout, row: ROW() })
  r.boot()
  await r.settle()
  const loaded = r.shot('reload: iframe loaded, before the first poll')
  let early = null
  if (focusBeforePoll) { await r.focus(); early = r.shot('reload: focus before the first poll') }
  r.poll(); await r.settle()
  const polled = r.shot('reload: after the first poll')
  await r.focus()
  await r.advance(6000)
  const afterFocus = r.shot('reload: after focus')
  const result = { steps, midRunNotices, beforeReload, restoredDeck: r.restored, loaded, early, polled, afterFocus, notices: r.notices.filter(Boolean), reloads: r.reloadCount() }
  r.close()
  return result
}

// ---------- checks ----------
const TEXT_ANOTHER_TAB = 'This deck changed in another tab'
const hubOf = () => {
  const channels = []
  return {
    create(name) {
      const channel = { name, onmessage: null, postMessage(data) { for (const other of channels) if (other !== channel && other.name === name && other.onmessage) other.onmessage({ data: JSON.parse(JSON.stringify(data)) }) }, close() { channels.splice(channels.indexOf(channel), 1) } }
      channels.push(channel)
      return channel
    },
  }
}
async function suite(sources, { log = false } = {}) {
  const failures = [], passedNames = []
  const check = async (name, fn) => {
    try { await fn(); passedNames.push(name); if (log) console.log(`PASS ${name}`) }
    catch (error) { failures.push(name); if (log) console.error(`FAIL ${name}\n  ${String(error?.stack ?? error).split('\n').slice(0, 5).join('\n  ')}`) }
  }
  const truthLib = flag => (sources[LIB] == null ? null : makeLoader(sources, flag === undefined ? {} : { [FLAG]: flag }, {})(LIB))

  // --- today's output (flag off), which must hold on the base too: the bug, reproduced from E2E-2's recorded run ---
  await check('flag off: after the reload the rail header says 3 and the footer "Slide 1 / 3" over a 2-slide deck, and a focus draws "This deck changed in another tab" (E2E-2)', async () => {
    const r = await e2e2Run({ sources, flag: undefined })
    assert.deepEqual(r.beforeReload, { pageCount: 2, rowCount: 3 }, 'the page knows 2 after the chat ops; the session row still holds the build\'s 3')
    assert.equal(r.restoredDeck.displayId, FINAL, 'the reload restores the FINAL deck, never the preview')
    assert.deepEqual([r.loaded.header, r.loaded.footer, r.loaded.rail, r.loaded.canvas], [3, 3, 2, 2])
    assert.deepEqual([r.polled.header, r.polled.footer, r.polled.rail, r.polled.canvas], [3, 3, 2, 2], 'the poll never lowers it: its floor is the restored 3')
    assert.equal(r.afterFocus.notice, TEXT_ANOTHER_TAB)
    assert.equal(r.notices.length, 1)
    assert.equal(r.notices[0].source, 'focus')
    assert.equal(r.midRunNotices, 0, 'the chat ops themselves never drew one')
  })
  await check('flag off: a focus before the first poll draws the notice at once (today)', async () => {
    const r = await e2e2Run({ sources, flag: undefined, focusBeforePoll: true })
    assert.equal(r.early.notice, TEXT_ANOTHER_TAB)
  })

  // --- the fix: (a) the count, (b) no false "another tab" ---
  await check('flag on: the recorded sequence ends on "Slides 2" / "Slide 1 / 2" after the reload, and no notice at all', async () => {
    const r = await e2e2Run({ sources, flag: 'true' })
    assert.deepEqual([r.polled.header, r.polled.footer, r.polled.rail, r.polled.canvas], [2, 2, 2, 2])
    assert.deepEqual([r.afterFocus.header, r.afterFocus.footer, r.afterFocus.rail, r.afterFocus.canvas], [2, 2, 2, 2])
    assert.deepEqual(r.notices, [])
    assert.equal(r.afterFocus.notice, null)
  })
  await check('flag on: every step of the run agrees across header, footer, rail list and canvas (3, 2, 3, 2, 3, 2) and a chat change never draws a notice', async () => {
    const r = await e2e2Run({ sources, flag: 'true' })
    assert.deepEqual(r.steps.map(s => [s.header, s.footer, s.rail, s.canvas]), [[3, 3, 3, 3], [2, 2, 2, 2], [3, 3, 3, 3], [2, 2, 2, 2], [3, 3, 3, 3], [2, 2, 2, 2]])
    assert.equal(r.steps.every(s => s.notice === null), true)
    assert.equal(r.midRunNotices, 0)
  })
  await check('flag on: after the reload a chat delete and then a chat add keep header, footer, rail list and canvas on Layout\'s count (2, 1, 2), with no notice', async () => {
    const layout = createLayout()
    layout.remove(FINAL, 2) // the probe delete: two slides when the page reloads
    const w = world({ sources, flag: 'true', layout, row: ROW() })
    w.boot(); w.poll(); await w.settle()
    const shots = [w.shot('reloaded')]
    await w.chat(RECORDED.deleteSlide2(), () => layout.remove(FINAL, 1)); await w.advance(3500)
    shots.push(w.shot('chat: delete'))
    await w.chat(RECORDED.addSlide(), () => layout.insert(FINAL, 1, { slide_id: 'slide_chat_added', title: 'Added by chat' })); await w.advance(3500)
    shots.push(w.shot('chat: add'))
    assert.deepEqual(shots.map(x => [x.header, x.footer, x.rail, x.canvas]), [[2, 2, 2, 2], [1, 1, 1, 1], [2, 2, 2, 2]])
    assert.equal(w.notices.filter(Boolean).length, 0)
    await w.focus(); await w.advance(6000)
    assert.equal(w.notices.filter(Boolean).length, 0)
    w.close()
  })
  await check('flag on: a focus BEFORE the viewer\'s first poll (it still holds the restored 3) draws nothing: the difference must outlast 4 s, and the poll corrects it first', async () => {
    const r = await e2e2Run({ sources, flag: 'true', focusBeforePoll: true })
    assert.deepEqual([r.loaded.header, r.loaded.footer], [3, 3], 'the restored count is on screen until the first poll')
    assert.equal(r.early.notice, null)
    assert.deepEqual(r.notices, [])
    assert.deepEqual([r.afterFocus.header, r.afterFocus.footer], [2, 2])
  })
  await check('(d) the reload shows the FINAL deck: the viewer, the rail list and the notice all read the final id; none reads the preview 313d2ded (E2E-2\'s eight reads of it: 3 slides, never changed)', async () => {
    for (const flag of [undefined, 'true']) {
      const layout = createLayout()
      const w = world({ sources, flag, layout, row: ROW() })
      w.boot()
      assert.equal(w.restored.activeVersion, 'final')
      assert.equal(w.restored.displayId, FINAL)
      assert.equal(w.effective().presentationId, FINAL)
      assert.equal(w.viewer.railList, layout.count(FINAL))
      w.close()
    }
    assert.equal(E2E2.reads.length, 8)
    for (const read of E2E2.reads) {
      assert.equal(read.deck, PREVIEW); assert.equal(read.count, 3); assert.equal(read.updated_at, E2E2.reads[0].updated_at)
      assert.deepEqual(read.slides.map(s => s.id), E2E2.reads[0].slides.map(s => s.id))
    }
  })
  await check('(d) a row that restores the strawman first (activeVersion "strawman") paints the preview, then Director\'s sync_response promotes the FINAL deck with the same stale count: the viewer\'s own count still wins (flag on) and the final id is the one read', async () => {
    const recovery = makeLoader(sources, {}, {})('lib/director-sync-recovery.ts')
    const layout = createLayout()
    const row = { ...ROW(), activeVersion: 'strawman', currentStage: 4 }
    const first = world({ sources, flag: 'true', layout, row })
    assert.equal(first.restored.displayId, PREVIEW, 'the restore alone would show the preview')
    const state = { presentationUrl: row.strawmanPreviewUrl, finalPresentationUrl: row.finalPresentationUrl, deckOwnerSessionId: 'b6cbb408', presentationId: PREVIEW, finalPresentationId: FINAL, activeVersion: 'strawman', isBlankPresentation: false, slideCount: 3, currentStatus: null }
    const promoted = recovery.applyFinalSyncRecovery(state, { current_state: 'CONTENT_GENERATED', presentation_url: row.finalPresentationUrl, presentation_id: FINAL, slide_count: 3 }, 'b6cbb408')
    assert.equal(promoted.state.presentationId, FINAL)
    assert.equal(promoted.state.activeVersion, 'final')
    assert.equal(promoted.state.slideCount, 3, 'Math.max(the page\'s 3, Director\'s 3): the stale count rides along')
    first.close()
    layout.remove(FINAL, 2) // the chat deleted a slide on the final deck
    const on = world({ sources, flag: 'true', layout, row, liveOverride: { presentationUrl: promoted.state.presentationUrl, presentationId: promoted.state.presentationId, slideCount: promoted.state.slideCount } })
    on.boot(); on.poll(); await on.settle()
    assert.deepEqual([on.shot('').header, on.shot('').footer, on.shot('').rail], [2, 2, 2])
    const off = world({ sources, flag: undefined, layout, row, liveOverride: { presentationUrl: promoted.state.presentationUrl, presentationId: promoted.state.presentationId, slideCount: promoted.state.slideCount } })
    off.boot(); off.poll(); await off.settle()
    assert.deepEqual([off.shot('').header, off.shot('').footer, off.shot('').rail], [3, 3, 2])
    on.close(); off.close()
  })

  // --- (c) a real other tab ---
  await check('(c) a REAL other tab: a BroadcastChannel message from another tab still shows the notice, and its words still say "in another tab" (flag off and on)', async () => {
    for (const flag of [undefined, 'true']) {
      const layout = createLayout()
      world.hub = hubOf()
      const w = world({ sources, flag, layout, row: ROW() })
      w.mount(); await w.settle()
      const lib = makeLoader(sources, flag === undefined ? {} : { [FLAG]: flag }, { Date: { now: () => w.clock.t }, setTimeout, clearTimeout })(NOTICE_LIB)
      const other = lib.createDeckChangedController({ sessionId: 'b6cbb408', presentationId: FINAL, tabId: 'tab-b', createChannel: name => world.hub.create(name), readInventory: async () => null,
        getViewerState: () => ({ presentationId: FINAL, slideCount: 3, unsaved: false }), onNotice: () => {}, now: () => w.clock.t, setTimer: () => 0, clearTimer: () => {} })
      other.announce('slide'); await w.settle()
      const shown = w.notices.filter(Boolean)
      assert.equal(shown.length, 1, `flag ${flag}`)
      assert.equal(shown[0].source, 'broadcast')
      assert.equal(w.noticeText('broadcast'), TEXT_ANOTHER_TAB)
      other.dispose(); w.close(); world.hub = null
    }
  })
  await check('(c) a REAL other tab right after a Director change on this tab: the broadcast notice is still shown (an announcement explains only a difference this tab found on its own)', async () => {
    const layout = createLayout()
    world.hub = hubOf()
    const w = world({ sources, flag: 'true', layout, row: ROW() })
    w.mount(); await w.settle()
    await w.chat(RECORDED.deleteSlide3(), () => layout.remove(FINAL, 2)); await w.advance(1600)
    const lib = makeLoader(sources, { [FLAG]: 'true' }, { Date: { now: () => w.clock.t }, setTimeout, clearTimeout })(NOTICE_LIB)
    const other = lib.createDeckChangedController({ sessionId: 'b6cbb408', presentationId: FINAL, tabId: 'tab-b', createChannel: name => world.hub.create(name), readInventory: async () => null,
      getViewerState: () => ({ presentationId: FINAL, slideCount: 3, unsaved: false }), onNotice: () => {}, now: () => w.clock.t, setTimer: () => 0, clearTimer: () => {} })
    other.announce('slide'); await w.settle()
    const shown = w.notices.filter(Boolean)
    assert.equal(shown.length, 1)
    assert.equal(shown[0].source, 'broadcast')
    other.dispose(); w.close(); world.hub = null
  })

  // a controller on its own, for the rule table (the real lib, fake clock and viewer; the deps are the ones the hook line passes with the flag on)
  const rig = ({ flag, viewer = { presentationId: 'p1', slideCount: 3, unsaved: false }, inventoryCount = 2, minGap }) => {
    const clock = { t: 1_000_000, timers: [] }
    const calls = { notices: [], reloads: 0, reads: 0 }
    const load = makeLoader(sources, flag === undefined ? {} : { [FLAG]: flag }, { Date: { now: () => clock.t }, globalThis: { crypto: { randomUUID: () => 'tab-x' } } })
    const notice = load(NOTICE_LIB), truth = load(LIB)
    const on = flag === 'true' && truth && truth.STUDIO_DECK_SYNC_TRUTH_ENABLED
    const controller = notice.createDeckChangedController({ sessionId: 's', presentationId: 'p1', tabId: 'tab-a', createChannel: () => null,
      readInventory: async () => { calls.reads++; return { slideCount: inventoryCount, slides: Array.from({ length: inventoryCount }, (_, k) => ({ slideId: `s${k}`, layout: 'C1', contentVersion: 'v1' })) } },
      getViewerState: () => viewer, onNotice: n => calls.notices.push(n), doc: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }, win: { addEventListener() {}, removeEventListener() {} },
      now: () => clock.t, setTimer: (fn, ms) => { const h = { fn, at: clock.t + ms, done: false }; clock.timers.push(h); return h }, clearTimer: h => { if (h) h.done = true },
      ...(minGap === undefined ? {} : { checkMinGapMs: minGap }),
      ...(on ? { directorWindowMs: truth.DIRECTOR_CHANGE_WINDOW_MS, quietRefresh: () => { calls.reloads++ }, confirmDelayMs: truth.NOTICE_CONFIRM_DELAY_MS } : {}) })
    const advance = async ms => { clock.t += ms; for (const h of [...clock.timers]) if (!h.done && h.at <= clock.t) { h.done = true; h.fn(); await new Promise(resolve => setImmediate(resolve)) } }
    return { controller, calls, advance, viewer, truth, pending: () => clock.timers.filter(h => !h.done).length }
  }
  await check('flag on (b): a change announced on this tab (Director\'s deck_mutation reaches the page, which reports it) explains a difference found within 15 s: a quiet refresh, no notice', async () => {
    const r = rig({ flag: 'true' })
    r.controller.announce('slide'); await r.advance(6000)
    await r.controller.check('focus'); await r.advance(0)
    assert.deepEqual(r.calls.notices, [])
    assert.equal(r.calls.reloads, 1)
  })
  await check('flag on (b): with unsaved edits the quiet refresh never runs (it would drop them): the difference waits 4 s, then reads "This deck was updated", never "another tab"', async () => {
    const r = rig({ flag: 'true', viewer: { presentationId: 'p1', slideCount: 3, unsaved: true } })
    r.controller.announce('slide'); await r.advance(6000)
    await r.controller.check('visibility'); await r.advance(0)
    assert.equal(r.calls.reloads, 0)
    assert.deepEqual(r.calls.notices, [])
    await r.advance(4000)
    const shown = r.calls.notices.filter(Boolean)
    assert.equal(shown.length, 1)
    assert.equal(shown[0].source, 'visibility')
    assert.equal(r.truth.deckChangedNoticeText(shown[0].source), 'This deck was updated')
  })
  await check('flag on (b): an announcement older than 15 s explains nothing: the difference is confirmed 4 s later', async () => {
    const r = rig({ flag: 'true' })
    r.controller.announce('slide'); await r.advance(16_000)
    await r.controller.check('focus'); await r.advance(0)
    assert.equal(r.calls.reloads, 0)
    assert.deepEqual(r.calls.notices, [])
    await r.advance(3999); assert.deepEqual(r.calls.notices, [])
    await r.advance(2)
    assert.equal(r.calls.notices.filter(Boolean).length, 1)
  })
  await check('flag on (c): an unexplained difference that persists keeps the notice, in words that are true (focus and visibility: "This deck was updated"; broadcast and reconnect keep theirs)', async () => {
    const r = rig({ flag: 'true' })
    const t = r.truth
    assert.equal(t.deckChangedNoticeText('focus'), 'This deck was updated')
    assert.equal(t.deckChangedNoticeText('visibility'), 'This deck was updated')
    assert.equal(t.deckChangedNoticeText('broadcast'), TEXT_ANOTHER_TAB)
    assert.equal(t.deckChangedNoticeText('reconnect'), 'This deck changed while you were reconnecting')
    await r.controller.check('visibility'); await r.advance(4001)
    assert.equal(r.calls.notices.filter(Boolean).length, 1)
    assert.equal(r.calls.notices[0].source, 'visibility')
  })
  await check('flag on (c): a viewer that corrects itself inside the 4 s (its first poll) leaves no notice; one that does not is noticed once, with one read', async () => {
    const r = rig({ flag: 'true' })
    await r.controller.check('focus'); await r.advance(0)
    r.viewer.slideCount = 2
    await r.advance(4001)
    assert.deepEqual(r.calls.notices, [])
    const stuck = rig({ flag: 'true' })
    await stuck.controller.check('focus'); await stuck.advance(4001)
    assert.equal(stuck.calls.notices.filter(Boolean).length, 1)
    await stuck.controller.check('focus'); await stuck.advance(10_000)
    assert.equal(stuck.calls.notices.filter(Boolean).length, 1, 'one notice')
    assert.equal(stuck.calls.reads, 1, 'one read')
  })
  await check('flag on (c): Reload deck clears a waiting confirmation, and dispose clears its timer (none is left pending)', async () => {
    const r = rig({ flag: 'true' })
    await r.controller.check('focus'); await r.advance(0)
    assert.equal(r.pending(), 1, 'a confirmation is waiting')
    r.controller.markReloaded()
    assert.equal(r.pending(), 0)
    await r.advance(5000)
    assert.deepEqual(r.calls.notices, [])
    const r2 = rig({ flag: 'true' })
    await r2.controller.check('focus'); await r2.advance(0)
    assert.equal(r2.pending(), 1)
    r2.controller.dispose()
    assert.equal(r2.pending(), 0)
    await r2.advance(5000)
    assert.deepEqual(r2.calls.notices, [])
  })
  await check('flag on (c): while a difference waits to be confirmed a second focus reads nothing more (one read per difference)', async () => {
    const r = rig({ flag: 'true', minGap: 100 })
    await r.controller.check('focus'); await r.advance(200)
    await r.controller.check('visibility'); await r.advance(200)
    assert.equal(r.calls.reads, 1)
    assert.equal(r.pending(), 1)
  })
  await check('the notice component\'s own text expression: flag on, a focus or visibility difference reads "This deck was updated", a broadcast keeps "in another tab", a reconnect keeps its words; flag off, every cause but a reconnect says "in another tab" (today)', async () => {
    const layout = createLayout()
    const on = world({ sources, flag: 'true', layout, row: ROW() }), off = world({ sources, flag: undefined, layout, row: ROW() })
    for (const [source, flagOn, flagOff] of [['focus', 'This deck was updated', TEXT_ANOTHER_TAB], ['visibility', 'This deck was updated', TEXT_ANOTHER_TAB], ['broadcast', TEXT_ANOTHER_TAB, TEXT_ANOTHER_TAB],
      ['reconnect', 'This deck changed while you were reconnecting', 'This deck changed while you were reconnecting']]) {
      assert.equal(on.noticeText(source), flagOn, `flag on, ${source}`)
      assert.equal(off.noticeText(source), flagOff, `flag off, ${source}`)
    }
    on.close(); off.close()
  })
  await check('flag off: the controller is today\'s: a difference is shown at once, whatever was announced, and nothing is refreshed quietly', async () => {
    const r = rig({ flag: undefined })
    r.controller.announce('slide'); await r.advance(6000)
    await r.controller.check('focus'); await r.advance(0)
    assert.equal(r.calls.notices.filter(Boolean).length, 1)
    assert.equal(r.calls.reloads, 0)
  })

  // --- (a) the count: a build in progress still grows ---
  await check('flag on: while building, nothing is committed over the base\'s floored totals (the viewer reports 2 while Director has built 3, 4, 5: the count is never below it)', () => {
    const lib = truthLib('true')
    for (const reported of [2, 3, 5]) assert.equal(lib.syncTruthSettledTotals({ data: { total: reported }, resolvedVisualTotal: reported, building: true }), null)
  })
  await check('flag on: the viewer\'s building flag is on for isGenerating, a partial artifact and outside the Studio shell; off only for a settled deck in the shell', () => {
    const line = sources[VIEWER].split('\n').find(l => l.includes('deckSyncBuildingRef.current ='))
    assert.ok(line, 'the viewer sets the building ref')
    const expr = line.slice(line.indexOf('=') + 1).replace(/\/\/.*$/, '').trim()
    const run = props => evalSnippet('', ['studioShell', 'isGenerating', 'studioPartialArtifact'], `(${expr})`)(props)
    const settled = { studioShell: true, isGenerating: false, studioPartialArtifact: false }
    assert.equal(run(settled), false)
    assert.equal(run({ ...settled, isGenerating: true }), true)
    assert.equal(run({ ...settled, studioPartialArtifact: true }), true)
    assert.equal(run({ ...settled, studioShell: false }), true)
  })
  await check('flag on: a build in progress still grows: Director 1, 2, 3, 4 slides with the viewer one behind, header and footer never fall, and when the build ends the viewer\'s count wins', async () => {
    for (const flag of [undefined, 'true']) {
      const layout = createLayout()
      layout.remove(FINAL, 2); layout.remove(FINAL, 1) // the build has landed its first slide
      const w = world({ sources, flag, layout, row: { ...ROW(), slideCount: 1 }, building: true })
      w.mount(); await w.settle()
      const headers = [w.shot('').header], footers = [w.shot('').footer]
      for (const [director, canvas] of [[2, 1], [3, 2], [4, 3]]) {
        w.setLiveCount(director, canvas)
        w.poll(); await w.settle()
        const shot = w.shot('')
        headers.push(shot.header); footers.push(shot.footer)
      }
      assert.deepEqual(headers, [1, 2, 3, 4], `flag ${flag}: header grows with Director's count while building`)
      assert.deepEqual(footers, [1, 2, 3, 4], `flag ${flag}: footer too`)
      // the build ends (Layout holds 3 slides, Director's last count was a slide too many): settled, the viewer's count wins with the flag on; today's floor keeps 4
      w.setBuilding(false)
      w.setLiveCount(4, 3)
      w.poll(); await w.settle()
      assert.equal(w.shot('').header, flag === 'true' ? 3 : 4, `flag ${flag}: after the build`)
      w.close()
    }
  })

  // --- flag mechanics and the lib's own rules ---
  await check('flag: exact "true" only, default off; the lib is import-free', () => {
    assert.ok(sources[LIB], `${LIB} is missing`)
    assert.equal(truthLib('true').STUDIO_DECK_SYNC_TRUTH_ENABLED, true)
    for (const value of [undefined, '', 'false', 'TRUE', '1', ' true', 'true ']) assert.equal(truthLib(value).STUDIO_DECK_SYNC_TRUTH_ENABLED, false, String(value))
    assert.doesNotMatch(sources[LIB], /^\s*import\s/m)
    assert.match(sources[LIB], /process\.env\.NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH === 'true'/)
  })
  await check('flag on: the settled rule on its own: the viewer\'s count is the total, the visual total is never below it; a reply without a usable count (none, 0, a fraction, text) commits nothing over the base\'s', () => {
    const lib = truthLib('true')
    const T = (data, resolvedVisualTotal, building = false) => lib.syncTruthSettledTotals({ data, resolvedVisualTotal, building })
    assert.deepEqual(plain(T({ total: 2 }, 2)), { total: 2, visualTotal: 2 })
    assert.deepEqual(plain(T({ real_slide_count: 2, visual_section_count: 3 }, 3)), { total: 2, visualTotal: 3 })
    assert.deepEqual(plain(T({ total: 5 }, 3)), { total: 5, visualTotal: 5 })
    for (const data of [{}, { total: 0 }, { total: 2.5 }, { total: 'x' }, { total: null }, null, undefined, 'x']) assert.equal(T(data, 3), null, JSON.stringify(data))
    assert.equal(T({ total: 2 }, 2, true), null)
  })
  await check('pins: the viewer\'s rail header is totalSlides, the footer reads the same counters, the hook subscribes the controller to the page\'s reports, and the page is untouched', () => {
    assert.ok(sources[VIEWER].includes('                totalSlides={totalSlides}\n                composeJobs={composeJobs}'), 'the strip\'s heading total is the viewer\'s totalSlides')
    assert.ok(sources[VIEWER].includes('const [totalSlides, setTotalSlides] = useState(slideCount || 0)'), 'the viewer starts from the prop')
    assert.ok(sources[VIEWER].includes('            setTotalSlides(prev => prev === total ? prev : total)\n            setVisualTotalSlides(prev => prev === visualTotal ? prev : visualTotal)\n'), 'the base commits its floored totals with these two setters')
    assert.ok(sources[VIEWER].includes('          const total = Math.max(resolvedRealTotal, verifiedMinimumTotal)\n'), 'and the base\'s floor is untouched (a pure insertion)')
    assert.ok(sources[HOOK].includes('const offChange = onDeckChange(change => controller.announce(change))'), 'the hook announces what the page reports')
    assert.ok(sources[PAGE].includes('reportDeckChange(\'slide\') // NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE'), 'the page reports a Director change')
    assert.ok(sources[PAGE].includes('requestSlideRailRefresh(override.presentationId)\n      reportDeckChange(\'slide\')'), 'and the settler reports it too')
  })
  return { failures, passedNames }
}

// ---------- the run ----------
const results = []
const record = async (label, fn) => { try { await fn(); results.push([label, true]); console.log(`PASS ${label}`) } catch (error) { results.push([label, false]); console.error(`FAIL ${label}\n  ${String(error?.stack ?? error).split('\n').slice(0, 6).join('\n  ')}`) } }

const head = headSources()
const headRun = await suite(head, { log: true })

// --- flag off = byte identical to the base ---
await record('flag off, source: taking this change\'s lines out gives the base commit\'s file byte for byte (the viewer, the notice lib, the hook, the notice component), the strip is idempotent, and the page and the socket hook are the base\'s', () => {
  for (const rel of DECK_SYNC_TRUTH_FILES) {
    const stripped = stripDeckSyncTruth(rel, rawText(rel))
    assert.equal(sha(stripped), sha(gitText(rel, BASE)), rel)
    assert.equal(stripDeckSyncTruth(rel, stripped), stripped, `${rel} idempotent`)
    assert.ok(DECK_SYNC_TRUTH_MARKER_RE.test(rawText(rel)), `${rel} carries the marker`)
  }
  for (const rel of Object.keys(DECK_SYNC_TRUTH_PIN_EDITS)) assert.equal(sha(stripDeckSyncTruth(rel, rawText(rel))), sha(gitText(rel, BASE)), `${rel} (an older proof taught to read through the registry)`)
  assert.equal(sha(stripLaterEnvBlocks('.env.example', rawText('.env.example'))), sha(stripLaterEnvBlocks('.env.example', gitText('.env.example', BASE))), '.env.example: only this change\'s block is new')
  assert.ok(rawText('.env.example').includes(DECK_SYNC_TRUTH_ENV_BLOCK), 'the env block is in .env.example')
  assert.match(DECK_SYNC_TRUTH_ENV_BLOCK, /^NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH="false"$/m)
  for (const rel of [PAGE, SOCKET_HOOK]) assert.equal(sha(rawText(rel)), sha(gitText(rel, BASE)), `${rel} is the base's`)
})
await record('flag off, behaviour: the whole E2E-2 run (every step, the reload, the focus, the notices) on the current sources with the flag unset or "false" hashes the same as on the base sources', async () => {
  const mine = await e2e2Run({ sources: head, flag: undefined })
  const mineFocus = await e2e2Run({ sources: head, flag: undefined, focusBeforePoll: true })
  const base = await e2e2Run({ sources: baseSources(), flag: undefined })
  const baseFocus = await e2e2Run({ sources: baseSources(), flag: undefined, focusBeforePoll: true })
  assert.equal(sha(JSON.stringify(mine)), sha(JSON.stringify(base)))
  assert.equal(sha(JSON.stringify(mineFocus)), sha(JSON.stringify(baseFocus)))
  const falsy = await e2e2Run({ sources: head, flag: 'false' })
  assert.equal(sha(JSON.stringify(falsy)), sha(JSON.stringify(base)), 'flag "false" is off')
  console.log(`  e2e2 run, flag off: current ${sha(JSON.stringify(mine)).slice(0, 16)}  base ${sha(JSON.stringify(base)).slice(0, 16)}  (focus first: ${sha(JSON.stringify(mineFocus)).slice(0, 16)} / ${sha(JSON.stringify(baseFocus)).slice(0, 16)})`)
})
await record('the same checks on the BASE sources: every "flag off" check passes there (today\'s output is the base\'s), and the flag-on checks fail (the fix is what they measure)', async () => {
  const onBase = await suite(baseSources())
  for (const name of onBase.passedNames.concat(onBase.failures).filter(n => /^flag off/.test(n))) assert.ok(onBase.passedNames.includes(name), `flag-off check fails on the base: ${name}`)
  const failedOnBase = onBase.failures.filter(n => /^flag on/.test(n))
  assert.ok(failedOnBase.length >= 5, `flag-on checks that fail on the base: ${failedOnBase.length}`)
})

// --- the BASE..HEAD own-commit scope ---
await record(`scope: every commit in BASE..HEAD starts "${DECK_SYNC_TRUTH_SUBJECT}", touches only this change's files, adds only marked lines to the app files and takes out only the replaced base lines`, () => {
  assert.ok(git('rev-parse', '--verify', `${BASE}^{commit}`).trim().startsWith(BASE.slice(0, 7)), 'the base commit is in this clone')
  const subjects = git('log', '--no-merges', '--format=%s', `${BASE}..HEAD`).split('\n').filter(Boolean)
  assert.ok(subjects.length >= 1, 'at least one own commit')
  for (const subject of subjects) assert.ok(subject.startsWith(DECK_SYNC_TRUTH_SUBJECT), `own commit subject: ${subject}`)
  for (const body of git('log', '--no-merges', '--format=%B%x00', `${BASE}..HEAD`).split('\0').filter(b => b.trim())) assert.match(body, /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, 'commit trailer')
  const files = git('diff', '--name-only', `${BASE}..HEAD`).split('\n').filter(Boolean)
  assert.ok(files.length > 0)
  for (const file of files) assert.ok(DECK_SYNC_TRUTH_SCOPE_FILES.has(file), `stray file in BASE..HEAD: ${file}`)
  for (const rel of [PAGE, SOCKET_HOOK, 'hooks/use-builder-session.ts', 'lib/director-sync-recovery.ts']) assert.equal(files.includes(rel), false, `${rel} is not touched`)
  const replaced = new Set(Object.values(DECK_SYNC_TRUTH_REPLACED).flat().map(([, was]) => was.replace(/\n$/, '')))
  const diffLines = rel => git('diff', '-U0', `${BASE}..HEAD`, '--', rel).split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l))
  for (const rel of DECK_SYNC_TRUTH_FILES) {
    for (const line of diffLines(rel)) {
      if (line.startsWith('+')) assert.ok(DECK_SYNC_TRUTH_MARKER_RE.test(line), `${rel}: an added line without the marker: ${line.slice(0, 100)}`)
      else assert.ok(replaced.has(line.slice(1)), `${rel}: a removed line that is not a replaced base line: ${line.slice(0, 100)}`)
    }
  }
  for (const rel of Object.keys(DECK_SYNC_TRUTH_PIN_EDITS)) {
    // an edit to an older proof: its added lines carry the registry-read mark; what it removed is proven by the byte-for-byte put-back (the "flag off, source" check above)
    for (const line of diffLines(rel).filter(l => l.startsWith('+'))) assert.match(line, /registry read \(DECK-SYNC-TRUTH\)/, `${rel}: added ${line.slice(0, 100)}`)
  }
  assert.ok(files.includes('lib/studio-deck-sync-truth.ts') && files.includes('scripts/test-studio-deck-sync-truth.mjs'))
})

// --- mutants: each must break at least one check ---
class MutationTargetMissing extends Error {}
const mutate = (sources, rel, from, to) => {
  if (!sources[rel] || !sources[rel].includes(from)) throw new MutationTargetMissing(`${rel}: ${String(from).slice(0, 90)}`)
  return { ...sources, [rel]: sources[rel].replace(from, () => to) }
}
const MUTANTS = [
  ['lib: the settled totals are never offered (the viewer\'s count never wins)', s => mutate(s, LIB, 'if (reported === null) return null', 'return null')],
  ['lib: a build in progress is ignored (the floor would be overridden while building)', s => mutate(s, LIB, 'if (input.building) return null\n', '')],
  ['lib: a reply with no count is taken as 0', s => mutate(s, LIB, 'if (reported === null) return null', 'if (reported === null) return { total: 0, visualTotal: 0 }')],
  ['lib: the visual total is one too many (the footer would disagree with the rail header)', s => mutate(s, LIB, 'visualTotal: Math.max(visual, reported)', 'visualTotal: Math.max(visual, reported) + 1')],
  ['lib: the notice words say "in another tab" for every cause', s => mutate(s, LIB, 'return DECK_UPDATED_NOTICE_TEXT\n}', "return 'This deck changed in another tab'\n}")],
  ['lib: a broadcast reads "updated"', s => mutate(s, LIB, "if (source === 'broadcast') return 'This deck changed in another tab'", "if (source === 'broadcast') return DECK_UPDATED_NOTICE_TEXT")],
  ['lib: the Director window is 0 (nothing is explained)', s => mutate(s, LIB, 'DIRECTOR_CHANGE_WINDOW_MS = 15_000', 'DIRECTOR_CHANGE_WINDOW_MS = -1')],
  ['lib: the confirm delay is 0 (a difference is shown at once)', s => mutate(s, LIB, 'NOTICE_CONFIRM_DELAY_MS = 4_000', 'NOTICE_CONFIRM_DELAY_MS = 0')],
  ['lib: the flag matches "TRUE" too', s => mutate(s, LIB, "process.env.NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH === 'true'", "String(process.env.NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH).toLowerCase() === 'true'")],
  ['viewer: the settled totals are never committed', s => mutate(s, VIEWER, 'const deckSyncSettled = STUDIO_DECK_SYNC_TRUTH_ENABLED ? syncTruthSettledTotals({', 'const deckSyncSettled = false ? syncTruthSettledTotals({')],
  ['viewer: the settled totals are committed only when the slide info changed (the restored count would come down once and be raised again)', s => mutate(s, VIEWER, 'if (deckSyncSettled) { setTotalSlides', 'if (deckSyncSettled && !lastSlideInfoRef.current) { setTotalSlides')],
  ['viewer: only the real total is committed (the footer keeps the floored visual total)', s => mutate(s, VIEWER, '; setVisualTotalSlides(prev => prev === deckSyncSettled.visualTotal ? prev : deckSyncSettled.visualTotal) }', ' }')],
  ['viewer: the building ref is never on', s => mutate(s, VIEWER, 'deckSyncBuildingRef.current = !studioShell || Boolean(isGenerating) || Boolean(studioPartialArtifact)', 'deckSyncBuildingRef.current = false')],
  ['viewer: a partial artifact is not a build', s => mutate(s, VIEWER, ' || Boolean(studioPartialArtifact) // DECK-SYNC-TRUTH', ' // DECK-SYNC-TRUTH')],
  ['viewer: outside the Studio shell the floor is dropped too', s => mutate(s, VIEWER, 'deckSyncBuildingRef.current = !studioShell || ', 'deckSyncBuildingRef.current = ')],
  ['viewer: the settled totals get no data (a reply\'s count is lost)', s => mutate(s, VIEWER, 'syncTruthSettledTotals({ data, resolvedVisualTotal', 'syncTruthSettledTotals({ data: null, resolvedVisualTotal')],
  ['notice lib: announce forgets when it announced', s => mutate(s, NOTICE_LIB, 'lastAnnounceAt = t // DECK-SYNC-TRUTH', '// DECK-SYNC-TRUTH')],
  ['notice lib: an announced change does not explain a difference (no quiet refresh)', s => mutate(s, NOTICE_LIB, 'if (deps.quietRefresh && !viewer.unsaved && deps.directorWindowMs !== undefined && now() - lastAnnounceAt <= deps.directorWindowMs)', 'if (false)')],
  ['notice lib: the quiet refresh ignores unsaved edits', s => mutate(s, NOTICE_LIB, 'deps.quietRefresh && !viewer.unsaved &&', 'deps.quietRefresh &&')],
  ['notice lib: the confirmation is skipped (the difference is shown at once)', s => mutate(s, NOTICE_LIB, 'if (!confirmed && deps.confirmDelayMs !== undefined)', 'if (false)')],
  ['notice lib: the confirmation does not re-read the viewer (the first verdict stands)', s => mutate(s, NOTICE_LIB, 'if (!inventoryDiffers({ viewerSlideCount: viewer.slideCount, readCount: read.count, readSignature: read.signature, knownSignature: previous })) return // DECK-SYNC-TRUTH', '// DECK-SYNC-TRUTH')],
  ['notice lib: dispose leaves the confirmation timer', s => mutate(s, NOTICE_LIB, "reconnectRetryTimer = null }\n      if (confirmTimer !== null) { clearTimer(confirmTimer); confirmTimer = null } // DECK-SYNC-TRUTH\n      queuedChange = null", 'reconnectRetryTimer = null }\n      queuedChange = null')],
  ['notice lib: Reload deck leaves the confirmation timer', s => mutate(s, NOTICE_LIB, 'markReloaded() {\n      if (disposed) return\n      if (confirmTimer !== null) { clearTimer(confirmTimer); confirmTimer = null } // DECK-SYNC-TRUTH\n', 'markReloaded() {\n      if (disposed) return\n')],
  ['notice lib: the broadcast path no longer shows a notice', s => mutate(s, NOTICE_LIB, "show('broadcast', message.change)", '/* nothing */')],
  ['notice lib: check() ignores a waiting confirmation (a second read per focus)', s => mutate(s, NOTICE_LIB, 'if (confirmTimer !== null) return // DECK-SYNC-TRUTH', '// DECK-SYNC-TRUTH')],
  ['hook: the deps are not passed (the notice is today\'s)', s => mutate(s, HOOK, '...(STUDIO_DECK_SYNC_TRUTH_ENABLED && { directorWindowMs', '...(false && { directorWindowMs')],
  ['hook: the deps are passed with the flag off', s => mutate(s, HOOK, '...(STUDIO_DECK_SYNC_TRUTH_ENABLED && { directorWindowMs', '...(true && { directorWindowMs')],
  ['component: the words ignore the flag and say "another tab"', s => mutate(s, COMPONENT, '{STUDIO_DECK_SYNC_TRUTH_ENABLED /*', '{false /*')],
  ['socket hook: the restore prefers the strawman', s => mutate(s, SOCKET_HOOK, 'displayUrl = sessionState.finalPresentationUrl || null;\n      displayId = sessionState.finalPresentationId || null;', 'displayUrl = sessionState.strawmanPreviewUrl || null;\n      displayId = sessionState.strawmanPresentationId || null;')],
]
await record(`mutants: ${MUTANTS.length} broken copies of the lib, the viewer, the controller, the hook, the component and the restore are each caught`, async () => {
  const survived = []
  let caught = 0
  for (const [label, make] of MUTANTS) {
    let mutated
    try { mutated = make(headSources()) } catch (error) { if (error instanceof MutationTargetMissing) { survived.push(`${label} (target missing: ${error.message})`); continue } throw error }
    let run
    try { run = await suite(mutated) } catch { caught++; continue } // a mutant that breaks the run itself is caught
    if (run.failures.length === 0) survived.push(label); else caught++
  }
  assert.deepEqual(survived, [], `survivors: ${survived.join(' | ')}`)
  console.log(`  ${caught} of ${MUTANTS.length} mutants caught`)
})

const suiteFailed = headRun.failures.length
const recordFailed = results.filter(([, ok]) => !ok).length
const total = headRun.passedNames.length + suiteFailed + results.length
console.log(`\ndeck sync truth: ${total - suiteFailed - recordFailed} of ${total} checks passed${suiteFailed + recordFailed ? `, ${suiteFailed + recordFailed} FAILED` : ''}`)
process.exit(suiteFailed + recordFailed ? 1 : 0)
