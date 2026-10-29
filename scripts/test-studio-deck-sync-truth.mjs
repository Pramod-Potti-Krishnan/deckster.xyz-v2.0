// FRONTEND-2 (B26): after chat deletes and a reload, "Slides 3" over a 2-slide deck and "This deck changed in another tab" with no other tab (E2E-2, Studio dev, 27 Oct).
// Flag NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH, exact "true", default off.
// Run: node scripts/test-studio-deck-sync-truth.mjs   (plain node: transpile + vm, no network; `git` reads the base commit and the committed diff)
//
// What it replays: E2E-2's sequence (3 slides -> chat delete -> chip undo -> chat delete -> typed undo -> probe delete -> RELOAD) on the code the browser runs.
//   The SESSION ROW (what the Decks page card and the session list read): the page's marked block (the building ref, the writer, the write) and the call in its onDeckMutation are cut from the source and run; the row is an in-memory
//   object that persistence.updateMetadata merges into (the page's existing write; the chain from there to the card is pinned in source below); the Decks card's reader (the dashboard's session mapping and the card's count label) is the real code.
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
import { LATER_STRIPS, stripLaterChanges, stripLaterEnvBlocks } from './studio-later-changes.mjs'

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
const DASH = 'app/(app)/dashboard/page.tsx' // the Decks page: the session list's mapping and the deck card
const CARD_LIB = 'lib/studio-deck-card-count.ts'
const LIBS = [LIB, NOTICE_LIB, CARD_LIB, 'lib/slide-compose-async.ts', 'lib/studio-slide-count-sync.ts', 'lib/studio-deck-mutation-refresh.ts', 'lib/studio-deck-mutation-dedupe.ts',
  'lib/slide-rail-identity.ts', 'lib/builder-presentation-ownership.ts', 'lib/studio-bulk-edit-wire.ts', 'lib/director-sync-recovery.ts', 'lib/studio-open-read-only.ts']
const APP = [VIEWER, COMPONENT, HOOK, PAGE, SOCKET_HOOK, DASH]

const sha = text => createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const rawText = rel => readFileSync(path.join(repoRoot, rel), 'utf8')
const gitText = (rel, rev) => execFileSync('git', ['show', `${rev}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
/** What a PEER (every other change in the registry) leaves in a file: the file with the other changes' marked lines out and this change's still in. Read on both sides of a comparison with dev's file, so a change that lands on dev later does not make this change's identity checks fail. */
const stripPeers = (rel, text) => LATER_STRIPS.filter(strip => strip !== stripDeckSyncTruth).reverse().reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): newest change first, so a pin line two later changes teach (arrange's read: chat parity after #522) is put back in the order it was edited

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

/** The call expression `name(...)` that starts at the first match of `re` (parenthesis-matched), e.g. the hook's options.onSessionStateChange({...}). */
function cutCall(text, re) {
  const m = re.exec(text)
  if (!m) return null
  let depth = 0
  for (let i = m.index + m[0].indexOf('('); i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')' && --depth === 0) return text.slice(m.index, i + 1)
  }
  return null
}
/** The `{ ... }` block that follows the first match of `anchor` (brace-matched), with the text up to the block (an `if (...)` condition). */
function cutIfBlock(text, anchor) {
  const at = text.indexOf(anchor)
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
  let inventoryReads = 0
  return {
    count: id => decks[id].length,
    reads: () => inventoryReads, // inventory GETs so far (the rail list's, the notice's, the row writer's)
    remove(id, index) { stash.push({ id, index, slide: decks[id].splice(index, 1)[0] }) },
    insert(id, index, slide) { decks[id].splice(index, 0, slide) },
    restore() { const { id, index, slide } = stash.pop(); decks[id].splice(index, 0, slide) },
    fetch: async url => {
      const m = /\/api\/presentations\/([^/]+)\/slides\/inventory$/.exec(String(url))
      if (!m || !decks[decodeURIComponent(m[1])]) return new Response('', { status: 404 })
      inventoryReads++
      const id = decodeURIComponent(m[1])
      return new Response(JSON.stringify({ presentation_id: id, slide_count: decks[id].length,
        slides: decks[id].map((s, i) => ({ slide_index: i, slide_id: s.slide_id, title: s.title, layout: 'C1', thumbnail_url: null })) }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  }
}

// ---------- the world: one page load of the Builder over Layout ----------
// flag: the value of NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH for this build (undefined = unset). The other flags are the ones Studio dev runs these frames under (the notice, S-03, the count settler, chat undo, count sync).
function world({ sources, flag, layout, row, building = false, liveOverride = null, env: extraEnv = {}, session = true, shell = true, quiet: quietOpen = false }) {
  const env = { NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE: 'true', NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED: 'true', NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE: 'true',
    NEXT_PUBLIC_STUDIO_CHAT_UNDO: 'true', NEXT_PUBLIC_STUDIO_SLIDE_COUNT_SYNC_ENABLED: 'true', NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', ...extraEnv }
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
  const viewerText = sources[VIEWER], pageText = stripPeers(PAGE, sources[PAGE]), hookText = sources[HOOK], componentText = sources[COMPONENT], socketText = sources[SOCKET_HOOK]
  const STUDIO_DECK_SYNC_TRUTH_ENABLED = truth ? truth.STUDIO_DECK_SYNC_TRUTH_ENABLED : false

  // -- the restore's choice of the displayed deck (hooks/use-deckster-websocket-v2.ts restoreMessages, cut) --
  const restoreBlock = cutLines(socketText, "let activeVersion: 'blank' | 'strawman' | 'final' = 'final';", 'displayId = sessionState.finalPresentationId || null;')
  const restored = evalSnippet(restoreBlock + '\n}', ['sessionState'], '{ activeVersion, displayUrl, displayId }')({ sessionState: row })
  // the live state after the restore (restoreMessages sets presentationUrl / presentationId to the display ones and slideCount to the row's)
  const live = liveOverride ?? { presentationUrl: restored.displayUrl, presentationId: restored.displayId, slideCount: row.slideCount || null }
  // the socket hook's own state as the restore leaves it (restoreMessages: the row's final deck slots, the version it chose, the row's count); Director's frames below change it the way the hook does, and `live` follows it (the page reads presentationUrl / presentationId / slideCount)
  const hook = { presentationUrl: live.presentationUrl, presentationId: live.presentationId, finalPresentationUrl: row.finalPresentationUrl ?? null, finalPresentationId: row.finalPresentationId ?? null,
    deckOwnerSessionId: 'b6cbb408', activeVersion: liveOverride ? 'final' : restored.activeVersion, isBlankPresentation: false, slideCount: live.slideCount, currentStatus: null }
  const followHook = () => { live.presentationUrl = hook.presentationUrl; live.presentationId = hook.presentationId; live.slideCount = hook.slideCount }

  // -- the page: the real onDeckMutation handler and count settler --
  const builder = { override: null }
  const ref = { current: { presentationUrl: live.presentationUrl, presentationId: live.presentationId, slideCount: live.slideCount, activeVersion: hook.activeVersion, refreshToken: 0 } }
  const effective = () => ownership.resolveEffectivePresentation({ livePresentationUrl: live.presentationUrl, livePresentationId: live.presentationId, liveSlideCount: live.slideCount, override: builder.override })
  // -- the session row and the page's own write to it (persistence.updateMetadata, which merges into the row), and the page's marked block that settles the row's count (cut from the source, run on every render) --
  const rowState = { ...row }
  const rowWrites = [] // every write the page asks for
  const sentWrites = [] // what reaches the server: with quiet on (NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: an opened session is read-only until the user acts) a passive write is trimmed by the real lib/studio-open-read-only.ts against the row as it was opened
  const openReadOnly = load('lib/studio-open-read-only.ts')
  const quietState = quietOpen && openReadOnly ? openReadOnly.beginOpenQuiet('b6cbb408', row) : null
  const persistence = { updateMetadata: (updates, options) => {
    rowWrites.push({ updates: { ...updates }, options: options ?? null })
    let effective = updates
    if (quietState && openReadOnly.isOpenQuiet(quietState, 'b6cbb408')) {
      if (options?.passive) effective = openReadOnly.openQuietMetadata(quietState, updates)
      else openReadOnly.releaseOpenQuiet(quietState)
    }
    if (!effective) return
    sentWrites.push({ ...effective })
    if ('slideCount' in effective) rowState.slideCount = effective.slideCount
  } }
  const sessionIdRef = { current: session ? 'b6cbb408' : null }, persistenceRef = { current: session ? persistence : null }
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [clock.t])) } static now() { return clock.t } }
  let partial = false, composeJobs = [], templateMode = false // `building` is true for a final build, 'strawman' for a strawman build
  const hookRefs = []
  let refCursor = 0, blockRefs = null
  const blockText = cutLines(pageText, 'const deckSyncBuildingRef = useRef(false)', '}) // DECK-SYNC-TRUTH')
  const blockNames = ['useRef', 'studioShell', 'studioPartialMetadata', 'templateModeOn', 'isGeneratingFinal', 'isGeneratingStrawman', 'slideComposeThumbnailJobs', 'createSettledRowCountWriter', 'fetchSlideInventory', 'getLayoutServiceUrl', 'fetch',
    'slideComposerPresentationRef', 'currentSessionIdRef', 'persistenceRef']
  const blockRun = blockText ? evalSnippet(blockText, blockNames, '{ deckSyncRowCountRef, deckSyncBuildingRef }', { ...globals, Date: ClockDate, process: { env } }) : null
  /** One render of the page's block: React hands back the same ref object at each call position, the building ref is assigned afresh, and the writer is made once (the flag read inline). */
  const runPageBlock = () => {
    if (!blockRun) return
    refCursor = 0
    blockRefs = blockRun({ useRef: initial => { const at = refCursor++; if (!hookRefs[at]) hookRefs[at] = { current: initial }; return hookRefs[at] },
      studioShell: shell, studioPartialMetadata: partial, templateModeOn: templateMode, isGeneratingFinal: building === true, isGeneratingStrawman: building === 'strawman', slideComposeThumbnailJobs: composeJobs,
      createSettledRowCountWriter: truth ? truth.createSettledRowCountWriter : undefined, fetchSlideInventory: rail.fetchSlideInventory, getLayoutServiceUrl: () => LAYOUT, fetch: layout.fetch,
      slideComposerPresentationRef: ref, currentSessionIdRef: sessionIdRef, persistenceRef })
  }
  runPageBlock()
  // the build's own count rule (onSessionStateChange, a base line this change leaves alone): the row only ever rises while a build runs
  const buildRule = cutLines(pageText, 'const verifiedLayoutCount = (() => {', 'const nextSlideCount = Math.max(state.slideCount ?? 0, verifiedLayoutCount ?? 0) || state.slideCount')
  const buildRuleRun = buildRule ? evalSnippet(buildRule, ['state', 'slideComposerPresentationRef'], 'nextSlideCount') : null
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
  pageDeps.deckSyncRowCountRef = blockRefs ? blockRefs.deckSyncRowCountRef : undefined // the same ref object at every render
  const onDeckMutation = evalSnippet('', [...pageNames, 'deckMutationCountSettlerRef', 'deckSyncRowCountRef'], `(${cutArrow(pageText, 'onDeckMutation: (message')})`, globals)(pageDeps)

  // -- Director's state frames: the page's real onSessionStateChange callback (cut from the source), and the two ways the hook calls it for the final deck (cut from the hook): the sync_response recovery (a reconnect) and a presentation_url frame --
  const silentConsole = { log() {}, warn() {}, error() {} }
  const sessionCallbackText = cutArrow(pageText, 'onSessionStateChange: (state)')
  const pageOnSessionStateChange = sessionCallbackText ? evalSnippet('', ['currentSessionIdRef', 'persistenceRef', 'slideComposerPresentationRef', 'deckSyncRowCountRef', 'deckSyncBuildingRef'], `(${sessionCallbackText})`, { console: silentConsole, Date: ClockDate })({
    currentSessionIdRef: sessionIdRef, persistenceRef, slideComposerPresentationRef: ref, deckSyncRowCountRef: blockRefs ? blockRefs.deckSyncRowCountRef : undefined, deckSyncBuildingRef: blockRefs ? blockRefs.deckSyncBuildingRef : undefined }) : null
  const recoveryLib = load('lib/director-sync-recovery.ts')
  const syncCallbackText = cutIfBlock(socketText, 'if (recovery.didChangeDisplayedDeck && options.onSessionStateChange && newState.finalPresentationUrl)')
  const runSyncCallback = syncCallbackText ? evalSnippet(syncCallbackText, ['recovery', 'options', 'newState'], 'null') : null
  const finalFrameCallText = cutCall(socketText, /options\.onSessionStateChange\(\{\s*presentationUrl: message\.payload\.url,/)
  const runFinalFrameCallback = finalFrameCallText ? evalSnippet(`${finalFrameCallText}`, ['options', 'message'], 'null') : null

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
    ref.current = { presentationUrl: eff.presentationUrl, presentationId: eff.presentationId, slideCount: eff.slideCount, activeVersion: hook.activeVersion, refreshToken: eff.refreshToken }
    runPageBlock()
    const url = withToken(eff.presentationUrl, eff.refreshToken)
    if (viewer.url !== url) { viewer.canvas = layout.count(eff.presentationId); viewer.url = url; viewer.iframeReady = true; lastSlideInfo = null } // a new URL reloads the iframe: it shows Layout's real deck (and the viewer forgets its last slide info)
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
    reloadCount: () => reloads, controller: () => controller, setBuilding: value => { building = value; runPageBlock() },
    setPartial: value => { partial = value; runPageBlock() }, setComposeJobs: jobs => { composeJobs = jobs; runPageBlock() }, setTemplateMode: value => { templateMode = value; runPageBlock() },
    rowCount: () => rowState.slideCount, rowWrites, sentWrites, sessionIdRef, persistenceRef, hook, layout,
    /** One of Director's state frames reaching the page's onSessionStateChange (`state` as the hook passes it). */
    sessionState(state) { pageOnSessionStateChange(state) },
    /** A reconnect: Director's sync_response runs the hook's real recovery (lib/director-sync-recovery.ts) and, when it changes the displayed deck, the hook's own call to the page's callback; then the hook's state is committed and the page renders it. */
    syncResponse(payload) {
      const recovery = recoveryLib.applyFinalSyncRecovery(hook, payload, 'b6cbb408')
      if (!recovery.didRecover) return recovery
      const newState = { ...hook }
      Object.assign(newState, recovery.state)
      runSyncCallback({ recovery, options: { onSessionStateChange: pageOnSessionStateChange }, newState }) // inside the hook's state update: the page has not rendered the new state yet
      Object.assign(hook, newState); followHook(); render()
      return recovery
    },
    /** A presentation_url frame (the build's last frame, or Director's history replayed on a reconnect): the hook sets the final deck and its slide_count, then calls the page's callback. */
    finalFrame(payload) {
      const message = { payload }
      runFinalFrameCallback({ options: { onSessionStateChange: pageOnSessionStateChange }, message })
      Object.assign(hook, { finalPresentationUrl: payload.url, finalPresentationId: payload.presentation_id, deckOwnerSessionId: 'b6cbb408', isBlankPresentation: false, activeVersion: 'final',
        presentationUrl: payload.url, presentationId: payload.presentation_id, slideCount: payload.slide_count, currentStatus: null }) // the hook's presentation_url case, pinned in the suite
      followHook(); render()
    },
    /** One of Director's own state frames while a build runs: the page's onSessionStateChange count rule (cut from the source) decides the count its write carries. */
    buildFrame({ slideCount }) {
      const state = { presentationId: live.presentationId, presentationUrl: live.presentationUrl, slideCount }
      const next = buildRuleRun ? buildRuleRun({ state, slideComposerPresentationRef: ref }) : slideCount
      persistence.updateMetadata({ slideCount: next, lastMessageAt: new Date(0) }, { passive: true })
    },
    /** Page load + first render + the first poll */
    mount() { render(); mountController(); poll() },
    /** the first render after a page load: the iframe loads and the viewer holds the prop's count, before any poll */
    boot() { render(); mountController() },
    /** Director's count rises (the page's live count, as a build's frames raise it); the viewer's iframe shows `canvas` slides */
    setLiveCount(count, canvas) { live.slideCount = count; hook.slideCount = count; viewer.canvas = canvas; render() },
    shot: label => ({ label, header: header(), footer: footer(), rail: viewer.railList, canvas: viewer.canvas, row: rowState.slideCount, notice: notices.length && notices[notices.length - 1] ? noticeText(notices[notices.length - 1].source) : null }),
    /** Director's chat op: Layout changes, then the recorded frame reaches the page's handler (the hook's checks have passed for the displayed deck). */
    async chat(frame, mutate, { presentationId = FINAL, ownerCurrent = true } = {}) {
      mutate()
      const f = structuredClone(frame)
      f.payload.presentation_id = presentationId
      if (f.payload.presentation_url) f.payload.presentation_url = `${LAYOUT}/p/${presentationId}`
      f.message_id = `${f.message_id}-${++world.frames}`
      f.payload.refresh_token = `${f.payload.refresh_token}-${world.frames}`
      f.session_id = 'b6cbb408'
      wire.normaliseDeckRestored(f) // the hook does this before the page sees an undo's deck_restored
      onDeckMutation(f, { isCurrent: () => ownerCurrent, presentationId })
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
async function e2e2Run({ sources, flag, focusBeforePoll = false, reloadFrom = 'build', env }) {
  const layout = createLayout()
  const steps = []
  const w = world({ sources, flag, layout, row: ROW(), env })
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
  const beforeReload = { pageCount: w.effective().slideCount, rowCount: w.rowCount() }
  const midRunNotices = w.notices.filter(Boolean).length
  w.close()
  // RELOAD: a new page from the session row, a new notice controller. reloadFrom 'build' = the row E2E-2 had (the build's count: written before this change existed, and nothing lowered it); 'as-left' = the row the first page left behind
  const r = world({ sources, flag, layout, row: reloadFrom === 'as-left' ? { ...ROW(), slideCount: w.rowCount() } : ROW(), env })
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
  const result = { steps, midRunNotices, beforeReload, rowWrites: w.rowWrites.length, restoredDeck: r.restored, loaded, early, polled, afterFocus, notices: r.notices.filter(Boolean), reloads: r.reloadCount() }
  r.close()
  return result
}

// ---------- a stale count re-sent after a chat delete (B29): the reconnect ----------
// Director's own slide_count is the BUILD's (3). After a chat delete the deck has 2. Three ways Director re-sends it on a settled final deck, each through the hook's real code and the page's real onSessionStateChange:
//   'samePage'  a socket reconnect on the same page: sync_response (the hook's state is the final deck already: lib/director-sync-recovery.ts recovers nothing)
//   'replay'    Director's history replayed on the reconnect: a presentation_url frame with the build's slide_count (the hook sets slideCount to it, then calls the page)
//   'reload'    a page reload whose row restores the strawman first (activeVersion "strawman": the PR's open caveat) and a sync_response that promotes the final deck (Math.max(2, 3) in the recovery)
const SYNC = (extra = {}) => ({ current_state: 'CONTENT_GENERATED', presentation_url: `${LAYOUT}/p/${FINAL}`, presentation_id: FINAL, slide_count: 3, ...extra })
const FINAL_FRAME = (extra = {}) => ({ url: `${LAYOUT}/p/${FINAL}`, presentation_id: FINAL, slide_count: 3, ...extra })
const ROW_STRAWMAN_FIRST = () => ({ ...ROW(), slideCount: 2, activeVersion: 'strawman', currentStage: 4 })
async function reconnectScenario({ sources, flag, scenario, env, quiet = false, afterSettle = null }) {
  const layout = createLayout()
  const out = { scenario, steps: [], rowWrites: null, row: null, layoutReads: null, recovered: null }
  let w
  if (scenario === 'reload') {
    layout.remove(FINAL, 2) // the chat deleted a slide on the final deck before the reload
    w = world({ sources, flag, layout, row: ROW_STRAWMAN_FIRST(), env, quiet })
    w.boot(); w.poll(); await w.settle()
    out.steps.push(w.shot('reload: the strawman is painted first'))
    out.recovered = w.syncResponse(SYNC()).didRecover
    if (afterSettle) afterSettle(w)
    out.steps.push(w.shot('sync_response promoted the final deck (before the viewer\'s poll)'))
    await w.settle()
    out.steps.push(w.shot('the layout read answered (before the viewer\'s poll)'))
    w.poll(); await w.settle()
    out.steps.push(w.shot('after the viewer\'s next poll'))
  } else {
    w = world({ sources, flag, layout, row: ROW(), quiet })
    w.mount(); await w.settle()
    await w.chat(RECORDED.deleteSlide3(), () => layout.remove(FINAL, 2)); await w.advance(3500)
    out.steps.push(w.shot('chat delete: 2 slides'))
    if (scenario === 'samePage') out.recovered = w.syncResponse(SYNC()).didRecover
    else w.finalFrame(FINAL_FRAME())
    if (afterSettle) afterSettle(w)
    out.steps.push(w.shot('the stale count re-sent (before anything is read)'))
    await w.settle()
    out.steps.push(w.shot('the layout read answered'))
    await w.advance(3500)
    out.steps.push(w.shot('after the viewer\'s next poll'))
  }
  out.rowWrites = w.rowWrites.map(x => x.updates.slideCount)
  out.sentCounts = w.sentWrites.map(x => x.slideCount)
  out.row = w.rowCount()
  out.layoutReads = layout.reads()
  out.hookCount = w.hook.slideCount
  out.notices = w.notices.filter(Boolean).length
  w.close()
  return out
}
const SCENARIOS = ['samePage', 'replay', 'reload']
/** Every reconnect scenario once: what a flag-off page must do the same on the base sources. */
async function reconnectRun({ sources, flag, env }) {
  const all = []
  for (const quiet of [false, true]) for (const scenario of SCENARIOS) all.push(await reconnectScenario({ sources, flag, scenario, env, quiet }))
  return all
}
/** #533 as it was before the reconnect lines (B29): this change's own sources with only those lines taken out. */
const RECONNECT_MARK = 'DECK-SYNC-TRUTH (reconnect'
const withoutReconnectLines = sources => ({ ...sources, [PAGE]: sources[PAGE].split('\n').filter(line => !line.includes(RECONNECT_MARK)).join('\n') })

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


  // --- the session row: the Decks page card and the session list read it ---
  const deckCard = rowCount => {
    const dash = sources[DASH], cardLib = makeLoader(sources, {}, {})(CARD_LIB)
    const map = evalSnippet(`${cutFunction(dash, 'getStatusFromStage')}\n${cutFunction(dash, 'getFirstMessage')}\n${cutLines(dash, 'const transformedPresentations = sessionsWithPresentations.map(session => ({', '}))')}`, ['sessionsWithPresentations'], 'transformedPresentations')
    const [card] = map({ sessionsWithPresentations: [{ id: 'b6cbb408', title: 'Deck', createdAt: '2026-10-27T01:00:00Z', updatedAt: '2026-10-27T01:19:00Z', currentStage: 6, slideCount: rowCount, messages: [], strawmanPreviewUrl: null, finalPresentationUrl: `${LAYOUT}/p/${FINAL}` }] })
    return { slideCount: card.slideCount, status: card.status, label: cardLib.studioDeckCardCountLabel(card.slideCount, card.status), plainLabel: `${card.slideCount} slides` }
  }
  await check('flag off: the session row keeps the build\'s 3 through the whole E2E-2 run (no write), and the Decks card reads "3 slides" over the 2-slide deck (today)', async () => {
    const r = await e2e2Run({ sources, flag: undefined, reloadFrom: 'as-left' })
    assert.deepEqual(r.steps.map(s => s.row), [3, 3, 3, 3, 3, 3])
    assert.equal(r.rowWrites, 0, 'the page writes nothing to the row on a chat change')
    assert.equal(r.beforeReload.rowCount, 3)
    assert.deepEqual([deckCard(r.beforeReload.rowCount).plainLabel, deckCard(r.beforeReload.rowCount).label], ['3 slides', '3 slides'])
    assert.equal(r.steps.at(-1).rail, 2, 'the deck has 2 slides')
  })
  await check('flag on: E2E-2\'s run ends with the session row at 2 (not 3): it follows the deck through delete, chip undo, delete, typed undo and probe delete (3, 2, 3, 2, 3, 2), and the Decks card reads "2 slides"', async () => {
    const r = await e2e2Run({ sources, flag: 'true', reloadFrom: 'as-left' })
    assert.deepEqual(r.steps.map(s => s.row), [3, 2, 3, 2, 3, 2])
    assert.equal(r.rowWrites, 5, 'one write per chat change, none for the build\'s own count')
    assert.equal(r.beforeReload.rowCount, 2)
    assert.deepEqual([deckCard(r.beforeReload.rowCount).plainLabel, deckCard(r.beforeReload.rowCount).label], ['2 slides', '2 slides'])
    // the reload reads that row: the header and the footer are right from the first paint (before any poll), the rail list agrees, and there is no notice
    assert.deepEqual([r.loaded.header, r.loaded.footer, r.loaded.rail, r.loaded.canvas], [2, 2, 2, 2])
    assert.deepEqual([r.afterFocus.header, r.afterFocus.footer], [2, 2])
    assert.deepEqual(r.notices, [])
  })
  await check('flag on: the row follows with the count settler off too (the write reads Layout\'s inventory itself, not the settler\'s answer)', async () => {
    const r = await e2e2Run({ sources, flag: 'true', reloadFrom: 'as-left', env: { NEXT_PUBLIC_STUDIO_DECK_MUTATION_DEDUPE: 'false' } })
    assert.deepEqual(r.steps.map(s => s.row), [3, 2, 3, 2, 3, 2])
  })
  await check('flag on: each write is the page\'s existing session write (persistence.updateMetadata) with the count and lastMessageAt, passive as the Layout count reconcile\'s; a deck_restored (an undo) writes the restored version\'s count', async () => {
    const layout = createLayout()
    const w = world({ sources, flag: 'true', layout, row: ROW() })
    w.mount(); await w.settle()
    await w.chat(RECORDED.deleteSlide3(), () => layout.remove(FINAL, 2)); await w.advance(500)
    await w.chat(RECORDED.deckRestored(), () => layout.restore()); await w.advance(500)
    assert.deepEqual(w.rowWrites.map(x => Object.keys(x.updates).sort()), [['lastMessageAt', 'slideCount'], ['lastMessageAt', 'slideCount']])
    assert.deepEqual(w.rowWrites.map(x => x.updates.slideCount), [2, 3])
    assert.deepEqual(w.rowWrites.map(x => plain(x.options)), [{ passive: true }, { passive: true }])
    for (const write of w.rowWrites) assert.ok(write.updates.lastMessageAt instanceof Date)
    w.close()
  })
  await check('flag on: a build in progress keeps today\'s rule: the row is raised by the build\'s frames (1, 2, 3, 4: Director\'s count, one too many at the end) and a chat change during the build writes nothing; the build over, the next chat change settles the row on Layout\'s count', async () => {
    for (const flag of [undefined, 'true']) {
      const layout = createLayout()
      layout.remove(FINAL, 2); layout.remove(FINAL, 1) // the build has landed its first slide
      const w = world({ sources, flag, layout, row: { ...ROW(), slideCount: 1 }, building: true })
      w.mount(); await w.settle()
      const rows = [w.rowCount()]
      for (const [director, canvas] of [[2, 1], [3, 2], [4, 3]]) { w.setLiveCount(director, canvas); w.buildFrame({ slideCount: director }); rows.push(w.rowCount()) }
      assert.deepEqual(rows, [1, 2, 3, 4], `flag ${flag}: the build raises the row`)
      layout.insert(FINAL, 1, SLIDES[1]); layout.insert(FINAL, 2, SLIDES[2]) // Layout holds 3 slides when the build ends
      const writesBefore = w.rowWrites.length
      await w.chat(RECORDED.deleteSlide3(), () => layout.remove(FINAL, 2)); await w.advance(500)
      assert.equal(w.rowWrites.length, writesBefore, `flag ${flag}: a chat change during the build writes nothing to the row`)
      assert.equal(w.rowCount(), 4)
      w.setBuilding(false)
      await w.chat(RECORDED.deleteSlide2(), () => layout.remove(FINAL, 1)); await w.advance(500)
      assert.equal(w.rowCount(), flag === 'true' ? 1 : 4, `flag ${flag}: after the build the chat change settles the row (Layout holds 1 slide now)`)
      w.close()
    }
  })
  await check('flag on: nothing is written while the deck is not settled (a strawman build, template mode, a partial artifact, compose jobs, outside the Studio shell), for a frame of another deck, a retired owner, or no session; a settled deck writes', async () => {
    const layout = createLayout()
    const w = world({ sources, flag: 'true', layout, row: ROW() })
    w.mount(); await w.settle()
    w.setBuilding('strawman')
    await w.chat(RECORDED.deleteSlide3(), () => {}); await w.advance(500)
    assert.equal(w.rowWrites.length, 0, 'a strawman build')
    w.setBuilding(false); w.setTemplateMode(true)
    await w.chat(RECORDED.deleteSlide3(), () => {}); await w.advance(500)
    assert.equal(w.rowWrites.length, 0, 'template mode')
    w.setTemplateMode(false); w.setPartial(true)
    await w.chat(RECORDED.deleteSlide3(), () => layout.remove(FINAL, 2)); await w.advance(500)
    assert.equal(w.rowWrites.length, 0, 'partial artifact')
    w.setPartial(false); w.setComposeJobs([{ jobId: 'j1' }])
    await w.chat(RECORDED.deckRestored(), () => layout.restore()); await w.advance(500)
    assert.equal(w.rowWrites.length, 0, 'compose jobs')
    w.setComposeJobs([])
    await w.chat(RECORDED.deleteSlide2(), () => layout.remove(FINAL, 1), { presentationId: 'another-deck' }); await w.advance(500)
    assert.equal(w.rowWrites.length, 0, 'another deck\'s frame')
    await w.chat(RECORDED.deleteSlide2(), () => {}, { ownerCurrent: false }); await w.advance(500)
    assert.equal(w.rowWrites.length, 0, 'a retired owner')
    await w.chat(RECORDED.deleteSlide2(), () => {}); await w.advance(500)
    assert.deepEqual(w.rowWrites.map(x => x.updates.slideCount), [2], 'settled: one write, Layout\'s count at that moment (2 slides)')
    w.close()
    const shellOff = world({ sources, flag: 'true', layout: createLayout(), row: ROW(), shell: false })
    shellOff.mount(); await shellOff.settle()
    await shellOff.chat(RECORDED.deleteSlide3(), () => {}); await shellOff.advance(500)
    assert.equal(shellOff.rowWrites.length, 0, 'outside the Studio shell the floor stays')
    shellOff.close()
    const noSession = world({ sources, flag: 'true', layout: createLayout(), row: ROW(), session: false })
    noSession.mount(); await noSession.settle()
    await noSession.chat(RECORDED.deleteSlide3(), () => {}); await noSession.advance(500)
    assert.equal(noSession.rowWrites.length, 0, 'no session, no write (and no throw)')
    noSession.close()
  })
  await check('flag off: the page has no writer at all: the row is never written on a chat change, whatever the other flags say', async () => {
    for (const flag of [undefined, 'false']) {
      const layout = createLayout()
      const w = world({ sources, flag, layout, row: ROW() })
      w.mount(); await w.settle()
      await w.chat(RECORDED.deleteSlide3(), () => layout.remove(FINAL, 2)); await w.advance(500)
      assert.equal(w.rowWrites.length, 0, `flag ${flag}`)
      assert.equal(w.rowCount(), 3)
      if (w.truth) assert.equal(w.truth.STUDIO_DECK_SYNC_TRUTH_ENABLED, false)
      w.close()
    }
  })
  // the writer on its own (the real lib): every refusal, and the order of answers
  const writerRig = (overrides = {}) => {
    const calls = { reads: [], writes: [] }
    const state = { building: false, displayed: { presentationId: 'p1', activeVersion: 'final' }, count: 2, owner: true }
    const pending = []
    const lib = truthLib('true')
    const persist = lib.createSettledRowCountWriter({
      readLayoutCount: id => { calls.reads.push(id); return overrides.read ? overrides.read(id, pending) : Promise.resolve(state.count) },
      getDisplayed: () => state.displayed, isBuilding: () => state.building, writeRowCount: count => { calls.writes.push(count) } })
    return { persist, calls, state, pending, owner: () => state.owner }
  }
  await check('flag on (writer): a count is written for the displayed final deck, once Layout has answered', async () => {
    const r = writerRig()
    assert.equal(await r.persist('p1', r.owner), 2)
    assert.deepEqual(r.calls.writes, [2])
    assert.deepEqual(r.calls.reads, ['p1'])
  })
  await check('flag on (writer): a build in progress is asked before Layout is (no read at all) and again after it answers', async () => {
    const before = writerRig()
    before.state.building = true
    assert.equal(await before.persist('p1', before.owner), null)
    assert.deepEqual(before.calls.reads, [])
    const during = writerRig({ read: (id, pending) => new Promise(resolve => pending.push(() => resolve(2))) })
    const run = during.persist('p1', during.owner)
    during.state.building = true // the build starts while Layout is answering
    during.pending[0]()
    assert.equal(await run, null)
    assert.deepEqual(during.calls.writes, [])
  })
  await check('flag on (writer): a retired owner, another deck on screen, or the strawman on screen writes nothing', async () => {
    for (const change of [state => { state.owner = false }, state => { state.displayed = { presentationId: 'p2', activeVersion: 'final' } }, state => { state.displayed = { presentationId: 'p1', activeVersion: 'strawman' } }, state => { state.displayed = null }]) {
      const r = writerRig({ read: (id, pending) => new Promise(resolve => pending.push(() => resolve(2))) })
      const run = r.persist('p1', r.owner)
      change(r.state)
      r.pending[0]()
      assert.equal(await run, null)
      assert.deepEqual(r.calls.writes, [])
    }
  })
  await check('flag on (writer): Layout unable to answer (null, an error, 0, a fraction, text) writes nothing and throws nothing', async () => {
    for (const answer of [null, 0, 2.5, 'x', undefined, -1]) {
      const r = writerRig({ read: () => Promise.resolve(answer) })
      assert.equal(await r.persist('p1', r.owner), null, String(answer))
      assert.deepEqual(r.calls.writes, [])
    }
    const failing = writerRig({ read: () => Promise.reject(new Error('Layout is down')) })
    assert.equal(await failing.persist('p1', failing.owner), null)
    assert.deepEqual(failing.calls.writes, [])
    assert.equal(await writerRig().persist('', () => true), null)
  })
  await check('flag on (writer): two changes in a row, Layout answering in the other order: only the newer call writes, with its own read', async () => {
    const r = writerRig({ read: (id, pending) => new Promise(resolve => pending.push(count => resolve(count))) })
    const first = r.persist('p1', r.owner), second = r.persist('p1', r.owner)
    r.pending[1](3) // the newer answers first
    r.pending[0](2) // the older answers last
    assert.deepEqual([await first, await second], [null, 3])
    assert.deepEqual(r.calls.writes, [3])
  })

  // --- a stale slide_count re-sent after a chat delete (B29): the reconnect ---
  const sig = r => ({ asked: r.rowWrites, sent: r.sentCounts, row: r.row, recovered: r.recovered, header: r.steps.map(x => x.header), footer: r.steps.map(x => x.footer), rail: r.steps.map(x => x.rail), notices: r.notices })
  await check('flag off (reconnect): today\'s output: Director\'s state frame writes its own count to the row (3) and the viewer\'s floor keeps the header and footer at 3 on the promoted deck; the same-page socket reconnect recovers nothing', async () => {
    const same = sig(await reconnectScenario({ sources, flag: undefined, scenario: 'samePage' }))
    assert.deepEqual(same, { asked: [], sent: [], row: 3, recovered: false, header: [2, 2, 2, 2], footer: [2, 2, 2, 2], rail: [2, 2, 2, 2], notices: 0 })
    const replay = sig(await reconnectScenario({ sources, flag: undefined, scenario: 'replay' }))
    assert.deepEqual([replay.asked, replay.row, replay.header], [[3], 3, [2, 2, 2, 2]])
    const reload = sig(await reconnectScenario({ sources, flag: undefined, scenario: 'reload' }))
    assert.deepEqual([reload.asked, reload.row, reload.recovered, reload.header, reload.footer, reload.rail], [[3], 3, true, [3, 3, 3, 3], [3, 3, 3, 3], [3, 2, 2, 2]], 'the count rides along (Math.max(2, 3)) and the floor keeps it')
  })
  await check('reconnect, the reproduction (flag on, #533 without the reconnect lines): the build\'s 3 comes back to the SESSION ROW after a chat delete (Decks card "3 slides" over 2), on a replayed presentation_url and on a reload that promotes the final deck; the header and footer say 3 until the viewer\'s next poll (reload only: the page\'s own count shields them on the same page); the same-page socket reconnect recovers nothing', async () => {
    const old = withoutReconnectLines(sources)
    const same = sig(await reconnectScenario({ sources: old, flag: 'true', scenario: 'samePage' }))
    assert.deepEqual(same, { asked: [2], sent: [2], row: 2, recovered: false, header: [2, 2, 2, 2], footer: [2, 2, 2, 2], rail: [2, 2, 2, 2], notices: 0 }, 'not real: the hook\'s state is the final deck already, so the recovery does nothing')
    const replay = sig(await reconnectScenario({ sources: old, flag: 'true', scenario: 'replay' }))
    assert.deepEqual([replay.asked, replay.sent, replay.row, replay.header, replay.footer, replay.rail], [[2, 3], [2, 3], 3, [2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 2]], 'the row goes 2 -> 3; the page\'s override keeps the viewer at 2')
    for (const quiet of [false, true]) {
      const reload = sig(await reconnectScenario({ sources: old, flag: 'true', scenario: 'reload', quiet }))
      assert.deepEqual([reload.asked, reload.sent, reload.row, reload.recovered], [[3], [3], 3, true], `quiet ${quiet}: the row goes 2 -> 3`)
      assert.deepEqual([reload.header, reload.footer, reload.rail], [[3, 3, 3, 2], [3, 3, 3, 2], [3, 2, 2, 2]], 'the viewer comes down at its next poll; the row does not')
    }
    assert.equal(deckCard(3).plainLabel, '3 slides', 'and the Decks card reads it')
  })
  await check('flag on (reconnect): a stale slide_count re-sent after a chat delete no longer reaches the row: a replayed presentation_url and a promoting sync_response leave it at 2 (Layout\'s count), the Decks card reads "2 slides", and the same-page reconnect changes nothing', async () => {
    const same = sig(await reconnectScenario({ sources, flag: 'true', scenario: 'samePage' }))
    assert.deepEqual(same, { asked: [2], sent: [2], row: 2, recovered: false, header: [2, 2, 2, 2], footer: [2, 2, 2, 2], rail: [2, 2, 2, 2], notices: 0 })
    const replay = sig(await reconnectScenario({ sources, flag: 'true', scenario: 'replay' }))
    assert.deepEqual([replay.asked, replay.sent, replay.row], [[2, undefined, 2], [2, undefined, 2], 2], 'Director\'s own write carries no slideCount; the one that follows is Layout\'s')
    assert.deepEqual([replay.header, replay.footer, replay.rail, replay.notices], [[2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 2], 0])
    const reload = sig(await reconnectScenario({ sources, flag: 'true', scenario: 'reload' }))
    assert.deepEqual([reload.asked, reload.sent, reload.row, reload.recovered], [[undefined, 2], [undefined, 2], 2, true])
    assert.deepEqual([reload.header, reload.footer, reload.rail], [[3, 3, 3, 2], [3, 3, 3, 2], [3, 2, 2, 2]], 'the promoted deck\'s count is the prop until the viewer\'s next poll (the first paint of any reload); the poll commits its own count and the floor is gone')
    assert.equal(reload.notices, 0)
    assert.equal(deckCard(replay.row).plainLabel, '2 slides')
  })
  await check('flag on (reconnect): in an opened session (the quiet period of NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: a passive write is trimmed against the row as it was opened) the row is never written 3 first: Director\'s write carries no count, so nothing has to be written back', async () => {
    const reload = await reconnectScenario({ sources, flag: 'true', scenario: 'reload', quiet: true })
    assert.equal(reload.row, 2)
    assert.deepEqual(reload.sentCounts, [undefined], 'the promoted deck\'s own fields went through; no count, and Layout\'s 2 is the stored 2, so it is trimmed')
    assert.equal(reload.rowWrites.includes(3), false)
    // a deck whose count really changed since the row was opened: Layout\'s count is new, so it is sent
    const layout = createLayout()
    layout.remove(FINAL, 2); layout.remove(FINAL, 1) // 1 slide now; the row says 2
    const w = world({ sources, flag: 'true', layout, row: ROW_STRAWMAN_FIRST(), quiet: true })
    w.boot(); w.poll(); await w.settle()
    w.syncResponse(SYNC()); await w.settle()
    assert.equal(w.rowCount(), 1)
    assert.deepEqual(w.sentWrites.map(x => x.slideCount), [undefined, 1])
    w.close()
  })
  await check('flag on (reconnect): a deck that finished while the socket was down: the promoting sync_response leaves the row on Layout\'s count (3), not Director\'s (4) and not the old row\'s (1)', async () => {
    for (const [flag, expected] of [[undefined, 4], ['true', 3]]) {
      const layout = createLayout()
      const w = world({ sources, flag, layout, row: { ...ROW_STRAWMAN_FIRST(), slideCount: 1 } })
      w.boot(); w.poll(); await w.settle()
      w.syncResponse(SYNC({ slide_count: 4 })); await w.settle()
      assert.equal(w.rowCount(), expected, `flag ${flag}`)
      w.close()
    }
  })
  await check('flag on (reconnect): a build in progress still grows: Director\'s state frames 2, 3 and a promoting sync_response (4) raise the row exactly as today, and Layout is not asked; once the build is over the next state frame settles the row on Layout\'s count (3)', async () => {
    for (const flag of [undefined, 'true']) {
      const layout = createLayout()
      const w = world({ sources, flag, layout, row: { ...ROW_STRAWMAN_FIRST(), slideCount: 1 }, building: true })
      w.boot(); w.poll(); await w.settle()
      const frame = n => ({ presentationId: FINAL, presentationUrl: `${LAYOUT}/p/${FINAL}`, slideCount: n, currentStage: 6 })
      const rows = [w.rowCount()]
      for (const n of [2, 3]) { w.sessionState(frame(n)); await w.settle(); rows.push(w.rowCount()) }
      assert.equal(w.syncResponse(SYNC({ slide_count: 4 })).didRecover, true); await w.settle(); rows.push(w.rowCount())
      assert.deepEqual(rows, [1, 2, 3, 4], `flag ${flag}: the build raises the row`)
      assert.equal(w.layout.reads(), 0, `flag ${flag}: a build in progress never asks Layout`)
      assert.deepEqual(w.rowWrites.map(x => x.updates.slideCount), [2, 3, 4], `flag ${flag}: Director's counts are written as they are`)
      w.setBuilding(false)
      w.sessionState(frame(4)); await w.settle() // Director\'s last count is one too many; Layout holds 3
      assert.equal(w.rowCount(), flag === 'true' ? 3 : 4, `flag ${flag}: after the build`)
      assert.equal(w.layout.reads(), flag === 'true' ? 1 : 0)
      w.close()
    }
  })
  await check('flag on (reconnect): every other state frame is untouched: a strawman or blank deck\'s count is written as Director sent it, Layout is not read, and an unsettled deck (template mode, a partial artifact, compose jobs, outside the Studio shell) keeps Director\'s count', async () => {
    const layout = createLayout()
    const w = world({ sources, flag: 'true', layout, row: ROW() })
    w.mount(); await w.settle()
    w.sessionState({ presentationId: PREVIEW, presentationUrl: `${LAYOUT}/p/${PREVIEW}`, slideCount: 3, currentStage: 4, activeVersion: 'strawman' }); await w.settle()
    w.sessionState({ presentationId: 'blank-deck', presentationUrl: `${LAYOUT}/p/blank-deck`, slideCount: 1, currentStage: 0 }); await w.settle()
    assert.deepEqual(w.rowWrites.map(x => x.updates.slideCount), [3, 1])
    assert.equal(layout.reads(), 0)
    w.setTemplateMode(true); w.sessionState({ presentationId: FINAL, presentationUrl: `${LAYOUT}/p/${FINAL}`, slideCount: 4, currentStage: 6 }); await w.settle(); w.setTemplateMode(false)
    w.setPartial(true); w.sessionState({ presentationId: FINAL, presentationUrl: `${LAYOUT}/p/${FINAL}`, slideCount: 5, currentStage: 6 }); await w.settle(); w.setPartial(false)
    w.setComposeJobs([{ jobId: 'j1' }]); w.sessionState({ presentationId: FINAL, presentationUrl: `${LAYOUT}/p/${FINAL}`, slideCount: 6, currentStage: 6 }); await w.settle(); w.setComposeJobs([])
    w.sessionState({ presentationId: undefined, presentationUrl: `${LAYOUT}/p/${FINAL}`, slideCount: 7, currentStage: 6 }); await w.settle() // a final frame that names no deck cannot be checked against Layout: Director's count stays
    assert.deepEqual(w.rowWrites.map(x => x.updates.slideCount), [3, 1, 4, 5, 6, 7])
    assert.equal(layout.reads(), 0, 'none of these asked Layout')
    w.close()
    const shellOff = world({ sources, flag: 'true', layout: createLayout(), row: ROW(), shell: false })
    shellOff.mount(); await shellOff.settle()
    shellOff.sessionState({ presentationId: FINAL, presentationUrl: `${LAYOUT}/p/${FINAL}`, slideCount: 3, currentStage: 6 }); await shellOff.settle()
    assert.deepEqual(shellOff.rowWrites.map(x => x.updates.slideCount), [3], 'outside the Studio shell the floor stays')
    shellOff.close()
  })
  await check('flag on (reconnect): the session changes while Layout answers, or Layout cannot answer: the new session\'s row is never written; the row keeps its count', async () => {
    const layout = createLayout()
    layout.remove(FINAL, 2)
    const w = world({ sources, flag: 'true', layout, row: ROW() })
    w.mount(); await w.settle()
    w.finalFrame(FINAL_FRAME())
    w.sessionIdRef.current = 'another-session' // the user opened another session before Layout answered
    await w.settle()
    assert.deepEqual(w.rowWrites.map(x => x.updates.slideCount), [undefined], 'only Director\'s own write (for the session it came for); Layout\'s count is not written to the new one')
    assert.equal(w.rowCount(), 3)
    w.close()
    const down = { ...createLayout(), fetch: async () => new Response('', { status: 503 }) }
    const d = world({ sources, flag: 'true', layout: down, row: { ...ROW(), slideCount: 2 } })
    d.mount(); await d.settle()
    d.finalFrame(FINAL_FRAME()); await d.settle()
    assert.deepEqual(d.rowWrites.map(x => x.updates.slideCount), [undefined])
    assert.equal(d.rowCount(), 2, 'Layout cannot answer: the row keeps 2, not Director\'s 3')
    d.close()
  })
  await check('pins (reconnect): the hook sets the final deck the way the proof models it and calls the page; the recovery keeps its Math.max (a pinned base line this change leaves alone); the page\'s count rule is untouched; the new page lines are marked pure insertions', () => {
    assert.ok(sources[SOCKET_HOOK].includes('Object.assign(newState, recovery.state);'))
    assert.ok(sources[SOCKET_HOOK].includes('newState.presentationId = message.payload.presentation_id;\n                  newState.slideCount = message.payload.slide_count;'))
    assert.ok(sources['lib/director-sync-recovery.ts'].includes('? Math.max(state.slideCount ?? 0, payload.slide_count ?? 0) || state.slideCount'))
    assert.ok(sources[PAGE].includes('const nextSlideCount = Math.max(state.slideCount ?? 0, verifiedLayoutCount ?? 0) || state.slideCount'))
    const lines = sources[PAGE].split('\n').filter(line => line.includes(RECONNECT_MARK))
    assert.equal(lines.length, 3, 'three marked lines in onSessionStateChange')
    for (const line of lines) assert.match(line, DECK_SYNC_TRUTH_MARKER_RE)
    const callback = cutArrow(sources[PAGE], 'onSessionStateChange: (state)')
    assert.ok(callback.indexOf('delete updates.slideCount') > callback.indexOf('const updates: any = {') && callback.indexOf('delete updates.slideCount') < callback.indexOf('persistenceRef.current.updateMetadata(updates'), 'the count is dropped before Director\'s write')
    assert.ok(callback.indexOf('deckSyncRowCountRef.current?.(state.presentationId') > callback.indexOf('persistenceRef.current.updateMetadata(updates'), 'and Layout\'s count is written after it')
  })

  // --- the chain from the page's write to the card, pinned in the source ---
  await check('pins: the row\'s chain is the existing one: updateMetadata -> updateSession -> PATCH /api/sessions/[id] (the fields as sent) -> the list\'s select -> the dashboard\'s mapping -> the card', async () => {
    const read = rel => sources[rel] ?? readFileSync(path.join(repoRoot, rel), 'utf8')
    assert.ok(read('hooks/use-session-persistence.ts').includes('await updateSession(currentSessionId, normalizedUpdates)'), 'updateMetadata sends through updateSession')
    assert.ok(read('hooks/use-chat-sessions.ts').includes("method: 'PATCH'") && read('hooks/use-chat-sessions.ts').includes('body: JSON.stringify(updates)'), 'updateSession PATCHes the updates as they are')
    assert.ok(read('app/api/sessions/[id]/route.ts').includes('...sessionUpdates'), 'the PATCH writes the fields it was sent (slideCount among them; no endpoint is added)')
    assert.ok(read('app/api/sessions/route.ts').includes('        slideCount: true,'), 'the list selects the row\'s slideCount')
    assert.ok(sources[DASH].includes('slideCount: session.slideCount || 0,'), 'the dashboard maps it')
    assert.ok(sources[DASH].includes('<span>{presentation.slideCount} slides</span>') && sources[DASH].includes('studioDeckCardCountLabel(presentation.slideCount, presentation.status)'), 'and the card prints it')
    assert.ok(sources[PAGE].includes('persistenceRef.current.updateMetadata(updates, { passive: true }) // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: Director\'s own state frame'), 'the build\'s own write is where it was')
    assert.ok(sources[PAGE].includes('const nextSlideCount = Math.max(state.slideCount ?? 0, verifiedLayoutCount ?? 0) || state.slideCount'), 'and its count rule is untouched')
    const calls = sources[PAGE].split('\n').filter(line => line.includes('deckSyncRowCountRef.current?.(') && !line.includes(RECONNECT_MARK)) // the reconnect's call (B29) is pinned in its own check
    assert.equal(calls.length, 1, 'one call, in onDeckMutation')
    const handler = cutArrow(sources[PAGE], 'onDeckMutation: (message')
    assert.ok(handler.indexOf('deckSyncRowCountRef.current?.(plan.override.presentationId, owner.isCurrent)') > handler.indexOf('if (!plan) return') && handler.indexOf('deckSyncRowCountRef.current?.(') < handler.indexOf('if (deckMutationCountSettlerRef.current)'), 'after the plan is accepted, before the settler\'s return')
    assert.ok(sources[PAGE].indexOf("deckSyncBuildingRef.current = ") > sources[PAGE].indexOf('themeExportDirectiveRunnerRef.current = !('), 'the block sits after the K5 add runner and the theme / export runner')
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
  await check('pins: the viewer\'s rail header is totalSlides, the footer reads the same counters, the hook subscribes the controller to the page\'s reports, and the page\'s reports are where they were', () => {
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
await record('flag off, source: taking this change\'s lines out gives dev\'s file (the base commit, #522 merged) byte for byte (the Builder page, the viewer, the notice lib, the hook, the notice component), the strip is idempotent, and the socket hook is the base\'s', () => {
  for (const rel of DECK_SYNC_TRUTH_FILES) {
    const stripped = stripDeckSyncTruth(rel, rawText(rel))
    assert.equal(sha(stripPeers(rel, stripped)), sha(stripPeers(rel, gitText(rel, BASE))), rel) // both sides past the other registered changes' marked lines: a change that lands on dev later does not make this one fail
    assert.equal(stripDeckSyncTruth(rel, stripped), stripped, `${rel} idempotent`)
    assert.ok(DECK_SYNC_TRUTH_MARKER_RE.test(rawText(rel)), `${rel} carries the marker`)
  }
  for (const rel of Object.keys(DECK_SYNC_TRUTH_PIN_EDITS)) assert.equal(sha(stripPeers(rel, stripDeckSyncTruth(rel, rawText(rel)))), sha(stripPeers(rel, gitText(rel, BASE))), `${rel} (an older proof taught to read through the registry)`)
  assert.equal(sha(stripLaterEnvBlocks('.env.example', rawText('.env.example'))), sha(stripLaterEnvBlocks('.env.example', gitText('.env.example', BASE))), '.env.example: only this change\'s block is new')
  assert.ok(rawText('.env.example').includes(DECK_SYNC_TRUTH_ENV_BLOCK), 'the env block is in .env.example')
  assert.match(DECK_SYNC_TRUTH_ENV_BLOCK, /^NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH="false"$/m)
  for (const rel of [SOCKET_HOOK, DASH, CARD_LIB, 'hooks/use-builder-session.ts', 'lib/director-sync-recovery.ts']) assert.equal(sha(stripPeers(rel, rawText(rel))), sha(stripPeers(rel, gitText(rel, BASE))), `${rel} is the base's`)
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
await record('flag off, behaviour (reconnect): the stale-count scenarios (the same-page sync_response, a replayed presentation_url, a strawman-first reload with a promoting sync_response; with and without the opened-session quiet period) on the current sources with the flag unset or "false" hash the same as on the base sources', async () => {
  const mine = await reconnectRun({ sources: head, flag: undefined })
  const base = await reconnectRun({ sources: baseSources(), flag: undefined })
  const falsy = await reconnectRun({ sources: head, flag: 'false' })
  assert.equal(sha(JSON.stringify(mine)), sha(JSON.stringify(base)))
  assert.equal(sha(JSON.stringify(falsy)), sha(JSON.stringify(base)), 'flag "false" is off')
  assert.equal(mine.length, SCENARIOS.length * 2)
  assert.deepEqual(mine.map(x => x.row), [3, 3, 3, 3, 3, 3], 'today: the row keeps the build\'s 3 in every scenario')
  console.log(`  reconnect run, flag off: current ${sha(JSON.stringify(mine)).slice(0, 16)}  base ${sha(JSON.stringify(base)).slice(0, 16)}`)
})
await record('the same checks on the BASE sources: every "flag off" check passes there (today\'s output is the base\'s), and the flag-on checks fail (the fix is what they measure)', async () => {
  const onBase = await suite(baseSources())
  for (const name of onBase.passedNames.concat(onBase.failures).filter(n => /^flag off/.test(n))) assert.ok(onBase.passedNames.includes(name), `flag-off check fails on the base: ${name}`)
  const failedOnBase = onBase.failures.filter(n => /^flag on/.test(n))
  assert.ok(failedOnBase.length >= 5, `flag-on checks that fail on the base: ${failedOnBase.length}`)
})

// --- the own-commit scope: the first-parent line of BASE..HEAD, merges left out ---
// A merge of dev brings dev's history in by its second parent, so neither dev's commits nor the merge commit itself are on the first-parent line; merged into dev (the gate's state) this change's commits are on the merge's second parent and the line is empty.
await record(`scope: every own commit (the first-parent line of BASE..HEAD, no merges) starts "${DECK_SYNC_TRUTH_SUBJECT}", touches only this change's files, adds only marked lines to the app files and takes out only the replaced base lines; a dev merge never counts`, () => {
  assert.ok(git('rev-parse', '--verify', `${BASE}^{commit}`).trim().startsWith(BASE.slice(0, 7)), 'the base commit is in this clone')
  assert.equal(git('rev-parse', '--verify', `${BASE}^{commit}`).trim(), BASE)
  const shas = git('rev-list', '--first-parent', '--no-merges', `${BASE}..HEAD`).split('\n').filter(Boolean)
  shas.splice(0, shas.length, ...shas.filter(sha => !/^Chat parity/.test(git('log', '-1', '--format=%s', sha)))) // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): on a branch stacked after this change (chat parity's, merged with dev), the first-parent commits are chat parity's own, not this change's; with none left the identity checks above cover the files
  shas.splice(0, shas.length, ...shas.filter(sha => !/^Save refused notice:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (DECK-SAVE-REFUSED-NOTICE): a change stacked after this one has its commits on the first-parent line of a branch (the gate's merge puts them on the second parent); they are its own, not this change's
  shas.splice(0, shas.length, ...shas.filter(sha => !/^Chat text set:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CHAT-ELEMENT-TEXT-SET): on a branch stacked after this change (chat text set's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files
  shas.splice(0, shas.length, ...shas.filter(sha => !/^Structural refine decline:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CHAT-REFINE-STRUCTURAL-DECLINE): on a branch stacked after this change (the structural refine decline's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files
  for (const sha of shas) assert.equal(git('rev-list', '--parents', '-n', '1', sha).trim().split(' ').length, 2, `${sha} is not a merge`)
  const mergesOnLine = git('rev-list', '--first-parent', '--merges', `${BASE}..HEAD`).split('\n').filter(Boolean)
  for (const sha of mergesOnLine) assert.equal(shas.includes(sha), false, 'a merge commit is not an own commit')
  if (shas.length === 0) { console.log('NOTE scope: no commit of this change on the first-parent line (merged into dev: its commits are on the second parent); the identity checks above cover the files'); return }
  const replaced = new Set(Object.values(DECK_SYNC_TRUTH_REPLACED).flat().map(([, was]) => was.replace(/\n$/, '')))
  // scripts/test-studio-chat-element-edit.mjs: an earlier commit taught #522's pins count; #532 (dev a0ff9d45) made that count read past every later change, so at the merge with dev the file is dev's again.
  const SUPERSEDED = new Set(['scripts/test-studio-chat-element-edit.mjs'])
  const touched = new Set()
  for (const sha of shas) {
    const subject = git('log', '-1', '--format=%s', sha).trim(), body = git('log', '-1', '--format=%B', sha)
    assert.ok(subject.startsWith(DECK_SYNC_TRUTH_SUBJECT), `own commit subject: ${subject}`)
    assert.match(body, /Co-Authored-By: Claude (Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, `commit trailer: ${sha}`)
    for (const file of git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean)) { assert.ok(DECK_SYNC_TRUTH_SCOPE_FILES.has(file) || SUPERSEDED.has(file), `stray file in ${sha}: ${file}`); touched.add(file) }
    for (const rel of DECK_SYNC_TRUTH_FILES) {
      for (const line of git('show', '-U0', '--format=', sha, '--', rel).split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l))) {
        if (line.startsWith('+')) assert.ok(DECK_SYNC_TRUTH_MARKER_RE.test(line), `${rel}: an added line without the marker: ${line.slice(0, 100)}`)
        else assert.ok(replaced.has(line.slice(1)), `${rel}: a removed line that is not a replaced base line: ${line.slice(0, 100)}`)
      }
    }
    for (const rel of Object.keys(DECK_SYNC_TRUTH_PIN_EDITS)) {
      // an edit to an older proof: its added lines carry the registry-read mark; what it removed is proven by the byte-for-byte put-back (the "flag off, source" check above)
      for (const line of git('show', '-U0', '--format=', sha, '--', rel).split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'))) assert.match(line, /registry read \(DECK-SYNC-TRUTH\)/, `${rel}: added ${line.slice(0, 100)}`)
    }
  }
  for (const rel of [SOCKET_HOOK, 'hooks/use-builder-session.ts', 'lib/director-sync-recovery.ts']) assert.equal(touched.has(rel), false, `${rel} is not touched`)
  assert.ok(touched.has('lib/studio-deck-sync-truth.ts') && touched.has('scripts/test-studio-deck-sync-truth.mjs') && touched.has(PAGE))
  // Nothing of FRONTEND-1's or COMPOSER-2's tests, and not test-director-websocket-reconnect, is touched.
  const protectedTests = /^scripts\/(test-studio-p2-|test-studio-launch-wording|test-studio-env-append-tolerant|test-studio-route-params|test-studio-admin-email-guard|test-studio-uat-marketing|test-studio-deck-title|test-studio-deck-card-thumbnail|test-studio-first-paint|test-director-websocket-reconnect|test-studio-chat-clean|test-studio-flow-control)/
  for (const file of touched) assert.equal(protectedTests.test(file), false, file)
})

// --- mutants: each must break at least one check ---
class MutationTargetMissing extends Error {}
const mutate = (sources, rel, from, to) => {
  if (!sources[rel] || !sources[rel].includes(from)) throw new MutationTargetMissing(`${rel}: ${String(from).slice(0, 90)}`)
  return { ...sources, [rel]: sources[rel].replace(from, () => to) }
}
/** Swap the line holding `first` with the next line holding `second` (a mutant that moves a statement past another). */
const moveLineAfter = (sources, rel, first, second) => {
  const lines = (sources[rel] ?? '').split('\n')
  const at = lines.findIndex(line => line.includes(first))
  const to = lines.findIndex((line, i) => i > at && line.includes(second))
  if (at < 0 || to < 0) throw new MutationTargetMissing(`${rel}: ${first.slice(0, 80)}`)
  const [moved] = lines.splice(at, 1)
  lines.splice(to, 0, moved)
  return { ...sources, [rel]: lines.join('\n') }
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
  // the session row: the lib's writer
  ['writer: a build in progress is not asked before Layout is read', s => mutate(s, LIB, "if (typeof presentationId !== 'string' || !presentationId || deps.isBuilding()) return null", "if (typeof presentationId !== 'string' || !presentationId) return null")],
  ['writer: a build that starts while Layout answers is not noticed', s => mutate(s, LIB, 'if (mine !== sequence || !ownerIsCurrent() || deps.isBuilding()) return null', 'if (mine !== sequence || !ownerIsCurrent()) return null')],
  ['writer: the owner is not asked', s => mutate(s, LIB, 'if (mine !== sequence || !ownerIsCurrent() ||', 'if (mine !== sequence ||')],
  ['writer: an older answer may overwrite a newer one', s => mutate(s, LIB, 'if (mine !== sequence || !ownerIsCurrent()', 'if (!ownerIsCurrent()')],
  ['writer: any deck on screen will do', s => mutate(s, LIB, "displayed.presentationId !== presentationId || displayed.activeVersion !== 'final'", "displayed.activeVersion !== 'final'")],
  ['writer: the strawman on screen will do', s => mutate(s, LIB, " || displayed.activeVersion !== 'final'", '')],
  ['writer: a count of 0, a fraction or text is written', s => mutate(s, LIB, 'const count = wholeCount(layoutCount)\n    if (count === null) return null', 'const count = layoutCount as number\n    if (count === null) return null')],
  ['writer: a Layout error escapes', s => mutate(s, LIB, 'try { layoutCount = await deps.readLayoutCount(presentationId) } catch { return null }', 'layoutCount = await deps.readLayoutCount(presentationId)')],
  ['writer: the count written is one too many', s => mutate(s, LIB, 'deps.writeRowCount(count)\n    return count', 'deps.writeRowCount(count + 1)\n    return count')],
  // the session row: the page's marked lines
  ['page: the call is dropped from onDeckMutation (the row is never settled)', s => mutate(s, PAGE, 'deckSyncRowCountRef.current?.(plan.override.presentationId, owner.isCurrent) //', '//')],
  ['page: the call is made only for a plan that carries a count (an undo\'s deck_restored carries none)', s => mutate(s, PAGE, 'deckSyncRowCountRef.current?.(plan.override.presentationId, owner.isCurrent) //', 'if (plan.override.slideCount !== null) deckSyncRowCountRef.current?.(plan.override.presentationId, owner.isCurrent) //')],
  ['page: the call comes after the count settler\'s return (never reached with the settler on)', s => moveLineAfter(s, PAGE, 'deckSyncRowCountRef.current?.(plan.override.presentationId', 'void deckMutationCountSettlerRef.current(plan.override, owner.isCurrent); return }')],
  ['page: the call is made for the wrong deck', s => mutate(s, PAGE, 'deckSyncRowCountRef.current?.(plan.override.presentationId, owner.isCurrent) //', "deckSyncRowCountRef.current?.('another-deck', owner.isCurrent) //")],
  ['page: the owner is not passed on (a retired owner would still write)', s => mutate(s, PAGE, 'deckSyncRowCountRef.current?.(plan.override.presentationId, owner.isCurrent) //', 'deckSyncRowCountRef.current?.(plan.override.presentationId, () => true) //')],
  ['page: the building ref is never on', s => mutate(s, PAGE, 'deckSyncBuildingRef.current = ', 'deckSyncBuildingRef.current = false; const deckSyncUnused = ')],
  ['page: outside the Studio shell the row is written too', s => mutate(s, PAGE, 'deckSyncBuildingRef.current = !studioShell || ', 'deckSyncBuildingRef.current = ')],
  ['page: a partial artifact is not a build', s => mutate(s, PAGE, ' || studioPartialMetadata || templateModeOn || isGeneratingFinal', ' || templateModeOn || isGeneratingFinal')],
  ['page: a final build is not a build', s => mutate(s, PAGE, ' || templateModeOn || isGeneratingFinal || isGeneratingStrawman ||', ' || templateModeOn || isGeneratingStrawman ||')],
  ['page: a strawman build is not a build', s => mutate(s, PAGE, ' || isGeneratingStrawman || slideComposeThumbnailJobs.length > 0 // DECK-SYNC-TRUTH', ' || slideComposeThumbnailJobs.length > 0 // DECK-SYNC-TRUTH')],
  ['page: template mode is not a build', s => mutate(s, PAGE, ' || studioPartialMetadata || templateModeOn || isGeneratingFinal', ' || studioPartialMetadata || isGeneratingFinal')],
  ['page: compose jobs are not a build', s => mutate(s, PAGE, ' || slideComposeThumbnailJobs.length > 0 // DECK-SYNC-TRUTH', ' // DECK-SYNC-TRUTH')],
  ['page: the writer is made with the flag off', s => mutate(s, PAGE, "if (process.env.NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH === 'true' && !deckSyncRowCountRef.current)", 'if (!deckSyncRowCountRef.current)')],
  ['page: the writer is never made', s => mutate(s, PAGE, "if (process.env.NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH === 'true' && !deckSyncRowCountRef.current)", "if (process.env.NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH === 'never' && !deckSyncRowCountRef.current)")],
  ['page: no deck is on screen for the writer', s => mutate(s, PAGE, 'getDisplayed: () => slideComposerPresentationRef.current,', 'getDisplayed: () => null,')],
  ['page: the writer never asks whether a build runs', s => mutate(s, PAGE, 'isBuilding: () => deckSyncBuildingRef.current,', 'isBuilding: () => false,')],
  ['page: the row gets one slide too many', s => mutate(s, PAGE, 'persistenceRef.current.updateMetadata({ slideCount: count, lastMessageAt: new Date() }, { passive: true })', 'persistenceRef.current.updateMetadata({ slideCount: count + 1, lastMessageAt: new Date() }, { passive: true })')],
  ['page: the write is not passive', s => mutate(s, PAGE, 'lastMessageAt: new Date() }, { passive: true }) }, // DECK-SYNC-TRUTH', 'lastMessageAt: new Date() }) }, // DECK-SYNC-TRUTH')],
  ['page: the write drops lastMessageAt', s => mutate(s, PAGE, 'updateMetadata({ slideCount: count, lastMessageAt: new Date() }, { passive: true })', 'updateMetadata({ slideCount: count }, { passive: true })')],
  ['page: Layout\'s inventory is read for another deck', s => mutate(s, PAGE, 'presentationId: id, fetchImpl: (input, init) => fetch(input, init) }); return result.kind', "presentationId: 'another-deck', fetchImpl: (input, init) => fetch(input, init) }); return result.kind")],
  // the reconnect (B29): the page's three marked lines in onSessionStateChange
  ['page (reconnect): Director\'s count is not dropped for a settled final deck (the stale count writes the row back)', s => mutate(s, PAGE, 'if (deckSyncSettled) delete updates.slideCount //', '//')],
  ['page (reconnect): Director\'s count is dropped after Director\'s write has gone', s => moveLineAfter(s, PAGE, 'if (deckSyncSettled) delete updates.slideCount', 'persistenceRef.current.updateMetadata(updates, { passive: true })')],
  ['page (reconnect): Layout\'s count is never written (Director\'s is dropped and nothing replaces it)', s => mutate(s, PAGE, 'if (deckSyncSettled) { const deckSyncSession', 'if (false) { const deckSyncSession')],
  ['page (reconnect): Layout\'s count is asked for another deck', s => mutate(s, PAGE, "deckSyncRowCountRef.current?.(state.presentationId ?? '',", "deckSyncRowCountRef.current?.('another-deck',")],
  ['page (reconnect): Layout\'s count is asked for no deck', s => mutate(s, PAGE, "deckSyncRowCountRef.current?.(state.presentationId ?? '',", "deckSyncRowCountRef.current?.('',")],
  ['page (reconnect): the session is not checked (a new session\'s row would be written)', s => mutate(s, PAGE, '() => currentSessionIdRef.current === deckSyncSession)', '() => true)')],
  ['page (reconnect): the session is read after Layout answers (always the current one)', s => mutate(s, PAGE, 'const deckSyncSession = currentSessionIdRef.current; void deckSyncRowCountRef.current?.(state.presentationId ?? \'\', () => currentSessionIdRef.current === deckSyncSession)', 'void deckSyncRowCountRef.current?.(state.presentationId ?? \'\', () => currentSessionIdRef.current === currentSessionIdRef.current)')],
  ['page (reconnect): the strawman and blank frames are settled too', s => mutate(s, PAGE, '&& isFinal && Boolean(state.presentationId) && !deckSyncBuildingRef.current //', '&& Boolean(state.presentationId) && !deckSyncBuildingRef.current //')],
  ['page (reconnect): a build in progress does not hold Director\'s count back', s => mutate(s, PAGE, '&& isFinal && Boolean(state.presentationId) && !deckSyncBuildingRef.current //', '&& isFinal && Boolean(state.presentationId) //')],
  ['page (reconnect): the flag is not asked (Director\'s count is dropped with the flag off)', s => mutate(s, PAGE, 'const deckSyncSettled = Boolean(deckSyncRowCountRef.current) && isFinal', 'const deckSyncSettled = isFinal')],
  ['page (reconnect): a frame without a deck id is settled', s => mutate(s, PAGE, '&& isFinal && Boolean(state.presentationId) &&', '&& isFinal &&')],
  ['dashboard: the card reads a count that is not the row\'s', s => mutate(s, DASH, 'slideCount: session.slideCount || 0,', 'slideCount: 3,')],
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
